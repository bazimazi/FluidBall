import { type CompleteInfo, Game, type HudInfo, type Mode, type UiHooks } from '../game/game';
import { glyphIcon } from '../game/render';
import { CAMPAIGN } from '../levels/campaign';
import { SCENARIOS } from '../levels/scenarios';
import { MATERIALS, MATERIAL_ORDER, type MaterialId } from '../physics/materials';

type Attrs = Record<string, string | ((e: Event) => void) | boolean | undefined>;

function h(tag: string, attrs: Attrs = {}, ...children: (Node | string | null | undefined | false)[]): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of children) if (c) el.append(c);
  return el;
}

const fmtTime = (t: number | null) => {
  if (t === null) return '--';
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return m > 0 ? `${m}:${s.toFixed(2).padStart(5, '0')}` : s.toFixed(2);
};

const icons = new Map<MaterialId, string>();
const icon = (m: MaterialId, size = 48) => {
  const key = m;
  if (!icons.has(key)) icons.set(key, glyphIcon(MATERIALS[m], size));
  return icons.get(key)!;
};

/** DOM overlay: menus, HUD, toasts and the lab toolbar. The canvas stays underneath. */
export class Ui implements UiHooks {
  game!: Game;
  private screen: HTMLElement;
  private hud: HTMLElement;
  private hudMaterial: HTMLElement;
  private hudTime: HTMLElement;
  private hudFrags: HTMLElement;
  private labBar: HTMLElement;
  private toastBox: HTMLElement;
  private debug: HTMLElement;
  private lastMaterial: MaterialId | null = null;
  private subScreen: 'main' | 'levels' | 'settings' = 'main';
  private settingsReturn: Mode = 'menu';

  constructor(root: HTMLElement) {
    this.screen = h('div', { class: 'screen' });
    this.hudMaterial = h('div', { class: 'hud-material' });
    this.hudTime = h('div', { class: 'hud-time' });
    this.hudFrags = h('div', { class: 'hud-frags' });
    this.hud = h(
      'div',
      { class: 'hud hidden' },
      this.hudMaterial,
      h('div', { class: 'hud-right' }, this.hudFrags, this.hudTime, h('button', { class: 'icon-btn', 'aria-label': 'Pause', onclick: () => this.game.pause() }, '❚❚')),
    );
    this.labBar = h('div', { class: 'lab-bar hidden' });
    this.toastBox = h('div', { class: 'toasts', 'aria-live': 'polite' });
    this.debug = h('pre', { class: 'debug hidden' });
    root.append(this.hud, this.labBar, this.toastBox, this.debug, this.screen);
  }

  attach(game: Game): void {
    this.game = game;
    this.buildLabBar();
    this.onMode(game.mode);
  }

  // ------------------------------------------------------------ hooks

  onMode(mode: Mode): void {
    if (!this.game) return;
    const playing = mode === 'play';
    this.hud.classList.toggle('hidden', !(playing || mode === 'paused'));
    this.labBar.classList.toggle('hidden', !(playing && this.game.session?.lab));
    if (mode === 'menu') this.renderMenu();
    else if (mode === 'paused') this.renderPause();
    else if (mode === 'compare') this.renderCompare();
    else if (mode === 'play') this.clearScreen();
  }

  onHud(info: HudInfo): void {
    if (info.material !== this.lastMaterial) {
      this.lastMaterial = info.material;
      const m = MATERIALS[info.material];
      this.hudMaterial.replaceChildren(h('img', { src: icon(info.material), alt: '' }), h('span', {}, m.name));
      this.hudMaterial.style.setProperty('--accent', m.accent);
      for (const b of Array.from(this.labBar.querySelectorAll('button[data-m]'))) b.classList.toggle('active', b.getAttribute('data-m') === info.material);
    }
    this.hudTime.textContent = info.lab ? 'LAB' : fmtTime(info.time);
    this.hudFrags.textContent = info.fragmentsTotal ? `◆ ${info.fragments}/${info.fragmentsTotal}` : '';
  }

  onToast(title: string, body: string, m?: MaterialId): void {
    const t = h('div', { class: 'toast' }, m ? h('img', { src: icon(m), alt: '' }) : null, h('div', {}, h('strong', {}, title), h('p', {}, body)));
    this.toastBox.append(t);
    setTimeout(() => t.classList.add('out'), 3600);
    setTimeout(() => t.remove(), 4200);
  }

  onDebug(text: string | null): void {
    this.debug.classList.toggle('hidden', text === null);
    if (text !== null) this.debug.textContent = text;
  }

  onComplete(info: CompleteInfo): void {
    const underPar = info.time <= info.par;
    this.show(
      h(
        'div',
        { class: 'panel' },
        h('p', { class: 'eyebrow' }, info.level.region),
        h('h2', {}, `${info.level.name} complete`),
        h(
          'div',
          { class: 'stats' },
          stat('Time', fmtTime(info.time), info.newBest ? 'New best' : `Best ${fmtTime(info.best)}`),
          stat('Par', fmtTime(info.par), underPar ? 'Beaten' : 'Try again?'),
          stat('Falls', String(info.deaths), ''),
          stat('Fragments', `${info.fragments}/${info.fragmentsTotal}`, info.fragments < info.fragmentsTotal ? 'Something is still out there' : 'All found'),
        ),
        h(
          'div',
          { class: 'row' },
          info.next ? h('button', { class: 'primary', onclick: () => this.game.startLevel(info.next!) }, `Next: ${info.next.name}`) : null,
          h('button', { onclick: () => this.game.restart() }, 'Retry'),
          h('button', { onclick: () => this.openLevels() }, 'Levels'),
        ),
      ),
    );
  }

  // ------------------------------------------------------------ screens

  private clearScreen(): void {
    this.screen.replaceChildren();
    this.screen.classList.add('hidden');
  }

  private show(content: HTMLElement): void {
    this.screen.classList.remove('hidden', 'see-through');
    this.screen.replaceChildren(content);
    (content.querySelector('button.primary') as HTMLElement | null)?.focus();
  }

  private renderMenu(): void {
    if (this.subScreen === 'levels') return this.renderLevels();
    if (this.subScreen === 'settings') return this.renderSettings();
    const discovered = this.game.save.discovered;
    this.show(
      h(
        'div',
        { class: 'panel title' },
        h('h1', {}, 'Fluid', h('span', {}, 'Ball')),
        h('p', { class: 'tagline' }, 'Change what you are. Change how you move.'),
        h(
          'div',
          { class: 'material-strip', 'aria-label': 'Discovered materials' },
          ...MATERIAL_ORDER.map((m) =>
            discovered.includes(m)
              ? h('img', { src: icon(m), alt: MATERIALS[m].name, title: MATERIALS[m].name })
              : h('span', { class: 'unknown', title: 'Undiscovered' }, '?'),
          ),
        ),
        h('div', { class: 'col' }, h('button', { class: 'primary', onclick: () => this.openLevels() }, 'Play'), h('button', { onclick: () => this.game.startLab() }, 'Material Lab'), h('button', { onclick: () => this.openSettings('menu') }, 'Settings')),
      ),
    );
  }

  private openLevels(): void {
    this.subScreen = 'levels';
    if (this.game.mode !== 'menu') this.game.toMenu();
    else this.renderLevels();
  }

  private renderLevels(): void {
    const regions = new Map<string, typeof CAMPAIGN>();
    for (const l of CAMPAIGN) {
      if (!regions.has(l.region)) regions.set(l.region, []);
      regions.get(l.region)!.push(l);
    }
    const cards = [...regions.entries()].map(([region, levels]) =>
      h(
        'section',
        { class: 'region' },
        h('h3', {}, region),
        ...levels.map((l) => {
          const rec = this.game.save.levels[l.id];
          const unlocked = this.game.isUnlocked(l);
          return h(
            'button',
            { class: `level-card${rec?.completed ? ' done' : ''}`, disabled: !unlocked, onclick: () => this.game.startLevel(l) },
            h('span', { class: 'level-id' }, l.id),
            h('span', { class: 'level-name' }, unlocked ? l.name : 'Locked'),
            h('span', { class: 'level-blurb' }, unlocked ? l.blurb : 'Finish the previous level'),
            h(
              'span',
              { class: 'level-meta' },
              ...l.materials.map((m) => h('img', { src: icon(m), alt: MATERIALS[m].name, title: MATERIALS[m].name })),
              rec?.bestTime != null ? h('span', {}, `⏱ ${fmtTime(rec.bestTime)}`) : null,
              l.fragments.length ? h('span', {}, `◆ ${rec?.fragments.length ?? 0}/${l.fragments.length}`) : null,
            ),
          );
        }),
      ),
    );
    this.show(
      h(
        'div',
        { class: 'panel wide' },
        h('div', { class: 'panel-head' }, h('h2', {}, 'Worlds'), h('button', { onclick: () => this.back() }, 'Back')),
        h('div', { class: 'regions' }, ...cards),
      ),
    );
  }

  private back(): void {
    this.subScreen = 'main';
    this.renderMenu();
  }

  private renderPause(): void {
    const lab = this.game.session?.lab;
    this.show(
      h(
        'div',
        { class: 'panel' },
        h('h2', {}, 'Paused'),
        h(
          'div',
          { class: 'col' },
          h('button', { class: 'primary', onclick: () => this.game.resume() }, 'Resume'),
          h('button', { onclick: () => this.game.restart() }, 'Restart'),
          h('button', { onclick: () => this.openSettings('paused') }, 'Settings'),
          h('button', { onclick: () => (lab ? this.toMain() : this.openLevels()) }, lab ? 'Main menu' : 'Levels'),
        ),
        h('p', { class: 'hint' }, 'Keys: ← → move · Space jump · ↓ sink (lava) · R restart · Esc pause · ` debug'),
      ),
    );
  }

  private toMain(): void {
    this.subScreen = 'main';
    this.game.toMenu();
  }

  private openSettings(from: Mode): void {
    this.settingsReturn = from;
    this.subScreen = 'settings';
    this.renderSettings();
  }

  private renderSettings(): void {
    const s = this.game.settings;
    const apply = () => {
      this.game.applySettings();
      this.game.persist();
    };
    const toggle = (key: keyof typeof s, label: string, note: string) =>
      h(
        'label',
        { class: 'setting' },
        h('span', {}, label, h('small', {}, note)),
        (() => {
          const i = h('input', { type: 'checkbox' }) as HTMLInputElement;
          i.checked = s[key] as boolean;
          i.addEventListener('change', () => {
            (s[key] as boolean) = i.checked;
            apply();
          });
          return i;
        })(),
      );
    const slider = (key: 'volume' | 'shake' | 'stickRadius', label: string, min: number, max: number, step: number) =>
      h(
        'label',
        { class: 'setting' },
        h('span', {}, label),
        (() => {
          const i = h('input', { type: 'range', min: String(min), max: String(max), step: String(step) }) as HTMLInputElement;
          i.value = String(s[key]);
          i.addEventListener('input', () => {
            s[key] = Number(i.value);
            apply();
          });
          return i;
        })(),
      );
    this.show(
      h(
        'div',
        { class: 'panel' },
        h('div', { class: 'panel-head' }, h('h2', {}, 'Settings'), h('button', { class: 'primary', onclick: () => this.closeSettings() }, 'Done')),
        slider('volume', 'Volume', 0, 1, 0.05),
        slider('shake', 'Camera shake', 0, 1, 0.1),
        slider('stickRadius', 'Stick travel (lower = more sensitive)', 30, 110, 5),
        toggle('reducedEffects', 'Reduced effects', 'Fewer particles, calmer animation'),
        toggle('haptics', 'Haptics', 'Vibration on impacts'),
        toggle('leftHanded', 'Left-handed', 'Jump on the left, stick on the right'),
        toggle('trajectoryAssist', 'Trajectory assist', 'Show the jump arc'),
        toggle('debugOverlay', 'Physics overlay', 'Velocity, forces, contacts'),
      ),
    );
  }

  private closeSettings(): void {
    this.subScreen = 'main';
    if (this.settingsReturn === 'paused') this.renderPause();
    else this.renderMenu();
  }

  // ------------------------------------------------------------ lab

  private buildLabBar(): void {
    const buttons = MATERIAL_ORDER.map((m, i) =>
      h(
        'button',
        { class: 'lab-mat', 'data-m': m, title: `${i + 1}: ${MATERIALS[m].name}`, onclick: () => this.game.setLabMaterial(m) },
        h('img', { src: icon(m), alt: '' }),
        h('span', {}, MATERIALS[m].name),
      ),
    );
    this.labBar.replaceChildren(...buttons, h('button', { class: 'lab-compare', onclick: () => this.game.startCompare(SCENARIOS[0].id) }, 'Compare'));
  }

  private renderCompare(): void {
    const c = this.game.compare;
    if (!c) return;
    const max = (k: 'distance' | 'maxHeight' | 'settleTime') => Math.max(...c.results.map((r) => Math.abs(r[k])), 1);
    const bar = (v: number, m: number, color: string) => h('span', { class: 'bar', style: `width:${Math.round((Math.abs(v) / m) * 100)}%;background:${color}` });
    const rows = c.results.map((r) => {
      const m = MATERIALS[r.material];
      return h(
        'tr',
        {},
        h('td', {}, h('img', { src: icon(r.material), alt: '' }), m.name),
        h('td', {}, bar(r.distance, max('distance'), m.accent), h('span', {}, r.distance.toFixed(0))),
        h('td', {}, bar(r.maxHeight, max('maxHeight'), m.accent), h('span', {}, r.maxHeight.toFixed(0))),
        h('td', {}, String(r.bounces)),
        h('td', {}, r.settleTime >= c.scenario.duration ? 'moving' : `${r.settleTime.toFixed(2)}s`),
      );
    });
    this.show(
      h(
        'div',
        { class: 'compare-panel' },
        h(
          'div',
          { class: 'panel-head' },
          h('div', {}, h('h2', {}, c.scenario.name), h('p', { class: 'hint' }, c.scenario.description)),
          h('button', { class: 'primary', onclick: () => this.game.endCompare() }, 'Back to lab'),
        ),
        h('div', { class: 'row tabs' }, ...SCENARIOS.map((s) => h('button', { class: s.id === c.scenario.id ? 'active' : '', onclick: () => this.game.startCompare(s.id) }, s.name))),
        h('table', {}, h('thead', {}, h('tr', {}, ...['Material', 'Distance', 'Height', 'Impacts', 'Settles'].map((t) => h('th', {}, t)))), h('tbody', {}, ...rows)),
      ),
    );
    this.screen.classList.add('see-through');
  }
}

function stat(label: string, value: string, note: string): HTMLElement {
  return h('div', { class: 'stat' }, h('span', { class: 'stat-label' }, label), h('span', { class: 'stat-value' }, value), h('span', { class: 'stat-note' }, note));
}
