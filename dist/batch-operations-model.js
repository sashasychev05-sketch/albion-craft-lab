(function(root){'use strict';
const B=root.BatchCardMath||(typeof require==='function'?require('./batch-card-model.js'):null);
const clone=x=>JSON.parse(JSON.stringify(x)),integer=(n,max=1e12)=>Number.isSafeInteger(n)&&n>=0&&n<=max;
const servers=['europe','west','east'],PREFS='albion-batch-operations-v1',MAX_TRIPS=200;
const quality=card=>card.kind==='craft'?1:card.quality;
const itemKey=line=>JSON.stringify([line.item,line.quality]);
const context=card=>JSON.stringify([card.uid,card.server,card.kind,card.quality,card.destination,card.archived,card.made,card.sales.map(r=>[r.uid,r.sold])]);
function active(cards,server){
 if(!servers.includes(server))throw Error('Неизвестный сервер.');
 return cards.filter(c=>c.server===server&&!c.archived).map(c=>{B.summary(c);return c;}).sort((a,b)=>Date.parse(a.created)-Date.parse(b.created)||a.uid.localeCompare(b.uid));
}
// Cost of an interval in the saved price scenario. Initial/repricing fees are separate.
function intervalValue(row,start,quantity){
 B.reprice(row);
 if(!integer(start,row.quantity)||!integer(quantity,row.quantity-start))throw Error('Некорректное количество покупки.');
 let from=0,price=row.price,value=0,known=true;
 const segment=(end)=>{const units=Math.max(0,Math.min(start+quantity,end)-Math.max(start,from));if(units&&price===null)known=false;else value+=units*(price??0);from=end;};
 for(const update of row.updates){segment(row.quantity-update.remaining);price=update.price;}
 segment(row.quantity);
 if(!Number.isFinite(value)||value>1e15)throw Error('Слишком большая стоимость закупки.');
 return known?value:null;
}
function source(card,row){return {card:card.uid,row:row.uid,cardName:card.name,item:row.item,name:row.name,quality:quality(card),city:row.city,context:context(card),stamp:JSON.stringify(row)};}
function procurement(cards,server){
 const groups=new Map();
 for(const card of active(cards,server))for(const row of card.buys){
  const quantity=row.quantity-row.bought;if(!quantity)continue;
  const key=JSON.stringify([row.city,row.item,quality(card)]);
  if(!groups.has(key))groups.set(key,{key,city:row.city,item:row.item,name:row.name,quality:quality(card),quantity:0,cost:0,unknown:0,lines:[]});
  const group=groups.get(key),cost=intervalValue(row,row.bought,quantity);
  group.quantity+=quantity;if(cost===null)group.unknown++;else group.cost+=cost;
  group.lines.push({...source(card,row),quantity,cost});
 }
 return [...groups.values()].map(g=>({...g,cost:g.unknown?null:g.cost})).sort((a,b)=>a.city.localeCompare(b.city)||a.name.localeCompare(b.name)||a.quality-b.quality);
}
function purchasePlan(cards,server,key,quantity){
 const group=procurement(cards,server).find(g=>g.key===key);
 if(!group)throw Error('Потребность уже закрыта или сервер изменился.');
 if(!integer(quantity,group.quantity)||quantity<1)throw Error('Укажите целое количество не больше остатка закупки.');
 let left=quantity,cost=0,known=true;const lines=[];
 for(const line of group.lines){if(!left)break;const amount=Math.min(left,line.quantity),row=cards.find(c=>c.uid===line.card).buys.find(r=>r.uid===line.row),value=intervalValue(row,row.bought,amount);lines.push({...line,quantity:amount,cost:value});left-=amount;if(value===null)known=false;else cost+=value;}
 if(cost>1e15)throw Error('Слишком большая стоимость закупки.');
 return {type:'purchase',server,key,quantity,cost:known?cost:null,lines,signature:JSON.stringify(group.lines)};
}
function cargo(cards,server){
 const routes=new Map();
 for(const card of active(cards,server))for(const row of card.buys){
  const quantity=row.bought-row.delivered;
  if(!quantity||!row.city||!card.destination||row.city===card.destination)continue;
  const key=JSON.stringify([row.city,card.destination]);
  if(!routes.has(key))routes.set(key,{key,origin:row.city,destination:card.destination,lines:[]});
  routes.get(key).lines.push({...source(card,row),quantity,picked:row.picked-row.delivered,pickup:row.bought-row.picked});
 }
 return [...routes.values()].sort((a,b)=>a.origin.localeCompare(b.origin)||a.destination.localeCompare(b.destination));
}
function cargoItems(route){
 const items=new Map();for(const line of route.lines){const key=itemKey(line);if(!items.has(key))items.set(key,{key,item:line.item,name:line.name,quality:line.quality,quantity:0,pickup:0});const item=items.get(key);item.quantity+=line.quantity;item.pickup+=line.pickup;}
 return [...items.values()];
}
function units(value,label){
 const scaled=value*1e6;
 if(typeof value!=='number'||!Number.isFinite(value)||value<.000001||value>1e6||Math.abs(scaled-Math.round(scaled))>.0001)throw Error(label+': укажите число от 0,000001 до 1 000 000, до шести знаков после запятой.');
 return Math.round(scaled);
}
function tripPlan(cards,server,key,options){
 const route=cargo(cards,server).find(r=>r.key===key);if(!route)throw Error('Нет купленного груза по этому направлению.');
 const capacity=units(options.capacity,'Грузоподъёмность'),reserve=options.reserve;
 if(typeof reserve!=='number'||!Number.isFinite(reserve)||reserve<0||reserve>=100)throw Error('Запас грузоподъёмности должен быть от 0 до 99,99%.');
 const usable=Math.floor(capacity*(1-reserve/100));if(usable<1)throw Error('Не осталось грузоподъёмности после запаса.');
 const items=cargoItems(route),weights=options.weights,quantities=options.quantities;
 if(!weights||!quantities)throw Error('Укажите вес и количество груза.');
 const requests=items.map(item=>{const count=quantities[item.key]??0;if(!integer(count,item.quantity))throw Error(item.name+': количество должно быть целым и не больше доступного.');const weight=count?units(weights[item.item],item.name+' — вес за штуку'):0;if(count&&weight>usable)throw Error(item.name+': один предмет тяжелее доступной грузоподъёмности.');return {...item,count,weight};});
 if(!requests.some(i=>i.count))throw Error('Выберите хотя бы один предмет для перевозки.');
 const requestedWeight=requests.reduce((s,r)=>s+r.count*r.weight,0);
 if(!Number.isSafeInteger(requestedWeight)||requestedWeight>usable*MAX_TRIPS)throw Error('План слишком большой: уменьшите груз до 200 рейсов или увеличьте грузоподъёмность.');
 const trips=[];
 // First fit with heavier units first. This is a feasible plan, not a shortest-route claim.
 for(const request of requests.sort((a,b)=>b.weight-a.weight||a.key.localeCompare(b.key))){
  let requested=request.count;
  for(const line of route.lines.filter(l=>itemKey(l)===request.key)){
   let left=Math.min(requested,line.quantity),used=0;requested-=left;
   while(left){
    let trip=trips.find(t=>Math.floor((usable-t.units)/request.weight)>0);
    if(!trip){if(trips.length>=MAX_TRIPS)throw Error('Нужно больше 200 рейсов. Уменьшите выбранный груз.');trip={units:0,lines:[]};trips.push(trip);}
    const count=Math.min(left,Math.floor((usable-trip.units)/request.weight)),picked=Math.min(count,Math.max(0,line.picked-used));
    trip.lines.push({...line,key:request.key,quantity:count,alreadyPicked:picked,pickup:count-picked,unitWeight:request.weight/1e6});trip.units+=count*request.weight;used+=count;left-=count;
   }
   if(!requested)break;
  }
 }
 return {type:'delivery',server,key,origin:route.origin,destination:route.destination,options:clone(options),signature:JSON.stringify(route.lines),quantity:requests.reduce((s,r)=>s+r.count,0),weight:requestedWeight/1e6,usable:usable/1e6,trips:trips.map(t=>({weight:t.units/1e6,free:(usable-t.units)/1e6,lines:t.lines}))};
}
function apply(store,plan,tripIndex=0){
 let receipt;
 store.transaction(cards=>{
  let fresh;try{fresh=plan.type==='purchase'?purchasePlan(cards,plan.server,plan.key,plan.quantity):plan.type==='delivery'?tripPlan(cards,plan.server,plan.key,plan.options):null;}catch{throw Error('План изменился. Рассчитайте его заново перед отметкой.');}
  if(!fresh||JSON.stringify(fresh)!==JSON.stringify(plan))throw Error('План изменился. Рассчитайте его заново перед отметкой.');
  if(plan.type==='delivery'&&(!integer(tripIndex,plan.trips.length-1)))throw Error('Рейс не найден.');
  const lines=plan.type==='purchase'?plan.lines:plan.trips[tripIndex].lines,edits=[];
  for(const line of lines){
   const card=cards.find(c=>c.uid===line.card),row=card.buys.find(r=>r.uid===line.row),before=clone(row);
   if(plan.type==='purchase')row.bought+=line.quantity;else{row.picked+=line.pickup;row.delivered+=line.quantity;}
   edits.push({card:card.uid,row:row.uid,context:context(card),before,after:clone(row)});
  }
  receipt={server:plan.server,type:plan.type,edits};
 });
 return receipt;
}
function undo(store,receipt,server){
 if(!receipt||receipt.server!==server||!Array.isArray(receipt.edits)||!receipt.edits.length)throw Error('Отмена доступна на исходном сервере операции.');
 store.transaction(cards=>{
  for(const edit of [...receipt.edits].reverse()){
   const card=cards.find(c=>c.uid===edit.card),row=card?.buys.find(r=>r.uid===edit.row);
   if(!card||context(card)!==edit.context||JSON.stringify(row)!==JSON.stringify(edit.after))throw Error('После операции партия изменена. Исправьте отметки вручную в карточке.');
   Object.assign(row,clone(edit.before));
  }
 });
}
function preferences(storage){
 let data={version:1,servers:{}};
 const validate=x=>{
  if(!x||x.version!==1||!x.servers||typeof x.servers!=='object'||Array.isArray(x.servers)||Object.keys(x.servers).some(s=>!servers.includes(s)))throw Error('Неверные настройки рейсов.');
  for(const state of Object.values(x.servers)){
   units(state.capacity,'Грузоподъёмность');if(!Number.isFinite(state.reserve)||state.reserve<0||state.reserve>=100||!state.weights||typeof state.weights!=='object'||Array.isArray(state.weights)||Object.keys(state.weights).length>5000)throw Error('Неверные настройки рейсов.');
   for(const [id,w]of Object.entries(state.weights)){if(!id||id.length>160||['__proto__','constructor','prototype'].includes(id))throw Error('Неверный предмет.');units(w,'Вес');}
  }
 };
 const raw=storage.getItem(PREFS);if(raw)try{data=JSON.parse(raw);validate(data);}catch{throw Error('Настройки рейсов повреждены и сохранены без изменений. Расчёт можно выполнить без сохранения настроек.');}
 return {get(server){if(!servers.includes(server))throw Error('Неизвестный сервер.');return clone(data.servers[server]||{capacity:500,reserve:10,weights:{}});},set(server,state){if(!servers.includes(server))throw Error('Неизвестный сервер.');const next=clone(data);next.servers[server]=clone(state);validate(next);try{storage.setItem(PREFS,JSON.stringify(next));}catch{throw Error('Настройки рейсов не сохранены. Проверьте свободное место.');}data=next;}};
}
const api={PREFS,MAX_TRIPS,itemKey,intervalValue,procurement,purchasePlan,cargo,cargoItems,tripPlan,apply,undo,preferences};root.BatchOperationsMath=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
