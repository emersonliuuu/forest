// World: Taiwan-shaped island. Macro relief from a coastline polygon + ridge splines,
// detail from integer-hash gradient noise that is mirrored exactly in WGSL (see shaders.js).
export const MW = 560, MH = 1000, MC = 50, OX = -14000, OZ = -25000;
export const macro = new Float32Array(MW * MH);
export const site = new Float32Array(32);
export const W = { S: 1, ds: 1e4, rug: 0, nx: 0, ny: 0 };
const imul = Math.imul, sqrt = Math.sqrt, abs = Math.abs, exp = Math.exp, floor = Math.floor;
export const sat = x => x < 0 ? 0 : x > 1 ? 1 : x;
export const sst = (a, b, x) => { const t = sat((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export function mkrng(s) {
  let a = s >>> 0;
  return () => { a = a + 0x6D2B79F5 | 0; let t = imul(a ^ a >>> 15, 1 | a); t = t + imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export const LL = (lon, lat) => [(lon - 121.02) / 1.98 * 24000, (23.595 - lat) / 3.41 * 45000];

let gx = 0, gy = 0;
function hg(ix, iy) {
  let n = imul(ix, 0x27d4eb2d) ^ (imul(iy, 0x165667b1) + 0x9e3779b9 | 0);
  n ^= n >>> 15; n = imul(n, 0x2c1b3c6d); n ^= n >>> 12; n = imul(n, 0x297a2d39); n ^= n >>> 15;
  const a = (n >>> 8) * 3.7450704e-7; gx = Math.cos(a); gy = Math.sin(a);
}
// gradient noise with derivatives (value returned, derivatives in W.nx/W.ny)
export function nd(px, py) {
  const ix = floor(px), iy = floor(py), fx = px - ix, fy = py - iy;
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10), uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const dux = 30 * fx * fx * (fx * (fx - 2) + 1), duy = 30 * fy * fy * (fy * (fy - 2) + 1);
  hg(ix, iy); const ax = gx, ay = gy; hg(ix + 1, iy); const bx = gx, by = gy;
  hg(ix, iy + 1); const cx = gx, cy = gy; hg(ix + 1, iy + 1); const dx = gx, dy = gy;
  const va = ax * fx + ay * fy, vb = bx * (fx - 1) + by * fy, vc = cx * fx + cy * (fy - 1), vd = dx * (fx - 1) + dy * (fy - 1);
  const k = va - vb - vc + vd;
  W.nx = ax + ux * (bx - ax) + uy * (cx - ax) + ux * uy * (ax - bx - cx + dx) + dux * (uy * k + vb - va);
  W.ny = ay + ux * (by - ay) + uy * (cy - ay) + ux * uy * (ay - by - cy + dy) + duy * (ux * k + vc - va);
  return va + ux * (vb - va) + uy * (vc - va) + ux * uy * k;
}
const ml = (i, j) => macro[(j < 0 ? 0 : j >= MH ? MH - 1 : j) * MW + (i < 0 ? 0 : i >= MW ? MW - 1 : i)];
const bw = new Float32Array(8);
export function macroH(x, z) {
  const u = (x - OX) / MC - .5, v = (z - OZ) / MC - .5, i = floor(u), j = floor(v), f = u - i, e = v - j;
  bw[0] = (1 - f) * (1 - f) * (1 - f) / 6; bw[1] = (3 * f * f * f - 6 * f * f + 4) / 6; bw[2] = (-3 * f * f * f + 3 * f * f + 3 * f + 1) / 6; bw[3] = f * f * f / 6;
  bw[4] = (1 - e) * (1 - e) * (1 - e) / 6; bw[5] = (3 * e * e * e - 6 * e * e + 4) / 6; bw[6] = (-3 * e * e * e + 3 * e * e + 3 * e + 1) / 6; bw[7] = e * e * e / 6;
  let s = 0;
  for (let b = 0; b < 4; b++) { let r = 0; for (let a = 0; a < 4; a++) r += bw[a] * ml(i + a - 1, j + b - 1); s += bw[4 + b] * r; }
  return s;
}
// Full terrain height. d = horizontal distance from the camera (fades fine octaves). Mirrors WGSL H().
export function H(x, z, d) {
  const hb = macroH(x, z);
  W.ds = 1e4; W.rug = 0;
  if (hb < -20) return hb;
  let r = sat((hb - 15) / 600); r = r * r * (3 - 2 * r); W.rug = r;
  const v = nd(x / 1700 + 3.1, z / 800 + 9.2), vx = W.nx / 1700, vy = W.ny / 800;
  let h = hb + r * 330 * (sqrt(v * v + 9e-4) - .2);
  const w = nd(x / 330 + 5.7, z / 250 + 2.3);
  h += r * 70 * (sqrt(w * w + 2e-3) - .2);
  h += r * (16 * nd(x / 95 + 1.3, z / 95 + 7.1) * (1 - sst(1500, 3000, d)) + 3.5 * nd(x / 31 + 8.2, z / 31 + .4) * (1 - sst(400, 900, d)));
  const lo = .3 + .7 * r;
  if (d < 400) h += lo * .8 * nd(x / 9.5, z / 9.5) * (1 - sst(150, 400, d));
  if (d < 60) h += lo * .15 * nd(x / 2.9, z / 2.9) * (1 - sst(25, 60, d));
  const al = sat((h - 2700) / 800);
  if (al > 0) { const c = Math.max(1 - 2.2 * abs(nd(x / 210 + 4.4, z / 210 + 6.6)), 0); h += al * r * 70 * c * c; }
  const yx = x - site[28], yz = z - site[29], cap = 3880 + 90 * exp(-(yx * yx + yz * yz) / 4.9e5);
  if (h > 3650) h = 3650 + (cap - 3650) * Math.tanh((h - 3650) / (cap - 3650));
  let ds = 1e4;
  if (r > .05) {
    ds = abs(v) / Math.max(sqrt(vx * vx + vy * vy), 1e-6);
    const ch = exp(-ds * ds / 30) * sat(r * 3) * (1 - sst(3300, 3500, h));
    const q = h / 14, fq = q - floor(q), hs = (floor(q) + sst(.78, 1, fq)) * 14;
    h = h + (hs - h) * ch * .85 - 1.6 * ch;
  }
  W.ds = ds;
  let y = h * W.S;
  // set-piece terrain edits
  let ax = x - site[16], az = z - site[17], a2 = ax * ax + az * az;
  if (site[23] > 0 && a2 < 12100) y -= 22 * exp(-ds * ds / 90) * sst(110, 45, sqrt(a2));
  ax = x - site[0]; az = z - site[1]; a2 = ax * ax + az * az;
  if (a2 < 196) y += (site[2] - y) * sst(14, 4, sqrt(a2));
  ax = x - site[4]; az = z - site[5]; a2 = ax * ax + az * az;
  if (a2 < 400) y += (site[6] - y) * sst(20, 8, sqrt(a2));
  ax = x - site[8]; az = z - site[9]; a2 = sqrt(ax * ax + az * az);
  const dl = abs(a2 - site[10]);
  if (dl < 12 && site[10] > 0) {
    const cd = (ax * site[12] + az * site[13]) / a2;
    y += (site[11] - y) * sst(12, 3, dl) * sst(site[14], site[14] + .004, cd);
  }
  return y;
}
export function slopeAt(x, z) { const h = H(x, z, 0), e = 3; const a = H(x + e, z, 0) - h, b = H(x, z + e, 0) - h; return sqrt(a * a + b * b) / e; }
export const zalt = (x, z, y) => y + 140 * nd(x / 900 + 11, z / 900 + 3);

const COAST = [121.54, 25.30, 121.74, 25.16, 121.92, 25.13, 122.00, 25.01, 121.84, 24.86, 121.82, 24.68, 121.87, 24.59, 121.81, 24.45, 121.76, 24.31, 121.69, 24.20, 121.62, 23.98, 121.56, 23.78, 121.52, 23.60, 121.45, 23.32, 121.38, 23.10, 121.24, 22.87, 121.16, 22.75, 121.00, 22.60, 120.90, 22.35, 120.89, 22.20, 120.86, 22.00, 120.855, 21.90, 120.735, 21.93, 120.70, 22.08, 120.65, 22.26, 120.59, 22.37, 120.44, 22.46, 120.27, 22.62, 120.17, 22.90, 120.07, 23.08, 120.12, 23.37, 120.15, 23.60, 120.19, 23.80, 120.40, 24.05, 120.50, 24.27, 120.67, 24.50, 120.85, 24.70, 120.93, 24.85, 121.07, 25.04, 121.25, 25.12, 121.40, 25.17];
// ridge splines: lon, lat, crest height, west half-width, east half-width
const RIDGE = [
  [121.78, 24.52, 900, 2500, 1200, 121.60, 24.42, 2400, 3000, 1500, 121.44, 24.36, 3600, 3400, 1900, 121.33, 24.14, 3480, 3600, 1900, 121.20, 23.80, 3250, 3600, 1800, 121.06, 23.50, 3700, 3400, 1800, 120.96, 23.25, 3560, 3400, 1900, 120.85, 22.95, 3000, 3200, 1900, 120.76, 22.63, 3090, 3000, 1900, 120.80, 22.35, 1500, 2200, 1500, 120.82, 22.12, 600, 1500, 1200, 120.84, 21.97, 200, 900, 800],
  [121.85, 24.95, 700, 1500, 1500, 121.60, 24.75, 1900, 2500, 2200, 121.40, 24.55, 3000, 3000, 2400, 121.23, 24.39, 3750, 3200, 2400, 121.10, 24.22, 3000, 3200, 2400, 120.98, 24.02, 2000, 3000, 2400],
  [121.00, 23.68, 2700, 2400, 1500, 120.957, 23.47, 3952, 2600, 1500, 120.90, 23.28, 3200, 2600, 1500, 120.80, 23.05, 2000, 2500, 1500],
  [120.88, 23.80, 1700, 2600, 1600, 120.80, 23.52, 2660, 3000, 1500, 120.72, 23.28, 1800, 2800, 1500, 120.62, 23.02, 1000, 2400, 1500],
  [121.58, 23.92, 500, 700, 700, 121.50, 23.60, 1300, 1100, 900, 121.40, 23.30, 1680, 1200, 900, 121.28, 23.02, 1200, 1100, 900, 121.17, 22.84, 500, 800, 700],
  [121.45, 25.16, 600, 1400, 1400, 121.55, 25.18, 1100, 1500, 1500, 121.62, 25.14, 700, 1300, 1300]];

export function genWorld() {
  // smooth closed coastline
  const n = COAST.length / 2, P = [];
  const cp = i => LL(COAST[(i % n + n) % n * 2], COAST[(i % n + n) % n * 2 + 1]);
  for (let i = 0; i < n; i++) {
    const a = cp(i - 1), b = cp(i), c = cp(i + 1), d = cp(i + 2);
    for (let s = 0; s < 4; s++) {
      const t = s / 4, t2 = t * t, t3 = t2 * t;
      P.push(.5 * (2 * b[0] + (c[0] - a[0]) * t + (2 * a[0] - 5 * b[0] + 4 * c[0] - d[0]) * t2 + (3 * b[0] - a[0] - 3 * c[0] + d[0]) * t3),
        .5 * (2 * b[1] + (c[1] - a[1]) * t + (2 * a[1] - 5 * b[1] + 4 * c[1] - d[1]) * t2 + (3 * b[1] - a[1] - 3 * c[1] + d[1]) * t3));
    }
  }
  const m = P.length / 2, sw = 141, sh = 251, sd = new Float32Array(sw * sh);
  for (let j = 0; j < sh; j++) for (let i = 0; i < sw; i++) {
    const x = OX + i * 200, z = OZ + j * 200; let d = 1e18, ins = false;
    for (let k = 0; k < m; k++) {
      const ax = P[k * 2], az = P[k * 2 + 1], l = (k + 1) % m, bx = P[l * 2], bz = P[l * 2 + 1];
      const ex = bx - ax, ez = bz - az, t = sat(((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez)), qx = ax + ex * t - x, qz = az + ez * t - z;
      d = Math.min(d, qx * qx + qz * qz);
      if ((az > z) !== (bz > z) && x < ax + (z - az) / (bz - az) * ex) ins = !ins;
    }
    sd[j * sw + i] = (ins ? 1 : -1) * sqrt(d);
  }
  const rw = RIDGE.map(r => { const o = []; for (let i = 0; i < r.length; i += 5) { const p = LL(r[i], r[i + 1]); o.push(p[0], p[1], r[i + 2], r[i + 3], r[i + 4]); } return o; });
  for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) {
    const x = OX + (i + .5) * MC, z = OZ + (j + .5) * MC;
    const u = (x - OX) / 200, v = (z - OZ) / 200, iu = Math.min(floor(u), sw - 2), iv = Math.min(floor(v), sh - 2), fu = u - iu, fv = v - iv;
    const dc = (sd[iv * sw + iu] * (1 - fu) + sd[iv * sw + iu + 1] * fu) * (1 - fv) + (sd[(iv + 1) * sw + iu] * (1 - fu) + sd[(iv + 1) * sw + iu + 1] * fu) * fv
      + 120 * nd(x / 1300 + 2.2, z / 1300 + 5.5) + 35 * nd(x / 350, z / 350);
    let hb;
    if (dc <= 0) hb = Math.max(dc * .07 - .3, -150);
    else {
      let mx = 0, s8 = 0;
      for (const r of rw) {
        let bd = 1e18, bh = 0, bwd = 1;
        for (let k = 0; k + 5 < r.length; k += 5) {
          const ax = r[k], az = r[k + 1], ex = r[k + 5] - ax, ez = r[k + 6] - az, t = sat(((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez)), qx = ax + ex * t, qz = az + ez * t;
          const d2 = (x - qx) * (x - qx) + (z - qz) * (z - qz);
          if (d2 < bd) { bd = d2; bh = r[k + 2] + (r[k + 7] - r[k + 2]) * t; const ww = r[k + 3] + (r[k + 8] - r[k + 3]) * t, we = r[k + 4] + (r[k + 9] - r[k + 4]) * t; bwd = ww + (we - ww) * sst(-500, 500, x - qx); }
        }
        const e = bh * exp(-Math.pow(sqrt(bd) / bwd, 1.35));
        if (e > mx) mx = e; s8 += Math.pow(e, 8);
      }
      const rg = mx > 0 ? Math.pow(s8, .125) : 0;
      hb = (3 + 50 * sat(dc / 6000) + rg) * Math.pow(sst(0, 800, dc), .8) + .2 + 2 * sat(dc / 80);
    }
    macro[j * MW + i] = hb;
  }
  // --- normalise so the highest point (Yushan) is 3952 m and place set pieces ---
  const ys = LL(120.957, 23.47); site[28] = ys[0]; site[29] = ys[1];
  let best = 0, bx = 0, bz = 0;
  for (let z = ys[1] - 900; z <= ys[1] + 900; z += 10) for (let x = ys[0] - 900; x <= ys[0] + 900; x += 10) { const h = H(x, z, 0); if (h > best) { best = h; bx = x; bz = z; } }
  W.S = 3952 / best;
  site[0] = bx; site[1] = bz; site[2] = 3952 - 1.2;
  // sacred tree: gentle bench in the cloud belt near Alishan
  const al = LL(120.80, 23.51); let sc = 1e9;
  for (let z = al[1] - 2500; z <= al[1] + 2500; z += 50) for (let x = al[0] - 2500; x <= al[0] + 2500; x += 50) {
    const h = H(x, z, 0), dsv = W.ds; if (h < 2050 || h > 2330) continue;
    const s = slopeAt(x, z) + abs(h - 2200) / 600 + (dsv < 60 ? 5 : 0);
    if (s < sc) { sc = s; site[4] = x; site[5] = z; site[6] = h; }
  }
  // abandoned logging railway: level arc that hugs the contour near the sacred tree
  sc = 1e9;
  const R = 260, half = .52, rb = [0, 0, 0, 0, 0, 0, 0];
  for (let a = 0; a < 16; a++) for (let dd = 45; dd <= 165; dd += 40) for (let sg = -1; sg <= 1; sg += 2) {
    const mxp = site[4] + Math.cos(a * .3927) * dd, mzp = site[5] + Math.sin(a * .3927) * dd, h0 = H(mxp, mzp, 0);
    let gxx = H(mxp + 4, mzp, 0) - h0, gzz = H(mxp, mzp + 4, 0) - h0; const gl = Math.hypot(gxx, gzz) || 1; gxx /= gl; gzz /= gl;
    const cx = mxp + gxx * R * sg, cz = mzp + gzz * R * sg, mdx = -gxx * sg, mdz = -gzz * sg; let e = 0;
    for (let k = -6; k <= 6; k++) { const t = k / 6 * half, c = Math.cos(t), s = Math.sin(t); e += abs(H(cx + (mdx * c - mdz * s) * R, cz + (mdx * s + mdz * c) * R, 0) - h0); if (W.ds < 12) e += 40; }
    if (e < sc) { sc = e; rb[0] = cx; rb[1] = cz; rb[2] = R; rb[3] = h0 + .4; rb[4] = mdx; rb[5] = mdz; rb[6] = Math.cos(half); }
  }
  site.set(rb, 8);
  // gorge + suspension bridge on a stream in the laurel belt west of Yushan
  const bs = LL(120.74, 23.47); sc = -1e9;
  for (let z = bs[1] - 3000; z <= bs[1] + 3000; z += 25) for (let x = bs[0] - 3000; x <= bs[0] + 3000; x += 25) {
    const h = H(x, z, 0); if (W.ds > 10 || h < 900 || h > 1450 || W.rug < .6) continue;
    nd(x / 1700 + 3.1, z / 800 + 9.2); let nx = W.nx / 1700, nz = W.ny / 800; const l = Math.hypot(nx, nz); nx /= l; nz /= l;
    const s = Math.min(H(x + nx * 26, z + nz * 26, 0), H(x - nx * 26, z - nz * 26, 0)) - h - abs(H(x + nx * 26, z + nz * 26, 0) - H(x - nx * 26, z - nz * 26, 0)) * 2;
    if (s > sc) { sc = s; site[16] = x; site[17] = z; site[18] = nx; site[19] = nz; }
  }
  { // slide to the stream centre line
    let x = site[16], z = site[17]; const nx = site[18], nz = site[19]; let bd = 1e9, bt = 0;
    for (let t = -12; t <= 12; t += .5) { H(x + nx * t, z + nz * t, 0); if (W.ds < bd) { bd = W.ds; bt = t; } }
    site[16] = x + nx * bt; site[17] = z + nz * bt; site[22] = 24; site[23] = 1;
    site[20] = H(site[16] + nx * 24, site[17] + nz * 24, 0) + .15; site[21] = H(site[16] - nx * 24, site[17] - nz * 24, 0) + .15;
  }
}
// bridge deck height at world xz, or -1e9 if off the deck
export function deckY(x, z) {
  const ax = x - site[16], az = z - site[17], s = ax * site[18] + az * site[19], t = abs(-ax * site[19] + az * site[18]);
  if (abs(s) > site[22] + .05 || t > 1) return -1e9;
  const k = sat(s / site[22] * .5 + .5) * 2 - 1;
  return site[20] * (.5 + .5 * k) + site[21] * (.5 - .5 * k) - 1.3 * (1 - k * k) + .12;
}
export const ZONES = ['Lowland subtropical broadleaf', 'Laurel–oak evergreen forest', 'Cloud forest · cypress & hinoki', 'Hemlock & spruce forest', 'Taiwan fir forest', 'Alpine · juniper & rhododendron'];
export const zoneOf = y => y < 500 ? 0 : y < 1500 ? 1 : y < 2500 ? 2 : y < 3100 ? 3 : y < 3600 ? 4 : 5;
