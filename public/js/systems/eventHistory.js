import { EVENT_RULES } from '../data/eventParts.js';
import { BALANCE } from '../data/tiers.js';
// Persist the generator state so importing a save preserves future randomness.
export function random(s) {
  let x = s.rng >>> 0; x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  s.rng = x >>> 0; return s.rng / 4294967296;
}
export function pick(s, items, weight = () => 1) {
  const weights = items.map(item => Math.max(0, weight(item)));
  let cursor = random(s) * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < items.length; i++) { cursor -= weights[i]; if (cursor < 0) return items[i]; }
  return items[items.length - 1];
}
export function eligible(s, part) {
  if (s.tier < (part.minTier || 1)) return false;
  if (!part.needs) return true;
  const tests = {
    servers: s.servers.length > 0, customers: s.customers.length > 0,
    network: Boolean(s.network), location: Boolean(s.location), loans: s.loans.length > 0,
    recentLoan: s.lastLoanHour !== null && s.hours - s.lastLoanHour < EVENT_RULES.chainDelayHours,
    recentCustomer: s.customers.some(c => s.hours - c.joined < EVENT_RULES.chainDelayHours),
    sale: s.price < BALANCE.defaultPrice,
  };
  return Boolean(tests[part.needs]);
}
export function combinationAllowed(s, trigger, target) {
  return !s.eventHistory.some(entry => entry.trigger === trigger && entry.target === target && s.hours - entry.hour < EVENT_RULES.cooldownHours);
}
export function varietyWeight(s, id) {
  const count = s.eventHistory.filter(entry => entry.trigger === id).length;
  return 1 / (1 + count * EVENT_RULES.varietyPenalty);
}
export function recordEvent(s, event) {
  s.eventHistory.push({ trigger: event.trigger.id, target: event.target.id, hour: s.hours });
  s.eventHistory = s.eventHistory.slice(-EVENT_RULES.historyLimit);
}
