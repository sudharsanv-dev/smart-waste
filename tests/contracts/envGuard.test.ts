// tests/contracts/envGuard.test.ts
// Test scenario M-03: Production build guard tests and regression coverage for Phase 0 review findings
// All file-based tests run in isolated temporary directories to protect developer's .env.production.local

import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

describe('Production Build Guard & Environment Validation (Scenario M-03)', () => {
  const scriptPath = path.resolve(__dirname, '../../scripts/verify-env.js');

  // Helper to create an isolated temporary project directory for testing
  function createTempProject(files: Record<string, string> = {}) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'env-guard-test-'));
    for (const [filename, content] of Object.entries(files)) {
      fs.writeFileSync(path.join(tempDir, filename), content, 'utf8');
    }
    return {
      dir: tempDir,
      cleanup: () => {
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
        } catch {
          // ignore cleanup failures in temp dir
        }
      }
    };
  }

  it('rejects build when VITE_USE_MOCK_API is true via environment in production', () => {
    const temp = createTempProject({
      '.env.production': 'VITE_API_BASE_URL=https://api.smartwaste.corp.in\nVITE_USE_MOCK_API=false\nVITE_ENABLE_DEMO_TOOLS=false\n'
    });
    let failed = false;
    try {
      execSync(`node "${scriptPath}" --mode production --dir "${temp.dir}"`, {
        env: {
          ...process.env,
          VITE_APP_MODE: 'production',
          VITE_USE_MOCK_API: 'true',
          VITE_ENABLE_DEMO_TOOLS: 'false',
          VITE_API_BASE_URL: 'https://api.smartwaste.corp.in'
        },
        stdio: 'pipe'
      });
    } catch {
      failed = true;
    } finally {
      temp.cleanup();
    }
    expect(failed).toBe(true);
  });

  it('rejects build when VITE_ENABLE_DEMO_TOOLS is true via environment in production', () => {
    const temp = createTempProject({
      '.env.production': 'VITE_API_BASE_URL=https://api.smartwaste.corp.in\nVITE_USE_MOCK_API=false\nVITE_ENABLE_DEMO_TOOLS=false\n'
    });
    let failed = false;
    try {
      execSync(`node "${scriptPath}" --mode production --dir "${temp.dir}"`, {
        env: {
          ...process.env,
          VITE_APP_MODE: 'production',
          VITE_USE_MOCK_API: 'false',
          VITE_ENABLE_DEMO_TOOLS: 'true',
          VITE_API_BASE_URL: 'https://api.smartwaste.corp.in'
        },
        stdio: 'pipe'
      });
    } catch {
      failed = true;
    } finally {
      temp.cleanup();
    }
    expect(failed).toBe(true);
  });

  it('rejects build when VITE_API_BASE_URL is a placeholder (example.invalid) in production', () => {
    const temp = createTempProject({
      '.env.production': 'VITE_API_BASE_URL=https://api.example.invalid\nVITE_USE_MOCK_API=false\nVITE_ENABLE_DEMO_TOOLS=false\n'
    });
    let failed = false;
    try {
      execSync(`node "${scriptPath}" --mode production --dir "${temp.dir}"`, {
        env: {
          ...process.env,
          VITE_APP_MODE: 'production',
          VITE_USE_MOCK_API: 'false',
          VITE_ENABLE_DEMO_TOOLS: 'false',
          VITE_API_BASE_URL: 'https://api.example.invalid'
        },
        stdio: 'pipe'
      });
    } catch {
      failed = true;
    } finally {
      temp.cleanup();
    }
    expect(failed).toBe(true);
  });

  it('rejects build when VITE_API_BASE_URL uses plain HTTP', () => {
    const temp = createTempProject({
      '.env.production': 'VITE_API_BASE_URL=http://api.smartwaste.corp.in\nVITE_USE_MOCK_API=false\nVITE_ENABLE_DEMO_TOOLS=false\n'
    });
    let failed = false;
    let errorOutput = '';
    try {
      execSync(`node "${scriptPath}" --mode production --dir "${temp.dir}"`, {
        env: {
          ...process.env,
          VITE_APP_MODE: 'production',
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
    } finally {
      temp.cleanup();
    }
    expect(failed).toBe(true);
    expect(errorOutput).toContain('must use an absolute HTTPS URL');
  });

  it('rejects build when VITE_API_BASE_URL uses http://api.example.test', () => {
    const temp = createTempProject({
      '.env.production': 'VITE_API_BASE_URL=http://api.example.test\nVITE_USE_MOCK_API=false\nVITE_ENABLE_DEMO_TOOLS=false\n'
    });
    let failed = false;
    try {
      execSync(`node "${scriptPath}" --mode production --dir "${temp.dir}"`, {
        env: {
          ...process.env,
          VITE_APP_MODE: 'production',
          VITE_USE_MOCK_API: 'false',
          VITE_ENABLE_DEMO_TOOLS: 'false',
          VITE_API_BASE_URL: 'http://api.example.test'
        },
        stdio: 'pipe'
      });
    } catch {
      failed = true;
    } finally {
      temp.cleanup();
    }
    expect(failed).toBe(true);
  });

  it('rejects build when VITE_API_BASE_URL is missing or empty', () => {
    const temp = createTempProject({
      '.env.production': 'VITE_API_BASE_URL=\nVITE_USE_MOCK_API=false\nVITE_ENABLE_DEMO_TOOLS=false\n'
    });
    let failed = false;
    let errorOutput = '';
    try {
      execSync(`node "${scriptPath}" --mode production --dir "${temp.dir}"`, {
        env: {
          ...process.env,
          VITE_APP_MODE: 'production',
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
    } finally {
      temp.cleanup();
    }
    expect(failed).toBe(true);
    expect(errorOutput).toContain('missing or empty');
  });

  it('rejects build when VITE_API_BASE_URL is malformed', () => {
    const temp = createTempProject({
      '.env.production': 'VITE_API_BASE_URL=not-a-valid-url\nVITE_USE_MOCK_API=false\nVITE_ENABLE_DEMO_TOOLS=false\n'
    });
    let failed = false;
    let errorOutput = '';
    try {
      execSync(`node "${scriptPath}" --mode production --dir "${temp.dir}"`, {
        env: {
          ...process.env,
          VITE_APP_MODE: 'production',
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
    } finally {
      temp.cleanup();
    }
    expect(failed).toBe(true);
    expect(errorOutput).toContain('malformed');
  });

  it('rejects build when a local override (.env.production.local) enables mock API in temp project', () => {
    const temp = createTempProject({
      '.env.production': 'VITE_API_BASE_URL=https://api.smartwaste.corp.in\nVITE_USE_MOCK_API=false\nVITE_ENABLE_DEMO_TOOLS=false\n',
      '.env.production.local': 'VITE_USE_MOCK_API=true\n'
    });
    let failed = false;
    let errorOutput = '';
    try {
      execSync(`node "${scriptPath}" --mode production --dir "${temp.dir}"`, {
        env: {
          ...process.env,
          VITE_APP_MODE: 'production',
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
    } finally {
      temp.cleanup();
    }
    expect(failed).toBe(true);
    expect(errorOutput).toContain('VITE_USE_MOCK_API cannot be true in production build');
  });

  it('protects developer .env.production.local: pre-existing file in disposable project stays byte-for-byte identical (Finding 1)', () => {
    const localContent = '# Developer private configuration\nVITE_LOCAL_KEY=super-secret-key-12345\nVITE_EXTRA_FLAG=custom\n';
    const temp = createTempProject({
      '.env.production': 'VITE_API_BASE_URL=https://api.smartwaste.corp.in\nVITE_USE_MOCK_API=false\nVITE_ENABLE_DEMO_TOOLS=false\n',
      '.env.production.local': localContent
    });

    const localFilePath = path.join(temp.dir, '.env.production.local');
    const beforeBytes = fs.readFileSync(localFilePath);

    // Run the guard check
    try {
      execSync(`node "${scriptPath}" --mode production --dir "${temp.dir}"`, {
        env: {
          ...process.env,
          VITE_API_BASE_URL: 'https://api.smartwaste.corp.in',
          VITE_USE_MOCK_API: 'false',
          VITE_ENABLE_DEMO_TOOLS: 'false'
        },
        stdio: 'pipe'
      });
    } catch {
      // guard may succeed or fail depending on env; the test is checking file integrity
    }

    const afterBytes = fs.readFileSync(localFilePath);
    expect(Buffer.compare(beforeBytes, afterBytes)).toBe(0);
    expect(afterBytes.toString('utf8')).toBe(localContent);

    temp.cleanup();
  });

  it('Finding 2: build:prod binds validation to production mode and rejects HTTP even with conflicting shell settings (MODE=demo, NODE_ENV=development)', () => {
    let failed = false;
    let errorOutput = '';
    try {
      // Execute npm run build:prod with conflicting shell settings
      execSync('npm run build:prod', {
        env: {
          ...process.env,
          MODE: 'demo',
          NODE_ENV: 'development',
          VITE_API_BASE_URL: 'http://api.smartwaste.corp.in',
          VITE_USE_MOCK_API: 'false',
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
    expect(errorOutput).toContain('must use an absolute HTTPS URL');
  });

  it('Finding 2: build:prod rejects enabled mocks even with conflicting shell settings', () => {
    let failed = false;
    let errorOutput = '';
    try {
      execSync('npm run build:prod', {
        env: {
          ...process.env,
          MODE: 'demo',
          NODE_ENV: 'development',
          VITE_API_BASE_URL: 'https://api.smartwaste.corp.in',
          VITE_USE_MOCK_API: 'true',
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

  it('Finding 3: build:prod rejects conflicting VITE_APP_MODE=demo configuration', () => {
    let failed = false;
    let errorOutput = '';
    try {
      execSync('npm run build:prod', {
        env: {
          ...process.env,
          VITE_APP_MODE: 'demo',
          VITE_API_BASE_URL: 'https://api.smartwaste.corp.in',
          VITE_USE_MOCK_API: 'false',
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
    expect(errorOutput).toContain('VITE_APP_MODE cannot be "demo" in a production build');
  });

  it('positive control: passes when production configuration is strictly safe and valid', () => {
    const temp = createTempProject({
      '.env.production': 'VITE_APP_MODE=production\nVITE_API_BASE_URL=https://api.smartwaste.corp.in\nVITE_USE_MOCK_API=false\nVITE_ENABLE_DEMO_TOOLS=false\n'
    });
    const output = execSync(`node "${scriptPath}" --mode production --dir "${temp.dir}"`, {
      env: {
        ...process.env,
        VITE_APP_MODE: 'production',
        VITE_USE_MOCK_API: 'false',
        VITE_ENABLE_DEMO_TOOLS: 'false',
        VITE_API_BASE_URL: 'https://api.smartwaste.corp.in'
      },
      encoding: 'utf8'
    });
    temp.cleanup();
    expect(output).toContain('Production build safety checks passed');
  });
});
