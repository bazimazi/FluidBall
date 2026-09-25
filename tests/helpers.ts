import { box, buildWorld } from '../src/levels/build';
import type { LevelDef, Solid } from '../src/levels/types';
import { type BallEvent, type BallInput, type BallState, NO_INPUT, createBall, stepBall } from '../src/physics/ball';
import type { MaterialId } from '../src/physics/materials';
import { type PhysicsWorld, type WorldState, type Zone, newWorldState } from '../src/physics/world';

export const DT = 1 / 120;

export function makeWorld(solids: Solid[], zones: Zone[] = []): PhysicsWorld {
  const def: LevelDef = {
    id: 't',
    name: 't',
    region: 't',
    blurb: '',
    bounds: { x: 0, y: 0, w: 1, h: 1 },
    spawn: { x: 0, y: 0 },
    solids,
    zones,
    checkpoints: [],
    goal: { x: 0, y: 0 },
    fragments: [],
    signs: [],
    materials: [],
    parTime: 0,
  };
  return buildWorld(def);
}

export const flatFloor = (): Solid[] => [box(-5000, 0, 20000, 100)];

export interface Sim {
  ball: BallState;
  world: PhysicsWorld;
  state: WorldState;
  events: BallEvent[];
  run(seconds: number, input?: BallInput | ((t: number) => BallInput)): Sim;
}

export function sim(world: PhysicsWorld, x: number, y: number, material: MaterialId = 'normal', locked = true): Sim {
  const ball = createBall({ x, y }, material);
  ball.materialLocked = locked;
  const state = newWorldState();
  const events: BallEvent[] = [];
  let t = 0;
  const s: Sim = {
    ball,
    world,
    state,
    events,
    run(seconds, input = NO_INPUT) {
      const end = t + seconds;
      while (t < end - 1e-9) {
        const i = typeof input === 'function' ? input(t) : input;
        stepBall(ball, i, world, state, DT, events);
        state.time += DT;
        t += DT;
      }
      return s;
    },
  };
  return s;
}

export const right: BallInput = { x: 1, y: 0, jump: false, jumpPressed: false };
export const left: BallInput = { x: -1, y: 0, jump: false, jumpPressed: false };
export const press: BallInput = { x: 0, y: 0, jump: true, jumpPressed: true };
export const holdJump: BallInput = { x: 0, y: 0, jump: true, jumpPressed: false };
