/**
 * Duvo Dual — Application Entry Point
 * Copyright © 2026 MavTiN. All rights reserved.
 * https://github.com/mavtin/Duvo-Dual
 */
import React from 'react';

import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
