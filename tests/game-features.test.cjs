const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const S=require('../dist/sale-math.js'),L=require('../dist/craft-ledger.js'),C=require('../dist/catalog-engine.js'),J=require('../dist/craft-journal-engine.js'),I=require('../dist/island-engine.js');
const w={};for(const f of ['data.js','food-focus-data.js','gear-data.js','extras-data.js','economy-data.js','island-data.js','price-catalog.js','mastery-data.js','training-thresholds-data.js','mastery-engine.js','craft-journal-engine.js','city-allocation-model.js','engine.js'])vm.runInNewContext(fs.readFileSync(__dirname+'/../dist/'+f,'utf8'),{window:w});
const recipe=id=>w.ALBION_DATA.recipes.find(r=>r.id===id),memory=()=>{let raw;return {getItem:()=>raw||null,setItem:(_,value)=>raw=value}};
test('Direct deals use a 5% discount, locked unit cost and all fixed and percentage expenses',()=>{
 const d=S.deal({quantity:20,unitCost:700,average:1000,discount:5,tax:0,setup:0,transport:100,fixedFees:50});assert.equal(d.price,950);assert.equal(d.profit,4850);assert.equal(d.breakEven,707.5);
 const market=S.deal({quantity:10,unitCost:935,fixedPrice:1000,tax:4,setup:2.5});assert.ok(Math.abs(market.profit)<1e-8);assert.equal(market.breakEven,1000);assert.equal(S.breakEven(1000,10,100),null);assert.equal(S.breakEven(1000,0),null);
});
test('Daily mean weighs hourly sell volume in UTC and excludes current hour and older sales',()=>{
 const now=Date.parse('2026-10-13T12:30:00Z'),d=S.daily([{timestamp:'2026-10-12T12:00:00',item_count:2,avg_price:100},{timestamp:'2026-10-13T11:00:00Z',item_count:8,avg_price:200},{timestamp:'2026-10-13T12:00:00Z',item_count:100,avg_price:900},{timestamp:'2026-10-12T11:00:00Z',item_count:100,avg_price:900}],now);assert.equal(d.average,180);assert.equal(d.volume,10);assert.equal(d.hours,2);assert.equal(S.daily([],now).valid,false);
});
test('Craft history locks cost across partial sales and reload, undo restores exactly the sold stock',()=>{
 const storage=memory(),store=L.create(storage),b=store.addBatch({server:'europe',item:'T4_METALBAR',quality:1,quantity:100,totalCost:12345,character:'one'}),deal={batch:b.uid,server:'europe',item:b.item,quality:1,quantity:30,unitCost:123.45,price:200,fees:0,profit:2296.5};const sold=store.addDeal(deal);assert.equal(store.snapshot().batches[0].remaining,70);assert.equal(L.create(storage).snapshot().batches[0].unitCost,123.45);
 const before=JSON.stringify(store.snapshot());assert.throws(()=>store.addDeal({...deal,quantity:71}));assert.throws(()=>store.addDeal({...deal,unitCost:1}));assert.throws(()=>store.addDeal({...deal,server:'west'}));assert.equal(JSON.stringify(store.snapshot()),before);store.undoDeal(sold.uid);assert.equal(store.snapshot().batches[0].remaining,100);assert.equal(store.snapshot().batches[0].totalCost,12345);
});
test('Failed history writes are atomic and malformed existing records are preserved',()=>{
 const storage=memory(),store=L.create(storage),b=store.addBatch({server:'europe',item:'T4_METALBAR',quality:1,quantity:10,totalCost:100});storage.setItem=()=>{throw Error('disk full')};assert.throws(()=>store.addDeal({batch:b.uid,server:'europe',item:b.item,quality:1,quantity:1,unitCost:10,price:20,fees:0,profit:10}));assert.equal(store.snapshot().batches[0].remaining,10);assert.equal(store.snapshot().deals.length,0);assert.throws(()=>L.create({getItem:()=>'{bad',setItem:()=>assert.fail('must preserve')}));
});
test('Craft journals add full minus empty price after sale fees and reduce break-even only once',()=>{
 const r=recipe('T4_MAIN_SWORD'),config={quantity:10,rrr:0,station:0,buffer:0,salePrice:1000,saleMode:'sell',tax:4,setup:2.5,withJournals:true,journalEmptyPrice:100,journalFullPrice:500};const a=w.CraftEngine.calculate(r,config,w.ALBION_DATA,()=>({price:10,age:0})),b=w.CraftEngine.calculate(r,{...config,withJournals:false},w.ALBION_DATA,()=>({price:10,age:0}));assert.ok(a.journals.count>0);assert.equal(a.profit-b.profit,a.journals.count*367.5);assert.equal(a.cost-b.cost,a.journals.count*100);assert.ok(Math.abs(a.gross-a.tax-a.setup-a.cost-a.profit)<1e-8);assert.ok(Math.abs(a.breakEven-(a.productionCost-a.journals.profit)/(a.amount*.935))<1e-8);
 assert.equal(J.eligible(recipe('T8_MEAL_STEW'),w.ECONOMY_DATA).length,0);const small=J.calculate(r,0,config,w.ECONOMY_DATA,w.MASTERY_DATA.fame,()=>({price:0}));assert.equal(small.missing,false);assert.equal(small.count,0);
});
test('Food specialization 0 to 100 agrees with public thresholds and the supplied reference curve',()=>{
 const r=recipe('T8_MEAL_STEW'),n=w.MASTERY_DATA.nodes.FARM_COOK_STEW,config={from:0,to:100,premium:true};const craft=w.MasteryMath.train(r,n,config,w.MASTERY_DATA),rounded=w.MasteryMath.train(r,n,{...config,xpMode:'reference'},w.MASTERY_DATA);assert.equal(craft.required,4035884);assert.equal(rounded.required,4035768);assert.equal(craft.rows[0].required,3564);assert.equal(rounded.rows.at(-1).required,126528);assert.equal(craft.quantity,9350);
 const study=w.MasteryMath.train(r,n,{...config,method:'craftStudy'},w.MASTERY_DATA),buy=w.MasteryMath.train(r,n,{...config,method:'buyStudy'},w.MASTERY_DATA);assert.equal(study.studyFame,1188);assert.equal(study.perItem,1620);assert.equal(study.quantity,2500);assert.equal(buy.quantity,3398);assert.equal(buy.craftOperations,0);assert.equal(buy.studied,3398);
 const ench=w.MasteryMath.train(recipe('T8_MEAL_STEW@1'),n,{...config,method:'buyStudy'},w.MASTERY_DATA);assert.equal(ench.studyFame,buy.studyFame);assert.equal(w.MasteryMath.train(r,n,{...config,method:'buyStudy',studyFameOverride:0},w.MASTERY_DATA).valid,false);
});
test('Island break-even covers supply, fees and shared daily expense, credits surplus seeds',()=>{
 const p=I.defaults(),c=w.IslandData.crops[0];p.crops=[{uid:'crop',id:c.id,plots:1,water:9,stock:9,sellSeeds:true}];p.transport=90;p.other=10;p.premiumDaily=50;const a=I.calculate(p,w.IslandData,()=>({price:100})),r=a.rows[0],profitAtBreakEven=r.mainQuantity*r.breakEven*.935+r.sideIncome-r.cost-r.allocatedCommon;assert.ok(Math.abs(profitAtBreakEven)<1e-8||r.breakEven===0&&profitAtBreakEven>=0);assert.equal(r.allocatedCommon,150);
});
test('Mount groups distinguish horses, oxen, armor and battle mounts; service records stay hidden',()=>{
 for(const [id,sub]of [['T3_MOUNT_HORSE','horse'],['T3_MOUNT_OX','ox'],['T5_MOUNT_ARMORED_HORSE','armored'],['T8_MOUNT_MAMMOTH_BATTLE@1','battle']]){const r=w.PRICE_CATALOG.find(r=>r.id===id);assert.ok(r,id);assert.equal(C.category(r).sub,sub);}
 assert.ok(!w.PRICE_CATALOG.some(r=>r.id.includes('_TEST')||r.id.startsWith('QUESTITEM_CARAVAN')));assert.ok(w.ECONOMY_DATA.mounts.some(r=>r.id==='T8_MOUNT_MAMMOTH_BATTLE@1'));assert.ok(C.matches(w.PRICE_CATALOG.find(r=>r.id==='T8_MEAL_STEW@1'),{search:'T8.1'}));
});
