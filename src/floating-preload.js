'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('floating',Object.freeze({
  swap:()=>ipcRenderer.invoke('floating:swap'),
  corner:()=>ipcRenderer.invoke('floating:corner'),
  step:(x,y)=>ipcRenderer.invoke('floating:step',x,y),
  dragStart:()=>ipcRenderer.send('floating:drag-start'),
  dragMove:(x,y)=>ipcRenderer.send('floating:drag-move',x,y),
  dragEnd:()=>ipcRenderer.send('floating:drag-end'),
  onState:callback=>ipcRenderer.on('floating:state',(_event,state)=>callback(state))
}));
