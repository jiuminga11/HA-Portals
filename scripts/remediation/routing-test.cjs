// Focused tests of the real route tree/providers/helpers; no build output or DB writes.
// Swap only browser history for memory history; retain the real data router and RouterProvider.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../../frontend');
const frontendRequire = createRequire(path.join(root, 'package.json'));
const ts = frontendRequire('typescript');
const React = frontendRequire('react');
const router = frontendRequire('react-router-dom');
const { renderToString } = frontendRequire('react-dom/server');
let checks = 0;

for (const base of ['', '/ha']) {
  const cache = new Map();
  let entry = '/';
  let activeRouter;
  function load(file) {
    file = path.resolve(file);
    if (!path.extname(file)) file = ['.ts', '.tsx', '.json'].map(ext => file + ext).find(fs.existsSync);
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    if (file.endsWith('.json')) return (module.exports = JSON.parse(fs.readFileSync(file, 'utf8')));
    const source = fs.readFileSync(file, 'utf8').replaceAll('import.meta.env.BASE_URL', JSON.stringify(`${base}/`));
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    function localRequire(id) {
      if (id === 'react-router-dom') return {
        ...router,
        createBrowserRouter: (routes, options) => {
          activeRouter = router.createMemoryRouter(routes, { ...options, initialEntries: [entry] });
          return activeRouter;
        },
      };
      if (id.endsWith('/PublicLayout')) return { __esModule: true, default: router.Outlet };
      if (id.endsWith('/ThemeProvider')) return { ThemeProvider: ({ children }) => children };
      if (id.endsWith('/PublicPage')) return { __esModule: true, default: ({ slug }) => {
        const { locale } = load(path.join(root, 'src/hooks/useLocale.tsx')).useLocale();
        return React.createElement('span', null, `${locale}:${slug || 'NOT_FOUND'}`);
      } };
      return id.startsWith('.') ? load(path.resolve(path.dirname(file), id)) : frontendRequire(id);
    }
    vm.runInNewContext(`(function(require,module,exports){${code}\n})`, {
      console,
      localStorage: { getItem() { throw new Error('Public locale must not read localStorage'); } },
    })(localRequire, module, module.exports);
    return module.exports;
  }
  const { localePath, resolveContentLink, getPathLocale } = load(path.join(root, 'src/lib/localePath.ts'));
  const { resolveMediaUrl } = load(path.join(root, 'src/lib/basePath.ts'));
  const equal = (actual, expected) => { assert.equal(actual, expected); checks++; };
  equal(localePath('/cv?download=1#resume', 'en'), '/en/cv?download=1#resume');
  equal(localePath('/en/cv?download=1#resume', 'zh'), '/cv?download=1#resume');
  equal(localePath('/en/', 'en'), '/en/');
  equal(getPathLocale('/english'), 'zh');
  equal(getPathLocale('/en/cv'), 'en');
  equal(resolveContentLink('/cv', 'en'), `${base}/en/cv`);
  equal(resolveContentLink(`${base}/en/cv?x=1#top`, 'en'), `${base}/en/cv?x=1#top`);
  equal(resolveContentLink('/uploads/cv.pdf', 'en'), `${base}/uploads/cv.pdf`);
  equal(resolveContentLink('/upload/cv.pdf', 'en'), `${base}/upload/cv.pdf`);
  equal(resolveContentLink('#resume', 'en'), '#resume');
  equal(resolveContentLink('?download=1', 'en'), '?download=1');
  equal(resolveContentLink('/admin/pages', 'en'), `${base}/admin/pages`);
  equal(resolveMediaUrl('/uploads/cv.pdf'), `${base}/uploads/cv.pdf`);
  equal(resolveMediaUrl(`${base}/uploads/cv.pdf`), `${base}/uploads/cv.pdf`);
  for (const url of ['https://example.org/x', 'http://example.org/x', '//cdn.example.org/x', 'data:image/png;base64,eA==', 'mailto:a@example.org']) {
    equal(resolveMediaUrl(url), url);
    equal(resolveContentLink(url, 'en'), url);
  }
  const appFile = path.join(root, 'src/App.tsx');
  for (const [route, expected] of [
    ['/', 'zh:home'], ['/cv', 'zh:cv'], ['/en', 'en:home'], ['/en/', 'en:home'],
    ['/en/cv?x=1#resume', 'en:cv'], ['/missing/deep', 'zh:NOT_FOUND'], ['/en/missing/deep', 'en:NOT_FOUND'],
  ]) {
    entry = `${base}${route}`;
    // App creates its data router at module evaluation, just as a fresh deep-link load does.
    cache.delete(appFile);
    const App = load(appFile).default;
    try {
      equal(renderToString(React.createElement(App)), `<span>${expected}</span>`);
      equal(activeRouter.basename, base || '/');
      const { pathname, search, hash } = activeRouter.state.location;
      equal(`${pathname}${search}${hash}`, entry);
    } finally {
      activeRouter.dispose();
    }
  }
}
console.log(`Routing checks passed: ${checks}`);
