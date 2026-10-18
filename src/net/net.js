// Peer-to-peer multiplayer transport (WebRTC data channels via PeerJS).
// One player hosts the room (authoritative simulation); others connect as clients.
// No custom server is required: matchmaking uses well-known room ids on the PeerJS signalling server.
import { Peer } from 'peerjs';
import { NET, GAME_VERSION } from '../config.js';

function peerOptions() {
  const o = { debug: 0, config: { iceServers: NET.iceServers, iceCandidatePoolSize: 2 }, pingInterval: 4000 };
  if (NET.peerServer) Object.assign(o, NET.peerServer);
  // Developer override for testing against a local signalling server: ?peerserver=localhost:9000
  try {
    const ov = new URLSearchParams(window.location.search).get('peerserver');
    if (ov) {
      const [host, port] = ov.split(':');
      Object.assign(o, { host, port: Number(port) || 9000, path: '/', secure: false });
    }
  } catch (e) { /* ignore */ }
  return o;
}

export function roomPeerId(kind, code) {
  return `${NET.appPrefix}${kind}-${code}`.toLowerCase();
}

export function randomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

// Fresh TURN credentials (optional, NET.turnCredentialsUrl): fetched once and added in front of the defaults
let iceReady = null;
function loadIce() {
  if (iceReady) return iceReady;
  iceReady = (async () => {
    if (!NET.turnCredentialsUrl) return;
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 3500);
      const res = await fetch(NET.turnCredentialsUrl, { signal: ctl.signal });
      clearTimeout(t);
      const list = await res.json();
      if (Array.isArray(list) && list.length) NET.iceServers = [...list, ...NET.iceServers];
    } catch (e) { /* keep the defaults */ }
  })();
  return iceReady;
}

async function openPeer(id) {
  await loadIce();
  return new Promise((resolve, reject) => {
    let done = false;
    let peer;
    try {
      peer = id ? new Peer(id, peerOptions()) : new Peer(peerOptions());
    } catch (e) {
      reject(e);
      return;
    }
    const to = setTimeout(() => {
      if (done) return;
      done = true;
      try { peer.destroy(); } catch (e) { /* ignore */ }
      reject(new Error('peer-timeout'));
    }, NET.peerTimeout);
    peer.on('open', () => {
      if (done) return;
      done = true;
      clearTimeout(to);
      resolve(peer);
    });
    peer.on('error', (err) => {
      if (done) return;
      done = true;
      clearTimeout(to);
      try { peer.destroy(); } catch (e) { /* ignore */ }
      reject(err);
    });
  });
}

// A signalling connection opened while the player is still in the menu, so joining a match
// doesn't have to wait for it. The next Net that needs a client peer takes it over.
let warm = null;
export function prewarmNet() {
  if (warm) return;
  warm = openPeer(null).catch(() => null);
  warm.then((p) => { if (!p) warm = null; else p.on('close', () => { warm = null; }); });
}
async function takeWarmPeer() {
  if (!warm) return null;
  const p = await warm;
  warm = null;
  return p && !p.destroyed && !p.disconnected ? p : null;
}

export class Net {
  constructor() {
    this.peer = null; // host peer (owns the room id)
    this.cpeer = null; // client peer (anonymous id, used to join rooms)
    this.isHost = false;
    this.roomId = null;
    this.conns = new Map(); // host: peerId -> conn
    this.hostConn = null; // client: connection to host
    this.handlers = { message: null, join: null, leave: null, hostLost: null, hello: null };
    this._joinWaiters = new Map();
    this.closed = false;
  }

  on(evt, fn) { this.handlers[evt] = fn; }

  // ---------------------------------------------------------------- host
  async host(peerRoomId) {
    const peer = await openPeer(peerRoomId);
    if (this.closed) {
      try { peer.destroy(); } catch (e) { /* ignore */ }
      throw new Error('closed');
    }
    this.peer = peer;
    this.isHost = true;
    this.roomId = peerRoomId;
    this.peer.on('connection', (conn) => this._incoming(conn));
    this.peer.on('disconnected', () => {
      // Lost signalling server; keep existing data connections, try to reconnect for new joiners.
      if (!this.closed) setTimeout(() => { try { this.peer.reconnect(); } catch (e) { /* ignore */ } }, 2000);
    });
    this.peer.on('error', () => { /* non-fatal for a running host */ });
    return true;
  }

  _incoming(conn) {
    // Closing a room stops admissions immediately, even during the graceful transport shutdown.
    if (this.closed) { try { conn.close(); } catch (e) { /* ignore */ } return; }
    let accepted = false;
    const kill = setTimeout(() => { if (!accepted) try { conn.close(); } catch (e) { /* ignore */ } }, 8000);
    conn.on('data', (msg) => {
      if (!msg || typeof msg !== 'object') return;
      if (!accepted) {
        if (msg.t !== 'hello') return;
        clearTimeout(kill);
        const reply = this.handlers.hello ? this.handlers.hello(conn.peer, msg) : { t: 'reject', why: 'closed' };
        try { conn.send(reply); } catch (e) { /* ignore */ }
        if (reply.t === 'w') {
          accepted = true;
          this.conns.set(conn.peer, conn);
          if (this.handlers.join) this.handlers.join(conn.peer, msg);
        } else {
          setTimeout(() => { try { conn.close(); } catch (e) { /* ignore */ } }, 300);
        }
        return;
      }
      if (msg.t === 'bye') { try { conn.close(); } catch (e) { /* ignore */ } this._dropConn(conn.peer); return; }
      if (this.handlers.message) this.handlers.message(conn.peer, msg);
    });
    conn.on('close', () => this._dropConn(conn.peer));
    conn.on('error', () => this._dropConn(conn.peer));
  }

  _dropConn(peerId) {
    if (!this.conns.has(peerId)) return;
    this.conns.delete(peerId);
    if (this.handlers.leave) this.handlers.leave(peerId);
  }

  send(peerId, msg) {
    const c = this.conns.get(peerId);
    if (c && c.open) { try { c.send(msg); } catch (e) { /* ignore */ } }
  }

  broadcast(msg, except) {
    for (const [id, c] of this.conns) {
      if (id === except || !c.open) continue;
      try { c.send(msg); } catch (e) { /* ignore */ }
    }
  }

  // -------------------------------------------------------------- client
  async ensureClientPeer() {
    if (this.closed) throw new Error('closed');
    if (this.cpeer && !this.cpeer.destroyed && !this.cpeer.disconnected) return this.cpeer;
    if (!this._cpeerP) {
      this._cpeerP = (async () => (await takeWarmPeer()) || openPeer(null))();
    }
    try { this.cpeer = await this._cpeerP; } finally { this._cpeerP = null; }
    if (this.closed) {
      try { if (this.cpeer) this.cpeer.destroy(); } catch (e) { /* ignore */ }
      this.cpeer = null;
      throw new Error('closed');
    }
    this.cpeer.on('error', (err) => {
      if (err && err.type === 'peer-unavailable') {
        const m = /peer\s+(\S+)/i.exec(err.message || '');
        const target = m ? m[1].toLowerCase() : null;
        for (const [rid, w] of this._joinWaiters) {
          if (!target || rid === target) w.fail('unavailable');
        }
      }
    });
    return this.cpeer;
  }

  // Try joining one room. Resolves {ok:true, conn, welcome} or {ok:false, why}.
  tryJoin(peerRoomId, hello) {
    return new Promise((resolve) => {
      let finished = false;
      let conn = null;
      const finish = (res) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        this._joinWaiters.delete(peerRoomId);
        if (!res.ok && conn) { try { conn.close(); } catch (e) { /* ignore */ } }
        resolve(res);
      };
      const timer = setTimeout(() => finish({ ok: false, why: 'timeout' }), NET.joinTimeout);
      this._joinWaiters.set(peerRoomId, { fail: (why) => finish({ ok: false, why }) });
      try {
        conn = this.cpeer.connect(peerRoomId, { serialization: 'json', reliable: true });
      } catch (e) {
        finish({ ok: false, why: 'error' });
        return;
      }
      if (!conn) { finish({ ok: false, why: 'error' }); return; }
      conn.on('open', () => {
        try { conn.send({ ...hello, t: 'hello', ver: GAME_VERSION }); } catch (e) { finish({ ok: false, why: 'error' }); }
      });
      conn.on('data', (msg) => {
        if (finished) return;
        if (msg && msg.t === 'w') finish({ ok: true, conn, welcome: msg, room: peerRoomId });
        else if (msg && (msg.t === 'full' || msg.t === 'reject')) finish({ ok: false, why: msg.why || 'full' });
      });
      conn.on('error', () => finish({ ok: false, why: 'error' }));
      conn.on('close', () => finish({ ok: false, why: 'closed' }));
    });
  }

  attachHost(conn) {
    this.hostConn = conn;
    this.isHost = false;
    conn.on('data', (msg) => {
      if (msg && typeof msg === 'object' && this.handlers.message) this.handlers.message('host', msg);
    });
    const lost = () => {
      if (this.closed || this.hostConn !== conn) return;
      this.hostConn = null;
      if (this.handlers.hostLost) this.handlers.hostLost();
    };
    conn.on('close', lost);
    conn.on('error', lost);
  }

  sendHost(msg) {
    const c = this.hostConn;
    if (c && c.open) { try { c.send(msg); } catch (e) { /* ignore */ } }
  }

  // Join a specific private room by code.
  async joinPrivate(code, hello) {
    await this.ensureClientPeer();
    let res = await this.tryJoin(roomPeerId('priv', code), hello);
    // slow networks / busy devices: a room that didn't answer in time gets one more try
    if (!res.ok && res.why === 'timeout') res = await this.tryJoin(roomPeerId('priv', code), hello);
    if (res.ok) { this.attachHost(res.conn); this.roomId = res.room; }
    return res;
  }

  // Quick play: walk the public room ids in order. Claiming a free id makes us its host
  // (instant); an id that is already taken belongs to a live host, so we try to join it.
  async quickPlay(hello, onStatus) {
    // Room IDs are allocated on demand: full/ended rooms are skipped, and the first
    // free ID becomes a brand-new match. There is no fixed server-count ceiling.
    const clientReady = this.ensureClientPeer().then(() => true, () => false);
    for (let k = 1; ; k++) {
      if (this.closed) throw new Error('closed');
      if (onStatus) onStatus(k === 1 ? 'Finding a match…' : `Checking room ${k}…`);
      const rid = roomPeerId('pub', k);
      try {
        if (this.peer) { try { this.peer.destroy(); } catch (e) { /* ignore */ } this.peer = null; }
        await this.host(rid);
        // We own a public room: the spare client connection goes back to the warm pool
        clientReady.then(() => { if (!this.closed && this.cpeer && !warm) { const c = this.cpeer; this.cpeer = null; warm = Promise.resolve(c); } });
        return { role: 'host', k };
      } catch (e) {
        this.isHost = false;
        if (!e || e.type !== 'unavailable-id') throw e || new Error('network'); // signalling unreachable
      }
      if (!(await clientReady)) await this.ensureClientPeer();
      let res = await this.tryJoin(rid, hello);
      // A live room that was slow to answer (busy host / slow network) gets one more try
      if (!res.ok && res.why === 'timeout') {
        if (onStatus) onStatus('Connecting to the match…');
        res = await this.tryJoin(rid, hello);
      }
      if (res.ok) {
        this.attachHost(res.conn);
        this.roomId = res.room;
        return { role: 'client', welcome: res.welcome, k };
      }
    }
    throw new Error('no-room');
  }

  async hostPrivate(code) {
    if (this.peer) { try { this.peer.destroy(); } catch (e) { /* ignore */ } this.peer = null; }
    await this.host(roomPeerId('priv', code));
    return true;
  }

  destroyPeer() {
    for (const p of [this.peer, this.cpeer]) if (p) { try { p.destroy(); } catch (e) { /* ignore */ } }
    this.peer = null;
    this.cpeer = null;
  }

  // Retire an ended host room: reject new joins immediately, but let the final
  // score/events drain over existing data channels before disconnecting everyone.
  retire() {
    if (this.closed) return;
    this.closed = true;
    setTimeout(() => this.finishClose(), 300);
  }

  finishClose() {
    try {
      if (this.hostConn) { this.hostConn.send({ t: 'bye' }); this.hostConn.close(); }
    } catch (e) { /* ignore */ }
    for (const c of this.conns.values()) { try { c.close(); } catch (e) { /* ignore */ } }
    this.conns.clear();
    this.hostConn = null;
    setTimeout(() => this.destroyPeer(), 200);
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.finishClose();
  }
}
