// Procedural foliage atlas: 4x4 cells of 256px, painted on the CPU from leaf-shaped primitives.
import { mkrng, sat } from './world.js';
const S = 256, N = 1024;
export function genAtlas() {
  const A = new Float32Array(N * N * 4), R = mkrng(77), sin = Math.sin, cos = Math.cos, PI = Math.PI;
  const prof = (k, u) => k == 0 ? Math.pow(sin(PI * Math.pow(u, .8)), .6) * (1 - .3 * u) : k == 1 ? Math.pow(sin(PI * u), 1.3) : k == 2 ? Math.min(1, (1 - u) * 6) * Math.min(1, u * 20 + .5)
    : k == 3 ? Math.pow(sin(PI * Math.pow(u, .55)), .5) * (1 - .45 * u) : Math.sqrt(Math.max(0, 1 - (2 * u - 1) * (2 * u - 1)));
  // leaf primitive: base (x,y) in cell units (y up), heading ang (0 = up), length, width, profile, colour
  function leaf(c, x, y, ang, len, wid, pk, r, g, b, rib = .22) {
    const cx = (c & 3) * S, cy = (c >> 2) * S, dx = sin(ang), dy = cos(ang), bx = x * S, by = y * S, L = len * S, Wd = wid * S * .5;
    const ex = bx + dx * L, ey = by + dy * L, pad = Wd + 2;
    const x0 = Math.max(2, Math.floor(Math.min(bx, ex) - pad)), x1 = Math.min(S - 3, Math.ceil(Math.max(bx, ex) + pad));
    const y0 = Math.max(2, Math.floor(Math.min(by, ey) - pad)), y1 = Math.min(S - 3, Math.ceil(Math.max(by, ey) + pad));
    const jr = .85 + .3 * R();
    for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) {
      const qx = px + .5 - bx, qy = py + .5 - by, u = (qx * dx + qy * dy) / L, v = (qx * dy - qy * dx);
      if (u < 0 || u > 1) continue;
      const w = prof(pk, u) * Wd; let e = w - Math.abs(v);
      if (pk == 3 && u < .2) e = Math.min(e, Math.abs(v) - (0.2 - u) * Wd * 1.2); // sagittate notch
      if (e <= -.5) continue;
      const cov = sat(e + .5), nv = Math.abs(v) / Math.max(w, .5);
      const sh = jr * (1 + rib * Math.exp(-nv * nv * 30) - .25 * nv * nv + (Wd > 5 ? .02 * sin(u * L * .35 + nv * 4) : 0)) * (.9 + .2 * u);
      const o = ((cy + S - 1 - py) * N + cx + px) * 4, a = A[o + 3];
      A[o] += (r * sh - A[o]) * cov; A[o + 1] += (g * sh - A[o + 1]) * cov; A[o + 2] += (b * sh - A[o + 2]) * cov; A[o + 3] = a + cov * (1 - a);
    }
  }
  const twig = (c, x, y, a, l, w = .012) => leaf(c, x, y, a, l, w, 2, .09, .06, .035, 0);
  // 0: lowland broadleaf spray, 1: laurel/oak spray (dark, glossy)
  for (const [c, r, g, b, ll, lw, pk] of [[0, .12, .23, .045, .125, .062, 0], [1, .05, .12, .035, .115, .045, 1]]) {
    for (let s = 0; s < 8; s++) {
      const a0 = (s - 3.5) * .3 + (R() - .5) * .2, l0 = .45 + R() * .45, bx = .5, by = .03;
      twig(c, bx, by, a0, l0);
      for (let k = 0; k < 13; k++) {
        const t = .12 + .88 * k / 12, sd = k & 1 ? 1 : -1, x = bx + sin(a0) * l0 * t, y = by + cos(a0) * l0 * t, q = .75 + R() * .5;
        leaf(c, x, y, a0 + sd * (.7 + R() * .6), ll * q, lw * q, pk, r * (.75 + R() * .55), g * (.75 + R() * .5), b, c ? .5 : .25);
      }
      leaf(c, bx + sin(a0) * l0, by + cos(a0) * l0, a0, ll, lw, pk, r, g * 1.1, b);
    }
  }
  // 2: cypress fan spray (scale foliage), 10: juniper tuft
  const fan = (c, x, y, a, l, d, r, g, b) => {
    twig(c, x, y, a, l, .01);
    const n = d ? 5 : 7;
    for (let k = 1; k <= n; k++) {
      const t = k / n, sd = k & 1 ? 1 : -1, px = x + sin(a) * l * t, py = y + cos(a) * l * t;
      if (d) fan(c, px, py, a + sd * (.5 + R() * .25), l * (.62 - .3 * t), d - 1, r, g, b);
      else leaf(c, px, py, a + sd * .6, .035 + R() * .02, .02, 4, r * (.7 + R() * .6), g * (.75 + R() * .5), b);
    }
    if (!d) leaf(c, x + sin(a) * l, y + cos(a) * l, a, .04, .02, 4, r, g, b);
  };
  for (let s = 0; s < 3; s++) fan(2, .5, .02, (s - 1) * .5, .62 - .1 * Math.abs(s - 1), 2, .13, .22, .05);
  for (let s = 0; s < 7; s++) fan(10, .5, .02, (s - 3) * .33 + (R() - .5) * .2, .5 + R() * .3, 1, .10, .17, .10);
  // 3: fir/spruce needle branch, 11: hemlock spray (flat, short needles, lighter)
  for (const [c, r, g, b, nl, st] of [[3, .04, .1, .05, .05, 17], [11, .075, .15, .06, .036, 15]]) {
    const br = (x, y, a, l, d) => {
      leaf(c, x, y, a, l, nl * .8, 1, r * .7, g * .7, b * .7, 0);
      twig(c, x, y, a, l, .012);
      for (let k = 0; k < l * 330; k++) { const t = k / (l * 330), sd = k & 1 ? 1 : -1; leaf(c, x + sin(a) * l * t, y + cos(a) * l * t, a + sd * (1.0 + R() * .35), nl * (.8 + R() * .5) * (1 - .4 * t), .012, 2, r * (.7 + R() * .8), g * (.7 + R() * .7), b * (.7 + R() * .6), 0); }
      if (d) for (let k = 1; k < 5; k++) { const t = .2 + .15 * k, sd = k & 1 ? 1 : -1; br(x + sin(a) * l * t, y + cos(a) * l * t, a + sd * .8, l * (.5 - .3 * t), 0); }
    };
    br(.5, .02, 0, .95, 0);
    for (let k = 0; k < st; k++) { const t = .06 + .86 * k / st, sd = k & 1 ? 1 : -1; br(.5, .02 + .95 * t, sd * (1.0 + R() * .2), (.5 - .38 * t) * (.85 + R() * .25), 1); }
  }
  // 4: fern frond
  twig(4, .5, .01, 0, .97, .014);
  for (let k = 0; k < 26; k++) { const t = k / 26, l = .34 * Math.pow(sin(PI * Math.pow(t * .93 + .05, .7)), .8) + .02; for (const sd of [-1, 1]) leaf(4, .5, .03 + .95 * t, sd * (1.25 - .3 * t), l, .05, 1, .11 * (.8 + R() * .4), .27 * (.8 + R() * .4), .05, .4); }
  // 5: bamboo leaves
  for (let s = 0; s < 4; s++) {
    const a0 = (s - 1.5) * .5, l0 = .45 + R() * .3; twig(5, .5, .02, a0, l0, .008);
    for (let k = 0; k < 7; k++) { const t = .3 + .7 * k / 6; leaf(5, .5 + sin(a0) * l0 * t, .02 + cos(a0) * l0 * t, a0 + (k & 1 ? 1 : -1) * (.5 + R() * .5), .2 + R() * .08, .035, 1, .2 * (.8 + R() * .4), .34 * (.8 + R() * .4), .08, .3); }
  }
  // 6: giant taro leaf, 7: bird's-nest fern strap leaf, 12: single fallen leaf
  leaf(6, .5, .03, 0, .94, .8, 3, .09, .27, .07, .5);
  for (let k = 0; k < 7; k++) for (const sd of [-1, 1]) leaf(6, .5, .25 + k * .08, sd * (1.1 - k * .08), .3 - k * .02, .012, 2, .16, .36, .12, 0);
  leaf(7, .5, .02, 0, .96, .26, 1, .17, .38, .07, .6);
  leaf(12, .5, .08, 0, .84, .5, 0, .5, .3, .08, .4);
  // 8: cane / grass tuft
  for (let k = 0; k < 60; k++) { const a = (R() - .5) * 1.6, l = .45 + R() * .5; leaf(8, .5 + (R() - .5) * .3, .01, a, l, .026, 1, .15 * (.7 + R() * .6), .215 * (.7 + R() * .5), .07, .3); }
  // 9: rhododendron spray with flowers
  for (let s = 0; s < 6; s++) {
    const a0 = (s - 2.5) * .36, l0 = .45 + R() * .35; twig(9, .5, .02, a0, l0, .014);
    const tx = .5 + sin(a0) * l0, ty = .02 + cos(a0) * l0;
    for (let k = 0; k < 7; k++) leaf(9, tx, ty, a0 + (k - 3) * .65, .15, .05, 1, .045, .11, .04, .5);
    if (s & 1) for (let k = 0; k < 5; k++) leaf(9, tx, ty, a0 + k * 1.257 + R(), .055, .06, 0, .85, .32 + R() * .3, .5 + R() * .2, 0);
  }
  // 13: butterfly wing (half), 14: hanging moss beard, 15: soft glow
  leaf(13, .04, .5, 1.1, .9, .7, 0, .9, .55, .08, 0); leaf(13, .04, .5, 2.1, .7, .5, 0, .85, .45, .06, 0);
  leaf(13, .3, .62, 1.2, .5, .12, 1, .05, .04, .03, 0); leaf(13, .3, .4, 2., .4, .1, 1, .05, .04, .03, 0);
  for (let k = 0; k < 40; k++) { const x = .15 + R() * .7, l = .3 + R() * .65; leaf(14, x, .99, PI + (R() - .5) * .2, l, .016, 2, .2 * (.7 + R() * .5), .27 * (.7 + R() * .5), .13, 0); }
  { const cx = 3 * S, cy = 3 * S; for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const d = Math.hypot(x - 127.5, y - 127.5) / 120, o = ((cy + y) * N + cx + x) * 4, a = Math.pow(sat(1 - d), 2); A[o] = A[o + 1] = A[o + 2] = 1; A[o + 3] = a; } }
  // dilate colour into transparent texels (per cell average) so mips don't darken
  for (let c = 0; c < 16; c++) {
    const cx = (c & 3) * S, cy = (c >> 2) * S; let r = 0, g = 0, b = 0, w = 0;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const o = ((cy + y) * N + cx + x) * 4, a = A[o + 3]; r += A[o] * a; g += A[o + 1] * a; b += A[o + 2] * a; w += a; }
    r /= w; g /= w; b /= w;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const o = ((cy + y) * N + cx + x) * 4, a = A[o + 3]; if (a < 1) { A[o] = A[o] * a + r * (1 - a); A[o + 1] = A[o + 1] * a + g * (1 - a); A[o + 2] = A[o + 2] * a + b * (1 - a); } }
  }
  // mip chain -> sRGB8
  const mips = []; let src = A, n = N;
  for (; ;) {
    const o = new Uint8Array(n * n * 4);
    for (let i = 0; i < n * n; i++) { for (let k = 0; k < 3; k++) { const v = sat(src[i * 4 + k]); o[i * 4 + k] = 255 * (v < .0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - .055) + .5; } o[i * 4 + 3] = 255 * sat(src[i * 4 + 3]) + .5; }
    mips.push(o); if (n == 4) break;
    const h = n >> 1, d = new Float32Array(h * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < h; x++) for (let k = 0; k < 4; k++) d[(y * h + x) * 4 + k] = (src[((2 * y) * n + 2 * x) * 4 + k] + src[((2 * y) * n + 2 * x + 1) * 4 + k] + src[((2 * y + 1) * n + 2 * x) * 4 + k] + src[((2 * y + 1) * n + 2 * x + 1) * 4 + k]) * .25;
    src = d; n = h;
  }
  return mips;
}
// tiling value-noise fbm, 4 decorrelated channels, with mips
export function genNoise() {
  const n = 256, R = mkrng(5), f = new Float32Array(n * n * 4);
  for (let c = 0; c < 4; c++) for (let o = 0, per = 8, amp = .5; o < 5; o++, per *= 2, amp *= .5) {
    const g = new Float32Array(per * per); for (let i = 0; i < per * per; i++) g[i] = R();
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const u = x / n * per, v = y / n * per, iu = u | 0, iv = v | 0; let fu = u - iu, fv = v - iv; fu = fu * fu * (3 - 2 * fu); fv = fv * fv * (3 - 2 * fv);
      const a = g[iv * per + iu], b = g[iv * per + (iu + 1) % per], cc = g[(iv + 1) % per * per + iu], d = g[(iv + 1) % per * per + (iu + 1) % per];
      f[(y * n + x) * 4 + c] += amp * (a + (b - a) * fu + (cc - a) * fv + (a - b - cc + d) * fu * fv) / .97;
    }
  }
  const mips = []; let src = f, m = n;
  for (; ;) {
    const o = new Uint8Array(m * m * 4); for (let i = 0; i < o.length; i++) o[i] = 255 * sat(src[i]) + .5;
    mips.push(o); if (m == 1) break;
    const h = m >> 1, d = new Float32Array(h * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < h; x++) for (let k = 0; k < 4; k++) d[(y * h + x) * 4 + k] = (src[((2 * y) * m + 2 * x) * 4 + k] + src[((2 * y) * m + 2 * x + 1) * 4 + k] + src[((2 * y + 1) * m + 2 * x) * 4 + k] + src[((2 * y + 1) * m + 2 * x + 1) * 4 + k]) * .25;
    src = d; m = h;
  }
  return mips;
}
// tiling 3D noise (64^3, r8) for mist and the sea of clouds
export function genNoise3() {
  const n = 64, R = mkrng(9), o = new Uint8Array(n * n * n), f = new Float32Array(n * n * n);
  for (let oc = 0, per = 4, amp = .5; oc < 4; oc++, per *= 2, amp *= .5) {
    const g = new Float32Array(per * per * per); for (let i = 0; i < g.length; i++) g[i] = R();
    const G = (x, y, z) => g[(z % per * per + y % per) * per + x % per];
    for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const u = x / n * per, v = y / n * per, w = z / n * per, iu = u | 0, iv = v | 0, iw = w | 0; let a = u - iu, b = v - iv, c = w - iw; a = a * a * (3 - 2 * a); b = b * b * (3 - 2 * b); c = c * c * (3 - 2 * c);
      const l = (p, q, t) => p + (q - p) * t;
      f[(z * n + y) * n + x] += amp * l(l(l(G(iu, iv, iw), G(iu + 1, iv, iw), a), l(G(iu, iv + 1, iw), G(iu + 1, iv + 1, iw), a), b), l(l(G(iu, iv, iw + 1), G(iu + 1, iv, iw + 1), a), l(G(iu, iv + 1, iw + 1), G(iu + 1, iv + 1, iw + 1), a), b), c);
    }
  }
  for (let i = 0; i < o.length; i++) o[i] = 255 * sat(f[i] / .94) + .5;
  return o;
}
