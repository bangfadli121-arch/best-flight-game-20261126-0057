// main.js — MERPATI SENJA: VOLCANIC ISLAND RUN.
// One job: wire the modules together. Renderer + chase camera + input +
// game state (score, time, crash, landing) + the render loop. The game
// starts flying at once: no title screen, the first frame is gameplay.

import * as THREE from 'three';
import { buildTerrain, terrainHeight, RUNWAY } from './terrain.js';
import { buildSky } from './sky.js';
import { buildAircraft } from './aircraft.js';
import { FlightModel } from './physics.js';
import { RingCourse, RING_POINTS, RING_TIME_BONUS_S, COURSE } from './rings.js';
import { Hud } from './hud.js';
import { FlightAudio } from './audio.js';

const params = new URLSearchParams(location.search);
const SHOT = Number(params.get('shot') || 0);

// Staged poses for the four screenshots: real game states, frozen in place
// so the composition is exactly the one the maker chose.
const SHOTS = {
  1: { pos: [312, 152, 965], yaw: -2.96, roll: 0, ring: 0, dusk: 0.12, score: 0, time: 240, fuel: 100 },
  2: { pos: [300, 95, 620], yaw: Math.PI / 2, roll: 0, ring: 6, dusk: 0.15, score: 600, time: 198, fuel: 78 },
  3: { pos: [-500, 215, -200], yaw: -Math.PI / 2, roll: -0.61, ring: 1, dusk: 0.25, score: 100, time: 228, fuel: 92 },
  4: { pos: [-800, 275, -300], yaw: -2.50, roll: 0, ring: 3, dusk: 0.8, score: 300, time: 204, fuel: 85 },
};

// ------------------------------------------------------------------ setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
document.getElementById('gl').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x7A3B5C, 1500, 7500);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 20000);
camera.position.set(500, 170, 1520);

const sky = buildSky(scene);
const sunLight = new THREE.DirectionalLight(0xFFB36B, 3.0);
sunLight.position.copy(sky.sunDir).multiplyScalar(5000);
scene.add(sunLight);
// Cool fill from the east so the plane and the ground never go black.
const fillLight = new THREE.DirectionalLight(0x9DB8FF, 0.55);
fillLight.position.set(3000, 2200, 3000);
scene.add(fillLight);
scene.add(new THREE.HemisphereLight(0x7B2D8B, 0x0E3A3A, 1.25));

buildTerrain(scene);
const aircraft = buildAircraft();
scene.add(aircraft.group);
const model = new FlightModel();
const rings = new RingCourse(scene);
const audio = new FlightAudio();

const hudCanvas = document.getElementById('hud');
const hud = new Hud(hudCanvas);

// ------------------------------------------------------------------ state
let score = 0;
let timeLeft = 240;
let paused = false;
let hintT = 8;
let shake = 0;
let explosion = null;
const staging = SHOTS[SHOT] !== undefined;

if (staging) {
  const st = SHOTS[SHOT];
  model.pos.set(st.pos[0], st.pos[1], st.pos[2]);
  model.quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), st.yaw);
  if (st.roll) {
    const qz = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, st.roll, 'YXZ'));
    model.quat.multiply(qz);
  }
  model.speed = 58;
  model.throttle = 0.62;
  model.fuel = st.fuel;
  rings.index = st.ring;
  rings.passed = st.ring;
  rings.refresh();
  score = st.score;
  timeLeft = st.time;
  sky.setDusk(st.dusk);
  hintT = 0;
} else {
  sky.setDusk(0.12);
}

// Test hook: Playwright reads this to prove the game runs and scores.
// THREE is exposed here only so probes can build quaternions/vectors.
window.__flightGame = {
  model, rings, THREE,
  get score() { return score; },
  get timeLeft() { return timeLeft; },
  get state() { return model.state; },
  errors: [],
};
window.addEventListener('error', (e) => window.__flightGame.errors.push(String(e.message)));

// ------------------------------------------------------------------ input
const keys = new Set();
const input = { pitch: 0, roll: 0, yaw: 0, throttle: 0 };

function readInput() {
  input.pitch = (keys.has('ArrowDown') ? 1 : 0) - (keys.has('ArrowUp') ? 1 : 0);
  input.roll = (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0);
  input.yaw = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
  input.throttle = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
  if (keys.has('ShiftLeft') || keys.has('ShiftRight')) input.throttle = 1;
  if (keys.has('ControlLeft') || keys.has('ControlRight')) input.throttle = -1;
}

window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  audio.ensure();
  keys.add(e.code);
  if (e.code === 'KeyR') restartSortie();
  if (e.code === 'KeyP') paused = !paused;
  if (e.code === 'KeyM') audio.setMuted(!audio.muted);
  if (e.code === 'KeyT') takeoff();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('pointerdown', () => audio.ensure());
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  hud.resize();
});

function restartSortie() {
  model.reset();
  rings.reset();
  score = 0;
  timeLeft = 240;
  paused = false;
  hintT = 8;
  clearExplosion();
}

function takeoff() {
  if (model.state !== 'landed') return;
  model.state = 'flying';
  model.pos.set(RUNWAY.x - 180, RUNWAY.height + 2, RUNWAY.z);
  model.quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
  model.speed = 45;
  model.throttle = 0.75;
}

// ------------------------------------------------------------------ crash fx
function spawnExplosion(pos) {
  clearExplosion();
  const g = new THREE.Group();
  g.name = 'explosion';
  const mats = [0xFF6D00, 0xFFB300, 0xFF5252, 0xFFE082].map(
    (c) => new THREE.MeshBasicMaterial({ color: c, transparent: true }),
  );
  const parts = [];
  for (let i = 0; i < 16; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.8 + Math.random() * 1.6, 8, 6), mats[i % mats.length]);
    m.position.copy(pos);
    m.userData.vel = new THREE.Vector3(
      (Math.random() - 0.5) * 26, Math.random() * 18 + 4, (Math.random() - 0.5) * 26,
    );
    parts.push(m);
    g.add(m);
  }
  const smokeMat = new THREE.MeshBasicMaterial({ color: 0x555555, transparent: true, opacity: 0.7 });
  const smokes = [];
  for (let i = 0; i < 7; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(2.5 + Math.random() * 2, 8, 6), smokeMat.clone());
    s.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4));
    s.userData.vel = new THREE.Vector3((Math.random() - 0.5) * 4, 3 + Math.random() * 4, (Math.random() - 0.5) * 4);
    smokes.push(s);
    g.add(s);
  }
  scene.add(g);
  explosion = { group: g, parts, smokes, age: 0 };
}

function clearExplosion() {
  if (!explosion) return;
  scene.remove(explosion.group);
  explosion = null;
}

// ------------------------------------------------------------------ camera
const camPos = new THREE.Vector3(500, 170, 1520);
const camTarget = new THREE.Vector3(500, 160, 1500);
const _off = new THREE.Vector3();
const _look = new THREE.Vector3();

function updateCamera(dt) {
  _off.set(0, 3.4, -19).applyQuaternion(model.quat).add(model.pos);
  _look.set(0, 1.8, 14).applyQuaternion(model.quat).add(model.pos);
  // Staged shots snap the camera at once: a lerped camera never converges
  // in a slow headless renderer before the screenshot is taken.
  const k = staging ? 1 : 1 - Math.exp(-6 * dt);
  camPos.lerp(_off, k);
  camTarget.lerp(_look, k);
  camera.position.copy(camPos);
  if (shake > 0) {
    camera.position.x += (Math.random() - 0.5) * shake;
    camera.position.y += (Math.random() - 0.5) * shake;
    shake = Math.max(0, shake - dt * 2.2);
  }
  camera.up.set(0, 1, 0);
  camera.lookAt(camTarget);
  // Lean the camera a little with the bank so turns feel flown, not cut.
  camera.rotateZ(model.rollDeg() * Math.PI / 180 * 0.3);
}

// ------------------------------------------------------------------ HUD state
function hudState() {
  const def = rings.nextDef();
  const dist = def ? rings.distanceToNext(model.pos) : 0;
  let message = '', subMessage = '', messageColor = '#FFC93C';
  if (model.state === 'crashed') {
    message = `CRASHED — ${model.crashReason}`;
    subMessage = `Score ${score} · Rings ${rings.passed}/${COURSE.length} · Press R to fly again`;
    messageColor = '#FF5252';
  } else if (model.state === 'landed') {
    message = 'LANDED +250';
    subMessage = 'Fuel restored · Press T to take off · R to restart the sortie';
    messageColor = '#69F0AE';
  } else if (model.state === 'timeup') {
    message = 'TIME UP';
    subMessage = `Score ${score} · Rings ${rings.passed}/${COURSE.length} · Press R to fly again`;
  } else if (model.state === 'complete') {
    message = 'COURSE COMPLETE! +500';
    subMessage = `Final score ${score} · Press R to fly again`;
    messageColor = '#69F0AE';
  }
  return {
    alt: Math.max(0, model.pos.y),
    speedKmh: model.speed * 3.6,
    heading: model.headingDeg(),
    score,
    ringsPassed: rings.passed,
    ringsTotal: COURSE.length,
    timeLeft: Math.max(0, timeLeft),
    throttle: model.throttle,
    fuel: model.fuel,
    damage: model.damage,
    pitch: model.pitchDeg(),
    roll: model.rollDeg(),
    nextRingLabel: def ? `RING ${rings.index + 1} AHEAD — thread the gold gate` : '',
    nextRingBearing: def ? rings.bearingToNext(model.pos) : 0,
    planeX: model.pos.x,
    planeZ: model.pos.z,
    hint: hintT > 0 && !staging
      ? 'W/S throttle · ↑↓ pitch · ←→ bank · A/D rudder · R restart · P pause · M mute'
      : '',
    message, subMessage, messageColor,
  };
}

// ------------------------------------------------------------------ loop
const clock = new THREE.Clock();
let elapsed = 0;

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;

  if (!staging && !paused) {
    readInput();
    const prevPos = model.pos.clone();
    const prevState = model.state;
    model.update(dt, input);
    // Ring pass.
    if (model.state === 'flying') {
      const passed = rings.checkPass(model.pos, prevPos);
      if (passed >= 0) {
        score += RING_POINTS;
        timeLeft += RING_TIME_BONUS_S;
        audio.chime();
        if (rings.passed >= COURSE.length) {
          score += 500;
          model.state = 'complete';
        }
      }
      timeLeft -= dt;
      if (timeLeft <= 0 && model.state === 'flying') {
        timeLeft = 0;
        model.state = 'timeup';
      }
    }
    // Landing / crash transitions.
    if (prevState === 'flying' && model.state === 'landed') {
      score += 250;
      model.fuel = 100;
      model.damage = Math.max(0, model.damage - 20);
    }
    if (prevState === 'flying' && model.state === 'crashed') {
      audio.crash();
      spawnExplosion(model.pos);
      shake = 1.6;
    }
    if (hintT > 0) hintT -= dt;
    audio.update(model.throttle, model.speed, model.state === 'flying');
  }

  // Keep the aircraft mesh on the flight model.
  aircraft.group.position.copy(model.pos);
  aircraft.group.quaternion.copy(model.quat);
  aircraft.spinProp(dt, staging ? 0.6 : model.throttle);

  // Ambient motion: clouds, smoke, ring pulse, label distance.
  sky.update(dt);
  rings.update(dt, elapsed);
  const def = rings.nextDef();
  if (def) rings.updateLabel(rings.distanceToNext(model.pos));
  if (explosion) {
    explosion.age += dt;
    for (const p of explosion.parts) {
      p.position.addScaledVector(p.userData.vel, dt);
      p.userData.vel.y -= 12 * dt;
      p.material.opacity = Math.max(0, 1 - explosion.age / 1.6);
    }
    for (const s of explosion.smokes) {
      s.position.addScaledVector(s.userData.vel, dt);
      s.scale.multiplyScalar(1 + dt * 0.9);
      s.material.opacity = Math.max(0, 0.7 - explosion.age / 3.5);
    }
    if (explosion.age > 3.5) clearExplosion();
  }

  updateCamera(staging ? 0.016 : dt);
  hud.draw(hudState());
  renderer.render(scene, camera);
}

frame();
