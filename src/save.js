import { SDK } from './sdk.js';
import { SAVE_KEY, ITEMS, ITEM_KINDS } from './config.js';
import { CATALOG, guestName } from './cosmetics.js';
import { todayKey } from './util/math.js';

export const DEFAULT_BINDS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  kick: ['Mouse0'],
  pass: ['KeyT', 'Mouse2'],
  flick: ['KeyQ'],
  tackle: ['KeyE'],
  lob: ['KeyF'],
  request: ['KeyR'],
  dribble: ['Space'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  item1: ['Digit1'],
  item2: ['Digit2'],
  stats: ['Tab'],
  lobby: ['KeyL'],
  chat: ['KeyC'],
  emote: ['KeyB'],
  unlock: ['KeyM'],
};

export const BIND_LABELS = {
  kick: 'Kick / Activate', pass: 'Pass', flick: 'Flick', tackle: 'Tackle / Dive', lob: 'Lob', request: 'Request',
  dribble: 'Dribble', sprint: 'Sprint', item1: 'Item 1', item2: 'Item 2', stats: 'Stats', lobby: 'Return to Lobby',
  chat: 'Quick Chat', emote: 'Emotes', forward: 'Move Forward', back: 'Move Back', left: 'Move Left', right: 'Move Right',
  unlock: 'Unlock Mouse',
};

export const DEFAULT_SETTINGS = {
  master: 0.8,
  music: 0.45,
  sfx: 0.9,
  sens: 1.0,
  invertY: false,
  shake: 5,
  assistedPasses: true,
  autoCurve: true,
  showControls: true,
  showHints: true,
  showStats: false,
  perf: false,
  nameTags: true,
  aimAssist: true,
};

function freshProfile() {
  const owned = {};
  for (const cat of Object.keys(CATALOG)) owned[cat] = CATALOG[cat].filter((x) => x.price === 0).map((x) => x.id);
  return {
    v: 1,
    name: guestName(),
    coins: 150,
    xp: 0,
    level: 1,
    owned,
    eq: {
      skin: 1,
      hair: 'spiky',
      hairColor: 0,
      jersey: 'classic',
      ball: 'classic',
      goalfx: 'confetti',
      emotes: ['wave', 'clap', null, null, null, null, null, null],
      number: 7 + Math.floor(Math.random() * 3) * 3,
    },
    settings: { ...DEFAULT_SETTINGS, perf: SDK.isMobile },
    binds: {},
    stats: { matches: 0, wins: 0, goals: 0, assists: 0, saves: 0 },
    daily: { last: '', streak: 0 },
    tut: 0,
    powers: ITEM_KINDS.filter((k) => ITEMS[k].price === 0),
    powersOff: [],
    best: { shoot: 0, keeper: 0 },
  };
}

export const Save = {
  p: null,
  _timer: null,

  load() {
    let data = null;
    try {
      const raw = SDK.getItem(SAVE_KEY);
      if (raw) data = JSON.parse(raw);
    } catch (e) {
      data = null;
    }
    const base = freshProfile();
    if (data && data.v === 1) {
      this.p = {
        ...base,
        ...data,
        owned: { ...base.owned, ...(data.owned || {}) },
        eq: { ...base.eq, ...(data.eq || {}) },
        settings: { ...base.settings, ...(data.settings || {}) },
        stats: { ...base.stats, ...(data.stats || {}) },
        daily: { ...base.daily, ...(data.daily || {}) },
        best: { ...base.best, ...(data.best || {}) },
        binds: data.binds || {},
      };
      this.p.powers = [...new Set([...base.powers, ...(Array.isArray(data.powers) ? data.powers : [])])].filter((k) => ITEMS[k]);
      this.p.powersOff = (Array.isArray(data.powersOff) ? data.powersOff : []).filter((k) => this.p.powers.includes(k));
      for (const cat of Object.keys(CATALOG)) {
        for (const it of CATALOG[cat]) if (it.price === 0 && !this.p.owned[cat].includes(it.id)) this.p.owned[cat].push(it.id);
      }
    } else {
      this.p = base;
    }
    return this.p;
  },

  get binds() {
    return { ...DEFAULT_BINDS, ...this.p.binds };
  },

  save(now = false) {
    clearTimeout(this._timer);
    const write = () => {
      try { SDK.setItem(SAVE_KEY, JSON.stringify(this.p)); } catch (e) { /* ignore */ }
    };
    if (now) write();
    else this._timer = setTimeout(write, 1500);
  },

  displayName() {
    if (SDK.user && SDK.user.username) return SDK.user.username;
    return this.p.name;
  },

  xpNeeded(level) {
    return 120 + (level - 1) * 60;
  },

  addXp(amount) {
    const p = this.p;
    p.xp += amount;
    let levels = 0;
    while (p.xp >= this.xpNeeded(p.level)) {
      p.xp -= this.xpNeeded(p.level);
      p.level += 1;
      levels += 1;
      p.coins += 50;
    }
    this.save();
    return levels;
  },

  addCoins(n) {
    this.p.coins += n;
    this.save();
  },

  owns(cat, id) {
    return this.p.owned[cat].includes(id);
  },

  buy(cat, id) {
    const item = CATALOG[cat].find((x) => x.id === id);
    if (!item || this.owns(cat, id) || this.p.coins < item.price) return false;
    this.p.coins -= item.price;
    this.p.owned[cat].push(id);
    this.save(true);
    return true;
  },

  // ---- Powers (mystery cube contents) ----
  ownsPower(k) { return this.p.powers.includes(k); },
  buyPower(k) {
    const it = ITEMS[k];
    if (!it || this.ownsPower(k) || this.p.coins < it.price) return false;
    this.p.coins -= it.price;
    this.p.powers.push(k);
    this.save(true);
    return true;
  },
  powerOn(k) { return this.ownsPower(k) && !this.p.powersOff.includes(k); },
  togglePower(k) {
    if (!this.ownsPower(k)) return false;
    const off = this.p.powersOff;
    if (off.includes(k)) off.splice(off.indexOf(k), 1);
    else {
      if (this.activePowers().length <= 1) return false; // at least one power stays in the cube pool
      off.push(k);
    }
    this.save();
    return true;
  },
  activePowers() { return this.p.powers.filter((k) => !this.p.powersOff.includes(k)); },

  dailyAvailable() {
    return this.p.daily.last !== todayKey();
  },

  claimDaily() {
    if (!this.dailyAvailable()) return 0;
    const y = new Date(Date.now() - 86400000);
    const yKey = `${y.getFullYear()}-${y.getMonth() + 1}-${y.getDate()}`;
    this.p.daily.streak = this.p.daily.last === yKey ? Math.min(7, this.p.daily.streak + 1) : 1;
    this.p.daily.last = todayKey();
    const reward = 40 + this.p.daily.streak * 20;
    this.p.coins += reward;
    this.save(true);
    return reward;
  },
};
