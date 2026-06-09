const txt = document.getElementById('txt');

if (window.noteApi) {
  window.noteApi.onText((t) => { txt.textContent = t; });
  // Mirror the flying banner: body = fabric, text = ink, plane shadow = pop.
  window.noteApi.onTheme((p) => {
    const root = document.documentElement.style;
    root.setProperty('--pill-bg', p.fabric);
    root.setProperty('--pill-fg', p.ink);
    root.setProperty('--pill-pop', p.pop);
  });
}
// Whole pill is clickable → main joins the meeting or pops the tray menu.
document.body.addEventListener('click', () => {
  if (window.noteApi) window.noteApi.click();
});
