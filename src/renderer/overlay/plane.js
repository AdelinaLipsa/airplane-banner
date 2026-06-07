const flight = document.getElementById('flight');
const banner = document.getElementById('banner');

function formatText(minutes, title, showTitle = true) {
  if (!showTitle) {
    return minutes > 0 ? `NEXT MEETING IN ${minutes} MIN` : 'MEETING NOW';
  }
  const t = (title || 'Meeting').toUpperCase();
  return minutes > 0 ? `${minutes} MIN → ${t}` : `NOW → ${t}`;
}

function setBanner(text) {
  banner.innerHTML = '';
  [...text].forEach((c, i) => {
    const s = document.createElement('span');
    s.className = 'ch';
    s.textContent = c === ' ' ? ' ' : c;
    s.style.animationDelay = (i * 0.05) + 's';
    banner.appendChild(s);
  });
}

function fly(payload) {
  setBanner(formatText(payload.minutes, payload.title, payload.showTitle !== false));
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
