import { expansionState,DISTRICTS,ROLES,BUILDINGS,FACILITIES,WEATHER,RIVAL_DEFS } from '../data/management.js';
const n=(v,lo,hi,fallback=0)=>typeof v==='number'&&Number.isFinite(v)?Math.min(hi,Math.max(lo,v)):fallback;
const text=v=>typeof v==='string'?v.slice(0,1000):'';
const array=(v,limit=600)=>Array.isArray(v)?v.filter(x=>x&&typeof x==='object').slice(-limit):[];
// Preserve extension properties without propagating prototype-setter keys from imported JSON.
export function safeProperties(value,depth=0){
 if(depth>30)throw new Error('Save nesting is too deep.');
 if(Array.isArray(value))return value.map(x=>safeProperties(x,depth+1));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>!['__proto__','constructor','prototype'].includes(k)).map(([k,v])=>[k,safeProperties(v,depth+1)]));
 return value;
}
export function migrateExpansion(s,raw){
 const defaults=expansionState(s.hours),idOk=id=>DISTRICTS.some(d=>d.id===id),owned=id=>s.districts.includes(id);
 s.districts=Array.isArray(raw.districts)?[...new Set(['local',...raw.districts.filter(idOk)])]:['local'];
 s.selectedDistrict=owned(raw.selectedDistrict)?raw.selectedDistrict:'local';
 s.buildings=array(raw.buildings,8).filter(b=>BUILDINGS.some(x=>x.id===b.type)&&owned(b.district)).map(b=>({...b,built:n(b.built,0,s.hours)})).filter((b,i,a)=>a.findIndex(x=>x.type===b.type&&x.district===b.district)===i);
 s.facilities=array(raw.facilities,16).filter(b=>FACILITIES.some(x=>x.id===b.type)&&owned(b.district)).map(b=>({...b,level:Math.floor(n(b.level,1,3,1))})).filter((b,i,a)=>a.findIndex(x=>x.type===b.type&&x.district===b.district)===i);
 s.staff=array(raw.staff,13).filter(t=>ROLES.some(x=>x.id===t.role)&&owned(t.district)).map((t,i)=>({...t,id:i+1,hired:n(t.hired,0,s.hours)})).slice(0,1+3*s.buildings.filter(b=>b.type==='office').length);
 s.staffSerial=Math.max(s.staff.length,n(raw.staffSerial,0,1e9));
 s.servers=s.servers.map((t,i)=>{const old=raw.servers?.[i]||{};return {...old,...t,district:owned(old.district)?old.district:'local',upgrade:Math.floor(n(old.upgrade,0,3)),outageUntil:n(old.outageUntil,0,1e9),maintenanceUntil:n(old.maintenanceUntil,0,1e9)};});
 const e=raw.environment||{};
 s.environment={...e,weather:WEATHER.some(w=>w.id===e.weather)?e.weather:'clear',nextHour:n(e.nextHour,s.hours,s.hours+8,defaults.environment.nextHour),until:n(e.until,s.hours,s.hours+8,defaults.environment.until)};
 for(const k of ['nextRecruitHour','nextRivalHour','nextAnalyticsHour'])s[k]=n(raw[k],s.hours,s.hours+8,defaults[k]);
 s.recruitAvailable=Math.floor(n(raw.recruitAvailable,0,3,3));
 s.recoveryUntil=n(raw.recoveryUntil,0,s.hours+24);s.pendingSeconds=0;
 s.categoryLast=Object.fromEntries(Object.entries(raw.categoryLast||{}).filter(([,v])=>Number.isFinite(v)).map(([k,v])=>[k,n(v,0,s.hours)]));
 s.rivals=RIVAL_DEFS.map(def=>{const r=array(raw.rivals,3).find(x=>x.id===def.id);return r?{...r,...def,cash:n(r.cash,0,1e9,def.cash),price:n(r.price,60,180,def.price),capacity:n(r.capacity,8,180,def.capacity),customers:Math.floor(n(r.customers,0,n(r.capacity,8,180,def.capacity),def.customers)),reputation:n(r.reputation,0,100,def.reputation),infrastructure:Math.floor(n(r.infrastructure,0,4)),district:idOk(r.district)?r.district:'local',outageUntil:n(r.outageUntil,0,s.hours+1),lastAction:text(r.lastAction),actions:Math.floor(n(r.actions,0,1e9))}:defaults.rivals.find(x=>x.id===def.id);});
 s.transactions=array(raw.transactions).filter(t=>Number.isFinite(t.amount)).map(t=>({...t,id:Math.floor(n(t.id,0,1e12)),hour:n(t.hour,0,s.hours),amount:n(t.amount,-1e12,1e12),category:text(t.category),source:text(t.source),incident:t.incident===null?null:n(t.incident,0,1e12)}));
 s.transactionSerial=Math.max(n(raw.transactionSerial,0,1e12),...s.transactions.map(t=>t.id),0);
 // A retained-history opening balance reconciles current cash, including v1 saves with no ledger.
 s.cashBaseline=s.cash-s.transactions.reduce((a,t)=>a+t.amount,0);
 s.incidentSerial=n(raw.incidentSerial,0,1e12);
 s.eventHistory=s.eventHistory.map((entry,i)=>{const old=array(raw.eventHistory,24).find(e=>e.hour===entry.hour&&e.trigger===entry.trigger)||{};const out={...old,...entry};
  for(const k of ['fee','damage','extra','total','lostIncome','recoveryDuration','recoveryUntil','incidentId','customerCredits'])if(old[k]!==undefined)out[k]=n(old[k],0,1e12);
  if(old.reputationImpact!==undefined)out.reputationImpact=n(old.reputationImpact,-100,100);
  if(old.operationalReputationImpact!==undefined)out.operationalReputationImpact=n(old.operationalReputationImpact,-100,100);
  if(old.probability!==undefined)out.probability=n(old.probability,0,1);
  if(old.roll!==undefined)out.roll=n(old.roll,0,1);
  out.status=['recovering','resolved','awaiting decision'].includes(old.status)?old.status:'legacy record';
  out.title=text(old.title||entry.trigger);out.responseOutcome=['success','failure','not attempted'].includes(old.responseOutcome)?old.responseOutcome:'';if(out.responseOutcome){for(const k of ['fee','damage','extra','total','lostIncome','recoveryDuration','recoveryUntil','probability'])out[k]=n(out[k],0,1e12);out.reputationImpact=n(out.reputationImpact,-100,100);}out.category=text(old.category);out.scope=['district','server','regional'].includes(old.scope)?old.scope:'regional';out.district=owned(old.district)?old.district:'local';
  s.incidentSerial=Math.max(s.incidentSerial,out.incidentId||0);return out;});
 if(s.activeEvent){const a=raw.activeEvent||{};Object.assign(s.activeEvent,{incidentId:n(a.incidentId,1,1e12,s.incidentSerial+1),scope:['server','district','regional'].includes(a.scope)?a.scope:'regional',district:owned(a.district)?a.district:'local',serverIndex:Math.floor(n(a.serverIndex,0,s.servers.length-1)),category:text(a.category)});s.incidentSerial=Math.max(s.incidentSerial,s.activeEvent.incidentId);}
 s.analytics=array(raw.analytics,96).filter(a=>['hour','cash','revenue','costs','reputation','customers','service'].every(k=>Number.isFinite(a[k]))).map(a=>({...a,hour:n(a.hour,0,s.hours),cash:n(a.cash,-1e12,1e12),revenue:n(a.revenue,0,1e12),costs:n(a.costs,0,1e12),reputation:n(a.reputation,0,100),customers:n(a.customers,0,180),service:n(a.service,0,1)}));
 s.release='2.1';return s;
}
