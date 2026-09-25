import { arc, box, ground, poly } from './build';
import type { LevelDef } from './types';

/**
 * Campaign levels. Each introduces one idea safely, lets the player play with it,
 * then asks for it once. Optional fragments sit on the skill or curiosity route.
 *
 * Coordinates: y down, ground usually at y = 0. Ball radius 16, so a ball resting on
 * ground at y has its center at y - 16.
 */

// ---------------------------------------------------------------- WORLD 1 · THE ORIGIN

const firstRoll: LevelDef = {
  id: '1-1',
  name: 'First Roll',
  region: 'The Origin',
  blurb: 'Roll, jump, and feel the ball.',
  materials: ['normal'],
  bounds: { x: -200, y: -800, w: 4400, h: 1300 },
  spawn: { x: 100, y: -16 },
  parTime: 22,
  solids: [
    box(-200, -800, 40, 1300),
    ground(
      [
        [-160, 0],
        [400, 0],
        [500, -36],
        [600, 0],
        [900, 0],
        [1300, 120],
        [1600, 120],
        [1800, 40],
        [2000, 40],
      ],
      500,
    ),
    ground(
      [
        [2130, 40],
        [2500, 40],
        [2500, -80],
        [2800, -80],
        [2800, 40],
        [2950, 40],
      ],
      500,
    ),
    // Bounce pad sits in the main path: roll over it once and you know what it does.
    box(2950, 40, 100, 460, 'bouncer'),
    ground(
      [
        [3050, 40],
        [3350, 40],
      ],
      500,
    ),
    box(3350, 22, 110, 478, 'spikes'),
    ground(
      [
        [3460, 40],
        [4160, 40],
      ],
      500,
    ),
    // High ledge above the pad: the fragment is for players who steer mid-air.
    box(3110, -230, 170, 20),
    box(4160, -800, 40, 1300),
  ],
  zones: [],
  checkpoints: [
    { x: 1450, y: 104 },
    { x: 2250, y: 24 },
    { x: 3150, y: 24 },
  ],
  goal: { x: 3900, y: 10 },
  fragments: [{ x: 3200, y: -262 }],
  signs: [
    { x: 120, y: -90, text: '← → roll   ·   touch: drag on the left' },
    { x: 1050, y: -40, text: 'Let momentum carry you' },
    { x: 1880, y: -60, text: 'Jump: Space / tap right side. Hold for height' },
    { x: 2680, y: -160, text: 'Pink pads launch you' },
  ],
};

const momentumValley: LevelDef = {
  id: '1-2',
  name: 'Momentum Valley',
  region: 'The Origin',
  blurb: 'Slopes are engines. A safe way round, a fast way over.',
  materials: ['normal'],
  bounds: { x: -200, y: -900, w: 4300, h: 1400 },
  spawn: { x: 100, y: -316 },
  parTime: 25,
  solids: [
    box(-200, -900, 40, 1400),
    ground(
      [
        [-160, -300],
        [400, -300],
        [900, 100],
        [1100, 100],
        [1500, -200],
      ],
      500,
    ),
    // Safe route: fall into the gap and take the stairs.
    ground(
      [
        [1500, 250],
        [1900, 250],
        [1900, 140],
        [2020, 140],
        [2020, 30],
        [2140, 30],
        [2140, -80],
        [2260, -80],
        [2260, -200],
        [2600, -200],
        [3200, 100],
        [3300, 100],
        [3500, -60],
        [4060, -60],
      ],
      500,
    ),
    box(4060, -900, 40, 1400),
  ],
  zones: [],
  checkpoints: [
    { x: 2420, y: -216 },
    { x: 3250, y: 84 },
  ],
  goal: { x: 3900, y: -90 },
  fragments: [{ x: 1680, y: -380 }],
  signs: [
    { x: 150, y: -390, text: 'Roll down. Keep your speed' },
    { x: 1700, y: 170, text: 'The slow way is always there' },
    { x: 3050, y: -60, text: 'Build speed to climb' },
  ],
};

// ---------------------------------------------------------------- WORLD 2 · THE DEEP

const firstWater: LevelDef = {
  id: '2-1',
  name: 'Into the Deep',
  region: 'The Deep',
  blurb: 'Water makes you heavy, and lets you swim.',
  materials: ['water'],
  bounds: { x: -200, y: -700, w: 3200, h: 1400 },
  spawn: { x: 100, y: -16 },
  parTime: 30,
  solids: [
    box(-200, -700, 40, 1400),
    ground(
      [
        [-160, 0],
        [600, 0],
        [600, 400],
      ],
      700,
    ),
    box(600, 400, 1300, 300),
    // Pool wall: too high to jump out, so the way on is the tunnel at the bottom.
    box(1400, -250, 360, 530),
    ground(
      [
        [1900, -150],
        [2900, -150],
      ],
      700,
    ),
    box(2900, -700, 40, 1400),
  ],
  zones: [
    { id: 'pool', shape: { type: 'rect', x: 600, y: 40, w: 800, h: 360 }, material: 'water', fluid: { density: 1, drag: 1.6 }, look: 'water' },
    {
      id: 'tunnel',
      shape: { type: 'rect', x: 1400, y: 280, w: 360, h: 120 },
      material: 'water',
      fluid: { density: 1, drag: 1.6 },
      force: { kind: 'current', dir: { x: 1, y: 0 }, strength: 500 },
      look: 'current',
    },
    {
      id: 'shaft',
      shape: { type: 'rect', x: 1760, y: -150, w: 140, h: 550 },
      material: 'water',
      fluid: { density: 1, drag: 1.6 },
      force: { kind: 'current', dir: { x: 0, y: -1 }, strength: 260 },
      look: 'current',
    },
  ],
  checkpoints: [
    { x: 520, y: -16 },
    { x: 2050, y: -166 },
  ],
  goal: { x: 2700, y: -180 },
  fragments: [{ x: 660, y: 370 }],
  signs: [
    { x: 380, y: -90, text: 'In water: jump to swim. Aim with direction' },
    { x: 1580, y: -330, text: 'Too high. Look below' },
    { x: 2300, y: -240, text: 'Wet balls are heavy. They dry off' },
  ],
};

// ---------------------------------------------------------------- WORLD 3 · THE SLIPPER

const slipper: LevelDef = {
  id: '3-1',
  name: 'Slick Descent',
  region: 'The Slipper',
  blurb: 'Oil keeps every bit of speed. Ice glides, and never stops.',
  materials: ['oil', 'ice'],
  bounds: { x: -200, y: -1000, w: 7700, h: 1500 },
  spawn: { x: 100, y: -416 },
  parTime: 30,
  solids: [
    box(-200, -1000, 40, 1500),
    // Oil run: long drop, long flat, then a curved quarter-pipe that only a slick ball clears.
    ground(
      [
        [-160, -400],
        [500, -400],
        [1300, 300],
        [2900, 300],
        ...arc(2900, 0, 300, Math.PI / 2, Math.PI / 12, 12),
      ],
      500,
    ),
    // Slanted fill between the lip and the ledge: a failed run rolls back into the pipe.
    poly([
      [3190, 78],
      [3260, 20],
      [3260, 500],
      [3190, 500],
    ]),
    // Ledge above the pipe lip.
    ground(
      [
        [3260, 0],
        [4000, 0],
        [4600, 300],
        [5800, 300],
        [6000, 200],
      ],
      500,
    ),
    // Ice leap: a long flat saps Normal's speed but not Ice's.
    ground(
      [
        [6400, 250],
        [7460, 250],
      ],
      500,
    ),
    box(7460, -1000, 40, 1500),
  ],
  zones: [
    { id: 'oil1', shape: { type: 'rect', x: 380, y: -440, w: 110, h: 40 }, material: 'oil', look: 'oil' },
    { id: 'ice1', shape: { type: 'rect', x: 3950, y: -180, w: 140, h: 180 }, material: 'ice', look: 'ice' },
  ],
  checkpoints: [
    { x: 3400, y: -16 },
    { x: 6600, y: 234 },
  ],
  goal: { x: 6950, y: 220 },
  fragments: [{ x: 6200, y: 40 }],
  signs: [
    { x: 150, y: -500, text: 'Oil: slick, keeps momentum, clings at speed' },
    { x: 2000, y: 200, text: "Don't brake. Oil barely can" },
    { x: 3700, y: -110, text: 'Ice: no friction. Let the slope do the work' },
    { x: 5800, y: 190, text: 'Jump at the lip' },
  ],
};

// ---------------------------------------------------------------- WORLD 4 · THE CORE

const core: LevelDef = {
  id: '4-1',
  name: 'Rising Heat',
  region: 'The Core',
  blurb: 'Lava falls upward, rolls on ceilings, and melts ice. Then it cools.',
  materials: ['lava'],
  bounds: { x: -200, y: -1800, w: 2400, h: 2200 },
  spawn: { x: 60, y: -16 },
  parTime: 25,
  solids: [
    box(-200, -1800, 40, 2200),
    box(-160, 0, 2320, 400),
    // Shaft 1 ceiling, rolled along upside down.
    box(-160, -640, 900, 40),
    // Shaft 2.
    box(700, -1400, 40, 760),
    box(900, -1300, 40, 900),
    box(740, -1010, 160, 20, 'frost', 'frost1'),
    // Top ceiling and the landing platform beneath it.
    box(700, -1440, 1460, 40),
    box(1300, -1000, 600, 40),
    box(2160, -1800, 40, 2200),
  ],
  zones: [
    { id: 'vent1', shape: { type: 'rect', x: 200, y: -70, w: 120, h: 70 }, material: 'lava', look: 'lava' },
    { id: 'vent2', shape: { type: 'rect', x: 1450, y: -70, w: 120, h: 70 }, material: 'lava', look: 'lava' },
    {
      id: 'thermal',
      shape: { type: 'rect', x: 940, y: -960, w: 360, h: 960 },
      force: { kind: 'thermal', dir: { x: 0, y: -1 }, strength: 500, turbulence: 0.2 },
      look: 'thermal',
    },
  ],
  checkpoints: [{ x: 1050, y: -16 }],
  goal: { x: 1800, y: -1040 },
  fragments: [{ x: -110, y: -570 }],
  signs: [
    { x: 150, y: -110, text: 'Lava rises. Hold ↓ to sink' },
    { x: 400, y: -560, text: 'Roll along the ceiling' },
    { x: 1250, y: -110, text: 'Cooled off? Heat up again' },
  ],
};

// ---------------------------------------------------------------- WORLD 5 · THE VOID

const voidLevel: LevelDef = {
  id: '5-1',
  name: 'Weightless',
  region: 'The Void',
  blurb: 'No gravity. Two bursts per touch. Wells bend your path.',
  materials: ['zerog'],
  bounds: { x: -200, y: -1100, w: 3000, h: 1600 },
  spawn: { x: 100, y: -16 },
  parTime: 30,
  solids: [
    box(-200, -1100, 40, 1600),
    box(-160, 0, 560, 500),
    box(400, -940, 1600, 40),
    box(400, 300, 1600, 40, 'spikes'),
    box(820, -300, 140, 30),
    box(1560, -720, 140, 30),
    ground(
      [
        [2000, -600],
        [2760, -600],
      ],
      500,
    ),
    box(2760, -1100, 40, 1600),
  ],
  zones: [
    { id: 'void', shape: { type: 'rect', x: 400, y: -900, w: 1600, h: 1200 }, material: 'zerog', look: 'zerog' },
    {
      id: 'well',
      shape: { type: 'circle', x: 1250, y: -420, r: 330 },
      force: { kind: 'gravityWell', center: { x: 1250, y: -420 }, strength: 700 },
      look: 'well',
    },
  ],
  checkpoints: [{ x: 2150, y: -616 }],
  goal: { x: 2550, y: -630 },
  fragments: [{ x: 1250, y: -660 }],
  signs: [
    { x: 160, y: -100, text: 'Jump + direction: burst. Touch anything to recharge' },
    { x: 890, y: -360, text: 'Push off' },
  ],
};

// ---------------------------------------------------------------- WORLD 6 · THE SINKING LANDS

const mudLevel: LevelDef = {
  id: '6-1',
  name: 'Heavy Going',
  region: 'The Sinking Lands',
  blurb: 'Mud grips walls, ignores currents and smashes crates.',
  materials: ['mud'],
  bounds: { x: -200, y: -900, w: 3100, h: 1400 },
  spawn: { x: 100, y: -16 },
  parTime: 35,
  solids: [
    box(-200, -900, 40, 1400),
    box(-160, 0, 400, 400),
    box(240, 0, 160, 400, 'mud'),
    box(400, 0, 200, 400),
    box(600, -400, 200, 900),
    // Crate lid over the pit: only a heavy landing breaks it.
    box(800, -100, 300, 24, 'crate', 'lid'),
    box(800, 300, 1700, 200),
    box(1100, -900, 200, 1100),
    box(2300, -100, 600, 600),
    box(2860, -900, 40, 1400),
  ],
  zones: [
    { id: 'mudpit', shape: { type: 'rect', x: 240, y: -40, w: 160, h: 40 }, material: 'mud', look: 'mud' },
    { id: 'mudpit2', shape: { type: 'rect', x: 820, y: 250, w: 260, h: 50 }, material: 'mud', look: 'mud' },
    // Rescue: a ball that dried off on the lid can re-coat and hop to break it.
    { id: 'lidmud', shape: { type: 'rect', x: 1000, y: -140, w: 100, h: 40 }, material: 'mud', look: 'mud' },
    {
      id: 'river',
      shape: { type: 'rect', x: 1300, y: -60, w: 1000, h: 360 },
      material: 'water',
      fluid: { density: 1, drag: 1.2 },
      force: { kind: 'current', dir: { x: -1, y: 0 }, strength: 900 },
      look: 'current',
    },
  ],
  checkpoints: [{ x: 950, y: 284 }],
  goal: { x: 2600, y: -130 },
  fragments: [{ x: 700, y: -440 }],
  signs: [
    { x: 100, y: -100, text: 'Mud: push into walls to climb' },
    { x: 700, y: -500, text: 'Heavy things break things' },
    { x: 1400, y: -140, text: 'Mud sinks, and the current barely moves it' },
  ],
};

// ---------------------------------------------------------------- WORLD 7 · THE SKY

const sky: LevelDef = {
  id: '7-1',
  name: 'Updraft',
  region: 'The Sky',
  blurb: 'Wind is light: drafts lift you, and holding jump glides.',
  materials: ['wind'],
  bounds: { x: -200, y: -1400, w: 2900, h: 1800 },
  spawn: { x: 100, y: -16 },
  parTime: 25,
  solids: [
    box(-200, -1400, 40, 1800),
    box(-160, 0, 2820, 400),
    box(700, -800, 300, 40),
    box(2000, -700, 700, 700),
    box(-160, -1440, 2820, 40),
    box(2660, -1400, 40, 1800),
  ],
  zones: [
    { id: 'vent', shape: { type: 'rect', x: 300, y: -60, w: 100, h: 60 }, material: 'wind', look: 'wind' },
    { id: 'vent2', shape: { type: 'rect', x: 740, y: -860, w: 70, h: 60 }, material: 'wind', look: 'wind' },
    {
      id: 'updraft',
      shape: { type: 'rect', x: 500, y: -800, w: 200, h: 800 },
      force: { kind: 'thermal', dir: { x: 0, y: -1 }, strength: 850, turbulence: 0.15 },
      look: 'thermal',
    },
    {
      id: 'gust',
      shape: { type: 'rect', x: 1000, y: -1100, w: 1000, h: 500 },
      force: { kind: 'wind', dir: { x: 1, y: 0 }, strength: 420, gust: 0.6, period: 2.2 },
      look: 'wind',
    },
    {
      id: 'lift',
      shape: { type: 'rect', x: 1400, y: -1300, w: 120, h: 600 },
      force: { kind: 'thermal', dir: { x: 0, y: -1 }, strength: 900 },
      look: 'thermal',
    },
  ],
  checkpoints: [{ x: 850, y: -816 }],
  goal: { x: 2500, y: -730 },
  fragments: [{ x: 1460, y: -1250 }],
  signs: [
    { x: 150, y: -100, text: 'Wind: light and floaty' },
    { x: 850, y: -900, text: 'Jump, then hold to glide' },
  ],
};

export const CAMPAIGN: LevelDef[] = [firstRoll, momentumValley, firstWater, slipper, core, voidLevel, mudLevel, sky];
