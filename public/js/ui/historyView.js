// Event and incident history: what happened, what it affected, which response was chosen and how it ended.
import { escapeHTML as esc, gameTime, money } from './format.js';
export const FEED_FILTERS = [
  { id: 'all', label: 'All' }, { id: 'incident', label: 'Incidents' }, { id: 'maintenance', label: 'Hardware' },
  { id: 'decision', label: 'Decisions' }, { id: 'system', label: 'Progress' },
];
const OUTCOMES = { resolved: ['good', '✓ Resolved'], failed: ['bad', '✕ Failed'], absorbed: ['fair', '… Left unresolved'] };
export function feedMatches(item, filter) { return filter === 'all' || item.cat === filter; }
export function feedEntryHTML(item) {
  const d = item.d || {}, outcome = OUTCOMES[d.outcome];
  const facts = [d.affected ? `<div><dt>Affected</dt><dd>${esc(d.affected)}</dd></div>` : '', d.response ? `<div><dt>Response</dt><dd>${esc(d.response)}</dd></div>` : '',
    Number.isFinite(d.fee) && Number.isFinite(d.damage) ? `<div><dt>Response fee</dt><dd>${money(d.fee)}</dd></div><div><dt>Damage</dt><dd>${money(d.damage)}</dd></div>` : d.cost ? `<div><dt>Cost</dt><dd>${money(d.cost)}</dd></div>` : '', Number.isFinite(d.rep) && Math.abs(d.rep) >= 0.05 ? `<div><dt>Reputation</dt><dd class="${d.rep > 0 ? 'gain' : 'loss'}">${d.rep > 0 ? '+' : '−'}${Math.abs(d.rep).toFixed(1)}</dd></div>` : ''].join('');
  return `<span class="feed-time">${gameTime(item.hour)}</span>${outcome ? `<span class="chip ${outcome[0]}">${outcome[1]}</span>` : ''}<h3 class="${item.tone}">${esc(item.title)}</h3><p>${esc(item.why)}</p>${facts ? `<dl class="feed-facts">${facts}</dl>` : ''}${d.note ? `<p class="fine warning">${esc(d.note)}</p>` : ''}`;
}
