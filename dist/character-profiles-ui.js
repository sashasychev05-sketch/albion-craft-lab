(() => {
 'use strict';
 const store=window.CharacterProfiles,$=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const picker=document.createElement('label');picker.className='server-label character-picker';picker.innerHTML='Персонаж<select id="active-character" aria-label="Персонаж для расчёта фокуса"></select>';
 document.querySelector('.header-actions').prepend(picker);
 const manager=document.createElement('section');manager.className='profile-manager';manager.id='profile-manager';
 manager.innerHTML='<div class="profile-manager-heading"><h3>Ваши персонажи</h3><span id="profile-count" class="hint"></span></div><p class="hint">Выберите персонажа в верхней части окна. Его мастерства применяются к крафту, фокусу и сравнению партий. Настройки объёма и ручные цены общие.</p><div class="profile-manager-controls"><label class="field">Имя персонажа<input id="profile-name" maxlength="40" placeholder="Например, мой альт"></label><button type="button" class="button primary" id="profile-add">Добавить персонажа</button><button type="button" class="button" id="profile-rename">Переименовать</button><button type="button" class="button" id="profile-delete">Удалить</button></div><label class="refining-check"><input type="checkbox" id="profile-copy"> При добавлении скопировать мастерства выбранного персонажа</label><p id="profile-status" class="hint" role="status" aria-live="polite"></p>';
 document.querySelector('.character-intro').after(manager);
 function paint(resetName=false){
  if(!store){$('profile-status').textContent=window.CharacterProfilesError+' Исходные данные сохранены.';for(const n of manager.querySelectorAll('button,input'))n.disabled=true;$('active-character').disabled=true;return}
  const data=store.snapshot(),active=data.profiles.find(p=>p.id===data.active);
  $('active-character').innerHTML=data.profiles.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');$('active-character').value=data.active;
  $('profile-count').textContent=data.profiles.length+' / 20';$('profile-delete').disabled=data.profiles.length<2;$('profile-add').disabled=data.profiles.length>=20;
  if(resetName)$('profile-name').value=active.name;
  $('character-saved').textContent=active.name+' · мастерства сохранены';
 }
 function changed(message){window.MasteryUI.replace(store.levels());if(window.CharacterUI.active())window.CharacterUI.render();paint(true);$('profile-status').textContent=message;document.dispatchEvent(new Event('characterprofilechange'))}
 $('active-character').onchange=e=>{try{store.select(e.target.value);changed('Персонаж выбран. Фокус пересчитан.')}catch(error){$('profile-status').textContent=error.message;paint()}};
 $('profile-add').onclick=()=>{try{store.add($('profile-name').value,$('profile-copy').checked);changed('Персонаж добавлен. Заполните его мастерства ниже.')}catch(error){$('profile-status').textContent=error.message}};
 $('profile-rename').onclick=()=>{try{store.rename($('profile-name').value);paint(true);$('profile-status').textContent='Имя сохранено.'}catch(error){$('profile-status').textContent=error.message}};
 $('profile-delete').onclick=()=>{try{const data=store.snapshot(),active=data.profiles.find(p=>p.id===data.active);if(window.confirm('Удалить персонажа «'+active.name+'» и его мастерства?')){store.remove(data.active);changed('Персонаж удалён. Выбран оставшийся профиль.')}}catch(error){$('profile-status').textContent=error.message}};
 document.addEventListener('masterychange',()=>paint());document.addEventListener('profileserror',e=>{$('profile-status').textContent='Не удалось сохранить мастерства: '+e.detail;});paint(true);
 window.CharacterProfilesUI={refresh:()=>changed('Персонаж выбран. Фокус пересчитан.')};
})();
