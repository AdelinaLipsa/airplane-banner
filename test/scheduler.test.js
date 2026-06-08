const { test } = require('node:test');
const assert = require('node:assert');
const { computeReminders, reminderKey, isSuppressed, isWithinActiveHours, createScheduler } = require('../src/main/scheduler');

const MIN = 60000;

function ev(id, startOffsetMin, title = 'Standup') {
  return { id, title, start: 1000000 + startOffsetMin * MIN };
}

test('computes one reminder per (event, offset) in the future', () => {
  const now = 1000000;
  const events = [ev('a', 20)]; // starts 20 min from now
  const out = computeReminders(events, [15, 5, 0], now);
  // fire times: start-15 (=+5min, future), start-5 (=+15min), start-0 (=+20min)
  assert.strictEqual(out.length, 3);
  const offsets = out.map((r) => r.offset).sort((x, y) => x - y);
  assert.deepStrictEqual(offsets, [0, 5, 15]);
  const r15 = out.find((r) => r.offset === 15);
  assert.strictEqual(r15.fireAt, ev('a', 20).start - 15 * MIN);
  assert.strictEqual(r15.minutes, 15);
  assert.strictEqual(r15.title, 'Standup');
  assert.strictEqual(r15.eventId, 'a');
});

test('drops reminders whose fire time is already past', () => {
  const now = 1000000;
  const events = [ev('a', 3)]; // starts in 3 min
  const out = computeReminders(events, [15, 5, 0], now);
  // start-15 and start-5 are in the past; only start-0 (+3min) remains
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].offset, 0);
});

test('reminderKey is stable per event+offset', () => {
  assert.strictEqual(reminderKey({ eventId: 'a', offset: 5 }), 'a:5');
});

test('computeReminders includes the event start time', () => {
  const now = 1000000;
  const events = [ev('a', 20)];
  const out = computeReminders(events, [15], now);
  assert.strictEqual(out[0].startAt, events[0].start);
});

test('createScheduler seeds its fired set from loadFired (no re-fire after restart)', () => {
  const s = createScheduler({
    getState: () => ({ offsetsMinutes: [5], paused: false, snoozeUntilEpochMs: null }),
    onFly: () => {},
    loadFired: () => ['a:5'],
  });
  assert.strictEqual(s._debug.fired.has('a:5'), true);
});

test('isSuppressed true when paused', () => {
  assert.strictEqual(isSuppressed(1000, { paused: true, snoozeUntilEpochMs: null }), true);
});

test('isSuppressed true when snooze is in the future', () => {
  assert.strictEqual(isSuppressed(1000, { paused: false, snoozeUntilEpochMs: 5000 }), true);
});

test('isSuppressed false when snooze has passed', () => {
  assert.strictEqual(isSuppressed(9000, { paused: false, snoozeUntilEpochMs: 5000 }), false);
});

test('isSuppressed false when not paused and no snooze', () => {
  assert.strictEqual(isSuppressed(1000, { paused: false, snoozeUntilEpochMs: null }), false);
});

// --- Working / quiet hours -------------------------------------------------
const WEEKDAYS_8_19 = { enabled: true, startHour: 8, endHour: 19, days: [1, 2, 3, 4, 5] };
// 2026-06-08 is a Monday; 2026-06-07 is a Sunday (local time).
function at(y, mo, d, h, mi = 0) { return new Date(y, mo, d, h, mi, 0, 0); }

test('isWithinActiveHours: disabled config is always within', () => {
  assert.strictEqual(isWithinActiveHours(at(2026, 5, 7, 3), { enabled: false, startHour: 8, endHour: 19, days: [1] }), true);
});

test('isWithinActiveHours: weekday inside window is within', () => {
  assert.strictEqual(isWithinActiveHours(at(2026, 5, 8, 10), WEEKDAYS_8_19), true);
});

test('isWithinActiveHours: before start hour is outside', () => {
  assert.strictEqual(isWithinActiveHours(at(2026, 5, 8, 7, 59), WEEKDAYS_8_19), false);
});

test('isWithinActiveHours: endHour is exclusive', () => {
  assert.strictEqual(isWithinActiveHours(at(2026, 5, 8, 19, 0), WEEKDAYS_8_19), false);
  assert.strictEqual(isWithinActiveHours(at(2026, 5, 8, 18, 59), WEEKDAYS_8_19), true);
});

test('isWithinActiveHours: excluded day (Sunday) is outside even mid-window', () => {
  assert.strictEqual(isWithinActiveHours(at(2026, 5, 7, 12), WEEKDAYS_8_19), false);
});

test('isWithinActiveHours: window wrapping midnight (22→6)', () => {
  const night = { enabled: true, startHour: 22, endHour: 6, days: [0, 1, 2, 3, 4, 5, 6] };
  assert.strictEqual(isWithinActiveHours(at(2026, 5, 8, 23), night), true);
  assert.strictEqual(isWithinActiveHours(at(2026, 5, 8, 5), night), true);
  assert.strictEqual(isWithinActiveHours(at(2026, 5, 8, 12), night), false);
});

test('isSuppressed true when outside active hours', () => {
  const ts = at(2026, 5, 8, 22).getTime(); // Monday 10pm
  assert.strictEqual(isSuppressed(ts, { paused: false, snoozeUntilEpochMs: null, activeHours: WEEKDAYS_8_19 }), true);
});

test('isSuppressed false when inside active hours', () => {
  const ts = at(2026, 5, 8, 10).getTime(); // Monday 10am
  assert.strictEqual(isSuppressed(ts, { paused: false, snoozeUntilEpochMs: null, activeHours: WEEKDAYS_8_19 }), false);
});
