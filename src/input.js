// Routes canvas mouse events and document keyboard events to the active
// game mode. Every mode handler returns true when a redraw is needed.

function inFormField(e) {
  const t = e.target;
  return t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA');
}

export class Input {
  // getMode(): returns the currently active mode. onChange(): mark dirty.
  constructor(canvas, getMode, onChange) {
    this.canvas = canvas;
    this.getMode = getMode;
    this.onChange = onChange;
    this.cursorPixel = null; // { x, y } in canvas coords, or null

    canvas.addEventListener('mousemove', (e) => {
      const { x, y } = this._toCanvas(e);
      this.cursorPixel = { x, y };
      if (this.getMode().onMove(x, y)) this.onChange();
    });

    canvas.addEventListener('mouseleave', () => {
      this.cursorPixel = null;
      if (this.getMode().onLeave()) this.onChange();
    });

    canvas.addEventListener('click', (e) => {
      const { x, y } = this._toCanvas(e);
      if (this.getMode().onClick(x, y)) this.onChange();
    });

    document.addEventListener('keydown', (e) => {
      if (inFormField(e)) return;
      if (this.getMode().onKeyDown(e)) {
        e.preventDefault();
        this.onChange();
      }
    });

    document.addEventListener('keyup', (e) => {
      if (inFormField(e)) return;
      if (this.getMode().onKeyUp(e)) {
        e.preventDefault();
        this.onChange();
      }
    });
  }

  // Convert a client event into canvas-space pixel coordinates,
  // accounting for CSS scaling of the canvas element.
  _toCanvas(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }
}
