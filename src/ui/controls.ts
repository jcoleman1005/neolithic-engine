import type { SimulationConfig } from '../sim/types';

export interface PlaybackCallbacks {
  onPlayPause: () => void;
  onStep: () => void;
  onSpeedChange: (speedMultiplier: number) => void;
}

export interface SettingsCallbacks {
  onReset: (seed: string | number) => void;
  onNewSeed: () => void;
  onSaveFile: () => void;
  onLoadFile: (file: File) => void;
  onConfigChange: (config: Partial<SimulationConfig>) => void;
}

export class PlaybackPill {
  private readonly playBtn: HTMLButtonElement;
  private readonly stepBtn: HTMLButtonElement;
  private readonly speedSelect: HTMLSelectElement;

  constructor(container: HTMLElement, callbacks: PlaybackCallbacks) {
    container.innerHTML = `
      <div class="playback-pill">
        <button id="btn-play" class="pill-btn" aria-label="Play or pause">Play</button>
        <button id="btn-step" class="pill-btn" aria-label="Step one tick">Step</button>
        <select id="select-speed" class="pill-select" aria-label="Speed">
          <option value="0.33">⅓×</option>
          <option value="1" selected>1×</option>
          <option value="3">3×</option>
          <option value="10">10×</option>
        </select>
      </div>
    `;

    this.playBtn = container.querySelector('#btn-play')!;
    this.stepBtn = container.querySelector('#btn-step')!;
    this.speedSelect = container.querySelector('#select-speed')!;

    this.playBtn.addEventListener('click', () => callbacks.onPlayPause());
    this.stepBtn.addEventListener('click', () => callbacks.onStep());
    this.speedSelect.addEventListener('change', () => {
      callbacks.onSpeedChange(parseFloat(this.speedSelect.value));
    });
  }

  public update(running: boolean, _tps: number): void {
    this.playBtn.textContent = running ? 'Pause' : 'Play';
    this.stepBtn.disabled = running;
  }
}

export class SettingsView {
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
    container.querySelector('#btn-reset-seed')?.addEventListener('click', () => {
      callbacks.onReset(parseInt(seedInput.value, 10) || 42);
    });
    container.querySelector('#btn-new-seed')?.addEventListener('click', () => {
      callbacks.onNewSeed();
    });
    container.querySelector('#btn-save-world')?.addEventListener('click', () => {
      callbacks.onSaveFile();
    });
    container.querySelector<HTMLInputElement>('#input-load-file')?.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) callbacks.onLoadFile(file);
    });
  }
}
