import { WEATHER } from '../data/management.js';
import { random } from './eventHistory.js';
import { districtOf,level,staffCount,serverDistrict } from './management.js';
import { serverType } from '../data/servers.js';
import { addFeed } from '../state.js';
export function weather(s){return WEATHER.find(w=>w.id===s.environment?.weather)||WEATHER[0];}
export function environmental(s,district){
 const d=districtOf(s,district),w=weather(s),power=s.servers.filter(t=>serverDistrict(t)===district).reduce((a,t)=>a+serverType(t.id).power*(1+.08*(t.upgrade||0)),0);
 const coolingNeed=power*d.heat*(w.id==='heatwave'?1.6:1)*Math.max(.64,1-.12*staffCount(s,'engineer',district));
 const coolingCapacity=1+level(s,'cooling',district)*2;
 return {powerFactor:w.power,coolingNeed,coolingCapacity,heatRisk:Math.max(0,coolingNeed/coolingCapacity-1),floodRisk:d.flood*(1-Math.min(.75,level(s,'drainage',district)*.3)),ups:1-Math.min(.75,level(s,'ups',district)*.3),fiber:1-Math.min(.75,level(s,'fiber',district)*.3)};
}
export function tickEnvironment(s){if(s.hours+1e-8<s.environment.nextHour)return;const w=WEATHER[Math.floor(random(s)*WEATHER.length)];s.environment={weather:w.id,nextHour:s.hours+4+random(s)*4,until:0};s.environment.until=s.environment.nextHour;addFeed(s,w.name,'Regional conditions changed. Cooling demand, electricity costs and eligible incident weights are shown in Regional overview.');}
