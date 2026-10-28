'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('MarketOverlay',{command:action=>ipcRenderer.invoke('market-overlay:command',action),onState:callback=>{const handler=(_event,state)=>callback(state);ipcRenderer.on('market-overlay:state',handler);return ()=>ipcRenderer.removeListener('market-overlay:state',handler);}});
