# WorkWise SaaS — Premium HR & Payroll Platform for Kenya

WorkWise is a professional, multi-tenant HR & Payroll management platform tailored for the Kenyan market (compliant with KRA progressive PAYE, NSSF, SHIF, and Affordable Housing Levy statutory deductions).

---

## 🚀 Key Modules & Design Changes

### 1. Custom Onboarding & Registration
We replaced the default Clerk registration modal with a custom, high-end multi-step wizard:
- **Step 1 — Plan Selection**: Choose between **Starter**, **Growth**, **Business**, or **Enterprise** plans, each with designated pricing in KES and employee seat limits.
- **Step 2 — Account Setup**: Prompts for organization name, administrator name, work email, and password.
- **Data Transfer via Clerk Metadata**: Uses Clerk's `unsafeMetadata` to pass the chosen `plan` and `companyName` payload to Clerk.
- **Statutory Webhook Orchestration**: When a user registers, Clerk fires a webhook to Django backend (`/api/webhooks/clerk/`). The backend extracts the plan and company name, provisions a isolated `Tenant` workspace on that subscription level, and configures default payroll settings.

### 2. High-Performance Indexing
Added database indexing to guarantee sub-millisecond query responses under scale as organizations grow:
- **Employees**: Indexed by `(tenant, status)`, `(tenant, department)`, and `(tenant, created_at)` for instant directory listings.
- **Attendance**: Indexed by `(employee, date)` and `(date)` to streamline clock-in/out records.
- **Leave Requests**: Indexed by `(employee, status)`, `(employee, start_date)`, and `(start_date, end_date)`.
- **Payroll**: Indexed by `(tenant, status)`, `(tenant, year, month)`, and `(payroll_run, employee)`.

---

## 🛠️ Local Development & Webhook Setup

### Prerequisites
1. **Python 3.12+**
2. **Node.js 20+**
3. A **Clerk Account** (with webhook routing enabled)

### 1. Backend Setup
1. Navigate to `/backend`:
   ```bash
   cd backend
   ```
2. Activate the virtual environment:
   ```bash
   source venv/bin/activate
   ```
3. Run migrations (applies all schema changes and new database indexes):
   ```bash
   python manage.py migrate
   ```
4. Start the Django API server:
   ```bash
   python manage.py runserver
   ```
   The API will start at `http://127.0.0.1:8000`.

### 2. Frontend Setup
1. Navigate to `/frontend`:
   ```bash
   cd ../frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the Next.js development server:
   ```bash
   npm run dev
   ```
   The frontend will start at `http://localhost:3000`.

### 3. Connecting Clerk Webhooks Locally
Because Clerk operates in the cloud, it needs to reach your local API endpoint (`http://localhost:8000/api/webhooks/clerk/`).
1. **Expose your local port**: Use a tool like **ngrok** to tunnel traffic:
   ```bash
   ngrok http 8000
   ```
2. **Configure Clerk Dashboard**:
   - In the Clerk dashboard, navigate to **Webhooks**.
   - Create a webhook endpoint pointing to your ngrok HTTPS URL: `https://<your-ngrok-subdomain>.ngrok-free.app/api/webhooks/clerk/`.
   - Subscribe to the `user.created` and `user.deleted` events.
3. **Configure Environment Variables**:
   - Copy the webhook signing secret from the Clerk dashboard and set it as `CLERK_WEBHOOK_SECRET` in `backend/.env`.
