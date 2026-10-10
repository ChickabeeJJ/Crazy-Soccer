import './ui/style.css';
import { SDK } from './sdk.js';
import { Save } from './save.js';
import { GameRenderer } from './render/renderer.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { UI } from './ui/ui.js';
import { Session, inOwnBox } from './game/session.js';
import { Net, randomCode, roomPeerId } from './net/net.js';
import { GAME_VERSION, TEAMS, QUICK_CHAT, ITEMS, MATCH, PLAYER, KICK } from './config.js';
import { CATALOG } from './cosmetics.js';
import { clamp, len2 } from './util/math.js';
import * as THREE from 'three';

const $ = (id) => document.getElementById(id);
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
    this.tut = { step: 0, t: 0 };
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
    this.ui.touchVisible(false);
    this.ui.setLoading(1, 'Ready!');
    await nextFrame();

    window.addEventListener('resize', () => this.renderer.resize());
    document.addEventListener('visibilitychange', () => this.onVisibility());
    this.input.on('lockchange', (locked) => this.onLockChange(locked));
    document.addEventListener('pointerlockerror', () => { this.lockFailed = true; this.ui.clickToPlay(false); });
    $('game').addEventListener('click', () => this.onCanvasClick());
    const unlock = () => { this.audio.unlock(); if (this.state === 'menu' || this.state === 'locker') this.audio.startMusic(); };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    SDK.onSettings((s) => { this.audio.setMuted(s.muteAudio); this.ui.setChatEnabled(!s.disableChat); this.renderer.showChat = !s.disableChat; });
    SDK.onAuth(() => { this.ui.refreshProfile(); });
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
  hello() { return { name: Save.displayName(), cos: this.cos(), team: Save.p.team === 1 ? 1 : 0 }; }

  // ================================================================== menu
  showMenu() {
    this.state = 'menu';
    this.ui.screen('menu', true);
    this.ui.screen('hud', false);
    this.ui.touchVisible(false);
    this.ui.refreshProfile();
    this.renderer.clearWorld();
    this.renderer.setVariant('outdoor');
    this.audio.stopCrowd();
    if (this.audio.ctx) this.audio.startMusic();
    SDK.gameplayStop();
    const note = $('menuNote');
    note.textContent = Save.p.stats.matches === 0 ? 'New here? Pick a team to jump into a 4v4 match — bots fill empty spots!' : '';
  }

  claimDaily() {
    const r = Save.claimDaily();
    if (r) { this.audio.coins(); this.ui.globalToast(`Daily reward: +${r} coins! (streak ${Save.p.daily.streak})`); }
    else this.ui.globalToast('Already claimed today — come back tomorrow!');
    this.ui.refreshProfile();
  }

  async login() {
    await SDK.showAuthPrompt();
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
      this.ui.globalToast('Not enough coins — play matches to earn more!');
      return;
    }
    Save.save();
    this.ui.renderLocker();
    this.ui.refreshProfile();
  }

  // ============================================================== sessions
  startPractice() {
    this.endSession();
    this.session = new Session({ mode: 'practice', role: 'offline', profile: this.hello(), onEvent: (e) => this.onGameEvent(e) });
    this.session.startHost({});
    this.enterGame();
  }

  startOffline(reason) {
    this.endSession();
    this.session = new Session({ mode: 'match', role: 'offline', profile: this.hello(), onEvent: (e) => this.onGameEvent(e) });
    this.session.startHost({});
    this.enterGame();
    if (reason) this.ui.globalToast(reason, 4000);
  }

  async quickPlay(team) {
    if (this.state === 'searching') return;
    if (team === 0 || team === 1) { Save.p.team = team; Save.save(); }
    this.endSession();
    this.state = 'searching';
    this.searchToken = Symbol('search');
    const token = this.searchToken;
    $('searchText').textContent = 'Finding a match…';
    this.ui.modal('searching', true);
    const net = new Net();
    this.net = net;
    let res;
    try {
      res = await withTimeout(net.quickPlay(this.hello(), (t) => { if (this.searchToken === token) $('searchText').textContent = t; }), 14000);
    } catch (e) {
      try { net.close(); } catch (e2) { /* ignore */ }
      if (this.searchToken !== token) return;
      this.ui.modal('searching', false);
      this.startOffline('Online play unavailable right now — playing against bots.');
      return;
    }
    if (this.searchToken !== token) { net.close(); return; }
    this.ui.modal('searching', false);
    if (res.role === 'host') {
      this.session = new Session({ mode: 'match', role: 'host', net, roomKind: 'pub', roomCode: `pub-${res.k}`, profile: this.hello(), onEvent: (e) => this.onGameEvent(e) });
      this.session.startHost({});
    } else {
      this.session = new Session({ mode: 'match', role: 'client', net, roomKind: 'pub', roomCode: `pub-${res.k}`, profile: this.hello(), onEvent: (e) => this.onGameEvent(e) });
      this.session.startClient(res.welcome);
    }
    SDK.updateRoom({ roomId: `pub-${res.k}`, isJoinable: true, inviteParams: { roomId: `pub-${res.k}` } });
    this.enterGame();
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
      this.ui.globalToast('Could not create an online room right now. Try Practice or Play vs bots.', 4000);
      return;
    }
    this.session = new Session({ mode: 'match', role: 'host', net, roomKind: 'priv', roomCode: code, profile: this.hello(), onEvent: (e) => this.onGameEvent(e) });
    this.session.startHost({}, true);
    SDK.updateRoom({ roomId: `priv-${code}`, isJoinable: true, inviteParams: { roomId: `priv-${code}` } });
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
    this.enterGame();
  }

  async joinFromInvite(value) {
    const v = String(value);
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
    if (this.session && this.session.isAuthority) this.session.beginMatch();
  }

  enterGame() {
    const s = this.session;
    this.state = 'game';
    this.ui.screen('menu', false);
    this.ui.screen('locker', false);
    this.ui.screen('hud', true);
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
    this.tut = { step: Save.p.tut, t: 0, moved: 0 };
    this.lastPhase = null;
    if (!SDK.isMobile && !this.lockFailed) this.input.requestLock();
    SDK.gameplayStart();
  }

  endSession() {
    if (this.session) { this.session.destroy(); this.session = null; }
    if (this.net) { try { this.net.close(); } catch (e) { /* ignore */ } this.net = null; }
    this.stopBgTicker();
  }

  async askLeave() {
    if (this.state !== 'game') return;
    this.input.exitLock();
    const ok = await this.ui.confirm('Return to Lobby?', this.session && this.session.mode === 'practice' ? 'Leave the practice area.' : 'You will leave this match.');
    if (ok) this.leaveToLobby(true);
    else this.resume();
  }

  leaveToLobby(early) {
    const wasMatch = this.session && this.session.mode === 'match';
    this.endSession();
    SDK.leftRoom();
    this.input.exitLock();
    this.ui.modal('pause', false);
    this.ui.modal('results', false);
    this.ui.showRoomPanel(null);
    this.ui.hint(null);
    this.ui.clearAnnounce();
    this.showMenu();
    if (wasMatch && !early) this.midgameAd();
  }

  playAgain() {
    const s = this.session;
    this.ui.modal('results', false);
    if (s && s.isAuthority) {
      s.newMatch();
      this.enterGame();
      this.midgameAd();
    } else this.quickPlay();
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
    $('inviteBtn2').classList.toggle('hidden', !(s && s.roomCode));
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
      if (s && s.isAuthority && s.net && s.net.conns.size) this.startBgTicker();
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
      this.bgWorker.onmessage = () => { if (this.session) this.session.update(0.05); };
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
        if (ev.id === s.localId) this.tut.kicked = true;
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
      case 'shatter': A.freeze(); break;
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
        canDouble: SDK.available, online: !!s.net, isHost: s.isAuthority,
      });
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
    const dt = clamp((t - this.last) / 1000, 0, 0.1);
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
    const emote = this.state === 'locker' ? this.menuEmote : null;
    this.renderer.menuScene(dt, this.cos(), emote, Save.p.eq.ball, this.menuTeam ?? (Save.p.team === 1 ? 1 : 0));
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
    s.setInput({ mx, mz, sprint, yaw: rig.yaw, pitch: rig.pitch });
    if (ml > 0.1) this.tut.moved = (this.tut.moved || 0) + dt;

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
      if (inp.wasPressed('kick')) {
        if (equip >= 0) {
          s.action({ a: 'item', slot: equip, ...aim });
          me.equip = -1;
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
      if (inp.wasPressed('pass') && equip >= 0) me.equip = -1;
      else simple('pass', { assist: settings.assistedPasses });
      simple('lob'); simple('flick'); simple('tackle'); simple('dribble'); simple('request');
      if (inp.wasPressed('chat')) this.ui.toggleWheel('chat');
      if (inp.wasPressed('emote')) this.ui.toggleWheel('emote');
      if (inp.wasPressed('lobby')) this.askLeave();
    }
    const statsHeld = active && inp.isDown('stats');

    s.update(dt);

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

    // HUD
    const hasBall = s.hasBall();
    const nearBall = me && ball && ball.owner < 0 && len2(ball.x - me.x, ball.z - me.z) < KICK.hitRange;
    const inBox = me && me.keeper && s.mode !== 'practice' && inOwnBox(me);
    const xh = document.getElementById('crosshair');
    xh.classList.toggle('show', !!me && v.phase !== 'replay');
    xh.classList.toggle('charging', !!(me && me.charging));
    const equip = me && me.equip >= 0 && me.items[me.equip] ? me.items[me.equip] : null;
    this.ui.buildControls({ hasBall: !!hasBall, item: !!equip, inBox: !!inBox && !hasBall, nearBall: !!nearBall });
    this.ui.setTackleLabel(!!inBox);
    this.ui.updateHud({
      view: v, localTeam: me ? me.team : 0, practice: s.mode === 'practice', items: me ? me.items : [null, null], equip: me ? me.equip : -1,
      stamina: me ? me.stamina : 100, exhausted: me ? me.exhausted : false, charging: !!(me && me.charging), charge: me ? me.charge : 0,
      ping: s.role === 'client' ? Math.round(s.rtt * 1000) : 0, fps: this.fps, showStats: settings.showStats,
      statsHeld, session: s, localId: s.localId,
    });
    this.updateBanners(s, v);
    this.updatePhaseAnnouncements(s, v);
    this.updateTutorial(dt, s, hasBall);
  }

  // World point under the crosshair (screen x 50%, y 36%): shots fly through it.
  aimTarget(me) {
    if (!me) return {};
    const cam = this.renderer.cam;
    const v = this._aimV || (this._aimV = new THREE.Vector3());
    v.set(0, 0.28, 0.5).unproject(cam).sub(cam.position).normalize();
    const o = cam.position;
    const minD = o.distanceTo(new THREE.Vector3(me.x, me.y || 0, me.z)) + 14;
    let d = 60;
    if (v.y < -0.01) d = Math.min(60, Math.max(minD, (o.y - 0.4) / -v.y));
    let tx = o.x + v.x * d, ty = o.y + v.y * d, tz = o.z + v.z * d;
    if (ty < 0.4) ty = 0.4;
    return { tx, ty, tz };
  }

  updateBanners(s, v) {
    const list = [];
    if (s.mode === 'practice') list.push({ title: 'Practice area', text: `Press ${this.input.actionLabel('request')} to get the ball • Return to the lobby to enter a match` });
    else if (v.phase === 'warmup') list.push({ title: 'Warm-up', text: s.isAuthority ? 'Press START MATCH when your friends are ready' : 'Waiting for the host to start' });
    else {
      const humans = s.humanCount();
      if (!s.net) list.push({ title: 'Offline match', text: 'Bots are playing with you' });
      else if (humans < 8) list.push({ title: 'Waiting for players', text: 'Bots fill empty spots until others join' });
      if (this.session.intermission > 0 && v.phase === 'end') list.push({ title: 'Next match', text: `starts in ${Math.ceil(this.session.intermission)}s`, kind: 'good' });
      const me = s.me;
      if (me && s.hasBall() && v.phase === 'play') {
        const close = v.players.some((q) => q && q.team !== me.team && Math.hypot(q.x - me.x, q.z - me.z) < 6);
        if (close) list.unshift({ title: 'Dribble to dodge', text: "You can't get tackled while dribbling", kind: 'good' });
      }
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
      if (n !== this.lastCount && n > 0 && n <= 3) { this.lastCount = n; this.ui.announce(String(n)); this.audio.beep(false); }
    } else this.lastCount = null;
    if (v.phase !== this.lastPhase) {
      if (v.phase === 'play' && this.lastPhase === 'kickoff' && s.mode !== 'practice') this.audio.beep(true);
      this.lastPhase = v.phase;
    }
  }

  updateTutorial(dt, s, hasBall) {
    if (!Save.p.settings.showHints) return;
    const T = this.tut;
    if (T.step >= 6 || s.view.phase === 'replay' || s.view.phase === 'kickoff') return;
    T.t += dt;
    const L = (a) => `<kbd>${this.input.actionLabel(a)}</kbd>`;
    const mob = SDK.isMobile;
    const steps = [
      { html: mob ? 'Use the left stick to move • Push it all the way to sprint' : `Move with ${L('forward')}${L('left')}${L('back')}${L('right')} • Hold ${L('sprint')} to sprint`, done: () => (T.moved || 0) > 1.5 },
      { html: 'Run into the ball to dribble it ⚽', done: () => hasBall },
      { html: mob ? 'Hold KICK to charge, release to shoot!' : `Hold ${L('kick')} to charge a shot, release to kick! Aim with your mouse`, done: () => T.kicked },
      { html: mob ? 'PASS, LOB and FLICK to beat defenders' : `${L('pass')} Pass • ${L('lob')} Lob • ${L('flick')} Flick over defenders`, done: () => T.t > 6 },
      { html: mob ? 'TACKLE to steal • JUMP to catch high balls and volley them' : `${L('tackle')} Slide tackle to steal • ${L('dribble')} Jump to catch high balls, then shoot mid-air!`, done: () => T.t > 6 },
      { html: 'Grab the glowing <b>?</b> boxes for crazy items! 🔥❄️🚀', done: () => T.t > 6 },
    ];
    const st = steps[T.step];
    if (!st) return;
    if (this.ui.cache.hintStep !== T.step) { this.ui.cache.hintStep = T.step; this.ui.hint(st.html); }
    if (st.done() && T.t > 1.2) {
      T.step++; T.t = 0;
      Save.p.tut = T.step;
      Save.save();
      if (T.step >= 6) this.ui.hint(null);
    }
  }
}

const app = new App();
window.__app = app;
window.__NetClass = Net;
app.boot().catch((e) => {
  console.error(e);
  const t = document.getElementById('loadText');
  if (t) t.textContent = 'Something went wrong while loading. Please refresh the page.';
});
