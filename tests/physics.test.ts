import { describe, expect, it } from 'vitest';
import { box } from '../src/levels/build';
import { BALL_RADIUS, NO_INPUT, createBall, stepBall } from '../src/physics/ball';
import { newWorldState } from '../src/physics/world';
import { DT, flatFloor, holdJump, makeWorld, press, right, sim } from './helpers';

describe('core movement', () => {
  it('falls under gravity at the expected rate', () => {
    const s = sim(makeWorld([]), 0, 0).run(0.5);
    // y = g t^2 / 2 = 250 (semi-implicit Euler overshoots by ~g*dt*t/2)
    expect(s.ball.pos.y).toBeGreaterThan(245);
    expect(s.ball.pos.y).toBeLessThan(260);
  });

  it('comes to rest on flat ground, grounded, without jitter', () => {
    const s = sim(makeWorld(flatFloor()), 0, -100).run(2);
    expect(s.ball.grounded).toBe(true);
    expect(Math.abs(s.ball.vel.y)).toBeLessThan(1);
    expect(s.ball.pos.y).toBeCloseTo(-BALL_RADIUS, 0);
    const y = s.ball.pos.y;
    s.run(1);
    expect(Math.abs(s.ball.pos.y - y)).toBeLessThan(0.5);
  });

  it('does not tunnel through a thin wall at very high speed', () => {
    const s = sim(makeWorld([box(300, -500, 4, 1000)]), 0, 0);
    s.ball.vel.x = 6000;
    s.run(0.3);
    expect(s.ball.pos.x).toBeLessThan(300);
  });

  it('full jump height matches jumpSpeed^2 / 2g', () => {
    const s = sim(makeWorld(flatFloor()), 0, -BALL_RADIUS).run(0.2);
    const y0 = s.ball.pos.y;
    let minY = y0;
    s.run(DT, press);
    for (let i = 0; i < 80; i++) {
      s.run(DT, holdJump);
      minY = Math.min(minY, s.ball.pos.y);
    }
    const h = y0 - minY;
    expect(h).toBeGreaterThan(145);
    expect(h).toBeLessThan(165);
  });

  it('releasing jump early gives a shorter hop (variable jump height)', () => {
    const run = (holdFor: number) => {
      const s = sim(makeWorld(flatFloor()), 0, -BALL_RADIUS).run(0.2);
      const y0 = s.ball.pos.y;
      let minY = y0;
      s.run(DT, press);
      for (let t = 0; t < 1; t += DT) {
        s.run(DT, t < holdFor ? holdJump : NO_INPUT);
        minY = Math.min(minY, s.ball.pos.y);
      }
      return y0 - minY;
    };
    expect(run(0.05)).toBeLessThan(run(0.5) * 0.6);
  });

  it('coyote time: jump shortly after rolling off a ledge still works', () => {
    const world = makeWorld([box(-400, 0, 400, 100)]);
    const s = sim(world, -100, -BALL_RADIUS).run(0.1);
    s.ball.vel.x = 500;
    let leftAt = -1;
    for (let t = 0; t < 1; t += DT) {
      s.run(DT, NO_INPUT);
      if (!s.ball.grounded) {
        leftAt = t;
        break;
      }
    }
    expect(leftAt).toBeGreaterThan(0);
    s.run(0.06);
    s.run(DT, press);
    expect(s.ball.vel.y).toBeLessThan(-500);
  });

  it('jump buffer: pressing jump just before landing jumps on touchdown', () => {
    const s = sim(makeWorld(flatFloor()), 0, -120);
    for (let i = 0; i < 200 && s.ball.pos.y < -BALL_RADIUS - 25; i++) s.run(DT);
    s.run(DT, press);
    s.run(0.12, holdJump);
    expect(s.events.some((e) => e.type === 'jump')).toBe(true);
  });

  it('jump pressed during a landing rebound still jumps (no dead frames)', () => {
    const s = sim(makeWorld(flatFloor()), 0, -300);
    let jumped = false;
    for (let i = 0; i < 400 && !jumped; i++) {
      const hit = s.events.some((e) => e.type === 'impact');
      s.run(DT, hit ? press : NO_INPUT);
      if (hit) {
        s.run(DT, holdJump);
        jumped = s.events.some((e) => e.type === 'jump');
      }
    }
    expect(jumped).toBe(true);
  });

  it('is deterministic', () => {
    const run = () => {
      const world = makeWorld(flatFloor());
      const ball = createBall({ x: 0, y: -50 });
      const st = newWorldState();
      for (let i = 0; i < 600; i++) {
        stepBall(ball, { x: Math.sin(i * 0.05), y: 0, jump: i % 90 < 30, jumpPressed: i % 90 === 0 }, world, st, DT);
        st.time += DT;
      }
      return ball.pos;
    };
    expect(run()).toEqual(run());
  });

  it('rolls down slopes without input', () => {
    const world = makeWorld([
      {
        points: [
          [-500, -300],
          [500, 0],
          [500, 100],
          [-500, 100],
        ],
      },
    ]);
    const s = sim(world, -300, -260).run(1.2);
    expect(s.ball.pos.x).toBeGreaterThan(-100);
    expect(s.ball.vel.x).toBeGreaterThan(100);
  });

  it('accelerates toward and caps at max speed from input', () => {
    const s = sim(makeWorld(flatFloor()), 0, -BALL_RADIUS).run(2, right);
    expect(s.ball.vel.x).toBeGreaterThan(400);
    expect(s.ball.vel.x).toBeLessThanOrEqual(431);
  });
});
