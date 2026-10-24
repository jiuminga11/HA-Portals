"""Opaque content revisions and atomic compare-and-swap without a DB migration."""
import hashlib
import json

from fastapi import HTTPException
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session


def snapshot(row) -> dict:
    return {column.name: getattr(row, column.name) for column in row.__table__.columns}


def revision(values: dict) -> str:
    return hashlib.sha256(json.dumps(values, sort_keys=True, ensure_ascii=False,
                                     default=str, separators=(',', ':')).encode()).hexdigest()


def commit_edit(db: Session, row, original: dict, expected: str | None):
    """CAS predicates use original raw columns, not second-resolution updated_at alone.

    Legacy clients omitting expected_revision retain unconditional update semantics.
    """
    if expected is not None and expected != revision(original):
        db.rollback()
        raise HTTPException(status_code=409, detail='revision_conflict')
    model = type(row)
    proposed = snapshot(row)
    changes = {key: value for key, value in proposed.items() if value != original[key]}
    # Prevent ORM flush from bypassing the conditional UPDATE.
    db.expunge(row)
    statement = update(model.__table__).where(model.id == original['id'])
    if expected is not None:
        for column in model.__table__.columns:
            # SQLite CURRENT_TIMESTAMP and bound datetime values differ in their
            # textual fractional-second representation. All actual content fields
            # participate; timestamps are not the concurrency authority.
            if column.name not in {'created_at', 'updated_at'}:
                statement = statement.where(column == original[column.name])
    # Even no-op saves must verify the snapshot atomically.
    statement = statement.values(changes or {'id': original['id']})
    try:
        result = db.execute(statement)
        if result.rowcount != 1:
            db.rollback()
            raise HTTPException(status_code=409, detail='revision_conflict')
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail='数据已存在或已改变，请重新加载') from exc
    return db.get(model, original['id'], populate_existing=True)
