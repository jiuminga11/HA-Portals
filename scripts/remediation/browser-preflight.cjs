// Environment-only Chrome launch/close. No network, API, login, or business checks.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { ROOT, RUN, chromium, EXECUTABLE, playwright } = require('./browser-env.cjs');

(async () => {
  assert(process.versions.node.startsWith('24.'));
  assert.equal(playwright.testVersion, '1.58.2');
  assert(fs.existsSync(EXECUTABLE));
  const directory = process.env.REMEDIATION_BROWSER_TMP;
  assert(directory && process.env.TMPDIR === directory);
  assert.equal(path.dirname(directory), path.join(ROOT, '.browser-tmp'));
  assert(/^[a-f0-9]{6}$/.test(path.basename(directory)));
  assert.equal(fs.realpathSync(directory), directory);
  assert.equal(fs.statSync(directory).mode & 0o777, 0o700);
  assert.equal(fs.statSync(directory).uid, process.getuid());
  const bytes = Buffer.byteLength(directory, 'utf8');
  assert(bytes + 47 <= 107);
  const marker = path.join(directory, '.browser-owner.json');
  assert.equal(fs.realpathSync(marker), marker);
  const workspace = path.dirname(RUN);
  assert.deepEqual(JSON.parse(fs.readFileSync(marker, 'utf8')), {
    uid: process.getuid(), workspace, id: path.basename(workspace), name: path.basename(directory),
  });
  let browser;
  try {
    browser = await chromium.launch({ executablePath: EXECUTABLE, headless: true, args: ['--no-sandbox'], timeout: 30000 });
    assert(browser.isConnected());
  } finally {
    if (browser) await browser.close();
  }
  console.log(`Chrome launch/close preflight passed; TMPDIR UTF-8 bytes=${bytes}; socket reserve=47`);
})().catch(error => {
  console.error(`chrome-launch-preflight: ${error.name || 'Error'}`);
  process.exitCode = 1;
});
