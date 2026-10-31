import { TIERS } from '../data/tiers.js';
import { uptime, addFeed } from '../state.js';
export function goalValue(s, key) {
  if (key === 'customers') return s.customers.length;
  if (key === 'business') return s.customers.filter(item => item.id === 'business').length;
  if (key === 'uptime') return uptime(s);
  return Number(s[key]) || 0;
}
export function goalProgress(s) {
  const next = TIERS[s.tier];
  if (!next || next.locked) return { next, progress: 1, goals: [] };
  const goals = next.goals.map(goal => ({ ...goal, value: goalValue(s, goal.key), progress: Math.min(1, Math.max(0, goalValue(s, goal.key) / goal.target)) }));
  return { next, goals, progress: goals.reduce((sum, item) => sum + item.progress, 0) / goals.length };
}
export function checkUnlocks(s) {
  const info = goalProgress(s);
  if (info.next && !info.next.locked && info.goals.every(goal => goal.value >= goal.target)) {
    s.tier = info.next.id;
    addFeed(s, `${info.next.name} unlocked`, `Why: you met every reserve, customer, reputation, and service goal. ${info.next.description}`, 'gain');
    return info.next;
  }
  return null;
}
