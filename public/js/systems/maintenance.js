// Server condition, diagnostics, maintenance actions and hardware upgrades (Update 1).
// Uses its own random stream (s.mrng) so the existing seeded event sequence is not disturbed.
import { serverType } from '../data/servers.js';
import { LOCATIONS } from '../data/network.js';
import { UPGRADES, UPGRADE_BY_ID, LIMIT_NOTES } from '../data/upgrades.js';
import { MAINT, MAINTENANCE, MAINT_BY_ID, FAULTS, FAULT_BY_ID, conditionLevel } from '../data/maintenance.js';
import { addFeed } from '../state.js';
import { ageRisk, upgradeEffect, upgradeLevel, maxLevel, upgradeCost, serverStats, conditionRisk, knownFaults, isBusy } from './hardware.js';
import { capacity, surgeFactor } from './capacity.js';
import { economy } from './economy.js';
import { spend } from './ledger.js';
import { emit } from './signals.js';
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export function mroll(s) {
  let x = s.mrng >>> 0 || 1; x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  s.mrng = x >>> 0; return s.mrng / 4294967296;
}
export const serverLabel = item => `Server #${item.uid} (${serverType(item.id).name})`;
export const typeWear = model => MAINT.wearBase + MAINT.wearPerFailure * model.failure;

// ---- Passive wear, applied every simulation step ----
export function tickMaintenance(s, hours) {
  const heat = LOCATIONS.find(l => l.id === s.location)?.risks?.heat ?? 1, before = s.hours - hours;
  for (const item of s.servers) {
    const oldBand = conditionLevel(item.condition).id;
    const faultThermal = item.faults.reduce((sum, f) => sum + FAULT_BY_ID[f.id].thermal, 0);
    item.thermal = clamp(item.thermal - (MAINT.thermalDecayPerHour * heat * (1 - upgradeEffect(item, 'cooling', 'thermal')) + faultThermal) * hours, 0, 100);
    const faultWear = 1 + item.faults.reduce((sum, f) => sum + FAULT_BY_ID[f.id].wear, 0);
    const ageFactor = 1 + (ageRisk(item.age) - 1) * MAINT.ageWearShare, thermalFactor = 1 + (1 - item.thermal / 100) * MAINT.thermalWearScale;
    item.condition = clamp(item.condition - MAINT.baseWearPerHour * typeWear(serverType(item.id)) * ageFactor * thermalFactor * faultWear * hours, 0, 100);
    const band = conditionLevel(item.condition);
    if (band.id !== oldBand && ['poor', 'critical'].includes(band.id)) {
      addFeed(s, `${serverLabel(item)} is now in ${band.label.toLowerCase()} condition`, `Why: wear from age${item.thermal < 50 ? ', poor cooling' : ''} and missed maintenance. Poor hardware fails more often${band.capacity < 1 ? ' and delivers less capacity' : ''}. An inspection shows what it needs.`, 'warning', { cat: 'maintenance', affected: serverLabel(item), outcome: 'info' });
      emit('condition', { uid: item.uid, band: band.id });
    }
    if (before < item.busyUntil && s.hours >= item.busyUntil) emit('maintenanceDone', { uid: item.uid, label: serverLabel(item), task: item.busyLabel });
  }
}

// ---- Descriptions used by the UI (kept here so numbers come from the same formulas) ----
export function riskLabel(item) {
  const pct = Math.round((conditionRisk(item) - 1) * 100);
  return pct === 0 ? 'baseline' : pct > 0 ? `${pct}% higher than baseline` : `${-pct}% lower than baseline`;
}
export function recommendation(s, item, snap = item) {
  const known = (snap.faults || []).length;
  if (known) return { id: 'repair', text: `Targeted repair to clear ${known} fault${known > 1 ? 's' : ''}.` };
  if (snap.condition < 35) return { id: 'replace', text: 'Component replacement: condition is critically low.' };
  if (snap.thermal < 45) return { id: 'cooling', text: 'Cooling service: heat is building up.' };
  if (snap.condition < 70) return { id: 'routine', text: 'Routine maintenance would restore condition.' };
  return { id: null, text: 'No action needed right now.' };
}
// If this server went offline for `hours`, how much service would customers lose?
export function serviceImpact(s, item, hours) {
  if (!(hours > 0) || isBusy(s, item)) return { loss: 0, hours };
  const cap = capacity(s), mine = serverStats(item).capacity, left = Math.max(0, cap.available - mine);
  const service = cap.used ? Math.min(1, left / cap.used) : 1;
  return { loss: Math.max(0, cap.service - service), hours };
}
export function impactNote(s, item, hours) {
  const impact = serviceImpact(s, item, hours);
  if (!hours) return 'No downtime.';
  return impact.loss > 0.005 ? `Offline ${hours} game hours. Customers would lose about ${Math.round(impact.loss * 100)}% of service, so wait for spare capacity if you can.` : `Offline ${hours} game hours. Spare capacity covers it.`;
}

// ---- Maintenance actions ----
export function maintenanceCost(item, action) {
  const base = Math.max(action.minCost, Math.ceil(serverType(item.id).cost * action.costFraction));
  return action.perFault ? base * Math.max(1, knownFaults(item).length) : base;
}
export function maintenanceStatus(s, item, action) {
  const cost = maintenanceCost(item, action);
  let reason = '';
  if (s.tier < action.tier) reason = 'Unlocks in a later chapter.';
  else if (isBusy(s, item)) reason = 'This server is busy.';
  // Gates use only what the player can observe (the condition band), never hidden cooling health or faults.
  else if (action.id === 'routine' && item.condition >= 96) reason = 'Nothing to service yet.';
  else if (action.id === 'replace' && item.condition >= 88 && !knownFaults(item).length) reason = 'Nothing needs replacing yet.';
  else if (action.id === 'repair' && !knownFaults(item).length) reason = 'Inspect first: no known faults to repair.';
  else if (s.cash < cost) reason = `Needs $${cost}.`;
  return { ok: !reason, reason, cost, downtime: action.downtime };
}
function logEntry(s, item, entry) {
  item.log.push({ hour: s.hours, cost: 0, ref: '', level: 0, ...entry });
  item.log = item.log.slice(-MAINT.logLimit);
}
export function performMaintenance(s, index, actionId) {
  const item = s.servers[index], action = MAINT_BY_ID[actionId];
  if (!item || !action) return { ok: false, message: 'That server or action is no longer available.' };
  const status = maintenanceStatus(s, item, action);
  if (!status.ok) return { ok: false, message: status.reason };
  const before = item.condition, label = serverLabel(item);
  spend(s, 'maintenance', status.cost);
  let cleared = [];
  if (action.id === 'inspect') {
    item.faults.forEach(f => { f.known = true; });
    item.report = { hour: s.hours, condition: item.condition, thermal: item.thermal, faults: item.faults.map(f => f.id) };
  } else {
    item.condition = Math.min(100, item.condition + action.condition);
    item.thermal = Math.min(100, item.thermal + action.thermal);
    const kept = [];
    for (const fault of item.faults) {
      const fixes = action.clears === 'all' || (action.clears === 'known' && fault.known) || (Array.isArray(action.clears) && action.clears.includes(fault.id));
      (fixes ? cleared : kept).push(fault);
    }
    item.faults = kept;
    if (item.report) item.report = null; // an old inspection no longer describes this hardware
    item.busyUntil = Math.max(item.busyUntil, s.hours + action.downtime); item.busyLabel = action.busy;
  }
  logEntry(s, item, { kind: action.id, cost: status.cost, before, after: item.condition, ref: cleared.map(f => f.id).join(',') });
  const found = action.id === 'inspect' ? item.faults.length : 0;
  emit(action.id === 'inspect' && found ? 'fault' : 'maintenance', { uid: item.uid, kind: action.id });
  const message = action.id === 'inspect'
    ? (found ? `${label}: ${found} fault${found > 1 ? 's' : ''} detected.` : `${label}: inspection complete, no faults found.`)
    : `${label}: ${action.name.toLowerCase()} started. Back online in ${action.downtime} game hours.`;
  const why = action.id === 'inspect'
    ? 'Why: an inspection reveals exact condition, cooling health and hidden faults. It costs a small fee and causes no downtime.'
    : `Why: ${action.description} ${before < item.condition ? `Condition ${Math.round(before)}% → ${Math.round(item.condition)}%.` : ''}${cleared.length ? ` Cleared: ${cleared.map(f => FAULT_BY_ID[f.id].name.toLowerCase()).join(', ')}.` : ''}`;
  return { ok: true, message, why, detail: { cat: 'maintenance', affected: label, response: action.name, outcome: 'resolved', cost: status.cost } };
}

// ---- Service all ----
// Routine maintenance for every server that needs it, worst first. To protect customers it never takes so many
// servers offline at once that service would drop; the rest wait for a later press. Stops when cash runs out.
export function serviceAllPlan(s) {
  const routine = MAINT_BY_ID.routine, surge = s.hours < s.trafficUntil;
  const used = capacity(s).used;
  let remaining = s.servers.filter(i => !isBusy(s, i)).reduce((sum, i) => sum + serverStats(i).capacity * (surge ? surgeFactor(i) : 1), 0);
  let cash = s.cash;
  const todo = [], waiting = [], broke = [];
  const needy = s.servers.map((item, index) => ({ item, index })).filter(({ item }) => item.condition < MAINT.bulkBelow && !isBusy(s, item) && s.tier >= routine.tier).sort((a, b) => a.item.condition - b.item.condition);
  for (const entry of needy) {
    const cost = maintenanceCost(entry.item, routine), mine = serverStats(entry.item).capacity * (surge ? surgeFactor(entry.item) : 1);
    if (cash < cost) { broke.push(entry); continue; }
    if (remaining - mine < used) { waiting.push(entry); continue; }
    todo.push({ ...entry, cost }); remaining -= mine; cash -= cost;
  }
  return { todo, waiting, broke, cost: todo.reduce((sum, e) => sum + e.cost, 0), needy: needy.length };
}
export function serviceAll(s) {
  const plan = serviceAllPlan(s);
  if (!plan.todo.length) return { ok: false, message: plan.needy ? 'Nothing can be serviced safely right now: customers need the spare capacity, or cash is short.' : 'Every server is in good shape. Nothing needs servicing.' };
  let spent = 0;
  for (const { index } of plan.todo) { const before = s.books.oneOff.maintenance; performMaintenance(s, index, 'routine'); spent += s.books.oneOff.maintenance - before; }
  const later = plan.waiting.length + plan.broke.length;
  return {
    ok: true, message: `Servicing ${plan.todo.length} server${plan.todo.length > 1 ? 's' : ''} for $${spent}.${later ? ` ${later} more need${later > 1 ? '' : 's'} attention later.` : ''}`,
    why: `Why: routine maintenance restores condition and reduces failure risk. ${plan.waiting.length ? `${plan.waiting.length} server${plan.waiting.length > 1 ? 's were' : ' was'} left running so customers keep their service. ` : ''}${plan.broke.length ? 'Some were skipped for lack of cash. ' : ''}`.trim(),
    detail: { cat: 'maintenance', affected: `${plan.todo.length} servers`, response: 'Service all', outcome: 'resolved', cost: spent },
  };
}

// ---- Hardware upgrades ----
export function upgradeStatus(s, item, id) {
  const upgrade = UPGRADE_BY_ID[id], level = upgradeLevel(item, id), cap = maxLevel(item, id);
  const next = level + 1, cost = next <= cap ? upgradeCost(item, id, next) : 0;
  let reason = '';
  if (s.tier < upgrade.tier) reason = 'Unlocks in a later chapter.';
  else if (cap === 0) reason = LIMIT_NOTES[`${item.id}:${id}`] || 'Not compatible with this server.';
  else if (level >= cap) reason = LIMIT_NOTES[`${item.id}:${id}`] || (cap < 3 ? LIMIT_NOTES[item.id] : '') || 'Maximum level installed.';
  else if (upgrade.requires === 'network' && !s.network) reason = 'Choose a network strategy first (Regional ISP).';
  else if (isBusy(s, item)) reason = 'This server is busy.';
  else if (s.cash < cost) reason = `Needs $${cost}.`;
  return { ok: !reason, reason, level, cap, next, cost, hours: upgrade.installHours };
}
export function installUpgrade(s, index, id) {
  const item = s.servers[index], upgrade = UPGRADE_BY_ID[id];
  if (!item || !upgrade) return { ok: false, message: 'That server or upgrade is no longer available.' };
  const status = upgradeStatus(s, item, id);
  if (!status.ok) return { ok: false, message: status.reason };
  spend(s, 'upgrades', status.cost);
  item.upgrades[id] = status.next;
  item.busyUntil = Math.max(item.busyUntil, s.hours + upgrade.installHours); item.busyLabel = `Installing ${upgrade.short}`;
  logEntry(s, item, { kind: 'upgrade', cost: status.cost, before: item.condition, after: item.condition, ref: id, level: status.next });
  emit('upgrade', { uid: item.uid, id });
  return {
    ok: true, message: `${serverLabel(item)}: ${upgrade.name} level ${status.next} installed.`,
    why: `Why: ${upgrade.purpose} The server is offline for ${upgrade.installHours} game hours while it is installed.`,
    detail: { cat: 'maintenance', affected: serverLabel(item), response: `${upgrade.name} L${status.next}`, outcome: 'resolved', cost: status.cost },
  };
}
// What would the next level change in practice? Profit uses the live economy; no state is kept.
export function previewUpgrade(s, item, id) {
  const status = upgradeStatus(s, item, id);
  if (status.next > status.cap) return null;
  const baseProfit = economy(s).profit, baseCap = capacity(s).installed;
  item.upgrades[id] = status.next;
  const profit = economy(s).profit, installed = capacity(s).installed;
  item.upgrades[id] = status.next - 1;
  return { capacityGain: installed - baseCap, profitGain: profit - baseProfit, cost: status.cost };
}

// ---- Incidents ----
// Hardware/heat incidents always hit one specific server (chosen by risk); other server-targeted events pick evenly.
export function pickAffected(s, event) {
  const hardware = ['hardware', 'heat'].includes(event.trigger.id);
  if (!s.servers.length || (!hardware && event.target.id !== 'server')) return null;
  const weights = s.servers.map(item => hardware ? serverType(item.id).failure * ageRisk(item.age) * conditionRisk(item) : 1);
  let cursor = mroll(s) * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < s.servers.length; i++) { cursor -= weights[i]; if (cursor < 0) return s.servers[i].uid; }
  return s.servers[s.servers.length - 1].uid;
}
export function affectedText(s, event) {
  const item = s.servers.find(x => x.uid === event.affected);
  if (item) return `${serverLabel(item)}, ${conditionLevel(item.condition).label.toLowerCase()} condition`;
  return ({ rack: 'Your server rack', site: 'Your location', customer: 'A customer account', network: 'The whole operation', server: 'A server' })[event.target.id] || 'Your operation';
}
// Hardware and heat incidents damage the affected server and may leave a hidden fault.
export function applyIncidentWear(s, event, choice, failed) {
  if (!['hardware', 'heat'].includes(event.trigger.id)) return null;
  const item = s.servers.find(x => x.uid === event.affected) || s.servers[0];
  if (!item) return null;
  const before = item.condition, handling = Math.max(MAINT.incidentWearFloor, choice.damageScale * (failed ? 1.4 : 1));
  item.condition = Math.max(0, item.condition - MAINT.incidentWear * event.scale * handling);
  const chance = Math.min(MAINT.faultChanceCap, (MAINT.faultChanceBase + MAINT.faultChanceScale * choice.damageScale) * Math.min(1.5, event.severity.scale));
  let fault = null;
  if (mroll(s) < chance) {
    const candidates = FAULTS.filter(f => f.cause === event.trigger.id && !item.faults.some(x => x.id === f.id));
    fault = candidates.length ? candidates[Math.floor(mroll(s) * candidates.length)] : null;
    if (fault) item.faults.push({ id: fault.id, since: s.hours, known: false });
  }
  logEntry(s, item, { kind: 'incident', before, after: item.condition, ref: event.trigger.id });
  return { item, before, after: item.condition, faultAdded: Boolean(fault) };
}
