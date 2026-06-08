const { test } = require('node:test');
const assert = require('node:assert');
const {
  mergeCalendars, resolveAccountId, upsertById, selectedCalendars, namespaceId,
} = require('../src/main/accounts');

test('mergeCalendars defaults new calendars to selected only when primary', () => {
  const out = mergeCalendars([], [
    { id: 'me@x.com', summary: 'Me', primary: true },
    { id: 'team@x.com', summary: 'Team' },
  ]);
  assert.strictEqual(out.find((c) => c.primary).selected, true);
  assert.strictEqual(out.find((c) => c.id === 'team@x.com').selected, false);
});

test('mergeCalendars preserves prior selected flags across a refresh', () => {
  const existing = [{ id: 'team@x.com', summary: 'Team', primary: false, selected: true }];
  const out = mergeCalendars(existing, [
    { id: 'me@x.com', summary: 'Me', primary: true },
    { id: 'team@x.com', summary: 'Team (renamed)' },
  ]);
  assert.strictEqual(out.find((c) => c.id === 'team@x.com').selected, true);
  assert.strictEqual(out.find((c) => c.id === 'team@x.com').summary, 'Team (renamed)');
});

test('resolveAccountId reuses an existing id for the same email', () => {
  const accounts = [{ id: '__migrated__', email: 'me@x.com', calendars: [] }];
  assert.strictEqual(resolveAccountId(accounts, 'me@x.com'), '__migrated__');
});

test('resolveAccountId uses the email as id for a new account', () => {
  assert.strictEqual(resolveAccountId([], 'new@x.com'), 'new@x.com');
});

test('upsertById replaces an existing account and adds a new one', () => {
  let accts = [{ id: 'a', email: 'a@x', calendars: [] }];
  accts = upsertById(accts, { id: 'a', email: 'a@x', calendars: [{ id: 'p', selected: true }] });
  assert.strictEqual(accts.length, 1);
  assert.strictEqual(accts[0].calendars.length, 1);
  accts = upsertById(accts, { id: 'b', email: 'b@x', calendars: [] });
  assert.strictEqual(accts.length, 2);
});

test('selectedCalendars returns only selected entries', () => {
  const acct = { calendars: [{ id: 'p', selected: true }, { id: 'q', selected: false }] };
  assert.deepStrictEqual(selectedCalendars(acct).map((c) => c.id), ['p']);
});

test('namespaceId makes ids unique per account', () => {
  assert.strictEqual(namespaceId('a@x', 'evt1'), 'a@x::evt1');
  assert.notStrictEqual(namespaceId('a@x', 'evt1'), namespaceId('b@x', 'evt1'));
});
