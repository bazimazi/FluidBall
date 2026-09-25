import type { MaterialId } from './materials';

/**
 * What happens when a ball of material `from` touches a source of material `source`.
 * Default: the ball becomes the source material. Rules below override that default.
 * Effects are named so VFX/audio/physics can each react without knowing the rule table.
 */
export type InteractionEffect = 'steam' | 'ignite' | 'melt' | 'freeze' | 'float' | 'sink';

export interface InteractionRule {
  from: MaterialId | '*';
  source: MaterialId;
  result: MaterialId;
  effect?: InteractionEffect;
}

export const INTERACTIONS: InteractionRule[] = [
  // Lava hitting water flashes to steam: a violent upward pop, then the ball is just wet.
  { from: 'lava', source: 'water', result: 'water', effect: 'steam' },
  // Water touching lava: same reaction from the other side.
  { from: 'water', source: 'lava', result: 'normal', effect: 'steam' },
  // Oil ignites in lava: becomes lava with a burst along its travel direction.
  { from: 'oil', source: 'lava', result: 'lava', effect: 'ignite' },
  // Ice melts in lava into water.
  { from: 'ice', source: 'lava', result: 'water', effect: 'melt' },
  // Ice is not dissolved by water - it floats (density < 1).
  { from: 'ice', source: 'water', result: 'ice', effect: 'float' },
  // Mud does not wash off; it sinks and can walk the bottom against currents.
  { from: 'mud', source: 'water', result: 'mud', effect: 'sink' },
  // Water freezes in ice chambers.
  { from: 'water', source: 'ice', result: 'ice', effect: 'freeze' },
];

export interface Transition {
  result: MaterialId;
  effect?: InteractionEffect;
}

export function resolveTransition(from: MaterialId, source: MaterialId): Transition {
  for (const r of INTERACTIONS) {
    if (r.source === source && (r.from === from || r.from === '*')) return { result: r.result, effect: r.effect };
  }
  return { result: source };
}
