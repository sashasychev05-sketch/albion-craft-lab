'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{once}=require('node:events');
async function run(window,folder){
 const exec=code=>window.webContents.executeJavaScript(code);
 const images=await exec(`(async()=>{const files=ITEM_ICON_ATLAS.files;for(let start=0;start<files.length;start+=8)await Promise.all(files.slice(start,start+8).map(url=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>image.naturalWidth===1024&&image.naturalHeight===1024?resolve():reject(Error('Invalid atlas size '+url));image.onerror=()=>reject(Error('Cannot load local atlas '+url));image.src=url;})));for(const id of ['T4_FIBER','T8_2H_SHAPESHIFTER_AVALON@4','QUESTITEM_TOKEN_DRAGONS','QUESTITEM_TOKEN_SMUGGLER'])if(ItemIcons.source(id).placeholder)throw Error('Missing real item art '+id);return {atlases:files.length,icons:Object.keys(ITEM_ICON_ATLAS.items).length,placeholders:Object.keys(ITEM_ICON_ATLAS.fallbacks).length,localOnly:PRICE_CATALOG.every(r=>ItemIcons.source(r.id).url.startsWith('assets/'))};})()`);
 assert.equal(images.localOnly,true);assert.equal(images.icons,10490);
 const calculation=await exec(`(()=>{Workspace.tabAction(Workspace.snapshot().active,'others');CraftApp.open('T4_POTION_HEAL');CraftApp.saveConfig({volumeMode:'quantity',quantity:20,focus:false,craftPlace:'city',craftCity:'Lymhurst',manualReturn:true,rrr:0,manualSale:true,salePrice:10000,unitFee:0,buffer:0});CraftApp.cancelMarket();for(const row of CraftApp.snapshot().result.bill)CraftApp.editMaterial(row.id,{city:'Lymhurst',price:10});const s=CraftApp.snapshot();Workspace.capture();return {quantity:s.result.amount,missing:s.result.missing,profit:s.result.profit,materialCost:s.result.materialCost,icons:document.querySelectorAll('.item-icon-local').length,internalCity:s.config.craftCity};})()`);
 assert.equal(calculation.quantity,20);assert.ok(!calculation.missing);assert.ok(Number.isFinite(calculation.profit));assert.ok(calculation.materialCost>0);assert.ok(calculation.icons>0);assert.equal(calculation.internalCity,'Lymhurst');
 assert.equal(await exec(`[...document.querySelectorAll('option[value="Lymhurst"]')].filter(n=>!n.closest('script')).every(n=>!n.textContent.includes('Lymhurst'))`),true);
 const loaded=once(window.webContents,'did-finish-load');window.webContents.reload();await loaded;
 const restored=await exec(`(()=>{CraftApp.cancelMarket();const s=CraftApp.snapshot();return {quantity:s.result.amount,missing:s.result.missing,profit:s.result.profit,materialCost:s.result.materialCost};})()`);assert.equal(restored.quantity,20);assert.ok(!restored.missing);assert.equal(restored.profit,calculation.profit);assert.equal(restored.materialCost,calculation.materialCost);
 fs.writeFileSync(path.join(folder,'offline-calculator.png'),(await window.webContents.capturePage()).toPNG());
 return {images,calculation,restored,manualCalculation:true,persistedPrices:true};
}
module.exports={run};
