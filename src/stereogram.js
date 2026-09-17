// Single Image Random Dot Stereogram renderer.
// Uses a center-out constraint-propagation pass so a localized depth
// change only ripples toward the nearest edge (smaller delta volume,
// steadier fused image).
//
// Pixels are linked with a small union-find; the classic
// Thimbleby/Inglis/Witten hidden-surface test skips constraints for
// surface points one eye can't see. Colors are assigned by sampling the
// noise ribbon at each pixel's anchor column, so the output never depends
// on the order pixels are visited in.
//
// The noise ribbon can be animated: the base noise may be regenerated at a
// fixed frequency (NOISE_REGEN_HZ) and textures may drift/pulse over time.

import { CONFIG, effectivePatternWidth } from './config.js';

// Small deterministic PRNG (mulberry32) so a seed reproduces a ribbon.
function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A cheap value-noise / plasma field, seeded & deterministic.
function hash2(ix, iy, seed) {
  let h = (ix * 374761393 + iy * 668265263 + seed * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

function valueNoise(x, y, scale, seed) {
  const gx = x / scale;
  const gy = y / scale;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const fx = smooth(gx - x0);
  const fy = smooth(gy - y0);
  const v00 = hash2(x0, y0, seed);
  const v10 = hash2(x0 + 1, y0, seed);
  const v01 = hash2(x0, y0 + 1, seed);
  const v11 = hash2(x0 + 1, y0 + 1, seed);
  const a = v00 + (v10 - v00) * fx;
  const b = v01 + (v11 - v01) * fx;
  return a + (b - a) * fy;
}

// Positive modulo for wrapping drifting texture coordinates.
function wrap(v, m) {
  return ((v % m) + m) % m;
}

// Precompute a stable random color pattern (noise ribbon) so the
// background stays steady frame-to-frame; only depth shifts ripple.
// Honors CONFIG noise + texture parameters. `seed` drives the base noise,
// `time` (seconds) drives texture drift / pulse when ANIMATE is on.
function buildPattern(patternWidth, height, seed, time) {
  const pattern = new Uint8Array(patternWidth * height * 3);
  const rng = makeRng(seed);
  const contrast = CONFIG.NOISE_CONTRAST;
  const mode = CONFIG.NOISE_MODE;
  const density = CONFIG.NOISE_DENSITY;

  const texture = CONFIG.NOISE_TEXTURE || 'none';
  const texScale = Math.max(1, CONFIG.NOISE_TEXTURE_SCALE || 16);
  let texStrength = Math.max(0, Math.min(1, CONFIG.NOISE_TEXTURE_STRENGTH ?? 0));
  // Plasma uses the base seed (not the regen-bumped one) so the texture
  // field stays put while the noise underneath regenerates.
  const texSeed = CONFIG.NOISE_SEED || 1;

  // Time-based texture animation.
  const animate = !!CONFIG.ANIMATE;
  const t = animate ? time || 0 : 0;
  const offX = animate ? (CONFIG.TEXTURE_DRIFT_X || 0) * t : 0;
  const offY = animate ? (CONFIG.TEXTURE_DRIFT_Y || 0) * t : 0;
  const pulse = animate ? CONFIG.TEXTURE_PULSE_HZ || 0 : 0;
  if (pulse > 0) texStrength *= 0.5 + 0.5 * Math.sin(2 * Math.PI * pulse * t);

  // Scale a raw 0..1 value around mid-gray by contrast.
  const scale = (v) => {
    const c = 0.5 + (v - 0.5) * contrast;
    return Math.max(0, Math.min(255, (c * 256) | 0));
  };

  // Texture field at (x, y) -> 0..1, or null when texture is 'none'.
  const texAt = (x, y) => {
    const tx = x + offX;
    const ty = y + offY;
    switch (texture) {
      case 'stripes':
        return 0.5 + 0.5 * Math.sin((tx / texScale) * Math.PI * 2);
      case 'checker': {
        const cx = Math.floor(tx / texScale);
        const cy = Math.floor(ty / texScale);
        return (cx + cy) & 1 ? 1 : 0;
      }
      case 'dots': {
        const cx = wrap(tx, texScale) - texScale / 2;
        const cy = wrap(ty, texScale) - texScale / 2;
        const r = Math.sqrt(cx * cx + cy * cy) / (texScale / 2);
        return r < 0.5 ? 1 : 0;
      }
      case 'plasma': {
        const n =
          0.5 * valueNoise(tx, ty, texScale, texSeed) +
          0.5 * valueNoise(tx, ty, texScale * 2, texSeed + 101);
        return Math.max(0, Math.min(1, n));
      }
      default:
        return null;
    }
  };

  // Blend a base 0..1 sample with the texture field.
  const blend = (base, x, y) => {
    const tv = texAt(x, y);
    if (tv === null) return base;
    return base * (1 - texStrength) + tv * texStrength;
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < patternWidth; x++) {
      const i = (y * patternWidth + x) * 3;
      if (mode === 'bw') {
        let v = rng() < density ? 1 : 0;
        v = blend(v, x, y);
        const on = v >= 0.5 ? 255 : 0;
        pattern[i] = on;
        pattern[i + 1] = on;
        pattern[i + 2] = on;
      } else if (mode === 'grayscale') {
        const g = scale(blend(rng(), x, y));
        pattern[i] = g;
        pattern[i + 1] = g;
        pattern[i + 2] = g;
      } else {
        // rgb
        pattern[i] = scale(blend(rng(), x, y));
        pattern[i + 1] = scale(blend(rng(), x, y));
        pattern[i + 2] = scale(blend(rng(), x, y));
      }
    }
  }
  return pattern;
}

export class Stereogram {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    // Animation state.
    this.seedOffset = 0; // bumped on each timed noise regeneration
    this.texTime = 0; // seconds; drives texture drift / pulse
    this.lastRegenMs = 0;

    this.patternWidth = effectivePatternWidth();
    this.pattern = this._build();
    this.imageData = new ImageData(width, height);
    // Scratch buffers reused each frame.
    this.same = new Int32Array(width);
  }

  _seed() {
    return (CONFIG.NOISE_SEED || 1) + this.seedOffset;
  }

  _build() {
    return buildPattern(this.patternWidth, this.height, this._seed(), this.texTime);
  }

  // Resize the render target (changes resolution, reallocates buffers).
  resize(width, height) {
    this.width = width;
    this.height = height;
    this.imageData = new ImageData(width, height);
    this.same = new Int32Array(width);
    this.rebuildPattern();
  }

  // Rebuild the noise ribbon (call when noise or pattern params change).
  rebuildPattern() {
    this.patternWidth = effectivePatternWidth();
    this.pattern = this._build();
  }

  // Advance ribbon animation. Returns true if the ribbon changed and the
  // stereogram needs re-rendering.
  update(nowMs) {
    if (!CONFIG.ANIMATE) return false;
    let rebuild = false;

    const hz = CONFIG.NOISE_REGEN_HZ || 0;
    if (hz > 0 && nowMs - this.lastRegenMs >= 1000 / hz) {
      this.lastRegenMs = nowMs;
      this.seedOffset++;
      rebuild = true;
    }

    const textured = (CONFIG.NOISE_TEXTURE || 'none') !== 'none';
    const moving =
      textured &&
      (CONFIG.TEXTURE_DRIFT_X || CONFIG.TEXTURE_DRIFT_Y || CONFIG.TEXTURE_PULSE_HZ);
    if (moving) {
      this.texTime = nowMs / 1000;
      rebuild = true;
    }

    if (rebuild) this.rebuildPattern();
    return rebuild;
  }

  // Separation (in px) between the two eye-images for a given depth z (0..1).
  _separation(z) {
    const E = CONFIG.EYE_SEPARATION_PX;
    const mu = CONFIG.MU;
    return Math.round(((1 - mu * z) * E) / (2 - mu * z));
  }

  renderStereogram(ctx, depthBuffer) {
    const { width, height, same, pattern } = this;
    const patternWidth = this.patternWidth;
    const data = this.imageData.data;
    const center = width >> 1;
    const E = CONFIG.EYE_SEPARATION_PX;
    const mu = CONFIG.MU;

    // Follow link chains to the representative anchor, compressing the
    // path so repeated lookups are cheap.
    const find = (x) => {
      let r = x;
      while (same[r] !== r) r = same[r];
      let c = x;
      while (same[c] !== r) {
        const next = same[c];
        same[c] = r;
        c = next;
      }
      return r;
    };

    // Union two pixels' anchor sets (root-to-root, so no cycles and no
    // constraint is ever silently overwritten). The surviving anchor is
    // the one nearer the center column, keeping the seam stable around
    // the middle of the image.
    const link = (a, b, keepHigher) => {
      const ra = find(a);
      const rb = find(b);
      if (ra === rb) return;
      if (keepHigher ? ra < rb : ra > rb) same[ra] = rb;
      else same[rb] = ra;
    };

    // Hidden-surface test (Thimbleby/Inglis/Witten): only constrain a
    // surface point if neither eye's line of sight is blocked by a
    // nearer point. Without it, background pixels just behind a raised
    // edge get tied to foreground pixels and ghost.
    const visible = (rowOff, x, z) => {
      let t = 1;
      let zt;
      do {
        zt = z + (2 * (2 - mu * z) * t) / (mu * E);
        const xl = x - t;
        const xr = x + t;
        if (xl >= 0 && depthBuffer[rowOff + xl] >= zt) return false;
        if (xr < width && depthBuffer[rowOff + xr] >= zt) return false;
        t++;
      } while (zt < 1);
      return true;
    };

    for (let y = 0; y < height; y++) {
      const rowOff = y * width;
      const rowPat = y * patternWidth;

      // Each pixel initially links to itself.
      for (let x = 0; x < width; x++) same[x] = x;

      // --- Center-out constraint propagation ---
      // Walk outward from the center column in both directions so a
      // localized depth edit only ripples toward the nearer screen edge.
      for (let d = 0; d <= center; d++) {
        // Rightward half.
        const xr = center + d;
        if (xr < width) {
          const z = depthBuffer[rowOff + xr];
          const sep = this._separation(z);
          const left = xr - (sep >> 1);
          const right = left + sep;
          if (left >= 0 && right < width && visible(rowOff, xr, z)) {
            link(left, right, false);
          }
        }
        // Leftward half.
        const xl = center - d;
        if (d !== 0 && xl >= 0) {
          const z = depthBuffer[rowOff + xl];
          const sep = this._separation(z);
          const left = xl - (sep >> 1);
          const right = left + sep;
          if (left >= 0 && right < width && visible(rowOff, xl, z)) {
            link(left, right, true);
          }
        }
      }

      // Assign colors: every pixel takes the ribbon color at its anchor's
      // column. Sampling the ribbon directly (instead of copying from the
      // output buffer) makes the result independent of visiting order.
      // Previously, left-half pixels copied from anchors to their right
      // that hadn't been written yet this frame and picked up stale
      // colors from the previous render.
      for (let x = 0; x < width; x++) {
        const anchor = find(x);
        const p = ((anchor % patternWidth) + rowPat) * 3;
        const idx = (rowOff + x) * 4;
        data[idx] = pattern[p];
        data[idx + 1] = pattern[p + 1];
        data[idx + 2] = pattern[p + 2];
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(this.imageData, 0, 0);
  }
}