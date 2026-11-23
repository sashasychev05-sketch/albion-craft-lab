(function () {
'use strict';
const byId = id => document.getElementById(id);
async function action(action, p) {
 if (p.page === 'craft') {
  const craft = CraftApp.snapshot();
  if (action === 'play-search') {
   const query = String(p.query || '').trim().toLocaleLowerCase('ru').slice(0,100);
   if (!query) return [];
   const hits = [];
   for (const r of window.ALBION_DATA.recipes) {
    const label = r.name + ' · ' + r.tier + '.' + (r.ench || 0);
    if (r.kind === craft.recipe.kind && (label + ' ' + r.id).toLocaleLowerCase('ru').includes(query)) hits.push({id:r.id,label});
    if (hits.length === 12) break;
   }
   return hits;
  }
  if (action === 'play-recipe') {
   const r = window.ALBION_DATA.recipes.find(r => r.id === p.item && r.kind === craft.recipe.kind);
   if (!r || p.server !== craft.server || p.recipe !== craft.recipe.id) throw Error('Раздел крафта изменился. Повторите поиск.');
   CraftApp.open(r.id);
   return window.PlayHost.action('play-state',{page:'craft'});
  }
  const field = byId('quantity').disabled ? 'focus-budget' : 'quantity';
  const input = byId(field);
  if (action === 'play-volume') {
   if (craft.recipe.id !== p.recipe || craft.server !== p.server || field !== p.field)
    throw Error('Расчёт изменился. Проверьте рецепт и объём.');
   if (!Number.isSafeInteger(p.value) || p.value < Number(input.min) || p.value > Number(input.max))
    throw Error('Проверьте объём партии.');
   input.value = p.value;
   input.dispatchEvent(new Event('input', {bubbles:true}));
  } else if (action !== 'play-state') throw Error('Неизвестное действие.');
  return {server:craft.server, recipe:craft.recipe.id, name:craft.recipe.name, field, value:input.value,
   min:input.min, max:input.max, cost:byId('cost').textContent, profit:byId('profit').textContent, amount:byId('output-tag').textContent};
 }
 if (p.page !== 'roads') throw Error('Неизвестный раздел.');
 const api = window.DesktopApp.avalon, server = ActivityViews.avalon.state.server;
 let status = await api.engine('status');
 if (action === 'play-scanner') {
  if (p.server !== (status.session?.server || server) || p.started !== (status.session?.started ?? null))
   throw Error('Состояние записи изменилось. Проверьте сервер.');
  status = status.session ? await api.engine('stop') : await api.engine('start', {server});
  await window.AvalonEngineUI?.refresh();
 } else if (action !== 'play-state') throw Error('Неизвестное действие.');
 const s = status.session, r = status.lastScan;
 return {server:s?.server || server, available:status.available, started:s?.started ?? null, count:s?.count || 0,
  trigger:s?.trigger === 'keyboard' ? s.shortcut.replace('CommandOrControl','Ctrl') : ({middle:'среднюю кнопку мыши',mouse4:'боковую кнопку 1',mouse5:'боковую кнопку 2'}[s?.trigger]),
  last:r ? [r.from || '?',r.to || '?'].join(' → ') + (r.recorded ? ' · сохранено' : ' · не записано') : '', error:status.error};
}
window.PlayHost = {action};
function addButton(anchor, page, server) {
 if (!anchor || !window.DesktopApp?.shopping) return;
 const entry = document.createElement('button'), note = document.createElement('span');
 entry.type = 'button'; entry.className = 'button'; entry.textContent = 'Поверх игры';
 entry.title = page === 'craft' ? 'Расчёт партии поверх игры' : 'Запись локаций поверх игры';
 note.setAttribute('role','status'); anchor.after(entry,note);
 entry.onclick = async () => {
  entry.disabled = true; note.textContent = '';
  try { await DesktopApp.shopping.open(server(),page); }
  catch (e) { note.textContent = e.message; }
  finally { entry.disabled = false; }
 };
}
window.addEventListener('DOMContentLoaded', () => {
 addButton(byId('mode-tag'),'craft',() => CraftApp.snapshot().server);
 addButton(byId('roads-record'),'roads',() => ActivityViews.avalon.state.server);
});
})();
