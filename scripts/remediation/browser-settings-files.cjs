/*
 * AFTER final production build, run serially with all other mutation suites:
 *   node scripts/remediation/browser-settings-files.cjs
 * Reuses baseline-v1 guard/login API/restore harness. Never enable DEBUG/PWDEBUG.
 * Results: baseline-v1/browser-settings-files.json; originals: *-restore.json;
 * creation intents/cleanup: *-created.json; screenshots: screenshots/pass3-admin/.
 * Scope: real settings UI save, preview isolation, 503/dirty/load-failure safety;
 * page home guards, modal cancel/Escape/503, real update/create-visible contract;
 * real TEST ONLY PDF upload, /ha/ download bytes, clipboard success/failure.
 * finally restores edited originals and deletes ONLY uniquely named new records.
 * Forced termination cannot run finally: use the runtime journals for recovery.
 * Not a formal CV; no real data, deployment, matrix, or PDF viewer visual audit.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { harness, ROOT, RUN, ORIGIN, BASE, delay } = require('./browser-states.cjs');

async function main() {
  const h = await harness('browser-settings-files');
  const page = await h.context.newPage();
  const t = JSON.parse(fs.readFileSync(path.join(ROOT, 'frontend/src/locales/zh.json'), 'utf8'));
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const slug = `test-pass3-${suffix}`;
  const filename = `TEST-ONLY-NOT-A-CV-${suffix}.pdf`;
  const journalPath = path.join(RUN, 'browser-settings-files-created.json');
  const journal = { slug, filename, createdPageId: null, uploadedFileId: null, cleanup: [] };
  const writeJournal = () => fs.writeFileSync(journalPath, JSON.stringify(journal, null, 2), { mode: 0o600 });
  const shots = path.join(RUN, 'screenshots/pass3-admin');
  fs.mkdirSync(shots, { recursive: true });
  const save = () => page.getByRole('button', { name: t.admin.save, exact: true });
  const settingsInput = key => page.getByLabel(t.settings.labels[key], { exact: false });
  const modal = () => page.locator('dialog[open]');
  const responseFor = (endpoint, method, status) => page.waitForResponse(response =>
    new URL(response.url()).pathname === '/ha/api' + endpoint && response.request().method() === method && response.status() === status);
  let settingsPuts = 0;
  h.context.on('request', req => {
    if (new URL(req.url()).pathname === '/ha/api/site-config' && req.method() === 'PUT') settingsPuts++;
  });
  async function dismissConfirm(action) {
    let seen = false;
    const handler = async dialog => { seen = dialog.type() === 'confirm'; await dialog.dismiss(); };
    page.once('dialog', handler);
    try { await action(); await h.wait(async () => seen); }
    finally { page.off('dialog', handler); }
  }
  async function mock503(endpoint, method) {
    const match = url => url.pathname === '/ha/api' + endpoint;
    await page.route(match, async route => {
      if (route.request().method() === method) {
        h.guard(route.request().url());
        await route.fulfill({ status: 503, contentType: 'application/json', body: '{"detail":"测试503"}' });
      } else await route.continue();
    });
    return () => page.unroute(match);
  }
  async function deleteCreated(endpoint) {
    const url = BASE + '/api' + endpoint;
    h.guard(url);
    const response = await fetch(url, { method: 'DELETE', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${h.token}` } });
    assert(response.ok, 'Created-record cleanup failed'); // File DELETE is 204, no JSON body.
  }
  let failure;
  let pageIntent = false;
  let uploadIntent = false;
  try {
    await h.check('settings-files-real-login', async () => {
      await page.goto(BASE + '/admin/login');
      assert.equal(new URL(page.url()).origin, ORIGIN);
      await page.locator('input[autocomplete="username"]').fill(h.secrets.ADMIN_USERNAME);
      await page.locator('input[autocomplete="current-password"]').fill(h.secrets.ADMIN_PASSWORD);
      await page.locator('button[type="submit"]').click();
      await page.waitForURL(url => url.pathname === '/ha/admin');
    });
    const originalConfig = await h.api('GET', '/site-config');
    const configKeys = ['site_title', 'project_title', 'footer_text', 'logo_url', 'banner_url', 'primary_color', 'gradient_color', 'accent_color',
      'theme_preset', 'font_size', 'default_theme', 'default_locale', 'seo_default_title_zh', 'seo_default_title_en',
      'seo_default_description_zh', 'seo_default_description_en', 'seo_og_image'];
    const originalFields = Object.fromEntries(configKeys.map(key => [key, originalConfig[key]]));
    await h.remember('/site-config', originalFields);
    const settingsMarker = '测试第三批设置真实保存';
    await h.check('settings-preview-no-put-no-root-style-change', async () => {
      await page.goto(BASE + '/admin/site-settings');
      await settingsInput('project_title').waitFor();
      const rootBefore = await page.locator('html').evaluate(root => ({ style: root.getAttribute('style'), theme: root.getAttribute('data-theme'), classes: root.className }));
      const previewBefore = await page.locator('.settings-preview').getAttribute('style');
      const beforePuts = settingsPuts;
      const preset = page.getByLabel(t.settings.preset, { exact: false });
      const current = await preset.inputValue();
      const options = await preset.locator('option').evaluateAll(nodes => nodes.map(node => node.value));
      const next = options.find(value => value !== current);
      assert(next);
      await preset.selectOption(next);
      await h.wait(async () => await page.locator('.settings-preview').getAttribute('style') !== previewBefore);
      await delay(400);
      assert.equal(settingsPuts, beforePuts);
      assert.deepEqual(await page.locator('html').evaluate(root => ({ style: root.getAttribute('style'), theme: root.getAttribute('data-theme'), classes: root.className })), rootBefore);
      const after = await h.api('GET', '/site-config');
      assert.deepEqual(Object.fromEntries(configKeys.map(key => [key, after[key]])), originalFields);
    });
    await h.check('settings-dirty-sidebar-cancel-retains', async () => {
      await settingsInput('project_title').fill(settingsMarker);
      await dismissConfirm(() => page.locator('a[href="/ha/admin/pages"]').first().click());
      assert.equal(new URL(page.url()).pathname, '/ha/admin/site-settings');
      assert.equal(await settingsInput('project_title').inputValue(), settingsMarker);
    });
    await h.check('settings-503-retention-and-ui-save-persistence', async () => {
      const unmock = await mock503('/site-config', 'PUT');
      try {
        const rejected = responseFor('/site-config', 'PUT', 503);
        await save().click(); await rejected;
        await page.getByRole('alert').filter({ hasText: t.settings.saveError }).waitFor();
        assert.equal(await settingsInput('project_title').inputValue(), settingsMarker);
        assert.equal((await h.api('GET', '/site-config')).project_title, originalConfig.project_title);
      } finally { await unmock(); }
      const saved = responseFor('/site-config', 'PUT', 200);
      await save().click(); await saved;
      await page.getByRole('status').filter({ hasText: t.settings.saved }).waitFor();
      assert.equal((await h.api('GET', '/site-config')).project_title, settingsMarker);
      await page.screenshot({ path: path.join(shots, 'settings.png'), fullPage: true });
    });
    await h.check('settings-load-failure-cannot-save-defaults', async () => {
      const before = await h.api('GET', '/site-config');
      const beforePuts = settingsPuts;
      const unmock = await mock503('/site-config', 'GET');
      try {
        await page.reload();
        await page.getByRole('alert').filter({ hasText: t.settings.loadedError }).waitFor();
        assert.equal(await page.locator('textarea').count(), 0);
        assert((await save().count()) === 0 || await save().isDisabled());
        assert.equal(settingsPuts, beforePuts);
        const after = await h.api('GET', '/site-config');
        assert.deepEqual(Object.fromEntries(configKeys.map(key => [key, after[key]])), Object.fromEntries(configKeys.map(key => [key, before[key]])));
      } finally { await unmock(); }
      await page.getByRole('button', { name: t.publicPage.retry, exact: true }).click();
      await settingsInput('project_title').waitFor();
    });
    const target = h.pages.find(item => item.slug === 'about');
    assert(target && target.id === h.manifest.pages.about);
    const pageEndpoint = `/admin/pages/${target.id}`;
    await h.remember(pageEndpoint, Object.fromEntries(['title_zh', 'title_en', 'meta_description_zh', 'meta_description_en', 'visible'].map(key => [key, target[key]])));
    await h.check('home-hide-delete-disabled', async () => {
      await page.goto(BASE + '/admin/pages');
      const home = page.locator('article').filter({ has: page.locator(`a[href="/ha/admin?page_id=${h.manifest.pages.home}"]`) });
      await home.waitFor();
      assert(await home.getByRole('button', { name: t.pages.hide, exact: true }).isDisabled());
      assert(await home.getByRole('button', { name: t.admin.delete, exact: true }).isDisabled());
      assert(await home.getByRole('button', { name: t.admin.edit, exact: true }).isEnabled());
      await home.screenshot({ path: path.join(shots, 'home-guard.png') });
    });
    const pageMarker = '测试第三批页面编辑保存';
    await h.check('page-modal-dirty-cancel-escape-retains', async () => {
      const row = page.locator('article').filter({ has: page.locator(`a[href="/ha/admin?page_id=${target.id}"]`) });
      await row.getByRole('button', { name: t.admin.edit, exact: true }).click();
      await modal().getByLabel(t.pages.fields.title_zh, { exact: false }).fill(pageMarker);
      for (const action of [() => modal().getByRole('button', { name: t.admin.cancel, exact: true }).click(), () => page.keyboard.press('Escape')]) {
        await dismissConfirm(action);
        assert(await modal().isVisible());
        assert.equal(await modal().getByLabel(t.pages.fields.title_zh, { exact: false }).inputValue(), pageMarker);
      }
    });
    await h.check('page-modal-503-and-success-persistence', async () => {
      const unmock = await mock503(pageEndpoint, 'PUT');
      try {
        const rejected = responseFor(pageEndpoint, 'PUT', 503);
        await modal().getByRole('button', { name: t.admin.save, exact: true }).click(); await rejected;
        await modal().getByRole('alert').filter({ hasText: t.pages.saveError }).waitFor();
        assert.equal(await modal().getByLabel(t.pages.fields.title_zh, { exact: false }).inputValue(), pageMarker);
        assert.equal((await h.api('GET', '/admin/pages')).find(item => item.id === target.id).title_zh, target.title_zh);
      } finally { await unmock(); }
      const saved = responseFor(pageEndpoint, 'PUT', 200);
      await modal().getByRole('button', { name: t.admin.save, exact: true }).click(); await saved;
      await page.locator('dialog[open]').waitFor({ state: 'hidden' });
      const persisted = (await h.api('GET', '/admin/pages')).find(item => item.id === target.id);
      assert.equal(persisted.title_zh, pageMarker);
      assert.equal(persisted.title_en, target.title_en);
      assert.equal(persisted.visible, target.visible);
    });
    await h.check('create-page-default-visible-true', async () => {
      assert(!(await h.api('GET', '/admin/pages')).some(item => item.slug === slug));
      await page.getByRole('button', { name: t.pages.create, exact: true }).click();
      await modal().getByLabel(t.pages.slug, { exact: true }).fill(slug);
      await modal().getByLabel(t.pages.fields.title_zh, { exact: false }).fill('测试第三批临时页面');
      pageIntent = true; writeJournal();
      const created = responseFor('/admin/pages', 'POST', 201);
      await modal().getByRole('button', { name: t.admin.save, exact: true }).click();
      const result = await (await created).json();
      journal.createdPageId = result.id; writeJournal();
      assert.equal(result.visible, true);
      assert.equal((await h.api('GET', '/pages/' + slug)).id, result.id);
      await page.locator('dialog[open]').waitFor({ state: 'hidden' });
    });
    await h.check('pdf-real-upload-view-download-byte-match', async () => {
      // Extract exactly the dependency-free generator; do not import/execute tests.
      const code = 'import ast, pathlib, sys\np=pathlib.Path(sys.argv[1])\nt=ast.parse(p.read_text())\nf=next(n for n in t.body if isinstance(n, ast.FunctionDef) and n.name=="test_only_pdf")\nns={}\nexec(compile(ast.Module(body=[f], type_ignores=[]), str(p), "exec"), ns)\nsys.stdout.buffer.write(ns["test_only_pdf"]())';
      const generated = spawnSync('python3', ['-c', code, path.join(ROOT, 'backend/tests/test_site_contract.py')],
        { cwd: RUN, env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' }, maxBuffer: 1024 * 1024 });
      assert.equal(generated.status, 0);
      const pdf = generated.stdout;
      assert(pdf.subarray(0, 5).equals(Buffer.from('%PDF-')));
      assert(pdf.includes(Buffer.from('TEST ONLY - NOT A CV')));
      assert(!(await h.api('GET', '/files?type=all')).some(file => file.filename === filename));
      await page.goto(BASE + '/admin/files');
      const input = page.locator('input[type="file"]');
      assert((await input.getAttribute('accept')).includes('application/pdf'));
      uploadIntent = true; writeJournal();
      const uploaded = page.waitForResponse(response => new URL(response.url()).pathname === '/ha/api/upload' && response.request().method() === 'POST');
      await input.setInputFiles({ name: filename, mimeType: 'application/pdf', buffer: pdf });
      const response = await uploaded;
      assert(response.ok());
      const file = (await h.api('GET', '/files?type=all')).find(item => item.filename === filename);
      assert(file && file.mime_type === 'application/pdf');
      journal.uploadedFileId = file.id; writeJournal();
      const card = page.locator('div.group').filter({ has: page.locator(`p[title="${filename}"]`) });
      await card.waitFor();
      const link = card.getByRole('link', { name: t.files.viewDocument, exact: true });
      const url = new URL(await link.getAttribute('href'), ORIGIN);
      assert.equal(url.origin, ORIGIN);
      assert(url.pathname.startsWith('/ha/uploads/'));
      const download = await h.context.request.get(url.href, { maxRedirects: 0 });
      assert.equal(download.status(), 200);
      assert((await download.body()).equals(pdf));
      await card.screenshot({ path: path.join(shots, 'pdf-card.png') });
      await h.context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: ORIGIN });
      await card.getByRole('button', { name: t.files.copyLink, exact: true }).click();
      await h.wait(async () => await page.evaluate(() => navigator.clipboard.readText()) === url.href);
      await h.wait(async () => await card.getByRole('button', { name: t.files.copyLink, exact: true }).count() === 1);
      // Deliberately fail clipboard write; restoring by reloading the document below.
      await page.evaluate(() => Object.defineProperty(navigator.clipboard, 'writeText', {
        configurable: true, value: async () => { throw new DOMException('Test denial', 'NotAllowedError'); },
      }));
      await card.getByRole('button', { name: t.files.copyLink, exact: true }).click();
      // Error container also contains its close-button glyph.
      await page.getByText(t.files.copyFailed, { exact: false }).waitFor();
      assert.equal(await card.getByRole('button', { name: t.files.copied, exact: true }).count(), 0);
      await page.reload();
    });
  } catch (error) { failure = error; }
  finally {
    // Discover by unique creation intent even when a response/assertion was lost.
    for (const kind of ['file', 'page']) {
      try {
        if (kind === 'file' && uploadIntent) {
          const files = (await h.api('GET', '/files?type=all')).filter(file => file.filename === filename);
          for (const file of files) {
            assert(file.mime_type === 'application/pdf');
            journal.uploadedFileId = file.id; writeJournal();
            await deleteCreated(`/files/${file.id}`);
          }
          assert(!(await h.api('GET', '/files?type=all')).some(file => file.filename === filename));
        }
        if (kind === 'page' && pageIntent) {
          const pages = (await h.api('GET', '/admin/pages')).filter(item => item.slug === slug);
          for (const item of pages) {
            assert(!Object.values(h.manifest.pages).includes(item.id));
            journal.createdPageId = item.id; writeJournal();
            await deleteCreated(`/admin/pages/${item.id}`);
          }
          assert(!(await h.api('GET', '/admin/pages')).some(item => item.slug === slug));
        }
        journal.cleanup.push({ kind, status: 'passed' });
      } catch (error) {
        journal.cleanup.push({ kind, status: 'failed', error: error.name || 'Error' });
        h.results.checks.push({ stage: `cleanup-created-${kind}`, status: 'failed', error: error.name || 'Error' });
      }
    }
    writeJournal();
    await h.finish(failure);
  }
}

main().catch(error => { console.error(`bootstrap: ${error.name || 'Error'}`); process.exitCode = 1; });
