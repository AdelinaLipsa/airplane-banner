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
