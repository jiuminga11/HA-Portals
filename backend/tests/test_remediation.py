"""Focused HTTP regressions, stdlib only; every run uses a fresh synthetic DB."""
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import unittest
import urllib.error
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts/remediation'))
from init_fixture import backend_python, run_path


class RemediationHTTPTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.name = 'regression-' + uuid.uuid4().hex[:12]
        cls.fixture_env = os.environ.copy()
        if root := os.environ.get('REMEDIATION_TEST_ROOT'):
            test_root = Path(root).absolute()
            runtime_root = ROOT / '.remediation-runtime'
            if (runtime_root.is_symlink() or test_root.resolve() != test_root
                    or not test_root.is_relative_to(runtime_root) or test_root == runtime_root):
                raise ValueError('Unsafe REMEDIATION_TEST_ROOT')
            test_root.mkdir(parents=True, exist_ok=True, mode=0o700)
            if test_root.stat().st_uid != os.getuid():
                raise ValueError('Test root owner mismatch')
            cls.fixture_env['REMEDIATION_FIXTURE_ROOT'] = str(test_root / 'backend')
            cls.runtime = run_path(cls.name, cls.fixture_env['REMEDIATION_FIXTURE_ROOT'])
        else:
            cls.runtime = run_path(cls.name)
        subprocess.run([backend_python(), str(ROOT / 'scripts/remediation/init_fixture.py'), cls.name], check=True, stdout=subprocess.DEVNULL, timeout=30, env=cls.fixture_env)
        cls.server = subprocess.Popen([backend_python(), str(ROOT / 'scripts/remediation/serve.py'), cls.name, '--port', '0'], env=cls.fixture_env)
        cls.addClassCleanup(cls.stop_server)
        for _ in range(100):
            try:
                ready = json.loads((cls.runtime / 'backend-ready.json').read_text())
                cls.base = f'http://127.0.0.1:{ready["port"]}/api'
                with urllib.request.urlopen(cls.base + '/health', timeout=1):
                    break
            except (OSError, urllib.error.URLError):
                time.sleep(.1)
        else:
            raise RuntimeError('Isolated API did not start; inspect runtime backend.log')
        secrets = json.loads((cls.runtime / 'secrets.json').read_text())
        request = urllib.request.Request(cls.base + '/auth/login', data=json.dumps({'username': secrets['ADMIN_USERNAME'], 'password': secrets['ADMIN_PASSWORD']}).encode(), headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(request) as response:
            cls.token = json.load(response)['access_token']
        cls.manifest = json.loads((cls.runtime / 'manifest.json').read_text())

    @classmethod
    def stop_server(cls):
        if cls.server.poll() is None:
            cls.server.terminate()
            try:
                cls.server.wait(timeout=10)
            except subprocess.TimeoutExpired:
                cls.server.kill()
                cls.server.wait(timeout=5)

    def request(self, method, path, body=None, admin=True, expected=200, with_precondition=True):
        # Synthetic fixture setup/cleanup only. Explicit supplied stale/invalid
        # preconditions are preserved; contract tests can disable this helper.
        if method == 'PUT' and admin and with_precondition:
            body = dict(body or {})
            if path.endswith('/reorder') and 'expected_previous_order' not in body:
                rows = self.request('GET', '/admin/pages' if path.startswith('/admin/pages') else '/sections')
                if path == '/sections/reorder':
                    requested = {item['id'] for item in body.get('orders', [])}
                    page = next((row['page_id'] for row in rows if row['id'] in requested), None)
                    rows = [row for row in rows if row['page_id'] == page]
                body['expected_previous_order'] = [row['id'] for row in sorted(rows, key=lambda row: (row['sort_order'], row['id']))]
            elif not path.endswith('/reorder') and 'expected_revision' not in body:
                if path == '/site-config':
                    row = self.request('GET', path)
                else:
                    rows = self.request('GET', '/admin/pages' if path.startswith('/admin/pages/') else '/sections')
                    row = next(row for row in rows if row['id'] == int(path.rsplit('/', 1)[1]))
                body['expected_revision'] = row['revision']
        headers = {'Content-Type': 'application/json'}
        if admin:
            headers['Authorization'] = 'Bearer ' + self.token
        req = urllib.request.Request(self.base + path, method=method, headers=headers, data=json.dumps(body).encode() if body is not None else None)
        try:
            response = urllib.request.urlopen(req, timeout=5)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            self.assertEqual(response.status, expected, f'{method} {path} status mismatch')
            return json.load(response)

    def create(self, page=2):
        result = self.request('POST', '/sections', {'page_id': page, 'title_zh': '测试独立中文', 'title_en': 'Independent English 测试', 'type': 'rich_text', 'content': {'body': '<p>测试正文</p>'}}, expected=201)
        self.addCleanup(self.request, 'DELETE', f'/sections/{result["id"]}')
        return result

    def test_required_preconditions_have_consistent_http_status(self):
        for path, payload, key in [
            ('/sections/1', {'title_zh': 'TEST ONLY'}, 'expected_revision'),
            ('/admin/pages/1', {'title_zh': 'TEST ONLY'}, 'expected_revision'),
            ('/site-config', {'site_title': 'TEST ONLY'}, 'expected_revision'),
            ('/sections/reorder', {'orders': []}, 'expected_previous_order'),
            ('/admin/pages/reorder', {'orders': []}, 'expected_previous_order'),
        ]:
            for condition in [{}, {key: None}, {key: ''}]:
                with self.subTest(path=path, condition=condition):
                    response = self.request('PUT', path, dict(payload, **condition), expected=409, with_precondition=False)
                    self.assertEqual(response['detail'], 'revision_conflict')
            self.request('PUT', path, dict(payload, **{key: 123}), expected=422, with_precondition=False)

    def test_bilingual_title_save_and_reload(self):
        item = self.create()
        endpoint = f'/sections/{item["id"]}'
        self.request('PUT', endpoint, {'title_zh': item['title_zh'], 'title_en': item['title_en']})
        self.request('PUT', endpoint, {'title_zh': '测试只改中文'})
        rows = self.request('GET', '/sections?page_id=2')
        saved = next(row for row in rows if row['id'] == item['id'])
        self.assertEqual(saved['title_en'], item['title_en'])
        saved = self.request('PUT', endpoint, {'title_en': 'Changed English 测试'})
        self.assertEqual(saved['title_zh'], '测试只改中文')

    def test_page_assignment_and_invalid_page(self):
        self.assertEqual(self.create(4)['page_id'], 4)
        payload = {'title_zh': '测试非法页面', 'type': 'rich_text'}
        self.request('POST', '/sections', payload, expected=422)
        self.request('POST', '/sections', dict(payload, page_id=999999), expected=404)

    def test_visibility_and_authentication(self):
        hidden = self.manifest['pages']['test-hidden']
        self.request('GET', '/pages/test-hidden', admin=False, expected=404)
        self.request('GET', '/pages/test-hidden/sections', admin=False, expected=404)
        self.assertEqual(self.request('GET', f'/sections?page_id={hidden}', admin=False), [])
        public = self.request('GET', '/sections', admin=False)
        self.assertNotIn(self.manifest['sections']['hidden-section'], [row['id'] for row in public])
        self.assertTrue(all(row['visible'] for row in public))
        self.assertGreater(len(self.request('GET', '/sections')), len(public))
        for method, path, body in [('GET', '/admin/pages', None), ('POST', '/sections', {'page_id': 2, 'type': 'rich_text', 'title_zh': '测试'}), ('PUT', '/sections/1', {'title_zh': '测试'}), ('DELETE', '/sections/1', None), ('PUT', '/sections/reorder', {'orders': []})]:
            self.request(method, path, body, admin=False, expected=401)

    def test_section_reorder_delete_normalization_and_rejection(self):
        page = self.request('POST', '/admin/pages', {'slug': 'test-sort', 'title_zh': '测试排序'}, expected=201)
        self.addCleanup(self.request, 'DELETE', f'/admin/pages/{page["id"]}')
        ids = []
        for _ in range(3):
            row = self.request('POST', '/sections', {'page_id': page['id'], 'type': 'rich_text', 'title_zh': '测试排序'}, expected=201)
            ids.append(row['id'])
        endpoint = f'/sections?page_id={page["id"]}'
        for order in [ids[::-1], ids[1:] + ids[:1]]:
            self.request('PUT', '/sections/reorder', {'orders': [{'id': id_, 'sort_order': index} for index, id_ in enumerate(order)]})
            rows = self.request('GET', endpoint)
            self.assertEqual([r['id'] for r in rows], order)
            self.assertEqual([r['sort_order'] for r in rows], [0, 1, 2])
        before = self.request('GET', endpoint)
        for orders in [[{'id': ids[0], 'sort_order': -1}], [{'id': 999999, 'sort_order': 0}], [{'id': ids[0], 'sort_order': 0}] * 2]:
            self.request('PUT', '/sections/reorder', {'orders': orders}, expected=400)
            self.assertEqual(self.request('GET', endpoint), before)
        self.request('DELETE', f'/sections/{ids[1]}')
        self.assertEqual([r['sort_order'] for r in self.request('GET', endpoint)], [0, 1])

    def test_page_sort_normalization(self):
        page = self.request('POST', '/admin/pages', {'slug': 'test-page-sort', 'title_zh': '测试页面排序'}, expected=201)
        try:
            rows = self.request('GET', '/admin/pages')
            self.assertEqual([p['sort_order'] for p in rows], list(range(len(rows))))
            self.request('PUT', '/admin/pages/reorder', {'orders': [{'id': p['id'], 'sort_order': i * 7} for i, p in enumerate(reversed(rows))]})
            saved = self.request('GET', '/admin/pages')
            self.assertEqual([p['id'] for p in saved], [p['id'] for p in reversed(rows)])
            self.assertEqual([p['sort_order'] for p in saved], list(range(len(saved))))
        finally:
            self.request('DELETE', f'/admin/pages/{page["id"]}')
        rows = self.request('GET', '/admin/pages')
        self.assertEqual([p['sort_order'] for p in rows], list(range(len(rows))))


if __name__ == '__main__':
    unittest.main(verbosity=2)
