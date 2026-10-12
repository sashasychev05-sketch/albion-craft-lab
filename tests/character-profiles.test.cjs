'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),P=require('../dist/character-profiles.js');
const w={};for(const file of ['mastery-data.js','mastery-profile.js'])vm.runInNewContext(fs.readFileSync(__dirname+'/../dist/'+file,'utf8'),{window:w});
const normalize=v=>w.MasteryProfile.normalize(v,w.MASTERY_DATA);
function storage(levels={}){const map=new Map([[P.LEVELS,JSON.stringify(levels)]]);return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k),map}}
test('migration keeps all existing mastery levels in the first profile',()=>{
 const levels=Object.fromEntries(Object.keys(w.MASTERY_DATA.nodes).map((id,i)=>[id,i%101]));const saved=storage(levels),store=P.create(saved,normalize);
 assert.equal(store.snapshot().profiles.length,1);assert.deepEqual(JSON.parse(JSON.stringify(store.levels())),JSON.parse(JSON.stringify(normalize(levels))));assert.equal(store.snapshot().active,'primary');
});
test('characters keep independent masteries and survive a restart',()=>{
 const saved=storage({FARM_COOK:100,FARM_COOK_STEW:50}),store=P.create(saved,normalize);store.add('Альт');assert.deepEqual(store.levels(),{});store.update({FARM_COOK:10});const alt=store.snapshot().active;
 store.select('primary');assert.equal(store.levels().FARM_COOK_STEW,50);store.select(alt);assert.equal(store.levels().FARM_COOK,10);
 const reopened=P.create(saved,normalize);assert.equal(reopened.snapshot().active,alt);assert.equal(reopened.levels().FARM_COOK,10);
});
test('copying, renaming and deleting never change another character',()=>{
 const saved=storage({FARM_COOK:80}),store=P.create(saved,normalize);store.add('Копия',true);assert.equal(store.levels().FARM_COOK,80);store.update({FARM_COOK:1});store.rename('Повар');assert.throws(()=>store.add('повар'),/уже существует/);
 store.remove(store.snapshot().active);assert.equal(store.levels().FARM_COOK,80);assert.throws(()=>store.remove('primary'),/хотя бы одного/);
});
test('a failed write rolls back the profile selection and mastery mirror',()=>{
 const saved=storage({FARM_COOK:100}),store=P.create(saved,normalize);store.add('Альт');const before=JSON.stringify(store.snapshot()),oldProfiles=saved.getItem(P.KEY),oldLevels=saved.getItem(P.LEVELS),write=saved.setItem;
 let fail=true;saved.setItem=(k,v)=>{if(k===P.LEVELS&&fail){fail=false;throw Error('quota')}write(k,v)};
 assert.throws(()=>store.select('primary'),/quota/);assert.equal(JSON.stringify(store.snapshot()),before);assert.equal(saved.getItem(P.KEY),oldProfiles);assert.equal(saved.getItem(P.LEVELS),oldLevels);
});
