/*
 * Run serially, AFTER final build: node scripts/remediation/browser-admin.cjs
 * Uses browser-states.cjs safety harness and ONLY baseline-v1 synthetic fixture.
 * Reports browser-admin.json and recovery journal in baseline-v1 runtime.
 * No credentials, token, DOM dump, request payload, trace, or login screenshot output.
 * Scope: real login, dirty cancel/sidebar/back/native beforeunload, 503 retention,
 * real signature-invalid 401, second-tab login/storage recovery/manual save,
 * expired admission and >10s held-login abort/late-response isolation.
 * Not covered: SiteSettings/PageManager dirty/home controls (main acceptance owner),
 * duplicate bilingual/create tests, crash-proof restoration, full browser matrix.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { harness, ROOT, BASE, delay } = require('./browser-states.cjs');

async function main() {
  const h = await harness('browser-admin');
  const page = await h.context.newPage();
  const t = JSON.parse(fs.readFileSync(path.join(ROOT, 'frontend/src/locales/zh.json'), 'utf8'));
  const sectionId = h.manifest.sections['about-body'];
  assert(Number.isInteger(sectionId));
  const endpoint = `/sections/${sectionId}`;
  const editor = BASE + `/admin/sections/${sectionId}?page_id=${h.manifest.pages.about}`;
  const title = () => page.getByLabel(t.admin.titleZh, { exact: true });
  const save = () => page.getByRole('button', { name: t.admin.save, exact: true });
  const marker = '测试第三批未保存与恢复';
  async function login(target) {
    assert.equal(new URL(target.url()).origin, new URL(BASE).origin);
    assert(new URL(target.url()).pathname === '/ha/admin/login');
    // Catch only at suite boundary: Playwright errors can contain fill arguments.
    await target.locator('input[autocomplete="username"]').fill(h.secrets.ADMIN_USERNAME);
    await target.locator('input[autocomplete="current-password"]').fill(h.secrets.ADMIN_PASSWORD);
    await target.locator('button[type="submit"]').click();
  }
  async function retained() { assert.equal(await title().inputValue(), marker); }
  async function dismissNavigation(action, type = 'confirm') {
    let observed = false;
    const handler = async dialog => { observed = dialog.type() === type; await dialog.dismiss(); };
    page.once('dialog', handler);
    try { await action(); await h.wait(async () => observed); }
    finally { page.off('dialog', handler); }
    await retained();
    assert(new URL(page.url()).pathname.endsWith(`/sections/${sectionId}`));
  }
  let failure;
  try {
    const original = (await h.api('GET', '/sections')).find(s => s.id === sectionId);
    assert(original && original.title_zh.includes('测试'));
    await h.remember(endpoint, { title_zh: original.title_zh, title_en: original.title_en, content: original.content, visible: original.visible });
    await h.check('real-login-ui', async () => {
      await page.goto(BASE + '/admin/login');
      await login(page);
      await page.waitForURL(url => url.pathname === '/ha/admin');
      assert(await page.evaluate(() => Boolean(localStorage.getItem('token'))));
    });
    await h.check('dirty-cancel-sidebar-back-confirm', async () => {
      // Create known same-document history using the real dashboard edit button.
      await page.getByText(original.title_zh, { exact: true })
        .locator(`xpath=ancestor::div[.//button[@aria-label="${t.admin.edit}"]][1]`)
        .getByRole('button', { name: t.admin.edit, exact: true }).click();
      await title().waitFor();
      await title().fill(marker);
      await dismissNavigation(() => page.getByRole('button', { name: t.admin.cancel, exact: true }).click());
      await dismissNavigation(() => page.locator('a[href="/ha/admin/site-settings"]').first().click());
       await dismissNavigation(() => page.evaluate(() => history.back()));
       const tokenBeforeCancelledLogout = await page.evaluate(() => localStorage.getItem('token'));
       await dismissNavigation(() => page.getByRole('button', { name: '退出登录', exact: true }).click());
       assert.equal(await page.evaluate(() => localStorage.getItem('token')), tokenBeforeCancelledLogout);
    });
    await h.check('native-beforeunload-dismiss-retains', async () => {
      // User gesture above satisfies Chrome's sticky activation requirement.
      await dismissNavigation(async () => {
        await page.evaluate(() => { setTimeout(() => location.reload(), 0); });
      }, 'beforeunload');
    });
    await h.check('save-503-retains-input', async () => {
      const match = url => url.pathname === '/ha/api' + endpoint;
      await page.route(match, route => route.request().method() === 'PUT'
        ? route.fulfill({ status: 503, contentType: 'application/json', body: '{"detail":"测试保存失败"}' }) : route.continue());
      const response = page.waitForResponse(r => new URL(r.url()).pathname === '/ha/api' + endpoint && r.status() === 503);
      await save().click(); await response;
      await h.wait(async () => await save().isEnabled());
      await retained();
      await page.unroute(match);
      assert.equal((await h.api('GET', '/sections')).find(s => s.id === sectionId).title_zh, original.title_zh);
    });
    await h.check('real-401-tab-login-storage-recovery-manual-save', async () => {
      const invalid = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url') + '.'
        + Buffer.from(JSON.stringify({ sub: 'remediation-test', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url') + '.invalidsignature';
      await page.evaluate(value => localStorage.setItem('token', value), invalid);
      const denied = page.waitForResponse(r => new URL(r.url()).pathname === '/ha/api' + endpoint && r.status() === 401);
      await save().click(); await denied;
      await retained();
      const reauth = page.locator('[role="alert"] a[target="_blank"][href*="reauth=1"]');
      await reauth.waitFor();
      let mutations = 0;
      const listener = req => { if (new URL(req.url()).pathname === '/ha/api' + endpoint && ['POST', 'PUT', 'PATCH'].includes(req.method())) mutations++; };
      h.context.on('request', listener);
      const popupPromise = h.context.waitForEvent('page');
      await reauth.click();
      const popup = await popupPromise;
      await popup.waitForURL(url => url.pathname === '/ha/admin/login');
      await login(popup);
      await popup.getByRole('status').waitFor();
      await page.locator('.auth-recovery-notice[role="status"]').waitFor();
      await delay(600);
      assert.equal(mutations, 0);
      await retained();
      assert.equal((await h.api('GET', '/sections')).find(s => s.id === sectionId).title_zh, original.title_zh);
      const saved = page.waitForResponse(r => new URL(r.url()).pathname === '/ha/api' + endpoint && r.request().method() === 'PUT' && r.status() === 200);
      await save().click(); await saved;
      assert.equal((await h.api('GET', '/sections')).find(s => s.id === sectionId).title_zh, marker);
      assert.equal(mutations, 1);
      h.context.off('request', listener);
       await popup.close();
     });
     await h.check('confirmed-clean-logout-clears-auth', async () => {
       await page.getByRole('button', { name: '退出登录', exact: true }).click();
       await page.waitForURL(url => url.pathname === '/ha/admin/login' && !url.searchParams.has('logout'));
       assert.equal(await page.evaluate(() => localStorage.getItem('token')), null);
     });
    await h.check('expired-on-entry-goes-to-login', async () => {
      const expired = Buffer.from('{"alg":"HS256"}').toString('base64url') + '.' + Buffer.from('{"exp":1}').toString('base64url') + '.invalidsignature';
      await page.evaluate(value => localStorage.setItem('token', value), expired);
      await page.goto(editor);
      await page.waitForURL(url => url.pathname === '/ha/admin/login');
      assert.equal(await page.getByLabel(t.admin.titleZh, { exact: true }).count(), 0);
    });
    await h.check('login-10s-abort-and-late-response-isolation', async () => {
      await page.evaluate(() => localStorage.removeItem('token'));
      await page.goto(BASE + '/admin/login');
      let release;
      const gate = new Promise(resolve => { release = resolve; });
      let intercepted = false;
      let aborted = false;
      let routeFailure = false;
      const match = url => url.pathname === '/ha/api/auth/login';
      const failed = req => { if (new URL(req.url()).pathname === '/ha/api/auth/login') aborted = true; };
      page.on('requestfailed', failed);
      await page.route(match, async route => {
        h.guard(route.request().url());
        intercepted = true;
        // A genuine successful API login response is held beyond the client timer.
        try {
          const response = await route.fetch();
          await gate;
          try { await route.fulfill({ response }); } catch { /* Expected when AbortController cancelled this request. */ }
        } catch {
          routeFailure = true;
          await route.abort().catch(() => { /* Request may already be cancelled. */ });
        }
      });
      try {
        await login(page);
        await h.wait(async () => intercepted);
        await delay(10500);
        await page.getByRole('alert').waitFor();
        assert(await page.locator('button[type="submit"]').isEnabled());
        assert.equal(await page.evaluate(() => localStorage.getItem('token')), null);
        assert.equal(new URL(page.url()).pathname, '/ha/admin/login');
        release();
        await delay(1500);
        assert.equal(routeFailure, false);
        assert.equal(await page.evaluate(() => localStorage.getItem('token')), null);
        assert.equal(new URL(page.url()).pathname, '/ha/admin/login');
        h.results.checks.push({ stage: 'login-request-abort-observation', status: aborted ? 'passed' : 'not-observed-late-result-isolated' });
      } finally {
        release();
        await page.unroute(match);
        page.off('requestfailed', failed);
      }
    });
    h.results.pending.push('SiteSettings/PageManager dirty confirmations and home disabled controls remain main-session checks');
  } catch (e) { failure = e; }
  finally { await h.finish(failure); }
}

main().catch(error => { console.error(`bootstrap: ${error.name || 'Error'}`); process.exitCode = 1; });
