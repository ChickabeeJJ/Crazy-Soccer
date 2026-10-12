// Arena environments: the open-air cliffside stadium (matches) and the indoor practice hall.
import * as THREE from 'three';
import { FIELD, TEAMS } from '../config.js';
import * as TX from './textures.js';
import { softBeamMaterial } from './beam.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
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
  return { group: g, netMat, glassMat, postMat, frameMat, frame, baseOpacity: 0.22, flash: 0, side, team };
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

// Tiered stands along both touchlines with roofs, team-coloured trim and an instanced crowd
function buildStands(g, o, quality) {
  const rnd = seeded(o.seed || 5);
  const L = FIELD.halfL - 4, Z0 = FIELD.wallZ + 5.5;
  const tiers = 5, td = 2.1, th = 1.1;
  const standMat = new THREE.MeshLambertMaterial({ color: o.stand });
  const trimMat = new THREE.MeshLambertMaterial({ color: o.trim });
  const seats = [];
  for (const s of [-1, 1]) {
    for (let t = 0; t < tiers; t++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(L * 2, th * (t + 1), td), standMat);
      step.position.set(0, (th * (t + 1)) / 2, s * (Z0 + t * td + td / 2));
      step.receiveShadow = true;
      g.add(step);
      for (let x = -L + 0.8; x < L - 0.8; x += 1.15 + rnd() * 0.4) if (rnd() < o.fill) seats.push([x + (rnd() - 0.5) * 0.3, th * (t + 1), s * (Z0 + t * td + td * 0.55)]);
    }
    const H = th * tiers + 5;
    const back = new THREE.Mesh(new THREE.BoxGeometry(L * 2 + 2, H, 0.8), standMat);
    back.position.set(0, H / 2, s * (Z0 + tiers * td + 0.4));
    back.castShadow = quality.shadows;
    g.add(back);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(L * 2 + 4, 0.5, tiers * td + 3.5), trimMat);
    roof.position.set(0, H, s * (Z0 + (tiers * td) / 2 + 0.2));
    roof.rotation.x = s * 0.12;
    roof.castShadow = quality.shadows;
    g.add(roof);
    for (let x = -L; x <= L; x += L / 3) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.5, H, 0.5), trimMat);
      col.position.set(x, H / 2, s * (Z0 + tiers * td));
      g.add(col);
    }
    const team = TEAMS[s < 0 ? 0 : 1];
    const trim = new THREE.Mesh(new THREE.BoxGeometry(L * 2, 0.4, 0.15), new THREE.MeshBasicMaterial({ color: team.color }));
    trim.position.set(0, th - 0.15, s * (Z0 - 0.08));
    g.add(trim);
    const glow = new THREE.Mesh(new THREE.BoxGeometry(L * 2 + 4, 0.18, 0.18), new THREE.MeshBasicMaterial({ color: team.color }));
    glow.position.set(0, H - 0.35, s * (Z0 - 1.4));
    g.add(glow);
  }
  // End stands behind both goals: lower, open-air, topped by a jumbotron
  const X0 = FIELD.wallX + 5, ZL = FIELD.wallZ - 5, et = 4;
  for (const s of [-1, 1]) {
    for (let t = 0; t < et; t++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(td, th * (t + 1), ZL * 2), standMat);
      step.position.set(s * (X0 + t * td + td / 2), (th * (t + 1)) / 2, 0);
      step.receiveShadow = true;
      g.add(step);
      for (let z = -ZL + 0.8; z < ZL - 0.8; z += 1.15 + rnd() * 0.4) if (rnd() < o.fill * 0.92) seats.push([s * (X0 + t * td + td * 0.55), th * (t + 1), z + (rnd() - 0.5) * 0.3]);
    }
    const H = th * et + 2.5;
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.8, H, ZL * 2 + 1), standMat);
    back.position.set(s * (X0 + et * td + 0.4), H / 2, 0);
    back.castShadow = quality.shadows;
    g.add(back);
    const team = TEAMS[s < 0 ? 0 : 1];
    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.4, ZL * 2), new THREE.MeshBasicMaterial({ color: team.color }));
    trim.position.set(s * (X0 - 0.08), th - 0.15, 0);
    g.add(trim);
    addJumbotron(g, s, X0 + et * td + 1.6, H, trimMat);
  }
  // Crowd: shirts + heads (two instanced meshes)
  const body = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.27, 0.45, 1, 5), new THREE.MeshLambertMaterial(), seats.length);
  const head = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.22, 0), new THREE.MeshLambertMaterial(), seats.length);
  const shirts = [TEAMS[0].color, TEAMS[0].color, TEAMS[1].color, TEAMS[1].color, 0xffffff, 0x2a2238, 0xffcf3f, 0x4cf08a];
  const skins = [0xf6d2b0, 0xe8b48e, 0xc98a5e, 0x9a6440, 0x6b4128];
  const m = new THREE.Matrix4(), c = new THREE.Color();
  seats.forEach(([x, y, z], i) => {
    m.makeTranslation(x, y + 0.5, z); body.setMatrixAt(i, m);
    m.makeTranslation(x, y + 1.08, z); head.setMatrixAt(i, m);
    // Fans lean towards their team's colours on their own stand
    const pick = z < 0 && rnd() < 0.45 ? 0 : z > 0 && rnd() < 0.45 ? 2 : Math.floor(rnd() * shirts.length);
    body.setColorAt(i, c.set(shirts[pick]));
    head.setColorAt(i, c.set(skins[Math.floor(rnd() * skins.length)]));
  });
  g.add(body, head);
  return { body, head, seats, phase: seats.map(() => rnd() * Math.PI * 2), hype: 0 };
}

// Floodlight heads: a deep housing with a grid of round lamps behind visors, a warm halo, and a
// soft volumetric beam towards the pitch
function addFloodlights(g, spots, h) {
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff6e2 });
  const rimMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
  const frameMat = new THREE.MeshLambertMaterial({ color: 0x1d1830 });
  const visorMat = new THREE.MeshLambertMaterial({ color: 0x2a2440 });
  const beamMat = softBeamMaterial(0xffe6c0, 0.2, { top: 1, bottom: 0.2 });
  const glowTex = TX.glowTexture();
  const lampGeo = new THREE.CircleGeometry(0.36, 20);
  const rimGeo = new THREE.RingGeometry(0.36, 0.44, 20);
  const visorGeo = new THREE.BoxGeometry(0.98, 0.07, 0.34);
  for (const [x, z] of spots) {
    const head = new THREE.Group();
    const back = new THREE.Mesh(new THREE.BoxGeometry(4.6, 2.9, 0.9), frameMat);
    back.position.z = -0.2;
    head.add(back);
    for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) {
      const lx = -1.62 + k * 1.08, ly = 0.88 - r * 0.88;
      const lamp = new THREE.Mesh(lampGeo, lampMat);
      lamp.position.set(lx, ly, 0.27);
      const rim = new THREE.Mesh(rimGeo, rimMat);
      rim.position.set(lx, ly, 0.265);
      const visor = new THREE.Mesh(visorGeo, visorMat);
      visor.position.set(lx, ly + 0.43, 0.42);
      visor.rotation.x = 0.35;
      head.add(lamp, rim, visor);
    }
    // bracket back to the mast
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 2), frameMat);
    arm.position.set(0, -0.9, -1.4);
    head.add(arm);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffe2b0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.75 }));
    glow.scale.set(13, 9, 1);
    glow.position.z = 1.1;
    head.add(glow);
    head.position.set(x, h, z);
    head.lookAt(0, 0, 0);
    g.add(head);
    // beam: open cone from the lamp towards the middle of the pitch (apex at the lamp)
    const dx = -x * 0.55, dz = -z * 0.55, len = Math.hypot(dx, h, dz);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 11, len, 32, 1, true), beamMat);
    beam.position.set(x + dx / 2, h / 2, z + dz / 2);
    beam.lookAt(x, h, z);
    beam.rotateX(Math.PI / 2);
    g.add(beam);
  }
}

// ---------------------------------------------------------------- set dressing
// One shared screen texture for every jumbotron: live score, flashes GOAL! after a goal
const JUMBO = { canvas: null, tex: null, key: '' };
function jumboTexture() {
  if (!JUMBO.tex) {
    JUMBO.canvas = document.createElement('canvas');
    JUMBO.canvas.width = 1024; JUMBO.canvas.height = 420;
    JUMBO.tex = new THREE.CanvasTexture(JUMBO.canvas);
    JUMBO.tex.colorSpace = THREE.SRGBColorSpace;
    drawJumbo([0, 0], -1);
  }
  return JUMBO.tex;
}
function drawJumbo(score, goalTeam) {
  const key = `${score[0]}:${score[1]}:${goalTeam}`;
  if (JUMBO.key === key || !JUMBO.canvas) return;
  JUMBO.key = key;
  const g = JUMBO.canvas.getContext('2d');
  const W = 1024, Hh = 420;
  const bg = g.createLinearGradient(0, 0, 0, Hh);
  bg.addColorStop(0, '#221a40'); bg.addColorStop(1, '#120d24');
  g.fillStyle = bg; g.fillRect(0, 0, W, Hh);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if (goalTeam >= 0) {
    const col = goalTeam === 0 ? '#ff3b5c' : '#3b8bff';
    g.fillStyle = col; g.globalAlpha = 0.25; g.fillRect(0, 0, W, Hh); g.globalAlpha = 1;
    for (let i = -2; i < 12; i++) { g.fillStyle = i % 2 ? col : 'rgba(255,255,255,0.08)'; g.beginPath(); g.moveTo(i * 110, Hh); g.lineTo(i * 110 + 60, Hh); g.lineTo(i * 110 + 180, 0); g.lineTo(i * 110 + 120, 0); g.fill(); }
    g.font = "230px 'Lilita One', 'Arial Black', sans-serif";
    g.lineWidth = 18; g.strokeStyle = '#120d24'; g.strokeText('GOAL!', W / 2, Hh / 2 + 10);
    g.fillStyle = '#fbf6ec'; g.fillText('GOAL!', W / 2, Hh / 2 + 10);
  } else {
    g.fillStyle = '#ff3b5c';
    g.beginPath(); g.moveTo(70, 90); g.lineTo(450, 90); g.lineTo(420, 330); g.lineTo(40, 330); g.fill();
    g.fillStyle = '#3b8bff';
    g.beginPath(); g.moveTo(604, 90); g.lineTo(984, 90); g.lineTo(954, 330); g.lineTo(574, 330); g.fill();
    g.font = "210px 'Lilita One', 'Arial Black', sans-serif";
    g.fillStyle = '#fbf6ec';
    g.fillText(String(score[0]), 245, 220); g.fillText(String(score[1]), 779, 220);
    g.fillRect(482, 200, 60, 18);
    g.font = "bold 40px 'Roboto Condensed', 'Arial Narrow', sans-serif";
    g.fillStyle = 'rgba(251,246,236,0.75)';
    g.fillText('CRAZY SOCCER', W / 2, 46);
    g.fillStyle = '#ffcf3f'; g.fillRect(W / 2 - 120, 372, 240, 8);
  }
  // LED scanlines
  g.fillStyle = 'rgba(0,0,0,0.18)';
  for (let y = 0; y < Hh; y += 6) g.fillRect(0, y, W, 2);
  JUMBO.tex.needsUpdate = true;
}

function addJumbotron(g, s, x, standH, mat) {
  const w = 22, h = 9;
  const y = standH + 3 + h / 2;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.2, h + 1.2, w + 1.2), new THREE.MeshLambertMaterial({ color: 0x15111f }));
  frame.position.set(s * x, y, 0);
  g.add(frame);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: jumboTexture(), fog: false }));
  screen.position.set(s * (x - 0.62), y, 0);
  screen.rotation.y = -s * Math.PI / 2;
  g.add(screen);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, w + 1.2), new THREE.MeshBasicMaterial({ color: 0xffcf3f }));
  lip.position.set(s * (x - 0.7), y - h / 2 - 0.6, 0);
  g.add(lip);
  for (const z of [-w * 0.32, w * 0.32]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.7, y - h / 2, 0.7), mat);
    leg.position.set(s * (x + 0.2), (y - h / 2) / 2, z);
    g.add(leg);
  }
}

// Waving flags on poles (team colours): all cloth is one mesh, animated on the CPU in Stadium.update
function addFlags(g, spots) {
  const poleMat = new THREE.MeshLambertMaterial({ color: 0xd8d4e8 });
  const W = 3.2, H = 1.9, SX = 10, SY = 2;
  const per = (SX + 1) * (SY + 1);
  const pos = new Float32Array(spots.length * per * 3), col = new Float32Array(spots.length * per * 3);
  const idx = [];
  const meta = [];
  const c = new THREE.Color();
  spots.forEach(([x, y, z, team], f) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 6, 6), poleMat);
    pole.position.set(x, y + 3, z);
    g.add(pole);
    c.set(team === 2 ? 0xffcf3f : TEAMS[team].color);
    const rot = f % 2 ? 0.4 : -0.4;
    meta.push({ x, y: y + 5, z, cos: Math.cos(rot), sin: Math.sin(rot), ph: f * 1.7 });
    const o = f * per;
    for (let j = 0; j <= SY; j++) for (let i = 0; i <= SX; i++) {
      const k = (o + j * (SX + 1) + i) * 3;
      col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b;
      if (i < SX && j < SY) { const a = o + j * (SX + 1) + i, b = a + SX + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  mesh.userData.dynamic = true;
  mesh.frustumCulled = false;
  g.add(mesh);
  const flags = { geo, meta, W, H, SX, SY };
  waveFlags(flags, 0);
  return flags;
}

function waveFlags(flags, t) {
  const { geo, meta, W, H, SX, SY } = flags;
  const p = geo.attributes.position.array;
  let k = 0;
  for (const m of meta) {
    for (let j = 0; j <= SY; j++) for (let i = 0; i <= SX; i++) {
      const lx = (i / SX) * W, ly = (j / SY - 0.5) * H;
      const u = lx / W;
      const lz = Math.sin(t * 5 + lx * 1.9 + m.ph) * 0.32 * u;
      const yy = ly - u * u * 0.25 + Math.sin(t * 3.3 + lx * 1.4 + m.ph) * 0.06 * u;
      p[k++] = m.x + lx * m.cos + lz * m.sin;
      p[k++] = m.y + yy;
      p[k++] = m.z - lx * m.sin + lz * m.cos;
    }
  }
  geo.attributes.position.needsUpdate = true;
  geo.computeVertexNormals();
}

// Flags along the top of the side stands and the end stands
function flagSpots(standTop, endTop) {
  const out = [];
  const Z = FIELD.wallZ + 5.5 + 5 * 2.1 + 0.4;
  for (const s of [-1, 1]) for (let k = -3; k <= 3; k++) out.push([k * 14, standTop, s * Z, k === 0 ? 2 : k < 0 ? 0 : 1]);
  const X = FIELD.wallX + 5 + 4 * 2.1 + 0.4;
  for (const s of [-1, 1]) for (const z of [-24, 24]) out.push([s * X, endTop, z, s < 0 ? 0 : 1]);
  return out;
}

// Slow drifting motes in the low sun (pollen on the cliffs, dust in the canyon)
function addMotes(g, color, n) {
  const pos = new Float32Array(n * 3);
  const rnd = seeded(91);
  for (let i = 0; i < n; i++) { pos[i * 3] = (rnd() - 0.5) * 150; pos[i * 3 + 1] = 0.5 + rnd() * 22; pos[i * 3 + 2] = (rnd() - 0.5) * 95; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color, size: 0.35, map: TX.glowTexture(), transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
  g.add(pts);
  return pts;
}

function driftMotes(pts, dt, t) {
  const p = pts.geometry.attributes.position.array;
  for (let i = 0; i < p.length; i += 3) {
    p[i] += (1.2 + Math.sin(t * 0.3 + i) * 0.6) * dt;
    p[i + 1] += Math.sin(t * 0.8 + i * 0.37) * 0.25 * dt;
    if (p[i] > 75) p[i] -= 150;
  }
  pts.geometry.attributes.position.needsUpdate = true;
}

// Layered mountain ranges around the cliff island: each layer further out is paler (aerial haze)
function addMountains(g, rnd) {
  const layers = [
    { r: 250, n: 16, h: [40, 80], w: [26, 44], color: 0x6f86c4 },
    { r: 305, n: 20, h: [60, 120], w: [34, 60], color: 0x95a6d8 },
    { r: 350, n: 22, h: [80, 150], w: [40, 70], color: 0xb8c2e6 },
  ];
  const snow = new THREE.MeshLambertMaterial({ color: 0xf4f2ff, flatShading: true, fog: false });
  for (const L of layers) {
    const mat = new THREE.MeshLambertMaterial({ color: L.color, flatShading: true, fog: false });
    for (let i = 0; i < L.n; i++) {
      const a = (i / L.n) * Math.PI * 2 + rnd() * 0.25;
      const h = L.h[0] + rnd() * (L.h[1] - L.h[0]), w = L.w[0] + rnd() * (L.w[1] - L.w[0]);
      const m = new THREE.Mesh(new THREE.ConeGeometry(w, h, 5 + Math.floor(rnd() * 3), 1), mat);
      const r = L.r + rnd() * 25;
      m.position.set(Math.cos(a) * r, -22 + h / 2, Math.sin(a) * r);
      m.rotation.y = rnd() * 3;
      m.scale.z = 0.7 + rnd() * 0.5;
      g.add(m);
      if (h > 95) {
        const cap = new THREE.Mesh(new THREE.ConeGeometry(w * 0.28, h * 0.28, m.geometry.parameters.radialSegments, 1), snow);
        cap.position.set(0, h * 0.36 + 0.5, 0);
        cap.scale.set(1.04, 1, 1.04);
        m.add(cap);
      }
    }
  }
}

// Flat-topped sandstone mesas with banded strata
function addMesas(g, rnd) {
  const strata = [0xa4512f, 0xc8693c, 0xb85b34, 0xd98a52];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + rnd() * 0.3;
    const r = 175 + rnd() * 130;
    const R = 16 + rnd() * 26, H = 22 + rnd() * 40;
    const mesa = new THREE.Group();
    const bands = 3 + Math.floor(rnd() * 2);
    let y = 0;
    for (let b = 0; b < bands; b++) {
      const bh = H / bands;
      const rr = R * (1 - b * 0.07);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rr * 0.97, rr, bh, 7, 1), new THREE.MeshLambertMaterial({ color: strata[(b + i) % strata.length], flatShading: true }));
      m.position.y = y + bh / 2;
      mesa.add(m);
      y += bh;
    }
    // scree slope at the base
    const scree = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.05, R * 1.5, H * 0.3, 7, 1), new THREE.MeshLambertMaterial({ color: 0xd8a06a, flatShading: true }));
    scree.position.y = H * 0.15;
    mesa.add(scree);
    mesa.position.set(Math.cos(a) * r, -1, Math.sin(a) * r);
    mesa.rotation.y = rnd() * 3;
    mesa.scale.z = 0.6 + rnd() * 0.6;
    g.add(mesa);
  }
}

// Saguaro cacti dotted between the dunes
function addCacti(g, rnd, clear) {
  const mat = new THREE.MeshToonMaterial({ color: 0x4f8f4a });
  const trunkGeo = new THREE.CapsuleGeometry(0.75, 6, 3, 8);
  const armGeo = new THREE.CapsuleGeometry(0.5, 2.6, 3, 8);
  const elbowGeo = new THREE.CapsuleGeometry(0.5, 1.4, 3, 8);
  for (let i = 0; i < 34; i++) {
    const a = rnd() * Math.PI * 2, r = 72 + rnd() * 90;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (clear(x, z)) continue;
    const c = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, mat);
    trunk.position.y = 3.6;
    c.add(trunk);
    const arms = 1 + Math.floor(rnd() * 2);
    for (let k = 0; k < arms; k++) {
      const side = k === 0 ? 1 : -1, hy = 2.6 + rnd() * 2;
      const el = new THREE.Mesh(elbowGeo, mat);
      el.rotation.z = Math.PI / 2;
      el.position.set(side * 1.1, hy, 0);
      const up = new THREE.Mesh(armGeo, mat);
      up.position.set(side * 1.9, hy + 1.5, 0);
      c.add(el, up);
    }
    c.position.set(x, 0, z);
    c.rotation.y = rnd() * 3;
    c.scale.setScalar(0.8 + rnd() * 0.7);
    g.add(c);
  }
}

function buildOutdoor(root, quality) {
  const g = new THREE.Group();
  root.add(g);
  // Sky dome
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { top: { value: new THREE.Color('#2a56b8') }, mid: { value: new THREE.Color('#8fb8ea') }, bottom: { value: new THREE.Color('#ffc890') } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.12 ? mix(mid, top, smoothstep(0.12, 0.8, h)) : mix(bottom, mid, smoothstep(-0.05, 0.12, h)); gl_FragColor = vec4(c, 1.0); }',
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(520, 32, 16), skyMat);
  sky.renderOrder = -10;
  g.add(sky);

  // Sun
  // Low golden-hour sun (matches the key light direction in the renderer)
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: TX.glowTexture(), color: 0xffc27a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  sun.position.set(-300, 155, 200);
  sun.scale.set(190, 190, 1);
  g.add(sun);
  const sunCore = new THREE.Mesh(new THREE.CircleGeometry(15, 32), new THREE.MeshBasicMaterial({ color: 0xfff1d6, fog: false }));
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
    if (Math.abs(x) < FIELD.wallX + 19 && Math.abs(z) < FIELD.wallZ - 2) continue; // end stands
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
  addMountains(g, rnd);
  g.userData.crowd = buildStands(g, { stand: 0x4a4466, trim: 0x2a2440, fill: 0.86, seed: 11 }, quality);
  g.userData.flags = addFlags(g, flagSpots(5 * 1.1 + 5, 4 * 1.1 + 2.5));
  if (!quality.perf) g.userData.motes = addMotes(g, 0xfff0c0, 260);
  addFloodlights(g, [[-FIELD.wallX - 3.5, -FIELD.wallZ - 3.5], [FIELD.wallX + 3.5, -FIELD.wallZ - 3.5], [-FIELD.wallX - 3.5, FIELD.wallZ + 3.5], [FIELD.wallX + 3.5, FIELD.wallZ + 3.5]], 25.5);
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
    uniforms: { top: { value: new THREE.Color('#2c2a78') }, mid: { value: new THREE.Color('#d98a8c') }, bottom: { value: new THREE.Color('#ffc27a') } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.12 ? mix(mid, top, smoothstep(0.12, 0.8, h)) : mix(bottom, mid, smoothstep(-0.05, 0.12, h)); gl_FragColor = vec4(c, 1.0); }',
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(520, 32, 16), skyMat);
  sky.renderOrder = -10;
  g.add(sky);
  // Setting sun low over the canyon
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: TX.glowTexture(), color: 0xff9a5a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  sun.position.set(340, 70, -140);
  sun.scale.set(230, 230, 1);
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
  // Keep-out zone: the pitch, the stands and the jumbotrons. No dune may reach into it.
  const KX = FIELD.wallX + 24, KZ = FIELD.wallZ + 26;
  const gap = (x, z) => Math.hypot(Math.max(0, Math.abs(x) - KX), Math.max(0, Math.abs(z) - KZ));
  for (let i = 0, placed = 0; i < 200 && placed < 26; i++) {
    const a = rnd() * Math.PI * 2, r = 95 + rnd() * 130;
    const sx = 20 + rnd() * 30, sy = 6 + rnd() * 12, sz = 14 + rnd() * 20;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (gap(x, z) < Math.max(sx, sz) + 10) continue;
    placed++;
    const d = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), duneMat);
    d.position.set(x, -0.5, z);
    d.scale.set(sx, sy, sz);
    d.rotation.y = rnd() * 3;
    g.add(d);
  }
  // Crystal clusters
  // Crystals glow from inside as the sun goes down
  const crystalMats = [0x8a6bd8, 0xb49cf0, 0x6b4fb0].map((c) => new THREE.MeshToonMaterial({ color: c, emissive: 0x6a3cff, emissiveIntensity: 0.45 }));
  const crystalGlow = new THREE.SpriteMaterial({ map: TX.glowTexture(), color: 0xa070ff, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending });
  const clear = (x, z) => Math.abs(x) < FIELD.wallX + 20 && Math.abs(z) < FIELD.wallZ + 20; // keep the stands area free
  addMesas(g, rnd);
  addCacti(g, rnd, clear);
  for (let i = 0; i < 18; i++) {
    const a = rnd() * Math.PI * 2, r = 70 + rnd() * 60;
    if (clear(Math.cos(a) * r, Math.sin(a) * r)) continue;
    const cl = new THREE.Group();
    for (let k = 0; k < 5; k++) {
      const h = 6 + rnd() * 16;
      const sh = new THREE.Mesh(new THREE.ConeGeometry(1.2 + rnd() * 1.6, h, 5), crystalMats[k % 3]);
      sh.position.set((rnd() - 0.5) * 6, h / 2 - 1, (rnd() - 0.5) * 6);
      sh.rotation.set((rnd() - 0.5) * 0.7, rnd() * 3, (rnd() - 0.5) * 0.7);
      cl.add(sh);
    }
    const glow = new THREE.Sprite(crystalGlow);
    glow.position.y = 6;
    glow.scale.set(26, 26, 1);
    cl.add(glow);
    cl.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    g.add(cl);
  }
  // Rocks
  const rockMat = new THREE.MeshLambertMaterial({ color: 0xa9603a, flatShading: true });
  for (let i = 0; i < 22; i++) {
    const a = rnd() * Math.PI * 2, r = 62 + rnd() * 40;
    if (clear(Math.cos(a) * r, Math.sin(a) * r)) continue;
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
  g.userData.crowd = buildStands(g, { stand: 0xb07a4e, trim: 0x6b3f22, fill: 0.82, seed: 23 }, quality);
  g.userData.flags = addFlags(g, flagSpots(5 * 1.1 + 5, 4 * 1.1 + 2.5));
  if (!quality.perf) g.userData.motes = addMotes(g, 0xffc890, 220);
  addFloodlights(g, [[-FIELD.wallX - 3.5, -FIELD.wallZ - 3.5], [FIELD.wallX + 3.5, -FIELD.wallZ - 3.5], [-FIELD.wallX - 3.5, FIELD.wallZ + 3.5], [FIELD.wallX + 3.5, FIELD.wallZ + 3.5]], 23);
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

// Merge a group's static meshes (same material, same attribute layout) into single meshes so an
// arena costs a few dozen draw calls instead of hundreds. Animated, instanced and skinned meshes
// (flags, crowd) are left alone.
function bakeStatic(group) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const buckets = new Map();
  group.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || o.userData.dynamic || Array.isArray(o.material)) return;
    let p = o, hidden = false;
    while (p && p !== group) { if (!p.visible) hidden = true; p = p.parent; }
    if (hidden) return;
    const g = o.geometry;
    const key = `${o.material.uuid}|${g.attributes.uv ? 1 : 0}|${g.attributes.color ? 1 : 0}|${o.renderOrder}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(o);
  });
  const m = new THREE.Matrix4();
  for (const list of buckets.values()) {
    if (list.length < 2) continue;
    const geos = list.map((o) => {
      let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(name)) g.deleteAttribute(name);
      if (!g.attributes.normal) g.computeVertexNormals();
      m.multiplyMatrices(inv, o.matrixWorld);
      g.applyMatrix4(m);
      g.morphAttributes = {};
      return g;
    });
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, list[0].material);
    mesh.castShadow = list.some((o) => o.castShadow);
    mesh.receiveShadow = list.some((o) => o.receiveShadow);
    mesh.renderOrder = list[0].renderOrder;
    group.add(mesh);
    for (const o of list) o.removeFromParent();
  }
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
    // Arenas are built (and batched) the first time they are shown, so loading only pays for one
    this.quality = quality;
    this.outdoor = null; this.indoor = null; this.desert = null;
    // Static batching: every non-moving mesh is merged into one mesh per material
    for (const grp of [this.pitchOutdoor, this.pitchIndoor, this.pitchDesert, this.wallsStd, this.wallsDesert]) bakeStatic(grp);
    this.time = 0;
    this.setVariant('grass');
  }

  // 'grass' (cliffside arena), 'desert' (canyon arena) or 'indoor' (practice hall)
  ensure(v) {
    if (v === 'grass' && !this.outdoor) { this.outdoor = buildOutdoor(this.root, this.quality); bakeStatic(this.outdoor); }
    if (v === 'desert' && !this.desert) { this.desert = buildDesert(this.root, this.quality); bakeStatic(this.desert); }
    if (v === 'indoor' && !this.indoor) { this.indoor = buildIndoor(this.root); bakeStatic(this.indoor); }
  }

  setVariant(v) {
    if (v === 'outdoor') v = 'grass';
    this.ensure(v);
    this.variant = v;
    if (this.outdoor) this.outdoor.visible = v === 'grass';
    this.pitchOutdoor.visible = v === 'grass';
    if (this.indoor) this.indoor.visible = v === 'indoor';
    this.pitchIndoor.visible = v === 'indoor';
    if (this.desert) this.desert.visible = v === 'desert';
    this.pitchDesert.visible = v === 'desert';
    this.wallsStd.visible = v !== 'desert';
    this.wallsDesert.visible = v === 'desert';
  }

  flashGoal(side) {
    const g = this.goals.find((x) => x.side === side);
    if (g) g.flash = 1.6;
    // side +1 is the blue end, so a goal there was scored by red
    this.goalTeam = side > 0 ? 0 : 1;
    this.goalT = 4;
    drawJumbo(this.lastScore || [0, 0], this.goalTeam);
    for (const grp of [this.outdoor, this.desert]) if (grp && grp.userData.crowd) grp.userData.crowd.hype = 4;
  }

  // The crowd jumps after a goal (only animated while excited, so it costs nothing otherwise)
  animateCrowd(dt) {
    const grp = this.variant === 'desert' ? this.desert : this.variant === 'grass' ? this.outdoor : null;
    const c = grp && grp.userData.crowd;
    if (!c || (c.hype <= 0 && !c.dirty)) return;
    c.hype = Math.max(0, c.hype - dt);
    const amp = Math.min(1, c.hype) * 0.45;
    const m = this._m || (this._m = new THREE.Matrix4());
    c.seats.forEach(([x, y, z], i) => {
      const j = Math.max(0, Math.sin(this.time * 9 + c.phase[i])) * amp;
      m.makeTranslation(x, y + 0.5 + j, z); c.body.setMatrixAt(i, m);
      m.makeTranslation(x, y + 1.08 + j, z); c.head.setMatrixAt(i, m);
    });
    c.body.instanceMatrix.needsUpdate = true;
    c.head.instanceMatrix.needsUpdate = true;
    c.dirty = c.hype > 0;
  }

  // Jumbotrons: the live score, or GOAL! for a few seconds after a goal
  setScore(score) {
    if (!score) return;
    drawJumbo(score, this.goalT > 0 ? this.goalTeam : -1);
    this.lastScore = score;
  }

  // keeperSide: the goal the local keeper is defending (posts and net turn see-through near it)
  update(dt, cam, keeperSide = 0) {
    this.time += dt;
    this.animateCrowd(dt);
    if (this.goalT > 0) { this.goalT -= dt; if (this.goalT <= 0 && this.lastScore) drawJumbo(this.lastScore, -1); }
    const grp = this.variant === 'desert' ? this.desert : this.variant === 'grass' ? this.outdoor : null;
    if (grp) {
      if (grp.userData.flags) waveFlags(grp.userData.flags, this.time);
      if (grp.userData.motes) driftMotes(grp.userData.motes, dt, this.time);
    }
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
      // see-through when the camera is in, behind or right beside this goal (or you keep it)
      const camNear = cam && cam.x * g.side > FIELD.halfL - 6 && Math.abs(cam.z) < FIELD.goalW / 2 + 6 && cam.y < FIELD.goalH + 6;
      const kNear = (keeperSide === g.side && cam && cam.x * g.side > FIELD.halfL - 12) || camNear ? 1 : 0;
      g.kfade = (g.kfade || 0) + (kNear - (g.kfade || 0)) * Math.min(1, dt * 6);
      const see = g.kfade > 0.02;
      for (const m of [g.postMat, g.frameMat]) {
        if (m.transparent !== see) { m.transparent = see; m.depthWrite = !see; m.needsUpdate = true; }
        m.opacity = 1 - g.kfade * 0.75;
      }
      const k = (1 - g.fade * 0.85) * (1 - g.kfade * 0.88);
      const showFrame = g.fade < 0.5;
      if (g.frameShown !== showFrame) { g.frameShown = showFrame; for (const m of g.frame) m.visible = showFrame; }
      g.netMat.opacity = (0.75 + pulse * 0.15 + f * 0.25) * k;
      g.glassMat.opacity = (g.baseOpacity + f * 0.35 * (0.5 + 0.5 * Math.sin(this.time * 30))) * k;
    }
  }
}
