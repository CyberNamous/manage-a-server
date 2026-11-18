import { staffCount,level } from './management.js';
import { environmental } from './environment.js';
import { EVENT_RULES } from '../data/eventParts.js';
export const clampProbability=p=>Math.min(1,Math.max(0,Number.isFinite(p)?p:0));
export function successCheck(p,roll){return roll<clampProbability(p);}
export function categoryOf(e){const id=e.trigger.id;return ['heat','flood','storm'].includes(id)?'environmental':['power'].includes(id)?'electrical':['cable','congestion'].includes(id)?'infrastructure':['update','compatibility'].includes(id)?'software':['hardware'].includes(id)?'hardware':['complaint','competitor'].includes(id)?'customer':['ddos','spike','viral'].includes(id)?'network':'commercial';}
export function prepareEvent(s,e){
 e.category=categoryOf(e);e.incidentId=++s.incidentSerial;
 e.district=s.districts[Math.floor(s.rng/4294967296*s.districts.length)]||'local';
 e.scope=['flood','storm','heat','power','cable','congestion'].includes(e.trigger.id)?'district':e.target.id==='server'?'server':'regional';
 // Deterministically select a valid server using the already-drawn generator state.
 const choices=s.servers.map((t,i)=>({t,i})).filter(x=>(x.t.district||'local')===e.district);
 e.serverIndex=choices[0]?.i??0;
 if(!choices.length&&e.scope==='district')e.district=s.servers[0]?.district||'local';
 s.categoryLast[e.category]=s.hours;
}
export function responseQuote(s,e,r){
 const category=e.category||categoryOf(e),district=e.district||'local';
 const bonus=Math.min(.15,staffCount(s,'technician',district)*.06+(category==='customer'?staffCount(s,'support',district)*.04:0)+(['infrastructure','environmental','electrical'].includes(category)?staffCount(s,'engineer',district)*.05:0));
 const probability=r.id==='ignore'?0:clampProbability(1-r.failureChance+bonus);
 const env=environmental(s,district);
 const shield=['power','storm'].includes(e.trigger.id)?env.ups:e.trigger.id==='flood'?1-Math.min(.75,level(s,'drainage',district)*.3):['cable','congestion'].includes(e.trigger.id)?env.fiber:e.trigger.id==='heat'?1/(1+level(s,'cooling',district)):1;
 const protection=s.failover?EVENT_RULES.failoverDuration:s.backups?EVENT_RULES.protectedDuration:EVENT_RULES.noProtectionDuration;
 const outage=['outage','traffic','price'].includes(e.trigger.effect);
 const baseDuration=outage?EVENT_RULES.outageBase*e.scale*r.durationScale*protection*shield:0;
 const opportunity=e.trigger.effect==='opportunity';
 const damage=opportunity?0:Math.ceil(e.baseCost*r.damageScale*shield);
 return {probability,bonus,fee:r.cost,successDamage:damage,failureDamage:opportunity?0:Math.ceil(e.baseCost*Math.max(r.damageScale,.8)*shield),successDuration:baseDuration*.5,failureDuration:baseDuration*(r.id==='ignore'?1:1.4)};
}
