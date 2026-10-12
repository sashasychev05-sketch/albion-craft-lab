'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{once}=require('node:events');
async function run(window,folder){
 const execute=code=>window.webContents.executeJavaScript(code);
 const result=await execute(`(() => {
  CraftApp.restoreVariant(ScenarioUI.records().items[0]);document.getElementById('volume-mode').value='focus';document.getElementById('volume-mode').dispatchEvent(new Event('change',{bubbles:true}));
  document.querySelector('button.nav[data-mode=character]').click();
  const set=(id,value)=>{const n=document.querySelector('[data-character-level='+id+']');n.value=value;n.dispatchEvent(new Event('input',{bubbles:true}));};
  document.getElementById('profile-name').value='Фокусный повар';document.getElementById('profile-rename').click();
  set('FARM_COOK',100);set('FARM_COOK_STEW',50);const primary=CharacterProfiles.snapshot().active,trained=CraftApp.snapshot().result;
  document.getElementById('profile-name').value='Новый альт';document.getElementById('profile-add').click();const alt=CharacterProfiles.snapshot().active,untrained=CraftApp.snapshot().result;
  const blankLevels=Object.keys(MasteryUI.levels()).length===0;set('FARM_COOK',10);
  document.getElementById('active-character').value=primary;document.getElementById('active-character').dispatchEvent(new Event('change',{bubbles:true}));
  const independent=MasteryUI.levels().FARM_COOK_STEW===50&&CharacterProfiles.snapshot().profiles.find(p=>p.id===alt).levels.FARM_COOK===10;
  const comparison=ScenarioUI.comparison().map(r=>r.result.perOp);
  return {primary,alt,trained:{perOp:trained.perOp,amount:trained.amount},untrained:{perOp:untrained.perOp,amount:untrained.amount},blankLevels,independent,comparison};
 })()`);
 assert.deepEqual(result.trained,{perOp:232,amount:1290});assert.deepEqual(result.untrained,{perOp:752,amount:390});assert.equal(result.blankLevels,true);assert.equal(result.independent,true);assert.deepEqual(result.comparison,[232,232]);
 const loaded=once(window.webContents,'did-finish-load');window.webContents.reload();await loaded;
 const reopened=await execute('({active:CharacterProfiles.snapshot().active,count:CharacterProfiles.snapshot().profiles.length,stew:MasteryUI.levels().FARM_COOK_STEW})');
 assert.equal(reopened.active,result.primary);assert.equal(reopened.count,2);assert.equal(reopened.stew,50);
 const copy=await execute(`(() => {
  document.querySelector('button.nav[data-mode=character]').click();document.getElementById('profile-name').value='Копия';document.getElementById('profile-copy').checked=true;document.getElementById('profile-add').click();
  const copied=MasteryUI.levels().FARM_COOK_STEW===50;
  MasteryUI.setLevel('FARM_COOK_STEW',1);const confirm=window.confirm;window.confirm=()=>true;document.getElementById('profile-delete').click();window.confirm=confirm;
  return {copied,count:CharacterProfiles.snapshot().profiles.length,stew:MasteryUI.levels().FARM_COOK_STEW};
 })()`);
 assert.deepEqual(copy,{copied:true,count:2,stew:50});
 await new Promise(resolve=>setTimeout(resolve,200));const screenshot=await window.webContents.capturePage();fs.writeFileSync(path.resolve(folder,'characters.png'),screenshot.toPNG());
 return {...result,reload:true,copyAndDelete:true};
}
module.exports={run};
