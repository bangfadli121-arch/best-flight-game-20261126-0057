// terrain.js — procedural volcanic-island terrain for MERPATI SENJA.
// One job: the heightfield, its coloured mesh, the sea, the runway and the
// island dressing (trees, huts, buoys). Nothing here touches the aircraft.

import * as THREE from 'three';

// ------------------------------------------------------------------ islands
// Every island is a smooth bump. The big one (index 1) is the volcano.
export const ISLANDS = [
  { x: 0,     z: 0,     r: 950, h: 240, volcano: false },
  { x: -1700, z: -1500, r: 750, h: 520, volcano: true,  snow: 380 },
  { x: 1500,  z: 1000,  r: 380, h: 95,  volcano: false },
  { x: -1000, z: 1700,  r: 320, h: 75,  volcano: false },
  { x: 1900,  z: -700,  r: 300, h: 65,  volcano: false },
  { x: -2200, z: 900,   r: 260, h: 55,  volcano: false },
];

export const WORLD_SIZE = 6000;   // terrain plane, metres across
export const SEA_LEVEL = 0;

// Runway: a levelled shelf on the main island's south-east flank.
export const RUNWAY = {
  x: 520, z: 620, height: 42, length: 420, width: 26, headingDeg: 90, // east-west
};

// ------------------------------------------------------------ deterministic noise
function hash2(ix, iz) {
  let n = (ix * 374761393 + iz * 668265263) | 0;
  n = (n ^ (n >> 13)) | 0;
  n = Math.imul(n, 1274126177);
  return (((n ^ (n >> 16)) >>> 0) % 10000) / 10000;
}

function smooth(t) { return t * t * (3 - 2 * t); }

export function valueNoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const a = hash2(ix, iz), b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  const u = smooth(fx), v = smooth(fz);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}

function fbm(x, z) {
  return valueNoise(x * 0.004, z * 0.004) * 0.6
    + valueNoise(x * 0.013 + 40, z * 0.013 + 40) * 0.3
    + valueNoise(x * 0.04 + 90, z * 0.04 + 90) * 0.1;
}

// ------------------------------------------------------------ height function
function islandBump(x, z, isl) {
  const dx = x - isl.x, dz = z - isl.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  const t = d / isl.r;
  if (t >= 1) return 0;
  if (isl.volcano) {
    // Steep cone with a crater dip at the top.
    let h = isl.h * (1 - t);
    if (t < 0.2) h -= (0.2 - t) * isl.h * 1.35;
    // Radial erosion gullies (ref 06): real ridges down the flanks so
    // the low sun throws long shadows across the cone instead of the
    // colour map faking relief on a smooth cone. Same 28 sectors as
    // the colour striping, so ridges and stripes agree.
    const ang = Math.atan2(dz, dx);
    const gullyBand = smooth(Math.min(1, Math.max(0, (t - 0.16) / 0.14)))
      * (1 - smooth(Math.min(1, Math.max(0, (t - 0.82) / 0.18))));
    h += Math.sin(ang * 28 + valueNoise(x * 0.006 + 3, z * 0.006 + 8) * 3.0) * 7 * gullyBand;
    return Math.max(h, 0);
  }
  // Smooth dome.
  return isl.h * (Math.cos(t * Math.PI) + 1) / 2;
}

function runwayFlatten(x, z, h) {
  const rw = RUNWAY;
  // The strip mesh is a FLAT plane at rw.height, so the shelf under it
  // must be flat at rw.height too — a plateau, not a hump. The old
  // blend (s = smooth(1 - max(along, across))) only reached 42 at the
  // exact centre: measured terrainHeight was 32.7 at x=390, 41.9 at
  // x=510-530 and 5.3 at x=730, so the flat strip floated up to 37 m
  // above the ground at its east end, and a landing only registered
  // near the centre — everywhere else the plane sank below the visible
  // strip before the physics called it a touchdown. Now s = 1 anywhere
  // on the strip and fades to the raw terrain over 60 m / 55 m outside
  // it, so the visible strip, the ground mesh and the physics agree.
  const overX = Math.max(0, Math.abs(x - rw.x) - rw.length / 2) / 60;
  const overZ = Math.max(0, Math.abs(z - rw.z) - rw.width / 2) / 55;
  const outside = Math.max(overX, overZ); // 0 anywhere on the strip
  const s = smooth(Math.max(0, Math.min(1, 1 - outside)));
  return h + (rw.height - h) * s;
}

// Village: a levelled valley floor south-west of the runway, between the
// airfield shelf and the beach — the site of the kampung.
export const VILLAGE = { x: 370, z: 720, height: 14, radius: 130 };

function villageFlatten(x, z, h) {
  const dx = x - VILLAGE.x, dz = z - VILLAGE.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  const m = Math.max(0, 1 - d / (VILLAGE.radius + 70));
  const s = smooth(Math.min(1, m));
  return h + (VILLAGE.height - h) * s;
}

// Real terraces: the slope is cut into ~4 m steps that follow the
// contour, so the hillside reads as stacked paddies from the air instead
// of one smooth dome. Only in the paddy band of the main island
// (h 8..130, inside r 900); never on the volcano, the beach, or the
// runway shelf (runwayFlatten runs after this and wins there).
function terraceSteps(x, z, h) {
  const r = Math.sqrt(x * x + z * z);
  if (r > 900 || h < 8 || h > 130) return h;
  // NOTE: smooth() here is an unclamped smoothstep — clamp the inputs,
  // or the band factor explodes outside [0,1] and the heights blow up.
  const clamp01 = (t) => Math.max(0, Math.min(1, t));
  const band = smooth(clamp01((h - 8) / 12)) * (1 - smooth(clamp01((h - 115) / 15)));
  if (band <= 0) return h;
  const STEP = 4;
  const hq = Math.floor(h / STEP) * STEP + STEP / 2;
  return h * (1 - band * 0.9) + hq * band * 0.9;
}

export function terrainHeight(x, z) {
  let h = 0;
  for (const isl of ISLANDS) h += islandBump(x, z, isl);
  if (h > 2) h += fbm(x, z) * Math.min(9, h * 0.08);
  h = terraceSteps(x, z, h);
  h = villageFlatten(x, z, h);
  h = runwayFlatten(x, z, h);
  return Math.max(h, -2);
}

export function isOverRunway(x, z) {
  const rw = RUNWAY;
  const dx = Math.abs(x - rw.x), dz = Math.abs(z - rw.z);
  return dx < rw.length / 2 && dz < rw.width / 2;
}

// ------------------------------------------------------------------ colours
const C = {
  sand: new THREE.Color(0xE8D9A0),
  sandWet: new THREE.Color(0xC9B078),
  grassA: new THREE.Color(0x3E7D44),
  grassB: new THREE.Color(0x6FA84F),
  paddyA: new THREE.Color(0x7CB342),
  paddyB: new THREE.Color(0xAED581),
  paddyC: new THREE.Color(0x558B2F),
  paddyRipe: new THREE.Color(0xC0CA33),
  paddyDark: new THREE.Color(0x3E7D2E),
  // Flooded terrace (ref 05 Sapa): the water mirrors the SKY, so it is
  // bright silver-blue, almost white-blue — never dull orange. The
  // orange "mirror" is what made the hills read as painted blocks.
  paddyWater: new THREE.Color(0xEAF6FC),
  paddyWaterDeep: new THREE.Color(0xA8D4E8),
  // Young seedlings: saturated fresh green (the old pale green washed
  // out to olive under the warm sunset light).
  paddyYoung: new THREE.Color(0x7CB342),
  // Volcano vegetation zones: dense forest floor, dry savanna.
  // v10b: lightened — the v10 lower cone read as one dark brown mass
  // in the dusk light because these bases were too dark.
  forestFloor: new THREE.Color(0x3E6E33),
  savanna: new THREE.Color(0xA89A58),
  bund: new THREE.Color(0x5D4037),
  bundGold: new THREE.Color(0xC89B5A),
  rockDark: new THREE.Color(0x40332B),
  rock: new THREE.Color(0x6E5B52),
  ash: new THREE.Color(0x97887A),
  snow: new THREE.Color(0xF2F4F6),
  volcanoWarm: new THREE.Color(0xC97B4A),
};

// Deterministic hash of one paddy cell, so a cell keeps one flat colour.
function cellHash(cx, cz) {
  let n = (cx * 374761393 + cz * 668265263) | 0;
  n = (n ^ (n >> 13)) | 0;
  n = Math.imul(n, 1274126177);
  return (((n ^ (n >> 16)) >>> 0) % 10000) / 10000;
}

// Distance + bearing from the volcano crater, for the flank striping.
function volcanoInfo(x, z) {
  const dx = x + 1700, dz = z + 1500;
  return { d: Math.sqrt(dx * dx + dz * dz), ang: Math.atan2(dz, dx) };
}

// Terrace bands that FOLLOW THE CONTOUR (ref 04/05): the pattern key is
// the stepped height, not a square grid — a band is one 8 m height step,
// so its edges are the contour lines themselves and curve with the
// hillside the way real terraces do. Along the contour the band is cut
// into ~45 m plots (polar angle * radius), so plots are small, numerous
// and curved, never a chessboard. Shared by the colour map and by the
// mirror quads so water plots and mirrors agree on where the water is.
function paddyBand(x, z, h) {
  const tb = Math.floor(h / 12);
  const r = Math.sqrt(x * x + z * z);
  const ang = Math.atan2(z, x);
  const along = (ang * r) / 60; // plots along the contour, ~60 m each
  const seg = Math.floor(along);
  return {
    tb, seg,
    ph: cellHash(tb * 7 + 13, seg * 3 + 5),
    frac: (h - tb * 12) / 12,        // 0..1 across the band (riser at the edges)
    segFrac: along - seg,            // 0..1 along the contour within a plot
  };
}

// Colours are FLAT per patch: every vertex inside one paddy cell gets the
// cell's colour, with no per-vertex noise lerp — that lerp was what made
// the hills read as blurry gradients from the air. Edges are hard: a
// vertex exactly on a cell border is darkened as a bund line, and the
// grass/rock and ash/snow transitions are steps, not blends.
function terrainColour(x, z, h, slope) {
  const col = new THREE.Color();
  if (h < 4) {
    col.copy(C.sand).lerp(C.sandWet, Math.min(1, (4 - h) / 4));
    return col;
  }
  if (h < 150) {
    if (slope > 0.75) { col.copy(C.rock); return col; }
    // Rice-terrace patchwork (ref 04/05): contour bands, one solid
    // colour each, with dark bund lines on the band edges (the terrace
    // risers) and thin bunds between plots along the contour. Planting
    // phase per plot: flooded (sky mirror — bright silver-blue),
    // young seedlings, deep green, golden ripe. Water is three plots
    // in ten: the mirror plots must sparkle among the green, bright
    // enough to read as water from the air.
    const b = paddyBand(x, z, h);
    let base;
    if (b.ph < 0.38) base = C.paddyWater;
    else if (b.ph < 0.63) base = C.paddyYoung;
    else if (b.ph < 0.88) base = C.paddyDark;
    else base = C.paddyRipe;
    col.copy(base);
    // Brightness jitter per plot, never per vertex.
    col.multiplyScalar(0.94 + cellHash(b.tb + 911, b.seg + 733) * 0.12);
    // Bund at the band edges (risers): dark brown-gold, hard edge.
    // Thresholds widened for the 1024 px ground texture (~5.9 m/px):
    // a 1-px bund line is what reads as a terrace edge from the air.
    // v10: stronger contrast (0.85) so the silver water plots are cut
    // by crisp golden bunds like the Sapa ribbons in ref 05.
    const edge = Math.min(b.frac, 1 - b.frac);
    if (edge < 0.16) col.lerp(C.bund, 0.85);
    else if (edge < 0.34) col.lerp(C.bundGold, 0.35);
    // Thin bund between plots along the contour.
    const sEdge = Math.min(b.segFrac, 1 - b.segFrac);
    if (sEdge < 0.08) col.lerp(C.bund, 0.6);
    return col;
  }
  // High ground: the volcano is zoned by height — dense forest on the
  // lower flanks, dry savanna above it, bare rock with lava gullies, then
  // a snow cap with a noise-jittered but hard edge. Rock gets a
  // high-frequency speckle so it reads as gravel, not paint.
  const v = volcanoInfo(x, z);
  if (v.d < 780) {
    // Erosion gullies run the WHOLE cone (ref 06), not just the rock
    // zone: the v8 lower cone was one flat brown mass because forest and
    // savanna had no striping at all. Same 28-sector angular striping
    // as the rock zone, plus medium blotches so the slope has green,
    // dry and rocky patches all the way to the foot.
    const gullyLow = 0.5 + 0.5 * Math.sin(v.ang * 28 + valueNoise(x * 0.01 + 5, z * 0.01 + 5) * 2.0);
    const gullyFine = 0.5 + 0.5 * Math.sin(v.ang * 60 + valueNoise(x * 0.02 + 11, z * 0.02 + 7) * 4.0);
    const blotch = valueNoise(x * 0.008 + 31, z * 0.008 + 17); // -1..1, ~125 m
    if (h < 190) {
      col.copy(C.forestFloor);
      col.multiplyScalar(0.72 + 0.60 * gullyLow);
      col.multiplyScalar(0.82 + 0.30 * gullyFine);
      if (blotch > 0.25) col.lerp(C.savanna, 0.55);
      else if (blotch < -0.45) col.lerp(C.rock, 0.45);
      col.multiplyScalar(0.9 + cellHash(Math.floor(x / 18.75), Math.floor(z / 18.75)) * 0.2);
      return col;
    }
    if (h < 280) {
      col.copy(C.savanna);
      col.multiplyScalar(0.70 + 0.60 * gullyLow);
      col.multiplyScalar(0.82 + 0.30 * gullyFine);
      if (blotch > 0.25) col.lerp(C.forestFloor, 0.55);
      else if (blotch < -0.45) col.lerp(C.rock, 0.45);
      col.multiplyScalar(0.9 + cellHash(Math.floor(x / 18.75) + 5, Math.floor(z / 18.75)) * 0.2);
      return col;
    }
    // Bare rock (ref 06): erosion gullies — strong angular striping
    // down the cone (the soft sine wash read as one flat brown mound),
    // with fine gully modulation on top, plus LONG shadows: the
    // cone's west face catches the low sun warm, the east face falls
    // into cool shadow, so the mountain has relief instead of paint.
    const stripe = Math.floor(v.ang * 28 + valueNoise(x * 0.01 + 5, z * 0.01 + 5) * 2.0);
    col.copy(C.ash).lerp(C.rockDark, stripe % 2 === 0 ? 0.15 : 0.85);
    const gully = 0.5 + 0.5 * Math.sin(v.ang * 60 + valueNoise(x * 0.02 + 11, z * 0.02 + 7) * 4.0);
    col.multiplyScalar(0.82 + 0.30 * gully);
    const rx = (x + 1700) / Math.max(1, v.d), rz = (z + 1500) / Math.max(1, v.d);
    const sunFace = rx * -0.89 + rz * 0.46; // dot with the sun's horizontal dir
    col.multiplyScalar(0.85 + 0.15 * (sunFace * 0.5 + 0.5));
    if (sunFace > 0.25) col.lerp(C.volcanoWarm, 0.04 * sunFace);
    col.multiplyScalar(0.86 + cellHash(Math.floor(x / 18.75), Math.floor(z / 18.75)) * 0.28);
    const snowline = 380 + valueNoise(x * 0.008 + 13, z * 0.008 + 29) * 45;
    if (h > snowline) col.copy(C.snow);
    return col;
  }
  col.copy(C.grassB);
  if (h > 200) col.lerp(C.rock, Math.min(1, (h - 200) / 60));
  return col;
}

// Ground texture, baked per pixel (ref 04/05/06): the old vertex-colour
// patchwork lived on 18.75 m triangles, so terraces blurred into soft
// blobs no matter how crisp the colour rules were. This rasterizes the
// SAME colour rules at 1024 px over the 6000 m world (~5.9 m/px) and
// adds per-pixel grain, so contour bands, bunds and rock speckle stay
// sharp at screenshot distance. Deterministic: only seeded hashes.
// UV mapping: PlaneGeometry u = (x+3000)/6000, v = 1 at z = -3000, and
// CanvasTexture flipY puts canvas row 0 at v = 1 — pixel (i, j) is
// world (x = -3000 + i*step, z = -3000 + j*step). Matches exactly.
function groundTexture() {
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const img = g.createImageData(S, S);
  const data = img.data;
  const step = WORLD_SIZE / (S - 1);
  // Heights once, on the pixel grid — the colour pass reuses them.
  const H = new Float32Array(S * S);
  for (let j = 0; j < S; j++) {
    const z = (j / (S - 1) - 0.5) * WORLD_SIZE;
    for (let i = 0; i < S; i++) {
      const x = (i / (S - 1) - 0.5) * WORLD_SIZE;
      H[j * S + i] = terrainHeight(x, z);
    }
  }
  const tmp = new THREE.Color();
  for (let j = 0; j < S; j++) {
    const z = (j / (S - 1) - 0.5) * WORLD_SIZE;
    for (let i = 0; i < S; i++) {
      const x = (i / (S - 1) - 0.5) * WORLD_SIZE;
      const h = H[j * S + i];
      const hx = H[j * S + Math.min(S - 1, i + 1)] - h;
      const hz = H[Math.min(S - 1, j + 1) * S + i] - h;
      const slope = Math.min(1, Math.sqrt(hx * hx + hz * hz) / step);
      tmp.copy(terrainColour(x, z, h, slope));
      // Fine grain: two-octave value noise + dark/light specks, so no
      // patch is ever one flat tone at close range.
      const n = valueNoise(x * 0.35, z * 0.35) * 0.6 + valueNoise(x * 1.4 + 50, z * 1.4 + 50) * 0.4;
      let m = 1 + n * 0.09;
      const sp = hash2(Math.floor(x * 0.9), Math.floor(z * 0.9));
      if (sp > 0.95) m *= 0.82;
      else if (sp < 0.03) m *= 1.08;
      const k = (j * S + i) * 4;
      data[k] = Math.min(255, Math.max(0, tmp.r * 255 * m));
      data[k + 1] = Math.min(255, Math.max(0, tmp.g * 255 * m));
      data[k + 2] = Math.min(255, Math.max(0, tmp.b * 255 * m));
      data[k + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// Sea bump: fine wave texture everywhere (ref 10) — small ripples plus
// a larger swell — so the water reads as real sea, not a flat mirror.
// The fine ripples are HIGH contrast and dense: they are the micro-facets
// that shatter the sun glint into sparkles (ref 08) instead of one
// smooth beam. Bright specks are the glitter points themselves.
function seaBumpTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#808080';
  g.fillRect(0, 0, 256, 256);
  let seed = 777;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  // Broad swell first (big soft blobs), then fine ripples on top.
  for (let i = 0; i < 46; i++) {
    const v = 112 + Math.floor(rnd() * 32);
    const r = 26 + rnd() * 30;
    const grad = g.createRadialGradient(0, 0, 0, 0, 0, r);
    grad.addColorStop(0, `rgba(${v},${v},${v},0.35)`);
    grad.addColorStop(1, `rgba(${v},${v},${v},0)`);
    g.save();
    g.translate(rnd() * 256, rnd() * 256);
    g.fillStyle = grad;
    g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  for (let i = 0; i < 3200; i++) {
    const v = 56 + Math.floor(rnd() * 144);
    const r = 2 + rnd() * 6;
    const grad = g.createRadialGradient(0, 0, 0, 0, 0, r);
    grad.addColorStop(0, `rgba(${v},${v},${v},0.65)`);
    grad.addColorStop(1, `rgba(${v},${v},${v},0)`);
    g.save();
    g.translate(rnd() * 256, rnd() * 256);
    g.fillStyle = grad;
    g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  for (let i = 0; i < 500; i++) {
    const v = 200 + Math.floor(rnd() * 55);
    g.fillStyle = `rgba(${v},${v},${v},0.8)`;
    g.fillRect(rnd() * 256, rnd() * 256, 1.5, 1.5);
  }
  // Medium directional ripples: short strokes so the bump has facets
  // at the scale the camera sees from 500-1000 m, not just micro-grain.
  for (let i = 0; i < 700; i++) {
    const x = rnd() * 256, y = rnd() * 256;
    const a = rnd() * Math.PI;
    const len = 8 + rnd() * 18;
    const v = 70 + Math.floor(rnd() * 120);
    g.strokeStyle = `rgba(${v},${v},${v},0.35)`;
    g.lineWidth = 1.5 + rnd() * 2;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(90, 90);
  return tex;
}

// Sea colour texture (ref 10): the sea is never one flat tone — fine
// wave streaks everywhere plus soft warm patches where the sunset sky
// reflects. Painted near-white so it MULTIPLIES the vertex-colour
// gradient instead of replacing it; the turquoise-to-teal base still
// comes from the vertex colours.
function seaColorTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#FFFFFF';
  g.fillRect(0, 0, 512, 512);
  let seed = 31337;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  // Fine wave streaks: short thin light/dark dashes, all directions.
  // v10: many more streaks (4200) at higher alpha so the sea has fine
  // ripple texture EVERYWHERE (ref 10), not just inside the glitter path.
  for (let i = 0; i < 4200; i++) {
    const x = rnd() * 512, y = rnd() * 512;
    const a = rnd() * Math.PI;
    const len = 6 + rnd() * 22;
    const light = rnd() > 0.5;
    g.strokeStyle = light ? `rgba(255,255,255,${0.07 + rnd() * 0.12})` : `rgba(10,40,50,${0.07 + rnd() * 0.12})`;
    g.lineWidth = 1 + rnd() * 1.5;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.stroke();
  }
  // Warm sky-reflection patches: soft orange-pink blobs at low alpha.
  for (let i = 0; i < 40; i++) {
    const x = rnd() * 512, y = rnd() * 512, r = 30 + rnd() * 70;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(255,170,110,${0.10 + rnd() * 0.10})`);
    grad.addColorStop(1, 'rgba(255,170,110,0)');
    g.fillStyle = grad;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  // Fine speckle.
  for (let i = 0; i < 1800; i++) {
    const v = rnd() > 0.5 ? 255 : 30;
    g.fillStyle = `rgba(${v},${v},${v},0.08)`;
    g.fillRect(rnd() * 512, rnd() * 512, 1.5, 1.5);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(24, 24);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Runway surface: asphalt grain, centreline dashes, threshold bars and
// the "27" / "09" numbers, painted once on a canvas and laid on the strip.
function runwayTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#2B2F36';
  g.fillRect(0, 0, 1024, 128);
  let seed = 424242;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 2600; i++) {
    const v = 30 + rnd() * 45;
    g.fillStyle = `rgba(${v},${v + 3},${v + 8},${0.25 + rnd() * 0.3})`;
    g.fillRect(rnd() * 1024, rnd() * 128, 1 + rnd() * 2, 1 + rnd() * 2);
  }
  // Edge lines.
  g.fillStyle = '#F5F5F5';
  g.fillRect(0, 6, 1024, 3);
  g.fillRect(0, 119, 1024, 3);
  // Centreline dashes.
  for (let x = 150; x < 880; x += 62) g.fillRect(x, 62, 34, 4);
  // Threshold bars at both ends.
  for (const x0 of [28, 930]) {
    for (let k = 0; k < 4; k++) g.fillRect(x0, 22 + k * 24, 56, 10);
  }
  // Runway numbers.
  g.font = 'bold 44px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('27', 118, 64);
  g.save();
  g.translate(906, 64); g.rotate(Math.PI);
  g.fillText('09', 0, 0);
  g.restore();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// Rounded box: a rounded-rectangle footprint extruded vertically, with
// bevelled edges all round — the owner's hard rule this round is NO
// BOXES anywhere ("gua gmau pokok nya ada kotak kotak lgi"). Every
// house wall, granary, boat hull and pier deck uses this instead of
// BoxGeometry, so nothing in the scene reads as a cube or a block.
function roundedBoxGeometry(w, h, d, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -d / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r);
  s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d);
  s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  const b = Math.min(0.3, r * 0.5);
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: h, bevelEnabled: true, bevelThickness: b, bevelSize: b,
    bevelSegments: 3, curveSegments: 10,
  });
  geo.rotateX(-Math.PI / 2); // extrusion -> +Y, footprint w x d, base y=0
  return geo;
}

export function buildTerrain(scene) {
  const group = new THREE.Group();
  group.name = 'terrain';

  // Heightfield mesh, 320 x 320 segments over the world square: 18.75 m
  // per vertex for the silhouette. Colour comes from the baked 1024 px
  // ground texture (map), NOT from vertex colours — vertex colours were
  // the flat look. Normals still come from the geometry.
  const SEG = 320;
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, terrainHeight(x, z));
  }
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 0.95, metalness: 0 }),
  );
  ground.name = 'ground';
  ground.receiveShadow = true;
  group.add(ground);

  // Sea: a wide disc, turquoise near the islands, deep teal far out.
  // Phong specular gives the sun a BROAD glitter field across the
  // water (ref 08): lower shininess + brighter warm specular, broken
  // into sparkles by the dense bump map — not the thin smooth beam it
  // used to be. Base water is a touch deeper so the glitter reads.
  const tmp = new THREE.Color();
  const seaGeo = new THREE.CircleGeometry(9500, 64);
  seaGeo.rotateX(-Math.PI / 2);
  const spos = seaGeo.attributes.position;
  const seaCols = new Float32Array(spos.count * 3);
  const near = new THREE.Color(0x2AB8AC), far = new THREE.Color(0x17707E);
  for (let i = 0; i < spos.count; i++) {
    const x = spos.getX(i), z = spos.getZ(i);
    const r = Math.sqrt(x * x + z * z) / 9500;
    tmp.copy(near).lerp(far, Math.min(1, r * 1.4));
    // Fine streak variation (ref 10): the sea is never one flat tone —
    // two octaves now, so there are large soft patches as well as streaks.
    tmp.multiplyScalar(0.94 + valueNoise(x * 0.02, z * 0.02) * 0.12 + valueNoise(x * 0.008 + 40, z * 0.008 + 40) * 0.10);
    seaCols[i * 3] = tmp.r; seaCols[i * 3 + 1] = tmp.g; seaCols[i * 3 + 2] = tmp.b;
  }
  seaGeo.setAttribute('color', new THREE.BufferAttribute(seaCols, 3));
  const sea = new THREE.Mesh(
    seaGeo,
    new THREE.MeshPhongMaterial({
      map: seaColorTexture(), vertexColors: true, transparent: true, opacity: 0.96,
      shininess: 130, specular: 0xFFC27A, emissive: 0x082A2E,
      bumpMap: seaBumpTexture(), bumpScale: 2.2,
    }),
  );
  sea.position.y = 0.4;
  sea.name = 'sea';
  group.add(sea);

  buildRunway(group);
  buildTreesAndHuts(group);
  buildVillage(group);
  buildVolcanoForest(group);
  buildBoulders(group);
  buildTerraceMirrors(group);
  buildDistantRidges(group);
  buildBuoys(group);
  scene.add(group);
  return group;
}

function buildRunway(group) {
  const rw = RUNWAY;
  // Textured strip: asphalt grain, centreline, threshold bars, numbers.
  const strip = new THREE.Mesh(
    new THREE.PlaneGeometry(rw.length, rw.width),
    new THREE.MeshStandardMaterial({ map: runwayTexture(), roughness: 0.92, metalness: 0 }),
  );
  strip.rotation.x = -Math.PI / 2;
  strip.position.set(rw.x, rw.height + 0.35, rw.z);
  strip.name = 'runway-strip';
  strip.receiveShadow = true;
  group.add(strip);

  // Edge lights: warm dots along both sides.
  const lightGeo = new THREE.SphereGeometry(0.9, 8, 6);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xFFB300 });
  for (let d = -rw.length / 2 + 10; d <= rw.length / 2 - 10; d += 35) {
    for (const side of [-1, 1]) {
      const lamp = new THREE.Mesh(lightGeo, lightMat);
      lamp.position.set(rw.x + d, rw.height + 1.0, rw.z + side * (rw.width / 2 + 1.5));
      group.add(lamp);
    }
  }
  // PAPI: four small light boxes beside the western threshold — two red,
  // two white from a correct glidepath — the detail a pilot looks for.
  // v10: rounded drums, not boxes (no boxy shapes anywhere).
  const papiCols = [0xFF2222, 0xFF2222, 0xFFFFFF, 0xFFFFFF];
  for (let k = 0; k < 4; k++) {
    const box = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 1.0, 1.1, 12),
      new THREE.MeshStandardMaterial({
        color: 0x222222, emissive: papiCols[k], emissiveIntensity: 1.6, roughness: 0.5,
      }),
    );
    box.position.set(rw.x - rw.length / 2 + 26, rw.height + 1.2, rw.z + rw.width / 2 + 12 + k * 4.5);
    group.add(box);
  }
  // Windsock beside the runway: orange cone on a pole, tilted by the wind.
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 9, 6),
    new THREE.MeshStandardMaterial({ color: 0xDDDDDD, roughness: 0.5, metalness: 0.6 }),
  );
  pole.position.set(rw.x + 120, rw.height + 4.5, rw.z - rw.width / 2 - 14);
  group.add(pole);
  const sock = new THREE.Mesh(
    new THREE.ConeGeometry(1.1, 4.2, 10, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xFF7043, roughness: 0.7, side: THREE.DoubleSide }),
  );
  sock.rotation.z = Math.PI / 2 - 0.5;
  sock.position.set(rw.x + 122.5, rw.height + 9.2, rw.z - rw.width / 2 - 14);
  group.add(sock);
}

function buildTreesAndHuts(group) {
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6D4C41, roughness: 0.95 });
  const leafMats = [
    new THREE.MeshStandardMaterial({ color: 0x2E7D32, roughness: 0.9, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: 0x43A047, roughness: 0.9, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: 0x66BB6A, roughness: 0.9, flatShading: true }),
  ];
  const hutWall = new THREE.MeshStandardMaterial({ color: 0xD7CCC8, roughness: 0.9 });
  const hutRoof = new THREE.MeshStandardMaterial({ color: 0x8D6E63, roughness: 0.85, flatShading: true });
  const hutDark = new THREE.MeshStandardMaterial({ color: 0x3E2723, roughness: 0.9 });
  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

  // Real trees: a trunk plus three overlapping foliage volumes, so the
  // crown reads as a leafy mass from the air instead of a flat triangle.
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 7, 7);
  const blobGeo = new THREE.IcosahedronGeometry(2.9, 1);
  for (let i = 0; i < 70; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 180 + rnd() * 620;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const h = terrainHeight(x, z);
    if (h < 8 || h > 110 || isOverRunway(x, z)) continue;
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 3.5;
    trunk.castShadow = true;
    tree.add(trunk);
    const mat = leafMats[i % leafMats.length];
    const blobs = [[0, 9.2, 0, 1], [-1.7, 7.6, 0.6, 0.72], [1.6, 7.8, -0.5, 0.75]];
    for (const [bx, by, bz, bs] of blobs) {
      const b = new THREE.Mesh(blobGeo, mat);
      b.position.set(bx, by, bz);
      b.scale.setScalar(bs);
      b.castShadow = true;
      tree.add(b);
    }
    tree.position.set(x, h - 0.3, z);
    tree.rotation.y = rnd() * Math.PI;
    tree.scale.setScalar(1.25 + rnd() * 0.9);
    group.add(tree);
  }
  // A few huts beside the runway, with doors, windows and a chimney.
  const hutSpots = [
    [RUNWAY.x - 150, RUNWAY.z + 55, 0.4],
    [RUNWAY.x - 120, RUNWAY.z - 58, -0.3],
    [RUNWAY.x + 170, RUNWAY.z + 52, 1.2],
  ];
  for (const [hx, hz, ry] of hutSpots) {
    const h = terrainHeight(hx, hz);
    const hut = new THREE.Group();
    const walls = new THREE.Mesh(roundedBoxGeometry(9, 4.5, 7, 1.0), hutWall);
    walls.position.y = 0;
    walls.castShadow = true;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(6.4, 3.4, 8), hutRoof);
    roof.position.y = 6.2;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 3.0), hutDark);
    door.position.set(0, 1.5, 3.83);
    const win1 = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.2), hutDark);
    win1.position.set(-2.6, 2.6, 3.83);
    const win2 = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.2), hutDark);
    win2.position.set(2.6, 2.6, 3.83);
    const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 2.4, 10), hutDark);
    chimney.position.set(2.2, 7.0, -1.2);
    hut.add(walls, roof, door, win1, win2, chimney);
    hut.position.set(hx, h, hz);
    hut.rotation.y = ry;
    group.add(hut);
  }
}

function buildBuoys(group) {
  const buoyMat = new THREE.MeshLambertMaterial({ color: 0xFF7043 });
  const geo = new THREE.SphereGeometry(1.6, 10, 8);
  const spots = [
    [RUNWAY.x - 320, RUNWAY.z + 260],
    [RUNWAY.x - 120, RUNWAY.z + 300],
    [RUNWAY.x + 90, RUNWAY.z + 280],
    [-350, 1050],
    [1050, 350],
  ];
  for (const [bx, bz] of spots) {
    const b = new THREE.Mesh(geo, buoyMat);
    b.position.set(bx, 1.4, bz);
    b.name = 'buoy';
    group.add(b);
  }
}

// ------------------------------------------------------------------ village
// The kampung: a cluster of terracotta-roofed houses on the levelled
// valley floor south-west of the runway, a mosque with dome and minaret
// as the landmark, a dirt road down to the beach, boats and a wooden
// pier. From 150-300 m it reads as a village — houses grouped along the
// road, not random dots — instead of a few lone huts.
function roadRibbon(group, pts, width, color) {
  const positions = [];
  const indices = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const [px, pz] = pts[i];
    const [qx, qz] = pts[Math.min(i + 1, n - 1)];
    const [rx, rz] = pts[Math.max(i - 1, 0)];
    let dx = qx - rx, dz = qz - rz;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len; dz /= len;
    const nx = -dz, nz = dx; // perpendicular
    for (const s of [-1, 1]) {
      const vx = px + nx * s * width / 2;
      const vz = pz + nz * s * width / 2;
      positions.push(vx, terrainHeight(vx, vz) + 0.35, vz);
    }
    if (i > 0) {
      const a = (i - 1) * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0 }),
  );
  mesh.name = 'village-road';
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function gableRoof(group, mat, len, wid, y) {
  // Two sloped slabs meeting at the ridge: a real gable roof, not a pyramid.
  const slope = new THREE.BoxGeometry(len + 0.8, 0.32, wid / 2 + 0.7);
  const angle = Math.atan2(2.6, wid / 2);
  for (const s of [-1, 1]) {
    const slab = new THREE.Mesh(slope, mat);
    slab.position.set(0, y + 1.3, s * wid / 4);
    slab.rotation.x = s * angle;
    slab.castShadow = true;
    group.add(slab);
  }
}

function buildVillage(group) {
  const vgroup = new THREE.Group();
  vgroup.name = 'village';
  let seed = 2026;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

  const wallMats = [
    new THREE.MeshStandardMaterial({ color: 0xF5EFE0, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ color: 0xFAFAF5, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ color: 0xF3E5C0, roughness: 0.9 }),
  ];
  const roofMats = [
    new THREE.MeshStandardMaterial({ color: 0xB5492A, roughness: 0.85 }),
    new THREE.MeshStandardMaterial({ color: 0xA63E24, roughness: 0.85 }),
    new THREE.MeshStandardMaterial({ color: 0x9AA5A8, roughness: 0.6, metalness: 0.4 }),
  ];
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x3E2723, roughness: 0.9 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x8D6E63, roughness: 1 });

  // Dirt road: runway west threshold -> village -> beach.
  roadRibbon(vgroup, [[315, 620], [350, 665], [368, 718], [392, 772], [412, 812]], 7, 0x8D6E63);
  // Cross street through the village.
  roadRibbon(vgroup, [[322, 732], [368, 720], [420, 712]], 5, 0x7A5C4E);

  // 20 houses clustered along the roads (deterministic scatter, kept
  // clear of the road itself and of each other).
  const spots = [];
  let guard = 0;
  while (spots.length < 20 && guard++ < 500) {
    const a = rnd() * Math.PI * 2;
    const r = 25 + rnd() * 70;
    const x = VILLAGE.x + Math.cos(a) * r;
    const z = VILLAGE.z + Math.sin(a) * r * 0.8;
    if (Math.abs(z - 720) < 12 && x > 320 && x < 425) continue; // keep off the cross street
    if (spots.some(([sx, sz]) => Math.hypot(sx - x, sz - z) < 17)) continue;
    if (terrainHeight(x, z) < 8) continue;
    spots.push([x, z]);
  }
  for (let i = 0; i < spots.length; i++) {
    const [hx, hz] = spots[i];
    const h = terrainHeight(hx, hz);
    const house = new THREE.Group();
    const walls = new THREE.Mesh(roundedBoxGeometry(8, 4.5, 6.5, 0.9), wallMats[i % wallMats.length]);
    walls.position.y = 0;
    walls.castShadow = true;
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 2.9), darkMat);
    door.position.set(0, 1.45, 3.58);
    const win1 = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.1), darkMat);
    win1.position.set(-2.5, 2.6, 3.58);
    const win2 = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.1), darkMat);
    win2.position.set(2.5, 2.6, 3.58);
    house.add(walls, door, win1, win2);
    gableRoof(house, roofMats[i % roofMats.length], 8, 6.5, 4.5);
    house.position.set(hx, h - 0.2, hz);
    house.rotation.y = rnd() * Math.PI;
    vgroup.add(house);
  }

  // Mosque: white walls, green dome, gold finial, one minaret.
  const mosque = new THREE.Group();
  const mWalls = new THREE.Mesh(
    roundedBoxGeometry(11, 6, 8.5, 1.0),
    new THREE.MeshStandardMaterial({ color: 0xF8F6EF, roughness: 0.85 }),
  );
  mWalls.position.y = 0;
  mWalls.castShadow = true;
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(3.4, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x2E7D32, roughness: 0.4, metalness: 0.15 }),
  );
  dome.position.y = 6;
  const finial = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xFFD54F, roughness: 0.3, metalness: 0.7 }),
  );
  finial.position.y = 9.8;
  const minaret = new THREE.Mesh(
    new THREE.CylinderGeometry(0.85, 1.0, 14, 10),
    new THREE.MeshStandardMaterial({ color: 0xF8F6EF, roughness: 0.85 }),
  );
  minaret.position.set(7.2, 7, 0);
  minaret.castShadow = true;
  const mDome = new THREE.Mesh(
    new THREE.SphereGeometry(1.15, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x2E7D32, roughness: 0.4 }),
  );
  mDome.position.set(7.2, 14, 0);
  const mDoor = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 3.6), darkMat);
  mDoor.position.set(0, 1.8, 4.58);
  mosque.add(mWalls, dome, finial, minaret, mDome, mDoor);
  const mh = terrainHeight(402, 688);
  mosque.position.set(402, mh - 0.2, 688);
  mosque.rotation.y = 0.5;
  vgroup.add(mosque);

  // Rice granaries on stilts.
  for (const [gx, gz] of [[330, 762], [415, 748], [352, 692]]) {
    const gh = terrainHeight(gx, gz);
    const gran = new THREE.Group();
    for (const [px, pz] of [[-1.6, -1.2], [1.6, -1.2], [-1.6, 1.2], [1.6, 1.2]]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 2.2, 6), woodMat);
      post.position.set(px, 1.1, pz);
      gran.add(post);
    }
    const box = new THREE.Mesh(roundedBoxGeometry(4.2, 2.8, 3.4, 0.7), wallMats[0]);
    box.position.y = 2.5;
    box.castShadow = true;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.6, 2.2, 8), roofMats[0]);
    roof.position.y = 6.1;
    roof.rotation.y = Math.PI / 4;
    gran.add(box, roof);
    gran.position.set(gx, gh - 0.2, gz);
    gran.rotation.y = rnd() * Math.PI;
    vgroup.add(gran);
  }

  // Coconut palms: tall thin trunk, flat star crown — a rosette from the air.
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 11, 6);
  const crownGeo = new THREE.ConeGeometry(3.4, 2.4, 6);
  const palmTrunk = new THREE.MeshStandardMaterial({ color: 0x8D6E63, roughness: 1 });
  const palmCrown = new THREE.MeshStandardMaterial({ color: 0x2E7D32, roughness: 0.9, flatShading: true });
  for (let i = 0; i < 20; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 20 + rnd() * 115;
    const x = VILLAGE.x + Math.cos(a) * r;
    const z = VILLAGE.z + Math.sin(a) * r * 0.85;
    const h = terrainHeight(x, z);
    if (h < 6) continue;
    const palm = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, palmTrunk);
    trunk.position.y = 5.5;
    trunk.rotation.z = (rnd() - 0.5) * 0.16;
    const crown = new THREE.Mesh(crownGeo, palmCrown);
    crown.position.y = 11.4;
    crown.scale.y = 0.4;
    crown.rotation.y = rnd() * Math.PI;
    palm.add(trunk, crown);
    palm.position.set(x, h - 0.2, z);
    vgroup.add(palm);
  }

  // Banana clumps: bright flattened crowns between the houses.
  const bananaMat = new THREE.MeshStandardMaterial({ color: 0x7CB342, roughness: 0.9, flatShading: true });
  const bananaGeo = new THREE.IcosahedronGeometry(2.4, 0);
  for (let i = 0; i < 10; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 30 + rnd() * 90;
    const x = VILLAGE.x + Math.cos(a) * r;
    const z = VILLAGE.z + Math.sin(a) * r * 0.8;
    const h = terrainHeight(x, z);
    if (h < 6) continue;
    const b = new THREE.Mesh(bananaGeo, bananaMat);
    b.position.set(x, h + 1.0, z);
    b.scale.set(1.2, 0.42, 1.2);
    b.rotation.y = rnd() * Math.PI;
    vgroup.add(b);
  }

  // Thin cooking smoke over two chimneys: soft sprites, barely there.
  const smokeTexC = document.createElement('canvas');
  smokeTexC.width = smokeTexC.height = 64;
  const sg = smokeTexC.getContext('2d');
  const sgrad = sg.createRadialGradient(32, 32, 0, 32, 32, 32);
  sgrad.addColorStop(0, 'rgba(255,255,255,0.7)');
  sgrad.addColorStop(1, 'rgba(255,255,255,0)');
  sg.fillStyle = sgrad;
  sg.fillRect(0, 0, 64, 64);
  const smokeTex = new THREE.CanvasTexture(smokeTexC);
  for (const [sx, sz] of [[345, 705], [398, 742]]) {
    const sh = terrainHeight(sx, sz);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({
      map: smokeTex, transparent: true, opacity: 0.32, depthWrite: false,
    }));
    spr.position.set(sx, sh + 12, sz);
    spr.scale.set(9, 15, 1);
    vgroup.add(spr);
  }

  // Fishing boats on the water off the beach, and a wooden pier.
  const boatCols = [0xE53935, 0x1E88E5, 0xFDD835];
  for (let i = 0; i < 3; i++) {
    const bx = 428 + i * 22, bz = 858 + i * 18;
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(
      roundedBoxGeometry(6.5, 1.1, 2.2, 0.45),
      new THREE.MeshStandardMaterial({ color: boatCols[i], roughness: 0.7 }),
    );
    hull.position.y = 0.05;
    const bow = new THREE.Mesh(
      new THREE.ConeGeometry(1.1, 2.4, 4),
      new THREE.MeshStandardMaterial({ color: boatCols[i], roughness: 0.7 }),
    );
    bow.rotation.z = -Math.PI / 2;
    bow.rotation.y = Math.PI / 4;
    bow.position.set(4.2, 0.4, 0);
    const out1 = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 5.5, 5), woodMat);
    out1.rotation.x = Math.PI / 2;
    out1.position.set(0, 0.7, 2.6);
    const out2 = out1.clone();
    out2.position.z = -2.6;
    boat.add(hull, bow, out1, out2);
    boat.position.set(bx, 0.6, bz);
    boat.rotation.y = -0.7 + i * 0.25;
    vgroup.add(boat);
  }
  // Pier: planks from the beach out to the boats (rounded slab, no box).
  const pier = new THREE.Group();
  const pierLen = 58;
  const deck = new THREE.Mesh(roundedBoxGeometry(2.6, 0.3, pierLen, 0.15), woodMat);
  deck.position.y = 1.1;
  pier.add(deck);
  for (let d = -pierLen / 2 + 4; d <= pierLen / 2 - 4; d += 12) {
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.6, 5), woodMat);
      post.position.set(s * 1.1, 0.4, d);
      pier.add(post);
    }
  }
  pier.position.set(420, 0, 838);
  pier.rotation.y = 0.42;
  vgroup.add(pier);

  group.add(vgroup);
  return vgroup;
}

// ------------------------------------------------------------------ volcano
// Forest on the volcano's lower flanks: real trees where the colour map
// already paints forest floor, so the green reads as canopy, not paint.
function buildVolcanoForest(group) {
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 7, 7);
  const blobGeo = new THREE.IcosahedronGeometry(2.9, 1);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5D4037, roughness: 0.95 });
  const leafMats = [
    new THREE.MeshStandardMaterial({ color: 0x1B5E20, roughness: 0.9, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: 0x2E7D32, roughness: 0.9, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: 0x43A047, roughness: 0.9, flatShading: true }),
  ];
  let seed = 77;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const cx = -1700, cz = -1500;
  let placed = 0;
  // v10: more trees (130), wider band down to the foot (h 20-280) and
  // more size variation — the lower cone must read as forest canopy,
  // not painted green (ref 06).
  for (let i = 0; i < 380 && placed < 130; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 380 + rnd() * 300;
    const x = cx + Math.cos(a) * r;
    const z = cz + Math.sin(a) * r;
    const h = terrainHeight(x, z);
    if (h < 20 || h > 280) continue;
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 3.5;
    trunk.castShadow = true;
    tree.add(trunk);
    const mat = leafMats[i % leafMats.length];
    for (const [bx, by, bz, bs] of [[0, 9.2, 0, 1], [-1.7, 7.6, 0.6, 0.72], [1.6, 7.8, -0.5, 0.75]]) {
      const b = new THREE.Mesh(blobGeo, mat);
      b.position.set(bx, by, bz);
      b.scale.setScalar(bs);
      b.castShadow = true;
      tree.add(b);
    }
    tree.position.set(x, h - 0.3, z);
    tree.rotation.y = rnd() * Math.PI;
    tree.scale.setScalar(1.0 + rnd() * 1.3);
    group.add(tree);
    placed++;
  }
}

// Boulders on the volcano's rock zone: one instanced mesh, gravel tones.
function buildBoulders(group) {
  const geo = new THREE.IcosahedronGeometry(1.7, 0);
  const mat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 1, flatShading: true });
  const COUNT = 90;
  const inst = new THREE.InstancedMesh(geo, mat, COUNT);
  let seed = 99;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const s = new THREE.Vector3();
  const cols = [new THREE.Color(0x4E342E), new THREE.Color(0x6D4C41), new THREE.Color(0x5D4037)];
  let placed = 0;
  for (let i = 0; i < 300 && placed < COUNT; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 60 + rnd() * 400;
    const x = -1700 + Math.cos(a) * r;
    const z = -1500 + Math.sin(a) * r;
    const h = terrainHeight(x, z);
    if (h < 200 || h > 480) continue;
    e.set(rnd() * Math.PI, rnd() * Math.PI, rnd() * Math.PI);
    q.setFromEuler(e);
    const sc = 0.6 + rnd() * 1.6;
    s.set(sc, sc * (0.6 + rnd() * 0.5), sc);
    m.compose(v.set(x, h + 0.4, z), q, s);
    inst.setMatrixAt(placed, m);
    inst.setColorAt(placed, cols[placed % cols.length]);
    placed++;
  }
  inst.count = placed;
  inst.instanceMatrix.needsUpdate = true;
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  group.add(inst);
}

// Flooded terraces that actually mirror the sky (ref 05): thin
// reflective quads laid on water-phase contour bands, so the sunset
// glints on real silver-blue water instead of orange paint. Uses the
// same paddyBand phase as the colour map, so mirrors sit exactly on
// the bright water plots.
function buildTerraceMirrors(group) {
  const mat = new THREE.MeshPhongMaterial({
    color: 0xBFE3F2, emissive: 0x1A2E3A, emissiveIntensity: 0.4,
    specular: 0xFFFFFF, shininess: 300, transparent: true, opacity: 0.8,
  });
  const geo = new THREE.PlaneGeometry(44, 11);
  let placed = 0;
  for (let gx = 0; gx <= 800 && placed < 48; gx += 30) {
    for (let gz = 0; gz <= 800 && placed < 48; gz += 30) {
      const h = terrainHeight(gx, gz);
      if (h < 10 || h > 120) continue;
      if (paddyBand(gx, gz, h).ph >= 0.35) continue; // only water-phase plots
      const hx = terrainHeight(gx + 6, gz) - h;
      const hz = terrainHeight(gx, gz + 6) - h;
      const grad = new THREE.Vector3(hx, 0, hz);
      if (grad.lengthSq() < 1e-6) continue;
      // Quad lies along the contour (perpendicular to the gradient).
      const t = new THREE.Vector3(-hz, 0, hx).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), t);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(gx, h + 0.35, gz);
      mesh.rotation.x = -Math.PI / 2;
      mesh.quaternion.multiplyQuaternions(q, mesh.quaternion);
      mesh.name = 'terrace-water';
      group.add(mesh);
      placed++;
    }
  }
}

// Layered mountain ridges far out: pale blue-purple silhouettes in the
// haze, so the horizon has depth instead of empty sky and sea.
function buildDistantRidges(group) {
  function ridge(cx, cz, width, height, color, opacity, seedOff) {
    const SEG = 40;
    const positions = [];
    const indices = [];
    for (let i = 0; i <= SEG; i++) {
      const u = i / SEG;
      const x = (u - 0.5) * width;
      const prof = 0.35
        + 0.45 * (valueNoise(x * 0.0011 + seedOff, 3.7) * 0.5 + 0.5)
        + 0.25 * (valueNoise(x * 0.004 + seedOff + 9, 11.2) * 0.5 + 0.5);
      positions.push(x, height * prof, 0);
      positions.push(x, -60, 0);
      if (i > 0) {
        const a = (i - 1) * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ color, fog: true, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false }),
    );
    mesh.position.set(cx, 0, cz);
    mesh.lookAt(0, 0, 0);
    mesh.name = 'distant-ridge';
    group.add(mesh);
  }
  ridge(0, -6000, 11000, 950, 0x5B3A6E, 0.9, 1.3);    // north
  ridge(5800, -800, 9000, 800, 0x6B4A7A, 0.85, 7.7);  // east
  ridge(-6000, 600, 9000, 480, 0x7A5570, 0.8, 4.1);   // west, low: stays under the sun
}
