'use strict';

const MIN = 60000;

function computeReminders(events, offsetsMinutes, now) {
  const out = [];
  for (const event of events) {
    for (const offset of offsetsMinutes) {
      const fireAt = event.start - offset * MIN;
      if (fireAt > now) {
        out.push({ eventId: event.id, offset, fireAt, minutes: offset, title: event.title, startAt: event.start, link: event.conferenceLink || null });
      }
    }
  }
  return out;
}

function reminderKey(r) {
  return `${r.eventId}:${r.offset}`;
}

// True if `date` (local time) falls inside the configured working hours. A
// window where endHour <= startHour is treated as wrapping past midnight (e.g.
// 22→6). Disabled config is always "within" (never restricts).
function isWithinActiveHours(date, activeHours) {
  if (!activeHours || !activeHours.enabled) return true;
  const { startHour = 0, endHour = 24, days } = activeHours;
  if (Array.isArray(days) && days.length && !days.includes(date.getDay())) return false;
  const hour = date.getHours() + date.getMinutes() / 60;
  if (startHour <= endHour) return hour >= startHour && hour < endHour;
  return hour >= startHour || hour < endHour; // wraps midnight
}

function isSuppressed(now, { paused, snoozeUntilEpochMs, activeHours } = {}) {
  if (paused) return true;
  if (snoozeUntilEpochMs && snoozeUntilEpochMs > now) return true;
  if (activeHours && activeHours.enabled && !isWithinActiveHours(new Date(now), activeHours)) return true;
  return false;
}

module.exports = { computeReminders, reminderKey, isSuppressed, isWithinActiveHours, MIN };

// --- Live scheduler -------------------------------------------------------

// Node/Electron setTimeout uses a 32-bit ms delay (~24.8 days). Cap each timer
// and re-arm if the real fire time is further out.
const MAX_DELAY = 2 ** 31 - 1;

function createScheduler({ getState, onFly, loadFired, saveFired }) {
  // getState() -> { offsetsMinutes, paused, snoozeUntilEpochMs }
  // onFly({ minutes, title }) -> show the banner
  // loadFired() -> string[] of reminder keys already shown (persisted)
  // saveFired(keys) -> persist newly-fired reminder keys
  const timers = new Map();                                  // key -> Timeout
  const fired = new Set(loadFired ? loadFired() : []);       // key -> already shown

  function arm(reminder) {
    const key = reminderKey(reminder);
    if (fired.has(key) || timers.has(key)) return;
    const delay = Math.min(reminder.fireAt - Date.now(), MAX_DELAY);
    const t = setTimeout(() => {
      timers.delete(key);
      if (reminder.fireAt - Date.now() > 1000) { arm(reminder); return; } // re-arm long timers
      fired.add(key);
      if (saveFired) saveFired([key]);
      const state = getState();
      if (isSuppressed(Date.now(), state)) return; // paused/snoozed -> skip, do not requeue
      // Show the *live* minutes-to-start (handles timers that fired late, e.g.
      // after the laptop woke from sleep), not the originally-configured offset.
      const startAt = reminder.startAt != null ? reminder.startAt : reminder.fireAt + reminder.offset * MIN;
      const liveMinutes = Math.max(0, Math.round((startAt - Date.now()) / MIN));
      onFly({ minutes: liveMinutes, title: reminder.title, link: reminder.link });
    }, Math.max(delay, 0));
    timers.set(key, t);
  }

  return {
    // Recompute from the latest events; arm any new, not-yet-fired reminders.
    update(events) {
      const { offsetsMinutes } = getState();
      const reminders = computeReminders(events, offsetsMinutes, Date.now());
      for (const r of reminders) arm(r);
    },
    // Fire a sample banner immediately (Test flight).
    testFly() {
      onFly({ minutes: 10, title: 'Standup with Design' });
    },
    // Cancel everything (e.g., on sign-out).
    clear() {
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
      fired.clear();
    },
    _debug: { timers, fired },
  };
}

module.exports.createScheduler = createScheduler;
