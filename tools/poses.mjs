// node tools/poses.mjs <outPrefix> <w> <h> <query> <js1> <js2> ...   (each js sets up a pose; one page load)
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'fs'; import http from 'http'; import path from 'path';
const [out, w, h, query, ...jss] = process.argv.slice(2);
const root = path.resolve(new URL('..', import.meta.url).pathname);
const srv = http.createServer((q, r) => { r.setHeader('content-type', 'text/html'); r.end(fs.readFileSync(root + '/index.html')); }).listen(0);
const b = await chromium.launch({ args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-angle=swiftshader', '--use-webgpu-adapter=swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 800, height: 450 } });
p.on('console', m => console.log('[page]', m.text().slice(0, 500))); p.on('pageerror', e => console.log('[err]', e.message));
await p.goto(`http://localhost:${srv.address().port}/?manual=1&w=${w}&h=${h}&${query}`);
await p.waitForFunction('window.__ready', null, { timeout: 900000 });
for (let i = 0; i < jss.length; i++) {
  const t1 = Date.now();
  const url = await p.evaluate(`(async()=>{__t.P.lift=0;${jss[i]};await __t.step(0);await __t.step(.016);return await __t.png()})()`);
  fs.writeFileSync(`${out}_${i}.png`, Buffer.from(url.split(',')[1], 'base64'));
  console.log(i, Date.now() - t1, 'ms', process.env.COUNTS ? await p.evaluate('__t.counts()') : '');
}
await b.close(); srv.close();
