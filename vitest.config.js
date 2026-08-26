/*!
 * Copyright (c) 2026 Digital Bazaar, Inc.
 */
import {defineConfig} from 'vitest/config';
import {playwright} from '@vitest/browser-playwright';

// The same spec files run in both places. Nothing here is node-specific, so a
// spec that passes in one and fails in the other is a real portability bug.
export default defineConfig({
  test: {
    // `coverage` is process-wide: it can only be set at the root, never inside
    // a project, and applies across every project in the run
    coverage: {
      provider: 'v8',
      reporter: ['lcov', 'text-summary', 'text'],
      include: ['lib/**/*.js']
    },
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          include: ['test/*.spec.js']
        }
      },
      {
        test: {
          name: 'browser',
          include: ['test/*.spec.js'],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{browser: 'chromium'}]
          }
        }
      }
    ]
  }
});
