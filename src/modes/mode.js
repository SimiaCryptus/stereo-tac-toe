// Base class / interface for interactive stereo game modes.
//
// A mode owns its state, rasterizes itself into the depth buffer and reacts
// to canvas-space pointer events and keyboard events. Every handler returns
// true when the scene changed and a redraw is needed. Modes never touch the
// DOM; the only "text" channel is statusText(), shown outside the image.

export class Mode {
  static id = 'mode';
  static label = 'Mode';
  static help = '';

  reset() {}

  // dt: seconds since last frame, now: seconds. Return true if dirty.
  update(dt, now) {
    return false;
  }

  // Write depth (0 far .. 1 near) for every pixel.
  render(buf, width, height) {
    buf.fill(0);
  }

  onMove(x, y) {
    return false;
  }
  onLeave() {
    return false;
  }
  onClick(x, y) {
    return false;
  }
  onKeyDown(e) {
    return false;
  }
  onKeyUp(e) {
    return false;
  }

  statusText() {
    return '';
  }
}

// --- Small shared helpers ---

export function randInt(n) {
  return Math.floor(Math.random() * n);
}

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}