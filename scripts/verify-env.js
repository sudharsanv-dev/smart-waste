// scripts/verify-env.js
// Production build safeguard enforcing Rule 5 and Scenario M-03 from PLAN.md
// Uses Vite's loadEnv to evaluate the exact effective environment cascade
// CLI --mode takes strict precedence over any ambient shell MODE or NODE_ENV

import { loadEnv } from 'vite';
import path from 'node:path';

// CLI argument --mode strictly binds validation to the selected build mode
const modeArgIdx = process.argv.indexOf('--mode');
const mode = (modeArgIdx !== -1 && process.argv[modeArgIdx + 1])
  ? process.argv[modeArgIdx + 1]
  : 'production';

const dirArgIdx = process.argv.indexOf('--dir');
const rootDir = (dirArgIdx !== -1 && process.argv[dirArgIdx + 1])
  ? path.resolve(process.argv[dirArgIdx + 1])
  : process.cwd();

const isProduction = mode === 'production';

console.log(`[verify-env] Auditing effective environment for target mode: "${mode}" in "${rootDir}"...`);

if (isProduction) {
  const loadedEnv = loadEnv(mode, rootDir, '');
  const effectiveEnv = { ...loadedEnv, ...process.env };

  const useMockApi = effectiveEnv.VITE_USE_MOCK_API;
  const enableDemoTools = effectiveEnv.VITE_ENABLE_DEMO_TOOLS;
  const appMode = effectiveEnv.VITE_APP_MODE;
  const apiBaseUrl = (effectiveEnv.VITE_API_BASE_URL || '').trim();

  const errors = [];

  if (appMode === 'demo') {
    errors.push('CRITICAL: Conflicting configuration: VITE_APP_MODE cannot be "demo" in a production build!');
  }

  if (useMockApi === 'true' || useMockApi === true) {
    errors.push('CRITICAL: VITE_USE_MOCK_API cannot be true in production build!');
  }

  if (enableDemoTools === 'true' || enableDemoTools === true) {
    errors.push('CRITICAL: VITE_ENABLE_DEMO_TOOLS cannot be true in production build!');
  }

  if (!apiBaseUrl) {
    errors.push('CRITICAL: VITE_API_BASE_URL is missing or empty in production mode.');
  } else if (
    apiBaseUrl.includes('example.invalid') || 
    apiBaseUrl.includes('example.test') || 
    apiBaseUrl.includes('example.com') ||
    /\bexample\b/i.test(apiBaseUrl)
  ) {
    errors.push(`CRITICAL: VITE_API_BASE_URL cannot use placeholder or example test domains in production. Received: "${apiBaseUrl}"`);
  } else {
    try {
      const parsedUrl = new URL(apiBaseUrl);
      if (parsedUrl.protocol !== 'https:') {
        errors.push(`CRITICAL: VITE_API_BASE_URL must use an absolute HTTPS URL (got protocol "${parsedUrl.protocol}" in "${apiBaseUrl}").`);
      }
      if (!parsedUrl.hostname || parsedUrl.hostname.length === 0) {
        errors.push(`CRITICAL: VITE_API_BASE_URL must have a valid hostname. Received: "${apiBaseUrl}"`);
      }
    } catch (err) {
      errors.push(`CRITICAL: VITE_API_BASE_URL is malformed. Received: "${apiBaseUrl}". Error: ${err.message}`);
    }
  }

  if (errors.length > 0) {
    console.error('\n================ PRODUCTION BUILD GUARD FAILED ================');
    errors.forEach(err => console.error(` ❌ ${err}`));
    console.error('================================================================\n');
    process.exit(1);
  }

  console.log('✅ [verify-env] Production build safety checks passed.');
} else {
  console.log(`ℹ️ [verify-env] Non-production mode "${mode}" - skipping production enforcement.`);
}
