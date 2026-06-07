const api = window.settingsApi;
const $ = (id) => document.getElementById(id);

async function refreshStatus() {
  const s = await api.authStatus();
  $('status').textContent = s.signedIn
    ? '✅ Connected to Google Calendar'
    : (s.hasCredentials ? 'Not signed in.' : 'This build isn’t configured for Google sign-in yet.');
  // Show only the relevant button for the current state.
  $('signIn').style.display = s.signedIn ? 'none' : '';
  $('signOut').style.display = s.signedIn ? '' : 'none';
  $('signIn').disabled = !s.hasCredentials;
}

async function load() {
  const c = await api.load();
  $('offsets').value = (c.reminderOffsetsMinutes || []).join(', ');
  $('skipAllDay').checked = c.filters.skipAllDay;
  $('skipDeclined').checked = c.filters.skipDeclined;
  $('primaryCalendarOnly').checked = c.filters.primaryCalendarOnly;
  $('requireAttendeesOrLink').checked = c.filters.requireAttendeesOrLink;
  $('showTitle').checked = c.showTitle;
  $('launchAtLogin').checked = c.launchAtLogin;
  await refreshStatus();
}

function collect() {
  const offsets = $('offsets').value.split(',')
    .map((x) => parseInt(x.trim(), 10))
    .filter((n) => Number.isFinite(n) && n >= 0);
  return {
    reminderOffsetsMinutes: offsets.length ? offsets : [15, 5, 0],
    filters: {
      skipAllDay: $('skipAllDay').checked,
      skipDeclined: $('skipDeclined').checked,
      primaryCalendarOnly: $('primaryCalendarOnly').checked,
      requireAttendeesOrLink: $('requireAttendeesOrLink').checked,
    },
    showTitle: $('showTitle').checked,
    launchAtLogin: $('launchAtLogin').checked,
  };
}

$('save').addEventListener('click', async () => {
  await api.save(collect());
  $('saved').textContent = 'Saved ✓';
  setTimeout(() => ($('saved').textContent = ''), 1500);
});
$('signIn').addEventListener('click', async () => {
  await api.save(collect());          // persist any settings changes first
  $('status').textContent = 'Opening browser…';
  try { await api.signIn(); } catch (e) { $('status').textContent = 'Error: ' + e.message; }
  await refreshStatus();
});
$('signOut').addEventListener('click', async () => { await api.signOut(); await refreshStatus(); });

load();
