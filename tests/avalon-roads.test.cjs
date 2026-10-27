'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),{EventEmitter}=require('node:events');
const R=require('../dist/avalon-roads.js'),{createRoads}=require('../desktop/avalon-roads.cjs');
const M=require('../dist/avalon-model.js');
test('External exit squares use zone danger colours, independent tier borders and tier-quality labels',()=>{
 for(const [color,kind]of [['black','black'],['blue','blue'],['yellow','yellow'],['red','red'],['city-black','black'],['city','blue']]){const badge=R.exitBadge({world:'outlands',color,tier:5,quality:6});assert.equal(badge.kind,kind);assert.equal(badge.label,'5-6');assert.equal(badge.border,'#d94a4a');}
 for(const [tier,color]of [[1,'#4d91e8'],[2,'#4d91e8'],[3,'#4d91e8'],[4,'#4d91e8'],[5,'#d94a4a'],[6,'#ed963a'],[7,'#e1c342'],[8,'#ffffff']])assert.equal(R.tierColor(tier),color);assert.equal(R.exitBadge({world:'avalon',tier:6,quality:3}),null);assert.equal(R.exitBadge({world:'royal',color:'blue',tier:3,quality:null}).label,'3');
});
const zones=[{id:'a',name:'A',color:'road'},{id:'b',name:'B',color:'road'},{id:'c',name:'City',color:'blue'},{id:'p',name:'Portal',color:'city-black',zoneType:'PLAYERCITY_BLACK_PORTALCITY_NOFURNITURE'}],library={read:async()=>({zones})};
function stamp(now){const d=new Date(now);return [d.getHours(),d.getMinutes(),d.getSeconds()].map(n=>String(n).padStart(2,'0')).join(':');}
function line(now,from='A',to='B',timer='1ч 02м, conf=0.98'){return `${stamp(now)} [INFO   ] roads: ${from} → ${to} (${timer}) — отправлено\n`;}
async function temporary(fn){const root=await fs.mkdtemp(path.join(os.tmpdir(),'albion-roads-'));try{return await fn(root);}finally{assert.equal(path.dirname(root),os.tmpdir());await fs.rm(root,{recursive:true,force:true});}}
for(const degree of [3,4,5])test(`One Avalon with ${degree} portal destinations keeps every branch, independent timers and reverse scans`,async()=>temporary(async root=>{
 const hub={id:'hub',name:'Hub'},neighbors=Array.from({length:degree},(_,i)=>({id:'n'+i,name:'Neighbor '+i})),catalog={read:async()=>({zones:[hub,...neighbors]})},log=path.join(root,'_internal','albion_checker.log');await fs.mkdir(path.dirname(log));await fs.writeFile(log,'');let now=new Date(2026,9,27,12,0,0).getTime();const recorder=createRoads({userData:path.join(root,'profile'),library:catalog,now:()=>now});
 try{await recorder.start('east',path.join(root,'AlbionAvalonChecker.exe'));await fs.appendFile(log,neighbors.map((z,i)=>line(now,'Hub',z.name,`0ч ${String(15+i*10).padStart(2,'0')}м, conf=0.99`)).join(''));await recorder.poll();let state=await recorder.state();assert.equal(state.edges.length,degree);const previous=new Map(state.edges.map(e=>[R.key(e.from,e.to),e.expires]));
 now+=5000;await fs.appendFile(log,line(now,neighbors[1].name,'Hub','время ???'));await recorder.poll();state=await recorder.state();assert.equal(state.edges.length,degree);for(const e of state.edges){if(R.key(e.from,e.to)===R.key('hub','n1'))assert.equal(e.expires,null);else assert.equal(e.expires,previous.get(R.key(e.from,e.to)));}assert.equal(R.route(state.edges,'hub',['n1'],{now}),null);assert.deepEqual(R.route(state.edges,'n0',['n2'],{now}).nodes,['n0','hub','n2']);
 recorder.stop();const restored=await createRoads({userData:path.join(root,'profile'),library:catalog}).state();assert.equal(restored.edges.length,degree);await recorder.remove(state.edges.find(e=>R.key(e.from,e.to)===R.key('hub','n1')).id);assert.equal((await recorder.state()).edges.length,degree-1);
 }finally{recorder.stop();}
}));
test('Five portal branches draw in the corridor between cards, including reverse and same-column links',()=>{
 for(let i=0;i<5;i++){const a={x:110,y:55},b={x:410,y:55+90*i},geometry=R.edgeGeometry(a,b);assert.equal(geometry.minX,203);assert.equal(geometry.maxX,317);assert.ok(geometry.labelX>203&&geometry.labelX<317);assert.ok(geometry.path.startsWith('M 203 55 C '));const reverse=R.edgeGeometry(b,a);assert.equal(reverse.minX,203);assert.equal(reverse.maxX,317);}const vertical=R.edgeGeometry({x:410,y:55},{x:410,y:235});assert.ok(vertical.path.startsWith('M 410 80 C '));assert.equal(vertical.maxX,410);
});
test('Manual correction replaces the same portal pair; deleting a connection cannot resurrect old manual timers',()=>{
 let raw=null;const io={getItem:()=>raw,setItem:(k,v)=>raw=v},store=M.storage(io);store.timer({server:'europe',from:'hub',to:'a',minutes:30},1000);store.timer({server:'europe',from:'hub',to:'b',minutes:40},2000);store.timer({server:'europe',from:'a',to:'hub',minutes:50},3000);assert.equal(store.snapshot().timers.length,2);assert.equal(store.snapshot().timers.find(t=>t.to==='hub').expires,3003000);store.removePair('europe','hub','a');assert.equal(store.snapshot().timers.length,1);assert.equal(store.snapshot().timers[0].to,'b');
});
test('Manual connection deletion clears legacy duplicates in both directions and preserves other servers',()=>{
 let raw=JSON.stringify({version:1,favorites:[],notes:{},timers:[{id:'1',server:'europe',from:'hub',to:'a',expires:100000},{id:'2',server:'europe',from:'a',to:'hub',expires:200000},{id:'3',server:'west',from:'hub',to:'a',expires:300000}]});const store=M.storage({getItem:()=>raw,setItem:(k,v)=>raw=v});store.removePair('europe','a','hub');assert.deepEqual(store.snapshot().timers.map(t=>t.id),['3']);
});
test('Manual correction at the 100-connection limit succeeds and failed writes preserve the entire fanout',()=>{
 let raw=JSON.stringify({version:1,favorites:[],notes:{},timers:Array.from({length:100},(_,i)=>({id:String(i),server:'europe',from:'hub',to:'n'+i,expires:1000000}))}),fail=false;const io={getItem:()=>raw,setItem:(k,v)=>{if(fail)throw Error('disk full');raw=v;}},store=M.storage(io);store.timer({server:'europe',from:'n0',to:'hub',minutes:10},1000);assert.equal(store.snapshot().timers.length,100);const before=store.snapshot();fail=true;assert.throws(()=>store.removePair('europe','hub','n0'),/сохранить/);assert.deepEqual(store.snapshot(),before);fail=false;assert.throws(()=>store.timer({server:'europe',from:'hub',to:'extra',minutes:10},2000),/100/);assert.deepEqual(store.snapshot(),before);
});
test('Branching graphs with cycles match exhaustive shortest and widest path results',()=>{
 let seed=291;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 for(let sample=0;sample<200;sample++){const edges=[];for(let a=0;a<6;a++)for(let b=a+1;b<6;b++)if(random()<.48)edges.push({from:String(a),to:String(b),captured:1,expires:random()<.15?null:Math.floor(random()*1000)});const now=200,reserve=50,active=R.usable(edges,now,reserve),paths=[];
  function walk(node,visited,expiry){if(node==='5'){paths.push({hops:visited.length-1,expires:expiry});return;}for(const e of active){const next=e.from===node?e.to:e.to===node?e.from:null;if(next&&!visited.includes(next))walk(next,[...visited,next],Math.min(expiry,e.expires));}}walk('0',['0'],Infinity);
  for(const mode of ['shortest','lifetime']){const actual=R.route(edges,'0',['5'],{now,reserve,mode});if(!paths.length)assert.equal(actual,null);else{assert.ok(actual);assert.equal(new Set(actual.nodes).size,actual.nodes.length);assert.equal(actual.expires,Math.min(...actual.edges.map(e=>e.expires)));if(mode==='shortest')assert.equal(actual.hops,Math.min(...paths.map(p=>p.hops)));else assert.equal(actual.expires,Math.max(...paths.map(p=>p.expires)));}}
 }
});
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
