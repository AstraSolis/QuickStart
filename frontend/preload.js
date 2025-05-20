const { contextBridge, ipcRenderer, shell } = require('electron');
const path = require('path');
const os = require('os');

contextBridge.exposeInMainWorld('electronAPI', {
  ipcSend: (...args) => ipcRenderer.send(...args),
  ipcOn: (...args) => ipcRenderer.on(...args),
  ipcInvoke: (...args) => ipcRenderer.invoke(...args),
  shell,
  openExternal: (url) => shell.openExternal(url),
  path: {
    basename: (p) => path.basename(p),
    dirname: (p) => path.dirname(p)
  },
  os: {
    homedir: () => os.homedir()
  }
}); 