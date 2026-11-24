(() => {
 'use strict';
 const byId = id => document.getElementById(id);
 const host = byId('craft-content');
 const sheet = document.createElement('section');
 sheet.className = 'field-workshop';
 sheet.innerHTML = `<div class="field-recipe"><h2>Мастерская</h2><div id="field-item-icon"></div><strong id="field-recipe"></strong><small id="field-place"></small><label>Рецепт<input id="field-search" type="search" placeholder="Название или ID" maxlength="100" autocomplete="off"></label><div id="field-hits"></div></div>
 <div class="field-bill"><h3>Список закупок</h3><label id="field-journals"><input type="checkbox"> Учитывать журналы</label><ul id="field-materials"></ul><button type="button" id="field-prices">Цены и города закупки ↓</button></div>
 <div class="field-ledger"><h3>Чистая прибыль</h3><strong id="field-profit"></strong><small id="field-cost"></small><form><label id="field-volume-label" for="field-volume"></label><input id="field-volume" type="number" required step="1"><button>Пересчитать</button></form><button type="button" id="field-overlay">Открыть поверх игры</button><small id="field-status" role="status"></small></div>`;
 host.prepend(sheet);
 const input=byId('field-volume'), search=byId('field-search'), journal=byId('field-journals').firstElementChild;
 let current, matches=[];
 function render(){
  const {recipe,config,result,server}=CraftApp.snapshot();if(!result)return;
  const field=byId('quantity').disabled?'focus-budget':'quantity', source=byId(field);
  const identity=[recipe.id,server,field].join('|');
  if(identity!==current || document.activeElement!==input)input.value=source.value;
  if(identity!==current){search.value='';byId('field-hits').replaceChildren();}
  current=identity; input.min=source.min;input.max=source.max;
  byId('field-volume-label').textContent=field==='quantity'?'Готовых предметов':'Бюджет фокуса';
  byId('field-item-icon').innerHTML=ItemIcons.image(recipe.id,config.quality||1,64);
  byId('field-recipe').textContent=recipe.name;byId('field-place').textContent='T'+recipe.tier+'.'+(recipe.ench||0)+' · '+config.craftCity;
  byId('field-profit').textContent=byId('profit').textContent;byId('field-cost').textContent='Затраты · '+byId('cost').textContent;
  const nodes=result.bill.filter(m=>m.buy>0).map(m=>{
   const li=document.createElement('li'),name=document.createElement('span'),qty=document.createElement('b');
   li.innerHTML=ItemIcons.image(m.id,1,32);name.textContent=ALBION_DATA.names[m.id]||m.id;qty.textContent=m.buy.toLocaleString('ru')+' шт.';li.append(name,qty);return li;
  });byId('field-materials').replaceChildren(...nodes);
  const toggle=byId('craft-with-journals');byId('field-journals').hidden=!toggle||toggle.disabled;journal.checked=!!toggle?.checked;
 }
 search.oninput=()=>{const list=byId('field-hits'),q=search.value.trim().toLocaleLowerCase('ru');list.replaceChildren();if(!q)return;
  const kind=CraftApp.snapshot().recipe.kind;
  matches=ALBION_DATA.recipes.filter(r=>r.kind===kind&&(r.name+' '+r.id).toLocaleLowerCase('ru').includes(q)).slice(0,16);
  for(const r of matches){const b=document.createElement('button');b.type='button';b.textContent=r.name+' · '+r.tier+'.'+(r.ench||0);
   b.onclick=()=>{Workspace.selectItem(r.id);search.value='';list.replaceChildren();};list.append(b);}
  if(!matches.length)list.textContent='Рецептов не найдено';
 };
 sheet.querySelector('form').onsubmit=e=>{e.preventDefault();const source=byId(byId('quantity').disabled?'focus-budget':'quantity');if(input.reportValidity()){source.value=input.value;source.dispatchEvent(new Event('input',{bubbles:true}));}};
 journal.onchange=()=>{const t=byId('craft-with-journals');if(t.checked!==journal.checked)t.click();};
 byId('field-overlay').hidden=!window.DesktopApp?.shopping;
 byId('field-overlay').onclick=()=>DesktopApp.shopping.open(CraftApp.snapshot().server,'craft').catch(e=>byId('field-status').textContent=e.message);
 byId('field-prices').onclick=()=>{const table=byId('materials');for(let p=table.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;table.scrollIntoView({block:'center'});};
 window.FieldWorkshop={render};render();
 const nav=document.createElement('nav');nav.className='field-nav';nav.setAttribute('aria-label','Игровые разделы');
 const links=[['Атлас',()=>document.querySelector('button[data-mode="avalon"]').click()],['Мастерская',()=>document.querySelector('button[data-mode="'+(CraftApp.snapshot().recipe.kind==='bags'?'gear':CraftApp.snapshot().recipe.kind)+'"]').click()],['Сессия',()=>byId('game-session-open')?.click()]];
 for(const [name,open] of links){if(name==='Сессия'){const session=byId('game-session-open');if(session){session.textContent='Сессия';nav.append(session);}continue;}const b=document.createElement('button');b.type='button';b.textContent=name;b.onclick=open;nav.append(b);}
 byId('craft-content').before(nav);
})();
