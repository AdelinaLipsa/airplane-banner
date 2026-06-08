const { test } = require('node:test');
const assert = require('node:assert');
const { shouldSuppressForPresence } = require('../src/main/presence');

const BOTH_ON = { suppressInFullscreen: true, suppressInDnd: true };

test('suppresses when a fullscreen app is frontmost and the pref is on', () => {
  assert.strictEqual(shouldSuppressForPresence({ fullscreen: true, dnd: false }, BOTH_ON), true);
});

test('suppresses when DND/Focus is active and the pref is on', () => {
  assert.strictEqual(shouldSuppressForPresence({ fullscreen: false, dnd: true }, BOTH_ON), true);
});

test('does not suppress when neither state is active', () => {
  assert.strictEqual(shouldSuppressForPresence({ fullscreen: false, dnd: false }, BOTH_ON), false);
});

test('respects the fullscreen pref being off', () => {
  assert.strictEqual(
    shouldSuppressForPresence({ fullscreen: true, dnd: false }, { suppressInFullscreen: false, suppressInDnd: true }),
    false,
  );
});

test('respects the DND pref being off', () => {
  assert.strictEqual(
    shouldSuppressForPresence({ fullscreen: false, dnd: true }, { suppressInFullscreen: true, suppressInDnd: false }),
    false,
  );
});

test('still suppresses on fullscreen even if only DND pref is off', () => {
  assert.strictEqual(
    shouldSuppressForPresence({ fullscreen: true, dnd: true }, { suppressInFullscreen: true, suppressInDnd: false }),
    true,
  );
});

test('handles missing/partial inputs safely', () => {
  assert.strictEqual(shouldSuppressForPresence({}, {}), false);
  assert.strictEqual(shouldSuppressForPresence(undefined, undefined), false);
});
