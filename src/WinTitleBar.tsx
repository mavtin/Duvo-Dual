/**
 * Duvo Dual — Custom Windows Title Bar
 * Copyright © 2026 MavTiN. All rights reserved.
 * https://github.com/mavtin/Duvo-Dual
 *
 * Rendered only on Windows (frame: false). Provides draggable title bar,
 * Support dropdown menu, and native-feeling window controls.
 */
import React, { useEffect, useRef, useState } from 'react';
import duvoIcon from '../assets/icons/duvo-icon.png';

const api = (window as any).duvoApi;

export default function WinTitleBar() {
  const [maximized, setMaximized] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync maximized state
  useEffect(() => {
    api.isMaximized().then((m: boolean) => setMaximized(m));
    const unsub = api.onMaximizeChange((m: boolean) => setMaximized(m));
    return unsub;
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setSupportOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const openFeedback = () => {
    setSupportOpen(false);
    api.openReleasesPage('https://github.com/mavtin/Duvo-Dual/issues/new');
  };

  const checkUpdates = () => {
    setSupportOpen(false);
    // Reuse the same IPC the macOS menu uses
    api.openReleasesPage('https://github.com/mavtin/Duvo-Dual/releases');
  };

  const showAbout = () => {
    setSupportOpen(false);
    api.showAbout();
  };

  return (
    <div className="win-titlebar" id="win-titlebar">
      {/* ── Left: drag region + branding ── */}
      <div className="win-titlebar-drag">
        <img src={duvoIcon} className="win-titlebar-icon" alt="Duvo Dual" />
        <span className="win-titlebar-title">Duvo Dual</span>
      </div>

      {/* ── Center: purely drag ── */}
      <div className="win-titlebar-spacer" />

      {/* ── Right: Support menu + window controls ── */}
      <div className="win-titlebar-right">
        {/* Support dropdown */}
        <div className="win-support-wrapper" ref={dropdownRef}>
          <button
            id="win-support-btn"
            className={`win-support-btn ${supportOpen ? 'active' : ''}`}
            onClick={() => setSupportOpen(v => !v)}
          >
            Support
            <svg width="10" height="6" viewBox="0 0 10 6" fill="currentColor">
              <path d="M0 0l5 6 5-6z" />
            </svg>
          </button>

          {supportOpen && (
            <div className="win-support-dropdown" id="win-support-dropdown">
              <button className="win-menu-item" onClick={showAbout}>
                About Duvo Dual
              </button>
              <button className="win-menu-item" onClick={checkUpdates}>
                Check for Updates
              </button>
              <button className="win-menu-item" onClick={openFeedback}>
                Submit Feedback &amp; Request
              </button>
              <div className="win-menu-separator" />
              <button
                className="win-menu-item"
                onClick={() => {
                  setSupportOpen(false);
                  api.openReleasesPage('https://github.com/mavtin/Duvo-Dual');
                }}
              >
                View on GitHub
              </button>
            </div>
          )}
        </div>

        {/* Window controls */}
        <div className="win-controls">
          {/* Minimize */}
          <button
            id="win-btn-minimize"
            className="win-ctrl-btn"
            title="Minimize"
            onClick={() => api.minimizeWindow()}
          >
            <svg width="10" height="1" viewBox="0 0 10 1">
              <rect width="10" height="1" fill="currentColor" />
            </svg>
          </button>

          {/* Maximize / Restore */}
          <button
            id="win-btn-maximize"
            className="win-ctrl-btn"
            title={maximized ? 'Restore' : 'Maximize'}
            onClick={() => api.maximizeWindow()}
          >
            {maximized ? (
              /* Restore icon — two overlapping squares */
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
                <rect x="0" y="3" width="7" height="7" />
                <polyline points="3,3 3,0 10,0 10,7 7,7" />
              </svg>
            ) : (
              /* Maximize icon — single square */
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
                <rect x="0" y="0" width="10" height="10" />
              </svg>
            )}
          </button>

          {/* Close */}
          <button
            id="win-btn-close"
            className="win-ctrl-btn win-ctrl-close"
            title="Close"
            onClick={() => api.closeWindow()}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.2">
              <line x1="0" y1="0" x2="10" y2="10" />
              <line x1="10" y1="0" x2="0" y2="10" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
