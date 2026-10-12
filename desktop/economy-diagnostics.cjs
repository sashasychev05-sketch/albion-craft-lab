'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{once}=require('node:events');
async function run(window,folder){
 const execute=code=>window.webContents.executeJavaScript(code);
 const screenshot=async file=>{await execute("window.scrollTo({top:0,behavior:'instant'});new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))");await new Promise(r=>setTimeout(r,250));fs.writeFileSync(path.resolve(folder,file),(await window.webContents.capturePage()).toPNG());};
 const result=await execute(`(() => {
  const configure=(mode,values)=>{CraftApp.navigate(mode);const v=EconomyUI.views[mode];v.market.cancel();v.setConfig(values);return v;};
  const prices=(rows)=>Object.fromEntries(rows.map(([city,side,id,q,price])=>[[city,side,id,q].join('|'),price]));
  let v=configure('enchant',{item:'T4_MAIN_SWORD',target:'T4_MAIN_SWORD@3',quantity:2,quality:3,sellCity:'Black Market',saleMode:'instant',prices:prices([['Lymhurst','buy','T4_MAIN_SWORD',3,100],['Lymhurst','buy','T4_RUNE',1,1],['Lymhurst','buy','T4_SOUL',1,1],['Lymhurst','buy','T4_RELIC',1,1],['Black Market','sell','T4_MAIN_SWORD@3',3,2000]])});
  const enchant=v.result();document.getElementById('enchant-save').click();
  v=configure('salvage',{item:'T4_MAIN_SWORD@1',quantity:10,condition:100,prices:prices([['Lymhurst','buy','T4_MAIN_SWORD@1',1,100],['Lymhurst','sell','T4_METALBAR_LEVEL1@1',1,500],['Lymhurst','sell','T4_LEATHER_LEVEL1@1',1,500]])});const salvage=v.result();
  v=configure('journals',{item:'T4_JOURNAL_WARRIOR',byFame:true,fame:10000,prices:prices([['Lymhurst','buy','T4_JOURNAL_WARRIOR_EMPTY',1,100],['Lymhurst','sell','T4_JOURNAL_WARRIOR_FULL',1,500]])});const journals=v.result();
  v=configure('mounts',{item:'T3_MOUNT_HORSE',quantity:10,mountMode:'full',premium:true,feed:'T1_CARROT',feedQty:10,nurtures:1,repeat:true,sellBabies:true,prices:prices([['Lymhurst','buy','T3_FARM_HORSE_BABY',1,100],['Lymhurst','buy','T1_CARROT',1,10],['Lymhurst','buy','T3_LEATHER',1,100],['Lymhurst','sell','T3_MOUNT_HORSE',1,5000],['Lymhurst','sell','T3_FARM_HORSE_BABY',1,100]])});const mounts=v.result();
  CraftApp.navigate('gear');const category=document.getElementById('craft-category');category.value='bag';category.dispatchEvent(new Event('change'));const unified={kind:CraftApp.snapshot().recipe.kind,active:document.querySelector('button.nav.active').dataset.mode,materials:!document.getElementById('bag-materials-panel').hidden};
  document.getElementById('account-prices').click();document.getElementById('book-search').value='T8_MEAL_STEW';document.getElementById('book-search').dispatchEvent(new Event('input'));const searchable=[...document.getElementById('book-family').options].some(o=>o.value==='MEAL_STEW');document.getElementById('book-search').value='';document.getElementById('book-search').dispatchEvent(new Event('input'));PriceBookUI.select('T4_MAIN_SWORD');document.getElementById('book-city').value='Black Market';document.getElementById('book-city').dispatchEvent(new Event('change'));document.getElementById('book-quality').value='3';document.getElementById('book-quality').dispatchEvent(new Event('change'));
  const input=document.querySelector('[data-book-item="T4_MAIN_SWORD"][data-book-action="bid"]');input.value='1200';input.dispatchEvent(new Event('change',{bubbles:true}));const entry=PriceBook.get('europe','T4_MAIN_SWORD','Black Market',3,'bid');
  const variants=document.querySelectorAll('[data-book-action="bid"]').length;
  CraftApp.open('T4_MAIN_SWORD',{craftPlace:'city',quantity:1,focus:false,sellCity:'Black Market',quality:3,saleMode:'buy',manualSale:false});const centralSale=CraftApp.snapshot().config.salePrice;
  const accountRight=document.querySelector('.account-controls').getBoundingClientRect().right<=innerWidth;
  return {enchant:{ready:enchant.ready,profit:enchant.profit,stages:enchant.steps.length,quality:enchant.outputs[0].quality},salvage:{ready:salvage.ready,amounts:salvage.outputs.map(x=>x.n)},journals:{ready:journals.ready,filled:journals.filled,remainder:journals.remainder},mounts:{ready:mounts.ready,hours:mounts.hours,focus:mounts.focus,stock:mounts.investment,keep:mounts.keep},unified,entry,centralSale,variants,searchable,accountRight,saved:EconomyUI.records().length};
 })()`);
 assert.equal(result.enchant.ready,true);assert.equal(result.enchant.stages,3);assert.equal(result.enchant.quality,3);assert.equal(result.enchant.profit,1912);
 assert.deepEqual(result.salvage,{ready:true,amounts:[30,10]});assert.deepEqual(result.journals,{ready:true,filled:2,remainder:2800});
 assert.equal(result.mounts.ready,true);assert.equal(result.mounts.hours,22);assert.equal(result.mounts.focus,10000);assert.equal(result.mounts.stock,1000);assert.equal(result.mounts.keep,10);
 assert.deepEqual(result.unified,{kind:'bags',active:'gear',materials:true});assert.equal(result.centralSale,1200);assert.equal(result.entry.source,'manual');assert.ok(result.variants>=25);assert.equal(result.searchable,true);assert.equal(result.accountRight,true);assert.equal(result.saved,1);
 const loaded=once(window.webContents,'did-finish-load');window.webContents.reload();await loaded;
 const persisted=await execute(`({price:PriceBook.get('europe','T4_MAIN_SWORD','Black Market',3,'bid').price,count:EconomyUI.records().length})`);assert.deepEqual(persisted,{price:1200,count:1});
 await execute(`document.getElementById('account-prices').click();PriceBookUI.select('T4_MAIN_SWORD');document.getElementById('book-city').value='Black Market';document.getElementById('book-city').dispatchEvent(new Event('change'));`);
 await screenshot('my-prices.png');
 await execute(`CraftApp.navigate('mounts');document.querySelector('.account-menu').open=true;`);await screenshot('mounts.png');
 await execute(`document.querySelector('.account-menu').open=false;CraftApp.open('T8_MEAL_STEW@1',{focus:true,volumeMode:'focus',focusBudget:30000});const levels=Object.fromEntries(Object.keys(MASTERY_DATA.nodes).filter(id=>id.startsWith('FARM_COOK')).map(id=>[id,100]));MasteryUI.replace(levels);`);
 const focus=await execute('({perOp:CraftApp.snapshot().result.perOp,amount:CraftApp.snapshot().result.amount})');assert.deepEqual(focus,{perOp:167,amount:1790});await screenshot('focus.png');
 return {...result,persistence:true,fullCooking:focus};
}
module.exports={run};
