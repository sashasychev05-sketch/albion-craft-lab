'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('DesktopApp', {
  updates: () => ipcRenderer.invoke('updates:state'),
  update: () => ipcRenderer.invoke('updates:action'),
  onUpdate: callback => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('updates:changed', listener);
    return () => ipcRenderer.removeListener('updates:changed', listener);
  }
});
