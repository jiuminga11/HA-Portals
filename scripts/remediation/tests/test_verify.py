"""Supervisor-only unit tests; no application DB, npm, or browser suites."""
import argparse
import contextlib
import io
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch

TOOLS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(TOOLS))
import verify


class SupervisorTests(unittest.TestCase):
    def setUp(self):
        verify.RUNTIME.mkdir(exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(prefix='supervisor-unit-', dir=verify.RUNTIME)
        self.base = Path(self.temp.name)
        self.addCleanup(self.temp.cleanup)

    def test_ownership_and_symlink_cleanup_guards(self):
        workspace = verify.create_workspace(self.base)
        target = self.base / 'untouched'
        target.mkdir()
        (target / 'keep').write_text('synthetic test')
        (workspace / 'nested-link').symlink_to(target, target_is_directory=True)
        link = self.base / 'verify-link'
        link.symlink_to(workspace, target_is_directory=True)
        with self.assertRaises(ValueError):
            verify.remove_workspace(link, self.base)
        verify.remove_workspace(workspace, self.base)
        self.assertTrue((target / 'keep').exists())

    def test_marker_mismatch_refuses_delete(self):
        workspace = verify.create_workspace(self.base)
        (workspace / '.verification-owner.json').write_text('{}')
        with self.assertRaises(ValueError):
            verify.remove_workspace(workspace, self.base)
        self.assertTrue(workspace.exists())

    def test_environment_drops_production_values(self):
        with patch.dict(os.environ, {'ADMIN_PASSWORD': 'TEST-ONLY', 'DATABASE_URL': 'TEST-ONLY', 'JWT_SECRET_KEY': 'TEST-ONLY', 'VITE_API_URL': 'TEST-ONLY', 'DEBUG': 'pw:api'}):
            env = verify.clean_environment(sys.executable)
        for key in ['ADMIN_PASSWORD', 'DATABASE_URL', 'JWT_SECRET_KEY', 'VITE_API_URL', 'DEBUG']:
            self.assertNotIn(key, env)

    def test_backend_entry_is_safe_for_spawn_import(self):
        result = subprocess.run(
            [sys.executable, '-c',
             'import runpy,sys; runpy.run_path(sys.argv[1], run_name="__mp_main__")',
             str(TOOLS / 'backend_suite.py')],
            cwd=self.base, env=verify.clean_environment(sys.executable),
            capture_output=True, text=True, timeout=10,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, '')
        self.assertEqual(list(self.base.iterdir()), [])

    def test_short_browser_tmp_isolated_owned_and_symlink_safe(self):
        workspace = verify.create_workspace(self.base)
        other = verify.create_workspace(self.base)
        first = verify.create_browser_tmp(workspace)
        second = verify.create_browser_tmp(other)
        try:
            self.assertNotEqual(first, second)
            self.assertEqual(first.stat().st_mode & 0o777, 0o700)
            self.assertLessEqual(len(str(first).encode('utf-8')) + verify.BROWSER_SOCKET_RESERVE, 107)
            with self.assertRaises(ValueError):
                verify.remove_browser_tmp(first, other)
            marker = first / '.browser-owner.json'
            original = marker.read_text()
            bad_owner = json.loads(original)
            bad_owner['uid'] = -1
            marker.write_text(json.dumps(bad_owner))
            with self.assertRaises(ValueError):
                verify.remove_browser_tmp(first, workspace)
            marker.write_text(original)
            # Nested symlink must not delete any sibling run's profile.
            (second / 'keep').write_text('synthetic sibling')
            (first / 'sibling-link').symlink_to(second, target_is_directory=True)
            alias = self.base / 'browser-link'
            alias.symlink_to(first, target_is_directory=True)
            with self.assertRaises(ValueError):
                verify.remove_browser_tmp(alias, workspace)
            with patch.object(verify, 'BROWSER_TMP_ROOT', alias):
                with self.assertRaises(ValueError):
                    verify.create_browser_tmp(workspace)
            verify.remove_browser_tmp(first, workspace)
            self.assertTrue((second / 'keep').is_file())
        finally:
            if first.exists():
                verify.remove_browser_tmp(first, workspace)
            verify.remove_browser_tmp(second, other)

    def test_short_browser_tmp_utf8_length_rejection(self):
        candidate = verify.ROOT / '.browser-tmp' / ('界' * 20)
        with self.assertRaises(verify.BrowserTempPathTooLong) as error:
            verify.validate_browser_tmp_path(candidate)
        self.assertEqual(error.exception.path_bytes, len(str(candidate).encode('utf-8')))
        self.assertGreater(error.exception.path_bytes, len(str(candidate)))

    def test_short_browser_tmp_cleanup_on_failure_timeout_and_keep(self):
        real_create = verify.create_browser_tmp
        for timeout in [False, True]:
            paths = []
            fake = self.base / ('sleep-python' if timeout else 'missing-python')
            if timeout:
                fake.write_text('#!/bin/sh\nexec sleep 30\n')
                fake.chmod(0o700)
            args = argparse.Namespace(profile='core', python=str(fake), keep_runtime=True,
                                      timeout=10, stage_timeout=.1, browser_extra=[])
            def allocate(workspace):
                result = real_create(workspace)
                paths.append(result)
                return result
            with patch.object(verify, 'RUNTIME', self.base), patch.object(verify, 'create_browser_tmp', side_effect=allocate):
                code = verify.run(args)
            self.assertEqual(code, 124 if timeout else 1)
            self.assertEqual(len(paths), 1)
            self.assertFalse(paths[0].exists())
        reports = [json.loads(file.read_text()) for file in self.base.glob('reports/*/report.json')]
        self.assertTrue(all(report['cleanup_browser_tmp'] == 'passed' for report in reports))
        self.assertEqual(len(list(self.base.glob('verify-*'))), 2)  # keep-runtime still keeps fixture workspace.

    def test_sigint_cleans_only_owned_short_tmp_even_when_keep(self):
        fake = self.base / 'sleep-python'
        fake.write_text('#!/bin/sh\nexec sleep 30\n')
        fake.chmod(0o700)
        record = self.base / 'short-path'
        code = ('import sys; from pathlib import Path; '
                f'sys.path.insert(0,{str(TOOLS)!r}); import verify; verify.RUNTIME=Path({str(self.base)!r}); '
                'original=verify.create_browser_tmp\n'
                'def capture(workspace):\n'
                '    result=original(workspace)\n'
                f'    Path({str(record)!r}).write_text(str(result))\n'
                '    return result\n'
                'verify.create_browser_tmp=capture\n'
                'sys.exit(verify.main())')
        child = subprocess.Popen([sys.executable, '-c', code, '--profile', 'core', '--keep-runtime', '--python', str(fake)],
                                 stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
        try:
            for _ in range(100):
                if record.exists() and list(self.base.glob('verify-*/logs/fixture.log')):
                    break
                time.sleep(.05)
            else:
                self.fail('Runner did not allocate owned short temporary directory')
            directory = Path(record.read_text())
            self.assertTrue(directory.exists())
            child.send_signal(signal.SIGINT)
            self.assertEqual(child.wait(timeout=10), 130)
            self.assertFalse(directory.exists())
            report = json.loads(next(self.base.glob('reports/*/report.json')).read_text())
            self.assertEqual(report['cleanup_browser_tmp'], 'passed')
            self.assertEqual(report['cleanup_runtime'], 'retained-by-explicit-opt-in')
        finally:
            if child.poll() is None:
                child.send_signal(signal.SIGTERM)
                child.wait(timeout=10)

    def test_nonfinite_timeouts_rejected_before_workspace(self):
        for option in ['--timeout', '--stage-timeout']:
            for value in ['nan', 'inf', '-inf']:
                with self.subTest(option=option, value=value), patch.object(sys, 'argv', ['verify.py', f'{option}={value}']), patch.object(verify, 'create_workspace') as create, contextlib.redirect_stderr(io.StringIO()):
                    with self.assertRaises(SystemExit) as error:
                        verify.main()
                    self.assertEqual(error.exception.code, 2)
                    create.assert_not_called()
        args = argparse.Namespace(timeout=float('nan'), stage_timeout=1)
        with patch.object(verify, 'create_workspace') as create:
            with self.assertRaises(ValueError):
                verify.run(args)
            create.assert_not_called()

    def test_artifact_allowlist_retains_metrics_not_payloads(self):
        workspace = verify.create_workspace(self.base)
        fixture = workspace / 'fixture'
        fixture.mkdir()
        (workspace / 'logs').mkdir()
        secret = 'NEVER_EXPORT_SECRET'
        def write(name, data):
            (fixture / name).write_text(json.dumps(data))
        write('secrets.json', {'password': secret})
        write('browser-states-restore.json', {'original': secret})
        (workspace / 'logs/private.log').write_text(secret)
        (workspace / 'logs/auth-test.log').write_text(secret + '\nAuth session checks passed: 42 (root and /ha basenames)\n')
        write('browser-states.json', {'checks': [
            {'stage': 'six-pages-bilingual-seo-spa', 'status': 'passed', 'payload': secret},
            {'stage': 'restore', 'status': 'failed', 'error': 'TypeError', 'message': secret},
            {'stage': secret, 'status': 'failed', 'error': secret},
        ], 'token': secret})
        write('pass3-browser.json', {'matrix': [{'locale': 'en', 'slug': 'research', 'theme': 'dark', 'width': 390,
              'lang': 'en', 'rootFontSize': '20px', 'h1': 1, 'overflow': False, 'description': secret, 'url': secret}]})
        write('contrast.json', {'results': [{'page': 'research', 'theme': 'teal-amber', 'mode': 'dark', 'url': secret,
              'values': [{'name': 'page heading', 'status': 'measured', 'minimumContrast': 7.25,
                          'foreground': [255, 255, 255], 'worstBackground': [10, 20, 30], 'fontSize': '48px',
                          'fontWeight': '700', 'selector': secret, 'reason': secret}]}],
              'errors': [{'name': 'TimeoutError', 'message': secret}]})
        write('browser-a11y-performance.json', {'checks': ['Real preview initial public JS excludes named admin-only chunks', secret],
              'performance': {'jsRequests': 4, 'jsEncodedBodySize': 12345, 'jsTransferSize': 12567,
                              'observedLcpMs': 125.5, 'observedCls': .002, 'sampledAtMs': float('nan'),
                              'viewport': {'width': 1440, 'height': 1000, 'url': secret},
                              'js': [{'path': secret}], 'media': [{'path': secret}, {'url': secret}]},
              'error': {'name': 'Error', 'message': secret}, 'environment': {'url': secret}})
        report = {'status': 'passed', 'stages': []}
        with patch.object(verify, 'RUNTIME', self.base):
            destination = verify.publish_artifacts(workspace, report)
        files = [p.relative_to(destination).as_posix() for p in destination.rglob('*') if p.is_file()]
        self.assertEqual(files, ['report.json'])
        text = (destination / 'report.json').read_text()
        for forbidden in [secret, 'secrets.json', 'private.log', 'restore.json', 'description', '"selector"', '"payload"', '"message"', '"url"']:
            self.assertNotIn(forbidden, text)
        data = json.loads(text)['results']
        self.assertEqual(data['auth-test']['checkCount'], 42)
        self.assertEqual(data['browser-states']['checks'][1]['error'], 'TypeError')
        self.assertEqual(data['pass3-browser']['matrix'][0]['rootFontSize'], '20px')
        self.assertEqual(data['contrast']['groups'][0]['values'][0]['minimumContrast'], 7.25)
        self.assertEqual(data['contrast']['groups'][0]['values'][0]['foreground'], [255, 255, 255])
        perf = data['browser-a11y-performance']['performance']
        self.assertEqual(perf['jsEncodedBodySize'], 12345)
        self.assertEqual(perf['jsRequests'], 4)
        self.assertEqual(perf['observedLcpMs'], 125.5)
        self.assertEqual(perf['observedCls'], .002)
        self.assertEqual(perf['mediaCount'], 2)
        self.assertNotIn('sampledAtMs', perf)
        self.assertEqual(data['browser-a11y-performance']['checkCount'], 1)

    def test_own_process_group_terminated_not_unrelated(self):
        owned = verify.Processes()
        unrelated = subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(30)'], start_new_session=True)
        self.addCleanup(lambda: unrelated.poll() is None and unrelated.terminate())
        child = owned.start([sys.executable, '-c', 'import time; time.sleep(30)'], cwd=self.base,
                            env=verify.clean_environment(sys.executable), log=self.base / 'owned.log')
        self.assertEqual(os.getpgid(child.pid), child.pid)
        owned.close()
        self.assertIsNotNone(child.poll())
        self.assertIsNone(unrelated.poll())
        unrelated.terminate()
        unrelated.wait(timeout=5)

    def test_failed_runner_exit_and_cleanup(self):
        # Invalid interpreter fails before any fixture/application/service work.
        args = argparse.Namespace(profile='smoke', python=str(self.base / 'missing-python'),
                                  keep_runtime=False, timeout=10, stage_timeout=5, browser_extra=[])
        with patch.object(verify, 'RUNTIME', self.base):
            code = verify.run(args)
        self.assertEqual(code, 1)
        self.assertEqual(list(self.base.glob('verify-*')), [])
        report = json.loads(next(self.base.glob('reports/*/report.json')).read_text())
        self.assertEqual(report['cleanup_runtime'], 'passed')
        self.assertEqual(report['status'], 'failed')

    def test_command_timeout_and_cleanup(self):
        fake_python = self.base / 'sleep-python'
        fake_python.write_text('#!/bin/sh\nexec sleep 30\n')
        fake_python.chmod(0o700)
        args = argparse.Namespace(profile='smoke', python=str(fake_python), keep_runtime=False,
                                  timeout=3, stage_timeout=.1, browser_extra=[])
        with patch.object(verify, 'RUNTIME', self.base):
            code = verify.run(args)
        self.assertEqual(code, 124)
        self.assertEqual(list(self.base.glob('verify-*')), [])

    def test_sigint_exit_and_cleanup(self):
        # Test process owns its workspace; SIGINT never targets the user's servers.
        fake = self.base / 'sleep-python'
        fake.write_text('#!/bin/sh\nexec sleep 30\n')
        fake.chmod(0o700)
        code = ('import sys; from pathlib import Path; '
                f'sys.path.insert(0,{str(TOOLS)!r}); import verify; verify.RUNTIME=Path({str(self.base)!r}); '
                'sys.exit(verify.main())')
        with (self.base / 'signal-test.log').open('w') as log:
            child = subprocess.Popen([sys.executable, '-c', code, '--profile', 'smoke', '--python', str(fake)],
                                     stdout=log, stderr=log, start_new_session=True)
        try:
            for _ in range(100):
                if list(self.base.glob('verify-*/logs/fixture.log')):
                    break
                time.sleep(.05)
            else:
                self.fail('Supervisor did not reach fixture stage: ' + (self.base / 'signal-test.log').read_text())
            child.send_signal(signal.SIGINT)
            self.assertEqual(child.wait(timeout=10), 130)
            self.assertEqual(list(self.base.glob('verify-*')), [])
        finally:
            if child.poll() is None:
                os.killpg(child.pid, signal.SIGKILL)
                child.wait()


if __name__ == '__main__':
    unittest.main(verbosity=2)
