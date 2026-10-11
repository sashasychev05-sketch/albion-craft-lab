const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const w={};for(const file of ['data.js','food-focus-data.js','gear-data.js','fish-sauce-data.js','food-ingredients-data.js'])vm.runInNewContext(fs.readFileSync(__dirname+'/../dist/'+file,'utf8'),{window:w});
const D=JSON.parse(JSON.stringify(w.ALBION_DATA)),E=require('../dist/engine.js');global.CraftEngine=E;global.GEAR_META=w.GEAR_META;const I=require('../dist/food-ingredients-engine.js');require('../dist/fish-sauce-engine.js');
const recipe=id=>D.recipes.find(r=>r.id===id),q=()=>({price:10,age:1,city:'Lymhurst'});
const cfg={craftCity:'Caerleon',craftPlace:'city',quantity:20,volumeMode:'quantity',rrr:50,station:300,unitFee:194.4,focus:true,eff:0,salePrice:10000,saleMode:'buy',tax:4,buffer:0,foodIngredientSteps:{},foodIngredientSettings:Object.fromEntries(Object.keys(D.foodIngredients).map(id=>[id,{rrr:0,station:300}]))};
const calc=(id,steps,extra={})=>E.calculate(recipe(id),{...cfg,unitFee:recipe(id).fee300,foodIngredientSteps:steps,...extra},D,q);
const amounts=r=>Object.fromEntries(r.bill.map(m=>[m.id,m.net]));
let r=calc('T8_MEAL_STEW',{});assert.deepEqual(amounts(r),{T8_PUMPKIN:36,T4_BREAD:36,T8_MEAT:72});const baseFocus=r.focus;
r=calc('T8_MEAL_STEW',{T4_BREAD:true});assert.deepEqual(amounts(r),{T8_PUMPKIN:36,T3_FLOUR:36,T8_MEAT:72});assert.equal(r.focus,baseFocus);assert.equal(r.fees,20*194.4+36*13.5);
r=calc('T8_MEAL_STEW',{T4_BREAD:true,T3_FLOUR:true});assert.deepEqual(amounts(r),{T8_PUMPKIN:36,T3_WHEAT:36,T8_MEAT:72});assert.equal(r.fees,20*194.4+72*13.5);
r=calc('T8_MEAL_STEW',{T3_FLOUR:true});assert.ok(r.bill.some(m=>m.id==='T4_BREAD'));assert.ok(!r.bill.some(m=>m.id==='T3_WHEAT'));
r=calc('T8_MEAL_SANDWICH',{T8_BUTTER:true});assert.deepEqual(amounts(r),{T4_BREAD:36,T8_MEAT:72,T8_MILK:18});assert.equal(r.focus,2*494);
r=calc('T8_MEAL_STEW',{T8_MEAT:true});assert.deepEqual(amounts(r),{T8_PUMPKIN:36,T4_BREAD:36,T8_FARM_COW_GROWN:4});assert.equal(r.fees,20*194.4+72*13.5);
const settings={...cfg.foodIngredientSettings,T4_BREAD:{rrr:50,station:600},T3_FLOUR:{rrr:50,station:300},T8_MEAT:{rrr:25,station:300}};
r=calc('T8_MEAL_STEW',{T4_BREAD:true,T3_FLOUR:true,T8_MEAT:true},{foodIngredientSettings:settings,buffer:10});assert.deepEqual(amounts(r),{T8_PUMPKIN:36,T3_WHEAT:9,T8_FARM_COW_GROWN:4});assert.equal(r.bill.find(m=>m.id==='T3_WHEAT').buy,10);assert.equal(r.bill.find(m=>m.id==='T8_FARM_COW_GROWN').buy,5);assert.equal(r.focus,baseFocus);assert.equal(r.fees,20*194.4+36*27+18*13.5+72*13.5);assert.equal(r.profit,r.gross-r.tax-r.cost);
// Whole operations cover fractional demand. Meat bonuses return meat, never animals.
let p=I.production(D.foodIngredients.T8_MEAT,91,{...cfg,foodIngredientSettings:settings});assert.equal(p.ops,5);assert.equal(p.amount,112.5);assert.equal(p.mats[0].n,5);
p=I.production(D.foodIngredients.T4_BREAD,3.0000000000000004,cfg);assert.equal(p.ops,3);
assert.ok(Math.abs(I.settings(D.foodIngredients.T4_BREAD,{craftCity:'Caerleon',craftPlace:'city'}).rrr-100*(1-1/1.33))<1e-9);
assert.ok(Math.abs(I.settings(D.foodIngredients.T7_MEAT,{craftCity:'Thetford',craftPlace:'city'}).rrr-21.875)<1e-9);
// Chopping uses the chosen fish yield and never adds fee, returns or focus.
const chops=I.recipe('T1_FISHCHOPS',{foodChopFish:'T8_FISH_SALTWATER_ALL_BOSS_SHARK'},D);p=I.production(chops,401,cfg);assert.equal(p.ops,3);assert.equal(p.fees,0);assert.equal(p.mats[0].n,3);
// All available ingredients preserve input units and cover demand; empty selection stays compatible.
for(const ingredient of Object.values(D.foodIngredients)){p=I.production(ingredient,31.7,cfg);assert.ok(p.amount>=31.7);assert.ok(p.mats.every(m=>m.n>=0));}
r=calc('T8_MEAL_STEW@1',{T4_BREAD:true,T3_FLOUR:true},{makeSauce:true,sauceFish:'T4_FISH_FRESHWATER_ALL_COMMON'});assert.equal(r.saucePlans.length,1);assert.ok(r.bill.some(m=>m.id==='T3_WHEAT'));assert.ok(r.bill.some(m=>m.id==='T4_FISH_FRESHWATER_ALL_COMMON'));assert.ok(!r.bill.some(m=>m.id==='T1_FISHSAUCE_LEVEL1'));assert.equal(r.focus,recipe('T8_MEAL_STEW@1').basefocus*20);
console.log('PASS: bought ingredients, bread/flour steps, butter, whole animals, separate returns/fees, meal-only focus, fish choice, sauce coexistence, rounding and buffer');
