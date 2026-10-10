// DOM UI: menus, HUD, locker, settings, wheels, results, touch controls.
import { Save, BIND_LABELS, DEFAULT_BINDS } from '../save.js';
import { CATALOG, TAB_LABELS, SKIN_TONES, HAIR_COLORS } from '../cosmetics.js';
import { TEAMS, QUICK_CHAT, ITEMS, PLAYER } from '../config.js';
import { fmtTime, clamp } from '../util/math.js';
import { itemSvg, previewJersey, previewBall, previewGoalFx, previewEmote, previewHair } from './icons.js';
import { SDK } from '../sdk.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export class UI {
  constructor(app) {
    this.app = app;
    this.cache = {};
    this.lockerTab = 'jersey';
    this.wheelType = null;
    this.wheelSel = -1;
    this.isTouch = SDK.isMobile;
    this.bindButtons();
    this.previewCache = new Map();
    if (this.isTouch) document.body.classList.add('is-touch');
  }

  // ---------------------------------------------------------------- screens
  screen(id, on) { $(id).classList.toggle('show', !!on); }
  modal(id, on) { $(id).classList.toggle('show', !!on); }
  isOpen(id) { return $(id).classList.contains('show'); }
  anyModal() { return ['pause', 'results', 'settings', 'private', 'searching', 'confirm'].some((m) => this.isOpen(m)); }

  setLoading(p, text) {
    $('loadFill').style.width = `${Math.round(p * 100)}%`;
    if (text) $('loadText').textContent = text;
  }

  bindButtons() {
    const app = this.app;
    const click = (id, fn) => $(id).addEventListener('click', (e) => { e.stopPropagation(); app.audio.click(); fn(e); });
    click('playBtn', () => app.quickPlay());
    click('practiceBtn', () => app.startPractice());
    click('privateBtn', () => { $('privateMsg').textContent = ''; this.modal('private', true); });
    click('createRoomBtn', () => app.createPrivate());
    click('joinCodeBtn', () => app.joinPrivate($('codeInput').value.trim().toUpperCase()));
    $('codeInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') app.joinPrivate($('codeInput').value.trim().toUpperCase()); });
    click('shopBtn', () => this.openLocker());
    click('settingsBtn', () => this.openSettings());
    click('pauseSettingsBtn', () => this.openSettings());
    click('dailyBtn', () => app.claimDaily());
    click('loginBtn', () => app.login());
    click('resumeBtn', () => app.resume());
    click('leaveBtn', () => app.leaveToLobby(true));
    click('inviteBtn2', () => app.copyInvite());
    click('againBtn', () => app.playAgain());
    click('resLobbyBtn', () => app.leaveToLobby(false));
    click('doubleBtn', () => app.doubleCoins());
    click('cancelSearchBtn', () => app.cancelSearch());
    click('menuHudBtn', () => app.pause());
    click('chatHudBtn', () => this.toggleWheel('chat'));
    click('emoteHudBtn', () => this.toggleWheel('emote'));
    click('statsKey', () => { this.statsPinned = !this.statsPinned; });
    click('lobbyKey', () => app.askLeave());
    document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      app.audio.click();
      const id = b.dataset.close;
      if (id === 'locker') this.closeLocker(); else this.modal(id, false);
      if (id === 'settings') app.onSettingsClosed();
    }));
    for (const s of [0, 1]) {
      $(`slot${s}`).addEventListener('click', (e) => { e.stopPropagation(); app.slotTap(s); });
      $(`slot${s}`).addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); app.slotTap(s, true); }, { passive: false });
    }
    document.querySelectorAll('button').forEach((b) => b.addEventListener('mouseenter', () => app.audio.hover()));
  }

  confirm(title, text) {
    return new Promise((resolve) => {
      $('confirmTitle').textContent = title;
      $('confirmText').textContent = text;
      this.modal('confirm', true);
      const done = (v) => { this.modal('confirm', false); $('confirmYes').onclick = null; $('confirmNo').onclick = null; resolve(v); };
      $('confirmYes').onclick = () => { this.app.audio.click(); done(true); };
      $('confirmNo').onclick = () => { this.app.audio.click(); done(false); };
    });
  }

  globalToast(text, ms = 2600) {
    const d = document.createElement('div');
    d.textContent = text;
    $('toastGlobal').appendChild(d);
    setTimeout(() => d.remove(), ms);
  }

  // ---------------------------------------------------------------- profile
  refreshProfile() {
    const p = Save.p;
    $('pcName').textContent = Save.displayName();
    $('pcLevel').textContent = `Level ${p.level}`;
    $('pcXp').style.width = `${clamp(p.xp / Save.xpNeeded(p.level), 0, 1) * 100}%`;
    $('pcXpText').textContent = `${p.xp}/${Save.xpNeeded(p.level)}`;
    $('pcCoins').textContent = p.coins;
    $('lockerCoins').textContent = p.coins;
    const daily = Save.dailyAvailable();
    $('dailyBtn').classList.toggle('hot', daily);
    $('dailyBtn').classList.toggle('claimed', !daily);
    $('dailyBtn').innerHTML = `<span class="pill-ico">🎁</span> ${daily ? 'Daily Reward' : 'Come back tomorrow'}`;
    const u = SDK.user;
    if (u && u.profilePictureUrl) $('pcAvatar').style.backgroundImage = `url("${u.profilePictureUrl}")`;
    $('loginBtn').classList.toggle('hidden', !(SDK.available && !SDK.user && SDK.environment === 'crazygames'));
  }

  // ------------------------------------------------------------------ HUD
  buildControls(state) {
    // state: { hasBall, item, inBox, practice }
    const key = JSON.stringify(state) + this.app.bindsVersion;
    if (this.cache.ctrlKey === key) return;
    this.cache.ctrlKey = key;
    const L = (a) => this.app.input.actionLabel(a);
    const kick = state.item ? 'Activate' : 'Kick';
    const pass = state.item ? 'Focus' : 'Pass';
    const rows = [
      [kick, L('kick'), state.hasBall || state.item || state.nearBall, 'kick'],
      [pass, L('pass'), state.hasBall, 'pass'],
      ['Flick', L('flick'), state.hasBall, 'flick'],
      [state.inBox ? 'Dive' : 'Tackle', L('tackle'), !state.hasBall, 'tackle'],
      ['Lob', L('lob'), state.hasBall, 'lob'],
      ['Request', L('request'), !state.hasBall, 'request'],
      ['Dribble', L('dribble'), true, 'dribble', true],
      ['Sprint', L('sprint'), true, 'sprint'],
    ];
    $('controlsList').innerHTML = rows.map(([n, k, on, id, gap]) => `<div class="kbtn ${on ? '' : 'off'} ${gap ? 'gap' : ''}" data-k="${id}"><span>${n}</span><kbd>${esc(k)}</kbd></div>`).join('');
    $('statsKey').querySelector('kbd').textContent = L('stats');
    $('lobbyKey').querySelector('kbd').textContent = L('lobby');
  }

  flashControl(id) {
    const el = $('controlsList').querySelector(`[data-k="${id}"]`);
    if (!el) return;
    el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), 160);
  }

  setVal(id, prop, val) {
    const k = id + prop;
    if (this.cache[k] === val) return false;
    this.cache[k] = val;
    const el = $(id);
    if (prop === 'text') el.textContent = val;
    else if (prop === 'html') el.innerHTML = val;
    else if (prop === 'class') el.className = val;
    return true;
  }

  updateHud(s) {
    // s: { view, me, localTeam, practice, items, equip, stamina, charging, charge, ping, fps, hasBall }
    const v = s.view;
    if (this.setVal('scoreRed', 'text', String(v.score[0]))) this.bump('scoreRed');
    if (this.setVal('scoreBlue', 'text', String(v.score[1]))) this.bump('scoreBlue');
    this.setVal('youTag', 'class', `you ${s.localTeam === 1 ? 'right' : 'left'}`);
    let t;
    if (s.practice) t = 'PRACTICE';
    else if (v.phase === 'warmup') t = 'WARM-UP';
    else if (v.ot === 1) t = `OT +${fmtTime(v.clock)}`;
    else if (v.ot === 2) t = 'LAST CHANCE';
    else t = fmtTime(v.clock);
    this.setVal('timerText', 'text', t);
    this.setVal('timer', 'class', `timer ${v.ot ? 'ot' : ''}`);

    // Item slots
    for (const i of [0, 1]) {
      const it = s.items[i];
      const cls = `slot ${it ? 'full' : ''} ${s.equip === i ? 'eq' : ''}`;
      this.setVal(`slot${i}`, 'class', cls);
      const key = `slotIco${i}`;
      if (this.cache[key] !== it) {
        this.cache[key] = it;
        $(`slot${i}`).querySelector('.slot-ico').innerHTML = it ? itemSvg(it) : '';
        $(`slot${i}`).title = it ? `${ITEMS[it].name}: ${ITEMS[it].desc}` : '';
      }
    }
    // Stamina / charge bar
    const segs = $('stamina').children;
    const val = s.charging ? s.charge : s.stamina / PLAYER.staminaMax;
    const q = Math.round(val * 100);
    if (this.cache.stam !== q || this.cache.stamMode !== s.charging) {
      this.cache.stam = q; this.cache.stamMode = s.charging;
      for (let i = 0; i < 4; i++) {
        const f = clamp(val * 4 - i, 0, 1);
        segs[i].firstChild.style.transform = `scaleX(${f})`;
      }
      $('stamina').className = `stamina ${s.charging ? 'charge' : ''} ${!s.charging && s.exhausted ? 'tired' : ''}`;
    }
    this.setVal('netStats', 'text', s.showStats ? `${s.fps} fps${s.ping ? ` • ${s.ping} ms` : ''}` : '');
    const rep = v.phase === 'replay';
    if (this.cache.rep !== rep) { this.cache.rep = rep; $('recOverlay').classList.toggle('show', rep); $('hud').classList.toggle('replay', rep); }
    const stats = this.statsPinned || s.statsHeld;
    if (stats) this.renderStats(s.session, s.localId);
    $('statsPanel').classList.toggle('show', !!stats);
  }

  bump(id) {
    const el = $(id);
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }

  setBanners(list) {
    const html = list.map((b) => `<div class="banner ${b.kind || ''}"><b>${esc(b.title)}</b>${b.text ? ` · ${esc(b.text)}` : ''}</div>`).join('');
    this.setVal('banners', 'html', html);
  }

  toast(text, pts) {
    const d = document.createElement('div');
    d.className = `toast ${pts >= 40 ? 'big' : ''}`;
    d.textContent = text;
    if (pts) { const b = document.createElement('b'); b.textContent = `+${pts}`; d.appendChild(b); }
    $('toasts').prepend(d);
    while ($('toasts').children.length > 5) $('toasts').lastChild.remove();
    setTimeout(() => d.remove(), 2600);
  }

  goalPopup(name, team, assist) {
    $('gpName').textContent = name || 'Own goal';
    $('gpSq').className = `sq ${team === 1 ? 'blue' : 'red'}`;
    $('gpAssist').textContent = assist ? `⚽ ${assist}` : '';
    const el = $('goalPop');
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    $('hud').classList.add('goal');
    clearTimeout(this.gpTimer);
    this.gpTimer = setTimeout(() => { el.classList.remove('show'); $('hud').classList.remove('goal'); }, 3200);
  }

  announce(text, sub = '', hold = false) {
    const el = $('announce');
    el.innerHTML = `${esc(text)}${sub ? `<small>${esc(sub)}</small>` : ''}`;
    el.className = 'announce';
    void el.offsetWidth;
    el.className = `announce ${hold ? 'hold' : 'pop'}`;
  }
  clearAnnounce() { $('announce').className = 'announce'; }

  hint(html) {
    const el = $('hint');
    if (!html) { el.classList.remove('show'); return; }
    el.innerHTML = html;
    el.classList.add('show');
  }

  clickToPlay(on) { $('clickToPlay').classList.toggle('show', !!on); }

  chatLine(name, team, text) {
    const d = document.createElement('div');
    d.className = 'chat-line';
    d.innerHTML = `<b style="color:${TEAMS[team] ? TEAMS[team].css : '#fff'}">${esc(name)}:</b>${esc(text)}`;
    $('chatFeed').appendChild(d);
    while ($('chatFeed').children.length > 5) $('chatFeed').firstChild.remove();
    setTimeout(() => d.remove(), 7000);
  }

  setChatEnabled(on) {
    $('chatHudBtn').classList.toggle('hidden', !on);
    $('chatFeed').classList.toggle('hidden', !on);
  }

  renderStats(session, localId) {
    if (!session) return;
    const now = performance.now();
    if (this.cache.statsT && now - this.cache.statsT < 300) return;
    this.cache.statsT = now;
    const rows = session.statsTable();
    const v = session.view;
    const team = (t) => {
      const list = rows.filter((r) => r.team === t).sort((a, b) => (b.points || 0) - (a.points || 0));
      const body = list.map((r) => `<tr class="${r.id === localId ? 'me' : ''}"><td>${esc(r.name)}${r.bot ? '<span class="bot">BOT</span>' : ''}</td><td>${r.points || 0}</td><td>${r.goals || 0}</td><td>${r.shots || 0}</td><td>${r.assists || 0}</td><td>${r.saves || 0}</td></tr>`).join('');
      return `<div class="stats-team"><h3><span class="sq ${t ? 'blue' : 'red'}"></span>${TEAMS[t].name} Team — ${v.score[t]}</h3><table class="stats-table"><tr><th>Player</th><th>Points</th><th>Goals</th><th>Shots</th><th>Assists</th><th>Saves</th></tr>${body}</table></div>`;
    };
    $('statsBody').innerHTML = team(0) + team(1);
  }

  // ---------------------------------------------------------------- wheel
  toggleWheel(type) {
    if (this.wheelType === type) { this.closeWheel(); return; }
    if (type === 'chat' && SDK.settings.disableChat) return;
    this.wheelType = type;
    const items = type === 'chat' ? QUICK_CHAT : Save.p.eq.emotes.map((e) => e || null);
    const el = $('wheel');
    el.querySelectorAll('.wheel-item').forEach((x) => x.remove());
    $('wheelCenter').textContent = type === 'chat' ? 'Quick Chat' : 'Emotes';
    items.forEach((it, i) => {
      const a = (i / items.length) * Math.PI * 2 - Math.PI / 2;
      const d = document.createElement('div');
      d.className = `wheel-item ${it ? '' : 'empty'}`;
      d.style.left = `${50 + Math.cos(a) * 40}%`;
      d.style.top = `${50 + Math.sin(a) * 40}%`;
      const label = it ? (type === 'chat' ? it : (CATALOG.emote.find((x) => x.id === it) || {}).name || it) : 'Empty';
      d.innerHTML = `<kbd>${i + 1}</kbd>${esc(label)}`;
      d.addEventListener('click', (e) => { e.stopPropagation(); this.pickWheel(i); });
      el.appendChild(d);
    });
    el.classList.add('show');
    this.app.onWheel(true);
  }

  closeWheel() {
    this.wheelType = null;
    $('wheel').classList.remove('show');
    this.app.onWheel(false);
  }

  pickWheel(i) {
    const type = this.wheelType;
    this.closeWheel();
    if (type === 'chat') this.app.sendChat(i);
    else if (type === 'emote') { const em = Save.p.eq.emotes[i]; if (em) this.app.sendEmote(em); }
  }

  // -------------------------------------------------------------- results
  showResults(r) {
    const t = $('resTitle');
    t.textContent = r.outcome === 'win' ? 'VICTORY!' : r.outcome === 'lose' ? 'DEFEAT' : 'DRAW';
    t.className = `res-title ${r.outcome === 'lose' ? 'lose' : r.outcome === 'draw' ? 'draw' : ''}`;
    $('resScore').innerHTML = `<span style="color:var(--red)">${r.score[0]}</span> – <span style="color:var(--blue)">${r.score[1]}</span>`;
    $('resMvp').textContent = r.mvp ? `⭐ MVP: ${r.mvp}` : '';
    const st = r.stats || {};
    $('resStats').innerHTML = `<div><b>${st.goals || 0}</b>Goals</div><div><b>${st.assists || 0}</b>Assists</div><div><b>${st.saves || 0}</b>Saves</div><div><b>${st.steals || 0}</b>Steals</div><div><b>${st.points || 0}</b>Points</div>`;
    $('resCoins').textContent = `+${r.coins}`;
    $('resXp').textContent = `+${r.xp}`;
    $('doubleBtn').classList.toggle('hidden', !r.canDouble);
    $('doubleBtn').disabled = false;
    $('againBtn').textContent = r.online ? (r.isHost ? 'START NOW' : 'READY') : 'PLAY AGAIN';
    $('againBtn').classList.toggle('hidden', r.online && !r.isHost);
    this.setResNext('');
    this.modal('results', true);
  }
  setResNext(text) { $('resNext').textContent = text; }
  setDoubled() { $('doubleBtn').disabled = true; $('doubleBtn').textContent = 'COINS DOUBLED!'; }

  // ----------------------------------------------------------- room panel
  showRoomPanel(info) {
    const el = $('roomPanel');
    if (!info) { el.classList.remove('show'); this.cache.room = ''; return; }
    const key = JSON.stringify(info);
    if (this.cache.room === key) return;
    this.cache.room = key;
    el.innerHTML = `<div style="font-weight:700;opacity:.6">PRIVATE ROOM CODE</div><div class="room-code">${esc(info.code)}</div>
      <div class="room-players">${info.players.map((p) => `<span style="border-color:${TEAMS[p.team].css}">${esc(p.name)}</span>`).join('')}</div>
      <div class="row"><button class="btn btn-sec" id="roomInvite">COPY INVITE LINK</button>${info.isHost ? '<button class="btn btn-play" id="roomStart">START MATCH</button>' : ''}</div>
      <div style="font-size:12px;opacity:.65">${info.isHost ? 'Warm up while friends join. Empty spots are filled with bots.' : 'Waiting for the host to start…'}</div>`;
    $('roomInvite').onclick = (e) => { e.stopPropagation(); this.app.audio.click(); this.app.copyInvite(); };
    if (info.isHost) $('roomStart').onclick = (e) => { e.stopPropagation(); this.app.audio.click(); this.app.beginPrivateMatch(); };
    el.classList.add('show');
  }

  // --------------------------------------------------------------- locker
  openLocker() {
    this.screen('menu', false);
    this.screen('locker', true);
    this.app.state = 'locker';
    this.renderLocker();
  }

  closeLocker() {
    this.screen('locker', false);
    this.screen('menu', true);
    this.app.state = 'menu';
    this.app.menuEmote = null;
    Save.save();
  }

  preview(cat, id) {
    const p = Save.p;
    const key = `${cat}|${id}|${cat === 'hair' ? `${p.eq.hairColor}|${p.eq.skin}` : ''}`;
    if (!this.previewCache.has(key)) {
      let c;
      if (cat === 'jersey') c = previewJersey(id, 0);
      else if (cat === 'ball') c = previewBall(id);
      else if (cat === 'goalfx') c = previewGoalFx(id);
      else if (cat === 'emote') c = previewEmote(id);
      else c = previewHair(id, p.eq.hairColor, p.eq.skin);
      this.previewCache.set(key, c);
    }
    const src = this.previewCache.get(key);
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    c.getContext('2d').drawImage(src, 0, 0);
    return c;
  }

  renderLocker() {
    const p = Save.p;
    $('lockerCoins').textContent = p.coins;
    const tabs = ['jersey', 'ball', 'goalfx', 'emote', 'hair'];
    $('lockerTabs').innerHTML = tabs.map((t) => `<button class="tab ${t === this.lockerTab ? 'on' : ''}" data-tab="${t}">${TAB_LABELS[t]}</button>`).join('');
    $('lockerTabs').querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => { this.app.audio.click(); this.lockerTab = b.dataset.tab; this.renderLocker(); }));
    const cat = this.lockerTab;
    const extra = $('lockerExtra');
    if (cat === 'hair') {
      extra.innerHTML = `<label>Skin</label>${SKIN_TONES.map((c, i) => `<div class="swatch ${p.eq.skin === i ? 'on' : ''}" data-skin="${i}" style="background:${c}"></div>`).join('')}
        <label style="margin-left:10px">Hair</label>${HAIR_COLORS.map((c, i) => `<div class="swatch ${p.eq.hairColor === i ? 'on' : ''}" data-hc="${i}" style="background:${c}"></div>`).join('')}
        <label style="margin-left:10px">Number</label><button class="bind-reset" id="numDown">−</button><b>${p.eq.number}</b><button class="bind-reset" id="numUp">+</button>`;
      extra.querySelectorAll('[data-skin]').forEach((s) => s.addEventListener('click', () => { p.eq.skin = +s.dataset.skin; this.app.audio.click(); this.renderLocker(); this.app.onCosmeticsChanged(); }));
      extra.querySelectorAll('[data-hc]').forEach((s) => s.addEventListener('click', () => { p.eq.hairColor = +s.dataset.hc; this.app.audio.click(); this.renderLocker(); this.app.onCosmeticsChanged(); }));
      $('numDown').onclick = () => { p.eq.number = p.eq.number <= 1 ? 99 : p.eq.number - 1; this.renderLocker(); this.app.onCosmeticsChanged(); };
      $('numUp').onclick = () => { p.eq.number = p.eq.number >= 99 ? 1 : p.eq.number + 1; this.renderLocker(); this.app.onCosmeticsChanged(); };
    } else if (cat === 'emote') {
      extra.innerHTML = `<label>Emote wheel (click owned emotes to add/remove, max 8):</label><div class="emote-slots">${p.eq.emotes.filter(Boolean).map((e) => `<span>${esc((CATALOG.emote.find((x) => x.id === e) || {}).name || e)}</span>`).join('')}</div>`;
    } else extra.innerHTML = '';

    const grid = $('lockerGrid');
    grid.innerHTML = '';
    for (const it of CATALOG[cat]) {
      const owned = Save.owns(cat, it.id);
      const equipped = cat === 'emote' ? p.eq.emotes.includes(it.id) : p.eq[cat] === it.id;
      const card = document.createElement('div');
      card.className = `card ${equipped ? 'eq' : ''}`;
      const pv = document.createElement('div');
      pv.className = 'pv';
      pv.appendChild(this.preview(cat, it.id));
      card.appendChild(pv);
      const nm = document.createElement('div');
      nm.className = 'nm';
      nm.textContent = it.name;
      card.appendChild(nm);
      const pr = document.createElement('div');
      if (owned) { pr.className = `pr ${equipped ? 'eqd' : 'own'}`; pr.textContent = equipped ? (cat === 'emote' ? 'ON WHEEL' : 'EQUIPPED') : (cat === 'emote' ? 'ADD' : 'EQUIP'); }
      else { pr.className = `pr ${p.coins >= it.price ? '' : 'cant'}`; pr.innerHTML = `<span class="coin"></span>${it.price}`; }
      card.appendChild(pr);
      card.addEventListener('click', () => this.app.lockerClick(cat, it.id));
      card.addEventListener('mouseenter', () => { if (cat === 'emote') this.app.menuEmote = it.id; });
      grid.appendChild(card);
    }
  }

  // ------------------------------------------------------------- settings
  openSettings() {
    this.modal('settings', true);
    this.renderSettings();
  }

  renderSettings() {
    const s = Save.p.settings;
    const app = this.app;
    const body = $('settingsBody');
    const toggle = (key, name, desc) => `<div class="set-row"><div class="lbl"><b>${name}</b><span>${desc}</span></div><button class="toggle ${s[key] ? 'on' : ''}" data-tog="${key}"></button></div>`;
    const slider = (key, name, desc, min, max, step) => `<div class="set-row"><div class="lbl"><b>${name}</b><span>${desc}</span></div><input class="slider" type="range" min="${min}" max="${max}" step="${step}" value="${s[key]}" data-sl="${key}"/></div>`;
    const binds = Save.binds;
    const used = new Map();
    for (const [a, codes] of Object.entries(binds)) for (const c of codes) { if (!used.has(c)) used.set(c, []); used.get(c).push(a); }
    const bindRow = (a) => {
      const codes = binds[a] || [];
      const conflict = codes.some((c) => used.get(c).length > 1);
      const custom = Save.p.binds[a] !== undefined;
      return `<div class="set-row"><div class="lbl"><b>${BIND_LABELS[a]}</b><span class="${conflict ? 'warn' : custom ? 'cust' : ''}">${conflict ? 'Conflicting keybinds' : custom ? 'Custom keybinds' : 'Default keybinds'}</span></div>
        <div class="binds">${custom ? `<button class="bind-reset" data-reset="${a}">↺</button>` : ''}${codes.map((c, i) => `<button class="bind" data-bind="${a}" data-i="${i}">${esc(app.input.label(c))}</button>`).join('')}${codes.length < 2 ? `<button class="bind-reset" data-bind="${a}" data-i="${codes.length}">+</button>` : ''}</div></div>`;
    };
    body.innerHTML = `
      <div class="set-sec">Audio</div>
      ${slider('master', 'Master Volume', 'Overall game volume', 0, 1, 0.05)}
      ${slider('music', 'Music', 'Menu music volume', 0, 1, 0.05)}
      ${slider('sfx', 'Sound Effects', 'Kicks, whistles & crowd', 0, 1, 0.05)}
      <div class="set-sec">Effects</div>
      <div class="set-row"><div class="lbl"><b>Screen Shake</b><span>Adjust camera shake intensity</span></div><div class="segbar">${[1, 2, 3, 4, 5, 6, 7, 8].map((i) => `<i class="${i <= s.shake ? 'on' : ''}" data-shake="${i}"></i>`).join('')}</div></div>
      ${toggle('perf', 'Performance Mode', 'Simpler graphics for smoother play')}
      <div class="set-sec">Camera</div>
      ${slider('sens', 'Mouse Sensitivity', 'Camera turn speed', 0.2, 2.5, 0.05)}
      ${toggle('invertY', 'Invert Y', 'Flip vertical camera movement')}
      <div class="set-sec">Gameplay</div>
      ${toggle('assistedPasses', 'Assisted Passes', 'Passes auto-target the best teammate')}
      ${toggle('autoCurve', 'Auto Curve', 'Strafe while shooting to bend the ball')}
      <div class="set-sec">Interface</div>
      ${toggle('showControls', 'Show Controls', 'Display the key and button prompts')}
      ${toggle('showHints', 'Show Hints', 'Display tips on how to play')}
      ${toggle('nameTags', 'Show Name Tags', 'Names above other players')}
      ${toggle('showStats', 'Show Stats', 'Display framerate and ping')}
      <div class="set-sec">Gameplay Keybinds</div>
      ${['kick', 'pass', 'flick', 'tackle', 'lob', 'request', 'dribble', 'sprint', 'item1', 'item2'].map(bindRow).join('')}
      <div class="set-sec">Movement & UI Keybinds</div>
      ${['forward', 'back', 'left', 'right', 'stats', 'lobby', 'chat', 'emote'].map(bindRow).join('')}
      <div class="set-row"><div class="lbl"><b>Reset all keybinds</b><span>Restore the default controls</span></div><button class="bind-reset" id="resetBinds">Reset</button></div>
      <div class="set-sec" style="text-align:center">Crazy Soccer v${app.version}</div>`;
    body.querySelectorAll('[data-tog]').forEach((b) => b.addEventListener('click', () => { const k = b.dataset.tog; s[k] = !s[k]; app.audio.click(); this.renderSettings(); app.applySettings(); }));
    body.querySelectorAll('[data-sl]').forEach((el) => el.addEventListener('input', () => { s[el.dataset.sl] = parseFloat(el.value); app.applySettings(); }));
    body.querySelectorAll('[data-shake]').forEach((el) => el.addEventListener('click', () => { s.shake = +el.dataset.shake; app.audio.click(); this.renderSettings(); app.applySettings(); }));
    body.querySelectorAll('[data-reset]').forEach((el) => el.addEventListener('click', () => { delete Save.p.binds[el.dataset.reset]; app.onBindsChanged(); this.renderSettings(); }));
    $('resetBinds').addEventListener('click', () => { Save.p.binds = {}; app.onBindsChanged(); this.renderSettings(); });
    body.querySelectorAll('[data-bind]').forEach((el) => el.addEventListener('click', (e) => {
      e.stopPropagation();
      const a = el.dataset.bind, i = +el.dataset.i;
      el.classList.add('wait');
      el.textContent = 'Press…';
      app.input.captureNext((code) => {
        if (code) {
          const cur = [...(Save.binds[a] || DEFAULT_BINDS[a] || [])];
          cur[i] = code;
          Save.p.binds[a] = cur.filter(Boolean).slice(0, 2);
          app.onBindsChanged();
        }
        this.renderSettings();
      });
    }));
  }

  // --------------------------------------------------------------- touch
  setupTouch(input) {
    const touch = $('touch');
    touch.classList.add('show');
    const stick = $('stick'), knob = $('stickKnob');
    let stickId = null, cx = 0, cy = 0, R = 1;
    const setKnob = (dx, dy) => { knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`; };
    stick.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      stickId = t.identifier;
      const r = stick.getBoundingClientRect();
      cx = r.left + r.width / 2; cy = r.top + r.height / 2; R = r.width / 2;
      this.app.audio.unlock();
    }, { passive: false });
    const moveStick = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== stickId) continue;
        let dx = t.clientX - cx, dy = t.clientY - cy;
        const d = Math.hypot(dx, dy);
        if (d > R) { dx *= R / d; dy *= R / d; }
        setKnob(dx, dy);
        input.touch.mx = dx / R; input.touch.mz = -dy / R;
        input.touch.active = true;
        input.touch.sprint = d > R * 0.95;
      }
    };
    const endStick = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== stickId) continue;
        stickId = null;
        setKnob(0, 0);
        input.touch.mx = 0; input.touch.mz = 0; input.touch.active = false; input.touch.sprint = false;
      }
    };
    window.addEventListener('touchmove', moveStick, { passive: true });
    window.addEventListener('touchend', endStick);
    window.addEventListener('touchcancel', endStick);
    // Look zone
    const look = $('lookZone');
    let lookId = null, lx = 0, ly = 0;
    look.addEventListener('touchstart', (e) => { const t = e.changedTouches[0]; lookId = t.identifier; lx = t.clientX; ly = t.clientY; }, { passive: true });
    window.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== lookId) continue;
        input.mdx += (t.clientX - lx) * 1.6; input.mdy += (t.clientY - ly) * 1.6;
        lx = t.clientX; ly = t.clientY;
      }
    }, { passive: true });
    window.addEventListener('touchend', (e) => { for (const t of e.changedTouches) if (t.identifier === lookId) lookId = null; });
    // Buttons
    touch.querySelectorAll('.tb').forEach((b) => {
      const act = b.dataset.act;
      b.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (act === 'sprint') { input.touch.sprintToggle = !input.touch.sprintToggle; b.classList.toggle('on', input.touch.sprintToggle); return; }
        b.classList.add('on');
        input.virtualDown(`Touch_${act}`);
      }, { passive: false });
      const up = (e) => { e.preventDefault(); if (act === 'sprint') return; b.classList.remove('on'); input.virtualUp(`Touch_${act}`); };
      b.addEventListener('touchend', up, { passive: false });
      b.addEventListener('touchcancel', up, { passive: false });
    });
  }

  touchVisible(on) { $('touch').classList.toggle('show', !!on && this.isTouch); }
  setTackleLabel(dive) { const b = document.querySelector('.tb-tackle'); if (b) b.textContent = dive ? 'DIVE' : 'TACKLE'; }
}
