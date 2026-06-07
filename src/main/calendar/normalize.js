'use strict';

function detectConferenceLink(raw) {
  if (raw.hangoutLink) return true;
  if (raw.conferenceData && raw.conferenceData.entryPoints &&
      raw.conferenceData.entryPoints.length > 0) return true;
  const text = `${raw.location || ''} ${raw.description || ''}`.toLowerCase();
  return /meet\.google\.com|zoom\.us|teams\.microsoft\.com|webex\.com/.test(text);
}

function selfResponse(raw) {
  const attendees = raw.attendees || [];
  const me = attendees.find((a) => a.self === true);
  return me ? (me.responseStatus || null) : null;
}

function normalizeEvent(raw, { calendarId }) {
  const isAllDay = !!(raw.start && raw.start.date && !raw.start.dateTime);
  const startStr = raw.start && (raw.start.dateTime || raw.start.date);
  const attendees = raw.attendees || [];
  return {
    id: raw.id,
    title: raw.summary || 'Meeting',
    start: startStr ? Date.parse(startStr) : NaN,
    isAllDay,
    responseStatus: selfResponse(raw),
    calendarId,
    hasAttendees: attendees.some((a) => a.self !== true),
    hasConferenceLink: detectConferenceLink(raw),
  };
}

function normalizeEvents(rawItems, opts) {
  return (rawItems || []).map((raw) => normalizeEvent(raw, opts));
}

module.exports = { normalizeEvent, normalizeEvents };
