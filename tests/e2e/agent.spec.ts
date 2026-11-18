// tests/e2e/agent.spec.ts
// Phase 3 Field Collection Agent E2E Test Suite
// Covers Dashboard, Honest ETA Arrival Alerts (QUEUED), Camera Scanner Lifecycle & Duplicate Prevention,
// Shift Schedules, Fee Ledger, Operational Support Desk, and F-04 Dual-Context Competing Claim Concurrency.

import { test, expect, Page } from '@playwright/test';

test.describe('Phase 3 Field Agent Module & Exit Gate', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => {
      window.sessionStorage.clear();
      window.localStorage.clear();
    });
  });

  test('Agent Login -> Dashboard with Shift Card & Honest Manual ETA (QUEUED)', async ({ page }) => {
    // 1. Login as Agent Ramesh Kumar
    await page.goto('/login');
    await page.locator('[data-testid="quick-login-agent"]').click();
    await expect(page).toHaveURL(/\/agent/);
    await expect(page.locator('[data-testid="agent-dashboard"]')).toBeVisible();

    // 2. Active Shift Card verification
    await expect(page.locator('[data-testid="active-shift-card"]')).toBeVisible();
    await expect(page.locator('[data-testid="vehicle-id-badge"]')).toContainText('TN-01-WM-4042');
    await expect(page.locator('[data-testid="agent-active-area"]')).toContainText('Ward 600001');

    // 3. Dispatch Arrival Alert with honest manual ETA window
    await expect(page.locator('[data-testid="arrival-dispatcher-card"]')).toBeVisible();
    await page.locator('[data-testid="eta-minutes-input"]').fill('10');
    await page.locator('[data-testid="send-arrival-btn"]').click();

    // 4. Assert response badge displays QUEUED (Honest manual ETA task dispatch)
    await expect(page.locator('[data-testid="arrival-status-badge"]')).toBeVisible();
    await expect(page.locator('[data-testid="arrival-status-badge"]')).toContainText('QUEUED');
  });

  test('Screen 2: Shift Timetable & Editable Route Notes', async ({ page }) => {
    await page.goto('/login');
    await page.locator('[data-testid="quick-login-agent"]').click();
    await expect(page).toHaveURL(/\/agent/);

    // Navigate to Schedules
    await page.goto('/agent/schedules');
    await expect(page.locator('[data-testid="agent-schedules-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="agent-schedules-table"]')).toBeVisible();

    // Route notes editing and saving
    const notesInput = page.locator('[data-testid="agent-route-notes-input"]');
    await expect(notesInput).toBeVisible();
    await notesInput.fill('Shift notes: North Gate depot gate B clearance required.');
    await page.locator('[data-testid="save-route-notes-btn"]').click();

    // Reload page to verify persistence
    await page.reload();
    await expect(page.locator('[data-testid="agent-route-notes-input"]')).toHaveValue(
      'Shift notes: North Gate depot gate B clearance required.'
    );
  });

  test('Screen 3: Camera Scanner Lifecycle & QR Duplicate Prevention Exit Gate', async ({ page }) => {
    await page.goto('/login');
    await page.locator('[data-testid="quick-login-agent"]').click();
    await expect(page).toHaveURL(/\/agent/);

    // Navigate to QR Scan Page
    await page.goto('/agent/scan');
    await expect(page.locator('[data-testid="agent-scan-page"]')).toBeVisible();

    // 1. Camera starts ONLY after explicit user action
    const startCamBtn = page.locator('[data-testid="start-camera-btn"]');
    await expect(startCamBtn).toBeVisible();
    await expect(page.locator('[data-testid="camera-video-stream"]')).not.toBeVisible();

    // Start camera
    await startCamBtn.click();
    // Video stream is active
    await expect(page.locator('[data-testid="camera-video-stream"]')).toBeVisible();

    // Stop camera and verify teardown
    const stopCamBtn = page.locator('[data-testid="stop-camera-btn"]');
    await expect(stopCamBtn).toBeVisible();
    await stopCamBtn.click();
    await expect(page.locator('[data-testid="camera-video-stream"]')).not.toBeVisible();

    // 2. Initial Valid Household Scan (Simulate John Doe QR)
    await page.locator('[data-testid="simulate-scan-john-btn"]').click();
    await expect(page.locator('[data-testid="scan-qr-input"]')).toHaveValue(
      'GPC-QR-CONS-C1D2E3F4A5B67890'
    );
    await page.locator('[data-testid="submit-scan-btn"]').click();

    // Assert successful collection banner
    await expect(page.locator('[data-testid="scan-success-banner"]')).toBeVisible();
    await expect(page.locator('[data-testid="scan-success-banner"]')).toContainText(
      'Collection Recorded Successfully'
    );

    // 3. Repeat Scan for same household on same day
    await page.locator('[data-testid="simulate-scan-john-btn"]').click();
    await page.locator('[data-testid="submit-scan-btn"]').click();

    // Assert duplicate scan prevention banner
    await expect(page.locator('[data-testid="scan-duplicate-banner"]')).toBeVisible();
    await expect(page.locator('[data-testid="scan-duplicate-banner"]')).toContainText(
      'Household waste collection already completed for today. Duplicate scan ignored.'
    );
  });

  test('Screen 5: Sector Fee History Ledger', async ({ page }) => {
    await page.goto('/login');
    await page.locator('[data-testid="quick-login-agent"]').click();
    await expect(page).toHaveURL(/\/agent/);

    await page.goto('/agent/payments');
    await expect(page.locator('[data-testid="agent-payments-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="agent-payments-table"]')).toBeVisible();
    await expect(page.locator('[data-testid="agent-sector-collected"]')).toBeVisible();
  });

  test('Screen 6: Operational Support Desk Incident Ticket Creation', async ({ page }) => {
    await page.goto('/login');
    await page.locator('[data-testid="quick-login-agent"]').click();
    await expect(page).toHaveURL(/\/agent/);

    await page.goto('/agent/support');
    await expect(page.locator('[data-testid="agent-support-page"]')).toBeVisible();

    // Create incident ticket
    await page.locator('[data-testid="agent-ticket-category"]').selectOption('Vehicle Breakdown');
    await page.locator('[data-testid="agent-ticket-subject"]').fill('Hydraulic arm malfunction');
    await page.locator('[data-testid="agent-ticket-description"]').fill(
      'Hydraulic arm pressure drop at 08:30 AM near North depot.'
    );
    await page.locator('[data-testid="submit-agent-ticket-btn"]').click();

    // Assert ticket created
    await expect(page.locator('[data-testid="agent-tickets-table"]')).toContainText(
      'Hydraulic arm malfunction'
    );
  });

  // F-04: Competing Claims with Two Agent Browser Contexts
  test('Competing claims (F-04): two agent browser contexts acting on the same mutable request assert one success, one conflict (409), and one persisted owner', async ({
    browser,
  }) => {
    // Shared test fixture connecting both isolated browser contexts to shared store state
    const syncState = async (fromPage: Page, toPage: Page) => {
      const stateJson = await fromPage.evaluate(() => localStorage.getItem('smartwaste_demo_state_v1.0.0'));
      if (stateJson) {
        await toPage.evaluate((json) => {
          const key = 'smartwaste_demo_state_v1.0.0';
          localStorage.setItem(key, json);
          window.dispatchEvent(new StorageEvent('storage', { key, newValue: json }));
        }, stateJson);
      }
    };

    // 1. Agent 1 Context (Ramesh Kumar)
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    await page1.goto('/login');
    await page1.locator('[data-testid="quick-login-agent"]').click();
    await expect(page1).toHaveURL(/\/agent/);

    // Navigate Agent 1 to Requests
    await page1.goto('/agent/requests');
    await expect(page1.locator('[data-testid="agent-requests-page"]')).toBeVisible();
    await expect(page1.locator('[data-testid="claim-request-req-001"]')).toBeVisible();

    // Sync initial seed state to Agent 2 context
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await page2.goto('/login');

    // Sync initial state from page1 to page2
    await syncState(page1, page2);

    // Agent 2 (Suresh Babu) logs in on page2 using mobile 9876543211
    await page2.locator('[data-testid="tab-agent"]').click();
    await page2.locator('[data-testid="mobile-input"]').fill('9876543211');
    await page2.locator('[data-testid="password-input"]').fill('Agent@123');
    await page2.locator('[data-testid="login-submit-btn"]').click();
    await expect(page2).toHaveURL(/\/agent/);

    // Navigate Agent 2 to Requests
    await page2.goto('/agent/requests');
    await expect(page2.locator('[data-testid="agent-requests-page"]')).toBeVisible();
    await expect(page2.locator('[data-testid="claim-request-req-001"]')).toBeVisible();

    // 2. Agent 1 claims req-001 first
    await page1.locator('[data-testid="claim-request-req-001"]').click();

    // Assert Agent 1 gets success banner
    await expect(page1.locator('[data-testid="claim-success-banner"]')).toBeVisible();
    await expect(page1.locator('[data-testid="claim-success-banner"]')).toContainText(
      'Successfully claimed request req-001'
    );

    // Synchronize the shared store fixture to Agent 2 context
    await syncState(page1, page2);

    // 3. Agent 2 attempts to claim the same req-001
    await page2.locator('[data-testid="claim-request-req-001"]').click();

    // Assert Agent 2 receives 409 Conflict banner
    await expect(page2.locator('[data-testid="claim-conflict-banner"]')).toBeVisible();
    await expect(page2.locator('[data-testid="claim-conflict-banner"]')).toContainText(
      'already been claimed by another agent (Ramesh Kumar)'
    );

    // 4. Assert exactly one persisted owner in both contexts
    const ownerInPage1 = await page1.evaluate(() => {
      const raw = localStorage.getItem('smartwaste_demo_state_v1.0.0');
      const state = raw ? JSON.parse(raw) : null;
      const req = state?.pickupRequests?.find((r: { id: string }) => r.id === 'req-001');
      return req?.claimed_by_agent_name;
    });

    const ownerInPage2 = await page2.evaluate(() => {
      const raw = localStorage.getItem('smartwaste_demo_state_v1.0.0');
      const state = raw ? JSON.parse(raw) : null;
      const req = state?.pickupRequests?.find((r: { id: string }) => r.id === 'req-001');
      return req?.claimed_by_agent_name;
    });

    expect(ownerInPage1).toBe('Ramesh Kumar');
    expect(ownerInPage2).toBe('Ramesh Kumar');

    await context1.close();
    await context2.close();
  });
});
