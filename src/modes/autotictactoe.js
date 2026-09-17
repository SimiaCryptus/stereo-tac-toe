// 0-player tic-tac-toe: two computer players trade moves on the hidden
// board at a steady pace, so you can just sit back and watch marks rise
// out of the noise. Click / Space pauses. Keeps a running tally.

import { TicTacToeMode } from './tictactoe.js';
import { chooseMove } from '../ai.js';
import { CONFIG } from '../config.js';

export class AutoTicTacToeMode extends TicTacToeMode {
  static id = 'tictactoe0';
  static label = 'Tic-Tac-Toe (0-player)';
  static help =
    'Sit back: two computer players take turns on the hidden board, so you can practise ' +
    'fusing the image while it changes. Click or press Space to pause and resume. ' +
    '"0-player move delay" in the panel sets the pace.';

  constructor() {
    super();
    this.tally = { X: 0, O: 0, draw: 0 };
    this.games = 0;
    this.paused = false;
    this.timer = this._delay();
  }

  reset() {
    this.game.reset();
    this.timer = this._delay();
    this.paused = false;
  }

  _delay() {
    return Math.max(0.1, CONFIG.AUTO_MOVE_SEC || 1.2);
  }

  update(dt) {
    if (this.paused) return false;
    this.timer -= dt;
    if (this.timer > 0) return false;

    const g = this.game;
    if (g.winner) {
      // Game over pause elapsed: record and start the next one.
      this.games++;
      this.tally[g.winner]++;
      g.reset();
      this.timer = this._delay();
      return true;
    }

    const cell = chooseMove(g.board, g.turn);
    if (cell !== null) g.move(cell);
    // Linger a little longer on a finished board so the result can be seen.
    this.timer = g.winner ? this._delay() * 2.5 : this._delay();
    return true;
  }

  // Pointer never places marks here; the board is not for you.
  onMove() {
    return false;
  }

  onLeave() {
    return false;
  }

  onClick() {
    this.paused = !this.paused;
    return true;
  }

  onKeyDown(e) {
    if (e.key === ' ' || e.key === 'Enter') {
      this.paused = !this.paused;
      return true;
    }
    return false;
  }

  statusText() {
    const state = this.paused ? 'Paused' : 'Auto-play';
    const hint = this.paused ? 'click to resume' : 'click to pause';
    const { X, O, draw } = this.tally;
    return `${state} · ${this.game.statusText()} · X ${X} – O ${O} – Draws ${draw} · ${hint}`;
  }
}