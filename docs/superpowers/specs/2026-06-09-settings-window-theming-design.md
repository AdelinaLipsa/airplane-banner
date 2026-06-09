# Windows-only themed Settings window — design

## Problem

The Settings window's appearance is fixed to the Retro brand palette and only
switches light/dark via `prefers-color-scheme` (the OS setting). It does not
follow the user's **selected theme** (retro / aurora / sunset / mono). The user
wants the whole Settings UI to adopt the selected theme — **on Windows only**.
On macOS the current OS-driven light/dark behavior stays exactly as-is.

This complements the floating-pill theming (which mirrors the flying banner).
Here the goal is a fully themed *window chrome*, not a banner mirror.

## Scope

- In scope: `src/renderer/settings/index.html` (CSS), `src/renderer/settings/settings.js`
  (apply theme + live update), `src/main/windows/settings-preload.js` (expose platform).
- Out of scope: macOS appearance (unchanged), the overlay banner, the floating pill,
  the in-window theme *preview* stage (its light gradient is a banner backdrop and
  stays as-is).

## Mechanism (gated to Windows)

1. **Expose platform.** `settings-preload.js` adds `platform: process.platform`
   to the `settingsApi` bridge.
2. **Tag the document on Windows.** In `settings.js`, once at startup, if
   `settingsApi.platform === 'win32'`, add a `win` class to `<html>`.
3. **Drive the theme via a data attribute.** A helper sets
   `document.body.dataset.theme` to the current `$('theme').value`. It is called:
   - in `load()` after the theme select is populated, and
   - from the existing `$('theme')` `change` listener (alongside `updateThemePreview`),
     so switching the dropdown re-skins the window **live**, no Save required.
   The helper is a no-op on non-Windows (the `win` class is absent, so the themed
   CSS never matches).
4. **macOS path untouched.** Without the `win` class, only the existing `:root`
   and `@media (prefers-color-scheme: dark)` rules apply.

## CSS

Add four blocks of the form:

```css
html.win body[data-theme="retro"]  { --bg: …; --fg: …; /* full set */ }
html.win body[data-theme="aurora"] { … }
html.win body[data-theme="sunset"] { … }
html.win body[data-theme="mono"]   { … }
```

Selector specificity (`html.win body[data-theme]` = 0,2,1) beats the existing
`:root` rules (incl. inside the media query), so on Windows these win cleanly.
The existing light/dark `:root` blocks remain as the macOS path. Each block
redefines the **full** surface var set so no value leaks from `:root`:
`--bg --fg --muted --card-bg --card-border --field-bg --field-border --legend
--accent --accent-fg --pop`.

### Surface schemes — all dark, tinted per theme

Decision: every theme is a readable **dark** surface in its hue family, with the
theme's signature color as the accent. Using each theme's `fabric` as a literal
page background was rejected (an all-gold retro page / all-pink sunset page is
garish and hard to read). `retro` reuses today's dark-mode values, so a Windows
retro user sees essentially the existing dark mode.

| var | retro | aurora | sunset | mono |
|---|---|---|---|---|
| `--bg` | `#14132b` | `#07101c` | `#2a0f1a` | `#0a0a0a` |
| `--fg` | `#ece9ff` | `#d7fbf3` | `#ffe9ef` | `#fafafa` |
| `--muted` | `#9b97c4` | `#7fa9a2` | `#c98a99` | `#9ca3af` |
| `--card-bg` | `#1b1940` | `#0c1a2b` | `#3a1623` | `#141414` |
| `--card-border` | `#2c2a52` | `#173243` | `#52202f` | `#262626` |
| `--field-bg` | `#221f4a` | `#102234` | `#43192a` | `#1a1a1a` |
| `--field-border` | `#3a3766` | `#1e3d50` | `#6b2a3d` | `#333333` |
| `--legend` | `#facc15` | `#5eead4` | `#fb7185` | `#fafafa` |
| `--accent` | `#facc15` | `#5eead4` | `#fb7185` | `#fafafa` |
| `--accent-fg` | `#1e1b4b` | `#07101c` | `#2a0f1a` | `#0a0a0a` |
| `--pop` | `#fb7185` | `#a78bfa` | `#f97316` | `#9ca3af` |

`--accent-fg` (button text on `--accent`) is the dark page color for each theme,
giving high contrast on the bright accent button.

## Data flow

```
settings-preload (process.platform) ─► settingsApi.platform
settings.js load() ─► if win32: html.win + body[data-theme=<theme>]
$('theme') change  ─► updateThemePreview() + body[data-theme=<theme>]  (live re-skin)
CSS html.win body[data-theme=X] ─► overrides :root surface vars
```

## Error handling / edge cases

- Non-Windows: helper short-circuits; no `win` class; zero visual change.
- Unknown/missing theme value: `body.dataset.theme` falls back to `retro`
  (matches `load()`'s existing `c.theme || 'retro'`).
- `prefers-color-scheme` on Windows is effectively overridden by the themed
  blocks' higher specificity, so the window no longer flips with the OS setting
  on Windows — intended (theme is now the source of truth there).

## Testing

- Manual (primary): on Windows, switch each of the four themes and confirm the
  whole window re-skins live and stays readable; confirm Save persists and a
  reopened window loads themed. On macOS, confirm appearance is unchanged and
  still follows OS light/dark.
- No new automated unit tests: this is presentation-only CSS/DOM wiring with no
  pure logic to assert. Existing `npm test` must stay green; `eslint` clean.
