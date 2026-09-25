import type { BallInput } from '../physics/ball';

export interface TouchStick {
  active: boolean;
  originX: number;
  originY: number;
  x: number;
  y: number;
}

export interface InputSettings {
  leftHanded: boolean;
  /** Stick travel in CSS px for full deflection (smaller = more sensitive). */
  stickRadius: number;
  deadzone: number;
}

/**
 * Keyboard + touch. Touch: a floating stick on one half of the screen, jump on the other.
 * Jump presses are latched so a tap between physics steps is never lost.
 */
export class Input {
  private keys = new Set<string>();
  private pressedLatch = false;
  private touchJump = new Set<number>();
  private stickId: number | null = null;
  readonly stick: TouchStick = { active: false, originX: 0, originY: 0, x: 0, y: 0 };
  /** One-shot actions for the game layer (restart, pause, lab keys...). */
  private actions: string[] = [];
  touchSeen = false;

  constructor(
    private el: HTMLElement,
    public settings: InputSettings,
  ) {
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => this.clear());
    el.addEventListener('touchstart', (e) => this.onTouch(e), { passive: false });
    el.addEventListener('touchmove', (e) => this.onTouch(e), { passive: false });
    el.addEventListener('touchend', (e) => this.onTouch(e), { passive: false });
    el.addEventListener('touchcancel', (e) => this.onTouch(e), { passive: false });
  }

  clear(): void {
    this.keys.clear();
    this.touchJump.clear();
    this.stickId = null;
    this.stick.active = false;
    this.pressedLatch = false;
  }

  private isJumpKey = (code: string) => code === 'Space' || code === 'KeyW' || code === 'ArrowUp' || code === 'KeyK' || code === 'KeyZ';

  private onKey(e: KeyboardEvent, down: boolean): void {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
    if (down && !e.repeat) {
      if (this.isJumpKey(e.code)) this.pressedLatch = true;
      this.actions.push(e.code);
    }
    if (down) this.keys.add(e.code);
    else this.keys.delete(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  }

  private onTouch(e: TouchEvent): void {
    e.preventDefault();
    this.touchSeen = true;
    const w = this.el.clientWidth;
    const stickSideLeft = !this.settings.leftHanded;
    for (const t of Array.from(e.changedTouches)) {
      const onStickSide = stickSideLeft ? t.clientX < w * 0.5 : t.clientX >= w * 0.5;
      if (e.type === 'touchstart') {
        if (onStickSide && this.stickId === null) {
          this.stickId = t.identifier;
          Object.assign(this.stick, { active: true, originX: t.clientX, originY: t.clientY, x: t.clientX, y: t.clientY });
        } else if (!onStickSide) {
          this.touchJump.add(t.identifier);
          this.pressedLatch = true;
        }
      } else if (e.type === 'touchmove') {
        if (t.identifier === this.stickId) {
          this.stick.x = t.clientX;
          this.stick.y = t.clientY;
          // Let the stick origin trail the finger so reversing direction is quick.
          const r = this.settings.stickRadius;
          const dx = this.stick.x - this.stick.originX;
          const dy = this.stick.y - this.stick.originY;
          const d = Math.hypot(dx, dy);
          if (d > r * 1.4) {
            this.stick.originX = this.stick.x - (dx / d) * r * 1.4;
            this.stick.originY = this.stick.y - (dy / d) * r * 1.4;
          }
        }
      } else {
        if (t.identifier === this.stickId) {
          this.stickId = null;
          this.stick.active = false;
        }
        this.touchJump.delete(t.identifier);
      }
    }
  }

  /** Sample for one physics step. Consumes the jump latch. */
  sample(): BallInput {
    const k = this.keys;
    let x = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
    let y = (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0) - (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0);
    if (this.stick.active) {
      const r = this.settings.stickRadius;
      let sx = (this.stick.x - this.stick.originX) / r;
      let sy = (this.stick.y - this.stick.originY) / r;
      const m = Math.hypot(sx, sy);
      if (m < this.settings.deadzone) {
        sx = 0;
        sy = 0;
      } else if (m > 1) {
        sx /= m;
        sy /= m;
      }
      x = sx;
      y = sy;
    }
    const jump = this.isJumpHeld();
    const jumpPressed = this.pressedLatch;
    this.pressedLatch = false;
    return { x, y, jump: jump || jumpPressed, jumpPressed };
  }

  private isJumpHeld(): boolean {
    for (const c of ['Space', 'KeyW', 'ArrowUp', 'KeyK', 'KeyZ']) if (this.keys.has(c)) return true;
    return this.touchJump.size > 0;
  }

  get jumpTouchActive(): boolean {
    return this.touchJump.size > 0;
  }

  drainActions(): string[] {
    const a = this.actions;
    this.actions = [];
    return a;
  }
}
