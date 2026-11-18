# GREENPULSE CITY — DEMO TOWN SPECIFICATION & SEED DATASET

**Mock Schema Version:** `1.0.0`  
**Operational Timezone:** `Asia/Kolkata` (IST, UTC+05:30)  
**Currency:** Indian Rupee (`₹` / `INR`)

---

## 1. Fictional Town & Area Codes
* **Town Name:** **GreenPulse City** (Corporation of GreenPulse)
* **Wards / Area Codes:**
  * `600001` — North Ward (Harbour & Marina Zone)
  * `600002` — Central Commercial District
  * `600040` — Anna Nagar Green Enclave (Residential High-Density)
  * `600096` — South Eco Suburb

---

## 2. Default Seed Accounts (3 Roles)

### Consumer
* **Name:** John Doe
* **Mobile Number:** `9876543210`
* **Password:** `Consumer@123`
* **Role:** `CONSUMER`
* **User ID:** `c1d2e3f4-a5b6-7890-1234-56789abcdef0`
* **Address:** 14/B, Sunrise Avenue, Harbour Zone
* **Area Code:** `600001`
* **QR Payload (Opaque Token):** `GPC-QR-CONS-C1D2E3F4A5B67890`
* **Initial Dues:** `₹150.00` (Due by end of current month)

### Admin
* **Name:** Satish Nair (Chief Sanitation Officer)
* **Username:** `admin`
* **Password:** `Admin@123`
* **Role:** `ADMIN`
* **User ID:** `d2e3f4a5-b6c7-8901-2345-67890abcdef1`
* **Designation:** Master Operations & Scheduler Controller

### Collection Agent 1 (Primary for Area 600001 & 600040)
* **Name:** Ramesh Kumar
* **Mobile Number:** `9876543210` *(shared mobile for demo selector convenience or dedicated 9876543220)*
* **Password:** `Agent@123`
* **Role:** `AGENT`
* **User ID:** `a1b2c3d4-e5f6-7890-1234-56789abcdef0`
* **Vehicle ID:** `TN-01-WM-4042`
* **Assigned Area Codes:** `["600001", "600040"]`

### Collection Agent 2 (Secondary for Area 600002 & 600096)
* **Name:** Suresh Babu
* **Mobile Number:** `9876543211`
* **Password:** `Agent@123`
* **Role:** `AGENT`
* **User ID:** `a2b3c4d5-e6f7-8901-2345-67890abcdef2`
* **Vehicle ID:** `TN-01-WM-5120`
* **Assigned Area Codes:** `["600002", "600096"]`

---

## 3. Seed Households (10 Households)

| # | Household ID | Resident Name | Area Code | Address | QR Payload (Opaque Demo Token) | Status |
|---|---|---|---|---|---|---|
| 1 | `hh-001` (matches John) | John Doe | 600001 | 14/B Sunrise Ave | `GPC-QR-CONS-C1D2E3F4A5B67890` | Pending Pickup |
| 2 | `hh-002` | Priya Raman | 600001 | 16/A Sunrise Ave | `GPC-QR-CONS-88A190BC33D14120` | Collected |
| 3 | `hh-003` | Karthik Sundaram | 600001 | 22 Palm Grove St | `GPC-QR-CONS-77B289CD44E25231` | Pending Pickup |
| 4 | `hh-004` | Ananya Krishnan | 600001 | 5 Harbour View Road | `GPC-QR-CONS-66C378DE55F36342` | Pending Pickup |
| 5 | `hh-005` | Vignesh Iyer | 600002 | 102 Market St | `GPC-QR-CONS-55D467EF66A47453` | Collected |
| 6 | `hh-006` | Deepa Menon | 600002 | 88 Grand Mall Bypass | `GPC-QR-CONS-44E556FA77B58564` | Pending Pickup |
| 7 | `hh-007` | Rajesh Verma | 600040 | 12 2nd Avenue, Anna Nagar | `GPC-QR-CONS-33F645AB88C69675` | Pending Pickup |
| 8 | `hh-008` | Meenakshi Natarajan| 600040 | 45 4th Main Road, Anna Nagar | `GPC-QR-CONS-22A734BC99D70786` | Pending Pickup |
| 9 | `hh-009` | Balaji Govind | 600096 | 7 Eco Garden Way | `GPC-QR-CONS-11B823CD00E81897` | Collected |
| 10| `hh-010` | Shweta Rao | 600096 | 19 Lakeview Crescent | `GPC-QR-CONS-00C912DE11F92908` | Pending Pickup |

---

## 4. Master Schedules & Statuses

Three Schedule Statuses:
* `ASSIGNED` — Shift scheduled and allocated to an agent
* `IN_PROGRESS` — Route active today; agent dispatched
* `COMPLETED` — Pickups recorded and shift concluded
*(Plus `CANCELLED` for revoked shifts)*

### Seed Schedule Slots:
1. `f5e4d3c2-b1a0-9876-5432-109876abcdef`:
   * Area: `600001`
   * Date: `2026-11-15`
   * Time: `07:00:00` - `11:00:00`
   * Assigned Agent: `a1b2c3d4-e5f6-7890-1234-56789abcdef0` (Ramesh Kumar)
   * Status: `ASSIGNED`
2. `f5e4d3c2-b1a0-9876-5432-109876abcde2`:
   * Area: `600040`
   * Date: `2026-11-18`
   * Time: `08:00:00` - `12:00:00`
   * Assigned Agent: `a1b2c3d4-e5f6-7890-1234-56789abcdef0` (Ramesh Kumar)
   * Status: `ASSIGNED`
3. `f5e4d3c2-b1a0-9876-5432-109876abcde3`:
   * Area: `600002`
   * Date: `2026-11-18`
   * Time: `06:30:00` - `10:30:00`
   * Assigned Agent: `a2b3c4d5-e6f7-8901-2345-67890abcdef2` (Suresh Babu)
   * Status: `ASSIGNED`

---

## 5. Ledger & Invoice Fixtures

* **Invoice 1 (Paid):**
  * ID: `inv-2026-10-001`
  * Consumer: `c1d2e3f4-a5b6-7890-1234-56789abcdef0` (John Doe)
  * Period: October 2026 Monthly Sanitation Fee
  * Amount: `₹150.00`
  * Status: `PAID`
  * Paid At: `2026-10-05T10:30:00Z`
  * Razorpay Payment ID: `pay_demo_oct102938475`
* **Invoice 2 (Unpaid / Current Due):**
  * ID: `inv-2026-11-002`
  * Consumer: `c1d2e3f4-a5b6-7890-1234-56789abcdef0` (John Doe)
  * Period: November 2026 Monthly Sanitation Fee
  * Amount: `₹150.00`
  * Status: `UNPAID`
  * Due Date: `2026-11-30`
* **Invoice 3 (Failed Attempt):**
  * ID: `inv-2026-11-fail-001`
  * Consumer: `c1d2e3f4-a5b6-7890-1234-56789abcdef0` (John Doe)
  * Amount: `₹150.00`
  * Status: `FAILED`
  * Failure Reason: `BANK_DECLINED_SIMULATED`
  * Timestamp: `2026-11-10T14:15:00Z`

---

## 6. Seed Notifications (Inbox)

1. `c3d4e5f6-1234-5678-90ab-cdef12345678`:
   * Title: "Agent Arriving Soon"
   * Body: "Your waste collection agent is 5 minutes away."
   * Status: `UNREAD`
   * Created At: `2026-11-14T18:40:00Z`
2. `d4e5f6a7-2345-6789-01bc-def234567890`:
   * Title: "Monthly Billing Generated"
   * Body: "Your waste fee of ₹150 for November 2026 is ready for payment."
   * Status: `READ`
   * Created At: `2026-11-01T09:00:00Z`

---

## 7. Seed Support Tickets

1. `tkt-001`:
   * Consumer: John Doe
   * Category: Missed Pickup
   * Subject: "Delay in Thursday morning pickup"
   * Description: "Pickup truck did not arrive during the scheduled 07:00-11:00 window."
   * Status: `IN_PROGRESS`
2. `tkt-002`:
   * Consumer: Priya Raman
   * Category: Billing
   * Subject: "Double charge inquiry"
   * Description: "Card was deducted twice on Oct 5; please reconcile."
   * Status: `RESOLVED`
