// Real route-tree SSR renderer in Chrome: DOM-dependent URL security runs against
// the actual browser DOM and actual installed DOMPurify, not a fake sanitizer.
// Only public presentation components/history are substituted, as in the original test.
const { chromium, EXECUTABLE } = require('./browser-env.cjs');
const { sourcesFor, installDOMPurify, fixtureDocument, routingDependencies } = require('./browser-modules.cjs');
let stage = 'dependencies';

(async () => {
  const dependencies = await routingDependencies();
  const browser = await chromium.launch({ executablePath: EXECUTABLE, args: ['--no-sandbox'] });
  let checks = 0;
  try {
    const page = await browser.newPage();
    stage = 'document-and-purifier';
    await fixtureDocument(page);
    await installDOMPurify(page);
    const scriptErrors = [];
    page.on('pageerror', error => scriptErrors.push(error));
    await page.addScriptTag({ content: dependencies });
    if (scriptErrors.length) throw scriptErrors[0];
    for (const base of ['', '/ha']) {
      stage = base ? 'ha-route-evaluation' : 'root-route-evaluation';
      const sources = sourcesFor(['src/App.tsx', 'src/lib/localePath.ts', 'src/lib/basePath.ts'], base,
        key => /\/(?:PublicLayout|ThemeProvider|PublicPage)\.[tj]sx?$/.test(key) || key.startsWith('src/pages/admin/'));
      checks += await page.evaluate(({ sources, base }) => {
        const { React, router, renderToString, jsxRuntime } = window.RoutingDependencies;
        const cache = {};
        let entry = '/';
        let activeRouter;
        let checks = 0;
        const equal = (actual, expected) => { if (actual !== expected) throw new Error(`RoutingAssertion${checks}`); checks++; };
        const storage = { getItem() { throw new Error('PublicLocaleMustNotReadStorage'); } };
        function load(file) {
          if (!Object.hasOwn(sources, file)) file = [file + '.ts', file + '.tsx', file + '.json'].find(key => Object.hasOwn(sources, key));
          if (!file) throw new Error('MissingRoutingSource');
          if (cache[file]) return cache[file].exports;
          const module = { exports: {} }; cache[file] = module;
          function localRequire(id) {
            if (id === 'dompurify') return window.DOMPurify;
            if (id === 'react') return React;
            if (id === 'react/jsx-runtime') return jsxRuntime;
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
              const { locale } = load('src/hooks/useLocale.tsx').useLocale();
              return React.createElement('span', null, `${locale}:${slug || 'NOT_FOUND'}`);
            } };
            if (id.startsWith('.')) return load(new URL(id, 'http://modules.invalid/' + file).pathname.slice(1));
            throw new Error('UnsupportedRoutingDependency');
          }
          new Function('require', 'module', 'exports', 'localStorage', sources[file])(localRequire, module, module.exports, storage);
          return module.exports;
        }
        const { localePath, resolveContentLink, getPathLocale } = load('src/lib/localePath.ts');
        const { resolveMediaUrl } = load('src/lib/basePath.ts');
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
        for (const url of ['https://example.org/x', 'http://example.org/x', '//cdn.example.org/x', 'mailto:a@example.org']) {
          equal(resolveMediaUrl(url), url);
          equal(resolveContentLink(url, 'en'), url);
        }
        // data: is deliberately rejected by the new link security contract.
        equal(resolveMediaUrl('data:image/png;base64,eA=='), 'data:image/png;base64,eA==');
        equal(resolveContentLink('data:image/png;base64,eA==', 'en'), '#');
        equal(resolveContentLink('javascript:alert(1)', 'en'), '#');
        for (const [route, expected] of [
          ['/', 'zh:home'], ['/cv', 'zh:cv'], ['/en', 'en:home'], ['/en/', 'en:home'],
          ['/en/cv?x=1#resume', 'en:cv'], ['/missing/deep', 'zh:NOT_FOUND'], ['/en/missing/deep', 'en:NOT_FOUND'],
        ]) {
          entry = `${base}${route}`;
          delete cache['src/App.tsx'];
          const App = load('src/App.tsx').default;
          try {
            equal(renderToString(React.createElement(App)), `<span>${expected}</span>`);
            equal(activeRouter.basename, base || '/');
            const { pathname, search, hash } = activeRouter.state.location;
            equal(`${pathname}${search}${hash}`, entry);
          } finally { activeRouter.dispose(); }
        }
        return checks;
      }, { sources, base });
    }
    console.log(`Routing checks passed: ${checks}`);
  } finally { await browser.close(); }
})().catch(error => {
  const known = String(error.message).match(/RoutingAssertion\d+|MissingRoutingSource|UnsupportedRoutingDependency|PublicLocaleMustNotReadStorage/);
  // This helper never loads credentials, API responses, or owner data.
  const safeLine = String(error.message).split('\n')[0].slice(0, 200);
  console.error(`routing-helper/${stage}: ${error.name || 'Error'} ${known ? known[0] : safeLine}`);
  process.exitCode = 1;
});
