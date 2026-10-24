"""Deploy unittest runner emitting only allowlisted IDs/types, never raw tracebacks."""
import contextlib
import io
import json
import os
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[2]
ERROR_TYPES = frozenset({'AssertionError', 'AttributeError', 'FileNotFoundError',
                        'PermissionError', 'ImportError', 'ModuleNotFoundError',
                        'OSError', 'RuntimeError', 'ValueError', 'TypeError',
                        'TimeoutExpired', 'SystemExit', 'KeyboardInterrupt',
                        'Refused', 'Cancellation'})
OUTCOMES = frozenset({'failure', 'error', 'skip', 'unexpected_success'})


def test_ids(suite):
    for test in suite:
        if isinstance(test, unittest.TestSuite):
            yield from test_ids(test)
        else:
            yield test.id()


def read_summary(path):
    """Revalidate data before exposing it in the supervisor's public report/log."""
    data = json.loads(Path(path).read_text())
    counts = {}
    for key in ('tests', 'failures', 'errors', 'skipped'):
        value = data[key]
        if type(value) is not int or not 0 <= value <= 10000:
            raise ValueError('Invalid deployment result count')
        counts[key] = value
    # Derive allowed IDs from test source via AST, without importing/executing it.
    import ast
    source = ast.parse((ROOT / 'deploy/tests/test_release.py').read_text())
    allowed = {'deploy-suite'}
    for node in source.body:
        if isinstance(node, ast.ClassDef) and node.name == 'ReleaseTests':
            allowed.update('test_release.ReleaseTests.' + method.name for method in node.body
                           if isinstance(method, ast.FunctionDef) and method.name.startswith('test_'))
    issues = []
    if not isinstance(data['issues'], list) or len(data['issues']) > 10000:
        raise ValueError('Invalid deployment issue count')
    for issue in data['issues']:
        if (issue['test'] not in allowed or issue['outcome'] not in OUTCOMES
                or issue['type'] not in ERROR_TYPES | {'Exception', 'Skipped', 'UnexpectedSuccess'}):
            raise ValueError('Unsafe deployment issue')
        issues.append({key: issue[key] for key in ('test', 'outcome', 'type')})
    return dict(counts, issues=issues)


class SafeResult(unittest.TestResult):
    def __init__(self, allowed, path):
        super().__init__()
        self.allowed = allowed
        self.path = path
        self.issues = []

    def summary(self):
        return {'tests': self.testsRun, 'failures': len(self.failures),
                'errors': len(self.errors), 'skipped': len(self.skipped), 'issues': self.issues}

    def save(self):
        temporary = self.path.with_suffix('.tmp')
        temporary.write_text(json.dumps(self.summary()))
        temporary.replace(self.path)

    def issue(self, test, outcome, kind):
        identifier = test.id()
        safe_id = identifier in self.allowed and identifier.startswith('test_release.ReleaseTests.test_')
        self.issues.append({'test': identifier if safe_id else 'deploy-suite',
                            'outcome': outcome, 'type': kind})
        self.save()

    def addFailure(self, test, err):
        self.failures.append((test, ''))
        self.issue(test, 'failure', err[0].__name__ if err[0].__name__ in ERROR_TYPES else 'Exception')

    def addError(self, test, err):
        self.errors.append((test, ''))
        self.issue(test, 'error', err[0].__name__ if err[0].__name__ in ERROR_TYPES else 'Exception')

    def addSubTest(self, test, subtest, err):
        if err is not None:
            # Never serialize subtest.id(): its parameters may contain payloads.
            if issubclass(err[0], test.failureException):
                self.addFailure(test, err)
            else:
                self.addError(test, err)

    def addSkip(self, test, reason):
        self.skipped.append((test, ''))
        self.issue(test, 'skip', 'Skipped')

    def addExpectedFailure(self, test, err):
        self.addFailure(test, err)  # Expected failures cannot make acceptance green.

    def addUnexpectedSuccess(self, test):
        self.unexpectedSuccesses.append(test)
        self.issue(test, 'unexpected_success', 'UnexpectedSuccess')

    def stopTest(self, test):
        super().stopTest(test)
        self.save()


def print_summary(summary):
    for issue in summary['issues']:
        print('deploy-test: {test} {outcome} {type}'.format(**issue), flush=True)
    print('deploy-tests: tests={tests} failures={failures} errors={errors} skipped={skipped}'.format(**summary), flush=True)


def main():
    run = Path(os.environ['REMEDIATION_RUN'])
    if run.resolve() != run or not run.is_relative_to(ROOT / '.remediation-runtime'):
        raise ValueError('Unsafe result directory')
    path = run / 'deploy-summary.json'
    suite = unittest.defaultTestLoader.discover(str(ROOT / 'deploy/tests'), pattern='test_*.py')
    result = SafeResult(set(test_ids(suite)), path)
    result.save()
    # No traceback/assertion message/skip reason/stdout from tests is published.
    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
        suite.run(result)
    result.save()
    print_summary(read_summary(path))
    return 0 if result.wasSuccessful() and result.testsRun > 0 and not result.skipped else 1


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception as error:
        kind = type(error).__name__
        print('deploy-suite: error ' + (kind if kind in ERROR_TYPES else 'Exception'), flush=True)
        sys.exit(1)
