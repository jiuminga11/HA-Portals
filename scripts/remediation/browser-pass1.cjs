// Synthetic-only Chromium acceptance. Never print credentials or tokens.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../..');
const runtime = path.join(root, '.remediation-runtime/baseline-v1');
const secrets = JSON.parse(fs.readFileSync(path.join(runtime, 'secrets.json')));
const manifest = JSON.parse(fs.readFileSync(path.join(runtime, 'manifest.json')));
const origin = 'http://127.0.0.1:15174';
const label = process.env.REMEDIATION_PASS || 'pass1';
assert(/^[a-z0-9-]+$/.test(label));
const evidence = path.join(runtime, 'screenshots', label);
fs.mkdirSync(evidence, { recursive: true });
const results = { checks: [], matrix: [], limitations: ['Synthetic fixtures, not owner content or formal CV'] };
let browser;
async function api(method, endpoint, body, token) {
  const response = await fetch(`${origin}/ha/api${endpoint}`, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  assert(response.ok, `${method} ${endpoint}: ${response.status}`);
  return response.json();
}
async function snapshot(page, name) {
  await page.screenshot({ path: path.join(evidence, `${name}.png`), fullPage: true, animations: 'disabled', mask: [page.locator('footer')] });
}
async function save(page) {
  const response = page.waitForResponse(r => r.request().method() === 'PUT' && /\/api\/sections\/\d+$/.test(r.url()));
  await page.getByRole('button', { name: '保存', exact: true }).click();
  assert((await response).ok());
  await page.getByRole('button', { name: '保存', exact: true }).waitFor();
}
(async () => {
  browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const auth = await api('POST', '/auth/login', { username: secrets.ADMIN_USERNAME, password: secrets.ADMIN_PASSWORD });
  const token = auth.access_token;
  await page.goto(`${origin}/ha/admin/login`);
  await page.evaluate(token => { localStorage.setItem('token', token); localStorage.setItem('locale', 'zh'); }, token);
  if (!process.argv.includes('--screenshots-only')) {
  const sectionId = manifest.sections['about-body'];
  let original = (await api('GET', '/sections', undefined, token)).find(s => s.id === sectionId);
  const editorUrl = `${origin}/ha/admin/sections/${sectionId}?page_id=2`;
  await page.goto(editorUrl);
  await page.getByLabel('中文标题').waitFor();
  assert.equal(await page.getByLabel('中文标题').inputValue(), original.title_zh);
  assert.equal(await page.getByLabel('英文标题').inputValue(), original.title_en);
  await snapshot(page, 'editor-bilingual');
  await save(page);
  let saved = (await api('GET', '/sections', undefined, token)).find(s => s.id === sectionId);
  assert.equal(saved.title_zh, original.title_zh); assert.equal(saved.title_en, original.title_en);
  await page.getByLabel('中文标题').fill('测试仅修改中文'); await save(page);
  await page.reload(); await page.getByLabel('英文标题').waitFor();
  assert.equal(await page.getByLabel('英文标题').inputValue(), original.title_en);
  await page.getByLabel('英文标题').fill('Only English changed TEST'); await save(page);
  await page.reload(); await page.getByLabel('中文标题').waitFor();
  assert.equal(await page.getByLabel('中文标题').inputValue(), '测试仅修改中文');
  assert.equal(await page.getByLabel('英文标题').inputValue(), 'Only English changed TEST');
  await api('PUT', `/sections/${sectionId}`, { title_zh: original.title_zh, title_en: original.title_en }, token);
  results.checks.push('Unchanged save, single-language edits and reload preserve both titles');
  await page.goto(`${origin}/ha/admin/sections/new?type=rich_text`);
  await page.getByLabel('中文标题').fill('测试新建中文');
  await page.getByLabel('英文标题').fill('New English TEST');
  assert(await page.getByRole('button', { name: '保存', exact: true }).isDisabled());
  await page.getByLabel('所属页面').selectOption('4');
  const createdResponse = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/api/sections'));
  await page.getByRole('button', { name: '保存', exact: true }).click();
  const created = await (await createdResponse).json();
  assert.equal(created.page_id, 4); assert.equal(created.title_en, 'New English TEST');
  await page.waitForURL(`${origin}/ha/admin`);
  await api('DELETE', `/sections/${created.id}`, undefined, token);
  await page.goto(`${origin}/ha/admin/sections/new?type=rich_text&page_id=4`);
  await page.getByLabel('中文标题').waitFor();
  assert.equal(await page.getByLabel('所属页面').inputValue(), '4');
  await page.getByLabel('中文标题').fill('测试筛选新建');
  const filteredResponse = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/api/sections'));
  await page.getByRole('button', { name: '保存', exact: true }).click();
  const filteredCreated = await (await filteredResponse).json();
  await page.waitForURL(`${origin}/ha/admin?page_id=4`);
  await api('DELETE', `/sections/${filteredCreated.id}`, undefined, token);
  for (const route of ['new?page_id=999999', '999999']) {
    await page.goto(`${origin}/ha/admin/sections/${route}`);
    await page.getByRole('button', { name: '保存', exact: true }).waitFor();
    assert(await page.getByRole('button', { name: '保存', exact: true }).isDisabled());
  }
  results.checks.push('Explicit non-1 page, missing page/section blocked, create and return filter persist');
  const rows = () => page.locator('span.font-semibold.text-slate-800.truncate').allTextContents();
  await page.goto(`${origin}/ha/admin?page_id=4`);
  await page.getByRole('button', { name: '下移', exact: true }).first().waitFor();
  const order = await rows();
  await snapshot(page, 'sorting-before');
  for (const label of ['下移', '上移']) {
    const request = page.waitForResponse(r => r.url().endsWith('/sections/reorder'));
    await page.getByRole('button', { name: label, exact: true }).nth(label === '下移' ? 0 : 1).click();
    assert((await request).ok());
    await page.waitForFunction(() => !document.querySelector('[role="status"]'));
    const expected = label === '下移' ? [order[1], order[0], ...order.slice(2)] : order;
    assert.deepEqual(await rows(), expected);
    await page.reload(); await page.getByRole('button', { name: '下移', exact: true }).first().waitFor();
    assert.deepEqual(await rows(), expected);
  }
  await page.route('**/api/sections/reorder', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"detail":"Test failure"}' }));
  await page.getByRole('button', { name: '下移', exact: true }).first().click();
  await page.getByRole('alert').waitFor();
  assert.deepEqual(await rows(), order);
  await snapshot(page, 'sorting-failure-rollback');
  await page.unroute('**/api/sections/reorder');
  results.checks.push('Consecutive down/up, DOM order, reload persistence, 503 rollback');
  }
  // Public evidence excludes legacy hardcoded footer personal text.
  if (!process.argv.includes('--functional-only')) {
  await context.clearCookies();
  await page.evaluate(() => localStorage.removeItem('token'));
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('http://127.0.0.1:15175/ha/cv');
    await page.locator('main a[href^="mailto:"]').waitFor();
    await page.evaluate(() => { document.documentElement.style.fontSize = '20px'; document.querySelectorAll('.reveal, .reveal-x').forEach(el => el.classList.add('visible')); });
    await snapshot(page, `baseline-cv-${width}`);
    results.matrix.push({ baseline: true, width, overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth) });
  }
  for (const theme of ['light', 'dark']) for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${origin}/ha/`);
    await page.evaluate(theme => { localStorage.setItem('theme', theme); localStorage.setItem('locale', 'zh'); }, theme);
    for (const slug of ['home', 'about', 'research', 'projects', 'honors', 'cv']) {
      await page.goto(`${origin}/ha/${slug === 'home' ? '' : slug}`);
      await page.locator('main .reveal, main h1').first().waitFor();
      await page.evaluate(() => { document.documentElement.style.fontSize = '20px'; document.querySelectorAll('.reveal, .reveal-x').forEach(el => el.classList.add('visible')); });
      await snapshot(page, `${slug}-${theme}-${width}`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      results.matrix.push({ slug, theme, width, overflow });
      if (slug === 'cv') assert(!overflow, `CV overflow at ${width}/${theme}`);
    }
  }
  await page.goto(`${origin}/ha/cv`);
  const email = page.locator('main a[href^="mailto:"]');
  const fullEmail = await email.textContent();
  assert.equal(await email.getAttribute('href'), `mailto:${fullEmail}`);
  const selected = await email.evaluate(el => { const range = document.createRange(); range.selectNodeContents(el); const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range); return selection.toString(); });
  assert.equal(selected, fullEmail);
  results.checks.push('CV 320/390/1440 at 20px: no page overflow, full email selectable and mailto intact');
  }
  results.status = 'passed';
})().catch(error => { results.status = 'failed'; results.error = error.message; process.exitCode = 1; }).finally(async () => {
  fs.writeFileSync(path.join(runtime, process.argv.includes('--screenshots-only') ? `${label}-visual.json` : `${label}-browser.json`), JSON.stringify(results, null, 2));
  if (browser) await browser.close();
  console.log(JSON.stringify(results, null, 2));
});
