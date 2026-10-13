// Ball physics: gravity, bounce, rolling, curve, walls, goal frame and nets.
import { FIELD, PHYS } from '../config.js';

export function createBall() {
  return {
    x: 0, y: PHYS.ballR, z: 0, vx: 0, vy: 0, vz: 0,
    curve: 0, owner: -1, lastTouch: -1, lastTeam: -1, prevTouch: -1, prevTeam: -1, prevT: 0,
    fire: false, deflectT: 0, deflectBy: -1, deflectTeam: -1, inNet: 0, block: -1, blockT: 0, contestT: 0, grapple: -1, grappleT: 0,
    shot: null, pass: null, spin: 0, kicker: -1, held: false, holdT: 0, gkThrow: null, bike: -1, phase: null,
  };
}

// Returns list of physics events ('bounce','post','net','wall') for audio.
export function stepBall(b, dt, events) {
  const R = PHYS.ballR;
  if (b.blockT > 0) { b.blockT -= dt; if (b.blockT <= 0) b.block = -1; }
  if (b.owner >= 0) return;
  const px = b.x, py = b.y, pz = b.z;

  const airborne = b.y > R + 0.02;
  b.vy -= PHYS.gravity * dt;

  // Curve (lateral acceleration perpendicular to horizontal velocity)
  const vh = Math.hypot(b.vx, b.vz);
  if (Math.abs(b.curve) > 0.01 && vh > 4) {
    const qx = -b.vz / vh, qz = b.vx / vh;
    b.vx += qx * b.curve * dt * PHYS.magnus;
    b.vz += qz * b.curve * dt * PHYS.magnus;
    b.curve *= Math.exp(-0.9 * dt);
  }
  if (airborne) {
    const k = 1 - PHYS.airDrag * dt;
    b.vx *= k; b.vz *= k;
  }

  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.z += b.vz * dt;
  b.spin += vh * dt / R;

  // Ground
  if (b.y < R) {
    b.y = R;
    if (b.vy < -2.2) {
      if (b.vy < -5) events.push({ e: 'bounce', v: -b.vy });
      b.vy = -b.vy * PHYS.bounce;
      b.vx *= 0.9; b.vz *= 0.9;
      b.curve *= 0.5;
    } else {
      b.vy = 0;
      const f = Math.max(0, 1 - PHYS.rollFriction * dt) ;
      b.vx *= f; b.vz *= f;
      const v = Math.hypot(b.vx, b.vz);
      if (v > 0) {
        const nv = Math.max(0, v - 1.6 * dt);
        b.vx *= nv / v; b.vz *= nv / v;
      }
      b.curve *= Math.exp(-3 * dt);
    }
  }
  if (b.fire && Math.hypot(b.vx, b.vy, b.vz) < 12) b.fire = false;

  collideGoals(b, events, px, py, pz);

  // Walls (ball can never leave the arena)
  const wx = FIELD.wallX - R, wz = FIELD.wallZ - R;
  if (b.x > wx) { b.x = wx; b.vx = -Math.abs(b.vx) * PHYS.wallBounce; wallEv(b, events); }
  if (b.x < -wx) { b.x = -wx; b.vx = Math.abs(b.vx) * PHYS.wallBounce; wallEv(b, events); }
  if (b.z > wz) { b.z = wz; b.vz = -Math.abs(b.vz) * PHYS.wallBounce; wallEv(b, events); }
  if (b.z < -wz) { b.z = -wz; b.vz = Math.abs(b.vz) * PHYS.wallBounce; wallEv(b, events); }
  if (b.y > FIELD.wallTop) { b.y = FIELD.wallTop; b.vy = -Math.abs(b.vy) * 0.5; }
}

function wallEv(b, events) {
  const v = Math.hypot(b.vx, b.vz);
  if (v > 6) events.push({ e: 'wall', v });
}

function collideCylinderV(b, cx, cz, r, y0, y1, events) {
  if (b.y < y0 - PHYS.ballR || b.y > y1 + PHYS.ballR) return;
  const dx = b.x - cx, dz = b.z - cz;
  const d = Math.hypot(dx, dz);
  const min = r + PHYS.ballR;
  if (d < min && d > 1e-5) {
    const nx = dx / d, nz = dz / d;
    b.x = cx + nx * min; b.z = cz + nz * min;
    const vn = b.vx * nx + b.vz * nz;
    if (vn < 0) {
      b.vx -= 1.75 * vn * nx; b.vz -= 1.75 * vn * nz;
      if (-vn > 6) events.push({ e: 'post', v: -vn });
    }
  }
}

function collideBar(b, x, y, z0, z1, r, events) {
  if (b.z < z0 || b.z > z1) return;
  const dx = b.x - x, dy = b.y - y;
  const d = Math.hypot(dx, dy);
  const min = r + PHYS.ballR;
  if (d < min && d > 1e-5) {
    const nx = dx / d, ny = dy / d;
    b.x = x + nx * min; b.y = y + ny * min;
    const vn = b.vx * nx + b.vy * ny;
    if (vn < 0) {
      b.vx -= 1.75 * vn * nx; b.vy -= 1.75 * vn * ny;
      if (-vn > 6) events.push({ e: 'post', v: -vn });
    }
  }
}

// Did the ball travel from (px,py,pz) to its current position across goal line s (+1/-1)
// through the goal mouth, coming from the pitch? Only that counts as "in the net":
// balls that sneak in from the side, the top or behind the goal never score.
export function crossesGoalMouth(px, py, pz, x, y, z, s) {
  const L = FIELD.halfL;
  const a0 = s * px, a1 = s * x;
  if (!(a0 <= L && a1 > L)) return null;
  const t = (L - a0) / (a1 - a0 || 1e-6);
  const cz = pz + (z - pz) * t, cy = py + (y - py) * t;
  if (Math.abs(cz) < FIELD.goalW / 2 - FIELD.postR && cy < FIELD.goalH - FIELD.postR) return { z: cz, y: cy };
  return null;
}

// Goal-line bookkeeping shared by free and carried balls.
// No own goals: a ball last played by the defending team bounces back off its own goal line.
// A rival's shot that deflects in off a defender still counts (credited to the shooter).
export function updateGoalLine(b, px, py, pz, events) {
  const R = PHYS.ballR, L = FIELD.halfL;
  for (const s of [-1, 1]) {
    if (b.inNet === 0) {
      const c = crossesGoalMouth(px, py, pz, b.x, b.y, b.z, s);
      if (c) {
        const defending = s > 0 ? 1 : 0;
        if (b.lastTeam === defending) {
          if (b.deflectT > 0 && b.deflectTeam === 1 - defending && b.deflectBy >= 0) {
            b.lastTouch = b.deflectBy; b.lastTeam = b.deflectTeam;
          } else {
            if (b.owner < 0) {
              b.x = s * (L - R * 1.05);
              b.vx = -s * Math.max(4, Math.abs(b.vx) * 0.45);
              if (events) events.push({ e: 'post', v: 8 });
            }
            continue;
          }
        }
        b.inNet = s; b.crossZ = c.z; b.crossY = c.y;
      }
    } else if (b.inNet === s && s * b.x < L - R) b.inNet = 0;
  }
}

function collideGoals(b, events, px, py, pz) {
  const R = PHYS.ballR;
  const hw = FIELD.goalW / 2, H = FIELD.goalH, D = FIELD.goalD, L = FIELD.halfL, pr = FIELD.postR;
  updateGoalLine(b, px, py, pz, events);
  for (const s of [-1, 1]) {
    const gx = s * L;
    collideCylinderV(b, gx, -hw, pr, 0, H, events);
    collideCylinderV(b, gx, hw, pr, 0, H, events);
    collideBar(b, gx, H, -hw, hw, pr, events);
    // Never let the ball balance on the crossbar: roll it off towards the pitch
    if (Math.abs(b.x - gx) < pr + R && b.y > H && b.y < H + pr + R + 0.1 && Math.abs(b.vy) < 2 && Math.abs(b.z) < hw) b.vx = -s * Math.max(3.5, Math.abs(b.vx));

    const backX = gx + s * D;
    if (b.inNet === s) {
      // Inside the net box: soft walls
      let hitNet = false;
      if (s > 0 ? b.x > backX - R : b.x < backX + R) { b.x = backX - s * R; b.vx = -b.vx * PHYS.netDamp; hitNet = true; }
      if (b.z > hw - R) { b.z = hw - R; b.vz = -Math.abs(b.vz) * PHYS.netDamp; hitNet = true; }
      if (b.z < -hw + R) { b.z = -hw + R; b.vz = Math.abs(b.vz) * PHYS.netDamp; hitNet = true; }
      if (b.y > H - R) { b.y = H - R; b.vy = -Math.abs(b.vy) * PHYS.netDamp; hitNet = true; }
      if (hitNet) {
        b.vx *= 0.8; b.vz *= 0.8;
        if (!b._netEv) { events.push({ e: 'net', side: s }); b._netEv = true; }
      }
      continue;
    }
    // Not a legal entry: the goal frame + side/top/back nets are solid from the outside.
    const ax = s * b.x;
    if (ax <= L || ax >= L + D + R || Math.abs(b.z) >= hw + R || b.y >= H + R) continue;
    const pax = s * px;
    const penSide = hw + R - Math.abs(b.z);
    const penTop = H + R - b.y;
    const penBack = L + D + R - ax;
    const penFront = ax - L + R;
    let face;
    if (Math.abs(pz) >= hw + R - 0.02) face = 'side';
    else if (py >= H + R - 0.02) face = 'top';
    else if (pax >= L + D + R - 0.02) face = 'back';
    else {
      const m = Math.min(penSide, penTop, penBack, penFront);
      face = m === penSide ? 'side' : m === penTop ? 'top' : m === penBack ? 'back' : 'front';
    }
    if (face === 'side') {
      const sz = Math.sign(Math.abs(pz) >= hw ? pz : b.z) || 1;
      b.z = sz * (hw + R); b.vz = sz * Math.abs(b.vz) * 0.35;
    } else if (face === 'top') {
      // The roof net slopes: a ball landing on top always rolls off the front, back onto the pitch
      b.y = H + R; if (b.vy < 0) b.vy = -b.vy * 0.35;
      if (Math.abs(b.vy) < 3) b.vx = -s * Math.max(5, Math.abs(b.vx));
    } else if (face === 'back') {
      b.x = s * (L + D + R); b.vx = s * Math.abs(b.vx) * 0.35;
    } else {
      b.x = s * (L - R); b.vx = -s * Math.abs(b.vx) * 0.35;
    }
    const sp = Math.hypot(b.vx, b.vy, b.vz);
    if (sp > 4 && !b._sideEv) { events.push({ e: 'net', side: s }); b._sideEv = true; }
  }
  if (b._sideEv && Math.abs(b.x) < L - 2) b._sideEv = false;
}

// Predict where/when a free ball crosses x = gx (ignoring curve). Returns {z, y, t} or null.
export function predictCross(b, gx) {
  if (Math.abs(b.vx) < 0.5) return null;
  const t = (gx - b.x) / b.vx;
  if (t < 0 || t > 3) return null;
  const z = b.z + b.vz * t;
  let y = b.y + b.vy * t - 0.5 * PHYS.gravity * t * t;
  if (y < PHYS.ballR) y = PHYS.ballR + Math.abs(y) * 0.3;
  return { z, y, t };
}
