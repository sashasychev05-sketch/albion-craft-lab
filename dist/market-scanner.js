(function(){'use strict';
if(!window.DesktopApp?.marketScanner||!window.PriceBook)return;
const api=window.DesktopApp.marketScanner,book=window.PriceBook;
let rowSignature='',pending=[],flushing=false;
async function flushSaved(){if(flushing||!pending.length)return;flushing=true;
 try{while(pending.length){const batch=pending.slice(0,1000);await api.action('saved-prices',batch);pending.splice(0,batch.length);}}
 catch{status.textContent='История сохранённых цен ожидает записи.';}finally{flushing=false;}}

function saveQuotes(rows){
 const offers=[];
 for(const row of rows){
  const sides=row.city==='Black Market'?[['bid','bid']]:[['sell','ask'],['buy','ask'],['bid','bid']];
  for(const [action,side] of sides)offers.push({server:row.server,id:row.item,city:row.city,quality:row.quality,action,price:row[side],timestamp:row[side+'Time']});
 }
 return book.observe(offers,'scanner',saved=>{pending.push(...saved);flushSaved();});
}
const panel=document.createElement('dialog');panel.className='market-scanner';panel.style.cssText='padding:24px;border:1px solid #667368;border-radius:8px;max-width:650px;background:var(--panel,#f8efd8);color:var(--ink,#332d20)';panel.innerHTML='<h3>Сканирование рынка</h3><button type="button" class="button" data-close>Закрыть</button><p>Просматривайте товары в игре — полученные цены поступят в расчёты. Выберите сервер игры перед включением. Считанные предложения сохраняются в «Моих ценах» по городу и качеству. Более поздняя цена заменяет предыдущую.</p><label>Сервер игры <select><option value="europe">Европа</option><option value="west">Америка</option><option value="east">Азия</option></select></label> <button type="button" class="button" data-toggle>Включить сканер рынка</button> <button type="button" class="button" data-overlay>Показать окно поверх игры</button><p role="status" aria-live="polite"></p><p data-cities></p><p>Движок встроен в Albion Lab и работает в фоне. Для захвата нужен установленный Npcap. Цены передаются только в это приложение. Сервер сканирования задаётся здесь независимо от сервера открытого расчёта.</p>';
document.body.append(panel);panel.querySelector('[data-close]').onclick=()=>panel.close();const opener=document.createElement('button');opener.type='button';opener.className='button';opener.textContent='Сканер рынка';opener.onclick=()=>{panel.showModal();};document.querySelector('.header-actions')?.append(opener);const status=panel.querySelector('[role=status]'),toggle=panel.querySelector('[data-toggle]'),select=panel.querySelector('select');let running=false;
function paint(state){flushSaved();const rows=state.quotes||[];running=state.running;const signature=JSON.stringify(rows),changed=signature!==rowSignature;rowSignature=signature;let saveError='';if(changed)try{saveQuotes(rows);}catch(error){rowSignature='';saveError=' · Не удалось сохранить цены: '+error.message;}opener.textContent=running?'Сканер рынка · включён':'Сканер рынка';const counts={};for(const row of rows)if(row.server===select.value)counts[row.city]=(counts[row.city]||0)+1;panel.querySelector('[data-cities]').textContent=Object.entries(counts).map(([city,count])=>city+': '+count).join(' · ');select.disabled=running;toggle.textContent=running?'Выключить сканер рынка':'Включить сканер рынка';status.textContent=(state.configured?'Встроенный сканер готов. ':'Движок отсутствует. Переустановите Albion Lab. ')+(state.message||'')+' · Сохранено ордеров: '+state.orders+saveError;if(changed)document.dispatchEvent(new Event('pricebookchange'));}
async function action(name,arg){toggle.disabled=true;try{paint(await api.action(name,arg));}catch(e){status.textContent=e.message;}finally{toggle.disabled=false;}}
panel.querySelector('[data-overlay]').onclick=()=>action('overlay');toggle.onclick=()=>action(running?'stop':'start',select.value);const settings=document.createElement('section');
settings.innerHTML='<label><input type="checkbox" data-auto> Запускать сканер с Albion Lab</label><h3>Отчёт за день</h3><label>Дата <input type="date" data-day></label> <button class="button" data-export>Сохранить отчёт</button><p>Локации, ответы городских рынков, ордера, записи в «Мои цены», сделки SAT и порталы выбранного сервера.</p><h3>История цен</h3><label>Предмет, город и качество <select data-series></select></label><p data-trend></p><div data-plot></div><p data-note role="status"></p>';
panel.append(settings);panel.style.overflowY='auto';panel.style.maxHeight='90vh';
const find=s=>settings.querySelector(s),auto=find('[data-auto]'),pref='albion-market-autostart',day=find('[data-day]'),series=find('[data-series]');
const today=new Date();day.value=new Date(today-today.getTimezoneOffset()*60000).toISOString().slice(0,10);
const region=localStorage.getItem(pref);auto.checked=['europe','west','east'].includes(region);if(auto.checked)select.value=region;
function savePref(){if(auto.checked)localStorage.setItem(pref,select.value);else localStorage.removeItem(pref);}
auto.onchange=savePref;select.onchange=()=>{savePref();seriesList();};
find('[data-export]').onclick=async()=>{try{const start=new Date(day.value+'T00:00:00'),end=new Date(start);end.setDate(end.getDate()+1);
 if(await api.action('activity-export',{server:select.value,start:+start,end:+end}))find('[data-note]').textContent='Отчёт сохранён';}catch(e){find('[data-note]').textContent=e.message;}};
function seriesList(){const previous=series.value;series.replaceChildren();for(const [key,entry] of Object.entries(book.snapshot().entries)){const [server,id,city,q,side]=key.split('|');if(server!==select.value||!['bid','sell'].includes(side))continue;
 series.append(new Option((window.ALBION_DATA?.names?.[id]||id)+' · '+city+' · Q'+q+' · '+(side==='sell'?'продажа':'спрос'),key));}
 if([...series.options].some(o=>o.value===previous))series.value=previous;plot();}
async function plot(){const key=series.value,slot=find('[data-plot]');slot.replaceChildren();find('[data-trend]').textContent='';if(!key)return;
 const [server,item,city,q,side]=key.split('|');try{const points=await api.action('price-history',{server,item,city,quality:Number(q),side});if(series.value!==key)return;
 find('[data-trend]').textContent=points.length?'Последняя цена: '+points.at(-1).price+' · '+new Date(points.at(-1).at).toLocaleString('ru')+' · наблюдений: '+points.length:'Пока нет сохранённых наблюдений сканера.';
 if(points.length>1){const prices=points.map(p=>p.price),lo=Math.min(...prices),hi=Math.max(...prices),first=points[0].at,span=points.at(-1).at-first;
 const coords=points.map(p=>[4+(p.at-first)/Math.max(1,span)*392,64-(p.price-lo)/Math.max(1,hi-lo)*56].join(',')).join(' ');
 slot.innerHTML='<svg viewBox="0 0 400 72" role="img" aria-label="Цена по времени"><polyline stroke="currentColor" stroke-width="2" fill="none" points="'+coords+'"/></svg>';}}
 catch(e){find('[data-note]').textContent=e.message;}}
series.onchange=plot;opener.addEventListener('click',seriesList);document.addEventListener('pricebookchange',()=>{if(panel.open)seriesList();});
api.onChanged(paint);if(auto.checked)action('auto-start',region);else action('state');setInterval(()=>api.action('state').then(paint).catch(()=>{}),60000);
})();
