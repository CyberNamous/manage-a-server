import { BALANCE } from '../data/tiers.js';
import { EVENT_RULES } from '../data/eventParts.js';
import { LOCATIONS } from '../data/network.js';
import { serverType } from '../data/servers.js';
import { varietyWeight } from './eventHistory.js';
export function eventWeight(s, trigger) {
  let weight = trigger.weight;
  if (trigger.id === 'hardware') {
    const risk = s.servers.reduce((sum, item) => sum + serverType(item.id).failure * (1 + Math.min(BALANCE.ageRiskCap, item.age / BALANCE.ageRiskHours * BALANCE.ageRiskScale)), 0);
    weight *= risk / Math.max(1, s.servers.length);
  }
  if (trigger.id === 'ddos') weight *= 1 + s.reputation * EVENT_RULES.attackerReputationScale + Math.max(0, s.cash) * EVENT_RULES.attackerCashScale;
  if (trigger.id === 'debt' || trigger.id === 'audit') weight *= s.loans.length ? EVENT_RULES.debtWeight : 1;
  if (trigger.id === 'price' && s.network === 'peering') return 0;
  const site = LOCATIONS.find(item => item.id === s.location);
  weight *= site?.risks[trigger.id] || 1;
  return Math.max(EVENT_RULES.minWeight, weight * varietyWeight(s, trigger.id));
}
