const flight = document.getElementById('flight');
const banner = document.getElementById('banner');

function formatText(minutes, title, showTitle = true) {
  if (!showTitle) {
    return minutes > 0 ? `NEXT MEETING IN ${minutes} MIN` : 'MEETING NOW';
  }
  const t = (title || 'Meeting').toUpperCase();
  return minutes > 0 ? `${minutes} MIN → ${t}` : `NOW → ${t}`;
}

// Render the banner text to a canvas, then slice it into vertical strips that
// each wave independently — the CodePen rippling-fabric technique, recolored
// to the Retro Arcade palette (yellow fabric, indigo text).
function buildBanner(text) {
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
  ctx.fillStyle = '#facc15';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#1e1b4b';
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

function fly(payload) {
  buildBanner(formatText(payload.minutes, payload.title, payload.showTitle !== false));
  flight.classList.remove('flying');
  void flight.offsetWidth; // restart the CSS animation
  flight.classList.add('flying');
}

flight.addEventListener('animationend', (e) => {
  if (e.animationName === 'flyAcross') {
    flight.classList.remove('flying');
    if (window.overlayApi) window.overlayApi.flightDone();
  }
});

if (window.overlayApi) window.overlayApi.onFly(fly);
window.__fly = fly; // manual dev trigger from devtools
