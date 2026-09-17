// Tic-tac-toe mode: thin adapter around the pure Game state machine.

import { Mode } from './mode.js';
import { Game } from '../game.js';
import { renderDepthMap } from '../depthMap.js';
import { boardGeometry } from '../config.js';

export class TicTacToeMode extends Mode {
  static id = 'tictactoe';
  static label = 'Tic-Tac-Toe';
  static help =
    'A hidden Magic Eye tic-tac-toe board. The grid, cursor and marks float at different ' +
    'depths. Hover to see the placement hint, click a cell to play.';

  constructor() {
    super();
    this.game = new Game();
  }

  reset() {
    this.game.reset();
  }

  render(buf) {
    renderDepthMap(buf, this.game);
  }

  pixelToCell(x, y) {
    const { originX, originY, cellSize } = boardGeometry();
    const col = Math.floor((x - originX) / cellSize);
    const row = Math.floor((y - originY) / cellSize);
    if (col < 0 || col > 2 || row < 0 || row > 2) return null;
    return row * 3 + col;
  }

  onMove(x, y) {
    const cell = this.pixelToCell(x, y);
    if (cell !== this.game.cursor) {
      this.game.setCursor(cell);
      return true;
    }
    return false;
  }

  onLeave() {
    if (this.game.cursor !== null) {
      this.game.setCursor(null);
      return true;
    }
    return false;
  }

  onClick(x, y) {
    const cell = this.pixelToCell(x, y);
    return cell !== null && this.game.move(cell);
  }

  statusText() {
    return this.game.statusText();
  }
}