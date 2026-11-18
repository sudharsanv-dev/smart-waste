// tests/e2e/agent.spec.ts
// Phase 3 Field Collection Agent E2E Test Suite
// Covers Dashboard, Honest ETA Arrival Alerts (QUEUED), Camera Scanner Lifecycle,
// Unrecognized QR Guard (disabled confirmation), Known QR Image File Decoding via html5-qrcode,
// Shift Schedules, Fee Ledger, Operational Support Desk,
// F-04 Concurrent Competing Claims (accepting either winner with matching persisted owner),
// and Out-of-Area Agent Claim Ineligibility.

import { test, expect } from '@playwright/test';
import { ManualPickupRequestItem } from '../../src/types/contracts';
import {
  claimPickupRequestInStore,
  getStoreState,
  resetDemoData,
} from '../../src/api/mockStore';

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

  test('Screen 3: Camera Scanner Lifecycle, Unrecognized QR Guard, and Duplicate Prevention', async ({
    page,
  }) => {
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

    // 2. Unrecognized household token displays "Household not recognized" and disables confirmation
    await page.locator('[data-testid="simulate-scan-unknown-btn"]').click();
    await expect(page.locator('[data-testid="scan-confirmation-card"]')).toBeVisible();
    await expect(page.locator('[data-testid="household-not-recognized-title"]')).toHaveText(
      'Household not recognized'
    );
    await expect(page.locator('[data-testid="submit-scan-btn"]')).toBeDisabled();

    // Reset scan state
    await page.locator('[data-testid="clear-scan-btn"]').click();
    await expect(page.locator('[data-testid="scan-confirmation-card"]')).not.toBeVisible();

    // 3. Initial Valid Household Scan (Simulate John Doe QR)
    await page.locator('[data-testid="simulate-scan-john-btn"]').click();
    await expect(page.locator('[data-testid="scan-confirmation-card"]')).toBeVisible();
    await expect(page.locator('[data-testid="decoded-resident-name"]')).toHaveText('John Doe');
    await expect(page.locator('[data-testid="decoded-token"]')).toContainText(
      'GPC-QR-CONS-C1D2E3F4A5B67890'
    );
    await expect(page.locator('[data-testid="submit-scan-btn"]')).toBeEnabled();
    await page.locator('[data-testid="submit-scan-btn"]').click();

    // Assert successful collection banner
    await expect(page.locator('[data-testid="scan-success-banner"]')).toBeVisible();
    await expect(page.locator('[data-testid="scan-success-banner"]')).toContainText(
      'Collection Recorded Successfully'
    );

    // 4. Repeat Scan for same household on same day
    await page.locator('[data-testid="simulate-scan-john-btn"]').click();
    await expect(page.locator('[data-testid="scan-confirmation-card"]')).toBeVisible();
    await page.locator('[data-testid="submit-scan-btn"]').click();

    // Assert duplicate scan prevention banner
    await expect(page.locator('[data-testid="scan-duplicate-banner"]')).toBeVisible();
    await expect(page.locator('[data-testid="scan-duplicate-banner"]')).toContainText(
      'Household waste collection already completed for today. Duplicate scan ignored.'
    );
  });

  test('Screen 3: Known QR code image decoded through html5-qrcode file decoder', async ({ page }) => {
    // 1. Obtain known household QR image from Consumer QR page
    await page.goto('/login');
    await page.locator('[data-testid="quick-login-consumer"]').click();
    await expect(page).toHaveURL(/\/consumer/);

    await page.goto('/consumer/qr');
    await expect(page.locator('[data-testid="consumer-qr-page"]')).toBeVisible();

    // Export SVG as PNG image buffer in browser
    const pngDataUrl = await page.evaluate(async () => {
      const svg = document.getElementById('consumer-qr-svg');
      if (!svg) throw new Error('SVG not found');
      const xml = new XMLSerializer().serializeToString(svg);
      const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
      const URL = window.URL || window.webkitURL || window;
      const blobURL = URL.createObjectURL(svgBlob);

      const img = new Image();
      img.src = blobURL;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const canvas = document.createElement('canvas');
      canvas.width = 300;
      canvas.height = 300;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No 2d context');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 300, 300);
      ctx.drawImage(img, 25, 25, 250, 250);
      URL.revokeObjectURL(blobURL);
      return canvas.toDataURL('image/png');
    });

    const base64Data = pngDataUrl.replace(/^data:image\/png;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // 2. Login as Agent Ramesh Kumar
    await page.goto('/login');
    await page.locator('[data-testid="quick-login-agent"]').click();
    await expect(page).toHaveURL(/\/agent/);

    await page.goto('/agent/scan');
    await expect(page.locator('[data-testid="agent-scan-page"]')).toBeVisible();

    // 3. Upload known QR image into the html5-qrcode file decoder
    const fileInput = page.locator('[data-testid="upload-qr-file-input"]');
    await fileInput.setInputFiles({
      name: 'known-household-qr.png',
      mimeType: 'image/png',
      buffer,
    });

    // 4. Assert decoded token and confirmation card appears
    await expect(page.locator('[data-testid="scan-confirmation-card"]')).toBeVisible();
    await expect(page.locator('[data-testid="decoded-token"]')).toContainText('GPC-QR-CONS-C1D2E3F4A5B67890');
    await expect(page.locator('[data-testid="decoded-resident-name"]')).toHaveText('John Doe');
    await expect(page.locator('[data-testid="submit-scan-btn"]')).toBeEnabled();

    // 5. Submit collection record after explicit confirmation
    await page.locator('[data-testid="submit-scan-btn"]').click();
    await expect(page.locator('[data-testid="scan-success-banner"]')).toBeVisible();
    await expect(page.locator('[data-testid="scan-success-banner"]')).toContainText('Collection Recorded Successfully');
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

  // F-04: Concurrent Competing Claims with Two Eligible Agent Browser Contexts
  test('Competing claims (F-04): two eligible agents concurrently claim the same pending request; assert one success, one conflict (409), and matching persisted owner after reload', async ({
    browser,
  }) => {
    // Reset demo store state so req-001 is clean and PENDING
    resetDemoData();

    // 1. Agent 1 Context (Ramesh Kumar - Wards 600001, 600040)
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    await page1.exposeFunction('__SHARED_GET_REQUESTS__', () => getStoreState().pickupRequests);
    await page1.exposeFunction('__SHARED_CLAIM_FIXTURE__', (id: string, agentUserId: string) =>
      claimPickupRequestInStore(id, agentUserId)
    );

    // 2. Agent 2 Context (Suresh Babu - Wards 600001, 600002, 600096)
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await page2.exposeFunction('__SHARED_GET_REQUESTS__', () => getStoreState().pickupRequests);
    await page2.exposeFunction('__SHARED_CLAIM_FIXTURE__', (id: string, agentUserId: string) =>
      claimPickupRequestInStore(id, agentUserId)
    );

    // Agent 1 logs in
    await page1.goto('/login');
    await page1.locator('[data-testid="quick-login-agent"]').click();
    await expect(page1).toHaveURL(/\/agent/);

    // Agent 2 logs in
    await page2.goto('/login');
    await page2.locator('[data-testid="tab-agent"]').click();
    await page2.locator('[data-testid="mobile-input"]').fill('9876543211');
    await page2.locator('[data-testid="password-input"]').fill('Agent@123');
    await page2.locator('[data-testid="login-submit-btn"]').click();
    await expect(page2).toHaveURL(/\/agent/);

    // Both navigate to /agent/requests
    await page1.goto('/agent/requests');
    await page2.goto('/agent/requests');
    await expect(page1.locator('[data-testid="agent-requests-page"]')).toBeVisible();
    await expect(page2.locator('[data-testid="agent-requests-page"]')).toBeVisible();

    // Wait until both pages show req-001 as PENDING
    await expect(page1.locator('[data-testid="request-status-req-001"]')).toHaveText('PENDING');
    await expect(page2.locator('[data-testid="request-status-req-001"]')).toHaveText('PENDING');
    await expect(page1.locator('[data-testid="claim-request-req-001"]')).toBeVisible();
    await expect(page2.locator('[data-testid="claim-request-req-001"]')).toBeVisible();

    // Submit both claims concurrently without waiting for either result
    await Promise.all([
      page1.locator('[data-testid="claim-request-req-001"]').click(),
      page2.locator('[data-testid="claim-request-req-001"]').click(),
    ]);

    // Wait for response outcomes on both pages
    await expect(
      page1.locator('[data-testid="claim-success-banner"], [data-testid="claim-conflict-banner"]')
    ).toBeVisible();
    await expect(
      page2.locator('[data-testid="claim-success-banner"], [data-testid="claim-conflict-banner"]')
    ).toBeVisible();

    const isPage1Success = await page1.locator('[data-testid="claim-success-banner"]').isVisible();
    const isPage2Success = await page2.locator('[data-testid="claim-success-banner"]').isVisible();
    const isPage1Conflict = await page1.locator('[data-testid="claim-conflict-banner"]').isVisible();
    const isPage2Conflict = await page2.locator('[data-testid="claim-conflict-banner"]').isVisible();

    // Accept either winner: exactly one success and one 409 conflict
    expect(Number(isPage1Success) + Number(isPage2Success)).toBe(1);
    expect(Number(isPage1Conflict) + Number(isPage2Conflict)).toBe(1);

    // Assert the losing page displays 409 conflict banner preserving the winner's name
    if (isPage1Conflict) {
      await expect(page1.locator('[data-testid="claim-conflict-banner"]')).toContainText(
        'already been claimed by another agent (Suresh Babu)'
      );
    } else {
      await expect(page2.locator('[data-testid="claim-conflict-banner"]')).toContainText(
        'already been claimed by another agent (Ramesh Kumar)'
      );
    }

    // Reload both pages
    await page1.reload();
    await page2.reload();

    // Assert the same persisted owner in both pages after reload
    await expect(page1.locator('[data-testid="request-status-req-001"]')).toHaveText('CLAIMED');
    await expect(page2.locator('[data-testid="request-status-req-001"]')).toHaveText('CLAIMED');

    const owner1 = await page1.locator('[data-testid="request-owner-req-001"]').textContent();
    const owner2 = await page2.locator('[data-testid="request-owner-req-001"]').textContent();

    expect(owner1).toBeTruthy();
    expect(owner2).toBeTruthy();
    expect(owner1).toBe(owner2);
    expect(owner1).toMatch(/Ramesh Kumar|Suresh Babu/);

    await context1.close();
    await context2.close();
  });

  // Separate test for out-of-area agent route eligibility check
  test('Out-of-area agent: ineligible pickup request cannot be claimed and remains unchanged', async ({
    page,
  }) => {
    // Reset demo store
    resetDemoData();

    // Add an out-of-area pending request in Ward 600099
    const state = getStoreState();
    const outsideReq: ManualPickupRequestItem = {
      id: 'req-outside-99',
      consumer_id: 'c1d2e3f4-a5b6-7890-1234-56789abcdef0',
      consumer_name: 'Distant Resident',
      consumer_mobile: '9876543210',
      waste_type: 'BULK',
      preferred_date: '2026-11-25',
      address: '99 Outer Bypass Road',
      area_code: '600099', // Outside Ramesh's assigned wards (600001, 600040)
      status: 'PENDING',
      created_at: '2026-11-17T14:00:00Z',
    };
    state.pickupRequests.push(outsideReq);

    await page.exposeFunction('__SHARED_GET_REQUESTS__', () => getStoreState().pickupRequests);
    await page.exposeFunction('__SHARED_CLAIM_FIXTURE__', (id: string, agentUserId: string) =>
      claimPickupRequestInStore(id, agentUserId)
    );

    // Login as Agent Ramesh Kumar (assigned to 600001, 600040)
    await page.goto('/login');
    await page.locator('[data-testid="quick-login-agent"]').click();
    await expect(page).toHaveURL(/\/agent/);

    await page.goto('/agent/requests');
    await expect(page.locator('[data-testid="agent-requests-page"]')).toBeVisible();

    // 1. Verify req-outside-99 is NOT shown in Ramesh's filtered request list
    await expect(page.locator('[data-testid="request-row-req-outside-99"]')).not.toBeVisible();

    // 2. Attempt direct claim for out-of-area request via the unified claim endpoint
    const claimOutcome = await page.evaluate(async (reqId) => {
      try {
        const token = sessionStorage.getItem('smartwaste_demo_session');
        const parsed = token ? JSON.parse(token) : null;
        const res = await fetch(`/api/v1/agent/requests/${reqId}/claim`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${parsed?.access_token || ''}`,
          },
        });
        const data = await res.json();
        return { status: res.status, data };
      } catch (e: unknown) {
        return { status: 0, error: (e as Error).message };
      }
    }, 'req-outside-99');

    // Assert claim rejected with 403 OUTSIDE_ASSIGNED_ROUTE
    expect(claimOutcome.status).toBe(403);
    expect(claimOutcome.data?.errors?.error_code).toBe('OUTSIDE_ASSIGNED_ROUTE');

    // 3. Verify request remains PENDING and unassigned in the store
    const storeAfter = getStoreState();
    const targetAfter = storeAfter.pickupRequests.find((r) => r.id === 'req-outside-99');
    expect(targetAfter?.status).toBe('PENDING');
    expect(targetAfter?.claimed_by_agent_id).toBeUndefined();
  });
});
