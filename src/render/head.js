// Round chibi head with a painted face (big dark eyes with a sparkle, short brows, rosy cheeks,
// small smile) and four expressions. Head-local units: the skull centre is at (0, 0, 0), radius R.
import * as THREE from 'three';

export const R = 0.62;

// The head is a plain sphere; hair shells and strands are placed with this helper
export function shapeDir(x, y, z, r) {
  const l = Math.hypot(x, y, z) || 1;
  return [(x / l) * r, (y / l) * r, (z / l) * r];
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

// Face atlas: 4 expressions in a row (normal, happy, effort, dizzy), drawn at 2x for crisp edges
function faceTexture() {
  const c = document.createElement('canvas');
  c.width = 2048; c.height = 512;
  const g = c.getContext('2d');
  g.scale(2, 2);
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
    } else {
      g.lineWidth = 6; g.beginPath();
      for (let a = 0; a < Math.PI * 4; a += 0.2) { const r = a * 2.2; const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; if (a) g.lineTo(px, py); else g.moveTo(px, py); }
      g.stroke();
    }
  };
  ['normal', 'happy', 'effort', 'dizzy'].forEach((f, i) => {
    const ox = i * 256;
    const lx = ox + 92, rx = ox + 164, ey = 110;
    if (f === 'effort') { eye(lx, ey, 'effort'); g.save(); g.translate(rx * 2, 0); g.scale(-1, 1); eye(rx, ey, 'effort'); g.restore(); }
    else { eye(lx, ey, f); eye(rx, ey, f); }
    g.strokeStyle = '#1b1530'; g.lineWidth = 6; g.lineCap = 'round';
    if (f === 'normal') { g.beginPath(); g.moveTo(lx - 14, ey - 34); g.lineTo(lx + 10, ey - 38); g.moveTo(rx - 10, ey - 38); g.lineTo(rx + 14, ey - 34); g.stroke(); }
    g.fillStyle = 'rgba(255,110,130,0.45)';
    g.beginPath(); g.ellipse(lx - 18, ey + 34, 15, 8, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(rx + 18, ey + 34, 15, 8, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#1b1530'; g.fillStyle = '#5a1f2e'; g.lineWidth = 6;
    const mx = ox + 128, my = 168;
    if (f === 'normal') { g.beginPath(); g.arc(mx, my - 8, 12, Math.PI * 0.15, Math.PI * 0.85); g.stroke(); }
    else if (f === 'happy') { g.beginPath(); g.arc(mx, my - 10, 18, 0, Math.PI); g.closePath(); g.fill(); g.fillStyle = '#ff7a8a'; g.beginPath(); g.arc(mx, my, 8, 0, Math.PI); g.fill(); }
    else if (f === 'effort') { g.beginPath(); g.ellipse(mx, my, 14, 9, 0, 0, Math.PI * 2); g.fill(); }
    else { g.beginPath(); g.moveTo(mx - 14, my); for (let k = 0; k <= 4; k++) g.lineTo(mx - 14 + k * 7, my + (k % 2 ? -5 : 5)); g.stroke(); }
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.repeat.set(0.25, 1);
  return t;
}

let GEO = null;
function geos() {
  if (GEO) return GEO;
  GEO = {
    skull: new THREE.SphereGeometry(R, 32, 24),
    face: new THREE.SphereGeometry(R + 0.012, 24, 16, Math.PI / 2 - 0.85, 1.7, 0.92, 1.25),
    tex: faceTexture(),
  };
  return GEO;
}

export class Head {
  constructor(parent, opts = {}) {
    const G = geos();
    this.root = new THREE.Group();
    parent.add(this.root);
    this.skull = new THREE.Mesh(G.skull, opts.skin);
    this.skull.castShadow = opts.shadows !== false;
    this.root.add(this.skull);
    if (opts.outlineMat) this.skull.add(new THREE.Mesh(G.skull, opts.outlineMat));
    this.faceTex = G.tex.clone();
    this.faceTex.needsUpdate = true;
    this.face = new THREE.Mesh(G.face, new THREE.MeshBasicMaterial({ map: this.faceTex, transparent: true, depthWrite: false }));
    this.face.renderOrder = 1;
    this.root.add(this.face);
    this.mouthTex = this.faceTex; // disposed with the model
    this.expr = -1;
    this.setExpression(0);
  }

  setSkin(mat) { this.skull.material = mat; }
  setBrow() {}
  setEyeColor() {}
  setExpression(i) {
    if (this.expr === i) return;
    this.expr = i;
    this.faceTex.offset.x = i * 0.25;
  }
  update() {}
}
