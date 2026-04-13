# BACKEND APP

FastAPI REST API with SQLAlchemy ORM on SQLite.

## STRUCTURE

```
app/
├── main.py              # App entry, lifespan, route registration
├── config.py            # Pydantic Settings from .env
├── database.py          # Engine + SessionLocal
├── models.py            # 3 ORM models: SiteConfig, Section, UploadedFile
├── schemas.py           # Request/response Pydantic models
├── content_schemas.py   # Per-type content validation (5 types)
├── sanitizer.py         # XSS filter (3 regex patterns)
├── deps.py              # get_db, get_current_admin, get_optional_admin
└── routers/
    ├── auth.py          # POST /api/auth/login → JWT
    ├── site_config.py   # GET/PUT /api/site-config (singleton id=1)
    ├── sections.py      # CRUD + reorder (most complex router)
    └── upload.py        # File upload + reference-checked delete
```

## WHERE TO LOOK

| Task | File | Notes |
|------|------|-------|
| Add content type | `content_schemas.py` | Add model + add to CONTENT_SCHEMA_MAP + DEFAULT_CONTENT_MAP |
| Add API endpoint | `routers/` + register in `main.py` | Follow existing HTTPException pattern |
| Change auth logic | `deps.py` | Returns bool, not user object |
| Change upload rules | `config.py` (ALLOWED_*) + `routers/upload.py` | Dual check: MIME + extension |

## CONVENTIONS

- All routes raise `HTTPException`, never bare exceptions
- `ValidationError` from content_schemas caught and wrapped as 400
- `exclude_unset=True` for partial updates (SiteConfig, Section)
- Content updates are full replacement, never partial merge
- `sort_order` normalized after every mutation
- `_get_or_create_config()` ensures SiteConfig always exists

## ANTI-PATTERNS

- Never return 500 for user input errors — catch and convert to 400
- Never allow null into NOT NULL columns — explicit rejection before commit
- Never trust client MIME type alone — also check extension
- Never skip `_normalize_sort_order()` after create/delete/reorder
