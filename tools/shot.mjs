// Headless capture: node tools/shot.mjs <out.png> <w> <h> [query] [evalJS]
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'fs'; import http from 'http'; import path from 'path';
const [out, w, h, query = '', js = ''] = process.argv.slice(2);
const root = path.resolve(new URL('..', import.meta.url).pathname);
const srv = http.createServer((q, r) => { r.setHeader('content-type', 'text/html'); r.end(fs.readFileSync(root + '/index.html')); }).listen(0);
const b = await chromium.launch({ args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-angle=swiftshader', '--use-webgpu-adapter=swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
p.on('console', m => console.log('[page]', m.text().slice(0, 600))); p.on('pageerror', e => console.log('[err]', e.message));
const t0 = Date.now();
await p.goto(`http://localhost:${srv.address().port}/?manual=1&w=${w}&h=${h}&${query}`);
await p.waitForFunction('window.__ready', null, { timeout: 600000 });
console.log('ready', Date.now() - t0, 'ms');
const t1 = Date.now();
const url = await p.evaluate(`(async()=>{${js};await __t.step(0);await __t.step(.016);return await __t.png()})()`);
console.log('frame', Date.now() - t1, 'ms');
fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
await b.close(); srv.close();
