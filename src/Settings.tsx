/**
 * Duvo Dual — Settings Panel
 * Copyright © 2026 MavTiN. All rights reserved.
 * https://github.com/mavtin/Duvo-Dual
 */
import React, { useEffect, useState } from 'react';

import {
  X, SlidersHorizontal, Volume2, Globe, Palette,
  Keyboard, Shield, Check, Trash2,
} from 'lucide-react';
import { AppSettings, ACCENT_PRESETS, Shortcuts } from './useSettings';

// ── Types ─────────────────────────────────────────────────────
interface Props {
  settings: AppSettings;
  onUpdate: (patch: Partial<AppSettings>) => void;
  onClose: () => void;
}
type Tab = 'general' | 'audio' | 'browser' | 'appearance' | 'shortcuts' | 'privacy';
interface TabProps { s: AppSettings; onUpdate: (p: Partial<AppSettings>) => void; }

// ── Shared sub-components ─────────────────────────────────────
const Row: React.FC<{ label: string; desc?: string; children: React.ReactNode }> = ({ label, desc, children }) => (
  <div className="s-row">
    <div className="s-row-label">
      <span className="s-label">{label}</span>
      {desc && <span className="s-desc">{desc}</span>}
    </div>
    <div className="s-row-control">{children}</div>
  </div>
);

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({ checked, onChange }) => (
  <button className={`s-toggle${checked ? ' s-toggle--on' : ''}`} onClick={() => onChange(!checked)}>
    <span className="s-toggle-knob" />
  </button>
);

const SegGroup: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="s-seg-group">{children}</div>
);

const SegBtn: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button className={`s-seg-btn${active ? ' s-seg-btn--active' : ''}`} onClick={onClick}>{children}</button>
);

// ── Tabs ──────────────────────────────────────────────────────
const GeneralTab: React.FC<TabProps> = ({ s, onUpdate }) => (
  <div className="s-section">
    <h3 className="s-section-title">General</h3>
    <Row label="Default Layout" desc="Panel split ratio on launch">
      <SegGroup>
        {(['50', '70', '30'] as const).map(l => (
          <SegBtn key={l} active={s.defaultLayout === l} onClick={() => onUpdate({ defaultLayout: l })}>
            {l === '50' ? '50 / 50' : l === '70' ? '70 / 30' : '30 / 70'}
          </SegBtn>
        ))}
      </SegGroup>
    </Row>
    <Row label="Default Active Screen" desc="Which screen starts focused">
      <SegGroup>
        {(['A', 'B'] as const).map(p => (
          <SegBtn key={p} active={s.defaultActivePanel === p} onClick={() => onUpdate({ defaultActivePanel: p })}>
            Screen {p}
          </SegBtn>
        ))}
      </SegGroup>
    </Row>
    <Row label="Screen A Label" desc="Name shown in the toolbar">
      <input className="s-text-input"
        defaultValue={s.panelLabelA}
        onBlur={e => onUpdate({ panelLabelA: e.target.value || 'Screen A' })}
        placeholder="Screen A" maxLength={20} />
    </Row>
    <Row label="Screen B Label" desc="Name shown in the toolbar">
      <input className="s-text-input"
        defaultValue={s.panelLabelB}
        onBlur={e => onUpdate({ panelLabelB: e.target.value || 'Screen B' })}
        placeholder="Screen B" maxLength={20} />
    </Row>
    <Row label="Launch at Login" desc="Start Duvo Dual when you log in">
      <Toggle checked={s.launchAtLogin} onChange={v => {
        onUpdate({ launchAtLogin: v });
        (window as any).duvoApi?.setLoginItem?.(v);
      }} />
    </Row>
  </div>
);

const AudioTab: React.FC<TabProps> = ({ s, onUpdate }) => (
  <div className="s-section">
    <h3 className="s-section-title">Audio</h3>
    <Row label="Mute on Launch" desc="Which screen starts muted">
      <SegGroup>
        {(['A', 'B', 'none'] as const).map(m => (
          <SegBtn key={m} active={s.defaultMutedScreen === m} onClick={() => onUpdate({ defaultMutedScreen: m })}>
            {m === 'none' ? 'None' : `Screen ${m}`}
          </SegBtn>
        ))}
      </SegGroup>
    </Row>
    <Row label="Screen A — Default Volume">
      <div className="s-vol-row">
        <input type="range" min={0} max={1} step={0.05} className="s-slider"
          value={s.defaultVolumeA} onChange={e => onUpdate({ defaultVolumeA: parseFloat(e.target.value) })} />
        <span className="s-vol-pct">{Math.round(s.defaultVolumeA * 100)}%</span>
      </div>
    </Row>
    <Row label="Screen B — Default Volume">
      <div className="s-vol-row">
        <input type="range" min={0} max={1} step={0.05} className="s-slider"
          value={s.defaultVolumeB} onChange={e => onUpdate({ defaultVolumeB: parseFloat(e.target.value) })} />
        <span className="s-vol-pct">{Math.round(s.defaultVolumeB * 100)}%</span>
      </div>
    </Row>
  </div>
);

const BrowserTab: React.FC<TabProps> = ({ s, onUpdate }) => {
  const engines = [
    { id: 'google' as const,     label: 'Google' },
    { id: 'duckduckgo' as const, label: 'DuckDuckGo' },
    { id: 'bing' as const,       label: 'Bing' },
    { id: 'brave' as const,      label: 'Brave' },
  ];
  return (
    <div className="s-section">
      <h3 className="s-section-title">Browser</h3>
      <Row label="Default Search Engine">
        <div className="s-engine-list">
          {engines.map(e => (
            <button key={e.id}
              className={`s-engine-btn${s.searchEngine === e.id ? ' s-engine-btn--active' : ''}`}
              onClick={() => onUpdate({ searchEngine: e.id })}>
              {s.searchEngine === e.id && <Check size={10} />}
              {e.label}
            </button>
          ))}
        </div>
      </Row>
      <Row label="Isolate Screen Sessions" desc="Each screen keeps separate logins. Restart required.">
        <Toggle checked={s.isolatePanelSessions} onChange={v => {
          onUpdate({ isolatePanelSessions: v });
          (window as any).duvoApi?.setSessionIsolation?.(v);
        }} />
      </Row>
      <Row label="Block Ads & Trackers" desc="Blocks common ad networks on streaming sites">
        <Toggle checked={s.blockAds} onChange={v => {
          onUpdate({ blockAds: v });
          (window as any).duvoApi?.setAdBlocking?.(v);
        }} />
      </Row>
      <Row label="Block Notification Popups" desc={'Silently deny all "Allow Notifications?" requests'}>
        <Toggle checked={s.blockNotifications} onChange={v => {
          onUpdate({ blockNotifications: v });
          (window as any).duvoApi?.setNotificationBlock?.(v);
        }} />
      </Row>
      <Row label="Allow Autoplay" desc="Let videos play without interaction">
        <Toggle checked={s.allowAutoplay} onChange={v => onUpdate({ allowAutoplay: v })} />
      </Row>
      <Row label="History Limit" desc="Max entries per screen">
        <SegGroup>
          {([50, 100, 500, -1] as const).map(l => (
            <SegBtn key={l} active={s.historyLimit === l} onClick={() => onUpdate({ historyLimit: l })}>
              {l === -1 ? '∞' : l}
            </SegBtn>
          ))}
        </SegGroup>
      </Row>
    </div>
  );
};

const AppearanceTab: React.FC<TabProps> = ({ s, onUpdate }) => (
  <div className="s-section">
    <h3 className="s-section-title">Appearance</h3>
    <Row label="Theme">
      <SegGroup>
        {(['dark', 'light', 'system'] as const).map(t => (
          <SegBtn key={t} active={s.theme === t} onClick={() => onUpdate({ theme: t })}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </SegBtn>
        ))}
      </SegGroup>
    </Row>
    <Row label="Accent Color">
      <div className="s-accent-presets">
        {ACCENT_PRESETS.map(p => (
          <button key={p.value} title={p.name}
            className={`s-accent-chip${s.accentColor === p.value ? ' s-accent-chip--active' : ''}`}
            style={{ background: p.value }}
            onClick={() => onUpdate({ accentColor: p.value })}>
            {s.accentColor === p.value && <Check size={10} style={{ color: '#fff' }} />}
          </button>
        ))}
      </div>
    </Row>
    <Row label="Auto-hide Toolbar" desc="Panel bars slide away after 1.5s of inactivity">
      <Toggle checked={s.autoHideToolbar} onChange={v => onUpdate({ autoHideToolbar: v })} />
    </Row>
  </div>
);

const SHORTCUT_DEFS: { key: keyof Shortcuts; label: string; desc: string }[] = [
  { key: 'switchPanel',     label: 'Switch Active Screen', desc: 'Inside stream view' },
  { key: 'toggleMute',      label: 'Toggle Mute',          desc: 'Inside stream view' },
  { key: 'focusAddressBar', label: 'Focus Address Bar',    desc: 'Cmd + key' },
  { key: 'reload',          label: 'Reload Active Screen', desc: 'Cmd + key' },
  { key: 'goHome',          label: 'Go Home',              desc: 'Cmd + key' },
];

const ShortcutsTab: React.FC<TabProps> = ({ s, onUpdate }) => {
  const [recording, setRecording] = useState<keyof Shortcuts | null>(null);

  useEffect(() => {
    if (!recording) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') { setRecording(null); return; }
      const next = { ...s.shortcuts, [recording]: e.key };
      onUpdate({ shortcuts: next });
      (window as any).duvoApi?.updateShortcuts?.(next);
      setRecording(null);
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [recording, s.shortcuts, onUpdate]);

  return (
    <div className="s-section">
      <h3 className="s-section-title">Keyboard Shortcuts</h3>
      <p className="s-hint">Click a key badge then press a new key to remap. Esc to cancel.</p>
      <div className="s-shortcuts-list">
        {SHORTCUT_DEFS.map(({ key, label, desc }) => (
          <div key={key} className="s-shortcut-row">
            <div className="s-shortcut-info">
              <span className="s-shortcut-label">{label}</span>
              <span className="s-shortcut-desc">{desc}</span>
            </div>
            <button
              className={`s-key-badge${recording === key ? ' s-key-badge--recording' : ''}`}
              onClick={() => setRecording(key)}>
              {recording === key ? 'Press a key…' : s.shortcuts[key]}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

const PrivacyTab: React.FC = () => {
  const [done, setDone] = useState<string | null>(null);

  const act = (id: string, fn: () => void) => {
    fn();
    setDone(id);
    setTimeout(() => setDone(null), 1200);
  };

  return (
    <div className="s-section">
      <h3 className="s-section-title">Privacy & Data</h3>
      <div className="s-privacy-list">
        <PrivacyBtn id="history" done={done}
          label="Clear History"
          desc="Remove all browsing history from both screens"
          onClick={() => act('history', () => {
            localStorage.removeItem('duvo-history-A');
            localStorage.removeItem('duvo-history-B');
          })} />
        <PrivacyBtn id="bookmarks" done={done}
          label="Clear Bookmarks"
          desc="Reset bookmarks to defaults"
          onClick={() => act('bookmarks', () => localStorage.removeItem('duvo-bookmarks'))} />
        <PrivacyBtn id="cookies" done={done} danger
          label="Clear Cookies & Sessions"
          desc="Logs you out of all streaming sites"
          onClick={() => act('cookies', () => (window as any).duvoApi?.clearCookies?.())} />
        <PrivacyBtn id="reset" done={done} danger
          label="Reset Everything"
          desc="Wipe all data and restart the app"
          onClick={() => act('reset', () => {
            localStorage.clear();
            setTimeout(() => (window as any).duvoApi?.resetApp?.(), 600);
          })} />
      </div>
    </div>
  );
};

const PrivacyBtn: React.FC<{
  id: string; done: string | null; label: string; desc: string;
  danger?: boolean; onClick: () => void;
}> = ({ id, done, label, desc, danger, onClick }) => (
  <div className="s-privacy-row">
    <div className="s-shortcut-info">
      <span className="s-shortcut-label">{label}</span>
      <span className="s-shortcut-desc">{desc}</span>
    </div>
    <button className={`s-privacy-btn${danger ? ' s-privacy-btn--danger' : ''}${done === id ? ' s-privacy-btn--done' : ''}`} onClick={onClick}>
      {done === id ? <Check size={13} /> : <Trash2 size={13} />}
      {done === id ? 'Done' : 'Clear'}
    </button>
  </div>
);

// ── Main Settings Panel ───────────────────────────────────────
const TABS: { id: Tab; label: string; Icon: React.FC<any> }[] = [
  { id: 'general',    label: 'General',    Icon: SlidersHorizontal },
  { id: 'audio',      label: 'Audio',      Icon: Volume2 },
  { id: 'browser',    label: 'Browser',    Icon: Globe },
  { id: 'appearance', label: 'Appearance', Icon: Palette },
  { id: 'shortcuts',  label: 'Shortcuts',  Icon: Keyboard },
  { id: 'privacy',    label: 'Privacy',    Icon: Shield },
];

const Settings: React.FC<Props> = ({ settings, onUpdate, onClose }) => {
  const [tab, setTab] = useState<Tab>('general');

  return (
    <div className="s-overlay" onClick={onClose}>
      <div className="s-panel" onClick={e => e.stopPropagation()}>
        <div className="s-header">
          <span className="s-title">Settings</span>
          <button className="s-close" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="s-body">
          <nav className="s-nav">
            {TABS.map(({ id, label, Icon }) => (
              <button key={id}
                className={`s-nav-item${tab === id ? ' s-nav-item--active' : ''}`}
                onClick={() => setTab(id)}>
                <Icon size={13} />
                {label}
              </button>
            ))}
          </nav>
          <div className="s-content">
            {tab === 'general'    && <GeneralTab    s={settings} onUpdate={onUpdate} />}
            {tab === 'audio'      && <AudioTab      s={settings} onUpdate={onUpdate} />}
            {tab === 'browser'    && <BrowserTab    s={settings} onUpdate={onUpdate} />}
            {tab === 'appearance' && <AppearanceTab s={settings} onUpdate={onUpdate} />}
            {tab === 'shortcuts'  && <ShortcutsTab  s={settings} onUpdate={onUpdate} />}
            {tab === 'privacy'    && <PrivacyTab />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
