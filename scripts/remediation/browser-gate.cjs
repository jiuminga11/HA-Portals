// Focused final-gate regressions, synthetic fixture only. No secret/error payload logging.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { harness, ROOT, RUN, BASE, ORIGIN } = require('./browser-states.cjs');
(async () => {
  const h = await harness('browser-gate');
  const t = JSON.parse(fs.readFileSync(path.join(ROOT, 'frontend/src/locales/zh.json')));
  const page = await h.context.newPage();
  const exceptions = [];
  page.on('pageerror', error => exceptions.push(error.name));
  let failure;
  try {
    const config = await h.api('GET', '/site-config');
    await h.remember('/site-config', { seo_og_image: config.seo_og_image });
    await h.check('malformed-og-image-never-crashes-public-content', async () => {
      for (const value of ['http://[', 'javascript:alert(1)']) {
        await h.request('PUT', '/site-config', { seo_og_image: value }, { expectedStatus: 400 });
        assert.equal((await h.api('GET', '/site-config')).seo_og_image, config.seo_og_image);
        // Simulate a pre-hardening legacy GET without storing unsafe configuration.
        await page.route('**/ha/api/site-config', route => route.request().method() === 'GET'
          ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...config, seo_og_image: value }) })
          : route.continue());
        await page.goto(BASE + '/research');
        await page.locator('.public-page').waitFor();
        await page.waitForLoadState('networkidle');
        assert.equal(await page.locator('meta[property="og:image"]').count(), 0);
        assert.equal(await page.locator('main h1').count(), 1);
        await page.unroute('**/ha/api/site-config');
      }
      assert.deepEqual(exceptions, []);
    });
    await h.check('valid-local-and-https-og-images-retained', async () => {
      for (const [value, expected] of [['/uploads/test-gallery.png', ORIGIN + '/ha/uploads/test-gallery.png'], ['https://example.invalid/TEST-ONLY.png', 'https://example.invalid/TEST-ONLY.png']]) {
        await h.api('PUT', '/site-config', { seo_og_image: value });
        await page.goto(BASE + '/research');
        await page.locator('meta[property="og:image"]').waitFor({ state: 'attached' });
        assert.equal(await page.locator('meta[property="og:image"]').getAttribute('content'), expected);
      }
    });
    const target = h.pages.find(p => p.slug === 'about');
    const endpoint = `/admin/pages/${target.id}`;
    await h.remember(endpoint, { title_zh: target.title_zh, title_en: target.title_en });
    await h.check('native-page-dialog-401-recovery-keeps-input', async () => {
      await page.goto(BASE + '/admin/login');
      await page.evaluate(token => localStorage.setItem('token', token), h.token);
      await page.goto(BASE + '/admin/pages');
      const row = page.locator('article').filter({ has: page.locator(`a[href="/ha/admin?page_id=${target.id}"]`) });
      await row.getByRole('button', { name: t.admin.edit, exact: true }).click();
      const dialog = page.locator('dialog[open]');
      const field = dialog.getByLabel(t.pages.fields.title_zh, { exact: false });
      const marker = '测试模态框认证恢复';
      await field.fill(marker);
      const invalid = Buffer.from('{"alg":"HS256"}').toString('base64url') + '.'
        + Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 600 })).toString('base64url') + '.invalidsignature';
      await page.evaluate(token => localStorage.setItem('token', token), invalid);
      const rejected = page.waitForResponse(r => new URL(r.url()).pathname === '/ha/api' + endpoint && r.status() === 401);
      await dialog.getByRole('button', { name: t.admin.save, exact: true }).click(); await rejected;
      const reauth = dialog.locator('.auth-recovery-notice[role="alert"] a[target="_blank"]');
      await reauth.waitFor();
      assert.equal(await field.inputValue(), marker);
      const directory = path.join(RUN, 'screenshots/pass3-admin'); fs.mkdirSync(directory, { recursive: true });
      await dialog.screenshot({ path: path.join(directory, 'page-modal-auth-expired.png') });
      let writes = 0;
      const count = request => { if (new URL(request.url()).pathname === '/ha/api' + endpoint && request.method() === 'PUT') writes++; };
      h.context.on('request', count);
      const opened = h.context.waitForEvent('page'); await reauth.click();
      const popup = await opened;
      await popup.waitForURL(url => url.pathname === '/ha/admin/login');
      await popup.locator('input[autocomplete="username"]').fill(h.secrets.ADMIN_USERNAME);
      await popup.locator('input[autocomplete="current-password"]').fill(h.secrets.ADMIN_PASSWORD);
      await popup.locator('button[type="submit"]').click();
      await popup.getByRole('status').waitFor();
      await dialog.locator('.auth-recovery-notice[role="status"]').waitFor();
      assert.equal(await field.inputValue(), marker); assert.equal(writes, 0);
      const saved = page.waitForResponse(r => new URL(r.url()).pathname === '/ha/api' + endpoint && r.request().method() === 'PUT' && r.status() === 200);
      await dialog.getByRole('button', { name: t.admin.save, exact: true }).click(); await saved;
      await dialog.waitFor({ state: 'hidden' });
      assert.equal((await h.api('GET', '/admin/pages')).find(p => p.id === target.id).title_zh, marker);
      assert.equal(writes, 1); h.context.off('request', count); await popup.close();
    });
  } catch (error) { failure = error; }
  finally { await h.finish(failure); }
})().catch(error => { console.error(`bootstrap: ${error.name}`); process.exitCode = 1; });
