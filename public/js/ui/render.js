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
import { OPEX_KEYS, OPEX_LABELS } from '../systems/ledger.js';
import { money, percent, escapeHTML as esc, gameTime, moneySentence, goalNumber, button } from './format.js';
import { shopCards, fleetHTML } from './hardwareView.js';
import { FEED_FILTERS, feedMatches, feedEntryHTML } from './historyView.js';
import { renderScene } from './scene.js';
const cache = new Map();
const element = id => document.getElementById(id);
function text(id, value) { const node = element(id); if (node && node.textContent !== value) node.textContent = value; }
function html(id, value) { if (cache.get(id) !== value) { element(id).innerHTML = value; cache.set(id,value); } }
function hidden(id, value) { element(id).hidden = value; }
function protections(s) {
  return PROTECTIONS.map(item=>({...item,cost:item.id==='backups'?BALANCE.backupCost:BALANCE.failoverCost,hourly:item.id==='backups'?BALANCE.backupHourly:BALANCE.failoverHourly})).filter(item=>s.tier>=item.tier).map(item=>`<article class="card"><h3>${item.name}</h3><p>${item.description}</p><div class="card-bottom"><span class="specs">${money(item.cost)} + ${money(item.hourly)}/h</span>${s[item.id]?'<span class="tag installed">✓ Installed</span>':button('protect',item.id,'Install',s.cash<item.cost,`${item.name}: ${money(item.cost)} now and ${money(item.hourly)}/h thereafter`)}</div></article>`).join('');
}
function infrastructure(s) {
  return [{kind:'network',title:'Network strategy',entries:NETWORKS},{kind:'location',title:'Expansion location',entries:LOCATIONS}].map(group=>`<h3>${group.title}</h3>${group.entries.filter(entry=>!s[group.kind]||s[group.kind]===entry.id).map(entry=>`<article class="card"><h3>${entry.name}</h3><p>${entry.description}</p><div class="card-bottom"><span class="price-tag">${money(entry.cost)}</span>${s[group.kind]?'<span class="tag installed">✓ Permanent choice</span>':button(group.kind,entry.id,'Compare',s.cash<entry.cost,'Review and confirm this permanent choice')}</div></article>`).join('')}`).join('');
}
function loans(s) {
  return LOANS.map(l=>{const q=loanQuote(l);return `<article class="card"><h3>${l.name}</h3><p>Borrow ${money(l.principal)}. Repay ${money(q.monthly,true)}/month for ${l.termMonths} months, including interest.</p>${button('loan',l.id,'Review terms',s.loans.length>=LENDING.maxLoans,'See interest, principal, and monthly costs before accepting')}</article>`;}).join('')+s.loans.map((l,i)=>`<article class="card"><h3>${esc(l.name)}</h3><p>${money(l.remaining)} remaining · ${money(loanQuote(l).hourly,true)}/h</p>${button('repay',i,'Repay early',s.cash<l.remaining,'Pay the remaining principal and stop all future charges')}</article>`).join('');
}
function tolerance(type) { return BALANCE.churnFloorHours + (100 - type.uptime) * BALANCE.churnScale; }
function customerCards(s) {
  const cap=capacity(s);
  return CUSTOMERS.filter(c=>c.tier<=s.tier).map(c=>{
    const lacksRep=s.reputation<c.reputation, accept=percent(demand(s,s.price,c.id)*100);
    return `<article class="card"><div class="row"><h3>${c.name}<span class="card-label">${c.category} · hourly contract</span></h3><span class="tag">${money(c.pay*s.price/BALANCE.defaultPrice)}/h</span></div><p>${c.description}</p><dl class="spec-grid"><div><dt>Uses</dt><dd>${c.units} capacity</dd></div><div><dt>Uptime promise</dt><dd>${c.uptime}%</dd></div><div><dt>Exit credit</dt><dd>${money(c.penalty)}</dd></div><div><dt>Needs trust</dt><dd class="${lacksRep?'warning':''}">${c.reputation}${lacksRep?` (you ${s.reputation.toFixed(0)})`:''}</dd></div></dl><div class="card-bottom"><small class="muted">${accept} acceptance${cap.spare<c.units?` · needs ${(c.units-cap.spare).toFixed(1)} more spare capacity`:''}</small>${button('sign',c.id,s.cooldown>0 ? `Ready in ${Math.ceil(s.cooldown)}s` : '+ Sign',s.cooldown>0||cap.spare<c.units||lacksRep||s.cash<BALANCE.customerSigningFee||s.customers.length>=BALANCE.maxCustomers,`Apply to host a ${c.name.toLowerCase()}; ${money(BALANCE.customerSigningFee)} onboarding only if accepted. ${accept} applicant acceptance.`)}</div></article>`;
  }).join('');
}
function roster(s) {
  if(!s.customers.length) return '<p class="muted fine">Your first new customer is one application away.</p>';
  return CUSTOMERS.map(c=>{
    const mine=s.customers.filter(item=>item.id===c.id); if(!mine.length) return '';
    const worst=Math.max(...mine.map(item=>item.strain/tolerance(c))), strained=mine.filter(item=>item.strain>0).length;
    const status=worst>0.6?['bad',`${strained} close to leaving`]:strained?['fair',`${strained} under strain`]:['good','All healthy'];
    return `<div class="roster-row"><span>${mine.length} × ${c.plural} <span class="chip ${status[0]}">${status[1]}</span><br><small>${c.category} · ${mine.length*c.units} capacity · ${c.uptime}% uptime promise</small></span><strong>${money(mine.length*c.pay*s.price/BALANCE.defaultPrice)}/h</strong></div>`;
  }).join('');
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
let shownCash = null, renderingBudget = 0, feedFilter = 'all';
export function setFeedFilter(id) { if (FEED_FILTERS.some(f => f.id === id)) feedFilter = id; }
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
    text('money-sentence',moneySentence(e));html('money-details',[['Revenue',e.revenue],...OPEX_KEYS.map(k=>[OPEX_LABELS[k],-e[k]]),['Operating expenses',-e.costs],['Net operating profit',e.profit]].map(([label,value])=>`<div class="detail-row"><span>${label}</span><span>${value<0?'−':''}${money(Math.abs(value),true)}/h</span></div>`).join(''));
    text('advisor',cap.service<1?'Service is interrupted. Avoid new promises until capacity is restored.':e.profit<0?'Your costs exceed income. Fill spare capacity or reprice before buying more hardware.':cap.utilization<BALANCE.capacityWarning?'There is room to grow. Sign customers before buying capacity you do not need.':'You are nearly full. Build headroom before accepting more promises.');
    html('server-cards',shopCards(s));html('fleet-cards',fleetHTML(s));html('protection-cards',protections(s));hidden('infrastructure-section',s.tier<3);hidden('loans-section',s.tier<3);
    if(s.tier>=3){html('infrastructure-cards',infrastructure(s));html('loan-cards',loans(s));}
    html('customer-cards',customerCards(s));text('customer-count',`${s.customers.length} active`);
    html('customer-roster',roster(s));
    if(document.activeElement!==price)price.value=s.price;
    text('price-output',`${s.price}% of market`);text('price-preview',pricingPreview(s,s.price));
    // Append new log entries without rebuilding the live region and rereading the whole history.
    const feed=element('event-feed'),shown=s.feed.filter(item=>feedMatches(item,feedFilter)),signature=feedFilter+JSON.stringify(shown);
    if(cache.get('feed')!==signature){
      const key=item=>JSON.stringify(item),old=cache.get('feed-items')||[];
      if(!shown.length){feed.innerHTML=`<p class="empty">${s.feed.length?'Nothing in this category yet.':'A quiet start. Your operator’s log will explain every incident and why it happened.'}</p>`;}
      else {
        const newest=shown.filter(item=>!old.includes(key(item)));
        if(cache.get('feed-filter')!==feedFilter||!old.length||!shown.some(item=>old.includes(key(item))))feed.replaceChildren();else feed.querySelector('.empty')?.remove();
        for(const item of newest.reverse()){const entry=document.createElement('article');entry.className='feed-entry';entry.innerHTML=feedEntryHTML(item);feed.prepend(entry);}
        while(feed.children.length>EVENT_RULES.outcomeHistoryLimit)feed.lastElementChild.remove();
      }
      cache.set('feed',signature);cache.set('feed-items',shown.map(key));cache.set('feed-filter',feedFilter);
    }
    html('feed-filters',FEED_FILTERS.map(f=>`<button data-action="feed-filter" data-value="${f.id}" aria-pressed="${feedFilter===f.id}" class="filter-chip">${f.label}</button>`).join(''));
    const done=info.next?.locked;
    text('goal-caption',done?'V1 FRONTIER REACHED':'YOUR NEXT CHAPTER');text('goal-title',done?'Regional ISP → the seabed awaits':`Grow into a ${info.next.name}`);
    const remaining=info.goals.filter(g=>g.progress<1);
    text('goal-hint',done?'Data Center, Backbone Carrier & Submarine Cable are future chapters.':remaining.length?`${remaining[0].label}: ${goalNumber(remaining[0],remaining[0].value)} of ${goalNumber(remaining[0],remaining[0].target)}`:'All requirements met. Preparing your next chapter.');
    element('goal-fill').style.width=`${info.progress*100}%`;element('goal-fill').parentElement.setAttribute('aria-valuenow',String(Math.round(info.progress*100)));
    text('goal-fraction',done?'3 of 6 chapters · v1 complete':`${info.goals.filter(g=>g.progress>=1).length} / ${info.goals.length} goals met`);
    html('roadmap',renderRoadmap(s));renderScene(s);
  };
}
