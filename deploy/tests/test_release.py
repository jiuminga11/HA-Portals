"""Sandbox-only tests: no real npm/pip/systemctl/nginx or application imports."""
import contextlib
import importlib.util
import io
import json
import os
import signal
import shlex
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch

PROJECT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('release', PROJECT / 'deploy/release.py')
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)

STUB = '''#!/usr/bin/env python3
import json, pathlib, sys
root = pathlib.Path(sys.argv[2])
action = sys.argv[1]
with (root / 'calls').open('a') as f: f.write(action + '\\n')
fail = root / 'fail'
if fail.exists() and fail.read_text() == action:
    fail.unlink()
    sys.exit(7)
if action == 'verify':
    out = dict.fromkeys(('service_config','nginx_include','aliases','environment','exclusive_writer'), True)
    if (root / 'unprepared').exists(): out['nginx_include'] = False
elif action in ('stop','stopped'): out = {'stopped': True}
elif action == 'start': out = {'started': True}
else:
    degraded = root / 'degraded'
    out = {'http_status': 200, 'body': {'status': 'ok', 'db': 'degraded' if degraded.exists() else 'ok'}}
    if degraded.exists(): degraded.unlink()
print(json.dumps(out))
'''


def sandbox_runtime_root():
    runtime = release.confined(PROJECT / '.remediation-runtime', PROJECT)
    return release.confined(Path(os.environ.get('REMEDIATION_TEST_ROOT', str(runtime))), runtime)


class ReleaseTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        runtime = sandbox_runtime_root()
        runtime.mkdir(parents=True, exist_ok=True)
        cls.sandbox = Path(tempfile.mkdtemp(prefix='deploy-tests-', dir=runtime))

    def setUp(self):
        self.root = Path(tempfile.mkdtemp(dir=self.sandbox))
        for folder in ('backend/app', 'backend/data', 'backend/uploads', 'backend/venv/bin',
                       'frontend/dist', 'candidate/backend/app', 'candidate/frontend'):
            (self.root / folder).mkdir(parents=True)
        self.db = self.root / 'backend/data/custom.db'
        with sqlite3.connect(self.db) as connection:
            connection.execute('CREATE TABLE content(value TEXT)')
            connection.execute("INSERT INTO content VALUES ('old')")
        self.env = ('ADMIN_PASSWORD=not-a-default-password\nJWT_SECRET_KEY=not-a-default-secret\n'
                    'DATABASE_URL=sqlite:///./data/custom.db\nUPLOAD_DIR=uploads\n')
        (self.root / 'backend/.env').write_text(self.env)
        (self.root / 'backend/uploads/image').write_bytes(b'old image')
        for name in ('backend/app/main.py', 'backend/requirements.txt', 'frontend/dist/index.html'):
            (self.root / name).write_text('old')
        for name in ('candidate/backend/app/main.py', 'candidate/backend/requirements.txt', 'candidate/frontend/package.json'):
            (self.root / name).write_text('new')
        (self.root / 'backend/venv/bin/python').write_text('#!original-path\nold dependency')
        self.adapter = self.root / 'adapter'
        self.adapter.write_text(STUB)
        self.adapter.chmod(0o700)
        self.argv = ['--root', str(self.root), '--apply', '--adapter', str(self.adapter),
                     '--source', str(self.root / 'candidate')]
        # Shell wrappers/stub shebangs must use the interpreter running this suite,
        # not a different system python3 that can hide version-specific failures.
        interpreter = self.root / 'test-interpreter'
        interpreter.mkdir()
        launcher = interpreter / 'python3'
        launcher.write_text('#!/bin/sh\nexec ' + shlex.quote(sys.executable) + ' "$@"\n')
        launcher.chmod(0o700)
        self.environment = patch.dict(os.environ, {
            'PYTHONDONTWRITEBYTECODE': '1',
            'PATH': str(interpreter) + os.pathsep + os.environ['PATH'],
        })
        self.environment.start()

    def tearDown(self):
        self.environment.stop()

    def build(self, source, target):
        # Assert the prebuild never touches the live output.
        self.assertEqual((self.root / 'frontend/dist/index.html').read_text(), 'old')
        (target / 'dist').mkdir(parents=True)
        (target / 'dist/index.html').write_text('new')

    def install(self, command, cwd):
        (self.root / 'backend/venv/bin/python').write_text('new dependency')

    def invoke(self, args=None, build=None, install=None):
        output = io.StringIO()
        with contextlib.redirect_stdout(output), contextlib.redirect_stderr(output), \
                patch.object(release, 'build', side_effect=build or self.build), \
                patch.object(release, 'run', side_effect=install or self.install):
            code = release.main(self.argv if args is None else args)
        self.output = output.getvalue()
        if code:
            self.assertNotIn('Release verified', self.output)
        return code

    def snapshot(self):
        return next((self.root / '.remediation-runtime/releases').iterdir())

    def assert_old_code(self):
        self.assertEqual((self.root / 'backend/app/main.py').read_text(), 'old')
        self.assertEqual((self.root / 'frontend/dist/index.html').read_text(), 'old')
        self.assertEqual((self.root / 'backend/venv/bin/python').read_text(), '#!original-path\nold dependency')

    def test_plan_zero_writes_and_no_adapter(self):
        before = release.inventory(self.root)
        self.assertEqual(self.invoke(['--root', str(self.root)]), 0)
        self.assertEqual(before, release.inventory(self.root))
        self.assertFalse((self.root / 'calls').exists())

    def test_plan_missing_env_zero_writes(self):
        (self.root / 'backend/.env').unlink()
        before = release.inventory(self.root)
        self.assertEqual(self.invoke(['--root', str(self.root)]), 1)
        self.assertEqual(before, release.inventory(self.root))
        self.assertIn('READ-ONLY PLAN BLOCKED', self.output)

    def test_shell_wrapper_plan_no_side_effects(self):
        before = release.inventory(self.root)
        result = subprocess.run(['bash', str(PROJECT / 'deploy/deploy.sh'), '--root', str(self.root)],
                                capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(before, release.inventory(self.root))

    def test_operator_direct_startup_uses_stdlib_operator(self):
        operator = PROJECT / 'deploy/operator.py'
        # No args must reach the adapter's controlled error handler, not fail
        # importing stdlib modules with a circular-import traceback.
        rejected = subprocess.run([sys.executable, '-B', str(operator)],
                                  capture_output=True, text=True)
        self.assertEqual(rejected.returncode, 1)
        self.assertEqual(rejected.stdout + rejected.stderr, '')

        tools = self.root / 'operator-command-stubs'
        tools.mkdir()
        nginx = ('# configuration file sandbox.conf:\nlocation /ha/api/ {}\n'
                 f'alias {self.root}/frontend/dist/;\nalias {self.root}/backend/uploads/;\n')
        service = (f'WorkingDirectory={self.root}/backend\n'
                   f'EnvironmentFiles={self.root}/backend/.env\n'
                   f'ExecStart={self.root}/backend/venv/bin/uvicorn\n')
        for name, value in (('nginx', nginx), ('systemctl', service)):
            stub = tools / name
            stub.write_text('#!/usr/bin/env python3\nimport pathlib\n'
                            f'with pathlib.Path({str(self.root / "operator-stub-calls")!r}).open("a") as log: log.write({name!r}+"\\n")\n'
                            f'print({value!r},end="")\n')
            stub.chmod(0o700)
        (self.root / 'deploy').mkdir()
        (self.root / 'deploy/prepared.json').write_text(json.dumps({
            'nginx_sha256': release.hashlib.sha256(nginx.encode()).hexdigest(),
            'service_sha256': release.hashlib.sha256(service.encode()).hexdigest(),
            'env_sha256': release.digest(self.root / 'backend/.env'),
            'root': str(self.root), 'reviewed_environment_file_only': True,
            'reviewed_exclusive_writer': True, 'reviewed_effective_locations': True,
        }))
        environment = dict(os.environ, PATH=str(tools) + os.pathsep + os.environ['PATH'])
        result = subprocess.run([str(operator), 'verify', str(self.root)], env=environment,
                                capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout), dict.fromkeys(
            ('service_config', 'nginx_include', 'aliases', 'environment', 'exclusive_writer'), True))
        self.assertEqual((self.root / 'operator-stub-calls').read_text().splitlines(), ['nginx', 'systemctl'])

    def test_cli_with_build_and_install_command_stubs(self):
        tools = self.root / 'tools'
        tools.mkdir()
        npm = tools / 'npm'
        npm.write_text('#!/usr/bin/env python3\nimport pathlib, sys\n'
                       'if sys.argv[1] == "run":\n'
                       ' pathlib.Path("dist").mkdir()\n'
                       ' pathlib.Path("dist/index.html").write_text("stub build")\n')
        npm.chmod(0o700)
        python = self.root / 'backend/venv/bin/python'
        python.write_text('#!/bin/sh\nexit 0\n')
        python.chmod(0o700)
        environment = dict(os.environ, PATH=str(tools) + os.pathsep + os.environ['PATH'])
        result = subprocess.run(['bash', str(PROJECT / 'deploy/deploy.sh'), *self.argv],
                                env=environment, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual((self.root / 'frontend/dist/index.html').read_text(), 'stub build')
        release.verify(self.snapshot() / 'data')

    def test_missing_db_never_seeds(self):
        self.db.rename(self.db.with_name('seed.db'))
        before = release.inventory(self.root)
        self.assertEqual(self.invoke(), 1)
        self.assertEqual(before, release.inventory(self.root))

    def test_paths_and_config_fail_closed(self):
        bad = ['sqlite:////tmp/outside.db', 'sqlite:///../data.db', 'sqlite:///data/custom.db?mode=ro',
               'postgresql://localhost/db', 'sqlite:///:memory:']
        for url in bad:
            with self.subTest(url=url):
                (self.root / 'backend/.env').write_text(self.env.replace('sqlite:///./data/custom.db', url))
                self.assertEqual(self.invoke(), 1)
        (self.root / 'backend/.env').write_text(self.env.replace('UPLOAD_DIR=uploads', 'UPLOAD_DIR=data'))
        self.assertEqual(self.invoke(), 1)
        (self.root / 'backend/.env').write_text(self.env.replace('not-a-default-password', '$(touch bad)'))
        self.assertEqual(self.invoke(), 1)
        self.assertNotIn('not-a-default-secret', self.output)

    def test_symlink_escape_refused(self):
        self.db.unlink()
        self.db.symlink_to(self.sandbox / 'outside.db')
        self.assertEqual(self.invoke(), 1)

    def test_upload_symlink_refused(self):
        (self.root / 'backend/uploads/link').symlink_to(self.db)
        self.assertEqual(self.invoke(), 1)

    def test_environment_override_refused(self):
        with patch.dict(os.environ, {'DATABASE_URL': 'sqlite:///wrong.db'}):
            self.assertEqual(self.invoke(), 1)

    def test_default_empty_credentials_refused_without_disclosure(self):
        for value in ('', 'changeme', 'password', '   '):
            (self.root / 'backend/.env').write_text(self.env.replace('not-a-default-password', value))
            self.assertEqual(self.invoke(), 1)
            self.assertNotIn('not-a-default-secret', self.output)

    def test_unverified_nginx_refused_before_build(self):
        (self.root / 'unprepared').touch()
        self.assertEqual(self.invoke(), 1)
        self.assertFalse((self.root / '.remediation-runtime').exists())

    def test_complete_backup_and_integrity(self):
        self.assertEqual(self.invoke(), 0)
        snap = self.snapshot()
        release.verify(snap / 'data')
        release.verify(snap / 'code')
        self.assertEqual((snap / 'data/uploads/image').read_bytes(), b'old image')
        self.assertNotEqual((snap / 'data/uploads/image').stat().st_ino,
                            (self.root / 'backend/uploads/image').stat().st_ino)
        with sqlite3.connect(snap / 'data/database.db') as connection:
            self.assertEqual(connection.execute('PRAGMA integrity_check').fetchone(), ('ok',))
        calls = (self.root / 'calls').read_text().splitlines()
        self.assertEqual(calls, ['verify', 'stop', 'stopped', 'start', 'health'])
        (snap / 'data/uploads/image').write_text('tampered')
        with self.assertRaises(release.Refused):
            release.verify(snap / 'data')

    def test_build_failure_leaves_live_untouched(self):
        def fail(*args):
            raise release.Refused('build failed')
        self.assertEqual(self.invoke(build=fail), 1)
        self.assert_old_code()
        self.assertEqual((self.root / 'calls').read_text().splitlines(), ['verify'])

    def test_dependency_failure_restores_original_path_venv(self):
        def fail(*args):
            self.install(*args)
            raise release.Refused('dependency failed')
        self.assertEqual(self.invoke(install=fail), 1)
        self.assert_old_code()
        self.assertIn('restored and healthy', self.output)

    def test_timeout_kills_child_before_rollback(self):
        original_run = release.run
        target = self.root / 'backend/venv/bin/python'
        child = ('import pathlib, time; time.sleep(1.5); '
                 f'pathlib.Path({str(target)!r}).write_text("orphan write")')
        script = self.root / 'hanging-install.py'
        script.write_text('import os, pathlib, subprocess, sys, time\n'
                          f'child = subprocess.Popen([sys.executable, "-c", {child!r}])\n'
                          f'pathlib.Path({str(self.root / "pids")!r}).write_text(f"{{os.getpid()}} {{child.pid}}")\n'
                          'time.sleep(60)\n')

        def hanging_install(command, cwd):
            self.install(command, cwd)
            original_run([sys.executable, str(script)], cwd)

        with patch.dict(os.environ, {'HA_RELEASE_COMMAND_TIMEOUT': '0.5'}):
            self.assertEqual(self.invoke(install=hanging_install), 1)
        self.assertIn('timed out', self.output)
        self.assertIn('restored and healthy', self.output)
        self.assert_old_code()
        parent, child_pid = map(int, (self.root / 'pids').read_text().split())
        # Direct child was waited/reaped; killed grandchild may await init reaping.
        self.assertFalse(Path(f'/proc/{parent}').exists())
        time.sleep(1.7)
        stat = Path(f'/proc/{child_pid}/stat')
        if stat.exists():
            self.assertEqual(stat.read_text().rsplit(')', 1)[1].split()[0], 'Z')
        self.assert_old_code()  # No delayed child mutation after recovery.

    def test_invalid_command_timeout_refused_before_apply(self):
        for value in ('0', '-1', 'nan', 'inf', '86401', 'not-a-number'):
            with self.subTest(value=value), patch.dict(os.environ, {'HA_RELEASE_COMMAND_TIMEOUT': value}):
                before = release.inventory(self.root)
                self.assertEqual(self.invoke(), 1)
                self.assertEqual(before, release.inventory(self.root))

    def supervised_fixture(self, *, adapter=False, exit_code=None):
        """Real supervisor + temporary command groups, never real service commands."""
        target = self.root / 'backend/venv/bin/python'
        child = ('import pathlib,time; time.sleep(1.5); '
                 f'pathlib.Path({str(target)!r}).write_text("orphan write")')
        body = ('import os,pathlib,subprocess,sys,time\n'
                f'pathlib.Path({str(target)!r}).write_text("mutated dependency")\n'
                f'child=subprocess.Popen([sys.executable,"-c",{child!r}], '
                'stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)\n'
                f'pathlib.Path({str(self.root / "managed-pids")!r}).write_text(f"{{os.getpid()}} {{child.pid}}")\n'
                + ('time.sleep(60)\n' if exit_code is None else f'sys.exit({exit_code})\n'))
        if adapter:
            (self.root / 'trigger').touch()
            injected = ('if action == "health" and (root / "trigger").exists():\n'
                        '    (root / "trigger").unlink()\n'
                        f'    exec({body!r})\n')
            self.adapter.write_text(STUB.replace("action = sys.argv[1]\n", "action = sys.argv[1]\n" + injected))
            target.write_text('#!/bin/sh\nexit 0\n')
        else:
            target.write_text('#!/usr/bin/env python3\n' + body)
        target.chmod(0o700)
        original = target.read_text()
        # Expose a recovery interval to test that a second signal is ignored.
        stub = self.adapter.read_text()
        stub = stub.replace("fail = root / 'fail'", '''if action == 'stop' and (root / 'calls').read_text().splitlines().count('stop') >= 2:
    import time
    (root / 'recovering').touch()
    time.sleep(0.3)
fail = root / 'fail' '''.rstrip())
        self.adapter.write_text(stub)
        harness = self.root / 'supervisor.py'
        harness.write_text('import importlib.util,pathlib,sys\n'
                           f'spec=importlib.util.spec_from_file_location("release",{str(PROJECT / "deploy/release.py")!r})\n'
                           'release=importlib.util.module_from_spec(spec); spec.loader.exec_module(release)\n'
                           'def build(source,target):\n'
                           ' (target/"dist").mkdir(parents=True)\n'
                           ' (target/"dist/index.html").write_text("new")\n'
                           'release.build=build\n'
                           'sys.exit(release.main(sys.argv[1:]))\n')
        return harness, original

    def wait_for_file(self, path, process):
        until = time.monotonic() + 5
        while not path.exists() and process.poll() is None and time.monotonic() < until:
            time.sleep(0.01)
        self.assertTrue(path.exists(), 'supervisor did not reach expected test stage')

    def assert_group_ended(self):
        parent, child = map(int, (self.root / 'managed-pids').read_text().split())
        for pid in (parent, child):
            stat = Path(f'/proc/{pid}/stat')
            if stat.exists():
                self.assertEqual(stat.read_text().rsplit(')', 1)[1].split()[0], 'Z')

    def exercise_supervisor(self, *, adapter=False, signum=None, timeout=False, exit_code=None):
        harness, original = self.supervised_fixture(adapter=adapter, exit_code=exit_code)
        environment = dict(os.environ, HA_RELEASE_COMMAND_TIMEOUT='0.5' if timeout else '10')
        process = subprocess.Popen([sys.executable, '-B', str(harness), *self.argv],
                                   stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=environment)
        try:
            self.wait_for_file(self.root / 'managed-pids', process)
            if signum:
                os.kill(process.pid, signum)
                self.wait_for_file(self.root / 'recovering', process)
                os.kill(process.pid, signal.SIGTERM)  # Must not interrupt recovery.
            stdout, stderr = process.communicate(timeout=10)
        finally:
            if process.poll() is None:
                process.kill()
                process.wait()
        self.assertNotEqual(process.returncode, 0, stdout + stderr)
        self.assertNotIn('Release verified', stdout)
        self.assertFalse(list((self.root / '.remediation-runtime/releases').glob('*/completed')))
        self.assertIn('restored and healthy', stderr)
        if signum:
            self.assertIn('cancelled by', stderr)
        if timeout:
            self.assertIn('timed out', stderr)
        time.sleep(1.7)
        self.assert_group_ended()
        self.assertEqual((self.root / 'backend/venv/bin/python').read_text(), original)
        self.assertEqual((self.root / 'backend/app/main.py').read_text(), 'old')
        self.assertEqual((self.root / 'frontend/dist/index.html').read_text(), 'old')

    def test_install_sigint_cleans_group_then_recovers(self):
        self.exercise_supervisor(signum=signal.SIGINT)

    def test_install_sigterm_cleans_group_then_recovers(self):
        self.exercise_supervisor(signum=signal.SIGTERM)

    def test_nonzero_parent_cleans_surviving_child_before_recovery(self):
        self.exercise_supervisor(exit_code=7)

    def test_adapter_sigint_cleans_group_then_recovers(self):
        self.exercise_supervisor(adapter=True, signum=signal.SIGINT)

    def test_adapter_sigterm_cleans_group_then_recovers(self):
        self.exercise_supervisor(adapter=True, signum=signal.SIGTERM)

    def test_adapter_timeout_cleans_group_then_recovers(self):
        self.exercise_supervisor(adapter=True, timeout=True)

    def test_successful_parent_also_cleans_surviving_child(self):
        self.supervised_fixture(exit_code=0)
        # Exercise the common primitive directly, not a successful real release.
        release.run([sys.executable, str(self.root / 'backend/venv/bin/python')], self.root)
        time.sleep(1.7)
        self.assert_group_ended()
        self.assertEqual((self.root / 'backend/venv/bin/python').read_text(), 'mutated dependency')

    def test_main_restores_original_signal_handlers(self):
        before = {sig: signal.getsignal(sig) for sig in release.CANCEL_SIGNALS}
        self.assertEqual(self.invoke(['--root', str(self.root)]), 0)
        self.assertEqual(before, {sig: signal.getsignal(sig) for sig in release.CANCEL_SIGNALS})
        self.assertEqual(self.invoke(), 0)
        self.assertEqual(before, {sig: signal.getsignal(sig) for sig in release.CANCEL_SIGNALS})

    def test_safe_suite_diagnostics_excludes_payloads(self):
        spec = importlib.util.spec_from_file_location('deploy_suite', PROJECT / 'scripts/remediation/deploy_suite.py')
        wrapper = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(wrapper)
        payload = 'PRIVATE_PAYLOAD_MUST_NOT_BE_REPORTED'

        class PayloadCases(unittest.TestCase):
            def test_failure(case):
                with case.subTest(secret=payload):
                    case.fail(payload)

            def test_error(case):
                raise type(payload, (Exception,), {})(payload)

            def test_skip(case):
                case.skipTest(payload)

        path = self.root / 'safe-summary.json'
        result = wrapper.SafeResult(set(), path)
        unittest.defaultTestLoader.loadTestsFromTestCase(PayloadCases).run(result)
        summary = wrapper.read_summary(path)
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            wrapper.print_summary(summary)
        self.assertNotIn(payload, path.read_text() + output.getvalue())
        self.assertEqual((summary['tests'], summary['failures'], summary['errors'], summary['skipped']), (3, 1, 1, 1))
        self.assertEqual({item['type'] for item in summary['issues']}, {'AssertionError', 'Exception', 'Skipped'})
        self.assertFalse(result.wasSuccessful())
        summary['issues'][0]['test'] = payload
        path.write_text(json.dumps(summary))
        with self.assertRaises(ValueError):
            wrapper.read_summary(path)

    def test_runner_root_is_confined_and_preferred(self):
        selected = self.sandbox / 'runner-tests'
        with patch.dict(os.environ, {'REMEDIATION_TEST_ROOT': str(selected)}):
            self.assertEqual(sandbox_runtime_root(), selected)
        link = self.sandbox / 'linked-root'
        link.symlink_to(self.root, target_is_directory=True)
        for path in (PROJECT / 'deploy', link):
            with patch.dict(os.environ, {'REMEDIATION_TEST_ROOT': str(path)}):
                with self.assertRaises(release.Refused):
                    sandbox_runtime_root()

    def test_adapter_stage_failures_never_succeed(self):
        for stage in ('verify', 'stop', 'stopped', 'start', 'health'):
            with self.subTest(stage=stage):
                (self.root / 'fail').write_text(stage)
                self.assertEqual(self.invoke(), 1)
                self.assert_old_code()

    def test_degraded_200_restores_code_and_reports_failure(self):
        (self.root / 'degraded').touch()
        self.assertEqual(self.invoke(), 1)
        self.assert_old_code()
        self.assertIn('HTTP/JSON health check failed', self.output)

    def test_backup_failure_restarts_without_mutating_code(self):
        with patch.object(release, 'data_backup', side_effect=OSError('disk full')):
            self.assertEqual(self.invoke(), 1)
        self.assert_old_code()
        self.assertEqual((self.root / 'calls').read_text().splitlines()[-2:], ['start', 'health'])

    def test_code_rollback_keeps_later_data(self):
        self.assertEqual(self.invoke(), 0)
        snap = self.snapshot()
        with sqlite3.connect(self.db) as connection:
            connection.execute("INSERT INTO content VALUES ('later')")
        (self.root / 'backend/uploads/later').write_text('later')
        args = self.argv[:5] + ['--rollback', str(snap)]
        self.assertEqual(self.invoke(args), 0)
        self.assert_old_code()
        with sqlite3.connect(self.db) as connection:
            self.assertEqual(connection.execute('SELECT count(*) FROM content').fetchone(), (2,))
        self.assertTrue((self.root / 'backend/uploads/later').exists())

    def test_data_restore_gate_and_current_state_backup(self):
        self.assertEqual(self.invoke(), 0)
        snap = self.snapshot()
        (self.root / 'backend/uploads/later').write_text('later')
        with sqlite3.connect(self.db) as connection:
            connection.execute("INSERT INTO content VALUES ('later')")
        args = self.argv[:5] + ['--rollback', str(snap), '--restore-data']
        count = len(list(snap.parent.iterdir()))
        self.assertEqual(self.invoke(args), 1)
        self.assertEqual(len(list(snap.parent.iterdir())), count)
        self.assertEqual(self.invoke(args + ['--confirm-data-loss', 'RESTORE-DATA-LOSE-LATER-WRITES']), 0)
        newer = next(path for path in snap.parent.iterdir() if path != snap)
        release.verify(newer / 'data')
        self.assertEqual((newer / 'data/uploads/later').read_text(), 'later')
        with sqlite3.connect(newer / 'data/database.db') as connection:
            self.assertEqual(connection.execute('SELECT count(*) FROM content').fetchone(), (2,))
        self.assertFalse((self.root / 'backend/uploads/later').exists())
        with sqlite3.connect(self.db) as connection:
            self.assertEqual(connection.execute('SELECT count(*) FROM content').fetchone(), (1,))

    def test_partial_data_restore_does_not_restart_mixed_data(self):
        self.assertEqual(self.invoke(), 0)
        snap = self.snapshot()
        args = self.argv[:5] + ['--rollback', str(snap), '--restore-data',
                                '--confirm-data-loss', 'RESTORE-DATA-LOSE-LATER-WRITES']
        real_replace = release.replace

        def fail_upload(source, target):
            if target == self.root / 'backend/uploads':
                raise OSError('simulated partial restore')
            real_replace(source, target)

        (self.root / 'calls').write_text('')
        with patch.object(release, 'replace', side_effect=fail_upload):
            self.assertEqual(self.invoke(args), 1)
        self.assertNotIn('start', (self.root / 'calls').read_text().splitlines())
        self.assertIn('RECOVERY FAILED', self.output)

    def test_tampered_snapshot_blocks_rollback(self):
        self.assertEqual(self.invoke(), 0)
        snap = self.snapshot()
        (snap / 'code/backend/app/main.py').write_text('tampered')
        self.assertEqual(self.invoke(self.argv[:5] + ['--rollback', str(snap)]), 1)
        self.assertEqual((self.root / 'backend/app/main.py').read_text(), 'new')


if __name__ == '__main__':
    unittest.main()
