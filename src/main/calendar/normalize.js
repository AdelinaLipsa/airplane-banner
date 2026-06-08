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
  };
}

function normalizeEvents(rawItems, opts) {
  return (rawItems || []).map((raw) => normalizeEvent(raw, opts));
}

module.exports = { normalizeEvent, normalizeEvents };
