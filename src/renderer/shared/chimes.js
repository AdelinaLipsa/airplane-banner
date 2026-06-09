'use strict';
// Synthesized flight chimes via Web Audio — no audio assets needed. Shared by
// the overlay (plays on flight) and Settings (preview button). Each chime is a
// small recipe of notes; `playChime(name, volume)` renders it through a tiny
// engine with per-note timbre (waveform + harmonics), ADSR-ish envelopes, an
// optional noise source (for whooshes), and a synthetic reverb tail. Exposes
// CHIME_NAMES so the Settings dropdown stays in sync with what's available.
(function (global) {
  // Note frequencies (Hz) for readable recipes.
  const C5 = 523.25, E5 = 659.25, G5 = 783.99, A5 = 880.0;
  const C6 = 1046.5, E6 = 1318.5;

  // A warm bell/mallet timbre: fundamental plus a couple of quieter overtones.
  const BELL = [{ ratio: 1, gain: 1 }, { ratio: 2, gain: 0.4 }, { ratio: 3, gain: 0.15 }];
  const PLUCK = [{ ratio: 1, gain: 1 }, { ratio: 2, gain: 0.25 }];

  // Each recipe: { label, reverb?, notes: [...] }. A note is tonal by default:
  //   { freq, at, dur, type?, glideTo?, attack?, release?, gain?, harmonics? }
  // or a noise burst when `noise: true` (freq/glideTo drive a swept bandpass).
  const CHIMES = {
    fanfare: {
      label: 'Fanfare (two notes)', reverb: 0.2,
      notes: [
        { freq: E5, at: 0, dur: 0.3, type: 'triangle', harmonics: PLUCK },
        { freq: A5, at: 0.14, dur: 0.5, type: 'triangle', harmonics: PLUCK, release: 0.5 },
      ],
    },
    rickroll: {
      // "Never gonna give you up / never gonna let you down" — a synthesized
      // chiptune hook (we can't bundle the actual recording). Auto-plays with
      // the Rick Roll craft; also selectable on its own.
      label: 'Rick Roll 🎵', reverb: 0.16,
      // Actual chorus melody in A major (looked up, not guessed):
      // "Never gonna give you up" = A B D B F# F# E
      // "Never gonna let you down" = A B D B E E D C# B
      notes: [
        { freq: 440.00, at: 0.00, dur: 0.14, type: 'square' }, // A   Ne-
        { freq: 493.88, at: 0.15, dur: 0.14, type: 'square' }, // B   ver
        { freq: 587.33, at: 0.30, dur: 0.16, type: 'square' }, // D   gon-
        { freq: 493.88, at: 0.47, dur: 0.16, type: 'square' }, // B   na
        { freq: 739.99, at: 0.64, dur: 0.22, type: 'square' }, // F#  give
        { freq: 739.99, at: 0.88, dur: 0.22, type: 'square' }, // F#  you
        { freq: 659.25, at: 1.12, dur: 0.40, type: 'square', release: 0.35 }, // E up
        { freq: 440.00, at: 1.62, dur: 0.14, type: 'square' }, // A   Ne-
        { freq: 493.88, at: 1.77, dur: 0.14, type: 'square' }, // B   ver
        { freq: 587.33, at: 1.92, dur: 0.16, type: 'square' }, // D   gon-
        { freq: 493.88, at: 2.09, dur: 0.16, type: 'square' }, // B   na
        { freq: 659.25, at: 2.26, dur: 0.22, type: 'square' }, // E   let
        { freq: 659.25, at: 2.50, dur: 0.22, type: 'square' }, // E   you
        { freq: 587.33, at: 2.74, dur: 0.16, type: 'square' }, // D   down
        { freq: 554.37, at: 2.92, dur: 0.16, type: 'square' }, // C#
        { freq: 493.88, at: 3.10, dur: 0.44, type: 'square', release: 0.4 }, // B
      ],
    },
    airport: {
      label: 'Airport chime (bong)', reverb: 0.45, reverbDur: 2.2,
      notes: [
        { freq: G5, at: 0, dur: 0.7, type: 'sine', harmonics: BELL, release: 0.9 },
        { freq: C5, at: 0.42, dur: 1.1, type: 'sine', harmonics: BELL, release: 1.4 },
      ],
    },
    hawaii: {
      label: 'Hawaii (tropical)', reverb: 0.3, reverbDur: 1.6,
      // Major-pentatonic uke roll: warm, plucky, ascending then a top accent.
      notes: [
        { freq: C5, at: 0.0, dur: 0.34, type: 'triangle', harmonics: PLUCK },
        { freq: E5, at: 0.11, dur: 0.34, type: 'triangle', harmonics: PLUCK },
        { freq: G5, at: 0.22, dur: 0.34, type: 'triangle', harmonics: PLUCK },
        { freq: A5, at: 0.33, dur: 0.4, type: 'triangle', harmonics: PLUCK },
        { freq: C6, at: 0.46, dur: 0.7, type: 'triangle', harmonics: PLUCK, release: 0.7 },
      ],
    },
    marimba: {
      label: 'Marimba (soft mallets)', reverb: 0.22,
      notes: [
        { freq: C5, at: 0.0, dur: 0.26, type: 'sine', harmonics: BELL, release: 0.3 },
        { freq: E5, at: 0.1, dur: 0.26, type: 'sine', harmonics: BELL, release: 0.3 },
        { freq: G5, at: 0.2, dur: 0.45, type: 'sine', harmonics: BELL, release: 0.5 },
      ],
    },
    jet: {
      label: 'Jet flyby (whoosh)', reverb: 0.25,
      notes: [
        { noise: true, freq: 220, glideTo: 1800, at: 0, dur: 0.5, q: 1.1, attack: 0.12, release: 0.25 },
        { noise: true, freq: 1600, glideTo: 300, at: 0.34, dur: 0.5, q: 1.0, attack: 0.05, release: 0.3 },
      ],
    },
    ding: {
      label: 'Ding (single bell)', reverb: 0.35, reverbDur: 1.8,
      notes: [{ freq: A5, at: 0, dur: 0.6, type: 'sine', harmonics: BELL, release: 0.9 }],
    },
    chord: {
      label: 'Chord (major)', reverb: 0.3,
      notes: [
        { freq: C5, at: 0, dur: 0.7, type: 'sine', harmonics: PLUCK, release: 0.6 },
        { freq: E5, at: 0, dur: 0.7, type: 'sine', harmonics: PLUCK, release: 0.6 },
        { freq: G5, at: 0, dur: 0.7, type: 'sine', harmonics: PLUCK, release: 0.6 },
      ],
    },
    arcade: {
      label: 'Arcade (retro)', reverb: 0.08,
      notes: [
        { freq: A5, at: 0, dur: 0.1, type: 'square' },
        { freq: E6, at: 0.09, dur: 0.16, type: 'square' },
      ],
    },
    swoop: {
      label: 'Swoop (rising)', reverb: 0.18,
      notes: [{ freq: 400, glideTo: 1200, at: 0, dur: 0.4, type: 'sawtooth', release: 0.25 }],
    },
  };

  const CHIME_NAMES = Object.keys(CHIMES);

  // A decaying-noise impulse response gives a cheap, pleasant reverb tail.
  function makeImpulse(ac, duration, decay) {
    const len = Math.max(1, Math.floor(ac.sampleRate * duration));
    const buf = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  // Pluck/bell envelope: fast attack to peak, then exponential decay to silence
  // over dur + release. Suits every chime here (bells, mallets, plucks, sweeps).
  function shapeEnvelope(param, t0, dur, n) {
    const attack = n.attack != null ? n.attack : 0.008;
    const release = n.release != null ? n.release : 0.3;
    param.setValueAtTime(0.0001, t0);
    param.exponentialRampToValueAtTime(1, t0 + attack);
    param.exponentialRampToValueAtTime(0.0001, t0 + dur + release);
  }

  function playNoiseNote(ac, n, t0, dur, route) {
    const len = Math.max(1, Math.floor(ac.sampleRate * dur));
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = buf;
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = n.q || 1.2;
    bp.frequency.setValueAtTime(n.freq, t0);
    if (n.glideTo) bp.frequency.exponentialRampToValueAtTime(n.glideTo, t0 + dur);
    const env = ac.createGain();
    shapeEnvelope(env.gain, t0, dur, n);
    src.connect(bp).connect(env);
    route(env);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  function playToneNote(ac, n, t0, dur, route) {
    const layers = n.harmonics && n.harmonics.length ? n.harmonics : [{ ratio: 1, gain: 1 }];
    const env = ac.createGain();
    shapeEnvelope(env.gain, t0, dur, n);
    route(env);
    for (const h of layers) {
      const osc = ac.createOscillator();
      osc.type = h.type || n.type || 'sine';
      const ratio = h.ratio || 1;
      osc.frequency.setValueAtTime(n.freq * ratio, t0);
      if (n.glideTo) osc.frequency.exponentialRampToValueAtTime(n.glideTo * ratio, t0 + dur);
      const g = ac.createGain();
      g.gain.value = (h.gain != null ? h.gain : 1) * (n.gain != null ? n.gain : 1);
      osc.connect(g).connect(env);
      osc.start(t0);
      osc.stop(t0 + dur + (n.release != null ? n.release : 0.3) + 0.05);
    }
  }

  function playChime(name, volume) {
    const recipe = CHIMES[name] || CHIMES.fanfare;
    const vol = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 0.2;
    if (vol <= 0) return;
    try {
      const Ctx = global.AudioContext || global.webkitAudioContext;
      const ac = new Ctx();
      const master = ac.createGain();
      master.gain.value = vol;
      master.connect(ac.destination);

      // Optional reverb send for a tail that suits a banner sailing past.
      const wetAmt = recipe.reverb != null ? recipe.reverb : 0.18;
      let reverb = null;
      if (wetAmt > 0) {
        reverb = ac.createConvolver();
        reverb.buffer = makeImpulse(ac, recipe.reverbDur || 1.4, recipe.reverbDecay || 3);
        const wet = ac.createGain();
        wet.gain.value = wetAmt;
        reverb.connect(wet).connect(master);
      }
      const route = (node) => { node.connect(master); if (reverb) node.connect(reverb); };

      for (const n of recipe.notes) {
        const t0 = ac.currentTime + (n.at || 0);
        const dur = n.dur || 0.3;
        if (n.noise) playNoiseNote(ac, n, t0, dur, route);
        else playToneNote(ac, n, t0, dur, route);
      }

      // Free the context once the longest note plus its tail has finished.
      const tail = recipe.notes.reduce(
        (m, n) => Math.max(m, (n.at || 0) + (n.dur || 0.3) + (n.release != null ? n.release : 0.3)), 0);
      const total = tail + (wetAmt > 0 ? (recipe.reverbDur || 1.4) : 0) + 0.3;
      setTimeout(() => { try { ac.close(); } catch { /* already closed */ } }, total * 1000);
    } catch { /* audio unavailable — ignore */ }
  }

  global.AirplaneChimes = { CHIMES, CHIME_NAMES, playChime };
})(typeof window !== 'undefined' ? window : globalThis);
