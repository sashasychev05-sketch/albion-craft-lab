(() => {
 const el=id=>document.getElementById(id),labels={fight:'Урон за бой',damage:'Урон за сессию',fame:'Слава/ч',silver:'Серебро'},numbers=new Intl.NumberFormat('ru-RU',{notation:'compact',maximumFractionDigits:1});
 window.PortalHud.onState(({message,bad,portal,compact,metrics})=>{
  document.body.classList.toggle('compact',compact);document.body.classList.toggle('bad',bad);
  el('heading').textContent=portal?'✓ Переход записан':bad?'Ошибка записи':'Albion Lab';el('route').textContent=message;
  el('timer').textContent=portal?(portal.expires===null?'Таймер не прочитан':'До закрытия: '+Math.max(0,Math.ceil((portal.expires-Date.now())/60000))+' мин'):'';
  el('stats').hidden=!portal;
  if(portal){el('stats').textContent=portal.metrics.map(key=>labels[key]+' '+(metrics?.[key]==null?'—':numbers.format(metrics[key]))).join('   ·   ');}
 });
})();