"""Site contracts against the existing project-local isolated HTTP harness."""
import json
import sqlite3
import unittest
import urllib.error
import urllib.request

import test_remediation as harness


def test_only_pdf():
    """One-page PDF with explicit TEST ONLY text, constructed without dependencies."""
    stream = b'BT /F1 18 Tf 40 100 Td (TEST ONLY - NOT A CV) Tj ET'
    objects = [
        b'<< /Type /Catalog /Pages 2 0 R >>',
        b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
        b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
        b'<< /Length ' + str(len(stream)).encode() + b' >>\nstream\n' + stream + b'\nendstream',
    ]
    result = b'%PDF-1.4\n% TEST ONLY\n'
    offsets = [0]
    for index, obj in enumerate(objects, 1):
        offsets.append(len(result))
        result += f'{index} 0 obj\n'.encode() + obj + b'\nendobj\n'
    xref = len(result)
    result += b'xref\n0 6\n0000000000 65535 f \n'
    result += b''.join(f'{offset:010d} 00000 n \n'.encode() for offset in offsets[1:])
    return result + f'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n'.encode()


class SiteContractTests(unittest.TestCase):
    setUpClass = classmethod(harness.RemediationHTTPTests.setUpClass.__func__)
    stop_server = classmethod(harness.RemediationHTTPTests.stop_server.__func__)
    request = harness.RemediationHTTPTests.request

    def upload(self, name, mime, content, expected=200):
        boundary = 'TEST-ONLY-UPLOAD-BOUNDARY'
        data = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{name}"\r\n'
                f'Content-Type: {mime}\r\n\r\n').encode() + content + f'\r\n--{boundary}--\r\n'.encode()
        req = urllib.request.Request(self.base + '/upload', data=data, headers={
            'Content-Type': f'multipart/form-data; boundary={boundary}',
            'Authorization': 'Bearer ' + self.token,
        })
        try:
            response = urllib.request.urlopen(req, timeout=5)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            self.assertEqual(response.status, expected)
            return json.load(response)

    def delete_upload(self, file_id):
        req = urllib.request.Request(self.base + f'/files/{file_id}', method='DELETE',
                                     headers={'Authorization': 'Bearer ' + self.token})
        with urllib.request.urlopen(req, timeout=5) as response:
            self.assertEqual(response.status, 204)

    def test_home_protection_and_editing(self):
        home = self.manifest['pages']['home']
        endpoint = f'/admin/pages/{home}'
        before = self.request('GET', '/pages/home', admin=False)
        for body in [{'visible': False}, {'slug': 'not-home'}, {'slug': None},
                     {'title_zh': 'Must not persist', 'visible': False}]:
            self.request('PUT', endpoint, body, expected=400)
            self.assertEqual(self.request('GET', '/pages/home', admin=False), before)
        self.request('DELETE', endpoint, expected=400)
        self.request('PUT', endpoint, {'slug': 'home', 'title_zh': 'TEST ONLY home',
                                     'meta_description_en': 'TEST ONLY description'})
        self.assertEqual(self.request('GET', '/pages/home')['meta_description_en'], 'TEST ONLY description')
        public = self.request('GET', '/pages/home/sections', admin=False)
        self.assertNotIn(self.manifest['sections']['hidden-section'], [s['id'] for s in public])

    def test_hidden_or_missing_home_is_not_repaired(self):
        home = self.manifest['pages']['home']
        try:
            with sqlite3.connect(self.runtime / 'fixture.db') as db:
                db.execute('UPDATE page SET visible=0 WHERE id=?', (home,))
            self.request('GET', '/pages/home', admin=False, expected=404)
            self.request('PUT', f'/admin/pages/{home}', {'title_en': 'TEST ONLY hidden home'})
            self.request('GET', '/pages/home/sections', admin=False, expected=404)
            with sqlite3.connect(self.runtime / 'fixture.db') as db:
                self.assertEqual(db.execute('SELECT visible FROM page WHERE id=?', (home,)).fetchone()[0], 0)
                db.execute("UPDATE page SET slug='test-home-absent' WHERE id=?", (home,))
            self.request('GET', '/pages/home', admin=False, expected=404)
            self.request('POST', '/admin/pages', {'slug': 'home', 'title_zh': 'TEST ONLY', 'visible': False}, expected=400)
            self.assertNotIn('home', [p['slug'] for p in self.request('GET', '/admin/pages')])
            temporary = self.request('POST', '/admin/pages', {
                'slug': 'test-only-hidden-rename', 'title_zh': 'TEST ONLY',
                'visible': False,
            }, expected=201)
            endpoint = f'/admin/pages/{temporary["id"]}'
            try:
                before = self.request('GET', '/admin/pages')
                for payload in [
                    {'slug': 'home', 'title_zh': 'Must not persist'},
                    {'slug': 'home', 'visible': False},
                ]:
                    self.request('PUT', endpoint, payload, expected=400)
                    self.assertEqual(self.request('GET', '/admin/pages'), before)
                self.request('PUT', endpoint, {'visible': True})
                before = self.request('GET', '/admin/pages')
                self.request('PUT', endpoint, {'slug': 'home', 'visible': False}, expected=400)
                self.assertEqual(self.request('GET', '/admin/pages'), before)
                self.request('PUT', endpoint, {'visible': False})
                renamed = self.request('PUT', endpoint, {'slug': 'home', 'visible': True})
                self.assertTrue(renamed['visible'])
            finally:
                # Restore only this synthetic fixture so protected home can be cleaned up.
                with sqlite3.connect(self.runtime / 'fixture.db') as db:
                    db.execute("UPDATE page SET slug='test-only-hidden-rename' WHERE id=?", (temporary['id'],))
                self.request('DELETE', endpoint)
        finally:
            with sqlite3.connect(self.runtime / 'fixture.db') as db:
                db.execute("UPDATE page SET slug='home', visible=1 WHERE id=?", (home,))

    def test_other_page_mutations_and_sparse_sort_remain_supported(self):
        page = self.request('POST', '/admin/pages', {'slug': 'test-only-site', 'title_zh': 'TEST ONLY'}, expected=201)
        self.request('PUT', f'/admin/pages/{page["id"]}', {'slug': 'test-only-renamed', 'visible': False})
        rows = self.request('GET', '/admin/pages')
        saved = self.request('PUT', '/admin/pages/reorder', {'orders': [
            {'id': p['id'], 'sort_order': i * 7} for i, p in enumerate(reversed(rows))]})
        self.assertEqual([p['id'] for p in saved], [p['id'] for p in reversed(rows)])
        self.assertEqual([p['sort_order'] for p in saved], list(range(len(rows))))
        self.request('DELETE', f'/admin/pages/{page["id"]}')

    def test_pdf_upload_and_unreferenced_delete(self):
        content = test_only_pdf()
        result = self.upload('TEST-ONLY-NOT-A-CV.PDF', 'application/pdf', content)
        path = self.runtime / 'uploads' / result['file_url'].split('/')[-1]
        self.assertEqual(path.read_bytes(), content)
        self.delete_upload(result['id'])
        self.assertFalse(path.exists())
        self.assertNotIn(result['id'], [f['id'] for f in self.request('GET', '/files')])

    def test_invalid_pdf_and_mime_extension_mismatch_do_not_write(self):
        before = {p.name for p in (self.runtime / 'uploads').iterdir()}
        records = self.request('GET', '/files')
        for name, mime, content in [
            ('test.pdf', 'application/pdf', b'TEST ONLY not a PDF'),
            ('test.pdf', 'application/pdf', b''),
            ('test.png', 'application/pdf', test_only_pdf()),
            ('test.pdf', 'image/png', test_only_pdf()),
            ('test.mp4', 'image/png', b'TEST ONLY'),
            ('test.pdf', 'application/octet-stream', test_only_pdf()),
        ]:
            with self.subTest(name=name, mime=mime):
                self.upload(name, mime, content, expected=415)
        self.assertEqual({p.name for p in (self.runtime / 'uploads').iterdir()}, before)
        self.assertEqual(self.request('GET', '/files'), records)

    def test_references_block_deletion(self):
        result = self.upload('TEST-ONLY.pdf', 'application/pdf', test_only_pdf())
        path = self.runtime / 'uploads' / result['file_url'].split('/')[-1]
        for field in ['logo_url', 'banner_url', 'seo_og_image']:
            with self.subTest(field=field):
                self.request('PUT', '/site-config', {field: result['file_url']})
                try:
                    self.request('DELETE', f'/files/{result["id"]}', expected=409)
                    self.assertTrue(path.exists())
                    self.assertIn(result['id'], [f['id'] for f in self.request('GET', '/files')])
                finally:
                    self.request('PUT', '/site-config', {field: None})
        section = self.request('POST', '/sections', {'page_id': self.manifest['pages']['home'],
            'title_zh': 'TEST ONLY reference', 'type': 'rich_text', 'visible': False,
            'content': {'body': f'<a href="{result["file_url"]}">TEST ONLY</a>'}}, expected=201)
        try:
            self.request('DELETE', f'/files/{result["id"]}', expected=409)
            self.assertTrue(path.exists())
        finally:
            self.request('DELETE', f'/sections/{section["id"]}')
        self.delete_upload(result['id'])

    def test_existing_image_and_video_uploads(self):
        png = (self.runtime / 'uploads/test-avatar.png').read_bytes()
        # Synthetic container header tests the existing MP4 upload path, not playback.
        for name, mime, content in [('TEST-ONLY.png', 'image/png', png),
                                    ('TEST-ONLY.mp4', 'video/mp4', b'\x00\x00\x00\x18ftypmp42TEST ONLY')]:
            result = self.upload(name, mime, content)
            self.delete_upload(result['id'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
