#!/usr/bin/env bash
set -euo pipefail
# No source, activation, mkdir or build before dispatch.
exec python3 -B "$(dirname -- "${BASH_SOURCE[0]}")/release.py" "$@"
