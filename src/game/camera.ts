import { type Vec2, clamp, damp, noise1 } from '../core/math';

export interface CameraSettings {
  shake: number; // 0..1
}

/** Smooth follow with velocity look-ahead, speed-aware zoom and trauma-based shake. */
export class Camera {
  pos: Vec2 = { x: 0, y: 0 };
  zoom = 1;
  private look: Vec2 = { x: 0, y: 0 };
  private trauma = 0;
  private t = 0;
  shakeOffset: Vec2 = { x: 0, y: 0 };
  /** Zoom that fits a comfortable slice of world on screen. Small (phone landscape) screens see less, so the ball stays readable. */
  fitZoom(viewH: number): number {
    return viewH / (viewH < 500 ? 520 : 720);
  }

  constructor(public settings: CameraSettings) {}

  snap(p: Vec2): void {
    this.pos = { ...p };
    this.look = { x: 0, y: 0 };
  }

  addTrauma(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount * this.settings.shake);
  }

  update(dt: number, target: Vec2, vel: Vec2, viewW: number, viewH: number, bounds?: { x: number; y: number; w: number; h: number }): void {
    this.t += dt;
    // Look ahead in the direction of travel, more horizontally than vertically.
    const lx = clamp(vel.x * 0.3, -260, 260);
    const ly = clamp(vel.y * 0.18, -140, 180);
    this.look.x += (lx - this.look.x) * damp(3, dt);
    this.look.y += (ly - this.look.y) * damp(2.5, dt);
    const tx = target.x + this.look.x;
    const ty = target.y + this.look.y - 40;
    // Vertical follow speeds up when falling fast so the ball never leaves the screen.
    const vRate = 4 + clamp(Math.abs(vel.y) / 250, 0, 6);
    this.pos.x += (tx - this.pos.x) * damp(6, dt);
    this.pos.y += (ty - this.pos.y) * damp(vRate, dt);

    const fit = this.fitZoom(viewH);
    const speed = Math.hypot(vel.x, vel.y);
    const targetZoom = fit * (1 - clamp((speed - 500) / 4000, 0, 0.12));
    this.zoom += (targetZoom - this.zoom) * damp(2, dt);

    if (bounds) {
      const hw = viewW / 2 / this.zoom;
      const hh = viewH / 2 / this.zoom;
      if (bounds.w > hw * 2) this.pos.x = clamp(this.pos.x, bounds.x + hw, bounds.x + bounds.w - hw);
      else this.pos.x = bounds.x + bounds.w / 2;
      if (bounds.h > hh * 2) this.pos.y = clamp(this.pos.y, bounds.y + hh, bounds.y + bounds.h - hh);
      else this.pos.y = bounds.y + bounds.h / 2;
    }

    this.trauma = Math.max(0, this.trauma - dt * 1.8);
    const s = this.trauma * this.trauma * 18;
    this.shakeOffset = { x: noise1(this.t * 30) * s, y: noise1(this.t * 30 + 50) * s };
  }

  worldToScreen(p: Vec2, viewW: number, viewH: number): Vec2 {
    return {
      x: (p.x - this.pos.x) * this.zoom + viewW / 2,
      y: (p.y - this.pos.y) * this.zoom + viewH / 2,
    };
  }
}
