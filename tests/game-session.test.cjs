const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {SessionDatabase}=require('../desktop/session-database.cjs');
const start=Date.parse('2026-10-30T10:00:00Z'),date=offset=>new Date(start+offset).toISOString();
function session(id='s1',character='Alice',server='Europe'){return {id:'session:'+id,sessionId:id,kind:'session',time:date(0),data:{id,characterName:character,serverLocation:server,startedAtUtc:date(0),endedAtUtc:date(120000)}};}
function stat(id,value=100,sid='s1',metric='Fame'){return {id,sessionId:sid,kind:'stat',time:date(1000),data:{entry:{valueType:metric,value}}};}
function fixture(fn){const folder=fs.mkdtempSync(path.join(os.tmpdir(),'game-session-')),db=new SessionDatabase(path.join(folder,'sessions.sqlite3'));try{return fn(db,folder);}finally{db.close();assert.ok(path.resolve(folder).startsWith(path.resolve(os.tmpdir())+path.sep));fs.rmSync(folder,{recursive:true,force:true});}}
test('portal HUD uses fresh same-server context and the latest combat ID',()=>fixture(db=>{
 const active=session();active.data.endedAtUtc=null;
 const combat=(id,fight,offset,value,local=true)=>({id,sessionId:'s1',kind:'combat',time:date(offset),data:{combatId:fight,sourceLocal:local,metric:'Damage',value}});
 db.ingest([active,stat('fame',900),{id:'ctx',kind:'context',sessionId:'s1',time:date(1000),data:{server:'Europe',inGame:true}},combat('a','old',3000,500),combat('b','current',27000,40),combat('c','current',119000,60),combat('d','current',119001,99,false)]);
 const scope={server:'europe',captureStartedAt:start};
 assert.deepEqual(db.hud(scope,start+120000),{fame:27000,fight:100,damage:600,silver:0});
 assert.equal(db.hud(scope,start+150000).fight,null);
 assert.equal(db.hud({...scope,server:'west'},start+120000),null);
 assert.equal(db.hud({...scope,captureStartedAt:start+5000},start+120000),null);
}));
test('daily activity separates quotes from cash, scopes city visits and keeps repeated imports idempotent',()=>fixture(db=>{
 const trade={id:'trade-1',kind:'trade',sessionId:'s1',time:date(1000),data:{item:'Sword',source:'InstantSell',city:'Lymhurst',income:100,expense:0,tax:4}};
 db.ingest([session(),trade,stat('repair',7,'s1','RepairCosts'),{id:'visit',kind:'location',sessionId:'s1',time:date(10),data:{name:'Lymhurst'}}]);db.ingest([trade]);
 const row={at:start+500,server:'europe',kind:'saved',city:'Lymhurst',item:'T4_WOOD',quality:1,side:'sell',price:300};
 db.logActivity([row,row,{...row,kind:'order'},{...row,server:'west'}]);
 assert.deepEqual(db.priceHistory(row),[{at:row.at,price:300}].map(x=>Object.assign(Object.create(null),x)));
 const report=db.activityReport({start,end:start+2000,server:'europe'});
 assert.deepEqual(report.totals,{income:100,expense:7,tax:4,net:89});assert.equal(report.events.length,5);assert.equal(report.events[0].kind,'location');
 const t=db.summary({sessionId:'s1'}).timeline.at(-1);assert.equal(t.income-t.expense,89);
}));
test('daily gathering counts own recorded yields once and isolates day, character and server',()=>fixture(db=>{
 const gathered=(id,offset,sid)=>({id,kind:'gather',time:date(offset),sessionId:sid,data:{item:'T5_ORE',standard:3,bonus:1,premium:2}});
 const first=gathered('one',0,'s1');
 db.ingest([session(),session('s2','Other','Europe'),session('s3','Alice','America'),first,gathered('two',500,'s1'),gathered('boundary',2000,'s1'),gathered('other',500,'s2'),gathered('west',500,'s3'),stat('might',4.5,'s1','Might')]);db.ingest([first]);
 const daily=db.dailyGathering({start,end:start+2000,character:'Alice',server:'europe'});
 assert.deepEqual({...daily.resources[0]},{item:'T5_ORE',actions:2,standard:6,bonus:2,premium:4});
 assert.equal(daily.might,4.5);assert.equal(daily.favor,0);
 assert.equal(db.activityReport({start,end:start+2000,server:'europe'}).gathering.resources[0].actions,3);
}));
test('replayed events and updated entries do not double session or global totals',()=>fixture(db=>{
 db.ingest([session(),stat('a')]);db.ingest([stat('a')]);assert.equal(db.summary({},start+120000).metrics.Fame,100);
 db.ingest([{...stat('a',150),updatedAtUtc:date(3000)}]);assert.equal(db.summary().metrics.Fame,150);
 db.ingest([stat('a',75)]);assert.equal(db.summary().metrics.Fame,150);
 db.ingest([{...stat('a',40),data:{...stat('a',40).data,historical:true},updatedAtUtc:date(5000)}]);assert.equal(db.summary().metrics.Fame,150);
 assert.equal(db.summary().timeline[0].fame,150);
}));
test('characters and servers stay separate while global totals combine sessions',()=>fixture(db=>{
 db.ingest([session(),session('s2','Alice','America'),session('s3','Bob','Europe'),stat('a',100),stat('b',200,'s2'),stat('c',400,'s3')]);
 assert.equal(db.summary({character:'Alice',server:'europe'}).metrics.Fame,100);
 assert.equal(db.summary({character:'Alice'}).metrics.Fame,300);
 assert.equal(db.summary().metrics.Fame,700);assert.equal(db.summary().sessionCount,3);
}));
test('damage and healing distinguish the local player from party contribution and received damage',()=>fixture(db=>{
 const combat=(id,metric,value,sourceLocal,targetLocal)=>({id,kind:'combat',sessionId:'s1',time:date(115000),data:{metric,value,sourceLocal,targetLocal}});
 db.ingest([session(),combat('a','Damage',250,true,false),combat('b','Damage',900,false,false),combat('c','TakenDamage',70,false,true),combat('d','Heal',80,true,true),combat('e','Overheal',40,true,false)]);
 const x=db.summary({},start+120000);assert.equal(x.metrics.localDamage,250);assert.equal(x.metrics.partyDamage,1150);assert.equal(x.metrics.localTakenDamage,70);assert.equal(x.metrics.localHeal,80);assert.equal(x.metrics.localHealingReceived,80);assert.equal(x.metrics.localOverheal,40);assert.equal(x.dps10,25);assert.equal(x.hps10,8);
 assert.equal(db.summary({},start+140000).dps10,0);
}));
test('journal importer commits complete UTF-8 lines only and resumes after a partial write',()=>fixture((db,folder)=>{
 const file=path.join(folder,'events-run.jsonl'),line=JSON.stringify(session('s1','Александр'))+'\n',second=JSON.stringify(stat('a',310));
 fs.writeFileSync(file,line+second.slice(0,20));db.importJournal(file);assert.equal(db.summary().sessions[0].character,'Александр');assert.equal(db.summary().metrics.Fame,undefined);
 fs.appendFileSync(file,second.slice(20)+'\n');db.importJournal(file);db.importJournal(file);assert.equal(db.summary().metrics.Fame,310);
 fs.writeFileSync(file,line+second+'\n');db.importJournal(file);assert.equal(db.summary().metrics.Fame,310);
}));
test('invalid import rolls back records and cursor together',()=>fixture(db=>{
 assert.throws(()=>db.ingest([session(),stat('a'),{...stat('bad'),time:'invalid'}],{file:'x',position:300}));
 assert.equal(db.summary().sessionCount,0);assert.equal(db.db.prepare('SELECT COUNT(*) AS count FROM cursors').get().count,0);
}));
test('an older session snapshot cannot reopen a completed session',()=>fixture(db=>{
 db.ingest([{...session(),updatedAtUtc:date(120000)}]);
 db.ingest([{...session(),time:date(0),data:{...session().data,endedAtUtc:null}}]);
 assert.equal(db.summary({},start+99999999).durationSeconds,120);
}));
test('item quantities, quality, identifiers and original event details remain available',()=>fixture(db=>{
 const record=stat('loot',500,'s1','LootValue');record.data.entry.itemIndex=123;record.data.entry.itemQuantity=4;record.data.entry.itemQuality='Excellent';record.data.item={id:'T6_BAG@2',name:'Сумка'};
 db.ingest([session(),record]);const x=db.summary();assert.equal(x.metrics.LootValue,500);assert.deepEqual(x.events[0].data.item,record.data.item);assert.equal(x.events[0].data.entry.itemQuantity,4);
}));

test('journal import skips malformed and invalid complete records and resumes after the cursor',()=>fixture((db,folder)=>{
 const file=path.join(folder,'events-recovery.jsonl'),encode=value=>JSON.stringify(value)+'\n';
 fs.writeFileSync(file,encode(session())+encode(stat('first'))+'{invalid\n'+encode({...stat('invalid'),time:'bad'})+encode(stat('later')));
 const invalid=[];
 db.importJournal(file,undefined,count=>invalid.push(count));
 assert.deepEqual(invalid,[2]);
 assert.deepEqual(db.summary({}).events.map(event=>event.id).sort(),['first','later']);
 assert.equal(db.importJournal(file,undefined,count=>invalid.push(count)),0);
 assert.deepEqual(invalid,[2]);
}));
