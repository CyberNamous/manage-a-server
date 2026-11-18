export function transact(s, amount, category, source, incident=null) {
 if(!Number.isFinite(amount)) throw new Error('Non-finite transaction');
 if(!amount) return null;
 s.transactions ||= []; s.transactionSerial ||= 0;
 if(s.cashBaseline===null || s.cashBaseline===undefined) s.cashBaseline=s.cash;
 s.cash += amount;
 const last=s.transactions.at(-1), bucket=Math.floor(s.hours);
 if(!incident && last && last.category===category && last.source===source && Math.floor(last.hour)===bucket){last.amount+=amount;last.hour=s.hours;return last;}
 const tx={id:++s.transactionSerial,hour:s.hours,amount,category,source,incident};
 s.transactions.push(tx);
 while(s.transactions.length>600){const old=s.transactions.shift();s.cashBaseline+=old.amount;}
 return tx;
}
export function ledgerBalance(s){return (s.cashBaseline??s.cash)+s.transactions.reduce((v,t)=>v+t.amount,0);}
export function bookOperation(s,e,hours){
 // Each category has a game-hour bucket, preventing 250 ms frames filling the ledger.
 const entries=[['Hosting revenue',e.revenue],['Electricity',-e.power],['Rent',-e.rent],['Connectivity',-e.connectivity],['Protection',-e.protection],['Loan installments',-e.loans],['Staff salaries',-e.staff],['Facility operations',-e.facilities]];
 for(const [source,rate] of entries){if(!rate)continue;const old=[...s.transactions].reverse().find(t=>t.category==='operating'&&t.source===source&&Math.floor(t.hour)===Math.floor(s.hours));if(old){old.amount+=rate*hours;s.cash+=rate*hours;}else transact(s,rate*hours,'operating',source);}
 const loss=(e.contractRevenue-e.revenue)*hours;
 // Lost income is foregone revenue, never a second cash deduction.
 const active=s.eventHistory.filter(i=>i.status==='recovering'&&s.hours<i.recoveryUntil);
 if(active.length) for(const i of active)i.lostIncome=(i.lostIncome||0)+loss/active.length;
}
