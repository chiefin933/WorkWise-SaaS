# WorkWise HR SaaS - Project Overview

WorkWise is a premium, multi-tenant HR and Payroll management platform designed specifically for the Kenyan market. It combines a sophisticated backend with a high-end, responsive frontend.

## 🚀 Technology Stack

### Backend
- **Framework**: Django 5.x + Django REST Framework (DRF)
- **Database**: SQLite (Development) / PostgreSQL (Production ready)
- **Authentication**: JWT (JSON Web Tokens) with tenant-scoped access.
- **Key Libraries**: `djangorestframework-simplejwt`, `django-cors-headers`.

### Frontend
- **Framework**: Next.js 14+ (App Router)
- **Styling**: Tailwind CSS with custom Design Tokens.
- **Animations**: Framer Motion for premium micro-interactions.
- **Icons**: Lucide React.
- **Components**: Custom Glassmorphic design system + Shadcn UI.

---

## 🛠️ Core Modules & Features

### 1. Multi-Tenancy & Auth
- **Organization Isolation**: Every user belongs to a Tenant (Organization). Data is strictly scoped so users only see their own company's data.
- **Registration**: Integrated flow for creating a new company profile and an admin user in one step.

### 2. Employee Management
- Complete CRUD for employee profiles.
- Supports **Monthly, Weekly, Daily, and Hourly** employment types.
- **Compensation**: Tracking of basic salary and customizable JSON-based allowances (e.g., House, Transport).
- **Lifecycle Tracking**: Hire and termination dates for turnover analytics.

### 3. Kenyan Payroll Engine
- **Automated Processing**: Calculates net pay based on Kenyan statutory laws.
- **Statutory Deductions**:
    - **PAYE**: Progressive tax bands.
    - **NSSF**: Tiered contributions.
    - **SHIF**: Social Health Insurance Fund (2.75%).
    - **AHL**: Affordable Housing Levy (1.5%).
- **Payroll Runs**: Monthly batch processing with status tracking (Draft -> Processed -> Paid).

### 4. Attendance & Workforce Tracking
- **Time Tracking**: Clock-in and clock-out logging.
- **Hours Calculation**: Automatic calculation of regular and overtime hours.
- **Visual Matrix**: Dashboard view of daily workforce presence.

### 5. Leave Management
- **Workflows**: Application and approval system for various leave types (Annual, Sick, Maternity, etc.).
- **Balance Tracking**: Monitors leave utilization per employee.

### 6. Analytics & Reports
- **Dynamic Dashboards**: Real-time insights into workforce trends.
- **Custom Report Builder**: Export filtered data from any module.
- **CSV Exports**:
    - Payroll Summaries
    - Statutory Returns (KRA/NSSF/SHIF ready formats)
    - Attendance Logs
    - Employee Demographics

---

## 🎨 UI/UX Philosophy
- **Glassmorphism**: Using `GlassCard` and `TiltCard` components for a modern, depth-oriented look.
- **Vibrant Aesthetics**: Harmonious color palettes using Indigo, Emerald, and Slate.
- **Responsive Design**: Fully functional across mobile, tablet, and desktop.
- **Micro-animations**: Spring-based transitions and hover effects to provide a premium feel.

---

## 📂 Directory Structure
- `/backend`: Django source code, migrations, and virtual environment.
- `/frontend`: Next.js application, components, and design system.
