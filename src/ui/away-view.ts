import type { WorldEvent } from '../sim/events';

/**
 * "While you were away": the chronicle entries logged since the viewer last
 * looked. The simulation keeps running on the server while the browser is
 * closed, and the host keeps the last 100 events, so a long absence may show
 * only the most recent part of the story.
 */
export interface AwayEntry {
  readonly text: string;
  readonly priority: number;
  readonly tick: number;
}

export interface AwaySummary {
  readonly entries: readonly AwayEntry[];
  /** Entries left out to keep the card short. */
  readonly more: number;
  readonly years: number;
}

export interface LastSeen {
  readonly seq: number;
  readonly tick: number;
}

const MAX_SHOWN = 8;
const KEY = 'neolithic.lastSeen';

export function summariseAway(
  events: readonly WorldEvent[],
  seen: LastSeen | null,
  ticksPerYear: number
): AwaySummary | null {
  if (!seen || events.length === 0) return null;
  const last = events[events.length - 1];
  // Numbers or time went backwards: this is a different world.
  if (last.seq < seen.seq || last.tick < seen.tick) return null;
  const fresh = events.filter((e) => e.seq > seen.seq);
  const chronicle = fresh.flatMap((e) => (e.kind === 'chronicle' ? [{ text: e.text, priority: e.priority, tick: e.tick }] : []));
  if (chronicle.length === 0) return null;
  // Keep the most important entries, then show them in the order they happened.
  const shown = chronicle
    .map((e, i) => ({ e, i }))
    .sort((a, b) => b.e.priority - a.e.priority || b.i - a.i)
    .slice(0, MAX_SHOWN)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.e);
  return {
    entries: shown,
    more: chronicle.length - shown.length,
    years: Math.max(0, Math.round((last.tick - seen.tick) / Math.max(1, ticksPerYear))),
  };
}

export function awayHTML(summary: AwaySummary): string {
  const rows = summary.entries.map((e) => `<li>${escapeHtml(e.text)}</li>`).join('');
  const more = summary.more > 0 ? `<p class="away-more">and ${summary.more} more in the ticker</p>` : '';
  const span = summary.years >= 1 ? `About ${summary.years} year${summary.years === 1 ? '' : 's'} passed.` : 'A little time passed.';
  return `<h3 class="away-title">While you were away</h3><p class="away-span">${span}</p><ul class="away-list">${rows}</ul>${more}<button type="button" class="away-close">Close</button>`;
}

export function readLastSeen(storage: Pick<Storage, 'getItem'> | null): LastSeen | null {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return null;
    const [seq, tick] = raw.split(':').map(Number);
    return Number.isFinite(seq) && Number.isFinite(tick) ? { seq, tick } : null;
  } catch {
    return null;
  }
}

export function writeLastSeen(storage: Pick<Storage, 'setItem'> | null, seen: LastSeen): void {
  try {
    storage?.setItem(KEY, `${seen.seq}:${seen.tick}`);
  } catch {
    // Storage can be blocked or full; the card simply won't appear next time.
  }
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
