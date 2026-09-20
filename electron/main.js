const { app, BrowserWindow, Menu, Notification } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.setContentProtection(true);
  Menu.setApplicationMenu(null);
  const index = path.join(__dirname, '..', 'dist', 'coreui-free-angular-admin-template', 'browser', 'index.html');
  void win.loadFile(index);
}

app.whenReady().then(() => {
  createWindow();
  if (Notification.isSupported()) {
    app.setAppUserModelId('com.sunrisecoaching.khargone');
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
