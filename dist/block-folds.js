(function(){'use strict';
const KEY='albion-block-folds-v1',main=document.querySelector('main');let states={};try{const saved=JSON.parse(localStorage.getItem(KEY));if(saved&&typeof saved==='object'&&!Array.isArray(saved))states=saved;}catch{}
const selector='.step-card,.panel,.character-group,.mastery-panel,.food-ingredients-options,.bag-materials,#chain-options';
function save(){try{localStorage.setItem(KEY,JSON.stringify(states));}catch{}}
document.querySelectorAll('#craft-content .flow-steps>.step-card').forEach((host,i)=>host.dataset.foldId=['craft-item','craft-volume','craft-sale'][i]);
function identity(host,title){const scope=host.closest('[id$="-content"]')?.id||'craft-content';return host.dataset.foldId||scope+'|'+(host.id||host.dataset.characterGroup||title.trim());}
function apply(host,button,key){const folded=states[key]===true;host.classList.toggle('block-collapsed',folded);button.setAttribute('aria-expanded',String(!folded));button.title=folded?'Развернуть блок':'Свернуть блок';}
function attach(){for(const host of main.querySelectorAll(selector)){
 if(host.id==='catalog-panel'||host.classList.contains('settings')||!host.querySelector('input,select,textarea'))continue;
 const heading=[...host.querySelectorAll('h2,h3')].find(h=>h.closest(selector)===host);if(!heading||heading.querySelector('.block-toggle'))continue;
 const title=heading.textContent,key=identity(host,title);let branch=heading;while(branch.parentElement!==host)branch=branch.parentElement;branch.dataset.blockHeading='true';
 const button=document.createElement('button');button.className='block-toggle';button.type='button';const label=document.createElement('span');label.textContent=title;button.append(label);button.insertAdjacentHTML('beforeend','<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>');heading.replaceChildren(button);host.classList.add('fillable-block');host.dataset.foldKey=key;button.onclick=()=>{states[key]=!host.classList.contains('block-collapsed');apply(host,button,key);save();};apply(host,button,key);
 }
 for(const details of main.querySelectorAll('details')){if(details.dataset.foldSaved||!details.querySelector('input,select,textarea'))continue;const summary=details.querySelector(':scope >summary');if(!summary)continue;const key=identity(details,summary.textContent);details.dataset.foldSaved=key;if(Object.hasOwn(states,key))details.open=states[key]!==true;details.addEventListener('toggle',()=>{states[key]=!details.open;save();});}
}
function expandAll(){attach();states={};for(const host of main.querySelectorAll('.fillable-block'))apply(host,host.querySelector('.block-toggle'),host.dataset.foldKey);for(const details of main.querySelectorAll('details[data-fold-saved]'))details.open=true;save();}
const reset=document.createElement('button');reset.type='button';reset.className='button';reset.id='view-expand-blocks';reset.textContent='Развернуть все блоки';reset.onclick=expandAll;document.querySelector('.interface-options').append(reset);
let pending=false;new MutationObserver(()=>{if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;attach();});}).observe(main,{childList:true,subtree:true});attach();
window.BlockFolds={attach,expandAll};
})();
