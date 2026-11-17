// Finance and reputation windows. Revenue, operating expenses and net profit are kept visibly separate,
// and one-off spending is listed on its own so nothing is counted twice.
import { economy } from '../systems/economy.js';
import { capacity } from '../systems/capacity.js';
import { reputationReport } from '../systems/reputation.js';
import { goalProgress } from '../systems/unlocks.js';
import { OPEX_KEYS, OPEX_LABELS, SPEND_KEYS, SPEND_LABELS, totals } from '../systems/ledger.js';
import { BALANCE } from '../data/tiers.js';
import { money, signedMoney, escapeHTML as esc, gameTime } from './format.js';
const row = (label, value, cls = '') => `<div class="fin-row ${cls}"><span>${label}</span><span class="mono">${value}</span></div>`;
export function financeHTML(s) {
  const e = economy(s), cap = capacity(s), t = totals(s.books), b = s.books;
  const debt = s.loans.reduce((sum, loan) => sum + loan.remaining, 0);
  return `<div class="fin">
  ${row('Cash on hand', `<strong>${money(s.cash, true)}</strong>`, 'fin-total')}
  ${debt > 0 ? row('Loan principal still owed', money(debt, true)) : ''}
  <h3>Every game hour</h3>
  ${row(`Revenue <small>(${money(e.contractRevenue, true)} contracts × ${Math.round(cap.service * 100)}% service)</small>`, `${money(e.revenue, true)}/h`, 'gain')}
  ${OPEX_KEYS.map(k => row(`${OPEX_LABELS[k]}`, `−${money(e[k], true)}/h`)).join('')}
  ${row('Operating expenses', `−${money(e.costs, true)}/h`, 'fin-sub')}
  ${row('Net operating profit', `${signedMoney(e.profit, true)}/h`, `fin-total ${e.profit >= 0 ? 'gain' : 'loss'}`)}
  <p class="fine muted">Operating costs are charged automatically every hour. Hardware, upgrades and maintenance are one-off purchases and are listed below, not in the hourly figures.</p>
  <h3>One-off spending</h3>
  ${SPEND_KEYS.map(k => row(SPEND_LABELS[k], money(b.oneOff[k], true))).join('')}
  ${row('Total one-off spending', money(t.oneOff, true), 'fin-sub')}
  <h3>Totals${b.since > 0 ? ` since ${gameTime(b.since).split(' · ')[0].toLowerCase()}` : ''}</h3>
  ${row('Revenue earned', money(b.revenue, true), 'gain')}
  ${row('Operating expenses paid', `−${money(t.opex, true)}`)}
  ${row('One-off spending', `−${money(t.oneOff, true)}`)}
  ${row('Net result', signedMoney(t.net, true), `fin-total ${t.net >= 0 ? 'gain' : 'loss'}`)}
  ${b.borrowed || b.repaidEarly ? `<p class="fine muted">Borrowed ${money(b.borrowed)} and repaid early ${money(b.repaidEarly)}. Loans are financing, not revenue, so they are not part of the net result.</p>` : ''}
  ${b.since > 0 ? '<p class="fine muted">Detailed totals began when this save was upgraded to Update 1.</p>' : ''}
  </div>`;
}
export function reputationHTML(s) {
  const r = reputationReport(s), info = goalProgress(s), goal = info.goals?.find(g => g.key === 'reputation');
  const trend = r.rate > 0 ? `Right now trust is <strong class="gain">rising about +${r.rate.toFixed(2)} per game hour</strong> because every customer is fully served.` : r.rate < 0 ? `Right now trust is <strong class="loss">falling about ${Math.abs(r.rate).toFixed(1)} per game hour</strong> ${r.planned ? 'during scheduled maintenance' : 'because service is interrupted'} (${Math.round(r.service * 100)}% delivered).` : 'Right now trust is steady: you have no customers to serve yet.';
  const fmt = v => Math.abs(v) < 0.05 ? '—' : `${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}`;
  const cls = v => Math.abs(v) < 0.05 ? 'muted' : v > 0 ? 'gain' : 'loss';
  return `<div class="rep">
  <p class="rep-score"><strong class="mono">${s.reputation.toFixed(1)}</strong> <span class="muted">/ ${BALANCE.reputationMax}</span></p>
  <p>${trend}${r.strained ? ` <span class="warning">${r.strained} customer${r.strained > 1 ? 's are' : ' is'} under strain and may leave if service stays below their promise.</span>` : ''}</p>
  ${goal ? `<p class="fine muted">Next chapter needs ${goal.target} reputation (${goal.value.toFixed(1)} now).</p>` : ''}
  <h3>Why it moved</h3>
  <p class="fine muted">Recent = last ${Math.max(1, Math.round(r.windowHours))} game hour${Math.round(r.windowHours) === 1 ? '' : 's'}. Every number comes from the real simulation.</p>
  ${r.rows.map(x => `<div class="rep-row"><div><strong>${esc(x.label)}</strong><small>${esc(x.text)}</small></div><div class="rep-nums"><span class="mono ${cls(x.recent)}">${fmt(x.recent)}</span><small>recent</small><span class="mono ${cls(x.total)}">${fmt(x.total)}</span><small>all time</small></div></div>`).join('')}
  </div>`;
}
