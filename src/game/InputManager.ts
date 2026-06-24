export class InputManager {
  private down = new Set<string>();
  private pressed = new Set<string>();

  constructor() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.clear);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (!this.down.has(k)) {
      this.pressed.add(k);
    }
    this.down.add(k);
    if (
      [
        'w',
        'a',
        's',
        'd',
        ' ',
        'e',
        'shift',
        '1',
        '2',
        '3',
        '4',
        '5',
        '6',
      ].includes(k)
    ) {
      e.preventDefault();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.down.delete(e.key.toLowerCase());
  };

  private clear = () => {
    this.down.clear();
    this.pressed.clear();
  };

  isDown(k: string): boolean {
    return this.down.has(k.toLowerCase());
  }

  justPressed(k: string): boolean {
    return this.pressed.has(k.toLowerCase());
  }

  endFrame() {
    this.pressed.clear();
  }

  destroy() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.clear);
  }
}
