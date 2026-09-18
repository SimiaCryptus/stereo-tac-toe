// Spot-the-outlier: a grid of identical shapes, except one that differs by
// shape, size or depth. Click the odd one out. Difficulty shrinks the deltas.

import { Mode, randInt, clamp } from './mode.js';
import { CONFIG } from '../config.js';
import { fillRect, drawRing } from '../depthMap.js';
import { SHAPES, SIMILAR, drawShape } from '../shapes.js';

const COLS = 4;
const ROWS = 3;
const KINDS = ['shape', 'size', 'depth'];

export class OutlierMode extends Mode {
  static id = 'outlier';
  static label = 'Spot the Outlier';
  static help =
    'Twelve shapes float in the noise; one differs from the rest by shape, size or depth. ' +
    'Click the odd one out. Raise "Outlier difficulty" in the panel for subtler differences.';

  constructor() {
    super();
    this.reset();
  }

  reset() {
    this.round = 0;
    this.score = 0;
    this.cursor = null;
    this.picked = null;
    this.timer = 0;
    this._newRound();
  }

  _newRound() {
    this.round++;
    const diff = clamp(Math.round(CONFIG.OUTLIER_DIFFICULTY || 1), 1, 5);
    this.base = SHAPES[randInt(SHAPES.length)];
    this.kind = KINDS[randInt(KINDS.length)];
    this.target = randInt(COLS * ROWS);
    this.outlier = { shape: this.base, sizeMul: 1, depthDelta: 0 };
    const sign = Math.random() < 0.5 ? -1 : 1;

    if (this.kind === 'shape') {
      const pool =
        diff >= 3 && SIMILAR[this.base]
          ? SIMILAR[this.base]
          : SHAPES.filter((s) => s !== this.base);
      this.outlier.shape = pool[randInt(pool.length)];
    } else if (this.kind === 'size') {
      // diff 1 → ±38%, diff 5 → ±10%
      this.outlier.sizeMul = 1 + sign * (0.45 - 0.07 * diff);
    } else {
      // diff 1 → ±0.25, diff 5 → ±0.05 (in depth units)
      this.outlier.depthDelta = sign * (0.3 - 0.05 * diff);
    }
    this.picked = null;
    this.phase = 'play';
  }

  _geometry() {
    const { WIDTH: W, HEIGHT: H, GRID_MARGIN } = CONFIG;
    const m = Math.max(12, GRID_MARGIN * 0.5);
    const cell = Math.max(20, Math.min((W - 2 * m) / COLS, (H - 2 * m) / ROWS));
    const gw = cell * COLS;
    const gh = cell * ROWS;
    return { cell, originX: (W - gw) / 2, originY: (H - gh) / 2 };
  }

  _pixelToCell(x, y) {
    const { cell, originX, originY } = this._geometry();
    const col = Math.floor((x - originX) / cell);
    const row = Math.floor((y - originY) / cell);
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return null;
    return row * COLS + col;
  }

  update(dt) {
    if (this.phase === 'feedback') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this._newRound();
        return true;
      }
    }
    return false;
  }

  onMove(x, y) {
    const c = this._pixelToCell(x, y);
    if (c !== this.cursor) {
      this.cursor = c;
      return true;
    }
    return false;
  }

  onLeave() {
    if (this.cursor !== null) {
      this.cursor = null;
      return true;
    }
    return false;
  }

  onClick(x, y) {
    if (this.phase !== 'play') return false;
    const c = this._pixelToCell(x, y);
    if (c === null) return false;
    this.picked = c;
    if (c === this.target) this.score++;
    this.phase = 'feedback';
    this.timer = 0.9;
    return true;
  }

  render(buf, w, h) {
    const D = CONFIG.DEPTH_LEVELS;
    const { LINE_THICKNESS, MARK_THICKNESS } = CONFIG;
    const { cell, originX, originY } = this._geometry();

    buf.fill(D.BACKGROUND);

    const baseSize = cell * 0.28;
    for (let i = 0; i < COLS * ROWS; i++) {
      const isT = i === this.target;
      const cx = originX + (i % COLS) * cell + cell / 2;
      const cy = originY + Math.floor(i / COLS) * cell + cell / 2;
      const size = baseSize * (isT ? this.outlier.sizeMul : 1);
      const depth = clamp(D.MARK + (isT ? this.outlier.depthDelta : 0), 0, 1);
      const shape = isT ? this.outlier.shape : this.base;
      drawShape(buf, w, h, shape, cx, cy, size, Math.min(MARK_THICKNESS, size * 0.4), depth);
    }

    // Hover frame (thin, at grid depth so it doesn't mask depth outliers).
    if (this.phase === 'play' && this.cursor !== null) {
      const c = this.cursor % COLS;
      const r = Math.floor(this.cursor / COLS);
      const x0 = originX + c * cell + 4;
      const y0 = originY + r * cell + 4;
      const x1 = originX + (c + 1) * cell - 4;
      const y1 = originY + (r + 1) * cell - 4;
      const t = Math.max(2, LINE_THICKNESS / 2);
      fillRect(buf, w, h, x0, y0, x1, y0 + t, D.GRID);
      fillRect(buf, w, h, x0, y1 - t, x1, y1, D.GRID);
      fillRect(buf, w, h, x0, y0, x0 + t, y1, D.GRID);
      fillRect(buf, w, h, x1 - t, y0, x1, y1, D.GRID);
    }

    // Feedback: ring the true outlier.
    if (this.phase === 'feedback') {
      const cx = originX + (this.target % COLS) * cell + cell / 2;
      const cy = originY + Math.floor(this.target / COLS) * cell + cell / 2;
      drawRing(buf, w, h, cx, cy, cell * 0.44, LINE_THICKNESS, D.CURSOR);
    }
  }

  statusText() {
    if (this.phase === 'feedback') {
      return this.picked === this.target
        ? `Correct! (${this.kind})`
        : `Nope — the ringed one differed in ${this.kind}`;
    }
    return `Round ${this.round} · Score ${this.score}/${this.round - 1} · Click the odd one out`;
  }
}
