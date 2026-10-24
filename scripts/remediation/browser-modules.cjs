// Test-only loader utilities. Production source + installed DOMPurify, never a sanitizer stub.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const frontend = path.resolve(__dirname, '../../frontend');
const frontendRequire = createRequire(path.join(frontend, 'package.json'));
const ts = frontendRequire('typescript');

function sourcesFor(entries, base = '/ha', skip = () => false) {
  const sources = {};
  function visit(file) {
    if (!path.extname(file)) file = ['.ts', '.tsx', '.json'].map(ext => file + ext).find(candidate => fs.existsSync(candidate));
    if (!file || !file.startsWith(frontend + path.sep)) throw new Error('ModuleOutsideFrontend');
    const key = path.relative(frontend, file).split(path.sep).join('/');
    if (sources[key] || skip(key)) return;
    if (file.endsWith('.json')) { sources[key] = 'module.exports=' + fs.readFileSync(file, 'utf8'); return; }
    const text = fs.readFileSync(file, 'utf8').replaceAll('import.meta.env.BASE_URL', JSON.stringify(base + '/'));
    const code = ts.transpileModule(text, { compilerOptions: {
      module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText;
    sources[key] = code;
    for (const match of code.matchAll(/require\(["']([^"']+)["']\)/g)) {
      if (match[1].startsWith('.')) visit(path.resolve(path.dirname(file), match[1]));
    }
  }
  entries.forEach(entry => visit(path.join(frontend, entry)));
  return sources;
}

async function installDOMPurify(page) {
  // UMD browser build from the same frontend dependency version used by the app.
  const file = path.join(path.dirname(frontendRequire.resolve('dompurify')), 'purify.js');
  await page.addScriptTag({ path: file });
  if (!await page.evaluate(() => typeof window.DOMPurify === 'function' && window.DOMPurify.isSupported)) {
    throw new Error('RealDOMPurifyUnavailable');
  }
}

async function fixtureDocument(page) {
  // A real HTTP-origin document, fully intercepted; no outside network or private server.
  await page.route('http://remediation.invalid/**', route => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><html><body>测试 helper document</body></html>',
  }));
  await page.goto('http://remediation.invalid/ha/');
}

async function routingDependencies() {
  const { build } = await import(frontendRequire.resolve('vite'));
  const entry = path.join(frontend, '.remediation-routing-virtual.js');
  const output = await build({
    configFile: false, envDir: false, root: frontend, logLevel: 'silent',
    define: { 'process.env.NODE_ENV': '"production"', 'process.env.IS_RR_BUILD_REQUEST': '"no"' },
    plugins: [{ name: 'verification-in-memory-dependencies',
      resolveId(id) { if (id === entry) return entry; },
      load(id) { if (id === entry) return 'import React from "react"; import * as router from "react-router-dom"; import {renderToString} from "react-dom/server.browser"; import * as jsxRuntime from "react/jsx-runtime"; export {React,router,renderToString,jsxRuntime};'; },
    }],
    build: { write: false, minify: false, lib: { entry, formats: ['iife'], name: 'RoutingDependencies' } },
  });
  const outputs = Array.isArray(output) ? output : [output];
  const chunk = outputs.flatMap(item => item.output || []).find(item => item.type === 'chunk' && item.isEntry);
  if (!chunk) throw new Error('RoutingBundleMissing');
  return chunk.code + '\n;window.RoutingDependencies = RoutingDependencies;\n';
}

module.exports = { sourcesFor, installDOMPurify, fixtureDocument, routingDependencies };
