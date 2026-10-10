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

const canvas = document.getElementById('game');
const R = new GameRenderer(canvas, false);
R.resize();
const V = R.vfx;
const scene = R.scene;
const cam = R.cam;
const GLOW = glowTexture();

export const HERO = { skin: 1, hair: 'spiky', hairColor: 0, jersey: 'lightning', ball: 'classic', goalfx: 'confetti', number: 10 };
const C = (o) => ({ skin: 2, hair: 'bob', hairColor: 1, jersey: 'classic', ball: 'classic', goalfx: 'confetti', number: 7, ...o });

export function pose(cos, team, anim, animT, o = {}) {
  const m = new CharacterModel(cos, team, { outline: true, shadows: true });
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

export function logo(opts) {
  const el = document.createElement('div');
  el.className = 'cover-logo';
  Object.assign(el.style, { left: `${opts.x}px`, top: `${opts.y}px` });
  const size = opts.size;
  el.innerHTML = `<div class="burst" style="width:${size * 3.2}px;height:${size * 3.2}px;left:${-size * 0.55}px;top:${-size * 0.9}px;opacity:${opts.burst ?? 0.9}"></div>
    <div class="w w1" style="font-size:${size}px;-webkit-text-stroke:${size * 0.085}px #1b1530">CRAZY</div>
    <div class="w w2" style="font-size:${size}px;-webkit-text-stroke:${size * 0.085}px #1b1530;margin-left:${size * 0.42}px;margin-top:${size * 0.02}px">SOCCER</div>`;
  stage.appendChild(el);
  return el;
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
function heroKickScene(o = {}) {
  // Hero mid-air blasting a fire shot at the blue goal (+x). Camera sits on the +z flank.
  const face = Math.PI / 2 - 0.55;
  const hero = pose(HERO, 0, 'kick', 0.37, { x: 25, y: 0.6, z: -4.5, face, id: 0 });
  for (let i = 0; i < 22; i++) V.fireAura(25 + (Math.random() - 0.5) * 0.6, 0.1, -4.5 + (Math.random() - 0.5) * 0.6);
  const foot = new THREE.Vector3();
  hero.footWorld(foot);
  const ballP = o.ballP || new THREE.Vector3(32.2, 2.7, -3.4);
  placeBall(ballP.x, ballP.y, ballP.z);
  fireTrail(foot, ballP, 1.0);
  V.kick(foot.x, foot.y, foot.z, 1, 0xff8a1f);
  // keeper diving across the goal mouth
  pose(C({ skin: 3, hair: 'cap', hairColor: 5, number: 1 }), 1, 'dive', 0.3, { x: 39.6, y: 1.8, z: -2.6, face: -1.0, dur: 0.62 });
  // frozen rival
  pose(C({ skin: 4, hair: 'afro', hairColor: 6, number: 5 }), 1, 'idle', 0, { x: 34.5, z: -10.5, face: -Math.PI / 2 + 0.6, speed: 12, sprint: true, pre: { speed: 12, sprinting: true } });
  iceBlock(34.5, -10.5);
  // rival sliding in, a bit too late
  pose(C({ skin: 1, hair: 'beanie', hairColor: 3, number: 4 }), 1, 'slide', 0.25, { x: 29.2, z: -8.6, face: -Math.PI / 2 - 0.5, dur: 0.55 });
  for (let i = 0; i < 8; i++) V.dust(29.6 + i * 0.4, -8.4 - i * 0.2, 2);
  // rival slipping on an oil trail in the background
  const slip = pose(C({ skin: 0, hair: 'mohawk', hairColor: 4, number: 9 }), 1, 'slip', 0.12, { x: 26, z: -17, face: Math.PI / 2 + 0.3 });
  slip.root.position.y = 0.4;
  for (let i = 0; i < 7; i++) {
    const m = new THREE.Mesh(R.discGeo, R.oilMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(22.5 + i * 1.0, 0.03, -17.3 + Math.sin(i) * 0.4);
    m.scale.setScalar(1.3);
    scene.add(m);
  }
  // teammate cheering
  pose(C({ skin: 2, hair: 'buns', hairColor: 2, jersey: 'lightning', number: 8 }), 0, 'cheer', 0.25, { x: 16, z: -9, face: Math.PI / 2 + 0.9 });
  itemBox(30.5, 3.4, -13.5, 1, 0.6);
  itemBox(20.5, 2.8, -8.5, 4, -0.3);
  return { hero, ballP };
}

function coverLandscape() {
  R.setVariant('grass');
  heroKickScene();
  settle(2);
  setCam(24.8, 1.35, 6.4, 31.0, 2.7, -4.4, 52);
  logo({ x: 70, y: 46, size: 128 });
}

function coverPortrait() {
  R.setVariant('grass');
  heroKickScene({ ballP: new THREE.Vector3(31.6, 5.0, -4.6) });
  // Jetpack defender flying in to block the shot
  const jet = pose(C({ skin: 5, hair: 'mohawk', hairColor: 7, number: 3 }), 1, 'idle', 0, { x: 33.6, y: 5.6, z: -8.2, face: -Math.PI / 2 - 0.9, jet: true, noRing: true });
  const back = new THREE.Vector3(33.6 + Math.sin(-Math.PI / 2 - 0.9) * -0.45, 6.4, -8.2 + Math.cos(-Math.PI / 2 - 0.9) * -0.45);
  for (let i = 0; i < 40; i++) V.jetFlame(back.x + (Math.random() - 0.5) * 0.3, back.y - Math.random() * 1.2, back.z + (Math.random() - 0.5) * 0.3);
  jet.root.rotation.z = 0.25;
  settle(2);
  setCam(31.6, 0.8, 4.4, 29.1, 3.9, -4.6, 82);
  logo({ x: 64, y: 54, size: 104 });
}

function coverSquare() {
  R.setVariant('grass');
  heroKickScene();
  settle(2);
  setCam(30.8, 0.9, 2.8, 29.6, 2.9, -4.0, 74);
  logo({ x: 40, y: 34, size: 88 });
}

window.__ready = false;
if (SHOT === 'cover-landscape') coverLandscape();
else if (SHOT === 'cover-portrait') coverPortrait();
else if (SHOT === 'cover-square') coverSquare();
else {
  window.__video = new Video(R, { W, H, portrait: SHOT === 'video-portrait', helpers: { pose, iceBlock, itemBox, placeBall, fireTrail, logo, HERO, C } });
}
R.render();
window.__render = () => R.render();
window.__ready = true;
window.__setCam = (px, py, pz, lx, ly, lz, fov) => { setCam(px, py, pz, lx, ly, lz, fov); R.render(); };
window.__logo = (x, y, size) => { document.querySelectorAll('.cover-logo').forEach((e) => e.remove()); logo({ x, y, size }); };
