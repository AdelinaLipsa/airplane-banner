const flight = document.getElementById('flight');
const banner = document.getElementById('banner');
const aircraft = document.getElementById('aircraft');

// Palettes selectable in Settings. `fabric`/`ink` color the canvas banner;
// `pop` is the hard shadow; `planeFilter` hue-shifts the raster plane sprite.
const THEMES = {
  retro:  { fabric: '#facc15', ink: '#1e1b4b', pop: '#f43f5e',
            planeFilter: 'grayscale(1) sepia(1) hue-rotate(196deg) saturate(5) brightness(0.82) contrast(1.05)' },
  aurora: { fabric: '#0b1020', ink: '#5eead4', pop: '#a78bfa',
            planeFilter: 'grayscale(1) sepia(1) hue-rotate(120deg) saturate(4) brightness(0.95)' },
  sunset: { fabric: '#fb7185', ink: '#ffffff', pop: '#f97316',
            planeFilter: 'grayscale(1) sepia(1) saturate(6) hue-rotate(-25deg) brightness(1.0)' },
  mono:   { fabric: '#0a0a0a', ink: '#fafafa', pop: '#9ca3af',
            planeFilter: 'grayscale(1) contrast(1.2) brightness(0.6)' },
};

function applyTheme(name) {
  const t = THEMES[name] || THEMES.retro;
  const root = document.documentElement.style;
  root.setProperty('--ink', t.ink);
  root.setProperty('--gold', t.fabric);
  root.setProperty('--pop', t.pop);
  if (aircraft) aircraft.style.filter = `${t.planeFilter} drop-shadow(5px 5px 0 ${t.pop})`;
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
function buildBanner(text, theme) {
  banner.innerHTML = '';
  const pad = 36;
  const font = '800 44px ui-monospace, Menlo, "Courier New", monospace';
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = font;
  const textW = Math.ceil(ctx.measureText(text).width);
  canvas.width = textW + pad * 2;
  canvas.height = 110;
  // Resizing the canvas resets the context state — reapply font/baseline.
  ctx.font = font;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = theme.fabric;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = theme.ink;
  ctx.fillText(text, pad, canvas.height / 2 + 2);

  const url = canvas.toDataURL();
  const img = new Image();
  img.onload = () => {
    const segW = 20;
    const count = Math.ceil(canvas.width / segW);
    for (let i = 0; i < count; i++) {
      const seg = document.createElement('div');
      seg.className = 'segment';
      seg.style.height = canvas.height + 'px';
      seg.style.animationDelay = (i * 0.05) + 's';
      seg.style.backgroundImage = `url(${url})`;
      seg.style.backgroundPositionX = (-segW * i) + 'px';
      banner.appendChild(seg);
    }
  };
  img.src = url;
}

// A short two-note "fanfare" via Web Audio — no asset needed.
function playChime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ac = new Ctx();
    const notes = [660, 880];
    notes.forEach((freq, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const t0 = ac.currentTime + i * 0.14;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.2, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25);
      osc.connect(gain).connect(ac.destination);
      osc.start(t0);
      osc.stop(t0 + 0.3);
    });
  } catch { /* audio unavailable — ignore */ }
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
  const theme = applyTheme(payload.theme);
  buildBanner(formatText(payload.minutes, payload.title, payload.showTitle !== false), theme);
  if (payload.sound) playChime();
  currentLink = payload.link || null;
  clickable = !!(payload.clickable && currentLink);
  setInteractive(false);
  flight.classList.remove('flying');
  void flight.offsetWidth; // restart the CSS animation
  flight.classList.add('flying');
}

flight.addEventListener('animationend', (e) => {
  if (e.animationName === 'flyAcross') {
    flight.classList.remove('flying');
    clickable = false;
    setInteractive(false);
    if (window.overlayApi) window.overlayApi.flightDone();
  }
});

if (window.overlayApi) window.overlayApi.onFly(fly);
window.__fly = fly; // manual dev trigger from devtools
