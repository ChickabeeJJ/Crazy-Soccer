// Inline SVG item icons + canvas previews for the locker (no image files needed).
import { CATALOG, SKIN_TONES, HAIR_COLORS } from '../cosmetics.js';
import { jerseyTexture } from '../render/textures.js';

// Item icons in the menu style: currentColor line work (follows the surface they sit on) over a
// soft tinted body fill, with solid accent parts in each item's colour. No tiles or thick outlines.
// Item icons: flat filled shapes in two tones (no outlines), readable on light and dark panels
const S = (inner) => `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
const MET = '#8b93ad', MET_L = '#b4bbd2', MET_D = '#646c88'; // gun metal
const WOOD = '#b07a42', WOOD_D = '#875a2c';

export const ITEM_SVG = {
  shield: S(`<circle cx="24" cy="24" r="20" fill="#8a5cf6" fill-opacity="0.32"/><circle cx="24" cy="24" r="15.5" fill="#8a5cf6" fill-opacity="0.32"/><path d="M8.5 19A16.5 16.5 0 0 1 19 8.3a18 18 0 0 0-7.8 12.4z" fill="#e2d4ff"/><circle cx="24" cy="19.5" r="4.6" fill="#5b36c9"/><path d="M14.5 34.5c1.2-6 4.8-9 9.5-9s8.3 3 9.5 9a15.5 15.5 0 0 1-19 0z" fill="#5b36c9"/>`),
  barricade: S(`<rect x="11" y="26" width="4" height="14" fill="${MET_D}"/><rect x="33" y="26" width="4" height="14" fill="${MET_D}"/><rect x="7" y="38" width="12" height="4" rx="1.5" fill="${MET}"/><rect x="29" y="38" width="12" height="4" rx="1.5" fill="${MET}"/><rect x="4" y="15" width="40" height="12" rx="1.5" fill="#ff8a00"/><path d="M8 15h6l-6 12H4v-2zM20 15h6l-6 12h-6zM32 15h6l-6 12h-6zM44 17v6l-2 4h-4z" fill="#fff4e0"/><rect x="4" y="24.5" width="40" height="2.5" fill="#d26a00"/><circle cx="9" cy="11" r="3.2" fill="#ff3b5c"/><circle cx="39" cy="11" r="3.2" fill="#ff3b5c"/><circle cx="8" cy="10" r="1.1" fill="#ffd0d8"/><circle cx="38" cy="10" r="1.1" fill="#ffd0d8"/>`),
  speed: S(`<rect x="14" y="7" width="20" height="5" rx="2" fill="${MET_L}"/><rect x="13" y="11" width="22" height="31" rx="4" fill="#19c26b"/><rect x="29" y="11" width="6" height="31" rx="3" fill="#109352"/><rect x="13" y="16" width="22" height="2.5" fill="#0d7a44"/><rect x="13" y="37" width="22" height="2.5" fill="#0d7a44"/><path d="M27 19.5l-8.5 11.5h5.5l-2.5 8.5 9-12.5h-5.5l2.5-7.5z" fill="#ffd84a"/>`),
  oil: S(`<ellipse cx="24" cy="41.5" rx="18" ry="4" fill="#5b36c9" fill-opacity="0.55"/><path d="M24 3.5c7.5 10.5 11.5 15.5 11.5 22a11.5 11.5 0 0 1-23 0c0-6.5 4-11.5 11.5-22z" fill="#6a48d8"/><path d="M24 3.5c7.5 10.5 11.5 15.5 11.5 22a11.5 11.5 0 0 1-11.5 11.5c4-3 6-7 6-12 0-6-2.5-11-6-21.5z" fill="#4c2fb0"/><path d="M17 25.5c0 3.4 1.8 6 4.6 7.2-1.2-2.4-1.6-4.6-1.4-7.4z" fill="#c4b2ff"/>`),
  shotgun: S(`<rect x="4" y="14" width="30" height="4.5" rx="1" fill="${MET}"/><rect x="4" y="19" width="26" height="4" rx="1" fill="${MET_D}"/><rect x="12" y="23" width="11" height="4.5" rx="1.5" fill="#ff7a1a"/><path d="M31 14h7.5l3 4.5-1.5 5h-5L28.5 38h-8L26 24.5 31 18z" fill="${WOOD}"/><path d="M35 23.5h-5L23.5 38h-3L26 24.5z" fill="${WOOD_D}"/><circle cx="1.8" cy="13" r="1.6" fill="#ffb347"/><circle cx="1.6" cy="19" r="1.6" fill="#ffb347"/><circle cx="1.8" cy="25" r="1.6" fill="#ffb347"/>`),
  grapple: S(`<circle cx="24" cy="2.8" r="1.6" fill="#16b36a"/><circle cx="24" cy="7.5" r="1.6" fill="#16b36a"/><path fill-rule="evenodd" d="M24 10a4.6 4.6 0 1 1 0 9.2 4.6 4.6 0 0 1 0-9.2zm0 2.6a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" fill="#16b36a"/><rect x="22" y="18" width="4" height="22" rx="1.5" fill="${MET}"/><rect x="16" y="22" width="16" height="3.4" rx="1.5" fill="${MET_D}"/><path d="M8.5 22.5l5.5 1.5-1.4 1.6C14 31 18.5 35 24 35s10-4 11.4-9.4L34 24l5.5-1.5L40 29l-2-1.2C35.8 34.6 30.5 39 24 39S12.2 34.6 10 27.8L8 29z" fill="${MET_L}"/>`),
  magnet: S(`<path d="M8 6h12v17a4 4 0 0 0 8 0V6h12v17a16 16 0 0 1-32 0z" fill="#e8274a"/><path d="M33 6h7v17a16 16 0 0 1-16 16v-6a10 10 0 0 0 9-10z" fill="#b8183a"/><rect x="8" y="6" width="12" height="7" fill="#eef1f6"/><rect x="28" y="6" width="12" height="7" fill="#eef1f6"/><rect x="16" y="6" width="4" height="7" fill="#c8cee0"/><rect x="36" y="6" width="4" height="7" fill="#c8cee0"/><path d="M13 43.5c7 2.5 15 2.5 22 0v2.5c-7 2.5-15 2.5-22 0z" fill="#ff6a86"/>`),
  mines: S(`<rect x="5" y="34" width="38" height="5.5" rx="1.5" fill="${MET_D}"/><path d="M8 34c0-7.5 7-12.5 16-12.5S40 26.5 40 34z" fill="#6b7a3a"/><path d="M12 27.5C14.5 24.5 18.5 23 23 22.6c-4.8 1.4-8 4.2-9.2 8z" fill="#9aab5c"/><rect x="20.5" y="16" width="7" height="6" rx="1" fill="${MET}"/><circle cx="24" cy="12.5" r="3.6" fill="#ff3b5c"/><path d="M14.5 4.5l3.4 4.2-1.6 1.2zM33.5 4.5l-3.4 4.2 1.6 1.2zM23 1h2l-.3 5h-1.4z" fill="#ffcf3f"/>`),
  punch: S(`<rect x="1" y="16.5" width="7" height="3" rx="1.5" fill="#ff8a00"/><rect x="0" y="23.5" width="9" height="3" rx="1.5" fill="#ff8a00"/><rect x="1" y="30.5" width="7" height="3" rx="1.5" fill="#ff8a00"/><rect x="10.5" y="14.5" width="8" height="21" rx="2" fill="#eef1f6"/><rect x="10.5" y="30" width="8" height="5.5" rx="2" fill="#c8cee0"/><path d="M18 10.5h11.5A11.5 11.5 0 0 1 41 22v7.5A10.5 10.5 0 0 1 30.5 40H18z" fill="#e8274a"/><path d="M18 32h12.5a10.5 10.5 0 0 0 10.4-8.7V29.5A10.5 10.5 0 0 1 30.5 40H18z" fill="#b8183a"/><path d="M27 13.5c5.4 0 9.3 3.1 10 7.6-2.4-3-5.6-4.6-10-4.8z" fill="#ff8fa2"/><path d="M18 24.5c0 3.6 2 6 5.5 6.5-4.5.6-7.3-2.3-5.5-6.5z" fill="#b8183a"/>`),
  fire: S(`<circle cx="24" cy="24" r="19" fill="#1aa7d8" fill-opacity="0.28"/><circle cx="24" cy="24" r="14" fill="#1aa7d8" fill-opacity="0.3"/><rect x="22.5" y="1" width="3" height="6" rx="1.5" fill="#1aa7d8"/><rect x="22.5" y="41" width="3" height="6" rx="1.5" fill="#1aa7d8"/><rect x="1" y="22.5" width="6" height="3" rx="1.5" fill="#1aa7d8"/><rect x="41" y="22.5" width="6" height="3" rx="1.5" fill="#1aa7d8"/><path d="M28 8.5l-12 17h7.5l-4.5 14 13-18.5h-8l4-12.5z" fill="#ffd84a"/><path d="M28 8.5l-4 12.5h8l-13 18.5 3-11.5z" fill="#f2b51c"/>`),
  flintlock: S(`<path d="M3 13.5h28l3.5 5.5H6z" fill="${MET}"/><path d="M3 13.5h28l1.2 2H3z" fill="${MET_L}"/><path d="M29 19h9l2.2 5.5-7 15.5h-8l4.8-12.5z" fill="${WOOD}"/><path d="M33.2 40h-3l7-16.5 2.9 1z" fill="${WOOD_D}"/><path d="M21.5 19h3.5c0 3.4 1.4 5.2 4.2 5.6l-.8 2.6c-4.6-.6-6.9-3.4-6.9-8.2z" fill="${MET_D}"/><path d="M32.5 13l3.2-6.5 3.5 1.8-2.8 5.7z" fill="#c98a3e"/><circle cx="2.5" cy="16.2" r="2.2" fill="#ffcf3f"/>`),
  ice: S(`<path d="M3 15.5h21.5l5 5v5.5H11l-8-4.5z" fill="#2fb6ff"/><path d="M3 15.5h21.5l2 2H3z" fill="#8fdcff"/><path d="M11 26h18.5v-2.5H9z" fill="#1585c4"/><path d="M12 26h8.5l-3 12.5H10z" fill="${MET_D}"/><circle cx="8.5" cy="20.5" r="2.2" fill="#eaf8ff"/><g fill="#bff0ff"><rect x="37.6" y="10" width="2.8" height="24" rx="1.4"/><rect x="37.6" y="10" width="2.8" height="24" rx="1.4" transform="rotate(60 39 22)"/><rect x="37.6" y="10" width="2.8" height="24" rx="1.4" transform="rotate(-60 39 22)"/></g><circle cx="39" cy="22" r="3" fill="#2fb6ff"/>`),
  bazooka: S(`<path d="M3.5 30.5l30.5-12.5 4.6 10-30.6 12.5z" fill="#7a8a45"/><path d="M6 35.8l30.5-12.6 2.1 4.8-30.6 12.5z" fill="#5c6a30"/><path d="M14 24.8l2.8-1.1 4 10-2.8 1.1zM24 20.8l2.8-1.1 4 10-2.8 1.1z" fill="#4c5826"/><path d="M34 18l7.8-3.2 4.6 10-7.8 3.2z" fill="#e8402a"/><path d="M41.8 14.8l3.4 7.4 1.2 2.6-2 .8z" fill="#ff7a5c"/><path d="M15 36.8l2.4 7.7h5l-1.2-9.7z" fill="${MET_D}"/>`),
  jet: S(`<rect x="10" y="7" width="11.5" height="26" rx="5.5" fill="#ff8a00"/><rect x="26.5" y="7" width="11.5" height="26" rx="5.5" fill="#ff8a00"/><rect x="16.5" y="7" width="5" height="26" rx="2.5" fill="#d06a00"/><rect x="33" y="7" width="5" height="26" rx="2.5" fill="#d06a00"/><rect x="21.5" y="13" width="5" height="3" fill="${MET_D}"/><rect x="21.5" y="24" width="5" height="3" fill="${MET_D}"/><path d="M12.5 33h7l-1.5 4h-4zM29 33h7l-1.5 4h-4z" fill="${MET}"/><path d="M15.8 37.5c-2.6 3.2-1.6 6.6 0 9 1.6-2.4 2.6-5.8 0-9zM32.2 37.5c-2.6 3.2-1.6 6.6 0 9 1.6-2.4 2.6-5.8 0-9z" fill="#ffcf3f"/><path d="M15.8 39.5c-1.1 1.6-.8 3.4 0 4.7.8-1.3 1.1-3.1 0-4.7zM32.2 39.5c-1.1 1.6-.8 3.4 0 4.7.8-1.3 1.1-3.1 0-4.7z" fill="#ff6a1a"/>`),
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
