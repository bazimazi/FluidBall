import type { MaterialId } from '../physics/materials';

export interface Settings {
  volume: number;
  shake: number;
  reducedEffects: boolean;
  haptics: boolean;
  leftHanded: boolean;
  stickRadius: number;
  trajectoryAssist: boolean;
  debugOverlay: boolean;
}

export interface LevelRecord {
  completed: boolean;
  bestTime: number | null;
  fragments: number[];
  deathsBest: number | null;
}

export interface SaveData {
  version: number;
  levels: Record<string, LevelRecord>;
  discovered: MaterialId[];
  settings: Settings;
}

export const SAVE_VERSION = 1;
const KEY = 'fluidball.save';
const BACKUP_KEY = 'fluidball.save.bak';

export const defaultSettings = (): Settings => ({
  volume: 0.7,
  shake: 1,
  reducedEffects: false,
  haptics: true,
  leftHanded: false,
  stickRadius: 60,
  trajectoryAssist: false,
  debugOverlay: false,
});

export const defaultSave = (): SaveData => ({
  version: SAVE_VERSION,
  levels: {},
  discovered: ['normal'],
  settings: defaultSettings(),
});

/**
 * Each entry upgrades a save from version N to N+1. When the save format changes,
 * bump SAVE_VERSION and add the step here; `migrate` runs them in order.
 */
export const MIGRATIONS: Record<number, (d: Record<string, unknown>) => Record<string, unknown>> = {};

export function migrate(raw: unknown): SaveData {
  if (!raw || typeof raw !== 'object') return defaultSave();
  let d = raw as Record<string, unknown>;
  let v = typeof d.version === 'number' ? d.version : 1;
  while (v < SAVE_VERSION) {
    const step = MIGRATIONS[v];
    if (!step) return defaultSave();
    d = step(d);
    v++;
  }
  return sanitize(d);
}

/** Fill anything missing or malformed with defaults so a partial save never crashes the game. */
function sanitize(d: Record<string, unknown>): SaveData {
  const out = defaultSave();
  if (d.levels && typeof d.levels === 'object') {
    for (const [id, r] of Object.entries(d.levels as Record<string, Partial<LevelRecord>>)) {
      if (!r || typeof r !== 'object') continue;
      out.levels[id] = {
        completed: !!r.completed,
        bestTime: typeof r.bestTime === 'number' && isFinite(r.bestTime) ? r.bestTime : null,
        fragments: Array.isArray(r.fragments) ? r.fragments.filter((n) => typeof n === 'number') : [],
        deathsBest: typeof r.deathsBest === 'number' ? r.deathsBest : null,
      };
    }
  }
  if (Array.isArray(d.discovered)) out.discovered = Array.from(new Set(['normal', ...d.discovered])) as MaterialId[];
  if (d.settings && typeof d.settings === 'object') {
    const s = d.settings as Record<string, unknown>;
    const def = out.settings as unknown as Record<string, unknown>;
    for (const k of Object.keys(def)) if (typeof s[k] === typeof def[k]) def[k] = s[k];
  }
  return out;
}

export interface Storage {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadSave(store: Storage | null = storage()): SaveData {
  if (!store) return defaultSave();
  for (const key of [KEY, BACKUP_KEY]) {
    try {
      const txt = store.getItem(key);
      if (txt) return migrate(JSON.parse(txt));
    } catch {
      // Corrupt: fall through to the backup, then defaults.
    }
  }
  return defaultSave();
}

export function writeSave(data: SaveData, store: Storage | null = storage()): void {
  if (!store) return;
  try {
    const txt = JSON.stringify(data);
    // Keep the previous good save as a backup before replacing it.
    const prev = store.getItem(KEY);
    if (prev) store.setItem(BACKUP_KEY, prev);
    store.setItem(KEY, txt);
  } catch {
    // Storage full or blocked: the game keeps running with in-memory progress.
  }
}
