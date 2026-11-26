// aircraft.js — the F-22 RAPTOR. v19: TOTAL REBUILD FROM SCRATCH
// (fadli, 21:08 WIB, v18: "jet nya tuh jelek bngt", "gmna ya haduh" —
// lalu memilih opsi 1: rombak total dari nol, cara beda).
//
// DIAGNOSIS (dilihat sendiri dari screenshot v18 + crop zoom fadli):
// 18 ronde tweak model prosedural yang sama TIDAK konvergen karena
// masalahnya adalah KONSTRUKSI, bukan warna/cahaya:
//   - ekor v18 = dua lubang hitam (nozzle) yang ditempel di pelat datar
//     (tail cap fan + tabung nozzle terpisah + frame ring terpisah);
//   - sayap/ekor = pelat tipis dengan TEKSTUR GRID yang digambar —
//     dari belakang 3/4 kebaca karton berpetak, bukan airfoil;
//   - metalness tanpa env map tidak punya apa pun untuk dipantulkan,
//     jadi perak v18 render sebagai putih matte datar (shot 3 hampir
//     putih polos, tanpa variasi tonal).
// KONSTRUKSI BARU v19:
//   1. BADAN + EKOR SATU LOFT MENERUS yang bermorfosis menjadi
//      twin-lobe ("peanut") di ekor — nozzle adalah BUKAAN di ujung
//      ekor yang terpahat, dengan sleeve gelap + plug + glow oranye
//      di dalamnya. Tidak ada pelat datar di ekor, tidak ada tabung
//      atau frame yang ditempel.
//   2. SAYAP/EKOR AIRFOIL BENERAN dengan ujung membulat (tanpa cap
//      datar) dan TANPA tekstur grid apa pun — permukaan polos yang
//      berkilau lewat env map, bukan garis yang digambar.
//   3. METAL YANG BENERAN BERKILAU: material standar memakai env map
//      prosedural langit senja (dibuat di main.js via PMREM, tanpa
//      aset eksternal) — perak menangkap warna senja, bukan matte.
//   4. PANEL LINES DIHAPUS TOTAL: tekstur kulit hanya bercak lembut
//      (soft blotches, alpha rendah), tanpa satu garis pun.
// Yang dipertahankan dari v18: warna dasar abu-perak terang, canopy
// emas besar, nozzle persegi 2D, proporsi badan (12,6 m / bentang
// 9,0 m), kamera 3/4 v18, chase-fill, api AB di dalam nozzle.

import * as THREE from 'three';

// ------------------------------------------------------------------ textures
// Soft round glow for navigation lights and nozzle glare.
function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.4)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// "RAPTOR" fin decal, light grey on transparent, for the canted tails.
function raptorDecalTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 96;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 512, 96);
  g.fillStyle = '#C8CDD4';
  g.font = 'bold 58px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('RAPTOR', 256, 36);
  g.fillStyle = '#8A9098';
  g.font = 'bold 26px system-ui, sans-serif';
  g.fillText('07', 256, 76);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Skin texture v19: ONLY soft tonal blotches — the faint patchwork of
// the real Raptor's skin. NO panel lines, NO grid, NO rectangles, NO
// rivets: every drawn line in v15-v18 eventually read as a box or a
// cardboard grid at chase distance. The sculpt + env map carry the
// detail now, not ink on the skin.
function skinTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#EDF0F3');
  grad.addColorStop(0.5, '#E2E6EA');
  grad.addColorStop(1, '#D5DAE0');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 512);
  let seed = 4242;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  // Large soft two-tone patches, very low alpha — tonal variation you
  // feel, not lines you read.
  for (let i = 0; i < 10; i++) {
    const x = rnd() * 512, y = rnd() * 512, w = 90 + rnd() * 180, h = 70 + rnd() * 140;
    g.fillStyle = rnd() > 0.5 ? 'rgba(225,230,235,0.10)' : 'rgba(170,178,188,0.10)';
    g.fillRect(x - w / 2, y - h / 2, w, h);
  }
  for (let i = 0; i < 30; i++) {
    const x = rnd() * 512, y = rnd() * 512, r = 30 + rnd() * 80;
    const bg = g.createRadialGradient(x, y, 0, x, y, r);
    const dark = rnd() > 0.5;
    bg.addColorStop(0, dark ? 'rgba(150,160,172,0.08)' : 'rgba(235,239,243,0.08)');
    bg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = bg;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// LERX top decal (v15): tail number on the strake, readable on the
// banking shot (fadli-15c). Paint, not geometry — kept.
function lerxDecalTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 128, 64);
  g.fillStyle = '#C8CDD4';
  g.font = 'bold 40px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('07', 64, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Rectangular 2D nozzle interior (v15, fadli-15b): the real F-22 nozzle
// is a flat rectangle, wider than tall, with the orange flame INSIDE it.
// Rounded-rect hot core (white-yellow-orange) with vertical flame
// streaks and a dark petal rim — the glow that fills the tail opening.
function emberRectTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 80;
  const g = c.getContext('2d');
  g.fillStyle = '#1A0A00';
  g.fillRect(0, 0, 128, 80);
  const grad = g.createRadialGradient(64, 40, 2, 64, 40, 62);
  grad.addColorStop(0, '#FFFBEA');
  grad.addColorStop(0.3, '#FFD75E');
  grad.addColorStop(0.62, '#FF7A18');
  grad.addColorStop(0.85, '#B33A00');
  grad.addColorStop(1, 'rgba(179,58,0,0)');
  g.fillStyle = grad;
  g.beginPath();
  g.roundRect(6, 8, 116, 64, 14);
  g.fill();
  let seed = 31337;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 9; i++) {
    const x = 16 + rnd() * 96;
    const w = 3 + rnd() * 6;
    const h = 26 + rnd() * 30;
    const sg = g.createLinearGradient(0, 40 - h / 2, 0, 40 + h / 2);
    sg.addColorStop(0, 'rgba(255,246,216,0)');
    sg.addColorStop(0.5, 'rgba(255,246,216,0.85)');
    sg.addColorStop(1, 'rgba(255,122,24,0)');
    g.fillStyle = sg;
    g.fillRect(x, 40 - h / 2, w, h);
  }
  g.strokeStyle = 'rgba(0,0,0,0.55)';
  g.lineWidth = 2;
  for (let x = 24; x < 128; x += 16) {
    g.beginPath(); g.moveTo(x, 2); g.lineTo(x, 10); g.stroke();
    g.beginPath(); g.moveTo(x, 70); g.lineTo(x, 78); g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------------------------------------------------------------- smooth lofts
// NACA 4-digit thickness distribution (closed trailing edge). Returns a
// closed ring of [xi, yi] (chord fraction, half-thickness as a fraction
// of chord), starting at the leading edge, over the top to the trailing
// edge, back along the bottom to the leading edge. Cosine spacing packs
// points at the leading/trailing edges, so the nose is a smooth round
// curve, never a corner.
function airfoilRing(t = 0.12, n = 16) {
  const upper = [];
  for (let i = 0; i <= n; i++) {
    const x = 0.5 * (1 - Math.cos(Math.PI * i / n));
    const yt = 5 * t * (0.2969 * Math.sqrt(x) - 0.1260 * x - 0.3516 * x * x + 0.2843 * x * x * x - 0.1036 * x * x * x * x);
    upper.push([x, yt]);
  }
  const ring = [...upper];
  for (let i = n - 1; i >= 1; i--) ring.push([upper[i][0], -upper[i][1]]);
  return ring;
}

// Smooth loft of an airfoil section along the span (wing / stabilator /
// LERX). Local coords: span along +X (right wing), chord along Z
// (leading edge +Z), thickness along Y. `side` builds the left wing
// with the chord orientation preserved and the winding flipped, so the
// mirrored wing's normals stay outward — never mirror an airfoil with
// rotation.y = PI, that swaps its leading and trailing edges.
// v19: ROUNDED TIP — the last two span stations shrink chord +
// thickness, so the wing closes into a rounded tip instead of a flat
// cap face (the v18 flat cap read as a cut board edge from behind).
function airfoilWingGeometry({ s0, s1, chordRoot, chordTip, thick = 0.10, camber = 0.14, sweep = 0, side = 1 }) {
  const nSec = 2 * 18 + 1 - 1; // airfoilRing(th, 18) length: (18+1) + (18-1)
  const NS = 9;
  const positions = [], uvs = [], indices = [];
  for (let i = 0; i < NS; i++) {
    const t = i / (NS - 1);
    const s = s0 + (s1 - s0) * t;
    let c = chordRoot + (chordTip - chordRoot) * Math.pow(t, 0.85);
    let th = thick;
    if (i === NS - 2) { c *= 0.55; th *= 0.5; }
    if (i === NS - 1) { c *= 0.16; th *= 0.16; }
    const zc = -sweep * t;
    const cam = camber * (c / chordRoot);
    const section = airfoilRing(th, 18);
    for (let j = 0; j < section.length; j++) {
      const [xi, yi] = section[j];
      positions.push(side * s, cam * Math.sin(Math.PI * xi) + yi * c, zc + (0.5 - xi) * c);
      uvs.push(s * 0.5, xi * c * 0.5);
    }
  }
  const nR = nSec;
  for (let i = 0; i < NS - 1; i++) {
    for (let j = 0; j < nR; j++) {
      const j2 = (j + 1) % nR;
      const a = i * nR + j, b = i * nR + j2;
      const cc = (i + 1) * nR + j, d = (i + 1) * nR + j2;
      if (side > 0) indices.push(a, cc, b, b, cc, d);
      else indices.push(a, b, cc, b, d, cc);
    }
  }
  // Tip cap fan on the tiny final ring — ~0.14 m across, reads as a
  // rounded edge, not a face.
  const tipC = positions.length / 3;
  let cx = 0, cy = 0, cz = 0;
  const last = NS - 1;
  for (let j = 0; j < nR; j++) {
    cx += positions[(last * nR + j) * 3];
    cy += positions[(last * nR + j) * 3 + 1];
    cz += positions[(last * nR + j) * 3 + 2];
  }
  positions.push(cx / nR, cy / nR, cz / nR);
  uvs.push(s1 * 0.5, 0.5);
  for (let j = 0; j < nR; j++) {
    const j2 = (j + 1) % nR;
    if (side > 0) indices.push(last * nR + j, tipC, last * nR + j2);
    else indices.push(last * nR + j, last * nR + j2, tipC);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Smooth lofted fin: a symmetric airfoil section lofted along the
// height, chord tapering and sweeping back with height. Local coords:
// height along +Y, chord along Z (leading edge +Z), thickness along X.
function finLoftGeometry() {
  const stations = [
    // [height, chord, chordCentreZ, thicknessRatio]
    [0.00, 1.50, 0.00, 0.12],
    [0.55, 1.32, -0.06, 0.12],
    [1.10, 1.02, -0.14, 0.12],
    [1.45, 0.82, -0.20, 0.12],
    [1.75, 0.58, -0.26, 0.12],
    [2.10, 0.32, -0.32, 0.12],
  ];
  const section = airfoilRing(1, 14); // unit thickness, scaled per station
  const nSec = section.length;
  const positions = [], uvs = [], indices = [];
  for (let i = 0; i < stations.length; i++) {
    const [h, c, zc, tr] = stations[i];
    for (let j = 0; j < nSec; j++) {
      const [xi, yi] = section[j];
      positions.push(yi * c * tr, h, zc + (0.5 - xi) * c);
      uvs.push(xi * c, h);
    }
  }
  for (let i = 0; i < stations.length - 1; i++) {
    for (let j = 0; j < nSec; j++) {
      const j2 = (j + 1) % nSec;
      const a = i * nSec + j, b = i * nSec + j2;
      const cc = (i + 1) * nSec + j, d = (i + 1) * nSec + j2;
      indices.push(a, b, cc, b, d, cc);
    }
  }
  const tipC = positions.length / 3;
  let cx = 0, cy = 0, cz = 0;
  const last = stations.length - 1;
  for (let j = 0; j < nSec; j++) {
    cx += positions[(last * nSec + j) * 3];
    cy += positions[(last * nSec + j) * 3 + 1];
    cz += positions[(last * nSec + j) * 3 + 2];
  }
  positions.push(cx / nSec, cy / nSec, cz / nSec);
  uvs.push(0.5, 2.1);
  for (let j = 0; j < nSec; j++) {
    const j2 = (j + 1) % nSec;
    indices.push(last * nSec + j, last * nSec + j2, tipC);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Generic smooth loft along Z: stations ordered nose (+Z) to tail (-Z),
// each ring a smooth closed curve from ringFn(station, t). 32 points
// around, smooth normals — the surface is a curved sculpt, never a
// stack of flat facets.
function loftZGeometry(stations, ringFn, nRing = 32) {
  const nS = stations.length;
  const positions = [], uvs = [], indices = [];
  for (let i = 0; i < nS; i++) {
    for (let j = 0; j < nRing; j++) {
      const t = (j / nRing) * Math.PI * 2;
      const [x, y] = ringFn(stations[i], t);
      positions.push(x, y, stations[i].z);
      uvs.push(j / nRing, i / (nS - 1));
    }
  }
  for (let i = 0; i < nS - 1; i++) {
    for (let j = 0; j < nRing; j++) {
      const j2 = (j + 1) % nRing;
      const a = i * nRing + j, b = i * nRing + j2;
      const c = (i + 1) * nRing + j, d = (i + 1) * nRing + j2;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Fuselage cross-section v19: a superellipse (n 2.0 round nose -> 2.6
// chined mid-body) that MORPHS into a TWIN-LOBE ("peanut") ring toward
// the tail. The peanut is a polar ring r(t) = R * (1 + e*cos 2t): the
// outline bulges left/right (the two engine lobes) and dips at top and
// bottom centre (the valley between the engines) — the F-22's boat
// tail (fadli-15b). `lobe` blends the two shapes at the same parameter
// t, so the morph is one smooth sculpt, never a joint between parts.
// At lobe = 1 the tail IS the two nozzle openings: no cap, no tube,
// no frame ring — the ember glow sits inside the sculpted opening.
function fuselageRing(st, t) {
  const n = st.n ?? 2.6, e = 2 / n;
  const c = Math.cos(t), s = Math.sin(t);
  const sx = st.w * Math.sign(c) * Math.pow(Math.abs(c), e);
  const sy = st.y + (s >= 0 ? st.ht : st.hb) * Math.sign(s) * Math.pow(Math.abs(s), e);
  const lobe = st.lobe ?? 0;
  if (lobe <= 0) return [sx, sy];
  const pe = 0.18; // twin-lobe valley depth
  const px = st.w * c * (1 + pe * Math.cos(2 * t)) / (1 + pe);
  const py = st.y + (s >= 0 ? st.ht : st.hb) * s * (1 + pe * Math.cos(2 * t)) / (1 + pe);
  return [sx + (px - sx) * lobe, sy + (py - sy) * lobe];
}

// Smooth dorsal spine: an elliptical fairing tapering to a point at
// both ends. Local coords, mesh positioned at (0, 0.58, -1.6).
function spineGeometry() {
  const stations = [
    { z: 2.5, w: 0.02, h: 0.02 },
    { z: 1.8, w: 0.16, h: 0.09 },
    { z: 0.8, w: 0.21, h: 0.12 },
    { z: -0.5, w: 0.21, h: 0.13 },
    { z: -1.5, w: 0.19, h: 0.12 },
    { z: -2.5, w: 0.02, h: 0.02 },
  ];
  return loftZGeometry(stations, (st, t) => [st.w * Math.cos(t), st.h * Math.sin(t)], 20);
}

// Interpolated midpoints between hand-placed stations — more rings,
// same shape, so computeVertexNormals shades the fuselage as one
// smooth sculpted body, not a stack of facets. Interpolates every
// numeric field (including `lobe`).
function interpStations(stations) {
  const out = [];
  const keys = ['y', 'w', 'ht', 'hb', 'n', 'lobe'];
  const def = { n: 2.6, lobe: 0 };
  for (let i = 0; i < stations.length; i++) {
    out.push(stations[i]);
    if (i < stations.length - 1) {
      const a = stations[i], b = stations[i + 1];
      const mid = { z: (a.z + b.z) / 2 };
      for (const k of keys) mid[k] = ((a[k] ?? def[k] ?? 0) + (b[k] ?? def[k] ?? 0)) / 2;
      out.push(mid);
    }
  }
  return out;
}

// Fuselage loft v19: 13 stations (interpolated to 25 rings), open at
// the tail — the tail exit IS the nozzle opening, so there is NO cap
// fan (the v18 flat tail cap was the "plate" the two dark holes sat
// on). The nose tip station is ~a point (w 0.02), so the open nose
// end is invisible.
function fuselageGeometry(stations) {
  return loftZGeometry(interpStations(stations), fuselageRing, 32);
}

// A flat fan filling a fuselage ring, for the dark bore plug deep
// inside the tail. DoubleSide material — winding never matters.
function ringFanGeometry(st, nRing = 32) {
  const positions = [0, st.y, st.z];
  const indices = [];
  for (let j = 0; j < nRing; j++) {
    const t = (j / nRing) * Math.PI * 2;
    const [x, y] = fuselageRing(st, t);
    positions.push(x, y, st.z);
  }
  for (let j = 0; j < nRing; j++) {
    const j2 = (j + 1) % nRing;
    indices.push(0, j + 1, j2 + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Interpolate the fuselage station parameters at an arbitrary z, for
// surface patches that must follow the fuselage exactly.
function stationAt(z) {
  const sts = FUSELAGE_STATIONS;
  if (z >= sts[0].z) return { ...sts[0] };
  if (z <= sts[sts.length - 1].z) return { ...sts[sts.length - 1] };
  for (let i = 0; i < sts.length - 1; i++) {
    const a = sts[i], b = sts[i + 1];
    if (z <= a.z && z >= b.z) {
      const f = (a.z - z) / (a.z - b.z);
      const l = (u, v) => u + (v - u) * f;
      return {
        z, y: l(a.y, b.y), w: l(a.w, b.w), ht: l(a.ht, b.ht), hb: l(a.hb, b.hb),
        n: l(a.n ?? 2.6, b.n ?? 2.6), lobe: l(a.lobe ?? 0, b.lobe ?? 0),
      };
    }
  }
  return { ...sts[sts.length - 1] };
}

// A patch that follows the fuselage surface exactly (same ring
// function, offset outward along the surface normal) — used for the
// flush intake mouths. No strapped-on duct: the intake is a dark
// opening IN the fuselage side, framed by a thin metallic rim patch.
function surfacePatch(z0, z1, t0, t1, nz, nt, offset, mat) {
  const positions = [], uvs = [], indices = [];
  for (let i = 0; i < nz; i++) {
    const z = z0 + (z1 - z0) * (i / (nz - 1));
    const st = stationAt(z);
    for (let j = 0; j < nt; j++) {
      const t = t0 + (t1 - t0) * (j / (nt - 1));
      const [x, y] = fuselageRing(st, t);
      let nx = x, ny = y - st.y;
      const nl = Math.hypot(nx, ny) || 1;
      nx /= nl; ny /= nl;
      positions.push(x + nx * offset, y + ny * offset, z);
      uvs.push(j / (nt - 1), i / (nz - 1));
    }
  }
  for (let i = 0; i < nz - 1; i++) {
    for (let j = 0; j < nt - 1; j++) {
      const a = i * nt + j, b = a + 1, c = a + nt, d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.noShadow = true;
  return mesh;
}

// A flame cone: apex backward (-Z), base at the nozzle exit. The group
// scales in Z to grow or shrink the flame without moving its base.
// The cone is pre-flattened (wide, thin) — the F-22's 2D nozzle
// throws a flat sheet of flame, not a round fireball (fadli-15b).
function flameCone(color, radius, length, opacity) {
  const geo = new THREE.ConeGeometry(radius, length, 12, 1, true);
  geo.rotateX(-Math.PI / 2); // cone tip (+Y) -> -Z, backward
  geo.scale(1.45, 0.55, 1); // flat wide flame sheet
  const mat = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.noShadow = true;
  mesh.position.z = -length / 2;
  return mesh;
}

// Fuselage stations (v19): same proportions as v15-v18 (12.6 m long,
// 1.80 m wide flat mid-body, nose long and pointed) plus the `lobe`
// ramp at the tail — the last stations morph into the twin-lobe tail.
const FUSELAGE_STATIONS = [
  { z: 6.6, y: 0.00, w: 0.02, ht: 0.02, hb: 0.02, n: 2.0 }, // nose tip — round
  { z: 6.1, y: 0.01, w: 0.13, ht: 0.11, hb: 0.09, n: 2.0 }, // round nose cone
  { z: 5.3, y: 0.03, w: 0.27, ht: 0.21, hb: 0.18, n: 2.1 }, // slim, round
  { z: 4.3, y: 0.05, w: 0.50, ht: 0.35, hb: 0.28, n: 2.3 }, // blending to chined
  { z: 3.1, y: 0.06, w: 0.74, ht: 0.43, hb: 0.34, n: 2.5 },
  { z: 1.9, y: 0.04, w: 0.88, ht: 0.48, hb: 0.36 },
  { z: 0.5, y: 0.02, w: 0.90, ht: 0.48, hb: 0.36 },
  { z: -1.1, y: 0.02, w: 0.86, ht: 0.44, hb: 0.34 },
  { z: -2.7, y: 0.00, w: 0.78, ht: 0.40, hb: 0.32, lobe: 0 },
  { z: -4.3, y: -0.02, w: 0.66, ht: 0.34, hb: 0.28, lobe: 0.35 },
  { z: -5.3, y: -0.03, w: 0.56, ht: 0.30, hb: 0.26, lobe: 0.7 },
  { z: -6.0, y: -0.03, w: 0.52, ht: 0.27, hb: 0.24, lobe: 0.9 },
  { z: -6.3, y: -0.03, w: 0.52, ht: 0.27, hb: 0.24, lobe: 1.0 }, // tail exit — twin-lobe opening
];

export function buildAircraft(envTex) {
  const group = new THREE.Group();
  group.name = 'aircraft';

  // v19 materials: REAL METAL. With an env map the skin reflects the
  // sunset (metalness 0.85, roughness 0.38) — the v18 "cardboard"
  // defect was metalness with NOTHING to reflect, so the silver
  // rendered as flat matte white. Without an env map (fallback) the
  // metalness drops back to v18 levels so the jet never goes black.
  const hasEnv = !!envTex;
  const METAL = hasEnv ? 0.85 : 0.25;
  const ROUGH = hasEnv ? 0.38 : 0.58;
  const std = (o) => {
    const m = new THREE.MeshStandardMaterial(o);
    // v19b: envMapIntensity 0.6 (was 1.0) — at full strength the purple
    // sunset sky tinted the whole jet lavender-pink; at 0.6 the skin
    // stays SILVER-grey with a warm sunset sheen (fadli-15b), not pink.
    if (hasEnv) { m.envMap = envTex; m.envMapIntensity = o.envMapIntensity ?? 0.6; }
    return m;
  };
  const skinMat = std({ map: skinTexture(), color: 0xE9EDEF, metalness: METAL, roughness: ROUGH });
  const plainMat = std({ color: 0xE9EDEF, metalness: METAL, roughness: ROUGH + 0.04 });
  const dark = std({ color: 0x8A929C, metalness: 0.5, roughness: 0.5 });
  const nozzleMetal = std({ color: 0x9AA2AB, metalness: 0.6, roughness: 0.45 });
  const emberRectTex = emberRectTexture();
  const lerxDecalTex = lerxDecalTexture();
  // Canopy glass: big bright gold bubble (fadli-15c), stronger emissive
  // so it glows warm even from the shadow side.
  const glass = std({
    color: 0xD9A83C, metalness: 0.65, roughness: 0.22,
    emissive: 0x8A5A10, emissiveIntensity: 0.6,
  });
  // Dark bore: unlit by design — a hole must read dark.
  const boreMat = new THREE.MeshBasicMaterial({ color: 0x14100C, side: THREE.BackSide });
  const plugMat = new THREE.MeshBasicMaterial({ color: 0x0C0A08, side: THREE.DoubleSide });
  // v19b: dark GREY, not pure black — the 0x07090B mouth read as a
  // black sticker pasted on the fuselage side; a dark grey reads as a
  // shadowed opening.
  const mouthMat = new THREE.MeshBasicMaterial({ color: 0x191D23, side: THREE.DoubleSide });
  const rimMat = std({ color: 0x8A929C, metalness: 0.5, roughness: 0.5, side: THREE.DoubleSide });

  // ---- fuselage: ONE continuous sculpt, nose to twin-lobe tail ----
  const fuselage = new THREE.Mesh(fuselageGeometry(FUSELAGE_STATIONS), skinMat);
  fuselage.name = 'fuselage';
  group.add(fuselage);

  // Dorsal spine: a smooth elliptical fairing along the fuselage top.
  const spine = new THREE.Mesh(spineGeometry(), plainMat);
  spine.position.set(0, 0.58, -1.6);
  group.add(spine);

  // ---- main delta wings + LERX: true airfoils, NO grid texture ----
  // Root chord 3.7 m on a 12.6 m body, span 9.0 m, low-mounted
  // (y -0.18), slight anhedral, root buried in the fuselage so the
  // wing emerges from the body — no joint, no fillet plate.
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(
      airfoilWingGeometry({ s0: 0.45, s1: 4.52, chordRoot: 3.7, chordTip: 0.8, thick: 0.13, camber: 0.20, side }),
      plainMat,
    );
    wing.position.set(0, -0.18, -0.9);
    wing.rotation.z = -side * 0.05; // slight anhedral, mirrored
    wing.name = 'wing';
    group.add(wing);
    // LERX: the forward strake from the wing root to the cockpit — the
    // F-22's chined forebody extension, visible on the banking shot.
    const lerx = new THREE.Mesh(
      airfoilWingGeometry({ s0: 0.4, s1: 1.9, chordRoot: 2.4, chordTip: 0.8, thick: 0.12, camber: 0.08, side }),
      plainMat,
    );
    lerx.position.set(0, 0.02, 2.4);
    lerx.rotation.z = -side * 0.05;
    lerx.name = 'lerx';
    group.add(lerx);
    // Tail number on the LERX top, readable on the banking shot.
    const lerxDec = new THREE.Mesh(
      new THREE.PlaneGeometry(0.8, 0.4),
      new THREE.MeshBasicMaterial({ map: lerxDecalTex, transparent: true }),
    );
    lerxDec.userData.noShadow = true;
    lerxDec.rotation.x = -Math.PI / 2;
    lerxDec.position.set(side * 1.1, 0.17, 2.9);
    group.add(lerxDec);
  }

  // Canopy: a LONG gold bubble FLUSH with the fuselage top — not a ball
  // perched on a flat plate. 0.76 m wide, 0.64 m tall, 2.7 m long.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), glass);
  canopy.scale.set(0.38, 0.32, 1.35);
  canopy.position.set(0, 0.62, 2.7);
  canopy.name = 'canopy';
  group.add(canopy);
  // Smooth canopy fairing: the gold bubble emerges from a smooth
  // fuselage-grey fairing — no dark ring, no hoop, no plate around
  // the canopy base.
  const fairing = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), plainMat);
  fairing.scale.set(0.42, 0.20, 1.45);
  fairing.position.set(0, 0.52, 2.7);
  group.add(fairing);

  // Canted twin tails: tall slim swept fins leaning out ~28 degrees,
  // light grey skin with the SAME soft-blotch texture as the fuselage
  // (v19b: plain metal on the flat fin face reflected one flat env
  // colour and read as a grey board — the blotch texture gives it the
  // tonal variation of built skin). Same silver family as the body
  // (fadli-15b), never a dark board. Smooth lofted airfoil.
  const finGeo = finLoftGeometry();
  const decalTex = raptorDecalTexture();
  for (const side of [-1, 1]) {
    const tail = new THREE.Group();
    tail.position.set(side * 0.62, 0.30, -4.3);
    tail.rotation.z = -side * 0.5; // cant outward ~28 deg
    const fin = new THREE.Mesh(finGeo, skinMat);
    tail.add(fin);
    // "RAPTOR" + tail number on the outer face of the fin.
    const decal = new THREE.Mesh(
      new THREE.PlaneGeometry(1.0, 0.19),
      new THREE.MeshBasicMaterial({ map: decalTex, transparent: true, side: THREE.DoubleSide }),
    );
    decal.userData.noShadow = true;
    decal.position.set(side * 0.065, 1.1, 0);
    decal.rotation.y = side * Math.PI / 2;
    tail.add(decal);
    group.add(tail);
  }

  // Stabilators: small all-moving tails, slight anhedral, smooth
  // lofted airfoils like the wings.
  for (const side of [-1, 1]) {
    const stab = new THREE.Mesh(
      airfoilWingGeometry({ s0: 0.1, s1: 2.0, chordRoot: 1.2, chordTip: 0.65, thick: 0.12, camber: 0.07, side }),
      plainMat,
    );
    stab.position.set(0, -0.05, -5.0);
    stab.rotation.z = -side * 0.07;
    group.add(stab);
  }

  // Caret intakes v19: NO strapped-on duct (the v17 duct read as a
  // separate silver tube on the fuselage side). The intake is a dark
  // mouth IN the fuselage surface — a patch that follows the fuselage
  // ring exactly — framed by a thin metallic rim patch that peeks out
  // around it. Flush, sculpted, never a box.
  for (const side of [-1, 1]) {
    const t0 = side > 0 ? -0.70 : Math.PI - 0.70;
    const t1 = side > 0 ? 0.70 : Math.PI + 0.70;
    const rim = surfacePatch(1.15, 2.75, t0, t1, 6, 10, 0.008, rimMat);
    rim.name = 'intake-rim';
    group.add(rim);
    const dt0 = side > 0 ? -0.62 : Math.PI - 0.62;
    const dt1 = side > 0 ? 0.62 : Math.PI + 0.62;
    const mouth = surfacePatch(1.2, 2.7, dt0, dt1, 6, 10, 0.016, mouthMat);
    mouth.name = 'intake';
    group.add(mouth);
  }

  // Twin 2D nozzles v19 (fadli-15b): the tail exit IS the nozzle — the
  // fuselage loft ends open in a twin-lobe ring, and inside it sit:
  // a dark bore sleeve (the inner walls of the tail), a dark plug deep
  // inside, and the rectangular ember glow. NO tube, NO frame ring,
  // NO flat cap — the nozzle is the sculpted tail opening itself.
  const emberRectMat = new THREE.MeshBasicMaterial({ map: emberRectTex });
  const embers = [];
  const sleeveStations = [
    { z: -6.3, y: -0.03, w: 0.50, ht: 0.26, hb: 0.23, n: 2.6, lobe: 1.0 },
    { z: -6.0, y: -0.03, w: 0.50, ht: 0.26, hb: 0.23, n: 2.6, lobe: 0.95 },
    { z: -5.6, y: -0.03, w: 0.53, ht: 0.28, hb: 0.24, n: 2.6, lobe: 0.8 },
    { z: -5.3, y: -0.03, w: 0.55, ht: 0.29, hb: 0.25, n: 2.6, lobe: 0.7 },
  ];
  const sleeve = new THREE.Mesh(loftZGeometry(sleeveStations, fuselageRing, 32), boreMat);
  sleeve.userData.noShadow = true;
  sleeve.name = 'nozzle-bore';
  group.add(sleeve);
  const plug = new THREE.Mesh(
    ringFanGeometry({ z: -6.02, y: -0.03, w: 0.50, ht: 0.26, hb: 0.23, n: 2.6, lobe: 0.98 }),
    plugMat,
  );
  plug.userData.noShadow = true;
  group.add(plug);
  for (const side of [-1, 1]) {
    const ember = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.26), emberRectMat);
    ember.rotation.y = Math.PI; // face backward
    ember.position.set(side * 0.32, -0.02, -6.22);
    ember.userData.noShadow = true;
    group.add(ember);
    embers.push(ember);
  }

  // Afterburner: layered flames behind each nozzle (orange shell, yellow
  // core, blue root) plus a warm point light. The flames live INSIDE
  // the rectangular nozzle (fadli-15b) — the external sheet is short
  // and dim, the ember rect does the talking.
  const glowTex = glowTexture();
  const flames = [];
  const abLight = new THREE.PointLight(0xFF8033, 0, 60, 1.5);
  abLight.position.set(0, 0, -7);
  group.add(abLight);
  // Chase fill (v18): a warm point light on the camera side, parented
  // to the aircraft — the low western sun leaves the rear faces in
  // shadow from the chase camera, so this lifts them to LIGHT GREY
  // instead of a black silhouette. A point light, not a directional:
  // its falloff (distance 45) lights the jet and almost nothing else.
  const chaseFill = new THREE.PointLight(0xFFC08A, 48, 45, 1.5);
  chaseFill.position.set(-3.5, 3.5, -12);
  group.add(chaseFill);
  for (const side of [-1, 1]) {
    const fg = new THREE.Group();
    fg.position.set(side * 0.32, -0.02, -6.3);
    // v19b: SHORTER + DIMMER — the v19 cones at full AB read as two
    // giant yellow paper darts sticking out of the tail; the real jet
    // (fadli-15b) keeps the fire INSIDE the nozzle with only a short
    // tongue out. The ember rect does the talking now.
    fg.add(flameCone(0xFF7A18, 0.16, 0.5, 0.16));
    fg.add(flameCone(0xFFD75E, 0.09, 0.4, 0.25));
    fg.add(flameCone(0x66CCFF, 0.05, 0.28, 0.3));
    fg.add(flameCone(0xFFF6D8, 0.03, 0.2, 0.4)); // white-hot core
    fg.scale.set(0.001, 0.001, 0.001);
    fg.visible = false;
    group.add(fg);
    flames.push(fg);
    // Nozzle glare sprite, always faintly on, bright with the burner.
    const glare = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xFF8033, transparent: true, opacity: 0.08,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glare.scale.setScalar(0.5);
    glare.position.set(side * 0.32, -0.02, -6.35);
    group.add(glare);
    flames.push(glare);
  }

  // Wingtip missile rails: thin rounded rails along each tip chord —
  // the small hard detail that makes the wing read as built, not cut.
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.1, 12), dark);
    rail.rotation.x = Math.PI / 2;
    rail.position.set(side * 4.48, -0.14, -0.9);
    group.add(rail);
  }

  // v17: NO LANDING GEAR. The gear (dark tyre tori + light hub discs
  // hanging below the fuselage at y -1.25) read as CAR WHEELS ("ban")
  // from the chase camera. A jet in flight flies clean: gear retracted,
  // nothing below the belly. Deleted outright, never to return.

  // Pitot tube on the nose + antenna mast on the spine.
  const pitot = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 6), dark);
  pitot.rotation.x = Math.PI / 2;
  pitot.position.set(0.3, 0.08, 5.2);
  group.add(pitot);
  const antenna = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.45, 6), dark);
  antenna.position.set(0, 0.85, -0.5); // on the dorsal spine
  group.add(antenna);

  // Navigation lights: red left, green right, white tail — emissive
  // lamps plus an additive glow sprite so they read at dusk.
  // v19b: the tail lamp was a big white BALL on the tail centreline
  // right above the nozzles (visible in the 4K tail zoom) — smaller
  // lamp, dimmer halo, moved up onto the spine so it sits on the
  // tail top instead of floating in the nozzle sightline.
  const lights = [
    [0xFF2222, -4.48, -0.1, -0.9, 0.8, 0.85, 0.09],
    [0x22FF66, 4.48, -0.1, -0.9, 0.8, 0.85, 0.09],
    [0xFFFFFF, 0, 0.35, -5.7, 0.3, 0.35, 0.06],
  ];
  for (const [col, x, y, z, glowScale, glowOpacity, lampR] of lights) {
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(lampR, 10, 8),
      new THREE.MeshBasicMaterial({ color: col }),
    );
    lamp.position.set(x, y, z);
    group.add(lamp);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: col, transparent: true, opacity: glowOpacity,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glow.scale.setScalar(glowScale);
    glow.position.set(x, y, z);
    group.add(glow);
  }

  // Shadows: everything solid casts; decals, flames, glows, bore and
  // patches do not.
  group.traverse((o) => {
    if (o.isMesh && !o.userData.noShadow) o.castShadow = true;
  });

  // Afterburner state, smoothed so the flames spool up and down.
  let abLevel = 0;

  return {
    group,
    /** Drive the afterburner: flames grow from the nozzles, the ember
     *  discs brighten and the tail light warms up. Call every frame. */
    setAfterburner(active, dt) {
      const target = active ? 1 : 0;
      abLevel += (target - abLevel) * Math.min(1, dt * 6);
      if (abLevel < 0.02) {
        for (const f of flames) f.visible = false;
        abLight.intensity = 0;
        emberRectMat.color.setHex(0x241A12); // dark warm interior at idle — the nozzle reads as a dark opening, not a brown box
        return;
      }
      const w = 0.4 + 0.6 * abLevel;
      for (let i = 0; i < 2; i++) {
        const fg = flames[i * 2];
        fg.visible = true;
        fg.scale.set(w, w, Math.max(0.02, abLevel));
        const glare = flames[i * 2 + 1];
        glare.visible = true;
        glare.material.opacity = 0.06 + 0.18 * abLevel;
        glare.scale.setScalar(0.5 + 0.3 * abLevel);
      }
      abLight.intensity = 30 * abLevel;
      emberRectMat.color.setHex(0xFFFFFF); // full gradient while burning
    },
  };
}
