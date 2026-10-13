const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),T=require('../dist/extras-engine.js'),w={};
for(const f of ['data.js','gear-data.js','extras-data.js','transmutation-values.js'])vm.runInNewContext(fs.readFileSync(__dirname+'/../dist/'+f,'utf8'),{window:w});const X=w.CRAFT_EXTRAS;
test('Screenshot: 20 fiber 4.3 to 4.4 at station 299 and multiplier 1.156 costs 555714',()=>{
 const r=T.conversion('T4_FIBER_LEVEL3@3','T4_FIBER_LEVEL4@4',20,X,{station:299,multiplier:1.156});assert.equal(r.baseSilver,480000);assert.ok(Math.abs(r.stationFee-834.21)<1e-8);assert.equal(r.silver,555714);assert.equal(r.feesReady,true);assert.equal(r.sourceCount,20);
});
test('Calibration removes nutrition fee before deriving the multiplier; changing station keeps it independent',()=>{
 const c=T.calibrate(555714,20,299);assert.ok(Math.abs(c.multiplier-1.156)<1e-6);assert.equal(T.conversion('T4_FIBER_LEVEL3@3','T4_FIBER_LEVEL4@4',20,X,{station:299,multiplier:c.multiplier}).silver,555714);const free=T.conversion('T4_FIBER_LEVEL3@3','T4_FIBER_LEVEL4@4',20,X,{station:0,multiplier:c.multiplier});assert.equal(free.silver,554880);assert.equal(free.stationFee,0);
 for(const args of [[0,20,299],[100,20,299],[555714,0,299],[555714,1.5,299],[555714,20,-1],[NaN,20,299]])assert.equal(T.calibrate(...args),null);
});
test('Each step uses its own output Item Value and rounds one batch; source purchase is charged separately',()=>{
 const r=T.conversion('T4_FIBER','T6_FIBER',100,X,{station:299,multiplier:1.154});assert.equal(r.steps.length,2);for(const step of r.steps){assert.equal(step.nutrition,X.resources[step.to].itemValue*.1125*step.operations);assert.equal(step.fee,Math.round(step.baseFee*1.154+step.nutrition*299/100));}assert.equal(r.silver,r.steps.reduce((n,s)=>n+s.fee,0));
 const rows=T.compare('T6_FIBER',100,X,()=>({price:100}),{station:299,multiplier:1.154});const source=rows.find(r=>r.source==='T4_FIBER');assert.equal(source.cost,source.silver+10000);const direct=rows.find(r=>r.source==='T6_FIBER');assert.equal(direct.silver,0);assert.equal(direct.stationFee,0);
});
test('Unknown coefficient cannot make a transmutation route profitable; direct purchase remains usable',()=>{
 const rows=T.compare('T5_FIBER',100,X,()=>({price:10}),{station:299,multiplier:null});assert.equal(rows.find(r=>r.source==='T4_FIBER').valid,false);assert.equal(rows.find(r=>r.source==='T5_FIBER').valid,true);assert.ok(Object.values(X.resources).every(r=>Number.isFinite(r.itemValue)&&r.itemValue>=0));
});
