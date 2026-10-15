// Long-term progression: Season Pass (free + Elite track), 7-day login calendar, daily challenges,
// playtime rewards and rotating limited-time events. Everything is earned by playing; nothing costs
// real money. State lives in Save.p.prog and every timer is based on the player's local calendar.
import { Save } from './save.js';
import { CATALOG } from './cosmetics.js';
import { ITEM_KINDS } from './config.js';

const DAY = 86400000;
// Seasons are 28 days long, counted from this date. Weekly events run Thursday to Sunday.
const SEASON_EPOCH = Date.UTC(2026, 9, 1);
const SEASON_LEN = 28 * DAY;
export const PASS = { tiers: 30, spPerTier: 300, eliteCost: 3500 };

// Each season has its own exclusive cosmetics (never sold in the shop)
const SEASONS = [
  { name: 'KICKOFF', color: '#ffcf3f', excl: [['jersey', 'flames'], ['boots', 'phantom'], ['ball', 'plasma'], ['jersey', 'galaxyk']] },
  { name: 'NEON NIGHTS', color: '#ff3bd0', excl: [['jersey', 'neon'], ['boots', 'aurora'], ['ball', 'diamond'], ['jersey', 'carbon']] },
];

export const EVENTS = [
  { id: 'goldrush', name: 'GOLD RUSH', desc: 'Double coins from every match', coinMul: 2, goal: { stat: 'goals', n: 8, label: 'Score 8 goals' }, reward: ['jersey', 'camo'] },
  { id: 'frenzy', name: 'ITEM FRENZY', desc: 'Mystery cubes drop twice as often', itemMul: 2, goal: { stat: 'items', n: 25, label: 'Use 25 items' }, reward: ['boots', 'champion'] },
  { id: 'surge', name: 'SEASON SURGE', desc: 'Double Season XP', spMul: 2, goal: { stat: 'wins', n: 5, label: 'Win 5 matches' }, reward: ['ball', 'eclipse'] },
  { id: 'brawl', name: 'TACKLE MANIA', desc: 'Tackles earn triple Season XP', tackleMul: 3, goal: { stat: 'steals', n: 20, label: 'Win the ball 20 times' }, reward: ['boots', 'ember'] },
];

// Daily challenge pool: [id, label, stat, target, sp, coins]
const CHALLENGES = [
  ['play3', 'Play 3 matches', 'matches', 3, 250, 60],
  ['win2', 'Win 2 matches', 'wins', 2, 300, 80],
  ['goals4', 'Score 4 goals', 'goals', 4, 300, 80],
  ['assist3', 'Make 3 assists', 'assists', 3, 250, 60],
  ['steal6', 'Win the ball 6 times', 'steals', 6, 250, 60],
  ['items8', 'Use 8 items', 'items', 8, 250, 60],
  ['saves4', 'Make 4 saves', 'saves', 4, 250, 60],
  ['goals2', 'Score 2 goals in one match', 'goalsOne', 2, 350, 90],
];

// 7-day login calendar (cycles). kind: coins | token (free item roll) | sp | chest
export const CALENDAR = [
  { kind: 'coins', n: 100 }, { kind: 'coins', n: 150 }, { kind: 'token', n: 1 }, { kind: 'coins', n: 250 },
  { kind: 'sp', n: 400 }, { kind: 'coins', n: 350 }, { kind: 'chest', n: 600, tokens: 2 },
];

// Playtime milestones (minutes of match time today)
export const PLAYTIME = [
  { min: 5, kind: 'coins', n: 80 }, { min: 10, kind: 'sp', n: 200 }, { min: 20, kind: 'token', n: 1 }, { min: 35, kind: 'coins', n: 250 }, { min: 50, kind: 'sp', n: 500 },
];

// One-time seven-local-day comeback contract. Economy-breaking by design:
// 1.585M coins, 255 free rolls, and two cosmetics that are not sold in the shop.
export const RETURN_CONTRACT = [
  { day: 1, title: 'WELCOME DROP', reward: { kind: 'bundle', rewards: [{ kind: 'coins', n: 1000 }] } },
  { day: 2, title: 'ROLL STORM', reward: { kind: 'bundle', rewards: [{ kind: 'coins', n: 25000 }, { kind: 'token', n: 10 }] } },
  { day: 3, title: 'GOLDEN COMEBACK', reward: { kind: 'bundle', rewards: [{ kind: 'coins', n: 50000 }, { kind: 'token', n: 15 }, { kind: 'item', cat: 'boots', id: 'comeback_gold' }] } },
  { day: 4, title: 'VAULT BREAKER', reward: { kind: 'bundle', rewards: [{ kind: 'coins', n: 100000 }, { kind: 'token', n: 25 }] } },
  { day: 5, title: 'COIN APOCALYPSE', reward: { kind: 'bundle', rewards: [{ kind: 'coins', n: 150000 }, { kind: 'token', n: 40 }] } },
  { day: 6, title: 'THE BIG ONE', reward: { kind: 'bundle', rewards: [{ kind: 'coins', n: 250000 }, { kind: 'token', n: 60 }] } },
  { day: 7, title: 'DAYBREAK SOVEREIGN', reward: { kind: 'bundle', rewards: [{ kind: 'coins', n: 1000000 }, { kind: 'token', n: 100 }, { kind: 'item', cat: 'jersey', id: 'daybreak_royal' }] } },
];

const localDayStart = (t) => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };

// Daily Match Circuit: any completed match counts, win or lose.
// The five-match milestone gives a chest and free roll; these are gameplay rewards.
export const MATCH_CIRCUIT = [
  { matches: 1, reward: { kind: 'coins', n: 100 } },
  { matches: 3, reward: { kind: 'coins', n: 250 } },
  { matches: 5, reward: { kind: 'chest', n: 500, tokens: 1 } },
];

const dayKey = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

function fresh() {
  return {
    season: 0, sp: 0, elite: false, claimed: { f: [], e: [] },
    cal: { day: 0, last: '' },
    chal: { day: '', list: [] },
    play: { day: '', secs: 0, claimed: [] },
    matchRun: { day: '', count: 0, claimed: [] },
    ev: { key: '', prog: 0, claimed: false },
    tokens: 0,
  };
}

export const Prog = {
  get s() {
    const p = Save.p;
    if (!p.prog) p.prog = fresh();
    const g = p.prog;
    for (const [k, v] of Object.entries(fresh())) if (g[k] === undefined) g[k] = v;
    this.roll(g);
    return g;
  },

  // Daily / seasonal / weekly resets
  roll(g) {
    const sn = this.seasonNo();
    if (g.season !== sn) { g.season = sn; g.sp = 0; g.elite = false; g.claimed = { f: [], e: [] }; }
    const today = dayKey();
    if (g.chal.day !== today) {
      const h = hash(today);
      const pool = CHALLENGES.map((c, i) => ({ c, r: hash(`${today}:${i}:${h}`) })).sort((a, b) => a.r - b.r).slice(0, 3);
      g.chal = { day: today, list: pool.map(({ c }) => ({ id: c[0], prog: 0, done: false, claimed: false })) };
    }
    if (g.play.day !== today) g.play = { day: today, secs: 0, claimed: [] };
    if (!g.matchRun || g.matchRun.day !== today) g.matchRun = { day: today, count: 0, claimed: [] };
    const ev = this.event();
    const key = ev ? `${ev.id}:${ev.start}` : '';
    if (g.ev.key !== key) g.ev = { key, prog: 0, claimed: false };
  },

  // ------------------------------------------------------------- season pass
  seasonNo(t = Date.now()) { return Math.max(1, Math.floor((t - SEASON_EPOCH) / SEASON_LEN) + 1); },
  seasonInfo() {
    const n = this.seasonNo();
    const S = SEASONS[(n - 1) % SEASONS.length];
    return { n, name: S.name, color: S.color, ends: SEASON_EPOCH + n * SEASON_LEN };
  },
  tier(g = this.s) { return Math.min(PASS.tiers, Math.floor(g.sp / PASS.spPerTier)); },
  tierProgress(g = this.s) { return g.sp >= PASS.tiers * PASS.spPerTier ? 1 : (g.sp % PASS.spPerTier) / PASS.spPerTier; },
  // Reward for tier t (1-based) on track 'f' (free) or 'e' (elite)
  reward(t, track) {
    const S = SEASONS[(this.seasonNo() - 1) % SEASONS.length];
    if (track === 'f') {
      if (t === 10) return { kind: 'item', cat: S.excl[1][0], id: S.excl[1][1] };
      if (t === 30) return { kind: 'item', cat: S.excl[2][0], id: S.excl[2][1] };
      if (t % 5 === 0) return { kind: 'token', n: 1 };
      return { kind: 'coins', n: 40 + Math.floor(t / 3) * 10 };
    }
    if (t === 1) return { kind: 'item', cat: S.excl[0][0], id: S.excl[0][1] };
    if (t === 20) return { kind: 'item', cat: S.excl[3][0], id: S.excl[3][1] };
    if (t === 30) return { kind: 'chest', n: 1000, tokens: 3 };
    if (t % 4 === 0) return { kind: 'token', n: 1 };
    return { kind: 'coins', n: 90 + t * 6 };
  },
  canClaim(t, track, g = this.s) {
    if (t > this.tier(g)) return false;
    if (track === 'e' && !g.elite) return false;
    return !g.claimed[track].includes(t);
  },
  claimTier(t, track) {
    const g = this.s;
    if (!this.canClaim(t, track, g)) return null;
    g.claimed[track].push(t);
    const r = this.reward(t, track);
    this.grant(r);
    return r;
  },
  claimAllPass() {
    const out = [];
    for (let t = 1; t <= PASS.tiers; t++) for (const tr of ['f', 'e']) { const r = this.claimTier(t, tr); if (r) out.push(r); }
    return out;
  },
  buyElite() {
    const g = this.s;
    if (g.elite || Save.p.coins < PASS.eliteCost) return false;
    Save.p.coins -= PASS.eliteCost;
    g.elite = true;
    Save.save(true);
    return true;
  },
  addSp(n) {
    const g = this.s;
    const before = this.tier(g);
    g.sp = Math.min(PASS.tiers * PASS.spPerTier, g.sp + Math.round(n));
    Save.save();
    return this.tier(g) - before;
  },

  // Rewards land in the profile right away
  grant(r) {
    const p = Save.p;
    if (!r) return;
    if (r.kind === 'coins') p.coins += r.n;
    else if (r.kind === 'token') { if (p.powers.length >= ITEM_KINDS.length) p.coins += 150 * r.n; else this.s.tokens += r.n; }
    else if (r.kind === 'sp') this.addSp(r.n);
    else if (r.kind === 'chest') { p.coins += r.n; this.s.tokens += r.tokens || 0; }
    else if (r.kind === 'bundle') { for (const part of r.rewards || []) this.grant(part); }
    else if (r.kind === 'item') { if (!p.owned[r.cat].includes(r.id)) p.owned[r.cat].push(r.id); }
    Save.save(true);
  },
  label(r) {
    if (!r) return '';
    if (r.kind === 'coins') return `${r.n} COINS`;
    if (r.kind === 'token') return r.n > 1 ? `${r.n} FREE ROLLS` : 'FREE ROLL';
    if (r.kind === 'sp') return `${r.n} SEASON XP`;
    if (r.kind === 'chest') return `CHEST: ${r.n} COINS + ${r.tokens} ROLLS`;
    if (r.kind === 'bundle') return (r.rewards || []).map((part) => this.label(part)).filter(Boolean).join(' + ');
    if (r.kind === 'item') { const it = CATALOG[r.cat].find((x) => x.id === r.id); return it ? it.name.toUpperCase() : 'EXCLUSIVE'; }
    return '';
  },

  // --------------------------------------------------------- login calendar
  calendarState() {
    const g = this.s;
    const today = dayKey();
    const avail = g.cal.last !== today;
    const yesterday = dayKey(Date.now() - DAY);
    // the streak carries on if you came back yesterday, otherwise it starts again at day 1
    const next = avail ? (g.cal.last === yesterday ? (g.cal.day % 7) + 1 : 1) : g.cal.day;
    return { avail, next, cur: g.cal.day };
  },
  claimCalendar() {
    const g = this.s;
    const st = this.calendarState();
    if (!st.avail) return null;
    g.cal = { day: st.next, last: dayKey() };
    const r = CALENDAR[st.next - 1];
    this.grant(r);
    return r;
  },

  // ---------------------------------------------------------- 7-day comeback contract
  returnContractState() {
    const g = this.s; // Normalizes daily playtime before checking eligibility.
    if (!Save.p.returnContract || !Number.isFinite(Save.p.returnContract.startAt)) {
      Save.p.returnContract = { startAt: Date.now(), claimed: [] };
      Save.save(true);
    }
    const event = Save.p.returnContract;
    const day = Math.floor((localDayStart(Date.now()) - localDayStart(event.startAt)) / DAY) + 1;
    const claimed = Array.isArray(event.claimed) ? event.claimed : [];
    const playSeconds = g.play ? (g.play.secs || 0) : 0;
    const minutesPlayed = Math.min(10, Math.floor(playSeconds / 60));
    const active = day >= 1 && day <= 7;
    const ready = active && !claimed.includes(day);
    return {
      day, active, claimedCount: claimed.length,
      complete: RETURN_CONTRACT.every((m) => claimed.includes(m.day)),
      ready, canClaim: ready && playSeconds >= 600,
      minutesPlayed, playSeconds,
      days: RETURN_CONTRACT.map((m) => ({
        ...m, claimed: claimed.includes(m.day),
        current: m.day === day,
        expired: m.day < day && !claimed.includes(m.day),
      })),
    };
  },
  claimReturnContract(day) {
    const state = this.returnContractState();
    if (!state.active || day !== state.day || !state.ready || state.playSeconds < 600) return null;
    const m = RETURN_CONTRACT.find((entry) => entry.day === day);
    if (!m) return null;
    Save.p.returnContract.claimed.push(day);
    this.grant(m.reward);
    Save.save(true);
    return m.reward;
  },

  // ----------------------------------------------------------- daily match circuit
  matchCircuitState() {
    const g = this.s.matchRun;
    return {
      count: g.count,
      target: MATCH_CIRCUIT[MATCH_CIRCUIT.length - 1].matches,
      milestones: MATCH_CIRCUIT.map((m, i) => ({
        ...m, i, claimed: g.claimed.includes(i),
        ready: g.count >= m.matches && !g.claimed.includes(i),
      })),
    };
  },
  claimMatchCircuit(i) {
    const g = this.s.matchRun;
    const m = MATCH_CIRCUIT[i];
    if (!m || g.count < m.matches || g.claimed.includes(i)) return null;
    g.claimed.push(i);
    this.grant(m.reward);
    Save.save(true);
    return m.reward;
  },

  // --------------------------------------------------------- daily challenges
  challenges() {
    return this.s.chal.list.map((c) => {
      const d = CHALLENGES.find((x) => x[0] === c.id);
      return { ...c, label: d[1], stat: d[2], target: d[3], sp: d[4], coins: d[5] };
    });
  },
  claimChallenge(id) {
    const c = this.s.chal.list.find((x) => x.id === id);
    if (!c || !c.done || c.claimed) return null;
    c.claimed = true;
    const d = CHALLENGES.find((x) => x[0] === id);
    Save.p.coins += d[5];
    this.addSp(d[4]);
    Save.save(true);
    return { sp: d[4], coins: d[5] };
  },

  // ------------------------------------------------------------- playtime
  addPlaytime(secs) {
    const g = this.s;
    g.play.secs += secs;
    if ((this._ptSave = (this._ptSave || 0) + secs) > 15) { this._ptSave = 0; Save.save(); }
  },
  playtimeState() {
    const g = this.s;
    const mins = g.play.secs / 60;
    return PLAYTIME.map((m, i) => ({ ...m, i, ready: mins >= m.min && !g.play.claimed.includes(i), claimed: g.play.claimed.includes(i) })).concat([]).map((m) => ({ ...m, mins }));
  },
  claimPlaytime(i) {
    const g = this.s;
    const m = PLAYTIME[i];
    if (!m || g.play.claimed.includes(i) || g.play.secs / 60 < m.min) return null;
    g.play.claimed.push(i);
    this.grant(m);
    return m;
  },

  // ------------------------------------------------------------- events
  // Events run Thursday 00:00 to Monday 00:00 (local time), a different one each week
  event(t = Date.now()) {
    const d = new Date(t);
    const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const dow = d.getDay(); // 0 Sun .. 6 Sat
    const sinceThu = (dow + 3) % 7; // days since the last Thursday
    const start = midnight - sinceThu * DAY;
    const end = start + 4 * DAY;
    const week = Math.floor((start - SEASON_EPOCH) / (7 * DAY));
    const ev = EVENTS[((week % EVENTS.length) + EVENTS.length) % EVENTS.length];
    if (t < end) return { ...ev, start, end, live: true };
    return null;
  },
  nextEvent(t = Date.now()) {
    const d = new Date(t);
    const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const untilThu = (4 - d.getDay() + 7) % 7 || 7;
    const start = midnight + untilThu * DAY;
    const week = Math.floor((start - SEASON_EPOCH) / (7 * DAY));
    return { ...EVENTS[((week % EVENTS.length) + EVENTS.length) % EVENTS.length], start };
  },
  mods() {
    const e = this.event();
    return { coinMul: (e && e.coinMul) || 1, itemMul: (e && e.itemMul) || 1, spMul: (e && e.spMul) || 1, tackleMul: (e && e.tackleMul) || 1 };
  },
  claimEvent() {
    const g = this.s;
    const e = this.event();
    if (!e || g.ev.claimed || g.ev.prog < e.goal.n) return null;
    g.ev.claimed = true;
    const r = { kind: 'item', cat: e.reward[0], id: e.reward[1] };
    this.grant(r);
    return r;
  },

  // ------------------------------------------------------------- tracking
  // stats: { goals, assists, saves, steals, items, win, matches }
  recordMatch(st) {
    const g = this.s;
    g.matchRun.count = Math.min(MATCH_CIRCUIT[MATCH_CIRCUIT.length - 1].matches, g.matchRun.count + 1);
    const m = this.mods();
    const bump = (stat, n) => {
      if (!n) return;
      for (const c of g.chal.list) {
        const d = CHALLENGES.find((x) => x[0] === c.id);
        if (d[2] === stat && !c.done) { c.prog = Math.min(d[3], c.prog + n); if (c.prog >= d[3]) c.done = true; }
      }
      const e = this.event();
      if (e && e.goal.stat === stat && !g.ev.claimed) g.ev.prog = Math.min(e.goal.n, g.ev.prog + n);
    };
    bump('matches', 1);
    bump('wins', st.win ? 1 : 0);
    bump('goals', st.goals || 0);
    bump('assists', st.assists || 0);
    bump('saves', st.saves || 0);
    bump('steals', st.steals || 0);
    bump('items', st.items || 0);
    if ((st.goals || 0) >= 2) bump('goalsOne', st.goals);
    const sp = (120 + (st.goals || 0) * 30 + (st.assists || 0) * 20 + (st.saves || 0) * 15 + (st.steals || 0) * 8 * m.tackleMul + (st.win ? 80 : 0)) * m.spMul;
    const tiers = this.addSp(sp);
    Save.save(true);
    return { sp: Math.round(sp), tiers };
  },

  // Anything waiting to be claimed (drives the red dots on the menu)
  pending() {
    const g = this.s;
    let pass = 0;
    for (let t = 1; t <= this.tier(g); t++) { if (this.canClaim(t, 'f', g)) pass++; if (this.canClaim(t, 'e', g)) pass++; }
    const chal = g.chal.list.filter((c) => c.done && !c.claimed).length;
    const play = this.playtimeState().filter((m) => m.ready).length;
    const e = this.event();
    const ev = e && !g.ev.claimed && g.ev.prog >= e.goal.n ? 1 : 0;
    return { pass, chal, play, ev, cal: this.calendarState().avail ? 1 : 0 };
  },

  useToken() {
    const g = this.s;
    if (g.tokens <= 0) return false;
    g.tokens -= 1;
    Save.save(true);
    return true;
  },
};

export function fmtLeft(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}D ${h}H`;
  if (h > 0) return `${h}H ${m}M`;
  return `${m}M ${s % 60}S`;
}
