// Sculpted, cute-but-natural head: an egg-shaped skull with jaw, chin, soft cheeks, brow ridge, eye
// sockets and a small nose sculpted into one mesh; real 3D eyes (eyeball, iris, pupil, glint) with
// upper/lower lids and lashes that blink and squint; 3D brows; ears; a painted mouth and blush.
// Head-local units: the skull centre is at (0, 0, 0) with a base radius of R.
import * as THREE from 'three';

export const R = 0.62;
const EYE_R = 0.1;

// ---------------------------------------------------------------- skull shape
const g3 = (x, y, z, cx, cy, cz, wx, wy, wz) => Math.exp(-(((x - cx) / wx) ** 2 + ((y - cy) / wy) ** 2 + ((z - cz) / wz) ** 2));
const ss = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

// Displaces a point on a sphere of radius r (around the skull centre). faces: include facial
// features (nose, sockets, lips); hair shells only follow the skull.
export function shapeDir(x, y, z, r, faces = true) {
  const l = Math.hypot(x, y, z) || 1;
  const dx = x / l, dy = y / l, dz = z / l;
  let k = 1;
  // fuller cranium at the back, soft round cheeks, a gentle chin
  k += 0.035 * g3(dx, dy, dz, 0, 0.35, -0.9, 0.7, 0.6, 0.6);
  k += 0.04 * (g3(dx, dy, dz, 0.55, -0.32, 0.72, 0.32, 0.3, 0.4) + g3(dx, dy, dz, -0.55, -0.32, 0.72, 0.32, 0.3, 0.4));
  k += 0.035 * g3(dx, dy, dz, 0, -0.78, 0.6, 0.3, 0.25, 0.35);
  if (faces) {
    // brow ridge, eye sockets, small button nose, lips
    k += 0.018 * (g3(dx, dy, dz, 0.3, 0.26, 0.9, 0.22, 0.09, 0.3) + g3(dx, dy, dz, -0.3, 0.26, 0.9, 0.22, 0.09, 0.3));
    k -= 0.045 * (g3(dx, dy, dz, 0.33, 0.06, 0.93, 0.15, 0.13, 0.3) + g3(dx, dy, dz, -0.33, 0.06, 0.93, 0.15, 0.13, 0.3));
    k += 0.03 * g3(dx, dy, dz, 0, -0.02, 1, 0.07, 0.2, 0.3); // bridge
    k += 0.075 * g3(dx, dy, dz, 0, -0.17, 0.99, 0.1, 0.09, 0.3); // tip
    k += 0.022 * (g3(dx, dy, dz, 0.09, -0.21, 0.97, 0.06, 0.06, 0.3) + g3(dx, dy, dz, -0.09, -0.21, 0.97, 0.06, 0.06, 0.3)); // nostril wings
    k += 0.016 * g3(dx, dy, dz, 0, -0.39, 0.92, 0.17, 0.045, 0.3) + 0.018 * g3(dx, dy, dz, 0, -0.48, 0.88, 0.14, 0.05, 0.3); // lips
  }
  // egg: a little narrower than tall, slimmer jaw and chin
  const jaw = ss(-0.15, -0.9, dy);
  const sx = 0.88 * (1 - 0.2 * jaw), sy = 1.03, sz = 0.95 * (1 - (dz < 0 ? 0.14 : 0.05) * jaw);
  return [dx * r * k * sx, dy * r * k * sy, dz * r * k * sz];
}

function sculpt(geo, r, faces = true) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const [a, b, c] = shapeDir(p.getX(i), p.getY(i), p.getZ(i), r, faces);
    p.setXYZ(i, a, b, c);
  }
  geo.computeVertexNormals();
  return geo;
}

// Point (and outward normal) on the skull surface in a direction
function surface(dx, dy, dz, off = 0) {
  const l = Math.hypot(dx, dy, dz);
  const p = new THREE.Vector3(...shapeDir(dx / l, dy / l, dz / l, R + off));
  const e = 0.01;
  const a = new THREE.Vector3(...shapeDir(dx / l + e, dy / l, dz / l, R + off)).sub(p);
  const b = new THREE.Vector3(...shapeDir(dx / l, dy / l + e, dz / l, R + off)).sub(p);
  const n = new THREE.Vector3().crossVectors(a, b).normalize();
  if (n.dot(p) < 0) n.negate();
  return { p, n };
}

// Tube along a curve whose radius tapers from r0 to r1 (brows, hair strands, tails)
export function taperTube(points, r0, r1, radial = 8, tubular = 16) {
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, tubular, 1, radial, false);
  const pos = geo.attributes.position;
  const frames = curve.computeFrenetFrames(tubular, false);
  for (let i = 0; i <= tubular; i++) {
    const c = curve.getPointAt(i / tubular);
    const r = r0 + (r1 - r0) * (i / tubular);
    for (let j = 0; j <= radial; j++) {
      const idx = i * (radial + 1) + j;
      const v = new THREE.Vector3(pos.getX(idx), pos.getY(idx), pos.getZ(idx)).sub(c).multiplyScalar(r);
      pos.setXYZ(idx, c.x + v.x, c.y + v.y, c.z + v.z);
    }
  }
  void frames;
  geo.computeVertexNormals();
  return geo;
}

// ---------------------------------------------------------------- textures
function irisTexture() {
  // sphere-cap UVs: canvas top = pupil at the pole, then the iris, then a dark limbal ring
  const c = document.createElement('canvas');
  c.width = 8; c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, '#0a0708'); gr.addColorStop(0.36, '#0a0708');
  gr.addColorStop(0.42, '#ffffff'); gr.addColorStop(0.7, '#d8d8d8'); gr.addColorStop(0.88, '#9a9a9a');
  gr.addColorStop(0.94, '#2a2228'); gr.addColorStop(1, '#2a2228');
  g.fillStyle = gr; g.fillRect(0, 0, 8, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Mouth + blush atlas, 4 frames: soft smile, open happy smile, determined, ouch
export function mouthTexture() {
  const c = document.createElement('canvas');
  c.width = 2048; c.height = 512;
  const g = c.getContext('2d');
  g.scale(2, 2);
  const LIP = '#b25a54', DARK = '#5a1e22';
  for (let i = 0; i < 4; i++) {
    const ox = i * 256, mx = ox + 128, my = 155;
    const blush = (x) => { const gr = g.createRadialGradient(x, 100, 0, x, 100, 30); gr.addColorStop(0, 'rgba(255,120,120,0.32)'); gr.addColorStop(1, 'rgba(255,120,120,0)'); g.fillStyle = gr; g.fillRect(x - 32, 68, 64, 64); };
    blush(ox + 40); blush(ox + 216);
    g.lineCap = 'round'; g.lineJoin = 'round';
    if (i === 0) {
      g.fillStyle = 'rgba(190,96,92,0.35)'; g.beginPath(); g.ellipse(mx, my + 5, 11, 4, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = LIP; g.lineWidth = 3.4;
      g.beginPath(); g.moveTo(mx - 15, my - 2); g.quadraticCurveTo(mx, my + 7, mx + 15, my - 2); g.stroke();
    } else if (i === 1) {
      g.fillStyle = DARK;
      g.beginPath(); g.moveTo(mx - 19, my - 4); g.quadraticCurveTo(mx, my, mx + 19, my - 4); g.quadraticCurveTo(mx + 14, my + 17, mx, my + 18); g.quadraticCurveTo(mx - 14, my + 17, mx - 19, my - 4); g.fill();
      g.save(); g.clip();
      g.fillStyle = '#fbf7f2'; g.fillRect(mx - 20, my - 6, 40, 6.5);
      g.fillStyle = '#ff8c96'; g.beginPath(); g.ellipse(mx, my + 17, 11, 7, 0, 0, Math.PI * 2); g.fill();
      g.restore();
    } else if (i === 2) {
      g.fillStyle = DARK; g.beginPath(); g.ellipse(mx, my + 2, 8, 5.5, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = LIP; g.lineWidth = 2.4; g.beginPath(); g.ellipse(mx, my + 2, 8, 5.5, 0, 0, Math.PI * 2); g.stroke();
    } else {
      g.strokeStyle = LIP; g.lineWidth = 3.2;
      g.beginPath(); g.moveTo(mx - 13, my + 4);
      for (let k = 1; k <= 4; k++) g.lineTo(mx - 13 + k * 6.5, my + 4 + (k % 2 ? -3.5 : 3.5));
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.repeat.set(0.25, 1);
  return t;
}

// ---------------------------------------------------------------- shared geometry
let GEO = null;
function geos() {
  if (GEO) return GEO;
  const lidR = EYE_R * 1.1;
  const upper = new THREE.SphereGeometry(lidR, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  const lower = new THREE.SphereGeometry(lidR * 0.98, 16, 5, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  const lash = new THREE.TorusGeometry(lidR, 0.011, 4, 14, Math.PI);
  lash.rotateX(Math.PI / 2);
  lash.scale(1, 1, 1.02);
  const iris = new THREE.SphereGeometry(EYE_R * 1.004, 18, 6, 0, Math.PI * 2, 0, 0.66);
  iris.rotateX(Math.PI / 2);
  const brow = taperTube([new THREE.Vector3(-0.085, -0.012, 0), new THREE.Vector3(-0.02, 0.012, 0), new THREE.Vector3(0.045, 0.01, 0), new THREE.Vector3(0.09, -0.016, 0)], 0.017, 0.008, 6, 14);
  brow.scale(1, 1, 0.45);
  const ear = new THREE.SphereGeometry(0.11, 10, 8);
  ear.scale(0.32, 1, 0.68);
  GEO = {
    skull: sculpt(new THREE.SphereGeometry(R, 44, 34), R),
    mouth: sculpt(new THREE.SphereGeometry(R + 0.004, 16, 10, Math.PI / 2 - 0.75, 1.5, 1.5, 0.85), R + 0.004),
    eye: new THREE.SphereGeometry(EYE_R, 14, 10),
    iris, upper, lower, lash, brow, ear,
    glint: new THREE.SphereGeometry(0.016, 6, 4),
  };
  GEO.irisTex = irisTexture();
  GEO.mouthTex = mouthTexture();
  return GEO;
}

// Lid angles per expression: [upper, lower] (radians), brows: [raise, tilt]
const EXPR = [
  { up: -0.62, lo: 0.6, raise: 0, tilt: 0, mouth: 0 },
  { up: -0.48, lo: 0.16, raise: 0.012, tilt: -0.06, mouth: 1 },
  { up: -0.42, lo: 0.42, raise: -0.006, tilt: 0.16, mouth: 2 },
  { up: 0.02, lo: 0.34, raise: 0.01, tilt: -0.3, mouth: 3 },
];

export class Head {
  // parent: group at the skull centre; mats: { skin, brow }; outline: (geo) => mesh adder
  constructor(parent, opts = {}) {
    const G = geos();
    this.root = new THREE.Group();
    parent.add(this.root);
    const shadow = opts.shadows !== false;
    this.skull = new THREE.Mesh(G.skull, opts.skin);
    this.skull.castShadow = shadow;
    this.root.add(this.skull);
    if (opts.outlineMat) this.skull.add(new THREE.Mesh(G.skull, opts.outlineMat));
    this.mouthTex = G.mouthTex.clone();
    this.mouthTex.needsUpdate = true;
    this.mouth = new THREE.Mesh(G.mouth, new THREE.MeshBasicMaterial({ map: this.mouthTex, transparent: true, depthWrite: false }));
    this.mouth.renderOrder = 1;
    this.root.add(this.mouth);
    this.white = new THREE.MeshToonMaterial({ color: 0xf7f4ef });
    this.irisMat = new THREE.MeshBasicMaterial({ map: G.irisTex, color: 0x6b4423 });
    const glintMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const lashMat = new THREE.MeshBasicMaterial({ color: 0x24171a });
    this.eyes = [-1, 1].map((s) => {
      const { p, n } = surface(s * 0.34, 0.05, 0.93);
      const grp = new THREE.Group();
      grp.position.copy(p).addScaledVector(n, -EYE_R * 0.62);
      grp.rotation.y = s * 0.12;
      this.root.add(grp);
      const look = new THREE.Group();
      grp.add(look);
      look.add(new THREE.Mesh(G.eye, this.white));
      look.add(new THREE.Mesh(G.iris, this.irisMat));
      const glint = new THREE.Mesh(G.glint, glintMat);
      glint.position.set(-0.03, 0.035, EYE_R * 0.97);
      grp.add(glint);
      const up = new THREE.Mesh(G.upper, opts.skin);
      up.add(new THREE.Mesh(G.lash, lashMat));
      const lo = new THREE.Mesh(G.lower, opts.skin);
      grp.add(up, lo);
      return { grp, look, up, lo, glint };
    });
    this.brows = [-1, 1].map((s) => {
      const { p, n } = surface(s * 0.31, 0.3, 0.9, 0.006);
      const b = new THREE.Mesh(G.brow, opts.brow);
      b.position.copy(p);
      b.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
      b.userData.base = p.clone();
      b.userData.q = b.quaternion.clone();
      b.userData.s = s;
      this.root.add(b);
      return b;
    });
    this.ears = [-1, 1].map((s) => {
      const { p } = surface(s, -0.04, -0.06, -0.015);
      const e = new THREE.Mesh(G.ear, opts.skin);
      e.position.copy(p);
      e.rotation.y = s * 0.3;
      e.castShadow = false;
      this.root.add(e);
      if (opts.outlineMat) e.add(new THREE.Mesh(G.ear, opts.outlineMat));
      return e;
    });
    this.cur = { ...EXPR[0] };
    this.expr = 0;
    this.blinkT = 2 + Math.random() * 3;
    this.blink = 0;
    this.lookX = 0; this.lookY = 0;
  }

  setSkin(mat) {
    this.skull.material = mat;
    for (const e of this.eyes) { e.up.material = mat; e.lo.material = mat; }
    for (const e of this.ears) e.material = mat;
  }

  setBrow(mat) { for (const b of this.brows) b.material = mat; }
  setEyeColor(c) { this.irisMat.color.set(c); }

  setExpression(i) {
    if (this.expr === i) return;
    this.expr = i;
    this.mouthTex.offset.x = EXPR[i].mouth * 0.25;
  }

  // look: yaw towards what the player is watching (radians, relative to the head)
  update(dt, look = 0) {
    const e = EXPR[this.expr] || EXPR[0];
    const k = 1 - Math.exp(-14 * dt);
    for (const key of ['up', 'lo', 'raise', 'tilt']) this.cur[key] += (e[key] - this.cur[key]) * k;
    // natural blinking every few seconds
    this.blinkT -= dt;
    if (this.blinkT <= 0) { this.blink = 0.16; this.blinkT = 2.2 + Math.random() * 3.5; }
    if (this.blink > 0) this.blink -= dt;
    const bl = this.blink > 0 ? Math.sin((this.blink / 0.16) * Math.PI) : 0;
    const up = this.cur.up + (0.3 - this.cur.up) * bl;
    const lo = this.cur.lo + (0.32 - this.cur.lo) * bl * 0.5;
    this.lookY += (Math.max(-0.45, Math.min(0.45, look * 0.5)) - this.lookY) * k;
    for (const ey of this.eyes) {
      ey.up.rotation.x = up;
      ey.lo.rotation.x = lo;
      ey.look.rotation.set(0.04, this.lookY, 0);
    }
    for (const b of this.brows) {
      const s = b.userData.s;
      b.position.copy(b.userData.base);
      b.position.y += this.cur.raise;
      b.quaternion.copy(b.userData.q);
      b.rotateZ(s * this.cur.tilt);
    }
  }
}
