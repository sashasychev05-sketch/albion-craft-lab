const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),w={};
for(const file of ['data.js','food-focus-data.js','gear-data.js','extras-data.js','mastery-data.js','mastery-engine.js','mastery-profile.js','city-allocation-model.js','engine.js'])vm.runInNewContext(fs.readFileSync(__dirname+'/../dist/'+file,'utf8'),{window:w});
const D=w.ALBION_DATA,MD=w.MASTERY_DATA,M=w.MasteryMath,P=w.MasteryProfile,E=w.CraftEngine,recipe=id=>D.recipes.find(r=>r.id===id);
const catalog=P.catalog(MD,D.recipes,w.GEAR_META,M),ids=catalog.flatMap(g=>g.nodes.map(n=>n.id));
assert.equal(ids.length,Object.keys(MD.nodes).length);assert.equal(new Set(ids).size,ids.length);assert.ok(catalog.every(g=>P.categories.some(c=>c[0]===g.category)));
for(const [category]of P.categories){const names=catalog.filter(g=>g.category===category).map(g=>g.name);assert.equal(names.length,new Set(names).size,'Each mastery branch must have a distinct name in '+category)}
assert.equal(catalog.find(g=>g.id==='FARM_COOK').category,'food');assert.equal(catalog.find(g=>g.id==='FARM_ALCHEMIST').category,'potions');assert.equal(catalog.find(g=>g.id==='CRAFT_PLATE_ARMORS').category,'armor');assert.equal(catalog.find(g=>g.id==='CRAFT_SWORDS').category,'weapons');assert.equal(catalog.find(g=>g.id==='CRAFT_REFINE_FIBER').nodes.length,5);
const levels=P.normalize({FARM_COOK:105,FARM_COOK_STEW:50.9,FARM_COOK_PIE:-4,FARM_ALCHEMIST:'bad',evil:100},MD);assert.equal(levels.FARM_COOK,100);assert.equal(levels.FARM_COOK_STEW,50);assert.ok(!levels.evil);assert.ok(!levels.FARM_COOK_PIE);assert.equal(Object.keys(P.normalize([],MD)).length,0);
const stew=recipe('T8_MEAL_STEW@1'),legacy={eff:55000,focusSource:'manual'};
P.prepare(stew,legacy,{},MD,M);assert.equal(legacy.eff,0);assert.equal(legacy.focusSource,'levels');
P.prepare(stew,legacy,levels,MD,M);assert.equal(legacy.eff,17000);assert.equal(M.cost(stew,legacy.eff),2315);
const manual={eff:40000,focusSource:'manual',explicitManualFocus:true};P.prepare(stew,manual,levels,MD,M);assert.equal(manual.eff,40000);assert.equal(manual.focusSource,'manual');
assert.equal(M.efficiency(recipe('T2_POTION_HEAL'),levels,MD),0);assert.equal(M.efficiency(recipe('T8_MEAL_SANDWICH'),levels,MD),4500);
// A complete T8.1 operation produces ten dishes, uses 90 sauces before
// returns, and spends 7520 focus without skills. Keep all four units distinct.
const cfg={quantity:10,focus:true,volumeMode:'quantity',focusSource:'levels',masteryLevels:{},rrr:0,buffer:0,unitFee:243,station:300,salePrice:33963,saleMode:'sell',tax:4,setup:2.5};
const prices={T8_PUMPKIN:429,T4_BREAD:357,T8_MEAT:440,T1_FISHSAUCE_LEVEL1:4498};
let result=E.calculate(stew,cfg,D,id=>({price:prices[id],age:0}));
assert.equal(result.amount,10);assert.equal(result.ops,1);assert.equal(result.perOp,7520);assert.equal(result.focus,7520);assert.equal(result.bill.find(m=>m.id==='T1_FISHSAUCE_LEVEL1').buy,90);
assert.equal(result.materialCost,36*429+36*357+72*440+90*4498);assert.equal(result.fees,2430);assert.equal(result.unitCost,result.cost/10);assert.equal(result.unitProfit,result.profit/10);
const focused={...cfg,rrr:47.9166666667,focusBudget:30000,volumeMode:'focus'};
result=E.calculate(stew,focused,D,id=>({price:prices[id],age:0}));assert.equal(result.amount,30);assert.equal(result.focus,22560);
const skilled=E.calculate(stew,{...focused,masteryLevels:levels},D,id=>({price:prices[id],age:0}));assert.equal(skilled.amount,120);assert.equal(skilled.perOp,2315);assert.ok(skilled.focus<=30000);
const sameQuantity=E.calculate(stew,{...cfg,masteryLevels:levels},D,id=>({price:prices[id],age:0}));assert.equal(sameQuantity.cost,E.calculate(stew,cfg,D,id=>({price:prices[id],age:0})).cost);assert.equal(sameQuantity.focus,2315);
console.log('Character catalog, saved levels, legacy focus migration and T8.1 batch/unit calculations passed.');
