// Peer-to-peer multiplayer transport (WebRTC data channels via PeerJS).
// One player hosts the room (authoritative simulation); others connect as clients.
// No custom server is required: matchmaking uses well-known room ids on the PeerJS signalling server.
import { Peer } from 'peerjs';
import { NET, GAME_VERSION } from '../config.js';

const ICE = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
  ],
};

function peerOptions() {
  const o = { debug: 0, config: ICE, pingInterval: 4000 };
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

function openPeer(id) {
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

export class Net {
  constructor() {
    this.peer = null;
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
    this.peer = await openPeer(peerRoomId);
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
    if (this.peer && !this.peer.destroyed && !this.isHost) return this.peer;
    this.peer = await openPeer(null);
    this.peer.on('error', (err) => {
      if (err && err.type === 'peer-unavailable') {
        const m = /peer\s+(\S+)/i.exec(err.message || '');
        const target = m ? m[1].toLowerCase() : null;
        for (const [rid, w] of this._joinWaiters) {
          if (!target || rid === target) w.fail('unavailable');
        }
      }
    });
    return this.peer;
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
        conn = this.peer.connect(peerRoomId, { serialization: 'json', reliable: true });
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
    const res = await this.tryJoin(roomPeerId('priv', code), hello);
    if (res.ok) { this.attachHost(res.conn); this.roomId = res.room; }
    return res;
  }

  // Quick play: join the first public room with space, otherwise host the lowest free room id.
  async quickPlay(hello, onStatus) {
    await this.ensureClientPeer();
    const N = NET.publicRooms;
    for (let i = 1; i <= N; i += 4) {
      const batch = [];
      for (let k = i; k < i + 4 && k <= N; k++) batch.push(k);
      if (onStatus) onStatus(`Searching rooms ${batch[0]}-${batch[batch.length - 1]}…`);
      const results = await Promise.all(batch.map((k) => this.tryJoin(roomPeerId('pub', k), hello).then((r) => ({ ...r, k }))));
      const good = results.filter((r) => r.ok).sort((a, b) => a.k - b.k);
      if (good.length) {
        const pick = good[0];
        for (const r of good.slice(1)) { try { r.conn.send({ t: 'bye' }); r.conn.close(); } catch (e) { /* ignore */ } }
        this.attachHost(pick.conn);
        this.roomId = pick.room;
        return { role: 'client', welcome: pick.welcome, k: pick.k };
      }
      const empty = results.filter((r) => r.why === 'unavailable').map((r) => r.k).sort((a, b) => a - b);
      for (const k of empty) {
        try {
          this.destroyPeer();
          await this.host(roomPeerId('pub', k));
          return { role: 'host', k };
        } catch (e) {
          // Someone claimed it at the same moment - keep searching.
          this.isHost = false;
          await this.ensureClientPeer();
        }
      }
    }
    throw new Error('no-room');
  }

  async hostPrivate(code) {
    this.destroyPeer();
    await this.host(roomPeerId('priv', code));
    return true;
  }

  destroyPeer() {
    if (this.peer) { try { this.peer.destroy(); } catch (e) { /* ignore */ } }
    this.peer = null;
  }

  close() {
    this.closed = true;
    try {
      if (this.hostConn) { this.hostConn.send({ t: 'bye' }); this.hostConn.close(); }
    } catch (e) { /* ignore */ }
    for (const c of this.conns.values()) { try { c.close(); } catch (e) { /* ignore */ } }
    this.conns.clear();
    this.hostConn = null;
    setTimeout(() => this.destroyPeer(), 200);
  }
}
