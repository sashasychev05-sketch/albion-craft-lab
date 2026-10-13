'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{once}=require('node:events');
async function run(window,folder){
 const execute=code=>window.webContents.executeJavaScript(code);
 await execute("localStorage.removeItem('albion-islands-v1')");const loaded=once(window.webContents,'did-finish-load');window.webContents.reload();await loaded;
 const result=await execute(`(() => {
  const $=id=>document.getElementById(id),set=(id,v)=>{const n=$(id);n.value=v;n.dispatchEvent(new Event('change',{bubbles:true}));},field=(group,key,v)=>{const n=document.querySelector('[data-island-group="'+group+'"][data-field="'+key+'"]');n.value=v;n.dispatchEvent(new Event('change',{bubbles:true}));};
  const before=JSON.stringify(CraftApp.snapshot());document.querySelector('button.nav[data-mode=island]').click();
  $('island-add-crop').click();field('crops','plots',4);field('crops','water',18);field('crops','focus',125);
  set('island-houses',4);$('island-add-worker').click();field('workers','count',12);field('workers','yield',150);field('workers','reward',50000);
  set('island-cap-island',1000000);set('island-cap-houses',2000000);set('island-transport',1000);
  const price=(key,v)=>{const n=[...document.querySelectorAll('[data-island-price]')].find(n=>n.dataset.islandPrice===key);n.value=v;n.dispatchEvent(new Event('change',{bubbles:true}));};
  price('Lymhurst|buy|T1_FARM_CARROT_SEED',2000);price('Lymhurst|sell|T1_CARROT',500);price('Lymhurst|buy|T5_JOURNAL_WOOD_FULL',10000);price('Lymhurst|sell|T5_JOURNAL_WOOD_EMPTY',2000);
  const x=IslandUI.snapshot(),primary=CharacterProfiles.snapshot().active,alt=CharacterProfiles.snapshot().profiles.find(p=>p.id!==primary).id;
  set('active-character',alt);field('crops','focus',250);const altFocus=IslandUI.snapshot().result.focus;set('active-character',primary);const primaryFocus=IslandUI.snapshot().result.focus;
  set('island-actual-income',100000);set('island-actual-supplies',25000);set('island-actual-fees',6500);set('island-actual-transport',500);set('island-actual-other',300);set('island-actual-investment',200000);$('island-actual-note').value='Реальный сбор';$('island-actual-form').requestSubmit();
  const actual=IslandMath.actual(IslandUI.snapshot().plan.ledger),original=IslandUI.snapshot().current.uid;
  $('island-name').value='Огород альта';$('island-copy').click();const copy=IslandUI.snapshot();set('island-picker',original);
  set('server','west');const west=IslandUI.snapshot();set('server','europe');const returned=IslandUI.snapshot();
  set('island-plots',2);const overfull=!IslandUI.snapshot().result.ready&&$('island-day-profit').textContent==='—';set('island-plots',16);
  return {ready:x.result.ready,focus:x.result.focus,harvest:x.result.rows[0].harvest,investment:x.result.investment,perDay:x.result.perDay,unchanged:before===JSON.stringify(CraftApp.snapshot()),primaryFocus,altFocus,actual,original,copied:{ledger:copy.plan.ledger.length,crops:copy.plan.crops.length},west:{server:west.server,crops:west.plan.crops.length},returned:{server:returned.server,id:returned.current.uid,ledger:returned.plan.ledger.length},overfull};
 })()`);
 assert.equal(result.ready,true);assert.equal(result.focus,2250);assert.ok(Math.abs(result.harvest-356.4)<1e-8);assert.equal(result.investment,3072000);assert.equal(result.unchanged,true);assert.equal(result.primaryFocus,2250);assert.equal(result.altFocus,4500);assert.equal(result.actual.profit,67700);assert.equal(result.actual.netCash,-132300);assert.deepEqual(result.copied,{ledger:0,crops:1});assert.deepEqual(result.west,{server:'west',crops:0});assert.deepEqual(result.returned,{server:'europe',id:result.original,ledger:1});assert.equal(result.overfull,true);
 await new Promise(resolve=>setTimeout(resolve,150));const screenshot=await window.webContents.capturePage();fs.writeFileSync(path.resolve(folder,'islands.png'),screenshot.toPNG());
 const csvFile=path.resolve(folder,'island-plan.csv'),download=new Promise((resolve,reject)=>window.webContents.session.once('will-download',(_e,item)=>{item.setSavePath(csvFile);item.once('done',(_e,state)=>state==='completed'?resolve():reject(Error(state)));}));await execute("document.getElementById('island-export').click()");await download;assert.ok(fs.readFileSync(csvFile,'utf8').includes('Стартовые вложения'));
 const reloaded=once(window.webContents,'did-finish-load');window.webContents.reload();await reloaded;
 const persisted=await execute("document.querySelector('button.nav[data-mode=island]').click(); ({id:IslandUI.snapshot().current.uid,ledger:IslandUI.snapshot().plan.ledger.length,focus:IslandUI.snapshot().result.focus,plans:document.getElementById('island-picker').options.length})");assert.deepEqual(persisted,{id:result.original,ledger:1,focus:2250,plans:2});
 const animals=await execute(`(() => {
  const $=id=>document.getElementById(id),field=(key,value)=>{const n=document.querySelector('[data-island-group=animals][data-field='+key+']');n.value=value;n.dispatchEvent(new Event('change',{bubbles:true}));},price=(key,v)=>{const n=[...document.querySelectorAll('[data-island-price]')].find(n=>n.dataset.islandPrice===key);n.value=v;n.dispatchEvent(new Event('change',{bubbles:true}));};
  $('island-add-animal').click();field('id','T8_FARM_COW_BABY');field('mode','produce');
  price('Lymhurst|buy|T8_PUMPKIN',300);price('Lymhurst|buy|T8_FARM_COW_GROWN',30000);price('Lymhurst|sell|T8_MILK',700);
  let x=IslandUI.snapshot().result,milk=x.rows.find(r=>r.kind==='animal');const readyMilk=x.ready;
  field('stock',9);const noRepeatedPurchase=IslandUI.snapshot().result.animalCapital===0;
  field('feed','T1_CARROT');price('Lymhurst|buy|T1_CARROT',300);const otherFood=IslandUI.snapshot().result.rows.find(r=>r.kind==='animal').foodQty;field('feed','T8_PUMPKIN');
  field('mode','meat');field('nurture',9);field('focus',125);field('meatYield',20);field('butcherCost',100);
  price('Lymhurst|buy|T8_FARM_COW_BABY',30000);price('Lymhurst|sell|T8_FARM_COW_BABY',30000);price('Lymhurst|sell|T8_MEAT',1000);
  x=IslandUI.snapshot().result;const meat=x.rows.find(r=>r.kind==='animal'),readyMeat=x.ready;
  $('island-premium').checked=false;$('island-premium').dispatchEvent(new Event('change',{bubbles:true}));const slower=IslandUI.snapshot().result.rows.find(r=>r.kind==='animal'),tax=$('island-tax').value;
  $('island-premium').checked=true;$('island-premium').dispatchEvent(new Event('change',{bubbles:true}));field('mode','produce');field('stock',9);$('island-animals').scrollIntoView({block:'start'});
  return {readyMilk,milk:{output:milk.output,food:milk.foodQty,capital:milk.capital,focus:milk.focus},noRepeatedPurchase,otherFood,readyMeat,meat:{output:meat.output,focus:meat.focus},slower:{hours:slower.hours,cycles:slower.cycles,tax}};
 })()`);
 assert.equal(animals.readyMilk,true);assert.deepEqual(animals.milk,{output:162,food:81,capital:270000,focus:0});assert.equal(animals.noRepeatedPurchase,true);assert.equal(animals.otherFood,162);assert.equal(animals.readyMeat,true);assert.deepEqual(animals.meat,{output:180,focus:1125});assert.deepEqual(animals.slower,{hours:44,cycles:16,tax:'8'});
 // Render an offscreen native window for a complete image even when Windows occludes the test window.
 const { BrowserWindow }=require('electron'),preview=new BrowserWindow({width:1440,height:960,show:false,webPreferences:{...window.webContents.getLastWebPreferences(),offscreen:true,backgroundThrottling:false}});
 const previewLoaded=once(preview.webContents,'did-finish-load');preview.loadURL(window.webContents.getURL());await previewLoaded;
 await preview.webContents.executeJavaScript("document.querySelector('button.nav[data-mode=island]').click()");await new Promise(resolve=>setTimeout(resolve,500));
 const previewPosition=await preview.webContents.executeJavaScript("window.scrollTo({top:document.getElementById('island-animals').getBoundingClientRect().top+window.scrollY-12,behavior:'instant'});({top:document.getElementById('island-animals').getBoundingClientRect().top,height:innerHeight})");assert.ok(previewPosition.top>=0&&previewPosition.top<previewPosition.height);
 await new Promise(resolve=>setTimeout(resolve,200));fs.writeFileSync(path.resolve(folder,'island-animals.png'),(await preview.webContents.capturePage(undefined,{stayHidden:true})).toPNG());preview.destroy();
 const animalsReload=once(window.webContents,'did-finish-load');window.webContents.reload();await animalsReload;assert.equal(await execute("document.querySelector('button.nav[data-mode=island]').click();IslandUI.snapshot().plan.animals[0].mode"),'produce');
 // Verify the live automatic price guard, including a low-volume history and stale orders.
 // Test guard through a new UI instance whose stored plan has no manual overrides.
 await execute(`(() => {const s=IslandMath.createStore(localStorage,IslandData),p=s.snapshot('europe');p.plans.find(x=>x.uid===p.active).plan.prices={};s.save('europe',p.plans.find(x=>x.uid===p.active).plan);const draft=ActivityViews.island.captureDraft();draft.plan.prices={};ActivityViews.island.restoreDraft(draft);Workspace.capture();return true;})()`);
 const guardReload=once(window.webContents,'did-finish-load');window.webContents.reload();await guardReload;
 const liveGuards=await execute(`(() => {
  document.querySelector('button.nav[data-mode=island]').click();const v=ActivityViews.island,q=v.market.quote,h=v.market.history;v.market.quote=()=>({price:500,age:1});v.market.history=()=>({days:3,daily:.5,to:new Date(Date.now()-86400000).toISOString().slice(0,10)});v.render();const low=!IslandUI.snapshot().result.ready;
  v.market.history=()=>({days:3,daily:2,to:new Date(Date.now()-86400000).toISOString().slice(0,10)});v.render();const valid=IslandUI.snapshot().result.ready;v.market.quote=()=>({price:0,reason:'Устаревшая цена'});v.render();const stale=!IslandUI.snapshot().result.ready;v.market.quote=q;v.market.history=h;return {low,valid,stale};
 })()`);assert.deepEqual(liveGuards,{low:true,valid:true,stale:true});
 window.setSize(800,960);await execute("document.getElementById('island-actual').scrollIntoView({block:'start'})");const narrow=await execute('({width:innerWidth,scroll:document.documentElement.scrollWidth})');assert.ok(narrow.scroll<=narrow.width+1);fs.writeFileSync(path.resolve(folder,'islands-actual.png'),(await window.webContents.capturePage()).toPNG());window.setSize(1440,960);
 return {...result,animals,reloaded:true,csv:true,guards:liveGuards,narrow};
}
module.exports={run};
