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

// Striped, painterly pitch covering the whole arena floor. kind: false/'grass' | true/'indoor' | 'desert'
export function grassTexture(indoor = false) {
  const W = 2048, H = 1312;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  const desert = indoor === 'desert';
  if (desert) indoor = false;
  const rnd = seeded(desert ? 55 : indoor ? 77 : 12);
  const sx = W / (FIELD.wallX * 2), sz = H / (FIELD.wallZ * 2);
  const a = desert ? '#d4b072' : indoor ? '#6cbf3a' : '#4f9b3d', b = desert ? '#e0c084' : indoor ? '#7dcc45' : '#5cab48';
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
    if (desert) g.strokeStyle = light ? `rgba(255,245,215,${0.06 + rnd() * 0.08})` : `rgba(120,80,30,${0.05 + rnd() * 0.08})`;
    else g.strokeStyle = light ? `rgba(190,255,150,${0.05 + rnd() * 0.08})` : `rgba(10,60,20,${0.05 + rnd() * 0.09})`;
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

// Face atlas: 4 expressions in a row (neutral, happy, effort, pained). Drawn in a natural style:
// almond eyes with iris, lids and lashes, shaped brows, a soft nose shadow and real lips
export function faceTexture() {
  const c = canvas(2048, 512);
  const g = c.getContext('2d');
  g.scale(2, 2);
  const INK = '#1d1418';
  const BROW = 'rgba(46,30,24,0.92)';
  const LIP = '#a5524c';
  // open: 0 closed .. 1 fully open; lower: how far the lower lid rises (smiling squint)
  const eye = (x, y, flip, o = {}) => {
    const w = 17, h = 8.5 * (o.open ?? 1), low = o.lower || 0, look = o.look || 0;
    g.save();
    g.translate(x, y);
    if (flip) g.scale(-1, 1);
    // almond: outer corner (positive x) slightly higher
    const top = () => { g.moveTo(-w, 1); g.bezierCurveTo(-w * 0.5, -h * 1.25, w * 0.55, -h * 1.3, w, -2); };
    const bottom = () => { g.bezierCurveTo(w * 0.5, h * (0.9 - low) + 1, -w * 0.5, h * (1 - low) + 1, -w, 1); };
    g.beginPath(); top(); bottom(); g.closePath();
    g.save();
    g.clip();
    g.fillStyle = '#f3eee8'; g.fillRect(-w - 2, -h * 2, w * 2 + 4, h * 4);
    // iris + pupil, partly tucked under the upper lid
    const ix = look * 4, iy = -h * 0.1;
    const ir = g.createRadialGradient(ix, iy, 1, ix, iy, 8.5);
    ir.addColorStop(0, '#6b4a2e'); ir.addColorStop(0.75, '#4a301d'); ir.addColorStop(1, '#2a1b12');
    g.fillStyle = ir; g.beginPath(); g.arc(ix, iy, 8.5, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#0c0a10'; g.beginPath(); g.arc(ix, iy, 4, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.arc(ix - 2.8, iy - 3, 1.9, 0, Math.PI * 2); g.fill();
    // lid shadow across the top of the eyeball
    const sh = g.createLinearGradient(0, -h * 1.3, 0, -h * 0.1);
    sh.addColorStop(0, 'rgba(60,30,30,0.45)'); sh.addColorStop(1, 'rgba(60,30,30,0)');
    g.fillStyle = sh; g.fillRect(-w - 2, -h * 2, w * 2 + 4, h * 2);
    g.restore();
    // upper lash line, heavier towards the outer corner
    g.strokeStyle = INK; g.lineCap = 'round'; g.lineJoin = 'round';
    g.lineWidth = 3.2; g.beginPath(); top(); g.stroke();
    g.lineWidth = 2.2; g.beginPath(); g.moveTo(w - 1, -2); g.lineTo(w + 4, -4.5); g.stroke();
    // eyelid crease
    g.strokeStyle = 'rgba(90,50,45,0.35)'; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(-w * 0.75, -h * 1.05 - 2); g.bezierCurveTo(-w * 0.3, -h * 1.6 - 3, w * 0.45, -h * 1.6 - 3, w * 0.85, -h * 0.9 - 3); g.stroke();
    // lower lid
    g.strokeStyle = 'rgba(80,40,40,0.4)'; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(w * 0.9, -1); g.bezierCurveTo(w * 0.5, h * (0.9 - low) + 1, -w * 0.5, h * (1 - low) + 1, -w * 0.9, 1.5); g.stroke();
    g.restore();
  };
  // brow: tapered stroke from the inner end (x0) to the tail; lift raises the inner end
  const brow = (x, y, flip, lift = 0, arch = 1) => {
    g.save();
    g.translate(x, y);
    if (flip) g.scale(-1, 1);
    g.fillStyle = BROW;
    g.beginPath();
    g.moveTo(-15, 2 - lift);
    g.quadraticCurveTo(-2, -6 * arch - lift * 0.6, 17, -1);
    g.quadraticCurveTo(-2, -1.5 * arch - lift * 0.4, -15, 6.5 - lift);
    g.closePath();
    g.fill();
    g.restore();
  };
  const faces = ['neutral', 'happy', 'effort', 'pained'];
  faces.forEach((f, i) => {
    const ox = i * 256;
    const lx = ox + 95, rx = ox + 161, ey = 112, mx = ox + 128, my = 172;
    // the whole face is drawn 1.4x and lowered so the eyes sit at the middle of the head
    g.save();
    g.translate(ox + 128, 168); g.scale(1.4, 1.4); g.translate(-(ox + 128), -140);
    // soft blush and a shadow under the nose
    const bl = (x) => { const gr = g.createRadialGradient(x, ey + 30, 0, x, ey + 30, 22); gr.addColorStop(0, 'rgba(210,110,100,0.16)'); gr.addColorStop(1, 'rgba(210,110,100,0)'); g.fillStyle = gr; g.fillRect(x - 24, ey + 6, 48, 48); };
    bl(lx - 10); bl(rx + 10);
    const ns = g.createRadialGradient(mx, ey + 44, 0, mx, ey + 44, 13);
    ns.addColorStop(0, 'rgba(110,55,45,0.28)'); ns.addColorStop(1, 'rgba(110,55,45,0)');
    g.fillStyle = ns; g.beginPath(); g.ellipse(mx, ey + 44, 13, 7, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(90,40,35,0.45)';
    g.beginPath(); g.ellipse(mx - 5, ey + 43, 2.6, 1.6, 0.3, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(mx + 5, ey + 43, 2.6, 1.6, -0.3, 0, Math.PI * 2); g.fill();
    if (f === 'neutral') {
      eye(lx, ey, true); eye(rx, ey, false);
      brow(lx + 2, ey - 22, true); brow(rx - 2, ey - 22, false);
      // closed mouth: upper lip line with a fuller lower lip
      g.fillStyle = 'rgba(165,82,76,0.55)';
      g.beginPath(); g.ellipse(mx, my + 4, 13, 4.5, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#6e2f2c'; g.lineWidth = 2.8; g.lineCap = 'round';
      g.beginPath(); g.moveTo(mx - 18, my - 1.5); g.quadraticCurveTo(mx - 7, my + 1.5, mx, my); g.quadraticCurveTo(mx + 7, my + 1.5, mx + 18, my - 1.5); g.stroke();
    } else if (f === 'happy') {
      eye(lx, ey, true, { lower: 0.55 }); eye(rx, ey, false, { lower: 0.55 });
      brow(lx + 2, ey - 24, true, 1, 1.2); brow(rx - 2, ey - 24, false, 1, 1.2);
      // open smile with the top teeth showing
      g.fillStyle = '#3b1518';
      g.beginPath(); g.moveTo(mx - 19, my - 4); g.quadraticCurveTo(mx, my + 1, mx + 19, my - 4); g.quadraticCurveTo(mx + 12, my + 16, mx, my + 17); g.quadraticCurveTo(mx - 12, my + 16, mx - 19, my - 4); g.fill();
      g.save(); g.clip();
      g.fillStyle = '#f6f2ee'; g.fillRect(mx - 20, my - 6, 40, 9.5);
      g.fillStyle = '#c96a6e'; g.beginPath(); g.ellipse(mx, my + 16, 11, 6, 0, 0, Math.PI * 2); g.fill();
      g.restore();
      g.strokeStyle = LIP; g.lineWidth = 2.4;
      g.beginPath(); g.moveTo(mx - 19, my - 4); g.quadraticCurveTo(mx, my + 1, mx + 19, my - 4); g.quadraticCurveTo(mx + 12, my + 16, mx, my + 17); g.quadraticCurveTo(mx - 12, my + 16, mx - 19, my - 4); g.stroke();
      g.strokeStyle = 'rgba(110,55,45,0.35)'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(mx - 24, my - 9); g.quadraticCurveTo(mx - 21, my - 3, mx - 22, my + 2); g.moveTo(mx + 24, my - 9); g.quadraticCurveTo(mx + 21, my - 3, mx + 22, my + 2); g.stroke();
    } else if (f === 'effort') {
      eye(lx, ey + 1, true, { open: 0.7, lower: 0.25 }); eye(rx, ey + 1, false, { open: 0.7, lower: 0.25 });
      brow(lx + 2, ey - 17, true, -5, 0.6); brow(rx - 2, ey - 17, false, -5, 0.6);
      g.strokeStyle = 'rgba(90,50,45,0.35)'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(mx - 4, ey - 26); g.lineTo(mx - 2, ey - 14); g.moveTo(mx + 4, ey - 26); g.lineTo(mx + 2, ey - 14); g.stroke();
      // gritted teeth
      g.fillStyle = '#3b1518';
      g.beginPath(); g.moveTo(mx - 17, my - 2); g.lineTo(mx + 17, my - 2); g.lineTo(mx + 14, my + 9); g.lineTo(mx - 14, my + 9); g.closePath(); g.fill();
      g.fillStyle = '#f2ede8'; g.fillRect(mx - 15, my - 0.5, 30, 8);
      g.strokeStyle = 'rgba(60,30,30,0.5)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(mx - 15, my + 3.5); g.lineTo(mx + 15, my + 3.5);
      for (let k = -2; k <= 2; k++) { g.moveTo(mx + k * 6, my - 0.5); g.lineTo(mx + k * 6, my + 7.5); }
      g.stroke();
      g.strokeStyle = LIP; g.lineWidth = 2.4;
      g.beginPath(); g.moveTo(mx - 17, my - 2); g.lineTo(mx + 17, my - 2); g.lineTo(mx + 14, my + 9); g.lineTo(mx - 14, my + 9); g.closePath(); g.stroke();
    } else {
      eye(lx, ey + 2, true, { open: 0.55, look: 0.4 }); eye(rx, ey + 2, false, { open: 0.55, look: -0.4 });
      brow(lx + 2, ey - 22, true, 6, 0.5); brow(rx - 2, ey - 22, false, 6, 0.5);
      g.fillStyle = '#3b1518';
      g.beginPath(); g.ellipse(mx, my + 4, 9, 6.5, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = LIP; g.lineWidth = 2.4;
      g.beginPath(); g.ellipse(mx, my + 4, 9, 6.5, 0, 0, Math.PI * 2); g.stroke();
    }
    g.restore();
  });
  const t = tex(c, { aniso: 8 });
  t.repeat.set(0.25, 1);
  return t;
}

// Hair strands: fine light and dark streaks running from the crown down (multiplied by the hair colour)
export function hairTexture() {
  const c = canvas(512, 256);
  const g = c.getContext('2d');
  g.fillStyle = '#d8d8d8';
  g.fillRect(0, 0, 512, 256);
  const rnd = seeded(41);
  for (let i = 0; i < 900; i++) {
    const x = rnd() * 512, w = 0.6 + rnd() * 1.8;
    const v = rnd();
    g.strokeStyle = v < 0.5 ? `rgba(0,0,0,${0.08 + rnd() * 0.18})` : `rgba(255,255,255,${0.1 + rnd() * 0.25})`;
    g.lineWidth = w;
    const y0 = rnd() * 60, y1 = 120 + rnd() * 136, bend = (rnd() - 0.5) * 18;
    g.beginPath(); g.moveTo(x, y0); g.quadraticCurveTo(x + bend, (y0 + y1) / 2, x + bend * 0.4, y1); g.stroke();
  }
  const t = tex(c, { aniso: 8 });
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(3, 1);
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
  if (pattern === 'keeper') {
    // Goalkeeper kit: white with team-coloured trim
    g.fillStyle = '#f7f7fb';
    g.fillRect(0, 0, 512, 256);
    g.fillStyle = base;
    g.fillRect(0, 0, 512, 26);
    for (let x = 0; x < 512; x += 64) { g.fillRect(x + 4, 200, 56, 10); }
    g.fillStyle = '#d9dbe6';
    for (let y = 40; y < 190; y += 22) g.fillRect(0, y, 512, 3);
  }
  switch (pattern === 'keeper' ? '' : pattern) {
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
  g.strokeStyle = pattern === 'keeper' ? '#ffffff' : dark;
  g.strokeText(String(number), 256, 140);
  g.fillStyle = pattern === 'keeper' ? base : light;
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


// Desert backdrop: cream dunes, purple crystal spires and red rock mesas.
export function desertPanoramaTexture() {
  const W = 4096, H = 1024;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  const rnd = seeded(41);
  g.clearRect(0, 0, W, H);
  const horizon = H * 0.62;
  const haze = g.createLinearGradient(0, horizon - 300, 0, horizon + 40);
  haze.addColorStop(0, 'rgba(255,236,214,0)');
  haze.addColorStop(1, 'rgba(255,236,214,0.9)');
  g.fillStyle = haze;
  g.fillRect(0, horizon - 300, W, 340);
  // Crystal spires (jagged purple shards)
  const spire = (x, base, h, w, lean) => {
    const cols = ['#7b5cc8', '#9d84e6', '#6a4bb3', '#b9a6f2'];
    const n = 3 + Math.floor(rnd() * 4);
    for (let k = 0; k < n; k++) {
      const ox = x + (rnd() - 0.5) * w * 1.6, hh = h * (0.45 + rnd() * 0.6), ww = w * (0.25 + rnd() * 0.35);
      const tip = ox + lean * hh * (0.2 + rnd() * 0.3);
      g.fillStyle = cols[Math.floor(rnd() * cols.length)];
      g.beginPath(); g.moveTo(ox - ww, base); g.lineTo(tip, base - hh); g.lineTo(ox + ww, base); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.beginPath(); g.moveTo(tip, base - hh); g.lineTo(ox + ww * 0.15, base); g.lineTo(ox + ww, base); g.closePath(); g.fill();
    }
  };
  for (let i = 0; i < 70; i++) spire(rnd() * W, horizon + 20, 120 + rnd() * 330, 30 + rnd() * 60, rnd() < 0.5 ? -0.35 : 0.35);
  // Dunes
  const dune = (baseY, amp, freq, color, seed) => {
    const r = seeded(seed);
    const ph = [r() * 10, r() * 10];
    g.fillStyle = color;
    g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W; x += 8) {
      const u = (x / W) * Math.PI * 2;
      g.lineTo(x, baseY - amp * (0.5 + 0.5 * Math.sin(u * freq + ph[0])) - amp * 0.35 * Math.sin(u * freq * 2.7 + ph[1]));
    }
    g.lineTo(W, H); g.closePath(); g.fill();
  };
  dune(horizon + 20, 90, 5, '#efd7ae', 2);
  dune(horizon + 50, 70, 7, '#f6e6c6', 3);
  dune(horizon + 80, 50, 9, '#e6c592', 4);
  // Red rock mesas
  for (let i = 0; i < 26; i++) {
    const x = rnd() * W, w = 60 + rnd() * 200, h = 30 + rnd() * 90, y = horizon + 70 + rnd() * 50;
    g.fillStyle = rnd() < 0.5 ? '#b5653c' : '#9c5232';
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + w * 0.12, y - h); g.lineTo(x + w * 0.85, y - h * 0.9); g.lineTo(x + w, y); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,220,180,0.35)';
    g.fillRect(x + w * 0.14, y - h, w * 0.68, 6);
  }
  // Sand floor band
  const sand = g.createLinearGradient(0, horizon + 90, 0, H);
  sand.addColorStop(0, '#e8cb98');
  sand.addColorStop(1, '#d4ad6f');
  g.fillStyle = sand;
  g.fillRect(0, horizon + 110, W, H);
  return tex(c, { aniso: 4 });
}

export function stoneTexture() {
  const c = canvas(512, 64);
  const g = c.getContext('2d');
  const rnd = seeded(8);
  g.fillStyle = '#6b4a33';
  g.fillRect(0, 0, 512, 64);
  for (let i = 0; i < 90; i++) {
    const x = rnd() * 512, y = 8 + rnd() * 48, r = 6 + rnd() * 10;
    g.fillStyle = ['#a8764e', '#c08a5a', '#8f6243', '#d39a63'][Math.floor(rnd() * 4)];
    g.beginPath(); g.ellipse(x, y, r * 1.3, r, rnd(), 0, Math.PI * 2); g.fill();
  }
  const t = tex(c);
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

export function barricadeTexture() {
  const c = canvas(256, 64);
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 256, 64);
  for (let x = -64; x < 320; x += 48) {
    g.fillStyle = '#e8304f';
    g.beginPath(); g.moveTo(x, 64); g.lineTo(x + 24, 0); g.lineTo(x + 48, 0); g.lineTo(x + 24, 64); g.closePath(); g.fill();
  }
  g.strokeStyle = '#1b1530'; g.lineWidth = 6; g.strokeRect(0, 0, 256, 64);
  return tex(c);
}
