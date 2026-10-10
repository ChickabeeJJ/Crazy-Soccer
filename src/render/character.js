// Original chibi footballer: toon-shaded, outlined, fully procedural animation (no external assets).
import * as THREE from 'three';
import { TEAMS } from '../config.js';
import { SKIN_TONES, HAIR_COLORS } from '../cosmetics.js';
import { jerseyTexture, faceTexture, toonGradient } from './textures.js';
import { clamp, lerp, damp } from '../util/math.js';

let G = null; // shared geometries
let GRAD = null;
let FACE_TEX = null;
const jerseyCache = new Map();
const matCache = new Map();

function geos() {
  if (G) return G;
  G = {
    head: new THREE.SphereGeometry(0.62, 28, 20),
    face: new THREE.SphereGeometry(0.632, 24, 16, Math.PI / 2 - 0.85, 1.7, 0.92, 1.25),
    torso: new THREE.CapsuleGeometry(0.4, 0.34, 8, 20),
    shorts: new THREE.CapsuleGeometry(0.38, 0.12, 6, 16),
    upperArm: new THREE.CapsuleGeometry(0.14, 0.26, 4, 10),
    forearm: new THREE.CapsuleGeometry(0.125, 0.2, 4, 10),
    hand: new THREE.SphereGeometry(0.15, 12, 10),
    thigh: new THREE.CapsuleGeometry(0.17, 0.2, 4, 10),
    shin: new THREE.CapsuleGeometry(0.14, 0.18, 4, 10),
    shoe: roundedBox(0.3, 0.2, 0.5, 0.08),
    hairCap: new THREE.SphereGeometry(0.665, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.52),
    hairCapShort: new THREE.SphereGeometry(0.665, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.43),
    spike: new THREE.ConeGeometry(0.2, 0.52, 6),
    bun: new THREE.SphereGeometry(0.24, 12, 10),
    brim: new THREE.BoxGeometry(0.62, 0.06, 0.4),
    pom: new THREE.SphereGeometry(0.16, 10, 8),
    beanie: new THREE.CylinderGeometry(0.6, 0.67, 0.5, 20, 1, true),
    crownRing: new THREE.CylinderGeometry(0.42, 0.45, 0.22, 16, 1, true),
    crownSpike: new THREE.ConeGeometry(0.09, 0.22, 4),
    glove: new THREE.SphereGeometry(0.34, 14, 10),
    jetpack: roundedBox(0.55, 0.6, 0.3, 0.1),
    nozzle: new THREE.CylinderGeometry(0.1, 0.14, 0.22, 10),
  };
  GRAD = toonGradient();
  FACE_TEX = faceTexture();
  return G;
}

function roundedBox(w, h, d, r) {
  const shape = new THREE.Shape();
  const x = -w / 2, y = -d / 2;
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + d - r);
  shape.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  shape.lineTo(x + r, y + d);
  shape.quadraticCurveTo(x, y + d, x, y + d - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2 });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -h / 2, 0);
  geo.computeVertexNormals();
  return geo;
}

function toon(color, extra = {}) {
  const key = typeof color === 'number' || typeof color === 'string' ? `${color}|${JSON.stringify(extra)}` : null;
  if (key && matCache.has(key)) return matCache.get(key);
  geos();
  const m = new THREE.MeshToonMaterial({ color, gradientMap: GRAD, ...extra });
  if (key) matCache.set(key, m);
  return m;
}

let OUTLINE = null;
function outlineMat() {
  if (OUTLINE) return OUTLINE;
  OUTLINE = new THREE.MeshBasicMaterial({ color: 0x1b1530, side: THREE.BackSide });
  OUTLINE.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed += normalize(normal) * 0.032;');
  };
  return OUTLINE;
}

function jersey(pattern, team, number) {
  const key = `${pattern}|${team}|${number}`;
  if (!jerseyCache.has(key)) jerseyCache.set(key, toon(0xffffff, {}).clone());
  const m = jerseyCache.get(key);
  if (!m.map) { m.map = jerseyTexture(pattern, team, number); m.needsUpdate = true; }
  return m;
}

const J = ['pY', 'pX', 'pZ', 'pRY', 'sX', 'sY', 'sZ', 'hX', 'hY', 'hZ',
  'lsX', 'lsZ', 'leX', 'leZ', 'rsX', 'rsZ', 'reX', 'reZ',
  'lhX', 'lhZ', 'lkX', 'lfX', 'rhX', 'rhZ', 'rkX', 'rfX', 'sq'];

function basePose() {
  const p = {};
  for (const k of J) p[k] = 0;
  p.pY = 0.95;
  p.lsZ = 0.12; p.rsZ = -0.12; p.leX = -0.25; p.reX = -0.25;
  return p;
}

export class CharacterModel {
  constructor(cos, team, opts = {}) {
    geos();
    this.outline = opts.outline !== false;
    this.shadows = opts.shadows !== false;
    this.root = new THREE.Group();
    this.pose = basePose();
    this.target = basePose();
    this.phase = 0;
    this.time = Math.random() * 10;
    this.expr = 0;
    this.spinY = 0;
    this.frozenPose = false;
    this.lastAnim = 'idle';
    this.build();
    this.setAppearance(cos, team);
  }

  mesh(geo, mat, parent, pos, outline = true) {
    const m = new THREE.Mesh(geo, mat);
    if (pos) m.position.set(pos[0], pos[1], pos[2]);
    m.castShadow = this.shadows;
    parent.add(m);
    if (outline && this.outline) {
      const o = new THREE.Mesh(geo, outlineMat());
      m.add(o);
    }
    return m;
  }

  build() {
    const g = G;
    const placeholder = toon(0xffffff);
    this.pelvis = new THREE.Group();
    this.root.add(this.pelvis);
    this.shortsM = this.mesh(g.shorts, placeholder, this.pelvis, [0, 0.02, 0]);
    this.shortsM.scale.set(1.05, 0.8, 0.85);
    this.spine = new THREE.Group();
    this.spine.position.y = 0.08;
    this.pelvis.add(this.spine);
    this.torsoM = this.mesh(g.torso, placeholder, this.spine, [0, 0.36, 0]);
    this.torsoM.scale.set(1.08, 0.82, 0.86);
    this.neck = new THREE.Group();
    this.neck.position.y = 0.8;
    this.spine.add(this.neck);
    this.head = new THREE.Group();
    this.neck.add(this.head);
    this.headM = this.mesh(g.head, placeholder, this.head, [0, 0.52, 0]);
    this.faceTex = FACE_TEX.clone();
    this.faceTex.needsUpdate = true;
    this.faceM = new THREE.Mesh(g.face, new THREE.MeshBasicMaterial({ map: this.faceTex, transparent: true, depthWrite: false }));
    this.faceM.position.set(0, 0.52, 0);
    this.faceM.renderOrder = 1;
    this.head.add(this.faceM);
    this.hair = new THREE.Group();
    this.hair.position.y = 0.52;
    this.head.add(this.hair);

    const arm = (side) => {
      const sh = new THREE.Group();
      sh.position.set(side * 0.47, 0.6, 0);
      this.spine.add(sh);
      const up = this.mesh(g.upperArm, placeholder, sh, [0, -0.2, 0]);
      const el = new THREE.Group();
      el.position.y = -0.4;
      sh.add(el);
      const fo = this.mesh(g.forearm, placeholder, el, [0, -0.17, 0]);
      const hand = this.mesh(g.hand, placeholder, el, [0, -0.38, 0]);
      return { sh, up, el, fo, hand };
    };
    this.armL = arm(1);
    this.armR = arm(-1);
    const leg = (side) => {
      const hip = new THREE.Group();
      hip.position.set(side * 0.21, -0.05, 0);
      this.pelvis.add(hip);
      const th = this.mesh(g.thigh, placeholder, hip, [0, -0.2, 0]);
      const knee = new THREE.Group();
      knee.position.y = -0.42;
      hip.add(knee);
      const shin = this.mesh(g.shin, placeholder, knee, [0, -0.16, 0]);
      const foot = new THREE.Group();
      foot.position.y = -0.36;
      knee.add(foot);
      const shoe = this.mesh(g.shoe, placeholder, foot, [0, -0.02, 0.08]);
      return { hip, th, knee, shin, foot, shoe };
    };
    this.legL = leg(1);
    this.legR = leg(-1);

    // Props
    this.glove = this.mesh(g.glove, toon(0xff3355), this.armR.el, [0, -0.5, 0.05]);
    this.glove.visible = false;
    this.jet = new THREE.Group();
    this.jet.position.set(0, 0.42, -0.42);
    this.spine.add(this.jet);
    this.mesh(g.jetpack, toon(0x8c93a8), this.jet, [0, 0, 0]);
    for (const s of [-1, 1]) this.mesh(g.nozzle, toon(0x3b3f4d), this.jet, [s * 0.16, -0.38, 0], false);
    this.jet.visible = false;
  }

  setAppearance(cos, team) {
    cos = cos || {};
    const key = JSON.stringify([cos.skin, cos.hair, cos.hairColor, cos.jersey, cos.number, team]);
    if (key === this.appKey) return;
    this.appKey = key;
    const T = TEAMS[team] || TEAMS[0];
    const skin = toon(SKIN_TONES[cos.skin ?? 1] || SKIN_TONES[1]);
    const hairC = HAIR_COLORS[cos.hairColor ?? 0] || HAIR_COLORS[0];
    const shirt = jersey(cos.jersey || 'classic', team, cos.number || 7);
    const shorts = toon(0xf4f4fa);
    const socks = toon(T.color);
    const shoes = toon(team === 0 ? 0x2b2340 : 0x23304a);
    this.headM.material = skin;
    this.torsoM.material = shirt;
    this.shortsM.material = shorts;
    for (const a of [this.armL, this.armR]) { a.up.material = shirt; a.fo.material = skin; a.hand.material = skin; }
    for (const l of [this.legL, this.legR]) { l.th.material = shorts; l.shin.material = socks; l.shoe.material = shoes; }
    this.buildHair(cos.hair || 'spiky', toon(hairC), T);
  }

  buildHair(style, mat, T) {
    const h = this.hair;
    while (h.children.length) h.remove(h.children[0]);
    const g = G;
    const cap = () => { const m = this.mesh(g.hairCapShort, mat, h, [0, 0.02, -0.03]); m.rotation.x = -0.36; return m; };
    switch (style) {
      case 'bob': {
        const m = this.mesh(g.hairCap, mat, h, [0, -0.05, -0.04]);
        m.scale.set(1.08, 1.25, 1.08);
        m.rotation.x = -0.35;
        const fr = this.mesh(g.bun, mat, h, [0, 0.42, 0.4]);
        fr.scale.set(1.9, 0.6, 0.8);
        break;
      }
      case 'cap': {
        const m = this.mesh(g.hairCap, toon(T.color), h, [0, 0.06, 0]);
        m.scale.set(1.02, 0.95, 1.02);
        const b = this.mesh(g.brim, toon(T.dark), h, [0, 0.22, -0.66]);
        b.rotation.x = 0.15;
        break;
      }
      case 'mohawk': {
        cap().scale.set(0.98, 0.7, 0.98);
        for (let i = 0; i < 5; i++) {
          const s = this.mesh(g.spike, mat, h, [0, 0.58 - Math.abs(i - 1.5) * 0.06, 0.32 - i * 0.18]);
          s.rotation.x = -0.3 - i * 0.25;
          s.scale.set(0.8, 1.3, 1.6);
        }
        break;
      }
      case 'buns': {
        cap();
        for (const s of [-1, 1]) this.mesh(g.bun, mat, h, [s * 0.42, 0.5, -0.05]);
        break;
      }
      case 'afro': {
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * Math.PI * 2;
          const b = this.mesh(g.bun, mat, h, [Math.cos(a) * 0.48, 0.32 + Math.sin(i * 2.1) * 0.12, Math.sin(a) * 0.48 - 0.06]);
          b.scale.setScalar(1.25);
        }
        const top = this.mesh(g.hairCap, mat, h, [0, 0.12, -0.04]);
        top.scale.setScalar(1.12);
        break;
      }
      case 'beanie': {
        const bm = toon(T.color);
        const m = this.mesh(g.beanie, bm, h, [0, 0.3, -0.02]);
        m.rotation.x = -0.15;
        const top = this.mesh(g.hairCap, bm, h, [0, 0.2, -0.04]);
        top.scale.set(0.98, 0.9, 0.98);
        this.mesh(g.pom, toon(0xffffff), h, [0, 0.82, -0.12]);
        break;
      }
      case 'crown': {
        cap();
        const gold = toon(0xffcf3f, { emissive: 0x553300 });
        this.mesh(g.crownRing, gold, h, [0, 0.62, -0.06], false);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          this.mesh(g.crownSpike, gold, h, [Math.cos(a) * 0.43, 0.8, Math.sin(a) * 0.43 - 0.06], false);
        }
        break;
      }
      default: { // spiky
        cap();
        const spots = [[0, 0.66, -0.08, -0.25, 0], [0.3, 0.58, 0.02, -0.15, -0.55], [-0.3, 0.58, 0.02, -0.15, 0.55], [0.16, 0.6, 0.3, 0.55, -0.3], [-0.16, 0.6, 0.3, 0.55, 0.3], [0, 0.6, 0.36, 0.75, 0], [0, 0.45, -0.44, -1.05, 0], [0.36, 0.38, -0.3, -0.75, -0.65], [-0.36, 0.38, -0.3, -0.75, 0.65]];
        for (const [x, y, z, rx, rz] of spots) {
          const s = this.mesh(g.spike, mat, h, [x, y, z]);
          s.rotation.set(rx, 0, rz);
        }
      }
    }
  }

  setExpression(i) {
    if (this.expr === i) return;
    this.expr = i;
    this.faceTex.offset.x = i * 0.25;
  }

  // st: { anim, animT, speed, sprinting, charging, charge, hasBall, emote, fx, y, id, frozen }
  update(dt, st) {
    this.time += dt;
    const t = this.target;
    const b = basePose();
    Object.assign(t, b);
    const anim = st.anim || 'idle';
    const at = st.animT || 0;
    const speed = st.speed || 0;
    let expr = 0;
    let rate = 18;
    let spin = 0;

    if (anim === 'frozen') {
      // Hold the pose exactly as it was
      this.applyPose(this.pose);
      this.setExpression(2);
      return;
    }

    // Locomotion base
    const moving = speed > 0.5;
    const A = clamp(speed / 10, 0, st.sprinting ? 1.25 : 1);
    const stride = st.sprinting ? 2.9 : 2.4;
    this.phase += (speed * dt * Math.PI * 2) / (stride * 1.4);
    const ph = this.phase;
    if (moving) {
      const s = Math.sin(ph), c = Math.cos(ph);
      t.lhX = s * 0.95 * A; t.rhX = -s * 0.95 * A;
      t.lkX = 0.12 + Math.max(0, -c) * 1.5 * A; t.rkX = 0.12 + Math.max(0, c) * 1.5 * A;
      t.lfX = -t.lkX * 0.25; t.rfX = -t.rkX * 0.25;
      const arm = st.sprinting ? 1.25 : 0.85;
      t.lsX = -t.lhX * arm; t.rsX = -t.rhX * arm;
      t.leX = -0.5 - A * 0.6; t.reX = -0.5 - A * 0.6;
      t.pY = 0.95 + Math.abs(c) * 0.09 * A - 0.03 * A;
      t.sX = 0.1 * A + (st.sprinting ? 0.22 : 0);
      t.sY = s * 0.18 * A;
      t.pRY = -s * 0.1 * A;
      t.hX = -t.sX * 0.5;
      if (st.hasBall) { t.hX += 0.22; t.sX += 0.05; }
      if (st.sprinting) expr = 2;
    } else {
      const br = Math.sin(this.time * 2.2);
      t.sX = 0.03 * br; t.hX = -0.02 * br;
      t.lsZ = 0.14 + br * 0.03; t.rsZ = -0.14 - br * 0.03;
      t.pY = 0.95 + br * 0.008;
      if (st.hasBall) t.hX = 0.25;
    }

    // Jetpack flight
    if (st.fx && st.fx.jet > 0 && (st.y || 0) > 0.3) {
      t.lhX = 0.35 + Math.sin(this.time * 6) * 0.1; t.rhX = 0.35 - Math.sin(this.time * 6) * 0.1;
      t.lkX = 0.5; t.rkX = 0.5; t.lsZ = 0.9; t.rsZ = -0.9; t.lsX = 0; t.rsX = 0; t.sX = 0.3;
      expr = 1;
    }
    this.jet.visible = !!(st.fx && st.fx.jet > 0);

    // Kick charge
    if (st.charging && anim !== 'kick') {
      const c = st.charge || 0;
      t.rhX = 0.4 + c * 0.75; t.rkX = 0.9 + c * 0.6;
      t.lsZ = 0.6 + c * 0.3; t.rsZ = -0.45; t.lsX = -0.3; t.rsX = 0.4;
      t.sX = -0.08 - c * 0.08; t.sY = 0.25 + c * 0.15;
      t.pY = 0.93 - c * 0.04;
      expr = 2;
    }
    const k = clamp(at / (st.animDur || 0.38), 0, 1);
    switch (anim) {
      case 'kick': {
        rate = 30;
        const sw = k < 0.12 ? lerp(0.9, 1.1, k / 0.12) : k < 0.4 ? lerp(1.1, -1.5, (k - 0.12) / 0.28) : lerp(-1.5, -0.1, (k - 0.4) / 0.6);
        t.rhX = sw; t.rkX = k < 0.25 ? 1.3 : Math.max(0.05, 1.3 - (k - 0.25) * 6);
        t.lsX = 0.6; t.rsX = -0.6; t.lsZ = 0.7; t.rsZ = -0.4;
        t.sX = k < 0.3 ? -0.18 : 0.2; t.sY = k < 0.3 ? 0.35 : -0.25;
        t.pY = 0.95 + (k > 0.3 && k < 0.55 ? 0.1 : 0);
        t.lhX = 0.15; t.lkX = 0.3;
        t.sq = k > 0.3 && k < 0.5 ? 0.06 : 0;
        expr = 2;
        break;
      }
      case 'pass': {
        rate = 28;
        const sw = k < 0.35 ? lerp(0.6, -0.9, k / 0.35) : lerp(-0.9, 0, (k - 0.35) / 0.65);
        t.rhX = sw; t.rhZ = -0.35; t.rkX = 0.3; t.lsZ = 0.5; t.rsZ = -0.5; t.sY = -0.2;
        break;
      }
      case 'flick': {
        rate = 30;
        t.rkX = k < 0.45 ? lerp(0.3, 2.3, k / 0.45) : lerp(2.3, 0.3, (k - 0.45) / 0.55);
        t.rhX = 0.25; t.sX = 0.15; t.lsZ = 0.6; t.rsZ = -0.6; t.pY = 0.95 + Math.sin(k * Math.PI) * 0.12;
        expr = 1;
        break;
      }
      case 'slide': {
        rate = 22;
        t.pY = 0.48; t.pX = -1.05;
        t.rhX = -0.6; t.rkX = 0.08; t.rfX = 0.5;
        t.lhX = 0.25; t.lkX = 1.7;
        t.lsX = 0.9; t.rsX = 0.9; t.lsZ = 0.45; t.rsZ = -0.45; t.leX = 0; t.reX = 0;
        t.hX = 0.5;
        expr = 2;
        break;
      }
      case 'recover': {
        t.pY = 0.82; t.pX = -0.3; t.lkX = 0.8; t.rkX = 0.5; t.lsZ = 0.5; t.rsZ = -0.5;
        break;
      }
      case 'dive': {
        rate = 20;
        t.pY = 0.9 + Math.sin(k * Math.PI) * 0.7 - k * 0.45;
        t.pX = lerp(0.4, 1.4, Math.min(1, k * 2));
        t.lsX = -2.9; t.rsX = -2.9; t.lsZ = 0.25; t.rsZ = -0.25; t.leX = 0; t.reX = 0;
        t.lhX = 0.35; t.rhX = 0.2; t.lkX = 0.4; t.rkX = 0.2;
        t.hX = -0.6;
        expr = 2;
        break;
      }
      case 'getup': {
        rate = 12;
        const from = this.lastLying || -1.3;
        t.pX = lerp(from, 0, Math.min(1, k * 1.4));
        t.pY = lerp(0.35, 0.95, Math.min(1, k * 1.2));
        t.lkX = lerp(1.2, 0.1, k); t.rkX = lerp(1.2, 0.1, k);
        t.lhX = lerp(-1.0, 0, k); t.rhX = lerp(-1.0, 0, k);
        expr = k < 0.5 ? 3 : 0;
        break;
      }
      case 'fall':
      case 'hit':
      case 'slip': {
        rate = anim === 'slip' ? 26 : 20;
        const hard = anim !== 'hit';
        const kk = clamp(at / 0.3, 0, 1);
        t.pX = lerp(-0.3, hard ? -1.45 : -0.7, kk);
        t.pY = lerp(0.9, hard ? 0.32 : 0.7, kk) + (anim === 'slip' ? Math.sin(kk * Math.PI) * 0.6 : 0);
        t.lhX = anim === 'slip' ? -1.3 : -0.5; t.rhX = anim === 'slip' ? -1.1 : -0.2;
        t.lkX = 0.3; t.rkX = 0.6;
        t.lsZ = 1.6 + Math.sin(this.time * 14) * 0.2; t.rsZ = -1.6 - Math.sin(this.time * 14) * 0.2;
        t.lsX = -0.4; t.rsX = -0.4;
        t.hX = -0.2;
        this.lastLying = hard ? -1.45 : -0.7;
        expr = 3;
        break;
      }
      case 'spin': {
        spin = k * Math.PI * 2;
        t.lsZ = 1.1; t.rsZ = -1.1; t.sX = 0.15; t.hX = 0.2;
        expr = 1;
        break;
      }
      case 'dodge': {
        t.pZ = Math.sin(k * Math.PI) * 0.35; t.pY = 0.88; t.lkX = 0.5; t.rkX = 0.5;
        break;
      }
      case 'punch': {
        rate = 30;
        const ext = k < 0.25 ? k / 0.25 : k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
        t.rsX = lerp(-0.4, -1.6, ext); t.reX = lerp(-1.6, 0, ext); t.sY = lerp(0.3, -0.45, ext);
        t.lsX = -0.6; t.leX = -1.6;
        this.glove.visible = true;
        expr = 2;
        break;
      }
      case 'throw': {
        rate = 30;
        t.rsX = k < 0.35 ? lerp(-1.0, -3.0, k / 0.35) : lerp(-3.0, -0.9, (k - 0.35) / 0.65);
        t.reX = -0.4; t.sY = k < 0.35 ? 0.4 : -0.3; t.sX = k < 0.35 ? -0.1 : 0.2;
        expr = 2;
        break;
      }
      case 'celebrate': {
        const v = (st.id || 0) % 3;
        const tt = at;
        if (v === 0) { // jump & fist pump
          t.pY = 0.95 + Math.abs(Math.sin(tt * 7)) * 0.55;
          t.rsZ = -0.3; t.rsX = -2.9 + Math.sin(tt * 14) * 0.25; t.reX = -0.3; t.lsZ = 0.6;
          t.lkX = 0.4; t.rkX = 0.4;
        } else if (v === 1) { // airplane
          t.lsZ = 1.5; t.rsZ = -1.5; t.leX = 0; t.reX = 0;
          t.pZ = Math.sin(tt * 3) * 0.3; t.sX = 0.25; spin = Math.sin(tt * 2) * 0.6;
        } else { // knee slide pose
          t.pY = 0.55; t.lhX = -0.2; t.rhX = 0.6; t.lkX = 1.8; t.rkX = 1.9; t.sX = -0.35;
          t.lsZ = 2.3; t.rsZ = -2.3; t.leX = -0.2; t.reX = -0.2; t.hX = -0.4;
        }
        expr = 1;
        break;
      }
      case 'cheer': {
        t.pY = 0.95 + Math.abs(Math.sin(at * 6)) * 0.35;
        t.lsZ = 2.4 + Math.sin(at * 12) * 0.3; t.rsZ = -2.4 - Math.sin(at * 12) * 0.3;
        t.leX = -0.3; t.reX = -0.3;
        expr = 1;
        break;
      }
      case 'sad': {
        t.sX = 0.35; t.hX = 0.45; t.lsZ = 0.05; t.rsZ = -0.05; t.lsX = 0.15; t.rsX = 0.15; t.pY = 0.92;
        expr = 3;
        break;
      }
      case 'emote':
        spin = this.emotePose(st.emote, at, t);
        expr = st.emote === 'robot' ? 0 : st.emote === 'bow' ? 0 : 1;
        break;
      default:
    }
    if (anim !== 'punch') this.glove.visible = false;
    if (st.stun > 0 && anim !== 'frozen') expr = 3;

    // Damp toward target
    for (const key of J) this.pose[key] = damp(this.pose[key], t[key], rate, dt);
    this.spinY = spin;
    this.applyPose(this.pose);
    this.setExpression(expr);
    this.lastAnim = anim;
  }

  emotePose(em, at, t) {
    let spin = 0;
    switch (em) {
      case 'wave':
        t.rsZ = -2.6; t.reZ = 0; t.reX = -0.2 + Math.sin(at * 10) * 0.5; t.hZ = 0.1; break;
      case 'clap': {
        const c = Math.sin(at * 16);
        t.lsX = -1.2; t.rsX = -1.2; t.lsZ = 0.35 + c * 0.25; t.rsZ = -0.35 - c * 0.25; t.leX = -0.8; t.reX = -0.8;
        break;
      }
      case 'bow': {
        const k = clamp(at / 0.6, 0, 1) * (at > 2.4 ? Math.max(0, 1 - (at - 2.4) / 0.6) : 1);
        t.sX = 0.95 * k; t.hX = 0.3 * k; t.rsX = -0.9 * k; t.reX = -1.4 * k; t.lsX = 0.4 * k; break;
      }
      case 'flex':
        t.lsZ = 1.45; t.rsZ = -1.45; t.leZ = 1.9 + Math.sin(at * 6) * 0.15; t.reZ = -1.9 - Math.sin(at * 6) * 0.15; t.leX = 0; t.reX = 0;
        t.sX = -0.1; t.pY = 0.95 + Math.sin(at * 6) * 0.02; break;
      case 'cheer': {
        const c = (Math.sin(at * 8) + 1) / 2;
        t.lsZ = 0.2 + c * 2.6; t.rsZ = -0.2 - c * 2.6; t.lhZ = c * 0.35; t.rhZ = -c * 0.35; t.pY = 0.95 + c * 0.25; break;
      }
      case 'dance': {
        const s = Math.sin(at * 8);
        t.pZ = s * 0.18; t.sZ = -s * 0.22; t.lsX = -1.2 * Math.max(0, s); t.rsX = -1.2 * Math.max(0, -s);
        t.lsZ = 0.6; t.rsZ = -0.6; t.leX = -1.2; t.reX = -1.2; t.lkX = 0.3 + Math.abs(s) * 0.4; t.rkX = 0.3 + Math.abs(s) * 0.4;
        t.pY = 0.9 - Math.abs(s) * 0.08; t.hZ = s * 0.2; break;
      }
      case 'laugh': {
        const s = Math.sin(at * 22);
        t.sX = -0.25 + s * 0.06; t.hX = -0.35 + s * 0.05; t.lsX = -0.5; t.rsX = -0.5; t.leX = -1.5; t.reX = -1.5; t.lsZ = 0.35; t.rsZ = -0.35; break;
      }
      case 'spin':
        spin = at * 9; t.lsZ = 1.4; t.rsZ = -1.4; t.leX = 0; t.reX = 0; t.hX = -0.2; break;
      case 'robot': {
        const q = Math.floor(at * 3) % 4;
        const poses = [[-1.5, 0, -0.1, -1.5], [0, -1.5, -1.5, 0], [-1.5, -1.5, 0, 0], [0, 0, -1.5, -1.5]];
        const [a, b2, c, d] = poses[q];
        t.lsX = a; t.rsX = b2; t.leX = c; t.reX = d; t.hY = (q - 1.5) * 0.3; t.lsZ = 0.05; t.rsZ = -0.05;
        break;
      }
      case 'sit':
        t.pY = 0.38; t.lhX = -1.45; t.rhX = -1.45; t.lkX = 0.25; t.rkX = 0.25; t.sX = -0.25; t.lsX = 0.8; t.rsX = 0.8; t.leX = 0; t.reX = 0;
        t.lsZ = 0.3; t.rsZ = -0.3; break;
      default:
    }
    return spin;
  }

  applyPose(p) {
    this.pelvis.position.y = p.pY;
    this.pelvis.rotation.set(p.pX, p.pRY + this.spinY, p.pZ, 'YXZ');
    this.spine.rotation.set(p.sX, p.sY, p.sZ);
    this.head.rotation.set(p.hX, p.hY, p.hZ);
    this.armL.sh.rotation.set(p.lsX, 0, p.lsZ);
    this.armL.el.rotation.set(p.leX, 0, p.leZ);
    this.armR.sh.rotation.set(p.rsX, 0, p.rsZ);
    this.armR.el.rotation.set(p.reX, 0, p.reZ);
    this.legL.hip.rotation.set(p.lhX, 0, p.lhZ);
    this.legL.knee.rotation.x = p.lkX;
    this.legL.foot.rotation.x = p.lfX;
    this.legR.hip.rotation.set(p.rhX, 0, p.rhZ);
    this.legR.knee.rotation.x = p.rkX;
    this.legR.foot.rotation.x = p.rfX;
    const sq = p.sq;
    this.root.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5);
  }

  // World position of the right foot (for effects)
  footWorld(out) {
    return this.legR.foot.getWorldPosition(out);
  }

  handWorld(out) {
    return this.armR.hand.getWorldPosition(out);
  }

  headWorld(out) {
    return this.headM.getWorldPosition(out);
  }

  dispose() {
    this.root.removeFromParent();
    this.faceTex.dispose();
  }
}
