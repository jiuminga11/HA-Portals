// Shared isolated verification environment. No dotenv, private DB, or token logging.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const ROOT = path.resolve(__dirname, '../..');
const RUNTIME = path.join(ROOT, '.remediation-runtime');
const RUN = path.resolve(process.env.REMEDIATION_RUN || path.join(RUNTIME, 'baseline-v1'));
assert(RUN.startsWith(RUNTIME + path.sep), 'Run must be project-local');
const ORIGIN = process.env.REMEDIATION_ORIGIN || 'http://127.0.0.1:15174';
const parsed = new URL(ORIGIN);
assert(parsed.origin === ORIGIN && parsed.protocol === 'http:' && parsed.hostname === '127.0.0.1' && parsed.port);
assert(!['5174', '8002'].includes(parsed.port), 'Normal local site is outside verification scope');
const BASE = ORIGIN + '/ha';
const PYTHON = process.env.REMEDIATION_PYTHON || (fs.existsSync(path.join(ROOT, 'backend/.venv/bin/python')) ? path.join(ROOT, 'backend/.venv/bin/python') : 'python3');
const IMAGE_PYTHON = process.env.REMEDIATION_IMAGE_PYTHON || 'python3';
function loadPlaywright() {
  const roots = [path.join(__dirname, 'tools/package.json'), __filename, path.join(ROOT, 'frontend/package.json')];
  for (const root of roots) {
    try {
      const requireFrom = createRequire(root);
      return { ...requireFrom('playwright'), testVersion: requireFrom('playwright/package.json').version };
    } catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
  }
  throw new Error('PlaywrightMissing');
}
const playwright = loadPlaywright();
const chromium = playwright.chromium;
const EXECUTABLE = process.env.PLAYWRIGHT_EXECUTABLE_PATH || (fs.existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : chromium.executablePath());
function assertFixture() {
  assert(!process.env.DEBUG && !process.env.PWDEBUG, 'Credential argument logging must be disabled');
  assert.equal(fs.realpathSync(RUN), RUN);
  if (process.env.REMEDIATION_RUN) assert.equal(fs.readFileSync(path.join(RUN, '.synthetic-fixture'), 'utf8'), 'remediation-fixture-v1\n');
  const secretPath = path.join(RUN, 'secrets.json');
  assert.equal(fs.realpathSync(secretPath), secretPath);
  assert.equal(fs.realpathSync(path.join(RUN, 'fixture.db')), path.join(RUN, 'fixture.db'));
  const manifest = JSON.parse(fs.readFileSync(path.join(RUN, 'manifest.json'), 'utf8'));
  assert.equal(manifest.run, path.basename(RUN));
  assert.equal(JSON.parse(fs.readFileSync(secretPath, 'utf8')).ADMIN_USERNAME, 'remediation-test');
  return manifest;
}
function guard(url) {
  assertFixture();
  const value = new URL(url);
  assert.equal(value.origin, ORIGIN);
  assert(value.pathname.startsWith('/ha/api/'));
}
module.exports = { ROOT, RUN, ORIGIN, BASE, PYTHON, IMAGE_PYTHON, EXECUTABLE, chromium, playwright, assertFixture, guard };
