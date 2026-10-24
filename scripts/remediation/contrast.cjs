/**
 * Narrow, read-only contrast sampling against the isolated production preview.
 * Run after building/starting that preview:
 *   node scripts/remediation/contrast.cjs
 * Optional: CONTRAST_BASE_URL=http://127.0.0.1:15174/ha/ node scripts/remediation/contrast.cjs
 * Dependencies: playwright, /usr/bin/google-chrome, python3 + Pillow.
 * No API interception, login, clicks, DB access, fixture changes or server startup.
 * The operator must point the preview's API at an isolated fixture, NOT owner DB.
 */
const { chromium, EXECUTABLE, RUN, BASE, IMAGE_PYTHON, assertFixture } = require('./browser-env.cjs');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const output = path.join(RUN, 'contrast.json');
const base = new URL(process.env.CONTRAST_BASE_URL || BASE + '/');
if (!['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname) || base.protocol !== 'http:') {
  throw new Error('Only a local HTTP fixture preview is supported.');
}
if (!base.pathname.endsWith('/')) base.pathname += '/';
const themes = ['teal-amber', 'deep-indigo', 'forest-terracotta'];
const targets = [
  { slug: 'research', width: 1440, points: [
    { name: 'page heading', selector: '.page-heading' },
    { name: 'body paragraph', selector: '.tech-prose p' },
    { name: 'metric value', selector: '.metric-cards .text-gradient' },
    { name: 'metric explanation', selector: '.metric-cards .mt-3' },
  ] },
  { slug: 'cv', width: 390, points: [
    { name: 'first rich-text link', selector: '.tech-prose a' },
  ] },
];
const report = {
  generatedAt: new Date().toISOString(), baseUrl: base.href,
  output: path.relative(root, output), rootFontSize: '20px', viewportHeight: 1100,
  themes, modes: ['light', 'dark'],
  method: 'Computed solid foreground RGB versus every distinct RGB pixel in a Chromium screenshot of the element rectangle with text temporarily made transparent. Layout, background gradients and surfaces remain rendered. Lowest ratio in that rectangle is reported; no theoretical flat-background substitution.',
  limitations: [
    'Selected fixture elements only, not a whole-site accessibility certification.',
    'The preview must use an isolated fixture API. This script does not inspect or open any database.',
    'CMS inline color overrides remain active and are recorded. Preset sampling does not guarantee arbitrary CMS colors will pass.',
    'Only the first matching element is measured. Missing elements are explicit skips.',
    'A rectangle may cover background outside the glyphs; its minimum is a conservative sample, not an exact per-glyph test.',
    'Text anti-aliasing is excluded. Gradient/transparent text, ancestor opacity, filters and nonuniform nested text colors are unsupported and explicitly skipped.',
    'Temporary text hiding also removes text-decoration and text-shadow; currentColor-based backgrounds and complex blending need manual review.',
    'Default and hover/focus states are not equivalent; this script measures the default state only.',
  ], results: [], errors: [],
};

function rgb(value) {
  const match = value.match(/^rgba?\(([^)]+)\)$/);
  if (!match) return null;
  const parts = match[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  return parts.length >= 3 && (parts.length < 4 || parts[3] === 1) ? parts.slice(0, 3) : null;
}
function luminance(color) {
  return color.map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; })
    .reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
}
function backgroundPixels(png) {
  const result = spawnSync(IMAGE_PYTHON, ['-c',
    'import sys,io,json;from PIL import Image;im=Image.open(io.BytesIO(sys.stdin.buffer.read())).convert("RGB");print(json.dumps(list(set(im.getdata()))))',
  ], { input: png, maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0) throw new Error('PNG pixel extraction failed; verify python3 and Pillow.');
  return JSON.parse(result.stdout.toString());
}

async function measure(page, point) {
  const element = page.locator(point.selector).first();
  if (!await element.count() || !await element.isVisible()) return { ...point, status: 'skipped', reason: 'No visible matching element' };
  await element.scrollIntoViewIfNeeded();
  const details = await element.evaluate(el => {
    const style = getComputedStyle(el);
    const ancestors = [];
    for (let node = el; node; node = node.parentElement) ancestors.push(getComputedStyle(node));
    const textColors = [...el.querySelectorAll('*')].filter(node => node.textContent?.trim()).map(node => getComputedStyle(node).webkitTextFillColor);
    return {
      color: style.color, fill: style.webkitTextFillColor, fontSize: style.fontSize, fontWeight: style.fontWeight,
      unsupportedEffects: ancestors.some(s => Number(s.opacity) !== 1 || s.filter !== 'none' || s.mixBlendMode !== 'normal'),
      nonuniformText: textColors.some(color => color !== style.webkitTextFillColor),
    };
  });
  const foreground = rgb(details.fill || details.color);
  if (!foreground || details.unsupportedEffects || details.nonuniformText) return { ...point, status: 'skipped', reason: 'Transparent/gradient/nonuniform text or ancestor compositing requires manual measurement', details };
  const box = await element.boundingBox();
  if (!box || box.width < 1 || box.height < 1) return { ...point, status: 'skipped', reason: 'Empty element bounds' };
  // Hide all nearby prose text too: multiline anchor bounds may include adjacent
  // glyphs. Sampling those glyphs would incorrectly report a ratio close to 1.
  await page.locator('body').evaluate(el => el.setAttribute('data-contrast-background', ''));
  let png;
  try { png = await page.screenshot({ clip: box, animations: 'disabled' }); }
  finally { await page.locator('body').evaluate(el => el.removeAttribute('data-contrast-background')); }
  const pixels = backgroundPixels(png);
  const foregroundLuminance = luminance(foreground);
  let minimum = Infinity;
  let worstBackground;
  for (const pixel of pixels) {
    const background = luminance(pixel);
    const ratio = (Math.max(foregroundLuminance, background) + .05) / (Math.min(foregroundLuminance, background) + .05);
    if (ratio < minimum) { minimum = ratio; worstBackground = pixel; }
  }
  return { ...point, status: 'measured', foreground, worstBackground, minimumContrast: Number(minimum.toFixed(2)),
    meetsNormalTextReference4_5: minimum >= 4.5, meetsLargeTextReference3: minimum >= 3,
    fontSize: details.fontSize, fontWeight: details.fontWeight, sampledDistinctBackgroundColors: pixels.length };
}

(async () => {
  assertFixture();
  let browser;
  try {
    browser = await chromium.launch({ executablePath: EXECUTABLE, headless: true, args: ['--no-sandbox'] });
    const context = await browser.newContext({ reducedMotion: 'reduce', deviceScaleFactor: 1, serviceWorkers: 'block' });
    const page = await context.newPage();
    for (const target of targets) {
      await page.setViewportSize({ width: target.width, height: report.viewportHeight });
      await page.goto(new URL(target.slug, base).href, { waitUntil: 'networkidle' });
      await page.locator('.public-page').waitFor({ timeout: 15000 });
      await page.evaluate(() => document.fonts.ready);
      await page.addStyleTag({ content: `
        html { font-size:20px!important; scroll-behavior:auto!important }
        *, *::before, *::after { animation:none!important; transition:none!important }
        .reveal,.reveal-x { opacity:1!important; transform:none!important }
        body[data-contrast-background],body[data-contrast-background] * {
          color:transparent!important;-webkit-text-fill-color:transparent!important;
          text-shadow:none!important;text-decoration:none!important;
        }
      ` });
      for (const theme of themes) for (const dark of [false, true]) {
        await page.evaluate(({ theme, dark }) => {
          document.documentElement.dataset.theme = theme;
          document.documentElement.classList.toggle('dark', dark);
        }, { theme, dark });
        const inlineColorOverrides = await page.evaluate(() => {
          const style = document.documentElement.style;
          return Object.fromEntries([...style].filter(key => /^--(?:color-|ink|accent|reading-)/.test(key)).map(key => [key, style.getPropertyValue(key)]));
        });
        const values = [];
        for (const point of target.points) values.push(await measure(page, point));
        report.results.push({ page: target.slug, viewportWidth: target.width, theme, mode: dark ? 'dark' : 'light', inlineColorOverrides, values });
      }
    }
    const samples = report.results.flatMap(group => group.values);
    report.status = samples.length === 30 && samples.every(value => {
      if (value.status !== 'measured') return false;
      const size = Number.parseFloat(value.fontSize);
      const large = size >= 24 || (size >= 18.66 && Number(value.fontWeight) >= 700);
      return large ? value.meetsLargeTextReference3 : value.meetsNormalTextReference4_5;
    }) ? 'passed' : 'failed';
    // Unsupported/missing measurements are not a passing accessibility result.
    if (report.status !== 'passed') process.exitCode = 1;
  } catch (error) {
    // Do not emit response bodies, page text, screenshots, credentials or tokens.
    report.errors.push({ name: error.name, message: String(error.name).split('\n')[0] });
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
    console.log(`Contrast report: ${path.relative(root, output)}; groups: ${report.results.length}; errors: ${report.errors.length}`);
  }
})();
