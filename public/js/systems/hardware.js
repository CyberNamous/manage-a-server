// Per-server model: identity, upgrades and effective stats. Pure functions over server records; no state.js
// import (state.js builds the initial server from here). Effective stats feed capacity(), economy() and events.
import { BALANCE } from '../data/tiers.js';
import { SERVERS, serverType } from '../data/servers.js';
import { UPGRADES, LIMITS, UPGRADE_RULES, UPGRADE_BY_ID } from '../data/upgrades.js';
import { MAINT, MAINT_BY_ID, FAULTS, FAULT_BY_ID, conditionLevel } from '../data/maintenance.js';
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
// The single age-risk formula (previously inline in eventWeights.js). Maintenance wear reuses it.
export const ageRisk = age => 1 + Math.min(BALANCE.ageRiskCap, age / BALANCE.ageRiskHours * BALANCE.ageRiskScale);
export const blankUpgrades = () => Object.fromEntries(UPGRADES.map(u => [u.id, 0]));
export function newServer(uid, id, { age = 0, condition = MAINT.newCondition } = {}) {
  return { uid, id, age, condition, thermal: 100, upgrades: blankUpgrades(), faults: [], busyUntil: 0, busyLabel: '', report: null, log: [] };
}
export const upgradeLevel = (item, id) => item.upgrades?.[id] || 0;
export function upgradeEffect(item, id, key) { return UPGRADE_BY_ID[id].effects[key][upgradeLevel(item, id)] || 0; }
export const maxLevel = (item, id) => Math.min(UPGRADE_RULES.maxLevel, LIMITS[item.id]?.[id] ?? 0);
export const isBusy = (s, item) => s.hours < item.busyUntil;
export function serverStats(item) {
  const model = serverType(item.id), level = conditionLevel(item.condition);
  return {
    model, level, baseCapacity: model.capacity,
    capacity: model.capacity * (1 + upgradeEffect(item, 'cpu', 'capacity')) * level.capacity,
    power: model.power * (1 - upgradeEffect(item, 'power', 'power')),
  };
}
// Average of an upgrade effect across the whole fleet (for effects that apply to shared systems).
export function fleetEffect(s, id, key) {
  return s.servers.length ? s.servers.reduce((sum, item) => sum + upgradeEffect(item, id, key), 0) / s.servers.length : 0;
}
export const knownFaults = item => item.faults.filter(f => f.known);
// Multipliers on incident weight. They accept any {condition, thermal, faults, upgrades} shape, so
// the same math scores both a live server and a saved inspection snapshot.
export function conditionRisk(item) {
  const faults = 1 + item.faults.reduce((sum, f) => sum + (FAULT_BY_ID[f.id]?.risk || 0), 0);
  const thermal = 1 + (MAINT.thermalReference - item.thermal / 100) * MAINT.hardwareThermalScale;
  return conditionLevel(item.condition).risk * thermal * faults * (1 - upgradeEffect(item, 'cooling', 'risk'));
}
export const heatRisk = item => (1 + (MAINT.thermalReference - item.thermal / 100) * MAINT.heatThermalScale) * (1 - upgradeEffect(item, 'cooling', 'risk'));
export const upgradeCost = (item, id, level = upgradeLevel(item, id) + 1) =>
  Math.max(UPGRADE_RULES.minCost, Math.round(serverType(item.id).cost * UPGRADE_BY_ID[id].levelCost[level - 1]));
// ---- Save validation helpers (called from save.js; the whitelist stays in one place) ----
const finite = value => typeof value === 'number' && Number.isFinite(value);
const bounded = (value, max = BALANCE.saveHoursMax) => finite(value) ? clamp(value, 0, max) : 0;
export function estimatedCondition(model, age) {
  const wear = MAINT.wearBase + MAINT.wearPerFailure * model.failure;
  return Math.max(MAINT.migrationFloor, 100 - age * MAINT.migrationWearPerHour * wear);
}
export const estimatedThermal = age => Math.max(MAINT.migrationFloor, 100 - age * MAINT.migrationThermalPerHour);
export function sanitizeLog(log) {
  if (!Array.isArray(log)) return [];
  const kinds = [...Object.keys(MAINT_BY_ID), 'upgrade', 'incident'];
  return log.slice(-MAINT.logLimit).filter(e => e && kinds.includes(e.kind)).map(e => ({
    kind: e.kind, hour: bounded(e.hour), cost: bounded(e.cost, BALANCE.saveCashMax), before: clamp(finite(e.before) ? e.before : 0, 0, 100), after: clamp(finite(e.after) ? e.after : 0, 0, 100),
    ref: typeof e.ref === 'string' && e.ref.length <= 40 && /^[a-z,]*$/.test(e.ref) ? e.ref : '', level: Math.floor(clamp(finite(e.level) ? e.level : 0, 0, UPGRADE_RULES.maxLevel)),
  }));
}
export function sanitizeServer(raw, hours) {
  if (!raw || typeof raw !== 'object' || !SERVERS.some(t => t.id === raw.id)) return null;
  const model = serverType(raw.id), age = bounded(raw.age);
  const upgrades = blankUpgrades();
  for (const u of UPGRADES) upgrades[u.id] = Math.min(LIMITS[raw.id][u.id], Math.floor(clamp(finite(raw.upgrades?.[u.id]) ? raw.upgrades[u.id] : 0, 0, UPGRADE_RULES.maxLevel)));
  const seen = new Set();
  const faults = (Array.isArray(raw.faults) ? raw.faults : []).filter(f => f && FAULT_BY_ID[f.id] && !seen.has(f.id) && seen.add(f.id)).map(f => ({ id: f.id, since: Math.min(hours, bounded(f.since)), known: f.known === true }));
  const r = raw.report;
  const report = r && typeof r === 'object' && finite(r.condition) && finite(r.thermal)
    ? { hour: Math.min(hours, bounded(r.hour)), condition: clamp(r.condition, 0, 100), thermal: clamp(r.thermal, 0, 100), faults: (Array.isArray(r.faults) ? r.faults : []).filter(id => FAULT_BY_ID[id]).slice(0, FAULTS.length) } : null;
  return {
    uid: Number.isInteger(raw.uid) && raw.uid > 0 ? raw.uid : 0, id: raw.id, age, upgrades, faults, report, log: sanitizeLog(raw.log),
    condition: finite(raw.condition) ? clamp(raw.condition, 0, 100) : estimatedCondition(model, age),
    thermal: finite(raw.thermal) ? clamp(raw.thermal, 0, 100) : estimatedThermal(age),
    busyUntil: finite(raw.busyUntil) ? clamp(raw.busyUntil, 0, hours + MAINT.maxBusyHours) : 0,
    busyLabel: ['Inspecting', 'Servicing', 'Repairing', 'Cooling service', 'Replacing parts'].includes(raw.busyLabel) || /^Installing [A-Za-z ]{3,24}$/.test(raw.busyLabel || '') ? raw.busyLabel : '',
  };
}
