(function(){'use strict';
 const $=id=>document.getElementById(id),fmt=(n,d=2)=>Number(n).toLocaleString('ru-RU',{maximumFractionDigits:d}),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let context;
 function sauceFor(recipe,data){return recipe.kind==='food'?recipe.mats.map(m=>data.fishSauce?.sauces[m.id]).find(Boolean):null}
 function marketIds(recipe,cfg,data){const sauce=sauceFor(recipe,data);return sauce&&cfg.makeSauce?[sauce.id,'T1_SEAWEED',...data.fishSauce.fish.map(f=>f.id)]:[]}
 function render(recipe,cfg,data,result,callbacks){
  context={recipe,cfg,data,result,...callbacks};const sauce=sauceFor(recipe,data);
  $('fish-sauce-options').hidden=recipe.kind!=='food';$('make-sauce').disabled=!sauce;
  const enabled=!!sauce&&!!cfg.makeSauce;$('sauce-controls').hidden=!enabled;$('fish-sauce-price-panel').hidden=!enabled;
  $('sauce-availability').textContent=sauce?`${sauce.name}: ${fmt(sauce.chops,0)} кусочков рыбы + ${fmt(sauce.seaweed,0)} ед. водорослей. Соус и разделка рыбы не используют возврат или фокус.`:'В этом рецепте нет рыбного соуса. Выберите еду с зачарованием .1–.3, чтобы готовить соус для неё.';
  if(!enabled)return;
  const selected=data.fishSauce.fish.find(f=>f.id===cfg.sauceFish)||data.fishSauce.fish[0],plan=result.saucePlans[0];
  $('sauce-target').value=cfg.sauceTarget??'';$('sauce-table-target').value=cfg.sauceTarget??'';const weed=callbacks.quote('T1_SEAWEED');$('sauce-weed-price').value=weed.price||'';
  $('sauce-selected-fish').textContent=selected.name+' · T'+selected.tier+' · '+fmt(selected.chops,0)+' кусочков / рыба';window.ItemIcons.mount($('sauce-selected-fish'),selected.id,1,40);
  if(!plan){$('sauce-plan').textContent='Укажите объём приготовления.';$('sauce-fish-prices').innerHTML='';return;}
  $('sauce-plan').textContent=`Для партии еды нужно ${fmt(plan.sauceCount,0)} шт. соуса. Закупка для соуса с запасом: ${fmt(plan.fishBuy,0)} рыб и ${fmt(plan.seaweedBuy,0)} водорослей. В общей закупке соус заменён этими материалами.`;
  $('sauce-table-help').textContent=sauce.name+' · '+fmt(plan.sauceCount,0)+' шт. для партии · Водоросли: '+(weed.price?fmt(weed.price)+' серебра/шт.':'нужна цена');
  const selectedGuide=window.FishSauceMath.priceGuide(plan,cfg.sauceTarget,callbacks.quote(selected.id).price,weed.price);
  $('sauce-target-status').textContent=selectedGuide.reason||`Цель: не дороже ${fmt(cfg.sauceTarget)} серебра за соус. Зелёным отмечены варианты, укладывающиеся в неё.`;
  const focused=document.activeElement?.dataset.saucePrice;
  const rows=data.fishSauce.fish.filter(f=>(cfg.sauceFishGroup==='all'||f.group==='common')&&(cfg.sauceFishTier==='all'||f.tier===Number(cfg.sauceFishTier))).map(f=>{const q=callbacks.quote(f.id),p=window.FishSauceMath.production(sauce,plan.sauceCount,f,cfg.buffer),g=window.FishSauceMath.priceGuide(p,cfg.sauceTarget,q.price,weed.price);return {f,q,p,g}});
  const order=focused?Array.from($('sauce-fish-prices').querySelectorAll('[data-sauce-price]')).map(e=>e.dataset.saucePrice):null;rows.sort((a,b)=>order?order.indexOf(a.f.id)-order.indexOf(b.f.id):(a.g.cost??Infinity)-(b.g.cost??Infinity)||a.f.tier-b.f.tier||a.f.name.localeCompare(b.f.name,'ru'));
  $('sauce-fish-prices').innerHTML=rows.map(({f,q,p,g})=>`<tr class="${f.id===selected.id?'selected-fish-row':''}"><td class="name"><div class="item-with-icon">${window.ItemIcons.image(f.id,1,40)}<span class="item-copy">${esc(f.name)}<small>T${f.tier} · ${fmt(p.fishBuy,0)} рыб на партию соуса</small></span></div></td><td>${fmt(f.chops,0)}</td><td><input data-sauce-price="${esc(f.id)}" type="number" min="0" step="0.01" value="${q.price||''}" aria-label="Цена закупки: ${esc(f.name)}"><small>${q.manual?'Вручную':q.price?esc(q.city)+' · '+fmt(q.age,1)+' ч.':esc(q.reason||'Нет проверенной цены')}</small></td><td>${g.maxFish===null?'—':fmt(g.maxFish)}</td><td class="${g.within?'positive':Number(cfg.sauceTarget)>0&&g.cost!==null?'negative':''}">${g.cost===null?'Нужна цена':fmt(g.cost)}${g.within?'<small>Укладывается в цель</small>':''}</td><td><button type="button" class="button" data-sauce-fish="${esc(f.id)}" ${selected.id===f.id?'disabled':''}>${selected.id===f.id?'Выбрано':'Выбрать'}</button></td></tr>`).join('')||'<tr><td colspan="6" class="empty">В выбранном фильтре нет рыбы.</td></tr>';
  if(focused)$('sauce-fish-prices').querySelector(`[data-sauce-price="${focused}"]`)?.focus({preventScroll:true});
 }
 $('sauce-table-target').addEventListener('input',e=>{if(!context)return;context.cfg.sauceTarget=e.target.value===''?null:Math.max(0,Number(e.target.value)||0);context.save(false)});
 $('sauce-show-table').onclick=()=>{$('fish-sauce-price-panel').scrollIntoView({behavior:'smooth',block:'start'})};
 $('sauce-fish-prices').addEventListener('click',e=>{const b=e.target.closest('[data-sauce-fish]');if(!b||!context)return;context.cfg.sauceFish=b.dataset.sauceFish;context.save(true)});
 $('sauce-fish-prices').addEventListener('input',e=>{const id=e.target.dataset.saucePrice;if(!id||!context)return;context.setPrice(id,e.target.value);context.save(false)});
 $('sauce-weed-price').addEventListener('input',e=>{if(!context)return;context.setPrice('T1_SEAWEED',e.target.value);context.save(false)});
 window.FoodSauceUI={render,marketIds};
})();
