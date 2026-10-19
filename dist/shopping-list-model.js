(function(root){'use strict';
const B=root.BatchCardMath||(typeof require==='function'?require('./batch-card-model.js'):null),O=root.BatchOperationsMath||(typeof require==='function'?require('./batch-operations-model.js'):null);
function groups(cards,server){
 if(!['europe','west','east'].includes(server))throw Error('Неизвестный сервер.');
 const result=new Map();
 for(const card of cards.filter(c=>c.server===server&&!c.archived)){
  B.summary(card);
  for(const row of card.buys){
   const quality=card.kind==='craft'?1:card.quality,key=JSON.stringify([row.city,row.item,quality]);
   if(!result.has(key))result.set(key,{key,item:row.item,name:row.name,city:row.city,quality,total:0,bought:0,ordered:0,remaining:0,cost:0,unknown:false,cards:new Set(),stamps:[]});
   const group=result.get(key),remaining=row.quantity-row.bought,cost=O.intervalValue(row,row.bought,remaining);
   group.total+=row.quantity;group.bought+=row.bought;group.ordered+=row.ordered||0;group.remaining+=remaining;group.cards.add(card.uid);if(cost===null)group.unknown=true;else group.cost+=cost;
   group.stamps.push(JSON.stringify([card.uid,card.created,card.kind,card.quality,card.destination,card.made,card.sales.map(s=>[s.uid,s.sold]),row]));
  }
 }
 return [...result.values()].map(g=>({key:g.key,item:g.item,name:g.name,city:g.city,quality:g.quality,total:g.total,bought:g.bought,ordered:g.ordered,toOrder:g.remaining-g.ordered,remaining:g.remaining,cost:g.unknown?null:g.cost,parties:g.cards.size,signature:JSON.stringify(g.stamps.sort())})).sort((a,b)=>Number(!a.remaining)-Number(!b.remaining)||a.city.localeCompare(b.city)||a.name.localeCompare(b.name)||a.quality-b.quality);
}
function session(store){
 const tokens=new Map();
 function snapshot(server){
  const rows=groups(store.snapshot().cards,server),keys=new Set(rows.map(g=>server+'|'+g.key));
  for(const key of tokens.keys())if(key.startsWith(server+'|')&&!keys.has(key))tokens.delete(key);
  return {server,groups:rows.map(({signature,...row})=>{const key=server+'|'+row.key,previous=tokens.get(key);if(!previous||previous.signature!==signature)tokens.set(key,{signature,token:root.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2)});return {...row,token:tokens.get(key).token};})};
 }
 function purchase({server,key,quantity,token}){
  const group=snapshot(server).groups.find(g=>g.key===key);
  if(!group||group.token!==token)throw Error('Список изменился. Проверьте остаток и введите количество заново.');
  if(!Number.isSafeInteger(quantity)||quantity<1||quantity>group.remaining)throw Error('Введите целое купленное количество от 1 до '+group.remaining+'.');
  return O.apply(store,O.purchasePlan(store.snapshot().cards,server,key,quantity));
 }
 function order({server,key,quantity,token}){const group=snapshot(server).groups.find(g=>g.key===key);if(!group||group.token!==token)throw Error('Список изменился. Проверьте остаток и введите количество заново.');return O.apply(store,O.orderPlan(store.snapshot().cards,server,key,quantity));}
 return {snapshot,purchase,order};
}
const api={groups,session};root.ShoppingListMath=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
