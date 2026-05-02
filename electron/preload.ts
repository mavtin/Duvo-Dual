/**
 * Duvo Dual — Renderer Preload / IPC Bridge
 * Copyright © 2026 MavTiN. All rights reserved.
 * https://github.com/mavtin/Duvo-Dual
 */
import { contextBridge, ipcRenderer } from 'electron';


contextBridge.exposeInMainWorld('duvoApi', {
  // ── Actions ───────────────────────────────────────────────────
  updateBounds:    (panelA: any, panelB: any) => ipcRenderer.send('update-bounds', panelA, panelB),
  loadUrl:         (panelId: string, url: string) => ipcRenderer.send('load-url', panelId, url),
  goBack:          (panelId: string) => ipcRenderer.send('go-back', panelId),
  goForward:       (panelId: string) => ipcRenderer.send('go-forward', panelId),
  reload:          (panelId: string) => ipcRenderer.send('reload', panelId),
  setMute:         (panelId: string, muted: boolean) => ipcRenderer.send('set-mute', panelId, muted),
  setVolume:       (panelId: string, volume: number) => ipcRenderer.send('set-volume', panelId, volume),
  setFocusDimming: (activePanelId: string) => ipcRenderer.send('set-focus-dimming', activePanelId),

  // ── Settings actions ──────────────────────────────────────────
  updateShortcuts: (shortcuts: object) => ipcRenderer.send('update-shortcuts', shortcuts),
  setLoginItem:    (enabled: boolean) => ipcRenderer.send('set-login-item', enabled),
  setAdBlocking:   (enabled: boolean) => ipcRenderer.send('set-ad-blocking', enabled),
  clearCookies:    () => ipcRenderer.send('clear-cookies'),
  resetApp:        () => ipcRenderer.send('reset-app'),
  setSessionIsolation:   (enabled: boolean) => ipcRenderer.send('set-session-isolation', enabled),
  setNotificationBlock:  (enabled: boolean) => ipcRenderer.send('set-notification-block', enabled),
  phCapture:             (event: string, props?: Record<string, unknown>) => ipcRenderer.send('ph-capture', event, props ?? {}),

  // ── Multi-Monitor ─────────────────────────────────────────────
  getDisplays:          () => ipcRenderer.invoke('get-displays'),
  openMultiMonitor:     (displayIdA: number, displayIdB: number) => ipcRenderer.send('open-multi-monitor', displayIdA, displayIdB),
  closeMultiMonitor:    () => ipcRenderer.send('close-multi-monitor'),

  // ── Updates ───────────────────────────────────────────────────
  openReleasesPage:     (url: string) => ipcRenderer.send('open-releases-page', url),
  onUpdateAvailable:    (callback: (version: string, url: string) => void) => {
    const h = (_e: any, version: string, url: string) => callback(version, url);
    ipcRenderer.on('update-available', h);
    return () => ipcRenderer.removeListener('update-available', h);
  },

  // ── Listeners (each returns an unsubscribe fn to prevent leaks) ───
  onUrlChanged: (callback: (panelId: string, url: string) => void) => {
    const h = (_e: any, panelId: string, url: string) => callback(panelId, url);
    ipcRenderer.on('url-changed', h);
    return () => ipcRenderer.removeListener('url-changed', h);
  },
  onPageTitle: (callback: (panelId: string, title: string) => void) => {
    const h = (_e: any, panelId: string, title: string) => callback(panelId, title);
    ipcRenderer.on('page-title', h);
    return () => ipcRenderer.removeListener('page-title', h);
  },
  onFocusShortcut: (callback: () => void) => {
    const h = () => callback();
    ipcRenderer.on('focus-shortcut', h);
    return () => ipcRenderer.removeListener('focus-shortcut', h);
  },
  onAddressBarShortcut: (callback: () => void) => {
    const h = () => callback();
    ipcRenderer.on('address-bar-shortcut', h);
    return () => ipcRenderer.removeListener('address-bar-shortcut', h);
  },
  onMuteShortcut: (callback: () => void) => {
    const h = () => callback();
    ipcRenderer.on('mute-shortcut', h);
    return () => ipcRenderer.removeListener('mute-shortcut', h);
  },
  onReloadShortcut: (callback: () => void) => {
    const h = () => callback();
    ipcRenderer.on('reload-shortcut', h);
    return () => ipcRenderer.removeListener('reload-shortcut', h);
  },
  onHomeShortcut: (callback: () => void) => {
    const h = () => callback();
    ipcRenderer.on('home-shortcut', h);
    return () => ipcRenderer.removeListener('home-shortcut', h);
  },
  onMultiMonitorClosed: (callback: () => void) => {
    const h = () => callback();
    ipcRenderer.on('multi-monitor-closed', h);
    return () => ipcRenderer.removeListener('multi-monitor-closed', h);
  },
  onFullscreenState: (callback: (panelId: string, isFullscreen: boolean) => void) => {
    const h = (_e: any, panelId: string, isFullscreen: boolean) => callback(panelId, isFullscreen);
    ipcRenderer.on('fullscreen-state', h);
    return () => ipcRenderer.removeListener('fullscreen-state', h);
  },

  // ── Custom Windows title bar ───────────────────────────────────
  platform:        process.platform,
  appVersion:      process.env.npm_package_version ?? '',   // populated by Vite/Electron
  minimizeWindow:  () => ipcRenderer.send('win-minimize'),
  maximizeWindow:  () => ipcRenderer.send('win-maximize'),
  closeWindow:     () => ipcRenderer.send('win-close'),
  isMaximized:     () => ipcRenderer.invoke('win-is-maximized'),
  showAbout:       () => ipcRenderer.send('show-about'),
  getAppVersion:   () => ipcRenderer.invoke('get-app-version'),
  onMaximizeChange: (callback: (maximized: boolean) => void) => {
    const h = (_e: any, maximized: boolean) => callback(maximized);
    ipcRenderer.on('win-maximize-change', h);
    return () => ipcRenderer.removeListener('win-maximize-change', h);
  },
  onShowAboutModal: (callback: () => void) => {
    const h = () => callback();
    ipcRenderer.on('show-about-modal', h);
    return () => ipcRenderer.removeListener('show-about-modal', h);
  },
});

