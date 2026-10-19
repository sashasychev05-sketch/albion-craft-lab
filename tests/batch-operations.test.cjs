'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const B=require('../dist/batch-card-model.js'),O=require('../dist/batch-operations-model.js');
const clone=x=>JSON.parse(JSON.stringify(x));
function memory(){const map=new Map();return {fail:false,getItem:key=>map.get(key)??null,setItem(key,value){if(this.fail)throw Error('full');map.set(key,value);}};}
function seed(overrides={}){return {kind:'purchase',server:'europe',name:'Пенька',item:'T4_FIBER',quantity:100,destination:'Martlock',buys:[{city:'Lymhurst',quantity:100,price:10,order:true}],...overrides};}
function setup(){const storage=memory(),store=B.create(storage);return {storage,store};}
function add(store,overrides={}){return store.add(seed(overrides));}
function ready(store,id,bought,picked=0,delivered=0){store.update(id,c=>Object.assign(c.buys[0],{bought,picked,delivered}));}
function oneTrip(store,options={}){const route=O.cargo(store.snapshot().cards,'europe')[0];return O.tripPlan(store.snapshot().cards,'europe',route.key,{capacity:50,reserve:0,weights:{T4_FIBER:1},quantities:Object.fromEntries(O.cargoItems(route).map(i=>[i.key,i.quantity])),...options});}

test('Procurement combines exact item, city and input quality, with server/archive isolation',()=>{
 const {store}=setup();add(store);add(store,{name:'Вторая партия'});add(store,{quality:2});add(store,{server:'west'});const archived=add(store);store.update(archived.uid,c=>c.archived=true);
 add(store,{kind:'craft',name:'Зелья',item:'T4_POTION_HEAL',quality:5,sales:[{city:'Martlock',quantity:100,price:100}],buys:[{item:'T4_FIBER',name:'Пенька',city:'Lymhurst',quantity:100,price:10}]});
 const groups=O.procurement(store.snapshot().cards,'europe');assert.equal(groups.length,2);assert.equal(groups.find(g=>g.quality===1).quantity,300);assert.equal(groups.find(g=>g.quality===2).quantity,100);
});
test('Remaining purchase estimates integrate price segments without recharging order fees',()=>{
 const row={quantity:100,price:10,order:true,rate:2.5,updates:[{remaining:60,price:20,count:3,exactFee:null},{remaining:20,price:30,count:1,exactFee:100}]};
 assert.equal(O.intervalValue(row,20,60),1000);assert.equal(O.intervalValue(row,80,20),600);assert.equal(O.intervalValue(row,0,100),1800);
 assert.equal(O.intervalValue({...row,price:null},0,10),null);assert.equal(O.intervalValue({...row,price:null},40,60),1400);assert.equal(O.intervalValue({...row,price:0},0,40),0);
});
test('Partial procurement previews FIFO allocations, then changes only bought quantities',()=>{
 const {store}=setup();const first=add(store,{created:'2026-01-01T00:00:00Z'}),second=add(store,{created:'2026-02-01T00:00:00Z',buys:[{city:'Lymhurst',quantity:100,price:12}]});ready(store,first.uid,70,20);
 const cards=store.snapshot().cards,key=O.procurement(cards,'europe')[0].key,before=store.snapshot(),plan=O.purchasePlan(cards,'europe',key,50);
 assert.deepEqual(plan.lines.map(l=>l.quantity),[30,20]);assert.equal(plan.cost,540);assert.deepEqual(store.snapshot(),before);
 const receipt=O.apply(store,plan),next=store.snapshot().cards;assert.deepEqual(next.map(c=>c.buys[0].bought),[100,20]);assert.deepEqual(next.map(c=>c.buys[0].picked),[20,0]);assert.equal(next[1].buys[0].price,12);
 O.undo(store,receipt,'europe');assert.deepEqual(store.snapshot(),before);
});
test('Unknown costs remain unknown; invalid purchase quantities never change cards',()=>{
 const {store}=setup();add(store,{buys:[{city:'Lymhurst',quantity:100,price:null}]});const cards=store.snapshot().cards,key=O.procurement(cards,'europe')[0].key;
 assert.equal(O.procurement(cards,'europe')[0].cost,null);assert.equal(O.purchasePlan(cards,'europe',key,5).cost,null);
 for(const qty of [0,-1,1.5,NaN,101,'5'])assert.throws(()=>O.purchasePlan(cards,'europe',key,qty));
});
test('An intervening edit or repeated purchase cannot apply an old distribution',()=>{
 const {store}=setup();const card=add(store),key=O.procurement(store.snapshot().cards,'europe')[0].key,plan=O.purchasePlan(store.snapshot().cards,'europe',key,10);O.apply(store,plan);assert.throws(()=>O.apply(store,plan),/изменился/);
 const next=O.purchasePlan(store.snapshot().cards,'europe',key,10);store.update(card.uid,c=>c.buys[0].price=11);const before=store.snapshot();assert.throws(()=>O.apply(store,next),/изменился/);assert.deepEqual(store.snapshot(),before);
});
test('Multi-card commits and undo are atomic when storage fails or an affected row changes',()=>{
 const {storage,store}=setup();add(store);add(store);const key=O.procurement(store.snapshot().cards,'europe')[0].key,plan=O.purchasePlan(store.snapshot().cards,'europe',key,150),before=store.snapshot();storage.fail=true;
 assert.throws(()=>O.apply(store,plan),/сохранить/);assert.deepEqual(store.snapshot(),before);storage.fail=false;
 const receipt=O.apply(store,plan);store.update(receipt.edits.at(-1).card,c=>c.buys[0].picked=1);const edited=store.snapshot();assert.throws(()=>O.undo(store,receipt,'europe'),/изменена/);assert.deepEqual(store.snapshot(),edited);assert.throws(()=>O.undo(store,receipt,'west'),/сервере/);
});
test('Cargo includes only bought undelivered goods between distinct known cities',()=>{
 const {store}=setup(),a=add(store);ready(store,a.uid,80,30,10);add(store);const same=add(store,{destination:'Lymhurst'});ready(store,same.uid,10);const noCity=add(store,{buys:[{city:'',quantity:100,price:10}]});ready(store,noCity.uid,10);const noDest=add(store,{destination:''});ready(store,noDest.uid,10);const west=add(store,{server:'west'});ready(store,west.uid,10);const archive=add(store);ready(store,archive.uid,10);store.update(archive.uid,c=>c.archived=true);
 const routes=O.cargo(store.snapshot().cards,'europe');assert.equal(routes.length,1);assert.equal(routes[0].lines.length,1);assert.deepEqual([routes[0].lines[0].quantity,routes[0].lines[0].picked,routes[0].lines[0].pickup],[70,20,50]);
});
test('Mixed cargo shares spare capacity, preserves every item/card and respects reserve',()=>{
 const {store}=setup();const a=add(store,{quantity:7,buys:[{city:'Lymhurst',quantity:7,price:10}]}),b=add(store,{item:'OTHER',name:'Роскошь',quantity:4,buys:[{city:'Lymhurst',quantity:4,price:20}]});ready(store,a.uid,7,2);ready(store,b.uid,4,4);
 const plan=oneTrip(store,{capacity:10,reserve:10,weights:{T4_FIBER:2,OTHER:3}});assert.equal(plan.weight,26);assert.equal(plan.usable,9);assert.equal(plan.quantity,11);assert.ok(plan.trips.every(t=>t.weight<=9&&t.free>=0));assert.equal(plan.trips.reduce((s,t)=>s+t.lines.reduce((n,l)=>n+l.quantity,0),0),11);assert.ok(plan.trips.some(t=>new Set(t.lines.map(l=>l.item)).size===2));
 const original=store.snapshot(),trip=plan.trips[0],receipt=O.apply(store,plan,0);for(const line of trip.lines){const row=store.snapshot().cards.find(c=>c.uid===line.card).buys[0];assert.equal(row.delivered,line.quantity);assert.ok(row.picked>=row.delivered);assert.equal(row.bought,line.item==='OTHER'?4:7);}O.undo(store,receipt,'europe');assert.deepEqual(store.snapshot(),original);
});
test('Delivery accounts for already picked quantities first and remaining cargo can be replanned',()=>{
 const {store}=setup(),card=add(store);ready(store,card.uid,100,60,10);const before=store.snapshot(),plan=oneTrip(store,{capacity:30});assert.equal(plan.trips[0].lines[0].pickup,0);O.apply(store,plan);assert.deepEqual([store.snapshot().cards[0].buys[0].picked,store.snapshot().cards[0].buys[0].delivered],[60,40]);assert.throws(()=>O.apply(store,plan),/изменился/);
 while(O.cargo(store.snapshot().cards,'europe').length)O.apply(store,oneTrip(store));const row=store.snapshot().cards[0].buys[0];assert.deepEqual([row.bought,row.picked,row.delivered],[100,100,100]);assert.equal(before.cards[0].buys[0].delivered,10);
});
test('Zero quantities exclude missing weights, and excessive, fractional or invalid cargo is rejected',()=>{
 const {store}=setup(),card=add(store);ready(store,card.uid,100);const route=O.cargo(store.snapshot().cards,'europe')[0],key=O.cargoItems(route)[0].key;
 for(const overrides of [{weights:{}},{weights:{T4_FIBER:0}},{weights:{T4_FIBER:-1}},{capacity:0},{reserve:100},{reserve:-1},{quantities:{[key]:101}},{quantities:{[key]:1.5}},{quantities:{[key]:0}},{weights:{T4_FIBER:50},capacity:10}])assert.throws(()=>oneTrip(store,overrides));
 const other=add(store,{item:'OTHER'});ready(store,other.uid,10);assert.doesNotThrow(()=>oneTrip(store,{quantities:{[key]:10},weights:{T4_FIBER:1}}));
});
test('Integer micro-kilograms prevent overloaded trips at decimal boundaries',()=>{
 const {store}=setup(),card=add(store);ready(store,card.uid,100);const plan=oneTrip(store,{capacity:.3,weights:{T4_FIBER:.1}});assert.equal(plan.trips.length,34);assert.equal(plan.trips[0].lines[0].quantity,3);assert.ok(plan.trips.every(t=>t.weight<=.3));
 assert.throws(()=>oneTrip(store,{weights:{T4_FIBER:.0000001}}));
});
test('Large plans terminate at the explicit trip limit, including indivisible-item packing',()=>{
 const {store}=setup(),card=add(store,{quantity:1000,buys:[{city:'Lymhurst',quantity:1000,price:1}]});ready(store,card.uid,1000);assert.throws(()=>oneTrip(store,{capacity:1}),/200 рейсов/);
 const key=O.cargoItems(O.cargo(store.snapshot().cards,'europe')[0])[0].key;assert.throws(()=>oneTrip(store,{capacity:1,weights:{T4_FIBER:.6},quantities:{[key]:300}}),/200 рейсов/);
});
test('Cargo changes, archived cards and forged plan totals invalidate delivery atomically',()=>{
 const {store}=setup(),card=add(store);ready(store,card.uid,100);const plan=oneTrip(store),forged=clone(plan);forged.trips[0].lines[0].quantity=99;assert.throws(()=>O.apply(store,forged),/изменился/);store.update(card.uid,c=>c.destination='Thetford');const before=store.snapshot();assert.throws(()=>O.apply(store,plan));assert.deepEqual(store.snapshot(),before);
});
test('Transaction validates all cards and retains the previous storage snapshot on failure',()=>{
 const {store,storage}=setup();add(store);const before=store.snapshot(),raw=storage.getItem(B.KEY);assert.throws(()=>store.transaction(cards=>{cards[0].buys[0].bought=10;cards.push(clone(cards[0]));}),/Повтор/);assert.deepEqual(store.snapshot(),before);assert.equal(storage.getItem(B.KEY),raw);
});
test('Transport preferences persist per server, reject bad values and preserve corrupted input',()=>{
 const storage=memory(),prefs=O.preferences(storage);prefs.set('europe',{capacity:1000,reserve:15,weights:{T4_FIBER:.2}});assert.equal(O.preferences(storage).get('europe').weights.T4_FIBER,.2);assert.equal(prefs.get('west').capacity,500);const raw=storage.getItem(O.PREFS);
 assert.throws(()=>prefs.set('europe',{capacity:0,reserve:15,weights:{}}));assert.equal(storage.getItem(O.PREFS),raw);storage.fail=true;assert.throws(()=>prefs.set('europe',{capacity:200,reserve:0,weights:{}}),/не сохранены/);assert.equal(prefs.get('europe').capacity,1000);storage.fail=false;
 storage.setItem(O.PREFS,'{"version":1,"servers":{"europe":{"capacity":-1}}}');const corrupted=storage.getItem(O.PREFS);assert.throws(()=>O.preferences(storage),/повреждены/);assert.equal(storage.getItem(O.PREFS),corrupted);
});
test('Mixed trip plans conserve per-row goods and picked units for many deterministic load combinations',()=>{
 for(let sample=1;sample<=40;sample++){
  const {store}=setup(),weights={},expected=new Map();
  for(let i=0;i<5;i++){const item='ITEM_'+i,quantity=1+(sample*(i+3))%29,card=add(store,{item,quantity,quality:1+i%2,buys:[{city:'Lymhurst',quantity,price:10}]});ready(store,card.uid,quantity,Math.floor(quantity/2),Math.floor(quantity/4));weights[item]=(1+(sample+i)%9)/10;expected.set(card.buys[0].uid,quantity-Math.floor(quantity/4));}
  const plan=oneTrip(store,{capacity:10,reserve:7.5,weights}),actual=new Map();for(const trip of plan.trips){assert.ok(trip.weight<=plan.usable);for(const line of trip.lines){assert.equal(line.pickup+line.alreadyPicked,line.quantity);actual.set(line.row,(actual.get(line.row)||0)+line.quantity);}}
  assert.deepEqual(actual,expected);const chosen=plan.trips.length-1,before=store.snapshot(),receipt=O.apply(store,plan,chosen);for(const c of store.snapshot().cards)assert.doesNotThrow(()=>B.summary(c));O.undo(store,receipt,'europe');assert.deepEqual(store.snapshot(),before);
 }
});
test('Unselected rows and archived batches invalidate outstanding operations without partial writes',()=>{
 const {store}=setup();const first=add(store),second=add(store);const group=O.procurement(store.snapshot().cards,'europe')[0],plan=O.purchasePlan(store.snapshot().cards,'europe',group.key,1);store.update(second.uid,c=>c.archived=true);const before=store.snapshot();assert.throws(()=>O.apply(store,plan),/изменился/);assert.deepEqual(store.snapshot(),before);
 ready(store,first.uid,20);const trip=oneTrip(store);store.update(first.uid,c=>c.archived=true);const archived=store.snapshot();assert.throws(()=>O.apply(store,trip),/изменился/);assert.deepEqual(store.snapshot(),archived);
});
test('Undo cannot remove material delivery after manufacturing or goods after a sale',()=>{
 const {store}=setup(),craft=add(store,{kind:'craft',sales:[{city:'Martlock',quantity:100,price:20}]});ready(store,craft.uid,100);const receipt=O.apply(store,oneTrip(store));store.update(craft.uid,c=>c.made=10);const made=store.snapshot();assert.throws(()=>O.undo(store,receipt,'europe'),/изменена/);assert.deepEqual(store.snapshot(),made);
 const other=setup(),luxury=add(other.store,{kind:'luxury',sales:[{city:'Martlock',quantity:100,price:20}]});ready(other.store,luxury.uid,100);const delivered=O.apply(other.store,oneTrip(other.store));other.store.update(luxury.uid,c=>c.sales[0].sold=1);const sold=other.store.snapshot();assert.throws(()=>O.undo(other.store,delivered,'europe'),/изменена/);assert.deepEqual(other.store.snapshot(),sold);
});
