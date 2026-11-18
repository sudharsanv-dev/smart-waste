// tests/e2e/consumer.spec.ts
// E2E test suite for Phase 2 Consumer Module
// Covers Register -> Login -> Schedule -> QR -> Double-Click Payment Exit Gate -> Receipt Flow

import { test, expect } from '@playwright/test';

test.describe('Phase 2 Consumer Module & Payment Exit Gate', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => {
      window.sessionStorage.clear();
      window.localStorage.clear();
    });
  });

  test('Registration -> Login -> Schedule -> QR Flow with Data Isolation', async ({ page }) => {
    // 1. Visit Register Page
    await page.goto('/register');
    await expect(page.locator('[data-testid="consumer-register-page"]')).toBeVisible();

    // 2. Fill Household Registration Form
    await page.locator('[data-testid="register-name"]').fill('Meera Patel');
    await page.locator('[data-testid="register-mobile"]').fill('9876543299');
    await page.locator('[data-testid="register-email"]').fill('meera.patel@example.com');
    await page.locator('[data-testid="register-area-code"]').selectOption('600001');
    await page.locator('[data-testid="register-address"]').fill('77 Marina Promenade, North Ward');
    await page.locator('[data-testid="register-password"]').fill('Consumer@123');
    await page.locator('[data-testid="register-confirm-password"]').fill('Consumer@123');

    // 3. Submit Registration
    await page.locator('[data-testid="register-submit-btn"]').click();

    // Verify Success Screen & Allocated Opaque QR Token
    await expect(page.locator('[data-testid="register-success-msg"]')).toBeVisible();
    const tokenText = await page.locator('[data-testid="allocated-qr-token"]').textContent();
    expect(tokenText).toMatch(/^GPC-QR-CONS-[A-F0-9]+$/);
    expect(tokenText).not.toContain('9876543299');

    // 4. Proceed to Login
    await page.locator('[data-testid="register-login-link"]').click();
    await expect(page).toHaveURL(/\/login/);

    // Verify Mobile pre-filled
    await expect(page.locator('[data-testid="mobile-input"]')).toHaveValue('9876543299');
    await page.locator('[data-testid="password-input"]').fill('Consumer@123');
    await page.locator('[data-testid="login-submit-btn"]').click();

    // 5. Land on Consumer Dashboard
    await expect(page).toHaveURL(/\/consumer/);
    await expect(page.locator('[data-testid="consumer-welcome-msg"]')).toContainText('Meera Patel');

    // Verify Data Isolation: Newly registered consumer has ₹0.00 dues (separate from John Doe's ₹150)
    await expect(page.locator('[data-testid="consumer-pending-dues"]')).toContainText('₹0.00');

    // 6. Navigate to Timetable / Schedule Screen & Test Pagination Controls
    await page.goto('/consumer/schedule');
    await expect(page.locator('[data-testid="consumer-schedule-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="consumer-schedules-table"]')).toBeVisible();
    await expect(page.locator('[data-testid="page-indicator"]')).toBeVisible();

    // 7. Navigate to QR Placard Screen
    await page.goto('/consumer/qr');
    await expect(page.locator('[data-testid="consumer-qr-page"]')).toBeVisible();
    await expect(page.locator('#consumer-qr-svg')).toBeVisible();
    const qrDisplay = await page.locator('[data-testid="consumer-qr-token-value"]').textContent();
    expect(qrDisplay?.trim()).toBe(tokenText?.trim());

    // Test Placard SVG Download
    const downloadPromise = page.waitForEvent('download');
    await page.locator('[data-testid="download-qr-btn"]').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('GreenPulse-Household-QR-600001.svg');

    // Test Reload Persistence: Token and Area Code remain intact after reload
    await page.reload();
    await expect(page.locator('[data-testid="consumer-qr-page"]')).toBeVisible();
    const reloadedQr = await page.locator('[data-testid="consumer-qr-token-value"]').textContent();
    expect(reloadedQr?.trim()).toBe(tokenText?.trim());

    // 8. Test Fullscreen Bright-View Modal
    await page.locator('[data-testid="fullscreen-qr-toggle"]').click();
    await expect(page.locator('[data-testid="fullscreen-qr-modal"]')).toBeVisible();
    await page.locator('[data-testid="close-fullscreen-qr"]').click();
    await expect(page.locator('[data-testid="fullscreen-qr-modal"]')).not.toBeVisible();
  });

  test('Payment Exit Gate: double-clicking Pay for seeded ₹150 due produces exactly one ledger entry and one receipt', async ({ page }) => {
    // 1. Login as seeded consumer John Doe
    await page.goto('/login');
    await page.locator('[data-testid="quick-login-consumer"]').click();
    await expect(page).toHaveURL(/\/consumer/);

    // Verify initial dues are ₹150.00
    await expect(page.locator('[data-testid="consumer-pending-dues"]')).toContainText('₹150.00');

    // 2. Navigate to Payments Screen
    await page.goto('/consumer/payments');
    await expect(page.locator('[data-testid="consumer-payments-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="consumer-pending-dues"]')).toContainText('₹150.00');

    // 3. Double-Click "Pay ₹150.00" button rapidly
    const payBtn = page.locator('[data-testid="pay-dues-btn"]');
    await expect(payBtn).toBeVisible();

    // Trigger rapid consecutive clicks
    await Promise.all([
      payBtn.click({ clickCount: 2 }),
      page.waitForTimeout(100),
    ]);

    // 4. Assert single demo receipt opens
    await expect(page.locator('[data-testid="payment-receipt"]')).toBeVisible();
    await expect(page.locator('[data-testid="receipt-invoice-id"]')).toContainText('inv-2026-11-002');
    await expect(page.locator('[data-testid="receipt-amount"]')).toContainText('₹150.00');

    // Test print and download actions
    await expect(page.locator('[data-testid="print-receipt-btn"]')).toBeVisible();
    const receiptDownloadPromise = page.waitForEvent('download');
    await page.locator('[data-testid="download-receipt-btn"]').click();
    const receiptDownload = await receiptDownloadPromise;
    expect(receiptDownload.suggestedFilename()).toBe('Receipt-inv-2026-11-002.txt');

    // Close Receipt Modal
    await page.locator('[data-testid="close-receipt-btn"]').click();
    await expect(page.locator('[data-testid="payment-receipt"]')).not.toBeVisible();

    // 5. Assert outstanding balance is now ₹0.00 and All Dues Cleared badge is visible
    await expect(page.locator('[data-testid="consumer-pending-dues"]')).toContainText('₹0.00');
    await expect(page.locator('[data-testid="dues-cleared-badge"]')).toBeVisible();

    // 6. Assert Payment History table: inv-2026-11-002 is marked PAID and appears EXACTLY ONCE
    const rows = page.locator('[data-testid="payment-row-inv-2026-11-002"]');
    await expect(rows).toHaveCount(1);
    await expect(page.locator('[data-testid="payment-status-inv-2026-11-002"]')).toContainText('PAID');

    // 7. Re-open receipt from history table
    await page.locator('[data-testid="view-receipt-inv-2026-11-002"]').click();
    await expect(page.locator('[data-testid="payment-receipt"]')).toBeVisible();
    await page.locator('[data-testid="close-receipt-btn"]').click();

    // 8. Exit Gate Check: Verify Admin Total reflects payment of ₹150 exactly once
    await page.locator('[data-testid="logout-btn"]').click();
    await expect(page).toHaveURL(/\/login/);

    await page.locator('[data-testid="quick-login-admin"]').click();
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.locator('[data-testid="admin-dashboard"]')).toBeVisible();

    // Admin dashboard total collected should reflect ₹300.00 (from ₹150 originally + ₹150 paid once)
    // and pending fees should reflect ₹0.00
    await expect(page.locator('[data-testid="admin-total-collected"]')).toContainText('₹300.00');
    await expect(page.locator('[data-testid="admin-pending-fees"]')).toContainText('₹0.00');

    // Also assert on underlying shared demo store state in localStorage
    const storeState = await page.evaluate(() => {
      const raw = window.localStorage.getItem('smartwaste_demo_state_v1.0.0');
      return raw ? JSON.parse(raw) : null;
    });
    expect(storeState).toBeDefined();
    const paidSum = storeState.payments
      .filter((p: { status: string; amount: number }) => p.status === 'PAID')
      .reduce((sum: number, p: { amount: number }) => sum + p.amount, 0);
    expect(paidSum).toBe(300);
  });
});
