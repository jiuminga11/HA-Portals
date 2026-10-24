"""Production /ha/ preview, intentionally no root /uploads or /api aliases."""
import argparse
import json
import http.client
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import os
from pathlib import Path
from urllib.parse import urlsplit, unquote
from init_fixture import RUNTIME, run_path

parser = argparse.ArgumentParser()
parser.add_argument('name')
parser.add_argument('--port', type=int, default=15174)
parser.add_argument('--api-port', type=int, default=18002)
parser.add_argument('--dist', type=Path, help='Existing production dist directory inside .remediation-runtime')
args = parser.parse_args()
if args.port in (8002, 5174) or args.api_port in (8002, 5174):
    raise SystemExit('Refusing normal development ports')
run = run_path(args.name)
dist = (args.dist if args.dist is not None else run / 'dist').resolve()
if not dist.is_relative_to(RUNTIME.resolve()):
    raise SystemExit('Preview dist must stay inside .remediation-runtime.')
if not (dist / 'index.html').is_file():
    raise SystemExit('Build production dist into this run first (see README).')


class Handler(SimpleHTTPRequestHandler):
    def route(self):
        url = urlsplit(self.path)
        if url.path.startswith(('/ha/api/', '/ha/uploads/')):
            connection = http.client.HTTPConnection('127.0.0.1', args.api_port, timeout=30)
            headers = {k: v for k, v in self.headers.items() if k.lower() not in ('host', 'connection', 'transfer-encoding')}
            body = self.rfile.read(int(self.headers.get('Content-Length', 0)))
            try:
                connection.request(self.command, self.path[3:], body=body, headers=headers)
                response = connection.getresponse()
                data = response.read()
                self.send_response(response.status)
                for key, value in response.getheaders():
                    if key.lower() not in ('connection', 'transfer-encoding', 'content-length'):
                        self.send_header(key, value)
                self.send_header('Content-Length', str(len(data)))
                self.end_headers()
                if self.command != 'HEAD':
                    self.wfile.write(data)
            except OSError:
                self.send_error(502, 'Isolated API unavailable')
            finally:
                connection.close()
            return
        if self.path == '/ha':
            self.send_response(308)
            self.send_header('Location', '/ha/')
            self.end_headers()
            return
        if not url.path.startswith('/ha/') or self.command not in ('GET', 'HEAD'):
            self.send_error(404)
            return
        relative = unquote(url.path[4:])
        target = (dist / relative).resolve()
        if not target.is_relative_to(dist.resolve()):
            self.send_error(404)
            return
        if not target.is_file():
            if Path(relative).suffix or relative.startswith('assets/'):
                self.send_error(404)
                return
            relative = 'index.html'
        self.path = '/' + relative
        if self.command == 'HEAD':
            super().do_HEAD()
        else:
            super().do_GET()

    do_GET = do_HEAD = do_POST = do_PUT = do_DELETE = do_PATCH = do_OPTIONS = route

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(dist), **kw)


prefix = 'preview' if args.port == 15174 else f'preview-{args.port}'
(run / f'{prefix}.pid').write_text(str(os.getpid()))
with (run / f'{prefix}.log').open('a') as log:
    os.dup2(log.fileno(), 1)
    os.dup2(log.fileno(), 2)
    server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    ready = run / 'preview-ready.json'
    temporary = ready.with_suffix('.tmp')
    temporary.write_text(json.dumps({'port': server.server_port, 'pid': os.getpid()}))
    temporary.replace(ready)
    server.serve_forever()
