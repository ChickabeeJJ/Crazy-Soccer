// Inline SVG item icons + canvas previews for the locker (no image files needed).
import { CATALOG, SKIN_TONES, HAIR_COLORS } from '../cosmetics.js';
import { jerseyTexture } from '../render/textures.js';

// Item icons in the menu style: currentColor line work (follows the surface they sit on) over a
// soft tinted body fill, with solid accent parts in each item's colour. No tiles or thick outlines.
const L = 'stroke="currentColor" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"';
const T = `fill="currentColor" fill-opacity="0.13" ${L}`; // tinted body
const N = `fill="none" ${L}`;
const F = (c, o = 1) => `fill="${c}" fill-opacity="${o}" ${L}`; // accent fill with line work
const A = (c) => `fill="none" stroke="${c}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"`;
const S = (inner) => `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;

export const ITEM_SVG = {
  shield: S(`<circle cx="24" cy="25" r="18" ${F('#8a5cf6', 0.25)}/><path d="M12 19a13 13 0 0 1 8-8" ${A('#c8b0ff')}/><circle cx="24" cy="21" r="3.6" fill="currentColor"/><path d="M17 35c1-5 3.6-7.5 7-7.5s6 2.5 7 7.5" ${N}/>`),
  barricade: S(`<path d="M12 27v13M36 27v13M8 40h8M32 40h8" ${N}/><rect x="5" y="15" width="38" height="12" rx="1.5" ${T}/><path d="M11 27l6-12M22 27l6-12M33 27l6-12" ${A('#ff8a00')} stroke-width="3.4"/><circle cx="9" cy="11" r="2.6" ${F('#ff3b5c')}/><circle cx="39" cy="11" r="2.6" ${F('#ff3b5c')}/>`),
  speed: S(`<rect x="14" y="11" width="20" height="30" rx="3.5" ${F('#19c26b', 0.28)}/><path d="M16 11l2-4h12l2 4M14 18h20" ${N}/><path d="M26.5 16l-7.5 11h5.5l-3 9 8.5-12.5h-5.5l2-7.5z" ${F('#ffcf3f')} stroke-width="1.8"/>`),
  oil: S(`<ellipse cx="24" cy="41" rx="17" ry="3.6" ${F('#7b4fe0', 0.35)}/><path d="M24 4c7 10 11 15 11 21a11 11 0 0 1-22 0c0-6 4-11 11-21z" ${F('#3d2878', 0.9)}/><path d="M18.5 26a6 6 0 0 0 4.5 6" ${A('#c8b0ff')}/>`),
  shotgun: S(`<path d="M5 15h27v4H5zM5 20h23v3.5H5z" ${T}/><rect x="13" y="24" width="10" height="4" rx="1.5" ${F('#ff7a1a')}/><path d="M32 15h6l2.5 4-1 4.5h-4.5l-6 14h-7l5-12" ${F('#a8743e')}/><circle cx="1.8" cy="13" r="1.4" fill="#ffb347"/><circle cx="1.4" cy="19" r="1.4" fill="#ffb347"/><circle cx="1.8" cy="25" r="1.4" fill="#ffb347"/>`),
  grapple: S(`<path d="M24 3v9" ${A('#16b36a')} stroke-dasharray="2.5 3"/><circle cx="24" cy="14.5" r="3" ${F('#16b36a')}/><path d="M24 17.5v18" ${N}/><path d="M24 36c-8.5 0-13-5.5-13-12.5M24 36c8.5 0 13-5.5 13-12.5" ${N}/><path d="M11 23.5l-3.5 3M37 23.5l3.5 3M24 36v6" ${N}/><path d="M7.5 26.5l4 1M40.5 26.5l-4 1" ${N}/>`),
  magnet: S(`<path d="M9 6h11v17a4 4 0 0 0 8 0V6h11v17a15 15 0 0 1-30 0z" ${F('#e8274a')}/><path d="M9 6h11v7H9zM28 6h11v7H28z" ${F('#eef1f6')}/><path d="M14 43c6 3 14 3 20 0M18 47c4 1 8 1 12 0" ${A('#ff6a86')}/>`),
  mines: S(`<path d="M5 34h38v4.5H5z" ${T}/><path d="M8 34c0-7.5 7-12.5 16-12.5S40 26.5 40 34z" ${F('#6b7a3a', 0.9)}/><path d="M20.5 21.5v-5h7v5" ${T}/><circle cx="24" cy="12.5" r="3" ${F('#ff3b5c')}/><path d="M16 9l-2.5-3M32 9l2.5-3M24 5V2" ${A('#ff6a86')}/>`),
  punch: S(`<path d="M8 18H2M9 25H1M8 32H2" ${A('#ff8a00')}/><rect x="11" y="15" width="7" height="20" rx="1.5" ${F('#eef1f6')}/><path d="M18 11h11a11 11 0 0 1 11 11v7a10 10 0 0 1-10 10H18z" ${F('#e8274a')}/><path d="M22 30c-3.5 0-5-2.5-4.5-5.5" ${N}/><path d="M27 14c5 0 8.5 3 9 7" ${A('#ff9aae')}/>`),
  fire: S(`<circle cx="24" cy="24" r="18.5" ${F('#1aa7d8', 0.18)}/><path d="M24 2.5v4M24 41.5v4M2.5 24h4M41.5 24h4" ${A('#1aa7d8')}/><path d="M27.5 9.5l-11 16h7l-4 13 12-17.5h-7.5l3.5-11.5z" ${F('#ffcf3f')} stroke-width="2"/>`),
  flintlock: S(`<path d="M4 14h27l3 5H7z" ${T}/><path d="M29 19h8.5l2 5-6.5 15h-7.5l4.5-12" ${F('#a8743e')}/><path d="M22 19c0 5 2 7 5 7" ${N}/><path d="M33 13l3-6 3 1.5-2.5 5.5" ${F('#c98a3e')}/><circle cx="2.6" cy="16.5" r="1.8" fill="#ffcf3f"/>`),
  ice: S(`<path d="M3 16h21l5 5v5H11l-8-4z" ${F('#2fb6ff', 0.25)}/><path d="M12 26h8l-3 12h-7z" ${T}/><circle cx="8.5" cy="21" r="2" fill="#2fb6ff"/><path d="M39 11v22M29.5 16.5l19 11M29.5 27.5l19-11" ${A('#2fb6ff')}/><circle cx="39" cy="22" r="2.4" fill="#eaf8ff"/>`),
  bazooka: S(`<path d="M4 30l30-12 4.5 9.5-30 12z" ${F('#7a8a45', 0.9)}/><path d="M14 23.5l3.5 9M24 19.5l3.5 9" ${N}/><path d="M34 18l7.5-3 4.5 9.5-7.5 3" ${F('#e8402a')}/><path d="M15 36l2 8h5l-1-9.5" ${T}/>`),
  jet: S(`<rect x="10" y="8" width="11" height="25" rx="5" ${F('#ff8a00', 0.85)}/><rect x="27" y="8" width="11" height="25" rx="5" ${F('#ff8a00', 0.85)}/><path d="M21 15h6M21 25h6" ${N}/><path d="M12.5 33l1.5 4h3l1.5-4M29.5 33l1.5 4h3l1.5-4" ${T}/><path d="M15.5 38c-2 3-1 6 0 8 1-2 2-5 0-8zM32.5 38c-2 3-1 6 0 8 1-2 2-5 0-8z" ${F('#ffcf3f')} stroke-width="1.6"/>`),
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

// Goal effect previews: a little night-stadium goal mouth with the effect bursting out of it
export function previewGoalFx(id) {
  const W = 312, H = 260;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const r = (a, b) => a + rnd() * (b - a);
  // backdrop
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#120d26'); bg.addColorStop(0.65, '#2a1f52'); bg.addColorStop(1, '#0d3a26');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(255,255,255,0.05)';
  for (let x = 0; x < W; x += 26) g.fillRect(x, 0, 1, H * 0.7);
  // pitch + goal mouth
  g.fillStyle = '#145c3a'; g.fillRect(0, H * 0.78, W, H * 0.22);
  const gx = W / 2, gy = H * 0.8, gw = 150, gh = 70;
  g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(gx - gw / 2, gy - gh, gw, gh);
  g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 1;
  for (let x = gx - gw / 2; x <= gx + gw / 2; x += 12) { g.beginPath(); g.moveTo(x, gy - gh); g.lineTo(x, gy); g.stroke(); }
  for (let y = gy - gh; y <= gy; y += 12) { g.beginPath(); g.moveTo(gx - gw / 2, y); g.lineTo(gx + gw / 2, y); g.stroke(); }
  g.strokeStyle = '#f3efe6'; g.lineWidth = 6; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(gx - gw / 2, gy); g.lineTo(gx - gw / 2, gy - gh); g.lineTo(gx + gw / 2, gy - gh); g.lineTo(gx + gw / 2, gy); g.stroke();
  const cx = gx, cy = gy - gh * 0.55;
  const glow = (x, y, rad, col, a = 1) => { const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.globalAlpha = a; g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); g.globalAlpha = 1; };
  g.globalCompositeOperation = 'lighter';
  switch (id) {
    case 'hearts': {
      glow(cx, cy, 120, 'rgba(255,80,150,0.55)');
      const heart = (x, y, s, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(x, y + s * 0.7); g.bezierCurveTo(x - s * 1.2, y - s * 0.1, x - s * 0.6, y - s, x, y - s * 0.35); g.bezierCurveTo(x + s * 0.6, y - s, x + s * 1.2, y - s * 0.1, x, y + s * 0.7); g.fill(); };
      for (let i = 0; i < 16; i++) { const a = r(-Math.PI, 0), d = r(20, 120); heart(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.9, r(7, 18), `hsl(${r(325, 355)},95%,${r(62, 74)}%)`); }
      break;
    }
    case 'fireworks': {
      for (const [x, y, h] of [[90, 70, 48], [210, 58, 320], [156, 110, 190]]) {
        glow(x, y, 70, `hsla(${h},100%,60%,0.5)`);
        for (let k = 0; k < 22; k++) {
          const a = (k / 22) * Math.PI * 2, d1 = 10, d2 = r(34, 50);
          g.strokeStyle = `hsl(${h},100%,${r(60, 75)}%)`; g.lineWidth = 2.4;
          g.beginPath(); g.moveTo(x + Math.cos(a) * d1, y + Math.sin(a) * d1); g.lineTo(x + Math.cos(a) * d2, y + Math.sin(a) * d2); g.stroke();
          g.fillStyle = '#fff'; g.beginPath(); g.arc(x + Math.cos(a) * d2, y + Math.sin(a) * d2, 1.8, 0, Math.PI * 2); g.fill();
        }
      }
      break;
    }
    case 'frost': {
      glow(cx, cy, 130, 'rgba(120,230,255,0.6)');
      g.strokeStyle = '#d8fbff'; g.lineCap = 'round';
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        g.lineWidth = 5; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * 62, cy + Math.sin(a) * 62); g.stroke();
        g.lineWidth = 3;
        for (const t of [0.45, 0.72]) { const px = cx + Math.cos(a) * 62 * t, py = cy + Math.sin(a) * 62 * t; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(a + s * 0.8) * 14, py + Math.sin(a + s * 0.8) * 14); g.stroke(); } }
      }
      for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(200,250,255,${r(0.4, 0.9)})`; g.beginPath(); g.arc(r(20, W - 20), r(20, H * 0.75), r(1, 3), 0, Math.PI * 2); g.fill(); }
      break;
    }
    case 'lightning': {
      glow(cx, cy, 140, 'rgba(255,240,120,0.5)');
      const bolt = (x0, y0, x1, y1, w) => {
        let x = x0, y = y0; const n = 9;
        g.lineWidth = w; g.strokeStyle = '#fff6b0'; g.beginPath(); g.moveTo(x, y);
        for (let i = 1; i <= n; i++) { const t = i / n; x = x0 + (x1 - x0) * t + (i < n ? r(-16, 16) : 0); y = y0 + (y1 - y0) * t; g.lineTo(x, y); }
        g.stroke();
      };
      for (const [x0, x1] of [[110, cx - 10], [200, cx + 14], [150, cx]]) { bolt(x0, 0, x1, cy + 10, 7); bolt(x0, 0, x1, cy + 10, 2.5); }
      glow(cx, cy + 10, 50, 'rgba(255,255,255,0.9)');
      break;
    }
    case 'blackhole': {
      glow(cx, cy, 130, 'rgba(155,92,255,0.55)');
      g.save(); g.translate(cx, cy); g.scale(1, 0.42);
      for (let i = 0; i < 4; i++) { g.strokeStyle = i % 2 ? 'rgba(255,170,80,0.85)' : 'rgba(200,140,255,0.85)'; g.lineWidth = 7 - i; g.beginPath(); g.arc(0, 0, 52 + i * 12, r(0, 6), r(0, 6) + Math.PI * 1.4); g.stroke(); }
      g.restore();
      for (let i = 0; i < 50; i++) { const a = r(0, Math.PI * 2), d = r(30, 120); g.fillStyle = `rgba(220,190,255,${r(0.3, 0.9)})`; g.beginPath(); g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.5, r(1, 2.6), 0, Math.PI * 2); g.fill(); }
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#000'; g.beginPath(); g.arc(cx, cy, 26, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(255,200,120,0.9)'; g.lineWidth = 2.5; g.beginPath(); g.arc(cx, cy, 27, 0, Math.PI * 2); g.stroke();
      break;
    }
    default: { // confetti
      glow(cx, cy, 120, 'rgba(255,220,120,0.4)');
      g.globalCompositeOperation = 'source-over';
      const cols = ['#ff3b5c', '#3b8bff', '#ffcf3f', '#2fe39b', '#c27bff', '#ffffff'];
      for (let i = 0; i < 70; i++) {
        const a = r(-Math.PI * 0.95, -Math.PI * 0.05), d = r(14, 140);
        g.save(); g.translate(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.95 + 20); g.rotate(r(0, 6));
        g.fillStyle = cols[i % cols.length]; g.fillRect(-r(3, 6), -2.5, r(7, 13), r(4, 6)); g.restore();
      }
    }
  }
  g.globalCompositeOperation = 'source-over';
  const vg = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.85);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.45)');
  g.fillStyle = vg; g.fillRect(0, 0, W, H);
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
