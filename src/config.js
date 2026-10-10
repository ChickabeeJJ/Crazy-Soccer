// Central tuning values for Crazy Soccer. Units are metres-ish "studs", seconds and radians.

export const GAME_VERSION = '1.0.0';
export const SAVE_KEY = 'crazysoccer_profile_v1';

export const FIELD = {
  halfL: 42, // goal lines at x = ±halfL
  halfW: 27, // touch lines at z = ±halfW
  wallX: 47, // invisible/physical walls (ball and players stay inside)
  wallZ: 30,
  wallTop: 40,
  goalW: 12,
  goalH: 4.2,
  goalD: 3.6,
  boxL: 14,
  boxW: 30,
  smallBoxL: 5,
  smallBoxW: 16,
  centerR: 9,
  postR: 0.22,
};

export const PHYS = {
  gravity: 28,
  ballR: 0.55,
  bounce: 0.56,
  wallBounce: 0.72,
  rollFriction: 0.55, // fraction of ground speed lost per second while rolling
  airDrag: 0.06,
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
  staminaMax: 100,
  sprintDrain: 23,
  staminaRegen: 17,
  regenDelay: 0.8,
  minSprintStamina: 12,
  pickupReach: 1.55,
  kickReach: 2.4,
  dribbleDist: 1.2,
  contestTime: 0.4,
};

export const KICK = {
  minSpeed: 19,
  maxSpeed: 47,
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
  tackleCooldown: 2.0,
  diveSpeed: 13.5,
  diveTime: 0.62,
  diveCooldown: 1.6,
  dribbleCooldown: 1.5,
  dribbleImmune: 0.6,
  requestCooldown: 2.5,
  hitRange: 2.3,
};

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
  appPrefix: 'crazysoccer-v1-',
  // PeerJS signalling server. null = default PeerJS cloud server (0.peerjs.com).
  // To self-host: `npx peerjs --port 9000` and set { host, port, path, secure }.
  peerServer: null,
  publicRooms: 16,
  snapshotRate: 20,
  inputRate: 30,
  interpDelay: 0.11,
  joinTimeout: 4500,
  peerTimeout: 7000,
};

export const ITEMS = {
  fire: { name: 'Fire Shot', icon: '🔥', color: '#ff7a1a', desc: 'Your next shot is a blazing, unstoppable fireball.' },
  ice: { name: 'Ice Blast', icon: '❄️', color: '#5fe3ff', desc: 'Throw a frost orb that freezes the first rival it hits.' },
  oil: { name: 'Oil Slick', icon: '🛢️', color: '#9b6bff', desc: 'Spill a slippery puddle. Rivals who run through it wipe out.' },
  jet: { name: 'Jetpack', icon: '🚀', color: '#ffd23f', desc: 'Blast off and fly over everyone for a few seconds.' },
  grapple: { name: 'Grapple', icon: '🪝', color: '#4cf08a', desc: 'Hook the ball from range and yank it to your feet.' },
  punch: { name: 'Boxing Glove', icon: '🥊', color: '#ff4466', desc: 'Spring-loaded glove knocks over the rival in front of you.' },
  speed: { name: 'Lightning Boots', icon: '⚡', color: '#7dff5a', desc: 'Super speed with endless stamina.' },
  shield: { name: 'Bubble Shield', icon: '🫧', color: '#c27bff', desc: 'Immune to tackles, hits and items for a while.' },
};
export const ITEM_KINDS = Object.keys(ITEMS);

export const QUICK_CHAT = ['Pass!', 'Shoot!', 'Nice one!', 'Defend!', 'I\'m open!', 'Thanks!', 'GG', 'Wow!'];
