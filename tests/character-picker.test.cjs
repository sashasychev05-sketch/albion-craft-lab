const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),w={};
for(const file of ['data.js','food-focus-data.js','gear-data.js','extras-data.js','accessory-data.js','mastery-data.js','mastery-engine.js','mastery-profile.js','city-allocation-model.js','engine.js'])vm.runInNewContext(fs.readFileSync(__dirname+'/../dist/'+file,'utf8'),{window:w});
const D=w.ALBION_DATA,M=w.MasteryMath,P=w.MasteryProfile,MD=w.MASTERY_DATA,groups=P.catalog(MD,D.recipes,w.GEAR_META,M),select=(category,branch='all')=>P.previewRecipes(category,branch,groups,D.recipes,M);
test('Every character category exposes all matching craft variants, without representative-only truncation',()=>{
 for(const [category]of P.categories){const nodes=groups.filter(g=>g.category===category).flatMap(g=>g.nodes),expected=D.recipes.filter(r=>nodes.some(n=>M.matches(r.id.split('@')[0],n.patterns))).map(r=>r.id).sort(),actual=select(category).map(r=>r.id).sort();assert.deepEqual(actual,expected,category);assert.ok(actual.length>2,category);assert.equal(actual.length,new Set(actual).size,category);}
 assert.ok(select('food').some(r=>r.tier<7&&r.ench===3));assert.ok(select('potions').some(r=>r.tier===2));assert.ok(select('armor').some(r=>r.tier===8&&r.ench===4));assert.ok(select('weapons').some(r=>r.tier===8&&r.ench===4));
});
test('Accessories include all normal bags, insight satchels, capes, starter tiers and .4',()=>{
 const all=new Set(select('accessories').map(r=>r.id));assert.equal(all.size,79);for(let tier=4;tier<=8;tier++)for(let ench=0;ench<=4;ench++)for(const type of ['BAG','BAG_INSIGHT','CAPE'])assert.ok(all.has('T'+tier+'_'+type+(ench?'@'+ench:'')));
 for(const id of ['T2_BAG','T3_BAG','T2_CAPE','T3_CAPE'])assert.ok(all.has(id));assert.equal(select('accessories','CRAFT_BAG').length,52);assert.equal(select('accessories','CRAFT_CAPE').length,27);assert.ok(!select('accessories','CRAFT_BAG').some(r=>r.id.includes('CAPE')));
});
test('An explicitly chosen mastery branch filters variants by its own patterns',()=>{
 for(const g of groups){const options=select(g.category,g.id);for(const r of options)assert.ok(g.nodes.some(n=>M.matches(r.id.split('@')[0],n.patterns)));const expected=D.recipes.filter(r=>g.nodes.some(n=>M.matches(r.id.split('@')[0],n.patterns)));assert.equal(options.length,expected.length,g.id);}
 assert.equal(select('accessories','CRAFT_SWORDS').length,0);
});
test('Insight satchel recipes consume the tome without return and apply their own focus specialization',()=>{
 const r=D.recipes.find(r=>r.id==='T8_BAG_INSIGHT@4');assert.equal(r.basefocus,75429);assert.equal(r.mats.length,3);assert.equal(r.mats.find(m=>m.id==='T4_SKILLBOOK_STANDARD').returns,false);
 const result=w.CraftEngine.calculate(r,{quantity:10,focus:true,rrr:50,buffer:0,focusSource:'levels',masteryLevels:{CRAFT_BAG_INSIGHT:100},station:0,refineSteps:{}},D,()=>({price:1,age:0}));assert.equal(result.bill.find(m=>m.id==='T4_SKILLBOOK_STANDARD').buy,10);assert.equal(result.bill.find(m=>m.id==='T8_CLOTH_LEVEL4@4').buy,40);assert.equal(result.perOp,M.cost(r,M.efficiency(r,{CRAFT_BAG_INSIGHT:100},MD)));assert.equal(result.amount,10);
});
