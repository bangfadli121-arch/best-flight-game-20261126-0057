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

export function terrainHeight(x, z) {
  let h = 0;
  for (const isl of ISLANDS) h += islandBump(x, z, isl);
  if (h > 2) h += fbm(x, z) * Math.min(9, h * 0.08);
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
  paddyDark: new THREE.Color(0x33691E),
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
    if (slope > 0.62) { col.copy(C.rock); return col; }
    // Rice-terrace patchwork: 75 m square cells, one solid colour each,
    // dark bund lines on the cell borders. 75 is a multiple of the 18.75 m
    // vertex spacing, so borders land exactly on vertices.
    const CELL = 75;
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    const pal = [C.paddyA, C.paddyB, C.paddyC, C.paddyRipe, C.paddyDark];
    const ch = cellHash(cx, cz);
    col.copy(pal[Math.floor(ch * pal.length)]);
    // Brightness jitter per cell, never per vertex.
    col.multiplyScalar(0.95 + cellHash(cx + 911, cz + 733) * 0.1);
    const fx = (((x % CELL) + CELL) % CELL);
    const fz = (((z % CELL) + CELL) % CELL);
    const edge = Math.min(fx, CELL - fx, fz, CELL - fz);
    if (edge < 7) col.lerp(C.bund, 0.55);
    if (slope > 0.45) col.lerp(C.rock, (slope - 0.45) / 0.17);
    return col;
  }
  // High ground: the volcano gets radial lava gullies (hard ash / dark-rock
  // stripes around the crater) and a snow cap with a noise-jittered but
  // hard edge; other high slopes step from grass to rock.
  const v = volcanoInfo(x, z);
  if (v.d < 780) {
    const stripe = Math.floor(v.ang * 9 + valueNoise(x * 0.01 + 5, z * 0.01 + 5) * 2.2);
    col.copy(stripe % 2 === 0 ? C.ash : C.rockDark);
    const snowline = 380 + valueNoise(x * 0.008 + 13, z * 0.008 + 29) * 45;
    if (h > snowline) col.copy(C.snow);
    col.multiplyScalar(0.94 + cellHash(Math.floor(v.ang * 9), 3) * 0.1);
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
  // Phong specular gives the sun a bright glint path across the water.
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
    new THREE.MeshPhongMaterial({ vertexColors: true, transparent: true, opacity: 0.96, shininess: 130, specular: 0xFFC98A }),
  );
  sea.position.y = 0.4;
  sea.name = 'sea';
  group.add(sea);

  buildRunway(group);
  buildTreesAndHuts(group);
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
