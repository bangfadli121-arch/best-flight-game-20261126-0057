// aircraft.js — the bush plane, built to look built, nose toward +Z.
// One job: the visible aircraft model and its prop spin. No boxes: the
// fuselage is a lathed, smooth-shaded body with a painted livery, the
// canopy is curved glass, the wings are extruded airfoils with rounded
// tips, the wheels are real tyres with hubs, and the nav lights glow.

import * as THREE from 'three';

// ------------------------------------------------------------------ livery
// Painted onto the lathed fuselage. Lathe UV: u runs around the body
// (u=0 and u=0.5 are the two fuselage sides, u=0.25 the top), v runs
// tail (canvas bottom) to nose (canvas top). So the cheatline is two
// vertical red bands on the sides, panel stations are horizontal lines,
// and the registration runs along the rear fuselage, rotated 90 degrees.
function fuselageTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#F5F5F5';
  g.fillRect(0, 0, 1024, 256);
  // Subtle panel shading: faint vertical bands along the body.
  for (let x = 0; x < 1024; x += 64) {
    g.fillStyle = 'rgba(0,0,0,0.045)';
    g.fillRect(x, 0, 2, 256);
  }
  // Red cheatline: a band on each fuselage side (u=0 and u=0.5), running
  // nose to tail, with a thin gold pinstripe under it.
  g.fillStyle = '#E53935';
  g.fillRect(0, 96, 30, 64);
  g.fillRect(994, 96, 30, 64);
  g.fillRect(482, 96, 60, 64);
  g.fillStyle = '#FFC93C';
  g.fillRect(0, 160, 30, 5);
  g.fillRect(994, 160, 30, 5);
  g.fillRect(482, 160, 60, 5);
  // Red rear-fuselage band (wraps the tail cone).
  g.fillStyle = '#E53935';
  g.fillRect(0, 216, 1024, 26);
  // Registration, running along the rear fuselage on both sides.
  g.fillStyle = '#1A2B3C';
  g.font = 'bold 40px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.save();
  g.translate(15, 128); g.rotate(-Math.PI / 2);
  g.fillText('PK-MRP', 0, 0);
  g.restore();
  g.save();
  g.translate(512, 128); g.rotate(-Math.PI / 2);
  g.fillText('PK-MRP', 0, 0);
  g.restore();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// Radial-fade disc for the spinning prop: dense at the hub, gone at the rim.
function propDiscTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 8, 128, 128, 128);
  grad.addColorStop(0, 'rgba(220,220,220,0.34)');
  grad.addColorStop(0.55, 'rgba(220,220,220,0.16)');
  grad.addColorStop(1, 'rgba(220,220,220,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Soft round glow for the navigation lights.
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

// ------------------------------------------------------------------ helpers
// Extruded wing panel: planform in (span, chord) with a rounded tip,
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
    depth: thickness, bevelEnabled: true, bevelThickness: 0.05,
    bevelSize: 0.05, bevelSegments: 2, curveSegments: 10,
  });
  geo.rotateX(Math.PI / 2); // chord -> Z, thickness -> Y
  geo.translate(0, thickness / 2 + 0.05, 0);
  return new THREE.Mesh(geo, mat);
}

// A rounded blade: a box with bevelled ends, slight pitch twist.
function propBlade(mat, tipMat) {
  const g = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.5, 0.07), mat);
  blade.position.y = 0.95;
  blade.rotation.x = 0.35; // pitch
  const tip = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.34, 0.075), tipMat);
  tip.position.y = 1.62;
  tip.rotation.x = 0.35;
  g.add(blade, tip);
  return g;
}

export function buildAircraft() {
  const group = new THREE.Group();
  group.name = 'aircraft';

  const white = new THREE.MeshStandardMaterial({ color: 0xF5F5F5, metalness: 0.25, roughness: 0.32 });
  const red = new THREE.MeshStandardMaterial({ color: 0xE53935, metalness: 0.25, roughness: 0.32 });
  const livery = new THREE.MeshStandardMaterial({
    map: fuselageTexture(), metalness: 0.25, roughness: 0.32,
  });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x1E3A55, metalness: 0.85, roughness: 0.1,
    emissive: 0x14304A, emissiveIntensity: 0.9,
  });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1A2B3C, metalness: 0.6, roughness: 0.3 });
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0x22262B, metalness: 0.4, roughness: 0.45 });
  const yellowTip = new THREE.MeshStandardMaterial({ color: 0xFFC93C, metalness: 0.2, roughness: 0.4 });
  const tyre = new THREE.MeshStandardMaterial({ color: 0x1E1E1E, roughness: 0.95 });
  const hubMat = new THREE.MeshStandardMaterial({ color: 0xB0BEC5, metalness: 0.8, roughness: 0.3 });

  // Fuselage: lathed body, tail tip to nose tip, smooth-shaded, painted.
  const profile = [
    [0.10, -2.95], [0.26, -2.80], [0.40, -2.45], [0.50, -1.90],
    [0.56, -1.10], [0.58, -0.30], [0.58, 0.40], [0.56, 1.00],
    [0.51, 1.60], [0.43, 2.10], [0.32, 2.45], [0.18, 2.68], [0.08, 2.78],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const fuselageGeo = new THREE.LatheGeometry(profile, 28);
  fuselageGeo.rotateX(Math.PI / 2); // profile axis -> Z, nose toward +Z
  const fuselage = new THREE.Mesh(fuselageGeo, livery);
  fuselage.position.set(0, 0, 0);
  group.add(fuselage);

  // Belly keel: a slim fairing under the fuselage so the underside is not bare.
  const keel = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.3, 3.4, 10), white);
  keel.rotation.x = Math.PI / 2;
  keel.position.set(0, -0.5, -0.4);
  keel.scale.set(1, 1, 0.7);
  group.add(keel);

  // Canopy: curved glass bubble over the cabin, plus a slim windscreen.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), glass);
  canopy.scale.set(0.52, 0.42, 1.15);
  canopy.position.set(0, 0.42, 0.45);
  group.add(canopy);
  const canopyFrame = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.045, 8, 20), white);
  canopyFrame.scale.set(1, 0.82, 1);
  canopyFrame.position.set(0, 0.42, 0.45);
  canopyFrame.rotation.x = Math.PI / 2 - 0.5;
  group.add(canopyFrame);
  // Rear side windows.
  for (const side of [-1, 1]) {
    const win = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), glass);
    win.scale.set(0.1, 0.3, 0.55);
    win.position.set(side * 0.5, 0.32, -0.55);
    group.add(win);
  }

  // Main wing: white panels with red tips, slight dihedral, struts.
  // The extruded geometry already spans x in [0.35, 5.5]; the mesh
  // origin stays at the centreline, rotation.z lifts the tip, and the
  // left wing is mirrored with rotation.y = PI (Euler XYZ applies the
  // Z rotation first, so the same +0.055 lifts the mirrored tip too).
  for (const side of [-1, 1]) {
    const panel = wingPanel(white, 0.35, 5.5, 2.05, 1.55);
    panel.position.set(0, 0.22, 0.55);
    panel.rotation.z = 0.055;
    if (side < 0) panel.rotation.y = Math.PI;
    group.add(panel);
    const tip = wingPanel(red, 5.5, 6.45, 1.55, 1.35);
    tip.position.set(0, 0.22, 0.55);
    tip.rotation.z = 0.055;
    if (side < 0) tip.rotation.y = Math.PI;
    group.add(tip);
    // Strut from the lower fuselage to the wing.
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6), white);
    strut.position.set(side * 1.85, -0.62, 0.55);
    strut.rotation.z = side * 0.55;
    group.add(strut);
  }

  // Tail: stabiliser + fin, both extruded with rounded edges.
  for (const side of [-1, 1]) {
    const stab = wingPanel(white, 0.1, 2.1, 1.25, 0.95, 0.11);
    stab.position.set(0, 0.22, -2.72);
    if (side < 0) stab.rotation.y = Math.PI;
    group.add(stab);
    const stabTip = wingPanel(red, 2.1, 2.45, 0.95, 0.85, 0.11);
    stabTip.position.set(0, 0.22, -2.72);
    if (side < 0) stabTip.rotation.y = Math.PI;
    group.add(stabTip);
  }
  // Vertical fin: extruded profile, swept back, red. The shape is drawn
  // with +x as the leading edge, so rotate -90 deg about Y to lay the
  // chord along the fuselage (leading edge toward the nose).
  const finShape = new THREE.Shape();
  finShape.moveTo(-0.85, 0);
  finShape.lineTo(0.55, 0);
  finShape.quadraticCurveTo(0.95, 0.1, 0.62, 0.9);
  finShape.quadraticCurveTo(0.45, 1.45, -0.1, 1.62);
  finShape.quadraticCurveTo(-0.55, 1.7, -0.7, 1.15);
  finShape.quadraticCurveTo(-0.85, 0.55, -0.85, 0);
  const finGeo = new THREE.ExtrudeGeometry(finShape, {
    depth: 0.12, bevelEnabled: true, bevelThickness: 0.03,
    bevelSize: 0.03, bevelSegments: 2, curveSegments: 8,
  });
  finGeo.rotateY(-Math.PI / 2);
  finGeo.translate(0.06, 0, 0);
  const fin = new THREE.Mesh(finGeo, red);
  fin.position.set(0, 0.28, -2.95);
  group.add(fin);

  // Propeller: red spinner, hub, three blades with yellow tips, blur disc.
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.0, 20), red);
  spinner.rotation.x = Math.PI / 2;
  spinner.position.set(0, 0, 3.15);
  group.add(spinner);
  const prop = new THREE.Group();
  prop.position.set(0, 0, 3.55);
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), dark);
  prop.add(hub);
  for (let k = 0; k < 3; k++) {
    const blade = propBlade(bladeMat, yellowTip);
    blade.rotation.z = (k / 3) * Math.PI * 2;
    prop.add(blade);
  }
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(1.85, 36),
    new THREE.MeshBasicMaterial({
      map: propDiscTexture(), transparent: true, opacity: 0.5,
      side: THREE.DoubleSide, depthWrite: false,
    }),
  );
  disc.userData.noShadow = true;
  prop.add(disc);
  group.add(prop);

  // Landing gear: raked legs, real tyres (torus + hub) and a tail wheel.
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.5, 8), dark);
    leg.position.set(side * 0.85, -1.15, 0.9);
    leg.rotation.z = side * 0.35;
    group.add(leg);
    const wheel = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.17, 10, 18), tyre);
    const hubDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.36, 14), hubMat);
    hubDisc.rotation.x = Math.PI / 2;
    wheel.add(tire, hubDisc);
    wheel.position.set(side * 1.15, -1.85, 0.9);
    group.add(wheel);
  }
  const tailWheel = new THREE.Group();
  tailWheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.09, 8, 14), tyre));
  tailWheel.position.set(0, -0.8, -2.7);
  group.add(tailWheel);

  // Pitot tube under the left wing + antenna mast on the cabin.
  const pitot = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 6), dark);
  pitot.rotation.x = Math.PI / 2;
  pitot.position.set(-2.6, 0.05, 1.15);
  group.add(pitot);
  const antenna = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.5, 6), dark);
  antenna.position.set(0, 0.85, -0.5);
  group.add(antenna);

  // Registration decals on both fuselage sides (flat, just off the skin).
  const labelTex = (() => {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const g = c.getContext('2d');
    g.clearRect(0, 0, 256, 64);
    g.fillStyle = '#1A2B3C';
    g.font = 'bold 44px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('PK-MRP', 128, 34);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  })();
  for (const side of [-1, 1]) {
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(1.9, 0.48),
      new THREE.MeshBasicMaterial({ map: labelTex, transparent: true, side: THREE.DoubleSide }),
    );
    label.userData.noShadow = true;
    label.position.set(side * 0.58, 0.05, -0.6);
    label.rotation.y = side * Math.PI / 2;
    group.add(label);
  }

  // Navigation lights: red left, green right, white tail — emissive
  // lamps plus an additive glow sprite so they read at dusk.
  const glowTex = glowTexture();
  const lights = [
    [0xFF2222, -6.45, 0.28, 0.55],
    [0x22FF66, 6.45, 0.28, 0.55],
    [0xFFFFFF, 0, 0.35, -3.05],
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

  // Shadows: everything solid casts; decals, blur disc and glows do not.
  group.traverse((o) => {
    if (o.isMesh && !o.userData.noShadow) o.castShadow = true;
  });

  return {
    group,
    /** Spin the propeller; rate scales with throttle so it reads as a blur. */
    spinProp(dt, throttle) {
      prop.rotation.z += dt * (6 + throttle * 55);
    },
  };
}
