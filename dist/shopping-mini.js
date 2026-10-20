(function(){'use strict';
const api=window.ShoppingWindow,$=id=>document.getElementById(id),fmt=n=>Number(n).toLocaleString('ru-RU',{maximumFractionDigits:2}),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names={Lymhurst:'Люмхурст',Martlock:'Мартлок',Thetford:'Тетфорд',Bridgewatch:'Бриджвотч','Fort Sterling':'Форт Стерлинг',Caerleon:'Карлион',Brecilien:'Бресилиен','Black Market':'Чёрный рынок'},city=c=>names[c]||c||'Город не указан';
let state={server:'europe',groups:[],canUndo:false},server='europe',busy=false,sequence=0,page=0,pageCount=1,cityReady=false,editor=null,resizeFrame;
function message(text,bad=false){$('mini-status').textContent=text;$('mini-status').classList.toggle('error',bad);}
function backgroundOpacity(value){document.documentElement.style.setProperty('--mini-background-opacity',String(value));$('mini-opacity').value=Math.round(value*100);$('mini-opacity-label').textContent=Math.round(value*100)+'%';}
function windowState(value){if(!value)return;document.body.classList.toggle('compact',!!value.compact);$('mini-pin').setAttribute('aria-pressed',String(!!value.pinned));$('mini-compact').textContent=value.compact?'□':'−';$('mini-compact').title=value.compact?'Развернуть список':'Свернуть в полоску';$('mini-compact').setAttribute('aria-label',$('mini-compact').title);backgroundOpacity(value.backgroundOpacity??.65);}
function render(){
 const selected=$('mini-city').value,available=[...new Set(state.groups.map(g=>g.city))];
 $('mini-city').innerHTML='<option value="all">Все города</option>'+available.map(c=>`<option value="${esc(c)}">${esc(city(c))}</option>`).join('');
 $('mini-city').value=cityReady&&(selected==='all'||available.includes(selected))?selected:available[0]??'all';if(available.length)cityReady=true;
 const query=$('mini-search').value.toLocaleLowerCase('ru-RU').replace(/ё/g,'е').trim(),showDone=$('mini-show-done').checked;
 const groups=state.groups.filter(g=>(showDone||g.remaining)&&($('mini-city').value==='all'||g.city===$('mini-city').value)&&[g.name,g.item,city(g.city)].join(' ').toLocaleLowerCase('ru-RU').replace(/ё/g,'е').includes(query));
 const pending=state.groups.filter(g=>g.remaining).length;$('mini-count').textContent=({europe:'Европа',west:'Америка',east:'Азия'}[server])+' · осталось '+pending+' поз.';
 const slot=$('mini-list'),columns=Math.max(1,Math.floor((slot.clientWidth+6)/266)),rows=Math.max(1,Math.floor((slot.clientHeight+6)/84)),size=columns*rows;pageCount=Math.max(1,Math.ceil(groups.length/size));page=Math.max(0,Math.min(page,pageCount-1));slot.style.gridTemplateColumns=`repeat(${columns},minmax(0,1fr))`;
 slot.innerHTML=groups.slice(page*size,(page+1)*size).map(g=>`<article class="mini-row ${g.remaining?'':'done'}" data-mini-row="${esc(g.key)}"><button class="mini-icon" data-mini-edit="${esc(g.key)}" title="Учесть покупку или ордер: ${esc(g.name)}" aria-label="Учесть покупку или ордер: ${esc(g.name)}">${ItemIcons.image(g.item,g.quality,32,true)}</button><div class="mini-title"><strong title="${esc(g.name)}">${esc(g.name)}</strong><b title="Осталось купить">${fmt(g.remaining)} шт.</b></div><small title="${esc(city(g.city))} · качество ${g.quality} · партий ${g.parties}">${$('mini-city').value==='all'?esc(city(g.city))+' · ':''}Куплено ${fmt(g.bought)}/${fmt(g.total)} · Ордер ${fmt(g.ordered)}</small><label class="mini-check" title="Отметить весь остаток"><input type="checkbox" data-mini-all="${esc(g.key)}" aria-label="Отметить весь остаток ${esc(g.name)}" ${!g.remaining?'checked':''} ${!g.remaining||busy?'disabled':''}></label><div class="mini-track" role="progressbar" aria-label="Закуплено ${esc(g.name)}; в ордерах ${g.ordered}" aria-valuenow="${g.bought}" aria-valuemax="${g.total}"><i class="bought" style="width:${g.bought/g.total*100}%"></i><i class="ordered" style="left:${g.bought/g.total*100}%;width:${g.ordered/g.total*100}%"></i></div></article>`).join('')||'<p class="empty">'+(state.groups.length?'По выбранным условиям товаров нет.':'Создайте карточку партии в калькуляторе. Её закупки появятся здесь.')+'</p>';
 $('mini-page').textContent=(page+1)+' / '+pageCount;$('mini-prev').disabled=page===0;$('mini-next').disabled=page>=pageCount-1;
 $('mini-undo').disabled=busy||!state.canUndo;$('mini-server').disabled=busy;$('mini-refresh').disabled=busy;paintEditor();
}
function paintEditor(){
 if(!editor||!$('mini-editor').open)return;const group=state.groups.find(g=>g.key===editor.key),out=$('mini-editor-status');
 const stale=!group||editor.server!==server||group.token!==editor.token,order=editor.mode==='order',maximum=group?(order?group.toOrder:group.remaining):0,value=$('mini-quantity').value,quantity=/^\d+$/.test(value)?Number(value):NaN;
 $('mini-editor-name').textContent=group?.name||'Партия недоступна';$('mini-editor-city').textContent=group?city(group.city)+' · качество '+group.quality:'';
 $('mini-editor-current').textContent=group?'Куплено '+fmt(group.bought)+' / '+fmt(group.total)+' · В ордерах '+fmt(group.ordered):'';
 $('mini-mode-purchase').setAttribute('aria-pressed',String(!order));$('mini-mode-order').setAttribute('aria-pressed',String(order));$('mini-quantity-label').textContent=order?'Поставлено новых ордеров, шт.':'Куплено сейчас, шт.';
 $('mini-save').textContent=order?'Добавить ордер':'Учесть покупку';$('mini-save').disabled=busy||stale||!Number.isSafeInteger(quantity)||quantity<1||quantity>maximum;$('mini-all-editor').disabled=busy||stale||maximum<1;
 out.classList.toggle('stale',stale);if(stale){out.textContent='Остаток изменился. Проверьте его и отредактируйте количество заново.';$('mini-quantity').setAttribute('aria-invalid','true');}else{out.textContent='Доступно: '+fmt(maximum)+' шт.';$('mini-quantity').removeAttribute('aria-invalid');}
}
function openEditor(key){const group=state.groups.find(g=>g.key===key);if(!group)return;editor={server,key,token:group.token,mode:'purchase'};$('mini-quantity').value='';$('mini-editor').showModal();paintEditor();$('mini-quantity').focus();}
function accept(next){if(next.switchServer&&next.server!==server){server=next.server;$('mini-server').value=server;sequence++;busy=false;cityReady=false;page=0;$('mini-editor').close();editor=null;message('');}if(next.server!==server)return;state=next;windowState(next.window);render();if(next.error)message(next.error,true);}
async function command(action,payload={}){
 if(busy)return;const request=++sequence,source=server;busy=true;render();
 try{const next=await api.command({action,server:source,...payload});if(request!==sequence||source!==server)return;accept(next);return next;}
 catch(e){if(source===server)message(String(e.message||e).replace(/^Error invoking remote method '[^']+': (?:Error: )?/,''),true);}
 finally{if(request===sequence){busy=false;render();}}
}
async function record(key,quantity,token,action='purchase'){
 const group=state.groups.find(g=>g.key===key),maximum=group?(action==='order'?group.toOrder:group.remaining):0;
 if(!Number.isSafeInteger(quantity)||quantity<1||quantity>maximum){message('Укажите целое количество от 1 до '+fmt(maximum)+'.',true);render();return;}
 const next=await command(action,{key,quantity,token});if(next){$('mini-editor').close();editor=null;message((action==='order'?'В ордерах добавлено ':'Куплено ')+fmt(quantity)+' шт. Сохранено в партиях.');}
}
if(!api){message('Мини-окно доступно в установленном приложении.',true);return;}
api.onState(accept);
$('mini-list').addEventListener('click',event=>{const button=event.target.closest('[data-mini-edit]');if(button)openEditor(button.dataset.miniEdit);});
$('mini-list').addEventListener('change',event=>{if(event.target.matches('[data-mini-all]')){const g=state.groups.find(g=>g.key===event.target.dataset.miniAll);if(g)record(g.key,g.remaining,g.token);}});
$('mini-quantity').oninput=()=>{if(editor){const g=state.groups.find(g=>g.key===editor.key);if(g&&editor.server===server)editor.token=g.token;}paintEditor();};
$('mini-save').onclick=()=>{if(editor){const value=$('mini-quantity').value;record(editor.key,/^\d+$/.test(value)?Number(value):NaN,editor.token,editor.mode);}};
$('mini-all-editor').onclick=()=>{if(!editor)return;const g=state.groups.find(g=>g.key===editor.key);if(g)record(g.key,editor.mode==='order'?g.toOrder:g.remaining,editor.token,editor.mode);};
$('mini-quantity').onkeydown=event=>{if(event.key==='Enter'&&!$('mini-save').disabled){event.preventDefault();$('mini-save').click();}};
for(const mode of ['purchase','order'])$('mini-mode-'+mode).onclick=()=>{if(editor){editor.mode=mode;paintEditor();}};
$('mini-editor-close').onclick=()=>{$('mini-editor').close();editor=null;};
$('mini-server').onchange=async()=>{server=$('mini-server').value;state={server,groups:[],canUndo:false};cityReady=false;page=0;editor=null;$('mini-editor').close();message('');render();await command('state');};
for(const id of ['mini-search','mini-city','mini-show-done'])$(id).addEventListener(id==='mini-search'?'input':'change',()=>{page=0;render();});
$('mini-prev').onclick=()=>{page--;render();};$('mini-next').onclick=()=>{page++;render();};
$('mini-refresh').onclick=async()=>{const next=await command('state');if(next)message('Список обновлён.');};
$('mini-undo').onclick=async()=>{const next=await command('undo');if(next)message('Последняя общая отметка отменена.');};
async function control(action,value){try{const next=await api.window({action,value});windowState(next);}catch(e){message(e.message,true);}}
$('mini-close').onclick=()=>control('close');$('mini-main').onclick=()=>control('main');$('mini-pin').onclick=()=>control('pin',$('mini-pin').getAttribute('aria-pressed')!=='true');$('mini-compact').onclick=()=>control('compact');
$('mini-settings').onclick=()=>$('mini-options').showModal();$('mini-options-close').onclick=()=>$('mini-options').close();
$('mini-corner').onchange=()=>{if($('mini-corner').value)control('corner',$('mini-corner').value);$('mini-corner').value='';};
$('mini-opacity').oninput=()=>backgroundOpacity(Number($('mini-opacity').value)/100);$('mini-opacity').onchange=()=>control('opacity',Number($('mini-opacity').value)/100);
new ResizeObserver(()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(render);}).observe($('mini-list'));
api.window({action:'state'}).then(async value=>{server=value.server;$('mini-server').value=server;windowState(value);await command('state');}).catch(e=>message(e.message,true));
window.ShoppingMini={snapshot:()=>JSON.parse(JSON.stringify(state)),busy:()=>busy,pagination:()=>({page,pageCount,visible:$('mini-list').querySelectorAll('.mini-row').length})};
})();
