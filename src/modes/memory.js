// Memory mode: nine distinct shapes are revealed for a few seconds, then
// hidden. A prompt shape floats above the board and the player clicks the
// cell where that shape was. No cards, no text in the image.

import { Mode, shuffle } from './mode.js';
import { CONFIG } from '../config.js';
import { fillRect, drawRing } from '../depthMap.js';
import { SHAPES, SHAPE_NAMES, drawShape } from '../shapes.js';

const N = 3;

export class MemoryMode extends Mode {
  static id = 'memory';
  static label = 'Memory';
  static help =
    'Nine shapes are revealed for a few seconds, then hidden. A prompt shape floats above ' +
    'the board: click the cell where it was. All nine get asked; your score is shown at the end.';

  constructor() {
    super();
    this.reset();
  }

  reset() {
    this.cells = shuffle(SHAPES.slice()); // 9 unique shapes, one per cell
    this.queue = shuffle([...Array(N * N).keys()]);
    this.phase = 'reveal'; // 'reveal' | 'ask' | 'feedback' | 'done'
    this.timer = CONFIG.MEMORY_REVEAL_SEC;
    this.target = null; // cell index currently being asked
    this.picked = null;
    this.correct = 0;
    this.asked = 0;
    this.cursor = null;
    this.lastShownSec = -1;
  }

  _geometry() {
    const { WIDTH: W, HEIGHT: H, GRID_MARGIN } = CONFIG;
    const m = Math.max(12, GRID_MARGIN * 0.5);
    const availH = H - 2 * m;
    const boardSize = Math.max(30, Math.min(W - 2 * m, availH * 0.74));
    const originX = (W - boardSize) / 2;
    const originY = H - m - boardSize;
    const cellSize = boardSize / N;
    const bandH = originY - m;
    const promptCy = m + bandH / 2;
    const promptSize = Math.max(6, Math.min(cellSize * 0.3, bandH * 0.4));
    return { boardSize, originX, originY, cellSize, promptCy, promptSize };
  }

  _pixelToCell(x, y) {
    const { originX, originY, cellSize } = this._geometry();
    const col = Math.floor((x - originX) / cellSize);
    const row = Math.floor((y - originY) / cellSize);
    if (col < 0 || col >= N || row < 0 || row >= N) return null;
    return row * N + col;
  }

  _nextQuestion() {
    if (this.queue.length === 0) {
      this.phase = 'done';
      this.target = null;
      this.picked = null;
      return;
    }
    this.target = this.queue.pop();
    this.picked = null;
    this.phase = 'ask';
  }

  update(dt) {
    if (this.phase === 'reveal') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this._nextQuestion();
        return true;
      }
      // Redraw once per second so the countdown in the status stays live.
      const s = Math.ceil(this.timer);
      if (s !== this.lastShownSec) {
        this.lastShownSec = s;
        return true;
      }
      return false;
    }
    if (this.phase === 'feedback') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this._nextQuestion();
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
    if (this.phase === 'done') {
      this.reset();
      return true;
    }
    if (this.phase !== 'ask') return false;
    const c = this._pixelToCell(x, y);
    if (c === null) return false;
    this.picked = c;
    this.asked++;
    if (c === this.target) this.correct++;
    this.phase = 'feedback';
    this.timer = 1.0;
    return true;
  }

  onKeyDown(e) {
    if ((e.key === 'Enter' || e.key === ' ') && this.phase === 'done') {
      this.reset();
      return true;
    }
    return false;
  }

  render(buf, w, h) {
    const D = CONFIG.DEPTH_LEVELS;
    const { LINE_THICKNESS, MARK_THICKNESS, MARK_INSET } = CONFIG;
    const { originX, originY, cellSize, boardSize, promptCy, promptSize } = this._geometry();

    buf.fill(D.BACKGROUND);

    // Grid lines.
    for (let i = 1; i < N; i++) {
      const x = originX + i * cellSize;
      fillRect(
        buf,
        w,
        h,
        x - LINE_THICKNESS / 2,
        originY,
        x + LINE_THICKNESS / 2,
        originY + boardSize,
        D.GRID
      );
      const y = originY + i * cellSize;
      fillRect(
        buf,
        w,
        h,
        originX,
        y - LINE_THICKNESS / 2,
        originX + boardSize,
        y + LINE_THICKNESS / 2,
        D.GRID
      );
    }

    // Hover hint while a question is open.
    if (this.phase === 'ask' && this.cursor !== null) {
      const r = Math.floor(this.cursor / N);
      const c = this.cursor % N;
      const inset = Math.min(MARK_INSET / 2, cellSize * 0.2);
      fillRect(
        buf,
        w,
        h,
        originX + c * cellSize + inset,
        originY + r * cellSize + inset,
        originX + (c + 1) * cellSize - inset,
        originY + (r + 1) * cellSize - inset,
        D.CURSOR
      );
    }

    // Cell shapes: all during reveal/done, only the answer during feedback.
    const size = cellSize * 0.32;
    const thick = Math.min(MARK_THICKNESS, size * 0.4);
    for (let i = 0; i < N * N; i++) {
      const show =
        this.phase === 'reveal' ||
        this.phase === 'done' ||
        (this.phase === 'feedback' && i === this.target);
      if (!show) continue;
      const cx = originX + (i % N) * cellSize + cellSize / 2;
      const cy = originY + Math.floor(i / N) * cellSize + cellSize / 2;
      drawShape(buf, w, h, this.cells[i], cx, cy, size, thick, D.MARK);
    }

    // Wrong pick: ring the cell the player chose.
    if (this.phase === 'feedback' && this.picked !== null && this.picked !== this.target) {
      const cx = originX + (this.picked % N) * cellSize + cellSize / 2;
      const cy = originY + Math.floor(this.picked / N) * cellSize + cellSize / 2;
      drawRing(buf, w, h, cx, cy, cellSize * 0.42, LINE_THICKNESS, D.CURSOR);
    }

    // Prompt shape in the band above the board.
    if ((this.phase === 'ask' || this.phase === 'feedback') && this.target !== null) {
      drawShape(
        buf,
        w,
        h,
        this.cells[this.target],
        w / 2,
        promptCy,
        promptSize,
        Math.min(MARK_THICKNESS, promptSize * 0.4),
        D.CURSOR
      );
    }
  }

  statusText() {
    switch (this.phase) {
      case 'reveal':
        return `Memorize! Hiding in ${Math.max(0, Math.ceil(this.timer))}s`;
      case 'ask':
        return `Where was the ${SHAPE_NAMES[this.cells[this.target]]}?  (${this.correct}/${this.asked})`;
      case 'feedback':
        return this.picked === this.target ? 'Correct!' : 'Wrong — it is shown in its true cell';
      default:
        return `Done: ${this.correct}/${N * N} correct — click to play again`;
    }
  }
}
