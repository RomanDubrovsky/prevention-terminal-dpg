(function () {
  var ZOOM_SELECTORS = '.screen-viewport .screen-shot';

  function resolveSrc(img) {
    var raw = img.currentSrc || img.getAttribute('src') || '';
    try {
      return new URL(raw, window.location.href).href;
    } catch (e) {
      return raw;
    }
  }

  function ensureDialog() {
    var existing = document.getElementById('screen-lightbox');
    if (existing) return existing;

    var dialog = document.createElement('dialog');
    dialog.id = 'screen-lightbox';
    dialog.className = 'screen-lightbox';
    dialog.setAttribute('aria-labelledby', 'screen-lightbox-caption');
    dialog.innerHTML =
      '<form method="dialog" class="screen-lightbox__close-bar">' +
      '<button type="submit" class="screen-lightbox__close" aria-label="Close full screen view">Close</button>' +
      '</form>' +
      '<figure class="screen-lightbox__figure">' +
      '<img class="screen-lightbox__img" alt="" decoding="async">' +
      '<figcaption id="screen-lightbox-caption" class="screen-lightbox__caption"></figcaption>' +
      '</figure>';

    dialog.addEventListener('click', function (event) {
      if (event.target === dialog) dialog.close();
    });

    dialog.addEventListener('close', function () {
      var img = dialog.querySelector('.screen-lightbox__img');
      if (img) {
        img.removeAttribute('src');
        img.alt = '';
      }
      var cap = dialog.querySelector('.screen-lightbox__caption');
      if (cap) cap.textContent = '';
    });

    document.body.appendChild(dialog);
    return dialog;
  }

  function openZoom(img) {
    var dialog = ensureDialog();
    var full = dialog.querySelector('.screen-lightbox__img');
    var caption = dialog.querySelector('.screen-lightbox__caption');
    if (!full) return;

    var alt = img.getAttribute('alt') || 'Screenshot';
    full.src = resolveSrc(img);
    full.alt = alt;
    if (caption) caption.textContent = alt;

    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    }
  }

  function attachZoomButton(img) {
    var host = img.closest('.screen-viewport');
    if (!host || host.querySelector('.screen-zoom-btn')) return;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'screen-zoom-btn';
    btn.setAttribute('aria-label', 'View screenshot full screen');
    btn.textContent = 'Full screen';

    btn.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      openZoom(img);
    });

    host.appendChild(btn);
  }

  function init() {
    ensureDialog();
    document.querySelectorAll(ZOOM_SELECTORS).forEach(attachZoomButton);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
