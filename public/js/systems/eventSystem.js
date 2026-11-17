import { EVENT_RULES, RARE_EFFECTS } from '../data/eventParts.js';
import { RESPONSE_RULES } from '../data/responses.js';
import { BALANCE } from '../data/tiers.js';
import { addFeed } from '../state.js';
import { random, recordEvent } from './eventHistory.js';
import { assembleEvent } from './eventGenerator.js';
import { takeLoan } from './loanSystem.js';
import { changeReputation } from './reputation.js';
import { fleetEffect } from './hardware.js';
import { applyIncidentWear, affectedText } from './maintenance.js';
import { spend } from './ledger.js';
import { emit } from './signals.js';
export function scheduleEvent(s) {
  s.nextEventHour = s.hours + (EVENT_RULES.minGapHours + random(s) * (EVENT_RULES.maxGapHours - EVENT_RULES.minGapHours)) / (1 + (s.tier - 1) * EVENT_RULES.tierFrequency);
}
export function tickEvents(s) {
  if (s.activeEvent) return;
  const chainIndex = s.chains.findIndex(item => item.at <= s.hours);
  if (s.hours < s.nextEventHour && chainIndex < 0) return;
  const chain = chainIndex < 0 ? null : s.chains.splice(chainIndex, 1)[0];
  const event = assembleEvent(s, chain);
  scheduleEvent(s);
  if (event) { s.activeEvent = event; recordEvent(s, event); }
}
export function resolveEvent(s, id) {
  const event = s.activeEvent, choice = event?.responses.find(item => item.id === id);
  if (!event || !choice) return { ok: false, message: 'That decision is no longer available.' };
  if (s.cash < choice.cost && choice.cost > 0) return { ok: false, message: 'You cannot afford this response.' };
  if (id === 'emergency') { const loan = takeLoan(s, null, true); if (!loan.ok) return loan; }
  const repBefore = s.reputation;
  spend(s, 'incidents', choice.cost);
  const failed = random(s) < choice.failureChance;
  const ignored = id === 'ignore';
  const damageScale = choice.damageScale * (failed ? RESPONSE_RULES.failedDamageScale : 1);
  const protection = s.failover || s.backups;
  const protectionScale = s.failover ? EVENT_RULES.failoverDuration : s.backups ? EVENT_RULES.protectedDuration : EVENT_RULES.noProtectionDuration;
  // Storage upgrades (fleet average) restore service faster after an outage.
  const recovery = fleetEffect(s, 'storage', 'recovery');
  const duration = EVENT_RULES.outageBase * event.scale * choice.durationScale * protectionScale * (1 - recovery);
  let damage = 0, consequence = '', why = '', wear = null;
  const effect = event.trigger.effect;
  if (effect === 'outage') {
    s.outageUntil = Math.max(s.outageUntil, s.hours + duration);
    damage = Math.ceil(event.baseCost * damageScale);
    consequence = `${duration.toFixed(2)} game hours of interrupted service`;
    why = `Why: ${protection ? 'your protection reduced recovery time' : 'without backups or failover recovery takes longer'}. ${failed ? 'The workaround also failed. ' : ''}${recovery > 0 ? `Storage upgrades cut recovery time by ${Math.round(recovery * 100)}%. ` : ''}Lost income and customer service credits may follow while service is down.`;
    wear = applyIncidentWear(s, event, choice, failed);
    if (wear) why += ` Server #${wear.item.uid} lost ${Math.round(wear.before - wear.after)} points of condition. A hardware inspection can reveal lingering faults.`;
  } else if (effect === 'traffic') {
    s.trafficUntil = s.hours + EVENT_RULES.spikeDuration * damageScale;
    if (ignored) changeReputation(s, -event.scale, 'incident');
    consequence = 'traffic is using extra capacity';
    why = 'Why: a traffic spike reduces available headroom until it passes. Spare hardware and RAM expansion protect service; publicity can bring future customers.';
  } else if (effect === 'price') {
    s.priceShockUntil = s.hours + EVENT_RULES.spikeDuration * damageScale;
    consequence = 'transit pricing temporarily increased';
    why = 'Why: your transit supplier charges more per occupied unit until the shock passes. Permanent peering avoids these events.';
  } else if (effect === 'opportunity') {
    if (event.trigger.id === 'cablefund') {
      if (!ignored && s.cash >= RARE_EFFECTS.consortiumCost) {
        spend(s, 'setup', RARE_EFFECTS.consortiumCost); s.consortium = true;
        changeReputation(s, RARE_EFFECTS.consortiumReputation, 'opportunity');
        consequence = 'consortium research pledge recorded';
      } else consequence = 'ocean cable invitation declined';
      why = `Why: a research pledge costs $${RARE_EFFECTS.consortiumCost} and earns trust, but does not unlock cable construction in v1.`;
    } else {
      const offer = Math.ceil(s.customers.length * RARE_EFFECTS.offerPerCustomer);
      consequence = `an indicative $${offer} buyout offer was recorded, not accepted`;
      if (!ignored) changeReputation(s, RARE_EFFECTS.publicityReputation, 'opportunity');
      why = 'Why: this non-binding inquiry creates publicity. You keep your company; no sale or restart occurs.';
    }
  } else {
    damage = Math.ceil(event.baseCost * damageScale);
    changeReputation(s, -(event.scale * BALANCE.reputationLoss * (ignored ? RESPONSE_RULES.ignoreRepScale : RESPONSE_RULES.resolvedRepScale)), 'incident');
    consequence = effect === 'trust' ? 'customer trust took a hit' : 'the financial issue was settled';
    why = `Why: ${ignored ? 'leaving the issue unanswered made the impact larger' : 'your response reduced the impact'}. Severity and the affected area set the final cost.`;
  }
  spend(s, 'incidents', damage);
  const escalates = (ignored || failed) && !event.chain && effect !== 'opportunity';
  if (escalates) s.chains.push({ trigger: event.trigger.followup || event.trigger.id, at: s.hours + EVENT_RULES.chainDelayHours });
  const outcome = effect === 'opportunity' ? 'info' : ignored ? 'absorbed' : failed ? 'failed' : 'resolved';
  addFeed(s, `${event.severity.name} ${event.trigger.name}: ${consequence}. $${choice.cost + damage} immediate cost.`, why, damage || effect === 'outage' ? 'loss' : 'neutral', {
    cat: 'incident', affected: affectedText(s, event), response: choice.name, outcome, cost: choice.cost + damage, rep: s.reputation - repBefore,
    note: escalates ? 'Unresolved: this may escalate later.' : '',
  });
  emit('incident', { outcome });
  s.activeEvent = null;
  return { ok: true, message: 'Decision recorded. The event feed explains the outcome.' };
}
