import { VERSION, SAVE_KEY, SPEEDS } from './config.js';
import { BALANCE, TIERS } from './data/tiers.js';
import { SERVERS } from './data/servers.js';
import { CUSTOMERS } from './data/customers.js';
import { NETWORKS, LOCATIONS } from './data/network.js';
import { LOANS, LENDING } from './data/loans.js';
import { EVENT_RULES, TRIGGERS, TARGETS, TWISTS, SEVERITIES, RARE_PARTS } from './data/eventParts.js';
import { REP_REASONS, REP_RULES } from './data/reputation.js';
import { initialState } from './state.js';
import { sanitizeServer } from './systems/hardware.js';
import { blankBooks, OPEX_KEYS, SPEND_KEYS } from './systems/ledger.js';
import { eventResponses } from './systems/eventGenerator.js';
// Structured event-history detail: only known fields, length-limited, never trusted as markup.
function sanitizeDetail(d) {
  const out = {}; if (!d || typeof d !== 'object') return out;
  for (const key of ['affected', 'response', 'note']) if (typeof d[key] === 'string' && d[key]) out[key] = d[key].slice(0, 160);
  if (['resolved', 'failed', 'absorbed', 'info'].includes(d.outcome)) out.outcome = d.outcome;
  if (typeof d.cost === 'number' && Number.isFinite(d.cost)) out.cost = Math.min(BALANCE.saveCashMax, Math.max(0, d.cost));
  if (typeof d.rep === 'number' && Number.isFinite(d.rep)) out.rep = Math.min(100, Math.max(-100, d.rep));
  return out;
}
export function validateSave(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('This code does not contain a game save.');
  if (Number(raw.version) > VERSION) throw new Error('This save needs a newer version of the game.');
  // Version 0 used money instead of cash. Unknown fields are never copied.
  const input = raw.version === 0 ? { ...raw, cash: raw.money ?? raw.cash } : raw;
  // Saves older than the current format (v0 money field, v1 without Update 1 data) are migrated with safe defaults.
  const legacy = !(Number(raw.version) >= VERSION);
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
  if (Array.isArray(input.servers)) {
    s.servers = input.servers.slice(0, BALANCE.maxServers[s.tier]).map(c => sanitizeServer(c, s.hours)).filter(Boolean);
    // Servers get unique, stable ids (older saves have none); a missing condition is estimated from age.
    const used = new Set();
    for (const item of s.servers) { if (item.uid && !used.has(item.uid)) used.add(item.uid); else item.uid = 0; }
    let serial = Math.max(0, bounded(input.serverSerial) | 0, ...used);
    for (const item of s.servers) if (!item.uid) item.uid = ++serial;
    s.serverSerial = serial;
  }
  if (!s.servers.length) { s.servers = initialState().servers; s.serverSerial = 1; }
  number('mrng', 1, 4294967295); s.mrng = s.mrng >>> 0 || 1;
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
  if (Array.isArray(input.feed)) s.feed = input.feed.slice(0, BALANCE.feedLimit).filter(e => e && typeof e.title === 'string' && typeof e.why === 'string').map(e => {
    const entry = { title: e.title.slice(0, 600), why: e.why.slice(0, 1000), hour: Math.min(s.hours, bounded(e.hour)), tone: ['gain', 'loss', 'warning'].includes(e.tone) ? e.tone : 'neutral' };
    if (['incident', 'maintenance', 'decision', 'system'].includes(e.cat)) { entry.cat = e.cat; entry.d = sanitizeDetail(e.d); }
    return entry;
  });
  // Financial books and reputation history (new in Update 1). Older saves start tracking from now.
  const sane = (v, min = 0, max = BALANCE.saveCashMax) => typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : 0;
  const b = input.books;
  s.books = blankBooks(s.cash, s.hours);
  if (!legacy && b && typeof b === 'object') {
    s.books = { since: Math.min(s.hours, sane(b.since, 0, BALANCE.saveHoursMax)), opening: sane(b.opening, -BALANCE.saveCashMax), revenue: sane(b.revenue), stipend: sane(b.stipend), borrowed: sane(b.borrowed), repaidEarly: sane(b.repaidEarly), restructured: sane(b.restructured, -BALANCE.saveCashMax),
      opex: Object.fromEntries(OPEX_KEYS.map(k => [k, sane(b.opex?.[k])])), oneOff: Object.fromEntries(SPEND_KEYS.map(k => [k, sane(b.oneOff?.[k])])) };
  }
  const rb = input.repBook;
  if (!legacy && rb && typeof rb === 'object') {
    const totals = {}; for (const r of REP_REASONS) if (typeof rb.totals?.[r.id] === 'number') totals[r.id] = sane(rb.totals[r.id], -1e6, 1e6);
    const buckets = (Array.isArray(rb.buckets) ? rb.buckets : []).slice(-REP_RULES.bucketLimit).filter(x => x && typeof x === 'object').map(x => ({ h: sane(x.h, 0, BALANCE.saveHoursMax), v: Object.fromEntries(REP_REASONS.filter(r => typeof x.v?.[r.id] === 'number').map(r => [r.id, sane(x.v[r.id], -1e6, 1e6)])) }));
    s.repBook = { totals, buckets };
  }
  if (legacy && Number(raw.version) >= 1) s.feed.unshift({ hour: s.hours, tone: 'gain', cat: 'system', d: { outcome: 'info' }, title: 'Manage A Server | Update 1', why: 'Why: hardware upgrades, server condition, diagnostics and maintenance were added. Your existing servers were assessed from their age (none start worse than Fair). Open a server from the Build panel to inspect it.' });
  s.feed = s.feed.slice(0, BALANCE.feedLimit);
  const active = input.activeEvent;
  if (active && typeof active === 'object') {
    const trigger = [...TRIGGERS, ...RARE_PARTS].find(p => p.id === active.trigger?.id);
    const target = TARGETS.find(p => p.id === active.target?.id);
    const severity = SEVERITIES.find(p => p.id === active.severity?.id);
    const twist = TWISTS.find(p => p.id === active.twist?.id);
    if (trigger && target && severity && twist) {
      const scale = severity.scale * target.scale * twist.scale;
      s.activeEvent = { trigger, target, severity, twist, scale, baseCost: Math.ceil((EVENT_RULES.damageFloor + s.customers.length * EVENT_RULES.damagePerCustomer) * scale), text: `A ${trigger.name} is affecting ${target.name} ${twist.name}.`, isRare: RARE_PARTS.includes(trigger), chain: active.chain === true, affected: s.servers.some(x => x.uid === active.affected) ? active.affected : null };
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
