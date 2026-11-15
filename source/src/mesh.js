// Procedural meshes. Vertex = 17 floats while building: pos3 nrm3 ao uv2 col3 flex mat cell phase anim
import { mkrng, site, H, deckY, sat } from './world.js';
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const perp = a => norm(Math.abs(a[1]) > .95 ? cross(a, [1, 0, 0]) : cross(a, [0, 1, 0]));
const cos = Math.cos, sin = Math.sin, PI = Math.PI;
let R, M;
const vtx = (p, n, ao, u, v, c, fl, mat, cell, ph, an) => { M.v.push(p[0], p[1], p[2], n[0], n[1], n[2], ao, u, v, c[0], c[1], c[2], fl, mat, cell, ph, an); return M.n++; };
const jit = (c, a) => { const k = 1 + (R() - .5) * a; return [c[0] * k, c[1] * (k + (R() - .5) * a * .5), c[2] * k]; };

function tube(pts, rs, sides, col, o = {}) {
  const n = pts.length, urep = Math.max(1, Math.round(rs[0] * 5)); let L = 0, nr = perp(norm(sub(pts[1], pts[0]))); const b0 = M.n;
  for (let i = 0; i < n; i++) {
    const t = norm(sub(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]));
    nr = norm(sub(nr, mul(t, dot(nr, t)))); const bi = cross(t, nr), k = i / (n - 1);
    if (i) L += Math.hypot(...sub(pts[i], pts[i - 1]));
    for (let s = 0; s <= sides; s++) {
      const a = s / sides * 2 * PI, d = add(mul(nr, cos(a)), mul(bi, sin(a))), r = rs[i] * (o.flare ? o.flare(pts[i][1], a) : 1);
      vtx(add(pts[i], mul(d, r)), d, (o.ao0 ?? .8) + ((o.ao1 ?? .8) - (o.ao0 ?? .8)) * k, o.uv ? o.uv[0] : s / sides * urep, o.uv ? o.uv[1] : L / 1.2, col, (o.f0 || 0) + ((o.f1 || 0) - (o.f0 || 0)) * k, o.mat || 0, o.cell || 0, o.ph || 0, o.an || 0);
    }
  }
  for (let i = 0; i < n - 1; i++) for (let s = 0; s < sides; s++) { const a = b0 + i * (sides + 1) + s, b = a + sides + 1; M.i.push(a, b, a + 1, a + 1, b, b + 1); }
}
function card(b, U, Rv, len, wid, cell, col, o = {}) {
  let N = norm(cross(Rv, U)); const rows = o.bend ? 3 : 2, b0 = M.n;
  if (o.nc) { if (dot(N, o.nc) < 0) N = mul(N, -1); N = norm(add(mul(N, 1 - o.nk), mul(o.nc, o.nk))); }
  for (let r = 0; r < rows; r++) {
    const t = r / (rows - 1), c = add(add(b, mul(U, len * t)), mul(norm(cross(Rv, U)), (o.bend || 0) * len * 4 * t * (1 - t)));
    for (let s = 0; s < 2; s++) vtx(add(c, mul(Rv, (s - .5) * wid)), N, o.ao ?? 1, o.uv ? o.uv[0] : s, o.uv ? o.uv[1] : 1 - t, col, (o.f0 || 0) + ((o.f1 ?? 1) - (o.f0 || 0)) * t, o.mat ?? 1, cell, o.ph || 0, o.an || 0);
  }
  for (let r = 0; r < rows - 1; r++) { const a = b0 + r * 2; M.i.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
}
// arching frond strip (ferns, strap leaves)
function frond(b, d, len, wid, cell, col, rise, droop, o = {}) {
  const n = 5, b0 = M.n, side = norm(cross(d, [0, 1, 0]));
  for (let s = 0; s <= n; s++) {
    const t = s / n, p = add(b, add(mul(d, len * t * .85), [0, len * (rise * t - droop * t * t), 0]));
    const tg = norm(add(mul(d, .85), [0, rise - 2 * droop * t, 0])), nn = norm(cross(side, tg)), w = wid * (o.tap ? 1 - .5 * t : 1);
    for (let k = 0; k < 2; k++) vtx(add(p, mul(side, (k - .5) * w)), nn[1] < 0 ? mul(nn, -1) : nn, o.ao ?? .9, k, 1 - t, col, (o.f0 || .1) + (1 - (o.f0 || .1)) * t, 1, cell, o.ph || 0, 0);
  }
  for (let s = 0; s < n; s++) { const a = b0 + s * 2; M.i.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
}
function ell(c, r, col, o = {}) {
  const az = norm(o.ax || [0, 0, 1]), ax = perp(az), ay = cross(az, ax), nr = o.nr || 5, ns = o.ns || 8, b0 = M.n;
  for (let i = 0; i <= nr; i++) for (let s = 0; s <= ns; s++) {
    const th = i / nr * PI, ph = s / ns * 2 * PI; let l = [sin(th) * cos(ph), sin(th) * sin(ph), cos(th)];
    const k = o.bump ? 1 + o.bump * (sin(l[0] * 5.1 + o.sd) * sin(l[1] * 4.3 + o.sd * 2) + sin(l[2] * 6.2 + o.sd * 3) * .7 + sin(l[0] * 11 + l[2] * 9 + o.sd) * .3) : 1;
    const p = add(c, add(add(mul(ax, l[0] * r[0] * k), mul(ay, l[1] * r[1] * k)), mul(az, l[2] * r[2] * k)));
    const nn = norm(add(add(mul(ax, l[0] / r[0]), mul(ay, l[1] / r[1])), mul(az, l[2] / r[2])));
    vtx(p, nn, o.ao ?? 1, o.uv ? o.uv[0] : s / ns * 3, o.uv ? o.uv[1] : i / nr * 2, col, o.fl || 0, o.mat ?? 2, o.cell || 0, 0, o.an || 0);
  }
  for (let i = 0; i < nr; i++) for (let s = 0; s < ns; s++) { const a = b0 + i * (ns + 1) + s, b = a + ns + 1; M.i.push(a, b, a + 1, a + 1, b, b + 1); }
}
function box(c, h, col, o = {}) {
  const ux = o.ux || [1, 0, 0], uy = o.uy || [0, 1, 0], uz = o.uz || cross(ux, uy), B = [ux, uy, uz];
  for (let f = 0; f < 6; f++) {
    const a = f >> 1, sg = f & 1 ? 1 : -1, n = mul(B[a], sg), u = B[(a + 1) % 3], v = B[(a + 2) % 3], hu = h[(a + 1) % 3], hv = h[(a + 2) % 3], cc = add(c, mul(B[a], sg * h[a])), b0 = M.n;
    for (let k = 0; k < 4; k++) { const su = k & 1 ? 1 : -1, sv = k & 2 ? 1 : -1; vtx(add(cc, add(mul(u, su * hu), mul(v, sv * hv))), n, o.ao ?? 1, o.uv ? o.uv[0] : su * hu, o.uv ? o.uv[1] : sv * hv, col, o.fl || 0, o.mat ?? 2, o.cell || 0, 0, o.an || 0); }
    M.i.push(b0, b0 + 1, b0 + 2, b0 + 1, b0 + 3, b0 + 2);
  }
}

// ---------- trees ----------
function limb(T, o, d, len, r, lv, ph) {
  const sg = T.sg[lv], pts = [], rs = []; let p = o, dir = d; const st = len / sg;
  for (let i = 0; i <= sg; i++) {
    pts.push(p); rs.push(r * (1 - (1 - T.tp[lv]) * i / sg));
    dir = norm([dir[0] + (R() - .5) * T.wb[lv], dir[1] + T.up[lv] / sg + (R() - .5) * T.wb[lv] * .5, dir[2] + (R() - .5) * T.wb[lv]]); p = add(p, mul(dir, st));
  }
  const aoa = q => sat(.3 + .7 * Math.hypot(...sub(q, T.cc)) / T.cr) * (lv ? 1 : .85);
  tube(pts, rs, T.sd[lv], T.bark, { cell: T.bs, f0: lv ? T.fx[lv - 1] : 0, f1: T.fx[lv], ph, flare: lv ? null : T.flare, ao0: lv ? aoa(pts[0]) : .5, ao1: lv ? aoa(p) : .75 });
  if (T.on) T.on(lv, pts, rs);
  if (lv < T.dp) for (let k = 0, n = T.nb[lv]; k < n; k++) {
    const t = T.t0[lv] + (1 - T.t0[lv]) * (k + .2 + R() * .6) / n, f = t * sg, i = Math.min(sg - 1, f | 0), q = mix(pts[i], pts[i + 1], f - i), a = norm(sub(pts[i + 1], pts[i]));
    const u = perp(a), v = cross(a, u), az = k * 2.39996 + R() * .8, an = T.an[lv] + (R() - .5) * .25, s = add(mul(u, cos(az)), mul(v, sin(az)));
    let cd = norm(add(mul(a, cos(an)), mul(s, sin(an)))); if (T.bias) cd = norm(add(cd, T.bias));
    limb(T, q, cd, T.ln[lv] * T.shape(t, lv) * (.8 + R() * .4), Math.max(rs[i] * T.rr[lv], .02), lv + 1, R());
  }
  if (lv >= T.lf) T.leaf(T, pts, ph, lv, len, aoa);
}
function clus(T, pts, ph, lv, len, aoa) {
  for (let j = 0, n = T.nc; j < n; j++) {
    const f = (.2 + .8 * (j + R()) / n) * (pts.length - 1), i = Math.min(pts.length - 2, f | 0), q = mix(pts[i], pts[i + 1], f - i), a = norm(sub(pts[i + 1], pts[i])), out = norm(sub(q, T.cc));
    const U = norm([a[0] * .5 + out[0] * .6 + (R() - .5) * .9, a[1] * .5 + out[1] * .6 + (R() - .5) * .9 + (T.dr || .15), a[2] * .5 + out[2] * .6 + (R() - .5) * .9]);
    const s = T.cs * (.75 + R() * .5);
    card(q, U, norm(cross(U, [R() - .5, .6 + R(), R() - .5])), s, s * .95, T.cell, jit(T.lc, .3), { f0: T.fx[lv] * .8, f1: 1, ph, nc: norm(add(out, [0, .35, 0])), nk: .7, ao: aoa(add(q, mul(U, s * .5))) });
  }
}
function spray(T, pts, ph, lv, len, aoa) {
  const n = Math.max(2, Math.round(len / T.sp));
  for (let j = 0; j <= n; j++) {
    const f = (.18 + .82 * j / n) * (pts.length - 1), i = Math.min(pts.length - 2, f | 0), q = mix(pts[i], pts[i + 1], f - i), a = norm(sub(pts[i + 1], pts[i]));
    const side = norm(cross(a, [0, 1, 0])), upv = cross(side, a), s = T.cs * (1 - .5 * j / n) * (.8 + R() * .4), out = norm([q[0], .5, q[2]]);
    const o = { f0: T.fx[lv] * .7, f1: 1, ph, nc: norm(add(out, [0, .6, 0])), nk: .55, ao: sat(aoa(q) * (.75 + .25 * j / n)) };
    if (j == n) { card(q, a, side, s * 1.2, s, T.cell, jit(T.lc, .25), o); break; }
    for (const sg of [-1, 1]) {
      const U = norm(add(add(mul(side, sg * .85), mul(a, .55)), mul(upv, T.dr + (R() - .5) * .3))), N0 = norm(add(upv, mul(side, sg * (.45 + R() * .5))));
      card(q, U, norm(cross(U, N0)), s, s * .8, T.cell, jit(T.lc, .25), { ...o, bend: -.06 });
    }
    if (j & 1) { const U = norm(add(mul(a, .6), mul(upv, -.7 + T.dr))); card(q, U, norm(cross(U, side)), s * .8, s * .7, T.cell, jit(T.lc, .25), o); }
  }
}
const flare = (b, hb, n, p) => (y, a) => 1 + b * Math.exp(-y / hb) * (.35 + .65 * Math.pow(Math.abs(cos(a * n / 2)), p));
const base = { tp: [.3, .14, .12, .1], sg: [9, 5, 3, 3], sd: [9, 5, 3, 3], fx: [.02, .2, .5, .8], wb: [.06, .25, .35, .4], up: [0, .3, .2, 0], rr: [.45, .5, .5], bs: 0, lf: 2, dp: 2, shape: () => 1, leaf: clus, az: 0 };
function tree(P) {
  const T = { ...base, ...P };
  if (T.perch) tube([[.3, 5.2, 0], [1.55, 5.3, 0], [2.9, 5.55, 0]], [.14, .12, .07], 5, T.bark, { ao0: .6, ao1: .7 });
  limb(T, [0, -.4, 0], norm(T.d0 || [(R() - .5) * .08, 1, (R() - .5) * .08]), T.h, T.r, 0, 0);
}
function nest(q, s) { for (let k = 0; k < 9; k++) { const a = k * 2.4 + R(); frond(q, [cos(a), 0, sin(a)], s * (.8 + R() * .4), s * .3, 7, jit([.8, .8, .8], .3), 1.25, .7, { ao: .8, ph: R(), f0: .05 }); } }
function hang(a, b, sagv, r, col, leaves) {
  const pts = [], rs = []; for (let i = 0; i <= 8; i++) { const t = i / 8, p = mix(a, b, t); p[1] -= sagv * 4 * t * (1 - t); pts.push(p); rs.push(r); }
  tube(pts, rs, 3, col, { f0: .1, f1: .1, ph: R(), ao0: .7, ao1: .7 });
  if (leaves) for (let i = 1; i < 8; i++) card(pts[i], norm([R() - .5, -.8, R() - .5]), norm([R() - .5, 0, R() - .5]), .7, .6, 0, [.7, .8, .7], { ph: R(), f0: .3, ao: .7 });
}
const GEN = [
  () => { // 0 banyan
    const roots = [];
    tree({
      h: 5.5, r: 1.15, tp: [.8, .12, .1], sg: [5, 9, 5], sd: [14, 7, 4], nb: [7, 6], t0: [.55, .25], an: [1.2, .8], ln: [12.5, 5.5], up: [0, .4, .3], wb: [.05, .42, .5], bark: [.3, .26, .2], bs: 0, flare: flare(1.3, 2.2, 9, 2.5), cell: 0, cs: 2.4, nc: 10, lc: [.7, .78, .62], cc: [0, 9, 0], cr: 13,
      on: (lv, pts) => { if (lv == 1) for (let i = 2; i < pts.length; i++) if (R() < .75) roots.push(pts[i]); if (lv == 1 && R() < .5) nest(pts[1], .75); }
    });
    for (const q of roots) { const thick = R() < .3, g = [q[0] + (R() - .5), thick ? -.3 : q[1] * (.1 + R() * .5), q[2] + (R() - .5)]; hang(add(q, [0, -.1, 0]), g, 0, thick ? .13 + R() * .1 : .025 + R() * .03, [.25, .21, .17]); }
    for (let k = 0; k < 4; k++) hang(roots[(k * 3 + 1) % roots.length], roots[(k * 3 + 2) % roots.length], 3 + R() * 3, .035, [.12, .13, .07], 1);
  },
  () => tree({ perch: 1, h: 15, r: .42, nb: [8, 6], t0: [.45, .3], an: [.85, .75], ln: [8, 4], bark: [.27, .22, .16], cell: 0, cs: 2.2, nc: 11, lc: [.75, .8, .7], cc: [0, 14, 0], cr: 9, flare: flare(.9, .7, 5, 2), on: (lv, pts) => { if (lv == 1 && R() < .25) hang(pts[3], [pts[4][0] * .4, 0, pts[4][2] * .4], 1, .03, [.13, .13, .08], 1); } }),
  () => { // 2 bamboo clump
    for (let k = 0; k < 15; k++) {
      const a = k * 2.4, rr = .25 + R() * 1.2, o = [cos(a) * rr, -.2, sin(a) * rr], h = 11 + R() * 6, pts = [], rs = [], lean = .1 + R() * .28;
      for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(add(o, [cos(a) * lean * h * t * t, h * t * (1 - .12 * t * t), sin(a) * lean * h * t * t])); rs.push(.055 * (1 - .75 * t)); }
      const ph = R(); tube(pts, rs, 5, jit([.3, .42, .13], .3), { cell: 1, f0: 0, f1: .6, ph, ao0: .55, ao1: .95 });
      for (let i = 3; i <= 8; i++) for (let j = 0; j < 3; j++) { const b = R() * 6.28, U = norm([cos(b), -.15 + R() * .5, sin(b)]); card(pts[i], U, norm(cross(U, [0, 1, 0])), 1.5 + R(), 1.3, 5, jit([.8, .85, .7], .25), { ph, f0: i / 14, ao: .6 + i * .05, nc: [0, 1, 0], nk: .4 }); }
    }
  },
  () => tree({ perch: 1, h: 14, r: .45, nb: [9, 6], t0: [.4, .3], an: [.95, .8], ln: [7.5, 3.6], up: [0, .35, .15], bark: [.24, .2, .15], cell: 1, cs: 1.9, nc: 12, lc: [.8, .8, .78], cc: [0, 12.5, 0], cr: 8.5, flare: flare(.7, .6, 6, 2), on: (lv, pts) => { if (lv == 1 && R() < .6) nest(pts[1 + (R() * 2 | 0)], 1.1); if (lv == 0) { nest([.45, 3.2, .1], 1.1); nest([-.35, 6.5, -.3], 1.); } } }),
  () => { // 4 tree fern
    const pts = [], rs = []; for (let i = 0; i <= 5; i++) { pts.push([sin(i * .9) * .12, -.3 + i * 1.3, cos(i * 1.3) * .1]); rs.push(.2 - i * .012); }
    tube(pts, rs, 6, [.09, .07, .05], { ao0: .5, ao1: .8, f1: .05 });
    const top = pts[5];
    for (let k = 0; k < 15; k++) { const a = k * 2.4 + R() * .4; frond(top, [cos(a), 0, sin(a)], 3 + R() * .8, 1.25, 4, jit([.8, .85, .75], .25), .75 - (k % 3) * .2, .85, { ph: R(), ao: .85 + .15 * R() }); }
    for (let k = 0; k < 5; k++) { const a = k * 1.3; frond(top, [cos(a), 0, sin(a)], 2.2, .8, 4, [.42, .27, .12], -.2, .9, { ph: R(), ao: .6 }); }
  },
  () => tree({ h: 40, r: 1.45, tp: [.22, .3, .3], sg: [12, 5, 3], sd: [14, 5, 3], nb: [17, 4], t0: [.5, .3], an: [1.25, .8], ln: [8.5, 3.3], up: [0, .12, .1], bark: [.36, .18, .11], bs: 2, cell: 2, cs: 2.5, nc: 6, dr: -.2, lc: [.78, .8, .7], cc: [0, 31, 0], cr: 10, flare: flare(.7, 2.5, 7, 2), shape: t => (1 - .55 * t) * (.6 + R() * .7), on: (lv, pts) => { if (lv == 1 && R() < .6) card(pts[2], [0, -1, 0], norm([R() - .5, 0, R() - .5]), 1.6, 1.1, 14, [.8, .8, .8], { ph: R(), f0: .2, ao: .7 }); } }),
  () => tree({ h: 33, r: .95, tp: [.15, .3, .3], sg: [12, 5, 3], sd: [12, 5, 3], nb: [24, 3], t0: [.42, .35], an: [1.3, .8], ln: [6.2, 2.4], up: [0, .05, .1], bark: [.38, .21, .14], bs: 2, cell: 2, cs: 2.1, nc: 5, dr: -.25, lc: [.6, .7, .62], cc: [0, 24, 0], cr: 9, flare: flare(.5, 1.5, 6, 2), shape: t => (1 - .75 * t) * (.8 + R() * .4) }),
  () => tree({ h: 30, r: .72, tp: [.1, .25], sg: [12, 5], sd: [10, 4], dp: 1, lf: 1, leaf: spray, nb: [26], t0: [.36], an: [1.4], ln: [7.5], up: [.0, -.3], wb: [.05, .12], bark: [.18, .15, .13], bs: 3, cell: 11, cs: 2.9, sp: 1.0, dr: -.2, lc: [.75, .8, .75], cc: [0, 20, 0], cr: 9, shape: t => (1 - .6 * t * t) * (.6 + R() * .7), d0: [.03, 1, .02] }),
  () => tree({ h: 36, r: .68, tp: [.06, .25], sg: [12, 5], sd: [10, 4], dp: 1, lf: 1, leaf: spray, nb: [38], t0: [.28], an: [1.5], ln: [5.6], up: [0, -.55], wb: [.03, .08], bark: [.2, .16, .14], bs: 3, cell: 3, cs: 2.5, sp: .85, dr: -.45, lc: [.6, .68, .62], cc: [0, 22, 0], cr: 7, shape: t => (1 - .88 * t) + .06 }),
  () => tree({ h: 26, r: .5, tp: [.06, .25], sg: [10, 4], sd: [9, 4], dp: 1, lf: 1, leaf: spray, nb: [40], t0: [.3], an: [1.5], ln: [4.4], up: [0, -.08], wb: [.02, .05], bark: [.33, .32, .3], bs: 3, cell: 3, cs: 2.1, sp: .75, dr: -.05, lc: [.62, .72, .74], cc: [0, 17, 0], cr: 5.5, shape: t => (1 - .88 * t) + .08 }),
  () => tree({ h: 16, r: .42, tp: [.3, .2], sg: [9, 3], sd: [8, 4], dp: 1, lf: 9, nb: [11], t0: [.35], an: [1.2], ln: [1.9], up: [0, 0], wb: [.07, .3], bark: [.3, .29, .27], bs: 4, cc: [0, 10, 0], cr: 3, fx: [.01, .05] }),
  () => tree({ h: 2.6, r: .3, tp: [.5, .35, .3], sg: [6, 4, 3], sd: [8, 5, 3], nb: [7, 3], t0: [.3, .3], an: [1.1, .7], ln: [2.1, 1.], up: [0, .1, .1], wb: [.7, .6, .5], bark: [.33, .25, .2], bs: 4, cell: 10, cs: 1.05, nc: 5, lc: [.8, .8, .8], cc: [1.2, 1.6, 0], cr: 2.5, d0: [.7, .7, 0], bias: [.9, -.05, 0], fx: [.01, .08, .25] }),
  () => { // 12 giant taro
    for (let k = 0; k < 7; k++) {
      const a = k * 2.4 + R(), l = .9 + R() * .9, d = [cos(a), 0, sin(a)], tip = add([0, 0, 0], add(mul(d, l * .55), [0, l, 0])), pts = [[0, -.1, 0], add(mul(d, l * .15), [0, l * .6, 0]), tip];
      tube(pts, [.035, .028, .02], 4, [.2, .36, .12], { cell: 1, f0: 0, f1: .5, ph: k / 7 });
      const U = norm(add(d, [0, -.55 - R() * .3, 0])); card(add(tip, mul(U, -.25)), U, norm(cross(U, [0, 1, 0])), 1.15 + R() * .4, 1.05 + R() * .3, 6, jit([.8, .8, .8], .25), { f0: .5, f1: 1, ph: k / 7, nc: [0, 1, 0], nk: .5, bend: .08 });
    }
  },
  () => { for (let k = 0; k < 10; k++) { const a = k * 2.4 + R() * .5; frond([0, -.05, 0], [cos(a), 0, sin(a)], 1.1 + R() * .6, .5, 4, jit([.8, .82, .75], .3), .95 - (k % 3) * .25, .9, { ph: R() }); } },
  () => { // 14 shrub
    for (let k = 0; k < 6; k++) {
      const a = k * 2.4, d = norm([cos(a) * .5, 1, sin(a) * .5]), l = 1.4 + R() * 1.2, pts = [[0, -.1, 0], mul(d, l * .5), add(mul(d, l), [cos(a) * .3, 0, sin(a) * .3])];
      tube(pts, [.035, .025, .012], 3, [.18, .15, .11], { f1: .4, ph: k / 6 });
      for (let j = 0; j < 4; j++) { const q = mix(pts[1], pts[2], R()), U = norm([cos(a) + R() - .5, .2 + R() * .8, sin(a) + R() - .5]); card(q, U, norm(cross(U, [R() - .5, 1, R() - .5])), 1.1 + R() * .5, 1.1, j & 1, jit([.75, .8, .7], .3), { f0: .4, ph: k / 6, nc: norm(add(q, [0, .5, 0])), nk: .6, ao: .75 + .25 * R() }); }
    }
  },
  () => { // 15 rhododendron
    for (let k = 0; k < 26; k++) { const a = k * 2.4, e = .25 + R() * 1.1, d = [cos(a) * sin(e), cos(e), sin(a) * sin(e)], q = mul(d, .35 + R() * .25); card([q[0], q[1] - .1, q[2]], d, norm(cross(d, [R() - .5, .3, R() - .5])), .85 + R() * .3, .85, 9, jit([.8, .8, .8], .25), { f0: .1, f1: .5, ph: R(), nc: d, nk: .7, ao: .65 + .35 * cos(e) }); }
  },
  () => ell([0, .25, 0], [1, .85, .62], [.2, .19, .17], { nr: 7, ns: 10, bump: .11, sd: 3.3, cell: 1, ax: [0, 1, 0] }),
  () => { for (let k = 0; k < 4; k++) { const a = k * .8 + .3; card([cos(a * 3) * .15, -.22, sin(a * 3) * .15], norm([cos(a * 5) * .12, 1, sin(a * 5) * .12]), [cos(a), 0, sin(a)], .85, 1.2, 8, jit([.62, .7, .6], .2), { f0: 0, f1: 1, ph: k / 4, nc: [0, 1, 0], nk: .75, ao: .9 }); } },
  () => { for (let k = 0; k < 3; k++) { const a = k * 1.05; card([0, -.03, 0], norm([cos(a * 4) * .2, 1, sin(a * 4) * .2]), [cos(a), 0, sin(a)], .55, .8, k ? 8 : 4, [.5, .75, .45], { f0: 0, f1: 1, ph: k / 3, nc: [0, 1, 0], nk: .8 }); } for (let k = 0; k < 4; k++) { const a = k * 1.6 + .5; frond([0, 0, 0], [cos(a), 0, sin(a)], .55, .22, 4, [.7, .85, .6], .7, .8, { ph: k / 4 }); } },
  // ---------- animals (forward = +z) ----------
  () => { for (const s of [-1, 1]) { const b0 = M.n; for (const [x, z, u, v] of [[0, -.05, 0, 0], [0, .06, 0, 1], [.09, -.07, 1, 0], [.085, .08, 1, 1]]) vtx([x * s, 0, z], [0, 1, 0], 1, 1.15, 0, [.8, .8, .8], 0, 1, 13, 0, 4), M.v[M.v.length - 10] = u, M.v[M.v.length - 9] = v; M.i.push(b0, b0 + 1, b0 + 2, b0 + 1, b0 + 3, b0 + 2); } },
  () => { ell([0, 0, 0], [.035, .035, .13], [.06, .06, .07], { nr: 3, ns: 5 }); for (const s of [-1, 1]) { const b0 = M.n; for (const [x, z] of [[0, .07], [0, -.07], [.3, -.03]]) vtx([x * s, 0, z], [0, 1, 0], 1, .8, 0, [.07, .07, .08], 0, 2, 0, 0, 4); M.i.push(b0, b0 + 1, b0 + 2); } },
  () => { // 21 macaque (sitting)
    const f = [.3, .27, .23], d = [.22, .2, .18];
    ell([0, .28, 0], [.15, .24, .14], f, { ax: [0, 1, 0] }); ell([0, .6, .04], [.105, .11, .1], f, { an: 3, uv: [.25, .06] }); ell([0, .585, .12], [.065, .07, .04], [.5, .3, .26], { an: 3, uv: [.25, .06] });
    for (const s of [-1, 1]) { tube([[.13 * s, .42, .02], [.19 * s, .22, .12], [.14 * s, .05, .2]], [.04, .035, .03], 4, d, { mat: 2 }); tube([[.1 * s, .12, .0], [.2 * s, .14, .16], [.16 * s, .0, .24]], [.055, .045, .035], 4, d, { mat: 2 }); }
    tube([[0, .1, -.12], [0, -.1, -.2], [0, -.34, -.19], [0, -.5, -.15]], [.025, .022, .02, .015], 4, d, { mat: 2, an: 5, uv: [.12, 0] });
  },
  () => { // 22 pheasant (Swinhoe's: dark blue, white crest/back, red face)
    const b = [.035, .05, .16];
    ell([0, .3, 0], [.1, .11, .2], b, { ax: [0, .25, 1] }); ell([0, .37, -.06], [.07, .05, .1], [.8, .8, .82]); ell([0, .43, .2], [.045, .1, .05], b, { ax: [0, 1, .4], an: 3, uv: [.6, .22] });
    ell([0, .5, .25], [.04, .042, .055], [.55, .05, .04], { an: 3, uv: [.6, .22] }); ell([0, .49, .31], [.012, .012, .03], [.6, .55, .3], { an: 3, uv: [.6, .22] });
    tube([[0, .33, -.16], [0, .36, -.4], [0, .3, -.62], [0, .2, -.78]], [.05, .045, .03, .008], 4, [.75, .75, .78], { mat: 2, an: 5, uv: [.05, 0] });
    for (const s of [-1, 1]) tube([[.05 * s, .22, 0], [.05 * s, .1, .01], [.05 * s, 0, 0]], [.014, .01, .012], 3, [.6, .12, .1], { mat: 2, an: s > 0 ? 1 : 2, uv: [.22, .22] });
  },
  () => { // 23 deer (sambar)
    const b = [.13, .09, .06], d = [.08, .055, .04];
    ell([0, .98, 0], [.24, .27, .62], b); ell([0, 1.18, .62], [.11, .13, .36], b, { ax: [0, .75, .65], an: 3, uv: [.5, 1] }); ell([0, 1.5, .93], [.085, .1, .19], b, { ax: [0, -.25, 1], an: 3, uv: [1, 1] });
    ell([0, 1.45, 1.1], [.045, .05, .05], [.04, .03, .03], { an: 3, uv: [1.1, 1] });
    for (const s of [-1, 1]) {
      ell([.1 * s, 1.63, .84], [.03, .09, .05], d, { ax: [s * .5, 1, 0], an: 3, uv: [1, 1] });
      tube([[.06 * s, 1.6, .88], [.12 * s, 1.85, .82], [.2 * s, 2.05, .9]], [.018, .014, .008], 3, [.5, .45, .36], { mat: 2, an: 3, uv: [1, 1] });
      for (const z of [-.42, .42]) tube([[.14 * s, .85, z], [.14 * s, .45, z + .03], [.14 * s, 0, z]], [.1, .055, .045], 5, d, { mat: 2, an: (s > 0) == (z > 0) ? 1 : 2, uv: [.85, .85] });
    }
    ell([0, 1.02, -.64], [.04, .09, .04], d, { an: 5, uv: [.04, 0] });
  },
  () => card([0, -.06, 0], [0, 1, 0], [1, 0, 0], .12, .08, 12, [.8, .8, .8], { f0: 0, f1: 0, an: 6 }),
];
// ---------- set pieces ----------
const WOOD = [.2, .14, .09], RUST = [.25, .12, .06], STONE = [.23, .22, .2];
const PROPS = [
  () => { // 25 sacred tree: ancient giant red cypress with a rope and paper streamers
    tree({ h: 50, r: 3.3, tp: [.3, .3, .3], sg: [14, 6, 4], sd: [22, 6, 4], nb: [20, 6], t0: [.5, .25], an: [1.2, .8], ln: [12, 5], up: [0, .15, .1], wb: [.04, .25, .35], bark: [.38, .19, .12], bs: 2, cell: 2, cs: 3.4, nc: 7, dr: -.2, lc: [.7, .75, .62], cc: [0, 38, 0], cr: 14, flare: flare(.8, 4, 9, 2), shape: t => (1 - .5 * t) * (.6 + R() * .7), on: (lv, pts) => { if (lv == 1 && R() < .8) card(pts[2], [0, -1, 0], norm([R() - .5, 0, R() - .5]), 2.4, 1.6, 14, [.8, .8, .8], { ph: R(), f0: .2, ao: .7 }); if (lv == 1 && R() < .4) nest(pts[1], 1); } });
    const pts = [], rs = []; for (let i = 0; i <= 24; i++) { const a = i / 24 * 2 * PI, r = 3.3 * flare(.8, 4, 9, 2)(1.9, a) * .93 + .12; pts.push([cos(a) * r, 1.9 + sin(a * 3) * .08, sin(a) * r]); rs.push(.07); }
    tube(pts, rs, 5, [.75, .62, .35], { mat: 2 });
    for (let i = 0; i < 24; i += 2) card(add(pts[i], [0, -.05, 0]), [0, -1, 0], norm([-pts[i][2], 0, pts[i][0]]), .45, .16, 0, [1, 1, 1], { mat: 2, f0: 0, f1: .6, ph: i / 24, ao: 1 });
    for (let k = 0; k < 14; k++) { const a = k / 14 * 2 * PI + .2; if (k % 7 == 0) continue; box([cos(a) * 8, .45, sin(a) * 8], [.07, .6, .07], WOOD); const b = (k + .5) / 14 * 2 * PI + .2; if ((k + 1) % 7) box([cos(b) * 7.8, .8, sin(b) * 7.8], [1.75, .04, .04], WOOD, { ux: [-sin(b), 0, cos(b)] }); }
  },
  () => { // 26 suspension footbridge (local: x along deck, origin at gorge centre, absolute y)
    const L = site[22], nx = site[18], nz = site[19], ux = [nx, 0, nz], uz = [-nz, 0, nx], P = (s, y, t) => [nx * s - nz * t, y, nz * s + nx * t];
    const dy = s => deckY(site[16] + nx * s, site[17] + nz * s) - site[20];
    for (let s = -L + .2; s < L; s += .42) box(P(s, dy(s) - .04, 0), [.19, .03, .8], jit(WOOD, .4), { ux, uz });
    for (const t of [-.85, .85]) {
      for (const e of [-1, 1]) { box(P(e * (L + .6), dy(e * L) + 1.6, t), [.14, 2, .14], WOOD, { ux, uz }); }
      const top = [], rope = [], rs = [], r2 = [];
      for (let i = 0; i <= 24; i++) { const s = -L - .6 + (2 * L + 1.2) * i / 24, k = s / (L + .6), y0 = (site[21] - site[20]) * (.5 - .5 * k); top.push(P(s, y0 + 3.5 - 2.6 * (1 - k * k), t)); rope.push(P(s, dy(Math.max(-L, Math.min(L, s))) + 1.05, t)); rs.push(.03); r2.push(.018); }
      tube(top, rs, 4, [.1, .1, .1], { mat: 2 }); tube(rope, r2, 3, [.3, .25, .15], { mat: 2 });
      for (let i = 1; i < 24; i++) tube([top[i], rope[i], add(rope[i], [0, -1.1, 0])], [.01, .01, .01], 3, [.1, .1, .1], { mat: 2 });
      for (const e of [-1, 1]) tube([P(e * (L + .6), dy(e * L) + 3.5, t), P(e * (L + 5), dy(e * L) - .3, t)], [.03, .03], 4, [.1, .1, .1], { mat: 2 });
    }
    for (const e of [-1, 1]) box(P(e * (L + .6), dy(e * L) + 3.4, 0), [.1, .1, 1], WOOD, { ux, uz });
  },
  () => { // 27 abandoned logging railway (local origin = arc centre, absolute y)
    const Rr = site[10], y = 0, m = Math.atan2(site[13], site[12]), half = Math.acos(site[14]) - .012, n = Math.round(2 * half * Rr / .85);
    for (let i = 0; i <= n; i++) { if (R() < .06) continue; const a = m - half + 2 * half * i / n + (R() - .5) * .0006, c = cos(a), s = sin(a); box([c * Rr, y - .03 - R() * .03, s * Rr], [.78 + R() * .08, .07, .11], jit([.11, .085, .06], .5), { ux: [c, 0, s], uz: [-s, 0, c], cell: 1 }); }
    for (const g of [-.38, .38]) { const pts = [], rs = []; for (let i = 0; i <= 90; i++) { const a = m - half + 2 * half * i / 90; pts.push([cos(a) * (Rr + g), y + .1, sin(a) * (Rr + g)]); rs.push(.045); } tube(pts, rs, 4, RUST, { mat: 2 }); }
    { // derelict log bogie
      const a = m + .1, c = cos(a), s = sin(a), ux = [-s, 0, c], uz = [c, 0, s], o = [c * Rr, y, s * Rr];
      box(add(o, [0, .55, 0]), [1.6, .09, .55], WOOD, { ux, uz }); for (const e of [-1, 1]) for (const g of [-.38, .38]) ell(add(add(o, mul(ux, e * 1.05)), add(mul(uz, g), [0, .32, 0])), [.22, .22, .05], RUST, { ax: uz, nr: 3 });
      for (let k = 0; k < 3; k++) { const pts = [add(add(o, mul(ux, -1.7)), add(mul(uz, (k - 1) * .36), [0, .86 + (k == 1 ? .28 : 0), 0])), add(add(o, mul(ux, 1.8)), add(mul(uz, (k - 1) * .36), [0, .86 + (k == 1 ? .28 : 0), 0]))]; tube(pts, [.2, .17], 7, [.3, .2, .13], { cell: 2 }); }
    }
  },
  () => { // 28 summit marker
    box([0, .75, 0], [.2, .95, .2], STONE, { cell: 1 }); box([0, 1.74, 0], [.24, .05, .24], STONE); box([0, 1.2, .205], [.14, .2, .012], [.5, .33, .12]);
    for (let k = 0; k < 9; k++) { const a = k * 2.4; ell([cos(a) * (.55 + R() * .5), .06, sin(a) * (.55 + R() * .5)], [.16 + R() * .1, .14 + R() * .08, .1 + R() * .06], jit(STONE, .2), { bump: .12, sd: k, cell: 1, ax: [0, 1, 0], nr: 4, ns: 6 }); }
  },
];
export const NK = GEN.length, NP = PROPS.length;
// build everything into one interleaved 32-byte vertex buffer + u32 index buffer
export function genMeshes() {
  const meshes = [], info = []; let nv = 0, ni = 0;
  for (let k = 0; k < NK + NP; k++) {
    R = mkrng(1000 + k * 77); M = { v: [], i: [], n: 0 };
    (k < NK ? GEN[k] : PROPS[k - NK])();
    let hw = 0, ht = 0; for (let i = 0; i < M.n; i++) { hw = Math.max(hw, Math.hypot(M.v[i * 17], M.v[i * 17 + 2])); ht = Math.max(ht, M.v[i * 17 + 1]); }
    meshes.push(M); info.push({ first: ni, count: M.i.length, base: nv, hw, ht }); nv += M.n; ni += M.i.length;
  }
  const vb = new ArrayBuffer(nv * 32), f = new Float32Array(vb), b = new Uint8Array(vb), s = new Int8Array(vb), ib = new Uint32Array(ni); let o = 0, io = 0;
  for (const m of meshes) {
    for (let i = 0; i < m.n; i++, o++) {
      const v = m.v, q = i * 17, p = o * 8, y = o * 32;
      f[p] = v[q]; f[p + 1] = v[q + 1]; f[p + 2] = v[q + 2]; f[p + 4] = v[q + 7]; f[p + 5] = v[q + 8];
      s[y + 12] = v[q + 3] * 127; s[y + 13] = v[q + 4] * 127; s[y + 14] = v[q + 5] * 127; s[y + 15] = sat(v[q + 6]) * 127;
      b[y + 24] = sat(v[q + 9]) * 255; b[y + 25] = sat(v[q + 10]) * 255; b[y + 26] = sat(v[q + 11]) * 255; b[y + 27] = sat(v[q + 12]) * 255;
      b[y + 28] = v[q + 13]; b[y + 29] = v[q + 14]; b[y + 30] = sat(v[q + 15]) * 255; b[y + 31] = v[q + 16];
    }
    ib.set(m.i, io); io += m.i.length;
  }
  return { vb, ib, info };
}
