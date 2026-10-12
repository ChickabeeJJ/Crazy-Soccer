// Original chibi footballer: toon-shaded, outlined, fully procedural animation (no external assets).
import * as THREE from 'three';
import { TEAMS } from '../config.js';
import { SKIN_TONES, HAIR_COLORS, EYE_COLORS, CATALOG } from '../cosmetics.js';
import { jerseyTexture, hairTexture, toonGradient } from './textures.js';
import { Head, shapeDir, taperTube } from './head.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createSkeleton, bodyGeos, MAT, PELVIS_Y, HEAD_SCALE, socksTexture, shortsTexture } from './body.js';
import { clamp, lerp, damp, wrapAngle } from '../util/math.js';

let G = null; // shared geometries
let GRAD = null;
let HAIR_TEX = null;
const hairMats = new Map();
const jerseyCache = new Map();
const matCache = new Map();

function geos() {
  if (G) return G;
  G = {
    // Hair shells: one per hairline, hugging the head (see hairShell)
    shellCrop: hairShell({ thick: 0.045, lift: 0.05, front: 0.4, temple: 0.33 }),
    shellFade: hairShell({ thick: 0.012, lift: 0, back: -0.5, side: 0.18, burn: 0.05 }),
    shellFull: hairShell({ thick: 0.055, lift: 0.07, back: -0.52 }),
    shellBob: hairShell({ thick: 0.07, lift: 0.06, front: 0.24, temple: 0.2, side: -0.62, burn: -0.66, ear: -0.66, back: -0.72, flare: 0.1 }),
    shellUnder: hairShell({ thick: 0.03, lift: 0, back: -0.5 }),
    shellCurls: hairShell({ thick: 0.12, lift: 0.1, front: 0.38, back: -0.5 }),
    shellBuzz: hairShell({ thick: 0.014, lift: 0, front: 0.42, back: -0.48 }),
    shellSleek: hairShell({ thick: 0.04, lift: 0.02, front: 0.4, back: -0.5 }),
    shellLong: hairShell({ thick: 0.07, lift: 0.05, front: 0.3, temple: 0.25, side: -0.95, burn: -0.95, ear: -0.95, back: -1.0, flare: 0.12 }),
    tuft: tuftGeometry(),
    curl: new THREE.IcosahedronGeometry(0.15, 1),
    hairCap: new THREE.SphereGeometry(0.665, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.52),
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
  HAIR_TEX = hairTexture();
  return G;
}

// Hair shell: a sphere that hugs the head where there is hair and sinks under the skin elsewhere,
// so the hairline is smooth (forehead, temples, sideburns, over the ears, nape).
// Hairline heights are on the unit sphere (y), going round from the forehead (a = 0) to the back (a = PI).
function hairShell(o = {}) {
  const front = o.front ?? 0.44, temple = o.temple ?? 0.36, side = o.side ?? 0.1, burn = o.burn ?? -0.22;
  const ear = o.ear ?? 0.26, back = o.back ?? -0.42, thick = o.thick ?? 0.05, lift = o.lift ?? 0, flare = o.flare || 0;
  const knots = [[0, front], [0.62, front + 0.02], [0.92, temple], [1.18, side], [1.34, burn], [1.45, burn], [1.56, ear], [1.78, ear], [2.25, back], [Math.PI, back]];
  const hl = (a) => {
    for (let k = 1; k < knots.length; k++) if (a <= knots[k][0]) { const [a0, y0] = knots[k - 1], [a1, y1] = knots[k]; return y0 + (y1 - y0) * ((a - a0) / (a1 - a0)); }
    return back;
  };
  const geo = new THREE.SphereGeometry(1, 60, 36);
  const p = geo.attributes.position;
  const R = 0.62;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = Math.abs(Math.atan2(x, z));
    const h = hl(a);
    const e = Math.min(1, Math.max(0, (y - (h - 0.05)) / 0.1));
    const k = e * e * (3 - 2 * e);
    const up = Math.max(0, y);
    const r = R - 0.05 + k * (0.05 + thick + lift * up * up + flare * Math.max(0, -y) * (a > 0.9 ? 1 : 0));
    const [sx, sy, sz] = shapeDir(x, y, z, r, false);
    p.setXYZ(i, sx, sy, sz);
  }
  geo.computeVertexNormals();
  return geo;
}

// A single swept tuft of hair: a flattened, slightly curved blade
function tuftGeometry() {
  const geo = new THREE.ConeGeometry(0.1, 0.34, 6, 4);
  geo.translate(0, 0.17, 0);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    p.setX(i, p.getX(i) * 1.25);
    p.setZ(i, p.getZ(i) * 0.6 - y * y * 0.9); // bends backwards towards the tip
  }
  geo.computeVertexNormals();
  return geo;
}

// Skin uses a softer four-tone ramp so faces don't get a hard dark half
let SOFT_GRAD = null;
const skinMats = new Map();
function skinMat(color) {
  if (!SOFT_GRAD) {
    // smooth (linearly filtered) ramp: soft shading on skin, no blotchy bands across the face
    SOFT_GRAD = new THREE.DataTexture(new Uint8Array([168, 168, 168, 255, 205, 205, 205, 255, 236, 236, 236, 255, 255, 255, 255, 255]), 4, 1, THREE.RGBAFormat);
    SOFT_GRAD.minFilter = SOFT_GRAD.magFilter = THREE.LinearFilter;
    SOFT_GRAD.needsUpdate = true;
  }
  if (!skinMats.has(color)) skinMats.set(color, new THREE.MeshToonMaterial({ color, gradientMap: SOFT_GRAD }));
  return skinMats.get(color);
}

// Strand-based hairstyles built from tapered tubes (merged into one geometry per style, cached)
const STYLE_GEO = {};
const TUFT_GEO = new Map();
const onHead = (a, y, r) => { const c = Math.sqrt(Math.max(0, 1 - y * y)); const [x, yy, z] = shapeDir(Math.sin(a) * c, y, Math.cos(a) * c, r, false); return new THREE.Vector3(x, yy, z); };
function styleGeo(style) {
  if (STYLE_GEO[style]) return STYLE_GEO[style];
  const parts = [];
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  if (style === 'ponytail') {
    // tail hangs from a tie at the back of the crown (pivot at the tie, see buildHair)
    parts.push(taperTube([V(0, 0, 0), V(0, -0.08, -0.16), V(0, -0.36, -0.24), V(0, -0.66, -0.2), V(0, -0.86, -0.12)], 0.17, 0.05, 12, 20));
  } else if (style === 'dreads') {
    for (let i = 0; i < 18; i++) {
      const a = Math.PI * 0.42 + (i / 17) * Math.PI * 1.16;
      const top = onHead(a, 0.28 + (i % 2) * 0.12, 0.68);
      const out = new THREE.Vector3(Math.sin(a), 0, Math.cos(a)).multiplyScalar(0.12);
      parts.push(taperTube([top, top.clone().add(out).add(V(0, -0.18, 0)), top.clone().add(out.clone().multiplyScalar(1.4)).add(V(0, -0.55, 0)), top.clone().add(out.clone().multiplyScalar(1.5)).add(V(0, -0.9 - (i % 3) * 0.06, 0))], 0.055, 0.042, 6, 10));
    }
  } else if (style === 'cornrows') {
    for (let i = -3; i <= 3; i++) {
      const a = i * 0.24;
      // from the hairline over the top of the head and down to the nape
      const path = [];
      for (let k = 0; k <= 10; k++) { const t = k / 10; const phi = 0.95 - t * 2.75; path.push(new THREE.Vector3(Math.sin(a) * Math.sin(phi), Math.cos(phi), Math.cos(a) * Math.sin(phi))); }
      const ridge = path.map((d) => { const [x, y, z] = shapeDir(d.x, d.y, d.z, 0.64, false); return V(x, y, z); });
      parts.push(taperTube(ridge, 0.045, 0.04, 6, 24));
    }
  } else if (style === 'long') {
    // the hair hangs down the back to the shoulders
    const back = new THREE.CylinderGeometry(0.5, 0.6, 0.62, 28, 1, true, Math.PI * 0.62, Math.PI * 0.76 * 1.0);
    back.translate(0, -0.55, -0.06);
    parts.push(back.toNonIndexed());
    for (let i = 0; i < 10; i++) {
      const a = Math.PI * 0.62 + (i / 9) * Math.PI * 0.76;
      const p0 = V(Math.sin(a) * 0.55, -0.5, Math.cos(a) * 0.55 - 0.06);
      parts.push(taperTube([p0, p0.clone().add(V(0, -0.22, 0)), p0.clone().add(V(Math.sin(a) * 0.04, -0.4, Math.cos(a) * 0.04))], 0.07, 0.02, 6, 8));
    }
  }
  const g = mergeGeometries(parts.map((q) => (q.index ? q.toNonIndexed() : q)));
  g.computeVertexNormals();
  STYLE_GEO[style] = g;
  return g;
}

const kitMats = new Map();
function kitMat(map) {
  if (!kitMats.has(map)) kitMats.set(map, new THREE.MeshToonMaterial({ color: 0xffffff, map, gradientMap: GRAD }));
  return kitMats.get(map);
}

const hairMatsDS = new Map();
function hairMatDS(color) {
  const key = color.getHexString();
  if (!hairMatsDS.has(key)) hairMatsDS.set(key, new THREE.MeshToonMaterial({ color, gradientMap: GRAD, map: HAIR_TEX, side: THREE.DoubleSide }));
  return hairMatsDS.get(key);
}

function hairMat(color) {
  const key = typeof color === 'string' ? color : color.getHexString();
  if (!hairMats.has(key)) hairMats.set(key, new THREE.MeshToonMaterial({ color, gradientMap: GRAD, map: HAIR_TEX }));
  return hairMats.get(key);
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

// Thin ink outline hull (back faces pushed out along the normal); works for skinned meshes too
const OUTLINES = new Map();
function outlineMat(width = 0.02) {
  if (OUTLINES.has(width)) return OUTLINES.get(width);
  const m = new THREE.MeshBasicMaterial({ color: 0x1b1530, side: THREE.BackSide });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n transformed += normalize(normal) * ${width.toFixed(4)};`);
  };
  m.customProgramCacheKey = () => `outline${width}`;
  OUTLINES.set(width, m);
  return m;
}

function jersey(pattern, team, number) {
  const key = `${pattern}|${team}|${number}`;
  if (!jerseyCache.has(key)) jerseyCache.set(key, toon(0xffffff, {}).clone());
  const m = jerseyCache.get(key);
  if (!m.map) { m.map = jerseyTexture(pattern, team, number); m.needsUpdate = true; }
  return m;
}

// Pose channels (radians, pY in rest-pose units where 0.95 = standing). lfl/rfl: how much each foot
// is kept flat on the ground automatically; br: breathing; wf: wrist flex
const J = ['pY', 'pX', 'pZ', 'pRY', 'sX', 'sY', 'sZ', 'hX', 'hY', 'hZ',
  'lsX', 'lsZ', 'leX', 'leZ', 'rsX', 'rsZ', 'reX', 'reZ',
  'lhX', 'lhZ', 'lkX', 'lfX', 'rhX', 'rhZ', 'rkX', 'rfX', 'sq', 'lfl', 'rfl', 'br', 'wf'];
const PK = PELVIS_Y / 0.95; // pose heights were authored for a 0.95 pelvis

function basePose() {
  const p = {};
  for (const k of J) p[k] = 0;
  p.pY = 0.95;
  p.lsZ = 0.12; p.rsZ = -0.12; p.leX = -0.25; p.reX = -0.25;
  p.lfl = 1; p.rfl = 1;
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

  mesh(geo, mat, parent, pos, outline = true, width) {
    const m = new THREE.Mesh(geo, mat);
    if (pos) m.position.set(pos[0], pos[1], pos[2]);
    m.castShadow = this.shadows;
    parent.add(m);
    if (outline && this.outline) {
      const o = new THREE.Mesh(geo, outlineMat(width));
      m.add(o);
    }
    return m;
  }

  build() {
    const g = G;
    const placeholder = toon(0xffffff);
    const { bones, skeleton } = createSkeleton(this.root);
    this.bones = bones;
    this.skeleton = skeleton;
    this.pelvis = bones.pelvis;
    const BG = bodyGeos();
    // One skinned body (jersey, skin, shorts, socks) + a skinned outline hull sharing the skeleton
    this.bodyMats = [placeholder, placeholder, placeholder, placeholder, placeholder];
    this.body = new THREE.SkinnedMesh(BG.body, this.bodyMats);
    this.body.castShadow = this.shadows;
    this.body.frustumCulled = false;
    this.root.add(this.body);
    this.body.bind(skeleton);
    if (this.outline) {
      const o = new THREE.SkinnedMesh(BG.body, outlineMat());
      o.frustumCulled = false;
      this.root.add(o);
      o.bind(skeleton);
    }
    // Head: the face, hair and ears ride on the head bone
    this.head = new THREE.Group();
    this.head.scale.setScalar(HEAD_SCALE);
    this.head.position.set(0, -0.012, 0);
    bones.head.add(this.head);
    const skullC = new THREE.Group();
    skullC.position.y = 0.52;
    this.head.add(skullC);
    this.headRig = new Head(skullC, { skin: placeholder, brow: placeholder, outlineMat: this.outline ? outlineMat(0.018) : null, shadows: this.shadows });
    this.headM = this.headRig.skull;
    this.hair = new THREE.Group();
    this.hair.position.y = 0.52;
    this.head.add(this.hair);
    // Hands and boots are rigid, attached to the wrist and ankle bones
    const limb = (side) => {
      const S = side > 0 ? 'L' : 'R';
      const hand = this.mesh(side > 0 ? BG.handL : BG.handR, placeholder, bones[`wr${S}`], [0, 0.01, 0], false);
      hand.castShadow = false;
      const boot = new THREE.Group();
      bones[`ankle${S}`].add(boot);
      const upper = this.mesh(BG.boot.upper, placeholder, boot, null, false);
      upper.castShadow = false;
      const sole = this.mesh(BG.boot.sole, placeholder, boot, null, false);
      sole.castShadow = false;
      const laces = this.mesh(BG.boot.laces, toon(0xf4f4fa), boot, null, false);
      const flash = this.mesh(BG.boot.flash, placeholder, boot, null, false);
      return { sh: bones[`sh${S}`], el: bones[`el${S}`], wr: bones[`wr${S}`], clav: bones[`clav${S}`], hip: bones[`hip${S}`], knee: bones[`knee${S}`], foot: bones[`ankle${S}`], hand, upper, sole, laces, flash };
    };
    const L = limb(1), R = limb(-1);
    this.armL = { sh: L.sh, el: L.el, wr: L.wr, clav: L.clav, hand: L.hand };
    this.armR = { sh: R.sh, el: R.el, wr: R.wr, clav: R.clav, hand: R.hand };
    this.legL = { hip: L.hip, knee: L.knee, foot: L.foot, upper: L.upper, sole: L.sole, flash: L.flash };
    this.legR = { hip: R.hip, knee: R.knee, foot: R.foot, upper: R.upper, sole: R.sole, flash: R.flash };

    // Props
    this.glove = this.mesh(g.glove, toon(0xff3355), this.armR.wr, [0, -0.1, 0.03]);
    this.glove.scale.setScalar(0.8);
    this.glove.visible = false;
    this.jet = new THREE.Group();
    this.jet.position.set(0, 0.16, -0.24);
    bones.chest.add(this.jet);
    this.mesh(g.jetpack, toon(0x8c93a8), this.jet, [0, 0, 0]);
    for (const s of [-1, 1]) this.mesh(g.nozzle, toon(0x3b3f4d), this.jet, [s * 0.16, -0.38, 0], false);
    this.jet.visible = false;
  }

  setAppearance(cos, team, keeper = false) {
    cos = cos || {};
    const key = JSON.stringify([cos.skin, cos.hair, cos.hairColor, cos.eyeColor, cos.jersey, cos.number, cos.boots, team, keeper]);
    if (key === this.appKey) return;
    this.appKey = key;
    const T = TEAMS[team] || TEAMS[0];
    const skin = skinMat(SKIN_TONES[cos.skin ?? 1] || SKIN_TONES[1]);
    const hairC = HAIR_COLORS[cos.hairColor ?? 0] || HAIR_COLORS[0];
    const shirt = jersey(keeper ? 'keeper' : cos.jersey || 'classic', team, keeper ? 1 : cos.number || 7);
    // Kit: shorts with side stripes, ribbed socks with bands, collar and cuff trim
    const tc = T.css;
    const shorts = kitMat(shortsTexture(keeper ? '#2b2f3d' : '#f4f4fa', keeper ? '#ffffff' : tc));
    const socks = kitMat(socksTexture(keeper ? '#f4f4fa' : tc, keeper ? tc : '#ffffff'));
    this.bodyMats[MAT.jersey] = shirt;
    this.bodyMats[MAT.skin] = skin;
    this.bodyMats[MAT.shorts] = shorts;
    this.bodyMats[MAT.socks] = socks;
    this.bodyMats[MAT.trim] = toon(keeper ? T.color : 0xffffff);
    // double-sided so no gap between the separate tubes can ever show as a see-through hole
    for (const m of this.bodyMats) if (m.side !== THREE.DoubleSide) { m.side = THREE.DoubleSide; m.needsUpdate = true; }
    this.body.material = this.bodyMats;
    this.headRig.setSkin(skin);
    this.headRig.setBrow(toon(new THREE.Color(hairC).multiplyScalar(0.8).getHex()));
    this.headRig.setEyeColor(EYE_COLORS[cos.eyeColor ?? 0] || EYE_COLORS[0]);
    // Keepers wear big gloves in the team colour
    const handMat = keeper ? toon(T.color) : skin;
    for (const a of [this.armL, this.armR]) { a.hand.material = handMat; a.hand.scale.setScalar(keeper ? 1.3 : 1); }
    const bt = CATALOG.boots.find((b) => b.id === cos.boots) || CATALOG.boots[0];
    for (const l of [this.legL, this.legR]) { l.upper.material = toon(bt.base); l.sole.material = toon(bt.sole); l.flash.material = toon(bt.accent); }
    this.buildHair(cos.hair || 'spiky', hairMat(hairC), T);
  }

  buildHair(style, mat, T) {
    const h = this.hair;
    while (h.children.length) h.remove(h.children[0]);
    this.tail = null;
    const g = G;
    // Head-local point on the hair surface at a direction (yaw a from the front, height y on the unit sphere)
    const at = (a, y, r = 0.69) => { const c = Math.sqrt(Math.max(0, 1 - y * y)); const [x, yy, z] = shapeDir(Math.sin(a) * c, y, Math.cos(a) * c, r, false); return new THREE.Vector3(x, yy, z); };
    // Tufts stand out along the head normal and lean back (sweep) / sideways
    // All tufts of a style are baked into one cached geometry (one draw call per hairstyle)
    let tuftCall = 0;
    const tufts = (list, m, scale = 1) => {
      const key = `${style}|${tuftCall++}`;
      if (!TUFT_GEO.has(key)) {
        const up = new THREE.Vector3(0, 1, 0);
        const o = new THREE.Object3D();
        const parts = [];
        for (const [a, y, len, sweep, tw] of list) {
          const pos = at(a, y, 0.64);
          o.position.copy(pos);
          o.quaternion.setFromUnitVectors(up, pos.clone().normalize());
          o.rotateY(Math.PI);
          o.rotateX(-(sweep ?? 0.5));
          o.rotateY(tw || 0);
          o.scale.set(scale, (len || 1) * scale, scale);
          o.updateMatrix();
          parts.push(g.tuft.clone().applyMatrix4(o.matrix));
        }
        const merged = mergeGeometries(parts);
        merged.computeVertexNormals();
        TUFT_GEO.set(key, merged);
      }
      const t = this.mesh(TUFT_GEO.get(key), m, h, [0, 0, 0], false);
      t.castShadow = false;
    };
    // hair has no ink outline: the hull would show as a dark seam along the hairline
    const shell = (geo, m) => this.mesh(geo, m, h, [0, 0, 0], false);
    switch (style) {
      case 'bob': {
        // Chin-length bob: long sides framing the face, a soft side-swept fringe
        shell(g.shellBob, mat);
        tufts([[-0.35, 0.6, 1.1, 1.25, 0.3], [0, 0.66, 1.15, 1.3, 0.2], [0.35, 0.62, 1.0, 1.25, 0.1], [0.62, 0.56, 0.9, 1.2, 0]], mat, 1.05);
        break;
      }
      case 'cap': {
        shell(g.shellUnder, mat);
        const m = this.mesh(g.hairCap, toon(T.color), h, [0, 0.13, 0]);
        m.scale.set(1.0, 0.92, 1.03);
        const b = this.mesh(g.brim, toon(T.dark), h, [0, 0.29, -0.66]);
        b.rotation.x = 0.15;
        break;
      }
      case 'mohawk': {
        // Skin-fade sides (a thin, darker shell) and a tall swept crest down the middle
        shell(g.shellFade, hairMat(mat.color.clone().multiplyScalar(0.6)), false);
        // crest: a ridge of long swept tufts from the hairline to the crown, shorter towards the nape
        const crest = [];
        for (let i = 0; i < 9; i++) {
          const t = -0.62 + i * 0.3; // polar angle from the top: negative = front
          const len = 1.75 - Math.max(0, t) * 0.45;
          for (const side of [-0.13, 0, 0.13]) crest.push([t < 0 ? side : Math.PI - side, Math.cos(t), len, t < 0 ? 0.35 : 0.75, 0]);
        }
        tufts(crest, mat, 1.12);
        break;
      }
      case 'buzz': {
        shell(g.shellBuzz, hairMat(mat.color.clone().multiplyScalar(0.85)));
        break;
      }
      case 'quiff': {
        // short sides, volume swept up and back off the forehead
        shell(g.shellCrop, mat);
        const q = [];
        for (let i = 0; i < 9; i++) { const a = -0.55 + (i / 8) * 1.1; q.push([a, 0.72, 1.55 - Math.abs(a) * 0.5, -0.15, 0]); q.push([a * 0.8, 0.86, 1.25, 0.25, 0]); }
        tufts(q, mat, 1.1);
        break;
      }
      case 'curtains': {
        // middle part with the fringe falling to both sides
        shell(g.shellFull, mat);
        const c = [];
        for (const sd of [-1, 1]) for (let i = 0; i < 4; i++) c.push([sd * (0.12 + i * 0.16), 0.66 - i * 0.04, 1.25 - i * 0.08, 1.35, sd * 0.45]);
        tufts(c, mat, 1.08);
        break;
      }
      case 'ponytail': {
        shell(g.shellSleek, mat);
        const pivot = new THREE.Group();
        pivot.position.copy(onHead(Math.PI, 0.42, 0.66));
        h.add(pivot);
        const tail = this.mesh(styleGeo('ponytail'), mat, pivot, [0, 0, 0], false);
        tail.castShadow = this.shadows;
        const tie = this.mesh(g.crownRing, toon(T.color), pivot, [0, -0.02, -0.02], false);
        tie.scale.set(0.24, 0.35, 0.24); tie.rotation.x = 1.2;
        this.tail = pivot;
        break;
      }
      case 'manbun': {
        shell(g.shellSleek, mat);
        const b = this.mesh(g.bun, mat, h, [0, 0.6, -0.3]);
        b.scale.set(1.0, 0.85, 0.95);
        const tie = this.mesh(g.crownRing, toon(0x1b1530), h, [0, 0.47, -0.24], false);
        tie.scale.set(0.34, 0.3, 0.34); tie.rotation.x = -0.6;
        break;
      }
      case 'cornrows': {
        shell(g.shellBuzz, hairMat(mat.color.clone().multiplyScalar(0.8)));
        this.mesh(styleGeo('cornrows'), mat, h, [0, 0, 0], false);
        break;
      }
      case 'long': {
        shell(g.shellLong, mat);
        const back = this.mesh(styleGeo('long'), mat, h, [0, 0, 0], false);
        back.material = hairMatDS(mat.color);
        tufts([[-0.3, 0.62, 1.0, 1.3, 0.25], [0.3, 0.62, 1.0, 1.3, -0.25], [0, 0.66, 0.9, 1.25, 0]], mat, 1.05);
        break;
      }
      case 'dreads': {
        shell(g.shellFull, mat);
        this.mesh(styleGeo('dreads'), mat, h, [0, 0, 0], false);
        break;
      }
      case 'buns': {
        shell(g.shellFull, mat);
        for (const sd of [-1, 1]) {
          const b = this.mesh(g.bun, mat, h, [sd * 0.4, 0.52, -0.1]);
          b.scale.set(1, 0.92, 1);
          const tie = this.mesh(g.crownRing, toon(T.color), h, [sd * 0.33, 0.43, -0.08], false);
          tie.scale.set(0.42, 0.3, 0.42);
          tie.rotation.z = -sd * 0.7;
        }
        break;
      }
      case 'afro': {
        // Big curls: a thick base with clusters of curls over the top and sides
        shell(g.shellCurls, mat);
        const rnd = (k) => { const v = Math.sin(k * 127.1) * 43758.5; return v - Math.floor(v); };
        let k = 0;
        for (let ring = 0; ring < 5; ring++) {
          const y = 0.95 - ring * 0.26;
          const n = ring === 0 ? 3 : 7 + ring * 2;
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + ring * 0.4;
            if (Math.cos(a) > 0.55 && y < 0.5) continue; // keep the face clear
            const p = at(a, Math.min(0.98, y), 0.72 + rnd(++k) * 0.05);
            const c = new THREE.Mesh(g.curl, mat);
            c.position.copy(p);
            c.scale.setScalar(0.9 + rnd(++k) * 0.5);
            c.rotation.set(rnd(++k) * 3, rnd(++k) * 3, 0);
            c.castShadow = this.shadows;
            h.add(c);
          }
        }
        break;
      }
      case 'beanie': {
        shell(g.shellUnder, mat);
        const bm = toon(T.color);
        const m = this.mesh(g.beanie, bm, h, [0, 0.3, -0.02]);
        m.rotation.x = -0.15;
        m.scale.set(1, 1, 1);
        const top = this.mesh(g.hairCap, bm, h, [0, 0.2, -0.04]);
        top.scale.set(0.98, 0.9, 0.98);
        this.mesh(g.pom, toon(0xffffff), h, [0, 0.82, -0.12]);
        break;
      }
      case 'crown': {
        shell(g.shellFull, mat);
        const gold = toon(0xffcf3f, { emissive: 0x553300 });
        this.mesh(g.crownRing, gold, h, [0, 0.62, -0.06], false);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          this.mesh(g.crownSpike, gold, h, [Math.cos(a) * 0.43, 0.8, Math.sin(a) * 0.43 - 0.06], false);
        }
        break;
      }
      default: { // spiky: short textured crop with messy spiked tufts on top, longer at the front
        shell(g.shellCrop, mat);
        const list = [];
        const rows = [[0.9, 6, 1.0, 0.35], [0.75, 9, 0.95, 0.55], [0.58, 11, 0.8, 0.85]];
        rows.forEach(([y, n, len, sweep], r) => {
          for (let i = 0; i < n; i++) {
            const a = -Math.PI + ((i + (r % 2) * 0.5) / n) * Math.PI * 2;
            const front = Math.cos(a);
            if (y < 0.7 && front < -0.4) continue; // the back stays short
            list.push([a, y, len * (0.85 + 0.35 * Math.max(0, front)), sweep + (front < 0 ? 0.6 : 0), Math.sin(i * 7.3) * 0.4]);
          }
        });
        tufts(list, mat);
      }
    }
  }

  setExpression(i) {
    this.expr = i;
    this.headRig.setExpression(i);
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

    // Body state shared by every animation: vertical speed, turning rate, landing, ground contact
    const y = st.y || 0;
    const yaw = this.root.rotation.y;
    const yawRate = dt > 0 ? wrapAngle(yaw - (this.prevYaw ?? yaw)) / dt : 0;
    this.prevYaw = yaw;
    this.turn = damp(this.turn || 0, clamp(yawRate, -9, 9), 7, dt);
    const air = y > 0.12;
    if (this.wasAir && !air) this.landT = 0.3;
    this.wasAir = air;
    if (this.landT > 0) this.landT -= dt;
    const lying = ['slide', 'dive', 'fall', 'hit', 'slip', 'getup', 'bike', 'volley', 'recover'].includes(anim) || (anim === 'emote' && st.emote === 'sit');
    this.groundK = damp(this.groundK ?? 1, lying ? 0 : air ? 0.35 : 1, 14, dt);

    // Locomotion: a stride-locked run cycle with contact/passing poses, pelvis bob and twist,
    // counter-rotating chest and arms, forward lean and banking into turns
    const moving = speed > 0.5;
    const A = clamp(speed / 10, 0, st.sprinting ? 1.3 : 1);
    const stride = 2.6 + speed * 0.12; // metres per full cycle (two steps)
    this.phase += (speed * dt * Math.PI * 2) / stride;
    const ph = this.phase;
    if (moving) {
      const s = Math.sin(ph), c = Math.cos(ph);
      const legA = 0.85 * A, kneeA = 1.4 * A;
      t.lhX = -s * legA - 0.06 * A; t.rhX = s * legA - 0.06 * A;
      t.lkX = 0.12 + Math.max(0, c) * kneeA + Math.max(0, -s) * 0.3 * A;
      t.rkX = 0.12 + Math.max(0, -c) * kneeA + Math.max(0, s) * 0.3 * A;
      t.lfX = Math.max(0, -s) * 0.55 * A - Math.max(0, c) * 0.25 * A;
      t.rfX = Math.max(0, s) * 0.55 * A - Math.max(0, -c) * 0.25 * A;
      const plant = 1 - clamp(A * 0.8, 0, 0.75);
      t.lfl = plant; t.rfl = plant;
      t.pY = 0.95 - 0.035 * A + Math.cos(2 * ph) * 0.032 * A;
      t.pRY = s * 0.12 * A;
      t.pZ = Math.cos(ph) * 0.035 * A;
      t.pX = 0.05 * A + (st.sprinting ? 0.05 : 0);
      t.sX = 0.07 * A + (st.sprinting ? 0.12 : 0);
      t.sY = -s * 0.32 * A;
      // arms swing opposite the legs, elbows bent harder when sprinting
      const armA = (st.sprinting ? 1.05 : 0.8) * A;
      t.lsX = s * armA; t.rsX = -s * armA;
      t.leX = -(0.8 + 0.5 * A) - Math.max(0, -t.lsX) * 0.35;
      t.reX = -(0.8 + 0.5 * A) - Math.max(0, -t.rsX) * 0.35;
      t.lsZ = 0.14 + 0.06 * A; t.rsZ = -(0.14 + 0.06 * A);
      // head stays level and looks where you run
      t.hY = -(t.pRY + t.sY) * 0.85;
      t.hX = -(t.pX + t.sX) * 0.75;
      if (st.hasBall) { t.hX += 0.25; t.sX += 0.04; }
      // bank into turns
      const bank = clamp(-this.turn * 0.035 * A, -0.3, 0.3);
      t.pZ += bank; t.sZ -= bank * 0.5; t.hZ -= bank * 0.4;
      if (st.sprinting) expr = 2;
    } else {
      // Idle: breathing, a slow weight shift between the feet, relaxed arms, looking around
      const br = Math.sin(this.time * 1.9), ws = Math.sin(this.time * 0.55);
      t.pY = 0.938 + br * 0.004;
      t.pZ = ws * 0.022; t.pX = 0.02;
      t.lhZ = 0.035 - ws * 0.022; t.rhZ = -0.035 - ws * 0.022;
      t.lkX = 0.08 + Math.max(0, -ws) * 0.13; t.rkX = 0.08 + Math.max(0, ws) * 0.13;
      t.lhX = -t.lkX * 0.5; t.rhX = -t.rkX * 0.5;
      t.sX = 0.02; t.br = br * 0.025;
      t.lsZ = 0.13 + br * 0.012; t.rsZ = -(0.13 + br * 0.012);
      t.lsX = 0.05; t.rsX = 0.05; t.leX = -0.24; t.reX = -0.24; t.wf = 0.1;
      t.hY = Math.sin(this.time * 0.31) * Math.sin(this.time * 0.11 + 1) * 0.3;
      t.hX = -0.02;
      if (st.hasBall) {
        // ready stance over the ball
        t.lkX = 0.35; t.rkX = 0.35; t.lhX = -0.22; t.rhX = -0.22; t.pY = 0.9; t.sX = 0.16; t.hX = 0.28; t.hY = 0;
        t.lsZ = 0.32; t.rsZ = -0.32; t.leX = -0.5; t.reX = -0.5;
      }
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
      // load the shot: kicking leg drawn back, plant knee flexed, hips and chest opened, arm out
      const c = st.charge || 0;
      t.rhX = 0.45 + c * 0.7; t.rkX = 0.95 + c * 0.75; t.rfX = 0.45; t.rfl = 0;
      t.lhX = -0.15 - c * 0.12; t.lkX = 0.28 + c * 0.2; t.lfl = 1;
      t.lsZ = 0.65 + c * 0.45; t.rsZ = -0.4 - c * 0.2; t.lsX = -0.35; t.rsX = 0.45 + c * 0.2; t.leX = -0.45;
      t.sX = -0.06 - c * 0.08; t.sY = 0.28 + c * 0.2; t.pRY = 0.12 + c * 0.1;
      t.pY = 0.92 - c * 0.05; t.hX = 0.2; t.hY = -t.sY * 0.6;
      expr = 2;
    }
    const k = clamp(at / (st.animDur || 0.38), 0, 1);
    switch (anim) {
      case 'kick': {
        // plant, wind-up with the hips opened, whip through the ball, follow-through with a hop
        rate = 32;
        const a = clamp(k / 0.3, 0, 1), b = clamp((k - 0.28) / 0.2, 0, 1), c = clamp((k - 0.5) / 0.5, 0, 1);
        const sa = a * a * (3 - 2 * a), sb = b * b * (3 - 2 * b), sc = c * c * (3 - 2 * c);
        t.rhX = k < 0.3 ? 1.05 * sa : k < 0.5 ? lerp(1.05, -1.6, sb) : lerp(-1.6, -0.15, sc);
        t.rkX = k < 0.3 ? 1.75 * sa : k < 0.5 ? lerp(1.75, 0.06, clamp((k - 0.3) / 0.15, 0, 1)) : lerp(0.06, 0.3, sc);
        t.rfX = 0.55 * sa; t.rfl = 0;
        t.lhX = -0.28 * sa; t.lkX = 0.32 + 0.18 * sb; t.lfl = 1;
        t.pRY = k < 0.5 ? lerp(0.25 * sa, -0.22, sb) : lerp(-0.22, 0, sc);
        t.sY = k < 0.5 ? lerp(0.45 * sa, -0.42, sb) : lerp(-0.42, -0.1, sc);
        t.sX = k < 0.5 ? lerp(-0.12 * sa, 0.24, sb) : lerp(0.24, 0.08, sc);
        t.lsZ = 0.4 + 0.75 * sa; t.lsX = -0.5 * sa + 0.3 * sb; t.leX = -0.5;
        t.rsZ = -0.3 - 0.45 * sa; t.rsX = lerp(0.55 * sa, -0.55, sb); t.reX = -0.6;
        t.pY = 0.92 + Math.sin(c * Math.PI) * 0.08;
        t.hX = 0.3; t.hY = -t.sY * 0.5;
        t.sq = k > 0.3 && k < 0.48 ? 0.04 : 0;
        expr = 2;
        break;
      }
      case 'bike': {
        // Bicycle kick hang (aiming): back to goal, body flat in the air and rolled side-on, kicking
        // leg extended straight up at the ball, the other leg tucked, arms flung out for balance
        rate = 16;
        const lean = Math.min(1, at / 0.16);
        const e = lean * lean * (3 - 2 * lean);
        const bob = Math.sin(at * 6) * 0.04;
        t.pRY = Math.PI;
        t.pX = -1.38 * e + bob; t.pZ = 0.42 * e; t.pY = 0.95 + 0.3 * e;
        t.rhX = -2.55 * e; t.rkX = 0.12 + (1 - e) * 0.8; t.rfX = 0.6; t.rfl = 0;
        t.lhX = -0.35 * e; t.lkX = 1.55 * e; t.lfX = 0.4; t.lfl = 0;
        t.lsZ = 1.25 * e; t.lsX = 0.55 * e; t.leX = -0.25;
        t.rsZ = -1.55 * e; t.rsX = -0.75 * e; t.reX = -0.35;
        t.sX = 0.28 * e; t.sZ = -0.15 * e; t.hX = 0.55 * e; t.hY = -0.25 * e;
        t.wf = -0.3;
        expr = 2;
        break;
      }
      case 'volley': {
        // Scissor: the kicking leg whips up and over through the ball while the other leg drops,
        // then the body tips back and down to land
        rate = 28;
        const a = Math.min(1, k / 0.22), b = clamp((k - 0.18) / 0.3, 0, 1), c = clamp((k - 0.62) / 0.38, 0, 1);
        const sa = a * a * (3 - 2 * a), sb = b * b * (3 - 2 * b), sc = c * c * (3 - 2 * c);
        const lean = sa * (1 - sc * 0.5);
        t.pRY = Math.PI * Math.min(1, k * 3.2);
        t.pX = -1.45 * lean; t.pZ = 0.4 * lean; t.pY = 0.95 + 0.32 * lean;
        // other leg leads up, then drops as the kicking leg scissors past it
        t.lhX = lerp(-1.6 * sa, 0.45, sb); t.lkX = lerp(0.9, 1.3, sb);
        t.rhX = lerp(0.3 * sa, -2.9, sb) * (1 - sc * 0.4); t.rkX = lerp(0.9 * sa, 0.05, sb); t.rfX = 0.6; t.rfl = 0; t.lfl = 0;
        t.lsZ = 0.3 + 1.0 * lean; t.lsX = 0.55 * lean; t.leX = -0.25;
        t.rsZ = -0.3 - 1.3 * lean; t.rsX = -0.7 * lean; t.reX = -0.35;
        t.sX = 0.28 * lean; t.sZ = -0.15 * lean; t.hX = 0.5 * lean;
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
      case 'jump': {
        // take-off reach, tuck at the top, legs extend again to land
        const h = Math.min(1, y / 1.4);
        t.lhX = -0.65 * h; t.rhX = -0.2 * h; t.lkX = 1.25 * h + 0.15; t.rkX = 0.75 * h + 0.2;
        t.lfX = 0.35 * h; t.rfX = 0.35 * h; t.lfl = 0.2; t.rfl = 0.2;
        t.lsZ = 0.7 + h * 0.8; t.rsZ = -0.7 - h * 0.8; t.lsX = -0.55; t.rsX = -0.55; t.leX = -0.5; t.reX = -0.5;
        t.sX = -0.1; t.hX = -0.25;
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
    if (lying) { t.lfl = 0; t.rfl = 0; }
    // Landing: knees absorb the impact, arms come out for balance
    if (this.landT > 0 && !air && !lying) {
      const q = this.landT / 0.3;
      t.lkX += 0.75 * q; t.rkX += 0.75 * q; t.lhX -= 0.38 * q; t.rhX -= 0.38 * q;
      t.pY -= 0.13 * q; t.sX += 0.22 * q; t.lsZ += 0.35 * q; t.rsZ -= 0.35 * q;
    }
    // Head (and a little of the chest) turn to follow the ball in open play
    if (Number.isFinite(st.look) && (anim === 'idle' || anim === 'jump') && !st.charging) {
      const lk = clamp(st.look, -1.4, 1.4);
      t.hY += lk * 0.62; t.sY += lk * 0.16;
    }
    if (anim !== 'punch') this.glove.visible = false;
    if (st.stun > 0 && anim !== 'frozen') expr = 3;

    // Damp toward target
    for (const key of J) this.pose[key] = damp(this.pose[key], t[key], rate, dt);
    this.spinY = spin;
    this.applyPose(this.pose);
    this.setExpression(expr);
    this.headRig.update(dt, Number.isFinite(st.look) ? st.look - this.pose.hY : 0);
    if (this.tail) {
      // the ponytail lags behind when running and bounces with the stride
      const runA = clamp(speed / 10, 0, 1.3);
      this.tailX = damp(this.tailX || 0, -0.55 * runA - (air ? 0.4 : 0) + Math.sin(this.phase * 2) * 0.12 * runA, 8, dt);
      this.tailZ = damp(this.tailZ || 0, clamp(this.turn * 0.06, -0.5, 0.5), 6, dt);
      this.tail.rotation.set(this.tailX, 0, this.tailZ);
    }
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
    const B = this.bones;
    B.pelvis.position.y = p.pY * PK;
    B.pelvis.rotation.set(p.pX, p.pRY + this.spinY, p.pZ, 'YXZ');
    // the spine bends over two bones, the head over neck + head
    B.spine.rotation.set(p.sX * 0.45, p.sY * 0.4, p.sZ * 0.5);
    B.chest.rotation.set(p.sX * 0.55 - p.br, p.sY * 0.6, p.sZ * 0.5);
    B.neck.rotation.set(p.hX * 0.4, p.hY * 0.45, p.hZ * 0.4);
    B.head.rotation.set(p.hX * 0.6, p.hY * 0.55, p.hZ * 0.6);
    const arm = (a, sX, sZ, eX, eZ, side) => {
      // the clavicle shrugs when the arm goes above the shoulder, so raised arms don't pinch
      const lift = Math.max(0, Math.abs(sZ) - 1.0) * 0.24 + Math.max(0, -sX - 1.6) * 0.1;
      a.clav.rotation.set(Math.min(0, sX) * 0.06, 0, Math.sign(sZ || side) * lift);
      a.sh.rotation.set(sX, 0, sZ - Math.sign(sZ || side) * lift);
      a.el.rotation.set(eX, 0, eZ);
      a.wr.rotation.set(eX * 0.12 + p.wf, 0, 0);
    };
    arm(this.armL, p.lsX, p.lsZ, p.leX, p.leZ, 1);
    arm(this.armR, p.rsX, p.rsZ, p.reX, p.reZ, -1);
    // feet: authored pitch plus automatic planting (keeps the sole level with the ground)
    const g = this.groundK ?? 1;
    const leg = (l, hX, hZ, kX, fX, fl) => {
      l.hip.rotation.set(hX, 0, hZ);
      l.knee.rotation.x = kX;
      l.foot.rotation.set(fX - fl * g * (p.pX + hX + kX), 0, -fl * g * (p.pZ + hZ) * 0.8);
    };
    leg(this.legL, p.lhX, p.lhZ, p.lkX, p.lfX, p.lfl);
    leg(this.legR, p.rhX, p.rhZ, p.rkX, p.rfX, p.rfl);
    const sq = p.sq;
    this.root.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5);
  }

  // World position of the right foot (for effects)
  footWorld(out) {
    return this.legR.foot.getWorldPosition(out);
  }

  handWorld(out) {
    return this.armR.wr.getWorldPosition(out);
  }

  headWorld(out) {
    return this.headM.getWorldPosition(out);
  }

  dispose() {
    this.root.removeFromParent();
    this.headRig.mouthTex.dispose();
  }
}
