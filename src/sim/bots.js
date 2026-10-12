// Bot AI: fills empty spots so every match is always full (4v4).
import { FIELD, PLAYER, KICK } from '../config.js';
import { clamp, len2, rand } from '../util/math.js';
import { predictCross } from './ball.js';
import { canAct } from './player.js';

const oppXFor = (p) => (p.team === 0 ? FIELD.halfL : -FIELD.halfL);

export class BotBrain {
  constructor(p, world) {
    this.p = p;
    this.w = world;
    this.skill = rand(0.5, 0.85);
    this.think = 0;
    this.holdT = 0;
    this.chargeTarget = -1;
    this.shotAim = null;
    this.tx = p.x; this.tz = p.z;
    this.sprint = false;
    this.diveCheck = 0;
    this.wander = rand(0, 10);
  }

  get role() {
    const p = this.p, w = this.w;
    if (w.mode === 'practice') return 'gk';
    if (p.keeper) return 'gk';
    // No keeper on the team: the bot closest to our goal runs back into the box to take the gloves
    if (!w.players.some((q) => q.team === p.team && q.keeper)) {
      const ownX = p.team === 0 ? -FIELD.halfL : FIELD.halfL;
      let best = null, bd = 1e9;
      for (const q of w.players) {
        if (q.team !== p.team || !q.isBot || q.left || w.ball.owner === q.id) continue;
        const d = Math.abs(q.x - ownX) + Math.abs(q.z) * 0.3;
        if (d < bd) { bd = d; best = q; }
      }
      if (best === p) return 'gkrun';
    }
    return ['fwd', 'mid', 'mid', 'mid'][p.slot % 4];
  }

  update(dt) {
    const p = this.p, w = this.w, b = w.ball;
    const inp = p.in;
    if (w.phase !== 'play') {
      inp.mx = 0; inp.mz = 0; inp.sprint = false;
      if (p.charging) w.doAction(p, { a: 'charge', on: false });
      this.chargeTarget = -1;
      return;
    }
    if (p.stun > 0 || !canAct(p)) { inp.mx = 0; inp.mz = 0; return; }

    const s = p.team === 0 ? 1 : -1; // attacking direction (+x for red)
    const ownX = -s * FIELD.halfL;
    const oppX = s * FIELD.halfL;
    const hasBall = b.owner === p.id;
    const owner = b.owner >= 0 ? w.byId.get(b.owner) : null;
    const bx = owner ? owner.x : b.x, bz = owner ? owner.z : b.z;

    if (!hasBall) { this.holdT = 0; if (this.chargeTarget >= 0) { this.chargeTarget = -1; w.doAction(p, { a: 'charge', on: false }); } }

    this.think -= dt;
    const decide = this.think <= 0;
    if (decide) this.think = rand(0.08, 0.16) / (0.6 + this.skill * 0.6);

    if (hasBall) { this.withBall(dt, decide, s, oppX); return; }

    const role = this.role;
    if (role === 'gk') { this.keeper(dt, decide, s, ownX, owner, bx, bz); return; }
    if (role === 'gkrun') {
      // Must walk INTO the box to become keeper: step out first if we're already inside
      if (p.wasInBox) this.moveTo(ownX + s * (FIELD.boxL + 2), clamp(p.z, -8, 8), true, 1);
      else this.moveTo(ownX + s * 3, clamp(bz * 0.3, -4, 4), true, 1);
      return;
    }

    // Am I the chaser? (closest non-keeper teammate, humans count too)
    let myD = len2(bx - p.x, bz - p.z);
    let closer = 0;
    for (const q of w.players) {
      if (q === p || q.team !== p.team || q.left || q.stun > 0) continue;
      const brain = w.brains.get(q.id);
      if (q.keeper && Math.abs(bx - ownX) > FIELD.boxL) continue;
      if (len2(bx - q.x, bz - q.z) < myD - 0.5) closer++;
    }
    const teamHas = owner && owner.team === p.team;
    const chaser = !teamHas && (closer === 0 || (closer === 1 && myD < 9));

    let tx, tz, sprint = false;
    if (chaser) {
      if (owner) {
        tx = owner.x + owner.vx * 0.25; tz = owner.z + owner.vz * 0.25;
        sprint = p.stamina > 25;
        const d = len2(owner.x - p.x, owner.z - p.z);
        if (decide && d < 3.6 && p.cd.tackle <= 0 && Math.random() < 0.18 + this.skill * 0.2) {
          const ux = (owner.x - p.x) / (d || 1), uz = (owner.z - p.z) / (d || 1);
          w.doAction(p, { a: 'tackle', mx: ux, mz: uz });
          return;
        }
        if (decide && d < 2.2 && p.cd.kick <= 0 && Math.random() < 0.08) {
          w.doAction(p, { a: 'kick', pw: 0.3, yaw: Math.atan2(owner.x - p.x, owner.z - p.z), pitch: 0.3 });
        }
        if (decide) this.useItemsDefending(owner, d);
      } else {
        // Intercept a loose ball
        let t = myD / 12;
        for (let i = 0; i < 2; i++) {
          const ex = b.x + b.vx * t * 0.8, ez = b.z + b.vz * t * 0.8;
          t = clamp(len2(ex - p.x, ez - p.z) / 12, 0, 1.6);
        }
        // A rival hanging in a bicycle kick: intercept it with a bicycle kick of our own
        if (decide && b.bike >= 0 && p.cd.kick <= 0 && w.canBike(p) && Math.random() < 0.5) {
          const yaw = Math.atan2(oppXFor(p) - p.x, -p.z);
          p.face = yaw; if (p.in) p.in.yaw = yaw;
          w.doAction(p, { a: 'bike' });
          return;
        }
        // Volley a bouncing/flicked ball towards goal, or jump for a high one
        if (decide && w.canVolley(p) && p.cd.kick <= 0 && Math.random() < 0.55) {
          const gz = (Math.random() - 0.5) * FIELD.goalW * 0.6;
          w.doAction(p, { a: 'kick', pw: 0.9, yaw: Math.atan2(oppXFor(p) - p.x, gz - p.z), pitch: 0.24 });
          return;
        }
        if (decide && b.y > 2.1 && b.y < 4 && myD < 2.6 && p.y < 0.05 && p.cd.dribble <= 0 && Math.random() < 0.5) w.doAction(p, { a: 'dribble' });
        tx = clamp(b.x + b.vx * t * 0.8, -FIELD.wallX + 1, FIELD.wallX - 1);
        tz = clamp(b.z + b.vz * t * 0.8, -FIELD.wallZ + 1, FIELD.wallZ - 1);
        sprint = p.stamina > 30 || myD < 8;
        if (decide && b.y < 2 && myD < 6 && p.items.includes('grapple') === false && myD > 2.6 && b.y < 1.2 && Math.random() < 0.02 && p.cd.tackle <= 0) {
          w.doAction(p, { a: 'tackle', mx: (b.x - p.x) / myD, mz: (b.z - p.z) / myD });
          return;
        }
        if (decide && myD > 14 && myD < 30 && Math.random() < 0.1) this.tryItem('grapple', Math.atan2(b.x - p.x, b.z - p.z)) || this.tryItem('magnet');
      }
    } else if (teamHas) {
      // Support run: get ahead of the ball, spread wide
      const lane = this.p.slot % 4 === 1 ? -1 : this.p.slot % 4 === 2 ? 1 : 0;
      tx = clamp(bx + s * (12 + (lane === 0 ? 6 : 0)), -FIELD.halfL + 6, FIELD.halfL - 6);
      tz = lane === 0 ? bz * 0.3 : lane * 13 + bz * 0.15;
      sprint = Math.abs(tx - p.x) > 10 && p.stamina > 50;
    } else {
      // Defensive shape between ball and own goal
      const lane = this.p.slot % 4 === 1 ? -1 : this.p.slot % 4 === 2 ? 1 : 0;
      tx = ownX * 0.5 + bx * 0.5;
      if (lane === 0) tx = bx - s * 8;
      tz = lane * 9 + bz * 0.45;
      // Mark nearest attacker
      let mark = null, md = 1e9;
      for (const q of w.players) {
        if (q.team === p.team || q.left) continue;
        const d = len2(q.x - tx, q.z - tz);
        if (d < md) { md = d; mark = q; }
      }
      if (mark && md < 10) { tx = mark.x - s * 2.5; tz = mark.z * 0.8 + bz * 0.2; }
      sprint = len2(tx - p.x, tz - p.z) > 12 && p.stamina > 45;
    }
    this.moveTo(tx, tz, sprint);
    if (decide && Math.random() < 0.004) this.tryItem('speed') || this.tryItem('shield');
  }

  moveTo(tx, tz, sprint, slowRadius = 2.5) {
    const p = this.p;
    const dx = tx - p.x, dz = tz - p.z;
    const d = len2(dx, dz);
    if (d < 0.4) { p.in.mx = 0; p.in.mz = 0; p.in.sprint = false; return; }
    const k = clamp(d / slowRadius, 0.2, 1);
    p.in.mx = (dx / d) * k; p.in.mz = (dz / d) * k;
    p.in.sprint = sprint && d > 3;
    p.in.yaw = Math.atan2(dx, dz);
  }

  withBall(dt, decide, s, oppX) {
    const p = this.p, w = this.w;
    this.holdT += dt;
    if (p.keeper && this.chargeTarget < 0) {
      // Keepers can't be robbed, but walking out of the box loses the gloves: distribute instead
      p.in.mx = 0; p.in.mz = 0; p.in.sprint = false;
      if (this.holdT > 0.7 && decide) {
        const mate = this.openMate(s);
        if (mate && Math.random() < 0.7) {
          const d = len2(mate.x - p.x, mate.z - p.z);
          w.doAction(p, { a: d > 24 ? 'lob' : 'pass', yaw: Math.atan2(mate.x - p.x, mate.z - p.z), pitch: 0.28 });
        } else {
          const yaw = Math.atan2(s * 30, rand(-14, 14));
          w.doAction(p, { a: 'kick', pw: rand(0.75, 1), yaw, pitch: rand(0.05, 0.15) });
        }
      }
      return;
    }
    // Charging a shot
    if (this.chargeTarget >= 0) {
      const aim = this.shotAim;
      p.in.yaw = aim.yaw;
      this.moveTo(p.x + Math.sin(aim.yaw) * 3, p.z + Math.cos(aim.yaw) * 3, false);
      if (p.charge >= this.chargeTarget) {
        w.doAction(p, { a: 'kick', pw: p.charge, yaw: aim.yaw + rand(-1, 1) * (0.07 - this.skill * 0.05), pitch: aim.pitch, cv: aim.cv });
        this.chargeTarget = -1;
      }
      return;
    }

    // Opponent keeper position to pick a corner
    let gk = null;
    for (const q of w.players) {
      if (q.team === p.team || q.left) continue;
      if (Math.abs(q.x - oppX) < 6 && (!gk || Math.abs(q.x - oppX) < Math.abs(gk.x - oppX))) gk = q;
    }
    const corner = gk ? (gk.z > 0 ? -1 : 1) : (Math.random() < 0.5 ? -1 : 1);
    const gz = corner * rand(FIELD.goalW * 0.17, FIELD.goalW * 0.4);
    const dxg = oppX - p.x, dzg = gz - p.z;
    const dGoal = len2(dxg, dzg);

    // Pressure check
    let press = 1e9, presser = null;
    for (const q of w.players) {
      if (q.team === p.team || q.left || q.stun > 0) continue;
      const d = len2(q.x - p.x, q.z - p.z);
      if (d < press) { press = d; presser = q; }
    }

    if (decide) {
      // Answer human teammates who asked for the ball
      for (const q of w.players) {
        if (q.team !== p.team || q === p || q.isBot || q.req <= 0) continue;
        const d = len2(q.x - p.x, q.z - p.z);
        if (d < 48 && this.holdT > 0.15) {
          const yaw = Math.atan2(q.x - p.x, q.z - p.z);
          w.doAction(p, { a: d > 26 ? 'lob' : 'pass', yaw, pitch: 0.28 });
          q.req = 0;
          return;
        }
      }
      if (dGoal < 28 && this.holdT > 0.25 && (press > 3 || Math.random() < 0.35)) {
        this.tryItem('fire');
        const yaw = Math.atan2(dxg, dzg);
        const near = dGoal < 14;
        this.shotAim = { yaw, pitch: near ? rand(0.24, 0.34) : rand(0.18, 0.3), cv: rand(-0.4, 0.4) };
        this.chargeTarget = clamp(dGoal / 30 + rand(0.05, 0.25), 0.3, 1);
        w.doAction(p, { a: 'charge', on: true });
        return;
      }
      if (press < 3.2 && presser) {
        const r = Math.random();
        if (p.cd.dribble <= 0 && r < 0.35 + this.skill * 0.2) {
          const side = Math.random() < 0.5 ? 1 : -1;
          const fx = Math.sin(p.face), fz = Math.cos(p.face);
          w.doAction(p, { a: 'dribble', mx: fx * 0.6 + -fz * side * 0.8, mz: fz * 0.6 + fx * side * 0.8 });
          return;
        }
        if (r < 0.7) {
          const mate = this.openMate(s);
          if (mate) { w.doAction(p, { a: 'pass', yaw: Math.atan2(mate.x - p.x, mate.z - p.z), pitch: 0.28 }); return; }
        }
        if (r < 0.8 && p.cd.flick <= 0) { w.doAction(p, { a: 'flick', yaw: Math.atan2(dxg, dzg) }); return; }
        if (this.tryItem('shield') || this.tryItem('speed') || this.tryItem('jet')) return;
      }
      if (this.holdT > 2.5 && Math.random() < 0.05) {
        const mate = this.openMate(s);
        if (mate) {
          const d = len2(mate.x - p.x, mate.z - p.z);
          w.doAction(p, { a: d > 24 ? 'lob' : 'pass', yaw: Math.atan2(mate.x - p.x, mate.z - p.z), pitch: 0.28 });
          return;
        }
      }
      if (presser && press < 6) {
        const behind = (presser.x - p.x) * s < 0;
        if (behind && Math.random() < 0.05) this.tryItem('oil');
        if (behind && Math.random() < 0.03) this.tryItem('barricade', Math.atan2(presser.x - p.x, presser.z - p.z));
      }
    }

    // Dribble toward goal, steering around rivals
    let vx = dxg / (dGoal || 1), vz = dzg / (dGoal || 1);
    for (const q of w.players) {
      if (q.team === p.team || q.left) continue;
      const dx = p.x - q.x, dz = p.z - q.z;
      const d = len2(dx, dz);
      if (d < 7 && d > 0.01) {
        const ahead = -(dx * vx + dz * vz) / d;
        if (ahead > -0.2) { vx += (dx / d) * (7 - d) * 0.22; vz += (dz / d) * (7 - d) * 0.22; }
      }
    }
    // Stay inside the pitch
    if (Math.abs(p.z) > FIELD.halfW - 4) vz -= Math.sign(p.z) * 0.8;
    const l = len2(vx, vz) || 1;
    p.in.mx = vx / l; p.in.mz = vz / l;
    p.in.sprint = p.stamina > 35 && press > 2.5;
    p.in.yaw = Math.atan2(vx, vz);
  }

  openMate(s) {
    const p = this.p, w = this.w;
    let best = null, bs = -1e9;
    for (const q of w.players) {
      if (q === p || q.team !== p.team || q.left || q.stun > 0) continue;
      const d = len2(q.x - p.x, q.z - p.z);
      if (d < 5 || d > 45) continue;
      let open = 1e9;
      for (const r of w.players) {
        if (r.team === p.team || r.left) continue;
        open = Math.min(open, len2(r.x - q.x, r.z - q.z));
      }
      const score = (q.x - p.x) * s * 0.08 + Math.min(open, 10) * 0.3 - d * 0.02 + (q.isBot ? 0 : 1);
      if (score > bs) { bs = score; best = q; }
    }
    return bs > 0.6 ? best : null;
  }

  keeper(dt, decide, s, ownX, owner, bx, bz) {
    const p = this.p, w = this.w, b = w.ball;
    const homeX = ownX + s * 1.6;
    // Incoming shot?
    if (!owner && b.grapple < 0) {
      const c = predictCross(b, ownX + s * 0.8);
      if (c && (b.vx * s < -6) && Math.abs(c.z) < FIELD.goalW / 2 + 1.2 && c.y < FIELD.goalH + 0.8 && c.t < 1.4) {
        const reactT = 0.55 - this.skill * 0.25;
        this.moveTo(homeX, clamp(c.z, -FIELD.goalW / 2, FIELD.goalW / 2), true, 1);
        const need = Math.abs(c.z - p.z);
        if (c.t < reactT && need > 1.4 && p.cd.dive <= 0 && w.inOwnBox(p)) {
          const dz = c.z - p.z, dx = (ownX + s * 0.8) - p.x;
          const l = len2(dx, dz) || 1;
          w.doAction(p, { a: 'tackle', mx: dx / l, mz: dz / l });
        }
        return;
      }
    }
    // Claim loose balls in the box
    const ballInBox = Math.abs(b.x - ownX) < FIELD.boxL && Math.abs(b.z) < FIELD.boxW / 2;
    if (!owner && ballInBox) {
      let rivalCloser = false;
      const myD = len2(b.x - p.x, b.z - p.z);
      for (const q of w.players) if (q.team !== p.team && len2(b.x - q.x, b.z - q.z) < myD - 2) rivalCloser = true;
      if (!rivalCloser || myD < 5) { const t = this.inBox(b.x + b.vx * 0.2, b.z + b.vz * 0.2, ownX, s); this.moveTo(t.x, t.z, true, 0.5); return; }
    }
    if (owner && owner.team !== p.team && ballInBox) {
      const d = len2(owner.x - p.x, owner.z - p.z);
      if (d < 4 && decide && p.cd.dive <= 0 && Math.random() < 0.3) {
        w.doAction(p, { a: 'tackle', mx: (owner.x - p.x) / (d || 1), mz: (owner.z - p.z) / (d || 1) });
        return;
      }
    }
    const adv = clamp((FIELD.halfL * 2 - Math.abs(bx - ownX)) / 30, 0, 1) * 3.2;
    const tz = clamp(bz * 0.33, -FIELD.goalW / 2 + 1, FIELD.goalW / 2 - 1);
    this.moveTo(homeX + s * adv, tz, false, 1.2);
    p.in.yaw = Math.atan2(bx - p.x, bz - p.z);
  }

  // Clamp a target to the inside of our own penalty box (keepers lose the gloves outside it)
  inBox(x, z, ownX, s) {
    const lo = Math.min(ownX, ownX + s * (FIELD.boxL - 1.2)), hi = Math.max(ownX, ownX + s * (FIELD.boxL - 1.2));
    return { x: clamp(x, lo, hi), z: clamp(z, -FIELD.boxW / 2 + 1.2, FIELD.boxW / 2 - 1.2) };
  }

  useItemsDefending(owner, d) {
    const p = this.p;
    const yaw = Math.atan2(owner.x - p.x, owner.z - p.z);
    if (d < 7 && this.tryItem('shotgun', yaw)) return;
    if (d < 16 && Math.random() < 0.4 && this.tryItem('punch', yaw)) return;
    if (d < 22 && d > 4 && Math.random() < 0.35 && this.tryItem('bazooka', yaw)) return;
    if (d < 30 && d > 6 && Math.random() < 0.3 && this.tryItem('flintlock', yaw)) return;
    if (d < 9 && Math.random() < 0.15 && this.tryItem('mines', yaw)) return;
    const ownX = p.team === 0 ? -FIELD.halfL : FIELD.halfL;
    if (Math.abs(owner.x - ownX) < 26 && d > 4 && d < 12 && Math.random() < 0.3 && this.tryItem('barricade', yaw)) return;
    if (d < 22 && d > 4 && Math.random() < 0.3 && this.tryItem('ice', yaw, 0.32)) return;
    if (d > 10 && d < 30 && Math.random() < 0.2) this.tryItem('grapple', yaw);
  }

  tryItem(kind, yaw, pitch = 0.3) {
    const p = this.p;
    const slot = p.items.indexOf(kind);
    if (slot < 0 || p.cd.item > 0) return false;
    if (Math.random() > 0.5 + this.skill * 0.4) return false;
    this.w.doAction(p, { a: 'item', slot, yaw: yaw ?? p.face, pitch });
    return true;
  }
}

export { PLAYER, KICK };
