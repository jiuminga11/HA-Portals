"""Isolated section ordering contract tests; never import the application lifespan."""

import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

from fastapi import HTTPException
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session


ROOT = Path(__file__).resolve().parents[2]
RUNTIME = ROOT / ".remediation-runtime"
RUNTIME.mkdir(exist_ok=True)
sys.path.insert(0, str(ROOT / "backend"))

# Import with explicit test settings and no real .env in the working directory.
with tempfile.TemporaryDirectory(dir=RUNTIME, prefix="sort-import-") as import_dir:
    previous_cwd = Path.cwd()
    try:
        os.chdir(import_dir)
        with patch.dict(os.environ, {
            "ADMIN_USERNAME": "sort-test-admin",
            "ADMIN_PASSWORD": "sort-test-password-only",
            "JWT_SECRET_KEY": "sort-test-secret-not-for-production",
            "DATABASE_URL": "sqlite:///:memory:",
            "UPLOAD_DIR": str(Path(import_dir) / "uploads"),
        }):
            from app.database import Base
            from app.models import Page, Section
            from app.routers import sections
            from app.schemas import SectionCreate, SectionReorderRequest
    finally:
        os.chdir(previous_cwd)


class SortContractTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(dir=RUNTIME, prefix="sort-db-")
        self.addCleanup(self.directory.cleanup)
        self.engine = create_engine(f"sqlite:///{self.directory.name}/test.sqlite")
        self.addCleanup(self.engine.dispose)
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine, autoflush=False)
        self.addCleanup(self.db.close)
        self.db.add_all([
            Page(id=7, slug="test-a", title_zh="A"),
            Page(id=9, slug="test-b", title_zh="B", visible=False),
        ])
        self.db.flush()
        self.db.add_all([
            Section(id=i, page_id=page, title_zh=f"Test {i}", type="rich_text",
                    content='{"body":""}', sort_order=order, visible=visible)
            for i, page, order, visible in [
                (11, 7, 4, True), (12, 7, 8, False), (13, 7, 12, True),
                (21, 9, 6, True),
            ]
        ])
        self.db.commit()
        self.writes = []
        self.commits = []
        event.listen(self.engine, "before_cursor_execute", self.record_write)
        event.listen(self.db, "after_commit", lambda session: self.commits.append(True))

    def record_write(self, conn, cursor, statement, parameters, context, executemany):
        if statement.lstrip().split()[0].upper() in {"INSERT", "UPDATE", "DELETE"}:
            self.writes.append(statement)

    def snapshot(self):
        with Session(self.engine) as db:
            return [(s.id, s.page_id, s.sort_order, s.visible)
                    for s in db.query(Section).order_by(Section.id).all()]

    def reorder(self, pairs):
        body = SectionReorderRequest(orders=[
            {"id": section_id, "sort_order": order} for section_id, order in pairs
        ])
        return sections.reorder_sections(body, self.db, True)

    def test_invalid_requests_perform_zero_writes(self):
        cases = {
            "empty": [],
            "duplicate_id": [(11, 0), (11, 1), (13, 2)],
            "missing_id": [(11, 0), (12, 1), (999, 2)],
            "cross_page": [(11, 0), (12, 1), (13, 2), (21, 3)],
            "missing_hidden": [(11, 0), (13, 1)],
            "missing_visible": [(11, 0), (12, 1)],
            "duplicate_sort": [(11, 0), (12, 0), (13, 2)],
            "negative_sort": [(11, -1), (12, 0), (13, 1)],
            "gap": [(11, 0), (12, 1), (13, 3)],
        }
        before = self.snapshot()
        for name, pairs in cases.items():
            with self.subTest(name=name):
                with self.assertRaises(HTTPException) as error:
                    self.reorder(pairs)
                self.assertEqual(error.exception.status_code, 400)
                self.assertFalse(self.db.dirty)
                self.assertEqual(self.writes, [])
                self.assertEqual(self.commits, [])
                self.assertEqual(self.snapshot(), before)

    def test_reorder_persists_complete_page_and_returns_all_sections(self):
        result = self.reorder([(13, 0), (11, 1), (12, 2)])
        self.assertEqual({s.id for s in result}, {11, 12, 13, 21})
        self.assertEqual(self.snapshot(), [
            (11, 7, 1, True), (12, 7, 2, False), (13, 7, 0, True), (21, 9, 6, True),
        ])
        self.assertEqual(len(self.commits), 1)
        self.reorder([(11, 0), (13, 1), (12, 2)])
        self.assertEqual(dict((row[0], row[2]) for row in self.snapshot()),
                         {11: 0, 12: 2, 13: 1, 21: 6})
        self.assertEqual(len(self.commits), 2)

    def test_create_normalizes_with_one_commit(self):
        result = sections.create_section(SectionCreate(
            page_id=7, title_zh="New", type="rich_text"
        ), self.db, True)
        self.assertEqual(result.sort_order, 3)
        self.assertEqual([row[2] for row in self.snapshot() if row[1] == 7], [0, 1, 2, 3])
        self.assertEqual(len(self.commits), 1)

    def test_delete_normalizes_with_one_commit(self):
        self.assertEqual(sections.delete_section(12, self.db, True), {"detail": "deleted"})
        self.assertEqual(self.snapshot(), [(11, 7, 0, True), (13, 7, 1, True), (21, 9, 6, True)])
        self.assertEqual(len(self.commits), 1)

    def test_normalize_does_not_commit(self):
        before = self.snapshot()
        sections._normalize_sort_order(self.db, 7)
        self.db.flush()
        self.assertEqual(self.commits, [])
        self.assertEqual(self.snapshot(), before)
        self.db.rollback()
        self.assertEqual(self.snapshot(), before)

    def test_mutations_roll_back_if_normalization_fails(self):
        before = self.snapshot()
        actions = [
            lambda: sections.create_section(SectionCreate(
                page_id=7, title_zh="New", type="rich_text"), self.db, True),
            lambda: sections.delete_section(12, self.db, True),
            lambda: self.reorder([(13, 0), (12, 1), (11, 2)]),
        ]
        for action in actions:
            with self.subTest(action=action):
                with patch.object(sections, "_normalize_sort_order", side_effect=RuntimeError("test failure")):
                    with self.assertRaisesRegex(RuntimeError, "test failure"):
                        action()
                self.assertEqual(self.commits, [])
                self.assertEqual(self.snapshot(), before)
                self.db.rollback()
                self.assertEqual(self.snapshot(), before)


if __name__ == "__main__":
    unittest.main()
