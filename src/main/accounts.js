'use strict';
// Pure helpers for the multi-account / multi-calendar model. An account is:
//   { id, email, calendars: [{ id, summary, primary, selected }] }
// Tokens are stored separately (keyed by account id), never in this metadata.
// Keeping the logic here pure makes the tricky parts (dedupe, preserving a
// user's calendar selections across refreshes, id namespacing) unit-testable.

const NS = '::'; // separator between an account id and a raw event/calendar id

// Merge a freshly-fetched calendar list with what we had, preserving the user's
// selected flags. New calendars default to selected only when they're primary.
function mergeCalendars(existing, fetched) {
  const prev = new Map((existing || []).map((c) => [c.id, c]));
  return (fetched || []).map((c) => {
    const had = prev.get(c.id);
    return {
      id: c.id,
      summary: c.summary || c.id,
      primary: !!c.primary,
      selected: had ? !!had.selected : !!c.primary,
    };
  });
}

// The id under which a given email's account should be stored: reuse an existing
// account's id when the email already exists (so re-auth updates, not dupes),
// otherwise use the email itself as a stable id.
function resolveAccountId(accounts, email) {
  const found = (accounts || []).find((a) => a.email && email && a.email === email);
  return found ? found.id : email;
}

// Insert or replace an account by id, returning a new array.
function upsertById(accounts, account) {
  const out = (accounts || []).filter((a) => a.id !== account.id);
  out.push(account);
  return out;
}

function selectedCalendars(account) {
  return (account && account.calendars ? account.calendars : []).filter((c) => c.selected);
}

// Namespace a raw event id with its account so ids are globally unique across
// accounts (two accounts could share an event id), and reverse it for joining.
function namespaceId(accountId, rawId) { return `${accountId}${NS}${rawId}`; }

module.exports = {
  mergeCalendars, resolveAccountId, upsertById, selectedCalendars, namespaceId, NS,
};
