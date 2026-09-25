import type { SurfaceId } from '../physics/surfaces';
import { PhysicsWorld, type Segment } from '../physics/world';
import type { LevelDef, Pt, Solid } from './types';

export function buildWorld(level: LevelDef): PhysicsWorld {
  const segments: Segment[] = [];
  for (const solid of level.solids) {
    const pts = solid.points;
    const n = solid.closed === false ? pts.length - 1 : pts.length;
    for (let i = 0; i < n; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      segments.push({
        id: segments.length,
        a: { x: a[0], y: a[1] },
        b: { x: b[0], y: b[1] },
        surface: solid.surface ?? 'stone',
        group: solid.group,
      });
    }
  }
  return new PhysicsWorld(segments, level.zones, level.gravity);
}

// --- Authoring helpers ---

export const box = (x: number, y: number, w: number, h: number, surface?: SurfaceId, group?: string): Solid => ({
  points: [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ],
  surface,
  group,
});

export const poly = (points: Pt[], surface?: SurfaceId, group?: string): Solid => ({ points, surface, group });

/** Terrain: a top outline closed down to `bottom`. */
export const ground = (top: Pt[], bottom: number, surface?: SurfaceId): Solid => ({
  points: [...top, [top[top.length - 1][0], bottom], [top[0][0], bottom]],
  surface,
});

/** Open polyline (e.g. a thin strip laid on top of terrain). */
export const line = (points: Pt[], surface?: SurfaceId): Solid => ({ points, surface, closed: false });

/** Quarter/half arc points, for loops and bowls. Angles in radians, screen space. */
export function arc(cx: number, cy: number, r: number, a0: number, a1: number, steps = 16): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    out.push([Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r)]);
  }
  return out;
}
