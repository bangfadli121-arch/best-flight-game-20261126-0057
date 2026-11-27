// aircraft.js — v21: the vinish.dev "Multirole Fighter" GLB replaces the
// procedural loft jet (v19/v20). The loft jet was rebuilt 18 times and
// never converged: the problem was CONSTRUCTION, and the fix is a real
// sculpted model — 17,136 tris, 31 meshes, one continuous airframe
// (fuselage, wings, twin tails, stabilators all one built jet).
//
// CREDIT (CC BY 4.0, shown on the HUD): "Multirole Fighter" by
// vinish.dev — https://vinish.dev — licensed CC BY 4.0.
// Model: assets/models/multirole-fighter.glb (401,744 bytes, sha256
// a21b0d38...61f609), real metre scale: 9.5 x 4.8 x 16.4 m, nose +Z,
// tail -Z (same convention as the old procedural jet, so no rotation
// is needed). Origin is re-centred on the bounding-box centre so the
// group origin is the jet's centreline, like v20.
//
// v17 rule kept: NO LANDING GEAR — the GLB ships wheels
// (Wheel_Nose / Wheel_L / Wheel_R); they are hidden, a jet in flight
// flies clean. The gold canopy (fadli-15c signature) is kept by
// re-tinting the GLB's pale-blue Canopy material to gold.
// Stab_L / Stab_R are separate meshes: they deflect with the controls.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

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

// Rectangular 2D ember glow for the twin tailpipes (v15, fadli-15b):
// the real jet keeps the fire INSIDE the nozzle with only a short
// tongue out — the ember rect does the talking.
function emberRectTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 80;
  const g = c.getContext('2d');
  g.fillStyle = '#1A0A00';
  g.fillRect(0, 0, 128, 80);
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

// A flame cone: apex backward (-Z), base at the nozzle exit. The group
// scales in Z to grow or shrink the flame without moving its base.
// Pre-flattened (wide, thin) — a 2D nozzle throws a flat sheet of
// flame, not a round fireball (fadli-15b).
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

export async function buildAircraft(envTex) {
  const group = new THREE.Group();
  group.name = 'aircraft';

  let stabL = null;
  let stabR = null;
  let flames = [];
  let emberRectMat = null;
  let abLight = null;
  let loaded = false;

  try {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync('./assets/models/multirole-fighter.glb');
    const model = gltf.scene;

    // NO LANDING GEAR (v17): the gear reads as car wheels ("ban") from
    // the chase camera. Hide the wheel groups outright.
    model.traverse((o) => {
      if (/wheel/i.test(o.name)) o.visible = false;
    });

    // Re-centre on the bounding-box centre: the GLB's origin sits at
    // the bottom of the wheels (y 0) with the nose at +Z. After this
    // the group origin is the jet's centre, like the v20 loft jet —
    // the chase camera and the physics both assume that.
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const inner = new THREE.Group();
    inner.name = 'glb';
    inner.add(model);
    model.position.sub(center);
    group.add(inner);

    // Materials: real metal needs the sunset env map (v19 lesson), and
    // the canopy is re-tinted gold (fadli-15c) — the GLB ships it pale
    // blue-grey.
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (!m || !m.isMeshStandardMaterial) continue;
        // A warm env reflection so the metal reads silver-gold, not
        // flat white. 0.4 (was 0.6): the dome's orange sky is already
        // warm, and a stronger env washes the light-grey paints out.
        if (envTex) { m.envMap = envTex; m.envMapIntensity = 0.4; }
        // v21 fix round 2: first pass (#5A5F66 etc.) overshot — the
        // cover shot's jet top sampled RGB (56,40,40), near-black, not
        // gunmetal. Lifted one notch: mid-dark greys that still read
        // clearly darker than the old near-white paints, plus lower
        // metalness (0.45) so the sun + fills light the paint instead
        // of the top going black-mirror. Target: top skin ~RGB 100-130
        // in the cover shot, like the sunlit F-22 in fadli-15c.
        const GUNMETAL = {
          Paint_LightGrey: 0x767B82, // main top coat: mid-dark gunmetal
          Aluminium: 0x82878D,       // slightly lighter bare metal
          Paint_Grey: 0x767B82,
          Paint_DarkGrey: 0x62676E,
          Steel: 0x7E838A,
          Plastic_White: 0x8A8F95,   // no more near-white plastic
          Paint_Yellow: 0xA67C1A,    // dark gold accent, was bright yellow
          Paint_Red: 0x8A1F22,       // dark red accent, was bright red
        };
        const gun = GUNMETAL[m.name];
        if (gun !== undefined) {
          m.color.setHex(gun);
          m.metalness = (m.name === 'Aluminium' || m.name === 'Steel') ? 0.75 : 0.45;
          m.roughness = (m.name === 'Aluminium' || m.name === 'Steel') ? 0.45 : 0.55;
        }
        if (m.name === 'Canopy') {
          m.color.setHex(0xD9A83C);
          m.metalness = 0.65;
          m.roughness = 0.22;
          m.emissive = new THREE.Color(0x8A5A10);
          m.emissiveIntensity = 0.6;
        }
      }
    });

    stabL = model.getObjectByName('Stab_L');
    stabR = model.getObjectByName('Stab_R');

    // Navigation-light glow sprites at the model's own lamp meshes
    // (Lamp_Red / Lamp_Green), so the glows sit exactly on the lamps.
    const glowTex = glowTexture();
    group.updateMatrixWorld(true);
    model.traverse((o) => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (!m || !/Lamp_(Red|Green)/.test(m.name || '')) continue;
        const c = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());
        // setFromObject is in group space here (group has no transform yet).
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({
          map: glowTex, color: m.color.getHex(), transparent: true, opacity: 0.85,
          blending: THREE.AdditiveBlending, depthWrite: false,
        }));
        glow.scale.setScalar(0.8);
        glow.position.copy(c);
        group.add(glow);
      }
    });

    // Twin tailpipes: the GLB's tail ends at box.min.z (model space);
    // in group space that is box.min.z - center.z. The engines sit
    // either side of the centreline, just below it.
    const tailZ = box.min.z - center.z;
    const pipeX = 0.85;
    const pipeY = -0.4;
    emberRectMat = new THREE.MeshBasicMaterial({ map: emberRectTexture() });
    for (const side of [-1, 1]) {
      const ember = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.35), emberRectMat);
      ember.rotation.y = Math.PI; // face backward
      ember.position.set(side * pipeX, pipeY, tailZ + 0.12);
      ember.userData.noShadow = true;
      group.add(ember);
    }

    // Afterburner: layered flames behind each tailpipe (orange shell,
    // yellow core, blue root, white-hot core) plus a warm point light.
    // Short and dim at rest — the real jet keeps the fire INSIDE the
    // nozzle (fadli-15b); the ember rect does the talking.
    abLight = new THREE.PointLight(0xFF8033, 0, 60, 1.5);
    abLight.position.set(0, pipeY, tailZ - 1);
    group.add(abLight);
    // Chase fill (v18): a warm point light on the camera side, parented
    // to the aircraft — the low western sun leaves the rear faces in
    // shadow from the chase camera, so this lifts them to LIGHT GREY
    // instead of a black silhouette.
    const chaseFill = new THREE.PointLight(0xFFC08A, 48, 45, 1.5);
    chaseFill.position.set(-3.5, 3.5, -12);
    group.add(chaseFill);
    for (const side of [-1, 1]) {
      const fg = new THREE.Group();
      fg.position.set(side * pipeX, pipeY, tailZ);
      fg.add(flameCone(0xFF7A18, 0.21, 0.65, 0.16));
      fg.add(flameCone(0xFFD75E, 0.12, 0.52, 0.25));
      fg.add(flameCone(0x66CCFF, 0.065, 0.36, 0.3));
      fg.add(flameCone(0xFFF6D8, 0.04, 0.26, 0.4));
      fg.scale.set(0.001, 0.001, 0.001);
      fg.visible = false;
      group.add(fg);
      flames.push(fg);
      const glare = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex, color: 0xFF8033, transparent: true, opacity: 0.08,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      glare.scale.setScalar(0.6);
      glare.position.set(side * pipeX, pipeY, tailZ - 0.05);
      group.add(glare);
      flames.push(glare);
    }

    loaded = true;
  } catch (err) {
    // Never white-screen the game over a missing model: fly invisible
    // and let the caller report the failure.
    console.error('[aircraft] GLB load failed:', err);
    if (typeof window !== 'undefined') {
      window.__aircraftError = String(err && err.message ? err.message : err);
    }
  }

  // Afterburner state, smoothed so the flames spool up and down.
  let abLevel = 0;

  return {
    group,
    loaded,
    /** Drive the afterburner: flames grow from the nozzles, the ember
     *  discs brighten and the tail light warms up. Call every frame. */
    setAfterburner(active, dt) {
      if (!loaded || !emberRectMat) return;
      const target = active ? 1 : 0;
      abLevel += (target - abLevel) * Math.min(1, dt * 6);
      if (abLevel < 0.02) {
        for (const f of flames) f.visible = false;
        abLight.intensity = 0;
        emberRectMat.color.setHex(0x241A12); // dark warm interior at idle
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
        glare.scale.setScalar(0.6 + 0.3 * abLevel);
      }
      abLight.intensity = 30 * abLevel;
      emberRectMat.color.setHex(0xFFFFFF); // full gradient while burning
    },
    /** Deflect the stabilators with the controls: symmetric for pitch,
     *  differential for roll. Inputs -1..1. Small angles — the motion
     *  is felt in flight, not read in a still. */
    setControls(pitch, roll) {
      const p = THREE.MathUtils.clamp(pitch || 0, -1, 1) * 0.16;
      const r = THREE.MathUtils.clamp(roll || 0, -1, 1) * 0.05;
      if (stabL) stabL.rotation.x = p + r;
      if (stabR) stabR.rotation.x = p - r;
    },
  };
}
