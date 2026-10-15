(function(){'use strict';
const M=window.ScreenLayoutModel,$=id=>document.getElementById(id),main=document.querySelector('main'),registry=new Map(),craftModes=new Set(['food','potions','gear','bags','refine']);
let saved=M.empty(),readError='',draft=null,context=null,pending=false;
try{saved=M.read(localStorage);}catch{readError='Не удалось прочитать прежний вид. После применения новые настройки заменят его.';}
const title=node=>(node.querySelector(':scope>summary .advanced-title')?.textContent||node.querySelector(':scope>summary')?.firstChild?.textContent||node.querySelector('h2,h3')?.textContent||node.getAttribute('aria-label')||'Блок').replace(/^\d+\.\s*/,'').replace(/\s+/g,' ').trim();
function group(parent,id,label,nodes){return {parent,id,label,blocks:nodes.map(node=>{const field=node.querySelector('input[id],select[id],textarea[id]'),stable=node.matches('.wide-fold')?'comparison':node.matches('.source-info')?'sources':node.id||node.dataset.foldId||field?.id||title(node).slice(0,150),key=id+':'+stable;node.dataset.screenBlock=key;return {id:key,group:id,node,label:title(node),hideable:true};})};}
function register(scope){
 const groups=[],steps=scope.querySelector(':scope>.flow-layout>.flow-steps');
 if(steps)groups.push(group(steps,'parameters','Параметры расчёта',[...steps.children].filter(n=>n.matches('.step-card,.advanced-settings'))));
 const lower=[...scope.children].filter(n=>n.matches('.panel,.wide-fold,.source-info'));
 if(lower.length)groups.push(group(scope,'tables','Таблицы и сведения',lower));
 if(scope.id==='character-content')groups.push(group(scope.querySelector('.character-layout'),'preview','Проверка фокуса',[scope.querySelector('.character-preview')]));
 const banner=document.createElement('div');banner.className='screen-layout-notice';banner.hidden=true;const status=document.createElement('span'),button=document.createElement('button');button.className='button';button.type='button';button.textContent='Настроить экран';button.onclick=open;banner.append(status,button);scope.prepend(banner);
 registry.set(scope.id,{scope,groups,blocks:groups.flatMap(g=>g.blocks),banner,status});
}
for(const id of new Set(['craft-content','luxury-content',...[...document.querySelectorAll('button.nav[data-mode]')].map(b=>b.dataset.mode+'-content')])){const scope=$(id);if(scope)register(scope);}
function current(){const mode=Workspace.activeMode(),key=mode==='bags'?'gear':mode,entry=registry.get(craftModes.has(mode)?'craft-content':mode+'-content');if(!Workspace.ticket().tabId||!entry||entry.scope.hidden)return null;for(const block of entry.blocks)block.label=title(block.node);return {mode:key,entry};}
function reorder(group,order){
 const nodes=order.map(id=>group.blocks.find(b=>b.id===id)?.node).filter(Boolean),present=[...group.parent.children].filter(n=>nodes.includes(n));
 if(present.every((n,i)=>n===nodes[i]))return;
 // Replace only the original block slots. Other controls keep their positions.
 const anchors=present.map(n=>{const anchor=document.createComment('screen-block');n.replaceWith(anchor);return anchor;});anchors.forEach((anchor,i)=>anchor.replaceWith(nodes[i]));
}
function apply(){
 const active=current();if(!active){opener.disabled=true;return;}const {mode,entry}=active,value=M.normalize(saved.modes[mode],entry.blocks);
 for(const group of entry.groups){reorder(group,value.order);for(const block of group.blocks)block.node.classList.toggle('screen-block-hidden',value.hidden.includes(block.id));if(group.id==='parameters'){const empty=group.blocks.every(b=>value.hidden.includes(b.id)||b.node.hidden);group.parent.classList.toggle('screen-layout-empty',empty);group.parent.parentElement.classList.toggle('screen-layout-result-only',empty);}}
 if(mode==='character')entry.scope.querySelector('.character-layout').classList.toggle('screen-layout-no-preview',value.hidden.includes(entry.blocks[0]?.id));
 const count=value.hidden.length,message=count?'Скрыто блоков: '+count:'';
 if(entry.status.textContent!==message)entry.status.textContent=message;entry.banner.hidden=!count;
 opener.disabled=!entry.blocks.length;
}
function persist(){try{localStorage.setItem(M.KEY,JSON.stringify(saved));readError='';return true;}catch{error.textContent='Не удалось сохранить вид. Проверьте доступное место и повторите.';return false;}}
function changed(){document.dispatchEvent(new CustomEvent('screenlayoutchange'));}
const opener=document.createElement('button');opener.type='button';opener.className='button';opener.id='screen-layout-open';opener.textContent='Настроить экран';opener.onclick=open;document.querySelector('.interface-options h3').after(opener);
const dialog=document.createElement('dialog');dialog.id='screen-layout-dialog';dialog.className='screen-layout-dialog';dialog.setAttribute('aria-labelledby','screen-layout-title');dialog.setAttribute('aria-describedby','screen-layout-description');
dialog.innerHTML='<div class="screen-layout-heading"><div><h2 id="screen-layout-title">Настроить экран</h2><p id="screen-layout-section"></p></div><button id="screen-layout-close" class="button" type="button" aria-label="Закрыть настройки экрана">✕</button></div><p id="screen-layout-description">Порядок меняется внутри каждой группы. Скрытие сохраняет введённые данные. Результат остаётся рядом с расчётом.</p><div id="screen-layout-list"></div><p id="screen-layout-error" role="alert"></p><p id="screen-layout-status" class="sr-only" role="status"></p><div class="screen-layout-footer"><button id="screen-layout-default" class="button" type="button">Обычный вид раздела</button><div><button id="screen-layout-cancel" class="button" type="button">Отмена</button><button id="screen-layout-apply" class="button primary" type="button">Применить</button></div></div>';
document.body.append(dialog);const list=$('screen-layout-list'),error=$('screen-layout-error');
function render(focusId,action){
 list.replaceChildren();const {entry}=context;
 for(const group of entry.groups){if(!group.blocks.length)continue;const section=document.createElement('section'),heading=document.createElement('h3'),items=document.createElement('ol');heading.textContent=group.label;items.className='screen-layout-blocks';section.append(heading,items);
  const ordered=draft.order.map(id=>group.blocks.find(b=>b.id===id)).filter(Boolean);
  ordered.forEach((block,index)=>{const row=document.createElement('li'),label=document.createElement('label'),check=document.createElement('input'),copy=document.createElement('span'),buttons=document.createElement('div');row.dataset.layoutRow=block.id;check.type='checkbox';check.checked=!draft.hidden.includes(block.id);check.dataset.layoutAction='visibility';copy.textContent=block.label;label.append(check,copy);
   if(block.node.hidden){const note=document.createElement('small');note.textContent='В текущем расчёте не используется';copy.append(note);}
   check.onchange=()=>{draft=M.visible(draft,entry.blocks,block.id,check.checked);announce(block.label+(check.checked?' будет показан':' будет скрыт'));};
   for(const [offset,text,kind]of [[-1,'↑','up'],[1,'↓','down']]){const button=document.createElement('button');button.type='button';button.className='button';button.textContent=text;button.dataset.layoutAction=kind;button.setAttribute('aria-label',(offset<0?'Выше: ':'Ниже: ')+block.label);button.disabled=offset<0?index===0:index===ordered.length-1;button.onclick=()=>{draft=M.move(draft,entry.blocks,block.id,offset);render(block.id,kind);announce(block.label+': позиция '+(draft.order.filter(id=>group.blocks.some(b=>b.id===id)).indexOf(block.id)+1));};buttons.append(button);}
   row.append(label,buttons);items.append(row);
  });list.append(section);
 }
 if(context.entry.scope.querySelector('.outcome')){const note=document.createElement('p');note.className='hint';note.textContent='Результат партии всегда виден. Его закрепление можно изменить в настройках вида.';list.append(note);}
 if(focusId){const row=[...list.querySelectorAll('[data-layout-row]')].find(n=>n.dataset.layoutRow===focusId),wanted=row?.querySelector('[data-layout-action="'+action+'"]');(wanted&&!wanted.disabled?wanted:row?.querySelector('input')).focus({preventScroll:true});row?.scrollIntoView({block:'nearest',behavior:'instant'});}
}
function announce(message){$('screen-layout-status').textContent=message;}
function open(){
 const active=current();if(!active||document.querySelector('dialog[open]'))return;context={...active,ticket:Workspace.ticket(),focus:document.activeElement,scroll:window.scrollY};draft=M.normalize(saved.modes[active.mode],active.entry.blocks);CompactHeaderUI.close();$('screen-layout-section').textContent=document.querySelector('button.nav.active .nav-copy b')?.textContent||active.mode;error.textContent=readError;render();dialog.showModal();$('screen-layout-close').focus({preventScroll:true});
}
function sameContext(){const active=current();return active?.mode===context?.mode&&Workspace.accept(context?.ticket);}
function restoreFocus(previous){if(!previous)return;const target=previous.focus!==document.body&&previous.focus?.checkVisibility()?previous.focus:$('header-more');target.focus({preventScroll:true});window.scrollTo({top:previous.scroll,behavior:'instant'});}
function close(restore=true){if(!dialog.open)return;const previous=context;context=null;draft=null;dialog.close();if(restore!==false)restoreFocus(previous);}
// A previous close event may arrive after another screen has opened the dialog.
dialog.addEventListener('close',()=>{if(dialog.open||!context)return;const previous=context;context=null;draft=null;restoreFocus(previous);});
dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
$('screen-layout-close').onclick=close;$('screen-layout-cancel').onclick=close;
$('screen-layout-default').onclick=()=>{draft=M.normalize(null,context.entry.blocks);render();announce('Обычный вид подготовлен. Нажмите «Применить», чтобы сохранить.');};
$('screen-layout-apply').onclick=()=>{if(!sameContext()){close(false);return;}const previous=saved;saved=M.update(saved,context.mode,draft,context.entry.blocks);if(!persist()){saved=previous;return;}apply();close();changed();};
function reveal(target){const active=current();if(!active)return;let value=M.normalize(saved.modes[active.mode],active.entry.blocks),changed=false;
 for(const block of active.entry.blocks)if((block.node===target||block.node.contains(target))&&value.hidden.includes(block.id)){value=M.visible(value,active.entry.blocks,block.id,true);changed=true;}
 if(changed){const previous=saved;saved=M.update(saved,active.mode,value,active.entry.blocks);if(!persist())saved=previous;apply();document.dispatchEvent(new CustomEvent('screenlayoutchange'));}
}
const reset=$('view-reset'),originalReset=reset.onclick;reset.onclick=event=>{originalReset?.(event);const previous=saved;saved=M.empty();if(!persist())saved=previous;apply();changed();};
document.addEventListener('workspacechange',()=>{if(dialog.open&&!sameContext())close(false);apply();});
// Rendering updates tables inside blocks; apply only when their containing layout changes.
new MutationObserver(()=>{if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;apply();});}).observe(main,{childList:true,subtree:true});
window.ScreenLayout={open,close,apply,reveal,set(value){const active=current();if(!active)return false;const previous=saved;saved=M.update(saved,active.mode,value,active.entry.blocks);if(!persist()){saved=previous;return false;}apply();changed();return true;},snapshot(){const active=current();return active?{mode:active.mode,blocks:active.entry.blocks.map(({id,group,label,node})=>({id,group,label,available:!node.hidden})),value:M.normalize(saved.modes[active.mode],active.entry.blocks)}:null;}};
const luxFind=$('luxury-content').querySelector('.outcome>.button.primary');luxFind.addEventListener('click',()=>{reveal($('art-routes').closest('.panel'));},true);
apply();
})();
