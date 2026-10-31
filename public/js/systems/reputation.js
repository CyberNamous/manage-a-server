import { BALANCE } from '../data/tiers.js';
import { customerType } from '../data/customers.js';
import { addFeed } from '../state.js';
import { capacity } from './capacity.js';
export function tickReputation(s, hours) {
  const cap = capacity(s);
  s.observedHours += hours; s.servedHours += cap.service * hours;
  if (s.customers.length && cap.service >= 1) s.reputation = Math.min(BALANCE.reputationMax, s.reputation + BALANCE.reputationGain * hours);
  else if (cap.service < 1) s.reputation = Math.max(0, s.reputation - (1 - cap.service) * BALANCE.reputationLoss * hours);
  const survivors = [];
  for (const client of s.customers) {
    const type = customerType(client.id);
    if (cap.service * 100 < type.uptime) client.strain += (1 - cap.service) * hours;
    else client.strain = Math.max(0, client.strain - hours);
    const tolerance = BALANCE.churnFloorHours + (100 - type.uptime) * BALANCE.churnScale;
    if (client.strain > tolerance) {
      s.cash -= type.penalty; s.reputation = Math.max(0, s.reputation - BALANCE.customerMinUptimeRepLoss);
      addFeed(s, `${type.name} left · $${type.penalty} service credit`, `Why: accumulated unreliable service exceeded this customer's ${type.uptime}% uptime expectation.`, 'loss');
    } else survivors.push(client);
  }
  s.customers = survivors;
}
