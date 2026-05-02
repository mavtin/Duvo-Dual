/**
 * Duvo Dual — About Modal
 * Copyright © 2026 MavTiN. All rights reserved.
 * https://github.com/mavtin/Duvo-Dual
 */
import React, { useEffect, useState } from 'react';
import duvoIcon from '../assets/icons/duvo-icon.png';

const api = (window as any).duvoApi;

interface Props { onClose: () => void; }

export default function AboutModal({ onClose }: Props) {
  const [version, setVersion] = useState<string>('...');

  useEffect(() => {
    // Get the real version from the main process
    api.getAppVersion?.().then((v: string) => setVersion(v));
  }, []);

  const openGitHub = () => {
    api.openReleasesPage('https://github.com/mavtin/Duvo-Dual');
  };

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="about-overlay" onClick={onClose}>
      <div className="about-card" onClick={e => e.stopPropagation()}>
        {/* Close button */}
        <button className="about-close" onClick={onClose} title="Close">✕</button>

        {/* Logo */}
        <div className="about-logo-wrap">
          <img src={duvoIcon} alt="Duvo Dual" className="about-logo" />
          <div className="about-logo-glow" />
        </div>

        {/* App name */}
        <h1 className="about-name">Duvo Dual</h1>
        <p className="about-tagline">Premium dual-panel streaming browser</p>

        {/* Version badge */}
        <div className="about-version-badge">v{version}</div>

        {/* Divider */}
        <div className="about-divider" />

        {/* Info rows */}
        <div className="about-info">
          <div className="about-info-row">
            <span className="about-info-label">Platform</span>
            <span className="about-info-value">macOS &amp; Windows</span>
          </div>
          <div className="about-info-row">
            <span className="about-info-label">Developer</span>
            <span className="about-info-value">MavTiN</span>
          </div>
          <div className="about-info-row">
            <span className="about-info-label">License</span>
            <span className="about-info-value">MIT</span>
          </div>
          <div className="about-info-row">
            <span className="about-info-label">Source</span>
            <button className="about-link" onClick={openGitHub}>
              github.com/mavtin/Duvo-Dual ↗
            </button>
          </div>
        </div>

        {/* Copyright */}
        <p className="about-copyright">Copyright © 2026 MavTiN. All rights reserved.</p>
      </div>
    </div>
  );
}
