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
from pydantic import ValidationError
from app.schemas import PageReorderRequest, SectionReorderRequest
from app.revisions import revision, snapshot


def reference_writer(database, uploads, ready):
    fixture.settings.UPLOAD_DIR = uploads
    engine = create_engine(database)
    with Session(engine, autoflush=False) as db:
        def before_commit(session):
            ready.set()
            time.sleep(0.3)
        event.listen(db, 'before_commit', before_commit)
        fixture.sections.update_section(1, fixture.SectionUpdate(
            content={'body': '<a href="/uploads/TEST-ONLY.pdf?v=1&amp;x=2">TEST ONLY</a>'},
            expected_revision=revision(snapshot(db.get(fixture.Section, 1)))), db, True)
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

    def test_missing_null_blank_preconditions_are_409_without_writes(self):
        cases = [
            (fixture.SectionUpdate, {'title_zh': 'must not write'}, 'expected_revision',
             lambda body, db: fixture.sections.update_section(1, body, db, True)),
            (fixture.PageUpdate, {'title_zh': 'must not write'}, 'expected_revision',
             lambda body, db: fixture.pages.update_page(1, body, db, True)),
            (fixture.SiteConfigUpdate, {'site_title': 'must not write'}, 'expected_revision',
             lambda body, db: fixture.site_config.update_site_config(body, db, True)),
            (SectionReorderRequest, {'orders': [{'id': 1, 'sort_order': 0}]}, 'expected_previous_order',
             lambda body, db: fixture.sections.reorder_sections(body, db, True)),
            (PageReorderRequest, {'orders': [{'id': 1, 'sort_order': 7}]}, 'expected_previous_order',
             lambda body, db: fixture.pages.reorder_pages(body, db, True)),
        ]
        writes = []
        def track(conn, cursor, statement, parameters, context, executemany):
            if statement.lstrip().split()[0].upper() in {'INSERT', 'UPDATE', 'DELETE'}:
                writes.append(statement)
        event.listen(self.engine, 'before_cursor_execute', track)
        try:
            for schema, payload, key, call in cases:
                for condition in [{}, {key: None}, {key: ''}, {key: '  '}]:
                    with self.subTest(schema=schema.__name__, condition=condition), Session(self.engine, autoflush=False) as db:
                        with self.assertRaises(HTTPException) as error:
                            call(schema(**payload, **condition), db)
                        self.assertEqual((error.exception.status_code, error.exception.detail), (409, 'revision_conflict'))
                        self.assertEqual(writes, [])
                        self.assertFalse(db.dirty)
        finally:
            event.remove(self.engine, 'before_cursor_execute', track)
        # A missing singleton must not be created as a side effect of rejection.
        with Session(self.engine) as db:
            db.query(fixture.SiteConfig).delete()
            db.commit()
            with self.assertRaises(HTTPException):
                fixture.site_config.update_site_config(fixture.SiteConfigUpdate(site_title='no create'), db, True)
            self.assertEqual(db.query(fixture.SiteConfig).count(), 0)

    def test_revision_types_are_strict(self):
        for schema in [fixture.SectionUpdate, fixture.PageUpdate, fixture.SiteConfigUpdate]:
            for value in [123, True, [], {}]:
                with self.subTest(schema=schema.__name__, value=value), self.assertRaises(ValidationError):
                    schema(expected_revision=value)

    def prepare_reorder(self):
        with Session(self.engine) as db:
            db.add_all([fixture.Page(id=2, slug='test-hidden', title_zh='TEST ONLY', visible=False),
                        fixture.Page(id=3, slug='test-other', title_zh='TEST ONLY')])
            db.flush()
            db.add_all([fixture.Section(id=2, page_id=1, type='rich_text', title_zh='TEST ONLY', visible=False),
                        fixture.Section(id=3, page_id=1, type='rich_text', title_zh='TEST ONLY'),
                        fixture.Section(id=4, page_id=3, type='rich_text', title_zh='TEST ONLY', sort_order=8)])
            db.commit()
        return [(fixture.Page, PageReorderRequest, fixture.pages.reorder_pages),
                (fixture.Section, SectionReorderRequest, fixture.sections.reorder_sections)]

    def reorder_snapshot(self, db, model):
        query = db.query(model.id).order_by(model.sort_order, model.id)
        if model is fixture.Section:
            query = query.filter(model.page_id == 1)
        return [row.id for row in query.all()]

    def test_reorder_second_editor_conflicts_without_writes(self):
        for model, schema, reorder in self.prepare_reorder():
            with self.subTest(model=model.__name__), Session(self.engine, autoflush=False) as first, Session(self.engine, autoflush=False) as second:
                previous = self.reorder_snapshot(first, model)
                self.assertEqual(self.reorder_snapshot(second, model), previous)
                self.assertEqual(previous, [1, 2, 3])  # tied ranks use ID; includes hidden rows
                winner = list(reversed(previous))
                response = reorder(schema(orders=[{'id': id_, 'sort_order': i} for i, id_ in enumerate(winner)],
                                          expected_previous_order=previous), first, True)
                self.assertEqual({row.id for row in response}, {1, 2, 3, 4} if model is fixture.Section else {1, 2, 3})
                writes = []
                def record_write(conn, cursor, statement, parameters, context, executemany):
                    if statement.lstrip().split()[0].upper() in {'INSERT', 'UPDATE', 'DELETE'}:
                        writes.append(statement)
                event.listen(self.engine, 'before_cursor_execute', record_write)
                try:
                    with self.assertRaises(HTTPException) as error:
                        reorder(schema(orders=[{'id': id_, 'sort_order': i} for i, id_ in enumerate([2, 3, 1])],
                                       expected_previous_order=previous), second, True)
                    self.assertEqual(error.exception.status_code, 409)
                    self.assertEqual(error.exception.detail, 'revision_conflict')
                    self.assertEqual(writes, [])
                    self.assertFalse(second.dirty)
                    self.assertEqual(self.reorder_snapshot(second, model), winner)
                    if model is fixture.Section:
                        self.assertEqual(second.get(model, 4).sort_order, 8)
                finally:
                    event.remove(self.engine, 'before_cursor_execute', record_write)

    def test_reorder_requires_precondition_and_preserves_sparse_page_contract(self):
        for model, schema, reorder in self.prepare_reorder():
            with self.subTest(model=model.__name__), Session(self.engine, autoflush=False) as db:
                order = [3, 1, 2]
                # Preserve page sparse-sort contract, while sections require 0..n-1.
                scale = 7 if model is fixture.Page else 1
                body = schema(orders=[{'id': id_, 'sort_order': i * scale} for i, id_ in enumerate(order)])
                with self.assertRaises(HTTPException) as error:
                    reorder(body, db, True)
                self.assertEqual(error.exception.status_code, 409)
                body.expected_previous_order = self.reorder_snapshot(db, model)
                reorder(body, db, True)
                self.assertEqual(self.reorder_snapshot(db, model), order)

    def test_reorder_wrong_previous_values_do_not_mutate(self):
        for model, schema, reorder in self.prepare_reorder():
            for wrong in [[], [1], [1, 1, 3], [1, 2, 999], [1, 3, 2], [-1, 2, 3]]:
                with self.subTest(model=model.__name__, previous=wrong), Session(self.engine, autoflush=False) as db:
                    with self.assertRaises(HTTPException) as error:
                        reorder(schema(orders=[{'id': id_, 'sort_order': i} for i, id_ in enumerate([3, 2, 1])],
                                       expected_previous_order=wrong), db, True)
                    self.assertEqual(error.exception.status_code, 409)
                    self.assertFalse(db.dirty)
                    self.assertEqual(self.reorder_snapshot(db, model), [1, 2, 3])

    def test_reorder_precondition_types_are_strict(self):
        for schema in [PageReorderRequest, SectionReorderRequest]:
            for invalid in ['1,2,3', 1, {'id': 1}, ['1', 2, 3], [True, 2, 3], [1.0, 2, 3], [None]]:
                with self.subTest(schema=schema.__name__, value=invalid), self.assertRaises(ValidationError):
                    schema(orders=[{'id': 1, 'sort_order': 0}], expected_previous_order=invalid)

    def test_atomic_cas_rejects_change_after_snapshot(self):
        from app.revisions import snapshot, revision, commit_edit
        with Session(self.engine, autoflush=False) as first, Session(self.engine, autoflush=False) as second:
            row = first.get(fixture.Page, 1)
            original = snapshot(row)
            fixture.pages.update_page(1, fixture.PageUpdate(title_zh='winner', expected_revision=revision(original)), second, True)
            row.title_zh = 'must not overwrite'
            with self.assertRaises(HTTPException) as error:
                commit_edit(first, row, original, revision(original))
            self.assertEqual(error.exception.status_code, 409)
            self.assertEqual(first.get(fixture.Page, 1).title_zh, 'winner')

    def test_legacy_unconditional_update_is_rejected(self):
        with Session(self.engine, autoflush=False) as db:
            with self.assertRaises(HTTPException) as error:
                fixture.pages.update_page(1, fixture.PageUpdate(title_zh='legacy'), db, True)
            self.assertEqual(error.exception.status_code, 409)
            self.assertEqual(db.get(fixture.Page, 1).title_zh, 'TEST ONLY')

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
                fixture.sections.update_section(1, fixture.SectionUpdate(expected_revision=revision(snapshot(db.get(fixture.Section, 1))), content={
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
