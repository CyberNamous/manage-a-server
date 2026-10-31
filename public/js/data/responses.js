export const RESPONSES = [
  { id: 'failover', name: 'Fail over to spare hardware', needs: 'spare', costScale: 0, failureChance: 0.05, damageScale: 0.1, durationScale: 0.15, hint: 'Use spare capacity. About 5% chance the workaround fails.' },
  { id: 'repair', name: 'Bring in a specialist', needs: 'afford', costScale: 1, failureChance: 0.08, damageScale: 0.2, durationScale: 0.4, hint: 'Pay for a careful fix. About 8% chance the issue persists.' },
  { id: 'negotiate', name: 'Negotiate with your partners', needs: 'reputation', reputation: 48, costScale: 0.25, failureChance: 0.18, damageScale: 0.35, durationScale: 0.6, hint: 'Your reputation opens a door. About 18% chance talks break down.' },
  { id: 'patch', name: 'Try a quick workaround', needs: 'afford', costScale: 0.15, failureChance: 0.4, damageScale: 0.6, durationScale: 0.8, hint: 'Cheap now, but about 40% chance it fails again.' },
  { id: 'emergency', name: 'Take an emergency loan', needs: 'lowCash', costScale: 0, failureChance: 0.15, damageScale: 0.3, durationScale: 0.5, hint: 'Borrow $160 at 9% monthly interest, plus principal over 6 months. Available even before Tier 3.' },
  { id: 'ignore', name: 'Wait and absorb the impact', needs: 'always', costScale: 0, failureChance: 0, damageScale: 1, durationScale: 1, hint: 'No repair fee. Lost service, trust, and a possible escalation still cost money.' },
];
export const RESPONSE_RULES = { maxChoices: 3, lowCashFactor: 1.2, failedDamageScale: 1.4, ignoreRepScale: 1, resolvedRepScale: 0.12 };
