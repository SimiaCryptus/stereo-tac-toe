// 1-player tic-tac-toe: you play against the computer AI.

import { TicTacToeMode } from './tictactoe.js';
import { chooseMove } from '../ai.js';
import { CONFIG } from '../config.js';

export class SoloTicTacToeMode extends TicTacToeMode {
  static id = 'tictactoe1';
  static label = 'Tic-Tac-Toe (1-player)';
  static help =
    'Play against the computer on the hidden board. Hover to see the placement hint and ' +
    'click a cell to play. "Computer plays" in the panel picks its side (applied on New Game).';

  constructor() {
    super();
    this.reset();
  }

  reset() {
    this.game.reset();
    this.ai = CONFIG.SOLO_AI_SIDE === 'X' ? 'X' : 'O';
    this.timer = 0.6;
  }

  _aiTurn() {
    return !this.game.winner && this.game.turn === this.ai;
  }

  update(dt) {
    if (!this._aiTurn()) return false;
    this.timer -= dt;
    if (this.timer > 0) return false;
    const cell = chooseMove(this.game.board, this.ai);
    if (cell !== null) this.game.move(cell);
    return true;
  }

  onClick(x, y) {
    if (this.game.winner) {
      this.reset();
      return true;
    }
    if (this._aiTurn()) return false;
    const moved = super.onClick(x, y);
    if (moved) this.timer = 0.6;
    return moved;
  }

  onKeyDown(e) {
    if ((e.key === 'Enter' || e.key === ' ') && this.game.winner) {
      this.reset();
      return true;
    }
    return false;
  }

  statusText() {
    const g = this.game;
    const me = this.ai === 'X' ? 'O' : 'X';
    if (g.winner === 'draw') return 'Draw — click to play again';
    if (g.winner) return `${g.winner === me ? 'You win' : 'Computer wins'} — click to play again`;
    return g.turn === me ? `Your move (${me})` : 'Computer thinking…';
  }
}