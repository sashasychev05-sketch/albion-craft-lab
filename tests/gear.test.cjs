const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');
const w={ALBION_DATA:{recipes:[],names:{}}};vm.runInNewContext(fs.readFileSync(__dirname+'/../dist/gear-data.js','utf8'),{window:w});
global.GEAR_META=w.GEAR_META;
const E=require('../dist/engine.js');const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const rows=JSON.parse(JSON.stringify(w.GEAR_RECIPES));assert.equal(rows.length,new Set(rows.map(r=>r.id)).size);assert.ok(rows.length>6000);assert.ok(rows.filter(r=>['tools','furniture','gatherergear'].includes(r.category)).every(r=>!r.blackMarket));
for(const r of rows){assert.ok(r.station);assert.ok(r.mats.length);assert.ok(Number.isFinite(r.fee300)&&r.fee300>=0);assert.ok(r.basefocus>=0);assert.ok(r.output>0);}
close(E.hideoutReturn(40,false),40);close(E.hideoutReturn(40,true),100*(1-1/(1/.6+.59)));assert.equal(E.hideoutReturn(null,true),null);
close(E.returnRate('gear','Lymhurst',false,'sword'),100*(1-1/1.33));close(E.returnRate('gear','Lymhurst',true,'sword'),100*(1-1/1.92));close(E.returnRate('gear','Lymhurst',false,'sword','island'),100*(1-1/1.15));close(E.returnRate('gear','Lymhurst',false,'sword','city',10),100*(1-1/1.43));
const sword=rows.find(r=>r.id==='T4_MAIN_SWORD'), sword4=rows.find(r=>r.id==='T4_MAIN_SWORD@4');assert.deepEqual(sword.mats.map(m=>[m.id,m.n]),[['T4_METALBAR',16],['T4_LEATHER',8]]);assert.equal(sword4.mats[0].id,'T4_METALBAR_LEVEL4@4');close(sword.fee300,384*.1125*3);close(sword4.fee300,sword.fee300*16);
const cfg={quantity:10,rrr:50,focus:false,station:300,unitFee:sword.fee300,salePrice:2000,saleMode:'buy',tax:4,buffer:0,chain:false};
const q=()=>({price:10,age:1});let r=E.calculate(sword,cfg,w.ALBION_DATA,q);assert.equal(r.amount,10);assert.equal(r.bill[0].net,80);assert.equal(r.bill[1].net,40);close(r.fees,1296);
const artifact=rows.find(r=>r.alternatives.length>1&&r.mats.some(m=>!m.returns));assert.ok(artifact);
r=E.calculate(artifact,{...cfg,recipeIndex:0},w.ALBION_DATA,q);let special=artifact.mats.find(m=>!m.returns);assert.equal(r.bill.find(m=>m.id===special.id).net,special.n*10);
r=E.calculate(artifact,{...cfg,recipeIndex:1},w.ALBION_DATA,q);assert.deepEqual(r.recipeMats,artifact.alternatives[1].mats);assert.ok(r.bill.some(m=>m.id.includes('TOKEN')));assert.ok(!r.bill.some(m=>m.id===special.id));
const cape=rows.find(r=>r.id==='T4_CAPEITEM_FW_BRIDGEWATCH');assert.ok(cape.mats.some(m=>m.preserveQuality));let preserved=false;E.calculate(cape,{...cfg,quality:4},w.ALBION_DATA,(id,m)=>{if(m.preserveQuality)preserved=true;return q()});assert.ok(preserved);
const focused=E.calculate(sword,{...cfg,focus:true,volumeMode:'focus',focusBudget:30000,eff:0},w.ALBION_DATA,q);assert.ok(focused.focus<=30000);assert.equal(focused.amount,Math.floor(30000/sword.basefocus));
// Equipment refining must keep its own return and must not consume the equipment focus budget.
const material={id:'T4_METALBAR',kind:'refine',tier:4,output:1,basefocus:54,fee300:1,mats:[{id:'T4_ORE',n:2,returns:true}]};
r=E.calculate(sword,{...cfg,focus:true,chain:true,chainRrr:25,startTier:3}, {recipes:[material]},q);assert.equal(r.focus,10*sword.basefocus);assert.equal(r.bill.find(m=>m.id==='T4_ORE').net,120);
const otherTariff=E.calculate(sword,{...cfg,focus:true,chain:true,chainRrr:25,startTier:3,chainStation:600}, {recipes:[material]},q);close(otherTariff.fees-r.fees,80);
console.log('PASS: real gear recipes, .4 materials, artifacts and alternative tokens, preserved quality, city/island/hideout returns, nutrition fees, focus budget, independent refining');
