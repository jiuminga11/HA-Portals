"""Separate sessions simulate independent editors, using only synthetic SQLite."""
import tempfile
import unittest
import multiprocessing
import time
from pathlib import Path

import test_security as fixture
from fastapi import HTTPException
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session


def reference_writer(database, uploads, ready):
    fixture.settings.UPLOAD_DIR = uploads
    engine = create_engine(database)
    with Session(engine, autoflush=False) as db:
        def before_commit(session):
            ready.set()
            time.sleep(0.3)
        event.listen(db, 'before_commit', before_commit)
        fixture.sections.update_section(1, fixture.SectionUpdate(
            content={'body': '<a href="/uploads/TEST-ONLY.pdf?v=1&amp;x=2">TEST ONLY</a>'}), db, True)
    engine.dispose()


def slug_writer(database, start, results):
    engine = create_engine(database)
    start.wait(10)
    with Session(engine, autoflush=False) as db:
        try:
            fixture.pages.create_page(fixture.pages.PageCreate(slug='same-slug', title_zh='TEST ONLY'), db, True)
            results.put(201)
        except HTTPException as exc:
            results.put(exc.status_code)
    engine.dispose()


class ConcurrencyTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(dir=fixture.RUNTIME, prefix='cas-')
        self.addCleanup(self.directory.cleanup)
        self.engine = create_engine(f'sqlite:///{Path(self.directory.name) / "test.db"}')
        self.addCleanup(self.engine.dispose)
        fixture.Base.metadata.create_all(self.engine)
        with Session(self.engine) as db:
            db.add(fixture.Page(id=1, slug='test', title_zh='TEST ONLY'))
            db.add(fixture.SiteConfig(id=1))
            db.flush()
            db.add(fixture.Section(id=1, page_id=1, type='rich_text', title_zh='TEST ONLY', content='{"body":""}'))
            db.commit()

    def test_stale_edit_rejected_for_each_resource(self):
        cases = [
            (fixture.Page, fixture.PageUpdate, fixture.pages.update_page, 'title_zh'),
            (fixture.Section, fixture.SectionUpdate, fixture.sections.update_section, 'title_zh'),
            (fixture.SiteConfig, fixture.SiteConfigUpdate, fixture.site_config.update_site_config, 'site_title'),
        ]
        for model, schema, update, field in cases:
            with self.subTest(model=model.__name__), Session(self.engine, autoflush=False) as first, Session(self.engine, autoflush=False) as second:
                row = first.get(model, 1)
                if model is fixture.Section:
                    response = fixture.sections._section_to_response(row)
                elif model is fixture.Page:
                    response = fixture.pages.PageResponse.model_validate(row)
                else:
                    response = fixture.site_config.SiteConfigResponse.model_validate(row)
                revision = getattr(response, 'revision', 'baseline-no-revision')
                stale = schema(**{field: 'second', 'expected_revision': revision})
                current = schema(**{field: 'first', 'expected_revision': revision})
                if model is fixture.SiteConfig:
                    update(current, first, True)
                else:
                    update(1, current, first, True)
                with self.assertRaises(HTTPException) as error:
                    if model is fixture.SiteConfig:
                        update(stale, second, True)
                    else:
                        update(1, stale, second, True)
                self.assertEqual(error.exception.status_code, 409)
                second.rollback()
                self.assertEqual(getattr(second.get(model, 1), field), 'first')

    def test_atomic_cas_rejects_change_after_snapshot(self):
        from app.revisions import snapshot, revision, commit_edit
        with Session(self.engine, autoflush=False) as first, Session(self.engine, autoflush=False) as second:
            row = first.get(fixture.Page, 1)
            original = snapshot(row)
            fixture.pages.update_page(1, fixture.PageUpdate(title_zh='winner'), second, True)
            row.title_zh = 'must not overwrite'
            with self.assertRaises(HTTPException) as error:
                commit_edit(first, row, original, revision(original))
            self.assertEqual(error.exception.status_code, 409)
            self.assertEqual(first.get(fixture.Page, 1).title_zh, 'winner')

    def test_legacy_unconditional_update_remains_supported(self):
        with Session(self.engine, autoflush=False) as db:
            fixture.pages.update_page(1, fixture.PageUpdate(title_zh='legacy'), db, True)
            self.assertEqual(db.get(fixture.Page, 1).title_zh, 'legacy')

    def test_public_section_revision_can_conditionally_update(self):
        with Session(self.engine, autoflush=False) as reader:
            public = fixture.pages.get_page_sections('test', reader)[0]
            admin = fixture.sections._section_to_response(reader.get(fixture.Section, 1))
            self.assertTrue(public.revision)
            self.assertEqual(public.revision, admin.revision)
        with Session(self.engine, autoflush=False) as writer:
            saved = fixture.sections.update_section(1, fixture.SectionUpdate(
                title_zh='TEST ONLY public revision save', expected_revision=public.revision), writer, True)
            self.assertNotEqual(saved.revision, public.revision)
        with Session(self.engine, autoflush=False) as stale_writer:
            with self.assertRaises(HTTPException) as error:
                fixture.sections.update_section(1, fixture.SectionUpdate(
                    title_zh='must not overwrite', expected_revision=public.revision), stale_writer, True)
            self.assertEqual(error.exception.status_code, 409)

    def test_cross_process_reference_write_blocks_delete(self):
        root = Path(self.directory.name)
        uploads = root / 'uploads'
        uploads.mkdir()
        path = uploads / 'TEST-ONLY.pdf'
        path.write_bytes(b'%PDF-1.4 TEST ONLY')
        with Session(self.engine) as db:
            db.add(fixture.UploadedFile(id=1, filename=path.name, stored_name=path.name,
                                       file_path=str(path), file_url='/uploads/' + path.name,
                                       mime_type='application/pdf', file_size=path.stat().st_size))
            db.commit()
        context = multiprocessing.get_context('spawn')
        ready = context.Event()
        process = context.Process(target=reference_writer, args=(str(self.engine.url), str(uploads), ready))
        process.start()
        try:
            self.assertTrue(ready.wait(10), 'writer did not reach held transaction')
            with Session(self.engine, autoflush=False) as db:
                with self.assertRaises(HTTPException) as error:
                    fixture.upload.delete_file(1, db, True)
                self.assertEqual(error.exception.status_code, 409)
            self.assertTrue(path.exists())
        finally:
            process.join(10)
            if process.is_alive():
                process.terminate()
                process.join()
        self.assertEqual(process.exitcode, 0)

    def test_deleted_local_reference_is_rejected(self):
        from unittest.mock import patch
        with patch.object(fixture.settings, 'UPLOAD_DIR', self.directory.name), Session(self.engine, autoflush=False) as db:
            with self.assertRaises(HTTPException) as error:
                fixture.sections.update_section(1, fixture.SectionUpdate(content={
                    'body': '<img src="/uploads/TEST-ONLY-missing.png">'}), db, True)
            self.assertEqual(error.exception.status_code, 409)
            db.rollback()
            self.assertEqual(db.get(fixture.Section, 1).content, '{"body":""}')

    def test_concurrent_slug_creation_returns_conflict_not_500(self):
        context = multiprocessing.get_context('spawn')
        start, results = context.Event(), context.Queue()
        processes = [context.Process(target=slug_writer, args=(str(self.engine.url), start, results)) for _ in range(2)]
        for process in processes:
            process.start()
        start.set()
        try:
            self.assertEqual(sorted(results.get(timeout=10) for _ in processes), [201, 409])
        finally:
            for process in processes:
                process.join(10)
                if process.is_alive():
                    process.terminate()
                    process.join()
            results.close()
        self.assertTrue(all(process.exitcode == 0 for process in processes))
