import { genWorld, H, W, site, macro, MW, MH, mkrng, sst, sat, zalt, deckY, ZONES, zoneOf, nd } from './world.js';
import { genAtlas, genNoise, genNoise3 } from './atlas.js';
import { genMeshes, NK, NP } from './mesh.js';
import { renderWGSL, postWGSL, blitWGSL, computeWGSL, NEAR, LR, TG, UG, GG, NPOL, NFLY } from './shaders.js';

const Q = new URLSearchParams(location.search), $ = id => document.getElementById(id);
const canvas = $('c'), msg = $('m');
const fail = t => { msg.textContent = t; msg.style.display = 'block'; };

async function main() {
  const adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
  if (!adapter) return fail('This scene needs WebGPU (Chrome / Edge 113+ on desktop).');
  const hasTS = adapter.features.has('timestamp-query') && new URLSearchParams(location.search).has('bench'); // GPU timing only in bench mode
  const dev = await adapter.requestDevice({ requiredFeatures: hasTS ? ['timestamp-query'] : [] });
  dev.addEventListener('uncapturederror', e => console.error(e.error.message.slice(0, 400)));
  const ctx = canvas.getContext('webgpu'), fmt = navigator.gpu.getPreferredCanvasFormat();
  dev.lost.then(i => console.error('device lost', i.message));
  const DBG = +(Q.get('dbg') || 0), BENCH = Q.has('bench'), MANUAL = Q.has('manual'), MSAA = +(Q.get('msaa') || 4);
  const OFF = MANUAL || Q.has('offscreen'); // render to a texture instead of the canvas (headless capture / headless bench)
  if (!OFF) ctx.configure({ device: dev, format: fmt, alphaMode: 'opaque' });
  let offT = null; // headless capture target (manual mode renders offscreen and reads pixels back)

  // ---------- world + CPU-generated assets ----------
  genWorld();
  const tex = (d, data, bpr, rows) => { const t = dev.createTexture(d); if (data) data.forEach((m, i) => dev.queue.writeTexture({ texture: t, mipLevel: i }, m, { bytesPerRow: bpr >> i, rowsPerImage: rows ? rows >> i : undefined }, [Math.max(1, d.size[0] >> i), Math.max(1, d.size[1] >> i), d.size[2] || 1])); return t; };
  const TB = GPUTextureUsage.TEXTURE_BINDING, RA = GPUTextureUsage.RENDER_ATTACHMENT, CD = GPUTextureUsage.COPY_DST;
  const macroT = tex({ size: [MW, MH], format: 'r32float', usage: TB | CD }, [macro], MW * 4);
  const noiseT = tex({ size: [256, 256], format: 'rgba8unorm', mipLevelCount: 9, usage: TB | CD }, genNoise(), 1024);
  const atlasT = tex({ size: [1024, 1024], format: 'rgba8unorm-srgb', mipLevelCount: 6, usage: TB | CD }, genAtlas().slice(0, 6), 4096);
  const noise3 = tex({ size: [64, 64, 64], dimension: '3d', format: 'r8unorm', usage: TB | CD }, [genNoise3()], 64, 64);
  const shadowT = dev.createTexture({ size: [2048, 2048, 2], format: 'depth32float', usage: TB | RA });
  const IW = 2048, IH = 1536, IM = 6;
  const impC = dev.createTexture({ size: [IW, IH], format: 'rgba8unorm-srgb', mipLevelCount: IM, usage: TB | RA });
  const impN = dev.createTexture({ size: [IW, IH], format: 'rgba8unorm', mipLevelCount: IM, usage: TB | RA });
  const samp = dev.createSampler({ magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear', addressModeU: 'repeat', addressModeV: 'repeat', addressModeW: 'repeat', maxAnisotropy: 8 });
  const sampC = dev.createSampler({ compare: 'less', magFilter: 'linear', minFilter: 'linear' });

  // ---------- meshes + instance lists ----------
  const ms = genMeshes(), BU = GPUBufferUsage;
  const mkbuf = (data, usage) => { const b = dev.createBuffer({ size: data.byteLength + 3 & ~3, usage: usage | BU.COPY_DST }); dev.queue.writeBuffer(b, 0, data); return b; };
  const meshVB = mkbuf(ms.vb, BU.VERTEX), meshIB = mkbuf(ms.ib, BU.INDEX);
  // list capacities per kind: [main, cascade0, cascade1]
  const CAP = k => k < 12 ? [384, 192, 768] : k < 17 ? [3072, 768, 2048] : k == 17 ? [24576, 1, 1] : k == 18 ? [16384, 1, 1] : k == 19 || k == 20 || k == 24 ? [320, 1, 1] : [64, 32, 64];
  const CAST = k => k < 17 || (k > 20 && k < 24);
  const NL = NK * 3 + 1, LB = [], LC = []; let tot = 0;
  for (let k = 0; k < NK; k++) for (const c of CAP(k)) { LB.push(tot); LC.push(c); tot += c; }
  LB.push(tot); LC.push(65536); tot += 65536;
  const instB = dev.createBuffer({ size: tot * 32, usage: BU.STORAGE | BU.VERTEX | BU.COPY_SRC });
  const drawT = new Uint32Array(NL * 5);
  for (let k = 0; k < NK; k++) for (let j = 0; j < 3; j++) { const o = (k * 3 + j) * 5; drawT[o] = ms.info[k].count; drawT[o + 2] = ms.info[k].first; drawT[o + 3] = ms.info[k].base; }
  if (Q.has('swap')) for (let j = 0; j < 3; j++) { const o = (16 * 3 + j) * 5, m = ms.info[+Q.get('swap')]; drawT[o] = m.count; drawT[o + 2] = m.first; drawT[o + 3] = m.base; }
  if (Q.has('swap2')) for (let j = 0; j < 3; j++) { const o = (+Q.get('swap2') * 3 + j) * 5, m = ms.info[16]; drawT[o] = m.count; drawT[o + 2] = m.first; drawT[o + 3] = m.base; }
  drawT[NK * 15] = 4;
  const drawB = dev.createBuffer({ size: drawT.byteLength, usage: BU.STORAGE | BU.INDIRECT | BU.COPY_DST | BU.COPY_SRC });
  // tree zone table: lo, hi, fade, weight
  const KT = [[0, 520, 160, .22], [0, 850, 260, 1], [0, 720, 200, .22], [450, 2350, 300, 1], [350, 1800, 250, .75], [1550, 2480, 180, .8], [1650, 2480, 180, .7], [2400, 3150, 180, 1], [2450, 3150, 180, .6], [3050, 3660, 150, 1.3], [3050, 3700, 150, .14], [3520, 4100, 120, 1]];
  const KS = ms.info.slice(0, NK).map((m, k) => k < 12 ? [.8, .45, m.ht, 0] : k == 14 ? [.45, .4, 3, 0] : k < 17 ? [.6, .55, Math.max(m.ht, m.hw), 0] : [1, 0, 1, 0]);
  const propI = new Float32Array(NP * 8), propB = dev.createBuffer({ size: propI.byteLength, usage: BU.VERTEX | BU.COPY_DST });
  const propA = [[site[4], site[6], site[5]], [site[16], site[20], site[17]], [site[8], site[11], site[9]], [site[0], site[2], site[1]]];
  for (let k = 0; k < NP; k++) { propI[k * 8 + 3] = 1; propI[k * 8 + 6] = 1; }
  const bakeB = mkbuf(new Float32Array(12 * 8), BU.VERTEX);

  // terrain clipmap grid: 11 nested rings of 128x128 cells
  const NLV = 11, tv = new Int16Array(NLV * 129 * 129 * 4), ti = [];
  for (let l = 0, o = 0; l < NLV; l++) for (let j = -64; j <= 64; j++) for (let i = -64; i <= 64; i++, o += 4) { tv[o] = i; tv[o + 1] = j; tv[o + 2] = l; }
  for (let l = 0; l < NLV; l++) for (let j = -64; j < 64; j++) for (let i = -64; i < 64; i++) {
    if (l && i >= -31 && i < 31 && j >= -31 && j < 31) continue;
    const a = l * 16641 + (j + 64) * 129 + i + 64; ti.push(a, a + 129, a + 1, a + 1, a + 129, a + 130);
  }
  const terVB = mkbuf(tv, BU.VERTEX), terIB = mkbuf(new Uint32Array(ti), BU.INDEX), terN = ti.length;

  // ---------- layouts + pipelines ----------
  const VS = GPUShaderStage.VERTEX, FS = GPUShaderStage.FRAGMENT, CS = GPUShaderStage.COMPUTE;
  const e = (binding, visibility, x) => ({ binding, visibility, ...x });
  const lite = [e(0, VS | FS | CS, { buffer: {} }), e(1, VS | FS | CS, { texture: { sampleType: 'unfilterable-float' } }), e(2, FS, { texture: {} }), e(3, FS, { texture: {} }), e(4, FS, { sampler: {} })];
  const liteL = dev.createBindGroupLayout({ entries: lite });
  const sceneL = dev.createBindGroupLayout({ entries: [...lite, e(5, FS, { texture: { sampleType: 'depth', viewDimension: '2d-array' } }), e(6, FS, { sampler: { type: 'comparison' } }), e(7, FS, { texture: {} }), e(8, FS, { texture: {} }), e(9, FS, { texture: { viewDimension: '3d' } })] });
  const compL = dev.createBindGroupLayout({ entries: [e(0, CS, { buffer: {} }), e(1, CS, { texture: { sampleType: 'unfilterable-float' } }), e(2, CS, { buffer: { type: 'storage' } }), e(3, CS, { buffer: { type: 'storage' } })] });
  const dms = { texture: { sampleType: 'depth', multisampled: MSAA > 1 } }, uf = { texture: { sampleType: 'unfilterable-float' } };
  const volL = dev.createBindGroupLayout({ entries: [e(0, FS, dms)] });
  const cmpL = dev.createBindGroupLayout({ entries: [e(0, FS, dms), e(1, FS, uf), e(2, FS, uf), e(3, FS, uf)] });
  const blitL = dev.createBindGroupLayout({ entries: [e(0, FS, { texture: {} }), e(1, FS, { sampler: {} })] });
  const fix = s => MSAA > 1 ? s : s.replace(/texture_depth_multisampled_2d/g, 'texture_depth_2d');
  const check = async (m, n, c) => { const i = await m.getCompilationInfo(); for (const x of i.messages) if (x.type == 'error') console.error(n, x.message, '@@', (c || '').split('\n')[x.lineNum - 1].slice(Math.max(0, x.linePos - 90), x.linePos + 30)); return m; };
  const mR = await check(dev.createShaderModule({ code: renderWGSL }), 'render', renderWGSL);
  const mP = await check(dev.createShaderModule({ code: fix(postWGSL) }), 'post', fix(postWGSL));
  const mB = dev.createShaderModule({ code: blitWGSL });
  const cw = computeWGSL(NK, LB, LC, KT, KS), mC = await check(dev.createShaderModule({ code: cw }), 'compute', cw);
  const G = new Float32Array(256), gB = dev.createBuffer({ size: 1024, usage: BU.UNIFORM | BU.COPY_DST });
  const bgE = [{ binding: 0, resource: { buffer: gB } }, { binding: 1, resource: macroT.createView() }, { binding: 2, resource: noiseT.createView() }, { binding: 3, resource: atlasT.createView() }, { binding: 4, resource: samp }];
  const liteG = dev.createBindGroup({ layout: liteL, entries: bgE });
  const sceneG = dev.createBindGroup({ layout: sceneL, entries: [...bgE, { binding: 5, resource: shadowT.createView({ dimension: '2d-array' }) }, { binding: 6, resource: sampC }, { binding: 7, resource: impC.createView() }, { binding: 8, resource: impN.createView() }, { binding: 9, resource: noise3.createView() }] });
  const compG = dev.createBindGroup({ layout: compL, entries: [bgE[0], bgE[1], { binding: 2, resource: { buffer: instB } }, { binding: 3, resource: { buffer: drawB } }] });
  const PL = (...l) => dev.createPipelineLayout({ bindGroupLayouts: l });
  const meshBuf = { arrayStride: 32, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }, { shaderLocation: 1, offset: 12, format: 'snorm8x4' }, { shaderLocation: 2, offset: 16, format: 'float32x2' }, { shaderLocation: 3, offset: 24, format: 'unorm8x4' }, { shaderLocation: 4, offset: 28, format: 'unorm8x4' }] };
  const instBuf = { arrayStride: 32, stepMode: 'instance', attributes: [{ shaderLocation: 5, offset: 0, format: 'float32x4' }, { shaderLocation: 6, offset: 16, format: 'float32x4' }] };
  const HDR = 'rgba16float', DF = 'depth32float', ms4 = { count: MSAA };
  const dsMain = (w, c = 'greater') => ({ format: DF, depthWriteEnabled: w, depthCompare: c });
  const RP = (layout, vs, fs, o) => dev.createRenderPipeline({ layout, vertex: { module: o.m || mR, entryPoint: vs, buffers: o.buffers || [], constants: o.constants }, fragment: fs ? { module: o.m || mR, entryPoint: fs, targets: o.targets, constants: o.constants } : undefined, primitive: { topology: o.topo || 'triangle-list', cullMode: 'none' }, depthStencil: o.ds, multisample: o.ms });
  const pTer = RP(PL(sceneL), 'vt', 'ft', { buffers: [{ arrayStride: 8, attributes: [{ shaderLocation: 0, offset: 0, format: 'sint16x4' }] }], targets: [{ format: HDR }], ds: dsMain(true), ms: ms4 });
  const pVeg = RP(PL(sceneL), 'vv', 'fv', { buffers: [meshBuf, instBuf], targets: [{ format: HDR }], ds: dsMain(true), ms: { count: MSAA, alphaToCoverageEnabled: MSAA > 1 } });
  const pImp = RP(PL(sceneL), 'vi', 'fi', { buffers: [instBuf], topo: 'triangle-strip', targets: [{ format: HDR }], ds: dsMain(true), ms: { count: MSAA, alphaToCoverageEnabled: MSAA > 1 } });
  const pSky = RP(PL(sceneL), 'vq', 'fsky', { topo: 'triangle-strip', targets: [{ format: HDR }], ds: dsMain(false, 'equal'), ms: ms4 });
  const pPar = RP(PL(sceneL), 'vp', 'fp', { topo: 'triangle-strip', targets: [{ format: HDR, blend: { color: { srcFactor: 'one', dstFactor: 'one' }, alpha: { srcFactor: 'zero', dstFactor: 'one' } } }], ds: dsMain(false), ms: ms4 });
  const pSh = [0, 1].map(c => RP(PL(liteL), 'vs', 'fs', { buffers: [meshBuf, instBuf], targets: [], constants: { CASC: c }, ds: { format: DF, depthWriteEnabled: true, depthCompare: 'less', depthBias: 2, depthBiasSlopeScale: 2.5 } }));
  const pBake = RP(PL(liteL), 'vb', 'fb', { buffers: [meshBuf, instBuf], targets: [{ format: 'rgba8unorm-srgb' }, { format: 'rgba8unorm' }], ds: { format: DF, depthWriteEnabled: true, depthCompare: 'less' } });
  const pVol = RP(PL(sceneL, volL), 'vq', 'fvol', { m: mP, topo: 'triangle-strip', targets: [{ format: HDR }, { format: 'r16float' }] });
  const pCmp = RP(PL(sceneL, cmpL), 'vq', 'fcomp', { m: mP, topo: 'triangle-strip', targets: [{ format: fmt }] });
  const pCom = ['trees', 'under', 'grass', 'life'].map(n => dev.createComputePipeline({ layout: PL(compL), compute: { module: mC, entryPoint: n } }));

  // ---------- bake tree impostors (albedo + normal atlases) ----------
  {
    const bi = new Float32Array(12 * 8);
    for (let k = 0; k < 12; k++) { const E = Math.max(ms.info[k].hw, ms.info[k].ht / 2) * 1.03; bi[k * 8 + 3] = 1; bi[k * 8 + 6] = 1; bi[k * 8 + 7] = E; G[192 + k * 4] = E; G[193 + k * 4] = ms.info[k].ht; }
    dev.queue.writeBuffer(bakeB, 0, bi); G[108] = W.S; dev.queue.writeBuffer(gB, 0, G);
    const en = dev.createCommandEncoder(), bd = dev.createTexture({ size: [IW, IH], format: DF, usage: RA });
    const p = en.beginRenderPass({ colorAttachments: [{ view: impC.createView({ baseMipLevel: 0, mipLevelCount: 1 }), loadOp: 'clear', storeOp: 'store', clearValue: [.045, .085, .03, 0] }, { view: impN.createView({ baseMipLevel: 0, mipLevelCount: 1 }), loadOp: 'clear', storeOp: 'store', clearValue: [.5, .8, .8, .7] }], depthStencilAttachment: { view: bd.createView(), depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'discard' } });
    p.setPipeline(pBake); p.setBindGroup(0, liteG); p.setVertexBuffer(0, meshVB); p.setIndexBuffer(meshIB, 'uint32');
    for (let k = 0; k < 12; k++) { p.setViewport((k & 3) * 512, (k >> 2) * 512, 512, 512, 0, 1); p.setVertexBuffer(1, bakeB, k * 32); p.drawIndexed(ms.info[k].count, 1, ms.info[k].first, ms.info[k].base); }
    p.end();
    for (const [t, f] of [[impC, 'rgba8unorm-srgb'], [impN, 'rgba8unorm']]) {
      const pb = dev.createRenderPipeline({ layout: PL(blitL), vertex: { module: mB, entryPoint: 'vq' }, fragment: { module: mB, entryPoint: 'fblit', targets: [{ format: f }] }, primitive: { topology: 'triangle-strip' } });
      for (let m = 1; m < IM; m++) {
        const q = en.beginRenderPass({ colorAttachments: [{ view: t.createView({ baseMipLevel: m, mipLevelCount: 1 }), loadOp: 'clear', storeOp: 'store' }] });
        q.setPipeline(pb); q.setBindGroup(0, dev.createBindGroup({ layout: blitL, entries: [{ binding: 0, resource: t.createView({ baseMipLevel: m - 1, mipLevelCount: 1 }) }, { binding: 1, resource: samp }] })); q.draw(4); q.end();
      }
    }
    dev.queue.submit([en.finish()]);
    if (DBG) { await dev.queue.onSubmittedWorkDone(); console.log('bake ok'); }
  }

  // ---------- render targets (recreated on resize) ----------
  let RW = 0, RH = 0, volG, cmpG;
  const passSh = [0, 1].map(c => ({ colorAttachments: [], depthStencilAttachment: { view: shadowT.createView({ dimension: '2d', baseArrayLayer: c, arrayLayerCount: 1 }), depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'store' } }));
  const passMain = { colorAttachments: [{ view: null, resolveTarget: null, loadOp: 'clear', storeOp: 'discard', clearValue: [0, 0, 0, 1] }], depthStencilAttachment: { view: null, depthClearValue: 0, depthLoadOp: 'clear', depthStoreOp: 'store' } };
  const passVol = { colorAttachments: [{ view: null, loadOp: 'clear', storeOp: 'store' }, { view: null, loadOp: 'clear', storeOp: 'store' }] };
  const passCmp = { colorAttachments: [{ view: null, loadOp: 'clear', storeOp: 'store' }] }, passCom = {};
  const FW = +(Q.get('w') || 0), FH = +(Q.get('h') || 0);
  function resize() {
    const w = FW || Math.max(16, Math.floor(canvas.clientWidth * devicePixelRatio)), h = FH || Math.max(16, Math.floor(canvas.clientHeight * devicePixelRatio));
    if (w == RW && h == RH) return;
    RW = canvas.width = w; RH = canvas.height = h;
    const col = dev.createTexture({ size: [w, h], format: HDR, sampleCount: MSAA, usage: RA }), dep = dev.createTexture({ size: [w, h], format: DF, sampleCount: MSAA, usage: RA | TB });
    const res = MSAA > 1 ? dev.createTexture({ size: [w, h], format: HDR, usage: RA | TB }) : col, hw = Math.ceil(w / 2), hh = Math.ceil(h / 2);
    if (MSAA == 1) { col.destroy(); }
    const res1 = MSAA > 1 ? res : dev.createTexture({ size: [w, h], format: HDR, usage: RA | TB });
    const vC = dev.createTexture({ size: [hw, hh], format: HDR, usage: RA | TB }), vZ = dev.createTexture({ size: [hw, hh], format: 'r16float', usage: RA | TB });
    const dv = dep.createView();
    passMain.colorAttachments[0].view = MSAA > 1 ? col.createView() : res1.createView(); passMain.colorAttachments[0].resolveTarget = MSAA > 1 ? res.createView() : undefined; passMain.colorAttachments[0].storeOp = MSAA > 1 ? 'discard' : 'store';
    passMain.depthStencilAttachment.view = dv;
    passVol.colorAttachments[0].view = vC.createView(); passVol.colorAttachments[1].view = vZ.createView();
    volG = dev.createBindGroup({ layout: volL, entries: [{ binding: 0, resource: dv }] });
    if (OFF) { offT = dev.createTexture({ size: [w, h], format: fmt, usage: RA | GPUTextureUsage.COPY_SRC }); passCmp.colorAttachments[0].view = offT.createView(); }
    cmpG = dev.createBindGroup({ layout: cmpL, entries: [{ binding: 0, resource: dv }, { binding: 1, resource: res1.createView() }, { binding: 2, resource: vC.createView() }, { binding: 3, resource: vZ.createView() }] });
  }
  resize(); addEventListener('resize', resize);

  // ---------- player / camera ----------
  // CPU mirror of the GPU tree scatter: lets the player bump into trunks and keeps test poses out of them
  const pcg = v => { const s = Math.imul(v, 747796405) + 2891336453 >>> 0, w = Math.imul((s >>> (s >>> 28) + 4 ^ s) >>> 0, 277803737) >>> 0; return (w >>> 22 ^ w) >>> 0; };
  const h4 = new Float64Array(4), hash4 = (cx, cz, k) => { let a = pcg((cx >>> 0 ^ pcg((cz >>> 0) + Math.imul(k, 0x9e3779b9) >>> 0)) >>> 0); for (let i = 0; i < 4; i++) { h4[i] = (a >>> 8) / 16777216; a = pcg(a); } };
  const TR = [2.3, .75, 1.3, .7, .28, 2.1, 1.3, .8, .72, .55, .45, .35], tree = new Float64Array(15);
  function treeAt(cx, cz) {
    hash4(cx, cz, 1); const x = (cx + .12 + .76 * h4[0]) * 6, z = (cz + .12 + .76 * h4[1]) * 6, r3 = h4[3], y = H(x, z, 0), ds = W.ds;
    if (y < 2.5) return false;
    const sl = Math.hypot(H(x + 4, z, 0) - y, H(x, z + 4, 0) - y) / 4, a = zalt(x, z, y);
    let c = .84 * (1 - sst(2900, 3250, a) * .92 * (1 - sst(-.06, .16, nd(x / 170 + 2, z / 170 + 9)))) * (1 - sst(3580, 3820, a) * .62) * (1 - sst(.95, 1.6, sl)) * sst(2.5, 7, ds) * sst(1.5, 10, y);
    if (Math.hypot(x - site[0], z - site[1]) < 14 || Math.hypot(x - site[4], z - site[5]) < 17) c = 0;
    const qx = x - site[8], qz = z - site[9], qr = Math.hypot(qx, qz); if (Math.abs(qr - site[10]) < 5 && (qx * site[12] + qz * site[13]) / qr > site[14] - .01) c = 0;
    const bx = x - site[16], bz = z - site[17]; if (Math.abs(bx * site[18] + bz * site[19]) < site[22] + 7 && Math.abs(bz * site[18] - bx * site[19]) < 4.5) c = 0;
    if (r3 > c) return false;
    hash4(cx, cz, 2); let tot = 0, kind = 0;
    for (let k = 0; k < 12; k++) { const t = KT[k]; let w = t[3] * sat((a - t[0]) / t[2] + .5) * sat((t[1] - a) / t[2] + .5); if (k == 2) w *= sst(.02, .25, nd(x / 140 + 7, z / 140 + 1)) * 5; tree[k + 3] = w; tot += w; }
    if (tot < 1e-3) return false;
    let pk = h4[0] * tot; for (let k = 0; k < 12; k++) if (tree[k + 3] > 0) { kind = k; if (pk < tree[k + 3]) break; pk -= tree[k + 3]; }
    let sc = KS[kind][0] + KS[kind][1] * h4[1]; if (kind < 10) sc *= 1 - .42 * sst(3400, 3750, a);
    tree[0] = x; tree[1] = z; tree[2] = TR[kind] * sc; return true;
  }
  // nearest-trunk clearance at a point (negative = inside a trunk)
  function clearance(x, z) { let m = 1e9; const cx = Math.floor(x / 6), cz = Math.floor(z / 6); for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (treeAt(cx + i, cz + j)) m = Math.min(m, Math.hypot(x - tree[0], z - tree[1]) - tree[2]); return m; }
  const P = { x: 0, y: 0, z: 0, vy: 0, yaw: 0, pitch: 0, gy: 0, air: false, lift: 0 };
  const rng = mkrng(Q.has('seed') ? +Q.get('seed') : Math.random() * 4294967296);
  const ground = (x, z, y) => { const h = H(x, z, 0), d = deckY(x, z); return d > h && y > d - 2.2 ? d : h; };
  const place = (x, z, yaw) => { P.x = x; P.z = z; P.yaw = yaw; P.gy = P.y = Math.max(H(x, z, 0), deckY(x, z)); P.vy = 0; P.pitch = 0; };
  const look = (x, z, tx, tz) => place(x, z, Math.atan2(tx - x, z - tz));
  {
    const nx = site[18], nz = site[19], go = { summit: [site[0] + 4, site[1] + 6, site[0], site[1]], sacred: [site[4] + 18, site[5] + 24, site[4], site[5]], rail: [site[8] + site[12] * site[10], site[9] + site[13] * site[10], site[8] + site[12] * site[10] - site[13] * 30, site[9] + site[13] * site[10] + site[12] * 30], bridge: [site[16] + nx * 32, site[17] + nz * 32, site[16], site[17]] }[Q.get('goto')];
    if (go) look(...go);
    else for (; ;) { const x = (rng() - .5) * 24000, z = (rng() - .5) * 45000, h = H(x, z, 0); if (h > 8 && W.ds > 8) { const hx = H(x + 3, z, 0) - h, hz = H(x, z + 3, 0) - h; if (hx * hx + hz * hz < 9 && clearance(x, z) > 1) { place(x, z, rng() * 6.283); break; } } }
  }
  // scripted route: a straight climb from the western foothills toward Yushan (bench + critic poses)
  const route = (() => { let x = site[0] - 400; const z = site[1] - 260; while (H(x, z, 0) > 330 && x > -12000) x -= 20; return { ax: x, az: z, bx: site[0] - 420, bz: z }; })();
  const poses = [];
  { // one pose per zone near the route: gentle ground, inside forest, away from streams
    const tg = [260, 1000, 2060, 2820, 3340, 3800];
    for (let k = 0; k < 6; k++) {
      let best = 1e9, bx = 0, bz = 0, by = 0;
      for (let s = 0; s <= 1; s += .0012) for (let o = -300; o <= 300; o += 60) {
        const x = route.ax + (route.bx - route.ax) * s, z = route.az + o, h = H(x, z, 0), dsv = W.ds, a = zalt(x, z, h);
        if (Math.abs(a - tg[k]) > 70 || dsv < 40) continue;
        const gx = H(x + 6, z, 0) - h, gz = H(x, z + 6, 0) - h, sl = Math.hypot(gx, gz) / 6, m = nd(x / 170 + 2, z / 170 + 9);
        let sc = sl + (k > 2 && k < 5 && m < .2 ? 2 : 0) + Math.abs(a - tg[k]) / 400;
        if (k < 5 && sc < best + 1) { let n = 0; const cx = Math.floor(x / 6), cz = Math.floor(z / 6); for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) if (treeAt(cx + i, cz + j)) n++; sc -= n * .04; }
        if (sc < best) { best = sc; bx = x; bz = z; by = Math.atan2(-gx, gz); }
      }
      { let bc = -1e9, ox = bx, oz = bz; for (let j = -8; j <= 8; j += 1.5) for (let i = -8; i <= 8; i += 1.5) { const c = Math.min(clearance(bx + i, bz + j), 6) - Math.hypot(i, j) * .1; if (c > bc) { bc = c; ox = bx + i; oz = bz + j; } } bx = ox; bz = oz; }
      { let bs = -1e9, yw = by; const cx = Math.floor(bx / 6), cz = Math.floor(bz / 6), T = [];
        for (let j = -7; j <= 7; j++) for (let i = -7; i <= 7; i++) if (treeAt(cx + i, cz + j)) T.push(tree[0] - bx, tree[1] - bz, tree[2]);
        for (let c = 0; c < 16; c++) { const yaw = c * .3927, fx = Math.sin(yaw), fz = -Math.cos(yaw); let sc = 0;
          for (let i = 0; i < T.length; i += 3) { const d = Math.hypot(T[i], T[i + 1]), cs = (T[i] * fx + T[i + 1] * fz) / d; if (cs > .8 && d > 7 && d < 42) sc += 1; if (cs > .55 && d - T[i + 2] < 4.5) sc -= 50; }
          const dh = H(bx + fx * 25, bz + fz * 25, 0) - H(bx, bz, 0); sc -= dh > 0 ? dh * 1.2 : -dh * .15;
          if (sc > bs) { bs = sc; yw = yaw; } }
        by = yw; }
      poses.push([bx, bz, by, [.12, .14, .16, .1, .2, .0][k]]);
    }
    { // alpine: a ridge shoulder with the ground falling away in front (ridgelines + sea of clouds)
      let bs = -1e9;
      for (let j = -500; j <= 500; j += 50) for (let i = -500; i <= 500; i += 50) {
        const x = site[0] + i, z = site[1] + j, h = H(x, z, 0); if (h < 3680 || h > 3900) continue;
        for (let c = 0; c < 12; c++) { const yaw = c * .5236, fx = Math.sin(yaw), fz = -Math.cos(yaw), d1 = h - H(x + fx * 60, z + fz * 60, 0), d2 = h - H(x + fx * 400, z + fz * 400, 0);
          const sc = Math.min(d2, 260) - Math.abs(d1 - 14) * 4; if (sc > bs && clearance(x, z) > 2) { bs = sc; poses[5] = [x, z, yaw, -.06]; } }
      }
    }
  }
  const keys = {}; let locked = false;
  addEventListener('keydown', ev => { keys[ev.code] = 1; if (ev.code == 'Space') ev.preventDefault(); });
  addEventListener('keyup', ev => { keys[ev.code] = 0; });
  canvas.addEventListener('click', () => canvas.requestPointerLock());
  $('s').addEventListener('click', () => canvas.requestPointerLock());
  document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement == canvas; $('s').style.display = locked || BENCH ? 'none' : 'flex'; });
  addEventListener('mousemove', ev => { if (locked) { P.yaw += ev.movementX * .0022; P.pitch = Math.max(-1.45, Math.min(1.45, P.pitch - ev.movementY * .0022)); } });
  if (BENCH || MANUAL) $('s').style.display = 'none';

  // HUD strings are prebuilt so the frame loop never allocates
  const ALT = []; for (let i = 0; i < 4001; i++) ALT.push(i.toLocaleString('en-US') + ' m');
  const hudA = $('a').firstChild, hudZ = $('z').firstChild; let lastA = -1, lastZ = -1;

  // ---------- per-frame state (all preallocated) ----------
  let time = 0, cov = .5, beltW = .12, frameNo = 0, simT = 0;
  const sun = [.52, .62, .58]; { const l = Math.hypot(...sun); sun[0] /= l; sun[1] /= l; sun[2] /= l; }
  const lx = [0, 0, 0], ly = [0, 0, 0]; { const l = Math.hypot(sun[2], sun[0]); lx[0] = sun[2] / l; lx[2] = -sun[0] / l; ly[0] = sun[1] * lx[2]; ly[1] = sun[2] * lx[0] - sun[0] * lx[2]; ly[2] = -sun[1] * lx[0]; }
  const SR = [22, 78], SD = 400, subs = [null];
  const qs = hasTS ? dev.createQuerySet({ type: 'timestamp', count: 2 }) : null, qR = hasTS ? dev.createBuffer({ size: 16, usage: BU.QUERY_RESOLVE | BU.COPY_SRC }) : null;
  const qM = [], qFree = []; if (hasTS) for (let i = 0; i < 6; i++) { qM.push(dev.createBuffer({ size: 16, usage: BU.MAP_READ | BU.COPY_DST })); qFree.push(i); }
  const BN = 60 * 720, bGpu = new Float32Array(BN), bCpu = new Float32Array(BN); let bg = 0, bc = 0, lastGpu = 0, benchT = -1, benchDone = false;
  if (hasTS) { passCom.timestampWrites = { querySet: qs, beginningOfPassWriteIndex: 0 }; passCmp.timestampWrites = { querySet: qs, endOfPassWriteIndex: 1 }; }
  const onMap = qM.map((b, i) => () => { const a = new BigInt64Array(b.getMappedRange()); lastGpu = Number(a[1] - a[0]) / 1e6; b.unmap(); qFree.push(i); if (benchT >= 0 && !benchDone && bg < BN && lastGpu > 0) bGpu[bg++] = lastGpu; });

  let byaw = 0;
  function push(ka, kb) { const cx = Math.floor(P.x / 6), cz = Math.floor(P.z / 6); for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (treeAt(cx + i, cz + j)) { const ex = P.x - tree[0], ez = P.z - tree[1], l = Math.hypot(ex, ez), m = tree[2] * ka + kb; if (l < m && l > 1e-3) { P.x = tree[0] + ex / l * m; P.z = tree[1] + ez / l * m; } } }
  function update(dt) {
    time += dt;
    if (benchT >= 0) {
      const s = Math.min(benchT / 60, 1), x = route.ax + (route.bx - route.ax) * s, z = route.az + 40 * Math.sin(s * 40);
      P.x = x; P.z = z; push(1.5, 1.2);
      P.gy = H(P.x, P.z, 0); P.y += (P.gy - P.y) * Math.min(1, dt * 5); if (P.y < P.gy) P.y = P.gy;
      { const gx = H(P.x + 8, P.z, 0) - P.gy, gz = H(P.x, P.z + 8, 0) - P.gy, ty = Math.atan2(-gx, gz) + .9 * Math.sin(benchT * .35); let dy = ty - byaw; dy -= Math.round(dy / 6.2832) * 6.2832; byaw += dy * Math.min(1, dt * 1.5); P.yaw = byaw; }
      P.pitch = .02 + .08 * Math.sin(benchT * .23);
    } else if (!MANUAL) {
      const sp = (keys.ShiftLeft || keys.ShiftRight ? 18 : 6) * dt, f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), r = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0), l = Math.hypot(f, r) || 1;
      const s = Math.sin(P.yaw), c = Math.cos(P.yaw), dx = (s * f + c * r) / l * sp, dz = (-c * f + s * r) / l * sp;
      if (H(P.x + dx, P.z + dz, 0) > .45) { P.x += dx; P.z += dz; } else if (H(P.x + dx, P.z, 0) > .45) P.x += dx; else if (H(P.x, P.z + dz, 0) > .45) P.z += dz;
      push(.8, .3);
      const g = ground(P.x, P.z, P.y);
      if (P.air) { P.vy -= 16 * dt; P.y += P.vy * dt; if (P.y <= g) { P.y = g; P.air = false; } }
      else { P.y += (g - P.y) * Math.min(1, dt * 14); if (keys.Space) { P.vy = 5.6; P.air = true; } }
      P.gy = g;
    }
    // slow-moving atmosphere parameters
    const h = P.gy, a = zalt(P.x, P.z, h);
    let c = .84 * (1 - sst(3580, 3820, a) * .62) * (1 - sst(2900, 3250, a) * .92 * (1 - sst(-.06, .16, nd(P.x / 170 + 2, P.z / 170 + 9)))) * sst(1.5, 10, h);
    const k = Math.min(1, dt * 1.5); cov += (c - cov) * k;
    beltW += (.1 + .9 * (sat((P.y - 1450) / 250) - sat((P.y - 2300) / 300)) - beltW) * k;
    const al = Math.max(0, Math.min(4000, Math.round(P.gy))); if (al != lastA) { lastA = al; hudA.data = ALT[al]; }
    const zn = zoneOf(P.gy); if (zn != lastZ) { lastZ = zn; hudZ.data = ZONES[zn]; }
  }

  const pl = (i, ax, ay, az, d) => { const l = Math.hypot(ax, ay, az); G[76 + i * 4] = ax / l; G[77 + i * 4] = ay / l; G[78 + i * 4] = az / l; G[79 + i * 4] = d / l; };
  function uniforms() {
    const cx = P.x, cy = P.y + 1.7 + P.lift, cz = P.z, sy = Math.sin(P.yaw), cyw = Math.cos(P.yaw), sp = Math.sin(P.pitch), cp = Math.cos(P.pitch);
    const fx = sy * cp, fy = sp, fz = -cyw * cp, rx = cyw, rz = sy, ux = -sy * sp, uy = cp, uz = cyw * sp;
    const ty = 1 / Math.tan(.5 * 1.047), tx = ty * RH / RW;
    G[0] = tx * rx; G[4] = 0; G[8] = tx * rz; G[12] = 0; G[1] = ty * ux; G[5] = ty * uy; G[9] = ty * uz; G[13] = 0; G[2] = 0; G[6] = 0; G[10] = 0; G[14] = NEAR; G[3] = fx; G[7] = fy; G[11] = fz; G[15] = 0;
    G[16] = rx / tx; G[17] = 0; G[18] = rz / tx; G[19] = 0; G[20] = ux / ty; G[21] = uy / ty; G[22] = uz / ty; G[23] = 0; G[24] = 0; G[25] = 0; G[26] = 0; G[27] = 1 / NEAR; G[28] = fx; G[29] = fy; G[30] = fz; G[31] = 0;
    for (let c = 0; c < 2; c++) {
      const R = SR[c], d = R * .7; let px = fx * d, py = fy * d, pz = fz * d;
      const tex = 2 * R / 2048, wx = lx[0] * (cx + px) + lx[2] * (cz + pz), wy = ly[0] * (cx + px) + ly[1] * (cy + py) + ly[2] * (cz + pz);
      const ox = Math.round(wx / tex) * tex - wx, oy = Math.round(wy / tex) * tex - wy;
      px += lx[0] * ox + ly[0] * oy; py += ly[1] * oy; pz += lx[2] * ox + ly[2] * oy;
      const o = 32 + c * 16;
      G[o] = lx[0] / R; G[o + 4] = 0; G[o + 8] = lx[2] / R; G[o + 12] = -(lx[0] * px + lx[2] * pz) / R;
      G[o + 1] = ly[0] / R; G[o + 5] = ly[1] / R; G[o + 9] = ly[2] / R; G[o + 13] = -(ly[0] * px + ly[1] * py + ly[2] * pz) / R;
      G[o + 2] = -sun[0] / (2 * SD); G[o + 6] = -sun[1] / (2 * SD); G[o + 10] = -sun[2] / (2 * SD); G[o + 14] = .5 + (sun[0] * px + sun[1] * py + sun[2] * pz) / (2 * SD);
      G[o + 3] = 0; G[o + 7] = 0; G[o + 11] = 0; G[o + 15] = 1;
      G[96 + c * 4] = px; G[97 + c * 4] = py; G[98 + c * 4] = pz; G[99 + c * 4] = R;
    }
    G[64] = cx; G[65] = cy; G[66] = cz; G[67] = time;
    G[68] = sun[0]; G[69] = sun[1]; G[70] = sun[2]; G[71] = Q.has('zoo') ? 1 : 0;
    G[72] = RW; G[73] = RH; G[74] = 1 / RW; G[75] = 1 / RH;
    pl(0, fx + tx * rx, fy, fz + tx * rz, 0); pl(1, fx - tx * rx, fy, fz - tx * rz, 0); pl(2, fx + ty * ux, fy + ty * uy, fz + ty * uz, 0); pl(3, fx - ty * ux, fy - ty * uy, fz - ty * uz, 0); pl(4, fx, fy, fz, -NEAR);
    G[104] = .8; G[105] = .6; G[106] = 1;
    G[108] = W.S; G[109] = (.23 + .47 * cov) * (1 - .2 * beltW); G[110] = (1 - sst(450, 1100, P.gy)) * cov; G[111] = beltW;
    G[112] = (1 - sst(1500, 2700, P.gy)) * .9; G[113] = 1; G[114] = 1 - .85 * cov; G[115] = ty;
    G.set(site, 116);
    for (let l = 0; l < NLV; l++) { const s = .5 * (1 << l), o = 148 + l * 4; G[o] = Math.round(cx / (2 * s)) * 2 * s - cx; G[o + 1] = Math.round(cz / (2 * s)) * 2 * s - cz; G[o + 2] = s; }
    for (let k = 0; k < NP; k++) { propI[k * 8] = propA[k][0] - cx; propI[k * 8 + 1] = propA[k][1] - cy; propI[k * 8 + 2] = propA[k][2] - cz; }
  }

  function render() {
    resize(); uniforms(); frameNo++;
    dev.queue.writeBuffer(gB, 0, G); dev.queue.writeBuffer(drawB, 0, drawT); dev.queue.writeBuffer(propB, 0, propI);
    const en = dev.createCommandEncoder();
    let p = en.beginComputePass(passCom);
    p.setBindGroup(0, compG);
    if (!(DBG & 1)) {
    p.setPipeline(pCom[0]); p.dispatchWorkgroups(TG / 8, TG / 8);
    p.setPipeline(pCom[1]); p.dispatchWorkgroups(UG / 8, UG / 8);
    p.setPipeline(pCom[2]); p.dispatchWorkgroups(GG / 8, GG / 8);
    p.setPipeline(pCom[3]); p.dispatchWorkgroups(2, 2, 5);
    }
    p.end();
    for (let c = 0; c < 2; c++) {
      if (DBG & 2) break;
      p = en.beginRenderPass(passSh[c]);
      p.setPipeline(pSh[c]); p.setBindGroup(0, liteG); p.setVertexBuffer(0, meshVB); p.setIndexBuffer(meshIB, 'uint32');
      for (let k = 0; k < NK; k++) if (CAST(k)) { const l = k * 3 + 1 + c; p.setVertexBuffer(1, instB, LB[l] * 32); p.drawIndexedIndirect(drawB, l * 20); }
      for (let k = 0; k < NP; k++) { const m = ms.info[NK + k]; p.setVertexBuffer(1, propB, k * 32); p.drawIndexed(m.count, 1, m.first, m.base); }
      p.end();
    }
    p = en.beginRenderPass(passMain);
    p.setBindGroup(0, sceneG);
    if (!(DBG & 4)) {
    p.setPipeline(pVeg); p.setVertexBuffer(0, meshVB); p.setIndexBuffer(meshIB, 'uint32');
    for (let k = 0; k < NK; k++) { p.setVertexBuffer(1, instB, LB[k * 3] * 32); p.drawIndexedIndirect(drawB, k * 60); }
    for (let k = 0; k < NP; k++) { const m = ms.info[NK + k]; p.setVertexBuffer(1, propB, k * 32); p.drawIndexed(m.count, 1, m.first, m.base); }
    }
    if (!(DBG & 8)) {
    p.setPipeline(pTer); p.setVertexBuffer(0, terVB); p.setIndexBuffer(terIB, 'uint32'); p.drawIndexed(terN);
    }
    if (!(DBG & 16)) { p.setPipeline(pImp); p.setVertexBuffer(0, instB, LB[NK * 3] * 32); p.drawIndirect(drawB, NK * 60); }
    if (!(DBG & 32)) { p.setPipeline(pSky); p.draw(4); }
    if (!(DBG & 64)) { p.setPipeline(pPar); p.draw(4, NPOL + NFLY); }
    p.end();
    p = en.beginRenderPass(passVol); p.setPipeline(pVol); p.setBindGroup(0, sceneG); p.setBindGroup(1, volG); if (!(DBG & 128)) p.draw(4); p.end();
    if (!OFF) passCmp.colorAttachments[0].view = ctx.getCurrentTexture().createView();
    p = en.beginRenderPass(passCmp); p.setPipeline(pCmp); p.setBindGroup(0, sceneG); p.setBindGroup(1, cmpG); p.draw(4); p.end();
    let qi = -1;
    if (hasTS) { en.resolveQuerySet(qs, 0, 2, qR, 0); if (qFree.length) { qi = qFree.pop(); en.copyBufferToBuffer(qR, 0, qM[qi], 0, 16); } }
    subs[0] = en.finish(); dev.queue.submit(subs);
    if (qi >= 0) qM[qi].mapAsync(GPUMapMode.READ).then(onMap[qi]);
  }

  let last = 0;
  function frame(now) {
    const dt = Math.min(.1, (now - last) / 1000) || 1 / 60;
    if (benchT >= 0 && !benchDone) { if (last && bc < BN) bCpu[bc++] = now - last; benchT += dt; if (benchT >= 60) finishBench(); }
    last = now; update(dt); render();
    requestAnimationFrame(frame);
  }
  function stats(a, n) { const s = Array.from(a.subarray(0, n)).sort((x, y) => x - y); let m = 0; for (const v of s) m += v; return { n, avg: +(m / n).toFixed(3), p99: +s[Math.floor(n * .99)].toFixed(3), max: +s[n - 1].toFixed(3) }; }
  function finishBench() {
    benchDone = true;
    const r = { seed: Q.get('seed') || 'random', resolution: RW + 'x' + RH, msaa: MSAA, gpu: adapter.info ? (adapter.info.vendor + ' ' + adapter.info.architecture + ' ' + adapter.info.description).trim() : '', altitude: [Math.round(H(route.ax, route.az, 0)), Math.round(P.gy)], gpuMs: bg ? stats(bGpu, bg) : 'timestamp-query unavailable', frameMs: stats(bCpu, bc) };
    window.__bench = r; console.log('BENCH ' + JSON.stringify(r));
    msg.textContent = 'Walk-through complete\n' + JSON.stringify(r, null, 1); msg.style.display = 'block';
  }
  // test hooks (manual stepping for headless capture)
  window.__t = {
    poses, route, site, P, info: ms.info,
    pose(i) { const q = poses[i]; place(q[0], q[1], q[2]); P.pitch = q[3]; cov = 1; update(0); update(0); },
    set(x, z, yaw, pitch) { place(x, z, yaw); P.pitch = pitch; },
    look(x, z, tx, tz, pitch, lift) { look(x, z, tx, tz); P.pitch = pitch || 0; P.lift = lift || 0; },
    step(dt) { update(dt); render(); return dev.queue.onSubmittedWorkDone(); },
    path(s, dt) { benchT = s * 60; for (let k = 0; k < 12; k++) update(dt); benchT = -1; render(); return dev.queue.onSubmittedWorkDone(); },
    gpu: () => lastGpu, H, zalt, clearance,
    async inst(l, n) { const b = dev.createBuffer({ size: n * 32, usage: BU.COPY_DST | BU.MAP_READ }), en = dev.createCommandEncoder(); en.copyBufferToBuffer(instB, LB[l] * 32, b, 0, n * 32); dev.queue.submit([en.finish()]); await b.mapAsync(GPUMapMode.READ); const a = Array.from(new Float32Array(b.getMappedRange())).map(x => +x.toFixed(2)).join(','); b.unmap(); return a; },
    async counts() { const b = dev.createBuffer({ size: drawT.byteLength, usage: BU.COPY_DST | BU.MAP_READ }), en = dev.createCommandEncoder(); en.copyBufferToBuffer(drawB, 0, b, 0, drawT.byteLength); dev.queue.submit([en.finish()]); await b.mapAsync(GPUMapMode.READ); const a = new Uint32Array(b.getMappedRange()), o = []; for (let l = 0; l < NL; l++) o.push(a[l * 5 + 1]); b.unmap(); return o.join(','); },
    async png() {
      const bpr = RW * 4 + 255 & ~255, b = dev.createBuffer({ size: bpr * RH, usage: BU.COPY_DST | BU.MAP_READ }), en = dev.createCommandEncoder();
      en.copyTextureToBuffer({ texture: offT }, { buffer: b, bytesPerRow: bpr }, [RW, RH]); dev.queue.submit([en.finish()]);
      await b.mapAsync(GPUMapMode.READ); const src = new Uint8Array(b.getMappedRange()), cv = document.createElement('canvas'); cv.width = RW; cv.height = RH;
      const c2 = cv.getContext('2d'), im = c2.createImageData(RW, RH), bgr = fmt == 'bgra8unorm';
      for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) { const i = y * bpr + x * 4, o = (y * RW + x) * 4; im.data[o] = src[i + (bgr ? 2 : 0)]; im.data[o + 1] = src[i + 1]; im.data[o + 2] = src[i + (bgr ? 0 : 2)]; im.data[o + 3] = 255; }
      c2.putImageData(im, 0, 0); b.unmap(); b.destroy(); return cv.toDataURL('image/png');
    },
  };
  if (Q.has('shot')) window.__t.pose(+Q.get('shot'));
  if (BENCH) { benchT = 0; P.y = H(route.ax, route.az, 0); }
  $('l').style.display = 'none';
  if (!MANUAL) requestAnimationFrame(frame); else { update(0); render(); if (DBG) { await dev.queue.onSubmittedWorkDone(); console.log('frame ok'); } }
  window.__ready = true;
}
main().catch(e => { console.error(e); fail(String(e)); });
