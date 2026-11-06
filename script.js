// Punto de entrada para mejoras progresivas sobre la página.
// El contenido es visible y funcional aunque este archivo no se cargue.
(function () {
  'use strict';

  document.body.classList.add('is-loaded');

  /* ---------- Notificación: violencia sexual ---------- */
  var tab = document.getElementById('sexAlertTab');
  var panel = document.getElementById('sexAlertPanel');
  var overlay = document.getElementById('sexAlertOverlay');
  var closeBtn = document.getElementById('sexAlertClose');
  if (!tab || !panel || !overlay || !closeBtn) return;

  var isOpen = false;

  function openPanel() {
    if (isOpen) return;
    isOpen = true;
    overlay.hidden = false;
    // fuerza reflow para que la transición de opacidad se reproduzca
    void overlay.offsetWidth;
    overlay.classList.add('is-open');
    panel.classList.add('is-open');
    panel.setAttribute('aria-hidden', 'false');
    tab.setAttribute('aria-expanded', 'true');
    document.body.classList.add('sex-alert-open');
    closeBtn.focus();
  }

  function closePanel() {
    if (!isOpen) return;
    isOpen = false;
    overlay.classList.remove('is-open');
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    tab.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('sex-alert-open');
    tab.focus();
    window.setTimeout(function () {
      if (!isOpen) overlay.hidden = true;
    }, 400);
  }

  tab.addEventListener('click', function () {
    isOpen ? closePanel() : openPanel();
  });
  closeBtn.addEventListener('click', closePanel);
  overlay.addEventListener('click', closePanel);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen) closePanel();
  });

  // Mantiene el foco dentro del panel mientras está abierto.
  panel.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab' || !isOpen) return;
    var focusables = panel.querySelectorAll('a[href], button:not([disabled])');
    if (!focusables.length) return;
    var first = focusables[0];
    var last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
})();
