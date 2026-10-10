// Player state + movement integration. Shared by the authoritative world and client-side prediction.
import { PLAYER, FIELD, KICK } from '../config.js';
import { clamp, moveAngle, len2 } from '../util/math.js';

export function createPlayer({ id, name, team, slot = 0, isBot = false, remote = false, cos }) {
  return {
    id, name, team, slot, isBot, remote, cos,
    x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, face: 0,
    stamina: PLAYER.staminaMax, sprinting: false, regenT: 0, exhausted: false,
    anim: 'idle', actT: 0, actDur: 0, animT: 0,
    stun: 0, stunKind: '', immune: 0,
    cd: { kick: 0, tackle: 0, dive: 0, dribble: 0, flick: 0, lob: 0, pass: 0, request: 0, item: 0, hit: 0 },
    charging: false, charge: 0,
    items: [null, null], equip: -1,
    fx: { fire: 0, speed: 0, shield: 0, jet: 0 },
    req: 0, emote: '', chat: -1, chatT: 0,
    slideX: 0, slideZ: 0, hitSet: null, slipCd: 0,
    in: { mx: 0, mz: 0, sprint: false, yaw: 0, pitch: 0.28, charging: false },
    stats: { goals: 0, assists: 0, shots: 0, saves: 0, steals: 0, hits: 0, points: 0 },
    left: false,
  };
}

export const BUSY_ANIMS = new Set(['slide', 'dive', 'getup', 'fall', 'slip', 'frozen', 'hit']);

export function canAct(p) {
  return p.stun <= 0 && !BUSY_ANIMS.has(p.anim);
}

export function setAnim(p, anim, dur) {
  p.anim = anim;
  p.actT = dur;
  p.actDur = dur;
  p.animT = 0;
  if (anim !== 'emote') p.emote = '';
}

export function stunPlayer(p, kind, dur) {
  p.stun = dur;
  p.stunKind = kind;
  p.charging = false;
  p.charge = 0;
  setAnim(p, kind, dur);
}

export function speedFor(p, hasBall) {
  let s = p.sprinting ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  if (hasBall) s *= PLAYER.withBallMul;
  if (p.fx.speed > 0) s *= 1.45;
  if (p.fx.jet > 0) s *= 1.35;
  if (p.charging) s *= 0.55;
  return s;
}

// Integrates one player. `hasBall` tells movement whether the ball is at its feet.
export function movePlayer(p, dt, hasBall, frozenPhase) {
  p.animT += dt;
  for (const k in p.cd) if (p.cd[k] > 0) p.cd[k] -= dt;
  for (const k in p.fx) if (p.fx[k] > 0) p.fx[k] = Math.max(0, p.fx[k] - dt);
  if (p.immune > 0) p.immune -= dt;
  if (p.req > 0) p.req -= dt;
  if (p.chatT > 0) p.chatT -= dt;
  if (p.slipCd > 0) p.slipCd -= dt;

  if (p.actT > 0) {
    p.actT -= dt;
    if (p.actT <= 0) {
      const prev = p.anim;
      p.actT = 0;
      if (prev === 'dive') {
        setAnim(p, 'getup', 0.45);
      } else if (prev === 'slide') {
        setAnim(p, 'recover', 0.22);
      } else if (prev === 'fall' || prev === 'slip' || prev === 'hit') {
        setAnim(p, 'getup', 0.4);
      } else {
        p.anim = 'idle';
      }
    }
  }
  if (p.stun > 0) p.stun -= dt;

  const inp = p.in;
  let wantX = 0, wantZ = 0;
  const m = len2(inp.mx, inp.mz);
  const mx = m > 1 ? inp.mx / m : inp.mx;
  const mz = m > 1 ? inp.mz / m : inp.mz;

  // Stamina & sprint
  const moving = m > 0.1;
  const freeStamina = p.fx.speed > 0 || p.fx.jet > 0;
  if (p.stamina <= 0.5) p.exhausted = true;
  if (p.exhausted && p.stamina >= PLAYER.minSprintStamina) p.exhausted = false;
  p.sprinting = !!inp.sprint && moving && !p.exhausted && !p.charging;
  if (p.sprinting && !freeStamina) {
    p.stamina = Math.max(0, p.stamina - PLAYER.sprintDrain * dt);
    p.regenT = PLAYER.regenDelay;
  } else {
    if (p.regenT > 0) p.regenT -= dt;
    else p.stamina = Math.min(PLAYER.staminaMax, p.stamina + PLAYER.staminaRegen * dt);
  }

  const a = p.anim;
  let accel = PLAYER.accel;
  if (frozenPhase) {
    wantX = 0; wantZ = 0; accel = 120;
  } else if (p.stun > 0 || a === 'getup' || a === 'frozen') {
    wantX = 0; wantZ = 0; accel = a === 'frozen' ? 400 : 18;
  } else if (a === 'slide') {
    const t = 1 - p.actT / p.actDur;
    const s = KICK.tackleSpeed * (1 - t * 0.75);
    p.vx = p.slideX * s; p.vz = p.slideZ * s;
    accel = 0;
  } else if (a === 'dive') {
    const t = 1 - p.actT / p.actDur;
    const s = KICK.diveSpeed * (1 - t * 0.85);
    p.vx = p.slideX * s; p.vz = p.slideZ * s;
    accel = 0;
  } else if (a === 'spin' || a === 'dodge') {
    const s = a === 'spin' ? speedFor(p, hasBall) * 1.55 : 15;
    p.vx = p.slideX * s; p.vz = p.slideZ * s;
    accel = 0;
  } else if (a === 'recover') {
    wantX = 0; wantZ = 0; accel = 30;
  } else {
    let s = speedFor(p, hasBall);
    if (a === 'kick' || a === 'pass' || a === 'flick' || a === 'punch' || a === 'throw') s *= 0.45;
    if (a === 'emote' && moving) { p.anim = 'idle'; p.emote = ''; }
    wantX = mx * s; wantZ = mz * s;
  }

  if (accel > 0) {
    const dx = wantX - p.vx, dz = wantZ - p.vz;
    const dl = len2(dx, dz);
    const step = accel * dt;
    if (dl <= step) { p.vx = wantX; p.vz = wantZ; } else { p.vx += (dx / dl) * step; p.vz += (dz / dl) * step; }
  }

  // Facing: aim direction while charging/aiming, otherwise movement direction.
  const sp = len2(p.vx, p.vz);
  if (p.stun <= 0 && a !== 'frozen' && a !== 'getup') {
    if (p.charging || a === 'kick' || a === 'pass' || a === 'punch' || a === 'throw') {
      p.face = moveAngle(p.face, inp.yaw, PLAYER.turnRate * 1.4 * dt);
    } else if (a === 'slide' || a === 'dive' || a === 'spin' || a === 'dodge') {
      // keep
    } else if (sp > 0.6 && moving) {
      p.face = moveAngle(p.face, Math.atan2(p.vx, p.vz), PLAYER.turnRate * dt);
    }
  }

  // Vertical: jetpack lift / dive hop / gravity
  if (p.fx.jet > 0) {
    p.vy += (2.8 - p.y) * 10 * dt - p.vy * 4 * dt;
  } else {
    p.vy -= 30 * dt;
  }
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.z += p.vz * dt;
  if (p.y < 0) { p.y = 0; if (p.vy < 0) p.vy = 0; }

  const r = PLAYER.radius;
  const wx = FIELD.wallX - r, wz = FIELD.wallZ - r;
  if (p.x > wx) { p.x = wx; p.vx = Math.min(0, p.vx); }
  if (p.x < -wx) { p.x = -wx; p.vx = Math.max(0, p.vx); }
  if (p.z > wz) { p.z = wz; p.vz = Math.min(0, p.vz); }
  if (p.z < -wz) { p.z = -wz; p.vz = Math.max(0, p.vz); }
  // Keep players out of the back of the goal nets (they can stand in the mouth).
  const gx = FIELD.halfL + 1.2;
  if (Math.abs(p.x) > gx && Math.abs(p.z) < FIELD.goalW / 2 + r) {
    const s = Math.sign(p.x);
    if (Math.abs(p.z) < FIELD.goalW / 2 - 0.2) p.x = s * Math.min(Math.abs(p.x), gx);
  }
  p.charge = p.charging ? clamp(p.charge + dt / KICK.chargeTime, 0, 1) : 0;
}

export function separatePlayers(list) {
  const r2 = PLAYER.radius * 2;
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a.left) continue;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      if (b.left) continue;
      if (Math.abs(a.y - b.y) > 1.8) continue;
      const dx = b.x - a.x, dz = b.z - a.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < r2 * r2 && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        const push = (r2 - d) * 0.5;
        const nx = dx / d, nz = dz / d;
        const wa = a.remote ? 0 : 1, wb = b.remote ? 0 : 1;
        const tot = wa + wb || 1;
        a.x -= nx * push * 2 * (wa / tot);
        a.z -= nz * push * 2 * (wa / tot);
        b.x += nx * push * 2 * (wb / tot);
        b.z += nz * push * 2 * (wb / tot);
      }
    }
  }
}
