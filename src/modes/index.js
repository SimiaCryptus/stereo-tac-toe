// Registry of playable modes.

import { TicTacToeMode } from './tictactoe.js';
import { AutoTicTacToeMode } from './autotictactoe.js';
import { MemoryMode } from './memory.js';
import { OutlierMode } from './outlier.js';
import { MazeMode } from './maze.js';
import { PongMode } from './pong.js';
import { WordSearchMode } from './wordsearch.js';

export const MODES = [
   TicTacToeMode,
   AutoTicTacToeMode,
   MemoryMode,
   OutlierMode,
   MazeMode,
   PongMode,
   WordSearchMode,
];

export function createMode(id) {
  const M = MODES.find((m) => m.id === id) || MODES[0];
  return new M();
}