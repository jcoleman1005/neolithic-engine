import type { SimulationConfig } from '../sim/types';

export class InspectorView {
  constructor(private readonly container: HTMLElement) {}

  public render(config: Readonly<SimulationConfig>, selectedId: string | null = null): void {
    if (!selectedId) {
      this.container.innerHTML = `
        <div class="inspector-empty">
          <p class="hint">No person selected.</p>
          <div class="summary-pill">
            <span class="pill-title">World Size</span>
            <span class="pill-value">${config.worldWidth} × ${config.worldHeight}</span>
          </div>
          <div class="summary-pill">
            <span class="pill-title">Edges</span>
            <span class="pill-value">${config.wrapping ? 'Wrapping' : 'Bounded'}</span>
          </div>
          <div class="summary-pill">
            <span class="pill-title">Pace</span>
            <span class="pill-value">${config.ticksPerYear} ticks / year</span>
          </div>
        </div>
      `;
      return;
    }

    this.container.innerHTML = `
      <div class="inspector-person">
        <h3>Person ${selectedId}</h3>
      </div>
    `;
  }

  public clear(): void {
    this.container.innerHTML = '<div class="inspector-empty"><p class="hint">Nothing selected.</p></div>';
  }
}
