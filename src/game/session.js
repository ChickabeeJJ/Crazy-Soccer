// A Session is one room: offline (vs bots / practice), online host, or online client.
// The host/offline session runs the authoritative World. Clients predict their own
// player + the ball locally and interpolate everyone else from snapshots.
import { World, animName, kickVelocity, clampInOwnBox } from '../sim/world.js';
import { createPlayer, movePlayer, setAnim, canAct, stunPlayer, spendStamina } from '../sim/player.js';
import { createBall, stepBall } from '../sim/ball.js';
import { FIELD, PLAYER, KICK, PHYS, NET, MATCH, GAME_VERSION, MAPS, STAMINA } from '../config.js';
import { clamp, lerp, len2, wrapAngle, r2 } from '../util/math.js';

const now = () => performance.now() / 1000;
const MAX_HUMANS = 8;

function sanitizeName(n) {
  return String(n || 'Player').replace(/[^\w .\-]/g, '').slice(0, 18) || 'Player';
}
function sanitizeCos(c) {
  c = c && typeof c === 'object' ? c : {};
  const s = (v, d) => (typeof v === 'string' ? v.slice(0, 16) : d);
  return {
    skin: clamp(c.skin | 0, 0, 5), hair: s(c.hair, 'spiky'), hairColor: clamp(c.hairColor | 0, 0, 11), eyeColor: clamp(c.eyeColor | 0, 0, 4),
    jersey: s(c.jersey, 'classic'), boots: s(c.boots, 'classic'), ball: s(c.ball, 'classic'), goalfx: s(c.goalfx, 'confetti'), number: clamp(c.number | 0, 1, 99),
  };
}

class ReplayBuffer {
  constructor() { this.frames = []; this.lastT = -1; }
  clear() { this.frames.length = 0; this.lastT = -1; }
  record(t, view) {
    if (t - this.lastT < 1 / 30) return;
    this.lastT = t;
    const b = view.ball;
    this.frames.push({
      t,
      p: view.players.map((p) => [p.id, p.x, p.y, p.z, p.face, p.anim, p.animT, p.charge || 0, (p.fx && p.fx.fire > 0) ? 1 : 0, (p.fx && p.fx.jet > 0) ? 1 : 0]),
      b: [b.x, b.y, b.z, b.spin || 0, b.fire ? 1 : 0],
    });
    while (this.frames.length && t - this.frames[0].t > 9) this.frames.shift();
  }
  sample(t) {
    const f = this.frames;
    if (!f.length) return null;
    if (t <= f[0].t) return f[0];
    for (let i = 1; i < f.length; i++) {
      if (f[i].t >= t) {
        const a = f[i - 1], b = f[i];
        const k = (t - a.t) / (b.t - a.t || 1);
        const map = new Map(b.p.map((x) => [x[0], x]));
        return {
          p: a.p.map((x) => {
            const y = map.get(x[0]) || x;
            return [x[0], lerp(x[1], y[1], k), lerp(x[2], y[2], k), lerp(x[3], y[3], k), x[4] + wrapAngle(y[4] - x[4]) * k, k < 0.5 ? x[5] : y[5], lerp(x[6], y[6], k), y[7], y[8], y[9]];
          }),
          b: a.b.map((v, j) => (j < 4 ? lerp(v, b.b[j], k) : b.b[j])),
        };
      }
    }
    return f[f.length - 1];
  }
}

export class Session {
  constructor(opts) {
    this.mode = opts.mode || 'match';
    this.role = opts.role || 'offline';
    this.net = opts.net || null;
    this.roomKind = opts.roomKind || null; // 'pub' | 'priv'
    this.roomCode = opts.roomCode || null;
    this.profile = opts.profile; // { name, cos }
    this.onEvent = opts.onEvent || (() => {});
    this.rules = opts.rules || {};
    this.training = opts.training || null; // offline drills / tutorial controller
    this.localId = 1;
    this.world = null;
    this.view = { players: [], ball: createBall(), boxes: [], puddles: [], projs: [], walls: [], phase: 'kickoff', phaseT: 0, clock: 0, score: [0, 0], ot: 0, map: 'grass' };
    this.replay = new ReplayBuffer();
    this.goalT = 0;
    this.acc = 0;
    this.sendT = 0;
    this.snapT = 0;
    this.pingT = 0;
    this.rtt = 0.08;
    this.peerToPlayer = new Map();
    this.nextHumanId = 2;
    this.rosterSent = -1;
    this.intermission = 0;
    this.ended = false;
    this.lastEnd = null;
    this.destroyed = false;
    // client state
    this.snaps = [];
    this.roster = new Map();
    this.localP = null;
    this.cball = createBall();
    this.ownKickT = 0;
    this.predOwnT = 0;
    this.viewMap = new Map();
    this.lastSnap = null;
  }

  get isAuthority() { return this.role !== 'client'; }

  // ============================================================ HOST / OFFLINE
  startHost(rules = this.rules, warmup = false) {
    this.rules = { ...rules, map: rules.map || MAPS[Math.floor(Math.random() * MAPS.length)] };
    rules = this.rules;
    this.world = new World({ mode: this.mode, ...rules, itemPool: this.training ? this.training.itemPool : null });
    const w = this.world;
    const myTeam = this.mode === 'practice' ? 0 : (this.profile.team === 1 ? 1 : 0);
    w.addPlayer({ id: this.localId, name: this.profile.name, team: myTeam, cos: this.profile.cos, powers: this.profile.pw });
    if (this.mode === 'practice' && (!this.training || this.training.keeperBot)) {
      const k = w.addPlayer({ id: 999, name: 'Keeper', team: 1, isBot: true, cos: { skin: 2, hair: 'cap', hairColor: 5, jersey: 'classic', ball: 'classic', goalfx: 'confetti', number: 1 } });
      k.slot = 3; k.keeper = true;
    }
    if (this.training) this.training.attach(this);
    w.start(warmup);
    this.view.players = w.players;
    this.view.ball = w.ball;
    if (this.net && this.net.isHost) this.bindHostNet();
    this.flushWorldEvents();
  }

  // A running bot match becomes a public online room (instant play: no waiting in a lobby)
  goOnline(net, roomKind, roomCode) {
    this.net = net;
    this.role = 'host';
    this.roomKind = roomKind;
    this.roomCode = roomCode;
    this.rosterSent = -1;
    this.bindHostNet();
  }

  switchTeam() {
    if (this.isAuthority) { this.world.switchTeam(this.localId); this.flushWorldEvents(); return; }
    if (this.net) this.net.sendHost({ t: 'team' });
  }

  bindHostNet() {
    const net = this.net;
    net.on('hello', (peerId, msg) => {
      if (msg.ver !== GAME_VERSION) return { t: 'reject', why: 'version' };
      if (this.world.humans().length >= MAX_HUMANS) return { t: 'full', why: 'full' };
      const id = this.nextHumanId++;
      // Honour the team the player picked in the lobby when that side still has room
      let team = msg.team === 1 ? 1 : msg.team === 0 ? 0 : undefined;
      if (team !== undefined && this.world.teamCount(team, true) >= (this.world.rules.teamSize || 4)) team = 1 - team;
      const p = this.world.joinHuman({ id, name: sanitizeName(msg.name), cos: sanitizeCos(msg.cos), remote: true, team, powers: msg.pw });
      this.peerToPlayer.set(peerId, id);
      this.onEvent({ e: 'joined', id, name: p.name });
      return { t: 'w', you: id, mode: this.mode, rules: this.rules, roster: this.world.roster(), snap: this.world.snapshot(), code: this.roomCode, kind: this.roomKind, inter: this.intermission };
    });
    net.on('join', () => { this.rosterSent = -1; });
    net.on('leave', (peerId) => {
      const id = this.peerToPlayer.get(peerId);
      this.peerToPlayer.delete(peerId);
      if (id === undefined || !this.world) return;
      const p = this.world.byId.get(id);
      const name = p ? p.name : 'Player';
      this.world.leaveHuman(id);
      this.onEvent({ e: 'left', id, name });
      this.net.broadcast({ t: 'ev', l: [{ e: 'left', id, name }] });
    });
    net.on('message', (peerId, msg) => this.onHostMessage(peerId, msg));
  }

  onHostMessage(peerId, msg) {
    const id = this.peerToPlayer.get(peerId);
    if (id === undefined || !this.world) return;
    const p = this.world.byId.get(id);
    if (!p) return;
    switch (msg.t) {
      case 'st': this.world.applyRemoteState(p, msg); break;
      case 'a': if (msg.act && typeof msg.act === 'object') this.world.doAction(p, msg.act); break;
      case 'p': this.net.send(peerId, { t: 'P', ts: msg.ts }); break;
      case 'team': this.world.switchTeam(id); break;
      default:
    }
  }

  stepHost(dt) {
    const w = this.world;
    this.acc += dt;
    const step = 1 / 60;
    let n = 0;
    const maxSteps = this.net ? 60 : 6; // online rooms catch up on real time
    while (this.acc >= step && n < maxSteps) {
      w.step(step);
      if (this.training) this.training.step(step);
      this.acc -= step;
      n++;
    }
    if (n === maxSteps) this.acc = 0;
    this.flushWorldEvents();
    this.view.phase = w.phase; this.view.phaseT = w.phaseT; this.view.clock = w.clock;
    this.view.score = w.score; this.view.ot = w.overtime ? 1 : w.lastChance ? 2 : 0;
    this.view.boxes = w.boxes; this.view.puddles = w.puddles; this.view.projs = w.projs; this.view.walls = w.walls;
    this.view.map = w.map;
    this.view.targets = this.training ? this.training.targets : null;

    // Intermission (online rooms restart automatically so the room stays together)
    if (w.phase === 'end' && w.phaseT <= 0 && this.net && this.net.isHost && this.intermission <= 0 && !this._interStarted) {
      this._interStarted = true;
      this.intermission = 15;
      this.net.broadcast({ t: 'inter', s: this.intermission });
    }
    if (this.intermission > 0) {
      this.intermission -= dt;
      if (this.intermission <= 0) this.newMatch();
    }

    if (this.net && this.net.isHost) {
      this.snapT -= dt;
      this.rosterT = (this.rosterT || 0) - dt;
      if (this.rosterT <= 0) { this.rosterT = 2.5; this.rosterSent = -1; }
      if (w.rosterVer !== this.rosterSent) {
        const changed = this.rosterSent !== -1 || this._rv !== w.rosterVer;
        this.rosterSent = w.rosterVer;
        this._rv = w.rosterVer;
        this.net.broadcast({ t: 'r', roster: w.roster() });
        if (changed) this.onEvent({ e: 'roster' });
      }
      if (this.snapT <= 0) {
        this.snapT = 1 / NET.snapshotRate;
        if (this.net.conns.size) this.net.broadcast(w.snapshot());
      }
    }
  }

  flushWorldEvents() {
    const w = this.world;
    if (!w.events.length) return;
    const list = w.events.splice(0);
    if (this.net && this.net.isHost && this.net.conns.size) this.net.broadcast({ t: 'ev', l: list });
    for (const ev of list) {
      if (this.training) this.training.onEvent(ev);
      this.handleEvent(ev);
    }
  }

  beginMatch() {
    if (!this.isAuthority || !this.world || this.world.phase !== 'warmup') return;
    this.world.beginMatch();
    this.flushWorldEvents();
  }

  newMatch() {
    if (!this.isAuthority) return;
    const old = this.world;
    this._interStarted = false;
    this.intermission = 0;
    this.ended = false;
    const humans = old.humans().map((p) => ({ id: p.id, name: p.name, cos: p.cos, remote: p.remote, team: p.team, powers: p.powers }));
    this.rules = { ...this.rules, map: MAPS[Math.floor(Math.random() * MAPS.length)] };
    this.world = new World({ mode: this.mode, ...this.rules });
    const w = this.world;
    // Everyone keeps the team they chose (overflow moves to the other side)
    const counts = [0, 0];
    humans.forEach((h) => {
      let team = h.team === 1 ? 1 : 0;
      if (counts[team] >= 4) team = 1 - team;
      counts[team]++;
      const p = w.addPlayer({ id: h.id, name: h.name, team, remote: h.remote, cos: h.cos, powers: h.powers });
      p.remote = h.remote;
    });
    w.start();
    this.view.players = w.players;
    this.view.ball = w.ball;
    this.replay.clear();
    this.onEvent({ e: 'newmatch' });
    if (this.net && this.net.isHost) {
      for (const [peerId, id] of this.peerToPlayer) {
        this.net.send(peerId, { t: 'new', you: id, rules: this.rules, roster: w.roster(), snap: w.snapshot() });
      }
      this.rosterSent = w.rosterVer;
    }
    this.flushWorldEvents();
  }

  // ===================================================================== CLIENT
  startClient(welcome) {
    this.role = 'client';
    this.localId = welcome.you;
    this.mode = welcome.mode || 'match';
    this.rules = welcome.rules || {};
    this.roomCode = welcome.code || this.roomCode;
    this.roomKind = welcome.kind || this.roomKind;
    this.setRoster(welcome.roster);
    const me = this.roster.get(this.localId);
    this.localP = createPlayer({ id: this.localId, name: me ? me.name : this.profile.name, team: me ? me.team : 0, cos: me ? me.cos : this.profile.cos });
    this.snaps.length = 0;
    this.applySnapshot(welcome.snap, true);
    this.snapLocalFromSnap(welcome.snap);
    if (welcome.inter > 0) this.intermission = welcome.inter;
    this.net.on('message', (_, msg) => this.onClientMessage(msg));
    this.net.on('hostLost', () => this.onHostLost());
  }

  setRoster(list) {
    this.roster = new Map(list.map((r) => [r.id, r]));
    for (const id of [...this.viewMap.keys()]) if (!this.roster.has(id)) this.viewMap.delete(id);
    if (this.localP) {
      const me = this.roster.get(this.localId);
      if (me) { this.localP.team = me.team; this.localP.stats = me.stats; this.localP.slot = me.slot; }
    }
    this.onEvent({ e: 'roster' });
  }

  snapLocalFromSnap(s) {
    const row = s.p.find((r) => r[0] === this.localId);
    if (!row || !this.localP) return;
    const p = this.localP;
    p.x = row[1]; p.y = row[2]; p.z = row[3]; p.vx = 0; p.vz = 0; p.face = row[6];
  }

  onClientMessage(msg) {
    switch (msg.t) {
      case 's': this.applySnapshot(msg); break;
      case 'ev': for (const ev of msg.l || []) this.clientEvent(ev); break;
      case 'r': this.setRoster(msg.roster || []); break;
      case 'P': this.rtt = lerp(this.rtt, clamp(now() - msg.ts, 0.01, 1), 0.3); break;
      case 'inter': this.intermission = msg.s; break;
      case 'new':
        this.localId = msg.you;
        this.rules = msg.rules || this.rules;
        this.setRoster(msg.roster || []);
        this.localP = createPlayer({ id: this.localId, name: this.profile.name, team: (this.roster.get(this.localId) || {}).team || 0, cos: this.profile.cos });
        this.snaps.length = 0;
        this.applySnapshot(msg.snap, true);
        this.snapLocalFromSnap(msg.snap);
        this.cball = createBall();
        this.intermission = 0;
        this.ended = false;
        this.replay.clear();
        this.onEvent({ e: 'newmatch' });
        break;
      default:
    }
  }

  applySnapshot(s, first) {
    if (!s || !s.p) return;
    const t = now();
    this.snaps.push({ t, s });
    while (this.snaps.length > 40) this.snaps.shift();
    this.lastSnap = s;
    this.lastSnapT = t;
    if (this.snapNext) { this.snapNext = false; this.snapLocalFromSnap(s); }
    const v = this.view;
    v.phase = s.ph; v.phaseT = s.pt; v.clock = s.c; v.score = s.sc; v.ot = s.ot;
    v.boxes = s.bx.map((x) => ({ id: x[0], x: x[1], z: x[2], c: x[3] }));
    v.puddles = s.pu.map((x) => ({ id: x[0], x: x[1], z: x[2], r: x[3], life: x[4] }));
    v.projs = s.pr.map((x) => ({ id: x[0], x: x[1], y: x[2], z: x[3], k: x[4], ang: x[5], spin: x[6] }));
    v.walls = (s.wl || []).map((x) => ({ id: x[0], x: x[1], z: x[2], ang: x[3], life: x[4], hw: 2.4, hd: 0.35, h: 1.7 }));
    v.map = s.mp || v.map;
    const me = s.p.find((r) => r[0] === this.localId);
    if (me && this.localP) {
      const p = this.localP;
      p.items[0] = me[12] || null; p.items[1] = me[13] || null;
      if (p.equip >= 0 && !p.items[p.equip]) p.equip = -1;
      p.fx.fire = me[17]; p.fx.speed = me[18]; p.fx.shield = me[19]; p.fx.oil = me[21] || 0;
      if (me[20] > 0 && p.fx.jet <= 0) p.fx.jet = me[20];
      if (me[20] <= 0) p.fx.jet = Math.min(p.fx.jet, 0.2);
      p.req = (me[11] & 4) ? Math.max(p.req, 0.1) : p.req;
      p.keeper = !!(me[11] & 256);
      p.chat = me[16]; p.chatT = me[16] >= 0 ? 1 : 0;
    }
    if (first) {
      const b = s.b;
      Object.assign(this.cball, { x: b[0], y: b[1], z: b[2], vx: b[3], vy: b[4], vz: b[5], owner: b[6], fire: !!b[7] });
    }
  }

  clientEvent(ev) {
    const p = this.localP;
    if (ev.e === 'stun' && ev.id === this.localId && p) {
      stunPlayer(p, ev.k, ev.d);
      p.vx = ev.kx || 0; p.vz = ev.kz || 0;
      if (ev.k === 'fall' || ev.k === 'hit') p.vy = 4;
      this.predOwnT = 0;
      if (this.cball.owner === this.localId) this.cball.owner = -1;
    } else if (ev.e === 'reset' && p) {
      const row = ev.pos.find((r) => r[0] === this.localId);
      if (row) { p.x = row[1]; p.z = row[2]; p.face = row[3]; p.vx = p.vz = 0; p.y = 0; p.anim = 'idle'; p.actT = 0; p.stun = 0; p.knockT = 0; p.charging = false; p.bikeT = 0; if (row[4] !== undefined) p.slot = row[4]; p.keeper = !!row[5]; }
      this.cball = createBall();
      this.ownKickT = 0; this.predOwnT = 0; this.bikeLocalT = 0;
    } else if (ev.e === 'own' && ev.id !== this.localId) {
      this.predOwnT = 0;
    } else if (ev.e === 'teamswitch' && ev.id === this.localId && p) {
      p.team = ev.team;
      this.snapNext = true; // the host moved us: take the next snapshot position
    }
    this.handleEvent(ev);
  }

  onHostLost() {
    if (this.destroyed) return;
    // Host left: continue the match offline against bots with the current score/clock.
    const last = this.lastSnap;
    this.role = 'offline';
    try { this.net.close(); } catch (e) { /* ignore */ }
    this.net = null;
    const me = this.localP;
    const team = me ? me.team : 0;
    this.world = new World({ mode: this.mode, ...this.rules, map: this.view.map });
    const w = this.world;
    const p = w.addPlayer({ id: this.localId, name: this.profile.name, team, cos: this.profile.cos, powers: this.profile.pw });
    w.start();
    if (last) {
      w.score = [...last.sc];
      w.clock = last.c > 0 ? last.c : 60;
      if (last.ot === 1) w.overtime = true;
    }
    if (me) { p.x = me.x; p.z = me.z; p.face = me.face; p.items = [...me.items]; }
    this.view.players = w.players;
    this.view.ball = w.ball;
    this.onEvent({ e: 'hostlost' });
    this.flushWorldEvents();
  }

  stepClient(dt) {
    const p = this.localP;
    if (!p) return;
    const v = this.view;
    const frozen = v.phase === 'kickoff';
    // Own player prediction
    const hasBall = this.cball.owner === this.localId || this.predOwnT > 0;
    if (p.zipT > 0) { const dx = this.cball.x - p.x, dz = this.cball.z - p.z, d = len2(dx, dz) || 1; p.zipX = dx / d; p.zipZ = dz / d; if (d < 1.6) p.zipT = 0; }
    if (v.phase !== 'replay') movePlayer(p, dt, hasBall, frozen || v.phase === 'end', v.phase !== 'play');
    if (this.cball.owner === this.localId && this.cball.held && p.keeper) clampInOwnBox(p);
    this.collideLocal(p);

    // Interpolate others
    this.interpolate();

    // Ball
    this.stepClientBall(dt);

    // Send state
    this.sendT -= dt;
    if (this.sendT <= 0 && this.net) {
      this.sendT = 1 / NET.inputRate;
      this.net.sendHost({
        t: 'st', x: r2(p.x), y: r2(p.y), z: r2(p.z), vx: r2(p.vx), vz: r2(p.vz), f: r2(p.face),
        sp: p.sprinting ? 1 : 0, st: Math.round(p.stamina), ch: p.charging ? 1 : 0, an: p.anim,
        sx: r2(p.slideX), sz: r2(p.slideZ), yaw: r2(p.in.yaw), pitch: r2(p.in.pitch),
      });
    }
    this.pingT -= dt;
    if (this.pingT <= 0 && this.net) { this.pingT = 2; this.net.sendHost({ t: 'p', ts: now() }); }
    if (this.intermission > 0) this.intermission -= dt;
  }

  collideLocal(p) {
    const r2x = PLAYER.radius * 2;
    for (const q of this.view.players) {
      if (q.id === this.localId) continue;
      const dx = p.x - q.x, dz = p.z - q.z;
      const d = len2(dx, dz);
      if (d < r2x && d > 0.001 && Math.abs(p.y - q.y) < 1.8) {
        p.x += (dx / d) * (r2x - d) * 0.6;
        p.z += (dz / d) * (r2x - d) * 0.6;
      }
    }
    if (this.view.walls.length) World.prototype.collideWallsCircle.call({ walls: this.view.walls, emit() {} }, p, PLAYER.radius, false);
  }

  interpolate() {
    const rt = now() - NET.interpDelay - Math.min(0.1, this.rtt * 0.25);
    const snaps = this.snaps;
    if (!snaps.length) return;
    let a = snaps[0], b = snaps[snaps.length - 1];
    for (let i = snaps.length - 1; i > 0; i--) {
      if (snaps[i - 1].t <= rt) { a = snaps[i - 1]; b = snaps[i]; break; }
    }
    const k = b.t > a.t ? clamp((rt - a.t) / (b.t - a.t), 0, 1.2) : 1;
    const amap = new Map(a.s.p.map((r) => [r[0], r]));
    const list = [];
    for (const rb of b.s.p) {
      const id = rb[0];
      if (id === this.localId) { list.push(this.localP); continue; }
      const ra = amap.get(id) || rb;
      let o = this.viewMap.get(id);
      const ros = this.roster.get(id);
      if (!o) {
        o = { id, fx: { fire: 0, speed: 0, shield: 0, jet: 0, oil: 0, magnet: 0 }, items: [null, null], stats: {}, in: { yaw: 0 } };
        this.viewMap.set(id, o);
      }
      o.name = ros ? ros.name : 'Player';
      o.team = ros ? ros.team : 0;
      o.cos = ros ? ros.cos : this.profile.cos;
      o.isBot = ros ? !!ros.bot : true;
      o.keeper = !!(rb[11] & 256);
      o.stats = ros ? ros.stats : o.stats;
      o.x = lerp(ra[1], rb[1], k); o.y = lerp(ra[2], rb[2], k); o.z = lerp(ra[3], rb[3], k);
      o.vx = rb[4]; o.vz = rb[5];
      o.face = ra[6] + wrapAngle(rb[6] - ra[6]) * k;
      const an = animName(rb[7]);
      if (o.anim !== an) { o.anim = an; o.animT = rb[8]; } else o.animT = rb[8] + (rt - b.t > 0 ? rt - b.t : 0);
      o.stamina = rb[9]; o.charge = rb[10];
      const fl = rb[11];
      o.sprinting = !!(fl & 1); o.charging = !!(fl & 2); o.req = fl & 4 ? 1 : 0; o.immune = fl & 128 ? 1 : 0;
      o.fx.fire = rb[17]; o.fx.speed = rb[18]; o.fx.shield = rb[19]; o.fx.jet = rb[20]; o.fx.oil = rb[21] || 0;
      o.items[0] = rb[12] || null; o.items[1] = rb[13] || null;
      o.stun = rb[14]; o.emote = rb[15] || ''; o.chat = rb[16]; o.chatT = rb[16] >= 0 ? 1 : 0;
      o.aimYaw = rb[22] ?? o.face; o.aimPitch = rb[23] ?? 0.28;
      list.push(o);
    }
    if (!list.includes(this.localP)) list.push(this.localP);
    this.view.players = list;
  }

  stepClientBall(dt) {
    const s = this.lastSnap;
    if (!s) return;
    const cb = this.cball;
    const sb = s.b;
    const srvOwner = sb[6];
    if (this.ownKickT > 0) this.ownKickT -= dt;
    if (this.predOwnT > 0) this.predOwnT -= dt;
    const me = this.localP;
    const events = [];

    cb.bike = this.bikeLocalT > 0 ? this.localId : (sb[12] ?? -1);
    if (srvOwner === this.localId && this.ownKickT <= 0) {
      cb.owner = this.localId;
      this.predOwnT = 0;
    } else if (srvOwner >= 0 && srvOwner !== this.localId && this.ownKickT <= 0) {
      cb.owner = srvOwner;
      this.predOwnT = 0;
    } else if (this.predOwnT > 0) {
      cb.owner = this.localId;
    } else if (this.bikeLocalT > 0 || (sb[12] >= 0 && this.ownKickT <= 0)) {
      // Bicycle kick hang time: the ball floats in place
      cb.owner = -1;
      if (this.bikeLocalT > 0) { this.bikeLocalT -= dt; cb.y += (this.bikeBallY - cb.y) * Math.min(1, dt * 7); }
      else { const k = clamp(dt * 10, 0, 1); cb.x += (sb[0] - cb.x) * k; cb.y += (sb[1] - cb.y) * k; cb.z += (sb[2] - cb.z) * k; }
      cb.vx = 0; cb.vy = 0; cb.vz = 0;
    } else {
      if (cb.owner >= 0) {
        // Was attached - continue from server state
        cb.owner = -1;
        Object.assign(cb, { x: sb[0], y: sb[1], z: sb[2], vx: sb[3], vy: sb[4], vz: sb[5] });
      }
      stepBall(cb, dt, events);
      if (this.view.walls.length) World.prototype.collideWallsCircle.call({ walls: this.view.walls, emit() {} }, cb, PHYS.ballR, true);
      if (this.ownKickT <= 0) {
        // Server reconciliation: extrapolate server ball to "now" and blend toward it
        const ahead = clamp(now() - this.lastSnapT + this.rtt * 0.5, 0, 0.3);
        const ghost = { ...createBall(), x: sb[0], y: sb[1], z: sb[2], vx: sb[3], vy: sb[4], vz: sb[5], owner: -1 };
        let tt = ahead;
        while (tt > 0) { const st = Math.min(1 / 60, tt); stepBall(ghost, st, []); tt -= st; }
        const ex = ghost.x - cb.x, ey = ghost.y - cb.y, ez = ghost.z - cb.z;
        const err = Math.hypot(ex, ey, ez);
        if (err > 6) { Object.assign(cb, { x: ghost.x, y: ghost.y, z: ghost.z }); }
        else {
          const k = clamp(dt * 7, 0, 1);
          cb.x += ex * k; cb.y += ey * k; cb.z += ez * k;
        }
        cb.vx = lerp(cb.vx, ghost.vx, 0.3); cb.vy = lerp(cb.vy, ghost.vy, 0.3); cb.vz = lerp(cb.vz, ghost.vz, 0.3);
      }
      // Predict our own pickup
      if (me && this.view.phase === 'play' && me.stun <= 0 && canAct(me) && srvOwner < 0 && sb[9] < 0 && !sb[13]) {
        const d = len2(cb.x - me.x, cb.z - me.z);
        const spd = Math.hypot(cb.vx, cb.vy, cb.vz);
        if (d < PLAYER.pickupReach * 0.9 && cb.y < 1.4 && spd < 22 && this.ownKickT <= -0.1) this.predOwnT = 0.45;
      }
    }
    cb.fire = !!sb[7];
    cb.phase = sb[13] ? 1 : null;
    cb.grapple = sb[9];
    cb.held = !!sb[10] && cb.owner === srvOwner;
    cb.holdT = sb[11] || 0;
    if (cb.owner >= 0) {
      const o = cb.owner === this.localId ? me : this.viewMap.get(cb.owner);
      if (o) {
        const d = cb.held ? 0.72 : PLAYER.dribbleDist;
        const sp = len2(o.vx || 0, o.vz || 0);
        cb.x = o.x + Math.sin(o.face) * d; cb.z = o.z + Math.cos(o.face) * d;
        cb.y = cb.held ? (o.y || 0) + 1.35 : PHYS.ballR + (o.y || 0) + (sp > 1 ? Math.abs(Math.sin(now() * 9)) * 0.12 : 0);
        cb.vx = o.vx || 0; cb.vz = o.vz || 0; cb.vy = 0;
        cb.spin += sp * dt / PHYS.ballR;
      }
    }
    if (cb.grapple >= 0) {
      // Show the server ball while it's being yanked
      cb.x = lerp(cb.x, sb[0], 0.5); cb.y = lerp(cb.y, sb[1], 0.5); cb.z = lerp(cb.z, sb[2], 0.5);
    }
    this.view.ball = cb;
    for (const ev of events) if (ev.e === 'bounce' || ev.e === 'wall') this.handleEvent({ ...ev, local: 1 });
  }

  // Client: optimistic local application of our own action.
  predictAction(act) {
    const p = this.localP;
    const v = this.view;
    if (!p) return;
    const a = act.a;
    if (a === 'charge') { p.charging = !!act.on && canAct(p); if (!p.charging) p.charge = 0; return; }
    if (a === 'emote') { if (canAct(p) && this.cball.owner !== this.localId) { setAnim(p, 'emote', 3.2); p.emote = act.id; } return; }
    if (a === 'chat') { p.chat = act.i; p.chatT = 4; return; }
    if (v.phase !== 'play' && v.phase !== 'goal') return;
    if (!canAct(p)) return;
    const cb = this.cball;
    const mine = cb.owner === this.localId || this.predOwnT > 0;
    const near = len2(cb.x - p.x, cb.z - p.z) < KICK.hitRange && cb.y < 2.6 + p.y && (cb.owner < 0 || mine);
    const rel = cb.y - (p.y || 0);
    const reach = cb.owner < 0 && !cb.phase && rel < KICK.volleyReachUp && len2(cb.x - p.x, cb.z - p.z) < KICK.volleyReachH;
    const bikeBy = cb.bike >= 0 ? v.players.find((q) => q && q.id === cb.bike) : null;
    // Someone else's bicycle kick can't be volleyed away, only intercepted by a rival's own bicycle kick
    const volleyable = reach && cb.y > 1.05 && rel > 0.3 && !(cb.bike >= 0 && cb.bike !== this.localId);
    const bikeable = reach && (p.y || 0) >= KICK.bikeAirY && rel > KICK.bikeMinH && (!(cb.bike >= 0) || (cb.bike !== this.localId && bikeBy && bikeBy.team !== p.team));
    const launch = (kind, fire) => {
      const k = kickVelocity(p, act, v.players, fire);
      if (mine) { cb.x = p.x + Math.sin(p.face) * PLAYER.dribbleDist; cb.z = p.z + Math.cos(p.face) * PLAYER.dribbleDist; cb.y = cb.held ? p.y + 1.35 : PHYS.ballR + p.y; cb.held = false; }
      cb.owner = -1;
      cb.vx = k.vx; cb.vy = k.vy; cb.vz = k.vz; cb.curve = k.curve; cb.inNet = 0;
      this.ownKickT = 0.4; this.predOwnT = 0;
      this.handleEvent({ e: 'kick', id: this.localId, kind, pw: k.pw, fire: fire ? 1 : 0, local: 1 });
    };
    switch (a) {
      case 'bike':
        if (p.cd.kick > 0 || !bikeable) return;
        p.charging = false; p.charge = 0;
        this.bikeBallY = Math.max(cb.y, KICK.bikeBallY);
        p.bikeT = KICK.bikeHold; p.bikeY = clamp(this.bikeBallY - 1.9, 0.5, 4);
        setAnim(p, 'bike', KICK.bikeHold + 0.6);
        cb.vx = 0; cb.vy = 0; cb.vz = 0; cb.curve = 0;
        this.bikeLocalT = KICK.bikeHold + 0.2;
        break;
      case 'kick': {
        p.charging = false; p.charge = 0;
        if (p.cd.kick > 0) return;
        p.cd.kick = KICK.cooldown;
        const fromBike = p.anim === 'bike';
        p.bikeT = 0; this.bikeLocalT = 0;
        if (volleyable && !mine) { act = { ...act, volley: 1, pw: Math.max(act.pw || 0, 0.85), sx: cb.x, sy: cb.y, sz: cb.z }; }
        setAnim(p, volleyable && (fromBike || rel > 1.9) ? 'volley' : 'kick', volleyable ? 0.5 : 0.38);
        if (fromBike) p.animT = 0.12;
        if (mine || near || volleyable) { launch('shot', p.fx.fire > 0); spendStamina(p, STAMINA.kickBase + STAMINA.kickPower * clamp(act.pw || 0, 0, 1)); }
        break;
      }
      case 'pass': if (p.cd.pass > 0 || !(mine || near)) return; p.cd.pass = KICK.cooldown; setAnim(p, 'pass', 0.3); launch('pass'); spendStamina(p, STAMINA.pass); break;
      case 'lob': if (p.cd.lob > 0 || !(mine || near)) return; p.cd.lob = KICK.cooldown; setAnim(p, 'kick', 0.38); launch('lob'); spendStamina(p, STAMINA.lob); break;
      case 'flick': if (p.cd.flick > 0 || !(mine || near)) return; p.cd.flick = 0.8; setAnim(p, 'flick', 0.35); launch('flick'); spendStamina(p, STAMINA.flick); break;
      case 'dive':
      case 'tackle': {
        if (mine) return;
        const ml = len2(act.mx || 0, act.mz || 0);
        if (a === 'dive' && !(p.keeper && inOwnBox(p, 0.6))) return;
        if (p.keeper && inOwnBox(p, 0.6)) {
          if (p.cd.dive > 0) return;
          p.cd.dive = KICK.diveCooldown;
          let dx = cb.x - p.x, dz = cb.z - p.z, dl = len2(dx, dz);
          if (ml > 0.2 && (dl > 12 || dl < 0.5)) { dx = act.mx; dz = act.mz; dl = ml; }
          if (dl < 0.01) { dx = Math.sin(p.face); dz = Math.cos(p.face); dl = 1; }
          p.slideX = dx / dl; p.slideZ = dz / dl; p.face = Math.atan2(p.slideX, p.slideZ); p.vy = 6;
          setAnim(p, 'dive', KICK.diveTime);
          return;
        }
        if (p.cd.tackle > 0) return;
        p.cd.tackle = KICK.tackleCooldown;
        spendStamina(p, STAMINA.tackle);
        if (ml > 0.2) { p.slideX = act.mx / ml; p.slideZ = act.mz / ml; } else { p.slideX = Math.sin(p.face); p.slideZ = Math.cos(p.face); }
        p.face = Math.atan2(p.slideX, p.slideZ);
        setAnim(p, 'slide', KICK.tackleTime);
        break;
      }
      case 'dribble': {
        if (p.cd.dribble > 0) return;
        p.cd.dribble = KICK.dribbleCooldown;
        const ml = len2(act.mx || 0, act.mz || 0);
        if (ml > 0.2) { p.slideX = act.mx / ml; p.slideZ = act.mz / ml; } else { p.slideX = Math.sin(p.face); p.slideZ = Math.cos(p.face); }
        if (mine) {
          if (cb.held) { p.cd.dribble = 0.3; return; }
          setAnim(p, 'spin', 0.42); p.immune = KICK.dribbleImmune;
        } else {
          p.cd.dribble = KICK.jumpCooldown;
          if (p.y > 0.05 || p.fx.jet > 0) return;
          spendStamina(p, STAMINA.jump);
          p.vy = KICK.jumpSpeed; setAnim(p, 'jump', 0.75);
        }
        break;
      }
      case 'request': if (p.cd.request > 0) return; p.cd.request = KICK.requestCooldown; p.req = 2.5; break;
      case 'item': {
        const kind = p.items[act.slot === 1 ? 1 : 0];
        if (!kind) return;
        if (['ice', 'grapple', 'punch', 'flintlock', 'bazooka', 'shotgun', 'mines', 'barricade'].includes(kind)) setAnim(p, 'throw', 0.32);
        if (kind === 'grapple') { const d = len2(cb.x - p.x, cb.z - p.z); if (d < 36) { p.zipT = Math.min(1.1, d / 34 + 0.15); } }
        if (kind === 'magnet') p.fx.magnet = 3.5;
        if (kind === 'jet') { p.fx.jet = 3.2; p.vy = 9; }
        if (kind === 'speed') { p.fx.speed = 6; p.stamina = PLAYER.staminaMax; }
        if (kind === 'shield') p.fx.shield = 7;
        if (kind === 'fire') p.fx.fire = 10;
        p.items[act.slot === 1 ? 1 : 0] = null;
        p.equip = -1;
        break;
      }
      default:
    }
  }

  // ===================================================================== COMMON
  get me() {
    if (this.isAuthority) return this.world ? this.world.byId.get(this.localId) : null;
    return this.localP;
  }

  hasBall() {
    const b = this.view.ball;
    return b && (b.owner === this.localId || (this.role === 'client' && this.predOwnT > 0));
  }

  // Called by the game each frame with the local player's control state.
  setInput(inp) {
    const p = this.me;
    if (!p) return;
    p.in.mx = inp.mx; p.in.mz = inp.mz; p.in.sprint = inp.sprint;
    p.in.yaw = inp.yaw; p.in.pitch = inp.pitch;
  }

  action(act) {
    const p = this.me;
    if (!p) return;
    if (this.isAuthority) {
      this.world.doAction(p, act);
      this.flushWorldEvents();
    } else {
      this.predictAction(act);
      if (this.net) this.net.sendHost({ t: 'a', act });
    }
  }

  update(dt) {
    if (this.destroyed) return;
    if (this.isAuthority) this.stepHost(dt);
    else this.stepClient(dt);
    const t = now();
    if (this.view.phase !== 'replay') this.replay.record(t, this.view);
  }

  handleEvent(ev) {
    if (ev.e === 'goal') this.goalT = now();
    if (ev.e === 'end') { this.ended = true; this.lastEnd = ev; }
    this.onEvent(ev);
  }

  replayFrame(progress) {
    // progress 0..1 across the replay phase
    const start = this.goalT - 3.4, end = this.goalT + 0.7;
    return this.replay.sample(lerp(start, end, progress));
  }

  playerById(id) {
    if (this.isAuthority) return this.world.byId.get(id);
    if (id === this.localId) return this.localP;
    return this.viewMap.get(id);
  }

  playerName(id) {
    const p = this.playerById(id);
    if (p) return p.name;
    const r = this.roster.get(id);
    return r ? r.name : 'Player';
  }

  statsTable() {
    if (this.isAuthority) return this.world.statsTable();
    return [...this.roster.values()].map((r) => ({ id: r.id, name: r.name, team: r.team, bot: r.bot, ...(r.stats || {}) }));
  }

  humanCount() {
    if (this.isAuthority) return this.world.humans().length;
    return [...this.roster.values()].filter((r) => !r.bot).length;
  }

  destroy() {
    this.destroyed = true;
    if (this.net) { try { this.net.close(); } catch (e) { /* ignore */ } }
    this.net = null;
  }
}

export function inOwnBox(p, tol = 0) {
  const s = p.team === 0 ? -1 : 1;
  return p.x * s > FIELD.halfL - FIELD.boxL - tol && Math.abs(p.z) < FIELD.boxW / 2 + tol;
}

export { MATCH };
