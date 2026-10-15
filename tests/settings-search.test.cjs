'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),M=require('../dist/settings-search-model.js');
const records=[{id:'tax',label:'Налог продажи, %',aliases:'налоги',hint:'Дополнительные настройки'},{id:'setup',label:'Комиссия ордера, %',aliases:'выставление постановка',hint:'Продажа'},{id:'focus',label:'Бюджет фокуса',aliases:'фокус очки',hint:'Производство'},{id:'buffer',label:'Запас материалов',aliases:'резерв закупка',hint:'Дополнительные настройки'},{id:'rrr',label:'Возврат ресурсов, %',aliases:'ррр возврат',hint:'Производство'}];
test('Settings search normalizes case, punctuation and yo without indexing values',()=>{
 assert.equal(M.normalize('  ОБЪЁМ, % '),'объем');assert.equal(M.search(records,'НАЛОГ %')[0].id,'tax');assert.equal(M.search(records,'30000').length,0);assert.equal(M.search(records,'Бюджет фокуса')[0].id,'focus');
});
test('Aliases and words in any order locate the intended parameter',()=>{
 for(const [query,id]of [['налоги','tax'],['постановка','setup'],['фокус бюджет','focus'],['резерв','buffer'],['ррр','rrr']])assert.equal(M.search(records,query)[0].id,id);
 assert.equal(M.search(records,'несуществующий параметр').length,0);
});
test('A typo or adjacent transposition is tolerated without fuzzy short queries',()=>{
 for(const query of ['фоксу','фокусаа','фокса'])assert.equal(M.search(records,query)[0].id,'focus');assert.equal(M.search(records,'ялг').length,0);
});
test('Direct names rank ahead of context and results retain stable targets',()=>{
 const all=[...records,{id:'other',label:'Ставка',hint:'Налог продажи'}],before=JSON.stringify(all);assert.equal(M.search(all,'налог')[0].id,'tax');assert.deepEqual(M.search(all,'').map(r=>r.id),all.map(r=>r.id));assert.equal(JSON.stringify(all),before);assert.equal(M.search(all,'налог неизвестно').length,0);
});
