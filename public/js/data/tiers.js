// All economy and progression tuning belongs to data, not simulation or UI code.
export const BALANCE = {
  startCash: 180, startReputation: 24, startCustomers: 3, startServerAge: 12,
  gameHoursPerSecond: 1 / 30, lineCost: 6, powerPrice: 0.24,
  priceMin: 60, priceMax: 180, priceStep: 5, defaultPrice: 100,
  priceElasticity: 1.35, demandMin: 0.12, demandMax: 1,
  reputationDemandBase: 0.76, reputationDemandFactor: 0.006,
  reputationGain: 0.85, reputationLoss: 13, reputationMax: 100,
  servedBaselineHours: 8, churnFloorHours: 0.5, churnScale: 0.32,
  customerSigningFee: 8, applicationCooldown: 4, feedLimit: 40,
  backupCost: 140, backupHourly: 2, failoverCost: 420, failoverHourly: 4,
  insolvencyLimit: -400, recoveryCash: 190, recoveryRepLoss: 12,
  offlineCapSeconds: 120, offlineProfitFraction: 0.5,
  ageRiskHours: 90, ageRiskCap: 3, ageRiskScale: 0.8,
  rackRent: [0, 0, 18, 54], maxServers: [0, 5, 12, 30],
  capacityWarning: 0.85, maxCustomers: 180,
  saveCashMax: 1e12, saveHoursMax: 1e9, saveCollectionLimit: 500,
  customerMinUptimeRepLoss: 1.2, minService: 0.05,
};
export const TIERS = [
  { id: 1, name: 'Garage', subtitle: 'A rented line. A very real ambition.', description: 'Build a sustainable hosting business from your garage.', goals: [] },
  { id: 2, name: 'Small Rack', subtitle: 'Your first space in the real world.', description: 'Rent a rack, serve businesses, and start paying for space.', goals: [
    { key: 'cash', label: 'Keep a cash reserve', target: 650, format: 'money' },
    { key: 'customers', label: 'Host active customers', target: 8 },
    { key: 'reputation', label: 'Earn trust', target: 40 },
    { key: 'uptime', label: 'Keep service dependable', target: 97, format: 'percent' },
  ] },
  { id: 3, name: 'Regional ISP', subtitle: 'Connect your corner of the internet.', description: 'Choose a permanent location and network strategy. Loans become available.', goals: [
    { key: 'cash', label: 'Build an expansion reserve', target: 2600, format: 'money' },
    { key: 'business', label: 'Host small businesses', target: 5 },
    { key: 'reputation', label: 'Become a trusted operator', target: 58 },
    { key: 'uptime', label: 'Maintain reliable service', target: 98.5, format: 'percent' },
  ] },
  { id: 4, name: 'Data Center', locked: true, description: 'Multiple sites, cooling budgets, and your own purpose-built facility. Coming after v1.', goals: [] },
  { id: 5, name: 'Backbone Carrier', locked: true, description: 'Own long-distance fiber and carry traffic for other networks. Coming after v1.', goals: [] },
  { id: 6, name: 'Submarine Cable', locked: true, description: 'Co-fund an ocean crossing, then operate your own cable. The seabed awaits. Coming after v1.', goals: [] },
];
