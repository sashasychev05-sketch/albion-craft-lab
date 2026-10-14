(() => {
  'use strict';
  if (!window.DesktopApp) return;
  document.body.classList.add('desktop-app');
  document.querySelector('.statusbar span:last-child').textContent = 'Настройки сохраняются на этом компьютере';
  const preferences = document.querySelector('.interface-options p');
  if (preferences) preferences.textContent = 'Сохраняются для всех разделов программы.';
  const panel = document.createElement('div');
  panel.className = 'desktop-updates';
  panel.innerHTML = '<button id="app-update" class="button" type="button">Проверить обновления</button><span id="app-version"></span><span id="app-update-status" role="status" aria-live="polite"></span><progress id="app-update-progress" max="100" hidden aria-label="Загрузка обновления"></progress>';
  document.querySelector('.header-actions').append(panel);
  const button = panel.querySelector('button'), status = panel.querySelector('#app-update-status'), progress = panel.querySelector('progress');
  const labels = { idle: 'Проверить обновления', current: 'Проверить обновления', checking: 'Проверка…', available: 'Скачать обновление', downloading: 'Загрузка…', ready: 'Обновить и перезапустить', installing: 'Установка…', error: 'Повторить проверку', development: 'Проверить обновления' };
  let statusTimer;
  function showStatus(message, temporary = false) {
    clearTimeout(statusTimer);
    status.textContent = message || '';
    status.hidden = !message;
    if (message && temporary) statusTimer = setTimeout(() => { status.textContent = ''; status.hidden = true; }, 4000);
  }
  function paint(state) {
    button.dataset.updatePhase = state.phase;
    panel.querySelector('#app-version').textContent = 'v' + state.currentVersion;
    button.textContent = labels[state.phase] || labels.idle;
    button.disabled = ['checking', 'downloading', 'installing'].includes(state.phase);
    progress.hidden = state.phase !== 'downloading';
    progress.value = state.percent || 0;
    const messages = { idle: '', checking: 'Ищем новую версию…', current: 'Установлена последняя версия', available: 'Доступна версия ' + state.version, downloading: 'Версия ' + state.version + ' · ' + state.percent + '%', ready: 'Версия ' + state.version + ' готова. Настройки сохранятся.', installing: 'Программа перезапустится после установки.', error: state.message, development: state.message };
    showStatus(messages[state.phase], ['current', 'development'].includes(state.phase));
  }
  window.DesktopApp.onUpdate(paint);
  window.DesktopApp.updates().then(paint).catch(() => { showStatus('Не удалось проверить состояние обновлений.'); });
  button.addEventListener('click', async () => {
    button.disabled = true;
    try { paint(await window.DesktopApp.update()); }
    catch { showStatus('Не удалось обновить приложение. Повторите попытку.'); button.textContent = labels.error; button.disabled = false; }
  });
})();
