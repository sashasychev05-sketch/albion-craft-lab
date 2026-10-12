'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),S=require('../dist/scenarios.js');
const storage=()=>{const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),map}};
const record=()=>({recipeId:'T8_MEAL_STEW@1',server:'europe',config:{quantity:10,focusBudget:30000,volumeMode:'quantity',rrr:37.25,manualReturn:true,foodIngredientSteps:{T4_BREAD:true}},overrides:{T8_PUMPKIN:{city:'Lymhurst',price:429}}});
test('saved variants preserve nested inputs without following later edits',()=>{
 const store=storage(),source=record();let data=S.add(store,S.read(store),'Жаркое на день',source);source.config.rrr=10;source.config.foodIngredientSteps.T4_BREAD=false;source.overrides.T8_PUMPKIN.price=1;
 assert.equal(data.items[0].config.rrr,37.25);assert.equal(data.items[0].config.foodIngredientSteps.T4_BREAD,true);assert.equal(data.items[0].overrides.T8_PUMPKIN.price,429);
 assert.deepEqual(S.read(store),data);data=S.remove(store,data,data.items[0].id);assert.equal(data.items.length,0);assert.equal(data.selected.length,0);
});
test('storage failure and invalid records do not erase the previous library',()=>{
 const store=storage(),data=S.add(store,S.read(store),'Первый',record()),before=store.getItem(S.KEY);
 store.setItem=()=>{throw Error('QuotaExceeded')};assert.throws(()=>S.add(store,data,'Второй',record()),/QuotaExceeded/);assert.equal(store.getItem(S.KEY),before);assert.equal(data.items.length,1);
 assert.throws(()=>S.validate(JSON.parse('{"recipeId":"x","server":"europe","config":{"__proto__":{}},"overrides":{}}')),/Повреждённые/);
 assert.throws(()=>S.validate({...record(),server:'wrong-host'}),/повреждён/);assert.throws(()=>S.validate({...record(),config:{quantity:Infinity}}),/Некоррект/);
});
test('comparison selects up to four variants and never mixes default server selections',()=>{
 const store=storage();let data=S.read(store);for(let i=0;i<5;i++)data=S.add(store,data,'Вариант '+i,record());assert.equal(data.selected.length,4);assert.throws(()=>S.select(store,data,data.items.map(x=>x.id)),/четырёх/);
 data=S.add(store,data,'Американский',{...record(),server:'west'});assert.deepEqual(data.selected,[data.items.at(-1).id]);
});
test('volume tools use whole operations and the actual focus/quantity mode',()=>{
 const recipe={kind:'food',output:10};assert.deepEqual(S.volume(recipe,{quantity:15,focus:false,volumeMode:'focus'},'half'),{quantity:10});assert.deepEqual(S.volume(recipe,{quantity:10,focus:true,volumeMode:'quantity'},'double'),{quantity:20});
 assert.deepEqual(S.volume(recipe,{quantity:15,focus:false},'double'),{quantity:20});
 assert.deepEqual(S.volume(recipe,{focus:true,volumeMode:'focus',focusBudget:30000},'half'),{focusBudget:15000});assert.deepEqual(S.volume(recipe,{focus:true,volumeMode:'focus'},'one'),{volumeMode:'quantity',quantity:10});
 assert.deepEqual(S.volume({kind:'refine',output:1},{quantity:20,focus:true,volumeMode:'focus'},'half'),{quantity:10});
 assert.deepEqual(S.volume(recipe,{quantity:100000000},'double'),{quantity:100000000});assert.deepEqual(S.volume(recipe,{focus:true,volumeMode:'focus',focusBudget:3000000},'double'),{focusBudget:3000000});
});
test('best unit profit can differ from best total profit; incomplete prices cannot win',()=>{
 const rows=[{id:'small',valid:true,costReady:true,result:{profit:100,unitProfit:10,unitCost:15}},{id:'large',valid:true,costReady:true,result:{profit:200,unitProfit:2,unitCost:13}},{id:'incomplete',valid:false,costReady:false,result:{profit:9999,unitProfit:9999,unitCost:0}}];
 assert.equal(S.best(rows,'unitProfit'),'small');assert.equal(S.best(rows,'profit'),'large');assert.equal(S.best(rows,'unitCost'),'large');
 assert.equal(S.best([{id:'cost-only',valid:false,costReady:true,result:{unitCost:10}}],'unitCost'),'cost-only');assert.equal(S.best(rows.filter(x=>!x.valid),'profit'),null);
});
test('CSV preserves numeric losses and neutralizes formulas in variant names',()=>{
 const text=S.csv([['Название','Прибыль'],['=1+1',-5],['Мой "вариант"; тест',3]]);assert.ok(text.startsWith('\ufeff'));assert.ok(text.includes('"\'=1+1";"-5"'));assert.ok(text.includes('"Мой ""вариант""; тест"'));
});
