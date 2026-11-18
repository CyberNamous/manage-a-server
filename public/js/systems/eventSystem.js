import { responseQuote,prepareEvent,successCheck } from './probability.js';
import { transact } from './finance.js';
import { EVENT_RULES, RARE_EFFECTS } from '../data/eventParts.js';
import { addFeed } from '../state.js';
import { random, recordEvent } from './eventHistory.js';
import { assembleEvent } from './eventGenerator.js';
import { takeLoan } from './loanSystem.js';
export function scheduleEvent(s) {
  s.nextEventHour = s.hours + (EVENT_RULES.minGapHours + random(s) * (EVENT_RULES.maxGapHours - EVENT_RULES.minGapHours)) / (1 + (s.tier - 1) * EVENT_RULES.tierFrequency);
}
export function tickEvents(s) {
  if (s.activeEvent || s.hours < (s.recoveryUntil||0)) return;
  const chainIndex = s.chains.findIndex(item => item.at <= s.hours);
  if (s.hours < s.nextEventHour && chainIndex < 0) return;
  const chain = chainIndex < 0 ? null : s.chains.splice(chainIndex, 1)[0];
  const event = assembleEvent(s, chain);
  scheduleEvent(s);
  if (event) { prepareEvent(s,event); s.activeEvent = event; recordEvent(s, event); }
}
export function resolveEvent(s,id){
 const e=s.activeEvent,r=e?.responses.find(x=>x.id===id);
 if(!e||!r)return {ok:false,message:'That decision is no longer available.'};
 const q=responseQuote(s,e,r);
 if(s.cash<q.fee)return {ok:false,message:'You cannot afford this response.'};
 if(id==='emergency'){const loan=takeLoan(s,null,true);if(!loan.ok)return loan;}
 const roll=random(s),success=id!=='ignore'&&successCheck(q.probability,roll);
 const damage=success?q.successDamage:q.failureDamage;
 const duration=success?q.successDuration:q.failureDuration;
 const beforeRep=s.reputation;
 transact(s,-q.fee,'incident','Response fee: '+r.name,e.incidentId);
 let extra=0;
 const offerValue=e.trigger.id==='buyout'?Math.ceil(s.customers.length*RARE_EFFECTS.offerPerCustomer):0;
 if(e.trigger.effect==='opportunity'){
  if(id!=='ignore'&&success){
   if(e.trigger.id==='cablefund'){
    if(s.cash>=RARE_EFFECTS.consortiumCost){extra=RARE_EFFECTS.consortiumCost;transact(s,-extra,'investment','Consortium research pledge',e.incidentId);s.consortium=true;s.reputation=Math.min(100,s.reputation+3);}
   }else{s.reputation=Math.min(100,s.reputation+2);}
  }
 }else{
  transact(s,-damage,'incident','Residual damage: '+e.trigger.name,e.incidentId);
  if(e.trigger.effect==='outage'){
   const targets=e.scope==='server'?[s.servers[e.serverIndex]].filter(Boolean):e.scope==='district'?s.servers.filter(x=>(x.district||'local')===e.district):s.servers;
   for(const server of targets)server.outageUntil=Math.max(server.outageUntil||0,s.hours+duration);
  }
  if(e.trigger.effect==='traffic')s.trafficUntil=Math.max(s.trafficUntil,s.hours+duration);
  if(e.trigger.effect==='price')s.priceShockUntil=Math.max(s.priceShockUntil,s.hours+duration);
  const repLoss=e.scale*(e.trigger.effect==='trust'?2:.3)*(success?.15:1);
  s.reputation=Math.max(0,s.reputation-repLoss);
 }
 const recoveryUntil=s.hours+duration;
 s.recoveryUntil=Math.max(s.recoveryUntil||0,recoveryUntil+.35);
 s.nextEventHour=Math.max(s.nextEventHour,s.recoveryUntil);
 const followup=(id==='ignore'||!success)&&!e.chain&&e.trigger.effect!=='opportunity';
 if(followup)s.chains.push({trigger:e.trigger.followup||e.trigger.id,parentIncidentId:e.incidentId,at:Math.max(s.hours+EVENT_RULES.chainDelayHours,s.recoveryUntil)});
 const entry=s.eventHistory.find(x=>x.incidentId===e.incidentId)||s.eventHistory.at(-1);
 if(entry)Object.assign(entry,{status:duration?'recovering':'resolved',response:id,responseOutcome:id==='ignore'?'not attempted':success?'success':'failure',probability:q.probability,roll,fee:q.fee,damage,extra,offerValue,total:q.fee+damage+extra,reputationImpact:s.reputation-beforeRep,recoveryDuration:duration,recoveryUntil,lostIncome:0,followup,scope:e.scope,district:e.district,serverIndex:e.serverIndex,title:e.trigger.name,category:e.category});
 addFeed(s,e.trigger.name+': '+(id==='ignore'?'impact absorbed':success?'response successful':'response failed')+' · $'+(q.fee+damage+extra)+' immediate',`Response $${q.fee}; damage $${damage}; investment $${extra}. Recovery ${duration.toFixed(2)}h. ${offerValue?'Indicative buyout offer $'+offerValue+' recorded, not accepted; you keep your business. ':''}${e.trigger.id==='cablefund'?(extra?'Research pledge recorded; this is not cable construction. ':'No research pledge funded. '):''}Foregone revenue is measured during recovery, never charged twice.`,damage?'loss':'neutral');
 s.activeEvent=null;
 return {ok:true,message:'Decision recorded. See incident history for the exact outcome.'};
}
