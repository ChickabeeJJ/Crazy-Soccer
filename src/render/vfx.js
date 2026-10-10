// Particle effects (GPU points) and one-shot visual effects.
import * as THREE from 'three';
import { rand } from '../util/math.js';

const VERT = `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
varying float vAlpha;
varying vec3 vColor;
uniform float uScale;
void main() {
  vAlpha = aAlpha;
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / max(0.1, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const FRAG_SOFT = `
varying float vAlpha;
varying vec3 vColor;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d) * 2.0;
  float a = smoothstep(1.0, 0.0, r);
  a = a * a;
  gl_FragColor = vec4(vColor, a * vAlpha);
}`;
const FRAG_SOLID = `
varying float vAlpha;
varying vec3 vColor;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d) * 2.0;
  if (r > 1.0) discard;
  float shade = 0.85 + 0.15 * (1.0 - r);
  gl_FragColor = vec4(vColor * shade, vAlpha);
}`;

class Particles {
  constructor(max, additive) {
    this.max = max;
    this.n = 0;
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = geo;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 400 } },
      vertexShader: VERT,
      fragmentShader: additive ? FRAG_SOFT : FRAG_SOLID,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    // CPU state
    this.v = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.s0 = new Float32Array(max);
    this.s1 = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.a0 = new Float32Array(max);
  }

  emit(x, y, z, vx, vy, vz, life, s0, s1, color, grav = 0, drag = 0, alpha = 1) {
    let i = this.n;
    if (i >= this.max) {
      // Overwrite a random old particle
      i = Math.floor(Math.random() * this.max);
    } else this.n++;
    const i3 = i * 3;
    this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z;
    this.v[i3] = vx; this.v[i3 + 1] = vy; this.v[i3 + 2] = vz;
    this.col[i3] = color.r; this.col[i3 + 1] = color.g; this.col[i3 + 2] = color.b;
    this.life[i] = life; this.maxLife[i] = life;
    this.s0[i] = s0; this.s1[i] = s1;
    this.grav[i] = grav; this.drag[i] = drag;
    this.a0[i] = alpha;
  }

  update(dt) {
    let n = this.n;
    for (let i = 0; i < n; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        // swap-remove
        n--;
        if (i !== n) this.copy(n, i);
        i--;
        continue;
      }
      const i3 = i * 3;
      const d = 1 - this.drag[i] * dt;
      this.v[i3] *= d; this.v[i3 + 1] = this.v[i3 + 1] * d - this.grav[i] * dt; this.v[i3 + 2] *= d;
      this.pos[i3] += this.v[i3] * dt; this.pos[i3 + 1] += this.v[i3 + 1] * dt; this.pos[i3 + 2] += this.v[i3 + 2] * dt;
      if (this.pos[i3 + 1] < 0.05 && this.grav[i] > 0) { this.pos[i3 + 1] = 0.05; this.v[i3 + 1] *= -0.3; this.v[i3] *= 0.6; this.v[i3 + 2] *= 0.6; }
      const k = this.life[i] / this.maxLife[i];
      this.size[i] = this.s1[i] + (this.s0[i] - this.s1[i]) * k;
      this.alpha[i] = this.a0[i] * Math.min(1, k * 2.5);
    }
    this.n = n;
    this.geo.setDrawRange(0, n);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aColor.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
  }

  copy(from, to) {
    const f3 = from * 3, t3 = to * 3;
    for (let k = 0; k < 3; k++) {
      this.pos[t3 + k] = this.pos[f3 + k];
      this.v[t3 + k] = this.v[f3 + k];
      this.col[t3 + k] = this.col[f3 + k];
    }
    this.life[to] = this.life[from]; this.maxLife[to] = this.maxLife[from];
    this.s0[to] = this.s0[from]; this.s1[to] = this.s1[from];
    this.grav[to] = this.grav[from]; this.drag[to] = this.drag[from]; this.a0[to] = this.a0[from];
    this.size[to] = this.size[from]; this.alpha[to] = this.alpha[from];
  }
}

const C = (hex) => new THREE.Color(hex);
const tmpC = new THREE.Color();

export class VFX {
  constructor(scene, quality) {
    this.scene = scene;
    this.mul = quality.particles;
    this.glow = new Particles(Math.floor(3000 * this.mul) + 400, true);
    this.solid = new Particles(Math.floor(2000 * this.mul) + 300, false);
    scene.add(this.glow.points, this.solid.points);
    this.rings = [];
    this.bolts = [];
    this.ringGeo = new THREE.RingGeometry(0.8, 1, 48);
  }

  setScale(h) {
    this.glow.mat.uniforms.uScale.value = h * 0.9;
    this.solid.mat.uniforms.uScale.value = h * 0.9;
  }

  n(count) { return Math.max(1, Math.round(count * this.mul)); }

  update(dt) {
    this.glow.update(dt);
    this.solid.update(dt);
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.t += dt;
      const k = r.t / r.life;
      if (k >= 1) { this.scene.remove(r.mesh); r.mesh.material.dispose(); this.rings.splice(i, 1); continue; }
      const s = r.r0 + (r.r1 - r.r0) * (1 - (1 - k) * (1 - k));
      r.mesh.scale.set(s, s, s);
      r.mesh.material.opacity = (1 - k) * r.a;
    }
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.t += dt;
      if (b.t > b.life) { this.scene.remove(b.line); b.line.geometry.dispose(); b.line.material.dispose(); this.bolts.splice(i, 1); continue; }
      b.line.material.opacity = 1 - b.t / b.life;
    }
  }

  ring(x, y, z, color, r0, r1, life, alpha = 0.9, vertical = false) {
    const m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: alpha, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    m.position.set(x, y, z);
    if (!vertical) m.rotation.x = -Math.PI / 2;
    m.renderOrder = 6;
    this.scene.add(m);
    this.rings.push({ mesh: m, t: 0, life, r0, r1, a: alpha });
  }

  bolt(x0, y0, z0, x1, y1, z1, color = 0xfff27a) {
    const pts = [];
    const seg = 10;
    for (let i = 0; i <= seg; i++) {
      const k = i / seg;
      const j = i === 0 || i === seg ? 0 : 1;
      pts.push(new THREE.Vector3(x0 + (x1 - x0) * k + rand(-1, 1) * j, y0 + (y1 - y0) * k + rand(-0.6, 0.6) * j, z0 + (z1 - z0) * k + rand(-1, 1) * j));
    }
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.scene.add(line);
    this.bolts.push({ line, t: 0, life: 0.35 });
  }

  // --------------------------------------------------------------- effects
  kick(x, y, z, power, color = 0xffffff) {
    const c = C(color);
    for (let i = 0; i < this.n(10 + power * 18); i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(4, 10) * (0.6 + power);
      this.glow.emit(x, y, z, Math.cos(a) * s, rand(1, 5), Math.sin(a) * s, rand(0.15, 0.35), rand(0.5, 1.0), 0.1, c, 6, 3);
    }
    this.ring(x, y, z, color, 0.3, 1.6 + power * 2, 0.3, 0.8, false);
    if (power > 0.6) this.ring(x, y + 0.2, z, 0xffffff, 0.2, 2.5 + power * 2, 0.35, 0.6, true);
  }

  trail(x, y, z, color, size = 0.7) {
    tmpC.set(color);
    this.glow.emit(x + rand(-0.1, 0.1), y + rand(-0.1, 0.1), z + rand(-0.1, 0.1), 0, 0, 0, 0.28, size, 0.05, tmpC, 0, 0, 0.8);
  }

  fireTrail(x, y, z) {
    for (let i = 0; i < this.n(4); i++) {
      tmpC.setHSL(rand(0.02, 0.12), 1, rand(0.5, 0.65));
      this.glow.emit(x + rand(-0.3, 0.3), y + rand(-0.3, 0.3), z + rand(-0.3, 0.3), rand(-1, 1), rand(1, 3), rand(-1, 1), rand(0.25, 0.5), rand(0.9, 1.5), 0.1, tmpC, -2, 1);
    }
    if (Math.random() < 0.3 * this.mul) this.solid.emit(x, y, z, rand(-1, 1), rand(1, 2), rand(-1, 1), 0.6, 0.35, 0.6, C(0x3a2a2a), -1, 1, 0.5);
  }

  fireAura(x, y, z) {
    if (Math.random() > 0.7 * this.mul + 0.2) return;
    tmpC.setHSL(rand(0.03, 0.13), 1, rand(0.5, 0.62));
    const a = rand(0, Math.PI * 2), r = rand(0.3, 0.7);
    this.glow.emit(x + Math.cos(a) * r, y + rand(0, 1.5), z + Math.sin(a) * r, 0, rand(2.5, 5), 0, rand(0.3, 0.55), rand(0.8, 1.3), 0.1, tmpC, -1, 1, 0.9);
  }

  speedAura(x, y, z) {
    if (Math.random() > 0.5 * this.mul + 0.15) return;
    tmpC.setHSL(rand(0.25, 0.33), 1, 0.6);
    this.glow.emit(x + rand(-0.6, 0.6), y + rand(0.1, 2), z + rand(-0.6, 0.6), rand(-1, 1), rand(0, 1), rand(-1, 1), 0.35, 0.6, 0.05, tmpC, 0, 2);
  }

  jetFlame(x, y, z) {
    for (let i = 0; i < this.n(3); i++) {
      tmpC.setHSL(rand(0.05, 0.14), 1, rand(0.55, 0.7));
      this.glow.emit(x + rand(-0.1, 0.1), y, z + rand(-0.1, 0.1), rand(-0.5, 0.5), rand(-9, -5), rand(-0.5, 0.5), rand(0.12, 0.25), 0.9, 0.2, tmpC, 0, 0);
    }
  }

  dust(x, z, n = 6, color = 0xd8e8c0) {
    const c = C(color);
    for (let i = 0; i < this.n(n); i++) {
      this.solid.emit(x + rand(-0.4, 0.4), 0.15, z + rand(-0.4, 0.4), rand(-1.5, 1.5), rand(0.5, 2), rand(-1.5, 1.5), rand(0.35, 0.7), rand(0.4, 0.7), rand(0.9, 1.4), c, 0.5, 2, 0.55);
    }
  }

  sparkles(x, y, z, color, n = 20, speed = 6) {
    const c = C(color);
    for (let i = 0; i < this.n(n); i++) {
      const a = rand(0, Math.PI * 2), b = rand(-1, 1);
      const s = rand(0.3, 1) * speed;
      this.glow.emit(x, y, z, Math.cos(a) * s * Math.sqrt(1 - b * b), b * s + 2, Math.sin(a) * s * Math.sqrt(1 - b * b), rand(0.4, 0.8), rand(0.5, 0.9), 0.05, c, 5, 1.5);
    }
  }

  iceShatter(x, y, z) {
    this.sparkles(x, y, z, 0x8ff3ff, 30, 8);
    const w = C(0xe8fbff);
    for (let i = 0; i < this.n(18); i++) this.solid.emit(x, y, z, rand(-6, 6), rand(2, 8), rand(-6, 6), rand(0.5, 0.9), rand(0.25, 0.45), 0.1, w, 18, 0.5);
    this.ring(x, 0.1, z, 0x8ff3ff, 0.3, 3.5, 0.4);
  }

  confetti(x, y, z, n = 140) {
    const cols = [0xff3b5c, 0x3b8bff, 0xffd23f, 0x4cf08a, 0xc27bff, 0xffffff, 0xff8a1f];
    for (let i = 0; i < this.n(n); i++) {
      const c = C(cols[i % cols.length]);
      const a = rand(0, Math.PI * 2), s = rand(4, 16);
      this.solid.emit(x, y, z, Math.cos(a) * s, rand(8, 22), Math.sin(a) * s, rand(1.6, 3), rand(0.35, 0.6), rand(0.3, 0.5), c, 9, 1.6);
    }
  }

  fireworks(x, y, z) {
    const cols = [0xff3b5c, 0xffd23f, 0x4cf08a, 0x3fa9ff, 0xff7aff];
    for (let b = 0; b < 5; b++) {
      const cx = x + rand(-8, 8), cy = y + rand(6, 14), cz = z + rand(-8, 8);
      const c = C(cols[b % cols.length]);
      setTimeout(() => {
        for (let i = 0; i < this.n(60); i++) {
          const a = rand(0, Math.PI * 2), u = rand(-1, 1), s = rand(7, 11);
          const r = Math.sqrt(1 - u * u);
          this.glow.emit(cx, cy, cz, Math.cos(a) * r * s, u * s, Math.sin(a) * r * s, rand(0.8, 1.3), 1.2, 0.1, c, 4, 1.2);
        }
        this.ring(cx, cy, cz, c.getHex(), 0.5, 7, 0.4, 0.5, true);
      }, b * 160);
    }
  }

  hearts(x, y, z) {
    for (let i = 0; i < this.n(80); i++) {
      tmpC.setHSL(rand(0.9, 1.0), 0.9, rand(0.6, 0.75));
      this.glow.emit(x + rand(-3, 3), y + rand(0, 3), z + rand(-3, 3), rand(-3, 3), rand(3, 8), rand(-3, 3), rand(1.2, 2.2), rand(1.2, 2), 0.3, tmpC, -0.5, 0.8);
    }
    this.confetti(x, y, z, 40);
  }

  frost(x, y, z) {
    for (let i = 0; i < this.n(120); i++) {
      const a = rand(0, Math.PI * 2), s = rand(5, 15);
      tmpC.setHSL(rand(0.5, 0.56), 0.9, rand(0.7, 0.9));
      this.glow.emit(x, y, z, Math.cos(a) * s, rand(2, 10), Math.sin(a) * s, rand(0.8, 1.6), rand(0.8, 1.4), 0.1, tmpC, 3, 1.5);
    }
    this.ring(x, 0.2, z, 0xaaf6ff, 1, 14, 0.8, 0.8);
  }

  lightning(x, y, z) {
    for (let i = 0; i < 6; i++) {
      setTimeout(() => this.bolt(x + rand(-6, 6), 30, z + rand(-6, 6), x + rand(-2, 2), y, z + rand(-2, 2)), i * 70);
    }
    this.sparkles(x, y, z, 0xfff27a, 60, 12);
    this.ring(x, 0.2, z, 0xfff27a, 1, 12, 0.6, 0.9);
  }

  blackhole(x, y, z) {
    for (let i = 0; i < this.n(160); i++) {
      const a = rand(0, Math.PI * 2), r = rand(4, 9);
      tmpC.setHSL(rand(0.72, 0.82), 0.9, rand(0.45, 0.7));
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      this.glow.emit(px, y + rand(-2, 4), pz, (x - px) * 1.4 + Math.sin(a) * 6, rand(-1, 1), (z - pz) * 1.4 - Math.cos(a) * 6, rand(0.6, 1.0), 1.0, 0.1, tmpC, 0, 0);
    }
    this.ring(x, y, z, 0x9b5cff, 10, 0.5, 0.9, 0.9, true);
  }

  goal(fx, x, y, z, teamColor) {
    this.ring(x, 0.2, z, teamColor, 1, 16, 0.9, 0.9);
    this.sparkles(x, y, z, teamColor, 60, 10);
    switch (fx) {
      case 'fireworks': this.fireworks(x, y, z); this.confetti(x, y, z, 60); break;
      case 'hearts': this.hearts(x, y, z); break;
      case 'frost': this.frost(x, y, z); break;
      case 'lightning': this.lightning(x, y, z); break;
      case 'blackhole': this.blackhole(x, y, z); this.confetti(x, y, z, 40); break;
      default: this.confetti(x, y, z);
    }
  }

  pickup(x, z, color) {
    this.sparkles(x, 1, z, color, 30, 7);
    this.ring(x, 0.15, z, color, 0.3, 3, 0.4);
  }
}
