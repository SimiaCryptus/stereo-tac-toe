# Notes

## Done

- **Fixed: corrupted region in the fused image.** The depth map was never at
  fault (press `D` — it is clean). The stereogram colour pass walked left → right
  and had linked pixels *copy their anchor's colour out of the output buffer*.
  In the left half every anchor lies to the *right* of the pixels that
  reference it, so those pixels read whatever the buffer held from the previous
  render — black on the very first frame, stale colours after any change near
  the centre column (cursor / marks in the middle column, the memory prompt,
  the pong ball, ...). With dirty-flag redraws the stale band then sat on
  screen until the next redraw. Pixels now sample the noise ribbon directly at
  their anchor's column, so the result no longer depends on visiting order.
  While in there: the linker uses proper union-find instead of last-write-wins
  `same[a] = b` overwrites, and the classic Thimbleby/Inglis/Witten
  hidden-surface test skips constraints for points one eye can't see, so
  background pixels behind a raised edge aren't tied to foreground pixels.
- **New game mode: Word Search** (`src/modes/wordsearch.js`, letters drawn with
  the 5×7 depth font in `src/font.js`). Click first letter, then last letter.
  `WORDSEARCH_SIZE` knob in the Games panel.
- **0-player tic-tac-toe** (`src/modes/autotictactoe.js` + `src/ai.js`): two
  imperfect computer players trade moves; click / Space pauses; running tally
  in the status line. `AUTO_MOVE_SEC` knob sets the pace.

## Ideas

- 1-player tic-tac-toe against `src/ai.js`.
- Drag-to-select in word search (currently click–click).