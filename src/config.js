// Central tuning values for Crazy Soccer. Units are metres-ish "studs", seconds and radians.

export const GAME_VERSION = '1.5.0';
export const SAVE_KEY = 'crazysoccer_profile_v1';

export const FIELD = {
  halfL: 64, // goal lines at x = ±halfL
  halfW: 37, // touch lines at z = ±halfW
  wallX: 69.5, // invisible/physical walls (ball and players stay inside)
  wallZ: 40,
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
  staminaMax: 175,
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
  flickUp: 12.8,
  flickFwd: 1.6, // flick pops the ball up over your head (keeps your running speed) for volleys
  volleyReachH: 3.4, // horizontal reach for a mid-air volley
  volleyReachUp: 4.4, // how far above your feet you can volley the ball
  tackleSpeed: 18,
  tackleTime: 0.55,
  tackleCooldown: 0.9,
  diveSpeed: 13.5,
  diveTime: 0.62,
  diveCooldown: 1.6,
  dribbleCooldown: 1.5,
  jumpSpeed: 13.3,
  phaseR: 7, // a fresh shot passes through outfield players within this distance of where it was kicked
  gkStunSpeed: 15, // a keeper's throw/punt only bowls rivals over while the ball is this fast
  bikeHold: 0.9, // bicycle kick: max seconds you hang in the air aiming (release Kick to shoot sooner)
  bikeBallY: 3.8, // the ball floats up to at least this height during the hang (player hangs ~1.9 m below it)
  bikeAirY: 0.35, // you must be off the ground (jumping) to start a bicycle kick
  bikeMinH: 1.5, // ball this far above your feet (or more) turns a volley into a bicycle kick
  jumpCooldown: 0.6,
  dribbleImmune: 0.6,
  requestCooldown: 2.5,
  hitRange: 2.3,
  keeperHold: 6, // seconds a keeper may hold a caught ball before it is thrown out
};

// Stamina costs per action (stamina is the main limit, like the original): tired players kick weaker
export const STAMINA = { kickBase: 10, kickPower: 20, tackle: 18, jump: 10, lob: 10, flick: 10, pass: 4, tired: 30 };

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
  maxItems: 4,
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
  // Optional: a URL that returns a JSON array of ICE servers with fresh TURN credentials, fetched at startup.
  // e.g. Metered: 'https://<your-app>.metered.live/api/v1/turn/credentials?apiKey=<key>'
  turnCredentialsUrl: '',
  publicRooms: 16,
  snapshotRate: 20,
  inputRate: 30,
  interpDelay: 0.11,
  joinTimeout: 14000,
  peerTimeout: 7000,
};

// Items (what the mystery cubes give), matching the original game's 14 items.
// New items come from the Item Roll in the Shop; cubes only drop items you own.
export const ITEMS = {
  shield: { name: 'Forcefield', color: '#c27bff', rarity: 'common', desc: 'Blocks tackles, hits and items for a few seconds.' },
  barricade: { name: 'Barricades', color: '#ffb000', rarity: 'common', desc: 'Place a barrier that blocks players and shots.' },
  speed: { name: 'Energy Drink', color: '#7dff5a', rarity: 'common', desc: 'Refills your stamina and gives a burst of speed.' },
  oil: { name: 'Oil Spill', color: '#9b6bff', rarity: 'common', desc: 'Spill oil behind you. Rivals who run through it slip over.' },
  banana: { name: 'Banana Peel', color: '#ffe14a', rarity: 'common', desc: 'Drop a banana peel. The first rival to step on it slips over.' },
  shotgun: { name: 'Shotgun', color: '#ff8a3d', rarity: 'uncommon', desc: 'Close-range blast that knocks down rivals in front of you.' },
  grapple: { name: 'Grappling Hook', color: '#4cf08a', rarity: 'uncommon', desc: 'Hook the ball and zip yourself to it.' },
  magnet: { name: 'Magnet', color: '#ff4d6d', rarity: 'uncommon', desc: 'Pulls a loose ball towards you for a few seconds.' },
  stomp: { name: 'Shockwave', color: '#ff7a3d', rarity: 'uncommon', desc: 'Slam the ground and knock down every rival around you.' },
  mines: { name: 'Landmines', color: '#e8e04a', rarity: 'uncommon', desc: 'Drop a mine. The first rival to step on it gets launched.' },
  punch: { name: 'Rocket Punch', color: '#ff4466', rarity: 'rare', desc: 'Fire a rocket fist that sends the first rival it hits flying.' },
  fire: { name: 'Supercharge', color: '#38e1ff', rarity: 'rare', desc: 'Your next shot is supercharged: much faster and knocks over anyone in its path.' },
  blink: { name: 'Blink', color: '#7d6bff', rarity: 'rare', desc: 'Teleport a short way forward, ball and all.' },
  giant: { name: 'Titan', color: '#ff5a36', rarity: 'rare', desc: 'Grow huge for a few seconds: you can\'t be tackled and you bowl rivals over.' },
  flintlock: { name: 'Flintlock', color: '#c9a36a', rarity: 'rare', desc: 'Long-range pistol shot that knocks down the first rival it hits.' },
  ice: { name: 'Freeze Gun', color: '#5fe3ff', rarity: 'epic', desc: 'Shoot a freeze ray that freezes the first rival it hits.' },
  warp: { name: 'Time Warp', color: '#3de0c0', rarity: 'epic', desc: 'Slow down every rival near you for a few seconds.' },
  bazooka: { name: 'Bazooka', color: '#7d8b4a', rarity: 'epic', desc: 'Fire a rocket that explodes and blasts back everyone nearby.' },
  jet: { name: 'Jetpack', color: '#ffd23f', rarity: 'mythic', desc: 'Fly over everyone for a few seconds.' },
};
export const RARITY = {
  common: { name: 'Common', color: '#a9bdd2', refund: 30 },
  uncommon: { name: 'Uncommon', color: '#4fd18b', refund: 60 },
  rare: { name: 'Rare', color: '#3fa9ff', refund: 110 },
  epic: { name: 'Epic', color: '#b46bff', refund: 180 },
  mythic: { name: 'Mythic', color: '#ff5a5a', refund: 400 },
};
export const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'mythic'];
// Item Roll: chance per rarity (items inside a rarity are equally likely), close to the
// original's rates (Forcefield ~11.5%, Shotgun/Grapple ~7.5%, Rocket Punch ~5.3%, Freeze Gun/Bazooka 3.5%, Jetpack 1%).
// A new item is guaranteed after ROLL.pity duplicates in a row; duplicates refund coins.
export const ROLL = { cost: 250, cost5: 1100, odds: { common: 0.46, uncommon: 0.30, rare: 0.16, epic: 0.07, mythic: 0.01 }, pity: 5, noDupeRolls: 3, dupeRefund: 75, minEnabled: 3 };
export const ITEM_KINDS = Object.keys(ITEMS);

export const QUICK_CHAT = ['Pass!', 'Shoot!', 'Nice one!', 'Defend!', 'I\'m open!', 'Thanks!', 'GG', 'Wow!'];
