// Lobby warm-up behind the hero: two teammates passing a ball, one juggling, one jogging laps,
// and a keeper shuffling on the line. Everything is placed relative to the hero so it always
// sits in the background of the menu camera.
import * as THREE from 'three';
import { CharacterModel } from './character.js';
import { BallMesh } from './ballmesh.js';
import { randomCosmetics } from '../cosmetics.js';
import { PHYS } from '../config.js';

const PASS_T = 1.05; // seconds the ball is in the air between the passers
const PASS_GAP = 1.1; // pause before the return pass
const JUGGLE_T = 0.72;

export class MenuCrew {
  constructor(scene, quality) {
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
    this.juggler = mk(0);
    this.jogger = mk(1);
    this.keeper = mk(1, true);
    this.balls = [new BallMesh('classic', false), new BallMesh('classic', false)];
    for (const b of this.balls) { b.mesh.castShadow = quality.shadows; this.group.add(b.root); }
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

    // --- juggler: the ball pops off the foot every JUGGLE_T seconds
    const Jp = at(7.5, -4.2);
    const camDir = at(-10, 0);
    const jt = t % JUGGLE_T;
    const jface = Math.atan2(camDir.x - Jp.x, camDir.z - Jp.z) + 0.9;
    const jb = this.balls[1].root;
    jb.position.set(Jp.x + Math.sin(jface) * 0.55 - Math.cos(jface) * 0.18, PHYS.ballR + 0.35 + Math.sin((jt / JUGGLE_T) * Math.PI) * 1.15, Jp.z + Math.cos(jface) * 0.55 + Math.sin(jface) * 0.18);
    this.balls[1].mesh.rotation.z -= dt * 6;
    this.juggler.root.position.copy(Jp);
    this.juggler.root.rotation.y = jface;
    this.juggler.update(dt, { anim: 'kick', animT: (jt + JUGGLE_T - 0.14) % JUGGLE_T * 0.62, animDur: 0.5 });

    // --- jogger: slow laps behind everything
    const C = at(22, 1);
    const ja = t * 0.42;
    const jp = new THREE.Vector3(C.x + Math.cos(ja) * 8, 0, C.z + Math.sin(ja) * 5);
    this.jogger.root.position.copy(jp);
    this.jogger.root.rotation.y = Math.atan2(-Math.sin(ja) * 8, Math.cos(ja) * 5);
    this.jogger.update(dt, { anim: 'idle', speed: 3.9 });

    // --- keeper: side-to-side shuffle on the line
    const K = at(30, 0);
    const kx = Math.sin(t * 0.8) * 2.2;
    const kv = Math.cos(t * 0.8) * 1.8;
    this.keeper.root.position.set(K.x + sx * kx, 0, K.z + sz * kx);
    this.keeper.root.rotation.y = yaw;
    this.keeper.update(dt, { anim: 'idle', speed: Math.abs(kv) * 0.7, hasBall: false });
  }

  pose(m, p, look, st, dt) {
    m.root.position.copy(p);
    m.root.rotation.y = Math.atan2(look.x - p.x, look.z - p.z);
    m.update(dt, st);
  }

  dispose() {
    for (const m of [this.passA, this.passB, this.juggler, this.jogger, this.keeper]) m.dispose();
    this.group.removeFromParent();
  }
}
