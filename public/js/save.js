import { VERSION, SAVE_KEY, SPEEDS } from './config.js';
import { BALANCE, TIERS } from './data/tiers.js';
import { SERVERS } from './data/servers.js';
import { CUSTOMERS } from './data/customers.js';
import { NETWORKS, LOCATIONS } from './data/network.js';
import { LOANS, LENDING } from './data/loans.js';
import { EVENT_RULES, TRIGGERS, TARGETS, TWISTS, SEVERITIES, RARE_PARTS } from './data/eventParts.js';
import { initialState } from './state.js';
import { eventResponses } from './systems/eventGenerator.js';
export function validateSave(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('This code does not contain a game save.');
  if (Number(raw.version) > VERSION) throw new Error('This save needs a newer version of the game.');
  // Version 0 used money instead of cash. Unknown fields are never copied.
  const input = raw.version === 0 ? { ...raw, cash: raw.money ?? raw.cash } : raw;
  const s = initialState();
  const number = (key, min, max) => { if (typeof input[key] === 'number' && Number.isFinite(input[key])) s[key] = Math.min(max, Math.max(min, input[key])); };
  number('cash', BALANCE.insolvencyLimit, BALANCE.saveCashMax);
  number('reputation', 0, BALANCE.reputationMax); number('tier', 1, TIERS.filter(t => !t.locked).length); s.tier = Math.floor(s.tier);
  for (const key of ['hours', 'servedHours', 'observedHours', 'outageUntil', 'trafficUntil', 'priceShockUntil', 'nextEventHour', 'totalEarned']) number(key, 0, BALANCE.saveHoursMax);
  s.servedHours = Math.min(s.servedHours, s.observedHours);
  number('price', BALANCE.priceMin, BALANCE.priceMax); number('cooldown', 0, BALANCE.applicationCooldown);
  number('rng', 1, 4294967295); s.rng = s.rng >>> 0;
  number('savedAt', 0, Date.now()); number('serial', 0, BALANCE.saveCashMax); number('bankruptcies', 0, BALANCE.saveCashMax);
  if (typeof input.lastLoanHour === 'number' && Number.isFinite(input.lastLoanHour)) s.lastLoanHour = Math.min(s.hours, Math.max(0, input.lastLoanHour));
  for (const key of ['backups', 'failover', 'paused', 'tutorialDone', 'consortium']) if (typeof input[key] === 'boolean') s[key] = input[key];
  s.speed = SPEEDS.includes(input.speed) ? input.speed : 1;
  s.network = NETWORKS.some(n => n.id === input.network) ? input.network : null;
  s.location = LOCATIONS.some(n => n.id === input.location) ? input.location : null;
  const bounded = value => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(BALANCE.saveHoursMax, value)) : 0;
  if (Array.isArray(input.servers)) s.servers = input.servers.slice(0, BALANCE.maxServers[s.tier]).filter(c => c && SERVERS.some(t => t.id === c.id)).map(c => ({ id: c.id, age: bounded(c.age) }));
  if (!s.servers.length) s.servers = initialState().servers;
  if (Array.isArray(input.customers)) s.customers = input.customers.slice(0, BALANCE.maxCustomers).filter(c => c && CUSTOMERS.some(t => t.id === c.id)).map((c, index) => ({ id: c.id, joined: Math.min(s.hours, bounded(c.joined)), serial: index + 1, strain: bounded(c.strain) }));
  s.serial = Math.max(s.serial, s.customers.length);
  if (Array.isArray(input.loans)) s.loans = input.loans.slice(0, LENDING.maxLoans).flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const model = LOANS.find(l => l.id === item.id) || (item.id === 'emergency' ? { id: 'emergency', name: 'Emergency loan', principal: LENDING.emergencyPrincipal, monthlyRate: LENDING.emergencyMonthlyRate, termMonths: LENDING.emergencyTermMonths } : null);
    return model && Number.isFinite(item.remaining) && item.remaining > 0 ? [{ ...model, remaining: Math.min(model.principal, item.remaining) }] : [];
  });
  if (Array.isArray(input.eventHistory)) s.eventHistory = input.eventHistory.slice(-EVENT_RULES.historyLimit).filter(e => e && [...TRIGGERS, ...RARE_PARTS].some(t => t.id === e.trigger) && TARGETS.some(t => t.id === e.target)).map(e => ({ trigger: e.trigger, target: e.target, hour: Math.min(s.hours, bounded(e.hour)) }));
  if (Array.isArray(input.chains)) s.chains = input.chains.slice(0, EVENT_RULES.historyLimit).filter(e => e && TRIGGERS.some(t => t.id === e.trigger)).map(e => ({ trigger: e.trigger, at: Math.min(s.hours + EVENT_RULES.chainDelayHours, bounded(e.at)) }));
  if (Array.isArray(input.rareSeen)) s.rareSeen = [...new Set(input.rareSeen.filter(id => RARE_PARTS.some(p => p.id === id)))].slice(0, EVENT_RULES.rareCap);
  if (typeof input.lastRareHour === 'number' && Number.isFinite(input.lastRareHour)) s.lastRareHour = Math.min(s.hours, input.lastRareHour);
  if (Array.isArray(input.feed)) s.feed = input.feed.slice(0, BALANCE.feedLimit).filter(e => e && typeof e.title === 'string' && typeof e.why === 'string').map(e => ({ title: e.title.slice(0, 600), why: e.why.slice(0, 1000), hour: Math.min(s.hours, bounded(e.hour)), tone: ['gain', 'loss', 'warning'].includes(e.tone) ? e.tone : 'neutral' }));
  const active = input.activeEvent;
  if (active && typeof active === 'object') {
    const trigger = [...TRIGGERS, ...RARE_PARTS].find(p => p.id === active.trigger?.id);
    const target = TARGETS.find(p => p.id === active.target?.id);
    const severity = SEVERITIES.find(p => p.id === active.severity?.id);
    const twist = TWISTS.find(p => p.id === active.twist?.id);
    if (trigger && target && severity && twist) {
      const scale = severity.scale * target.scale * twist.scale;
      s.activeEvent = { trigger, target, severity, twist, scale, baseCost: Math.ceil((EVENT_RULES.damageFloor + s.customers.length * EVENT_RULES.damagePerCustomer) * scale), text: `A ${trigger.name} is affecting ${target.name} ${twist.name}.`, isRare: RARE_PARTS.includes(trigger), chain: active.chain === true };
      s.activeEvent.responses = eventResponses(s, s.activeEvent);
    }
  }
  s.version = VERSION;
  return s;
}
export function saveGame(s) {
  s.savedAt = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); return { ok: true, message: 'Game saved on this device.' }; }
  catch { return { ok: false, message: 'Storage is unavailable. Keep playing, and export a save code before leaving.' }; }
}
export function loadGame() {
  try { const text = localStorage.getItem(SAVE_KEY); return text ? { state: validateSave(JSON.parse(text)), error: null } : { state: null, error: null }; }
  catch { return { state: null, error: 'The local save could not be read. A fresh game is available; you can also import a save code.' }; }
}
export function exportCode(s) {
  const bytes = new TextEncoder().encode(JSON.stringify({ ...s, savedAt: Date.now() }));
  return btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''));
}
export function importCode(code) {
  if (typeof code !== 'string' || code.length > 2000000) throw new Error('This save code is empty or too large.');
  try { return validateSave(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(code.trim()), ch => ch.charCodeAt(0))))); }
  catch (error) { if (error.message.includes('newer version')) throw error; throw new Error('Invalid save code. Copy the entire code without changing it.'); }
}
