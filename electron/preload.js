const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronSetup', {
  submit: (serverIp) => ipcRenderer.send('setup-submit', serverIp),
});
