'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),{EventEmitter}=require('node:events');
const R=require('../dist/avalon-roads.js'),{createRoads}=require('../desktop/avalon-roads.cjs'),{createOriginal}=require('../desktop/avalon-original.cjs');
const zones=[{id:'a',name:'A',color:'road'},{id:'b',name:'B',color:'road'},{id:'c',name:'City',color:'blue'},{id:'p',name:'Portal',color:'city-black',zoneType:'PLAYERCITY_BLACK_PORTALCITY_NOFURNITURE'}],library={read:async()=>({zones})};
function stamp(now){const d=new Date(now);return [d.getHours(),d.getMinutes(),d.getSeconds()].map(n=>String(n).padStart(2,'0')).join(':');}
function line(now,from='A',to='B',timer='1ч 02м, conf=0.98'){return `${stamp(now)} [INFO   ] roads: ${from} → ${to} (${timer}) — отправлено\n`;}
async function temporary(fn){const root=await fs.mkdtemp(path.join(os.tmpdir(),'albion-roads-'));try{return await fn(root);}finally{assert.equal(path.dirname(root),os.tmpdir());await fs.rm(root,{recursive:true,force:true});}}
test('Checker log parsing rounds conservatively, rejects stale/debug lines and handles midnight',()=>{
 const now=new Date(2026,9,27,0,0,10).getTime(),record=R.parse(line(now-20000).trim(),now);assert.equal(record.captured,now-20000);assert.equal(record.expires,record.captured+62*60000);assert.equal(R.parse(line(now,'A','B','время ???').trim(),now).expires,null);
 for(const text of [line(now-180000),line(now).replace('INFO','DEBUG'),line(now,'A','A'),line(now,'A','B','1ч 65м, conf=0.99'),line(now,'A','B','25ч 00м, conf=0.99')])assert.equal(R.parse(text.trim(),now),null);
});
test('Routes exclude expired/unknown portals, are bidirectional and use the earliest expiry',()=>{
 const e=(from,to,expires,captured=1)=>({from,to,expires,captured}),edges=[e('a','c',300),e('a','b',900),e('b','c',800),e('c','d',null),e('c','e',90)];
 assert.deepEqual(R.route(edges,'a',['c'],{now:100}).nodes,['a','c']);const best=R.route(edges,'c',['a'],{now:100,mode:'lifetime'});assert.deepEqual(best.nodes,['c','b','a']);assert.equal(best.expires,800);assert.equal(R.route(edges,'a',['d'],{now:100}),null);assert.equal(R.route(edges,'a',['e'],{now:100}),null);assert.equal(R.route(edges,'a',['c'],{now:100,reserve:750}),null);
 assert.equal(R.route([...edges,e('c','a',null,2)],'a',['c'],{now:100}).hops,2);assert.equal(R.classify(zones[2]),'safe');assert.equal(R.classify(zones[3]),'portal');assert.equal(R.classify({world:'city',color:'city-black'}),'other');assert.equal(R.classify({world:'royal',color:'red'}),'other');
});
test('An incoming scan supersedes manual input made within the same log timestamp second',()=>{
 const manual={from:'a',to:'b',captured:10500,expires:60000},scan={from:'a',to:'b',captured:10000,observed:10800,expires:30000};assert.equal(R.merge([scan,manual])[0].expires,30000);assert.equal(R.merge([scan,{...manual,captured:11000}])[0].expires,60000);
});
test('Recorder reads only new complete UTF8 lines, deduplicates observations and pins server through persistence',async()=>temporary(async root=>{
 const exe=path.join(root,'checker','AlbionAvalonChecker.exe'),log=path.join(root,'checker','_internal','albion_checker.log');await fs.mkdir(path.dirname(log),{recursive:true});let now=new Date(2026,9,27,14,0,0).getTime();await fs.writeFile(log,line(now));const recorder=createRoads({userData:path.join(root,'profile'),library,now:()=>now});
 try{await recorder.start('europe',exe);await recorder.poll();assert.equal((await recorder.state()).edges.length,0);const bytes=Buffer.from(line(now));await fs.appendFile(log,bytes.subarray(0,bytes.length-8));await recorder.poll();assert.equal((await recorder.state()).edges.length,0);await fs.appendFile(log,bytes.subarray(bytes.length-8));await recorder.poll();assert.equal((await recorder.state()).edges.length,1);await fs.appendFile(log,line(now));await recorder.poll();assert.equal((await recorder.state()).session.count,1);
 now+=2000;await fs.appendFile(log,line(now,'B','A','время ???'));await recorder.poll();let state=await recorder.state();assert.equal(state.edges.length,1);assert.equal(state.edges[0].expires,null);assert.equal(state.edges[0].server,'europe');await recorder.mark('europe','b','p');await assert.rejects(recorder.mark('europe','b','c'));recorder.stop();
 const restored=createRoads({userData:path.join(root,'profile'),library});state=await restored.state();assert.equal(state.session,null);assert.equal(state.edges.length,1);assert.equal(state.marks['europe:b'],'p');
 await recorder.start('west',exe);now+=2000;await fs.appendFile(log,line(now));await recorder.poll();assert.deepEqual(new Set((await recorder.state()).edges.map(e=>e.server)),new Set(['europe','west']));await fs.writeFile(log,line(now,'A','City'));await recorder.poll();assert.equal((await recorder.state()).edges.length,2);
 }finally{recorder.stop();}
}));
test('Recorder handles a new log after starting and preserves corrupt persisted data',async()=>temporary(async root=>{
 let now=Date.now();const log=path.join(root,'_internal','albion_checker.log'),profile=path.join(root,'profile'),recorder=createRoads({userData:profile,library,now:()=>now});await fs.mkdir(path.dirname(log));
 try{await recorder.start('east',path.join(root,'AlbionAvalonChecker.exe'));await fs.writeFile(log,line(now,'A','City'));await recorder.poll();assert.equal((await recorder.state()).edges.length,1);await recorder.remove((await recorder.state()).edges[0].id);assert.equal((await recorder.state()).edges.length,0);}finally{recorder.stop();}
 await fs.writeFile(path.join(profile,'avalon-roads.json'),'{bad');const broken=createRoads({userData:profile,library});await assert.rejects(broken.state(),/оставлен/);assert.equal(await fs.readFile(path.join(profile,'avalon-roads.json'),'utf8'),'{bad');
}));
test('Concurrent session starts cannot reassign a recording to another server',async()=>temporary(async root=>{
 const recorder=createRoads({userData:root,library});try{const result=await Promise.allSettled([recorder.start('europe',path.join(root,'AlbionAvalonChecker.exe')),recorder.start('west',path.join(root,'AlbionAvalonChecker.exe'))]);assert.equal(result.filter(r=>r.status==='fulfilled').length,1);assert.equal((await recorder.state()).session.server,'europe');}finally{recorder.stop();}
}));
test('Full Checker manager validates the complete runtime, avoids duplicates and preserves external ownership',async()=>temporary(async root=>{
 const exe=path.join(root,'AlbionAvalonChecker.exe');await fs.writeFile(exe,Buffer.concat([Buffer.from('MZ'),Buffer.alloc(1200)]));for(const f of ['python312.dll','data/avalon_zones.json','data/timer_ctc.onnx','data/timer_templates.npz']){const dest=path.join(root,'_internal',f);await fs.mkdir(path.dirname(dest),{recursive:true});await fs.writeFile(dest,'fixture');}
 const realExe=await fs.realpath(exe);let processes=[],spawnCount=0,focusCount=0,child;
 const manager=createOriginal({userData:path.join(root,'profile'),downloads:root,probe:async()=>processes,focus:async()=>{focusCount++;},spawnProcess:(file,args,options)=>{assert.equal(file,realExe);assert.equal(options.shell,false);assert.equal(options.windowsHide,true);assert.deepEqual(args,[]);spawnCount++;child=new EventEmitter();child.pid=123;child.unref=()=>{};child.kill=()=>{setImmediate(()=>child.emit('exit',0));return true;};setImmediate(()=>child.emit('spawn'));return child;}});
 await manager.connect(exe);await manager.start();assert.equal((await manager.status()).owned,true);await manager.start();assert.equal(spawnCount,1);assert.equal(focusCount,1);await manager.stop();processes=[{pid:456}];await manager.start();assert.equal((await manager.status(true)).owned,false);assert.equal(focusCount,2);await assert.rejects(manager.stop(),/отдельно/);assert.equal(spawnCount,1);
 await fs.unlink(path.join(root,'_internal/data/timer_ctc.onnx'));assert.equal((await manager.status(true)).available,false);
}));
