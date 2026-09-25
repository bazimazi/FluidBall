import type { Vec2 } from '../core/math';
import type { MaterialId } from '../physics/materials';
import type { SurfaceId } from '../physics/surfaces';
import type { Zone } from '../physics/world';

export type Pt = [number, number];

/** A solid outline. Closed outlines are filled when drawn. */
export interface Solid {
  points: Pt[];
  surface?: SurfaceId;
  closed?: boolean;
  /** Breakable/meltable pieces share a group so they vanish together. */
  group?: string;
}

export interface Sign {
  x: number;
  y: number;
  text: string;
}

export type ObjectiveKind = 'reach' | 'collect';

export interface LevelDef {
  id: string;
  name: string;
  region: string;
  /** Short hint shown on the level card. */
  blurb: string;
  bounds: { x: number; y: number; w: number; h: number };
  spawn: Vec2;
  startMaterial?: MaterialId;
  solids: Solid[];
  zones: Zone[];
  checkpoints: Vec2[];
  goal: Vec2;
  /** Discovery fragments: optional, usually on skill or secret routes. */
  fragments: Vec2[];
  signs: Sign[];
  /** Materials this level teaches (for the level card and future progression gating). */
  materials: MaterialId[];
  parTime: number;
  gravity?: number;
}
