import { TIERS } from '../data/tiers.js';
import { capacity } from '../systems/capacity.js';
import { conditionLevel } from '../data/maintenance.js';
import { isBusy, knownFaults, upgradeLevel } from '../systems/hardware.js';
import { UPGRADES } from '../data/upgrades.js';
import { escapeHTML } from './format.js';
// Visual state of a group of servers: busy (being serviced), bad (poor/critical or known fault), warn (fair), ok.
const RANK = { ok: 0, warn: 1, busy: 2, bad: 3 };
function look(s, group) {
  let status = 'ok', ups = 0, uids = [];
  for (const item of group) {
    const band = conditionLevel(item.condition).id;
    const mine = isBusy(s, item) ? 'busy' : ['poor', 'critical'].includes(band) || knownFaults(item).length ? 'bad' : band === 'fair' ? 'warn' : 'ok';
    if (RANK[mine] > RANK[status]) status = mine;
    ups += UPGRADES.reduce((sum, u) => sum + upgradeLevel(item, u.id), 0); uids.push(item.uid);
  }
  return { status, ups, uids };
}
// One-shot visual effects requested by the simulation (purchase, upgrade, service complete). They expire quickly.
let pendingFx = null;
export function queueSceneFx(kind, uid) { pendingFx = { kind, uid, at: Date.now() }; }
function serverUnit(x, y, rows, premium = false, info = { status: 'ok', ups: 0, fx: '' }) {
  const strips = Array.from({ length: Math.min(5, info.ups) }, (_, k) => `<path d="M55 ${37 + k * 6}l22 -13" stroke="var(--scene-glow)" stroke-width="2" stroke-linecap="round" opacity=".85"/>`).join('');
  return `<g class="unit ${info.fx}" transform="translate(${x} ${y})"><path d="M0 0l30 -17 51 29 -30 18z" fill="var(--scene-object)"/><path d="M0 0l51 30v${rows * 11 + 8}L0 ${rows * 11 + 8}z" fill="var(--scene-metal)"/><path d="M51 30l30 -18v${rows * 11 + 8}l-30 18z" fill="var(--scene-back)"/>${Array.from({ length: rows }, (_, r) => `<path d="M5 ${9 + r * 11}l40 23v7L5 ${16 + r * 11}z" fill="var(--scene-object)"/><path d="M9 ${13 + r * 11}l18 10" stroke="var(--scene-trim)" stroke-width="2"/><circle class="scene-led st-${info.status}" cx="39" cy="${30 + r * 11}" r="1.7"/>`).join('')}${premium ? '<path d="M52 36l24 -14v10l-24 14z" fill="var(--scene-glow)" opacity=".4"/>' : ''}${strips}</g>`;
}
function fxClass(uids) {
  if (!pendingFx || Date.now() - pendingFx.at > 1500 || !uids.includes(pendingFx.uid)) return '';
  return ({ purchase: 'fx-new', upgrade: 'fx-up', maintenanceDone: 'fx-done', maintenance: 'fx-up', fault: 'fx-alert', condition: 'fx-alert' })[pendingFx.kind] || '';
}
function garage(s) {
  const count = Math.min(5, s.servers.length);
  return `<ellipse class="scene-light" cx="350" cy="150" rx="170" ry="90"/><ellipse cx="350" cy="307" rx="239" ry="42" fill="var(--scene-metal)" opacity=".15"/>
  <path d="M110 204L350 67 585 202 347 340z" fill="var(--scene-floor)"/>
  <path d="M110 204V83L350 -52V67z" transform="translate(0 95)" fill="var(--scene-wall)"/>
  <path d="M350 162V43L585 177V297z" fill="var(--scene-back)"/>
  <path d="M110 178L350 43 585 177" fill="none" stroke="var(--scene-trim)" stroke-width="6"/>
  <path d="M115 293V181L347 47v113" fill="none" stroke="var(--scene-trim)" stroke-width="3"/>
  <path d="M128 188L326 74v75L128 262z" fill="var(--scene-back)" stroke="var(--scene-trim)" stroke-width="2"/>
  ${[0,1,2,3,4].map(i => `<path d="M129 ${200+i*13}l197 -114" stroke="var(--scene-object)" stroke-width="2"/>`).join('')}
  <path d="M398 100l82 47v44l-82 -47z" fill="var(--scene-metal)" stroke="var(--scene-trim)" stroke-width="3"/><path d="M438 123v43m-40 -44l82 47" stroke="var(--scene-trim)" stroke-width="2"/>
  <path d="M350 164v173M111 298l239 -134 235 134M170 264l234 134M231 230l234 134" fill="none" stroke="var(--scene-trim)" opacity=".17"/>
  <path d="M298 205l93 -54 80 46 -93 54z" fill="var(--scene-object)"/><path d="M298 205v10l80 46v-10zM378 251l93 -54v10l-93 54z" fill="var(--scene-metal)"/>
  <path d="M309 220v48m151 -54v47m-82 1v47" stroke="var(--scene-trim)" stroke-width="5"/>
  <path d="M365 186v-44l43 25v44z" fill="var(--scene-metal)" stroke="var(--scene-trim)" stroke-width="3"/><path d="M372 157l29 17v20l-29 -17z" fill="var(--scene-glow)" opacity=".7"/><path d="M383 198v14l12 7" stroke="var(--scene-trim)" fill="none"/>
  <path d="M330 204l27 -15 24 14 -27 15z" fill="var(--scene-back)"/>
  ${Array.from({ length: count }, (_, i) => { const info = look(s, [s.servers[i]]); return serverUnit(195 + i * 46, 228 - i * 7, i === 0 ? 4 : 3, s.servers[i]?.id === 'premium', { ...info, fx: fxClass(info.uids) }); }).join('')}
  <path class="cable" d="M217 290C260 321 320 300 331 265S365 228 374 218" fill="none" stroke-width="2"/>
  <g transform="translate(500 254)"><path d="M0 0l18 -10 22 13 -18 10z" fill="var(--scene-trim)"/><path d="M0 0v22l22 13V13z" fill="var(--scene-object)"/><path d="M22 13l18 -10v22L22 35z" fill="var(--scene-metal)"/></g>
  <text x="155" y="331" fill="var(--scene-trim)" font-family="monospace" font-size="8" letter-spacing="2">THE FIRST PACKET IS THE HARDEST.</text>`;
}
function rack(s) {
  return `<ellipse class="scene-light" cx="350" cy="120" rx="200" ry="90"/><ellipse cx="350" cy="330" rx="240" ry="30" fill="var(--scene-metal)" opacity=".16"/><path d="M100 230l250 -145 250 145 -250 145z" fill="var(--scene-floor)"/><path d="M100 230V110L350 -35v120z" fill="var(--scene-wall)"/><path d="M350 85V-35L600 110v120z" fill="var(--scene-back)"/>
  ${Array.from({ length: Math.min(6, Math.ceil(s.servers.length / 2)) }, (_, i) => { const info = look(s, s.servers.slice(i * 2, i * 2 + 2)); return serverUnit(180 + i * 59, 190 - i * 10, 9, s.servers[i * 2]?.id === 'premium', { ...info, fx: fxClass(info.uids) }); }).join('')}
  <path d="M140 259l210 123 210 -123" stroke="var(--scene-trim)" fill="none" stroke-width="3"/><path class="cable" d="M210 324l140 40 180 -110" fill="none" stroke-width="3"/>
  <text x="430" y="120" fill="var(--scene-trim)" font-size="13" font-family="monospace" transform="rotate(30 430 120)">RACK 01 / LIVE</text>`;
}
function regional(s) {
  return `<path d="M64 271l177 -144 100 35 106 -86 186 172 -202 106 -112 -30 -140 24z" fill="var(--scene-floor)" stroke="var(--scene-trim)" stroke-width="2"/>
  <g fill="none" stroke="var(--scene-trim)" opacity=".4"><path d="M88 276l450 -78M150 331l335 -202M222 152l121 184M411 103L331 325M106 260l385 54"/></g>
  <g class="cable" fill="none" stroke-width="2"><path d="M350 215L171 265M350 215L493 212M350 215l-20 105M350 215l52 -96"/></g>
  <path d="M278 180l70 -40 90 52 -70 40z" fill="var(--scene-object)"/><path d="M278 180v89l90 52v-89z" fill="var(--scene-metal)"/><path d="M368 232l70 -40v89l-70 40z" fill="var(--scene-back)"/>
  ${[0,1,2,3].map(i=>`<path d="M290 ${197+i*20}l64 37" stroke="var(--scene-trim)" stroke-width="6"/><path class="scene-led st-${look(s, s.servers).status}" d="M378 ${240+i*18}l48 -27v7l-48 27z"/>`).join('')}
  <g fill="var(--scene-glow)" stroke="var(--scene-metal)" stroke-width="3"><circle cx="171" cy="265" r="7"/><circle cx="493" cy="212" r="7"/><circle cx="330" cy="320" r="7"/><circle cx="402" cy="119" r="7"/></g>
  <text x="78" y="235" fill="var(--scene-trim)" font-family="monospace" font-size="10">LOCAL EXCHANGE</text><text x="470" y="187" fill="var(--scene-trim)" font-family="monospace" font-size="10">${s.network === 'peering' ? 'PEERING' : 'UPLINK'}</text><text x="260" y="364" fill="var(--scene-trim)" font-family="monospace" font-size="9" letter-spacing="2">YOUR CORNER OF THE INTERNET.</text>`;
}
let previous = '';
export function renderScene(s) {
  const sig = s.servers.map(item => `${item.uid}${conditionLevel(item.condition).id[0]}${UPGRADES.reduce((sum, u) => sum + upgradeLevel(item, u.id), 0)}${isBusy(s, item) ? 'b' : ''}${knownFaults(item).length}`).join(',');
  // Ambient lighting mirrors the facility: amber when customers lose service, red when hardware needs attention.
  const cap = capacity(s), worst = look(s, s.servers).status;
  document.getElementById('scene-panel').dataset.mood = cap.service < 1 ? 'alert' : worst === 'bad' ? 'warn' : 'ok';
  const key = `${s.tier}:${s.network}:${s.location}:${sig}`;
  if (key === previous) return;
  previous = key;
  const tier = TIERS[s.tier - 1];
  document.getElementById('scene').innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 410" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${s.tier === 1 ? garage(s) : s.tier === 2 ? rack(s) : regional(s)}</svg>`;
  document.getElementById('scene').setAttribute('aria-label', `${tier.name} with ${s.servers.length} servers and ${cap.installed.toFixed(0)} capacity units`);
  document.getElementById('scene-title').textContent = s.tier === 1 ? 'Good things start small.' : tier.name;
  document.getElementById('scene-subtitle').textContent = tier.subtitle;
  document.getElementById('tier-label').textContent = `CHAPTER ${String(s.tier).padStart(2,'0')} / 06 · ${tier.name.toUpperCase()}`;
  document.getElementById('scene-panel').dataset.tier = escapeHTML(s.tier);
  pendingFx = null;
}
