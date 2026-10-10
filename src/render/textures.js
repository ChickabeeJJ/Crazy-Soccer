// Procedurally painted canvas textures (no external image files needed).
import * as THREE from 'three';
import { FIELD, TEAMS } from '../config.js';
import { seeded } from '../util/math.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function tex(c, opts = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = opts.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.anisotropy = opts.aniso || 4;
  if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(opts.repeat[0], opts.repeat[1]); }
  return t;
}

export function toonGradient() {
  const data = new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}

// Striped, painterly pitch covering the whole arena floor.
export function grassTexture(indoor = false) {
  const W = 2048, H = 1312;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  const rnd = seeded(indoor ? 77 : 12);
  const sx = W / (FIELD.wallX * 2), sz = H / (FIELD.wallZ * 2);
  const a = indoor ? '#6cbf3a' : '#4f9b3d', b = indoor ? '#7dcc45' : '#5cab48';
  const stripe = 4.5;
  for (let z = -FIELD.wallZ, i = 0; z < FIELD.wallZ; z += stripe, i++) {
    g.fillStyle = i % 2 ? a : b;
    g.fillRect(0, (z + FIELD.wallZ) * sz, W, stripe * sz + 1);
  }
  // Brush dabs for texture
  for (let i = 0; i < 26000; i++) {
    const x = rnd() * W, y = rnd() * H;
    const l = 3 + rnd() * 9;
    const light = rnd() < 0.5;
    g.strokeStyle = light ? `rgba(190,255,150,${0.05 + rnd() * 0.08})` : `rgba(10,60,20,${0.05 + rnd() * 0.09})`;
    g.lineWidth = 1 + rnd() * 1.5;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (rnd() - 0.5) * 3, y - l);
    g.stroke();
  }
  // Soft large patches
  for (let i = 0; i < 60; i++) {
    const x = rnd() * W, y = rnd() * H, r = 40 + rnd() * 140;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, rnd() < 0.5 ? 'rgba(255,255,200,0.06)' : 'rgba(0,40,10,0.07)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return tex(c, { aniso: 8 });
}

export function hexNetTexture() {
  const c = canvas(256, 256);
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 256);
  const r = 16;
  const h = Math.sqrt(3) * r;
  g.strokeStyle = 'rgba(255,255,255,0.95)';
  g.lineWidth = 3;
  for (let row = -1; row < 256 / h + 2; row++) {
    for (let col = -1; col < 256 / (r * 1.5) + 2; col++) {
      const cx = col * r * 1.5;
      const cy = row * h + (col % 2 ? h / 2 : 0);
      g.beginPath();
      for (let k = 0; k < 6; k++) {
        const ang = (Math.PI / 3) * k;
        const x = cx + Math.cos(ang) * r, y = cy + Math.sin(ang) * r;
        if (k) g.lineTo(x, y); else g.moveTo(x, y);
      }
      g.closePath();
      g.stroke();
    }
  }
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, 'rgba(255,255,255,0.10)');
  grd.addColorStop(1, 'rgba(255,255,255,0.32)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  return tex(c, { repeat: [3, 1.2] });
}

export function wallTexture() {
  const c = canvas(512, 64);
  const g = c.getContext('2d');
  g.fillStyle = '#17121c';
  g.fillRect(0, 0, 512, 64);
  for (let i = 0; i < 8; i++) {
    const x = i * 64;
    g.fillStyle = '#e8304f';
    g.beginPath();
    g.moveTo(x + 6, 52); g.lineTo(x + 30, 12); g.lineTo(x + 40, 12); g.lineTo(x + 16, 52); g.closePath(); g.fill();
    g.fillStyle = '#ff6f8a';
    g.beginPath();
    g.moveTo(x + 34, 52); g.lineTo(x + 50, 24); g.lineTo(x + 58, 24); g.lineTo(x + 42, 52); g.closePath(); g.fill();
  }
  g.fillStyle = '#ffffff22';
  g.fillRect(0, 0, 512, 4);
  return tex(c, { repeat: [1, 1] });
}

export function pillarTexture() {
  const c = canvas(64, 256);
  const g = c.getContext('2d');
  g.fillStyle = '#26202c';
  g.fillRect(0, 0, 64, 256);
  g.strokeStyle = '#3fffe0';
  g.lineWidth = 4;
  for (let y = 0; y < 256; y += 40) {
    g.beginPath();
    g.moveTo(32, y); g.lineTo(54, y + 20); g.lineTo(32, y + 40); g.lineTo(10, y + 20); g.closePath();
    g.stroke();
  }
  g.lineWidth = 2;
  g.strokeStyle = '#1aa898';
  g.beginPath(); g.moveTo(4, 0); g.lineTo(4, 256); g.moveTo(60, 0); g.lineTo(60, 256); g.stroke();
  return tex(c, { repeat: [1, 4] });
}

// Painted panoramic backdrop: sea, cliffs, hills, mountains (wraps around the arena).
export function panoramaTexture(variant = 'day') {
  const W = 4096, H = 1024;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  const rnd = seeded(variant === 'day' ? 9 : 31);
  g.clearRect(0, 0, W, H);
  const horizon = H * 0.62;
  // Warm haze near the horizon (sky above is transparent so the sky dome shows through)
  const haze = g.createLinearGradient(0, horizon - 260, 0, horizon + 60);
  haze.addColorStop(0, 'rgba(255,243,224,0)');
  haze.addColorStop(1, 'rgba(255,243,224,0.85)');
  g.fillStyle = haze;
  g.fillRect(0, horizon - 260, W, 320);

  const ridge = (baseY, amp, freq, color, seed, detail = 0.3) => {
    const r = seeded(seed);
    const ph = [r() * 10, r() * 10, r() * 10];
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, H);
    for (let x = 0; x <= W; x += 8) {
      const u = (x / W) * Math.PI * 2;
      const y = baseY
        - amp * (0.55 + 0.45 * Math.sin(u * freq + ph[0]))
        - amp * detail * Math.sin(u * freq * 3.7 + ph[1])
        - amp * 0.12 * Math.sin(u * freq * 11 + ph[2]);
      g.lineTo(x, y);
    }
    g.lineTo(W, H);
    g.closePath();
    g.fill();
  };
  // distant mountains (purple/blue haze)
  ridge(horizon - 40, 260, 3, '#a9b6e8', 3, 0.45);
  ridge(horizon - 10, 200, 5, '#8796d6', 4, 0.4);
  // Snow caps / cliff highlights
  g.globalAlpha = 0.5;
  ridge(horizon - 120, 120, 5, '#dfe6ff', 4, 0.4);
  g.globalAlpha = 1;
  ridge(horizon + 10, 150, 4, '#5f74c9', 5, 0.5);
  // green hills
  ridge(horizon + 30, 110, 6, '#5fb04f', 6, 0.35);
  ridge(horizon + 50, 70, 9, '#7ccc59', 7, 0.3);
  // tree dabs on hills
  for (let i = 0; i < 1400; i++) {
    const x = rnd() * W, y = horizon - 40 + rnd() * 100;
    const r = 6 + rnd() * 14;
    g.fillStyle = rnd() < 0.5 ? '#3f8f3e' : '#2f7a3a';
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  // sea band
  const sea = g.createLinearGradient(0, horizon + 40, 0, H);
  sea.addColorStop(0, '#53c6e6');
  sea.addColorStop(1, '#2c86c9');
  g.fillStyle = sea;
  g.fillRect(0, horizon + 55, W, H);
  g.strokeStyle = 'rgba(255,255,255,0.55)';
  g.lineWidth = 3;
  for (let i = 0; i < 500; i++) {
    const x = rnd() * W, y = horizon + 60 + rnd() * (H - horizon - 60);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + 10 + rnd() * 30, y); g.stroke();
  }
  // Cliff islands
  for (let i = 0; i < 9; i++) {
    const x = rnd() * W, w = 80 + rnd() * 220, h = 80 + rnd() * 240;
    const y = horizon + 70;
    g.fillStyle = '#6a5fa8';
    g.beginPath();
    g.moveTo(x, y); g.lineTo(x + w * 0.15, y - h); g.lineTo(x + w * 0.7, y - h * 0.9); g.lineTo(x + w, y); g.closePath(); g.fill();
    g.fillStyle = '#56a84b';
    g.beginPath(); g.ellipse(x + w * 0.42, y - h * 0.95, w * 0.36, 18, 0, 0, Math.PI * 2); g.fill();
  }
  return tex(c, { aniso: 4 });
}

export function curtainTexture() {
  const c = canvas(512, 512);
  const g = c.getContext('2d');
  for (let x = 0; x < 512; x++) {
    const v = 0.5 + 0.5 * Math.sin((x / 512) * Math.PI * 16);
    const r = Math.floor(150 + v * 70), gg = Math.floor(40 + v * 25), b = Math.floor(40 + v * 22);
    g.fillStyle = `rgb(${r},${gg},${b})`;
    g.fillRect(x, 0, 1, 512);
  }
  const sh = g.createLinearGradient(0, 0, 0, 512);
  sh.addColorStop(0, 'rgba(0,0,0,0.35)');
  sh.addColorStop(0.2, 'rgba(0,0,0,0)');
  sh.addColorStop(1, 'rgba(0,0,0,0.25)');
  g.fillStyle = sh;
  g.fillRect(0, 0, 512, 512);
  return tex(c, { repeat: [10, 1] });
}

export function latticeTexture() {
  const c = canvas(256, 256);
  const g = c.getContext('2d');
  g.fillStyle = '#d8dbe6';
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#6b6f80';
  g.lineWidth = 6;
  for (let i = -256; i < 512; i += 64) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 256, 256); g.stroke();
    g.beginPath(); g.moveTo(i + 256, 0); g.lineTo(i, 256); g.stroke();
  }
  g.fillStyle = '#ffffff';
  for (let y = 0; y < 256; y += 64) for (let x = 0; x < 256; x += 64) { g.beginPath(); g.arc(x + 32, y, 5, 0, Math.PI * 2); g.fill(); }
  return tex(c, { repeat: [8, 4] });
}

export function bannerTexture(text, bg = '#1c1830', fg = '#ffffff') {
  const c = canvas(1024, 128);
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 1024, 128);
  g.font = 'italic 900 64px "Lilita One", "Arial Black", sans-serif';
  g.fillStyle = fg;
  g.textBaseline = 'middle';
  for (let x = 20; x < 1024; x += g.measureText(text).width + 70) g.fillText(text, x, 68);
  return tex(c);
}

export function glowTexture() {
  const c = canvas(64, 64);
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.35, 'rgba(255,255,255,0.6)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return tex(c, { linear: true });
}

export function cloudTexture() {
  const c = canvas(256, 128);
  const g = c.getContext('2d');
  const rnd = seeded(5);
  for (let i = 0; i < 14; i++) {
    const x = 50 + rnd() * 156, y = 50 + rnd() * 40, r = 20 + rnd() * 30;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.95)');
    gr.addColorStop(0.7, 'rgba(255,255,255,0.7)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  return tex(c);
}

// Face atlas: 4 expressions in a row (normal, happy, effort, dizzy)
export function faceTexture() {
  const c = canvas(1024, 256);
  const g = c.getContext('2d');
  g.clearRect(0, 0, 1024, 256);
  const eye = (x, y, kind) => {
    g.fillStyle = '#1b1530';
    g.strokeStyle = '#1b1530';
    g.lineCap = 'round';
    if (kind === 'normal') {
      g.beginPath(); g.ellipse(x, y, 13, 21, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(x - 4, y - 8, 5, 0, Math.PI * 2); g.fill();
    } else if (kind === 'happy') {
      g.lineWidth = 9; g.beginPath(); g.arc(x, y + 8, 14, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
    } else if (kind === 'effort') {
      g.lineWidth = 9; g.beginPath(); g.moveTo(x - 14, y - 10); g.lineTo(x + 12, y); g.lineTo(x - 14, y + 10); g.stroke();
    } else if (kind === 'dizzy') {
      g.lineWidth = 6; g.beginPath();
      for (let a = 0; a < Math.PI * 4; a += 0.2) { const r = a * 2.2; const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; if (a) g.lineTo(px, py); else g.moveTo(px, py); }
      g.stroke();
    }
  };
  const faces = ['normal', 'happy', 'effort', 'dizzy'];
  faces.forEach((f, i) => {
    const ox = i * 256;
    const lx = ox + 92, rx = ox + 164, ey = 110;
    if (f === 'effort') { eye(lx, ey, 'effort'); g.save(); g.translate(rx * 2, 0); g.scale(-1, 1); eye(rx, ey, 'effort'); g.restore(); }
    else { eye(lx, ey, f); eye(rx, ey, f); }
    // brows
    g.strokeStyle = '#1b1530'; g.lineWidth = 6; g.lineCap = 'round';
    if (f === 'normal') { g.beginPath(); g.moveTo(lx - 14, ey - 34); g.lineTo(lx + 10, ey - 38); g.moveTo(rx - 10, ey - 38); g.lineTo(rx + 14, ey - 34); g.stroke(); }
    // cheeks
    g.fillStyle = 'rgba(255,110,130,0.45)';
    g.beginPath(); g.ellipse(lx - 18, ey + 34, 15, 8, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(rx + 18, ey + 34, 15, 8, 0, 0, Math.PI * 2); g.fill();
    // mouth
    g.strokeStyle = '#1b1530'; g.fillStyle = '#5a1f2e'; g.lineWidth = 6;
    const mx = ox + 128, my = 168;
    if (f === 'normal') { g.beginPath(); g.arc(mx, my - 8, 12, Math.PI * 0.15, Math.PI * 0.85); g.stroke(); }
    else if (f === 'happy') { g.beginPath(); g.arc(mx, my - 10, 18, 0, Math.PI); g.closePath(); g.fill(); g.fillStyle = '#ff7a8a'; g.beginPath(); g.arc(mx, my, 8, 0, Math.PI); g.fill(); }
    else if (f === 'effort') { g.beginPath(); g.ellipse(mx, my, 14, 9, 0, 0, Math.PI * 2); g.fill(); }
    else { g.beginPath(); g.moveTo(mx - 14, my); for (let k = 0; k <= 4; k++) g.lineTo(mx - 14 + k * 7, my + (k % 2 ? -5 : 5)); g.stroke(); }
  });
  const t = tex(c);
  t.repeat.set(0.25, 1);
  return t;
}

// Jersey: wraps around a capsule torso. u=0 is the chest (front), u=0.5 the back.
export function jerseyTexture(pattern, teamIdx, number) {
  const c = canvas(512, 256);
  const g = c.getContext('2d');
  const T = TEAMS[teamIdx];
  const base = T.css;
  const dark = '#' + T.dark.toString(16).padStart(6, '0');
  const light = '#ffffff';
  g.fillStyle = base;
  g.fillRect(0, 0, 512, 256);
  switch (pattern) {
    case 'stripes':
      g.fillStyle = light;
      for (let x = 0; x < 512; x += 64) g.fillRect(x + 20, 0, 24, 256);
      break;
    case 'hoops':
      g.fillStyle = dark;
      for (let y = 30; y < 256; y += 70) g.fillRect(0, y, 512, 30);
      break;
    case 'sash':
      g.fillStyle = light;
      g.save(); g.translate(64, 128); g.rotate(-0.6); g.fillRect(-200, -22, 400, 44); g.restore();
      g.save(); g.translate(448, 128); g.rotate(-0.6); g.fillRect(-200, -22, 400, 44); g.restore();
      break;
    case 'gradient': {
      const gr = g.createLinearGradient(0, 0, 0, 256);
      gr.addColorStop(0, '#ffd23f');
      gr.addColorStop(1, base);
      g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
      break;
    }
    case 'stars':
      g.fillStyle = '#ffffffcc';
      for (let i = 0; i < 26; i++) drawStar(g, (i * 97) % 512, 20 + ((i * 53) % 220), 9 + (i % 3) * 3);
      break;
    case 'lightning':
      g.fillStyle = '#ffe14a';
      for (const ox of [40, 300]) {
        g.beginPath();
        g.moveTo(ox + 60, 0); g.lineTo(ox + 20, 120); g.lineTo(ox + 60, 120); g.lineTo(ox + 30, 256); g.lineTo(ox + 110, 100); g.lineTo(ox + 70, 100); g.lineTo(ox + 100, 0); g.closePath(); g.fill();
      }
      break;
    case 'checks':
      g.fillStyle = dark;
      for (let y = 0; y < 256; y += 32) for (let x = (y / 32) % 2 ? 32 : 0; x < 512; x += 64) g.fillRect(x, y, 32, 32);
      break;
    default:
      g.fillStyle = dark;
      g.fillRect(0, 0, 512, 22);
      g.fillStyle = light;
      g.fillRect(0, 22, 512, 6);
  }
  // Collar
  g.fillStyle = light;
  g.fillRect(0, 0, 512, 10);
  // Number on the back (u = 0.5)
  g.font = '900 120px "Lilita One", "Arial Black", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 12;
  g.strokeStyle = dark;
  g.strokeText(String(number), 256, 140);
  g.fillStyle = light;
  g.fillText(String(number), 256, 140);
  // Chest badge (front-left)
  g.fillStyle = light;
  g.beginPath(); g.arc(40, 90, 16, 0, Math.PI * 2); g.fill();
  g.fillStyle = base;
  drawStar(g, 40, 90, 10);
  return tex(c);
}

function drawStar(g, x, y, r) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    if (i) g.lineTo(px, py); else g.moveTo(px, py);
  }
  g.closePath();
  g.fill();
}

export function nameTagTexture(name, teamIdx, isLocal) {
  const c = canvas(512, 96);
  const g = c.getContext('2d');
  g.font = '700 44px "Roboto Condensed", "Arial Narrow", sans-serif';
  const w = Math.min(500, g.measureText(name).width + 40);
  const x0 = (512 - w) / 2;
  g.fillStyle = 'rgba(15,12,25,0.55)';
  roundRect(g, x0, 20, w, 58, 18);
  g.fill();
  g.fillStyle = TEAMS[teamIdx].css;
  roundRect(g, x0, 20, 10, 58, 5);
  g.fill();
  g.fillStyle = isLocal ? '#ffe14a' : '#ffffff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(name, 256 + 5, 51);
  return tex(c);
}

export function bubbleTexture(text) {
  const c = canvas(512, 128);
  const g = c.getContext('2d');
  g.font = '700 46px "Roboto Condensed", "Arial Narrow", sans-serif';
  const w = Math.min(500, g.measureText(text).width + 50);
  const x0 = (512 - w) / 2;
  g.fillStyle = '#ffffff';
  roundRect(g, x0, 10, w, 76, 30);
  g.fill();
  g.beginPath(); g.moveTo(240, 84); g.lineTo(256, 118); g.lineTo(272, 84); g.closePath(); g.fill();
  g.fillStyle = '#1b1530';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 256, 50);
  return tex(c);
}

export function itemBoxTexture(color) {
  const c = canvas(128, 128);
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 128, 128);
  gr.addColorStop(0, '#ffffff');
  gr.addColorStop(0.25, color);
  gr.addColorStop(1, color);
  g.fillStyle = gr;
  roundRect(g, 4, 4, 120, 120, 22);
  g.fill();
  g.lineWidth = 8;
  g.strokeStyle = 'rgba(255,255,255,0.8)';
  roundRect(g, 10, 10, 108, 108, 18);
  g.stroke();
  g.font = '900 86px "Lilita One", "Arial Black", sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 10; g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.strokeText('?', 64, 70);
  g.fillStyle = '#ffffff';
  g.fillText('?', 64, 70);
  return tex(c);
}

export function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

export function puddleTexture() {
  const c = canvas(128, 128);
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 10, 64, 64, 62);
  gr.addColorStop(0, 'rgba(40,20,70,0.95)');
  gr.addColorStop(0.6, 'rgba(70,40,120,0.9)');
  gr.addColorStop(0.85, 'rgba(160,90,255,0.6)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.beginPath();
  for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.3) {
    const r = 52 + Math.sin(a * 5) * 6 + Math.cos(a * 3) * 4;
    const x = 64 + Math.cos(a) * r, y = 64 + Math.sin(a) * r;
    if (a) g.lineTo(x, y); else g.moveTo(x, y);
  }
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.beginPath(); g.ellipse(48, 46, 16, 6, -0.5, 0, Math.PI * 2); g.fill();
  return tex(c);
}

export function arrowTexture() {
  const c = canvas(64, 256);
  const g = c.getContext('2d');
  g.clearRect(0, 0, 64, 256);
  g.fillStyle = 'rgba(255,255,255,0.95)';
  for (let y = 16; y < 256; y += 48) {
    g.beginPath();
    g.moveTo(8, y + 28); g.lineTo(32, y + 6); g.lineTo(56, y + 28); g.lineTo(56, y + 40); g.lineTo(32, y + 18); g.lineTo(8, y + 40); g.closePath();
    g.fill();
  }
  const t = tex(c, { repeat: [1, 1] });
  t.wrapT = THREE.RepeatWrapping;
  return t;
}
