// Hardware upgrades (Update 1). These are OPTIONAL component improvements installed on a single,
// already-owned server. They never replace or change the Budget / Standard / Premium server types.
// All upgrade balance lives here. `effects[key][level]` is the cumulative effect at that level (0 = none).
export const UPGRADE_RULES = { maxLevel: 3, minCost: 4 };

export const UPGRADES = [
  { id: 'cpu', name: 'CPU upgrade', short: 'CPU', tier: 1, installHours: 0.3,
    levelCost: [0.18, 0.26, 0.36], // fraction of the server's purchase price, per level
    effects: { capacity: [0, 0.10, 0.20, 0.30] },
    purpose: 'More processing capacity on this server.' },
  { id: 'ram', name: 'RAM expansion', short: 'RAM', tier: 1, installHours: 0.15,
    levelCost: [0.12, 0.18, 0.26],
    effects: { surge: [0, 0.35, 0.60, 0.80] },
    purpose: 'Keeps this server useful during traffic surges.' },
  { id: 'storage', name: 'Storage upgrade', short: 'Disk', tier: 2, installHours: 0.2,
    levelCost: [0.12, 0.18, 0.26],
    effects: { recovery: [0, 0.08, 0.15, 0.22] },
    purpose: 'Faster restores, so outages end sooner.' },
  { id: 'cooling', name: 'Cooling upgrade', short: 'Cool', tier: 2, installHours: 0.25,
    levelCost: [0.14, 0.2, 0.28],
    effects: { thermal: [0, 0.25, 0.45, 0.60], risk: [0, 0.06, 0.11, 0.15] },
    purpose: 'Slower heat build-up and fewer heat-related failures.' },
  { id: 'power', name: 'Power efficiency', short: 'Power', tier: 2, installHours: 0.2,
    levelCost: [0.02, 0.03, 0.04],
    effects: { power: [0, 0.15, 0.28, 0.40] },
    purpose: 'Lower electricity use. Cheap, but pays back slowly.' },
  { id: 'nic', name: 'Network interface', short: 'NIC', tier: 3, installHours: 0.15, requires: 'network',
    levelCost: [0.15, 0.22, 0.30],
    effects: { netcost: [0, 0.06, 0.11, 0.15] },
    purpose: 'Cuts per-unit transit/peering charges across the fleet.' },
];

// Compatibility: the highest level each server type accepts for each upgrade (0 = incompatible).
export const LIMITS = {
  budget: { cpu: 2, ram: 2, storage: 2, cooling: 2, power: 2, nic: 0 },
  standard: { cpu: 3, ram: 3, storage: 3, cooling: 3, power: 3, nic: 3 },
  premium: { cpu: 3, ram: 3, storage: 3, cooling: 1, power: 3, nic: 3 },
};
export const LIMIT_NOTES = {
  'budget:nic': 'Budget servers have a fixed onboard network chip.',
  'budget': 'Budget hardware accepts up to level 2.',
  'premium:cooling': 'Premium servers already ship with advanced cooling.',
};
export const UPGRADE_BY_ID = Object.fromEntries(UPGRADES.map(u => [u.id, u]));
