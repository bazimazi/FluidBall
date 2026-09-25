import { describe, expect, it } from 'vitest';
import { CAMPAIGN } from '../src/levels/campaign';
import { LAB } from '../src/levels/lab';
import type { LevelDef, Pt } from '../src/levels/types';
import { Session } from '../src/game/session';
import { type BallInput, NO_INPUT } from '../src/physics/ball';

const DT = 1 / 120;
const I = (x: number, jump = false, jumpPressed = false, y = 0): BallInput => ({ x, y, jump, jumpPressed });

function insidePolygon(p: { x: number; y: number }, pts: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function insideSolid(level: LevelDef, p: { x: number; y: number }): boolean {
  return level.solids.some((s) => s.closed !== false && insidePolygon(p, s.points));
}

function play(level: LevelDef, bot: (s: Session) => BallInput, seconds: number): Session {
  const s = new Session(level);
  for (let t = 0; t < seconds && !s.finished; t += DT) s.step(bot(s), DT);
  return s;
}

describe.each([...CAMPAIGN, LAB])('level $id sanity', (level) => {
  it('spawn, checkpoints, goal and fragments are in open space', () => {
    for (const p of [level.spawn, ...level.checkpoints, level.goal, ...level.fragments]) {
      expect(insideSolid(level, p), `${level.id} point ${p.x},${p.y}`).toBe(false);
    }
  });

  it('the ball settles safely at spawn', () => {
    const s = play(level, () => NO_INPUT, 1.5);
    expect(s.deaths).toBe(0);
    expect(s.ball.grounded).toBe(true);
  });
});

/** Scripted runs proving each level can be finished and teaches what it claims. */
describe('level completability', () => {
  const byId = (id: string) => CAMPAIGN.find((l) => l.id === id)!;

  it('1-1 First Roll', () => {
    const s = play(byId('1-1'), (s) => {
      const b = s.ball;
      const x = b.pos.x;
      const j = (x > 1950 && x < 2000) || (x > 3270 && x < 3320) || (b.wallSide === 1 && b.grounded);
      return I(1, j || !b.grounded, j);
    }, 30);
    expect(s.finished).toBe(true);
  });

  it('1-1: the bounce pad reaches the fragment ledge', () => {
    const s = new Session(byId('1-1'));
    s.ball.pos = { x: 2860, y: 24 };
    let top = 0;
    for (let t = 0; t < 1.2; t += DT) {
      s.step(I(s.ball.pos.x < 2990 && s.ball.pos.y > 0 ? 1 : s.ball.pos.x < 3190 ? 1 : 0), DT);
      top = Math.min(top, s.ball.pos.y);
    }
    expect(top).toBeLessThan(-246 - 20);
  });

  it('1-2 Momentum Valley', () => {
    const s = play(byId('1-2'), (s) => {
      const b = s.ball;
      const j = (b.pos.x > 1440 && b.pos.x < 1500) || (b.wallSide === 1 && b.grounded);
      return I(1, j || !b.grounded, j);
    }, 30);
    expect(s.finished).toBe(true);
  });

  it('2-1 Into the Deep: swim down, through the tunnel, up the shaft', () => {
    const s = play(byId('2-1'), (s) => {
      const b = s.ball;
      const stroke = Math.round(s.time * 120) % 32 === 0;
      if (b.material !== 'water' || b.pos.x > 1900) return I(1);
      if (b.pos.x < 1400) return I(0.7, true, stroke, 0.7);
      return I(0.3, true, stroke, -1);
    }, 30);
    expect(s.finished).toBe(true);
  });

  it('3-1 Slick Descent: Oil clears the pipe, Ice clears the leap', () => {
    const s = play(byId('3-1'), (s) => {
      const x = s.ball.pos.x;
      const j = x > 5930 && x < 6000;
      return I(1, j, j);
    }, 20);
    expect(s.finished).toBe(true);
  });

  it('3-1: a Normal ball cannot clear the oil pipe', () => {
    const s = new Session(byId('3-1'));
    s.ball.pos = { x: 600, y: -330 };
    for (let t = 0; t < 8; t += DT) s.step(I(1), DT);
    expect(s.ball.pos.x).toBeLessThan(3260);
  });

  it('4-1 Rising Heat: lava rises, melts frost, sinks onto the goal', () => {
    const s = play(byId('4-1'), (s) => {
      const b = s.ball;
      if (b.material === 'lava' && b.pos.y < -1100 && b.pos.x > 1500) return I(b.pos.x < 1700 ? 0.3 : -0.3, false, false, 1);
      return I(1);
    }, 15);
    expect(s.state.broken.has('frost1')).toBe(true);
    expect(s.finished).toBe(true);
  });

  it('5-1 Weightless: burst through the void', () => {
    const s = play(byId('5-1'), (s) => {
      const b = s.ball;
      const p = b.material === 'zerog' && b.airImpulsesLeft > 0 && b.pos.y > -640 && b.vel.y > -200;
      return { x: p ? 0.5 : 1, y: p ? -0.9 : 0, jump: p, jumpPressed: p };
    }, 15);
    expect(s.finished).toBe(true);
  });

  it('6-1 Heavy Going: climb, smash the crate, walk the riverbed', () => {
    const s = play(byId('6-1'), () => I(1), 25);
    expect(s.state.broken.has('lid')).toBe(true);
    expect(s.finished).toBe(true);
  });

  it('7-1 Updraft: ride the draft, glide the gap', () => {
    const s = play(byId('7-1'), (s) => {
      const b = s.ball;
      const x = b.pos.x;
      if (b.pos.y > -700) return I(x < 600 ? 1 : x > 620 ? -1 : 0);
      if (x > 2440) return I(-0.5, true);
      return I(1, true);
    }, 15);
    expect(s.finished).toBe(true);
  });
});
