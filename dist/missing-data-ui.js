(function(){'use strict';
const $=id=>document.getElementById(id),craftModes=['food','potions','gear','refine'];
const dialog=document.createElement('dialog');dialog.id='missing-data-dialog';dialog.className='missing-data-dialog';dialog.setAttribute('aria-labelledby','missing-data-title');dialog.setAttribute('aria-describedby','missing-data-context');document.body.append(dialog);
let session=null;
function mode(){return Workspace.activeMode();}
function context(){const active=mode(),character=window.CharacterProfiles?.snapshot().active||'primary';if(active==='luxury'){const state=LuxuryUI.captureDraft(),c=state.drafts[state.server+'|'+state.selected];return JSON.stringify({mode:active,character,item:state.selected,settings:[c.buyCity,c.sellCity,c.buyMode,c.sellMode,c.quantityMode]});}const {recipe,config:c,result:r}=CraftApp.snapshot();return JSON.stringify({mode:active,character,recipe:recipe.id,settings:[c.quality,c.craftPlace,c.craftCity,c.recipeIndex,c.sellCity,c.saleMode,c.focus,c.volumeMode,r.perOp,c.chain,c.startTier,c.heartMode,c.refineSteps,c.foodIngredientSteps,c.makeSauce,c.sauceFish,c.journalId,c.journalCity]});}
function source(id,label,extra={}){const node=$(id);return {source:id,label,min:Number(node.min||0),max:node.max===''?null:Number(node.max),step:'any',...extra};}
function collect(){
 const active=mode(),fields=[];
 if(craftModes.includes(active)){
  const {recipe,config:c,result:r}=CraftApp.snapshot();if(r.planErrors?.length)return [];
  if(c.craftPlace==='hideout'&&(c.hideoutBaseReturn===null||c.hideoutBaseReturn===undefined||c.hideoutBaseReturn===''))fields.push(source('hideout-return','Возврат в убежище без фокуса, %',{hint:'Посмотрите значение в окне станка с выключенным фокусом.'}));
  if(!r.amount){const automatic=c.focus&&c.volumeMode==='focus'&&['food','potions','gear','bags'].includes(recipe.kind);fields.push(automatic?source('focus-budget','Бюджет фокуса',{min:Math.max(1,r.perOp),step:'1',hint:'Для одной операции нужно '+r.perOp.toLocaleString('ru-RU')+' фокуса.'}):source('quantity','Готовых предметов',{min:recipe.output,step:'1',hint:'Один крафт даёт '+recipe.output+' шт.'}));}
  const loading=$('sale-status').textContent.includes('Загружаем');
  if(!loading){
   if(!r.sales&&!(c.salePrice>0))fields.push(source('sale-price','Цена продажи / шт., серебро',{min:.01,hint:'Город продажи: '+c.sellCity+'.'}));
   for(const material of r.bill.filter(m=>!m.allocation&&!(m.price>0)))fields.push({material:material.id,label:ALBION_DATA.names[material.id]||material.id,quality:material.preserveQuality?c.quality:1,city:material.city,min:.01,max:null,step:'any'});
   if(r.journals?.supported&&r.journals.count>0){
    const city=c.journalCity||(c.sellCity==='Black Market'?c.craftCity:c.sellCity);
    if(!(r.journals.emptyPrice>0))fields.push(source('craft-journal-empty','Пустой журнал / шт., серебро',{min:.01,event:'change',hint:'Город журналов: '+city+'.'}));
    if(!(r.journals.fullPrice>0))fields.push(source('craft-journal-full','Полный журнал / шт., серебро',{min:.01,event:'change',hint:'Город журналов: '+city+'.'}));
   }
  }
 }else if(active==='luxury'){
  const state=LuxuryUI.captureDraft(),c=state.drafts[state.server+'|'+state.selected],item=LUXURY_DATA.find(x=>x.id===state.selected);if(!c||!item)return [];
  const automatic=c.quantityMode==='capacity';
  if(automatic&&Math.floor(c.capacity/item.weight)<1)fields.push(source('art-capacity','Свободная грузоподъёмность, кг',{min:item.weight,hint:'Один предмет весит '+item.weight.toLocaleString('ru-RU')+' кг.'}));
  if(!automatic&&!(c.quantity>0))fields.push(source('art-quantity','Количество предметов',{min:1,step:'1'}));
  if(!automatic&&!(c.capacity>0))fields.push(source('art-capacity','Свободная грузоподъёмность, кг',{min:.01}));
  if(!$('art-price-status').textContent.includes('Загружаем')){
   if(!(c.buyPrice>0))fields.push(source('art-buy-price','Цена покупки / шт., серебро',{min:.01,hint:'Город покупки: '+c.buyCity+'.'}));
   if(!(c.sellPrice>0))fields.push(source('art-sell-price','Цена продажи / шт., серебро',{min:.01,hint:'Город продажи: '+c.sellCity+'.'}));
  }
 }
 return fields;
}
function validContext(previous){return Workspace.accept(previous.ticket)&&previous.context===context();}
function restoreFocus(previous){if(dialog.open||!validContext(previous))return;const direct=previous.focus;if(direct?.isConnected&&direct.checkVisibility())direct.focus({preventScroll:true});else{const help=$(previous.key+'-help'),button=help?.querySelector('button'),card=$(previous.key+'-jump-result');if(button?.checkVisibility())button.focus({preventScroll:true});else if(card?.checkVisibility())card.focus({preventScroll:true});}}
function close(restore=true){const previous=session;session=null;if(dialog.open)dialog.close();if(previous&&restore)setTimeout(()=>restoreFocus(previous),0);}
function inputField(spec,index){
 const label=document.createElement('label');label.className='field missing-data-field';label.append(document.createTextNode(spec.material?'Цена / шт., серебро':spec.label));
 const input=document.createElement('input');input.type='number';input.id='missing-data-'+(spec.source||'material-'+index);input.required=true;input.min=String(spec.min);input.step=spec.step;if(spec.max!==null)input.max=String(spec.max);input.placeholder='Введите значение';
 if(spec.source)input.dataset.missingSource=spec.source;else input.dataset.missingMaterial=spec.material;
 label.append(input);if(spec.hint){const hint=document.createElement('small');hint.textContent=spec.hint;label.append(hint);}spec.input=input;return label;
}
function open(){
 if(dialog.open){dialog.querySelector('input')?.focus();return true;}if(document.querySelector('dialog[open]'))return false;
 const fields=collect();if(!fields.length)return false;
 const key=mode()==='luxury'?'lux':'craft';session={fields,key,ticket:Workspace.ticket(),context:context(),focus:$(key+'-help').querySelector('button'),scroll:scrollY};
 dialog.innerHTML='<form novalidate><div class="missing-data-heading"><h2 id="missing-data-title">Заполнить данные</h2><button id="missing-data-close" type="button" aria-label="Закрыть">×</button></div><p id="missing-data-context" class="hint"></p><p class="missing-data-hint">Введите значения из игры. Цены сохранятся как ручные для этой партии.</p><div id="missing-data-fields" class="missing-data-fields"></div><p id="missing-data-error" role="alert" hidden></p><div class="missing-data-actions"><button type="submit" class="button primary" id="missing-data-apply">Применить</button><button type="button" class="button" id="missing-data-cancel">Отмена</button></div></form>';
 $('missing-data-context').textContent=$(key+'-selection').textContent+' · '+$('server').selectedOptions[0].textContent+' · '+($('active-character').selectedOptions[0]?.textContent||'Персонаж');
 const host=$('missing-data-fields');fields.forEach((spec,index)=>{
  if(!spec.material){host.append(inputField(spec,index));return;}
  const row=document.createElement('section');row.className='missing-material-row';const heading=document.createElement('div');heading.className='missing-material-name';heading.innerHTML=ItemIcons.image(spec.material,spec.quality,32);const name=document.createElement('span');name.textContent=spec.label;heading.append(name);
  const grid=document.createElement('div');grid.className='grid2';const cityLabel=document.createElement('label');cityLabel.className='field missing-data-field';cityLabel.textContent='Город закупки';const city=document.createElement('select');city.dataset.missingCity=spec.material;
  const original=$('materials').querySelector('[data-city="'+CSS.escape(spec.material)+'"]');for(const option of original.options)city.append(new Option(option.textContent,option.value));city.value=spec.city;spec.cityInput=city;cityLabel.append(city);grid.append(cityLabel,inputField(spec,index));row.append(heading,grid);host.append(row);
 });
 $('missing-data-close').onclick=()=>close();$('missing-data-cancel').onclick=()=>close();dialog.querySelector('form').onsubmit=apply;dialog.showModal();fields[0].input.focus();return true;
}
function apply(event){
 event.preventDefault();const previous=session;if(!previous)return;
 if(!validContext(previous)){close(false);return;}
 $('missing-data-error').hidden=true;
 for(const spec of previous.fields){const input=spec.input;input.setCustomValidity('');if(!Number.isFinite(input.valueAsNumber))input.setCustomValidity('Введите число.');if(!input.reportValidity())return;}
 const materials=previous.fields.filter(f=>f.material).map(f=>({id:f.material,patch:{price:f.input.valueAsNumber,city:f.cityInput.value}}));
 try{
  // Validate every destination before changing the current calculation.
  for(const spec of previous.fields){if(spec.source&&(!$(spec.source)||$(spec.source).disabled))throw Error('Параметры изменились. Откройте окно заново.');}
  if(materials.length)CraftApp.editMaterials(materials);
  for(const spec of previous.fields.filter(f=>f.source)){const target=$(spec.source);target.value=spec.input.value;target.dispatchEvent(new Event(spec.event||'input',{bubbles:true}));}
  Workspace.capture();AdvancedSettings.sync();window.scrollTo({top:previous.scroll,behavior:'instant'});close();
 }catch(error){$('missing-data-error').textContent=error.message;$('missing-data-error').hidden=false;}
}
function attach(key){
 if($(key+'-readiness').dataset.state!=='needs'||!collect().length)return;
 const help=$(key+'-help');let button=help.querySelector('button');if(button?.dataset.missingData)return;
 if(!button){button=document.createElement('button');button.type='button';button.className='button';help.append(button);if(key==='craft'&&CraftApp.snapshot().result.journals?.missing){$(key+'-readiness').textContent='Нужны цены журналов';help.querySelector('p').textContent='Заполните цены ремесленных журналов.';}}
 const original=button.onclick;button.textContent='Заполнить данные';button.dataset.missingData='true';button.onclick=()=>{if(!open())original?.();};
}
dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
document.addEventListener('workspacechange',()=>{if(session&&!validContext(session))close(false);});
window.MissingDataUI={open,attach};if(craftModes.includes(mode())||mode()==='luxury')attach(mode()==='luxury'?'lux':'craft');
})();
