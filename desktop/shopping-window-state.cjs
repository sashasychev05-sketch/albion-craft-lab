'use strict';
const integer=n=>Number.isSafeInteger(n),clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
function bounds(saved,areas){
 if(!areas.length)throw Error('No display work area');
 const good=saved&&[saved.x,saved.y,saved.width,saved.height].every(integer)&&saved.width>=300&&saved.height>=400&&saved.width<=8000&&saved.height<=5000;
 let area=areas[0];
 if(good){const overlap=a=>Math.max(0,Math.min(saved.x+saved.width,a.x+a.width)-Math.max(saved.x,a.x))*Math.max(0,Math.min(saved.y+saved.height,a.y+a.height)-Math.max(saved.y,a.y));area=[...areas].sort((a,b)=>overlap(b)-overlap(a))[0];}
 const width=Math.min(area.width,good?saved.width:370),height=Math.min(area.height,good?saved.height:560);
 return {width,height,x:good?clamp(saved.x,area.x,area.x+area.width-width):area.x+Math.max(0,area.width-width-16),y:good?clamp(saved.y,area.y,area.y+area.height-height):area.y+Math.min(48,Math.max(0,area.height-height))};
}
function normalize(saved,areas){return {version:1,bounds:bounds(saved?.version===1?saved.bounds:null,areas),opacity:typeof saved?.opacity==='number'&&Number.isFinite(saved.opacity)?clamp(saved.opacity,.55,1):1,pinned:typeof saved?.pinned==='boolean'?saved.pinned:true};}
function corner(rect,area,position){
 if(!['top-left','top-right','bottom-left','bottom-right'].includes(position))throw Error('Неизвестное положение окна.');
 const left=position.endsWith('left'),top=position.startsWith('top'),gap=12;
 return {...rect,x:area.x+(left?Math.min(gap,Math.max(0,area.width-rect.width)):Math.max(0,area.width-rect.width-gap)),y:area.y+(top?Math.min(gap,Math.max(0,area.height-rect.height)):Math.max(0,area.height-rect.height-gap))};
}
module.exports={bounds,normalize,corner};
