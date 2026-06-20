export interface Employee {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  department?: string;
  job_title?: string;
  kra_pin?: string;
  status?: string;
  employment_type?: string;
  payment_method?: string;
  salary_basic?: string | number;
}

export interface AttendanceLog {
  id: string;
  employee_name?: string;
  date: string;
  clock_in: string;
  clock_out?: string | null;
  location?: string;
  hours_worked?: string | number;
  overtime_hours?: string | number;
}

export interface AttendanceStats {
  month: number;
  year: number;
  total_logs: number;
  total_hours: number;
  on_time_rate: number;
  unique_employees: number;
}

export interface LeaveRequest {
  id: string;
  employee_name?: string;
  leave_type?: string;
  start_date: string;
  end_date: string;
  status?: string;
}

export interface LeaveStats {
  pending: number;
  approved: number;
  rejected: number;
  policy: {
    annual: number;
    sick: number;
    maternity: number;
    paternity: number;
    notice_days: number;
  };
}

export interface PayrollItem {
  id: string;
  payroll_run: string;
  employee: string;
  employee_name: string;
  payment_method: 'mpesa' | 'bank';
  mpesa_number?: string;
  gross_salary: number;
  nssf: number;
  shif: number;
  ahl: number;
  paye: number;
  net_pay: number;
}

export interface PayrollRun {
  id: string;
  month: number;
  year: number;
  item_count: number;
  total_net: number;
  status: string;
  items?: PayrollItem[];
}

export interface PayrollSummary {
  month: number;
  year: number;
  total_net: number;
  total_statutory: number;
  employee_count: number;
  status: string | null;
  change_pct: number;
  has_run: boolean;
}

export interface DashboardActivity {
  title: string;
  description: string;
  time: string;
}

export interface DashboardStats {
  total_employees?: number;
  pending_leaves?: number;
  monthly_payroll_cost?: number;
  alerts?: number;
  attendance_rate?: number;
  leave_utilization?: number;
  suggestion?: string;
  recent_activities?: DashboardActivity[];
  company_name?: string;
  monthly_trends?: Array<{ month: string; cost: number; employees: number }>;
  department_costs?: Array<{ department: string; cost: number; employees: number }>;
  leave_distribution?: Array<{ leave_type: string; days: number }>;
}

export interface CompanySettings {
  id: string;
  name: string;
  country: string;
  currency: string;
  plan: string;
  subscription_status: string;
  max_employees: number;
  trial_ends_at: string | null;
  kra_pin: string;
  address: string;
  phone: string;
}

export interface PayrollConfig {
  nssf_rate: string | number;
  nssf_cap: string | number;
  shif_rate: string | number;
  shif_min: string | number;
  ahl_rate: string | number;
  personal_relief: string | number;
  paye_bands: Array<{ limit: number; rate: number }>;
}

export interface TeamMember {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: 'ADMIN' | 'HR' | 'FINANCE' | 'EMPLOYEE';
  is_active: boolean;
  invite_pending: boolean;
}

// ── Finance Module Types ──────────────────────────────────────────────────────

export type ExpenseCategory =
  | 'travel' | 'accommodation' | 'meals' | 'office'
  | 'client' | 'utilities' | 'training' | 'medical' | 'other';

export type ExpenseStatus = 'pending' | 'approved' | 'rejected' | 'paid';

export interface ExpenseClaim {
  id: string;
  employee: string;
  employee_name: string;
  employee_dept: string;
  submitted_by: string;
  submitted_by_name: string;
  title: string;
  category: ExpenseCategory;
  category_display: string;
  amount: number;
  currency: string;
  expense_date: string;
  description: string;
  receipt_url: string;
  status: ExpenseStatus;
  status_display: string;
  reviewed_by: string | null;
  reviewed_by_name: string | null;
  review_comment: string;
  reviewed_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DepartmentBudget {
  id: string;
  department: string;
  period_month: number;
  period_year: number;
  budget_amount: number;
  notes: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface BudgetUtilization {
  department: string;
  budget: number;
  payroll_cost: number;
  expense_cost: number;
  actual_spend: number;
  remaining: number;
  utilization_pct: number;
  over_budget: boolean;
}

export interface BudgetUtilizationResponse {
  month: number;
  year: number;
  departments: BudgetUtilization[];
}

export interface PettyCashFund {
  id: string;
  name: string;
  opening_balance: number;
  current_balance: number;
  custodian: string;
  custodian_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type PettyCashStatus = 'pending' | 'approved' | 'rejected' | 'disbursed';
export type PettyCashType = 'request' | 'topup' | 'replenish';

export interface PettyCashTransaction {
  id: string;
  fund: string;
  transaction_type: PettyCashType;
  type_display: string;
  requested_by: string;
  requested_by_name: string;
  amount: number;
  purpose: string;
  category: string;
  receipt_url: string;
  status: PettyCashStatus;
  status_display: string;
  approved_by: string | null;
  approved_by_name: string | null;
  approval_comment: string;
  approved_at: string | null;
  disbursed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinancialSummary {
  month: number;
  year: number;
  payroll_cost: number;
  total_expenses: number;
  pending_expenses: number;
  pending_count: number;
  petty_balance: number;
  total_budget: number;
  total_actual: number;
  budget_utilization_pct: number;
  expenses_by_category: Array<{ category: string; total: number }>;
}

export interface ApiErrorResponse {
  message?: string;
  non_field_errors?: string[];
  error?: string;
  detail?: string;
}

export interface AuthUser {
  id?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  role?: 'ADMIN' | 'HR' | 'FINANCE' | 'EMPLOYEE';
  company_name?: string;
  plan?: string;
  max_employees?: number;
  subscription_status?: string;
  trial_ends_at?: string;
  kra_pin?: string;
  tenant_id?: string;
  notification_preferences?: Record<string, boolean>;
}
