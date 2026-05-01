/**
 * Duvo Dual — Main Process (Electron)
 * Copyright © 2026 MavTiN. All rights reserved.
 * https://github.com/mavtin/Duvo-Dual
 */
import { app, BrowserWindow, WebContentsView, ipcMain, Menu, screen, net, session as electronSession } from 'electron';

import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as crypto from 'crypto';

// ════════════════════════════════════════════════════════════════
// ANALYTICS — PostHog (zero dependency, uses Electron net.fetch)
// Anonymous: only tracks install count, OS, country, version.
// No URLs, no personal data, no browsing activity.
// ════════════════════════════════════════════════════════════════
const PH_KEY      = 'phc_vqysgJ67z3PXDZcosg8FkXTabmPtLqbuvogNb8Wm4OaY';
const PH_ENDPOINT = 'https://us.i.posthog.com/capture/';
const PH_ID_FILE  = () => path.join(app.getPath('userData'), 'duvo-analytics-id.txt');

// Load or generate a persistent anonymous user ID
function getAnalyticsId(): string {
  try {
    const f = PH_ID_FILE();
    if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8').trim();
    const id = crypto.randomUUID();
    fs.writeFileSync(f, id);
    return id;
  } catch { return 'unknown'; }
}

async function phCapture(event: string, properties: Record<string, unknown> = {}) {
  if (!app.isPackaged) return; // only track in production
  try {
    await net.fetch(PH_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: PH_KEY,
        event,
        distinct_id: getAnalyticsId(),
        properties: {
          app_version:   app.getVersion(),
          platform:      process.platform,
          arch:          process.arch,
          os_version:    os.release(),
          $app_name:     'Duvo Dual',
          ...properties,
        },
      }),
    });
  } catch { /* silent — never crash on analytics failure */ }
}

// Expose to IPC so renderer can track feature usage
ipcMain.on('ph-capture', (_event, eventName: string, props: Record<string, unknown>) => {
  phCapture(eventName, props);
});



// Force hardware acceleration for video playback
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');

// Allow AudioContext without user gesture for media streaming
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
// disable-web-security is only needed in dev (bypasses CORS for localhost).
// NEVER ship this in production builds.
if (!app.isPackaged) {
  app.commandLine.appendSwitch('disable-web-security');
}

// Set the correct app name (shown in macOS menu bar)
app.name = 'Duvo Dual';

// Configure the native About panel
app.setAboutPanelOptions({
  applicationName: 'Duvo Dual',
  applicationVersion: '1.0.2',
  version: '1.0.2',
  copyright: 'Copyright © 2026 MavTiN\nAll rights reserved.',
  iconPath: path.join(app.getAppPath(), 'assets', 'icons', 'duvo-icon.png'),
});

// Replace the default Electron menu with a minimal, clean Help-focused menu.
function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template: Electron.MenuItemConstructorOptions[] = [
    // App menu (macOS only — shows as 'Duvo Dual')
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' as const },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { role: 'quit' as const },
      ],
    }] : []),
    // Support menu (not named 'Help' — macOS injects a search bar into menus named exactly 'Help')
    {
      label: 'Support',
      submenu: [
        {
          label: 'About Duvo Dual',
          click: () => app.showAboutPanel(),
        },
        {
          label: 'Check for Updates',
          click: async () => {
            const { dialog } = require('electron');
            if (!app.isPackaged) {
              dialog.showMessageBox(mainWindow, { type: 'info', title: 'Check for Updates', message: 'Duvo Dual', detail: `v${app.getVersion()} — Updates only check in production builds.`, buttons: ['OK'] });
              return;
            }
            try {
              const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
              const resp = await net.fetch(url, { headers: { 'User-Agent': `DuvoDual/${app.getVersion()}`, Accept: 'application/vnd.github+json' } });
              if (resp.ok) {
                const data = await resp.json() as { tag_name: string; html_url: string };
                const latest = data.tag_name?.replace(/^v/, '');
                if (latest && semverGt(latest, app.getVersion())) {
                  mainWindow?.webContents.send('update-available', latest, data.html_url);
                  return;
                }
              }
            } catch {}
            dialog.showMessageBox(mainWindow, { type: 'info', title: 'Up to Date', message: 'Duvo Dual', detail: `v${app.getVersion()} — You have the latest version.`, buttons: ['OK'] });
          },
        },
        { type: 'separator' as const },
        {
          label: 'Reset App',
          click: () => {
            const { dialog } = require('electron');
            dialog.showMessageBox(mainWindow, {
              type: 'warning',
              title: 'Reset App',
              message: 'Reset Duvo Dual?',
              detail: 'This will clear all bookmarks, history, and saved settings. The app will restart.',
              buttons: ['Cancel', 'Reset'],
              defaultId: 0,
              cancelId: 0,
            }).then(({ response }: { response: number }) => {
              if (response === 1) {
                mainWindow.webContents.executeJavaScript('localStorage.clear()').then(() => {
                  app.relaunch();
                  app.exit(0);
                });
              }
            });
          },
        },
        { type: 'separator' as const },
        {
          label: 'Submit Feedback & Request',
          click: () => {
            const { shell } = require('electron');
            shell.openExternal('https://github.com/mavtin/Duvo-Dual/issues/new');
          },
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

let mainWindow: BrowserWindow;
let viewA: WebContentsView;
let viewB: WebContentsView;


let globalMuteState = { A: false, B: true };
let globalVolumeState = { A: 1, B: 1 };

// Panel session partitions — read from persisted settings file
function getPanelPartition(panelId: 'A' | 'B'): string | undefined {
  try {
    const settingsPath = require('path').join(app.getPath('userData'), 'duvo-settings-main.json');
    if (require('fs').existsSync(settingsPath)) {
      const s = JSON.parse(require('fs').readFileSync(settingsPath, 'utf8'));
      if (s.isolatePanelSessions === false) return undefined; // shared session
    }
  } catch {}
  return `persist:duvo-panel-${panelId.toLowerCase()}`; // default: isolated
}

// Dynamic shortcuts (updated via IPC when user remaps them in Settings)
let activeShortcuts = {
  switchPanel: 'Tab',
  toggleMute: 'M',
  focusAddressBar: 'L',
  reload: 'R',
  goHome: 'H',
};

const AUDIO_INJECTION_SCRIPT = `
(function() {
  if (window.__duvoAudio) return;
  window.__duvoAudio = {
    audioCtx: null,
    panners: new WeakMap(),
    sources: new WeakMap(),
    gains: new WeakMap(),
    currentPan: 0,
    isMuted: false,
    currentVolume: 1,
    init: function() {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      
      const attachToMedia = (media) => {
        if (this.sources.has(media)) return;
        try {
           const source = this.audioCtx.createMediaElementSource(media);
           const panner = this.audioCtx.createStereoPanner();
           const gainNode = this.audioCtx.createGain();
           
           panner.pan.value = this.currentPan;
           gainNode.gain.value = this.isMuted ? 0 : this.currentVolume;
           
           source.connect(gainNode);
           gainNode.connect(panner);
           panner.connect(this.audioCtx.destination);
           
           this.sources.set(media, source);
           this.panners.set(media, panner);
           this.gains.set(media, gainNode);
        } catch (e) {
           console.log("Duvo Audio Injection Error:", e);
        }
      };

      document.querySelectorAll('video, audio').forEach(attachToMedia);

      const observer = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
          mutation.addedNodes.forEach(node => {
            if (node.tagName === 'VIDEO' || node.tagName === 'AUDIO') {
              attachToMedia(node);
            } else if (node.querySelectorAll) {
              node.querySelectorAll('video, audio').forEach(attachToMedia);
            }
          });
        });
      });

      observer.observe(document.body, { childList: true, subtree: true });
      
      setInterval(() => {
        document.querySelectorAll('video, audio').forEach(attachToMedia);
      }, 1000);
    },
    
    updateState: function(pan, muted, volume) {
      this.currentPan = pan;
      this.isMuted = muted;
      this.currentVolume = volume;
      
      document.querySelectorAll('video, audio').forEach(media => {
         if (this.panners.has(media)) {
            this.panners.get(media).pan.value = pan;
         }
         if (this.gains.has(media)) {
            this.gains.get(media).gain.value = muted ? 0 : volume;
         }
      });
      
      if (this.audioCtx && this.audioCtx.state === 'suspended' && (!muted || volume > 0)) {
         this.audioCtx.resume().catch(e => console.log('Resume failed:', e));
      }
    }
  };

  window.__duvoAudio.init();
})();
`;


function updateAudioRouting() {
  let panA = 0;
  let panB = 0;

  if (!globalMuteState.A && !globalMuteState.B) {
    panA = -1;
    panB = 1;
  } else if (!globalMuteState.A && globalMuteState.B) {
    panA = 0;
  } else if (globalMuteState.A && !globalMuteState.B) {
    panB = 0;
  }

  if (viewA) {
    viewA.webContents.executeJavaScript(`if (window.__duvoAudio) window.__duvoAudio.updateState(${panA}, ${globalMuteState.A}, ${globalVolumeState.A});`).catch(e => console.error(e));
  }
  if (viewB) {
    viewB.webContents.executeJavaScript(`if (window.__duvoAudio) window.__duvoAudio.updateState(${panB}, ${globalMuteState.B}, ${globalVolumeState.B});`).catch(e => console.error(e));
  }
}

const storePath = path.join(app.getPath('userData'), 'duvo-session.json');

interface SessionData {
  urlA: string;
  urlB: string;
  layout: string;
}

// In-memory cache — avoids re-reading the file on every navigation
let _sessionCache: SessionData | null = null;

function loadSession(): SessionData {
  if (_sessionCache) return _sessionCache;
  try {
    if (fs.existsSync(storePath)) {
      const data = fs.readFileSync(storePath, 'utf-8');
      _sessionCache = JSON.parse(data);
      return _sessionCache!;
    }
  } catch (e) {
    console.error('Failed to load session', e);
  }
  _sessionCache = { urlA: 'about:blank', urlB: 'about:blank', layout: '50/50' };
  return _sessionCache;
}

function saveSession(data: Partial<SessionData>) {
  // Merge into in-memory cache — no file re-read needed
  _sessionCache = { ...loadSession(), ...data };
  try {
    fs.writeFileSync(storePath, JSON.stringify(_sessionCache));
  } catch (e) {
    console.error('Failed to save session', e);
  }
}

// ── Ad blocking — CSS hider + JS skipper injected into pages ──
const AD_SKIP_CSS = `
  /* ── YouTube ── */
  .ytp-ad-overlay-container,.ytp-ad-image-overlay,.ytp-ad-text-overlay,
  .ytp-ad-player-overlay,.ytp-ad-module,.ytp-ad-progress,.ytp-ad-progress-list,
  .video-ads.ytp-round-large,.ytp-ad-action-interstitial,.ytp-ad-skip-button-container,
  .ytp-ad-timed-pie-countdown-container,
  #masthead-ad,.masthead-ad,
  ytd-banner-promo-renderer,ytd-promoted-sparkles-web-renderer,
  ytd-statement-banner-renderer,ytd-ad-slot-renderer,
  ytd-in-feed-ad-layout-renderer,ytd-display-ad-renderer,
  ytd-promoted-video-renderer,ytd-search-pyv-renderer,
  ytd-rich-item-renderer:has(ytd-ad-slot-renderer) { display:none!important; }

  /* ── Twitch ── */
  [data-a-target="video-ad-countdown"],[data-test-selector="sad-overlay"],
  .video-player__container--ad,.tw-ad,[class*="AdBanner"],[class*="ad-banner"] { display:none!important; }

  /* ── Generic ad hiders ── */
  [id^="ad-slot"],[id^="google_ads"],[id*="AdContainer"],[class*="AdContainer"],
  [class*="ad-container"],[class*="ad-placeholder"],[class*="ad-wrapper"],
  [class*="sponsored-label"],[data-ad-rendered],
  iframe[src*="doubleclick.net"],iframe[src*="googlesyndication.com"],
  iframe[src*="advertising.com"],iframe[src*="adnxs.com"] { display:none!important; }
`;

// Injected JS: auto-skips YouTube/video ads using MutationObserver + interval
const AD_SKIP_JS = `(function(){
  'use strict';
  let lastSkip = 0;
  function skip() {
    const now = Date.now();
    if (now - lastSkip < 100) return;
    lastSkip = now;
    // 1. Click any visible skip button
    const btn = document.querySelector(
      '.ytp-skip-ad-button,.ytp-ad-skip-button,.ytp-ad-skip-button-modern,'
      +'.ytp-ad-overlay-close-button,[class*="skip-button"][class*="ad"]'
    );
    if (btn instanceof HTMLElement) { btn.click(); return; }

    // 2. If ad is actively playing: seek to end to trigger skip
    const adShowing = document.querySelector('.ad-showing,.ad-interrupting');
    if (adShowing) {
      const video = document.querySelector('video');
      if (video && isFinite(video.duration) && video.duration > 0) {
        video.currentTime = video.duration;
        return;
      }
    }

    // 3. Remove ad overlays that slip through
    document.querySelectorAll(
      '.ytp-ad-overlay-container,.ytp-ad-image-overlay,.ytp-ad-player-overlay-layout'
    ).forEach(function(el){ el.remove(); });
  }

  // Observe DOM for ad elements being injected
  var obs = new MutationObserver(skip);
  function start() {
    if (document.body) obs.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  }
  document.body ? start() : document.addEventListener('DOMContentLoaded', start);

  // Also poll every 250ms as a safety net
  setInterval(skip, 250);
  skip();
})();`;

function injectAdBlock(wc: Electron.WebContents): void {
  if (!adBlockEnabled) return;
  wc.insertCSS(AD_SKIP_CSS).catch(() => {});
  wc.executeJavaScript(AD_SKIP_JS).catch(() => {});
}

function createView(id: string, initialUrl: string) {
  // view-preload.js is a static file compiled alongside main.js into dist-electron/
  const viewPreloadPath = path.join(__dirname, 'view-preload.js');

  const partition = getPanelPartition(id as 'A' | 'B');
  const view = new WebContentsView({
    webPreferences: {
      preload: viewPreloadPath,
      nodeIntegration: false,
      contextIsolation: false,   // Must be false so preload can patch window.fetch before page scripts
      backgroundThrottling: false,
      ...(partition ? { partition } : {}),
    }
  });

  // executeJavaScript internally uses did-stop-loading listeners.
  // Raise the limit so Node doesn't emit false-positive leak warnings.
  view.webContents.setMaxListeners(50);

  // Load URL with basic error handling
  if (initialUrl && initialUrl !== 'about:blank') {
    view.webContents.loadURL(initialUrl).catch(e => {
      console.log(`Failed to load ${initialUrl}`, e);
    });
  }

  // Handle URL changes to update UI
  view.webContents.on('did-navigate', (event, url) => {
    mainWindow.webContents.send('url-changed', id, url);
    saveSession(id === 'A' ? { urlA: url } : { urlB: url });
  });

  view.webContents.on('did-navigate-in-page', (event, url) => {
    mainWindow.webContents.send('url-changed', id, url);
    saveSession(id === 'A' ? { urlA: url } : { urlB: url });
  });

  // Stream title → renderer toolbar
  view.webContents.on('page-title-updated', (_event, title) => {
    mainWindow.webContents.send('page-title', id, title);
  });

  view.webContents.on('dom-ready', () => {
    view.webContents.executeJavaScript(AUDIO_INJECTION_SCRIPT).then(() => {
      updateAudioRouting();
    }).catch(e => console.error('Audio script injection failed', e));
    injectAdBlock(view.webContents);
  });

  // Re-inject after SPA navigations (YouTube/Twitch are single-page apps)
  view.webContents.on('did-navigate', () => injectAdBlock(view.webContents));
  view.webContents.on('did-navigate-in-page', () => injectAdBlock(view.webContents));

  // Keyboard shortcut interception inside the webview (uses dynamic activeShortcuts)
  view.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const k = input.key;
    if (k === activeShortcuts.switchPanel) {
      mainWindow.webContents.send('focus-shortcut');
      event.preventDefault();
    } else if (k.toLowerCase() === activeShortcuts.toggleMute.toLowerCase()) {
      mainWindow.webContents.send('mute-shortcut');
    } else if (k.toLowerCase() === activeShortcuts.focusAddressBar.toLowerCase() && (input.meta || input.control)) {
      mainWindow.webContents.send('address-bar-shortcut');
      event.preventDefault();
    } else if (k.toLowerCase() === activeShortcuts.reload.toLowerCase() && (input.meta || input.control)) {
      mainWindow.webContents.send('reload-shortcut');
    } else if (k.toLowerCase() === activeShortcuts.goHome.toLowerCase() && (input.meta || input.control)) {
      mainWindow.webContents.send('home-shortcut');
      event.preventDefault();
    }
  });

  return view;
}

function createWindow() {
  const session = loadSession();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    // macOS: use hidden inset so traffic lights sit inside the app chrome.
    // Windows: go fully frameless — we render our own title bar in the renderer.
    ...(process.platform === 'win32'
      ? { frame: false }
      : { titleBarStyle: 'hiddenInset' as const }
    ),
    backgroundColor: '#0f1115',
    icon: path.join(__dirname, '../assets/icons',
      process.platform === 'win32' ? 'duvo-icon.ico'
      : process.platform === 'darwin' ? 'duvo-icon.icns'
      : 'duvo-icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Initialize Views — always start on the home screen regardless of last session
  viewA = createView('A', 'about:blank');
  viewB = createView('B', 'about:blank');

  mainWindow.contentView.addChildView(viewA);
  mainWindow.contentView.addChildView(viewB);
  mainWindow.webContents.setMaxListeners(50);

  // Notify renderer of maximize/restore so the custom Windows title bar updates its icon
  mainWindow.on('maximize',   () => mainWindow.webContents.send('win-maximize-change', true));
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('win-maximize-change', false));

  // Send initial mute state and start audio routing logic
  updateAudioRouting();

  // Expose session layout to Renderer initially via a small script execution
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript(`window.initialSessionLayout = "${session.layout}"`);
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}



// ── Custom Windows title bar — window control IPC ─────────────────────────────
ipcMain.on('win-minimize', () => mainWindow?.minimize());
ipcMain.on('win-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.on('win-close', () => mainWindow?.close());
ipcMain.handle('win-is-maximized', () => mainWindow?.isMaximized() ?? false);

// About dialog (used by custom Windows title bar Support menu + macOS Help menu)
ipcMain.on('show-about', () => {
  const { dialog } = require('electron');
  dialog.showMessageBox(mainWindow!, {
    type: 'info',
    title: 'About Duvo Dual',
    message: 'Duvo Dual',
    detail: `Version ${app.getVersion()}\n\nPremium dual-panel streaming browser\nfor macOS & Windows.\n\nCopyright \u00A9 2026 MavTiN\nhttps://github.com/mavtin/Duvo-Dual`,
    buttons: ['OK'],
  });
});

// IPC Handlers
ipcMain.on('update-bounds', (event, boundsA, boundsB) => {
  if (viewA && boundsA) {
    viewA.setBounds({ x: Math.round(boundsA.x), y: Math.round(boundsA.y), width: Math.round(boundsA.width), height: Math.round(boundsA.height) });
  }
  if (viewB && boundsB) {
    viewB.setBounds({ x: Math.round(boundsB.x), y: Math.round(boundsB.y), width: Math.round(boundsB.width), height: Math.round(boundsB.height) });
  }
});

ipcMain.on('load-url', (event, panelId, urlStr) => {
  let finalUrl = urlStr;
  if (!/^https?:\/\//i.test(finalUrl) && finalUrl !== 'about:blank') {
    finalUrl = 'https://' + finalUrl;
  }
  const view = panelId === 'A' ? viewA : viewB;
  view.webContents.loadURL(finalUrl).catch(e => console.log('Load failed', e));
});

ipcMain.on('go-back', (event, panelId) => {
  const view = panelId === 'A' ? viewA : viewB;
  const nav = view.webContents.navigationHistory;
  if (nav ? nav.canGoBack() : view.webContents.canGoBack()) {
    nav ? nav.goBack() : view.webContents.goBack();
  }
});

ipcMain.on('go-forward', (event, panelId) => {
  const view = panelId === 'A' ? viewA : viewB;
  const nav = view.webContents.navigationHistory;
  if (nav ? nav.canGoForward() : view.webContents.canGoForward()) {
    nav ? nav.goForward() : view.webContents.goForward();
  }
});

ipcMain.on('reload', (event, panelId) => {
  const view = panelId === 'A' ? viewA : viewB;
  view.webContents.reload();
});

ipcMain.on('set-mute', (event, panelId, muted) => {
  const view = panelId === 'A' ? viewA : viewB;
  view.webContents.setAudioMuted(muted);
  
  if (panelId === 'A') globalMuteState.A = muted;
  else globalMuteState.B = muted;
  
  updateAudioRouting();
});

ipcMain.on('set-volume', (event, panelId, volume) => {
  if (panelId === 'A') globalVolumeState.A = volume;
  else globalVolumeState.B = volume;
  updateAudioRouting();
});

ipcMain.on('set-focus-dimming', (event, activePanelId) => {
  const dimCSS = `
    if (!document.getElementById('duvo-dim-style')) {
      const style = document.createElement('style');
      style.id = 'duvo-dim-style';
      style.innerHTML = 'html { transition: filter 150ms ease-out !important; } html.duvo-dimmed { filter: brightness(0.55) saturate(0.85) !important; }';
      if (document.head) document.head.appendChild(style);
    }
  `;
  if (viewA) viewA.webContents.executeJavaScript(dimCSS + (activePanelId === 'A' ? "document.documentElement.classList.remove('duvo-dimmed');" : "document.documentElement.classList.add('duvo-dimmed');")).catch(() => {});
  if (viewB) viewB.webContents.executeJavaScript(dimCSS + (activePanelId === 'B' ? "document.documentElement.classList.remove('duvo-dimmed');" : "document.documentElement.classList.add('duvo-dimmed');")).catch(() => {});
});

ipcMain.on('duvo-fullscreen-event', (event, state) => {
  if (viewA && event.sender.id === viewA.webContents.id) {
    mainWindow.webContents.send('fullscreen-state', 'A', state);
  } else if (viewB && event.sender.id === viewB.webContents.id) {
    mainWindow.webContents.send('fullscreen-state', 'B', state);
  }
});

// Update dynamic shortcuts from renderer Settings panel
ipcMain.on('update-shortcuts', (_event, shortcuts) => {
  Object.assign(activeShortcuts, shortcuts);
});

// Launch at login
ipcMain.on('set-login-item', (_event, enabled: boolean) => {
  // Only works on signed production builds — suppress the macOS sandbox warning in dev
  if (app.isPackaged) {
    app.setLoginItemSettings({ openAtLogin: enabled });
  }
});

// ════════════════════════════════════════════════════════════════
// AD BLOCKER — EasyList + EasyPrivacy engine
// Uses Electron's net module (Chromium network stack) so it works
// even when Node.js DNS resolution is unavailable.
// ════════════════════════════════════════════════════════════════
let adBlockEnabled = false;
let adBlockHosts   = new Set<string>(); // parsed from EasyList
let adBlockReady   = false;

// Streaming-specific URL patterns not covered by EasyList
// (YouTube/Twitch serve ads from their own CDN domains)
const STREAMING_PATTERNS: RegExp[] = [
  /[?&]adformat=/i, /[?&]ad_type=/i,   /[?&]oad=/i,
  /\/api\/stats\/ads/i,                  /\/ptracking[?]/i,
  /\/pagead\//i,                         /\/pcs\/activeview/i,
  /youtube\.com\/api\/ads/i,             /youtube\.com\/pagead/i,
  /[?&]adunit=/i,                        /[?&]ad_id=/i,
  /\.twitchsvc\.net/i,                   /twitchapps\.com.*ads/i,
  /springserve\.(com|net)/i,             /freewheel\.(tv|net)/i,
  /spotx\.(tv|change\.com)/i,            /lkqd\.(net|com)/i,
  /\/advertisement\b/i,
];

// ── Parse EasyList text into a hostname Set ───────────────────
function parseEasyListHosts(text: string): Set<string> {
  const hosts = new Set<string>();
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    // Skip comments, CSS cosmetics, exceptions, option-bearing rules
    if (!line || line.startsWith('!') || line.startsWith('[') ||
        line.includes('##') || line.includes('#@#') ||
        line.startsWith('@@') || line.startsWith('/')) continue;

    if (line.startsWith('||')) {
      // e.g. ||example.com^  or  ||ads.example.com/path^$options
      const rest = line.slice(2);
      const m = rest.match(/^([a-z0-9\-_.]+)[\^\/|]/i);
      if (m && m[1] && !m[1].includes('*') && m[1].includes('.')) {
        hosts.add(m[1].toLowerCase());
      }
    }
  }
  return hosts;
}

// ── Efficient subdomain matching ──────────────────────────────
function isAdHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (adBlockHosts.has(h)) return true;
  // Walk up: sub.ads.example.com → ads.example.com → example.com
  const parts = h.split('.');
  for (let i = 1; i < parts.length - 1; i++) {
    if (adBlockHosts.has(parts.slice(i).join('.'))) return true;
  }
  return false;
}

// ── Download EasyList via Chromium network stack ──────────────
const FILTER_LISTS = [
  'https://easylist.to/easylist/easylist.txt',
  'https://easylist.to/easylist/easyprivacy.txt',
  'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters.txt',
];
const CACHE_FILE  = () => path.join(app.getPath('userData'), 'adblock-rules.txt');
const CACHE_META  = () => path.join(app.getPath('userData'), 'adblock-cache-time.txt');
const CACHE_TTL   = 24 * 60 * 60 * 1000; // 24 hours

async function loadAdBlockRules(): Promise<void> {
  let rulesText = '';

  // ── Try local cache first ──
  try {
    const cacheFile = CACHE_FILE();
    const cacheMeta = CACHE_META();
    if (fs.existsSync(cacheFile) && fs.existsSync(cacheMeta)) {
      const age = Date.now() - parseInt(fs.readFileSync(cacheMeta, 'utf8'), 10);
      if (age < CACHE_TTL) {
        rulesText = fs.readFileSync(cacheFile, 'utf8');
        console.log('[AdBlock] Loaded from cache');
      }
    }
  } catch {}

  // ── Download fresh lists via Chromium net module ──
  if (!rulesText) {
    const parts: string[] = [];
    for (const url of FILTER_LISTS) {
      try {
        const resp = await net.fetch(url);
        if (resp.ok) {
          parts.push(await resp.text());
          if (!app.isPackaged) console.log('[AdBlock] Fetched:', url);
        }
      } catch (e) {
        console.warn('[AdBlock] Fetch failed:', url, e);
      }
    }
    if (parts.length > 0) {
      rulesText = parts.join('\n');
      try {
        fs.writeFileSync(CACHE_FILE(), rulesText);
        fs.writeFileSync(CACHE_META(), Date.now().toString());
        console.log('[AdBlock] Lists cached to disk');
      } catch {}
    }
  }

  if (rulesText) {
    adBlockHosts = parseEasyListHosts(rulesText);
    console.log(`[AdBlock] Loaded ${adBlockHosts.size.toLocaleString()} blocked hosts`);
  }
  adBlockReady = true;
}

// ── Wire up webRequest interceptor on every session ───────────
function setupAdBlockInterceptor(ses: Electron.Session): void {
  ses.webRequest.onBeforeRequest({ urls: ['<all_urls>'] },
    (details: { url: string }, callback: (r: object) => void) => {
      if (!adBlockEnabled || !adBlockReady) { callback({}); return; }
      try {
        const url  = details.url;
        const host = new URL(url).hostname;
        if (isAdHost(host) || STREAMING_PATTERNS.some(p => p.test(url))) {
          callback({ cancel: true });
        } else {
          callback({});
        }
      } catch { callback({}); }
    }
  );
}

// Interceptors are set up in app.whenReady() after sessions exist.
// Toggle is instant — no restart needed.
ipcMain.on('set-ad-blocking', (_event, enabled: boolean) => {
  adBlockEnabled = enabled;
});



// Clear all cookies
ipcMain.on('clear-cookies', async () => {
  const ses = require('electron').session.defaultSession;
  await ses.clearStorageData({ storages: ['cookies', 'localstorage', 'sessionstorage', 'indexdb', 'cachestorage'] });
});

// Reset app (called after localStorage.clear() in renderer)
ipcMain.on('reset-app', () => {
  app.relaunch();
  app.exit(0);
});

// ── Per-panel session isolation: persist isolatePanelSessions to disk ──
// (localStorage is renderer-only; main process reads this sidecar file)
ipcMain.on('set-session-isolation', (_event, enabled: boolean) => {
  const settingsPath = path.join(app.getPath('userData'), 'duvo-settings-main.json');
  let data: Record<string, unknown> = {};
  try { if (fs.existsSync(settingsPath)) data = JSON.parse(fs.readFileSync(settingsPath, 'utf8')); } catch {}
  data.isolatePanelSessions = enabled;
  fs.writeFileSync(settingsPath, JSON.stringify(data));
});

// ── Notification Blocker ────────────────────────────────────────────────
let notificationBlockEnabled = true; // default ON

function applyNotificationBlock(ses: Electron.Session) {
  ses.setPermissionRequestHandler((_webContents, permission, callback) => {
    if (notificationBlockEnabled && permission === 'notifications') {
      callback(false); // silently deny
    } else {
      callback(true);
    }
  });
}

ipcMain.on('set-notification-block', (_event, enabled: boolean) => {
  notificationBlockEnabled = enabled;
  // Re-apply to all sessions
  [electronSession.defaultSession,
   electronSession.fromPartition('persist:duvo-panel-a'),
   electronSession.fromPartition('persist:duvo-panel-b'),
  ].forEach(applyNotificationBlock);
});

// ── Multi-Monitor Mode ──────────────────────────────────────────────────
let panelWindowA: BrowserWindow | null = null;
let panelWindowB: BrowserWindow | null = null;

ipcMain.handle('get-displays', () => {
  const primary = screen.getPrimaryDisplay();
  return screen.getAllDisplays().map(d => ({
    id: d.id,
    bounds: d.bounds,
    primary: d.id === primary.id,
  }));
});

ipcMain.on('open-multi-monitor', (_event, displayIdA: number, displayIdB: number) => {
  const displays = screen.getAllDisplays();
  const dispA = displays.find(d => d.id === displayIdA);
  const dispB = displays.find(d => d.id === displayIdB);
  if (!dispA || !dispB || !viewA || !viewB) return;

  // ── Screen A window ──
  panelWindowA = new BrowserWindow({
    x: dispA.bounds.x, y: dispA.bounds.y,
    width: dispA.bounds.width, height: dispA.bounds.height,
    frame: false, backgroundColor: '#080810',
  });
  panelWindowA.setFullScreen(true);
  mainWindow.contentView.removeChildView(viewA);
  panelWindowA.contentView.addChildView(viewA);
  viewA.setBounds({ x: 0, y: 0, width: dispA.bounds.width, height: dispA.bounds.height });

  // ── Screen B window ──
  panelWindowB = new BrowserWindow({
    x: dispB.bounds.x, y: dispB.bounds.y,
    width: dispB.bounds.width, height: dispB.bounds.height,
    frame: false, backgroundColor: '#080810',
  });
  panelWindowB.setFullScreen(true);
  mainWindow.contentView.removeChildView(viewB);
  panelWindowB.contentView.addChildView(viewB);
  viewB.setBounds({ x: 0, y: 0, width: dispB.bounds.width, height: dispB.bounds.height });

  const cleanup = () => mainWindow.webContents.send('multi-monitor-closed');
  panelWindowA.on('closed', cleanup);
  panelWindowB.on('closed', cleanup);
});

ipcMain.on('close-multi-monitor', () => {
  if (panelWindowA && !panelWindowA.isDestroyed()) {
    try { panelWindowA.contentView.removeChildView(viewA); } catch {}
    mainWindow.contentView.addChildView(viewA);
    panelWindowA.destroy();
    panelWindowA = null;
  }
  if (panelWindowB && !panelWindowB.isDestroyed()) {
    try { panelWindowB.contentView.removeChildView(viewB); } catch {}
    mainWindow.contentView.addChildView(viewB);
    panelWindowB.destroy();
    panelWindowB = null;
  }
  // Re-trigger bounds update from renderer
  mainWindow.webContents.send('multi-monitor-closed');
});

app.whenReady().then(async () => {
  buildMenu();
  createWindow();

  // Set up ad blocker + notification blocker interceptors on all sessions
  const defaultSes = electronSession.defaultSession;
  const sesA = electronSession.fromPartition('persist:duvo-panel-a');
  const sesB = electronSession.fromPartition('persist:duvo-panel-b');
  const allSessions = [defaultSes, sesA, sesB];
  allSessions.forEach(setupAdBlockInterceptor);
  allSessions.forEach(applyNotificationBlock);

  // Download/load EasyList rules in background (non-blocking)
  loadAdBlockRules().catch(e => console.warn('[AdBlock] Init error:', e));

  // Analytics: track launch (non-blocking, production only)
  phCapture('app_launched');

  // Check for updates 5 seconds after launch (non-blocking, no delay to startup)

  setTimeout(() => checkForUpdates(), 5000);
});

// ── Update Checker ──────────────────────────────────────────────────────
// Uses GitHub Releases API — no paid service needed.
// Replace GITHUB_OWNER/GITHUB_REPO with your actual values before shipping.
const GITHUB_OWNER = 'mavtin';
const GITHUB_REPO  = 'Duvo-Dual';

function semverGt(a: string, b: string): boolean {
  // Returns true if version a > version b
  const parse = (v: string) => v.replace(/^v/, '').split('.').map(Number);
  const [aMaj, aMin, aPat] = parse(a);
  const [bMaj, bMin, bPat] = parse(b);
  if (aMaj !== bMaj) return aMaj > bMaj;
  if (aMin !== bMin) return aMin > bMin;
  return aPat > bPat;
}

async function checkForUpdates() {
  if (!app.isPackaged) return; // skip in dev
  try {
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
    const resp = await net.fetch(url, {
      headers: { 'User-Agent': `DuvoDual/${app.getVersion()}`, Accept: 'application/vnd.github+json' },
    });
    if (!resp.ok) return;
    const data = await resp.json() as { tag_name: string; html_url: string };
    const latest = data.tag_name?.replace(/^v/, '');
    const current = app.getVersion();
    if (latest && semverGt(latest, current)) {
      // Notify the renderer to show an update banner
      mainWindow?.webContents.send('update-available', latest, data.html_url);
    }
  } catch { /* silent — don't crash if GitHub is unreachable */ }
}

ipcMain.on('open-releases-page', (_event, url: string) => {
  const { shell } = require('electron');
  shell.openExternal(url);
});


app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
