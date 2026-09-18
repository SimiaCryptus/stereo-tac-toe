// Word search mode: a grid of depth-rendered letters hides a handful of
// words along rows, columns and diagonals. Click the first letter of a
// word, then its last letter, to claim it. Found words get a raised stripe
// beneath them. The word list lives in the status line, outside the image,
// so only the letters themselves have to be read in depth.

import { Mode, randInt, shuffle, clamp } from './mode.js';
import { CONFIG } from '../config.js';
import { fillRect, drawLine } from '../depthMap.js';
import { drawGlyph, GLYPH_H } from '../font.js';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const WORD_BANK = [
  'CAT',
  'DOG',
  'SUN',
  'EYE',
  'SKY',
  'DOT',
  'MOON',
  'STAR',
  'TREE',
  'FISH',
  'BIRD',
  'LAMP',
  'BOOK',
  'SHIP',
  'ROAD',
  'FUSE',
  'GRID',
  'MARK',
  'RING',
  'MAZE',
  'PONG',
  'GAME',
  'BLUR',
  'MAGIC',
  'DEPTH',
  'NOISE',
  'PIXEL',
  'FOCUS',
];

// Forward-reading directions only (E, S, SE, NE) — reversed words are
// brutal to read inside a stereogram.
const DIRS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [-1, 1],
];

const N_MIN = 5;
const N_MAX = 10;

function frame(buf, w, h, x0, y0, x1, y1, t, depth) {
  fillRect(buf, w, h, x0, y0, x1, y0 + t, depth);
  fillRect(buf, w, h, x0, y1 - t, x1, y1, depth);
  fillRect(buf, w, h, x0, y0, x0 + t, y1, depth);
  fillRect(buf, w, h, x1 - t, y0, x1, y1, depth);
}

export class WordSearchMode extends Mode {
  static id = 'wordsearch';
  static label = 'Word Search';
  static help =
    'A grid of letters floats in the noise with a few words hidden along rows, columns ' +
    'and diagonals. Click the first letter of a word, then its last letter, to claim it. ' +
    'The words to find are listed in the status line. Esc cancels a selection.';

  constructor() {
    super();
    this.reset();
  }

  reset() {
    this.n = clamp(Math.round(CONFIG.WORDSEARCH_SIZE || 6), N_MIN, N_MAX);
    this._generate();
    this.cursor = null;
    this.sel = null; // first clicked cell, or null
    this.found = new Set();
    this.message = null;
    this.messageTimer = 0;
  }

  _generate() {
    const n = this.n;
    const grid = new Array(n * n).fill(null);
    const bank = shuffle(WORD_BANK.filter((w) => w.length <= n));
    const target = Math.min(6, Math.max(3, n - 2));
    const placed = [];
    for (const word of bank) {
      if (placed.length >= target) break;
      const cells = this._tryPlace(grid, word);
      if (cells) placed.push({ word, cells });
    }
    for (let i = 0; i < grid.length; i++) {
      if (grid[i] === null) grid[i] = LETTERS[randInt(LETTERS.length)];
    }
    this.grid = grid;
    this.words = placed;
  }

  _tryPlace(grid, word) {
    const n = this.n;
    const L = word.length;
    for (let attempt = 0; attempt < 80; attempt++) {
      const [dr, dc] = DIRS[randInt(DIRS.length)];
      const rMin = dr < 0 ? L - 1 : 0;
      const rMax = dr > 0 ? n - L : n - 1;
      const cMin = dc < 0 ? L - 1 : 0;
      const cMax = dc > 0 ? n - L : n - 1;
      if (rMax < rMin || cMax < cMin) continue;
      const r0 = rMin + randInt(rMax - rMin + 1);
      const c0 = cMin + randInt(cMax - cMin + 1);
      const cells = [];
      let ok = true;
      let fresh = 0;
      for (let k = 0; k < L; k++) {
        const i = (r0 + dr * k) * n + (c0 + dc * k);
        if (grid[i] !== null && grid[i] !== word[k]) {
          ok = false;
          break;
        }
        if (grid[i] === null) fresh++;
        cells.push(i);
      }
      // Require at least one new letter so words don't fully overlap.
      if (!ok || fresh === 0) continue;
      cells.forEach((i, k) => {
        grid[i] = word[k];
      });
      return cells;
    }
    return null;
  }

  _geometry() {
    const { WIDTH: W, HEIGHT: H, GRID_MARGIN } = CONFIG;
    const m = Math.max(12, GRID_MARGIN * 0.5);
    const size = Math.max(40, Math.min(W, H) - 2 * m);
    const cell = size / this.n;
    return { size, cell, ox: (W - size) / 2, oy: (H - size) / 2 };
  }

  _pixelToCell(x, y) {
    const { cell, ox, oy } = this._geometry();
    const col = Math.floor((x - ox) / cell);
    const row = Math.floor((y - oy) / cell);
    if (col < 0 || col >= this.n || row < 0 || row >= this.n) return null;
    return row * this.n + col;
  }

  _done() {
    return this.found.size >= this.words.length;
  }

  // Cells on the straight line from a to b (inclusive), or null if the
  // two cells are not on a common row, column or diagonal.
  _lineCells(a, b) {
    const n = this.n;
    const r0 = Math.floor(a / n);
    const c0 = a % n;
    const r1 = Math.floor(b / n);
    const c1 = b % n;
    const ar = Math.abs(r1 - r0);
    const ac = Math.abs(c1 - c0);
    if (ar !== 0 && ac !== 0 && ar !== ac) return null;
    const dr = Math.sign(r1 - r0);
    const dc = Math.sign(c1 - c0);
    const len = Math.max(ar, ac);
    const cells = [];
    for (let k = 0; k <= len; k++) cells.push((r0 + dr * k) * n + (c0 + dc * k));
    return cells;
  }

  _trySelect(a, b) {
    const cells = this._lineCells(a, b);
    if (!cells) {
      this._say('Not a straight line');
      return;
    }
    const s = cells.map((i) => this.grid[i]).join('');
    const rev = s.split('').reverse().join('');
    const hit = this.words.find((w) => !this.found.has(w.word) && (w.word === s || w.word === rev));
    if (hit) {
      this.found.add(hit.word);
      this._say(`Found ${hit.word}!`);
    } else {
      this._say(`"${s}" is not one of the words`);
    }
  }

  _say(msg) {
    this.message = msg;
    this.messageTimer = 2.0;
  }

  update(dt) {
    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
      if (this.messageTimer <= 0) {
        this.message = null;
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
    if (this._done()) {
      this.reset();
      return true;
    }
    const c = this._pixelToCell(x, y);
    if (c === null) {
      if (this.sel !== null) {
        this.sel = null;
        return true;
      }
      return false;
    }
    if (this.sel === null) {
      this.sel = c;
      return true;
    }
    if (c !== this.sel) this._trySelect(this.sel, c);
    this.sel = null;
    return true;
  }

  onKeyDown(e) {
    if (e.key === 'Escape' && this.sel !== null) {
      this.sel = null;
      return true;
    }
    if ((e.key === 'Enter' || e.key === ' ') && this._done()) {
      this.reset();
      return true;
    }
    return false;
  }

  render(buf, w, h) {
    const D = CONFIG.DEPTH_LEVELS;
    const { LINE_THICKNESS } = CONFIG;
    const { cell, ox, oy } = this._geometry();
    const n = this.n;

    buf.fill(D.BACKGROUND);

    const center = (i) => [
      ox + (i % n) * cell + cell / 2,
      oy + Math.floor(i / n) * cell + cell / 2,
    ];

    // Found words: a stripe beneath the letters at grid depth.
    for (const wd of this.words) {
      if (!this.found.has(wd.word)) continue;
      const [ax, ay] = center(wd.cells[0]);
      const [bx, by] = center(wd.cells[wd.cells.length - 1]);
      drawLine(buf, w, h, ax, ay, bx, by, cell * 0.7, D.GRID);
    }

    // Hover frame (thin, grid depth) and selection frame (cursor depth).
    const cellFrame = (i, t, depth) => {
      const c = i % n;
      const r = Math.floor(i / n);
      const pad = Math.max(2, cell * 0.06);
      frame(
        buf,
        w,
        h,
        ox + c * cell + pad,
        oy + r * cell + pad,
        ox + (c + 1) * cell - pad,
        oy + (r + 1) * cell - pad,
        t,
        depth
      );
    };
    if (!this._done() && this.cursor !== null && this.cursor !== this.sel) {
      cellFrame(this.cursor, Math.max(2, LINE_THICKNESS / 2), D.GRID);
    }
    if (this.sel !== null) {
      cellFrame(this.sel, Math.max(3, LINE_THICKNESS), D.CURSOR);
    }

    // Letters at mark depth.
    const px = Math.max(1, Math.floor((cell * 0.62) / GLYPH_H));
    for (let i = 0; i < n * n; i++) {
      const [cx, cy] = center(i);
      drawGlyph(buf, w, h, this.grid[i], cx, cy, px, D.MARK);
    }
  }

  statusText() {
    if (this._done()) {
      return `All ${this.words.length} words found — click or Enter to play again`;
    }
    const left = this.words.filter((w) => !this.found.has(w.word)).map((w) => w.word);
    let prefix = '';
    if (this.message) prefix = `${this.message}  ·  `;
    else if (this.sel !== null) prefix = 'Now click the last letter  ·  ';
    return `${prefix}Find: ${left.join(' · ')}  (${this.found.size}/${this.words.length})`;
  }
}
