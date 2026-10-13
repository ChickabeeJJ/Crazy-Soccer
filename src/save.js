import { SDK } from './sdk.js';
import { SAVE_KEY, ITEMS, ITEM_KINDS, ROLL } from './config.js';
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
  curve: ['KeyX', 'Mouse1'],
  dive: ['Mouse2'],
  item1: ['Digit1'],
  item2: ['Digit2'],
  stats: ['Tab'],
  lobby: ['KeyL'],
  chat: ['KeyC'],
  emote: ['KeyB'],
  unlock: ['KeyM'],
};

export const BIND_LABELS = {
  kick: 'Kick / Activate', pass: 'Pass', flick: 'Flick', tackle: 'Tackle', dive: 'Dive (Goalkeeper)', lob: 'Lob', request: 'Request',
  dribble: 'Dribble', sprint: 'Sprint', curve: 'Curve (hold while charging)', item1: 'Item 1', item2: 'Item 2', stats: 'Stats', lobby: 'Return to Lobby',
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
  curveSens: 1,
  showControls: true,
  showHints: true,
  showStats: false,
  perf: false,
  nameTags: true,
  aimAssist: true,
};

function freshProfile() {
  const owned = {};
  for (const cat of Object.keys(CATALOG)) owned[cat] = CATALOG[cat].filter((x) => x.price === 0 && !x.excl).map((x) => x.id);
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
      eyeColor: 0,
      jersey: 'classic',
      boots: 'classic',
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
    powers: [], // new players start with only the item from their free first roll
    starterRoll: false,
    pity: 0,
    rolls: 0,
    powersOff: [],
    best: { shoot: 0, keeper: 0 },
  };
}

function pickByRarity(pool) {
  // Weight each item by its rarity's chance split across that rarity's items
  const byR = {};
  for (const k of ITEM_KINDS) (byR[ITEMS[k].rarity] = byR[ITEMS[k].rarity] || []).push(k);
  const w = pool.map((k) => ROLL.odds[ITEMS[k].rarity] / byR[ITEMS[k].rarity].length);
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) return pool[i]; }
  return pool[pool.length - 1];
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
      // Older saves: Barrel Roll was replaced by the Bazooka
      const old = (Array.isArray(data.powers) ? data.powers : []).map((k) => (k === 'barrel' ? 'bazooka' : k));
      this.p.powers = [...new Set(old)].filter((k) => ITEMS[k]);
      // Saves from before the starter roll already have their items
      this.p.starterRoll = data.starterRoll ?? this.p.powers.length > 0;
      this.p.powersOff = (Array.isArray(data.powersOff) ? data.powersOff : []).filter((k) => this.p.powers.includes(k));
      // at least 3 items (or all you own, if fewer) stay enabled
      while (this.p.powersOff.length && this.activePowers().length < Math.min(ROLL.minEnabled, this.p.powers.length)) this.p.powersOff.pop();
      for (const cat of Object.keys(CATALOG)) {
        for (const it of CATALOG[cat]) if (it.price === 0 && !it.excl && !this.p.owned[cat].includes(it.id)) this.p.owned[cat].push(it.id);
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
    if (!item || item.excl || this.owns(cat, id) || this.p.coins < item.price) return false;
    this.p.coins -= item.price;
    this.p.owned[cat].push(id);
    this.save(true);
    return true;
  },

  // ---- Powers (mystery cube contents) ----
  ownsPower(k) { return this.p.powers.includes(k); },
  // Item Roll (gacha). Returns [{ k, rarity, isNew, refund }] or null if not enough coins.
  rollCost(n) { return n === 5 ? ROLL.cost5 : ROLL.cost * n; },
  canAfford(n) { return this.p.coins >= this.rollCost(n); },
  roll(n = 1, free = false) {
    const cost = free ? 0 : this.rollCost(n);
    if (this.p.coins < cost) return null;
    this.p.coins -= cost;
    const out = [];
    for (let i = 0; i < n; i++) {
      const locked = ITEM_KINDS.filter((k) => !this.ownsPower(k));
      const early = (this.p.rolls || 0) + i < ROLL.noDupeRolls; // a player's first rolls never repeat
      let k;
      if (locked.length && (early || (this.p.pity || 0) >= ROLL.pity)) {
        k = pickByRarity(locked); // pity: guaranteed new item
      } else k = pickByRarity(ITEM_KINDS);
      const isNew = !this.ownsPower(k);
      const rarity = ITEMS[k].rarity;
      let refund = 0;
      if (isNew) { this.p.powers.push(k); this.p.pity = 0; } else { refund = ROLL.dupeRefund; this.p.coins += refund; this.p.pity = (this.p.pity || 0) + 1; }
      out.push({ k, rarity, isNew, refund });
    }
    this.p.rolls = (this.p.rolls || 0) + n;
    if (free) this.p.starterRoll = true;
    this.save(true);
    return out;
  },
  rollsToPity() { return Math.max(1, ROLL.pity + 1 - (this.p.pity || 0)); },
  powerOn(k) { return this.ownsPower(k) && !this.p.powersOff.includes(k); },
  togglePower(k) {
    if (!this.ownsPower(k)) return false;
    const off = this.p.powersOff;
    if (off.includes(k)) off.splice(off.indexOf(k), 1);
    else {
      if (this.activePowers().length <= Math.min(ROLL.minEnabled, this.p.powers.length)) return false; // keep at least 3 items in the cube pool
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
