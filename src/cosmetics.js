// Cosmetic catalogue. Everything is unlocked with coins earned by playing (no real-money purchases).

export const SKIN_TONES = ['#ffdcc0', '#f4c49c', '#e0a878', '#b77b4f', '#8a5634', '#5e3a22'];
export const EYE_COLORS = ['#6b4423', '#3f7fd0', '#3f9a5a', '#9a7a3a', '#6f7a8a'];
export const HAIR_COLORS = ['#2b1d16', '#6b3f1f', '#e8b04a', '#f2f2f2', '#ff5f8f', '#4fc3ff', '#7c4dff', '#ff8a1f', '#3ddc84', '#a8381c', '#efe0b0', '#8f96a6'];

export const CATALOG = {
  hair: [
    { id: 'spiky', name: 'Spiky', price: 0 },
    { id: 'bob', name: 'Bob', price: 0 },
    { id: 'cap', name: 'Backwards Cap', price: 120 },
    { id: 'mohawk', name: 'Mohawk', price: 200 },
    { id: 'buns', name: 'Space Buns', price: 200 },
    { id: 'afro', name: 'Big Curls', price: 250 },
    { id: 'beanie', name: 'Beanie', price: 300 },
    { id: 'buzz', name: 'Buzz Cut', price: 100 },
    { id: 'quiff', name: 'Quiff', price: 200 },
    { id: 'curtains', name: 'Curtains', price: 200 },
    { id: 'ponytail', name: 'Ponytail', price: 250 },
    { id: 'manbun', name: 'Man Bun', price: 250 },
    { id: 'cornrows', name: 'Cornrows', price: 300 },
    { id: 'long', name: 'Long Hair', price: 350 },
    { id: 'dreads', name: 'Dreads', price: 400 },
    { id: 'crown', name: 'Champion Crown', price: 1200 },
  ],
  boots: [
    { id: 'classic', name: 'Classic', price: 0, base: '#23202e', accent: '#ffffff', sole: '#e8e4ef' },
    { id: 'volt', name: 'Pink Volt', price: 200, base: '#e8277d', accent: '#b6ff3b', sole: '#2a2433' },
    { id: 'ice', name: 'Ice White', price: 200, base: '#f2f4fa', accent: '#3fb8ff', sole: '#3fb8ff' },
    { id: 'lava', name: 'Lava', price: 300, base: '#1d1416', accent: '#ff5a1f', sole: '#ff5a1f' },
    { id: 'toxic', name: 'Toxic', price: 300, base: '#3ddc84', accent: '#1d1f2b', sole: '#f4ff4f' },
    { id: 'royal', name: 'Royal', price: 350, base: '#2346c8', accent: '#ffcf3f', sole: '#ffffff' },
    { id: 'galaxy', name: 'Galaxy', price: 500, base: '#3a1d7a', accent: '#ff7ae0', sole: '#9ad8ff' },
    { id: 'gold', name: 'Golden Boot', price: 900, base: '#ffc93a', accent: '#ffffff', sole: '#b8860b' },
    // Exclusives: earned from the Season Pass and limited-time events only
    { id: 'phantom', name: 'Phantom', price: 0, excl: 'pass', base: '#0d0d12', accent: '#39ff88', sole: '#39ff88' },
    { id: 'aurora', name: 'Aurora', price: 0, excl: 'pass', base: '#1fd6c8', accent: '#ff5ad1', sole: '#ffffff' },
    { id: 'champion', name: 'Champion', price: 0, excl: 'event', base: '#ffffff', accent: '#ffcf3f', sole: '#ffcf3f' },
    { id: 'ember', name: 'Ember', price: 0, excl: 'event', base: '#ff3d00', accent: '#1a1010', sole: '#ffb300' },
    { id: 'comeback_gold', name: 'Golden Comeback', price: 0, excl: 'return-contract', base: '#b87b10', accent: '#fff1a6', sole: '#4a1f85' },
    { id: 'comeback_gold', name: 'Golden Comeback', price: 0, excl: 'return-contract', base: '#b87b10', accent: '#fff1a6', sole: '#4a1f85' },
  ],
  jersey: [
    { id: 'classic', name: 'Classic', price: 0 },
    { id: 'stripes', name: 'Stripes', price: 150 },
    { id: 'hoops', name: 'Hoops', price: 200 },
    { id: 'sash', name: 'Sash', price: 250 },
    { id: 'gradient', name: 'Sunset Fade', price: 300 },
    { id: 'stars', name: 'All Stars', price: 450 },
    { id: 'lightning', name: 'Lightning', price: 550 },
    { id: 'checks', name: 'Checkers', price: 650 },
    { id: 'flames', name: 'Inferno', price: 0, excl: 'pass' },
    { id: 'galaxyk', name: 'Nebula', price: 0, excl: 'pass' },
    { id: 'neon', name: 'Neon Grid', price: 0, excl: 'pass' },
    { id: 'carbon', name: 'Carbon', price: 0, excl: 'pass' },
    { id: 'camo', name: 'Night Camo', price: 0, excl: 'event' },
    { id: 'daybreak_royal', name: 'Daybreak Sovereign', price: 0, excl: 'return-contract' },
    { id: 'daybreak_royal', name: 'Daybreak Sovereign', price: 0, excl: 'return-contract' },
  ],
  ball: [
    { id: 'classic', name: 'Classic', price: 0, a: '#ffffff', b: '#1d1d24' },
    { id: 'neon', name: 'Neon Pop', price: 200, a: '#f4ff4f', b: '#ff2fa8' },
    { id: 'beach', name: 'Beach Ball', price: 250, a: '#ffffff', b: '#ff6a3d', stripes: true },
    { id: 'watermelon', name: 'Watermelon', price: 300, a: '#ff4d6d', b: '#1d8a3a', stripes: true },
    { id: 'ice', name: 'Frost', price: 450, a: '#dff8ff', b: '#3fb8ff' },
    { id: 'lava', name: 'Lava', price: 500, a: '#2a0f0a', b: '#ff6a00', glow: true },
    { id: 'galaxy', name: 'Galaxy', price: 650, a: '#1b1046', b: '#b388ff', glow: true },
    { id: 'golden', name: 'Golden', price: 900, a: '#ffd54a', b: '#b8860b', metal: true },
    { id: 'plasma', name: 'Plasma', price: 0, excl: 'pass', a: '#10204a', b: '#38e1ff', glow: true },
    { id: 'diamond', name: 'Diamond', price: 0, excl: 'pass', a: '#eef8ff', b: '#9ad8ff', metal: true },
    { id: 'eclipse', name: 'Eclipse', price: 0, excl: 'event', a: '#120a1e', b: '#ff7a1a', glow: true },
  ],
  goalfx: [
    { id: 'confetti', name: 'Confetti', price: 0 },
    { id: 'hearts', name: 'Hearts', price: 300 },
    { id: 'fireworks', name: 'Fireworks', price: 400 },
    { id: 'frost', name: 'Frost Burst', price: 450 },
    { id: 'lightning', name: 'Thunder', price: 600 },
    { id: 'blackhole', name: 'Black Hole', price: 900 },
  ],
  emote: [
    { id: 'wave', name: 'Wave', price: 0 },
    { id: 'clap', name: 'Clap', price: 0 },
    { id: 'bow', name: 'Bow', price: 150 },
    { id: 'flex', name: 'Flex', price: 200 },
    { id: 'cheer', name: 'Jumping Jacks', price: 200 },
    { id: 'dance', name: 'Groove', price: 250 },
    { id: 'laugh', name: 'Laugh', price: 250 },
    { id: 'spin', name: 'Spin', price: 300 },
    { id: 'robot', name: 'Robot', price: 400 },
    { id: 'sit', name: 'Chill', price: 100 },
  ],
};

export const TAB_LABELS = { jersey: 'Jerseys', boots: 'Boots', ball: 'Balls', goalfx: 'Goal Effects', emote: 'Emotes', hair: 'Style' };

export function findItem(cat, id) {
  return CATALOG[cat].find((x) => x.id === id) || CATALOG[cat][0];
}

// Bot names look like real players' usernames on a web games site
const BOT_NAMES = ['jayden_fc', 'xNoahx', 'lucas2011', 'Kai_Plays', 'mia.goals', 'ProStriker99', 'notbrandon', 'Zyrox', 'ethan_ttv', 'dribblekingg', 'ItzAiden', 'sofiaa_7', 'ggLeo', 'Mateo_10', 'TheRealOwen', 'chloe.xo', 'Rafa_9', 'swiftyy', 'Nathan_YT', 'goalmachine14', 'vexx', 'liam.exe', 'ArloBallin', 'Zara_K', 'MaxPower07', 'k1lianfan', 'oscar_gg', 'Ruby_rb', 'n0vaStorm', 'theo_2010', 'jules.fc', 'Yassin_7', 'FinnTheFast', 'ellie_plays', 'Dexterr', 'carterz', 'Iker_GK', 'ninja_ronin', 'Ayaan10', 'benjixd'];
let botOrder = null;
export function botName(i) {
  if (!botOrder) { botOrder = BOT_NAMES.map((n, k) => [Math.random(), n]).sort((a, b) => a[0] - b[0]).map((x) => x[1]); }
  return botOrder[i % botOrder.length];
}

export function randomCosmetics(rng = Math.random) {
  const hairs = CATALOG.hair;
  return {
    skin: Math.floor(rng() * SKIN_TONES.length),
    hair: hairs[Math.floor(rng() * hairs.length)].id,
    hairColor: Math.floor(rng() * HAIR_COLORS.length),
    eyeColor: Math.floor(rng() * EYE_COLORS.length),
    jersey: CATALOG.jersey[Math.floor(rng() * 5)].id,
    boots: CATALOG.boots[Math.floor(rng() * 6)].id,
    ball: 'classic',
    goalfx: CATALOG.goalfx[Math.floor(rng() * 4)].id,
    number: 2 + Math.floor(rng() * 97),
  };
}

const ADJ = ['Swift', 'Lucky', 'Mighty', 'Sneaky', 'Turbo', 'Cosmic', 'Funky', 'Jolly', 'Brave', 'Zippy', 'Sunny', 'Wild'];
const NOUN = ['Fox', 'Panda', 'Comet', 'Tiger', 'Otter', 'Rocket', 'Falcon', 'Koala', 'Dragon', 'Shark', 'Llama', 'Yeti'];
export function guestName() {
  return ADJ[Math.floor(Math.random() * ADJ.length)] + NOUN[Math.floor(Math.random() * NOUN.length)] + Math.floor(10 + Math.random() * 89);
}
