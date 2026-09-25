/**
 * Ball materials are pure data. The ball controller reads these numbers and never
 * branches on a material id, so a new material is a new entry here (plus art/audio).
 *
 * Units: pixels, seconds. Ball radius is 16px. Screen y points down.
 */

export type MaterialId = 'normal' | 'water' | 'oil' | 'ice' | 'lava' | 'zerog' | 'mud' | 'wind';

export type ForceKind = 'wind' | 'current' | 'thermal' | 'gravityWell';

/** Glyph drawn on the ball so materials never rely on color alone. */
export type MaterialPattern = 'ring' | 'waves' | 'gloss' | 'crystal' | 'flame' | 'orbit' | 'speckle' | 'swirl';

export interface AirImpulse {
  /** Number of impulses per contact; -1 = unlimited (rate limited by cooldown). */
  count: number;
  speed: number;
  cooldown: number;
  /** 'up' pushes against gravity (or straight up with none); 'aim' follows the stick. */
  mode: 'up' | 'aim';
  /** Only usable while submerged in a fluid volume (swim strokes). */
  requiresFluid: boolean;
  /** Fraction of current velocity kept when an aimed impulse fires. */
  carry: number;
}

export interface MaterialDefinition {
  id: MaterialId;
  name: string;
  /** One-line description of how the material changes play. */
  verb: string;
  color: string;
  accent: string;
  pattern: MaterialPattern;

  // --- Body ---
  /** Multiplier on world gravity. Negative values mean the ball "falls" upward. */
  gravityScale: number;
  /** Relative to water (1.0). Drives buoyancy inside fluid volumes. */
  density: number;
  /** Used for impact strength (breaking things) and camera shake. */
  mass: number;
  /** Positive = hot, negative = cold. Melts / freezes temperature-sensitive geometry. */
  temperature: number;

  // --- Control ---
  groundAccel: number;
  airAccel: number;
  /** Speed cap for input-driven acceleration. Gravity and forces may exceed it. */
  maxSpeed: number;
  /** Extra deceleration when input opposes velocity. */
  brake: number;
  /** Rolling resistance multiplier when there is no input. Multiplied with surface friction. */
  friction: number;
  /** How much input acceleration the ball gets from the surface. Multiplied with surface traction. */
  traction: number;
  /** Exponential velocity damping per second. */
  linearDrag: number;
  angularDamping: number;
  maxFallSpeed: number;
  /** Stick up/down acceleration (thrusting in zero-g, diving with lava). */
  verticalAccel: number;

  // --- Contacts ---
  restitution: number;
  /** Tangential speed kept on a hard impact (1 = none lost). */
  impactGrip: number;
  /** Pull toward the touched surface; lets a fast ball ride walls, ceilings and loops. */
  adhesion: number;
  adhesionMinSpeed: number;
  /** Climb speed when pushing into a wall. 0 = cannot climb. */
  wallClimb: number;

  // --- Jump family ---
  jumpSpeed: number;
  /** Upward velocity multiplier when jump is released early (variable jump height). */
  jumpCut: number;
  airImpulse: AirImpulse | null;
  /** Max fall speed while holding jump. 0 = no glide. */
  glideFallSpeed: number;

  // --- Environment ---
  /** Multiplier for each environmental force kind (already accounts for mass/aerodynamics). */
  forceResponse: Record<ForceKind, number>;

  // --- Lifetime ---
  /** Seconds before reverting to Normal while away from its source. null = permanent. */
  duration: number | null;
  /** Reverts as soon as the ball leaves every zone that provides this material. */
  zoneBound: boolean;
}

const response = (r: Partial<Record<ForceKind, number>>): Record<ForceKind, number> => ({
  wind: 1,
  current: 1,
  thermal: 1,
  gravityWell: 1,
  ...r,
});

const base: Omit<MaterialDefinition, 'id' | 'name' | 'verb' | 'color' | 'accent' | 'pattern'> = {
  gravityScale: 1,
  density: 1.35,
  mass: 1,
  temperature: 0,
  groundAccel: 1500,
  airAccel: 950,
  maxSpeed: 430,
  brake: 2600,
  friction: 1,
  traction: 1,
  linearDrag: 0.05,
  angularDamping: 0.6,
  maxFallSpeed: 1300,
  verticalAccel: 0,
  restitution: 0.38,
  impactGrip: 0.97,
  adhesion: 0,
  adhesionMinSpeed: 0,
  wallClimb: 0,
  jumpSpeed: 790,
  jumpCut: 0.5,
  airImpulse: null,
  glideFallSpeed: 0,
  forceResponse: response({}),
  duration: null,
  zoneBound: false,
};

export const MATERIALS: Record<MaterialId, MaterialDefinition> = {
  normal: {
    ...base,
    id: 'normal',
    name: 'Normal',
    verb: 'Balanced and predictable. Your reference point.',
    color: '#e8e4d8',
    accent: '#8f8a7c',
    pattern: 'ring',
  },

  water: {
    ...base,
    id: 'water',
    name: 'Water',
    verb: 'Heavy and damped. Swim with strokes inside fluid; ride currents.',
    color: '#3aa0ff',
    accent: '#bfe3ff',
    pattern: 'waves',
    gravityScale: 0.8,
    density: 1.0,
    mass: 1.3,
    groundAccel: 950,
    airAccel: 700,
    maxSpeed: 300,
    brake: 1800,
    friction: 1.3,
    linearDrag: 0.9,
    restitution: 0.08,
    impactGrip: 0.85,
    jumpSpeed: 620,
    jumpCut: 0.6,
    airImpulse: { count: -1, speed: 360, cooldown: 0.26, mode: 'aim', requiresFluid: true, carry: 0.35 },
    forceResponse: response({ current: 1.9, wind: 0.6 }),
    duration: 9,
  },

  oil: {
    ...base,
    id: 'oil',
    name: 'Oil',
    verb: 'Slick and clinging. Keeps momentum and sticks to walls and loops at speed.',
    color: '#2b2440',
    accent: '#c86bff',
    pattern: 'gloss',
    gravityScale: 1.15,
    groundAccel: 800,
    airAccel: 500,
    maxSpeed: 820,
    brake: 260,
    friction: 0.07,
    traction: 0.7,
    linearDrag: 0.0,
    restitution: 0.18,
    impactGrip: 1.0,
    adhesion: 3200,
    adhesionMinSpeed: 240,
    jumpSpeed: 740,
    duration: 14,
  },

  ice: {
    ...base,
    id: 'ice',
    name: 'Ice',
    verb: 'Rigid glide. Almost no friction, ricochets off walls, hard to stop.',
    color: '#bff4ff',
    accent: '#4fc6e0',
    pattern: 'crystal',
    density: 0.9,
    temperature: -1,
    groundAccel: 650,
    airAccel: 240,
    maxSpeed: 1000,
    brake: 110,
    friction: 0.012,
    traction: 0.75,
    linearDrag: 0.0,
    restitution: 0.66,
    impactGrip: 1.0,
    jumpSpeed: 560,
    jumpCut: 0.7,
    forceResponse: response({ wind: 1.25 }),
    duration: 12,
  },

  lava: {
    ...base,
    id: 'lava',
    name: 'Lava',
    verb: 'Buoyant and hot. Falls upward, rolls on ceilings, melts ice. Cools over time.',
    color: '#ff5a1f',
    accent: '#ffd23f',
    pattern: 'flame',
    gravityScale: -0.42,
    density: 0.7,
    mass: 1.1,
    temperature: 1,
    groundAccel: 1300,
    airAccel: 850,
    maxSpeed: 400,
    brake: 2200,
    linearDrag: 0.6,
    maxFallSpeed: 700,
    verticalAccel: 1800,
    restitution: 0.3,
    jumpSpeed: 620,
    forceResponse: response({ thermal: 1.6 }),
    duration: 7,
  },

  zerog: {
    ...base,
    id: 'zerog',
    name: 'Zero-G',
    verb: 'No gravity. Momentum is everything; burst in any direction, orbit wells.',
    color: '#1b1f3a',
    accent: '#7df9ff',
    pattern: 'orbit',
    gravityScale: 0,
    density: 1,
    groundAccel: 260,
    airAccel: 260,
    maxSpeed: 420,
    brake: 200,
    friction: 0.25,
    linearDrag: 0.04,
    angularDamping: 0.05,
    verticalAccel: 260,
    restitution: 0.62,
    impactGrip: 1,
    jumpSpeed: 480,
    airImpulse: { count: 2, speed: 470, cooldown: 0.12, mode: 'aim', requiresFluid: false, carry: 0.25 },
    forceResponse: response({ gravityWell: 1.6 }),
    duration: null,
    zoneBound: true,
  },

  mud: {
    ...base,
    id: 'mud',
    name: 'Mud',
    verb: 'Heavy grip. Climbs walls, shrugs off wind and currents, smashes crates.',
    color: '#6b4a2b',
    accent: '#b08452',
    pattern: 'speckle',
    gravityScale: 1.3,
    density: 2.4,
    mass: 3,
    groundAccel: 1150,
    airAccel: 500,
    maxSpeed: 240,
    brake: 4000,
    friction: 4.5,
    traction: 1.2,
    linearDrag: 0.9,
    angularDamping: 3,
    restitution: 0.02,
    impactGrip: 0.6,
    wallClimb: 180,
    jumpSpeed: 600,
    jumpCut: 0.7,
    forceResponse: response({ wind: 0.12, current: 0.15, thermal: 0.2, gravityWell: 0.4 }),
    duration: 14,
  },

  wind: {
    ...base,
    id: 'wind',
    name: 'Wind',
    verb: 'Light and aerodynamic. Hold jump to glide; drafts carry you far.',
    color: '#d9fff0',
    accent: '#46d19a',
    pattern: 'swirl',
    gravityScale: 0.55,
    density: 0.25,
    mass: 0.5,
    groundAccel: 1100,
    airAccel: 1350,
    maxSpeed: 470,
    brake: 2200,
    friction: 0.6,
    linearDrag: 0.35,
    maxFallSpeed: 700,
    restitution: 0.5,
    jumpSpeed: 610,
    jumpCut: 0.55,
    glideFallSpeed: 95,
    forceResponse: response({ wind: 2.4, thermal: 2.2, current: 0.7, gravityWell: 0.8 }),
    duration: 12,
  },
};

export const MATERIAL_ORDER: MaterialId[] = ['normal', 'water', 'oil', 'ice', 'lava', 'zerog', 'mud', 'wind'];

export const getMaterial = (id: MaterialId): MaterialDefinition => MATERIALS[id];
