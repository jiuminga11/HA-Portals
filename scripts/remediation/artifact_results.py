"""Field-by-field, type-checked public evidence. Never copy whole child JSON/logs."""
import json
import math
from pathlib import Path
import re

TOOLS = Path(__file__).resolve().parent
SLUGS = {'home', 'about', 'research', 'projects', 'honors', 'cv'}
ERRORS = {'Error', 'AssertionError', 'TypeError', 'ValueError', 'RuntimeError', 'ReferenceError',
          'SyntaxError', 'TimeoutError', 'NotAllowedError', 'AbortError', 'HTTPError', 'URLError'}
STATUSES = {'passed', 'failed', 'skipped', 'pending', 'measured', 'not-observed-late-result-isolated'}
HARNESSES = ['browser-states', 'browser-admin', 'browser-settings-files', 'browser-gate',
             'browser-avatar', 'browser-public-experience', 'browser-admin-experience',
             'browser-security-concurrency']


def read_json(directory, name):
    file = directory / name
    if not file.exists():
        return None
    if file.is_symlink() or file.resolve() != file or file.stat().st_size > 10 * 1024 * 1024:
        raise ValueError('Unsafe child evidence file')
    value = json.loads(file.read_text())
    if not isinstance(value, dict):
        raise ValueError('Unexpected child evidence shape')
    return value


def number(value, maximum=10**12):
    return type(value) in (int, float) and math.isfinite(value) and 0 <= value <= maximum


def error_name(value):
    name = value.get('name') if isinstance(value, dict) else value
    return name if isinstance(name, str) and name in ERRORS else 'Error'


def allowed(value, values):
    return isinstance(value, str) and value in values


def known_text(script):
    """Only literal, repository-owned stage/check names; never trust result text."""
    source = TOOLS / script
    if not source.is_file():
        return set(), set()
    text = source.read_text()
    stages = set(re.findall(r"\b(?:h\.)?check\(\s*['\"]([a-z0-9-]+)['\"]", text))
    stages.update(re.findall(r"\bstage:\s*['\"]([a-z0-9-]+)['\"]", text))
    stages.update('cleanup-' + name for name in re.findall(r"deferCleanup\(\s*['\"]([a-z0-9-]+)['\"]", text))
    stages.update({'restore', 'no-root-api-or-uploads', 'cleanup-created-file', 'cleanup-created-page'})
    checks = set(re.findall(r"\.checks\.push\('([^'\n]*)'\)", text))
    return stages, checks


def checks_only(data, script):
    stages, texts = known_text(script)
    safe = []
    unknown = 0
    for check in data.get('checks', []) if isinstance(data.get('checks'), list) else []:
        if isinstance(check, str) and check in texts:
            safe.append({'check': check, 'status': 'passed'})
        elif isinstance(check, dict) and isinstance(check.get('stage'), str) and check['stage'] in stages:
            row = {'stage': check['stage'], 'status': check.get('status') if allowed(check.get('status'), STATUSES) else 'unknown'}
            if 'error' in check:
                row['error'] = error_name(check['error'])
            safe.append(row)
        else:
            unknown += 1
    result = {'checks': safe, 'checkCount': len(safe), 'unrecognizedCheckCount': unknown}
    if allowed(data.get('status'), STATUSES):
        result['status'] = data['status']
    if 'error' in data:
        result['error'] = error_name(data['error'])
    return result


def matrix_only(data):
    rows = []
    for row in data.get('matrix', []) if isinstance(data.get('matrix'), list) else []:
        if not isinstance(row, dict):
            continue
        safe = {}
        for key, allowed in [('locale', {'zh', 'en'}), ('slug', SLUGS), ('theme', {'light', 'dark'}), ('lang', {'zh-CN', 'en'})]:
            if isinstance(row.get(key), str) and row[key] in allowed:
                safe[key] = row[key]
        for key, maximum in [('width', 10000), ('h1', 100)]:
            if type(row.get(key)) is int and number(row[key], maximum):
                safe[key] = row[key]
        if row.get('rootFontSize') in ('16px', '18px', '20px'):
            safe['rootFontSize'] = row['rootFontSize']
        if type(row.get('overflow')) is bool:
            safe['overflow'] = row['overflow']
        if safe:
            rows.append(safe)
    return rows


def contrast_only(data):
    groups = []
    names = {'page heading', 'body paragraph', 'metric value', 'metric explanation', 'first rich-text link'}
    for group in data.get('results', []) if isinstance(data.get('results'), list) else []:
        if not isinstance(group, dict):
            continue
        if (group.get('page') not in ('research', 'cv') or group.get('theme') not in
                ('teal-amber', 'deep-indigo', 'forest-terracotta') or group.get('mode') not in ('light', 'dark')):
            continue
        safe = {key: group[key] for key in ['page', 'theme', 'mode']}
        if number(group.get('viewportWidth'), 10000):
            safe['viewportWidth'] = group['viewportWidth']
        safe['values'] = []
        for point in group.get('values', []) if isinstance(group.get('values'), list) else []:
            if not isinstance(point, dict) or not isinstance(point.get('name'), str) or point['name'] not in names:
                continue
            value = {'name': point['name']}
            if point.get('status') in ('measured', 'skipped'):
                value['status'] = point['status']
            for key, maximum in [('minimumContrast', 21), ('sampledDistinctBackgroundColors', 10**8)]:
                if number(point.get(key), maximum):
                    value[key] = point[key]
            for key in ['foreground', 'worstBackground']:
                color = point.get(key)
                if isinstance(color, list) and len(color) == 3 and all(number(component, 255) for component in color):
                    value[key] = color
            for key in ['meetsNormalTextReference4_5', 'meetsLargeTextReference3']:
                if type(point.get(key)) is bool:
                    value[key] = point[key]
            if isinstance(point.get('fontSize'), str) and re.fullmatch(r'\d{1,3}(?:\.\d{1,4})?px', point['fontSize']):
                value['fontSize'] = point['fontSize']
            if isinstance(point.get('fontWeight'), str) and re.fullmatch(r'[1-9]\d{0,2}', point['fontWeight']):
                value['fontWeight'] = point['fontWeight']
            safe['values'].append(value)
        groups.append(safe)
    result = {'groups': groups}
    if data.get('status') in ('passed', 'failed'):
        result['status'] = data['status']
    if isinstance(data.get('errors'), list):
        result['errors'] = [{'name': error_name(error)} for error in data['errors']]
    return result


def performance_only(data):
    result = checks_only(data, 'browser-a11y-performance.cjs')
    performance = data.get('performance')
    if not isinstance(performance, dict):
        return result
    safe = {}
    for key in ['sampledAtMs', 'jsRequests', 'jsEncodedBodySize', 'jsTransferSize', 'observedLcpMs', 'observedCls']:
        if number(performance.get(key)):
            safe[key] = performance[key]
        elif key in ('observedLcpMs', 'observedCls') and performance.get(key) is None:
            safe[key] = None
    viewport = performance.get('viewport')
    if isinstance(viewport, dict):
        safe['viewport'] = {key: viewport[key] for key in ['width', 'height'] if number(viewport.get(key), 10000)}
    if isinstance(performance.get('media'), list):
        safe['mediaCount'] = len(performance['media'])
    result['performance'] = safe
    return result


def collect_results(workspace):
    run = workspace / 'fixture'
    result = {}
    for name in HARNESSES:
        data = read_json(run, name + '.json')
        if data is not None:
            result[name] = checks_only(data, name + '.cjs')
    for name, script in [('pass3-browser', 'browser-public.cjs'), ('core-browser', 'browser-pass1.cjs'), ('reading-browser', 'browser-reading.cjs')]:
        data = read_json(run, name + '.json')
        if data is not None:
            result[name] = checks_only(data, script)
            if name != 'reading-browser':
                result[name]['matrix'] = matrix_only(data)
    data = read_json(run, 'contrast.json')
    if data is not None:
        result['contrast'] = contrast_only(data)
    data = read_json(run, 'browser-a11y-performance.json')
    if data is not None:
        result['browser-a11y-performance'] = performance_only(data)
    data = read_json(run, 'backend-summary.json')
    if data is not None:
        result['backend'] = {key: data[key] for key in ['tests', 'failures', 'errors', 'skipped'] if type(data.get(key)) is int and number(data[key])}
    for name, pattern in [('auth-test', r'Auth session checks passed: (\d+)'),
                          ('routing-test', r'Routing checks passed: (\d+)'),
                          ('content-test', r'Content preservation checks passed: (\d+)')]:
        log = workspace / 'logs' / (name + '.log')
        if log.is_file() and not log.is_symlink() and log.resolve() == log and log.stat().st_size < 1024 * 1024:
            matches = re.findall(pattern, log.read_text(errors='replace'))
            if matches:
                result[name] = {'checkCount': int(matches[-1])}
    return result
