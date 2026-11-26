// hud.js — the 2D instrument overlay for MERPATI SENJA.
// One job: draw every instrument on a full-screen 2D canvas each frame:
// altitude / speed / heading, compass tape, score, fuel and damage, the
// attitude indicator, round dials, throttle, and the course mini-map.
// Navy panels (#0B1B33CC), gold numbers (#FFC93C), white labels.

import { ISLANDS, RUNWAY } from './terrain.js';
import { COURSE } from './rings.js';

const NAVY = 'rgba(11,27,51,0.82)';
const NAVY_EDGE = 'rgba(255,201,60,0.55)';
const GOLD = '#FFC93C';
const WHITE = '#F5F5F5';
const DIM = 'rgba(245,245,245,0.62)';
const RED = '#FF5252';
const GREEN = '#69F0AE';
const CYAN = '#00E5FF';

export class Hud {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
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

  panel(x, y, w, h, r = 10) {
    const g = this.ctx;
    g.fillStyle = NAVY;
    g.strokeStyle = NAVY_EDGE;
    g.lineWidth = 1;
    g.beginPath();
    g.roundRect(x, y, w, h, r);
    g.fill();
    g.stroke();
  }

  label(x, y, text, size = 11, color = DIM) {
    const g = this.ctx;
    g.fillStyle = color;
    g.font = `600 ${size}px system-ui, sans-serif`;
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    g.fillText(text, x, y);
  }

  value(x, y, text, size = 24, color = GOLD) {
    const g = this.ctx;
    g.fillStyle = color;
    g.font = `700 ${size}px system-ui, sans-serif`;
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    g.fillText(text, x, y);
  }

  bar(x, y, w, h, frac, color, bg = 'rgba(255,255,255,0.14)') {
    const g = this.ctx;
    g.fillStyle = bg;
    g.beginPath();
    g.roundRect(x, y, w, h, h / 2);
    g.fill();
    g.fillStyle = color;
    const fw = Math.max(0, Math.min(1, frac)) * w;
    if (fw > 1) {
      g.beginPath();
      g.roundRect(x, y, fw, h, h / 2);
      g.fill();
    }
  }

  /** Round gauge with a needle: value in [min,max], label under it. */
  dial(cx, cy, r, frac, text, labelText) {
    const g = this.ctx;
    g.fillStyle = NAVY;
    g.strokeStyle = NAVY_EDGE;
    g.lineWidth = 1;
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    // Tick ring.
    g.strokeStyle = 'rgba(245,245,245,0.35)';
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
      const x1 = cx + Math.cos(a) * (r - 4), y1 = cy + Math.sin(a) * (r - 4);
      const x2 = cx + Math.cos(a) * (r - 10), y2 = cy + Math.sin(a) * (r - 10);
      g.beginPath();
      g.moveTo(x1, y1); g.lineTo(x2, y2);
      g.stroke();
    }
    const a = Math.PI * 0.75 + Math.max(0, Math.min(1, frac)) * Math.PI * 1.5;
    g.strokeStyle = GOLD;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(a) * (r - 14), cy + Math.sin(a) * (r - 14));
    g.stroke();
    g.fillStyle = GOLD;
    g.beginPath();
    g.arc(cx, cy, 3, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = WHITE;
    g.font = `700 ${Math.round(r * 0.34)}px system-ui, sans-serif`;
    g.textAlign = 'center';
    g.fillText(text, cx, cy + r * 0.52);
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
    // Centre caret + readout.
    g.fillStyle = GOLD;
    g.beginPath();
    g.moveTo(cx - 6, y - 2); g.lineTo(cx + 6, y - 2); g.lineTo(cx, y + 6);
    g.closePath(); g.fill();
    g.fillStyle = GOLD;
    g.font = `700 ${13 * s + 4}px system-ui, sans-serif`;
    g.textAlign = 'center';
    g.fillText(String(Math.round(heading)).padStart(3, '0') + '°', cx, y + 34 * s + 22);
  }

  drawAttitude(cx, cy, r, pitchDeg, rollDeg) {
    const g = this.ctx;
    g.save();
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.clip();
    g.translate(cx, cy);
    g.rotate(-rollDeg * Math.PI / 180);
    const pitchPx = Math.max(-r, Math.min(r, pitchDeg * 1.4));
    // Sky / ground halves.
    g.fillStyle = '#2E5E8C';
    g.fillRect(-r, -r - pitchPx, r * 2, r + pitchPx);
    g.fillStyle = '#8D6E63';
    g.fillRect(-r, -pitchPx, r * 2, r + pitchPx);
    // Horizon line + pitch ladder.
    g.strokeStyle = WHITE;
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(-r, -pitchPx); g.lineTo(r, -pitchPx); g.stroke();
    g.lineWidth = 1;
    for (const p of [-20, -10, 10, 20]) {
      const y = -pitchPx - p * 1.4;
      if (Math.abs(y) > r - 4) continue;
      g.beginPath(); g.moveTo(-r * 0.45, y); g.lineTo(r * 0.45, y); g.stroke();
    }
    g.restore();
    // Fixed aircraft symbol.
    g.strokeStyle = GOLD;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(cx - r * 0.55, cy); g.lineTo(cx - r * 0.15, cy);
    g.moveTo(cx + r * 0.15, cy); g.lineTo(cx + r * 0.55, cy);
    g.moveTo(cx, cy - 4); g.lineTo(cx, cy + 4);
    g.stroke();
    // Rim + label.
    g.strokeStyle = NAVY_EDGE;
    g.lineWidth = 1.5;
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
    g.fillStyle = DIM;
    g.font = `600 11px system-ui, sans-serif`;
    g.textAlign = 'center';
    g.fillText('ATTITUDE', cx, cy + r + 15);
  }

  drawMinimap(x, y, w, h, state) {
    const g = this.ctx;
    this.panel(x, y, w, h, 8);
    const scale = w / 6000;
    const toMap = (wx, wz) => [x + (wx + 3000) * scale, y + (wz + 3000) * (h / 6000)];
    // Sea background is the panel itself; islands as green blobs.
    for (const isl of ISLANDS) {
      const [mx, my] = toMap(isl.x, isl.z);
      g.fillStyle = isl.volcano ? '#8D6E63' : '#3E7D44';
      g.beginPath();
      g.arc(mx, my, Math.max(2.5, isl.r * scale), 0, Math.PI * 2);
      g.fill();
    }
    // Runway as a gold line.
    const [rx, ry] = toMap(RUNWAY.x, RUNWAY.z);
    g.strokeStyle = GOLD;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(rx - RUNWAY.length / 2 * scale, ry);
    g.lineTo(rx + RUNWAY.length / 2 * scale, ry);
    g.stroke();
    // Rings: gold = next, cyan = later, green = passed.
    COURSE.forEach((def, i) => {
      const [mx, my] = toMap(def.x, def.z);
      g.fillStyle = i < state.ringsPassed ? GREEN : (i === state.ringsPassed ? GOLD : CYAN);
      g.beginPath();
      g.arc(mx, my, i === state.ringsPassed ? 4.5 : 3, 0, Math.PI * 2);
      g.fill();
    });
    // Plane triangle, rotated by heading.
    const [px, py] = toMap(state.planeX, state.planeZ);
    const hd = state.heading * Math.PI / 180;
    g.save();
    g.translate(px, py);
    g.rotate(hd);
    g.fillStyle = WHITE;
    g.beginPath();
    g.moveTo(0, -7); g.lineTo(5, 6); g.lineTo(-5, 6);
    g.closePath(); g.fill();
    g.restore();
    g.fillStyle = DIM;
    g.font = '600 10px system-ui, sans-serif';
    g.textAlign = 'left';
    g.fillText('COURSE', x + 6, y + 12);
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
    // Vertical throttle bar.
    const tx = dx + (dr * 2 + 26) * 3 + 10;
    this.label(tx, sy + 20, 'THROTTLE', 10);
    this.bar(tx, sy + 28, 12, stripH - 44, state.throttle, GOLD);
    g.fillStyle = WHITE;
    g.font = '700 12px system-ui, sans-serif';
    g.textAlign = 'left';
    g.fillText(`${Math.round(state.throttle * 100)}%`, tx + 18, sy + stripH / 2 + 4);
    // Mini-map, bottom-right inside the strip.
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
      this.panel(mx, my, mw, mh, 14);
      g.fillStyle = state.messageColor || GOLD;
      g.font = `800 ${26 * s + 8}px system-ui, sans-serif`;
      g.textAlign = 'center';
      g.fillText(state.message, w / 2, my + 42 * s + 14);
      g.fillStyle = WHITE;
      g.font = `600 ${14 * s + 3}px system-ui, sans-serif`;
      g.fillText(state.subMessage || '', w / 2, my + 42 * s + 44);
      g.textAlign = 'left';
    }
  }
}
