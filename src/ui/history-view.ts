import type { HistorySample } from '../sim/history';

export class HistoryView {
  constructor(private readonly container: HTMLElement) {}

  public render(samples: readonly HistorySample[]): void {
    if (samples.length === 0) {
      this.container.innerHTML = '<p class="hint">No history recorded yet.</p>';
      return;
    }

    const latest = samples[samples.length - 1];
    this.container.innerHTML = `
      <div class="history-summary">
        <h4>History (${samples.length} samples)</h4>
        <p>Current: Year ${latest.year}, Tick ${latest.tick}, Population ${latest.population}</p>
      </div>
    `;
  }
}
