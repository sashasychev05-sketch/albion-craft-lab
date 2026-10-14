(function(root){'use strict';
const KEY='albion-screen-layout-v1',modes=['food','potions','gear','refine','luxury','transmutation','training','shipping','character','island','journals','enchant','salvage','mounts','prices','quality','history','deals'];
const object=x=>x&&typeof x==='object'&&!Array.isArray(x),ids=x=>Array.isArray(x)&&x.length<=200&&x.every(id=>typeof id==='string'&&id.length>0&&id.length<=200);
function empty(){return {version:1,modes:{}};}
function read(storage){const raw=storage.getItem(KEY);if(!raw)return empty();const data=JSON.parse(raw);if(!object(data)||data.version!==1||!object(data.modes))throw Error('Не удалось прочитать настройки экрана.');
 const result=empty();for(const mode of modes){if(!Object.hasOwn(data.modes,mode))continue;const value=data.modes[mode];if(!object(value)||!ids(value.order)||!ids(value.hidden))throw Error('Не удалось прочитать настройки экрана.');result.modes[mode]={order:[...new Set(value.order)],hidden:[...new Set(value.hidden)]};}return result;
}
function normalize(value,blocks){const preferred=ids(value?.order)?value.order:[],hidden=new Set(ids(value?.hidden)?value.hidden:[]),groups=[...new Set(blocks.map(b=>b.group))],order=[];
 for(const group of groups){const members=blocks.filter(b=>b.group===group).map(b=>b.id);order.push(...[...new Set([...preferred.filter(id=>members.includes(id)),...members])]);}
 return {order,hidden:blocks.filter(b=>b.hideable!==false&&hidden.has(b.id)).map(b=>b.id)};
}
function move(value,blocks,id,offset){const result=normalize(value,blocks),block=blocks.find(b=>b.id===id);if(!block)return result;const group=result.order.filter(key=>blocks.find(b=>b.id===key)?.group===block.group),index=group.indexOf(id),next=Math.max(0,Math.min(group.length-1,index+(offset<0?-1:1)));
 if(index===next)return result;const a=result.order.indexOf(id),b=result.order.indexOf(group[next]);[result.order[a],result.order[b]]=[result.order[b],result.order[a]];return result;
}
function visible(value,blocks,id,show){const result=normalize(value,blocks),block=blocks.find(b=>b.id===id);if(!block||block.hideable===false)return result;result.hidden=result.hidden.filter(key=>key!==id);if(!show)result.hidden.push(id);return normalize(result,blocks);}
function update(data,mode,value,blocks){if(!modes.includes(mode))throw Error('Неизвестный раздел.');const result={version:1,modes:{...data.modes}},next=normalize(value,blocks),defaults=normalize(null,blocks);if(JSON.stringify(next)===JSON.stringify(defaults))delete result.modes[mode];else result.modes[mode]=next;return result;}
const api={KEY,empty,read,normalize,move,visible,update};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ScreenLayoutModel=api;
})(typeof window!=='undefined'?window:globalThis);
