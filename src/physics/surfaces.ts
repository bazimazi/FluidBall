/** What the ball is touching. Combined multiplicatively with the ball material. */

export type SurfaceId = 'stone' | 'ice' | 'mud' | 'metal' | 'bouncer' | 'spikes' | 'crate' | 'frost';

export interface SurfaceDefinition {
  id: SurfaceId;
  friction: number;
  traction: number;
  restitution: number;
  /** Guaranteed outgoing normal speed on impact (bounce pads). */
  minBounceSpeed: number;
  hazard: boolean;
  /** Breaks when mass * impact speed exceeds this. */
  breakImpulse: number | null;
  /** Melts when a ball at or above this temperature touches it. */
  meltTemperature: number | null;
  color: string;
  edge: string;
}

const base: Omit<SurfaceDefinition, 'id' | 'color' | 'edge'> = {
  friction: 1,
  traction: 1,
  restitution: 1,
  minBounceSpeed: 0,
  hazard: false,
  breakImpulse: null,
  meltTemperature: null,
};

export const SURFACES: Record<SurfaceId, SurfaceDefinition> = {
  stone: { ...base, id: 'stone', color: '#2a2f3a', edge: '#8a93a6' },
  ice: { ...base, id: 'ice', friction: 0.06, traction: 0.3, restitution: 1.05, color: '#1d3a48', edge: '#9ff0ff' },
  mud: { ...base, id: 'mud', friction: 3.5, traction: 0.85, restitution: 0.25, color: '#3a2a1c', edge: '#a47b4d' },
  metal: { ...base, id: 'metal', friction: 0.7, traction: 0.9, restitution: 1.2, color: '#30343c', edge: '#cfd6e0' },
  bouncer: {
    ...base,
    id: 'bouncer',
    restitution: 1.6,
    minBounceSpeed: 1150,
    color: '#402036',
    edge: '#ff6fb5',
  },
  spikes: { ...base, id: 'spikes', hazard: true, restitution: 0, color: '#3a1818', edge: '#ff4040' },
  /** Only heavy impacts break crates: Mud smashes through, Normal bounces off. */
  crate: { ...base, id: 'crate', breakImpulse: 1500, color: '#4a3620', edge: '#d9a55b' },
  /** Frozen barrier: Lava melts it. */
  frost: {
    ...base,
    id: 'frost',
    friction: 0.1,
    traction: 0.4,
    meltTemperature: 1,
    color: '#20465a',
    edge: '#d5fbff',
  },
};
