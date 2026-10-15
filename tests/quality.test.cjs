'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const w={};for(const file of ['data.js','gear-data.js','extras-data.js','accessory-data.js','mastery-data.js','mastery-engine.js','quality-data.js','quality-engine.js','city-allocation-model.js','engine.js'])vm.runInNewContext(fs.readFileSync(__dirname+'/../dist/'+file,'utf8'),{window:w});
const Q=w.QualityMath,G=w.QUALITY_DATA,MD=w.MASTERY_DATA,M=w.MasteryMath,E=w.CraftEngine;
const recipe=id=>w.ALBION_DATA.recipes.find(r=>r.id===id),close=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
test('base crafting quality and fractional extra rolls match the published sword example',()=>{
 G.craftChances.forEach((p,i)=>close(Q.distribution(0)[i],p));
 const normal=Q.distribution(750),focused=Q.distribution(800);
 [4.2890,54.3076,32.4314,8.1252,.8468].forEach((p,i)=>close(normal[i]*100,p,.0001));
 [3.4992,53.2540,33.7714,8.5790,.8964].forEach((p,i)=>close(focused[i]*100,p,.0001));
 close(Q.distribution(50)[4],.0014995);close(normal.reduce((s,p)=>s+p,0),1);
});
test('quality uses own and shared mastery nodes, food and focus of the selected character',()=>{
 const sword=recipe('T4_MAIN_SWORD');
 const own=Object.entries(MD.nodes).find(([id,n])=>id!=='CRAFT_SWORDS'&&M.matches(sword.id,n.patterns)&&n.kind!=='mastery');
 assert.ok(own);const trained={CRAFT_SWORDS:100,[own[0]]:100};
 const p=Q.predict(sword,100,{focus:false},trained,G,MD,M);close(p.mastery,750);assert.equal(p.rows.reduce((s,r)=>s+r.count,0),100);
 close(Q.predict(sword,100,{focus:true,qualityFoodBonus:50},trained,G,MD,M).bonus,850);
 close(Q.predict(sword,100,{}, {},G,MD,M).rows[4].expected,.1);
 const robe=recipe('T8_ARMOR_CLOTH_AVALON'),all=Object.fromEntries(Object.keys(MD.nodes).map(id=>[id,100]));
 close(Q.predict(robe,100,{},all,G,MD,M).mastery,1087.5);
 assert.ok(Q.predict(robe,100,{},all,G,MD,M).contributions.length>2);
});
test('whole quality examples preserve the exact batch including small and empty batches',()=>{
 for(const amount of [0,1,2,10,100,9999])for(const bonus of [0,50,750,1087.5]){
  const counts=Q.allocate(amount,Q.distribution(bonus));assert.equal(counts.reduce((s,n)=>s+n,0),amount);assert.ok(counts.every(n=>Number.isInteger(n)&&n>=0));
 }
});
test('recipes that preserve a base item quality do not invent a new quality roll',()=>{
 const base={id:'T4_CAPE_TEST',tier:4,quality:true,mats:[{id:'T4_CAPE',n:1,preserveQuality:true}]};
 const result=Q.predict(base,17,{quality:4,focus:true,qualityFoodBonus:1000},{},G,MD,M);
 assert.equal(result.inherited,true);assert.equal(result.rows[3].count,17);close(result.rows[3].probability,1);
 assert.equal(Q.predict({id:'T8_MEAL_STEW',quality:false},100,{}, {},G,MD,M).valid,false);
});
test('paid quality rerolls include all paths and stop at the target or better',()=>{
 const r=Q.reroll(1,4,384,1.156,100,G);assert.equal(r.valid,true);
 close(r.attempts,3.814285714285714);close(r.unitCost,9640.326582857142);close(r.totalCost,964032.6582857142);
 close(r.rounds[2].success,.5065);close(r.rounds[4].success,.853585);close(r.terminal.reduce((s,p)=>s+p,0),1);
 assert.ok(r.terminal[4]>0);assert.equal(r.visits[3],0);close(r.visits.reduce((s,v,i)=>s+v*r.costs[i],0),r.unitCost);
 assert.deepEqual({...r.limits},{p90:6,p95:7,p99:9});
});
test('masterpiece rerolls show long-tail chance, already achieved goals cost zero',()=>{
 const r=Q.reroll(4,5,384,1.156,1,G);close(r.attempts,200);close(r.unitCost,2441472);assert.equal(r.limits.p95,598);
 const ready=Q.reroll(5,5,0,undefined,100,G);assert.equal(ready.valid,true);assert.equal(ready.already,true);assert.equal(ready.totalCost,0);assert.equal(ready.totalAttempts,0);
 assert.equal(Q.reroll(1,5,384,undefined,1,G).valid,false);assert.equal(Q.reroll(1,5,384,1.156,0,G).valid,false);
 assert.equal(Q.reroll(1,4,384,1.156,Infinity,G).valid,false);assert.equal(Q.reroll(5,5,0,1,Infinity,G).valid,false);
});
test('manual in-game attempt fees replace only the relevant current-quality fee',()=>{
 const r=Q.reroll(3,4,384,1.156,2,G,{3:100});close(r.attempts,2);close(r.unitCost,200);close(r.totalCost,400);
 assert.ok(r.costs[0]>100);close(Q.reroll(1,2,384,1.156,1,G,{1:500}).unitCost,500);
 assert.ok(Number.isFinite(Q.reroll(1,2,384,1.156,1,G,{1:Infinity}).unitCost));
});
test('the purchasing buffer applies to resources, not artifacts or finished items',()=>{
 const r={id:'T8_ARMOR_CLOTH_AVALON',kind:'gear',tier:8,output:1,basefocus:0,mats:[{id:'T8_CLOTH',n:16,returns:true},{id:'T8_ARTEFACT_ARMOR_CLOTH_AVALON',n:1,returns:false},{id:'T8_CAPE',n:1,returns:false,preserveQuality:true}]};
 const cfg={quantity:2,rrr:50,buffer:25,station:0};const bill=E.calculate(r,cfg,{recipes:[r]},()=>({price:100,age:0})).bill;
 assert.equal(bill.find(m=>m.id==='T8_CLOTH').buy,20);assert.equal(bill.find(m=>m.id.includes('ARTEFACT')).buy,2);assert.equal(bill.find(m=>m.id==='T8_CAPE').buy,2);
 for(const id of ['T4_SKILLBOOK_STANDARD','T4_JOURNAL_MAGE_EMPTY','T4_CREST_AVALON','T5_MOUNT_HORSE','T4_MAIN_SWORD'])assert.equal(E.bufferEligible({id}),false,id);
 assert.equal(E.bufferEligible({id:'T4_RUNE'}),true);
});
test('scenario projections use the entered period and optional personal profit goal',()=>{
 const short=Q.projection(1000,3,30,0);assert.equal(short.valid,true);assert.equal(short.amount,10000);assert.equal(short.goal,null);assert.equal(short.progress,null);
 const goal=Q.projection(1000,3,60,40000);assert.equal(goal.amount,20000);assert.equal(goal.progress,50);
 assert.equal(Q.projection(1000,3,90,100).progress,100);assert.equal(Q.projection(-1000,3,30,10000).progress,0);
 assert.equal(Q.projection(100,0,30,0).valid,false);
 assert.equal(Q.projection(100,3,0,0).goal,null);assert.equal(Q.projection(100,3,Infinity,500).progress,null);
});
