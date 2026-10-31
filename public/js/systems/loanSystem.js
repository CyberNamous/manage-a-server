import { LOANS, LENDING } from '../data/loans.js';
export function loanQuote(loan) {
  const interest = loan.principal * loan.monthlyRate;
  const principal = loan.principal / loan.termMonths;
  return { interest, principal, monthly: interest + principal, hourly: (interest + principal) / LENDING.hoursPerMonth };
}
export function debtCost(s) { return s.loans.reduce((sum, item) => sum + loanQuote(item).hourly, 0); }
export function takeLoan(s, id, emergency = false) {
  if (!emergency && s.tier < 3) return { ok: false, message: 'Growth loans unlock at Regional ISP.' };
  if (s.loans.length >= LENDING.maxLoans) return { ok: false, message: 'Repay a loan before borrowing again.' };
  const model = emergency ? { id: 'emergency', name: 'Emergency loan', principal: LENDING.emergencyPrincipal, monthlyRate: LENDING.emergencyMonthlyRate, termMonths: LENDING.emergencyTermMonths } : LOANS.find(item => item.id === id);
  if (!model) return { ok: false, message: 'Unknown loan.' };
  s.loans.push({ ...model, remaining: model.principal }); s.cash += model.principal; s.lastLoanHour = s.hours;
  return { ok: true, message: `${model.name} funded. Repayments continue even during outages.` };
}
// The economy deducts principal and interest once. This updates the outstanding balance.
export function tickLoans(s, hours) {
  for (const loan of s.loans) loan.remaining = Math.max(0, loan.remaining - loanQuote(loan).principal / LENDING.hoursPerMonth * hours);
  s.loans = s.loans.filter(loan => loan.remaining > 0);
}
export function repayLoan(s, index) {
  const loan = s.loans[index];
  if (!loan || s.cash < loan.remaining) return { ok: false, message: 'You need enough cash to repay the remaining principal.' };
  s.cash -= loan.remaining; s.loans.splice(index, 1);
  return { ok: true, message: 'Loan repaid. Its hourly cost is gone.' };
}
