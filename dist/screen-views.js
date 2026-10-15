(function(){'use strict';
const M=window.ScreenViewsModel,$=id=>document.getElementById(id),entries=new Map(),baselines=new Map(),labels={calculation:'Расчёт',procurement:'Закупка',review:'Проверка',custom:'Мой вид'};
let saved=M.empty(),lastMode=null,applying=false,pending=false,readError='',writeError='';
try{saved=M.read(localStorage);}catch{readError='Не удалось прочитать готовые виды. Выберите вид, чтобы сохранить заново.';}
function role(node){if(node.matches('.advanced-settings'))return 'advanced';if(node.matches('.materials-panel'))return 'purchase';if(node.querySelector('#art-city-prices'))return 'prices';if(node.querySelector('#art-routes'))return 'routes';if(node.matches('.wide-fold'))return 'comparison';if(node.matches('.source-info'))return 'sources';if(node.querySelector('#product,#art-product'))return 'item';if(node.querySelector('#quantity,#art-capacity'))return 'production';if(node.querySelector('#sale-price,#art-buy-city'))return 'sale';return 'other';}
function active(){const layout=ScreenLayout.snapshot();if(!layout||!M.modes.includes(layout.mode))return null;const entry=entries.get(layout.mode==='luxury'?'luxury':'craft');if(entry.scope.hidden)return null;return {mode:layout.mode,entry,layout};}
function nodes(entry){return [...entry.scope.querySelectorAll('[data-screen-block]')];}
function folded(entry){return nodes(entry).filter(n=>n.matches('.fillable-block[data-fold-key]'));}
function details(entry){return [...entry.scope.querySelectorAll('[data-screen-view-detail]')];}
function capture(a){return {layout:a.layout.value,folds:Object.fromEntries(folded(a.entry).map(n=>[n.dataset.foldKey,n.classList.contains('block-collapsed')])),details:Object.fromEntries(details(a.entry).map(n=>[n.dataset.screenViewDetail,n.open]))};}
function signature(value){return JSON.stringify({layout:value.layout,folds:Object.entries(value.folds).sort(),details:Object.entries(value.details).sort()});}
function persist(){try{localStorage.setItem(M.KEY,JSON.stringify(saved));readError='';writeError='';return true;}catch{writeError='Не удалось сохранить вид. Проверьте доступное место и повторите.';return false;}}
function restore(a,value,layout=true){
 if(layout&&!ScreenLayout.set(value.layout))return false;
 for(const node of folded(a.entry))if(Object.hasOwn(value.folds,node.dataset.foldKey))BlockFolds.setCollapsed(node,value.folds[node.dataset.foldKey]);
 for(const node of details(a.entry))if(Object.hasOwn(value.details,node.dataset.screenViewDetail))node.open=value.details[node.dataset.screenViewDetail];
 BlockSummaries.sync();return true;
}
function render(a){const state=saved.modes[a.mode],selected=state?.selected||'custom';for(const [key,button]of a.entry.buttons){const pressed=String(key===selected);if(button.getAttribute('aria-pressed')!==pressed)button.setAttribute('aria-pressed',pressed);}let message=selected==='custom'?'Ваш порядок и сворачивание блоков':selected==='procurement'?'Заполненные поля свёрнуты. Неполные остаются открыты.':selected==='review'?'Основные блоки и подробности результата открыты.':a.mode==='luxury'?'Предмет, груз и маршрут':'Основные поля и список материалов';if(selected==='custom'&&a.layout.value.hidden.length)message+=' · Скрыто блоков: '+a.layout.value.hidden.length;message=writeError||readError||message;if(a.entry.status.textContent!==message)a.entry.status.textContent=message;}
function remember(){const a=active();if(!a||applying||a.mode!==lastMode)return;const value=capture(a),state=saved.modes[a.mode],previous=state?.current||baselines.get(a.mode);if(previous&&signature(value)!==signature(previous)){saved.modes[a.mode]={selected:'custom',current:value,custom:value};persist();}render(a);}
function select(view){
 const a=active();if(!a||!Object.hasOwn(labels,view)||document.querySelector('dialog[open]'))return false;
 remember();const before=capture(a),state=saved.modes[a.mode],custom=state?.custom||before;
 const previous=saved;applying=true;
 try{
  if(view==='custom'){if(!restore(a,custom))throw Error();}
  else{
   const blocks=a.layout.blocks.map(b=>({...b,role:role(nodes(a.entry).find(n=>n.dataset.screenBlock===b.id))}));
   if(!ScreenLayout.set(M.preset(view,blocks)))throw Error();
   BlockSummaries.sync();const ready=new Map(BlockSummaries.snapshot().map(s=>[s.key,s.ready]));
   for(const node of folded(a.entry))BlockFolds.setCollapsed(node,M.collapse(view,ready.get(node.dataset.foldKey)));
   for(const node of details(a.entry))node.open=view==='review';
   BlockSummaries.sync();
  }
  const current=capture(active());saved={version:1,modes:{...saved.modes,[a.mode]:{selected:view,current,custom}}};
  if(!persist())throw Error();
  render(active());return true;
 }catch{saved=previous;restore(a,before);writeError='Не удалось сохранить вид. Повторите попытку.';render(active());return false;}
 finally{applying=false;}
}
function sync(){
 const a=active();if(!a){lastMode=null;return;}
 if(a.mode!==lastMode){applying=true;try{const state=saved.modes[a.mode];restore(a,state?.current||a.entry.base,false);lastMode=a.mode;if(!state)baselines.set(a.mode,capture(a));}finally{applying=false;}}
 remember();
}
function schedule(){if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;sync();});}
for(const kind of ['craft','luxury']){
 const scope=$(kind+'-content'),bar=document.createElement('section'),group=document.createElement('div'),status=document.createElement('p');bar.className='screen-views';bar.setAttribute('aria-label','Вид расчёта');group.className='screen-views-buttons';group.setAttribute('role','group');group.setAttribute('aria-label','Готовые виды');status.className='screen-views-status';status.setAttribute('role','status');
 const caption=document.createElement('span');caption.textContent='Вид';caption.className='screen-views-caption';group.append(caption);const buttons=new Map();
 for(const [key,label]of Object.entries(labels)){const button=document.createElement('button');button.type='button';button.className='button';button.textContent=label;button.dataset.screenView=key;button.setAttribute('aria-pressed',String(key==='custom'));button.onclick=()=>select(key);buttons.set(key,button);group.append(button);}
 const configure=document.createElement('button');configure.type='button';configure.className='button screen-views-configure';configure.textContent='Настроить';configure.onclick=()=>ScreenLayout.open();group.append(configure);bar.append(group,status);scope.querySelector('.calculation-jump-nav').before(bar);
 // IDs are assigned before users reorder blocks; titles and DOM positions may change later.
 [...scope.querySelectorAll('.advanced-settings,.outcome details,.wide-fold')].forEach((node,i)=>{node.dataset.screenViewDetail=node.id||kind+'-detail-'+i;node.addEventListener('toggle',schedule);});
 const entry={scope,bar,buttons,status};entries.set(kind,entry);entry.base={layout:{order:[],hidden:[]},folds:Object.fromEntries(folded(entry).map(n=>[n.dataset.foldKey,n.classList.contains('block-collapsed')])),details:Object.fromEntries(details(entry).map(n=>[n.dataset.screenViewDetail,n.open]))};
}
document.addEventListener('blockfoldchange',()=>{if(!applying)remember();});
document.addEventListener('screenlayoutchange',()=>{if(!applying)remember();});
document.addEventListener('workspacechange',sync);
// Layout changes also arrive from quick navigation and the ingredient tree.
new MutationObserver(schedule).observe(document.querySelector('main'),{attributes:true,attributeFilter:['class'],subtree:true});
window.addEventListener('beforeunload',remember);
const reset=$('view-reset'),originalReset=reset.onclick;reset.onclick=event=>{applying=true;try{originalReset?.(event);saved=M.empty();persist();baselines.clear();for(const entry of entries.values()){for(const node of folded(entry))BlockFolds.setCollapsed(node,false);for(const node of details(entry))node.open=false;entry.base.folds=Object.fromEntries(folded(entry).map(n=>[n.dataset.foldKey,false]));entry.base.details=Object.fromEntries(details(entry).map(n=>[n.dataset.screenViewDetail,false]));}BlockSummaries.sync();const a=active();lastMode=a?.mode||null;if(a)baselines.set(a.mode,capture(a));}finally{applying=false;}const a=active();if(a)render(a);};
window.ScreenViews={select,sync,snapshot(){sync();const a=active();return a?{mode:a.mode,selected:saved.modes[a.mode]?.selected||'custom',current:capture(a),custom:saved.modes[a.mode]?.custom||capture(a)}:null;}};
sync();
})();
