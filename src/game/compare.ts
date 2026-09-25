import type { Vec2 } from '../core/math';
import { buildWorld } from '../levels/build';
import { type Scenario, type ScenarioResult, runAll } from '../levels/scenarios';
import type { LevelDef } from '../levels/types';
import { type BallState, createBall, stepBall } from '../physics/ball';
import { MATERIALS, MATERIAL_ORDER } from '../physics/materials';
import { type PhysicsWorld, type WorldState, newWorldState } from '../physics/world';

/**
 * Lab comparison: every material runs the same scenario with the same scripted input,
 * overlaid on one course as ghosts, so differences are visible side by side.
 */
export class CompareRun {
  readonly level: LevelDef;
  readonly world: PhysicsWorld;
  readonly states: WorldState[];
  readonly balls: BallState[];
  readonly prev: Vec2[];
  readonly results: ScenarioResult[];
  time = 0;

  constructor(readonly scenario: Scenario) {
    this.level = {
      id: `compare-${scenario.id}`,
      name: scenario.name,
      region: 'Laboratory',
      blurb: scenario.description,
      bounds: { x: -700, y: -900, w: 5200, h: 1400 },
      spawn: scenario.spawn,
      solids: scenario.lane(0),
      zones: scenario.zones?.(0) ?? [],
      checkpoints: [],
      goal: { x: -99999, y: -99999 },
      fragments: [],
      signs: [],
      materials: [],
      parTime: 0,
    };
    this.world = buildWorld(this.level);
    this.balls = MATERIAL_ORDER.map((m) => {
      const b = createBall(scenario.spawn, m);
      b.materialLocked = true;
      return b;
    });
    // Each ghost gets its own world state so one breaking/melting geometry doesn't affect the others.
    this.states = this.balls.map(() => newWorldState());
    this.prev = this.balls.map((b) => ({ ...b.pos }));
    this.results = runAll(scenario);
  }

  step(dt: number): void {
    const input = this.scenario.script(this.time);
    this.balls.forEach((b, i) => {
      this.prev[i] = { ...b.pos };
      if (this.time < this.scenario.duration) {
        stepBall(b, input, this.world, this.states[i], dt);
        this.states[i].time += dt;
      }
    });
    this.time += dt;
  }

  /** Point the camera tracks: the average position of the pack. */
  focus(): Vec2 {
    const n = this.balls.length;
    const sx = this.balls.reduce((a, b) => a + clampAbs(b.pos.x - this.scenario.spawn.x, 900), 0) / n;
    const sy = this.balls.reduce((a, b) => a + clampAbs(b.pos.y - this.scenario.spawn.y, 300), 0) / n;
    return { x: this.scenario.spawn.x + sx, y: this.scenario.spawn.y + sy };
  }

  label(i: number): string {
    return MATERIALS[this.balls[i].material].name;
  }
}

const clampAbs = (v: number, m: number) => Math.max(-m, Math.min(m, v));
