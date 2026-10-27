'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const M=require('../dist/avalon-model.js'),{createLibrary}=require('../desktop/avalon-library.cjs');
function raw(name='Coues-Exakrom',id='TNL-002'){return {name,_id:id,tier:4,world:'avalon',image:'coues-exakrom.webp',resources:[{type:'WOOD',max_tier:6}],chests:[{type:'SOLO',count:4}],dungeons:[]};}
function setup(){let value=null;const io={fail:false,getItem:()=>value,setItem(k,v){if(this.fail)throw Error('full');value=v;}},store=M.storage(io);return {io,store};}
test('Avalon catalog rejects invalid counts, resource tiers, duplicate IDs and map traversal',()=>{
 for(const patch of [{image:'../secret.webp'},{image:'https://a/b.webp'},{tier:0},{resources:[{type:'WOOD',max_tier:9}]},{chests:[{type:'SOLO',count:-1}]}])assert.throws(()=>M.catalog({zones:[{...raw(),...patch}]}));assert.throws(()=>M.catalog({zones:[raw(),raw()]}));assert.equal(M.catalog({zones:[raw()]})[0].id,'TNL-002');
});
test('Search combines actual world/tier/resource/chest filters, name fragments and fuzzy OCR names',()=>{
 const zones=M.catalog({zones:[raw(),{...raw('Test City','0000'),world:'city',image:'',tier:1}]});assert.equal(M.search(zones).length,1);assert.equal(M.search(zones,{world:'all'}).length,2);assert.equal(M.search(zones,{query:'COUES EXAKROM',resource:'WOOD',chest:'SOLO',tier:4})[0].id,'TNL-002');assert.equal(M.search(zones,{resource:'ORE'}).length,0);assert.equal(M.search(zones,{query:'Coues-Exakrorn'})[0].id,'TNL-002');assert.equal(M.recognize(zones,'Road to Coues-Exakrom\n00:12')[0].score,100);assert.equal(M.recognize(zones,'not a map at all').length,0);
});
test('Zone quality is preserved for exit labels without inventing absent quality',()=>{
 const zones=M.catalog({zones:[{...raw(),tier:5,quality:6}]});assert.equal(zones[0].quality,6);assert.equal(M.zoneLabel(zones[0]),'5-6');assert.equal(M.zoneLabel(M.catalog({zones:[raw()]})[0]),'4');for(const quality of [0,7,1.2,'6'])assert.throws(()=>M.catalog({zones:[{...raw(),quality}]}));
});
test('Favorites and notes persist; portal expiry is absolute and timers stay isolated by server',()=>{
 const {io,store}=setup();store.favorite('TNL-002');store.note('TNL-002','Проверить проход');store.timer({server:'west',from:'TNL-002',to:'TNL-003',minutes:90},1000);const next=M.storage(io).snapshot();assert.deepEqual(next.favorites,['TNL-002']);assert.equal(next.notes['TNL-002'],'Проверить проход');assert.deepEqual([next.timers[0].server,next.timers[0].expires],['west',5401000]);store.remove(next.timers[0].id);assert.equal(store.snapshot().timers.length,0);store.favorite('TNL-002');assert.deepEqual(store.snapshot().favorites,[]);
});
test('Invalid portal input, corrupted storage and failed writes preserve earlier data',()=>{
 const {io,store}=setup();for(const minutes of [0,-1,1.2,1441,NaN])assert.throws(()=>store.timer({server:'europe',from:'a',to:'b',minutes}));assert.throws(()=>store.note('__proto__','bad'));io.fail=true;assert.throws(()=>store.favorite('a'),/сохранить/);assert.deepEqual(store.snapshot().favorites,[]);let writes=0;assert.throws(()=>M.storage({getItem:()=>'{bad',setItem(){writes++;}}),/повреждены/);assert.equal(writes,0);
});
test('Local library imports only referenced images and survives missing/corrupt replacements',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'albion-avalon-test-')),source=path.join(root,'download','AlbionAvalonChecker','_internal','data'),userData=path.join(root,'profile');
 try {await fs.mkdir(path.join(source,'images'),{recursive:true});const png=Buffer.from('89504e470d0a1a0a00000000','hex');const zone={...raw(),image:'map.png'};await fs.writeFile(path.join(source,'avalon_zones.json'),JSON.stringify({zones:[zone]}));await fs.writeFile(path.join(source,'images','map.png'),png);await fs.writeFile(path.join(source,'images','unrelated.txt'),'leave');const library=createLibrary({userData,downloads:root});assert.equal((await library.read()).ready,false);const result=await library.importFolder(path.join(root,'download'));assert.equal(result.maps,1);const original=library.imageFile('map.png');assert.ok(original.startsWith(userData));assert.equal(library.imageFile('../map.png'),null);assert.equal(library.imageFile('unrelated.txt'),null);await fs.writeFile(path.join(source,'avalon_zones.json'),JSON.stringify({zones:[{...zone,image:'missing.png'}]}));await assert.rejects(library.importFolder(path.join(root,'download')));assert.equal((await library.read()).zones[0].image,'map.png');assert.equal(library.imageFile('map.png'),original);assert.equal((await createLibrary({userData,downloads:root}).read()).ready,true);
 } finally {if(path.dirname(root)!==os.tmpdir())throw Error('Unexpected temporary test directory');await fs.rm(root,{recursive:true,force:true});}
});
