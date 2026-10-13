// Lobby warm-up behind the hero: two teammates passing a ball and a striker
// firing shots at a diving keeper (goals set off the crowd). Everything is placed relative to the hero so it always
// sits in the background of the menu camera.
import * as THREE from 'three';
import { CharacterModel } from './character.js';
import { BallMesh } from './ballmesh.js';
import { randomCosmetics } from '../cosmetics.js';
import { PHYS, FIELD } from '../config.js';

const PASS_T = 1.05; // seconds the ball is in the air between the passers
const PASS_GAP = 1.1; // pause before the return pass

export class MenuCrew {
  constructor(scene, quality, onGoal) {
    this.onGoal = onGoal;
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    const mk = (team, keeper = false) => {
      const cos = randomCosmetics();
      const m = new CharacterModel(cos, team, { shadows: quality.shadows });
      if (keeper) m.setAppearance(cos, team, true);
      this.group.add(m.root);
      return m;
    };
    this.passA = mk(0);
    this.passB = mk(1);
    this.striker = mk(0);
    this.keeper = mk(1, true);
    this.balls = [new BallMesh('classic', false), null, new BallMesh('classic', false)];
    for (const b of this.balls.filter(Boolean)) { b.mesh.castShadow = quality.shadows; this.group.add(b.root); }
    this.t = 0;
    this.prev = new Map();
  }

  setVisible(on) { this.group.visible = on; }

  // origin: hero position, yaw: hero facing. The crew stands behind the hero (away from the camera).
  update(dt, origin, yaw) {
    this.t += dt;
    const t = this.t;
    const fx = Math.sin(yaw), fz = Math.cos(yaw); // hero forward (towards the camera)
    const sx = fz, sz = -fx; // sideways
    const at = (back, side) => new THREE.Vector3(origin.x - fx * back + sx * side, 0, origin.z - fz * back + sz * side);

    // --- passers
    const A = at(13, -7), B = at(15, 6);
    const cycle = 2 * (PASS_T + PASS_GAP);
    const c = t % cycle;
    const leg = c < PASS_T + PASS_GAP ? 0 : 1; // 0: A -> B, 1: B -> A
    const lt = c - leg * (PASS_T + PASS_GAP);
    const from = leg ? B : A, to = leg ? A : B;
    const ball = this.balls[0].root;
    if (lt < PASS_T) {
      const k = lt / PASS_T;
      ball.position.lerpVectors(from, to, k);
      ball.position.y = PHYS.ballR + Math.sin(k * Math.PI) * 0.9;
      this.balls[0].mesh.rotation.x += dt * 9;
    } else {
      ball.position.copy(to);
      ball.position.y = PHYS.ballR;
    }
    // kick fires just before the ball leaves; contact lands at ~0.16 s into the kick
    const kickT = (who) => {
      const start = who === 0 ? -0.16 : PASS_T + PASS_GAP - 0.16;
      let d = c - start;
      if (d < 0) d += cycle;
      return d;
    };
    this.pose(this.passA, A, B, kickT(0) < 0.6 ? { anim: 'kick', animT: kickT(0) } : { anim: 'idle', speed: 0 }, dt);
    this.pose(this.passB, B, A, kickT(1) < 0.6 ? { anim: 'kick', animT: kickT(1) } : { anim: 'idle', speed: 0 }, dt);


    // --- shootout at the goal behind the hero: run-up, strike, keeper dive, goal or save
    const SHOT = 6.5;
    const st = t % SHOT;
    const cyc = Math.floor(t / SHOT);
    const rnd = (k) => { const x = Math.sin(cyc * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
    const gx = -FIELD.halfL, side = rnd(1) < 0.5 ? -1 : 1, saved = rnd(2) < 0.35;
    const spot = new THREE.Vector3(gx + 17, 0, side * -3);
    const target = new THREE.Vector3(gx - 1.2, 1.2 + rnd(3) * 2.6, side * (3.2 + rnd(4) * 3.6));
    const sb = this.balls[2].root;
    const kp = this.keeper.root.position;
    const runUp = 1.1, flight = 0.62;
    // striker
    const start = new THREE.Vector3(spot.x + 6, 0, spot.z - side * 3.5);
    if (st < runUp) {
      const k = st / runUp;
      this.striker.root.position.lerpVectors(start, spot, k).add(new THREE.Vector3(1.0, 0, 0));
      this.striker.root.rotation.y = Math.atan2(spot.x - start.x, spot.z - start.z);
      this.striker.update(dt, { anim: 'idle', speed: 9, sprinting: true });
    } else if (st < runUp + 0.6) {
      this.striker.root.position.set(spot.x + 0.9, 0, spot.z);
      this.striker.root.rotation.y = Math.atan2(target.x - spot.x, target.z - spot.z);
      this.striker.update(dt, { anim: 'kick', animT: st - runUp + 0.12 });
    } else {
      const celebrate = !saved && st > runUp + flight + 0.2 && st < 4.6;
      this.striker.root.position.set(spot.x + 0.9, 0, spot.z);
      this.striker.update(dt, celebrate ? { anim: 'cheer', animT: st - runUp - flight } : { anim: 'idle', speed: 0 });
    }
    // ball
    const fly = st - runUp - 0.04;
    if (fly < 0) { sb.position.set(spot.x, PHYS.ballR, spot.z); }
    else if (fly < flight) {
      const k = fly / flight;
      sb.position.lerpVectors(spot, target, k);
      sb.position.y = PHYS.ballR + (target.y - PHYS.ballR) * k + Math.sin(k * Math.PI) * 1.2;
      this.balls[2].mesh.rotation.x += dt * 20;
      if (saved && k > 0.82) { sb.position.lerpVectors(spot, target, 0.82); sb.position.y = target.y; }
    } else if (saved) {
      const k = Math.min(1, (fly - flight) / 0.9);
      sb.position.set(target.x + 0.9 + k * 6, Math.max(PHYS.ballR, target.y + Math.sin(k * Math.PI) * 2 - k * target.y), target.z - side * k * 5);
    } else {
      sb.position.set(gx - 3.4, Math.max(PHYS.ballR, target.y - (fly - flight) * 4), target.z);
      if (!this.scored || this.scored !== cyc) { this.scored = cyc; if (this.onGoal) this.onGoal(new THREE.Vector3(gx - 2, target.y, target.z)); }
    }
    // keeper: set, then dive towards the shot
    const diveAt = runUp + 0.18;
    if (st < diveAt) {
      kp.set(gx + 1.2, 0, Math.sin(t * 2.4) * 0.6);
      this.keeper.root.rotation.y = Math.PI / 2;
      this.keeper.update(dt, { anim: 'idle', speed: 1.2 });
    } else if (st < 3.6) {
      const k = Math.min(1, (st - diveAt) / 0.5);
      const reach = saved ? Math.abs(target.z) - 0.6 : Math.abs(target.z) * 0.55;
      kp.set(gx + 1.2, Math.sin(k * Math.PI) * 0.6, side * reach * k);
      this.keeper.root.rotation.y = side > 0 ? 0 : Math.PI;
      this.keeper.update(dt, { anim: 'dive', animT: st - diveAt, animDur: 0.62 });
    } else {
      kp.set(gx + 1.2, 0, side * 0.5);
      this.keeper.root.rotation.y = Math.PI / 2;
      this.keeper.update(dt, { anim: st < 4.2 ? 'getup' : 'idle', animT: st - 3.6, speed: 0 });
    }
  }

  pose(m, p, look, st, dt) {
    m.root.position.copy(p);
    m.root.rotation.y = Math.atan2(look.x - p.x, look.z - p.z);
    m.update(dt, st);
  }

  dispose() {
    for (const m of [this.passA, this.passB, this.striker, this.keeper]) m.dispose();
    this.group.removeFromParent();
  }
}
