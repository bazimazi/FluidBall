import type { BallState } from '../physics/ball';
import { MATERIALS, type MaterialId } from '../physics/materials';
import { SURFACES } from '../physics/surfaces';
import type { Audio } from './audio';
import type { Camera } from './camera';
import type { Particles } from './particles';
import type { GameEvent } from './session';

/**
 * Turns simulation events into particles, sound, camera shake and haptics.
 * Every material has its own impact/trail language so state reads at a glance.
 */
export class Feedback {
  haptics = true;
  private trailTimer = 0;

  constructor(
    private particles: Particles,
    private audio: Audio,
    private camera: Camera,
  ) {}

  private buzz(ms: number): void {
    if (this.haptics && 'vibrate' in navigator) {
      try {
        navigator.vibrate(ms);
      } catch {
        // Unsupported: ignore.
      }
    }
  }

  handle(events: GameEvent[]): void {
    const P = this.particles;
    for (const e of events) {
      switch (e.type) {
        case 'impact': {
          const m = MATERIALS[e.material];
          const k = Math.min(e.speed / 1200, 1);
          const angle = Math.atan2(e.normal.y, e.normal.x);
          this.audio.impact(e.speed, e.surface, e.material);
          this.impactParticles(e.material, e.pos.x, e.pos.y, angle, k);
          if (e.surface === 'bouncer') P.burst(e.pos.x, e.pos.y, { count: 10, color: SURFACES.bouncer.edge, speed: 300, angle, spread: 1.4, shape: 'spark', life: 0.4 });
          this.camera.addTrauma(k * k * 0.5 * m.mass);
          if (k > 0.4) this.buzz(Math.round(10 + k * 20));
          break;
        }
        case 'land':
          break;
        case 'jump':
          this.audio.jump(e.material);
          P.burst(e.pos.x, e.pos.y + 14, { count: 6, color: MATERIALS[e.material].accent, speed: 120, angle: Math.PI / 2, spread: 2.5, life: 0.3, size: 2.5 });
          break;
        case 'airImpulse':
          this.audio.airImpulse(e.material);
          P.burst(e.pos.x, e.pos.y, {
            count: 14,
            color: MATERIALS[e.material].accent,
            speed: 260,
            angle: Math.atan2(-e.dir.y, -e.dir.x),
            spread: 1.2,
            life: 0.45,
            shape: e.material === 'water' ? 'dot' : 'streak',
          });
          P.burst(e.pos.x, e.pos.y, { count: 1, color: MATERIALS[e.material].accent, speed: 0, shape: 'ring', life: 0.4, size: 10 });
          this.buzz(12);
          break;
        case 'transform': {
          const m = MATERIALS[e.to];
          this.audio.transform(e.to, e.effect);
          if (e.effect === 'steam') {
            P.burst(e.pos.x, e.pos.y, { count: 40, color: 'rgba(230,240,255,0.8)', speed: 420, angle: -Math.PI / 2, spread: 2, life: 1.1, size: 7, gravity: -300, drag: 3 });
            this.camera.addTrauma(0.5);
          } else if (e.effect === 'ignite') {
            P.burst(e.pos.x, e.pos.y, { count: 30, color: '#ffb020', speed: 500, life: 0.6, shape: 'spark' });
            this.camera.addTrauma(0.4);
          }
          P.burst(e.pos.x, e.pos.y, { count: 22, color: m.accent, speed: 280, life: 0.6, size: 3.5 });
          P.burst(e.pos.x, e.pos.y, { count: 1, color: m.color, speed: 0, shape: 'ring', life: 0.5, size: 14 });
          this.buzz(25);
          break;
        }
        case 'revert':
          this.audio.transform(e.to);
          P.burst(e.pos.x, e.pos.y, { count: 12, color: MATERIALS[e.from].accent, speed: 140, life: 0.5, size: 2.5 });
          break;
        case 'break':
          this.audio.breakSound(e.surface);
          P.burst(e.pos.x, e.pos.y, {
            count: 26,
            color: SURFACES[e.surface].edge,
            speed: 420,
            life: 0.8,
            shape: 'square',
            size: 6,
            gravity: e.surface === 'frost' ? 300 : 1400,
            drag: 1,
          });
          this.camera.addTrauma(0.45);
          this.buzz(35);
          break;
        case 'death':
          this.audio.death();
          P.burst(e.pos.x, e.pos.y, { count: 30, color: '#ff6060', speed: 380, life: 0.7, size: 4 });
          P.burst(e.pos.x, e.pos.y, { count: 1, color: '#ffffff', speed: 0, shape: 'ring', life: 0.4, size: 16 });
          this.camera.addTrauma(0.6);
          this.buzz(60);
          break;
        case 'checkpoint':
          this.audio.checkpoint();
          P.burst(e.pos.x, e.pos.y - 40, { count: 18, color: '#7dffb0', speed: 200, life: 0.7 });
          break;
        case 'fragment':
          this.audio.fragment();
          P.burst(e.pos.x, e.pos.y, { count: 24, color: '#b4ffff', speed: 260, life: 0.8, shape: 'spark' });
          this.buzz(20);
          break;
        case 'finish':
          this.audio.win();
          break;
        case 'respawn':
          P.burst(e.pos.x, e.pos.y, { count: 1, color: '#ffffff', speed: 0, shape: 'ring', life: 0.35, size: 20 });
          break;
      }
    }
  }

  private impactParticles(material: MaterialId, x: number, y: number, angle: number, k: number): void {
    const P = this.particles;
    const n = Math.round(4 + k * 14);
    switch (material) {
      case 'water':
        P.burst(x, y, { count: n + 4, color: '#8fd0ff', speed: 150 + k * 300, angle, spread: 2.2, life: 0.6, gravity: 1200, size: 3 });
        break;
      case 'ice':
        P.burst(x, y, { count: n, color: '#e6ffff', speed: 200 + k * 400, angle, spread: 2.4, life: 0.35, shape: 'spark' });
        break;
      case 'mud':
        P.burst(x, y, { count: n + 4, color: '#8a6038', speed: 100 + k * 250, angle, spread: 2.4, life: 0.7, gravity: 1400, size: 4, shape: 'square' });
        break;
      case 'lava':
        P.burst(x, y, { count: n, color: '#ffb020', speed: 150 + k * 300, angle, spread: 2.6, life: 0.5, gravity: -200, shape: 'spark' });
        break;
      case 'oil':
        P.burst(x, y, { count: Math.round(n / 2), color: '#c86bff', speed: 80 + k * 200, angle, spread: 2, life: 0.5, gravity: 800 });
        break;
      case 'wind':
        P.burst(x, y, { count: n, color: 'rgba(210,255,240,0.8)', speed: 150 + k * 250, angle, spread: 3, life: 0.4, shape: 'streak', drag: 5 });
        break;
      default:
        if (k > 0.2) P.burst(x, y, { count: Math.round(n / 2), color: 'rgba(220,220,210,0.7)', speed: 80 + k * 200, angle, spread: 2.2, life: 0.4, gravity: 900, size: 2.5 });
    }
  }

  /** Continuous per-material trail and ambient audio. */
  trail(ball: BallState, dt: number): void {
    const speed = Math.hypot(ball.vel.x, ball.vel.y);
    this.audio.updateBed(ball.material, speed, ball.grounded, ball.inFluid > 0.3);
    this.trailTimer -= dt;
    if (this.trailTimer > 0) return;
    this.trailTimer = 0.04;
    const P = this.particles;
    const { x, y } = ball.pos;
    const back = Math.atan2(-ball.vel.y, -ball.vel.x);
    switch (ball.material) {
      case 'lava':
        P.burst(x, y, { count: 2, color: '#ffb020', speed: 60, angle: -Math.PI / 2, spread: 1.5, life: 0.6, gravity: -150, size: 2.5 });
        break;
      case 'ice':
        if (speed > 300) P.burst(x, y + 10, { count: 1, color: '#e6ffff', speed: 30, angle: back, spread: 0.5, life: 0.4, shape: 'spark' });
        break;
      case 'oil':
        if (speed > 200 && ball.touching) P.burst(x, y, { count: 1, color: 'rgba(200,107,255,0.6)', speed: 10, life: 0.5, size: 5 });
        break;
      case 'wind':
        P.burst(x, y, { count: 1, color: 'rgba(210,255,240,0.6)', speed: 60 + speed * 0.2, angle: back, spread: 0.6, life: 0.35, shape: 'streak' });
        break;
      case 'zerog':
        P.burst(x, y, { count: 1, color: '#7df9ff', speed: 25, life: 0.9, size: 2 });
        break;
      case 'water':
        if (ball.inFluid > 0.5 && speed > 80) P.burst(x, y, { count: 1, color: 'rgba(200,235,255,0.7)', speed: 40, angle: -Math.PI / 2, spread: 1, life: 0.8, gravity: -120, size: 3 });
        else if (speed > 250 && ball.grounded) P.burst(x, y + 12, { count: 1, color: '#8fd0ff', speed: 60, angle: back, spread: 1, life: 0.4, gravity: 800, size: 2 });
        break;
      case 'mud':
        if (speed > 120 && ball.grounded) P.burst(x, y + 12, { count: 1, color: '#6b4a2b', speed: 50, angle: back, spread: 1, life: 0.5, gravity: 900, size: 3, shape: 'square' });
        break;
    }
  }
}
