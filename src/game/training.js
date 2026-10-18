// Offline training: Free Practice, Shooting Challenge, Goalkeeper Challenge and the
// interactive Tutorial. Runs on top of a 'practice' World and scripts it each step.
import { FIELD, PHYS, ITEMS } from '../config.js';
import { clamp, len2, rand, r2 } from '../util/math.js';
import { createBall } from '../sim/ball.js';
import { setAnim } from '../sim/player.js';

const L = FIELD.halfL, HW = FIELD.goalW / 2, GH = FIELD.goalH;
const DUMMY_COS = { skin: 3, hair: 'buzz', hairColor: 0, jersey: 'classic', ball: 'classic', goalfx: 'confetti', number: 9 };
const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.max(0, Math.floor(t % 60))).padStart(2, '0')}`;

export const TRAINING_INFO = {
  free: { title: 'FREE PRACTICE' },
  shoot: { title: 'SHOOTING CHALLENGE', time: 60 },
  keeper: { title: 'GOALKEEPER CHALLENGE', shots: 12 },
  tutorial: { title: 'TUTORIAL' },
};

export class Training {
  // opts: { power, labels: (action) => keyLabel, mobile }
  constructor(kind, opts = {}) {
    this.kind = kind;
    this.opts = opts;
    this.power = opts.power && ITEMS[opts.power] ? opts.power : null;
    this.keeperBot = kind === 'free';
    this.itemPool = this.power ? [this.power] : null;
    this.score = 0;
    this.time = 0;
    this.started = false;
    this.result = null;
    this.targets = [];
    this.uid = 1;
    this.toasts = [];
  }

  attach(session) {
    this.s = session;
    this.w = session.world;
    const w = this.w;
    // Goalkeeper Challenge must not use Free Practice's request-to-teleport behavior.
    w.noRequestTeleport = this.kind === 'keeper';
    w.practiceGoalT = this.kind === 'free' ? 1.4 : 0.9;
    if (this.kind !== 'free') { w.noAutoItems = true; w.quietAwards = true; }
    w.hooks.kickoff = () => this.kickoff();
    if (this.kind === 'shoot') { this.timeLeft = TRAINING_INFO.shoot.time; for (let i = 0; i < 3; i++) this.addTarget(); }
    if (this.kind === 'keeper') {
      this.shots = 0; this.saves = 0; this.conceded = 0; this.cycle = null;
      this.shooter = this.dummy(990, 'Striker', 1, { ...DUMMY_COS, hair: 'mohawk', hairColor: 4, number: 10 });
    }
    if (this.kind === 'tutorial') this.tut = { i: 0, t: 0, moved: 0, yaw: null, yawTravel: 0, sprint: 0, flags: {} };
  }

  get me() { return this.w.byId.get(this.s.localId); }

  dummy(id, name, team, cos) {
    const p = this.w.addPlayer({ id, name, team, isBot: true, cos });
    this.w.brains.delete(id);
    return p;
  }

  removeDummy(p) { if (p && this.w.byId.get(p.id)) this.w.removePlayer(p.id); }

  toast(text, pts) { this.s.handleEvent({ e: 'toast', id: this.s.localId, text, pts }); }

  // ------------------------------------------------------------- placement
  kickoff() {
    const w = this.w, me = this.me, b = w.ball;
    if (!me) return;
    if (this.kind === 'shoot') {
      const x = rand(L - 30, L - 15), z = rand(-13, 13);
      Object.assign(b, createBall(), { x, z });
      const yaw = Math.atan2(L - x, -z);
      me.x = x - Math.sin(yaw) * 2.6; me.z = z - Math.cos(yaw) * 2.6; me.face = yaw;
      this.missT = 0;
    } else if (this.kind === 'keeper') {
      me.x = -L + 1.6; me.z = 0; me.face = Math.PI / 2; me.keeper = true;
      Object.assign(b, createBall(), { x: -L + 20, z: 0 });
      this.cycle = null;
      const sh = this.shooter;
      if (sh) { sh.x = -L + 22; sh.z = 0; sh.face = -Math.PI / 2; }
    } else if (this.kind === 'tutorial') {
      const st = TUT_STEPS[this.tut.i];
      if (st && st.place) st.place(this);
    }
    if (this.kind === 'free' && this.power) { me.items[0] = this.power; me.items[1] = this.power; }
  }

  addTarget() {
    const spots = [];
    for (const z of [-HW + 1.9, -HW / 2, 0, HW / 2, HW - 1.9]) for (const y of [1.3, GH / 2 + 0.2, GH - 1.4]) spots.push([z, y]);
    const free = spots.filter(([z, y]) => !this.targets.some((t) => Math.hypot(t.z - z, t.y - y) < 2.6));
    const [z, y] = free[Math.floor(Math.random() * free.length)] || [0, 2];
    this.targets.push({ id: this.uid++, x: L + 0.05, z, y, r: 1.35, top: y > GH / 2 + 1 });
  }

  // ------------------------------------------------------------------ step
  step(dt) {
    const w = this.w, me = this.me;
    if (!me || this.result) return;
    this.time += dt;
    if (w.phase === 'play') this.started = true;
    if (this.kind === 'free' && this.power) {
      this.refill = (this.refill || 0) - dt;
      if (this.refill <= 0 && !me.items[0] && !me.items[1]) { me.items[0] = this.power; this.refill = 4; }
    }
    if (this.kind === 'shoot') this.stepShoot(dt);
    else if (this.kind === 'keeper') this.stepKeeper(dt);
    else if (this.kind === 'tutorial') this.stepTutorial(dt);
  }

  stepShoot(dt) {
    const w = this.w, b = w.ball;
    if (!this.started) return;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) { this.finish(); return; }
    if (w.phase !== 'play') return;
    if (this.missT > 0) {
      this.missT -= dt;
      const behind = Math.abs(b.x) > L + 0.5 && b.inNet === 0;
      if (this.missT <= 0 || behind) { this.missT = 0; this.reset(); }
    }
  }

  reset() {
    const w = this.w;
    w.resetKickoff(0);
    w.setPhase('kickoff', 0.25);
  }

  stepKeeper(dt) {
    const w = this.w, b = w.ball, me = this.me, sh = this.shooter;
    me.keeper = w.inOwnBox(me, 0.6);
    if (w.phase !== 'play') return;
    if (!this.cycle) {
      if (this.shots >= TRAINING_INFO.keeper.shots) { this.finish(); return; }
      // Set up the next shot
      const x = -L + rand(12, 24), z = rand(-13, 13);
      if (b.owner >= 0) b.owner = -1;
      Object.assign(b, createBall(), { x, z });
      const yaw = Math.atan2(-L - x, -z * 0.3);
      sh.x = x - Math.sin(yaw) * 1.3; sh.z = z - Math.cos(yaw) * 1.3; sh.face = yaw; sh.vx = sh.vz = 0;
      this.cycle = { t: 0, phase: 'aim', yaw };
      return;
    }
    const c = this.cycle;
    c.t += dt;
    if (c.phase === 'aim') {
      sh.face = c.yaw; sh.in.mx = 0; sh.in.mz = 0;
      if (c.t > 1.15 - Math.min(0.45, this.shots * 0.04)) {
        const tz = rand(-(HW - 1.3), HW - 1.3), ty = rand(0.7, GH - 1.3);
        const speed = Math.min(37, 24 + this.shots * 1.2);
        const dx = -L - b.x, dz = tz - b.z;
        const dh = len2(dx, dz), t = dh / speed;
        const vy = (ty - b.y) / t + 0.5 * PHYS.gravity * t;
        setAnim(sh, 'kick', 0.38);
        w.launch(sh, (dx / dh) * speed, vy, (dz / dh) * speed, 'shot', 0.8);
        b.curve = rand(-4, 4);
        this.shots++;
        c.phase = 'flight'; c.t = 0;
      }
    } else if (c.phase === 'flight') {
      if (b.owner === me.id || c.saved) { this.save(); return; }
      if (c.t > 3.2 || (Math.hypot(b.vx, b.vz) < 2 && c.t > 1)) this.save();
    }
  }

  save() {
    if (!this.cycle || this.cycle.done) return;
    this.cycle.done = true;
    this.saves++;
    this.score = this.saves;
    this.toast('Save!', 25);
    this.cycle = null;
  }

  // -------------------------------------------------------------- events
  onEvent(ev) {
    const me = this.me;
    if (!me) return;
    if (this.kind === 'shoot') {
      if (ev.e === 'kick' && ev.id === me.id && ev.kind !== 'pass') this.missT = 3.2;
      if (ev.e === 'goal') {
        this.missT = 0;
        const hit = this.targets.find((t) => Math.hypot(t.z - ev.cz, t.y - ev.cy) < t.r + PHYS.ballR * 0.6);
        if (hit) {
          const pts = hit.top ? 150 : 100;
          this.score += pts;
          this.targets.splice(this.targets.indexOf(hit), 1);
          this.addTarget();
          this.toast(hit.top ? 'Top Bins!' : 'Bullseye!', pts);
          this.s.handleEvent({ e: 'target', x: hit.x, y: hit.y, z: hit.z });
        } else { this.score += 20; this.toast('Goal', 20); }
      }
    } else if (this.kind === 'keeper') {
      if (!this.cycle || this.cycle.done) return;
      if (ev.e === 'goal') { this.cycle.done = true; this.conceded++; this.cycle = null; }
      else if ((ev.e === 'save' || ev.e === 'block' || ev.e === 'own') && ev.id === me.id && this.cycle.phase === 'flight') this.cycle.saved = true;
    } else if (this.kind === 'tutorial') {
      const f = this.tut.flags;
      if (ev.id === me.id) {
        if (ev.e === 'jump') f.jump = true;
        if (ev.e === 'skill') f.skill = true;
        if (ev.e === 'kick' && ev.kind === 'pass') f.pass = true;
        if (ev.e === 'item') f.item = true;
        if (ev.e === 'dive') f.dive = true;
      }
      if (ev.e === 'goal' && ev.scorer === me.id) f.goal = true;
      if (ev.e === 'own' && this.mate && ev.id === this.mate.id) f.mateGot = true;
      if (ev.e === 'stun' && this.rival && ev.id === this.rival.id && ev.by === me.id) f.tackled = true;
    }
  }

  finish() {
    if (this.result) return;
    const info = TRAINING_INFO[this.kind];
    if (this.kind === 'shoot') this.result = { kind: 'shoot', title: 'TIME UP!', score: this.score, label: `${this.score} POINTS`, coins: Math.min(60, Math.round(this.score / 25)) };
    else if (this.kind === 'keeper') this.result = { kind: 'keeper', title: this.saves >= 9 ? 'BRICK WALL!' : 'CHALLENGE OVER', score: this.saves, label: `${this.saves} / ${info.shots} SAVES`, coins: this.saves * 4 };
    else if (this.kind === 'tutorial') this.result = { kind: 'tutorial', title: 'TUTORIAL COMPLETE!', score: 0, label: "You're ready for a real match!", coins: 0 };
  }

  // ------------------------------------------------------------- tutorial
  stepTutorial(dt) {
    const T = this.tut, w = this.w, me = this.me;
    const st = TUT_STEPS[T.i];
    if (!st || w.phase !== 'play') return;
    if (!T.entered) { T.entered = true; T.t = 0; if (st.enter) st.enter(this); }
    T.t += dt;
    // progress trackers
    if (len2(me.vx, me.vz) > 2) T.moved += dt;
    if (me.sprinting) T.sprint += dt;
    const yaw = me.in.yaw;
    if (T.yaw !== null) { let d = Math.abs(yaw - T.yaw); if (d > Math.PI) d = Math.PI * 2 - d; T.yawTravel += d; }
    T.yaw = yaw;
    me.keeper = w.inOwnBox(me, 0.6);
    if (st.tick) st.tick(this, dt);
    if (T.t > 0.6 && st.check(this)) {
      if (st.leave) st.leave(this);
      T.i++; T.entered = false; T.flags = {};
      if (T.i < TUT_STEPS.length) this.toast('Nice!', 0);
      if (T.i >= TUT_STEPS.length) this.finish();
    }
  }

  // ------------------------------------------------------------------ HUD
  key(a) { return this.opts.labels ? this.opts.labels(a) : a; }

  hud() {
    const L2 = (a) => `<kbd>${this.opts.labels ? this.opts.labels(a) : a}</kbd>`;
    if (this.kind === 'shoot') return { timer: this.started ? fmt(Math.max(0, this.timeLeft)) : '1:00', drill: { score: this.score, label: 'POINTS' }, banner: { title: 'Shooting Challenge', text: 'Score through the glowing targets • top targets are worth more' } };
    if (this.kind === 'keeper') return { timer: `SHOT ${Math.min(this.shots, TRAINING_INFO.keeper.shots)}/${TRAINING_INFO.keeper.shots}`, drill: { score: this.saves, label: 'SAVES' }, banner: { title: 'Goalkeeper Challenge', text: `Stay in your box • ${this.key('dive')} to dive` } };
    if (this.kind === 'tutorial') {
      const st = TUT_STEPS[Math.min(this.tut.i, TUT_STEPS.length - 1)];
      const mob = !!this.opts.mobile;
      return {
        timer: 'TUTORIAL',
        tut: { step: Math.min(this.tut.i + 1, TUT_STEPS.length), total: TUT_STEPS.length, title: st.title, html: (mob && st.mob) ? st.mob : st.html(L2), progress: st.progress ? st.progress(this) : 0, skip: mob ? '' : `${L2('lobby')} to skip`, skippable: true },
      };
    }
    return { timer: 'PRACTICE', banner: { title: this.power ? `Trying ${ITEMS[this.power].name}` : 'Free practice', text: `Press ${this.key('request')} to get the ball back • ${this.key('lobby')} returns to the menu` } };
  }
}

// ------------------------------------------------------------- tutorial steps
function ahead(tr, d, side = 0) {
  const me = tr.me;
  const fx = Math.sin(me.face), fz = Math.cos(me.face);
  return { x: clamp(me.x + fx * d - fz * side, -L + 6, L - 6), z: clamp(me.z + fz * d + fx * side, -FIELD.halfW + 4, FIELD.halfW - 4) };
}
function placeBall(tr, pos) { Object.assign(tr.w.ball, createBall(), { x: pos.x, z: pos.z }); }

const TUT_STEPS = [
  { title: 'Move around', html: (k) => `Use ${k('forward')}${k('left')}${k('back')}${k('right')} to run around the pitch.`, mob: 'Use the left stick to run around the pitch.', check: (t) => t.tut.moved > 2.2, progress: (t) => t.tut.moved / 2.2 },
  { title: 'Look around', html: () => 'Move your <b>mouse</b> to turn the camera. The <b>crosshair</b> shows where your shots will fly.', mob: 'Drag on the right side of the screen to turn the camera.', check: (t) => t.tut.yawTravel > 2.5, progress: (t) => t.tut.yawTravel / 2.5 },
  { title: 'Sprint', html: (k) => `Hold ${k('sprint')} while moving to sprint. Sprinting uses the stamina bar at the bottom.`, mob: 'Push the stick all the way to sprint.', check: (t) => t.tut.sprint > 1.6, progress: (t) => t.tut.sprint / 1.6 },
  { title: 'Jump', html: (k) => `Press ${k('dribble')} to jump. Jump to catch high balls and volley them mid-air!`, mob: 'Tap JUMP to jump. Jump to catch high balls and volley them!', check: (t) => t.tut.flags.jump },
  { title: 'Take the ball', html: () => 'Run into the ball to start dribbling it.', enter: (t) => placeBall(t, ahead(t, 7)), check: (t) => t.w.ball.owner === t.me.id,
    tick: (t) => { const b = t.w.ball; if (b.owner < 0 && len2(b.x - t.me.x, b.z - t.me.z) > 30) placeBall(t, ahead(t, 6)); } },
  { title: 'Skill move', html: (k) => `With the ball, ${k('dribble')} does a skill move. Nobody can steal the ball during it!`, mob: 'With the ball, tap JUMP for a skill move. Nobody can steal it during it!', check: (t) => t.tut.flags.skill,
    tick: (t) => { if (t.w.ball.owner !== t.me.id && t.w.ball.owner < 0 && len2(t.w.ball.x - t.me.x, t.w.ball.z - t.me.z) > 4) { t.w.giveBall(t.me); } } },
  { title: 'Score a goal', html: (k) => `Face the far goal. Hold ${k('kick')} to charge, release to shoot. Aim the crosshair <b>higher</b> for a rising shot.`, mob: 'Hold KICK to charge, release to shoot into the far goal!', check: (t) => t.tut.flags.goal,
    place: (t) => { const me = t.me; me.x = L - 26; me.z = 0; me.face = Math.PI / 2; placeBall(t, { x: L - 24, z: 0 }); },
    enter: (t) => { const me = t.me; if (t.w.ball.owner !== me.id) { me.x = L - 26; me.z = 0; me.face = Math.PI / 2; placeBall(t, { x: L - 24, z: 0 }); } } },
  { title: 'Pass to a teammate', html: (k) => `Your teammate is open! Turn toward them and press ${k('pass')} to pass.`, mob: 'Turn toward your teammate and tap PASS.',
    enter: (t) => { const me = t.me; me.x = 0; me.z = 0; me.face = Math.PI / 2; t.mate = t.dummy(980, 'Teammate', 0, DUMMY_COS); t.mate.x = 12; t.mate.z = -9; t.mate.face = -Math.PI / 2; placeBall(t, { x: 1.4, z: 0 }); t.w.giveBall(me); },
    place: (t) => { if (t.mate) { t.mate.x = 12; t.mate.z = -9; } },
    tick: (t) => { const b = t.w.ball; if (b.owner < 0 && len2(b.x - t.me.x, b.z - t.me.z) > 26 && len2(b.x - t.mate.x, b.z - t.mate.z) > 6 && Math.hypot(b.vx, b.vz) < 3) { placeBall(t, ahead(t, 2)); } },
    check: (t) => t.tut.flags.mateGot, leave: (t) => { t.removeDummy(t.mate); t.mate = null; } },
  { title: 'Slide tackle', html: (k) => `A rival has the ball! Get close and press ${k('tackle')} to slide-tackle and steal it.`, mob: 'Get close to the rival and tap TACKLE to steal the ball.',
    enter: (t) => { const p = ahead(t, 10); t.rival = t.dummy(981, 'Rival', 1, { ...DUMMY_COS, hair: 'afro', hairColor: 2, number: 5 }); t.rival.x = p.x; t.rival.z = p.z; t.rivalA = 0; placeBall(t, p); t.w.giveBall(t.rival); },
    tick: (t, dt) => { const r = t.rival; if (!r) return; t.rivalA += dt * 0.6; r.in.mx = Math.cos(t.rivalA) * 0.42; r.in.mz = Math.sin(t.rivalA) * 0.42; r.in.sprint = false; const b = t.w.ball; if (b.owner < 0 && !t.tut.flags.tackled && len2(b.x - r.x, b.z - r.z) < 2 && r.stun <= 0) t.w.giveBall(r); },
    check: (t) => t.tut.flags.tackled, leave: (t) => { t.removeDummy(t.rival); t.rival = null; } },
  { title: 'Use a power', html: (k) => `Grab the glowing <b>?</b> cube, press ${k('item1')} to equip the power, then ${k('kick')} to use it.`, mob: 'Grab the glowing ? cube, then tap the item slot to use the power.',
    enter: (t) => { const p = ahead(t, 6); t.w.boxes.push({ id: t.w.uid++, x: p.x, z: p.z, c: 4, k: 'speed' }); },
    tick: (t) => { const me = t.me; if (!t.w.boxes.length && !me.items[0] && !me.items[1] && !t.tut.flags.item) { const p = ahead(t, 6); t.w.boxes.push({ id: t.w.uid++, x: p.x, z: p.z, c: 2, k: 'speed' }); } },
    check: (t) => t.tut.flags.item },
  { title: 'Become the goalkeeper', html: () => 'Run into <b>your own</b> penalty box (the goal behind you). Whoever walks in first when there is no keeper gets the white keeper kit.', mob: 'Run into your own penalty box (the goal behind you) to become the keeper.',
    check: (t) => t.me.keeper, progress: (t) => clamp(1 - (t.me.x + L - FIELD.boxL) / (L + 20), 0, 1) },
  { title: 'Dive!', html: (k) => `Keepers can dive: press ${k('dive')}. Keepers can't be tackled, but step out of the box and you lose the gloves!`, mob: 'Tap DIVE to dive. Leave the box and you lose the gloves!', check: (t) => t.tut.flags.dive,
    // You can't dive while holding the ball, so roll it out to the edge of the box
    enter: (t) => { if (t.w.ball.owner === t.me.id) t.w.ball.owner = -1; placeBall(t, { x: -L + FIELD.boxL + 6, z: 8 }); },
    tick: (t) => { if (t.w.ball.owner === t.me.id) { t.w.ball.owner = -1; placeBall(t, { x: -L + FIELD.boxL + 6, z: 8 }); } } },
];
