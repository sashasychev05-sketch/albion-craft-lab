(function () {
'use strict';
const api = window.ShoppingWindow, el = id => document.getElementById(id);
const names = {europe:'Европа',west:'Америка',east:'Азия'};
const volume = el('play-volume'), record = el('play-record'), pageSelect = el('play-page');
let savingPurchase=false;
let page = 'shopping', version = 0, busy = false, model = null, dirty = false, timer;
function paint(next) {
 el('play-summary').textContent = page === 'craft' ? next.amount + ' · прибыль: ' + next.profit : next.last || (next.started ? 'Запись включена · ' + next.count : 'Запись выключена');
 el('play-context').textContent = names[next.server] || next.server;
 if (page === 'craft') {
  el('play-title').textContent = next.name;
  el('play-context').textContent += ' · ' + next.amount;
  el('play-station').textContent='Крафтов: '+next.ops+' · Фокус: '+next.focus;
  const bill=el('play-bill'),signature=JSON.stringify(next.bill);
  if(bill.dataset.signature!==signature){bill.dataset.signature=signature;bill.replaceChildren(...next.bill.map(m=>{const row=document.createElement('li');row.textContent=m.name+' · '+m.quantity+' шт.'+(m.city?' · '+m.city:'');return row;}));}
  const canProcure=Number.isSafeInteger(next.units)&&next.units>0&&next.bill.length>0;
  el('play-procure').disabled=savingPurchase||!canProcure;el('play-procure').title=canProcure?'':'Увеличьте объём партии, чтобы появились материалы для закупки.';
  el('play-cost').textContent = next.cost; el('play-profit').textContent = next.profit;
  el('play-volume-label').textContent = next.field === 'quantity' ? 'Готовых предметов' : 'Бюджет фокуса';
  if (next.recipe !== model?.recipe || next.field !== model?.field || next.server !== model?.server) dirty = false;
  volume.min = next.min; volume.max = next.max;
  if (!dirty) volume.value = next.value;
 } else {
  el('play-title').textContent = next.started ? 'Запись включена' : 'Запись выключена';
  record.textContent = next.started ? 'Выключить запись' : 'Включить запись';
  el('play-hint').textContent = next.started ? 'Наведите курсор на портал и нажмите ' + next.trigger + '. Переходов записано: ' + next.count + '.' :
   next.available ? 'Запись использует сохранённую кнопку сканирования.' : 'Подключите Checker в настройках локаций Albion Lab.';
  const leg=next.leg;el('play-itinerary').hidden=!leg;
  if(leg){const label=leg.done?'Маршрут завершён':leg.label;el('play-leg').textContent=label;el('play-leg-time').textContent=leg.done?'':(leg.index+1)+' / '+leg.total+' · '+leg.left;el('play-next').hidden=leg.done;el('play-next').disabled=!leg.active;el('play-summary').textContent=label+(leg.done?'':' · '+leg.left);}
  el('play-last').textContent = next.last; el('play-status').textContent = next.error || '';
 }
 model = next;
}
async function request(action = 'play-state', extra = {}) {
 if (busy || !api || page === 'shopping') return;
 clearTimeout(timer);
 const token = version; busy = true;
 const mutation = action !== 'play-state';
 if (mutation) { pageSelect.disabled = true; record.disabled = true; volume.disabled = true; }
 try {
  const next = await api.command({action,page,...extra});
  if (token !== version) return;
  if (mutation) dirty = false;
  if (mutation || !model) el('play-status').textContent = '';
  paint(next);
 } catch (e) { if (token === version) el('play-status').textContent = e.message; }
 finally {
  if (token === version) {
   busy = false; pageSelect.disabled = false; volume.disabled = !model;
   record.disabled = !model || (!model.started && !model.available);
   timer = setTimeout(() => request(),2500);
  }
 }
}
function select(value) {
 if (!['shopping','craft','roads'].includes(value)) return;
 version++; clearTimeout(timer); busy = false; dirty = false; model = null; page = value;
 el('play-picker').hidden = page !== 'craft'; el('play-picker').open = false;
 el('play-query').value = ''; el('play-matches').replaceChildren(); el('play-summary').textContent = '';
 pageSelect.value = page; pageSelect.disabled = false;
 document.body.classList.toggle('playing',page !== 'shopping');
 el('play-panel').hidden = page === 'shopping'; el('play-craft').hidden = page !== 'craft'; el('play-roads').hidden = page !== 'roads';
 for (const id of ['play-title','play-context','play-cost','play-profit','play-last','play-hint','play-status']) el(id).textContent = '';
 volume.disabled = true; record.disabled = true;
 if (page !== 'shopping') request();
}
let searchDelay, searchId = 0;
el('play-query').oninput = () => {
 const query = el('play-query').value.trim(), token = ++searchId, scope = version;
 const list = el('play-matches'); list.replaceChildren(); clearTimeout(searchDelay);
 if (!query) return;
 searchDelay = setTimeout(async () => {
  try {
   const hits = await api.command({action:'play-search',page:'craft',query});
   if (token !== searchId || scope !== version) return;
   if (!hits.length) list.textContent = 'Рецептов не найдено';
   for (const hit of hits) {
    const item = document.createElement('button'); item.textContent = hit.label;
    item.onclick = async () => {
     if (!model) return;
     await submit('play-recipe',{server:model.server,recipe:model.recipe,item:hit.id});
     if (model?.recipe === hit.id) el('play-picker').open = false;
    };
    list.append(item);
   }
  } catch (e) { if (scope === version && token === searchId) list.textContent = e.message; }
 },160);
};
pageSelect.onchange = () => select(pageSelect.value);
volume.oninput = () => { dirty = true; };
el('play-craft').onsubmit = async event => {
 event.preventDefault();
 if (model && volume.reportValidity()) await submit('play-volume',{server:model.server,recipe:model.recipe,field:model.field,value:volume.valueAsNumber});
};
async function submit(action,payload) {
 // A background read must not swallow a click between frames.
 if (busy && !pageSelect.disabled) { version++; busy = false; }
 await request(action,payload);
}
el('play-next').onclick=()=>{if(model?.leg?.active)submit('play-next',{server:model.server,from:model.leg.from,to:model.leg.to,index:model.leg.index});};
el('play-procure').onclick=async()=>{
 const button=el('play-procure');if(!model||button.disabled)return;const server=model.server;savingPurchase=true;button.disabled=true;
 try{await api.command({action:'play-procure',page:'craft',server:model.server,recipe:model.recipe,amount:model.units});
 select('shopping');const selector=el('mini-server');selector.value=server;selector.dispatchEvent(new Event('change'));}
 catch(e){el('play-status').textContent=e.message;}finally{savingPurchase=false;button.disabled=!(model?.units>0&&model?.bill?.length);}
};
record.onclick = () => model && submit('play-scanner',{server:model.server,started:model.started});
el('play-main').onclick = () => api.window({action:'main'}).catch(e => { el('play-status').textContent = e.message; });
window.PlayPanel = {select};
})();
