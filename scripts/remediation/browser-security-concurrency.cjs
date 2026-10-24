// Synthetic-only security and stale-editor acceptance. Never print tokens or HTML payloads.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHmac } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { harness, ROOT, RUN, BASE } = require('./browser-states.cjs');
const { PYTHON, assertFixture } = require('./browser-env.cjs');

(async () => {
  const h = await harness('browser-security-concurrency');
  const t = JSON.parse(fs.readFileSync(path.join(ROOT, 'frontend/src/locales/zh.json')));
  const message = JSON.parse(fs.readFileSync(path.join(ROOT, 'frontend/src/locales/security.zh.json'))).conflict;
  const sectionId = h.manifest.sections['about-body'];
  const endpoint = `/sections/${sectionId}`;
  const pageId = h.manifest.pages.about;
  let failure;
  try {
    const originalSection = (await h.api('GET', '/sections')).find(s => s.id === sectionId);
    await h.remember(endpoint, { title_zh: originalSection.title_zh, title_en: originalSection.title_en, content: originalSection.content });
    const originalPage = h.pages.find(p => p.id === pageId);
    await h.remember(`/admin/pages/${pageId}`, { title_zh: originalPage.title_zh, title_en: originalPage.title_en });
    const originalConfig = await h.api('GET', '/site-config');
    await h.remember('/site-config', { project_title: originalConfig.project_title });
    const attack = '<p><a id="security-probe" href="jav&#x61;script:window.__securityProbe=1">TEST ONLY</a></p>'
      + '<iframe srcdoc="&lt;script&gt;parent.__securityFrame=1&lt;/script&gt;"></iframe>'
      + '<svg onload="window.__securitySvg=1"></svg><img src="data:image/svg+xml,test" onerror="window.__securityImage=1">';
    const legal = '<h2 id="safe-anchor">TEST HEADING</h2><p class="ql-align-center" style="color:red;text-align:center">'
      + '<strong>TEST BOLD</strong><em>TEST ITALIC</em><u>TEST UNDERLINE</u></p>'
      + '<ol><li data-list="ordered">TEST LIST</li></ol><table><tbody><tr><td colspan="2">TEST CELL</td></tr></tbody></table>'
      + '<a href="#safe-anchor">TEST ANCHOR</a><a href="mailto:test@example.invalid">TEST MAIL</a>'
      + '<a href="/uploads/test-gallery.png"><img src="/uploads/test-gallery.png" alt="TEST IMAGE"></a>';
    const publicPage = await h.context.newPage();
    async function safeDom(target, selector) {
      const scope = target.locator(selector);
      assert.equal(await scope.locator('iframe,svg,math,script,object,embed,[srcdoc],[onerror],[onload]').count(), 0);
      assert(await scope.locator('[href],[src]').evaluateAll(elements => elements.every(el => !/^(?:javascript|data|blob):/i.test(el.getAttribute('href') || el.getAttribute('src') || ''))));
      const probe = scope.locator('#security-probe');
      if (await probe.count()) await probe.click();
      await target.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert(await target.evaluate(() => !window.__securityProbe && !window.__securityFrame && !window.__securitySvg && !window.__securityImage));
    }
    await h.check('parser-sanitized-write-and-legal-content-preservation', async () => {
      const saved = await h.api('PUT', endpoint, { content: { body: attack + legal }, expected_revision: originalSection.revision });
      assert(saved.revision && saved.revision !== originalSection.revision);
      assert(!/srcdoc|<iframe|<svg|onerror|javascript:/i.test(saved.content.body));
      await publicPage.goto(BASE + '/about'); await publicPage.locator('.tech-prose').waitFor();
      await publicPage.addStyleTag({ content: '.reveal,.reveal-x{opacity:1!important;transform:none!important}' });
      await safeDom(publicPage, '.tech-prose');
      for (const selector of ['#safe-anchor', 'strong', 'em', 'u', 'ol li', 'td[colspan="2"]', 'a[href="#safe-anchor"]', 'a[href="mailto:test@example.invalid"]', 'img[src="/ha/uploads/test-gallery.png"]']) {
        assert(await publicPage.locator('.tech-prose').locator(selector).count() > 0);
      }
      assert.equal(await publicPage.locator('.tech-prose .ql-align-center').evaluate(el => el.style.textAlign), 'center');
    });
    await h.check('legacy-unsafe-html-protected-without-automatic-writeback', async () => {
      // The only direct SQL write emulates a pre-hardening legacy row in this
      // guarded synthetic DB; normal API writes above cannot store active HTML.
      assertFixture();
      const source = 'import sqlite3,sys\nwith sqlite3.connect(sys.argv[1]) as db: db.execute("UPDATE section SET content=? WHERE id=?", (sys.argv[2], int(sys.argv[3])))';
      const result = spawnSync(PYTHON, ['-c', source, path.join(RUN, 'fixture.db'), JSON.stringify({ body: attack + legal }), String(sectionId)], { encoding: 'utf8' });
      assert.equal(result.status, 0, 'Synthetic legacy fixture setup failed');
      await publicPage.reload(); await publicPage.locator('.tech-prose').waitFor();
      await publicPage.addStyleTag({ content: '.reveal,.reveal-x{opacity:1!important;transform:none!important}' });
      await safeDom(publicPage, '.tech-prose');
      const editor = await h.context.newPage();
      await editor.goto(BASE + '/admin/login');
      await editor.evaluate(token => localStorage.setItem('token', token), h.token);
      let writes = 0;
      const count = request => { if (new URL(request.url()).pathname === '/ha/api' + endpoint && request.method() === 'PUT') writes++; };
      editor.on('request', count);
      await editor.goto(BASE + `/admin/sections/${sectionId}`); await editor.locator('.ql-editor').waitFor();
      await safeDom(editor, '.ql-editor');
      assert.equal(writes, 0, 'Editor load must not auto-save legacy content');
      assert((await h.api('GET', '/sections')).find(s => s.id === sectionId).content.body.includes('<iframe'));
      const saved = editor.waitForResponse(r => new URL(r.url()).pathname === '/ha/api' + endpoint && r.request().method() === 'PUT' && r.status() === 200);
      await editor.getByRole('button', { name: t.admin.save, exact: true }).click(); await saved;
      await editor.getByRole('status').filter({ hasText: t.admin.saved }).waitFor();
      const body = (await h.api('GET', '/sections')).find(s => s.id === sectionId).content.body;
      assert(!body.includes('<iframe')); assert(body.includes('TEST CELL') && body.includes('safe-anchor'));
      editor.off('request', count); await editor.close();
    });
    await h.check('two-section-editors-conflict-retains-losing-input', async () => {
      const [a, b] = await Promise.all([h.context.newPage(), h.context.newPage()]);
      for (const tab of [a, b]) { await tab.goto(BASE + `/admin/sections/${sectionId}`); await tab.getByLabel(t.admin.titleZh, { exact: true }).waitFor(); }
      await a.getByLabel(t.admin.titleZh, { exact: true }).fill('测试并发甲');
      await b.getByLabel(t.admin.titleZh, { exact: true }).fill('测试并发乙');
      const first = a.waitForResponse(r => new URL(r.url()).pathname === '/ha/api' + endpoint && r.request().method() === 'PUT' && r.status() === 200);
      await a.getByRole('button', { name: t.admin.save, exact: true }).click(); await first;
      const conflict = b.waitForResponse(r => new URL(r.url()).pathname === '/ha/api' + endpoint && r.status() === 409);
      await b.getByRole('button', { name: t.admin.save, exact: true }).click(); await conflict;
      await b.getByRole('alert').filter({ hasText: message }).waitFor();
      assert.equal(await b.getByLabel(t.admin.titleZh, { exact: true }).inputValue(), '测试并发乙');
      assert.equal((await h.api('GET', '/sections')).find(s => s.id === sectionId).title_zh, '测试并发甲');
    });
    await h.check('two-page-dialogs-conflict-retains-losing-input', async () => {
      const [a, b] = await Promise.all([h.context.newPage(), h.context.newPage()]);
      for (const tab of [a, b]) {
        await tab.goto(BASE + '/admin/pages');
        const row = tab.locator('article').filter({ has: tab.locator(`a[href="/ha/admin?page_id=${pageId}"]`) });
        await row.getByRole('button', { name: t.admin.edit, exact: true }).click();
      }
      const field = tab => tab.locator('dialog[open]').getByLabel(t.pages.fields.title_zh, { exact: false });
      await field(a).fill('测试页面并发甲'); await field(b).fill('测试页面并发乙');
      const first = a.waitForResponse(r => new URL(r.url()).pathname === `/ha/api/admin/pages/${pageId}` && r.status() === 200);
      await a.locator('dialog[open]').getByRole('button', { name: t.admin.save, exact: true }).click(); await first;
      const conflict = b.waitForResponse(r => new URL(r.url()).pathname === `/ha/api/admin/pages/${pageId}` && r.status() === 409);
      await b.locator('dialog[open]').getByRole('button', { name: t.admin.save, exact: true }).click(); await conflict;
      await b.locator('dialog[open]').getByRole('alert').filter({ hasText: message }).waitFor();
      assert.equal(await field(b).inputValue(), '测试页面并发乙');
      assert.equal((await h.api('GET', '/admin/pages')).find(p => p.id === pageId).title_zh, '测试页面并发甲');
    });
    await h.check('two-settings-editors-conflict-retains-losing-input', async () => {
      const [a, b] = await Promise.all([h.context.newPage(), h.context.newPage()]);
      const field = tab => tab.getByLabel(t.settings.labels.project_title, { exact: false });
      for (const tab of [a, b]) { await tab.goto(BASE + '/admin/site-settings'); await field(tab).waitFor(); }
      await field(a).fill('测试配置并发甲'); await field(b).fill('测试配置并发乙');
      const first = a.waitForResponse(r => new URL(r.url()).pathname === '/ha/api/site-config' && r.request().method() === 'PUT' && r.status() === 200);
      await a.getByRole('button', { name: t.admin.save, exact: true }).click(); await first;
      const conflict = b.waitForResponse(r => new URL(r.url()).pathname === '/ha/api/site-config' && r.status() === 409);
      await b.getByRole('button', { name: t.admin.save, exact: true }).click(); await conflict;
      await b.getByRole('alert').filter({ hasText: message }).waitFor();
      assert.equal(await field(b).inputValue(), '测试配置并发乙');
      assert.equal((await h.api('GET', '/site-config')).project_title, '测试配置并发甲');
    });
    await h.check('http-invalid-signed-claims-and-algorithms-return-401', async () => {
      const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
      const makeToken = (payload, algorithm = 'HS256', key = h.secrets.JWT_SECRET_KEY) => {
        const unsigned = encode({ alg: algorithm, typ: 'JWT' }) + '.' + encode(payload);
        return unsigned + '.' + createHmac(algorithm === 'HS384' ? 'sha384' : 'sha256', key).update(unsigned).digest('base64url');
      };
      const valid = { sub: h.secrets.ADMIN_USERNAME, exp: Math.floor(Date.now() / 1000) + 600 };
      const invalid = [{}, { ...valid, exp: null }, { ...valid, exp: true }, { ...valid, exp: 1 }, { ...valid, sub: 'not-admin' }].map(value => makeToken(value));
      invalid.push(makeToken(valid, 'HS384'), makeToken(valid, 'HS256', 'wrong-test-key'));
      for (const token of invalid) for (const endpoint of ['/admin/pages', '/sections']) {
        const url = BASE + '/api' + endpoint; h.guard(url);
        const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        assert.equal(response.status, 401, 'Invalid token must be a controlled 401');
      }
    });
    h.results.pending.push('Legacy clients omitting expected_revision retain unconditional writes; this is not global conflict prevention.');
  } catch (error) { failure = error; }
  finally { await h.finish(failure); }
})().catch(error => { console.error(`bootstrap: ${error.name}`); process.exitCode = 1; });
