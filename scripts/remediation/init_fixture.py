"""Create only synthetic fixtures in a new, project-local isolated run directory."""
import argparse
import json
import os
from pathlib import Path
import secrets
import struct
import sys
import zlib

ROOT = Path(__file__).resolve().parents[2]
RUNTIME = ROOT / '.remediation-runtime'


def run_path(name):
    if not name or any(c not in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_' for c in name):
        raise ValueError('Run name must contain only letters, digits, - and _')
    path = RUNTIME / name
    if path.resolve().parent != RUNTIME.resolve() or path.is_symlink():
        raise ValueError('Unsafe runtime path')
    return path


def environment(path):
    env = os.environ.copy()
    env.update(json.loads((path / 'secrets.json').read_text()))
    env.update(DATABASE_URL=f'sqlite:///{path / "fixture.db"}', UPLOAD_DIR=str(path / 'uploads'),
               PYTHONPATH=str(ROOT / 'backend'), JWT_ALGORITHM='HS256', JWT_EXPIRE_MINUTES='60',
               CORS_ORIGINS='["http://127.0.0.1:15174"]', PYTHONDONTWRITEBYTECODE='1')
    return env


def png(path, width, height, color):
    def chunk(kind, data):
        return struct.pack('!I', len(data)) + kind + data + struct.pack('!I', zlib.crc32(kind + data))
    raw = b''.join(b'\x00' + bytes(color) * width for _ in range(height))
    path.write_bytes(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('!2I5B', width, height, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b''))


def initialize(name):
    path = run_path(name)
    path.mkdir(parents=True, exist_ok=False, mode=0o700)
    (path / 'uploads').mkdir()
    (path / 'screenshots').mkdir()
    secret = path / 'secrets.json'
    with open(secret, 'x', opener=lambda p, f: os.open(p, f, 0o600)) as stream:
        json.dump({'ADMIN_USERNAME': 'remediation-test', 'ADMIN_PASSWORD': secrets.token_urlsafe(32),
                   'JWT_SECRET_KEY': secrets.token_urlsafe(48)}, stream)
    os.environ.update(environment(path))
    os.chdir(path)  # Never load backend/.env or write backend/data.
    sys.path.insert(0, str(ROOT / 'backend'))
    from app.database import Base, SessionLocal, engine
    from app.models import Page, Section, SiteConfig, UploadedFile
    from app.content_schemas import validate_content
    Base.metadata.create_all(engine)
    png(path / 'uploads/test-avatar.png', 240, 320, (30, 140, 150))
    png(path / 'uploads/test-gallery.png', 640, 360, (190, 100, 45))
    (path / 'uploads/test-download.txt').write_text('测试文件 / TEST FIXTURE ONLY. Not a CV. No personal facts.\n')
    manifest = {'pages': {}, 'sections': {}, 'run': name}
    with SessionLocal() as db:
        db.add(SiteConfig(id=1, site_title='测试站点', project_title='测试项目标题', footer_text='测试页脚',
                          seo_default_title_zh='测试站点标题', seo_default_title_en='Test site title 测试',
                          seo_default_description_zh='测试站点描述', seo_default_description_en='Test description 测试'))
        slugs = ['home', 'about', 'research', 'projects', 'honors', 'cv', 'test-hidden']
        for index, slug in enumerate(slugs):
            page = Page(slug=slug, title_zh=f'测试页面 {slug}', title_en=f'Test page {slug} 测试',
                        meta_description_zh=f'测试描述 {slug}', meta_description_en=f'Test metadata {slug} 测试',
                        visible=slug != 'test-hidden', sort_order=index)
            db.add(page)
            db.flush()
            manifest['pages'][slug] = page.id
        counts = {}
        def section(slug, key, kind, content, visible=True):
            order = counts.get(slug, 0)
            counts[slug] = order + 1
            record = Section(page_id=manifest['pages'][slug], title_zh=f'测试中文 {key}',
                             title_en=f'English test {key} 测试', type=kind, visible=visible, sort_order=order,
                             content=json.dumps(validate_content(kind, content), ensure_ascii=False))
            db.add(record)
            db.flush()
            manifest['sections'][key] = record.id
        email = 'test.' + 'long-address-' * 7 + '@example.invalid'
        section('home', 'hero', 'profile_hero', {'avatar_url': '/uploads/test-avatar.png', 'avatar_position': '35% 25%',
                'name_zh': '测试人物（非真实身份）', 'name_en': 'Test persona 测试', 'tagline_zh': '测试身份',
                'tagline_en': 'Test role 测试', 'mission_zh': '测试研究问题，不代表成果', 'mission_en': 'Test question only 测试',
                'social_links': [{'platform': 'email', 'url': f'mailto:{email}', 'label': email}],
                'cta_buttons': [{'label_zh': '测试查看页面', 'label_en': 'Test page 测试', 'url': '/cv'}]})
        for slug in slugs:
            section(slug, f'{slug}-body', 'rich_text', {'body': f'<p>测试内容 {slug}：仅用于隔离验证，不含个人事实。</p>'})
        section('home', 'hidden-section', 'rich_text', {'body': '<p>测试隐藏区块</p>'}, False)
        section('about', 'timeline', 'timeline', {'items': [{'date_start': '2020', 'date_end': '2021',
                'title_zh': '测试时间线', 'title_en': 'Test timeline 测试', 'description_zh': '测试事件，非个人经历'}]})
        for slug in ['research', 'projects', 'honors']:
            section(slug, f'{slug}-table', 'data_table', {'columns': [{'key': 'name', 'title': '测试名称'}, {'key': 'detail', 'title': '测试完整说明'}],
                    'rows': [{'name': '测试长名称' * 10, 'detail': '测试长内容完整阅读与换行，不代表真实成果。' * 12}]})
        section('research', 'metrics', 'metric_cards', {'cards': [{'label_zh': '测试指标（合成）', 'label_en': 'Test metric 测试', 'value': '42', 'detail_zh': '仅测试样本，不代表研究结果'}]})
        section('projects', 'gallery', 'image_gallery', {'columns': 2, 'items': [{'url': '/uploads/test-gallery.png', 'caption': '测试生成色块图'}]})
        section('cv', 'long-email', 'rich_text', {'body': f'<p>测试联系邮箱：<a href="mailto:{email}">{email}</a></p><p>测试页面，无正式简历文件。</p>'})
        section('cv', 'test-file', 'external_links', {'items': [{'title': '测试文本文件（不是简历）', 'url': '/uploads/test-download.txt'}]})
        for file in sorted((path / 'uploads').iterdir()):
            db.add(UploadedFile(filename=file.name, stored_name=file.name, file_path=str(file), file_url=f'/uploads/{file.name}',
                                file_size=file.stat().st_size, mime_type='image/png' if file.suffix == '.png' else 'text/plain'))
        db.commit()
    (path / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
    print(f'Created synthetic fixture: {path}; manifest.json contains public IDs only')
    return path


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('name')
    initialize(parser.parse_args().name)
