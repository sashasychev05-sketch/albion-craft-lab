(function(){'use strict';
if(!window.DesktopApp?.marketScanner||!window.PriceBook)return;
const api=window.DesktopApp.marketScanner,book=window.PriceBook;
let rowSignature='';
function saveQuotes(rows){
 const offers=[];
 for(const row of rows){
  const sides=row.city==='Black Market'?[['bid','bid']]:[['sell','ask'],['buy','ask'],['bid','bid']];
  for(const [action,side] of sides)offers.push({server:row.server,id:row.item,city:row.city,quality:row.quality,action,price:row[side],timestamp:row[side+'Time']});
 }
 return book.observe(offers,'scanner');
}
const panel=document.createElement('dialog');panel.className='market-scanner';panel.style.cssText='padding:24px;border:1px solid #667368;border-radius:8px;max-width:650px;background:var(--panel,#f8efd8);color:var(--ink,#332d20)';panel.innerHTML='<h3>Сканирование рынка</h3><button type="button" class="button" data-close>Закрыть</button><p>Просматривайте товары в игре — полученные цены поступят в расчёты. Выберите сервер игры перед включением. Считанные предложения сохраняются в «Моих ценах» по городу и качеству. Более поздняя цена заменяет предыдущую.</p><label>Сервер игры <select><option value="europe">Европа</option><option value="west">Америка</option><option value="east">Азия</option></select></label> <button type="button" class="button" data-toggle>Включить сканер рынка</button> <button type="button" class="button" data-overlay>Показать окно поверх игры</button><p role="status" aria-live="polite"></p><p data-cities></p><p>Движок встроен в Albion Lab и работает в фоне. Для захвата нужен установленный Npcap. Цены передаются только в это приложение. Сервер сканирования задаётся здесь независимо от сервера открытого расчёта.</p>';
document.body.append(panel);panel.querySelector('[data-close]').onclick=()=>panel.close();const opener=document.createElement('button');opener.type='button';opener.className='button';opener.textContent='Сканер рынка';opener.onclick=()=>{panel.showModal();};document.querySelector('.header-actions')?.append(opener);const status=panel.querySelector('[role=status]'),toggle=panel.querySelector('[data-toggle]'),select=panel.querySelector('select');let running=false;
function paint(state){const rows=state.quotes||[];running=state.running;const signature=JSON.stringify(rows),changed=signature!==rowSignature;rowSignature=signature;let saveError='';if(changed)try{saveQuotes(rows);}catch(error){rowSignature='';saveError=' · Не удалось сохранить цены: '+error.message;}opener.textContent=running?'Сканер рынка · включён':'Сканер рынка';const counts={};for(const row of rows)if(row.server===select.value)counts[row.city]=(counts[row.city]||0)+1;panel.querySelector('[data-cities]').textContent=Object.entries(counts).map(([city,count])=>city+': '+count).join(' · ');select.disabled=running;toggle.textContent=running?'Выключить сканер рынка':'Включить сканер рынка';status.textContent=(state.configured?'Встроенный сканер готов. ':'Движок отсутствует. Переустановите Albion Lab. ')+(state.message||'')+' · Сохранено ордеров: '+state.orders+saveError;if(changed)document.dispatchEvent(new Event('pricebookchange'));}
async function action(name,arg){toggle.disabled=true;try{paint(await api.action(name,arg));}catch(e){status.textContent=e.message;}finally{toggle.disabled=false;}}
panel.querySelector('[data-overlay]').onclick=()=>action('overlay');toggle.onclick=()=>action(running?'stop':'start',select.value);api.onChanged(paint);action('state');setInterval(()=>api.action('state').then(paint).catch(()=>{}),60000);
})();
