'use strict';
// Theme palettes, shared by the main process (floating pill). The overlay
// renderer keeps its own copy in plane.js because it runs without `require`.
// `fabric` is the banner background, `ink` the text on it, `pop` the accent.
const THEMES = {
  retro:  { fabric: '#facc15', ink: '#1e1b4b', pop: '#f43f5e' },
  aurora: { fabric: '#0b1020', ink: '#5eead4', pop: '#a78bfa' },
  sunset: { fabric: '#fb7185', ink: '#ffffff', pop: '#f97316' },
  mono:   { fabric: '#0a0a0a', ink: '#fafafa', pop: '#9ca3af' },
};

function paletteFor(name) {
  return THEMES[name] || THEMES.retro;
}

module.exports = { THEMES, paletteFor };
