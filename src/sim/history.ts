import type { WorldMetrics } from './types';

export interface HistorySample {
  readonly tick: number;
  readonly year: number;
  readonly population: number;
}

export class HistoryTracker {
  private samples: HistorySample[] = [];

  constructor(existing: readonly HistorySample[] = []) {
    this.samples = [...existing];
  }

  public record(metrics: WorldMetrics): void {
    this.samples.push({
      tick: metrics.tick,
      year: metrics.year,
      population: metrics.population,
    });
  }

  public getSamples(): readonly HistorySample[] {
    return this.samples;
  }

  public toCSV(): string {
    const lines = ['tick,year,population'];
    for (const s of this.samples) {
      lines.push(`${s.tick},${s.year},${s.population}`);
    }
    return lines.join('\n');
  }

  public clear(): void {
    this.samples = [];
  }
}
