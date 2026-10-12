import './ui/style.css';
import { SDK } from './sdk.js';
import { Save } from './save.js';
import { GameRenderer } from './render/renderer.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { UI } from './ui/ui.js';
import { Session, inOwnBox } from './game/session.js';
import { kickVelocity } from './sim/world.js';
import { createBall, stepBall } from './sim/ball.js';
import { Training, TRAINING_INFO } from './game/training.js';
import { Net, randomCode, roomPeerId, prewarmNet } from './net/net.js';
import { GAME_VERSION, TEAMS, QUICK_CHAT, ITEMS, MATCH, PLAYER, KICK, FIELD } from './config.js';
import { CATALOG } from './cosmetics.js';
import { clamp, len2 } from './util/math.js';
import * as THREE from 'three';

const $ = (id) => document.getElementById(id);
const ROLE_NAMES = ['STRIKER', 'LEFT WING', 'RIGHT WING', 'DEFENDER'];
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

class App {
  constructor() {
    this.version = GAME_VERSION;
    this.state = 'loading';
    this.session = null;
    this.net = null;
    this.bindsVersion = 0;
    this.last = performance.now();
    this.fps = 60;
    this.fpsAcc = 0; this.fpsN = 0;
    this.kickSuppressed = false;
    this.menuEmote = null;
    this.menuEmoteT = 0;
    this.replayStart = 0;
    this.lockFailed = false;
    this.wheelOpen = false;
    this.pendingResults = null;
  }

  async boot() {
    this.audio = new Audio();
    this.ui = new UI(this);
    this.ui.setLoading(0.05, 'Connecting…');
    await SDK.init();
    SDK.loadingStart();
    this.adblock = false;
    SDK.hasAdblock().then((b) => { this.adblock = b; });
    Save.load();
    this.ui.setLoading(0.2, 'Loading fonts…');
    try {
      await withTimeout(Promise.all([
        document.fonts.load('400 40px "Lilita One"'),
        document.fonts.load('700 40px "Roboto Condensed"'),
      ]), 2500);
    } catch (e) { /* fall back to system fonts */ }
    this.ui.setLoading(0.4, 'Building the stadium…');
    await nextFrame();
    const canvas = $('game');
    this.renderer = new GameRenderer(canvas, Save.p.settings.perf);
    this.input = new Input(canvas, () => Save.binds);
    this.ui.setLoading(0.75, 'Lacing up boots…');
    await nextFrame();
    try { this.renderer.r.compile(this.renderer.scene, this.renderer.cam); } catch (e) { /* ignore */ }
    this.applySettings();
    this.ui.refreshProfile();
    if (SDK.isMobile) this.ui.setupTouch(this.input);
    // Touch laptops / tablets reported as desktop: switch to touch controls on the first touch
    window.addEventListener('touchstart', () => {
      if (this.ui.isTouch) return;
      SDK.isMobile = true;
      this.ui.setupTouch(this.input);
      this.input.exitLock();
      if (this.state === 'game') this.ui.touchVisible(true);
    }, { passive: true });
    this.ui.touchVisible(false);
    this.ui.setLoading(1, 'Ready!');
    await nextFrame();

    window.addEventListener('resize', () => this.renderer.resize());
    document.addEventListener('visibilitychange', () => this.onVisibility());
    this.input.on('lockchange', (locked) => this.onLockChange(locked));
    document.addEventListener('pointerlockerror', () => { this.lockFailed = true; this.ui.clickToPlay(false); });
    $('game').addEventListener('click', () => this.onCanvasClick());
    // Inside the CrazyGames iframe, make sure keyboard input goes to the game
    window.addEventListener('pointerdown', () => { try { window.focus(); } catch (e) { /* ignore */ } });
    const unlock = () => { this.audio.unlock(); if (this.state === 'menu') this.audio.startMusic(); };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    SDK.onSettings((s) => { this.audio.setMuted(s.muteAudio); this.ui.setChatEnabled(!s.disableChat); this.renderer.showChat = !s.disableChat; });
    SDK.onAuth(() => { this.ui.refreshProfile(); });
    // CrazyGames invites while the game is already open: join without a page reload
    SDK.onJoinRoom((params) => { const id = params && params.roomId; if (id) this.joinFromInvite(id); });
    this.audio.setMuted(SDK.settings.muteAudio);
    this.ui.setChatEnabled(!SDK.settings.disableChat);
    this.renderer.showChat = !SDK.settings.disableChat;

    SDK.loadingStop();
    const ld = document.getElementById('loading'); if (ld) ld.remove();
    this.showMenu();
    requestAnimationFrame((t) => this.frame(t));

    // Invites & instant multiplayer
    const invite = SDK.getInviteParam('roomId');
    if (invite) this.joinFromInvite(invite);
    else if (SDK.isInstantMultiplayer) this.createPrivate();
    else this.newPlayerFlow();
  }

  // First launch: tutorial (skippable) -> free roll for your first item. Friends arriving through an
  // invite go straight into the match and get their free roll back in the menu.
  newPlayerFlow() {
    if (Save.p.starterRoll) return;
    if (!Save.p.tutDone) this.startTraining('tutorial', { firstRun: true });
    else this.ui.showStarterRoll();
  }

  starterRoll() {
    if (Save.p.starterRoll) { this.ui.modal('rollReveal', false); return; }
    const res = Save.roll(1, true);
    if (!res) return;
    this.audio.whoosh();
    this.ui.showRoll(res, { starter: true });
    this.ui.refreshProfile();
  }

  skipTutorial() {
    Save.p.tutDone = true;
    Save.save(true);
    this.leaveToLobby(true, Save.p.starterRoll ? 'training' : 'play');
  }

  // ================================================================ settings
  applySettings() {
    const s = Save.p.settings;
    this.audio.setVolumes({ master: s.master, music: s.music, sfx: s.sfx });
    if (this.renderer) {
      this.renderer.setPerf(s.perf);
      this.renderer.showNames = s.nameTags;
      this.renderer.rig.shakeScale = s.shake / 8;
    }
    $('controlsList').style.display = s.showControls ? '' : 'none';
    document.querySelector('.hud-bl').style.display = s.showControls ? '' : 'none';
    if (!s.showHints) this.ui.hint(null);
    Save.save();
  }
  onSettingsClosed() { Save.save(true); if (this.state === 'game' && !this.ui.isOpen('pause')) this.resume(); }
  onBindsChanged() { this.bindsVersion++; Save.save(); }
  onCosmeticsChanged() { Save.save(); }

  cos() {
    const e = Save.p.eq;
    return { skin: e.skin, hair: e.hair, hairColor: e.hairColor, jersey: e.jersey, ball: e.ball, goalfx: e.goalfx, number: e.number };
  }
  hello() { return { name: Save.displayName(), cos: this.cos(), team: Save.p.team === 1 ? 1 : 0, pw: Save.activePowers() }; }

  // ================================================================== menu
  showMenu(page) {
    this.state = 'menu';
    this.ui.screen('menu', true);
    this.ui.setPage(page || this.ui.page || 'play');
    this.ui.screen('hud', false);
    this.ui.touchVisible(false);
    this.ui.refreshProfile();
    this.renderer.clearWorld();
    this.renderer.setVariant('outdoor');
    this.audio.stopCrowd();
    if (this.audio.ctx) this.audio.startMusic();
    SDK.gameplayStop();
    // Open the signalling connection now so Quick Match connects instantly
    try { prewarmNet(); } catch (e) { /* offline */ }
  }

  claimDaily() {
    const r = Save.claimDaily();
    if (r) { this.audio.coins(); this.ui.globalToast(`Daily reward: +${r} coins! (streak ${Save.p.daily.streak})`); }
    else this.ui.globalToast('Already claimed today. Come back tomorrow!');
    this.ui.refreshProfile();
  }

  rollItems(n) {
    const res = Save.roll(n);
    if (!res) {
      this.audio.beep(false);
      this.ui.globalToast('Not enough coins. Win matches and claim daily rewards to earn more!');
      return;
    }
    this.audio.coins();
    this.ui.showRoll(res);
    this.ui.refreshProfile();
  }

  lockerClick(cat, id) {
    const p = Save.p;
    const item = CATALOG[cat].find((x) => x.id === id);
    if (Save.owns(cat, id)) {
      if (cat === 'emote') {
        const i = p.eq.emotes.indexOf(id);
        if (i >= 0) p.eq.emotes[i] = null;
        else { const free = p.eq.emotes.indexOf(null); if (free >= 0) p.eq.emotes[free] = id; else this.ui.globalToast('Emote wheel is full — remove one first'); }
        p.eq.emotes = [...p.eq.emotes.filter(Boolean), ...Array(8).fill(null)].slice(0, 8);
        this.menuEmote = id; this.renderer.resetMenuEmote();
      } else p.eq[cat] = id;
      this.audio.click();
    } else if (p.coins >= item.price) {
      Save.buy(cat, id);
      if (cat === 'emote') { const free = p.eq.emotes.indexOf(null); if (free >= 0) p.eq.emotes[free] = id; this.menuEmote = id; this.renderer.resetMenuEmote(); }
      else p.eq[cat] = id;
      this.audio.coins();
      this.ui.globalToast(`Unlocked ${item.name}!`);
    } else {
      this.ui.globalToast('Not enough coins. Play matches to earn more!');
      return;
    }
    Save.save();
    this.ui.renderLocker();
    this.ui.refreshProfile();
  }

  // ============================================================== sessions
  startTraining(kind = 'free', opts = {}) {
    this.endSession();
    this.ui.modal('trainRes', false);
    this.lastTraining = { kind, opts };
    const tr = new Training(kind, { ...opts, labels: (a) => this.input.actionLabel(a), mobile: SDK.isMobile });
    this.session = new Session({ mode: 'practice', role: 'offline', profile: this.hello(), training: tr, onEvent: (e) => this.onGameEvent(e) });
    this.session.startHost({});
    SDK.leftRoom();
    this.enterGame();
  }

  retryTraining() {
    const t = this.lastTraining || { kind: 'free', opts: {} };
    this.ui.modal('trainRes', false);
    this.startTraining(t.kind, t.opts);
  }

  onTrainingDone(tr) {
    const r = tr.result;
    const p = Save.p;
    let newBest = false, coins = r.coins || 0;
    if (r.kind === 'shoot' || r.kind === 'keeper') {
      const prev = p.best[r.kind] || 0;
      if (r.score > prev) { p.best[r.kind] = r.score; newBest = prev > 0 || r.score > 0; }
    }
    if (r.kind === 'tutorial' && !p.tutDone) { p.tutDone = true; coins = 100; }
    if (r.kind === 'tutorial' && !p.starterRoll) {
      // New player: straight on to the free first item roll
      if (coins) Save.addCoins(coins);
      Save.save(true);
      SDK.happytime();
      this.leaveToLobby(true, 'play');
      if (coins) { this.audio.coins(); this.ui.globalToast(`Tutorial complete! +${coins} coins`, 3000); }
      return;
    }
    if (coins) Save.addCoins(coins);
    Save.save(true);
    this.input.exitLock();
    SDK.gameplayStop();
    if (r.kind === 'tutorial') SDK.happytime();
    const best = r.kind === 'shoot' ? `Personal best: ${p.best.shoot} points` : r.kind === 'keeper' ? `Personal best: ${p.best.keeper} saves` : (coins ? 'First-time bonus!' : 'Go win some matches!');
    this.ui.showTrainingResult({ title: r.title, score: r.label, best, newBest, coins, retry: r.kind !== 'tutorial' });
    if (coins) this.audio.coins();
    this.ui.refreshProfile();
  }

  startOffline(reason, team) {
    if (team === 0 || team === 1) { Save.p.team = team; Save.save(); }
    this.endSession();
    this.session = new Session({ mode: 'match', role: 'offline', profile: this.hello(), onEvent: (e) => this.onGameEvent(e) });
    this.session.startHost({});
    this.netStatus = 'bots';
    this.enterGame();
    if (reason) this.ui.globalToast(reason, 4000);
  }

  // Quick Match with no waiting: you're in a live 4v4 straight away (bots fill every spot)
  // while we look for real players. If a room with players exists we jump into it; otherwise
  // this match itself becomes a public room and real players replace the bots as they join.
  quickPlay(team) {
    if (team === 0 || team === 1) Save.p.team = team;
    else if (team === -1) Save.p.team = Math.random() < 0.5 ? 0 : 1;
    Save.save();
    this.endSession();
    const session = new Session({ mode: 'match', role: 'offline', roomKind: 'pub', profile: this.hello(), onEvent: (e) => this.onGameEvent(e) });
    session.startHost({});
    this.session = session;
    this.netStatus = 'search';
    this.enterGame();
    this.findOnline(session);
  }

  async findOnline(session) {
    const token = Symbol('search');
    this.searchToken = token;
    const net = new Net();
    this.net = net;
    let res;
    try {
      res = await withTimeout(net.quickPlay(this.hello()), 45000);
    } catch (e) {
      if (this.searchToken === token) { this.net = null; this.netStatus = 'bots'; }
      try { net.close(); } catch (e2) { /* ignore */ }
      return;
    }
    if (this.searchToken !== token || this.session !== session || session.destroyed) { net.close(); return; }
    this.searchToken = null;
    const code = `pub-${res.k}`;
    if (res.role === 'host') {
      session.goOnline(net, 'pub', code);
      if (document.hidden) this.startBgTicker();
      this.netStatus = 'online';
    } else {
      // A room with players already exists: switch into it
      this.net = null; // keep the connection alive while swapping sessions
      session.destroy();
      this.session = new Session({ mode: 'match', role: 'client', net, roomKind: 'pub', roomCode: code, profile: this.hello(), onEvent: (e) => this.onGameEvent(e) });
      this.session.startClient(res.welcome);
      this.net = net;
      this.netStatus = 'online';
      this.enterGame();
      this.ui.toast('Joined a live match!');
    }
    SDK.updateRoom({ roomId: code, isJoinable: true, inviteParams: { roomId: code } });
  }

  switchTeam() {
    const s = this.session;
    if (!s || s.mode !== 'match') return;
    s.switchTeam();
    this.resume();
  }

  cancelSearch() {
    this.searchToken = null;
    if (this.net) { try { this.net.close(); } catch (e) { /* ignore */ } this.net = null; }
    this.ui.modal('searching', false);
    this.state = 'menu';
  }

  async createPrivate() {
    this.ui.modal('private', false);
    this.endSession();
    this.state = 'searching';
    $('searchText').textContent = 'Creating room…';
    this.ui.modal('searching', true);
    const token = Symbol('create');
    this.searchToken = token;
    const net = new Net();
    this.net = net;
    let code = randomCode();
    let ok = false;
    for (let i = 0; i < 3 && !ok; i++) {
      try { await withTimeout(net.hostPrivate(code), 9000); ok = true; } catch (e) { code = randomCode(); }
      if (this.searchToken !== token) { net.close(); return; }
    }
    this.ui.modal('searching', false);
    if (!ok) {
      net.close();
      this.state = 'menu';
      this.ui.globalToast('Could not create an online room right now. Try a Practice Match instead.', 4000);
      return;
    }
    this.session = new Session({ mode: 'match', role: 'host', net, roomKind: 'priv', roomCode: code, profile: this.hello(), onEvent: (e) => this.onGameEvent(e) });
    this.session.startHost({}, true);
    SDK.updateRoom({ roomId: `priv-${code}`, isJoinable: true, inviteParams: { roomId: `priv-${code}` } });
    SDK.showInviteButton({ roomId: `priv-${code}` });
    this.enterGame();
  }

  async joinPrivate(code) {
    if (!/^[A-Z0-9]{5}$/.test(code)) { $('privateMsg').textContent = 'Enter the 5-character room code.'; return; }
    $('privateMsg').textContent = 'Joining…';
    this.endSession();
    const net = new Net();
    this.net = net;
    let res;
    try { res = await withTimeout(net.joinPrivate(code, this.hello()), 12000); } catch (e) { res = { ok: false, why: 'timeout' }; }
    if (!res.ok) {
      net.close();
      const why = { unavailable: 'Room not found.', full: 'That room is full.', version: 'Room is on a different game version.', timeout: 'Room not found or it has closed.' }[res.why] || 'Could not join the room.';
      $('privateMsg').textContent = why;
      if (!this.ui.isOpen('private')) this.ui.globalToast(why);
      return;
    }
    this.ui.modal('private', false);
    this.session = new Session({ mode: 'match', role: 'client', net, roomKind: 'priv', roomCode: code, profile: this.hello(), onEvent: (e) => this.onGameEvent(e) });
    this.session.startClient(res.welcome);
    SDK.updateRoom({ roomId: `priv-${code}`, isJoinable: true, inviteParams: { roomId: `priv-${code}` } });
    SDK.showInviteButton({ roomId: `priv-${code}` });
    this.enterGame();
  }

  async joinFromInvite(value) {
    const v = String(value);
    if (this.state === 'game') this.leaveToLobby(true);
    if (v.startsWith('priv-')) { this.ui.modal('private', true); await this.joinPrivate(v.slice(5).toUpperCase()); return; }
    if (v.startsWith('pub-')) {
      this.endSession();
      const net = new Net();
      this.net = net;
      this.ui.modal('searching', true);
      $('searchText').textContent = 'Joining your friend…';
      try {
        await net.ensureClientPeer();
        const res = await withTimeout(net.tryJoin(roomPeerId('pub', v.slice(4)), this.hello()), 9000);
        this.ui.modal('searching', false);
        if (res.ok) {
          net.attachHost(res.conn);
          this.session = new Session({ mode: 'match', role: 'client', net, roomKind: 'pub', roomCode: v, profile: this.hello(), onEvent: (e) => this.onGameEvent(e) });
          this.session.startClient(res.welcome);
          this.enterGame();
          return;
        }
      } catch (e) { /* fall through */ }
      this.ui.modal('searching', false);
      net.close();
      this.ui.globalToast('That match has ended — finding you a new one!');
      this.quickPlay();
    }
  }

  copyInvite() {
    const s = this.session;
    if (!s || !s.roomCode) return;
    const id = s.roomKind === 'priv' ? `priv-${s.roomCode}` : s.roomCode;
    const link = SDK.inviteLink({ roomId: id });
    const done = () => this.ui.globalToast(s.roomKind === 'priv' ? `Invite link copied! Room code: ${s.roomCode}` : 'Invite link copied!');
    try {
      navigator.clipboard.writeText(link).then(done).catch(() => this.ui.globalToast(`Share this code: ${s.roomCode}`, 5000));
    } catch (e) { this.ui.globalToast(`Share this code: ${s.roomCode}`, 5000); }
  }

  beginPrivateMatch() {
    SDK.hideInviteButton();
    if (this.session && this.session.isAuthority) this.session.beginMatch();
  }

  enterGame() {
    const s = this.session;
    this.state = 'game';
    this.ui.screen('menu', false);
    this.ui.screen('hud', true);
    $('hud').classList.toggle('practice', s.mode === 'practice');
    this.ui.tutorialBox(null);
    this.ui.setRole('');
    this.ui.modal('results', false);
    this.ui.modal('pause', false);
    this.ui.touchVisible(true);
    this.renderer.clearWorld();
    this.renderer.setVariant(s.mode === 'practice' ? 'indoor' : s.view.map || 'grass');
    this.renderer.ball.setSkin(Save.p.eq.ball);
    this.audio.stopMusic();
    this.audio.startCrowd();
    const me = s.me;
    const team = me ? me.team : 0;
    this.renderer.rig.yaw = team === 0 ? Math.PI / 2 : -Math.PI / 2;
    this.renderer.rig.pitch = 0.3;
    if (me) this.renderer.rig.snapTo(me.x, me.y, me.z);
    this.ui.statsPinned = false;
    this.lastPhase = null;
    if (!SDK.isMobile && !this.lockFailed) this.input.requestLock();
    SDK.gameplayStart();
  }

  endSession() {
    this.searchToken = null;
    if (this.session) { this.session.destroy(); this.session = null; }
    if (this.net) { try { this.net.close(); } catch (e) { /* ignore */ } this.net = null; }
    this.stopBgTicker();
  }

  async askLeave() {
    if (this.state !== 'game') return;
    this.input.exitLock();
    if (this.session && this.session.training && this.session.training.kind === 'tutorial') {
      const skip = await this.ui.confirm('Skip the tutorial?', 'You can replay it any time from Training.');
      if (skip) this.skipTutorial(); else this.resume();
      return;
    }
    const ok = await this.ui.confirm('Return to Lobby?', this.session && this.session.mode === 'practice' ? 'Leave the practice area.' : 'You will leave this match.');
    if (ok) this.leaveToLobby(true);
    else this.resume();
  }

  leaveToLobby(early, page) {
    const wasMatch = this.session && this.session.mode === 'match';
    const wasTraining = this.session && this.session.mode === 'practice';
    this.endSession();
    SDK.leftRoom();
    this.input.exitLock();
    this.ui.modal('pause', false);
    this.ui.modal('results', false);
    this.ui.showRoomPanel(null);
    this.ui.hint(null);
    this.ui.clearAnnounce();
    this.ui.tutorialBox(null);
    this.ui.modal('trainRes', false);
    this.showMenu(page || (wasTraining ? 'training' : 'play'));
    // Nobody leaves the first session without their free starter item
    if (!Save.p.starterRoll && !this.ui.isOpen('rollReveal')) { Save.p.tutDone = true; Save.save(true); this.ui.showStarterRoll(); }
    if (wasMatch && !early) this.midgameAd();
  }

  playAgain() {
    const s = this.session;
    this.ui.modal('results', false);
    if (s && s.isAuthority) {
      s.newMatch();
      this.enterGame();
      this.midgameAd();
    } else this.quickPlay(Save.p.team);
  }

  midgameAd() {
    SDK.requestAd('midgame', {
      onStart: () => { this.audio.setAdMuted(true); this.adPlaying = true; SDK.gameplayStop(); },
      onEnd: () => { this.audio.setAdMuted(false); this.adPlaying = false; if (this.state === 'game') SDK.gameplayStart(); },
    });
  }

  async doubleCoins() {
    const r = this.pendingResults;
    if (!r || r.doubled) return;
    $('doubleBtn').disabled = true;
    const ok = await SDK.requestAd('rewarded', {
      onStart: () => { this.audio.setAdMuted(true); this.adPlaying = true; },
      onEnd: () => { this.audio.setAdMuted(false); this.adPlaying = false; },
    });
    if (ok) {
      r.doubled = true;
      Save.addCoins(r.coins);
      this.audio.coins();
      $('resCoins').textContent = `+${r.coins * 2}`;
      this.ui.setDoubled();
      this.ui.refreshProfile();
    } else {
      $('doubleBtn').disabled = false;
      this.ui.globalToast('No ad available right now — try again later.');
    }
  }

  pause() {
    if (this.state !== 'game') return;
    this.input.exitLock();
    const s = this.session;
    $('inviteBtn2').classList.toggle('hidden', !(s && s.roomCode && s.net));
    $('switchTeamBtn').classList.toggle('hidden', !(s && s.mode === 'match'));
    this.ui.modal('pause', true);
    SDK.gameplayStop();
  }

  resume() {
    this.ui.modal('pause', false);
    if (this.state !== 'game') return;
    if (!SDK.isMobile && !this.lockFailed) this.input.requestLock();
    SDK.gameplayStart();
  }

  onLockChange(locked) {
    // There is no pausing in a live match: Escape only releases the mouse ("Click to play" shows).
    if (locked) this.ui.clickToPlay(false);
  }

  onCanvasClick() {
    this.audio.unlock();
    if (this.state === 'game' && !this.input.locked && !SDK.isMobile && !this.lockFailed && !this.ui.anyModal()) this.input.requestLock();
  }

  onWheel(open) { this.wheelOpen = open; }

  slotTap(slot, touch) {
    const me = this.session && this.session.me;
    if (!me || !me.items[slot]) return;
    if (touch || SDK.isMobile) {
      this.session.action({ a: 'item', slot, yaw: this.renderer.rig.yaw, pitch: this.renderer.rig.pitch });
    } else me.equip = me.equip === slot ? -1 : slot;
  }

  sendChat(i) {
    if (!this.session || SDK.settings.disableChat) return;
    this.session.action({ a: 'chat', i });
  }

  sendEmote(id) {
    if (!this.session) return;
    this.session.action({ a: 'emote', id });
  }

  // =========================================================== background
  onVisibility() {
    if (document.hidden) {
      this.audio.suspend();
      const s = this.session;
      // An online room keeps running while the host's tab is in the background (matches never pause)
      if (s && s.isAuthority && s.net) this.startBgTicker();
    } else {
      this.audio.resume();
      this.stopBgTicker();
      this.last = performance.now();
    }
  }

  startBgTicker() {
    if (this.bgWorker) return;
    try {
      const src = 'let t=setInterval(()=>postMessage(0),50);onmessage=()=>{clearInterval(t)}';
      this.bgWorker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      this.bgLast = performance.now();
      this.bgWorker.onmessage = () => {
        const n = performance.now();
        const dt = Math.min(1, (n - this.bgLast) / 1000);
        this.bgLast = n;
        if (this.session && this.session.isAuthority && this.session.net) this.session.update(dt);
      };
    } catch (e) { this.bgWorker = null; }
  }

  stopBgTicker() {
    if (this.bgWorker) { this.bgWorker.terminate(); this.bgWorker = null; }
  }

  // ================================================================ events
  onGameEvent(ev) {
    const s = this.session;
    if (!s) return;
    const settings = Save.p.settings;
    this.renderer.onEvent(ev, s, settings);
    const me = s.me;
    const myTeam = me ? me.team : 0;
    const A = this.audio;
    switch (ev.e) {
      case 'kick':
        this.lastKicker = ev.id;
        if (ev.local !== 1 && ev.id === s.localId && s.role === 'client') break; // already played locally
        if (ev.kind === 'pass') A.pass(); else A.kick(ev.pw || 0.4);
        if (ev.fire) A.item('fire');
        break;
      case 'bounce': case 'wall': A.bounce(ev.v || 8); break;
      case 'post': A.post(); break;
      case 'net': A.net(); break;
      case 'whistle': A.whistle(ev.k); if (ev.k === 'start' && s.view.phase !== 'warmup') this.ui.announce('GO!'); break;
      case 'goal': {
        A.goalHorn();
        if (ev.team !== myTeam) A.groan();
        const scorer = ev.scorer >= 0 ? s.playerName(ev.scorer) : '';
        const assist = ev.assist >= 0 ? s.playerName(ev.assist) : '';
        const title = s.mode === 'practice' ? 'GOAL!' : ev.own ? 'OWN GOAL!' : 'GOAL!';
        this.ui.announce(title);
        this.ui.goalPopup(ev.own ? `Own goal${scorer ? ` (${scorer})` : ''}` : scorer, ev.team, assist);
        if (ev.scorer === s.localId && !ev.own) { SDK.happytime(); }
        break;
      }
      case 'stun':
        if (ev.k === 'frozen') A.freeze(); else if (ev.k === 'slip') A.slip(); else A.thud();
        break;
      case 'tackle': A.tackle(); break;
      case 'dive': case 'skill': A.whoosh(); break;
      case 'pickup':
        if (ev.id === s.localId) {
          A.pickup();
          this.ui.toast(`Got ${ITEMS[ev.k].name}!`);
          if (!Save.p.itemHint) {
            Save.p.itemHint = 1;
            const k = this.input.actionLabel('item1');
            this.showHint(SDK.isMobile ? `Tap the item slot to use <b>${ITEMS[ev.k].name}</b>` : `Press <kbd>${k}</kbd> to equip <b>${ITEMS[ev.k].name}</b>, then click to use it!`, 5);
          }
        }
        break;
      case 'item': A.item(ev.k); break;
      case 'shatter': if (ev.k === 'ice') A.freeze(); else if (ev.k === 'fist' || ev.k === 'bullet') A.thud(); break;
      case 'boom': A.item('bazooka'); A.thud(); break;
      case 'blast': A.thud(); break;
      case 'shieldblock': A.boing(); break;
      case 'toast': if (ev.id === s.localId) { this.ui.toast(ev.text, ev.pts); A.toast(); } break;
      case 'chat':
        if (!SDK.settings.disableChat) { const p = s.playerById(ev.id); this.ui.chatLine(p ? p.name : 'Player', p ? p.team : 0, QUICK_CHAT[ev.i] || ''); A.chat(); }
        break;
      case 'request': if (ev.id !== s.localId) A.beep(false); break;
      case 'overtime': this.ui.announce('OVERTIME', 'Next goal wins!'); break;
      case 'lastchance': this.ui.announce('LAST CHANCE', 'Score now to stay alive!'); break;
      case 'phase':
        if (ev.ph === 'replay') this.replayStart = performance.now();
        break;
      case 'end': this.onMatchEnd(ev); break;
      case 'keeper': {
        if (s.mode === 'practice') break;
        if (ev.id === s.localId) { this.ui.announce('YOU\'RE THE KEEPER!', 'Stay in your box to keep the gloves'); A.pickup(); }
        else if (ev.prev === s.localId) this.ui.toast('You left the box: no longer keeper');
        else if (ev.team === myTeam && ev.id >= 0) this.ui.toast(`${s.playerName(ev.id)} is your keeper`);
        break;
      }
      case 'target': A.goalHorn(); break;
      case 'joined': this.ui.toast(`${ev.name} joined`); break;
      case 'left': this.ui.toast(`${ev.name} left`); break;
      case 'hostlost': this.ui.globalToast('The host left — continuing against bots.', 4000); break;
      case 'newmatch':
        this.ui.modal('results', false);
        if (this.state !== 'game') this.enterGame();
        this.pendingResults = null;
        this.renderer.clearWorld();
        break;
      default:
    }
  }

  onMatchEnd(ev) {
    const s = this.session;
    const me = s.me;
    const myTeam = me ? me.team : 0;
    const row = (ev.stats || []).find((r) => r.id === s.localId) || {};
    const outcome = ev.winner === -1 ? 'draw' : ev.winner === myTeam ? 'win' : 'lose';
    const coins = 25 + (row.goals || 0) * 10 + (row.assists || 0) * 6 + (row.saves || 0) * 5 + (outcome === 'win' ? 30 : outcome === 'draw' ? 12 : 0);
    const xp = 60 + (row.goals || 0) * 25 + (row.assists || 0) * 15 + (row.saves || 0) * 12 + (outcome === 'win' ? 40 : 0);
    Save.addCoins(coins);
    const lv = Save.addXp(xp);
    const st = Save.p.stats;
    st.matches++; if (outcome === 'win') st.wins++;
    st.goals += row.goals || 0; st.assists += row.assists || 0; st.saves += row.saves || 0;
    Save.save(true);
    const mvpRow = (ev.stats || []).find((r) => r.id === ev.mvp);
    this.pendingResults = { coins, xp, outcome, doubled: false };
    this.ui.announce(outcome === 'win' ? 'VICTORY!' : outcome === 'lose' ? 'FULL TIME' : 'DRAW', `${ev.score[0]} – ${ev.score[1]}`);
    if (outcome === 'win') SDK.happytime();
    setTimeout(() => {
      if (this.session !== s || this.state !== 'game') return;
      this.input.exitLock();
      this.ui.showResults({
        outcome, score: ev.score, mvp: mvpRow ? mvpRow.name : '', stats: row, coins, xp,
        canDouble: SDK.available && !this.adblock, online: !!s.net, isHost: s.isAuthority,
      });
      this.ui.showBanner(true);
      if (lv > 0) this.ui.globalToast(`LEVEL UP! You reached level ${Save.p.level} (+${lv * 50} coins)`, 4000);
      this.ui.refreshProfile();
      SDK.gameplayStop();
      if (s.net) this.midgameAd();
    }, 2600);
  }

  showHint(html, secs = 5) {
    if (!Save.p.settings.showHints) return;
    this.ui.hint(html);
    clearTimeout(this.hintTimer);
    this.hintTimer = setTimeout(() => this.ui.hint(null), secs * 1000);
  }

  // ============================================================= main loop
  frame(t) {
    // Rendering uses a capped step; an online host's simulation catches up on real time so a
    // slow or throttled tab never slows the match down for everyone else
    this.rawDt = clamp((t - this.last) / 1000, 0, 1);
    const dt = Math.min(this.rawDt, 0.1);
    this.last = t;
    this.fpsAcc += dt; this.fpsN++;
    if (this.fpsAcc > 0.5) { this.fps = Math.round(this.fpsN / this.fpsAcc); this.fpsAcc = 0; this.fpsN = 0; }
    try {
      if (this.session && (this.state === 'game')) this.updateGame(dt);
      else this.updateMenu(dt);
      this.renderer.render();
    } catch (e) {
      console.error(e);
    }
    this.input.endFrame();
    requestAnimationFrame((tt) => this.frame(tt));
  }

  updateMenu(dt) {
    const page = this.ui.page;
    const emote = page === 'shop' || page === 'inventory' ? this.menuEmote : null;
    const shift = page === 'shop' || page === 'inventory' ? 2.6 : 0;
    this.renderer.menuScene(dt, this.cos(), emote, Save.p.eq.ball, this.menuTeam ?? (Save.p.team === 1 ? 1 : 0), shift, page === 'training');
    if (this.state === 'menu' && !this.ui.anyModal()) {
      // Idle character occasionally emotes
      this.menuEmoteT += dt;
      if (this.menuEmoteT > 9) { this.menuEmoteT = 0; this.menuEmote = null; }
    }
  }

  updateGame(dt) {
    const s = this.session;
    const inp = this.input;
    const rig = this.renderer.rig;
    const settings = Save.p.settings;
    const me = s.me;
    const touch = SDK.isMobile;
    if (inp.wasPressed('unlock') && inp.locked) inp.exitLock();
    const active = !this.ui.anyModal() && (inp.locked || touch || this.lockFailed) && !this.adPlaying;
    this.ui.clickToPlay(!touch && !this.lockFailed && !inp.locked && !this.ui.anyModal() && !this.wheelOpen);

    // Camera
    if (active || inp.dragging) {
      const k = 0.0024 * settings.sens;
      rig.yaw -= inp.mdx * k;
      rig.pitch += inp.mdy * k * (settings.invertY ? -1 : 1);
      rig.setPitchLimits();
      rig.dist = clamp(rig.dist + inp.wheel * 0.8, 5, 15);
    }
    // Movement
    let fwd = 0, right = 0, sprint = false;
    if (active) {
      fwd = (inp.isDown('forward') ? 1 : 0) - (inp.isDown('back') ? 1 : 0);
      right = (inp.isDown('right') ? 1 : 0) - (inp.isDown('left') ? 1 : 0);
      if (inp.touch.active) { fwd = inp.touch.mz; right = inp.touch.mx; }
      sprint = inp.isDown('sprint') || !!inp.touch.sprint || !!inp.touch.sprintToggle;
    }
    const fx = Math.sin(rig.yaw), fz = Math.cos(rig.yaw);
    const rx = -Math.cos(rig.yaw), rz = Math.sin(rig.yaw);
    let mx = fx * fwd + rx * right, mz = fz * fwd + rz * right;
    const ml = len2(mx, mz);
    if (ml > 1) { mx /= ml; mz /= ml; }
    // Touch: the camera gently swings behind the direction you run (unless you're steering it)
    if (touch && active && inp.touch.active && ml > 0.35 && !inp.touch.looking && performance.now() - (inp.touch.lookT || 0) > 900 && !(me && me.charging)) {
      const heading = Math.atan2(mx, mz);
      let d = heading - rig.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      if (Math.abs(d) < 2.6) rig.yaw += d * Math.min(1, dt * 1.5 * Math.min(1, ml));
    }
    s.setInput({ mx, mz, sprint, yaw: rig.yaw, pitch: rig.pitch });

    const aim = { yaw: rig.yaw, pitch: rig.pitch };
    const shotAim = { ...aim, ...this.aimTarget(me) };
    if (me && active) {
      const equip = me.equip >= 0 && me.items[me.equip] ? me.equip : -1;
      if (this.wheelOpen) {
        for (let i = 0; i < 8; i++) if (inp.keyPressed(`Digit${i + 1}`)) this.ui.pickWheel(i);
      } else {
        if (inp.wasPressed('item1') && me.items[0]) me.equip = me.equip === 0 ? -1 : 0;
        if (inp.wasPressed('item2') && me.items[1]) me.equip = me.equip === 1 ? -1 : 1;
      }
      // Bicycle kick: press Kick on the ball to hang in position, aim, then RELEASE to shoot
      // (it fires by itself if you keep holding past KICK.bikeHold)
      const fireBike = () => { s.action({ a: 'kick', pw: 0.95, ...shotAim, cv: 0 }); this.bikeAim = null; this.kickSuppressed = inp.isDown('kick'); };
      if (this.bikeAim) {
        this.bikeAim.t += dt;
        if (!inp.isDown('kick')) this.bikeAim.released = true;
        if (me.anim !== 'bike' && me.anim !== 'volley' && this.bikeAim.t > 0.2) this.bikeAim = null; // knocked out of it
        else if (this.bikeAim.t >= KICK.bikeHold || (this.bikeAim.released && this.bikeAim.t >= 0.14)) fireBike();
      }
      if (inp.wasPressed('kick')) {
        const b = s.view.ball;
        if (this.bikeAim) {
          this.kickSuppressed = true;
        } else if (equip >= 0) {
          s.action({ a: 'item', slot: equip, ...aim });
          me.equip = -1;
          this.kickSuppressed = true;
        } else if (this.canVolley(me, b) && b.y - (me.y || 0) > KICK.bikeMinH && me.cd.kick <= 0) {
          s.action({ a: 'bike' });
          this.bikeAim = { t: 0 };
          this.kickSuppressed = true;
        } else if (this.canVolley(me, b)) {
          // Ball in the air next to you: volley it instantly (no charging mid-air)
          s.action({ a: 'kick', pw: 0.9, ...shotAim, cv: settings.autoCurve ? right : 0 });
          this.kickSuppressed = true;
        } else {
          s.action({ a: 'charge', on: true });
        }
        this.ui.flashControl('kick');
      }
      if (inp.wasReleased('kick')) {
        if (this.kickSuppressed) this.kickSuppressed = false;
        else if (me.charging) s.action({ a: 'kick', pw: me.charge, ...shotAim, cv: settings.autoCurve ? right : 0 });
        else s.action({ a: 'kick', pw: 0, ...shotAim, cv: 0 });
      }
      const simple = (name, extra = {}) => { if (inp.wasPressed(name)) { s.action({ a: name, ...aim, mx, mz, ...extra }); this.ui.flashControl(name); } };
      // Goalkeepers dive with RMB by default (shares the button with Pass, which needs the ball)
      const canDive = me.keeper && inOwnBox(me, 0.6) && !s.hasBall();
      const dived = canDive && inp.wasPressed('dive');
      if (dived) { s.action({ a: 'dive', ...aim, mx, mz }); this.ui.flashControl('tackle'); }
      if (inp.wasPressed('pass') && equip >= 0) me.equip = -1;
      else if (!dived) simple('pass', { assist: settings.assistedPasses });
      simple('lob'); simple('flick'); simple('tackle'); simple('dribble'); simple('request');
      if (inp.wasPressed('chat')) this.ui.toggleWheel('chat');
      if (inp.wasPressed('emote')) this.ui.toggleWheel('emote');
      if (inp.wasPressed('lobby')) this.askLeave();
    }
    const statsHeld = active && inp.isDown('stats');

    s.update(s.isAuthority && s.net ? this.rawDt : dt);

    // Render sync
    const v = s.view;
    const variant = s.mode === 'practice' ? 'indoor' : v.map || 'grass';
    if (variant !== this.renderer.stadium.variant) this.renderer.setVariant(variant);
    let frame = null, progress = 0;
    if (v.phase === 'replay') {
      progress = clamp((performance.now() - this.replayStart) / 1000 / MATCH.replayTime, 0, 1);
      frame = s.replayFrame(progress);
    }
    const ball = v.ball;
    let kickerTeam = -1;
    if (ball && ball.lastTeam !== undefined && s.isAuthority) kickerTeam = ball.lastTeam;
    else if (ball && ball.owner < 0) { const k = s.playerById(this.lastKicker); kickerTeam = k ? k.team : -1; }
    this.renderer.syncWorld(v, s.localId, dt, { replay: frame, replaySpeed: 0.9, kickerTeam });
    if (frame) {
      const lg = s.world ? s.world.lastGoal : null;
      const side = lg ? (lg.team === 0 ? 1 : -1) : (frame.b[0] > 0 ? 1 : -1);
      if (progress < 0.02) rig.replayStyle = (rig.replayStyle || 0) + (this._lastReplay !== this.replayStart ? 1 : 0);
      this._lastReplay = this.replayStart;
      rig.replay(dt, { x: frame.b[0], y: frame.b[1], z: frame.b[2] }, progress, side);
    } else if (me) {
      rig.follow(dt, me.x, me.y || 0, me.z);
    }
    this.renderer.syncAim(me, rig.yaw, !!(me && me.charging && !frame), me ? me.charge : 0);
    this.updateTrajectory(s, me, frame, shotAim, settings.autoCurve ? right : 0);

    // HUD
    const hasBall = s.hasBall();
    const nearBall = me && ball && ball.owner < 0 && len2(ball.x - me.x, ball.z - me.z) < KICK.hitRange;
    const inBox = me && me.keeper && inOwnBox(me, 0.6);
    const xh = document.getElementById('crosshair');
    xh.classList.toggle('show', !!me && v.phase !== 'replay');
    xh.classList.toggle('charging', !!(me && me.charging));
    const equip = me && me.equip >= 0 && me.items[me.equip] ? me.items[me.equip] : null;
    this.ui.buildControls({ hasBall: !!hasBall, item: !!equip, inBox: !!inBox && !hasBall, nearBall: !!nearBall });
    if (this.ui.isTouch) this.ui.setTouchState(!!hasBall, !!inBox, !!equip);
    this.ui.updateHud({
      view: v, localTeam: me ? me.team : 0, practice: s.mode === 'practice', items: me ? me.items : [null, null], equip: me ? me.equip : -1,
      stamina: me ? me.stamina : 100, exhausted: me ? me.exhausted : false, charging: !!(me && me.charging), charge: me ? me.charge : 0,
      ping: s.role === 'client' ? Math.round(s.rtt * 1000) : 0, fps: this.fps, showStats: settings.showStats,
      statsHeld, session: s, localId: s.localId,
    });
    const tr = s.training;
    const th = tr ? tr.hud() : null;
    this.ui.setDrill(!!(th && th.drill), th && th.drill ? th.drill.score : 0, th && th.drill ? th.drill.label : '');
    this.ui.tutorialBox(th && th.tut ? th.tut : null);
    if (th && th.timer) this.ui.setVal('timerText', 'text', th.timer);
    let role = '';
    if (me && s.mode !== 'practice') role = me.keeper ? 'GOALKEEPER' : ROLE_NAMES[(me.slot ?? 0) % 4];
    else if (me && me.keeper) role = 'GOALKEEPER';
    if (me && me.keeper && ball && ball.owner === me.id && ball.held) role += ` · THROW IN ${Math.max(0, Math.ceil(ball.holdT || 0))}`;
    this.ui.setRole(role, !!(me && me.keeper));
    this.updateBanners(s, v, th);
    this.updatePhaseAnnouncements(s, v);
    if (tr && tr.result && !tr.reported) { tr.reported = true; setTimeout(() => { if (this.session && this.session.training === tr) this.onTrainingDone(tr); }, 700); }
  }

  canVolley(me, b) {
    if (!me || !b || b.owner >= 0 || b.grapple >= 0) return false;
    const rel = b.y - (me.y || 0);
    return b.y > 1.05 && rel > 0.3 && rel < KICK.volleyReachUp && len2(b.x - me.x, b.z - me.z) < KICK.volleyReachH;
  }

  // Ball lines: preview of your shot while charging, and the predicted path of any fast ball.
  // Both run the real ball physics (gravity, bounces, curve, posts, nets, walls).
  // The ball carrier's aim line, shown to everyone while they charge a shot
  otherAimPath(s, me) {
    const b = s.view.ball;
    if (!b || b.owner < 0 || (me && b.owner === me.id)) return null;
    const p = s.view.players.find((q) => q && q.id === b.owner);
    if (!p || !p.charging) return null;
    const yaw = Number.isFinite(p.aimYaw) ? p.aimYaw : (p.in && Number.isFinite(p.in.yaw) ? p.in.yaw : p.face);
    const pitch = Number.isFinite(p.aimPitch) ? p.aimPitch : (p.in && Number.isFinite(p.in.pitch) ? p.in.pitch : 0.28);
    const k = kickVelocity({ ...p, face: yaw }, { a: 'kick', pw: p.charge || 0, yaw, pitch, cv: 0 }, s.view.players, p.fx && p.fx.fire > 0);
    const sim = { ...createBall(), x: p.x + Math.sin(yaw) * PLAYER.dribbleDist, y: (p.y || 0) + 0.55, z: p.z + Math.cos(yaw) * PLAYER.dribbleDist, vx: k.vx, vy: k.vy, vz: k.vz, curve: k.curve };
    const pts = [], ev = [];
    for (let i = 1; i <= 120; i++) {
      stepBall(sim, 1 / 60, ev);
      if (i % 2 === 0) pts.push({ x: sim.x, y: sim.y, z: sim.z });
      if (sim.inNet || ev.some((e) => e.e !== 'bounce')) { pts.push({ x: sim.x, y: sim.y, z: sim.z }); break; }
      if (Math.hypot(sim.vx, sim.vz) < 3 && sim.y < 0.6) break;
    }
    return { pts, color: TEAMS[p.team].color };
  }

  updateTrajectory(s, me, frame, shotAim, cv) {
    const R = this.renderer;
    const b = s.view.ball;
    const other = frame || !b || s.view.phase === 'replay' ? null : this.otherAimPath(s, me);
    R.syncOtherAim(other && other.pts, other && other.color);
    if (frame || !b || s.view.phase === 'replay') { R.syncTrajectory(null); return; }
    let sim = null, kind = 'flight';
    const near = me && (b.owner === me.id || (b.owner < 0 && len2(b.x - me.x, b.z - me.z) < KICK.hitRange && b.y < 2.6 + (me.y || 0)));
    if (me && this.bikeAim && b.owner < 0) {
      // Bicycle kick: show exactly where it will go while you hang in the air aiming
      const k = kickVelocity({ ...me, face: shotAim.yaw }, { a: 'kick', pw: 0.95, ...shotAim, cv: 0, volley: 1, sx: b.x, sy: b.y, sz: b.z }, s.view.players, me.fx && me.fx.fire > 0);
      sim = { ...createBall(), x: b.x, y: b.y, z: b.z, vx: k.vx, vy: k.vy, vz: k.vz, curve: k.curve };
      kind = 'aim';
    } else if (me && me.charging && near) {
      const act = { a: 'kick', pw: me.charge, ...shotAim, cv };
      const yaw = shotAim.yaw;
      const fire = me.fx && me.fx.fire > 0;
      const k = kickVelocity({ ...me, face: yaw }, act, s.view.players, fire);
      const held = b.owner === me.id && b.held;
      sim = { ...createBall(), x: me.x + Math.sin(yaw) * PLAYER.dribbleDist, y: held ? (me.y || 0) + 1.35 : (me.y || 0) + 0.55, z: me.z + Math.cos(yaw) * PLAYER.dribbleDist, vx: k.vx, vy: k.vy, vz: k.vz, curve: k.curve };
      kind = 'aim';
    } else if (b.owner < 0 && Math.hypot(b.vx, b.vy, b.vz) > 13 && b.grapple < 0) {
      sim = { ...createBall(), x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz, curve: b.curve || 0, inNet: b.inNet || 0 };
    }
    if (!sim) { R.syncTrajectory(null); return; }
    const pts = [];
    let land = null;
    const ev = [];
    const steps = kind === 'aim' ? 150 : 90;
    for (let i = 1; i <= steps; i++) {
      const wasAir = sim.y > 0.6;
      stepBall(sim, 1 / 60, ev);
      if (i % 2 === 0) pts.push({ x: sim.x, y: sim.y, z: sim.z });
      if (!land && wasAir && sim.y <= 0.56 && i > 3) land = { x: sim.x, z: sim.z };
      if (sim.inNet) { pts.push({ x: sim.x, y: sim.y, z: sim.z }); break; }
      // End the line where the ball first hits a wall, post or net (rebounds only confuse the read)
      if (ev.some((e) => e.e !== 'bounce')) { pts.push({ x: sim.x, y: sim.y, z: sim.z }); break; }
      if (Math.hypot(sim.vx, sim.vz) < 3 && sim.y < 0.6) break;
    }
    R.syncTrajectory(pts, kind, land);
  }

  // World point under the crosshair (the middle of the screen): shots fly through it.
  aimTarget(me) {
    if (!me) return {};
    const cam = this.renderer.cam;
    const v = this._aimV || (this._aimV = new THREE.Vector3());
    v.set(0, 0, 0.5).unproject(cam).sub(cam.position).normalize();
    const o = cam.position;
    const minD = o.distanceTo(new THREE.Vector3(me.x, me.y || 0, me.z)) + 14;
    let d = 60;
    if (v.y < -0.01) d = Math.min(60, Math.max(minD, (o.y - 0.4) / -v.y));
    let tx = o.x + v.x * d, ty = o.y + v.y * d, tz = o.z + v.z * d;
    if (ty < 0.4) ty = 0.4;
    // Touch aim assist: aiming roughly at the rival goal snaps the shot inside the frame
    if (this.ui.isTouch && Save.p.settings.aimAssist !== false) {
      const gx = me.team === 0 ? FIELD.halfL : -FIELD.halfL;
      const dist = Math.abs(gx - me.x);
      if (dist < 42 && Math.sign(v.x) === Math.sign(gx) && Math.abs(v.x) > 0.05) {
        const k = (gx - o.x) / v.x;
        const gz = o.z + v.z * k, gy = o.y + v.y * k;
        const hw = FIELD.goalW / 2;
        if (Math.abs(gz) < hw + 9) {
          tx = gx + Math.sign(gx) * 0.6;
          tz = clamp(gz, -hw + 1.3, hw - 1.3);
          ty = clamp(gy, 0.6, FIELD.goalH - 1);
        }
      }
    }
    return { tx, ty, tz };
  }

  updateBanners(s, v, th) {
    // Mercy rule: one more goal by the leading team ends the match
    const mercy = (s.rules && s.rules.mercy) || MATCH.mercy;
    const diff = (v.score ? v.score[0] - v.score[1] : 0);
    const onMercy = s.mode === 'match' && mercy > 1 && Math.abs(diff) === mercy - 1 && ['kickoff', 'play', 'goal', 'replay'].includes(v.phase) && !v.ot;
    const lead = diff > 0 ? 0 : 1;
    const me = s.me;
    const key = onMercy ? `${lead}|${v.score[0]}-${v.score[1]}` : '';
    if (key !== this.mercyKey) {
      this.mercyKey = key;
      const bar = $('mercyBar');
      bar.classList.toggle('show', onMercy);
      if (onMercy) {
        bar.style.setProperty('--tc', TEAMS[lead].css);
        const mine = me && me.team === lead;
        $('mercyText').textContent = mine ? `One more ${TEAMS[lead].name.toUpperCase()} goal wins it` : `One more ${TEAMS[lead].name.toUpperCase()} goal ends the match`;
        bar.classList.remove('pop'); void bar.offsetWidth; bar.classList.add('pop');
        this.audio.beep(false);
      }
    }
    const list = [];
    if (s.mode !== 'practice') {
      if (v.phase === 'warmup' && !s.isAuthority) list.push({ title: 'Waiting for the host' });
      if (this.session.intermission > 0 && v.phase === 'end') list.push({ title: 'Next match', text: `${Math.ceil(this.session.intermission)}s`, kind: 'good' });
    }
    this.ui.setBanners(list);

    if (s.roomKind === 'priv' && v.phase === 'warmup') {
      const players = s.isAuthority ? s.world.humans().map((p) => ({ name: p.name, team: p.team })) : [...s.roster.values()].filter((r) => !r.bot).map((r) => ({ name: r.name, team: r.team }));
      this.ui.showRoomPanel({ code: s.roomCode, players, isHost: s.isAuthority });
    } else this.ui.showRoomPanel(null);
    if (this.ui.isOpen('results') && s.intermission > 0) this.ui.setResNext(`Next match starts in ${Math.ceil(s.intermission)}…`);
  }

  updatePhaseAnnouncements(s, v) {
    if (v.phase === 'kickoff' && s.mode !== 'practice') {
      const n = Math.ceil(v.phaseT);
      if (n !== this.lastCount && n > 0 && n <= 3) {
        this.lastCount = n;
        const me = s.me;
        const role = me && me.keeper ? 'GOALKEEPER' : me ? ROLE_NAMES[(me.slot ?? 0) % 4] : '';
        this.ui.announce(String(n), role ? `You're ${/^[AEIOU]/.test(role) ? 'an' : 'a'} ${role}` : '');
        this.audio.beep(false);
      }
    } else this.lastCount = null;
    if (v.phase !== this.lastPhase) {
      if (v.phase === 'play' && this.lastPhase === 'kickoff' && s.mode !== 'practice') this.audio.beep(true);
      this.lastPhase = v.phase;
    }
  }

}

const app = new App();
window.__app = app;
window.__NetClass = Net;
window.__Save = Save;
app.boot().catch((e) => {
  console.error(e);
  const t = document.getElementById('loadText');
  if (t) t.textContent = 'Something went wrong while loading. Please refresh the page.';
});
