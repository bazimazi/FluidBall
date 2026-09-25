import { type BallInput, type BallState, NO_INPUT, createBall, stepBall } from '../physics/ball';
import { MATERIAL_ORDER, type MaterialId } from '../physics/materials';
import { newWorldState } from '../physics/world';
import { box } from './build';
import { buildWorld } from './build';
import type { LevelDef } from './types';

/**
 * Identical, scripted test runs used by the Material Lab (visual comparison) and the
 * automated identity tests. Every material gets the same geometry and the same input.
 */
export interface Scenario {
  id: string;
  name: string;
  description: string;
  duration: number;
  /** Geometry for one lane, relative to lane origin (0,0) = spawn floor level. */
  lane: (oy: number) => LevelDef['solids'];
  spawn: { x: number; y: number };
  script: (t: number) => BallInput;
  zones?: (oy: number) => LevelDef['zones'];
}

const hold = (x: number, jump = false): BallInput => ({ x, y: 0, jump, jumpPressed: false });

export const SCENARIOS: Scenario[] = [
  {
    id: 'coast',
    name: 'Push & Coast',
    description: 'Hold right for 0.8s, then let go. How far does momentum carry?',
    duration: 5,
    lane: (oy) => [box(-200, oy, 4200, 60), box(-240, oy - 300, 40, 360), box(-200, oy - 340, 4200, 40)],
    spawn: { x: 0, y: -16 },
    script: (t) => (t < 0.8 ? hold(1) : NO_INPUT),
  },
  {
    id: 'jump',
    name: 'Jump',
    description: 'A single full jump from rest. Height, hang time, landing.',
    duration: 2.5,
    lane: (oy) => [box(-400, oy, 800, 60), box(-400, oy - 340, 800, 40)],
    spawn: { x: 0, y: -16 },
    script: (t) => ({ x: 0, y: 0, jump: t < 0.6, jumpPressed: t >= 0.05 && t < 0.06 }),
  },
  {
    id: 'drop',
    name: 'Drop & Bounce',
    description: 'Dropped from 260px onto stone. Bounce, settle, float.',
    duration: 3,
    lane: (oy) => [box(-400, oy, 800, 60), box(-400, oy - 340, 800, 40)],
    spawn: { x: 0, y: -260 },
    script: () => NO_INPUT,
  },
  {
    id: 'ramp',
    name: 'Ramp & Wall',
    description: 'Roll down a slope into a wall while holding right.',
    duration: 4,
    lane: (oy) => [
      {
        points: [
          [-200, oy - 200],
          [200, oy - 200],
          [600, oy],
          [1400, oy],
          [1400, oy - 260],
          [1440, oy - 260],
          [1440, oy + 60],
          [-200, oy + 60],
        ],
      },
      box(-200, oy - 400, 1640, 40),
    ],
    spawn: { x: 0, y: -216 },
    script: () => hold(1),
  },
];

export interface ScenarioResult {
  material: MaterialId;
  /** Horizontal distance from spawn at end. */
  distance: number;
  maxHeight: number;
  maxSpeed: number;
  /** Time until speed stays below 5px/s, or duration. */
  settleTime: number;
  bounces: number;
  endMaterial: MaterialId;
}

export function runScenario(sc: Scenario, material: MaterialId, dt = 1 / 120): ScenarioResult {
  const world = buildWorld({
    id: sc.id,
    name: sc.name,
    region: 'lab',
    blurb: '',
    bounds: { x: -1000, y: -2000, w: 6000, h: 3000 },
    spawn: sc.spawn,
    solids: sc.lane(0),
    zones: sc.zones?.(0) ?? [],
    checkpoints: [],
    goal: { x: 0, y: 0 },
    fragments: [],
    signs: [],
    materials: [],
    parTime: 0,
  });
  const state = newWorldState();
  const ball: BallState = createBall(sc.spawn, material);
  ball.materialLocked = true;
  const events: Parameters<typeof stepBall>[5] = [];
  let maxHeight = 0;
  let maxSpeed = 0;
  let settleTime = sc.duration;
  let still = 0;
  let bounces = 0;
  for (let t = 0; t < sc.duration; t += dt) {
    events.length = 0;
    stepBall(ball, sc.script(t), world, state, dt, events);
    state.time += dt;
    bounces += events.filter((e) => e.type === 'impact').length;
    maxHeight = Math.max(maxHeight, sc.spawn.y - ball.pos.y);
    const s = Math.hypot(ball.vel.x, ball.vel.y);
    maxSpeed = Math.max(maxSpeed, s);
    if (s < 5) {
      still += dt;
      if (still > 0.25 && settleTime === sc.duration) settleTime = t - 0.25;
    } else {
      still = 0;
      settleTime = sc.duration;
    }
  }
  return {
    material,
    distance: ball.pos.x - sc.spawn.x,
    maxHeight,
    maxSpeed,
    settleTime,
    bounces,
    endMaterial: ball.material,
  };
}

export const runAll = (sc: Scenario): ScenarioResult[] => MATERIAL_ORDER.map((m) => runScenario(sc, m));
