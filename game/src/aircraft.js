// aircraft.js — the F-22 RAPTOR. v15: detail maximal + shape fix, from
// fadli's own photos (fadli-15b rear, fadli-15c banking, fadli-15a AC7
// sunset sea). The v14 jet still read wrong from the chase camera: two
// black-board tails, two round headlight nozzles, a dark silhouette, a
// dot canopy, flat-board wings, a round-tube body. This version:
// wide FLAT blended body (1.80 m x 0.84 m mid-body, not a tube), light
// grey panelled fins the same grey as the body, flat RECTANGULAR 2D
// nozzles with the flame inside, a warm chase-fill light so the rear
// reads LIGHT GREY (fadli-15b), a big bright gold canopy, thicker
// cambered panelled wings, and panel detail everywhere — clear panel
// lines, distinct panel shades, decals (RAPTOR/07/DANGER), intake
// detail. Length 12.6 m, span 9.0 m, ratio 1.40 — unchanged.

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
  grad.addColorStop(0, '#8E969E');
  grad.addColorStop(0.5, '#7E868F');
  grad.addColorStop(1, '#6E767F');
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
    g.fillStyle = rnd() > 0.5 ? 'rgba(128,138,150,0.14)' : 'rgba(88,96,106,0.14)';
    g.fillRect(x - w / 2, y - h / 2, w, h);
  }
  for (let i = 0; i < 36; i++) {
    const x = rnd() * 512, y = rnd() * 512, r = 20 + rnd() * 60;
    const bg = g.createRadialGradient(x, y, 0, x, y, r);
    const dark = rnd() > 0.45;
    bg.addColorStop(0, dark ? 'rgba(70,78,88,0.24)' : 'rgba(160,168,178,0.16)');
    bg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = bg;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  // Panel lines: chordwise stations + spanwise seams — VISIBLE (v15,
  // fadli-15c: the real Raptor's panel lines show clearly all over the
  // body). Darker and thicker than v14: detail you can see at screenshot
  // distance, not a whisper.
  g.strokeStyle = 'rgba(40,48,58,0.95)';
  g.lineWidth = 3.5;
  for (const y of [40, 88, 136, 184, 232, 280, 328, 376, 424, 472]) {
    g.beginPath(); g.moveTo(16, y); g.lineTo(496, y); g.stroke();
  }
  for (const x of [48, 96, 144, 192, 240, 288, 336, 384, 432, 464]) {
    g.beginPath(); g.moveTo(x, 20); g.lineTo(x, 492); g.stroke();
  }
  // Distinct panel shades (fadli-15c): neighbouring panels are slightly
  // different greys, each outlined — the patchwork skin of the real jet.
  // Drawn AFTER the grid so the outlines sit on top of the lines.
  const panelShades = ['#8B939D', '#6A727C', '#565E66', '#9AA2AB', '#7A828C', '#B0B8C0'];
  for (let i = 0; i < 14; i++) {
    const x = 20 + rnd() * 400, y = 20 + rnd() * 400;
    const w = 44 + rnd() * 90, h = 36 + rnd() * 70;
    g.fillStyle = panelShades[i % panelShades.length];
    g.globalAlpha = 0.22;
    g.fillRect(x, y, w, h);
    g.globalAlpha = 1;
    g.strokeStyle = 'rgba(40,48,58,0.75)';
    g.lineWidth = 2;
    g.strokeRect(x, y, w, h);
  }
  // Finer secondary seams.
  g.strokeStyle = 'rgba(64,72,82,0.45)';
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
  g.strokeStyle = 'rgba(54,62,72,0.55)';
  g.lineWidth = 2;
  for (let i = 0; i < 28; i++) {
    const x = 30 + rnd() * 420, y = 30 + rnd() * 420;
    g.strokeRect(x, y, 34 + rnd() * 26, 22 + rnd() * 16);
  }
  // Rivet dots along the chordwise lines.
  g.fillStyle = 'rgba(64,72,82,0.45)';
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
  grad.addColorStop(0, '#A8B0B8');
  grad.addColorStop(0.5, '#98A0A9');
  grad.addColorStop(1, '#8A929B');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  let seed = 7777;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  // Distinct panel shades (fadli-15c: the fin is a patchwork of greys).
  const shades = ['#B4BCC4', '#8A929B', '#767E87', '#A2ABB3'];
  for (let i = 0; i < 6; i++) {
    const x = rnd() * 190, y = rnd() * 190, w = 40 + rnd() * 90, h = 30 + rnd() * 70;
    g.fillStyle = shades[i % shades.length];
    g.globalAlpha = 0.30;
    g.fillRect(x, y, w, h);
    g.globalAlpha = 1;
    g.strokeStyle = 'rgba(48,56,66,0.7)';
    g.lineWidth = 2;
    g.strokeRect(x, y, w, h);
  }
  // Horizontal panel lines (chordwise stations on the fin).
  g.strokeStyle = 'rgba(48,56,66,0.9)';
  g.lineWidth = 3;
  for (const y of [32, 80, 128, 176, 224]) {
    g.beginPath(); g.moveTo(8, y); g.lineTo(248, y); g.stroke();
  }
  // Two diagonal seams following the fin's sweep.
  g.strokeStyle = 'rgba(64,72,82,0.5)';
  g.lineWidth = 2;
  g.beginPath(); g.moveTo(20, 240); g.lineTo(150, 20); g.stroke();
  g.beginPath(); g.moveTo(90, 240); g.lineTo(220, 30); g.stroke();
  // Rivets along the horizontal lines.
  g.fillStyle = 'rgba(64,72,82,0.5)';
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
  g.fillStyle = '#6E767F';
  g.fillRect(0, 0, 256, 64);
  g.strokeStyle = 'rgba(40,48,58,0.8)';
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

// Extruded flat panel: planform in (span, chord) with a rounded tip,
// extruded thin with a bevel so no edge is a hard box corner. Returns a
// mesh lying flat (span along X, chord along Z, thickness along Y).
function wingPanel(mat, x0, x1, chordRoot, chordTip, thickness = 0.14) {
  const shape = new THREE.Shape();
  const c0 = chordRoot / 2, c1 = chordTip / 2;
  shape.moveTo(x0, -c0);
  shape.lineTo(x1 - 0.35, -c1 - 0.06);
  shape.quadraticCurveTo(x1, -c1, x1, 0);
  shape.quadraticCurveTo(x1, c1, x1 - 0.35, c1 + 0.06);
  shape.lineTo(x0, c0);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness, bevelEnabled: true, bevelThickness: 0.08,
    bevelSize: 0.08, bevelSegments: 4, curveSegments: 16,
  });
  geo.rotateX(Math.PI / 2); // chord -> Z, thickness -> Y
  geo.translate(0, thickness / 2 + 0.05, 0);
  // Airfoil camber: crown the upper skin so the wing reads as a curved
  // aerofoil from behind, not a flat plate (ref 02).
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const s = Math.max(0, Math.min(1, (Math.abs(x) - x0) / Math.max(0.01, x1 - x0)));
    const half = (chordRoot + (chordTip - chordRoot) * s) / 2;
    const u = Math.max(-1, Math.min(1, z / Math.max(0.01, half)));
    pos.setY(i, pos.getY(i) + 0.16 * Math.max(0, 1 - u * u)); // v15: stronger crown — the v14 wing read as a flat board on the bank
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}

// Volumetric fuselage loft: a chined body built from cross-section rings
// along Z, nose (+Z) to tail (-Z). Each ring is an 8-point chined
// section — sharp upper chine, wide mid-body, keeled belly — so the
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
    bevelSegments: 3, curveSegments: 12,
  });
  geo.translate(0, 0, -len / 2);
  return geo;
}

function fuselageGeometry(stations) {
  // Ring points [xFactor, yFactor]: yFactor >= 0 scales by hTop, else by hBot.
  const RING = [
    [0, 1], [0.62, 0.78], [1, 0.05], [0.72, -0.55],
    [0, -1], [-0.72, -0.55], [-1, 0.05], [-0.62, 0.78],
  ];
  const nS = stations.length, nR = RING.length;
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let i = 0; i < nS; i++) {
    const st = stations[i];
    for (let j = 0; j < nR; j++) {
      const [fx, fy] = RING[j];
      const x = fx * st.w;
      const y = st.y + (fy >= 0 ? fy * st.ht : fy * st.hb);
      positions.push(x, y, st.z);
      uvs.push(j / nR, i / (nS - 1));
    }
  }
  for (let i = 0; i < nS - 1; i++) {
    for (let j = 0; j < nR; j++) {
      const j2 = (j + 1) % nR;
      const a = i * nR + j, b = i * nR + j2;
      const c = (i + 1) * nR + j, d = (i + 1) * nR + j2;
      indices.push(a, b, c, b, d, c);
    }
  }
  // Tail cap fan (faces -Z, the rear of the jet).
  const tailC = positions.length / 3;
  const last = stations[nS - 1];
  positions.push(0, last.y, last.z);
  uvs.push(0.5, 1);
  for (let j = 0; j < nR; j++) {
    const j2 = (j + 1) % nR;
    indices.push((nS - 1) * nR + j, (nS - 1) * nR + j2, tailC);
  }
  const geo = new THREE.BufferGeometry();
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
  grad.addColorStop(0, '#969EA7');
  grad.addColorStop(0.5, '#868E97');
  grad.addColorStop(1, '#767E87');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 512);
  let seed = 9917;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  // Panel shade patches (tile-friendly: drawn inside the tile).
  const shades = ['#9AA2AB', '#7A828C', '#6A727C', '#A8B0B8'];
  for (let i = 0; i < 8; i++) {
    const x = rnd() * 400, y = rnd() * 400, w = 60 + rnd() * 90, h = 50 + rnd() * 80;
    g.fillStyle = shades[i % shades.length];
    g.globalAlpha = 0.20;
    g.fillRect(x, y, w, h);
    g.globalAlpha = 1;
    g.strokeStyle = 'rgba(48,56,66,0.55)';
    g.lineWidth = 2;
    g.strokeRect(x, y, w, h);
  }
  for (let i = 0; i < 14; i++) {
    const x = rnd() * 512, y = rnd() * 512, r = 30 + rnd() * 70;
    const bg = g.createRadialGradient(x, y, 0, x, y, r);
    bg.addColorStop(0, rnd() > 0.5 ? 'rgba(96,104,114,0.18)' : 'rgba(165,173,183,0.14)');
    bg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = bg;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  // Panel grid: chordwise + spanwise seams, every 128 px (tiles cleanly).
  g.strokeStyle = 'rgba(48,56,66,0.55)';
  g.lineWidth = 2.5;
  for (const y of [128, 256, 384]) {
    g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke();
  }
  for (const x of [128, 256, 384]) {
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke();
  }
  // Flap / aileron hinge line + trailing-edge strip.
  g.strokeStyle = 'rgba(40,48,58,0.7)';
  g.lineWidth = 3;
  g.beginPath(); g.moveTo(0, 440); g.lineTo(512, 440); g.stroke();
  g.strokeStyle = 'rgba(64,72,82,0.4)';
  g.lineWidth = 2;
  g.beginPath(); g.moveTo(0, 470); g.lineTo(512, 470); g.stroke();
  // Two soft diagonal seams for the panel feel, low alpha.
  g.strokeStyle = 'rgba(64,72,82,0.35)';
  g.beginPath(); g.moveTo(40, 480); g.lineTo(300, 40); g.stroke();
  g.beginPath(); g.moveTo(220, 480); g.lineTo(480, 60); g.stroke();
  // Access panels.
  g.strokeStyle = 'rgba(54,62,72,0.5)';
  g.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const x = 30 + rnd() * 420, y = 30 + rnd() * 380;
    g.strokeRect(x, y, 36 + rnd() * 24, 24 + rnd() * 14);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function buildAircraft() {
  const group = new THREE.Group();
  group.name = 'aircraft';

  // v15 materials: LIGHTER than v14 across the board — the v14 jet read
  // as a dark silhouette from the chase camera because the shadow side
  // had only the hemisphere light. The base greys are a stop lighter,
  // metalness is lower (metal goes near-black in shadow with no env map),
  // and a warm chase-fill light (below) lifts the rear faces — the jet
  // must read LIGHT GREY from behind, like fadli-15b.
  const stealth = new THREE.MeshStandardMaterial({ color: 0x6E767F, metalness: 0.20, roughness: 0.62 });
  const stealthTop = new THREE.MeshStandardMaterial({ map: panelTexture(), color: 0xBCC4CC, metalness: 0.15, roughness: 0.72 });
  // Wing skin: the detailed texture above — panel grid + hinge line.
  const wingTop = new THREE.MeshStandardMaterial({ map: wingTexture(), color: 0xA8B0BA, metalness: 0.15, roughness: 0.72 });
  // Fin skin: light grey with its own panel texture — fin and body are
  // ONE aircraft (fadli-15b), never a dark board on a grey body.
  const finTex = finTexture();
  const finMat = new THREE.MeshStandardMaterial({ map: finTex, color: 0xC8CDD4, metalness: 0.12, roughness: 0.72 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x4A5058, metalness: 0.5, roughness: 0.5 });
  const nozzleMat = new THREE.MeshStandardMaterial({ color: 0x3A3E44, metalness: 0.85, roughness: 0.35 });
  const emberRectTex = emberRectTexture();
  const lerxDecalTex = lerxDecalTexture();
  // Canopy glass: v15 brighter gold (fadli-15c — the canopy is a big
  // bright gold bubble, not a dim dot): stronger emissive so it glows
  // warm even from the shadow side.
  const glass = new THREE.MeshStandardMaterial({
    color: 0xD9A83C, metalness: 0.65, roughness: 0.22,
    emissive: 0x8A5A10, emissiveIntensity: 0.6,
  });
  const tyre = new THREE.MeshStandardMaterial({ color: 0x1E1E1E, roughness: 0.95 });
  const hubMat = new THREE.MeshStandardMaterial({ color: 0xB0BEC5, metalness: 0.8, roughness: 0.3 });

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
    { z: 6.6, y: 0.00, w: 0.02, ht: 0.02, hb: 0.02 }, // nose tip
    { z: 6.1, y: 0.01, w: 0.14, ht: 0.12, hb: 0.10 },
    { z: 5.3, y: 0.03, w: 0.32, ht: 0.26, hb: 0.22 },
    { z: 4.3, y: 0.05, w: 0.55, ht: 0.40, hb: 0.32 },
    { z: 3.1, y: 0.06, w: 0.78, ht: 0.46, hb: 0.36 },
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
  const fuselageMat = new THREE.MeshStandardMaterial({ map: fuseTex, color: 0xBCC4CC, metalness: 0.15, roughness: 0.72 });
  const fuselage = new THREE.Mesh(fuselageGeometry(interpStations(FUSELAGE_STATIONS)), fuselageMat);
  fuselage.name = 'fuselage';
  group.add(fuselage);

  // Dorsal spine: a low raised fairing along the fuselage top from the
  // canopy to the tail — the centreline volume that reads from behind.
  const spine = new THREE.Mesh(roundedDuctGeometry(0.42, 0.26, 5.0, 0.12), stealthTop);
  spine.position.set(0, 0.58, -1.6); // v15: body top is lower (flatter body), spine follows it down
  group.add(spine);

  // Main delta wings: separate panels, low-mounted on the fuselage
  // (y -0.18, below the body centreline), slight anhedral, blended into
  // the fuselage sides. TRUE proportions: root chord 3.7 m on a 12.6 m
  // body (ratio 0.29, like the real jet) and span 9.0 m — the v13 wing
  // root chord was 6.0 m on a 10.4 m body (ratio 0.58), which is why the
  // jet was mostly wing. The wing is one part — the body is the other.
  for (const side of [-1, 1]) {
    const wing = wingPanel(wingTop, 0.45, 4.52, 3.7, 0.8, 0.30); // v15: thicker (0.30) — the edge reads as a real wing, not a plate
    wing.position.set(0, -0.18, -0.9);
    wing.rotation.z = -0.05; // slight anhedral
    if (side < 0) wing.rotation.y = Math.PI;
    wing.name = 'wing';
    group.add(wing);
    // LERX: the forward strake from the wing root to the cockpit, a
    // raised plate on the wing's leading edge — the F-22's chined
    // forebody extension, visible on the banking shot.
    const lerx = wingPanel(wingTop, 0.4, 1.9, 2.4, 0.8, 0.16);
    lerx.position.set(0, 0.02, 2.4);
    lerx.rotation.z = -0.05;
    if (side < 0) lerx.rotation.y = Math.PI;
    lerx.name = 'lerx';
    group.add(lerx);
    // Tail number on the LERX top, readable on the banking shot.
    const lerxDec = new THREE.Mesh(
      new THREE.PlaneGeometry(0.8, 0.4),
      new THREE.MeshBasicMaterial({ map: lerxDecalTex, transparent: true }),
    );
    lerxDec.userData.noShadow = true;
    lerxDec.rotation.x = -Math.PI / 2;
    lerxDec.position.set(side * 1.1, 0.36, 2.9);
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
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), glass);
  canopy.scale.set(0.38, 0.32, 1.35);
  canopy.position.set(0, 0.62, 2.7);
  canopy.name = 'canopy';
  group.add(canopy);
  // Canopy frame: a dark flattened ring the gold bubble sits in, so the
  // canopy reads as a framed cockpit, not a ball on the fuselage.
  const coaming = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.08, 10, 32), dark);
  coaming.rotation.x = Math.PI / 2;
  coaming.scale.set(0.56, 2.0, 0.5);
  coaming.position.set(0, 0.60, 2.7);
  group.add(coaming);
  // Frame bow across the canopy middle: the hoop the real canopy's
  // frame makes, so the bubble reads as a framed cockpit from the side.
  const frameBow = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.035, 8, 24), dark);
  frameBow.scale.set(1.12, 0.95, 1);
  frameBow.position.set(0, 0.62, 2.7);
  group.add(frameBow);

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
  const finShape = new THREE.Shape();
  finShape.moveTo(-0.75, 0);
  finShape.lineTo(0.75, 0);
  finShape.lineTo(0.48, 1.45);
  finShape.lineTo(0.12, 2.1);
  finShape.lineTo(-0.22, 1.75);
  finShape.lineTo(-0.6, 0.55);
  finShape.closePath();
  const finGeo = new THREE.ExtrudeGeometry(finShape, {
    depth: 0.12, bevelEnabled: true, bevelThickness: 0.05,
    bevelSize: 0.05, bevelSegments: 4, curveSegments: 12,
  });
  finGeo.rotateY(-Math.PI / 2); // chord -> Z, leading edge toward the nose
  finGeo.translate(-0.06, 0, 0); // centre the thickness on the local origin
  const decalTex = raptorDecalTexture();
  for (const side of [-1, 1]) {
    const tail = new THREE.Group();
    tail.position.set(side * 0.62, 0.30, -4.3);
    tail.rotation.z = -side * 0.5; // cant outward ~28 deg
    const fin = new THREE.Mesh(finGeo, finMat);
    tail.add(fin);
    // "RAPTOR" + tail number on the outer face of the fin.
    const decal = new THREE.Mesh(
      new THREE.PlaneGeometry(1.0, 0.19),
      new THREE.MeshBasicMaterial({ map: decalTex, transparent: true, side: THREE.DoubleSide }),
    );
    decal.userData.noShadow = true;
    decal.position.set(side * 0.13, 1.1, 0);
    decal.rotation.y = side * Math.PI / 2;
    tail.add(decal);
    group.add(tail);
  }

  // Stabilators: small all-moving tails, slight anhedral, on the tail.
  for (const side of [-1, 1]) {
    const stab = wingPanel(wingTop, 0.1, 2.0, 1.2, 0.65, 0.10);
    stab.position.set(0, -0.05, -5.0);
    stab.rotation.z = -0.07;
    if (side < 0) stab.rotation.y = Math.PI;
    group.add(stab);
  }

  // Caret intakes: slim rounded ducts on the fuselage sides, with dark
  // forward mouths and a ramp lip above — visible from behind as rounded
  // forms flanking the body and from the side as the F-22's intakes.
  // Rounded-rect extrude with a bevel, so every edge is soft — NO BOXES.
  const mouthMat = new THREE.MeshBasicMaterial({ color: 0x0A0C0E });
  const intakeDecalTex = intakeDecalTexture();
  for (const side of [-1, 1]) {
    // v15: intakes move outboard (x ±1.02) — the body is wider now, so
    // the old ±0.82 ducts would be buried inside the fuselage.
    const duct = new THREE.Mesh(roundedDuctGeometry(0.5, 0.85, 2.0, 0.22), dark);
    duct.position.set(side * 1.02, -0.08, 1.7);
    duct.name = 'intake';
    group.add(duct);
    const mouth = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.75), mouthMat);
    mouth.userData.noShadow = true;
    mouth.position.set(side * 1.02, -0.08, 2.71);
    group.add(mouth);
    // Ramp lip: a flattened half-cylinder, rounded, not a slab.
    const lip = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.4, 16), stealth);
    lip.rotation.x = Math.PI / 2 - 0.25; // axis along Z, tilted like a ramp
    lip.scale.set(1, 1, 0.35);
    lip.position.set(side * 1.02, 0.42, 2.5);
    group.add(lip);
    // Tail number + DANGER stripe on the intake's flat outer face.
    const dec = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 0.34),
      new THREE.MeshBasicMaterial({ map: intakeDecalTex, transparent: false }),
    );
    dec.userData.noShadow = true;
    dec.position.set(side * 1.28, -0.08, 1.7);
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
  for (const side of [-1, 1]) {
    const nozzle = new THREE.Mesh(roundedDuctGeometry(0.52, 0.36, 0.8, 0.12), nozzleMat);
    nozzle.position.set(side * 0.32, -0.02, -5.85);
    group.add(nozzle);
    // Flared petal frame at the nozzle exit: a flat rectangular ring,
    // metallic, with the ember rectangle set inside it.
    const frameShape = roundedRectShape(0.56, 0.40, 0.13);
    frameShape.holes.push(new THREE.Path(roundedRectShape(0.44, 0.28, 0.09).getPoints(12)));
    const frameGeo = new THREE.ExtrudeGeometry(frameShape, {
      depth: 0.1, bevelEnabled: false, curveSegments: 8,
    });
    const frame = new THREE.Mesh(frameGeo, new THREE.MeshStandardMaterial({ color: 0x8A8F96, metalness: 0.9, roughness: 0.3 }));
    frame.position.set(side * 0.32, -0.02, -6.30);
    group.add(frame);
    const ember = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.26), emberRectMat);
    ember.rotation.y = Math.PI; // face backward
    ember.position.set(side * 0.32, -0.02, -6.29);
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
  const chaseFill = new THREE.PointLight(0xFFC08A, 55, 45, 1.5);
  chaseFill.position.set(0, -1.5, -10);
  group.add(chaseFill);
  for (const side of [-1, 1]) {
    const fg = new THREE.Group();
    fg.position.set(side * 0.32, -0.02, -6.3);
    fg.add(flameCone(0xFF7A18, 0.20, 1.1, 0.30)); // v15b: shorter — the 1.8 m cones read as giant fangs from behind
    fg.add(flameCone(0xFFD75E, 0.12, 1.0, 0.6));
    fg.add(flameCone(0x66CCFF, 0.06, 0.55, 0.6));
    fg.add(flameCone(0xFFF6D8, 0.04, 0.4, 0.8)); // white-hot core
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
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.1, 8), dark);
    rail.rotation.x = Math.PI / 2;
    rail.position.set(side * 4.48, -0.14, -0.9);
    group.add(rail);
  }

  // Landing gear: nose + two mains, raked legs, real tyres with hubs.
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.0, 8), dark);
    leg.position.set(side * 1.15, -0.85, -0.8);
    leg.rotation.z = side * 0.25;
    group.add(leg);
    const wheel = new THREE.Group();
    wheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.30, 0.11, 10, 18), tyre));
    const hubDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.28, 14), hubMat);
    hubDisc.rotation.x = Math.PI / 2;
    wheel.add(hubDisc);
    wheel.position.set(side * 1.28, -1.25, -0.8);
    group.add(wheel);
  }
  const noseLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 8), dark);
  noseLeg.position.set(0, -0.78, 3.8);
  group.add(noseLeg);
  const noseWheel = new THREE.Group();
  noseWheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.08, 10, 16), tyre));
  noseWheel.position.set(0, -1.15, 3.8);
  group.add(noseWheel);

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
  const lights = [
    [0xFF2222, -4.48, -0.1, -0.9],
    [0x22FF66, 4.48, -0.1, -0.9],
    [0xFFFFFF, 0, 0.3, -6.0],
  ];
  for (const [col, x, y, z] of lights) {
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 10, 8),
      new THREE.MeshBasicMaterial({ color: col }),
    );
    lamp.position.set(x, y, z);
    group.add(lamp);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: col, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glow.scale.setScalar(0.8);
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
        emberRectMat.color.setHex(0x8A6A55); // dimmed hot core at idle
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
