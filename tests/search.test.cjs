const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),C=require('../dist/catalog-engine.js'),w={};vm.runInNewContext(fs.readFileSync(__dirname+'/../dist/price-catalog.js','utf8'),{window:w});
const rows=Array.from(w.PRICE_CATALOG),find=q=>rows.filter(r=>C.searchMatch(r,q)),gloves=rows.find(r=>r.id==='T5_2H_KNUCKLES_AVALON@2');
test('Ava pe finds actual Avalonian gloves by aliases and category regardless of word order',()=>{
 for(const q of ['ава пе','пе ава','ава перчи','авал перч','ава 5 2 пе','перчи т5.2 ава'])assert.ok(C.searchMatch(gloves,q),q);
 assert.deepEqual(find('ава 5 2 пе').map(r=>r.id),['T5_2H_KNUCKLES_AVALON@2']);assert.ok(!C.searchMatch(rows.find(r=>r.id==='T5_2H_FIRE_RINGPAIR_AVALON@2'),'ава пе'));assert.ok(!C.searchMatch(rows.find(r=>r.id==='T5_MAIN_SWORD@2'),'ава пе'));
});
test('Spaced tier and enchantment, decimal points, commas and Cyrillic/Latin T agree',()=>{
 const expected=find('5.2').map(r=>r.id);assert.ok(expected.length>100);for(const q of ['5 2','5,2','т5.2','T5.2','тир 5 2','t5 .2'])assert.deepEqual(find(q).map(r=>r.id),expected,q);assert.ok(find('5').every(r=>r.tier===5));assert.ok(find('.2').every(r=>r.ench===2));assert.ok(!C.searchMatch(gloves,'5.1'));assert.ok(!C.searchMatch(gloves,'5.2 6.2'));assert.ok(!C.searchMatch('Повар','.0'));
});
test('Prefixes, yo/e and a single spelling error work without fuzzy matching short abbreviations',()=>{
 assert.ok(C.searchMatch('Боевой конь','ко бо'));assert.ok(C.searchMatch('Чёрный рынок','чер рын'));assert.ok(C.searchMatch('Кошель интуиции','кош инту'));assert.ok(C.searchMatch(gloves,'авалон перчтаки'));assert.ok(C.searchMatch(gloves,'авалосн перчатки'));assert.ok(!C.searchMatch('Эксперт авалонский плащ','ава пе'));
});
test('Exact item IDs and explicit category/tier filters retain their meaning',()=>{
 assert.deepEqual(find('T5_2H_KNUCKLES_AVALON@2').map(r=>r.id),['T5_2H_KNUCKLES_AVALON@2']);assert.ok(C.matches(gloves,{main:'weapons',sub:'knuckles',search:'ава пе 5 2'}));assert.ok(!C.matches(gloves,{tier:8,search:'5 2'}));assert.ok(C.searchMatch({id:gloves.id,name:gloves.name,searchText:'Партия для Сергея'},'серг ава пе 5 2'));
});
