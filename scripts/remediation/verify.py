"""Single-entry isolated verification. Stdlib supervisor; no private data or dotenv."""
from __future__ import annotations

import argparse
import json
import math
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import sys
import time
import urllib.request
import uuid
from artifact_results import collect_results
from deploy_suite import read_summary as read_deploy_summary, print_summary as print_deploy_summary

ROOT = Path(__file__).resolve().parents[2]
TOOLS = ROOT / 'scripts/remediation'
RUNTIME = ROOT / '.remediation-runtime'
BROWSER_TMP_ROOT = ROOT / '.browser-tmp'
# Linux sockaddr_un.sun_path includes its terminating NUL. Chromium's temporary
# /.org.chromium.Chromium.XXXXXX/SingletonSocket suffix is 46 UTF-8 bytes.
SOCKET_PATH_LIMIT = 107
BROWSER_SOCKET_RESERVE = 47
CORE_BROWSERS = ['browser-reading.cjs', 'browser-states.cjs', 'browser-admin.cjs',
                 'browser-settings-files.cjs', 'browser-gate.cjs', 'browser-avatar.cjs']
FULL_BROWSERS = ['browser-a11y-performance.cjs', 'browser-security-concurrency.cjs']


class StageFailure(Exception):
    def __init__(self, code=1):
        self.code = code


class BrowserTempPathTooLong(ValueError):
    def __init__(self, size):
        self.path_bytes = size
        super().__init__('Project path too long for Chrome socket; use a shorter checkout path')


def validate_browser_tmp_path(path):
    size = len(str(path).encode('utf-8'))
    if size + BROWSER_SOCKET_RESERVE > SOCKET_PATH_LIMIT:
        raise BrowserTempPathTooLong(size)
    return size


def browser_tmp_owner(workspace, name):
    return {'uid': os.getuid(), 'workspace': str(workspace), 'id': workspace.name, 'name': name}


def create_browser_tmp(workspace):
    """Private, project-local, short Chrome socket parent; never falls back to /tmp."""
    base = BROWSER_TMP_ROOT.absolute()
    if base.is_symlink() or base.resolve() != base or not base.is_relative_to(ROOT):
        raise ValueError('Unsafe browser temporary root')
    # Six hex characters + exclusive mkdir: short enough for this checkout and
    # collision-safe without ever reusing another run's directory.
    validate_browser_tmp_path(base / '000000')
    base.mkdir(mode=0o700, exist_ok=True)
    if base.stat().st_uid != os.getuid() or base.stat().st_mode & 0o777 != 0o700:
        raise ValueError('Browser temporary root owner/mode mismatch')
    for _ in range(100):
        name = uuid.uuid4().hex[:6]
        directory = base / name
        try:
            directory.mkdir(mode=0o700)
        except FileExistsError:
            continue
        try:
            marker = directory / '.browser-owner.json'
            with marker.open('x') as stream:
                json.dump(browser_tmp_owner(workspace, name), stream)
            marker.chmod(0o600)
        except BaseException:
            # This exclusive, still-empty directory was just created by us.
            if not directory.is_symlink() and directory.stat().st_uid == os.getuid():
                shutil.rmtree(directory)
            raise
        return directory
    raise RuntimeError('Unable to allocate unique browser temporary directory')


def remove_browser_tmp(directory, workspace):
    base = BROWSER_TMP_ROOT.absolute()
    directory = Path(directory).absolute()
    if (base.is_symlink() or base.resolve() != base or not base.is_relative_to(ROOT)
            or directory.is_symlink() or directory.resolve().parent != base
            or not re.fullmatch(r'[a-f0-9]{6}', directory.name)):
        raise ValueError('Unsafe browser temporary cleanup path')
    marker = directory / '.browser-owner.json'
    if (base.stat().st_uid != os.getuid() or directory.stat().st_uid != os.getuid()
            or marker.is_symlink() or marker.stat().st_uid != os.getuid()):
        raise ValueError('Browser temporary owner mismatch')
    if json.loads(marker.read_text()) != browser_tmp_owner(workspace, directory.name):
        raise ValueError('Browser temporary marker mismatch')
    shutil.rmtree(directory)


class Processes:
    """Own only processes spawned in new sessions; never inspect/kill occupied ports."""
    def __init__(self):
        self.children = []

    def start(self, command, *, cwd, env, log):
        with open(log, 'ab') as stream:
            child = subprocess.Popen(command, cwd=cwd, env=env, stdout=stream,
                                     stderr=subprocess.STDOUT, start_new_session=True)
        self.children.append(child)
        return child

    def stop(self, child):
        if child not in self.children:
            raise ValueError('Not an owned process')
        # A completed leader can leave children (e.g. Chrome); its group is ours too.
        try:
            os.killpg(child.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
        try:
            child.wait(timeout=5)
        except subprocess.TimeoutExpired:
            pass
        try:
            os.killpg(child.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        child.wait(timeout=5)
        self.children.remove(child)

    def close(self):
        for child in self.children[:][::-1]:
            self.stop(child)


def create_workspace(base=RUNTIME):
    base = Path(base).absolute()
    if base.is_symlink() or base.resolve() != base:
        raise ValueError('Symlink runtime rejected')
    base.mkdir(parents=True, exist_ok=True)
    if base.stat().st_uid != os.getuid():
        raise ValueError('Runtime owner mismatch')
    workspace = base / ('verify-' + uuid.uuid4().hex)
    workspace.mkdir(mode=0o700)
    owner = {'uid': os.getuid(), 'id': workspace.name}
    (workspace / '.verification-owner.json').write_text(json.dumps(owner))
    return workspace


def remove_workspace(workspace, base=RUNTIME):
    workspace, base = Path(workspace).absolute(), Path(base).absolute()
    if (base.is_symlink() or base.resolve() != base or workspace.is_symlink()
            or workspace.resolve().parent != base or not workspace.name.startswith('verify-')):
        raise ValueError('Unsafe cleanup path')
    marker = workspace / '.verification-owner.json'
    if marker.is_symlink() or workspace.stat().st_uid != os.getuid():
        raise ValueError('Cleanup owner mismatch')
    if json.loads(marker.read_text()) != {'uid': os.getuid(), 'id': workspace.name}:
        raise ValueError('Cleanup marker mismatch')
    shutil.rmtree(workspace)  # Linux fd-based rmtree does not follow nested symlinks.


def clean_environment(python):
    allow = ['PATH', 'HOME', 'LANG', 'LC_ALL', 'TERM', 'CI', 'NODE_PATH',
             'PLAYWRIGHT_BROWSERS_PATH', 'PLAYWRIGHT_EXECUTABLE_PATH']
    env = {key: os.environ[key] for key in allow if key in os.environ}
    env.update(PYTHONDONTWRITEBYTECODE='1', REMEDIATION_PYTHON=python,
               NO_COLOR='1', NODE_ENV='production')
    return env


def wait_ready(child, path, timeout=30):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if child.poll() is not None:
            raise StageFailure(child.returncode or 1)
        try:
            ready = json.loads(Path(path).read_text())
            if ready['pid'] != child.pid or not 0 < ready['port'] < 65536:
                raise ValueError('Invalid ready record')
            return ready['port']
        except FileNotFoundError:
            time.sleep(.05)
    raise StageFailure(124)


def health(url, child, timeout=30):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if child.poll() is not None:
            raise StageFailure(child.returncode or 1)
        try:
            with urllib.request.urlopen(url, timeout=1) as response:
                if json.load(response).get('db') == 'ok':
                    return
        except (OSError, ValueError):
            time.sleep(.1)
    raise StageFailure(124)


def write_vite_config(workspace):
    config = workspace / 'vite.verification.mjs'
    frontend = ROOT / 'frontend'
    # Explicit envDir:false: even frontend/.env and .env.local are never read.
    config.write_text(f'import project from {json.dumps(str(frontend / "vite.config.ts"))};\n'
                      'export default async env => {\n'
                      'const original = await (typeof project === "function" ? project(env) : project);\n'
                      'return {...original,'
                      f'root:{json.dumps(str(frontend))},envDir:false,base:"/ha/",'
                      f'cacheDir:{json.dumps(str(workspace / "vite-cache"))}' + '};\n};\n')
    return config


def publish_artifacts(workspace, report, *, screenshots=False):
    reports = RUNTIME / 'reports'
    if reports.is_symlink() or reports.resolve() != reports:
        raise ValueError('Unsafe reports path')
    reports.mkdir(exist_ok=True)
    destination = reports / workspace.name
    destination.mkdir(mode=0o700, exist_ok=False)
    report['results'] = collect_results(workspace)
    (destination / 'report.json').write_text(json.dumps(report, indent=2, allow_nan=False) + '\n')
    # Explicit synthetic screenshot name whitelist; never copy a directory/archive.
    if screenshots:
        approved = re.compile(r'(?:pass3/(?:zh|en)-(?:home|about|research|projects|honors|cv)-(?:light|dark)-(?:320|390|1440)'
                              r'|pass3-admin/(?:settings|home-guard|pdf-card|page-modal-auth-expired)'
                              r'|core/(?:editor-bilingual|sorting-before|sorting-failure-rollback))\.png')
        source = workspace / 'fixture/screenshots'
        if source.exists() and not source.is_symlink():
            for file in source.rglob('*.png'):
                relative = file.relative_to(source).as_posix()
                if (not approved.fullmatch(relative) or file.is_symlink()
                        or file.resolve() != file or file.stat().st_size > 20 * 1024 * 1024):
                    continue
                if file.read_bytes()[:8] != b'\x89PNG\r\n\x1a\n':
                    continue
                target = destination / 'screenshots' / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(file, target)
    return destination


def run(args):
    if not all(math.isfinite(value) and value > 0 for value in [args.timeout, args.stage_timeout]):
        raise ValueError('Timeouts must be finite and positive')
    os.umask(0o077)
    workspace = create_workspace(RUNTIME)
    fixture = workspace / 'fixture'
    logs = workspace / 'logs'
    logs.mkdir()
    python = args.python or os.environ.get('REMEDIATION_PYTHON') or str(ROOT / 'backend/.venv/bin/python')
    python = shutil.which(python) or python
    env = clean_environment(python)
    env.update(REMEDIATION_RUN=str(fixture), REMEDIATION_FIXTURE_ROOT=str(workspace),
               REMEDIATION_PASS='core', TMPDIR=str(workspace / 'tmp'),
               REMEDIATION_TEST_ROOT=str(workspace / 'tests'),
               REMEDIATION_IMAGE_PYTHON=os.environ.get('REMEDIATION_IMAGE_PYTHON', sys.executable))
    (workspace / 'tmp').mkdir()
    (workspace / 'tests').mkdir(mode=0o700)
    processes = Processes()
    report = {'schema': 1, 'run': workspace.name, 'profile': args.profile, 'status': 'running',
              'stages': [], 'excluded': ['owner-data readonly', 'historical baseline comparison', 'deployment'],
              'retained_runtime': args.keep_runtime}
    if args.profile != 'full':
        report['excluded'] += ['72-case public matrix', 'contrast sampling',
                               'deployment sandbox tests',
                               'browser-a11y-performance (unless explicitly added)',
                               'browser-security-concurrency (unless explicitly added)']
    if args.profile == 'smoke':
        report['excluded'] += ['production build', 'backend discovery', 'all browser acceptance']
    code = 0
    browser_tmp = None
    deadline = time.monotonic() + args.timeout

    def interrupt(_signum, _frame):
        raise InterruptedError('Verification interrupted')

    previous = {sig: signal.signal(sig, interrupt) for sig in (signal.SIGINT, signal.SIGTERM)}
    def budget_expired(_signum, _frame):
        raise StageFailure(124)
    previous_alarm = signal.signal(signal.SIGALRM, budget_expired)
    signal.setitimer(signal.ITIMER_REAL, args.timeout)

    def execute(label, command, cwd=ROOT, extra_env=None):
        entry = {'stage': label, 'status': 'running'}
        report['stages'].append(entry)
        started = time.monotonic()
        try:
            child = processes.start(command, cwd=cwd, env=extra_env or env, log=logs / (label + '.log'))
        except Exception as error:
            entry.update(status='failed', exit_code=1, error=type(error).__name__)
            raise
        try:
            try:
                result = child.wait(timeout=max(.01, min(args.stage_timeout, deadline - time.monotonic())))
            except subprocess.TimeoutExpired:
                result = 124
            entry.update(exit_code=result, status='passed' if result == 0 else 'failed', seconds=round(time.monotonic() - started, 2))
        finally:
            processes.stop(child)
            if label == 'deploy-sandbox':
                try:
                    report['deploy'] = read_deploy_summary(fixture / 'deploy-summary.json')
                    print_deploy_summary(report['deploy'])
                except Exception:
                    # Never echo malformed JSON, arbitrary keys, paths or payloads.
                    report['deploy'] = {'diagnostic': 'missing-or-invalid-summary'}
                    print('deploy-tests: missing-or-invalid-summary', flush=True)
                    entry.update(exit_code=entry.get('exit_code') or 1, status='failed')
        print(f'{label}: {entry.get("status", "interrupted")} exit={entry.get("exit_code", 130)}', flush=True)
        if entry.get('exit_code') != 0:
            raise StageFailure(entry.get('exit_code', 1))

    try:
        if args.profile != 'smoke':
            browser_tmp = create_browser_tmp(workspace)
            env.update(TMPDIR=str(browser_tmp), TMP=str(browser_tmp), TEMP=str(browser_tmp),
                       REMEDIATION_BROWSER_TMP=str(browser_tmp))
            report['browser_tmp'] = {'pathBytes': validate_browser_tmp_path(browser_tmp),
                                     'socketReserveBytes': BROWSER_SOCKET_RESERVE}
        execute('fixture', [python, str(TOOLS / 'init_fixture.py'), 'fixture'], cwd=workspace)
        if args.profile != 'smoke':
            execute('preflight', ['node', str(TOOLS / 'browser-preflight.cjs')])
            if args.profile == 'full':
                execute('pillow-preflight', [env['REMEDIATION_IMAGE_PYTHON'], '-c', 'from PIL import Image'])
            for name in ['app', 'node']:
                execute('typescript-' + name, ['node', str(ROOT / 'frontend/node_modules/typescript/bin/tsc'),
                        '--noEmit', '-p', str(ROOT / f'frontend/tsconfig.{name}.json'),
                        '--tsBuildInfoFile', str(workspace / f'tsc-{name}.tsbuildinfo')])
            execute('eslint', ['node', str(ROOT / 'frontend/node_modules/eslint/bin/eslint.js'), '.'], cwd=ROOT / 'frontend')
            config = write_vite_config(workspace)
            # Tailwind resolves config/content from cwd. Keep the normal frontend
            # cwd; envDir:false plus explicit cache/output paths still isolate data.
            execute('production-build', ['node', str(ROOT / 'frontend/node_modules/vite/bin/vite.js'),
                    'build', '--config', str(config), '--outDir', str(fixture / 'dist')], cwd=ROOT / 'frontend')
            execute('compiled-css', ['node', str(TOOLS / 'check-built-css.cjs'), str(fixture / 'dist')])
            test_env = dict(env, REMEDIATION_FIXTURE_ROOT=str(workspace / 'tests/backend'))
            execute('backend-discovery', [python, str(TOOLS / 'backend_suite.py')], cwd=workspace, extra_env=test_env)
            summary = json.loads((fixture / 'backend-summary.json').read_text())
            report['backend'] = {key: int(summary[key]) for key in ['tests', 'failures', 'errors', 'skipped']}
            if args.profile == 'full':
                execute('deploy-sandbox', [python, '-B', str(TOOLS / 'deploy_suite.py')])
            for helper in ['auth-test.cjs', 'routing-test.cjs', 'content-test.cjs']:
                execute(helper[:-4], ['node', str(TOOLS / helper)])
        else:
            (fixture / 'dist').mkdir()
            (fixture / 'dist/index.html').write_text('<!doctype html><title>测试 smoke only</title><script src="/ha/assets/smoke.js"></script>')

        backend = processes.start([python, str(TOOLS / 'serve.py'), 'fixture', '--port', '0'], cwd=workspace, env=env, log=logs / 'api-launch.log')
        api_port = wait_ready(backend, fixture / 'backend-ready.json')
        health(f'http://127.0.0.1:{api_port}/api/health', backend)
        preview = processes.start([python, str(TOOLS / 'preview.py'), 'fixture', '--port', '0', '--api-port', str(api_port)], cwd=workspace, env=env, log=logs / 'preview-launch.log')
        port = wait_ready(preview, fixture / 'preview-ready.json')
        env.update(REMEDIATION_ORIGIN=f'http://127.0.0.1:{port}', REMEDIATION_API_PORT=str(api_port))
        health(env['REMEDIATION_ORIGIN'] + '/ha/api/health', preview)
        execute('http-smoke', [python, str(TOOLS / 'smoke.py')])
        if args.profile != 'smoke':
            execute('browser-pass1', ['node', str(TOOLS / 'browser-pass1.cjs'), '--functional-only'])
            for script in CORE_BROWSERS:
                execute(script[:-4], ['node', str(TOOLS / script)])
            execute('browser-public', ['node', str(TOOLS / 'browser-public.cjs'), 'pass3', *(['--core'] if args.profile == 'core' else [])])
            if args.profile == 'full':
                execute('contrast', ['node', str(TOOLS / 'contrast.cjs')])
            extensions = list(dict.fromkeys((FULL_BROWSERS if args.profile == 'full' else []) + args.browser_extra))
            for script in extensions:
                if not re.fullmatch(r'browser-[a-z0-9-]+\.cjs', script) or 'readonly' in script:
                    raise ValueError('Unsafe browser extension')
                execute(script[:-4], ['node', str(TOOLS / script)])
        report['status'] = 'passed'
    except InterruptedError:
        code = 130
        report['status'] = 'interrupted'
    except StageFailure as error:
        code = 124 if error.code == 124 else 1
        report['status'] = 'failed'
    except Exception as error:
        code = 1
        report.update(status='failed', error=type(error).__name__)
        if isinstance(error, BrowserTempPathTooLong):
            report['browser_tmp'] = {'pathBytes': error.path_bytes, 'maxPathBytes': SOCKET_PATH_LIMIT - BROWSER_SOCKET_RESERVE,
                                     'status': 'failed', 'reason': 'shorter-checkout-path-required'}
            print(f'Chrome preflight failed: TMPDIR requires {error.path_bytes} UTF-8 bytes; '
                  f'maximum {SOCKET_PATH_LIMIT - BROWSER_SOCKET_RESERVE}; use a shorter project checkout path (no external fallback).')
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)
        signal.signal(signal.SIGALRM, previous_alarm)
        for sig in previous:
            signal.signal(sig, signal.SIG_IGN)
        try:
            processes.close()
            report['cleanup_processes'] = 'passed'
        except Exception as error:
            code = 1
            report.update(status='failed', cleanup_processes=type(error).__name__)
        if browser_tmp is not None:
            try:
                if report.get('cleanup_processes') != 'passed':
                    raise RuntimeError('Browser processes must stop before profile cleanup')
                remove_browser_tmp(browser_tmp, workspace)
                report['cleanup_browser_tmp'] = 'passed'
            except Exception as error:
                code = 1
                report.update(status='failed', cleanup_browser_tmp=type(error).__name__)
        for entry in report['stages']:
            if entry['status'] == 'running':
                entry.update(status='interrupted' if code == 130 else 'failed', exit_code=code or 1)
        report['exit_code'] = code
        destination = None
        try:
            destination = publish_artifacts(workspace, report, screenshots=args.profile != 'smoke')
        except Exception as error:
            code = 1
            report.update(status='failed', artifacts=type(error).__name__, exit_code=code)
        if not args.keep_runtime:
            try:
                remove_workspace(workspace, RUNTIME)
                report['cleanup_runtime'] = 'passed'
            except Exception as error:
                code = 1
                report.update(status='failed', cleanup_runtime=type(error).__name__, exit_code=code)
        else:
            report['cleanup_runtime'] = 'retained-by-explicit-opt-in'
        if destination:
            (destination / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
        for sig, handler in previous.items():
            signal.signal(sig, handler)
        print(f'report: {destination.relative_to(ROOT) if destination else "unavailable"}; exit={code}')
    return code


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--profile', choices=['core', 'full', 'smoke'], default='core')
    parser.add_argument('--python', help='Python with backend requirements (default backend/.venv/bin/python)')
    parser.add_argument('--keep-runtime', action='store_true', help='Retain sensitive local runtime, never included in artifacts')
    parser.add_argument('--timeout', type=float, default=2700, help='Overall command budget in seconds')
    parser.add_argument('--stage-timeout', type=float, default=600)
    parser.add_argument('--browser-extra', action='append', default=[], help='Explicit additional scripts/remediation/browser-*.cjs')
    args = parser.parse_args()
    if not all(math.isfinite(value) and value > 0 for value in [args.timeout, args.stage_timeout]):
        parser.error('Timeouts must be finite and positive')
    return run(args)


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception as error:
        print(f'verification-bootstrap: {type(error).__name__}', file=sys.stderr)
        sys.exit(1)
