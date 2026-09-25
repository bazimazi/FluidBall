import { rng } from '../core/math';

export type ParticleShape = 'dot' | 'streak' | 'spark' | 'ring' | 'square';

interface Particle {
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  gravity: number;
  drag: number;
  shape: ParticleShape;
}

export interface BurstOptions {
  count: number;
  color: string;
  speed: number;
  /** Direction in radians; with spread < 2PI particles go in a cone. */
  angle?: number;
  spread?: number;
  life?: number;
  size?: number;
  gravity?: number;
  drag?: number;
  shape?: ParticleShape;
}

/** Fixed-size pool: no allocation during play. */
export class Particles {
  private pool: Particle[];
  private rand = rng(7);
  private cursor = 0;
  /** 0..1 multiplier from the reduced-effects setting. */
  density = 1;

  constructor(size = 700) {
    this.pool = Array.from({ length: size }, () => ({
      alive: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      max: 1,
      size: 2,
      color: '#fff',
      gravity: 0,
      drag: 0,
      shape: 'dot' as ParticleShape,
    }));
  }

  burst(x: number, y: number, o: BurstOptions): void {
    const n = Math.round(o.count * this.density);
    const spread = o.spread ?? Math.PI * 2;
    const base = o.angle ?? 0;
    for (let i = 0; i < n; i++) {
      // Round-robin: when the pool is full the oldest particle is recycled.
      const p = this.pool[this.cursor];
      this.cursor = (this.cursor + 1) % this.pool.length;
      const a = base + (this.rand() - 0.5) * spread;
      const s = o.speed * (0.35 + this.rand() * 0.65);
      p.alive = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * s;
      p.vy = Math.sin(a) * s;
      p.max = p.life = (o.life ?? 0.6) * (0.6 + this.rand() * 0.4);
      p.size = (o.size ?? 3) * (0.6 + this.rand() * 0.6);
      p.color = o.color;
      p.gravity = o.gravity ?? 0;
      p.drag = o.drag ?? 2;
      p.shape = o.shape ?? 'dot';
    }
  }

  update(dt: number): void {
    for (const p of this.pool) {
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        continue;
      }
      const d = Math.exp(-p.drag * dt);
      p.vx *= d;
      p.vy = p.vy * d + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  clear(): void {
    for (const p of this.pool) p.alive = false;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.pool) {
      if (!p.alive) continue;
      const k = p.life / p.max;
      ctx.globalAlpha = Math.min(1, k * 1.5);
      ctx.fillStyle = p.color;
      ctx.strokeStyle = p.color;
      switch (p.shape) {
        case 'dot':
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (0.5 + k * 0.5), 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'square':
          ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
          break;
        case 'streak':
        case 'spark': {
          ctx.lineWidth = p.shape === 'spark' ? 1.5 : p.size * 0.6;
          const len = p.shape === 'spark' ? 0.03 : 0.05;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * len, p.y - p.vy * len);
          ctx.stroke();
          break;
        }
        case 'ring':
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1 + (1 - k) * 4), 0, Math.PI * 2);
          ctx.stroke();
          break;
      }
    }
    ctx.globalAlpha = 1;
  }
}
