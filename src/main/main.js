const { app, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const { flyBanner } = require('./windows/overlay-window');

let tray = null;

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, '..', '..', 'assets', 'trayTemplate.png'));
  tray = new Tray(icon);
  tray.setToolTip('Airplane Banner');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Airplane Banner (starting…)', enabled: false },
    { type: 'separator' },
    { label: 'Quit', role: 'quit' },
  ]));
}

app.whenReady().then(() => {
  createTray();
  if (process.platform === 'darwin') app.dock.hide(); // background app, no dock icon
});

// Keep running with no windows open (background app).
app.on('window-all-closed', (e) => { /* do not quit */ });
