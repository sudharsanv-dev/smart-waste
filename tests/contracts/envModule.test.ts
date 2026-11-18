// tests/contracts/envModule.test.ts
// Test Finding 2: Demo mode detection in src/lib/env.ts

import { describe, it, expect } from 'vitest';
import * as envModule from '../../src/lib/env';

describe('Demo Mode Detection in src/lib/env.ts (Finding 2)', () => {
  it('identifies demo mode and does not throw', () => {
    // In our test / vitest setup, mode is demo
    expect(envModule.APP_MODE).toBe('demo');
    expect(envModule.IS_DEMO).toBe(true);
    expect(envModule.IS_PRODUCTION).toBe(false);
    expect(typeof envModule.USE_MOCK_API).toBe('boolean');
    expect(typeof envModule.ENABLE_DEMO_TOOLS).toBe('boolean');
    expect(typeof envModule.OPERATIONAL_TIMEZONE).toBe('string');
  });

  it('allows mocks and demo tools in demo mode', () => {
    expect(envModule.USE_MOCK_API).toBe(true);
    expect(envModule.ENABLE_DEMO_TOOLS).toBe(true);
  });
});
