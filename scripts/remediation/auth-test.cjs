// Exercise the actual authSession module with isolated storage/events and a fixed clock.
// No application server, real credentials, browser storage, or database is touched.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const frontend = path.resolve(__dirname, '../../frontend');
const ts = createRequire(path.join(frontend, 'package.json'))('typescript');
const now = 1800000000000;
let checks = 0;

function equal(actual, expected, label) {
  assert.deepEqual(actual, expected, label);
  checks++;
}

function token(payload, header = { alg: 'HS256', typ: 'JWT' }) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  // A synthetic signature: these tests assert client-side structure/expiry, not JWT verification.
  return `${encode(header)}.${encode(payload)}.fixtureSignature`;
}

function fixture(base) {
  const values = new Map();
  const handlers = new Map();
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
  const cache = new Map();
  function load(file) {
    if (!path.extname(file)) file += '.ts';
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const source = fs.readFileSync(file, 'utf8').replaceAll('import.meta.env.BASE_URL', JSON.stringify(`${base}/`));
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    vm.runInNewContext(`(function(require, module, exports) { ${code}\n })`, {
      atob, URL, Date: { now: () => now }, localStorage: storage,
      window: { addEventListener: (type, handler) => handlers.set(type, handler) },
    })((id) => {
      assert.ok(id.startsWith('.'), `Unexpected dependency: ${id}`);
      return load(path.resolve(path.dirname(file), id));
    }, module, module.exports);
    return module.exports;
  }
  const auth = load(path.join(frontend, 'src/lib/authSession.ts'));
  return {
    auth, storage,
    emit: (overrides = {}) => handlers.get('storage')({ key: 'token', storageArea: storage, ...overrides }),
  };
}

for (const base of ['', '/ha']) {
  const { auth, storage, emit } = fixture(base);
  const old = token({ exp: now / 1000 + 60, sub: 'old' });
  const fresh = token({ exp: now / 1000 + 120, sub: 'fresh' });
  equal(auth.isTokenValid(old), true, 'unexpired structured token');
  for (const invalid of [
    null, '', 'broken', 'a.b.c', `${old}.extra`, old.replace(/\.[^.]+$/, '.'),
    token({ exp: now / 1000 - 1 }), token({ exp: now / 1000 }),
    token({}), token({ exp: String(now / 1000 + 60) }), token({ exp: null }),
    token(null), token([]), token({ exp: now / 1000 + 60 }, { alg: 'none' }),
    token({ exp: now / 1000 + 60 }, {}), token({ exp: now / 1000 + 60 }, null),
  ]) equal(auth.isTokenValid(invalid), false, 'invalid/expired token rejected');

  for (const unsafe of [
    null, '', 'https://evil.example/admin', 'http://evil.example/admin', '//evil.example/admin',
    'javascript:alert(1)', '/\\evil.example', '/admin/\\evil.example',
    '/admin/%5cevil.example', '/admin/%5Cevil.example', '/%2f%2fevil.example',
    '/admin/%0aevil', '/admin/%00evil', '/admin/%', '/admin/../../outside',
    '/public', '/administrator', '/admin/login', '/admin/login?returnTo=/admin',
    '/admin/%6cogin', `${base}/admin/login`, '/admin/../outside',
  ]) equal(auth.safeReturnTo(unsafe), '/admin', 'unsafe destination rejected');
  equal(auth.safeReturnTo('/admin/sections/2?x=1#part'), '/admin/sections/2?x=1#part', 'admin destination retained');
  equal(auth.safeReturnTo(`${base}/admin/sections/2?x=1#part`), '/admin/sections/2?x=1#part', 'basename removed once');

  let notifications = 0;
  const unsubscribe = auth.subscribeAuthRecovery(() => notifications++);
  equal(auth.getAuthRecoveryStatus(), 'active', 'initial status');
  auth.setAuthToken(old);
  auth.setAuthToken(fresh);
  auth.expireAuthSession(old);
  auth.expireAuthSession(null);
  equal(storage.getItem('token'), fresh, 'late old/tokenless 401 cannot remove newer token');
  equal(auth.getAuthRecoveryStatus(), 'active', 'late 401 cannot mark newer session expired');
  equal(notifications, 0, 'late 401 does not notify');

  auth.expireAuthSession(fresh);
  auth.expireAuthSession(fresh);
  auth.expireAuthSession(null);
  equal(storage.getItem('token'), null, 'matching failed token removed');
  equal(auth.getAuthRecoveryStatus(), 'expired', 'expired status');
  equal(notifications, 1, 'concurrent/repeated expiry coalesced');

  storage.setItem('token', fresh);
  emit({ key: 'unrelated' });
  emit({ storageArea: {} });
  equal(auth.getAuthRecoveryStatus(), 'expired', 'unrelated storage events ignored');
  equal(notifications, 1, 'unrelated storage events do not notify');
  emit({ newValue: null });
  equal(auth.getAuthRecoveryStatus(), 'restored', 'storage restore uses current token, not stale event payload');
  equal(notifications, 2, 'restore publishes once');
  auth.expireAuthSession(old);
  equal(storage.getItem('token'), fresh, 'old 401 after storage restoration keeps new token');
  equal(auth.getAuthRecoveryStatus(), 'restored', 'old 401 preserves restored status');
  equal(notifications, 2, 'old 401 after restoration is silent');

  storage.removeItem('token');
  emit({ key: null });
  emit({ key: null });
  equal(auth.getAuthRecoveryStatus(), 'expired', 'cross-tab clear expires session');
  equal(notifications, 3, 'duplicate clear events coalesced');
  storage.setItem('token', 'invalid');
  emit();
  equal(auth.getAuthRecoveryStatus(), 'expired', 'invalid cross-tab token cannot restore');
  assert.throws(() => auth.setAuthToken('invalid'), /Invalid authentication token/);
  checks++;
  equal(storage.getItem('token'), 'invalid', 'invalid setAuthToken does not overwrite storage');
  auth.setAuthToken(fresh);
  equal(auth.getAuthRecoveryStatus(), 'restored', 'same-tab login also restores');
  equal(notifications, 4, 'same-tab restoration notifies');
  unsubscribe();
  auth.expireAuthSession(fresh);
  equal(notifications, 4, 'unsubscribe removes listener');
}

console.log(`Auth session checks passed: ${checks} (root and /ha basenames)`);
