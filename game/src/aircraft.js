// aircraft.js — the F-22 RAPTOR, rebuilt from scratch (v14) to the real
// jet's proportions. The v13 jet went wrong in the other direction:
// fat body, giant slab tails, headlight nozzles — it read as a chunky
// toy, not a Raptor. This one is measured off the real F-22 (ref 02/01):
// length 18.9 m, span 13.56 m — LONG and SLEEK, body narrow, tails tall
// but SLIM, nozzles modest. Model scale 12.6 m long, 9.0 m span, body
// 1.34 m wide: length/span 1.40, like the real jet (1.39). Nose toward
// +Z. From the chase camera the silhouette reads at once: long diamond
// body, gold bubble canopy, blended delta, slim canted tails, two small
// nozzles — a Raptor, not a toy.

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
  grad.addColorStop(0, '#7C848E');
  grad.addColorStop(0.5, '#6E767F');
  grad.addColorStop(1, '#5F6771');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 512);
  // Weathering blotches + large soft two-tone patches: the patchwork
  // skin of the real Raptor in ref 02.
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
  // Panel lines: chordwise stations + spanwise seams — thin and soft.
  g.strokeStyle = 'rgba(48,56,66,0.8)';
  g.lineWidth = 2.5;
  for (const y of [48, 120, 200, 280, 360, 440]) {
    g.beginPath(); g.moveTo(20, y); g.lineTo(492, y); g.stroke();
  }
  for (const x of [64, 128, 192, 256, 320, 384, 448]) {
    g.beginPath(); g.moveTo(x, 24); g.lineTo(x, 488); g.stroke();
  }
  // Finer secondary seams.
  g.strokeStyle = 'rgba(64,72,82,0.35)';
  g.lineWidth = 1.5;
  for (const y of [84, 160, 240, 320, 400]) {
    g.beginPath(); g.moveTo(20, y); g.lineTo(492, y); g.stroke();
  }
  for (const x of [96, 160, 224, 288, 352, 416]) {
    g.beginPath(); g.moveTo(x, 24); g.lineTo(x, 488); g.stroke();
  }
  // Diagonal leading-edge seams.
  g.beginPath(); g.moveTo(20, 470); g.lineTo(256, 300); g.lineTo(492, 470); g.stroke();
  g.beginPath(); g.moveTo(60, 60); g.lineTo(256, 210); g.lineTo(452, 60); g.stroke();
  // Access panels: small stroked rectangles scattered on the skin.
  g.strokeStyle = 'rgba(54,62,72,0.45)';
  g.lineWidth = 2;
  for (let i = 0; i < 16; i++) {
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

// Nozzle interior (ref 01): white-hot core fading through yellow and
// orange to a dark rim — the layered look of a real burner nozzle.
function emberTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, '#FFFBEA');
  grad.addColorStop(0.28, '#FFD75E');
  grad.addColorStop(0.58, '#FF7A18');
  grad.addColorStop(0.82, '#8A2A00');
  grad.addColorStop(1, '#1A0A00');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
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
    pos.setY(i, pos.getY(i) + 0.10 * Math.max(0, 1 - u * u));
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
function flameCone(color, radius, length, opacity) {
  const geo = new THREE.ConeGeometry(radius, length, 12, 1, true);
  geo.rotateX(-Math.PI / 2); // cone tip (+Y) -> -Z, backward
  const mat = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.noShadow = true;
  mesh.position.z = -length / 2;
  return mesh;
}

// Wing skin texture: deliberately SUBTLE and now DARKER, like the top
// skin — the v13 wing washed out with the top skin on the banking shot.
// Flat surfaces amplify any regular grid, so the wings get only a soft
// gradient, a few faint chordwise seams and weathering — no spanwise
// lines, no rivets, no access panels. The rich grid stays ONLY on the
// round fuselage, where it reads as panel detail (ref 02), not boxes.
function wingTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0, '#8E969F');
  grad.addColorStop(0.5, '#7E868F');
  grad.addColorStop(1, '#6E767F');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 512);
  let seed = 9917;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 14; i++) {
    const x = rnd() * 512, y = rnd() * 512, r = 30 + rnd() * 70;
    const bg = g.createRadialGradient(x, y, 0, x, y, r);
    bg.addColorStop(0, rnd() > 0.5 ? 'rgba(96,104,114,0.18)' : 'rgba(165,173,183,0.14)');
    bg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = bg;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  // Three faint chordwise seams only — the wing is one smooth skin.
  g.strokeStyle = 'rgba(64,72,82,0.32)';
  g.lineWidth = 2;
  for (const y of [140, 260, 380]) {
    g.beginPath(); g.moveTo(20, y); g.lineTo(492, y); g.stroke();
  }
  // Two soft diagonal seams for the panel feel, low alpha.
  g.strokeStyle = 'rgba(64,72,82,0.28)';
  g.beginPath(); g.moveTo(40, 480); g.lineTo(300, 40); g.stroke();
  g.beginPath(); g.moveTo(220, 480); g.lineTo(480, 60); g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function buildAircraft() {
  const group = new THREE.Group();
  group.name = 'aircraft';

  // v14 materials: DARKER and ROUGHER than v13 across the board — the
  // v13 washout was the pale skin (colour 0xBFC9D4, metalness 0.30,
  // roughness 0.55) under sun 2.4 + warm fill. Now the multiply colour
  // is mid-grey, metalness is low and roughness is high, so the grey
  // survives the sunset instead of blowing out to white-gold (ref 02).
  const stealth = new THREE.MeshStandardMaterial({ color: 0x565E66, metalness: 0.30, roughness: 0.60 });
  const stealthTop = new THREE.MeshStandardMaterial({ map: panelTexture(), color: 0xA8B0BA, metalness: 0.15, roughness: 0.72 });
  // Wing skin: the subtle texture above — no grid on the flat wings.
  const wingTop = new THREE.MeshStandardMaterial({ map: wingTexture(), color: 0xA8B0BA, metalness: 0.15, roughness: 0.72 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x3A4048, metalness: 0.6, roughness: 0.45 });
  const nozzleMat = new THREE.MeshStandardMaterial({ color: 0x2A2E33, metalness: 0.85, roughness: 0.35 });
  const nozzleRingMat = new THREE.MeshStandardMaterial({ color: 0x9AA0A8, metalness: 0.9, roughness: 0.3 });
  const emberTex = emberTexture();
  // Canopy glass: less mirror than v13 (metalness 0.95 -> 0.70,
  // roughness 0.08 -> 0.25) so it stays gold instead of flashing white
  // when the sun hits it on the banking shot.
  const glass = new THREE.MeshStandardMaterial({
    color: 0xC9962E, metalness: 0.70, roughness: 0.25,
    emissive: 0x7A4A10, emissiveIntensity: 0.35,
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
  const FUSELAGE_STATIONS = [
    { z: 6.6, y: 0.00, w: 0.02, ht: 0.02, hb: 0.02 }, // nose tip
    { z: 6.1, y: 0.01, w: 0.14, ht: 0.12, hb: 0.10 },
    { z: 5.3, y: 0.03, w: 0.30, ht: 0.26, hb: 0.22 },
    { z: 4.3, y: 0.05, w: 0.48, ht: 0.42, hb: 0.34 },
    { z: 3.1, y: 0.06, w: 0.62, ht: 0.52, hb: 0.42 },
    { z: 1.9, y: 0.04, w: 0.67, ht: 0.55, hb: 0.45 },
    { z: 0.5, y: 0.02, w: 0.67, ht: 0.55, hb: 0.45 },
    { z: -1.1, y: 0.02, w: 0.64, ht: 0.50, hb: 0.42 },
    { z: -2.7, y: 0.00, w: 0.58, ht: 0.44, hb: 0.36 },
    { z: -4.3, y: -0.02, w: 0.52, ht: 0.36, hb: 0.30 },
    { z: -5.3, y: -0.03, w: 0.47, ht: 0.30, hb: 0.26 },
    { z: -6.0, y: -0.03, w: 0.44, ht: 0.27, hb: 0.24 }, // tail face
  ];
  // The fuselage gets its own panel-texture instance: the loft's UVs run
  // u = around the ring, v = along the body, so repeat (1,1) puts the
  // panel stations along the fuselage and the seams around it.
  const fuseTex = panelTexture();
  fuseTex.repeat.set(1, 1);
  fuseTex.offset.set(0, 0);
  const fuselageMat = new THREE.MeshStandardMaterial({ map: fuseTex, color: 0xA8B0BA, metalness: 0.15, roughness: 0.72 });
  const fuselage = new THREE.Mesh(fuselageGeometry(interpStations(FUSELAGE_STATIONS)), fuselageMat);
  fuselage.name = 'fuselage';
  group.add(fuselage);

  // Dorsal spine: a low raised fairing along the fuselage top from the
  // canopy to the tail — the centreline volume that reads from behind.
  const spine = new THREE.Mesh(roundedDuctGeometry(0.42, 0.26, 5.0, 0.12), stealthTop);
  spine.position.set(0, 0.62, -1.6);
  group.add(spine);

  // Main delta wings: separate panels, low-mounted on the fuselage
  // (y -0.18, below the body centreline), slight anhedral, blended into
  // the fuselage sides. TRUE proportions: root chord 3.7 m on a 12.6 m
  // body (ratio 0.29, like the real jet) and span 9.0 m — the v13 wing
  // root chord was 6.0 m on a 10.4 m body (ratio 0.58), which is why the
  // jet was mostly wing. The wing is one part — the body is the other.
  for (const side of [-1, 1]) {
    const wing = wingPanel(wingTop, 0.45, 4.52, 3.7, 0.8, 0.22);
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
  }

  // Canopy: a LONG gold bubble FLUSH with the fuselage top, from ahead
  // of the wing to the nose — not a ball perched on a flat plate. Sized
  // to the real jet (2.3 m long, 0.6 m wide) and raised so it reads
  // clearly from behind as a gold bubble on the spine — the v13 canopy
  // was a tiny gold dot from the chase camera.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), glass);
  canopy.scale.set(0.30, 0.23, 1.15);
  canopy.position.set(0, 0.58, 2.7);
  canopy.name = 'canopy';
  group.add(canopy);
  // Canopy frame: a dark flattened ring the gold bubble sits in, so the
  // canopy reads as a framed cockpit, not a ball on the fuselage.
  const coaming = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.07, 10, 32), dark);
  coaming.rotation.x = Math.PI / 2;
  coaming.scale.set(0.55, 1.9, 0.4);
  coaming.position.set(0, 0.62, 2.7);
  group.add(coaming);

  // Canted twin tails: tall but SLIM swept fins leaning out ~28 degrees,
  // the Raptor's signature. The v13 fins were 2.4 m chord slabs that
  // dominated the whole rear view like barn doors; these are 1.7 m at
  // the root tapering to 0.4 m at the tip and only 0.14 m thick — tall
  // blades, like ref 01.
  const finShape = new THREE.Shape();
  finShape.moveTo(-0.85, 0);
  finShape.lineTo(0.85, 0);
  finShape.lineTo(0.55, 1.6);
  finShape.lineTo(0.15, 2.3);
  finShape.lineTo(-0.25, 1.9);
  finShape.lineTo(-0.7, 0.6);
  finShape.closePath();
  const finGeo = new THREE.ExtrudeGeometry(finShape, {
    depth: 0.14, bevelEnabled: true, bevelThickness: 0.05,
    bevelSize: 0.05, bevelSegments: 4, curveSegments: 12,
  });
  finGeo.rotateY(-Math.PI / 2); // chord -> Z, leading edge toward the nose
  finGeo.translate(-0.07, 0, 0); // centre the thickness on the local origin
  const decalTex = raptorDecalTexture();
  for (const side of [-1, 1]) {
    const tail = new THREE.Group();
    tail.position.set(side * 0.62, 0.30, -4.3);
    tail.rotation.z = -side * 0.5; // cant outward ~28 deg
    const fin = new THREE.Mesh(finGeo, stealth);
    tail.add(fin);
    // "RAPTOR" + tail number on the outer face of the fin.
    const decal = new THREE.Mesh(
      new THREE.PlaneGeometry(1.0, 0.19),
      new THREE.MeshBasicMaterial({ map: decalTex, transparent: true, side: THREE.DoubleSide }),
    );
    decal.userData.noShadow = true;
    decal.position.set(side * 0.16, 1.2, 0);
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
  for (const side of [-1, 1]) {
    const duct = new THREE.Mesh(roundedDuctGeometry(0.5, 0.85, 2.0, 0.22), dark);
    duct.position.set(side * 0.82, -0.08, 1.7);
    duct.name = 'intake';
    group.add(duct);
    const mouth = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.75), mouthMat);
    mouth.userData.noShadow = true;
    mouth.position.set(side * 0.82, -0.08, 2.71);
    group.add(mouth);
    // Ramp lip: a flattened half-cylinder, rounded, not a slab.
    const lip = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.4, 16), stealth);
    lip.rotation.x = Math.PI / 2 - 0.25; // axis along Z, tilted like a ramp
    lip.scale.set(1, 1, 0.35);
    lip.position.set(side * 0.82, 0.42, 2.5);
    group.add(lip);
  }

  // Twin nozzles at the tail face: SMALL and modest, like ref 01 — the
  // v13 nozzles were 1.0 m discs on a 1.56 m tail face, so they read as
  // two giant headlights. These are 0.6 m across on a 0.88 m tail face,
  // each with a flared petal ring (ref 01) and a layered hot core disc
  // inside that brightens with the afterburner.
  const emberMat = new THREE.MeshBasicMaterial({ map: emberTex });
  const embers = [];
  for (const side of [-1, 1]) {
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.34, 0.8, 24), nozzleMat);
    nozzle.rotation.x = Math.PI / 2; // axis along Z
    nozzle.scale.set(1, 1, 0.72); // slightly flattened oval
    nozzle.position.set(side * 0.34, -0.02, -5.85);
    group.add(nozzle);
    // Flared petal ring at the nozzle exit: a short open cone, metallic.
    const petal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.30, 0.26, 24, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x6E7278, metalness: 0.9, roughness: 0.3, side: THREE.DoubleSide }),
    );
    petal.rotation.x = Math.PI / 2;
    petal.position.set(side * 0.34, -0.02, -6.26);
    group.add(petal);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.06, 12, 24), nozzleRingMat);
    ring.position.set(side * 0.34, -0.02, -6.24);
    group.add(ring);
    const ember = new THREE.Mesh(new THREE.CircleGeometry(0.25, 24), emberMat);
    ember.rotation.y = Math.PI; // face backward
    ember.position.set(side * 0.34, -0.02, -6.25);
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
  const glowTex = glowTexture();
  const flames = [];
  const abLight = new THREE.PointLight(0xFF8033, 0, 60, 1.5);
  abLight.position.set(0, 0, -7);
  group.add(abLight);
  for (const side of [-1, 1]) {
    const fg = new THREE.Group();
    fg.position.set(side * 0.34, -0.02, -6.3);
    fg.add(flameCone(0xFF7A18, 0.20, 1.8, 0.42));
    fg.add(flameCone(0xFFD75E, 0.12, 1.3, 0.7));
    fg.add(flameCone(0x66CCFF, 0.06, 0.7, 0.6));
    fg.add(flameCone(0xFFF6D8, 0.04, 0.45, 0.8)); // white-hot core
    fg.scale.set(0.001, 0.001, 0.001);
    fg.visible = false;
    group.add(fg);
    flames.push(fg);
    // Nozzle glare sprite, always faintly on, bright with the burner.
    const glare = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xFF8033, transparent: true, opacity: 0.15,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glare.scale.setScalar(0.9);
    glare.position.set(side * 0.34, -0.02, -6.35);
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
        emberMat.color.setHex(0x8A6A55); // dimmed hot core at idle
        return;
      }
      const w = 0.4 + 0.6 * abLevel;
      for (let i = 0; i < 2; i++) {
        const fg = flames[i * 2];
        fg.visible = true;
        fg.scale.set(w, w, Math.max(0.02, abLevel));
        const glare = flames[i * 2 + 1];
        glare.visible = true;
        glare.material.opacity = 0.10 + 0.35 * abLevel;
        glare.scale.setScalar(0.9 + 0.5 * abLevel);
      }
      abLight.intensity = 30 * abLevel;
      emberMat.color.setHex(0xFFFFFF); // full gradient while burning
    },
  };
}
