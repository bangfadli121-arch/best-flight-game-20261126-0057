// physics.js — the arcade flight model for MERPATI SENJA.
// One job: turn pilot input + throttle into motion. Lift grows with speed
// squared, drag bleeds it, banking turns the nose, slow flight stalls, and
// the ground (or the sea) decides between a landing, a scrape and a crash.

import * as THREE from 'three';
import { terrainHeight, isOverRunway, RUNWAY } from './terrain.js';

export const MIN_FLY_SPEED = 26;   // m/s: below this the wing gives up
export const MAX_SPEED = 96;       // m/s at full throttle, level flight
export const CRUISE_SPEED = 58;    // m/s the plane settles toward

const _euler = new THREE.Euler();
const _dq = new THREE.Quaternion();
const _fwd = new THREE.Vector3();
const _up = new THREE.Vector3();

export class FlightModel {
  constructor() {
    this.reset();
  }

  reset() {
    this.pos = new THREE.Vector3(500, 160, 1500);
    // Face the first ring (north-west of the spawn).
    this.quat = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0), Math.atan2(-200, -600),
    );
    this.speed = 58;
    this.throttle = 0.62;
    this.fuel = 100;      // percent
    this.damage = 0;      // percent; 100 = wrecked
    this.state = 'flying'; // flying | crashed | landed | timeup
    this.crashReason = '';
    this.verticalSpeed = 0;
    this.gForce = 1;
  }

  /** Current forward direction (local +Z through the orientation). */
  forward(out = _fwd) {
    return out.set(0, 0, 1).applyQuaternion(this.quat);
  }

  /** Pitch in degrees, positive = nose up. */
  pitchDeg() {
    const f = this.forward(new THREE.Vector3());
    return Math.asin(Math.max(-1, Math.min(1, f.y))) * 180 / Math.PI;
  }

  /** Roll in degrees, positive = right wing down. */
  rollDeg() {
    const f = this.forward(new THREE.Vector3());
    const u = _up.set(0, 1, 0).applyQuaternion(this.quat);
    // Horizontal right for the current heading: up x forward.
    const rw = new THREE.Vector3(0, 1, 0).cross(f).normalize();
    return Math.atan2(u.dot(rw), u.y) * 180 / Math.PI;
  }

  /** Heading in degrees, 0 = north (-Z), 90 = east (+X). */
  headingDeg() {
    const f = this.forward(new THREE.Vector3());
    return (Math.atan2(f.x, -f.z) * 180 / Math.PI + 360) % 360;
  }

  update(dt, input) {
    if (this.state !== 'flying') return;
    dt = Math.min(dt, 0.05);

    // --- throttle & fuel -------------------------------------------------
    if (this.fuel <= 0) this.throttle = 0;
    else this.throttle = Math.max(0, Math.min(1, this.throttle + input.throttle * dt * 0.55));
    this.fuel = Math.max(0, this.fuel - dt * (0.16 + this.throttle * 0.85));

    // --- speed: thrust pulls toward a throttle-set target, climb bleeds it
    const target = 20 + this.throttle * (MAX_SPEED - 20);
    const fwd = this.forward(new THREE.Vector3());
    this.speed += (target - this.speed) * Math.min(1, dt * 0.45);
    this.speed -= fwd.y * 9.8 * dt * 0.55; // climbing costs speed
    this.speed = Math.max(8, this.speed);

    // --- attitude: pitch / roll / coordinated turn -----------------------
    // Bank angle drives the turn (coordinated): right wing down turns right.
    const rollRad = this.rollDeg() * Math.PI / 180;
    const agility = 0.45 + Math.min(1, this.speed / 70) * 0.55;
    const pitchRate = input.pitch * 0.6 * agility;
    let rollRate = input.roll * 1.0 * agility;
    // Do not keep rolling past ~66 degrees of bank.
    if (input.roll !== 0 && Math.sign(input.roll) === Math.sign(rollRad) && Math.abs(rollRad) > 1.15) {
      rollRate *= 0.1;
    }
    const yawRate = -Math.sin(rollRad) * 0.55 * Math.min(1, this.speed / 55)
      + input.yaw * 0.3 * agility;
    _euler.set(pitchRate * dt, yawRate * dt, -rollRate * dt, 'YXZ');
    _dq.setFromEuler(_euler);
    this.quat.multiply(_dq).normalize();

    // Gentle auto-level: slerp toward the same heading and pitch with
    // wings flat when the pilot is not banking.
    if (Math.abs(input.roll) < 0.05) {
      const f = this.forward(new THREE.Vector3());
      const upLevel = new THREE.Vector3(0, 1, 0).addScaledVector(f, -f.y).normalize();
      const right = new THREE.Vector3().crossVectors(upLevel, f).normalize();
      const m = new THREE.Matrix4().makeBasis(right, upLevel, f);
      const levelQuat = new THREE.Quaternion().setFromRotationMatrix(m);
      this.quat.slerp(levelQuat, Math.min(1, 0.35 * dt));
    }

    // --- motion -----------------------------------------------------------
    const stalled = this.speed < MIN_FLY_SPEED;
    const prevY = this.pos.y;
    this.pos.addScaledVector(fwd, this.speed * dt);
    if (stalled) {
      // The wing quits: sink and drop the nose (positive X tips it down).
      this.pos.y -= (MIN_FLY_SPEED - this.speed) * 0.9 * dt;
      _euler.set(0.5 * dt, 0, 0, 'YXZ');
      _dq.setFromEuler(_euler);
      this.quat.multiply(_dq).normalize();
    }
    this.verticalSpeed = (this.pos.y - prevY) / dt;
    this.gForce = 1 + Math.abs(input.roll) * 0.4;

    // --- ground / sea -----------------------------------------------------
    const ground = terrainHeight(this.pos.x, this.pos.z);
    const overSea = ground <= 0.5;
    if (overSea) {
      // The sea surface sits at y ~ 0.4; touching it is a ditching.
      if (this.pos.y < 1.2) this.crash('DITCHED IN THE SEA');
      return;
    }
    const clearance = this.pos.y - ground;
    if (clearance < 1.6) {
      const onRunway = isOverRunway(this.pos.x, this.pos.z);
      const gentle = Math.abs(this.verticalSpeed) < 6 && this.speed < 58
        && Math.abs(this.pitchDeg()) < 12 && Math.abs(this.rollDeg()) < 20;
      if (onRunway && gentle && this.state === 'flying') {
        this.pos.y = RUNWAY.height + 1.6;
        this.state = 'landed';
      } else if (Math.abs(this.verticalSpeed) < 9 && this.speed < 48) {
        // A hard scrape: damage and a bounce, not yet a wreck. The bounce
        // kicks the nose up so a quick pilot can climb away from it.
        this.damage += 30;
        this.pos.y = ground + 3;
        this.speed *= 0.55;
        _euler.set(-0.25, 0, 0, 'YXZ');
        _dq.setFromEuler(_euler);
        this.quat.multiply(_dq).normalize();
        if (this.damage >= 100) this.crash('TERRAIN IMPACT');
      } else {
        this.crash('TERRAIN IMPACT');
      }
    }
    // World edge: turn the plane back gently instead of flying into void.
    const r = Math.hypot(this.pos.x, this.pos.z);
    if (r > 4200) {
      const back = Math.atan2(-this.pos.x, -this.pos.z);
      const cur = this.headingDeg() * Math.PI / 180;
      let diff = back - cur;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      _euler.set(0, diff * 0.5 * dt, 0, 'YXZ');
      _dq.setFromEuler(_euler);
      this.quat.multiply(_dq).normalize();
    }
  }

  crash(reason) {
    this.state = 'crashed';
    this.crashReason = reason;
    this.damage = 100;
  }
}
