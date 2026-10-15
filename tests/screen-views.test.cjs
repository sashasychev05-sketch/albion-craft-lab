'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),M=require('../dist/screen-views-model.js');
const blocks=['item','production','sale','advanced','purchase','prices','routes','comparison','sources'].map(role=>({id:role,role}));
test('Views show relevant craft and luxury blocks without hiding the result',()=>{
 const all=[...blocks,{id:'result',role:'result',hideable:false}];
 assert.deepEqual(M.preset('calculation',all).hidden,['advanced','prices','routes','comparison','sources']);
 assert.deepEqual(M.preset('procurement',all).hidden,['advanced','comparison','sources']);
 assert.deepEqual(M.preset('review',all).hidden,[]);
 assert.deepEqual(M.preset('review',all).order,all.map(b=>b.id));
 assert.throws(()=>M.preset('custom',blocks));assert.throws(()=>M.preset('unknown',blocks));
});
test('Procurement only collapses complete forms; calculation and review keep forms open',()=>{
 for(const ready of [false,undefined,null])assert.equal(M.collapse('procurement',ready),false);
 assert.equal(M.collapse('procurement',true),true);
 for(const view of ['calculation','review'])assert.equal(M.collapse(view,true),false);
});
test('Saved custom layouts and separate section views round-trip',()=>{
 const snapshot={layout:{order:['sale','item'],hidden:['advanced']},folds:{item:true,sale:false},details:{result:true}},value={version:1,modes:{gear:{selected:'review',current:snapshot,custom:snapshot},food:{selected:'custom',current:snapshot,custom:snapshot}}};
 assert.deepEqual(M.read({getItem:()=>JSON.stringify(value)}),value);assert.deepEqual(M.read({getItem:()=>null}),M.empty());
});
test('Invalid or obsolete storage cannot apply arbitrary screen state',()=>{
 const snapshot={layout:{order:[],hidden:[]},folds:{},details:{}};
 for(const raw of ['null','broken',JSON.stringify({version:2,modes:{}}),JSON.stringify({version:1,modes:{food:{selected:'unknown',current:snapshot,custom:snapshot}}}),JSON.stringify({version:1,modes:{food:{selected:'review',current:{...snapshot,folds:{item:'true'}},custom:snapshot}}})])assert.throws(()=>M.read({getItem:()=>raw}));
 assert.deepEqual(M.read({getItem:()=>JSON.stringify({version:1,modes:{unknown:{}}})}),M.empty());
});
