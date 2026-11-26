// hud.js — the glass-cockpit overlay for MERPATI SENJA (v11 HUD redesign).
// One job: draw every instrument on a full-screen 2D canvas each frame.
// Design language (refs: Ace Combat 7 holographic HUD, Garmin G1000 glass
// cockpit, DCS F-16 bezels): floating GLASS modules — translucent dark
// glass, gold hairline border, top highlight, drop shadow, corner rivets —
// never one flat dark band. Labels and values are ALWAYS separated by a
// real gap (the v10 defect was labels crammed onto their numbers).

import { ISLANDS, RUNWAY, terrainHeight } from './terrain.js';
import { COURSE } from './rings.js';

const GOLD = '#FFC93C';
const GOLD_SOFT = 'rgba(255,201,60,0.85)';
const WHITE = '#F5F5F5';
const DIM = 'rgba(245,245,245,0.62)';
const LABEL_GOLD = 'rgba(255,214,120,0.8)';
const RED = '#FF5252';
const GREEN = '#69F0AE';
const CYAN = '#00E5FF';

// The moving-map base: a 400x400 image of the whole world, sampled from
// the terrain height function once. Brighter than v10 (the map read too
// dark): teal sea, pale sand, bright green land, warm rock.
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
        d[i] = 16; d[i + 1] = 98; d[i + 2] = 128; d[i + 3] = 255;
      } else if (h < 4) {
        d[i] = 224; d[i + 1] = 206; d[i + 2] = 150; d[i + 3] = 255;
      } else if (h > 200) {
        d[i] = 132; d[i + 1] = 96; d[i + 2] = 80; d[i + 3] = 255;
      } else {
        const t = Math.min(1, h / 150);
        d[i] = Math.round(64 + (136 - 64) * t);
        d[i + 1] = Math.round(152 + (196 - 152) * t);
        d[i + 2] = Math.round(72 + (100 - 72) * t);
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
  /** Floating glass card: translucent gradient, drop shadow, dark outer
   *  rim + gold hairline, top highlight catching the sunset. */
  panel(x, y, w, h, r = 12) {
    const g = this.ctx;
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.55)';
    g.shadowBlur = 14;
    g.shadowOffsetY = 3;
    const grad = g.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, 'rgba(12,30,56,0.80)');
    grad.addColorStop(0.5, 'rgba(9,22,42,0.84)');
    grad.addColorStop(1, 'rgba(5,13,26,0.88)');
    g.fillStyle = grad;
    g.beginPath();
    g.roundRect(x, y, w, h, r);
    g.fill();
    g.restore();
    // Dark outer rim, then the gold hairline.
    g.save();
    g.strokeStyle = 'rgba(0,0,0,0.65)';
    g.lineWidth = 2.5;
    g.beginPath();
    g.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, r);
    g.stroke();
    g.strokeStyle = 'rgba(255,201,60,0.55)';
    g.lineWidth = 1;
    g.beginPath();
    g.roundRect(x + 2, y + 2, w - 4, h - 4, r - 2);
    g.stroke();
    g.restore();
    // Top highlight: the glass edge catching the sunset.
    g.save();
    g.beginPath();
    g.roundRect(x + 3, y + 3, w - 6, h - 6, r - 3);
    g.clip();
    g.strokeStyle = 'rgba(255,255,255,0.28)';
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(x + 10, y + 2.5);
    g.lineTo(x + w - 10, y + 2.5);
    g.stroke();
    g.restore();
  }

  /** Four tiny panel screws in the corners — the DCS bezel detail. */
  rivets(x, y, w, h) {
    const g = this.ctx;
    g.save();
    for (const [rx, ry] of [[x + 7, y + 7], [x + w - 7, y + 7], [x + 7, y + h - 7], [x + w - 7, y + h - 7]]) {
      g.fillStyle = 'rgba(0,0,0,0.6)';
      g.beginPath(); g.arc(rx, ry, 2.6, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.beginPath(); g.arc(rx - 0.7, ry - 0.7, 1, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }

  /** Small-caps letterspaced label. */
  label(x, y, text, size = 10, color = LABEL_GOLD) {
    const g = this.ctx;
    g.save();
    g.fillStyle = color;
    g.font = `700 ${size}px system-ui, sans-serif`;
    try { g.letterSpacing = '1.5px'; } catch (e) { /* older canvas */ }
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    g.fillText(text, x, y);
    g.restore();
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

  /** A label with its value underneath, separated by a REAL gap:
   *  label baseline at y, value baseline at y + size + 12. The v10
   *  defect was a 22px value starting 24px under its label — the value's
   *  cap top overlapped the label. Here the gap is always clear.
   *  The unit (e.g. " km/h") is drawn smaller right after the number —
   *  a full "900 km/h" at value size is ~130px wide and bled into the
   *  next column in v11's first pass. */
  stat(x, y, labelText, valueText, unitText = '', valueSize = 24, valueColor = GOLD) {
    this.label(x, y, labelText);
    this.value(x, y + valueSize + 12, valueText, valueSize, valueColor);
    if (unitText) {
      const g = this.ctx;
      g.save();
      g.font = `800 ${valueSize}px system-ui, sans-serif`;
      const w = g.measureText(valueText).width;
      g.fillStyle = DIM;
      g.font = `700 ${Math.round(valueSize * 0.55)}px system-ui, sans-serif`;
      g.textAlign = 'left';
      g.textBaseline = 'alphabetic';
      g.fillText(unitText, x + w + 3, y + valueSize + 12);
      g.restore();
    }
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

  /** Metallic 3D bezel ring for a round gauge: dark steel gradient
   *  band + gold hairline + inner shadow. */
  bezel(cx, cy, r) {
    const g = this.ctx;
    const grad = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    grad.addColorStop(0, '#5A6A85');
    grad.addColorStop(0.35, '#1A2639');
    grad.addColorStop(0.65, '#0A1424');
    grad.addColorStop(1, '#4A5A75');
    g.save();
    g.strokeStyle = grad;
    g.lineWidth = 5;
    g.beginPath();
    g.arc(cx, cy, r - 2.5, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = 'rgba(255,201,60,0.7)';
    g.lineWidth = 1.2;
    g.beginPath();
    g.arc(cx, cy, r - 5.5, 0, Math.PI * 2);
    g.stroke();
    // Inner shadow ring.
    g.strokeStyle = 'rgba(0,0,0,0.55)';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(cx, cy, r - 7.5, 0, Math.PI * 2);
    g.stroke();
    g.restore();
  }

  /** Round glass gauge: lit face, glowing needle, gold value arc,
   *  digital readout in the middle, label well below the face. */
  dial(cx, cy, r, frac, text, labelText) {
    const g = this.ctx;
    const f = Math.max(0, Math.min(1, frac));
    // Glass face.
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.5)';
    g.shadowBlur = 10;
    g.shadowOffsetY = 2;
    const face = g.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
    face.addColorStop(0, '#27436E');
    face.addColorStop(0.7, '#0B1B33');
    face.addColorStop(1, '#050D1A');
    g.fillStyle = face;
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();
    g.restore();
    this.bezel(cx, cy, r);
    // Glass sheen over the face.
    g.save();
    g.beginPath();
    g.arc(cx, cy, r - 8, 0, Math.PI * 2);
    g.clip();
    const sheen = g.createLinearGradient(cx - r, cy - r, cx + r * 0.4, cy + r * 0.4);
    sheen.addColorStop(0, 'rgba(255,255,255,0.13)');
    sheen.addColorStop(0.5, 'rgba(255,255,255,0)');
    g.fillStyle = sheen;
    g.fillRect(cx - r, cy - r, r * 2, r * 2);
    g.restore();
    // Gold value arc.
    g.save();
    g.shadowColor = GOLD;
    g.shadowBlur = 6;
    g.strokeStyle = GOLD;
    g.lineWidth = 3;
    g.beginPath();
    g.arc(cx, cy, r - 12, Math.PI * 0.75, Math.PI * 0.75 + f * Math.PI * 1.5);
    g.stroke();
    g.restore();
    // Tick ring.
    g.strokeStyle = 'rgba(245,245,245,0.45)';
    g.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
      const x1 = cx + Math.cos(a) * (r - 15), y1 = cy + Math.sin(a) * (r - 15);
      const x2 = cx + Math.cos(a) * (r - 20), y2 = cy + Math.sin(a) * (r - 20);
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
    g.lineTo(cx + Math.cos(a) * (r - 22), cy + Math.sin(a) * (r - 22));
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
    g.font = `800 ${Math.round(r * 0.36)}px system-ui, sans-serif`;
    g.textAlign = 'center';
    g.fillText(text, cx, cy + r * 0.55);
    g.restore();
    // Label BELOW the bezel with a clear gap.
    g.fillStyle = LABEL_GOLD;
    g.font = `700 ${Math.round(r * 0.22)}px system-ui, sans-serif`;
    g.textAlign = 'center';
    try { g.letterSpacing = '1.5px'; } catch (e) { /* older canvas */ }
    g.fillText(labelText, cx, cy + r + 18);
  }

  drawCompass(cx, y, w, heading) {
    const g = this.ctx;
    const s = this.s;
    const tapeH = 30 * s + 6;
    this.panel(cx - w / 2, y, w, tapeH, 8);
    g.save();
    g.beginPath();
    g.roundRect(cx - w / 2 + 1, y + 1, w - 2, tapeH - 2, 7);
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
      g.moveTo(x, y + 6);
      g.lineTo(x, y + (major ? 18 : mid ? 15 : 11));
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
      g.fillText(c ? c[1] : String(deg).padStart(3, '0'), x, y + tapeH - 4);
    }
    g.restore();
    // Centre caret pointing down to the heading chip.
    g.save();
    g.shadowColor = GOLD;
    g.shadowBlur = 7;
    g.fillStyle = GOLD;
    g.beginPath();
    g.moveTo(cx - 6, y + tapeH - 1); g.lineTo(cx + 6, y + tapeH - 1); g.lineTo(cx, y + tapeH + 7);
    g.closePath(); g.fill();
    g.restore();
    // Heading readout in its OWN glass chip below the tape — never
    // overlapping the tape edge (the v10 cramming defect).
    const chipW = 92, chipH = 26;
    this.panel(cx - chipW / 2, y + tapeH + 12, chipW, chipH, 8);
    g.save();
    g.shadowColor = GOLD;
    g.shadowBlur = 7;
    g.fillStyle = GOLD;
    g.font = `800 ${13 * s + 4}px system-ui, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(Math.round(heading)).padStart(3, '0') + '°', cx, y + tapeH + 12 + chipH / 2 + 1);
    g.restore();
    g.textBaseline = 'alphabetic';
  }

  drawAttitude(cx, cy, r, pitchDeg, rollDeg) {
    const g = this.ctx;
    // Glass face.
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.5)';
    g.shadowBlur = 10;
    g.shadowOffsetY = 2;
    g.fillStyle = '#0B1B33';
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();
    g.restore();
    this.bezel(cx, cy, r);
    g.save();
    g.beginPath();
    g.arc(cx, cy, r - 8, 0, Math.PI * 2);
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
      if (Math.abs(yy) > r - 12) continue;
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
      const x1 = cx + Math.cos(a) * (r - 9), y1 = cy + Math.sin(a) * (r - 9);
      const x2 = cx + Math.cos(a) * (r - (b % 30 === 0 ? 16 : 13)), y2 = cy + Math.sin(a) * (r - (b % 30 === 0 ? 16 : 13));
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
    g.lineTo(cx + Math.cos(pa - 0.12) * (r - 8), cy + Math.sin(pa - 0.12) * (r - 8));
    g.lineTo(cx + Math.cos(pa + 0.12) * (r - 8), cy + Math.sin(pa + 0.12) * (r - 8));
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
    g.arc(cx, cy, r - 8, 0, Math.PI * 2);
    g.clip();
    const sheen = g.createLinearGradient(cx - r, cy - r, cx + r * 0.4, cy + r * 0.4);
    sheen.addColorStop(0, 'rgba(255,255,255,0.14)');
    sheen.addColorStop(0.5, 'rgba(255,255,255,0)');
    g.fillStyle = sheen;
    g.fillRect(cx - r, cy - r, r * 2, r * 2);
    g.restore();
    g.fillStyle = LABEL_GOLD;
    g.font = '700 10px system-ui, sans-serif';
    g.textAlign = 'center';
    try { g.letterSpacing = '1.5px'; } catch (e) { /* older canvas */ }
    g.fillText('ATTITUDE', cx, cy + r + 18);
  }

  drawMinimap(x, y, w, h, state) {
    const g = this.ctx;
    this.panel(x, y, w, h, 10);
    this.rivets(x, y, w, h);
    // Header strip inside the panel.
    g.save();
    g.fillStyle = 'rgba(255,255,255,0.07)';
    g.beginPath();
    g.roundRect(x + 2, y + 2, w - 4, 20, 8);
    g.fill();
    g.restore();
    g.fillStyle = LABEL_GOLD;
    g.font = '700 10px system-ui, sans-serif';
    g.textAlign = 'left';
    try { g.letterSpacing = '1.5px'; } catch (e) { /* older canvas */ }
    g.fillText('COURSE', x + 10, y + 16);
    g.textAlign = 'right';
    g.fillStyle = DIM;
    g.fillText('2.4 km', x + w - 10, y + 16);
    g.textAlign = 'left';
    // Map window below the header.
    const my = y + 24, mh = h - 28;
    const winX0 = state.planeX - MAP_WINDOW_M / 2;
    const winZ0 = state.planeZ - MAP_WINDOW_M / 2;
    const toMap = (wx, wz) => [
      x + (wx - winX0) / MAP_WINDOW_M * w,
      my + (wz - winZ0) / MAP_WINDOW_M * mh,
    ];
    g.save();
    g.beginPath();
    g.roundRect(x + 2, my, w - 4, mh - 2, 7);
    g.clip();
    // Real coastlines: the sampled terrain image, windowed on the plane.
    const srcScale = MAP_PX / MAP_WORLD; // px per metre in the base image
    g.drawImage(
      this.mapBase,
      (winX0 + MAP_WORLD / 2) * srcScale, (winZ0 + MAP_WORLD / 2) * srcScale,
      MAP_WINDOW_M * srcScale, MAP_WINDOW_M * srcScale,
      x, my, w, mh,
    );
    // Course polyline through the gates, in order.
    g.strokeStyle = 'rgba(255,201,60,0.9)';
    g.lineWidth = 1.5;
    g.setLineDash([5, 4]);
    g.beginPath();
    COURSE.forEach((def, i) => {
      const [mx, my2] = toMap(def.x, def.z);
      if (i === 0) g.moveTo(mx, my2); else g.lineTo(mx, my2);
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
      const [mx, my2] = toMap(def.x, def.z);
      const col = i < state.ringsPassed ? GREEN : (i === state.ringsPassed ? GOLD : CYAN);
      g.save();
      g.shadowColor = col;
      g.shadowBlur = 6;
      g.fillStyle = col;
      g.beginPath();
      g.arc(mx, my2, i === state.ringsPassed ? 7 : 5.5, 0, Math.PI * 2);
      g.fill();
      g.restore();
      g.fillStyle = '#0B1B33';
      g.font = '800 8px system-ui, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String(i + 1), mx, my2 + 0.5);
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
  }

  draw(state) {
    const g = this.ctx;
    const { w, h, s } = this;
    g.clearRect(0, 0, w, h);
    const pad = 14;

    // ---- top-left: aircraft chip — title row + 3 stat columns ----------
    // Columns (ALT / SPD / HDG) with dividers; label and value separated
    // by a real gap via stat().
    const lw = 330 * s + 10, lh = 96 * s + 8;
    this.panel(pad, pad, lw, lh);
    this.rivets(pad, pad, lw, lh);
    g.save();
    g.shadowColor = GOLD;
    g.shadowBlur = 7;
    g.fillStyle = GOLD;
    g.font = `800 ${13 * s + 4}px system-ui, sans-serif`;
    g.textAlign = 'left';
    g.fillText('F-22 RAPTOR', pad + 14, pad + 24);
    g.restore();
    g.fillStyle = DIM;
    g.font = `700 ${9 * s + 2}px system-ui, sans-serif`;
    g.textAlign = 'right';
    try { g.letterSpacing = '2px'; } catch (e) { /* older canvas */ }
    g.fillText('MERPATI SENJA', pad + lw - 14, pad + 24);
    g.textAlign = 'left';
    // Divider under the title.
    g.strokeStyle = 'rgba(255,201,60,0.25)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(pad + 14, pad + 34);
    g.lineTo(pad + lw - 14, pad + 34);
    g.stroke();
    const colW = (lw - 28) / 3;
    const colX = [pad + 14, pad + 14 + colW, pad + 14 + colW * 2];
    // Vertical dividers between columns.
    g.strokeStyle = 'rgba(255,255,255,0.12)';
    for (const dx of [colX[1] - 8, colX[2] - 8]) {
      g.beginPath();
      g.moveTo(dx, pad + 44);
      g.lineTo(dx, pad + lh - 12);
      g.stroke();
    }
    this.stat(colX[0], pad + 56, 'ALTITUDE', `${Math.round(state.alt)}`, ' m', 24 * s + 4);
    this.stat(colX[1], pad + 56, 'SPEED', `${Math.round(state.speedKmh)}`, ' km/h', 24 * s + 4);
    this.stat(colX[2], pad + 56, 'HEADING', `${String(Math.round(state.heading)).padStart(3, '0')}°`, '', 24 * s + 4);
    // Vertical-speed trend arrow beside the altitude value.
    if (state.vspeed !== undefined) {
      const vs = state.vspeed;
      const arrow = vs > 0.8 ? '▲' : vs < -0.8 ? '▼' : '–';
      const col = vs > 0.8 ? GREEN : vs < -0.8 ? RED : DIM;
      g.fillStyle = col;
      g.font = `700 ${13 * s + 3}px system-ui, sans-serif`;
      g.textAlign = 'right';
      g.fillText(arrow, colX[0] + colW - 10, pad + 56 + 24 * s + 4 + 12);
      g.textAlign = 'left';
    }

    // ---- top-centre: compass tape + separate heading chip ---------------
    this.drawCompass(w / 2, pad, 340 * s + 60, state.heading);

    // ---- top-right: score card — 3 stat columns + bar rows -------------
    const rw = 258 * s + 10, rh = 162 * s + 10;
    const rx = w - pad - rw;
    this.panel(rx, pad, rw, rh);
    this.rivets(rx, pad, rw, rh);
    const scolW = (rw - 28) / 3;
    const scolX = [rx + 14, rx + 14 + scolW, rx + 14 + scolW * 2];
    this.stat(scolX[0], pad + 24, 'SCORE', String(state.score), '', 24 * s + 4);
    this.stat(scolX[1], pad + 24, 'RINGS', `${state.ringsPassed}/${state.ringsTotal}`, '', 24 * s + 4);
    const tcol = state.timeLeft < 30 ? RED : GOLD;
    this.stat(scolX[2], pad + 24, 'TIME', `${Math.floor(state.timeLeft / 60)}:${String(Math.floor(state.timeLeft % 60)).padStart(2, '0')}`, '', 24 * s + 4, tcol);
    // Divider under the stats.
    g.strokeStyle = 'rgba(255,201,60,0.25)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(rx + 14, pad + 72);
    g.lineTo(rx + rw - 14, pad + 72);
    g.stroke();
    // Bar rows: label left, bar right — label never sits on the bar.
    const barRows = [
      ['THR', state.throttle, GOLD],
      ['FUEL', state.fuel / 100, state.fuel < 25 ? RED : GREEN],
      ['DMG', state.damage / 100, state.damage > 60 ? RED : '#FFB300'],
    ];
    barRows.forEach(([name, frac, col], i) => {
      const by = pad + 88 + i * 22;
      this.label(rx + 14, by + 9, name);
      this.bar(rx + 58, by, rw - 72, 10, frac, col);
    });
    // Afterburner badge: lit orange while the burners are on.
    if (state.afterburner) {
      g.save();
      g.shadowColor = '#FF7A18';
      g.shadowBlur = 10;
      g.fillStyle = '#FF7A18';
      g.beginPath();
      g.roundRect(rx + 14, pad + rh - 26, 168, 18, 9);
      g.fill();
      g.restore();
      g.fillStyle = '#1A0E00';
      g.font = '800 12px system-ui, sans-serif';
      g.textAlign = 'center';
      g.fillText('AB — AFTERBURNER', rx + 14 + 84, pad + rh - 13);
      g.textAlign = 'left';
    }

    // ---- centre-top pill: next ring + bearing arrow -----------------------
    if (state.nextRingLabel) {
      const pill = state.nextRingLabel;
      g.font = `700 ${14 * s + 4}px system-ui, sans-serif`;
      const tw = g.measureText(pill).width + 64;
      const px = w / 2 - tw / 2, py = pad + 92 * s + 8;
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

    // ---- bottom: FLOATING glass modules (no full-width strip) -----------
    // Four separate cards with open scene between them — the v10 flat
    // dark band is gone.
    const modH = 118 * s + 8;
    const sy = h - pad - modH;
    // Attitude card.
    const attW = 134 * s + 10;
    this.panel(pad, sy, attW, modH, 10);
    this.rivets(pad, sy, attW, modH);
    this.drawAttitude(pad + attW / 2, sy + modH / 2 - 8, 38 * s + 6, state.pitch, state.roll);
    // Dials card: ALT / SPD / HDG.
    const dialCardX = pad + attW + 12;
    const dialCardW = 344 * s + 10;
    this.panel(dialCardX, sy, dialCardW, modH, 10);
    this.rivets(dialCardX, sy, dialCardW, modH);
    const dcy = sy + modH / 2 - 10;
    const dr = 35 * s + 6;
    const dstep = dialCardW / 3;
    this.dial(dialCardX + dstep * 0.5, dcy, dr, state.alt / 600, `${Math.round(state.alt)}`, 'ALT m');
    this.dial(dialCardX + dstep * 1.5, dcy, dr, state.speedKmh / 1300, `${Math.round(state.speedKmh)}`, 'SPD km/h');
    this.dial(dialCardX + dstep * 2.5, dcy, dr, state.heading / 360, `${String(Math.round(state.heading)).padStart(3, '0')}°`, 'HDG');
    // Throttle card: glass slot + glowing fill + 3D handle + big %.
    const thrX = dialCardX + dialCardW + 12;
    const thrW = 104 * s + 8;
    this.panel(thrX, sy, thrW, modH, 10);
    this.rivets(thrX, sy, thrW, modH);
    this.label(thrX + 12, sy + 20, 'THROTTLE');
    const slotX = thrX + 16, slotY = sy + 30, slotW = 14, slotH = modH - 46;
    g.fillStyle = 'rgba(255,255,255,0.14)';
    g.beginPath();
    g.roundRect(slotX, slotY, slotW, slotH, 7);
    g.fill();
    const thH = Math.max(0, Math.min(1, state.throttle)) * slotH;
    if (thH > 1) {
      g.save();
      g.shadowColor = GOLD;
      g.shadowBlur = 8;
      const grad = g.createLinearGradient(slotX, slotY + slotH, slotX, slotY);
      grad.addColorStop(0, GOLD);
      grad.addColorStop(1, '#FFE082');
      g.fillStyle = grad;
      g.beginPath();
      g.roundRect(slotX, slotY + slotH - thH, slotW, thH, 7);
      g.fill();
      g.restore();
      // 3D handle knob riding the top of the fill.
      const hy = slotY + slotH - thH;
      g.save();
      g.shadowColor = 'rgba(0,0,0,0.6)';
      g.shadowBlur = 4;
      g.shadowOffsetY = 2;
      const hgrad = g.createLinearGradient(slotX - 6, hy - 6, slotX + slotW + 6, hy + 6);
      hgrad.addColorStop(0, '#FFE082');
      hgrad.addColorStop(0.5, GOLD);
      hgrad.addColorStop(1, '#B8860B');
      g.fillStyle = hgrad;
      g.beginPath();
      g.roundRect(slotX - 6, hy - 6, slotW + 12, 12, 6);
      g.fill();
      g.restore();
      g.strokeStyle = 'rgba(255,255,255,0.5)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(slotX - 2, hy - 3);
      g.lineTo(slotX + slotW + 2, hy - 3);
      g.stroke();
    }
    g.save();
    g.shadowColor = GOLD;
    g.shadowBlur = 6;
    g.fillStyle = WHITE;
    g.font = `800 ${17 * s + 4}px system-ui, sans-serif`;
    g.textAlign = 'left';
    g.fillText(`${Math.round(state.throttle * 100)}%`, slotX + slotW + 10, slotY + slotH / 2 + 7);
    g.restore();
    // Moving map card, bottom-right.
    const mapW = 286 * s + 10;
    this.drawMinimap(w - pad - mapW, sy, mapW, modH, state);

    // ---- hint bar (fades after a few seconds) ----------------------------
    if (state.hint) {
      g.fillStyle = 'rgba(11,27,51,0.72)';
      g.font = `600 ${13 * s + 3}px system-ui, sans-serif`;
      const tw = g.measureText(state.hint).width + 28;
      g.beginPath();
      g.roundRect(w / 2 - tw / 2, h - pad - modH - 40, tw, 26, 13);
      g.fill();
      g.fillStyle = WHITE;
      g.textAlign = 'center';
      g.fillText(state.hint, w / 2, h - pad - modH - 22);
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
