// Plain-language reasons reputation can move. Each key matches a real code path in the simulation.
export const REP_RULES = { bucketHours: 6, bucketLimit: 8 };
export const REP_REASONS = [
  { id: 'service', label: 'Reliable service', sign: 1, text: 'Trust grows slowly while every customer is served in full.' },
  { id: 'outage', label: 'Interrupted service', sign: -1, text: 'Trust falls quickly whenever available capacity is below what customers use.' },
  { id: 'planned', label: 'Scheduled maintenance', sign: -1, text: 'Planned downtime for servicing or upgrades. Customers forgive it far more than a crash, so it counts at a quarter of the usual penalty.' },
  { id: 'churn', label: 'Customers leaving', sign: -1, text: 'A customer left after service stayed below its uptime promise for too long.' },
  { id: 'incident', label: 'Incident fallout', sign: -1, text: 'Unanswered or poorly handled incidents and customer complaints.' },
  { id: 'opportunity', label: 'Publicity & partnerships', sign: 1, text: 'Positive attention from rare opportunities you accepted.' },
];
export const REP_BY_ID = Object.fromEntries(REP_REASONS.map(r => [r.id, r]));
