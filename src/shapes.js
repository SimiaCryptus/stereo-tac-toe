// A small library of depth-only glyphs shared by the memory and
// spot-the-outlier modes. `size` is the half-extent in pixels.

import { fillRect, drawLine, drawRing, fillCircle, fillConvexPolygon } from './depthMap.js';

export const SHAPES = [
  'circle',
  'square',
  'triangle',
  'diamond',
  'ring',
  'cross',
  'plus',
  'hbar',
  'vbar',
];

export const SHAPE_NAMES = {
  circle: 'disc',
  square: 'square',
  triangle: 'triangle',
  diamond: 'diamond',
  ring: 'ring',
  cross: 'X',
  plus: 'plus',
  hbar: 'horizontal bar',
  vbar: 'vertical bar',
};

// Shapes that are easy to confuse with each other (for harder outliers).
export const SIMILAR = {
  circle: ['ring', 'square'],
  square: ['diamond', 'circle'],
  triangle: ['diamond'],
  diamond: ['square', 'triangle'],
  ring: ['circle'],
  cross: ['plus'],
  plus: ['cross'],
  hbar: ['vbar'],
  vbar: ['hbar'],
};

export function drawShape(buf, w, h, shape, cx, cy, size, thickness, depth) {
  switch (shape) {
    case 'circle':
      fillCircle(buf, w, h, cx, cy, size, depth);
      break;
    case 'square':
      fillRect(buf, w, h, cx - size, cy - size, cx + size, cy + size, depth);
      break;
    case 'triangle':
      fillConvexPolygon(
        buf,
        w,
        h,
        [
          [cx, cy - size],
          [cx + size, cy + size * 0.8],
          [cx - size, cy + size * 0.8],
        ],
        depth
      );
      break;
    case 'diamond':
      fillConvexPolygon(
        buf,
        w,
        h,
        [
          [cx, cy - size],
          [cx + size, cy],
          [cx, cy + size],
          [cx - size, cy],
        ],
        depth
      );
      break;
    case 'ring':
      drawRing(buf, w, h, cx, cy, size - thickness / 2, thickness, depth);
      break;
    case 'cross':
      drawLine(buf, w, h, cx - size, cy - size, cx + size, cy + size, thickness, depth);
      drawLine(buf, w, h, cx + size, cy - size, cx - size, cy + size, thickness, depth);
      break;
    case 'plus':
      drawLine(buf, w, h, cx - size, cy, cx + size, cy, thickness, depth);
      drawLine(buf, w, h, cx, cy - size, cx, cy + size, thickness, depth);
      break;
    case 'hbar':
      fillRect(buf, w, h, cx - size, cy - thickness / 2, cx + size, cy + thickness / 2, depth);
      break;
    case 'vbar':
      fillRect(buf, w, h, cx - thickness / 2, cy - size, cx + thickness / 2, cy + size, depth);
      break;
    default:
      fillCircle(buf, w, h, cx, cy, size, depth);
  }
}