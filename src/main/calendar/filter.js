'use strict';

function shouldAnnounce(event, filters) {
  if (filters.skipAllDay && event.isAllDay) return false;
  if (filters.skipDeclined && event.responseStatus === 'declined') return false;
  if (filters.primaryCalendarOnly && event.calendarId !== 'primary') return false;
  if (filters.requireAttendeesOrLink && !(event.hasAttendees || event.hasConferenceLink)) return false;
  return true;
}

function filterEvents(events, filters) {
  return events.filter((e) => shouldAnnounce(e, filters));
}

module.exports = { shouldAnnounce, filterEvents };
