/**
 * Duvo Dual — Onboarding Flow
 * Copyright © 2026 MavTiN. All rights reserved.
 * https://github.com/mavtin/Duvo-Dual
 */
import React, { useState } from 'react';

import { ChevronRight, Layers, Zap } from 'lucide-react';
import duvoIcon from '../assets/icons/duvo-icon.png';

interface Props { onComplete: () => void; }

const slides = [
  {
    key: 'welcome',
    useLogo: true,
    Icon: null as any,
    subtitle: 'Dual streams. Zero compromise.',
    title: 'Welcome to Duvo Dual',
    body: 'Watch two live streams simultaneously — sports, gaming, news, anything — side by side in one premium app.',
  },
  {
    key: 'how',
    useLogo: false,
    Icon: Layers,
    subtitle: 'Total control.',
    title: 'Two Screens. One Window.',
    body: 'Each screen is a full browser. Load any streaming site, resize panels, switch audio focus, or go fullscreen on one.',
  },
  {
    key: 'ready',
    useLogo: false,
    Icon: Zap,
    subtitle: "You're all set.",
    title: "Let's start watching.",
    body: 'Click any bookmark or paste a URL to start. Use Tab to switch screens and M to toggle audio inside a stream.',
  },
];

const Onboarding: React.FC<Props> = ({ onComplete }) => {
  const [idx, setIdx] = useState(0);
  const slide = slides[idx];
  const isLast = idx === slides.length - 1;
  const Icon = slide.Icon;

  return (
    <div className="ob-backdrop">
      <div className="ob-card">
        <button className="ob-skip" onClick={onComplete}>Skip</button>

        <div className="ob-body">
          <div className="ob-icon-wrap">
            {slide.useLogo
              ? <img src={duvoIcon} className="ob-logo" alt="Duvo Dual" draggable={false} />
              : <div className="ob-feature-icon"><Icon size={44} /></div>}
          </div>
          <p className="ob-eyebrow">{slide.subtitle}</p>
          <h1 className="ob-title">{slide.title}</h1>
          <p className="ob-desc">{slide.body}</p>
        </div>

        <div className="ob-dots">
          {slides.map((_, i) => (
            <button
              key={i}
              className={`ob-dot${i === idx ? ' ob-dot--active' : ''}`}
              onClick={() => setIdx(i)}
            />
          ))}
        </div>

        <button className="ob-cta" onClick={() => isLast ? onComplete() : setIdx(i => i + 1)}>
          {isLast ? "Let's Watch" : 'Next'}
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

export default Onboarding;
