const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const w={};for(const f of ['data.js','gear-data.js','extras-data.js'])vm.runInNewContext(fs.readFileSync(__dirname+'/../dist/'+f,'utf8'),{window:w});
const D=JSON.parse(JSON.stringify(w.ALBION_DATA)),X=JSON.parse(JSON.stringify(w.CRAFT_EXTRAS)),T=require('../dist/extras-engine.js'),E=require('../dist/engine.js');
const recipe=id=>D.recipes.find(r=>r.id===id),quote=prices=>id=>({price:prices[id]||0,age:1,city:'Lymhurst'});
const cfg={quantity:100,volumeMode:'quantity',rrr:50,station:300,unitFee:2,focus:true,eff:0,salePrice:5000,saleMode:'buy',tax:4,buffer:0,chain:false,heartMode:'auto'};
const cloth=recipe('T5_CLOTH'),heart='T1_FACTION_SWAMP_TOKEN_1';let q=quote({T5_FIBER:1000,T4_CLOTH:100,[heart]:500});
let r=E.calculate(cloth,cfg,D,q);assert.equal(r.refiningPlans[0].method,'heart');assert.equal(r.bill.find(m=>m.id===heart).buy,50);assert.equal(r.bill.find(m=>m.id==='T5_FIBER').buy,100);assert.equal(r.materialCost,130000);assert.equal(r.fees,200);const focus=r.focus;
r=E.calculate(cloth,{...cfg,heartMode:'standard'},D,q);assert.equal(r.materialCost,155000);assert.equal(r.focus,focus);assert.ok(!r.bill.some(m=>m.id===heart));assert.ok(r.refiningPlans[0].marketIds.includes(heart));
r=E.calculate(cloth,cfg,D,quote({T5_FIBER:1000,T4_CLOTH:100,[heart]:1500}));assert.equal(r.refiningPlans[0].method,'standard');
r=E.calculate(cloth,cfg,D,quote({T5_FIBER:1000,T4_CLOTH:100}));assert.equal(r.refiningPlans[0].method,'standard');assert.equal(r.missing,false);
r=E.calculate(cloth,{...cfg,heartMode:'heart'},D,quote({T5_FIBER:1000,T4_CLOTH:100}));assert.equal(r.refiningPlans[0].method,'heart');assert.equal(r.missing,true);
assert.equal(Object.keys(X.hearts).length,85);assert.ok(Object.keys(X.hearts).every(id=>!id.endsWith('@4')));
for(const id of ['T5_CLOTH_LEVEL4@4','T6_CLOTH_LEVEL4@4']){r=E.calculate(recipe(id),{...cfg,heartMode:'heart'},D,()=>({price:1,age:1}));assert.equal(r.refiningPlans[0].heart,null);assert.ok(r.bill.every(m=>!m.id.startsWith('T1_FACTION_')))}
r=E.calculate(recipe('T5_BAG'),{...cfg,heartMode:'heart',refineSteps:{T5_CLOTH:true},chainRrr:50,chainStation:300},D,()=>({price:10,age:1}));assert.ok(r.bill.some(m=>m.id===heart));assert.ok(r.bill.some(m=>m.id==='T5_LEATHER'));assert.equal(r.refiningPlans.length,1);assert.equal(r.focus,E.calculate(recipe('T5_BAG'),{...cfg,refineSteps:{},chainRrr:50},D,q).focus);
assert.equal(X.transmutations.length,191);assert.ok(X.transmutations.every(e=>e.count===1&&e.output===1&&X.resources[e.from]&&X.resources[e.to]));
let p=T.conversion('T4_FIBER','T6_FIBER',100,X);assert.equal(p.silver,203100);assert.equal(p.sourceCount,100);assert.deepEqual(p.steps.map(e=>e.to),['T5_FIBER','T6_FIBER']);assert.equal(T.conversion('T6_FIBER','T4_FIBER',1,X),null);assert.equal(T.conversion('T4_FIBER','T6_FIBER',0,X),null);
p=T.conversion('T4_FIBER_LEVEL4@4','T6_FIBER_LEVEL4@4',2,X);assert.equal(p.sourceCount,2);assert.ok(p.silver>0);assert.equal(p.steps.length,2);
const results=T.compare('T6_FIBER',100,X,quote({T4_FIBER:10,T5_FIBER:900,T6_FIBER:3000}));assert.equal(results[0].source,'T4_FIBER');assert.equal(results[0].cost,204100);assert.equal(results.find(r=>r.source==='T6_FIBER').silver,0);assert.equal(results.find(r=>r.source==='T6_FIBER').cost,300000);
for(const e of X.transmutations){const path=T.conversion(e.from,e.to,1,X);assert.ok(path);assert.ok(path.silver<=e.silver);assert.equal(path.steps.at(-1).to,e.to)}
const potions=D.recipes.filter(r=>r.kind==='potions');assert.equal(potions.length,172);assert.equal(Object.keys(X.potionProducts).length,15);assert.ok(potions.every(r=>/^T[2-8]_/.test(r.id)&&r.mats.length&&r.fee300>0));
const heal=recipe('T2_POTION_HEAL');r=E.calculate(heal,{...cfg,volumeMode:'focus',focusBudget:560,rrr:0,unitFee:heal.fee300},D,()=>({price:10,age:1}));assert.equal(r.ops,2);assert.equal(r.amount,10);assert.equal(r.focus,560);assert.equal(r.bill[0].buy,16);assert.equal(r.fees,216);
console.log('PASS: heart costs, returns, manual and missing prices, .4 unavailable, bag steps, 191 transmutation routes, cheapest source, 172 potion recipes and focus');
