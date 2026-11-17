import { BALANCE } from '../data/tiers.js';
import { EVENT_RULES } from '../data/eventParts.js';
import { LOCATIONS } from '../data/network.js';
import { serverType } from '../data/servers.js';
import { varietyWeight } from './eventHistory.js';
import { ageRisk, conditionRisk, heatRisk } from './hardware.js';
export function eventWeight(s, trigger) {
  let weight = trigger.weight;
  if (trigger.id === 'hardware') {
    // Existing age risk, now also scaled by each server's condition, cooling health, faults and cooling upgrade.
    const risk = s.servers.reduce((sum, item) => sum + serverType(item.id).failure * ageRisk(item.age) * conditionRisk(item), 0);
    weight *= risk / Math.max(1, s.servers.length);
  }
  if (trigger.id === 'heat' && s.servers.length) weight *= s.servers.reduce((sum, item) => sum + heatRisk(item), 0) / s.servers.length;
  if (trigger.id === 'ddos') weight *= 1 + s.reputation * EVENT_RULES.attackerReputationScale + Math.max(0, s.cash) * EVENT_RULES.attackerCashScale;
  if (trigger.id === 'debt' || trigger.id === 'audit') weight *= s.loans.length ? EVENT_RULES.debtWeight : 1;
  if (trigger.id === 'price' && s.network === 'peering') return 0;
  const site = LOCATIONS.find(item => item.id === s.location);
  weight *= site?.risks[trigger.id] || 1;
  return Math.max(EVENT_RULES.minWeight, weight * varietyWeight(s, trigger.id));
}
