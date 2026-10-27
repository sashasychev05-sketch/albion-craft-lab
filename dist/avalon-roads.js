(function(root){'use strict';
const servers=['europe','west','east'];
const key=(a,b)=>[a,b].sort().join('\0');
function classify(z){if(z?.color==='blue'||z?.color==='yellow'||z?.color==='city')return 'safe';if(z?.zoneType?.includes('PORTALCITY'))return 'portal';return 'other';}
const tierColor=tier=>({5:'#d94a4a',6:'#ed963a',7:'#e1c342',8:'#ffffff'}[tier]||'#4d91e8');
function exitBadge(z){
 if(!z||z.world?.startsWith('avalon'))return null;
 const kind=({black:'black','city-black':'black',blue:'blue',city:'blue',yellow:'yellow',red:'red'}[z.color])||({outlands:'black',royal:'blue',yellow:'yellow',red:'red'}[z.world])||'unknown';
 const fill={black:'#15191f',blue:'#2768ad',yellow:'#d8b72e',red:'#a93839',unknown:'#657084'}[kind];
 return {kind,fill,ink:kind==='yellow'?'#1d252a':'#ffffff',label:String(z.tier)+(z.quality==null?'':'-'+z.quality),border:tierColor(z.tier)};
}
// The log has local time only. Accept new records near the observation time,
// including midnight, never interpret an old log as a fresh scan.
function parse(line,received=Date.now()){
 const m=String(line).match(/^(\d{2}):(\d{2}):(\d{2})\s+\[INFO\s*\]\s+roads:\s+(.{1,100}?) → (.{1,100}?) \((?:(\d{1,2})ч (\d{2})м, conf=[0-9.]+|время \?\?\?)\) — отправлено\s*$/u);
 if(!m||+m[1]>23||+m[2]>59||+m[3]>59||m[4]===m[5]||m[7]&&+m[7]>59)return null;
 const date=new Date(received);date.setHours(+m[1],+m[2],+m[3],0);const candidates=[date.getTime(),date.getTime()-86400000,date.getTime()+86400000].sort((a,b)=>Math.abs(a-received)-Math.abs(b-received)),captured=candidates[0];
 if(Math.abs(captured-received)>120000)return null;
 const minutes=m[6]===undefined?null:+m[6]*60 + +m[7];if(minutes!==null&&(minutes<0||minutes>1440))return null;
 return {fromName:m[4],toName:m[5],captured,expires:minutes===null?null:captured+minutes*60000};
}
function merge(edges){const result=new Map();for(const edge of edges){const k=key(edge.from,edge.to),old=result.get(k),at=edge.observed??edge.captured,previous=old&&(old.observed??old.captured);if(!old||at>previous||at===previous&&edge.expires!==null)result.set(k,edge);}return [...result.values()];}
function usable(edges,now,reserve=0){return merge(edges).filter(e=>Number.isFinite(e.expires)&&e.expires>now+reserve);}
function edgeGeometry(a,b){
 if(Math.abs(a.x-b.x)<186&&Math.abs(a.y-b.y)>60){const direction=Math.sign(b.y-a.y),start=a.y+25*direction,end=b.y-25*direction,middle=(start+end)/2;return {path:`M ${a.x} ${start} C ${a.x} ${middle} ${b.x} ${middle} ${b.x} ${end}`,labelX:(a.x+b.x)/2+10,labelY:middle-8,minX:Math.min(a.x,b.x),maxX:Math.max(a.x,b.x)};}
 const direction=Math.sign(b.x-a.x),start=a.x+93*direction,end=b.x-93*direction,middle=(start+end)/2;
 return {path:`M ${start} ${a.y} C ${middle} ${a.y} ${middle} ${b.y} ${end} ${b.y}`,labelX:middle,labelY:(a.y+b.y)/2-8,minX:Math.min(start,end),maxX:Math.max(start,end)};
}
// Widest path maximises the earliest closing portal; BFS minimises transitions.
function route(edges,start,targets,{now=Date.now(),reserve=0,mode='shortest'}={}){
 const goals=new Set(targets),adj=new Map();for(const e of usable(edges,now,reserve)){for(const [a,b]of [[e.from,e.to],[e.to,e.from]]){if(!adj.has(a))adj.set(a,[]);adj.get(a).push({node:b,edge:e});}}
 if(!start||!goals.size)return null;const best=new Map([[start,{expires:Infinity,hops:0}]]),previous=new Map(),open=[start],done=new Set();
 while(open.length){open.sort((a,b)=>mode==='lifetime'?best.get(b).expires-best.get(a).expires||best.get(a).hops-best.get(b).hops:best.get(a).hops-best.get(b).hops||best.get(b).expires-best.get(a).expires);const node=open.shift();if(done.has(node))continue;done.add(node);
  if(goals.has(node)){const nodes=[node],path=[];let cur=node;while(previous.has(cur)){const p=previous.get(cur);path.unshift(p.edge);nodes.unshift(p.node);cur=p.node;}return {nodes,edges:path,expires:path.length?Math.min(...path.map(e=>e.expires)):null,hops:path.length};}
  for(const next of adj.get(node)||[]){if(done.has(next.node))continue;const candidate={expires:Math.min(best.get(node).expires,next.edge.expires),hops:best.get(node).hops+1},old=best.get(next.node),better=!old||(mode==='lifetime'?candidate.expires>old.expires||candidate.expires===old.expires&&candidate.hops<old.hops:candidate.hops<old.hops||candidate.hops===old.hops&&candidate.expires>old.expires);if(better){best.set(next.node,candidate);previous.set(next.node,{node,edge:next.edge});open.push(next.node);}}
 }return null;
}
// Search simple loops from the chosen start. Bound the work on dense graphs.
function cycles(edges,start,zones,{now=Date.now(),reserve=0,feature='gold',minimum=3,maxHops=8,limit=50000}={}){
 const catalog=new Map(zones.map(z=>[z.id,z])),adj=new Map();
 for(const e of usable(edges,now,reserve))for(const [a,b] of [[e.from,e.to],[e.to,e.from]]){if(!adj.has(a))adj.set(a,[]);adj.get(a).push({node:b,edge:e});}
 for(const neighbors of adj.values())neighbors.sort((a,b)=>a.node.localeCompare(b.node));
 function score(id){const z=catalog.get(id);if(!z)return 0;if(feature==='gold')return (z.chests||[]).filter(c=>c.type==='AVALONIAN'||c.type==='BIG_AVALONIAN').reduce((n,c)=>n+c.count,0);if(feature==='blue')return (z.chests||[]).filter(c=>c.type==='GROUP').reduce((n,c)=>n+c.count,0);if(feature==='t8')return z.world?.startsWith('avalon')&&z.tier===8?1:0;if(feature.startsWith('resource:'))return (z.resources||[]).some(r=>r.type===feature.slice(9))?1:0;return 0;}
 const found=[],seen=new Set([start]),nodes=[start],path=[];let steps=0,truncated=false;
 function walk(id,total){if(truncated)return;for(const next of adj.get(id)||[]){if(++steps>limit){truncated=true;return;}if(next.node===start&&nodes.length>=3){if(total>=minimum&&nodes[1]<id){const resultEdges=[...path,next.edge];found.push({nodes:[...nodes,start],edges:resultEdges,hops:resultEdges.length,score:total,expires:Math.min(...resultEdges.map(e=>e.expires))});}continue;}if(nodes.length>=maxHops||seen.has(next.node))continue;seen.add(next.node);nodes.push(next.node);path.push(next.edge);walk(next.node,total+score(next.node));path.pop();nodes.pop();seen.delete(next.node);if(truncated)return;}}
 if(start&&maxHops>=3)walk(start,score(start));found.sort((a,b)=>a.hops-b.hops||b.score-a.score||b.expires-a.expires||a.nodes.join('\0').localeCompare(b.nodes.join('\0')));return {results:found.slice(0,10),truncated};
}
// Deterministic force layout: repulsion, link attraction and collision spacing.
function layout(ids,edges){
 const ordered=[...ids].sort(),positions=new Map(),n=ordered.length,cols=Math.max(2,Math.ceil(Math.sqrt(n*1.7))),index=new Map(ordered.map((id,i)=>[id,i]));
 ordered.forEach((id,i)=>{if(n<=8){const angle=2*Math.PI*i/Math.max(n,1);positions.set(id,{x:300+190*Math.cos(angle),y:260+190*Math.sin(angle)});}else positions.set(id,{x:130+(i%cols)*260,y:75+Math.floor(i/cols)*155+(i%2)*65});});
 const links=edges.filter(e=>index.has(e.from)&&index.has(e.to));
 for(let iteration=0;iteration<130;iteration++){const forces=ordered.map(()=>({x:0,y:0}));for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){const a=positions.get(ordered[i]),b=positions.get(ordered[j]);let dx=b.x-a.x,dy=b.y-a.y,d=Math.max(1,Math.hypot(dx,dy));const repel=13000/(d*d),overlap=Math.max(0,220-Math.abs(dx))*Math.max(0,90-Math.abs(dy))/180;const f=Math.min(25,repel+overlap);forces[i].x-=dx/d*f;forces[i].y-=dy/d*f;forces[j].x+=dx/d*f;forces[j].y+=dy/d*f;}
  for(const e of links){const i=index.get(e.from),j=index.get(e.to),a=positions.get(e.from),b=positions.get(e.to),dx=b.x-a.x,dy=b.y-a.y,d=Math.max(1,Math.hypot(dx,dy)),f=Math.max(-8,Math.min(8,(d-260)*.025));forces[i].x+=dx/d*f;forces[i].y+=dy/d*f;forces[j].x-=dx/d*f;forces[j].y-=dy/d*f;}
  const step=1-iteration/150;ordered.forEach((id,i)=>{const p=positions.get(id),f=forces[i];p.x+=Math.max(-18,Math.min(18,f.x))*step;p.y+=Math.max(-18,Math.min(18,f.y))*step;});}
 if(n){const minX=Math.min(...[...positions.values()].map(p=>p.x)),minY=Math.min(...[...positions.values()].map(p=>p.y));for(const p of positions.values()){p.x=Math.round(p.x-minX+130);p.y=Math.round(p.y-minY+70);}}return positions;
}
const api={servers,key,parse,merge,usable,route,cycles,layout,classify,edgeGeometry,tierColor,exitBadge};root.AvalonRoads=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
