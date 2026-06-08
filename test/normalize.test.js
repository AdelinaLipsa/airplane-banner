const { test } = require('node:test');
const assert = require('node:assert');
const { normalizeEvent, normalizeEvents } = require('../src/main/calendar/normalize');

const base = {
  id: 'e1',
  summary: 'Standup',
  start: { dateTime: '2026-06-07T10:00:00Z' },
  attendees: [
    { self: true, responseStatus: 'accepted' },
    { email: 'a@b.com', responseStatus: 'accepted' },
  ],
};

test('normalizes a timed event with attendees', () => {
  const ev = normalizeEvent(base, { calendarId: 'primary' });
  assert.strictEqual(ev.id, 'e1');
  assert.strictEqual(ev.title, 'Standup');
  assert.strictEqual(ev.start, Date.parse('2026-06-07T10:00:00Z'));
  assert.strictEqual(ev.isAllDay, false);
  assert.strictEqual(ev.responseStatus, 'accepted');
  assert.strictEqual(ev.calendarId, 'primary');
  assert.strictEqual(ev.hasAttendees, true);
  assert.strictEqual(ev.hasConferenceLink, false);
});

test('detects all-day events', () => {
  const ev = normalizeEvent({ id: 'e2', summary: 'OOO', start: { date: '2026-06-07' } }, { calendarId: 'primary' });
  assert.strictEqual(ev.isAllDay, true);
});

test('detects conference link via hangoutLink', () => {
  const ev = normalizeEvent({ ...base, hangoutLink: 'https://meet.google.com/xyz' }, { calendarId: 'primary' });
  assert.strictEqual(ev.hasConferenceLink, true);
  assert.strictEqual(ev.conferenceLink, 'https://meet.google.com/xyz');
});

test('extracts a zoom link from the description', () => {
  const ev = normalizeEvent({ ...base, description: 'Join: https://zoom.us/j/123456?pwd=abc see you' }, { calendarId: 'primary' });
  assert.strictEqual(ev.conferenceLink, 'https://zoom.us/j/123456?pwd=abc');
  assert.strictEqual(ev.hasConferenceLink, true);
});

test('no link -> conferenceLink null', () => {
  const ev = normalizeEvent(base, { calendarId: 'primary' });
  assert.strictEqual(ev.conferenceLink, null);
  assert.strictEqual(ev.hasConferenceLink, false);
});

test('hasAttendees is false when only self', () => {
  const ev = normalizeEvent({ ...base, attendees: [{ self: true, responseStatus: 'accepted' }] }, { calendarId: 'primary' });
  assert.strictEqual(ev.hasAttendees, false);
  assert.strictEqual(ev.responseStatus, 'accepted');
});

test('missing summary falls back to "Meeting", missing attendees safe', () => {
  const ev = normalizeEvent({ id: 'e3', start: { dateTime: '2026-06-07T10:00:00Z' } }, { calendarId: 'primary' });
  assert.strictEqual(ev.title, 'Meeting');
  assert.strictEqual(ev.hasAttendees, false);
  assert.strictEqual(ev.responseStatus, null);
});

test('reminderOverrides is null when reminders use the default', () => {
  const ev = normalizeEvent({ ...base, reminders: { useDefault: true } }, { calendarId: 'primary' });
  assert.strictEqual(ev.reminderOverrides, null);
});

test('reminderOverrides extracts custom popup minutes (deduped, sorted)', () => {
  const ev = normalizeEvent({
    ...base,
    reminders: { useDefault: false, overrides: [
      { method: 'popup', minutes: 10 },
      { method: 'email', minutes: 60 },
      { method: 'popup', minutes: 2 },
      { method: 'popup', minutes: 10 },
    ] },
  }, { calendarId: 'primary' });
  assert.deepStrictEqual(ev.reminderOverrides, [2, 10]);
});

test('reminderOverrides falls back to any method when no popup override', () => {
  const ev = normalizeEvent({
    ...base, reminders: { useDefault: false, overrides: [{ method: 'email', minutes: 30 }] },
  }, { calendarId: 'primary' });
  assert.deepStrictEqual(ev.reminderOverrides, [30]);
});

test('reminderOverrides is [] when notifications explicitly silenced', () => {
  const ev = normalizeEvent({ ...base, reminders: { useDefault: false, overrides: [] } }, { calendarId: 'primary' });
  assert.deepStrictEqual(ev.reminderOverrides, []);
});

test('optOut detects [no-fly] / #nofly markers in title or description', () => {
  assert.strictEqual(normalizeEvent({ ...base, summary: 'Focus [no-fly]' }, { calendarId: 'primary' }).optOut, true);
  assert.strictEqual(normalizeEvent({ ...base, description: 'please #nofly' }, { calendarId: 'primary' }).optOut, true);
  assert.strictEqual(normalizeEvent(base, { calendarId: 'primary' }).optOut, false);
});

test('normalizeEvents maps a list and tags calendarId', () => {
  const out = normalizeEvents([base], { calendarId: 'primary' });
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].calendarId, 'primary');
});
