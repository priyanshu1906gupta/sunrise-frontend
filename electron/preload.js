const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('sunriseDesktop', {
  platform: 'DESKTOP'
});
