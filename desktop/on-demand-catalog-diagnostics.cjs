'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{once}=require('node:events');
async function run(window,folder){
 const execute=code=>window.webContents.executeJavaScript(code),pause=ms=>new Promise(r=>setTimeout(r,ms)),settle=async()=>{await pause(150);await execute('CatalogPanel.sync();document.body.offsetHeight');};
 const resize=async width=>{window.setSize(width,1080);for(let n=0;n<30;n++){await pause(100);const actual=await execute('innerWidth'),expected=window.getContentSize()[0]/window.webContents.getZoomFactor();if(Math.abs(actual-expected)<2){await settle();return;}}throw Error('The test window did not finish resizing');};
 console.log('Checking on-demand catalogs and pinned state');
 const original=await execute(`({open:CatalogPanel.snapshot().open,settings:CatalogPanel.snapshot().settings})`);
 // No earlier suite explicitly pins a panel before this acceptance check.
 assert.equal(original.open,false);
 await resize(1920);
 const anchors=[];
 for(const [mode,id]of Object.entries({food:'product',potions:'product',gear:'product',refine:'product',training:'train-product',prices:'book-family',quality:'quality-item',enchant:'enchant-item',salvage:'salvage-item',mounts:'mounts-item'})){
  await execute(`Workspace.tabAction(Workspace.snapshot().active,'others');CraftApp.navigate('${mode}');CatalogPanel.hide();`);await settle();
  const row=await execute(`(()=>{const select=document.getElementById('${id}'),toggle=document.getElementById('catalog-toggle'),attachment=ItemPicker.attachment('${id}'),container=toggle.closest('.catalog-item-control');return {mode:Workspace.activeMode(),sameControl:container?.contains(attachment.trigger)&&select.parentElement.contains(container),visible:toggle.checkVisibility(),open:CatalogPanel.snapshot().open,buttons:document.querySelectorAll('#catalog-toggle').length,width:innerWidth,scroll:document.documentElement.scrollWidth};})()`);
  assert.equal(row.mode,mode);assert.equal(row.sameControl,true,JSON.stringify(row));assert.equal(row.visible,true);assert.equal(row.open,false);assert.equal(row.buttons,1);assert.ok(row.scroll<=row.width+1);anchors.push(row);
 }
 await execute(`CraftApp.open('T4_ARMOR_CLOTH_SET1');CatalogPanel.hide();CatalogPanel.reset();CraftApp.saveConfig({quantity:23,volumeMode:'quantity',focus:false,craftPlace:'city',manualReturn:true,rrr:0,manualSale:true,salePrice:10000});CraftApp.cancelMarket();for(const m of CraftApp.snapshot().result.bill)CraftApp.editMaterial(m.id,{price:100});`);await settle();
 const temporary=await execute(`(()=>{const calc=document.getElementById('catalog-calculation'),before=calc.getBoundingClientRect().width,record=JSON.stringify(CraftApp.saveVariant()),button=document.getElementById('catalog-toggle');button.focus();button.click();const s=CatalogPanel.snapshot();const out={drawer:s.drawer,open:s.open,sameWidth:Math.abs(calc.getBoundingClientRect().width-before)<1,same:record===JSON.stringify(CraftApp.saveVariant()),focus:document.activeElement.id,pinned:s.settings.modes.gear.pinned,backdrop:!document.querySelector('.catalog-backdrop').hidden,separator:document.getElementById('catalog-separator').checkVisibility()};document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));out.closed=!CatalogPanel.snapshot().open;out.returned=document.activeElement===button;return out;})()`);
 assert.deepEqual(temporary,{drawer:true,open:true,sameWidth:true,same:true,focus:'catalog-search',pinned:false,backdrop:true,separator:false,closed:true,returned:true});
 const keyboard=await execute(`(()=>{CatalogPanel.show();const panel=document.getElementById('catalog-panel'),fields=[...panel.querySelectorAll('button,input,select,textarea,a[href],summary,[tabindex]')].filter(n=>!n.disabled&&n.tabIndex>=0&&n.checkVisibility()),first=fields[0],last=fields.at(-1);last.focus();last.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));const forward=document.activeElement===first;first.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true}));const backward=document.activeElement===last,role=panel.getAttribute('role'),modal=panel.getAttribute('aria-modal');CatalogPanel.hide();return {forward,backward,role,modal};})()`);assert.deepEqual(keyboard,{forward:true,backward:true,role:'dialog',modal:'true'});
 await execute(`document.getElementById('catalog-toggle').click();document.getElementById('catalog-pin').click();CatalogPanel.setFilters({search:'мантия',tier:'4',ench:'0',main:'',sub:'',recipeCategory:''});CatalogPanel.setWidth(290);Workspace.capture();`);await settle();
 const pinned=await execute(`(()=>{const s=CatalogPanel.snapshot(),area=document.getElementById('catalog-workspace').getBoundingClientRect(),calc=document.getElementById('catalog-calculation').getBoundingClientRect();return {open:s.open,drawer:s.drawer,pinned:s.settings.modes.gear.pinned,pressed:document.getElementById('catalog-pin').getAttribute('aria-pressed'),separator:document.getElementById('catalog-separator').checkVisibility(),backdrop:!document.querySelector('.catalog-backdrop').hidden,width:calc.width,area:area.width,search:s.settings.modes.gear.search,ratio:s.settings.modes.gear.widthRatio};})()`);
 assert.equal(pinned.open,true);assert.equal(pinned.drawer,false);assert.equal(pinned.pinned,true);assert.equal(pinned.pressed,'true');assert.equal(pinned.separator,true);assert.equal(pinned.backdrop,false);assert.ok(pinned.width>=480&&pinned.width<pinned.area);
 const loaded=once(window.webContents,'did-finish-load');window.webContents.reload();await loaded;await settle();
 const restored=await execute(`CatalogPanel.snapshot()`);assert.equal(restored.open,true);assert.equal(restored.drawer,false);assert.equal(restored.settings.modes.gear.pinned,true);assert.equal(restored.settings.modes.gear.search,pinned.search);assert.equal(restored.settings.modes.gear.widthRatio,pinned.ratio);
 await resize(800);
 const narrow=await execute(`(()=>{CatalogPanel.show();const before=Workspace.snapshot().active,id=CatalogPanel.snapshot().rendered.find(id=>id!==Workspace.selectedItem());const drawer=CatalogPanel.snapshot().drawer;CatalogPanel.choose(id);return {drawer,closed:!CatalogPanel.snapshot().open,pinned:CatalogPanel.snapshot().settings.modes.gear.pinned,sameTab:before===Workspace.snapshot().active,inside:document.getElementById('catalog-calculation').contains(document.activeElement),width:innerWidth,scroll:document.documentElement.scrollWidth};})()`);
 assert.equal(narrow.drawer,true);assert.equal(narrow.closed,true);assert.equal(narrow.pinned,true);assert.equal(narrow.sameTab,true);assert.equal(narrow.inside,true);assert.ok(narrow.scroll<=narrow.width+1);
 await resize(1920);
 assert.equal(await execute('CatalogPanel.snapshot().open'),true);
 await execute(`CatalogPanel.setPinned(false);CatalogPanel.setFilters({search:'мантия',tier:'4',ench:'0',main:'',sub:'',recipeCategory:''});Workspace.capture();`);await settle();
 const unpinned=await execute(`({open:CatalogPanel.snapshot().open,drawer:CatalogPanel.snapshot().drawer})`);assert.deepEqual(unpinned,{open:true,drawer:true});
 const reloaded=once(window.webContents,'did-finish-load');window.webContents.reload();await reloaded;await settle();
 const closed=await execute(`CatalogPanel.snapshot()`);assert.equal(closed.open,false);assert.equal(closed.settings.modes.gear.pinned,false);assert.equal(closed.settings.modes.gear.search,'мантия');assert.equal(closed.settings.modes.gear.tier,'4');
 await execute(`CatalogPanel.reset();window.scrollTo({top:Math.max(0,window.scrollY+document.querySelector('#craft-content .flow-layout').getBoundingClientRect().top-24),behavior:'instant'});document.querySelector('.interface-menu').open=false;new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);await pause(250);
 fs.writeFileSync(path.join(folder,'catalog-by-button.png'),(await window.webContents.capturePage()).toPNG());
 await execute(`document.getElementById('catalog-toggle').click();new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);await pause(250);
 fs.writeFileSync(path.join(folder,'catalog-on-demand.png'),(await window.webContents.capturePage()).toPNG());
 await execute(`CatalogPanel.setPinned(true);new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);await pause(250);
 fs.writeFileSync(path.join(folder,'catalog-pinned.png'),(await window.webContents.capturePage()).toPNG());
 await execute(`CatalogPanel.setPinned(false);CatalogPanel.hide();`);
 window.setSize(1440,960);
 return {anchors,temporary,keyboard,pinned,restart:true,narrow,unpinned,closedOnRestart:true};
}
module.exports={run};
