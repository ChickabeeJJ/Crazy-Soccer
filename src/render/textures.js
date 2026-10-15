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
    case 'flames': {
      g.fillStyle = '#1a1010'; g.fillRect(0, 0, 512, 256);
      const fl = (col, h) => { g.fillStyle = col; g.beginPath(); g.moveTo(0, 256); for (let x = 0; x <= 512; x += 32) g.lineTo(x + 16, 256 - h - ((x * 37) % 50)); g.lineTo(512, 256); g.closePath(); g.fill(); };
      fl('#ff3d00', 150); fl('#ff8a00', 105); fl('#ffd23f', 60);
      break;
    }
    case 'galaxyk': {
      const gr = g.createLinearGradient(0, 0, 512, 256);
      gr.addColorStop(0, '#120a3a'); gr.addColorStop(0.5, '#3a1d7a'); gr.addColorStop(1, '#0a1640');
      g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
      for (let i = 0; i < 140; i++) { g.fillStyle = i % 9 ? 'rgba(255,255,255,0.8)' : '#ff7ae0'; const r = (i % 5) * 0.5 + 0.6; g.fillRect((i * 151) % 512, 20 + ((i * 89) % 236), r, r); }
      g.fillStyle = 'rgba(255,122,224,0.25)'; g.beginPath(); g.ellipse(150, 140, 120, 40, -0.4, 0, Math.PI * 2); g.fill();
      break;
    }
    case 'neon':
      g.fillStyle = '#0b0820'; g.fillRect(0, 0, 512, 256);
      g.strokeStyle = '#ff3bd0'; g.lineWidth = 3;
      for (let x = 0; x < 512; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); }
      g.strokeStyle = '#38e1ff';
      for (let y = 24; y < 256; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); }
      break;
    case 'carbon':
      g.fillStyle = '#16161c'; g.fillRect(0, 0, 512, 256);
      for (let y = 0; y < 256; y += 8) for (let x = (y / 8) % 2 ? 8 : 0; x < 512; x += 16) { g.fillStyle = '#26262f'; g.fillRect(x, y, 8, 8); }
      g.fillStyle = base; g.fillRect(0, 196, 512, 14);
      break;
    case 'daybreak_royal': {
      // 7-Day Comeback exclusive: midnight royal fabric, gold sunrise rays, and star crests.
      const grd = g.createLinearGradient(0, 0, 512, 256);
      grd.addColorStop(0, '#120b35'); grd.addColorStop(0.45, '#4820a0'); grd.addColorStop(1, '#100a27');
      g.fillStyle = grd; g.fillRect(0, 0, 512, 256);
      g.save(); g.globalAlpha = 0.9;
      for (let x = -220; x < 620; x += 76) {
        const ray = g.createLinearGradient(x, 0, x + 100, 256);
        ray.addColorStop(0, 'rgba(255,207,63,0)'); ray.addColorStop(0.5, 'rgba(255,207,63,0.85)'); ray.addColorStop(1, 'rgba(255,207,63,0)');
        g.fillStyle = ray; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 30, 0); g.lineTo(x + 150, 256); g.lineTo(x + 120, 256); g.closePath(); g.fill();
      }
      g.globalAlpha = 1;
      for (let i = 0; i < 24; i++) {
        const x = (i * 137 + 31) % 512, y = (i * 83 + 17) % 226 + 15;
        g.fillStyle = i % 3 ? '#fff3b0' : '#ffcf3f';
        g.beginPath(); g.arc(x, y, i % 4 === 0 ? 3 : 1.6, 0, Math.PI * 2); g.fill();
      }
      g.restore();
      break;
    }
    case 'daybreak_royal': {
      // 7-Day Comeback exclusive: midnight royal fabric, gold sunrise rays, and star crests.
      const grd = g.createLinearGradient(0, 0, 512, 256);
      grd.addColorStop(0, '#120b35'); grd.addColorStop(0.45, '#4820a0'); grd.addColorStop(1, '#100a27');
      g.fillStyle = grd; g.fillRect(0, 0, 512, 256);
      g.save(); g.globalAlpha = 0.9;
      for (let x = -220; x < 620; x += 76) {
        const ray = g.createLinearGradient(x, 0, x + 100, 256);
        ray.addColorStop(0, 'rgba(255,207,63,0)'); ray.addColorStop(0.5, 'rgba(255,207,63,0.85)'); ray.addColorStop(1, 'rgba(255,207,63,0)');
        g.fillStyle = ray; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 30, 0); g.lineTo(x + 150, 256); g.lineTo(x + 120, 256); g.closePath(); g.fill();
      }
      g.globalAlpha = 1;
      for (let i = 0; i < 24; i++) {
        const x = (i * 137 + 31) % 512, y = (i * 83 + 17) % 226 + 15;
        g.fillStyle = i % 3 ? '#fff3b0' : '#ffcf3f';
        g.beginPath(); g.arc(x, y, i % 4 === 0 ? 3 : 1.6, 0, Math.PI * 2); g.fill();
      }
      g.restore();
      break;
    }
    case 'camo': {
      g.fillStyle = '#2b3324'; g.fillRect(0, 0, 512, 256);
      const cols = ['#3f4a31', '#1d2218', '#55603f'];
      for (let i = 0; i < 60; i++) { g.fillStyle = cols[i % 3]; g.beginPath(); g.ellipse((i * 113) % 512, (i * 71) % 256, 22 + (i % 4) * 8, 12 + (i % 3) * 6, i, 0, Math.PI * 2); g.fill(); }
      break;
    }
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
