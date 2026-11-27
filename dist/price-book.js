(function(root){'use strict';
const KEY='albion-price-book-v1',clone=x=>JSON.parse(JSON.stringify(x)),servers=['europe','west','east'],actions=['buy','sell','bid','discord'];
function key(server,id,city,q,action){if(!servers.includes(server)||!/^[A-Z0-9_@]+$/.test(id)||!['Bridgewatch','Fort Sterling','Lymhurst','Martlock','Thetford','Caerleon','Brecilien','Black Market'].includes(city)||![1,2,3,4,5].includes(Number(q))||!actions.includes(action))throw Error('Некорректный адрес цены.');return [server,id,city,Number(q),action].join('|');}
function create(storage,now=()=>Date.now()){
 let data={version:1,entries:{}};const raw=storage.getItem(KEY);if(raw){data=JSON.parse(raw);if(data?.version!==1||!data.entries||typeof data.entries!=='object'||Array.isArray(data.entries))throw Error('Не удалось прочитать «Мои цены». Исходные записи сохранены.');for(const [k,x]of Object.entries(data.entries)){const parts=k.split('|');if(parts.length!==5||key(...parts)!==k||!x||!Number.isFinite(x.price)||x.price<=0||x.price>1e12||!Number.isFinite(Date.parse(x.timestamp))||!['manual','market','scanner'].includes(x.source))throw Error('В «Моих ценах» повреждена запись. Исходные записи сохранены.');}}
 function persist(next){storage.setItem(KEY,JSON.stringify(next));data=next;}
 function set(server,id,city,q,action,price){const k=key(server,id,city,q,action),next=clone(data);if(price===null)delete next.entries[k];else{price=Number(price);if(!Number.isFinite(price)||price<=0||price>1e12)throw Error('Введите цену больше нуля.');next.entries[k]={price,timestamp:new Date(now()).toISOString(),source:'manual'};}persist(next);return clone(next.entries[k]||null);}
 function timestampMs(value){
  if(typeof value==='number')return value;
  if(typeof value!=='string')return NaN;
  return Date.parse(/(?:Z|[+-]\d\d:\d\d)$/i.test(value)?value:value+'Z');
 }
 function observe(rows,source='market',onSaved){
  const saved=[];
  const entries={...data.entries};
  let changed=false;
  for(const row of rows){
   let address;
   try{address=key(row.server,row.id,row.city,row.quality,row.action);}catch{continue;}
   const time=timestampMs(row.timestamp),price=Number(row.price),prior=entries[address];
   if(!Number.isFinite(time)||time<=0||time>now()+60000||!(price>0&&price<=1e12)||prior&&time<=Date.parse(prior.timestamp))continue;
   const entry={price,timestamp:new Date(time).toISOString(),source};
   if(prior?.source==='manual'||prior?.manualTimestamp)entry.manualTimestamp=prior.manualTimestamp||prior.timestamp;
   entries[address]=entry;if(onSaved)saved.push(row);changed=true;
  }
  if(changed){persist({...data,entries});onSaved?.(saved);}
  return changed;
 }
 function observeServer(server,rows,assess){
  const offers=[],groups=new Map();
  for(const row of rows){
   const id=row.item_id+'|'+row.quality;
   if(!groups.has(id))groups.set(id,[]);
   groups.get(id).push(row);
  }
  for(const row of rows){
   const {item_id:id,city,quality}=row;
   for(const [action,field] of [['buy','sell_price_min'],['sell','sell_price_min'],['bid','buy_price_max']]){
    let address;
    try{address=key(server,id,city,quality,action);}catch{continue;}
    if(!data.entries[address])continue;
    const timestamp=row[field+'_date'];
    const peers=city==='Black Market'?[]:groups.get(id+'|'+quality)
     .filter(peer=>peer.city!==city&&peer.city!=='Black Market'&&now()-timestampMs(peer[field+'_date'])<=86400000)
     .map(peer=>Number(peer[field]));
    const price=assess({price:row[field],timestamp,peers}).price;
    offers.push({server,id,city,quality,action,price,timestamp});
   }
  }
  return observe(offers);
 }
 function resolve(server,id,city,q,action,quote={},timestamp){
  const address=key(server,id,city,q,action);
  if(action!=='discord'&&data.entries[address]&&quote.price>0){
   try{observe([{server,id,city,quality:q,action,price:quote.price,timestamp}]);}catch{return {...quote,bookSaveError:true};}
  }
  const entry=data.entries[address];
  if(!entry)return quote;
  const manual=entry.source==='manual',age=manual?null:Math.max(0,(now()-Date.parse(entry.timestamp))/3600000);
  return {...quote,price:entry.price,age,manual:manual||undefined,fromBook:true,fromScanner:entry.source==='scanner',timestamp:entry.timestamp,bookTimestamp:entry.timestamp,reason:'',
   sourceLabel:(entry.source==='scanner'?'Считано с рынка':'Мои цены')+' · '+new Date(entry.timestamp).toLocaleString('ru-RU')};
 }
 return {set,resolve,observe,observeServer,snapshot:()=>clone(data),get(server,id,city,q,action){return clone(data.entries[key(server,id,city,q,action)]||null);}};
}
const api={KEY,key,create};root.PriceBookMath=api;if(typeof module!=='undefined')module.exports=api;
if(root.localStorage)try{
 const book=root.PriceBook=create(root.localStorage);
 book.record=(server,id,city,quality,action,price)=>{
  if(!(Number(price)>0&&Number(price)<=1e12))return;
  try {
   book.set(server,id,city,quality,action,price);
   queueMicrotask(()=>root.document.dispatchEvent(new Event('pricebookchange')));
  } catch(error){root.PriceBookError=error.message;}
 };
}catch(error){root.PriceBookError=error.message;}
})(typeof window!=='undefined'?window:globalThis);
