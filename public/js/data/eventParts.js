export const EVENT_RULES = {
  graceHours: 3, minGapHours: 2.4, maxGapHours: 5.2, tierFrequency: 0.12,
  cooldownHours: 12, varietyPenalty: 0.45, historyLimit: 24,
  rareChance: 0.025, rareCap: 2, rareCooldownHours: 18,
  debtWeight: 2.2, attackerReputationScale: 0.018, attackerCashScale: 0.00012,
  minWeight: 0.03, outageBase: 0.35, noProtectionDuration: 2.1,
  protectedDuration: 0.55, failoverDuration: 0.15,
  damagePerCustomer: 5, damageFloor: 10, chainDelayHours: 5,
  chainSeverity: 'serious', fineRepFraction: 0.12,
  spikeDuration: 3, spikeCapacityFactor: 0.65, transitShockFactor: 1.8,
  outcomeHistoryLimit: 40, repairFallbackChance: 0.2,
};
export const TRIGGERS = [
  { id: 'hardware', name: 'hardware failure', tags: ['technical'], weight: 1.2, minTier: 1, needs: 'servers', effect: 'outage' },
  { id: 'ddos', name: 'DDoS attempt', tags: ['security'], weight: 0.5, minTier: 1, needs: 'customers', effect: 'outage' },
  { id: 'power', name: 'power interruption', tags: ['technical'], weight: 0.8, minTier: 1, effect: 'outage' },
  { id: 'cable', name: 'cable damage', tags: ['technical'], weight: 0.8, minTier: 3, needs: 'network', effect: 'outage' },
  { id: 'update', name: 'bad software update', tags: ['technical'], weight: 0.6, minTier: 1, effect: 'outage' },
  { id: 'complaint', name: 'customer complaint', tags: ['commercial'], weight: 0.7, minTier: 1, needs: 'customers', effect: 'trust' },
  { id: 'spike', name: 'traffic surge', tags: ['demand'], weight: 0.6, minTier: 1, needs: 'customers', effect: 'traffic' },
  { id: 'competitor', name: 'new competitor', tags: ['commercial'], weight: 0.6, minTier: 2, effect: 'trust' },
  { id: 'price', name: 'transit price shock', tags: ['financial'], weight: 0.6, minTier: 3, needs: 'network', effect: 'price' },
  { id: 'audit', name: 'compliance audit', tags: ['financial'], weight: 0.4, minTier: 2, effect: 'fine' },
  { id: 'heat', name: 'heat warning', tags: ['technical'], weight: 0.9, minTier: 1, effect: 'outage' },
  { id: 'supplier', name: 'supplier delay', tags: ['commercial'], weight: 0.5, minTier: 2, effect: 'fine' },
  { id: 'debt', name: 'lender review', tags: ['financial'], weight: 0.8, minTier: 1, needs: 'loans', effect: 'fine' },
];
export const TARGETS = [
  { id: 'server', name: 'one server', tags: ['technical'], needs: 'servers', scale: 0.65 },
  { id: 'rack', name: 'your rack', tags: ['technical', 'security', 'demand'], minTier: 2, scale: 0.85 },
  { id: 'site', name: 'your location', tags: ['technical', 'financial', 'commercial'], minTier: 3, needs: 'location', scale: 1 },
  { id: 'customer', name: 'one customer', tags: ['commercial', 'demand', 'security', 'financial'], needs: 'customers', scale: 0.5 },
  { id: 'network', name: 'the whole operation', tags: ['technical', 'security', 'commercial', 'financial', 'demand'], scale: 1.2 },
];
export const SEVERITIES = [
  { id: 'minor', name: 'Minor', weight: 6, scale: 0.6 },
  { id: 'serious', name: 'Serious', weight: 3, scale: 1.2 },
  { id: 'severe', name: 'Severe', weight: 1, scale: 2.3 },
];
export const TWISTS = [
  { id: 'night', name: 'in the middle of the night', tags: ['any'], scale: 1.1 },
  { id: 'spike', name: 'during a busy period', tags: ['any'], scale: 1.2 },
  { id: 'debt', name: 'while repayments are running', tags: ['any'], needs: 'loans', scale: 1.2 },
  { id: 'loan', name: 'just after your latest loan', tags: ['any'], needs: 'recentLoan', scale: 1.1 },
  { id: 'sale', name: 'during a discount campaign', tags: ['commercial', 'demand'], needs: 'sale', scale: 0.9 },
  { id: 'trial', name: 'while a new customer is settling in', tags: ['any'], needs: 'recentCustomer', scale: 1 },
  { id: 'quiet', name: 'on an otherwise quiet day', tags: ['any'], scale: 1 },
];
export const TEMPLATES = [
  'A {trigger} is affecting {target} {twist}.',
  'Your monitoring flags a {trigger} at {target}, {twist}.',
  'You are dealing with a {trigger} affecting {target} {twist}.',
];
export const RARE_PARTS = [
  { id: 'buyout', name: 'acquisition inquiry', tags: ['commercial'], effect: 'opportunity', weight: 1, minTier: 2 },
  { id: 'government', name: 'government audit', tags: ['financial'], effect: 'fine', weight: 1, minTier: 2, followup: 'audit' },
  { id: 'viral', name: 'viral breakout', tags: ['demand'], effect: 'traffic', weight: 1, minTier: 1, needs: 'customers', followup: 'spike' },
  { id: 'cablefund', name: 'ocean cable consortium invitation', tags: ['commercial'], effect: 'opportunity', weight: 1, minTier: 3 },
];
export const RARE_EFFECTS = { offerPerCustomer: 120, consortiumCost: 800, consortiumReputation: 3, publicityReputation: 2 };
