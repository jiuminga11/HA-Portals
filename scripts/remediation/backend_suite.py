"""Discover current backend regressions; skipped tests are not a green acceptance."""
import json
import os
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[2]


def main():
    run = Path(os.environ['REMEDIATION_RUN'])
    if run.resolve() != run or not run.is_relative_to(ROOT / '.remediation-runtime'):
        raise SystemExit('Unsafe result directory')
    suite = unittest.defaultTestLoader.discover(str(ROOT / 'backend/tests'), pattern='test_*.py')
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    summary = {'tests': result.testsRun, 'failures': len(result.failures), 'errors': len(result.errors), 'skipped': len(result.skipped)}
    (run / 'backend-summary.json').write_text(json.dumps(summary))
    return 0 if result.wasSuccessful() and result.testsRun > 0 and not result.skipped else 1


if __name__ == '__main__':
    sys.exit(main())
