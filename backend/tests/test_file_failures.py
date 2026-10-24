import asyncio
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import test_security as fixture
from fastapi import HTTPException, UploadFile
from sqlalchemy import create_engine, event
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from starlette.datastructures import Headers


class FileFailureTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(dir=fixture.RUNTIME, prefix='file-fault-')
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.engine = create_engine(f'sqlite:///{self.root / "test.db"}')
        self.addCleanup(self.engine.dispose)
        fixture.Base.metadata.create_all(self.engine)
        self.db = Session(self.engine, autoflush=False)
        self.addCleanup(self.db.close)
        self.uploads = self.root / 'uploads'
        self.uploads.mkdir()
        self.config = patch.object(fixture.settings, 'UPLOAD_DIR', str(self.uploads))
        self.config.start()
        self.addCleanup(self.config.stop)

    def send(self, content=b'%PDF-1.4\nTEST ONLY\n%%EOF', source=None):
        file = source or UploadFile(io.BytesIO(content), filename='TEST-ONLY.pdf',
                                  headers=Headers({'content-type': 'application/pdf'}))
        return asyncio.run(fixture.upload.upload_file(file, self.db, True))

    def test_upload_commit_failure_cleans_file_and_rolls_back(self):
        with patch.object(self.db, 'commit', side_effect=SQLAlchemyError('test failure')):
            with self.assertRaises(HTTPException):
                self.send()
        self.assertEqual(list(self.uploads.iterdir()), [])
        self.assertEqual(self.db.query(fixture.UploadedFile).count(), 0)

    def test_uuid_collision_does_not_remove_existing_file(self):
        existing = self.uploads / 'TEST-COLLISION.pdf'
        content = b'%PDF-1.4 EXISTING TEST ONLY'
        existing.write_bytes(content)
        with patch('app.routers.upload.uuid.uuid4', return_value='TEST-COLLISION'):
            with self.assertRaises(HTTPException) as error:
                self.send()
        self.assertEqual(error.exception.status_code, 503)
        self.assertEqual(existing.read_bytes(), content)
        self.assertEqual(self.db.query(fixture.UploadedFile).count(), 0)

    def test_upload_commit_then_error_preserves_committed_file(self):
        def fail_after_commit(session):
            raise SQLAlchemyError('TEST ONLY durable commit then error')
        event.listen(self.db, 'after_commit', fail_after_commit)
        try:
            with self.assertRaises(HTTPException) as error:
                self.send()
            self.assertEqual(error.exception.status_code, 503)
        finally:
            event.remove(self.db, 'after_commit', fail_after_commit)
        with Session(self.engine) as db:
            record = db.query(fixture.UploadedFile).one()
            self.assertTrue(Path(record.file_path).is_file())

    def test_upload_unknown_commit_outcome_preserves_file(self):
        with patch.object(self.db, 'commit', side_effect=SQLAlchemyError('TEST ONLY commit error')), \
             patch('app.routers.upload.Session', side_effect=SQLAlchemyError('TEST ONLY cannot verify')):
            with self.assertRaises(HTTPException) as error:
                self.send()
        self.assertEqual(error.exception.status_code, 503)
        self.assertEqual(len(list(self.uploads.iterdir())), 1)
        self.assertEqual(self.db.query(fixture.UploadedFile).count(), 0)

    def test_interrupted_disk_write_is_cleaned(self):
        real_open = open
        class BrokenDestination:
            def __init__(self, *args, **kwargs):
                self.file = real_open(*args, **kwargs)
            def __enter__(self):
                return self
            def __exit__(self, *args):
                self.file.close()
            def write(self, data):
                self.file.write(data[:2])
                raise OSError('TEST ONLY interrupted write')
        with patch('app.routers.upload.open', BrokenDestination):
            with self.assertRaises(HTTPException) as error:
                self.send()
        self.assertEqual(error.exception.status_code, 503)
        self.assertEqual(list(self.uploads.iterdir()), [])
        self.assertEqual(self.db.query(fixture.UploadedFile).count(), 0)

    def test_delete_disk_failure_preserves_record_and_file(self):
        result = self.send()
        with patch.object(Path, 'replace', side_effect=OSError('TEST ONLY disk failure')):
            with self.assertRaises(HTTPException) as error:
                fixture.upload.delete_file(result.id, self.db, True)
        self.assertEqual(error.exception.status_code, 503)
        self.assertTrue(Path(self.db.get(fixture.UploadedFile, result.id).file_path).exists())

    def test_refresh_failure_does_not_delete_committed_file(self):
        with patch.object(self.db, 'refresh', side_effect=SQLAlchemyError('test failure')):
            with self.assertRaises((SQLAlchemyError, HTTPException)):
                self.send()
        with Session(self.engine) as db:
            record = db.query(fixture.UploadedFile).one()
            self.assertTrue(Path(record.file_path).exists())

    def test_delete_commit_failure_restores_file(self):
        result = self.send()
        with patch.object(self.db, 'commit', side_effect=SQLAlchemyError('test failure')):
            with self.assertRaises(HTTPException):
                fixture.upload.delete_file(result.id, self.db, True)
        record = self.db.get(fixture.UploadedFile, result.id)
        self.assertIsNotNone(record)
        self.assertTrue(Path(record.file_path).exists())

    def test_delete_commit_then_error_does_not_restore_orphan(self):
        result = self.send()
        path = Path(self.db.get(fixture.UploadedFile, result.id).file_path)
        def fail_after_commit(session):
            raise SQLAlchemyError('TEST ONLY durable deletion then error')
        event.listen(self.db, 'after_commit', fail_after_commit)
        try:
            with self.assertRaises(HTTPException) as error:
                fixture.upload.delete_file(result.id, self.db, True)
            self.assertEqual(error.exception.status_code, 503)
        finally:
            event.remove(self.db, 'after_commit', fail_after_commit)
        with Session(self.engine) as db:
            self.assertIsNone(db.get(fixture.UploadedFile, result.id))
        self.assertFalse(path.exists())
        self.assertEqual(list((self.uploads / '.pending-delete').iterdir()), [])

    def test_delete_unknown_outcome_preserves_file(self):
        result = self.send()
        path = Path(self.db.get(fixture.UploadedFile, result.id).file_path)
        with patch.object(self.db, 'commit', side_effect=SQLAlchemyError('TEST ONLY commit error')), \
             patch('app.routers.upload.Session', side_effect=SQLAlchemyError('TEST ONLY cannot verify')):
            with self.assertRaises(HTTPException) as error:
                fixture.upload.delete_file(result.id, self.db, True)
        self.assertEqual(error.exception.status_code, 503)
        self.assertTrue(path.is_file())
        self.assertIsNotNone(self.db.get(fixture.UploadedFile, result.id))

    def test_bounded_reads_stop_after_limit(self):
        class Spy:
            filename = 'TEST-ONLY.pdf'
            content_type = 'application/pdf'
            sizes = []
            async def read(self, size=-1):
                self.sizes.append(size)
                if size < 0:
                    return b'x' * 33
                return b'x' * size
        spy = Spy()
        with patch.object(fixture.settings, 'MAX_FILE_SIZE', 32):
            with self.assertRaises(HTTPException) as error:
                self.send(source=spy)
        self.assertEqual(error.exception.status_code, 413)
        self.assertTrue(all(0 < size <= 33 for size in spy.sizes))
        self.assertEqual(list(self.uploads.iterdir()), [])

    def test_query_and_entity_references(self):
        result = self.send()
        self.db.add(fixture.SiteConfig(id=1, seo_og_image=result.file_url + '?v=1'))
        self.db.commit()
        self.assertTrue(fixture.upload._is_file_referenced(result.file_url, self.db))
        self.db.query(fixture.SiteConfig).delete()
        self.db.add(fixture.Page(id=1, slug='test', title_zh='TEST ONLY'))
        self.db.flush()
        encoded = result.file_url.replace('/uploads/', '/uploads&#47;') + '?a=1&amp;b=2'
        self.db.add(fixture.Section(page_id=1, title_zh='TEST ONLY', type='rich_text',
                                   content=json.dumps({'body': f'<img src="{encoded}">'})))
        self.db.commit()
        self.assertTrue(fixture.upload._is_file_referenced(result.file_url, self.db))

    def test_absolute_query_and_encoded_references_block_deletion(self):
        result = self.send()
        name = result.file_url.split('/')[-1]
        self.db.add(fixture.SiteConfig(id=1, seo_og_image=f'https://example.invalid/ha/uploads%2F{name}?v=1'))
        self.db.commit()
        with self.assertRaises(HTTPException) as error:
            fixture.upload.delete_file(result.id, self.db, True)
        self.assertEqual(error.exception.status_code, 409)
        self.db.rollback()
        self.db.query(fixture.SiteConfig).delete()
        self.db.add(fixture.Page(id=1, slug='test-absolute', title_zh='TEST ONLY'))
        self.db.flush()
        self.db.add(fixture.Section(page_id=1, title_zh='TEST ONLY', type='rich_text', content=json.dumps({
            'body': f'<a href="https://different.invalid/ha/uploads&#47;{name}?a=1&amp;b=2">TEST ONLY</a>'})))
        self.db.commit()
        with self.assertRaises(HTTPException) as error:
            fixture.upload.delete_file(result.id, self.db, True)
        self.assertEqual(error.exception.status_code, 409)
        self.assertTrue(Path(self.db.get(fixture.UploadedFile, result.id).file_path).is_file())
        from app.file_references import validate_local_references
        validate_local_references({'url': 'https://remote.invalid/uploads/remote-only.pdf'})
