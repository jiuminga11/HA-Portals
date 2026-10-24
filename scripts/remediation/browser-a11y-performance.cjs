'use strict';
// Public performance uses the real isolated preview. Interaction fixtures are
// GET-only route mocks; the sole DELETE is intercepted as a failure, never sent.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { RUN, ORIGIN, BASE, chromium, EXECUTABLE, assertFixture, guard } = require('./browser-env.cjs');
const zh = require('../../frontend/src/locales/a11y.zh.json');
const en = require('../../frontend/src/locales/a11y.en.json');
const output = path.join(RUN, 'browser-a11y-performance.json');
const report = { environment: { previewBase: BASE, fixtureRun: path.basename(RUN) }, checks: [], performance: null, limitations: [
  'Isolated synthetic fixture only; no screenshots or owner content exported.',
  'Interaction GET responses and a failed DELETE are mocked. No persistence success is claimed.',
  'Performance entries come from real preview responses in a fresh browser context, not bundle-size estimates.',
  'Zero resource timing sizes may reflect cache or unavailable timing data; zero does not prove zero cost.',
  'LCP/CLS are observations at this sample cutoff, not a production benchmark; no score or arbitrary threshold is applied.',
] };

function check(value, message) { assert(value, message); }
async function inDialog(page, dialog, count = 9) {
  for (let index = 0; index < count; index++) {
    await page.keyboard.press('Tab');
    check(await dialog.evaluate(node => node.contains(document.activeElement)), 'Tab escaped native modal');
  }
}
async function waitImage(page) {
  await page.waitForFunction(() => {
    const image = document.querySelector('.gallery-preview-image');
    return image && image.complete && image.naturalWidth > 0;
  });
}

(async () => {
  assertFixture();
  let browser;
  try {
    browser = await chromium.launch({ executablePath: EXECUTABLE, headless: true, args: ['--no-sandbox'] });
    const perfContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
    const perf = await perfContext.newPage();
    await perf.addInitScript(() => {
      window.__a11yPerf = { lcp: null, cls: 0 };
      if (PerformanceObserver.supportedEntryTypes.includes('largest-contentful-paint')) new PerformanceObserver(list => {
        const entry = list.getEntries().at(-1); window.__a11yPerf.lcp = entry.startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
      if (PerformanceObserver.supportedEntryTypes.includes('layout-shift')) new PerformanceObserver(list => {
        for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__a11yPerf.cls += entry.value;
      }).observe({ type: 'layout-shift', buffered: true });
    });
    await perf.goto(BASE + '/projects', { waitUntil: 'networkidle' });
    await perf.locator('.public-page').waitFor();
    report.performance = await perf.evaluate(() => {
      const resources = performance.getEntriesByType('resource').map(entry => ({
        path: new URL(entry.name).pathname, initiatorType: entry.initiatorType,
        encodedBodySize: entry.encodedBodySize, decodedBodySize: entry.decodedBodySize, transferSize: entry.transferSize,
      }));
      const js = resources.filter(entry => entry.path.endsWith('.js'));
      return { sampledAtMs: performance.now(), viewport: { width: innerWidth, height: innerHeight }, js,
        jsRequests: js.length, jsEncodedBodySize: js.reduce((n, item) => n + item.encodedBodySize, 0), jsTransferSize: js.reduce((n, item) => n + item.transferSize, 0),
        media: resources.filter(entry => entry.initiatorType === 'img' || entry.initiatorType === 'video' || entry.path.includes('/uploads/')),
        observedLcpMs: window.__a11yPerf.lcp, observedCls: window.__a11yPerf.cls };
    });
    check(!report.performance.js.some(item => /\/(?:SectionEditor|SiteSettings|Dashboard|FileManager|PageManager|Login|Layout)-[^/]+\.js$/.test(item.path)), 'Admin-only chunk entered initial public page');
    report.checks.push('Real preview initial public JS excludes named admin-only chunks');
    await perfContext.close();

    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    const pages = ['home', 'projects'].map((slug, index) => ({ id: index + 1, slug, title_zh: 'Synthetic ' + slug, title_en: 'Synthetic ' + slug, visible: true, sort_order: index, meta_description_zh: '', meta_description_en: '' }));
    const caption = 'SyntheticLongCaption'.repeat(30);
    const gallery = { id: 990001, page_id: 2, type: 'image_gallery', title_zh: 'Synthetic gallery', title_en: 'Synthetic gallery', visible: true, sort_order: 0,
      content: { columns: 2, page_size: 2, items: Array.from({ length: 3 }, (_, index) => ({ url: `/uploads/a11y-fixture-${index}.svg`, caption: index === 0 ? caption : `Synthetic image ${index}` })) } };
    let invalidMedia = false;
    const legacyGallery = { ...gallery, content: { columns: 2, page_size: 0, items: [
      'javascript:window.__unsafeMediaExecuted=true',
      'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',
      'blob:' + ORIGIN + '/synthetic-invalid-media',
      'https://example.\ninvalid/synthetic.png',
    ].map((url, index) => ({ url, caption: `Synthetic invalid ${index}` })) } };
    const config = { site_title: 'Synthetic site', project_title: '', footer_text: '', logo_url: null, banner_url: null, primary_color: '', gradient_color: '', accent_color: '', theme_preset: 'teal-amber', font_size: 'standard', default_theme: 'light', default_locale: 'zh', seo_default_title_zh: '', seo_default_title_en: '', seo_default_description_zh: '', seo_default_description_en: '', seo_og_image: null };
    const mediaRequests = [];
    let failImage = true;
    let deleteRequests = 0;
    let pendingDelete;
    let notifyDelete;
    const deleteStarted = new Promise(resolve => { notifyDelete = resolve; });
    const fixtureFile = { id: 990002, filename: 'a11y-synthetic.svg', file_url: '/uploads/a11y-fixture-0.svg', mime_type: 'image/svg+xml', file_size: 100, created_at: '2026-01-01T00:00:00Z' };
    await context.route(ORIGIN + '/ha/api/**', async route => {
      const url = new URL(route.request().url());
      const endpoint = url.pathname.slice('/ha/api'.length);
      const method = route.request().method();
      if (method === 'DELETE' && endpoint === '/files/990002') { deleteRequests++; pendingDelete = route; notifyDelete(); return; }
      if (method !== 'GET') return route.abort('blockedbyclient');
      const data = endpoint === '/site-config' ? config : endpoint === '/pages' ? pages : endpoint === '/files' ? [fixtureFile]
        : endpoint.endsWith('/sections') ? [invalidMedia ? legacyGallery : gallery] : pages.find(item => endpoint === '/pages/' + item.slug);
      await route.fulfill({ status: data ? 200 : 404, contentType: 'application/json', body: JSON.stringify(data || {}) });
    });
    await context.route(ORIGIN + '/ha/uploads/a11y-fixture-*', async route => {
      const pathname = new URL(route.request().url()).pathname;
      mediaRequests.push(pathname);
      if (pathname.endsWith('-2.svg') && failImage) {
        failImage = false;
        await new Promise(resolve => setTimeout(resolve, 900));
        return route.fulfill({ status: 404, headers: { 'cache-control': 'no-store' }, body: '' });
      }
      await route.fulfill({ contentType: 'image/svg+xml', headers: { 'cache-control': 'no-store' }, body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="teal"/></svg>' });
    });
    const page = await context.newPage();
    await page.goto(BASE + '/projects');
    const trigger = page.getByRole('button', { name: zh.openImage + ': ' + caption, exact: true });
    await trigger.waitFor(); await trigger.scrollIntoViewIfNeeded();
    check(await page.locator('.gallery-thumbnail img').count() === 2, 'Pagination mounted off-page media');
    check(await page.locator('.gallery-thumbnail img').evaluateAll(images => images.every(image => image.loading === 'lazy')), 'Thumbnail lazy-loading removed');
    check(!mediaRequests.some(url => url.endsWith('-2.svg')), 'Off-page image loaded before preview/navigation');
    report.checks.push('Pagination mounts only current page thumbnails, keeps native lazy loading and does not request the off-page image');
    await trigger.focus(); await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: zh.gallery, exact: true });
    await dialog.waitFor();
    check(await dialog.getByRole('button', { name: zh.closeImage }).evaluate(node => node === document.activeElement), 'Initial gallery focus is not close');
    await inDialog(page, dialog);
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      const description = dialog.getByRole('region', { name: zh.caption });
      check(await description.textContent() === caption, 'Long caption lost content');
      const geometry = await dialog.evaluate(node => ({ width: node.clientWidth, scroll: node.scrollWidth }));
      check(geometry.scroll <= geometry.width + 1, `Dialog horizontal overflow at ${width}`);
      await description.focus();
      check(await description.evaluate(node => node.scrollHeight > node.clientHeight), 'Fixture must exercise caption scrolling');
      await page.keyboard.press('End');
      await page.waitForFunction(node => node.scrollTop > 0 && node.scrollHeight - node.clientHeight - node.scrollTop <= 2, await description.elementHandle());
    }
    await page.keyboard.press('Escape');
    check(await trigger.evaluate(node => node === document.activeElement), 'Escape did not restore thumbnail focus');
    await trigger.click(); await dialog.getByRole('button', { name: zh.nextImage }).click();
    await dialog.getByRole('button', { name: zh.nextImage }).click();
    await dialog.getByRole('status').filter({ hasText: zh.loadingImage }).waitFor();
    await dialog.getByRole('alert').waitFor();
    check(await dialog.getByRole('button', { name: zh.nextImage }).evaluate(node => node === document.activeElement), 'Boundary navigation lost focus');
    check(await dialog.getByRole('button', { name: zh.nextImage }).getAttribute('aria-disabled') === 'true', 'End boundary is not announced');
    check(await dialog.getByRole('link', { name: zh.openOriginal }).getAttribute('href') === '/ha/uploads/a11y-fixture-2.svg', 'Native original link lost production base');
    await dialog.getByRole('button', { name: zh.retryImage }).click(); await waitImage(page);
    check(await dialog.getByRole('button', { name: zh.retryImage }).evaluate(node => node === document.activeElement), 'Retry lost focus');
    await dialog.getByRole('button', { name: zh.closeImage }).click();
    check(await trigger.evaluate(node => node === document.activeElement), 'Close did not restore thumbnail focus');
    await trigger.click(); await page.mouse.click(2, 2);
    check(!await dialog.isVisible(), 'Gallery backdrop failed to close');
    check(await trigger.evaluate(node => node === document.activeElement), 'Backdrop did not restore thumbnail focus');
    report.checks.push('Gallery names, initial close focus, Tab containment, boundary focus, complete long captions, delayed 404, retry, native original link and all close paths');

    const menuButton = page.locator('button[aria-controls="mobile-navigation"]');
    await menuButton.click();
    const menu = page.getByRole('dialog', { name: zh.navigation });
    await menu.waitFor();
    check(await menu.getByRole('button', { name: zh.closeMenu }).evaluate(node => node === document.activeElement), 'Initial menu focus incorrect');
    await inDialog(page, menu);
    await trigger.evaluate(node => node.focus());
    check(await menu.evaluate(node => node.contains(document.activeElement)), 'Background accepts focus while menu open');
    await page.keyboard.press('Escape');
    check(await menuButton.evaluate(node => node === document.activeElement), 'Menu close did not restore trigger');
    await menuButton.click(); await menu.getByRole('button', { name: zh.closeMenu }).click();
    check(await menuButton.evaluate(node => node === document.activeElement), 'Menu close button did not restore trigger');
    await menuButton.click(); await page.mouse.click(2, 2);
    check(!await menu.isVisible(), 'Menu backdrop failed to close');
    await menuButton.click(); await menu.getByRole('link', { name: 'Synthetic home', exact: true }).click();
    await page.waitForURL(url => url.pathname.replace(/\/$/, '') === new URL(BASE).pathname);
    check(!await menu.isVisible(), 'Menu link did not close navigation');
    await menuButton.click(); await page.setViewportSize({ width: 1200, height: 900 });
    await page.waitForFunction(() => document.querySelector('[aria-controls="mobile-navigation"]').getAttribute('aria-expanded') === 'false' && document.body.style.overflow !== 'hidden');
    report.checks.push('Mobile menu contains focus, makes background inert, restores trigger and releases scroll lock at desktop breakpoint');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const reduced = await page.evaluate(() => ({ scroll: getComputedStyle(document.documentElement).scrollBehavior,
      reveal: [...document.querySelectorAll('.reveal,.reveal-x')].every(node => { const style = getComputedStyle(node); return style.opacity === '1' && style.transform === 'none' && style.transitionDuration === '0s'; }) }));
    check(reduced.scroll === 'auto' && reduced.reveal, 'Reduced motion hides content or retains transitions');
    await page.goto(BASE + '/en/projects');
    await page.getByRole('button', { name: en.openImage + ': ' + caption, exact: true }).click();
    await page.getByRole('dialog', { name: en.gallery }).getByRole('button', { name: en.closeImage }).click();
    report.checks.push('Reduced-motion visibility/scroll behavior and English gallery accessible names');

    invalidMedia = true;
    await page.goto(BASE + '/projects');
    await page.locator('.gallery-thumbnail').first().waitFor();
    check(await page.locator('.gallery-thumbnail img').count() === 0, 'Invalid thumbnail generated an image src');
    for (let index = 0; index < legacyGallery.content.items.length; index++) {
      const invalidTrigger = page.getByRole('button', { name: zh.openImage + ': Synthetic invalid ' + index, exact: true });
      await invalidTrigger.click();
      const invalidDialog = page.getByRole('dialog', { name: zh.gallery, exact: true });
      await invalidDialog.getByRole('alert').filter({ hasText: zh.invalidImage }).waitFor();
      check(await invalidDialog.locator('img').count() === 0, 'Invalid preview generated an image src');
      check(await invalidDialog.getByRole('link', { name: zh.openOriginal }).count() === 0, 'Invalid media generated an activatable original href');
      check(await invalidDialog.getByRole('button', { name: zh.retryImage }).getAttribute('aria-disabled') === 'true', 'Invalid source retry should remain unavailable');
      check(await invalidDialog.getByRole('region', { name: zh.caption }).textContent() === `Synthetic invalid ${index}`, 'Invalid media lost its caption');
      await page.keyboard.press('Escape');
      check(await invalidTrigger.evaluate(node => node === document.activeElement), 'Invalid-media error cannot return focus on exit');
    }
    check(await page.locator('img[src=""]').count() === 0, 'Invalid media generated an empty-src request');
    check(await page.evaluate(() => window.__unsafeMediaExecuted === undefined), 'Legacy media URL executed code');
    invalidMedia = false;
    report.checks.push('Legacy javascript/data/blob/control-character media have an exit-capable error state, preserved captions, no image src and no activatable original href');

    // Real fixture login only; no credentials/tokens are written to the report.
    const secrets = JSON.parse(fs.readFileSync(path.join(RUN, 'secrets.json'), 'utf8'));
    guard(BASE + '/api/auth/login');
    const auth = await context.request.post(BASE + '/api/auth/login', { data: { username: secrets.ADMIN_USERNAME, password: secrets.ADMIN_PASSWORD } });
    check(auth.ok(), 'Fixture login failed');
    const token = (await auth.json()).access_token;
    await page.evaluate(value => { localStorage.setItem('token', value); localStorage.setItem('locale', 'zh'); }, token);
    await page.goto(BASE + '/admin/files');
    const remove = page.getByTitle('删除文件', { exact: true });
    await remove.click();
    const confirm = page.getByRole('dialog', { name: '删除文件', exact: true });
    const cancel = confirm.getByRole('button', { name: zh.cancel, exact: true });
    check(await cancel.evaluate(node => node === document.activeElement), 'Confirm dialog does not default to cancel');
    await inDialog(page, confirm, 5); await page.keyboard.press('Escape');
    check(deleteRequests === 0, 'Escape confirmed deletion');
    check(await remove.evaluate(node => node === document.activeElement), 'Confirm cancel did not restore trigger');
    await remove.click(); await confirm.getByRole('button', { name: '删除', exact: true }).click();
    await deleteStarted;
    check(deleteRequests === 1 && pendingDelete && await confirm.isVisible(), 'Confirm closed before parent asynchronous response');
    await pendingDelete.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ detail: 'Synthetic reference conflict' }) });
    await confirm.waitFor({ state: 'hidden' });
    report.checks.push('ConfirmDialog names/default cancel/Tab/return focus; Escape never confirms; pending parent request does not close early (mocked conflict, no delete sent)');
    await context.close();
  } catch (error) {
    report.error = { name: error.name, message: String(error.message).split('\n')[0] };
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ report: path.relative(process.cwd(), output), checks: report.checks.length, failed: Boolean(report.error) }));
  }
})();
