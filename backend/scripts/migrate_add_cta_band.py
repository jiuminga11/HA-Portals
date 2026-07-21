"""Migrate section table: extend ck_section_type CHECK with 'cta_band'.

SQLite cannot ALTER a CHECK constraint, so the table is rebuilt:
create section_new (9-type IN list) -> copy rows -> drop old -> rename -> recreate index.

Usage:
    venv/bin/python scripts/migrate_add_cta_band.py <path-to-sqlite-db>

Idempotent-safe: exits 0 if 'cta_band' is already in the CHECK; fails cleanly
if a leftover section_new table exists.
"""

import sqlite3
import sys

OLD_IN_LIST = "('rich_text', 'image_gallery', 'data_table', 'external_links', 'video', 'metric_cards', 'timeline', 'profile_hero')"
NEW_IN_LIST = "('rich_text', 'image_gallery', 'data_table', 'external_links', 'video', 'metric_cards', 'timeline', 'profile_hero', 'cta_band')"

CREATE_SECTION_NEW = f"""
CREATE TABLE section_new (
	id INTEGER NOT NULL,
	page_id INTEGER NOT NULL,
	title_zh VARCHAR(200) NOT NULL,
	title_en VARCHAR(200) NOT NULL,
	type VARCHAR(50) NOT NULL,
	sort_order INTEGER NOT NULL,
	visible BOOLEAN NOT NULL,
	content TEXT NOT NULL,
	created_at DATETIME DEFAULT (CURRENT_TIMESTAMP),
	updated_at DATETIME DEFAULT (CURRENT_TIMESTAMP),
	PRIMARY KEY (id),
	CONSTRAINT ck_section_type CHECK (type IN {NEW_IN_LIST}),
	FOREIGN KEY(page_id) REFERENCES page (id) ON DELETE CASCADE
)
"""

COLUMNS = "id, page_id, title_zh, title_en, type, sort_order, visible, content, created_at, updated_at"


def main(db_path: str) -> int:
    conn = sqlite3.connect(db_path)
    try:
        conn.execute("PRAGMA foreign_keys=off")

        existing_sql = conn.execute(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name='section'"
        ).fetchone()
        if existing_sql is None:
            print("ERROR: table 'section' not found", file=sys.stderr)
            return 1
        if "'cta_band'" in existing_sql[0]:
            print("Already migrated: 'cta_band' present in ck_section_type. Nothing to do.")
            return 0
        leftover = conn.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name='section_new'"
        ).fetchone()
        if leftover:
            print("ERROR: leftover table 'section_new' exists — aborting. Inspect and drop it manually.", file=sys.stderr)
            return 1

        before = conn.execute("SELECT COUNT(*) FROM section").fetchone()[0]

        conn.execute("BEGIN")
        conn.execute(CREATE_SECTION_NEW)
        conn.execute(f"INSERT INTO section_new ({COLUMNS}) SELECT {COLUMNS} FROM section")
        conn.execute("DROP TABLE section")
        conn.execute("ALTER TABLE section_new RENAME TO section")
        conn.execute("CREATE INDEX idx_section_sort ON section (page_id, visible, sort_order)")
        conn.commit()

        conn.execute("PRAGMA foreign_keys=on")
        after = conn.execute("SELECT COUNT(*) FROM section").fetchone()[0]
        fk_violations = conn.execute("PRAGMA foreign_key_check").fetchall()

        print(f"Rows before: {before}")
        print(f"Rows after:  {after}")
        if before != after:
            print("ERROR: row count mismatch", file=sys.stderr)
            return 1
        if fk_violations:
            print(f"ERROR: foreign_key_check violations: {fk_violations}", file=sys.stderr)
            return 1

        new_sql = conn.execute(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name='section'"
        ).fetchone()[0]
        assert "'cta_band'" in new_sql, "new CHECK missing cta_band"
        print("foreign_key_check: clean")
        print("Migration OK: ck_section_type now includes 'cta_band'.")
        return 0
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__, file=sys.stderr)
        sys.exit(2)
    sys.exit(main(sys.argv[1]))
