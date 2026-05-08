/* share_copy.js
  Copies a thread link to the clipboard when a "Share" action is clicked.
  The button shows the share icon and "Share" by default; clicking only copies.
*/
(function () {
  'use strict';

  function resolveThreadHref(btn) {
    if (!btn) return window.location.href;
    // Prefer explicit data attr if provided
    var dataHref = btn.getAttribute('data-thread-href') || btn.dataset.threadHref;
    if (dataHref) return new URL(dataHref, window.location.href).href;
    var dataId = btn.getAttribute('data-thread-id') || btn.dataset.threadId;
    if (dataId) return new URL('./threadview.html?thread=' + encodeURIComponent(dataId), window.location.href).href;
    var container = btn.closest('.post') || btn.closest('.thread') || btn.closest('.post-card') || btn.closest('.thread-card') || btn.closest('.tv-post-actions') || btn.closest('.post-actions') || document;
    var link = container.querySelector('a[href*="threadview.html"], a.stretched-link, a[href*="/threadview"], a[href*="thread="]');
    if (link && link.getAttribute('href')) {
      return new URL(link.getAttribute('href'), window.location.href).href;
    }
    return window.location.href;
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try {
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (ok) resolve();
        else reject(new Error('execCommand failed'));
      } catch (err) {
        document.body.removeChild(ta);
        reject(err);
      }
    });
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('a.post-action, .post-action, a.share-thread-btn, .share-thread-btn, button.share-thread-btn, button[aria-label="Share"]');
    if (!btn) return;
    var isShare = btn.getAttribute('aria-label') === 'Share' || btn.querySelector('i[class*="bi-share"]') || /\bShare\b/.test(btn.textContent) || btn.getAttribute('data-thread-href') || btn.dataset.threadId;
    if (!isShare) return;
    e.preventDefault();
    var href = resolveThreadHref(btn);
    copyText(href).then(function () {
      // brief, non-intrusive feedback via title attribute; do not change visible label
      var prevTitle = btn.getAttribute('title');
      btn.setAttribute('title', 'Shared!');
      setTimeout(function () {
        if (prevTitle !== null) btn.setAttribute('title', prevTitle);
        else btn.removeAttribute('title');
      }, 1200);
    }).catch(function () {
      var prevTitle = btn.getAttribute('title');
      btn.setAttribute('title', 'Share failed');
      setTimeout(function () {
        if (prevTitle !== null) btn.setAttribute('title', prevTitle);
        else btn.removeAttribute('title');
      }, 1500);
    });
  });
})();
