import { random } from './eventHistory.js';
import { DISTRICTS } from '../data/management.js';
// Bots use only market price, demand and their own state; never player cash or pending decisions.
export function competition(s){const rivals=s.rivals||[];const total=rivals.reduce((v,r)=>v+r.customers,0)+s.customers.length;const score=rivals.reduce((v,r)=>v+(r.reputation/100)*(100/r.price),0)/Math.max(1,rivals.length);return {share:total?s.customers.length/total:0,pressure:score,acceptance:Math.max(.8,Math.min(1.08,1.08-score*.22))};}
export function tickRivals(s){
 if(s.hours+1e-8<s.nextRivalHour)return;
 s.nextRivalHour+=1;
 for(const r of s.rivals){
  const online=s.hours>=r.outageUntil;
  r.cash+=r.customers*3*r.price/100*(online?1:.2)-(3+r.capacity*.12+r.infrastructure*.5);
  r.actions++;r.lastAction='Serving contracts; cash reserved';
  if(!online){r.lastAction='Recovering local incident';r.reputation=Math.max(12,r.reputation-.2);continue;}
  if(random(s)<.015/(1+r.infrastructure)){r.outageUntil=s.hours+.5;r.cash-=Math.min(20,Math.max(0,r.cash));r.lastAction='Repairing an incident';continue;}
  if(r.cash>=100 && r.customers/r.capacity>.75){r.cash-=100;r.capacity+=8;r.lastAction='Added eight capacity units';}
  else if(r.cash>=140&&r.infrastructure<4&&(r.strategy==='quality'||r.actions%8===0)){r.cash-=140;r.infrastructure++;r.reputation=Math.min(90,r.reputation+1);r.lastAction='Upgraded reliability infrastructure';}
  else if(r.cash>=400&&r.actions>=12&&r.district!=='metro'){const next=DISTRICTS[DISTRICTS.findIndex(d=>d.id===r.district)+1];if(next&&r.cash>=next.cost){r.cash-=next.cost;r.district=next.id;r.lastAction='Expanded into '+next.name;}}
  const target=r.strategy==='value'?Math.max(75,s.price-10):r.strategy==='quality'?Math.min(135,s.price+15):100;
  r.price+=Math.sign(target-r.price)*Math.min(3,Math.abs(target-r.price));
  const appeal=(r.reputation/100+.4)*(100/r.price)*(DISTRICTS.find(d=>d.id===r.district)?.demand||1)*(s.environment.weather==='boom'?1.15:1);
  if(r.customers<r.capacity&&random(s)<Math.min(.7,appeal*.3)){r.customers++;r.lastAction+=' · won a new applicant';}
  if(r.price>125&&r.customers>2&&random(s)<.08){r.customers--;r.lastAction+=' · lost a price-sensitive client';}
  r.reputation=Math.min(90,r.reputation+.04*(1+r.infrastructure));
  r.capacity=Math.min(180,r.capacity);r.customers=Math.min(r.capacity,r.customers);r.cash=Math.max(0,Math.min(1e9,r.cash));
 }
}
