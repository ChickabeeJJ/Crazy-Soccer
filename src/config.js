// Central tuning values for Crazy Soccer. Units are metres-ish "studs", seconds and radians.

export const GAME_VERSION = '1.1.0';
export const SAVE_KEY = 'crazysoccer_profile_v1';

export const FIELD = {
  halfL: 48, // goal lines at x = ±halfL
  halfW: 27, // touch lines at z = ±halfW
  wallX: 53.5, // invisible/physical walls (ball and players stay inside)
  wallZ: 30,
  wallTop: 40,
  goalW: 18.5,
  goalH: 6.6,
  goalD: 5,
  boxL: 16,
  boxW: 38,
  smallBoxL: 6,
  smallBoxW: 26,
  centerR: 9,
  postR: 0.36,
};

export const MAPS = ['grass', 'desert'];

export const PHYS = {
  gravity: 32,
  ballR: 0.55,
  bounce: 0.62,
  wallBounce: 0.74,
  rollFriction: 0.42, // fraction of ground speed lost per second while rolling
  airDrag: 0.045,
  magnus: 1.0,
  netDamp: 0.25,
};

export const PLAYER = {
  radius: 0.75,
  height: 2.7,
  walkSpeed: 9.6,
  sprintSpeed: 14.2,
  withBallMul: 0.94,
  accel: 70,
  turnRate: 14,
  staminaMax: 150,
  sprintDrain: 19,
  staminaRegen: 26,
  regenDelay: 0.5,
  minSprintStamina: 12,
  pickupReach: 1.55,
  kickReach: 2.4,
  dribbleDist: 1.2,
  contestTime: 0.4,
};

export const KICK = {
  minSpeed: 20,
  maxSpeed: 50,
  chargeTime: 1.05,
  cooldown: 0.42,
  passMin: 15,
  passMax: 34,
  lobAngle: 0.88,
  lobRange: 28,
  flickUp: 12.5,
  flickFwd: 6.5,
  tackleSpeed: 18,
  tackleTime: 0.55,
  tackleCooldown: 0.9,
  diveSpeed: 13.5,
  diveTime: 0.62,
  diveCooldown: 1.6,
  dribbleCooldown: 1.5,
  jumpSpeed: 10.5,
  jumpCooldown: 0.6,
  dribbleImmune: 0.6,
  requestCooldown: 2.5,
  hitRange: 2.3,
  keeperHold: 6, // seconds a keeper may hold a caught ball before it is thrown out
};

// Stamina costs per action (stamina is the main limit, like the original): tired players kick weaker
export const STAMINA = { kickBase: 10, kickPower: 20, skill: 35, tackle: 18, jump: 10, lob: 10, flick: 10, pass: 4, tired: 30 };

export const MATCH = {
  teamSize: 4,
  duration: 360,
  mercy: 4,
  kickoffTime: 3,
  goalTime: 2.6,
  replayTime: 4.6,
  endTime: 4,
  lastChanceMax: 15,
  itemInterval: [9, 15],
  maxItems: 3,
  practiceItemInterval: [2.5, 4],
  practiceMaxItems: 6,
};

export const TEAMS = [
  { name: 'Red', color: 0xff3b5c, css: '#ff3b5c', dark: 0xb3163a, net: 0xff4f9a, light: '#ffd0da' },
  { name: 'Blue', color: 0x3b8bff, css: '#3b8bff', dark: 0x1a4fb8, net: 0x3fa9ff, light: '#d0e4ff' },
];

export const NET = {
  appPrefix: 'crazysoccer-v2-',
  // PeerJS signalling server. null = default PeerJS cloud server (0.peerjs.com).
  // To self-host: `npx peerjs --port 9000` and set { host, port, path, secure }.
  peerServer: null,
  // STUN finds a direct route between players; TURN relays traffic when strict NATs / mobile
  // carriers block direct WebRTC. Add your own TURN credentials here for production
  // (e.g. a free Metered/Cloudflare TURN account); the public Open Relay entries are a best-effort fallback.
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] },
    { urls: 'stun:global.stun.twilio.com:3478' },
    { urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turn:openrelay.metered.ca:443?transport=tcp'], username: 'openrelayproject', credential: 'openrelayproject' },
  ],
  publicRooms: 16,
  snapshotRate: 20,
  inputRate: 30,
  interpDelay: 0.11,
  joinTimeout: 10000,
  peerTimeout: 7000,
};

// Items (what the mystery cubes give). New items come from the Item Roll in the Shop;
// cubes only drop items you own.
export const ITEMS = {
  fire: { name: 'Fire Shot', color: '#ff7a1a', rarity: 'common', desc: 'Your next shot is a blazing, unstoppable fireball.' },
  speed: { name: 'Lightning Boots', color: '#7dff5a', rarity: 'common', desc: 'Super speed with endless stamina.' },
  shield: { name: 'Bubble Shield', color: '#c27bff', rarity: 'common', desc: 'Immune to tackles, hits and items for a while.' },
  punch: { name: 'Boxing Glove', color: '#ff4466', rarity: 'common', desc: 'Spring-loaded glove knocks over the rival in front of you.' },
  ice: { name: 'Ice Blast', color: '#5fe3ff', rarity: 'rare', desc: 'Throw a frost orb that freezes the first rival it hits.' },
  oil: { name: 'Oil Slick', color: '#9b6bff', rarity: 'rare', desc: 'Leave a slippery oil trail. Rivals who cross it wipe out.' },
  barricade: { name: 'Barricade', color: '#ffb000', rarity: 'rare', desc: 'Drop a fence that blocks players and the ball.' },
  grapple: { name: 'Grapple', color: '#4cf08a', rarity: 'epic', desc: 'Hook the ball from range and yank it to your feet.' },
  barrel: { name: 'Barrel Roll', color: '#3f8bff', rarity: 'epic', desc: 'Bowl a barrel that flattens every rival in its path.' },
  jet: { name: 'Jetpack', color: '#ffd23f', rarity: 'legendary', desc: 'Blast off and fly over everyone for a few seconds.' },
};
export const RARITY = {
  common: { name: 'Common', color: '#a9bdd2', refund: 40 },
  rare: { name: 'Rare', color: '#3fa9ff', refund: 80 },
  epic: { name: 'Epic', color: '#b46bff', refund: 150 },
  legendary: { name: 'Legendary', color: '#ffc93f', refund: 300 },
};
export const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary'];
// Item Roll: chance per rarity (items inside a rarity are equally likely). A new item is
// guaranteed after ROLL.pity duplicates in a row; duplicates refund coins.
export const ROLL = { cost: 250, cost5: 1100, odds: { common: 0.52, rare: 0.31, epic: 0.14, legendary: 0.03 }, pity: 5 };
export const ITEM_KINDS = Object.keys(ITEMS);

export const QUICK_CHAT = ['Pass!', 'Shoot!', 'Nice one!', 'Defend!', 'I\'m open!', 'Thanks!', 'GG', 'Wow!'];
