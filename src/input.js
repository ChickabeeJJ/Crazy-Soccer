// Keyboard / mouse / touch input with rebindable actions.
// Uses physical key codes (event.code) so WASD automatically becomes ZQSD on AZERTY keyboards,
// and shows layout-aware labels where the browser supports navigator.keyboard.getLayoutMap().
// Browser-reserved shortcuts (Escape, Ctrl/Cmd combos, F-keys) are never captured.

const RESERVED = new Set(['Escape', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12', 'MetaLeft', 'MetaRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'ContextMenu', 'OSLeft', 'OSRight', 'PrintScreen']);
const PREVENT = new Set(['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backquote', 'Slash', 'Quote']);

export class Input {
  constructor(canvas, getBinds) {
    this.canvas = canvas;
    this.getBinds = getBinds;
    this.down = new Set();
    this.pressed = new Set();
    this.released = new Set();
    this.mdx = 0; this.mdy = 0; this.wheel = 0;
    this.locked = false;
    this.enabled = true; // game keys active
    this.capture = null;
    this.layout = null;
    this.touch = { mx: 0, mz: 0, active: false };
    this.dragging = false;
    this.lockWanted = false;
    this.listeners = { lockchange: [] };
    try {
      if (navigator.keyboard && navigator.keyboard.getLayoutMap) {
        navigator.keyboard.getLayoutMap().then((m) => { this.layout = m; }).catch(() => {});
      }
    } catch (e) { /* ignore */ }

    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => { for (const c of this.down) this.released.add(c); this.down.clear(); });
    canvas.addEventListener('mousedown', (e) => this.onMouse(e, true));
    window.addEventListener('mouseup', (e) => this.onMouse(e, false));
    window.addEventListener('mousemove', (e) => {
      if (this.locked) { this.mdx += e.movementX || 0; this.mdy += e.movementY || 0; }
      else if (this.dragging) { this.mdx += e.movementX || 0; this.mdy += e.movementY || 0; }
    });
    canvas.addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      this.listeners.lockchange.forEach((f) => f(this.locked));
    });
  }

  on(evt, f) { this.listeners[evt].push(f); }

  onKey(e, isDown) {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    const code = e.code || e.key;
    if (this.capture && isDown) {
      e.preventDefault();
      if (code === 'Escape') { const cb = this.capture; this.capture = null; cb(null); return; }
      if (RESERVED.has(code) || e.ctrlKey || e.metaKey) return;
      const cb = this.capture; this.capture = null; cb(code);
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey || RESERVED.has(code)) return; // leave browser shortcuts alone
    if (this.enabled && PREVENT.has(code)) e.preventDefault();
    if (isDown) {
      if (!this.down.has(code)) this.pressed.add(code);
      this.down.add(code);
    } else {
      this.down.delete(code);
      this.released.add(code);
    }
  }

  onMouse(e, isDown) {
    const code = `Mouse${e.button}`;
    if (this.capture && isDown && e.target === this.canvas) {
      e.preventDefault();
      const cb = this.capture; this.capture = null; cb(code);
      return;
    }
    if (isDown) {
      if (e.target !== this.canvas) return;
      if (!this.down.has(code)) this.pressed.add(code);
      this.down.add(code);
      if (!this.locked && e.button === 2) this.dragging = true;
    } else {
      if (e.button === 2) this.dragging = false;
      if (this.down.has(code)) { this.down.delete(code); this.released.add(code); }
    }
  }

  // Virtual buttons (touch UI)
  virtualDown(code) { if (!this.down.has(code)) this.pressed.add(code); this.down.add(code); }
  virtualUp(code) { if (this.down.has(code)) { this.down.delete(code); this.released.add(code); } }

  codesFor(action) {
    const b = this.getBinds();
    return [...(b[action] || []), `Touch_${action}`];
  }
  isDown(action) { return this.codesFor(action).some((c) => this.down.has(c)); }
  wasPressed(action) { return this.codesFor(action).some((c) => this.pressed.has(c)); }
  wasReleased(action) { return this.codesFor(action).some((c) => this.released.has(c)); }
  keyPressed(code) { return this.pressed.has(code); }

  endFrame() {
    this.pressed.clear();
    this.released.clear();
    this.mdx = 0; this.mdy = 0; this.wheel = 0;
  }

  requestLock() {
    if (this.locked) return;
    try {
      const p = this.canvas.requestPointerLock({ unadjustedMovement: true });
      if (p && p.catch) p.catch(() => { try { this.canvas.requestPointerLock(); } catch (e) { /* ignore */ } });
    } catch (e) {
      try { this.canvas.requestPointerLock(); } catch (e2) { /* ignore */ }
    }
  }

  exitLock() {
    if (document.pointerLockElement) { try { document.exitPointerLock(); } catch (e) { /* ignore */ } }
  }

  captureNext(cb) { this.capture = cb; }

  label(code) {
    if (!code) return '—';
    if (code.startsWith('Mouse')) return { Mouse0: 'LMB', Mouse1: 'MMB', Mouse2: 'RMB' }[code] || code;
    if (this.layout && code.startsWith('Key')) {
      const v = this.layout.get(code);
      if (v) return v.toUpperCase();
    }
    const map = { Space: 'SPACE', ShiftLeft: 'SHIFT', ShiftRight: 'SHIFT', Tab: 'TAB', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Enter: 'ENTER', Backspace: 'BKSP', CapsLock: 'CAPS', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\' };
    if (map[code]) return map[code];
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    if (code.startsWith('Numpad')) return 'N' + code.slice(6);
    return code;
  }

  actionLabel(action) {
    const b = (this.getBinds()[action] || [])[0];
    return this.label(b);
  }
}
