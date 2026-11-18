// scripts/verify-env.js
// Production build safeguard enforcing Rule 5 and Scenario M-03 from PLAN.md
// Uses Vite's loadEnv to evaluate the exact effective environment (including .env, .env.local, .env.[mode], .env.[mode].local and process.env)

import { loadEnv } from 'vite';

const mode = process.argv.includes('--mode') 
  ? process.argv[process.argv.indexOf('--mode') + 1] 
  : (process.env.MODE || process.env.NODE_ENV || 'production');

const isProduction = mode === 'production';

// Load effective Vite environment variables for the specified mode
const loadedEnv = loadEnv(mode, process.cwd(), '');
const effectiveEnv = { ...loadedEnv, ...process.env };

const useMockApi = effectiveEnv.VITE_USE_MOCK_API;
const enableDemoTools = effectiveEnv.VITE_ENABLE_DEMO_TOOLS;
const apiBaseUrl = (effectiveEnv.VITE_API_BASE_URL || '').trim();

console.log(`[verify-env] Auditing effective environment for mode: "${mode}"...`);

if (isProduction) {
  const errors = [];

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
