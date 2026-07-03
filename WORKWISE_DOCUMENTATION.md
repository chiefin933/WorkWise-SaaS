# WorkWise — Complete Technical Documentation

> **WorkWise** is a Kenya-focused, multi-tenant HR & Finance SaaS platform.
> It manages the full employee lifecycle and the complete finance department workflow —
> from onboarding to payroll, from expense claims to double-entry bookkeeping —
> secured behind Clerk authentication and AES-256-GCM field-level encryption.

**Current Status: Production-Ready**
All coding work is complete. The only remaining steps require external credentials
(domain, Clerk production instance, Safaricom Daraja go-live, optional AWS S3).

---

## Table of Contents

1. [What's Complete](#whats-complete)
2. [Technology Stack](#technology-stack)
3. [Architecture](#architecture)
4. [Role-Based Access Control](#role-based-access-control)
5. [Invite & Onboarding Flow](#invite--onboarding-flow)
6. [Route Structure](#route-structure)
7. [HR Module](#hr-module)
8. [Payroll Engine](#payroll-engine)
9. [Finance Module](#finance-module)
10. [Finance Books — Double-Entry Bookkeeping](#finance-books--double-entry-bookkeeping)
11. [M-Pesa Integration](#m-pesa-integration)
12. [Authentication & Security](#authentication--security)
13. [Notifications System](#notifications-system)
14. [Audit Trail](#audit-trail)
15. [PWA & Public Marketing Site](#pwa--public-marketing-site)
16. [Email System](#email-system)
17. [REST API Reference](#rest-api-reference)
18. [Frontend Pages & Dashboards](#frontend-pages--dashboards)
19. [Subscription Plans & Billing](#subscription-plans--billing)
20. [Deployment](#deployment)
21. [What Remains (Credentials Only)](#what-remains-credentials-only)

---

## What's Complete

Every feature listed below is built, tested locally, and pushed to GitHub.

### HR
- ✅ Multi-tenant employee management with all Kenya statutory fields (KRA PIN, National ID, NSSF, SHIF numbers, county, nationality, work permit)
- ✅ KRA PIN validated on frontend (live, on blur) and backend serializer (`^[A-Z]\d{9}[A-Z]$`)
- ✅ Bulk CSV employee import with column alias support and upsert by email
- ✅ Add Employee modal + Edit Employee modal (tabbed: Basic Info / Statutory IDs / Payment)
- ✅ Attendance with GPS geofencing, public holiday 2× overtime detection, presence matrix
- ✅ Kenya 12-day public holiday calendar (2024–2027) including Easter + Idd dates
- ✅ Leave management (Annual 21d / Sick 30d / Maternity 90d / Paternity 14d / Unpaid)
- ✅ Two-stage leave approval (manager → HR/Admin)
- ✅ Leave balance tracking per employee per year
- ✅ Employee self-service portal (payslips, leave requests, leave balance, phone update)

### Payroll
- ✅ Kenyan statutory engine fully connected to `PayrollConfig` (not hardcoded)
- ✅ NSSF old/new act toggle in Settings → Payroll Config with LEL/UEL configuration
- ✅ PAYE progressive bands, SHIF 2.75% with KES 300 minimum, AHL 1.5%
- ✅ Public holiday overtime 2× / weekday overtime 1.5× split in payroll task
- ✅ Payroll reversal workflow — reverse approved/paid run, auto-reverses finance JE
- ✅ Payroll reversal button in UI with confirmation dialog
- ✅ PDF payslip generation (ReportLab, branded)
- ✅ S3 payslip storage + 5-minute pre-signed download URL
- ✅ Payslip email with branded HTML template + PDF attachment
- ✅ Statutory CSV exports: KRA P9, P10 (P10 double-deduction bug fixed), NSSF (correct columns), SHIF/AHL
- ✅ Bank EFT exports: Equity, KCB, Co-op, Stanbic
- ✅ M-Pesa B2C salary disbursement (sandbox)

### Finance
- ✅ Expense claims (submit / approve / reject / mark paid)
- ✅ Department budgets with real-time utilization (payroll + expenses vs budget)
- ✅ Petty cash fund management (request / approve / disburse)
- ✅ Double-entry bookkeeping: Chart of Accounts (50 standard Kenyan SME accounts auto-seeded)
- ✅ Journal entries with balance validation, post/reverse
- ✅ Auto-posting: payroll approval → JE, expense paid → JE, petty cash disbursed → JE
- ✅ Income Statement (P&L), Balance Sheet, Trial Balance, General Ledger
- ✅ Finance Dashboard with KPIs, budget utilization bar, expense by category

### CEO Dashboard
- ✅ Connected to both HR + Finance: live employee count, payroll cost, expense total, budget %, attendance rate, pending approvals
- ✅ Pending Approvals panel: leave requests + expense claims + latest payroll status
- ✅ Financial Overview: payroll / expenses / pending / petty cash vs budget bars
- ✅ Department headcount breakdown
- ✅ Recent Activity feed from notifications (both modules)
- ✅ 8-module management shortcut grid
- ✅ 30-second auto-refresh

### Security & Infrastructure
- ✅ AES-256-GCM field encryption: KRA PIN, National ID, M-Pesa number, bank details
- ✅ Svix HMAC webhook signature verification
- ✅ Append-only audit log with HMAC-SHA256 integrity seals
- ✅ Clerk JWT/RS256 with JWKS caching
- ✅ Rate limiting (anon 30/min, auth 120/min, login 10/min)
- ✅ HTTP security headers (CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy)
- ✅ `MASTER_ENCRYPTION_KEY` required at startup (app refuses to start without it)
- ✅ CI/CD: GitHub Actions (pytest + Bandit + npm audit)

### Frontend / UX
- ✅ Public marketing landing page at `/`
- ✅ PWA manifest, service worker (API calls never cached), install button
- ✅ Route groups: `(app)/` authenticated, `(marketing)/` public
- ✅ Custom 404, 500, global-error pages
- ✅ Trial expiry warning banner (≤7 days)
- ✅ Role-based post-login redirect (Admin → /dashboard, HR → /hr, Finance → /finance, Employee → /employee)
- ✅ Invite flow: temp password generated, Clerk user created, HTML email sent
- ✅ Branded HTML email templates (invite + payslip)
- ✅ Sitemap at `/sitemap.xml`
- ✅ robots.txt blocking crawlers from app routes
- ✅ NSSF Act toggle UI in Settings → Payroll Config
- ✅ Edit Employee modal with all Kenya statutory fields (3 tabs)
- ✅ Annual/monthly billing toggle on pricing page

---

## Technology Stack

### Backend
| Layer | Technology |
|---|---|
| Framework | Django 6.x + Django REST Framework |
| Language | Python 3.12 |
| Database | PostgreSQL 16 via Supabase (primary: eu-central-1, backup: eu-west-1) |
| Auth | Clerk JWT/RS256 (JWKS verification, keys cached 1 hour) |
| Async | Celery 5 + Redis 7 |
| PDF | ReportLab (branded payslips) |
| Storage | AWS S3 (payslip storage, private ACL, AES256 SSE) |
| Server | Gunicorn + Nginx |
| Encryption | AES-256-GCM (`cryptography` library) |
| Email | SMTP via Resend (HTML templates with inline CSS) |
| Webhooks | Svix HMAC signature verification |

### Frontend
| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, route groups) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| Auth | `@clerk/nextjs` v6 |
| State | Zustand v5 + TanStack React Query v5 |
| HTTP | Axios with Clerk JWT interceptor |
| PWA | Manual Workbox service worker (not next-pwa) |

---

## Architecture

```
/ (marketing)          ← public, no auth, static
/dashboard             ← CEO/Admin
/hr                    ← HR Manager
/finance               ← Finance Manager
/employee              ← Employee self-service
/employees, /payroll   ← shared authenticated routes
/auth/*                ← public

proxy.ts (Clerk middleware)
  ├── Public: /, /pricing, /auth/*, /manifest.json, /sw.js, /api/webhooks/*, /api/mpesa/*
  └── Protected: everything else → auth.protect()
```

---

## Role-Based Access Control

| Role | Home | Access |
|---|---|---|
| `ADMIN` | `/dashboard` | Full access to all modules, audit trail, billing, team management |
| `HR` | `/hr` | Employees, attendance, leave, payroll, statutory exports |
| `FINANCE` | `/finance` | Expenses, budgets, petty cash, chart of accounts, journals, reports |
| `EMPLOYEE` | `/employee` | Self-service: clock in/out, leave, payslips, expense claims |

---

## Invite & Onboarding Flow

1. Admin → Settings → Team Members → enter name, email, role
2. Backend generates secure temp password (12 chars, mixed)
3. Creates Clerk user via Backend API, auto-verifies email
4. Creates Django user record with role and tenant
5. Sends **branded HTML email** with credentials and direct login link
6. Invitee clicks link → any other session is signed out → login page with email pre-filled
7. Invitee logs in → full page reload → ClerkTokenProvider → role-based redirect
8. Invitee changes password: Settings → Security → Change Password

**Remove team member:** Admin → Settings → Team Members → Remove  
→ Deletes from Django DB + calls Clerk API to delete account

---

## Route Structure

```
src/app/
├── (marketing)/           ← public, no AppLayout
│   ├── layout.tsx         ← minimal wrapper
│   └── page.tsx           ← landing page
├── (app)/                 ← authenticated, wrapped by AppLayout
│   ├── layout.tsx         ← AppLayout + ErrorBoundary + force-dynamic
│   ├── dashboard/         ← CEO dashboard
│   ├── hr/                ← HR dashboard
│   ├── finance/           ← Finance dashboard + sub-pages
│   ├── employee/          ← Employee self-service
│   ├── employees/         ← Employee directory
│   ├── attendance/
│   ├── leave/
│   ├── payroll/
│   ├── reports/
│   ├── notifications/
│   ├── audit/
│   ├── manager/self-service/
│   └── settings/
├── auth/                  ← public auth pages
├── pricing/               ← public pricing
├── layout.tsx             ← root (Providers + ServiceWorkerRegistration)
├── not-found.tsx          ← branded 404
├── error.tsx              ← branded 500
├── global-error.tsx       ← root crash handler
└── sitemap.ts             ← /sitemap.xml
```

---

## HR Module

### Employee Model — Kenya Fields
All of these are in the DB and exposed in the Add/Edit modals:
- `kra_pin` — encrypted, validated `A001234567X`
- `national_id` — encrypted
- `nssf_number` — for NSSF remittance schedule
- `shif_number` — for SHIF remittance schedule
- `payroll_number` — internal reference
- `nationality` — default "Kenyan"
- `county`
- `work_permit_number` — required for non-citizens

### Attendance
- GPS geofencing (Haversine), warning-only
- `is_public_holiday` and `is_sunday` flags auto-set on save
- `overtime_rate`: 2.0× public holidays/Sundays, 1.5× weekdays
- Kenya 12 statutory holidays + Easter + Idd (2024–2027)

---

## Payroll Engine

### Statutory Rates (all configurable in Settings → Payroll Config)
| Deduction | Default | Config field |
|---|---|---|
| NSSF (new act) | Tier I 6% ≤ LEL (KES 7,000) + Tier II 6% ≤ UEL (KES 36,000) | `nssf_act`, `nssf_rate`, `nssf_lel`, `nssf_uel` |
| NSSF (old act) | Flat KES 200 employee + KES 200 employer | `nssf_act = 'old'` |
| SHIF | 2.75% of gross, minimum KES 300 | `shif_rate`, `shif_min` |
| AHL | 1.5% employee + 1.5% employer | `ahl_rate` |
| PAYE | Progressive KRA 2024/2025 bands, minus personal relief | `paye_bands`, `personal_relief` |

### Payroll Run Lifecycle
```
draft → processed → approved → paid
                 ↘           ↘
                  reversed ← (from approved or paid)
```
Reversal creates a new corrective draft run and auto-reverses the finance JE.

---

## Finance Module

### Expense Claims
- Employees submit; Finance Manager approves/rejects/marks paid
- Auto-posts DR 5xxx / CR 1102 Bank to finance books on payment

### Department Budgets
- Monthly budget per department set by Finance Manager
- Real-time: payroll cost + approved expenses vs budget
- Amber alert at 80%, red at 100%

### Petty Cash
- Named funds with opening balance and live current balance
- Request → approve → disburse workflow
- Auto-posts DR 5xxx / CR 1101 Petty Cash on disbursement

---

## Finance Books — Double-Entry Bookkeeping

### Chart of Accounts
50 standard Kenyan SME accounts auto-seeded on tenant creation:
- 1xxx Assets (Cash, Bank KCB/Equity, M-Pesa Float, Receivables, Fixed Assets)
- 2xxx Liabilities (PAYE Payable, NSSF, SHIF, AHL, Accounts Payable, Loans)
- 3xxx Equity (Share Capital, Retained Earnings)
- 4xxx Revenue (Sales, Service, Other Income)
- 5xxx Expenses (Salaries, NSSF Employer, SHIF, AHL, Rent, Utilities, Travel, etc.)

### Auto-Posting Triggers
| Trigger | Debit | Credit |
|---|---|---|
| Payroll approved | 5210 Salaries (gross) | 2210 PAYE + 2220 NSSF + 2230 SHIF + 2240 AHL + 1102 Bank (net) |
| Expense claim paid | 5xxx by category | 1102 Bank |
| Petty cash disbursed | 5xxx by category | 1101 Petty Cash |

### Reports
Income Statement, Balance Sheet, Trial Balance, General Ledger — all with date pickers.

---

## M-Pesa Integration

- **B2C**: Salary disbursement to employee M-Pesa numbers. Sandbox by default.
- **STK Push**: Subscription plan upgrades. Callback at `/api/mpesa/stk-push-callback/`.
- Phone normalisation: `07xx → 2547xx`
- `MpesaTransaction` status: `pending | success | failed | timeout`

**To go live:** `MPESA_ENVIRONMENT=production` + Safaricom production credentials.

---

## Authentication & Security

- Clerk JWT/RS256, JWKS cached 1 hour, audience validation skipped when `CLERK_AUDIENCE` is blank
- AES-256-GCM on `kra_pin`, `national_id`, `mpesa_number`, `bank_details`
- `MASTER_ENCRYPTION_KEY` required at startup
- KRA PIN regex validation both layers
- Rate limiting: anon 30/min, auth 120/min, login 10/min, register 5/hour
- `proxy.ts` Clerk middleware: explicit public route matcher

---

## Notifications System

### Signals
| Trigger | Recipients |
|---|---|
| Leave submitted | ADMIN + HR |
| Leave approved/rejected | Requesting employee |
| Payroll processed | ADMIN + HR |
| New employee | ADMIN (bulk import sends one summary) |

### Frontend
- Bell icon with unread count
- Panel with mark-read, dismiss, view all
- Full `/notifications` page with tabs and category filters

---

## Audit Trail

- Append-only at ORM + PostgreSQL trigger level
- HMAC-SHA256 integrity seal per row
- Actions: CREATE, UPDATE, DELETE, LOGIN, PAYROLL_RUN, PAYROLL_APPROVE, EXPORT, PERMISSION_CHANGE, WEBHOOK
- LOGIN entries include IP geolocation

---

## PWA & Public Marketing Site

### Landing Page (`/`)
- Product features, role cards, testimonials, pricing teaser
- `AuthRedirect`: authenticated users → `/dashboard`
- Download App button (Chrome/Android: install prompt; iOS: modal instructions)

### Service Worker (`/sw.js`)
- Cache-first for JS/CSS/fonts/images
- **Network-only for ALL `/api/*`** — payroll/finance data never cached
- Network-first for HTML navigation

### Manifest (`/manifest.json`)
- Icons: 192px, 512px, 512px maskable
- Shortcuts: Payroll, Employees

---

## Email System

All emails are sent via Resend SMTP from `onboarding@resend.dev`.

### Invite Email
- Branded HTML with credentials box (email + temp password)
- Teal CTA button linking directly to login page with email pre-filled
- Security reminder to change password

### Payslip Email
- Branded HTML pay summary table (Gross → Deductions → Net)
- Full itemised deductions (PAYE, NSSF, SHIF, AHL)
- PDF payslip attached

Both use `EmailMultiAlternatives` (text + HTML) for email client compatibility.

---

## REST API Reference

### Auth & Users
| Method | Path | Description |
|---|---|---|
| GET/PATCH | `/api/users/me/` | Profile (PATCH updates first/last name) |
| POST | `/api/users/invite/` | Invite — generates password, creates Clerk user, sends HTML email |
| GET | `/api/users/team/` | List team members |
| DELETE | `/api/users/team/<id>/remove/` | Remove member (Django DB + Clerk) |
| DELETE | `/api/users/invite/<id>/` | Revoke pending invite |

### HR
| Method | Path | Description |
|---|---|---|
| GET/POST | `/api/employees/` | List/create |
| PATCH | `/api/employees/<id>/` | Update (all Kenya statutory fields) |
| POST | `/api/employees/bulk_import/` | CSV upsert |
| GET/POST | `/api/attendance/` | Attendance log |
| GET/POST | `/api/leave/` | Leave requests |
| POST | `/api/leave/<id>/approve/` | Final approval |
| POST | `/api/leave/<id>/manager_approve/` | Stage 1 approval |
| GET/PATCH | `/api/leave/policy/` | Leave policy |

### Payroll
| Method | Path | Description |
|---|---|---|
| GET/POST | `/api/payroll/` | Runs |
| POST | `/api/payroll/<id>/process/` | Trigger calculation |
| POST | `/api/payroll/<id>/approve/` | Approve → auto-posts finance JE |
| POST | `/api/payroll/<id>/reverse/` | Reverse → creates corrective draft |
| POST | `/api/payroll/<id>/send-payslips/` | HTML email + PDF attachment |
| POST | `/api/payroll/<id>/disburse-mpesa/` | M-Pesa B2C |
| GET | `/api/payroll/<id>/bank-export/?bank=equity` | EFT file |
| GET | `/api/payslips/<id>/download/` | S3 pre-signed URL or on-the-fly PDF |

### Finance
| Method | Path | Description |
|---|---|---|
| GET/POST | `/api/finance/expenses/` | Expense claims |
| POST | `/api/finance/expenses/<id>/approve/` | Approve |
| POST | `/api/finance/expenses/<id>/mark-paid/` | Paid → auto-posts JE |
| GET/POST | `/api/finance/budgets/` | Department budgets |
| GET | `/api/finance/budgets/utilization/` | Real-time utilization |
| GET/POST | `/api/finance/petty-cash/` | Petty cash funds |
| GET | `/api/finance/summary/` | Finance KPIs |
| GET/POST | `/api/finance/accounts/` | Chart of Accounts |
| POST | `/api/finance/accounts/seed/` | Seed standard COA |
| GET/POST | `/api/finance/journal/` | Journal entries |
| POST | `/api/finance/journal/<id>/post_entry/` | Post draft |
| POST | `/api/finance/journal/<id>/reverse/` | Reverse posted entry |
| GET | `/api/finance/trial-balance/` | Trial balance |
| GET | `/api/finance/income-statement/` | P&L |
| GET | `/api/finance/balance-sheet/` | Balance sheet |
| GET | `/api/finance/general-ledger/` | Ledger |

### Reports & Settings
| Method | Path | Description |
|---|---|---|
| POST | `/api/reports/` | CSV export builder |
| GET | `/api/reports/p9/` | KRA P9 Annual |
| GET | `/api/reports/p10/` | KRA P10 Monthly |
| GET | `/api/reports/nssf/` | NSSF schedule (NSSF number + National ID columns) |
| GET | `/api/reports/shif/` | SHIF + AHL schedule |
| GET | `/api/dashboard/stats/` | KPIs |
| GET | `/api/audit-trail/` | Audit log (ADMIN only) |
| GET/PATCH | `/api/settings/payroll/` | NSSF act + all statutory rates |

---

## Frontend Pages & Dashboards

| Route | Role | Description |
|---|---|---|
| `/` | Public | Marketing landing page |
| `/pricing` | Public | Pricing with monthly/annual toggle |
| `/auth/login` | Public | Login with toast errors + Clerk SignIn |
| `/auth/register` | Public | New company registration |
| `/auth/accept-invite` | Public | Sign-out existing session → redirect to login |
| `/dashboard` | ADMIN | CEO Dashboard (HR + Finance combined) |
| `/hr` | ADMIN, HR | HR Dashboard |
| `/finance` | ADMIN, FINANCE | Finance Dashboard |
| `/employee` | EMPLOYEE | Self-service dashboard |
| `/employees` | ADMIN, HR | Directory + CSV import |
| `/attendance` | All | Clock in/out, presence matrix |
| `/leave` | All | Leave requests + approvals |
| `/payroll` | ADMIN, HR | Payroll runs with reversal button |
| `/reports` | ADMIN, HR | CSV + statutory exports |
| `/finance/expenses` | All | Expense claims |
| `/finance/budgets` | ADMIN, FINANCE | Budgets + utilization |
| `/finance/petty-cash` | ADMIN, FINANCE | Petty cash funds |
| `/finance/books/accounts` | ADMIN, FINANCE, HR | Chart of Accounts |
| `/finance/books/journal` | ADMIN, FINANCE | Journal entries |
| `/finance/books/reports` | ADMIN, FINANCE, HR | P&L, Balance Sheet, Trial Balance |
| `/manager/self-service` | All | Payslip download + leave requests |
| `/notifications` | All | Inbox |
| `/audit` | ADMIN | Audit trail |
| `/settings` | All | Profile, company, payroll config (NSSF toggle), team, security |
| `/settings/billing` | ADMIN | Subscription + M-Pesa upgrade |

---

## Subscription Plans & Billing

| Plan | Employees | Monthly | Annual (10 months) |
|---|---|---|---|
| Starter | 1–15 | KES 3,500 | KES 35,000 |
| Growth | 16–75 | KES 12,000 | KES 120,000 |
| Business | 76–300 | KES 35,000 | KES 350,000 |
| Enterprise | Unlimited | Contact | Contact |

- 14-day free trial on registration
- Trial expiry banner shown at ≤7 days
- Upgrades via M-Pesa STK Push

---

## Deployment

### Local Development
```bash
# Terminal 1
cd backend && . .venv/bin/activate && python manage.py runserver

# Terminal 2
cd frontend && npm run dev
```

### Production Stack (Railway + Vercel)
| Service | Platform |
|---|---|
| Frontend | Vercel |
| Backend + Celery | Railway |
| Redis | Railway Redis service |
| Database | Supabase (primary + backup) |
| Email | Resend |

### Production Checklist
- [ ] Generate fresh `MASTER_ENCRYPTION_KEY` for production
- [ ] Set `DJANGO_DEBUG=False` and `DJANGO_SECURE_SSL=True`
- [ ] Set up Clerk production instance (requires `.com` / `.co.ke` domain)
- [ ] Register Clerk webhook → `https://api.workwise.co.ke/api/webhooks/clerk/`
- [ ] Switch M-Pesa to production (`MPESA_ENVIRONMENT=production`)
- [ ] Configure `AWS_PAYSLIPS_BUCKET` for S3 payslip storage (optional)
- [ ] Set custom domain in Railway + Vercel

---

## What Remains (Credentials Only)

All coding is complete. Only external service credentials are needed:

| Item | What you need to do |
|---|---|
| **Domain** | Buy `workwise.co.ke` (~KES 1,500/year). Required for Clerk production + M-Pesa callbacks |
| **Clerk production** | Create production instance at clerk.com using your domain. Swap `pk_test_` → `pk_live_` |
| **M-Pesa go-live** | Apply at developer.safaricom.co.ke. Swap sandbox credentials for production |
| **AWS S3** | Create private bucket, add 3 AWS env vars. Falls back to on-the-fly PDF without it |
| **Production encryption key** | `python -c "import os,base64; print(base64.b64encode(os.urandom(32)).decode())"` |
