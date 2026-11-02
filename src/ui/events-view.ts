import type { ChronicleType, WorldEvent } from '../sim/events';

export interface EventLine {
  readonly text: string;
  readonly colour: string;
}

const CHRONICLE_COLOURS: Record<ChronicleType, string> = {
  battle: '#f87171',
  split: '#fbbf24',
  founded: '#fbbf24',
  leaderDeath: '#c4b5fd',
  migration: '#67e8f9',
  famine: '#fb923c',
  boom: '#86efac',
};

/** Only chronicle entries (and extinction) reach the ticker; older saves may still hold others. */
function isTickerEvent(e: WorldEvent): boolean {
  return e.kind === 'chronicle' || e.kind === 'extinction';
}

export function describeEvent(e: WorldEvent): EventLine {
  switch (e.kind) {
    case 'chronicle':
      return { text: e.text, colour: CHRONICLE_COLOURS[e.type] };
    case 'extinction':
      return { text: 'All people have died', colour: '#f87171' };
    default:
      return { text: 'Event occurred', colour: '#94a3b8' };
  }
}

export function latestEventHTML(events: readonly WorldEvent[]): string {
  const shown = events.filter(isTickerEvent);
  if (shown.length === 0) return '<span class="event-empty">The world is quiet.</span>';
  const last = shown[shown.length - 1];
  const { text, colour } = describeEvent(last);
  return `<span class="event-dot" style="background: ${colour}"></span><span class="event-text">${text}</span>`;
}

export function eventListHTML(events: readonly WorldEvent[], ticksPerYear = 360): string {
  const shown = events.filter(isTickerEvent);
  if (shown.length === 0) return '<li class="event-empty">Nothing has happened yet.</li>';
  return shown
    .slice()
    .reverse()
    .map((e) => {
      const { text, colour } = describeEvent(e);
      const year = Math.floor(e.tick / ticksPerYear);
      return `<li class="event-row"><span class="event-tick">Year ${year}</span><span class="event-dot" style="background: ${colour}"></span><span class="event-text">${text}</span></li>`;
    })
    .join('');
}
