import { maxServers, serverDistrict } from './management.js';
import { transact } from './finance.js';
import { BALANCE } from '../data/tiers.js';
import { EVENT_RULES } from '../data/eventParts.js';
import { serverType, PROTECTIONS } from '../data/servers.js';
import { customerType } from '../data/customers.js';
export function capacity(s) {
  const installed = s.servers.reduce((sum, item) => sum + serverType(item.id).capacity * (1 + .15 * (item.upgrade || 0)), 0);
  const used = s.customers.reduce((sum, item) => sum + customerType(item.id).units, 0);
  const power = s.servers.reduce((sum, item) => sum + serverType(item.id).power * (1 + .08 * (item.upgrade || 0)), 0);
  const trafficFactor = s.hours < s.trafficUntil ? EVENT_RULES.spikeCapacityFactor : 1;
  const online = s.servers.reduce((sum,item) => sum + (s.hours < Math.max(item.outageUntil||0,item.maintenanceUntil||0) ? 0 : serverType(item.id).capacity * (1+.15*(item.upgrade||0))),0);
  const regionalFactor = s.environment?.weather === 'congestion' ? .9 : 1;
  const available = s.hours < s.outageUntil ? 0 : online * trafficFactor * regionalFactor;
  const service = used ? Math.min(1, available / used) : 1;
  return { installed, available, used, spare: Math.max(0, available - used), power, service, utilization: installed ? used / installed : 0 };
}
export function purchaseServer(s, id) {
  const model = serverType(id);
  if (model.id !== id || s.tier < model.tier) return { ok: false, message: 'That server is not unlocked yet.' };
  if (s.servers.length >= maxServers(s)) return { ok: false, message: 'Your space is full. Earn the next tier before expanding.' };
  if (s.cash < model.cost) return { ok: false, message: 'Keep earning before buying this server.' };
  transact(s,-model.cost,'hardware',model.name+' server purchase'); s.servers.push({ id, age: 0, district:s.selectedDistrict||'local', upgrade:0 });
  return { ok: true, message: `${model.name} installed. Idle hardware still uses power.` };
}
export function purchaseProtection(s, kind) {
  const model = PROTECTIONS.find(item => item.id === kind);
  if (!model || s[kind]) return { ok: false, message: 'Already installed or unavailable.' };
  if (s.tier < model.tier) return { ok: false, message: 'This protection unlocks in a later chapter.' };
  const cost = kind === 'backups' ? BALANCE.backupCost : BALANCE.failoverCost;
  if (s.cash < cost) return { ok: false, message: 'Not enough cash for this protection.' };
  transact(s,-cost,'investment',model.name); s[kind] = true;
  return { ok: true, message: 'Protection installed. Future outages should be shorter.' };
}
