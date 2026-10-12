(function(){'use strict';
const $=id=>document.getElementById(id),MM=window.MasteryMath,data=window.MASTERY_DATA;let levels={};try{levels=window.CharacterProfiles?window.CharacterProfiles.levels():window.MasteryProfile.normalize(JSON.parse(localStorage.getItem('albion-character-mastery-v1')||'{}'),data)}catch{}
const panel=document.createElement('section');panel.id='mastery-panel';panel.className='mastery-panel';document.querySelector('.settings').append(panel);let cfg,save;
const fmt=(n,d=0)=>Number(n).toLocaleString('ru-RU',{maximumFractionDigits:d});
function persist(){try{if(window.CharacterProfiles)window.CharacterProfiles.update(levels);else localStorage.setItem('albion-character-mastery-v1',JSON.stringify(levels))}catch(error){document.dispatchEvent(new CustomEvent('profileserror',{detail:error.message}))}document.dispatchEvent(new Event('masterychange'))}
function prepare(r,c){window.MasteryProfile.prepare(r,c,levels,data,MM)}
function render(r,c,callback){cfg=c;save=callback;const nodes=MM.applicable(r,data),entered=nodes.filter(n=>levels[n.id]>0).length;
 panel.hidden=!nodes.length;panel.innerHTML=`<h3>Фокус персонажа</h3><p class="selected-summary">${fmt(c.eff)} эффективности · ${fmt(MM.cost(r,c.eff))} фокуса / крафт</p><p class="hint">Один крафт: ${fmt(r.output)} шт. · ${fmt(MM.cost(r,c.eff)/r.output,2)} фокуса / шт.<br>${c.focusSource==='levels'?`Заполнено ${entered} из ${nodes.length} влияющих мастерств. Незаполненные уровни считаются нулевыми.`:'Используется эффективность, введённая вручную.'}</p><button type="button" class="button" id="open-character">Настроить мастерства персонажа →</button><details class="fold"><summary>Ручная настройка фокуса</summary><label class="field fold-body">Как определяем расход<select id="focus-source"><option value="levels">Из «Моего персонажа»</option><option value="manual">Ввести эффективность вручную</option></select></label><p class="hint">При ручном вводе уровни персонажа для этого рецепта не применяются.</p></details>`;
 $('focus-source').value=c.focusSource;$('eff').readOnly=c.focusSource==='levels';$('eff').value=c.eff;
 $('open-character').onclick=()=>window.CharacterUI?.open(r);
}
panel.addEventListener('change',e=>{if(e.target.id==='focus-source'){cfg.focusSource=e.target.value;cfg.explicitManualFocus=e.target.value==='manual';save()}});
window.MasteryUI={prepare,render,levels:()=>({...levels}),setLevel(id,value){const n=data.nodes[id];if(!n)return;levels[id]=MM.level(value,n.maxLevel);persist()},replace(values){levels=window.MasteryProfile.normalize(values,data);persist()}};
})();
