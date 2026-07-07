# WorkWise HR & Finance SaaS — Complete Project Overview

WorkWise is a production-grade, multi-tenant HR and Finance management platform built for the Kenyan market. It covers the full employee lifecycle and the complete finance department workflow — from payroll to double-entry bookkeeping — in one integrated system.

---

## Table of Contents

1. [Technology Stack](#technology-stack)
2. [Architecture Overview](#architecture-overview)
3. [Role-Based Access Control](#role-based-access-control)
4. [Backend — Django Apps & Models](#backend--django-apps--models)
5. [Backend — Finance Books Module](#backend--finance-books-module)
6. [Backend — API Endpoints](#backend--api-endpoints)
7. [Backend — Payroll Engine](#backend--payroll-engine)
8. [Backend — Async Tasks (Celery)](#backend--async-tasks-celery)
9. [Backend — Authentication & Security](#backend--authentication--security)
10. [Backend — Audit Trail](#backend--audit-trail)
11. [Frontend — Application Structure](#frontend--application-structure)
12. [Frontend — Role-Based Dashboards](#frontend--role-based-dashboards)
13. [Frontend — Pages & Routes](#frontend--pages--routes)
14. [Third-Party Integrations](#third-party-integrations)
15. [Deployment & Infrastructure](#deployment--infrastructure)
16. [Environment Variables Reference](#environment-variables-reference)
17. [CI/CD Pipeline](#cicd-pipeline)
18. [Subscription Plans](#subscription-plans)
19. [Directory Structure](#directory-structure)
20. [Key Design Decisions](#key-design-decisions)

---

## Technology Stack

### Backend
| Layer | Technology |
|---|---|
| Framework | Django 6.x + Django REST Framework 3.15 |
| Language | Python 3.12 |
| Database | PostgreSQL 16 via Supabase (production) / SQLite (local dev fallback) |
| Authentication | Clerk JWT/RS256 via JWKS + custom `ClerkAuthentication` |
| Async Tasks | Celery 5.x + Redis 7 |
| Cache | Redis (`django-redis`); `LocMemCache` in dev |
| Task Results | `django-celery-results` (DB-backed) |
| PDF Generation | ReportLab |
| File Storage | AWS S3 (`django-storages[s3]` + `boto3`) |
| Static Files | WhiteNoise (Brotli-compressed) |
| WSGI Server | Gunicorn (4 workers, 120s timeout) |
| M-Pesa | `django-daraja` + custom Daraja B2C/STK views |
| Logging | `python-json-logger` with request-scoped context |
| Encryption | AES-256-GCM via `cryptography` |
| Webhook Verification | Svix (Clerk webhook signatures) |

### Frontend
| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| Components | Shadcn/UI + custom Glassmorphic design system |
| Animations | Framer Motion 12 |
| Icons | Lucide React |
| HTTP Client | Axios (with Clerk JWT interceptor) |
| Server State | TanStack React Query v5 |
| Client State | Zustand v5 |
| Auth | `@clerk/nextjs` v6 |
| Themes | `next-themes` (light/dark) |
| Date Utilities | `date-fns` |

---

## Architecture Overview

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
      ├── PostgreSQL / Supabase
      ├── Redis (Celery broker + Django cache)
      └── Celery Worker (payroll, payslips, email)
```

**Multi-tenancy** is enforced at the ORM level. Every model that holds business data extends `TenantScopedModel`, which automatically filters all querysets to the authenticated user's tenant.

---

## Role-Based Access Control

WorkWise has four roles. Every new registration creates a company **Admin**. All other users must be invited by the Admin.

| Role | Home Dashboard | Key Permissions |
|---|---|---|
| `ADMIN` (CEO) | `/` — CEO Dashboard | Full access to all HR + Finance modules, audit trail, billing, team management |
| `HR` | `/hr` — HR Dashboard | Employees, attendance, leave, payroll, statutory exports. No finance books access. |
| `FINANCE` | `/finance` — Finance Dashboard | Expenses, budgets, petty cash, chart of accounts, journal entries, financial reports. No payroll editing. |
| `EMPLOYEE` | `/employee` — Employee Dashboard | Self-service: attendance, leave requests, expense claims, payslip download |

### Invite Flow
1. Admin goes to **Settings → Team Members**
2. Fills in first name, last name, email, and role
3. System generates a secure temp password (12 chars, mixed case + digit + special)
4. Creates the user in Clerk via Backend API
5. Creates the Django user record with the assigned role and tenant
6. Emails login credentials to the invitee with a direct login link
7. Invitee clicks link → login page with email pre-filled → logs in → redirected to their role's dashboard
8. Invitee changes password from **Settings → Security → Change Password**

---

## Backend — Django Apps & Models

### `tenants` — Multi-Tenancy Core
- **`Tenant`**: UUID PK, `name`, `country`, `currency`, `plan` (STARTER/GROWTH/BUSINESS/ENTERPRISE), `subscription_status`, `max_employees` (auto-capped by plan: 15/75/300/∞), `trial_ends_at`
- **`MpesaSubscriptionPayment`**: STK Push payment tracking for plan upgrades
- **`TenantSettings`**: Company customization (logo, brand colors, payslip templates, working days, time zone, public holidays)
- On tenant creation: `PayrollConfig` is auto-created + standard **Chart of Accounts** is seeded (50 accounts)

### `workflows` — Approval Workflows
- **`ApprovalTemplate`**: Configurable templates for leave, salary changes, onboarding, etc.
- **`ApprovalStep`**: Individual steps in an approval template (approver type/role/user, comment required)
- **`ApprovalRequest`**: Actual approval request linked to an item
- **`ApprovalAction`**: Action taken on a request (approve/reject/delegate with comment)

### `documents` — Document Management
- **`DocumentCategory`**: Organize documents (e.g., ID, contracts, certificates)
- **`Document`**: Uploaded document (file, type, employee link, permissions, expiry date, version number)
- **`DocumentVersion`**: Version history for documents

### `users` — Authentication & Team Management
- **`User`**: UUID PK, email login, `role` (ADMIN/HR/FINANCE/EMPLOYEE), `clerk_id`, `tenant`, `invite_token`, `notification_preferences`
- **`Notification`**: In-app notifications (payroll, leave, employee, system)

### `employees` — Employee Profiles
- **`Employee`**: UUID PK, `name`, `email`, `phone`, `department`, `job_title`, `kra_pin` (AES-256-GCM encrypted), `employment_type` (monthly/weekly/daily/hourly), `salary_basic`, `allowances` (JSON), `payment_method` (mpesa/bank), `mpesa_number` (encrypted), `bank_details` (encrypted JSON), `status`, `hire_date`, `termination_date`

### `attendance` — Time Tracking
- **`Attendance`**: `employee`, `date`, `clock_in`, `clock_out`, `hours_worked`, `overtime_hours`, `location`, `latitude`, `longitude`

### `leave` — Leave Management
- **`LeavePolicy`**: Per-tenant leave entitlements
- **`Leave`**: Two-stage approval (manager_approved → approved/rejected)
- **`LeaveBalance`**: Per-employee, per-type, per-year tracking

### `payroll` — Payroll Engine
- **`PayrollRun`**: Monthly batch (draft → processed → approved → paid)
- **`PayrollItem`**: Per-employee computed gross, NSSF, SHIF, AHL, PAYE, net_pay, `payslip_s3_key`
- **`PayrollConfig`**: Configurable statutory rates + geofencing config
- **`MpesaTransaction`**: B2C disbursement tracking per employee

### `payslips` — Payslip Delivery
- No models. `DownloadPayslipView` serves S3 pre-signed URL (5 min) or on-the-fly ReportLab PDF

### `reports` — CSV Export Engine
- No models. Exports: payroll summary, attendance matrix, statutory returns, P9 annual, P10 monthly, NSSF schedule, SHIF schedule, leave utilization, employee turnover, expense tracking

### `core` — Shared Infrastructure
- `AuditLog` (append-only with HMAC seals), `ClerkAuthentication`, `TenantMiddleware`, `RequestIDMiddleware`, `EncryptedCharField/JSONField`, permission classes, pagination, JSON logging

### `reports_engine` — Custom Report Builder & Exports
- **`CustomReport`**: Saved custom reports (type, filters, columns, tenant)
- **`ReportExport`**: History of report exports (format, status, file)
- Supports CSV, Excel (XLSX), and PDF exports via `export_utils.py`
- Endpoints for creating, listing, and exporting custom reports

### `integrations` — API Keys & Webhooks
- **`APIKey`**: Tenant-scoped API keys with permissions, expiry, secret
- **`Webhook`**: Configurable webhooks with trigger events, secret for signature verification
- **`WebhookLog`**: History of webhook deliveries (status, status code, response)
- Webhook trigger test endpoint, HMAC signature generation

### `backup` — Tenant Backup & Disaster Recovery
- **`TenantBackup`**: Tenant backup (name, description, file, status, created by)
- Exports all tenant data to JSON (employees, attendance, leave, payroll, settings, etc.)
- Download endpoint for retrieving backup files

---

## Backend — Finance Module

The `finance` app covers both the **operational finance** (day-to-day) and the **accounting books** (double-entry).

### Operational Finance Models

**`ExpenseClaim`**
- Employee submits claim: `title`, `category` (travel/accommodation/meals/office/client/utilities/training/medical/other), `amount`, `expense_date`, `receipt_url`
- Status workflow: `pending` → `approved` → `paid` | `rejected`
- Finance Manager approves/rejects with comment; marks as paid after reimbursement
- Auto-posts a journal entry to the books when marked as paid

**`DepartmentBudget`**
- Finance Manager sets monthly budget per department
- Real-time utilization computed dynamically: payroll cost + approved expenses vs budget
- Alert shown when department hits 80% or exceeds budget

**`PettyCashFund`**
- Named fund with `opening_balance` and live `current_balance`
- Low balance warning at KES 5,000

**`PettyCashTransaction`**
- Types: `request` (disbursement), `topup`, `replenish`
- Status: `pending` → `disbursed` | `rejected`
- Fund balance auto-updated on disbursement
- Auto-posts a journal entry to the books on disbursement

---

### Finance Books — Double-Entry Bookkeeping

**`ChartOfAccount`**
- 5 account types: `ASSET`, `LIABILITY`, `EQUITY`, `REVENUE`, `EXPENSE`
- Standard Kenyan SME numbering: 1xxx Assets, 2xxx Liabilities, 3xxx Equity, 4xxx Revenue, 5xxx Expenses
- 50 pre-seeded system accounts covering all standard categories
- Hierarchical (parent/child accounts)
- `running_balance()` computed from posted journal lines
- `is_system=True` accounts cannot be deleted

**`JournalEntry`**
- Sources: `MANUAL` (finance team), `PAYROLL` (auto), `EXPENSE` (auto), `PETTY` (auto)
- Status: `DRAFT` → `POSTED` | `REVERSED`
- `post()` validates balance before posting (debits must equal credits)
- `reverse()` creates a fully reversed entry and marks original as REVERSED
- Reference field for traceability (e.g. `PR-2026-06`, `EXP-ABC123`)

**`JournalLine`**
- Each line: `account`, `side` (DEBIT/CREDIT), `amount`, `description`
- Minimum 2 lines per entry; validated at serializer level

**Auto-Posting Logic (Django Signals)**

| Trigger | Debit | Credit |
|---|---|---|
| PayrollRun approved | 5210 Salaries & Wages (gross) | 2210 PAYE + 2220 NSSF + 2230 SHIF + 2240 AHL + 1102 Bank (net) |
| ExpenseClaim marked paid | 5xxx Expense account (by category) | 1102 Bank |
| PettyCashTransaction disbursed | 5xxx Expense account | 1101 Petty Cash |

**Financial Reports API**
- `GET /api/finance/trial-balance/` — all accounts with debit/credit totals and net balance
- `GET /api/finance/income-statement/` — Revenue, COGS, Gross Profit, Operating Expenses, Net Profit/Loss
- `GET /api/finance/balance-sheet/` — Assets, Liabilities, Equity + balance check
- `GET /api/finance/general-ledger/` — Per-account running balance transaction history
- All reports support `date_from`, `date_to`, and `date_to` filters

---

## Backend — API Endpoints

All endpoints prefixed `/api/` and require Clerk Bearer JWT unless noted.

### Auth & Users
| Method | Path | Permission | Description |
|---|---|---|---|
| GET/PATCH | `/api/users/me/` | Authenticated | Profile (name, role, plan). PATCH updates first/last name. |
| POST | `/api/users/invite/` | ADMIN | Invite team member — generates temp password, creates Clerk user, sends email |
| GET | `/api/users/invite/info/?token=` | Public | Resolve invite token |
| GET | `/api/users/team/` | ADMIN | List all team members |
| DELETE | `/api/users/invite/<id>/` | ADMIN | Revoke pending invite |

### Notifications
| Method | Path | Description |
|---|---|---|
| GET | `/api/notifications/` | List (supports `?unread=true`) |
| POST | `/api/notifications/<id>/read/` | Mark single as read |
| POST | `/api/notifications/read-all/` | Mark all as read |

### HR Modules
| Method | Path | Description |
|---|---|---|
| GET/POST | `/api/employees/` | List / create employees |
| GET/PATCH/DELETE | `/api/employees/<id>/` | Employee detail |
| POST | `/api/employees/bulk_import/` | CSV import (upsert by email) |
| GET/POST | `/api/attendance/` | Attendance log |
| POST | `/api/attendance/<id>/clock_in/` | Clock in with geofence check |
| POST | `/api/attendance/<id>/clock_out/` | Clock out + auto-calculate hours |
| GET/POST | `/api/leave/` | Leave requests |
| POST | `/api/leave/<id>/approve/` | Final approval |
| POST | `/api/leave/<id>/manager_approve/` | First-stage approval |
| POST | `/api/leave/<id>/reject/` | Reject |
| GET/PATCH | `/api/leave/policy/` | Tenant leave policy |

### Payroll
| Method | Path | Description |
|---|---|---|
| GET/POST | `/api/payroll/` | Payroll runs |
| POST | `/api/payroll/<id>/process/` | Trigger async calculation |
| POST | `/api/payroll/<id>/approve/` | Approve → auto-posts to finance books |
| POST | `/api/payroll/<id>/send_payslips/` | Generate PDFs + email + S3 upload |
| POST | `/api/payroll/<id>/disburse/` | M-Pesa B2C disbursement |
| GET | `/api/payslips/<id>/download/` | Download payslip |

### Finance — Operational
| Method | Path | Description |
|---|---|---|
| GET/POST | `/api/finance/expenses/` | Expense claims |
| POST | `/api/finance/expenses/<id>/approve/` | Approve claim |
| POST | `/api/finance/expenses/<id>/reject/` | Reject claim |
| POST | `/api/finance/expenses/<id>/mark-paid/` | Mark reimbursed → auto-posts to books |
| GET/POST | `/api/finance/budgets/` | Department budgets |
| GET | `/api/finance/budgets/utilization/` | Budget vs actual spend |
| GET/POST | `/api/finance/petty-cash/` | Petty cash funds |
| GET/POST | `/api/finance/petty-cash/<id>/transactions/` | Fund transactions |
| POST | `/api/finance/petty-cash/<id>/transactions/<txn_id>/approve/` | Approve + disburse |
| GET | `/api/finance/summary/` | Finance dashboard KPIs |

### Finance — Books
| Method | Path | Description |
|---|---|---|
| GET/POST | `/api/finance/accounts/` | Chart of Accounts |
| POST | `/api/finance/accounts/seed/` | Seed standard Kenyan COA |
| GET | `/api/finance/accounts/<id>/ledger/` | Account ledger |
| GET/POST | `/api/finance/journal/` | Journal entries |
| POST | `/api/finance/journal/<id>/post_entry/` | Post draft entry |
| POST | `/api/finance/journal/<id>/reverse/` | Reverse posted entry |
| GET | `/api/finance/trial-balance/` | Trial balance |
| GET | `/api/finance/income-statement/` | P&L statement |
| GET | `/api/finance/balance-sheet/` | Balance sheet |
| GET | `/api/finance/general-ledger/` | General ledger |

### Workflows (Approval)
| Method | Path | Description |
|---|---|---|
| GET/POST | `/api/workflows/templates/` | List/Create approval templates |
| GET/PATCH/DELETE | `/api/workflows/templates/<id>/` | Approval template detail |
| GET/POST | `/api/workflows/steps/` | List/Create approval steps |
| GET/PATCH/DELETE | `/api/workflows/steps/<id>/` | Approval step detail |
| GET/POST | `/api/workflows/requests/` | List/Create approval requests |
| GET/PATCH | `/api/workflows/requests/<id>/` | Approval request detail |
| POST | `/api/workflows/requests/<id>/cancel/` | Cancel approval request |
| GET/POST | `/api/workflows/actions/` | List/Create approval actions |

### Documents
| Method | Path | Description |
|---|---|---|
| GET/POST | `/api/documents/categories/` | List/Create document categories |
| GET/PATCH/DELETE | `/api/documents/categories/<id>/` | Document category detail |
| GET/POST | `/api/documents/documents/` | List/Create documents |
| GET/PATCH/DELETE | `/api/documents/documents/<id>/` | Document detail |
| GET | `/api/documents/versions/` | List document versions |
| GET | `/api/documents/versions/<id>/` | Document version detail |

### Reports & Settings
| Method | Path | Description |
|---|---|---|
| POST | `/api/reports/` | CSV export (type + date range) |
| GET | `/api/reports/p9/` | KRA P9 Annual Tax Card |
| GET | `/api/reports/p10/` | KRA P10 Monthly PAYE Return |
| GET | `/api/reports/nssf/` | NSSF Remittance Schedule |
| GET | `/api/reports/shif/` | SHIF + AHL Schedule |
| GET | `/api/dashboard/stats/` | Dashboard KPIs |
| GET | `/api/audit-trail/` | Audit log (ADMIN only) |
| GET/PATCH | `/api/settings/company/` | Company settings |
| POST | `/api/settings/company/upgrade-plan/` | Upgrade plan via M-Pesa |
| GET/PATCH | `/api/settings/company/customization/` | Company customization (logo, colors, etc.) |
| GET/PATCH | `/api/settings/payroll/` | Payroll statutory config |
| GET/PATCH | `/api/settings/notifications/` | User notification preferences |

### Reports Engine (Custom Reports)
| Method | Path | Description |
|---|---|---|
| GET/POST | `/api/reports-engine/custom-reports/` | List/Create custom reports |
| GET/PATCH/DELETE | `/api/reports-engine/custom-reports/<id>/` | Custom report detail |
| POST | `/api/reports-engine/custom-reports/<id>/export/` | Export custom report (CSV/XLSX/PDF) |
| GET | `/api/reports-engine/exports/` | List report exports |

### Integrations (API Keys & Webhooks)
| Method | Path | Description |
|---|---|---|
| GET/POST | `/api/integrations/api-keys/` | List/Create API keys |
| GET/PATCH/DELETE | `/api/integrations/api-keys/<id>/` | API key detail |
| GET/POST | `/api/integrations/webhooks/` | List/Create webhooks |
| GET/PATCH/DELETE | `/api/integrations/webhooks/<id>/` | Webhook detail |
| POST | `/api/integrations/webhooks/<id>/trigger_test/` | Trigger test webhook |
| GET | `/api/integrations/webhook-logs/` | List webhook delivery logs |

### Backup & Disaster Recovery
| Method | Path | Description |
|---|---|---|
| GET/POST | `/api/backup/backups/` | List/Create tenant backups |
| GET | `/api/backup/backups/<id>/` | Backup detail |
| GET | `/api/backup/backups/<id>/download/` | Download backup file |

---

## Backend — Payroll Engine

The payroll engine (`payroll/engine.py` + `payroll/statutory/`) computes a fully statutory-compliant payslip.

### Calculation Flow
```
1. Normalize Base Salary
   monthly  → salary_basic as-is
   weekly   → salary_basic × 4
   daily    → salary_basic × days_worked (from attendance)
   hourly   → salary_basic × hours_worked (from attendance)

2. Gross Pay = Base + Allowances + Overtime − Unpaid Leave Deduction
   Overtime rate = monthly_salary / 160 × 1.5
   Unpaid leave  = monthly_salary / 30 per day

3. Statutory Deductions (KenyaStatutoryEngine)
   NSSF   — tiered (new Act), default 6%, capped KES 4,320
   SHIF   — 2.75% of gross, minimum KES 300
   AHL    — 1.5% of gross (Affordable Housing Levy)
   PAYE   — progressive KRA bands after NSSF, minus personal relief KES 2,400/month
            10% ≤24k | 25% next 8,333 | 30% next 467,667 | 32.5% next 300k | 35% above

4. Net Pay = Gross − NSSF − SHIF − AHL − PAYE
```

All rates and bands are configurable per-tenant via `PayrollConfig`.

### Auto-Post to Books
When a payroll run is **approved**, a Django signal automatically posts a balanced journal entry:
- DR 5210 Salaries & Wages (gross total)
- CR 2210 PAYE Payable, CR 2220 NSSF Payable, CR 2230 SHIF Payable, CR 2240 AHL Payable
- CR 1102 Bank (net pay total)

---

## Backend — Async Tasks (Celery)

| Task | Trigger | What it does |
|---|---|---|
| `process_payroll_run` | Admin clicks "Process" | Calculates payroll for all active employees; creates PayrollItem records; transitions run to `processed` |
| `send_payslips_async` | Admin clicks "Send Payslips" | Generates ReportLab PDF per employee; uploads to S3; emails PDF attachment; stores S3 key on PayrollItem |

In development (`REDIS_URL` blank): `CELERY_TASK_ALWAYS_EAGER=True` — tasks run synchronously, no worker needed.
In production (Railway): Redis broker + separate Celery worker service.

---

## Backend — Authentication & Security

### Clerk JWT Authentication
1. Reads `kid` from token header
2. Verifies `iss` against `CLERK_ISSUER`
3. Fetches Clerk JWKS, caches keys for 1 hour
4. Decodes RS256 token with `python-jose`
5. Resolves `sub` (Clerk user ID) → Django `User`
6. In DEBUG mode: fetches real name/email from Clerk API before auto-provisioning

### HTTP Security Headers
`HSTS`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`

### Field-Level Encryption
`kra_pin`, `mpesa_number`, `bank_details` — AES-256-GCM via `MASTER_ENCRYPTION_KEY`

### Rate Limiting
Anonymous: 30/min | Authenticated: 120/min | Login: 10/min | Registration: 5/hour

---

## Backend — Audit Trail

- `AuditLog` model — append-only at ORM and DB level (PostgreSQL trigger)
- HMAC-SHA256 integrity seal per row (tamper detection)
- Records: `CREATE`, `UPDATE`, `DELETE`, `LOGIN`, `LOGOUT`, `PAYROLL_RUN`, `PAYROLL_APPROVE`, `EXPORT`, `PERMISSION_CHANGE`, `WEBHOOK`
- Each entry: `actor_id`, `actor_email`, `tenant`, `action`, `resource_type`, `resource_id`, `ip_address`, `user_agent`, `payload` (before/after diff), `integrity_seal`, `timestamp`
- LOGIN entries written on every `/api/users/me/` call with IP geolocation

---

## Frontend — Application Structure

### Provider Stack
```
ClerkProvider
  └── ThemeProvider (light/dark)
        └── ClerkTokenProvider (wires JWT → Axios, loads Django profile, role-based redirect)
              └── QueryClientProvider (TanStack React Query)
                    └── AppLayout (sidebar + topbar)
                          └── page content
```

### Role-Based Redirect (ClerkTokenProvider)
After login, user is redirected to their role's home:
- `ADMIN` → `/` (CEO Dashboard)
- `HR` → `/hr`
- `FINANCE` → `/finance`
- `EMPLOYEE` → `/employee`

### API Layer (`src/lib/api.ts`)
- Axios instance with Clerk Bearer token interceptor
- `financeApi` object with typed methods for all finance endpoints
- Base URL: `NEXT_PUBLIC_API_URL`

### State Management
- **Zustand** (`useAuthStore`): `user`, `isLoading`, `hasFetched`, `fetchUser()`, `clearUser()`
- **TanStack React Query**: all server state with 60s stale time, polling where relevant

---

## Frontend — Role-Based Dashboards

### CEO Dashboard (`/`)
Admin-only. Shows the full company picture in one view:
- 6 KPI cards: Headcount, Monthly Payroll Cost, Total Expenses, Budget Utilization %, Attendance Rate, Pending Approvals
- Financial Overview bar chart (payroll + expenses vs budget)
- Department headcount breakdown
- Management area quick links to all modules
- Recent company activity feed

### HR Dashboard (`/hr`)
HR Manager + Admin. Focused on people operations:
- 4 KPI cards: Total Employees, Pending Leave Requests, Monthly Payroll Cost, Attendance Rate
- Quick actions: Add Employee, Run Payroll, Review Leave, View Reports, Mark Attendance
- Department cost breakdown chart
- Recent activity feed

### Finance Dashboard (`/finance`)
Finance Manager + Admin. Full financial operations view:
- 4 KPI cards: Payroll Cost, Approved Expenses, Pending Claims (count + amount), Petty Cash Balance
- Month/year picker
- Budget utilization progress bar with over-budget alert
- Expenses by category breakdown chart
- 6 quick action cards: Expenses, Budgets, Petty Cash, Chart of Accounts, Journal, Reports

### Employee Dashboard (`/employee`)
Employee self-service only:
- Status cards: Pending Leave, Approved Leave, Pending Expense Claims
- Quick links: Attendance, Request Leave, Payslips, Expense Claims
- Recent leave requests with status badges

---

## Frontend — Pages & Routes

| Route | Role Access | Description |
|---|---|---|
| `/` | ADMIN | CEO Dashboard |
| `/hr` | ADMIN, HR | HR Dashboard |
| `/finance` | ADMIN, FINANCE | Finance Dashboard |
| `/employee` | EMPLOYEE | Employee self-service dashboard |
| `/employees` | ADMIN, HR | Employee directory + CSV import |
| `/employees/[id]` | ADMIN, HR | Employee detail / edit |
| `/attendance` | All | Attendance log + clock in/out |
| `/leave` | All | Leave requests + approvals |
| `/payroll` | ADMIN, HR | Payroll runs: create, process, approve, disburse |
| `/reports` | ADMIN, HR | CSV report builder |
| `/finance/expenses` | All | Expense claims (employees submit, Finance approves) |
| `/finance/budgets` | ADMIN, FINANCE | Department budget setting + utilization |
| `/finance/petty-cash` | ADMIN, FINANCE | Petty cash funds + requests |
| `/finance/books/accounts` | ADMIN, FINANCE, HR | Chart of Accounts — view/manage |
| `/finance/books/journal` | ADMIN, FINANCE | Journal entries — create/post/reverse |
| `/finance/books/reports` | ADMIN, FINANCE, HR | P&L, Balance Sheet, Trial Balance |
| `/notifications` | All | In-app notification inbox |
| `/audit` | ADMIN | Audit trail viewer |
| `/manager/self-service` | All | Payslip download |
| `/settings` | All | Settings (profile, company, payroll, team, security, notifications) |
| `/settings/billing` | ADMIN | Subscription plan + M-Pesa upgrade |
| `/auth/login` | Public | Login with email/password (toast errors) + Clerk SignIn |
| `/auth/register` | Public | New company registration |
| `/auth/accept-invite` | Public | Accept team invitation |

---

## Third-Party Integrations

### Clerk (Identity & Access Management)
- Frontend: `@clerk/nextjs` — `ClerkProvider`, `useAuth`, `useUser`, `useSignIn`
- Backend: RS256 JWT verification against JWKS endpoint; keys cached 1 hour
- Webhook (`/api/webhooks/clerk/`): `user.created` → creates Django User + Tenant + seeds COA; `user.deleted` → removes user
- Invite flow: backend creates Clerk user via `POST /v1/users` with temp password, then creates Django record
- Real name synced from Clerk API on auto-provisioning (no more `@clerk.local` placeholders)

### Safaricom M-Pesa (Daraja API)
**B2C — Salary Disbursement**
- Disburses net pay to employees' M-Pesa numbers after payroll approval
- Callbacks: `/api/mpesa/b2c/result/` and `/api/mpesa/b2c/timeout/`

**STK Push — Subscription Payments**
- Tenants pay for plan upgrades via M-Pesa STK Push
- Callback: `/api/mpesa/stk-push-callback/`

Both support sandbox and production via `MPESA_ENVIRONMENT`.

### AWS S3 (Payslip Storage)
- Payslip PDFs uploaded with `AES256` server-side encryption, private ACL
- Object key: `payslips/{tenant_id}/{year}/{month}/{employee_id}.pdf`
- Download via 5-minute pre-signed URLs
- Gracefully degrades to email-only if `AWS_PAYSLIPS_BUCKET` not set

### Email (SMTP via Resend)
- Invite emails with login credentials
- Payslip delivery with PDF attachment
- Sender branded per-tenant

### Redis (Upstash or Docker)
- Celery message broker and result backend
- Django cache layer
- Falls back to in-memory + synchronous Celery in dev

### Supabase / PostgreSQL
- Primary database (production): Supabase eu-central-1
- Backup database: Supabase eu-west-1 (separate project, same schema)
- pgBouncer-compatible: transaction pooler port 6543, `DISABLE_SERVER_SIDE_CURSORS=True`
- Failover: swap `DATABASE_URL` env var to backup connection string

---

## Deployment & Infrastructure

### Docker Compose — Development
```
Services: db (postgres:16), backend (Django dev server)
```

### Docker Compose — Production
```
Services: redis, backend (Gunicorn 4 workers), worker (Celery 2 concurrent), nginx
All on workwise_net bridge network.
```

### Nginx Configuration
- HTTP → HTTPS redirect
- TLS: TLSv1.2 + TLSv1.3, ECDHE ciphers, OCSP stapling
- HSTS: 1 year, `includeSubDomains`, `preload`
- API domain: `api.workwise.co.ke`
- Static files: 1-year cache, `immutable`
- M-Pesa callbacks: no rate limiting, 30s read timeout
- General API: 120s read timeout; 15 MB max body

### Recommended Production Stack (Cloud)
- **Frontend**: Vercel (Next.js zero-config deployment)
- **Backend**: Railway (Django + Celery worker + Redis in one project)
- **Database**: Supabase (already configured with primary + backup)
- **Domain**: `workwise.co.ke` via Namecheap/KENIC

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `DJANGO_SECRET_KEY` | Yes | Django secret key |
| `DJANGO_DEBUG` | Yes | `True` for dev, `False` for production |
| `DJANGO_ALLOWED_HOSTS` | Prod | Comma-separated allowed hostnames |
| `DATABASE_URL` | Prod | Supabase PostgreSQL connection string (pooler port 6543) |
| `REDIS_URL` | Prod | Redis URL (blank = synchronous Celery in dev) |
| `CORS_ALLOWED_ORIGINS` | Prod | Frontend origin(s) |
| `FRONTEND_URL` | Yes | Frontend base URL (used in invite emails) |
| `MASTER_ENCRYPTION_KEY` | Yes | Base64 32-byte key for AES-256-GCM field encryption |
| `CLERK_ISSUER` | Yes | Clerk tenant issuer URL |
| `CLERK_JWKS_URL` | Yes | Clerk JWKS endpoint |
| `CLERK_SECRET_KEY` | Yes | Clerk backend secret key |
| `CLERK_WEBHOOK_SECRET` | Yes | Svix webhook signature secret |
| `EMAIL_HOST` / `EMAIL_PORT` / `EMAIL_HOST_USER` / `EMAIL_HOST_PASSWORD` | Prod | SMTP credentials (Resend) |
| `DEFAULT_FROM_EMAIL` | No | Sender address |
| `MPESA_ENABLED` | No | `True` to enable M-Pesa |
| `MPESA_ENVIRONMENT` | No | `sandbox` or `production` |
| `MPESA_CONSUMER_KEY` / `MPESA_CONSUMER_SECRET` | M-Pesa | Daraja API credentials |
| `MPESA_B2C_SHORTCODE` | M-Pesa | B2C shortcode |
| `MPESA_EXPRESS_SHORTCODE` / `MPESA_PASSKEY` | M-Pesa | STK Push credentials |
| `MPESA_B2C_RESULT_URL` / `MPESA_B2C_TIMEOUT_URL` | M-Pesa | Safaricom callback URLs |
| `MPESA_STK_CALLBACK_URL` | M-Pesa | STK Push callback URL |
| `DJANGO_SECURE_SSL` | Prod | `True` when behind TLS proxy |
| `AWS_PAYSLIPS_BUCKET` | No | S3 bucket for payslip storage |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_S3_REGION_NAME` | No | AWS credentials |
| `BACKUP_DATABASE_URL` | No | Backup Supabase connection string (eu-west-1) |

Frontend (Vercel):
| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API base URL |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CLERK_SECRET_KEY` | Clerk secret key |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/auth/login` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/auth/register` |

---

## CI/CD Pipeline

Defined in `.github/workflows/backend-regression.yml`.

**Job 1 — `backend-regression`** (Python 3.12, Ubuntu):
1. Install dependencies
2. Run test suite with coverage (≥50% threshold)
3. Upload `coverage.xml` artifact
4. Run Bandit security scan (MEDIUM + HIGH only)

Test modules: `core.tests`, `core.tests_authentication`, `core.test_jwks_integration`, `core.tests_rbac_mpesa`, `reports.tests`, `payroll.tests_mpesa_b2c`, `payroll.tests_mpesa`, `tenants.tests`

**Job 2 — `frontend-audit`** (Node 20):
1. `npm ci`
2. `npm audit --audit-level=high` — fails only on HIGH/CRITICAL vulnerabilities

---

## Subscription Plans

| Plan | Max Employees | Target |
|---|---|---|
| **STARTER** | 15 | Small businesses |
| **GROWTH** | 75 | Growing SMEs |
| **BUSINESS** | 300 | Established mid-size companies |
| **ENTERPRISE** | Unlimited | Large organisations |

New tenants start on a **14-day TRIAL** (STARTER). Upgrade via M-Pesa STK Push.
Statuses: `TRIAL` → `ACTIVE` → `PAST_DUE` / `SUSPENDED` / `CANCELLED`

---

## Directory Structure

```
WorkWise SaaS/
├── backend/
│   ├── config/                  # Django project: settings, URLs, WSGI, ASGI, Celery
│   ├── core/                    # Auth, middleware, encryption, audit, permissions, pagination
│   ├── tenants/                 # Tenant model, subscription payments
│   ├── users/                   # User model, notifications, invites, Clerk webhook
│   ├── employees/               # Employee profiles + bulk CSV import
│   ├── attendance/              # Clock-in/out, hours, geofencing
│   ├── leave/                   # Leave requests, balances, policy
│   ├── payroll/                 # Payroll runs, engine, M-Pesa B2C, tasks
│   │   └── statutory/           # NSSF / SHIF / PAYE / AHL calculation modules
│   ├── payslips/                # PDF generation + S3 pre-signed download
│   ├── reports/                 # CSV exports: P9, P10, NSSF, SHIF, payroll, attendance
│   ├── reports_engine/          # Custom report builder, exports (CSV/XLSX/PDF)
│   ├── finance/                 # Complete Finance module:
│   │   ├── models.py            #   ExpenseClaim, DepartmentBudget, PettyCashFund, PettyCashTransaction
│   │   ├── books_models.py      #   ChartOfAccount, JournalEntry, JournalLine
│   │   ├── seed_coa.py          #   50-account standard Kenyan SME Chart of Accounts
│   │   ├── auto_post.py         #   Auto-post journal entries from payroll/expenses/petty cash
│   │   ├── signals.py           #   Django signals: seed COA on tenant create, auto-post triggers
│   │   ├── views.py             #   Expenses, budgets, petty cash, financial summary API
│   │   ├── books_views.py       #   COA, journal entries, trial balance, P&L, balance sheet, ledger
│   │   ├── serializers.py       #   Operational finance serializers
│   │   └── books_serializers.py #   Books serializers with balance validation
│   ├── workflows/               # Approval workflows (templates, steps, requests, actions)
│   ├── documents/               # Document management (categories, docs, versions)
│   ├── integrations/            # API keys, webhooks, webhook logs
│   ├── backup/                  # Tenant backup & disaster recovery
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
│
├── frontend/src/
│   ├── app/
│   │   ├── page.tsx             # CEO Dashboard
│   │   ├── hr/                  # HR Manager Dashboard
│   │   ├── employee/            # Employee self-service Dashboard
│   │   ├── finance/
│   │   │   ├── page.tsx         # Finance Dashboard
│   │   │   ├── expenses/        # Expense Claims
│   │   │   ├── budgets/         # Department Budgets
│   │   │   ├── petty-cash/      # Petty Cash
│   │   │   └── books/
│   │   │       ├── accounts/    # Chart of Accounts
│   │   │       ├── journal/     # Journal Entries
│   │   │       └── reports/     # P&L, Balance Sheet, Trial Balance
│   │   ├── employees/           # Employee directory
│   │   ├── attendance/          # Attendance
│   │   ├── leave/               # Leave management
│   │   ├── payroll/             # Payroll runs
│   │   ├── reports/             # CSV report builder
│   │   ├── notifications/       # Notification inbox
│   │   ├── audit/               # Audit trail
│   │   ├── manager/self-service/ # Payslip download
│   │   ├── settings/            # All settings tabs
│   │   └── auth/                # Login, register, accept-invite
│   ├── components/
│   │   ├── layout/              # AppLayout, Sidebar, Topbar, Notifications, Profile
│   │   ├── premium/             # GlassCard, TiltCard, Add/Edit modals
│   │   ├── payroll/             # StatutoryExportButtons
│   │   ├── ui/                  # Shadcn primitives, toast, pagination
│   │   ├── ClerkTokenProvider.tsx
│   │   └── providers.tsx
│   └── lib/
│       ├── api.ts               # Axios + financeApi typed methods
│       ├── store.ts             # Zustand auth store
│       ├── types.ts             # All TypeScript interfaces
│       └── format.ts            # KES formatting utilities
│
├── nginx/nginx.conf
├── docker-compose.yml
├── docker-compose.prod.yml
├── .env.prod.example
├── .github/workflows/backend-regression.yml
└── PROJECT_OVERVIEW.md
```

---

## Key Design Decisions

**Why double-entry bookkeeping instead of just reports?**
Finance departments in real Kenyan SMEs are required to produce auditable books. Single-entry tracking (just recording expenses) cannot produce a proper Trial Balance, Income Statement, or Balance Sheet. The double-entry system ensures `Assets = Liabilities + Equity` at all times — the same principle used by every accounting software (QuickBooks, Sage, Xero).

**Why auto-post journal entries from payroll and expenses?**
The biggest pain point for finance teams is manually re-entering data that already exists in the HR system. When payroll is approved, the salary expense and statutory liability entries are automatically posted to the books — the finance team doesn't re-enter them. Same for expense claims and petty cash.

**Why seed a standard Kenyan COA on tenant creation?**
Every new company gets a ready-to-use 50-account chart immediately. They can start recording transactions from day one without a setup wizard. The standard numbering (1xxx-5xxx) follows the convention used by Kenyan accountants, so any finance professional joining the company will immediately recognise the structure.

**Why separate Finance and HR roles?**
In a real firm, the Finance Manager should not be able to run payroll (that's HR's job), and the HR Manager should not be able to post journal entries or set budgets (that's Finance's job). Keeping them separate enforces proper segregation of duties — a core internal control requirement under Kenya's Data Protection Act and general audit standards.

**Why Clerk instead of Django's built-in auth?**
Clerk provides production-grade MFA, social login, and session management. The backend only verifies JWTs — it never handles passwords — making the attack surface significantly smaller. The invite flow now creates Clerk users programmatically via the Backend API, so invited employees log in with their temporary password immediately without any Clerk-side registration step.

**Why an append-only audit log with HMAC seals?**
HR and Finance systems are high-value targets for insider manipulation (salary tampering, fake expense approvals). The immutable audit trail with integrity seals makes any post-facto modification of records detectable in both the live database and exported backups — satisfying Kenya's Data Protection Act §25 accountability requirements.
