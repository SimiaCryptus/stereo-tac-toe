// Maze mode: arrow keys move a raised disc through a generated maze to the
// ring exit. X-shaped hazards in the side passages send you back to start.

import { Mode, randInt, shuffle, clamp } from './mode.js';
import { CONFIG } from '../config.js';
import { fillRect, fillCircle, drawRing } from '../depthMap.js';
import { drawShape } from '../shapes.js';

// dr, dc, bit, opposite bit. Bits: 1=N, 2=E, 4=S, 8=W.
const DIRS = [
  [-1, 0, 1, 4],
  [0, 1, 2, 8],
  [1, 0, 4, 1],
  [0, -1, 8, 2],
];
const KEY_DIR = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 };

export class MazeMode extends Mode {
  static id = 'maze';
  static label = 'Maze';
  static help =
    'Use the arrow keys to steer the raised disc from the top-left to the ring in the ' +
    'bottom-right. Avoid the X hazards — touching one sends you back to the start.';

  constructor() {
    super();
    this.reset();
  }

  reset() {
    this.n = clamp(Math.round(CONFIG.MAZE_SIZE || 9), 4, 25);
    this._generate(this.n);
    this.player = 0;
    this.exit = this.n * this.n - 1;
    this.moves = 0;
    this.hits = 0;
    this.solved = false;
  }

  _generate(n) {
    const total = n * n;
    const open = new Uint8Array(total);
    const visited = new Uint8Array(total);
    const stack = [0];
    visited[0] = 1;

    // Recursive backtracker (iterative).
    while (stack.length) {
      const cur = stack[stack.length - 1];
      const r = Math.floor(cur / n);
      const c = cur % n;
      const options = [];
      for (const [dr, dc, bit, opp] of DIRS) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nc < 0 || nr >= n || nc >= n) continue;
        const ni = nr * n + nc;
        if (!visited[ni]) options.push([ni, bit, opp]);
      }
      if (!options.length) {
        stack.pop();
        continue;
      }
      const [ni, bit, opp] = options[randInt(options.length)];
      open[cur] |= bit;
      open[ni] |= opp;
      visited[ni] = 1;
      stack.push(ni);
    }

    // BFS for the unique solution path so hazards never block it.
    const prev = new Int32Array(total).fill(-1);
    prev[0] = 0;
    const queue = [0];
    while (queue.length) {
      const cur = queue.shift();
      if (cur === total - 1) break;
      const r = Math.floor(cur / n);
      const c = cur % n;
      for (const [dr, dc, bit] of DIRS) {
        if (!(open[cur] & bit)) continue;
        const ni = (r + dr) * n + (c + dc);
        if (prev[ni] === -1) {
          prev[ni] = cur;
          queue.push(ni);
        }
      }
    }
    const onPath = new Uint8Array(total);
    let x = total - 1;
    while (true) {
      onPath[x] = 1;
      if (x === 0) break;
      x = prev[x];
    }

    const hazards = new Uint8Array(total);
    const candidates = [];
    for (let i = 0; i < total; i++) if (!onPath[i]) candidates.push(i);
    shuffle(candidates);
    const count = Math.min(candidates.length, Math.max(1, Math.round(total * 0.08)));
    for (let i = 0; i < count; i++) hazards[candidates[i]] = 1;

    this.open = open;
    this.hazards = hazards;
  }

  _geometry() {
    const { WIDTH: W, HEIGHT: H, GRID_MARGIN } = CONFIG;
    const m = Math.max(12, GRID_MARGIN * 0.5);
    const size = Math.max(40, Math.min(W, H) - 2 * m);
    const cell = size / this.n;
    return { size, cell, ox: (W - size) / 2, oy: (H - size) / 2 };
  }

  onKeyDown(e) {
    if (this.solved) {
      if (e.key === 'Enter' || e.key === ' ') {
        this.reset();
        return true;
      }
      return false;
    }
    const d = KEY_DIR[e.key];
    if (d === undefined) return false;
    const [dr, dc, bit] = DIRS[d];
    const n = this.n;
    if (this.open[this.player] & bit) {
      const r = Math.floor(this.player / n) + dr;
      const c = (this.player % n) + dc;
      this.player = r * n + c;
      this.moves++;
      if (this.hazards[this.player]) {
        this.hits++;
        this.player = 0;
      } else if (this.player === this.exit) {
        this.solved = true;
      }
    }
    // Handled even on a bump so the page doesn't scroll.
    return true;
  }

  render(buf, w, h) {
    const D = CONFIG.DEPTH_LEVELS;
    const { LINE_THICKNESS, MARK_THICKNESS } = CONFIG;
    const { size, cell, ox, oy } = this._geometry();
    const n = this.n;
    const t = Math.max(1, Math.min(LINE_THICKNESS, cell * 0.25));

    buf.fill(D.BACKGROUND);

    // Walls: top + left of each cell, then the outer bottom/right edges.
    for (let i = 0; i < n * n; i++) {
      const r = Math.floor(i / n);
      const c = i % n;
      const x = ox + c * cell;
      const y = oy + r * cell;
      if (!(this.open[i] & 1))
        fillRect(buf, w, h, x - t / 2, y - t / 2, x + cell + t / 2, y + t / 2, D.GRID);
      if (!(this.open[i] & 8))
        fillRect(buf, w, h, x - t / 2, y - t / 2, x + t / 2, y + cell + t / 2, D.GRID);
    }
    fillRect(
      buf,
      w,
      h,
      ox - t / 2,
      oy + size - t / 2,
      ox + size + t / 2,
      oy + size + t / 2,
      D.GRID
    );
    fillRect(
      buf,
      w,
      h,
      ox + size - t / 2,
      oy - t / 2,
      ox + size + t / 2,
      oy + size + t / 2,
      D.GRID
    );

    const center = (i) => [
      ox + (i % n) * cell + cell / 2,
      oy + Math.floor(i / n) * cell + cell / 2,
    ];

    // Hazards.
    const hz = cell * 0.22;
    for (let i = 0; i < n * n; i++) {
      if (!this.hazards[i]) continue;
      const [cx, cy] = center(i);
      drawShape(
        buf,
        w,
        h,
        'cross',
        cx,
        cy,
        hz,
        Math.max(1, Math.min(MARK_THICKNESS * 0.6, cell * 0.1)),
        D.MARK
      );
    }

    // Exit ring.
    {
      const [cx, cy] = center(this.exit);
      drawRing(
        buf,
        w,
        h,
        cx,
        cy,
        cell * 0.3,
        Math.max(1, Math.min(MARK_THICKNESS, cell * 0.12)),
        D.MARK
      );
    }

    // Player.
    {
      const [cx, cy] = center(this.player);
      fillCircle(buf, w, h, cx, cy, cell * 0.28, D.CURSOR);
    }
  }

  statusText() {
    if (this.solved) {
      return `Solved in ${this.moves} moves (${this.hits} hits) — Enter or New Game to replay`;
    }
    return `Arrow keys to move · Moves ${this.moves} · Hits ${this.hits}`;
  }
}
