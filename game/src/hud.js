// hud.js — the glass-cockpit overlay for MERPATI SENJA.
// One job: draw every instrument on a full-screen 2D canvas each frame.
// Glass-cockpit style: layered panels with depth (gradient, inner
// highlight, gold edge glow), lit needles and numbers, a realistic
// attitude indicator, and a real moving map — the island coastlines are
// sampled from the terrain itself, centred on the plane, north-up, with
// the course, numbered gates and a bearing line to the next gate.

import { ISLANDS, RUNWAY, terrainHeight } from './terrain.js';
import { COURSE } from './rings.js';

const GOLD = '#FFC93C';
const WHITE = '#F5F5F5';
const DIM = 'rgba(245,245,245,0.62)';
const RED = '#FF5252';
const GREEN = '#69F0AE';
const CYAN = '#00E5FF';

// The moving-map base: a 400x400 image of the whole world, sampled from
// the terrain height function once. Sea is deep navy, sand rims the
// coast, land is green by height. The per-frame map draws a window of
// this image centred on the plane, so the coastlines are the real ones.
const MAP_PX = 400;
const MAP_WORLD = 6000;
const MAP_WINDOW_M = 2400; // metres across the panel

function buildMapBase() {
  const c = document.createElement('canvas');
  c.width = MAP_PX; c.height = MAP_PX;
  const g = c.getContext('2d');
  const img = g.createImageData(MAP_PX, MAP_PX);
  const d = img.data;
  for (let iz = 0; iz < MAP_PX; iz++) {
    const z = -MAP_WORLD / 2 + (iz + 0.5) * (MAP_WORLD / MAP_PX);
    for (let ix = 0; ix < MAP_PX; ix++) {
      const x = -MAP_WORLD / 2 + (ix + 0.5) * (MAP_WORLD / MAP_PX);
      const h = terrainHeight(x, z);
      const i = (iz * MAP_PX + ix) * 4;
      if (h <= 0.5) {
        d[i] = 13; d[i + 1] = 44; d[i + 2] = 72; d[i + 3] = 255;
      } else if (h < 4) {
        d[i] = 216; d[i + 1] = 198; d[i + 2] = 144; d[i + 3] = 255;
      } else if (h > 200) {
        d[i] = 109; d[i + 1] = 76; d[i + 2] = 65; d[i + 3] = 255;
      } else {
        const t = Math.min(1, h / 150);
        d[i] = Math.round(46 + (111 - 46) * t);
        d[i + 1] = Math.round(125 + (168 - 125) * t);
        d[i + 2] = Math.round(50 + (79 - 50) * t);
        d[i + 3] = 255;
      }
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

export class Hud {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.mapBase = buildMapBase();
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth, h = window.innerHeight;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = w; this.h = h;
    // Scale factor against the 1280x720 reference layout.
    this.s = Math.min(w / 1280, h / 720);
  }

  // ---- glass primitives -------------------------------------------------
  /** Layered glass panel: dark gradient, gold edge with glow, top highlight. */
  panel(x, y, w, h, r = 12) {
    const g = this.ctx;
    g.save();
    g.shadowColor = 'rgba(255,201,60,0.4)';
    g.shadowBlur = 10;
    const grad = g.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, 'rgba(30,52,90,0.92)');
    grad.addColorStop(0.5, 'rgba(11,27,51,0.88)');
    grad.addColorStop(1, 'rgba(6,14,28,0.92)');
    g.fillStyle = grad;
    g.strokeStyle = 'rgba(255,201,60,0.6)';
    g.lineWidth = 1.2;
    g.beginPath();
    g.roundRect(x, y, w, h, r);
    g.fill();
    g.stroke();
    g.restore();
    // Inner top highlight: the glass edge catching the sunset.
    g.save();
    g.beginPath();
    g.roundRect(x + 1.5, y + 1.5, w - 3, h - 3, r - 1.5);
    g.clip();
    g.strokeStyle = 'rgba(255,255,255,0.22)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x + 8, y + 2);
    g.lineTo(x + w - 8, y + 2);
    g.stroke();
    g.restore();
  }

  label(x, y, text, size = 11, color = DIM) {
    const g = this.ctx;
    g.fillStyle = color;
    g.font = `600 ${size}px system-ui, sans-serif`;
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    g.fillText(text, x, y);
  }

  /** Gold value with a soft glow, as if the digits were lit. */
  value(x, y, text, size = 24, color = GOLD) {
    const g = this.ctx;
    g.save();
    g.shadowColor = color;
    g.shadowBlur = 9;
    g.fillStyle = color;
    g.font = `800 ${size}px system-ui, sans-serif`;
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    g.fillText(text, x, y);
    g.restore();
  }

  bar(x, y, w, h, frac, color, bg = 'rgba(255,255,255,0.14)') {
    const g = this.ctx;
    g.fillStyle = bg;
    g.beginPath();
    g.roundRect(x, y, w, h, h / 2);
    g.fill();
    const fw = Math.max(0, Math.min(1, frac)) * w;
    if (fw > 1) {
      g.save();
      g.shadowColor = color;
      g.shadowBlur = 7;
      const grad = g.createLinearGradient(x, y, x + w, y);
      grad.addColorStop(0, color);
      grad.addColorStop(1, '#FFE082');
      g.fillStyle = grad;
      g.beginPath();
      g.roundRect(x, y, fw, h, h / 2);
      g.fill();
      g.restore();
    }
  }

  /** Round glass gauge: lit face, glowing needle, gold value arc. */
  dial(cx, cy, r, frac, text, labelText) {
    const g = this.ctx;
    const f = Math.max(0, Math.min(1, frac));
    // Glass face.
    g.save();
    g.shadowColor = 'rgba(255,201,60,0.35)';
    g.shadowBlur = 8;
    const face = g.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
    face.addColorStop(0, '#223A61');
    face.addColorStop(0.7, '#0B1B33');
    face.addColorStop(1, '#050D1A');
    g.fillStyle = face;
    g.strokeStyle = 'rgba(255,201,60,0.6)';
    g.lineWidth = 1.2;
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.restore();
    // Gold value arc.
    g.save();
    g.shadowColor = GOLD;
    g.shadowBlur = 6;
    g.strokeStyle = GOLD;
    g.lineWidth = 3;
    g.beginPath();
    g.arc(cx, cy, r - 5, Math.PI * 0.75, Math.PI * 0.75 + f * Math.PI * 1.5);
    g.stroke();
    g.restore();
    // Tick ring.
    g.strokeStyle = 'rgba(245,245,245,0.4)';
    g.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
      const x1 = cx + Math.cos(a) * (r - 9), y1 = cy + Math.sin(a) * (r - 9);
      const x2 = cx + Math.cos(a) * (r - 14), y2 = cy + Math.sin(a) * (r - 14);
      g.beginPath();
      g.moveTo(x1, y1); g.lineTo(x2, y2);
      g.stroke();
    }
    // Glowing needle.
    const a = Math.PI * 0.75 + f * Math.PI * 1.5;
    g.save();
    g.shadowColor = GOLD;
    g.shadowBlur = 8;
    g.strokeStyle = GOLD;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(a) * (r - 16), cy + Math.sin(a) * (r - 16));
    g.stroke();
    g.fillStyle = GOLD;
    g.beginPath();
    g.arc(cx, cy, 3.5, 0, Math.PI * 2);
    g.fill();
    g.restore();
    // Digital readout.
    g.save();
    g.shadowColor = GOLD;
    g.shadowBlur = 6;
    g.fillStyle = WHITE;
    g.font = `800 ${Math.round(r * 0.34)}px system-ui, sans-serif`;
    g.textAlign = 'center';
    g.fillText(text, cx, cy + r * 0.52);
    g.restore();
    g.fillStyle = DIM;
    g.font = `600 ${Math.round(r * 0.2)}px system-ui, sans-serif`;
    g.fillText(labelText, cx, cy + r + 16);
  }

  drawCompass(cx, y, w, heading) {
    const g = this.ctx;
    const s = this.s;
    this.panel(cx - w / 2, y, w, 34 * s + 8, 8);
    g.save();
    g.beginPath();
    g.roundRect(cx - w / 2, y, w, 34 * s + 8, 8);
    g.clip();
    const pxPerDeg = (w / 120); // 120 degrees visible
    const cardinals = [[0, 'N'], [45, 'NE'], [90, 'E'], [135, 'SE'], [180, 'S'], [225, 'SW'], [270, 'W'], [315, 'NW']];
    for (let d = -60; d <= 60; d += 5) {
      let deg = Math.round(heading + d);
      deg = ((deg % 360) + 360) % 360;
      const x = cx + d * pxPerDeg;
      const major = deg % 45 === 0;
      const mid = deg % 15 === 0;
      g.strokeStyle = major ? GOLD : 'rgba(245,245,245,0.5)';
      g.lineWidth = major ? 2 : 1;
      g.beginPath();
      g.moveTo(x, y + 8);
      g.lineTo(x, y + (major ? 22 : mid ? 18 : 14));
      g.stroke();
    }
    // Labels from the ABSOLUTE 15/45-degree grid: the relative tick grid
    // only lands on a multiple of 15 when the heading is a multiple of 5,
    // which left the tape blank at headings like 323 degrees.
    for (let deg0 = Math.floor((heading - 60) / 15) * 15; deg0 <= heading + 60; deg0 += 15) {
      const deg = ((deg0 % 360) + 360) % 360;
      const d = ((deg0 - heading + 540) % 360) - 180;
      const x = cx + d * pxPerDeg;
      const major = deg % 45 === 0;
      const c = cardinals.find(([v]) => v === deg);
      g.fillStyle = major ? GOLD : 'rgba(245,245,245,0.85)';
      g.font = `700 ${major ? 12 * s + 3 : 10 * s + 2}px system-ui, sans-serif`;
      g.textAlign = 'center';
      g.fillText(c ? c[1] : String(deg).padStart(3, '0'), x, y + 34 * s + 2);
    }
    g.restore();
    // Centre caret + readout, glowing.
    g.save();
    g.shadowColor = GOLD;
    g.shadowBlur = 7;
    g.fillStyle = GOLD;
    g.beginPath();
    g.moveTo(cx - 6, y - 2); g.lineTo(cx + 6, y - 2); g.lineTo(cx, y + 6);
    g.closePath(); g.fill();
    g.font = `800 ${13 * s + 4}px system-ui, sans-serif`;
    g.textAlign = 'center';
    g.fillText(String(Math.round(heading)).padStart(3, '0') + '°', cx, y + 34 * s + 22);
    g.restore();
  }

  drawAttitude(cx, cy, r, pitchDeg, rollDeg) {
    const g = this.ctx;
    g.save();
    // Glass face with a metallic rim.
    g.shadowColor = 'rgba(255,201,60,0.35)';
    g.shadowBlur = 8;
    g.fillStyle = '#0B1B33';
    g.strokeStyle = 'rgba(255,201,60,0.6)';
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.restore();
    g.save();
    g.beginPath();
    g.arc(cx, cy, r - 1.5, 0, Math.PI * 2);
    g.clip();
    g.translate(cx, cy);
    g.rotate(-rollDeg * Math.PI / 180);
    const pitchPx = Math.max(-r, Math.min(r, pitchDeg * 1.4));
    // Sky: blue gradient; ground: brown gradient. Both lit, not flat.
    const skyGrad = g.createLinearGradient(0, -r - pitchPx, 0, -pitchPx);
    skyGrad.addColorStop(0, '#8FC3EE');
    skyGrad.addColorStop(1, '#2E5E8C');
    g.fillStyle = skyGrad;
    g.fillRect(-r, -r - pitchPx, r * 2, r + pitchPx);
    const gndGrad = g.createLinearGradient(0, -pitchPx, 0, r);
    gndGrad.addColorStop(0, '#C89B6D');
    gndGrad.addColorStop(1, '#5D4037');
    g.fillStyle = gndGrad;
    g.fillRect(-r, -pitchPx, r * 2, r + pitchPx);
    // Horizon line + pitch ladder with numbers.
    g.strokeStyle = WHITE;
    g.fillStyle = WHITE;
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(-r, -pitchPx); g.lineTo(r, -pitchPx); g.stroke();
    g.lineWidth = 1;
    g.font = '700 9px system-ui, sans-serif';
    g.textAlign = 'left';
    for (const p of [-20, -10, 10, 20]) {
      const yy = -pitchPx - p * 1.4;
      if (Math.abs(yy) > r - 6) continue;
      const wide = Math.abs(p) === 20;
      g.beginPath();
      g.moveTo(-r * (wide ? 0.5 : 0.35), yy);
      g.lineTo(r * (wide ? 0.5 : 0.35), yy);
      g.stroke();
      g.fillText(String(Math.abs(p)), r * 0.55, yy + 3);
    }
    g.restore();
    // Bank arc ticks around the top, with a gold pointer at the roll.
    g.strokeStyle = 'rgba(245,245,245,0.65)';
    g.lineWidth = 1.5;
    for (const b of [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60]) {
      const a = -Math.PI / 2 + b * Math.PI / 180;
      const x1 = cx + Math.cos(a) * (r - 2), y1 = cy + Math.sin(a) * (r - 2);
      const x2 = cx + Math.cos(a) * (r - (b % 30 === 0 ? 9 : 6)), y2 = cy + Math.sin(a) * (r - (b % 30 === 0 ? 9 : 6));
      g.beginPath();
      g.moveTo(x1, y1); g.lineTo(x2, y2);
      g.stroke();
    }
    const pa = -Math.PI / 2 + rollDeg * Math.PI / 180;
    g.save();
    g.shadowColor = GOLD;
    g.shadowBlur = 6;
    g.fillStyle = GOLD;
    g.beginPath();
    g.moveTo(cx + Math.cos(pa) * (r + 1), cy + Math.sin(pa) * (r + 1));
    g.lineTo(cx + Math.cos(pa - 0.12) * (r - 7), cy + Math.sin(pa - 0.12) * (r - 7));
    g.lineTo(cx + Math.cos(pa + 0.12) * (r - 7), cy + Math.sin(pa + 0.12) * (r - 7));
    g.closePath(); g.fill();
    g.restore();
    // Fixed aircraft symbol, glowing gold.
    g.save();
    g.shadowColor = GOLD;
    g.shadowBlur = 6;
    g.strokeStyle = GOLD;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(cx - r * 0.55, cy); g.lineTo(cx - r * 0.15, cy);
    g.moveTo(cx + r * 0.15, cy); g.lineTo(cx + r * 0.55, cy);
    g.moveTo(cx, cy - 4); g.lineTo(cx, cy + 4);
    g.stroke();
    g.restore();
    // Glass highlight over the face.
    g.save();
    g.beginPath();
    g.arc(cx, cy, r - 1.5, 0, Math.PI * 2);
    g.clip();
    const sheen = g.createLinearGradient(cx - r, cy - r, cx + r * 0.4, cy + r * 0.4);
    sheen.addColorStop(0, 'rgba(255,255,255,0.14)');
    sheen.addColorStop(0.5, 'rgba(255,255,255,0)');
    g.fillStyle = sheen;
    g.fillRect(cx - r, cy - r, r * 2, r * 2);
    g.restore();
    g.fillStyle = DIM;
    g.font = '600 11px system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText('ATTITUDE', cx, cy + r + 15);
  }

  drawMinimap(x, y, w, h, state) {
    const g = this.ctx;
    this.panel(x, y, w, h, 8);
    // North-up window centred on the plane, MAP_WINDOW_M metres across.
    const winX0 = state.planeX - MAP_WINDOW_M / 2;
    const winZ0 = state.planeZ - MAP_WINDOW_M / 2;
    const toMap = (wx, wz) => [
      x + (wx - winX0) / MAP_WINDOW_M * w,
      y + (wz - winZ0) / MAP_WINDOW_M * h,
    ];
    g.save();
    g.beginPath();
    g.roundRect(x + 1, y + 1, w - 2, h - 2, 7);
    g.clip();
    // Real coastlines: the sampled terrain image, windowed on the plane.
    const srcScale = MAP_PX / MAP_WORLD; // px per metre in the base image
    g.drawImage(
      this.mapBase,
      (winX0 + MAP_WORLD / 2) * srcScale, (winZ0 + MAP_WORLD / 2) * srcScale,
      MAP_WINDOW_M * srcScale, MAP_WINDOW_M * srcScale,
      x, y, w, h,
    );
    // Course polyline through the gates, in order.
    g.strokeStyle = 'rgba(255,201,60,0.85)';
    g.lineWidth = 1.5;
    g.setLineDash([5, 4]);
    g.beginPath();
    COURSE.forEach((def, i) => {
      const [mx, my] = toMap(def.x, def.z);
      if (i === 0) g.moveTo(mx, my); else g.lineTo(mx, my);
    });
    g.stroke();
    g.setLineDash([]);
    // Runway as a pale strip.
    const [rx, ry] = toMap(RUNWAY.x, RUNWAY.z);
    g.strokeStyle = '#F5F5F5';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(rx - RUNWAY.length / 2 / MAP_WINDOW_M * w, ry);
    g.lineTo(rx + RUNWAY.length / 2 / MAP_WINDOW_M * w, ry);
    g.stroke();
    // Bearing line: dashed gold from the plane to the next gate.
    const next = COURSE[state.ringsPassed];
    if (next) {
      const [px, py] = toMap(state.planeX, state.planeZ);
      const [nx, ny] = toMap(next.x, next.z);
      g.strokeStyle = GOLD;
      g.lineWidth = 1.5;
      g.setLineDash([4, 4]);
      g.beginPath();
      g.moveTo(px, py);
      g.lineTo(nx, ny);
      g.stroke();
      g.setLineDash([]);
    }
    // Gates: numbered circles — gold next, cyan later, green passed.
    COURSE.forEach((def, i) => {
      const [mx, my] = toMap(def.x, def.z);
      const col = i < state.ringsPassed ? GREEN : (i === state.ringsPassed ? GOLD : CYAN);
      g.save();
      g.shadowColor = col;
      g.shadowBlur = 6;
      g.fillStyle = col;
      g.beginPath();
      g.arc(mx, my, i === state.ringsPassed ? 7 : 5.5, 0, Math.PI * 2);
      g.fill();
      g.restore();
      g.fillStyle = '#0B1B33';
      g.font = '800 8px system-ui, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String(i + 1), mx, my + 0.5);
      g.textBaseline = 'alphabetic';
    });
    // Plane icon, rotated by heading (0 = north = up).
    const [px, py] = toMap(state.planeX, state.planeZ);
    const hd = state.heading * Math.PI / 180;
    g.save();
    g.translate(px, py);
    g.rotate(hd);
    g.shadowColor = WHITE;
    g.shadowBlur = 6;
    g.fillStyle = WHITE;
    g.strokeStyle = GOLD;
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(0, -8); g.lineTo(5.5, 6); g.lineTo(-5.5, 6);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
    g.restore();
    // Labels.
    g.fillStyle = DIM;
    g.font = '600 10px system-ui, sans-serif';
    g.textAlign = 'left';
    g.fillText('COURSE', x + 6, y + 12);
    g.textAlign = 'right';
    g.fillText('2.4 km', x + w - 6, y + 12);
    g.textAlign = 'left';
  }

  draw(state) {
    const g = this.ctx;
    const { w, h, s } = this;
    g.clearRect(0, 0, w, h);
    const pad = 14;

    // ---- top-left: ALT / SPD / HDG --------------------------------------
    const lw = 150 * s + 46, lh = 140 * s + 22;
    this.panel(pad, pad, lw, lh);
    this.label(pad + 12, pad + 20, 'ALTITUDE');
    this.value(pad + 12, pad + 44, `${Math.round(state.alt)} m`, 22 * s + 6);
    // Vertical-speed trend arrow beside the altitude.
    if (state.vspeed !== undefined) {
      const vs = state.vspeed;
      const arrow = vs > 0.8 ? '▲' : vs < -0.8 ? '▼' : '–';
      const col = vs > 0.8 ? GREEN : vs < -0.8 ? RED : DIM;
      g.fillStyle = col;
      g.font = `700 ${13 * s + 3}px system-ui, sans-serif`;
      g.textAlign = 'right';
      g.fillText(arrow, pad + lw - 12, pad + 40);
      g.textAlign = 'left';
    }
    this.label(pad + 12, pad + 64, 'SPEED');
    this.value(pad + 12, pad + 88, `${Math.round(state.speedKmh)} km/h`, 22 * s + 6);
    this.label(pad + 12, pad + 108, 'HEADING');
    this.value(pad + 12, pad + 132, `${String(Math.round(state.heading)).padStart(3, '0')}°`, 22 * s + 6);

    // ---- top-centre: compass tape ----------------------------------------
    this.drawCompass(w / 2, pad, 340 * s + 60, state.heading);

    // ---- top-right: score / rings / time + bars ---------------------------
    const rw = 218 * s + 40, rh = 132 * s + 30;
    const rx = w - pad - rw;
    this.panel(rx, pad, rw, rh);
    this.label(rx + 12, pad + 20, 'SCORE');
    this.value(rx + 12, pad + 44, String(state.score), 22 * s + 6);
    this.label(rx + 108, pad + 20, 'RINGS');
    this.value(rx + 108, pad + 44, `${state.ringsPassed}/${state.ringsTotal}`, 22 * s + 6);
    this.label(rx + 12, pad + 68, 'TIME');
    const tcol = state.timeLeft < 30 ? RED : GOLD;
    this.value(rx + 12, pad + 92, `${Math.floor(state.timeLeft / 60)}:${String(Math.floor(state.timeLeft % 60)).padStart(2, '0')}`, 22 * s + 6, tcol);
    this.label(rx + 12, pad + 114, 'THR');
    this.bar(rx + 52, pad + 105, rw - 64, 9, state.throttle, GOLD);
    this.label(rx + 12, pad + 132, 'FUEL');
    this.bar(rx + 52, pad + 123, rw - 64, 9, state.fuel / 100, state.fuel < 25 ? RED : GREEN);
    this.label(rx + 12, pad + 150, 'DMG');
    this.bar(rx + 52, pad + 141, rw - 64, 9, state.damage / 100, state.damage > 60 ? RED : '#FFB300');

    // ---- centre-top pill: next ring + bearing arrow -----------------------
    if (state.nextRingLabel) {
      const pill = state.nextRingLabel;
      g.font = `700 ${14 * s + 4}px system-ui, sans-serif`;
      const tw = g.measureText(pill).width + 64;
      const px = w / 2 - tw / 2, py = pad + 58 * s + 16;
      this.panel(px, py, tw, 30 * s + 8, 15);
      // Bearing arrow: rotates toward the next gate relative to heading.
      const rel = ((state.nextRingBearing - state.heading + 540) % 360) - 180;
      g.save();
      g.translate(px + 22, py + (30 * s + 8) / 2);
      g.rotate(rel * Math.PI / 180);
      g.shadowColor = GOLD;
      g.shadowBlur = 6;
      g.fillStyle = GOLD;
      g.beginPath();
      g.moveTo(0, -8); g.lineTo(6, 6); g.lineTo(-6, 6);
      g.closePath(); g.fill();
      g.restore();
      g.fillStyle = WHITE;
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      g.fillText(pill, px + 38, py + (30 * s + 8) / 2 + 1);
      g.textBaseline = 'alphabetic';
    }

    // ---- bottom instrument strip ------------------------------------------
    const stripH = 108 * s + 22;
    const sy = h - pad - stripH;
    this.panel(pad, sy, w - pad * 2, stripH);
    const cy = sy + stripH / 2 - 4;
    this.drawAttitude(pad + 78 * s + 10, cy, 40 * s + 8, state.pitch, state.roll);
    const dx = pad + 170 * s + 20;
    const dr = 34 * s + 8;
    this.dial(dx, cy, dr, state.alt / 600, `${Math.round(state.alt)}`, 'ALT m');
    this.dial(dx + dr * 2 + 26, cy, dr, state.speedKmh / 350, `${Math.round(state.speedKmh)}`, 'SPD km/h');
    this.dial(dx + (dr * 2 + 26) * 2, cy, dr, state.heading / 360, `${String(Math.round(state.heading)).padStart(3, '0')}°`, 'HDG');
    // Vertical throttle bar, glass style.
    const tx = dx + (dr * 2 + 26) * 3 + 10;
    this.label(tx, sy + 20, 'THROTTLE', 10);
    const barH = stripH - 44;
    g.fillStyle = 'rgba(255,255,255,0.14)';
    g.beginPath();
    g.roundRect(tx, sy + 28, 12, barH, 6);
    g.fill();
    const thH = Math.max(0, Math.min(1, state.throttle)) * barH;
    if (thH > 1) {
      g.save();
      g.shadowColor = GOLD;
      g.shadowBlur = 7;
      const grad = g.createLinearGradient(tx, sy + 28 + barH, tx, sy + 28);
      grad.addColorStop(0, GOLD);
      grad.addColorStop(1, '#FFE082');
      g.fillStyle = grad;
      g.beginPath();
      g.roundRect(tx, sy + 28 + barH - thH, 12, thH, 6);
      g.fill();
      g.restore();
    }
    g.fillStyle = WHITE;
    g.font = '700 12px system-ui, sans-serif';
    g.textAlign = 'left';
    g.fillText(`${Math.round(state.throttle * 100)}%`, tx + 18, sy + stripH / 2 + 4);
    // Moving map, bottom-right inside the strip.
    this.drawMinimap(w - pad - 190 * s - 30, sy + 8, 190 * s + 30, stripH - 16, state);

    // ---- hint bar (fades after a few seconds) ----------------------------
    if (state.hint) {
      g.fillStyle = 'rgba(11,27,51,0.72)';
      g.font = `600 ${13 * s + 3}px system-ui, sans-serif`;
      const tw = g.measureText(state.hint).width + 28;
      g.beginPath();
      g.roundRect(w / 2 - tw / 2, h - pad - stripH - 40, tw, 26, 13);
      g.fill();
      g.fillStyle = WHITE;
      g.textAlign = 'center';
      g.fillText(state.hint, w / 2, h - pad - stripH - 22);
      g.textAlign = 'left';
    }

    // ---- centre message (crash / landed / time up / course complete) ------
    if (state.message) {
      const mw = 460 * s + 80, mh = 96 * s + 30;
      const mx = w / 2 - mw / 2, my = h / 2 - mh / 2 - 40;
      g.save();
      g.shadowColor = state.messageColor || GOLD;
      g.shadowBlur = 18;
      this.panel(mx, my, mw, mh, 14);
      g.restore();
      g.save();
      g.shadowColor = state.messageColor || GOLD;
      g.shadowBlur = 12;
      g.fillStyle = state.messageColor || GOLD;
      g.font = `800 ${26 * s + 8}px system-ui, sans-serif`;
      g.textAlign = 'center';
      g.fillText(state.message, w / 2, my + 42 * s + 14);
      g.restore();
      g.fillStyle = WHITE;
      g.font = `600 ${14 * s + 3}px system-ui, sans-serif`;
      g.textAlign = 'center';
      g.fillText(state.subMessage || '', w / 2, my + 42 * s + 44);
      g.textAlign = 'left';
    }
  }
}
