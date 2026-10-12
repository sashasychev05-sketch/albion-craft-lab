'use strict';

// All updater operations require an explicit button press. No background install.
function createUpdates(updater, { version, packaged, notify, log = () => {} }) {
  let state = { phase: 'idle', currentVersion: version, version: null, percent: 0 };
  let pending = false;
  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = false;
  updater.allowPrerelease = false;
  updater.allowDowngrade = false;
  const set = values => { state = { ...state, ...values }; notify({ ...state }); };
  const fail = error => { log(error); set({ phase: 'error', message: 'Не удалось обновить приложение. Проверьте интернет и повторите попытку.', percent: 0 }); };
  updater.on('checking-for-update', () => set({ phase: 'checking', message: '' }));
  updater.on('update-available', info => set({ phase: 'available', version: info.version, percent: 0 }));
  updater.on('update-not-available', () => set({ phase: 'current', version: null, percent: 0 }));
  updater.on('download-progress', progress => set({ phase: 'downloading', percent: Math.max(0, Math.min(100, Math.round(progress.percent))) }));
  updater.on('update-downloaded', info => set({ phase: 'ready', version: info.version, percent: 100 }));
  updater.on('error', fail);
  async function action() {
    if (pending || state.phase === 'installing') return { ...state };
    if (!packaged) { set({ phase: 'development', message: 'Обновления доступны в установленной версии программы.' }); return { ...state }; }
    pending = true;
    try {
      if (state.phase === 'ready') {
        set({ phase: 'installing' });
        updater.quitAndInstall(false, true);
      } else if (state.phase === 'available') {
        set({ phase: 'downloading', percent: 0 });
        await updater.downloadUpdate();
      } else {
        set({ phase: 'checking', message: '', percent: 0 });
        await updater.checkForUpdates();
      }
    } catch (error) { fail(error); }
    finally { pending = false; }
    return { ...state };
  }
  return { action, snapshot: () => ({ ...state }) };
}
module.exports = { createUpdates };
