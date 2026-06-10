# WorkWise SaaS — Complete Technical Documentation

> **WorkWise** is a Kenya-focused, multi-tenant HR & Payroll SaaS platform.  
> It manages employees, attendance, leave, KRA-compliant payroll, M-Pesa salary disbursements, bank exports, and payslip generation — all secured behind Clerk authentication and AES-256-GCM field-level encryption.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Directory Structure](#4-directory-structure)
5. [Database & Data Models](#5-database--data-models)
6. [Multi-Tenancy Design](#6-multi-tenancy-design)
7. [Authentication & Authorization](#7-authentication--authorization)
8. [Security Architecture](#8-security-architecture)
9. [Payroll Engine](#9-payroll-engine)
10. [M-Pesa Integration](#10-m-pesa-integration)
11. [REST API Reference](#11-rest-api-reference)
12. [Frontend — Page Map & Components](#12-frontend--page-map--components)
13. [Audit Log System](#13-audit-log-system)
14. [Environment Configuration](#14-environment-configuration)
15. [Testing Strategy](#15-testing-strategy)
16. [Subscription Plans](#16-subscription-plans)

---

## 1. Project Overview

WorkWise is a B2B SaaS application where each **company (tenant)** gets a fully isolated workspace. The platform handles:

| Domain | Features |
|---|---|
| **Employee Management** | CRUD, departments, encrypted KRA PIN & bank details, M-Pesa number |
| **Attendance** | Manual entry, clock-in/out, GPS location, bulk CSV upload, presence matrix |
| **Leave** | 5 leave types, approval workflow, quota enforcement, annual/sick/maternity/paternity/unpaid |
| **Payroll** | KRA-compliant statutory deductions (NSSF, SHIF, AHL, PAYE), multi-type salaries, payslip PDFs |
| **Disbursement** | M-Pesa B2C bulk salary payments via Safaricom Daraja, bank CSV export (Equity/KCB/Coop/Stanbic) |
| **Reports** | Payroll trends, department cost breakdown, statutory compliance reports |
| **Audit Trail** | Cryptographically immutable append-only log with HMAC-SHA256 integrity seals |

---

## 2. System Architecture

### High-Level System Diagram

```mermaid
graph TB
    subgraph "Client Layer"
        Browser["Browser / Next.js App\n(Port 3000)"]
    end

    subgraph "Auth Provider"
        Clerk["Clerk Auth\n(clerk.com)"]
    end

    subgraph "Backend — Django REST Framework\n(Port 8000)"
        API["REST API\n/api/..."]
        Auth["ClerkAuthentication\n(JWT RS256 + JWKS)"]
        Middleware["TenantContext\nMiddleware"]
        subgraph "Django Apps"
            UsersApp["users"]
            TenantsApp["tenants"]
            EmployeesApp["employees"]
            AttendanceApp["attendance"]
            LeaveApp["leave"]
            PayrollApp["payroll"]
            PayslipsApp["payslips"]
            ReportsApp["reports"]
            CoreApp["core\n(audit, encryption,\ntenant isolation)"]
        end
    end

    subgraph "Data Layer"
        Postgres["Supabase PostgreSQL\n(Pooler Port 6543)"]
    end

    subgraph "External Services"
        Safaricom["Safaricom Daraja API\nB2C Payments"]
        Ngrok["ngrok Tunnel\n(Callbacks)"]
    end

    Browser -->|"HTTPS + Clerk JWT"| API
    Browser <-->|"Auth / Session"| Clerk
    Clerk -->|"Webhook (user sync)"| API
    API --> Auth
    Auth --> Middleware
    Middleware --> Django Apps
    Django Apps --> Postgres
    PayrollApp -->|"B2C Payment Request"| Safaricom
    Safaricom -->|"Result/Timeout Callback"| Ngrok
    Ngrok -->|"Forwards to"| API
```

### Request Lifecycle

```mermaid
sequenceDiagram
    participant FE as Next.js Frontend
    participant Clerk as Clerk Auth
    participant BE as Django Backend
    participant DB as PostgreSQL

    FE->>Clerk: getToken() — Clerk Session
    Clerk-->>FE: Signed RS256 JWT
    FE->>BE: API Request + Bearer JWT
    BE->>BE: ClerkAuthentication.authenticate()
    BE->>Clerk: Fetch JWKS (cached 1hr)
    Clerk-->>BE: Public Keys
    BE->>BE: Verify RS256 signature
    BE->>DB: Lookup User by clerk_id
    DB-->>BE: User + Tenant
    BE->>BE: set_current_tenant(tenant)
    BE->>DB: TenantManager auto-filters all queries
    DB-->>BE: Tenant-scoped data
    BE-->>FE: JSON Response
    BE->>DB: AuditLog.save() (append-only)
```

---

## 3. Technology Stack

### Backend

| Category | Technology | Version |
|---|---|---|
| Framework | Django | ≥ 6.0 |
| API | Django REST Framework | ≥ 3.15 |
| Auth | Clerk (RS256 JWT) + `python-jose` | ≥ 3.5 |
| Database | PostgreSQL (Supabase) + psycopg2 | ≥ 2.9 |
| Connection Pooling | pgBouncer (transaction mode) via Supabase | — |
| Encryption | AES-256-GCM via `cryptography` | — |
| PDF Generation | ReportLab | ≥ 4.0 |
| Task Queue | Celery + Redis | ≥ 5.3 |
| Webhook Verification | Svix | ≥ 1.95 |
| Rate Limiting | django-ratelimit | ≥ 4.1 |
| HTTP Client | requests | ≥ 2.31 |

### Frontend

| Category | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Vanilla CSS + CSS variables |
| Auth | `@clerk/nextjs` |
| HTTP Client | axios (with Clerk token interceptor) |
| State | React `useState` / `useEffect` |
| Typography | Google Fonts — Outfit, Inter |

### Infrastructure

| Service | Purpose |
|---|---|
| Supabase | PostgreSQL database (EU Central, pooler) |
| Clerk | Identity & user management |
| Safaricom Daraja | M-Pesa B2C salary payments |
| ngrok | HTTPS tunnel for Daraja callbacks (dev) |

---

## 4. Directory Structure

```
WorkWise SaaS/
├── backend/                        # Django REST API
│   ├── config/
│   │   ├── settings.py             # Central settings (DB, Auth, MPESA, etc.)
│   │   └── urls.py                 # Root URL router
│   ├── core/                       # Shared infrastructure
│   │   ├── authentication.py       # Clerk JWT authentication backend
│   │   ├── encryption.py           # AES-256-GCM field-level encryption
│   │   ├── audit.py                # Immutable audit log model
│   │   ├── audit_signals.py        # Django signals → audit entries
│   │   ├── middleware.py           # Tenant context middleware
│   │   ├── tenant_context.py       # Thread-local tenant store
│   │   ├── tenant_models.py        # TenantScopedModel + TenantManager
│   │   └── views.py                # Dashboard stats, audit trail API
│   ├── tenants/                    # Company (tenant) model
│   │   ├── models.py               # Tenant, plan limits
│   │   └── views.py                # Company settings, payroll config, plan upgrade
│   ├── users/                      # User accounts
│   │   ├── models.py               # Custom User + clerk_id
│   │   └── views.py                # Register, login, profile, Clerk webhook
│   ├── employees/                  # Employee management
│   │   ├── models.py               # Employee (encrypted KRA PIN, bank details)
│   │   └── views.py                # CRUD, bulk CSV import
│   ├── attendance/                 # Attendance tracking
│   │   ├── models.py               # Attendance record (clock-in/out, GPS)
│   │   └── views.py                # Clock-in/out, presence matrix, stats, bulk upload
│   ├── leave/                      # Leave management
│   │   ├── models.py               # Leave request (type, status, dates)
│   │   └── views.py                # CRUD, approve/reject, quota enforcement
│   ├── payroll/                    # Payroll processing
│   │   ├── models.py               # PayrollRun, PayrollItem, PayrollConfig, MpesaTransaction
│   │   ├── engine.py               # Gross/net salary computation
│   │   ├── statutory/              # KRA statutory deduction calculators
│   │   │   ├── engines.py          # KenyaStatutoryEngine coordinator
│   │   │   ├── nssf.py             # NSSF Tier 1 & 2 (Act No. 45 of 2013)
│   │   │   ├── shif.py             # SHIF @ 2.75% (Health Insurance)
│   │   │   ├── housing_levy.py     # AHL @ 1.5% (Affordable Housing)
│   │   │   └── paye.py             # PAYE progressive bands (KRA)
│   │   ├── mpesa.py                # Daraja B2C client + simulation mode
│   │   ├── mpesa_views.py          # Safaricom callback handlers
│   │   ├── b2c_sandbox.py          # Sandbox credential helper (RSA encrypt)
│   │   └── views.py                # Payroll run lifecycle + bank export
│   ├── payslips/                   # PDF payslip generation
│   │   └── views.py                # ReportLab PDF download endpoint
│   ├── reports/                    # Reporting
│   │   └── views.py                # Analytics endpoints
│   └── requirements.txt
│
└── frontend/                       # Next.js App Router
    └── src/
        ├── app/
        │   ├── page.tsx            # Landing / marketing page
        │   ├── auth/               # Sign-in / Sign-up (Clerk UI)
        │   ├── manager/            # Dashboard (home)
        │   ├── employees/          # Employee list + detail pages
        │   ├── attendance/         # Attendance page
        │   ├── leave/              # Leave management page
        │   ├── payroll/            # Payroll page
        │   ├── reports/            # Reports page
        │   ├── settings/           # Company & payroll config settings
        │   ├── audit/              # Audit trail page
        │   └── pricing/            # Subscription pricing page
        ├── components/
        │   ├── layout/             # Sidebar, header navigation
        │   ├── premium/            # Feature modals & charts
        │   │   ├── AddEmployeeModal.tsx
        │   │   ├── EditEmployeeModal.tsx
        │   │   ├── AddAttendanceModal.tsx
        │   │   ├── AddLeaveModal.tsx
        │   │   ├── AddPayrollRunModal.tsx
        │   │   ├── MpesaDisbursementModal.tsx
        │   │   ├── BankExportModal.tsx
        │   │   └── CustomCharts.tsx
        │   └── ui/                 # Base UI primitives
        └── lib/
            ├── api.ts              # Axios client (Clerk token interceptor)
            ├── types.ts            # TypeScript interfaces
            ├── store.ts            # Auth store (user context)
            └── format.ts           # Currency / date formatters
```

---

## 5. Database & Data Models

### Entity-Relationship Diagram

```mermaid
erDiagram
    Tenant {
        uuid id PK
        string name
        string country
        string currency
        string plan
        string subscription_status
        int max_employees
        datetime trial_ends_at
        string kra_pin
        string address
        string phone
    }

    User {
        uuid id PK
        string email
        string clerk_id
        string first_name
        string last_name
        string role
        uuid tenant_id FK
    }

    Employee {
        uuid id PK
        uuid tenant_id FK
        string name
        string email
        string phone
        string department
        string job_title
        encrypted kra_pin
        string employment_type
        decimal salary_basic
        json allowances
        string payment_method
        encrypted mpesa_number
        encrypted_json bank_details
        string status
        date hire_date
        date termination_date
    }

    Attendance {
        uuid id PK
        uuid employee_id FK
        date date
        time clock_in
        time clock_out
        decimal hours_worked
        decimal overtime_hours
        string location
        decimal latitude
        decimal longitude
    }

    Leave {
        uuid id PK
        uuid employee_id FK
        string leave_type
        date start_date
        date end_date
        string status
        string reason
    }

    PayrollRun {
        uuid id PK
        uuid tenant_id FK
        int month
        int year
        string status
        datetime created_at
    }

    PayrollItem {
        uuid id PK
        uuid payroll_run_id FK
        uuid employee_id FK
        decimal gross_salary
        decimal nssf
        decimal shif
        decimal ahl
        decimal paye
        decimal net_pay
    }

    PayrollConfig {
        uuid tenant_id FK
        decimal nssf_rate
        decimal nssf_cap
        decimal shif_rate
        decimal shif_min
        decimal ahl_rate
        decimal personal_relief
        json paye_bands
    }

    MpesaTransaction {
        uuid id PK
        uuid payroll_run_id FK
        uuid employee_id FK
        string phone_number
        decimal amount
        string status
        string conversation_id
        string originator_conversation_id
        string result_code
        string result_desc
    }

    AuditLog {
        uuid id PK
        uuid tenant_id FK
        string actor_id
        string actor_email
        string action
        string resource_type
        string resource_id
        string ip_address
        json payload
        string payload_hash
        string integrity_seal
        datetime timestamp
    }

    Tenant ||--o{ User : "has"
    Tenant ||--o{ Employee : "has"
    Tenant ||--|| PayrollConfig : "has"
    Tenant ||--o{ PayrollRun : "has"
    Tenant ||--o{ AuditLog : "logs"
    Employee ||--o{ Attendance : "logs"
    Employee ||--o{ Leave : "requests"
    Employee ||--o{ PayrollItem : "has"
    Employee ||--o{ MpesaTransaction : "receives"
    PayrollRun ||--o{ PayrollItem : "contains"
    PayrollRun ||--o{ MpesaTransaction : "has"
```

### Model Notes

| Model | Key Design Decisions |
|---|---|
| `Employee` | `kra_pin`, `mpesa_number`, and `bank_details` are AES-256-GCM encrypted at the field level; they read/write transparently in Python but store ciphertext in DB |
| `PayrollRun` | Unique per `(tenant, month, year)` — one run per period per company |
| `Attendance` | Unique per `(employee, date)` — prevents duplicate clock-in records |
| `MpesaTransaction` | Not tenant-scoped (uses employee FK for isolation); carries Daraja `ConversationID` for async callback matching |
| `AuditLog` | Append-only — `save()` raises if `pk` already exists; `delete()` always raises; backed by PostgreSQL trigger |

---

## 6. Multi-Tenancy Design

WorkWise uses a **shared database, shared schema** multi-tenancy model with automated row-level isolation via a custom Django Manager.

```mermaid
graph TD
    subgraph "Request comes in"
        R[HTTP Request + JWT]
    end

    subgraph "ClerkAuthentication"
        A1[Verify RS256 JWT]
        A2[Lookup User in DB]
        A3[set_current_tenant\nuser.tenant]
    end

    subgraph "Thread-Local Store"
        TL["_thread_local.current_tenant\n= Tenant object"]
    end

    subgraph "TenantManager.get_queryset()"
        M1{active_tenant\nset?}
        M2["qs.filter(tenant=active_tenant)"]
        M3[Unfiltered qs]
    end

    subgraph "Database"
        DB[(PostgreSQL\nAll tenant rows\nmixed together)]
    end

    R --> A1 --> A2 --> A3 --> TL
    TL --> M1
    M1 -->|Yes| M2 --> DB
    M1 -->|No| M3 --> DB
```

**Key components:**

- [`core/tenant_context.py`](file:///home/johnte/Desktop/WorkWise%20SaaS/backend/core/tenant_context.py) — Thread-local `set_current_tenant()` / `get_current_tenant()` / `clear_current_tenant()`
- [`core/tenant_models.py`](file:///home/johnte/Desktop/WorkWise%20SaaS/backend/core/tenant_models.py) — `TenantManager` overrides `get_queryset()` to inject `.filter(tenant=...)` on every ORM query
- [`TenantScopedModel`](file:///home/johnte/Desktop/WorkWise%20SaaS/backend/core/tenant_models.py) — Abstract base model; all tenant-owned models inherit from it
- `Employee.unscoped` / `Model.unscoped` — An explicit bypass manager for admin/system tasks that must query across tenants

**Isolation guarantee:** Any `Employee.objects.all()` call automatically returns only that tenant's employees — even if developers forget to filter manually.

---

## 7. Authentication & Authorization

### Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend as Next.js (Clerk SDK)
    participant Clerk as Clerk.com
    participant Backend as Django API

    User->>Frontend: Login
    Frontend->>Clerk: Redirect to Clerk Sign-In
    Clerk-->>Frontend: Session established
    Frontend->>Clerk: clerk.session.getToken()
    Clerk-->>Frontend: RS256 JWT (short-lived)
    Frontend->>Backend: Authorization: Bearer <jwt>
    Backend->>Backend: Decode header → kid
    Backend->>Clerk: GET {issuer}/.well-known/jwks.json (cached 1h)
    Clerk-->>Backend: JSON Web Key Set
    Backend->>Backend: Verify signature + expiry
    Backend->>Backend: Extract sub (Clerk user ID)
    Backend->>DB: User.objects.get(clerk_id=sub)
    Backend-->>Frontend: Authenticated response
```

### User Sync via Webhook

When a user is created or updated in Clerk, a webhook fires to `/api/webhooks/clerk/`. The backend verifies the Svix signature and creates/updates the local `User` record with the matching `clerk_id` and `tenant`.

### Roles

| Role | Description |
|---|---|
| `ADMIN` | Full access — company settings, payroll approval, all data |
| `HR` | Employee/attendance/leave management; no billing or plan changes |
| `EMPLOYEE` | View own profile, payslips, attendance (future scope) |

### JWKS Cache

The backend caches Clerk's public keys in-process for 1 hour (`_JWKS_CACHE_TTL = 3600`), reducing latency on every request. A stale cache is used as a fallback if Clerk is temporarily unreachable.

---

## 8. Security Architecture

### Layers of Security

```mermaid
graph TB
    L1["Layer 1: Transport\nHTTPS everywhere\nHSTS + XSS filter\nClickjacking protection (X-Frame-Options: DENY)"]
    L2["Layer 2: Authentication\nClerk RS256 JWT\nJWKS verification\nNo passwords stored"]
    L3["Layer 3: Multi-Tenant Isolation\nTenantManager auto-filter\nRow-level enforcement\nForeign key tenant_id"]
    L4["Layer 4: Field-Level Encryption\nAES-256-GCM\nKRA PIN, M-Pesa number, bank details\n12-byte random nonce per value"]
    L5["Layer 5: Audit Trail\nAppend-only AuditLog\nHMAC-SHA256 integrity seal\nPostgreSQL trigger blocks DELETE"]
    L6["Layer 6: Rate Limiting\ndjango-ratelimit on auth endpoints\n400/500 error swallowing in audit"]

    L1 --> L2 --> L3 --> L4 --> L5 --> L6
```

### AES-256-GCM Field Encryption

Sensitive fields use custom Django field types that encrypt/decrypt transparently:

```
Write path:  plaintext → json.dumps() → AES-256-GCM encrypt(nonce + ciphertext) → base64 → DB
Read path:   DB → base64 decode → split nonce(12B) + ciphertext → AES-256-GCM decrypt → plaintext
```

- **Algorithm:** AES-256-GCM (authenticated encryption — prevents tampering)
- **Key:** 32-byte random key, base64-encoded, stored in `MASTER_ENCRYPTION_KEY` env var
- **Nonce:** 12 bytes, generated fresh per write with `os.urandom(12)`
- **Legacy fallback:** Automatically detects and decrypts old Fernet-encrypted values (migration path)

**Encrypted fields:**
- `Employee.kra_pin` — Kenya Revenue Authority PIN
- `Employee.mpesa_number` — M-Pesa phone number
- `Employee.bank_details` — Bank name + account number (JSON)

---

## 9. Payroll Engine

### Calculation Flow

```mermaid
flowchart TD
    A([Start: Process Payroll Run]) --> B[For each employee in run]
    B --> C{Employment Type?}
    C -->|monthly| D["Salary = salary_basic"]
    C -->|daily| E["Salary = salary_basic × days_worked"]
    C -->|weekly| F["Salary = salary_basic × 4"]
    C -->|hourly| G["Salary = salary_basic × hours_worked"]
    D & E & F & G --> H["+ Sum allowances\n(house, transport, etc.)"]
    H --> I["+ Overtime pay\n(rate × 1.5 × overtime_hours)"]
    I --> J["− Unpaid leave deduction\n(base/30 × unpaid_days)"]
    J --> K["= Gross Salary"]

    K --> L["NSSF\nTier 1: 6% × min(gross, LEL=7,000) = max 420\nTier 2: 6% × min(gross−LEL, UEL−LEL=29,000) = max 1,740\nEmployee contribution capped at KES 2,160"]
    K --> M["SHIF\n2.75% × gross\n(min KES 300)"]
    K --> N["AHL — Affordable Housing Levy\n1.5% × gross\n(employee + employer each)"]
    L --> O["Taxable Income\n= Gross − NSSF"]
    O --> P["PAYE — Progressive KRA Bands\nFirst 24,000 @ 10%\nNext 8,333 @ 25%\nNext 467,667 @ 30%\nNext 300,000 @ 32.5%\nAbove 800,000 @ 35%\n− Personal Relief (KES 2,400)"]
    L & M & N & P --> Q["Total Deductions\n= NSSF + SHIF + AHL + PAYE"]
    Q --> R["Net Pay\n= Gross − Total Deductions"]
    R --> S([Save PayrollItem])
```

### Statutory Deduction Summary

| Deduction | Rate | Cap / Floor | Statutory Basis |
|---|---|---|---|
| **NSSF Tier 1** | 6% of gross (up to LEL KES 7,000) | Max KES 420 | NSSF Act No. 45 of 2013 |
| **NSSF Tier 2** | 6% of income between LEL and UEL (KES 36,000) | Max KES 1,740 | NSSF Act No. 45 of 2013 |
| **SHIF** | 2.75% of gross | Min KES 300 | Social Health Insurance Fund |
| **AHL** | 1.5% of gross (employee) + 1.5% (employer) | None | Affordable Housing Levy Act |
| **PAYE** | Progressive bands (10%–35%) | Personal relief KES 2,400 | KRA Income Tax Act |

### PayrollRun Status Lifecycle

```mermaid
stateDiagram-v2
    [*] --> draft : Create Run
    draft --> processed : POST /process/
    processed --> approved : POST /approve/
    approved --> paid : POST /mark-paid/
    approved --> paid : POST /disburse-mpesa/ (simulated)
    draft --> draft : Re-process blocked
    processed --> processed : Re-process blocked (400)
```

---

## 10. M-Pesa Integration

### Architecture

WorkWise integrates with **Safaricom Daraja B2C API** to send salaries directly to employees' M-Pesa wallets.

```mermaid
sequenceDiagram
    participant HR as HR Manager (Browser)
    participant FE as Next.js Frontend
    participant BE as Django Backend
    participant Daraja as Safaricom Daraja
    participant DB as PostgreSQL
    participant Ngrok as ngrok Tunnel

    HR->>FE: Click "Disburse via M-Pesa"
    FE->>BE: POST /api/payroll/{id}/disburse-mpesa/
    BE->>BE: Check: payroll_run.status == 'approved'
    BE->>BE: Filter: employees with payment_method='mpesa'

    alt MPESA_ENABLED=True (live mode)
        BE->>Daraja: POST /oauth/v1/generate (get token)
        Daraja-->>BE: access_token
        loop For each M-Pesa employee
            BE->>Daraja: POST /mpesa/b2c/v3/paymentrequest
            Daraja-->>BE: ConversationID + OriginatorConversationID
            BE->>DB: MpesaTransaction.create(status='pending')
        end
        Daraja->>Ngrok: POST /api/mpesa/b2c/result/ (async)
        Ngrok->>BE: Forward result callback
        BE->>DB: MpesaTransaction.status = 'success' or 'failed'
    else MPESA_ENABLED=False (simulation)
        loop For each M-Pesa employee
            BE->>BE: simulate_b2c_payment() → mock IDs
            BE->>DB: MpesaTransaction.create(status='success')
        end
    end

    FE->>BE: GET /api/payroll/{id}/mpesa-transactions/
    BE-->>FE: Transaction list + summary
    FE-->>HR: Show results table
```

### Callback Endpoints

| URL | Method | Purpose |
|---|---|---|
| `/api/mpesa/b2c/result/` | POST | Primary Daraja result — updates transaction to `success` or `failed` |
| `/api/mpesa/b2c/timeout/` | POST | Queue timeout — updates transaction to `timeout` |
| `/api/mpesa/b2c/callback/` | POST | Legacy combined callback (backward compatibility) |

### Phone Number Normalization

```
Input:  "0733987654"   → Normalized: "254733987654"
Input:  "+254733987654" → Normalized: "254733987654"
Input:  "254733987654"  → Unchanged:  "254733987654"
```

### M-Pesa Transaction Status States

```mermaid
stateDiagram-v2
    [*] --> pending : Daraja B2C request sent
    pending --> success : ResultCode=0 from Safaricom
    pending --> failed : ResultCode≠0 from Safaricom
    pending --> timeout : Queue timeout callback
    success --> [*]
    failed --> [*]
    timeout --> [*]
```

---

## 11. REST API Reference

### Base URL
```
http://localhost:8000/api        (development)
https://your-domain.com/api     (production)
```

### Authentication
All endpoints (except registration, login, and M-Pesa callbacks) require:
```
Authorization: Bearer <clerk-jwt-token>
```

---

### Auth Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/auth/register/` | Create company account (Tenant + User) |
| `POST` | `/auth/login/` | Get JWT access + refresh tokens |
| `POST` | `/auth/refresh/` | Refresh access token |
| `GET` | `/users/me/` | Get current user profile |

**Register request body:**
```json
{
  "company_name": "Acme Corp",
  "email": "admin@acme.com",
  "password": "SecurePass123!",
  "first_name": "Jane",
  "last_name": "Doe",
  "plan": "STARTER"
}
```

---

### Employee Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/employees/` | List all employees (tenant-scoped) |
| `POST` | `/employees/` | Create employee |
| `GET` | `/employees/{id}/` | Get employee detail |
| `PATCH` | `/employees/{id}/` | Update employee fields |
| `DELETE` | `/employees/{id}/` | Soft-delete employee |
| `POST` | `/employees/bulk-import/` | Import employees from CSV |

**Employee fields:**
```json
{
  "name": "John Kamau",
  "email": "john@acme.com",
  "phone": "0712345678",
  "department": "Engineering",
  "job_title": "Software Engineer",
  "kra_pin": "A012345678Z",
  "employment_type": "monthly",
  "salary_basic": "85000",
  "allowances": {"house": 10000, "transport": 5000},
  "payment_method": "mpesa",
  "mpesa_number": "0712345678",
  "status": "active"
}
```

---

### Attendance Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/attendance/` | List attendance records |
| `POST` | `/attendance/` | Create manual attendance entry |
| `POST` | `/attendance/clock-in/` | Clock employee in (with optional GPS) |
| `POST` | `/attendance/clock-out/` | Clock employee out |
| `GET` | `/attendance/presence-matrix/` | Daily presence grid for all employees |
| `GET` | `/attendance/stats/` | Monthly attendance statistics |
| `POST` | `/attendance/upload-bulk/` | Bulk CSV upload |

---

### Leave Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/leave/` | List all leave requests |
| `POST` | `/leave/` | Submit leave request |
| `PATCH` | `/leave/{id}/` | Update leave request |
| `POST` | `/leave/{id}/approve/` | Approve leave |
| `POST` | `/leave/{id}/reject/` | Reject leave |
| `GET` | `/leave/stats/` | Leave statistics + policy limits |

**Leave types:** `annual` · `sick` · `maternity` · `paternity` · `unpaid`

**Leave quota enforcement:** Approving a leave request that exceeds the employee's annual quota returns `HTTP 400`.

---

### Payroll Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/payroll/` | List payroll runs |
| `POST` | `/payroll/` | Create new payroll run |
| `GET` | `/payroll/{id}/` | Get run details with items |
| `POST` | `/payroll/{id}/process/` | Calculate all employee payslips |
| `POST` | `/payroll/{id}/approve/` | Approve payroll run |
| `POST` | `/payroll/{id}/mark-paid/` | Mark payroll as paid |
| `POST` | `/payroll/{id}/disburse-mpesa/` | Trigger M-Pesa bulk disbursement |
| `GET` | `/payroll/{id}/mpesa-transactions/` | Get M-Pesa transaction statuses |
| `GET` | `/payroll/{id}/bank-export/` | Download bank payment CSV |
| `POST` | `/payroll/{id}/send-payslips/` | Email payslips to all employees |
| `GET` | `/payroll/summary/` | Current month payroll summary |

**Bank export query param:** `?bank=equity|kcb|coop|stanbic` (default: `equity`)

---

### Payslip Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/payslips/{id}/download/` | Download PDF payslip for a PayrollItem |

---

### Dashboard & Settings

| Method | Path | Description |
|---|---|---|
| `GET` | `/dashboard/stats/` | Aggregated stats, trends, department costs |
| `GET` | `/settings/company/` | Get company settings |
| `PATCH` | `/settings/company/` | Update company settings |
| `POST` | `/settings/company/upgrade-plan/` | Change subscription plan |
| `GET` | `/settings/payroll/` | Get payroll configuration |
| `PATCH` | `/settings/payroll/` | Update NSSF/SHIF/PAYE/AHL rates |
| `GET` | `/audit-trail/` | Paginated audit log |

---

### M-Pesa Callback Endpoints (Safaricom → Server)

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/mpesa/b2c/result/` | None (Safaricom) | B2C payment result |
| `POST` | `/api/mpesa/b2c/timeout/` | None (Safaricom) | Queue timeout |
| `POST` | `/api/mpesa/b2c/callback/` | None (Safaricom) | Legacy callback |

---

## 12. Frontend — Page Map & Components

### Pages

| Route | Component | Description |
|---|---|---|
| `/` | `app/page.tsx` | Marketing landing page |
| `/auth/sign-in` | Clerk UI | Sign-in (hosted by Clerk) |
| `/auth/sign-up` | Clerk UI | Sign-up (hosted by Clerk) |
| `/manager` | Dashboard page | Stats, trends, recent activity |
| `/employees` | Employee list | Table of all employees |
| `/employees/[id]` | Employee detail | Profile, payroll history, M-Pesa info |
| `/attendance` | Attendance page | Presence matrix, clock-in/out, stats |
| `/leave` | Leave page | Leave requests, approval workflow |
| `/payroll` | Payroll page | Run management, M-Pesa disburse, bank export |
| `/reports` | Reports page | Analytics, compliance, trends |
| `/settings` | Settings page | Company info, payroll config |
| `/audit` | Audit trail page | Immutable audit log viewer |
| `/pricing` | Pricing page | Subscription plan comparison |

### Key Modal Components

| Component | Triggers When |
|---|---|
| `AddEmployeeModal` | "Add Employee" button on `/employees` |
| `EditEmployeeModal` | "Edit" on employee detail page |
| `AddAttendanceModal` | "Log Attendance" on `/attendance` |
| `AddLeaveModal` | "Request Leave" on `/leave` |
| `AddPayrollRunModal` | "New Payroll Run" on `/payroll` |
| `MpesaDisbursementModal` | "Disburse via M-Pesa" on approved payroll run |
| `BankExportModal` | "Bank Export" on approved payroll run |

### API Client Pattern

All pages use the shared `api` axios instance from [`lib/api.ts`](file:///home/johnte/Desktop/WorkWise%20SaaS/frontend/src/lib/api.ts). Clerk JWT tokens are injected automatically via a request interceptor:

```typescript
// Configured once in ClerkTokenProvider.tsx
setTokenGetter(() => clerk.session?.getToken());

// All subsequent calls get Bearer token automatically
const response = await api.get<Employee[]>('/employees/');
```

---

## 13. Audit Log System

Every significant action produces an `AuditLog` entry. The log is cryptographically tamper-evident.

### Audited Actions

| Action | Trigger |
|---|---|
| `CREATE` | New employee, leave request, payroll run |
| `UPDATE` | Employee edit, payroll config change |
| `DELETE` | Employee deactivation |
| `LOGIN` | Successful authentication |
| `PAYROLL_RUN` | Payroll processing |
| `PAYROLL_APPROVE` | Payroll approval |
| `EXPORT` | Bank CSV export or payslip download |
| `WEBHOOK` | Clerk webhook received |
| `PERMISSION_CHANGE` | Role change |

### Integrity Seal

Each row carries an `integrity_seal` — HMAC-SHA256 over the canonical fields, keyed with `MASTER_ENCRYPTION_KEY`:

```
HMAC-SHA256(key, tenant_id|actor_id|actor_email|action|resource_type|resource_id|ip_address|payload_hash|timestamp)
```

To verify an exported audit row:
```python
assert audit_log.verify_seal() == True
```

### Immutability Enforcement

1. **ORM level:** `AppendOnlyManager.update()` and `.delete()` raise `PermissionError`
2. **Instance level:** `AuditLog.save()` raises if `self.pk` already exists (no updates)
3. **Instance level:** `AuditLog.delete()` always raises `PermissionError`
4. **DB level:** A PostgreSQL trigger blocks `UPDATE` and `DELETE` at the SQL layer

---

## 14. Environment Configuration

All configuration lives in `backend/.env`:

```bash
# ── Django Core ───────────────────────────────────────────────
DJANGO_SECRET_KEY=<long-random-string>
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,your-domain.com
CORS_ALLOWED_ORIGINS=http://localhost:3000,https://your-domain.com
DJANGO_SECURE_SSL=False   # Set True behind TLS proxy in production

# ── Clerk Auth ────────────────────────────────────────────────
CLERK_SECRET_KEY=sk_live_...
CLERK_WEBHOOK_SECRET=whsec_...

# ── Encryption ────────────────────────────────────────────────
# Generate: python -c "import os,base64; print(base64.b64encode(os.urandom(32)).decode())"
MASTER_ENCRYPTION_KEY=<32-byte-base64>

# ── Database ──────────────────────────────────────────────────
DATABASE_URL=postgresql://user:pass@host:6543/postgres?sslmode=require
# Alternatively use individual vars:
DB_HOST=aws-1-eu-central-1.pooler.supabase.com
DB_PORT=6543
DB_NAME=postgres
DB_USER=postgres.<project-ref>
DB_PASSWORD=<password>
DB_SSLMODE=require
DB_DISABLE_SERVER_SIDE_CURSORS=True   # Required for pgBouncer

# ── M-Pesa Daraja ─────────────────────────────────────────────
MPESA_ENABLED=True           # False = simulation mode (no real API calls)
MPESA_ENVIRONMENT=sandbox    # or: production
MPESA_CONSUMER_KEY=...
MPESA_CONSUMER_SECRET=...
MPESA_INITIATOR_NAME=testapi
MPESA_INITIATOR_PASSWORD=...
MPESA_B2C_SHORTCODE=600000
MPESA_B2C_RESULT_URL=https://your-ngrok.ngrok-free.app/api/mpesa/b2c/result/
MPESA_B2C_TIMEOUT_URL=https://your-ngrok.ngrok-free.app/api/mpesa/b2c/timeout/
MPESA_SECURITY_CREDENTIAL=<RSA-encrypted-base64>
```

### Frontend Environment

```bash
# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000/api
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

### Running Locally

```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev    # starts on http://localhost:3000
```

---

## 15. Testing Strategy

### Unit Tests — Statutory Calculations

Located in [`payroll/tests_statutory.py`](file:///home/johnte/Desktop/WorkWise%20SaaS/backend/payroll/tests_statutory.py). Runs 8 tests covering:

| Test | Verifies |
|---|---|
| `test_nssf_calculation_below_lel` | NSSF = 6% of gross when gross < LEL (KES 7,000) |
| `test_nssf_calculation_between_lel_and_uel` | Tier 1 capped at KES 420, Tier 2 = 6% of remainder |
| `test_nssf_calculation_above_uel` | Both tiers fully capped at KES 2,160 total |
| `test_shif_calculation` | 2.75% of gross at different income levels |
| `test_housing_levy_calculation` | 1.5% for employee and employer each |
| `test_paye_calculation_low_income` | Net PAYE = 0 for income < personal relief |
| `test_paye_calculation_standard_income` | Full progressive band calculation for KES 100k |
| `test_consolidated_payslip_calculation` | Complete KenyaStatutoryEngine output for KES 100k |

```bash
# Run with SQLite (fast, no DB needed)
DATABASE_URL="" DB_HOST="" python manage.py test
```

### End-to-End API Tests

Located in [`test_e2e.py`](file:///home/johnte/Desktop/WorkWise%20SaaS/backend/test_e2e.py). **74 assertions** covering the full user journey:

| Section | Tests |
|---|---|
| Registration & Login | Token issuance, profile endpoint |
| Employee Management | CRUD, M-Pesa employee creation |
| Attendance | Manual entry, clock-in/out, presence matrix, bulk CSV |
| Leave | Create, approve, reject, quota enforcement |
| Payroll | Run creation, processing, statutory breakdown verification |
| Payslip | PDF download and content check |
| Dashboard & Settings | Stats, company config, payroll config |
| Edge Cases | Duplicate clock-in, unauthenticated access, 404s |

```bash
# Requires Django runserver running on port 8000
python test_e2e.py
# Expected: Passed: 74 / Failed: 0 / Pass rate: 100%
```

### Security Sandbox Test

Located in [`test_sandbox.py`](file:///home/johnte/Desktop/WorkWise%20SaaS/backend/test_sandbox.py). Verifies:

1. `TenantManager` auto-isolation — Tenant A can't see Tenant B's employees
2. AES-256-GCM transparent encryption — KRA PIN decrypts in Python but is ciphertext in DB

```bash
python test_sandbox.py
```

---

## 16. Subscription Plans

| Plan | Max Employees | Target |
|---|---|---|
| **Starter** | 15 | Small businesses |
| **Growth** | 75 | Growing companies |
| **Business** | 300 | Mid-size enterprises |
| **Enterprise** | Unlimited | Large corporations |

All new tenants start on a **14-day free trial** (`subscription_status=TRIAL`). Plan upgrades are handled via `POST /api/settings/company/upgrade-plan/`.

---

*Last updated: June 2026 · WorkWise SaaS v1.0*
