import { DISTRICTS,ROLES,BUILDINGS,FACILITIES } from '../data/management.js';
import { serverType } from '../data/servers.js';
import { BALANCE } from '../data/tiers.js';
import { transact } from './finance.js';
export function districtOf(s,id){return DISTRICTS.find(d=>d.id===id)||DISTRICTS[0];}
export function serverDistrict(server){return server.district||'local';}
export function staffCount(s,role,district){return (s.staff||[]).filter(t=>t.role===role&&(!district||t.district===district)).length;}
export function staffLimit(s){return 1+(s.buildings||[]).filter(b=>b.type==='office').length*3;}
export function maxServers(s){return Math.min(60,BALANCE.maxServers[s.tier]+(s.buildings||[]).filter(b=>b.type==='hall').length*4);}
export function level(s,type,district){return (s.facilities||[]).find(f=>f.type===type&&f.district===district)?.level||0;}
export function managementCosts(s){return {staff:(s.staff||[]).reduce((v,t)=>v+(ROLES.find(r=>r.id===t.role)?.salary||0),0), facilities:(s.buildings||[]).reduce((v,b)=>v+(BUILDINGS.find(r=>r.id===b.type)?.hourly||0),0)+(s.facilities||[]).reduce((v,f)=>v+(FACILITIES.find(r=>r.id===f.type)?.hourly||0)*f.level,0)};}
function no(message){return {ok:false,message};} function yes(message){return {ok:true,message};}
export function manage(s,action,value){
 const [id,arg]=String(value||'').split(':');const district=arg||s.selectedDistrict;
 if(action==='district-select'){if(!s.districts.includes(id))return no('Unlock this district first.');s.selectedDistrict=id;return yes('District selected. New installations will be placed here.');}
 if(action==='district-unlock'){const d=DISTRICTS.find(d=>d.id===id);if(!d||s.districts.includes(id))return no('District already owned or unavailable.');if(s.tier<d.tier||s.reputation<d.reputation||s.cash<d.cost)return no('Meet the tier, reputation and cash requirements first.');transact(s,-d.cost,'investment',d.name+' access');s.districts.push(id);s.selectedDistrict=id;return yes(d.name+' unlocked. Demand now applies to the wider business.');}
 if(action==='fire'){const i=s.staff.findIndex(t=>t.id===Number(id));if(i<0)return no('Staff member unavailable.');s.staff.splice(i,1);return yes('Staff member released; salary stopped.');}
 if(action==='assign'){const t=s.staff.find(t=>t.id===Number(id));if(!t||!s.districts.includes(arg))return no('Assignment unavailable.');t.district=arg;return yes('Assignment updated.');}
 if(!s.districts.includes(district))return no('District is not owned.');
 if(action==='hire'){const r=ROLES.find(r=>r.id===id);if(!r||s.tier<r.tier||s.cash<r.hire)return no('Role locked or insufficient cash.');if(s.staff.length>=staffLimit(s))return no('Build an office for more desks.');if(s.recruitAvailable<1)return no('Recruitment pool refreshes every six game hours.');transact(s,-r.hire,'staff',r.name+' recruitment');s.staff.push({id:++s.staffSerial,role:id,district,hired:s.hours});s.recruitAvailable--;return yes(r.name+' hired. Salary applies each game hour.');}
 if(action==='building'){const b=BUILDINGS.find(b=>b.id===id);if(!b||s.tier<b.tier||s.cash<b.cost)return no('Building locked or insufficient cash.');if(s.buildings.some(x=>x.type===id&&x.district===district))return no('This building is already installed in that district.');transact(s,-b.cost,'investment',b.name+' / '+district);s.buildings.push({type:id,district,built:s.hours});return yes(b.name+' opened. Its running cost now applies.');}
 if(action==='facility'){const f=FACILITIES.find(f=>f.id===id),l=level(s,id,district);if(!f||s.tier<f.tier||l>=3)return no('Facility locked or at maximum level.');const cost=f.cost*(l+1);if(s.cash<cost)return no('Not enough cash.');transact(s,-cost,'investment',f.name+' level '+(l+1)+' / '+district);const owned=s.facilities.find(x=>x.type===id&&x.district===district);if(owned)owned.level++;else s.facilities.push({type:id,district,level:1});return yes(f.name+' upgraded.');}
 if(action==='maintain'||action==='upgrade'||action==='move-server'){
 const i=Number(id),server=s.servers[i];if(!server)return no('Server no longer exists.');
 if(action==='move-server'){if(!s.districts.includes(arg))return no('District not owned.');if(s.hours<(server.maintenanceUntil||0)||s.hours<(server.outageUntil||0))return no('Recover this server before moving it.');server.district=arg;return yes('Server relocated. District hazards and staff effects now apply.');}
 const model=serverType(server.id),cost=action==='maintain'?Math.ceil(model.cost*.12):Math.ceil(model.cost*.35);
 if(s.hours<(server.maintenanceUntil||0))return no('Maintenance already in progress.');
 if(action==='upgrade'&&(server.upgrade||0)>=3)return no('Hardware already at level 3.');
 if(s.cash<cost)return no('Not enough cash.');transact(s,-cost,action==='maintain'?'maintenance':'hardware',action+' server '+(i+1));
 if(action==='maintain'){server.age*=.35;server.maintenanceUntil=s.hours+.15;}else server.upgrade=(server.upgrade||0)+1;
 return yes(action==='maintain'?'Preventive maintenance started: 0.15h planned downtime, age reduced 65%.':'Hardware upgraded: +15% capacity and +8% power per level.');}
 return no('Unknown operation.');
}
export function tickManagement(s,hours){
 if(s.hours>=s.nextRecruitHour){s.recruitAvailable=3;s.nextRecruitHour+=6*Math.max(1,Math.floor((s.hours-s.nextRecruitHour)/6)+1);}
 for(const server of s.servers)server.age+=hours*Math.max(.55,1-.15*staffCount(s,'technician',serverDistrict(server)));
 for(const i of s.eventHistory)if(i.status==='recovering'&&s.hours>=i.recoveryUntil)i.status='resolved';
}
