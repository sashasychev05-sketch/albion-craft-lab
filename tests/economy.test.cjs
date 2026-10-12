const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),w={};
for(const file of ['data.js','food-focus-data.js','gear-data.js','extras-data.js','island-data.js','economy-data.js','mastery-data.js','mastery-engine.js','engine.js'])vm.runInNewContext(fs.readFileSync(__dirname+'/../dist/'+file,'utf8'),{window:w});
const X=w.ECONOMY_DATA,E=require('../dist/economy-engine.js'),config={quantity:2,buyCity:'Lymhurst',sellCity:'Black Market',quality:4,tax:4,setup:2.5,saleMode:'instant',prices:{}},recipe=id=>w.ALBION_DATA.recipes.find(r=>r.id===id);
test('Food focus uses per-item game values and all 900 cooking specializations contribute once',()=>{
 const r=recipe('T8_MEAL_STEW@1'),levels=Object.fromEntries(Object.keys(w.MASTERY_DATA.nodes).filter(id=>id.startsWith('FARM_COOK')).map(id=>[id,100]));
 assert.equal(r.basefocus,752);assert.equal(r.output,10);assert.equal(w.MasteryMath.cost(r,0),7520);assert.equal(w.MasteryMath.efficiency(r,levels,w.MASTERY_DATA),55000);
 const a=w.CraftEngine.calculate(r,{focus:true,volumeMode:'focus',focusBudget:30000,focusSource:'levels',masteryLevels:levels},w.ALBION_DATA,()=>({price:1,age:0}));assert.equal(a.perOp,167);assert.equal(a.amount,1790);assert.equal(a.focus,29893);
 const b=w.CraftEngine.calculate(r,{focus:true,volumeMode:'focus',focusBudget:30000,focusSource:'levels',masteryLevels:levels,focusOverrides:{[r.id]:200}},w.ALBION_DATA,()=>({price:1,age:0}));assert.equal(b.amount,1500);assert.equal(b.focus,30000);
 assert.equal(w.MasteryMath.cost(recipe('T8_MEAL_STEW_FISH'),0),652);assert.equal(w.MasteryMath.cost(recipe('T2_POTION_HEAL'),0),280);
});
test('Upgrade follows every supported stage, preserves quality and rejects .4 or cross-item paths',()=>{
 const p=E.enchant('T4_MAIN_SWORD','T4_MAIN_SWORD@3',config,X);assert.equal(p.steps.length,3);assert.equal(p.inputs.find(m=>m.id==='T4_RUNE').n,576);assert.equal(p.inputs.find(m=>m.id==='T4_SOUL').n,576);assert.equal(p.inputs.find(m=>m.id==='T4_RELIC').n,576);assert.equal(p.outputs[0].quality,true);
 assert.equal(E.route('T4_MAIN_SWORD','T4_MAIN_SWORD@4',X),null);assert.equal(E.route('T4_MAIN_SWORD','T4_MAIN_AXE@1',X),null);assert.equal(E.route('T4_MAIN_SWORD@2','T4_MAIN_SWORD@1',X),null);
});
test('Finished gear and Black Market price use selected quality; resource quality stays normal',()=>{
 const calls=[],p=E.enchant('T4_MAIN_SWORD','T4_MAIN_SWORD@1',config,X);const r=E.totals(p,config,(id,side,city,q)=>{calls.push([id,side,city,q]);return {price:side==='sell'?1000:id.includes('RUNE')?1:100,daily:10}});
 assert.ok(calls.some(x=>x[0]==='T4_MAIN_SWORD@1'&&x[2]==='Black Market'&&x[3]===4));assert.ok(calls.some(x=>x[0]==='T4_RUNE'&&x[3]===1));assert.equal(r.fees,80);assert.equal(r.cost,776);assert.equal(r.profit,1144);assert.equal(r.liquidity[0].days,.2);
 const order=E.totals(p,{...config,saleMode:'order'},()=>({price:100}));assert.equal(order.fees,13);
});
test('Missing finished-item prices block profit; overrides are scoped to city, side and quality',()=>{
 const p=E.enchant('T4_MAIN_SWORD','T4_MAIN_SWORD@1',config,X),key='Black Market|sell|T4_MAIN_SWORD@1|4';let r=E.totals(p,config,(id,side)=>({price:side==='sell'?0:1}));assert.equal(r.ready,false);
 r=E.totals(p,{...config,prices:{[key]:100}},(id,side)=>({price:side==='sell'?0:1}));assert.equal(r.ready,true);assert.equal(r.outputs[0].manual,true);
 r=E.totals(p,{...config,quality:3,prices:{[key]:100}},(id,side)=>({price:side==='sell'?0:1}));assert.equal(r.ready,false);
});
test('Salvage rounds conservatively per item, honors durability, excludes unknown artifacts',()=>{
 let p=E.salvage('T4_MAIN_SWORD@1',{quantity:10,condition:100},X);assert.equal(p.outputs.find(r=>r.id==='T4_METALBAR_LEVEL1@1').n,30);assert.equal(p.outputs.find(r=>r.id==='T4_LEATHER_LEVEL1@1').n,10);
 p=E.salvage('T4_MAIN_SWORD',{quantity:10,condition:50},X);assert.equal(p.outputs.find(r=>r.id==='T4_METALBAR').n,10);assert.ok(!p.outputs.some(r=>r.id==='T4_LEATHER'));
 p=E.salvage('T4_MAIN_SWORD',{quantity:10,condition:0,yields:{T4_METALBAR:2.5},silver:20},X);assert.equal(p.outputs[0].n,25);assert.equal(p.silver,200);
 assert.ok(Object.values(X.salvage).flat().every(m=>!m.id.includes('ARTEFACT')));
});
test('Filled journals count only complete books and charge empty journals once',()=>{
 const j=w.IslandData.journals.find(j=>j.id==='T4_JOURNAL_WARRIOR'),p=E.journal({...j,maxFame:X.journals[j.id].maxFame},{byFame:true,fame:10000,fillCost:50});assert.equal(p.filled,2);assert.equal(p.remainder,2800);assert.equal(p.inputs[0].n,2);
 const r=E.totals(p,{...config,sellCity:'Lymhurst'},(id,side)=>({price:side==='sell'?500:100}));assert.equal(r.cost,300);assert.equal(r.profit,660);
 assert.ok(X.journals[j.id].validItems.includes('T4_MAIN_SWORD'));assert.ok(!X.journals[j.id].validItems.includes('T8_MEAL_STEW'));
});
test('Saddling buys an adult once and never charges breeding feed or focus',()=>{
 const m=X.mounts.find(m=>m.id==='T3_MOUNT_HORSE'),p=E.mount(m,{quantity:3,mountMode:'saddle',fee:25},X);assert.equal(p.inputs.find(x=>x.id===m.grown).n,3);assert.equal(p.inputs.find(x=>x.id==='T3_LEATHER').n,60);assert.equal(p.focus,0);assert.equal(p.extra,75);
});
test('Repeat breeding reserves offspring, purchases deficits and separates starting stock from profit',()=>{
 const m=X.mounts.find(m=>m.id==='T3_MOUNT_HORSE'),p=E.mount(m,{quantity:10,mountMode:'full',feed:'T1_CARROT',feedQty:10,repeat:true,sellBabies:true,nurtures:1,nurtureFocus:100,premium:true},X);
 assert.ok(Math.abs(p.keep-10)<1e-9);assert.ok(Math.abs(p.babyReturn-10.4)<1e-9);assert.equal(p.inputs.find(x=>x.id==='T3_FARM_HORSE_BABY').n,0);assert.ok(Math.abs(p.outputs.find(x=>x.id==='T3_FARM_HORSE_BABY').n-.4)<1e-9);assert.equal(p.hours,22);assert.equal(p.focus,1000);
 const r=E.totals(p,{...config,sellCity:'Lymhurst'},()=>({price:100}));assert.equal(r.investment,1000);assert.equal(r.netCash,r.profit-1000);assert.equal(r.requiredCash,r.cost+1000);
 const deficit=E.mount(m,{quantity:10,mountMode:'grown',feed:'T1_CARROT',feedQty:10,repeat:true,nurtures:0,premium:false},X);assert.ok(Math.abs(deficit.deficit-1.6)<1e-9);assert.equal(deficit.hours,44);
});
test('Breeding blocks missing total feed and limits nurture bonuses to recipe actions',()=>{
 const m=X.mounts.find(m=>m.id==='T3_MOUNT_HORSE');assert.equal(E.mount(m,{quantity:1,mountMode:'full',feedQty:0},X).valid,false);
 const p=E.mount(m,{quantity:1,mountMode:'grown',feed:'T1_CARROT',feedQty:10,nurtures:999,nurtureFocus:100,premium:true},X);assert.equal(p.focus,100);assert.ok(p.babyReturn<=1.04+1e-9);
 assert.ok(X.mounts.length>=40);assert.ok(X.breeders.length>=30);assert.ok(X.breeders.every(b=>b.hours>0&&b.actions>=0));
});
