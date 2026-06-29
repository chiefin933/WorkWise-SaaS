import axios from 'axios';
import type {
  ExpenseClaim,
  DepartmentBudget,
  BudgetUtilizationResponse,
  PettyCashFund,
  PettyCashTransaction,
  FinancialSummary,
} from './types';

let _getToken: (() => Promise<string | null>) | null = null;

export function setTokenGetter(fn: () => Promise<string | null>) {
  _getToken = fn;
}

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api',
});

api.interceptors.request.use(
  async (config) => {
    if (_getToken) {
      try {
        const token = await _getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch {
        // proceed without auth header
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;

// ── Finance API ───────────────────────────────────────────────────────────────

export const financeApi = {
  // ── Expense Claims ──────────────────────────────────────────────────────────
  getExpenses: (params?: { status?: string; department?: string }) =>
    api.get<ExpenseClaim[]>('/finance/expenses/', { params }).then((r) => r.data),

  getExpense: (id: string) =>
    api.get<ExpenseClaim>(`/finance/expenses/${id}/`).then((r) => r.data),

  createExpense: (data: {
    employee: string;
    title: string;
    category: string;
    amount: number;
    expense_date: string;
    description?: string;
    receipt_url?: string;
  }) =>
    api.post<ExpenseClaim>('/finance/expenses/', data).then((r) => r.data),

  updateExpense: (id: string, data: Partial<ExpenseClaim>) =>
    api.patch<ExpenseClaim>(`/finance/expenses/${id}/`, data).then((r) => r.data),

  approveExpense: (id: string, comment?: string) =>
    api.post<ExpenseClaim>(`/finance/expenses/${id}/approve/`, { comment: comment ?? '' }).then((r) => r.data),

  rejectExpense: (id: string, comment: string) =>
    api.post<ExpenseClaim>(`/finance/expenses/${id}/reject/`, { comment }).then((r) => r.data),

  markExpensePaid: (id: string) =>
    api.post<ExpenseClaim>(`/finance/expenses/${id}/mark-paid/`).then((r) => r.data),

  deleteExpense: (id: string) =>
    api.delete(`/finance/expenses/${id}/`).then((r) => r.data),

  // ── Department Budgets ──────────────────────────────────────────────────────
  getBudgets: (params?: { year?: number; month?: number; department?: string }) =>
    api.get<DepartmentBudget[]>('/finance/budgets/', { params }).then((r) => r.data),

  createBudget: (data: {
    department: string;
    period_month: number;
    period_year: number;
    budget_amount: number;
    notes?: string;
  }) =>
    api.post<DepartmentBudget>('/finance/budgets/', data).then((r) => r.data),

  updateBudget: (id: string, data: Partial<DepartmentBudget>) =>
    api.patch<DepartmentBudget>(`/finance/budgets/${id}/`, data).then((r) => r.data),

  deleteBudget: (id: string) =>
    api.delete(`/finance/budgets/${id}/`).then((r) => r.data),

  getBudgetUtilization: (params: { year: number; month: number }) =>
    api.get<BudgetUtilizationResponse>('/finance/budgets/utilization/', { params }).then((r) => r.data),

  // ── Petty Cash ──────────────────────────────────────────────────────────────
  getPettyCashFunds: () =>
    api.get<PettyCashFund[]>('/finance/petty-cash/').then((r) => r.data),

  createPettyCashFund: (data: { name: string; opening_balance: number; custodian?: string }) =>
    api.post<PettyCashFund>('/finance/petty-cash/', data).then((r) => r.data),

  updatePettyCashFund: (id: string, data: Partial<PettyCashFund>) =>
    api.patch<PettyCashFund>(`/finance/petty-cash/${id}/`, data).then((r) => r.data),

  getFundTransactions: (fundId: string, params?: { status?: string }) =>
    api.get<PettyCashTransaction[]>(`/finance/petty-cash/${fundId}/transactions/`, { params }).then((r) => r.data),

  createPettyCashRequest: (fundId: string, data: {
    transaction_type: string;
    amount: number;
    purpose: string;
    category?: string;
    receipt_url?: string;
  }) =>
    api.post<PettyCashTransaction>(`/finance/petty-cash/${fundId}/transactions/`, data).then((r) => r.data),

  approvePettyCashTxn: (fundId: string, txnId: string, comment?: string) =>
    api.post<PettyCashTransaction>(`/finance/petty-cash/${fundId}/transactions/${txnId}/approve/`, { comment: comment ?? '' }).then((r) => r.data),

  rejectPettyCashTxn: (fundId: string, txnId: string, comment: string) =>
    api.post<PettyCashTransaction>(`/finance/petty-cash/${fundId}/transactions/${txnId}/reject/`, { comment }).then((r) => r.data),

  // ── Financial Summary ───────────────────────────────────────────────────────
  getFinancialSummary: (params?: { year?: number; month?: number }) =>
    api.get<FinancialSummary>('/finance/summary/', { params }).then((r) => r.data),
};
