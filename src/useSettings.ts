/**
 * Duvo Dual — Settings Schema, Defaults & Hook
 * Copyright © 2026 MavTiN. All rights reserved.
 * https://github.com/mavtin/Duvo-Dual
 */
import { useCallback, useState } from 'react';


export interface Shortcuts {
  switchPanel: string;
  toggleMute: string;
  focusAddressBar: string;
  reload: string;
  goHome: string;
}

export interface LayoutPreset {
  id: string;
  name: string;
  ratio: number; // left panel percentage (20–80)
}

export interface AppSettings {
  // General
  defaultLayout: '50' | '70' | '30';
  defaultActivePanel: 'A' | 'B';
  launchAtLogin: boolean;
  // Audio
  defaultMutedScreen: 'A' | 'B' | 'none';
  defaultVolumeA: number;
  defaultVolumeB: number;
  // Browser
  searchEngine: 'google' | 'duckduckgo' | 'bing' | 'brave';
  blockAds: boolean;
  blockNotifications: boolean;
  allowAutoplay: boolean;
  // Appearance
  theme: 'dark' | 'light' | 'system';
  accentColor: string;
  autoHideToolbar: boolean;
  // Home Screen
  historyLimit: 50 | 100 | 500 | -1;
  // Layout
  layoutPresets: LayoutPreset[];
  // Shortcuts
  shortcuts: Shortcuts;
  // Panel Identity
  panelLabelA: string;
  panelLabelB: string;
  // Session
  isolatePanelSessions: boolean;
  // Internal
  onboardingComplete: boolean;
}

export const ACCENT_PRESETS = [
  { name: 'Indigo',  value: '#6c63ff' },
  { name: 'Blue',    value: '#3b82f6' },
  { name: 'Rose',    value: '#f43f5e' },
  { name: 'Amber',   value: '#f59e0b' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Purple',  value: '#a855f7' },
];

export const DEFAULT_LAYOUT_PRESETS: LayoutPreset[] = [
  { id: 'p50', name: '50/50', ratio: 50 },
  { id: 'p60', name: '60/40', ratio: 60 },
  { id: 'p70', name: '70/30', ratio: 70 },
];

export const DEFAULT_SETTINGS: AppSettings = {
  defaultLayout: '50',
  defaultActivePanel: 'A',
  launchAtLogin: false,
  defaultMutedScreen: 'B',
  defaultVolumeA: 1,
  defaultVolumeB: 1,
  searchEngine: 'google',
  blockAds: false,
  blockNotifications: true,
  allowAutoplay: true,
  theme: 'dark',
  accentColor: '#6c63ff',
  autoHideToolbar: false,
  historyLimit: 100,
  layoutPresets: DEFAULT_LAYOUT_PRESETS,
  shortcuts: {
    switchPanel: 'Tab',
    toggleMute: 'M',
    focusAddressBar: 'L',
    reload: 'R',
    goHome: 'H',
  },
  panelLabelA: 'Screen A',
  panelLabelB: 'Screen B',
  isolatePanelSessions: true,
  onboardingComplete: false,
};


const SETTINGS_KEY = 'duvo-settings';

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        shortcuts: { ...DEFAULT_SETTINGS.shortcuts, ...(parsed.shortcuts ?? {}) },
        layoutPresets: parsed.layoutPresets ?? DEFAULT_LAYOUT_PRESETS,
      };
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(s: AppSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export function useSettings() {
  const [settings, setSettingsState] = useState<AppSettings>(loadSettings);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettingsState(prev => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  return { settings, updateSettings };
}

/** Resolve a raw address-bar query into a full URL using the configured search engine */
export function resolveUrl(raw: string, engine: AppSettings['searchEngine']): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const looksLikeDomain =
    !trimmed.includes(' ') &&
    /^[a-zA-Z0-9]([a-zA-Z0-9\-]*\.)+[a-zA-Z]{2,}(\/\S*)?$/.test(trimmed);
  if (looksLikeDomain) return 'https://' + trimmed;

  const q = encodeURIComponent(trimmed);
  const engines: Record<AppSettings['searchEngine'], string> = {
    google:     `https://www.google.com/search?q=${q}`,
    duckduckgo: `https://duckduckgo.com/?q=${q}`,
    bing:       `https://www.bing.com/search?q=${q}`,
    brave:      `https://search.brave.com/search?q=${q}`,
  };
  return engines[engine];
}
