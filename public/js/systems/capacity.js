import { BALANCE } from '../data/tiers.js';
import { EVENT_RULES } from '../data/eventParts.js';
import { serverType, PROTECTIONS } from '../data/servers.js';
import { customerType } from '../data/customers.js';
export function capacity(s) {
  const installed = s.servers.reduce((sum, item) => sum + serverType(item.id).capacity, 0);
  const used = s.customers.reduce((sum, item) => sum + customerType(item.id).units, 0);
  const power = s.servers.reduce((sum, item) => sum + serverType(item.id).power, 0);
  const trafficFactor = s.hours < s.trafficUntil ? EVENT_RULES.spikeCapacityFactor : 1;
  const available = s.hours < s.outageUntil ? 0 : installed * trafficFactor;
  const service = used ? Math.min(1, available / used) : 1;
  return { installed, available, used, spare: Math.max(0, available - used), power, service, utilization: installed ? used / installed : 0 };
}
export function purchaseServer(s, id) {
  const model = serverType(id);
  if (model.id !== id || s.tier < model.tier) return { ok: false, message: 'That server is not unlocked yet.' };
  if (s.servers.length >= BALANCE.maxServers[s.tier]) return { ok: false, message: 'Your space is full. Earn the next tier before expanding.' };
  if (s.cash < model.cost) return { ok: false, message: 'Keep earning before buying this server.' };
  s.cash -= model.cost; s.servers.push({ id, age: 0 });
  return { ok: true, message: `${model.name} installed. Idle hardware still uses power.` };
}
export function purchaseProtection(s, kind) {
  const model = PROTECTIONS.find(item => item.id === kind);
  if (!model || s[kind]) return { ok: false, message: 'Already installed or unavailable.' };
  if (s.tier < model.tier) return { ok: false, message: 'This protection unlocks in a later chapter.' };
  const cost = kind === 'backups' ? BALANCE.backupCost : BALANCE.failoverCost;
  if (s.cash < cost) return { ok: false, message: 'Not enough cash for this protection.' };
  s.cash -= cost; s[kind] = true;
  return { ok: true, message: 'Protection installed. Future outages should be shorter.' };
}
