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
import { drawPlant, drawScenery, glow, PALETTES, seed } from './scenery';

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
  ctx.save();
  ctx.globalAlpha *= alpha;
  const g = ctx.createRadialGradient(-r * 0.32, -r * 0.42, r * 0.04, 0, r * 0.1, r * 1.1);
  g.addColorStop(0, lighten(m.color, 0.85));
  g.addColorStop(0.28, lighten(m.color, 0.3));
  g.addColorStop(0.62, m.color);
  g.addColorStop(1, '#101e30');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.045);
  ctx.strokeStyle = m.accent;
  ctx.stroke();
  ctx.save();
  ctx.rotate(angle);
  ctx.globalAlpha *= 0.75;
  drawGlyph(ctx, m.pattern, r * 0.83, m.accent);
  ctx.restore();
  // Fixed highlights sit above the rotating material, like a glass shell.
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha *= 0.42;
  ctx.beginPath(); ctx.ellipse(-r * 0.24, -r * 0.49, r * 0.38, r * 0.16, -0.4, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha *= 0.6;
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1, r * 0.045);
  ctx.beginPath(); ctx.arc(0, 0, r * 0.85, 0.15, 1.6); ctx.stroke();
  ctx.restore();
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
  menu?: boolean;
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
  private viewLeft = 0;
  private viewRight = 0;
  private visualTime = 0;
  private reduced = false;
  private trails = new WeakMap<BallState, { x: number; y: number; time: number }[]>();

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
    this.visualTime = view.reducedEffects ? 0 : view.time;
    this.reduced = view.reducedEffects;
    this.viewLeft = cam.pos.x - W / cam.zoom / 2 - 80;
    this.viewRight = cam.pos.x + W / cam.zoom / 2 + 80;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.background(view, cam);
    if (view.menu) {
      this.menuArtwork();
      return;
    }

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
    if (view.ball && view.ballPos && !view.ball.dead) this.ballShadow(view);
    particles.draw(ctx);
    for (const e of view.extraBalls ?? []) this.ball(e.ball, e.pos, e.alpha ?? 0.55, e.label, e.labelRow);
    if (view.ball && view.ballPos && !view.ball.dead) this.ball(view.ball, view.ballPos, 1);

    ctx.restore();
  }

  private background(view: SceneView, cam: Camera): void {
    drawScenery(this.ctx, this.width, this.height, cam, view.level.region, view.time, view.reducedEffects);
  }

  private menuArtwork(): void {
    const ctx = this.ctx;
    const compact = this.width < 760;
    const unit = Math.min(this.width / (compact ? 820 : 1350), this.height / 850);
    ctx.save();
    ctx.translate(this.width * (compact ? 0.76 : 0.72), this.height * (compact ? 0.18 : 0.53));
    ctx.scale(unit, unit);
    const t = this.visualTime;
    glow(ctx, 0, -30, 360, '#95ebc6', 0.1);
    // Floating basalt island with illuminated strata and roots.
    ctx.fillStyle = '#102c32';
    ctx.beginPath(); ctx.moveTo(-260, 150); ctx.lineTo(-185, 128); ctx.lineTo(180, 128); ctx.lineTo(270, 157);
    ctx.lineTo(168, 240); ctx.lineTo(93, 250); ctx.lineTo(38, 323); ctx.lineTo(-30, 274); ctx.lineTo(-157, 248); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#204b4b';
    ctx.beginPath(); ctx.ellipse(0, 145, 266, 28, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#a2efd0'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, 141, 260, 24, 0, Math.PI, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 18; i++) {
      const x = -225 + i * 26;
      drawPlant(ctx, x, 133 + Math.abs(x) * 0.045, i + 80, t, PALETTES.Laboratory);
      ctx.strokeStyle = '#74bdad20'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, 170); ctx.lineTo(x * 0.7, 210 + seed(i) * 40); ctx.stroke();
    }
    glow(ctx, 0, 125, 125, '#72e6c4', 0.24);
    ctx.fillStyle = '#041e26a0'; ctx.beginPath(); ctx.ellipse(0, 133, 100, 12, 0, 0, Math.PI * 2); ctx.fill();
    const bob = Math.sin(t * 1.3) * 10;
    ctx.save(); ctx.translate(0, -8 + bob);
    glow(ctx, 0, 0, 165, '#77dbd9', 0.14);
    drawBallBody(ctx, MATERIALS.water, 96, t * 0.15);
    ctx.restore();
    const satellites = ['oil', 'lava', 'ice', 'wind'] as const;
    satellites.forEach((id, i) => {
      const a = -Math.PI + i * 1.12 + Math.sin(t * 0.15) * 0.08;
      const x = Math.cos(a) * 210;
      const y = Math.sin(a) * 157 - 26 + Math.sin(t * 1.2 + i) * 9;
      ctx.save(); ctx.translate(x, y);
      glow(ctx, 0, 0, 58, MATERIALS[id].color, 0.18);
      drawBallBody(ctx, MATERIALS[id], [30, 38, 26, 23][i], t * (i % 2 ? -0.2 : 0.2));
      ctx.restore();
    });
    ctx.strokeStyle = '#b5eadb22'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(0, -30, 226, 159, -0.15, 3.3, 6.1); ctx.stroke();
    ctx.restore();
    // Text remains readable on top of the same living world.
    const shade = ctx.createLinearGradient(0, 0, this.width, 0);
    shade.addColorStop(0, '#06171ded'); shade.addColorStop(compact ? 0.65 : 0.37, '#06171dba'); shade.addColorStop(1, '#06171d00');
    ctx.fillStyle = shade; ctx.fillRect(0, 0, this.width, this.height);
  }

  private ballShadow(view: SceneView): void {
    const p = view.ballPos!;
    let floor = Infinity;
    for (const s of view.world.segments) {
      if (!isSegmentActive(s, view.state) || Math.abs(s.b.x - s.a.x) < 1) continue;
      if (p.x < Math.min(s.a.x, s.b.x) || p.x > Math.max(s.a.x, s.b.x)) continue;
      const y = s.a.y + (p.x - s.a.x) / (s.b.x - s.a.x) * (s.b.y - s.a.y);
      if (y >= p.y && y < floor) floor = y;
    }
    const distance = floor - p.y;
    if (distance > 220) return;
    const ctx = this.ctx;
    ctx.save(); ctx.globalAlpha = 0.28 * (1 - distance / 220);
    ctx.fillStyle = '#020e17'; ctx.beginPath(); ctx.ellipse(p.x, floor + 2, 20 + distance * 0.04, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
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
    const depth = ctx.createLinearGradient(0, by, 0, by + bh);
    depth.addColorStop(0, '#ffffff12'); depth.addColorStop(0.35, '#ffffff00'); depth.addColorStop(1, '#030d2850');
    ctx.fillStyle = depth; ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = style.line;

    if (z.look === 'water' || z.look === 'current' || z.look === 'oil' || z.look === 'lava' || z.look === 'mud') {
      // Layered surface ripples and rising bubbles, clipped to the physical volume.
      for (let layer = 0; layer < 3; layer++) {
        ctx.globalAlpha = 0.5 - layer * 0.14;
        ctx.lineWidth = layer === 0 ? 2.5 : 1;
        ctx.beginPath();
        for (let x = Math.max(bx, this.viewLeft); x <= Math.min(bx + bw, this.viewRight) + 5; x += 5) {
          const y = by + 5 + layer * 7 + Math.sin(x * 0.035 + anim * 2 - layer) * 3 + Math.sin(x * 0.017 - anim) * 2;
          if (x === Math.max(bx, this.viewLeft)) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      if (!reduced) for (let i = 0; i < Math.min(32, bw / 18); i++) {
        const x = bx + seed(i + bx) * bw + Math.sin(anim + i) * 4;
        const y = by + bh - ((anim * (12 + seed(i) * 18) + seed(i + 44) * bh) % bh);
        ctx.globalAlpha = 0.15 + seed(i + 8) * 0.25;
        ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, 1 + seed(i + 1) * 3, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    if (z.look === 'ice') {
      ctx.globalAlpha = 0.25;
      for (let i = 0; i < Math.min(24, bw / 22); i++) {
        const x = bx + seed(i + 40) * bw;
        const y = by + seed(i + 70) * bh;
        ctx.save(); ctx.translate(x, y); ctx.rotate(seed(i) * 2);
        drawGlyph(ctx, 'crystal', 10 + seed(i) * 12, style.line); ctx.restore();
      }
      ctx.globalAlpha = 1;
    }

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
    const palette = PALETTES[view.level.region] ?? PALETTES.Laboratory;
    for (const solid of view.level.solids) {
      if (solid.group && view.state.broken.has(solid.group)) continue;
      const xs = solid.points.map(p => p[0]);
      if (Math.max(...xs) < this.viewLeft || Math.min(...xs) > this.viewRight) continue;
      const surf = SURFACES[solid.surface ?? 'stone'];
      ctx.beginPath();
      solid.points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      if (solid.closed !== false) {
        ctx.closePath();
        const top = Math.min(...solid.points.map(p => p[1]));
        const bottom = Math.max(...solid.points.map(p => p[1]));
        const stone = (solid.surface ?? 'stone') === 'stone';
        const gradient = ctx.createLinearGradient(0, top, 0, Math.max(top + 1, Math.min(bottom, top + 380)));
        gradient.addColorStop(0, stone ? palette.near : surf.color);
        gradient.addColorStop(1, '#081720');
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.save(); ctx.clip();
        // Geological layers: irregular seams, in world space, with a lit upper face.
        const left = Math.max(Math.min(...xs), this.viewLeft);
        const right = Math.min(Math.max(...xs), this.viewRight);
        ctx.lineWidth = 1;
        for (let row = 0; row < 7; row++) {
          ctx.strokeStyle = stone ? palette.grass + '12' : surf.edge + '18';
          ctx.beginPath();
          for (let x = Math.floor(left / 60) * 60; x < right + 60; x += 60) {
            const y = top + 22 + row * 38 + seed(x / 60 + row * 71) * 23;
            if (x === Math.floor(left / 60) * 60) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        for (let x = Math.floor(left / 78) * 78; x < right; x += 78) {
          const s = seed(x);
          ctx.fillStyle = stone ? palette.grass + '12' : surf.edge + '18';
          ctx.beginPath(); ctx.moveTo(x, top + 36); ctx.lineTo(x + 20, top + 63 + s * 75); ctx.lineTo(x - 8, top + 140 + s * 100); ctx.closePath(); ctx.fill();
        }
        ctx.restore();
      }
    }
    // Edges from segments so the drawn outline is exactly the collision boundary.
    ctx.lineCap = 'round';
    for (const seg of view.world.segments) {
      if (!isSegmentActive(seg, view.state)) continue;
      if (Math.max(seg.a.x, seg.b.x) < this.viewLeft || Math.min(seg.a.x, seg.b.x) > this.viewRight) continue;
      const surf = SURFACES[seg.surface];
      const topEdge = seg.b.x > seg.a.x;
      if (topEdge) {
        ctx.save(); ctx.strokeStyle = seg.surface === 'stone' ? palette.grass + '35' : surf.edge + '40'; ctx.lineWidth = 9;
        ctx.beginPath(); ctx.moveTo(seg.a.x, seg.a.y + 4); ctx.lineTo(seg.b.x, seg.b.y + 4); ctx.stroke(); ctx.restore();
      }
      ctx.strokeStyle = seg.surface === 'stone' ? (topEdge ? palette.grass : palette.grass + '40') : surf.edge;
      ctx.lineWidth = seg.surface === 'stone' ? (topEdge ? 2.5 : 1) : 3.5;
      ctx.beginPath();
      ctx.moveTo(seg.a.x, seg.a.y);
      ctx.lineTo(seg.b.x, seg.b.y);
      ctx.stroke();
      if (seg.surface === 'stone' && topEdge && Math.abs(seg.b.y - seg.a.y) < (seg.b.x - seg.a.x) * 0.8) {
        const left = Math.max(seg.a.x + 15, this.viewLeft);
        const right = Math.min(seg.b.x - 15, this.viewRight);
        for (let x = Math.ceil(left / 43) * 43; x < right; x += 43) {
          const y = seg.a.y + (x - seg.a.x) / (seg.b.x - seg.a.x) * (seg.b.y - seg.a.y);
          if (seed(x + seg.a.y) > 0.28) drawPlant(ctx, x, y, x + seg.a.y, this.visualTime, palette);
        }
      }
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
    ctx.font = '500 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const s of view.level.signs) {
      const w = ctx.measureText(s.text).width + 30;
      ctx.fillStyle = 'rgba(7,24,32,0.82)';
      roundRect(ctx, s.x - w / 2, s.y - 17, w, 34, 8);
      ctx.fill();
      ctx.strokeStyle = '#b5e3d52a'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#cfdfda';
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
      const wave = Math.sin(this.visualTime * 4) * 3;
      ctx.beginPath();
      ctx.moveTo(c.x, baseY - 60);
      ctx.lineTo(c.x + 26, baseY - 52 + wave);
      ctx.lineTo(c.x, baseY - 42);
      ctx.fill();
      glow(ctx, c.x + 8, baseY - 51, active ? 44 : 24, active ? '#7dffb0' : '#b8ded2', active ? 0.22 : 0.08);
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
    const t = this.visualTime;
    glow(ctx, 0, 0, 100, '#f9d78e', 0.26);
    const core = ctx.createRadialGradient(0, 0, 0, 0, 0, 28);
    core.addColorStop(0, '#fffbe6aa'); core.addColorStop(0.5, '#ffd36c38'); core.addColorStop(1, '#ffd36c00');
    ctx.fillStyle = core; ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.rotate(t * (0.6 + i * 0.4) * (i % 2 ? -1 : 1));
      ctx.strokeStyle = ['#fff6c2', '#ffd23f', '#ff9f1c'][i];
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 30 - i * 7, 0, Math.PI * 1.5);
      ctx.stroke();
      ctx.restore();
    }
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * Math.PI * 2 - t * 0.3;
      const r = 39 + Math.sin(t * 2 + i) * 3;
      ctx.fillStyle = '#fff2b8'; ctx.beginPath(); ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 1.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  private fragments(view: SceneView): void {
    const ctx = this.ctx;
    view.level.fragments.forEach((f, i) => {
      if (view.fragmentsTaken.has(i)) return;
      const known = view.fragmentsKnown.includes(i);
      const bob = Math.sin(this.visualTime * 3 + i) * 4;
      ctx.save();
      ctx.translate(f.x, f.y + bob);
      glow(ctx, 0, 0, 34, '#91ffec', known ? 0.05 : 0.2);
      ctx.scale(0.75 + Math.abs(Math.cos(this.visualTime * 1.2 + i)) * 0.25, 1);
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
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffffcc';
        ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(0, 12); ctx.lineTo(-9, 0); ctx.fill();
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
    const speed = Math.hypot(ball.vel.x, ball.vel.y);
    // A short, tapered ribbon follows the actual path and never bridges a respawn.
    let trail = this.trails.get(ball);
    if (!trail) { trail = []; this.trails.set(ball, trail); }
    const last = trail[trail.length - 1];
    if (this.reduced || (last && (this.visualTime < last.time || Math.hypot(pos.x - last.x, pos.y - last.y) > 180))) trail.length = 0;
    if (!this.reduced && (!last || this.visualTime > last.time)) trail.push({ ...pos, time: this.visualTime });
    while (trail.length > 16 || (trail.length && this.visualTime - trail[0].time > 0.2)) trail.shift();
    if (speed > 160 && !this.reduced) {
      ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = m.accent;
      for (let i = 1; i < trail.length; i++) {
        const k = i / trail.length;
        ctx.globalAlpha = k * 0.16 * alpha * Math.min(speed / 500, 1);
        ctx.lineWidth = r * 1.1 * k;
        ctx.beginPath(); ctx.moveTo(trail[i - 1].x, trail[i - 1].y); ctx.lineTo(trail[i].x, trail[i].y); ctx.stroke();
      }
      ctx.restore();
    }
    ctx.save();
    ctx.translate(pos.x, pos.y);
    if (!this.reduced) glow(ctx, 0, 0, r * 3.2, m.color, 0.17 * alpha);
    if (!this.reduced && (m.id === 'zerog' || m.id === 'wind' || m.id === 'lava')) {
      ctx.save(); ctx.rotate(this.visualTime * (m.id === 'lava' ? -1.4 : 1.2));
      ctx.strokeStyle = m.accent; ctx.globalAlpha = 0.4 * alpha; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(0, 0, r * 1.5, r * 0.65, 0, 0.2, Math.PI * 1.7); ctx.stroke();
      ctx.fillStyle = m.accent; ctx.beginPath(); ctx.arc(r * 1.5, 0, 2, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }

    if (!ball.grounded && !this.reduced && ball.squash < 0.05) {
      const stretch = Math.min(Math.hypot(ball.vel.x, ball.vel.y) / 6500, 0.13);
      const direction = Math.atan2(ball.vel.y, ball.vel.x);
      ctx.rotate(direction); ctx.scale(1 + stretch, 1 - stretch * 0.6); ctx.rotate(-direction);
    }

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
    if (ball.squash > 0.01 && !this.reduced) {
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

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
