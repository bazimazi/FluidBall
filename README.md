# Fluid Ball

A physics platformer where the ball's material changes how it moves. Roll into water and you swim. Touch lava and you fall upward. Enter a void and gravity is gone.

This repository holds the **movement and material prototype** (roadmap phases 1–2), plus a first slice of levels that each teach one material.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173 (also reachable from a phone on the same network)
npm test         # physics, material identity, level completability, save system
npm run lab      # prints the material comparison table
npm run build    # type-check + production build into dist/
```

In development, `?level=<id>` jumps straight into a level (`?level=lab`, `?level=4-1`), and `window.fluid` exposes the running game in the console.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Roll / steer | ← → or A D | Drag anywhere on the left half |
| Jump (hold for height) | Space, W, ↑ | Tap or hold the right half |
| Aim swim strokes and zero-g bursts | Direction + jump | Stick direction + jump |
| Sink (Lava) | ↓ or S | Stick down |
| Glide (Wind) | Hold jump | Hold the right half |
| Restart / pause | R / Esc | Pause button |
| Physics overlay | ` or F3 | Settings |
| Lab: pick a material | 1–8 | Material bar |

Settings include left-handed mode, stick sensitivity, camera shake, reduced effects, haptics, a trajectory assist and the physics overlay.

## The materials

| Material | How it moves | What it's for |
| --- | --- | --- |
| Normal | Balanced grip, moderate bounce | The reference everything else is measured against |
| Water | Heavy, damped. Aimed swim strokes inside fluid; rides currents | Underwater routes, currents, dives |
| Oil | Almost no friction, keeps momentum, clings to surfaces at speed | Long runs, quarter-pipes, ceiling rides |
| Ice | Rigid glide, ricochets, can barely brake | Long leaps from built-up speed |
| Lava | Falls upward, rolls on ceilings, melts frost, cools after 7 s | Vertical routes, ceiling paths, melting |
| Zero-G | No gravity; two aimed bursts per contact; pulled by wells | Momentum and orbit puzzles |
| Mud | Heavy grip, climbs walls, ignores wind and currents, smashes crates | Anchoring, climbing, breaking |
| Wind | Light, floaty, glides; pushed hard by drafts | Updrafts, gusts, long glides |

Materials also interact: lava hitting water flashes to steam and throws you upward, ice melts into water in lava, water freezes in ice chambers, oil ignites into a lava burst, ice floats and mud sinks.

The **Material Lab** (main menu) has one course with every surface and force, and a **Compare** mode that runs all eight materials through the same scripted scenario side by side.

## Levels

| Level | Teaches |
| --- | --- |
| 1-1 First Roll | Rolling, jumping, bounce pads, checkpoints |
| 1-2 Momentum Valley | Slopes as engines; a safe route and a skill route |
| 2-1 Into the Deep | Water: swimming, currents, the tunnel under the wall |
| 3-1 Slick Descent | Oil up a quarter-pipe, then an Ice leap |
| 4-1 Rising Heat | Lava: ceilings, melting frost, sinking onto a ledge |
| 5-1 Weightless | Zero-G bursts and a gravity well |
| 6-1 Heavy Going | Mud: wall climbing, crate smashing, walking a riverbed |
| 7-1 Updraft | Wind: riding a draft, jump-then-glide across a gap |

Each level has an optional discovery fragment. The automated tests drive a scripted ball through every level to prove it can be finished.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how the code is organised and how to add materials, surfaces, forces and levels.
