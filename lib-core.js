/* Shared helpers, theme, tabs, storage */
window.QRS = window.QRS || {};
(function () {
  'use strict';
  var QRS = window.QRS;

  QRS.$ = function (id) { return document.getElementById(id); };
  QRS.enc = new TextEncoder();
  QRS.bytes = function (s) { return QRS.enc.encode(s).length; };

  var toastTimer = null;
  QRS.toast = function (msg, opts) {
    var el = QRS.$('toast');
    if (!el) return;
    var undoHtml = '';
    if (opts && opts.undo) {
      undoHtml = ' <button class="small" id="toast-undo">' + (opts.undoLabel || 'Undo') + '</button>';
    }
    el.innerHTML = msg + undoHtml;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2200);
    var undoBtn = el.querySelector('#toast-undo');
    if (undoBtn) {
      undoBtn.addEventListener('click', function () {
        el.classList.remove('show');
        clearTimeout(toastTimer);
        opts.undo();
      }, { once: true });
    }
  };

  QRS.store = {
    get: function (key, fallback) {
      try {
        var raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (e) { return fallback; }
    },
    set: function (key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
    },
    del: function (key) { try { localStorage.removeItem(key); } catch (e) {} }
  };

  QRS.HISTORY_MAX = 40;
  QRS.GEN_HISTORY_KEY = 'qrsite-gen-history';
  QRS.SCAN_HISTORY_KEY = 'qrsite-scan-history';

  var themeBtn = QRS.$('btn-theme');
  function isLight() { return document.documentElement.dataset.theme === 'light'; }
  function syncThemeBtn() {
    if (!themeBtn) return;
    themeBtn.textContent = isLight() ? '\u263E' : '\u2600';
    themeBtn.setAttribute('aria-pressed', isLight() ? 'true' : 'false');
  }
  function applyTheme(theme) {
    if (theme === 'light') document.documentElement.dataset.theme = 'light';
    else delete document.documentElement.dataset.theme;
    QRS.store.set('qrsite-theme', theme);
    syncThemeBtn();
  }

  /* Theme is stored as JSON ('"light"'), but older builds stored it raw.
   * Accept both shapes so light mode survives a reload. */
  QRS.readTheme = function () {
    var raw = null;
    try { raw = localStorage.getItem('qrsite-theme'); } catch (e) { return null; }
    if (!raw) return null;
    try {
      var parsed = JSON.parse(raw);
      return typeof parsed === 'string' ? parsed : null;
    } catch (e) { return raw; }
  };

  (function initTheme() {
    var stored = QRS.readTheme();
    if (stored === 'light') {
      document.documentElement.dataset.theme = 'light';
    } else if (stored === null && window.matchMedia('(prefers-color-scheme: light)').matches) {
      document.documentElement.dataset.theme = 'light';
    }
    syncThemeBtn();
  })();

  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      applyTheme(isLight() ? 'dark' : 'light');
    });
  }

  var stopCameraHook = function () {};
  QRS.onTabLeaveScan = function (fn) { stopCameraHook = fn; };

  QRS.switchTab = function (name) {
    document.querySelectorAll('.tab').forEach(function (b) {
      var on = b.dataset.tab === name;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.querySelectorAll('.panel').forEach(function (p) {
      p.classList.toggle('active', p.id === 'panel-' + name);
    });
    if (name !== 'scan') stopCameraHook();
    if (name === 'scan' && typeof QRS.consumePendingShare === 'function') QRS.consumePendingShare();
  };

  document.querySelectorAll('.tab').forEach(function (b) {
    b.addEventListener('click', function () { QRS.switchTab(b.dataset.tab); });
  });
})();
