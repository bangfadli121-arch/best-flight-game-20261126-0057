// hud.js — the COMPACT glass-cockpit overlay for MERPATI SENJA (v12).
// One job: draw every instrument on a full-screen 2D canvas each frame.
//
// v12 lesson (fadli, 17:04): v11 failed because its difference from v10
// only showed up in a zoomed crop-by-crop comparison — at a glance, in a
// small phone-chat preview, it looked the same. So v12 changes the HUD's
// SILHOUETTE, not just its skin:
//   - every panel is ~35-40% smaller than v11 (top chip 252x66 vs 340x104,
//     score card 196x100 vs 268x172, bottom modules 84 tall vs 126),
//     but fonts stay big relative to their panels, so everything is
//     still readable at 1280x720 with no zoom;
//   - the MOVING MAP is the star: 330x150, far bigger than any other
//     bottom module, and drawn from a REAL detailed terrain raster —
//     hillshaded contour-following terrace patchwork, volcano zones,
//     village dots, runway, range rings, glowing route — not a flat
//     green blob like v11.
// Design language (refs: Ace Combat 7 holographic HUD, Garmin G1000 glass
// cockpit, DCS F-16 bezels): floating GLASS modules — translucent dark
// glass, gold hairline border, top highlight, drop shadow, corner rivets.
// Labels and values are ALWAYS separated by a real gap.

import { ISLANDS, RUNWAY, VILLAGE, terrainHeight, valueNoise } from './terrain.js';
import { COURSE } from './rings.js';

const GOLD = '#FFC93C';
const GOLD_SOFT = 'rgba(255,201,60,0.85)';
const WHITE = '#F5F5F5';
const DIM = 'rgba(245,245,245,0.62)';
const LABEL_GOLD = 'rgba(255,214,120,0.8)';
const RED = '#FF5252';
const GREEN = '#69F0AE';
const CYAN = '#00E5FF';

// ---------------------------------------------------------------- map base
// The moving-map base: a 640x640 raster of the whole 6000 m world, baked
// once from the SAME terrain rules the 3D ground uses (terraces follow
// the contour, volcano zones, sand, rock, snow) plus real hillshading
// from the height gradient — so the map reads as a miniature of the
// world below, not a flat green blob (the v11 defect).
const MAP_PX = 640;
const MAP_WORLD = 6000;
const MAP_WINDOW_M = 2400; // metres across the panel

function hash2i(ix, iz) {
  let n = (ix * 374761393 + iz * 668265263) | 0;
  n = (n ^ (n >> 13)) | 0;
  n = Math.imul(n, 1274126177);
  return (((n ^ (n >> 16)) >>> 0) % 10000) / 10000;
}

function lerp(a, b, t) { return a + (b - a) * t; }

// One map pixel's colour, mirroring terrain.js terrainColour (which is
// module-private, so the rules are re-expressed here from terrainHeight
// + valueNoise, both exported). Returns [r, g, b] 0..255.
function mapPixel(x, z, h, gx, gz) {
  let r, g, b;
  if (h <= 0.5) {
    // Sea: deep teal, lighter near the coast, wave speckle.
    const coast = Math.max(0, Math.min(1, (h + 2) / 2.5));
    r = lerp(10, 42, coast); g = lerp(96, 152, coast); b = lerp(126, 172, coast);
    const sp = valueNoise(x * 0.05, z * 0.05) * 0.5 + 0.5;
    const m = 0.94 + sp * 0.12;
    r *= m; g *= m; b *= m;
  } else if (h < 4) {
    // Sand, wetter (darker) at the waterline.
    const t = Math.min(1, (4 - h) / 4);
    r = lerp(232, 201, t); g = lerp(217, 176, t); b = lerp(160, 120, t);
  } else if (h < 150) {
    // Rice-terrace patchwork: contour bands (12 m steps), one solid
    // colour per plot, dark bund lines on band + plot edges — the same
    // pattern the 3D hills wear, so the map matches the world.
    const tb = Math.floor(h / 12);
    const rr = Math.sqrt(x * x + z * z);
    const ang = Math.atan2(z, x);
    const along = (ang * rr) / 60;
    const seg = Math.floor(along);
    const ph = hash2i(tb * 7 + 13, seg * 3 + 5);
    if (ph < 0.38) { r = 234; g = 246; b = 252; }       // flooded mirror
    else if (ph < 0.63) { r = 124; g = 179; b = 66; }  // young seedlings
    else if (ph < 0.88) { r = 85; g = 125; b = 47; }   // deep green
    else { r = 192; g = 202; b = 51; }                 // ripe gold
    const jit = 0.94 + hash2i(tb + 911, seg + 733) * 0.12;
    r *= jit; g *= jit; b *= jit;
    const frac = (h - tb * 12) / 12;
    const edge = Math.min(frac, 1 - frac);
    if (edge < 0.16) { r = lerp(r, 93, 0.85); g = lerp(g, 64, 0.85); b = lerp(b, 55, 0.85); }
    else if (edge < 0.34) { r = lerp(r, 200, 0.35); g = lerp(g, 155, 0.35); b = lerp(b, 90, 0.35); }
    const segFrac = along - seg;
    const sEdge = Math.min(segFrac, 1 - segFrac);
    if (sEdge < 0.08) { r = lerp(r, 93, 0.6); g = lerp(g, 64, 0.6); b = lerp(b, 55, 0.6); }
  } else {
    const dx = x + 1700, dz = z + 1500;
    const vd = Math.sqrt(dx * dx + dz * dz);
    const vang = Math.atan2(dz, dx);
    if (vd < 780) {
      // Volcano zones: forest / savanna / rock with 28-sector erosion
      // gully striping, snow cap with a noise-jittered edge.
      const gully = 0.5 + 0.5 * Math.sin(vang * 28 + valueNoise(x * 0.01 + 5, z * 0.01 + 5) * 2.0);
      const blotch = valueNoise(x * 0.008 + 31, z * 0.008 + 17);
      if (h < 190) {
        r = 62; g = 110; b = 51;
        const m = (0.72 + 0.60 * gully);
        r *= m; g *= m; b *= m;
        if (blotch > 0.25) { r = lerp(r, 168, 0.55); g = lerp(g, 154, 0.55); b = lerp(b, 88, 0.55); }
        else if (blotch < -0.45) { r = lerp(r, 110, 0.45); g = lerp(g, 91, 0.45); b = lerp(b, 82, 0.45); }
      } else if (h < 280) {
        r = 168; g = 154; b = 88;
        const m = (0.70 + 0.60 * gully);
        r *= m; g *= m; b *= m;
        if (blotch > 0.25) { r = lerp(r, 62, 0.55); g = lerp(g, 110, 0.55); b = lerp(b, 51, 0.55); }
        else if (blotch < -0.45) { r = lerp(r, 110, 0.45); g = lerp(g, 91, 0.45); b = lerp(b, 82, 0.45); }
      } else {
        const stripe = Math.floor(vang * 28 + valueNoise(x * 0.01 + 5, z * 0.01 + 5) * 2.0);
        const dark = stripe % 2 === 0 ? 0.15 : 0.85;
        r = lerp(151, 64, dark); g = lerp(136, 51, dark); b = lerp(122, 43, dark);
        const gf = 0.5 + 0.5 * Math.sin(vang * 60 + valueNoise(x * 0.02 + 11, z * 0.02 + 7) * 4.0);
        const m = 0.82 + 0.30 * gf;
        r *= m; g *= m; b *= m;
        const snowline = 380 + valueNoise(x * 0.008 + 13, z * 0.008 + 29) * 45;
        if (h > snowline) { r = 242; g = 244; b = 246; }
      }
    } else {
      r = 111; g = 168; b = 79;
      if (h > 200) {
        const t = Math.min(1, (h - 200) / 60);
        r = lerp(r, 110, t); g = lerp(g, 91, t); b = lerp(b, 82, t);
      }
    }
  }
  // Hillshade: light from the west-northwest, so slopes facing the
  // sunset read warm-bright and lee slopes fall into shade — the map
  // gets real relief instead of flat colour bands.
  const inv = 1 / Math.sqrt(gx * gx + 1 + gz * gz);
  const nx = -gx * inv, ny = inv, nz = -gz * inv;
  const dot = nx * -0.65 + ny * 0.75 + nz * 0.30;
  const shade = 0.68 + 0.42 * Math.max(0, Math.min(1, dot));
  // Fine grain so large flat areas never read as paint.
  const gr = 0.94 + hash2i(Math.floor(x / 9.4), Math.floor(z / 9.4)) * 0.12;
  return [r * shade * gr, g * shade * gr, b * shade * gr];
}

function buildMapBase() {
  const c = document.createElement('canvas');
  c.width = MAP_PX; c.height = MAP_PX;
  const g = c.getContext('2d');
  const step = MAP_WORLD / (MAP_PX - 1);
  // Heights once on the pixel grid; the colour pass reuses them and
  // takes its gradient from neighbours (no extra terrainHeight calls).
  const H = new Float32Array(MAP_PX * MAP_PX);
  for (let j = 0; j < MAP_PX; j++) {
    const z = (j / (MAP_PX - 1) - 0.5) * MAP_WORLD;
    for (let i = 0; i < MAP_PX; i++) {
      const x = (i / (MAP_PX - 1) - 0.5) * MAP_WORLD;
      H[j * MAP_PX + i] = terrainHeight(x, z);
    }
  }
  const img = g.createImageData(MAP_PX, MAP_PX);
  const d = img.data;
  for (let j = 0; j < MAP_PX; j++) {
    const z = (j / (MAP_PX - 1) - 0.5) * MAP_WORLD;
    const j0 = Math.max(0, j - 1), j1 = Math.min(MAP_PX - 1, j + 1);
    for (let i = 0; i < MAP_PX; i++) {
      const x = (i / (MAP_PX - 1) - 0.5) * MAP_WORLD;
      const i0 = Math.max(0, i - 1), i1 = Math.min(MAP_PX - 1, i + 1);
      const h = H[j * MAP_PX + i];
      const gx = (H[j * MAP_PX + i1] - H[j * MAP_PX + i0]) / ((i1 - i0) * step);
      const gz = (H[j1 * MAP_PX + i] - H[j0 * MAP_PX + i]) / ((j1 - j0) * step);
      const [r, gg, b] = mapPixel(x, z, h, gx, gz);
      const k = (j * MAP_PX + i) * 4;
      d[k] = Math.max(0, Math.min(255, r));
      d[k + 1] = Math.max(0, Math.min(255, gg));
      d[k + 2] = Math.max(0, Math.min(255, b));
      d[k + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  // Village: a cluster of terracotta roof dots on the levelled valley
  // floor, plus the dirt road from the kampung to the runway threshold.
  const toPx = (wx, wz) => [
    (wx + MAP_WORLD / 2) / MAP_WORLD * MAP_PX,
    (wz + MAP_WORLD / 2) / MAP_WORLD * MAP_PX,
  ];
  g.strokeStyle = 'rgba(232,217,160,0.9)';
  g.lineWidth = 2;
  g.beginPath();
  const [vx, vy] = toPx(VILLAGE.x, VILLAGE.z);
  const [tx, ty] = toPx(RUNWAY.x - 100, RUNWAY.z);
  g.moveTo(vx, vy); g.lineTo(tx, ty);
  g.stroke();
  for (let k = 0; k < 24; k++) {
    const a = hash2i(k * 3 + 1, 7) * Math.PI * 2;
    const dist = Math.sqrt(hash2i(k * 5 + 2, 11)) * VILLAGE.radius * 0.85;
    const [hx, hy] = toPx(VILLAGE.x + Math.cos(a) * dist, VILLAGE.z + Math.sin(a) * dist);
    g.fillStyle = '#C8552E';
    g.beginPath(); g.arc(hx, hy, 2.2, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.beginPath(); g.arc(hx - 0.7, hy - 0.7, 0.8, 0, Math.PI * 2); g.fill();
  }
  // Volcano crater: dark pit at the cone's top.
  const [cx, cy] = toPx(ISLANDS[1].x, ISLANDS[1].z);
  g.fillStyle = '#2B1F1A';
  g.beginPath(); g.arc(cx, cy, 7, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(255,150,80,0.7)';
  g.lineWidth = 1.5;
  g.beginPath(); g.arc(cx, cy, 8.5, 0, Math.PI * 2); g.stroke();
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
    // Scale factor against the 1280x720 reference layout. All geometry
    // below is in reference px times this factor.
    this.s = Math.min(w / 1280, h / 720);
  }

  // ---- glass primitives -------------------------------------------------
  /** Floating glass card: translucent gradient, drop shadow, dark outer
   *  rim + gold hairline, top highlight catching the sunset. */
  panel(x, y, w, h, r = 10) {
    const g = this.ctx;
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.55)';
    g.shadowBlur = 12;
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
    for (const [rx, ry] of [[x + 6, y + 6], [x + w - 6, y + 6], [x + 6, y + h - 6], [x + w - 6, y + h - 6]]) {
      g.fillStyle = 'rgba(0,0,0,0.6)';
      g.beginPath(); g.arc(rx, ry, 2.2, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.beginPath(); g.arc(rx - 0.6, ry - 0.6, 0.9, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }

  /** Small-caps letterspaced label. */
  label(x, y, text, size = 8, color = LABEL_GOLD) {
    const g = this.ctx;
    g.save();
    g.fillStyle = color;
    g.font = `700 ${size}px system-ui, sans-serif`;
    try { g.letterSpacing = '1.2px'; } catch (e) { /* older canvas */ }
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    g.fillText(text, x, y);
    g.restore();
  }

  /** Gold value with a soft glow, as if the digits were lit. */
  value(x, y, text, size = 19, color = GOLD) {
    const g = this.ctx;
    g.save();
    g.shadowColor = color;
    g.shadowBlur = 5;
    g.fillStyle = color;
    g.font = `800 ${size}px system-ui, sans-serif`;
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    g.fillText(text, x, y);
    g.restore();
  }

  /** Compact stat: label above the value, separated by a real gap.
   *  The unit (e.g. " km/h") is drawn smaller right after the number —
   *  a full "900 km/h" at value size is too wide for a compact column. */
  stat(x, y, labelText, valueText, unitText = '', valueSize = 19, valueColor = GOLD) {
    this.label(x, y, labelText);
    this.value(x, y + valueSize + 7, valueText, valueSize, valueColor);
    if (unitText) {
      const g = this.ctx;
      g.save();
      g.font = `800 ${valueSize}px system-ui, sans-serif`;
      const w = g.measureText(valueText).width;
      g.fillStyle = DIM;
      g.font = `700 ${Math.round(valueSize * 0.55)}px system-ui, sans-serif`;
      g.textAlign = 'left';
      g.textBaseline = 'alphabetic';
      g.fillText(unitText, x + w + 3, y + valueSize + 7);
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
      g.shadowBlur = 5;
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
    g.lineWidth = 4;
    g.beginPath();
    g.arc(cx, cy, r - 2, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = 'rgba(255,201,60,0.7)';
    g.lineWidth = 1;
    g.beginPath();
    g.arc(cx, cy, r - 4.5, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.55)';
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(cx, cy, r - 6, 0, Math.PI * 2);
    g.stroke();
    g.restore();
  }

  /** Round glass gauge: lit face, glowing needle, gold value arc,
   *  digital readout in the middle, label well below the face. */
  dial(cx, cy, r, frac, text, labelText) {
    const g = this.ctx;
    const f = Math.max(0, Math.min(1, frac));
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.5)';
    g.shadowBlur = 8;
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
    g.save();
    g.beginPath();
    g.arc(cx, cy, r - 6, 0, Math.PI * 2);
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
    g.shadowBlur = 5;
    g.strokeStyle = GOLD;
    g.lineWidth = 2.5;
    g.beginPath();
    g.arc(cx, cy, r - 9, Math.PI * 0.75, Math.PI * 0.75 + f * Math.PI * 1.5);
    g.stroke();
    g.restore();
    // Tick ring.
    g.strokeStyle = 'rgba(245,245,245,0.45)';
    g.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
      const x1 = cx + Math.cos(a) * (r - 11), y1 = cy + Math.sin(a) * (r - 11);
      const x2 = cx + Math.cos(a) * (r - 15), y2 = cy + Math.sin(a) * (r - 15);
      g.beginPath();
      g.moveTo(x1, y1); g.lineTo(x2, y2);
      g.stroke();
    }
    // Glowing needle.
    const a = Math.PI * 0.75 + f * Math.PI * 1.5;
    g.save();
    g.shadowColor = GOLD;
    g.shadowBlur = 6;
    g.strokeStyle = GOLD;
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(a) * (r - 16), cy + Math.sin(a) * (r - 16));
    g.stroke();
    g.fillStyle = GOLD;
    g.beginPath();
    g.arc(cx, cy, 3, 0, Math.PI * 2);
    g.fill();
    g.restore();
    // Digital readout.
    g.save();
    g.shadowColor = GOLD;
    g.shadowBlur = 5;
    g.fillStyle = WHITE;
    g.font = `800 ${Math.round(r * 0.38)}px system-ui, sans-serif`;
    g.textAlign = 'center';
    g.fillText(text, cx, cy + r * 0.5);
    g.restore();
    // Label BELOW the bezel with a clear gap.
    g.fillStyle = LABEL_GOLD;
    g.font = `700 ${Math.round(r * 0.3)}px system-ui, sans-serif`;
    g.textAlign = 'center';
    try { g.letterSpacing = '1.2px'; } catch (e) { /* older canvas */ }
    g.fillText(labelText, cx, cy + r + 10);
  }

  drawCompass(cx, y, w, heading) {
    const g = this.ctx;
    const s = this.s;
    const tapeH = 24 * s;
    this.panel(cx - w / 2, y, w, tapeH, 7);
    g.save();
    g.beginPath();
    g.roundRect(cx - w / 2 + 1, y + 1, w - 2, tapeH - 2, 6);
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
      g.moveTo(x, y + 5 * s);
      g.lineTo(x, y + (major ? 14 * s : mid ? 12 * s : 9 * s));
      g.stroke();
    }
    for (let deg0 = Math.floor((heading - 60) / 15) * 15; deg0 <= heading + 60; deg0 += 15) {
      const deg = ((deg0 % 360) + 360) % 360;
      const d = ((deg0 - heading + 540) % 360) - 180;
      const x = cx + d * pxPerDeg;
      const major = deg % 45 === 0;
      const c = cardinals.find(([v]) => v === deg);
      g.fillStyle = major ? GOLD : 'rgba(245,245,245,0.85)';
      g.font = `700 ${Math.round((major ? 10 : 8) * s)}px system-ui, sans-serif`;
      g.textAlign = 'center';
      g.fillText(c ? c[1] : String(deg).padStart(3, '0'), x, y + tapeH - 3 * s);
    }
    g.restore();
    // Centre caret pointing down to the heading chip.
    g.save();
    g.shadowColor = GOLD;
    g.shadowBlur = 5;
    g.fillStyle = GOLD;
    g.beginPath();
    g.moveTo(cx - 5 * s, y + tapeH - 1); g.lineTo(cx + 5 * s, y + tapeH - 1); g.lineTo(cx, y + tapeH + 5 * s);
    g.closePath(); g.fill();
    g.restore();
    // Heading readout in its OWN glass chip below the tape.
    const chipW = 64 * s, chipH = 18 * s;
    this.panel(cx - chipW / 2, y + tapeH + 6 * s, chipW, chipH, 6);
    g.save();
    g.shadowColor = GOLD;
    g.shadowBlur = 5;
    g.fillStyle = GOLD;
    g.font = `800 ${Math.round(12 * s)}px system-ui, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(Math.round(heading)).padStart(3, '0') + '°', cx, y + tapeH + 6 * s + chipH / 2 + 1);
    g.restore();
    g.textBaseline = 'alphabetic';
  }

  drawAttitude(cx, cy, r, pitchDeg, rollDeg) {
    const g = this.ctx;
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.5)';
    g.shadowBlur = 8;
    g.shadowOffsetY = 2;
    g.fillStyle = '#0B1B33';
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();
    g.restore();
    this.bezel(cx, cy, r);
    g.save();
    g.beginPath();
    g.arc(cx, cy, r - 6, 0, Math.PI * 2);
    g.clip();
    g.translate(cx, cy);
    g.rotate(-rollDeg * Math.PI / 180);
    const pitchPx = Math.max(-r, Math.min(r, pitchDeg * 1.2));
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
    // Horizon line + pitch ladder (lines only — at this size the
    // numbers were unreadable and half-clipped in v11).
    g.strokeStyle = WHITE;
    g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(-r, -pitchPx); g.lineTo(r, -pitchPx); g.stroke();
    g.lineWidth = 1;
    for (const p of [-20, -10, 10, 20]) {
      const yy = -pitchPx - p * 1.2;
      if (Math.abs(yy) > r - 10) continue;
      const wide = Math.abs(p) === 20;
      g.beginPath();
      g.moveTo(-r * (wide ? 0.5 : 0.35), yy);
      g.lineTo(r * (wide ? 0.5 : 0.35), yy);
      g.stroke();
    }
    g.restore();
    // Bank arc ticks around the top, with a gold pointer at the roll.
    g.strokeStyle = 'rgba(245,245,245,0.65)';
    g.lineWidth = 1.2;
    for (const b of [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60]) {
      const a = -Math.PI / 2 + b * Math.PI / 180;
      const x1 = cx + Math.cos(a) * (r - 7), y1 = cy + Math.sin(a) * (r - 7);
      const x2 = cx + Math.cos(a) * (r - (b % 30 === 0 ? 12 : 10)), y2 = cy + Math.sin(a) * (r - (b % 30 === 0 ? 12 : 10));
      g.beginPath();
      g.moveTo(x1, y1); g.lineTo(x2, y2);
      g.stroke();
    }
    const pa = -Math.PI / 2 + rollDeg * Math.PI / 180;
    g.save();
    g.shadowColor = GOLD;
    g.shadowBlur = 5;
    g.fillStyle = GOLD;
    g.beginPath();
    g.moveTo(cx + Math.cos(pa) * (r + 1), cy + Math.sin(pa) * (r + 1));
    g.lineTo(cx + Math.cos(pa - 0.12) * (r - 6), cy + Math.sin(pa - 0.12) * (r - 6));
    g.lineTo(cx + Math.cos(pa + 0.12) * (r - 6), cy + Math.sin(pa + 0.12) * (r - 6));
    g.closePath(); g.fill();
    g.restore();
    // Fixed aircraft symbol, glowing gold.
    g.save();
    g.shadowColor = GOLD;
    g.shadowBlur = 5;
    g.strokeStyle = GOLD;
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(cx - r * 0.55, cy); g.lineTo(cx - r * 0.15, cy);
    g.moveTo(cx + r * 0.15, cy); g.lineTo(cx + r * 0.55, cy);
    g.moveTo(cx, cy - 3); g.lineTo(cx, cy + 3);
    g.stroke();
    g.restore();
    g.save();
    g.beginPath();
    g.arc(cx, cy, r - 6, 0, Math.PI * 2);
    g.clip();
    const sheen = g.createLinearGradient(cx - r, cy - r, cx + r * 0.4, cy + r * 0.4);
    sheen.addColorStop(0, 'rgba(255,255,255,0.14)');
    sheen.addColorStop(0.5, 'rgba(255,255,255,0)');
    g.fillStyle = sheen;
    g.fillRect(cx - r, cy - r, r * 2, r * 2);
    g.restore();
    g.fillStyle = LABEL_GOLD;
    g.font = `700 ${Math.round(8 * this.s)}px system-ui, sans-serif`;
    g.textAlign = 'center';
    try { g.letterSpacing = '1.2px'; } catch (e) { /* older canvas */ }
    g.fillText('ATTITUDE', cx, cy + r + 11);
  }

  drawMinimap(x, y, w, h, state) {
    const g = this.ctx;
    const s = this.s;
    this.panel(x, y, w, h, 10);
    this.rivets(x, y, w, h);
    // Header strip: title left, live next-gate readout right.
    const nextIdx = state.ringsPassed;
    const next = COURSE[nextIdx];
    const distM = next ? Math.hypot(next.x - state.planeX, next.z - state.planeZ) : 0;
    g.save();
    g.fillStyle = 'rgba(255,255,255,0.07)';
    g.beginPath();
    g.roundRect(x + 2, y + 2, w - 4, 18 * s, 7);
    g.fill();
    g.restore();
    g.fillStyle = LABEL_GOLD;
    g.font = `700 ${Math.round(8 * s)}px system-ui, sans-serif`;
    g.textAlign = 'left';
    try { g.letterSpacing = '1.2px'; } catch (e) { /* older canvas */ }
    g.fillText('COURSE', x + 10 * s, y + 14 * s);
    g.textAlign = 'right';
    g.fillStyle = next ? GOLD : GREEN;
    g.font = `800 ${Math.round(9 * s)}px system-ui, sans-serif`;
    g.fillText(
      next ? `RING ${nextIdx + 1}/${COURSE.length} · ${(distM / 1000).toFixed(1)} km` : 'COURSE DONE',
      x + w - 10 * s, y + 14 * s,
    );
    g.textAlign = 'left';
    // Map window below the header.
    const my = y + 22 * s, mh = h - 26 * s;
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
    // The detailed terrain raster, windowed on the plane.
    const srcScale = MAP_PX / MAP_WORLD;
    g.drawImage(
      this.mapBase,
      (winX0 + MAP_WORLD / 2) * srcScale, (winZ0 + MAP_WORLD / 2) * srcScale,
      MAP_WINDOW_M * srcScale, MAP_WINDOW_M * srcScale,
      x, my, w, mh,
    );
    // Faint graticule, every 600 m — the MFD grid.
    g.strokeStyle = 'rgba(255,255,255,0.07)';
    g.lineWidth = 1;
    for (let k = 1; k < 4; k++) {
      const gx = x + (k / 4) * w;
      g.beginPath(); g.moveTo(gx, my); g.lineTo(gx, my + mh); g.stroke();
      const gy = my + (k / 4) * mh;
      g.beginPath(); g.moveTo(x, gy); g.lineTo(x + w, gy); g.stroke();
    }
    // Range rings around the plane (AC7 radar style): 300 / 600 / 900 m.
    const [pcx, pcy] = toMap(state.planeX, state.planeZ);
    g.strokeStyle = 'rgba(105,240,174,0.4)';
    g.lineWidth = 1;
    for (const rr of [300, 600, 900]) {
      const pr = rr / MAP_WINDOW_M * w;
      g.beginPath();
      g.arc(pcx, pcy, pr, 0, Math.PI * 2);
      g.stroke();
    }
    // Cross lines through the plane.
    g.strokeStyle = 'rgba(105,240,174,0.25)';
    g.beginPath(); g.moveTo(pcx, my); g.lineTo(pcx, my + mh); g.stroke();
    g.beginPath(); g.moveTo(x, pcy); g.lineTo(x + w, pcy); g.stroke();
    // North marker at the top edge.
    g.fillStyle = GOLD;
    g.font = `800 ${Math.round(9 * s)}px system-ui, sans-serif`;
    g.textAlign = 'center';
    g.fillText('N', pcx, my + 11 * s);
    // Course polyline through the gates, in order — solid glowing gold
    // for the legs ahead, green for the legs already flown.
    g.save();
    g.shadowColor = GOLD;
    g.shadowBlur = 6;
    g.strokeStyle = GOLD;
    g.lineWidth = 2.5;
    g.beginPath();
    COURSE.forEach((def, i) => {
      const [mx, my2] = toMap(def.x, def.z);
      if (i === 0) g.moveTo(mx, my2); else g.lineTo(mx, my2);
    });
    g.stroke();
    g.restore();
    if (nextIdx > 0) {
      g.strokeStyle = GREEN;
      g.lineWidth = 2;
      g.beginPath();
      for (let i = 0; i <= nextIdx && i < COURSE.length; i++) {
        const [mx, my2] = toMap(COURSE[i].x, COURSE[i].z);
        if (i === 0) g.moveTo(mx, my2); else g.lineTo(mx, my2);
      }
      g.stroke();
    }
    // Runway: pale strip + dashed centreline.
    const [rx, ry] = toMap(RUNWAY.x, RUNWAY.z);
    const rwLen = RUNWAY.length / MAP_WINDOW_M * w;
    g.strokeStyle = '#F5F5F5';
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(rx - rwLen / 2, ry);
    g.lineTo(rx + rwLen / 2, ry);
    g.stroke();
    g.strokeStyle = GOLD;
    g.lineWidth = 1;
    g.setLineDash([4, 4]);
    g.beginPath();
    g.moveTo(rx - rwLen / 2, ry);
    g.lineTo(rx + rwLen / 2, ry);
    g.stroke();
    g.setLineDash([]);
    // Bearing line: dashed gold from the plane to the next gate.
    if (next) {
      const [nx, ny] = toMap(next.x, next.z);
      g.strokeStyle = GOLD;
      g.lineWidth = 1.5;
      g.setLineDash([4, 4]);
      g.beginPath();
      g.moveTo(pcx, pcy);
      g.lineTo(nx, ny);
      g.stroke();
      g.setLineDash([]);
    }
    // Gates: numbered circles — gold next (pulsing glow), cyan later,
    // green passed.
    COURSE.forEach((def, i) => {
      const [mx, my2] = toMap(def.x, def.z);
      const col = i < nextIdx ? GREEN : (i === nextIdx ? GOLD : CYAN);
      g.save();
      g.shadowColor = col;
      g.shadowBlur = i === nextIdx ? 9 : 5;
      g.fillStyle = col;
      g.beginPath();
      g.arc(mx, my2, i === nextIdx ? 7 : 5.5, 0, Math.PI * 2);
      g.fill();
      g.restore();
      g.fillStyle = '#0B1B33';
      g.font = `800 ${Math.round(8 * s)}px system-ui, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String(i + 1), mx, my2 + 0.5);
      g.textBaseline = 'alphabetic';
    });
    // Plane icon, rotated by heading (0 = north = up), white with a
    // gold outline and a glow — it must read at a glance.
    const hd = state.heading * Math.PI / 180;
    g.save();
    g.translate(pcx, pcy);
    g.rotate(hd);
    g.shadowColor = WHITE;
    g.shadowBlur = 7;
    g.fillStyle = WHITE;
    g.strokeStyle = GOLD;
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(0, -9); g.lineTo(6, 7); g.lineTo(-6, 7);
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
    const pad = 10 * s;

    // ---- top-left: compact aircraft chip — title row + 3 stat columns --
    // v11: 340x104. v12: 252x66. Same three numbers, a third less panel.
    const lw = 252 * s, lh = 66 * s;
    this.panel(pad, pad, lw, lh);
    this.rivets(pad, pad, lw, lh);
    g.save();
    g.shadowColor = GOLD;
    g.shadowBlur = 5;
    g.fillStyle = GOLD;
    g.font = `800 ${Math.round(12 * s)}px system-ui, sans-serif`;
    g.textAlign = 'left';
    g.fillText('F-22 RAPTOR', pad + 12 * s, pad + 17 * s);
    g.restore();
    // Sublabel with a REAL right margin (v11 let it sit on the edge).
    g.fillStyle = DIM;
    g.font = `700 ${Math.round(8 * s)}px system-ui, sans-serif`;
    g.textAlign = 'right';
    try { g.letterSpacing = '1.5px'; } catch (e) { /* older canvas */ }
    g.fillText('MERPATI SENJA', pad + lw - 12 * s, pad + 17 * s);
    g.textAlign = 'left';
    g.strokeStyle = 'rgba(255,201,60,0.25)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(pad + 12 * s, pad + 23 * s);
    g.lineTo(pad + lw - 12 * s, pad + 23 * s);
    g.stroke();
    const colW = (lw - 24 * s) / 3;
    const colX = [pad + 12 * s, pad + 12 * s + colW, pad + 12 * s + colW * 2];
    g.strokeStyle = 'rgba(255,255,255,0.12)';
    for (const dx of [colX[1] - 6 * s, colX[2] - 6 * s]) {
      g.beginPath();
      g.moveTo(dx, pad + 29 * s);
      g.lineTo(dx, pad + lh - 7 * s);
      g.stroke();
    }
    this.stat(colX[0], pad + 35 * s, 'ALTITUDE', `${Math.round(state.alt)}`, ' m', Math.round(19 * s));
    this.stat(colX[1], pad + 35 * s, 'SPEED', `${Math.round(state.speedKmh)}`, ' km/h', Math.round(19 * s));
    this.stat(colX[2], pad + 35 * s, 'HEADING', `${String(Math.round(state.heading)).padStart(3, '0')}°`, '', Math.round(19 * s));
    // Vertical-speed trend arrow beside the altitude value.
    if (state.vspeed !== undefined) {
      const vs = state.vspeed;
      const arrow = vs > 0.8 ? '▲' : vs < -0.8 ? '▼' : '–';
      const col = vs > 0.8 ? GREEN : vs < -0.8 ? RED : DIM;
      g.fillStyle = col;
      g.font = `700 ${Math.round(12 * s)}px system-ui, sans-serif`;
      g.textAlign = 'right';
      g.fillText(arrow, colX[0] + colW - 8 * s, pad + 35 * s + 19 * s + 7 * s);
      g.textAlign = 'left';
    }

    // ---- top-centre: slim compass tape + separate heading chip ---------
    // v11: 400x36 tape. v12: 300x24 tape.
    this.drawCompass(w / 2, pad, 300 * s, state.heading);

    // ---- top-right: compact score card — 3 stat columns + bar rows -----
    // v11: 268x172. v12: 196x100.
    const rw = 196 * s, rh = 100 * s;
    const rx = w - pad - rw;
    this.panel(rx, pad, rw, rh);
    this.rivets(rx, pad, rw, rh);
    const scolW = (rw - 24 * s) / 3;
    const scolX = [rx + 12 * s, rx + 12 * s + scolW, rx + 12 * s + scolW * 2];
    this.stat(scolX[0], pad + 19 * s, 'SCORE', String(state.score), '', Math.round(18 * s));
    this.stat(scolX[1], pad + 19 * s, 'RINGS', `${state.ringsPassed}/${state.ringsTotal}`, '', Math.round(18 * s));
    const tcol = state.timeLeft < 30 ? RED : GOLD;
    this.stat(scolX[2], pad + 19 * s, 'TIME', `${Math.floor(state.timeLeft / 60)}:${String(Math.floor(state.timeLeft % 60)).padStart(2, '0')}`, '', Math.round(18 * s), tcol);
    g.strokeStyle = 'rgba(255,201,60,0.25)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(rx + 12 * s, pad + 52 * s);
    g.lineTo(rx + rw - 12 * s, pad + 52 * s);
    g.stroke();
    // Bar rows: label left, bar right — label never sits on the bar.
    const barRows = [
      ['THR', state.throttle, GOLD],
      ['FUEL', state.fuel / 100, state.fuel < 25 ? RED : GREEN],
      ['DMG', state.damage / 100, state.damage > 60 ? RED : '#FFB300'],
    ];
    barRows.forEach(([name, frac, col], i) => {
      const by = pad + (60 + i * 12) * s;
      this.label(rx + 12 * s, by + 7 * s, name);
      this.bar(rx + 48 * s, by, rw - 60 * s, 7 * s, frac, col);
    });
    // Afterburner badge: a small pill floating just under the card,
    // lit orange while the burners are on.
    if (state.afterburner) {
      const bw = 44 * s, bh = 14 * s;
      const bx = rx + rw - bw, by = pad + rh + 4 * s;
      g.save();
      g.shadowColor = '#FF7A18';
      g.shadowBlur = 8;
      g.fillStyle = '#FF7A18';
      g.beginPath();
      g.roundRect(bx, by, bw, bh, 7);
      g.fill();
      g.restore();
      g.fillStyle = '#1A0E00';
      g.font = `800 ${Math.round(10 * s)}px system-ui, sans-serif`;
      g.textAlign = 'center';
      g.fillText('AB', bx + bw / 2, by + bh - 4 * s);
      g.textAlign = 'left';
    }

    // ---- centre-top pill: next ring + bearing arrow -----------------------
    if (state.nextRingLabel) {
      const pill = state.nextRingLabel;
      g.font = `700 ${Math.round(13 * s)}px system-ui, sans-serif`;
      const tw = g.measureText(pill).width + 56 * s;
      const px = w / 2 - tw / 2, py = pad + 56 * s;
      this.panel(px, py, tw, 24 * s, 12);
      const rel = ((state.nextRingBearing - state.heading + 540) % 360) - 180;
      g.save();
      g.translate(px + 20 * s, py + 12 * s);
      g.rotate(rel * Math.PI / 180);
      g.shadowColor = GOLD;
      g.shadowBlur = 5;
      g.fillStyle = GOLD;
      g.beginPath();
      g.moveTo(0, -7 * s); g.lineTo(5 * s, 5 * s); g.lineTo(-5 * s, 5 * s);
      g.closePath(); g.fill();
      g.restore();
      g.fillStyle = WHITE;
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      g.fillText(pill, px + 34 * s, py + 12 * s + 1);
      g.textBaseline = 'alphabetic';
    }

    // ---- bottom: SMALL glass modules + the STAR map ----------------------
    // v11 bottom modules were 126 tall. v12 small modules are 84 tall;
    // the map stands 150 tall on the right — the one big instrument,
    // like a real G1000 MFD next to the small standby gauges.
    const modH = 84 * s;
    const sy = h - pad - modH;
    // Attitude card.
    const attW = 96 * s;
    this.panel(pad, sy, attW, modH, 9);
    this.rivets(pad, sy, attW, modH);
    this.drawAttitude(pad + attW / 2, sy + 34 * s, 26 * s, state.pitch, state.roll);
    // Dials card: ALT / SPD / HDG.
    const dialCardX = pad + attW + 10 * s;
    const dialCardW = 260 * s;
    this.panel(dialCardX, sy, dialCardW, modH, 9);
    this.rivets(dialCardX, sy, dialCardW, modH);
    const dcy = sy + 32 * s;
    const dr = 26 * s;
    const dstep = dialCardW / 3;
    this.dial(dialCardX + dstep * 0.5, dcy, dr, state.alt / 600, `${Math.round(state.alt)}`, 'ALT m');
    this.dial(dialCardX + dstep * 1.5, dcy, dr, state.speedKmh / 1300, `${Math.round(state.speedKmh)}`, 'SPD km/h');
    this.dial(dialCardX + dstep * 2.5, dcy, dr, state.heading / 360, `${String(Math.round(state.heading)).padStart(3, '0')}°`, 'HDG');
    // Throttle card: glass slot + glowing fill + 3D handle + big %.
    const thrX = dialCardX + dialCardW + 10 * s;
    const thrW = 78 * s;
    this.panel(thrX, sy, thrW, modH, 9);
    this.rivets(thrX, sy, thrW, modH);
    this.label(thrX + 10 * s, sy + 15 * s, 'THROTTLE');
    const slotX = thrX + 12 * s, slotY = sy + 22 * s, slotW = 12 * s, slotH = modH - 34 * s;
    g.fillStyle = 'rgba(255,255,255,0.14)';
    g.beginPath();
    g.roundRect(slotX, slotY, slotW, slotH, 6);
    g.fill();
    const thH = Math.max(0, Math.min(1, state.throttle)) * slotH;
    if (thH > 1) {
      g.save();
      g.shadowColor = GOLD;
      g.shadowBlur = 6;
      const grad = g.createLinearGradient(slotX, slotY + slotH, slotX, slotY);
      grad.addColorStop(0, GOLD);
      grad.addColorStop(1, '#FFE082');
      g.fillStyle = grad;
      g.beginPath();
      g.roundRect(slotX, slotY + slotH - thH, slotW, thH, 6);
      g.fill();
      g.restore();
      const hy = slotY + slotH - thH;
      g.save();
      g.shadowColor = 'rgba(0,0,0,0.6)';
      g.shadowBlur = 3;
      g.shadowOffsetY = 2;
      const hgrad = g.createLinearGradient(slotX - 5 * s, hy - 5 * s, slotX + slotW + 5 * s, hy + 5 * s);
      hgrad.addColorStop(0, '#FFE082');
      hgrad.addColorStop(0.5, GOLD);
      hgrad.addColorStop(1, '#B8860B');
      g.fillStyle = hgrad;
      g.beginPath();
      g.roundRect(slotX - 5 * s, hy - 5 * s, slotW + 10 * s, 10 * s, 5);
      g.fill();
      g.restore();
      g.strokeStyle = 'rgba(255,255,255,0.5)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(slotX - 2 * s, hy - 2.5 * s);
      g.lineTo(slotX + slotW + 2 * s, hy - 2.5 * s);
      g.stroke();
    }
    g.save();
    g.shadowColor = GOLD;
    g.shadowBlur = 5;
    g.fillStyle = WHITE;
    g.font = `800 ${Math.round(13 * s)}px system-ui, sans-serif`;
    g.textAlign = 'left';
    g.fillText(`${Math.round(state.throttle * 100)}%`, slotX + slotW + 8 * s, slotY + slotH / 2 + 5 * s);
    g.restore();
    // Moving map card, bottom-right — the star of the HUD.
    const mapW = 330 * s, mapH = 150 * s;
    this.drawMinimap(w - pad - mapW, h - pad - mapH, mapW, mapH, state);

    // ---- hint bar (fades after a few seconds) ----------------------------
    // Sits above the map's top edge so it never overlaps the MFD.
    if (state.hint) {
      g.fillStyle = 'rgba(11,27,51,0.72)';
      g.font = `600 ${Math.round(13 * s)}px system-ui, sans-serif`;
      const tw = g.measureText(state.hint).width + 28 * s;
      const hy = h - pad - 150 * s - 34 * s;
      g.beginPath();
      g.roundRect(w / 2 - tw / 2, hy, tw, 24 * s, 12);
      g.fill();
      g.fillStyle = WHITE;
      g.textAlign = 'center';
      g.fillText(state.hint, w / 2, hy + 16 * s);
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
      g.font = `800 ${Math.round(26 * s)}px system-ui, sans-serif`;
      g.textAlign = 'center';
      g.fillText(state.message, w / 2, my + 42 * s + 14);
      g.restore();
      g.fillStyle = WHITE;
      g.font = `600 ${Math.round(14 * s)}px system-ui, sans-serif`;
      g.textAlign = 'center';
      g.fillText(state.subMessage || '', w / 2, my + 42 * s + 44);
      g.textAlign = 'left';
    }

    // v21 credit (CC BY 4.0): the jet is a real model, not a sculpt —
    // attribution stays on screen, tiny and dim, bottom centre margin.
    g.save();
    g.fillStyle = 'rgba(245,245,245,0.45)';
    g.font = `500 ${Math.round(10 * s)}px system-ui, sans-serif`;
    g.textAlign = 'center';
    g.fillText('Jet model: “Multirole Fighter” by vinish.dev, CC BY 4.0', w / 2, h - 4 * s);
    g.restore();
  }
}
