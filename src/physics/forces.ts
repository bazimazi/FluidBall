import { type Vec2, noise1 } from '../core/math';
import type { ForceKind } from './materials';

/** An environmental force field attached to a zone. Returns acceleration before material response. */
export interface ForceField {
  kind: ForceKind;
  /** Unit direction for directional forces (wind, current, thermal). */
  dir?: Vec2;
  /** px/s^2 for directional forces; for gravity wells, px/s^2 at 100px. */
  strength: number;
  /** Gusting: strength oscillates between (1 - gust) and 1 over `period` seconds. */
  gust?: number;
  period?: number;
  /** Random perpendicular wobble as a fraction of strength. */
  turbulence?: number;
  /** Gravity well center. */
  center?: Vec2;
}

export function fieldAcceleration(field: ForceField, pos: Vec2, time: number): Vec2 {
  if (field.kind === 'gravityWell') {
    const c = field.center ?? pos;
    const dx = c.x - pos.x;
    const dy = c.y - pos.y;
    const d = Math.max(Math.hypot(dx, dy), 40);
    // Inverse-distance (not inverse-square) falloff gives stable, readable orbits.
    const a = field.strength * (100 / d);
    return { x: (dx / d) * a, y: (dy / d) * a };
  }
  const dir = field.dir ?? { x: 1, y: 0 };
  let s = field.strength;
  if (field.gust && field.period) {
    const phase = 0.5 + 0.5 * Math.sin((time * Math.PI * 2) / field.period);
    s *= 1 - field.gust + field.gust * phase;
  }
  let x = dir.x * s;
  let y = dir.y * s;
  if (field.turbulence) {
    const w = noise1(time * 3 + pos.x * 0.01 + pos.y * 0.013) * field.turbulence * s;
    x += -dir.y * w;
    y += dir.x * w;
  }
  return { x, y };
}
