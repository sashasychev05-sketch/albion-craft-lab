'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),window={};vm.runInNewContext(fs.readFileSync(path.join(root,'dist/item-icon-manifest.js'),'utf8'),{window});vm.runInNewContext(fs.readFileSync(path.join(root,'dist/item-icons.js'),'utf8'),{window});
test('Every bundled item has local image coverage and every atlas is a verified WebP file',()=>{
 const atlas=window.ITEM_ICON_ATLAS;assert.equal(Object.keys(atlas.items).length,10490);assert.equal(atlas.files.length,158);for(const file of atlas.files){assert.match(file,/^assets\/item-icons\/[a-f0-9]{20}\.webp$/);const data=fs.readFileSync(path.join(root,'dist',file));assert.equal(data.subarray(0,4).toString(),'RIFF');assert.equal(data.subarray(8,12).toString(),'WEBP');assert.equal(path.basename(file,'.webp'),crypto.createHash('sha256').update(data).digest('hex').slice(0,20));}
 for(const [id,entry]of Object.entries(atlas.items)){assert.ok(entry[0]>=0&&entry[0]<atlas.files.length,id);assert.ok(entry[1]>=0&&entry[1]<64,id);assert.equal(window.ItemIcons.source(id).placeholder,false);}
});
test('Public catalog icons resolve without any HTTP URL, including missing upstream art',()=>{
 vm.runInNewContext(fs.readFileSync(path.join(root,'dist/price-catalog.js'),'utf8'),{window});for(const item of window.PRICE_CATALOG){const icon=window.ItemIcons.source(item.id);assert.match(icon.url,/^assets\/item-icons\//,item.id);assert.ok(fs.existsSync(path.join(root,'dist',icon.url)),item.id);assert.ok(Object.hasOwn(window.ITEM_ICON_ATLAS.items,item.id)||Object.hasOwn(window.ITEM_ICON_ATLAS.fallbacks,item.id),item.id);}
});
test('Local icons safely handle unknown IDs, quality, enchantment and every displayed size',()=>{
 for(const id of ['T4_FIBER','T8_2H_SHAPESHIFTER_AVALON@4','ENERGY','constructor','__proto__','<img onerror=bad>'])for(const q of [1,2,3,4,5,NaN]){const html=window.ItemIcons.image(id,q,36);assert.ok(!html.includes('https:'));assert.ok(!html.includes('<img'));assert.match(html,/width:36px;height:36px/);assert.match(window.ItemIcons.source(id).url,/^assets\/item-icons\//);}
 assert.equal(window.ItemIcons.source('constructor').url,'assets/item-icons/unknown.svg');assert.equal(window.ItemIcons.source('ENERGY').url,'assets/item-icons/energy.svg');
});
test('Application and mini-window load icon manifests before their renderer; network artwork is disallowed',()=>{
 for(const file of ['index.html','shopping-mini.html']){const html=fs.readFileSync(path.join(root,'dist',file),'utf8');assert.ok(html.indexOf('item-icon-manifest.js')<html.indexOf('item-icons.js'));assert.ok(html.includes('item-icons.css'));}
 const main=fs.readFileSync(path.join(root,'desktop/main.cjs'),'utf8');assert.ok(!main.includes('render.albiononline.com'));assert.ok(!fs.readFileSync(path.join(root,'dist/item-icons.js'),'utf8').includes('fetch('));
});
