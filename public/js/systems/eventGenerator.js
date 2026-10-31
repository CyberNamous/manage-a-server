import { TRIGGERS, TARGETS, SEVERITIES, TWISTS, TEMPLATES, RARE_PARTS, EVENT_RULES } from '../data/eventParts.js';
import { RESPONSES, RESPONSE_RULES } from '../data/responses.js';
import { BALANCE } from '../data/tiers.js';
import { LENDING } from '../data/loans.js';
import { capacity } from './capacity.js';
import { eligible, combinationAllowed, pick, random } from './eventHistory.js';
import { eventWeight } from './eventWeights.js';
export function eventResponses(s, event) {
  const cap = capacity(s);
  const valid = RESPONSES.filter(item => {
    const cost = Math.ceil(event.baseCost * item.costScale);
    if (item.needs === 'spare') return cap.spare >= cap.used && cap.used > 0 && s.servers.length > 1;
    if (item.needs === 'afford') return s.cash >= cost;
    if (item.needs === 'reputation') return s.reputation >= item.reputation && s.cash >= cost;
    if (item.needs === 'lowCash') return s.cash < event.baseCost * RESPONSE_RULES.lowCashFactor && s.loans.length < LENDING.maxLoans;
    return true;
  });
  const primary = valid.find(item => ['failover', 'repair', 'negotiate', 'emergency'].includes(item.id));
  const secondary = valid.find(item => item.id !== primary?.id && ['negotiate', 'emergency', 'patch'].includes(item.id));
  const ignore = valid.find(item => item.id === 'ignore');
  return [primary, secondary, ignore].filter(Boolean).slice(0, RESPONSE_RULES.maxChoices).map(item => ({ ...item, cost: Math.ceil(event.baseCost * item.costScale) }));
}
export function assembleEvent(s, chain = null) {
  const regular = TRIGGERS.filter(part => eligible(s, part) && eventWeight(s, part) > 0);
  const rare = RARE_PARTS.filter(part => eligible(s, part) && !s.rareSeen.includes(part.id));
  const canRare = !chain && rare.length && s.rareSeen.length < EVENT_RULES.rareCap && s.hours - s.lastRareHour >= EVENT_RULES.rareCooldownHours;
  const isRare = Boolean(canRare && random(s) < EVENT_RULES.rareChance);
  const candidates = (isRare ? rare : regular).filter(part => TARGETS.some(target => eligible(s, target) && target.tags.some(tag => part.tags.includes(tag)) && combinationAllowed(s, part.id, target.id)));
  const trigger = chain ? TRIGGERS.find(item => item.id === chain.trigger && eligible(s, item)) : pick(s, candidates, item => isRare ? item.weight : eventWeight(s, item));
  if (!trigger) return null;
  const targets = TARGETS.filter(part => eligible(s, part) && part.tags.some(tag => trigger.tags.includes(tag)) && (chain || combinationAllowed(s, trigger.id, part.id)));
  if (!targets.length) return null;
  const target = pick(s, targets);
  const severity = chain ? SEVERITIES.find(item => item.id === EVENT_RULES.chainSeverity) : pick(s, SEVERITIES, item => item.weight);
  const twist = pick(s, TWISTS.filter(part => eligible(s, part) && part.tags.some(tag => tag === 'any' || trigger.tags.includes(tag))));
  const scale = severity.scale * twist.scale * target.scale;
  const baseCost = Math.ceil((EVENT_RULES.damageFloor + s.customers.length * EVENT_RULES.damagePerCustomer) * scale);
  const text = pick(s, TEMPLATES).replace('{trigger}', trigger.name).replace('{target}', target.name).replace('{twist}', twist.name);
  const event = { trigger, target, severity, twist, scale, baseCost, text, isRare, chain: Boolean(chain), responses: [] };
  event.responses = eventResponses(s, event);
  if (isRare) { s.rareSeen.push(trigger.id); s.lastRareHour = s.hours; }
  return event;
}
