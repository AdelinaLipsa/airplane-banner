'use strict';

// The actual join URL, or null. (hasConferenceLink is just !!this.)
function conferenceLink(raw) {
  if (raw.hangoutLink) return raw.hangoutLink;
  const eps = raw.conferenceData && raw.conferenceData.entryPoints;
  if (eps && eps.length) {
    const video = eps.find((e) => e.entryPointType === 'video') || eps[0];
    if (video && video.uri) return video.uri;
  }
  const text = `${raw.location || ''} ${raw.description || ''}`;
  const m = text.match(/https?:\/\/[^\s)]*(?:meet\.google\.com|zoom\.us|teams\.microsoft\.com|webex\.com)[^\s)]*/i);
  return m ? m[0] : null;
}

function selfResponse(raw) {
  const attendees = raw.attendees || [];
  const me = attendees.find((a) => a.self === true);
  return me ? (me.responseStatus || null) : null;
}

// Per-event reminder minutes the user set on the event itself, or null to mean
// "use the app's global offsets". When useDefault is false we honor the event's
// own overrides (preferring popup reminders, which match a visual banner); an
// empty override list then means the user explicitly silenced this event.
function reminderOverrides(raw) {
  const r = raw.reminders;
  if (!r || r.useDefault) return null;
  const overrides = Array.isArray(r.overrides) ? r.overrides : [];
  const popup = overrides.filter((o) => o.method === 'popup');
  const minutes = (popup.length ? popup : overrides)
    .map((o) => o.minutes)
    .filter((m) => Number.isInteger(m) && m >= 0);
  return Array.from(new Set(minutes)).sort((a, b) => a - b);
}

// A meeting can opt out of flying with a [no-fly] / #nofly marker in its title
// or description (handy for recurring focus blocks you don't want announced).
function isOptOut(raw) {
  return /\[no-?fly\]|#no-?fly/i.test(`${raw.summary || ''} ${raw.description || ''}`);
}

function normalizeEvent(raw, { calendarId }) {
  const isAllDay = !!(raw.start && raw.start.date && !raw.start.dateTime);
  const startStr = raw.start && (raw.start.dateTime || raw.start.date);
  const attendees = raw.attendees || [];
  const link = conferenceLink(raw);
  return {
    id: raw.id,
    title: raw.summary || 'Meeting',
    start: startStr ? Date.parse(startStr) : NaN,
    isAllDay,
    responseStatus: selfResponse(raw),
    calendarId,
    hasAttendees: attendees.some((a) => a.self !== true),
    hasConferenceLink: !!link,
    conferenceLink: link,
    reminderOverrides: reminderOverrides(raw),
    optOut: isOptOut(raw),
  };
}

function normalizeEvents(rawItems, opts) {
  return (rawItems || []).map((raw) => normalizeEvent(raw, opts));
}

module.exports = { normalizeEvent, normalizeEvents };
