import { BALANCE, TIERS } from '../data/tiers.js';
import { SERVERS, PROTECTIONS } from '../data/servers.js';
import { CUSTOMERS } from '../data/customers.js';
import { NETWORKS, LOCATIONS } from '../data/network.js';
import { LOANS, LENDING } from '../data/loans.js';
import { EVENT_RULES } from '../data/eventParts.js';
import { uptime } from '../state.js';
import { economy, demand } from '../systems/economy.js';
import { capacity } from '../systems/capacity.js';
import { goalProgress } from '../systems/unlocks.js';
import { loanQuote } from '../systems/loanSystem.js';
import { money, percent, escapeHTML as esc, gameTime, moneySentence, goalNumber } from './format.js';
import { renderScene } from './scene.js';
const cache = new Map();
const element = id => document.getElementById(id);
function text(id, value) { const node = element(id); if (node && node.textContent !== value) node.textContent = value; }
function html(id, value) { if (cache.get(id) !== value) { element(id).innerHTML = value; cache.set(id,value); } }
function hidden(id, value) { element(id).hidden = value; }
function button(action, id, label, disabled, title, className = '') { return `<button data-action="${action}" data-value="${id}"${disabled ? ' disabled' : ''} title="${esc(title)}" class="${className}">${label}</button>`; }
function serverCards(s) {
  return SERVERS.map(model => {
    const locked = s.tier < model.tier, owned = s.servers.filter(item=>item.id===model.id).length;
    return `<article class="card"><div class="row"><h3>${model.name}<span class="card-label">${model.label}</span></h3><span class="tag">${owned} owned</span></div><p>${model.description}</p><div class="specs">${model.capacity} capacity · ${model.power} kW · ${money(model.power * BALANCE.powerPrice,true)}/h base power</div><div class="card-bottom"><strong class="price-tag">${money(model.cost)}</strong>${button('buy',model.id,locked ? 'Tier 2' : '+ Install',locked||s.cash<model.cost||s.servers.length>=BALANCE.maxServers[s.tier],`Buy a ${model.name.toLowerCase()} server. ${model.description}`)}</div></article>`;
  }).join('');
}
function protections(s) {
  return PROTECTIONS.map(item=>({...item,cost:item.id==='backups'?BALANCE.backupCost:BALANCE.failoverCost,hourly:item.id==='backups'?BALANCE.backupHourly:BALANCE.failoverHourly})).filter(item=>s.tier>=item.tier).map(item=>`<article class="card"><h3>${item.name}</h3><p>${item.description}</p><div class="card-bottom"><span class="specs">${money(item.cost)} + ${money(item.hourly)}/h</span>${s[item.id]?'<span class="tag installed">✓ Installed</span>':button('protect',item.id,'Install',s.cash<item.cost,`${item.name}: ${money(item.cost)} now and ${money(item.hourly)}/h thereafter`)}</div></article>`).join('');
}
function infrastructure(s) {
  return [{kind:'network',title:'Network strategy',entries:NETWORKS},{kind:'location',title:'Expansion location',entries:LOCATIONS}].map(group=>`<h3>${group.title}</h3>${group.entries.filter(entry=>!s[group.kind]||s[group.kind]===entry.id).map(entry=>`<article class="card"><h3>${entry.name}</h3><p>${entry.description}</p><div class="card-bottom"><span class="price-tag">${money(entry.cost)}</span>${s[group.kind]?'<span class="tag installed">✓ Permanent choice</span>':button(group.kind,entry.id,'Compare',s.cash<entry.cost,'Review and confirm this permanent choice')}</div></article>`).join('')}`).join('');
}
function loans(s) {
  return LOANS.map(l=>{const q=loanQuote(l);return `<article class="card"><h3>${l.name}</h3><p>Borrow ${money(l.principal)}. Repay ${money(q.monthly,true)}/month for ${l.termMonths} months, including interest.</p>${button('loan',l.id,'Review terms',s.loans.length>=LENDING.maxLoans,'See interest, principal, and monthly costs before accepting')}</article>`;}).join('')+s.loans.map((l,i)=>`<article class="card"><h3>${esc(l.name)}</h3><p>${money(l.remaining)} remaining · ${money(loanQuote(l).hourly,true)}/h</p>${button('repay',i,'Repay early',s.cash<l.remaining,'Pay the remaining principal and stop all future charges')}</article>`).join('');
}
function customerCards(s) {
  const cap=capacity(s);
  return CUSTOMERS.filter(c=>c.tier<=s.tier).map(c=>`<article class="card"><div class="row"><h3>${c.name}</h3><span class="tag">${money(c.pay*s.price/BALANCE.defaultPrice)}/h</span></div><p>${c.description}</p><div class="specs">${c.units} capacity · needs ${c.uptime}% uptime · ${money(c.penalty)} exit credit</div><div class="card-bottom"><small class="muted">${percent(demand(s,s.price,c.id)*100)} acceptance</small>${button('sign',c.id,s.cooldown>0 ? `Ready in ${Math.ceil(s.cooldown)}s` : '+ Sign',s.cooldown>0||cap.spare<c.units||s.reputation<c.reputation||s.cash<BALANCE.customerSigningFee||s.customers.length>=BALANCE.maxCustomers,`Apply to host a ${c.name.toLowerCase()}; ${money(BALANCE.customerSigningFee)} onboarding only if accepted. ${percent(demand(s,s.price,c.id)*100)} applicant acceptance.`)}</div></article>`).join('');
}
export function pricingPreview(s, value) {
  const baseline=economy(s,BALANCE.defaultPrice), preview=economy(s,value);
  const baselineDemand=demand(s,BALANCE.defaultPrice), newDemand=demand(s,value);
  const change=Math.round(Math.abs(newDemand/baselineDemand-1)*100);
  return `Profit: ${money(baseline.profit,true)}/h → ${money(preview.profit,true)}/h versus market pricing, with about ${change}% ${newDemand<baselineDemand?'fewer':'more'} applicants accepting. ${money(preview.revenue,true)}/h from current customers; not a promise of new signups.`;
}
export function renderRoadmap(s) {
  const info=goalProgress(s);
  return TIERS.map(tier=>`<article class="roadmap-item ${s.tier===tier.id?'current':''}"><div class="row"><h3>${String(tier.id).padStart(2,'0')} · ${tier.name}</h3><span class="roadmap-label">${tier.locked?'Locked · future':tier.id<s.tier?'✓ Earned':tier.id===s.tier?'Operating':'Next chapter'}</span></div><p>${tier.description}</p>${info.next?.id===tier.id&&!tier.locked?info.goals.map(g=>`<div class="goal-check"><span>${g.progress>=1?'✓':'○'} ${g.label}</span><span>${goalNumber(g,g.value)} / ${goalNumber(g,g.target)}</span></div>`).join(''):''}</article>`).join('');
}
let shownCash = null, renderingBudget = 0;
export function createRenderer(s, isDeskOpen) {
  const price=element('price'); price.min=BALANCE.priceMin;price.max=BALANCE.priceMax;price.step=BALANCE.priceStep;price.value=s.price;
  return function render(elapsed=1000) {
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(shownCash===null||reduced)shownCash=s.cash;else shownCash+=(s.cash-shownCash)*Math.min(1,elapsed/160);
    text('cash',money(shownCash));
    renderingBudget+=elapsed;if(renderingBudget<100)return;renderingBudget=0;
    const e=economy(s),cap=capacity(s),info=goalProgress(s);
    text('profit',`${e.profit>=0?'+':''}${money(e.profit,true)}`);element('profit').className=e.profit>=0?'gain':'loss';
    text('reputation',`${s.reputation.toFixed(1)} / ${BALANCE.reputationMax}`);
    text('rep-note',s.reputation>=TIERS[2].goals.find(g=>g.key==='reputation').target?'A trusted name in the region':s.reputation>=TIERS[1].goals.find(g=>g.key==='reputation').target?'Word is getting around':'A name worth building');
    text('uptime',percent(uptime(s),2));text('capacity',`${cap.used} / ${cap.installed}`);text('power',`${cap.power.toFixed(2)} kW · paid even when idle`);
    document.querySelectorAll('.extra-stat').forEach(node=>node.hidden=s.tier<2);element('cash').closest('.stats').classList.toggle('expanded',s.tier>=2);
    text('profit-note',e.profit<0?'Costs are outpacing your income':'After all running costs');
    text('cash-note',s.cash<0?'Cash is negative. Stabilize now.':'Keep a little room for surprises');
    text('clock',gameTime(s.hours));text('scene-inventory',`${s.servers.length} server${s.servers.length===1?'':'s'} · ${s.customers.length} customer${s.customers.length===1?'':'s'} · ${cap.spare.toFixed(0)} spare capacity`);
    const status=element('service-status');status.textContent=s.activeEvent?'Ⅱ Decision required':s.paused||isDeskOpen()?'Ⅱ Paused':cap.service<1?'! Service interrupted':'● Systems online';status.className=`status-pill ${cap.service<1?'warning':''}`;
    const pause=element('pause');pause.textContent=s.paused?'▶':'Ⅱ';pause.setAttribute('aria-label',s.paused?'Resume simulation':'Pause simulation');pause.setAttribute('aria-pressed',String(s.paused));
    for(const b of document.querySelectorAll('[data-action="speed"]'))b.setAttribute('aria-pressed',String(Number(b.dataset.value)===s.speed));
    text('money-sentence',moneySentence(e));html('money-details',Object.entries({Income:e.revenue,Electricity:e.power,'Space & rent':e.rent,Connectivity:e.connectivity,Protection:e.protection,'Interest & principal':e.loans,'Net profit = income − costs':e.profit}).map(([label,value])=>`<div class="detail-row"><span>${label}</span><span>${money(value,true)}/h</span></div>`).join(''));
    text('advisor',cap.service<1?'Service is interrupted. Avoid new promises until capacity is restored.':e.profit<0?'Your costs exceed income. Fill spare capacity or reprice before buying more hardware.':cap.utilization<BALANCE.capacityWarning?'There is room to grow. Sign customers before buying capacity you do not need.':'You are nearly full. Build headroom before accepting more promises.');
    html('server-cards',serverCards(s));html('protection-cards',protections(s));hidden('infrastructure-section',s.tier<3);hidden('loans-section',s.tier<3);
    if(s.tier>=3){html('infrastructure-cards',infrastructure(s));html('loan-cards',loans(s));}
    html('customer-cards',customerCards(s));text('customer-count',`${s.customers.length} active`);
    html('customer-roster',s.customers.length?CUSTOMERS.map(c=>{const count=s.customers.filter(item=>item.id===c.id).length;return count?`<div class="roster-row"><span>${count} × ${c.plural}<br><small>${c.uptime}% uptime promise</small></span><strong>${money(count*c.pay*s.price/BALANCE.defaultPrice)}/h</strong></div>`:'';}).join(''):'<p class="muted fine">Your first new customer is one application away.</p>');
    if(document.activeElement!==price)price.value=s.price;
    text('price-output',`${s.price}% of market`);text('price-preview',pricingPreview(s,s.price));
    // Append new log entries without rebuilding the live region and rereading the whole history.
    const feed=element('event-feed'),signature=JSON.stringify(s.feed);
    if(cache.get('feed')!==signature){
      if(!s.feed.length){feed.innerHTML='<p class="empty">A quiet start. Your operator’s log will explain every incident and why it happened.</p>';}
      else {const old=cache.get('feed-items')||[];const newest=s.feed.filter(item=>!old.includes(JSON.stringify(item)));if(!old.length||!s.feed.some(item=>old.includes(JSON.stringify(item))))feed.replaceChildren();else feed.querySelector('.empty')?.remove();for(const item of newest.reverse()){const entry=document.createElement('article');entry.className='feed-entry';entry.innerHTML=`<span class="feed-time">${gameTime(item.hour)}</span><h3 class="${item.tone}">${esc(item.title)}</h3><p>${esc(item.why)}</p>`;feed.prepend(entry);}while(feed.children.length>EVENT_RULES.outcomeHistoryLimit)feed.lastElementChild.remove();}
      cache.set('feed',signature);cache.set('feed-items',s.feed.map(item=>JSON.stringify(item)));
    }
    const done=info.next?.locked;
    text('goal-caption',done?'V1 FRONTIER REACHED':'YOUR NEXT CHAPTER');text('goal-title',done?'Regional ISP → the seabed awaits':`Grow into a ${info.next.name}`);
    const remaining=info.goals.filter(g=>g.progress<1);
    text('goal-hint',done?'Data Center, Backbone Carrier & Submarine Cable are future chapters.':remaining.length?`${remaining[0].label}: ${goalNumber(remaining[0],remaining[0].value)} of ${goalNumber(remaining[0],remaining[0].target)}`:'All requirements met. Preparing your next chapter.');
    element('goal-fill').style.width=`${info.progress*100}%`;element('goal-fill').parentElement.setAttribute('aria-valuenow',String(Math.round(info.progress*100)));
    text('goal-fraction',done?'3 of 6 chapters · v1 complete':`${info.goals.filter(g=>g.progress>=1).length} / ${info.goals.length} goals met`);
    html('roadmap',renderRoadmap(s));renderScene(s);
  };
}
