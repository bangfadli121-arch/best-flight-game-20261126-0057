// rings.js — the ring-run course for MERPATI SENJA.
// One job: the sequence of gates, their glowing meshes, pass detection and
// the score. The next gate is gold and lit; later gates are cyan; passed
// gates go green and dim.

import * as THREE from 'three';

export const RING_POINTS = 100;
export const RING_TIME_BONUS_S = 12;

// Course: spawn (500,160,1500) heads north-west through these gates.
export const COURSE = [
  { x: 300,  y: 150, z: 900,  r: 15 },
  { x: -300, y: 170, z: 200,  r: 15 },
  { x: -900, y: 230, z: -500, r: 16 },
  { x: -1400, y: 310, z: -1100, r: 17 },
  { x: -600, y: 190, z: -1600, r: 15 },
  { x: 400,  y: 140, z: -900, r: 15 },
  { x: 520,  y: 62,  z: 620,  r: 14 }, // low gate over the runway
  { x: 1100, y: 170, z: 300,  r: 15 },
];

const GOLD = 0xFFB300;
const GOLD_EMISSIVE = 0xFF8F00;
const CYAN = 0x00E5FF;
const GREEN = 0x69F0AE;

function ringLabelTexture(text) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 96;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 512, 96);
  g.fillStyle = 'rgba(11,27,51,0.82)';
  g.beginPath();
  g.roundRect(6, 8, 500, 80, 18);
  g.fill();
  g.strokeStyle = '#FFC93C';
  g.lineWidth = 3;
  g.stroke();
  g.fillStyle = '#FFC93C';
  g.font = 'bold 40px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 50);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class RingCourse {
  constructor(scene) {
    this.scene = scene;
    this.index = 0;              // next ring to fly through
    this.passed = 0;
    this.group = new THREE.Group();
    this.group.name = 'rings';
    this.meshes = [];
    this.labelSprite = null;
    this.labelCanvas = null;

    COURSE.forEach((def, i) => {
      const mat = new THREE.MeshStandardMaterial({
        color: i === 0 ? GOLD : CYAN,
        emissive: i === 0 ? GOLD_EMISSIVE : CYAN,
        emissiveIntensity: i === 0 ? 1.5 : 0.55,
        metalness: 0.3,
        roughness: 0.35,
      });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(def.r, 1.1, 12, 40), mat);
      ring.position.set(def.x, def.y, def.z);
      // Face the incoming pilot: rings stand upright, turned toward the
      // previous gate so the hole is visible on approach.
      const prev = i === 0 ? { x: 500, z: 1500 } : COURSE[i - 1];
      ring.lookAt(prev.x, def.y, prev.z);
      ring.userData.def = def;
      ring.userData.index = i;
      this.group.add(ring);
      this.meshes.push(ring);

      // Chevron ticks inside the ring, pointing at the hole.
      const tickMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.85 });
      for (let k = 0; k < 3; k++) {
        const tick = new THREE.Mesh(new THREE.ConeGeometry(1.1, 3.2, 4), tickMat);
        const a = (k / 3) * Math.PI * 2;
        tick.position.set(Math.cos(a) * def.r * 0.82, Math.sin(a) * def.r * 0.82, 0);
        tick.rotation.z = a + Math.PI / 2;
        ring.add(tick);
      }
    });

    // Floating label above the next gate: "RING 3 — 168 m".
    this.labelSprite = this.makeLabelSprite('RING 1');
    this.group.add(this.labelSprite);

    // Warm glow behind the gold gate so it reads at a glance.
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.makeGlowTexture(), color: 0xFFB300, transparent: true,
      opacity: 0.55, depthWrite: false,
    }));
    this.glow.scale.set(90, 90, 1);
    this.group.add(this.glow);

    scene.add(this.group);
    this.refresh();
  }

  makeGlowTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.25)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }

  makeLabelSprite(text) {
    const tex = ringLabelTexture(text);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(46, 8.6, 1);
    return sprite;
  }

  nextDef() { return COURSE[this.index] ?? null; }

  /** Distance from the plane to the centre of the next gate. */
  distanceToNext(pos) {
    const def = this.nextDef();
    if (!def) return 0;
    return Math.hypot(def.x - pos.x, def.y - pos.y, def.z - pos.z);
  }

  /** Bearing to the next gate, degrees, 0 = north (-Z). */
  bearingToNext(pos) {
    const def = this.nextDef();
    if (!def) return 0;
    return (Math.atan2(def.x - pos.x, -(def.z - pos.z)) * 180 / Math.PI + 360) % 360;
  }

  /**
   * True when the plane threads the next gate: close to its centre and
   * crossing its plane. Returns the gate index passed, or -1.
   */
  checkPass(pos, prevPos) {
    const def = this.nextDef();
    if (!def) return -1;
    const ring = this.meshes[this.index];
    // Distance from the plane to the ring's plane, before and after the step.
    const n = new THREE.Vector3();
    ring.getWorldDirection(n); // torus faces +Z out of its hole
    const c = new THREE.Vector3(def.x, def.y, def.z);
    const dPrev = new THREE.Vector3().subVectors(prevPos, c).dot(n);
    const dNow = new THREE.Vector3().subVectors(pos, c).dot(n);
    const crossed = (dPrev > 0 && dNow <= 0) || (dPrev < 0 && dNow >= 0);
    const radial = new THREE.Vector3().subVectors(pos, c)
      .addScaledVector(n, -dNow).length();
    if (crossed && radial < def.r - 1) {
      const i = this.index;
      this.index++;
      this.passed++;
      this.refresh();
      return i;
    }
    return -1;
  }

  /** Recolour the gates and move the label + glow to the next one. */
  refresh() {
    this.meshes.forEach((ring, i) => {
      const mat = ring.material;
      if (i < this.index) {
        mat.color.setHex(GREEN);
        mat.emissive.setHex(GREEN);
        mat.emissiveIntensity = 0.25;
      } else if (i === this.index) {
        mat.color.setHex(GOLD);
        mat.emissive.setHex(GOLD_EMISSIVE);
        mat.emissiveIntensity = 1.5;
      } else {
        mat.color.setHex(CYAN);
        mat.emissive.setHex(CYAN);
        mat.emissiveIntensity = 0.55;
      }
    });
    const def = this.nextDef();
    if (def) {
      this.labelSprite.position.set(def.x, def.y + def.r + 12, def.z);
      this.glow.position.set(def.x, def.y, def.z);
      this.glow.visible = true;
    } else {
      this.labelSprite.visible = false;
      this.glow.visible = false;
    }
  }

  /** Update the floating label with the live distance, e.g. "RING 3 — 168 m". */
  updateLabel(distM) {
    if (!this.nextDef()) return;
    const text = `RING ${this.index + 1} — ${Math.round(distM)} m`;
    if (this.labelSprite.userData.text === text) return;
    this.labelSprite.userData.text = text;
    this.labelSprite.material.map.dispose();
    this.labelSprite.material.map = ringLabelTexture(text);
    this.labelSprite.material.needsUpdate = true;
  }

  update(dt, t) {
    // The gold gate pulses gently; passed gates sit still.
    const next = this.meshes[this.index];
    if (next) {
      const s = 1 + Math.sin(t * 3) * 0.03;
      next.scale.setScalar(s);
      next.material.emissiveIntensity = 1.3 + Math.sin(t * 3) * 0.35;
    }
    for (let i = 0; i < this.meshes.length; i++) {
      if (i !== this.index) this.meshes[i].scale.setScalar(1);
    }
    void dt;
  }

  reset() {
    this.index = 0;
    this.passed = 0;
    this.refresh();
  }
}
