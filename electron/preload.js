const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronSetup', {
  submit: (serverIp) => ipcRenderer.send('setup-submit', serverIp),
});

contextBridge.exposeInMainWorld('electronPrinter', {
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  printReceipt: (saleData) => ipcRenderer.invoke('print-receipt', saleData),
});
