const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const F=require('../dist/fish-sauce-engine.js'),E=require('../dist/engine.js');const w={};
vm.runInNewContext(fs.readFileSync(__dirname+'/../dist/data.js','utf8'),{window:w});vm.runInNewContext(fs.readFileSync(__dirname+'/../dist/fish-sauce-data.js','utf8'),{window:w});
const D=JSON.parse(JSON.stringify(w.ALBION_DATA)),meta=D.fishSauce;const basic=meta.sauces.T1_FISHSAUCE_LEVEL1,fish=meta.fish.find(f=>f.id==='T4_FISH_FRESHWATER_ALL_COMMON');
assert.equal(meta.fish.length,41);assert.equal(fish.chops,4);assert.equal(meta.fish.find(f=>f.id==='T8_FISH_SALTWATER_ALL_BOSS_SHARK').chops,200);assert.deepEqual(Object.values(meta.sauces).map(s=>[s.chops,s.seaweed]),[[15,1],[45,3],[135,9]]);
let p=F.production(basic,3,fish,10);assert.deepEqual([p.sauceCount,p.chops,p.fishNeeded,p.fishBuy,p.seaweedNeeded,p.seaweedBuy,p.fees],[3,45,12,14,3,4,0]);
assert.equal(F.production(basic,3.01,fish).sauceCount,4);assert.equal(F.production(basic,3.0000000000000004,fish).sauceCount,3);
let g=F.priceGuide(p,1000,100,200);assert.equal(g.maxFish,157.14);assert.equal(g.cost,2200/3);assert.equal(g.within,true);
assert.ok(F.priceGuide(p,1000,157.15,200).cost>1000);assert.equal(F.priceGuide(p,100,1,200).maxFish,null);assert.equal(F.priceGuide(p,0,100,200).maxFish,null);assert.equal(F.priceGuide(p,1000,100,0).cost,null);assert.equal(F.priceGuide(p,1000,0,200).cost,null);
const cfg={quantity:20,rrr:50,unitFee:2,station:300,buffer:10,focus:true,eff:0,volumeMode:'quantity',saleMode:'buy',salePrice:100,tax:4,makeSauce:true,sauceFish:fish.id};
const food={id:'FOOD',kind:'food',output:10,basefocus:2,mats:[{id:basic.id,n:3,returns:true}]};
const quote=id=>({price:id==='T1_SEAWEED'?200:100,age:1});let r=E.calculate(food,cfg,D,quote);
assert.equal(r.saucePlans[0].sauceCount,3);assert.deepEqual(r.bill.map(m=>[m.id,m.net,m.buy]),[[fish.id,12,14],['T1_SEAWEED',3,4]]);assert.equal(r.fees,40);assert.equal(r.focus,40);assert.equal(r.cost,2240);assert.equal(r.profit,-320);assert.ok(!r.bill.some(m=>m.id===basic.id));
const bought=E.calculate(food,{...cfg,makeSauce:false},D,quote);assert.deepEqual(bought.bill.map(m=>[m.id,m.net,m.buy]),[[basic.id,3,4]]);assert.equal(bought.cost,440);assert.equal(bought.focus,r.focus);
const missing=E.calculate(food,cfg,D,id=>({price:id===fish.id?0:200,age:1}));assert.equal(missing.missing,true);
// All sauce recipes and raw fish outputs conserve required chops after rounding.
for(const sauce of Object.values(meta.sauces))for(const f of meta.fish){const x=F.production(sauce,7.5,f,2);assert.equal(x.sauceCount,8);assert.ok(x.fishNeeded*f.chops>=x.chops);assert.ok((x.fishNeeded-1)*f.chops<x.chops);}
console.log('PASS: real fish yields, three sauces, whole fish and sauce rounding, buffers, target purchase ceilings, seaweed costs, meal return once, no sauce focus/fees, purchase fallback, missing prices');
