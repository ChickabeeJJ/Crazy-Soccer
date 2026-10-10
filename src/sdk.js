// CrazyGames HTML5 SDK v3 wrapper.
// The SDK script is loaded in index.html (https://sdk.crazygames.com/crazygames-sdk-v3.js).
// Every call is guarded so the game keeps working when the SDK is missing (local dev, offline, blocked).

const listeners = { mute: new Set(), settings: new Set(), auth: new Set() };

export const SDK = {
  ready: false,
  available: false,
  environment: 'disabled',
  settings: { muteAudio: false, disableChat: false },
  user: null,
  isMobile: false,
  _sdk: null,
  _gameplay: false,
  _adActive: false,

  async init() {
    const w = window;
    this.isMobile = detectMobile();
    if (!w.CrazyGames || !w.CrazyGames.SDK) {
      await waitFor(() => w.CrazyGames && w.CrazyGames.SDK, 2500);
    }
    if (!w.CrazyGames || !w.CrazyGames.SDK) {
      this.ready = true;
      return false;
    }
    this._sdk = w.CrazyGames.SDK;
    try {
      await withTimeout(this._sdk.init(), 6000);
      this.available = true;
      this.environment = this._sdk.environment || 'crazygames';
    } catch (e) {
      console.warn('[CrazyGames SDK] init failed, continuing without it', e);
      this.available = false;
    }
    this.ready = true;
    if (!this.available) return false;

    try {
      const s = this._sdk.game.settings || {};
      this.settings.muteAudio = !!s.muteAudio;
      this.settings.disableChat = !!s.disableChat;
      this._sdk.game.addSettingsChangeListener((ns) => {
        this.settings.muteAudio = !!ns.muteAudio;
        this.settings.disableChat = !!ns.disableChat;
        listeners.settings.forEach((f) => f(this.settings));
      });
    } catch (e) { /* ignore */ }

    try {
      const info = this._sdk.user && this._sdk.user.systemInfo;
      if (info && info.device && info.device.type) this.isMobile = info.device.type !== 'desktop';
    } catch (e) { /* ignore */ }

    await this.refreshUser();
    try {
      this._sdk.user.addAuthListener((u) => {
        this.user = u || null;
        listeners.auth.forEach((f) => f(this.user));
      });
    } catch (e) { /* ignore */ }
    return true;
  },

  async refreshUser() {
    if (!this.available) return null;
    try {
      if (this._sdk.user.isUserAccountAvailable === false) return null;
      this.user = await withTimeout(this._sdk.user.getUser(), 4000);
    } catch (e) {
      this.user = null;
    }
    return this.user;
  },

  async showAuthPrompt() {
    if (!this.available) return null;
    try {
      const u = await this._sdk.user.showAuthPrompt();
      this.user = u || this.user;
      listeners.auth.forEach((f) => f(this.user));
      return this.user;
    } catch (e) {
      return null;
    }
  },

  onSettings(f) { listeners.settings.add(f); },
  // Fired when a player who already has the game open accepts an invite (no page reload needed)
  onJoinRoom(f) {
    this._call(() => {
      if (typeof this._sdk.game.addJoinRoomListener === 'function') this._sdk.game.addJoinRoomListener((params) => f(params || {}));
    });
  },
  onAuth(f) { listeners.auth.add(f); },

  loadingStart() { this._call(() => this._sdk.game.loadingStart()); },
  loadingStop() { this._call(() => this._sdk.game.loadingStop()); },

  gameplayStart() {
    if (this._gameplay) return;
    this._gameplay = true;
    this._call(() => this._sdk.game.gameplayStart());
  },
  gameplayStop() {
    if (!this._gameplay) return;
    this._gameplay = false;
    this._call(() => this._sdk.game.gameplayStop());
  },
  happytime() { this._call(() => this._sdk.game.happytime()); },

  // ---- Multiplayer / social --------------------------------------------------
  get isInstantMultiplayer() {
    try { return !!(this.available && this._sdk.game.isInstantMultiplayer); } catch (e) { return false; }
  },
  getInviteParam(key) {
    try {
      if (this.available && this._sdk.game.getInviteParam) {
        const v = this._sdk.game.getInviteParam(key);
        if (v) return v;
      }
    } catch (e) { /* ignore */ }
    try { return new URLSearchParams(window.location.search).get(key); } catch (e) { return null; }
  },
  inviteLink(params) {
    try {
      if (this.available) return this._sdk.game.inviteLink(params);
    } catch (e) { /* ignore */ }
    const url = new URL(window.location.href);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    return url.toString();
  },
  updateRoom(room) {
    this._call(() => {
      if (typeof this._sdk.game.updateRoom === 'function') this._sdk.game.updateRoom(room);
    });
  },
  leftRoom() {
    this.updateRoom({ isJoinable: false });
  },

  // ---- Ads -----------------------------------------------------------------
  // callbacks: { onStart, onEnd } -- the game must mute audio & pause while the ad plays.
  requestAd(type, { onStart, onEnd } = {}) {
    return new Promise((resolve) => {
      if (!this.available || this._adActive) {
        resolve(false);
        return;
      }
      let started = false;
      const finish = (ok) => {
        this._adActive = false;
        if (started && onEnd) onEnd();
        resolve(ok);
      };
      try {
        this._adActive = true;
        this._sdk.ad.requestAd(type, {
          adStarted: () => { started = true; if (onStart) onStart(); },
          adFinished: () => finish(true),
          adError: () => finish(false),
        });
      } catch (e) {
        finish(false);
      }
    });
  },

  // ---- Data (cloud save for logged-in users, local otherwise) ---------------
  getItem(key) {
    try {
      if (this.available && this._sdk.data) return this._sdk.data.getItem(key);
    } catch (e) { /* ignore */ }
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  },
  setItem(key, value) {
    try {
      if (this.available && this._sdk.data) { this._sdk.data.setItem(key, value); return; }
    } catch (e) { /* ignore */ }
    try { window.localStorage.setItem(key, value); } catch (e) { /* ignore */ }
  },

  _call(fn) {
    if (!this.available) return;
    try { fn(); } catch (e) { /* SDK call failed - never break the game */ }
  },
};

function detectMobile() {
  try {
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 1;
    const ua = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    return (coarse && touch) || ua;
  } catch (e) {
    return false;
  }
}

function waitFor(cond, ms) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const tick = () => {
      if (cond() || performance.now() - t0 > ms) resolve();
      else setTimeout(tick, 50);
    };
    tick();
  });
}

function withTimeout(p, ms) {
  return Promise.race([
    Promise.resolve(p),
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)),
  ]);
}
