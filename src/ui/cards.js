// Player cards: collectible card designs shown after you score (and in your inventory).
// Each design is pure CSS (gradients / patterns / animated foil), so there are no image files.
export const CARD_RARITY = {
  common: { name: 'COMMON', color: '#9aa3b8' },
  rare: { name: 'RARE', color: '#3b8bff' },
  epic: { name: 'EPIC', color: '#b06bff' },
  legend: { name: 'LEGENDARY', color: '#ffb21f' },
  mythic: { name: 'MYTHIC', color: '#ff3b5c' },
};

export const CARDS = [
  { id: 'basic', name: 'Matchday', rarity: 'common' },
  { id: 'steel', name: 'Brushed Steel', rarity: 'common' },
  { id: 'mint', name: 'Mint Fresh', rarity: 'common' },
  { id: 'coral', name: 'Coral Reef', rarity: 'common' },
  { id: 'blueprint', name: 'Blueprint', rarity: 'rare' },
  { id: 'waves', name: 'Wavy Steel', rarity: 'rare' },
  { id: 'marble', name: 'Marble Royale', rarity: 'rare' },
  { id: 'pearl', name: 'Pearl Chrome', rarity: 'epic' },
  { id: 'cosmic', name: 'Cosmic Marble', rarity: 'epic' },
  { id: 'wildfire', name: 'Wildfire Sky', rarity: 'epic' },
  { id: 'holo', name: 'Holo Foil', rarity: 'legend' },
  { id: 'blackhole', name: 'Black Hole', rarity: 'legend' },
  { id: 'crown', name: 'Golden Crown', rarity: 'mythic' },
];
export const cardDef = (id) => CARDS.find((c) => c.id === id) || CARDS[0];

// Card rolls: standard and premium odds (mythic cards only come from premium rolls)
export const CARD_ROLLS = {
  std: { name: 'STANDARD', cost: 120, cost10: 1080, odds: { common: 0.7, rare: 0.22, epic: 0.07, legend: 0.01, mythic: 0 } },
  prem: { name: 'PREMIUM', cost: 360, cost10: 3240, odds: { common: 0.3, rare: 0.4, epic: 0.22, legend: 0.07, mythic: 0.01 } },
};
export const CARD_DUPE_REFUND = 0.3;

export function rollCard(kind) {
  const odds = CARD_ROLLS[kind].odds;
  let r = Math.random(), rarity = 'common';
  for (const k of ['mythic', 'legend', 'epic', 'rare', 'common']) { if (r < odds[k]) { rarity = k; break; } r -= odds[k]; }
  const pool = CARDS.filter((c) => c.rarity === rarity);
  return pool[Math.floor(Math.random() * pool.length)];
}

// Build a card element. opts: { cardId, name, stats: [goals, assists, saves], avatar (canvas) }
export function makeCard(opts) {
  const def = cardDef(opts.cardId);
  const el = document.createElement('div');
  el.className = `pcard pc-${def.id} pr-${def.rarity}`;
  const [g = 0, a = 0, s = 0] = opts.stats || [];
  el.innerHTML = `<div class="pcard-bg"></div><div class="pcard-foil"></div>
    <div class="pcard-av"></div>
    <div class="pcard-plate"><b>${esc(opts.name || 'Player')}</b>
      <div class="pcard-st"><span><em>${g}</em>GOALS</span><span><em>${a}</em>ASSISTS</span><span><em>${s}</em>SAVES</span></div></div>`;
  if (opts.avatar) el.querySelector('.pcard-av').appendChild(opts.avatar);
  return el;
}

function esc(t) { return String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

