import { describe, expect, it } from 'vitest';
import { box } from '../src/levels/build';
import { SCENARIOS, runScenario } from '../src/levels/scenarios';
import { BALL_RADIUS, NO_INPUT } from '../src/physics/ball';
import { MATERIALS, MATERIAL_ORDER, type MaterialId } from '../src/physics/materials';
import { flatFloor, holdJump, makeWorld, press, right, sim } from './helpers';

const scenario = (id: string) => SCENARIOS.find((s) => s.id === id)!;
const result = (id: string, m: MaterialId) => runScenario(scenario(id), m);

describe('material identity (identical scenarios)', () => {
  it('Oil and Ice coast several times farther than Normal; Mud and Water stop short', () => {
    const d = (m: MaterialId) => result('coast', m).distance;
    expect(d('oil')).toBeGreaterThan(d('normal') * 3);
    expect(d('ice')).toBeGreaterThan(d('normal') * 3);
    expect(d('mud')).toBeLessThan(d('normal') * 0.5);
    expect(d('water')).toBeLessThan(d('normal') * 0.7);
  });

  it('jump heights order: Normal > Water > Mud, Ice is a short rigid hop', () => {
    const h = (m: MaterialId) => result('jump', m).maxHeight;
    expect(h('normal')).toBeGreaterThan(h('water'));
    expect(h('water')).toBeGreaterThan(h('mud'));
    expect(h('ice')).toBeLessThan(h('normal') * 0.7);
  });

  it('Ice ricochets, Mud thuds', () => {
    expect(result('drop', 'ice').bounces).toBeGreaterThan(result('drop', 'normal').bounces);
    expect(result('drop', 'mud').bounces).toBe(1);
  });

  it('Lava falls upward to the ceiling; Zero-G does not fall at all', () => {
    expect(result('drop', 'lava').maxHeight).toBeGreaterThan(0);
    const z = sim(makeWorld([]), 0, 0, 'zerog').run(1);
    expect(Math.abs(z.ball.pos.y)).toBeLessThan(0.001);
  });

  it('Wind glides: holding jump caps the fall speed', () => {
    const s = sim(makeWorld([]), 0, 0, 'wind').run(1, holdJump);
    expect(s.ball.vel.y).toBeLessThan(MATERIALS.wind.glideFallSpeed + 10);
    const f = sim(makeWorld([]), 0, 0, 'normal').run(1, holdJump);
    expect(f.ball.vel.y).toBeGreaterThan(1000);
  });

  it('no two materials produce the same coast + jump + bounce fingerprint', () => {
    const fp = MATERIAL_ORDER.map((m) =>
      [result('coast', m).distance, result('jump', m).maxHeight, result('drop', m).bounces]
        .map((n) => Math.round(n / 10))
        .join(','),
    );
    expect(new Set(fp).size).toBe(MATERIAL_ORDER.length);
  });

  it('Mud climbs walls it pushes into; Normal does not', () => {
    const world = makeWorld([...flatFloor(), box(100, -600, 50, 600)]);
    const mud = sim(world, 100 - BALL_RADIUS - 1, -BALL_RADIUS, 'mud').run(1, right);
    const normal = sim(world, 100 - BALL_RADIUS - 1, -BALL_RADIUS, 'normal').run(1, right);
    expect(mud.ball.pos.y).toBeLessThan(-120);
    expect(normal.ball.pos.y).toBeGreaterThan(-20);
  });

  it('Water swims (repeated strokes) inside fluid but not in open air', () => {
    const pool = { id: 'pool', shape: { type: 'rect' as const, x: -500, y: -600, w: 1000, h: 600 }, fluid: { density: 1, drag: 1.5 } };
    const world = makeWorld(flatFloor(), [pool]);
    const s = sim(world, 0, -BALL_RADIUS, 'water');
    for (let i = 0; i < 6; i++) s.run(0.02, press).run(0.3, holdJump);
    expect(s.ball.pos.y).toBeLessThan(-250);
    const dry = sim(makeWorld(flatFloor()), 0, -BALL_RADIUS, 'water');
    for (let i = 0; i < 6; i++) dry.run(0.02, press).run(0.3, holdJump);
    expect(dry.ball.pos.y).toBeGreaterThan(-120);
  });

  it('Zero-G bursts are limited and refill on contact', () => {
    const s = sim(makeWorld([]), 0, 0, 'zerog');
    s.run(0.02, press).run(0.2, NO_INPUT).run(0.02, press).run(0.2, NO_INPUT).run(0.02, press);
    expect(s.events.filter((e) => e.type === 'airImpulse').length).toBe(2);
  });
});

describe('composable environment', () => {
  const coast = (material: MaterialId, surface: 'stone' | 'ice') => {
    const world = makeWorld([box(-500, 0, 30000, 100, surface)]);
    const s = sim(world, 0, -BALL_RADIUS, material).run(0.1);
    s.ball.vel.x = 400;
    return s.run(2).ball.pos.x;
  };

  it('ball material and surface friction combine', () => {
    expect(coast('normal', 'ice')).toBeGreaterThan(coast('normal', 'stone') * 1.5);
    expect(coast('ice', 'ice')).toBeGreaterThan(coast('normal', 'ice'));
    expect(coast('mud', 'ice')).toBeLessThan(coast('normal', 'ice'));
  });

  it('the same wind pushes Wind far, Normal some, Mud barely', () => {
    const wind = {
      id: 'w',
      shape: { type: 'rect' as const, x: -2000, y: -1000, w: 8000, h: 2000 },
      force: { kind: 'wind' as const, dir: { x: 1, y: 0 }, strength: 700 },
    };
    const world = makeWorld(flatFloor(), [wind]);
    const x = (m: MaterialId) => sim(world, 0, -BALL_RADIUS, m).run(1).ball.pos.x;
    expect(x('wind')).toBeGreaterThan(x('normal') * 1.5);
    expect(x('mud')).toBeLessThan(x('normal') * 0.3);
  });

  it('buoyancy depends on density: Ice floats, Mud sinks', () => {
    const pool = { id: 'p', shape: { type: 'rect' as const, x: -500, y: -400, w: 1000, h: 400 }, fluid: { density: 1, drag: 1 } };
    const world = makeWorld(flatFloor(), [pool]);
    expect(sim(world, 0, -200, 'ice').run(3).ball.pos.y).toBeLessThan(-350);
    expect(sim(world, 0, -200, 'mud').run(3).ball.grounded).toBe(true);
  });

  it('Mud smashes crates, Normal bounces off them', () => {
    const world = makeWorld([...flatFloor(), box(-40, -300, 80, 20, 'crate', 'c1')]);
    const mud = sim(world, 0, -700, 'mud').run(1.5);
    expect(mud.state.broken.has('c1')).toBe(true);
    const normal = sim(world, 0, -700, 'normal').run(1.5);
    expect(normal.state.broken.has('c1')).toBe(false);
  });

  it('Lava melts frost barriers', () => {
    const world = makeWorld([box(-500, -300, 1000, 20, 'frost', 'f1'), box(-500, 0, 1000, 50)]);
    const s = sim(world, 0, -100, 'lava').run(1);
    expect(s.state.broken.has('f1')).toBe(true);
    expect(s.ball.pos.y).toBeLessThan(-300);
  });
});

describe('material transitions', () => {
  const zone = (id: string, material: MaterialId, x = -100) => ({
    id,
    shape: { type: 'rect' as const, x, y: -200, w: 200, h: 200 },
    material,
  });

  it('entering a zone transforms the ball (once, on enter)', () => {
    const world = makeWorld(flatFloor(), [zone('z', 'oil')]);
    const s = sim(world, 0, -BALL_RADIUS, 'normal', false).run(0.1);
    expect(s.ball.material).toBe('oil');
    expect(s.events.filter((e) => e.type === 'transform').length).toBe(1);
  });

  it('Lava entering water flashes to steam and pops upward', () => {
    const world = makeWorld([], [zone('w', 'water')]);
    const s = sim(world, 0, -300, 'lava', false);
    s.ball.pos.y = -100;
    s.run(1 / 120);
    expect(s.ball.material).toBe('water');
    expect(s.ball.vel.y).toBeLessThan(-900);
    expect(s.events.find((e) => e.type === 'transform')).toMatchObject({ effect: 'steam' });
  });

  it('chain: Water freezes to Ice, Ice melts back to Water in lava', () => {
    const world = makeWorld([], [zone('cold', 'ice', -100), zone('hot', 'lava', 400)]);
    const s = sim(world, 0, -100, 'water', false);
    s.run(1 / 120);
    expect(s.ball.material).toBe('ice');
    s.ball.pos = { x: 500, y: -100 };
    s.run(1 / 120);
    expect(s.ball.material).toBe('water');
  });

  it('temporary materials revert to Normal after their duration away from a source', () => {
    const s = sim(makeWorld(flatFloor()), 0, -BALL_RADIUS, 'lava', false);
    s.run(MATERIALS.lava.duration! + 0.1);
    expect(s.ball.material).toBe('normal');
    expect(s.events.some((e) => e.type === 'revert')).toBe(true);
  });

  it('Zero-G only lasts while inside its zone', () => {
    const world = makeWorld([], [zone('void', 'zerog')]);
    const s = sim(world, 0, -100, 'normal', false).run(1 / 120);
    expect(s.ball.material).toBe('zerog');
    s.ball.vel.x = 800;
    s.run(0.5);
    expect(s.ball.material).toBe('normal');
  });

  it('locked materials (lab) never change', () => {
    const world = makeWorld(flatFloor(), [zone('z', 'oil')]);
    const s = sim(world, 0, -BALL_RADIUS, 'mud', true).run(20);
    expect(s.ball.material).toBe('mud');
  });
});
