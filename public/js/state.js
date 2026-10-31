import { VERSION } from './config.js';
import { BALANCE } from './data/tiers.js';
import { EVENT_RULES } from './data/eventParts.js';
export function initialState(seed = Date.now() >>> 0) {
  return {
    version: VERSION, rng: seed || 1, cash: BALANCE.startCash, reputation: BALANCE.startReputation,
    tier: 1, hours: 0, servedHours: 0, observedHours: 0, price: BALANCE.defaultPrice,
    servers: [{ id: 'budget', age: BALANCE.startServerAge }],
    customers: Array.from({ length: BALANCE.startCustomers }, (_, i) => ({ id: 'hobby', joined: 0, serial: i + 1, strain: 0 })),
    serial: BALANCE.startCustomers, backups: false, failover: false, location: null, network: null,
    loans: [], lastLoanHour: null, cooldown: 0, outageUntil: 0, trafficUntil: 0, priceShockUntil: 0,
    nextEventHour: EVENT_RULES.graceHours, activeEvent: null, eventHistory: [], chains: [],
    rareSeen: [], lastRareHour: -EVENT_RULES.rareCooldownHours, feed: [],
    speed: 1, paused: false, tutorialDone: false, savedAt: Date.now(), consortium: false,
    totalEarned: 0, bankruptcies: 0,
  };
}
export const state = initialState();
export function replaceState(next) {
  for (const key of Object.keys(state)) delete state[key];
  Object.assign(state, next);
}
export function uptime(s) {
  return (BALANCE.servedBaselineHours + s.servedHours) / (BALANCE.servedBaselineHours + s.observedHours) * 100;
}
export function addFeed(s, title, why, tone = 'neutral') {
  s.feed.unshift({ hour: s.hours, title, why, tone });
  s.feed = s.feed.slice(0, BALANCE.feedLimit);
}
