// Arena environments: the open-air cliffside stadium (matches) and the indoor practice hall.
import * as THREE from 'three';
import { FIELD, TEAMS } from '../config.js';
import * as TX from './textures.js';
import { seeded } from '../util/math.js';

const LINE_COLOR = 0xe9e6ff;

function lineMat() {
  return new THREE.MeshBasicMaterial({ color: LINE_COLOR, transparent: true, opacity: 0.92, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, depthWrite: false });
}

function addRect(group, mat, x0, z0, x1, z1, w = 0.42) {
  const seg = (ax, az, bx, bz) => {
    const dx = bx - ax, dz = bz - az;
    const len = Math.hypot(dx, dz);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len + w, w), mat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = -Math.atan2(dz, dx);
    m.position.set((ax + bx) / 2, 0.02, (az + bz) / 2);
    m.receiveShadow = true;
    group.add(m);
  };
  seg(x0, z0, x1, z0); seg(x1, z0, x1, z1); seg(x1, z1, x0, z1); seg(x0, z1, x0, z0);
}

function addArc(group, mat, cx, cz, r, a0, a1, w = 0.42) {
  const g = new THREE.RingGeometry(r - w / 2, r + w / 2, 64, 1, a0, a1 - a0);
  const m = new THREE.Mesh(g, mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(cx, 0.02, cz);
  group.add(m);
  return m;
}

function buildPitch(group, indoor) {
  const W = FIELD.wallX * 2, H = FIELD.wallZ * 2;
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(W, H),
    new THREE.MeshLambertMaterial({ map: TX.grassTexture(indoor) }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  const mat = lineMat();
  const L = FIELD.halfL, Wz = FIELD.halfW;
  addRect(group, mat, -L, -Wz, L, Wz);
  // halfway
  const half = new THREE.Mesh(new THREE.PlaneGeometry(0.42, Wz * 2), mat);
  half.rotation.x = -Math.PI / 2; half.position.y = 0.02; group.add(half);
  addArc(group, mat, 0, 0, FIELD.centerR, 0, Math.PI * 2);
  const spot = new THREE.Mesh(new THREE.CircleGeometry(0.45, 20), mat);
  spot.rotation.x = -Math.PI / 2; spot.position.y = 0.021; group.add(spot);
  for (const s of [-1, 1]) {
    addRect(group, mat, s * L, -FIELD.boxW / 2, s * (L - FIELD.boxL), FIELD.boxW / 2);
    addRect(group, mat, s * L, -FIELD.smallBoxW / 2, s * (L - FIELD.smallBoxL), FIELD.smallBoxW / 2);
    const ps = new THREE.Mesh(new THREE.CircleGeometry(0.35, 16), mat);
    ps.rotation.x = -Math.PI / 2; ps.position.set(s * (L - 10), 0.021, 0); group.add(ps);
    // Penalty arc (outside the box)
    const a = Math.acos(4 / 7);
    if (s > 0) addArc(group, mat, L - 10, 0, 7, Math.PI - a, Math.PI + a);
    else addArc(group, mat, -L + 10, 0, 7, -a, a);
    // Corner arcs
    for (const cz of [-1, 1]) {
      const base = s > 0 ? (cz > 0 ? Math.PI * 0.5 : Math.PI) : (cz > 0 ? 0 : Math.PI * 1.5);
      addArc(group, mat, s * L, cz * Wz, 1.6, base, base + Math.PI / 2);
    }
  }
}

function buildGoal(group, side, team) {
  const T = TEAMS[team];
  const g = new THREE.Group();
  const L = FIELD.halfL, hw = FIELD.goalW / 2, H = FIELD.goalH, D = FIELD.goalD;
  const postMat = new THREE.MeshToonMaterial({ color: 0xffffff, emissive: 0x333344 });
  const r = FIELD.postR;
  const frame = [];
  for (const z of [-hw, hw]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(r, r, H, 12), postMat);
    post.position.set(side * L, H / 2, z);
    post.castShadow = true;
    g.add(post);
    frame.push(post);
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(r, r, hw * 2 + r * 2, 12), postMat);
  bar.rotation.x = Math.PI / 2;
  bar.position.set(side * L, H, 0);
  bar.castShadow = true;
  g.add(bar);
  frame.push(bar);
  // Back frame
  const frameMat = new THREE.MeshToonMaterial({ color: T.dark });
  const bx = side * (L + D);
  for (const z of [-hw, hw]) {
    const bp = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, H, 8), frameMat);
    bp.position.set(bx, H / 2, z);
    g.add(bp);
    const tp = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, D, 8), frameMat);
    tp.rotation.z = Math.PI / 2;
    tp.position.set(side * (L + D / 2), H, z);
    g.add(tp);
    frame.push(bp, tp);
  }
  // Glowing hex net
  const netTex = TX.hexNetTexture();
  const netMat = new THREE.MeshBasicMaterial({ color: T.net, map: netTex, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
  const glassMat = new THREE.MeshBasicMaterial({ color: T.net, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false });
  const back = new THREE.PlaneGeometry(hw * 2, H);
  const sideG = new THREE.PlaneGeometry(D, H);
  const topG = new THREE.PlaneGeometry(D, hw * 2);
  const add = (geo, pos, rot, mat) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(pos);
    m.rotation.set(rot[0], rot[1], rot[2]);
    m.renderOrder = 2;
    g.add(m);
    return m;
  };
  for (const mat of [glassMat, netMat]) {
    add(back, new THREE.Vector3(bx, H / 2, 0), [0, Math.PI / 2, 0], mat);
    add(sideG, new THREE.Vector3(side * (L + D / 2), H / 2, -hw), [0, 0, 0], mat);
    add(sideG, new THREE.Vector3(side * (L + D / 2), H / 2, hw), [0, 0, 0], mat);
    add(topG, new THREE.Vector3(side * (L + D / 2), H, 0), [Math.PI / 2, 0, 0], mat);
  }
  // Goal-mouth glow strip on the floor
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(D, hw * 2), new THREE.MeshBasicMaterial({ color: T.net, transparent: true, opacity: 0.25, depthWrite: false }));
  strip.rotation.x = -Math.PI / 2;
  strip.position.set(side * (L + D / 2), 0.03, 0);
  g.add(strip);
  group.add(g);
  return { group: g, netMat, glassMat, frame, baseOpacity: 0.22, flash: 0, side, team };
}

function buildWalls(group) {
  const tex = TX.wallTexture();
  const h = 1.6;
  const mk = (len, x, z, rotY) => {
    const t = tex.clone();
    t.needsUpdate = true;
    t.wrapS = THREE.RepeatWrapping;
    t.repeat.set(len / 10, 1);
    const mat = new THREE.MeshLambertMaterial({ map: t });
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, h, 0.5), mat);
    m.position.set(x, h / 2, z);
    m.rotation.y = rotY;
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    // top rail
    const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.18, 0.7), new THREE.MeshLambertMaterial({ color: 0x2a2233 }));
    rail.position.set(x, h + 0.09, z);
    rail.rotation.y = rotY;
    group.add(rail);
  };
  const X = FIELD.wallX + 0.25, Z = FIELD.wallZ + 0.25;
  mk(X * 2 + 0.5, 0, -Z, 0);
  mk(X * 2 + 0.5, 0, Z, 0);
  mk(Z * 2, -X, 0, Math.PI / 2);
  mk(Z * 2, X, 0, Math.PI / 2);
}

function buildOutdoor(root, quality) {
  const g = new THREE.Group();
  root.add(g);
  // Sky dome
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { top: { value: new THREE.Color('#3f8fe8') }, mid: { value: new THREE.Color('#9fd4ff') }, bottom: { value: new THREE.Color('#fff1dc') } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.12 ? mix(mid, top, smoothstep(0.12, 0.8, h)) : mix(bottom, mid, smoothstep(-0.05, 0.12, h)); gl_FragColor = vec4(c, 1.0); }',
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(520, 32, 16), skyMat);
  sky.renderOrder = -10;
  g.add(sky);

  // Sun
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: TX.glowTexture(), color: 0xfffbe8, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  sun.position.set(-210, 190, 240);
  sun.scale.set(120, 120, 1);
  g.add(sun);
  const sunCore = new THREE.Mesh(new THREE.CircleGeometry(16, 32), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  sunCore.position.copy(sun.position);
  sunCore.lookAt(0, 0, 0);
  g.add(sunCore);

  // Painted panorama ring
  const pano = new THREE.Mesh(
    new THREE.CylinderGeometry(390, 390, 300, 64, 1, true),
    new THREE.MeshBasicMaterial({ map: TX.panoramaTexture(), side: THREE.BackSide, transparent: true, depthWrite: false, fog: false }),
  );
  pano.position.y = 120 - 150 - 4;
  pano.renderOrder = -9;
  g.add(pano);

  // Sea
  const sea = new THREE.Mesh(new THREE.CircleGeometry(385, 64), new THREE.MeshLambertMaterial({ color: 0x3fb0dc }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -22;
  g.add(sea);

  // Clouds
  const ctex = TX.cloudTexture();
  const rnd = seeded(3);
  for (let i = 0; i < 16; i++) {
    const a = rnd() * Math.PI * 2, r = 230 + rnd() * 110;
    const cl = new THREE.Sprite(new THREE.SpriteMaterial({ map: ctex, transparent: true, opacity: 0.85, depthWrite: false, fog: false }));
    cl.position.set(Math.cos(a) * r, 55 + rnd() * 90, Math.sin(a) * r);
    const s = 50 + rnd() * 60;
    cl.scale.set(s * 2, s, 1);
    g.add(cl);
  }

  // Arena base: grassy cliff plateau, sized to the pitch
  const IR = Math.hypot(FIELD.wallX, FIELD.wallZ) + 9;
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(IR, IR - 18, 24, 48, 1),
    new THREE.MeshLambertMaterial({ color: 0x6d6aa8 }),
  );
  base.position.y = -12.05;
  g.add(base);
  const topRing = new THREE.Mesh(new THREE.CylinderGeometry(IR + 0.5, IR + 0.5, 0.6, 48), new THREE.MeshLambertMaterial({ color: 0x5fae4f }));
  topRing.position.y = -0.35;
  g.add(topRing);
  // Rocks around
  const rockMat = new THREE.MeshLambertMaterial({ color: 0x7c76b8, flatShading: true });
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2;
    const r = IR - 12 + rnd() * 20;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(3 + rnd() * 6, 0), rockMat);
    rock.position.set(Math.cos(a) * r, -6 - rnd() * 10, Math.sin(a) * r);
    rock.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    g.add(rock);
  }
  // Trees on the plateau rim
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a4b2a });
  const leafMats = [new THREE.MeshToonMaterial({ color: 0x3f9a45 }), new THREE.MeshToonMaterial({ color: 0x58b84c })];
  for (let i = 0; i < 22; i++) {
    const a = rnd() * Math.PI * 2;
    const r = IR - 10 + rnd() * 8;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.abs(x) < FIELD.wallX + 4 && Math.abs(z) < FIELD.wallZ + 4) continue;
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 5, 6), trunkMat);
    trunk.position.y = 2.5;
    tree.add(trunk);
    for (let k = 0; k < 3; k++) {
      const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(3.2 - k * 0.6, 0), leafMats[k % 2]);
      leaf.position.set((rnd() - 0.5) * 2, 6 + k * 2, (rnd() - 0.5) * 2);
      tree.add(leaf);
    }
    tree.position.set(x, 0, z);
    tree.scale.setScalar(0.8 + rnd() * 0.6);
    g.add(tree);
  }

  // Leaning neon pillars
  const ptex = TX.pillarTexture();
  const pmat = new THREE.MeshLambertMaterial({ color: 0x2a2430, emissive: 0xffffff, emissiveMap: ptex, emissiveIntensity: 0.9, map: ptex });
  const spots = [[-1, -1], [1, -1], [-1, 1], [1, 1], [-0.42, -1], [0.42, -1], [-0.42, 1], [0.42, 1]];
  for (const [sx, sz] of spots) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(1.6, 26, 1.3), pmat);
    const x = sx * (Math.abs(sx) === 1 ? FIELD.wallX + 3.5 : FIELD.wallX), z = sz * (FIELD.wallZ + 3.5);
    p.position.set(x, 12, z);
    p.rotation.z = -sx * 0.07;
    p.rotation.x = sz * 0.1;
    p.castShadow = quality.shadows;
    g.add(p);
  }
  // Outer floor between wall and plateau edge
  const outer = new THREE.Mesh(new THREE.RingGeometry(Math.hypot(FIELD.wallX, FIELD.wallZ) - 6, IR + 0.5, 48), new THREE.MeshLambertMaterial({ color: 0x4f9a3f }));
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = -0.04;
  g.add(outer);
  return g;
}

function buildDesertWalls(group) {
  const X = FIELD.wallX + 0.25, Z = FIELD.wallZ + 0.25;
  const stone = TX.stoneTexture();
  const wood = new THREE.MeshToonMaterial({ color: 0x7a4a2a });
  const woodDark = new THREE.MeshToonMaterial({ color: 0x5a341c });
  const side = (len, x, z, rotY) => {
    const t = stone.clone();
    t.needsUpdate = true;
    t.repeat.set(len / 12, 1);
    const base = new THREE.Mesh(new THREE.BoxGeometry(len, 0.9, 0.8), new THREE.MeshLambertMaterial({ map: t }));
    base.position.set(x, 0.45, z);
    base.rotation.y = rotY;
    base.castShadow = true; base.receiveShadow = true;
    group.add(base);
    for (const y of [1.25, 1.75]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.16, 0.2), wood);
      rail.position.set(x, y, z);
      rail.rotation.y = rotY;
      group.add(rail);
    }
    const n = Math.floor(len / 3.2);
    for (let i = 0; i <= n; i++) {
      const k = -len / 2 + (i * len) / n;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.4, 0.28), woodDark);
      const px = rotY ? x : x + k, pz = rotY ? z + k : z;
      post.position.set(px, 1.5, pz);
      group.add(post);
    }
  };
  side(X * 2 + 0.5, 0, -Z, 0);
  side(X * 2 + 0.5, 0, Z, 0);
  side(Z * 2, -X, 0, Math.PI / 2);
  side(Z * 2, X, 0, Math.PI / 2);
}

function buildDesert(root, quality) {
  const g = new THREE.Group();
  root.add(g);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { top: { value: new THREE.Color('#8fc4f0') }, mid: { value: new THREE.Color('#e6eef5') }, bottom: { value: new THREE.Color('#ffe9cf') } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.12 ? mix(mid, top, smoothstep(0.12, 0.8, h)) : mix(bottom, mid, smoothstep(-0.05, 0.12, h)); gl_FragColor = vec4(c, 1.0); }',
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(520, 32, 16), skyMat);
  sky.renderOrder = -10;
  g.add(sky);
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: TX.glowTexture(), color: 0xfff4dc, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  sun.position.set(-210, 190, 240);
  sun.scale.set(140, 140, 1);
  g.add(sun);
  const pano = new THREE.Mesh(
    new THREE.CylinderGeometry(390, 390, 300, 64, 1, true),
    new THREE.MeshBasicMaterial({ map: TX.desertPanoramaTexture(), side: THREE.BackSide, transparent: true, depthWrite: false, fog: false }),
  );
  pano.position.y = -34;
  pano.renderOrder = -9;
  g.add(pano);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(386, 64), new THREE.MeshLambertMaterial({ color: 0xdcb87e }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.06;
  g.add(ground);
  // Dunes around the arena
  const rnd = seeded(17);
  const duneMat = new THREE.MeshLambertMaterial({ color: 0xe8cd9c });
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2, r = 80 + rnd() * 120;
    const d = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), duneMat);
    d.position.set(Math.cos(a) * r, -0.5, Math.sin(a) * r);
    d.scale.set(20 + rnd() * 30, 6 + rnd() * 12, 14 + rnd() * 20);
    d.rotation.y = rnd() * 3;
    g.add(d);
  }
  // Crystal clusters
  const crystalMats = [new THREE.MeshToonMaterial({ color: 0x8a6bd8 }), new THREE.MeshToonMaterial({ color: 0xb49cf0 }), new THREE.MeshToonMaterial({ color: 0x6b4fb0 })];
  for (let i = 0; i < 18; i++) {
    const a = rnd() * Math.PI * 2, r = 70 + rnd() * 60;
    const cl = new THREE.Group();
    for (let k = 0; k < 5; k++) {
      const h = 6 + rnd() * 16;
      const sh = new THREE.Mesh(new THREE.ConeGeometry(1.2 + rnd() * 1.6, h, 5), crystalMats[k % 3]);
      sh.position.set((rnd() - 0.5) * 6, h / 2 - 1, (rnd() - 0.5) * 6);
      sh.rotation.set((rnd() - 0.5) * 0.7, rnd() * 3, (rnd() - 0.5) * 0.7);
      cl.add(sh);
    }
    cl.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    g.add(cl);
  }
  // Rocks
  const rockMat = new THREE.MeshLambertMaterial({ color: 0xa9603a, flatShading: true });
  for (let i = 0; i < 22; i++) {
    const a = rnd() * Math.PI * 2, r = 62 + rnd() * 40;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(2 + rnd() * 4, 0), rockMat);
    rock.position.set(Math.cos(a) * r, 0.5, Math.sin(a) * r);
    rock.scale.y = 0.6;
    g.add(rock);
  }
  // Tall wooden poles (like the reference arena)
  const poleMat = new THREE.MeshToonMaterial({ color: 0x6b3f22 });
  const spots = [[-1, -1], [1, -1], [-1, 1], [1, 1], [-0.42, -1], [0.42, -1], [-0.42, 1], [0.42, 1]];
  for (const [sx, sz] of spots) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.8, 24, 8), poleMat);
    const x = sx * (Math.abs(sx) === 1 ? FIELD.wallX + 3.5 : FIELD.wallX), z = sz * (FIELD.wallZ + 3.5);
    p.position.set(x, 11, z);
    p.rotation.z = -sx * 0.06;
    p.rotation.x = sz * 0.08;
    p.castShadow = quality.shadows;
    g.add(p);
  }
  return g;
}

function buildIndoor(root) {
  const g = new THREE.Group();
  root.add(g);
  const X = FIELD.wallX + 6, Z = FIELD.wallZ + 6, H = 15;
  const ctex = TX.curtainTexture();
  const wall = (w, x, z, ry) => {
    const t = ctex.clone();
    t.needsUpdate = true;
    t.repeat.set(w / 10, 1);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, H), new THREE.MeshLambertMaterial({ map: t }));
    m.position.set(x, H / 2 - 0.1, z);
    m.rotation.y = ry;
    g.add(m);
  };
  wall(X * 2, 0, -Z, 0);
  wall(X * 2, 0, Z, Math.PI);
  wall(Z * 2, -X, 0, Math.PI / 2);
  wall(Z * 2, X, 0, -Math.PI / 2);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(X * 2, Z * 2), new THREE.MeshLambertMaterial({ color: 0x8a3b2a }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.05;
  g.add(floor);
  // Lattice dome (half cylinder along the length of the hall)
  const ltex = TX.latticeTexture();
  const dome = new THREE.Mesh(
    new THREE.CylinderGeometry(Z, Z, X * 2, 40, 1, true, 0, Math.PI),
    new THREE.MeshLambertMaterial({ map: ltex, side: THREE.BackSide, emissive: 0x3a3a48 }),
  );
  dome.rotation.z = Math.PI / 2;
  dome.position.y = H - 0.2;
  g.add(dome);
  // End caps of the dome
  const capMat = new THREE.MeshLambertMaterial({ color: 0x9e2f22, side: THREE.DoubleSide });
  for (const s of [-1, 1]) {
    const cap = new THREE.Mesh(new THREE.CircleGeometry(Z, 40, 0, Math.PI), capMat);
    cap.position.set(s * X, H - 0.2, 0);
    cap.rotation.y = Math.PI / 2;
    g.add(cap);
  }
  // Arched ribs + columns
  const ribMat = new THREE.MeshToonMaterial({ color: 0xa8321f });
  for (let x = -X + 7; x <= X - 7; x += 15) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(Z - 0.6, 0.8, 8, 40, Math.PI), ribMat);
    rib.position.set(x, H - 0.2, 0);
    rib.rotation.y = Math.PI / 2;
    g.add(rib);
    for (const s of [-1, 1]) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(1.6, H, 1.6), ribMat);
      col.position.set(x, H / 2 - 0.1, s * (Z - 0.6));
      g.add(col);
    }
  }
  // Banners
  const btex = TX.bannerTexture('SHOOTING PRACTICE');
  const ktex = TX.bannerTexture('KEEPER PRACTICE', '#2a1f3a');
  for (const s of [-1, 1]) {
    const b = new THREE.Mesh(new THREE.PlaneGeometry(60, 2.4), new THREE.MeshBasicMaterial({ map: s > 0 ? btex : ktex }));
    b.position.set(0, 2.6, s * (FIELD.wallZ + 0.6));
    b.rotation.y = s > 0 ? Math.PI : 0;
    g.add(b);
  }
  // Hanging lamps
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe2b0 });
  const shadeMat = new THREE.MeshToonMaterial({ color: 0x2a2233 });
  const cordMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
  for (let x = -30; x <= 30; x += 20) {
    for (const z of [-10, 10]) {
      const lamp = new THREE.Group();
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 14, 4), cordMat);
      cord.position.y = 7;
      lamp.add(cord);
      const shade = new THREE.Mesh(new THREE.ConeGeometry(1.4, 1.1, 16, 1, true), shadeMat);
      shade.material.side = THREE.DoubleSide;
      lamp.add(shade);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), lampMat);
      bulb.position.y = -0.45;
      lamp.add(bulb);
      lamp.position.set(x, H + 9, z);
      g.add(lamp);
    }
  }
  return g;
}

export class Stadium {
  constructor(scene, quality) {
    this.scene = scene;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.pitchOutdoor = new THREE.Group();
    this.pitchIndoor = new THREE.Group();
    this.pitchDesert = new THREE.Group();
    buildPitch(this.pitchOutdoor, false);
    buildPitch(this.pitchIndoor, true);
    buildPitch(this.pitchDesert, 'desert');
    this.root.add(this.pitchOutdoor, this.pitchIndoor, this.pitchDesert);
    this.common = new THREE.Group();
    this.root.add(this.common);
    this.wallsStd = new THREE.Group();
    this.wallsDesert = new THREE.Group();
    this.root.add(this.wallsStd, this.wallsDesert);
    buildWalls(this.wallsStd);
    buildDesertWalls(this.wallsDesert);
    this.goals = [buildGoal(this.common, -1, 0), buildGoal(this.common, 1, 1)];
    this.outdoor = buildOutdoor(this.root, quality);
    this.indoor = buildIndoor(this.root);
    this.desert = buildDesert(this.root, quality);
    this.time = 0;
    this.setVariant('grass');
  }

  // 'grass' (cliffside arena), 'desert' (canyon arena) or 'indoor' (practice hall)
  setVariant(v) {
    if (v === 'outdoor') v = 'grass';
    this.variant = v;
    this.outdoor.visible = v === 'grass';
    this.pitchOutdoor.visible = v === 'grass';
    this.indoor.visible = v === 'indoor';
    this.pitchIndoor.visible = v === 'indoor';
    this.desert.visible = v === 'desert';
    this.pitchDesert.visible = v === 'desert';
    this.wallsStd.visible = v !== 'desert';
    this.wallsDesert.visible = v === 'desert';
  }

  flashGoal(side) {
    const g = this.goals.find((x) => x.side === side);
    if (g) g.flash = 1.6;
  }

  update(dt, cam) {
    this.time += dt;
    for (const g of this.goals) {
      if (g.flash > 0) g.flash -= dt;
      const f = Math.max(0, g.flash);
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 2 + g.side);
      // Fade the net out when the camera is inside or right behind this goal (keepers)
      let near = 0;
      if (cam) {
        const ax = cam.x * g.side;
        if (ax > FIELD.halfL - 1 && Math.abs(cam.z) < FIELD.goalW / 2 + 3 && cam.y < FIELD.goalH + 4) near = 1;
      }
      g.fade = (g.fade || 0) + (near - (g.fade || 0)) * Math.min(1, dt * 8);
      const k = 1 - g.fade * 0.85;
      const showFrame = g.fade < 0.5;
      if (g.frameShown !== showFrame) { g.frameShown = showFrame; for (const m of g.frame) m.visible = showFrame; }
      g.netMat.opacity = (0.75 + pulse * 0.15 + f * 0.25) * k;
      g.glassMat.opacity = (g.baseOpacity + f * 0.35 * (0.5 + 0.5 * Math.sin(this.time * 30))) * k;
    }
  }
}
