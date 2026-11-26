// aircraft.js — the bush plane, built from primitives, nose toward +Z.
// One job: the visible aircraft model (fuselage, wings, tail, propeller,
// landing gear, registration label, navigation lights) and its prop spin.

import * as THREE from 'three';

function labelTexture() {
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
}

export function buildAircraft() {
  const group = new THREE.Group();
  group.name = 'aircraft';

  const white = new THREE.MeshStandardMaterial({ color: 0xF5F5F5, metalness: 0.15, roughness: 0.45 });
  const red = new THREE.MeshStandardMaterial({ color: 0xE53935, metalness: 0.2, roughness: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1A2B3C, metalness: 0.6, roughness: 0.25 });
  const tyre = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });

  // Fuselage: nose (+Z) slightly narrower than the tail.
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.58, 5.4, 14), white);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.position.set(0, 0, -0.2);
  group.add(fuselage);

  // Red spinner cone on the nose.
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.1, 12), red);
  spinner.rotation.x = Math.PI / 2;
  spinner.position.set(0, 0, 3.0);
  group.add(spinner);

  // Cabin hump with dark windows.
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.75, 2.3), white);
  cabin.position.set(0, 0.55, 0.35);
  group.add(cabin);
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 0.12), dark);
  windshield.position.set(0, 0.62, 1.52);
  windshield.rotation.x = -0.35;
  group.add(windshield);
  for (const side of [-1, 1]) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.45, 1.5), dark);
    win.position.set(side * 0.6, 0.6, 0.35);
    group.add(win);
  }

  // Main wing: white with red tips, slight dihedral via two panels.
  for (const side of [-1, 1]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.16, 2.0), white);
    panel.position.set(side * 2.85, 0.18, 0.55);
    panel.rotation.z = side * 0.06;
    group.add(panel);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.18, 2.05), red);
    tip.position.set(side * 5.95, 0.18 + side * 0.06 * 5.4 * 0.5, 0.55);
    tip.rotation.z = side * 0.06;
    group.add(tip);
    // Wing strut down to the fuselage.
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.6, 6), white);
    strut.position.set(side * 1.9, -0.75, 0.55);
    strut.rotation.z = side * 0.5;
    group.add(strut);
  }

  // Tail: red fin + stabiliser.
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.7, 1.5), red);
  fin.position.set(0, 0.85, -2.75);
  fin.rotation.x = 0.25;
  group.add(fin);
  const stab = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.14, 1.3), white);
  stab.position.set(0, 0.18, -2.75);
  group.add(stab);
  for (const side of [-1, 1]) {
    const stabTip = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.15, 1.32), red);
    stabTip.position.set(side * 2.1, 0.18, -2.75);
    group.add(stabTip);
  }

  // Propeller: hub + two blades + translucent blur disc.
  const prop = new THREE.Group();
  prop.position.set(0, 0, 3.55);
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), dark);
  prop.add(hub);
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5 });
  for (const a of [0, Math.PI]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.26, 3.3, 0.07), bladeMat);
    blade.rotation.z = a;
    blade.position.y = 0;
    prop.add(blade);
  }
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(1.72, 28),
    new THREE.MeshBasicMaterial({ color: 0xDDDDDD, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
  );
  prop.add(disc);
  group.add(prop);

  // Fixed landing gear: two legs + wheels.
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.5, 6), dark);
    leg.position.set(side * 0.85, -1.15, 0.9);
    leg.rotation.z = side * 0.35;
    group.add(leg);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12), tyre);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * 1.15, -1.85, 0.9);
    group.add(wheel);
  }
  const tailWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.18, 10), tyre);
  tailWheel.rotation.z = Math.PI / 2;
  tailWheel.position.set(0, -0.85, -2.7);
  group.add(tailWheel);

  // Registration label on both fuselage sides.
  const labelTex = labelTexture();
  for (const side of [-1, 1]) {
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(1.9, 0.48),
      new THREE.MeshBasicMaterial({ map: labelTex, transparent: true, side: THREE.DoubleSide }),
    );
    label.position.set(side * 0.56, 0.05, -0.6);
    label.rotation.y = side * Math.PI / 2;
    group.add(label);
  }

  // Navigation lights: red left, green right, white tail.
  const lights = [
    [0xFF2222, -6.4, 0.18, 0.55],
    [0x22FF66, 6.4, 0.18, 0.55],
    [0xFFFFFF, 0, 0.3, -3.1],
  ];
  for (const [col, x, y, z] of lights) {
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 6),
      new THREE.MeshBasicMaterial({ color: col }),
    );
    lamp.position.set(x, y, z);
    group.add(lamp);
  }

  return {
    group,
    /** Spin the propeller; rate scales with throttle so it reads as a blur. */
    spinProp(dt, throttle) {
      prop.rotation.z += dt * (6 + throttle * 55);
    },
  };
}
