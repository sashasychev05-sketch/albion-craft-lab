(function(root){'use strict';
const cities=['Bridgewatch','Fort Sterling','Lymhurst','Martlock','Thetford','Caerleon','Brecilien'];
const good=x=>Number.isFinite(x)&&x>=0;
function plan(config,quote){
 const quantity=Number(config.quantity),days=Number(config.days),share=Number(config.share),fee=Number(config.fee),step=Number(config.step),ceiling=config.ceiling===''||config.ceiling==null?null:Number(config.ceiling),selected=config.cities;
 if(!Number.isSafeInteger(quantity)||quantity<1||quantity>100000000||!(days>0&&days<=365)||!(share>0&&share<=100)||!good(fee)||fee>100||!Number.isSafeInteger(step)||step<0||ceiling!==null&&(!Number.isSafeInteger(ceiling)||ceiling<1)||!['cheap','balanced'].includes(config.mode)||!Array.isArray(selected)||!selected.length||new Set(selected).size!==selected.length||selected.some(c=>!cities.includes(c)))return {valid:false,rows:[],excluded:[],remaining:Math.max(0,quantity||0),error:'Укажите целое количество, города, срок, долю оборота, комиссию и надбавку к цене.'};
 const excluded=[],candidates=[];
 for(const city of cities.filter(c=>selected.includes(c))){const q=quote(city)||{},manual=config.manual?.[city]||{},customPrice=manual.price!==null&&manual.price!==undefined,customDaily=manual.daily!==null&&manual.daily!==undefined,customLimit=manual.limit!==null&&manual.limit!==undefined;
  const bid=Number(q.bid),price=customPrice?Number(manual.price):Number.isFinite(bid)&&bid>0?q.manual?bid:Math.ceil(bid+step):0,daily=customDaily?Number(manual.daily):Number(q.daily)||0;
  const capacity=customLimit?Number(manual.limit):Math.floor(daily*days*share/100+1e-9);
  let reason='';if(!(Number.isSafeInteger(price)&&price>0))reason='Нет проверенного ордера покупки. Введите цену из игры.';else if(ceiling!==null&&price>ceiling)reason='Цена выше заданного максимума.';else if(!customPrice&&q.bidValid===false)reason='Цена покупки устарела или не прошла проверку.';else if(!customPrice&&!q.manual&&q.ask>0&&price>=q.ask)reason='Цена достигает текущей продажи. Проверьте цену в игре.';else if(!customLimit&&!customDaily&&!q.volumeValid)reason='Нет свежего оборота. Укажите свой лимит или объём.';else if(!Number.isSafeInteger(capacity)||capacity<1||capacity>100000000)reason='Лимит города меньше 1 шт. или некорректен.';
  if(reason){excluded.push({city,reason});continue;}candidates.push({city,price,daily,capacity,quantity:0,manualPrice:customPrice||!!q.manual,manualLimit:customLimit,manualDaily:customDaily,bid,ask:q.ask||0,bidDate:q.bidDate||null});
 }
 let remaining=quantity;
 if(config.mode==='cheap'){candidates.sort((a,b)=>a.price-b.price||b.capacity-a.capacity||cities.indexOf(a.city)-cities.indexOf(b.city));for(const row of candidates){row.quantity=Math.min(remaining,row.capacity);remaining-=row.quantity;}}
 else{const total=candidates.reduce((s,r)=>s+r.capacity,0),assigned=Math.min(quantity,total);for(const r of candidates){const ideal=total?assigned*r.capacity/total:0;r.quantity=Math.floor(ideal);r.fraction=ideal-r.quantity;}let left=assigned-candidates.reduce((s,r)=>s+r.quantity,0);for(const r of [...candidates].sort((a,b)=>b.fraction-a.fraction||a.price-b.price))if(left>0&&r.quantity<r.capacity){r.quantity++;left--;}remaining=quantity-assigned;}
 const rows=candidates.filter(r=>r.quantity>0).map(row=>{const cost=row.quantity*row.price,setup=Math.max(0,Math.ceil(cost*fee/100-1e-9));return {...row,cost,setup,total:cost+setup,signature:JSON.stringify([row.quantity,row.price])};});
 const assigned=rows.reduce((s,r)=>s+r.quantity,0),cost=rows.reduce((s,r)=>s+r.cost,0),setup=rows.reduce((s,r)=>s+r.setup,0);return {valid:remaining===0,rows,excluded,remaining,assigned,cost,setup,total:cost+setup,days,share,error:remaining?'Не распределено '+remaining.toLocaleString('ru-RU')+' шт. Увеличьте срок, долю оборота, лимиты или число городов.':''};
}
const api={cities,plan};root.BuyOrderMath=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
