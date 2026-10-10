(function(root){
  'use strict';
  function age(ts,now=Date.now()){
    if(!ts||ts.startsWith('0001'))return Infinity;
    const t=Date.parse(/(?:Z|[+-]\d\d:\d\d)$/.test(ts)?ts:ts+'Z');
    return !Number.isFinite(t)||t>now+300000?Infinity:Math.max(0,(now-t)/3600000);
  }
  function assess({price,timestamp,history,peers=[],now=Date.now(),historical=false}){
    const p=Number(price),hours=historical?age(history?.to+'T23:59:59Z',now):age(timestamp,now);
    if(!Number.isFinite(p)||p<=0)return {price:0,age:hours,reason:'Нет цены',raw:price};
    if(hours> (historical?72:24))return {price:0,age:hours,reason:'Устаревшая цена',raw:p};
    const h=history&&age(history.to+'T23:59:59Z',now)<=72&&history.days>=3&&history.daily>0&&Number.isFinite(history.avg)&&history.avg>0?history.avg:0;
    const sorted=peers.filter(v=>Number.isFinite(v)&&v>0).sort((a,b)=>a-b),median=sorted.length>=3?sorted[Math.floor(sorted.length/2)]:0;
    if(!historical&&((h&&(p>h*3||p<h/3))||(median&&(p>median*5||p<median/5))))return {price:0,age:hours,reason:'Подозрительная цена',raw:p,reference:h||median};
    return {price:p,age:hours,reason:'',raw:p};
  }
  // Keep bid/ask timestamps independent; an empty or older side must not erase a fresh quote.
  function merge(a,b){
    if(!a)return b;
    const out={...a,...b};
    for(const side of ['sell','buy']){
      const field=side==='sell'?'sell_price_min':'buy_price_max',date=field+'_date';
      if(!(b[field]>0)||age(b[date])>age(a[date])){
        for(const key of Object.keys(a).filter(k=>k.startsWith(side+'_price_')))out[key]=a[key];
      }
    }
    return out;
  }
  const api={age,assess,merge};if(typeof module!=='undefined')module.exports=api;else root.MarketGuard=api;
})(typeof window==='undefined'?globalThis:window);
