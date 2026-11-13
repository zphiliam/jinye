export class Input {
  keys = new Set<string>();
  pressed = new Set<string>();
  mouseX = 0; mouseY = 0;
  mouseDown = false;
  clicked = false;
  rightClicked = false;
  wheel = 0;
  overUI = false;
  constructor(private canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab') e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    window.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX; this.mouseY = e.clientY;
      this.overUI = e.target !== canvas;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.mouseDown = true; this.clicked = true; }
      if (e.button === 2) this.rightClicked = true;
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.mouseDown = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
  }
  down(c: string) { return this.keys.has(c); }
  hit(c: string) { return this.pressed.has(c); }
  endFrame() { this.pressed.clear(); this.clicked = false; this.rightClicked = false; this.wheel = 0; }
}
