const txt = document.getElementById('txt');

if (window.noteApi) {
  window.noteApi.onText((t) => { txt.textContent = t; });
}
// Whole pill is clickable → main joins the meeting or pops the tray menu.
document.body.addEventListener('click', () => {
  if (window.noteApi) window.noteApi.click();
});
