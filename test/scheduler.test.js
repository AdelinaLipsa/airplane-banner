const { test } = require('node:test');
const assert = require('node:assert');
const { computeReminders, reminderKey, isSuppressed, createScheduler } = require('../src/main/scheduler');

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
