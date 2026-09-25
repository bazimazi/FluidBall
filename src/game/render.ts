import { type Vec2, clamp } from '../core/math';
import type { LevelDef } from '../levels/types';
import type { BallState } from '../physics/ball';
import { MATERIALS, type MaterialDefinition, type MaterialPattern } from '../physics/materials';
import { SURFACES } from '../physics/surfaces';
import { type WorldState, type Zone, isSegmentActive } from '../physics/world';
import type { PhysicsWorld } from '../physics/world';
import type { Camera } from './camera';
import type { TouchStick } from './input';
import type { Particles } from './particles';
import { CHECKPOINT_RADIUS } from './session';

// ------------------------------------------------------------ material glyphs

/** Draws a material's pattern inside a circle of radius r at the origin. Shared by ball and UI icons. */
export function drawGlyph(ctx: CanvasRenderingContext2D, pattern: MaterialPattern, r: number, color: string): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1.5, r * 0.14);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  switch (pattern) {
    case 'ring':
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case 'waves':
      for (const oy of [-0.25, 0.2]) {
        ctx.beginPath();
        for (let i = 0; i <= 12; i++) {
          const x = (-0.6 + (1.2 * i) / 12) * r;
          const y = oy * r + Math.sin((i / 12) * Math.PI * 2) * r * 0.14;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      break;
    case 'gloss':
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.55, Math.PI * 1.1, Math.PI * 1.6);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-r * 0.25, -r * 0.3, r * 0.12, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'crystal':
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI) / 3;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6);
        ctx.lineTo(-Math.cos(a) * r * 0.6, -Math.sin(a) * r * 0.6);
        ctx.stroke();
      }
      break;
    case 'flame':
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.62);
      ctx.quadraticCurveTo(r * 0.5, 0, r * 0.28, r * 0.38);
      ctx.quadraticCurveTo(0, r * 0.6, -r * 0.28, r * 0.38);
      ctx.quadraticCurveTo(-r * 0.5, 0, 0, -r * 0.62);
      ctx.stroke();
      break;
    case 'orbit':
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.62, r * 0.25, -0.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.14, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'speckle':
      for (const [x, y, s] of [
        [-0.3, -0.25, 0.13],
        [0.3, -0.1, 0.1],
        [-0.05, 0.3, 0.14],
        [0.32, 0.35, 0.08],
        [-0.38, 0.15, 0.08],
      ]) {
        ctx.beginPath();
        ctx.arc(x * r, y * r, s * r, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case 'swirl':
      ctx.beginPath();
      for (let i = 0; i <= 30; i++) {
        const t = i / 30;
        const a = t * Math.PI * 3;
        const rr = t * r * 0.6;
        const x = Math.cos(a) * rr;
        const y = Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      break;
  }
  ctx.restore();
}

export function drawBallBody(ctx: CanvasRenderingContext2D, m: MaterialDefinition, r: number, angle: number, alpha = 1): void {
  ctx.globalAlpha = alpha;
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
  g.addColorStop(0, lighten(m.color, 0.35));
  g.addColorStop(1, m.color);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = m.accent;
  ctx.stroke();
  ctx.rotate(angle);
  drawGlyph(ctx, m.pattern, r, m.accent);
  ctx.globalAlpha = 1;
}

/** Material icon as a data URL, for DOM UI. */
export function glyphIcon(m: MaterialDefinition, size = 48): string {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.translate(size / 2, size / 2);
  drawBallBody(ctx, m, size / 2 - 3, 0);
  return c.toDataURL();
}

function lighten(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const f = (c: number) => Math.round(c + (255 - c) * k);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

// ------------------------------------------------------------ scene

export interface ExtraBall {
  ball: BallState;
  pos: Vec2;
  label?: string;
  /** Stagger overlapping labels. */
  labelRow?: number;
  alpha?: number;
}

export interface SceneView {
  level: LevelDef;
  world: PhysicsWorld;
  state: WorldState;
  /** Interpolated position of the player ball. */
  ballPos: Vec2 | null;
  ball: BallState | null;
  extraBalls?: ExtraBall[];
  checkpoint: number;
  fragmentsTaken: Set<number>;
  fragmentsKnown: number[];
  time: number;
  trajectory?: Vec2[];
  reducedEffects: boolean;
}

const ZONE_STYLE: Record<NonNullable<Zone['look']>, { fill: string; line: string }> = {
  water: { fill: 'rgba(40,140,255,0.28)', line: 'rgba(150,210,255,0.8)' },
  current: { fill: 'rgba(40,140,255,0.32)', line: 'rgba(170,225,255,0.9)' },
  oil: { fill: 'rgba(90,40,140,0.55)', line: 'rgba(200,120,255,0.9)' },
  ice: { fill: 'rgba(160,240,255,0.18)', line: 'rgba(200,250,255,0.8)' },
  lava: { fill: 'rgba(255,90,20,0.45)', line: 'rgba(255,210,60,0.95)' },
  zerog: { fill: 'rgba(40,50,120,0.25)', line: 'rgba(125,249,255,0.5)' },
  mud: { fill: 'rgba(110,75,40,0.6)', line: 'rgba(176,132,82,0.9)' },
  wind: { fill: 'rgba(120,255,200,0.05)', line: 'rgba(170,255,220,0.3)' },
  thermal: { fill: 'rgba(255,160,80,0.08)', line: 'rgba(255,200,140,0.5)' },
  well: { fill: 'rgba(125,249,255,0.05)', line: 'rgba(125,249,255,0.45)' },
  hazard: { fill: 'rgba(255,40,40,0.25)', line: 'rgba(255,80,80,0.8)' },
  reset: { fill: 'rgba(255,255,255,0.08)', line: 'rgba(255,255,255,0.5)' },
};

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  dpr = 1;
  width = 0;
  height = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
  }

  resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = this.canvas.clientWidth;
    this.height = this.canvas.clientHeight;
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
  }

  draw(view: SceneView, cam: Camera, particles: Particles): void {
    const ctx = this.ctx;
    const W = this.width;
    const H = this.height;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.background(view, cam);

    ctx.save();
    ctx.translate(W / 2 + cam.shakeOffset.x, H / 2 + cam.shakeOffset.y);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.pos.x, -cam.pos.y);

    for (const z of view.level.zones) this.zone(z, view.time, view.reducedEffects);
    this.solids(view);
    this.signs(view);
    this.checkpoints(view);
    this.goal(view);
    this.fragments(view);
    if (view.trajectory) this.trajectory(view.trajectory);
    particles.draw(ctx);
    for (const e of view.extraBalls ?? []) this.ball(e.ball, e.pos, e.alpha ?? 0.55, e.label, e.labelRow);
    if (view.ball && view.ballPos && !view.ball.dead) this.ball(view.ball, view.ballPos, 1);

    ctx.restore();
  }

  private background(view: SceneView, cam: Camera): void {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, this.height);
    const top = REGION_BG[view.level.region] ?? ['#0d1020', '#1b2036'];
    g.addColorStop(0, top[0]);
    g.addColorStop(1, top[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.width, this.height);
    // Parallax dust: gives a sense of speed without competing with gameplay.
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    const spacing = 90;
    const px = -(cam.pos.x * 0.3 * cam.zoom) % spacing;
    const py = -(cam.pos.y * 0.3 * cam.zoom) % spacing;
    for (let x = px - spacing; x < this.width + spacing; x += spacing) {
      for (let y = py - spacing; y < this.height + spacing; y += spacing) {
        ctx.fillRect(x, y, 2, 2);
      }
    }
  }

  private zone(z: Zone, t: number, reduced: boolean): void {
    const ctx = this.ctx;
    const style = ZONE_STYLE[z.look ?? (z.hazard ? 'hazard' : 'reset')];
    ctx.save();
    this.shapePath(z);
    ctx.fillStyle = style.fill;
    ctx.fill();
    ctx.clip();
    ctx.strokeStyle = style.line;
    ctx.fillStyle = style.line;
    const s = z.shape;
    const bx = s.type === 'rect' ? s.x : s.x - s.r;
    const by = s.type === 'rect' ? s.y : s.y - s.r;
    const bw = s.type === 'rect' ? s.w : s.r * 2;
    const bh = s.type === 'rect' ? s.h : s.r * 2;
    const anim = reduced ? 0 : t;

    if (z.force && z.force.kind !== 'gravityWell') {
      // Moving chevrons show direction and strength.
      const d = z.force.dir ?? { x: 1, y: 0 };
      const speed = 40 + z.force.strength * 0.08;
      const step = 70;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.6;
      const off = (anim * speed) % step;
      for (let a = -step; a < bw + step; a += step) {
        for (let b = -step; b < bh + step; b += step) {
          const cx = bx + a + (d.x * off) + ((b / step) % 2) * step * 0.5 * Math.abs(d.y);
          const cy = by + b + d.y * off + ((a / step) % 2) * step * 0.5 * Math.abs(d.x);
          ctx.beginPath();
          ctx.moveTo(cx - d.x * 8 - d.y * 7, cy - d.y * 8 + d.x * 7);
          ctx.lineTo(cx, cy);
          ctx.lineTo(cx - d.x * 8 + d.y * 7, cy - d.y * 8 - d.x * 7);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }
    if (z.force?.kind === 'gravityWell' && z.force.center) {
      const c = z.force.center;
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const k = ((anim * 0.4 + i / 4) % 1 + 1) % 1;
        ctx.globalAlpha = k * 0.6;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 20 + (1 - k) * (bw / 2 - 20), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 10, 0, Math.PI * 2);
      ctx.fill();
    }
    if (z.fluid && s.type === 'rect') {
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let x = s.x; x <= s.x + s.w; x += 8) {
        const y = s.y + Math.sin(x * 0.04 + anim * 3) * 3;
        if (x === s.x) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    if (z.look === 'zerog') {
      for (let i = 0; i < 40; i++) {
        const x = bx + ((i * 97.3) % bw);
        const y = by + ((i * 53.7 + anim * (8 + (i % 5) * 3)) % bh);
        ctx.fillRect(x, y, 2, 2);
      }
    }
    if (z.look === 'lava') {
      for (let i = 0; i < 6; i++) {
        const x = bx + ((i * 37 + 11) % bw);
        const k = (anim * 0.8 + i * 0.17) % 1;
        ctx.globalAlpha = 1 - k;
        ctx.beginPath();
        ctx.arc(x, by + bh - k * bh * 1.2, 3 + i % 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    if (z.material) {
      // Material badge: glyph + outline so zones read without relying on color.
      const m = MATERIALS[z.material];
      const cx = bx + bw / 2;
      const cy = by - 22;
      ctx.save();
      ctx.translate(cx, cy);
      drawBallBody(ctx, m, 13, 0, 0.9);
      ctx.restore();
    }
  }

  private shapePath(z: Zone): void {
    const ctx = this.ctx;
    const s = z.shape;
    ctx.beginPath();
    if (s.type === 'rect') ctx.rect(s.x, s.y, s.w, s.h);
    else ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
  }

  private solids(view: SceneView): void {
    const ctx = this.ctx;
    for (const solid of view.level.solids) {
      if (solid.group && view.state.broken.has(solid.group)) continue;
      const surf = SURFACES[solid.surface ?? 'stone'];
      ctx.beginPath();
      solid.points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      if (solid.closed !== false) {
        ctx.closePath();
        ctx.fillStyle = surf.color;
        ctx.fill();
      }
    }
    // Edges from segments so the drawn outline is exactly the collision boundary.
    ctx.lineCap = 'round';
    for (const seg of view.world.segments) {
      if (!isSegmentActive(seg, view.state)) continue;
      const surf = SURFACES[seg.surface];
      ctx.strokeStyle = surf.edge;
      ctx.lineWidth = seg.surface === 'stone' ? 2 : 3.5;
      ctx.beginPath();
      ctx.moveTo(seg.a.x, seg.a.y);
      ctx.lineTo(seg.b.x, seg.b.y);
      ctx.stroke();
      if (seg.surface === 'spikes' || seg.surface === 'bouncer' || seg.surface === 'crate' || seg.surface === 'frost') {
        this.edgeDecor(seg.surface, seg.a, seg.b);
      }
    }
  }

  private edgeDecor(surface: string, a: Vec2, b: Vec2): void {
    const ctx = this.ctx;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) return;
    const tx = dx / len;
    const ty = dy / len;
    // Outward normal for clockwise polygons in screen space.
    const nx = ty;
    const ny = -tx;
    if (surface === 'spikes') {
      ctx.fillStyle = '#ff5050';
      for (let s = 0; s + 12 <= len; s += 14) {
        const px = a.x + tx * s;
        const py = a.y + ty * s;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + tx * 6 + nx * 12, py + ty * 6 + ny * 12);
        ctx.lineTo(px + tx * 12, py + ty * 12);
        ctx.fill();
      }
    } else if (surface === 'bouncer') {
      ctx.strokeStyle = '#ff9fd0';
      ctx.lineWidth = 2;
      for (let s = 10; s < len - 6; s += 22) {
        const px = a.x + tx * s;
        const py = a.y + ty * s;
        ctx.beginPath();
        ctx.moveTo(px - tx * 6 + nx * 4, py - ty * 6 + ny * 4);
        ctx.lineTo(px + nx * 10, py + ny * 10);
        ctx.lineTo(px + tx * 6 + nx * 4, py + ty * 6 + ny * 4);
        ctx.stroke();
      }
    } else if (surface === 'crate') {
      ctx.strokeStyle = 'rgba(217,165,91,0.5)';
      ctx.lineWidth = 1.5;
      for (let s = 12; s < len; s += 24) {
        ctx.beginPath();
        ctx.moveTo(a.x + tx * s, a.y + ty * s);
        ctx.lineTo(a.x + tx * s - nx * 10, a.y + ty * s - ny * 10);
        ctx.stroke();
      }
    } else if (surface === 'frost') {
      ctx.strokeStyle = 'rgba(230,255,255,0.7)';
      ctx.lineWidth = 1.5;
      for (let s = 8; s < len; s += 16) {
        const px = a.x + tx * s;
        const py = a.y + ty * s;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px - nx * 6 + tx * 4, py - ny * 6 + ty * 4);
        ctx.stroke();
      }
    }
  }

  private signs(view: SceneView): void {
    const ctx = this.ctx;
    ctx.font = '600 17px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const s of view.level.signs) {
      const w = ctx.measureText(s.text).width + 20;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      roundRect(ctx, s.x - w / 2, s.y - 15, w, 30, 8);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      ctx.fillText(s.text, s.x, s.y + 1);
    }
  }

  private checkpoints(view: SceneView): void {
    const ctx = this.ctx;
    view.level.checkpoints.forEach((c, i) => {
      const active = i <= view.checkpoint;
      const baseY = c.y + 16;
      ctx.strokeStyle = active ? '#7dffb0' : 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(c.x, baseY);
      ctx.lineTo(c.x, baseY - 60);
      ctx.stroke();
      ctx.fillStyle = active ? '#7dffb0' : 'rgba(255,255,255,0.25)';
      const wave = Math.sin(view.time * 4) * 3;
      ctx.beginPath();
      ctx.moveTo(c.x, baseY - 60);
      ctx.lineTo(c.x + 26, baseY - 52 + wave);
      ctx.lineTo(c.x, baseY - 42);
      ctx.fill();
      if (!active) {
        ctx.globalAlpha = 0.12;
        ctx.beginPath();
        ctx.arc(c.x, c.y, CHECKPOINT_RADIUS, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    });
  }

  private goal(view: SceneView): void {
    const g = view.level.goal;
    if (g.x < -9999) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(g.x, g.y);
    const t = view.time;
    for (let i = 0; i < 3; i++) {
      ctx.rotate(t * (0.6 + i * 0.4) * (i % 2 ? -1 : 1));
      ctx.strokeStyle = ['#fff6c2', '#ffd23f', '#ff9f1c'][i];
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 30 - i * 7, 0, Math.PI * 1.5);
      ctx.stroke();
    }
    ctx.restore();
  }

  private fragments(view: SceneView): void {
    const ctx = this.ctx;
    view.level.fragments.forEach((f, i) => {
      if (view.fragmentsTaken.has(i)) return;
      const known = view.fragmentsKnown.includes(i);
      const bob = Math.sin(view.time * 3 + i) * 4;
      ctx.save();
      ctx.translate(f.x, f.y + bob);
      ctx.rotate(view.time * 0.8);
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(9, 0);
      ctx.lineTo(0, 12);
      ctx.lineTo(-9, 0);
      ctx.closePath();
      if (known) {
        ctx.strokeStyle = 'rgba(180,255,255,0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.fillStyle = '#b4ffff';
        ctx.shadowColor = '#7df9ff';
        ctx.shadowBlur = 14;
        ctx.fill();
      }
      ctx.restore();
    });
  }

  private trajectory(points: Vec2[]): void {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    points.forEach((p, i) => {
      ctx.globalAlpha = clamp(1 - i / points.length, 0.1, 0.7);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  private ball(ball: BallState, pos: Vec2, alpha: number, label?: string, labelRow = 0): void {
    const ctx = this.ctx;
    const m = MATERIALS[ball.material];
    const r = ball.radius;
    ctx.save();
    ctx.translate(pos.x, pos.y);

    // Glow for hot/energetic materials.
    if (m.id === 'lava' || m.id === 'zerog') {
      ctx.globalAlpha = 0.35 * alpha;
      ctx.fillStyle = m.id === 'lava' ? '#ff7a2a' : '#7df9ff';
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Material lifetime ring.
    if (m.duration && !ball.materialLocked) {
      const left = 1 - ball.materialTime / m.duration;
      ctx.strokeStyle = left < 0.25 ? '#ff6060' : 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, r + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left);
      ctx.stroke();
    }

    // Squash along the impact normal (visual only; collision stays a circle).
    if (ball.squash > 0.01) {
      const n = ball.squashNormal;
      const a = Math.atan2(n.y, n.x);
      ctx.rotate(a);
      ctx.scale(1 - ball.squash * 0.5, 1 + ball.squash * 0.35);
      ctx.rotate(-a);
    }
    drawBallBody(ctx, m, r, ball.angle, alpha);
    ctx.restore();

    if (label) {
      ctx.font = '600 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = m.accent;
      ctx.fillText(label, pos.x, pos.y - r - 10 - labelRow * 15);
    }
  }

  /** Full-screen tint; `rgb` is "r,g,b". */
  drawOverlay(rgb: string, alpha: number): void {
    if (alpha <= 0.001) return;
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = `rgba(${rgb},${alpha})`;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  /** Screen-space overlays: touch stick and jump zone hint. */
  drawTouch(stick: TouchStick, jumpActive: boolean, leftHanded: boolean, show: boolean): void {
    if (!show) return;
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (stick.active) {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(stick.originX, stick.originY, 50, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.arc(stick.x, stick.y, 22, 0, Math.PI * 2);
      ctx.fill();
    }
    const jx = leftHanded ? 70 : this.width - 70;
    const jy = this.height - 80;
    ctx.fillStyle = jumpActive ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.arc(jx, jy, 38, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '700 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('JUMP', jx, jy);
  }
}

const REGION_BG: Record<string, [string, string]> = {
  'The Origin': ['#141a2e', '#2a2440'],
  'The Deep': ['#061a2e', '#0b3350'],
  'The Slipper': ['#1a1430', '#10263a'],
  'The Core': ['#2a0c08', '#40180c'],
  'The Void': ['#05060f', '#12122a'],
  'The Sinking Lands': ['#1a140c', '#2c2418'],
  'The Sky': ['#0e2a3e', '#3f6f8a'],
  Laboratory: ['#101418', '#1d262e'],
};

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
