// Financial bookkeeping. Operating costs are already deducted continuously by economy(); only one-off
// spending goes through spend(). Each cash movement is recorded exactly once, so nothing is double counted.
export const OPEX_KEYS = ['power', 'rent', 'connectivity', 'protection', 'loans'];
export const OPEX_LABELS = { power: 'Electricity', rent: 'Space & rent', connectivity: 'Connectivity', protection: 'Protection plans', loans: 'Loan repayments' };
export const SPEND_KEYS = ['hardware', 'upgrades', 'maintenance', 'setup', 'incidents', 'credits'];
export const SPEND_LABELS = {
  hardware: 'Server purchases', upgrades: 'Hardware upgrades', maintenance: 'Maintenance & diagnostics',
  setup: 'Setup, onboarding & infrastructure', incidents: 'Incident responses & damage', credits: 'Customer service credits',
};
export function blankBooks(opening = 0, since = 0) {
  return {
    since, opening, revenue: 0, stipend: 0, borrowed: 0, repaidEarly: 0, restructured: 0,
    opex: Object.fromEntries(OPEX_KEYS.map(k => [k, 0])), oneOff: Object.fromEntries(SPEND_KEYS.map(k => [k, 0])),
  };
}
// One-off spending: deduct cash and record the category in a single step.
export function spend(s, category, amount) {
  if (!(amount > 0)) return;
  s.cash -= amount; s.books.oneOff[category] = (s.books.oneOff[category] || 0) + amount;
}
export function recordOperating(s, money, hours) {
  s.books.revenue += money.revenue * hours;
  for (const key of OPEX_KEYS) s.books.opex[key] += money[key] * hours;
}
export function totals(books) {
  const opex = OPEX_KEYS.reduce((sum, k) => sum + books.opex[k], 0), oneOff = SPEND_KEYS.reduce((sum, k) => sum + books.oneOff[k], 0);
  return { opex, oneOff, net: books.revenue - opex - oneOff };
}
