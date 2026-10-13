const {test}=require('node:test'),assert=require('node:assert/strict'),E=require('../dist/server-economy.js');
const now=Date.parse('2026-10-13T09:30:00Z'),row=(id,value,age=0)=>({serverId:id,globalMultiplier:value,updatedAt:new Date(now-age).toISOString()});
test('Automatic source maps actual numeric IDs to Americas, Asia and Europe and rejects invalid or stale records',()=>{
 const r=E.parse([row(0,1.156),row(1,1.154),row(2,1.156),row(2,1.2,10000),row(4,1.3),row(1,-1),row(1,'1.156'),row(2,1.8,-3600000),row(0,2,49*3600000)],now);assert.equal(r.west.value,1.156);assert.equal(r.east.value,1.154);assert.equal(r.europe.value,1.156);assert.equal(Object.keys(r).length,3);
});
test('Concurrent price refreshes make one request; successful quotes persist with their server',async()=>{
 let calls=0,release,stored;const storage={getItem:()=>stored,setItem:(k,v)=>stored=v},s=E.create({clock:()=>now,storage,fetcher:async()=>{calls++;await new Promise(r=>release=r);return {ok:true,json:async()=>[row(0,1.2),row(1,1.3),row(2,1.156)]};}});const a=s.refresh(true),b=s.refresh(true);assert.equal(calls,1);release();await Promise.all([a,b]);assert.equal(s.quote('europe').value,1.156);assert.equal(s.quote('west').value,1.2);const reloaded=E.create({clock:()=>now,storage,fetcher:()=>{throw Error();}});assert.equal(reloaded.quote('europe').value,1.156);
});
test('An old response cannot overwrite a newer quote, and failures never invent a default multiplier',async()=>{
 let time=now,result=[row(2,1.156)],fail=false;const s=E.create({clock:()=>time,fetcher:async()=>{if(fail)throw Error('offline');return {ok:true,json:async()=>result};}});await s.refresh();result=[row(2,1.1,1000)];await s.refresh(true);assert.equal(s.quote('europe').value,1.156);fail=true;await s.refresh(true);assert.equal(s.quote('europe').value,1.156);assert.ok(s.status().error);time+=7*3600000;assert.equal(s.quote('europe'),null);assert.equal(s.quote('east'),null);
});
