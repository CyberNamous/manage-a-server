import { BALANCE } from '../data/tiers.js';
import { customerType } from '../data/customers.js';
import { REP_RULES, REP_REASONS } from '../data/reputation.js';
import { MAINT } from '../data/maintenance.js';
import { addFeed } from '../state.js';
import { capacity } from './capacity.js';
import { spend } from './ledger.js';
// Every reputation change goes through here so the breakdown always reflects what actually happened.
// Clamping is identical to the previous inline code; only the applied amount is recorded.
export function changeReputation(s, delta, reason) {
  const before = s.reputation;
  s.reputation = Math.min(BALANCE.reputationMax, Math.max(0, before + delta));
  const applied = s.reputation - before;
  if (applied) record(s, reason, applied);
  return applied;
}
function record(s, reason, amount) {
  const book = s.repBook, start = Math.floor(s.hours / REP_RULES.bucketHours) * REP_RULES.bucketHours;
  book.totals[reason] = (book.totals[reason] || 0) + amount;
  let bucket = book.buckets[book.buckets.length - 1];
  if (!bucket || bucket.h !== start) { bucket = { h: start, v: {} }; book.buckets.push(bucket); if (book.buckets.length > REP_RULES.bucketLimit) book.buckets.shift(); }
  bucket.v[reason] = (bucket.v[reason] || 0) + amount;
}
export function tickReputation(s, hours) {
  const cap = capacity(s);
  s.observedHours += hours; s.servedHours += cap.service * hours;
  if (s.customers.length && cap.service >= 1) changeReputation(s, BALANCE.reputationGain * hours, 'service');
  else if (cap.service < 1) {
    // Unplanned shortfall costs full trust; scheduled maintenance downtime is forgiven down to a share.
    changeReputation(s, -(1 - cap.planned) * BALANCE.reputationLoss * hours, 'outage');
    changeReputation(s, -(cap.planned - cap.service) * MAINT.plannedDowntimeShare * BALANCE.reputationLoss * hours, 'planned');
  }
  const survivors = [];
  for (const client of s.customers) {
    const type = customerType(client.id);
    if (cap.effective * 100 < type.uptime) client.strain += (1 - cap.effective) * hours;
    else client.strain = Math.max(0, client.strain - hours);
    const tolerance = BALANCE.churnFloorHours + (100 - type.uptime) * BALANCE.churnScale;
    if (client.strain > tolerance) {
      spend(s, 'credits', type.penalty); changeReputation(s, -BALANCE.customerMinUptimeRepLoss, 'churn');
      addFeed(s, `${type.name} left · $${type.penalty} service credit`, `Why: accumulated unreliable service exceeded this customer's ${type.uptime}% uptime expectation.`, 'loss', { cat: 'incident', affected: type.name, outcome: 'failed', cost: type.penalty, rep: -BALANCE.customerMinUptimeRepLoss });
    } else survivors.push(client);
  }
  s.customers = survivors;
}
// Summary for the Reputation window: the recent window plus lifetime totals, per reason.
export function reputationReport(s) {
  const recent = {};
  for (const bucket of s.repBook.buckets) for (const [key, value] of Object.entries(bucket.v)) recent[key] = (recent[key] || 0) + value;
  const cap = capacity(s);
  return {
    rows: REP_REASONS.map(r => ({ ...r, recent: recent[r.id] || 0, total: s.repBook.totals[r.id] || 0 })),
    windowHours: Math.min(s.hours, REP_RULES.bucketLimit * REP_RULES.bucketHours),
    service: cap.service, rate: cap.service >= 1 ? (s.customers.length ? BALANCE.reputationGain : 0) : -((1 - cap.planned) + MAINT.plannedDowntimeShare * (cap.planned - cap.service)) * BALANCE.reputationLoss, planned: cap.planned > cap.service,
    strained: s.customers.filter(c => c.strain > 0).length,
  };
}
