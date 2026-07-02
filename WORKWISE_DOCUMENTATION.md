# WorkWise — Complete Technical Documentation

> **WorkWise** is a Kenya-focused, multi-tenant HR & Finance SaaS platform.
> It manages the full employee lifecycle and the complete finance department workflow —
> from onboarding to payroll, from expense claims to double-entry bookkeeping —
> secured behind Clerk authentication and AES-256-GCM field-level encryption.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Role-Based Access Control](#4-role-based-access-control)
5. [Invite & Onboarding Flow](#5-invite--onboarding-flow)
6. [Multi-Tenancy Design](#6-multi-tenancy-design)
7. [HR Module](#7-hr-module)
8. [Payroll Engine](#8-payroll-engine)
9. [Finance Module](#9-finance-module)
10. [Finance Books — Double-Entry Bookkeeping](#10-finance-books--double-entry-bookkeeping)
11. [M-Pesa Integration](#11-m-pesa-integration)
12. [Authentication & Security](#12-authentication--security)
13. [Notifications System](#13-notifications-system)
14. [Audit Trail](#14-audit-trail)
15. [REST API Reference](#15-rest-api-reference)
16. [Frontend — Pages & Dashboards](#16-frontend--pages--dashboards)
17. [Subscription Plans & Billing](#17-subscription-plans--billing)
18. [Environment Configuration](#18-environment-configuration)
19. [Deployment](#19-deployment)

---

## 1. Project Overview

WorkWise is a B2B SaaS application where each **company (tenant)** gets a fully isolated workspace. The platform serves four distinct roles with tailored dashboards and access controls:

| Domain | Features |
|---|---|
| **Employee Management** | CRUD, departments, encrypted KRA PIN, National ID, NSSF/SHIF numbers, M-Pesa number, bank details, bulk CSV import |
| **Attendance** | Clock-in/out with GPS geofencing, public holiday 2x overtime detection, bulk CSV upload, presence matrix |
| **Leave Management** | Annual, Sick, Maternity, Paternity, Unpaid — two-stage approval, Employment Act defaults, balance tracking |
| **Payroll** | KRA-compliant PAYE, NSSF (old/new act), SHIF, AHL — fully configurable per tenant, payslip PDF generation |
| **Disbursement** | M-Pesa B2C bulk salary payments, bank EFT exports (Equity, KCB, Co-op, Stanbic) |
| **Finance Operations** | Expense claims with approval workflow, department budgets with utilization tracking, petty cash management |
| **Finance Books** | Double-entry bookkeeping, Chart of Accounts (50-account Kenyan SME standard), journal entries, Income Statement, Balance Sheet, Trial Balance |
| **Statutory Exports** | KRA P9, P10, NSSF schedule, SHIF/AHL schedule — streaming CSV exports |
| **Notifications** | Real-time in-app notifications for leave, payroll, and employee events |
| **Audit Trail** | Cryptographically immutable append-only log with HMAC-SHA256 integrity seals |

---

## 2. System Architecture

```
Browser (Next.js 16)
      │  HTTPS + Clerk Bearer JWT
      ▼
Django / Gunicorn (:8000)
  ├── REST API  (/api/*)
  ├── Django Admin (/admin/)
  └── Clerk Webhook (/api/webhooks/clerk/)
      │
      ├── Supabase PostgreSQL (primary: eu-central-1, backup: eu-west-1)
      ├── Redis (Celery broker + cache — production)
      └── Celery Worker (payroll processing, payslip email/S3)
```

**Multi-tenancy** is enforced at the ORM level via `TenantScopedModel`.
Every query is automatically scoped to the authenticated user's tenant.

---

## 3. Technology Stack

### Backend
| Layer | Technology |
|---|---|
| Framework | Django 6.x + Django REST Framework |
| Language | Python 3.12 |
| Database | PostgreSQL 16 via Supabase |
| Auth | Clerk JWT/RS256 (JWKS verification) |
| Async | Celery 5 + Redis 7 |
| PDF | ReportLab |
| Storage | AWS S3 (payslip storage) |
| Server | Gunicorn + Nginx |
| Encryption | AES-256-GCM (`cryptography` library) |
| Webhooks | Svix (Clerk signature verification) |
| Email | SMTP via Resend |

### Frontend
| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| Components | Shadcn/UI + Glassmorphic design system |
| Auth | `@clerk/nextjs` v6 |
| State | Zustand v5 + TanStack React Query v5 |
| HTTP | Axios with Clerk JWT interceptor |
| Icons | Lucide React |

---

## 4. Role-Based Access Control

WorkWise has four roles. Every new company registration creates one **Admin**. All other users must be invited by the Admin.

| Role | Home Dashboard | Key Access |
|---|---|---|
| `ADMIN` (CEO) | `/` — CEO Dashboard | Full access to all HR + Finance modules, audit trail, billing, team management |
| `HR` | `/hr` — HR Dashboard | Employees, attendance, leave, payroll, statutory exports |
| `FINANCE` | `/finance` — Finance Dashboard | Expenses, budgets, petty cash, chart of accounts, journal entries, financial reports |
| `EMPLOYEE` | `/employee` — Employee Dashboard | Self-service: clock in/out, leave requests, expense claims, payslip download |

---

## 5. Invite & Onboarding Flow

1. Admin goes to **Settings → Team Members**
2. Fills in first name, last name, email, and role (HR / Finance Manager / Employee)
3. Backend generates a secure temporary password (12 chars, mixed case + digit + special)
4. Creates the Clerk user via Clerk Backend API with the password
5. Auto-verifies the email so the password works immediately
6. Creates the Django user record with the assigned role and tenant
7. Emails login credentials to the invitee with a direct login link
8. Invitee clicks link → any existing session is signed out → login page opens with email pre-filled
9. Invitee enters temp password → full page reload → `ClerkTokenProvider` reads role → redirects to correct dashboard
10. Invitee can change password from **Settings → Security → Change Password**

**Removing team members:**
Admin can remove any non-admin member from Settings → Team Members → Remove.
This deletes the user from both the Django database and Clerk (so they cannot log back in).

---

## 6. Multi-Tenancy Design

- Every business data model extends `TenantScopedModel` (abstract Django model)
- `TenantManager` automatically filters every queryset to `tenant = current_tenant`
- Tenant is resolved from the Clerk JWT by `ClerkAuthentication` and stored in thread-local context by `TenantMiddleware`
- `perform_create()` on every ViewSet stamps `tenant = request.user.tenant` before saving
- Cross-tenant data access is impossible through the standard ORM layer
- New tenant creation automatically seeds a full 50-account Chart of Accounts and default `PayrollConfig`

---

## 7. HR Module

### Employee Model
Key fields: `name`, `email`, `phone`, `department`, `job_title`, `employment_type` (monthly/weekly/daily/hourly), `salary_basic`, `allowances` (JSON), `payment_method` (mpesa/bank)

**Kenya-specific statutory fields (all encrypted at rest):**
- `kra_pin` — KRA Personal Identification Number (format: A001234567X, validated)
- `national_id` — National ID / Alien ID / Passport
- `nssf_number` — NSSF membership number
- `shif_number` — SHIF membership number
- `payroll_number` — Internal payroll number
- `nationality` — Default: Kenyan (affects PAYE treatment)
- `county` — County of residence/work
- `work_permit_number` — Required for non-citizen employees

### Attendance
- Clock-in/out with HTML5 GPS geolocation
- Haversine formula geofence validation (warning-only, never blocks)
- `is_public_holiday` and `is_sunday` flags auto-set on save
- `overtime_rate` property: 2.0x on public holidays/Sundays, 1.5x on weekdays
- Kenya's 12 statutory public holidays + Easter + Idd-ul-Fitr + Idd-ul-Adha (2024–2027)

### Leave Management
- Types: Annual (21 days), Sick (30 days), Maternity (90 days), Paternity (14 days), Unpaid
- Two-stage approval: `pending` → `manager_approved` → `approved` | `rejected`
- `LeaveBalance` tracks entitled vs used days per employee per year
- Public holidays excluded from leave day count

---

## 8. Payroll Engine

### Calculation Flow
```
1. Normalize Base Salary
   monthly  → salary_basic
   weekly   → salary_basic × 4
   daily    → salary_basic × days_worked
   hourly   → salary_basic × hours_worked

2. Gross Pay = Base + Allowances + Overtime − Unpaid Leave Deduction
   Weekday overtime:         monthly_salary / 160 × 1.5
   Public holiday overtime:  monthly_salary / 160 × 2.0

3. Statutory Deductions (all configurable per tenant via PayrollConfig)
   NSSF   — new act: Tier I (6% up to LEL KES 7,000) + Tier II (6% LEL→UEL KES 36,000)
             old act: flat KES 200 employee / KES 200 employer (toggle: nssf_act)
   SHIF   — 2.75% of gross, minimum KES 300
   AHL    — 1.5% employee + 1.5% employer
   PAYE   — progressive KRA 2024/2025 bands after NSSF, minus KES 2,400 personal relief
            10% ≤24k | 25% next 8,333 | 30% next 467,667 | 32.5% next 300k | 35% above

4. Net Pay = Gross − NSSF − SHIF − AHL − PAYE
```

### Payroll Run Lifecycle
`draft` → `processed` → `approved` → `paid` | `reversed`

- **Reversal**: Creates a corrective draft run for the same period; auto-reverses the finance books journal entry

### Payslip Delivery
- Path A: S3 pre-signed URL (5-min expiry) if `payslip_s3_key` is set
- Path B: On-the-fly ReportLab PDF generation (fallback)
- Email delivery via Resend SMTP

---

## 9. Finance Module

### Expense Claims
- Employee submits: title, category, amount, date, receipt URL
- Categories: Travel, Accommodation, Meals, Office Supplies, Client Entertainment, Utilities, Training, Medical, Other
- Status workflow: `pending` → `approved` → `paid` | `rejected`
- Finance Manager approves/rejects with comment; marks as paid after reimbursement
- Auto-posts a journal entry to the books when marked as paid

### Department Budgets
- Finance Manager sets monthly budget per department
- Real-time utilization = payroll cost + approved expenses vs budget
- Alert at 80% utilization; red indicator when over budget

### Petty Cash
- Named funds with opening balance and live current balance
- Request types: Disbursement, Top-Up, Replenishment
- Approval workflow: `pending` → `disbursed` | `rejected`
- Fund balance auto-updated on disbursement
- Low balance warning at KES 5,000
- Auto-posts a journal entry on each disbursement

---

## 10. Finance Books — Double-Entry Bookkeeping

### Chart of Accounts
- 50-account standard Kenyan SME COA auto-seeded on tenant creation
- Account types: Assets (1xxx), Liabilities (2xxx), Equity (3xxx), Revenue (4xxx), Expenses (5xxx)
- Hierarchical parent/child structure
- System accounts cannot be deleted; custom accounts can be added

### Journal Entries
- Every entry must balance: total debits = total credits
- Sources: `MANUAL`, `PAYROLL` (auto), `EXPENSE` (auto), `PETTY` (auto)
- Status: `DRAFT` → `POSTED` | `REVERSED`
- Reversal creates a fully reversed entry with all debit/credit sides swapped

### Auto-Posting
| Trigger | Debit | Credit |
|---|---|---|
| Payroll approved | 5210 Salaries & Wages | 2210 PAYE + 2220 NSSF + 2230 SHIF + 2240 AHL + 1102 Bank |
| Expense marked paid | 5xxx Expense account | 1102 Bank |
| Petty cash disbursed | 5xxx Expense account | 1101 Petty Cash |

### Financial Reports
- **Trial Balance** — all accounts with debit/credit totals
- **Income Statement** — Revenue, COGS, Gross Profit, Operating Expenses, Net Profit/Loss
- **Balance Sheet** — Assets = Liabilities + Equity + Net Income
- **General Ledger** — Per-account running balance transaction history

---

## 11. M-Pesa Integration

### B2C — Salary Disbursement
- Disburses net pay to employees' M-Pesa numbers after payroll approval
- Uses Safaricom Daraja B2C API with `SalaryPayment` CommandID
- Phone number normalization: `07xx → 2547xx`
- Sandbox mode: simulates disbursement without sending real money
- Callbacks: `/api/mpesa/b2c/result/` and `/api/mpesa/b2c/timeout/`
- `MpesaTransaction` model tracks status: `pending` | `success` | `failed` | `timeout`

### STK Push — Subscription Payments
- Used when a tenant upgrades their plan
- Initiates M-Pesa push notification to admin's phone
- Callback: `/api/mpesa/stk-push-callback/`

### Switching to Production
Change `.env`:
```
MPESA_ENABLED=True
MPESA_ENVIRONMENT=production
```
Replace sandbox credentials with Safaricom production credentials.

---

## 12. Authentication & Security

### Clerk JWT Authentication
1. Reads `kid` from token header
2. Verifies `iss` against `CLERK_ISSUER`
3. Fetches Clerk JWKS, caches keys for 1 hour
4. Decodes RS256 token; skips audience validation if `CLERK_AUDIENCE` is blank
5. Resolves `sub` (Clerk user ID) → Django `User`

### Field-Level Encryption
AES-256-GCM encryption on: `kra_pin`, `national_id`, `mpesa_number`, `bank_details`
Required: `MASTER_ENCRYPTION_KEY` (base64-encoded 32-byte key) — app refuses to start without it.

### KRA PIN Validation
Format: `A001234567X` (letter + 9 digits + letter)
Validated on both frontend (live, on blur) and backend serializer.

### HTTP Security Headers
`HSTS`, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`

### Rate Limiting
Anonymous: 30/min | Authenticated: 120/min | Login: 10/min | Registration: 5/hour

### Webhook Security
All Clerk webhooks verified using Svix HMAC signature (`CLERK_WEBHOOK_SECRET`).

---

## 13. Notifications System

### Backend Signals
| Trigger | Recipients | Type |
|---|---|---|
| Leave submitted | All ADMIN + HR in tenant | `leave` |
| Leave approved/rejected | Requesting employee | `leave` |
| Payroll run processed | All ADMIN + HR in tenant | `payroll` |
| New employee added | All ADMIN in tenant | `employee` |
| Bulk CSV import | All ADMIN in tenant (one summary) | `employee` |

### Frontend
- Bell icon in topbar shows unread count
- Notification panel: list with mark-read, dismiss, "View all" link
- Full `/notifications` page with All/Unread/Read tabs and category filters

---

## 14. Audit Trail

- `AuditLog` model — append-only at ORM level and PostgreSQL trigger level
- HMAC-SHA256 integrity seal per row (tamper detection)
- Recorded actions: `CREATE`, `UPDATE`, `DELETE`, `LOGIN`, `PAYROLL_RUN`, `PAYROLL_APPROVE`, `EXPORT`, `PERMISSION_CHANGE`, `WEBHOOK`
- Each entry: `actor_id`, `actor_email`, `tenant`, `action`, `resource_type`, `resource_id`, `ip_address`, `user_agent`, `payload` (before/after diff), `integrity_seal`, `timestamp`
- Satisfies Kenya Data Protection Act 2019 §25 accountability requirements

---

## 15. REST API Reference

All endpoints prefixed `/api/` and require Clerk Bearer JWT unless noted.

### Auth & Users
| Method | Path | Description |
|---|---|---|
| GET/PATCH | `/api/users/me/` | User profile — PATCH updates first/last name |
| POST | `/api/users/invite/` | Invite team member (generates temp password, emails credentials) |
| GET | `/api/users/team/` | List all team members |
| DELETE | `/api/users/team/<id>/remove/` | Remove active member (deletes from DB + Clerk) |
| DELETE | `/api/users/invite/<id>/` | Revoke pending invite |

### HR
| Method | Path | Description |
|---|---|---|
| GET/POST | `/api/employees/` | List / create employees |
| GET/PATCH/DELETE | `/api/employees/<id>/` | Employee detail |
| POST | `/api/employees/bulk_import/` | CSV import (upsert by email) |
| GET/POST | `/api/attendance/` | Attendance log |
| GET/POST | `/api/leave/` | Leave requests |
| POST | `/api/leave/<id>/approve/` | Final approval |
| POST | `/api/leave/<id>/manager_approve/` | First-stage approval |
| POST | `/api/leave/<id>/reject/` | Reject |

### Payroll
| Method | Path | Description |
|---|---|---|
| GET/POST | `/api/payroll/` | Payroll runs |
| POST | `/api/payroll/<id>/process/` | Trigger async calculation |
| POST | `/api/payroll/<id>/approve/` | Approve (auto-posts to finance books) |
| POST | `/api/payroll/<id>/reverse/` | Reverse (creates corrective draft run) |
| POST | `/api/payroll/<id>/send-payslips/` | Generate PDFs + email |
| POST | `/api/payroll/<id>/disburse-mpesa/` | M-Pesa B2C disbursement |
| GET | `/api/payroll/<id>/bank-export/` | Bank EFT export |
| GET | `/api/payslips/<id>/download/` | Download payslip |

### Finance
| Method | Path | Description |
|---|---|---|
| GET/POST | `/api/finance/expenses/` | Expense claims |
| POST | `/api/finance/expenses/<id>/approve/` | Approve |
| POST | `/api/finance/expenses/<id>/reject/` | Reject |
| POST | `/api/finance/expenses/<id>/mark-paid/` | Mark reimbursed (auto-posts to books) |
| GET/POST | `/api/finance/budgets/` | Department budgets |
| GET | `/api/finance/budgets/utilization/` | Budget vs actual spend |
| GET/POST | `/api/finance/petty-cash/` | Petty cash funds |
| GET | `/api/finance/summary/` | Finance dashboard KPIs |
| GET/POST | `/api/finance/accounts/` | Chart of Accounts |
| POST | `/api/finance/accounts/seed/` | Seed standard Kenyan COA |
| GET/POST | `/api/finance/journal/` | Journal entries |
| POST | `/api/finance/journal/<id>/post_entry/` | Post draft entry |
| POST | `/api/finance/journal/<id>/reverse/` | Reverse posted entry |
| GET | `/api/finance/trial-balance/` | Trial balance |
| GET | `/api/finance/income-statement/` | P&L statement |
| GET | `/api/finance/balance-sheet/` | Balance sheet |
| GET | `/api/finance/general-ledger/` | General ledger |

### Reports & Settings
| Method | Path | Description |
|---|---|---|
| POST | `/api/reports/` | CSV export builder |
| GET | `/api/reports/p9/` | KRA P9 Annual |
| GET | `/api/reports/p10/` | KRA P10 Monthly |
| GET | `/api/reports/nssf/` | NSSF schedule |
| GET | `/api/reports/shif/` | SHIF + AHL schedule |
| GET | `/api/dashboard/stats/` | Dashboard KPIs |
| GET | `/api/audit-trail/` | Audit log (ADMIN only) |
| GET/PATCH | `/api/settings/company/` | Company settings |
| GET/PATCH | `/api/settings/payroll/` | Payroll statutory config |

---

## 16. Frontend — Pages & Dashboards

| Route | Role Access | Description |
|---|---|---|
| `/` | ADMIN | CEO Dashboard — 6 KPIs, financial overview, dept headcount |
| `/hr` | ADMIN, HR | HR Dashboard — people operations KPIs, quick actions |
| `/finance` | ADMIN, FINANCE | Finance Dashboard — KPIs, budget utilization, expense breakdown |
| `/employee` | EMPLOYEE | Self-service dashboard |
| `/employees` | ADMIN, HR | Employee directory + CSV import |
| `/attendance` | All | Clock in/out, presence matrix, logs |
| `/leave` | All | Leave requests + approvals |
| `/payroll` | ADMIN, HR | Payroll runs |
| `/reports` | ADMIN, HR | CSV report builder + statutory exports |
| `/finance/expenses` | All | Expense claims |
| `/finance/budgets` | ADMIN, FINANCE | Department budgets |
| `/finance/petty-cash` | ADMIN, FINANCE | Petty cash funds |
| `/finance/books/accounts` | ADMIN, FINANCE, HR | Chart of Accounts |
| `/finance/books/journal` | ADMIN, FINANCE | Journal entries |
| `/finance/books/reports` | ADMIN, FINANCE, HR | P&L, Balance Sheet, Trial Balance |
| `/notifications` | All | Notification inbox |
| `/audit` | ADMIN | Audit trail |
| `/settings` | All | Profile, company, payroll config, team, security |
| `/settings/billing` | ADMIN | Subscription plan + M-Pesa upgrade |
| `/pricing` | Public | Pricing page with monthly/annual toggle |

---

## 17. Subscription Plans & Billing

| Plan | Max Employees | Price (Monthly) | Price (Annual) |
|---|---|---|---|
| **Starter** | 15 | KES 3,500 | KES 35,000 (2 months free) |
| **Growth** | 75 | KES 12,000 | KES 120,000 (2 months free) |
| **Business** | 300 | KES 35,000 | KES 350,000 (2 months free) |
| **Enterprise** | Unlimited | Contact us | Contact us |

- Plan upgrades paid via M-Pesa STK Push
- 14-day free trial on registration
- Trial expiry warning banner shown at ≤7 days remaining

---

## 18. Environment Configuration

### Backend (`.env`)
| Variable | Required | Description |
|---|---|---|
| `DJANGO_SECRET_KEY` | Yes | Django secret key |
| `DJANGO_DEBUG` | Yes | `True` for dev, `False` for production |
| `MASTER_ENCRYPTION_KEY` | Yes | Base64 32-byte AES key — app won't start without it |
| `DATABASE_URL` | Prod | Supabase PostgreSQL connection string |
| `REDIS_URL` | Prod | Redis URL (blank = synchronous Celery in dev) |
| `CLERK_ISSUER` | Yes | Clerk tenant issuer URL |
| `CLERK_JWKS_URL` | Yes | Clerk JWKS endpoint |
| `CLERK_SECRET_KEY` | Yes | Clerk backend secret key |
| `CLERK_WEBHOOK_SECRET` | Yes | Svix webhook signature secret |
| `EMAIL_HOST` / `EMAIL_HOST_PASSWORD` | Prod | SMTP credentials (Resend) |
| `MPESA_ENABLED` | No | `True` to enable M-Pesa |
| `MPESA_ENVIRONMENT` | No | `sandbox` or `production` |

### Frontend (Vercel env vars)
| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API base URL |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CLERK_SECRET_KEY` | Clerk secret key |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/auth/login` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/auth/register` |

---

## 19. Deployment

### Local Development
```bash
# Terminal 1 — Backend
cd backend
. .venv/bin/activate
python manage.py runserver

# Terminal 2 — Frontend
cd frontend
npm run dev
```

### Recommended Production Stack
| Service | Platform |
|---|---|
| Frontend | Vercel (zero-config Next.js) |
| Backend + Celery worker | Railway |
| Redis | Railway Redis service |
| Database | Supabase (primary: eu-central-1, backup: eu-west-1) |
| Email | Resend (SMTP) |
| Domain | `workwise.co.ke` via Namecheap/KENIC |

### Production Checklist
- [ ] Set `DJANGO_DEBUG=False`
- [ ] Set `DJANGO_SECURE_SSL=True`
- [ ] Configure Clerk production instance with real domain
- [ ] Register Clerk webhook pointing to Railway backend URL
- [ ] Set `MPESA_ENVIRONMENT=production` with real Daraja credentials
- [ ] Configure `AWS_PAYSLIPS_BUCKET` for S3 payslip storage
- [ ] Set up custom domain and TLS in Nginx/Railway
