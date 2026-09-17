// Lightweight tic-tac-toe AI: take a win, block a loss, otherwise pick a
// random cell with a mild preference for the center and corners. It is
// imperfect on purpose (occasionally misses wins/blocks) so 0-player games
// don't all end in identical draws.

import { WIN_LINES } from './game.js';

// Return the empty cell completing a two-in-a-row for `p`, or null.
function lineMove(board, p) {
  for (const [a, b, c] of WIN_LINES) {
    const cells = [a, b, c];
    const mine = cells.filter((i) => board[i] === p).length;
    const empty = cells.filter((i) => board[i] === null);
    if (mine === 2 && empty.length === 1) return empty[0];
  }
  return null;
}

export function chooseMove(board, player) {
  const empty = [];
  for (let i = 0; i < board.length; i++) if (board[i] === null) empty.push(i);
  if (empty.length === 0) return null;

  const other = player === 'X' ? 'O' : 'X';

  const win = lineMove(board, player);
  if (win !== null && Math.random() < 0.95) return win;

  const block = lineMove(board, other);
  if (block !== null && Math.random() < 0.8) return block;

  // Weighted random: center 3x, corners 2x, edges 1x.
  const weighted = [];
  for (const c of empty) {
    const wgt = c === 4 ? 3 : c % 2 === 0 ? 2 : 1;
    for (let k = 0; k < wgt; k++) weighted.push(c);
  }
  return weighted[Math.floor(Math.random() * weighted.length)];
}