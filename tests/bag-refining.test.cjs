const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const w={};vm.runInNewContext(fs.readFileSync(__dirname+'/../dist/data.js','utf8'),{window:w});
const D=JSON.parse(JSON.stringify(w.ALBION_DATA));const E=require('../dist/engine.js');
const recipe=id=>D.recipes.find(r=>r.id===id),bag=recipe('T5_BAG');
const quote=()=>({price:3,age:1,city:'Lymhurst'});
const cfg={quantity:10,rrr:50,chainRrr:50,station:300,chainStation:600,unitFee:bag.fee300,focus:true,eff:0,salePrice:10000,saleMode:'buy',tax:4,buffer:0,chain:true,startTier:3,refineSteps:{}};
const calc=steps=>E.calculate(bag,{...cfg,refineSteps:steps},D,quote);
const amounts=r=>Object.fromEntries(r.bill.map(m=>[m.id,m.net]));
let r=calc({});assert.deepEqual(amounts(r),{T5_CLOTH:40,T5_LEATHER:40});assert.equal(r.stages.length,1);assert.equal(r.fees,1728);
r=calc({T5_CLOTH:true});assert.deepEqual(amounts(r),{T5_FIBER:60,T4_CLOTH:20,T5_LEATHER:40});assert.equal(r.fees,2592);assert.equal(r.focus,15010);assert.equal(r.materialCost,360);assert.equal(r.profit,93048);
r=calc({T5_CLOTH:true,T4_CLOTH:true});assert.deepEqual(amounts(r),{T5_FIBER:60,T4_FIBER:20,T3_CLOTH:10,T5_LEATHER:40});assert.equal(r.fees,2808);assert.ok(!r.bill.some(m=>m.id==='T3_FIBER'));
r=calc({T5_CLOTH:true,T4_CLOTH:true,T3_CLOTH:true});assert.deepEqual(amounts(r),{T5_FIBER:60,T4_FIBER:20,T3_FIBER:10,T2_CLOTH:5,T5_LEATHER:40});assert.equal(r.fees,2862);
// A lower-tier selection cannot refine a branch whose parent is purchased.
r=calc({T4_CLOTH:true,T5_LEATHER:true});assert.deepEqual(amounts(r),{T5_CLOTH:40,T5_HIDE:60,T4_LEATHER:20});
// Enchanted branches retain their exact material IDs and never expand ordinary cloth.
const enchanted=recipe('T5_BAG@1');r=E.calculate(enchanted,{...cfg,unitFee:enchanted.fee300,refineSteps:{'T5_CLOTH_LEVEL1@1':true}},D,quote);assert.deepEqual(amounts(r),{'T5_FIBER_LEVEL1@1':60,'T4_CLOTH_LEVEL1@1':20,'T5_LEATHER_LEVEL1@1':40});
// Refining modes retain the existing complete-chain calculation.
const old=E.calculate(recipe('T5_CLOTH'),{...cfg,unitFee:10.8,quantity:10,focus:false},D,quote);assert.ok(old.bill.some(m=>m.id==='T3_FIBER'));
console.log('PASS: bought bag materials, independent tier steps, exact quantities, nutrition fees, bag-only focus, dormant branches, enchanted materials, refining regression');
