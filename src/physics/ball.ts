import { type Vec2, approach, clamp, closestPointOnSegment, dot, perp, sign } from '../core/math';
import { fieldAcceleration } from './forces';
import { type InteractionEffect, resolveTransition } from './interactions';
import { MATERIALS, type MaterialDefinition, type MaterialId } from './materials';
import { SURFACES, type SurfaceId } from './surfaces';
import { type PhysicsWorld, type WorldState, type Zone, circleOverlapsShape, isSegmentActive } from './world';

// Game-feel constants shared by all materials.
export const BALL_RADIUS = 16;
export const COYOTE_TIME = 0.1;
export const JUMP_BUFFER = 0.13;
/** Base rolling resistance (px/s^2), scaled by material and surface friction. */
export const ROLL_RESISTANCE = 420;
/** Impacts slower than this don't bounce, so the ball settles instead of jittering. */
export const SETTLE_SPEED = 95;
const FLOOR_DOT = 0.55;
const GLIDE_BRAKE = 4000;
const PROBE_MARGIN = 2.5;

export interface BallInput {
  /** -1..1, right positive. */
  x: number;
  /** -1..1, screen-down positive. */
  y: number;
  jump: boolean;
  jumpPressed: boolean;
}

export const NO_INPUT: BallInput = { x: 0, y: 0, jump: false, jumpPressed: false };

export interface BallState {
  pos: Vec2;
  vel: Vec2;
  radius: number;
  angle: number;
  angVel: number;

  material: MaterialId;
  prevMaterial: MaterialId;
  /** Seconds spent away from a source of the current material. */
  materialTime: number;
  /** Lab/debug: disables material timers and zone reverts. */
  materialLocked: boolean;

  grounded: boolean;
  groundNormal: Vec2;
  groundSurface: SurfaceId | null;
  touching: boolean;
  contactNormal: Vec2;
  /** +1 wall on the right, -1 on the left, 0 none. */
  wallSide: number;

  coyote: number;
  jumpBuffer: number;
  jumping: boolean;
  airImpulsesLeft: number;
  impulseCooldown: number;

  inFluid: number;
  zonesInside: Set<string>;
  dead: boolean;

  /** Visual squash 0..1 and its axis. */
  squash: number;
  squashNormal: Vec2;
  /** Last computed acceleration (for debug display). */
  lastAccel: Vec2;
}

export function createBall(pos: Vec2, material: MaterialId = 'normal'): BallState {
  return {
    pos: { ...pos },
    vel: { x: 0, y: 0 },
    radius: BALL_RADIUS,
    angle: 0,
    angVel: 0,
    material,
    prevMaterial: 'normal',
    materialTime: 0,
    materialLocked: false,
    grounded: false,
    groundNormal: { x: 0, y: -1 },
    groundSurface: null,
    touching: false,
    contactNormal: { x: 0, y: -1 },
    wallSide: 0,
    coyote: 0,
    jumpBuffer: 0,
    jumping: false,
    airImpulsesLeft: MATERIALS[material].airImpulse?.count ?? 0,
    impulseCooldown: 0,
    inFluid: 0,
    zonesInside: new Set(),
    dead: false,
    squash: 0,
    squashNormal: { x: 0, y: -1 },
    lastAccel: { x: 0, y: 0 },
  };
}

export type BallEvent =
  | { type: 'jump'; pos: Vec2; material: MaterialId }
  | { type: 'airImpulse'; pos: Vec2; dir: Vec2; material: MaterialId }
  | { type: 'impact'; pos: Vec2; normal: Vec2; speed: number; surface: SurfaceId; material: MaterialId }
  | { type: 'land'; pos: Vec2; speed: number; material: MaterialId }
  | { type: 'transform'; pos: Vec2; from: MaterialId; to: MaterialId; effect?: InteractionEffect }
  | { type: 'revert'; pos: Vec2; from: MaterialId; to: MaterialId }
  | { type: 'break'; pos: Vec2; group: string | number; surface: SurfaceId }
  | { type: 'death'; pos: Vec2; cause: string };

/** Direction opposite to the ball's effective gravity, or null in zero-g. */
export function upDirection(m: MaterialDefinition): Vec2 | null {
  if (m.gravityScale > 0) return { x: 0, y: -1 };
  if (m.gravityScale < 0) return { x: 0, y: 1 };
  return null;
}

export function setMaterial(ball: BallState, to: MaterialId): void {
  if (ball.material === to) return;
  ball.prevMaterial = ball.material;
  ball.material = to;
  ball.materialTime = 0;
  ball.jumping = false;
  const imp = MATERIALS[to].airImpulse;
  ball.airImpulsesLeft = imp ? imp.count : 0;
}

const querySet = new Set<number>();

/**
 * Advance one fixed physics step. Pure with respect to rendering: everything the
 * presentation layer needs is reported through `events`.
 */
export function stepBall(
  ball: BallState,
  input: BallInput,
  world: PhysicsWorld,
  state: WorldState,
  dt: number,
  events?: BallEvent[],
): void {
  if (ball.dead) return;
  const emit = (e: BallEvent) => events?.push(e);
  let m = MATERIALS[ball.material];
  const g = world.gravity;
  const up = upDirection(m);
  const v = ball.vel;

  // --- Timers (input forgiveness) ---
  ball.jumpBuffer = input.jumpPressed ? JUMP_BUFFER : Math.max(0, ball.jumpBuffer - dt);
  ball.coyote = ball.grounded ? COYOTE_TIME : Math.max(0, ball.coyote - dt);
  ball.impulseCooldown = Math.max(0, ball.impulseCooldown - dt);

  // --- Environment: forces and fluids ---
  let ax = 0;
  let ay = g * m.gravityScale;
  let fluidDrag = 0;
  let submerged = 0;
  for (const z of world.zones) {
    if (!circleOverlapsShape(ball.pos, ball.radius, z.shape)) continue;
    if (z.force) {
      const f = fieldAcceleration(z.force, ball.pos, state.time);
      const r = m.forceResponse[z.force.kind];
      ax += f.x * r;
      ay += f.y * r;
    }
    if (z.fluid) {
      const frac = submersion(ball, z);
      if (frac > 0) {
        submerged = Math.max(submerged, frac);
        if (m.gravityScale > 0) {
          const ratio = Math.min(z.fluid.density / m.density, 2.5);
          ay -= g * m.gravityScale * ratio * frac;
        }
        fluidDrag = Math.max(fluidDrag, z.fluid.drag * frac);
      }
    }
  }
  ball.inFluid = submerged;

  // Adhesion: a fast, sticky ball is pulled onto whatever it is touching.
  const speed = Math.hypot(v.x, v.y);
  const adhering = m.adhesion > 0 && ball.touching && speed >= m.adhesionMinSpeed;
  if (adhering) {
    ax -= ball.contactNormal.x * m.adhesion;
    ay -= ball.contactNormal.y * m.adhesion;
  }
  ball.lastAccel = { x: ax, y: ay };
  v.x += ax * dt;
  v.y += ay * dt;

  // --- Player control ---
  const surf = ball.groundSurface ? SURFACES[ball.groundSurface] : SURFACES.stone;
  if (ball.grounded && up) {
    const t = perp(ball.groundNormal);
    if (t.x < 0) {
      t.x = -t.x;
      t.y = -t.y;
    }
    const vt = dot(v, t);
    let nvt = vt;
    const traction = m.traction * surf.traction;
    // Resistance fades on slopes so a ball rolls downhill, unless the grip is very high (Mud).
    const resist = ROLL_RESISTANCE * m.friction * surf.friction * (1 - clamp(Math.abs(t.y) * 1.6, 0, 0.85));
    // Steep contacts (walls, loop sides) run on momentum only.
    if (input.x !== 0 && t.x > 0.3) {
      if (vt !== 0 && sign(input.x) !== sign(vt)) {
        nvt = vt + input.x * m.brake * traction * dt;
      } else if (Math.abs(vt) < m.maxSpeed) {
        nvt = approach(vt, sign(input.x) * m.maxSpeed, Math.abs(input.x) * m.groundAccel * traction * dt);
      } else {
        // Over top speed: holding the direction doesn't sustain it; friction decides how long it lasts.
        nvt = approach(vt, sign(vt) * m.maxSpeed, resist * dt);
      }
    } else if (input.x === 0) {
      nvt = approach(vt, 0, resist * dt);
    }
    v.x += t.x * (nvt - vt);
    v.y += t.y * (nvt - vt);
  } else if (!up) {
    // Zero gravity: gentle thrust on both axes.
    if (input.x !== 0 && v.x * sign(input.x) < m.maxSpeed) v.x += input.x * m.airAccel * dt;
    if (input.y !== 0 && v.y * sign(input.y) < m.maxSpeed) v.y += input.y * m.verticalAccel * dt;
  } else if (input.x !== 0) {
    if (v.x !== 0 && sign(input.x) !== sign(v.x)) {
      v.x += input.x * m.airAccel * 1.35 * dt;
    } else if (Math.abs(v.x) < m.maxSpeed) {
      v.x = approach(v.x, sign(input.x) * m.maxSpeed, Math.abs(input.x) * m.airAccel * dt);
    }
  }
  if (up && m.verticalAccel > 0 && input.y !== 0) v.y += input.y * m.verticalAccel * dt;

  // Wall climbing (Mud): push into a wall to climb it.
  const climbing = m.wallClimb > 0 && ball.wallSide !== 0 && input.x * ball.wallSide > 0.2 && up !== null;
  if (climbing) {
    v.y = approach(v.y, up!.y * m.wallClimb, 4000 * dt);
    v.x = ball.wallSide * 40;
  }

  // --- Jump family ---
  const wantsJump = ball.jumpBuffer > 0;
  if (wantsJump && (ball.grounded || ball.coyote > 0)) {
    const n = ball.groundNormal;
    let dir = n;
    if (up && !adhering) dir = normalizeSafe(up.x * 0.6 + n.x * 0.4, up.y * 0.6 + n.y * 0.4, up);
    const along = dot(v, dir);
    if (along < m.jumpSpeed) {
      v.x += dir.x * (m.jumpSpeed - along);
      v.y += dir.y * (m.jumpSpeed - along);
    }
    ball.grounded = false;
    ball.coyote = 0;
    ball.jumpBuffer = 0;
    ball.jumping = true;
    emit({ type: 'jump', pos: { ...ball.pos }, material: m.id });
  } else if (wantsJump && m.wallClimb > 0 && ball.wallSide !== 0 && up) {
    v.x = -ball.wallSide * 380;
    v.y = up.y * m.jumpSpeed * 0.9;
    ball.jumpBuffer = 0;
    ball.jumping = true;
    emit({ type: 'jump', pos: { ...ball.pos }, material: m.id });
  } else if (wantsJump && m.airImpulse && ball.impulseCooldown <= 0) {
    const imp = m.airImpulse;
    const hasCharge = imp.count < 0 || ball.airImpulsesLeft > 0;
    const fluidOk = !imp.requiresFluid || submerged > 0.3;
    if (hasCharge && fluidOk) {
      const fallback = up ?? { x: 0, y: -1 };
      const dir =
        imp.mode === 'aim' && (input.x !== 0 || input.y !== 0)
          ? normalizeSafe(input.x, input.y, fallback)
          : fallback;
      v.x = v.x * imp.carry + dir.x * imp.speed;
      v.y = v.y * imp.carry + dir.y * imp.speed;
      if (imp.count > 0) ball.airImpulsesLeft--;
      ball.impulseCooldown = imp.cooldown;
      ball.jumpBuffer = 0;
      emit({ type: 'airImpulse', pos: { ...ball.pos }, dir, material: m.id });
    }
  }

  if (up) {
    const vu = dot(v, up);
    // Variable jump height.
    if (ball.jumping && (!input.jump || vu <= 0)) {
      if (!input.jump && vu > 0) {
        v.x -= up.x * vu * (1 - m.jumpCut);
        v.y -= up.y * vu * (1 - m.jumpCut);
      }
      ball.jumping = false;
    }
    // Glide.
    const fall = -dot(v, up);
    if (m.glideFallSpeed > 0 && input.jump && !ball.grounded && fall > m.glideFallSpeed) {
      const k = fall - approach(fall, m.glideFallSpeed, GLIDE_BRAKE * dt);
      v.x += up.x * k;
      v.y += up.y * k;
    }
  }

  // --- Drag and limits ---
  const drag = Math.exp(-(m.linearDrag + fluidDrag) * dt);
  v.x *= drag;
  v.y *= drag;
  if (up) {
    const fall = -dot(v, up);
    if (fall > m.maxFallSpeed) {
      v.x += up.x * (fall - m.maxFallSpeed);
      v.y += up.y * (fall - m.maxFallSpeed);
    }
  }

  // --- Integrate with sub-stepping so fast balls never tunnel ---
  const wasGrounded = ball.grounded;
  const sp = Math.hypot(v.x, v.y);
  const steps = clamp(Math.ceil((sp * dt) / (ball.radius * 0.4)), 1, 12);
  const h = dt / steps;
  for (let i = 0; i < steps && !ball.dead; i++) {
    ball.pos.x += v.x * h;
    ball.pos.y += v.y * h;
    collide(ball, m, world, state, emit);
  }
  if (ball.dead) return;
  probeContacts(ball, m, world, state);
  if (!wasGrounded && ball.grounded) emit({ type: 'land', pos: { ...ball.pos }, speed: sp, material: m.id });
  if (ball.grounded || (ball.touching && !up)) {
    const imp = m.airImpulse;
    if (imp && imp.count > 0) ball.airImpulsesLeft = imp.count;
  }

  // --- Rotation ---
  if (ball.grounded || ball.touching) {
    const t = perp(ball.contactNormal);
    ball.angVel = dot(v, t) / ball.radius;
  } else {
    ball.angVel *= Math.exp(-m.angularDamping * dt);
  }
  ball.angle += ball.angVel * dt;
  ball.squash = Math.max(0, ball.squash - dt * 6);

  // --- Zones: transformations, hazards, material lifetime ---
  const inside = new Set<string>();
  let sourceOfCurrent = false;
  for (const z of world.zones) {
    if (!circleOverlapsShape(ball.pos, ball.radius * 0.8, z.shape)) continue;
    inside.add(z.id);
    if (z.hazard) {
      kill(ball, emit, 'hazard');
      return;
    }
    if (!z.material) continue;
    if (!ball.zonesInside.has(z.id) && !ball.materialLocked) {
      const from = ball.material;
      const tr = resolveTransition(from, z.material);
      if (tr.result !== from || tr.effect) {
        setMaterial(ball, tr.result);
        applyEffect(ball, tr.effect);
        emit({ type: 'transform', pos: { ...ball.pos }, from, to: tr.result, effect: tr.effect });
      }
    }
    if (z.material === ball.material) sourceOfCurrent = true;
  }
  ball.zonesInside = inside;

  m = MATERIALS[ball.material];
  if (!ball.materialLocked && ball.material !== 'normal') {
    if (sourceOfCurrent) ball.materialTime = 0;
    else ball.materialTime += dt;
    const expired = m.zoneBound ? !sourceOfCurrent : m.duration !== null && ball.materialTime >= m.duration;
    if (expired) {
      const from = ball.material;
      const to = m.zoneBound && ball.prevMaterial !== from ? ball.prevMaterial : 'normal';
      setMaterial(ball, to);
      emit({ type: 'revert', pos: { ...ball.pos }, from, to });
    }
  }
}

function collide(
  ball: BallState,
  m: MaterialDefinition,
  world: PhysicsWorld,
  state: WorldState,
  emit: (e: BallEvent) => void,
): void {
  const r = ball.radius;
  const v = ball.vel;
  world.query(ball.pos, r + 2, querySet);
  for (const id of querySet) {
    const seg = world.segments[id];
    if (!isSegmentActive(seg, state)) continue;
    const cp = closestPointOnSegment(ball.pos, seg.a, seg.b);
    const dx = ball.pos.x - cp.x;
    const dy = ball.pos.y - cp.y;
    const d = Math.hypot(dx, dy);
    if (d >= r) continue;
    const surf = SURFACES[seg.surface];
    let nx: number;
    let ny: number;
    if (d > 1e-6) {
      nx = dx / d;
      ny = dy / d;
    } else {
      const sx = seg.b.x - seg.a.x;
      const sy = seg.b.y - seg.a.y;
      const sl = Math.hypot(sx, sy) || 1;
      nx = sy / sl;
      ny = -sx / sl;
    }
    if (surf.hazard) {
      kill(ball, emit, seg.surface);
      return;
    }
    const vn = v.x * nx + v.y * ny;
    const group = seg.group ?? seg.id;
    if (surf.meltTemperature !== null && m.temperature >= surf.meltTemperature) {
      state.broken.add(group);
      emit({ type: 'break', pos: { x: cp.x, y: cp.y }, group, surface: seg.surface });
      continue;
    }
    if (surf.breakImpulse !== null && vn < 0 && m.mass * -vn >= surf.breakImpulse) {
      state.broken.add(group);
      v.x *= 0.8;
      v.y *= 0.8;
      emit({ type: 'break', pos: { x: cp.x, y: cp.y }, group, surface: seg.surface });
      continue;
    }
    ball.pos.x += nx * (r - d);
    ball.pos.y += ny * (r - d);
    if (vn < 0) {
      const impact = -vn;
      let e = clamp(m.restitution * surf.restitution, 0, 1.4);
      if (impact < SETTLE_SPEED) e = 0;
      let out = impact * e;
      if (surf.minBounceSpeed > 0) out = Math.max(out, surf.minBounceSpeed);
      const grip = 1 - (1 - m.impactGrip) * clamp(impact / 800, 0, 1);
      const tx = (v.x - nx * vn) * grip;
      const ty = (v.y - ny * vn) * grip;
      v.x = tx + nx * out;
      v.y = ty + ny * out;
      // Landing counts as ground contact for jumping, even if the ball rebounds this step.
      const up = upDirection(m);
      if (!up || nx * up.x + ny * up.y > FLOOR_DOT) {
        ball.coyote = COYOTE_TIME;
        ball.groundNormal = { x: nx, y: ny };
        ball.groundSurface = seg.surface;
      }
      if (impact > 140) {
        ball.squash = Math.max(ball.squash, clamp(impact / 1300, 0, 0.45));
        ball.squashNormal = { x: nx, y: ny };
        emit({
          type: 'impact',
          pos: { x: cp.x, y: cp.y },
          normal: { x: nx, y: ny },
          speed: impact,
          surface: seg.surface,
          material: m.id,
        });
      }
    }
  }
}

/** Contact state with a small margin, so resting on the ground reads as grounded every step. */
function probeContacts(ball: BallState, m: MaterialDefinition, world: PhysicsWorld, state: WorldState): void {
  const r = ball.radius + PROBE_MARGIN;
  const up = upDirection(m);
  let bestFloor = -Infinity;
  let floorN: Vec2 | null = null;
  let floorSurface: SurfaceId | null = null;
  let touchN: Vec2 | null = null;
  let touchSurface: SurfaceId | null = null;
  let touchD = Infinity;
  let wall = 0;
  world.query(ball.pos, r, querySet);
  for (const id of querySet) {
    const seg = world.segments[id];
    if (!isSegmentActive(seg, state)) continue;
    const cp = closestPointOnSegment(ball.pos, seg.a, seg.b);
    const dx = ball.pos.x - cp.x;
    const dy = ball.pos.y - cp.y;
    const d = Math.hypot(dx, dy);
    if (d >= r || d < 1e-6) continue;
    const n = { x: dx / d, y: dy / d };
    if (d < touchD) {
      touchD = d;
      touchN = n;
      touchSurface = seg.surface;
    }
    if (Math.abs(n.x) > 0.75) wall = n.x < 0 ? 1 : -1;
    const f = up ? dot(n, up) : 1;
    if (f > bestFloor) {
      bestFloor = f;
      floorN = n;
      floorSurface = seg.surface;
    }
  }
  const speed = Math.hypot(ball.vel.x, ball.vel.y);
  const adhering = m.adhesion > 0 && touchN !== null && speed >= m.adhesionMinSpeed;
  // Moving away from the surface fast (just jumped/bounced) is not grounded.
  const separating = floorN ? dot(ball.vel, floorN) > 60 : false;
  ball.touching = touchN !== null;
  if (touchN) ball.contactNormal = touchN;
  ball.wallSide = wall;
  if (!up) {
    ball.grounded = ball.touching && !separating;
    if (touchN) ball.groundNormal = touchN;
    ball.groundSurface = touchSurface;
  } else if (adhering && touchN) {
    ball.grounded = !separating;
    ball.groundNormal = touchN;
    ball.groundSurface = touchSurface;
  } else if (floorN && bestFloor > FLOOR_DOT && !separating) {
    ball.grounded = true;
    ball.groundNormal = floorN;
    ball.groundSurface = floorSurface;
  } else {
    ball.grounded = false;
    ball.groundSurface = null;
  }
}

function submersion(ball: BallState, z: Zone): number {
  const s = z.shape;
  if (s.type === 'circle') return Math.hypot(ball.pos.x - s.x, ball.pos.y - s.y) < s.r ? 1 : 0;
  if (ball.pos.x < s.x || ball.pos.x > s.x + s.w) return 0;
  const r = ball.radius;
  const top = clamp((ball.pos.y - (s.y - r)) / (2 * r), 0, 1);
  const bottom = clamp((s.y + s.h + r - ball.pos.y) / (2 * r), 0, 1);
  return Math.min(top, bottom);
}

function applyEffect(ball: BallState, effect: InteractionEffect | undefined): void {
  const v = ball.vel;
  if (effect === 'steam') {
    // Steam always rises, whatever the ball's gravity.
    v.y = Math.min(v.y, -1050);
    v.x *= 0.6;
  } else if (effect === 'ignite') {
    const s = Math.hypot(v.x, v.y);
    const target = Math.max(s * 1.5, 750);
    if (s > 1) {
      v.x = (v.x / s) * target;
      v.y = (v.y / s) * target;
    }
  }
}

function kill(ball: BallState, emit: (e: BallEvent) => void, cause: string): void {
  ball.dead = true;
  emit({ type: 'death', pos: { ...ball.pos }, cause });
}

function normalizeSafe(x: number, y: number, fallback: Vec2): Vec2 {
  const l = Math.hypot(x, y);
  return l > 1e-9 ? { x: x / l, y: y / l } : { ...fallback };
}
