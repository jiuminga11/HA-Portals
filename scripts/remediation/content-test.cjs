// Execute the actual TypeScript content transforms in Chromium's real DOMParser.
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../../frontend');
const ts = createRequire(path.join(root, 'package.json'))('typescript');
const sources = {};
for (const name of ['basePath', 'localePath', 'displayContent']) {
  const source = fs.readFileSync(path.join(root, `src/lib/${name}.ts`), 'utf8').replaceAll('import.meta.env.BASE_URL', '"/ha/"');
  sources[name] = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
}
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    const count = await page.evaluate(sources => {
      const modules = {};
      const load = name => {
        name = name.replace('./', '');
        if (!modules[name]) {
          const module = { exports: {} }; modules[name] = module;
          new Function('require', 'module', 'exports', sources[name])(load, module, module.exports);
        }
        return modules[name].exports;
      };
      const { prepareRichText } = load('displayContent');
      let count = 0;
      const check = (condition, message) => { if (!condition) throw new Error(message); count++; };
      const transform = html => new DOMParser().parseFromString(prepareRichText(html, ['Research title', 'A B'], 'en'), 'text/html');
      check(!transform('<h2>Research title</h2><p>Body</p>').querySelector('h2'), 'Plain duplicate removed');
      check(!transform('<h2> Research   title </h2>').querySelector('h2'), 'Whitespace collapsed');
      check(transform('<h2>AB</h2>').querySelector('h2'), 'Distinct word spacing preserved');
      check(transform('<h2>Different title</h2>').querySelector('h2'), 'Unmatched heading preserved');
      const link = transform('<h2 id="paper"><a href="/uploads/paper.pdf">Research title</a></h2><p>Body</p>');
      check(link.querySelector('#paper a').getAttribute('href') === '/ha/uploads/paper.pdf', 'Linked heading and ID preserved');
      check(transform('<h2><a name="paper">Research title</a></h2>').querySelector('[name="paper"]'), 'Named anchor preserved');
      check(transform('<h2 id="paper">Research title</h2>').querySelector('#paper'), 'ID-only heading preserved');
      check(transform('<h2>Research title<img src="/uploads/test.png"></h2>').querySelector('img').getAttribute('src') === '/ha/uploads/test.png', 'Image heading preserved');
      const h1 = transform('<h1 id="paper"><a href="/research">Research title</a></h1>');
      check(!h1.querySelector('h1') && h1.querySelector('h2#paper a').getAttribute('href') === '/ha/en/research', 'Unique page h1 without losing nested content');
      return count;
    }, sources);
    console.log(`Content preservation checks passed: ${count}`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
