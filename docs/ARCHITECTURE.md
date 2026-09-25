# Architecture

## Technology

- **TypeScript + Vite**, rendered with **Canvas 2D**, DOM overlay for menus and HUD. Runs in any mobile browser. It can be wrapped in Capacitor later for store builds.
- **Custom physics.** Off-the-shelf rigid-body engines optimise for realism. This game needs tunable, predictable feel (coyote time, jump buffering, per-material control), so the ball controller is our own code. Level geometry is static line segments, so the collision problem is a single circle against segments. That stays small and fully testable.
- **Fixed timestep** of 1/120 s with an accumulator. Rendering interpolates between steps. The simulation is deterministic: the same inputs give the same run, which the lab, tests and (later) ghosts rely on.

## Layout

```
src/
  core/math.ts            vectors, clamps, PRNG, noise
  physics/                pure simulation: no DOM, no rendering
    materials.ts          MaterialDefinition data for all 8 materials
    surfaces.ts           SurfaceDefinition data (stone, ice, mud, metal, bouncer, spikes, crate, frost)
    forces.ts             environmental force fields (wind, current, thermal, gravity well)
    interactions.ts       material × source rules (steam, melt, freeze, ignite, float, sink)
    world.ts              static geometry + zones + grid broadphase; per-run WorldState
    ball.ts               BallState and stepBall(): the whole controller
  levels/
    types.ts              LevelDef data format
    build.ts              LevelDef -> PhysicsWorld, authoring helpers (box, ground, arc)
    campaign.ts           the campaign levels
    lab.ts                the Material Lab course
    scenarios.ts          scripted comparison scenarios (used by the lab UI and the tests)
  game/
    session.ts            one attempt at a level: objectives, checkpoints, respawn
    game.ts               loop, mode flow, save integration, trajectory preview, debug text
    compare.ts            8-material side-by-side run for the lab
    camera.ts             look-ahead follow, speed zoom, trauma shake
    input.ts              keyboard + floating touch stick + jump half; latched presses
    feedback.ts           events -> particles, audio, shake, haptics
    render.ts             canvas renderer + material glyphs
    particles.ts          fixed-size pooled particles
    audio.ts              procedural WebAudio voices per material
    save.ts               versioned save with migrations, sanitising and a backup copy
  ui/                     DOM menus, HUD, toasts, settings, lab bar
tests/                    vitest suites
scripts/lab-report.ts     prints the material comparison table
```

## The three environment concepts

The design brief asks for three separate concepts that combine. They are separate in the code too:

1. **Ball material** (`MaterialDefinition`): what the ball is. All behaviour comes from numbers: gravity scale, density, traction, friction, restitution, adhesion, wall-climb, air-impulse (swim strokes / bursts), glide, force response, lifetime. `stepBall` never branches on a material id.
2. **Surface** (`SurfaceDefinition`): what the ball touches. Friction, traction and restitution multiply with the material's values. Surfaces can be hazards, bounce pads, or break when hit hard enough (`breakImpulse`) or hot enough (`meltTemperature`).
3. **Environmental force** (`Zone.force`, `Zone.fluid`): what pushes the ball. Each material scales each force kind (`forceResponse`), and fluid buoyancy depends on the material's density.

So *Ice ball + ice surface + wind* differs from *Normal ball + ice surface + wind* with no special case anywhere. The tests in `tests/materials.test.ts` check these combinations directly.

Behaviour that emerges from these rules without being scripted:

- Mud holds on slopes where Normal rolls, because slope resistance only beats gravity when grip is high.
- Mud walks the bottom of a river against a current.
- Ice floats in water.
- Lava's ground is the ceiling, because "ground" is defined relative to the ball's own gravity.
- A heavy material breaks crates only when it lands hard.

## Adding content

**A material:** add an id to `MaterialId`, a `MaterialDefinition` entry in `MATERIALS`, the id in `MATERIAL_ORDER`, and a pattern glyph. Optionally add interaction rules, audio voices in `audio.ts` and particles in `feedback.ts`. The identity tests will fail if the new material's coast, jump and bounce fingerprint duplicates an existing one.

**A surface:** add to `SurfaceId` and `SURFACES`, and optionally an edge decoration in `render.ts`.

**A force kind:** add to `ForceKind`, handle it in `fieldAcceleration`, and give materials a response. The response defaults to 1.

**A level:** write a `LevelDef` (see `campaign.ts`) and add it to `CAMPAIGN`. Add a scripted completability test in `tests/levels.test.ts`. The sanity tests automatically check that spawn, checkpoints, goal and fragments are in open space and that the ball spawns safely.

## Game-feel techniques in the controller

- Coyote time (0.1 s), and landing impacts count as ground contact so a jump during a rebound is never lost.
- A jump buffer (0.13 s), and touch and key presses are latched until the next physics step.
- Variable jump height (release early to cut upward speed).
- Settling threshold: small impacts don't bounce, so the ball comes to rest without jitter.
- Overspeed bleeds by friction, not input. Holding a direction can't sustain speed above the cap, so a slick material genuinely keeps momentum and Normal genuinely doesn't.
- Sub-stepped integration: fast balls never tunnel.
- Camera: velocity look-ahead, faster vertical follow when falling, slight zoom-out at speed, and trauma shake that can be reduced or disabled.

## Roadmap status

| Phase | Status |
| --- | --- |
| 1 Movement prototype | Done: controller, camera, input, feedback |
| 2 Material prototype | Done: 8 materials, lab and compare mode, identity tests |
| 3 Vertical slice | Partial: 8 short teaching levels, checkpoints, fragments, save, full UI. Still missing: abilities and upgrades |
| 4+ Progression, campaign, advanced interactions, replayability | Not started. The data-driven structure and deterministic simulation are in place for mastery, loadouts, ghosts (record inputs) and procedural checks (scripted reachability) |

## Next steps

1. Playtest on real phones and tune the per-material numbers. `npm run lab` and the Compare mode make before/after comparisons quick.
2. Build out World 1 to 4–6 levels following introduce → experiment → teach → combine → complicate → master.
3. Add the first ability (Air Dash or Momentum Burst) as data on the ball, with its own tests.
4. Add ghost replays by recording `BallInput` per step. Determinism makes replays exact.
