// Update 2.1 definitions: dollars per game hour unless explicitly stated.
export const DISTRICTS = [
 {id:'local',name:'Local District',tier:1,cost:0,reputation:0,demand:1,heat:1,flood:1.1,description:'Affordable beginnings, exposed local utilities.'},
 {id:'commercial',name:'Commercial District',tier:2,cost:700,reputation:42,demand:1.12,heat:1.05,flood:.8,description:'More business applicants and stronger drainage.'},
 {id:'industrial',name:'Industrial District',tier:3,cost:1600,reputation:58,demand:1.18,heat:1.3,flood:.65,description:'Heavy power infrastructure; higher cooling requirements.'},
 {id:'metro',name:'Metropolitan District',tier:3,cost:3200,reputation:72,demand:1.3,heat:1.15,flood:.9,description:'Dense demand and expensive high-capacity facilities.'}
];
export const ROLES = [
 {id:'technician',name:'Operations technician',hire:65,salary:2,tier:1,description:'+6 percentage points response success; 15% less wear per assigned technician (caps apply).'},
 {id:'support',name:'Customer specialist',hire:80,salary:2.5,tier:2,description:'+4 points complaint response success and 25% slower customer strain per specialist.'},
 {id:'engineer',name:'Infrastructure engineer',hire:150,salary:4,tier:3,description:'+5 points regional response success and 12% lower facility cooling demand.'}
];
export const BUILDINGS = [
 {id:'office',name:'Operations office',cost:240,hourly:3,tier:1,capacity:3,description:'Three additional staff desks. Required before expanding the team.'},
 {id:'hall',name:'Server hall',cost:900,hourly:9,tier:2,capacity:4,description:'Adds four server slots in this district, up to the global 60-server safety limit.'}
];
export const FACILITIES = [
 {id:'cooling',name:'Precision cooling',cost:160,hourly:1.5,tier:1,description:'Each level handles 2 kW of cooling demand.'},
 {id:'ups',name:'UPS reserve',cost:220,hourly:1,tier:1,description:'Each level reduces electrical disruption by 30%, capped at 75%.'},
 {id:'drainage',name:'Flood protection',cost:260,hourly:1,tier:2,description:'Each level reduces local flood risk by 30%, capped at 75%.'},
 {id:'fiber',name:'Redundant fiber',cost:400,hourly:2,tier:2,description:'Each level reduces local network disruption by 30%, capped at 75%.'}
];
export const WEATHER = [
 {id:'clear',name:'Clear skies',power:1,demand:1,risk:1},
 {id:'heatwave',name:'Regional heatwave',power:1.35,demand:1,risk:1.5},
 {id:'storm',name:'Heavy rainfall',power:1.08,demand:1,risk:1.3},
 {id:'grid',name:'Regional grid instability',power:1.15,demand:1,risk:1.4},
 {id:'congestion',name:'Regional network congestion',power:1,demand:1,risk:1.2},
 {id:'boom',name:'Commercial demand boom',power:1,demand:1.15,risk:1}
];
export const RIVAL_DEFS = [
 {id:'sprout',name:'Sprout Hosting',strategy:'value',price:85,reputation:30,capacity:12,customers:5,cash:220,color:'#55d6be'},
 {id:'north',name:'Northstar Compute',strategy:'quality',price:120,reputation:55,capacity:16,customers:7,cash:300,color:'#849bff'},
 {id:'relay',name:'Relay Networks',strategy:'expansion',price:100,reputation:40,capacity:20,customers:6,cash:260,color:'#edba73'}
];
export function expansionState(hours=0) {
 return { release:'2.1', districts:['local'], selectedDistrict:'local', staff:[], staffSerial:0,
 buildings:[], facilities:[], environment:{weather:'clear',nextHour:hours+4,until:hours+4},
 nextRecruitHour:hours+6, recruitAvailable:3, nextRivalHour:hours+1,
 rivals:RIVAL_DEFS.map(r=>({...r,infrastructure:0,district:'local',outageUntil:0,lastAction:'Serving local customers',actions:0})),
 transactions:[], transactionSerial:0, cashBaseline:null, incidentSerial:0, recoveryUntil:0,
 nextAnalyticsHour:hours+1, analytics:[], categoryLast:{}, pendingSeconds:0 };
}
