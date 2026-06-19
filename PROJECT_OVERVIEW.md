# WorkWise HR SaaS — Detailed Project Overview

WorkWise is a production-grade, multi-tenant HR and Payroll management platform built for the Kenyan market. It handles the full employee lifecycle — from onboarding to payslip delivery — with deep compliance coverage for Kenya's statutory requirements (KRA PAYE, NSSF, SHIF, and AHL).

---

## Table of Contents

1. [Technology Stack](#technology-stack)
2. [Architecture Overview](#architecture-overview)
3. [Backend — Django Apps & Models](#backend--django-apps--models)
4. [Backend — API Endpoints](#backend--api-endpoints)
5. [Backend — Payroll Engine](#backend--payroll-engine)
6. [Backend — Async Tasks (Celery)](#backend--async-tasks-celery)
7. [Backend — Authentication & Security](#backend--authentication--security)
8. [Backend — Audit Trail](#backend--audit-trail)
9. [Frontend — Next.js Application](#frontend--nextjs-application)
10. [Frontend — Pages & Routes](#frontend--pages--routes)
11. [Frontend — State Management & API Layer](#frontend--state-management--api-layer)
12. [Third-Party Integrations](#third-party-integrations)
13. [Deployment & Infrastructure](#deployment--infrastructure)
14. [Environment Variables Reference](#environment-variables-reference)
15. [CI/CD Pipeline](#cicd-pipeline)
16. [Data Security Model](#data-security-model)
17. [Subscription Plans](#subscription-plans)
18. [Directory Structure](#directory-structure)

---

## Technology Stack

### Backend
| Layer | Technology |
|---|---|
| Framework | Django 6.x + Django REST Framework 3.15 |
| Language | Python 3.12 |
| Database | PostgreSQL 16 (production) / SQLite (local dev fallback) |
| Authentication | Clerk (JWT/RS256 via JWKS) + custom `ClerkAuthentication` class |
| Async Tasks | Celery 5.x + Redis 7 broker |
| Cache | Redis (`django-redis`); in-memory `LocMemCache` in dev |
| Task Result Storage | `django-celery-results` (DB-backed) |
| PDF Generation | ReportLab |
| File Storage | AWS S3 (`django-storages[s3]` + `boto3`) |
| Static Files | WhiteNoise (Brotli-compressed) |
| WSGI Server | Gunicorn (4 sync workers, 120 s timeout) |
| M-Pesa Integration | `django-daraja` + custom Daraja B2C/STK views |
| Structured Logging | `python-json-logger` with request-scoped context |
| Field Encryption | AES-256-GCM via `cryptography` (Fernet wrapper) |
| Security Scanning | Bandit (CI only) |
| Webhook Verification | Svix (Clerk webhook signatures) |

### Frontend
| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| Component Library | Shadcn/UI + custom Glassmorphic design system |
| Animations | Framer Motion 12 |
| 3D / WebGL | Three.js + `@react-three/fiber` + `@react-three/drei` |
| Icons | Lucide React |
| HTTP Client | Axios (with Clerk JWT interceptor) |
| Server State | TanStack React Query v5 |
| Client State | Zustand v5 |
| Auth | `@clerk/nextjs` v6 |
| Themes | `next-themes` (light/dark) |
| Date Utilities | `date-fns` |

---

## Architecture Overview

WorkWise uses a **decoupled** architecture:

```
Browser (Next.js)
      │  HTTPS + Bearer JWT (Clerk token)
      ▼
 Nginx (reverse proxy + TLS termination)
      │
      ▼
Django / Gunicorn (:8000)
  ├── REST API  (/api/*)
  ├── Django Admin (/admin/)
  └── Webhook Receiver (/api/webhooks/clerk/)
      │
      ├── PostgreSQL (Supabase or self-hosted)
      ├── Redis (Celery broker + Django cache)
      └── Celery Worker (payroll processing, payslip PDF/email/S3)
```

**Multi-tenancy** is enforced at the ORM level. Every model that holds tenant-scoped data extends `TenantScopedModel`, which automatically filters querysets to the authenticated user's tenant. The tenant is resolved by `ClerkAuthentication` and stored in thread-local context by `TenantMiddleware`.

---

## Backend — Django Apps & Models

The backend is split into eight focused Django apps, plus a shared `config` package.

### `tenants` — Multi-Tenancy Core

**`Tenant`**
- UUID primary key
- `name`, `country` (default: Kenya), `currency` (default: KES)
- `plan`: `STARTER` | `GROWTH` | `BUSINESS` | `ENTERPRISE`
- `subscription_status`: `TRIAL` | `ACTIVE` | `PAST_DUE` | `SUSPENDED` | `CANCELLED`
- `max_employees`: automatically capped by plan (15 / 75 / 300 / unlimited)
- `trial_ends_at`: 14-day trial set on creation
- `kra_pin`, `address`, `phone`

**`MpesaSubscriptionPayment`**
- Tracks M-Pesa STK Push payments made when upgrading a subscription plan
- Fields: `tenant`, `plan`, `phone_number`, `amount`, `status`, `merchant_request_id`, `checkout_request_id`, `result_code`

---

### `users` — Authentication & Team Management

**`User`** (extends `AbstractUser`)
- UUID primary key; email is the login identifier (no username)
- `tenant` (FK → Tenant)
- `role`: `ADMIN` | `HR` | `EMPLOYEE`
- `clerk_id`: Clerk user ID (unique); populated by Clerk webhook on sign-up
- `invite_token`: UUID used for email-based team invitations
- `notification_preferences`: JSON dict of per-user notification toggles (`payroll_run`, `leave_status`, `new_member`, `trial_expiry`)

**`Notification`**
- `type`: `payroll` | `leave` | `employee` | `system`
- `tenant`, `recipient` (FK → User)
- `title`, `message`, `is_read`, `action_url`
- Auto-ordered by `-created_at`

---

### `employees` — Employee Profiles

**`Employee`** (extends `TenantScopedModel`)
- UUID primary key
- `name`, `email`, `phone`, `department`, `job_title`
- `kra_pin`: AES-256-GCM encrypted at the field level (`EncryptedCharField`)
- `employment_type`: `monthly` | `weekly` | `daily` | `hourly`
- `salary_basic` (DecimalField), `allowances` (JSONField — e.g. `{"house": 5000, "transport": 3000}`)
- `payment_method`: `mpesa` | `bank`
- `mpesa_number`: encrypted
- `bank_details`: encrypted JSON (e.g. `{"bank_name": "KCB", "account_number": "123"}`)
- `status`: `active` | `inactive` | `terminated`
- `hire_date`, `termination_date`
- DB indexes on `(tenant, status)`, `(tenant, department)`, `(tenant, created_at)`
- Unique constraint: one email per tenant

---

### `attendance` — Time & Workforce Tracking

**`Attendance`** (extends `TenantScopedModel`)
- `employee` (FK), `date`
- `clock_in`, `clock_out` (TimeField)
- `hours_worked`, `overtime_hours` — auto-calculated in `save()` (overtime = hours > 8)
- `location` (string label), `latitude`, `longitude` (for geofencing validation)
- Unique constraint: one record per `(employee, date)`

Geofencing is configured per-tenant on `PayrollConfig` (`office_latitude`, `office_longitude`, `geofence_radius_meters`). A breach logs a warning but does not block the clock-in.

---

### `leave` — Leave Management

**`LeavePolicy`** (one per tenant, extends `TenantScopedModel`)
- `annual_days` (default 21), `sick_days` (30), `maternity_days` (90), `paternity_days` (14)
- `notice_days` (14) — minimum advance notice for leave requests
- `get_limit(leave_type)` helper returns day cap or `None` for unpaid

**`Leave`** (extends `TenantScopedModel`)
- `employee` (FK), `leave_type`: `annual` | `sick` | `maternity` | `paternity` | `unpaid`
- `start_date`, `end_date`, `reason`
- `status`: `pending` → `manager_approved` → `approved` | `rejected`
- Two-level approval: `manager_approved_by` (FK → User) and `approved_by` (FK → User)
- `days_requested` computed property

**`LeaveBalance`** (per employee, per type, per year)
- `entitled_days` seeded from `LeavePolicy` on creation; can be overridden per employee
- `used_days` updated by Django signal when a leave transitions to `approved`
- `remaining_days` computed property

---

### `payroll` — Payroll Engine & Processing

**`PayrollRun`** (extends `TenantScopedModel`)
- `month`, `year`, `status`: `draft` → `processed` → `approved` → `paid`
- Unique per `(tenant, month, year)`

**`PayrollItem`**
- Linked to `PayrollRun` and `Employee`
- Stores computed: `gross_salary`, `nssf`, `shif`, `ahl`, `paye`, `net_pay`
- `payslip_s3_key`: S3 object path populated after PDF upload (`payslips/{tenant_id}/{year}/{month}/{employee_id}.pdf`)

**`PayrollConfig`** (one per tenant)
- Configurable statutory rates: `nssf_rate`/`nssf_cap`, `shif_rate`/`shif_min`, `ahl_rate`, `personal_relief`
- `paye_bands` (JSON array of `{limit, rate}` objects matching KRA progressive bands)
- Geofencing config: `office_latitude`, `office_longitude`, `geofence_radius_meters`

**`MpesaTransaction`**
- Tracks per-employee B2C disbursement for a payroll run
- `status`: `pending` | `success` | `failed`
- `conversation_id`, `originator_conversation_id`, `result_code`, `result_desc`

---

### `payslips` — Payslip Download

No models. The `DownloadPayslipView` handles:
- **Path A (S3)**: if `PayrollItem.payslip_s3_key` is set, generates a 5-minute pre-signed S3 URL and redirects
- **Path B (on-the-fly)**: generates a branded PDF with ReportLab in-memory and streams it

Both paths enforce tenant isolation and employee self-access control.

---

### `reports` — CSV Export Engine

No models. `ReportGenerationView` provides all exports, restricted to `IsHROrAdmin`.

| Report Type | Endpoint / View | Description |
|---|---|---|
| `payroll_summary` | POST `/api/reports/` | All payroll items (employee, period, gross, deductions, net) |
| `attendance_matrix` | POST `/api/reports/` | Full clock-in/out log per employee per date |
| `statutory_returns` | POST `/api/reports/` | KRA P10-format gross/deductions breakdown |
| `leave_utilization` | POST `/api/reports/` | Leave requests with type, dates, status, days |
| `employee_turnover` | POST `/api/reports/` | Hire/termination dates and employment types |
| `expense_tracking` | POST `/api/reports/` | Active employee salary + allowances cost breakdown |
| `p9_annual` | POST `/api/reports/` or GET `/api/reports/p9/` | KRA P9 Annual Tax Deduction Card (12 PAYE columns + totals) |
| P10 Monthly | GET `/api/reports/p10/` | KRA iTax P10 monthly PAYE return |
| NSSF Schedule | GET `/api/reports/nssf/` | NSSF monthly remittance (employee + employer contributions) |
| SHIF Schedule | GET `/api/reports/shif/` | SHIF + AHL monthly deduction schedule |

All reports support flexible date range filtering: `last_30_days`, `current_quarter`, `last_12_months`, `all_time`, `this_month`, `last_month`, `this_year`, or a specific `YYYY-MM` month.

---

### `core` — Shared Infrastructure

- **`AuditLog`** — cryptographically append-only audit record (see Audit Trail section)
- **`ClerkAuthentication`** — RS256 JWT verification against Clerk JWKS with in-process key cache
- **`TenantMiddleware`** — resolves and sets tenant context from JWT claims
- **`RequestIDMiddleware`** — stamps every request with a UUID `X-Request-ID`
- **`TenantScopedModel`** — base model class enforcing tenant-scoped querysets
- **`EncryptedCharField` / `EncryptedJSONField`** — AES-256-GCM transparent field encryption
- **`IsHROrAdmin`, `IsAdmin`, `IsEmployee`, `IsSelfOrHRAdmin`** — RBAC permission classes
- **`OptionalPageNumberPagination`** — pagination that can be disabled per-request
- **`WorkwiseJsonFormatter`** — structured JSON log formatter injecting `request_id`, `tenant_id`, `user_id`

---

## Backend — API Endpoints

All endpoints are prefixed with `/api/` and require a Clerk Bearer JWT unless noted.

### Auth & Users
| Method | Path | Permission | Description |
|---|---|---|---|
| GET/PATCH | `/api/users/me/` | Authenticated | User profile; also writes a LOGIN audit entry |
| POST | `/api/users/invite/` | ADMIN only | Invite a new team member by email (sends invite link) |
| GET | `/api/users/invite/info/?token=` | Public | Resolve invite token (for pre-filling sign-up form) |
| GET | `/api/users/team/` | ADMIN only | List all team members in the tenant |
| DELETE | `/api/users/invite/<uuid:pk>/` | ADMIN only | Revoke a pending invite |

### Notifications
| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/api/notifications/` | Authenticated | List notifications (supports `?unread=true`, `?limit=N`) |
| POST | `/api/notifications/<id>/read/` | Authenticated | Mark single notification as read |
| POST | `/api/notifications/read-all/` | Authenticated | Mark all notifications as read |

### Dashboard & Audit
| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/api/dashboard/stats/` | Authenticated | KPIs: employee count, pending leaves, payroll cost, attendance rate, trends, department costs |
| GET | `/api/audit-trail/` | ADMIN only | Paginated audit log for the tenant |

### Employees
| Method | Path | Permission | Description |
|---|---|---|---|
| GET/POST | `/api/employees/` | HR or ADMIN | List / create employees |
| GET/PATCH/DELETE | `/api/employees/<id>/` | HR or ADMIN | Retrieve / update / delete employee |

### Payroll
| Method | Path | Permission | Description |
|---|---|---|---|
| GET/POST | `/api/payroll/` | HR or ADMIN | List payroll runs / create a new run |
| GET | `/api/payroll/<id>/` | HR or ADMIN | Retrieve run with items |
| POST | `/api/payroll/<id>/process/` | HR or ADMIN | Trigger async payroll calculation (Celery) |
| POST | `/api/payroll/<id>/approve/` | ADMIN only | Approve a processed run |
| POST | `/api/payroll/<id>/send_payslips/` | ADMIN only | Trigger async payslip PDF generation + S3 upload + email |
| POST | `/api/payroll/<id>/disburse/` | ADMIN only | Initiate M-Pesa B2C disbursement for all mpesa-payment employees |
| GET | `/api/payslips/<id>/download/` | Authenticated | Download payslip (S3 pre-signed URL or on-the-fly PDF) |

### Attendance
| Method | Path | Permission | Description |
|---|---|---|---|
| GET/POST | `/api/attendance/` | Authenticated | List / create attendance records |
| POST | `/api/attendance/<id>/clock_in/` | Authenticated | Clock in (validates geofence if configured) |
| POST | `/api/attendance/<id>/clock_out/` | Authenticated | Clock out; auto-calculates hours + overtime |

### Leave
| Method | Path | Permission | Description |
|---|---|---|---|
| GET/POST | `/api/leave/` | Authenticated | List / create leave requests |
| POST | `/api/leave/<id>/approve/` | HR or ADMIN | Final approval |
| POST | `/api/leave/<id>/manager_approve/` | HR or ADMIN | First-stage (manager) approval |
| POST | `/api/leave/<id>/reject/` | HR or ADMIN | Reject leave request |
| GET/PATCH | `/api/leave/policy/` | ADMIN only | Retrieve / update tenant leave policy |

### Settings
| Method | Path | Permission | Description |
|---|---|---|---|
| GET/PATCH | `/api/settings/company/` | ADMIN only | Tenant profile (name, country, KRA PIN, address) |
| POST | `/api/settings/company/upgrade-plan/` | ADMIN only | Upgrade subscription plan |
| GET/PATCH | `/api/settings/payroll/` | ADMIN only | Payroll statutory rates + geofencing config |
| GET/PATCH | `/api/settings/notifications/` | Authenticated | Per-user notification preferences |

### Reports
| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/api/reports/` | HR or ADMIN | Generate CSV report (type + range in body) |
| GET | `/api/reports/p9/` | HR or ADMIN | KRA P9 Annual Tax Deduction Card (`?year=`) |
| GET | `/api/reports/p10/` | HR or ADMIN | KRA P10 Monthly PAYE Return (`?month=&year=`) |
| GET | `/api/reports/nssf/` | HR or ADMIN | NSSF Remittance Schedule |
| GET | `/api/reports/shif/` | HR or ADMIN | SHIF + AHL Deduction Schedule |

### M-Pesa
| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/api/mpesa/b2c/callback/` | Public (Safaricom) | B2C payment callback |
| POST | `/api/mpesa/b2c/result/` | Public (Safaricom) | B2C result URL |
| POST | `/api/mpesa/b2c/timeout/` | Public (Safaricom) | B2C timeout URL |
| POST | `/api/mpesa/stk-push/` | Authenticated | Initiate M-Pesa STK Push (subscription payment) |
| POST | `/api/mpesa/stk-push-callback/` | Public (Safaricom) | STK Push result callback |
| GET | `/api/mpesa/stk-push/status/` | Authenticated | Poll STK Push payment status |

### Webhooks
| Method | Path | Description |
|---|---|---|
| POST | `/api/webhooks/clerk/` | Clerk user lifecycle events (user.created, user.updated, user.deleted) — verified by Svix signature |

---

## Backend — Payroll Engine

The payroll engine (`payroll/engine.py` + `payroll/statutory/`) computes a fully statutory-compliant payslip for each employee in a run.

### Calculation Flow

```
1. Normalize Base Salary
   ├── monthly  → use salary_basic as-is
   ├── weekly   → salary_basic × 4
   ├── daily    → salary_basic × days_worked (from attendance)
   └── hourly   → salary_basic × hours_worked (from attendance)

2. Compute Gross Pay
   Gross = Base Salary + Allowances + Overtime Pay − Unpaid Leave Deduction
   - Overtime hourly rate = monthly_salary / 160 × 1.5
   - Unpaid leave daily rate = monthly_salary / 30

3. Statutory Deductions (KenyaStatutoryEngine)
   ├── NSSF   — tiered contribution (new NSSF Act tiers); default 6%, capped at KES 4,320
   ├── SHIF   — 2.75% of gross, minimum KES 300
   ├── AHL    — 1.5% of gross (Affordable Housing Levy)
   └── PAYE   — progressive KRA tax bands after NSSF deduction, minus personal relief (KES 2,400/month)
       Bands (default): 10% up to 24k | 25% next 8,333 | 30% next 467,667 | 32.5% next 300k | 35% above

4. Net Pay = Gross − NSSF − SHIF − AHL − PAYE
```

All rates and bands are configurable per-tenant via `PayrollConfig`. The `KenyaStatutoryEngine` lives in a dedicated `payroll/statutory/` sub-package with separate modules for NSSF, SHIF, PAYE, and AHL to make future statutory changes easy to isolate and test.

---

## Backend — Async Tasks (Celery)

Two Celery tasks handle the heavy lifting:

### `process_payroll_run`
- Triggered when a payroll run is submitted for processing
- Iterates all active employees in the tenant
- Queries attendance aggregates (days worked, total hours, overtime)
- Computes unpaid leave overlap for the payroll month
- Calls `PayrollEngine.calculate_employee_payroll()` for each employee
- Creates `PayrollItem` records and transitions the run to `processed`
- Retries up to 3 times on failure (10-second backoff)

### `send_payslips_async`
- Triggered after a run is approved and admin clicks "Send Payslips"
- Per employee:
  1. Generates a branded PDF payslip in-memory (ReportLab)
  2. Uploads to S3 (`payslips/{tenant_id}/{year}/{month}/{employee_id}.pdf`) with AES-256 server-side encryption and private ACL; persists the S3 key on `PayrollItem.payslip_s3_key`
  3. Emails the PDF as an attachment to the employee's registered email
- Retries up to 3 times (30-second backoff)
- Gracefully degrades: if S3 is not configured, skips upload and proceeds with email-only delivery

In development (no `REDIS_URL`), `CELERY_TASK_ALWAYS_EAGER=True` runs all tasks synchronously.

---

## Backend — Authentication & Security

### Clerk JWT Authentication (`ClerkAuthentication`)

Every API request must carry a Clerk-issued Bearer JWT. The custom DRF authentication class:

1. Peeks at the token header to read `kid` (key ID)
2. Verifies the `iss` (issuer) claim against `CLERK_ISSUER` or `CLERK_ALLOWED_ISSUERS`
3. Fetches Clerk's JWKS endpoint to obtain the matching RS256 public key; keys are cached in-process for 1 hour
4. Decodes and validates the token (`python-jose`), enforcing `audience` if `CLERK_AUDIENCE` is set
5. Resolves `sub` (Clerk user ID) → `User` record in the DB
6. In DEBUG mode only, auto-provisions a user + tenant if not found (for local development)

Raw tokens and user PII are never written to logs.

### Role-Based Access Control (RBAC)

Three roles are enforced by DRF permission classes:

| Role | Description | Key Permissions |
|---|---|---|
| `ADMIN` | Company administrator | Full access to all modules, settings, billing, team management |
| `HR` | HR Manager | Manage employees, run payroll, approve leave, export reports |
| `EMPLOYEE` | Standard employee | Self-service: view own profile, leave requests, payslip download |

### HTTP Security Headers

Applied at both the Django and Nginx layers:
- `Strict-Transport-Security` (HSTS, 1 year, production only)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy` (Next.js layer)
- `Permissions-Policy`

### Field-Level Encryption

Sensitive employee data (`kra_pin`, `mpesa_number`, `bank_details`) is stored AES-256-GCM encrypted using `EncryptedCharField` / `EncryptedJSONField`. The `MASTER_ENCRYPTION_KEY` (base64-encoded 32-byte key) is a required startup configuration — the app refuses to boot without it.

### Rate Limiting

DRF throttling applied globally:
- Anonymous: 30 req/min
- Authenticated users: 120 req/min
- Login scope: 10 req/min
- Registration scope: 5 req/hour

### Additional Security Measures
- CSRF protection enabled; cookies are `SameSite=Lax`, `Secure` (production), `HttpOnly`
- Upload limits: 10 MB request body, 5 MB file upload
- Wildcard `ALLOWED_HOSTS` and `CORS_ALLOW_ALL_ORIGINS` are blocked in production
- SSL enforced for all PostgreSQL connections (`sslmode=require`)
- `statement_timeout=60s` and `lock_timeout=30s` on all DB connections
- Gunicorn worker isolation (each request in a separate process)

---

## Backend — Audit Trail

The `AuditLog` model provides a **cryptographically append-only** audit trail:

- The Django ORM `AppendOnlyManager` blocks `.update()` and `.delete()` at the ORM level
- A PostgreSQL trigger (applied via migration) blocks `UPDATE`/`DELETE` at the database level
- Each row carries an **HMAC-SHA256 integrity seal** computed from canonical fields using `MASTER_ENCRYPTION_KEY` — tampered exported dumps can be detected offline

**Recorded actions**: `CREATE`, `UPDATE`, `DELETE`, `LOGIN`, `LOGOUT`, `PAYROLL_RUN`, `PAYROLL_APPROVE`, `PAYROLL_REJECT`, `EXPORT`, `PERMISSION_CHANGE`, `WEBHOOK`

Each entry captures:
- `actor_id`, `actor_email` (denormalised — preserved even if the user is deleted)
- `tenant`, `action`, `resource_type`, `resource_id`
- `ip_address`, `user_agent`
- `payload` (JSON `{before, after}` diff), `payload_hash` (SHA-256)
- `integrity_seal` (HMAC-SHA256)
- `timestamp` (UTC, immutable)

Login audit entries are written on every `/api/users/me/` call, with an IP geolocation lookup (via `ip-api.com`) to record the sign-in location.

---

## Frontend — Next.js Application

The frontend is a Next.js 16 App Router application in `frontend/src/`.

### Provider Stack (top to bottom)

```
ClerkProvider (auth + session)
  └── ThemeProvider (light/dark mode via next-themes)
        └── ClerkTokenProvider (wires Clerk JWT → Axios + loads Django user profile)
              └── QueryClientProvider (TanStack React Query)
                    └── AppLayout (sidebar + topbar)
                          └── page content
```

### `ClerkTokenProvider`
A render-less component that:
1. Registers Clerk's `getToken()` as the Axios Bearer token getter
2. Calls `fetchUser()` once on sign-in to load the Django `/users/me/` profile into Zustand
3. Calls `clearUser()` on sign-out

### Axios API Layer (`src/lib/api.ts`)
- Base URL: `NEXT_PUBLIC_API_URL` (default `http://localhost:8000/api`)
- Request interceptor automatically attaches `Authorization: Bearer <clerk_token>` to every outgoing request

### Zustand Auth Store (`src/lib/store.ts`)
Tracks `user: AuthUser | null`, `isLoading`, `hasFetched` globally. The `AuthUser` type includes role, company name, plan, trial info, and notification preferences.

---

## Frontend — Pages & Routes

| Route | Description |
|---|---|
| `/` | Landing / dashboard home |
| `/auth/login` | Clerk-hosted sign-in page |
| `/auth/register` | Clerk-hosted sign-up page |
| `/auth/accept-invite` | Accept team invitation (reads `?token=` + `?email=`) |
| `/employees` | Employee list with search/filter |
| `/employees/[id]` | Employee detail / edit profile |
| `/attendance` | Attendance log and clock-in/out interface |
| `/leave` | Leave requests: submit, approve/reject, balance view |
| `/payroll` | Payroll runs: create, process, approve, disburse |
| `/reports` | Report builder: select type, date range, export CSV |
| `/notifications` | In-app notification inbox (read / read-all) |
| `/audit` | Audit trail viewer (ADMIN only) |
| `/manager` | Manager dashboard (manager-specific views) |
| `/settings` | Company settings, payroll config, notification preferences |
| `/settings/billing` | Subscription plan management + M-Pesa upgrade flow |
| `/pricing` | Public pricing page |

---

## Frontend — State Management & API Layer

### TanStack React Query
Used for all server-state (API data): employees, payroll runs, attendance, leave, notifications, dashboard stats. Configured with:
- `staleTime`: 60 seconds
- `retry`: 1
- `refetchOnWindowFocus`: false

### Zustand
Used for global client-state:
- `useAuthStore` — authenticated user profile, loading state, fetch/clear helpers

### UI Design System
- **Glassmorphism**: `GlassCard`, `TiltCard` components with backdrop blur and transparency
- **Color palette**: Indigo, Emerald, Teal (`#0d9488`), Slate
- **Animations**: Framer Motion spring transitions, hover micro-interactions
- **3D elements**: Three.js/React Three Fiber for visual accents (landing/pricing pages)
- **Shadcn/UI**: accessible headless primitives (dialogs, dropdowns, tables, forms)
- **Responsive**: mobile-first, functional across mobile, tablet, and desktop

### Content Security Policy (Next.js layer)
```
default-src 'self'
script-src  'self' 'unsafe-inline' https://clerk.accounts.dev
style-src   'self' 'unsafe-inline' https://fonts.googleapis.com
connect-src 'self' http://localhost:8000 https://*.clerk.accounts.dev
frame-ancestors 'none'
```

---

## Third-Party Integrations

### Clerk (Identity & Access Management)
- Handles user registration, login, MFA, and session management
- Frontend uses `@clerk/nextjs` — `ClerkProvider`, `useAuth`, `signInUrl`, `signUpUrl` configured
- Backend verifies Clerk JWTs via RS256 signature check against Clerk's JWKS endpoint
- User lifecycle events (created, updated, deleted) are synced to Django via Svix-verified webhooks at `/api/webhooks/clerk/`
- Team invitation flow: admin sends email invite → user registers via Clerk → webhook creates/activates the Django `User` record

### Safaricom M-Pesa (Daraja API)
Two distinct M-Pesa integrations coexist:

**B2C (Business to Customer) — Salary Disbursement**
- Used to disburse net pay directly to employees' M-Pesa numbers after payroll approval
- Uses `django-daraja` + custom `mpesa.py`/`mpesa_views.py`
- Each disbursement creates a `MpesaTransaction` record
- Safaricom calls back at `/api/mpesa/b2c/result/` and `/api/mpesa/b2c/timeout/`
- Sandbox mode available for testing (`b2c_sandbox.py`)

**STK Push (C2B Lipa na M-Pesa) — Subscription Payments**
- Used when a tenant upgrades their subscription plan
- Initiates a push notification to the admin's phone to enter their M-Pesa PIN
- Callback at `/api/mpesa/stk-push-callback/`; `MpesaSubscriptionPayment` records track status
- Status polling at `/api/mpesa/stk-push/status/`

Both integrations support sandbox (`https://sandbox.safaricom.co.ke`) and production (`https://api.safaricom.co.ke`) environments, controlled by `MPESA_ENVIRONMENT`.

### AWS S3 (Payslip Storage)
- Payslip PDFs are uploaded with `AES256` server-side encryption and `private` ACL
- Object key: `payslips/{tenant_id}/{year}/{month}/{employee_id}.pdf`
- Download uses 5-minute pre-signed URLs — Django never re-serves the file from production
- Gracefully degrades to email-only if `AWS_PAYSLIPS_BUCKET` is not configured

### Email (SMTP)
- Django's email framework configured for SMTP (Gmail by default)
- Used for team invitations and payslip delivery
- From address branded per-tenant: `{Company Name} via WorkWise <noreply@workwise.co.ke>`
- Console backend in development

### Redis (Upstash or Docker)
- Celery message broker and result backend
- Django cache layer (`django-redis`)
- Falls back to in-memory cache + synchronous Celery tasks in development

### Supabase / PostgreSQL
- Primary database in production
- Supports Supabase connection pooler (Transaction mode, port 6543)
- `pgBouncer`-compatible: `DISABLE_SERVER_SIDE_CURSORS=True`

---

## Deployment & Infrastructure

### Docker Compose — Development (`docker-compose.yml`)
```
Services:
  db       — postgres:16-alpine on port 5432
  backend  — Django dev server on port 8000
```
Mounts the `./backend` directory as a volume for live reload.

### Docker Compose — Production (`docker-compose.prod.yml`)
```
Services:
  redis    — redis:7-alpine (256 MB LRU, no persistence)
  backend  — Gunicorn (4 workers) behind healthcheck; runs migrate + collectstatic on startup
  worker   — Celery worker (2 concurrent, max 50 tasks/child)
  nginx    — nginx:1.27-alpine; TLS termination + static file serving
```

All production services communicate on the `workwise_net` bridge network. The `backend` is not exposed directly — all traffic passes through Nginx.

### Nginx Configuration (`nginx/nginx.conf`)
- HTTP → HTTPS redirect (301); ACME challenge exempted for Let's Encrypt
- TLS: TLSv1.2 + TLSv1.3, ECDHE cipher suites, OCSP stapling
- HSTS: 1 year, `includeSubDomains`, `preload`
- API domain: `api.workwise.co.ke`
- Static files served directly from the `staticfiles` Docker volume (1-year cache, `immutable`)
- M-Pesa webhook path (`/api/mpesa/`) has a separate location block — no rate limiting, 30-second read timeout to ensure Safaricom callbacks are not dropped
- General API requests: 120-second read timeout (accommodates long payroll processing)
- Max body size: 15 MB (supports CSV bulk imports)

### Backend Dockerfile
- Multi-stage build targeting Python 3.12
- Runs as non-root user
- `gunicorn` is the entrypoint in production

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `DJANGO_SECRET_KEY` | Yes | Django secret key (generate with `get_random_secret_key()`) |
| `DJANGO_DEBUG` | Yes | `True` for development, `False` for production |
| `DJANGO_ALLOWED_HOSTS` | Prod | Comma-separated allowed hostnames |
| `DATABASE_URL` | Prod | PostgreSQL connection string (Supabase format) |
| `DB_HOST` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` | Alt | Individual DB vars if not using `DATABASE_URL` |
| `DB_SSLMODE` | No | PostgreSQL SSL mode (default: `require`) |
| `REDIS_URL` | Prod | Redis connection URL (enables Celery + Redis cache) |
| `CORS_ALLOWED_ORIGINS` | Prod | Comma-separated frontend origin(s) |
| `FRONTEND_URL` | Yes | Frontend base URL (used in invite email links) |
| `MASTER_ENCRYPTION_KEY` | Yes | Base64-encoded 32-byte key for field encryption |
| `CLERK_ISSUER` | Yes | Clerk tenant issuer URL |
| `CLERK_JWKS_URL` | Yes | Clerk JWKS endpoint |
| `CLERK_SECRET_KEY` | Yes | Clerk backend secret key |
| `CLERK_WEBHOOK_SECRET` | Yes | Svix webhook signature secret |
| `CLERK_AUDIENCE` | No | JWT audience claim (leave empty to skip audience validation) |
| `EMAIL_BACKEND` | No | Django email backend (default: console) |
| `EMAIL_HOST` / `EMAIL_PORT` / `EMAIL_HOST_USER` / `EMAIL_HOST_PASSWORD` | Prod | SMTP credentials |
| `DEFAULT_FROM_EMAIL` | No | Sender address for outgoing email |
| `MPESA_ENABLED` | No | `True` to enable M-Pesa integration |
| `MPESA_ENVIRONMENT` | No | `sandbox` or `production` |
| `MPESA_CONSUMER_KEY` / `MPESA_CONSUMER_SECRET` | M-Pesa | Daraja API credentials |
| `MPESA_INITIATOR_NAME` / `MPESA_INITIATOR_PASSWORD` | M-Pesa | B2C initiator credentials |
| `MPESA_B2C_SHORTCODE` | M-Pesa | B2C shortcode |
| `MPESA_EXPRESS_SHORTCODE` / `MPESA_PASSKEY` | M-Pesa | STK Push paybill + passkey |
| `MPESA_SECURITY_CREDENTIAL` | M-Pesa | Encrypted initiator credential |
| `MPESA_B2C_RESULT_URL` / `MPESA_B2C_TIMEOUT_URL` | M-Pesa | Safaricom callback URLs |
| `MPESA_STK_CALLBACK_URL` | M-Pesa | STK Push callback URL |
| `DJANGO_SECURE_SSL` | Prod | `True` when behind a TLS proxy |
| `AWS_PAYSLIPS_BUCKET` | No | S3 bucket name for payslip storage |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_S3_REGION_NAME` | No | AWS credentials for S3 |

---

## CI/CD Pipeline

Defined in `.github/workflows/backend-regression.yml`. Runs on every pull request and every push to `main`/`master`.

### Job 1: `backend-regression`
Runs on `ubuntu-latest` with Python 3.12.

Steps:
1. Checkout repository
2. Set up Python 3.12 with pip cache
3. Install all backend dependencies from `requirements.txt`
4. Run test suite with **coverage**:
   - `core.tests` — core infrastructure tests
   - `core.tests_authentication` — Clerk JWT auth tests
   - `core.test_jwks_integration` — JWKS cache + key rotation tests
   - `core.tests_rbac_mpesa` — RBAC permission + M-Pesa integration tests
   - `reports.tests` — CSV export and date-range parsing tests
   - `payroll.tests_mpesa_b2c` — B2C disbursement flow tests
   - `payroll.tests_mpesa` — M-Pesa general tests
   - `tenants.tests` — tenant model and plan tests
   - Coverage threshold: **50% minimum** (fails build if below)
5. Upload `coverage.xml` as a build artifact
6. Run **Bandit** security scan (`-ll` = MEDIUM and HIGH severity only, excludes venv and migrations)

CI environment uses SQLite (no `DATABASE_URL`), `DJANGO_DEBUG=True`, a dummy `MASTER_ENCRYPTION_KEY`, and `MPESA_ENABLED=False`.

### Job 2: `frontend-audit`
Runs on `ubuntu-latest` with Node 20.

Steps:
1. Checkout repository
2. Set up Node 20 with npm cache
3. Install frontend dependencies (`npm ci`)
4. Run `npm audit --audit-level=high` — fails only for HIGH/CRITICAL severity vulnerabilities

---

## Data Security Model

### Tenancy Isolation
- Every model that holds business data extends `TenantScopedModel`
- The base manager automatically filters all querysets to `tenant = current_tenant` (set in thread-local by `TenantMiddleware`)
- Direct cross-tenant data access is impossible through the standard ORM layer

### Sensitive Field Encryption
Fields encrypted at rest with AES-256-GCM (never stored in plaintext):
- `Employee.kra_pin`
- `Employee.mpesa_number`
- `Employee.bank_details` (JSON: bank name, account number)

### Audit Immutability
- `AuditLog` rows can never be modified or deleted via Django ORM or direct SQL (PostgreSQL trigger)
- HMAC-SHA256 integrity seal on each row enables tamper detection in exported data
- Satisfies **Kenya Data Protection Act 2019 §25** (accountability and record-keeping)

### Transport Security
- All production traffic is TLS-terminated at Nginx
- HSTS enforced at both Nginx and Django levels
- Clerk JWT tokens are short-lived RS256 tokens; JWKS keys are cached to limit external HTTP calls

### Payslip Access Control
- Employees can only download their own payslips (enforced by email match check)
- HR/ADMIN can download any payslip
- S3 payslip objects are private; access granted only via 5-minute pre-signed URLs

---

## Subscription Plans

| Plan | Max Employees | Target |
|---|---|---|
| **STARTER** | 15 | Small businesses / early-stage startups |
| **GROWTH** | 75 | Growing SMEs |
| **BUSINESS** | 300 | Established mid-size companies |
| **ENTERPRISE** | Unlimited | Large organisations |

New tenants start on a **14-day free trial** (STARTER plan, `TRIAL` status). Plan upgrades are paid via M-Pesa STK Push. Subscription statuses: `TRIAL` → `ACTIVE` → `PAST_DUE` / `SUSPENDED` / `CANCELLED`.

---

## Directory Structure

```
WorkWise SaaS/
├── backend/                        # Django backend
│   ├── config/                     # Django project settings, URLs, WSGI, ASGI, Celery
│   ├── core/                       # Shared: auth, middleware, encryption, audit, permissions, pagination
│   ├── tenants/                    # Tenant model, subscription payments
│   ├── users/                      # User model, Notifications, invite flow, Clerk webhook
│   ├── employees/                  # Employee profiles + admin
│   ├── attendance/                 # Clock-in/out, hours, geofencing
│   ├── leave/                      # Leave requests, balances, policy
│   ├── payroll/                    # Payroll runs, items, config, M-Pesa B2C, tasks, engine
│   │   └── statutory/              # NSSF / SHIF / PAYE / AHL calculation modules
│   ├── payslips/                   # Payslip PDF generation + S3 pre-signed URL download
│   ├── reports/                    # CSV exports: P9, P10, NSSF, SHIF, payroll, attendance, leave
│   ├── docs/                       # CLERK_ENV_VARS.md and internal docs
│   ├── requirements.txt            # Python dependencies (pinned ranges)
│   ├── Dockerfile                  # Multi-stage production image
│   ├── manage.py
│   └── .env.example                # Backend environment variable template
│
├── frontend/                       # Next.js 16 frontend
│   └── src/
│       ├── app/                    # App Router pages
│       │   ├── attendance/         # Attendance page
│       │   ├── audit/              # Audit trail page
│       │   ├── auth/               # Login, register, accept-invite
│       │   ├── employees/          # Employee list + [id] detail
│       │   ├── leave/              # Leave management page
│       │   ├── manager/            # Manager dashboard
│       │   ├── notifications/      # Notification inbox
│       │   ├── payroll/            # Payroll runs page
│       │   ├── pricing/            # Public pricing page
│       │   ├── reports/            # Report builder page
│       │   └── settings/           # Company/payroll settings + billing
│       ├── components/
│       │   ├── layout/             # AppLayout, sidebar, topbar
│       │   ├── premium/            # GlassCard, TiltCard, premium UI components
│       │   ├── ui/                 # Shadcn/UI primitives
│       │   ├── ClerkTokenProvider.tsx
│       │   ├── ErrorBoundary.tsx
│       │   └── providers.tsx
│       └── lib/
│           ├── api.ts              # Axios instance + Clerk token interceptor
│           ├── store.ts            # Zustand auth store
│           ├── types.ts            # TypeScript interfaces for all API types
│           ├── format.ts           # Number/date formatting utilities
│           ├── utils.ts            # General helpers
│           └── clerk-appearance.ts # Clerk UI theme customization
│
├── nginx/
│   └── nginx.conf                  # Nginx reverse proxy config (TLS, HSTS, static files, M-Pesa routing)
│
├── docker-compose.yml              # Local development stack (DB + backend)
├── docker-compose.prod.yml         # Production stack (nginx + backend + worker + redis)
├── .env.prod.example               # Production environment variable template
├── .github/
│   └── workflows/
│       └── backend-regression.yml  # CI: pytest + coverage + bandit + npm audit
└── PROJECT_OVERVIEW.md             # This document
```

---

## Key Design Decisions

**Why Clerk instead of Django's built-in auth?**
Clerk provides production-grade MFA, social login, and session management out of the box. The backend only verifies JWTs — it never handles passwords, making the attack surface significantly smaller.

**Why Celery for payroll processing?**
Payroll runs across many employees can take several seconds. Running them in a Celery task prevents HTTP timeouts and allows the frontend to show real-time status polling while the run completes in the background.

**Why field-level encryption for KRA PIN and bank details?**
Even if the database is compromised, these fields remain unreadable without the `MASTER_ENCRYPTION_KEY`. This satisfies Kenya's Data Protection Act requirements for sensitive financial identifiers.

**Why an append-only audit log with HMAC seals?**
HR systems are high-value targets for insider manipulation (salary tampering, leave falsification). The immutable audit trail with integrity seals makes any post-facto modification of records detectable — both in the live database and in exported backups.

**Why separate B2C and STK Push M-Pesa integrations?**
B2C is for outbound salary payments (business pays employees). STK Push is for inbound subscription fees (employer pays WorkWise). They use completely different Daraja API flows, credentials, and callback URLs, so keeping them separate reduces misconfiguration risk.
