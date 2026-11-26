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
  // Jet cruise at 900 km/h with the burners lit for the cover: gold gate
  // ahead, terraces + village + volcano behind it.
  1: { pos: [312, 152, 965], yaw: -2.96, roll: 0, ring: 0, dusk: 0.12, score: 0, time: 240, fuel: 100, speed: 250, throttle: 0.95, ab: true, cam: 0.82, lookY: 0.0 },
  // Shot 2: runway approach from the NORTH-WEST, 260 m out, heading
  // south-east at the low gate. The old head-on pose from the west put
  // the gate edge-on to the camera (the ring faces the previous gate,
  // north), so only its label showed. From the north-west the gold ring
  // reads as a glowing ellipse ahead of the plane, the runway leads to
  // it, and the village sits left of the strip — the label stays in the
  // sky, the plane stays below and behind the gate, never inside it.
  // Jet approach speed: 95 m/s (~340 km/h), burners off.
  2: { pos: [350, 80, 820], yaw: 2.44, roll: 0, ring: 6, dusk: 0.15, score: 600, time: 198, fuel: 78, speed: 95, throttle: 0.45, ab: false },
  // Shot 3: banking turn toward the sun, yawed a touch south of due west
  // so the sea glint sits left of centre instead of straight down the
  // middle of the frame. Burners lit on the bank. v8 (ref 08): yawed a
  // little more toward the sun and flown lower, so the glitter field
  // fills the lower frame like the Ace Combat shot.
  3: { pos: [-520, 190, -180], yaw: -1.38, roll: -0.68, ring: 1, dusk: 0.25, score: 100, time: 228, fuel: 92, speed: 250, throttle: 0.9, ab: true },
  // Shot 4: 200 m from ring 3 (-1400, 310, -1100) down its course leg,
  // instead of 1000 m away — the gold gate is full-size in frame with
  // the snowy volcano cone right behind it.
  4: { pos: [-1272, 305, -946], yaw: -2.45, roll: 0, ring: 3, dusk: 0.8, score: 300, time: 204, fuel: 85, speed: 250, throttle: 0.8, ab: false },
};

const stagedShot = SHOTS[SHOT];

// ------------------------------------------------------------------ setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.22; // v18: brighter for the silver jet
renderer.outputColorSpace = THREE.SRGBColorSpace;
// Soft shadows: the sun throws the plane's shadow onto the terrain below.
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('gl').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x8A4A5A, 1500, 7500);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 20000);
camera.position.set(500, 170, 1520);

const sky = buildSky(scene);
// v8 light rebalance — the v7 defect was a GOLD jet: sun 0xFFB36B at 3.0
// plus a warm-pink hemisphere at 1.45 flooded every top surface with
// orange. Now the sun is cooler and weaker, the hemisphere is cool
// steel-blue, and a dedicated cool top fill keeps the Raptor grey
// (ref 02) while the warm fill still rims the edges (ref 03/08).
const sunLight = new THREE.DirectionalLight(0xFFC08A, 2.7); // v17: stronger warm sun for the AC7 sunlit jet
sunLight.position.copy(sky.sunDir).multiplyScalar(5000);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.left = -320;
sunLight.shadow.camera.right = 320;
sunLight.shadow.camera.top = 320;
sunLight.shadow.camera.bottom = -320;
sunLight.shadow.camera.near = 50;
sunLight.shadow.camera.far = 2600;
sunLight.shadow.bias = -0.0004;
sunLight.shadow.normalBias = 1.5;
scene.add(sunLight);
scene.add(sunLight.target);
// Warm sunset bounce from the east (ref 03/08): the low western sun
// leaves the jet's rear in shadow from the chase camera, so this low
// warm fill rims the wings, tails and fuselage in orange — the jet
// reads as a lit Raptor instead of a black blob. Kept at 0.5: it is a
// rim, not a flood; a flood is what turned the top skin gold in v7.
const fillLight = new THREE.DirectionalLight(0xFF7A3D, 0.9); // v18: stronger warm rim
fillLight.position.set(4000, 1200, 2000);
scene.add(fillLight);
// Cool sky fill from above-east: the counterweight to the warm sun.
// Without it the light-grey top skin has no cool light to answer with
// and reads gold; with it the top stays grey (ref 02) in the sunset.
const skyFill = new THREE.DirectionalLight(0xB9CCE8, 0.7); // v18: stronger cool top fill — the silver top needs cool light to stay silver, not gold
skyFill.position.set(2000, 4200, -1500);
scene.add(skyFill);
// v19 camera key light: a warm directional that always shines from the
// chase camera's side onto the jet. The low western sun leaves the rear
// in shadow from the chase camera on north/east-bound shots (the v17
// "dark jet": the camera sits on the shadow side, and the chase-fill
// point light sat below-behind and lit the belly). This light tracks the
// camera, so the camera-facing flank + top are always lit silver-gold
// like fadli-15a, whatever the heading. No shadows: it is a fill, not
// a second sun. v19: 0.85 (was 1.0) — the v18 banking flank blew out
// to near-white under the old level.
const camLight = new THREE.DirectionalLight(0xFFD9A8, 0.85);
scene.add(camLight);
scene.add(camLight.target);
scene.add(new THREE.HemisphereLight(0x93A7C9, 0x1E3A34, 1.45));

buildTerrain(scene);
// v19: procedural sunset ENVIRONMENT MAP for the jet's metal. Baked once
// from a tiny dedicated scene (gradient sky + sun disc + dark sea) —
// no external assets, fully offline. The aircraft's standard materials
// use it as envMap, so the silver skin REFLECTS the sunset instead of
// rendering as flat matte white (the v18 "cardboard" defect: metalness
// with nothing to reflect has no tonal variation). The env is applied
// per-material on the aircraft only — terrain, rings and sky are
// untouched.
const pmrem = new THREE.PMREMGenerator(renderer);
const envScene = new THREE.Scene();
{
  const envSky = new THREE.Mesh(
    new THREE.SphereGeometry(100, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        varying vec3 vDir;
        void main() {
          float h = clamp(vDir.y, -1.0, 1.0);
          vec3 below = vec3(0.05, 0.16, 0.20);
          vec3 hor = vec3(1.0, 0.45, 0.16);
          // v19b: desaturated mid/top — the purple mid (0.45,0.16,0.45)
          // tinted the whole jet lavender-pink; a grey-mauve mid keeps
          // the metal SILVER-grey with a warm sunset sheen (fadli-15b).
          vec3 mid = vec3(0.32, 0.20, 0.38);
          vec3 top = vec3(0.10, 0.14, 0.28);
          vec3 col = h < 0.0 ? mix(hor, below, clamp(-h * 3.0, 0.0, 1.0))
                             : mix(hor, mid, smoothstep(0.0, 0.35, h));
          col = mix(col, top, smoothstep(0.35, 1.0, h));
          gl_FragColor = vec4(col, 1.0);
        }`,
    }),
  );
  envScene.add(envSky);
  const envSun = new THREE.Mesh(
    new THREE.CircleGeometry(18, 24),
    new THREE.MeshBasicMaterial({ color: 0xFFE8B0 }),
  );
  envSun.position.copy(sky.sunDir).multiplyScalar(90);
  envSun.lookAt(0, 0, 0);
  envScene.add(envSun);
}
const envTex = pmrem.fromScene(envScene, 0.04, 0.1, 200).texture;
pmrem.dispose();
const aircraft = buildAircraft(envTex);
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
  const st = stagedShot;
  model.pos.set(st.pos[0], st.pos[1], st.pos[2]);
  model.quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), st.yaw);
  if (st.roll) {
    const qz = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, st.roll, 'YXZ'));
    model.quat.multiply(qz);
  }
  model.speed = st.speed ?? 250;
  model.throttle = st.throttle ?? 0.62;
  // The HUD's AB badge reads model.afterburner, which update() sets in
  // live play — but staged shots never run update(), so set it here.
  model.afterburner = !!st.ab;
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
  model.speed = 95; // jet rotation speed
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
  // Chase cam (v17, fadli-15a AC7): 3/4 from behind-above-LEFT — the
  // dead-behind angle is the ugliest for any jet, and AC7's chase cam
  // sits off to the side so you see the sunlit flank + top. Same ~18 m
  // distance, so the jet stays the same size in frame; only the angle
  // changes. Left side because the low western sun lights the left
  // flank on the north/west-bound shots.
  // v18: the cover shot pulls the camera closer (cam 0.82) so the jet is
  // big and dominant in frame like the AC7 jet; other shots keep v17.
  // v18b: cam was 0.72 and the tail/nozzles slid behind the bottom HUD —
  // 0.82 backs off a touch. lookY 3.2 was tried first and pushed the jet
  // DOWN (looking higher moves the subject lower); lookY 0.0 looks at
  // the jet's centreline, lifting the tail clear of the HUD.
  const camScale = staging && stagedShot.cam ? stagedShot.cam : 1;
  const lookY = staging && stagedShot.lookY !== undefined ? stagedShot.lookY : 2.0;
  _off.set(-6.0 * camScale, 5.0 * camScale, -16.5 * camScale).applyQuaternion(model.quat).add(model.pos);
  _look.set(0, lookY, 16).applyQuaternion(model.quat).add(model.pos);
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
    afterburner: model.afterburner,
    pitch: model.pitchDeg(),
    roll: model.rollDeg(),
    vspeed: model.verticalSpeed,
    nextRingLabel: def ? `RING ${rings.index + 1} AHEAD — thread the gold gate` : '',
    nextRingBearing: def ? rings.bearingToNext(model.pos) : 0,
    planeX: model.pos.x,
    planeZ: model.pos.z,
    hint: hintT > 0 && !staging
      ? 'W/S throttle · Shift afterburner · ↑↓ pitch · ←→ bank · A/D rudder · R restart · P pause · M mute'
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
  // Afterburner: staged shots use their staged flag; live play lights it
  // past 85% throttle.
  aircraft.setAfterburner(
    staging ? !!stagedShot.ab : (model.state === 'flying' && model.throttle > 0.85),
    dt,
  );

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
  // Keep the shadow frustum centred on the plane: the sun is far away,
  // so the light and its target both track the aircraft.
  sunLight.position.copy(model.pos).addScaledVector(sky.sunDir, 900);
  sunLight.target.position.copy(model.pos);
  sunLight.target.updateMatrixWorld();
  // v18: camera key light tracks the chase camera, so it always shines
  // from the camera side onto the jet.
  camLight.position.copy(camera.position);
  camLight.target.position.copy(model.pos);
  camLight.target.updateMatrixWorld();
  hud.draw(hudState());
  renderer.render(scene, camera);
}

frame();
