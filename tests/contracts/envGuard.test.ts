// tests/contracts/envGuard.test.ts
// Test scenario M-03: Production build guard tests and regression coverage for Phase 0 review findings

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

describe('Production Build Guard & Environment Validation (Scenario M-03)', () => {
  const scriptPath = path.resolve(__dirname, '../../scripts/verify-env.js');
  const prodLocalEnvPath = path.resolve(process.cwd(), '.env.production.local');

  beforeEach(() => {
    if (fs.existsSync(prodLocalEnvPath)) {
      fs.unlinkSync(prodLocalEnvPath);
    }
  });

  afterEach(() => {
    if (fs.existsSync(prodLocalEnvPath)) {
      fs.unlinkSync(prodLocalEnvPath);
    }
  });

  it('rejects build when VITE_USE_MOCK_API is true via environment in production', () => {
    let failed = false;
    try {
      execSync(`node "${scriptPath}" --mode production`, {
        env: {
          ...process.env,
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

  it('rejects build when VITE_ENABLE_DEMO_TOOLS is true via environment in production', () => {
    let failed = false;
    try {
      execSync(`node "${scriptPath}" --mode production`, {
        env: {
          ...process.env,
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

  it('rejects build when VITE_API_BASE_URL is a placeholder (example.invalid) in production', () => {
    let failed = false;
    try {
      execSync(`node "${scriptPath}" --mode production`, {
        env: {
          ...process.env,
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

  it('rejects build when VITE_API_BASE_URL uses plain HTTP (Finding 1)', () => {
    let failed = false;
    let errorOutput = '';
    try {
      execSync(`node "${scriptPath}" --mode production`, {
        env: {
          ...process.env,
          VITE_USE_MOCK_API: 'false',
          VITE_ENABLE_DEMO_TOOLS: 'false',
          VITE_API_BASE_URL: 'http://api.smartwaste.corp.in'
        },
        encoding: 'utf8',
        stdio: 'pipe'
      });
    } catch (err: unknown) {
      failed = true;
      const errorObj = err as { stderr?: Buffer; stdout?: Buffer };
      errorOutput = errorObj.stderr?.toString() || errorObj.stdout?.toString() || '';
    }
    expect(failed).toBe(true);
    expect(errorOutput).toContain('must use an absolute HTTPS URL');
  });

  it('rejects build when VITE_API_BASE_URL uses http://api.example.test (Finding 1)', () => {
    let failed = false;
    try {
      execSync(`node "${scriptPath}" --mode production`, {
        env: {
          ...process.env,
          VITE_USE_MOCK_API: 'false',
          VITE_ENABLE_DEMO_TOOLS: 'false',
          VITE_API_BASE_URL: 'http://api.example.test'
        },
        stdio: 'pipe'
      });
    } catch {
      failed = true;
    }
    expect(failed).toBe(true);
  });

  it('rejects build when VITE_API_BASE_URL is missing or empty (Finding 1)', () => {
    let failed = false;
    let errorOutput = '';
    try {
      execSync(`node "${scriptPath}" --mode production`, {
        env: {
          ...process.env,
          VITE_USE_MOCK_API: 'false',
          VITE_ENABLE_DEMO_TOOLS: 'false',
          VITE_API_BASE_URL: ''
        },
        encoding: 'utf8',
        stdio: 'pipe'
      });
    } catch (err: unknown) {
      failed = true;
      const errorObj = err as { stderr?: Buffer; stdout?: Buffer };
      errorOutput = errorObj.stderr?.toString() || errorObj.stdout?.toString() || '';
    }
    expect(failed).toBe(true);
    expect(errorOutput).toContain('missing or empty');
  });

  it('rejects build when VITE_API_BASE_URL is malformed (Finding 1)', () => {
    let failed = false;
    let errorOutput = '';
    try {
      execSync(`node "${scriptPath}" --mode production`, {
        env: {
          ...process.env,
          VITE_USE_MOCK_API: 'false',
          VITE_ENABLE_DEMO_TOOLS: 'false',
          VITE_API_BASE_URL: 'not-a-valid-url'
        },
        encoding: 'utf8',
        stdio: 'pipe'
      });
    } catch (err: unknown) {
      failed = true;
      const errorObj = err as { stderr?: Buffer; stdout?: Buffer };
      errorOutput = errorObj.stderr?.toString() || errorObj.stdout?.toString() || '';
    }
    expect(failed).toBe(true);
    expect(errorOutput).toContain('malformed');
  });

  it('rejects build when a local override (.env.production.local) enables mock API (Finding 1)', () => {
    fs.writeFileSync(prodLocalEnvPath, 'VITE_USE_MOCK_API=true\n', 'utf8');

    let failed = false;
    let errorOutput = '';
    try {
      execSync(`node "${scriptPath}" --mode production`, {
        env: {
          ...process.env,
          VITE_API_BASE_URL: 'https://api.smartwaste.corp.in',
          VITE_ENABLE_DEMO_TOOLS: 'false'
        },
        encoding: 'utf8',
        stdio: 'pipe'
      });
    } catch (err: unknown) {
      failed = true;
      const errorObj = err as { stderr?: Buffer; stdout?: Buffer };
      errorOutput = errorObj.stderr?.toString() || errorObj.stdout?.toString() || '';
    }
    expect(failed).toBe(true);
    expect(errorOutput).toContain('VITE_USE_MOCK_API cannot be true in production build');
  });

  it('positive control: passes when production configuration is strictly safe and valid', () => {
    const output = execSync(`node "${scriptPath}" --mode production`, {
      env: {
        ...process.env,
        VITE_USE_MOCK_API: 'false',
        VITE_ENABLE_DEMO_TOOLS: 'false',
        VITE_API_BASE_URL: 'https://api.smartwaste.corp.in'
      },
      encoding: 'utf8'
    });
    expect(output).toContain('Production build safety checks passed');
  });
});
