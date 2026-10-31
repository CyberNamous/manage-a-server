export const NETWORKS = [
  { id: 'transit', name: 'Buy transit', cost: 220, perUnit: 0.7, hourly: 0, description: 'Low entry cost. Every occupied capacity unit adds $0.70/h. Exposed to supplier pricing.' },
  { id: 'peering', name: 'Build peering', cost: 1500, perUnit: 0.08, hourly: 8, description: 'Invest now, pay $8/h plus $0.08 per occupied unit. Protected from transit price shocks.' },
];
export const LOCATIONS = [
  { id: 'suburb', name: 'Suburban exchange', cost: 180, rent: 10, demand: 1, power: 1, risks: { power: 1.5, ddos: 0.8 }, description: 'Affordable space. Local power cuts are more likely.' },
  { id: 'city', name: 'City hub', cost: 460, rent: 26, demand: 1.2, power: 1.15, risks: { ddos: 1.5, competitor: 1.3 }, description: 'More demand, higher rent, and more attention from attackers.' },
  { id: 'coast', name: 'Coastal landing', cost: 650, rent: 18, demand: 1.08, power: 0.85, risks: { cable: 1.7, heat: 0.6 }, description: 'Cooler, efficient power. More exposed to cable incidents.' },
];
