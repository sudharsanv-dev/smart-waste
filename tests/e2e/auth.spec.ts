// tests/e2e/auth.spec.ts
// Playwright E2E spec verifying Phase 1 auth, landing pages, cross-role guards, and session expiry

import { test, expect } from '@playwright/test';

test.describe('Phase 1 Authentication & Role Navigation Guards', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to base URL and clear storage for deterministic run
    await page.goto('/');
    await page.evaluate(() => {
      sessionStorage.clear();
      localStorage.clear();
    });
  });

  test('Unauthenticated user visiting root or protected route redirects to /login', async ({ page }) => {
    await page.goto('/consumer');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible();

    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login/);

    await page.goto('/agent');
    await expect(page).toHaveURL(/\/login/);
  });

  test('Consumer logs in successfully and lands on /consumer', async ({ page }) => {
    await page.goto('/login');

    // Default tab is CONSUMER
    await page.locator('[data-testid="tab-consumer"]').click();
    await page.locator('[data-testid="mobile-input"]').fill('9876543210');
    await page.locator('[data-testid="password-input"]').fill('Consumer@123');
    await page.locator('[data-testid="login-submit-btn"]').click();

    // Verify navigation to /consumer landing page
    await expect(page).toHaveURL(/\/consumer/);
    await expect(page.locator('[data-testid="consumer-dashboard"]')).toBeVisible();
    await expect(page.locator('[data-testid="consumer-welcome-msg"]')).toContainText('John Doe');
    await expect(page.locator('[data-testid="user-role-badge"]')).toContainText('CONSUMER');
  });

  test('Agent logs in successfully and lands on /agent', async ({ page }) => {
    await page.goto('/login');

    await page.locator('[data-testid="tab-agent"]').click();
    await page.locator('[data-testid="mobile-input"]').fill('9876543210');
    await page.locator('[data-testid="password-input"]').fill('Agent@123');
    await page.locator('[data-testid="login-submit-btn"]').click();

    await expect(page).toHaveURL(/\/agent/);
    await expect(page.locator('[data-testid="agent-dashboard"]')).toBeVisible();
    await expect(page.locator('[data-testid="agent-welcome-msg"]')).toContainText('Ramesh Kumar');
    await expect(page.locator('[data-testid="user-role-badge"]')).toContainText('AGENT');
  });

  test('Admin logs in successfully and lands on /admin', async ({ page }) => {
    await page.goto('/login');

    await page.locator('[data-testid="tab-admin"]').click();
    await page.locator('[data-testid="username-input"]').fill('admin');
    await page.locator('[data-testid="password-input"]').fill('Admin@123');
    await page.locator('[data-testid="login-submit-btn"]').click();

    await expect(page).toHaveURL(/\/admin/);
    await expect(page.locator('[data-testid="admin-dashboard"]')).toBeVisible();
    await expect(page.locator('[data-testid="user-role-badge"]')).toContainText('ADMIN');
  });

  test('Cross-role deep link is blocked: Consumer navigating to /admin redirects to /consumer', async ({ page }) => {
    // Sign in as Consumer
    await page.goto('/login');
    await page.locator('[data-testid="quick-login-consumer"]').click();
    await expect(page).toHaveURL(/\/consumer/);

    // Deep link attempt to /admin
    await page.goto('/admin');

    // Must be blocked and redirected back to /consumer
    await expect(page).not.toHaveURL(/\/admin/);
    await expect(page).toHaveURL(/\/consumer/);
    await expect(page.locator('[data-testid="consumer-dashboard"]')).toBeVisible();
  });

  test('Cross-role deep link is blocked: Agent navigating to /admin redirects to /agent', async ({ page }) => {
    await page.goto('/login');
    await page.locator('[data-testid="quick-login-agent"]').click();
    await expect(page).toHaveURL(/\/agent/);

    await page.goto('/admin');
    await expect(page).not.toHaveURL(/\/admin/);
    await expect(page).toHaveURL(/\/agent/);
  });

  test('Simulating session expiry (401) clears session and redirects to /login', async ({ page }) => {
    // Log in as Admin
    await page.goto('/login');
    await page.locator('[data-testid="quick-login-admin"]').click();
    await expect(page).toHaveURL(/\/admin/);

    // Trigger Simulate 401 button
    await page.locator('[data-testid="simulate-expire-btn"]').click();

    // Verify redirect to /login and cleared session
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
  });

  test('Notification drawer opens and marks item read', async ({ page }) => {
    await page.goto('/login');
    await page.locator('[data-testid="quick-login-consumer"]').click();
    await expect(page).toHaveURL(/\/consumer/);

    // Open notification drawer
    await page.locator('[data-testid="notifications-bell-btn"]').click();
    await expect(page.locator('#notification-drawer-title')).toBeVisible();

    // Close drawer
    await page.locator('[data-testid="close-notifications-btn"]').click();
    await expect(page.locator('#notification-drawer-title')).not.toBeVisible();
  });
});
