#!/usr/bin/env python3
"""Optional real operator adapter. Requires manually reviewed prepared.json; never sudo."""
import os
import sys

# This executable must not shadow the standard-library operator module while
# json/re/enum are being imported (notably on CPython 3.12).
if __name__ == '__main__':
    script_directory = os.path.dirname(os.path.realpath(__file__))
    sys.path[:] = [entry for entry in sys.path if os.path.realpath(entry) != script_directory]

import hashlib
import json
from pathlib import Path
import subprocess
import time
import urllib.request


def command(*argv):
    return subprocess.check_output(argv, text=True, stderr=subprocess.DEVNULL, timeout=30)


def require(condition):
    if not condition:
        raise RuntimeError('verification failed')


def main():
    action, directory = sys.argv[1:]
    root = Path(directory)
    prepared = json.loads((root / 'deploy/prepared.json').read_text())
    unit = 'ha-portals.service'
    if action == 'verify':
        # Pin the entire effective configuration, not merely a repository snippet.
        nginx = command('nginx', '-T')
        service = command('systemctl', 'show', unit, '--property=FragmentPath,DropInPaths,User,WorkingDirectory,ExecStart,Environment,EnvironmentFiles')
        require(hashlib.sha256(nginx.encode()).hexdigest() == prepared['nginx_sha256'])
        require(hashlib.sha256(service.encode()).hexdigest() == prepared['service_sha256'])
        require(hashlib.sha256((root / 'backend/.env').read_bytes()).hexdigest() == prepared['env_sha256'])
        require(prepared['root'] == str(root))
        require(prepared['reviewed_environment_file_only'] is True)
        require(prepared['reviewed_exclusive_writer'] is True)
        require(prepared['reviewed_effective_locations'] is True)
        require(f'WorkingDirectory={root}/backend\n' in service)
        require(str(root / 'backend/.env') in service)
        require(str(root / 'backend/venv/bin/uvicorn') in service)
        require(f'alias {root}/frontend/dist/;' in nginx)
        require(f'alias {root}/backend/uploads/;' in nginx)
        require('# configuration file ' in nginx and '/ha/api/' in nginx)
        return dict.fromkeys(('service_config', 'nginx_include', 'aliases', 'environment', 'exclusive_writer'), True)
    if action == 'stop':
        command('systemctl', 'stop', unit)
    if action in ('stop', 'stopped'):
        state = command('systemctl', 'show', unit, '--property=ActiveState,SubState,MainPID')
        return {'stopped': 'ActiveState=inactive\n' in state and 'MainPID=0\n' in state and 'SubState=dead\n' in state}
    if action == 'start':
        command('systemctl', 'start', unit)
        return {'started': True}
    if action == 'health':
        # Both direct API and actual public Nginx route must be healthy.
        last = None
        for _ in range(10):
            try:
                for url in ('http://127.0.0.1:8002/api/health', prepared['public_health_url']):
                    with urllib.request.urlopen(url, timeout=5) as response:
                        body = json.load(response)
                        require(200 <= response.status < 300 and body['status'] == body['db'] == 'ok')
                        last = {'http_status': response.status, 'body': body}
                return last
            except Exception:
                time.sleep(1)
        raise RuntimeError('health failed')
    raise RuntimeError('unknown action')


if __name__ == '__main__':
    try:
        print(json.dumps(main()))
    except Exception:
        # Never echo environment or effective config credentials.
        sys.exit(1)
