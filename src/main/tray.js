'use strict';
const { Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const settings = require('./settings');

const MIN = 60000;

function createTray({ onTestFlight, onOpenSettings, onQuit, onSnooze, onTogglePause }) {
  const icon = nativeImage.createFromPath(
    path.join(__dirname, '..', '..', 'assets', 'trayTemplate.png'));
  const tray = new Tray(icon);
  tray.setToolTip('Airplane Banner');

  let statusLine = 'Starting…';

  function build() {
    const paused = settings.get('paused');
    const snoozeUntil = settings.get('snoozeUntilEpochMs');
    const snoozed = snoozeUntil && snoozeUntil > Date.now();
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: statusLine, enabled: false },
      { type: 'separator' },
      { label: 'Test flight', click: onTestFlight },
      {
        label: 'Snooze',
        submenu: [
          { label: 'For 1 hour', click: () => onSnooze(Date.now() + 60 * MIN) },
          { label: 'Until tomorrow', click: () => onSnooze(nextMorning()) },
          ...(snoozed ? [{ label: 'Cancel snooze', click: () => onSnooze(null) }] : []),
        ],
      },
      { label: paused ? 'Resume' : 'Pause', click: onTogglePause },
      { type: 'separator' },
      { label: 'Settings…', click: onOpenSettings },
      { label: 'Quit', click: onQuit },
    ]));
  }

  function nextMorning() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(8, 0, 0, 0);
    return d.getTime();
  }

  build();
  return {
    setStatus(line) { statusLine = line; build(); },
    refresh: build,
  };
}

module.exports = { createTray };
