'use strict';
// Synthesized flight chimes via Web Audio — no audio assets needed. Shared by
// the overlay (plays on flight) and Settings (preview button). Each chime is a
// small recipe of notes; `playChime(name, volume)` renders it. Exposes
// CHIME_NAMES so the Settings dropdown stays in sync with what's available.
(function (global) {
  // Each recipe: { type, notes: [{ freq, at, dur, glideTo? }] } at/dur in seconds.
  const CHIMES = {
    fanfare: {
      label: 'Fanfare (two notes)',
      type: 'triangle',
      notes: [
        { freq: 660, at: 0, dur: 0.28 },
        { freq: 880, at: 0.14, dur: 0.28 },
      ],
    },
    ding: {
      label: 'Ding (single)',
      type: 'sine',
      notes: [{ freq: 880, at: 0, dur: 0.5 }],
    },
    chord: {
      label: 'Chord (major)',
      type: 'sine',
      notes: [
        { freq: 523.25, at: 0, dur: 0.6 },
        { freq: 659.25, at: 0, dur: 0.6 },
        { freq: 783.99, at: 0, dur: 0.6 },
      ],
    },
    arcade: {
      label: 'Arcade (retro)',
      type: 'square',
      notes: [
        { freq: 880, at: 0, dur: 0.1 },
        { freq: 1175, at: 0.09, dur: 0.14 },
      ],
    },
    swoop: {
      label: 'Swoop (rising)',
      type: 'sawtooth',
      notes: [{ freq: 400, at: 0, dur: 0.38, glideTo: 1200 }],
    },
  };

  const CHIME_NAMES = Object.keys(CHIMES);

  function playChime(name, volume) {
    const recipe = CHIMES[name] || CHIMES.fanfare;
    const vol = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 0.2;
    if (vol <= 0) return;
    try {
      const Ctx = global.AudioContext || global.webkitAudioContext;
      const ac = new Ctx();
      for (const n of recipe.notes) {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = recipe.type;
        const t0 = ac.currentTime + n.at;
        osc.frequency.setValueAtTime(n.freq, t0);
        if (n.glideTo) osc.frequency.exponentialRampToValueAtTime(n.glideTo, t0 + n.dur);
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + n.dur);
        osc.connect(gain).connect(ac.destination);
        osc.start(t0);
        osc.stop(t0 + n.dur + 0.05);
      }
    } catch { /* audio unavailable — ignore */ }
  }

  global.AirplaneChimes = { CHIMES, CHIME_NAMES, playChime };
})(typeof window !== 'undefined' ? window : globalThis);
