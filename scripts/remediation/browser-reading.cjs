const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium, EXECUTABLE, RUN, ORIGIN, BASE, PYTHON, assertFixture, guard } = require('./browser-env.cjs');
const origin = ORIGIN;
const root = path.resolve(__dirname, '../..');
const report = { checks: [] };
let browser;
(async () => {
  assertFixture();
  browser = await chromium.launch({ executablePath: EXECUTABLE, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 }, reducedMotion: 'reduce' });
  for (const slug of ['research', 'projects', 'honors']) {
    const sections = await (await fetch(`${origin}/ha/api/pages/${slug}/sections`)).json();
    const table = sections.find(s => s.type === 'data_table').content;
    await page.goto(`${origin}/ha/en/${slug}`);
    await page.locator('.data-record').first().waitFor();
    assert.deepEqual(await page.locator('.data-record dd').allTextContents(), table.rows.flatMap(row => table.columns.map(col => row[col.key] || '—')));
    for (const cell of await page.locator('.data-record dd').all()) {
      assert(await cell.evaluate(el => el.scrollWidth <= el.clientWidth && getComputedStyle(el).textOverflow !== 'ellipsis'));
    }
    assert(await page.locator('.original-notice').count() > 0);
    if (slug === 'research') {
      assert.equal(await page.locator('.original-notice').count(), sections.length, 'Missing original notice for metric description fallback');
      assert.equal(await page.locator('.section-nav a').count(), sections.length);
      const last = page.locator('.section-nav a').last();
      const href = await last.getAttribute('href');
      await last.click();
      assert(page.url().endsWith(href));
      assert.equal(await page.locator(href).count(), 1);
    }
  }
  report.checks.push('Mobile cards expose every source field with no ellipsis/overflow; original-language notices present; research navigation targets visible sections');
  await page.setViewportSize({ width: 1440, height: 1000 });
  const table = page.locator('.data-table-scroll');
  await table.focus();
  assert(await table.evaluate(el => el === document.activeElement));
  report.checks.push('Desktop table region keyboard focusable with full content');
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto(`${origin}/ha/en/`); await page.locator('main h1').waitFor();
  assert(await page.locator('.profile-hero').evaluate(el => el.querySelector('h1').getBoundingClientRect().top < el.querySelector('[aria-hidden="true"].order-2').getBoundingClientRect().top));
  report.checks.push('Mobile identity appears before the decorative mark');
  await page.goto(`${origin}/ha/en/projects`);
  const gallery = page.getByRole('button').filter({ has: page.locator('img') }).first();
  await gallery.waitFor(); await gallery.focus(); await page.keyboard.press('Enter');
  await page.getByRole('dialog').waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  report.checks.push('Gallery opens with keyboard Enter and closes with Escape');
  await page.goto(`${origin}/ha/cv`);
  const email = page.locator('main a[href^="mailto:"]').first();
  await email.waitFor();
  const address = await email.textContent();
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
  await email.evaluate(element => {
    const range = document.createRange(); range.selectNodeContents(element);
    const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
  });
  await page.keyboard.press('Control+C');
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), address);
  assert.equal(await email.getAttribute('href'), `mailto:${address}`);
  report.checks.push('Wrapped email copies in full through Ctrl+C and real browser clipboard; mailto unchanged');
  // Home timeline: the toggle appears only when entries exceed the preview,
  // and reveals them in place (synthetic GET mock; no persistence claimed).
  const zh = JSON.parse(fs.readFileSync(path.join(root, 'frontend/src/locales/zh.json'), 'utf8'));
  const homeSections = await (await fetch(`${origin}/ha/api/pages/home/sections`)).json();
  const timelineRoute = `${origin}/ha/api/pages/home/sections`;
  for (const count of [8, 10]) {
    const items = Array.from({ length: count }, (_, index) => ({ date_start: String(2000 + index), title_zh: `测试经历 ${index + 1}`,
      title_en: `Test entry ${index + 1}`, subtitle_zh: '', subtitle_en: '', description_zh: '', description_en: '', category: 'milestone' }));
    const synthetic = [...homeSections, { id: 990100, page_id: homeSections[0].page_id, title_zh: '测试时间线', title_en: 'Test timeline',
      type: 'timeline', visible: true, sort_order: homeSections.length, revision: '', content: { items, layout: 'vertical' } }];
    await page.route(timelineRoute, route => route.request().method() === 'GET'
      ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(synthetic) }) : route.continue());
    await page.goto(`${origin}/ha/`); await page.locator('#section-990100').waitFor();
    const rows = page.locator('#section-990100 .reveal-x');
    const toggle = page.locator('#section-990100 button[aria-controls]');
    assert.equal(await page.locator('#section-990100 a[href$="/about"]').count(), 0);
    if (count === 8) {
      assert.equal(await toggle.count(), 0, 'No toggle without additional entries');
      assert.equal(await rows.count(), 8);
    } else {
      assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
      assert.equal(await toggle.textContent(), zh.section.showAllTimeline.replace('{count}', '10'));
      assert.equal(await rows.count(), 8);
      await toggle.click();
      assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
      assert.equal(await rows.count(), 10);
      await page.evaluate(() => document.querySelector('#section-990100').scrollIntoView());
      await page.waitForFunction(() => [...document.querySelectorAll('#section-990100 .reveal-x')].every(row => getComputedStyle(row).opacity === '1'));
      await toggle.click();
      assert.equal(await rows.count(), 8);
    }
    await page.unroute(timelineRoute);
  }
  report.checks.push('Home timeline shows an in-place expand toggle only when entries exceed the preview');
  report.status = 'passed';
})().catch(error => { report.status = 'failed'; report.error = error.name; process.exitCode = 1; }).finally(async () => {
  fs.writeFileSync(path.join(RUN, 'reading-browser.json'), JSON.stringify(report, null, 2));
  if (browser) await browser.close();
  console.log(JSON.stringify(report, null, 2));
});
