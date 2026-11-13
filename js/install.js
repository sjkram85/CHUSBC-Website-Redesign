/* CHUSBC PWA — install prompt, iOS Add-to-Home-Screen banner, and SW registration.
 *
 * Android / Chrome: listen for beforeinstallprompt and show an "Install app" banner.
 * iOS Safari: Apple does not allow a programmatic install, so show a short,
 * dismissible banner explaining Share → Add to Home Screen.
 * Both banners are hidden in standalone (already-installed) mode.
 * Dismissals are remembered in localStorage.
 *
 * Uses the site's Tailwind utility classes (navy / gold / rounded-xl).
 */
(function () {
  'use strict';

  var STORAGE_IOS = 'chusbc-pwa-ios-banner-dismissed';
  var STORAGE_ANDROID = 'chusbc-pwa-install-banner-dismissed';
  var deferredPrompt = null;

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
  }

  function isIos() {
    var ua = window.navigator.userAgent || '';
    var iDevice = /iphone|ipad|ipod/i.test(ua);
    var iPadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    return iDevice || iPadOs;
  }

  function isIosSafari() {
    if (!isIos()) return false;
    var ua = window.navigator.userAgent || '';
    // Chrome, Firefox, Edge, and Opera on iOS all include "Safari" in the UA.
    if (/CriOS|FxiOS|EdgiOS|OPiOS|OPT\//i.test(ua)) return false;
    return /Safari/i.test(ua);
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    var swUrl = new URL('sw.js', document.baseURI || window.location.href);
    navigator.serviceWorker.register(swUrl.href, { scope: './' }).catch(function (err) {
      console.warn('[chusbc-pwa] service worker registration failed', err);
    });
  }

  function insertBanner(el) {
    var header = document.querySelector('header');
    if (header && header.parentNode) {
      header.parentNode.insertBefore(el, header.nextSibling);
    } else {
      document.body.insertBefore(el, document.body.firstChild);
    }
  }

  function closeBanner(el, storageKey) {
    el.remove();
    try { localStorage.setItem(storageKey, '1'); } catch (err) { /* private mode */ }
  }

  function wasDismissed(key) {
    try { return localStorage.getItem(key) === '1'; } catch (err) { return false; }
  }

  function showIosBanner() {
    if (wasDismissed(STORAGE_IOS)) return;

    var bar = document.createElement('div');
    bar.id = 'chusbc-ios-install-banner';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Add CHUSBC to your Home Screen');
    bar.className = 'bg-navy text-white border-b-4 border-gold';
    bar.innerHTML =
      '<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-start sm:items-center gap-3">' +
        '<span class="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 overflow-hidden" aria-hidden="true">' +
          '<img src="assets/icons/apple-touch-icon.png" alt="" width="32" height="32" class="w-8 h-8">' +
        '</span>' +
        '<p class="text-sm leading-snug flex-1 m-0">' +
          '<strong class="font-display font-bold uppercase tracking-wide">Add CHUSBC to your Home Screen.</strong> ' +
          'Tap the <strong>Share</strong> button ' +
          '<i class="fa-solid fa-arrow-up-from-square text-gold" aria-hidden="true"></i> ' +
          'then <strong>Add to Home Screen</strong>. You’ll get a full-screen app icon.' +
        '</p>' +
        '<button type="button" id="chusbc-ios-install-dismiss" class="shrink-0 w-9 h-9 rounded-lg hover:bg-white/10 text-white" aria-label="Dismiss">' +
          '<i class="fa-solid fa-xmark" aria-hidden="true"></i>' +
        '</button>' +
      '</div>';
    insertBanner(bar);
    bar.querySelector('#chusbc-ios-install-dismiss').addEventListener('click', function () {
      closeBanner(bar, STORAGE_IOS);
    });
  }

  function showAndroidBanner() {
    if (wasDismissed(STORAGE_ANDROID)) return;
    if (document.getElementById('chusbc-android-install-banner')) return;

    var bar = document.createElement('div');
    bar.id = 'chusbc-android-install-banner';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Install the CHUSBC app');
    bar.className = 'bg-navy text-white border-b-4 border-gold';
    bar.innerHTML =
      '<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-3 flex-wrap sm:flex-nowrap">' +
        '<span class="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 overflow-hidden" aria-hidden="true">' +
          '<img src="assets/icons/icon-192.png" alt="" width="32" height="32" class="w-8 h-8">' +
        '</span>' +
        '<p class="text-sm leading-snug flex-1 m-0">' +
          '<strong class="font-display font-bold uppercase tracking-wide">Install the CHUSBC app.</strong> ' +
          'Add it to your home screen for faster access and a full-screen experience.' +
        '</p>' +
        '<button type="button" id="chusbc-android-install-btn" class="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gold hover:bg-gold-hover text-navy font-bold text-sm">' +
          '<i class="fa-solid fa-download" aria-hidden="true"></i> Install app' +
        '</button>' +
        '<button type="button" id="chusbc-android-install-dismiss" class="shrink-0 w-9 h-9 rounded-lg hover:bg-white/10 text-white" aria-label="Dismiss">' +
          '<i class="fa-solid fa-xmark" aria-hidden="true"></i>' +
        '</button>' +
      '</div>';
    insertBanner(bar);

    bar.querySelector('#chusbc-android-install-btn').addEventListener('click', function () {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.finally(function () {
        deferredPrompt = null;
        bar.remove();
      });
    });
    bar.querySelector('#chusbc-android-install-dismiss').addEventListener('click', function () {
      closeBanner(bar, STORAGE_ANDROID);
    });
  }

  function init() {
    registerServiceWorker();
    if (isStandalone()) return;

    if (isIosSafari()) {
      showIosBanner();
      return;
    }

    window.addEventListener('beforeinstallprompt', function (event) {
      event.preventDefault();
      deferredPrompt = event;
      showAndroidBanner();
    });

    window.addEventListener('appinstalled', function () {
      deferredPrompt = null;
      var bar = document.getElementById('chusbc-android-install-banner');
      if (bar) bar.remove();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
