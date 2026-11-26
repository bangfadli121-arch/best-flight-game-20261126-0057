// aircraft.js — the F-22 RAPTOR, built to look built, nose toward +Z.
// One job: the visible jet model, its twin nozzles and the afterburner
// flames. No boxes: the airframe is a flat diamond planform (chine,
// blended delta wing, canted twin tails) in stealth grey, the canopy is
// dark bubble glass, the nozzles are real metal, and the afterburner is
// layered additive flame + a warm point light. From the chase camera the
// silhouette reads at once: delta wing, twin tails leaning out, two
// nozzles — a Raptor, not a generic plane.

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

// Top-skin texture (ref 02): light silver-grey with thin darker panel
// lines, a few soft weathering blotches and a pale leading-edge strip.
// ExtrudeGeometry lid UVs are the planform shape coords (x -3.6..3.6,
// y -5..4.7), so repeat/offset below maps this canvas across the jet.
function panelTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#AEB6BF');
  grad.addColorStop(0.5, '#9AA3AD');
  grad.addColorStop(1, '#8E97A1');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 512);
  // Soft weathering blotches, darker and lighter grey.
  let seed = 4242;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 14; i++) {
    const x = rnd() * 512, y = rnd() * 512, r = 34 + rnd() * 70;
    const bg = g.createRadialGradient(x, y, 0, x, y, r);
    const dark = rnd() > 0.5;
    bg.addColorStop(0, dark ? 'rgba(110,118,128,0.20)' : 'rgba(190,198,208,0.16)');
    bg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = bg;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  // Panel lines: chordwise stations + spanwise seams, thin and dark.
  g.strokeStyle = 'rgba(84,92,102,0.6)';
  g.lineWidth = 2;
  for (const y of [64, 150, 248, 348, 436]) {
    g.beginPath(); g.moveTo(20, y); g.lineTo(492, y); g.stroke();
  }
  for (const x of [96, 186, 256, 326, 416]) {
    g.beginPath(); g.moveTo(x, 24); g.lineTo(x, 488); g.stroke();
  }
  // Diagonal leading-edge seams.
  g.beginPath(); g.moveTo(20, 470); g.lineTo(256, 300); g.lineTo(492, 470); g.stroke();
  g.beginPath(); g.moveTo(60, 60); g.lineTo(256, 210); g.lineTo(452, 60); g.stroke();
  // Rivet dots along the chordwise lines.
  g.fillStyle = 'rgba(84,92,102,0.4)';
  for (const y of [64, 150, 248, 348, 436]) {
    for (let x = 30; x < 500; x += 18) { g.fillRect(x, y - 1, 2, 2); }
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
    depth: thickness, bevelEnabled: true, bevelThickness: 0.05,
    bevelSize: 0.05, bevelSegments: 2, curveSegments: 10,
  });
  geo.rotateX(Math.PI / 2); // chord -> Z, thickness -> Y
  geo.translate(0, thickness / 2 + 0.05, 0);
  return new THREE.Mesh(geo, mat);
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

export function buildAircraft() {
  const group = new THREE.Group();
  group.name = 'aircraft';

  // Ref 02/08: the real Raptor is LIGHT grey in the sun, not a dark
  // slab — bright top skin with panel lines, mid-grey sides, darker
  // belly, gold canopy. The old single dark tone is what read as a
  // black blob from the chase camera.
  const stealth = new THREE.MeshStandardMaterial({ color: 0x6E7680, metalness: 0.6, roughness: 0.42 });
  const stealthTop = new THREE.MeshStandardMaterial({ map: panelTexture(), color: 0xB9C9DA, metalness: 0.55, roughness: 0.38 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x3A4048, metalness: 0.6, roughness: 0.45 });
  const spineMat = new THREE.MeshStandardMaterial({ color: 0x7E858F, metalness: 0.6, roughness: 0.4 });
  const nozzleMat = new THREE.MeshStandardMaterial({ color: 0x2A2E33, metalness: 0.85, roughness: 0.35 });
  const nozzleRingMat = new THREE.MeshStandardMaterial({ color: 0x9AA0A8, metalness: 0.9, roughness: 0.3 });
  const emberTex = emberTexture();
  const glass = new THREE.MeshStandardMaterial({
    color: 0xC9962E, metalness: 0.95, roughness: 0.12,
    emissive: 0x7A4A10, emissiveIntensity: 0.55,
  });
  const tyre = new THREE.MeshStandardMaterial({ color: 0x1E1E1E, roughness: 0.95 });
  const hubMat = new THREE.MeshStandardMaterial({ color: 0xB0BEC5, metalness: 0.8, roughness: 0.3 });

  // Airframe: flat diamond planform, nose toward +Z. Shape coords are
  // (span, -z): the nose is at y=-5, the notched tail at y=+4.3.
  // Extrude lids (top/bottom) take the lighter top material, the walls
  // the darker side material — a subtle two-tone stealth finish.
  const bodyShape = new THREE.Shape();
  bodyShape.moveTo(0, -5.0);
  bodyShape.lineTo(1.0, -3.4);   // chine
  bodyShape.lineTo(2.4, -1.2);   // leading-edge extension
  bodyShape.lineTo(3.6, 0.4);    // delta wing leading edge
  bodyShape.lineTo(3.6, 1.6);    // wingtip
  bodyShape.lineTo(2.0, 3.8);    // trailing edge
  bodyShape.lineTo(1.3, 4.7);    // tail corner
  bodyShape.lineTo(0, 4.3);      // tail notch between the nozzles
  bodyShape.lineTo(-1.3, 4.7);
  bodyShape.lineTo(-2.0, 3.8);
  bodyShape.lineTo(-3.6, 1.6);
  bodyShape.lineTo(-3.6, 0.4);
  bodyShape.lineTo(-2.4, -1.2);
  bodyShape.lineTo(-1.0, -3.4);
  bodyShape.closePath();
  const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, {
    depth: 0.5, bevelEnabled: true, bevelThickness: 0.28,
    bevelSize: 0.26, bevelSegments: 3, curveSegments: 8,
  });
  bodyGeo.rotateX(-Math.PI / 2); // shape plane -> XZ, nose toward +Z
  bodyGeo.translate(0, -0.25, 0);
  const body = new THREE.Mesh(bodyGeo, [stealthTop, stealth]);
  group.add(body);

  // Dorsal spine: a raised, flattened ridge down the centreline, giving
  // the flat diamond body its chined back.
  const spine = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), spineMat);
  spine.scale.set(0.55, 0.3, 2.5);
  spine.position.set(0, 0.42, -0.7);
  group.add(spine);

  // Canopy: dark bubble glass over the cockpit, ahead of the spine.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), glass);
  canopy.scale.set(0.55, 0.5, 1.5);
  canopy.position.set(0, 0.6, 1.3);
  group.add(canopy);

  // Canted twin tails: swept fins leaning out ~28 degrees, the Raptor's
  // signature. Each tail is its own group so the decal rides the cant.
  const finShape = new THREE.Shape();
  finShape.moveTo(-1.2, 0);
  finShape.lineTo(1.0, 0);
  finShape.lineTo(0.7, 1.3);
  finShape.lineTo(0.1, 1.85);
  finShape.lineTo(-0.6, 1.5);
  finShape.lineTo(-1.1, 0.6);
  finShape.closePath();
  const finGeo = new THREE.ExtrudeGeometry(finShape, {
    depth: 0.1, bevelEnabled: true, bevelThickness: 0.03,
    bevelSize: 0.03, bevelSegments: 2, curveSegments: 8,
  });
  finGeo.rotateY(-Math.PI / 2); // chord -> Z, leading edge toward the nose
  finGeo.translate(-0.05, 0, 0); // centre the thickness on the local origin
  const decalTex = raptorDecalTexture();
  for (const side of [-1, 1]) {
    const tail = new THREE.Group();
    tail.position.set(side * 0.95, 0.3, -3.5);
    tail.rotation.z = -side * 0.5; // cant outward ~28 deg
    const fin = new THREE.Mesh(finGeo, stealth);
    tail.add(fin);
    // "RAPTOR" + tail number on the outer face of the fin.
    const decal = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 0.28),
      new THREE.MeshBasicMaterial({ map: decalTex, transparent: true, side: THREE.DoubleSide }),
    );
    decal.userData.noShadow = true;
    decal.position.set(side * 0.1, 0.95, 0);
    decal.rotation.y = side * Math.PI / 2;
    tail.add(decal);
    group.add(tail);
  }

  // Stabilators: small all-moving tails, slight anhedral.
  for (const side of [-1, 1]) {
    const stab = wingPanel(stealth, 0.15, 2.5, 1.5, 0.9, 0.1);
    stab.position.set(0, 0.05, -4.15);
    stab.rotation.z = -0.07;
    if (side < 0) stab.rotation.y = Math.PI;
    group.add(stab);
  }

  // Caret intakes: dark ducts tucked under the wing roots, black mouths
  // facing forward.
  const mouthMat = new THREE.MeshBasicMaterial({ color: 0x0A0C0E });
  for (const side of [-1, 1]) {
    const duct = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 2.8), dark);
    duct.position.set(side * 2.45, -0.55, 0.5);
    group.add(duct);
    const mouth = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.5), mouthMat);
    mouth.userData.noShadow = true;
    mouth.position.set(side * 2.45, -0.55, 1.92);
    group.add(mouth);
  }

  // Twin rectangular nozzles at the tail, dark metal, each with a
  // metallic petal ring (ref 01) and a layered hot core disc inside
  // that brightens with the afterburner.
  const emberMat = new THREE.MeshBasicMaterial({ map: emberTex });
  const embers = [];
  for (const side of [-1, 1]) {
    const nozzle = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.45, 0.9), nozzleMat);
    nozzle.position.set(side * 0.8, -0.05, -4.85);
    group.add(nozzle);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.075, 10, 20), nozzleRingMat);
    ring.position.set(side * 0.8, -0.05, -5.3);
    group.add(ring);
    const ember = new THREE.Mesh(new THREE.CircleGeometry(0.28, 20), emberMat);
    ember.rotation.y = Math.PI; // face backward
    ember.position.set(side * 0.8, -0.05, -5.31);
    ember.userData.noShadow = true;
    group.add(ember);
    embers.push(ember);
  }

  // Afterburner: layered flames behind each nozzle (orange shell, yellow
  // core, blue root) plus a warm point light. The flame groups scale in
  // Z so the flame grows out of the nozzle instead of sliding.
  const glowTex = glowTexture();
  const flames = [];
  const abLight = new THREE.PointLight(0xFF8033, 0, 60, 1.5);
  abLight.position.set(0, 0, -7);
  group.add(abLight);
  for (const side of [-1, 1]) {
    const fg = new THREE.Group();
    fg.position.set(side * 0.8, -0.05, -5.35);
    fg.add(flameCone(0xFF7A18, 0.42, 4.2, 0.55));
    fg.add(flameCone(0xFFD75E, 0.24, 2.8, 0.85));
    fg.add(flameCone(0x66CCFF, 0.12, 1.5, 0.7));
    fg.add(flameCone(0xFFF6D8, 0.09, 0.9, 0.9)); // white-hot core
    fg.scale.set(0.001, 0.001, 0.001);
    fg.visible = false;
    group.add(fg);
    flames.push(fg);
    // Nozzle glare sprite, always faintly on, bright with the burner.
    const glare = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xFF8033, transparent: true, opacity: 0.25,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glare.scale.setScalar(1.6);
    glare.position.set(side * 0.8, -0.05, -5.4);
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

  // Pitot tube on the right wing + antenna mast on the spine.
  const pitot = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 6), dark);
  pitot.rotation.x = Math.PI / 2;
  pitot.position.set(2.6, 0.05, 1.15);
  group.add(pitot);
  const antenna = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.5, 6), dark);
  antenna.position.set(0, 0.85, -0.5);
  group.add(antenna);

  // Navigation lights: red left, green right, white tail — emissive
  // lamps plus an additive glow sprite so they read at dusk.
  const lights = [
    [0xFF2222, -3.6, 0.15, 1.0],
    [0x22FF66, 3.6, 0.15, 1.0],
    [0xFFFFFF, 0, 0.25, -5.0],
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
        glare.material.opacity = 0.25 + 0.65 * abLevel;
        glare.scale.setScalar(1.6 + 1.4 * abLevel);
      }
      abLight.intensity = 80 * abLevel;
      emberMat.color.setHex(0xFFFFFF); // full gradient while burning
    },
  };
}
