#!/usr/bin/env python3
"""Fail-closed project releases. No application imports or system configuration writes."""
import argparse
from contextlib import contextmanager
import fcntl
import hashlib
import json
import math
import os
from pathlib import Path
import re
import shutil
import signal
import sqlite3
import subprocess
import sys
import uuid


class Refused(RuntimeError):
    pass


class Cancellation(Refused):
    pass


CANCEL_SIGNALS = (signal.SIGINT, signal.SIGTERM)


@contextmanager
def ignore_cancellation():
    previous = {sig: signal.signal(sig, signal.SIG_IGN) for sig in CANCEL_SIGNALS}
    try:
        yield
    finally:
        for sig, handler in previous.items():
            signal.signal(sig, handler)


@contextmanager
def cancellation_handlers():
    def cancel(signum, frame):
        # The first signal cancels; further signals must not interrupt cleanup/recovery.
        for sig in CANCEL_SIGNALS:
            signal.signal(sig, signal.SIG_IGN)
        raise Cancellation('cancelled by ' + signal.Signals(signum).name)

    previous = {sig: signal.signal(sig, cancel) for sig in CANCEL_SIGNALS}
    try:
        yield
    finally:
        for sig, handler in previous.items():
            signal.signal(sig, handler)


def managed_command(command, *, cwd=None, timeout, capture=False, label='command'):
    """Own one session/group; never return control to rollback with live group writers."""
    process = None
    try:
        # Defer cancellation until Popen has returned its handle. Otherwise a signal
        # between fork and assignment could leave a group we cannot clean up.
        mask = signal.pthread_sigmask(signal.SIG_BLOCK, CANCEL_SIGNALS)
        try:
            process = subprocess.Popen(command, cwd=cwd, start_new_session=True,
                                       stdout=subprocess.PIPE if capture else subprocess.DEVNULL,
                                       stderr=subprocess.DEVNULL, text=True)
        finally:
            signal.pthread_sigmask(signal.SIG_SETMASK, mask)
        stdout, _ = process.communicate(timeout=timeout)
        result = subprocess.CompletedProcess(command, process.returncode, stdout)
    except subprocess.TimeoutExpired:
        raise Refused(label + ' timed out; process group killed and command reaped') from None
    finally:
        if process is not None:
            with ignore_cancellation():
                # Also clean descendants on nonzero AND successful parent exit.
                # systemd-managed services are outside this temporary process group.
                try:
                    os.killpg(process.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                finally:
                    process.wait()
                    if process.stdout is not None:
                        process.stdout.close()
    require(result.returncode == 0, label + ' failed')
    return result


def require(condition, message):
    if not condition:
        raise Refused(message)


def confined(path, root):
    path = Path(os.path.abspath(path))
    root = root.resolve()
    require(path.is_relative_to(root), 'path outside allowed repository')
    for part in (path, *path.parents):
        if part == root:
            break
        require(not part.is_symlink(), 'symlink path refused')
    require(path.resolve().is_relative_to(root), 'resolved path escapes repository')
    return path


def plain_tree(path, allow_venv_links=False):
    require(path.exists(), 'required file/directory missing')
    require(not path.is_symlink(), 'symlink root refused')
    for item in path.rglob('*') if path.is_dir() else [path]:
        # Preserve interpreter links without traversing them.
        if item.is_symlink() and allow_venv_links:
            continue
        require(not item.is_symlink(), 'symlink in release/data tree refused')
        require(item.is_file() or item.is_dir(), 'special file refused')


def config(root):
    backend = root / 'backend'
    env = confined(backend / '.env', root)
    require(env.is_file(), 'backend/.env missing; no initialization is performed')
    values = {}
    for line in env.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        match = re.fullmatch(r'([A-Z][A-Z0-9_]*)=(.*)', line)
        require(match is not None, 'unsupported .env syntax (use KEY=value)')
        key, value = match.groups()
        require(key not in values, 'duplicate .env key')
        if value.startswith(('"', "'")):
            require(len(value) >= 2 and value[-1] == value[0], 'invalid quoted .env value')
            value = value[1:-1]
        require(not any(c in value for c in ('$', '`', '\\', '\n', '\r', '#')), 'ambiguous .env value refused')
        values[key] = value
    for key in ('ADMIN_PASSWORD', 'JWT_SECRET_KEY'):
        require(values.get(key, '').strip() and values[key].strip().lower() not in
                {'changeme', 'change-this-to-a-random-secret-key', 'admin', 'password'},
                'credential missing, empty or default (values never displayed)')
    require(not any(k in os.environ for k in values.keys() | {'DATABASE_URL', 'UPLOAD_DIR'}),
            'application environment overrides refused; use clean operator environment')
    url = values.get('DATABASE_URL', '')
    require(url.startswith('sqlite:///'), 'explicit sqlite:/// DATABASE_URL required')
    raw = url[len('sqlite:///'):]
    require(raw and not any(c in raw for c in ('?', '#', '%', ':')), 'SQLite URI/query/memory unsupported')
    db = confined(backend / raw, root)
    uploads_raw = values.get('UPLOAD_DIR', '')
    require(uploads_raw, 'explicit UPLOAD_DIR required')
    uploads = confined(backend / uploads_raw, root)
    require(db.is_relative_to(backend / 'data') and db.suffix == '.db', 'database must be .db under backend/data')
    require(uploads == backend / 'uploads', 'UPLOAD_DIR must match prepared Nginx backend/uploads alias')
    require(db.is_file(), 'real database missing; seed/init forbidden')
    plain_tree(uploads)
    # Even mode=ro SQLite can create SHM for a WAL database. Plan only reads bytes.
    with db.open('rb') as stream:
        require(stream.read(16) == b'SQLite format 3\x00', 'real SQLite database required')
    for suffix in ('-wal', '-shm', '-journal'):
        confined(Path(str(db) + suffix), root)
    return db, uploads


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def inventory(directory):
    result = {}
    for path in sorted(directory.rglob('*')):
        if path.name == 'manifest.json' and path.parent == directory:
            continue
        key = str(path.relative_to(directory))
        result[key] = ('link:' + os.readlink(path) if path.is_symlink() else
                       'dir' if path.is_dir() else digest(path))
    return result


def seal(directory):
    (directory / 'manifest.json').write_text(json.dumps(inventory(directory), indent=2))


def verify(directory):
    require(not directory.is_symlink(), 'backup symlink refused')
    require(json.loads((directory / 'manifest.json').read_text()) == inventory(directory), 'backup manifest mismatch')


def copy(source, target):
    if source.is_dir():
        shutil.copytree(source, target, symlinks=True)
    else:
        shutil.copy2(source, target)


def replace(source, target):
    if target.is_dir():
        shutil.rmtree(target)
    elif target.exists():
        target.unlink()
    copy(source, target)


class Adapter:
    """Trusted operator executable; JSON stdout, no shell interpolation or secrets."""
    def __init__(self, executable, root):
        self.executable = str(confined(executable, root))
        self.root = root

    def call(self, action):
        completed = managed_command([self.executable, action, str(self.root)],
                                    capture=True, timeout=min(120, command_timeout()), label='adapter ' + action)
        try:
            result = json.loads(completed.stdout)
        except ValueError:
            raise Refused('adapter returned invalid JSON') from None
        require(isinstance(result, dict), 'adapter JSON object required')
        return result

    def prepared(self):
        result = self.call('verify')
        require(all(result.get(key) is True for key in
                    ('service_config', 'nginx_include', 'aliases', 'environment', 'exclusive_writer')),
                'prepared service/Nginx/environment/exclusive-writer verification required')

    def stop(self):
        require(self.call('stop').get('stopped') is True, 'service stop failed')
        require(self.call('stopped').get('stopped') is True, 'service not confirmed stopped')

    def start(self):
        require(self.call('start').get('started') is True, 'service start failed')

    def health(self):
        result = self.call('health')
        require(type(result.get('http_status')) is int and 200 <= result['http_status'] < 300
                and isinstance(result.get('body'), dict)
                and result['body'].get('status') == 'ok' and result['body'].get('db') == 'ok',
                'HTTP/JSON health check failed')


def data_backup(db, uploads, target):
    target.mkdir()
    with sqlite3.connect(db.as_uri() + '?mode=ro', uri=True) as source:
        with sqlite3.connect(target / 'database.db') as destination:
            source.backup(destination)
            require(destination.execute('PRAGMA integrity_check').fetchone() == ('ok',), 'backup integrity failed')
            require(destination.execute("SELECT count(*) FROM sqlite_master WHERE type='table'").fetchone()[0] > 0,
                    'empty database refused')
    copy(uploads, target / 'uploads')
    seal(target)
    verify(target)


ARTIFACTS = ('backend/app', 'backend/requirements.txt', 'backend/venv', 'frontend/dist')


def code_backup(root, target):
    target.mkdir()
    for name in ARTIFACTS:
        source = confined(root / name, root)
        plain_tree(source, allow_venv_links=name == 'backend/venv')
        (target / name).parent.mkdir(parents=True, exist_ok=True)
        copy(source, target / name)
    seal(target)
    verify(target)


def restore_code(root, backup):
    verify(backup)
    for name in ARTIFACTS:
        replace(backup / name, confined(root / name, root))
    # venv is restored to its original absolute path, preserving shebang validity.


def command_timeout():
    try:
        seconds = float(os.environ.get('HA_RELEASE_COMMAND_TIMEOUT', '900'))
    except ValueError:
        raise Refused('HA_RELEASE_COMMAND_TIMEOUT must be seconds in (0, 86400]') from None
    require(math.isfinite(seconds) and 0 < seconds <= 86400,
            'HA_RELEASE_COMMAND_TIMEOUT must be seconds in (0, 86400]')
    return seconds


def run(command, cwd):
    managed_command(command, cwd=cwd, timeout=command_timeout(), label='build/dependency command')


def build(source, staging):
    frontend = source / 'frontend'
    plain_tree(frontend)
    shutil.copytree(frontend, staging, ignore=shutil.ignore_patterns('node_modules', 'dist', '.env*'))
    run(['npm', 'ci'], staging)
    run(['npm', 'run', 'build'], staging)
    plain_tree(staging / 'dist')
    require((staging / 'dist/index.html').is_file(), 'built index.html missing')


def operate(args, root, db, uploads, adapter):
    runtime = confined(root / '.remediation-runtime/releases', root)
    for name in ARTIFACTS:
        plain_tree(confined(root / name, root), allow_venv_links=name == 'backend/venv')
    adapter.prepared()
    rollback = None
    if args.rollback:
        rollback = confined(Path(args.rollback).absolute(), runtime)
        verify(rollback / 'code')
        meta = json.loads((rollback / 'identity.json').read_text())
        require(meta == {'root': str(root), 'database': str(db), 'uploads': str(uploads)}, 'rollback identity mismatch')
        if args.restore_data:
            require(args.confirm_data_loss == 'RESTORE-DATA-LOSE-LATER-WRITES', 'explicit data-loss confirmation required')
            verify(rollback / 'data')
    else:
        require(args.source, '--source prepared candidate required')
        source = confined(Path(args.source).absolute(), root)
        require(source != root and not root.is_relative_to(source), 'use isolated candidate, not live checkout')
        plain_tree(confined(source / 'backend/app', root))
        plain_tree(confined(source / 'backend/requirements.txt', root))
        plain_tree(confined(source / 'frontend', root))
    runtime.mkdir(parents=True, exist_ok=True)
    work = runtime / uuid.uuid4().hex
    work.mkdir(mode=0o700)
    (work / 'identity.json').write_text(json.dumps({'root': str(root), 'database': str(db), 'uploads': str(uploads)}))
    if not rollback:
        build(source, work / 'staging')
    stopped = False
    changed = False
    data_incomplete = False
    try:
        adapter.stop()
        stopped = True
        data_backup(db, uploads, work / 'data')
        code_backup(root, work / 'code')
        changed = True
        if rollback:
            restore_code(root, rollback / 'code')
            if args.restore_data:
                data_incomplete = True
                for suffix in ('-wal', '-shm'):
                    sidecar = confined(Path(str(db) + suffix), root)
                    if sidecar.exists():
                        sidecar.unlink()
                replace(rollback / 'data/database.db', db)
                replace(rollback / 'data/uploads', uploads)
                data_incomplete = False
        else:
            replace(source / 'backend/app', root / 'backend/app')
            replace(source / 'backend/requirements.txt', root / 'backend/requirements.txt')
            run([str(root / 'backend/venv/bin/python'), '-m', 'pip', 'install', '-r', 'requirements.txt'], root / 'backend')
            replace(work / 'staging/dist', root / 'frontend/dist')
        adapter.start()
        adapter.health()
        # Terminal commit: do not turn an already committed success into a
        # cancellation between marker/output and main's return. main restores
        # the original handlers on exit, just as for cancellation/recovery.
        for sig in CANCEL_SIGNALS:
            signal.signal(sig, signal.SIG_IGN)
        (work / 'completed').write_text('ok\n')
        print('Release verified; recovery snapshot: ' + str(work))
    except Exception:
        with ignore_cancellation():
            (work / 'completed').unlink(missing_ok=True)
            try:
                if changed:
                    adapter.stop()
                    restore_code(root, work / 'code')
                    # Never implicitly restore data or discard subsequent writes.
                    require(not data_incomplete, 'partial data restore: service must remain stopped')
                    adapter.start()
                    adapter.health()
                    print('Failure: prior code/dist/venv restored and healthy; data NOT reverted.', file=sys.stderr)
                elif stopped:
                    adapter.start()
                    adapter.health()
                else:
                    # A cancelled stop may have reached systemd without returning.
                    adapter.stop()
                    print('Stop incomplete: service stopped; snapshot ' + str(work), file=sys.stderr)
            except Exception:
                try:
                    adapter.stop()
                    state = 'service stopped'
                except Exception:
                    state = 'STOP UNCONFIRMED; operator must stop writers'
                print('RECOVERY FAILED: ' + state + '; keep traffic closed; snapshot ' + str(work), file=sys.stderr)
        raise


def _main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--source')
    parser.add_argument('--adapter', type=Path)
    parser.add_argument('--rollback')
    parser.add_argument('--restore-data', action='store_true')
    parser.add_argument('--confirm-data-loss')
    args = parser.parse_args(argv)
    root = args.root.absolute()
    try:
        require(not root.is_symlink() and root == root.resolve(), 'root must be canonical, not symlinked')
        require(not args.restore_data or args.rollback, '--restore-data requires --rollback')
        db, uploads = config(root)
        if not args.apply:
            print('READ-ONLY PLAN: verify prepared service/Nginx; isolated build; stop sole writer; '
                  'SQLite backup + uploads copy + hash verification; save code/dist/venv; install; '
                  'start; HTTP + JSON health. No changes made.')
            print('Apply requires --apply, --adapter and --source (or --rollback). No system setup or seed.')
            return 0
        require(args.adapter, '--adapter required; service/Nginx must already be prepared')
        command_timeout()  # Reject invalid limits before any apply work or stop.
        # Lock an existing file: no lock-file side effects and concurrent applies fail.
        with (root / 'backend/.env').open('rb') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            operate(args, root, db, uploads, Adapter(args.adapter, root))
        return 0
    except Exception as exc:
        message = str(exc) if isinstance(exc, Refused) else type(exc).__name__
        print(('APPLY REFUSED/FAILED: ' if args.apply else 'READ-ONLY PLAN BLOCKED: ') + message, file=sys.stderr)
        return 1


def main(argv=None):
    with cancellation_handlers():
        try:
            return _main(argv)
        except Cancellation as exc:
            print('CANCELLED: ' + str(exc), file=sys.stderr)
            return 1


if __name__ == '__main__':
    sys.exit(main())
