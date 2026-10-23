"""Run the isolated API; env secrets never appear in process arguments."""
import argparse
import os
from init_fixture import ROOT, environment, run_path

parser = argparse.ArgumentParser()
parser.add_argument('name')
parser.add_argument('--port', type=int, default=18002)
args = parser.parse_args()
path = run_path(args.name)
env = environment(path)
os.chdir(path)
(path / 'backend.pid').write_text(str(os.getpid()))
with (path / 'backend.log').open('a') as log:
    os.dup2(log.fileno(), 1)
    os.dup2(log.fileno(), 2)
python = str(ROOT / 'backend/.venv/bin/python')
os.execve(python, [python, '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', str(args.port)], env)
