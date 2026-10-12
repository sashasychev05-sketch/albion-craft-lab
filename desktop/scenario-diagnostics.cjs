'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{once}=require('node:events');
async function run(window,folder){
 const execute=code=>window.webContents.executeJavaScript(code);
 await execute("localStorage.removeItem('albion-scenarios-v1'); localStorage.setItem('albion-character-mastery-v1','{}');");
 const loaded=once(window.webContents,'did-finish-load');window.webContents.reload();await loaded;
 const summary=await execute(`(() => {
  const record=CraftApp.saveVariant();record.recipeId='T8_MEAL_STEW@1';record.server='europe';
  Object.assign(record.config,{craftPlace:'city',craftCity:'Caerleon',sellCity:'Lymhurst',quantity:10,volumeMode:'quantity',focus:true,focusSource:'levels',explicitManualFocus:false,manualSale:true,salePrice:50000,manualReturn:true,rrr:37.25,unitFee:243,station:300,buffer:0,transport:500,characters:0,makeSauce:false,foodIngredientSteps:{},refineSteps:{}});
  record.overrides=Object.fromEntries(Object.entries({T8_PUMPKIN:429,T4_BREAD:357,T8_MEAT:440,T1_FISHSAUCE_LEVEL1:4498}).map(([id,price])=>[id,{city:'Lymhurst',price}]));
  CraftApp.restoreVariant(record);
  const first=CraftApp.snapshot();
  document.getElementById('batch-save').click();document.getElementById('scenario-name').value='10 блюд';document.getElementById('scenario-save-form').requestSubmit();document.getElementById('scenario-close').click();
  document.querySelector('[data-batch-action=double]').click();const doubled=CraftApp.snapshot().result.amount;
  document.getElementById('batch-save').click();document.getElementById('scenario-name').value='20 блюд';document.getElementById('scenario-save-form').requestSubmit();
  document.getElementById('scenario-compare-tab').click();const before=JSON.stringify(CraftApp.snapshot()),rows=ScenarioUI.comparison();
  const unchanged=before===JSON.stringify(CraftApp.snapshot());
  const equivalent=CraftApp.evaluateVariant(CraftApp.saveVariant());
  const incomplete=ScenarioMath.clone(ScenarioUI.records().items[0]);incomplete.overrides.T1_FISHSAUCE_LEVEL1.price=0;
  const missing=CraftApp.evaluateVariant(incomplete);
  MasteryUI.replace({FARM_COOK:100,FARM_COOK_STEW:50});const skilled=ScenarioUI.comparison().map(x=>x.result.perOp);MasteryUI.replace({});
  return {firstAmount:first.result.amount,doubled,rows:rows.map(x=>({valid:x.valid,amount:x.result.amount,unitCost:x.result.unitCost,unitProfit:x.result.unitProfit,perOp:x.result.perOp})),unchanged,equivalent:{cost:equivalent.result.cost,liveCost:CraftApp.snapshot().result.cost},missingValid:missing.valid,skilled,hasComparison:document.querySelector('.scenario-comparison-table')!==null};
 })()`);
 assert.equal(summary.firstAmount,10);assert.equal(summary.doubled,20);assert.equal(summary.rows.length,2);assert.ok(summary.rows.every(x=>x.valid));assert.equal(summary.unchanged,true);
 assert.equal(summary.equivalent.cost,summary.equivalent.liveCost);assert.equal(summary.missingValid,false);assert.deepEqual(summary.skilled,[2315,2315]);assert.equal(summary.hasComparison,true);assert.ok(summary.rows[1].unitCost<summary.rows[0].unitCost);
 const saveFile=path.resolve(folder,'comparison.csv');
 const download=new Promise((resolve,reject)=>window.webContents.session.once('will-download',(_event,item)=>{item.setSavePath(saveFile);item.once('done',(_e,state)=>state==='completed'?resolve():reject(Error('CSV download: '+state)));}));
 await execute("document.getElementById('scenario-csv').click()");await download;
 assert.ok(fs.readFileSync(saveFile,'utf8').includes('10 блюд'));
 const screenshot=await window.webContents.capturePage();fs.writeFileSync(path.resolve(folder,'comparison.png'),screenshot.toPNG());
 const restored=await execute(`(() => {document.getElementById('scenario-saved-tab').click();document.querySelector('[data-scenario-load]').click();const x=CraftApp.snapshot();return {quantity:x.config.quantity,rrr:x.config.rrr,manualReturn:x.config.manualReturn,amount:x.result.amount};})()`);
 assert.deepEqual(restored,{quantity:10,rrr:37.25,manualReturn:true,amount:10});
 const reload=once(window.webContents,'did-finish-load');window.webContents.reload();await reload;
 assert.equal(await execute('ScenarioUI.records().items.length'),2);
 await execute("ScenarioUI.open('compare')");window.setSize(800,960);await new Promise(resolve=>setTimeout(resolve,200));
 const bounds=await execute("(() => {const r=document.getElementById('scenario-dialog').getBoundingClientRect();return {left:r.left,right:r.right,width:innerWidth};})()");
 assert.ok(bounds.left>=0&&bounds.right<=bounds.width);await execute("document.getElementById('scenario-close').click()");window.setSize(1440,960);
 const matrix=await execute(`(() => {
  const cases=[['food',{}],['food',{makeSauce:true}],['food',{foodIngredientSteps:{T4_BREAD:true,T3_FLOUR:true,T8_MEAT:true}}],['potions',{}],['bags',{refineSteps:{T5_CLOTH:true,T4_CLOTH:true,T5_LEATHER:true}}],['gear',{quality:4}],['refine',{chain:true,startTier:3}],['gear',{craftPlace:'hideout',hideoutBaseReturn:null}]];
  return cases.map(([kind,patch])=>{
   const r=kind==='food'?ALBION_DATA.recipes.find(x=>x.id==='T8_MEAL_STEW@1'):ALBION_DATA.recipes.find(x=>x.kind===kind&&x.tier>=4&&!x.ench);
   const record=CraftApp.saveVariant();record.recipeId=r.id;Object.assign(record.config,{craftPlace:'city',quantity:r.output*10,volumeMode:'quantity',focus:true,manualReturn:true,rrr:37.25,unitFee:r.fee300,manualSale:true,salePrice:50000,makeSauce:false,foodIngredientSteps:{},refineSteps:{},...patch});record.overrides={};
   for(let round=0;round<3;round++){CraftApp.restoreVariant(record);for(const material of CraftApp.snapshot().result.bill)record.overrides[material.id+(material.preserveQuality&&Number(record.config.quality)>1?'|q'+record.config.quality:'')]={city:'Lymhurst',price:100};}
   CraftApp.restoreVariant(record);const live=CraftApp.snapshot(),before=JSON.stringify(live),evaluated=CraftApp.evaluateVariant(CraftApp.saveVariant());
   const equivalent=['amount','ops','cost','profit','unitCost','unitProfit','focus','perOp','fees','materialCost'].every(key=>live.result[key]===evaluated.result[key]);
   const isolated=before===JSON.stringify(CraftApp.snapshot());
   ScenarioUI.changeVolume('one');const one=CraftApp.snapshot().result.amount===r.output;
   return {kind,recipe:r.id,equivalent,isolated,one,valid:evaluated.valid,placeReady:live.placeReady};
  });
 })()`);
 assert.ok(matrix.every(x=>x.equivalent&&x.isolated&&x.one),JSON.stringify(matrix));assert.equal(matrix.at(-1).valid,false);
 return {...summary,restored,csv:true,reload:true,narrowDialog:true,matrix};
}
module.exports={run};
