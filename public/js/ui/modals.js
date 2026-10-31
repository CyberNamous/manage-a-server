import { GAME_TITLE, AUTOSAVE_MS } from '../config.js';
import { BALANCE, TIERS } from '../data/tiers.js';
import { RARE_EFFECTS } from '../data/eventParts.js';
import { NETWORKS, LOCATIONS } from '../data/network.js';
import { LOANS, LENDING } from '../data/loans.js';
import { loanQuote } from '../systems/loanSystem.js';
import { goalProgress } from '../systems/unlocks.js';
import { money, escapeHTML, goalNumber } from './format.js';
let mode = null, previousFocus = null, onDismiss = null;
export function modalMode() { return mode; }
export function showModal(title, body, { kicker = 'YOUR OPERATOR DESK', kind = 'info', locked = false, dismiss = null } = {}) {
  const layer = document.getElementById('modal-layer');
  if (layer.hidden) previousFocus = document.activeElement;
  mode = kind; onDismiss = dismiss;
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-kicker').textContent = kicker;
  document.getElementById('modal-body').innerHTML = body;
  document.getElementById('modal-close').hidden = locked;
  layer.hidden = false; layer.dataset.locked = String(locked);
  for (const element of document.querySelectorAll('body > header, body > main, body > footer, body > nav, body > .stats, #tutorial')) { element.inert = true; element.setAttribute('aria-hidden', 'true'); }
  document.querySelector('.modal').focus();
}
export function closeModal(force = false) {
  const layer = document.getElementById('modal-layer');
  if (!force && layer.dataset.locked === 'true') return;
  layer.hidden = true; mode = null;
  for (const element of document.querySelectorAll('[inert]')) { element.inert = false; element.removeAttribute('aria-hidden'); }
  const dismiss = onDismiss; onDismiss = null; dismiss?.();
  if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
}
export function eventModal(s) {
  const e = s.activeEvent;
  const special = e.trigger.id === 'cablefund' ? `<p>A non-declining response can commit an additional ${money(RARE_EFFECTS.consortiumCost)} research pledge if you can afford it. This is not cable construction.</p>` : '';
  showModal(e.trigger.name.replace(/^./, ch => ch.toUpperCase()), `<p>${escapeHTML(e.text)}</p>${e.chain ? '<p class="warning">This is an escalation of a previously unresolved warning.</p>' : ''}<p class="fine">Simulation paused. Severity: ${e.severity.name.toLowerCase()}. Time resumes after your decision unless you manually paused.</p>${special}<div class="event-choices">${e.responses.map(r => `<button class="choice-button" data-action="respond" data-value="${r.id}" title="${escapeHTML(r.hint)}"><span class="choice-cost">${money(r.cost)}</span><strong>${escapeHTML(r.name)}</strong><small>${escapeHTML(r.hint)}</small></button>`).join('')}</div>`, { kind: 'event', locked: true, kicker: `${e.isRare ? 'RARE OPPORTUNITY' : 'DECISION REQUIRED'} · ${e.severity.name.toUpperCase()}` });
}
export function menuModal(s, theme) {
  showModal('A moment to plan.', `<div class="menu-grid"><button data-action="save" title="Save this run to this device">Save game</button><button data-action="load" title="Reload your last local save">Load saved game</button><button data-action="export" title="Create a portable copyable save code">Export save code</button><button data-action="import" title="Replace your run with a validated save code">Import save code</button><button data-action="help" title="Read the rules and strategy basics">How to play</button><button class="danger" data-action="reset" title="Start over after a confirmation">Reset game</button></div><h3>Appearance</h3><div class="theme-row">${['system','dark','light'].map(t=>`<button data-action="theme" data-value="${t}" aria-pressed="${theme === t}" title="Use ${t} color theme">${t[0].toUpperCase()+t.slice(1)}</button>`).join('')}</div><p class="fine">Autosaves every ${AUTOSAVE_MS / 1000} seconds and after important actions. Progress stays on this device unless you export it.</p><p class="fine">The simulation is paused while the operator desk is open.</p>`, { kind: 'menu' });
}
export function goalsModal(s) {
  const info = goalProgress(s);
  showModal(info.next?.locked ? 'You reached the v1 frontier.' : `Next: ${info.next.name}`, `<p>${escapeHTML(info.next?.description || 'All current chapters complete.')}</p>${info.goals.length ? `<div class="goal-list">${info.goals.map(g=>`<div class="goal-check"><span>${g.progress >= 1 ? '✓' : '○'} ${g.label}</span><strong>${goalNumber(g,g.value)} / ${goalNumber(g,g.target)}</strong></div>`).join('')}</div><p class="fine">Every requirement must be met together. Unlocks are earned, never timed.</p>` : '<p>You can keep running your Regional ISP. Chapters 4–6 are intentionally locked in this version.</p>'}`, { kind: 'goals' });
}
export function helpModal() {
  showModal(`Welcome to ${GAME_TITLE}`, `<p>Start with one used server and ${BALANCE.startCustomers} hobby sites. Buy capacity, sign customers, then choose a sustainable price. All figures are per simulated hour: ${1 / BALANCE.gameHoursPerSecond} real seconds is one game hour at 1× speed.</p><h3>Build → sign → price → grow</h3><p>Idle servers still use electricity. A higher price immediately increases contract income but makes new applications less likely to convert. Each successful onboarding costs ${money(BALANCE.customerSigningFee)}. An application is available every ${BALANCE.applicationCooldown} simulation seconds.</p><h3>Reliability earns your next chapter</h3><p>Trust rises slowly during reliable service. Backups reduce recovery time. Spare capacity unlocks event failover responses. Big clients demand more uptime, leave sooner after prolonged outages, and receive larger service credits.</p><h3>Make your own network</h3><p>At Tier 3, choose a permanent site and either usage-based transit or upfront peering. Normal loans charge monthly interest plus principal amortization; you may repay early. Emergency event loans are available earlier, but are expensive.</p><h3>No unattended disasters</h3><p>Decision events and hidden tabs pause the simulation. Coming back credits at most ${BALANCE.offlineCapSeconds} real seconds of positive profit at ${BALANCE.offlineProfitFraction * 100}% rate; no incident or loan repayment runs while you are away. Paused saves receive no catch-up.</p><h3>A way back</h3><p>If cash falls below ${money(BALANCE.insolvencyLimit)}, a restructuring returns you to the garage with ${money(BALANCE.recoveryCash)}, one server, hobby clients, no loans or leases, and lower reputation. You can recover, rather than getting trapped.</p><p class="help-shortcuts">Keyboard: Space pauses · 1 / 2 / 3 sets 1× / 2× / 5× · B Build · C Customers · M Menu · Escape closes ordinary windows. Every control also supports touch.</p><p class="fine">Local save storage can be cleared by your browser. Export a code to protect a run. All six chapters are shown; only the first three are playable in v1.</p>`, { kind: 'help' });
}
export function infrastructureModal(kind, id) {
  const entry = (kind === 'network' ? NETWORKS : LOCATIONS).find(item => item.id === id);
  if (!entry) return;
  showModal(`Commit to ${entry.name}?`, `<p>${escapeHTML(entry.description)}</p><p>This costs ${money(entry.cost)} now. ${kind === 'location' ? `Rent increases by ${money(entry.rent)}/h.` : ''} <strong>This cannot be changed until you reset or restructure the company.</strong></p><div class="row"><button data-action="close-modal" title="Keep comparing your options">Keep comparing</button><button class="primary" data-action="commit-${kind}" data-value="${entry.id}" title="Make this permanent infrastructure investment">Commit ${money(entry.cost)}</button></div>`, { kind: 'confirm' });
}
export function loanModal(id) {
  const loan = LOANS.find(item => item.id === id); if (!loan) return;
  const q = loanQuote(loan);
  showModal(`Borrow ${money(loan.principal)}?`, `<p>${escapeHTML(loan.name)} gives you ${money(loan.principal)} now.</p><p>Each game month you pay ${money(q.interest, true)} interest plus ${money(q.principal, true)} principal: <strong>${money(q.monthly, true)}/month</strong> for ${loan.termMonths} months. That is ${money(q.hourly, true)}/h. A game month is ${LENDING.hoursPerMonth} simulated hours.</p><p>Interest uses the original principal (a fixed add-on loan). You can repay the remaining principal early to stop future charges. Repayments run even when the business loses money.</p><button class="primary" data-action="commit-loan" data-value="${loan.id}" title="Accept the monthly repayment obligations">Accept loan</button>`, { kind: 'confirm' });
}
export function toast(message, error = false) {
  const item = document.createElement('div'); item.className = `toast${error ? ' error' : ''}`; item.textContent = message;
  document.getElementById('toasts').append(item); setTimeout(() => item.remove(), 4800);
}
export function setupModalKeyboard() {
  document.getElementById('modal-layer').addEventListener('pointerdown', event => { if (event.target.id === 'modal-layer') closeModal(); });
  document.addEventListener('keydown', event => {
    if (!mode) return;
    if (event.key === 'Escape') { event.preventDefault(); closeModal(); }
    if (event.key === 'Tab') {
      const focusable = [...document.querySelectorAll('.modal button:not([hidden]):not(:disabled), .modal textarea, .modal a[href]')].filter(e=>e.getClientRects().length);
      if (!focusable.length) { event.preventDefault(); return; }
      const first = focusable[0], last = focusable[focusable.length-1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement.classList.contains('modal'))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement.classList.contains('modal'))) { event.preventDefault(); first.focus(); }
    }
  });
}
