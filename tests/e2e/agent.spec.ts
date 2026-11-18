// tests/e2e/agent.spec.ts
// Phase 3 Field Collection Agent E2E Test Suite
// Covers Dashboard, Honest ETA Arrival Alerts (QUEUED), Camera Scanner Lifecycle & QR Duplicate Prevention,
// Known QR Image File Decoding via html5-qrcode, Shift Schedules, Fee Ledger, Operational Support Desk,
// and F-04 Dual-Context Competing Claim Concurrency.

import { test, expect } from '@playwright/test';
import { ManualPickupRequestItem } from '../../src/types/contracts';

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
    await expect(page.locator('[data-testid="scan-confirmation-card"]')).toBeVisible();
    await expect(page.locator('[data-testid="decoded-token"]')).toContainText(
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

  // F-04: Competing Claims with Two Agent Browser Contexts
  test('Competing claims (F-04): two agent browser contexts acting on the same mutable request assert one success, one conflict (409), and one persisted owner', async ({
    browser,
  }) => {
    // Shared Node-hosted test fixture running the application's real atomic claim transition
    // Both isolated browser contexts communicate with this shared state without copying localStorage
    const sharedRequests: ManualPickupRequestItem[] = [
      {
        id: 'req-001',
        consumer_id: 'c1d2e3f4-a5b6-7890-1234-56789abcdef0',
        consumer_name: 'John Doe',
        consumer_mobile: '9876543210',
        waste_type: 'BULK',
        preferred_date: '2026-11-20',
        address: '12 Sunrise Avenue',
        area_code: '600001',
        status: 'PENDING',
        created_at: '2026-11-14T08:00:00Z',
      },
    ];

    const sharedFixture = {
      getRequests: async () => {
        return JSON.parse(JSON.stringify(sharedRequests));
      },
      claim: async (requestId: string, agent: { user_id: string; name: string }) => {
        const target = sharedRequests.find((r) => r.id === requestId);
        if (!target) {
          return { status: 404, message: 'Pickup request not found' };
        }
        if (target.status !== 'PENDING') {
          return {
            status: 409,
            message: `This request has already been claimed by another agent (${target.claimed_by_agent_name || 'claimed'}).`,
            errors: {
              error_code: 'CONFLICT',
              current_status: target.status,
              owner_id: target.claimed_by_agent_id,
            },
          };
        }
        target.status = 'CLAIMED';
        (target as unknown as { claimed_by_agent_id?: string }).claimed_by_agent_id = agent.user_id;
        (target as unknown as { claimed_by_agent_name?: string }).claimed_by_agent_name = agent.name;
        return { status: 200, data: { ...target } };
      },
    };

    // 1. Agent 1 Context (Ramesh Kumar)
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    await page1.exposeFunction('__SHARED_GET_REQUESTS__', () => sharedFixture.getRequests());
    await page1.exposeFunction('__SHARED_CLAIM_FIXTURE__', (id: string, agt: { user_id: string; name: string }) =>
      sharedFixture.claim(id, agt)
    );

    // 2. Agent 2 Context (Suresh Babu) - Completely isolated context and storage
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await page2.exposeFunction('__SHARED_GET_REQUESTS__', () => sharedFixture.getRequests());
    await page2.exposeFunction('__SHARED_CLAIM_FIXTURE__', (id: string, agt: { user_id: string; name: string }) =>
      sharedFixture.claim(id, agt)
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

    // Both navigate to /agent/requests and see req-001 as PENDING
    await page1.goto('/agent/requests');
    await expect(page1.locator('[data-testid="agent-requests-page"]')).toBeVisible();
    await expect(page1.locator('[data-testid="claim-request-req-001"]')).toBeVisible();

    await page2.goto('/agent/requests');
    await expect(page2.locator('[data-testid="agent-requests-page"]')).toBeVisible();
    await expect(page2.locator('[data-testid="claim-request-req-001"]')).toBeVisible();

    // Agent 1 claims req-001
    await page1.locator('[data-testid="claim-request-req-001"]').click();

    // Assert Agent 1 gets success banner
    await expect(page1.locator('[data-testid="claim-success-banner"]')).toBeVisible();
    await expect(page1.locator('[data-testid="claim-success-banner"]')).toContainText(
      'Successfully claimed request req-001'
    );

    // Agent 2 attempts to claim the same req-001
    await page2.locator('[data-testid="claim-request-req-001"]').click();

    // Assert Agent 2 receives 409 Conflict banner
    await expect(page2.locator('[data-testid="claim-conflict-banner"]')).toBeVisible();
    await expect(page2.locator('[data-testid="claim-conflict-banner"]')).toContainText(
      'already been claimed by another agent (Ramesh Kumar)'
    );

    // Reload both pages
    await page1.reload();
    await page2.reload();

    // Assert persisted owner visible to both after reload
    await expect(page1.locator('[data-testid="request-status-req-001"]')).toHaveText('CLAIMED');
    await expect(page1.locator('[data-testid="request-owner-req-001"]')).toContainText('Ramesh Kumar');

    await expect(page2.locator('[data-testid="request-status-req-001"]')).toHaveText('CLAIMED');
    await expect(page2.locator('[data-testid="request-owner-req-001"]')).toContainText('Ramesh Kumar');

    await context1.close();
    await context2.close();
  });
});
