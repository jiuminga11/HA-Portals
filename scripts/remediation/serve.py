"""Isolated API. --port 0 retains a bound socket, eliminating port-probe races."""
import argparse
import json
import os
import socket
import sys
from pathlib import Path
from init_fixture import ROOT, backend_python, environment, run_path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('name')
    parser.add_argument('--port', type=int, default=18002)
    args = parser.parse_args()
    if args.port in (8002, 5174):
        raise SystemExit('Refusing normal development ports')
    path = run_path(args.name)
    env = environment(path)
    python = backend_python()
    if os.path.abspath(sys.executable) != os.path.abspath(python):
        os.execve(python, [python, str(Path(__file__).resolve()), *sys.argv[1:]], env)
    os.environ.update(env)
    os.chdir(path)  # No backend/.env discovery; app lifespan data/ stays in this run.
    sys.path.insert(0, str(ROOT / 'backend'))
    (path / 'uploads').mkdir(exist_ok=True)
    (path / 'backend.pid').write_text(str(os.getpid()))
    with (path / 'backend.log').open('a') as log:
        os.dup2(log.fileno(), 1)
        os.dup2(log.fileno(), 2)
    import uvicorn
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.bind(('127.0.0.1', args.port))
    sock.listen(128)
    ready = path / 'backend-ready.json'
    temporary = ready.with_suffix('.tmp')
    temporary.write_text(json.dumps({'port': sock.getsockname()[1], 'pid': os.getpid()}))
    temporary.replace(ready)
    try:
        uvicorn.Server(uvicorn.Config('app.main:app', host='127.0.0.1', port=0)).run(sockets=[sock])
    finally:
        sock.close()


if __name__ == '__main__':
    main()
