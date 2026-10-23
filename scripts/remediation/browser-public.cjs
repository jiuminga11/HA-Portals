// Production-basename browser matrix using only synthetic fixture data.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../..');
const runtime = path.join(root, '.remediation-runtime/baseline-v1');
const pass = process.argv[2] || 'pass2';
const out = path.join(runtime, 'screenshots', pass);
fs.mkdirSync(out, { recursive: true });
const origin = 'http://127.0.0.1:15174';
const results = { checks: [], matrix: [], status: 'running' };
let browser;
async function stableShot(page, file) {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '20px';
    document.querySelectorAll('.reveal, .reveal-x').forEach(el => el.classList.add('visible'));
  });
  await page.screenshot({ path: path.join(out, `${file}.png`), fullPage: true, animations: 'disabled', mask: [page.locator('footer')] });
}
(async () => {
  browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const exceptions = [];
  page.on('pageerror', e => exceptions.push(e.message));
  if (!process.argv.includes('--interactions-only')) {
  for (const locale of ['zh', 'en']) for (const theme of ['light', 'dark']) for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${origin}/ha/`);
    await page.evaluate(({ theme, locale }) => { localStorage.setItem('theme', theme); localStorage.setItem('locale', locale === 'en' ? 'zh' : 'en'); }, { theme, locale });
    for (const slug of ['home', 'about', 'research', 'projects', 'honors', 'cv']) {
      const suffix = `${locale === 'en' ? 'en/' : ''}${slug === 'home' ? '' : slug}`;
      await page.goto(`${origin}/ha/${suffix}`);
      await page.locator('main h1').waitFor();
      await stableShot(page, `${locale}-${slug}-${theme}-${width}`);
      const state = await page.evaluate(() => ({
        lang: document.documentElement.lang,
        rootFontSize: getComputedStyle(document.documentElement).fontSize,
        overflow: document.documentElement.scrollWidth > innerWidth,
        h1: document.querySelectorAll('main h1').length,
        hidden: document.querySelector('main').textContent.includes('测试隐藏区块'),
        description: document.querySelector('meta[name="description"]')?.content || '',
      }));
      assert.equal(state.lang, locale === 'en' ? 'en' : 'zh-CN');
      assert.equal(state.rootFontSize, '20px');
      assert.equal(state.h1, 1, `Expected one h1 ${suffix}`);
      assert(!state.overflow, `${suffix}/${theme}/${width} overflow`);
      assert(!state.hidden, 'Hidden content leaked');
      if (pass === 'pass3') assert(state.description, `Description missing ${suffix}`);
      results.matrix.push({ locale, slug, theme, width, ...state });
    }
  }
  results.checks.push('72 stable pages: 6 pages × 2 languages × 2 modes × 3 widths; URL overrides conflicting stored locale; one h1; no document overflow or hidden content');
  } else {
    const previous = JSON.parse(fs.readFileSync(path.join(runtime, `${pass}-browser.json`)));
    assert.equal(previous.matrix.length, 72);
    results.matrix = previous.matrix;
    results.checks.push(previous.checks[0]);
  }
  await page.goto(`${origin}/ha/en/research?from=test#section-test`);
  await page.locator('main h1').waitFor();
  await page.reload();
  await page.locator('main h1').waitFor();
  assert.equal(await page.locator('html').getAttribute('lang'), 'en');
  await page.getByRole('button', { name: '中', exact: true }).click();
  await page.waitForURL(`${origin}/ha/research?from=test#section-test`);
  assert.equal(await page.locator('html').getAttribute('lang'), 'zh-CN');
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await page.waitForURL(`${origin}/ha/en/research?from=test#section-test`);
  results.checks.push('Deep link reload and language switching retain page, query and hash');
  await page.goto(`${origin}/ha/en/`);
  await page.locator('main h1').waitFor();
  const avatar = page.locator('main img').first();
  await avatar.waitFor();
  assert((await avatar.getAttribute('src')).startsWith('/ha/uploads/'));
  assert(await avatar.evaluate(img => img.complete && img.naturalWidth > 0));
  assert.equal(await avatar.evaluate(img => getComputedStyle(img).objectPosition), '35% 25%');
  const cvLink = page.locator('main a[href="/ha/en/cv"]').first();
  await cvLink.click(); await page.waitForURL(`${origin}/ha/en/cv`);
  const fileLink = page.locator('main a[href="/ha/uploads/test-download.txt"]');
  await fileLink.waitFor();
  assert.equal(await fileLink.count(), 1);
  const file = await context.request.get(`${origin}${await fileLink.getAttribute('href')}`);
  assert(file.ok()); assert((await file.text()).includes('Not a CV'));
  results.checks.push('Avatar under /ha loads with original crop focus; English CTA stays English; actual fixture file link returns exact test content, not a resume');
  for (const route of ['missing-page', 'en/missing-page', 'en/too/many/segments', 'test-hidden']) {
    await page.goto(`${origin}/ha/${route}`);
    await page.locator('main h1').waitFor();
    assert(page.url().endsWith(route), 'Unknown path redirected');
    assert.match(await page.locator('main').innerText(), /404|not found|不存在|找不到/i);
    assert(!(await page.locator('main').innerText()).includes('测试隐藏区块'));
  }
  results.checks.push('Unknown and hidden routes show not-found without redirect or hidden content');
  // Keyboard and real touch menu paths.
  const touch = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const mobile = await touch.newPage();
  await mobile.goto(`${origin}/ha/en/`); await mobile.locator('main h1').waitFor();
  const menu = mobile.locator('button[aria-controls="mobile-navigation"]');
  await menu.tap(); assert.equal(await menu.getAttribute('aria-expanded'), 'true');
  await mobile.locator('#mobile-navigation a[href="/ha/en/research"]').tap();
  await mobile.waitForURL(`${origin}/ha/en/research`);
  assert.equal(await menu.getAttribute('aria-expanded'), 'false');
  await menu.focus(); await mobile.keyboard.press('Enter');
  assert.equal(await menu.getAttribute('aria-expanded'), 'true');
  await mobile.keyboard.press('Escape'); assert.equal(await menu.getAttribute('aria-expanded'), 'false');
  await touch.close();
  results.checks.push('Touch menu navigation and keyboard Enter/Escape maintain expanded state');
  assert.deepEqual(exceptions, []);
  results.status = 'passed';
})().catch(error => { results.status = 'failed'; results.error = error.message; process.exitCode = 1; }).finally(async () => {
  fs.writeFileSync(path.join(runtime, `${pass}-browser.json`), JSON.stringify(results, null, 2));
  if (browser) await browser.close();
  console.log(JSON.stringify({ status: results.status, checks: results.checks, matrixCount: results.matrix.length, error: results.error }, null, 2));
});
