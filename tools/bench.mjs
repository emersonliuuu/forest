// Runs the built-in 60 s scripted walk-through headlessly and prints its report. node tools/bench.mjs <w> <h>
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'fs'; import http from 'http';
const [w, h] = process.argv.slice(2);
const srv = http.createServer((q, r) => { r.setHeader('content-type', 'text/html'); r.end(fs.readFileSync('/home/user/forest/index.html')); }).listen(0);
const b = await chromium.launch({ args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-angle=swiftshader', '--use-webgpu-adapter=swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 640, height: 360 } }); p.on('console', m => console.log('[page]', m.text().slice(0, 600)));
await p.goto(`http://localhost:${srv.address().port}/?bench=1&offscreen=1&seed=3&w=${w}&h=${h}`);
await p.waitForFunction('window.__bench', null, { timeout: 600000 });
console.log(JSON.stringify(await p.evaluate('window.__bench'), null, 1));
await b.close(); srv.close();
