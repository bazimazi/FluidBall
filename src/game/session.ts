import type { Vec2 } from '../core/math';
import { buildWorld } from '../levels/build';
import type { LevelDef } from '../levels/types';
import { type BallEvent, type BallInput, type BallState, createBall, setMaterial, stepBall } from '../physics/ball';
import type { MaterialId } from '../physics/materials';
import { type PhysicsWorld, type WorldState, newWorldState } from '../physics/world';

export type GameEvent =
  | BallEvent
  | { type: 'checkpoint'; index: number; pos: Vec2 }
  | { type: 'fragment'; index: number; pos: Vec2 }
  | { type: 'finish'; time: number }
  | { type: 'respawn'; pos: Vec2 };

export const CHECKPOINT_RADIUS = 48;
export const FRAGMENT_RADIUS = 30;
export const GOAL_RADIUS = 44;
/** Short beat between death and respawn: enough to read what happened, not enough to bore. */
export const RESPAWN_DELAY = 0.45;

/** One attempt at a level: simulation + objectives, no rendering. */
export class Session {
  readonly world: PhysicsWorld;
  state: WorldState;
  ball: BallState;
  time = 0;
  deaths = 0;
  checkpoint = -1;
  fragments = new Set<number>();
  finished = false;
  deadTimer = 0;
  readonly events: GameEvent[] = [];

  constructor(
    readonly level: LevelDef,
    readonly lab = false,
  ) {
    this.world = buildWorld(level);
    this.state = newWorldState();
    this.ball = this.spawnBall(level.spawn, level.startMaterial);
  }

  private spawnBall(at: Vec2, material: MaterialId = 'normal'): BallState {
    const b = createBall(at, material);
    b.materialLocked = this.lab;
    return b;
  }

  get respawnPoint(): Vec2 {
    return this.checkpoint >= 0 ? this.level.checkpoints[this.checkpoint] : this.level.spawn;
  }

  /** Lab: pick a material directly. */
  setLabMaterial(m: MaterialId): void {
    setMaterial(this.ball, m);
  }

  step(input: BallInput, dt: number): GameEvent[] {
    const ev = this.events;
    ev.length = 0;
    if (this.finished) return ev;
    this.time += dt;
    this.state.time += dt;

    if (this.ball.dead) {
      this.deadTimer -= dt;
      if (this.deadTimer <= 0) this.respawn();
      return ev;
    }

    stepBall(this.ball, input, this.world, this.state, dt, ev as BallEvent[]);
    const b = this.ball;
    const bounds = this.level.bounds;
    if (!b.dead && (b.pos.y > bounds.y + bounds.h + 40 || b.pos.y < bounds.y - 400 || b.pos.x < bounds.x - 200 || b.pos.x > bounds.x + bounds.w + 200)) {
      b.dead = true;
      ev.push({ type: 'death', pos: { ...b.pos }, cause: 'fell' });
    }
    if (b.dead) {
      this.deaths++;
      this.deadTimer = RESPAWN_DELAY;
      return ev;
    }

    this.level.checkpoints.forEach((c, i) => {
      if (i > this.checkpoint && dist2(b.pos, c) < CHECKPOINT_RADIUS ** 2) {
        this.checkpoint = i;
        ev.push({ type: 'checkpoint', index: i, pos: c });
      }
    });
    this.level.fragments.forEach((f, i) => {
      if (!this.fragments.has(i) && dist2(b.pos, f) < FRAGMENT_RADIUS ** 2) {
        this.fragments.add(i);
        ev.push({ type: 'fragment', index: i, pos: f });
      }
    });
    if (!this.lab && dist2(b.pos, this.level.goal) < GOAL_RADIUS ** 2) {
      this.finished = true;
      ev.push({ type: 'finish', time: this.time });
    }
    return ev;
  }

  respawn(): void {
    const at = this.respawnPoint;
    const keep = this.lab ? this.ball.material : undefined;
    this.ball = this.spawnBall(at, keep ?? this.level.startMaterial);
    this.events.push({ type: 'respawn', pos: at });
  }

  /** Full restart: time, checkpoints, broken geometry. Fragments collected this attempt are kept. */
  restart(): void {
    this.state = newWorldState();
    this.checkpoint = -1;
    this.time = 0;
    this.deaths = 0;
    this.finished = false;
    this.ball = this.spawnBall(this.level.spawn, this.lab ? this.ball.material : this.level.startMaterial);
  }
}

const dist2 = (a: Vec2, b: Vec2) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
