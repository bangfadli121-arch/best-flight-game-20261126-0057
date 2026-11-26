// sky.js — the golden-hour sky for MERPATI SENJA.
// One job: sky dome gradient, low sun with glow, lit clouds, volcano smoke.
// The dusk factor (0 = sunset gold, 1 = deep twilight) is set per shot.

import * as THREE from 'three';

const SKY_DAY = {
  horizon: new THREE.Color(0xFF5A1F),
  low: new THREE.Color(0xFF8A3D),
  mid: new THREE.Color(0xB84A7A),
  high: new THREE.Color(0x7B2D8B),
  zenith: new THREE.Color(0x1B2A6B),
};
const SKY_DUSK = {
  horizon: new THREE.Color(0xC23A12),
  low: new THREE.Color(0x8A2E4D),
  mid: new THREE.Color(0x4A2060),
  high: new THREE.Color(0x241A4D),
  zenith: new THREE.Color(0x0B1030),
};

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255,214,130,0.95)');
  grad.addColorStop(0.25, 'rgba(255,150,60,0.55)');
  grad.addColorStop(0.6, 'rgba(255,90,40,0.18)');
  grad.addColorStop(1, 'rgba(255,90,40,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function cloudTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(255,255,255,0.85)');
  grad.addColorStop(0.7, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export function buildSky(scene) {
  const group = new THREE.Group();
  group.name = 'sky';

  // Gradient dome: colour bands by height above the horizon.
  const uniforms = {
    uHorizon: { value: SKY_DAY.horizon.clone() },
    uLow: { value: SKY_DAY.low.clone() },
    uMid: { value: SKY_DAY.mid.clone() },
    uHigh: { value: SKY_DAY.high.clone() },
    uZenith: { value: SKY_DAY.zenith.clone() },
  };
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(8500, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms,
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_Position.z = gl_Position.w; // pin the dome to the far plane
        }`,
      fragmentShader: `
        varying vec3 vDir;
        uniform vec3 uHorizon, uLow, uMid, uHigh, uZenith;
        void main() {
          float h = clamp(vDir.y, -0.08, 1.0);
          vec3 col = uHorizon;
          col = mix(col, uLow, smoothstep(0.0, 0.14, h));
          col = mix(col, uMid, smoothstep(0.14, 0.30, h));
          col = mix(col, uHigh, smoothstep(0.30, 0.55, h));
          col = mix(col, uZenith, smoothstep(0.55, 1.0, h));
          // Warm the band right at the horizon.
          col += vec3(0.10, 0.03, 0.0) * (1.0 - smoothstep(0.0, 0.10, h));
          gl_FragColor = vec4(col, 1.0);
        }`,
    }),
  );
  dome.name = 'sky-dome';
  group.add(dome);

  // Low sun disc + wide glow, low in the west.
  const sunDir = new THREE.Vector3(-0.82, 0.16, 0.42).normalize();
  const sunPos = sunDir.clone().multiplyScalar(7800);
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(300, 40),
    new THREE.MeshBasicMaterial({ color: 0xFFD27A, fog: false }),
  );
  sun.position.copy(sunPos);
  sun.lookAt(0, 0, 0);
  sun.name = 'sun-disc';
  group.add(sun);
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, depthWrite: false, fog: false }),
  );
  glow.position.copy(sunPos);
  glow.scale.setScalar(4200);
  glow.name = 'sun-glow';
  group.add(glow);

  // Soft lit clouds: flattened puffs in small clusters.
  const tex = cloudTexture();
  const clouds = new THREE.Group();
  clouds.name = 'clouds';
  const cloudMat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, opacity: 0.85, depthWrite: false,
    color: 0xFFC9A3, fog: false,
  });
  const cloudMat2 = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, opacity: 0.68, depthWrite: false,
    color: 0xE8A0C0, fog: false,
  });
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let c = 0; c < 8; c++) {
    const a = (c / 8) * Math.PI * 2 + rnd() * 0.5;
    const r = 1800 + rnd() * 3200;
    const cx = Math.cos(a) * r, cz = Math.sin(a) * r;
    const cy = 380 + rnd() * 320;
    const puffs = 3 + Math.floor(rnd() * 3);
    for (let p = 0; p < puffs; p++) {
      const s = new THREE.Sprite(p < puffs - 1 ? cloudMat : cloudMat2);
      const w = 420 + rnd() * 420;
      s.position.set(cx + (rnd() - 0.5) * 700, cy + (rnd() - 0.5) * 90, cz + (rnd() - 0.5) * 260);
      s.scale.set(w, w * 0.36, 1);
      clouds.add(s);
    }
  }
  group.add(clouds);

  // Volcano smoke: a slow column of grey puffs over the crater.
  const smoke = new THREE.Group();
  smoke.name = 'volcano-smoke';
  const smokeMat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, opacity: 0.5, depthWrite: false,
    color: 0x8D8D9E, fog: false,
  });
  const puffs = [];
  for (let i = 0; i < 9; i++) {
    const s = new THREE.Sprite(smokeMat);
    s.userData.baseY = 520 + i * 55;
    s.userData.phase = i * 0.7;
    s.position.set(-1700 + (i % 3 - 1) * 26, s.userData.baseY, -1500 + (i % 2) * 20);
    const w = 130 + i * 26;
    s.scale.set(w, w * 0.55, 1);
    puffs.push(s);
    smoke.add(s);
  }
  group.add(smoke);

  scene.add(group);

  let t = 0;
  return {
    group,
    sunDir,
    setDusk(d) {
      // Blend the whole palette toward the twilight set.
      for (const k of Object.keys(SKY_DAY)) {
        uniforms['u' + k[0].toUpperCase() + k.slice(1)].value.copy(SKY_DAY[k]).lerp(SKY_DUSK[k], d);
      }
      sun.material.color.setHex(d > 0.5 ? 0xFF9A5A : 0xFFD27A);
      glow.material.opacity = 1 - d * 0.45;
    },
    update(dt) {
      t += dt;
      // Smoke rises and drifts east, looping.
      for (const s of puffs) {
        const cyc = (t * 0.03 + s.userData.phase / 9) % 1;
        s.position.y = s.userData.baseY + cyc * 260;
        s.position.x = -1700 + (s.userData.phase % 3 - 1) * 26 + cyc * 190;
        s.material.opacity = 0.5 * (1 - cyc * 0.55);
        const w = 130 + cyc * 260;
        s.scale.set(w, w * 0.55, 1);
      }
      // Clouds drift almost imperceptibly.
      clouds.position.x = Math.sin(t * 0.004) * 60;
    },
  };
}
