(function(root){'use strict';
const num=x=>Math.max(0,Number(x)||0);
function refining(r,out,q,cfg,data,quote){
 if(r.kind!=='refine')return null;
 const heart=data.refineHearts?.[r.id],mode=cfg.heartMode||'standard';
 const cost=mats=>{let missing=false;const cost=mats.reduce((s,m)=>{const price=num(quote(m.id,m).price);missing ||= !price;return s+Math.ceil(out/r.output*m.n*(m.returns?q:1)*(1+num(cfg.buffer)/100)-1e-9)*price},0);return {cost,missing}};
 const standard=cost(r.mats),alternative=heart?cost(heart.mats):null;
 const useHeart=!!heart&&(mode==='heart'||mode==='auto'&&!alternative.missing&&(standard.missing||alternative.cost<standard.cost));
 return {id:r.id,amount:out,mode,method:useHeart?'heart':'standard',standard,heart:alternative,mats:useHeart?heart.mats:r.mats,marketIds:[...new Set([...r.mats,...(heart?.mats||[])].map(m=>m.id))]};
}
// Real transmutation edges form a directed graph. Each step is a whole operation;
// demand is expanded backwards, so any rounding affects every previous step.
function ancestors(target,data){const seen=new Set([target]);function visit(id){for(const e of data.transmutations.filter(e=>e.to===id))if(!seen.has(e.from)){seen.add(e.from);visit(e.from)}}visit(target);return [...seen]}
function conversion(source,target,quantity,data,pricing={}){
 const n=Math.floor(num(quantity));if(!n)return null;
 const multiplier=pricing.multiplier===undefined?1:Number(pricing.multiplier),station=num(pricing.station),multiplierReady=Number.isFinite(multiplier)&&multiplier>0;
 function solve(id,demand,seen){if(id===source)return {sourceCount:demand,silver:0,steps:[]};if(seen.has(id))return null;
  const next=new Set(seen);next.add(id);let best=null;
  for(const e of data.transmutations.filter(e=>e.to===id)){const ops=Math.ceil(demand/e.output-1e-9),prior=solve(e.from,ops*e.count,next);if(!prior)continue;const itemValue=Number(data.resources?.[e.to]?.itemValue),baseFee=ops*e.silver,adjustedBaseFee=baseFee*(multiplierReady?multiplier:1),nutrition=Number.isFinite(itemValue)?itemValue*.1125*ops*e.output:0,stationFee=nutrition*station/100,fee=Math.round(adjustedBaseFee+stationFee),feesReady=multiplierReady&&(!station||Number.isFinite(itemValue)&&itemValue>=0);const result={sourceCount:prior.sourceCount,silver:prior.silver+fee,steps:[...prior.steps,{...e,operations:ops,consumed:ops*e.count,produced:ops*e.output,baseFee,adjustedBaseFee,nutrition,stationFee,fee,feesReady}]};if(!best||result.silver<best.silver)best=result}return best;
 }
 const path=solve(target,n,new Set());return path?{source,target,quantity:n,...path,feesReady:path.steps.every(s=>s.feesReady),baseSilver:path.steps.reduce((sum,s)=>sum+s.baseFee,0),adjustedSilver:path.steps.reduce((sum,s)=>sum+s.adjustedBaseFee,0),stationFee:path.steps.reduce((sum,s)=>sum+s.stationFee,0)}:null;
}
function compare(target,quantity,data,quote,pricing={}){return ancestors(target,data).map(source=>{const route=conversion(source,target,quantity,data,pricing),price=num(quote(source).price);return {...(route||{source,target,quantity:0,sourceCount:0,silver:0,steps:[]}),price,valid:!!route&&route.feesReady&&price>0,cost:route?route.sourceCount*price+route.silver:0}}).sort((a,b)=>Number(b.valid)-Number(a.valid)||a.cost-b.cost)}
function calibrate(total,quantity,station,base=24000,itemValue=124){const n=Number(quantity),rate=Number(station),paid=Number(total);if(!Number.isInteger(n)||n<=0||!Number.isFinite(rate)||rate<0||!Number.isFinite(paid)||paid<=0||!(base>0&&itemValue>0))return null;const stationFee=itemValue*.1125*n*rate/100,multiplier=(paid-stationFee)/(base*n);return multiplier>0&&multiplier<=100?{multiplier,stationFee,base:base*n,total:paid,quantity:n}:null;}
const api={refining,ancestors,conversion,compare,calibrate};root.RefiningMath=api;root.TransmutationMath=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
