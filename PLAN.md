# SMART WASTE MANAGEMENT SYSTEM — REVIEWED MASTER FRONTEND + ANDROID APK PLAN (`PLAN.md`)

**Version:** 2.1 — 18 November 2026  
**Scope:** React + Vite + TypeScript frontend, three role modules, mock-backed demo, Capacitor Android APK, integration with the separately developed backend.  

> **AI AGENT DIRECTIVE — READ BEFORE CODING**
>
> 1. Treat **Section 3 as LOCKED**: do not rename an endpoint, query parameter, response key, request key, role or HTTP method in its examples. This section is reproduced **verbatim from the user's uploaded plan**.
> 2. Treat **Section 4 as PROPOSED BACKEND GAP CONTRACTS, NOT CONFIRMED APIs**. Maintain the existing proposals and `// TODO_BACKEND_SATHEESH` markers; a successful mock is not evidence of a live endpoint. Obtain backend agreement before live integration.
> 3. Do not invent backend endpoints (`/refresh`, `/webhook`, `/logout`, etc.) or claim they already exist. Record missing server capabilities as **backend decisions**, with temporary demo-only behavior.
> 4. Complete working flows for `CONSUMER`, `AGENT`, `ADMIN`. Use the exact fields returned by the selected contract; don't assume auth's `{ success, data }` wrapper exists for schedules or notifications.
> 5. `VITE_USE_MOCK_API=true` is the **local demo default only**. Production builds MUST use `false`, with an automated fail-fast guard if demos/mocks remain enabled. Mock data is fake, not production-ready.
> 6. Work in phases; implement, test and commit one phase at a time. Do not replace the chosen React/Vite/TypeScript + Capacitor architecture.

## 0. PRODUCT BOUNDARY AND DELIVERABLES

### Product roles
- **Consumer:** register/log in, view dues and pickup timetable, display household QR, request ad-hoc pickup, pay and view receipts/history, raise support tickets, read notifications.
- **Collection Agent:** log in, view own daily assignments, notify arrival, scan and verify collection QR, claim eligible manual requests, view permitted fee history, raise tickets.
- **Admin:** log in, overview KPIs, manage schedules and assignments, notifications, customers/agents, fees, requests, banking configuration and support.

### Three different delivery modes (never mix them)
| Mode | API/data source | Checkout | Push | Intended result |
|---|---|---|---|---|
| **Browser demo** | Persistent mock adapter + seeded fake users | Clearly labeled simulated checkout; optional Razorpay **test** only once backend order/verify test is wired | Simulated inbox/toasts | Stakeholder demo on localhost |
| **APK demo** | Same mock adapter embedded in APK | Simulated test flow; avoid claiming real UPI works in WebView | Simulated inbox; real FCM only when configured and reachable | Installable Android debug APK, test on actual device |
| **Backend-connected pilot / production** | HTTPS REST, real auth and server-side RBAC | Approved Razorpay integration with verified backend and webhooks | FCM + REST-backed inbox | Environment-integrated Android/web release after security/UAT sign-off |

**Out of scope until separately contracted:** real scheduled AutoPay mandates/subscriptions; GPS-based accurate ETA; offline queue/reconciliation; real collections without backend receipt; app-store release and production merchant onboarding. Show these as **Coming Soon / Demo Only** rather than delivering dead buttons or misrepresenting support.

---

## 1. TECH STACK & SYSTEM ARCHITECTURE

- **Framework:** React + TypeScript + Vite. Pick and lock compatible package versions in `package-lock.json`; use `npm ci` on CI. Do not silently upgrade major package versions mid-project.
- **Android wrapper:** Capacitor (`@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, `@capacitor/push-notifications`), versions kept in the same supported major range.
- **UI:** Tailwind CSS, `lucide-react`, `recharts`, `react-hot-toast`; responsive, touch-first, accessible design.
- **Routing:** `react-router-dom` v6 as specified originally (or a migration only with explicit approval). Role-specific navigation and `ProtectedRoute` control UI access; **backend must independently enforce roles and ownership**.
- **Networking:** Axios client with bearer interceptor, timeout, cancellation, typed error handling and well-defined loading/empty/error states.
- **Mock engine:** `axios-mock-adapter` (install explicitly); in browser localStorage is a fake demo DB. Mock permission checks and state transitions must mirror intended backend rules.
- **QR:** `qrcode.react` for rendering, `html5-qrcode` for camera capture with explicit permission and manual/demo simulation. QR contents are **not automatically encrypted** by either library.
- **Payments:** Razorpay test-only for browser integration when backend is actually available. For native APK, assess Razorpay's supported **Capacitor/native integration** and test UPI intent on physical devices. Never assume the Checkout JS WebView flow supports all payment methods.
- **Notifications:** Capacitor push plugin for Android/FCM; the REST inbox from locked Section 3; mock inbox/toasts for no-backend demonstrations.
- **Testing:** Vitest for unit, contract-fixture and mock-store flow tests; **Playwright (`@playwright/test`)** for browser E2E smoke tests that drive the real UI against the demo build (login per role, navigation guards, cross-role flows). Playwright covers the web build only; Android WebView/device behavior is still verified by the Phase 5 device smoke test.
- **Security:** Always HTTPS against live APIs; strict environment gates, no hardcoded production keys, no secrets in frontend bundles, authorization from server responses, secure handling of access/refresh tokens.

### Authentication/token handling decision
- During a **mock demo**, issue fake short-lived session strings from a fixture; store only fake data. Label demo credentials clearly and exclude them from production builds.
- In **backend-connected mode**, prefer in-memory access tokens, and use an audited native secure-storage solution for sensitive persistent refresh tokens if approved. **Never put real refresh tokens in localStorage**. On browser, an alternative is an agreed secure HttpOnly cookie design, which would require backend coordination.
- Since **Section 3 has NO refresh/logout API**, don't invent either. On expiry/401, clear the client session and require login until backend supplies an approved refresh lifecycle. Never retry a payment/scan POST automatically on 401.
- Role selector on login only chooses the login request's `type`; the authenticated role comes from `data.role` returned by the backend. No client-controlled role elevation.

---

## 2. PROJECT DIRECTORY STRUCTURE (BASELINE + NECESSARY ADDITIONS)

```text
root/
├── PLAN.md
├── .env.example                 # Safe non-secret defaults
├── .env.demo                    # VITE_USE_MOCK_API=true; test-only
├── .env.production              # VITE_USE_MOCK_API=false; no demo tools
├── capacitor.config.ts          # webDir=dist, appId, appName
├── playwright.config.ts         # baseURL = vite preview of build:demo, Chromium + mobile viewport
├── package.json
├── src/
│   ├── api/
│   │   ├── axiosClient.ts        # Base URL, bearer, timeout, 401/no unsafe retries
│   │   ├── mockData.ts           # Deterministic per-role seed fixtures
│   │   ├── mockAdapter.ts        # Only registered in demo mode
│   │   ├── mockStore.ts          # Persistent mock transitions, idempotency/seed reset
│   │   ├── authService.ts        # Section 3.1
│   │   ├── scheduleService.ts    # Section 3.2
│   │   ├── notificationService.ts# Section 3.3
│   │   └── backendGapService.ts  # Section 4 TODO_BACKEND_SATHEESH
│   ├── components/
│   │   ├── layout/AppShell.tsx
│   │   ├── layout/ProtectedRoute.tsx
│   │   ├── layout/LoadingEmptyError.tsx
│   │   ├── qr/ConsumerQRCard.tsx
│   │   ├── qr/AgentQRScanner.tsx
│   │   ├── payment/RazorpayCheckout.tsx
│   │   ├── payment/InvoiceModal.tsx
│   │   └── notifications/NotificationDrawer.tsx
│   ├── context/AuthContext.tsx
│   ├── hooks/useConnectivity.ts
│   ├── lib/env.ts               # Guard against demo flags in prod
│   ├── lib/dateTime.ts          # YYYY-MM-DD, local schedules / UTC logs
│   ├── lib/formatters.ts        # INR, units, statuses
│   ├── pages/
│   │   ├── auth/{UnifiedLoginPage,ConsumerRegisterPage}.tsx
│   │   ├── consumer/{ConsumerDashboard,ConsumerSchedulePage,ConsumerPaymentPage,ConsumerManualRequestPage,ConsumerProfileQRPage,ConsumerSupportPage}.tsx
│   │   ├── agent/{AgentDashboard,AgentSchedulePage,AgentQRScanPage,AgentManualRequestsPage,AgentFeeHistoryPage,AgentSupportPage}.tsx
│   │   └── admin/{AdminDashboard,AdminSchedulerPage,AdminFeeHistoryPage,AdminNotificationsPage,AdminCustomersPage,AdminAgentsPage,AdminRequestsPage,AdminBankingPage,AdminSupportPage}.tsx
│   ├── types/contracts.ts
│   ├── App.tsx
│   └── main.tsx
├── tests/
│   ├── contracts/                # Verbatim Section 3 fixture assertions
│   ├── flows/                    # Cross-role mock state tests (Vitest)
│   ├── e2e/                      # Playwright browser specs (auth, consumer, agent, admin, cross-role)
│   └── smoke/                    # Android device acceptance checklist
└── android/                      # Generated exactly once by `npx cap add android`
```

The brace-group syntax above is **shorthand**, not literal filenames: each listed component/page is its own `.tsx` file. Keep a consistent file casing and correct imports. Do not re-scaffold an existing project.

---

## 3. LOCKED BACKEND API CONTRACTS (DO NOT MODIFY PAYLOADS)

### 3.1 Common Authentication Contract (`POST /api/v1/auth/login`)
* **Endpoint:** `POST /api/v1/auth/login`
* **Request Body by Role:**
  * **Consumer:**
    ```json
    {
      "mobile_number": "9876543210",
      "password": "Consumer@123",
      "type": "CONSUMER"
    }
    ```
  * **Admin:**
    ```json
    {
      "username": "admin",
      "password": "Admin@123",
      "type": "ADMIN"
    }
    ```
  * **Collection Agent:**
    ```json
    {
      "mobile_number": "9876543210",
      "password": "Agent@123",
      "type": "AGENT"
    }
    ```
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Consumer login successful",
    "statusCode": 200,
    "data": {
      "user_id": "c1d2e3f4-a5b6-7890-1234-56789abcdef0",
      "name": "John",
      "username": "admin",
      "mobile_number": "9876543210",
      "role": "CONSUMER",
      "access_token": "jwt_access_token",
      "refresh_token": "jwt_refresh_token",
      "token_type": "Bearer",
      "expires_in": 3600
    },
    "errors": null
  }
  ```
  *(Note: `username` is returned for `ADMIN`; `name` and `mobile_number` are returned for `CONSUMER` and `AGENT`.)*
* **Standard Error Response (`400 / 401 / 403 / 500`):**
  ```json
  {
    "success": false,
    "message": "Invalid username/mobile number or password",
    "statusCode": 401,
    "data": null,
    "errors": {
      "error_code": "INVALID_CREDENTIALS"
    }
  }
  ```

---

### 3.2 Scheduler Contract

#### A. Admin API: Retrieve Master Schedules
* **Endpoint:** `GET /api/v1/admin/schedules`
* **Auth:** Bearer Token (`ADMIN`)
* **Query Params:** `start_date` (Req, YYYY-MM-DD), `end_date` (Req, YYYY-MM-DD), `area_code` (Opt), `assigned_agent_id` (Opt, UUID), `page` (Default 0), `size` (Default 20)
* **Response (`200 OK`):**
  ```json
  {
    "content": [
      {
        "id": "f5e4d3c2-b1a0-9876-5432-109876abcdef",
        "area_code": "600001",
        "scheduled_date": "2026-11-15",
        "start_time": "07:00:00",
        "end_time": "11:00:00",
        "assigned_agent_id": "a1b2c3d4-e5f6-7890-1234-56789abcdef0",
        "status": "ASSIGNED"
      }
    ],
    "page_number": 0,
    "page_size": 20,
    "total_elements": 45,
    "total_pages": 3,
    "last": false
  }
  ```

#### B. Collection Agent API: Retrieve Assigned Tasks
* **Endpoint:** `GET /api/v1/agent/schedules`
* **Auth:** Bearer Token (`AGENT` — `agent_id` extracted from JWT)
* **Query Params:** `start_date` (Req, YYYY-MM-DD), `end_date` (Req, YYYY-MM-DD), `start_time` (Opt, HH:mm:ss), `end_time` (Opt, HH:mm:ss), `page` (Default 0), `size` (Default 20)
* **Response (`200 OK`):**
  ```json
  {
    "content": [
      {
        "id": "f5e4d3c2-b1a0-9876-5432-109876abcdef",
        "area_code": "600001",
        "scheduled_date": "2026-11-15",
        "start_time": "07:00:00",
        "end_time": "11:00:00",
        "status": "ASSIGNED"
      }
    ],
    "page_number": 0,
    "page_size": 20,
    "total_elements": 12,
    "total_pages": 1,
    "last": true
  }
  ```

#### C. Consumer API: Retrieve Neighborhood Timetable
* **Endpoint:** `GET /api/v1/consumer/schedules`
* **Auth:** Bearer Token (`CONSUMER`)
* **Query Params:** `area_code` (Req, String), `start_date` (Opt, Default today), `end_date` (Opt, Default today+30d), `page` (Default 0), `size` (Default 10)
* **Response (`200 OK`):**
  ```json
  {
    "content": [
      {
        "id": "f5e4d3c2-b1a0-9876-5432-109876abcdef",
        "scheduled_date": "2026-11-15",
        "start_time": "07:00:00",
        "end_time": "11:00:00",
        "status": "ASSIGNED"
      }
    ],
    "page_number": 0,
    "page_size": 10,
    "total_elements": 8,
    "total_pages": 1,
    "last": true
  }
  ```

---

### 3.3 Push & In-App Notification Contract

#### A. Device Token Registration (All Roles)
* **Endpoint:** `POST /api/v1/notifications/device-token`
* **Request Body:** `{ "device_id": "string", "token": "string", "platform": "ANDROID" }`
* **Response (`200 OK`):** `{ "message": "Device token registered successfully", "updated_at": "2026-11-14T18:30:00Z" }`

#### B. Admin API: Bulk / Location-Based Dispatch
* **Endpoint:** `POST /api/v1/admin/notifications/send`
* **Auth:** Bearer Token (`ADMIN`)
* **Request Body:**
  ```json
  {
    "title": "Collection Update",
    "body": "Due to heavy traffic, collection will be delayed by 1 hour today.",
    "target_type": "PINCODE",
    "target_value": "600040"
  }
  ```
  *(Allowed `target_type`: `PINCODE`, `STREET_NAME`, `DISTRICT`, `ROLE`, `ALL`)*
* **Response (`202 Accepted`):**
  ```json
  {
    "dispatch_id": "a1b2c3d4-e5f6-7890-1234-56789abcdef0",
    "status": "QUEUED",
    "target_type": "PINCODE",
    "target_value": "600040",
    "timestamp": "2026-11-14T18:35:00Z"
  }
  ```

#### C. Agent API: Task-Based Dispatch ("Notify Arrival")
* **Endpoint:** `POST /api/v1/agent/notifications/send`
* **Auth:** Bearer Token (`AGENT`)
* **Request Body:**
  ```json
  {
    "title": "Agent Arriving Soon",
    "body": "Your waste collection agent is 5 minutes away.",
    "target_user_id": "uuid-of-the-consumer"
  }
  ```
* **Response (`202 Accepted`):**
  ```json
  {
    "dispatch_id": "f5e4d3c2-b1a0-9876-5432-109876abcdef",
    "status": "QUEUED",
    "target_user_id": "uuid-of-the-consumer",
    "timestamp": "2026-11-14T18:40:00Z"
  }
  ```

#### D. Fetch Notification History (Inbox - All Roles)
* **Endpoint:** `GET /api/v1/notifications?unread_only=false&page=0&size=20`
* **Response (`200 OK`):**
  ```json
  {
    "content": [
      {
        "id": "c3d4e5f6-1234-5678-90ab-cdef12345678",
        "title": "Agent Arriving Soon",
        "body": "Your waste collection agent is 5 minutes away.",
        "status": "UNREAD",
        "created_at": "2026-11-14T18:40:00Z"
      }
    ],
    "page_number": 0,
    "page_size": 20,
    "total_elements": 2,
    "total_pages": 1,
    "last": true
  }
  ```

#### E. Mark Notification as Read
* **Endpoint:** `PATCH /api/v1/notifications/{notification_id}/read`
* **Response (`200 OK`):** `{ "id": "c3d4e5f6-1234-5678-90ab-cdef12345678", "status": "READ", "updated_at": "2026-11-14T18:45:00Z" }`

---

## 4. BACKEND GAP-FILLER CONTRACTS (FOR SATHEESH TO IMPLEMENT)

All **proposed** endpoints below must be represented in `src/api/backendGapService.ts` with `// TODO_BACKEND_SATHEESH` comments and complete demo-only mock implementations in `mockAdapter.ts`. **They are not confirmed implemented backend APIs.**

| # | Feature / Screen | Suggested Endpoint | Method | Request / Response Summary |
|---|---|---|---|---|
| **1** | **Consumer Registration & QR** | `/api/v1/consumers/register` | `POST` | **Req:** `{ name, mobile_number, email, address, area_code, password }` <br> **Res:** `{ user_id, qr_code_payload, area_code }` |
| **2** | **Consumer Dashboard & Profile** | `/api/v1/consumers/me/dashboard` <br> `/api/v1/consumers/me/profile` | `GET`, `PUT` | **Res:** `{ pending_amount: 150, due_date, next_schedule, qr_payload, recent_pickups: [] }` |
| **3** | **Scheduler Write Operations** | `/api/v1/admin/schedules` <br> `/api/v1/agent/schedules` | `POST`, `PUT`, `DELETE` | Create/Update/Delete schedule slots (`area_code`, `scheduled_date`, `start_time`, `end_time`, `assigned_agent_id`). |
| **4** | **Agent QR Scan Verification** | `/api/v1/agent/collections/scan-qr` | `POST` | **Req:** `{ qr_payload, consumer_id, waste_weight_kg, notes }` <br> **Res:** `{ collection_id, status: "COLLECTED", timestamp }` |
| **5** | **Payments & Razorpay Verify** | `/api/v1/payments/create-order` <br> `/api/v1/payments/verify` | `POST` | **Order Res:** `{ order_id, amount, currency: "INR", key_id }` <br> **Verify Res:** `{ invoice_id, status: "PAID", paid_at }` |
| **6** | **Fee Collection History** | `/api/v1/payments/history` | `GET` | **Query:** `start_date`, `end_date`, `status`, `search` (Role-filtered for Consumer, Agent, Admin). |
| **7** | **Manual Pickup Requests** | `/api/v1/requests` <br> `/api/v1/agent/requests/{id}/claim` <br> `/api/v1/admin/requests/{id}/assign` | `POST`, `GET`, `PATCH` | Consumer creates ad-hoc pickup; Agent atomically claims (`CLAIMED`); Admin assigns agent. |
| **8** | **Help & Support Tickets** | `/api/v1/support/tickets` <br> `/api/v1/support/tickets/{id}/status` | `POST`, `GET`, `PATCH` | **Req:** `{ subject, category, description }` <br> **Res:** `{ ticket_id, status: "OPEN"|"IN_PROGRESS"|"RESOLVED" }` |
| **9** | **Admin Dashboard & Master CRUD** | `/api/v1/admin/dashboard` <br> `/api/v1/admin/customers` <br> `/api/v1/admin/agents` <br> `/api/v1/admin/banking` | `GET`, `POST`, `PUT`, `DELETE` | Dashboard KPIs (`total_collected`, `pending_fees`, `covered_areas`, `pending_houses`) + Customer/Agent/Bank CRUD. |

---


### 4.1 Gap contract status and backend handoff rules (ADDED; table above unchanged)

All nine rows above are **suggestions**. Before calling any one live, Satheesh must confirm the method, path, exact request/response JSON, pagination wrapper, authorization, validation, error format and status transition. The frontend must keep a typed adapter and demo implementation until that confirmation.

| Pending server decision | Why required | Safe frontend behavior until confirmed |
|---|---|---|
| **QR signing and validation** | Plain JSON containing a phone number is not private, encrypted, or scan-proof | Render an **opaque mock demo QR token**; submit the `qr_payload` value using the existing proposed scan-QR key; server validates token and resolves ownership once available |
| **Collection duplicate prevention** | Repeated scan, refresh or retry must not credit pickup twice | Mock keyed by household + schedule/date; show `ALREADY_COLLECTED`; server must enforce a unique business transaction/idempotency policy |
| **Payment order/verify request bodies** | Section 4 provides order response but not complete request or verification fields | Build typed placeholders and fake simulator; do not invent production request fields. Coordinate how Razorpay order ID, payment ID and signature are sent to server |
| **Payment webhook / reconciliation** | Browser success cannot prove settlement | Server to validate signature, amount, currency and owner; settle via verified server-side event/status; no real paid invoice without server confirmation |
| **AutoPay** | An AutoPay toggle does not create a subscription/mandate | Hide or disable real enrollment; label as future feature, do not simulate recurring debit |
| **Agent write permission** | Section 3 only confirms read access; Section 4 suggests AGENT write methods | Let agents edit mock personal route notes only if demo permissions permit; do not assume live PUT/DELETE exists |
| **Fee reconciliation** | `total_collected`, `pending_fees`, history and invoices must agree | One mock ledger is the source for all aggregate cards and receipts; backend owns financial ledger in live mode |
| **Identity + target validation** | `target_user_id` must not allow agents to ping any arbitrary person | Require assigned work relationship; rate-limit, authorize and audit on server |
| **Schedules/timezone** | Midnight, local time and overlapping assignments can distort reports | Store schedule times as local date/time in intended operational timezone (Asia/Kolkata for demo); timestamps in ISO UTC; admin create/edit must validate overlap |
| **Registration/profile** | Password and personally identifiable fields must be protected | Client-side validation is UX only; server validates/salts credentials, checks ownership and uses TLS |
| **Support/admin bank details** | Sensitive bank changes need traceability | Demo only; real updates require privileged backend authorisation and audit logs |

### 4.2 API adapters: exact existing contract behavior

1. `POST /api/v1/auth/login` returns the **auth envelope** `{ success, message, statusCode, data, errors }`; get tokens and role from `response.data.data` after validating `success`.
2. `GET /api/v1/{admin|agent|consumer}/schedules` returns **pagination at the root** (`content`, `page_number`, `total_pages`, etc.), not inside `data`.
3. Notifications' `GET` is root-page-shaped too; `POST /api/v1/notifications/device-token` and `PATCH .../read` return unwrapped objects; `POST .../send` returns HTTP **202 QUEUED**, not confirmed delivery.
4. Keep query names in snake_case (`start_date`, `end_date`, `area_code`, etc.). Don't substitute camelCase network payload keys; transform only inside UI view models.
5. Show 401 → clear session; 403 → forbidden; 404 → not found; 409 → conflict; 422/400 → validation; 429 → retry message (no automatic repeat of payment/scan); 5xx/network → retry UX with safe semantics.
6. Do not trust UI-supplied `consumer_id`, amount, area or role for authorization. Server must resolve claims from JWT and its own database.

---

## 5. PHASE-BY-PHASE IMPLEMENTATION WORKFLOW — REVISED

### PHASE 0 — Contract freeze, dependencies and demo data (must precede coding)
- [ ] Copy this file to repository root as `PLAN.md`. Freeze Section 3 sample payloads with fixture tests.
- [ ] Record agreed project package versions/Node LTS/Capacitor major in lockfile; confirm Android Studio + Android SDK installed.
- [ ] Agree on **one fictional demo town**, representative area codes, 3 demo role accounts, two collection agents, ten households, 3 schedule statuses, unpaid/paid/failed invoice examples, support tickets and unread notifications.
- [ ] Add `.env.example` and environment scripts; build-time guard must reject `VITE_USE_MOCK_API=true` in production mode.
- [ ] Define mock state schema version, deterministic seed and **Reset Demo Data** control visible only in demo mode.

### PHASE 1 — Foundation, contract types, auth and mock adapter
1. Scaffold Vite + React + TypeScript + Tailwind, icons, routing, axios and toast. Install `axios-mock-adapter` explicitly.
2. Define TypeScript request/response types *exactly* for the Section 3 examples and proposed Section 4 interfaces with `TODO_BACKEND_SATHEESH` qualifiers. Prefer runtime validation at API boundaries rather than unchecked casts.
3. Build `axiosClient.ts` with an auth interceptor, 15-second timeout, consistent errors, no caching of protected pages and no unsafe POST retries. Add response adapters for envelope vs root page shapes.
4. Mock login with **three distinct demo accounts**, returned roles and fake tokens. Ensure expired token and forbidden-role cases are covered; sign-out clears local app state. Never display production credentials in UI.
5. `mockStore.ts`: one persisted versioned state, atomic *single-tab* updates to schedules/collections/requests/payments/notifications; reconcile a `storage` event across tabs if feasible. This is **not a multi-device server** and not proof of concurrency safety.
6. Build role-specific navigation, accessible forms, skeletons, empty-state/error banners and notification drawer. Quick Demo Login visible only with `VITE_ENABLE_DEMO_TOOLS=true`.
7. Install `@playwright/test` and Chromium (`npx playwright install chromium`), add `playwright.config.ts` with a `webServer` running `npm run build:demo && vite preview`, and write the first spec: login as each role, assert the landing page, assert a cross-role deep link redirects. Each spec resets mock state (Reset Demo Data or cleared localStorage) before running so tests are deterministic.

**Phase 1 exit gate:** each role can login; direct URL cross-role access fails; 401 signs out; all Section 3 response fixtures match; Playwright auth spec passes.

### PHASE 2 — Consumer module (six screens)
1. **Dashboard:** dues in INR, next collection, recent collections and quick actions from state; if no data, show explicit zero/empty state (not sample placeholder numbers).
2. **Schedule:** `GET /api/v1/consumer/schedules` with the authenticated user's valid `area_code`, paginated and date-filtered; local timezone handling and schedule cancellation/empty handling.
3. **QR profile:** use `qr_code_payload` / `qr_payload` from proposed backend response. In the demo, use an **opaque random-looking fixture token**, not phone number/name; never describe `qrcode.react` output as encrypted. Provide fullscreen bright-view, download and stale-token notice.
4. **Payments:** show due/paid/failed/pending. In mock mode, simulate an explicit test confirmation that writes **one** ledger entry/receipt and updates all admin totals. For live Razorpay: request backend order, run approved checkout, send outcome to backend verify, display paid status **only after backend confirms**; handle user cancellation, verify failure and repeated callback. No actual AutoPay until a separate mandate contract exists.
5. **Manual pickup and support:** validate forms, generate ticket/request IDs in mock mode, show state changes after agent claim/admin assignment and notification.
6. **History and invoice:** same ledger drives receipt; differentiate **demo receipt** from legally valid tax invoice. Never invent GST/tax elements or merchant legal details.

**Phase 2 exit gate:** test paying once (and double-clicking); admin total changes exactly once, consumer invoice appears exactly once; registration/login, QR and pickup schedule load. Playwright `consumer.spec.ts` covers register → login → schedule → QR → mock pay (with double-click) → receipt.

### PHASE 3 — Agent module (six screens)
1. **Assigned schedule and route:** `GET /api/v1/agent/schedules` filtered to JWT agent ownership; date/time filter; avoid showing unrelated areas. Mock route notes can be editable; real route write operations remain blocked until backend confirms them.
2. **Agent notification:** allowed consumer on an assigned route only; explicit tap to send `POST /api/v1/agent/notifications/send`; display `QUEUED`, not Delivered. Use an honest manually entered ETA label; do not claim calculated GPS precision.
3. **QR scanner:** start camera only after user action and permission; stop/deallocate camera when leaving page; retry/torch/manual demo fallback. Decode token locally **but never authorize collection locally** in real mode. Call proposed `POST /api/v1/agent/collections/scan-qr`; show server result and prevent duplicate collection; keep existing `{ qr_payload, consumer_id, waste_weight_kg, notes }` proposal untouched. Scan simulation must be hidden on production builds.
4. **Manual claims:** filter eligible `PENDING` requests; mock conflict-aware `PENDING → CLAIMED` transition and owner assignment; server must perform atomic claim; show 409 conflict when already taken.
5. **Fee ledger and support:** filter only agent-authorized records, not full admin banking data.

**Phase 3 exit gate:** consumer QR scans once, retry produces duplicate/conflict; another agent cannot claim the same request; agent cannot send arbitrary user notification. Playwright `agent.spec.ts` uses the demo scan-simulation path (real camera scanning is a device test, M-01); claim conflict is tested with two browser contexts sharing one seeded state.

### PHASE 4 — Admin module (nine screens)
1. **Dashboard:** KPIs and two Recharts visualizations derived from the same ledger/schedule state; zero totals and empty data handled correctly.
2. **Master scheduler:** `GET /api/v1/admin/schedules` locked contract plus *proposed* create/edit/delete methods, role assignment, overlap validation, server conflict response and confirmation for destructive actions. Cancelled schedules are not erased from audit/report history.
3. **Broadcast:** official locked `POST /api/v1/admin/notifications/send`, with each `target_type` (`PINCODE`, `STREET_NAME`, `DISTRICT`, `ROLE`, `ALL`) validated; show `QUEUED` and a mock delivery badge separately.
4. **Operations:** filterable fee history, customers and agents CRUD/deactivation, request assignment, support status actions, banking settings with masked display; all Section 4 operations marked provisional until server agreement.
5. **Accessibility:** mobile/tablet/desktop UX, pagination, confirm modals, keyboard operation, readable charts and robust loading/error indicators.

**Phase 4 exit gate:** schedule created by admin appears on correct consumer/agent views; admin broadcast appears only to matched recipients; payment totals reconcile with consumer receipts. Playwright `cross-role.spec.ts` automates F-01, F-02, F-05 and F-06 end to end in the browser.

### PHASE 5 — Capacitor Android packaging and device validation

**Pre-requisites:** Android Studio, Android SDK, appropriate JDK, a usable emulator and at least one real Android phone. Choose a supported stable matching Capacitor major; avoid mixing major versions.

```bash
# From an existing Vite project root
npm install @capacitor/core @capacitor/android @capacitor/push-notifications
npm install --save-dev @capacitor/cli
npx cap init "SmartWaste" "com.hackathon.smartwaste" --web-dir dist

# Use this sequence ONCE for an initially uncreated Android project
npm run build:demo
npx cap add android
npx cap sync android
npx cap open android
```

For repeat builds, **do not repeat** `npx cap add android`:

```bash
npm run build:demo
npx cap sync android
# On Windows, after Android Studio/Gradle SDK setup:
cd android
.\gradlew.bat assembleDebug
# Output: android/app/build/outputs/apk/debug/app-debug.apk (relative to project root)
```

For macOS/Linux, run `./gradlew assembleDebug` inside `android/`. For signed release APK/AAB, use Android Studio's **Generate Signed Bundle / APK** or a properly configured Gradle release signing workflow; keep keystore/password outside git. `npx cap sync android` does **not** generate an APK by itself.

Android permissions to verify in the *merged* `AndroidManifest.xml` (add only if not already supplied by plugins):

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

**Firebase/FCM:** create a Firebase Android app using the exact application ID, place its `google-services.json` in `android/app/`, configure Firebase tooling/plugin as documented; request Android 13+ notification permission at runtime, call plugin registration, receive FCM token, then call locked `POST /api/v1/notifications/device-token`. Register token again on rotation/login as appropriate. Real push requires working backend dispatch + valid FCM setup; a local toast is not real push.

**Android camera:** prompt permission, test on physical hardware, stop camera on page unmount and when backgrounded, show a permission-denied recovery option; verify secure context and Capacitor WebView behavior.

**Payment SDK gate:** for web browser use Razorpay approved web checkout. For APK, pick/test the Razorpay-supported **Capacitor/native route**, including UPI app-switch and return path on a real phone. Before this passes, the APK provides a clearly labeled *payment simulation only*.

**APK smoke test:** install debug APK; launch offline (mock-only demo screens), login/logout all roles, nav, QR scanning with real camera, denied camera, rotation/back button, test payment simulation, receipt, notifications inbox, persistence after restart. Repeat online with real HTTPS backend only when contracts are approved; verify 401, 403, timeout and recovery.

**Release gate:** `build:prod` disables mocks, demo accounts, simulate buttons, fake payment completion and dev-only logs; real backend URL HTTPS; verified payments and backend roles; privacy/security testing; signed build; tested on minimum supported Android version and current device.

---

## 6. ENVIRONMENT, SECURITY AND UI ENGINEERING RULES

### 6.1 Example safe environment files

```ini
# .env.demo (mock APK / local demo)
VITE_USE_MOCK_API=true
VITE_ENABLE_DEMO_TOOLS=true
VITE_API_BASE_URL=
VITE_APP_MODE=demo
```

```ini
# .env.production (backend-connected build)
VITE_USE_MOCK_API=false
VITE_ENABLE_DEMO_TOOLS=false
VITE_API_BASE_URL=https://api.example.invalid
VITE_APP_MODE=production
```

`https://api.example.invalid` is a **placeholder**, never a deployable endpoint. Replace only after Satheesh confirms the genuine HTTPS API base URL. No JWT secrets, Razorpay `key_secret`, webhook secret, credentials, private Firebase keys or keystores in `.env`, Vite source or compiled frontend. A Razorpay public key ID is not a secret; its secret counterpart is.

Add `package.json` scripts resembling:

```json
{
  "scripts": {
    "dev": "vite --mode demo",
    "build:demo": "vite build --mode demo",
    "build:prod": "vite build --mode production",
    "build": "npm run build:demo",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "typecheck": "tsc --noEmit",
    "lint": "eslint ."
  }
}
```

Install/configure Vitest, Playwright and ESLint before running their scripts; keep Playwright specs out of Vitest's include pattern (`tests/e2e/**` excluded) so the two runners don't collide; build guard must reject production mode if `VITE_USE_MOCK_API=true`, `VITE_ENABLE_DEMO_TOOLS=true` or API URL is missing/placeholder. Also fail on attempted real payment flow while in mock mode. **No live deployment uses the demo-default `build` script**.

### 6.2 Required user experience rules
- Buttons perform real permitted behavior in the **chosen mode**; disabled/unavailable features must say *why* rather than silently no-op.
- Distinguish `PENDING`, `QUEUED`, `CLAIMED`, `ASSIGNED`, `COLLECTED`, `PAID`, `FAILED`, `READ`, `UNREAD` by domain; never treat notification `QUEUED` as delivered.
- Mobile bottom nav has only 3–5 priority items; put remaining pages under a role-specific More menu. Admin large tables use responsive cards on narrow phones.
- Every action: loading spinner, double-submit guard, success/error toast, accessible label and deterministic success state. Confirmation dialogs for deleting/deactivating entities.
- Empty states, retries (idempotent reads only automatically), connectivity indicators and INR (`₹`) currency formatting are required. Do not hide errors or inject placeholder success amounts.
- Do not display phone numbers in QR payload, log PII/credentials or store real bank/payment credentials on device. Respect least privilege and masking.

---

## 7. REQUIRED CONTRACT, FLOW AND SECURITY TEST MATRIX

| ID | Scenario | Pass condition |
|---|---|---|
| C-01 | Three login bodies | Exact Section 3.1 snake_case keys; role selected from server response |
| C-02 | Login errors | 401 invalid credentials; expired session clears UI; 403 cross-role blocked |
| C-03 | Admin/agent/consumer schedules | Correct exact endpoints, query keys and **root pagination** |
| C-04 | Notifications | Register body matches locked fields; `202` is QUEUED; mark-read exact PATCH |
| F-01 | Admin creates schedule | Agent + relevant area consumer see it after relogin; non-matching area does not |
| F-02 | Consumer pays mock ₹150 | Exactly one ledger transaction; one demo receipt; KPI + fee history match; repeat ignored |
| F-03 | Consumer QR scanned | One `COLLECTED`; duplicate does not record another; wrong agent forbidden |
| F-04 | Two agents claim one request | Exactly one succeeds in mock single-store test; backend must enforce atomicity in real life |
| F-05 | Admin broadcast PINCODE | Matching audience gets in-app item; others do not; unread count decrements on PATCH |
| F-06 | Role navigation and profiles | Deep links protected; agent cannot see banking/admin customer master |
| F-07 | Login → expiry → retry | No silent payment retry, no fake paid confirmation |
| F-08 | Backend unavailable / 500 | Visible error, no false success, state preserved for safe retry |
| M-01 | Android camera | Permission grant/deny, actual QR scan, cleanup when leaving screen |
| M-02 | Android build | `build:demo`, sync, Gradle success, installed APK opens all 3 roles |
| M-03 | Production safeguard | `build:prod` fails with mock flag/demo tools enabled and accepts only real HTTPS URL |
| M-04 | FCM (when backend configured) | Device token registered, test push arrives on physical Android app; web inbox synced |
| P-01 | Real Razorpay gate | Backend verifies signature/order/amount; duplicate callback handled; failed payment not marked PAID |
| P-02 | Production payment audit | Bank settlement/reconciliation, webhook/authenticity and invoice rules approved by backend owner |

**Automation split:** C-01–C-04 → Vitest contract fixtures. F-01–F-08 → Vitest mock-store flow tests **and** Playwright browser E2E specs (F-04 uses two browser contexts). M-01, M-02, M-04 → manual/device testing on real Android hardware. M-03 → scripted build checks. P-01/P-02 → backend-owned, verified once live integration exists.

**Test evidence required:** command logs for `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e` (with the Playwright HTML report), `npm run build:demo`, `npm run build:prod` negative/positive checks, Android Gradle debug build, plus screen recording/screenshots of the three roles on an actual device. A plan is not a substitute for test evidence.

---

## 8. DEVELOPMENT PROMPTS — SMALL BATCHES FOR ANTIGRAVITY / CODEX

Use one prompt at a time and review the result before continuing. Keep code reviews focused and don't allow an agent to silently change Section 3.

**Prompt 0 — Contract freeze / audit**
> Read PLAN.md fully. Verify the existing repository. Do not modify locked Section 3 request/response examples. Identify exact dependencies/versions, missing files and whether this repo already has Android/Capacitor. Implement only Phase 0, fixture tests and safe `.env` setup. Report changed files and test results.

**Prompt 1 — Foundation**
> Read PLAN.md. Implement Phase 1 only. Use strict Section 3 shapes (auth envelope, root-page-shaped schedules and notification inbox). Implement versioned single-store demo persistence, fake auth with server-returned roles, guarded routes, no production demo flags. Set up Playwright with the auth spec. Run typecheck, lint, tests and `test:e2e`; report output.

**Prompt 2 — Consumer module**
> Read PLAN.md. Implement Phase 2 with all 6 consumer pages and shared mock state. QR must not expose phone/PII. Payments must be simulation-only until backend verifies Razorpay; no fake AutoPay enrollment, no double credit. Prove mock payment → receipt → admin KPI integration with tests.

**Prompt 3 — Agent module**
> Read PLAN.md. Implement Phase 3 with all 6 agent pages. Handle camera permissions and cleanup, duplicate scan conflicts, role/ownership checks, and single-owner request claims. Keep proposed Section 4 methods behind `TODO_BACKEND_SATHEESH` adapters. Test cross-role state updates.

**Prompt 4 — Admin module**
> Read PLAN.md. Implement Phase 4 with all 9 admin pages. Schedule CRUD must respect proposed-vs-locked API distinction; validate overlap; broadcast target filtering and 202 QUEUED; analytics reconcile to mock ledger. Run acceptance scenarios F-01 through F-08 in both Vitest and Playwright.

**Prompt 5 — Android APK**
> Read PLAN.md. Implement Phase 5 without recreating an existing Android project. Build demo assets, run `npx cap sync android`, build debug APK using Gradle, report exact APK path and device test findings. Add the production mock flag guard; do not claim live Razorpay/FCM without device/backend validation.

**Prompt 6 — Final CodeX review / UAT audit**
> Compare actual source files to every acceptance scenario in Section 7. Confirm no broken imports, dead buttons, unsafe token storage, PII QR data, mock-enabled production builds or invented live endpoints. Run typecheck, lint, tests, Playwright E2E, demo build, production build guard and Gradle APK build. Provide PASS/FAIL evidence per scenario, remaining TODO_BACKEND_SATHEESH items and a precise release-blocker list. Never claim 100% until device tests pass.

---

## 9. BACKEND OWNER HANDOFF: QUESTIONS FOR SATHEESH

1. Can you confirm **each Section 4 provisional route**, exact HTTP method/body/response/error and RBAC? Which are implemented now?
2. How does the backend issue and verify **opaque, expiring QR payloads**? What prevents duplicate collection for same household/schedule?
3. For Razorpay, what are the actual `create-order` request and `verify` request fields, callback fields, status query, webhook verification/reconciliation path, and merchant test credentials procedure? **Do not place secrets in frontend**.
4. Does agent schedule editing exist? Which fields can AGENT change, versus admin only?
5. How is a manual request assigned atomically, and what 409/conflict response should frontend display?
6. Who can send target-user notifications; how is recipient ownership and FCM token lifecycle enforced?
7. What is the agreed local timezone, schedule overlap rule, status enum and cancellation behavior?
8. Are customer deactivation/banking updates audited? What permissions and masking apply?
9. What's the confirmed HTTPS API URL and CORS config for browser; Android app ID/FCM project for APK?
10. Does auth offer a supported **refresh/logout lifecycle**? Until then frontend will log out on expiry; no new endpoint assumed.

---

## 10. REFERENCE DOCUMENTATION (VERIFY AGAINST PINNED VERSIONS)

- Capacitor Android setup/build: <https://capacitorjs.com/docs/android>
- Capacitor plugin push/FCM setup: <https://capacitorjs.com/docs/apis/push-notifications>
- Capacitor CLI build command: <https://capacitorjs.com/docs/cli/commands/build>
- Razorpay payment signature server validation: <https://razorpay.com/security/checklist/>
- Razorpay supported platform integrations: <https://razorpay.com/integrations/>
- Razorpay Capacitor integration reference: <https://github.com/razorpay/razorpay-capacitor>

**Change control:** Section 3 is immutable without explicit contract owner approval. Section 4 may evolve *only after* backend sign-off. Keep a small contract changelog and rerun the test matrix on every approved change.
