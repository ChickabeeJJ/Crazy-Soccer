// Third-person orbit camera + broadcast replay camera + menu showcase camera, with screen shake.
import * as THREE from 'three';
import { FIELD } from '../config.js';
import { clamp, damp, lerp } from '../util/math.js';

export class CameraRig {
  constructor(aspect) {
    this.cam = new THREE.PerspectiveCamera(70, aspect, 0.1, 1400);
    this.yaw = Math.PI / 2;
    this.pitch = 0.3;
    this.dist = 9;
    this.shoulder = 1.7;
    this.target = new THREE.Vector3();
    this.smoothTarget = new THREE.Vector3();
    this.trauma = 0;
    this.shakeScale = 5 / 8;
    this.time = 0;
    this.mode = 'menu';
    this.replayStyle = 0;
    this.replayPos = new THREE.Vector3(0, 15, -40);
    this.tmp = new THREE.Vector3();
    this.lookAt = new THREE.Vector3();
  }

  shake(amount) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  forward(out) {
    return out.set(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
  }

  snapTo(x, y, z) {
    this.smoothTarget.set(x, y + 2.4, z);
  }

  // In play the view is shifted up (lens shift) so the crosshair sits in the middle of the screen
  // and your player stays below it
  setLensShift(on) {
    const c = this.cam;
    const has = !!(c.view && c.view.enabled);
    if (on && !has) {
      // setViewOffset() overwrites the aspect with fullWidth/fullHeight: keep the real one
      const aspect = c.aspect;
      c.setViewOffset(1000 * aspect, 1000, 0, -75, 1000 * aspect, 1000);
      c.aspect = aspect;
      c.updateProjectionMatrix();
    }
    else if (!on && has) c.clearViewOffset();
  }

  follow(dt, px, py, pz, opts = {}) {
    this.mode = 'play';
    this.setLensShift(true);
    this.target.set(px, py + 2.4, pz);
    if (this.smoothTarget.distanceTo(this.target) > 12) this.smoothTarget.copy(this.target);
    this.smoothTarget.x = damp(this.smoothTarget.x, this.target.x, 16, dt);
    this.smoothTarget.y = damp(this.smoothTarget.y, this.target.y, 8, dt);
    this.smoothTarget.z = damp(this.smoothTarget.z, this.target.z, 16, dt);
    const f = this.forward(this.tmp);
    const d = this.dist * (opts.zoom || 1);
    const c = this.cam.position;
    // Over-the-shoulder: the camera sits a little to the right, so your player is left of the crosshair
    const sx = -Math.cos(this.yaw) * this.shoulder, sz = Math.sin(this.yaw) * this.shoulder;
    // Stay inside the arena: zooming out never puts the camera behind the end walls, stands or
    // jumbotrons. The furthest allowed distance along the view line is solved exactly and eased,
    // so the camera glides along the wall instead of stepping or snapping.
    const XL = FIELD.wallX - 0.8, ZL = FIELD.wallZ - 0.8;
    const bx = this.smoothTarget.x + sx, bz = this.smoothTarget.z + sz;
    let dMax = d;
    if (f.x > 1e-4) dMax = Math.min(dMax, (bx + XL) / f.x); else if (f.x < -1e-4) dMax = Math.min(dMax, (bx - XL) / f.x);
    if (f.z > 1e-4) dMax = Math.min(dMax, (bz + ZL) / f.z); else if (f.z < -1e-4) dMax = Math.min(dMax, (bz - ZL) / f.z);
    dMax = Math.max(1.5, dMax);
    // pull in immediately (never through the wall), ease back out
    this.wallD = this.wallD === undefined || dMax < this.wallD ? dMax : damp(this.wallD, dMax, 6, dt);
    const dd = Math.min(d, this.wallD);
    c.set(this.smoothTarget.x - f.x * dd + sx, this.smoothTarget.y - f.y * dd, this.smoothTarget.z - f.z * dd + sz);
    if (c.y < 0.6) c.y = 0.6;
    // The camera moves freely through the goals: a goal near the camera turns see-through instead
    // (Stadium.update), so nothing pushes the view around
    this.lookAt.copy(this.smoothTarget).addScaledVector(f, 4);
    this.lookAt.x += sx; this.lookAt.z += sz;
    this.cam.lookAt(this.lookAt);
    this.applyShake(dt);
  }

  replay(dt, ball, progress, side) {
    this.mode = 'replay';
    this.setLensShift(false);
    const bx = ball.x, by = ball.y, bz = ball.z;
    let px, py, pz;
    if (this.replayStyle % 2 === 0) {
      // Broadcast side camera tracking the ball
      px = bx * 0.85 - side * 6; py = 9 + progress * 2; pz = -FIELD.wallZ - 4;
    } else {
      // Behind-the-goal camera
      px = side * (FIELD.halfL + 12); py = 6.5; pz = bz * 0.4 + 6;
    }
    if (progress < 0.02) this.replayPos.set(px, py, pz);
    this.replayPos.x = damp(this.replayPos.x, px, 4, dt);
    this.replayPos.y = damp(this.replayPos.y, py, 4, dt);
    this.replayPos.z = damp(this.replayPos.z, pz, 4, dt);
    this.cam.position.copy(this.replayPos);
    this.lookAt.set(lerp(this.lookAt.x, bx, 0.25), lerp(this.lookAt.y, by + 1, 0.25), lerp(this.lookAt.z, bz, 0.25));
    if (progress < 0.02) this.lookAt.set(bx, by + 1, bz);
    this.cam.lookAt(this.lookAt);
    this.applyShake(dt);
  }

  orbit(dt, cx, cy, cz, radius, height, speed, lookY = 1.6, radiusZ = radius) {
    this.mode = 'orbit';
    this.setLensShift(false);
    this.time += dt;
    const a = this.time * speed;
    this.cam.position.set(cx + Math.sin(a) * radius, cy + height, cz + Math.cos(a) * radiusZ);
    this.cam.lookAt(cx, cy + lookY, cz);
  }

  // shift: how far the hero sits off-centre (0 = middle of the screen, >0 = towards the right)
  showcase(dt, cx, cz, faceYaw, sway, shift = 2.1) {
    this.mode = 'menu';
    this.setLensShift(false);
    this.time += dt;
    this.shift = this.shift === undefined ? shift : damp(this.shift, shift, 5, dt);
    const a = faceYaw + Math.sin(this.time * 0.25) * 0.35 + sway;
    const r = 5.7 + Math.abs(this.shift) * 0.25;
    const aspect = this.cam.aspect || 1.6;
    const sh = aspect < 1 ? 0 : this.shift;
    this.cam.position.set(cx + Math.sin(a) * r, 2.45, cz + Math.cos(a) * r);
    this.cam.lookAt(cx - Math.sin(a + Math.PI / 2) * sh, 1.6, cz - Math.cos(a + Math.PI / 2) * sh);
  }

  applyShake(dt) {
    if (this.trauma <= 0) return;
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    const s = this.trauma * this.trauma * this.shakeScale;
    const t = performance.now() / 1000;
    this.cam.position.x += Math.sin(t * 47.3) * s * 0.6;
    this.cam.position.y += Math.sin(t * 59.1 + 1.3) * s * 0.5;
    this.cam.position.z += Math.sin(t * 41.7 + 2.1) * s * 0.6;
    this.cam.rotation.z += Math.sin(t * 37.1) * s * 0.03;
  }

  setPitchLimits() {
    this.pitch = clamp(this.pitch, -0.35, 1.25);
  }
}
