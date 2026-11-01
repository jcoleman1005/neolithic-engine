import type { WorldEvent } from '../sim/events';

export interface EventLine {
  readonly text: string;
  readonly colour: string;
}

export function describeEvent(e: WorldEvent): EventLine {
  switch (e.kind) {
    case 'year':
      return { text: `Year ${e.year} begins`, colour: '#86efac' };
    case 'populationRecord':
      return { text: `Population reaches ${e.population}`, colour: '#38bdf8' };
    case 'extinction':
      return { text: 'All people have died', colour: '#f87171' };
    default:
      return { text: 'Event occurred', colour: '#94a3b8' };
  }
}

export function latestEventHTML(events: readonly WorldEvent[]): string {
  if (events.length === 0) return '<span class="event-empty">The world is quiet.</span>';
  const last = events[events.length - 1];
  const { text, colour } = describeEvent(last);
  return `<span class="event-dot" style="background: ${colour}"></span><span class="event-text">${text}</span>`;
}

export function eventListHTML(events: readonly WorldEvent[]): string {
  if (events.length === 0) return '<li class="event-empty">No events yet.</li>';
  return events
    .slice()
    .reverse()
    .map((e) => {
      const { text, colour } = describeEvent(e);
      return `<li class="event-row"><span class="event-tick">Tick ${e.tick}</span><span class="event-dot" style="background: ${colour}"></span><span class="event-text">${text}</span></li>`;
    })
    .join('');
}
