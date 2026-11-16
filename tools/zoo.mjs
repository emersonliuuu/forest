import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'fs'; import http from 'http';
const out = process.argv[2];
const srv = http.createServer((q, r) => { r.setHeader('content-type', 'text/html'); r.end(fs.readFileSync('/home/user/forest/index.html')); }).listen(0);
const b = await chromium.launch({ args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-angle=swiftshader', '--use-webgpu-adapter=swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage(); p.on('console', m => console.log('[page]', m.text().slice(0, 300)));
await p.goto(`http://localhost:${srv.address().port}/?manual=1&w=640&h=360&seed=3&zoo=1`);
await p.waitForFunction('window.__ready', null, { timeout: 900000 });
// [pose, list, distance, height offset of subject]
const jobs = [[5, 69, 5, 1], [1, 66, 2.2, .3], [1, 63, 4, .4], [0, 57, 1.5, 0], [1, 60, 9, 0], [1, 72, 1.2, 0]];
for (let i = 0; i < jobs.length; i++) {
  const [ps, l, dist, ho] = jobs[i];
  const url = await p.evaluate(`(async()=>{__t.P.lift=0;__t.pose(${ps});await __t.step(0);await __t.step(.016);
    const a=(await __t.inst(${l},1)).split(',').map(Number);const P=__t.P;const ex=P.x,ey=P.y+1.7,ez=P.z;
    const tx=ex+a[0],ty=ey+a[1]+${ho},tz=ez+a[2];const l=Math.hypot(a[0],a[2])||1;
    const cx=tx-a[0]/l*${dist}+a[2]/l*${dist}*.6,cz=tz-a[2]/l*${dist}-a[0]/l*${dist}*.6;
    __t.look(cx,cz,tx,tz,0,0);const hy=P.y+1.7;const need=ty-hy;
    if(${l}==60||${l}==63){P.lift=Math.max(0,need-1);}
    P.pitch=Math.atan2(ty-(P.y+1.7+P.lift),Math.hypot(tx-cx,tz-cz));
    await __t.step(0);return await __t.png()})()`);
  fs.writeFileSync(`${out}_${i}.png`, Buffer.from(url.split(',')[1], 'base64')); console.log(i);
}
await b.close(); srv.close();
