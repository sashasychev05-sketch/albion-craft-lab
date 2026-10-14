(function(){'use strict';
const entries=[];
function measure(entry){const height=entry.nav.getBoundingClientRect().height;if(height>0)entry.scope.style.setProperty('--calculation-jump-height',height+'px');}
function reveal(target){
 BlockFolds.attach();
 for(let node=target;node;node=node.parentElement){
  if(node.tagName==='DETAILS')node.open=true;
  if(node.classList.contains('block-collapsed'))node.querySelector(':scope >[data-block-heading] .block-toggle')?.click();
 }
}
function jump(entry,key){
 const target=entry.targets[key];if(!target||!entry.scope.checkVisibility())return;
 reveal(target);measure(entry);
 // A sticky result has a moving rectangle; its flow gives the original position.
 const anchor=key==='result'&&getComputedStyle(target).position==='sticky'?entry.scope.querySelector('.flow-layout'):target;
 const heading=key==='result'?null:target.querySelector(':scope >[data-block-heading] .block-toggle');
 const focus=heading?.checkVisibility()?heading:target;
 focus.focus({preventScroll:true});
 anchor.scrollIntoView({block:'start',behavior:'instant'});
}
function create(scopeId,key,items){
 const scope=document.getElementById(scopeId),nav=document.createElement('nav');nav.className='calculation-jump-nav';nav.id=key+'-quick-navigation';nav.setAttribute('aria-label','Быстрые переходы по расчёту');
 const entry={scope,nav,targets:{}};
 for(const [name,label,target]of items){
  target.id=key+'-jump-'+name;target.classList.add('calculation-jump-target');target.tabIndex=-1;target.setAttribute('aria-label',label==='Результат'?'Результат партии':label);
  entry.targets[name]=target;const button=document.createElement('button');button.type='button';button.textContent=label;button.dataset.calculationJump=name;button.setAttribute('aria-controls',target.id);button.onclick=()=>jump(entry,name);nav.append(button);
 }
 scope.classList.add('calculation-jumps');const flow=scope.querySelector('.flow-layout');flow.classList.add('calculation-jump-target');flow.before(nav);entries.push(entry);new ResizeObserver(()=>measure(entry)).observe(nav);measure(entry);
 return entry;
}
const craft=document.getElementById('craft-content'),luxury=document.getElementById('luxury-content');
const craftSteps=craft.querySelectorAll('.flow-steps>.step-card'),luxurySteps=luxury.querySelectorAll('.flow-steps>.step-card');
const craftEntry=create('craft-content','craft',[
 ['production','Производство',craftSteps[1]],['sale','Продажа',craftSteps[2]],['purchase','Закупка',craft.querySelector('.materials-panel')],['result','Результат',craft.querySelector('.outcome')]
]);
create('luxury-content','lux',[
 ['cargo','Груз',luxurySteps[1]],['route','Маршрут',luxurySteps[2]],['prices','Цены',document.getElementById('art-city-prices').closest('.panel')],['result','Результат',luxury.querySelector('.outcome')]
]);
craft.querySelector('.outcome>.button.primary').onclick=()=>jump(craftEntry,'purchase');
document.addEventListener('workspacechange',()=>requestAnimationFrame(()=>entries.forEach(measure)));
window.QuickNavigation={go(key){const entry=entries.find(e=>e.scope.checkVisibility());if(entry)jump(entry,key);},reveal};
})();
