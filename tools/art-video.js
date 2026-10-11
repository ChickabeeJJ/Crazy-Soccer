// Preview-video director: scripted plays on top of the real simulation + renderer.
// Rendered deterministically frame by frame (tools/make-art.mjs captures each frame).
// Fast cuts, slow-motion beats and a bullet-time bicycle kick, graded like the covers (dusk, floodlights).
import * as THREE from 'three';
import { World } from '../src/sim/world.js';
import { setAnim, stunPlayer } from '../src/sim/player.js';
import { TEAMS, FIELD, PHYS } from '../src/config.js';
import { fmtTime } from '../src/util/math.js';

const FPS = 30;
const DURATION = 18;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const CLOCK_SVG = '<svg viewBox="0 0 24 24" width="1em" height="1em" style="vertical-align:-0.12em;margin-right:0.3em"><circle cx="12" cy="13" r="8" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M12 9v4l3 2M9 2h6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';

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
    Math.random = seededRandom(1234); // deterministic particles & bots
    this.R = R;
    this.opts = opts;
    this.portrait = opts.portrait;
    this.t = 0; // output (video) time
    this.ts = 1; // simulation time scale (slow motion < 1)
    this.tsTarget = 1;
    this.frameNo = 0;
    this.totalFrames = DURATION * FPS;
    this.R.showNames = false;
    this.cam = R.cam;
    this.camPos = new THREE.Vector3();
    this.camLook = new THREE.Vector3();
    this.camInit = false;
    this.flash = 0;
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
    const mk = (id, team, name, cos) => w.addPlayer({ id, name, team, isBot: false, cos });
    this.hero = mk(1, 0, 'You', H);
    this.r2 = mk(2, 0, 'Kai', { skin: 2, hair: 'buns', hairColor: 2, jersey: 'lightning', number: 8 });
    this.r3 = mk(3, 0, 'Noah', { skin: 4, hair: 'afro', hairColor: 8, jersey: 'lightning', number: 11 });
    this.r4 = mk(4, 0, 'Mia', { skin: 0, hair: 'cap', hairColor: 3, jersey: 'lightning', number: 2 });
    this.gk = mk(10, 1, 'Leo', { skin: 3, hair: 'cap', hairColor: 5, jersey: 'classic', number: 1 });
    this.d1 = mk(11, 1, 'Max', { skin: 1, hair: 'beanie', hairColor: 3, jersey: 'stripes', number: 4 });
    this.d2 = mk(12, 1, 'Zoe', { skin: 5, hair: 'mohawk', hairColor: 4, jersey: 'stripes', number: 9 });
    this.d3 = mk(13, 1, 'Eli', { skin: 2, hair: 'spiky', hairColor: 6, jersey: 'stripes', number: 5 });
    w.brains.clear();
    w.resetKickoff(0);
    // resetKickoff shuffles positions; the script needs fixed roles and keepers
    [this.hero, this.r2, this.r3, this.r4].forEach((p, i) => { p.slot = i; p.keeper = i === 3; });
    [this.d1, this.d2, this.d3, this.gk].forEach((p, i) => { p.slot = i; p.keeper = i === 3; });
    w.phase = 'play';
    w.phaseT = 0;
    w.clock = 94;
    w.nextItemT = 999;
    w.noAutoItems = true;
    this.fakeSession = { localId: 1, playerById: (id) => w.byId.get(id) };
    this.R.setVariant('grass');
    this.opts.helpers.grade({ sunZ: -20 });
    this.R.ball.setSkin('classic');
    this.kickerTeam = -1;
  }

  place(p, x, z, face) {
    p.x = x; p.z = z; p.y = 0; p.vx = p.vz = p.vy = 0;
    if (face !== undefined) p.face = face;
    p.stun = 0; p.anim = 'idle'; p.actT = 0; p.charging = false; p.charge = 0; p.bikeT = 0;
    p.in.mx = 0; p.in.mz = 0; p.in.sprint = false; p.stamina = 175;
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
  act(p, a, extra = {}) { p.cd[a === 'item' ? 'item' : a] = 0; this.w.doAction(p, { a, ...extra }); }
  own(p) {
    const b = this.w.ball;
    Object.assign(b, { owner: -1, vx: 0, vy: 0, vz: 0, fire: false, inNet: 0, grapple: -1, block: -1, bike: -1, held: false });
    this.w.giveBall(p, 'pickup');
    this.w.events.length = 0;
  }
  freeBall(x, z) { Object.assign(this.w.ball, { owner: -1, x, y: PHYS.ballR, z, vx: 0, vy: 0, vz: 0, inNet: 0, fire: false, bike: -1, held: false, shot: null }); }
  clearField() { const w = this.w; w.projs.length = 0; w.walls.length = 0; w.puddles.length = 0; w.boxes = []; w.phase = 'play'; }
  benchAll(except = []) {
    // park unused actors far away (outside the camera's view)
    const spots = [[-40, -24], [-32, -25], [-24, -25], [40, -24], [32, -25], [24, -25], [-40, 24], [40, 24]];
    let i = 0;
    for (const p of this.w.players) {
      if (except.includes(p)) continue;
      const [x, z] = spots[i++ % spots.length];
      this.place(p, x, z, 0);
    }
  }
  slowmo(scale) { this.tsTarget = scale; }

  // ---------------------------------------------------------------- script
  buildCues() {
    const w = this.w, H = this.hero, d1 = this.d1, gk = this.gk;
    const goalX = FIELD.halfL;
    const cues = [];
    const at = (t, fn) => cues.push({ t, fn, done: false });

    // ---- 1. Low tracking run: slide tackle dodged with a skill spin
    at(0.0, () => {
      this.shot = 'chase';
      this.benchAll([H, d1, this.r2]);
      this.place(H, -2, 1.5, Math.PI / 2);
      this.place(d1, 13, 0, -Math.PI / 2);
      this.place(this.r2, -9, 8, Math.PI / 2);
      this.own(H);
      this.move(H, 1, -0.03, true);
      this.move(d1, -1, 0.08, true);
      this.move(this.r2, 1, -0.15, true);
    });
    at(0.95, () => this.act(d1, 'tackle', { mx: -1, mz: 0.05 }));
    at(1.0, () => { this.slowmo(0.35); this.act(H, 'dribble', { mx: 0.7, mz: -0.7 }); });
    at(1.45, () => { this.slowmo(1); this.move(H, 1, 0.05, true); });
    // ---- 2. Flick, jump, bullet-time bicycle kick, goal
    at(2.3, () => {
      this.shot = 'bike';
      this.clearField();
      this.benchAll([H, gk, this.d2]);
      this.place(H, 28, -1, Math.PI / 2);
      this.place(gk, goalX - 1.8, 0.5, -Math.PI / 2);
      this.place(this.d2, 37, -12, -Math.PI / 2 - 0.6);
      this.move(this.d2, -0.7, 0.7, true);
      this.own(H);
      this.bike = { stage: 0 };
    });
    at(2.45, () => { this.act(H, 'flick', { yaw: Math.PI / 2 }); this.bike.stage = 1; });
    // stages 2..4 are condition driven in step(): jump at the right moment, hang, fire
    // ---- 3. Bazooka blast sends three defenders flying
    at(6.2, () => {
      this.shot = 'bazooka';
      this.clearField();
      this.ts = 1; this.slowmo(1);
      this.benchAll([this.r2, d1, this.d2, this.d3]);
      this.place(this.r2, -18, 4, Math.PI / 2);
      this.place(d1, -6, 3.4, -Math.PI / 2);
      this.place(this.d2, -5, 5.6, -Math.PI / 2);
      this.place(this.d3, -7.2, 6.3, -Math.PI / 2);
      this.own(this.d2);
      this.move(d1, -1, 0.1, true); this.move(this.d2, -1, 0, true); this.move(this.d3, -1, -0.1, true);
      this.r2.items = ['bazooka', null];
    });
    at(6.4, () => this.act(this.r2, 'item', { slot: 0, yaw: Math.PI / 2 + 0.03, pitch: 0.3 }));
    at(6.75, () => this.slowmo(0.3));
    at(7.55, () => this.slowmo(1));
    // ---- 4. Freeze gun stops a dribbler cold
    at(8.2, () => {
      this.shot = 'ice';
      this.clearField();
      this.benchAll([this.r3, d1, H]);
      this.place(this.r3, 6, -12, Math.PI / 2 + 0.3);
      this.place(d1, 19, -6, -Math.PI / 2 - 0.4);
      this.place(H, 9, -5, Math.PI / 2);
      this.own(d1);
      this.move(d1, -1, -0.45, true);
      this.r3.items = ['ice', null];
    });
    at(8.4, () => this.act(this.r3, 'item', { slot: 0, yaw: this.yawTo(this.r3, d1.x - 3, d1.z - 1.4), pitch: 0.3 }));
    at(8.85, () => this.move(H, 1, -0.1, true));
    // ---- 5. Rocket punch
    at(9.8, () => {
      this.shot = 'punch';
      this.clearField();
      this.benchAll([this.r2, this.d3]);
      this.place(this.r2, 10, 12, Math.PI / 2);
      this.place(this.d3, 16, 12.2, -Math.PI / 2);
      this.own(this.d3);
      this.move(this.d3, -1, 0, false);
      this.r2.items = ['punch', null];
    });
    at(9.95, () => this.act(this.r2, 'item', { slot: 0, yaw: Math.PI / 2, pitch: 0.3 }));
    at(10.1, () => this.slowmo(0.35));
    at(10.6, () => this.slowmo(1));
    // ---- 6. Keeper throw bowls over two attackers
    at(11.1, () => {
      this.shot = 'keeper';
      this.clearField();
      this.benchAll([gk, this.r3, this.r2]);
      this.place(gk, goalX - 4, 0, -Math.PI / 2);
      this.place(this.r3, goalX - 11, 0.6, Math.PI / 2);
      this.place(this.r2, goalX - 15.5, -0.6, Math.PI / 2);
      this.place(this.r3, goalX - 11, 0.3, Math.PI / 2);
      this.place(this.r2, goalX - 15.5, -0.3, Math.PI / 2);
      for (const p of [d1, this.d2, this.d3]) this.place(p, goalX - 6, p === d1 ? 24 : -24, 0);
      this.own(gk);
      this.move(this.r3, 1, 0, false); this.move(this.r2, 1, 0, false);
    });
    at(11.45, () => this.act(gk, 'pass', { yaw: -Math.PI / 2, pitch: 0.2, assist: false }));
    at(11.55, () => this.slowmo(0.4));
    at(12.15, () => this.slowmo(1));
    // ---- 7. Jetpack over the defence
    at(12.7, () => {
      this.shot = 'jet';
      this.clearField();
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
    at(12.8, () => this.act(H, 'item', { slot: 0, yaw: Math.PI / 2, pitch: 0.3 }));
    at(13.1, () => this.act(this.d2, 'tackle', { mx: -1, mz: 0 }));
    // ---- 8. Supercharged finish into the top corner
    at(14.4, () => {
      this.shot = 'finale';
      this.clearField();
      this.benchAll([H, gk, d1]);
      this.place(H, 24, 6, Math.PI / 2 - 0.2);
      this.place(gk, goalX - 1.8, 1, -Math.PI / 2);
      this.place(d1, 30, 2, -Math.PI / 2);
      this.own(H);
      this.move(H, 1, -0.2, true);
      this.move(d1, -1, 0.3, true);
      H.items = ['fire', null];
    });
    at(14.5, () => this.act(H, 'item', { slot: 0, yaw: H.face, pitch: 0.3 }));
    at(14.95, () => { this.stop(H); this.act(H, 'charge', { on: true }); });
    at(15.5, () => {
      const yaw = this.yawTo(H, goalX, -FIELD.goalW / 2 + 1.5);
      H.in.yaw = yaw; H.face = yaw;
      this.act(H, 'kick', { pw: 1, yaw, pitch: 0.12, tx: goalX + 1, ty: FIELD.goalH - 1.2, tz: -FIELD.goalW / 2 + 1.6 });
      this.slowmo(0.3);
    });
    at(15.65, () => this.act(gk, 'dive', { mx: 0.2, mz: -1 }));
    at(16.15, () => this.slowmo(1));
    return cues.sort((a, b) => a.t - b.t);
  }

  // The bicycle kick runs on game state, not the clock: jump at the right moment, hang, fire
  stepBike() {
    const S = this.bike;
    if (!S || !['bike', 'bullet', 'goalcam'].includes(this.shot)) return;
    const w = this.w, H = this.hero, b = w.ball;
    if (S.stage === 1 && b.vy < 4.5 && b.y > 1.6) { this.act(H, 'dribble', {}); S.stage = 2; }
    else if (S.stage === 2 && w.canBike(H)) {
      this.act(H, 'bike');
      if (b.bike === H.id) { S.stage = 3; S.hangT = this.t; this.slowmo(0.22); this.shot = 'bullet'; this.cut = false; }
    } else if (S.stage === 3 && this.t - S.hangT > 1.25) {
      const gz = 2.6;
      this.act(H, 'kick', { pw: 0.95, yaw: this.yawTo(H, FIELD.halfL, gz), pitch: 0.1, tx: FIELD.halfL + 1, ty: 2.2, tz: gz });
      this.act(this.gk, 'dive', { mx: 0, mz: -1 });
      S.stage = 4; S.fireT = this.t;
      this.slowmo(1); this.ts = 0.6;
    } else if (S.stage === 4 && this.t - S.fireT > 0.2 && this.shot === 'bullet') {
      this.shot = 'goalcam';
    }
  }

  // ---------------------------------------------------------------- camera
  setCamera(dt) {
    const w = this.w, H = this.hero, b = w.ball;
    const P = this.portrait;
    let fov = P ? 72 : 54;
    const pos = new THREE.Vector3(), look = new THREE.Vector3();
    const t = this.t;
    let snap = 9;
    switch (this.shot) {
      case 'chase': {
        // low, close, side-on tracking
        pos.set(H.x - 2.2, 1.15, H.z + (P ? 6.2 : 5.2));
        look.set(H.x + 2.4, 1.2, H.z - 0.5);
        fov = P ? 70 : 50;
        break;
      }
      case 'bike': {
        pos.set(H.x - 1.5, 1.4, H.z + (P ? 8.5 : 7.5));
        look.set(H.x + 1.5, 2.2 + (H.y || 0) * 0.4, H.z);
        break;
      }
      case 'bullet': {
        // bullet-time orbit around the hanging player
        const k = ease(clamp01((t - this.bike.hangT) / 1.25));
        const a = lerp(-0.25, 0.75, k);
        const r = P ? 9.5 : 8;
        pos.set(H.x + Math.sin(a) * r, (H.y || 0) + lerp(0.4, 1.4, k), H.z + Math.cos(a) * r);
        look.set(H.x + 0.6, (H.y || 0) + 1.6, H.z);
        fov = P ? 70 : 50;
        snap = 30;
        break;
      }
      case 'goalcam': {
        // inside the stadium, behind the goal, ball rushing at the lens
        pos.set(FIELD.halfL - 4.5, 1.3, FIELD.goalW / 2 + 6);
        look.set(lerp(b.x, FIELD.halfL + 1, 0.6), 2.0, b.z * 0.5);
        fov = P ? 74 : 58;
        break;
      }
      case 'bazooka': {
        const k = ease(clamp01((t - 6.2) / 2.0));
        pos.set(lerp(-13, -9.5, k), 1.0, -1.2);
        look.set(lerp(-8, -5.5, k), 1.5, 5.2);
        break;
      }
      case 'ice': {
        const d = this.d1;
        pos.set(d.x - 2, 1.5, d.z - 8);
        look.set(d.x - 1, 1.3, d.z);
        break;
      }
      case 'punch': {
        pos.set(13.4, 1.3, 6.2);
        look.set(13.6, 1.5, 12.2);
        break;
      }
      case 'keeper': {
        pos.set(FIELD.halfL - 7, 1.2, 7.5);
        look.set(FIELD.halfL - 9, 1.2, 0);
        fov = P ? 76 : 62;
        break;
      }
      case 'jet': {
        pos.set(H.x - 1.5, 2.2 + (H.y || 0) * 0.4, H.z - 8.5);
        look.set(H.x + 2.5, 1.8 + (H.y || 0) * 0.7, H.z);
        break;
      }
      case 'finale': {
        const k = ease(clamp01((t - 14.4) / 3.6));
        if (t < 15.5) { pos.set(H.x - 4, 1.4, H.z + 4.5); look.set(H.x + 3, 1.4, H.z - 1); }
        else { pos.set(lerp(b.x - 6, FIELD.halfL - 9, k), 1.6, lerp(6, 8, k)); look.set(lerp(b.x, FIELD.halfL, 0.5), 2.6, -4); }
        break;
      }
      default:
        pos.set(0, 20, -40); look.set(0, 0, 0);
    }
    if (!this.camInit || this.cut) {
      this.camPos.copy(pos); this.camLook.copy(look); this.camInit = true; this.cut = false;
    } else {
      const k = 1 - Math.exp(-dt * snap);
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
          <span class="sq red"></span><span id="vScoreR" class="sc">2</span><span class="dash">–</span><span id="vScoreB" class="sc">2</span><span class="sq blue"></span></div>
        <div class="timer">${CLOCK_SVG}<span id="vTimer">1:34</span></div>
      </div>
      <div id="vAnnounce" class="announce"></div>`;
    document.getElementById('stage').appendChild(hud);
    const css = document.createElement('style');
    css.textContent = `#stage .screen { position: absolute; } #stage { --u: ${this.portrait ? '1.25rem' : '1.15rem'}; } #stage *, #stage *::before, #stage *::after { animation: none !important; transition: none !important; }`;
    document.head.appendChild(css);
    this.hud = hud;
    this.score = 2;
  }

  // ------------------------------------------------------------------ step
  step() {
    const dt = 1 / FPS;
    const prevShot = this.shot;
    for (const c of this.cues) if (!c.done && c.t <= this.t + 1e-6) { c.done = true; c.fn(); }
    this.stepBike();
    if (this.shot !== prevShot && !(prevShot === 'bike' && this.shot === 'bullet')) this.cut = true;
    // speed ramps
    this.ts += (this.tsTarget - this.ts) * Math.min(1, dt * 14);
    const sdt = dt * this.ts;
    const w = this.w;
    for (let i = 0; i < 2; i++) {
      w.step(sdt / 2);
      if (w.phase === 'goal') w.phaseT = Math.max(w.phaseT, 5);
      if (w.phase === 'replay' || w.phase === 'kickoff') w.phase = 'play';
    }
    w.clock = Math.max(0, 94 - this.t);
    const evs = w.events.splice(0);
    for (const ev of evs) {
      this.R.onEvent(ev, this.fakeSession, { shake: 6 });
      if (ev.e === 'kick') { const p = w.byId.get(ev.id); this.kickerTeam = p ? p.team : -1; }
      if (ev.e === 'goal') {
        this.score++;
        document.getElementById('vScoreR').textContent = String(this.score);
        document.getElementById('vAnnounce').textContent = 'GOAL!';
        this.goalAt = this.t;
        this.flash = 0.55;
      }
    }
    // Frame-driven "GOAL!" announcement (same sharp slide as the in-game keyframes)
    const an = document.getElementById('vAnnounce');
    if (this.goalAt !== undefined && this.t - this.goalAt < 1.6) {
      const k = (this.t - this.goalAt) / 1.6;
      const tx = k < 0.1 ? lerp(-62, -50, k / 0.1) : k < 0.82 ? lerp(-50, -49, (k - 0.1) / 0.72) : lerp(-49, -40, (k - 0.82) / 0.18);
      const op = k < 0.1 ? k / 0.1 : k < 0.82 ? 1 : 1 - (k - 0.82) / 0.18;
      an.style.opacity = String(Math.max(0, op));
      an.style.transform = `translate(${tx}%, -50%) skewX(-6deg)`;
    } else an.style.opacity = '0';
    const fl = document.getElementById('flash');
    if (fl) fl.style.opacity = String(Math.max(0, this.flash));
    this.flash -= dt * 2.2;
    document.getElementById('vTimer').textContent = fmtTime(w.clock);
    const view = { players: w.players, ball: w.ball, boxes: w.boxes, puddles: w.puddles, projs: w.projs, walls: w.walls, phase: w.phase, map: w.map };
    this.R.syncWorld(view, 1, sdt, { kickerTeam: this.kickerTeam });
    this.R.marker.visible = false; this.R.carrierMarker.visible = false; // no HUD arrows in the trailer
    this.setCamera(dt);
    this.R.render();
    this.t += dt;
    this.frameNo++;
    return this.frameNo < this.totalFrames;
  }
}

export { TEAMS, stunPlayer, setAnim };
