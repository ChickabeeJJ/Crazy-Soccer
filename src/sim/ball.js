// Ball physics: gravity, bounce, rolling, curve, walls, goal frame and nets.
import { FIELD, PHYS } from '../config.js';

export function createBall() {
  return {
    x: 0, y: PHYS.ballR, z: 0, vx: 0, vy: 0, vz: 0,
    curve: 0, owner: -1, lastTouch: -1, lastTeam: -1, prevTouch: -1, prevTeam: -1, prevT: 0,
    fire: false, inNet: 0, block: -1, blockT: 0, contestT: 0, grapple: -1, grappleT: 0,
    shot: null, pass: null, spin: 0, kicker: -1,
  };
}

// Returns list of physics events ('bounce','post','net','wall') for audio.
export function stepBall(b, dt, events) {
  const R = PHYS.ballR;
  if (b.blockT > 0) { b.blockT -= dt; if (b.blockT <= 0) b.block = -1; }
  if (b.owner >= 0) return;

  const airborne = b.y > R + 0.02;
  b.vy -= PHYS.gravity * dt;

  // Curve (lateral acceleration perpendicular to horizontal velocity)
  const vh = Math.hypot(b.vx, b.vz);
  if (Math.abs(b.curve) > 0.01 && vh > 4) {
    const px = -b.vz / vh, pz = b.vx / vh;
    b.vx += px * b.curve * dt * PHYS.magnus;
    b.vz += pz * b.curve * dt * PHYS.magnus;
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

  collideGoals(b, events);

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

function collideGoals(b, events) {
  const R = PHYS.ballR;
  const hw = FIELD.goalW / 2, H = FIELD.goalH, D = FIELD.goalD, L = FIELD.halfL, pr = FIELD.postR;
  for (const s of [-1, 1]) {
    const gx = s * L;
    // Mark the ball as "in the net" when it crosses the goal line inside the mouth.
    const past = s > 0 ? b.x > gx : b.x < gx;
    if (past && Math.abs(b.z) < hw - pr && b.y < H - pr) {
      if (b.inNet === 0) b.inNet = s;
    }
    if (!past && b.inNet === s && (s > 0 ? b.x < gx - R : b.x > gx + R)) b.inNet = 0;

    collideCylinderV(b, gx, -hw, pr, 0, H, events);
    collideCylinderV(b, gx, hw, pr, 0, H, events);
    collideBar(b, gx, H, -hw, hw, pr, events);

    const backX = gx + s * D;
    const ax = Math.abs(b.x);
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
    } else if (ax > L - R && ax < L + D + R && (s > 0) === (b.x > 0)) {
      // Outside of the net box: treat as solid
      const inZ = Math.abs(b.z) < hw + R;
      const inY = b.y < H + R;
      if (inZ && inY && ax > L) {
        const penSide = hw + R - Math.abs(b.z);
        const penTop = H + R - b.y;
        const penBack = L + D + R - ax;
        const m = Math.min(penSide, penTop, penBack);
        if (m === penTop) { b.y = H + R; if (b.vy < 0) b.vy = -b.vy * 0.35; }
        else if (m === penSide) { b.z = Math.sign(b.z || 1) * (hw + R); b.vz = Math.sign(b.z) * Math.abs(b.vz) * 0.35; }
        else { b.x = s * (L + D + R); b.vx = s * Math.abs(b.vx) * 0.35; }
      }
    }
  }
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
