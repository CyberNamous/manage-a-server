// Server condition, diagnostics and maintenance (Update 1). Condition builds on the existing server-age
// risk: older, less reliable hardware wears faster. All maintenance balance lives here.
export const MAINT = {
  newCondition: 100, secondhandCondition: 78,
  // Wear (condition points per game hour) = base x type x age x heat x faults.
  baseWearPerHour: 0.3, wearBase: 0.6, wearPerFailure: 0.4, ageWearShare: 0.25,
  // Cooling health ("thermal", 100 = clean). Low thermal accelerates wear and heat incidents.
  thermalDecayPerHour: 0.35, thermalWearScale: 0.8, hardwareThermalScale: 0.3, heatThermalScale: 1,
  // Cooling health at which incident risk equals the original game's baseline. Cleaner is safer; dustier is riskier.
  thermalReference: 0.6,
  // Hardware/heat incidents wear the affected server and may leave a hidden fault behind.
  incidentWear: 10, incidentWearFloor: 0.25, faultChanceBase: 0.03, faultChanceScale: 0.45, faultChanceCap: 0.9,
  // Planned (announced) downtime still loses revenue, but only this share of the usual reputation/strain penalty applies.
  plannedDowntimeShare: 0.25,
  // "Service all" only picks servers below this condition.
  bulkBelow: 80,
  logLimit: 10, maxBusyHours: 4, reportStaleHours: 24,
  // Saves from before Update 1 get a condition estimated from age, with a forgiving floor.
  migrationWearPerHour: 0.3, migrationFloor: 60, migrationThermalPerHour: 0.3,
};

export const CONDITIONS = [
  { id: 'excellent', label: 'Excellent', min: 85, risk: 0.85, capacity: 1, tone: 'gain' },
  { id: 'good', label: 'Good', min: 65, risk: 1, capacity: 1, tone: 'gain' },
  { id: 'fair', label: 'Fair', min: 45, risk: 1.1, capacity: 1, tone: 'warning' },
  { id: 'poor', label: 'Poor', min: 25, risk: 1.3, capacity: 0.97, tone: 'loss' },
  { id: 'critical', label: 'Critical', min: 0, risk: 1.6, capacity: 0.9, tone: 'loss' },
];
export function conditionLevel(value) { return CONDITIONS.find(level => value >= level.min) || CONDITIONS[CONDITIONS.length - 1]; }

// Hidden faults. They add incident risk and wear until found by an inspection and fixed.
export const FAULTS = [
  { id: 'fan', name: 'Failing cooling fan', risk: 0.35, wear: 0.15, thermal: 0.6, cause: 'heat', fixedBy: ['cooling', 'replace', 'repair'], effect: 'Cooling health drops faster and heat incidents become likelier.' },
  { id: 'psu', name: 'Unstable power supply', risk: 0.5, wear: 0.25, thermal: 0, cause: 'hardware', fixedBy: ['replace', 'repair'], effect: 'Raises hardware failure risk and wears the server faster.' },
  { id: 'disk', name: 'Degrading storage drive', risk: 0.4, wear: 0.2, thermal: 0, cause: 'hardware', fixedBy: ['replace', 'repair'], effect: 'Raises hardware failure risk and wears the server faster.' },
];
export const FAULT_BY_ID = Object.fromEntries(FAULTS.map(f => [f.id, f]));

// Costs are a fraction of the server's purchase price. `downtime` = game hours the server is offline.
export const MAINTENANCE = [
  { id: 'inspect', name: 'Hardware inspection', tier: 1, costFraction: 0.04, minCost: 4, downtime: 0, condition: 0, thermal: 0, busy: 'Inspecting',
    description: 'Runs diagnostics: exact condition, cooling health, hidden faults and advice. No downtime.' },
  { id: 'routine', name: 'Routine maintenance', tier: 1, costFraction: 0.08, minCost: 8, downtime: 0.25, condition: 22, thermal: 12, busy: 'Servicing',
    parts: 'Filters, firmware, connectors',
    description: 'Restores condition and a little cooling health. Does not fix faults.' },
  { id: 'repair', name: 'Targeted repair', tier: 1, costFraction: 0.14, minCost: 14, perFault: true, downtime: 0.6, condition: 20, thermal: 0, clears: 'known', busy: 'Repairing',
    description: 'Fixes faults an inspection has found (priced per fault) and restores some condition.' },
  { id: 'cooling', name: 'Cooling service', tier: 2, costFraction: 0.06, minCost: 6, downtime: 0.2, condition: 4, thermal: 100, clears: ['fan'], busy: 'Cooling service',
    parts: 'Fans, heatsinks, thermal paste',
    description: 'Restores cooling health to full and replaces a failing fan.' },
  { id: 'replace', name: 'Component replacement', tier: 2, costFraction: 0.30, minCost: 30, downtime: 0.75, condition: 45, thermal: 30, clears: 'all', busy: 'Replacing parts',
    parts: 'Drives, power supply, fans',
    description: 'Big condition boost and clears every fault, even undiscovered ones. Expensive.' },
];
export const MAINT_BY_ID = Object.fromEntries(MAINTENANCE.map(a => [a.id, a]));
