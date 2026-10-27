(function(root){'use strict';
const servers=['europe','west','east'];
const key=(a,b)=>[a,b].sort().join('\0');
function classify(z){if(z?.color==='blue'||z?.color==='yellow'||z?.color==='city')return 'safe';if(z?.zoneType?.includes('PORTALCITY'))return 'portal';return 'other';}
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
 if(a.x===b.x){const x=a.x+93,c=x+90;return {path:`M ${x} ${a.y} C ${c} ${a.y} ${c} ${b.y} ${x} ${b.y}`,labelX:x+70,labelY:(a.y+b.y)/2-8,minX:x,maxX:c};}
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
const api={servers,key,parse,merge,usable,route,classify,edgeGeometry};root.AvalonRoads=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
