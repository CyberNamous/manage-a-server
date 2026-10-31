import { TICK_MS, MAX_FRAME_MS } from './config.js';
import { BALANCE } from './data/tiers.js';
import { state, addFeed } from './state.js';
import { economy } from './systems/economy.js';
import { tickReputation } from './systems/reputation.js';
import { tickLoans } from './systems/loanSystem.js';
import { checkUnlocks } from './systems/unlocks.js';
import { tickEvents } from './systems/eventSystem.js';
export function simulate(s, seconds) {
  if (s.activeEvent) return null;
  const hours = seconds * BALANCE.gameHoursPerSecond;
  const money = economy(s);
  s.cash += money.profit * hours; s.totalEarned += money.revenue * hours;
  s.hours += hours; s.cooldown = Math.max(0, s.cooldown - seconds);
  for (const server of s.servers) server.age += hours;
  tickLoans(s, hours); tickReputation(s, hours);
  if (s.cash < BALANCE.insolvencyLimit) {
    s.cash = BALANCE.recoveryCash; s.loans = []; s.reputation = Math.max(0, s.reputation - BALANCE.recoveryRepLoss);
    s.customers = s.customers.filter(client => client.id === 'hobby');
    // Recovery sheds expensive contracts, leases and excess hardware, rather than trapping the run in debt.
    s.servers = s.servers.slice(0, 1); s.backups = false; s.failover = false;
    s.network = null; s.location = null; s.tier = 1; s.bankruptcies++;
    addFeed(s, 'Restructured back to a garage', 'Why: your cash fell below the safety limit. Debt and leases were cleared; large contracts and excess hardware were surrendered. You can rebuild.', 'warning');
  }
  const unlocked = checkUnlocks(s); tickEvents(s);
  return unlocked;
}
export function catchUp(s, elapsedSeconds) {
  if (s.paused || s.activeEvent || !Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) return 0;
  const seconds = Math.min(BALANCE.offlineCapSeconds, elapsedSeconds);
  // No offline losses, aging, random incidents or loan-clock drift. A conservative hosting stipend only.
  const gain = Math.max(0, economy(s).profit) * seconds * BALANCE.gameHoursPerSecond * BALANCE.offlineProfitFraction;
  s.cash += gain;
  if (gain > 0) addFeed(s, `Away reserve: $${gain.toFixed(0)}`, 'Why: at most two minutes of positive hosting profit is credited at half rate. There are no offline incidents, losses, or unattended repayments.', 'gain');
  return gain;
}
export function startLoop({ render, onUnlock, onVisibility, isBlocked = () => false }) {
  let previous = performance.now(), accumulated = 0, hiddenAt = null;
  function frame(now) {
    const elapsed = Math.min(MAX_FRAME_MS, now - previous); previous = now;
    if (!document.hidden && !state.paused && !state.activeEvent && !isBlocked()) {
      accumulated += elapsed;
      while (accumulated >= TICK_MS) {
        const unlocked = simulate(state, TICK_MS / 1000 * state.speed);
        accumulated -= TICK_MS;
        if (unlocked) onUnlock(unlocked);
        if (state.activeEvent) { accumulated = 0; break; }
      }
    } else accumulated = 0;
    render(elapsed); requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = Date.now(); onVisibility(); }
    else { if (hiddenAt !== null) catchUp(state, (Date.now() - hiddenAt) / 1000); hiddenAt = null; previous = performance.now(); accumulated = 0; onVisibility(); }
  });
  requestAnimationFrame(frame);
}
