// Soccer ball with a procedural pattern shader (classic patches, stripes, glow skins).
import * as THREE from 'three';
import { PHYS } from '../config.js';
import { CATALOG } from '../cosmetics.js';
import { toonGradient } from './textures.js';

// 12 pentagon centres (icosahedron vertices) + 20 hexagon centres (dodecahedron vertices):
// the spherical Voronoi diagram of these 32 points is the classic truncated-icosahedron ball.
const DIRS = (() => {
  const t = (1 + Math.sqrt(5)) / 2;
  const ico = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]];
  const i = 1 / t;
  const dod = [];
  for (const a of [-1, 1]) for (const b of [-1, 1]) for (const c of [-1, 1]) dod.push([a, b, c]);
  for (const a of [-1, 1]) for (const b of [-1, 1]) { dod.push([0, a * i, b * t]); dod.push([a * i, b * t, 0]); dod.push([a * t, 0, b * i]); }
  return [...ico, ...dod].map(([x, y, z]) => new THREE.Vector3(x, y, z).normalize());
})();

let GRAD = null;

export function makeBallMaterial(skinId) {
  const skin = CATALOG.ball.find((b) => b.id === skinId) || CATALOG.ball[0];
  if (!GRAD) GRAD = toonGradient();
  const mat = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: GRAD, emissive: skin.glow ? new THREE.Color(skin.b).multiplyScalar(0.35) : 0x000000 });
  mat.userData.uniforms = {
    colA: { value: new THREE.Color(skin.a) },
    colB: { value: new THREE.Color(skin.b) },
    stripes: { value: skin.stripes ? 1 : 0 },
    metal: { value: skin.metal ? 1 : 0 },
    dirs: { value: DIRS },
  };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, mat.userData.uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObjN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObjN = normalize(position);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vObjN;
uniform vec3 colA; uniform vec3 colB; uniform float stripes; uniform float metal; uniform vec3 dirs[32];`)
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', `
vec3 n = normalize(vObjN);
float b1 = -2.0, b2 = -2.0; int bi = 0;
for (int i = 0; i < 32; i++) {
  float d = dot(n, dirs[i]);
  if (d > b1) { b2 = b1; b1 = d; bi = i; } else if (d > b2) { b2 = d; }
}
vec3 pc;
if (stripes > 0.5) {
  float a = atan(n.z, n.x);
  float s = step(0.5, fract(a / 6.2831853 * 6.0));
  pc = mix(colA, colB, s);
  pc = mix(pc, vec3(1.0), smoothstep(0.93, 0.96, abs(n.y)));
} else {
  pc = bi < 12 ? colB : colA;
  float seam = 1.0 - smoothstep(0.004, 0.014, b1 - b2);
  pc = mix(pc, colB * 0.55, seam * 0.85);
}
if (metal > 0.5) pc *= 0.85 + 0.3 * pow(max(0.0, n.y), 2.0);
vec4 diffuseColor = vec4( diffuse * pc, opacity );`);
  };
  mat.customProgramCacheKey = () => `ball-${skin.id}`;
  return mat;
}

export class BallMesh {
  constructor(skinId = 'classic', outline = true) {
    this.root = new THREE.Group();
    const geo = new THREE.SphereGeometry(PHYS.ballR, 32, 20);
    this.mesh = new THREE.Mesh(geo, makeBallMaterial(skinId));
    this.mesh.castShadow = true;
    this.root.add(this.mesh);
    if (outline) {
      const o = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x1b1530, side: THREE.BackSide }));
      o.scale.setScalar(1.07);
      this.root.add(o);
    }
    this.skin = skinId;
    this.q = new THREE.Quaternion();
    this.axis = new THREE.Vector3();
  }

  // Shot phasing: the ball goes slightly see-through while it passes through players
  setGhost(on) {
    if (this.ghost === on) return;
    this.ghost = on;
    for (const o of this.root.children) { o.material.transparent = on; o.material.opacity = on ? 0.5 : 1; o.material.needsUpdate = true; }
  }

  setSkin(id) {
    if (id === this.skin) return;
    this.skin = id;
    this.mesh.material.dispose();
    this.mesh.material = makeBallMaterial(id);
    if (this.ghost) { this.ghost = false; this.setGhost(true); }
  }

  // Roll the ball according to its velocity
  roll(vx, vz, dt) {
    const v = Math.hypot(vx, vz);
    if (v < 0.05) return;
    this.axis.set(vz / v, 0, -vx / v);
    this.q.setFromAxisAngle(this.axis, (v * dt) / PHYS.ballR);
    this.mesh.quaternion.premultiply(this.q);
  }
}
