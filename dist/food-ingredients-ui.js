(function(){'use strict';
 const $=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),fmt=n=>Number(n).toLocaleString('ru-RU',{maximumFractionDigits:2});
 const cities=['Bridgewatch','Fort Sterling','Lymhurst','Martlock','Thetford','Caerleon','Brecilien'];let context;
 function clear(id,seen=new Set()){if(seen.has(id))return;seen.add(id);delete context.cfg.foodIngredientSteps[id];for(const m of context.data.foodIngredients[id]?.mats||[])clear(m.id,seen)}
 function render(recipe,cfg,data,result,callbacks){
  context={recipe,cfg,data,result,...callbacks};const roots=recipe.mats.filter(m=>data.foodIngredients?.[m.id]);
  $('food-ingredients-options').hidden=recipe.kind!=='food'||!roots.length;if(recipe.kind!=='food'||!roots.length)return;
  cfg.foodIngredientSteps ||= {};cfg.foodIngredientSettings ||= {};
  const focused=document.activeElement,key=focused?.dataset.ingredientId,setting=focused?.dataset.ingredientSetting,step=focused?.dataset.foodIngredient;
  function node(id,n,seen=new Set()){
   if(seen.has(id)||seen.size>=64)return '<p class="hint">Ошибка цепочки производства: цикл.</p>';const next=new Set(seen);next.add(id);
   const r=window.FoodIngredientMath.recipe(id,cfg,data),checked=!!r&&cfg.foodIngredientSteps[id]===true;
   if(r&&(!Array.isArray(r.mats)||r.mats.some(m=>!m||typeof m.id!=='string')))return '<p class="hint">Некорректный рецепт производства.</p>';
   const title=`<div class="refining-resource item-with-icon">${window.ItemIcons.image(id,1,32)}<span class="item-copy">${esc(data.names[id]||id)}<small>${fmt(n)} шт. на операцию ${r?'':' · закупка'}</small></span>${r?`<span class="refining-badge ${checked?'self-refined':''}">${checked?'Приготовление':'Покупка'}</span>`:''}</div>`;
   let options='';if(checked){const s=window.FoodIngredientMath.settings(r,cfg);
    const field=(prop,label,value)=>`<label class="field">${label}<input type="number" min="0" ${prop==='rrr'?'max="95"':''} step="0.01" data-ingredient-id="${id}" data-ingredient-setting="${prop}" value="${value}"></label>`;
    options=r.noReturn?`<label class="field">Рыба для разделки<select data-food-chop-fish>${data.fishSauce.fish.map(f=>`<option value="${f.id}" ${r.mats[0].id===f.id?'selected':''}>${esc(f.name)} · ${f.chops} кусочков</option>`).join('')}</select></label><p class="hint">Разделка без возврата, фокуса и платы.</p>`:`<details class="ingredient-settings"><summary>${esc(r.station)} · ${esc(s.city)} · ${s.place==='island'?'остров':'город'} · ${r.productReturn?'Бонус выхода':'Возврат'} ${fmt(s.rrr)}%</summary><div class="grid2"><label class="field">Город<select data-ingredient-id="${id}" data-ingredient-setting="city">${cities.map(c=>`<option ${c===s.city?'selected':''}>${c}</option>`).join('')}</select></label><label class="field">Место<select data-ingredient-id="${id}" data-ingredient-setting="place"><option value="city" ${s.place==='city'?'selected':''}>Станок в городе</option><option value="island" ${s.place==='island'?'selected':''}>Станок на острове</option></select></label>${field('station','Тариф / 100 питания',s.station)}${field('rrr',r.productReturn?'Бонус к выходу мяса, %':'Возврат без фокуса, %',s.rrr)}${field('fee300','Плата / шт. при тарифе 300',s.fee300)}</div><p class="hint">Сверьте возврат и плату с выбранным станком. ${r.productReturn?'Бонус даёт дополнительное мясо; животные расходуются целиком.':''}</p></details>`;
   }
   return `<div class="refining-node"><div>${title}${r?`<label class="refining-check"><input type="checkbox" data-food-ingredient="${id}" aria-label="Приготовить самостоятельно: ${esc(r.name)}" ${checked?'checked':''}> Приготовить самостоятельно</label>`:''}</div>${checked?options+`<div class="refining-children">${r.mats.map(m=>node(m.id,m.n,next)).join('')}</div>`:''}</div>`;
  }
  const open=new Set(Array.from($('food-ingredients-tree').querySelectorAll('details[open]')).map(e=>e.querySelector('[data-ingredient-id]')?.dataset.ingredientId));
  $('food-ingredients-tree').innerHTML=roots.map(m=>node(m.id,m.n)).join('');
  for(const d of $('food-ingredients-tree').querySelectorAll('details'))if(open.has(d.querySelector('[data-ingredient-id]')?.dataset.ingredientId))d.open=true;
  if(key&&setting)$('food-ingredients-tree').querySelector(`[data-ingredient-id="${key}"][data-ingredient-setting="${setting}"]`)?.focus({preventScroll:true});
  if(step)$('food-ingredients-tree').querySelector(`[data-food-ingredient="${step}"]`)?.focus({preventScroll:true});
  $('food-ingredients-buy-all').hidden=!Object.values(cfg.foodIngredientSteps).some(Boolean);
 }
 $('food-ingredients-tree').addEventListener('change',e=>{const id=e.target.dataset.foodIngredient;if(!id||!context)return;if(e.target.checked)context.cfg.foodIngredientSteps[id]=true;else clear(id);context.save(true)});
 function setting(e){const id=e.target.dataset.ingredientId,k=e.target.dataset.ingredientSetting;if(!id||!k||!context)return;const {cfg}=context;cfg.foodIngredientSettings[id] ||= {};const s=cfg.foodIngredientSettings[id];s[k]=e.target.tagName==='SELECT'?e.target.value:e.target.value===''?null:Math.max(0,Number(e.target.value)||0);if(k==='city'||k==='place')s.rrr=null;if(k==='rrr'&&s[k]!==null)s[k]=Math.min(95,s[k]);context.save(false)}
 $('food-ingredients-tree').addEventListener('input',e=>{if(e.target.type==='number')setting(e)});
 $('food-ingredients-tree').addEventListener('change',e=>{if(e.target.hasAttribute('data-food-chop-fish')){context.cfg.foodChopFish=e.target.value;context.save(true)}else if(e.target.tagName==='SELECT')setting(e)});
 $('food-ingredients-buy-all').onclick=()=>{context.cfg.foodIngredientSteps={};context.save(true)};
 window.FoodIngredientsUI={render};
})();
