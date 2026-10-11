// Cosmetic catalogue. Everything is unlocked with coins earned by playing (no real-money purchases).

export const SKIN_TONES = ['#ffdcc0', '#f4c49c', '#e0a878', '#b77b4f', '#8a5634', '#5e3a22'];
export const HAIR_COLORS = ['#2b1d16', '#6b3f1f', '#e8b04a', '#f2f2f2', '#ff5f8f', '#4fc3ff', '#7c4dff', '#ff8a1f', '#3ddc84'];

export const CATALOG = {
  hair: [
    { id: 'spiky', name: 'Spiky', price: 0 },
    { id: 'bob', name: 'Bob', price: 0 },
    { id: 'cap', name: 'Backwards Cap', price: 120 },
    { id: 'mohawk', name: 'Mohawk', price: 200 },
    { id: 'buns', name: 'Space Buns', price: 200 },
    { id: 'afro', name: 'Big Curls', price: 250 },
    { id: 'beanie', name: 'Beanie', price: 300 },
    { id: 'crown', name: 'Champion Crown', price: 1200 },
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

export const TAB_LABELS = { jersey: 'Jerseys', ball: 'Balls', goalfx: 'Goal Effects', emote: 'Emotes', hair: 'Style' };

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
    jersey: CATALOG.jersey[Math.floor(rng() * 5)].id,
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
