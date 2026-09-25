import { afterEach, describe, expect, it } from 'vitest';
import { MIGRATIONS, SAVE_VERSION, type Storage, defaultSave, loadSave, migrate, writeSave } from '../src/game/save';
import { Session } from '../src/game/session';
import { CAMPAIGN } from '../src/levels/campaign';

class MemoryStore implements Storage {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}

describe('save system', () => {
  afterEach(() => {
    for (const k of Object.keys(MIGRATIONS)) delete MIGRATIONS[Number(k)];
  });

  it('round-trips progress and settings', () => {
    const store = new MemoryStore();
    const save = defaultSave();
    save.levels['1-1'] = { completed: true, bestTime: 12.5, fragments: [0], deathsBest: 2 };
    save.discovered.push('water');
    save.settings.leftHanded = true;
    writeSave(save, store);
    expect(loadSave(store)).toEqual(save);
  });

  it('falls back to the previous save when the current one is corrupt', () => {
    const store = new MemoryStore();
    const good = defaultSave();
    good.discovered.push('oil');
    writeSave(good, store);
    writeSave(defaultSave(), store); // good becomes the backup
    store.setItem('fluidball.save', '{not json');
    expect(loadSave(store).discovered).toContain('oil');
  });

  it('returns defaults when everything is unreadable', () => {
    const store = new MemoryStore();
    store.setItem('fluidball.save', 'garbage');
    store.setItem('fluidball.save.bak', 'more garbage');
    expect(loadSave(store)).toEqual(defaultSave());
  });

  it('repairs malformed fields instead of crashing', () => {
    const fixed = migrate({
      version: SAVE_VERSION,
      levels: { '1-1': { completed: 'yes', bestTime: 'fast', fragments: [0, 'x'] }, bad: null },
      discovered: ['water'],
      settings: { volume: 'loud', shake: 0.5, unknownSetting: true },
    });
    expect(fixed.levels['1-1']).toEqual({ completed: true, bestTime: null, fragments: [0], deathsBest: null });
    expect(fixed.levels.bad).toBeUndefined();
    expect(fixed.discovered).toEqual(['normal', 'water']);
    expect(fixed.settings.volume).toBe(defaultSave().settings.volume);
    expect(fixed.settings.shake).toBe(0.5);
  });

  it('runs migrations in order from older versions', () => {
    MIGRATIONS[0] = (d) => ({ ...d, discovered: ['ice'], version: 1 });
    expect(migrate({ version: 0 }).discovered).toContain('ice');
  });

  it('works with no storage at all', () => {
    expect(loadSave(null)).toEqual(defaultSave());
    expect(() => writeSave(defaultSave(), null)).not.toThrow();
  });
});

describe('session', () => {
  const level = CAMPAIGN[0];

  it('respawns at the last checkpoint after a death', () => {
    const s = new Session(level);
    s.ball.pos = { ...level.checkpoints[0] };
    s.step({ x: 0, y: 0, jump: false, jumpPressed: false }, 1 / 120);
    expect(s.checkpoint).toBe(0);
    s.ball.pos = { x: 2050, y: 400 };
    for (let i = 0; i < 200; i++) s.step({ x: 0, y: 0, jump: false, jumpPressed: false }, 1 / 120);
    expect(s.deaths).toBe(1);
    expect(Math.abs(s.ball.pos.x - level.checkpoints[0].x)).toBeLessThan(5);
  });

  it('keeps fragments collected before a restart', () => {
    const s = new Session(level);
    s.ball.pos = { ...level.fragments[0] };
    s.step({ x: 0, y: 0, jump: false, jumpPressed: false }, 1 / 120);
    expect(s.fragments.has(0)).toBe(true);
    s.restart();
    expect(s.fragments.has(0)).toBe(true);
    expect(s.time).toBe(0);
  });
});
