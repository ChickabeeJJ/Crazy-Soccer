// Post-match award stage: the standout players line up on a lit podium in the stadium,
// each award is revealed in turn and the MVP goes last
import * as THREE from 'three';
import { CharacterModel } from './character.js';
import { TEAMS } from '../config.js';
import { clamp, damp } from '../util/math.js';

export const AWARDS = [
  { key: 'mvp', title: 'MVP', unit: 'PTS', val: (r) => r.points || 0 },
  { key: 'scorer', title: 'TOP SCORER', unit: 'GOALS', val: (r) => r.goals || 0 },
  { key: 'playmaker', title: 'PLAYMAKER', unit: 'ASSISTS', val: (r) => r.assists || 0 },
  { key: 'wall', title: 'THE WALL', unit: 'SAVES', val: (r) => r.saves || 0 },
  { key: 'enforcer', title: 'ENFORCER', unit: 'STEALS', val: (r) => r.steals || 0 },
  { key: 'menace', title: 'MENACE', unit: 'HITS', val: (r) => r.hits || 0 },
  { key: 'gunner', title: 'SHARPSHOOTER', unit: 'SHOTS', val: (r) => r.shots || 0 },
];

const ICON = {
  mvp: '<path d="M4 8l4 3 4-6 4 6 4-3-2 10H6z" fill="currentColor" fill-opacity=".18" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M6 21h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  scorer: '<circle cx="12" cy="12" r="8.5" fill="currentColor" fill-opacity=".14" stroke="currentColor" stroke-width="1.8"/><path d="M12 7.5l3.6 2.6-1.4 4.3H9.8l-1.4-4.3z" fill="currentColor"/><path d="M12 7.5V3.6M15.6 10.1l3.7-1.2M14.2 14.4l2.3 3.2M9.8 14.4l-2.3 3.2M8.4 10.1L4.7 8.9" stroke="currentColor" stroke-width="1.5"/>',
  playmaker: '<path d="M3 17c4-9 10-11 17-10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-dasharray="2.6 2.4" stroke-linecap="round"/><path d="M16 4l4.5 3-3.6 3.9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="5" cy="18" r="2.4" fill="currentColor"/>',
  wall: '<path d="M4 6h16v13H4z" fill="currentColor" fill-opacity=".14" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M4 10.3h16M4 14.6h16M10 6v4.3M15 10.3v4.3M8 14.6V19M15 14.6V19" stroke="currentColor" stroke-width="1.5"/>',
  enforcer: '<path d="M3 18l7-3 3 3 8-11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 4l7 3-3 7" fill="currentColor" fill-opacity=".18" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  menace: '<path d="M13 2L5 13h6l-2 9 9-12h-6z" fill="currentColor" fill-opacity=".2" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  gunner: '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3" fill="currentColor"/><path d="M12 1.5v5M12 17.5v5M1.5 12h5M17.5 12h5" stroke="currentColor" stroke-width="1.8"/>',
};
const ACCENT = { mvp: '#ffcf3f', scorer: '#ff6a3d', playmaker: '#2fe39b', wall: '#7ab8ff', enforcer: '#c27bff', menace: '#ff3b8a', gunner: '#ffe27a' };

// rows: end-of-match stats table; returns [{ row, awards }] with the MVP first (max five players)
export function pickAwards(rows, mvpId) {
  const out = [];
  const byId = new Map();
  if (!rows || !rows.length) return out;
  const ranked = (f) => [...rows].sort((a, b) => f(b) - f(a) || (b.points || 0) - (a.points || 0) || a.id - b.id);
  for (const a of AWARDS) {
    let best = a.key === 'mvp' ? rows.find((r) => r.id === mvpId) || ranked(a.val)[0] : ranked(a.val)[0];
    if (!best || (a.key !== 'mvp' && a.val(best) <= 0)) continue;
    let e = byId.get(best.id);
    if (!e) {
      if (byId.size >= 5) continue;
      e = { row: best, awards: [] };
      byId.set(best.id, e);
      out.push(e);
    }
    e.awards.push({ key: a.key, title: a.title, value: a.val(best), unit: a.unit });
  }
  // Order the supporting cast by points so the higher risers go to the better players
  const rest = out.slice(1).sort((a, b) => (b.row.points || 0) - (a.row.points || 0));
  return [out[0], ...rest];
}

const SLOT_X = [0, -3.7, 3.7, -7.4, 7.4];
const SLOT_H = [1.55, 1.05, 0.9, 0.62, 0.5];
const EMOTES = ['flex', 'clap', 'dance', 'wave'];

export class AwardStage {
  constructor(renderer) {
    this.r = renderer;
    this.active = false;
    this.group = null;
    this.entries = [];
    this.el = null;
    this.v = new THREE.Vector3();
  }

  build() {
    const g = new THREE.Group();
    const ink = new THREE.MeshToonMaterial({ color: 0x2a2148 });
    const ink2 = new THREE.MeshToonMaterial({ color: 0x2e2550 });
    const gold = new THREE.MeshBasicMaterial({ color: 0xffcf3f });
    // Base: wide angular deck with a glowing gold lip
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(11.5, 12.2, 0.32, 8), ink);
    deck.rotation.y = Math.PI / 8;
    deck.position.y = 0.16;
    deck.receiveShadow = true;
    const lip = new THREE.Mesh(new THREE.CylinderGeometry(12.25, 12.25, 0.08, 8, 1, true), gold);
    lip.rotation.y = Math.PI / 8;
    lip.position.y = 0.3;
    // Fan of light stripes on the deck
    const fan = new THREE.Mesh(new THREE.CircleGeometry(11.4, 8), new THREE.MeshBasicMaterial({ map: deckTexture(), transparent: true, depthWrite: false }));
    fan.rotation.x = -Math.PI / 2;
    fan.rotation.z = Math.PI / 8;
    fan.position.y = 0.33;
    // Key light from the front so faces aren't lost against an evening sky
    const key = new THREE.DirectionalLight(0xfff3e0, 1.25);
    key.position.set(2, 9, 16);
    key.target.position.set(0, 2, 0);
    g.add(deck, lip, fan, key, key.target);
    // Backdrop: staggered angular panels with light strips, and the big title board
    for (let i = -3; i <= 3; i++) {
      const h = 7.5 - Math.abs(i) * 1.3;
      const p = new THREE.Mesh(new THREE.BoxGeometry(3.3, h, 0.5), i % 2 ? ink2 : ink);
      p.position.set(i * 3.35, h / 2, -4.6 - Math.abs(i) * 0.55);
      p.rotation.y = -i * 0.09;
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.12, h * 0.8, 0.06), new THREE.MeshBasicMaterial({ color: i < 0 ? TEAMS[0].color : i > 0 ? TEAMS[1].color : 0xffcf3f }));
      strip.position.set(i < 0 ? 1.4 : -1.4, 0, 0.28);
      p.add(strip);
      g.add(p);
    }
    this.boardCanvas = document.createElement('canvas');
    this.boardCanvas.width = 1024; this.boardCanvas.height = 256;
    this.boardTex = new THREE.CanvasTexture(this.boardCanvas);
    this.boardTex.colorSpace = THREE.SRGBColorSpace;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.5), new THREE.MeshBasicMaterial({ map: this.boardTex, transparent: true }));
    board.position.set(0, 9.2, -4.3);
    g.add(board);
    this.board = board;
    // Risers, beams and floor glows (one per slot)
    this.slots = SLOT_X.map((x, i) => {
      const h = SLOT_H[i];
      const riser = new THREE.Mesh(new THREE.BoxGeometry(2.9, h, 2.7), i === 0 ? ink2 : ink);
      riser.position.set(x, 0.32 + h / 2, 0);
      riser.castShadow = true; riser.receiveShadow = true;
      const trimMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const trim = new THREE.Mesh(new THREE.BoxGeometry(2.96, 0.1, 2.76), trimMat);
      trim.position.set(x, 0.32 + h - 0.05, 0);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.08), trimMat);
      face.position.set(x, 0.32 + h * 0.3, 1.36);
      const beamMat = new THREE.MeshBasicMaterial({ map: beamTexture(), color: 0xfff1c8, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 1.9, 16, 24, 1, true), beamMat);
      beam.position.set(x, 0.32 + h + 8, 0);
      const glowMat = new THREE.MeshBasicMaterial({ map: this.r.glowTex, color: 0xffe9a8, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2), glowMat);
      glow.rotation.x = -Math.PI / 2;
      glow.position.set(x, 0.33 + h + 0.02, 0);
      g.add(riser, trim, face, beam, glow);
      return { x, top: 0.32 + h, riser, trimMat, beam, glow };
    });
    g.visible = false;
    this.r.scene.add(g);
    this.group = g;
  }

  // entries: [{ id, name, team, cos, awards }] (MVP first); hooks: { onReveal(i, mvp), onDone() }
  start(entries, hooks = {}) {
    this.stop();
    if (!this.group) this.build();
    this.hooks = hooks;
    drawBoard(this.boardCanvas, hooks.score || [0, 0]);
    this.boardTex.needsUpdate = true;
    this.active = true;
    this.t = 0;
    this.t0 = performance.now();
    this.done = false;
    this.group.visible = true;
    this.r.setWorldVisible(false);
    const q = this.r.quality;
    this.entries = entries.slice(0, 5).map((e, i) => {
      const s = this.slots[i];
      const model = new CharacterModel(e.cos, e.team, { outline: q.outline, shadows: q.shadows });
      model.root.position.set(s.x, s.top, 0);
      model.root.rotation.y = i === 0 ? 0 : -s.x * 0.035;
      this.r.scene.add(model.root);
      s.trimMat.color.set(i === 0 ? 0xffcf3f : TEAMS[e.team].color);
      s.riser.visible = true;
      return { ...e, i, slot: s, model, revealed: false, revealAt: 0, at: 0 };
    });
    for (let i = this.entries.length; i < this.slots.length; i++) {
      const s = this.slots[i];
      s.riser.visible = i < 3; // always keep a three-step podium
      s.trimMat.color.set(0x3a3060);
      s.beam.material.opacity = 0; s.glow.material.opacity = 0;
    }
    // Reveal from the lowest step up, then a pause before the MVP
    const order = this.entries.slice(1).reverse();
    order.forEach((e, k) => { e.revealAt = 1.1 + k * 0.75; });
    if (this.entries[0]) this.entries[0].revealAt = 1.1 + order.length * 0.75 + 0.6;
    this.endAt = (this.entries[0] ? this.entries[0].revealAt : 1) + 4.2;
    for (const s of this.slots) { s.beam.material.opacity = 0; s.glow.material.opacity = 0; }
    this.buildHtml();
    const rig = this.r.rig;
    rig.mode = 'stage';
    rig.setLensShift(false);
    this.camZ = 0;
  }

  buildHtml() {
    if (this.el) this.el.remove();
    const el = document.createElement('div');
    el.className = 'aw-stage';
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    el.innerHTML = `<div class="aw-head"><span>MATCH AWARDS</span></div>${this.entries.map((e) => `
      <div class="aw-card${e.i === 0 ? ' mvp' : ''}" style="--team:${TEAMS[e.team].css}">
        ${e.awards.map((a) => `<div class="aw-badge" style="--acc:${ACCENT[a.key]}"><svg viewBox="0 0 24 24">${ICON[a.key]}</svg><div><b>${a.title}</b><em>${a.value} ${a.unit}</em></div></div>`).join('')}
        <div class="aw-name"><i></i>${esc(e.name)}</div>
      </div>`).join('')}
      <button class="btn btn-play aw-next">CONTINUE</button>`;
    el.querySelector('.aw-next').addEventListener('click', () => this.finish());
    document.body.appendChild(el);
    this.el = el;
    this.cards = [...el.querySelectorAll('.aw-card')];
    requestAnimationFrame(() => el.classList.add('in'));
  }

  finish() {
    if (this.done) return;
    this.done = true;
    for (const e of this.entries) if (!e.revealed) this.reveal(e, true);
    if (this.el) this.el.classList.add('out');
    if (this.hooks.onDone) this.hooks.onDone();
  }

  reveal(e, quiet = false) {
    e.revealed = true;
    e.at = 0;
    const card = this.cards[e.i];
    if (card) card.classList.add('show');
    if (quiet) return;
    const v = this.r.vfx;
    const s = e.slot;
    v.sparkles(s.x, s.top + 1.5, 0, e.i === 0 ? 0xffcf3f : TEAMS[e.team].color, 40, 7);
    v.ring(s.x, s.top + 0.05, 0, 0xffffff, 0.4, 2.6, 0.5);
    if (e.i === 0) { this.cannons(); v.fireworks(0, s.top + 4, -6); this.r.rig.shake(0.25); }
    if (this.hooks.onReveal) this.hooks.onReveal(e.i, e.i === 0);
  }

  // Confetti cannons at both ends of the stage, firing inwards over the podium
  cannons() {
    const v = this.r.vfx;
    const cols = [0xff3b5c, 0x3b8bff, 0xffcf3f, 0xfbf6ec, 0x2fe39b];
    const col = new THREE.Color();
    for (let i = 0; i < v.n(180); i++) {
      const side = i % 2 ? 1 : -1;
      col.setHex(cols[i % cols.length]);
      v.solid.emit(side * 9, 0.8, -1.5, -side * (2 + Math.random() * 6), 11 + Math.random() * 9, -1 + Math.random() * 2, 2.2 + Math.random(), 0.2, 0.14, col.clone(), 8, 1.3);
    }
  }

  // The ceremony runs on the wall clock, so a low frame rate never drags it out
  update(dt) {
    if (!this.active) return;
    this.t = (performance.now() - this.t0) / 1000;
    const t = this.t;
    for (const e of this.entries) {
      if (!e.revealed && t >= e.revealAt) this.reveal(e);
      e.at += dt;
      let st = { anim: 'idle', speed: 0 };
      if (e.revealed) st = e.i === 0 ? { anim: 'celebrate', animT: e.at, id: 0 } : e.at < 1.6 ? { anim: 'cheer', animT: e.at } : { anim: 'emote', animT: e.at - 1.6, emote: EMOTES[(e.i + (e.id || 0)) % EMOTES.length] };
      e.model.update(dt, st);
      const s = e.slot;
      const on = e.revealed ? 1 : 0;
      s.beam.material.opacity = damp(s.beam.material.opacity, on * (e.i === 0 ? 0.55 : 0.38), 6, dt);
      s.glow.material.opacity = damp(s.glow.material.opacity, on * 0.9, 6, dt);
    }
    if (!this.done && t >= this.endAt) this.finish();
    // Camera: a slow push-in, then a gentle drift; backs off on narrow screens so everyone fits
    const cam = this.r.cam;
    const aspect = cam.aspect || 1.6;
    const n = Math.max(3, this.entries.length);
    const span = n > 3 ? 27 : 17;
    const near = clamp(span / (1.4 * aspect), 8.5, 34);
    const k = 1 - Math.pow(1 - clamp(t / 3.2, 0, 1), 3);
    const dist = near + (1 - k) * 12;
    const sway = Math.sin(t * 0.32) * 0.09;
    cam.position.set(Math.sin(sway) * dist, 1.9 + (1 - k) * 3.2 + dist * 0.05, Math.cos(sway) * dist);
    cam.lookAt(0, 3.1 + dist * 0.02, 0);
    this.r.rig.applyShake(dt);
    this.board.material.opacity = clamp(t * 1.5, 0, 1);
    this.r.stadium.update(dt, cam.position);
    this.r.vfx.update(dt);
    this.placeCards();
  }

  placeCards() {
    if (!this.el) return;
    const w = window.innerWidth, h = window.innerHeight;
    for (const e of this.entries) {
      const card = this.cards[e.i];
      if (!card) continue;
      this.v.set(e.slot.x, e.slot.top - 0.15, 1.4).project(this.r.cam);
      card.style.left = `${((this.v.x + 1) / 2) * w}px`;
      card.style.top = `${((1 - this.v.y) / 2) * h}px`;
    }
  }

  hideCards() { if (this.el) this.el.classList.add('out'); }

  stop() {
    if (!this.active && !this.el) return;
    this.active = false;
    for (const e of this.entries) e.model.dispose();
    this.entries = [];
    if (this.el) { this.el.remove(); this.el = null; }
    if (this.group) this.group.visible = false;
    document.body.classList.remove('awards');
    this.r.setWorldVisible(true);
  }
}

// Scoreboard over the stage: red score, dash, blue score
function drawBoard(c, score) {
  const g = c.getContext('2d');
  g.clearRect(0, 0, 1024, 256);
  g.fillStyle = '#1b1530';
  g.beginPath(); g.moveTo(60, 20); g.lineTo(1000, 20); g.lineTo(964, 236); g.lineTo(24, 236); g.closePath(); g.fill();
  g.fillStyle = '#ff3b5c'; g.beginPath(); g.moveTo(24, 236); g.lineTo(60, 20); g.lineTo(110, 20); g.lineTo(74, 236); g.fill();
  g.fillStyle = '#3b8bff'; g.beginPath(); g.moveTo(964, 236); g.lineTo(1000, 20); g.lineTo(950, 20); g.lineTo(914, 236); g.fill();
  g.fillStyle = '#ffcf3f'; g.fillRect(140, 214, 744, 6);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = "150px 'Lilita One', 'Arial Black', sans-serif";
  g.fillStyle = '#ff3b5c'; g.fillText(String(score[0]), 330, 124);
  g.fillStyle = '#3b8bff'; g.fillText(String(score[1]), 694, 124);
  g.fillStyle = '#fbf6ec'; g.fillRect(470, 112, 84, 20);
  g.font = "bold 34px 'Roboto Condensed', 'Arial Narrow', sans-serif";
  g.fillStyle = 'rgba(251,246,236,0.7)'; g.fillText('FULL TIME', 512, 62);
}

function deckTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.translate(256, 256);
  for (let i = 0; i < 24; i++) {
    g.rotate(Math.PI / 12);
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, 'rgba(255,207,63,0.0)');
    gr.addColorStop(0.5, i % 2 ? 'rgba(255,207,63,0.10)' : 'rgba(255,255,255,0.05)');
    gr.addColorStop(1, 'rgba(255,207,63,0.0)');
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(-22, 256); g.lineTo(22, 256); g.closePath(); g.fill();
  }
  g.strokeStyle = 'rgba(255,207,63,0.35)'; g.lineWidth = 3;
  g.beginPath(); g.arc(0, 0, 200, 0, Math.PI * 2); g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function beamTexture() {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, 'rgba(255,255,255,0.85)');
  gr.addColorStop(0.6, 'rgba(255,255,255,0.4)');
  gr.addColorStop(1, 'rgba(255,255,255,0.12)');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 128);
  return new THREE.CanvasTexture(c);
}
