import { arc, box, ground } from './build';
import type { LevelDef } from './types';

/**
 * The Material Lab: one course containing a sample of every surface and force.
 * Materials are picked directly and locked (no timers, no zone transforms), so any
 * material can be compared against any obstacle.
 */
export const LAB: LevelDef = {
  id: 'lab',
  name: 'Material Lab',
  region: 'Laboratory',
  blurb: 'Every material, every surface, every force. Experiment freely.',
  materials: [],
  bounds: { x: -700, y: -1140, w: 6900, h: 1740 },
  spawn: { x: 150, y: -16 },
  parTime: 0,
  solids: [
    box(-700, -1140, 40, 1740),
    box(-660, -1140, 6820, 40),
    ground(
      [
        [-660, 0],
        [700, 0],
        [1000, 200],
        [1200, 200],
        [1500, 0],
      ],
      600,
    ),
    box(1500, 0, 300, 600, 'ice'),
    box(1800, 0, 300, 600, 'mud'),
    box(2100, 0, 200, 600, 'metal'),
    box(2300, -110, 100, 710),
    box(2400, -260, 200, 860),
    // Pool basin.
    box(2600, 300, 800, 300),
    box(3400, 0, 1000, 600),
    box(3500, -2, 100, 2, 'bouncer'),
    box(3700, -80, 80, 80, 'crate', 'labCrate'),
    box(3850, -200, 24, 200, 'frost', 'labFrost'),
    // Updraft ledge.
    box(4200, -500, 200, 40),
    box(4400, 0, 1000, 600),
    box(4400, -740, 1000, 40),
    // The curl: a quarter-pipe that wraps over the top. Oil rides it; others fall off.
    ground(
      [
        [5400, 0],
        [5700, 0],
        ...arc(5700, -300, 300, Math.PI / 2, -Math.PI / 2, 24),
        [6160, -600],
      ],
      600,
    ),
    box(6160, -1140, 40, 1740),
  ],
  zones: [
    { id: 'labPool', shape: { type: 'rect', x: 2600, y: 20, w: 800, h: 280 }, fluid: { density: 1, drag: 1.4 }, look: 'water' },
    {
      id: 'labCurrent',
      shape: { type: 'rect', x: 2600, y: 200, w: 800, h: 100 },
      force: { kind: 'current', dir: { x: -1, y: 0 }, strength: 500 },
      look: 'current',
    },
    {
      id: 'labDraft',
      shape: { type: 'rect', x: 4000, y: -900, w: 200, h: 900 },
      force: { kind: 'thermal', dir: { x: 0, y: -1 }, strength: 1000, turbulence: 0.15 },
      look: 'thermal',
    },
    {
      id: 'labWind',
      shape: { type: 'rect', x: 400, y: -600, w: 1000, h: 520 },
      force: { kind: 'wind', dir: { x: 1, y: 0 }, strength: 450, gust: 0.5, period: 3 },
      look: 'wind',
    },
    {
      id: 'labWell',
      shape: { type: 'circle', x: 4900, y: -380, r: 300 },
      force: { kind: 'gravityWell', center: { x: 4900, y: -380 }, strength: 700 },
      look: 'well',
    },
  ],
  checkpoints: [],
  goal: { x: -99999, y: -99999 },
  fragments: [],
  signs: [
    { x: 150, y: -110, text: 'Pick a material: 1-8 or the bar below' },
    { x: 900, y: -640, text: 'Gusts' },
    { x: 1100, y: 120, text: 'Bowl' },
    { x: 1950, y: -40, text: 'Ice · Mud · Metal floor' },
    { x: 2450, y: -320, text: 'Step & wall' },
    { x: 3000, y: -40, text: 'Pool + undertow' },
    { x: 3700, y: -260, text: 'Pad · Crate · Frost' },
    { x: 4100, y: -960, text: 'Updraft' },
    { x: 4900, y: -40, text: 'Gravity well' },
    { x: 5550, y: -40, text: 'Curl' },
  ],
};
