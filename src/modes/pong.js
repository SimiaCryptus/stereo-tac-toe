// Pong mode: ↑/↓ (or the mouse) drives the right paddle against a
// computer-controlled left paddle. Net, paddles and ball sit at distinct
// depths. First to 5 wins. Continuous animation while a rally is live.

import { Mode, clamp } from './mode.js';
import { CONFIG } from '../config.js';
import { fillRect, fillCircle } from '../depthMap.js';

const WIN_SCORE = 5;

export class PongMode extends Mode {
  static id = 'pong';
  static label = 'Pong';
  static help =
    'Stereo pong. Move the right-hand paddle with ↑/↓ or the mouse against the computer. ' +
    'Net, paddles and ball float at different depths. First to five wins.';

  constructor() {
    super();
    this.reset();
  }

  reset() {
    const { H } = this._dims();
    this.scoreL = 0;
    this.scoreR = 0;
    this.over = false;
    this.winner = null;
    this.keys = { up: false, down: false };
    this.mouseY = null;
    this.py = H / 2; // player (right) paddle center
    this.ay = H / 2; // computer (left) paddle center
    this._serve(Math.random() < 0.5 ? -1 : 1);
  }

  _dims() {
    const W = CONFIG.WIDTH;
    const H = CONFIG.HEIGHT;
    return {
      W,
      H,
      pw: Math.max(6, W * 0.02),
      ph: Math.max(30, H * 0.2),
      margin: W * 0.06,
      r: Math.max(5, Math.min(W, H) * 0.02),
    };
  }

  _serve(dir) {
    const { W, H } = this._dims();
    this.bx = W / 2;
    this.by = H / 2;
    this.speedMul = 1;
    const ang = (Math.random() * 0.5 + 0.15) * (Math.random() < 0.5 ? -1 : 1);
    this.vx = dir * Math.cos(ang); // unit direction
    this.vy = Math.sin(ang);
    this.serveDelay = 1.0;
  }

  _bounce(paddleY, ph, dirX) {
    const off = clamp((this.by - paddleY) / (ph / 2), -1, 1);
    const ang = off * 1.0; // up to ~57°
    this.vx = dirX * Math.cos(ang);
    this.vy = Math.sin(ang);
    this.speedMul = Math.min(2.2, this.speedMul * 1.06);
  }

  _afterPoint(dir) {
    if (this.scoreL >= WIN_SCORE || this.scoreR >= WIN_SCORE) {
      this.over = true;
      this.winner = this.scoreL >= WIN_SCORE ? 'Computer' : 'You';
    } else {
      this._serve(dir);
    }
  }

  update(dt) {
    if (this.over) return false;
    const { W, H, pw, ph, margin, r } = this._dims();
    const speed = (CONFIG.PONG_SPEED || 220) * this.speedMul;
    const paddleSpeed = Math.max(speed, 300);

    // Player paddle: keys win over mouse.
    if (this.keys.up) this.py -= paddleSpeed * dt;
    else if (this.keys.down) this.py += paddleSpeed * dt;
    else if (this.mouseY !== null) this.py += (this.mouseY - this.py) * Math.min(1, dt * 12);
    this.py = clamp(this.py, ph / 2, H - ph / 2);

    // Computer paddle: chase the ball when it approaches, else recenter.
    const aiTarget = this.vx < 0 ? this.by : H / 2;
    const d = aiTarget - this.ay;
    this.ay += Math.sign(d) * Math.min(Math.abs(d), speed * 0.75 * dt);
    this.ay = clamp(this.ay, ph / 2, H - ph / 2);

    if (this.serveDelay > 0) {
      this.serveDelay -= dt;
      return true;
    }

    const prevX = this.bx;
    this.bx += this.vx * speed * dt;
    this.by += this.vy * speed * dt;

    // Top / bottom walls.
    if (this.by < r) {
      this.by = r;
      this.vy = Math.abs(this.vy);
    } else if (this.by > H - r) {
      this.by = H - r;
      this.vy = -Math.abs(this.vy);
    }

    // Paddles (swept test on the inner faces so fast balls can't tunnel).
    const lx = margin + pw;
    const rx = W - margin - pw;
    if (
      this.vx < 0 &&
      prevX - r > lx &&
      this.bx - r <= lx &&
      Math.abs(this.by - this.ay) <= ph / 2 + r
    ) {
      this.bx = lx + r;
      this._bounce(this.ay, ph, 1);
    } else if (
      this.vx > 0 &&
      prevX + r < rx &&
      this.bx + r >= rx &&
      Math.abs(this.by - this.py) <= ph / 2 + r
    ) {
      this.bx = rx - r;
      this._bounce(this.py, ph, -1);
    }

    // Scoring.
    if (this.bx < -r) {
      this.scoreR++;
      this._afterPoint(1);
    } else if (this.bx > W + r) {
      this.scoreL++;
      this._afterPoint(-1);
    }
    return true;
  }

  onKeyDown(e) {
    if (e.key === 'ArrowUp') {
      this.keys.up = true;
      return true;
    }
    if (e.key === 'ArrowDown') {
      this.keys.down = true;
      return true;
    }
    if ((e.key === 'Enter' || e.key === ' ') && this.over) {
      this.reset();
      return true;
    }
    return false;
  }

  onKeyUp(e) {
    if (e.key === 'ArrowUp') {
      this.keys.up = false;
      return true;
    }
    if (e.key === 'ArrowDown') {
      this.keys.down = false;
      return true;
    }
    return false;
  }

  onMove(x, y) {
    this.mouseY = y;
    return false; // update() redraws every frame during play
  }

  onLeave() {
    this.mouseY = null;
    return false;
  }

  render(buf, w, h) {
    const D = CONFIG.DEPTH_LEVELS;
    const { LINE_THICKNESS } = CONFIG;
    const { W, H, pw, ph, margin, r } = this._dims();

    buf.fill(D.BACKGROUND);

    // Dashed net.
    const dash = Math.max(6, H * 0.04);
    const nt = Math.max(2, LINE_THICKNESS / 2);
    for (let y = dash / 2; y < H; y += dash * 2) {
      fillRect(buf, w, h, W / 2 - nt / 2, y, W / 2 + nt / 2, y + dash, D.GRID);
    }

    // Score tallies along the top: left score left of the net, right score right.
    const s = Math.max(6, W * 0.015);
    const ty = Math.max(8, H * 0.05);
    for (let i = 0; i < this.scoreL; i++) {
      const x1 = W / 2 - s * 2 - i * (s + s * 0.6);
      fillRect(buf, w, h, x1 - s, ty, x1, ty + s, D.MARK);
    }
    for (let i = 0; i < this.scoreR; i++) {
      const x0 = W / 2 + s * 2 + i * (s + s * 0.6);
      fillRect(buf, w, h, x0, ty, x0 + s, ty + s, D.MARK);
    }

    // Paddles.
    fillRect(buf, w, h, margin, this.ay - ph / 2, margin + pw, this.ay + ph / 2, D.MARK);
    fillRect(buf, w, h, W - margin - pw, this.py - ph / 2, W - margin, this.py + ph / 2, D.MARK);

    // Ball.
    if (!this.over) fillCircle(buf, w, h, this.bx, this.by, r, D.CURSOR);
  }

  statusText() {
    if (this.over) {
      return `${this.winner} win${this.winner === 'You' ? '' : 's'} ${this.scoreL}–${this.scoreR} — Enter or New Game`;
    }
    return `Computer ${this.scoreL} – ${this.scoreR} You  ·  ↑/↓ or mouse`;
  }
}
