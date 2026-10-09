'use strict';
// Postinstall patch for hexo 3.8.0 on modern Node (>= 14).
//
// hexo/lib/plugins/console/generate.js defines a CacheStream whose destroy()
// override wipes its internal _cache array. Since Node 14, streams auto-destroy
// after 'finish', so the override runs before generate.js reads getCache() and
// every generated file ends up 0 bytes. Disabling autoDestroy for that one
// stream is enough: writeFile() still calls destroy() explicitly in its
// finally block, after the file has been written.
//
// Idempotent: safe to run on every install.
const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '..', 'node_modules', 'hexo', 'lib', 'plugins', 'console', 'generate.js');

if (!fs.existsSync(target)) {
  console.error('[fix-hexo-generate] hexo generate.js not found, skipping');
  process.exit(0);
}

let src = fs.readFileSync(target, 'utf8');

if (src.includes('autoDestroy: false')) {
  console.error('[fix-hexo-generate] already patched, skipping');
  process.exit(0);
}

const oldCode = 'function CacheStream() {\n  Transform.call(this);\n\n  this._cache = [];\n}';
const newCode = 'function CacheStream() {\n' +
  '  // Patched by scripts/fix-hexo-generate.js: on Node >= 14 the stream\n' +
  '  // auto-destroys after \'finish\', invoking the destroy() override below\n' +
  '  // and wiping _cache before getCache() is read (all files 0 bytes).\n' +
  '  // writeFile() still destroys the stream explicitly after writing.\n' +
  '  Transform.call(this, {autoDestroy: false});\n\n' +
  '  this._cache = [];\n}';

if (!src.includes(oldCode)) {
  console.error('[fix-hexo-generate] expected CacheStream block not found, skipping');
  process.exit(0);
}

fs.writeFileSync(target, src.replace(oldCode, newCode));
console.error('[fix-hexo-generate] patched CacheStream (autoDestroy: false)');
