import type { SettlementView } from '../sim/settlements';
import { TIER_NAMES } from '../sim/settlements';

const LIST_CAP = 12;

const title = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** The largest settlements, for the Stats tab. Each row selects its settlement. */
export function settlementListHTML(settlements: readonly SettlementView[]): string {
  if (settlements.length === 0) return '<p class="hint">No settlements yet.</p>';
  const rows = settlements.slice(0, LIST_CAP).map((s) => `
    <li><button type="button" class="settlement-row" data-settlement="${s.id}">
      <span class="settlement-name">${escapeHtml(s.name)}</span>
      <span class="settlement-meta">${title(TIER_NAMES[s.tier])} · ${s.residents} people</span>
    </button></li>`);
  const more = settlements.length > LIST_CAP ? `<p class="hint">and ${settlements.length - LIST_CAP} more</p>` : '';
  return `<ul class="settlement-list">${rows.join('')}</ul>${more}`;
}

/** The card for a tapped settlement, in the Inspector tab. */
export function settlementCardHTML(s: SettlementView, tick: number, ticksPerYear: number): string {
  const year = (t: number): number => Math.floor(t / ticksPerYear);
  const history = s.history
    .map(([t, tier]) => `<li>Year ${year(t)}: ${tier === 0 ? 'first camp here' : `became a ${TIER_NAMES[tier]}`}</li>`)
    .join('');
  const pill = (name: string, value: string | number): string =>
    `<div class="summary-pill"><span class="pill-title">${name}</span><span class="pill-value">${value}</span></div>`;
  return `
    <div class="settlement-card">
      <h3 class="panel-heading">${escapeHtml(s.name)}</h3>
      ${pill('Size', title(TIER_NAMES[s.tier]))}
      ${pill('Founded', `Year ${year(s.foundedTick)} (${year(tick - s.foundedTick)} years ago)`)}
      ${pill('People', s.residents)}
      ${pill('Built cells', s.built)}
      ${pill('Stored food', s.stores)}
      ${pill('Stored water', s.water ?? 0)}
      <h3 class="panel-heading">History</h3>
      <ul class="settlement-history">${history}</ul>
    </div>`;
}

export function settlementGoneHTML(): string {
  return '<p class="hint">This settlement no longer stands. Tap another, or tap any person.</p>';
}
