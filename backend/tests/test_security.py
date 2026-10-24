"""Synthetic security regressions; imports never load real settings or lifespan."""
import os
from pathlib import Path
import sys
import tempfile
import time
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]


def resolve_test_runtime(value: str | None = None) -> Path:
    """Runner-owned test directory, confined to the project's runtime tree."""
    base = ROOT / '.remediation-runtime'
    requested = Path(value) if value is not None else base
    if not requested.is_absolute():
        requested = ROOT / requested
    if base.is_symlink() or not requested.resolve().is_relative_to(base.resolve()):
        raise ValueError('Test runtime must remain inside project .remediation-runtime')
    # Reject symlink components even when their current destination is inside.
    for component in (requested, *requested.parents):
        if component.is_symlink():
            raise ValueError('Test runtime must not traverse symlinks')
        if component == ROOT:
            break
    requested.mkdir(parents=True, exist_ok=True)
    return requested.resolve()


RUNTIME = resolve_test_runtime(os.environ.get('REMEDIATION_TEST_ROOT'))
sys.path.insert(0, str(ROOT / 'backend'))
with tempfile.TemporaryDirectory(dir=RUNTIME, prefix='security-import-') as directory:
    previous = Path.cwd()
    try:
        os.chdir(directory)
        with patch.dict(os.environ, ADMIN_USERNAME='TEST ONLY', ADMIN_PASSWORD='test-only-password',
                        JWT_SECRET_KEY='test-only-secret-key', DATABASE_URL='sqlite:///:memory:',
                        UPLOAD_DIR=str(Path(directory) / 'uploads')):
            from app import deps
            from app.config import settings
            from app.database import Base
            from app.models import Page, Section, SiteConfig, UploadedFile
            from app.routers import sections, upload, pages, site_config
            from app.schemas import SectionCreate, SectionUpdate, PageUpdate, SiteConfigUpdate
    finally:
        os.chdir(previous)

from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from jose import jwt


class SecurityTests(unittest.TestCase):
    def test_runtime_directory_is_confined(self):
        with self.assertRaises(ValueError):
            resolve_test_runtime(str(ROOT))
        with tempfile.TemporaryDirectory(dir=RUNTIME, prefix='runtime-bounds-') as directory:
            nested = Path(directory) / 'nested'
            self.assertEqual(resolve_test_runtime(str(nested)), nested)
            link = Path(directory) / 'linked'
            link.symlink_to(nested, target_is_directory=True)
            with self.assertRaises(ValueError):
                resolve_test_runtime(str(link / 'child'))

    def test_encoded_and_nested_active_html(self):
        samples = ["<a href='jav&#x61;script:alert(1)'>test</a>",
                   '<iframe srcdoc="&lt;script&gt;alert(1)&lt;/script&gt;"></iframe>',
                   '<svg><foreignObject><script>alert(1)</script></foreignObject></svg>',
                   '<math><mtext><img src=x onerror=alert(1)></mtext></math>',
                   '<a href="java&#10;script:alert(1)">test</a>']
        for html in samples:
            with self.subTest(html=html):
                result = sections._validate_and_sanitize('rich_text', {'body': html})['body']
                from html import unescape
                result = unescape(result)
                for active in ['javascript:', 'srcdoc', '<iframe', '<svg', '<math', '<script', 'onerror']:
                    self.assertNotIn(active, result.lower())

    def test_legal_content_is_preserved(self):
        html = ('<h2 id="anchor">Test</h2><p class="ql-align-center" style="color: red; text-align: center">'
                '<strong>bold</strong><em>italic</em><u>underline</u><s>strike</s></p>'
                '<ul><li>item</li></ul><blockquote>quote</blockquote><pre><code>code</code></pre>'
                '<table><tbody><tr><th>head</th><td>cell</td></tr></tbody></table>'
                '<a href="#anchor">anchor</a><a href="mailto:test@example.invalid">mail</a>'
                '<a name="legacy-anchor">named anchor</a>'
                '<img src="/uploads/test.png" alt="TEST ONLY">')
        result = sections._validate_and_sanitize('rich_text', {'body': html})['body']
        for fragment in ['id="anchor"', 'href="#anchor"', 'mailto:', '/uploads/test.png',
                         'name="legacy-anchor"', 'ql-align-center', 'color:', 'text-align:', '<table>', '<strong>', '<u>', '<s>']:
            self.assertIn(fragment, result)

    def test_structured_urls(self):
        for url in ['javascript:alert(1)', 'jav&#x61;script:alert(1)', 'java\nscript:alert(1)', 'data:text/html,test']:
            with self.subTest(url=url), self.assertRaises(HTTPException):
                sections._validate_and_sanitize('external_links', {'items': [{'title': 'TEST', 'url': url}]})
        for url in ['https://example.invalid', 'mailto:test@example.invalid', 'tel:123', '#anchor', '/uploads/test.pdf']:
            sections._validate_and_sanitize('external_links', {'items': [{'title': 'TEST', 'url': url}]})
        with self.assertRaises(HTTPException):
            sections._validate_and_sanitize('image_gallery', {'items': [{'url': 'mailto:test@example.invalid'}]})

    def test_jwt_claims(self):
        valid = {'sub': settings.ADMIN_USERNAME, 'exp': time.time() + 600}
        invalid = [{}, {'sub': settings.ADMIN_USERNAME}, {'exp': time.time() + 600},
                   dict(valid, sub='not-admin'), dict(valid, exp=None), dict(valid, exp=True),
                   dict(valid, exp='9999999999'), dict(valid, exp=float('inf')), dict(valid, exp=0)]
        for payload in invalid:
            credentials = HTTPAuthorizationCredentials(scheme='Bearer', credentials=jwt.encode(
                payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM))
            for authenticate in [deps.get_current_admin, deps.get_optional_admin]:
                with self.subTest(payload=payload, auth=authenticate.__name__):
                    with self.assertRaises(HTTPException) as error:
                        authenticate(credentials)
                    self.assertEqual(error.exception.status_code, 401)
        credentials = HTTPAuthorizationCredentials(scheme='Bearer', credentials=jwt.encode(
            valid, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM))
        self.assertTrue(deps.get_current_admin(credentials))
        self.assertFalse(deps.get_optional_admin(None))

    def test_style_and_media_policy(self):
        html = ('<p style="position:fixed;background-image:url(https://example.invalid);color:red" '
                'class="evil ql-align-center">TEST ONLY</p>'
                '<img src="data:image/svg+xml,test"><img src="blob:test">'
                '<a href="tel:123">telephone</a><a href="https://example.invalid">web</a>')
        result = sections._validate_and_sanitize('rich_text', {'body': html})['body']
        for forbidden in ['position', 'background-image', 'data:', 'blob:', 'evil']:
            self.assertNotIn(forbidden, result)
        self.assertIn('color:', result)
        self.assertIn('tel:123', result)

    def test_jwt_wrong_signature_and_unexpected_algorithm(self):
        payload = {'sub': settings.ADMIN_USERNAME, 'exp': time.time() + 600}
        for key, algorithm in [('TEST ONLY wrong signing key', settings.JWT_ALGORITHM),
                               (settings.JWT_SECRET_KEY, 'HS512')]:
            credentials = HTTPAuthorizationCredentials(scheme='Bearer', credentials=jwt.encode(
                payload, key, algorithm=algorithm))
            for authenticate in [deps.get_current_admin, deps.get_optional_admin]:
                with self.subTest(algorithm=algorithm, auth=authenticate.__name__):
                    with self.assertRaises(HTTPException) as error:
                        authenticate(credentials)
                    self.assertEqual(error.exception.status_code, 401)
