/**
 * Duvo Dual — Vite Build Configuration
 * Copyright © 2026 MavTiN. All rights reserved.
 * https://github.com/mavtin/Duvo-Dual
 */
import { defineConfig } from 'vite';

import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.ts',
      },
      {
        entry: 'electron/preload.ts',
        onstart(options) {
          options.reload();
        },
      },
      {
        // Panel view preload — plain JS, copied as-is to dist-electron/
        entry: 'electron/view-preload.js',
      },
    ]),
    renderer(),
  ],
  build: {
    outDir: 'dist',
  },
});
