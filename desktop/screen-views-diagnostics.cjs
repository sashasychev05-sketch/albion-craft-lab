'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{once}=require('node:events');
async function run(window,folder){
 const execute=code=>window.webContents.executeJavaScript(code),pause=ms=>new Promise(r=>setTimeout(r,ms)),settle=()=>pause(220);
 const shot=async name=>{await execute(`window.scrollTo({top:0,behavior:'instant'});new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);await settle();fs.writeFileSync(path.join(folder,name),(await window.webContents.capturePage()).toPNG());};
 const resize=async(width,zoom)=>{window.setSize(width,960);await settle();window.webContents.setZoomFactor(zoom);for(let n=0;n<50;n++){await pause(100);const actual=await execute(`innerWidth`),expected=window.getContentSize()[0]/zoom;if(Math.abs(actual-expected)<2){await settle();return;}}throw Error('Test viewport did not settle: '+JSON.stringify({width,zoom,bounds:window.getBounds(),actualZoom:window.webContents.getZoomFactor(),renderer:await execute(`({width:innerWidth,ratio:devicePixelRatio})`)}));};
 console.log('Checking ready screen views, custom restore and isolated section state');
 await execute(`(()=>{for(const tab of Workspace.snapshot().tabs)if(tab.pinned)Workspace.tabAction(tab.id,'pin');Workspace.tabAction(Workspace.snapshot().active,'others');Workspace.setHidden(true);window.__viewsFetch=window.fetch;window.__viewsRequests=0;window.fetch=async()=>{window.__viewsRequests++;return {ok:true,json:async()=>[]};};window.__viewsSetup=id=>{CraftApp.open(id);CraftApp.saveConfig({quantity:100,volumeMode:'quantity',focus:false,craftPlace:'city',manualReturn:true,rrr:50,manualSale:true,salePrice:10000,characters:0,station:0,buffer:10,chain:false,refineSteps:{},foodIngredientSteps:{},withJournals:false});CraftApp.cancelMarket();CraftApp.editMaterials(CraftApp.snapshot().result.bill.map(m=>({id:m.id,patch:{price:100,city:'Lymhurst'}})));};__viewsSetup('T5_BAG');document.getElementById('view-reset').click();})()`);await settle();
 try{
  await execute(`(()=>{const s=ScreenLayout.snapshot(),blocks=s.blocks,value=ScreenLayoutModel.move(s.value,blocks,blocks.find(b=>b.id.includes('sale')).id,-1);ScreenLayout.set(value);BlockFolds.setCollapsed(document.getElementById('quantity').closest('.step-card'),true);document.getElementById('craft-result-details').open=true;})()`);await settle();
  const custom=await execute(`ScreenViews.snapshot().current`);
  await execute(`__viewsSetup('T8_MEAL_STEW@1');`);await settle();await execute(`__viewsSetup('T5_BAG');`);await settle();assert.deepEqual(await execute(`ScreenViews.snapshot().current`),custom);
  const before=await execute(`({variant:CraftApp.saveVariant(),cost:CraftApp.snapshot().result.cost,requests:__viewsRequests})`);assert.ok(before.cost>0);
  const views=[];
  for(const view of ['calculation','procurement','review']){
   assert.equal(await execute('ScreenViews.select('+JSON.stringify(view)+')'),true);await settle();
   const row=await execute(`({view:ScreenViews.snapshot(),variant:CraftApp.saveVariant(),cost:CraftApp.snapshot().result.cost,requests:__viewsRequests,rows:BlockSummaries.snapshot(),advanced:document.getElementById('craft-advanced-settings').checkVisibility(),advancedOpen:document.getElementById('craft-advanced-settings').open,result:document.getElementById('craft-jump-result').checkVisibility(),details:document.getElementById('craft-result-details').open,purchase:document.getElementById('craft-jump-purchase').checkVisibility(),pressed:document.querySelector('#craft-content [data-screen-view][aria-pressed=true]').dataset.screenView})`);
   assert.equal(row.view.selected,view);assert.equal(row.pressed,view);assert.deepEqual(row.variant,before.variant);assert.equal(row.cost,before.cost);assert.equal(row.requests,before.requests);assert.equal(row.result,true);assert.equal(row.purchase,true);
   assert.equal(row.advanced,view==='review');assert.equal(row.advancedOpen,view==='review');assert.equal(row.details,view==='review');assert.ok(row.rows.every(r=>r.collapsed===(view==='procurement')));
   views.push(row);await shot('screen-view-'+view+'.png');
  }
  assert.equal(await execute(`ScreenViews.select('custom')`),true);await settle();assert.deepEqual(await execute(`ScreenViews.snapshot().current`),custom);
  const reorder=await execute(`(()=>{ScreenViews.select('review');const s=ScreenLayout.snapshot(),sale=s.blocks.find(b=>b.id.includes('sale'));ScreenLayout.set(ScreenLayoutModel.move(s.value,s.blocks,sale.id,-1));return {selected:document.querySelector('#craft-content [data-screen-view][aria-pressed=true]').dataset.screenView,state:ScreenViews.snapshot().current};})()`);assert.equal(reorder.selected,'custom');
  await execute(`ScreenViews.select('calculation');ScreenViews.select('custom');`);await settle();assert.deepEqual(await execute(`ScreenViews.snapshot().current`),reorder.state);
  // Manual changes become the next custom view instead of discarding the user's work.
  await execute(`ScreenViews.select('procurement');QuickNavigation.go('production');`);await settle();
  const edited=await execute(`ScreenViews.snapshot()`);assert.equal(edited.selected,'custom');assert.equal(edited.current.folds['craft-volume'],false);
  await execute(`ScreenViews.select('review');ScreenViews.select('custom');`);await settle();assert.deepEqual(await execute(`ScreenViews.snapshot().current`),edited.current);
  // Selecting a preset through a focused button supports keyboard activation and keeps focus.
  await execute(`document.querySelector('#craft-content [data-screen-view=calculation]').focus();`);
  window.webContents.sendInputEvent({type:'keyDown',keyCode:'Space'});window.webContents.sendInputEvent({type:'keyUp',keyCode:'Space'});await settle();
  assert.equal(await execute(`ScreenViews.snapshot().selected`),'calculation');assert.equal(await execute(`document.activeElement.dataset.screenView`),'calculation');
  await execute(`CraftApp.saveConfig({salePrice:0,craftPlace:'hideout',manualReturn:false,hideoutBaseReturn:null});CraftApp.cancelMarket();ScreenViews.select('procurement');`);await settle();
  const incomplete=await execute(`({rows:BlockSummaries.snapshot(),missing:document.getElementById('craft-readiness').textContent,quantity:document.getElementById('quantity').checkVisibility(),sale:document.getElementById('sale-price').checkVisibility(),returnField:document.getElementById('hideout-return').checkVisibility()})`);
  assert.equal(incomplete.rows.find(r=>r.key==='craft-item').collapsed,true);assert.equal(incomplete.rows.find(r=>r.key==='craft-volume').collapsed,false);assert.equal(incomplete.rows.find(r=>r.key==='craft-sale').collapsed,false);assert.equal(incomplete.sale,true);assert.equal(incomplete.returnField,true);
  // Restoring a price while in a view must never collapse the edited form automatically.
  await execute(`CraftApp.saveConfig({salePrice:12000});CraftApp.cancelMarket();BlockSummaries.sync();`);await settle();assert.equal(await execute(`BlockSummaries.snapshot().find(r=>r.key==='craft-sale').collapsed`),false);
  const variants=[];
  for(const id of ['T8_MEAL_STEW@1','T4_POTION_HEAL@1','T4_ARMOR_CLOTH_SET1','T6_CLOTH']){
   await execute('__viewsSetup('+JSON.stringify(id)+');');await settle();const variant=await execute(`CraftApp.saveVariant()`);await execute(`ScreenViews.select('procurement')`);await settle();
   const row=await execute(`({mode:ScreenViews.snapshot().mode,selected:ScreenViews.snapshot().selected,variant:CraftApp.saveVariant(),rows:BlockSummaries.snapshot()})`);assert.deepEqual(row.variant,variant);assert.equal(row.selected,'procurement');assert.ok(row.rows.every(r=>r.ready&&r.collapsed));variants.push(row);
  }
  await execute(`__viewsSetup('T5_BAG');ScreenViews.select('review');`);await settle();const gear=await execute(`ScreenViews.snapshot()`);
  await execute(`__viewsSetup('T8_MEAL_STEW@1');`);await settle();assert.equal(await execute(`ScreenViews.snapshot().selected`),'procurement');
  await execute(`__viewsSetup('T5_BAG');`);await settle();assert.deepEqual(await execute(`ScreenViews.snapshot()`),gear);
  await execute(`document.querySelector('button.nav[data-mode=luxury]').click();for(const [id,value]of [['art-capacity',1000],['art-buy-price',100],['art-sell-price',150]]){const n=document.getElementById(id);n.value=value;n.dispatchEvent(new Event('input',{bubbles:true}));}`);await settle();
  // Activation schedules the existing market refresh after 350 ms.
  await pause(650);
  const luxuryBefore=await execute(`LuxuryUI.captureDraft()`),luxury=[];
  for(const view of ['calculation','procurement','review']){
   await execute('ScreenViews.select('+JSON.stringify(view)+')');await settle();
   const row=await execute(`({state:ScreenViews.snapshot(),draft:LuxuryUI.captureDraft(),rows:BlockSummaries.snapshot(),prices:document.getElementById('art-city-prices').checkVisibility(),routes:document.getElementById('art-routes').checkVisibility(),result:document.getElementById('lux-jump-result').checkVisibility()})`);assert.equal(row.state.selected,view);assert.deepEqual(row.draft,luxuryBefore);assert.equal(row.prices,view!=='calculation');assert.equal(row.routes,view!=='calculation');assert.equal(row.result,true);assert.ok(row.rows.every(r=>r.collapsed===(view==='procurement')));luxury.push(row);
  }
  await shot('screen-view-luxury.png');
  // Changing a normal section must not display irrelevant procurement controls.
  const inventory=[];
  for(const mode of await execute(`[...document.querySelectorAll('button.nav[data-mode]')].map(n=>n.dataset.mode)`)){
   const row=await execute('(()=>{document.querySelector("button.nav[data-mode='+mode+']").click();CraftApp.cancelMarket();return {mode:Workspace.activeMode(),visible:[...document.querySelectorAll(".screen-views")].filter(n=>n.checkVisibility()).length};})()');assert.equal(row.visible,['food','potions','gear','refine','luxury'].includes(mode)?1:0);inventory.push(row);
  }
  await execute(`__viewsSetup('T5_BAG');ScreenViews.select('procurement');Workspace.capture();`);await settle();
  const expected=await execute(`({state:ScreenViews.snapshot(),variant:CraftApp.saveVariant()})`),loaded=once(window.webContents,'did-finish-load');window.webContents.reload();await loaded;await settle();assert.deepEqual(await execute(`({state:ScreenViews.snapshot(),variant:CraftApp.saveVariant()})`),expected);
  // Storage errors must leave the visible view and all calculation data intact.
  const storageFailure=await execute(`(()=>{const before=ScreenViews.snapshot(),variant=CraftApp.saveVariant(),original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key===ScreenViewsModel.KEY)throw Error('full');return original.call(this,key,value);};let selected;try{selected=ScreenViews.select('review');}finally{Storage.prototype.setItem=original;}return {selected,before,after:ScreenViews.snapshot(),same:JSON.stringify(variant)===JSON.stringify(CraftApp.saveVariant())};})()`);assert.equal(storageFailure.selected,false);assert.deepEqual(storageFailure.after,storageFailure.before);assert.equal(storageFailure.same,true);
  await execute(`ScreenViews.select('procurement');`);await settle();
  const layouts=[];
  for(const theme of await execute(`[...document.getElementById('theme').options].map(n=>n.value)`))for(const width of [800,1440])for(const zoom of [1,1.5]){
   await resize(width,zoom);
   const row=await execute('(()=>{document.getElementById("theme").value='+JSON.stringify(theme)+';document.getElementById("theme").dispatchEvent(new Event("change",{bubbles:true}));const buttons=[...document.querySelectorAll("#craft-content .screen-views button")];return {theme:document.documentElement.dataset.theme,viewport:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth+1,visible:buttons.every(n=>n.checkVisibility()&&n.getBoundingClientRect().right<=innerWidth)};})()');assert.equal(row.overflow,false,JSON.stringify({width,zoom,...row}));assert.equal(row.visible,true);if(width===800&&zoom===1.5)assert.ok(row.viewport<800);layouts.push({width,zoom,actualZoom:window.webContents.getZoomFactor(),...row});
  }
  await resize(800,1.5);await shot('screen-view-narrow.png');await resize(1440,1);
  await execute(`document.getElementById('view-reset').click();`);await settle();
  const reset=await execute(`({state:ScreenViews.snapshot(),saved:JSON.parse(localStorage.getItem(ScreenViewsModel.KEY)),layout:JSON.parse(localStorage.getItem(ScreenLayoutModel.KEY)),rows:BlockSummaries.snapshot()})`);assert.equal(reset.state.selected,'custom');assert.deepEqual(reset.saved,{version:1,modes:{}});assert.deepEqual(reset.layout,{version:1,modes:{}});assert.ok(reset.rows.every(r=>!r.collapsed));
  await execute(`localStorage.setItem(ScreenViewsModel.KEY,'broken');`);const reload=once(window.webContents,'did-finish-load');window.webContents.reload();await reload;await settle();
  assert.equal(await execute(`localStorage.getItem(ScreenViewsModel.KEY)`),'broken');assert.equal(await execute(`ScreenViews.snapshot().selected`),'custom');assert.equal(await execute(`document.querySelector('#craft-content .screen-views-status').textContent.includes('Не удалось прочитать')`),true);
  await execute(`ScreenViews.select('calculation');`);await settle();assert.equal(await execute(`ScreenViews.snapshot().selected`),'calculation');await execute(`document.getElementById('view-reset').click();`);
  return {views,customRestored:true,customBeforePresets:true,manualChangesRestored:true,reorder,keyboard:true,incomplete,variants,sectionIsolation:true,luxury,inventory,restart:true,storageFailure,malformedStorage:true,layouts,reset};
 }finally{await execute(`if(window.__viewsFetch)window.fetch=window.__viewsFetch;`).catch(()=>{});}
}
module.exports={run};
