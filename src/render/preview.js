// Small offscreen 3D studio that renders cosmetic thumbnails (hairstyles, jerseys, emotes, balls)
// with the real in-game models, so the shop/inventory show what you actually get.
import * as THREE from 'three';
import { CharacterModel } from './character.js';
import { BallMesh } from './ballmesh.js';

export class PreviewStudio {
  // Matches the shop/inventory card art box (aspect 1.2) so nothing is cropped by CSS
  constructor(w = 312, h = 260) {
    this.w = w;
    this.h = h;
    this.r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.r.setPixelRatio(1);
    this.r.setSize(w, h, false);
    this.r.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight(0xfff6e8, 0x8a7a6a, 1.7));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(2.5, 4, 4);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xbcd2ff, 1.2);
    rim.position.set(-3, 2.5, -3);
    this.scene.add(rim);
    this.cam = new THREE.PerspectiveCamera(28, w / h, 0.05, 50);
    this.tmp = new THREE.Vector3();
  }

  snapshot() {
    const c = document.createElement('canvas');
    c.width = this.w;
    c.height = this.h;
    c.getContext('2d').drawImage(this.r.domElement, 0, 0);
    return c;
  }

  // shot: 'hair' (head close-up), 'jersey' (back, shows the number), 'emote' (full body)
  character(cos, team, shot, emote) {
    const m = new CharacterModel(cos, team, { outline: false, shadows: false });
    this.scene.add(m.root);
    const st = emote ? { anim: 'emote', animT: 0, emote } : { anim: 'idle', speed: 0 };
    for (let i = 0; i < 24; i++) { if (emote) st.animT = 0.04 * i; m.update(0.04, st); }
    if (shot === 'jersey') m.root.rotation.y = Math.PI * 0.85; // show the back with the number
    else m.root.rotation.y = shot === 'hair' ? 0.5 : shot === 'boots' ? 1.15 : 0.3;
    m.root.updateMatrixWorld(true);
    // Frame whatever the shot is about from its real bounds, so every model fits with a margin
    let box;
    if (shot === 'boots') { box = new THREE.Box3().setFromObject(m.legL.upper.parent); box.union(new THREE.Box3().setFromObject(m.legR.upper.parent)); }
    else box = new THREE.Box3().setFromObject(shot === 'hair' ? m.head : m.root);
    this.frame(box, shot === 'hair' ? 0.74 : shot === 'boots' ? 0.9 : shot === 'card' ? 0.6 : 0.78, shot === 'hair' ? 0.16 : shot === 'boots' ? 0.35 : 0.1, shot === 'hair' ? 0 : shot === 'boots' ? 0 : 0.08);
    this.r.render(this.scene, this.cam);
    const out = this.snapshot();
    m.root.removeFromParent();
    m.dispose();
    return out;
  }

  frame(box, margin, tilt, lift = 0) {
    const c = box.getCenter(new THREE.Vector3());
    const sz = box.getSize(new THREE.Vector3());
    c.y += sz.y * lift;
    const t = Math.tan(THREE.MathUtils.degToRad(this.cam.fov * 0.5));
    const d = Math.max(sz.y * 0.5 / t, Math.max(sz.x, sz.z) * 0.5 / (t * this.cam.aspect)) * margin + Math.max(sz.x, sz.z) * 0.5;
    this.cam.position.set(c.x, c.y + d * tilt, c.z + d);
    this.cam.lookAt(c);
  }

  ball(skin) {
    const b = new BallMesh(skin, false);
    b.mesh.rotation.set(0.5, 0.7, 0.2);
    this.scene.add(b.root);
    this.cam.position.set(0, 0.25, 2.6);
    this.cam.lookAt(0, 0, 0);
    this.r.render(this.scene, this.cam);
    const out = this.snapshot();
    b.root.removeFromParent();
    b.mesh.geometry.dispose();
    b.mesh.material.dispose();
    return out;
  }
}
