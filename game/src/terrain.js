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
    return Math.max(h, 0);
  }
  // Smooth dome.
  return isl.h * (Math.cos(t * Math.PI) + 1) / 2;
}

function runwayFlatten(x, z, h) {
  const rw = RUNWAY;
  const dx = x - rw.x, dz = z - rw.z;
  // Runway runs east-west, so the flat shelf is a rectangle in x, narrow in z.
  const along = Math.abs(dx) / (rw.length / 2 + 60);
  const across = Math.abs(dz) / (rw.width / 2 + 55);
  const m = Math.max(0, 1 - Math.max(along, across));
  const s = smooth(Math.min(1, m));
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
  // Flooded terrace: warm gold that catches the sunset like a mirror.
  paddyWater: new THREE.Color(0xFFAA55),
  // Young seedlings: pale fresh green.
  paddyYoung: new THREE.Color(0x9CCC65),
  // Volcano vegetation zones: dense forest floor, dry savanna.
  forestFloor: new THREE.Color(0x2D5A27),
  savanna: new THREE.Color(0x9A8C4A),
  bund: new THREE.Color(0x5D4037),
  rockDark: new THREE.Color(0x4E342E),
  rock: new THREE.Color(0x6D4C41),
  ash: new THREE.Color(0x6D4C41),
  snow: new THREE.Color(0xF2F4F6),
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
    // Rice-terrace patchwork: 75 m square cells, one solid colour each,
    // dark bund lines on the cell borders. 75 is a multiple of the 18.75 m
    // vertex spacing, so borders land exactly on vertices.
    // Planting phase per cell: flooded (mirror sky), young seedlings,
    // deep green, golden ripe — a hillside at four stages of the season.
    // Water is only one cell in five: the mirror plots must sparkle
    // among the green, not drown the hillside in orange.
    const CELL = 75;
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    const ch = cellHash(cx, cz);
    let base;
    if (ch < 0.20) base = C.paddyWater;
    else if (ch < 0.50) base = C.paddyYoung;
    else if (ch < 0.80) base = C.paddyDark;
    else base = C.paddyRipe;
    col.copy(base);
    // Brightness jitter per cell, never per vertex.
    col.multiplyScalar(0.95 + cellHash(cx + 911, cz + 733) * 0.1);
    const fx = (((x % CELL) + CELL) % CELL);
    const fz = (((z % CELL) + CELL) % CELL);
    const edge = Math.min(fx, CELL - fx, fz, CELL - fz);
    if (edge < 7) col.lerp(C.bund, 0.55);
    return col;
  }
  // High ground: the volcano is zoned by height — dense forest on the
  // lower flanks, dry savanna above it, bare rock with lava gullies, then
  // a snow cap with a noise-jittered but hard edge. Rock gets a
  // high-frequency speckle so it reads as gravel, not paint.
  const v = volcanoInfo(x, z);
  if (v.d < 780) {
    if (h < 190) {
      col.copy(C.forestFloor);
      col.multiplyScalar(0.9 + cellHash(Math.floor(x / 18.75), Math.floor(z / 18.75)) * 0.2);
      return col;
    }
    if (h < 280) {
      col.copy(C.savanna);
      col.multiplyScalar(0.9 + cellHash(Math.floor(x / 18.75) + 5, Math.floor(z / 18.75)) * 0.2);
      return col;
    }
    const stripe = Math.floor(v.ang * 9 + valueNoise(x * 0.01 + 5, z * 0.01 + 5) * 2.2);
    col.copy(stripe % 2 === 0 ? C.ash : C.rockDark);
    col.multiplyScalar(0.86 + cellHash(Math.floor(x / 18.75), Math.floor(z / 18.75)) * 0.28);
    const snowline = 380 + valueNoise(x * 0.008 + 13, z * 0.008 + 29) * 45;
    if (h > snowline) col.copy(C.snow);
    return col;
  }
  col.copy(C.grassB);
  if (h > 200) col.lerp(C.rock, Math.min(1, (h - 200) / 60));
  return col;
}

// ------------------------------------------------------------------ build
// Fine-grain detail texture, tiled over the whole heightfield: it
// multiplies the crisp per-cell vertex colours with grass/dirt grain, so
// the ground reads as textured terrain instead of flat colour. Mostly
// white so the paddy patchwork keeps its own colours.
function detailTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#F2F2EC';
  g.fillRect(0, 0, 256, 256);
  let seed = 1234567;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 5200; i++) {
    const v = 0.82 + rnd() * 0.18;
    const warm = rnd() > 0.72;
    g.fillStyle = warm
      ? `rgba(150,120,70,${0.10 + rnd() * 0.14})`
      : `rgba(${Math.floor(70 * v)},${Math.floor(95 * v)},${Math.floor(60 * v)},${0.08 + rnd() * 0.12})`;
    const s = 1 + rnd() * 2.2;
    g.fillRect(rnd() * 256, rnd() * 256, s, s);
  }
  // Short grass-blade strokes.
  g.strokeStyle = 'rgba(60,90,50,0.16)';
  g.lineWidth = 1;
  for (let i = 0; i < 700; i++) {
    const x = rnd() * 256, y = rnd() * 256;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (rnd() - 0.5) * 3, y - 2 - rnd() * 3);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(250, 250);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Sea bump: soft noise that breaks the flat mirror into a glitter path.
// Without it the low sun paints one solid spotlight beam on the water;
// with it the glint shatters into sparkles, the way real water does.
function seaBumpTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#808080';
  g.fillRect(0, 0, 256, 256);
  let seed = 777;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 900; i++) {
    const v = 96 + Math.floor(rnd() * 64);
    const grad = g.createRadialGradient(0, 0, 0, 0, 0, 6 + rnd() * 14);
    grad.addColorStop(0, `rgba(${v},${v},${v},0.5)`);
    grad.addColorStop(1, `rgba(${v},${v},${v},0)`);
    g.save();
    g.translate(rnd() * 256, rnd() * 256);
    g.fillStyle = grad;
    g.beginPath(); g.arc(0, 0, 6 + rnd() * 14, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(24, 24);
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

export function buildTerrain(scene) {
  const group = new THREE.Group();
  group.name = 'terrain';

  // Heightfield mesh, 320 x 320 segments over the world square: 18.75 m
  // per vertex, so the paddy patchwork below lands on crisp cell edges
  // instead of smearing across 30 m triangles.
  const SEG = 320;
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colours = new Float32Array(pos.count * 3);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);
    // Slope from a small forward difference, for rock-on-steep colouring.
    const hx = terrainHeight(x + 6, z) - h;
    const hz = terrainHeight(x, z + 6) - h;
    const slope = Math.min(1, Math.sqrt(hx * hx + hz * hz) / 6);
    tmp.copy(terrainColour(x, z, h, slope));
    colours[i * 3] = tmp.r; colours[i * 3 + 1] = tmp.g; colours[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, map: detailTexture(), roughness: 0.95, metalness: 0 }),
  );
  ground.name = 'ground';
  ground.receiveShadow = true;
  group.add(ground);

  // Sea: a wide disc, turquoise near the islands, deep teal far out.
  // Phong specular gives the sun a NARROW glint path across the water:
  // high shininess and a dimmer specular keep it a thin bright lane
  // instead of the wide spotlight beam it used to be.
  const seaGeo = new THREE.CircleGeometry(9500, 64);
  seaGeo.rotateX(-Math.PI / 2);
  const spos = seaGeo.attributes.position;
  const seaCols = new Float32Array(spos.count * 3);
  const near = new THREE.Color(0x2EC4B6), far = new THREE.Color(0x12808F);
  for (let i = 0; i < spos.count; i++) {
    const r = Math.sqrt(spos.getX(i) ** 2 + spos.getZ(i) ** 2) / 9500;
    tmp.copy(near).lerp(far, Math.min(1, r * 1.4));
    seaCols[i * 3] = tmp.r; seaCols[i * 3 + 1] = tmp.g; seaCols[i * 3 + 2] = tmp.b;
  }
  seaGeo.setAttribute('color', new THREE.BufferAttribute(seaCols, 3));
  const sea = new THREE.Mesh(
    seaGeo,
    new THREE.MeshPhongMaterial({
      vertexColors: true, transparent: true, opacity: 0.96,
      shininess: 260, specular: 0x8A5A2A,
      bumpMap: seaBumpTexture(), bumpScale: 0.35,
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
  const papiCols = [0xFF2222, 0xFF2222, 0xFFFFFF, 0xFFFFFF];
  for (let k = 0; k < 4; k++) {
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 1.1, 1.4),
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
    const walls = new THREE.Mesh(new THREE.BoxGeometry(9, 4.5, 7), hutWall);
    walls.position.y = 2.25;
    walls.castShadow = true;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(6.4, 3.4, 4), hutRoof);
    roof.position.y = 6.2;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 3.0), hutDark);
    door.position.set(0, 1.5, 3.53);
    const win1 = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.2), hutDark);
    win1.position.set(-2.6, 2.6, 3.53);
    const win2 = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.2), hutDark);
    win2.position.set(2.6, 2.6, 3.53);
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.4, 0.9), hutDark);
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
    const walls = new THREE.Mesh(new THREE.BoxGeometry(8, 4.5, 6.5), wallMats[i % wallMats.length]);
    walls.position.y = 2.25;
    walls.castShadow = true;
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 2.9), darkMat);
    door.position.set(0, 1.45, 3.28);
    const win1 = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.1), darkMat);
    win1.position.set(-2.5, 2.6, 3.28);
    const win2 = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.1), darkMat);
    win2.position.set(2.5, 2.6, 3.28);
    house.add(walls, door, win1, win2);
    gableRoof(house, roofMats[i % roofMats.length], 8, 6.5, 4.5);
    house.position.set(hx, h - 0.2, hz);
    house.rotation.y = rnd() * Math.PI;
    vgroup.add(house);
  }

  // Mosque: white walls, green dome, gold finial, one minaret.
  const mosque = new THREE.Group();
  const mWalls = new THREE.Mesh(
    new THREE.BoxGeometry(11, 6, 8.5),
    new THREE.MeshStandardMaterial({ color: 0xF8F6EF, roughness: 0.85 }),
  );
  mWalls.position.y = 3;
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
  mDoor.position.set(0, 1.8, 4.28);
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
    const box = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.8, 3.4), wallMats[0]);
    box.position.y = 3.6;
    box.castShadow = true;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.6, 2.2, 4), roofMats[0]);
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
      new THREE.BoxGeometry(6.5, 1.1, 2.2),
      new THREE.MeshStandardMaterial({ color: boatCols[i], roughness: 0.7 }),
    );
    hull.position.y = 0.4;
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
  // Pier: planks from the beach out to the boats.
  const pier = new THREE.Group();
  const pierLen = 58;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.3, pierLen), woodMat);
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
  for (let i = 0; i < 90 && placed < 28; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 430 + rnd() * 210;
    const x = cx + Math.cos(a) * r;
    const z = cz + Math.sin(a) * r;
    const h = terrainHeight(x, z);
    if (h < 50 || h > 210) continue;
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
    tree.scale.setScalar(1.2 + rnd() * 0.8);
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
    const r = 150 + rnd() * 210;
    const x = -1700 + Math.cos(a) * r;
    const z = -1500 + Math.sin(a) * r;
    const h = terrainHeight(x, z);
    if (h < 280 || h > 480) continue;
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

// Flooded terraces that actually mirror the sky: thin reflective quads
// laid along the contour treads of water-filled paddy cells, so the
// sunset glints on real water instead of orange paint alone.
function buildTerraceMirrors(group) {
  const mat = new THREE.MeshPhongMaterial({
    color: 0xFF8A3D, emissive: 0x531E00, emissiveIntensity: 0.5,
    specular: 0xFFD9A0, shininess: 240, transparent: true, opacity: 0.55,
  });
  const geo = new THREE.PlaneGeometry(36, 9);
  let placed = 0;
  for (let cz = 6; cz <= 11 && placed < 12; cz++) {
    for (let cx = 1; cx <= 9 && placed < 12; cx++) {
      if (cellHash(cx, cz) >= 0.20) continue; // only water-phase cells
      const x0 = cx * 75 + 37.5, z0 = cz * 75 + 37.5;
      // Nudge onto the tread centre: sample until the raw height is
      // close to the stepped height, so the quad lies flat on one tread.
      let bx = x0, bz = z0, ok = false;
      for (let k = 0; k < 12 && !ok; k++) {
        const gx = x0 + (k % 4 - 1.5) * 9;
        const gz = z0 + (Math.floor(k / 4) - 1) * 9;
        const h = terrainHeight(gx, gz);
        const hq = Math.floor(h / 4) * 4 + 2;
        if (Math.abs(h - hq) < 1.2 && h > 10 && h < 120) { bx = gx; bz = gz; ok = true; }
      }
      if (!ok) continue;
      const h = terrainHeight(bx, bz);
      const hx = terrainHeight(bx + 6, bz) - h;
      const hz = terrainHeight(bx, bz + 6) - h;
      // Quad lies along the contour (perpendicular to the gradient).
      const grad = new THREE.Vector3(hx, 0, hz);
      const n = new THREE.Vector3(0, 1, 0);
      if (grad.lengthSq() > 1e-6) {
        const t = new THREE.Vector3(-hz, 0, hx).normalize();
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), t);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(bx, h + 0.35, bz);
        mesh.rotation.x = -Math.PI / 2;
        mesh.quaternion.multiplyQuaternions(q, mesh.quaternion);
        mesh.name = 'terrace-water';
        group.add(mesh);
        placed++;
      }
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
