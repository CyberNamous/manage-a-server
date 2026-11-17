// Presentation of servers: the shop, the fleet list and the per-server window (diagnostics, maintenance,
// upgrades, history). Numbers come from systems/; this file only formats them.
import { BALANCE, TIERS } from '../data/tiers.js';
import { SERVERS } from '../data/servers.js';
import { UPGRADES, LIMITS } from '../data/upgrades.js';
import { MAINTENANCE, MAINT, FAULT_BY_ID, conditionLevel } from '../data/maintenance.js';
import { serverStats, upgradeLevel, maxLevel, isBusy, knownFaults, conditionRisk, upgradeEffect } from '../systems/hardware.js';
import { serviceAllPlan, maintenanceStatus, upgradeStatus, previewUpgrade, serviceImpact, recommendation, serverLabel } from '../systems/maintenance.js';
import { capacity } from '../systems/capacity.js';
import { money, signedMoney, escapeHTML as esc, gameTime, ageText, hoursText, button } from './format.js';
const TONE = { gain: 'good', warning: 'fair', loss: 'bad' };
export const failureLabel = model => model.failure < 0.5 ? 'Very reliable' : model.failure < 1.2 ? 'Reliable' : 'Fails more often';
const pips = (level, max) => `<span class="pips" aria-hidden="true">${'●'.repeat(level)}${'○'.repeat(Math.max(0, max - level))}</span>`;
const tierName = tier => TIERS[tier - 1]?.name || `Tier ${tier}`;
export function conditionChip(item) { const level = conditionLevel(item.condition); return `<span class="chip ${TONE[level.tone]}">${level.label}</span>`; }
function statusChips(s, item) {
  return `${conditionChip(item)}${isBusy(s, item) ? `<span class="chip busy">${esc(item.busyLabel || 'Busy')}</span>` : ''}${knownFaults(item).length ? `<span class="chip bad">${knownFaults(item).length} fault${knownFaults(item).length > 1 ? 's' : ''}</span>` : ''}`;
}
// ---- Shop: the existing server types, now with reliability and upgrade limits ----
export function shopCards(s) {
  return SERVERS.map(model => {
    const locked = s.tier < model.tier, owned = s.servers.filter(item => item.id === model.id).length, limit = LIMITS[model.id];
    return `<article class="card"><div class="row"><h3>${model.name}<span class="card-label">${model.label}</span></h3><span class="tag">${owned} owned</span></div><p>${model.description}</p>
    <dl class="spec-grid"><div><dt>Capacity</dt><dd>${model.capacity}</dd></div><div><dt>Power</dt><dd>${model.power} kW</dd></div><div><dt>Reliability</dt><dd>${failureLabel(model)}</dd></div><div><dt>Power bill</dt><dd>${money(model.power * BALANCE.powerPrice, true)}/h</dd></div></dl>
    <div class="specs">Upgrades to level ${Math.max(...Object.values(limit))}${limit.nic === 0 ? ' · no network upgrade' : ''}${limit.cooling === 1 ? ' · pre-cooled' : ''}</div>
    <div class="card-bottom"><strong class="price-tag">${money(model.cost)}</strong>${button('buy', model.id, locked ? `Tier ${model.tier}` : '+ Install', locked || s.cash < model.cost || s.servers.length >= BALANCE.maxServers[s.tier], `Buy a ${model.name.toLowerCase()} server. ${model.description}`)}</div></article>`;
  }).join('');
}
// ---- Fleet: every installed server with its condition, so problems are visible at a glance ----
export function fleetHTML(s) {
  const cap = capacity(s), avg = s.servers.reduce((sum, item) => sum + item.condition, 0) / Math.max(1, s.servers.length);
  const attention = s.servers.filter(item => ['poor', 'critical'].includes(conditionLevel(item.condition).id) || knownFaults(item).length).length;
  const summary = `<p class="fleet-summary"><strong>${s.servers.length}</strong> of ${BALANCE.maxServers[s.tier]} slots · ${cap.installed.toFixed(1)} capacity · ${cap.power.toFixed(2)} kW · average condition <strong>${conditionLevel(avg).label}</strong>${attention ? ` · <span class="warning">${attention} need${attention === 1 ? 's' : ''} attention</span>` : ''}</p>`;
  const plan = serviceAllPlan(s);
  const all = s.tier >= 1 && plan.needy ? `<div class="service-all"><div><strong>Service all</strong><small>${plan.todo.length ? `${plan.todo.length} of ${plan.needy} servers needing care can go now (${money(plan.cost)}).` : 'Servers need care, but not safely right now.'}${plan.waiting.length ? ` ${plan.waiting.length} wait so customers keep service.` : ''}${plan.broke.length ? ' Some need more cash.' : ''}</small></div>${button('service-all', 'all', `Service ${plan.todo.length || 'all'}`, !plan.todo.length, 'Routine maintenance on servers in need, worst first, without cutting customer service')}</div>` : '';
  const rows = s.servers.map((item, index) => {
    const st = serverStats(item), installed = UPGRADES.filter(u => upgradeLevel(item, u.id) > 0);
    return `<article class="fleet-row"><div class="fleet-main"><div class="fleet-title"><strong>#${item.uid} ${st.model.name}</strong>${statusChips(s, item)}</div>
    <small>${st.capacity.toFixed(1)} capacity · ${st.power.toFixed(2)} kW · age ${ageText(item.age)}</small>
    <small class="fleet-upgrades">${installed.length ? installed.map(u => `${u.short} ${pips(upgradeLevel(item, u.id), maxLevel(item, u.id))}`).join(' · ') : 'No upgrades yet'}</small></div>
    ${button('server', index, 'Manage', false, `Inspect, maintain and upgrade server #${item.uid}`)}</article>`;
  }).join('');
  return summary + all + rows;
}
// ---- The per-server window ----
function effectLine(u, level, item) {
  const model = serverStats(item).model, e = key => u.effects[key][level];
  if (!level) return 'Not installed';
  const pct = v => `${Math.round(v * 100)}%`;
  switch (u.id) {
    case 'cpu': return `+${pct(e('capacity'))} capacity (+${(model.capacity * e('capacity')).toFixed(1)} units)`;
    case 'ram': return `${pct(e('surge'))} of the traffic-surge capacity loss avoided`;
    case 'storage': return `${pct(e('recovery'))} shorter outages (fleet average)`;
    case 'cooling': return `${pct(e('thermal'))} slower heat build-up, ${pct(e('risk'))} fewer heat failures`;
    case 'power': return `${pct(e('power'))} less electricity`;
    default: return `${pct(e('netcost'))} lower per-unit network charges (fleet average)`;
  }
}
function reportHTML(s, item) {
  const r = item.report;
  if (!r) return '<p class="muted fine">No inspection on record. The badge shows the general state; an inspection reveals exact readings and hidden faults.</p>';
  const stale = s.hours - r.hour > MAINT.reportStaleHours, level = conditionLevel(r.condition);
  const snap = { ...item, condition: r.condition, thermal: r.thermal, faults: r.faults.map(id => ({ id })) };
  const riskPct = Math.round((conditionRisk(snap) - 1) * 100), rec = recommendation(s, item, { condition: r.condition, thermal: r.thermal, faults: r.faults });
  const cooling = r.thermal < 45 ? ['bad', `Cooling health ${Math.round(r.thermal)}%: heat is building up.`] : r.thermal < 70 ? ['fair', `Cooling health ${Math.round(r.thermal)}%: dust is accumulating.`] : ['good', `Cooling health ${Math.round(r.thermal)}%: healthy.`];
  const rows = [
    [TONE[level.tone], `General condition ${Math.round(r.condition)}% (${level.label}).`],
    cooling,
    ...(r.faults.length ? r.faults.map(id => ['bad', `Fault: ${FAULT_BY_ID[id].name}. ${FAULT_BY_ID[id].effect}`]) : [['good', 'No hardware faults detected.']]),
    level.capacity < 1 ? ['bad', `Performance: capacity reduced by ${Math.round((1 - level.capacity) * 100)}% from poor condition.`] : ['good', 'Performance: no limitations.'],
    [riskPct > 15 ? 'bad' : riskPct > 0 ? 'fair' : 'good', `Incident risk for this server: ${riskPct === 0 ? 'baseline' : riskPct > 0 ? `${riskPct}% above baseline` : `${-riskPct}% below baseline`}.`],
  ];
  return `<p class="fine ${stale ? 'warning' : 'muted'}">Inspected ${gameTime(r.hour)} · ${s.hours - r.hour < 0.05 ? 'just now' : `${hoursText(s.hours - r.hour)} ago`}${stale ? '. Readings may be out of date.' : '.'}</p><ul class="findings">${rows.map(([tone, text]) => `<li class="${tone}">${esc(text)}</li>`).join('')}</ul><p class="recommend"><strong>Recommendation:</strong> ${esc(rec.text)}</p>`;
}
function maintenanceEffects(a) {
  const parts = [];
  if (a.condition) parts.push(`+${a.condition} condition`);
  if (a.thermal >= 100) parts.push('cooling restored to full'); else if (a.thermal) parts.push(`+${a.thermal} cooling health`);
  if (a.clears === 'known') parts.push('fixes found faults'); else if (a.clears === 'all') parts.push('clears every fault'); else if (Array.isArray(a.clears)) parts.push('replaces a failing fan');
  return parts.join(' · ');
}
function logHTML(item) {
  if (!item.log.length) return '<p class="muted fine">No work recorded yet.</p>';
  const names = Object.fromEntries(MAINTENANCE.map(a => [a.id, a.name]));
  return item.log.slice().reverse().map(e => {
    const title = e.kind === 'upgrade' ? `${UPGRADES.find(u => u.id === e.ref)?.name || 'Upgrade'} · level ${e.level}` : e.kind === 'incident' ? `${e.ref === 'heat' ? 'Heat warning' : 'Hardware failure'} damaged the server` : names[e.kind] || e.kind;
    const fixed = e.ref && !['upgrade', 'incident'].includes(e.kind) ? ` · cleared ${e.ref.split(',').map(id => FAULT_BY_ID[id]?.name.toLowerCase()).filter(Boolean).join(', ')}` : '';
    const change = e.kind === 'upgrade' || e.kind === 'inspect' ? '' : ` · condition ${Math.round(e.before)}% → ${Math.round(e.after)}%`;
    return `<div class="log-row"><span class="feed-time">${gameTime(e.hour)}</span><span>${esc(title)}${esc(fixed)}${change}${e.cost ? ` · ${money(e.cost)}` : ''}</span></div>`;
  }).join('');
}
export function serverTitle(s, index) { const item = s.servers[index]; return item ? `Server #${item.uid} · ${serverStats(item).model.name}` : 'Server'; }
export function serverDetailHTML(s, index) {
  const item = s.servers[index];
  if (!item) return '<p>This server is no longer installed.</p>';
  const st = serverStats(item), cpu = upgradeEffect(item, 'cpu', 'capacity'), eff = upgradeEffect(item, 'power', 'power'), busy = isBusy(s, item);
  const impact = serviceImpact(s, item, 1), faults = knownFaults(item);
  const capNote = [`base ${st.baseCapacity}`, cpu ? `+${Math.round(cpu * 100)}% CPU` : '', st.level.capacity < 1 ? `−${Math.round((1 - st.level.capacity) * 100)}% poor condition` : ''].filter(Boolean).join(', ');
  const inspect = maintenanceStatus(s, item, MAINTENANCE[0]);
  const actions = MAINTENANCE.slice(1).map(action => {
    const status = maintenanceStatus(s, item, action), locked = s.tier < action.tier;
    return `<div class="action-row${locked ? ' locked' : ''}"><div><div class="row-title"><strong>${action.name}</strong><span class="tag">${locked ? tierName(action.tier) : money(status.cost)}${action.perFault ? ' per fault' : ''}</span></div><p>${action.description}</p>
    <small>${locked ? `Unlocks at ${tierName(action.tier)}` : `Offline ${action.downtime}h · ${maintenanceEffects(action)}`}</small>${status.reason && !locked ? `<small class="warning">${esc(status.reason)}</small>` : ''}</div>${button('maintain', `${index}:${action.id}`, 'Start', !status.ok, `${action.name} for ${money(status.cost)}`, 'primary')}</div>`;
  }).join('');
  const upgradeRows = UPGRADES.map(u => {
    const status = upgradeStatus(s, item, u.id), level = status.level, max = status.cap, locked = s.tier < u.tier;
    if (locked) return `<div class="action-row locked"><div><div class="row-title"><strong>${u.name}</strong><span class="tag">${tierName(u.tier)}</span></div><p>${u.purpose}</p><small>Unlocks at ${tierName(u.tier)}</small></div></div>`;
    if (max === 0) return `<div class="action-row locked"><div><div class="row-title"><strong>${u.name}</strong><span class="tag">Incompatible</span></div><p>${u.purpose}</p><small>${esc(status.reason)}</small></div></div>`;
    const preview = level < max ? previewUpgrade(s, item, u.id) : null;
    const next = level < max ? effectLine(u, status.next, item) : '';
    const money_ = preview && Math.abs(preview.profitGain) > 0.0005 ? ` · saves ${money(preview.profitGain, true)}/h${preview.profitGain > 0 ? ` (pays back in about ${Math.ceil(preview.cost / preview.profitGain)}h)` : ''}` : '';
    return `<div class="action-row"><div><div class="row-title"><strong>${u.name}</strong>${pips(level, max)}${level < max ? `<span class="tag">${money(status.cost)}</span>` : ''}</div><p>${u.purpose}</p>
    <small>Now: ${esc(effectLine(u, level, item))}</small>${next ? `<small class="next-level">Level ${status.next}: ${esc(next)}${esc(money_)}</small><small>Install takes ${u.installHours}h offline.</small>` : ''}${status.reason ? `<small class="warning">${esc(status.reason)}</small>` : ''}</div>
    ${level < max ? button('upgrade', `${index}:${u.id}`, `Install L${status.next}`, !status.ok, `${u.name} level ${status.next} for ${money(status.cost)}`, 'primary') : '<span class="tag installed">✓ Max</span>'}</div>`;
  }).join('');
  return `<div class="server-detail"><nav class="jump" aria-label="Jump to a section">${[['diag-h', 'Diagnostics'], ['maint-h', 'Maintenance'], ['up-h', 'Upgrades'], ['log-h', 'History']].map(([id, label]) => `<button data-action="jump" data-value="${id}" class="filter-chip">${label}</button>`).join('')}</nav>
  <div class="kv-grid"><div><span>Capacity</span><strong>${st.capacity.toFixed(1)}</strong><small>${capNote}</small></div>
  <div><span>Power</span><strong>${st.power.toFixed(2)} kW</strong><small>${eff ? `−${Math.round(eff * 100)}% efficiency upgrade` : `${money(st.power * BALANCE.powerPrice, true)}/h base`}</small></div>
  <div><span>Condition</span><strong>${conditionChip(item)}</strong><small>${busy ? esc(item.busyLabel) + ` · back in ${hoursText(item.busyUntil - s.hours)}` : st.level.risk > 1 ? 'Raises failure risk' : 'Healthy'}</small></div>
  <div><span>Age & reliability</span><strong>${ageText(item.age)}</strong><small>${failureLabel(st.model)}; older units fail more often</small></div></div>
  <section aria-labelledby="diag-h"><h3 id="diag-h">Diagnostics</h3>
    ${faults.length && !item.report ? `<ul class="findings">${faults.map(f => `<li class="bad">Known fault: ${FAULT_BY_ID[f.id].name}. ${FAULT_BY_ID[f.id].effect}</li>`).join('')}</ul>` : ''}
    ${reportHTML(s, item)}
    <div class="action-row"><div><div class="row-title"><strong>${MAINTENANCE[0].name}</strong><span class="tag">${money(inspect.cost)}</span></div><p>${MAINTENANCE[0].description}</p>${inspect.reason ? `<small class="warning">${esc(inspect.reason)}</small>` : ''}</div>${button('maintain', `${index}:inspect`, 'Inspect', !inspect.ok, `Inspect this server for ${money(inspect.cost)}`, 'primary')}</div></section>
  <section aria-labelledby="maint-h"><h3 id="maint-h">Maintenance</h3>
    <p class="${impact.loss > 0.005 ? 'warning' : 'muted'} fine">${impact.loss > 0.005 ? `⚠ Taking this server offline cuts customer service by about ${Math.round(impact.loss * 100)}% while it is away, which costs income and reputation. Prefer a quiet moment or add spare capacity first.` : '✓ Spare capacity covers this server while it is offline.'}</p>${actions}</section>
  <section aria-labelledby="up-h"><h3 id="up-h">Hardware upgrades</h3><p class="muted fine">Optional improvements for this server only. Each has its own purpose and a level limit. ${impact.loss > 0.005 ? '<span class="warning">Installing takes this server offline briefly, so customers would lose service. Planned downtime costs income but little trust.</span>' : 'Installing takes the server offline briefly; spare capacity covers it.'}</p>${upgradeRows}</section>
  <section aria-labelledby="log-h"><h3 id="log-h">Service history</h3>${logHTML(item)}</section></div>`;
}
export { serverLabel, signedMoney };
