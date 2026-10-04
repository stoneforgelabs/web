/* Mobilní menu (< 900 px). Bez JS je navigace prostě rozbalená a tlačítko
 * Menu zůstane schované (atribut hidden), takže web funguje i bez skriptu. */
(function () {
  var toggle = document.querySelector('.rail__toggle');
  var nav = document.getElementById('site-nav');
  if (!toggle || !nav || !window.matchMedia) return;

  var mobile = window.matchMedia('(max-width: 899.98px)');

  function isOpen() {
    return toggle.getAttribute('aria-expanded') === 'true';
  }

  function setOpen(open) {
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    nav.classList.toggle('is-collapsed', mobile.matches && !open);
  }

  toggle.hidden = false;
  setOpen(false);

  toggle.addEventListener('click', function () {
    setOpen(!isOpen());
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && mobile.matches && isOpen()) {
      setOpen(false);
      toggle.focus();
    }
  });

  // Klik na odkaz v menu (kotva na téže stránce) menu zavře.
  nav.addEventListener('click', function (event) {
    if (mobile.matches && event.target.closest('a')) setOpen(false);
  });

  var onChange = function () { setOpen(false); };
  if (mobile.addEventListener) mobile.addEventListener('change', onChange);
  else if (mobile.addListener) mobile.addListener(onChange);
})();
