// Authoritative game world. Runs on the host (or offline) and produces snapshots + events.
import { FIELD, PHYS, PLAYER, KICK, MATCH, ITEM_KINDS, STAMINA } from '../config.js';
import { createPlayer, movePlayer, separatePlayers, canAct, setAnim, stunPlayer, spendStamina, staminaPowerMul } from './player.js';
import { createBall, stepBall, predictCross, updateGoalLine } from './ball.js';
import { clamp, len2, rand, wrapAngle, r2 } from '../util/math.js';
import { botName, randomCosmetics } from '../cosmetics.js';
import { BotBrain } from './bots.js';

export const ANIM_CODES = ['idle', 'kick', 'pass', 'flick', 'slide', 'recover', 'dive', 'getup', 'fall', 'slip', 'frozen', 'hit', 'spin', 'dodge', 'celebrate', 'emote', 'punch', 'throw', 'cheer', 'sad', 'jump', 'volley', 'bike'];
const ANIM_INDEX = Object.fromEntries(ANIM_CODES.map((a, i) => [a, i]));

let nextBotId = 1000;

// How far a ball will travel from now: runs the ball physics until it hits a post, net or wall,
// or slows to a crawl, and measures the ground covered
function flightDistance(b) {
  const sim = { ...createBall(), x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz, curve: b.curve || 0 };
  const ev = [];
  let dist = 0;
  for (let i = 0; i < 150; i++) {
    const x0 = sim.x, z0 = sim.z;
    stepBall(sim, 1 / 30, ev);
    dist += len2(sim.x - x0, sim.z - z0);
    if (sim.inNet || ev.some((e) => e.e !== 'bounce') || len2(sim.vx, sim.vz) < 3) break;
  }
  return dist;
}

export class World {
  constructor(opts = {}) {
    this.mode = opts.mode || 'match';
    this.rules = {
      duration: opts.duration ?? MATCH.duration,
      mercy: opts.mercy ?? MATCH.mercy,
      overtime: opts.overtime ?? true,
      lastChance: opts.lastChance ?? true,
      replays: opts.replays ?? true,
      teamSize: opts.teamSize ?? MATCH.teamSize,
    };
    this.itemMul = opts.itemMul || 1; // Item Frenzy event: cubes drop more often
    this.players = [];
    this.byId = new Map();
    this.ball = createBall();
    this.boxes = [];
    this.puddles = [];
    this.projs = [];
    this.walls = [];
    this.map = opts.map || 'grass';
    this.events = [];
    this.score = [0, 0];
    this.phase = 'kickoff';
    this.phaseT = MATCH.kickoffTime;
    this.clock = this.mode === 'practice' ? 0 : this.rules.duration;
    this.overtime = false;
    this.lastChance = false;
    this.lastChanceT = 0;
    this.kickTeam = 0;
    this.time = 0;
    this.tick = 0;
    this.nextItemT = 4;
    this.uid = 1;
    this.lastGoal = null;
    this.result = null;
    this.brains = new Map();
    this.hooks = {}; // training drills: { kickoff(world) }
    this.itemPool = opts.itemPool || null; // practice override (e.g. "try" a single power)
    this.noAutoItems = false; // drills without mystery cubes
    this.practiceGoalT = 1.6;
  }

  emit(ev) { this.events.push(ev); }

  // ---------------------------------------------------------------- roster
  addPlayer({ id, name, team, isBot = false, remote = false, cos, powers }) {
    const slot = this.freeSlot(team);
    const p = createPlayer({ id, name, team, slot, isBot, remote, cos });
    p.powers = sanitizePowers(powers);
    this.players.push(p);
    this.byId.set(id, p);
    if (isBot) this.brains.set(id, new BotBrain(p, this));
    this.placeAtFormation(p);
    this.rosterVer = (this.rosterVer || 0) + 1;
    return p;
  }

  freeSlot(team) {
    const used = new Set(this.players.filter((q) => q.team === team).map((q) => q.slot));
    for (let s = 0; s < 8; s++) if (!used.has(s)) return s;
    return 0;
  }

  removePlayer(id) {
    const p = this.byId.get(id);
    if (!p) return;
    if (this.ball.owner === id) this.ball.owner = -1;
    this.players.splice(this.players.indexOf(p), 1);
    this.byId.delete(id);
    this.brains.delete(id);
    this.rosterVer = (this.rosterVer || 0) + 1;
  }

  humans() { return this.players.filter((p) => !p.isBot); }
  teamCount(team, humansOnly = false) {
    return this.players.filter((p) => p.team === team && (!humansOnly || !p.isBot)).length;
  }

  // Choose team for a new human: the team with fewer humans (then fewer players).
  teamForHuman() {
    const h0 = this.teamCount(0, true), h1 = this.teamCount(1, true);
    if (h0 !== h1) return h0 < h1 ? 0 : 1;
    return this.score[0] <= this.score[1] ? 0 : 1;
  }

  // Human joins: replace a bot on that team (keeps its slot/position) or add a new player.
  joinHuman({ id, name, cos, remote, team, powers }) {
    if (team === undefined) team = this.teamForHuman();
    const bot = this.players.filter((p) => p.team === team && p.isBot).sort((a, b) => a.slot - b.slot)[0];
    if (bot) {
      const slot = bot.slot;
      const pos = { x: bot.x, z: bot.z, face: bot.face };
      const keeper = bot.keeper, wasIn = bot.wasInBox;
      this.removePlayer(bot.id);
      const p = this.addPlayer({ id, name, team, remote, cos, powers });
      p.slot = slot;
      p.keeper = keeper; p.wasInBox = wasIn;
      if (this.phase === 'kickoff') this.placeAtFormation(p);
      else { p.x = pos.x; p.z = pos.z; p.face = pos.face; }
      return p;
    }
    return this.addPlayer({ id, name, team, remote, cos, powers });
  }

  // Lobby team switch: swap places with a bot on the other team (only if that team has one)
  switchTeam(id) {
    const p = this.byId.get(id);
    if (!p || p.isBot) return false;
    const to = 1 - p.team;
    const bot = this.players.filter((q) => q.team === to && q.isBot).sort((a, b) => b.slot - a.slot)[0];
    if (!bot) return false;
    if (this.ball.owner === p.id || this.ball.owner === bot.id) this.ball.owner = -1;
    const a = { x: p.x, z: p.z, face: p.face, slot: p.slot, keeper: p.keeper };
    p.team = to; p.x = bot.x; p.z = bot.z; p.face = bot.face; p.slot = bot.slot; p.keeper = bot.keeper;
    bot.team = 1 - to; bot.x = a.x; bot.z = a.z; bot.face = a.face; bot.slot = a.slot; bot.keeper = a.keeper;
    p.wasInBox = this.inOwnBox(p); bot.wasInBox = this.inOwnBox(bot);
    this.rosterVer = (this.rosterVer || 0) + 1;
    this.emit({ e: 'teamswitch', id: p.id, team: to });
    return true;
  }

  fillBots() {
    if (this.mode === 'practice') return;
    for (const team of [0, 1]) {
      while (this.teamCount(team) < this.rules.teamSize) {
        const id = nextBotId++;
        this.addPlayer({ id, name: botName(id), team, isBot: true, cos: randomCosmetics() });
      }
      // Too many (e.g. after team change) -> drop bots
      while (this.teamCount(team) > this.rules.teamSize) {
        const bot = this.players.filter((p) => p.team === team && p.isBot).pop();
        if (!bot) break;
        this.removePlayer(bot.id);
      }
    }
  }

  // Human leaves: replace with a bot at the same slot.
  leaveHuman(id) {
    const p = this.byId.get(id);
    if (!p) return;
    const { team, slot, x, z, face, keeper, wasInBox } = p;
    this.removePlayer(id);
    if (this.mode === 'practice') return;
    const bid = nextBotId++;
    const bot = this.addPlayer({ id: bid, name: botName(bid), team, isBot: true, cos: randomCosmetics() });
    bot.slot = slot; bot.x = x; bot.z = z; bot.face = face; bot.keeper = keeper; bot.wasInBox = wasInBox;
  }

  // ------------------------------------------------------------- formation
  formationPos(p, kicking) {
    const s = p.team === 0 ? -1 : 1; // side the team defends
    if (this.mode === 'practice') {
      if (p.isBot) return { x: FIELD.halfL - 1.6, z: 0 };
      return { x: -6, z: 0 };
    }
    const slot = p.slot % 4;
    const extra = Math.floor(p.slot / 4);
    const spots = [
      kicking ? [1.6, 0] : [10.5, 0],
      [23, -14],
      [23, 14],
      [FIELD.halfL - 2.4, 0],
    ];
    const [fx, fz] = spots[slot];
    return { x: s * fx, z: fz + extra * 6 };
  }

  placeAtFormation(p) {
    const pos = this.formationPos(p, p.team === this.kickTeam);
    p.x = pos.x; p.z = pos.z; p.y = 0;
    p.vx = p.vy = p.vz = 0;
    p.face = p.team === 0 ? Math.PI / 2 : -Math.PI / 2;
    if (this.mode === 'practice' && !p.isBot) p.face = Math.PI / 2;
    p.stun = 0; p.knockT = 0; p.anim = 'idle'; p.actT = 0; p.charging = false; p.charge = 0;
    p.fx.jet = 0; p.bikeT = 0;
  }

  resetKickoff(kickTeam) {
    this.kickTeam = kickTeam;
    if (this.mode !== 'practice') this.shufflePositions();
    for (const p of this.players) this.placeAtFormation(p);
    const b = this.ball;
    Object.assign(b, createBall());
    if (this.mode === 'practice') { b.x = -3; b.z = 0; }
    this.projs.length = 0;
    this.walls.length = 0;
    this.puddles.length = 0;
    if (this.hooks.kickoff) this.hooks.kickoff(this);
    for (const p of this.players) p.wasInBox = this.inOwnBox(p);
    this.rosterVer = (this.rosterVer || 0) + 1;
    this.emit({ e: 'reset', pos: this.players.map((p) => [p.id, r2(p.x), r2(p.z), r2(p.face), p.slot, p.keeper ? 1 : 0]) });
  }

  // Every kickoff (start + after each goal) everyone gets a random position on their team.
  // Whoever lands on the goalkeeper spot starts the play as the keeper.
  shufflePositions() {
    for (const team of [0, 1]) {
      const mem = this.players.filter((p) => p.team === team);
      if (mem.length > 4) continue;
      const slots = [0, 1, 2, 3];
      for (let i = slots.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [slots[i], slots[j]] = [slots[j], slots[i]]; }
      mem.forEach((p, i) => { p.slot = slots[i]; p.keeper = slots[i] === 3; });
    }
  }

  // Keeper status follows the penalty box: a keeper who walks out loses it, and the NEXT
  // teammate to walk into the box becomes the new keeper.
  updateKeepers() {
    for (const team of [0, 1]) {
      const mem = this.players.filter((p) => p.team === team && !p.left);
      let keeper = mem.find((p) => p.keeper) || null;
      const inBox = new Map(mem.map((p) => [p.id, this.inOwnBox(p, p === keeper ? 0.6 : 0)]));
      if (keeper && !inBox.get(keeper.id)) {
        keeper.keeper = false;
        this.emit({ e: 'keeper', team, id: -1, prev: keeper.id });
        keeper = null;
        this.rosterVer = (this.rosterVer || 0) + 1;
      }
      if (!keeper) {
        const next = mem.find((p) => inBox.get(p.id) && !p.wasInBox);
        if (next) {
          next.keeper = true;
          this.emit({ e: 'keeper', team, id: next.id });
          this.rosterVer = (this.rosterVer || 0) + 1;
        }
      }
      for (const p of mem) p.wasInBox = inBox.get(p.id);
    }
  }

  setPhase(ph, t) {
    this.phase = ph;
    this.phaseT = t;
    this.emit({ e: 'phase', ph });
  }

  start(warmup = false) {
    if (warmup) {
      this.resetKickoff(0);
      this.setPhase('warmup', 0);
      return;
    }
    this.fillBots();
    this.resetKickoff(Math.random() < 0.5 ? 0 : 1);
    this.setPhase('kickoff', this.mode === 'practice' ? 0.5 : MATCH.kickoffTime);
  }

  // Private rooms: leave the warm-up and start the real match (bots fill empty spots).
  beginMatch() {
    this.score = [0, 0];
    this.clock = this.rules.duration;
    this.overtime = false; this.lastChance = false;
    for (const p of this.players) for (const k in p.stats) p.stats[k] = 0;
    this.boxes.length = 0; this.puddles.length = 0;
    this.fillBots();
    this.resetKickoff(Math.random() < 0.5 ? 0 : 1);
    this.setPhase('kickoff', MATCH.kickoffTime);
  }

  // --------------------------------------------------------------- actions
  hasBall(p) { return this.ball.owner === p.id; }

  // Goalkeepers (white kit) are the only players who can dive, can't be tackled and can't
  // have the ball stolen. The status is dynamic: see updateKeepers().
  isKeeper(p) { return !!p.keeper; }

  keeperInBox(p) { return !!p.keeper && this.inOwnBox(p, 0.6); }

  inOwnBox(p, tol = 0) {
    const s = p.team === 0 ? -1 : 1;
    return p.x * s > FIELD.halfL - FIELD.boxL - tol && Math.abs(p.z) < FIELD.boxW / 2 + tol;
  }

  ballOffset(p) {
    const d = PLAYER.dribbleDist;
    return { x: p.x + Math.sin(p.face) * d, z: p.z + Math.cos(p.face) * d };
  }

  touch(p) {
    const b = this.ball;
    if (b.lastTouch !== p.id) {
      if (b.lastTeam === p.team && b.lastTouch >= 0) {
        b.prevTouch = b.lastTouch; b.prevTeam = b.lastTeam; b.prevT = this.time;
      } else if (b.lastTeam !== p.team) {
        b.prevTouch = -1; b.prevTeam = -1;
      }
    }
    b.lastTouch = p.id;
    b.lastTeam = p.team;
  }

  // Points + "+N" toast for the player who earned them
  award(p, label, pts, stat) {
    if (!p || this.quietAwards || this.mode === 'practice' && label !== 'Goal' && label !== 'Shot On Goal' && label !== 'Volley' && label !== 'Direct Hit') return;
    if (stat) p.stats[stat] += 1;
    p.stats.points += pts;
    this.emit({ e: 'toast', id: p.id, text: label, pts });
  }

  giveBall(p, reason) {
    const b = this.ball;
    const prevOwner = b.owner >= 0 ? this.byId.get(b.owner) : null;
    // Save detection: defending team stops a shot on target
    if (b.shot && b.shot.team !== p.team) {
      const sp = Math.hypot(b.vx, b.vy, b.vz);
      if (sp > 10) {
        this.award(p, sp > 32 ? 'Epic Save' : 'Save', sp > 32 ? 40 : 25, 'saves');
        this.emit({ e: 'save', id: p.id });
      }
    }
    if (prevOwner && prevOwner.team !== p.team) {
      const lastDitch = reason === 'tackle' && this.inOwnBox(p);
      this.award(p, lastDitch ? 'Last-Ditch Tackle!' : 'Steal', lastDitch ? 45 : 15, 'steals');
    } else if (b.pass && b.pass.team === p.team && b.pass.from !== p.id && this.time - b.pass.t < 4) {
      this.award(p, 'Receive', 10);
      this.award(this.byId.get(b.pass.from), 'Pass', 15);
    } else if (b.lastTeam >= 0 && b.lastTeam !== p.team && !b.shot) {
      this.award(p, 'Recover', 10);
    }
    b.pass = null;
    b.gkThrow = null;
    b.bike = -1;
    b.phase = null;
    b.owner = p.id;
    // A keeper in the box catches the ball in their hands (max KICK.keeperHold seconds)
    b.held = !!(p.keeper && this.inOwnBox(p, 0.6));
    b.holdT = b.held ? KICK.keeperHold : 0;
    b.shot = null;
    b.fire = false;
    b.curve = 0;
    b.contestT = 0;
    b.grapple = -1;
    this.touch(p);
    this.emit({ e: 'own', id: p.id });
  }

  loseBall(p, vx = 0, vz = 0, vy = 0) {
    const b = this.ball;
    if (b.owner !== p.id) return;
    b.owner = -1;
    b.held = false;
    const o = this.ballOffset(p);
    b.x = o.x; b.z = o.z; b.y = Math.max(PHYS.ballR, p.y + PHYS.ballR);
    b.vx = p.vx * 0.6 + vx; b.vz = p.vz * 0.6 + vz; b.vy = vy;
    b.block = p.id; b.blockT = 0.55;
  }

  aimDir(yaw) { return { x: Math.sin(yaw), z: Math.cos(yaw) }; }

  markShot(p) {
    const b = this.ball;
    const gx = p.team === 0 ? FIELD.halfL : -FIELD.halfL;
    if ((gx > 0 && b.vx <= 0) || (gx < 0 && b.vx >= 0)) return;
    const c = predictCross(b, gx);
    if (c && Math.abs(c.z) < FIELD.goalW / 2 + 1.2 && c.y < FIELD.goalH + 1.5) {
      b.shot = { team: p.team, id: p.id };
      this.award(p, 'Shot On Goal', 20, 'shots');
    }
  }

  launch(p, vx, vy, vz, kind, power, from) {
    const b = this.ball;
    b.bike = -1;
    const volley = b.owner !== p.id && kind === 'shot' && b.y > 1.05;
    b.gkThrow = null;
    if (b.owner === p.id) {
      b.owner = -1;
      const o = this.ballOffset(p);
      // A keeper's throw/punt from the hands bowls over any rival in its path (like a tackle)
      if (b.held) b.gkThrow = { team: p.team, by: p.id };
      b.x = o.x; b.z = o.z; b.y = b.held ? p.y + 1.35 : Math.max(PHYS.ballR, p.y + PHYS.ballR);
      b.held = false;
    } else if (from) {
      b.x = from.x; b.y = Math.max(PHYS.ballR, from.y); b.z = from.z;
    }
    b.vx = vx; b.vy = vy; b.vz = vz;
    // After a flick the ball can't be trapped straight away (so you can volley it)
    b.block = p.id; b.blockT = kind === 'flick' ? 0.6 : 0.32;
    b.grapple = -1;
    b.inNet = 0;
    b._netEv = false;
    b.kicker = p.id;
    // Shot phasing: nobody can block a shot point-blank; it passes through outfield players near the kicker
    b.phase = (kind === 'shot' || kind === 'lob') && Math.hypot(vx, vz) > 14 ? { x: b.x, z: b.z } : null;
    this.touch(p);
    b.shot = null;
    b.pass = kind === 'pass' || kind === 'lob' ? { from: p.id, team: p.team, t: this.time } : null;
    // A ball that can knock people over (keeper throw, fireball) only does so over the first
    // quarter of its flight
    b.stunZone = b.gkThrow || b.fire ? { x: b.x, z: b.z, r: 0.25 * flightDistance(b) } : null;
    if (volley) this.award(p, 'Volley', 15);
    if (kind === 'shot' || kind === 'lob' || kind === 'flick') this.markShot(p);
    this.emit({ e: 'kick', id: p.id, kind, pw: r2(power), fire: b.fire ? 1 : 0 });
  }

  ballReachable(p, reach) {
    const b = this.ball;
    if (b.owner >= 0 && b.owner !== p.id) return false;
    if (b.owner === p.id) return true;
    const d = len2(b.x - p.x, b.z - p.z);
    return d < reach && b.y < 2.6 + p.y;
  }

  // A free ball in the air close to you can be volleyed (jumping raises your reach)
  canVolley(p) {
    const b = this.ball;
    if (b.owner >= 0 || b.grapple >= 0 || b.phase) return false; // shots can only be volleyed once clear of the kicker
    if (b.bike >= 0 && b.bike !== p.id) return false; // someone else's bicycle kick: only another bicycle kick can take it
    const rel = b.y - (p.y || 0);
    return b.y > 1.05 && rel > 0.3 && rel < KICK.volleyReachUp && len2(b.x - p.x, b.z - p.z) < KICK.volleyReachH;
  }

  // Ball high enough above you for a bicycle kick (hang in the air, then scissor it over)
  // Bicycle kick: only from the air, and never on a ball someone else is already bicycle-kicking
  canBike(p) {
    const b = this.ball;
    if (b.bike >= 0) return false;
    if (b.owner >= 0 || b.grapple >= 0 || b.phase) return false;
    if ((p.y || 0) < KICK.bikeAirY) return false; // jump first: no bicycle kicks from the ground
    const rel = b.y - (p.y || 0);
    return rel > KICK.bikeMinH && rel < KICK.volleyReachUp && len2(b.x - p.x, b.z - p.z) < KICK.volleyReachH;
  }

  inStunZone(b) { return !!b.stunZone && len2(b.x - b.stunZone.x, b.z - b.stunZone.z) <= b.stunZone.r; }

  // Mid bicycle kick: can't be tackled, kicked or bowled over (items still knock you out of it)
  inBike(q) { return this.ball.bike === q.id; }

  doAction(p, act) {
    if (!p || p.left) return;
    const a = act.a;
    if (a === 'chat') {
      p.chat = act.i | 0; p.chatT = 4;
      this.emit({ e: 'chat', id: p.id, i: p.chat });
      return;
    }
    if (a === 'emote') {
      if (!canAct(p) || this.hasBall(p)) return;
      setAnim(p, 'emote', 3.2);
      p.emote = String(act.id || 'wave').slice(0, 12);
      this.emit({ e: 'emote', id: p.id, em: p.emote });
      return;
    }
    if (a === 'charge') { p.charging = !!act.on && canAct(p); if (!p.charging) p.charge = 0; return; }
    if (this.phase === 'kickoff' || this.phase === 'replay' || this.phase === 'end') return;
    if (!canAct(p)) return;
    const yaw = Number.isFinite(act.yaw) ? act.yaw : p.face;
    const pitch = Number.isFinite(act.pitch) ? clamp(act.pitch, -0.6, 1.3) : 0.28;
    const dir = this.aimDir(yaw);
    const b = this.ball;

    switch (a) {
      case 'bike': {
        // Start a bicycle kick: player and ball hang in the air while you aim; the kick fires on
        // release or by itself after KICK.bikeHold
        if (p.cd.kick > 0 || !this.canBike(p)) return;
        p.charging = false; p.charge = 0;
        p.bikeT = KICK.bikeHold;
        b.bikeY = Math.max(b.y, KICK.bikeBallY); // ball and player float up together
        p.bikeY = clamp(b.bikeY - 1.9, 0.5, 4);
        setAnim(p, 'bike', KICK.bikeHold + 0.6);
        b.bike = p.id; b.vx = 0; b.vy = 0; b.vz = 0; b.curve = 0; b.shot = null;
        b.bikeT = KICK.bikeHold + (p.isBot ? 0 : p.remote ? 0.4 : 0.15);
        this.emit({ e: 'bike', id: p.id });
        return;
      }
      case 'kick': {
        p.charging = false; p.charge = 0;
        if (p.cd.kick > 0) return;
        p.cd.kick = KICK.cooldown;
        const volley = this.canVolley(p) || b.bike === p.id;
        const fromBike = b.bike === p.id || p.anim === 'bike';
        p.bikeT = 0;
        // High ball above your head = bicycle kick, otherwise a normal kick swing
        setAnim(p, volley && (fromBike || ((p.y || 0) >= KICK.bikeAirY && b.y - p.y > 1.9)) ? 'volley' : 'kick', volley ? 0.5 : 0.38);
        if (fromBike) p.animT = 0.12; // already leaning back: go straight into the scissor
        if (volley) { act = { ...act, volley: 1, pw: Math.max(act.pw || 0, 0.85), sx: b.x, sy: b.y, sz: b.z }; }
        if (volley || this.ballReachable(p, KICK.hitRange + 0.2)) {
          spendStamina(p, STAMINA.kickBase + STAMINA.kickPower * clamp(act.pw || 0, 0, 1));
          const fire = p.fx.fire > 0;
          if (fire) { b.fire = true; p.fx.fire = 0; }
          const k = kickVelocity(p, act, this.players, fire);
          this.launch(p, k.vx, k.vy, k.vz, 'shot', k.pw);
          b.curve = k.curve;
        } else {
          // Swing kick: hits any rival in front ("illegal" kick)
          let best = null, bd = 1e9;
          for (const q of this.players) {
            if (q.team === p.team || q.left || q.stun > 0 || this.inBike(q)) continue;
            const dx = q.x - p.x, dz = q.z - p.z;
            const d = len2(dx, dz);
            if (d < KICK.hitRange + 0.4 && (dx * dir.x + dz * dir.z) / (d || 1) > 0.45 && d < bd) { best = q; bd = d; }
          }
          if (best) this.hitPlayer(p, best, 'hit', 0.85, dir.x * 7, dir.z * 7, 'Hit');
        }
        return;
      }
      case 'punch': {
        // Goalkeeper without the ball: punch it clear (a strong, high fist away from goal)
        if (!this.keeperInBox(p) || this.hasBall(p) || p.cd.kick > 0) return;
        p.cd.kick = 0.45;
        setAnim(p, 'throw', 0.3);
        if (b.owner >= 0 || b.bike >= 0 || b.held) return;
        const d = len2(b.x - p.x, b.z - p.z), rel = b.y - (p.y || 0);
        if (d > 3.6 || rel > 4 || rel < -0.7) { this.emit({ e: 'fizzle', id: p.id }); return; }
        const speed = Math.hypot(b.vx, b.vy, b.vz);
        const rivalShot = b.shot && b.shot.team !== p.team;
        const up = clamp((0.28 - pitch) * 14 + 8, 4, 16);
        this.launch(p, dir.x * 31, up, dir.z * 31, 'pass', 0.8);
        if (rivalShot) {
          const epic = speed > 32;
          this.award(p, epic ? 'Epic Save' : 'Save', epic ? 40 : 25, 'saves');
          this.emit({ e: 'save', id: p.id });
        }
        this.emit({ e: 'shatter', x: r2(b.x), y: r2(Math.max(0.6, b.y)), z: r2(b.z), k: 'fist' });
        return;
      }
      case 'pass': {
        if (p.cd.pass > 0 || !this.ballReachable(p, KICK.hitRange)) return;
        p.cd.pass = KICK.cooldown;
        spendStamina(p, STAMINA.pass);
        setAnim(p, 'pass', 0.3);
        const k = kickVelocity(p, act, this.players, false);
        this.launch(p, k.vx, k.vy, k.vz, 'pass', k.pw);
        return;
      }
      case 'lob': {
        if (p.cd.lob > 0 || !this.ballReachable(p, KICK.hitRange)) return;
        p.cd.lob = KICK.cooldown;
        spendStamina(p, STAMINA.lob);
        setAnim(p, 'kick', 0.38);
        const k = kickVelocity(p, act, this.players, false);
        this.launch(p, k.vx, k.vy, k.vz, 'lob', k.pw);
        return;
      }
      case 'flick': {
        if (p.cd.flick > 0 || !this.ballReachable(p, PLAYER.pickupReach + 0.4)) return;
        p.cd.flick = 0.8;
        spendStamina(p, STAMINA.flick);
        setAnim(p, 'flick', 0.35);
        const k = kickVelocity(p, act, this.players, false);
        this.launch(p, k.vx, k.vy, k.vz, 'flick', k.pw);
        return;
      }
      case 'dive':
      case 'tackle': {
        if (this.hasBall(p)) return;
        let mx = Number.isFinite(act.mx) ? act.mx : 0, mz = Number.isFinite(act.mz) ? act.mz : 0;
        const ml = len2(mx, mz);
        if (a === 'dive' && !this.keeperInBox(p)) return; // only goalkeepers dive
        if (this.keeperInBox(p)) {
          if (p.cd.dive > 0) return;
          p.cd.dive = KICK.diveCooldown;
          // Dive toward the ball if it's roughly ahead, else in move direction
          let dx = b.x - p.x, dz = b.z - p.z;
          let dl = len2(dx, dz);
          if (ml > 0.2 && (dl > 12 || dl < 0.5)) { dx = mx; dz = mz; dl = ml; }
          if (dl < 0.01) { dx = Math.sin(p.face); dz = Math.cos(p.face); dl = 1; }
          p.slideX = dx / dl; p.slideZ = dz / dl;
          p.face = Math.atan2(p.slideX, p.slideZ);
          p.vy = 6;
          setAnim(p, 'dive', KICK.diveTime);
          this.emit({ e: 'dive', id: p.id });
          return;
        }
        if (p.cd.tackle > 0) return;
        p.cd.tackle = KICK.tackleCooldown;
        spendStamina(p, STAMINA.tackle);
        let ux, uz;
        if (ml > 0.2) { ux = mx / ml; uz = mz / ml; } else { ux = Math.sin(p.face); uz = Math.cos(p.face); }
        p.slideX = ux; p.slideZ = uz;
        p.face = Math.atan2(ux, uz);
        p.hitSet = new Set();
        setAnim(p, 'slide', KICK.tackleTime);
        this.emit({ e: 'tackle', id: p.id });
        return;
      }
      case 'dribble': {
        if (p.cd.dribble > 0) return;
        p.cd.dribble = KICK.dribbleCooldown;
        let mx = Number.isFinite(act.mx) ? act.mx : 0, mz = Number.isFinite(act.mz) ? act.mz : 0;
        const ml = len2(mx, mz);
        if (ml > 0.2) { p.slideX = mx / ml; p.slideZ = mz / ml; } else { p.slideX = Math.sin(p.face); p.slideZ = Math.cos(p.face); }
        if (this.hasBall(p)) {
          if (b.held) { p.cd.dribble = 0; return; }
          // Dribble skill moves are free (no stamina)
          setAnim(p, 'spin', 0.42);
          p.immune = KICK.dribbleImmune;
          b.contestT = 0;
          this.emit({ e: 'skill', id: p.id });
        } else {
          // Without the ball the same key jumps (catch high balls, volley them mid-air)
          p.cd.dribble = KICK.jumpCooldown;
          if (p.y > 0.05 || p.fx.jet > 0) return;
          spendStamina(p, STAMINA.jump);
          p.vy = KICK.jumpSpeed;
          setAnim(p, 'jump', 0.75);
          this.emit({ e: 'jump', id: p.id });
        }
        return;
      }
      case 'request': {
        if (p.cd.request > 0) return;
        p.cd.request = KICK.requestCooldown;
        p.req = 2.5;
        this.emit({ e: 'request', id: p.id });
        if (this.mode === 'practice' && b.owner !== p.id) {
          // Practice: the ball comes back to you
          const o = this.ballOffset(p);
          Object.assign(b, { x: o.x, y: 3, z: o.z, vx: 0, vy: 2, vz: 0, owner: -1, inNet: 0, curve: 0, fire: false });
        }
        return;
      }
      case 'item': {
        const slot = act.slot === 1 ? 1 : 0;
        const kind = p.items[slot];
        if (!kind || p.cd.item > 0) return;
        p.items[slot] = null;
        if (p.equip === slot) p.equip = -1;
        p.cd.item = 0.4;
        this.useItem(p, kind, yaw, pitch);
        return;
      }
      default:
    }
  }

  pickTeammate(p, yaw, assisted, minDot = 0.5) { return pickTeammate(p, yaw, this.players, assisted, minDot); }

  hitPlayer(by, q, kind, dur, kbx, kbz, toast, pts = 10) {
    if (q.fx.shield > 0) { this.emit({ e: 'shieldblock', id: q.id }); return false; }
    // Goalkeepers can't be stunned, knocked down, frozen or robbed at all
    if (q.keeper) { this.emit({ e: 'shieldblock', id: q.id }); return false; }
    if (q.immune > 0 && kind !== 'frozen') return false;
    if (this.ball.owner === q.id) this.loseBall(q, kbx * 0.6, kbz * 0.6, 3);
    if (this.inBike(q)) {
      // Knocked out of a bicycle kick: the ball drops loose
      const b = this.ball;
      b.bike = -1; q.bikeT = 0;
      b.vx = kbx * 0.3; b.vz = kbz * 0.3; b.vy = 1;
      b.lastTouch = by ? by.id : b.lastTouch;
    }
    stunPlayer(q, kind, dur);
    q.vx = kbx; q.vz = kbz;
    if (kind === 'fall' || kind === 'hit') q.vy = 4;
    this.emit({ e: 'stun', id: q.id, k: kind, d: dur, kx: r2(kbx), kz: r2(kbz), by: by ? by.id : -1 });
    if (by && toast) this.award(by, toast, pts, 'hits');
    return true;
  }

  // Rocket Punch arriving at the ball: knock over rivals around it and punch the ball away
  punchBall(pr) {
    const b = this.ball;
    const by = this.byId.get(pr.owner);
    const sp = Math.hypot(pr.vx, pr.vz) || 1, ux = pr.vx / sp, uz = pr.vz / sp;
    const owner = b.owner >= 0 ? this.byId.get(b.owner) : null;
    let freed = !owner;
    for (const q of this.players) {
      if (q.team === pr.team || q.left || q.stun > 0) continue;
      if (len2(q.x - b.x, q.z - b.z) < 2.6 && Math.abs(q.y - b.y) < 3) {
        const biker = this.inBike(q);
        if (this.hitPlayer(by, q, 'fall', 1.4, ux * 18, uz * 18, 'Knockout')) { q.vy = 6; if (q === owner) freed = true; if (biker) { b.bike = -1; q.bikeT = 0; } }
      }
    }
    if (freed && b.owner < 0 && b.bike < 0 && !b.held) {
      b.vx = ux * 26 + b.vx * 0.2; b.vz = uz * 26 + b.vz * 0.2; b.vy = Math.max(b.vy, 7);
      b.lastTouch = pr.owner; b.lastTeam = pr.team; b.shot = null;
    }
    this.emit({ e: 'shatter', x: r2(b.x), y: r2(Math.max(0.6, b.y)), z: r2(b.z), k: 'fist' });
    this.emit({ e: 'boom', x: r2(b.x), z: r2(b.z), r: 2.6, k: 'fist' });
  }

  useItem(p, kind, yaw, pitch) {
    const dir = this.aimDir(yaw);
    const b = this.ball;
    this.emit({ e: 'item', id: p.id, k: kind });
    const shoot = (k, speed, life, extra = {}) => {
      setAnim(p, 'throw', 0.32);
      const vy = k === 'ice' ? clamp((0.28 - pitch) * 18 + 2, -4, 12) : clamp((0.28 - pitch) * 10, -3, 6);
      this.projs.push({ id: this.uid++, k, x: p.x + dir.x * 1.1, y: p.y + 1.5, z: p.z + dir.z * 1.1, vx: dir.x * speed, vy, vz: dir.z * speed, life, owner: p.id, team: p.team, ...extra });
    };
    switch (kind) {
      case 'fire': p.fx.fire = 10; break; // Supercharge
      case 'speed': p.fx.speed = 6; p.stamina = PLAYER.staminaMax; break; // Energy Drink
      case 'shield': p.fx.shield = 7; break; // Forcefield
      case 'jet': p.fx.jet = 3.2; p.vy = 9; break;
      case 'ice': shoot('ice', 38, 1.3); break; // Freeze Gun
      case 'punch': shoot('fist', 30, 4.5); break; // Rocket Punch: homes in on the ball
      case 'flintlock': shoot('bullet', 78, 0.9); break;
      case 'bazooka': shoot('rocket', 34, 1.5); break;
      case 'oil': p.fx.oil = 3.2; p.oilT = 0; break; // Oil Spill
      case 'magnet': p.fx.magnet = 3.5; break;
      case 'giant': p.fx.giant = 6; break; // Titan
      case 'warp': { // Time Warp: rivals close by move at half speed
        setAnim(p, 'throw', 0.32);
        for (const q of this.players) {
          if (q.team === p.team || q.left || q.keeper || q.fx.shield > 0) continue;
          if (len2(q.x - p.x, q.z - p.z) < 15) q.fx.slow = 4;
        }
        this.emit({ e: 'warp', id: p.id, x: r2(p.x), z: r2(p.z) });
        break;
      }
      case 'stomp': { // Shockwave
        p.vy = Math.max(p.vy || 0, 4);
        setAnim(p, 'throw', 0.32);
        this.explode(p.x, p.z, 6.5, 15, p.id, p.team, 'stomp');
        break;
      }
      case 'blink': { // teleport forward, the ball comes along
        const d = 10;
        const fx0 = p.x, fz0 = p.z;
        p.x = clamp(p.x + dir.x * d, -FIELD.wallX + 1.5, FIELD.wallX - 1.5);
        p.z = clamp(p.z + dir.z * d, -FIELD.wallZ + 1.5, FIELD.wallZ - 1.5);
        p.face = yaw;
        if (b.owner === p.id) { const o = this.ballOffset(p); b.x = o.x; b.z = o.z; }
        this.emit({ e: 'blink', id: p.id, fx: r2(fx0), fz: r2(fz0), x: r2(p.x), z: r2(p.z) });
        break;
      }
      case 'banana': {
        setAnim(p, 'throw', 0.32);
        const mine = this.projs.filter((x) => x.k === 'banana' && x.owner === p.id);
        if (mine.length >= 3) this.projs.splice(this.projs.indexOf(mine[0]), 1);
        this.projs.push({ id: this.uid++, k: 'banana', x: p.x - dir.x * 1.2, y: 0.05, z: p.z - dir.z * 1.2, vx: 0, vy: 0, vz: 0, life: 25, arm: 0.5, owner: p.id, team: p.team, spin: Math.random() * 6 });
        break;
      }
      case 'shotgun': {
        setAnim(p, 'throw', 0.32);
        this.emit({ e: 'blast', id: p.id, x: r2(p.x + dir.x), z: r2(p.z + dir.z), a: r2(yaw) });
        for (const q of this.players) {
          if (q.team === p.team || q.left) continue;
          const dx = q.x - p.x, dz = q.z - p.z, d = len2(dx, dz);
          if (d < 8.5 && (dx * dir.x + dz * dir.z) / (d || 1) > 0.8 && Math.abs(q.y - p.y) < 2.5) this.hitPlayer(p, q, 'fall', 1.1, (dx / (d || 1)) * 14, (dz / (d || 1)) * 14, 'Blasted');
        }
        break;
      }
      case 'mines': {
        setAnim(p, 'throw', 0.32);
        const mine = this.projs.filter((x) => x.k === 'mine' && x.owner === p.id);
        if (mine.length >= 3) this.projs.splice(this.projs.indexOf(mine[0]), 1);
        this.projs.push({ id: this.uid++, k: 'mine', x: p.x - dir.x * 1.2, y: 0.1, z: p.z - dir.z * 1.2, vx: 0, vy: 0, vz: 0, life: 25, arm: 0.6, owner: p.id, team: p.team });
        break;
      }
      case 'barricade': {
        setAnim(p, 'throw', 0.32);
        const d = 3.4;
        this.walls.push({ id: this.uid++, x: clamp(p.x + dir.x * d, -FIELD.wallX + 2, FIELD.wallX - 2), z: clamp(p.z + dir.z * d, -FIELD.wallZ + 2, FIELD.wallZ - 2), ang: yaw, hw: 2.4, hd: 0.35, h: 1.7, life: 12, team: p.team });
        if (this.walls.length > 8) this.walls.shift();
        break;
      }
      case 'grapple': {
        // Grappling Hook: hook the ball and zip yourself to it
        setAnim(p, 'throw', 0.32);
        const d = len2(b.x - p.x, b.z - p.z);
        if (d < 36 && b.owner !== p.id) {
          p.zipT = Math.min(1.1, d / 34 + 0.15);
          this.emit({ e: 'grapple', id: p.id, x: r2(b.x), y: r2(b.y), z: r2(b.z) });
        } else this.emit({ e: 'fizzle', id: p.id });
        break;
      }
      default:
    }
  }

  // Explosion (Bazooka rocket / Landmine): knocks back every rival in range and pushes the ball
  explode(x, z, radius, power, owner, team, kind) {
    const by = this.byId.get(owner);
    this.emit({ e: 'boom', x: r2(x), z: r2(z), r: radius, k: kind });
    for (const q of this.players) {
      if (q.team === team || q.left) continue;
      const dx = q.x - x, dz = q.z - z, d = len2(dx, dz);
      if (d < radius && q.y < 3) {
        const k = power * (1 - d / (radius * 1.4));
        if (this.hitPlayer(by, q, 'fall', 1.3, (dx / (d || 1)) * k, (dz / (d || 1)) * k, 'Direct Hit')) q.vy = kind === 'mine' ? 11 : 6;
      }
    }
    const b = this.ball;
    const bd = len2(b.x - x, b.z - z);
    if (b.owner < 0 && bd < radius + 1) { b.vx += ((b.x - x) / (bd || 1)) * 16; b.vz += ((b.z - z) / (bd || 1)) * 16; b.vy += 7; }
  }

  // ------------------------------------------------------------------- step
  step(dt) {
    this.time += dt;
    this.tick += 1;
    const b = this.ball;
    const physEvents = [];

    // Phase timers
    if (this.phase === 'kickoff') {
      this.phaseT -= dt;
      if (this.phaseT <= 0) { this.setPhase('play', 0); this.emit({ e: 'whistle', k: 'start' }); }
    } else if (this.phase === 'goal') {
      this.phaseT -= dt;
      if (this.phaseT <= 0) {
        if (this.checkEnd(true)) return;
        if (this.rules.replays && this.mode !== 'practice') this.setPhase('replay', MATCH.replayTime);
        else this.afterGoal();
      }
    } else if (this.phase === 'replay') {
      this.phaseT -= dt;
      if (this.phaseT <= 0) this.afterGoal();
      return;
    } else if (this.phase === 'end') {
      this.phaseT -= dt;
      for (const p of this.players) movePlayer(p, dt, false, true);
      return;
    } else if (this.phase === 'play' && this.mode !== 'practice') {
      if (this.overtime) this.clock += dt;
      else if (this.lastChance) {
        this.lastChanceT += dt;
        const trailing = this.score[0] < this.score[1] ? 0 : 1;
        const attackingHalf = trailing === 0 ? b.x > 0 : b.x < 0;
        if (!attackingHalf || this.lastChanceT > MATCH.lastChanceMax) this.endMatch();
      } else {
        this.clock -= dt;
        if (this.clock <= 0) {
          this.clock = 0;
          const diff = this.score[0] - this.score[1];
          if (diff === 0 && this.rules.overtime) {
            this.overtime = true;
            this.emit({ e: 'overtime' });
            this.emit({ e: 'whistle', k: 'start' });
          } else if (Math.abs(diff) === 1 && this.rules.lastChance) {
            const trailing = diff < 0 ? 0 : 1;
            const attackingHalf = trailing === 0 ? b.x > 0 : b.x < 0;
            if (attackingHalf) { this.lastChance = true; this.lastChanceT = 0; this.emit({ e: 'lastchance', team: trailing }); }
            else this.endMatch();
          } else this.endMatch();
        }
      }
    }
    if (this.phase === 'end') return;

    // Bots think
    for (const [id, brain] of this.brains) {
      const p = this.byId.get(id);
      if (p) brain.update(dt);
    }

    const frozen = this.phase === 'kickoff';
    for (const p of this.players) if (p.zipT > 0) { const dx = b.x - p.x, dz = b.z - p.z, d = len2(dx, dz) || 1; p.zipX = dx / d; p.zipZ = dz / d; if (d < 1.6) p.zipT = 0; }
    if (this.mode !== 'practice' && (this.phase === 'play' || this.phase === 'warmup')) this.updateKeepers();
    for (const p of this.players) {
      if (p.remote) { this.tickRemote(p, dt); continue; }
      movePlayer(p, dt, b.owner === p.id, frozen, this.phase !== 'play');
    }
    separatePlayers(this.players);
    if (b.owner >= 0 && b.held) { const o = this.byId.get(b.owner); if (o && !o.remote) clampInOwnBox(o); }
    if (this.walls.length) for (const p of this.players) if (!p.remote) this.collideWallsCircle(p, PLAYER.radius, false);

    // Ball
    if (b.owner >= 0) {
      const o = this.byId.get(b.owner);
      if (!o || o.stun > 0) { b.owner = -1; }
      else {
        if (b.held && !(o.keeper && this.inOwnBox(o, 0.6))) b.held = false; // left the box: ball drops to the feet
        const sp = len2(o.vx, o.vz);
        const px = b.x, py = b.y, pz = b.z;
        if (b.held) {
          const d = 0.72;
          b.x = o.x + Math.sin(o.face) * d; b.z = o.z + Math.cos(o.face) * d;
          b.y = o.y + 1.35;
          b.holdT -= dt;
          if (b.holdT <= 0 && this.phase === 'play') this.keeperRelease(o);
        } else {
          const off = this.ballOffset(o);
          b.x = off.x; b.z = off.z;
          b.y = PHYS.ballR + o.y + (sp > 1 ? Math.abs(Math.sin(this.time * 9)) * 0.12 : 0);
        }
        b.vx = o.vx; b.vz = o.vz; b.vy = 0;
        b.spin += sp * dt / PHYS.ballR;
        // Dribbling the ball over the line through the mouth scores too
        updateGoalLine(b, px, py, pz);
      }
    } else if (b.bike >= 0) {
      // Bicycle kick hang time: the ball floats where it was until the kick
      const o = this.byId.get(b.bike);
      b.vx = 0; b.vy = 0; b.vz = 0;
      b.y += ((b.bikeY ?? b.y) - b.y) * Math.min(1, dt * 7);
      if (!o || o.stun > 0 || o.left) { b.bike = -1; }
      else if ((b.bikeT -= dt) <= 0) {
        // Fires by itself when the hang time runs out (humans' own client fires it first; this is the fallback)
        o.cd.kick = 0;
        this.doAction(o, { a: 'kick', pw: 0.95, yaw: o.in.yaw ?? o.face, pitch: o.in.pitch ?? 0.24 });
        b.bike = -1;
      }
    } else if (b.grapple >= 0) {
      const g = this.byId.get(b.grapple);
      b.grappleT -= dt;
      if (!g || b.grappleT <= 0) { b.grapple = -1; }
      else {
        const dx = g.x - b.x, dy = (g.y + 0.6) - b.y, dz = g.z - b.z;
        const d = Math.hypot(dx, dy, dz);
        const sp = 50;
        b.vx = (dx / d) * sp; b.vy = (dy / d) * sp; b.vz = (dz / d) * sp;
        b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
        if (d < 1.8) { this.giveBall(g, 'grapple'); }
      }
    } else {
      if (b.deflectT > 0) b.deflectT -= dt;
      stepBall(b, dt, physEvents);
      if (this.walls.length) this.collideWallsCircle(b, PHYS.ballR, true);
    }
    for (const ev of physEvents) this.emit(ev);

    if (this.phase === 'play' || this.phase === 'warmup') this.ballInteractions(dt);
    this.stepItems(dt);
    if (this.phase === 'play') this.stepGiants(dt);

    if (this.phase === 'warmup' && b.inNet !== 0 && Math.abs(b.x) > FIELD.halfL + PHYS.ballR * 1.2) {
      this.warmT = (this.warmT || 0) + dt;
      if (this.warmT > 1.2) {
        this.warmT = 0;
        Object.assign(b, createBall());
        this.emit({ e: 'whistle', k: 'goal' });
      }
    }

    // Goal check
    if (this.phase === 'play' && b.inNet !== 0 && Math.abs(b.x) > FIELD.halfL + PHYS.ballR * 1.2) {
      if (b.owner >= 0) { const o = this.byId.get(b.owner); b.owner = -1; if (o) this.touch(o); }
      const scoring = b.inNet > 0 ? 0 : 1;
      if (b.lastTeam === 1 - scoring) {
        // the defending team touched it last (inside the net or on the line): never an own goal
        const s = b.inNet;
        Object.assign(b, { x: s * (FIELD.halfL - 1.2), y: Math.max(PHYS.ballR, Math.min(b.y, 3)), vx: -s * 6, vy: 3, vz: b.vz * 0.3, inNet: 0, owner: -1, held: false });
        this.emit({ e: 'post', v: 8 });
      } else this.scoreGoal(scoring);
    }
  }

  // Titan: a giant player bowls over any rival they run into
  stepGiants(dt) {
    for (const p of this.players) {
      if (!(p.fx.giant > 0) || p.left || p.stun > 0) continue;
      for (const q of this.players) {
        if (q.team === p.team || q.left || q.stun > 0 || q.keeper) continue;
        if ((q.giantHitT || 0) > 0) { q.giantHitT -= dt; continue; }
        const dx = q.x - p.x, dz = q.z - p.z, d = len2(dx, dz);
        if (d < 1.9 && Math.abs(q.y - p.y) < 2) {
          q.giantHitT = 1.2;
          this.hitPlayer(p, q, 'fall', 0.9, (dx / (d || 1)) * 12, (dz / (d || 1)) * 12, 'Flattened');
        }
      }
    }
  }

  // Keeper held the ball too long: it's thrown out to the best-placed teammate (or upfield)
  keeperRelease(p) {
    if (this.ball.owner !== p.id) return;
    const fwd = p.team === 0 ? Math.PI / 2 : -Math.PI / 2;
    const mate = pickTeammate(p, fwd, this.players, true, -0.2);
    const yaw = mate ? Math.atan2(mate.x - p.x, mate.z - p.z) : fwd;
    p.face = yaw;
    setAnim(p, 'throw', 0.32);
    const k = kickVelocity(p, { a: 'pass', yaw, pitch: 0.28 }, this.players, false);
    this.launch(p, k.vx, k.vy, k.vz, 'pass', k.pw);
  }

  tickRemote(p, dt) {
    // Remote humans move on their own client; we just keep timers going.
    p.animT += dt;
    for (const k in p.cd) if (p.cd[k] > 0) p.cd[k] -= dt;
    for (const k in p.fx) if (p.fx[k] > 0) p.fx[k] = Math.max(0, p.fx[k] - dt);
    if (p.immune > 0) p.immune -= dt;
    if (p.req > 0) p.req -= dt;
    if (p.chatT > 0) p.chatT -= dt;
    if (p.slipCd > 0) p.slipCd -= dt;
    if (p.stun > 0) p.stun -= dt;
    if (p.knockT > 0) p.knockT -= dt;
    if (p.actT > 0) {
      p.actT -= dt;
      if (p.actT <= 0) { p.actT = 0; p.anim = (p.anim === 'dive' || p.anim === 'fall' || p.anim === 'slip' || p.anim === 'hit') ? 'getup' : 'idle'; if (p.anim === 'getup') { p.actT = 0.4; p.actDur = 0.4; } }
    }
    p.charge = p.charging ? Math.min(1, p.charge + dt / KICK.chargeTime) : 0;
  }

  // Client-reported state for a remote human (client-authoritative movement, clamped).
  applyRemoteState(p, s) {
    if (!p || !s) return;
    const heldByMe = this.ball.owner === p.id && this.ball.held;
    const maxStep = 3.5;
    const nx = clamp(s.x, -FIELD.wallX, FIELD.wallX), nz = clamp(s.z, -FIELD.wallZ, FIELD.wallZ);
    const dx = nx - p.x, dz = nz - p.z;
    const d = len2(dx, dz);
    if (d > maxStep) { p.x += (dx / d) * maxStep; p.z += (dz / d) * maxStep; } else { p.x = nx; p.z = nz; }
    p.y = clamp(s.y || 0, 0, 4);
    p.vx = clamp(s.vx || 0, -30, 30); p.vz = clamp(s.vz || 0, -30, 30);
    p.face = wrapAngle(s.f || 0);
    p.sprinting = !!s.sp;
    p.stamina = clamp(s.st ?? p.stamina, 0, PLAYER.staminaMax);
    p.charging = !!s.ch;
    if (s.an && p.stun <= 0 && !(p.knockT > 0)) {
      const local = ['idle', 'kick', 'pass', 'flick', 'slide', 'recover', 'dive', 'getup', 'spin', 'dodge', 'emote', 'punch', 'throw'];
      if (local.includes(s.an)) {
        if (p.anim !== s.an) { p.anim = s.an; p.animT = 0; }
        p.actT = Math.max(p.actT, 0.05);
      }
    }
    if (Number.isFinite(s.sx)) { p.slideX = s.sx; p.slideZ = s.sz; }
    p.in.yaw = s.yaw ?? p.in.yaw;
    p.in.pitch = s.pitch ?? p.in.pitch;
    if (heldByMe) clampInOwnBox(p);
  }

  ballInteractions(dt) {
    const b = this.ball;
    const R = PHYS.ballR;
    const speed = Math.hypot(b.vx, b.vy, b.vz);

    // Slides & tackles hitting players
    for (const p of this.players) {
      if (p.anim !== 'slide' || p.left || p.stun > 0 || p.knockT > 0) continue; // a knocked-down player can't tackle
      for (const q of this.players) {
        if (q === p || q.team === p.team || q.left || q.stun > 0) continue;
        if (p.hitSet && p.hitSet.has(q.id)) continue;
        if (this.isKeeper(q) || this.inBike(q)) continue; // goalkeepers and bicycle kickers can't be tackled
        const d = len2(q.x - p.x, q.z - p.z);
        if (d < 1.7 && Math.abs(q.y - p.y) < 1.5) {
          if (p.hitSet) p.hitSet.add(q.id);
          const had = b.owner === q.id;
          if (q.fx.shield > 0 || q.fx.giant > 0 || (q.immune > 0 && had)) { this.emit({ e: 'shieldblock', id: q.id }); continue; }
          if (had) {
            b.owner = -1;
            const o = this.ballOffset(q);
            b.x = o.x; b.z = o.z; b.y = R;
            b.vx = p.slideX * 7 + rand(-2, 2); b.vz = p.slideZ * 7 + rand(-2, 2); b.vy = 2;
            b.block = q.id; b.blockT = 0.8;
            b.lastTouch = p.id; b.lastTeam = p.team;
          }
          stunPlayer(q, 'fall', had ? 1.1 : 0.9);
          q.vx = p.slideX * 6; q.vz = p.slideZ * 6; q.vy = 3;
          this.emit({ e: 'stun', id: q.id, k: 'fall', d: had ? 1.1 : 0.9, kx: r2(q.vx), kz: r2(q.vz), by: p.id });
          if (had) { const ld = this.inOwnBox(p); this.award(p, ld ? 'Last-Ditch Tackle!' : 'Tackle', ld ? 45 : 15, 'steals'); }
        }
      }
    }

    // Contest: rivals poking the ball off the dribbler
    if (b.owner >= 0) {
      const o = this.byId.get(b.owner);
      let contested = false;
      for (const q of this.players) {
        if (q.team === o.team || q.stun > 0 || q.left) continue;
        if (len2(q.x - b.x, q.z - b.z) < PLAYER.radius + R + 0.35 && Math.abs(q.y - o.y) < 1.5) { contested = true; break; }
      }
      if (contested && o.immune <= 0 && o.fx.shield <= 0 && !(o.fx.giant > 0) && !this.isKeeper(o)) {
        b.contestT += dt;
        if (b.contestT > PLAYER.contestTime) {
          const ang = o.face + rand(-1.2, 1.2) + Math.PI * 0.5 * (Math.random() < 0.5 ? 1 : -1);
          this.loseBall(o, Math.sin(ang) * 6, Math.cos(ang) * 6, 2.5);
          b.contestT = 0;
          this.emit({ e: 'poke', id: o.id });
        }
      } else b.contestT = Math.max(0, b.contestT - dt * 2);
      return;
    }
    if (b.grapple >= 0 || b.bike >= 0) return;

    // Shot phasing ends once the ball is clear of the kicker's zone (or has slowed right down)
    if (b.phase && (len2(b.x - b.phase.x, b.z - b.phase.z) > KICK.phaseR || len2(b.vx, b.vz) < 12)) b.phase = null;
    // Free ball: pickups, deflections, keeper catches
    let best = null, bestD = 1e9;
    for (const p of this.players) {
      if (p.left || p.stun > 0 || p.anim === 'frozen' || p.anim === 'getup') continue;
      if (b.phase && !this.keeperInBox(p)) continue; // passes straight through outfield players
      if (b.block === p.id) continue;
      if (b.gkThrow && b.gkThrow.team !== p.team && len2(b.vx, b.vz) >= KICK.gkStunSpeed) continue; // too fast to control: they get bowled over instead
      const dx = b.x - p.x, dz = b.z - p.z;
      const d = len2(dx, dz);
      const rel = b.y - p.y;
      const diving = p.anim === 'dive';
      const keeper = this.keeperInBox(p) && (this.mode !== 'practice' || !p.isBot);
      const airborne = p.y > 0.25 && p.fx.jet <= 0;
      // Keepers get a big catch box and hold on to anything but a supercharged ball
      const reach = diving ? 3.0 : keeper ? 2.5 : p.anim === 'slide' ? 1.95 : airborne ? 1.8 : PLAYER.pickupReach;
      const maxH = diving ? 3.9 : keeper ? 3.4 : airborne ? 2.2 : 1.55;
      const maxSpeed = diving || keeper ? 90 : p.anim === 'slide' ? 30 : airborne ? 30 : 27;
      if (d < reach && rel < maxH && rel > -0.8) {
        if (speed < maxSpeed && !(b.fire && (diving || keeper) && speed > 20)) {
          if (d < bestD) { best = p; bestD = d; }
        } else if (d < PLAYER.radius + R + 0.15 || diving) {
          // Deflect off the body
          const nx = dx / (d || 1), nz = dz / (d || 1);
          const vn = b.vx * nx + b.vz * nz;
          if (vn < 0) {
            b.vx -= 1.6 * vn * nx; b.vz -= 1.6 * vn * nz;
            b.vx *= 0.55; b.vz *= 0.55; b.vy = Math.abs(b.vy) * 0.4 + 3;
            if (b.shot && b.shot.team !== p.team && (keeper || diving)) {
              this.award(p, speed > 32 ? 'Epic Save' : 'Save', speed > 32 ? 40 : 25, 'saves');
              this.emit({ e: 'save', id: p.id });
              b.shot = null;
            }
            this.touch(p);
            b.block = p.id; b.blockT = 0.2;
            this.emit({ e: 'block', id: p.id });
            if (b.fire && p.fx.shield <= 0) {
              b.fire = false;
              this.hitPlayer(null, p, 'fall', 1.3, b.vx * 0.2 - nx * 8, b.vz * 0.2 - nz * 8);
            }
          }
        }
      }
    }
    if (best) this.giveBall(best, best.anim === 'slide' ? 'tackle' : best.anim === 'dive' ? 'dive' : 'pickup');
  }

  stepItems(dt) {
    const b = this.ball;
    // Spawn item boxes
    const practice = this.mode === 'practice';
    const maxItems = practice ? MATCH.practiceMaxItems : Math.round(MATCH.maxItems * Math.min(1.5, this.itemMul));
    if (!this.noAutoItems && (this.phase === 'play' || this.phase === 'warmup' || practice)) {
      this.nextItemT -= dt;
      if (this.nextItemT <= 0) {
        const iv = practice ? MATCH.practiceItemInterval : MATCH.itemInterval;
        this.nextItemT = rand(iv[0], iv[1]) / (practice ? 1 : this.itemMul);
        if (this.boxes.length < maxItems) {
          for (let tries = 0; tries < 10; tries++) {
            const x = rand(-FIELD.halfL + FIELD.boxL + 2, FIELD.halfL - FIELD.boxL - 2);
            const z = rand(-FIELD.halfW + 4, FIELD.halfW - 4);
            if (len2(x - b.x, z - b.z) < 6) continue;
            if (this.boxes.some((q) => len2(q.x - x, q.z - z) < 8)) continue;
            this.boxes.push({ id: this.uid++, x, z, c: Math.floor(Math.random() * 5) });
            break;
          }
        }
      }
    }
    // Pickups
    for (let i = this.boxes.length - 1; i >= 0; i--) {
      const box = this.boxes[i];
      for (const p of this.players) {
        if (p.left || p.stun > 0) continue;
        if (len2(p.x - box.x, p.z - box.z) < 1.9 && p.y < 2) {
          const slot = p.items[0] ? (p.items[1] ? -1 : 1) : 0;
          if (slot < 0) continue;
          const pool = box.k ? [box.k] : this.itemPool || (p.isBot || !p.powers || !p.powers.length ? ITEM_KINDS : p.powers);
          const kind = pool[Math.floor(Math.random() * pool.length)];
          p.items[slot] = kind;
          this.boxes.splice(i, 1);
          this.emit({ e: 'pickup', id: p.id, k: kind, x: r2(box.x), z: r2(box.z) });
          break;
        }
      }
    }
    // Oil trails
    for (const p of this.players) {
      if (p.fx.oil > 0 && p.y < 0.5 && !p.left) {
        p.oilT = (p.oilT || 0) - dt;
        if (p.oilT <= 0) {
          p.oilT = 0.09;
          this.puddles.push({ id: this.uid++, x: p.x - Math.sin(p.face) * 0.9, z: p.z - Math.cos(p.face) * 0.9, r: 1.35, life: 10, team: p.team });
          if (this.puddles.length > 120) this.puddles.shift();
        }
      }
    }
    // Barricades
    for (let i = this.walls.length - 1; i >= 0; i--) {
      this.walls[i].life -= dt;
      if (this.walls[i].life <= 0) this.walls.splice(i, 1);
    }
    // Puddles
    for (let i = this.puddles.length - 1; i >= 0; i--) {
      const pu = this.puddles[i];
      pu.life -= dt;
      if (pu.life <= 0) { this.puddles.splice(i, 1); continue; }
      for (const p of this.players) {
        if (p.team === pu.team || p.stun > 0 || p.slipCd > 0 || p.y > 0.5 || p.left) continue;
        if (len2(p.x - pu.x, p.z - pu.z) < pu.r) {
          p.slipCd = 2.5;
          this.hitPlayer(null, p, 'slip', 1.4, p.vx * 0.8, p.vz * 0.8);
        }
      }
    }
    // Projectiles (Freeze Gun ray, Rocket Punch fist, Flintlock bullet, Bazooka rocket, Landmines)
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const pr = this.projs[i];
      pr.life -= dt;
      if (pr.k === 'mine') {
        if (pr.arm > 0) pr.arm -= dt;
        let boom = pr.life <= 0;
        if (pr.arm <= 0) for (const q of this.players) {
          if (q.team === pr.team || q.left || q.y > 0.6) continue;
          if (len2(q.x - pr.x, q.z - pr.z) < 1.3) { boom = true; break; }
        }
        if (boom) { if (pr.life > 0) this.explode(pr.x, pr.z, 2.6, 12, pr.owner, pr.team, 'mine'); this.projs.splice(i, 1); }
        continue;
      }
      if (pr.k === 'banana') {
        if (pr.arm > 0) pr.arm -= dt;
        let hit = null;
        if (pr.arm <= 0) for (const q of this.players) {
          if (q.team === pr.team || q.left || q.y > 0.6) continue;
          if (len2(q.x - pr.x, q.z - pr.z) < 1.1) { hit = q; break; }
        }
        if (hit) this.hitPlayer(this.byId.get(pr.owner), hit, 'slip', 1.1, hit.vx * 0.6, hit.vz * 0.6, 'Slipped');
        if (hit || pr.life <= 0) this.projs.splice(i, 1);
        continue;
      }
      if (pr.k === 'fist') {
        // Rocket Punch: steers towards the ball (wherever it goes) and only bursts when it gets there
        const tx = b.x - pr.x, ty = b.y + 0.2 - pr.y, tz = b.z - pr.z;
        const d = Math.hypot(tx, ty, tz) || 1;
        const sp = Math.min(46, Math.hypot(pr.vx, pr.vy, pr.vz) + 30 * dt);
        const turn = Math.min(1, dt * 7);
        pr.vx += ((tx / d) * sp - pr.vx) * turn; pr.vy += ((ty / d) * sp - pr.vy) * turn; pr.vz += ((tz / d) * sp - pr.vz) * turn;
        const v = Math.hypot(pr.vx, pr.vy, pr.vz) || 1;
        pr.vx *= sp / v; pr.vy *= sp / v; pr.vz *= sp / v;
        pr.x += pr.vx * dt; pr.y = Math.max(0.5, pr.y + pr.vy * dt); pr.z += pr.vz * dt;
        if (d < 1.5) { this.punchBall(pr); this.projs.splice(i, 1); }
        else if (pr.life <= 0) { this.emit({ e: 'shatter', x: r2(pr.x), y: r2(pr.y), z: r2(pr.z), k: 'fist' }); this.projs.splice(i, 1); }
        continue;
      }
      if (pr.k === 'ice' || pr.k === 'rocket') pr.vy -= 6 * dt;
      pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.z += pr.vz * dt;
      let dead = pr.life <= 0 || pr.y < 0.1 || Math.abs(pr.x) > FIELD.wallX || Math.abs(pr.z) > FIELD.wallZ;
      let hit = null;
      if (!dead) {
        const rad = pr.k === 'bullet' ? 1.0 : pr.k === 'rocket' ? 1.4 : 1.35;
        for (const q of this.players) {
          if (q.team === pr.team || q.left) continue;
          if (len2(q.x - pr.x, q.z - pr.z) < rad && pr.y > q.y - 0.3 && pr.y < q.y + 3) { hit = q; dead = true; break; }
        }
      }
      if (dead) {
        const by = this.byId.get(pr.owner);
        const sp = Math.hypot(pr.vx, pr.vz) || 1, ux = pr.vx / sp, uz = pr.vz / sp;
        if (pr.k === 'rocket') this.explode(pr.x, pr.z, 5.5, 18, pr.owner, pr.team, 'rocket');
        else if (hit && pr.k === 'ice') this.hitPlayer(by, hit, 'frozen', 2.4, 0, 0, 'Direct Hit');
        else if (hit && pr.k === 'fist') { if (this.hitPlayer(by, hit, 'fall', 1.5, ux * 24, uz * 24, 'Knockout')) hit.vy = 7; }
        else if (hit && pr.k === 'bullet') this.hitPlayer(by, hit, 'fall', 1.0, ux * 9, uz * 9, 'Direct Hit');
        this.emit({ e: 'shatter', x: r2(pr.x), y: r2(Math.max(0.3, pr.y)), z: r2(pr.z), k: pr.k });
        this.projs.splice(i, 1);
      }
    }
    // Magnet: pulls a loose ball towards its owner
    if (b.owner < 0 && b.grapple < 0) {
      for (const p of this.players) {
        if (!(p.fx.magnet > 0) || p.left) continue;
        const dx = p.x - b.x, dz = p.z - b.z, d = len2(dx, dz);
        if (d > 24 || d < 0.5) continue;
        b.vx += (dx / d) * 55 * dt; b.vz += (dz / d) * 55 * dt;
        const v = len2(b.vx, b.vz);
        if (v > 24) { b.vx *= 24 / v; b.vz *= 24 / v; }
        break;
      }
    }
    if (b.gkThrow && b.owner < 0) {
      // Purely speed based: once the ball has slowed down it can be received normally
      const sp = len2(b.vx, b.vz);
      if (sp < KICK.gkStunSpeed || !this.inStunZone(b)) b.gkThrow = null;
      else {
        for (const q of this.players) {
          if (q.team === b.gkThrow.team || q.stun > 0 || q.left || this.inBike(q)) continue;
          if (len2(q.x - b.x, q.z - b.z) < PLAYER.radius + PHYS.ballR + 0.35 && b.y - q.y < 2.8) {
            const ux = b.vx / (sp || 1), uz = b.vz / (sp || 1);
            if (this.hitPlayer(this.byId.get(b.gkThrow.by), q, 'fall', 1.0, ux * 8, uz * 8, 'Bowled Over')) this.emit({ e: 'tackle', id: q.id });
          }
        }
      }
    }
    if (b.fire && b.owner < 0) {
      // Fireball knocks down players in its path
      const sp = Math.hypot(b.vx, b.vz);
      if (sp > 18 && this.inStunZone(b)) {
        for (const q of this.players) {
          if (q.id === b.kicker || q.stun > 0 || q.left) continue;
          if (len2(q.x - b.x, q.z - b.z) < PLAYER.radius + PHYS.ballR + 0.2 && b.y - q.y < 2.6) {
            this.hitPlayer(this.byId.get(b.kicker), q, 'fall', 1.3, b.vx * 0.25, b.vz * 0.25, 'Direct Hit');
          }
        }
      }
    }
  }

  // Barricades are oriented boxes; push a circle (player or ball) out of them.
  collideWallsCircle(o, r, isBall) {
    for (const w of this.walls) {
      if (o.y > w.h + (isBall ? r : 0)) continue;
      const c = Math.cos(w.ang), s = Math.sin(w.ang);
      const dx = o.x - w.x, dz = o.z - w.z;
      // local: lx along the fence width (perpendicular to throw dir), lz along throw dir
      const lx = dx * c - dz * s, lz = dx * s + dz * c;
      const ex = w.hw + r, ez = w.hd + r;
      if (Math.abs(lx) >= ex || Math.abs(lz) >= ez) continue;
      const px = ex - Math.abs(lx), pz = ez - Math.abs(lz);
      let nlx = 0, nlz = 0;
      if (px < pz) nlx = Math.sign(lx) || 1; else nlz = Math.sign(lz) || 1;
      const nx = nlx * c + nlz * s, nz = -nlx * s + nlz * c;
      const pen = px < pz ? px : pz;
      o.x += nx * pen; o.z += nz * pen;
      const vn = o.vx * nx + o.vz * nz;
      if (vn < 0) {
        const k = isBall ? 1.6 : 1;
        o.vx -= k * vn * nx; o.vz -= k * vn * nz;
        if (isBall && -vn > 6) this.emit({ e: 'wall', v: -vn });
      }
    }
  }

  // ------------------------------------------------------------------ goals
  scoreGoal(team) {
    const b = this.ball;
    this.score[team] += 1;
    const scorer = this.byId.get(b.lastTouch);
    let own = false, assist = null;
    if (scorer && scorer.team === team) {
      this.award(scorer, 'Goal', 100, 'goals');
      if (b.prevTouch >= 0 && b.prevTeam === team && b.prevTouch !== scorer.id && this.time - b.prevT < 10) {
        assist = this.byId.get(b.prevTouch);
        if (assist) this.award(assist, 'Assist', 50, 'assists');
      }
    } else own = true;
    const fx = scorer && !own ? scorer.cos.goalfx : 'confetti';
    this.lastGoal = { team, scorer: scorer ? scorer.id : -1, assist: assist ? assist.id : -1, own, t: this.time };
    this.emit({ e: 'goal', team, scorer: scorer ? scorer.id : -1, assist: assist ? assist.id : -1, own: own ? 1 : 0, fx, x: r2(b.x), y: r2(b.y), z: r2(b.z), cz: r2(b.crossZ ?? b.z), cy: r2(b.crossY ?? b.y) });
    this.emit({ e: 'whistle', k: 'goal' });
    for (const p of this.players) {
      if (p.stun > 0) continue;
      if (scorer && p.id === scorer.id && !own) setAnim(p, 'celebrate', MATCH.goalTime + 0.4);
      else if (p.team === team) setAnim(p, 'cheer', MATCH.goalTime);
      else setAnim(p, 'sad', MATCH.goalTime);
      p.charging = false;
    }
    this.setPhase('goal', this.mode === 'practice' ? this.practiceGoalT : MATCH.goalTime);
  }

  afterGoal() {
    if (this.overtime || this.lastChance) { this.endMatch(); return; }
    const conceded = this.lastGoal ? 1 - this.lastGoal.team : 0;
    this.resetKickoff(conceded);
    this.setPhase('kickoff', this.mode === 'practice' ? 0.3 : MATCH.kickoffTime);
  }

  checkEnd(afterGoal) {
    if (this.mode === 'practice') return false;
    if (Math.abs(this.score[0] - this.score[1]) >= this.rules.mercy) { this.endMatch(); return true; }
    if (afterGoal && (this.overtime || this.lastChance)) { this.endMatch(); return true; }
    return false;
  }

  endMatch() {
    if (this.phase === 'end') return;
    const winner = this.score[0] === this.score[1] ? -1 : this.score[0] > this.score[1] ? 0 : 1;
    let mvp = null;
    for (const p of this.players) if (!mvp || p.stats.points > mvp.stats.points) mvp = p;
    this.result = { winner, mvp: mvp ? mvp.id : -1, score: [...this.score] };
    for (const p of this.players) {
      p.charging = false;
      if (p.stun > 0) continue;
      if (winner === -1) setAnim(p, 'idle', 0);
      else setAnim(p, p.team === winner ? 'cheer' : 'sad', 6);
    }
    this.emit({ e: 'whistle', k: 'end' });
    this.emit({ e: 'end', winner, mvp: this.result.mvp, score: this.result.score, stats: this.statsTable() });
    this.setPhase('end', MATCH.endTime);
  }

  statsTable() {
    return this.players.map((p) => ({ id: p.id, name: p.name, team: p.team, bot: p.isBot ? 1 : 0, ...p.stats }));
  }

  // -------------------------------------------------------------- snapshots
  snapshot() {
    const b = this.ball;
    return {
      t: 's',
      k: this.tick,
      ph: this.phase,
      pt: r2(this.phaseT),
      c: r2(this.clock),
      sc: this.score,
      ot: this.overtime ? 1 : this.lastChance ? 2 : 0,
      mp: this.map,
      b: [r2(b.x), r2(b.y), r2(b.z), r2(b.vx), r2(b.vy), r2(b.vz), b.owner, b.fire ? 1 : 0, r2(b.spin % 100), b.grapple, b.held ? 1 : 0, r2(b.holdT || 0), b.bike ?? -1, b.phase ? 1 : 0, b.lastTeam, b.deflectT > 0 ? b.deflectTeam : -1],
      p: this.players.map((p) => [
        p.id, r2(p.x), r2(p.y), r2(p.z), r2(p.vx), r2(p.vz), r2(p.face),
        ANIM_INDEX[p.anim] ?? 0, r2(p.animT), r2(p.stamina), r2(p.charge),
        (p.sprinting ? 1 : 0) | (p.charging ? 2 : 0) | (p.req > 0 ? 4 : 0) | (p.fx.fire > 0 ? 8 : 0) | (p.fx.speed > 0 ? 16 : 0) | (p.fx.shield > 0 ? 32 : 0) | (p.fx.jet > 0 ? 64 : 0) | (p.immune > 0 ? 128 : 0) | (p.keeper ? 256 : 0),
        p.items[0] || 0, p.items[1] || 0, r2(p.stun), p.emote || 0, p.chatT > 0 ? p.chat : -1,
        r2(p.fx.fire), r2(p.fx.speed), r2(p.fx.shield), r2(p.fx.jet), r2(p.fx.oil || 0),
        p.charging ? r2(p.in.yaw ?? p.face) : 0, p.charging ? r2(p.in.pitch ?? 0.28) : 0, // aim, so everyone sees shot lines
        r2(p.fx.giant || 0), r2(p.fx.slow || 0),
      ]),
      bx: this.boxes.map((x) => [x.id, r2(x.x), r2(x.z), x.c]),
      pu: this.puddles.map((x) => [x.id, r2(x.x), r2(x.z), r2(x.r), r2(x.life)]),
      pr: this.projs.map((x) => [x.id, r2(x.x), r2(x.y), r2(x.z), x.k, r2(Math.atan2(x.vx, x.vz)), r2(x.spin || 0)]),
      wl: this.walls.map((w) => [w.id, r2(w.x), r2(w.z), r2(w.ang), r2(w.life)]),
    };
  }

  roster() {
    return this.players.map((p) => ({ id: p.id, name: p.name, team: p.team, slot: p.slot, gk: p.keeper ? 1 : 0, bot: p.isBot ? 1 : 0, cos: p.cos, stats: p.stats }));
  }
}

// Keep a keeper who holds the ball in their hands inside their own penalty box
export function clampInOwnBox(p) {
  const s = p.team === 0 ? -1 : 1;
  const inner = FIELD.halfL - FIELD.boxL + 0.4;
  if (p.x * s < inner) { p.x = s * inner; if (p.vx * s < 0) p.vx = 0; }
  const zl = FIELD.boxW / 2 - 0.4;
  if (Math.abs(p.z) > zl) { p.z = Math.sign(p.z) * zl; p.vz = 0; }
}

export function sanitizePowers(list) {
  if (!Array.isArray(list)) return null;
  const out = [...new Set(list.filter((k) => ITEM_KINDS.includes(k)))];
  return out.length ? out : null;
}

export function animName(code) { return ANIM_CODES[code] || 'idle'; }

export function pickTeammate(p, yaw, players, assisted, minDot = 0.5) {
  let best = null, bs = -1e9;
  const dx0 = Math.sin(yaw), dz0 = Math.cos(yaw);
  for (const q of players) {
    if (q === p || q.id === p.id || q.team !== p.team || q.left) continue;
    const dx = q.x - p.x, dz = q.z - p.z;
    const d = len2(dx, dz);
    if (d < 2 || d > 60) continue;
    const dot = (dx * dx0 + dz * dz0) / d;
    if (dot < (assisted ? minDot : 0.9)) continue;
    const s = dot * 2 - d / 45 + (q.req > 0 ? 0.6 : 0);
    if (s > bs) { bs = s; best = q; }
  }
  return best;
}

// Pure launch-velocity calculation shared by the host and client-side prediction.
export function kickVelocity(p, act, players, fire) {
  const yaw = Number.isFinite(act.yaw) ? act.yaw : p.face;
  const pitch = Number.isFinite(act.pitch) ? clamp(act.pitch, -0.6, 1.3) : 0.28;
  const dx = Math.sin(yaw), dz = Math.cos(yaw);
  const a = act.a;
  if (a === 'pass') {
    const target = pickTeammate(p, yaw, players, act.assist !== false);
    if (target) {
      const d = len2(target.x - p.x, target.z - p.z);
      const v0 = clamp(8 + d * 0.78, KICK.passMin, KICK.passMax);
      const lead = (d / v0) * 0.85;
      const tx = target.x + (target.vx || 0) * lead - p.x, tz = target.z + (target.vz || 0) * lead - p.z;
      const dl = len2(tx, tz) || 1;
      return { vx: (tx / dl) * v0, vy: 1.2, vz: (tz / dl) * v0, pw: v0 / KICK.passMax, curve: 0 };
    }
    return { vx: dx * 22, vy: 1.2, vz: dz * 22, pw: 0.6, curve: 0 };
  }
  if (a === 'lob') {
    const target = pickTeammate(p, yaw, players, true, 0.75);
    let range, ux = dx, uz = dz;
    if (target) {
      const tx = target.x + (target.vx || 0) * 1.2 - p.x, tz = target.z + (target.vz || 0) * 1.2 - p.z;
      const l = len2(tx, tz) || 1;
      range = clamp(l, 8, 46); ux = tx / l; uz = tz / l;
    } else range = clamp(KICK.lobRange + (0.28 - pitch) * 25, 12, 46);
    const th = KICK.lobAngle;
    const v = Math.sqrt((PHYS.gravity * range) / Math.sin(2 * th)) * 1.02;
    return { vx: ux * v * Math.cos(th), vy: v * Math.sin(th), vz: uz * v * Math.cos(th), pw: 0.7, curve: 0 };
  }
  if (a === 'flick') {
    // Pop the ball straight up over your head, keeping pace with you
    return { vx: dx * KICK.flickFwd + (p.vx || 0) * 0.9, vy: KICK.flickUp, vz: dz * KICK.flickFwd + (p.vz || 0) * 0.9, pw: 0.4, curve: 0 };
  }
  // Shot (a tired player kicks noticeably weaker)
  const power = clamp(act.pw ?? 0, 0, 1);
  let speed = (KICK.minSpeed + (KICK.maxSpeed - KICK.minSpeed) * Math.pow(power, 0.85)) * staminaPowerMul(p);
  if (p.keeper) speed *= KICK.keeperShotMul; // goalkeepers can't hammer it end to end
  if (Number.isFinite(act.tx) && Number.isFinite(act.ty) && Number.isFinite(act.tz)) {
    // Crosshair aim: send the ball through the aimed point (gravity-compensated)
    if (fire) speed = Math.min(60, speed * 1.32 + 6);
    if (act.volley) speed = Math.min(62, speed * 1.12); // volleys come off hot
    const fromBall = Number.isFinite(act.sx);
    const bx = fromBall ? act.sx : p.x + Math.sin(p.face) * PLAYER.dribbleDist, bz = fromBall ? act.sz : p.z + Math.cos(p.face) * PLAYER.dribbleDist, by = fromBall ? act.sy : (p.y || 0) + PHYS.ballR;
    const tx = act.tx - bx, tz = act.tz - bz, ty = clamp(act.ty, 0.3, 30) - by;
    const dh = Math.max(4, len2(tx, tz));
    const t = dh / speed;
    let vy = ty / t + 0.5 * PHYS.gravity * t * (fire ? 0.6 : 1);
    vy = clamp(vy, -4, speed * 0.85);
    const curve = clamp(act.cv || 0, -1, 1) * (KICK.curveBase + power * KICK.curvePow);
    return { vx: (tx / dh) * speed, vy, vz: (tz / dh) * speed, pw: power, curve };
  }
  const lift = clamp(0.5 + (0.28 - pitch) * 2.2, 0, 1.7);
  let vy = 3.5 + lift * 9 + power * 1.5;
  if (fire) { speed = Math.min(60, speed * 1.32 + 6); vy *= 0.8; }
  const curve = clamp(act.cv || 0, -1, 1) * (KICK.curveBase + power * KICK.curvePow);
  return { vx: dx * speed, vy, vz: dz * speed, pw: power, curve };
}
