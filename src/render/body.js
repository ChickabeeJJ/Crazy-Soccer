// Rigged footballer body: a full skeleton (pelvis, spine, chest, neck, head, clavicles, shoulders,
// elbows, wrists, hips, knees, ankles) and one continuous skinned body mesh (jersey, skin, shorts,
// socks) whose weights blend smoothly across every joint, plus sculpted boots and hands.
// All geometry is built procedurally once and shared by every player.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const PELVIS_Y = 1.25; // rest height of the pelvis joint
export const HEAD_SCALE = 0.74; // head size relative to the original chibi head
export const BONES = ['pelvis', 'spine', 'chest', 'neck', 'head', 'clavL', 'shL', 'elL', 'wrL', 'clavR', 'shR', 'elR', 'wrR', 'hipL', 'kneeL', 'ankleL', 'hipR', 'kneeR', 'ankleR'];
const BI = Object.fromEntries(BONES.map((n, i) => [n, i]));
// bone: [parent, x, y, z] (local offsets in the rest pose)
const OFF = {
  pelvis: [null, 0, PELVIS_Y, 0], spine: ['pelvis', 0, 0.11, 0], chest: ['spine', 0, 0.3, 0], neck: ['chest', 0, 0.38, 0], head: ['neck', 0, 0.17, 0.01],
  clavL: ['chest', 0.1, 0.28, -0.01], shL: ['clavL', 0.19, -0.02, 0], elL: ['shL', 0, -0.36, 0], wrL: ['elL', 0, -0.33, 0],
  clavR: ['chest', -0.1, 0.28, -0.01], shR: ['clavR', -0.19, -0.02, 0], elR: ['shR', 0, -0.36, 0], wrR: ['elR', 0, -0.33, 0],
  hipL: ['pelvis', 0.11, -0.05, 0], kneeL: ['hipL', 0, -0.56, 0.01], ankleL: ['kneeL', 0, -0.54, -0.02],
  hipR: ['pelvis', -0.11, -0.05, 0], kneeR: ['hipR', 0, -0.56, 0.01], ankleR: ['kneeR', 0, -0.54, -0.02],
};
// rest-pose world positions (root at the origin)
const W = {};
for (const n of BONES) { const [p, x, y, z] = OFF[n]; const o = p ? W[p] : [0, 0, 0]; W[n] = [o[0] + x, o[1] + y, o[2] + z]; }

export const MAT = { jersey: 0, skin: 1, shorts: 2, socks: 3, trim: 4 };

export function createSkeleton(root) {
  const bones = {};
  for (const n of BONES) {
    const [p, x, y, z] = OFF[n];
    const b = new THREE.Bone();
    b.name = n;
    b.position.set(x, y, z);
    (p ? bones[p] : root).add(b);
    bones[n] = b;
  }
  root.updateMatrixWorld(true);
  return { bones, skeleton: new THREE.Skeleton(BONES.map((n) => bones[n])) };
}

const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Accumulates skinned tubes into one geometry with a draw group per material
class BodyBuilder {
  constructor() { this.pos = []; this.uv = []; this.si = []; this.sw = []; this.idx = [[], [], [], [], []]; this.seams = []; }

  // rings: [{ x, y, z, rx, rz, m, v }]; w(x, y, z) returns { boneName: weight }
  tube(rings, seg, w, caps = {}) {
    const base = this.pos.length / 3;
    rings.forEach((r, ri) => {
      for (let j = 0; j <= seg; j++) {
        const a = (j / seg) * Math.PI * 2;
        const x = r.x + Math.sin(a) * r.rx, y = r.y, z = r.z + Math.cos(a) * r.rz;
        this.vert(x, y, z, j / seg, r.v ?? ri / (rings.length - 1), w(x, y, z));
      }
      this.seams.push([base + ri * (seg + 1), base + ri * (seg + 1) + seg]);
    });
    for (let ri = 0; ri < rings.length - 1; ri++) {
      const m = rings[ri].m ?? 0;
      for (let j = 0; j < seg; j++) {
        const a = base + ri * (seg + 1) + j, b = a + seg + 1;
        // rings go downwards: wind so the outside faces out
        this.idx[m].push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    const cap = (ri, up) => {
      const r = rings[ri];
      const c = this.pos.length / 3;
      this.vert(r.x, r.y + (up ? 0.012 : -0.012), r.z, 0.5, up ? 1 : 0, w(r.x, r.y, r.z));
      const m = r.m ?? 0;
      for (let j = 0; j < seg; j++) {
        const a = base + ri * (seg + 1) + j;
        if (up) this.idx[m].push(c, a, a + 1); else this.idx[m].push(c, a + 1, a);
      }
    };
    if (caps.top) cap(0, true);
    if (caps.bottom) cap(rings.length - 1, false);
  }

  vert(x, y, z, u, v, wmap) {
    this.pos.push(x, y, z);
    this.uv.push(u, v);
    const ws = Object.entries(wmap).filter(([, q]) => q > 1e-4).sort((p, q) => q[1] - p[1]).slice(0, 4);
    const tot = ws.reduce((s, [, q]) => s + q, 0) || 1;
    for (let k = 0; k < 4; k++) { this.si.push(ws[k] ? BI[ws[k][0]] : 0); this.sw.push(ws[k] ? ws[k][1] / tot : 0); }
  }

  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
    const all = [];
    this.idx.forEach((list, m) => { if (list.length) { g.addGroup(all.length, list.length, m); all.push(...list); } });
    g.setIndex(all);
    g.computeVertexNormals();
    // weld the normals along each tube's u seam
    const n = g.attributes.normal;
    for (const [a, b] of this.seams) {
      const x = n.getX(a) + n.getX(b), y = n.getY(a) + n.getY(b), z = n.getZ(a) + n.getZ(b);
      const l = Math.hypot(x, y, z) || 1;
      n.setXYZ(a, x / l, y / l, z / l); n.setXYZ(b, x / l, y / l, z / l);
    }
    g.computeBoundingSphere();
    return g;
  }
}

// Torso/neck weights by height above the pelvis, with the shoulder caps following the arms
function torsoWeights(x, y, z) {
  const h = y - PELVIS_Y;
  const pelvis = 1 - ss(0.0, 0.16, h);
  let chest = ss(0.32, 0.5, h);
  let neck = ss(0.78, 0.88, h);
  const head = ss(0.98, 1.06, h);
  neck -= head; chest -= ss(0.78, 0.88, h);
  const spine = Math.max(0, 1 - pelvis - ss(0.32, 0.5, h));
  const w = { pelvis, spine, chest: Math.max(0, chest), neck: Math.max(0, neck), head };
  const side = x > 0 ? 'L' : 'R';
  const k = ss(0.16, 0.27, Math.abs(x)) * ss(0.52, 0.66, h) * 0.75;
  if (k > 0) {
    for (const key in w) w[key] *= 1 - k;
    w[`clav${side}`] = k * 0.55;
    w[`sh${side}`] = k * 0.45;
  }
  return w;
}

function buildBody() {
  const B = new BodyBuilder();
  const P = PELVIS_Y;
  const { jersey: J, skin: S, shorts: SH, socks: SO, trim: T } = MAT;
  // Jersey torso, loose athletic fit: ribbed collar, broad chest and shoulders, waist, flared hem
  const tor = [
    [0.86, 0.097, 0.089, 0, T], [0.83, 0.127, 0.110, 0, T], [0.81, 0.156, 0.127, 0, J], [0.775, 0.244, 0.162, -0.005, J], [0.725, 0.287, 0.184, -0.005, J],
    [0.66, 0.298, 0.199, 0, J], [0.57, 0.292, 0.207, 0.012, J], [0.46, 0.276, 0.201, 0.012, J], [0.34, 0.255, 0.188, 0.006, J], [0.2, 0.231, 0.171, 0, J],
    [0.08, 0.241, 0.179, 0, J], [-0.02, 0.254, 0.189, 0, J], [-0.07, 0.260, 0.196, 0, J],
  ];
  B.tube(tor.map(([h, rx, rz, oz, m]) => ({ x: 0, y: P + h, z: oz, rx, rz, m, v: (h + 0.09) / 0.95 })), 32, torsoWeights, { top: true, bottom: true });
  // Neck
  const nk = [[1.06, 0.078], [0.97, 0.072], [0.88, 0.073], [0.78, 0.08]];
  B.tube(nk.map(([h, r]) => ({ x: 0, y: P + h, z: 0.0, rx: r, rz: r * 0.95, m: S })), 14, torsoWeights, { top: true, bottom: true });
  // Shorts: seat, then a wide leg on each side down to mid-thigh
  const seat = [[0.14, 0.2, 0.15], [0.03, 0.222, 0.165], [-0.06, 0.234, 0.175], [-0.13, 0.232, 0.168], [-0.2, 0.19, 0.142]];
  B.tube(seat.map(([h, rx, rz]) => ({ x: 0, y: P + h, z: 0, rx, rz, m: SH })), 24, () => ({ pelvis: 1 }), { bottom: true });
  for (const s of [1, -1]) {
    const side = s > 0 ? 'L' : 'R';
    const hx = W[`hip${side}`][0], hy = W[`hip${side}`][1];
    const sl = [[0.03, 0.163], [-0.08, 0.174], [-0.2, 0.174], [-0.28, 0.172]];
    B.tube(sl.map(([d, r]) => ({ x: hx + s * 0.008, y: hy + d, z: 0, rx: r, rz: r * 1.04, m: SH })), 20,
      (x, y) => { const d = hy - y; const p = 1 - ss(-0.05, 0.08, d); return { pelvis: p * 0.7, [`hip${side}`]: 1 - p * 0.7 }; }, { top: true });
    // Leg: thigh and knee (skin), ribbed sock from just below the knee down into the boot
    const lg = [[-0.07, 0.112, 0, S], [0.06, 0.128, 0.006, S], [0.2, 0.128, 0.012, S], [0.34, 0.112, 0.012, S], [0.46, 0.094, 0.006, S], [0.55, 0.082, 0.004, S], [0.6, 0.08, -0.004, S],
      [0.625, 0.079, -0.006, SO], [0.63, 0.087, -0.008, SO], [0.7, 0.092, -0.024, SO], [0.8, 0.085, -0.022, SO], [0.92, 0.066, -0.01, SO], [1.02, 0.056, -0.006, SO], [1.1, 0.052, -0.012, SO]];
    const kz = W[`knee${side}`][2];
    // muscular legs: the upper thigh (under the shorts) stays slim so the shorts can fit close
    const legK = (d) => 1.12 + 0.2 * ss(0.18, 0.36, d);
    B.tube(lg.map(([d, r, oz, m]) => ({ x: hx, y: hy - d, z: oz + (d > 0.56 ? kz : 0), rx: r * legK(d), rz: r * legK(d) * 1.05, m, v: m === SO ? 1 - (d - 0.625) / 0.475 : d })), 18,
      (x, y) => {
        const d = hy - y;
        const knee = ss(0.48, 0.64, d), ankle = ss(0.98, 1.08, d), top = 1 - ss(-0.08, 0.05, d);
        return { pelvis: top * 0.45, [`hip${side}`]: (1 - knee) * (1 - top * 0.45), [`knee${side}`]: knee * (1 - ankle), [`ankle${side}`]: ankle };
      }, { top: true, bottom: true });
    // Arm: loose sleeve with a trimmed cuff, then the bare arm to the wrist
    const sx = W[`sh${side}`][0], sy = W[`sh${side}`][1];
    const ar = [[-0.07, 0.085, J], [0.0, 0.1, J], [0.08, 0.102, J], [0.16, 0.098, J], [0.205, 0.103, T], [0.235, 0.1, S], [0.236, 0.074, S], [0.29, 0.075, S], [0.34, 0.068, S], [0.365, 0.062, S], [0.41, 0.066, S], [0.5, 0.062, S], [0.6, 0.051, S], [0.67, 0.043, S]];
    B.tube(ar.map(([d, r, m]) => ({ x: sx, y: sy - d, z: 0, rx: r * 1.42, rz: r * 1.46, m, v: d })), 16,
      (x, y) => {
        const d = sy - y;
        const clav = 1 - ss(-0.07, 0.04, d), el = ss(0.29, 0.43, d), wr = ss(0.61, 0.68, d);
        return { [`clav${side}`]: clav * 0.6, [`sh${side}`]: (1 - el) * (1 - clav * 0.6), [`el${side}`]: el * (1 - wr), [`wr${side}`]: wr };
      }, { top: true, bottom: true });
  }
  return B.geometry();
}

// Ribbed sock with two bands at the top (canvas v = 1 is the top of the sock)
const TEX = new Map();
export function socksTexture(base, band) {
  const key = `s${base}|${band}`;
  if (TEX.has(key)) return TEX.get(key);
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 128, 256);
  g.fillStyle = 'rgba(0,0,0,0.09)';
  for (let x = 0; x < 128; x += 8) g.fillRect(x, 0, 3, 256);
  g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 0, 128, 12);
  g.fillStyle = band; g.fillRect(0, 22, 128, 12); g.fillRect(0, 44, 128, 7);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  TEX.set(key, t);
  return t;
}

// Shorts with a stripe down each side (u = 0.25 and 0.75 are the sides of every tube)
export function shortsTexture(base, stripe) {
  const key = `h${base}|${stripe}`;
  if (TEX.has(key)) return TEX.get(key);
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 256, 64);
  g.fillStyle = stripe;
  for (const x of [64, 192]) g.fillRect(x - 6, 0, 12, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  TEX.set(key, t);
  return t;
}

// Football boot (attached to the ankle bone): shaped upper, raised heel, sole with studs, laces
function bootGeometries() {
  const sh = new THREE.Shape();
  sh.moveTo(-0.08, -0.1);
  sh.lineTo(0.17, -0.1);
  sh.quadraticCurveTo(0.225, -0.098, 0.222, -0.066);
  sh.quadraticCurveTo(0.2, -0.032, 0.13, -0.022);
  sh.quadraticCurveTo(0.06, -0.006, 0.035, 0.05);
  sh.lineTo(-0.06, 0.055);
  sh.quadraticCurveTo(-0.098, 0.0, -0.092, -0.06);
  sh.quadraticCurveTo(-0.09, -0.095, -0.08, -0.1);
  const upper = new THREE.ExtrudeGeometry(sh, { depth: 0.11, bevelEnabled: true, bevelThickness: 0.022, bevelSize: 0.018, bevelSegments: 3, curveSegments: 8 });
  upper.translate(0, 0, -0.055);
  upper.rotateY(-Math.PI / 2);
  upper.computeVertexNormals();
  const parts = [];
  const sole = new THREE.BoxGeometry(0.14, 0.022, 0.33);
  sole.translate(0, -0.118, 0.07);
  parts.push(sole);
  for (const [x, z] of [[-0.04, -0.04], [0.04, -0.04], [-0.045, 0.1], [0.045, 0.1], [-0.04, 0.18], [0.04, 0.18]]) {
    const st = new THREE.CylinderGeometry(0.014, 0.018, 0.025, 6);
    st.translate(x, -0.138, z);
    parts.push(st);
  }
  const laces = [];
  for (let i = 0; i < 4; i++) {
    const l = new THREE.BoxGeometry(0.07, 0.008, 0.012);
    l.rotateX(-0.45);
    l.translate(0, -0.012 + i * 0.012 - (i > 2 ? 0 : 0), 0.13 - i * 0.03);
    laces.push(l);
  }
  // accent flash on both sides of the boot
  const fl = new THREE.Shape();
  fl.moveTo(-0.06, -0.08); fl.lineTo(0.12, -0.08); fl.quadraticCurveTo(0.05, -0.05, -0.01, -0.02); fl.lineTo(-0.075, -0.02); fl.closePath();
  const flash = [];
  for (const sd of [1, -1]) {
    const f = new THREE.ExtrudeGeometry(fl, { depth: 0.006, bevelEnabled: false, curveSegments: 6 });
    f.rotateY(-Math.PI / 2);
    f.translate(sd * 0.077 + 0.003, 0, 0);
    flash.push(f);
  }
  const out = { upper, sole: mergeGeometries(parts), laces: mergeGeometries(laces), flash: mergeGeometries(flash) };
  for (const g of Object.values(out)) g.translate(0, 0.035, 0); // studs rest on the ground
  return out;
}

// Relaxed hand (attached to the wrist bone): palm facing the thigh, fingers curled in, thumb forward
function handGeometry(side) {
  const parts = [];
  const palm = new THREE.SphereGeometry(0.06, 14, 10);
  palm.scale(0.62, 1.15, 0.95);
  palm.translate(0, -0.055, 0);
  parts.push(palm);
  for (let i = 0; i < 4; i++) {
    const f = new THREE.CapsuleGeometry(0.0145, 0.06, 3, 8);
    f.translate(0, -0.035, 0);
    f.rotateZ(-side * (0.45 + i * 0.05));
    f.translate(-side * 0.004, -0.112, (1.5 - i) * 0.026);
    parts.push(f);
  }
  const th = new THREE.CapsuleGeometry(0.016, 0.045, 3, 8);
  th.translate(0, -0.03, 0);
  th.rotateX(-0.7);
  th.rotateZ(-side * 0.25);
  th.translate(-side * 0.018, -0.045, 0.05);
  parts.push(th);
  const g = mergeGeometries(parts.map((p) => p.toNonIndexed()));
  g.scale(1.45, 1.45, 1.45);
  g.computeVertexNormals();
  return g;
}

let SHARED = null;
export function bodyGeos() {
  if (SHARED) return SHARED;
  SHARED = { body: buildBody(), boot: bootGeometries(), handL: handGeometry(1), handR: handGeometry(-1) };
  return SHARED;
}
