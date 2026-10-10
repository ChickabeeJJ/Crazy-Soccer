// Inline SVG item icons + canvas previews for the locker (no image files needed).
import { CATALOG, SKIN_TONES, HAIR_COLORS } from '../cosmetics.js';
import { jerseyTexture } from '../render/textures.js';

const S = (inner, bg) => `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="30" fill="${bg}" stroke="#1b1530" stroke-width="4"/>${inner}</svg>`;

export const ITEM_SVG = {
  fire: S('<path d="M32 10c4 9 14 14 14 27a14 14 0 0 1-28 0c0-7 4-11 7-15 0 5 2 8 5 9-2-8 0-15 2-21z" fill="#ffd23f" stroke="#1b1530" stroke-width="3"/><path d="M32 30c3 4 7 7 7 12a7 7 0 0 1-14 0c0-4 3-7 7-12z" fill="#ff5a1f"/>', '#ff7a1a'),
  ice: S('<g stroke="#fff" stroke-width="5" stroke-linecap="round"><path d="M32 12v40M15 22l34 20M15 42l34-20"/></g><g stroke="#1b1530" stroke-width="2" fill="none"><circle cx="32" cy="32" r="5" fill="#bff6ff"/></g>', '#3fc8ff'),
  oil: S('<path d="M32 12c8 12 14 19 14 27a14 14 0 0 1-28 0c0-8 6-15 14-27z" fill="#2a1d4a" stroke="#1b1530" stroke-width="3"/><path d="M26 38a6 6 0 0 0 6 6" stroke="#c9a6ff" stroke-width="3" fill="none" stroke-linecap="round"/>', '#9b6bff'),
  jet: S('<path d="M32 10c7 6 10 15 10 24v8H22v-8c0-9 3-18 10-24z" fill="#fff" stroke="#1b1530" stroke-width="3"/><circle cx="32" cy="27" r="4" fill="#3fa9ff" stroke="#1b1530" stroke-width="2"/><path d="M22 36l-6 8h6M42 36l6 8h-6" fill="#ff4466" stroke="#1b1530" stroke-width="2"/><path d="M27 44l5 10 5-10z" fill="#ff8a1f"/>', '#ffd23f'),
  grapple: S('<path d="M32 10v26" stroke="#1b1530" stroke-width="5" stroke-linecap="round"/><path d="M20 30c0 12 6 18 12 18s12-6 12-18" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/><path d="M20 30l-5 6M44 30l5 6" stroke="#fff" stroke-width="5" stroke-linecap="round"/><circle cx="32" cy="12" r="4" fill="#fff" stroke="#1b1530" stroke-width="2"/>', '#2ec46f'),
  punch: S('<rect x="17" y="18" width="30" height="24" rx="11" fill="#ff4466" stroke="#1b1530" stroke-width="3"/><rect x="22" y="40" width="20" height="10" rx="3" fill="#fff" stroke="#1b1530" stroke-width="3"/><path d="M24 26c4-3 10-3 14 0" stroke="#ffc1cc" stroke-width="3" fill="none" stroke-linecap="round"/>', '#ffd0d8'),
  speed: S('<path d="M36 8L18 36h12l-4 20 20-30H34l2-18z" fill="#ffe14a" stroke="#1b1530" stroke-width="3" stroke-linejoin="round"/>', '#4cd964'),
  shield: S('<circle cx="32" cy="32" r="17" fill="rgba(255,255,255,0.35)" stroke="#fff" stroke-width="4"/><circle cx="25" cy="25" r="5" fill="#fff"/>', '#b27bff'),
  barricade: S('<rect x="12" y="20" width="40" height="13" fill="#fff" stroke="#1b1530" stroke-width="3"/><path d="M18 33l8-13M30 33l8-13M42 33l8-13" stroke="#e8304f" stroke-width="5"/><path d="M17 33v15M47 33v15" stroke="#ffb000" stroke-width="5"/><path d="M11 48h12M41 48h12" stroke="#1b1530" stroke-width="4"/>', '#ffd36b'),
  barrel: S('<rect x="17" y="14" width="30" height="36" rx="7" fill="#2f6fe0" stroke="#1b1530" stroke-width="3"/><path d="M17 24h30M17 40h30" stroke="#1b2340" stroke-width="4"/><path d="M24 18v28" stroke="#7fb0ff" stroke-width="3" stroke-linecap="round"/>', '#9ec5ff'),
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
