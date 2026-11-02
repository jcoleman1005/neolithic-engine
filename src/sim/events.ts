import type { World } from './world';

/**
 * World events for the feed and chronicle.
 * Read-only observer; draws no random numbers and changes no outcome.
 */
export type WorldEventBody =
  | { readonly kind: 'year'; readonly year: number }
  | { readonly kind: 'populationRecord'; readonly population: number }
  | { readonly kind: 'extinction' }
  | {
      readonly kind: 'chronicle';
      readonly type: ChronicleType;
      readonly text: string;
      /** Camera priority: 4 battle, 3 split or new band, 2 leader death, 1 migration, 0 ticker only. */
      readonly priority: number;
      readonly x: number;
      readonly y: number;
      /** Key of the band the entry is about; 0 for the whole world. */
      readonly band: number;
    };

export type ChronicleType = 'battle' | 'split' | 'founded' | 'leaderDeath' | 'migration' | 'famine' | 'boom';

export type WorldEvent = WorldEventBody & { readonly seq: number; readonly tick: number };

export const EVENT_LOG_SIZE = 100;

export class WorldEventDetector {
  private nextSeq = 1;

  constructor(recentEvents: readonly WorldEvent[] = []) {
    if (recentEvents.length > 0) {
      this.nextSeq = Math.max(...recentEvents.map((e) => e.seq)) + 1;
    }
  }

  /** Stamps a body from another observer with the next sequence number. */
  public stamp(world: World, body: WorldEventBody): WorldEvent {
    return { ...body, seq: this.nextSeq++, tick: world.tick };
  }

  /**
   * The ticker shows chronicle entries only, so the plain "year begins" and "population
   * reaches N" notes are no longer recorded (they also crowded the 100-entry log).
   */
  public record(_world: World): WorldEvent[] {
    return [];
  }
}
