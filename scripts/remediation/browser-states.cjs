/*
 * Run AFTER the final production build and isolated services are ready:
 *   node scripts/remediation/browser-states.cjs
 * No matrix rerun. Chrome + real fixture API; route mocks only for fault states.
 * Reports: .remediation-runtime/baseline-v1/browser-states.json
 * Mutations are restored in finally. Run serially with other mutation tests.
 * A killed process cannot run finally: originals remain in *-restore.json for recovery.
 * Never enable Playwright DEBUG/pw:api tracing: credential arguments may be logged.
 * Scope: bilingual six-page SEO + SPA changes, config consumers, description fallback,
 * 404/503/retry/loading/empty/offline/hidden transitions, production media/API paths.
 * Not covered: 72-case visual matrix, real deployment, formal CV, accessibility audit.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium, EXECUTABLE, ROOT, RUN, ORIGIN, BASE, assertFixture } = require('./browser-env.cjs');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function harness(name) {
  assert(!process.env.DEBUG && !process.env.PWDEBUG, 'Debug logging must be disabled');
  const secretPath = path.join(RUN, 'secrets.json');
  assert.equal(fs.realpathSync(secretPath), secretPath);
  assert.equal(fs.realpathSync(path.join(RUN, 'fixture.db')), path.join(RUN, 'fixture.db'));
  const manifest = JSON.parse(fs.readFileSync(path.join(RUN, 'manifest.json'), 'utf8'));
  assertFixture();
  assert.equal(manifest.run, path.basename(RUN));
  assert.deepEqual(Object.keys(manifest.pages), ['home', 'about', 'research', 'projects', 'honors', 'cv', 'test-hidden']);
  const secrets = JSON.parse(fs.readFileSync(secretPath, 'utf8'));
  assert.equal(secrets.ADMIN_USERNAME, 'remediation-test');
  let token;
  let verified = false;
  let browser;
  const results = { suite: name, checks: [], pending: [] };
  let stage = 'fixture-guard';
  const undo = [];
  const journal = [];
  function guard(url) {
    assert.equal(fs.realpathSync(secretPath), secretPath);
    const parsed = new URL(url);
    assert.equal(parsed.origin, ORIGIN);
    assert(parsed.pathname.startsWith('/ha/api/'));
  }
  async function request(method, endpoint, body, options = {}) {
    const url = BASE + '/api' + endpoint;
    guard(url);
    assert(verified || (method === 'GET') || endpoint === '/auth/login');
    // Only synthetic fixture setup/restoration uses this read-before-write helper.
    // Browser requests are never intercepted/retried; explicit stale tokens stay stale.
    if (method === 'PUT' && !options.rawBody && options.withPrecondition !== false) {
      body = { ...body };
      if (endpoint.endsWith('/reorder') && !Object.hasOwn(body, 'expected_previous_order')) {
        let rows = await api('GET', endpoint.startsWith('/admin/pages') ? '/admin/pages' : '/sections');
        if (endpoint === '/sections/reorder') {
          const ids = new Set((body.orders || []).map(row => row.id));
          const pageId = rows.find(row => ids.has(row.id))?.page_id;
          rows = rows.filter(row => row.page_id === pageId);
        }
        body.expected_previous_order = rows.sort((a, b) => a.sort_order - b.sort_order || a.id - b.id).map(row => row.id);
      } else if (!endpoint.endsWith('/reorder') && !Object.hasOwn(body, 'expected_revision')) {
        const row = endpoint === '/site-config' ? await api('GET', endpoint)
          : (await api('GET', endpoint.startsWith('/admin/pages/') ? '/admin/pages' : '/sections'))
            .find(row => row.id === Number(endpoint.split('/').at(-1)));
        assert(row?.revision, 'Fixture update requires a current revision');
        body.expected_revision = row.revision;
      }
    }
    const response = await fetch(url, { method, redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { ...(options.rawBody ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : options.rawBody ? body : JSON.stringify(body) });
    if (options.expectedStatus !== undefined) assert.equal(response.status, options.expectedStatus, 'Unexpected API status');
    else assert(response.ok, 'API status not successful');
    return response;
  }
  async function api(method, endpoint, body) {
    const response = await request(method, endpoint, body);
    return response.status === 204 ? null : response.json();
  }
  token = (await api('POST', '/auth/login', { username: secrets.ADMIN_USERNAME, password: secrets.ADMIN_PASSWORD })).access_token;
  const pages = await api('GET', '/admin/pages');
  for (const [slug, id] of Object.entries(manifest.pages)) {
    assert(pages.some(p => p.slug === slug && p.id === id && p.title_zh.includes('测试')));
  }
  verified = true;
  async function remember(endpoint, original) {
    journal.push({ endpoint, original });
    fs.writeFileSync(path.join(RUN, `${name}-restore.json`), JSON.stringify(journal, null, 2), { mode: 0o600 });
    undo.push(() => api('PUT', endpoint, original));
  }
  function deferCleanup(label, callback) {
    assert(/^[a-z0-9-]+$/.test(label) && typeof callback === 'function');
    undo.push(async () => {
      await callback();
      results.checks.push({ stage: 'cleanup-' + label, status: 'passed' });
    });
  }
  async function check(label, fn) {
    stage = label;
    await fn();
    results.checks.push({ stage: label, status: 'passed' });
  }
  async function wait(fn) {
    for (let i = 0; i < 100; i++) {
      if (await fn()) return;
      await delay(100);
    }
    throw new Error('ConditionTimeout');
  }
  browser = await chromium.launch({ executablePath: EXECUTABLE, headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'zh-CN', serviceWorkers: 'block' });
  context.setDefaultTimeout(12000);
  let badPath = false;
  context.on('request', request => {
    const u = new URL(request.url());
    if (u.origin === ORIGIN && /^\/(api|uploads)(\/|$)/.test(u.pathname)) badPath = true;
  });
  await context.route('**/*', async route => {
    const req = route.request();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method())) {
      try { guard(req.url()); } catch { await route.abort('blockedbyclient'); return; }
    }
    await route.continue();
  });
  async function finish(error) {
    if (error) results.checks.push({ stage, status: 'failed', error: error.name || 'Error' });
    // Continue restoring other resources even if one restoration fails.
    for (const restore of undo.reverse()) {
      try { await restore(); } catch (e) { results.checks.push({ stage: 'restore', status: 'failed', error: e.name || 'Error' }); }
    }
    if (badPath) results.checks.push({ stage: 'no-root-api-or-uploads', status: 'failed', error: 'AssertionError' });
    else results.checks.push({ stage: 'no-root-api-or-uploads', status: 'passed' });
    await browser.close();
    fs.writeFileSync(path.join(RUN, `${name}.json`), JSON.stringify(results, null, 2));
    for (const item of results.checks) console.log(`${item.stage}: ${item.status}${item.error ? ' ' + item.error : ''}`);
    if (results.checks.some(item => item.status === 'failed')) process.exitCode = 1;
  }
  return { api, request, manifest, pages, secrets, context, check, wait, remember, deferCleanup, finish, results, token, guard };
}

async function main() {
  const h = await harness('browser-states');
  const page = await h.context.newPage();
  const zh = JSON.parse(fs.readFileSync(path.join(ROOT, 'frontend/src/locales/zh.json'), 'utf8'));
  const retry = () => page.getByRole('button', { name: zh.publicPage.retry, exact: true });
  const routePath = (slug, locale = 'zh') => BASE + (locale === 'en' ? '/en' : '') + (slug === 'home' ? '/' : '/' + slug);
  const ready = () => page.locator('.public-page').waitFor();
  async function spa(slug, locale = 'zh') {
    const target = new URL(routePath(slug, locale)).pathname;
    const desktopLink = page.locator(`.site-header nav a[href="${target}"]`);
    await desktopLink.waitFor({ state: 'attached' });
    if (await desktopLink.isVisible()) await desktopLink.click();
    else {
      await page.locator('button[aria-controls="mobile-navigation"]').click();
      await page.locator(`.mobile-navigation-dialog[open] a[href="${target}"]`).click();
    }
    await ready();
  }
  let failure;
  try {
    await h.check('six-pages-bilingual-seo-spa', async () => {
      for (const locale of ['zh', 'en']) {
        await page.goto(routePath('home', locale));
        for (const slug of ['home', 'about', 'research', 'projects', 'honors', 'cv']) {
          if (slug !== 'home') await spa(slug, locale);
          const row = h.pages.find(p => p.slug === slug);
          await h.wait(async () => await page.title() === row[`title_${locale}`]);
          await h.wait(async () => await page.locator('meta[name="description"]').getAttribute('content') === row[`meta_description_${locale}`]);
          assert.equal(await page.locator('meta[name="description"]').count(), 1);
        }
      }
    });
    await h.check('config-real-save-consumers-and-seo-fallback', async () => {
      const config = await h.api('GET', '/site-config');
      const keys = ['project_title', 'footer_text', 'logo_url', 'banner_url', 'seo_default_description_zh', 'seo_default_description_en'];
      await h.remember('/site-config', Object.fromEntries(keys.map(k => [k, config[k]])));
      const patch = { project_title: '测试第三批项目配置', footer_text: '测试第三批页脚配置', logo_url: '/uploads/test-avatar.png', banner_url: '/uploads/test-gallery.png', seo_default_description_zh: '测试第三批中文描述回退', seo_default_description_en: 'Test fallback description 测试' };
      await h.api('PUT', '/site-config', patch);
      const row = h.pages.find(p => p.slug === 'about');
      await h.remember(`/admin/pages/${row.id}`, { meta_description_zh: row.meta_description_zh, meta_description_en: row.meta_description_en });
      await h.api('PUT', `/admin/pages/${row.id}`, { meta_description_zh: '', meta_description_en: '' });
      await page.goto(routePath('home'));
      await page.locator('main').getByText(patch.project_title, { exact: true }).waitFor();
      await page.locator('footer').getByText(patch.footer_text, { exact: true }).waitFor();
      const logo = page.locator('header.fixed img[src="/ha/uploads/test-avatar.png"]');
      const banner = page.locator('main img[src="/ha/uploads/test-gallery.png"]');
      await logo.waitFor(); await banner.waitFor();
      assert(await logo.evaluate(img => img.complete && img.naturalWidth > 0));
      assert(await banner.evaluate(img => img.complete && img.naturalWidth > 0));
      for (const locale of ['zh', 'en']) {
        await page.goto(routePath('about', locale));
        await ready();
        await h.wait(async () => await page.locator('meta[name="description"]').getAttribute('content') === patch[`seo_default_description_${locale}`]);
        assert.equal(await page.locator('main img[src="/ha/uploads/test-gallery.png"]').count(), 0);
      }
      for (const slug of ['about', 'research', 'projects', 'honors', 'cv']) {
        await page.goto(routePath(slug)); await ready();
        // Projects legitimately has a gallery using the same source asset.
        assert.equal(await page.locator(`main img[alt="${patch.project_title}"]`).count(), 0);
      }
    });
    await h.check('404-versus-503-retry', async () => {
      await page.goto(BASE + '/test-unknown-path');
      await page.getByRole('heading', { name: zh.publicPage.notFoundTitle, exact: true }).waitFor();
      assert.equal(await retry().count(), 0);
      // URL predicate avoids glob-version ambiguity.
      const match = url => /^\/ha\/api\/pages\/research(?:\/sections)?$/.test(url.pathname);
      await page.route(match, route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"detail":"测试503"}' }));
      await page.goto(routePath('research'));
      await page.getByRole('heading', { name: zh.publicPage.errorTitle, exact: true }).waitFor();
      assert.equal(await page.getByRole('heading', { name: zh.publicPage.notFoundTitle, exact: true }).count(), 0);
      await page.unroute(match);
      await retry().click(); await ready();
    });
    await h.check('slow-loading-and-empty-state', async () => {
      const match = url => /^\/ha\/api\/pages\/honors(?:\/sections)?$/.test(url.pathname);
      let release;
      const gate = new Promise(resolve => { release = resolve; });
      await page.route(match, async route => { await gate; await route.continue(); });
      try {
        await spaLoading('honors');
        await page.locator('main [role="status"]').getByText(zh.common.loading, { exact: true }).waitFor();
      } finally { release(); }
      await ready(); await page.unroute(match);
      await page.route('**/ha/api/pages/honors/sections', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
      await page.reload();
      await page.getByText(zh.publicPage.empty, { exact: true }).waitFor();
      await page.unroute('**/ha/api/pages/honors/sections');
    });
    await h.check('offline-online-retry', async () => {
      await page.goto(routePath('home')); await ready();
      await h.context.setOffline(true);
      try {
        await spaLoading('cv');
        await page.getByRole('heading', { name: zh.publicPage.errorTitle, exact: true }).waitFor();
      } finally { await h.context.setOffline(false); }
      await retry().click(); await ready();
      assert.equal(await page.title(), h.pages.find(p => p.slug === 'cv').title_zh);
    });
    await h.check('hidden-page-no-stale-content', async () => {
      const hidden = h.pages.find(row => row.slug === 'test-hidden');
      assert.equal(hidden.visible, false);
      await h.remember(`/admin/pages/${hidden.id}`, { visible: hidden.visible });
      // Model a real stale navigation menu: load a genuine React Router Link,
      // then unpublish its target on the server before the user clicks it.
      await h.api('PUT', `/admin/pages/${hidden.id}`, { visible: true });
      await page.goto(routePath('research')); await ready();
      const hiddenTarget = new URL(routePath('test-hidden')).pathname;
      const desktopHiddenLink = page.locator(`.site-header nav a[href="${hiddenTarget}"]`);
      await desktopHiddenLink.waitFor({ state: 'attached' });
      const link = await desktopHiddenLink.isVisible() ? desktopHiddenLink : await (async () => {
        await page.locator('button[aria-controls="mobile-navigation"]').click();
        return page.locator(`.mobile-navigation-dialog[open] a[href="${hiddenTarget}"]`);
      })();
      await link.waitFor({ state: 'visible' });
      await h.api('PUT', `/admin/pages/${hidden.id}`, { visible: false });
      assert(await page.locator('main [id^="section-"]').count() > 0);
      for (const suffix of ['', '/sections']) {
        const response = await h.context.request.get(BASE + '/api/pages/test-hidden' + suffix);
        assert.equal(response.status(), 404);
      }
      const match = url => /^\/ha\/api\/pages\/test-hidden(?:\/sections)?$/.test(url.pathname);
      let release;
      const gate = new Promise(resolve => { release = resolve; });
      await page.route(match, async route => { await gate; await route.continue(); });
      await page.evaluate(({ hiddenId, loadingTitle, hiddenTitle }) => {
        const main = document.querySelector('main');
        const evidence = window.__hiddenNavigation = {
          committed: false, samples: 0, preCommitOldFrames: 0,
          staleAfterCommit: 0, hiddenContent: 0,
        };
        const sample = () => {
          // PublicPage's layout effect updates the title in the route commit.
          // URL updates alone are NOT a React commit (RouterProvider transitions).
          if (location.pathname.endsWith('/test-hidden') && document.title === loadingTitle) evidence.committed = true;
          const sections = main.querySelectorAll('[id^="section-"]').length;
          if (evidence.committed && sections) evidence.staleAfterCommit++;
          if (main.querySelector(`#section-${hiddenId}`) || main.textContent.includes(hiddenTitle)
              || main.textContent.includes('测试内容 test-hidden：')) evidence.hiddenContent++;
          evidence.samples++;
        };
        const observer = new MutationObserver(sample);
        observer.observe(main, { childList: true, subtree: true, characterData: true });
        observer.observe(document.head, { childList: true, subtree: true, characterData: true });
        let frameId;
        const frame = () => {
          sample();
          if (!evidence.committed && location.pathname.endsWith('/test-hidden') && main.querySelector('[id^="section-"]')) evidence.preCommitOldFrames++;
          frameId = requestAnimationFrame(frame);
        };
        frameId = requestAnimationFrame(frame);
        window.__stopHiddenNavigation = () => { sample(); observer.disconnect(); cancelAnimationFrame(frameId); return evidence; };
      }, { hiddenId: h.manifest.sections['test-hidden-body'], loadingTitle: zh.common.loading, hiddenTitle: hidden.title_zh });
      try {
        await link.click();
        await page.locator('main [role="status"]').getByText(zh.common.loading, { exact: true }).waitFor();
        assert.equal(new URL(page.url()).pathname, new URL(routePath('test-hidden')).pathname);
        assert.equal(await page.locator('main [id^="section-"]').count(), 0);
        // Hold real API responses across paints; do not depend on network speed.
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        release();
        await page.getByRole('heading', { name: zh.publicPage.notFoundTitle, exact: true }).waitFor();
        assert.equal(await page.locator('main [id^="section-"]').count(), 0);
      } finally {
        release();
        const evidence = await page.evaluate(() => window.__stopHiddenNavigation());
        h.results.hiddenNavigation = evidence;
        await page.unroute(match);
      }
      assert.equal(h.results.hiddenNavigation.committed, true, 'Must observe the SPA route commit without document reload');
      assert.equal(h.results.hiddenNavigation.hiddenContent, 0, 'Hidden content must never enter the DOM');
      assert.equal(h.results.hiddenNavigation.staleAfterCommit, 0, 'No previous sections after the new route commits');
      // Direct URL entry must also deny access, and a fresh menu must omit it.
      await page.goto(routePath('test-hidden'));
      await page.getByRole('heading', { name: zh.publicPage.notFoundTitle, exact: true }).waitFor();
      await page.locator(`.site-header nav a[href="${new URL(routePath('research')).pathname}"]`).waitFor({ state: 'attached' });
      assert.equal(await page.locator('main [id^="section-"]').count(), 0);
      assert.equal(await page.locator('main').getByText(hidden.title_zh, { exact: true }).count(), 0);
      assert.equal(await page.locator(`a[href="${new URL(routePath('test-hidden')).pathname}"]`).count(), 0);
    });
  } catch (e) { failure = e; }
  finally { await h.finish(failure); }
  async function spaLoading(slug) {
    const target = new URL(routePath(slug)).pathname;
    const desktopLink = page.locator(`.site-header nav a[href="${target}"]`);
    await desktopLink.waitFor({ state: 'attached' });
    if (await desktopLink.isVisible()) await desktopLink.click();
    else {
      await page.locator('button[aria-controls="mobile-navigation"]').click();
      await page.locator(`.mobile-navigation-dialog[open] a[href="${target}"]`).click();
    }
  }
}

module.exports = { harness, ROOT, RUN, ORIGIN, BASE, delay };
if (require.main === module) main().catch(error => { console.error(`bootstrap: ${error.name || 'Error'}`); process.exitCode = 1; });
