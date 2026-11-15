// Walk-through capture for the critic: (a) time-lapse along the scripted route, (b) bursts of consecutive frames at 30 fps.
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'fs'; import http from 'http';
const [out, w, h] = process.argv.slice(2);
const srv = http.createServer((q, r) => { r.setHeader('content-type', 'text/html'); r.end(fs.readFileSync('/home/user/forest/index.html')); }).listen(0);
const b = await chromium.launch({ args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-angle=swiftshader', '--use-webgpu-adapter=swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage(); p.on('console', m => console.log('[page]', m.text().slice(0, 300)));
await p.goto(`http://localhost:${srv.address().port}/?manual=1&w=${w}&h=${h}&seed=3`);
await p.waitForFunction('window.__ready', null, { timeout: 900000 });
const grab = async (name, js) => { const url = await p.evaluate(`(async()=>{${js};return await __t.png()})()`); fs.writeFileSync(`${out}/${name}.png`, Buffer.from(url.split(',')[1], 'base64')); console.log(name); };
// (a) 18 stations along the 60 s route (settle the camera first)
for (let i = 0; i < 12; i++) { const s = i / 11; await grab(`lapse_${String(i).padStart(2, '0')}`, `await __t.path(${s},.3)`); }
// (b) three bursts of 6 consecutive frames, walking forward at sprint speed (18 m/s) with a slow pan
const bursts = [[0, 'low'], [2, 'cloud'], [4, 'fir']];
for (const [ps, nm] of bursts) {
  await p.evaluate(`__t.pose(${ps})`);
  for (let f = 0; f < 5; f++) await grab(`burst_${nm}_${f}`, `{const P=__t.P;const s=Math.sin(P.yaw),c=Math.cos(P.yaw);const x=P.x+s*.6,z=P.z-c*.6;const yw=P.yaw+.012,pt=P.pitch;__t.set(x,z,yw,pt);await __t.step(1/30)}`);
}
await b.close(); srv.close();
