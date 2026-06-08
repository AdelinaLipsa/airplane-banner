'use strict';
// "Don't embarrass me" detection: decide whether the user is in a state where a
// banner flying across the screen would be awkward — presenting in fullscreen,
// or with a macOS Focus / Do Not Disturb active. We deliberately skip the whole
// flight in those states rather than trying to hide the title, because detecting
// "a fullscreen app is frontmost" / "Focus is on" is far more dependable than
// screen-share detection.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

// Pure decision: given detected presence states and the user's preferences,
// should this flight be suppressed?
function shouldSuppressForPresence(states, prefs) {
  const { fullscreen, dnd } = states || {};
  const { suppressInFullscreen, suppressInDnd } = prefs || {};
  if (suppressInFullscreen && fullscreen) return true;
  if (suppressInDnd && dnd) return true;
  return false;
}

// Run a command with a hard timeout; resolve null on any error/timeout so a
// stuck probe can never block (or wrongly suppress) a flight.
function execFileP(cmd, args, timeoutMs) {
  return new Promise((resolve) => {
    try {
      const child = execFile(cmd, args, { timeout: timeoutMs }, (err, stdout) =>
        resolve(err ? null : String(stdout).trim()));
      child.on('error', () => resolve(null));
    } catch { resolve(null); }
  });
}

// macOS Focus / Do Not Disturb: the system writes an assertion record to this
// file while a Focus is actively asserted; an empty/absent record set means no
// Focus is on right now. (Scheduled Focuses that don't write an assertion are a
// known blind spot — we err toward flying rather than silently swallowing.)
function isDndActiveMac() {
  try {
    const p = path.join(os.homedir(), 'Library', 'DoNotDisturb', 'DB', 'Assertions.json');
    const json = JSON.parse(fs.readFileSync(p, 'utf8'));
    const records = (json.data && json.data[0] && json.data[0].storeAssertionRecords) || [];
    return records.length > 0;
  } catch { return false; }
}

// macOS: is the frontmost app's front window in native fullscreen? Uses System
// Events (needs Accessibility permission); returns false if it can't tell, so a
// missing permission degrades to "fly normally" rather than over-suppressing.
async function isFrontmostFullscreenMac() {
  const script = 'tell application "System Events" to tell (first process whose frontmost is true) '
    + 'to get value of attribute "AXFullScreen" of front window';
  const out = await execFileP('osascript', ['-e', script], 600);
  return out === 'true';
}

// Probe current presence. Only macOS is supported today; elsewhere we report
// "nothing active" so flights are never suppressed by this feature.
async function detectPresence() {
  if (process.platform !== 'darwin') return { fullscreen: false, dnd: false };
  const fullscreen = await isFrontmostFullscreenMac().catch(() => false);
  const dnd = isDndActiveMac();
  return { fullscreen, dnd };
}

module.exports = {
  shouldSuppressForPresence, detectPresence, isDndActiveMac, isFrontmostFullscreenMac,
};
