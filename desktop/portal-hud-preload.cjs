'use strict';
const {ipcRenderer,contextBridge}=require('electron');
contextBridge.exposeInMainWorld('PortalHud',{onState:fn=>ipcRenderer.on('portal-hud:state',(_,value)=>fn(value))});
