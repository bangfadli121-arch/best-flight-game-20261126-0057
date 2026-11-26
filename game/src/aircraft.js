// aircraft.js — the F-22 RAPTOR. v17 (AC7 round): gear DELETED (it read
// as car wheels — "ban"), nose rounded + slimmed, canopy coaming
// removed, intakes slimmed/blended, chase cam 3/4 (main.js).
// v16: SMOOTH GEOMETRY rebuild, from fadli's own photos (fadli-15b rear,
// fadli-15c banking, fadli-15a AC7
// sunset sea) and his verdict "masih kotak-kotak" / "bikin halus detail
// 3D dan HD". Fifteen rounds proved recolouring + panel textures never
// remove the boxy look — the boxy look IS the geometry: the v15
// fuselage was an 8-point octagon ring (flat facets), the wings/fins
// were flat extruded plates with sharp edges. This version rebuilds
// every airframe part as a SMOOTH LOFT: a 32-point superellipse
// fuselage, NACA-airfoil wings/fins/stabilators/LERX with round
// leading edges and smooth normals, an elliptical spine. Proportions
// (12.6 m long, 1.80 m wide flat body, 9.0 m span), colours, panel
// detail, rectangular 2D nozzles, big gold canopy and the chase-fill
// light are UNCHANGED from v15 — only the geometry got smooth.

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

// v18 (fadli: "sama aja jelek" — the v17 jet is still DARK NAVY):
// SILVER skin. The v17 base (#6E-#8E) x multiply 0xBCC4CC gave an
// albedo of ~0.4 — dark navy from the chase camera, while fadli-15b/15c
// are light silver-grey. Base is now near-white silver, the multiply
// colour is near-white too, and the panel lines are pale and faint, so
// the jet reads SILVER, not navy. The grid that segmented the body into
// boxes is gone with the dark lines.
// Top-skin texture (ref 02): panel mosaic on a MID-grey base. The v13
// skin was too pale and too glossy — under the low sun on the banking
// shot it washed out to white-gold. This base is a full stop darker
// (#7C848E instead of #9AA3AD), the multiply colour is darker too, and
// the material is rougher and less metallic, so the top skin stays GREY
// in the sun instead of blowing out. Panel lines are thinner and softer
// than v13: detail, not a grid.
function panelTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#D8DDE2');
  grad.addColorStop(0.5, '#C9CFD6');
  grad.addColorStop(1, '#B9C0C8');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 512);
  // Weathering blotches + large soft two-tone patches: the patchwork
  // skin of the real Raptor in ref 02.
  // v15b: base one stop LIGHTER — the v15 fuselage read charcoal from
  // behind (fadli-15b is light silver-grey); the multiply is lighter
  // too, and the chase fill is stronger. The sunlit top has headroom
  // (shot 3 read warm tan, never blown), so this lifts the shadow side
  // without washing the top out.
  let seed = 4242;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 8; i++) {
    const x = rnd() * 512, y = rnd() * 512, w = 60 + rnd() * 130, h = 50 + rnd() * 110;
    g.fillStyle = rnd() > 0.5 ? 'rgba(210,216,222,0.12)' : 'rgba(150,160,170,0.12)';
    g.fillRect(x - w / 2, y - h / 2, w, h);
  }
  for (let i = 0; i < 36; i++) {
    const x = rnd() * 512, y = rnd() * 512, r = 20 + rnd() * 60;
    const bg = g.createRadialGradient(x, y, 0, x, y, r);
    const dark = rnd() > 0.45;
    bg.addColorStop(0, dark ? 'rgba(120,130,142,0.12)' : 'rgba(215,221,227,0.12)');
    bg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = bg;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  // Panel lines: chordwise stations + spanwise seams — VISIBLE (v15,
  // fadli-15c: the real Raptor's panel lines show clearly all over the
  // body). Darker and thicker than v14: detail you can see at screenshot
  // distance, not a whisper.
  // v16b: irregular spacing + half the alpha — the v15 even 10x10 grid
  // read as a chessboard of boxes on the smooth fuselage. Real panel
  // lines are uneven and subtle.
  // v18: pale faint lines — the v17 near-black 0.5-alpha grid segmented
  // the smooth fuselage into boxes ("kotak-kotak"). Real panel lines at
  // chase distance are a whisper, not a grid.
  g.strokeStyle = 'rgba(96,106,118,0.28)';
  g.lineWidth = 1.5;
  for (const y of [44, 96, 152, 214, 272, 336, 398, 462]) {
    g.beginPath(); g.moveTo(16, y); g.lineTo(496, y); g.stroke();
  }
  for (const x of [52, 118, 186, 252, 318, 388, 452]) {
    g.beginPath(); g.moveTo(x, 20); g.lineTo(x, 492); g.stroke();
  }
  // Distinct panel shades (fadli-15c): neighbouring panels are slightly
  // different greys, each outlined — the patchwork skin of the real jet.
  // Drawn AFTER the grid so the outlines sit on top of the lines.
  const panelShades = ['#DDE2E7', '#C4CBD2', '#B2BAC2', '#E4E8EC', '#CCD2D9', '#BFC6CD'];
  for (let i = 0; i < 14; i++) {
    const x = 20 + rnd() * 400, y = 20 + rnd() * 400;
    const w = 44 + rnd() * 90, h = 36 + rnd() * 70;
    g.fillStyle = panelShades[i % panelShades.length];
    // v16b: no stroked outline, half the alpha — the v15 outlined
    // rectangles read as boxes pasted on the skin.
    g.globalAlpha = 0.12;
    g.fillRect(x, y, w, h);
    g.globalAlpha = 1;
  }
  // Finer secondary seams.
  g.strokeStyle = 'rgba(96,106,118,0.20)';
  g.lineWidth = 1.5;
  for (const y of [64, 112, 160, 208, 256, 304, 352, 400, 448]) {
    g.beginPath(); g.moveTo(20, y); g.lineTo(492, y); g.stroke();
  }
  for (const x of [72, 120, 168, 216, 264, 312, 360, 408]) {
    g.beginPath(); g.moveTo(x, 24); g.lineTo(x, 488); g.stroke();
  }
  // Diagonal leading-edge seams.
  g.beginPath(); g.moveTo(20, 470); g.lineTo(256, 300); g.lineTo(492, 470); g.stroke();
  g.beginPath(); g.moveTo(60, 60); g.lineTo(256, 210); g.lineTo(452, 60); g.stroke();
  // Access panels: small stroked rectangles scattered on the skin.
  g.strokeStyle = 'rgba(96,106,118,0.22)';
  g.lineWidth = 1.5;
  for (let i = 0; i < 28; i++) {
    const x = 30 + rnd() * 420, y = 30 + rnd() * 420;
    g.strokeRect(x, y, 34 + rnd() * 26, 22 + rnd() * 16);
  }
  // Rivet dots along the chordwise lines.
  g.fillStyle = 'rgba(96,106,118,0.22)';
  for (const y of [48, 120, 200, 280, 360, 440]) {
    for (let x = 30; x < 500; x += 12) { g.fillRect(x, y - 1, 2, 2); }
  }
  // Pale leading-edge strip.
  g.fillStyle = 'rgba(180,188,196,0.4)';
  g.fillRect(0, 0, 512, 14);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1 / 7.4, 1 / 10);
  tex.offset.set(0.5, 0.5);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Fin skin (v15): the v14 fins were flat dark slabs — no detail, so from
// behind they read as two black boards. The fin gets its OWN light-grey
// panel texture (same family as the fuselage, so fin and body are one
// aircraft, like fadli-15b) with panel lines + shade patches. Extrude
// UVs are the fin shape's own coordinates (chord -0.75..0.75, height
// 0..2.1), so repeat maps those metres to 0..1.
function finTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#DDE2E7');
  grad.addColorStop(0.5, '#CCD2D9');
  grad.addColorStop(1, '#BCC3CB');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  let seed = 7777;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  // Distinct panel shades (fadli-15c: the fin is a patchwork of greys).
  const shades = ['#E2E6EA', '#C9CFD6', '#B7BFC7', '#D5DAE0'];
  for (let i = 0; i < 6; i++) {
    const x = rnd() * 190, y = rnd() * 190, w = 40 + rnd() * 90, h = 30 + rnd() * 70;
    g.fillStyle = shades[i % shades.length];
    // v16b: no stroked outline, softer — the v15 outlined patches read as boxes.
    g.globalAlpha = 0.20;
    g.fillRect(x, y, w, h);
    g.globalAlpha = 1;
  }
  // Horizontal panel lines (chordwise stations on the fin).
  // v18: pale and faint like the fuselage lines.
  g.strokeStyle = 'rgba(96,106,118,0.25)';
  g.lineWidth = 1.5;
  for (const y of [32, 80, 128, 176, 224]) {
    g.beginPath(); g.moveTo(8, y); g.lineTo(248, y); g.stroke();
  }
  // Two diagonal seams following the fin's sweep.
  g.strokeStyle = 'rgba(96,106,118,0.25)';
  g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(20, 240); g.lineTo(150, 20); g.stroke();
  g.beginPath(); g.moveTo(90, 240); g.lineTo(220, 30); g.stroke();
  // Rivets along the horizontal lines.
  g.fillStyle = 'rgba(96,106,118,0.25)';
  for (const y of [32, 80, 128, 176, 224]) {
    for (let x = 16; x < 248; x += 12) { g.fillRect(x, y - 1, 2, 2); }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1 / 1.5, 1 / 2.1);
  tex.offset.set(0.5, 0);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Intake side decal (v15): tail number + warning stripe on the intake's
// flat outer face — the small hard detail that makes the intake read as
// built hardware (fadli-15c), not a smooth duct.
function intakeDecalTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#7C848E'; // v18: matches the lightened intake duct
  g.fillRect(0, 0, 256, 64);
  g.strokeStyle = 'rgba(96,106,118,0.6)'; // v18: softer placard border
  g.lineWidth = 2;
  g.strokeRect(4, 4, 248, 56);
  g.beginPath(); g.moveTo(128, 4); g.lineTo(128, 60); g.stroke();
  g.fillStyle = '#C8CDD4';
  g.font = 'bold 34px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('07', 64, 34);
  g.fillStyle = '#D32F2F';
  g.fillRect(140, 22, 104, 20);
  g.fillStyle = '#FFFFFF';
  g.font = 'bold 13px system-ui, sans-serif';
  g.fillText('DANGER', 192, 33);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// LERX top decal (v15): tail number on the strake, readable on the
// banking shot (fadli-15c).
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

// (The old round ember disc is retired in v15 — the nozzle is a
// rectangle now; see emberRectTexture below.)

// Rectangular 2D nozzle interior (v15, fadli-15b): the real F-22 nozzle
// is a flat rectangle, wider than tall, with the orange flame INSIDE it
// — not a round disc. Rounded-rect hot core (white-yellow-orange) with
// vertical flame streaks and a dark petal rim, so the nozzle reads as
// two glowing rectangles from behind, like the photo.
function emberRectTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 80;
  const g = c.getContext('2d');
  // Dark petal rim.
  g.fillStyle = '#1A0A00';
  g.fillRect(0, 0, 128, 80);
  // Hot core: rounded rect, white-hot centre fading to orange edge.
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
  // Vertical flame streaks: bright tongues inside the rectangle.
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
  // Petal segment lines across the rim.
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
// v16 (fadli: "masih kotak-kotak", "bikin halus detail 3D dan HD"):
// 15 rounds proved recolouring + panel textures never remove the boxy
// look — the BOXY look is the GEOMETRY. The v15 fuselage was an
// 8-point octagon ring (flat facets on the spine and belly), and the
// wings/fins were flat extruded plates with sharp edges. This version
// rebuilds every airframe part as a SMOOTH LOFT: curved cross-sections
// with many points and smooth normals, so no flat facet or hard edge
// shows at zoom. Proportions, colours, textures and panel detail are
// UNCHANGED from v15.

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
function airfoilWingGeometry({ s0, s1, chordRoot, chordTip, thick = 0.10, camber = 0.14, sweep = 0, side = 1 }) {
  const section = airfoilRing(thick, 18);
  const nSec = section.length;
  const NS = 7;
  const positions = [], uvs = [], indices = [];
  for (let i = 0; i < NS; i++) {
    const t = i / (NS - 1);
    const s = s0 + (s1 - s0) * t;
    const c = chordRoot + (chordTip - chordRoot) * Math.pow(t, 0.85);
    const zc = -sweep * t;
    const cam = camber * (c / chordRoot);
    for (let j = 0; j < nSec; j++) {
      const [xi, yi] = section[j];
      positions.push(side * s, cam * Math.sin(Math.PI * xi) + yi * c, zc + (0.5 - xi) * c);
      uvs.push(s * 0.5, xi * c * 0.5);
    }
  }
  for (let i = 0; i < NS - 1; i++) {
    for (let j = 0; j < nSec; j++) {
      const j2 = (j + 1) % nSec;
      const a = i * nSec + j, b = i * nSec + j2;
      const cc = (i + 1) * nSec + j, d = (i + 1) * nSec + j2;
      if (side > 0) indices.push(a, cc, b, b, cc, d);
      else indices.push(a, b, cc, b, d, cc);
    }
  }
  // Tip cap fan: a real wing tip is a flat face, small enough to read
  // as an edge, not a facet.
  const tipC = positions.length / 3;
  let cx = 0, cy = 0, cz = 0;
  const last = NS - 1;
  for (let j = 0; j < nSec; j++) {
    cx += positions[(last * nSec + j) * 3];
    cy += positions[(last * nSec + j) * 3 + 1];
    cz += positions[(last * nSec + j) * 3 + 2];
  }
  positions.push(cx / nSec, cy / nSec, cz / nSec);
  uvs.push(s1 * 0.5, 0.5);
  for (let j = 0; j < nSec; j++) {
    const j2 = (j + 1) % nSec;
    if (side > 0) indices.push(last * nSec + j, tipC, last * nSec + j2);
    else indices.push(last * nSec + j, last * nSec + j2, tipC);
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
// The v15 fin was a flat extruded plate — from behind it read as a
// board; this one is a real airfoil with a round leading edge.
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
  // Tip cap fan (faces +Y, the top of the fin).
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

// Smooth superellipse fuselage cross-section (v16): the v15 ring was 8
// points — an octagon, so the fuselage was 8 flat facets with hard
// chines. A superellipse (exponent 2.6) keeps the F-22's wide-flat
// chined look (flat-ish top, flat sides, keeled belly) as a SMOOTH
// curve: no straight segment anywhere.
function fuselageRing(st, t) {
  const n = st.n ?? 2.6, e = 2 / n; // v17: rounder nose (n=2.0 at the tip) — the flat-topped n=2.6 nose read as a box from the front
  const c = Math.cos(t), s = Math.sin(t);
  const x = st.w * Math.sign(c) * Math.pow(Math.abs(c), e);
  const y = st.y + (s >= 0 ? st.ht : st.hb) * Math.sign(s) * Math.pow(Math.abs(s), e);
  return [x, y];
}

// Smooth dorsal spine: an elliptical fairing tapering to a point at
// both ends (v15 was a flat-topped rounded-rect strip). Local coords,
// mesh positioned at (0, 0.58, -1.6) like before.
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

// Volumetric fuselage loft: a chined body built from cross-section rings
// along Z, nose (+Z) to tail (-Z). Each ring is a 32-point superellipse
// (v16) — smooth curved section, wide mid-body, keeled belly — so the
// fuselage has real height and width from every angle. Smooth the loft
// lengthwise: insert interpolated midpoints between the hand-placed
// stations so the fuselage has 23 rings instead of 12 — more rings,
// same shape; computeVertexNormals then shades it as one smooth sculpted
// body (ref 02), not a stack of facets.
function interpStations(stations) {
  const out = [];
  for (let i = 0; i < stations.length; i++) {
    out.push(stations[i]);
    if (i < stations.length - 1) {
      const a = stations[i], b = stations[i + 1];
      out.push({
        z: (a.z + b.z) / 2, y: (a.y + b.y) / 2, w: (a.w + b.w) / 2,
        ht: (a.ht + b.ht) / 2, hb: (a.hb + b.hb) / 2,
        n: ((a.n ?? 2.6) + (b.n ?? 2.6)) / 2,
      });
    }
  }
  return out;
}

// Rounded rectangle in the XY plane, for ducts and housings that must
// read as smooth rounded forms — NEVER a box. A rounded-rect extrude
// with a bevel has soft edges all round.
function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

// A rounded duct: rounded-rect cross-section extruded along +Z, bevelled
// all round so no edge is sharp. Returns geometry centred on the origin
// along Z (extrusion runs -len/2..+len/2).
function roundedDuctGeometry(w, h, len, r) {
  const geo = new THREE.ExtrudeGeometry(roundedRectShape(w, h, r), {
    depth: len, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06,
    bevelSegments: 4, curveSegments: 16,
  });
  geo.translate(0, 0, -len / 2);
  return geo;
}

// Hollow rectangular tube (v16b): the same rounded-rect extrusion as
// roundedDuctGeometry, but with a bore — no end caps. A nozzle is a tube,
// not a solid bar: the v16 solid duct's back cap was a flat metal face
// that read as a white rectangle from behind AND buried the ember plane
// (the 0.06 bevel put the duct's back face at -6.31, in front of the
// ember at -6.29 — the ember never rendered). The tube has no cap, so the
// ember + dark interior behind it are visible through the mouth.
// No bevel: the petal frame supplies the finished rim, and a bevel would
// narrow the bore.
function roundedTubeGeometry(w, h, len, r, iw, ih, ir) {
  const shape = roundedRectShape(w, h, r);
  shape.holes.push(new THREE.Path(roundedRectShape(iw, ih, ir).getPoints(12)));
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: len, bevelEnabled: false, curveSegments: 16,
  });
  geo.translate(0, 0, -len / 2);
  return geo;
}

// Volumetric fuselage loft (v16): the same 12 stations (interpolated
// to 23 rings), but each ring is now a 32-point superellipse — a smooth
// curved surface, never an octagon of flat facets.
function fuselageGeometry(stations) {
  const nR = 32;
  const geo = loftZGeometry(stations, fuselageRing, nR);
  // Tail cap fan (faces -Z, the rear of the jet).
  const nS = stations.length;
  const last = stations[nS - 1];
  const pos = geo.attributes.position;
  const tailC = pos.count;
  const positions = Array.from(pos.array);
  positions.push(0, last.y, last.z);
  const uv = geo.attributes.uv;
  const uvs = Array.from(uv.array);
  uvs.push(0.5, 1);
  const indices = Array.from(geo.getIndex().array);
  for (let j = 0; j < nR; j++) {
    const j2 = (j + 1) % nR;
    indices.push((nS - 1) * nR + j, tailC, (nS - 1) * nR + j2);
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// A flame cone: apex backward (-Z), base at the nozzle exit. The group
// scales in Z to grow or shrink the flame without moving its base.
// v15: the cone is pre-flattened (wide, thin) — the F-22's 2D nozzle
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

// Wing skin texture: VISIBLE panel detail (v15, fadli-15c — the real
// wing shows clear panel lines). The texture tiles ~4x across the wing
// (ExtrudeGeometry UVs are the shape's own metres), so it is drawn as a
// regular tile: a panel grid with shade patches and a flap/aileron hinge
// line. Stronger than v14's whisper, but the lines stay thin and the
// patches soft, so the wing reads as built skin, not a chessboard.
function wingTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0, '#DDE2E7');
  grad.addColorStop(0.5, '#CBD1D8');
  grad.addColorStop(1, '#BCC3CB');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 512);
  let seed = 9917;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  // Panel shade patches (tile-friendly: drawn inside the tile).
  const shades = ['#E0E4E9', '#C9CFD6', '#B7BFC7', '#D8DDE2'];
  for (let i = 0; i < 8; i++) {
    const x = rnd() * 400, y = rnd() * 400, w = 60 + rnd() * 90, h = 50 + rnd() * 80;
    g.fillStyle = shades[i % shades.length];
    // v16b: no stroked outline — the v15 outlined patches read as boxes.
    g.globalAlpha = 0.20;
    g.fillRect(x, y, w, h);
    g.globalAlpha = 1;
  }
  for (let i = 0; i < 14; i++) {
    const x = rnd() * 512, y = rnd() * 512, r = 30 + rnd() * 70;
    const bg = g.createRadialGradient(x, y, 0, x, y, r);
    bg.addColorStop(0, rnd() > 0.5 ? 'rgba(130,140,152,0.12)' : 'rgba(215,221,227,0.12)');
    bg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = bg;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  // Panel grid: chordwise + spanwise seams, every 128 px (tiles cleanly).
  // v18: pale and faint — the v17 grid segmented the wing into boxes.
  g.strokeStyle = 'rgba(96,106,118,0.20)';
  g.lineWidth = 1.5;
  for (const y of [128, 256, 384]) {
    g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke();
  }
  for (const x of [128, 256, 384]) {
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke();
  }
  // Flap / aileron hinge line + trailing-edge strip.
  g.strokeStyle = 'rgba(96,106,118,0.35)';
  g.lineWidth = 2;
  g.beginPath(); g.moveTo(0, 440); g.lineTo(512, 440); g.stroke();
  g.strokeStyle = 'rgba(96,106,118,0.20)';
  g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(0, 470); g.lineTo(512, 470); g.stroke();
  // Two soft diagonal seams for the panel feel, low alpha.
  g.strokeStyle = 'rgba(96,106,118,0.18)';
  g.beginPath(); g.moveTo(40, 480); g.lineTo(300, 40); g.stroke();
  g.beginPath(); g.moveTo(220, 480); g.lineTo(480, 60); g.stroke();
  // v16b: access-panel rectangles removed — stroked boxes on the wing.
  const tex = new THREE.CanvasTexture(c);
  // v16: the lofted wing's UVs are in metres and tile every 2 m, so the
  // texture must repeat (the v15 extrude UVs were clamped by accident).
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function buildAircraft() {
  const group = new THREE.Group();
  group.name = 'aircraft';

  // v18 materials: SILVER (fadli-15b/15c). The v17 base greys gave an
  // albedo of ~0.4 — dark navy from the chase camera. Albedo is now
  // ~0.7 (near-white textures x near-white multiply), metalness stays
  // low (metal goes near-black in shadow with no env map) and roughness
  // drops a touch so the low sun sheens the skin instead of chalking it.
  const stealth = new THREE.MeshStandardMaterial({ color: 0xA9B1B9, metalness: 0.25, roughness: 0.55 });
  const stealthTop = new THREE.MeshStandardMaterial({ map: panelTexture(), color: 0xDDE2E7, metalness: 0.25, roughness: 0.58 });
  // Wing skin: the detailed texture above — panel grid + hinge line.
  const wingTop = new THREE.MeshStandardMaterial({ map: wingTexture(), color: 0xD5DAE0, metalness: 0.25, roughness: 0.58 });
  // Fin skin: light grey with its own panel texture — fin and body are
  // ONE aircraft (fadli-15b), never a dark board on a grey body.
  const finTex = finTexture();
  const finMat = new THREE.MeshStandardMaterial({ map: finTex, color: 0xDDE2E7, metalness: 0.25, roughness: 0.58 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x767E87, metalness: 0.4, roughness: 0.55 });
  const nozzleMat = new THREE.MeshStandardMaterial({ color: 0x3D4248, metalness: 0.35, roughness: 0.6 });
  const emberRectTex = emberRectTexture();
  const lerxDecalTex = lerxDecalTexture();
  // Canopy glass: v15 brighter gold (fadli-15c — the canopy is a big
  // bright gold bubble, not a dim dot): stronger emissive so it glows
  // warm even from the shadow side.
  const glass = new THREE.MeshStandardMaterial({
    color: 0xD9A83C, metalness: 0.65, roughness: 0.22,
    emissive: 0x8A5A10, emissiveIntensity: 0.6,
  });
  // v17: NO landing-gear materials — the gear is deleted (see below).

  // Fuselage: chined loft, nose toward +Z. Stations are {z, y, w, ht, hb}:
  // half-width, top height and belly depth at each station. TRUE F-22
  // proportions at model scale: the body is 12.6 m long, 1.34 m wide and
  // ~1.0 m tall at mid-body — LONG and NARROW (real jet 18.9 m long on a
  // 2.0 m wide body). The v13 body was 10.4 m long and 2.32 m wide:
  // stubby and twice too fat, which is why it read as a toy. From behind
  // this one is a slim diamond between the wings, with the canopy rising
  // above it.
  // v15 SHAPE (fadli: "liat bentuk nya"): the real F-22 fuselage is WIDE
  // and FLAT in the middle — the body swells out and the delta blends
  // into it, it is NOT a round tube (fadli-15b/15c). Mid-body is now
  // 1.80 m wide and only ~0.84 m tall (2.1:1, wide and flat); the nose
  // stays long and pointed, the tail face stays narrow. Length 12.6 m
  // and span 9.0 m are UNCHANGED.
  const FUSELAGE_STATIONS = [
    { z: 6.6, y: 0.00, w: 0.02, ht: 0.02, hb: 0.02, n: 2.0 }, // nose tip — round
    { z: 6.1, y: 0.01, w: 0.13, ht: 0.11, hb: 0.09, n: 2.0 }, // round nose cone
    { z: 5.3, y: 0.03, w: 0.27, ht: 0.21, hb: 0.18, n: 2.1 }, // slim, round
    { z: 4.3, y: 0.05, w: 0.50, ht: 0.35, hb: 0.28, n: 2.3 }, // blending to chined
    { z: 3.1, y: 0.06, w: 0.74, ht: 0.43, hb: 0.34, n: 2.5 },
    { z: 1.9, y: 0.04, w: 0.88, ht: 0.48, hb: 0.36 },
    { z: 0.5, y: 0.02, w: 0.90, ht: 0.48, hb: 0.36 },
    { z: -1.1, y: 0.02, w: 0.86, ht: 0.44, hb: 0.34 },
    { z: -2.7, y: 0.00, w: 0.78, ht: 0.40, hb: 0.32 },
    { z: -4.3, y: -0.02, w: 0.66, ht: 0.34, hb: 0.28 },
    { z: -5.3, y: -0.03, w: 0.56, ht: 0.30, hb: 0.26 },
    { z: -6.0, y: -0.03, w: 0.52, ht: 0.27, hb: 0.24 }, // tail face
  ];
  // The fuselage gets its own panel-texture instance: the loft's UVs run
  // u = around the ring, v = along the body, so repeat (1,1) puts the
  // panel stations along the fuselage and the seams around it.
  const fuseTex = panelTexture();
  fuseTex.repeat.set(1, 1);
  fuseTex.offset.set(0, 0);
  const fuselageMat = new THREE.MeshStandardMaterial({ map: fuseTex, color: 0xDDE2E7, metalness: 0.25, roughness: 0.58 });
  const fuselage = new THREE.Mesh(fuselageGeometry(interpStations(FUSELAGE_STATIONS)), fuselageMat);
  fuselage.name = 'fuselage';
  group.add(fuselage);

  // Dorsal spine: a smooth elliptical fairing along the fuselage top
  // from the canopy to the tail — the centreline volume that reads
  // from behind. v16: lofted ellipse (was a flat-topped duct strip).
  const spine = new THREE.Mesh(spineGeometry(), stealthTop);
  spine.position.set(0, 0.58, -1.6); // v15: body top is lower (flatter body), spine follows it down
  group.add(spine);

  // Main delta wings: separate panels, low-mounted on the fuselage
  // (y -0.18, below the body centreline), slight anhedral, blended into
  // the fuselage sides. TRUE proportions: root chord 3.7 m on a 12.6 m
  // body (ratio 0.29, like the real jet) and span 9.0 m — the v13 wing
  // root chord was 6.0 m on a 10.4 m body (ratio 0.58), which is why the
  // jet was mostly wing. The wing is one part — the body is the other.
  for (const side of [-1, 1]) {
    // Main delta wing (v16): a SMOOTH lofted airfoil — round leading
    // edge, cambered upper skin, tapered trailing edge — never a flat
    // extruded plate. Same planform as v15 (root chord 3.7 m, span
    // 9.0 m), same position and slight anhedral.
    const wing = new THREE.Mesh(
      airfoilWingGeometry({ s0: 0.45, s1: 4.52, chordRoot: 3.7, chordTip: 0.8, thick: 0.13, camber: 0.20, side }),
      wingTop,
    );
    wing.position.set(0, -0.18, -0.9);
    wing.rotation.z = -side * 0.05; // slight anhedral, mirrored
    wing.name = 'wing';
    group.add(wing);
    // LERX: the forward strake from the wing root to the cockpit, a
    // smooth cambered strake — the F-22's chined forebody extension,
    // visible on the banking shot.
    const lerx = new THREE.Mesh(
      airfoilWingGeometry({ s0: 0.4, s1: 1.9, chordRoot: 2.4, chordTip: 0.8, thick: 0.12, camber: 0.08, side }),
      wingTop,
    );
    lerx.position.set(0, 0.02, 2.4);
    lerx.rotation.z = -side * 0.05;
    lerx.name = 'lerx';
    group.add(lerx);
    // Tail number on the LERX top, readable on the banking shot.
    // v16: lowered to sit on the lofted LERX top (~0.14).
    const lerxDec = new THREE.Mesh(
      new THREE.PlaneGeometry(0.8, 0.4),
      new THREE.MeshBasicMaterial({ map: lerxDecalTex, transparent: true }),
    );
    lerxDec.userData.noShadow = true;
    lerxDec.rotation.x = -Math.PI / 2;
    lerxDec.position.set(side * 1.1, 0.17, 2.9);
    group.add(lerxDec);
  }

  // Canopy: a LONG gold bubble FLUSH with the fuselage top, from ahead
  // of the wing to the nose — not a ball perched on a flat plate. Sized
  // to the real jet (2.3 m long, 0.6 m wide) and raised so it reads
  // clearly from behind as a gold bubble on the spine — the v13 canopy
  // was a tiny gold dot from the chase camera.
  // v15 (fadli-15c): BIGGER and BRIGHTER — in the photo the canopy is a
  // large gold bubble, unmissable from behind and from the side. Now
  // 0.76 m wide, 0.64 m tall, 2.7 m long, raised higher, with a brighter
  // gold glass and a frame bow across its middle.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), glass);
  canopy.scale.set(0.38, 0.32, 1.35);
  canopy.position.set(0, 0.62, 2.7);
  canopy.name = 'canopy';
  group.add(canopy);
  // Smooth canopy fairing (v17): the gold bubble emerges from a smooth
  // fuselage-grey fairing — the v16 dark torus coaming + frame bow read
  // as a flat plate/box around the canopy base from the chase camera
  // ("depan kotak-kotak"). No dark ring, no hoop: just the bubble
  // growing out of the spine.
  const fairing = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), stealth);
  fairing.scale.set(0.42, 0.20, 1.45);
  fairing.position.set(0, 0.52, 2.7);
  group.add(fairing);

  // Canted twin tails: tall but SLIM swept fins leaning out ~28 degrees,
  // the Raptor's signature. The v13 fins were 2.4 m chord slabs that
  // dominated the whole rear view like barn doors; these are 1.7 m at
  // the root tapering to 0.4 m at the tip and only 0.14 m thick — tall
  // blades, like ref 01.
  // v15: SLIMMER still (1.5 m root, 2.1 m tall, 0.12 m thick) and — the
  // fix that matters — LIGHT GREY with panel detail (finMat), the SAME
  // grey family as the fuselage (fadli-15b: the tail is the same light
  // grey as the body, never a black board). The v14 fins used the dark
  // stealth material, so from behind they read as two black boards.
  // v16: the fin is a SMOOTH lofted airfoil (finLoftGeometry) — round
  // leading edge, tapered trailing edge — never a flat extruded plate.
  // Same planform as v15 (1.5 m root chord, 2.1 m tall, canted 28°),
  // same light-grey panelled skin.
  const finGeo = finLoftGeometry();
  const decalTex = raptorDecalTexture();
  for (const side of [-1, 1]) {
    const tail = new THREE.Group();
    tail.position.set(side * 0.62, 0.30, -4.3);
    tail.rotation.z = -side * 0.5; // cant outward ~28 deg
    const fin = new THREE.Mesh(finGeo, finMat);
    tail.add(fin);
    // "RAPTOR" + tail number on the outer face of the fin.
    // v16: moved in to sit on the lofted fin's surface (~0.05 half-thickness at this height).
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

  // Stabilators: small all-moving tails, slight anhedral, on the tail.
  // v16: smooth lofted airfoils like the wings.
  for (const side of [-1, 1]) {
    const stab = new THREE.Mesh(
      airfoilWingGeometry({ s0: 0.1, s1: 2.0, chordRoot: 1.2, chordTip: 0.65, thick: 0.12, camber: 0.07, side }),
      wingTop,
    );
    stab.position.set(0, -0.05, -5.0);
    stab.rotation.z = -side * 0.07;
    group.add(stab);
  }

  // Caret intakes: slim rounded ducts on the fuselage sides, with dark
  // forward mouths and a ramp lip above — visible from behind as rounded
  // forms flanking the body and from the side as the F-22's intakes.
  // Rounded-rect extrude with a bevel, so every edge is soft — NO BOXES.
  const mouthMat = new THREE.MeshBasicMaterial({ color: 0x0A0C0E });
  const intakeDecalTex = intakeDecalTexture();
  for (const side of [-1, 1]) {
    // v17: slim ramp hugging the fuselage — the v16 full tube + the
    // half-cylinder "lip" on top read as separate silver tubes strapped
    // to the body (depan-shot3). The lip is DELETED; the duct is
    // narrower, sunk inboard and lower so it blends into the fuselage
    // side instead of standing off it.
    const duct = new THREE.Mesh(roundedDuctGeometry(0.42, 0.72, 2.0, 0.20), dark);
    duct.position.set(side * 0.97, -0.12, 1.7);
    duct.name = 'intake';
    group.add(duct);
    const mouth = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.62), mouthMat);
    mouth.userData.noShadow = true;
    mouth.position.set(side * 0.97, -0.12, 2.71);
    group.add(mouth);
    // Tail number + DANGER stripe on the intake's flat outer face.
    const dec = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 0.34),
      new THREE.MeshBasicMaterial({ map: intakeDecalTex, transparent: false }),
    );
    dec.userData.noShadow = true;
    dec.position.set(side * 1.19, -0.12, 1.7);
    dec.rotation.y = side * Math.PI / 2;
    group.add(dec);
  }

  // Twin 2D nozzles at the tail face (v15, fadli-15b): the real F-22
  // nozzle is a FLAT RECTANGLE, wider than tall, with the orange flame
  // INSIDE it — the v14 round cylinders + round ember discs read as two
  // glowing headlights from behind. Each nozzle is now a wide flat
  // rectangular duct (0.52 x 0.36 m) with a metallic petal frame and a
  // rectangular ember plane inside it. No circles anywhere in the tail.
  const emberRectMat = new THREE.MeshBasicMaterial({ map: emberRectTex });
  const embers = [];
  // Dark nozzle interior (v16b): a near-black plane deep in the bore so
  // the eye reads a dark opening, never through to the fuselage.
  const interiorMat = new THREE.MeshBasicMaterial({ color: 0x0C0A08 });
  for (const side of [-1, 1]) {
    // Hollow tube (v16b): bore 0.44 x 0.28, no end caps — the v16 solid
    // duct's cap was the white rectangle and it buried the ember.
    const nozzle = new THREE.Mesh(roundedTubeGeometry(0.52, 0.36, 0.8, 0.12, 0.44, 0.28, 0.09), nozzleMat);
    nozzle.position.set(side * 0.32, -0.02, -5.85);
    group.add(nozzle);
    // Flared petal frame at the nozzle exit: a flat rectangular ring,
    // metallic, with the ember rectangle set inside it. Dulled (v16b):
    // the 0.9-metal frame blew out to a white rectangle under the
    // chase-fill light.
    const frameShape = roundedRectShape(0.56, 0.40, 0.13);
    frameShape.holes.push(new THREE.Path(roundedRectShape(0.44, 0.28, 0.09).getPoints(12)));
    const frameGeo = new THREE.ExtrudeGeometry(frameShape, {
      depth: 0.1, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02,
      bevelSegments: 2, curveSegments: 12,
    });
    const frame = new THREE.Mesh(frameGeo, new THREE.MeshStandardMaterial({ color: 0x9AA2AB, metalness: 0.4, roughness: 0.55 }));
    frame.position.set(side * 0.32, -0.02, -6.30);
    group.add(frame);
    // Dark interior plane deep in the bore (behind the ember).
    const interior = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.30), interiorMat);
    interior.rotation.y = Math.PI; // face backward
    interior.position.set(side * 0.32, -0.02, -6.10);
    interior.userData.noShadow = true;
    group.add(interior);
    const ember = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.26), emberRectMat);
    ember.rotation.y = Math.PI; // face backward
    ember.position.set(side * 0.32, -0.02, -6.28);
    ember.userData.noShadow = true;
    group.add(ember);
    embers.push(ember);
  }

  // Afterburner: layered flames behind each nozzle (orange shell, yellow
  // core, blue root) plus a warm point light. SMALLER than v13 — the v13
  // flames plus their glare sprites were the "headlights". The flame
  // groups scale in Z so the flame grows out of the nozzle instead of
  // sliding. Ref 08's flame is a compact layered glow inside the
  // nozzle, not a fireball.
  // v15: the flames are FLAT sheets (flameCone pre-flattens them) and
  // the glare sprites are smaller and dimmer — the nozzle must read as
  // a rectangle with fire inside it, never as two round lamps.
  const glowTex = glowTexture();
  const flames = [];
  const abLight = new THREE.PointLight(0xFF8033, 0, 60, 1.5);
  abLight.position.set(0, 0, -7);
  group.add(abLight);
  // Chase fill (v15, fadli-15b): a warm point light riding behind and
  // below the jet, parented to the aircraft so it always sits on the
  // camera side. The low western sun leaves the rear faces in shadow
  // from the chase camera — this lifts them to LIGHT GREY (like the
  // photo) instead of a black silhouette. A point light, not a
  // directional: its falloff (distance 45) means it lights the jet and
  // almost nothing else — the terrain 100+ m away is untouched.
  const chaseFill = new THREE.PointLight(0xFFC08A, 48, 45, 1.5); // v18: moved UP onto the camera side (-3.5, 3.5, -12) — the v17 light sat below-behind (0, -1.5, -10) and lit the belly, while the chase camera sees the top + rear flank; same intensity 48, the directional camera key in main.js does the heavy lifting now
  chaseFill.position.set(-3.5, 3.5, -12);
  group.add(chaseFill);
  for (const side of [-1, 1]) {
    const fg = new THREE.Group();
    fg.position.set(side * 0.32, -0.02, -6.3);
    fg.add(flameCone(0xFF7A18, 0.20, 0.75, 0.22)); // v18: the flame lives INSIDE the rectangular nozzle (fadli-15b) — the external sheet is short and dim, the ember rect does the talking; the v17 long bright cones read as two yellow-white tongues
    fg.add(flameCone(0xFFD75E, 0.11, 0.6, 0.35));
    fg.add(flameCone(0x66CCFF, 0.06, 0.4, 0.4));
    fg.add(flameCone(0xFFF6D8, 0.035, 0.3, 0.55)); // white-hot core
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
  // v16b: the tail lamp's halo is smaller and dimmer than the wingtips' —
  // at 0.8 it read as a white blob on the tail centreline (right above
  // the nozzles, where the eye lands) in the v16b zoom.
  const lights = [
    [0xFF2222, -4.48, -0.1, -0.9, 0.8, 0.85],
    [0x22FF66, 4.48, -0.1, -0.9, 0.8, 0.85],
    [0xFFFFFF, 0, 0.3, -6.0, 0.45, 0.5],
  ];
  for (const [col, x, y, z, glowScale, glowOpacity] of lights) {
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 10, 8),
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

  // Shadows: everything solid casts; decals, flames and glows do not.
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
        emberRectMat.color.setHex(0x241A12); // dark warm interior at idle (v16b: the nozzle reads as a dark opening, not a brown box)
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
