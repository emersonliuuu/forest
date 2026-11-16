// Bundles src/ into a single self-contained ../index.html and reports its size.
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'fs';
import { gzipSync } from 'zlib';
const r = await build({ entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', write: false, target: 'es2022', legalComments: 'none' });
let js = r.outputFiles[0].text;
js = js.replace(/\n\/\/[^\n]*/g, '').replace(/\n/g, '');           // strip WGSL comments + newlines inside shader strings
const html = readFileSync('template.html', 'utf8').replace(/\n/g, '').replace('/*JS*/', () => js.replace(/<\/script/g, '<\\/script'));
writeFileSync('../index.html', html);
console.log(`index.html ${html.length} bytes (${(html.length / 1024).toFixed(1)} KB), gzip ${(gzipSync(html).length / 1024).toFixed(1)} KB`);
