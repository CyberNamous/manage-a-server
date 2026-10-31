import { BALANCE } from '../data/tiers.js';
import { CUSTOMERS, customerType } from '../data/customers.js';
import { NETWORKS, LOCATIONS } from '../data/network.js';
import { EVENT_RULES } from '../data/eventParts.js';
import { capacity } from './capacity.js';
import { debtCost } from './loanSystem.js';
import { random } from './eventHistory.js';
export function demand(s, price = s.price, id = 'hobby') {
  const customer = customerType(id);
  const site = LOCATIONS.find(item => item.id === s.location);
  const value = Math.pow(BALANCE.defaultPrice / price, BALANCE.priceElasticity);
  const trust = BALANCE.reputationDemandBase + s.reputation * BALANCE.reputationDemandFactor;
  return Math.min(BALANCE.demandMax, Math.max(BALANCE.demandMin, value * trust * customer.demand * (site?.demand || 1)));
}
export function economy(s, price = s.price) {
  const cap = capacity(s), site = LOCATIONS.find(item => item.id === s.location);
  const network = NETWORKS.find(item => item.id === s.network);
  const contractRevenue = s.customers.reduce((sum, c) => sum + customerType(c.id).pay * price / BALANCE.defaultPrice, 0);
  const revenue = contractRevenue * cap.service;
  const power = cap.power * BALANCE.powerPrice * (site?.power || 1);
  const rent = BALANCE.rackRent[s.tier] + (site?.rent || 0);
  const protection = (s.backups ? BALANCE.backupHourly : 0) + (s.failover ? BALANCE.failoverHourly : 0);
  const transitFactor = s.network === 'transit' && s.hours < s.priceShockUntil ? EVENT_RULES.transitShockFactor : 1;
  const connectivity = BALANCE.lineCost + (network ? network.hourly + network.perUnit * cap.used * transitFactor : 0);
  const loans = debtCost(s), costs = power + rent + protection + connectivity + loans;
  return { revenue, contractRevenue, costs, profit: revenue - costs, power, rent, protection, connectivity, loans };
}
export function setPrice(s, value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return;
  s.price = Math.max(BALANCE.priceMin, Math.min(BALANCE.priceMax, Math.round(numeric / BALANCE.priceStep) * BALANCE.priceStep));
}
export function signCustomer(s, id) {
  const type = CUSTOMERS.find(item => item.id === id), cap = capacity(s);
  if (!type || s.tier < type.tier || s.reputation < type.reputation) return { ok: false, message: 'Earn more trust or unlock the next tier for this client.' };
  if (s.cooldown > 0) return { ok: false, message: 'Your next application will be ready shortly.' };
  if (s.customers.length >= BALANCE.maxCustomers) return { ok: false, message: 'Your operations team is at its client limit.' };
  if (cap.spare < type.units) return { ok: false, message: 'Buy enough spare capacity before signing this client.' };
  if (s.cash < BALANCE.customerSigningFee) return { ok: false, message: 'Keep a little cash for onboarding.' };
  s.cooldown = BALANCE.applicationCooldown;
  if (random(s) > demand(s, s.price, id)) return { ok: true, message: 'This applicant declined your price. Try again soon, or lower your rate.' };
  s.cash -= BALANCE.customerSigningFee;
  s.customers.push({ id, joined: s.hours, serial: ++s.serial, strain: 0 });
  return { ok: true, message: `${type.name} signed. Capacity and service promises are now committed.` };
}
export function chooseInfrastructure(s, kind, id) {
  if (s.tier < 3) return { ok: false, message: 'Infrastructure choices unlock at Regional ISP.' };
  if (!['network', 'location'].includes(kind) || s[kind]) return { ok: false, message: 'This is a permanent choice for this run.' };
  const entry = (kind === 'network' ? NETWORKS : LOCATIONS).find(item => item.id === id);
  if (!entry || s.cash < entry.cost) return { ok: false, message: 'Not enough cash for this investment.' };
  s.cash -= entry.cost; s[kind] = id;
  return { ok: true, message: `${entry.name} selected permanently. Its costs and risks now apply.` };
}
