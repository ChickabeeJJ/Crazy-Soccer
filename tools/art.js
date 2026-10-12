// Art studio: composes the CrazyGames cover images and preview videos with the real game renderer.
// Open via the Vite dev server: /tools/art.html?shot=cover-landscape  (driven by tools/make-art.mjs)
import '../src/ui/style.css';
import * as THREE from 'three';
import { GameRenderer } from '../src/render/renderer.js';
import { CharacterModel } from '../src/render/character.js';
import { TEAMS, PHYS, FIELD } from '../src/config.js';
import { glowTexture } from '../src/render/textures.js';
import { Video } from './art-video.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot') || 'cover-landscape';
const SIZES = {
  'cover-landscape': [1920, 1080],
  'cover-portrait': [800, 1200],
  'cover-square': [800, 800],
  'video-landscape': [1920, 1080],
  'video-portrait': [1080, 1620],
};
const [W, H] = SIZES[SHOT] || [1920, 1080];
const stage = document.getElementById('stage');
stage.style.width = `${W}px`;
stage.style.height = `${H}px`;

await document.fonts.load('400 40px "Lilita One"').catch(() => {});
await document.fonts.load('700 40px "Roboto Condensed"').catch(() => {});
await document.fonts.load('italic 900 40px "Roboto Condensed"').catch(() => {});

const canvas = document.getElementById('game');
const R = new GameRenderer(canvas, false);
R.resize();
const V = R.vfx;
// Cover scenes were composed for a goal line at x = 42; shift the arena so they line up with the current pitch.
if (SHOT.startsWith('cover')) R.stadium.root.position.x = 42 - FIELD.halfL;
const scene = R.scene;
const cam = R.cam;
const GLOW = glowTexture();

export const HERO = { skin: 1, hair: 'spiky', hairColor: 0, jersey: 'lightning', ball: 'classic', goalfx: 'confetti', number: 10 };
const C = (o) => ({ skin: 2, hair: 'bob', hairColor: 1, jersey: 'classic', ball: 'classic', goalfx: 'confetti', number: 7, ...o });

export function pose(cos, team, anim, animT, o = {}) {
  const m = new CharacterModel(cos, team, { outline: true, shadows: true });
  if (o.keeper) m.setAppearance(cos, team, true);
  scene.add(m.root);
  const st = { anim, animT, animDur: o.dur || 1, speed: o.speed || 0, sprinting: !!o.sprint, charging: !!o.charging, charge: o.charge || 0, hasBall: false, emote: o.emote, fx: { jet: o.jet ? 1 : 0 }, y: o.y || 0, id: o.id || 0, stun: o.stun || 0 };
  if (o.pre) for (let i = 0; i < 30; i++) m.update(0.05, { ...st, ...o.pre });
  for (let i = 0; i < 40; i++) m.update(0.05, st);
  m.root.position.set(o.x || 0, o.y || 0, o.z || 0);
  m.root.rotation.y = o.face || 0;
  if (o.scale) m.root.scale.setScalar(o.scale);
  // team ring
  if (!o.noRing) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.2, 40), new THREE.MeshBasicMaterial({ color: TEAMS[team].color, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(o.x || 0, 0.05, o.z || 0);
    scene.add(ring);
  }
  return m;
}

export function iceBlock(x, z) {
  const ice = new THREE.Mesh(new THREE.IcosahedronGeometry(1.75, 0), new THREE.MeshToonMaterial({ color: 0x9ff0ff, transparent: true, opacity: 0.55, emissive: 0x1a5a6a }));
  ice.scale.set(1, 1.35, 1);
  ice.position.set(x, 1.3, z);
  scene.add(ice);
  V.sparkles(x, 1.5, z, 0xaaf6ff, 30, 2);
  return ice;
}

export function itemBox(x, y, z, c = 0, rot = 0.5) {
  const m = new THREE.Mesh(R.boxGeo, new THREE.MeshBasicMaterial({ map: R.boxTex[c % 5] }));
  m.position.set(x, y, z);
  m.rotation.set(0.35, rot, 0.2);
  const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: ['#3fa9ff', '#ff4fa3', '#4cf08a', '#a46bff', '#ffc93f'][c % 5], transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  g.scale.set(3.6, 3.6, 1);
  m.add(g);
  scene.add(m);
  return m;
}

export function placeBall(x, y, z, skin = 'classic') {
  R.ball.setSkin(skin);
  R.ball.root.position.set(x, y, z);
  R.ball.mesh.rotation.set(0.4, 0.8, 0.2);
  R.ballShadow.position.set(x, 0.025, z);
  R.ballShadow.scale.setScalar(1 + y * 0.12);
  R.ballShadow.material.opacity = Math.max(0.08, 0.35 - y * 0.02);
}

// A blazing comet trail from p0 to p1 (ball at p1)
export function fireTrail(p0, p1, density = 1) {
  const n = Math.floor(220 * density);
  const tmp = new THREE.Color();
  const flame = [0xff3b1f, 0xff7a1a, 0xffb21f, 0xffe14a];
  for (let i = 0; i < 520 * density; i++) {
    const t = Math.pow(Math.random(), 0.55) * 0.9;
    const x = p0.x + (p1.x - p0.x) * t, y = p0.y + (p1.y - p0.y) * t, z = p0.z + (p1.z - p0.z) * t;
    const spread = 0.1 + t * 0.55;
    const c = flame[Math.min(3, Math.floor(t * 3.2 + Math.random() * 0.9))];
    V.solid.emit(x + (Math.random() - 0.5) * spread, y + (Math.random() - 0.5) * spread, z + (Math.random() - 0.5) * spread, 0, 0, 0, 1, 0.18 + t * 0.7, 0.18 + t * 0.7, new THREE.Color(c), 0, 0, 0.5 + t * 0.45);
  }
  for (let i = 0; i < n; i++) {
    const t = Math.pow(Math.random(), 0.7) * 0.92;
    const x = p0.x + (p1.x - p0.x) * t, y = p0.y + (p1.y - p0.y) * t, z = p0.z + (p1.z - p0.z) * t;
    const spread = 0.15 + t * 0.45;
    tmp.setHSL(0.015 + Math.random() * 0.1, 1, 0.42 + t * 0.12);
    V.glow.emit(x + (Math.random() - 0.5) * spread, y + (Math.random() - 0.5) * spread, z + (Math.random() - 0.5) * spread, 0, 0, 0, 1, 0.5 + t * 1.6, 0.5 + t * 1.6, tmp, 0, 0, 0.18 + t * 0.32);
  }
  // halo on the ball
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0xffa040, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.position.copy(p1);
  halo.scale.set(4.2, 4.2, 1);
  scene.add(halo);
}

export function speedLines(p0, dir, count = 14) {
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
  for (let i = 0; i < count; i++) {
    const len = 2 + Math.random() * 4;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.06), mat);
    m.position.set(p0.x + (Math.random() - 0.5) * 3 - dir.x * len, p0.y + (Math.random() - 0.5) * 2.5, p0.z + (Math.random() - 0.5) * 3 - dir.z * len);
    m.rotation.y = -Math.atan2(dir.z, dir.x);
    scene.add(m);
  }
}

// Game wordmark in the same angular style as the in-game menus
export function logo(opts) {
  const el = document.createElement('div');
  el.className = 'cover-logo';
  Object.assign(el.style, { left: `${opts.x}px`, fontSize: `${opts.size}px` }, opts.bottom != null ? { bottom: `${opts.bottom}px` } : { top: `${opts.y}px` });
  el.innerHTML = '<div class="lg-crazy">CRAZY</div><div class="lg-soccer">SOCCER</div><div class="lg-bars"><i class="r"></i><i class="b"></i></div>';
  stage.appendChild(el);
  return el;
}

// Cinematic dusk grade: deep navy sky with a burning horizon, warm low backlight, cool fill
export function grade(o = {}) {
  scene.traverse((ob) => {
    const u = ob.material && ob.material.uniforms;
    if (u && u.top && u.mid && u.bottom) { u.top.value.set('#060a20'); u.mid.value.set('#2a2160'); u.bottom.value.set('#ff7f45'); }
    if (ob.isSprite && ob.position.length() > 200) ob.visible = false;
  });
  scene.fog.color.set('#1b1640'); scene.fog.near = 70; scene.fog.far = 380;
  R.hemi.color.set('#8090e8'); R.hemi.groundColor.set('#3a2230'); R.hemi.intensity = 0.95;
  R.sun.color.set('#ffb36b'); R.sun.intensity = 3.1;
  R.sun.position.set(70, 26, o.sunZ ?? -20); R.sun.target.position.set(0, 0, 0);
  const fill = new THREE.DirectionalLight('#5c7cff', 1.25);
  fill.position.set(-40, 30, 60);
  scene.add(fill);
  // Floodlight flares on the light towers
  for (const [x, z] of [[-60, -38], [60, -38], [-60, 38], [60, 38], [0, -44]]) {
    const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: '#ffe9c4', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    f.position.set(x, 30, z);
    f.scale.set(7, 7, 1);
    scene.add(f);
  }
}

// Electric comet trail (Supercharge look) from p0 to the ball at p1
export function electricTrail(p0, p1, density = 1) {
  const tmp = new THREE.Color();
  for (let i = 0; i < 420 * density; i++) {
    const t = Math.pow(Math.random(), 0.6) * 0.95;
    const x = p0.x + (p1.x - p0.x) * t, y = p0.y + (p1.y - p0.y) * t, z = p0.z + (p1.z - p0.z) * t;
    const spread = 0.08 + t * 0.5;
    if (Math.random() < 0.2) tmp.setHSL(0.14, 1, 0.66); else tmp.setHSL(0.5 + Math.random() * 0.07, 1, 0.55 + t * 0.2);
    V.glow.emit(x + (Math.random() - 0.5) * spread, y + (Math.random() - 0.5) * spread, z + (Math.random() - 0.5) * spread, 0, 0, 0, 1, 0.3 + t * 1.3, 0.3 + t * 1.3, tmp, 0, 0, 0.22 + t * 0.4);
  }
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0x7ff0ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.position.copy(p1);
  halo.scale.set(4.6, 4.6, 1);
  scene.add(halo);
}

// Bazooka hit: fireball, shock ring, smoke
export function explosion(x, y, z, size = 1) {
  const fb = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0xff8a2a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  fb.position.set(x, y + 1.2 * size, z);
  fb.scale.set(9 * size, 9 * size, 1);
  scene.add(fb);
  const core = fb.clone();
  core.material = fb.material.clone(); core.material.color.set(0xfff2c0);
  core.scale.set(4 * size, 4 * size, 1);
  scene.add(core);
  const tmp = new THREE.Color();
  for (let i = 0; i < 260 * size; i++) {
    const a = Math.random() * Math.PI * 2, u = Math.random(), r = Math.pow(Math.random(), 0.5) * 2.6 * size;
    tmp.setHSL(0.02 + Math.random() * 0.1, 1, 0.5 + Math.random() * 0.2);
    V.glow.emit(x + Math.cos(a) * r, y + u * 3 * size, z + Math.sin(a) * r, 0, 0, 0, 1, 0.6 + Math.random() * 1.4, 0.6, tmp, 0, 0, 0.5);
  }
  for (let i = 0; i < 26 * size; i++) {
    const a = Math.random() * Math.PI * 2, r = 1.5 + Math.random() * 3 * size;
    V.solid.emit(x + Math.cos(a) * r, 3 * size + Math.random() * 3.5 * size, z + Math.sin(a) * r, 0, 0, 0, 1, 0.9 + Math.random() * 1.2, 0.9, new THREE.Color(0x5a4a6a), 0, 0, 0.28);
  }
  V.ring(x, 0.15, z, 0xffb347, 0.5, 5 * size, 10, 0.9);
}

function setCam(px, py, pz, lx, ly, lz, fov = 55) {
  cam.position.set(px, py, pz);
  cam.fov = fov;
  cam.updateProjectionMatrix();
  cam.lookAt(lx, ly, lz);
}

function settle(steps = 1, dt = 0.016) {
  for (let i = 0; i < steps; i++) { V.update(dt); R.stadium.update(dt); }
}

// ------------------------------------------------------------------ covers
// The hero hangs in the air mid bicycle kick; the ball rips towards the goal (+x, line at x = 42).
function bicycleScene(o = {}) {
  const hx = o.hx ?? 29, hz = o.hz ?? -1.5, hy = 1.5;
  const hero = pose(HERO, 0, 'volley', o.animT ?? 0.21, { x: 0, y: 0, z: 0, face: Math.PI / 2, dur: 0.5, noRing: true });
  // Tip the whole body over so the head drops and the legs scissor overhead (classic bicycle-kick silhouette)
  const tilt = new THREE.Group();
  scene.add(tilt);
  tilt.add(hero.root);
  tilt.position.set(hx, hy + 0.4, hz);
  tilt.rotation.z = o.tilt ?? -0.75;
  tilt.updateMatrixWorld(true);
  const foot = new THREE.Vector3();
  hero.footWorld(foot);
  const ballP = o.ballP || new THREE.Vector3(hx + 6.5, 3.6, hz + 0.6);
  placeBall(ballP.x, ballP.y, ballP.z);
  electricTrail(foot, ballP, 1);
  V.sparkles(foot.x, foot.y, foot.z, 0x9ff6ff, 40, 7);
  // keeper at full stretch
  pose(C({ skin: 3, hair: 'cap', hairColor: 5, number: 1 }), 1, 'dive', 0.32, { x: 40.8, y: 1.7, z: hz - 0.6, face: -1.3, dur: 0.62, keeper: true, noRing: true });
  // defender too late, sliding underneath
  pose(C({ skin: 1, hair: 'beanie', hairColor: 3, number: 4 }), 1, 'slide', 0.25, { x: hx + 6.2, z: hz - 5, face: -Math.PI / 2 + 0.5, dur: 0.55, noRing: true });
  for (let i = 0; i < 10; i++) V.dust(hx + 6.6 + i * 0.35, hz - 5.2 - i * 0.15, 2, 0x8a9a78);
  // bazooka blast throwing two players in the background
  explosion(hx + 1, 0, hz - 15, 1.1);
  const f1 = pose(C({ skin: 5, hair: 'mohawk', hairColor: 7, number: 3 }), 1, 'fall', 0.18, { x: hx - 2, y: 3.4, z: hz - 13, face: 0.6, noRing: true });
  f1.root.rotation.z = 0.9;
  const f2 = pose(C({ skin: 0, hair: 'afro', hairColor: 6, number: 9 }), 0, 'fall', 0.3, { x: hx + 4.5, y: 2.6, z: hz - 16, face: -2.2, noRing: true });
  f2.root.rotation.x = -0.8;
  // teammate sprinting in
  pose(C({ skin: 2, hair: 'buns', hairColor: 2, jersey: 'lightning', number: 8 }), 0, 'idle', 0, { x: hx - 7, z: hz + 5, face: Math.PI / 2 - 0.2, speed: 14, sprint: true, pre: { speed: 14, sprinting: true }, noRing: true });
  itemBox(hx + 9, 3.1, hz - 6, 3, 0.4);
  return { hero, ballP, foot };
}

function coverLandscape() {
  R.setVariant('grass');
  grade();
  bicycleScene();
  settle(2);
  setCam(31.2, 0.9, 8.4, 32.6, 3.0, -2.0, 52);
  logo({ x: 84, bottom: 70, size: 150 });
}

function coverPortrait() {
  R.setVariant('grass');
  grade({ sunZ: 10 });
  bicycleScene({ ballP: new THREE.Vector3(33.6, 6.4, -1.4) });
  settle(2);
  setCam(30.4, 0.7, 5.4, 31.6, 4.1, -2.0, 74);
  logo({ x: 52, bottom: 56, size: 112 });
}

function coverSquare() {
  R.setVariant('grass');
  grade();
  bicycleScene();
  settle(2);
  setCam(31.0, 0.8, 7.0, 32.4, 3.2, -2.0, 62);
  logo({ x: 44, bottom: 40, size: 96 });
}

window.__ready = false;
if (SHOT === 'cover-landscape') coverLandscape();
else if (SHOT === 'cover-portrait') coverPortrait();
else if (SHOT === 'cover-square') coverSquare();
else {
  window.__video = new Video(R, { W, H, portrait: SHOT === 'video-portrait', helpers: { pose, iceBlock, itemBox, placeBall, fireTrail, electricTrail, explosion, grade, logo, HERO, C } });
}
R.render();
window.__render = () => R.render();
window.__ready = true;
window.__setCam = (px, py, pz, lx, ly, lz, fov) => { setCam(px, py, pz, lx, ly, lz, fov); R.render(); };
window.__logo = (x, y, size) => { document.querySelectorAll('.cover-logo').forEach((e) => e.remove()); logo({ x, y, size }); };
