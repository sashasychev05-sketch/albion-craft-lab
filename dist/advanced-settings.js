(function(){'use strict';
const $=id=>document.getElementById(id),fmt=v=>Number(v||0).toLocaleString('ru-RU',{maximumFractionDigits:2});
function create(id,parent){const details=document.createElement('details');details.id=id;details.className='fold advanced-settings';details.innerHTML='<summary><span class="advanced-title">Дополнительные настройки</span><span class="advanced-active"></span></summary><div class="fold-body"></div>';parent.append(details);return details;}
function group(details,title,...nodes){const section=document.createElement('section'),heading=document.createElement('h3');section.className='advanced-group';heading.textContent=title;section.append(heading,...nodes.filter(Boolean));details.querySelector(':scope>.fold-body').append(section);return section;}
function unwrap(id){const fold=$(id).closest('details'),body=fold.querySelector(':scope>.fold-body'),nodes=[...body.children];fold.remove();return nodes;}
const craft=create('craft-advanced-settings',document.querySelector('#craft-content .flow-steps'));
const tradeGroup=group(craft,'Налоги, резерв и доставка',...unwrap('tax'));
const tradeHint=document.createElement('p');tradeHint.className='hint';tradeHint.textContent='Комиссия учитывается при продаже ордером, скидка — при прямой сделке. Сводка показывает применяемые значения.';tradeGroup.append(tradeHint);
group(craft,'Фокус и ручная плата станка',$('mastery-panel'),...unwrap('eff'));
const journalGroup=group(craft,'Ремесленные журналы',document.querySelector('.craft-journal-panel'));
const premium=$('premium').closest('label'),switches=document.createElement('div');switches.className='simple-switches';switches.append(premium);
const premiumInputs=$('premium-cost').closest('details'),oldPremium=premiumInputs.parentElement.closest('details');
group(craft,'Премиум и сценарий',switches,...premiumInputs.children,$('scenario-goal-fields'));
premiumInputs.remove();
if(oldPremium)oldPremium.remove();
const luxury=create('lux-advanced-settings',document.querySelector('#luxury-content .flow-steps'));
group(luxury,'Премиум, налоги и ручные цены',...unwrap('art-tax'));
group(luxury,'Расходы на дорогу',...unwrap('art-trip-cost'));
function text(details,parts){const target=details.querySelector('.advanced-active'),next=parts.join(' · ');if(target.textContent!==next)target.textContent=next;}
function craftSummary(){
 const {recipe,config:c,result:r}=CraftApp.snapshot(),tax=c.saleMode==='discord'?0:c.tax,commission=c.saleMode==='sell'?c.setup:0;
 const parts=['Налог '+fmt(tax)+'%','Комиссия '+fmt(commission)+'%','Резерв '+fmt(c.buffer)+'%',c.premium?'Премиум включён':'Без премиума'];
 if(c.transport>0)parts.push('Доставка '+fmt(c.transport));
 if(c.saleMode==='discord')parts.push('Скидка '+fmt(c.discount)+'%');
 if(c.focus)parts.push(c.focusSource==='manual'?'Эффективность вручную '+fmt(c.eff):'Фокус по мастерствам');
 if(c.focus&&c.focusOverrides?.[recipe.id])parts.push('Расход фокуса из игры '+fmt(c.focusOverrides[recipe.id]));
 if(c.manualReturn)parts.push('Возврат вручную '+fmt(c.rrr)+'%');
 if(c.dailyBonus>0&&!c.manualReturn&&c.craftPlace!=='hideout')parts.push('Бонус дня '+fmt(c.dailyBonus)+'%');
 if(c.unitFee!==recipe.fee300)parts.push('Плата станка вручную '+fmt(c.unitFee));
 if(r.journals?.supported)parts.push(r.journals.missing?'Журналы: нужны цены':'Журналы включены');
 else if(['gear','bags'].includes(recipe.kind))parts.push(c.withJournals?'Журналы недоступны для рецепта':'Журналы выключены');
 if(c.characters>0)parts.push('Доля премиума учтена: '+fmt(c.characters)+' персонажей');
 if(c.goalTarget>0)parts.push('Цель '+fmt(c.goalTarget)+' за '+fmt(c.goalPeriod)+' дней');
 const journal=document.querySelector('.craft-journal-panel');journalGroup.hidden=!journal||journal.hidden;
 text(craft,parts);
}
function luxurySummary(){
 const state=LuxuryUI.captureDraft(),c=state.drafts[state.server+'|'+state.selected];if(!c)return;
 const parts=['Налог '+fmt(c.tax)+'%',c.premium?'Премиум включён':'Без премиума'];
 if(c.buyMode==='order')parts.push('Комиссия покупки '+fmt(c.setup)+'%');
 if(c.sellMode==='sell')parts.push('Комиссия продажи '+fmt(c.setup)+'%');
 if(c.buyMode!=='order'&&c.sellMode!=='sell')parts.push('Комиссия 0%');
 parts.push('Дорога / рейс '+fmt(c.tripCost));if(c.extra>0)parts.push('Другие расходы '+fmt(c.extra));
 if(c.manualBuy||c.manualSell)parts.push('Ручные цены: '+[c.manualBuy?'покупка':'',c.manualSell?'продажа':''].filter(Boolean).join(', '));
 text(luxury,parts);
}
function sync(){craftSummary();if(window.Workspace?.activeMode()==='luxury')luxurySummary();}
document.addEventListener('craftresultchange',craftSummary);
for(const event of ['input','change','click'])document.addEventListener(event,e=>{if(e.target?.closest?.('#luxury-content'))queueMicrotask(luxurySummary);else if(e.target?.closest?.('#craft-content'))queueMicrotask(craftSummary);});
document.addEventListener('workspacechange',sync);
window.AdvancedSettings={sync};sync();luxurySummary();BlockFolds.attach();
})();
