// Rasterizes into a Float32Array depth buffer.
// Depth values: 0 = far background, 1 = near foreground.
// Exposes the software rasterization primitives so game modes can draw
// their own depth scenes, plus the tic-tac-toe compositor.

import { CONFIG, boardGeometry } from './config.js';

export function createDepthMap(width, height) {
  return new Float32Array(width * height);
}

// --- Software rasterization helpers (write depth, not color) ---

export function fillRect(buf, w, h, x0, y0, x1, y1, depth) {
  const xa = Math.max(0, Math.floor(Math.min(x0, x1)));
  const xb = Math.min(w, Math.ceil(Math.max(x0, x1)));
  const ya = Math.max(0, Math.floor(Math.min(y0, y1)));
  const yb = Math.min(h, Math.ceil(Math.max(y0, y1)));
  for (let y = ya; y < yb; y++) {
    const row = y * w;
    for (let x = xa; x < xb; x++) {
      buf[row + x] = depth;
    }
  }
}

// Thick line via distance-to-segment test.
export function drawLine(buf, w, h, x0, y0, x1, y1, thickness, depth) {
  const half = thickness / 2;
  const minX = Math.max(0, Math.floor(Math.min(x0, x1) - half));
  const maxX = Math.min(w, Math.ceil(Math.max(x0, x1) + half));
  const minY = Math.max(0, Math.floor(Math.min(y0, y1) - half));
  const maxY = Math.min(h, Math.ceil(Math.max(y0, y1) + half));
  const dx = x1 - x0;
  const dy = y1 - y0;
  const lenSq = dx * dx + dy * dy || 1;
  const halfSq = half * half;
  for (let y = minY; y < maxY; y++) {
    const row = y * w;
    for (let x = minX; x < maxX; x++) {
      let t = ((x - x0) * dx + (y - y0) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
      const px = x0 + t * dx;
      const py = y0 + t * dy;
      const ddx = x - px;
      const ddy = y - py;
      if (ddx * ddx + ddy * ddy <= halfSq) {
        buf[row + x] = depth;
      }
    }
  }
}

// Ring (annulus) for drawing an O.
export function drawRing(buf, w, h, cx, cy, radius, thickness, depth) {
  const outer = radius + thickness / 2;
  const inner = Math.max(0, radius - thickness / 2);
  const outerSq = outer * outer;
  const innerSq = inner * inner;
  const minX = Math.max(0, Math.floor(cx - outer));
  const maxX = Math.min(w, Math.ceil(cx + outer));
  const minY = Math.max(0, Math.floor(cy - outer));
  const maxY = Math.min(h, Math.ceil(cy + outer));
  for (let y = minY; y < maxY; y++) {
    const row = y * w;
    for (let x = minX; x < maxX; x++) {
      const ddx = x - cx;
      const ddy = y - cy;
      const dSq = ddx * ddx + ddy * ddy;
      if (dSq <= outerSq && dSq >= innerSq) {
        buf[row + x] = depth;
      }
    }
  }
}

// Filled disc.
export function fillCircle(buf, w, h, cx, cy, radius, depth) {
  const rSq = radius * radius;
  const minX = Math.max(0, Math.floor(cx - radius));
  const maxX = Math.min(w, Math.ceil(cx + radius));
  const minY = Math.max(0, Math.floor(cy - radius));
  const maxY = Math.min(h, Math.ceil(cy + radius));
  for (let y = minY; y < maxY; y++) {
    const row = y * w;
    for (let x = minX; x < maxX; x++) {
      const ddx = x - cx;
      const ddy = y - cy;
      if (ddx * ddx + ddy * ddy <= rSq) {
        buf[row + x] = depth;
      }
    }
  }
}

// Filled convex polygon. pts: [[x, y], ...] in either winding order.
export function fillConvexPolygon(buf, w, h, pts, depth) {
  const n = pts.length;
  if (n < 3) return;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % n];
    minX = Math.min(minX, x0);
    maxX = Math.max(maxX, x0);
    minY = Math.min(minY, y0);
    maxY = Math.max(maxY, y0);
    area += x0 * y1 - x1 * y0;
  }
  const sign = area >= 0 ? 1 : -1;
  const xa = Math.max(0, Math.floor(minX));
  const xb = Math.min(w, Math.ceil(maxX) + 1);
  const ya = Math.max(0, Math.floor(minY));
  const yb = Math.min(h, Math.ceil(maxY) + 1);
  for (let y = ya; y < yb; y++) {
    const row = y * w;
    for (let x = xa; x < xb; x++) {
      let inside = true;
      for (let i = 0; i < n && inside; i++) {
        const [x0, y0] = pts[i];
        const [x1, y1] = pts[(i + 1) % n];
        const e = (x1 - x0) * (y - y0) - (y1 - y0) * (x - x0);
        if (e * sign < 0) inside = false;
      }
      if (inside) buf[row + x] = depth;
    }
  }
}

// --- Composite full tic-tac-toe game state into the buffer ---

export function renderDepthMap(buffer, game) {
  const { WIDTH, HEIGHT, DEPTH_LEVELS, LINE_THICKNESS, MARK_THICKNESS, MARK_INSET } = CONFIG;
  const { originX, originY, cellSize, boardSize } = boardGeometry();

  // Clear to background.
  buffer.fill(DEPTH_LEVELS.BACKGROUND);

  // Grid lines (two vertical, two horizontal) at GRID depth.
  const gridDepth = DEPTH_LEVELS.GRID;
  for (let i = 1; i <= 2; i++) {
    const x = originX + i * cellSize;
    fillRect(
      buffer,
      WIDTH,
      HEIGHT,
      x - LINE_THICKNESS / 2,
      originY,
      x + LINE_THICKNESS / 2,
      originY + boardSize,
      gridDepth
    );
    const y = originY + i * cellSize;
    fillRect(
      buffer,
      WIDTH,
      HEIGHT,
      originX,
      y - LINE_THICKNESS / 2,
      originX + boardSize,
      y + LINE_THICKNESS / 2,
      gridDepth
    );
  }

  // Cursor marker (raised block behind the mark region) at CURSOR depth.
  if (game.cursor !== null && !game.winner) {
    const cRow = Math.floor(game.cursor / 3);
    const cCol = game.cursor % 3;
    const cx0 = originX + cCol * cellSize + MARK_INSET / 2;
    const cy0 = originY + cRow * cellSize + MARK_INSET / 2;
    const cx1 = originX + (cCol + 1) * cellSize - MARK_INSET / 2;
    const cy1 = originY + (cRow + 1) * cellSize - MARK_INSET / 2;
    // Only draw cursor if cell empty (a placement hint).
    if (game.board[game.cursor] === null) {
      fillRect(buffer, WIDTH, HEIGHT, cx0, cy0, cx1, cy1, DEPTH_LEVELS.CURSOR);
    }
  }

  // Marks (X / O) at MARK depth.
  const markDepth = DEPTH_LEVELS.MARK;
  for (let i = 0; i < 9; i++) {
    const mark = game.board[i];
    if (!mark) continue;
    const row = Math.floor(i / 3);
    const col = i % 3;
    const x0 = originX + col * cellSize + MARK_INSET;
    const y0 = originY + row * cellSize + MARK_INSET;
    const x1 = originX + (col + 1) * cellSize - MARK_INSET;
    const y1 = originY + (row + 1) * cellSize - MARK_INSET;

    if (mark === 'X') {
      drawLine(buffer, WIDTH, HEIGHT, x0, y0, x1, y1, MARK_THICKNESS, markDepth);
      drawLine(buffer, WIDTH, HEIGHT, x1, y0, x0, y1, MARK_THICKNESS, markDepth);
    } else {
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const radius = Math.min(x1 - x0, y1 - y0) / 2;
      drawRing(buffer, WIDTH, HEIGHT, cx, cy, radius, MARK_THICKNESS, markDepth);
    }
  }

  // Win line: a raised depth stripe across the winning cells.
  if (game.winLine) {
    const [a, , c] = game.winLine;
    const ax = originX + (a % 3) * cellSize + cellSize / 2;
    const ay = originY + Math.floor(a / 3) * cellSize + cellSize / 2;
    const cx = originX + (c % 3) * cellSize + cellSize / 2;
    const cy = originY + Math.floor(c / 3) * cellSize + cellSize / 2;
    drawLine(buffer, WIDTH, HEIGHT, ax, ay, cx, cy, MARK_THICKNESS + 4, DEPTH_LEVELS.CURSOR);
  }
}