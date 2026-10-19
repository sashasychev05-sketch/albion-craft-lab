(function(){'use strict';
const O=BatchOperationsMath,$=id=>document.getElementById(id),store=()=>BatchCards.store,server=()=>ActivityViews.shipping.state.server;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Number.isFinite(n)?n.toLocaleString('ru-RU',{maximumFractionDigits:6}):'—',city=c=>c||'Город не указан';
const root=document.createElement('section');root.id='batch-operations';root.className='batch-operations';root.setAttribute('aria-label','Общие операции с партиями');
root.innerHTML=`<div class="section-heading"><div><h3>Работа сразу с несколькими партиями</h3><p class="hint">Активные партии текущего сервера. Поиск карточек ниже не ограничивает эти инструменты.</p></div></div>
<details data-fold-ignore id="batch-procurement"><summary>Общий закупочный лист <span id="batch-op-buy-count"></span></summary>
<p class="hint">Одинаковые товары одного качества объединены по городу. Частичная покупка распределяется вначале в самые старые партии. Отмечайте уже исполненные покупки; ордера в игре расставляйте вручную.</p>
<div class="batch-fields"><label class="field">Город<select id="batch-op-buy-city"><option value="all">Все города</option></select></label><label class="field">Найти товар или партию<input id="batch-op-buy-search" type="search" maxlength="160" placeholder="Например, пенька"></label></div>
<div id="batch-op-buy-list"></div><div class="batch-fields"><label class="field">Товар и город<select id="batch-op-buy-group"></select></label><label class="field">Куплено сейчас, шт.<input id="batch-op-buy-quantity" type="number" min="1" step="1" placeholder="Введите исполненное количество"></label></div>
<button type="button" class="button" id="batch-op-buy-all">Весь остаток выбранного товара</button><div id="batch-op-buy-preview" role="status" aria-live="polite"></div><button type="button" class="button primary" id="batch-op-buy-apply" disabled>Отметить покупку в партиях</button>
</details>
<details data-fold-ignore id="batch-cargo-planner"><summary>Планировщик рейсов <span id="batch-op-route-count"></span></summary>
<p class="hint">Смешанный груз из нескольких партий с одинаковыми городами отправления и назначения. В план попадает только купленное, ещё не доставленное. Незабранные покупки можно включить: отметка рейса учтёт их получение и доставку вместе.</p>
<div class="batch-fields"><label class="field">Направление<select id="batch-op-route"></select></label><label class="field">Свободная грузоподъёмность, кг<input id="batch-op-capacity" type="number" min="0.000001" max="1000000" step="0.000001"></label><label class="field">Дополнительный запас, %<input id="batch-op-reserve" type="number" min="0" max="99.99" step="any"></label></div>
<p class="hint">Укажите доступный вес уже с учётом персонажа и снаряжения. Запас дополнительно уменьшает его. Вес роскоши подставляется из справочника; для остальных товаров введите вес одной штуки из игры.</p><p class="hint" id="batch-op-settings-status" role="status"></p>
<div id="batch-op-cargo-items"></div><button type="button" class="button primary" id="batch-op-calculate">Рассчитать рейсы</button><div id="batch-op-trips" aria-live="polite"></div>
<p class="hint">Грузы раскладываются по весу, без превышения лимита. Это план по направлениям, без расчёта пути по карте и гарантии минимального числа рейсов. Отмечайте рейс после фактической доставки.</p>
</details><div class="batch-op-status"><p id="batch-op-status" role="status" aria-live="polite"></p><button type="button" class="button" id="batch-op-undo" disabled>Отменить последнюю общую отметку</button></div>`;
$('batch-itinerary').before(root);
let prefs,prefsError='',buyKey='',buyPlan=null,routeKey='',cargoPlan=null,lastServer='',quantities={},weights={},settings={capacity:500,reserve:10,weights:{}},receipts={};
try{prefs=O.preferences(localStorage);}catch(e){prefsError=e.message;}
const cards=()=>store()?.snapshot().cards||[];
function message(text,bad=false){$('batch-op-status').textContent=text;$('batch-op-status').classList.toggle('negative',bad);}
function readNumber(id){const input=$(id);return input.value===''?NaN:input.valueAsNumber;}
function procurementGroups(){
 const search=$('batch-op-buy-search').value.toLocaleLowerCase('ru-RU').replace(/ё/g,'е').trim(),chosen=$('batch-op-buy-city').value;
 return O.procurement(cards(),server()).filter(g=>(chosen==='all'||g.city===chosen)&&[g.name,g.item,...g.lines.map(l=>l.cardName)].join(' ').toLocaleLowerCase('ru-RU').replace(/ё/g,'е').includes(search));
}
function renderPurchase(){
 const all=O.procurement(cards(),server()),current=$('batch-op-buy-city').value,cities=[...new Set(all.map(g=>g.city))];
 $('batch-op-buy-city').innerHTML='<option value="all">Все города</option>'+cities.map(c=>`<option value="${esc(c)}">${esc(city(c))}</option>`).join('');$('batch-op-buy-city').value=cities.includes(current)?current:'all';
 const groups=procurementGroups();$('batch-op-buy-count').textContent='· позиций: '+all.length;
 $('batch-op-buy-list').innerHTML=groups.map(g=>`<article class="batch-op-line"><div><strong>${esc(g.name)}</strong><small>${esc(city(g.city))} · качество ${g.quality} · ${g.lines.length} позиций партий</small></div><span>${fmt(g.quantity)} шт.<small>${g.cost===null?'Стоимость неизвестна':fmt(g.cost)+' серебра за товар'}</small></span><button type="button" class="button" data-op-select-buy="${esc(g.key)}">Распределить покупку</button></article>`).join('')||'<p class="hint">Открытых закупок по выбранным условиям нет.</p>';
 if(!groups.some(g=>g.key===buyKey)){buyKey=groups[0]?.key||'';$('batch-op-buy-quantity').value='';}
 $('batch-op-buy-group').innerHTML=groups.map(g=>`<option value="${esc(g.key)}">${esc(city(g.city))} · ${esc(g.name)} · кач. ${g.quality} · ${fmt(g.quantity)} шт.</option>`).join('');$('batch-op-buy-group').value=buyKey;
 $('batch-op-buy-quantity').max=groups.find(g=>g.key===buyKey)?.quantity||0;
 $('batch-op-buy-all').disabled=!groups.length;previewPurchase();
}
function previewPurchase(){
 buyPlan=null;const out=$('batch-op-buy-preview');out.classList.remove('negative');$('batch-op-buy-apply').disabled=true;
 if(!buyKey){out.textContent='Создайте партии из расчётов, чтобы собрать их закупки в один список.';return;}
 if($('batch-op-buy-quantity').value===''){out.textContent='Введите количество, чтобы увидеть распределение до сохранения.';return;}
 try{
  buyPlan=O.purchasePlan(cards(),server(),buyKey,readNumber('batch-op-buy-quantity'));
  out.innerHTML='<h4>Распределение '+fmt(buyPlan.quantity)+' шт.</h4><ul>'+buyPlan.lines.map(l=>`<li>${esc(l.cardName)}: +${fmt(l.quantity)} шт. ${l.cost===null?'· цена неизвестна':'· '+fmt(l.cost)+' серебра'}</li>`).join('')+'</ul><p class="hint">'+(buyPlan.cost===null?'Часть цен неизвестна.':'По сохранённому сценарию: '+fmt(buyPlan.cost)+' серебра за товар.')+' Постановка и обновления ордеров здесь повторно не начисляются. Это оценка, фактические цены карточек не меняются.</p>';
  $('batch-op-buy-apply').disabled=!store();
 }catch(e){out.textContent=e.message;out.classList.add('negative');}
}
function defaultWeight(item){const value=window.LUXURY_DATA?.find(x=>x.id===item)?.weight;return Number.isFinite(value)&&value>0?value:null;}
function routes(){return O.cargo(cards(),server());}
function loadSettings(){settings=prefs?.get(server())||{capacity:500,reserve:10,weights:{}};weights={...settings.weights};$('batch-op-capacity').value=settings.capacity;$('batch-op-reserve').value=settings.reserve;$('batch-op-settings-status').textContent=prefsError||'Грузоподъёмность и введённый вес сохраняются отдельно для каждого сервера.';}
function renderCargo(){
 const all=routes(),previous=routeKey;
 if(!all.some(r=>r.key===routeKey))routeKey=all[0]?.key||'';
 if(previous!==routeKey){quantities={};cargoPlan=null;}
 $('batch-op-route-count').textContent='· направлений: '+all.length;
 $('batch-op-route').innerHTML=all.map(r=>`<option value="${esc(r.key)}">${esc(city(r.origin))} → ${esc(city(r.destination))} · ${r.lines.length} позиций партий</option>`).join('');$('batch-op-route').value=routeKey;
 const route=all.find(r=>r.key===routeKey),items=route?O.cargoItems(route):[];
 $('batch-op-cargo-items').innerHTML=items.map((item,i)=>{
  quantities[item.key]=Math.min(quantities[item.key]??item.quantity,item.quantity);
  if(!Object.hasOwn(weights,item.item)&&defaultWeight(item.item)!==null)weights[item.item]=defaultWeight(item.item);
  return `<article class="batch-op-cargo-item"><div><strong>${esc(item.name)}</strong><small>Качество ${item.quality} · доступно ${fmt(item.quantity)} шт. · из них забрать ${fmt(item.pickup)} шт.</small></div><label class="field" for="batch-op-qty-${i}">Везти, шт.<input id="batch-op-qty-${i}" type="number" min="0" max="${item.quantity}" step="1" data-op-cargo-quantity="${esc(item.key)}" value="${quantities[item.key]}"></label><label class="field" for="batch-op-weight-${i}">Вес одной штуки, кг<input id="batch-op-weight-${i}" type="number" min="0.000001" max="1000000" step="0.000001" data-op-cargo-weight="${esc(item.item)}" value="${esc(weights[item.item]??'')}" placeholder="Укажите вес из игры"></label></article>`;
 }).join('')||'<p class="hint">Нет купленного груза между разными городами. Укажите город закупки и пункт доставки в карточке, затем отметьте купленное количество.</p>';
 $('batch-op-calculate').disabled=!items.length||!store();renderTrips();
}
function readCargo(){
 const nextQuantities={};for(const input of root.querySelectorAll('[data-op-cargo-quantity]'))nextQuantities[input.dataset.opCargoQuantity]=input.value===''?NaN:input.valueAsNumber;
 const nextWeights={...weights};for(const input of root.querySelectorAll('[data-op-cargo-weight]')){if(input.value!=='')nextWeights[input.dataset.opCargoWeight]=input.valueAsNumber;else delete nextWeights[input.dataset.opCargoWeight];}
 return {capacity:readNumber('batch-op-capacity'),reserve:readNumber('batch-op-reserve'),weights:nextWeights,quantities:nextQuantities};
}
function saveSettings(options){
 weights={...options.weights};settings={capacity:options.capacity,reserve:options.reserve,weights};
 if(!prefs)return;
 try{prefs.set(server(),settings);$('batch-op-settings-status').textContent='Грузоподъёмность и вес сохранены для текущего сервера.';}
 catch(e){$('batch-op-settings-status').textContent=e.message;}
}
function renderTrips(){
 const out=$('batch-op-trips');
 if(!cargoPlan){out.innerHTML='<p class="hint">Выберите груз и нажмите «Рассчитать рейсы». Нулевое количество исключает товар.</p>';return;}
 out.innerHTML=`<div class="batch-op-totals"><strong>${cargoPlan.trips.length} рейс. · ${fmt(cargoPlan.quantity)} шт. · ${fmt(cargoPlan.weight)} кг</strong><span>Лимит на рейс с запасом: ${fmt(cargoPlan.usable)} кг</span></div>`+cargoPlan.trips.map((trip,index)=>`<article class="batch-op-trip"><div class="section-heading"><h4>Рейс ${index+1} · ${esc(city(cargoPlan.origin))} → ${esc(city(cargoPlan.destination))}</h4><strong>${fmt(trip.weight)} / ${fmt(cargoPlan.usable)} кг</strong></div><progress max="${cargoPlan.usable}" value="${trip.weight}" aria-label="Загрузка рейса ${index+1}"></progress><p class="hint">Свободно с учётом запаса: ${fmt(trip.free)} кг</p><ul>${trip.lines.map(l=>`<li><strong>${esc(l.name)} · ${fmt(l.quantity)} шт.</strong><small>${esc(l.cardName)} · ${l.pickup?'забрать '+fmt(l.pickup)+' шт. и доставить':'уже забрано, доставить'} · ${fmt(l.quantity*l.unitWeight)} кг</small></li>`).join('')}</ul><button type="button" class="button" data-op-deliver-trip="${index}">Рейс ${index+1} доставлен</button></article>`).join('');
}
function render(){
 if(server()!==lastServer){lastServer=server();buyKey='';buyPlan=null;routeKey='';cargoPlan=null;quantities={};loadSettings();$('batch-op-buy-quantity').value='';$('batch-op-buy-city').value='all';$('batch-op-buy-search').value='';message('');}
 renderPurchase();
 if(cargoPlan)try{if(JSON.stringify(O.tripPlan(cards(),server(),cargoPlan.key,cargoPlan.options))!==JSON.stringify(cargoPlan))cargoPlan=null;}catch{cargoPlan=null;}
 renderCargo();$('batch-op-undo').disabled=!receipts[server()]||!store();
}
function receiptSaved(receipt,text){receipts[receipt.server]=receipt;BatchCards.render();if(receipt.server===server())message(text);}
function undoReceipt(targetServer=server()){O.undo(store(),receipts[targetServer],targetServer);delete receipts[targetServer];if(targetServer===server()){quantities={};cargoPlan=null;}BatchCards.render();if(targetServer===server())message('Общая отметка отменена. Предыдущие количества восстановлены.');}
$('batch-op-buy-search').oninput=renderPurchase;$('batch-op-buy-city').onchange=()=>{buyKey='';renderPurchase();};
$('batch-op-buy-group').onchange=()=>{buyKey=$('batch-op-buy-group').value;$('batch-op-buy-quantity').value='';previewPurchase();};
$('batch-op-buy-quantity').oninput=previewPurchase;
$('batch-op-buy-all').onclick=()=>{$('batch-op-buy-quantity').value=$('batch-op-buy-quantity').max;previewPurchase();};
$('batch-op-buy-apply').onclick=()=>{try{if(!buyPlan)throw Error('Сначала проверьте распределение.');const quantity=buyPlan.quantity,receipt=O.apply(store(),buyPlan);$('batch-op-buy-quantity').value='';buyPlan=null;receiptSaved(receipt,'Покупка '+fmt(quantity)+' шт. распределена по партиям. Получение ещё не отмечено.');}catch(e){message(e.message,true);}};
$('batch-op-route').onchange=()=>{routeKey=$('batch-op-route').value;quantities={};cargoPlan=null;renderCargo();};
$('batch-op-calculate').onclick=()=>{try{const options=readCargo();cargoPlan=O.tripPlan(cards(),server(),routeKey,options);quantities={...options.quantities};saveSettings(options);renderTrips();message('План готов. Отметьте каждый рейс только после доставки груза.');}catch(e){cargoPlan=null;renderTrips();message(e.message,true);}};
$('batch-op-undo').onclick=()=>{try{undoReceipt();}catch(e){message(e.message,true);}};
root.addEventListener('input',event=>{
 if(event.target.matches('[data-op-cargo-quantity],[data-op-cargo-weight],#batch-op-capacity,#batch-op-reserve')){cargoPlan=null;renderTrips();}
});
root.addEventListener('change',event=>{
 if(event.target.matches('[data-op-cargo-weight],#batch-op-capacity,#batch-op-reserve')){
  const input=event.target;if(input.dataset.opCargoWeight)for(const twin of root.querySelectorAll('[data-op-cargo-weight]'))if(twin.dataset.opCargoWeight===input.dataset.opCargoWeight)twin.value=input.value;
  saveSettings(readCargo());
 }
});
root.addEventListener('click',event=>{
 const select=event.target.closest('[data-op-select-buy]');if(select){buyKey=select.dataset.opSelectBuy;$('batch-op-buy-group').value=buyKey;$('batch-op-buy-quantity').value='';previewPurchase();$('batch-op-buy-quantity').focus();}
 const deliver=event.target.closest('[data-op-deliver-trip]');if(deliver)try{
  if(!cargoPlan)throw Error('Рассчитайте рейсы заново.');const index=Number(deliver.dataset.opDeliverTrip),trip=cargoPlan.trips[index],receipt=O.apply(store(),cargoPlan,index);
  for(const line of trip.lines)quantities[line.key]-=line.quantity;cargoPlan=null;
  receiptSaved(receipt,'Рейс доставлен. Получение и доставка отмечены во всех его партиях. Рассчитайте оставшийся груз заново.');
 }catch(e){message(e.message,true);}
});
window.BatchOperationsUI={render,record:receiptSaved,undo:undoReceipt,hasUndo:target=>!!receipts[target],snapshot:()=>({buyPlan,cargoPlan,routeKey,buyKey})};render();
})();
