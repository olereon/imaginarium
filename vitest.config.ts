/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: [
      'apps/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'libs/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'packages/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
    ],
    exclude: [
      'node_modules',
      'dist',
      '.git',
      '.cache',
      'coverage',
      'build',
      '**/*.config.*',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      exclude: [
        'coverage/**',
        'dist/**',
        'packages/*/test{,s}/**',
        '**/*.d.ts',
        '**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
        '**/node_modules/**',
        '**/*.config.{js,cjs,mjs,ts}',
        '**/coverage/**',
        '**/.{eslint,mocha,prettier}rc.{js,cjs,yml}',
        '**/build/**',
        '**/.turbo/**',
        '**/vite.config.*',
        '**/vitest.config.*',
        '**/jest.config.*',
        '**/tailwind.config.*',
        '**/postcss.config.*',
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
        // Package-specific thresholds
        'libs/core/**': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
        'libs/shared/**': {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85,
        },
      },
    },
    // Watch mode settings
    watch: false,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 4,
        minThreads: 1,
      },
    },
  },
  resolve: {
    alias: {
      '@imaginarium/shared': path.resolve(__dirname, './packages/shared/src'),
      '@imaginarium/core': path.resolve(__dirname, './libs/core/src'),
      '@imaginarium/ui': path.resolve(__dirname, './libs/ui/src'),
    },
  },
});