import { DEFAULT_CONFIG } from '../sim/config';
import type { SimulationConfig } from '../sim/types';
import { FEATURE_GROUPS, FEATURE_SWITCHES, blockedBy, type FeatureKey, type FeatureSwitch } from './feature-switches';

export interface FeaturesCallbacks {
  /** A live switch changed: send it to the host now. */
  onLiveChange: (config: Partial<SimulationConfig>) => void;
  /** Start a new world (with this seed) carrying the staged new-world switches. */
  onApplyNewWorld: () => void;
}

interface Row {
  readonly f: FeatureSwitch;
  readonly el: HTMLElement;
  readonly box: HTMLInputElement;
  readonly note: HTMLElement;
}

const defaultOf = (k: FeatureKey): boolean => DEFAULT_CONFIG[k] as boolean;

/**
 * The Features section of the settings: every on/off switch in the config, grouped, searchable.
 * Live switches go to the host at once; new-world switches are staged until "Apply" starts a new world.
 * The checkboxes show the config the host last sent (plus anything staged here), so other viewers'
 * changes show up.
 */
export class FeaturesView {
  /** A copy of the config the host last sent; never the client's own (optimistically edited) object. */
  private host: Readonly<SimulationConfig>;
  /** New-world switches waiting for the next world. */
  private readonly staged = new Map<FeatureKey, boolean>();
  /** Live changes sent but not yet echoed by the host. */
  private readonly pending = new Map<FeatureKey, boolean>();
  private readonly rows: Row[] = [];
  private readonly groups = new Map<string, { el: HTMLDetailsElement; count: HTMLElement }>();
  private readonly changedCount: HTMLElement;
  private readonly stagedBar: HTMLElement;
  private readonly stagedText: HTMLElement;
  private readonly search: HTMLInputElement;
  private readonly empty: HTMLElement;
  /** Groups that were open when a search began, to reopen when it is cleared; null while not searching. */
  private openBeforeSearch: Set<string> | null = null;

  constructor(container: HTMLElement, private readonly callbacks: FeaturesCallbacks, config: Readonly<SimulationConfig>) {
    this.host = { ...config };
    const section = document.createElement('details');
    section.className = 'settings-group features';
    section.innerHTML = `
      <summary class="features-summary"><h3>Features <small class="features-changed"></small></h3></summary>
      <div class="features-tools">
        <input type="search" class="features-search" placeholder="Search features" aria-label="Search features" />
        <button type="button" class="features-reset">Reset all to defaults</button>
      </div>
      <div class="features-staged" hidden>
        <p class="features-staged-text"></p>
        <button type="button" class="features-apply">Apply and start a new world with this seed</button>
      </div>
      <p class="features-empty" hidden>No feature matches.</p>
    `;
    container.appendChild(section);
    this.changedCount = section.querySelector('.features-changed')!;
    this.stagedBar = section.querySelector('.features-staged')!;
    this.stagedText = section.querySelector('.features-staged-text')!;
    this.search = section.querySelector('.features-search')!;
    this.empty = section.querySelector('.features-empty')!;

    for (const group of FEATURE_GROUPS) {
      const g = document.createElement('details');
      g.className = 'feature-group';
      g.dataset.group = group;
      const summary = document.createElement('summary');
      summary.textContent = group;
      const count = document.createElement('span');
      count.className = 'feature-group-count';
      summary.appendChild(count);
      g.appendChild(summary);
      section.appendChild(g);
      this.groups.set(group, { el: g, count });
    }

    for (const f of FEATURE_SWITCHES) {
      const el = document.createElement('label');
      el.className = 'feature-row';
      el.dataset.key = f.key;
      const box = document.createElement('input');
      box.type = 'checkbox';
      const text = document.createElement('span');
      text.className = 'feature-text';
      const label = document.createElement('span');
      label.className = 'feature-label';
      label.textContent = f.label;
      for (const [cls, word, show] of [
        ['changed', 'changed', true],
        ['new-world', 'applies to new worlds', f.when === 'newWorld'],
        ['inert', 'no effect yet', !!f.inert],
      ] as const) {
        if (!show) continue;
        const tag = document.createElement('span');
        tag.className = `feature-tag ${cls}`;
        tag.textContent = word;
        label.appendChild(tag);
      }
      const help = document.createElement('span');
      help.className = 'feature-help';
      help.textContent = f.help;
      const note = document.createElement('span');
      note.className = 'feature-note';
      const key = document.createElement('code');
      key.className = 'feature-key';
      key.textContent = f.key;
      text.append(label, help, note, key);
      el.append(box, text);
      this.groups.get(f.group)!.el.appendChild(el);
      box.addEventListener('change', () => this.toggle(f, box.checked));
      this.rows.push({ f, el, box, note });
    }

    this.search.addEventListener('input', () => this.filter());
    section.querySelector('.features-reset')!.addEventListener('click', () => this.resetAll());
    section.querySelector('.features-apply')!.addEventListener('click', () => {
      if (this.staged.size > 0) this.callbacks.onApplyNewWorld();
    });
    this.render();
  }

  /** The host sent its config (after a change by anyone, or a new world). */
  public sync(config: Readonly<SimulationConfig>): void {
    this.host = { ...config };
    this.pending.clear();
    for (const [k, v] of this.staged) if (this.hostValue(k) === v) this.staged.delete(k);
    this.render();
  }

  /** A command was refused or lost: show what the host really runs again. */
  public dropPending(): void {
    if (this.pending.size === 0) return;
    this.pending.clear();
    this.render();
  }

  /** The staged new-world switches, to send with the next reset. */
  public stagedConfig(): Partial<SimulationConfig> {
    return Object.fromEntries(this.staged) as Partial<SimulationConfig>;
  }

  private hostValue(k: FeatureKey): boolean {
    const v = this.host[k];
    return typeof v === 'boolean' ? v : defaultOf(k);
  }

  /** The value a switch will have: staged or just sent from here, else what the host runs. */
  private valueOf = (k: FeatureKey): boolean => this.staged.get(k) ?? this.pending.get(k) ?? this.hostValue(k);

  private toggle(f: FeatureSwitch, on: boolean): void {
    if (f.when === 'newWorld') {
      if (on === this.hostValue(f.key)) this.staged.delete(f.key);
      else this.staged.set(f.key, on);
    } else {
      this.pending.set(f.key, on);
      this.callbacks.onLiveChange({ [f.key]: on });
    }
    this.render();
  }

  private resetAll(): void {
    const live: Partial<Record<FeatureKey, boolean>> = {};
    for (const { f } of this.rows) {
      const d = defaultOf(f.key);
      if (f.when === 'newWorld') {
        if (this.hostValue(f.key) === d) this.staged.delete(f.key);
        else this.staged.set(f.key, d);
      } else if (this.valueOf(f.key) !== d) {
        live[f.key] = d;
        this.pending.set(f.key, d);
      }
    }
    if (Object.keys(live).length > 0) this.callbacks.onLiveChange(live as Partial<SimulationConfig>);
    this.render();
  }

  private render(): void {
    let changed = 0;
    const perGroup = new Map<string, number>();
    for (const { f, el, box, note } of this.rows) {
      const v = this.valueOf(f.key);
      box.checked = v;
      const isChanged = v !== defaultOf(f.key);
      if (isChanged) {
        changed++;
        perGroup.set(f.group, (perGroup.get(f.group) ?? 0) + 1);
      }
      el.classList.toggle('is-changed', isChanged);
      el.classList.toggle('is-staged', this.staged.has(f.key));
      const blocked = blockedBy(f.key, this.valueOf);
      el.classList.toggle('is-blocked', blocked !== null);
      note.textContent = this.staged.has(f.key) ? 'waiting for a new world' + (blocked ? `; ${blocked}` : '') : blocked ?? '';
      note.hidden = note.textContent === '';
    }
    this.changedCount.textContent = changed > 0 ? `${changed} changed from default` : '';
    for (const [name, g] of this.groups) {
      const n = perGroup.get(name) ?? 0;
      g.count.textContent = n > 0 ? `${n} changed` : '';
    }
    const n = this.staged.size;
    this.stagedBar.hidden = n === 0;
    this.stagedText.textContent = `${n} ${n === 1 ? 'change waits' : 'changes wait'} for a new world.`;
  }

  private filter(): void {
    const q = this.search.value.trim().toLowerCase();
    if (q !== '' && this.openBeforeSearch === null) {
      this.openBeforeSearch = new Set([...this.groups].filter(([, g]) => g.el.open).map(([name]) => name));
    }
    const shown = new Set<string>();
    for (const { f, el } of this.rows) {
      const hit = q === '' || f.label.toLowerCase().includes(q) || f.key.toLowerCase().includes(q) || f.help.toLowerCase().includes(q);
      el.hidden = !hit;
      if (hit) shown.add(f.group);
    }
    for (const [name, g] of this.groups) {
      g.el.hidden = !shown.has(name);
      if (q !== '') g.el.open = shown.has(name);
    }
    if (q === '' && this.openBeforeSearch !== null) {
      for (const [name, g] of this.groups) g.el.open = this.openBeforeSearch.has(name);
      this.openBeforeSearch = null;
    }
    this.empty.hidden = shown.size > 0;
  }
}
