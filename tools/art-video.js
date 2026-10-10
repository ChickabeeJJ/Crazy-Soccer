// Preview-video director: scripted plays on top of the real simulation + renderer.
// Rendered deterministically frame by frame (tools/make-art.mjs captures each frame).
import * as THREE from 'three';
import { World } from '../src/sim/world.js';
import { setAnim, stunPlayer } from '../src/sim/player.js';
import { TEAMS, FIELD, PHYS } from '../src/config.js';
import { randomCosmetics } from '../src/cosmetics.js';
import { fmtTime } from '../src/util/math.js';

const FPS = 30;
const DURATION = 18;
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Video {
  constructor(R, opts) {
    // Deterministic randomness for particles & bots
    Math.random = seededRandom(1234);
    this.R = R;
    this.opts = opts;
    this.portrait = opts.portrait;
    this.t = 0;
    this.frameNo = 0;
    this.totalFrames = DURATION * FPS;
    this.R.showNames = false;
    this.cam = R.cam;
    this.camPos = new THREE.Vector3();
    this.camLook = new THREE.Vector3();
    this.camInit = false;
    this.buildHud();
    this.setupWorld();
    this.cues = this.buildCues();
    window.__frames = this.totalFrames;
    window.__step = () => this.step();
  }

  // ------------------------------------------------------------------ world
  setupWorld() {
    const w = new World({ mode: 'match', map: 'grass', replays: false, duration: 360 });
    this.w = w;
    const H = this.opts.helpers.HERO;
    const mk = (id, team, name, cos, isBot = false) => w.addPlayer({ id, name, team, isBot, cos: cos || randomCosmetics() });
    this.hero = mk(1, 0, 'You', H);
    this.r2 = mk(2, 0, 'Kiwi', { skin: 2, hair: 'buns', hairColor: 2, jersey: 'lightning', number: 8 });
    this.r3 = mk(3, 0, 'Zap', { skin: 4, hair: 'afro', hairColor: 8, jersey: 'lightning', number: 11 });
    this.r4 = mk(4, 0, 'Juno', { skin: 0, hair: 'cap', hairColor: 3, jersey: 'lightning', number: 2 }, true);
    this.gk = mk(10, 1, 'Wall', { skin: 3, hair: 'cap', hairColor: 5, jersey: 'classic', number: 1 });
    this.d1 = mk(11, 1, 'Bolt', { skin: 1, hair: 'beanie', hairColor: 3, jersey: 'stripes', number: 4 });
    this.d2 = mk(12, 1, 'Momo', { skin: 5, hair: 'mohawk', hairColor: 4, jersey: 'stripes', number: 9 });
    this.d3 = mk(13, 1, 'Taco', { skin: 2, hair: 'spiky', hairColor: 6, jersey: 'stripes', number: 5 });
    [this.hero, this.r2, this.r3, this.r4].forEach((p, i) => { p.slot = i; });
    [this.d1, this.d2, this.d3, this.gk].forEach((p, i) => { p.slot = i; });
    w.resetKickoff(0);
    w.phase = 'play';
    w.phaseT = 0;
    w.clock = 263;
    w.nextItemT = 999;
    this.events = [];
    this.fakeSession = { localId: 1, playerById: (id) => w.byId.get(id) };
    this.R.setVariant('grass');
    this.R.ball.setSkin('classic');
    this.kickerTeam = -1;
  }

  place(p, x, z, face) {
    p.x = x; p.z = z; p.y = 0; p.vx = p.vz = p.vy = 0;
    if (face !== undefined) p.face = face;
    p.stun = 0; p.anim = 'idle'; p.actT = 0; p.charging = false; p.charge = 0;
    p.in.mx = 0; p.in.mz = 0; p.in.sprint = false;
    for (const k in p.cd) p.cd[k] = 0;
    for (const k in p.fx) p.fx[k] = 0;
  }
  move(p, mx, mz, sprint = false) {
    const l = Math.hypot(mx, mz) || 1;
    p.in.mx = mx / l; p.in.mz = mz / l; p.in.sprint = sprint;
    p.in.yaw = Math.atan2(mx, mz);
  }
  stop(p) { p.in.mx = 0; p.in.mz = 0; p.in.sprint = false; }
  yawTo(p, x, z) { return Math.atan2(x - p.x, z - p.z); }
  act(p, a, extra = {}) { this.w.doAction(p, { a, ...extra }); }
  own(p) {
    const b = this.w.ball;
    Object.assign(b, { owner: -1, vx: 0, vy: 0, vz: 0, fire: false, inNet: 0, grapple: -1, block: -1 });
    this.w.giveBall(p, 'pickup');
    this.w.events.length = 0;
  }
  benchAll(except = []) {
    // park unused actors far away (outside the camera's view)
    const spots = [[-38, -24], [-30, -25], [-22, -25], [38, -24], [30, -25], [22, -25], [-38, 24], [38, 24]];
    let i = 0;
    for (const p of this.w.players) {
      if (except.includes(p)) continue;
      const [x, z] = spots[i++ % spots.length];
      this.place(p, x, z, 0);
    }
  }

  // ---------------------------------------------------------------- script
  buildCues() {
    const w = this.w, H = this.hero, d1 = this.d1, gk = this.gk;
    const goalX = FIELD.halfL;
    const cues = [];
    const at = (t, fn) => cues.push({ t, fn, done: false });

    // ---------------- Shot 1: dribble, skill move, item, fire shot
    at(0, () => {
      this.shot = 'chase';
      this.benchAll([H, d1, gk, this.r2, this.d2]);
      this.place(H, -4, 1.5, Math.PI / 2);
      this.place(d1, 14, -1, -Math.PI / 2);
      this.place(gk, goalX - 1.6, 0, -Math.PI / 2);
      this.place(this.r2, -12, 9, Math.PI / 2);
      this.place(this.d2, 6, 10, -Math.PI / 2);
      this.own(H);
      this.move(H, 1, -0.04, true);
      this.move(d1, -1, 0.1, true);
      this.move(this.r2, 1, -0.2, true);
      this.move(this.d2, 1, -0.5, false);
      w.boxes = [{ id: 900, x: 16.5, z: -1.4, c: 1 }];
    });
    at(1.15, () => this.act(d1, 'tackle', { mx: -1, mz: 0.08 }));
    at(1.05, () => this.act(H, 'dribble', { mx: 0.75, mz: -0.65 }));
    at(1.5, () => this.move(H, 1, 0.06, true));
    at(1.9, () => { this.move(d1, -0.3, 1, false); });
    at(2.75, () => { H.items = ['fire', null]; });
    at(3.0, () => { this.act(H, 'item', { slot: 0, yaw: H.face, pitch: 0.3 }); });
    at(3.25, () => { this.stop(H); this.act(H, 'charge', { on: true }); });
    at(3.3, () => { H.in.yaw = this.yawTo(H, goalX, -3.6); });
    at(4.15, () => {
      const yaw = this.yawTo(H, goalX, -3.6);
      H.in.yaw = yaw; H.face = yaw;
      this.act(H, 'kick', { pw: 1, yaw, pitch: 0.02, cv: 0 });
      this.shot = 'fireball';
    });
    at(4.25, () => this.act(gk, 'tackle', { mx: 0.25, mz: 1 }));
    // ---------------- Shot 2: goal + celebration
    at(4.9, () => { if (w.phase === 'goal') w.phaseT = 30; });
    at(5.6, () => { this.shot = 'celebrate'; if (w.phase === 'goal') w.phaseT = 30; setAnim(H, 'celebrate', 2.2); });

    // ---------------- Shot 3a: barrel bowling
    at(7.4, () => {
      this.shot = 'barrel';
      w.phase = 'play';
      w.puddles.length = 0; w.projs.length = 0; w.walls.length = 0; w.boxes = [];
      const b = w.ball; Object.assign(b, { owner: -1, x: 30, y: PHYS.ballR, z: 20, vx: 0, vy: 0, vz: 0, inNet: 0, fire: false });
      this.benchAll([this.r2, d1, this.d2, this.d3]);
      this.place(this.r2, -14, 6, Math.PI / 2);
      this.place(d1, -3, 7.2, -Math.PI / 2);
      this.place(this.d2, -1, 4.2, -Math.PI / 2);
      this.place(this.d3, 1.5, 6.6, -Math.PI / 2);
      this.move(d1, -1, 0.1); this.move(this.d2, -1, 0.3); this.move(this.d3, -1, -0.1);
      this.r2.items = ['barrel', null];
    });
    at(7.75, () => this.act(this.r2, 'item', { slot: 0, yaw: Math.PI / 2 + 0.02, pitch: 0.3 }));
    // ---------------- Shot 3b: ice blast
    at(9.1, () => {
      this.shot = 'ice';
      w.projs.length = 0;
      this.benchAll([this.r3, this.d1, H]);
      this.place(this.r3, 6, -12, Math.PI / 2 + 0.3);
      this.place(this.d1, 20, -6, -Math.PI / 2 - 0.4);
      this.place(H, 8, -6, Math.PI / 2);
      this.own(this.d1);
      this.move(this.d1, -1, -0.45, true);
      this.r3.items = ['ice', null];
    });
    at(9.45, () => this.act(this.r3, 'item', { slot: 0, yaw: this.yawTo(this.r3, this.d1.x - 3.5, this.d1.z - 1.5), pitch: 0.3 }));
    at(9.9, () => { this.move(H, 1, 0, true); });
    // ---------------- Shot 3c: jetpack over the defence
    at(10.7, () => {
      this.shot = 'jet';
      w.projs.length = 0;
      this.benchAll([H, this.d2, this.d3]);
      this.place(H, -16, 2, Math.PI / 2);
      this.place(this.d2, -6, 2.5, -Math.PI / 2);
      this.place(this.d3, -3, 0.5, -Math.PI / 2);
      this.own(H);
      this.move(H, 1, 0, true);
      this.move(this.d2, -1, 0, true);
      this.move(this.d3, -1, 0.2, false);
      H.items = ['jet', null];
    });
    at(10.85, () => this.act(H, 'item', { slot: 0, yaw: Math.PI / 2, pitch: 0.3 }));
    at(11.15, () => this.act(this.d2, 'tackle', { mx: -1, mz: 0 }));
    // ---------------- Shot 3d: boxing glove
    at(12.3, () => {
      this.shot = 'punch';
      this.benchAll([this.r2, this.d3]);
      this.place(this.r2, 10, 12, Math.PI / 2);
      this.place(this.d3, 15.5, 12.2, -Math.PI / 2);
      this.own(this.d3);
      this.move(this.d3, -1, 0, false);
      this.move(this.r2, 1, 0, false);
      this.r2.items = ['punch', null];
    });
    at(12.55, () => { this.stop(this.r2); this.act(this.r2, 'item', { slot: 0, yaw: Math.PI / 2, pitch: 0.3 }); });
    // ---------------- Shot 4: team celebration, fireworks
    at(13.9, () => {
      this.shot = 'finale';
      const reds = [H, this.r2, this.r3];
      this.benchAll(reds);
      reds.forEach((p, i) => { this.place(p, 30 + (i % 2) * 2.5 - 1, -2.5 + i * 2.4, -Math.PI / 2 - 0.3 + i * 0.25); });
      setAnim(H, 'celebrate', 6);
      setAnim(this.r2, 'cheer', 6);
      this.r3.emote = 'dance'; setAnim(this.r3, 'emote', 6); this.r3.emote = 'dance';
      const b = w.ball; Object.assign(b, { owner: -1, x: 33, y: 0.55, z: 1.5, vx: 0, vy: 0, vz: 0, inNet: 0 });
      this.R.vfx.fireworks(36, 6, 0);
      this.R.vfx.confetti(32, 4, 0, 160);
    });
    at(15.2, () => { this.R.vfx.fireworks(28, 7, -6); this.R.vfx.confetti(30, 5, 4, 120); });
    at(16.6, () => { this.R.vfx.fireworks(34, 8, 5); this.R.vfx.confetti(31, 5, -3, 120); });
    return cues.sort((a, b) => a.t - b.t);
  }

  // ---------------------------------------------------------------- camera
  setCamera(dt) {
    const w = this.w, H = this.hero, b = w.ball;
    const fov = this.portrait ? 74 : 58;
    let pos = new THREE.Vector3(), look = new THREE.Vector3();
    const t = this.t;
    switch (this.shot) {
      case 'chase': {
        const f = H.face;
        const back = this.portrait ? 9.5 : 8.2;
        pos.set(H.x - Math.sin(f) * back + 1.5, 3.4, H.z - Math.cos(f) * back - 2.5);
        look.set(H.x + Math.sin(f) * 4, 1.6, H.z + Math.cos(f) * 4);
        break;
      }
      case 'fireball': {
        pos.set(b.x - 3, 2.6, b.z - 11);
        look.set(b.x + 4, b.y * 0.7 + 0.8, b.z);
        if (b.x > FIELD.halfL - 6) { pos.set(FIELD.halfL - 8, 2.6, -13); look.set(FIELD.halfL + 1, 2, -2); }
        break;
      }
      case 'celebrate': {
        const k = Math.min(1, (t - 5.6) / 1.8);
        const a = -0.6 + ease(k) * 1.4;
        const r = this.portrait ? 7.5 : 6.5;
        pos.set(H.x + Math.sin(a + Math.PI / 2) * r, 2.0, H.z + Math.cos(a + Math.PI / 2) * r - 1);
        look.set(H.x, 1.6 + (H.y || 0) * 0.5, H.z);
        break;
      }
      case 'barrel': {
        const k = Math.min(1, (t - 7.4) / 1.7);
        pos.set(lerp(-14, -2, ease(k)), 2.2, -3.5);
        look.set(lerp(-9, 1, ease(k)), 1.0, 5.8);
        break;
      }
      case 'ice': {
        const d = this.d1;
        pos.set(d.x - 2, 2.4, d.z - 8.5);
        look.set(d.x - 1, 1.4, d.z);
        break;
      }
      case 'jet': {
        pos.set(H.x - 1, 3.2 + (H.y || 0) * 0.3, H.z - 9.5);
        look.set(H.x + 2.5, 2 + (H.y || 0) * 0.6, H.z);
        break;
      }
      case 'punch': {
        pos.set(12.6, 2.0, 5.2);
        look.set(13.0, 1.3, 12.2);
        break;
      }
      case 'finale': {
        const k = Math.min(1, (t - 13.9) / 4.1);
        const a = -1.9 + ease(k) * 0.9;
        const r = lerp(9, 14, ease(k));
        pos.set(31 + Math.sin(a) * r, lerp(2.2, 7.5, ease(k)), 0 + Math.cos(a) * r);
        look.set(31, 1.8, 0);
        break;
      }
      default:
        pos.set(0, 20, -40); look.set(0, 0, 0);
    }
    if (!this.camInit || this.cut) {
      this.camPos.copy(pos); this.camLook.copy(look); this.camInit = true; this.cut = false;
    } else {
      const k = 1 - Math.exp(-dt * 9);
      this.camPos.lerp(pos, k);
      this.camLook.lerp(look, k);
    }
    this.cam.fov = fov;
    this.cam.updateProjectionMatrix();
    this.cam.position.copy(this.camPos);
    this.cam.lookAt(this.camLook);
    this.R.rig.applyShake(dt);
  }

  // ------------------------------------------------------------------- HUD
  buildHud() {
    const hud = document.createElement('div');
    hud.id = 'hud';
    hud.className = 'screen show';
    hud.style.position = 'absolute';
    hud.style.zIndex = '8';
    hud.innerHTML = `
      <div class="hud-top">
        <div id="scoreboard" class="scoreboard"><span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span>
          <span class="sq red"></span><span id="vScoreR" class="sc">0</span><span class="dash">–</span><span id="vScoreB" class="sc">0</span><span class="sq blue"></span><span class="you left">YOU</span></div>
        <div class="timer"><span class="clock">⏱</span><span id="vTimer">4:23</span></div>
        <div id="vGoalPop" class="goal-pop"><span class="gp-tag">GOAL!</span><div class="gp-card"><span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span><span class="sq red"></span><span>You</span></div></div>
      </div>
      <div class="hud-tr"><div id="vToasts" class="toasts"></div></div>
      <div id="vAnnounce" class="announce"></div>`;
    document.getElementById('stage').appendChild(hud);
    const css = document.createElement('style');
    css.textContent = `#stage .screen { position: absolute; } #stage { --u: ${this.portrait ? '1.25rem' : '1.15rem'}; } #stage *, #stage *::before { animation: none !important; transition: none !important; }`;
    document.head.appendChild(css);
    this.hud = hud;
  }

  toast(text, pts) {
    const d = document.createElement('div');
    d.className = `toast ${pts >= 40 ? 'big' : ''}`;
    d.textContent = text;
    if (pts) { const b = document.createElement('b'); b.textContent = `+${pts}`; d.appendChild(b); }
    const box = document.getElementById('vToasts');
    box.prepend(d);
    d.dataset.die = String(this.t + 2.4);
  }

  // ------------------------------------------------------------------ step
  step() {
    const dt = 1 / FPS;
    const prevShot = this.shot;
    for (const c of this.cues) if (!c.done && c.t <= this.t + 1e-6) { c.done = true; c.fn(); }
    if (this.shot !== prevShot) this.cut = true;
    // keep the kickoff/replay logic from interrupting the story
    const w = this.w;
    for (let i = 0; i < 2; i++) {
      w.step(dt / 2);
      if (w.phase === 'goal') w.phaseT = Math.max(w.phaseT, 5);
      if (w.phase === 'replay' || w.phase === 'kickoff') w.phase = 'play';
    }
    w.clock = Math.max(0, 263 - this.t);
    const evs = w.events.splice(0);
    for (const ev of evs) {
      this.R.onEvent(ev, this.fakeSession, { shake: 5 });
      if (ev.e === 'toast' && [1, 2, 3, 4].includes(ev.id)) this.toast(ev.text, ev.pts);
      if (ev.e === 'kick') { const p = w.byId.get(ev.id); this.kickerTeam = p ? p.team : -1; }
      if (ev.e === 'goal') {
        document.getElementById('vScoreR').textContent = String(w.score[0]);
        document.getElementById('vGoalPop').classList.add('show');
        this.hud.classList.add('goal');
        const an = document.getElementById('vAnnounce');
        an.textContent = 'GOAL!';
        this.goalAt = this.t;
      }
    }
    if (this.goalAt !== undefined && this.t - this.goalAt > 3.2) { document.getElementById('vGoalPop').classList.remove('show'); this.hud.classList.remove('goal'); }
    // Frame-driven "GOAL!" announcement (same curve as the in-game CSS keyframes)
    const an = document.getElementById('vAnnounce');
    if (this.goalAt !== undefined) {
      const k = (this.t - this.goalAt) / 1.8;
      let sc = 1, op = 1, rot = -3, ty = -50;
      if (k < 0.12) { const q = k / 0.12; sc = lerp(2.2, 0.95, q); op = q; rot = lerp(-6, -3, q); }
      else if (k < 0.2) sc = lerp(0.95, 1.05, (k - 0.12) / 0.08);
      else if (k < 0.8) sc = 1.05;
      else { const q = Math.min(1, (k - 0.8) / 0.2); op = 1 - q; ty = lerp(-50, -60, q); }
      an.style.opacity = String(Math.max(0, op));
      an.style.transform = `translate(-50%, ${ty}%) scale(${sc}) rotate(${rot}deg)`;
    } else an.style.opacity = '0';
    document.getElementById('vTimer').textContent = fmtTime(w.clock);
    document.querySelectorAll('#vToasts .toast').forEach((d) => { if (+d.dataset.die < this.t) d.remove(); });
    const view = { players: w.players, ball: w.ball, boxes: w.boxes, puddles: w.puddles, projs: w.projs, walls: w.walls, phase: w.phase, map: w.map };
    this.R.syncWorld(view, 1, dt, { kickerTeam: this.kickerTeam });
    this.setCamera(dt);
    this.R.render();
    this.t += dt;
    this.frameNo++;
    return this.frameNo < this.totalFrames;
  }
}

export { TEAMS, stunPlayer };
