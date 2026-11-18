// tests/contracts/envGuard.test.ts
// Test scenario M-03: Production build guard tests

import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import path from 'node:path';

describe('Production Build Guard (Scenario M-03)', () => {
  const scriptPath = path.resolve(__dirname, '../../scripts/verify-env.js');

  it('rejects build when VITE_USE_MOCK_API is true in production', () => {
    let failed = false;
    try {
      execSync(`node "${scriptPath}" --mode production`, {
        env: {
          ...process.env,
          NODE_ENV: 'production',
          VITE_USE_MOCK_API: 'true',
          VITE_ENABLE_DEMO_TOOLS: 'false',
          VITE_API_BASE_URL: 'https://api.smartwaste.corp.in'
        },
        stdio: 'pipe'
      });
    } catch {
      failed = true;
    }
    expect(failed).toBe(true);
  });

  it('rejects build when VITE_ENABLE_DEMO_TOOLS is true in production', () => {
    let failed = false;
    try {
      execSync(`node "${scriptPath}" --mode production`, {
        env: {
          ...process.env,
          NODE_ENV: 'production',
          VITE_USE_MOCK_API: 'false',
          VITE_ENABLE_DEMO_TOOLS: 'true',
          VITE_API_BASE_URL: 'https://api.smartwaste.corp.in'
        },
        stdio: 'pipe'
      });
    } catch {
      failed = true;
    }
    expect(failed).toBe(true);
  });

  it('rejects build when VITE_API_BASE_URL is a placeholder in production', () => {
    let failed = false;
    try {
      execSync(`node "${scriptPath}" --mode production`, {
        env: {
          ...process.env,
          NODE_ENV: 'production',
          VITE_USE_MOCK_API: 'false',
          VITE_ENABLE_DEMO_TOOLS: 'false',
          VITE_API_BASE_URL: 'https://api.example.invalid'
        },
        stdio: 'pipe'
      });
    } catch {
      failed = true;
    }
    expect(failed).toBe(true);
  });

  it('passes when production configuration is strictly safe and valid', () => {
    const output = execSync(`node "${scriptPath}" --mode production`, {
      env: {
        ...process.env,
        NODE_ENV: 'production',
        VITE_USE_MOCK_API: 'false',
        VITE_ENABLE_DEMO_TOOLS: 'false',
        VITE_API_BASE_URL: 'https://api.smartwaste.corp.in'
      },
      encoding: 'utf8'
    });
    expect(output).toContain('Production build safety checks passed');
  });
});
