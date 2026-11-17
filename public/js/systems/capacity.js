import { BALANCE } from '../data/tiers.js';
import { EVENT_RULES } from '../data/eventParts.js';
import { serverType, PROTECTIONS } from '../data/servers.js';
import { customerType } from '../data/customers.js';
import { newServer, serverStats, upgradeEffect, isBusy } from './hardware.js';
import { spend } from './ledger.js';
import { emit } from './signals.js';
import { MAINT } from '../data/maintenance.js';
// Share of this server's capacity that survives a traffic surge. RAM expansion recovers part of the loss.
export const surgeFactor = item => 1 - (1 - EVENT_RULES.spikeCapacityFactor) * (1 - upgradeEffect(item, 'ram', 'surge'));
export function capacity(s) {
  const outage = s.hours < s.outageUntil, surge = s.hours < s.trafficUntil;
  let installed = 0, available = 0, power = 0, offline = 0, plannedOnline = 0;
  for (const item of s.servers) {
    const stats = serverStats(item);
    installed += stats.capacity; power += stats.power;
    // A server being serviced or upgraded is offline until busyUntil; the others carry the load.
    if (isBusy(s, item)) { offline += stats.capacity; if (!outage) plannedOnline += stats.capacity * (surge ? surgeFactor(item) : 1); }
    else if (!outage) available += stats.capacity * (surge ? surgeFactor(item) : 1);
  }
  const used = s.customers.reduce((sum, item) => sum + customerType(item.id).units, 0);
  const service = used ? Math.min(1, available / used) : 1;
  // `planned` = service if scheduled work were not happening; `effective` weights that planned part lightly for trust.
  const planned = used ? Math.min(1, (available + plannedOnline) / used) : 1;
  const effective = Math.max(0, 1 - ((1 - planned) + MAINT.plannedDowntimeShare * Math.max(0, planned - service)));
  return { installed, available, used, spare: Math.max(0, available - used), power, service, planned, effective, offline, utilization: installed ? used / installed : 0 };
}
export function purchaseServer(s, id) {
  const model = serverType(id);
  if (model.id !== id || s.tier < model.tier) return { ok: false, message: 'That server is not unlocked yet.' };
  if (s.servers.length >= BALANCE.maxServers[s.tier]) return { ok: false, message: 'Your space is full. Earn the next tier before expanding.' };
  if (s.cash < model.cost) return { ok: false, message: 'Keep earning before buying this server.' };
  spend(s, 'hardware', model.cost);
  const uid = ++s.serverSerial;
  s.servers.push(newServer(uid, id));
  emit('purchase', { uid });
  return { ok: true, message: `${model.name} installed. Idle hardware still uses power.` };
}
export function purchaseProtection(s, kind) {
  const model = PROTECTIONS.find(item => item.id === kind);
  if (!model || s[kind]) return { ok: false, message: 'Already installed or unavailable.' };
  if (s.tier < model.tier) return { ok: false, message: 'This protection unlocks in a later chapter.' };
  const cost = kind === 'backups' ? BALANCE.backupCost : BALANCE.failoverCost;
  if (s.cash < cost) return { ok: false, message: 'Not enough cash for this protection.' };
  spend(s, 'setup', cost); s[kind] = true;
  return { ok: true, message: 'Protection installed. Future outages should be shorter.' };
}
