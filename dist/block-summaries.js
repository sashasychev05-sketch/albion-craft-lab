(function(){'use strict';
const M=window.BlockSummaryModel,$=id=>document.getElementById(id),main=document.querySelector('main'),entries=new Map();let pending=false;
const hide=(node,value)=>{if(node.hidden!==value)node.hidden=value;};
function activeScope(){const mode=Workspace.activeMode();return $((['food','potions','gear','refine'].includes(mode)?'craft':mode)+'-content');}
function relevant(node,host){if(node.type==='hidden'||node.closest('details'))return false;for(let p=node;p&&p!==host;p=p.parentElement)if(p.hidden)return false;return true;}
function label(node){const original=node.closest('label');if(!original)return node.getAttribute('aria-label')||'';const text=n=>n.nodeType===3?n.textContent:['INPUT','SELECT','TEXTAREA','BUTTON','SMALL'].includes(n.nodeName)?'':[...n.childNodes].map(text).join(' ');return text(original).replace(/\s+/g,' ').trim();}
function read(host){
 const scope=host.closest('[id$="-content"]');
 if(scope.id==='craft-content'){
  const kind=host.querySelector('#product')?'item':host.querySelector('#quantity')?'production':host.querySelector('#sale-price')?'sale':null;
  if(kind)return M.craft(kind,CraftApp.snapshot());
 }
 if(scope.id==='luxury-content'){
  const state=LuxuryUI.captureDraft(),config=state.drafts[state.server+'|'+state.selected],item=LUXURY_DATA.find(x=>x.id===state.selected),kind=host.querySelector('#art-product')?'item':host.querySelector('#art-capacity')?'cargo':host.querySelector('#art-buy-city')?'route':null;
  if(kind&&config)return M.luxury(kind,{item,config,quantity:Number($('art-quantity').value)});
 }
 const fields=[...host.querySelectorAll('input,select,textarea')].filter(n=>!n.closest('.block-summary')&&relevant(n,host)).map(n=>({id:n.id,label:label(n),type:n.type,value:n.tagName==='SELECT'?n.selectedOptions[0]?.textContent||'':n.value,checked:n.checked,invalid:!n.validity.valid,needsPositive:n.type==='number'&&(/(?:^|-)(?:price|buy|sell|capacity|quantity|count)(?:-|$)/.test(n.id)||Number(n.min)>0)}));
 return M.generic(fields);
}
function attach(){
 BlockFolds.attach();
 for(const host of main.querySelectorAll('.flow-steps>.step-card.fillable-block')){if(entries.has(host))continue;
  const summary=document.createElement('div');summary.className='block-summary';summary.dataset.blockHeading='true';summary.hidden=true;
  const copy=document.createElement('div'),text=document.createElement('span'),warning=document.createElement('span'),edit=document.createElement('button');text.className='block-summary-text';warning.className='block-summary-warning';edit.className='button';edit.type='button';edit.textContent='Изменить';edit.setAttribute('aria-label','Изменить: '+host.querySelector('h2,h3').textContent);copy.append(text,warning);summary.append(copy,edit);host.querySelector(':scope>[data-block-heading]').after(summary);
  const footer=document.createElement('div');footer.className='block-summary-done';const done=document.createElement('button');done.className='button';done.type='button';done.textContent='Готово';done.title='Свернуть заполненный блок в сводку';footer.append(done);host.append(footer);
  const entry={host,summary,text,warning,edit,footer,value:null};entries.set(host,entry);
  done.onclick=()=>{if(!read(host)?.ready)return;BlockFolds.setCollapsed(host,true);sync();edit.focus({preventScroll:true});summary.scrollIntoView({block:'nearest',behavior:'instant'});};
  edit.onclick=()=>{const value=read(host);BlockFolds.setCollapsed(host,false);sync();const missing=value?.focusId?$(value.focusId):null;if(missing&&host.contains(missing))QuickNavigation.reveal(missing);
   const target=missing?.checkVisibility()&&!missing.disabled?missing:[...host.querySelectorAll('input,select,textarea,.item-picker-trigger')].find(n=>!n.disabled&&n.checkVisibility());(target||host.querySelector('.block-toggle')).focus({preventScroll:true});host.scrollIntoView({block:'start',behavior:'instant'});
  };
 }
}
const compact=document.createElement('button');compact.type='button';compact.className='button';compact.id='view-summarize-blocks';compact.textContent='Свернуть заполненные блоки';document.querySelector('.interface-options').append(compact);
function sync(){attach();const scope=activeScope();let available=0;
 for(const [host,entry]of entries){if(!host.isConnected){entries.delete(host);continue;}if(host.closest('[id$="-content"]')!==scope)continue;
  const value=read(host);entry.value=value;const collapsed=host.classList.contains('block-collapsed');hide(entry.summary,!collapsed||!value);hide(entry.footer,!value?.ready);
  if(value){if(entry.text.textContent!==value.text)entry.text.textContent=value.text;if(entry.warning.textContent!==value.warning)entry.warning.textContent=value.warning;hide(entry.warning,!value.warning);host.dataset.summaryReady=String(value.ready);if(value.ready&&!collapsed&&!host.classList.contains('screen-block-hidden')&&!host.hidden)available++;}
 }
 compact.disabled=!available||scope?.hidden||!Workspace.ticket().tabId;
}
compact.onclick=()=>{sync();const scope=activeScope();for(const [host,entry]of entries)if(host.closest('[id$="-content"]')===scope&&entry.value?.ready&&!host.classList.contains('screen-block-hidden')&&!host.hidden)BlockFolds.setCollapsed(host,true);sync();};
function schedule(){if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;sync();});}
for(const event of ['input','change','craftresultchange','workspacechange','blockfoldchange'])document.addEventListener(event,schedule);
new MutationObserver(schedule).observe(main,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
window.BlockSummaries={sync,compact(){compact.click();},snapshot(){sync();const scope=activeScope();return [...(scope?.querySelectorAll('.flow-steps>.step-card')||[])].map(host=>entries.get(host)).filter(Boolean).map(e=>({key:e.host.dataset.foldKey,...e.value,collapsed:e.host.classList.contains('block-collapsed')}));}};
sync();
})();
