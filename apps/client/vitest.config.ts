/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['../../tests/setup.ts'],
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules', 'dist', 'build'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{js,ts,jsx,tsx}'],
      exclude: [
        'src/**/*.{test,spec}.{js,ts,jsx,tsx}',
        'src/**/*.d.ts',
        'src/main.tsx', // Entry point
        'src/vite-env.d.ts',
      ],
      thresholds: {
        global: {
          branches: 75,
          functions: 75,
          lines: 75,
          statements: 75,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@imaginarium/shared': path.resolve(__dirname, '../../packages/shared/src'),
      '@imaginarium/core': path.resolve(__dirname, '../../libs/core/src'),
      '@imaginarium/ui': path.resolve(__dirname, '../../libs/ui/src'),
      '@': path.resolve(__dirname, './src'),
    },
  },
});