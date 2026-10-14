'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
async function run(window,folder){
  console.log('Checking catalog visibility and result scrolling');
  const execute=code=>window.webContents.executeJavaScript(code);
  const frame=async()=>{await execute('new Promise(r=>{const timeout=setTimeout(r,400);requestAnimationFrame(()=>requestAnimationFrame(()=>{clearTimeout(timeout);r()}));})');await execute('CatalogPanel.sync();document.body.offsetHeight');};
  const screenshot=async file=>{await execute(`document.querySelector('.interface-menu').open=false;new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);await new Promise(r=>setTimeout(r,250));fs.writeFileSync(path.join(folder,file),(await window.webContents.capturePage()).toPNG());};
  const supported=['food','potions','gear','refine','enchant','quality','salvage','mounts','training','prices'];
  await execute(`window.__interfaceFetch=window.fetch;window.fetch=async()=>({ok:true,json:async()=>[]});Workspace.tabAction(Workspace.snapshot().active,'others');const sticky=document.getElementById('view-sticky');sticky.checked=true;sticky.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('.interface-menu').open=false;`);
  try{
    const catalogs=[];
    for(const width of [800,1920]){
      console.log('Checking catalog sections at '+width+' px');
      window.setSize(width,1080);await frame();
      const modes=await execute(`[...document.querySelectorAll('button.nav[data-mode]')].map(b=>b.dataset.mode)`);
      for(const mode of modes){
        await execute(`CraftApp.navigate(${JSON.stringify(mode)});CatalogPanel.show();`);await frame();
        const row=await execute(`(()=>{const rect=id=>document.getElementById(id).getBoundingClientRect();const snapshot=CatalogPanel.snapshot();return {mode:Workspace.activeMode(),supported:CatalogPanel.supports(Workspace.activeMode()),open:snapshot.open,toolbar:rect('catalog-toolbar').height,panel:rect('catalog-panel').width,separator:rect('catalog-separator').width,area:rect('catalog-workspace').width,calculation:rect('catalog-calculation').width,backdrop:!document.querySelector('.catalog-backdrop').hidden,found:snapshot.found,width:innerWidth,scroll:document.documentElement.scrollWidth};})()`);
        const usable=supported.includes(mode);
        assert.equal(row.mode,mode);assert.equal(row.supported,usable);assert.equal(row.open,usable);
        assert.ok(row.scroll<=row.width+1,JSON.stringify(row));
        if(usable){assert.ok(row.toolbar>0&&row.panel>0);assert.ok(row.found>0);}
        else{assert.equal(row.toolbar,0);assert.equal(row.panel,0);assert.equal(row.separator,0);assert.equal(row.backdrop,false);assert.equal(row.found,0);assert.ok(Math.abs(row.area-row.calculation)<=1);}
        catalogs.push({windowWidth:width,...row});
        await execute('CatalogPanel.hide(false)');
      }
    }
    window.setSize(1440,1080);
    await execute(`CraftApp.navigate('character');BlockFolds.expandAll();window.scrollTo({top:0,behavior:'instant'});`);await frame();
    await screenshot('mastery-without-catalog.png');
    const mastery=await execute(`(()=>{const levels=JSON.stringify(MasteryUI.levels()),a=ItemPicker.attachment('character-recipe');a.trigger.click();const opened=document.getElementById('item-picker-dialog').open,button=document.querySelector('[data-picker-index]');button.click();return {opened,closed:!document.getElementById('item-picker-dialog').open,selected:document.getElementById('character-recipe').value,preview:CharacterUI.captureDraft().previewId,levelsSame:levels===JSON.stringify(MasteryUI.levels()),focus:document.activeElement===a.trigger,catalogOpen:CatalogPanel.snapshot().open};})()`);
    assert.equal(mastery.opened,true);assert.equal(mastery.closed,true);assert.equal(mastery.selected,mastery.preview);assert.equal(mastery.levelsSame,true);assert.equal(mastery.focus,true);assert.equal(mastery.catalogOpen,false);
    window.setSize(1920,1200);
    const states=[
      {name:'ready',patch:{},state:'ready'},
      {name:'missing-return',patch:{craftPlace:'hideout',hideoutBaseReturn:null,manualReturn:false},state:'needs',label:'возврат'},
      {name:'missing-sale-price',patch:{salePrice:0},state:'needs',label:'продажи'},
      {name:'missing-material-price',patch:{},missingMaterial:true,state:'needs',label:'ингредиентов'},
      {name:'missing-quantity',patch:{quantity:0},state:'needs',label:'объём'},
      {name:'loss',patch:{salePrice:1},state:'loss'}
    ];
    const sticky=[];
    for(const c of states){
      console.log('Checking result scrolling: '+c.name);
      await execute(`CraftApp.open('T4_ARMOR_CLOTH_SET1');CatalogPanel.hide();CraftApp.saveConfig({quantity:100,volumeMode:'quantity',focus:false,craftPlace:'city',manualReturn:true,rrr:0,manualSale:true,salePrice:10000,characters:0,station:0,chain:false,...${JSON.stringify(c.patch)}});CraftApp.cancelMarket();for(const m of CraftApp.snapshot().result.bill)CraftApp.editMaterial(m.id,{price:100});${c.missingMaterial?'CraftApp.editMaterial(CraftApp.snapshot().result.bill[0].id,{price:0});':''}BlockFolds.expandAll();document.querySelectorAll('#craft-content .flow-steps details').forEach(d=>d.open=true);document.querySelector('#craft-content .result-extra').open=false;window.scrollTo({top:0,behavior:'instant'});`);await frame();
      const before=await execute(`(()=>{const card=document.querySelector('#craft-content .outcome'),flow=card.closest('.flow-layout'),r=card.getBoundingClientRect(),p=flow.getBoundingClientRect();return {state:document.getElementById('craft-readiness').dataset.state,label:document.getElementById('craft-readiness').textContent,position:getComputedStyle(card).position,top:r.top,height:r.height,flowTop:p.top,flowHeight:p.height,scroll:scrollY,config:JSON.stringify(CraftApp.saveVariant())};})()`);
      assert.equal(before.state,c.state,JSON.stringify({case:c.name,...before}));
      if(c.label)assert.ok(before.label.includes(c.label),before.label);
      assert.equal(before.position,'sticky');assert.ok(before.flowHeight-before.height>80,JSON.stringify(before));
      const scrollTo=before.flowTop+Math.min(120,(before.flowHeight-before.height)/2);
      await execute(`window.scrollTo({top:${scrollTo},behavior:'instant'})`);await frame();
      const after=await execute(`(()=>{const card=document.querySelector('#craft-content .outcome');return {top:card.getBoundingClientRect().top,position:getComputedStyle(card).position,scroll:scrollY,config:JSON.stringify(CraftApp.saveVariant()),overflow:document.documentElement.scrollWidth>innerWidth+1};})()`);
      assert.ok(Math.abs(after.top-Number.parseFloat(await execute(`getComputedStyle(document.querySelector('#craft-content .outcome')).top`)))<=2,JSON.stringify({case:c.name,...after}));assert.ok(after.scroll>before.scroll+50);assert.equal(after.config,before.config);assert.equal(after.overflow,false);
      sticky.push({name:c.name,state:before.state,label:before.label,position:after.position,top:after.top,scroll:after.scroll});
      if(c.name==='missing-return')await screenshot('missing-data-sticky-result.png');
    }
    const appearance=[];
    for(const width of [800,1440,1920]){
      window.setSize(width,1080);await frame();
      for(const ready of [true,false]){
        await execute(`CraftApp.saveConfig({salePrice:${ready?10000:0}});`);await frame();
        const row=await execute(`({position:getComputedStyle(document.querySelector('#craft-content .outcome')).position,overflow:document.documentElement.scrollWidth>innerWidth+1})`);
        assert.equal(row.overflow,false);appearance.push({width,ready,...row});
      }
      assert.equal(appearance.at(-1).position,appearance.at(-2).position,JSON.stringify(appearance.slice(-2)));
    }
    await execute(`CraftApp.saveConfig({salePrice:10000});CatalogPanel.show();`);await frame();
    const catalogWidth=await execute(`getComputedStyle(document.querySelector('#craft-content .outcome')).position`);
    await execute(`CraftApp.saveConfig({salePrice:0});`);await frame();
    assert.equal(await execute(`getComputedStyle(document.querySelector('#craft-content .outcome')).position`),catalogWidth);
    return {catalogs,mastery,sticky,appearance};
  }finally{
    await execute(`window.fetch=window.__interfaceFetch;delete window.__interfaceFetch;CatalogPanel.hide();window.scrollTo({top:0,behavior:'instant'});`);
    window.setSize(1440,960);
  }
}
module.exports={run};
