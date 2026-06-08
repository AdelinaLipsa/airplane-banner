'use strict';
const { google } = require('googleapis');

// Fetch upcoming events from a specific calendar within the next `hoursAhead`
// hours. Defaults to 'primary' so existing callers/tests keep working.
async function fetchUpcomingEvents(authClient, { hoursAhead = 4, calendarId = 'primary' } = {}) {
  const calendar = google.calendar({ version: 'v3', auth: authClient });
  const now = new Date();
  const timeMin = now.toISOString();
  const timeMax = new Date(now.getTime() + hoursAhead * 3600000).toISOString();
  const res = await calendar.events.list({
    calendarId,
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 50,
  });
  return res.data.items || [];
}

// List the account's calendars: { id, summary, primary }. The primary entry's
// id is the account's email address.
async function listCalendars(authClient) {
  const calendar = google.calendar({ version: 'v3', auth: authClient });
  const res = await calendar.calendarList.list({ maxResults: 250 });
  return (res.data.items || []).map((c) => ({
    id: c.id,
    summary: c.summaryOverride || c.summary || c.id,
    primary: !!c.primary,
  }));
}

module.exports = { fetchUpcomingEvents, listCalendars };
