'use strict';

const MIN = 60000;

function computeReminders(events, offsetsMinutes, now) {
  const out = [];
  for (const event of events) {
    for (const offset of offsetsMinutes) {
      const fireAt = event.start - offset * MIN;
      if (fireAt > now) {
        out.push({ eventId: event.id, offset, fireAt, minutes: offset, title: event.title });
      }
    }
  }
  return out;
}

function reminderKey(r) {
  return `${r.eventId}:${r.offset}`;
}

function isSuppressed(now, { paused, snoozeUntilEpochMs }) {
  if (paused) return true;
  if (snoozeUntilEpochMs && snoozeUntilEpochMs > now) return true;
  return false;
}

module.exports = { computeReminders, reminderKey, isSuppressed, MIN };

// --- Live scheduler -------------------------------------------------------

// Node/Electron setTimeout uses a 32-bit ms delay (~24.8 days). Cap each timer
// and re-arm if the real fire time is further out.
const MAX_DELAY = 2 ** 31 - 1;

function createScheduler({ getState, onFly }) {
  // getState() -> { offsetsMinutes, paused, snoozeUntilEpochMs }
  // onFly({ minutes, title }) -> show the banner
  const timers = new Map();   // key -> Timeout
  const fired = new Set();    // key -> already shown

  function arm(reminder) {
    const key = reminderKey(reminder);
    if (fired.has(key) || timers.has(key)) return;
    const delay = Math.min(reminder.fireAt - Date.now(), MAX_DELAY);
    const t = setTimeout(() => {
      timers.delete(key);
      if (reminder.fireAt - Date.now() > 1000) { arm(reminder); return; } // re-arm long timers
      fired.add(key);
      const state = getState();
      if (isSuppressed(Date.now(), state)) return; // paused/snoozed -> skip, do not requeue
      onFly({ minutes: reminder.minutes, title: reminder.title });
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
