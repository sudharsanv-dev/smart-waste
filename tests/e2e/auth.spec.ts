// tests/e2e/auth.spec.ts
// E2E test suite verifying Phase 1 Authentication, Role Landing, Route Protection,
// Session Expiry (401), and Inbox Read Flow across desktop and mobile

import { test, expect } from '@playwright/test';

test.describe('Phase 1 Authentication & Role Navigation Guards', () => {
  test.beforeEach(async ({ page }) => {
    // Reset demo state and clear storage before each test
    await page.goto('/login');
    await page.evaluate(() => {
      window.sessionStorage.clear();
      window.localStorage.clear();
    });
  });

  test('Unauthenticated user visiting root or protected route redirects to /login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);

    await page.goto('/consumer');
    await expect(page).toHaveURL(/\/login/);

    await page.goto('/agent');
    await expect(page).toHaveURL(/\/login/);

    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login/);
  });

  test('Consumer logs in successfully and lands on /consumer', async ({ page }) => {
    await page.goto('/login');

    // Quick Login as Consumer
    await page.locator('[data-testid="quick-login-consumer"]').click();

    // Verify redirected to /consumer
    await expect(page).toHaveURL(/\/consumer/);
    await expect(page.locator('[data-testid="consumer-dashboard"]')).toBeVisible();

    // Verify role badge in app shell
    await expect(page.locator('[data-testid="user-role-badge"]')).toContainText('CONSUMER');

    // Verify timetable card and dues card are rendered
    await expect(page.locator('[data-testid="pickup-timetable-card"]')).toBeVisible();
    await expect(page.locator('[data-testid="consumer-dues-card"]')).toBeVisible();
  });

  test('Agent logs in successfully and lands on /agent', async ({ page }) => {
    await page.goto('/login');

    // Quick Login as Agent
    await page.locator('[data-testid="quick-login-agent"]').click();

    // Verify redirected to /agent
    await expect(page).toHaveURL(/\/agent/);
    await expect(page.locator('[data-testid="agent-dashboard"]')).toBeVisible();

    // Verify role badge
    await expect(page.locator('[data-testid="user-role-badge"]')).toContainText('AGENT');

    // Verify route schedule card
    await expect(page.locator('[data-testid="agent-routes-card"]')).toBeVisible();
  });

  test('Admin logs in successfully and lands on /admin', async ({ page }) => {
    await page.goto('/login');

    // Quick Login as Admin
    await page.locator('[data-testid="quick-login-admin"]').click();

    // Verify redirected to /admin
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.locator('[data-testid="admin-dashboard"]')).toBeVisible();

    // Verify role badge
    await expect(page.locator('[data-testid="user-role-badge"]')).toContainText('ADMIN');

    // Verify master schedule table
    await expect(page.locator('[data-testid="admin-master-schedules-card"]')).toBeVisible();
  });

  test('Cross-role deep link is blocked: Consumer navigating to /admin redirects to /consumer', async ({ page }) => {
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

    // Verify session exists in storage before expiry
    const sessionBefore = await page.evaluate(() => window.sessionStorage.getItem('smartwaste_demo_session'));
    expect(sessionBefore).toBeTruthy();

    // Trigger Simulate 401 button
    const expireBtn = page.locator('[data-testid="simulate-expire-btn"]');
    await expect(expireBtn).toBeVisible();
    await expireBtn.click();

    // Verify redirect to /login and cleared session
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible();

    // Verify bearer token and demo session are cleared from storage
    const sessionAfter = await page.evaluate(() => window.sessionStorage.getItem('smartwaste_demo_session'));
    expect(sessionAfter).toBeNull();

    // Verify protected routes remain closed after page reload
    await page.reload();
    await expect(page).toHaveURL(/\/login/);
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login/);
  });

  test('Notification drawer opens, marks item read, and verifies persisted read state on reopen', async ({ page }) => {
    await page.goto('/login');
    await page.locator('[data-testid="quick-login-consumer"]').click();
    await expect(page).toHaveURL(/\/consumer/);

    // Open notification drawer
    await page.locator('[data-testid="notifications-bell-btn"]').click();
    await expect(page.locator('#notification-drawer-title')).toBeVisible();

    // Locate the first unread item mark-read button
    const markReadBtn = page.locator('[data-testid^="mark-read-btn-"]').first();
    await expect(markReadBtn).toBeVisible();

    // Mark item as read
    await markReadBtn.click();

    // Verify item updates to Read in UI
    await expect(page.locator('text=Read').first()).toBeVisible();

    // Close drawer
    await page.locator('[data-testid="close-notifications-btn"]').click();
    await expect(page.locator('#notification-drawer-title')).not.toBeVisible();

    // Reopen drawer
    await page.locator('[data-testid="notifications-bell-btn"]').click();
    await expect(page.locator('#notification-drawer-title')).toBeVisible();

    // Verify read status persists upon reopening
    await expect(page.locator('text=Read').first()).toBeVisible();

    // Close drawer
    await page.locator('[data-testid="close-notifications-btn"]').click();
  });
});
