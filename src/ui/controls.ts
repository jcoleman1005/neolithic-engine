import type { SimulationConfig } from '../sim/types';
import { FeaturesView } from './features-view';
import { LIMITED, setLimitedPalette } from '../render/limited-palette';

export interface PlaybackCallbacks {
  onPlayPause: () => void;
  onStep: () => void;
  onSpeedChange: (speedMultiplier: number) => void;
  onColorModeChange?: (mode: 'status' | 'bands') => void;
  onElevationSliceChange?: (slice: number) => void;
  onTerrainThemeChange?: (theme: 'classic' | 'mountainhome' | 'wilds') => void;
  onAutoCameraChange?: (on: boolean) => void;
}

export interface SettingsCallbacks {
  /** Start a new world with this seed; `config` carries the staged new-world feature switches. */
  onReset: (seed: string | number, config: Partial<SimulationConfig>) => void;
  onNewSeed: (config: Partial<SimulationConfig>) => void;
  onSaveFile: () => void;
  onLoadFile: (file: File) => void;
  onConfigChange: (config: Partial<SimulationConfig>) => void;
}

export class PlaybackPill {
  private readonly playBtn: HTMLButtonElement;
  private readonly stepBtn: HTMLButtonElement;
  private readonly speedSelect: HTMLSelectElement;
  private readonly colorSelect: HTMLSelectElement | null;
  private readonly sliceSelect: HTMLSelectElement | null;
  private readonly terrainSelect: HTMLSelectElement | null;
  private readonly tpsBadge: HTMLElement;
  private readonly menu: HTMLElement;
  private readonly menuBtn: HTMLButtonElement;

  constructor(container: HTMLElement, callbacks: PlaybackCallbacks) {
    // Play/Pause, speed and tps stay on the pill (it must fit 360 px); the rest lives in a menu.
    container.innerHTML = `
      <button id="btn-play" class="pill-btn" aria-label="Play or pause">Play</button>
      <select id="select-speed" class="pill-select" aria-label="Speed">
        <option value="0.33">⅓×</option>
        <option value="1" selected>1×</option>
        <option value="3">3×</option>
        <option value="10">10×</option>
      </select>
      <span id="pill-tps" class="pill-tps">0 tps</span>
      <button id="btn-pill-menu" class="pill-btn pill-menu-btn" aria-label="More controls" aria-expanded="false">⋯</button>
      <div id="pill-menu" class="pill-menu" hidden>
        <button id="btn-step" class="pill-menu-item" aria-label="Step one tick">Step one tick</button>
        <button id="btn-auto-camera" class="pill-menu-item" aria-pressed="false" title="Auto-camera follows the story">Auto camera</button>
        <label class="pill-menu-item">Colour
          <select id="select-color-mode" class="pill-select" aria-label="Color Mode" title="Color Mode">
            <option value="status" selected>Status</option>
            <option value="bands">Bands</option>
          </select>
        </label>
        <label class="pill-menu-item">Slice
          <select id="select-elevation-slice" class="pill-select" aria-label="Elevation Slice" title="Elevation Slice">
            <option value="0" selected>All Tiers</option>
            <option value="5">Tier 5 (Snow)</option>
            <option value="4">Tier 4 (Crags)</option>
            <option value="3">Tier 3 (Plateau)</option>
            <option value="2">Tier 2 (Lowlands)</option>
            <option value="1">Tier 1 (Shores)</option>
          </select>
        </label>
        <label class="pill-menu-item">Terrain
          <select id="select-terrain-style" class="pill-select" aria-label="Terrain Style" title="Terrain Style">
            <option value="classic" selected>DF Steam Classic</option>
            <option value="mountainhome">DF Mountainhome</option>
            <option value="wilds">DF Wilds Taiga</option>
          </select>
        </label>
        <label class="pill-menu-item">Palette
          <select id="select-palette" class="pill-select" aria-label="Palette" title="Draw the world in the limited 30-colour palette or the original colours (reloads the page)">
            <option value="limited"${LIMITED ? ' selected' : ''}>Limited (30)</option>
            <option value="original"${LIMITED ? '' : ' selected'}>Original</option>
          </select>
        </label>
      </div>
    `;

    this.playBtn = container.querySelector('#btn-play')!;
    this.stepBtn = container.querySelector('#btn-step')!;
    this.speedSelect = container.querySelector('#select-speed')!;
    this.colorSelect = container.querySelector('#select-color-mode');
    this.sliceSelect = container.querySelector('#select-elevation-slice');
    this.terrainSelect = container.querySelector('#select-terrain-style');
    this.tpsBadge = container.querySelector('#pill-tps')!;
    this.menu = container.querySelector('#pill-menu')!;
    this.menuBtn = container.querySelector('#btn-pill-menu')!;

    const setMenu = (open: boolean): void => {
      this.menu.hidden = !open;
      this.menuBtn.setAttribute('aria-expanded', String(open));
    };
    this.menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      setMenu(this.menu.hidden);
    });
    document.addEventListener('click', (e) => {
      if (!this.menu.hidden && !container.contains(e.target as Node)) setMenu(false);
    });

    const camBtn = container.querySelector<HTMLButtonElement>('#btn-auto-camera');
    camBtn?.addEventListener('click', () => {
      const on = camBtn.getAttribute('aria-pressed') !== 'true';
      camBtn.setAttribute('aria-pressed', String(on));
      callbacks.onAutoCameraChange?.(on);
    });

    this.playBtn.addEventListener('click', () => callbacks.onPlayPause());
    this.stepBtn.addEventListener('click', () => callbacks.onStep());
    this.speedSelect.addEventListener('change', () => {
      callbacks.onSpeedChange(parseFloat(this.speedSelect.value));
    });
    this.colorSelect?.addEventListener('change', () => {
      if (this.colorSelect) {
        callbacks.onColorModeChange?.(this.colorSelect.value as 'status' | 'bands');
      }
    });
    this.sliceSelect?.addEventListener('change', () => {
      if (this.sliceSelect) {
        callbacks.onElevationSliceChange?.(parseInt(this.sliceSelect.value, 10));
      }
    });
    // Colours are worked out when the page loads, so a palette change saves the choice and reloads.
    const paletteSelect = container.querySelector<HTMLSelectElement>('#select-palette');
    paletteSelect?.addEventListener('change', () => {
      setLimitedPalette(paletteSelect.value === 'limited');
      location.reload();
    });
    this.terrainSelect?.addEventListener('change', () => {
      if (this.terrainSelect) {
        callbacks.onTerrainThemeChange?.(this.terrainSelect.value as 'classic' | 'mountainhome' | 'wilds');
      }
    });
  }

  public update(running: boolean, tps: number): void {
    this.playBtn.textContent = running ? 'Pause' : 'Play';
    this.stepBtn.disabled = running;
    this.tpsBadge.textContent = `${tps} tps`;
  }

  /**
   * Shows the speed the server is really running at (1x is 3 ticks a second), for example
   * after the page reconnects. A speed with no matching option gets one of its own.
   */
  public showServerSpeed(targetTicksPerSecond: number): void {
    if (!(targetTicksPerSecond > 0) || document.activeElement === this.speedSelect) return;
    const multiplier = targetTicksPerSecond / 3;
    let match: HTMLOptionElement | null = null;
    for (const opt of Array.from(this.speedSelect.options)) {
      if (Math.abs(parseFloat(opt.value) - multiplier) < 0.02) {
        match = opt;
        break;
      }
    }
    if (!match) {
      match = document.createElement('option');
      match.value = String(multiplier);
      match.textContent = `${Number(multiplier.toFixed(2))}×`;
      this.speedSelect.appendChild(match);
    }
    this.speedSelect.value = match.value;
  }
}

export class SettingsView {
  private readonly features: FeaturesView;
  private readonly seedInput: HTMLInputElement;
  /** Seed of the world the host runs, to tell a new world from a reconnect. */
  private worldSeed: number;

  constructor(container: HTMLElement, callbacks: SettingsCallbacks, config: SimulationConfig) {
    container.innerHTML = `
      <div class="settings-panel">
        <div class="setting-row">
          <label>Seed: <input type="number" id="setting-seed" value="${config.seed}" /></label>
          <button id="btn-reset-seed">Reset</button>
          <button id="btn-new-seed">Random Seed</button>
        </div>
        <div class="setting-row">
          <button id="btn-save-world">Save to File</button>
          <label class="file-label">Load File <input type="file" id="input-load-file" accept=".json" hidden /></label>
        </div>
      </div>
    `;

    const seedInput = container.querySelector<HTMLInputElement>('#setting-seed')!;
    this.seedInput = seedInput;
    this.worldSeed = config.seed;
    const readSeed = (): number => {
      const n = parseInt(seedInput.value, 10);
      return Number.isNaN(n) ? 42 : n;
    };
    // Every new world carries the staged new-world switches, whichever button starts it.
    const reset = () => callbacks.onReset(readSeed(), this.features.stagedConfig());
    container.querySelector('#btn-reset-seed')?.addEventListener('click', reset);
    container.querySelector('#btn-new-seed')?.addEventListener('click', () => {
      callbacks.onNewSeed(this.features.stagedConfig());
    });
    container.querySelector('#btn-save-world')?.addEventListener('click', () => {
      callbacks.onSaveFile();
    });
    container.querySelector<HTMLInputElement>('#input-load-file')?.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) callbacks.onLoadFile(file);
    });

    this.features = new FeaturesView(container, {
      onLiveChange: (cfg) => callbacks.onConfigChange(cfg),
      onApplyNewWorld: reset,
    }, config);
  }

  /** The host's config arrived (a change by any viewer, a new world, or a reconnect). */
  public sync(config: Readonly<SimulationConfig>): void {
    // Show a new world's seed, but leave a seed the user typed alone across reconnects.
    if (config.seed !== this.worldSeed) {
      this.worldSeed = config.seed;
      this.seedInput.value = String(config.seed);
    }
    this.features.sync(config);
  }

  /** A command was refused or lost: drop switch changes the host never confirmed. */
  public commandFailed(): void {
    this.features.dropPending();
  }
}
