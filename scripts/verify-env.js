// scripts/verify-env.js
// Production build safeguard enforcing Rule 5 and Scenario M-03 from PLAN.md

import fs from 'node:fs';
import path from 'node:path';

const _isProduction = process.env.NODE_ENV === 'production' || process.argv.includes('--mode') && process.argv.includes('production');

// Also load .env.production if it exists
let envContent = '';
const prodEnvPath = path.resolve(process.cwd(), '.env.production');
if (fs.existsSync(prodEnvPath)) {
  envContent = fs.readFileSync(prodEnvPath, 'utf8');
}

function parseEnv(content) {
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      env[key] = val;
    }
  }
  return env;
}

const fileEnv = parseEnv(envContent);
const useMockApi = process.env.VITE_USE_MOCK_API ?? fileEnv.VITE_USE_MOCK_API;
const enableDemoTools = process.env.VITE_ENABLE_DEMO_TOOLS ?? fileEnv.VITE_ENABLE_DEMO_TOOLS;
const apiBaseUrl = process.env.VITE_API_BASE_URL ?? fileEnv.VITE_API_BASE_URL;

console.log('[verify-env] Auditing environment configuration for production build...');

const errors = [];

if (useMockApi === 'true' || useMockApi === true) {
  errors.push('CRITICAL: VITE_USE_MOCK_API cannot be true in production build!');
}

if (enableDemoTools === 'true' || enableDemoTools === true) {
  errors.push('CRITICAL: VITE_ENABLE_DEMO_TOOLS cannot be true in production build!');
}

if (!apiBaseUrl || apiBaseUrl.trim() === '' || apiBaseUrl.includes('example.invalid')) {
  errors.push(`CRITICAL: VITE_API_BASE_URL must be a real verified HTTPS endpoint, got: "${apiBaseUrl}"`);
}

if (errors.length > 0) {
  console.error('\n================ PRODUCTION BUILD GUARD FAILED ================');
  errors.forEach(err => console.error(` ❌ ${err}`));
  console.error('================================================================\n');
  process.exit(1);
}

console.log('✅ [verify-env] Production build safety checks passed.');
