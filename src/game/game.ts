import { type Vec2, lerp } from '../core/math';
import { CAMPAIGN } from '../levels/campaign';
import { LAB } from '../levels/lab';
import { SCENARIOS } from '../levels/scenarios';
import type { LevelDef } from '../levels/types';
import { type BallInput, type BallState, createBall, stepBall } from '../physics/ball';
import { MATERIALS, type MaterialId } from '../physics/materials';
import { Audio } from './audio';
import { Camera } from './camera';
import { CompareRun } from './compare';
import { Feedback } from './feedback';
import { Input } from './input';
import { Particles } from './particles';
import { Renderer, type SceneView } from './render';
import { type SaveData, type Settings, loadSave, writeSave } from './save';
import { type GameEvent, Session } from './session';

export const STEP = 1 / 120;
const MAX_FRAME = 0.1;

export type Mode = 'menu' | 'play' | 'paused' | 'complete' | 'compare';

/** UI hooks implemented by the DOM layer. */
export interface UiHooks {
  onMode(mode: Mode): void;
  onHud(info: HudInfo): void;
  onToast(title: string, body: string, icon?: MaterialId): void;
  onComplete(info: CompleteInfo): void;
  onDebug(text: string | null): void;
}

export interface HudInfo {
  material: MaterialId;
  time: number;
  fragments: number;
  fragmentsTotal: number;
  lab: boolean;
  levelName: string;
}

export interface CompleteInfo {
  level: LevelDef;
  time: number;
  best: number | null;
  newBest: boolean;
  deaths: number;
  fragments: number;
  fragmentsTotal: number;
  par: number;
  next: LevelDef | null;
}

export class Game {
  readonly save: SaveData;
  readonly input: Input;
  readonly audio = new Audio();
  readonly camera: Camera;
  readonly particles = new Particles();
  readonly renderer: Renderer;
  readonly feedback: Feedback;
  session: Session | null = null;
  compare: CompareRun | null = null;
  mode: Mode = 'menu';
  private acc = 0;
  private last = 0;
  private prevPos: Vec2 = { x: 0, y: 0 };
  private hudTimer = 0;
  private trajectory: Vec2[] | undefined;
  private trajTimer = 0;
  private fps = 60;
  /** Screen overlays that make deaths and respawns unmistakable (0..1, fading). */
  private deathFlash = 0;
  private respawnFade = 0;

  constructor(
    canvas: HTMLCanvasElement,
    private ui: UiHooks,
  ) {
    this.save = loadSave();
    this.input = new Input(canvas, {
      leftHanded: this.save.settings.leftHanded,
      stickRadius: this.save.settings.stickRadius,
      deadzone: 0.18,
    });
    this.camera = new Camera({ shake: this.save.settings.shake });
    this.renderer = new Renderer(canvas);
    this.feedback = new Feedback(this.particles, this.audio, this.camera);
    this.applySettings();
    window.addEventListener('resize', () => this.renderer.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.mode === 'play') this.pause();
        this.audio.suspend();
      } else {
        this.audio.resume();
      }
    });
    this.renderer.resize();
    this.startMenuBackdrop();
    requestAnimationFrame((t) => this.frame(t));
  }

  get settings(): Settings {
    return this.save.settings;
  }

  applySettings(): void {
    const s = this.save.settings;
    this.input.settings.leftHanded = s.leftHanded;
    this.input.settings.stickRadius = s.stickRadius;
    this.camera.settings.shake = s.shake;
    this.particles.density = s.reducedEffects ? 0.35 : 1;
    this.feedback.haptics = s.haptics;
    this.audio.setVolume(s.volume);
    if (!s.debugOverlay) this.ui.onDebug(null);
  }

  persist(): void {
    writeSave(this.save);
  }

  // ------------------------------------------------------------ flow

  isUnlocked(level: LevelDef): boolean {
    const i = CAMPAIGN.indexOf(level);
    if (i <= 0) return true;
    return !!this.save.levels[CAMPAIGN[i - 1].id]?.completed;
  }

  /** A slow ball rolling around the lab behind the menu. */
  private startMenuBackdrop(): void {
    this.session = new Session(LAB, true);
    this.session.ball.pos = { x: 300, y: -300 };
    this.snapCamera();
    this.setMode('menu');
  }

  startLevel(level: LevelDef): void {
    this.audio.unlock();
    this.compare = null;
    this.session = new Session(level, level === LAB);
    this.particles.clear();
    this.snapCamera();
    this.setMode('play');
    this.pushHud();
  }

  startLab(): void {
    this.startLevel(LAB);
  }

  startCompare(scenarioId: string): void {
    const sc = SCENARIOS.find((s) => s.id === scenarioId);
    if (!sc) return;
    this.audio.unlock();
    this.audio.silenceBed();
    this.compare = new CompareRun(sc);
    this.particles.clear();
    this.camera.snap(this.compare.focus());
    this.setMode('compare');
  }

  endCompare(): void {
    this.compare = null;
    this.snapCamera();
    this.setMode('play');
  }

  restart(): void {
    if (!this.session) return;
    this.session.restart();
    this.particles.clear();
    this.snapCamera();
    this.setMode('play');
  }

  pause(): void {
    if (this.mode !== 'play') return;
    this.audio.silenceBed();
    this.setMode('paused');
  }

  resume(): void {
    if (this.mode !== 'paused') return;
    this.input.clear();
    this.last = performance.now();
    this.setMode('play');
  }

  toMenu(): void {
    this.audio.silenceBed();
    this.compare = null;
    this.startMenuBackdrop();
  }

  setLabMaterial(m: MaterialId): void {
    if (!this.session?.lab) return;
    this.session.setLabMaterial(m);
    this.audio.transform(m);
    this.feedback.handle([{ type: 'transform', pos: { ...this.session.ball.pos }, from: m, to: m }]);
    this.pushHud();
  }

  nextLevel(): LevelDef | null {
    if (!this.session) return null;
    const i = CAMPAIGN.indexOf(this.session.level);
    return i >= 0 && i + 1 < CAMPAIGN.length ? CAMPAIGN[i + 1] : null;
  }

  private setMode(m: Mode): void {
    this.mode = m;
    this.ui.onMode(m);
  }

  private snapCamera(): void {
    if (!this.session) return;
    this.prevPos = { ...this.session.ball.pos };
    this.camera.snap(this.session.ball.pos);
    this.camera.zoom = this.camera.fitZoom(this.renderer.height);
  }

  // ------------------------------------------------------------ loop

  private frame(now: number): void {
    requestAnimationFrame((t) => this.frame(t));
    const dt = Math.min((now - (this.last || now)) / 1000, MAX_FRAME);
    this.last = now;
    if (dt > 0) this.fps = lerp(this.fps, 1 / dt, 0.05);

    this.handleActions();

    if (this.mode === 'compare' && this.compare) {
      this.acc += dt;
      while (this.acc >= STEP) {
        this.compare.step(STEP);
        this.acc -= STEP;
      }
      this.renderCompare(dt);
      return;
    }

    const s = this.session;
    if (!s) return;
    const simulate = this.mode === 'play' || this.mode === 'menu';
    if (simulate) {
      this.acc += dt;
      while (this.acc >= STEP) {
        this.prevPos = { ...s.ball.pos };
        const input = this.mode === 'menu' ? this.menuInput(s) : this.input.sample();
        const events = s.step(input, STEP);
        if (this.mode === 'play') this.onEvents(events);
        else this.feedbackQuiet(events);
        this.acc -= STEP;
      }
      if (this.mode === 'play') this.feedback.trail(s.ball, dt);
    } else {
      this.acc = 0;
    }
    this.particles.update(dt);

    const alpha = simulate ? this.acc / STEP : 1;
    const bp = {
      x: lerp(this.prevPos.x, s.ball.pos.x, alpha),
      y: lerp(this.prevPos.y, s.ball.pos.y, alpha),
    };
    this.camera.update(dt, bp, s.ball.vel, this.renderer.width, this.renderer.height, s.level.bounds);

    if (this.mode === 'play' && (this.settings.trajectoryAssist || s.lab)) {
      this.trajTimer -= dt;
      if (this.trajTimer <= 0) {
        this.trajTimer = 0.05;
        this.trajectory = this.predict(s.ball, s);
      }
    } else {
      this.trajectory = undefined;
    }

    const view: SceneView = {
      level: s.level,
      world: s.world,
      state: s.state,
      ball: s.ball,
      ballPos: bp,
      checkpoint: s.checkpoint,
      fragmentsTaken: s.fragments,
      fragmentsKnown: this.save.levels[s.level.id]?.fragments ?? [],
      time: s.state.time,
      trajectory: this.trajectory,
      reducedEffects: this.settings.reducedEffects,
    };
    this.renderer.draw(view, this.camera, this.particles);
    this.deathFlash = Math.max(0, this.deathFlash - dt * 2.5);
    this.respawnFade = Math.max(0, this.respawnFade - dt * 3);
    this.renderer.drawOverlay('180,20,30', this.deathFlash * 0.35);
    this.renderer.drawOverlay('5,7,16', this.respawnFade * 0.8);
    this.renderer.drawTouch(this.input.stick, this.input.jumpTouchActive, this.settings.leftHanded, this.mode === 'play' && this.input.touchSeen);

    this.hudTimer -= dt;
    if (this.mode === 'play' && this.hudTimer <= 0) {
      this.hudTimer = 0.1;
      this.pushHud();
      if (this.settings.debugOverlay) this.ui.onDebug(this.debugText(s));
    }
  }

  private renderCompare(dt: number): void {
    const c = this.compare!;
    this.particles.update(dt);
    const alpha = this.acc / STEP;
    const extra = c.balls.map((b, i) => ({
      ball: b,
      pos: { x: lerp(c.prev[i].x, b.pos.x, alpha), y: lerp(c.prev[i].y, b.pos.y, alpha) },
      label: c.label(i),
      labelRow: i % 3,
      alpha: 0.85,
    }));
    // Keep the pack in the upper part of the screen, above the results panel.
    const f = c.focus();
    const lift = (this.renderer.height * 0.22) / this.camera.zoom;
    this.camera.update(dt, { x: f.x, y: f.y + lift }, { x: 0, y: 0 }, this.renderer.width, this.renderer.height);
    this.renderer.draw(
      {
        level: c.level,
        world: c.world,
        state: c.states[0],
        ball: null,
        ballPos: null,
        extraBalls: extra,
        checkpoint: -1,
        fragmentsTaken: new Set(),
        fragmentsKnown: [],
        time: c.time,
        reducedEffects: this.settings.reducedEffects,
      },
      this.camera,
      this.particles,
    );
  }

  private handleActions(): void {
    for (const code of this.input.drainActions()) {
      if (code === 'Escape' || code === 'KeyP') {
        if (this.mode === 'play') this.pause();
        else if (this.mode === 'paused') this.resume();
        else if (this.mode === 'compare') this.endCompare();
      } else if (code === 'KeyR' && (this.mode === 'play' || this.mode === 'complete')) {
        this.restart();
      } else if (code === 'Backquote' || code === 'F3') {
        this.settings.debugOverlay = !this.settings.debugOverlay;
        this.applySettings();
        this.persist();
      } else if (this.mode === 'play' && this.session?.lab && /^Digit[1-8]$/.test(code)) {
        const order: MaterialId[] = ['normal', 'water', 'oil', 'ice', 'lava', 'zerog', 'mud', 'wind'];
        this.setLabMaterial(order[Number(code.slice(5)) - 1]);
      }
    }
  }

  /** Menu backdrop: a ball idly rolling back and forth. */
  private menuInput(s: Session): BallInput {
    const t = s.state.time;
    const x = s.ball.pos.x < 100 ? 1 : s.ball.pos.x > 600 ? -1 : Math.sin(t * 0.5) > 0 ? 1 : -1;
    const jumpPressed = Math.floor(t * 60) % 170 === 0;
    return { x, y: 0, jump: jumpPressed, jumpPressed };
  }

  private feedbackQuiet(events: GameEvent[]): void {
    for (const e of events) if (e.type === 'impact' || e.type === 'jump') this.particles.burst(e.pos.x, e.pos.y, { count: 4, color: '#8a93a6', speed: 100, life: 0.3 });
  }

  private onEvents(events: GameEvent[]): void {
    if (!events.length) return;
    this.feedback.handle(events);
    const s = this.session!;
    for (const e of events) {
      if (e.type === 'transform' && !this.save.discovered.includes(e.to)) {
        this.save.discovered.push(e.to);
        const m = MATERIALS[e.to];
        this.ui.onToast(`New material: ${m.name}`, m.verb, e.to);
        this.persist();
      } else if (e.type === 'transform' && e.effect === 'steam') {
        this.ui.onToast('Steam!', 'Lava and water flash to steam and throw you upward.');
      } else if (e.type === 'fragment') {
        const rec = this.record(s.level.id);
        if (!rec.fragments.includes(e.index)) rec.fragments.push(e.index);
        this.persist();
      } else if (e.type === 'finish') {
        this.finish(e.time);
      } else if (e.type === 'death') {
        this.deathFlash = 1;
      } else if (e.type === 'respawn') {
        // Cut straight to the checkpoint behind a short fade instead of panning across the level.
        this.prevPos = { ...e.pos };
        this.camera.snap(e.pos);
        this.respawnFade = 1;
      }
    }
  }

  private record(id: string) {
    return (this.save.levels[id] ??= { completed: false, bestTime: null, fragments: [], deathsBest: null });
  }

  private finish(time: number): void {
    const s = this.session!;
    const rec = this.record(s.level.id);
    const newBest = rec.bestTime === null || time < rec.bestTime;
    rec.completed = true;
    if (newBest) rec.bestTime = time;
    rec.deathsBest = rec.deathsBest === null ? s.deaths : Math.min(rec.deathsBest, s.deaths);
    this.persist();
    this.audio.silenceBed();
    this.setMode('complete');
    this.ui.onComplete({
      level: s.level,
      time,
      best: rec.bestTime,
      newBest,
      deaths: s.deaths,
      fragments: rec.fragments.length,
      fragmentsTotal: s.level.fragments.length,
      par: s.level.parTime,
      next: this.nextLevel(),
    });
  }

  private pushHud(): void {
    const s = this.session;
    if (!s) return;
    const rec = this.save.levels[s.level.id];
    const taken = new Set([...(rec?.fragments ?? []), ...s.fragments]);
    this.ui.onHud({
      material: s.ball.material,
      time: s.time,
      fragments: taken.size,
      fragmentsTotal: s.level.fragments.length,
      lab: s.lab,
      levelName: s.level.name,
    });
  }

  /** Predicted path with no steering: a full jump when grounded, the current flight otherwise. */
  private predict(ball: BallState, s: Session): Vec2[] {
    const clone = createBall(ball.pos, ball.material);
    Object.assign(clone, {
      vel: { ...ball.vel },
      grounded: ball.grounded,
      groundNormal: { ...ball.groundNormal },
      groundSurface: ball.groundSurface,
      touching: ball.touching,
      contactNormal: { ...ball.contactNormal },
      wallSide: ball.wallSide,
      coyote: ball.coyote,
      airImpulsesLeft: ball.airImpulsesLeft,
      materialLocked: true,
      zonesInside: new Set(ball.zonesInside),
    });
    const state = { time: s.state.time, broken: new Set(s.state.broken) };
    const out: Vec2[] = [];
    for (let i = 0; i < 110; i++) {
      stepBall(clone, { x: 0, y: 0, jump: true, jumpPressed: i === 0 && ball.grounded }, s.world, state, STEP);
      if (clone.dead) break;
      if (i % 5 === 4) out.push({ ...clone.pos });
      if (i > 10 && clone.grounded) break;
    }
    return out;
  }

  private debugText(s: Session): string {
    const b = s.ball;
    const m = MATERIALS[b.material];
    const f = (n: number) => n.toFixed(0).padStart(6);
    return [
      `fps      ${this.fps.toFixed(0)}`,
      `material ${m.name}${b.materialLocked ? ' (locked)' : ''}  t=${b.materialTime.toFixed(1)}${m.duration ? '/' + m.duration : ''}`,
      `pos      ${f(b.pos.x)} ${f(b.pos.y)}`,
      `vel      ${f(b.vel.x)} ${f(b.vel.y)}  |v| ${Math.hypot(b.vel.x, b.vel.y).toFixed(0)}`,
      `accel    ${f(b.lastAccel.x)} ${f(b.lastAccel.y)}`,
      `gravity  ${(s.world.gravity * m.gravityScale).toFixed(0)}  fluid ${b.inFluid.toFixed(2)}`,
      `ground   ${b.grounded ? 'yes' : 'no '} ${b.groundSurface ?? '-'}  n=(${b.groundNormal.x.toFixed(2)},${b.groundNormal.y.toFixed(2)})`,
      `contact  ${b.touching ? 'yes' : 'no '} wall=${b.wallSide}`,
      `friction ${m.friction} x surf  bounce ${m.restitution}`,
      `jump     buf ${b.jumpBuffer.toFixed(2)} coyote ${b.coyote.toFixed(2)} impulses ${b.airImpulsesLeft}`,
      `zones    ${[...b.zonesInside].join(',') || '-'}`,
      `ckpt     ${s.checkpoint}  deaths ${s.deaths}`,
    ].join('\n');
  }
}
