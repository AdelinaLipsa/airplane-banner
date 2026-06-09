const flight = document.getElementById('flight');
const banner = document.getElementById('banner');
const aircraft = document.getElementById('aircraft');
const propeller = document.getElementById('propeller');

// Swappable "crafts" — the thing that tows the banner. Built-ins live as files
// next to this script. Each: src (relative file or data URL), box width + aspect
// ratio (so non-plane art isn't stretched), and whether to draw the spinning
// propeller and the themed hard shadow. A 'custom' craft (user's own image/GIF)
// arrives fully resolved in the flight payload. Animated GIFs just play — the
// renderer (Chromium) animates them for free.
const CRAFTS = {
  tarom:    { src: 'plane.png', width: 320, aspectRatio: '836 / 213', propeller: true, shadow: true },
  ufo:      { src: 'ufo.png', width: 240, aspectRatio: '960 / 359', propeller: false, shadow: true },
  rickroll: { src: 'rickroll.webp', width: 200, aspectRatio: '1 / 1', propeller: false, shadow: true },
  kittens:  { src: 'kittens.webp', width: 220, aspectRatio: '400 / 300', propeller: false, shadow: true },
};

function applyCraft(payload, popColor) {
  let c;
  if (payload.craft === 'custom' && payload.customCraft && payload.customCraft.src) {
    c = Object.assign({ width: 240, aspectRatio: '1 / 1', propeller: false, shadow: false }, payload.customCraft);
  } else {
    c = CRAFTS[payload.craft] || CRAFTS.tarom;
  }
  aircraft.style.backgroundImage = `url("${c.src}")`;
  aircraft.style.width = c.width + 'px';
  aircraft.style.aspectRatio = c.aspectRatio;
  aircraft.style.transform = c.flip ? 'scaleX(-1)' : '';
  aircraft.style.filter = c.shadow ? `drop-shadow(5px 5px 0 ${popColor})` : 'none';
  aircraft.style.borderRadius = c.radius ? c.radius + 'px' : '';
  if (propeller) propeller.style.display = c.propeller ? '' : 'none';
}

// Palettes selectable in Settings. `fabric`/`ink` color the canvas banner;
// `pop` is the hard drop-shadow behind the (natural-livery) plane sprite.
const THEMES = {
  retro:  { fabric: '#facc15', ink: '#1e1b4b', pop: '#f43f5e' },
  aurora: { fabric: '#0b1020', ink: '#5eead4', pop: '#a78bfa' },
  sunset: { fabric: '#fb7185', ink: '#ffffff', pop: '#f97316' },
  mono:   { fabric: '#0a0a0a', ink: '#fafafa', pop: '#9ca3af' },
};

function applyTheme(name) {
  const t = THEMES[name] || THEMES.retro;
  const root = document.documentElement.style;
  root.setProperty('--ink', t.ink);
  root.setProperty('--gold', t.fabric);
  root.setProperty('--pop', t.pop);
  // The TAROM livery shows in its real colors; only the hard shadow is themed.
  if (aircraft) aircraft.style.filter = `drop-shadow(5px 5px 0 ${t.pop})`;
  return t;
}

function formatText(minutes, title, showTitle = true) {
  if (!showTitle) {
    return minutes > 0 ? `NEXT MEETING IN ${minutes} MIN` : 'MEETING NOW';
  }
  const t = (title || 'Meeting').toUpperCase();
  return minutes > 0 ? `${minutes} MIN → ${t}` : `NOW → ${t}`;
}

// Render the banner text to a canvas, then slice it into vertical strips that
// each wave independently — the CodePen rippling-fabric technique.
// Retro Arcade: rippling fabric made of waving canvas slices.
function buildFabricBanner(text, theme) {
  banner.innerHTML = '';
  const pad = 36;
  const logicalH = 110;
  // Supersample the canvas to the display's pixel density so the text stays
  // crisp instead of upscaled/pixelated while it flies across a Retina screen.
  const dpr = Math.min(3, Math.max(1, Math.round(window.devicePixelRatio || 1)));
  const font = '800 44px ui-monospace, Menlo, "Courier New", monospace';
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = font;
  const logicalW = Math.ceil(ctx.measureText(text).width) + pad * 2;
  canvas.width = logicalW * dpr;
  canvas.height = logicalH * dpr;
  // Resizing the canvas resets the context — scale to DPR and reapply state so
  // we can keep drawing in logical pixels.
  ctx.scale(dpr, dpr);
  ctx.font = font;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = theme.fabric;
  ctx.fillRect(0, 0, logicalW, logicalH);
  ctx.fillStyle = theme.ink;
  ctx.fillText(text, pad, logicalH / 2 + 2);

  const url = canvas.toDataURL();
  const img = new Image();
  img.onload = () => {
    // Slices finer than the visible wave step make the rippling top/bottom edges
    // read as a smooth curve rather than a coarse, pixelated staircase. The
    // high-res canvas is mapped back to logical size via background-size.
    const segW = 10;
    const count = Math.ceil(logicalW / segW);
    const last = Math.max(1, count - 1);
    for (let i = 0; i < count; i++) {
      const seg = document.createElement('div');
      seg.className = 'segment';
      seg.style.width = segW + 'px';
      seg.style.height = logicalH + 'px';
      seg.style.backgroundImage = `url(${url})`;
      seg.style.backgroundSize = `${logicalW}px ${logicalH}px`;
      seg.style.backgroundPositionX = (-segW * i) + 'px';
      // Fabric realism: a towed banner is tied to the rope at its right edge
      // (highest i) and flaps free at the left. Flutter grows toward the free
      // end; the ripple originates at the tied edge and travels outward at a
      // constant wavelength (delay scaled by pixel position, not slice index).
      const free = 1 - i / last;            // 1 at the free (left) end → 0 at the rope
      seg.style.setProperty('--amp', (2.5 + free * 9).toFixed(1) + 'px');
      seg.style.animationDelay = (-(i * segW) * 0.0022).toFixed(3) + 's';
      seg.style.animationDuration = (1.7 + free * 0.6).toFixed(2) + 's';
      banner.appendChild(seg);
    }
  };
  img.src = url;
}

// Aurora Glass / Sunset Pop / Mono Minimal: a single styled DOM banner whose
// look (glass panel, gradient pill, minimal bar) comes from CSS per data-theme.
function buildFlatBanner(text) {
  banner.innerHTML = '';
  const el = document.createElement('div');
  el.className = 'flat-banner';
  el.textContent = text;
  banner.appendChild(el);
}

// Flight chime: synthesized via the shared AirplaneChimes module (loaded before
// this script). The chosen sound + volume come from Settings via the payload.
function playChime(name, volume) {
  if (window.AirplaneChimes) window.AirplaneChimes.playChime(name, volume);
}

// The Rick Roll craft plays the real clip (rickroll.mp3); every other craft
// uses a synthesized chime. If the clip can't play, the Rick Roll craft is
// simply silent (no synth stand-in).
let rickAudio = null;
function playSound(payload) {
  if (payload.craft === 'rickroll') {
    try {
      if (rickAudio) rickAudio.pause();
      rickAudio = new Audio('rickroll.mp3');
      rickAudio.volume = Math.min(1, Math.max(0, payload.soundVolume != null ? payload.soundVolume : 0.3));
      rickAudio.play().catch(() => {});
    } catch { /* clip unavailable — stay silent */ }
    return;
  }
  playChime(payload.soundName, payload.soundVolume);
}

// ── Opt-in click-to-join ────────────────────────────────────────────────────
// The window forwards mousemove while click-through; we flip it interactive only
// while the cursor is over the flying assembly, so clicks elsewhere pass through.
const assembly = document.getElementById('assembly');
let currentLink = null;
let clickable = false;
let interactive = false;

function setInteractive(on) {
  if (on === interactive) return;
  interactive = on;
  document.body.style.cursor = on ? 'pointer' : 'default';
  if (window.overlayApi) window.overlayApi.setInteractive(on);
}

document.addEventListener('mousemove', (e) => {
  if (!clickable || !currentLink) return;
  const r = assembly.getBoundingClientRect();
  const over = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  setInteractive(over);
});
document.addEventListener('click', () => {
  if (clickable && currentLink && interactive && window.overlayApi) {
    window.overlayApi.openLink(currentLink); // main opens the link and hides us
    clickable = false;
  }
});

function fly(payload) {
  const themeName = THEMES[payload.theme] ? payload.theme : 'retro';
  const theme = applyTheme(themeName);
  // Optional per-calendar accent overrides the theme's pop color (craft shadow
  // + retro banner edge) while leaving the rest of the theme intact.
  let popColor = theme.pop;
  if (typeof payload.accent === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(payload.accent)) {
    popColor = payload.accent;
    document.documentElement.style.setProperty('--pop', popColor);
  }
  document.body.dataset.theme = themeName;
  applyCraft(payload, popColor);
  const text = formatText(payload.minutes, payload.title, payload.showTitle !== false);
  if (themeName === 'retro') buildFabricBanner(text, theme);
  else buildFlatBanner(text);
  currentLink = payload.link || null;
  clickable = !!(payload.clickable && currentLink);
  setInteractive(false);
  // Flight duration (speed) is user-configurable; clamp to a sane range so the
  // banner is never gone-in-a-blink or stuck onscreen forever.
  const dur = Number(payload.durationSeconds);
  flight.style.setProperty('--dur', (Number.isFinite(dur) ? Math.min(60, Math.max(4, dur)) : 12) + 's');
  flight.classList.remove('flying');
  void flight.offsetWidth; // restart the CSS animation
  flight.classList.add('flying');
  if (payload.sound) playChimeOnEntry(payload);
}

// The chime should land as the plane appears, not while it's still off-screen
// to the left. The plane leads the assembly, so watch its on-screen position
// each frame and fire once it crosses the left edge into view.
let chimeRaf = 0;
function playChimeOnEntry(payload) {
  if (chimeRaf) cancelAnimationFrame(chimeRaf);
  const tick = () => {
    const r = aircraft.getBoundingClientRect();
    if (r.right > 0 && r.left < window.innerWidth) {
      playSound(payload);
      chimeRaf = 0;
      return;
    }
    chimeRaf = requestAnimationFrame(tick);
  };
  chimeRaf = requestAnimationFrame(tick);
}

flight.addEventListener('animationend', (e) => {
  if (e.animationName === 'flyAcross') {
    flight.classList.remove('flying');
    clickable = false;
    setInteractive(false);
    if (chimeRaf) { cancelAnimationFrame(chimeRaf); chimeRaf = 0; } // flight over; drop any unfired chime
    if (window.overlayApi) window.overlayApi.flightDone();
  }
});

if (window.overlayApi) window.overlayApi.onFly(fly);
window.__fly = fly; // manual dev trigger from devtools
