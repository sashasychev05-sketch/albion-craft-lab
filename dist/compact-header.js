(function(){'use strict';
const $=id=>document.getElementById(id),toolbar=document.querySelector('.header-actions'),cabinet=document.querySelector('.account-menu'),items=cabinet.querySelector('.account-menu-items'),view=document.querySelector('.interface-menu'),updates=document.querySelector('.desktop-updates');
toolbar.classList.add('compact-header');cabinet.classList.add('header-more');cabinet.setAttribute('data-keep-open','');cabinet.setAttribute('data-fold-ignore','');delete cabinet.dataset.foldSaved;cabinet.open=false;
const summary=cabinet.querySelector(':scope>summary');summary.id='header-more';summary.setAttribute('aria-label','Действия и настройки');summary.setAttribute('aria-controls','header-more-items');summary.innerHTML='<span>Ещё</span><span aria-hidden="true">▾</span><span id="header-update-badge" hidden>Обновление</span>';
items.id='header-more-items';items.setAttribute('aria-label','Действия и настройки');const group=document.createElement('section');group.className='header-data-actions';group.innerHTML='<h3>Мои данные</h3>';group.append(...items.children);items.append(group);
const characters=document.querySelector('.account-character');characters.querySelector('span').textContent='Персонажи и мастерства';characters.title='Персонажи и мастерства';characters.setAttribute('aria-label','Персонажи и мастерства');group.querySelector('h3').after(characters);
$('account-masteries').hidden=true;$('account-masteries').setAttribute('data-header-duplicate','');
view.setAttribute('data-fold-ignore','');delete view.dataset.foldSaved;view.open=false;view.querySelector('summary').textContent='Настройки вида ▾';items.append(view);
const context=document.createElement('div');context.className='header-context';context.append($('server').closest('label'),document.querySelector('.account-controls'));
toolbar.append(context,cabinet);
const notice=document.createElement('div');notice.id='header-update-notice';notice.className='header-update-notice';notice.hidden=true;
const status=$('app-update-status'),progress=$('app-update-progress'),updateButton=$('app-update');
if(updates){const section=document.createElement('section');section.className='header-update-settings';section.innerHTML='<h3>Приложение</h3>';section.append(updates);items.append(section);notice.append(status,progress);const action=document.createElement('button');action.id='header-update-action';action.className='button';action.type='button';action.onclick=()=>{close(false);updateButton.click();};notice.append(action);toolbar.after(notice);}
function place(){if(!cabinet.open)return;const r=summary.getBoundingClientRect(),width=items.getBoundingClientRect().width,below=innerHeight-r.bottom-18;items.style.maxHeight=Math.max(60,below>=80?below:r.top-18)+'px';const top=below>=80?r.bottom+6:Math.max(8,r.top-items.getBoundingClientRect().height-6);items.style.left=Math.max(8,Math.min(r.right-width,innerWidth-width-8))+'px';items.style.top=top+'px';}
function close(focus=false){const wasOpen=cabinet.open;cabinet.open=false;view.open=false;summary.setAttribute('aria-expanded','false');if(focus&&wasOpen)summary.focus({preventScroll:true});}
cabinet.addEventListener('toggle',()=>{summary.setAttribute('aria-expanded',String(cabinet.open));if(cabinet.open){items.scrollTop=0;place();}else view.open=false;});summary.setAttribute('aria-expanded','false');
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&cabinet.open&&!document.querySelector('dialog[open]')){event.preventDefault();event.stopPropagation();close(true);}if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'&&cabinet.open&&!document.querySelector('dialog[open]')){close(false);$('command-search-open').focus({preventScroll:true});}},true);
for(const id of ['command-search-open','sidebar-toggle','refresh'])$(id).addEventListener('click',()=>close(false),true);
group.addEventListener('click',event=>{if(event.target.closest('button'))close(false);},true);
document.addEventListener('click',event=>{if(!cabinet.contains(event.target))close(false);});
document.addEventListener('workspacechange',event=>{if(event.detail?.navigation)close(false);});
window.addEventListener('resize',place);window.addEventListener('scroll',()=>{if(!cabinet.open)return;const r=summary.getBoundingClientRect();if(r.bottom<0||r.top>innerHeight)close(false);else place();});
function syncUpdate(){if(!updates)return;const phase=updateButton.dataset.updatePhase||'idle',action=$('header-update-action');notice.hidden=status.hidden||!status.textContent;action.textContent=updateButton.textContent;action.disabled=updateButton.disabled;action.hidden=!['available','downloading','ready','installing','error'].includes(phase);$('header-update-badge').hidden=!['available','ready'].includes(phase);if(cabinet.open)place();}
if(updates){new MutationObserver(syncUpdate).observe(updates,{attributes:true,childList:true,subtree:true});new MutationObserver(syncUpdate).observe(status,{attributes:true,childList:true,subtree:true});new MutationObserver(syncUpdate).observe(progress,{attributes:true});syncUpdate();}
window.CompactHeaderUI={close,open(){cabinet.open=true;place();},syncUpdate};
})();
