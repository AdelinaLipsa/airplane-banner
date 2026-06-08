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
  $('theme').value = c.theme || 'retro';
  $('flightDuration').value = c.flightDurationSeconds || 12;
  updateDurLabel();
  $('sound').checked = !!c.sound;
  $('soundName').value = c.soundName || 'fanfare';
  $('soundVolume').value = Math.round((c.soundVolume != null ? c.soundVolume : 0.2) * 100);
  updateVolLabel();
  updateSoundOpts();
  $('clickableBanner').checked = !!c.clickableBanner;
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
    theme: $('theme').value,
    flightDurationSeconds: parseInt($('flightDuration').value, 10) || 12,
    sound: $('sound').checked,
    soundName: $('soundName').value,
    soundVolume: (parseInt($('soundVolume').value, 10) || 0) / 100,
    clickableBanner: $('clickableBanner').checked,
    launchAtLogin: $('launchAtLogin').checked,
  };
}

function updateDurLabel() { $('durLabel').textContent = $('flightDuration').value + 's'; }
$('flightDuration').addEventListener('input', updateDurLabel);

// --- Sound choices ---------------------------------------------------------
// Populate the chime dropdown from the shared module so it never drifts.
(function populateChimes() {
  const chimes = (window.AirplaneChimes && window.AirplaneChimes.CHIMES) || {};
  for (const [name, recipe] of Object.entries(chimes)) {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = recipe.label || name;
    $('soundName').appendChild(opt);
  }
})();
function updateVolLabel() { $('volLabel').textContent = $('soundVolume').value + '%'; }
function updateSoundOpts() { $('soundOpts').style.opacity = $('sound').checked ? '1' : '0.45'; }
$('soundVolume').addEventListener('input', updateVolLabel);
$('sound').addEventListener('change', updateSoundOpts);
$('soundPreview').addEventListener('click', () => {
  if (window.AirplaneChimes) {
    window.AirplaneChimes.playChime($('soundName').value, (parseInt($('soundVolume').value, 10) || 0) / 100);
  }
});

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
