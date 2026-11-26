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
  rock: new THREE.Color(0x6D4C41),
  ash: new THREE.Color(0x4E342E),
  snow: new THREE.Color(0xF2F4F6),
};

function terrainColour(x, z, h, slope) {
  const n = valueNoise(x * 0.02 + 7, z * 0.02 + 3);
  const n2 = valueNoise(x * 0.006 + 31, z * 0.006 + 17);
  const col = new THREE.Color();
  if (h < 4) {
    col.copy(C.sand).lerp(C.sandWet, Math.min(1, (4 - h) / 4));
  } else if (h < 150) {
    // Rice-terrace bands: height steps alternate greens, broken up by noise.
    const band = Math.floor(h / 9 + n * 0.5);
    const base = (band % 3 === 0) ? C.paddyA : (band % 3 === 1) ? C.paddyB : C.paddyC;
    col.copy(base).lerp(C.grassA, Math.max(0, n2) * 0.22);
    if (slope > 0.7) col.lerp(C.rock, 0.35);
  } else if (h < 300) {
    col.copy(C.grassB).lerp(C.rock, Math.min(1, (h - 150) / 150) * 0.85);
  } else if (h < 330) {
    col.copy(C.ash);
  } else {
    col.copy(C.ash).lerp(C.snow, Math.min(1, (h - 330) / 50));
  }
  // Gentle brightness variation so the ground reads as patches, not flat paint.
  const shade = 1.0 + 0.1 * n;
  col.multiplyScalar(shade);
  return col;
}

// ------------------------------------------------------------------ build
export function buildTerrain(scene) {
  const group = new THREE.Group();
  group.name = 'terrain';

  // Heightfield mesh, 200 x 200 segments over the world square.
  const SEG = 200;
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
    new THREE.MeshLambertMaterial({ vertexColors: true }),
  );
  ground.name = 'ground';
  group.add(ground);

  // Sea: a wide disc, turquoise near the islands, deep teal far out.
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
    new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.96 }),
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
  const strip = new THREE.Mesh(
    new THREE.PlaneGeometry(rw.length, rw.width),
    new THREE.MeshLambertMaterial({ color: 0x2B2F36 }),
  );
  strip.rotation.x = -Math.PI / 2;
  strip.position.set(rw.x, rw.height + 0.35, rw.z);
  strip.name = 'runway-strip';
  group.add(strip);

  // Centreline dashes.
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xF5F5F5 });
  for (let d = -rw.length / 2 + 30; d < rw.length / 2 - 20; d += 40) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(18, 1.6), dashMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(rw.x + d, rw.height + 0.45, rw.z);
    group.add(dash);
  }
  // Threshold bars at both ends.
  for (const end of [-1, 1]) {
    for (let k = -2; k <= 2; k++) {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(14, 2.2), dashMat);
      bar.rotation.x = -Math.PI / 2;
      bar.position.set(rw.x + end * (rw.length / 2 - 14), rw.height + 0.45, rw.z + k * 4.4);
      group.add(bar);
    }
  }
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
}

function buildTreesAndHuts(group) {
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6D4C41 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2E7D32 });
  const leafMat2 = new THREE.MeshLambertMaterial({ color: 0x43A047 });
  const hutWall = new THREE.MeshLambertMaterial({ color: 0xD7CCC8 });
  const hutRoof = new THREE.MeshLambertMaterial({ color: 0x8D6E63 });
  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

  // Palm-ish trees scattered on the main island's low slopes.
  for (let i = 0; i < 46; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 180 + rnd() * 620;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const h = terrainHeight(x, z);
    if (h < 8 || h > 110 || isOverRunway(x, z)) continue;
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 7, 6), trunkMat);
    trunk.position.y = 3.5;
    const crown = new THREE.Mesh(new THREE.ConeGeometry(3.4, 6.5, 7), i % 2 ? leafMat : leafMat2);
    crown.position.y = 9.5;
    tree.add(trunk, crown);
    tree.position.set(x, h - 0.3, z);
    tree.rotation.y = rnd() * Math.PI;
    tree.scale.setScalar(1.25 + rnd() * 0.9);
    group.add(tree);
  }
  // A few huts beside the runway.
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
    const roof = new THREE.Mesh(new THREE.ConeGeometry(6.4, 3.4, 4), hutRoof);
    roof.position.y = 6.2;
    roof.rotation.y = Math.PI / 4;
    hut.add(walls, roof);
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
