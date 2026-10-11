// Inline SVG item icons + canvas previews for the locker (no image files needed).
import { CATALOG, SKIN_TONES, HAIR_COLORS } from '../cosmetics.js';
import { jerseyTexture } from '../render/textures.js';

// Line icons in the same style as the menu icons: one stroke colour (currentColor, so they follow
// the surface they sit on) plus a single accent colour per item. No tiles, outlines or gloss.
const L = 'fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"';
const A = (c) => `fill="none" stroke="${c}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
const S = (inner) => `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;

export const ITEM_SVG = {
  shield: S(`<circle cx="24" cy="24" r="17" ${L}/><circle cx="24" cy="24" r="10" ${A('#8a5cf6')} stroke-dasharray="4 4"/><path d="M14 20a11 11 0 0 1 7-7" ${A('#8a5cf6')}/>`),
  barricade: S(`<path d="M12 30v12M36 30v12M8 42h8M32 42h8" ${L}/><path d="M6 16h36v14H6z" ${L}/><path d="M13 30l8-14M25 30l8-14" ${A('#ff8a00')}/>`),
  speed: S(`<path d="M15 12h18v30H15z" ${L}/><path d="M18 12V6h12v6" ${L}/><path d="M26 17l-5 9h6l-3 10" ${A('#19c26b')}/>`),
  oil: S(`<path d="M24 5c7 10 11 15 11 21a11 11 0 0 1-22 0c0-6 4-11 11-21z" ${L}/><path d="M18 27a6 6 0 0 0 5 6" ${A('#7b4fe0')}/><path d="M6 43h36" ${L}/>`),
  shotgun: S(`<path d="M4 17h31v6H4zM4 23h20" ${L}/><path d="M35 20h6l2 3-2 3h-5l-5 13h-6l4-12" ${L}/><path d="M38 10l3-4M42 14l4-2" ${A('#ff7a1a')}/>`),
  grapple: S(`<path d="M24 9v16" ${L}/><path d="M13 25c0 9 5 15 11 15s11-6 11-15" ${L}/><path d="M13 25l-5 5M35 25l5 5" ${L}/><circle cx="24" cy="7" r="3" ${A('#16b36a')}/>`),
  magnet: S(`<path d="M11 7h9v17a4 4 0 0 0 8 0V7h9v17a13 13 0 0 1-26 0z" ${L}/><path d="M11 14h9M28 14h9" ${A('#e8274a')}/><path d="M17 44c4 2 10 2 14 0" ${A('#e8274a')}/>`),
  mines: S(`<path d="M8 36c0-6 7-10 16-10s16 4 16 10" ${L}/><path d="M5 36h38" ${L}/><path d="M20 26v-6h8v6" ${L}/><circle cx="24" cy="14" r="3" ${A('#e8274a')}/><path d="M16 8l-2-3M32 8l2-3" ${A('#e8274a')}/>`),
  punch: S(`<path d="M20 13h12a8 8 0 0 1 8 8v6a8 8 0 0 1-8 8H20z" ${L}/><path d="M20 19h-6v10h6M27 13v8M33 14v7" ${L}/><path d="M12 24H3M10 17l-6-2M10 31l-6 2" ${A('#ff3355')}/>`),
  fire: S(`<circle cx="24" cy="24" r="18" ${L}/><path d="M27 9l-10 16h7l-4 14 11-17h-7z" ${A('#1aa7d8')}/>`),
  flintlock: S(`<path d="M5 16h29l3 5H9z" ${L}/><path d="M31 21h7l2 4-6 14h-7l4-12" ${L}/><path d="M23 21l-1 5 4 1" ${L}/><path d="M38 9l2-4M42 13l4-2" ${A('#c98a3e')}/>`),
  ice: S(`<path d="M4 17h20l5 5v4H11l-7-4z" ${L}/><path d="M12 26h8l-3 12h-6z" ${L}/><path d="M39 13v20M30.5 18l17 10M30.5 28l17-10" ${A('#2fb6ff')}/>`),
  bazooka: S(`<path d="M5 30l29-12 4 9-29 12z" ${L}/><path d="M14 35l2 8h5l-1-9" ${L}/><path d="M34 18l7-3 4 8-6 5" ${A('#e8402a')}/>`),
  jet: S(`<path d="M24 4c6 5 8 12 8 20v9H16v-9c0-8 2-15 8-20z" ${L}/><circle cx="24" cy="18" r="3.5" ${L}/><path d="M16 25l-6 8h6M32 25l6 8h-6" ${L}/><path d="M20 38l4 7 4-7" ${A('#ff8a00')}/>`),
};

export function itemSvg(kind) { return ITEM_SVG[kind] || ''; }

function cv(size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

export function previewJersey(id, team = 0) {
  const c = cv();
  const g = c.getContext('2d');
  const t = jerseyTexture(id, team, 10);
  g.save();
  g.beginPath();
  g.moveTo(40, 18); g.lineTo(54, 14); g.quadraticCurveTo(64, 24, 74, 14); g.lineTo(88, 18); g.lineTo(112, 38); g.lineTo(100, 56); g.lineTo(90, 48); g.lineTo(90, 112); g.lineTo(38, 112); g.lineTo(38, 48); g.lineTo(28, 56); g.lineTo(16, 38); g.closePath();
  g.clip();
  g.drawImage(t.image, 128, 0, 256, 256, 8, 4, 112, 120);
  g.restore();
  g.lineWidth = 4; g.strokeStyle = '#1b1530';
  g.beginPath();
  g.moveTo(40, 18); g.lineTo(54, 14); g.quadraticCurveTo(64, 24, 74, 14); g.lineTo(88, 18); g.lineTo(112, 38); g.lineTo(100, 56); g.lineTo(90, 48); g.lineTo(90, 112); g.lineTo(38, 112); g.lineTo(38, 48); g.lineTo(28, 56); g.lineTo(16, 38); g.closePath();
  g.stroke();
  t.dispose();
  return c;
}

export function previewBall(id) {
  const b = CATALOG.ball.find((x) => x.id === id) || CATALOG.ball[0];
  const c = cv();
  const g = c.getContext('2d');
  g.save();
  g.beginPath(); g.arc(64, 64, 44, 0, Math.PI * 2); g.clip();
  g.fillStyle = b.a; g.fillRect(0, 0, 128, 128);
  g.fillStyle = b.b;
  if (b.stripes) {
    for (let i = 0; i < 6; i += 2) { g.beginPath(); g.moveTo(64, 64); g.arc(64, 64, 50, (i / 6) * Math.PI * 2, ((i + 1) / 6) * Math.PI * 2); g.fill(); }
  } else {
    const spot = (x, y, r) => { g.beginPath(); for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2 - Math.PI / 2; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath(); g.fill(); };
    spot(64, 64, 15); spot(64, 24, 12); spot(28, 52, 11); spot(100, 52, 11); spot(40, 96, 11); spot(88, 96, 11);
  }
  const sh = g.createRadialGradient(48, 44, 4, 64, 64, 50);
  sh.addColorStop(0, 'rgba(255,255,255,0.45)'); sh.addColorStop(0.6, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.3)');
  g.fillStyle = sh; g.fillRect(0, 0, 128, 128);
  g.restore();
  g.lineWidth = 4; g.strokeStyle = '#1b1530'; g.beginPath(); g.arc(64, 64, 44, 0, Math.PI * 2); g.stroke();
  if (b.glow) { g.shadowColor = b.b; g.shadowBlur = 20; g.stroke(); }
  return c;
}

export function previewGoalFx(id) {
  const c = cv();
  const g = c.getContext('2d');
  const r = (a, b) => a + Math.random() * (b - a);
  g.fillStyle = '#2a2140'; g.fillRect(0, 0, 128, 128);
  switch (id) {
    case 'hearts':
      for (let i = 0; i < 9; i++) {
        const x = r(14, 114), y = r(14, 114), s = r(8, 16);
        g.fillStyle = `hsl(${r(330, 360)},90%,70%)`;
        g.beginPath(); g.moveTo(x, y + s * 0.6); g.bezierCurveTo(x - s, y - s * 0.2, x - s * 0.5, y - s, x, y - s * 0.4); g.bezierCurveTo(x + s * 0.5, y - s, x + s, y - s * 0.2, x, y + s * 0.6); g.fill();
      }
      break;
    case 'fireworks':
      for (const [x, y, h] of [[40, 44, 50], [88, 52, 320], [62, 92, 140]]) {
        g.strokeStyle = `hsl(${h},90%,65%)`; g.lineWidth = 3;
        for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; g.beginPath(); g.moveTo(x + Math.cos(a) * 6, y + Math.sin(a) * 6); g.lineTo(x + Math.cos(a) * 22, y + Math.sin(a) * 22); g.stroke(); }
      }
      break;
    case 'frost':
      g.strokeStyle = '#bff6ff'; g.lineWidth = 6; g.lineCap = 'round';
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + Math.cos(a) * 44, 64 + Math.sin(a) * 44); g.stroke(); }
      g.fillStyle = '#5fe3ff'; g.beginPath(); g.arc(64, 64, 10, 0, Math.PI * 2); g.fill();
      break;
    case 'lightning':
      g.fillStyle = '#fff27a'; g.strokeStyle = '#1b1530'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(72, 10); g.lineTo(38, 70); g.lineTo(60, 70); g.lineTo(50, 118); g.lineTo(92, 52); g.lineTo(68, 52); g.lineTo(82, 10); g.closePath(); g.fill(); g.stroke();
      break;
    case 'blackhole': {
      const gr = g.createRadialGradient(64, 64, 4, 64, 64, 56);
      gr.addColorStop(0, '#000'); gr.addColorStop(0.35, '#2a0a55'); gr.addColorStop(0.7, '#9b5cff'); gr.addColorStop(1, 'rgba(155,92,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
      break;
    }
    default:
      for (let i = 0; i < 60; i++) { g.fillStyle = ['#ff3b5c', '#3b8bff', '#ffd23f', '#4cf08a', '#c27bff', '#fff'][i % 6]; g.fillRect(r(8, 120), r(8, 120), r(5, 10), r(4, 8)); }
  }
  return c;
}

const EMOTE_POSE = {
  wave: [[-0.3, 0.4], [-2.6, 0.2]], clap: [[-1.2, 0.5], [1.2, 0.5]], bow: [[0.4, 0.4], [-0.4, 0.4]], flex: [[-1.5, -1.6], [1.5, -1.6]],
  cheer: [[-2.6, 0], [2.6, 0]], dance: [[-1.8, -0.6], [0.6, 0.6]], laugh: [[-0.6, 1.4], [0.6, 1.4]], spin: [[-1.57, 0], [1.57, 0]],
  robot: [[-1.57, 1.57], [1.57, 0]], sit: [[-0.4, 0], [0.4, 0]],
};

export function previewEmote(id) {
  const c = cv();
  const g = c.getContext('2d');
  g.fillStyle = '#2a2140'; g.fillRect(0, 0, 128, 128);
  const pose = EMOTE_POSE[id] || EMOTE_POSE.wave;
  const sit = id === 'sit', bow = id === 'bow';
  const cx = 64, hipY = sit ? 92 : 84;
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = '#fff'; g.lineWidth = 9;
  // legs
  g.beginPath();
  if (sit) { g.moveTo(cx, hipY); g.lineTo(cx + 26, hipY); g.lineTo(cx + 30, hipY + 18); } else { g.moveTo(cx - 6, hipY); g.lineTo(cx - 12, 116); g.moveTo(cx + 6, hipY); g.lineTo(cx + 12, 116); }
  g.stroke();
  // body
  const nx = bow ? cx + 18 : cx, ny = bow ? 60 : 52;
  g.strokeStyle = '#ff3b5c'; g.lineWidth = 18;
  g.beginPath(); g.moveTo(cx, hipY - 4); g.lineTo(nx, ny + 6); g.stroke();
  // arms
  g.strokeStyle = '#ffdcc0'; g.lineWidth = 8;
  const arm = (side, [a1, a2]) => {
    const sx = nx + side * 10, sy = ny + 10;
    const ex = sx + Math.sin(a1) * -16 * side * -1, ey = sy + Math.cos(a1) * 16;
    const hx = ex + Math.sin(a1 + a2 * side) * -14 * side * -1, hy = ey + Math.cos(a1 + a2 * side) * 14;
    g.beginPath(); g.moveTo(sx, sy); g.lineTo(ex, ey); g.lineTo(hx, hy); g.stroke();
  };
  arm(-1, pose[0]); arm(1, pose[1]);
  // head
  g.fillStyle = '#ffdcc0'; g.strokeStyle = '#1b1530'; g.lineWidth = 3;
  g.beginPath(); g.arc(nx, ny - 14, 17, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = '#1b1530'; g.beginPath(); g.arc(nx - 6, ny - 15, 2.5, 0, Math.PI * 2); g.arc(nx + 6, ny - 15, 2.5, 0, Math.PI * 2); g.fill();
  if (id === 'spin') { g.strokeStyle = '#ffd23f'; g.lineWidth = 3; g.beginPath(); g.arc(cx, 70, 46, 0.3, 2.6); g.stroke(); }
  return c;
}

export function previewHair(id, colorIdx = 0, skinIdx = 1) {
  const c = cv();
  const g = c.getContext('2d');
  g.fillStyle = '#e9e1fa'; g.fillRect(0, 0, 128, 128);
  const hc = HAIR_COLORS[colorIdx] || HAIR_COLORS[0];
  const sk = SKIN_TONES[skinIdx] || SKIN_TONES[1];
  g.lineWidth = 4; g.strokeStyle = '#1b1530';
  g.fillStyle = sk; g.beginPath(); g.arc(64, 72, 38, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = '#1b1530';
  g.beginPath(); g.ellipse(52, 76, 4, 7, 0, 0, Math.PI * 2); g.ellipse(76, 76, 4, 7, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = hc;
  const capTop = () => { g.beginPath(); g.arc(64, 70, 41, Math.PI * 1.05, Math.PI * 1.95); g.closePath(); g.fill(); g.stroke(); };
  switch (id) {
    case 'bob': g.beginPath(); g.arc(64, 70, 43, Math.PI * 0.95, Math.PI * 2.05); g.lineTo(108, 92); g.lineTo(98, 92); g.lineTo(96, 60); g.lineTo(32, 60); g.lineTo(30, 92); g.lineTo(20, 92); g.closePath(); g.fill(); g.stroke(); break;
    case 'cap': g.fillStyle = '#ff3b5c'; capTop(); g.fillRect(30, 50, 68, 8); break;
    case 'mohawk': capTop(); for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(52 + i * 8, 34); g.lineTo(56 + i * 8, 10 + (i % 2) * 6); g.lineTo(60 + i * 8, 34); g.fill(); g.stroke(); } break;
    case 'buns': capTop(); for (const x of [30, 98]) { g.beginPath(); g.arc(x, 36, 14, 0, Math.PI * 2); g.fill(); g.stroke(); } break;
    case 'afro': g.beginPath(); for (let k = 0; k < 10; k++) { const a = Math.PI + (k / 9) * Math.PI; g.arc(64 + Math.cos(a) * 42, 62 + Math.sin(a) * 42, 16, 0, Math.PI * 2); } g.fill(); break;
    case 'beanie': g.fillStyle = '#3b8bff'; capTop(); g.fillStyle = '#fff'; g.beginPath(); g.arc(64, 26, 9, 0, Math.PI * 2); g.fill(); g.stroke(); break;
    case 'crown': capTop(); g.fillStyle = '#ffcf3f'; g.beginPath(); g.moveTo(40, 40); g.lineTo(40, 18); g.lineTo(52, 30); g.lineTo(64, 12); g.lineTo(76, 30); g.lineTo(88, 18); g.lineTo(88, 40); g.closePath(); g.fill(); g.stroke(); break;
    default: capTop(); for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(30 + i * 12, 40); g.lineTo(34 + i * 12, 16 + (i % 2) * 8); g.lineTo(42 + i * 12, 40); g.fill(); g.stroke(); }
  }
  return c;
}
