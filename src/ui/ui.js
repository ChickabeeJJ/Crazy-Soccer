// DOM UI: main menu (play / training / shop / inventory), HUD, settings, wheels, results, touch controls.
import { Save, BIND_LABELS, DEFAULT_BINDS } from '../save.js';
import { CATALOG, TAB_LABELS, SKIN_TONES, HAIR_COLORS } from '../cosmetics.js';
import { TEAMS, QUICK_CHAT, ITEMS, ITEM_KINDS, PLAYER, RARITY, RARITY_ORDER, ROLL } from '../config.js';
import { fmtTime, clamp } from '../util/math.js';
import { itemSvg, previewJersey, previewBall, previewGoalFx, previewEmote, previewHair } from './icons.js';
import { SDK } from '../sdk.js';
import { PreviewStudio } from '../render/preview.js';
import { Prog, PASS, CALENDAR, fmtLeft } from '../progression.js';

const $ = (id) => document.getElementById(id);
const MEDALS = { shoot: [300, 700, 1200], keeper: [4, 7, 10] }; // bronze / silver / gold
const TOKEN_SVG = '<svg viewBox="0 0 24 24"><path d="M12 2l9 5v10l-9 5-9-5V7z" fill="#8a5cf6"/><path d="M12 2l9 5-9 5-9-5z" fill="#b69cff"/><path d="M10 9.5a2.2 2 0 1 1 3 1.8c-.8.4-1 .8-1 1.6M12 15.4v.2" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/></svg>';
const LOCK_SVG = '<svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="11" fill="currentColor"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2.6"/></svg>';
// Coin stack for big reward art: three ridged gold coins, the top one showing the star emblem
const COINS_SVG = (() => {
  const coin = (cx, y, tilt = 0) => {
    const rx = 19, ry = 7.2, h = 5.2;
    let ridges = '';
    for (let i = -8; i <= 8; i++) { const x = cx + (i / 8.6) * rx; ridges += `<path d="M${x.toFixed(1)} ${(y + ry * Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2))).toFixed(1)}v${h}" stroke="#b8730a" stroke-width="0.9" opacity="0.55"/>`; }
    return `<g transform="rotate(${tilt} ${cx} ${y})"><path d="M${cx - rx} ${y}v${h}a${rx} ${ry} 0 0 0 ${rx * 2} 0v-${h}z" fill="#d48a10"/>${ridges}<ellipse cx="${cx}" cy="${y}" rx="${rx}" ry="${ry}" fill="#ffc22e"/><ellipse cx="${cx}" cy="${y}" rx="${rx - 3.2}" ry="${ry - 1.3}" fill="#f0a91c"/><ellipse cx="${cx}" cy="${y + 0.3}" rx="${rx - 4.4}" ry="${ry - 1.9}" fill="#ffd257"/></g>`;
  };
  const star = (cx, cy) => { let d = ''; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 2.6 : 6; d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * r * 1.35).toFixed(2)} ${(cy + Math.sin(a) * r * 0.48).toFixed(2)}`; } return `<path d="${d}Z" fill="#e39b14"/>`; };
  const spark = (x, y, r) => `<path d="M${x} ${y - r}L${x + r * 0.28} ${y - r * 0.28}L${x + r} ${y}L${x + r * 0.28} ${y + r * 0.28}L${x} ${y + r}L${x - r * 0.28} ${y + r * 0.28}L${x - r} ${y}L${x - r * 0.28} ${y - r * 0.28}Z" fill="#fff6c8"/>`;
  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><ellipse cx="32" cy="55" rx="23" ry="5" fill="#000" opacity="0.18"/>${coin(30, 44)}${coin(33, 36.5, -2)}${coin(31, 29)}${star(31, 29.2)}<path d="M17 26.5a17 5.6 0 0 1 14-3.2" stroke="#fff6c8" stroke-width="1.6" fill="none" stroke-linecap="round" opacity="0.85"/>${spark(51, 18, 4.2)}${spark(12, 34, 2.6)}${spark(46, 9, 2)}</svg>`;
})();
const CHEST_SVG = '<svg viewBox="0 0 24 24"><path d="M3 10h18v10H3z" fill="#b8742a"/><path d="M3 10c0-4 4-6 9-6s9 2 9 6z" fill="#d89a3a"/><path d="M3 10h18v2H3z" fill="#ffcf3f"/><path d="M10 11h4v4h-4z" fill="#ffcf3f"/></svg>';
const TIPS = [
  'Walk into your own box when your team has no keeper to grab the gloves.',
  'Keepers lose their gloves the moment they step out of the box.',
  'Aim higher with the crosshair to lift your shot over the keeper.',
  'Jump (Space) to catch high balls, then shoot mid-air for a volley bonus.',
  'Goalkeepers can\'t be tackled and the ball can\'t be stolen from them.',
  'Everyone gets a random position after every goal. Be ready to play anywhere!',
  'Unlock new powers in the Shop: mystery cubes only drop powers you own.',
  'Dribble skill (Space with the ball) makes you untouchable for a moment.',
  'Hold the kick button longer for a harder shot.',
  'Request the ball (R) and your teammates will pass to you.',
];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export class UI {
  constructor(app) {
    this.app = app;
    this.cache = {};
    this.page = 'play';
    this.shopTab = 'roll';
    this.invTab = 'powers';
    this.tipI = Math.floor(Math.random() * TIPS.length);
    this.wheelType = null;
    this.wheelSel = -1;
    this.isTouch = false; // decided after SDK init (see setupTouch)
    this.bindButtons();
    this.previewCache = new Map();
  }

  // ---------------------------------------------------------------- screens
  screen(id, on) { $(id).classList.toggle('show', !!on); }
  modal(id, on) {
    $(id).classList.toggle('show', !!on);
    if (id === 'results' && !on) this.showBanner(false);
  }

  // CrazyGames banner under the results screen (between matches only, never during play)
  showBanner(on) {
    const el = $('resBanner');
    if (!el) return;
    const fits = window.innerHeight >= 600 && window.innerWidth >= 760;
    if (on && SDK.available && fits) {
      el.classList.add('show');
      SDK.requestResponsiveBanner('resBanner').then((ok) => { if (!ok) el.classList.remove('show'); });
    } else if (el.classList.contains('show')) {
      el.classList.remove('show');
      SDK.clearAllBanners();
    }
  }
  isOpen(id) { return $(id).classList.contains('show'); }
  anyModal() { return ['pause', 'results', 'settings', 'private', 'searching', 'confirm', 'trainRes', 'playSheet', 'rollReveal', 'releaseEvent'].some((m) => this.isOpen(m)); }

  setLoading() { /* no visible loading screen */ }

  bindButtons() {
    const app = this.app;
    const click = (id, fn) => $(id).addEventListener('click', (e) => { e.stopPropagation(); app.audio.click(); fn(e); });
    click('playBtn', () => this.openPlaySheet());
    // Clicking a team puts you straight into a match on that team
    document.querySelectorAll('.ps-team').forEach((b) => {
      b.addEventListener('click', (e) => { e.stopPropagation(); app.audio.click(); this.modal('playSheet', false); app.quickPlay(+b.dataset.team); });
      b.addEventListener('mouseenter', () => { app.menuTeam = +b.dataset.team; });
    });
    click('botsBtn', () => { this.modal('playSheet', false); app.startOffline(null, Save.p.team === 1 ? 1 : 0); });
    click('privateBtn', () => { this.modal('playSheet', false); $('privateMsg').textContent = ''; this.modal('private', true); });
    click('switchTeamBtn', () => app.switchTeam());
    click('rrDoneBtn', () => { this.modal('rollReveal', false); if (this.page === 'shop') this.renderShop(); if (this.page === 'inventory') this.renderInventory(); this.refreshProfile(); app.maybeShowReleaseEvent(); });
    click('rrAgainBtn', () => app.rollItems(this.lastRollN || 1));
    click('rrSkipBtn', () => this.skipRoll());
    click('tutSkipBtn', () => app.askLeave());
    click('rrStartBtn', () => app.starterRoll());
    click('releaseEventOk', () => this.modal('releaseEvent', false));
    click('createRoomBtn', () => app.createPrivate());
    click('joinCodeBtn', () => app.joinPrivate($('codeInput').value.trim().toUpperCase()));
    $('codeInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') app.joinPrivate($('codeInput').value.trim().toUpperCase()); });
    click('settingsBtn', () => this.openSettings());
    click('pauseSettingsBtn', () => this.openSettings());
    click('pauseControlsBtn', () => { this.openSettings(); setTimeout(() => { const el = document.querySelector('[data-sec="keys"]'); if (el) el.scrollIntoView(); }, 30); });
    click('dailyBtn', () => app.claimDaily());
    click('loginBtn', () => app.login());
    click('seasonChip', () => this.setPage('pass'));
    click('tgMatch', () => app.startOffline(null, Save.p.team === 1 ? 1 : 0));
    click('passClaimAll', () => app.claimAllPass());
    click('resumeBtn', () => app.resume());
    click('leaveBtn', () => app.leaveToLobby(true));
    click('inviteBtn2', () => app.copyInvite());
    click('againBtn', () => app.playAgain());
    click('resLobbyBtn', () => app.leaveToLobby(false));
    click('doubleBtn', () => app.doubleCoins());
    click('resLoginBtn', () => app.login());
    click('cancelSearchBtn', () => app.cancelSearch());
    click('trAgainBtn', () => app.retryTraining());
    click('trLobbyBtn', () => { this.modal('trainRes', false); app.leaveToLobby(true, 'training'); });
    click('menuHudBtn', () => app.pause());
    click('chatHudBtn', () => this.toggleWheel('chat'));
    click('emoteHudBtn', () => this.toggleWheel('emote'));
    click('statsKey', () => { this.statsPinned = !this.statsPinned; });
    click('lobbyKey', () => app.askLeave());
    click('unlockKey', () => app.input.exitLock());
    document.querySelectorAll('#mnNav [data-page]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); app.audio.click(); this.setPage(b.dataset.page); }));
    document.querySelectorAll('[data-train]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); app.audio.click(); app.startTraining(b.dataset.train); }));
    document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      app.audio.click();
      const id = b.dataset.close;
      this.modal(id, false);
      if (id === 'settings') app.onSettingsClosed();
    }));
    for (const s of [0, 1]) {
      $(`slot${s}`).addEventListener('click', (e) => { e.stopPropagation(); app.slotTap(s); });
      $(`slot${s}`).addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); app.slotTap(s, true); }, { passive: false });
    }
    document.querySelectorAll('button').forEach((b) => b.addEventListener('mouseenter', () => app.audio.hover()));
    window.addEventListener('resize', () => this.moveNavBar());
  }

  // ------------------------------------------------------------ menu pages
  setPage(page) {
    this.page = page;
    document.querySelectorAll('#mnNav [data-page]').forEach((b) => b.classList.toggle('on', b.dataset.page === page));
    document.querySelectorAll('.mn-page').forEach((el) => el.classList.toggle('show', el.id === `pg-${page}`));
    $('menu').dataset.page = page;
    this.moveNavBar();
    if (page === 'shop') this.renderShop();
    if (page === 'inventory') this.renderInventory();
    if (page === 'training') this.renderTraining();
    if (page === 'play') this.renderPlayPage();
    if (page === 'pass') this.renderPass();
    this.app.menuEmote = null;
  }

  moveNavBar() {
    const on = document.querySelector('#mnNav [data-page].on');
    const bar = $('mnNavBar');
    if (!on || !bar) return;
    bar.style.width = `${on.offsetWidth - 16}px`;
    bar.style.transform = `translateX(${on.offsetLeft + 8}px)`;
  }

  // Play sheet: choose a side (or ANY), then a mode
  openPlaySheet() { this.modal('playSheet', true); }

  // Small reward icon (coins, free roll, season XP, chest or an exclusive cosmetic preview)
  rewardIcon(r) {
    if (!r) return '';
    if (r.kind === 'coins') return '<span class="rw-ico"><span class="coin"></span></span>';
    if (r.kind === 'token') return `<span class="rw-ico tok">${TOKEN_SVG}</span>`;
    if (r.kind === 'sp') return '<span class="rw-ico sp">XP</span>';
    if (r.kind === 'chest') return `<span class="rw-ico chest">${CHEST_SVG}</span>`;
    if (r.kind === 'bundle') {
      const item = (r.rewards || []).find((part) => part.kind === 'item');
      return item ? `<span class="rw-ico pvh" data-pv="${item.cat}|${item.id}"></span>` : `<span class="rw-ico chest">${CHEST_SVG}</span>`;
    }
    if (r.kind === 'item') return `<span class="rw-ico pvh" data-pv="${r.cat}|${r.id}"></span>`;
    return '';
  }
  fillPreviews(root) {
    root.querySelectorAll('[data-pv]').forEach((el) => { const [cat, id] = el.dataset.pv.split('|'); try { el.appendChild(this.preview(cat, id)); } catch (e) { /* ignore */ } });
  }
  rewardShort(r) {
    if (r.kind === 'coins' || r.kind === 'chest') return String(r.n);
    if (r.kind === 'token') return r.n > 1 ? `×${r.n}` : 'ROLL';
    if (r.kind === 'sp') return String(r.n);
    if (r.kind === 'bundle') {
      const coins = (r.rewards || []).find((part) => part.kind === 'coins');
      const rolls = (r.rewards || []).find((part) => part.kind === 'token');
      const item = (r.rewards || []).find((part) => part.kind === 'item');
      if (item) return 'EXCLUSIVE';
      if (coins && coins.n >= 1000000) return '1M';
      if (coins && coins.n >= 1000) return `${Math.round(coins.n / 1000)}K`;
      if (rolls) return `${rolls.n} ROLLS`;
    }
    return 'EXCL';
  }

  renderPlayPage() {
    const g = Prog.s;
    // Season chip above the play button
    const si = Prog.seasonInfo();
    $('scTag').textContent = `SEASON ${si.n}`;
    $('scName').textContent = si.name;
    $('scTier').textContent = Prog.tier();
    $('scBar').style.width = `${Prog.tierProgress() * 100}%`;
    $('scEnds').textContent = `ENDS IN ${fmtLeft(si.ends - Date.now())}`;
    // Compact release rewards: one value, optional rolls, and concise status per day.
    const contract = Prog.returnContractState();
    const contractEl = $('returnContract');
    const contractDays = contract.days.map((m) => {
      const parts = m.reward.rewards || [];
      const item = parts.find((part) => part.kind === 'item');
      const coins = parts.find((part) => part.kind === 'coins');
      const rolls = parts.find((part) => part.kind === 'token');
      const value = coins ? (coins.n >= 1000000 ? `${coins.n / 1000000}M` : `${coins.n / 1000}K`) : 'EXCLUSIVE';
      const detail = [rolls ? `+${rolls.n} ROLLS` : null, item ? 'EXCLUSIVE' : !rolls && !item ? 'COINS' : null].filter(Boolean).join(' · ');
      const stateLabel = m.claimed ? 'DONE' : m.expired ? 'MISSED' : m.current ? (contract.canClaim ? 'READY' : `${contract.minutesPlayed}/10 MIN`) : 'LOCKED';
      const preview = item ? this.rewardIcon(item) : '<span class="rc-generic-icon">✦</span>';
      return `<div class="rc-day ${m.current ? 'current' : ''} ${m.claimed ? 'claimed' : ''} ${m.expired ? 'expired' : ''} ${item ? 'exclusive' : ''}">
        <small>DAY ${m.day}</small><span class="rc-art">${preview}</span>
        <b class="rc-value">${value}</b><span class="rc-detail">${detail}</span><em>${stateLabel}</em>
      </div>`;
    }).join('');
    const contractHeading = contract.complete ? 'COMPLETE' : contract.active ? `DAY ${contract.day}/7` : 'ENDED';
    contractEl.innerHTML = `<div class="mc-head rc-head"><span>RELEASE EVENT</span><em>${contractHeading}</em></div>
      <p class="rc-sub">Play 10 min today to unlock the drop.</p>
      <div class="rc-days">${contractDays}</div>
      <div class="rc-progress"><div class="rc-progress-head"><span>PLAYTIME TODAY</span><b>${contract.minutesPlayed}/10 MIN</b></div><span class="rc-progress-track"><i style="width:${contract.minutesPlayed * 10}%"></i></span></div>
      <button id="returnClaimBtn" class="btn btn-play mc-btn rc-claim" ${contract.canClaim ? '' : 'disabled'}>${contract.canClaim ? `CLAIM DAY ${contract.day}` : contract.ready ? 'PLAY 10 MIN TO CLAIM' : contract.complete ? 'ALL REWARDS CLAIMED' : contract.active ? 'CLAIMED TODAY' : 'EVENT ENDED'}</button>`;
    const returnClaimBtn = $('returnClaimBtn');
    if (returnClaimBtn) returnClaimBtn.onclick = (e) => { e.stopPropagation(); this.app.claimReturnContract(contract.day); };
    this.fillPreviews(contractEl);
    // Limited-time event
    const ev = Prog.event();
    const evEl = $('evCard');
    if (ev) {
      const done = g.ev.prog >= ev.goal.n;
      const rw = { kind: 'item', cat: ev.reward[0], id: ev.reward[1] };
      evEl.innerHTML = `<div class="mc-head ev-head"><span><i class="live-dot"></i>LIMITED EVENT</span><em>${fmtLeft(ev.end - Date.now())} LEFT</em></div>
        <div class="ev-body"><div class="ev-txt"><b>${ev.name}</b><small>${ev.desc}</small>
        <div class="ev-goal"><span>${ev.goal.label}</span><span class="ev-bar"><i style="width:${(g.ev.prog / ev.goal.n) * 100}%"></i></span><em>${g.ev.prog}/${ev.goal.n}</em></div></div>
        <div class="ev-rw">${this.rewardIcon(rw)}<small>EXCLUSIVE</small></div></div>
        ${g.ev.claimed ? '<div class="ev-claimed">REWARD CLAIMED</div>' : done ? '<button id="evClaim" class="btn btn-gold mc-btn">CLAIM EXCLUSIVE</button>' : ''}`;
      const cb = $('evClaim');
      if (cb) cb.onclick = (e) => { e.stopPropagation(); this.app.claimEvent(); };
    } else {
      const nx = Prog.nextEvent();
      evEl.innerHTML = `<div class="mc-head"><span>NEXT EVENT</span><em>IN ${fmtLeft(nx.start - Date.now())}</em></div><div class="ev-body"><div class="ev-txt"><b>${nx.name}</b><small>${nx.desc}</small></div></div>`;
    }
    this.fillPreviews(evEl);
    // Login calendar (7 days, cycles)
    const cs = Prog.calendarState();
    let html = '';
    for (let d = 1; d <= 7; d++) {
      const done = cs.avail ? d < cs.next : d <= cs.cur;
      const cur = cs.avail && d === cs.next;
      const r = CALENDAR[d - 1];
      html += `<div class="dd ${done ? 'done' : ''} ${cur ? 'cur' : ''} ${d === 7 ? 'big' : ''}">${this.rewardIcon(r)}<b>${this.rewardShort(r)}</b><small>DAY ${d}</small></div>`;
    }
    $('dailyDays').innerHTML = html;
    $('dailyStreak').textContent = `DAY ${Math.max(1, cs.avail ? cs.next : cs.cur)}`;
    const btn = $('dailyBtn');
    btn.disabled = !cs.avail;
    btn.textContent = cs.avail ? `CLAIM DAY ${cs.next}: ${Prog.label(CALENDAR[cs.next - 1])}` : 'COME BACK TOMORROW';
    // Daily challenges
    const tomorrow = new Date(); tomorrow.setHours(24, 0, 0, 0);
    $('chalReset').textContent = `RESETS ${fmtLeft(tomorrow - Date.now())}`;
    $('chalList').innerHTML = Prog.challenges().map((c) => `<div class="ch ${c.done ? 'done' : ''} ${c.claimed ? 'claimed' : ''}">
        <div class="ch-txt"><b>${c.label}</b><span class="ch-bar"><i style="width:${(c.prog / c.target) * 100}%"></i></span></div>
        ${c.claimed ? '<span class="ch-ok">DONE</span>' : c.done ? `<button class="ch-claim" data-chal="${c.id}">+${c.sp} XP</button>` : `<span class="ch-n">${c.prog}/${c.target}</span>`}
      </div>`).join('');
    $('chalList').querySelectorAll('[data-chal]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); this.app.claimChallenge(b.dataset.chal); }));
    // Daily Match Circuit: repeatable, transparent milestones. Losses count too.
    const circuit = Prog.matchCircuitState();
    const divider = `<div class="mc-divider">MATCH CIRCUIT · ${circuit.count}/${circuit.target} TODAY</div>`;
    const circuitRows = circuit.milestones.map((m) => {
      const progress = Math.min(100, (circuit.count / m.matches) * 100);
      const status = m.claimed ? '<span class="ch-ok">CLAIMED</span>'
        : m.ready ? `<button class="ch-claim" data-run="${m.i}">CLAIM</button>`
        : `<span class="ch-n">${Math.min(circuit.count, m.matches)}/${m.matches}</span>`;
      return `<div class="ch ${m.ready ? 'done' : ''} ${m.claimed ? 'claimed' : ''}">
        <div class="ch-txt"><b>${m.matches} MATCH${m.matches === 1 ? '' : 'ES'}</b><span class="ch-bar"><i style="width:${progress}%"></i></span><small class="ch-reward">${Prog.label(m.reward)}</small></div>${status}</div>`;
    }).join('');
    $('chalList').insertAdjacentHTML('beforeend', divider + circuitRows);
    $('chalList').querySelectorAll('[data-run]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); this.app.claimMatchCircuit(+b.dataset.run); }));
    // Playtime rewards
    const pt = Prog.playtimeState();
    const mins = pt[0].mins;
    $('ptMins').textContent = `${Math.floor(mins)} MIN TODAY`;
    $('ptTrack').innerHTML = pt.map((m) => `<button class="pt ${m.ready ? 'ready' : ''} ${m.claimed ? 'claimed' : ''}" data-pt="${m.i}" ${m.ready ? '' : 'disabled'}>${this.rewardIcon(m)}<b>${this.rewardShort(m)}</b><small>${m.claimed ? 'CLAIMED' : `${m.min} MIN`}</small><i style="width:${clamp(mins / m.min, 0, 1) * 100}%"></i></button>`).join('');
    $('ptTrack').querySelectorAll('[data-pt]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); this.app.claimPlaytime(+b.dataset.pt); }));
    // News ticker along the bottom of the lobby
    const nx = Prog.nextEvent();
    const news = [`SEASON ${si.n}: ${si.name}`, ev ? `${ev.name} LIVE NOW: ${ev.desc.toUpperCase()}` : `NEXT EVENT: ${nx.name} IN ${fmtLeft(nx.start - Date.now())}`,
      'NEW ITEMS: TITAN / BLINK / TIME WARP / SHOCKWAVE / BANANA PEEL', `ELITE PASS EXCLUSIVES: ${Prog.label(Prog.reward(1, 'e'))} / ${Prog.label(Prog.reward(20, 'e'))}`, 'DAILY CHALLENGES RESET AT MIDNIGHT', 'NO REFEREE. NO RULES. JUST GOALS.'];
    const line = news.map((n) => `<span>${n}</span><i></i>`).join('');
    $('tickerTrack').innerHTML = line + line;
    this.refreshBadges();
  }

  refreshBadges() {
    const pd = Prog.pending();
    $('badgePass').classList.toggle('hidden', !pd.pass);
  }

  // Season Pass: season block + selected reward info on the left, a big showcase of the selected
  // reward, and a strip of tiers (free + elite reward per tier) that scrolls with the wheel or a drag.
  renderPass() {
    const g = Prog.s;
    const si = Prog.seasonInfo();
    const tier = Prog.tier();
    $('passNo').textContent = `SEASON ${si.n}`;
    $('passName').textContent = si.name;
    $('passEnds').textContent = `Ends in ${fmtLeft(si.ends - Date.now()).toLowerCase()}`;
    $('passTier').textContent = tier;
    $('passBar').style.width = `${Prog.tierProgress() * 100}%`;
    $('passSp').textContent = tier >= PASS.tiers ? 'SEASON PASS COMPLETE' : `${g.sp % PASS.spPerTier} / ${PASS.spPerTier} XP TO TIER ${tier + 1}`;
    $('passClaimAll').disabled = !Prog.pending().pass;
    // default selection: the next exclusive still ahead of you
    if (!this.bpSel) {
      let pick = null;
      for (let t = tier + 1; t <= PASS.tiers && !pick; t++) for (const tr of ['e', 'f']) if (!pick && Prog.reward(t, tr).kind === 'item') pick = { t, tr };
      this.bpSel = pick || { t: Math.max(1, Math.min(PASS.tiers, tier + 1)), tr: 'f' };
    }
    const RAR = (r) => (r.kind === 'item' ? 'legend' : r.kind === 'chest' ? 'epic' : r.kind === 'token' ? 'rare' : r.kind === 'sp' ? 'uncommon' : 'common');
    const RNAME = { legend: 'EXCLUSIVE', epic: 'EPIC', rare: 'RARE', uncommon: 'UNCOMMON', common: 'COMMON' };
    let html = '';
    for (let t = 1; t <= PASS.tiers; t++) {
      const card = (tr) => {
        const r = Prog.reward(t, tr);
        const claimed = g.claimed[tr].includes(t);
        const can = Prog.canClaim(t, tr);
        const eliteLocked = tr === 'e' && !g.elite;
        const sel = this.bpSel.t === t && this.bpSel.tr === tr;
        return `<button class="bpc ${tr} r-${RAR(r)} ${claimed ? 'claimed' : ''} ${can ? 'ready' : ''} ${t > tier ? 'ahead' : ''} ${sel ? 'sel' : ''}" data-tier="${t}" data-track="${tr}">
          <span class="bpc-art">${this.rewardIcon(r)}</span>
          ${r.kind !== 'item' ? `<span class="bpc-n">${this.rewardShort(r)}</span>` : ''}
          ${eliteLocked ? `<i class="bpc-lock">${LOCK_SVG}</i>` : ''}${claimed ? '<i class="bpc-ok"></i>' : ''}${can ? '<i class="bpc-claim">CLAIM</i>' : ''}
          <i class="bpc-bar"></i></button>`;
      };
      html += `<div class="bpt ${t <= tier ? 'reached' : ''} ${t === tier + 1 ? 'next' : ''}"><div class="bpt-cards">${card('f')}${card('e')}</div><span class="bpt-lab">TIER ${t}</span></div>`;
    }
    const tr = $('passTrack');
    const sl = tr.scrollLeft;
    tr.innerHTML = html;
    this.fillPreviews(tr);
    tr.querySelectorAll('[data-tier]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.bpDragged) return;
      const t = +b.dataset.tier, k = b.dataset.track;
      this.app.audio.click();
      if (Prog.canClaim(t, k)) { this.bpSel = { t, tr: k }; this.app.claimTier(t, k); return; }
      this.bpSel = { t, tr: k };
      this.renderPass();
    }));
    if (!this.bpInit) {
      this.bpInit = true;
      // mouse wheel scrolls sideways; click-and-drag pans the strip
      tr.addEventListener('wheel', (e) => { e.preventDefault(); tr.scrollLeft += (Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX) * 1.2; }, { passive: false });
      let down = null;
      tr.addEventListener('pointerdown', (e) => { down = { x: e.clientX, s: tr.scrollLeft, id: e.pointerId }; this.bpDragged = false; });
      window.addEventListener('pointermove', (e) => {
        if (!down) return;
        const dx = e.clientX - down.x;
        if (Math.abs(dx) > 6) { this.bpDragged = true; tr.classList.add('dragging'); }
        if (this.bpDragged) tr.scrollLeft = down.s - dx;
      });
      window.addEventListener('pointerup', () => { if (!down) return; down = null; tr.classList.remove('dragging'); setTimeout(() => { this.bpDragged = false; }, 0); });
      const col = tr.children[Math.max(0, tier - 1)];
      if (col) tr.scrollLeft = col.offsetLeft - 20;
    } else tr.scrollLeft = sl;

    // Selected reward: info panel + big showcase
    const { t: st, tr: sk } = this.bpSel;
    const r = Prog.reward(st, sk);
    const rar = RAR(r);
    const claimed = g.claimed[sk].includes(st);
    const can = Prog.canClaim(st, sk);
    const kindName = r.kind === 'item' ? ({ jersey: 'JERSEY', boots: 'BOOTS', ball: 'BALL' }[r.cat] || 'COSMETIC') : r.kind === 'token' ? 'ITEM ROLL' : r.kind === 'sp' ? 'SEASON XP' : r.kind === 'chest' ? 'CHEST' : 'COINS';
    const blurb = r.kind === 'item' ? 'Season exclusive. Never sold in the shop.' : r.kind === 'token' ? 'A free roll of the Item Roll: no coins needed.' : r.kind === 'chest' ? 'A stash of coins and free item rolls.' : r.kind === 'sp' ? 'A boost towards your next tier.' : 'Spend them in the Shop.';
    $('bpInfo').innerHTML = `<div class="bpi-name">${Prog.label(r)}</div><div class="bpi-type r-${rar}"><i></i>${kindName}<em>${RNAME[rar]}</em></div><div class="bpi-text">${blurb}</div>`;
    const status = claimed ? '<span class="bps-tag ok">CLAIMED</span>'
      : can ? '<button id="bpClaimSel" class="bps-tag claim">CLAIM NOW</button>'
      : sk === 'e' && !g.elite && st <= tier ? '<span class="bps-tag">ELITE PASS ONLY</span>'
      : `<span class="bps-tag">UNLOCKS AT <b>TIER ${st}</b>${sk === 'e' ? ' · ELITE' : ''}</span>`;
    const show = $('bpShow');
    show.className = `bp-show r-${rar}`;
    show.innerHTML = `<div class="bps-burst"></div><div class="bps-art">${r.kind === 'item' ? '<span class="bps-pv"></span>' : `<span class="bps-ico">${r.kind === 'coins' ? COINS_SVG : r.kind === 'token' ? TOKEN_SVG : r.kind === 'chest' ? CHEST_SVG : '<b class="bps-xp">XP</b>'}</span>`}</div>${status}${r.kind !== 'item' ? `<div class="bps-amt">${r.kind === 'chest' ? `${r.n} + ${r.tokens} ROLLS` : r.kind === 'token' ? `×${r.n}` : r.n}</div>` : ''}`;
    if (r.kind === 'item') { const pv = show.querySelector('.bps-pv'); try { pv.appendChild(this.bigPreview(r.cat, r.id)); } catch (e) { /* ignore */ } }
    const cb = $('bpClaimSel');
    if (cb) cb.onclick = (e) => { e.stopPropagation(); this.app.claimTier(st, sk); };
    // Elite pass card
    const el = $('bpElite');
    el.innerHTML = g.elite ? '<div class="bpe-on"><i></i>ELITE PASS ACTIVE</div>'
      : `<div class="bpe-h">ELITE PASS</div><div class="bpe-l"><span>4 SEASON EXCLUSIVES</span><span>+30 BONUS REWARDS</span><span>FREE ROLLS + A 1000 COIN CHEST</span></div><button id="bpBuy" class="bpe-buy">UNLOCK <span class="coin"></span>${PASS.eliteCost}</button>`;
    const bb = $('bpBuy');
    if (bb) bb.onclick = (e) => { e.stopPropagation(); this.app.audio.click(); this.app.buyElite(); };
    this.refreshBadges();
  }

  // Large render of a cosmetic for the Season Pass showcase
  bigPreview(cat, id) {
    if (!this.bigCache) this.bigCache = new Map();
    const p = Save.p;
    const key = `${cat}|${id}|${p.eq.skin}|${p.eq.hair}|${p.eq.hairColor}`;
    if (!this.bigCache.has(key)) {
      if (!this.bigStudio) this.bigStudio = new PreviewStudio(640, 640);
      const st = this.bigStudio;
      const look = { ...this.app.cos() };
      const team = this.app.menuTeam === 1 ? 1 : 0;
      const c = cat === 'ball' ? st.ball(id) : cat === 'boots' ? st.character({ ...look, boots: id }, team, 'boots') : st.character({ ...look, [cat]: id }, team, cat === 'jersey' ? 'jersey' : 'hair');
      this.bigCache.set(key, c);
    }
    const src = this.bigCache.get(key);
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    c.getContext('2d').drawImage(src, 0, 0);
    return c;
  }


  renderTraining() {
    const p = Save.p;
    const best = { shoot: p.best.shoot || 0, keeper: p.best.keeper || 0 };
    const medalHtml = (k) => MEDALS[k].map((m, i) => `<i class="md m${i} ${best[k] >= m ? 'on' : ''}" title="${['Bronze', 'Silver', 'Gold'][i]}: ${m}${k === 'keeper' ? ' saves' : ' points'}"></i>`).join('');
    for (const k of ['shoot', 'keeper']) {
      $(`tgMed_${k}`).innerHTML = medalHtml(k);
      const next = MEDALS[k].find((m) => best[k] < m);
      $(`tgBest_${k}`).textContent = `BEST ${best[k]}${k === 'keeper' ? ' SAVES' : ''}${next ? `  ·  NEXT MEDAL ${next}` : '  ·  ALL MEDALS'}`;
    }
    $('tutTag').textContent = p.tutDone ? 'COMPLETED' : '+100 COINS';
    $('tgTip').textContent = TIPS[Math.floor(Date.now() / 86400000) % TIPS.length];
    const st = p.stats;
    const rate = st.matches ? Math.round((st.wins / st.matches) * 100) : 0;
    $('tgLevel').textContent = `LEVEL ${p.level}`;
    $('tgCareer').innerHTML = [['MATCHES', st.matches], ['WINS', st.wins], ['WIN RATE', `${rate}%`], ['GOALS', st.goals], ['ASSISTS', st.assists], ['SAVES', st.saves]]
      .map(([l, v]) => `<div class="tc"><b>${v}</b><span>${l}</span></div>`).join('');
    let n = 0;
    const rows = [['shoot', 'Shooting'], ['keeper', 'Goalkeeping']].map(([k, label]) => {
      const got = MEDALS[k].filter((m) => best[k] >= m).length; n += got;
      return `<div class="tm"><span>${label}</span><span class="tg-medals">${medalHtml(k)}</span></div>`;
    }).join('');
    $('tgMedals').innerHTML = rows;
    $('tgMedCount').textContent = `${n} / 6`;
  }

  showTrainingResult(r) {
    $('trTitle').textContent = r.title;
    $('trTitle').className = `res-title ${r.newBest ? '' : 'draw'}`;
    $('trScore').textContent = r.score;
    $('trBest').textContent = r.newBest ? 'NEW PERSONAL BEST' : r.best;
    $('trCoins').textContent = `+${r.coins}`;
    $('trAgainBtn').classList.toggle('hidden', !r.retry);
    this.modal('trainRes', true);
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
    $('pcLvNum').textContent = p.level;
    const f = clamp(p.xp / Save.xpNeeded(p.level), 0, 1);
    $('pcRing').style.strokeDashoffset = String(119.4 * (1 - f));
    $('pcXpText').textContent = `${p.xp}/${Save.xpNeeded(p.level)} XP`;
    const coins = $('pcCoins');
    if (coins.textContent !== String(p.coins)) { coins.textContent = p.coins; this.bump('pcCoins'); }
    $('mnVer').textContent = `v${this.app.version}`;
    this.renderPlayPage();
    if (this.page === 'shop') this.renderShop();
    if (this.page === 'inventory') this.renderInventory();
    if (this.page === 'training') this.renderTraining();
    const u = SDK.user;
    if (u && u.profilePictureUrl) $('pcAvatar').style.backgroundImage = `url("${u.profilePictureUrl}")`;
    $('loginBtn').classList.toggle('hidden', !(SDK.available && !SDK.user && SDK.environment === 'crazygames'));
    $('loginBtn').textContent = Save.p.loginBonusClaimed ? 'LOG IN · SYNC PROGRESS' : 'LOG IN + 300 COINS';
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
      state.inBox ? ['Dive', L('dive'), true, 'tackle'] : ['Tackle', L('tackle'), !state.hasBall, 'tackle'],
      ['Lob', L('lob'), state.hasBall, 'lob'],
      ['Request', L('request'), !state.hasBall, 'request'],
      ['Jump / Dribble', L('dribble'), true, 'dribble', true],
      ['Sprint', L('sprint'), true, 'sprint'],
    ];
    $('controlsList').innerHTML = rows.map(([n, k, on, id, gap]) => `<div class="kbtn ${on ? '' : 'off'} ${gap ? 'gap' : ''}" data-k="${id}"><span>${n}</span><kbd>${esc(k)}</kbd></div>`).join('');
    $('statsKey').querySelector('kbd').textContent = L('stats');
    $('lobbyKey').querySelector('kbd').textContent = L('lobby');
    $('unlockKey').querySelector('kbd').textContent = L('unlock');
    $('unlockHint').textContent = `${L('unlock')} · unlock mouse`;
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
        $(`slot${i}`).style.setProperty('--rc', it ? RARITY[ITEMS[it].rarity].color : 'transparent');
        $(`slot${i}`).querySelector('.slot-name').textContent = it ? ITEMS[it].name : '';
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

  setRole(text, keeper) {
    if (this.setVal('roleTag', 'text', text || '')) this.bump('roleTag');
    this.setVal('roleTag', 'class', `role-tag ${text ? 'show' : ''} ${keeper ? 'gk' : ''}`);
  }

  setDrill(show, score, label) {
    this.setVal('drillHud', 'class', `drill-hud ${show ? 'show' : ''}`);
    if (!show) return;
    if (this.setVal('drillScore', 'text', String(score))) this.bump('drillScore');
    this.setVal('drillLabel', 'text', label);
  }

  tutorialBox(t) {
    const el = $('tutBox');
    if (!t) { el.classList.remove('show'); this.cache.tutKey = ''; return; }
    el.classList.add('show');
    const key = `${t.step}|${t.title}`;
    if (this.cache.tutKey !== key) {
      this.cache.tutKey = key;
      $('tutStep').textContent = t.total ? `STEP ${t.step}/${t.total}` : 'TUTORIAL';
      $('tutTitle').textContent = t.title;
      $('tutText').innerHTML = t.html;
      $('tutSkipHint').innerHTML = t.skip || '';
      $('tutSkipBtn').classList.toggle('hidden', !t.skippable);
      el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
    }
    $('tutBar').style.width = `${clamp(t.progress || 0, 0, 1) * 100}%`;
    el.classList.toggle('done', !!t.done);
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
    $('gpAssist').textContent = assist ? `Assist: ${assist}` : '';
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
      const body = list.map((r) => `<tr class="${r.id === localId ? 'me' : ''}"><td>${esc(r.name)}</td><td>${r.points || 0}</td><td>${r.goals || 0}</td><td>${r.shots || 0}</td><td>${r.assists || 0}</td><td>${r.saves || 0}</td></tr>`).join('');
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
    $('resMvp').textContent = r.mvp ? `MVP: ${r.mvp}` : '';
    const st = r.stats || {};
    $('resStats').innerHTML = `<div><b>${st.goals || 0}</b>Goals</div><div><b>${st.assists || 0}</b>Assists</div><div><b>${st.saves || 0}</b>Saves</div><div><b>${st.steals || 0}</b>Steals</div><div><b>${st.points || 0}</b>Points</div>`;
    $('resCoins').textContent = `+${r.coins}`;
    $('resXp').textContent = `+${r.xp}`;
    $('resSp').textContent = `+${r.sp || 0}${r.tiers ? `  TIER ${Prog.tier()}` : ''}`;
    $('doubleBtn').classList.toggle('hidden', !r.canDouble);
    $('doubleBtn').disabled = false;
    if (!this.doubleHtml) this.doubleHtml = $('doubleBtn').innerHTML;
    $('doubleBtn').innerHTML = this.doubleHtml;
    $('resLoginBtn').classList.toggle('hidden', !(SDK.available && !SDK.user && SDK.environment === 'crazygames'));
    $('resLoginBtn').textContent = Save.p.loginBonusClaimed ? 'LOG IN TO SYNC PROGRESS' : 'SYNC PROGRESS + CLAIM 300 COINS';
    $('againBtn').textContent = 'PLAY AGAIN';
    $('againBtn').classList.remove('hidden');
    const circuit = r.matchCircuit;
    if (circuit) {
      const ready = circuit.milestones.filter((m) => m.ready).length;
      const next = circuit.milestones.find((m) => !m.claimed && m.matches > circuit.count);
      if (ready) this.setResNext(`Daily Match Circuit: ${ready} reward${ready === 1 ? '' : 's'} ready to claim in the lobby.`);
      else if (next) this.setResNext(`Daily Match Circuit: ${circuit.count}/${circuit.target} today · ${next.matches - circuit.count} more for ${Prog.label(next.reward)}.`);
      else this.setResNext('Daily Match Circuit complete — claim your rewards in the lobby.');
    } else this.setResNext('');
    this.modal('results', true);
  }
  setResNext(text) { $('resNext').textContent = text; }
  setDoubled() { if (!this.doubleHtml) this.doubleHtml = $('doubleBtn').innerHTML; $('doubleBtn').disabled = true; $('doubleBtn').textContent = 'COINS DOUBLED!'; }

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
      <div style="font-size:12px;opacity:.65">${info.isHost ? 'Warm up while friends join.' : 'Waiting for the host to start…'}</div>`;
    $('roomInvite').onclick = (e) => { e.stopPropagation(); this.app.audio.click(); this.app.copyInvite(); };
    if (info.isHost) $('roomStart').onclick = (e) => { e.stopPropagation(); this.app.audio.click(); this.app.beginPrivateMatch(); };
    el.classList.add('show');
  }

  // ---------------------------------------------------------- shop/inventory
  preview(cat, id) {
    const p = Save.p;
    const key = `${cat}|${id}|${cat === 'ball' || cat === 'goalfx' ? '' : `${p.eq.hairColor}|${p.eq.eyeColor}|${p.eq.skin}|${p.eq.hair}|${p.eq.jersey}|${p.eq.boots}|${p.eq.number}|${this.app.menuTeam === 1 ? 1 : 0}`}`;
    if (!this.previewCache.has(key)) {
      let c;
      // Real 3D renders of the in-game character / ball (2D art only for goal effects)
      if (!this.studio) { try { this.studio = new PreviewStudio(); } catch (e) { this.studio = null; } }
      const st = this.studio;
      const team = this.app.menuTeam === 1 ? 1 : 0;
      const look = { ...this.app.cos() };
      try {
        if (cat === 'goalfx' || !st) c = cat === 'goalfx' ? previewGoalFx(id) : cat === 'ball' ? previewBall(id) : cat === 'jersey' ? previewJersey(id, team) : cat === 'emote' ? previewEmote(id) : cat === 'boots' ? bootSwatch(id) : previewHair(id, p.eq.hairColor, p.eq.skin);
        else if (cat === 'ball') c = st.ball(id);
        else if (cat === 'boots') c = st.character({ ...look, boots: id }, team, 'boots');
        else if (cat === 'jersey') c = st.character({ ...look, jersey: id }, team, 'jersey');
        else if (cat === 'emote') c = st.character(look, team, 'emote', id);
        else c = st.character({ ...look, hair: id }, team, 'hair');
      } catch (e) { c = previewGoalFx('confetti'); }
      this.previewCache.set(key, c);
    }
    const src = this.previewCache.get(key);
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    c.getContext('2d').drawImage(src, 0, 0);
    return c;
  }

  tabs(el, list, cur, onPick) {
    el.innerHTML = list.map(([id, label]) => `<button class="${id === cur ? 'on' : ''}" data-tab="${id}">${label}</button>`).join('');
    el.querySelectorAll('button').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); this.app.audio.click(); onPick(b.dataset.tab); }));
  }

  renderShop() {
    const p = Save.p;
    const tab = this.shopTab;
    this.tabs($('shopTabs'), [['roll', 'Item Roll'], ['jersey', 'Jerseys'], ['boots', 'Boots'], ['hair', 'Hairstyles'], ['ball', 'Balls'], ['goalfx', 'Goal FX'], ['emote', 'Emotes']], tab, (t) => { this.shopTab = t; this.renderShop(); });
    const grid = $('shopGrid');
    grid.innerHTML = '';
    grid.classList.toggle('roll-mode', tab === 'roll');
    if (tab === 'roll') {
      const owned = p.powers.length, total = ITEM_KINDS.length;
      const odds = RARITY_ORDER.map((r) => {
        const items = ITEM_KINDS.filter((k) => ITEMS[k].rarity === r);
        return `<div class="odd" style="--rc:${RARITY[r].color}"><span class="odd-r">${RARITY[r].name}</span><span class="odd-p">${Math.round(ROLL.odds[r] * 1000) / 10}%</span><span class="odd-items">${items.map((k) => `<i class="${Save.ownsPower(k) ? '' : 'locked'}" title="${esc(ITEMS[k].name)}">${itemSvg(k)}</i>`).join('')}</span></div>`;
      }).join('');
      const done = owned >= total;
      grid.innerHTML = `<div class="roll-hero">
        <div class="roll-machine ${done ? 'done' : ''}">${this.cubeHtml()}<div class="rm-count">${owned}/${total} ITEMS</div></div>
        <div class="roll-side">
          <div class="roll-btns">
            ${Prog.s.tokens > 0 && !done ? `<button class="roll-btn free" data-roll="1"><b>FREE ROLL</b><span class="rb-cost">${Prog.s.tokens} LEFT</span></button>` : `<button class="roll-btn" data-roll="1" ${done ? 'disabled' : ''}><b>ROLL ×1</b><span class="rb-cost"><span class="coin"></span>${ROLL.cost}</span></button>`}
            <button class="roll-btn big" data-roll="5" ${done ? 'disabled' : ''}><b>ROLL ×5</b><span class="rb-cost"><span class="coin"></span>${ROLL.cost5}</span></button>
          </div>
          <div class="roll-pity">${done ? 'Collection complete!' : `New item guaranteed within <b>${Save.rollsToPity()}</b> roll${Save.rollsToPity() === 1 ? '' : 's'}`}</div>
          <div class="odds">${odds}</div>
        </div>
      </div>`;
      grid.querySelectorAll('[data-roll]').forEach((b) => b.addEventListener('click', (e) => {
        e.stopPropagation();
        const n = +b.dataset.roll;
        const m = grid.querySelector('.roll-machine');
        if (Save.canAfford(n) || (n === 1 && Prog.s.tokens > 0)) { if (m) m.classList.add('opening'); this.app.audio.whoosh(); setTimeout(() => { if (m) m.classList.remove('opening'); this.app.rollItems(n); }, 650); }
        else this.app.rollItems(n);
      }));
      return;
    }
    for (const it of CATALOG[tab]) if (!it.excl || Save.owns(tab, it.id)) grid.appendChild(this.cosmeticCard(tab, it, true));
  }

  // 3D mystery cube (same look as the in-game item cubes)
  cubeHtml(cls = '') {
    const face = (f) => `<i class="cf ${f}"><b>?</b></i>`;
    return `<div class="cube-scene ${cls}"><div class="cube-rays"></div><div class="cube-float"><div class="cube">${['front', 'back', 'right', 'left', 'top', 'bottom'].map(face).join('')}</div></div><div class="cube-shadow"></div></div>`;
  }

  // Item roll reveal: a horizontal strip of items spins past the marker and lands on the result
  // (5-rolls spin one after another and collect below). opts.starter = the free first roll.
  showRoll(results, opts = {}) {
    this.lastRollN = results.length;
    this.rollState = { results, i: 0, starter: !!opts.starter, done: false };
    $('rrHead').textContent = opts.starter ? 'YOUR FIRST ITEM' : results.length > 1 ? 'ITEM ROLL ×5' : 'ITEM ROLL';
    $('rrIntro').innerHTML = '';
    $('rrIntro').classList.remove('show');
    $('rrStrip').classList.add('show');
    $('rrCards').innerHTML = '';
    $('rrCards').className = 'rr-cards';
    this.rollButtons('spinning');
    this.modal('rollReveal', true);
    this.spinNext();
  }

  // Starter flow: intro with the cube and a free roll button
  showStarterRoll() {
    this.rollState = null;
    $('rrHead').textContent = 'YOUR FIRST ITEM';
    $('rrIntro').innerHTML = `${this.cubeHtml('big')}<p>Items drop from the cubes on the pitch. Roll for your first one!</p>`;
    $('rrIntro').classList.add('show');
    $('rrStrip').classList.remove('show');
    $('rrCards').innerHTML = '';
    this.rollButtons('intro');
    this.modal('rollReveal', true);
  }

  rollButtons(state) {
    const st = this.rollState;
    $('rrStartBtn').classList.toggle('hidden', state !== 'intro');
    $('rrSkipBtn').classList.toggle('hidden', state !== 'spinning');
    const again = $('rrAgainBtn');
    const showAgain = state === 'done' && !(st && st.starter);
    again.classList.toggle('hidden', !showAgain);
    if (showAgain) {
      const cost = this.lastRollN === 5 ? ROLL.cost5 : ROLL.cost;
      again.innerHTML = `ROLL AGAIN <span class="coin"></span>${cost}`;
      again.disabled = Save.p.coins < cost || Save.p.powers.length >= ITEM_KINDS.length;
    }
    $('rrDoneBtn').classList.toggle('hidden', state !== 'done');
    $('rrDoneBtn').textContent = st && st.starter ? "LET'S PLAY" : 'DONE';
  }

  stripCard(k) {
    const it = ITEMS[k];
    return `<div class="rs-card ${it.rarity}" style="--rc:${RARITY[it.rarity].color}"><div class="rs-ico">${itemSvg(k)}</div><div class="rs-name">${esc(it.name)}</div></div>`;
  }

  // Weighted filler for the strip so it looks like the real odds (lots of commons, the odd mythic)
  randomItem() {
    let r = Math.random();
    for (const rar of RARITY_ORDER) {
      r -= ROLL.odds[rar];
      if (r <= 0) { const pool = ITEM_KINDS.filter((k) => ITEMS[k].rarity === rar); return pool[Math.floor(Math.random() * pool.length)]; }
    }
    return ITEM_KINDS[0];
  }

  spinNext() {
    const st = this.rollState;
    if (!st || st.done) return;
    const res = st.results[st.i];
    const N = 52, WIN = 44;
    const track = $('rrTrack');
    const items = [];
    for (let i = 0; i < N; i++) items.push(i === WIN ? res.k : this.randomItem());
    track.innerHTML = items.map((k) => this.stripCard(k)).join('');
    track.style.transform = 'translateX(0px)';
    const strip = $('rrStrip');
    const card = track.children[0];
    const step = card.offsetWidth + 10;
    const center = strip.clientWidth / 2;
    const jitter = (Math.random() - 0.5) * card.offsetWidth * 0.7;
    const target = WIN * step + card.offsetWidth / 2 - center + jitter;
    const dur = (st.starter ? 5.2 : st.i === 0 ? 4.2 : 2.1) * 1000;
    const t0 = performance.now();
    let lastIdx = -1;
    st.anim = { target, step, center, t0, dur };
    const frame = (now) => {
      if (this.rollState !== st || st.done) return;
      const t = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - t, 4);
      const x = target * e;
      track.style.transform = `translateX(${-x}px)`;
      const idx = Math.floor((x + center) / step);
      if (idx !== lastIdx) { lastIdx = idx; if (t < 1) this.app.audio.tick(); }
      if (t < 1) requestAnimationFrame(frame);
      else this.landRoll();
    };
    requestAnimationFrame(frame);
  }

  landRoll() {
    const st = this.rollState;
    const res = st.results[st.i];
    const win = $('rrTrack').children[44];
    if (win) win.classList.add('win');
    const big = res.rarity === 'epic' || res.rarity === 'mythic';
    this.app.audio.reveal(big);
    $('rrStrip').style.setProperty('--rc', RARITY[res.rarity].color);
    $('rrStrip').classList.remove('flash'); void $('rrStrip').offsetWidth; $('rrStrip').classList.add('flash');
    this.addRollCard(res);
    st.i++;
    if (st.i < st.results.length) setTimeout(() => this.spinNext(), 650);
    else { st.done = true; this.rollButtons('done'); }
  }

  addRollCard(r) {
    const d = document.createElement('div');
    d.className = `rr-card ${r.rarity}`;
    d.style.setProperty('--rc', RARITY[r.rarity].color);
    d.innerHTML = `<div class="rr-front"><div class="rr-rar">${RARITY[r.rarity].name.toUpperCase()}</div><div class="rr-ico">${itemSvg(r.k)}</div><div class="rr-name">${esc(ITEMS[r.k].name)}</div>
      ${r.isNew ? '<div class="rr-new">NEW!</div>' : `<div class="rr-dup">DUPLICATE · <span class="coin"></span>+${r.refund}</div>`}</div>`;
    $('rrCards').appendChild(d);
  }

  // Skip straight to the results
  skipRoll() {
    const st = this.rollState;
    if (!st || st.done) return;
    st.done = true;
    const last = st.results[st.results.length - 1];
    const track = $('rrTrack');
    track.innerHTML = Array.from({ length: 52 }, (_, i) => this.stripCard(i === 44 ? last.k : this.randomItem())).join('');
    const card = track.children[0];
    const step = card.offsetWidth + 10;
    track.style.transform = `translateX(${-(44 * step + card.offsetWidth / 2 - $('rrStrip').clientWidth / 2)}px)`;
    track.children[44].classList.add('win');
    for (let i = st.i; i < st.results.length; i++) this.addRollCard(st.results[i]);
    this.app.audio.reveal(st.results.some((r) => r.rarity === 'epic' || r.rarity === 'mythic'));
    this.rollButtons('done');
  }

  cosmeticCard(cat, it, shop) {
    const p = Save.p;
    const owned = Save.owns(cat, it.id);
    const equipped = cat === 'emote' ? p.eq.emotes.includes(it.id) : p.eq[cat] === it.id;
    const card = document.createElement('div');
    card.className = `scard ${equipped ? 'eq' : ''} ${owned ? 'owned' : ''}`;
    const pv = document.createElement('div');
    pv.className = 'sc-art pv';
    pv.appendChild(this.preview(cat, it.id));
    card.appendChild(pv);
    const nm = document.createElement('div');
    nm.className = 'sc-name';
    nm.textContent = it.name;
    card.appendChild(nm);
    const foot = document.createElement('div');
    foot.className = 'sc-foot';
    if (owned) foot.innerHTML = equipped ? `<span class="sc-eq">${cat === 'emote' ? 'ON WHEEL' : 'EQUIPPED'}</span>` : `<span class="sc-owned">${shop ? 'OWNED' : (cat === 'emote' ? 'ADD TO WHEEL' : 'EQUIP')}</span>`;
    else foot.innerHTML = `<span class="sc-buy ${p.coins >= it.price ? '' : 'cant'}"><span class="coin"></span>${it.price}</span>`;
    card.appendChild(foot);
    card.addEventListener('click', () => this.app.lockerClick(cat, it.id));
    card.addEventListener('mouseenter', () => { if (cat === 'emote') { this.app.menuEmote = it.id; this.app.renderer.resetMenuEmote(); } });
    return card;
  }

  renderInventory() {
    const p = Save.p;
    const tab = this.invTab;
    this.tabs($('invTabs'), [['powers', 'Items'], ['jersey', 'Jerseys'], ['boots', 'Boots'], ['hair', 'Style'], ['ball', 'Balls'], ['goalfx', 'Goal FX'], ['emote', 'Emotes']], tab, (t) => { this.invTab = t; this.renderInventory(); });
    const grid = $('invGrid');
    const extra = $('invExtra');
    grid.innerHTML = '';
    grid.classList.toggle('inv-items', tab === 'powers');
    if (tab === 'powers') {
      if (!this.invSel || !ITEMS[this.invSel]) this.invSel = p.powers[0];
      const k = this.invSel, it = ITEMS[k], own = Save.ownsPower(k), on = Save.powerOn(k);
      extra.innerHTML = `<span class="inv-count"><b>${p.powers.length}</b>/${ITEM_KINDS.length} owned · <b>${Save.activePowers().length}</b> enabled</span>`;
      const tiles = ITEM_KINDS.map((key) => {
        const o = Save.ownsPower(key);
        return `<button class="itile ${o ? '' : 'locked'} ${key === k ? 'sel' : ''} ${o && !Save.powerOn(key) ? 'off' : ''}" style="--rc:${RARITY[ITEMS[key].rarity].color}" data-it="${key}"><span class="it-ico">${itemSvg(key)}</span><span class="it-name">${o ? esc(ITEMS[key].name) : '???'}</span></button>`;
      }).join('');
      grid.innerHTML = `<div class="inv-layout"><div class="itiles">${tiles}</div>
        <div class="idetail" style="--rc:${RARITY[it.rarity].color}">
          <div class="id-rar">${RARITY[it.rarity].name.toUpperCase()}</div>
          <div class="id-ico ${own ? '' : 'locked'}">${itemSvg(k)}</div>
          <div class="id-name">${own ? esc(it.name) : 'Locked'}</div>
          <div class="id-desc">${own ? esc(it.desc) : 'Get it from the Item Roll in the Shop.'}</div>
          ${own ? `<div class="id-toggle"><span>${on ? 'Enabled' : 'Disabled'}</span><button class="toggle ${on ? 'on' : ''}" data-pw="${k}"></button></div>` : '<button class="btn btn-gold id-go" data-goroll="1">ITEM ROLL</button>'}
        </div></div>`;
      grid.querySelectorAll('[data-it]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); this.app.audio.click(); this.invSel = b.dataset.it; this.renderInventory(); }));
      grid.querySelectorAll('[data-pw]').forEach((b) => b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.app.audio.click();
        if (!Save.togglePower(b.dataset.pw)) this.globalToast('Keep at least 3 items enabled');
        this.renderInventory();
      }));
      grid.querySelectorAll('[data-goroll]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); this.app.audio.click(); this.shopTab = 'roll'; this.setPage('shop'); }));
      return;
    }
    if (tab === 'hair') {
      extra.innerHTML = `<label>Skin</label>${SKIN_TONES.map((c, i) => `<div class="swatch ${p.eq.skin === i ? 'on' : ''}" data-skin="${i}" style="background:${c}"></div>`).join('')}
        <label>Hair</label>${HAIR_COLORS.map((c, i) => `<div class="swatch ${p.eq.hairColor === i ? 'on' : ''}" data-hc="${i}" style="background:${c}"></div>`).join('')}
        <label>Number</label><button class="num-btn" id="numDown">−</button><b class="num">${p.eq.number}</b><button class="num-btn" id="numUp">+</button>`;
      extra.querySelectorAll('[data-skin]').forEach((el) => el.addEventListener('click', () => { p.eq.skin = +el.dataset.skin; this.app.audio.click(); this.renderInventory(); this.app.onCosmeticsChanged(); }));
      extra.querySelectorAll('[data-hc]').forEach((el) => el.addEventListener('click', () => { p.eq.hairColor = +el.dataset.hc; this.app.audio.click(); this.renderInventory(); this.app.onCosmeticsChanged(); }));
      $('numDown').onclick = () => { p.eq.number = p.eq.number <= 1 ? 99 : p.eq.number - 1; this.renderInventory(); this.app.onCosmeticsChanged(); };
      $('numUp').onclick = () => { p.eq.number = p.eq.number >= 99 ? 1 : p.eq.number + 1; this.renderInventory(); this.app.onCosmeticsChanged(); };
    } else if (tab === 'emote') {
      extra.innerHTML = `<span class="inv-count">Wheel ${p.eq.emotes.filter(Boolean).length}/8</span>`;
    } else extra.innerHTML = '';
    for (const it of CATALOG[tab]) if (Save.owns(tab, it.id)) grid.appendChild(this.cosmeticCard(tab, it, false));
  }

  renderLocker() {
    if (this.page === 'shop') this.renderShop();
    else this.renderInventory();
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
    // Pass and Dive may share a button: dive only happens for a keeper without the ball
    for (const [c, list] of used) if (list.length === 2 && list.includes('pass') && list.includes('dive')) used.set(c, ['pass']);
    const bindRow = (a) => {
      const codes = binds[a] || [];
      const conflict = codes.some((c) => used.get(c).length > 1);
      const custom = Save.p.binds[a] !== undefined;
      return `<div class="set-row"><div class="lbl"><b>${BIND_LABELS[a]}</b><span class="${conflict ? 'warn' : custom ? 'cust' : ''}">${conflict ? 'Conflicting keybinds' : custom ? 'Custom keybinds' : 'Default keybinds'}</span></div>
        <div class="binds">${custom ? `<button class="bind-reset" data-reset="${a}" title="Reset"><svg viewBox="0 0 24 24" width="14" height="14"><path d="M5 12a7 7 0 1 0 2-5M5 4v4h4" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>` : ''}${codes.map((c, i) => `<button class="bind" data-bind="${a}" data-i="${i}">${esc(app.input.label(c))}</button>`).join('')}${codes.length < 2 ? `<button class="bind-reset" data-bind="${a}" data-i="${codes.length}">+</button>` : ''}</div></div>`;
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
      ${this.isTouch ? '' : slider('curveSens', 'Curve Sensitivity', 'How sharply a mouse swipe bends the ball', 0.3, 2.5, 0.05)}
      ${this.isTouch ? toggle('aimAssist', 'Aim Assist', 'Touch: shots near the goal snap inside the frame') : ''}
      <div class="set-sec">Interface</div>
      ${toggle('showControls', 'Show Controls', 'Display the key and button prompts')}
      ${toggle('showHints', 'Show Hints', 'Display tips on how to play')}
      ${toggle('nameTags', 'Show Name Tags', 'Names above other players')}
      ${toggle('showStats', 'Show Stats', 'Display framerate and ping')}
      <div class="set-sec">Mouse</div>
      ${bindRow('unlock')}
      <div class="set-sec" data-sec="keys">Gameplay Keybinds</div>
      ${['kick', 'curve', 'pass', 'flick', 'tackle', 'dive', 'lob', 'request', 'dribble', 'sprint', 'item1', 'item2'].map(bindRow).join('')}
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
    if (this.touchReady) return;
    this.touchReady = true;
    this.isTouch = true;
    document.body.classList.add('is-touch');
    const touch = $('touch');
    for (const [sel, icon, label] of [['.tb-kick', 'kick', 'KICK'], ['.tb-pass', 'pass', 'PASS'], ['.tb-tackle', 'tackle', 'TACKLE'], ['.tb-dribble', 'jump', 'JUMP'], ['.tb-lob', 'lob', 'LOB'], ['.tb-req', 'request', 'CALL'], ['.tb-flick', 'flick', 'FLICK'], ['.tb-sprint', 'sprint', 'SPRINT']]) this.touchButton(sel, icon, label);
    // iOS Safari: block pinch-zoom gestures over the game
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    const stick = $('stick'), knob = $('stickKnob');
    let stickId = null, cx = 0, cy = 0, R = 1;
    const setKnob = (dx, dy) => { knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`; };
    // Floating joystick: touch anywhere on the left side and the stick appears under your thumb
    const home = () => { stick.style.left = ''; stick.style.top = ''; stick.style.bottom = ''; stick.classList.remove('live'); };
    $('stickZone').addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (stickId !== null) return;
      const t = e.changedTouches[0];
      stickId = t.identifier;
      const r = stick.getBoundingClientRect();
      R = r.width / 2;
      const margin = 8;
      cx = clamp(t.clientX, R + margin, window.innerWidth * 0.45);
      cy = clamp(t.clientY, R + margin, window.innerHeight - R - margin);
      stick.style.left = `${cx - R}px`; stick.style.top = `${cy - R}px`; stick.style.bottom = 'auto';
      stick.classList.add('live');
      this.app.audio.unlock();
      moveStick(e);
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
        home();
        input.touch.mx = 0; input.touch.mz = 0; input.touch.active = false; input.touch.sprint = false;
      }
    };
    window.addEventListener('touchmove', moveStick, { passive: true });
    window.addEventListener('touchend', endStick);
    window.addEventListener('touchcancel', endStick);
    // Look zone
    const look = $('lookZone');
    let lookId = null, lx = 0, ly = 0;
    look.addEventListener('touchstart', (e) => { const t = e.changedTouches[0]; lookId = t.identifier; lx = t.clientX; ly = t.clientY; input.touch.looking = true; input.touch.lookT = performance.now(); }, { passive: true });
    window.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== lookId) continue;
        input.mdx += (t.clientX - lx) * 1.6; input.mdy += (t.clientY - ly) * 1.6;
        input.touch.lookT = performance.now();
        lx = t.clientX; ly = t.clientY;
      }
    }, { passive: true });
    const endLook = (e) => { for (const t of e.changedTouches) if (t.identifier === lookId) { lookId = null; input.touch.looking = false; } };
    window.addEventListener('touchend', endLook);
    window.addEventListener('touchcancel', endLook);
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

  // Line icons for the touch buttons (same stroke style as the menus)
  touchIcon(name) {
    const L = 'fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"';
    const I = {
      kick: `<path d="M6 17l4-1 3-7 4 1-1 5 3 2v3H6z" ${L}/><circle cx="18" cy="6" r="2.6" ${L}/>`,
      use: `<path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z" ${L}/>`,
      pass: `<path d="M4 12h14M13 6l6 6-6 6" ${L}/>`,
      lob: `<path d="M4 18c3-10 13-10 16 0M16 15l4 3 1-5" ${L}/>`,
      flick: `<path d="M12 20V6M7 11l5-5 5 5" ${L}/><circle cx="12" cy="4" r="1.6" fill="currentColor"/>`,
      tackle: `<path d="M3 18h12l5-4M7 14l4-4 4 1" ${L}/><circle cx="16" cy="6" r="2.2" ${L}/>`,
      dive: `<path d="M7 14V8a1.5 1.5 0 0 1 3 0v4M10 11V5.5a1.5 1.5 0 0 1 3 0V11M13 11V6.5a1.5 1.5 0 0 1 3 0V11M16 11.5V8.5a1.5 1.5 0 0 1 3 0V15c0 3-2.2 5-5 5h-1.5c-2.4 0-3.8-1-4.8-2.7L5 13.5a1.4 1.4 0 0 1 2.2-1.7L8 13" ${L}/>`,
      jump: `<path d="M6 13l6-6 6 6M6 19l6-6 6 6" ${L}/>`,
      skill: `<path d="M20 12a8 8 0 1 1-3-6.3M20 4v4h-4" ${L}/>`,
      request: `<path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V11V4.5a1.5 1.5 0 0 1 3 0V11V6a1.5 1.5 0 0 1 3 0v8c0 3.5-2.5 6-6 6s-5-2-6-4l-2-3.5a1.4 1.4 0 0 1 2.3-1.6z" ${L}/>`,
      sprint: `<path d="M13 3L6 13h5l-1 8 7-10h-5z" ${L}/>`,
    };
    return `<svg viewBox="0 0 24 24">${I[name] || ''}</svg>`;
  }

  touchButton(sel, icon, label) {
    const b = document.querySelector(sel);
    if (!b) return;
    const small = b.querySelector('small');
    b.innerHTML = `<i class="ti">${this.touchIcon(icon)}</i><span>${label}</span>${small ? small.outerHTML : ''}`;
  }

  touchVisible(on) { this.cache.touchclass = null; $('touch').classList.toggle('show', !!on && this.isTouch); }
  setTackleLabel(dive) { if (this.setVal('tbTackleLbl', 'v', dive)) this.touchButton('.tb-tackle', dive ? 'dive' : 'tackle', dive ? 'DIVE' : 'TACKLE'); }
  // Context-sensitive touch buttons: ball actions when you have the ball, defending actions without
  setTouchState(hasBall, dive, item) {
    if (!this.isTouch) return;
    const cls = `touch show ${hasBall ? 'has-ball' : 'no-ball'} ${item ? 'item' : ''}`;
    this.setVal('touch', 'class', cls);
    if (this.setVal('tbDribLbl', 'v', hasBall)) this.touchButton('.tb-dribble', hasBall ? 'skill' : 'jump', hasBall ? 'SPIN' : 'JUMP');
    if (this.setVal('tbKickLbl', 'v', item)) this.touchButton('.tb-kick', item ? 'use' : 'kick', item ? 'USE' : 'KICK');
    this.setTackleLabel(dive);
  }
}

// 2D fallback for boot cards when WebGL previews aren't available
function bootSwatch(id) {
  const b = CATALOG.boots.find((x) => x.id === id) || CATALOG.boots[0];
  const c = document.createElement('canvas');
  c.width = 312; c.height = 260;
  const g = c.getContext('2d');
  g.fillStyle = b.base; g.beginPath(); g.moveTo(70, 170); g.lineTo(250, 170); g.quadraticCurveTo(262, 140, 200, 130); g.lineTo(150, 95); g.lineTo(90, 95); g.quadraticCurveTo(66, 130, 70, 170); g.fill();
  g.fillStyle = b.accent; g.beginPath(); g.moveTo(100, 160); g.lineTo(190, 160); g.lineTo(140, 130); g.lineTo(96, 130); g.fill();
  g.fillStyle = b.sole; g.fillRect(66, 170, 190, 10);
  return c;
}
