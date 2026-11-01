import type { WorldMetrics } from '../sim/types';

export class MetricsView {
  constructor(private readonly container: HTMLElement) {}

  public render(metrics: WorldMetrics): void {
    const { tick, year, population, bandCount, largestBand } = metrics;
    this.container.innerHTML = `
      <div class="metrics-grid">
        <div class="metric-card">
          <span class="m-label">Year</span>
          <span class="m-val">${year}</span>
        </div>
        <div class="metric-card">
          <span class="m-label">Tick</span>
          <span class="m-val">${tick}</span>
        </div>
        <div class="metric-card">
          <span class="m-label">Population</span>
          <span class="m-val">${population}</span>
        </div>
        <div class="metric-card">
          <span class="m-label">Bands</span>
          <span class="m-val">${bandCount ?? 0}</span>
        </div>
        <div class="metric-card">
          <span class="m-label">Largest Band</span>
          <span class="m-val">${largestBand ?? 0}</span>
        </div>
      </div>
    `;
  }
}
