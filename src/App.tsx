/**
 * Duvo Dual — Main Application Component
 * Copyright © 2026 MavTiN. All rights reserved.
 * https://github.com/mavtin/Duvo-Dual
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';

import { RotateCcw, Volume2, VolumeX, ArrowLeft, ArrowRight, Globe, Home, Settings as SettingsIcon, Sun, Moon, Monitor, Pencil, Check, Plus, X } from 'lucide-react';
import duvoIcon from '../assets/icons/duvo-icon.png';
import NewTab from './NewTab';
import Settings from './Settings';
import Onboarding from './Onboarding';
import WinTitleBar from './WinTitleBar';
import { useSettings, resolveUrl, loadSettings, DEFAULT_LAYOUT_PRESETS, type LayoutPreset } from './useSettings';

declare global {
  interface Window { duvoApi: any; initialSessionLayout?: string; }
}

type Panel = 'A' | 'B';

export interface HistoryEntry {
  id: string; url: string; host: string; timestamp: number;
}

function loadHistory(panel: Panel): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(`duvo-history-${panel}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function persistHistory(panel: Panel, entries: HistoryEntry[]) {
  localStorage.setItem(`duvo-history-${panel}`, JSON.stringify(entries));
}

function addHistoryEntry(prev: HistoryEntry[], url: string, limit: number): HistoryEntry[] {
  if (!url || url === 'about:blank') return prev;
  let host = url;
  try { host = new URL(url).hostname.replace(/^www\./, ''); } catch {}
  if (prev.length > 0 && prev[0].url === url) return prev;
  const entry: HistoryEntry = { id: Math.random().toString(36).slice(2), url, host, timestamp: Date.now() };
  const max = limit === -1 ? 9999 : limit;
  return [entry, ...prev].slice(0, max);
}

// Apply theme to document
function applyTheme(theme: string, accentColor: string) {
  const root = document.documentElement;
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    root.setAttribute('data-theme', theme);
  }
  root.style.setProperty('--accent', accentColor);
  // Derive glow + dim from accent
  root.style.setProperty('--accent-glow', accentColor + '40');
  root.style.setProperty('--accent-dim', accentColor + '18');
}

// Volume visualizer bars component
const VolBars: React.FC<{ active: boolean }> = ({ active }) => (
  <div className={`vol-bars${active ? ' vol-bars--active' : ''}`}>
    <span className="vb" style={{ '--d': '0ms' } as any} />
    <span className="vb" style={{ '--d': '120ms' } as any} />
    <span className="vb" style={{ '--d': '60ms' } as any} />
  </div>
);

const App: React.FC = () => {
  const { settings, updateSettings } = useSettings();

  // ── Layout state ───────────────────────────────────────────
  const ratioFromLayout = (l: string) => parseInt(l, 10) || 50;
  const [splitRatio, setSplitRatio] = useState<number>(() => ratioFromLayout(settings.defaultLayout));
  const [activePanel, setActivePanel] = useState<Panel>(settings.defaultActivePanel);
  const [isDragging, setIsDragging] = useState(false);
  const [isFullscreenA, setIsFullscreenA] = useState(false);
  const [isFullscreenB, setIsFullscreenB] = useState(false);

  // ── Browser state ──────────────────────────────────────────
  const [urlA, setUrlA] = useState('');
  const [urlB, setUrlB] = useState('');
  const [titleA, setTitleA] = useState('');
  const [titleB, setTitleB] = useState('');
  const [mutedA, setMutedA] = useState(settings.defaultMutedScreen === 'A');
  const [mutedB, setMutedB] = useState(settings.defaultMutedScreen === 'B');
  const [volumeA, setVolumeA] = useState(settings.defaultVolumeA);
  const [volumeB, setVolumeB] = useState(settings.defaultVolumeB);
  const [inputA, setInputA] = useState('');
  const [inputB, setInputB] = useState('');
  const [focusedA, setFocusedA] = useState(false);
  const [focusedB, setFocusedB] = useState(false);
  const [historyA, setHistoryA] = useState<HistoryEntry[]>(() => loadHistory('A'));
  const [historyB, setHistoryB] = useState<HistoryEntry[]>(() => loadHistory('B'));

  // ── UI state ───────────────────────────────────────────────────
  const [showSettings, setShowSettings] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(!settings.onboardingComplete);
  const [showMultiMonitor, setShowMultiMonitor] = useState(false);
  const [multiMonitorActive, setMultiMonitorActive] = useState(false);
  const [editingLabelA, setEditingLabelA] = useState(false);
  const [editingLabelB, setEditingLabelB] = useState(false);
  const [draftLabelA, setDraftLabelA] = useState(settings.panelLabelA);
  const [draftLabelB, setDraftLabelB] = useState(settings.panelLabelB);
  const inputARef = useRef<HTMLInputElement>(null);
  const inputBRef = useRef<HTMLInputElement>(null);

  // ── Update banner ─────────────────────────────────────────
  const [updateInfo, setUpdateInfo] = useState<{ version: string; url: string } | null>(null);


  // ── Auto-hide toolbar ─────────────────────────────────────────
  const [toolbarVisibleA, setToolbarVisibleA] = useState(true);
  const [toolbarVisibleB, setToolbarVisibleB] = useState(true);
  const hideTimerA = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerB = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToolbar = (panel: Panel) => {
    if (panel === 'A') { if (hideTimerA.current) clearTimeout(hideTimerA.current); setToolbarVisibleA(true); }
    else               { if (hideTimerB.current) clearTimeout(hideTimerB.current); setToolbarVisibleB(true); }
  };
  const scheduleHide = (panel: Panel) => {
    if (!settings.autoHideToolbar) return;
    const timer = setTimeout(() => {
      if (panel === 'A') setToolbarVisibleA(false);
      else               setToolbarVisibleB(false);
    }, 1500);
    if (panel === 'A') hideTimerA.current = timer;
    else               hideTimerB.current = timer;
  };

  // ── Layout preset management ──────────────────────────────────
  const [savingPreset, setSavingPreset] = useState(false);
  const [presetName, setPresetName] = useState('');

  const saveCurrentPreset = () => {
    const name = presetName.trim() || `${Math.round(splitRatio)}/${Math.round(100 - splitRatio)}`;
    const newPreset: LayoutPreset = { id: Date.now().toString(36), name, ratio: Math.round(splitRatio) };
    updateSettings({ layoutPresets: [...(settings.layoutPresets ?? DEFAULT_LAYOUT_PRESETS), newPreset] });
    window.duvoApi.phCapture?.('feature_used', { feature: 'layout_preset_saved', ratio: Math.round(splitRatio) });
    setSavingPreset(false); setPresetName('');
  };


  const deletePreset = (id: string) => {
    updateSettings({ layoutPresets: (settings.layoutPresets ?? DEFAULT_LAYOUT_PRESETS).filter(p => p.id !== id) });
  };

  const panelARef = useRef<HTMLDivElement>(null);
  const panelBRef = useRef<HTMLDivElement>(null);

  const isHomeA = !urlA || urlA === 'about:blank';
  const isHomeB = !urlB || urlB === 'about:blank';

  // ── Theme effect ───────────────────────────────────────────
  useEffect(() => {
    applyTheme(settings.theme, settings.accentColor);
  }, [settings.theme, settings.accentColor]);

  // System theme listener
  useEffect(() => {
    if (settings.theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('system', settings.accentColor);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [settings.theme, settings.accentColor]);

  // Apply theme on first mount immediately
  useEffect(() => {
    applyTheme(settings.theme, settings.accentColor);
  }, []); // eslint-disable-line

  // ── Bounds sync ─────────────────────────────────────────────
  const updateBounds = useCallback(() => {
    if (panelARef.current && panelBRef.current) {
      const rA = panelARef.current.getBoundingClientRect();
      const rB = panelBRef.current.getBoundingClientRect();
      window.duvoApi.updateBounds(
        isHomeA ? { x: 0, y: 0, width: 0, height: 0 }
                : { x: rA.left, y: rA.top, width: rA.width, height: rA.height },
        isHomeB ? { x: 0, y: 0, width: 0, height: 0 }
                : { x: rB.left, y: rB.top, width: rB.width, height: rB.height },
      );
    }
  }, [isHomeA, isHomeB]);

  useEffect(() => {
    updateBounds();
    window.addEventListener('resize', updateBounds);
    const obsA = panelARef.current ? new ResizeObserver(updateBounds) : null;
    const obsB = panelBRef.current ? new ResizeObserver(updateBounds) : null;
    obsA?.observe(panelARef.current!);
    obsB?.observe(panelBRef.current!);
    return () => {
      window.removeEventListener('resize', updateBounds);
      obsA?.disconnect(); obsB?.disconnect();
    };
  }, [splitRatio, activePanel, isFullscreenA, isFullscreenB, urlA, urlB, updateBounds]);

  // ── Drag divider ───────────────────────────────────────────
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const next = (e.clientX / window.innerWidth) * 100;
      setSplitRatio(Math.min(Math.max(next, 20), 80));
    };
    const onUp = () => { if (isDragging) setIsDragging(false); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [isDragging]);

  // ── IPC listeners (registered once) ───────────────────────
  const activePanelRef = useRef(activePanel);
  const mutedARef = useRef(mutedA);
  const mutedBRef = useRef(mutedB);
  const settingsRef = useRef(settings);
  useEffect(() => { activePanelRef.current = activePanel; }, [activePanel]);
  useEffect(() => { mutedARef.current = mutedA; }, [mutedA]);
  useEffect(() => { mutedBRef.current = mutedB; }, [mutedB]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  // Sync ad-blocking setting to main process (on mount + on change)
  useEffect(() => {
    window.duvoApi.setAdBlocking(settings.blockAds);
  }, [settings.blockAds]);

  // Sync notification block setting to main process
  useEffect(() => {
    window.duvoApi.setNotificationBlock(settings.blockNotifications);
  }, [settings.blockNotifications]);


  // Listen for update notifications from main process
  useEffect(() => {
    const off = window.duvoApi.onUpdateAvailable?.((version: string, url: string) => {
      setUpdateInfo({ version, url });
    });
    return () => off?.();
  }, []);

  useEffect(() => {
    const offUrl = window.duvoApi.onUrlChanged((panelId: Panel, url: string) => {
      if (url === 'about:blank') return;
      const limit = settingsRef.current.historyLimit;
      if (panelId === 'A') {
        setUrlA(url); setInputA(url);
        setHistoryA(prev => { const next = addHistoryEntry(prev, url, limit); persistHistory('A', next); return next; });
      } else {
        setUrlB(url); setInputB(url);
        setHistoryB(prev => { const next = addHistoryEntry(prev, url, limit); persistHistory('B', next); return next; });
      }
    });

    const offTitle = window.duvoApi.onPageTitle((panelId: Panel, title: string) => {
      if (panelId === 'A') setTitleA(title);
      else setTitleB(title);
    });

    const offFocus = window.duvoApi.onFocusShortcut(() => {
      setActivePanel(p => p === 'A' ? 'B' : 'A');
    });

    const offAddrBar = window.duvoApi.onAddressBarShortcut(() => {
      const panel = activePanelRef.current;
      if (panel === 'A') inputARef.current?.focus();
      else inputBRef.current?.focus();
    });

    const offMute = window.duvoApi.onMuteShortcut(() => {
      const panel = activePanelRef.current;
      if (panel === 'A') setMutedA(m => { const n = !m; window.duvoApi.setMute('A', n); return n; });
      else setMutedB(m => { const n = !m; window.duvoApi.setMute('B', n); return n; });
    });

    const offReload = window.duvoApi.onReloadShortcut(() => {
      window.duvoApi.reload(activePanelRef.current);
    });

    const offHome = window.duvoApi.onHomeShortcut(() => {
      const panel = activePanelRef.current;
      if (panel === 'A') { setUrlA(''); setInputA(''); setTitleA(''); }
      else { setUrlB(''); setInputB(''); setTitleB(''); }
    });

    const offMmClosed = window.duvoApi.onMultiMonitorClosed?.(() => {
      setMultiMonitorActive(false);
    }) ?? (() => {});

    const offFs = window.duvoApi.onFullscreenState((panelId: Panel, fs: boolean) => {
      if (panelId === 'A') setIsFullscreenA(fs);
      else setIsFullscreenB(fs);
    });

    window.duvoApi.setMute('A', mutedARef.current);
    window.duvoApi.setVolume('A', volumeA);
    window.duvoApi.setMute('B', mutedBRef.current);
    window.duvoApi.setVolume('B', volumeB);

    return () => { offUrl(); offTitle(); offFocus(); offAddrBar(); offMute(); offReload(); offHome(); offMmClosed(); offFs(); };
  }, []); // eslint-disable-line

  // ── Navigation ─────────────────────────────────────────────
  const navigate = (panelId: Panel, rawInput: string) => {
    const url = resolveUrl(rawInput, settings.searchEngine);
    if (!url) return;
    if (panelId === 'A') { setInputA(url); setUrlA(url); setTitleA(''); }
    else { setInputB(url); setUrlB(url); setTitleB(''); }
    window.duvoApi.loadUrl(panelId, url);
  };

  const handleSubmitA = (e: React.FormEvent) => { e.preventDefault(); navigate('A', inputA); setFocusedA(false); };
  const handleSubmitB = (e: React.FormEvent) => { e.preventDefault(); navigate('B', inputB); setFocusedB(false); };

  const goHome = (panelId: Panel) => {
    if (panelId === 'A') { setUrlA(''); setInputA(''); setTitleA(''); }
    else { setUrlB(''); setInputB(''); setTitleB(''); }
  };

  const handleVolumeChange = (panelId: Panel, e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const vol = parseFloat(e.target.value);
    if (panelId === 'A') { setVolumeA(vol); window.duvoApi.setVolume('A', vol); }
    else { setVolumeB(vol); window.duvoApi.setVolume('B', vol); }
  };

  // ── Layout preset click (smooth transition via CSS class) ──
  const setLayoutPreset = (ratio: number) => {
    document.documentElement.classList.add('layout-transitioning');
    setSplitRatio(ratio);
    setTimeout(() => document.documentElement.classList.remove('layout-transitioning'), 300);
  };

  const openMultiMonitor = async () => {
    setShowMultiMonitor(true);
  };

  const closeMultiMonitor = () => {
    window.duvoApi.closeMultiMonitor?.();
    setMultiMonitorActive(false);
  };

  const saveLabelA = () => {
    updateSettings({ panelLabelA: draftLabelA || 'Screen A' });
    setEditingLabelA(false);
  };
  const saveLabelB = () => {
    updateSettings({ panelLabelB: draftLabelB || 'Screen B' });
    setEditingLabelB(false);
  };

  // ── Theme toggle ───────────────────────────────────────────
  const toggleTheme = () => {
    const next = settings.theme === 'dark' ? 'light' : 'dark';
    updateSettings({ theme: next });
  };

  const flexA = splitRatio;
  const flexB = 100 - splitRatio;

  return (
    <div className={`root${isDragging ? ' dragging' : ''}`}>
      {isDragging && <div className="drag-shield" />}

      {/* Custom Windows title bar — only rendered on Windows (frame: false) */}
      {(window as any).duvoApi?.platform === 'win32' && <WinTitleBar />}

      {/* Onboarding overlay */}
      {showOnboarding && (
        <Onboarding onComplete={() => {
          setShowOnboarding(false);
          updateSettings({ onboardingComplete: true });
        }} />
      )}

      {/* Settings overlay */}
      {showSettings && (
        <Settings
          settings={settings}
          onUpdate={updateSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* ── Window chrome ── */}
      <header className="chrome">
        <div className="drag-zone" />

        <div className="chrome-brand">
          <img src={duvoIcon} alt="" className="chrome-logo" />
          <span className="chrome-title">Duvo Dual</span>
        </div>

        <nav className="layout-switcher no-drag">
          {(settings.layoutPresets ?? DEFAULT_LAYOUT_PRESETS).map(preset => (
            <div key={preset.id} className="layout-preset-wrap">
              <button
                className={`layout-btn${Math.round(splitRatio) === preset.ratio ? ' active' : ''}`}
                onClick={() => setLayoutPreset(preset.ratio)}
                title={preset.name}>
                <span className="layout-preview">
                  <span className="lp-a" style={{ flex: preset.ratio }} />
                  <span className="lp-b" style={{ flex: 100 - preset.ratio }} />
                </span>
                <span className="layout-btn-name">{preset.name}</span>
              </button>
              <button className="layout-preset-del" onClick={() => deletePreset(preset.id)} title="Remove preset">
                <X size={8} />
              </button>
            </div>
          ))}

          {/* Save current split as preset */}
          {savingPreset ? (
            <form className="layout-save-form" onSubmit={e => { e.preventDefault(); saveCurrentPreset(); }}>
              <input
                autoFocus
                className="layout-save-input"
                placeholder={`${Math.round(splitRatio)}/${Math.round(100 - splitRatio)}`}
                value={presetName}
                onChange={e => setPresetName(e.target.value)}
                onBlur={() => { setSavingPreset(false); setPresetName(''); }}
                onKeyDown={e => e.key === 'Escape' && (setSavingPreset(false), setPresetName(''))}
              />
            </form>
          ) : (
            <button className="layout-btn layout-btn--add" onClick={() => setSavingPreset(true)} title="Save current split as preset">
              <Plus size={11} />
            </button>
          )}
        </nav>

        {/* Chrome actions */}
        <div className="chrome-actions no-drag">
          <button className="chrome-btn" onClick={toggleTheme} title="Toggle theme">
            {settings.theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
          </button>
          <button
            className={`chrome-btn${multiMonitorActive ? ' chrome-btn--active' : ''}`}
            onClick={multiMonitorActive ? closeMultiMonitor : openMultiMonitor}
            title={multiMonitorActive ? 'Exit Multi-Monitor' : 'Multi-Monitor Mode'}>
            <Monitor size={13} />
          </button>
          <button className="chrome-btn" onClick={() => setShowSettings(s => !s)} title="Settings">
            <SettingsIcon size={13} />
          </button>
        </div>
      </header>

      {/* ── Update banner ── */}
      {updateInfo && (
        <div className="update-banner">
          <span className="update-banner-text">
            🎉 Duvo Dual <strong>v{updateInfo.version}</strong> is available
          </span>
          <button
            className="update-banner-dl"
            onClick={() => window.duvoApi.openReleasesPage(updateInfo.url)}>
            Download Update
          </button>
          <button className="update-banner-dismiss" onClick={() => setUpdateInfo(null)}>
            <X size={12} />
          </button>
        </div>
      )}

      {/* ── Workspace ── */}

      <main className="workspace">

        {/* Panel A */}
        <div
          className={`panel${activePanel === 'A' ? ' panel--active' : ' panel--inactive'}`}
          style={{ flex: `${flexA} 1 0%` }}
          onClick={() => setActivePanel('A')}
          onMouseEnter={() => showToolbar('A')}
          onMouseLeave={() => scheduleHide('A')}>

          {!isFullscreenA && (
            <div
              className={`panel-bar no-drag${settings.autoHideToolbar && !toolbarVisibleA ? ' panel-bar--hidden' : ''}`}
              onClick={e => e.stopPropagation()}
              onMouseEnter={() => showToolbar('A')}>
              {/* Editable label */}
              {editingLabelA ? (
                <form className="panel-label-form" onSubmit={e => { e.preventDefault(); saveLabelA(); }}>
                  <input autoFocus className="panel-label-input" value={draftLabelA}
                    onChange={e => setDraftLabelA(e.target.value)}
                    onBlur={saveLabelA} onKeyDown={e => e.key === 'Escape' && setEditingLabelA(false)} />
                  <button type="submit" className="bar-btn"><Check size={11} /></button>
                </form>
              ) : (
                <span className="panel-label" onDoubleClick={() => { setDraftLabelA(settings.panelLabelA); setEditingLabelA(true); }} title="Double-click to rename">
                  {settings.panelLabelA}
                  <Pencil size={9} className="panel-label-edit-icon" />
                </span>
              )}
              <div className="bar-sep" />
              <button className="bar-btn" onClick={() => goHome('A')} title="Home"><Home size={13} /></button>
              <button className="bar-btn" onClick={() => window.duvoApi.goBack('A')} title="Back"><ArrowLeft size={13} /></button>
              <button className="bar-btn" onClick={() => window.duvoApi.goForward('A')} title="Forward"><ArrowRight size={13} /></button>
              <button className="bar-btn" onClick={() => window.duvoApi.reload('A')} title="Reload"><RotateCcw size={13} /></button>

              <form className={`url-pill${focusedA ? ' url-pill--focused' : ''}`} onSubmit={handleSubmitA}>
                <Globe size={12} className="url-icon" />
                <input ref={inputARef} type="text" className="url-input"
                  value={focusedA ? inputA : (titleA || inputA)}
                  onChange={e => setInputA(e.target.value)}
                  onFocus={() => { setFocusedA(true); setActivePanel('A'); setInputA(inputA); }}
                  onBlur={() => setFocusedA(false)}
                  placeholder="Search or enter address" spellCheck={false} />
              </form>

              <div className="bar-right">
                <VolBars active={!mutedA && !!urlA && urlA !== 'about:blank'} />
                <input type="range" min={0} max={1} step={0.05} value={volumeA}
                  onChange={e => handleVolumeChange('A', e)}
                  onClick={e => e.stopPropagation()}
                  className="vol-slider" title="Volume" />
                <button
                  className={`bar-btn${mutedA || volumeA === 0 ? ' bar-btn--muted' : ''}`}
                  onClick={() => { setMutedA(!mutedA); window.duvoApi.setMute('A', !mutedA); }}
                  title={mutedA ? 'Unmute' : 'Mute'}>
                  {mutedA || volumeA === 0 ? <VolumeX size={13} /> : <Volume2 size={13} />}
                </button>
              </div>
            </div>
          )}

          <div className="panel-canvas" ref={panelARef}>
            {isHomeA && (
              <NewTab panelId="A" panelLabel={settings.panelLabelA} onNavigate={url => navigate('A', url)}
                history={historyA}
                onDeleteHistory={id => setHistoryA(prev => { const n = prev.filter(e => e.id !== id); persistHistory('A', n); return n; })}
                onClearHistory={() => { setHistoryA([]); persistHistory('A', []); }} />
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="split-handle" onMouseDown={e => { e.preventDefault(); setIsDragging(true); }}>
          <div className="split-handle-bar" />
        </div>

        {/* Panel B */}
        <div
          className={`panel${activePanel === 'B' ? ' panel--active' : ' panel--inactive'}`}
          style={{ flex: `${flexB} 1 0%` }}
          onClick={() => setActivePanel('B')}
          onMouseEnter={() => showToolbar('B')}
          onMouseLeave={() => scheduleHide('B')}>

          {!isFullscreenB && (
            <div
              className={`panel-bar no-drag${settings.autoHideToolbar && !toolbarVisibleB ? ' panel-bar--hidden' : ''}`}
              onClick={e => e.stopPropagation()}
              onMouseEnter={() => showToolbar('B')}>
              {/* Editable label */}
              {editingLabelB ? (
                <form className="panel-label-form" onSubmit={e => { e.preventDefault(); saveLabelB(); }}>
                  <input autoFocus className="panel-label-input" value={draftLabelB}
                    onChange={e => setDraftLabelB(e.target.value)}
                    onBlur={saveLabelB} onKeyDown={e => e.key === 'Escape' && setEditingLabelB(false)} />
                  <button type="submit" className="bar-btn"><Check size={11} /></button>
                </form>
              ) : (
                <span className="panel-label" onDoubleClick={() => { setDraftLabelB(settings.panelLabelB); setEditingLabelB(true); }} title="Double-click to rename">
                  {settings.panelLabelB}
                  <Pencil size={9} className="panel-label-edit-icon" />
                </span>
              )}
              <div className="bar-sep" />
              <button className="bar-btn" onClick={() => goHome('B')} title="Home"><Home size={13} /></button>
              <button className="bar-btn" onClick={() => window.duvoApi.goBack('B')} title="Back"><ArrowLeft size={13} /></button>
              <button className="bar-btn" onClick={() => window.duvoApi.goForward('B')} title="Forward"><ArrowRight size={13} /></button>
              <button className="bar-btn" onClick={() => window.duvoApi.reload('B')} title="Reload"><RotateCcw size={13} /></button>

              <form className={`url-pill${focusedB ? ' url-pill--focused' : ''}`} onSubmit={handleSubmitB}>
                <Globe size={12} className="url-icon" />
                <input ref={inputBRef} type="text" className="url-input"
                  value={focusedB ? inputB : (titleB || inputB)}
                  onChange={e => setInputB(e.target.value)}
                  onFocus={() => { setFocusedB(true); setActivePanel('B'); setInputB(inputB); }}
                  onBlur={() => setFocusedB(false)}
                  placeholder="Search or enter address" spellCheck={false} />
              </form>

              <div className="bar-right">
                <VolBars active={!mutedB && !!urlB && urlB !== 'about:blank'} />
                <input type="range" min={0} max={1} step={0.05} value={volumeB}
                  onChange={e => handleVolumeChange('B', e)}
                  onClick={e => e.stopPropagation()}
                  className="vol-slider" title="Volume" />
                <button
                  className={`bar-btn${mutedB || volumeB === 0 ? ' bar-btn--muted' : ''}`}
                  onClick={() => { setMutedB(!mutedB); window.duvoApi.setMute('B', !mutedB); }}
                  title={mutedB ? 'Unmute' : 'Mute'}>
                  {mutedB || volumeB === 0 ? <VolumeX size={13} /> : <Volume2 size={13} />}
                </button>
              </div>
            </div>
          )}

          <div className="panel-canvas" ref={panelBRef}>
            {isHomeB && (
              <NewTab panelId="B" panelLabel={settings.panelLabelB} onNavigate={url => navigate('B', url)}
                history={historyB}
                onDeleteHistory={id => setHistoryB(prev => { const n = prev.filter(e => e.id !== id); persistHistory('B', n); return n; })}
                onClearHistory={() => { setHistoryB([]); persistHistory('B', []); }} />
            )}
          </div>
        </div>

      </main>

      {/* Multi-Monitor Modal */}
      {showMultiMonitor && (
        <MultiMonitorModal
          onClose={() => setShowMultiMonitor(false)}
          onActivate={(displayIdA, displayIdB) => {
            setShowMultiMonitor(false);
            setMultiMonitorActive(true);
            window.duvoApi.openMultiMonitor?.(displayIdA, displayIdB);
          }}
        />
      )}
    </div>
  );
};

// ── Multi-Monitor Picker Modal ────────────────────────────────
const MultiMonitorModal: React.FC<{
  onClose: () => void;
  onActivate: (displayIdA: number, displayIdB: number) => void;
}> = ({ onClose, onActivate }) => {
  const [displays, setDisplays] = useState<any[]>([]);
  const [selA, setSelA] = useState<number | null>(null);
  const [selB, setSelB] = useState<number | null>(null);

  useEffect(() => {
    window.duvoApi.getDisplays?.().then((d: any[]) => {
      setDisplays(d);
      if (d.length >= 1) setSelA(d[0].id);
      if (d.length >= 2) setSelB(d[1].id);
    });
  }, []);

  const canActivate = selA !== null && selB !== null && selA !== selB;

  return (
    <div className="mm-overlay" onClick={onClose}>
      <div className="mm-modal" onClick={e => e.stopPropagation()}>
        <div className="mm-header">
          <Monitor size={16} />
          <span>Multi-Monitor Mode</span>
        </div>
        {displays.length < 2 ? (
          <div className="mm-warn">
            <p>Only <strong>{displays.length}</strong> display detected.</p>
            <p className="mm-warn-sub">Connect a second monitor to use this feature.</p>
          </div>
        ) : (
          <>
            <p className="mm-desc">Each screen opens fullscreen on its assigned display.</p>
            <div className="mm-rows">
              {(['A', 'B'] as const).map(panel => {
                const sel = panel === 'A' ? selA : selB;
                const setSel = panel === 'A' ? setSelA : setSelB;
                return (
                  <div key={panel} className="mm-row">
                    <span className="mm-panel-label">Screen {panel}</span>
                    <div className="mm-display-list">
                      {displays.map(d => (
                        <button key={d.id}
                          className={`mm-display-btn${sel === d.id ? ' mm-display-btn--active' : ''}`}
                          onClick={() => setSel(d.id)}>
                          {d.primary ? '⊞ Primary' : '⊟ Display'} ({d.bounds.width}×{d.bounds.height})
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
        <div className="mm-footer">
          <button className="mm-btn-cancel" onClick={onClose}>Cancel</button>
          {displays.length >= 2 && (
            <button className="mm-btn-activate" disabled={!canActivate}
              onClick={() => canActivate && onActivate(selA!, selB!)}>
              Launch on Displays
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;

