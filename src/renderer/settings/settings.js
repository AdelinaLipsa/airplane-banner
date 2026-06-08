const api = window.settingsApi;
const $ = (id) => document.getElementById(id);

async function refreshStatus() {
  const s = await api.authStatus();
  const accounts = s.accounts || [];
  $('status').textContent = accounts.length
    ? `✅ ${accounts.length} account${accounts.length > 1 ? 's' : ''} connected`
    : (s.hasCredentials ? 'No accounts connected.' : 'This build isn’t configured for Google sign-in yet.');
  $('signIn').disabled = !s.hasCredentials;
  renderAccounts(accounts);
}

// Render each connected account with its selectable calendars. Calendar toggles
// and sign-out take effect immediately (their own IPC), independent of Save.
function renderAccounts(accounts) {
  const list = $('accountsList');
  list.innerHTML = '';
  for (const acct of accounts) {
    const box = document.createElement('div');
    box.className = 'account';

    const head = document.createElement('div');
    head.className = 'account-head';
    const email = document.createElement('span');
    email.className = 'account-email';
    email.textContent = acct.email || 'Account (syncing…)';
    const signOut = document.createElement('button');
    signOut.textContent = 'Sign out';
    signOut.addEventListener('click', async () => { await api.signOutAccount(acct.id); await refreshStatus(); });
    head.append(email, signOut);
    box.appendChild(head);

    const cals = acct.calendars || [];
    if (!cals.length) {
      const p = document.createElement('p');
      p.className = 'cal-empty';
      p.textContent = 'Calendars appear after the first sync.';
      box.appendChild(p);
    } else {
      const wrap = document.createElement('div');
      wrap.className = 'cal-list';
      for (const cal of cals) {
        const label = document.createElement('label');
        label.className = 'row';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = !!cal.selected;
        cb.addEventListener('change', () => api.toggleCalendar(acct.id, cal.id, cb.checked));
        label.appendChild(cb);
        label.append(' ' + (cal.summary || cal.id));
        if (cal.primary) {
          const badge = document.createElement('span');
          badge.className = 'cal-primary';
          badge.textContent = '  (primary)';
          label.appendChild(badge);
        }
        wrap.appendChild(label);
      }
      box.appendChild(wrap);
    }
    list.appendChild(box);
  }
}

async function load() {
  const c = await api.load();
  $('offsets').value = (c.reminderOffsetsMinutes || []).join(', ');
  $('respectEventReminders').checked = c.respectEventReminders !== false;
  const ah = c.activeHours || {};
  $('activeHoursEnabled').checked = !!ah.enabled;
  $('startHour').value = ah.startHour != null ? ah.startHour : 8;
  $('endHour').value = ah.endHour != null ? ah.endHour : 19;
  renderDayToggles(ah.days || [1, 2, 3, 4, 5]);
  updateActiveHoursOpts();
  $('suppressInFullscreen').checked = c.suppressInFullscreen !== false;
  $('suppressInDnd').checked = c.suppressInDnd !== false;
  $('skipAllDay').checked = c.filters.skipAllDay;
  $('skipDeclined').checked = c.filters.skipDeclined;
  $('requireAttendeesOrLink').checked = c.filters.requireAttendeesOrLink;
  $('showTitle').checked = c.showTitle;
  $('theme').value = c.theme || 'retro';
  updateThemePreview();
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
    respectEventReminders: $('respectEventReminders').checked,
    activeHours: {
      enabled: $('activeHoursEnabled').checked,
      startHour: clampHour($('startHour').value, 8),
      endHour: clampHour($('endHour').value, 19),
      days: collectDays(),
    },
    suppressInFullscreen: $('suppressInFullscreen').checked,
    suppressInDnd: $('suppressInDnd').checked,
    filters: {
      skipAllDay: $('skipAllDay').checked,
      skipDeclined: $('skipDeclined').checked,
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

// --- Live theme preview ----------------------------------------------------
const PREVIEW_POP = { retro: '#f43f5e', aurora: '#a78bfa', sunset: '#f97316', mono: '#9ca3af' };
function updateThemePreview() {
  const t = $('theme').value || 'retro';
  $('themePreview').dataset.theme = t;
  $('themePreview').style.setProperty('--prevPop', PREVIEW_POP[t] || '#f43f5e');
}
$('theme').addEventListener('change', updateThemePreview);

// --- Working hours ---------------------------------------------------------
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function renderDayToggles(activeDays) {
  const wrap = $('dayToggles');
  wrap.innerHTML = '';
  DAY_LABELS.forEach((label, i) => {
    const id = 'day' + i;
    const span = document.createElement('label');
    span.className = 'row';
    span.style.margin = '4px 10px 4px 0';
    span.innerHTML = `<input type="checkbox" id="${id}" ${activeDays.includes(i) ? 'checked' : ''}/> ${label}`;
    wrap.appendChild(span);
  });
}
function collectDays() {
  const days = [];
  for (let i = 0; i < 7; i++) { const el = $('day' + i); if (el && el.checked) days.push(i); }
  return days;
}
function clampHour(v, fallback) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 && n <= 24 ? n : fallback;
}
function updateActiveHoursOpts() { $('activeHoursOpts').style.opacity = $('activeHoursEnabled').checked ? '1' : '0.45'; }
$('activeHoursEnabled').addEventListener('change', updateActiveHoursOpts);

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

load();
