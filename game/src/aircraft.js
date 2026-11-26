// aircraft.js — the F-22 RAPTOR, built to look built, nose toward +Z.
// One job: the visible jet model, its twin nozzles and the afterburner
// flames. The airframe is a VOLUMETRIC fuselage (a chined loft with a
// pointed nose, side intakes and a long bubble canopy) with a separate
// blended delta wing — the wing is ONE part of the jet, not the whole
// jet. From the chase camera the silhouette reads at once: tall body,
// nose, intakes, canopy, canted twin tails, two nozzles — a Raptor, not
// a flat triangle.

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

// Top-skin texture (ref 02): light silver-grey with BOLD dark panel
// lines, access panels, rivets and weathering blotches. The v8 lines
// were too thin to read on the banking shot — these are darker, thicker
// and more numerous, so the top skin reads as a built airframe from
// the chase camera instead of a blank pale slab.
function panelTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#9AA3AD');
  grad.addColorStop(0.5, '#8B939D');
  grad.addColorStop(1, '#7E868F');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 512);
  // Weathering blotches, darker and lighter grey — stronger than v8.
  // v10: more blotches (36) plus large soft two-tone patches, the
  // patchwork skin of the real Raptor in ref 02 — panels are not one
  // flat tone, they are a mosaic of slightly different greys.
  let seed = 4242;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 8; i++) {
    const x = rnd() * 512, y = rnd() * 512, w = 60 + rnd() * 130, h = 50 + rnd() * 110;
    g.fillStyle = rnd() > 0.5 ? 'rgba(148,158,170,0.16)' : 'rgba(118,128,140,0.16)';
    g.fillRect(x - w / 2, y - h / 2, w, h);
  }
  for (let i = 0; i < 36; i++) {
    const x = rnd() * 512, y = rnd() * 512, r = 20 + rnd() * 60;
    const bg = g.createRadialGradient(x, y, 0, x, y, r);
    const dark = rnd() > 0.45;
    bg.addColorStop(0, dark ? 'rgba(96,104,114,0.28)' : 'rgba(196,204,214,0.20)');
    bg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = bg;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  // Panel lines: chordwise stations + spanwise seams — thick and dark.
  g.strokeStyle = 'rgba(52,60,70,0.95)';
  g.lineWidth = 3.5;
  for (const y of [48, 120, 200, 280, 360, 440]) {
    g.beginPath(); g.moveTo(20, y); g.lineTo(492, y); g.stroke();
  }
  for (const x of [64, 128, 192, 256, 320, 384, 448]) {
    g.beginPath(); g.moveTo(x, 24); g.lineTo(x, 488); g.stroke();
  }
  // Finer secondary seams between the main stations — the dense
  // panel grid of ref 02, thin so it reads as detail, not clutter.
  g.strokeStyle = 'rgba(70,78,88,0.4)';
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
  g.strokeStyle = 'rgba(60,68,78,0.55)';
  g.lineWidth = 2;
  for (let i = 0; i < 16; i++) {
    const x = 30 + rnd() * 420, y = 30 + rnd() * 420;
    g.strokeRect(x, y, 34 + rnd() * 26, 22 + rnd() * 16);
  }
  // Rivet dots along the chordwise lines.
  g.fillStyle = 'rgba(70,78,88,0.5)';
  for (const y of [48, 120, 200, 280, 360, 440]) {
    for (let x = 30; x < 500; x += 12) { g.fillRect(x, y - 1, 2, 2); }
  }
  // Pale leading-edge strip.
  g.fillStyle = 'rgba(210,217,225,0.5)';
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
    depth: thickness, bevelEnabled: true, bevelThickness: 0.09,
    bevelSize: 0.09, bevelSegments: 4, curveSegments: 16,
  });
  geo.rotateX(Math.PI / 2); // chord -> Z, thickness -> Y
  geo.translate(0, thickness / 2 + 0.05, 0);
  return new THREE.Mesh(geo, mat);
}

// Volumetric fuselage loft (the v9 fix): a chined body built from
// cross-section rings along Z, nose (+Z) to tail (-Z). Each ring is an
// 8-point chined section — sharp upper chine, wide mid-body, keeled
// belly — so the fuselage has real height and width from every angle.
// The old body was a flat extruded diamond planform; from behind it was
// a thin triangle with no body at all. This one is a body first, with
// the delta wing attached to it, not the other way round.
// Smooth the loft lengthwise: insert interpolated midpoints between the
// hand-placed stations so the fuselage has 19 rings instead of 10 — the
// v9 body showed hard rings under the sunset light. More rings, same
// shape; computeVertexNormals then shades it as one smooth sculpted body
// (ref 02), not a stack of facets.
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
// read as smooth rounded forms — NEVER a box. The owner forbade anything
// boxy: a rounded-rect extrude with a bevel has soft edges all round.
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
    depth: len, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.07,
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

// Wing skin texture: deliberately SUBTLE. The v10 panel texture's
// dense grid reads as a dark checkerboard of rectangles on the flat
// wings — exactly the "kotak-kotak" look the owner forbade. Flat
// surfaces amplify any regular grid, so the wings get only a soft
// gradient, a few faint chordwise seams and weathering — no spanwise
// lines, no rivets, no access panels. The rich grid stays ONLY on the
// round fuselage, where it reads as panel detail (ref 02), not boxes.
function wingTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0, '#AEB6C0');
  grad.addColorStop(0.5, '#9AA2AD');
  grad.addColorStop(1, '#8B939E');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 512);
  let seed = 9917;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 14; i++) {
    const x = rnd() * 512, y = rnd() * 512, r = 30 + rnd() * 70;
    const bg = g.createRadialGradient(x, y, 0, x, y, r);
    bg.addColorStop(0, rnd() > 0.5 ? 'rgba(120,128,138,0.20)' : 'rgba(200,208,218,0.16)');
    bg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = bg;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  // Three faint chordwise seams only — the wing is one smooth skin.
  g.strokeStyle = 'rgba(70,78,88,0.35)';
  g.lineWidth = 2;
  for (const y of [140, 260, 380]) {
    g.beginPath(); g.moveTo(20, y); g.lineTo(492, y); g.stroke();
  }
  // Two soft diagonal seams for the panel feel, low alpha.
  g.strokeStyle = 'rgba(70,78,88,0.30)';
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

  // Ref 02/08: the real Raptor is LIGHT grey in the sun — bright top
  // skin with panel lines, mid-grey sides, darker belly, gold canopy.
  // v8 lighting is kept exactly (cool fill keeps the top grey, warm rim
  // lights the edges); only the geometry and the panel texture change.
  const stealth = new THREE.MeshStandardMaterial({ color: 0x6E7680, metalness: 0.45, roughness: 0.42 });
  const stealthTop = new THREE.MeshStandardMaterial({ map: panelTexture(), color: 0xC9D2DC, metalness: 0.30, roughness: 0.50 });
  // Wing skin: the subtle texture above — no grid on the flat wings.
  const wingTop = new THREE.MeshStandardMaterial({ map: wingTexture(), color: 0xD2D9E0, metalness: 0.30, roughness: 0.48 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x3A4048, metalness: 0.6, roughness: 0.45 });
  const nozzleMat = new THREE.MeshStandardMaterial({ color: 0x2A2E33, metalness: 0.85, roughness: 0.35 });
  const nozzleRingMat = new THREE.MeshStandardMaterial({ color: 0x9AA0A8, metalness: 0.9, roughness: 0.3 });
  const emberTex = emberTexture();
  const glass = new THREE.MeshStandardMaterial({
    color: 0xC9962E, metalness: 0.95, roughness: 0.12,
    emissive: 0x7A4A10, emissiveIntensity: 0.55,
  });
  const tyre = new THREE.MeshStandardMaterial({ color: 0x1E1E1E, roughness: 0.95 });
  const hubMat = new THREE.MeshStandardMaterial({ color: 0xB0BEC5, metalness: 0.8, roughness: 0.3 });

  // Fuselage: chined loft, nose toward +Z. Stations are {z, y, w, ht, hb}:
  // half-width, top height and belly depth at each station. The body is
  // ~10.4 m long, ~2.1 m wide and ~1.5 m tall at mid-body — from behind
  // it is a tall body between the wings, with the canopy rising above it.
  const FUSELAGE_STATIONS = [
    { z: 5.4, y: 0.00, w: 0.03, ht: 0.03, hb: 0.03 }, // nose tip
    { z: 4.8, y: 0.02, w: 0.22, ht: 0.20, hb: 0.18 },
    { z: 4.0, y: 0.05, w: 0.45, ht: 0.38, hb: 0.32 },
    { z: 3.0, y: 0.05, w: 0.68, ht: 0.58, hb: 0.48 },
    { z: 1.8, y: 0.02, w: 0.88, ht: 0.75, hb: 0.58 },
    { z: 0.5, y: 0.00, w: 1.05, ht: 0.85, hb: 0.65 },
    { z: -1.2, y: 0.00, w: 1.02, ht: 0.80, hb: 0.62 },
    { z: -2.8, y: -0.02, w: 0.92, ht: 0.66, hb: 0.52 },
    { z: -4.2, y: -0.05, w: 0.80, ht: 0.50, hb: 0.38 },
    { z: -5.0, y: -0.05, w: 0.72, ht: 0.42, hb: 0.32 }, // tail face
  ];
  // The fuselage gets its own panel-texture instance: the loft's UVs run
  // u = around the ring, v = along the body, so repeat (1,1) puts the
  // panel stations along the fuselage and the seams around it.
  const fuseTex = panelTexture();
  fuseTex.repeat.set(1, 1);
  fuseTex.offset.set(0, 0);
  const fuselageMat = new THREE.MeshStandardMaterial({ map: fuseTex, color: 0xC9D2DC, metalness: 0.30, roughness: 0.50 });
  const fuselage = new THREE.Mesh(fuselageGeometry(interpStations(FUSELAGE_STATIONS)), fuselageMat);
  fuselage.name = 'fuselage';
  group.add(fuselage);

  // Main delta wings: separate panels, low-mounted on the fuselage
  // (y -0.22, below the body centreline), slight anhedral, blended into
  // the fuselage sides. The wing is one part — the body is the other.
  for (const side of [-1, 1]) {
    const wing = wingPanel(wingTop, 0.55, 3.6, 6.0, 1.2, 0.26);
    wing.position.set(0, -0.22, -0.6);
    wing.rotation.z = -0.05; // slight anhedral
    if (side < 0) wing.rotation.y = Math.PI;
    wing.name = 'wing';
    group.add(wing);
    // LERX: the forward strake from the wing root to the cockpit, a
    // raised plate on the wing's leading edge — the F-22's chined
    // forebody extension, visible on the banking shot.
    const lerx = wingPanel(wingTop, 0.5, 2.2, 3.0, 1.0, 0.20);
    lerx.position.set(0, 0.02, 1.8);
    lerx.rotation.z = -0.05;
    if (side < 0) lerx.rotation.y = Math.PI;
    lerx.name = 'lerx';
    group.add(lerx);
  }

  // Canopy: a LONG gold bubble FLUSH with the fuselage top, from ahead
  // of the wing to the nose — not a ball perched on a flat plate. v10:
  // stretched longer and sunk lower so it flows into the forebody line
  // like the real Raptor's canopy in ref 02 (the v9 bubble sat proud
  // like a gold ball on top of the fuselage).
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), glass);
  canopy.scale.set(0.52, 0.36, 1.6);
  canopy.position.set(0, 0.74, 1.8);
  canopy.name = 'canopy';
  group.add(canopy);

  // Canted twin tails: tall swept fins leaning out ~28 degrees, the
  // Raptor's signature. Taller than v8 (2.15 m) so they read from behind.
  const finShape = new THREE.Shape();
  finShape.moveTo(-1.3, 0);
  finShape.lineTo(1.1, 0);
  finShape.lineTo(0.75, 1.5);
  finShape.lineTo(0.15, 2.15);
  finShape.lineTo(-0.65, 1.7);
  finShape.lineTo(-1.2, 0.7);
  finShape.closePath();
  const finGeo = new THREE.ExtrudeGeometry(finShape, {
    depth: 0.2, bevelEnabled: true, bevelThickness: 0.06,
    bevelSize: 0.06, bevelSegments: 4, curveSegments: 12,
  });
  finGeo.rotateY(-Math.PI / 2); // chord -> Z, leading edge toward the nose
  finGeo.translate(-0.07, 0, 0); // centre the thickness on the local origin
  const decalTex = raptorDecalTexture();
  for (const side of [-1, 1]) {
    const tail = new THREE.Group();
    tail.position.set(side * 0.85, 0.45, -3.4);
    tail.rotation.z = -side * 0.5; // cant outward ~28 deg
    const fin = new THREE.Mesh(finGeo, stealth);
    tail.add(fin);
    // "RAPTOR" + tail number on the outer face of the fin.
    const decal = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 0.28),
      new THREE.MeshBasicMaterial({ map: decalTex, transparent: true, side: THREE.DoubleSide }),
    );
    decal.userData.noShadow = true;
    decal.position.set(side * 0.12, 1.1, 0);
    decal.rotation.y = side * Math.PI / 2;
    tail.add(decal);
    group.add(tail);
  }

  // Stabilators: small all-moving tails, slight anhedral, on the tail.
  for (const side of [-1, 1]) {
    const stab = wingPanel(wingTop, 0.15, 2.5, 1.5, 0.9, 0.14);
    stab.position.set(0, -0.05, -4.15);
    stab.rotation.z = -0.07;
    if (side < 0) stab.rotation.y = Math.PI;
    group.add(stab);
  }

  // Caret intakes: BIG rounded ducts on the fuselage sides, with dark
  // forward mouths and a ramp lip above — visible from behind as rounded
  // forms flanking the body and from the side as the F-22's intakes.
  // v10: NO BOXES — the v9 duct was a literal BoxGeometry; this one is
  // a rounded-rect extrude with a bevel, so every edge is soft.
  const mouthMat = new THREE.MeshBasicMaterial({ color: 0x0A0C0E });
  for (const side of [-1, 1]) {
    const duct = new THREE.Mesh(roundedDuctGeometry(0.62, 1.0, 2.4, 0.22), dark);
    duct.position.set(side * 1.18, 0.02, 1.35);
    duct.name = 'intake';
    group.add(duct);
    const mouth = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.88), mouthMat);
    mouth.userData.noShadow = true;
    mouth.position.set(side * 1.18, 0.02, 2.56);
    group.add(mouth);
    // Ramp lip: a flattened half-cylinder, rounded, not a slab.
    const lip = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.5, 16), stealth);
    lip.rotation.x = Math.PI / 2 - 0.25; // axis along Z, tilted like a ramp
    lip.scale.set(1, 1, 0.35);
    lip.position.set(side * 1.18, 0.55, 2.35);
    group.add(lip);
  }

  // Twin nozzles at the tail face: rounded housings (v10: the v9 box
  // housings read as cubes from behind — these are flattened oval
  // cylinders), each with a flared petal ring (ref 01) and a layered
  // hot core disc inside that brightens with the afterburner. Spaced
  // to hug the narrow tail face.
  const emberMat = new THREE.MeshBasicMaterial({ map: emberTex });
  const embers = [];
  for (const side of [-1, 1]) {
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.9, 20), nozzleMat);
    nozzle.rotation.x = Math.PI / 2; // axis along Z
    nozzle.scale.set(1, 1, 0.72); // slightly flattened oval
    nozzle.position.set(side * 0.55, -0.05, -4.85);
    group.add(nozzle);
    // Flared petal ring at the nozzle exit: a short open cone, metallic.
    const petal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.29, 0.34, 0.28, 16, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x6E7278, metalness: 0.9, roughness: 0.3, side: THREE.DoubleSide }),
    );
    petal.rotation.x = Math.PI / 2;
    petal.position.set(side * 0.55, -0.05, -5.32);
    group.add(petal);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.075, 10, 20), nozzleRingMat);
    ring.position.set(side * 0.55, -0.05, -5.3);
    group.add(ring);
    const ember = new THREE.Mesh(new THREE.CircleGeometry(0.28, 20), emberMat);
    ember.rotation.y = Math.PI; // face backward
    ember.position.set(side * 0.55, -0.05, -5.31);
    ember.userData.noShadow = true;
    group.add(ember);
    embers.push(ember);
  }

  // Afterburner: layered flames behind each nozzle (orange shell, yellow
  // core, blue root) plus a warm point light. The flame groups scale in
  // Z so the flame grows out of the nozzle instead of sliding.
  // v8: flames SHORTER (4.2 -> 2.8 m) and smaller — in v7 the two giant
  // yellow cones covered the whole rear of the jet. Ref 08's flame is
  // a compact layered glow inside the nozzle, not a fireball.
  const glowTex = glowTexture();
  const flames = [];
  const abLight = new THREE.PointLight(0xFF8033, 0, 60, 1.5);
  abLight.position.set(0, 0, -7);
  group.add(abLight);
  for (const side of [-1, 1]) {
    const fg = new THREE.Group();
    fg.position.set(side * 0.55, -0.05, -5.35);
    fg.add(flameCone(0xFF7A18, 0.34, 2.8, 0.42));
    fg.add(flameCone(0xFFD75E, 0.20, 2.0, 0.7));
    fg.add(flameCone(0x66CCFF, 0.10, 1.1, 0.6));
    fg.add(flameCone(0xFFF6D8, 0.08, 0.7, 0.8)); // white-hot core
    fg.scale.set(0.001, 0.001, 0.001);
    fg.visible = false;
    group.add(fg);
    flames.push(fg);
    // Nozzle glare sprite, always faintly on, bright with the burner.
    const glare = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xFF8033, transparent: true, opacity: 0.25,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glare.scale.setScalar(1.2);
    glare.position.set(side * 0.55, -0.05, -5.4);
    group.add(glare);
    flames.push(glare);
  }

  // Landing gear: nose + two mains, raked legs, real tyres with hubs.
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.1, 8), dark);
    leg.position.set(side * 1.5, -0.95, -0.6);
    leg.rotation.z = side * 0.25;
    group.add(leg);
    const wheel = new THREE.Group();
    wheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.12, 10, 18), tyre));
    const hubDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.3, 14), hubMat);
    hubDisc.rotation.x = Math.PI / 2;
    wheel.add(hubDisc);
    wheel.position.set(side * 1.65, -1.35, -0.6);
    group.add(wheel);
  }
  const noseLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.0, 8), dark);
  noseLeg.position.set(0, -0.85, 3.1);
  group.add(noseLeg);
  const noseWheel = new THREE.Group();
  noseWheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.09, 10, 16), tyre));
  noseWheel.position.set(0, -1.25, 3.1);
  group.add(noseWheel);

  // Pitot tube on the nose + antenna mast on the spine.
  const pitot = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 6), dark);
  pitot.rotation.x = Math.PI / 2;
  pitot.position.set(0.35, 0.1, 4.2);
  group.add(pitot);
  const antenna = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.5, 6), dark);
  antenna.position.set(0, 0.85, -0.5);
  group.add(antenna);

  // Navigation lights: red left, green right, white tail — emissive
  // lamps plus an additive glow sprite so they read at dusk.
  const lights = [
    [0xFF2222, -3.55, -0.1, -0.6],
    [0x22FF66, 3.55, -0.1, -0.6],
    [0xFFFFFF, 0, 0.3, -5.0],
  ];
  for (const [col, x, y, z] of lights) {
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 10, 8),
      new THREE.MeshBasicMaterial({ color: col }),
    );
    lamp.position.set(x, y, z);
    group.add(lamp);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: col, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glow.scale.setScalar(0.9);
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
        glare.material.opacity = 0.18 + 0.5 * abLevel;
        glare.scale.setScalar(1.2 + 0.8 * abLevel);
      }
      abLight.intensity = 50 * abLevel;
      emberMat.color.setHex(0xFFFFFF); // full gradient while burning
    },
  };
}
