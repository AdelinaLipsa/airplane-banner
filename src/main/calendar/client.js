'use strict';
const { google } = require('googleapis');

// Fetch upcoming primary-calendar events within the next `hoursAhead` hours.
async function fetchUpcomingEvents(authClient, { hoursAhead = 4 } = {}) {
  const calendar = google.calendar({ version: 'v3', auth: authClient });
  const now = new Date();
  const timeMin = now.toISOString();
  const timeMax = new Date(now.getTime() + hoursAhead * 3600000).toISOString();
  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 50,
  });
  return res.data.items || [];
}

module.exports = { fetchUpcomingEvents };
