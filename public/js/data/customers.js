export const CUSTOMERS = [
  { id: 'hobby', name: 'Hobby site', plural: 'Hobby sites', pay: 12, units: 1, uptime: 95, penalty: 16, tier: 1, reputation: 0, demand: 1, description: 'Small sites, forgiving owners. An easy place to start.' },
  { id: 'business', name: 'Small business', plural: 'Small businesses', pay: 42, units: 4, uptime: 98, penalty: 80, tier: 2, reputation: 35, demand: 0.9, description: 'Better income, but an outage can cost you their trust.' },
  { id: 'large', name: 'Large client', plural: 'Large clients', pay: 128, units: 12, uptime: 99.5, penalty: 280, tier: 3, reputation: 58, demand: 0.72, description: 'Serious contracts with serious uptime expectations.' },
];
export function customerType(id) { return CUSTOMERS.find(item => item.id === id) || CUSTOMERS[0]; }
