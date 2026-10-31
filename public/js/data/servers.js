export const SERVERS = [
  { id: 'budget', name: 'Budget', label: 'Secondhand workhorse', cost: 100, capacity: 8, power: 0.55, failure: 1.7, tier: 1, description: 'Fast to afford. More likely to fail as it ages.' },
  { id: 'standard', name: 'Standard', label: 'The dependable middle', cost: 340, capacity: 20, power: 0.8, failure: 0.8, tier: 1, description: 'Balanced capacity, power use, and reliability.' },
  { id: 'premium', name: 'Premium', label: 'Built for the long run', cost: 980, capacity: 36, power: 0.9, failure: 0.25, tier: 2, description: 'Reliable and efficient, but takes longer to pay for itself.' },
];
export const PROTECTIONS = [
  { id: 'backups', name: 'Automatic backups', tier: 1, description: 'Recover more quickly after an outage. Not a substitute for spare capacity.' },
  { id: 'failover', name: 'Managed failover', tier: 2, description: 'A stronger recovery layer. Spare hardware still unlocks the fast event response.' },
];
export function serverType(id) { return SERVERS.find(item => item.id === id) || SERVERS[0]; }
