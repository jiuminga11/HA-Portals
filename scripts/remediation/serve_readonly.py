"""Optional local acceptance against existing data: GET-only, SQLite mode=ro, no lifespan.

Never performs initialization/seed, logs payloads, or offers admin/auth endpoints.
Use only with the local preview; browser checks must not export private content.
"""
import os
from pathlib import Path
import sys

from init_fixture import ROOT, environment, run_path

runtime = run_path('baseline-v1')
source = ROOT / 'backend/data/ha-portals.db'
if not source.is_file():
    raise SystemExit('Existing database is unavailable; no initialization attempted.')
os.environ.update(environment(runtime))
os.environ['DATABASE_URL'] = f'sqlite:///file:{source}?mode=ro&uri=true'
os.environ['UPLOAD_DIR'] = str(ROOT / 'backend/uploads')
os.chdir(runtime)
sys.path.insert(0, str(ROOT / 'backend'))

from fastapi import Request, Response
from app.main import app
import uvicorn


@app.middleware('http')
async def readonly_requests(request: Request, call_next):
    if request.method not in ('GET', 'HEAD') or request.url.path.startswith(('/api/admin', '/api/auth', '/api/files', '/api/sections')):
        return Response(status_code=405)
    return await call_next(request)


(runtime / 'readonly.pid').write_text(str(os.getpid()))
with (runtime / 'readonly.log').open('a') as log:
    os.dup2(log.fileno(), 1)
    os.dup2(log.fileno(), 2)
    uvicorn.run(app, host='127.0.0.1', port=18003, lifespan='off', access_log=False)
