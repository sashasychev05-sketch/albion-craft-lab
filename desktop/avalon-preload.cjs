'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('AvalonOverlay',{state:()=>ipcRenderer.invoke('avalon:overlay-state'),control:action=>ipcRenderer.invoke('avalon:overlay-window',action),onZone:callback=>{const listener=(_e,value)=>callback(value);ipcRenderer.on('avalon:zone',listener);return()=>ipcRenderer.removeListener('avalon:zone',listener);}});
