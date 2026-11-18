// tests/contracts/envModule.test.ts
// Test Finding 3: Authoritative selected Vite mode in src/lib/env.ts

import { describe, it, expect } from 'vitest';
import * as envModule from '../../src/lib/env';

describe('Authoritative Vite Mode Detection in src/lib/env.ts (Finding 3)', () => {
  it('identifies demo mode when Vite mode is demo and enables mocks/demo tools', () => {
    // In demo mode, mocks and demo tools are active
    expect(envModule.IS_DEMO).toBe(true);
    expect(envModule.IS_PRODUCTION).toBe(false);
    expect(envModule.APP_MODE).toBe('demo');
    expect(envModule.USE_MOCK_API).toBe(true);
    expect(envModule.ENABLE_DEMO_TOOLS).toBe(true);
  });

  it('exports valid string types for operational configuration', () => {
    expect(typeof envModule.OPERATIONAL_TIMEZONE).toBe('string');
    expect(envModule.OPERATIONAL_TIMEZONE).toBe('Asia/Kolkata');
    expect(typeof envModule.API_BASE_URL).toBe('string');
  });
});
