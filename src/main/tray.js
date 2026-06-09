'use strict';
const { Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const settings = require('./settings');

const MIN = 60000;

function createTray({ onTestFlight, onTestSchedule, onOpenSettings, onQuit, onSnooze, onTogglePause, onOpenLink, onCheckForUpdates, canUpdate }) {
  const icon = nativeImage.createFromPath(
    path.join(__dirname, '..', '..', 'assets', 'trayTemplate.png'));
  const tray = new Tray(icon);
  tray.setToolTip('Airplane Banner');

  let statusLine = 'Starting…';
  let nextStart = null; // epoch ms of the next meeting, or null
  let agenda = [];      // today's remaining meetings: [{ title, start, conferenceLink }]

  function fmtTime(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  // Build the "Today" section: each remaining meeting as time — title. Meetings
  // with a video link are clickable to join; the rest are shown for reference.
  function agendaItems() {
    const upcoming = agenda.filter((e) => e.start > Date.now() - 60000);
    if (!upcoming.length) return [{ label: 'No more meetings today', enabled: false }];
    return upcoming.map((e) => {
      const title = e.title.length > 38 ? e.title.slice(0, 37) + '…' : e.title;
      const join = e.conferenceLink && onOpenLink;
      return {
        label: `${fmtTime(e.start)}  —  ${title}${join ? '  ↗' : ''}`,
        enabled: !!join,
        click: join ? () => onOpenLink(e.conferenceLink) : undefined,
      };
    });
  }

  function build() {
    const paused = settings.get('paused');
    const snoozeUntil = settings.get('snoozeUntilEpochMs');
    const snoozed = snoozeUntil && snoozeUntil > Date.now();
    const untilNextMeeting = (nextStart && nextStart > Date.now())
      ? [{ label: 'Until next meeting starts', click: () => onSnooze(nextStart) }]
      : [];
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: statusLine, enabled: false },
      { label: 'Today', submenu: agendaItems() },
      { type: 'separator' },
      { label: 'Test flight', click: onTestFlight },
      { label: 'Schedule test flight (1 min)', click: onTestSchedule },
      {
        label: 'Snooze',
        submenu: [
          { label: 'For 15 minutes', click: () => onSnooze(Date.now() + 15 * MIN) },
          { label: 'For 1 hour', click: () => onSnooze(Date.now() + 60 * MIN) },
          ...untilNextMeeting,
          { label: 'Until tomorrow', click: () => onSnooze(nextMorning()) },
          ...(snoozed ? [{ type: 'separator' }, { label: 'Cancel snooze', click: () => onSnooze(null) }] : []),
        ],
      },
      { label: paused ? 'Resume' : 'Pause', click: onTogglePause },
      { type: 'separator' },
      { label: 'Settings…', click: onOpenSettings },
      ...(onCheckForUpdates && canUpdate ? [{ label: 'Check for updates…', click: onCheckForUpdates }] : []),
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
    setNextStart(ts) { nextStart = ts; },
    setAgenda(events) { agenda = Array.isArray(events) ? events : []; build(); },
    // The countdown shown beside the icon in the menu bar. macOS only — on
    // other platforms setTitle is a no-op, so the icon simply stands alone.
    setTitle(text) { if (process.platform === 'darwin') tray.setTitle(text || ''); },
    // Hover tooltip — works on every platform. On Windows the taskbar tray shows
    // only an icon, so this is the way the next meeting surfaces there.
    setTooltipText(text) { tray.setToolTip(text || 'Airplane Banner'); },
    refresh: build,
  };
}

module.exports = { createTray };
