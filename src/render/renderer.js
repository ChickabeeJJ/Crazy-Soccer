// Scene graph + syncing simulation state to 3D objects.
import * as THREE from 'three';
import { Stadium } from './stadium.js';
import { CharacterModel } from './character.js';
import { BallMesh } from './ballmesh.js';
import { VFX } from './vfx.js';
import { CameraRig } from './camera.js';
import * as TX from './textures.js';
import { TEAMS, ITEMS, PHYS, FIELD, QUICK_CHAT } from '../config.js';
import { clamp, len2, lerp } from '../util/math.js';

const ANIM_DUR = { volley: 0.5, kick: 0.38, pass: 0.3, flick: 0.35, slide: 0.55, recover: 0.22, dive: 0.62, getup: 0.42, punch: 0.45, throw: 0.32, spin: 0.42, dodge: 0.3, hit: 0.85, fall: 1.1, slip: 1.4 };
const BOX_COLORS = ['#3fa9ff', '#ff4fa3', '#4cf08a', '#a46bff', '#ffc93f'];

export function qualityFor(perf) {
  return perf
    ? { perf: true, shadows: false, outline: false, particles: 0.45, pixelRatio: Math.min(window.devicePixelRatio || 1, 1), shadowSize: 1024 }
    : { perf: false, shadows: true, outline: true, particles: 1, pixelRatio: Math.min(window.devicePixelRatio || 1, 1.75), shadowSize: 2048 };
}

export class GameRenderer {
  constructor(canvas, perf) {
    this.canvas = canvas;
    this.quality = qualityFor(perf);
    this.r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    this.r.setPixelRatio(this.quality.pixelRatio);
    this.r.outputColorSpace = THREE.SRGBColorSpace;
    this.r.toneMapping = THREE.NoToneMapping;
    this.r.shadowMap.enabled = this.quality.shadows;
    this.r.shadowMap.type = THREE.PCFShadowMap;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xcfe8ff, 120, 520);
    this.rig = new CameraRig(1);
    this.cam = this.rig.cam;
    this.setupLights();
    this.stadium = new Stadium(this.scene, this.quality);
    this.vfx = new VFX(this.scene, this.quality);
    this.chars = new Map();
    this.ball = new BallMesh('classic', this.quality.outline);
    this.scene.add(this.ball.root);
    this.ballShadow = new THREE.Mesh(new THREE.CircleGeometry(PHYS.ballR * 1.1, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }));
    this.ballShadow.rotation.x = -Math.PI / 2;
    this.scene.add(this.ballShadow);
    // 3D arrows: one over your own player, one over whoever has the ball (team colour)
    this.marker = makeArrow(0xff3b5c);
    this.scene.add(this.marker);
    this.carrierMarker = makeArrow(0xff3b5c);
    this.scene.add(this.carrierMarker);
    this.boxes = new Map();
    this.puddles = new Map();
    this.projs = new Map();
    this.boxTex = BOX_COLORS.map((c) => TX.itemBoxTexture(c));
    this.boxGeo = new THREE.BoxGeometry(1.25, 1.25, 1.25);
    this.puddleTex = TX.puddleTexture();
    this.oilMat = new THREE.MeshBasicMaterial({ map: this.puddleTex, color: 0x332244, transparent: true, depthWrite: false });
    this.walls = new Map();
    // Ball trajectory dots (aim preview + predicted flight)
    this.trajN = 56;
    this.traj = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }), this.trajN);
    this.traj.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.traj.frustumCulled = false;
    this.traj.renderOrder = 7;
    this.traj.count = 0;
    this.scene.add(this.traj);
    this.trajLand = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.75, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
    this.trajLand.rotation.x = -Math.PI / 2;
    this.trajLand.renderOrder = 7;
    this.trajLand.visible = false;
    this.scene.add(this.trajLand);
    this.trajM = new THREE.Matrix4();
    this.targets = new Map();
    this.targetGeo = new THREE.RingGeometry(1.05, 1.35, 40);
    this.targetDisc = new THREE.CircleGeometry(1.05, 40);
    this.barrelGeo = new THREE.CylinderGeometry(0.75, 0.75, 1.3, 16);
    this.barrelMat = new THREE.MeshToonMaterial({ color: 0x2f6fe0 });
    this.rimGeo = new THREE.TorusGeometry(0.77, 0.06, 6, 20);
    this.rimGeo.rotateX(Math.PI / 2);
    this.rimMat = new THREE.MeshToonMaterial({ color: 0x1b2340 });
    this.fenceGeo = new THREE.BoxGeometry(4.6, 0.75, 0.12);
    this.fenceMat = new THREE.MeshToonMaterial({ map: TX.barricadeTexture() });
    this.fenceLegGeo = new THREE.BoxGeometry(0.16, 1.7, 0.16);
    this.fenceFootGeo = new THREE.BoxGeometry(0.5, 0.16, 0.9);
    this.fenceLegMat = new THREE.MeshToonMaterial({ color: 0xffb000 });
    this.glowTex = TX.glowTexture();
    this.ringGeo = new THREE.RingGeometry(0.95, 1.2, 40);
    this.discGeo = new THREE.CircleGeometry(1, 24);
    this.aim = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1), new THREE.MeshBasicMaterial({ map: TX.arrowTexture(), transparent: true, depthWrite: false, opacity: 0.85 }));
    this.aim.rotation.x = -Math.PI / 2;
    this.aim.renderOrder = 4;
    this.aimPivot = new THREE.Group();
    this.aimPivot.add(this.aim);
    this.scene.add(this.aimPivot);
    this.chargeCanvas = document.createElement('canvas');
    this.chargeCanvas.width = 256; this.chargeCanvas.height = 48;
    this.chargeTex = new THREE.CanvasTexture(this.chargeCanvas);
    this.chargeSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.chargeTex, depthTest: false, transparent: true }));
    this.chargeSprite.scale.set(2.2, 0.42, 1);
    this.chargeSprite.renderOrder = 20;
    this.scene.add(this.chargeSprite);
    this.lastChargeSeg = -1;
    this.grapples = [];
    this.starTex = this.makeStarTex();
    this.bangTex = this.makeBangTex();
    this.bubbleCache = new Map();
    this.time = 0;
    this.showChat = true;
    this.showNames = true;
    this.menuChar = null;
    this.resize();
  }

  setupLights() {
    const hemi = new THREE.HemisphereLight(0xdcefff, 0x5a7a48, 1.35);
    this.scene.add(hemi);
    this.hemi = hemi;
    const sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
    sun.position.set(-30, 60, 40);
    sun.castShadow = this.quality.shadows;
    sun.shadow.mapSize.set(this.quality.shadowSize, this.quality.shadowSize);
    const s = sun.shadow.camera;
    s.left = -58; s.right = 58; s.top = 42; s.bottom = -42; s.near = 10; s.far = 160;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.25));
  }

  setPerf(perf) {
    const q = qualityFor(perf);
    if (q.perf === this.quality.perf) return;
    this.quality = q;
    this.r.setPixelRatio(q.pixelRatio);
    this.r.shadowMap.enabled = q.shadows;
    this.sun.castShadow = q.shadows;
    this.vfx.mul = q.particles;
    this.scene.traverse((o) => { if (o.material) { const m = Array.isArray(o.material) ? o.material : [o.material]; m.forEach((x) => { x.needsUpdate = true; }); } });
    for (const [id] of this.chars) this.removeChar(id);
    if (this.menuChar) { this.menuChar.dispose(); this.menuChar = null; }
    this.resize();
  }

  setVariant(v) {
    this.stadium.setVariant(v);
    if (v === 'desert') {
      this.scene.fog.color.set(0xf4e2c4); this.scene.fog.near = 120; this.scene.fog.far = 520;
      this.hemi.color.set(0xfff0dc); this.hemi.groundColor.set(0x9a7a50); this.hemi.intensity = 1.35;
      this.sun.color.set(0xffe6c0); this.sun.intensity = 2.5;
    } else if (v === 'indoor') {
      this.scene.fog.color.set(0x5a2a22); this.scene.fog.near = 60; this.scene.fog.far = 200;
      this.hemi.color.set(0xffe2c8); this.hemi.groundColor.set(0x6a3a2a); this.hemi.intensity = 1.5;
      this.sun.color.set(0xffe0b8); this.sun.intensity = 1.8;
    } else {
      this.scene.fog.color.set(0xcfe8ff); this.scene.fog.near = 120; this.scene.fog.far = 520;
      this.hemi.color.set(0xdcefff); this.hemi.groundColor.set(0x5a7a48); this.hemi.intensity = 1.35;
      this.sun.color.set(0xfff1dc); this.sun.intensity = 2.4;
    }
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.r.setSize(w, h, false);
    this.cam.aspect = w / h;
    // Keep horizontal field of view sensible on tall/narrow screens
    this.cam.fov = w / h < 1 ? 80 : 70;
    this.cam.updateProjectionMatrix();
    this.vfx.setScale(h * this.quality.pixelRatio);
  }

  makeStarTex() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#ffe14a'; g.strokeStyle = '#1b1530'; g.lineWidth = 4;
    g.beginPath();
    for (let i = 0; i < 10; i++) { const a = (Math.PI / 5) * i - Math.PI / 2; const r = i % 2 ? 12 : 28; g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); }
    g.closePath(); g.fill(); g.stroke();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }

  makeBangTex() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#ffe14a'; g.strokeStyle = '#1b1530'; g.lineWidth = 8;
    g.beginPath(); g.arc(64, 64, 52, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = '#1b1530'; g.font = '900 84px "Lilita One", "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('!', 64, 70);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }

  // ------------------------------------------------------------- characters
  getChar(p, localId) {
    let c = this.chars.get(p.id);
    if (!c) {
      const model = new CharacterModel(p.cos, p.team, { outline: this.quality.outline, shadows: this.quality.shadows });
      this.scene.add(model.root);
      const ring = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: TEAMS[p.team].color, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
      ring.rotation.x = -Math.PI / 2;
      ring.renderOrder = 3;
      this.scene.add(ring);
      const own = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }));
      own.rotation.x = -Math.PI / 2;
      own.scale.setScalar(0.7);
      own.renderOrder = 3;
      this.scene.add(own);
      const blob = new THREE.Mesh(this.discGeo, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }));
      blob.rotation.x = -Math.PI / 2;
      blob.scale.setScalar(0.8);
      this.scene.add(blob);
      const tag = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
      tag.scale.set(3.2, 0.6, 1);
      tag.renderOrder = 10;
      this.scene.add(tag);
      const bubble = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
      bubble.scale.set(3.4, 0.85, 1);
      bubble.renderOrder = 11;
      bubble.visible = false;
      this.scene.add(bubble);
      const bang = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.bangTex, transparent: true, depthWrite: false }));
      bang.scale.set(0.9, 0.9, 1);
      bang.visible = false;
      this.scene.add(bang);
      const stars = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.starTex, transparent: true, depthWrite: false }));
        s.scale.set(0.45, 0.45, 1);
        stars.add(s);
      }
      stars.visible = false;
      this.scene.add(stars);
      const shield = new THREE.Mesh(new THREE.SphereGeometry(1.7, 24, 16), new THREE.MeshBasicMaterial({ color: 0xc27bff, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }));
      shield.visible = false;
      this.scene.add(shield);
      const ice = new THREE.Mesh(new THREE.IcosahedronGeometry(1.7, 0), new THREE.MeshToonMaterial({ color: 0x9ff0ff, transparent: true, opacity: 0.55, emissive: 0x1a5a6a }));
      ice.scale.set(1, 1.35, 1);
      ice.visible = false;
      this.scene.add(ice);
      c = { model, ring, own, blob, tag, bubble, bang, stars, shield, ice, tagKey: '', bubbleKey: '', team: p.team, dust: 0 };
      this.chars.set(p.id, c);
    }
    if (c.team !== p.team) {
      c.team = p.team;
      c.ring.material.color.set(TEAMS[p.team].color);
      c.tagKey = '';
    }
    c.model.setAppearance(p.cos, p.team, !!p.keeper);
    const key = `${p.name}|${p.team}|${p.id === localId}`;
    if (c.tagKey !== key) {
      c.tagKey = key;
      if (c.tag.material.map) c.tag.material.map.dispose();
      c.tag.material.map = TX.nameTagTexture(p.name, p.team, p.id === localId);
      c.tag.material.needsUpdate = true;
    }
    return c;
  }

  removeChar(id) {
    const c = this.chars.get(id);
    if (!c) return;
    c.model.dispose();
    for (const o of [c.ring, c.own, c.blob, c.tag, c.bubble, c.bang, c.stars, c.shield, c.ice]) o.removeFromParent();
    this.chars.delete(id);
  }

  bubbleTex(text) {
    if (!this.bubbleCache.has(text)) this.bubbleCache.set(text, TX.bubbleTexture(text));
    return this.bubbleCache.get(text);
  }

  // ---------------------------------------------------------------- per frame
  // frame: optional replay frame overriding positions
  syncWorld(view, localId, dt, opts = {}) {
    this.time += dt;
    if (this.menuChar) this.menuChar.root.visible = false;
    const frame = opts.replay;
    const ballOwner = frame ? -2 : view.ball.owner;
    const seen = new Set();
    const tmp = new THREE.Vector3();
    const rmap = frame ? new Map(frame.p.map((r) => [r[0], r])) : null;

    for (const p of view.players) {
      if (!p) continue;
      seen.add(p.id);
      const c = this.getChar(p, localId);
      let x = p.x, y = p.y || 0, z = p.z, face = p.face, anim = p.anim, animT = p.animT, charge = p.charge, fire = p.fx && p.fx.fire > 0, jet = p.fx && p.fx.jet > 0;
      let speed = len2(p.vx || 0, p.vz || 0);
      if (rmap) {
        const r = rmap.get(p.id);
        if (r) {
          speed = c.lastX !== undefined ? len2(r[1] - c.lastX, r[3] - c.lastZ) / Math.max(dt, 0.001) * (opts.replaySpeed || 1) : 0;
          [, x, y, z, face, anim, animT, charge] = r;
          fire = !!r[8]; jet = !!r[9];
        }
      }
      c.lastX = x; c.lastZ = z;
      const m = c.model;
      m.root.position.set(x, y, z);
      m.root.rotation.y = face;
      const hasBall = !frame && ballOwner === p.id;
      m.update(dt * (opts.replaySpeed || 1), {
        anim, animT, animDur: p.actDur || ANIM_DUR[anim] || 0.4, speed: Math.min(speed, 20), sprinting: speed > 11.5,
        charging: !frame && p.charging, charge, hasBall, emote: p.emote, fx: { jet: jet ? 1 : 0 }, y, id: p.id, stun: p.stun,
      });
      c.ring.position.set(x, 0.04, z);
      const isLocal = p.id === localId;
      const pulse = isLocal ? 1 + Math.sin(this.time * 5) * 0.06 : 1;
      c.ring.scale.setScalar(pulse);
      c.ring.material.opacity = isLocal ? 0.95 : 0.6;
      c.own.visible = hasBall;
      c.own.position.set(x, 0.05, z);
      c.blob.position.set(x, 0.03, z);
      c.blob.scale.setScalar(0.85 / (1 + y * 0.3));
      const headY = y + 3.15;
      c.tag.visible = this.showNames && !isLocal && !frame;
      if (c.tag.visible) {
        const d = this.cam.position.distanceTo(m.root.position);
        const s = clamp(d / 14, 0.75, 2.2);
        c.tag.scale.set(3.2 * s, 0.6 * s, 1);
        c.tag.position.set(x, headY + 0.25 * s, z);
      }
      const showBubble = this.showChat && p.chat >= 0 && p.chatT > 0 && !frame;
      c.bubble.visible = showBubble;
      if (showBubble) {
        const text = QUICK_CHAT[p.chat] || '';
        if (c.bubbleKey !== text) { c.bubbleKey = text; c.bubble.material.map = this.bubbleTex(text); c.bubble.material.needsUpdate = true; }
        c.bubble.position.set(x, headY + 1.0, z);
      }
      c.bang.visible = p.req > 0 && !frame;
      if (c.bang.visible) c.bang.position.set(x, headY + (showBubble ? 1.9 : 1.0) + Math.sin(this.time * 8) * 0.1, z);
      const dizzy = anim === 'fall' || anim === 'slip' || anim === 'hit' || (anim === 'getup' && animT < 0.25);
      c.stars.visible = dizzy;
      if (dizzy) {
        m.headWorld(tmp);
        c.stars.position.copy(tmp).y += 0.75;
        c.stars.children.forEach((s, i) => {
          const a = this.time * 6 + (i * Math.PI * 2) / 3;
          s.position.set(Math.cos(a) * 0.6, Math.sin(a * 2) * 0.08, Math.sin(a) * 0.6);
        });
      }
      c.shield.visible = !frame && p.fx && p.fx.shield > 0;
      if (c.shield.visible) { c.shield.position.set(x, y + 1.3, z); c.shield.material.opacity = 0.18 + Math.sin(this.time * 6) * 0.05; }
      c.ice.visible = anim === 'frozen';
      if (c.ice.visible) c.ice.position.set(x, y + 1.3, z);

      // Auras & particles
      if (fire) this.vfx.fireAura(x, y + 0.2, z);
      if (!frame && p.fx && p.fx.speed > 0) this.vfx.speedAura(x, y, z);
      if (jet && y > 0.2) {
        tmp.set(-Math.sin(face) * 0.5, 0, -Math.cos(face) * 0.5);
        this.vfx.jetFlame(x + tmp.x, y + 0.9, z + tmp.z);
      }
      c.dust -= dt;
      if ((anim === 'slide' || (speed > 12 && y < 0.1)) && c.dust <= 0) {
        c.dust = anim === 'slide' ? 0.03 : 0.12;
        this.vfx.dust(x, z, anim === 'slide' ? 2 : 1);
      }
    }
    for (const id of [...this.chars.keys()]) if (!seen.has(id)) this.removeChar(id);

    // Ball
    const b = view.ball;
    let bx = b.x, by = b.y, bz = b.z, bfire = b.fire;
    if (frame) { [bx, by, bz] = frame.b; bfire = !!frame.b[4]; }
    const prev = this.ball.root.position.clone();
    this.ball.root.position.set(bx, by, bz);
    const vx = (bx - prev.x) / Math.max(dt, 0.001), vz = (bz - prev.z) / Math.max(dt, 0.001);
    if (Math.abs(vx) < 80 && Math.abs(vz) < 80) this.ball.roll(vx, vz, dt);
    const bspeed = Math.hypot(vx, (by - prev.y) / Math.max(dt, 0.001), vz);
    this.ballShadow.position.set(bx, 0.025, bz);
    this.ballShadow.scale.setScalar(1 + by * 0.12);
    this.ballShadow.material.opacity = clamp(0.35 - by * 0.02, 0.08, 0.35);
    if (bfire) this.vfx.fireTrail(bx, by, bz);
    else if (bspeed > 17 && bspeed < 120) {
      const kicker = opts.kickerTeam;
      const col = kicker === 1 ? 0x6fb6ff : kicker === 0 ? 0xff6f9a : 0xffffff;
      this.vfx.trail(bx, by, bz, col, 0.55 + Math.min(0.6, (bspeed - 17) / 50));
      this.vfx.trail((bx + prev.x) / 2, (by + prev.y) / 2, (bz + prev.z) / 2, col, 0.5);
    }
    // Team-coloured marker above your own player (as in the reference game)
    const meP = view.players.find((q) => q && q.id === localId);
    this.marker.visible = !!meP && !frame && view.phase !== 'replay';
    if (meP) {
      this.marker.userData.setColor(TEAMS[meP.team].color);
      this.marker.position.set(meP.x, (meP.y || 0) + 3.55 + Math.sin(this.time * 4) * 0.12, meP.z);
      this.marker.rotation.y += dt * 2;
    }
    // Ball carrier arrow in the colour of the team in possession
    const carrier = !frame && view.phase !== 'replay' && view.ball.owner >= 0 && view.ball.owner !== localId ? view.players.find((q) => q && q.id === view.ball.owner) : null;
    this.carrierMarker.visible = !!carrier;
    if (carrier) {
      this.carrierMarker.userData.setColor(TEAMS[carrier.team].color);
      this.carrierMarker.position.set(carrier.x, (carrier.y || 0) + 3.55 + Math.sin(this.time * 4 + 1) * 0.12, carrier.z);
      this.carrierMarker.rotation.y += dt * 2;
    }

    // Item boxes
    this.syncMap(this.boxes, view.boxes, (it) => {
      const m = new THREE.Mesh(this.boxGeo, new THREE.MeshBasicMaterial({ map: this.boxTex[it.c % 5] }));
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: BOX_COLORS[it.c % 5], transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.scale.set(3.4, 3.4, 1);
      m.add(glow);
      m.userData.phase = Math.random() * 6;
      return m;
    }, (m, it) => {
      m.position.set(it.x, 1.1 + Math.sin(this.time * 2.4 + m.userData.phase) * 0.22, it.z);
      m.rotation.y += dt * 1.6;
      m.rotation.x = Math.sin(this.time * 1.3 + m.userData.phase) * 0.25;
    });
    this.syncMap(this.puddles, view.puddles, (it) => {
      const m = new THREE.Mesh(this.discGeo, this.oilMat);
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = Math.random() * 6;
      m.renderOrder = 2;
      return m;
    }, (m, it) => {
      m.position.set(it.x, 0.03 + (it.id % 7) * 0.0015, it.z);
      const s = it.r * Math.min(1, (it.life ?? 5) / 0.6);
      m.scale.set(s, s * 0.8, s);
    });
    this.syncMap(this.projs, view.projs, (it) => this.makeProj(it.k), (m, it) => {
      m.position.set(it.x, it.k === 'mine' ? 0.05 : it.y, it.z);
      if (it.k === 'ice') { m.rotation.x += dt * 8; m.rotation.y += dt * 6; this.vfx.trail(it.x, it.y, it.z, 0x8ff3ff, 0.9); return; }
      if (it.k === 'mine') { m.userData.light.material.color.set(Math.sin(this.time * 10 + it.id) > 0 ? 0xff2d2d : 0x551111); return; }
      m.rotation.y = it.ang ?? 0;
      if (it.k === 'rocket') { this.vfx.fireTrail(it.x - Math.sin(it.ang || 0) * 0.8, it.y, it.z - Math.cos(it.ang || 0) * 0.8, 'fire'); }
      else if (it.k === 'fist') this.vfx.trail(it.x, it.y, it.z, 0xff9a3c, 0.8);
      else this.vfx.trail(it.x, it.y, it.z, 0xffe9b0, 0.35);
    });
    // Barricades
    this.syncMap(this.walls, view.walls, () => {
      const g = new THREE.Group();
      const panel = new THREE.Mesh(this.fenceGeo, this.fenceMat);
      panel.position.y = 1.05;
      panel.castShadow = true;
      g.add(panel);
      for (const x of [-2.2, 2.2]) {
        const leg = new THREE.Mesh(this.fenceLegGeo, this.fenceLegMat);
        leg.position.set(x, 0.85, 0);
        g.add(leg);
        const foot = new THREE.Mesh(this.fenceFootGeo, this.fenceLegMat);
        foot.position.set(x, 0.08, 0);
        g.add(foot);
      }
      g.scale.y = 0.01;
      return g;
    }, (m, it) => {
      m.position.set(it.x, 0, it.z);
      m.rotation.y = it.ang;
      const life = it.life ?? 5;
      m.scale.y = Math.min(1, m.scale.y + dt * 6) * (life < 0.5 ? life / 0.5 : 1);
    });

    // Shooting-challenge targets on the goal mouth
    this.syncMap(this.targets, view.targets, (it) => {
      const g = new THREE.Group();
      const ring = new THREE.Mesh(this.targetGeo, new THREE.MeshBasicMaterial({ color: it.top ? 0xffd23f : 0x2fe39b, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false }));
      const disc = new THREE.Mesh(this.targetDisc, new THREE.MeshBasicMaterial({ color: it.top ? 0xffd23f : 0x2fe39b, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: it.top ? 0xffd23f : 0x2fe39b, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.scale.set(4.4, 4.4, 1);
      g.add(ring, disc, glow);
      g.rotation.y = -Math.PI / 2;
      g.renderOrder = 6;
      g.userData.ring = ring;
      g.scale.setScalar(0.01);
      return g;
    }, (m, it) => {
      m.position.set(it.x, it.y, it.z);
      const k = Math.min(1, m.scale.x + dt * 4);
      m.scale.setScalar(k);
      m.userData.ring.rotation.z += dt * 1.5;
      m.userData.ring.scale.setScalar(1 + Math.sin(this.time * 6) * 0.06);
    });

    // Grapple lines
    for (let i = this.grapples.length - 1; i >= 0; i--) {
      const g = this.grapples[i];
      g.t -= dt;
      const c = this.chars.get(g.id);
      if (g.t <= 0 || !c) { g.line.removeFromParent(); g.line.geometry.dispose(); this.grapples.splice(i, 1); continue; }
      c.model.handWorld(tmp);
      const pos = g.line.geometry.attributes.position;
      pos.setXYZ(0, tmp.x, tmp.y, tmp.z);
      pos.setXYZ(1, bx, by, bz);
      pos.needsUpdate = true;
    }

    this.stadium.update(dt, this.cam.position);
    this.vfx.update(dt);
  }

  syncMap(map, list, create, update) {
    const seen = new Set();
    for (const it of list || []) {
      seen.add(it.id);
      let m = map.get(it.id);
      if (!m) { m = create(it); map.set(it.id, m); this.scene.add(m); }
      update(m, it);
    }
    for (const [id, m] of map) {
      if (!seen.has(id)) { m.removeFromParent(); map.delete(id); }
    }
  }

  // Item projectile meshes
  makeProj(k) {
    const T = (geo, color) => new THREE.Mesh(geo, new THREE.MeshToonMaterial({ color }));
    const g = new THREE.Group();
    if (k === 'ice') {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), new THREE.MeshBasicMaterial({ color: 0xaaf6ff }));
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: 0x5fe3ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.scale.set(2.6, 2.6, 1);
      m.add(glow);
      return m;
    }
    if (k === 'fist') {
      const glove = T(new THREE.SphereGeometry(0.5, 14, 10), 0xff2d55); glove.scale.set(1, 0.9, 1.2); glove.position.z = 0.3;
      const cuff = T(new THREE.CylinderGeometry(0.3, 0.34, 0.5, 12), 0xffffff); cuff.rotation.x = Math.PI / 2; cuff.position.z = -0.25;
      const fin = T(new THREE.ConeGeometry(0.26, 0.6, 10), 0x2b2f3d); fin.rotation.x = -Math.PI / 2; fin.position.z = -0.75;
      g.add(glove, cuff, fin);
    } else if (k === 'rocket') {
      const body = T(new THREE.CylinderGeometry(0.22, 0.22, 1.3, 12), 0x6b7a3a); body.rotation.x = Math.PI / 2;
      const tip = T(new THREE.ConeGeometry(0.22, 0.45, 12), 0xd23b3b); tip.rotation.x = Math.PI / 2; tip.position.z = 0.88;
      g.add(body, tip);
    } else if (k === 'bullet') {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff1c0 }));
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: 0xffc46b, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.scale.set(1.1, 1.1, 1);
      g.add(m, glow);
    } else if (k === 'mine') {
      const base = T(new THREE.CylinderGeometry(0.55, 0.65, 0.22, 16), 0x3b3f2e); base.position.y = 0.11;
      const top = T(new THREE.CylinderGeometry(0.22, 0.22, 0.12, 12), 0x9aa07a); top.position.y = 0.27;
      const light = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2d2d })); light.position.y = 0.36;
      g.add(base, top, light);
      g.userData.light = light;
    }
    g.traverse((o) => { if (o.isMesh) o.castShadow = this.quality.shadows; });
    return g;
  }

  // pts: [{x,y,z}] predicted ball path; kind 'aim' (bright, your shot) or 'flight' (faint)
  syncTrajectory(pts, kind, land) {
    const t = this.traj;
    if (!pts || pts.length < 2) { t.count = 0; this.trajLand.visible = false; return; }
    const n = Math.min(this.trajN, pts.length);
    const m = this.trajM;
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const s = kind === 'aim' ? 1 - (i / n) * 0.45 : 0.75 - (i / n) * 0.4;
      m.makeScale(s, s, s).setPosition(p.x, p.y, p.z);
      t.setMatrixAt(i, m);
    }
    t.count = n;
    t.instanceMatrix.needsUpdate = true;
    t.material.color.set(kind === 'aim' ? 0xffffff : 0xffe14a);
    t.material.opacity = kind === 'aim' ? 0.9 : 0.55;
    this.trajLand.visible = !!land;
    if (land) { this.trajLand.position.set(land.x, 0.05, land.z); this.trajLand.material.opacity = kind === 'aim' ? 0.85 : 0.45; this.trajLand.scale.setScalar(1 + Math.sin(this.time * 6) * 0.08); }
  }

  // Local player's aim arrow + charge meter
  syncAim(p, yaw, show, charge) {
    this.aimPivot.visible = show;
    this.chargeSprite.visible = show;
    if (!show || !p) return;
    const len = 3 + charge * 9;
    this.aimPivot.position.set(p.x, 0.06, p.z);
    this.aimPivot.rotation.y = yaw;
    this.aim.scale.set(1, len, 1);
    this.aim.position.set(0, 0, 1.2 + len / 2);
    this.aim.material.map.repeat.set(1, len / 4);
    this.aim.material.map.offset.y = -this.time * 1.5;
    this.aim.material.opacity = 0.55 + charge * 0.4;
    this.chargeSprite.position.set(p.x, (p.y || 0) + 3.55, p.z);
    const seg = Math.round(charge * 8);
    if (seg !== this.lastChargeSeg) {
      this.lastChargeSeg = seg;
      const g = this.chargeCanvas.getContext('2d');
      g.clearRect(0, 0, 256, 48);
      for (let i = 0; i < 8; i++) {
        g.fillStyle = i < seg ? (i < 5 ? '#ffffff' : i < 7 ? '#ffe14a' : '#ff5a5a') : 'rgba(20,16,30,0.6)';
        g.fillRect(6 + i * 31, 8, 26, 32);
        g.strokeStyle = 'rgba(20,16,30,0.9)'; g.lineWidth = 3; g.strokeRect(6 + i * 31, 8, 26, 32);
      }
      this.chargeTex.needsUpdate = true;
    }
  }

  // ------------------------------------------------------------------ events
  onEvent(ev, session, settings) {
    const v = this.vfx;
    const P = (id) => session.playerById(id);
    const ball = this.ball.root.position;
    switch (ev.e) {
      case 'kick': {
        const p = P(ev.id);
        const col = ev.fire ? 0x38e1ff : p ? TEAMS[p.team].color : 0xffffff;
        v.kick(ball.x, ball.y, ball.z, ev.pw || 0.3, col);
        if (ev.id === session.localId && (ev.pw || 0) > 0.75) this.rig.shake(0.25 * (settings.shake / 5));
        if (ev.fire) v.sparkles(ball.x, ball.y, ball.z, 0x38e1ff, 40, 9);
        break;
      }
      case 'goal': {
        this.stadium.flashGoal(ev.team === 0 ? 1 : -1);
        v.goal(ev.fx, ev.x, Math.max(1.5, ev.y), ev.z, TEAMS[ev.team].color);
        this.rig.shake(0.85 * (settings.shake / 5));
        break;
      }
      case 'stun': {
        const p = P(ev.id);
        if (!p) break;
        if (ev.k === 'frozen') v.iceShatter(p.x, 1.4, p.z);
        else v.dust(p.x, p.z, 10, 0xf0f0e0);
        if (ev.id === session.localId) this.rig.shake(0.35 * (settings.shake / 5));
        break;
      }
      case 'tackle': case 'dive': { const p = P(ev.id); if (p) v.dust(p.x, p.z, 8); break; }
      case 'pickup': v.pickup(ev.x, ev.z, ITEMS[ev.k] ? ITEMS[ev.k].color : '#ffffff'); break;
      case 'item': {
        const p = P(ev.id);
        if (!p) break;
        const col = ITEMS[ev.k] ? ITEMS[ev.k].color : '#ffffff';
        v.ring(p.x, 0.12, p.z, col, 0.5, 4, 0.45);
        v.sparkles(p.x, 1.4, p.z, col, 24, 6);
        break;
      }
      case 'shatter':
        if (ev.k === 'ice' || !ev.k) v.iceShatter(ev.x, ev.y, ev.z);
        else if (ev.k === 'fist') { v.sparkles(ev.x, ev.y, ev.z, 0xff9a3c, 22, 7); v.ring(ev.x, ev.y, ev.z, 0xffffff, 0.3, 2.2, 0.3, 0.8, true); }
        else if (ev.k === 'bullet') v.sparkles(ev.x, ev.y, ev.z, 0xffe9b0, 10, 5);
        break;
      case 'boom': {
        v.ring(ev.x, 0.15, ev.z, 0xffb347, 0.5, ev.r * 1.2, 0.45, 0.9);
        v.sparkles(ev.x, 1, ev.z, 0xff7a1a, 50, 12);
        v.dust(ev.x, ev.z, 18, 0x6b5a4a);
        const d = this.cam.position.distanceTo(new THREE.Vector3(ev.x, 1, ev.z));
        if (d < 30) this.rig.shake((0.6 - d / 60) * (settings.shake / 5));
        break;
      }
      case 'blast': {
        const ax = Math.sin(ev.a), az = Math.cos(ev.a);
        for (let i = 1; i <= 4; i++) v.sparkles(ev.x + ax * i * 1.6, 1.3, ev.z + az * i * 1.6, 0xffc46b, 8, 4);
        v.ring(ev.x, 1.3, ev.z, 0xffffff, 0.2, 1.6, 0.2, 0.9, true);
        break;
      }
      case 'save': case 'block': { v.sparkles(ball.x, ball.y, ball.z, 0xffffff, 26, 7); break; }
      case 'post': v.ring(ball.x, ball.y, ball.z, 0xffffff, 0.3, 2.4, 0.3, 0.9, true); this.rig.shake(0.2 * (settings.shake / 5)); break;
      case 'shieldblock': { const p = P(ev.id); if (p) v.sparkles(p.x, 1.3, p.z, 0xc27bff, 24, 6); break; }
      case 'grapple': {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
        const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x4cf08a, linewidth: 2 }));
        line.frustumCulled = false;
        this.scene.add(line);
        this.grapples.push({ id: ev.id, line, t: 0.6 });
        break;
      }
      case 'skill': { const p = P(ev.id); if (p) v.ring(p.x, 0.1, p.z, 0xffffff, 0.4, 2.2, 0.3, 0.7); break; }
      case 'target': v.sparkles(ev.x, ev.y, ev.z, 0xffd23f, 60, 10); v.ring(ev.x, ev.y, ev.z, 0x2fe39b, 0.4, 4, 0.5, 1, true); break;
      case 'emote': case 'poke': default:
    }
  }

  // ----------------------------------------------------------------- menus
  showMenuChar(cos, visible, dt, emote, team = 0) {
    if (!this.menuChar && visible) {
      this.menuChar = new CharacterModel(cos, 0, { outline: this.quality.outline, shadows: this.quality.shadows });
      this.scene.add(this.menuChar.root);
      this.menuEmoteT = 0;
    }
    if (!this.menuChar) return;
    this.menuChar.root.visible = visible;
    if (!visible) return;
    this.menuChar.setAppearance(cos, team);
    this.menuChar.root.position.set(-30, 0, 0);
    this.menuChar.root.rotation.y = Math.PI / 2 + 0.5;
    this.menuEmoteT = (this.menuEmoteT || 0) + dt;
    const em = emote || null;
    this.menuChar.update(dt, em ? { anim: 'emote', animT: this.menuEmoteT, emote: em } : { anim: 'idle', speed: 0 });
  }

  resetMenuEmote() { this.menuEmoteT = 0; }

  clearWorld() {
    if (this.menuChar) this.menuChar.root.visible = false; // the lobby hero must never appear in a match
    for (const id of [...this.chars.keys()]) this.removeChar(id);
    for (const map of [this.boxes, this.puddles, this.projs, this.walls, this.targets]) { for (const m of map.values()) m.removeFromParent(); map.clear(); }
    for (const g of this.grapples) g.line.removeFromParent();
    this.grapples.length = 0;
    this.aimPivot.visible = false;
    this.chargeSprite.visible = false;
    this.syncTrajectory(null);
  }

  // Lobby scene: hero character + ball, slowly orbiting camera
  menuScene(dt, cos, emote, ballSkin, team = 0, shift = 2.1, wide = false) {
    this.time += dt;
    if (wide) {
      // Slow fly-over of the empty stadium (training page)
      if (this.menuChar) this.menuChar.root.visible = false;
      this.ball.root.position.set(0, PHYS.ballR, 0);
      this.ballShadow.position.set(0, 0.025, 0);
      this.marker.visible = false; this.carrierMarker.visible = false; this.aimPivot.visible = false; this.chargeSprite.visible = false;
      // Elliptical path that stays inside the arena (never clips through the hills outside)
      this.rig.orbit(dt, 0, 0, 0, 40, 17, 0.045, 0, 22);
      this.rig.shift = undefined;
      this.stadium.update(dt, this.cam.position);
      this.vfx.update(dt);
      return;
    }
    this.showMenuChar(cos, true, dt, emote, team);
    this.ball.setSkin(ballSkin);
    const ch = this.menuChar.root;
    const fx = Math.sin(ch.rotation.y), fz = Math.cos(ch.rotation.y);
    // Ball resting beside the hero's left foot
    this.ball.root.position.set(ch.position.x + fx * 0.6 + fz * 1.25, PHYS.ballR, ch.position.z + fz * 0.6 - fx * 1.25);
    this.ball.mesh.rotation.y += dt * 0.6;
    this.ballShadow.position.set(this.ball.root.position.x, 0.025, this.ball.root.position.z);
    this.marker.visible = false;
    this.carrierMarker.visible = false;
    this.aimPivot.visible = false;
    this.chargeSprite.visible = false;
    this.rig.showcase(dt, ch.position.x, ch.position.z, ch.rotation.y, 0, shift);
    this.stadium.update(dt, this.cam.position);
    this.vfx.update(dt);
  }

  render() {
    this.r.render(this.scene, this.cam);
  }
}

export { lerp, FIELD };

// Downward-pointing 3D arrow (four-sided head + shaft), lit so it reads as solid
function makeArrow(color) {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.55 });
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.62, 4), mat);
  head.rotation.x = Math.PI;
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.46, 0.24), mat);
  shaft.position.y = 0.52;
  g.add(head, shaft);
  g.userData.setColor = (c) => { mat.color.set(c); mat.emissive.set(c); };
  return g;
}
