'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),M=require('../dist/screen-layout-model.js');
const blocks=[{id:'item',group:'parameters'},{id:'production',group:'parameters'},{id:'sale',group:'parameters'},{id:'purchase',group:'tables'},{id:'comparison',group:'tables'},{id:'result',group:'result',hideable:false}];
test('Layouts keep group boundaries, discard stale IDs and include new blocks',()=>{
 const value=M.normalize({order:['comparison','sale','sale','unknown','item'],hidden:['unknown','result','purchase']},blocks);
 assert.deepEqual(value,{order:['sale','item','production','comparison','purchase','result'],hidden:['purchase']});
 const future=[...blocks,{id:'new-table',group:'tables'}];assert.ok(M.normalize(value,future).order.includes('new-table'));
});
test('Reordering stays in its group and leaves visibility unchanged',()=>{
 let value=M.normalize({hidden:['sale']},blocks);value=M.move(value,blocks,'production',-1);assert.deepEqual(value.order,['production','item','sale','purchase','comparison','result']);assert.deepEqual(value.hidden,['sale']);
 assert.deepEqual(M.move(value,blocks,'production',-1),value);assert.deepEqual(M.move(value,blocks,'comparison',1),value);assert.deepEqual(M.move(value,blocks,'unknown',1),value);
});
test('Visibility preserves order and always-visible blocks',()=>{
 const value=M.move(M.normalize(null,blocks),blocks,'sale',-1),hidden=M.visible(value,blocks,'production',false);
 assert.deepEqual(hidden.order,value.order);assert.deepEqual(hidden.hidden,['production']);assert.deepEqual(M.visible(hidden,blocks,'production',true).hidden,[]);assert.deepEqual(M.visible(hidden,blocks,'result',false),hidden);
});
test('Each section retains its own layout and returning defaults removes only its override',()=>{
 const food=M.move(M.normalize(null,blocks),blocks,'production',-1),gear=M.visible(null,blocks,'purchase',false);let data=M.update(M.empty(),'food',food,blocks);data=M.update(data,'gear',gear,blocks);
 assert.deepEqual(data.modes.food,food);assert.deepEqual(data.modes.gear,gear);const restored=M.update(data,'food',null,blocks);assert.equal(restored.modes.food,undefined);assert.deepEqual(restored.modes.gear,gear);assert.deepEqual(data.modes.food,food);assert.throws(()=>M.update(data,'__proto__',gear,blocks));
});
test('Storage round-trips valid layouts without mutating the original data',()=>{
 const data=M.update(M.empty(),'gear',{order:['sale','item'],hidden:['purchase','purchase']},blocks),raw=JSON.stringify(data),storage={getItem:key=>{assert.equal(key,M.KEY);return raw;}};
 assert.deepEqual(M.read(storage),data);assert.deepEqual(M.read({getItem:()=>null}),M.empty());assert.deepEqual(M.read({getItem:()=>JSON.stringify({version:1,modes:{unknown:{order:[],hidden:[]}}})}),M.empty());
});
test('Malformed preferences fail safely without rewriting stored input',()=>{
 for(const raw of ['broken','null',JSON.stringify({version:2,modes:{}}),JSON.stringify({version:1,modes:{food:{order:[],hidden:'all'}}}),JSON.stringify({version:1,modes:{food:{order:Array(201).fill('item'),hidden:[]}}})]){
  const storage={raw,getItem(){return this.raw;},setItem(){assert.fail('read must not write');}};assert.throws(()=>M.read(storage));assert.equal(storage.raw,raw);
 }
});
