const { test } = require('node:test');
const assert = require('node:assert');
const { shouldAnnounce, filterEvents } = require('../src/main/calendar/filter');

const ALL_ON = {
  skipAllDay: true,
  skipDeclined: true,
  primaryCalendarOnly: true,
  requireAttendeesOrLink: true,
};

function ev(overrides) {
  return {
    id: 'e', title: 'M', start: Date.now() + 60000, isAllDay: false,
    responseStatus: 'accepted', calendarId: 'primary',
    hasAttendees: true, hasConferenceLink: false, ...overrides,
  };
}

test('keeps a normal accepted primary meeting with attendees', () => {
  assert.strictEqual(shouldAnnounce(ev(), ALL_ON), true);
});

test('skips all-day events when enabled', () => {
  assert.strictEqual(shouldAnnounce(ev({ isAllDay: true }), ALL_ON), false);
});

test('skips declined events when enabled', () => {
  assert.strictEqual(shouldAnnounce(ev({ responseStatus: 'declined' }), ALL_ON), false);
});

test('skips non-primary calendars when enabled', () => {
  assert.strictEqual(shouldAnnounce(ev({ calendarId: 'other@group' }), ALL_ON), false);
});

test('skips solo blocks (no attendees, no link) when required', () => {
  assert.strictEqual(shouldAnnounce(ev({ hasAttendees: false, hasConferenceLink: false }), ALL_ON), false);
});

test('keeps solo block with a conference link', () => {
  assert.strictEqual(shouldAnnounce(ev({ hasAttendees: false, hasConferenceLink: true }), ALL_ON), true);
});

test('respects disabled filters', () => {
  const NONE = { skipAllDay: false, skipDeclined: false, primaryCalendarOnly: false, requireAttendeesOrLink: false };
  assert.strictEqual(shouldAnnounce(ev({ isAllDay: true, responseStatus: 'declined', hasAttendees: false }), NONE), true);
});

test('filterEvents removes the disqualified ones', () => {
  const list = [ev(), ev({ id: 'x', isAllDay: true })];
  const out = filterEvents(list, ALL_ON);
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].id, 'e');
});
