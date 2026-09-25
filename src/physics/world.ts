import type { Vec2 } from '../core/math';
import type { ForceField } from './forces';
import type { MaterialId } from './materials';
import type { SurfaceId } from './surfaces';

export type Shape =
  | { type: 'rect'; x: number; y: number; w: number; h: number }
  | { type: 'circle'; x: number; y: number; r: number };

/** A region of the environment. Its parts compose: a zone can transform, push and hold fluid at once. */
export interface Zone {
  id: string;
  shape: Shape;
  /** Touching this zone offers the ball this material (see interactions). */
  material?: MaterialId;
  force?: ForceField;
  /** Fluid volume: buoyancy relative to ball density, plus drag. */
  fluid?: { density: number; drag: number };
  hazard?: boolean;
  /** Purely visual hint for the renderer. */
  look?: 'water' | 'oil' | 'ice' | 'lava' | 'zerog' | 'mud' | 'wind' | 'thermal' | 'current' | 'well' | 'hazard' | 'reset';
}

export interface Segment {
  id: number;
  a: Vec2;
  b: Vec2;
  surface: SurfaceId;
  /** Segments sharing a group break/melt together (e.g. all sides of a crate). */
  group?: string;
}

const cellKey = (gx: number, gy: number): number => (gx + 32768) * 65536 + (gy + 32768);

/** Static level geometry with a uniform grid broadphase. */
export class PhysicsWorld {
  readonly segments: Segment[];
  readonly zones: Zone[];
  readonly gravity: number;
  private readonly cell = 128;
  private readonly grid = new Map<number, number[]>();

  constructor(segments: Segment[], zones: Zone[], gravity = 2000) {
    this.segments = segments;
    this.zones = zones;
    this.gravity = gravity;
    for (const s of segments) {
      const x0 = Math.floor(Math.min(s.a.x, s.b.x) / this.cell);
      const x1 = Math.floor(Math.max(s.a.x, s.b.x) / this.cell);
      const y0 = Math.floor(Math.min(s.a.y, s.b.y) / this.cell);
      const y1 = Math.floor(Math.max(s.a.y, s.b.y) / this.cell);
      for (let gx = x0; gx <= x1; gx++) {
        for (let gy = y0; gy <= y1; gy++) {
          const k = cellKey(gx, gy);
          let list = this.grid.get(k);
          if (!list) this.grid.set(k, (list = []));
          list.push(s.id);
        }
      }
    }
  }

  /** Segment indices whose cells overlap the circle's bounding box. `out` is reused to avoid allocation. */
  query(p: Vec2, r: number, out: Set<number>): Set<number> {
    out.clear();
    const x0 = Math.floor((p.x - r) / this.cell);
    const x1 = Math.floor((p.x + r) / this.cell);
    const y0 = Math.floor((p.y - r) / this.cell);
    const y1 = Math.floor((p.y + r) / this.cell);
    for (let gx = x0; gx <= x1; gx++) {
      for (let gy = y0; gy <= y1; gy++) {
        const list = this.grid.get(cellKey(gx, gy));
        if (list) for (const id of list) out.add(id);
      }
    }
    return out;
  }
}

/** Mutable per-run state layered over the static world (so simulations can share geometry). */
export interface WorldState {
  time: number;
  broken: Set<string | number>;
}

export const newWorldState = (): WorldState => ({ time: 0, broken: new Set() });

export const isSegmentActive = (s: Segment, state: WorldState): boolean =>
  !state.broken.has(s.group ?? s.id);

export function circleOverlapsShape(p: Vec2, r: number, s: Shape): boolean {
  if (s.type === 'circle') return Math.hypot(p.x - s.x, p.y - s.y) < r + s.r;
  const cx = Math.max(s.x, Math.min(p.x, s.x + s.w));
  const cy = Math.max(s.y, Math.min(p.y, s.y + s.h));
  return Math.hypot(p.x - cx, p.y - cy) < r;
}

/** Fraction of the ball submerged in a rect/circle, approximated by center depth. */
export function pointInShape(p: Vec2, s: Shape): boolean {
  if (s.type === 'circle') return Math.hypot(p.x - s.x, p.y - s.y) < s.r;
  return p.x >= s.x && p.x <= s.x + s.w && p.y >= s.y && p.y <= s.y + s.h;
}
