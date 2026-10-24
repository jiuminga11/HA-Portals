// Existing content acceptance: GET-only read-only server; no screenshots or text export.
const fs = require('node:fs');
const path = require('node:path');
const { chromium, EXECUTABLE } = require('./browser-env.cjs');
if (process.env.REMEDIATION_ALLOW_READONLY !== '1' || process.env.REMEDIATION_RUN) throw new Error('ReadonlyRequiresExplicitSeparateOptIn');
const root = path.resolve(__dirname, '../..');
const report = { boundary: 'SQLite mode=ro, lifespan off, GET-only API; no owner content or screenshots exported', matrix: [] };
let browser;
(async () => {
  browser = await chromium.launch({ executablePath: EXECUTABLE, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 }, reducedMotion: 'reduce' });
  await page.route('**/*', route => {
    const request = route.request();
    if (!['GET', 'HEAD'].includes(request.method()) || !request.url().startsWith('http://127.0.0.1:15177/')) return route.abort();
    return route.continue();
  });
  for (const locale of ['zh', 'en']) for (const dark of [false, true]) for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const slug of ['home', 'about', 'research', 'projects', 'honors', 'cv']) {
      await page.goto(`http://127.0.0.1:15177/ha/${locale === 'en' ? 'en/' : ''}${slug === 'home' ? '' : slug}`);
      await page.locator('.public-page').waitFor();
      await page.addStyleTag({ content: 'html{font-size:20px!important}*{animation:none!important;transition:none!important}.reveal,.reveal-x{opacity:1!important;transform:none!important}' });
      await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), dark);
      const state = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth,
        h1Count: document.querySelectorAll('main h1').length,
        lang: document.documentElement.lang,
        mailtoCount: document.querySelectorAll('main a[href^="mailto:"]').length,
        mailtoTextMatches: [...document.querySelectorAll('main a[href^="mailto:"]')].every(el => !el.textContent.includes('@') || el.getAttribute('href').slice(7).split('?')[0] === el.textContent.trim()),
      }));
      report.matrix.push({ locale, dark, width, slug, ...state });
    }
  }
  report.status = report.matrix.every(row => !row.overflow && row.h1Count === 1 && row.mailtoTextMatches) ? 'passed' : 'findings';
})().catch(error => { report.status = 'failed'; report.error = error.name; process.exitCode = 1; }).finally(async () => {
  fs.writeFileSync(path.join(root, '.remediation-runtime/readonly-browser.json'), JSON.stringify(report, null, 2));
  if (browser) await browser.close();
  console.log(JSON.stringify({ status: report.status, combinations: report.matrix.length, findings: report.matrix.filter(row => row.overflow || row.h1Count !== 1 || !row.mailtoTextMatches) }, null, 2));
});
