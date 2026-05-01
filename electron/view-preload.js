/**
 * Duvo Dual — Panel View Preload Script
 * Copyright © 2026 MavTiN. All rights reserved.
 * https://github.com/mavtin/Duvo-Dual
 *
 * Runs in the same JS world as the page (contextIsolation: false).
 * Loaded BEFORE any page script — patches here take effect before
 * YouTube / Twitch / other streaming sites initialise.
 */

'use strict';
const { ipcRenderer } = require('electron');

// ── Bridge for IPC ───────────────────────────────────────────────
window.duvoInternal = {
  sendFullscreen: function(state) { ipcRenderer.send('duvo-fullscreen-event', state); }
};

// ── YouTube / Streaming ad remover ───────────────────────────────
// Intercepts InnerTube API responses and strips ad data before
// YouTube's JavaScript processes them.
(function patchAds() {
  var YT_APIS = [
    'youtubei/v1/player',
    'youtubei/v1/next',
    'youtubei/v1/browse'
  ];

  function stripAds(data) {
    if (!data || typeof data !== 'object') return;
    // Remove top-level ad fields
    delete data.adPlacements;
    delete data.playerAds;
    delete data.adSlots;
    delete data.adBreakHeartbeatParams;
    // Recursively strip from known array fields
    var arrays = ['contents', 'items', 'continuationItems', 'tabs', 'alerts'];
    for (var i = 0; i < arrays.length; i++) {
      var key = arrays[i];
      if (Array.isArray(data[key])) {
        data[key] = data[key].filter(function(item) {
          return !(
            item.adSlotRenderer ||
            item.promotedSparklesWebRenderer ||
            item.promotedVideoRenderer ||
            item.searchPyvRenderer ||
            item.displayAd
          );
        });
        data[key].forEach(function(item) { stripAds(item); });
      }
    }
    // Strip from twoColumnWatchNextResults
    try {
      var r = data.contents &&
              data.contents.twoColumnWatchNextResults &&
              data.contents.twoColumnWatchNextResults.results &&
              data.contents.twoColumnWatchNextResults.results.results;
      if (r && Array.isArray(r.contents)) {
        r.contents = r.contents.filter(function(item) {
          return !item.adSlotRenderer;
        });
      }
    } catch (e) {}
  }

  // 1. Intercept ytInitialPlayerResponse — set inline in the HTML page script
  var _ytpr;
  Object.defineProperty(window, 'ytInitialPlayerResponse', {
    get: function() { return _ytpr; },
    set: function(v) { stripAds(v); _ytpr = v; },
    configurable: true
  });

  // 2. Intercept fetch
  var _nativeFetch = window.fetch.bind(window);
  window.fetch = async function(input, init) {
    var url = typeof input === 'string' ? input : ((input && input.url) || '');
    var resp = await _nativeFetch(input, init);
    if (YT_APIS.some(function(p) { return url.indexOf(p) !== -1; })) {
      try {
        var text = await resp.clone().text();
        var data = JSON.parse(text);
        stripAds(data);
        return new Response(JSON.stringify(data), {
          status: resp.status,
          statusText: resp.statusText,
          headers: resp.headers
        });
      } catch (e) {}
    }
    return resp;
  };

  // 3. Intercept XMLHttpRequest (fallback for older API paths)
  var _xOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    this._duvoUrl = url;
    return _xOpen.apply(this, arguments);
  };
  var _xSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function(body) {
    var url = this._duvoUrl || '';
    if (YT_APIS.some(function(p) { return url.indexOf(p) !== -1; })) {
      var xhr = this;
      xhr.addEventListener('load', function() {
        try {
          var data = JSON.parse(xhr.responseText);
          stripAds(data);
          var cleaned = JSON.stringify(data);
          Object.defineProperty(xhr, 'responseText', { value: cleaned, configurable: true });
          Object.defineProperty(xhr, 'response',     { value: cleaned, configurable: true });
        } catch (e) {}
      });
    }
    return _xSend.apply(this, arguments);
  };
})();

// ── Fullscreen shim ──────────────────────────────────────────────
// Prevents YouTube/Twitch fullscreen from taking over the whole screen.
(function fullscreenShim() {
  if (window.__duvoFullscreen) return;
  window.__duvoFullscreen = true;

  var style = document.createElement('style');
  style.textContent = [
    '.duvo-fake-fullscreen {',
    '  position: fixed !important;',
    '  top: 0 !important; left: 0 !important;',
    '  width: 100vw !important; height: 100vh !important;',
    '  z-index: 2147483647 !important;',
    '  background: black !important;',
    '}'
  ].join('');

  var timer = setInterval(function() {
    var root = document.head || document.documentElement;
    if (root) { root.appendChild(style); clearInterval(timer); }
  }, 10);

  function fakeRequest() {
    this.classList.add('duvo-fake-fullscreen');
    if (window.duvoInternal) window.duvoInternal.sendFullscreen(true);
    var el = this;
    setTimeout(function() {
      el.dispatchEvent(new Event('fullscreenchange', { bubbles: true }));
      document.dispatchEvent(new Event('fullscreenchange', { bubbles: true }));
    }, 50);
    return Promise.resolve();
  }
  fakeRequest.toString = function() { return 'function requestFullscreen() { [native code] }'; };
  Element.prototype.requestFullscreen        = fakeRequest;
  Element.prototype.webkitRequestFullscreen  = fakeRequest;
  Element.prototype.webkitRequestFullScreen  = fakeRequest;

  function fakeExit() {
    document.querySelectorAll('.duvo-fake-fullscreen').forEach(function(el) {
      el.classList.remove('duvo-fake-fullscreen');
    });
    if (window.duvoInternal) window.duvoInternal.sendFullscreen(false);
    setTimeout(function() {
      document.dispatchEvent(new Event('fullscreenchange', { bubbles: true }));
    }, 50);
    return Promise.resolve();
  }
  fakeExit.toString = function() { return 'function exitFullscreen() { [native code] }'; };
  Document.prototype.exitFullscreen       = fakeExit;
  Document.prototype.webkitExitFullscreen = fakeExit;
  Document.prototype.webkitCancelFullScreen = fakeExit;

  Object.defineProperty(Document.prototype, 'fullscreenElement',       { get: function() { return document.querySelector('.duvo-fake-fullscreen') || null; }, configurable: true });
  Object.defineProperty(Document.prototype, 'webkitFullscreenElement', { get: function() { return document.querySelector('.duvo-fake-fullscreen') || null; }, configurable: true });
  Object.defineProperty(Document.prototype, 'fullscreenEnabled',       { get: function() { return true; }, configurable: true });
  Object.defineProperty(Document.prototype, 'webkitFullscreenEnabled', { get: function() { return true; }, configurable: true });
})();

// ── DOM ad blocker — CSS hiding + video skip ──────────────────────
// Runs unconditionally on every page. No flag needed.
(function domAdBlock() {
  var CSS = [
    // YouTube video ads & overlays
    '.ytp-ad-overlay-container','.ytp-ad-image-overlay','.ytp-ad-text-overlay',
    '.ytp-ad-player-overlay','.ytp-ad-player-overlay-layout',
    '.ytp-ad-module','.ytp-ad-progress','.ytp-ad-progress-list',
    '.ytp-ad-action-interstitial','.ytp-ad-skip-button-container',
    '.video-ads.ytp-round-large',
    // YouTube page ads
    '#masthead-ad','.masthead-ad',
    'ytd-banner-promo-renderer','ytd-promoted-sparkles-web-renderer',
    'ytd-statement-banner-renderer','ytd-ad-slot-renderer',
    'ytd-in-feed-ad-layout-renderer','ytd-display-ad-renderer',
    'ytd-promoted-video-renderer','ytd-search-pyv-renderer',
    // Twitch
    '[data-a-target="video-ad-countdown"]','[data-test-selector="sad-overlay"]',
    '.video-player__container--ad',
    // Generic
    '[id^="google_ads"]','[id^="ad-slot"]',
    'iframe[src*="doubleclick.net"]','iframe[src*="googlesyndication.com"]'
  ].join(',') + '{display:none!important}';

  function injectCSS() {
    if (document.__duvoCSS) return;
    var root = document.head || document.documentElement;
    if (!root) return;
    document.__duvoCSS = true;
    var s = document.createElement('style');
    s.id = 'duvo-adblock';
    s.textContent = CSS;
    root.appendChild(s);
  }

  function skipAd() {
    // Click skip button immediately
    var btn = document.querySelector(
      '.ytp-skip-ad-button,.ytp-ad-skip-button,.ytp-ad-skip-button-modern,.ytp-ad-overlay-close-button'
    );
    if (btn instanceof HTMLElement) { btn.click(); return; }

    // Seek to end if ad is playing
    if (document.querySelector('.ad-showing,.ad-interrupting')) {
      var vid = document.querySelector('video');
      if (vid && isFinite(vid.duration) && vid.duration > 0) {
        vid.currentTime = vid.duration;
      }
    }

    // Remove any visible overlay containers
    document.querySelectorAll('.ytp-ad-overlay-container,.ytp-ad-player-overlay-layout,.ytp-ad-image-overlay').forEach(function(el) {
      el.remove();
    });
  }

  function start() {
    injectCSS();
    skipAd();

    // Watch DOM for ad elements being dynamically injected
    var obs = new MutationObserver(function() {
      injectCSS(); // Re-inject if head was replaced (SPA)
      skipAd();
    });
    obs.observe(document.documentElement, {
      childList: true, subtree: true,
      attributes: true, attributeFilter: ['class']
    });

    // Safety net: poll every 300ms
    setInterval(skipAd, 300);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
