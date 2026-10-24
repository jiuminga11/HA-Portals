"""Local asset protocol: SQLite writer lock spans reference validation/deletion.

Only same-site relative /uploads paths (including deployment prefixes) participate.
Absolute remote URLs, direct SQL writers and out-of-process disk changes are outside
this protocol. A crash during staged deletion requires operator recovery.
"""
import html
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

from fastapi import HTTPException
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.config import settings


def writer_lock(db: Session) -> None:
    if db.bind.dialect.name != 'sqlite':
        raise RuntimeError('Local asset protocol requires SQLite')
    connection = db.connection()
    if not connection.connection.driver_connection.in_transaction:
        try:
            connection.exec_driver_sql('BEGIN IMMEDIATE')
        except OperationalError as exc:
            db.rollback()
            raise HTTPException(status_code=409, detail='数据正被修改，请重新加载后重试') from exc


def local_asset(value: str, *, include_absolute: bool = False) -> str | None:
    try:
        parsed = urlsplit(html.unescape(value).strip())
    except ValueError:
        return None
    if not include_absolute and (parsed.scheme or parsed.netloc):
        return None
    path = unquote(parsed.path)
    if path.startswith('uploads/'):
        path = '/' + path
    if not path.startswith('/'):
        return None
    if '/uploads/' not in path:
        return None
    name = path.split('/uploads/', 1)[1]
    if not name or '/' in name or '\\' in name or name in {'.', '..'}:
        return None
    return name


class _References(HTMLParser):
    def __init__(self, include_absolute: bool = False):
        super().__init__(convert_charrefs=True)
        self.names = set()
        self.include_absolute = include_absolute

    def handle_starttag(self, tag, attrs):
        for key, value in attrs:
            if key in {'src', 'href', 'poster'} and value:
                name = local_asset(value, include_absolute=self.include_absolute)
                if name:
                    self.names.add(name)


def local_references(value, *, include_absolute: bool = False) -> set[str]:
    """Deletion may conservatively match any host; write checks remain local-only."""
    if isinstance(value, dict):
        return set().union(*(local_references(item, include_absolute=include_absolute) for item in value.values()))
    if isinstance(value, list):
        return set().union(*(local_references(item, include_absolute=include_absolute) for item in value))
    if not isinstance(value, str):
        return set()
    parser = _References(include_absolute)
    parser.feed(value)
    name = local_asset(value, include_absolute=include_absolute)
    if name:
        parser.names.add(name)
    return parser.names


def validate_local_references(value) -> None:
    for name in local_references(value):
        if not (Path(settings.UPLOAD_DIR) / name).is_file():
            raise HTTPException(status_code=409, detail='引用的本地文件已不存在，请重新选择文件')
