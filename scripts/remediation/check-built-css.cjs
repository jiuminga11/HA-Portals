// Fail early if an isolated build silently loses the Tailwind layout utilities.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
assert(process.argv[2], 'Build directory required');
const assets = path.join(path.resolve(process.argv[2]), 'assets');
const files = fs.readdirSync(assets).filter(name => name.endsWith('.css'));
assert(files.length, 'No compiled CSS');
const css = files.map(name => fs.readFileSync(path.join(assets, name), 'utf8')).join('\n');
// These classes size the existing Dashboard controls; zero-sized controls must
// not be accepted just because Vite returned exit 0 or the DOM contains buttons.
for (const utility of ['flex', 'w-7', 'h-7']) {
  assert(new RegExp(`\\.${utility}\\s*[{,]`).test(css), `Missing compiled utility: ${utility}`);
}
console.log('Compiled layout CSS contract passed');
