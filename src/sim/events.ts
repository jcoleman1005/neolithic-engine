import type { World } from './world';

/**
 * World events for the feed and chronicle.
 * Read-only observer; draws no random numbers and changes no outcome.
 */
export type WorldEventBody =
  | { readonly kind: 'year'; readonly year: number }
  | { readonly kind: 'populationRecord'; readonly population: number }
  | { readonly kind: 'extinction' };

export type WorldEvent = WorldEventBody & { readonly seq: number; readonly tick: number };

export const EVENT_LOG_SIZE = 100;

export class WorldEventDetector {
  private nextSeq = 1;
  private lastYear = 0;
  private peakPopulation = 0;

  constructor(recentEvents: readonly WorldEvent[] = []) {
    if (recentEvents.length > 0) {
      this.nextSeq = Math.max(...recentEvents.map((e) => e.seq)) + 1;
    }
  }

  public record(world: World): WorldEvent[] {
    const events: WorldEvent[] = [];
    const year = Math.floor(world.tick / (world.config.ticksPerYear || 360));

    if (year > this.lastYear) {
      this.lastYear = year;
      events.push({
        seq: this.nextSeq++,
        tick: world.tick,
        kind: 'year',
        year,
      });
    }

    const pop = world.population;
    if (pop > this.peakPopulation && pop >= 10) {
      this.peakPopulation = pop;
      events.push({
        seq: this.nextSeq++,
        tick: world.tick,
        kind: 'populationRecord',
        population: pop,
      });
    }

    return events;
  }
}
