/**
 * 总账 API 客户端（一期 + 二期）
 */
import { apiRequest } from '../../../../services/api';

const BASE = '/apps/kuaicaiwu/gl';

export type GlAccount = {
  id: number;
  account_code: string;
  account_name: string;
  account_type: string;
  parent_id?: number | null;
  level: number;
  is_leaf: boolean;
  balance_direction: string;
  is_cash_journal?: boolean;
  is_bank_journal?: boolean;
  is_controlled?: boolean;
  aux_customer?: boolean;
  aux_supplier?: boolean;
  aux_department?: boolean;
  aux_employee?: boolean;
  aux_project?: boolean;
  is_active: boolean;
  notes?: string | null;
};

export type GlCoaSeedTemplate = {
  key: string;
  name: string;
  standard: string;
  industry: string;
  description: string;
  account_code_rule: string;
  account_count: number;
  recommended?: boolean;
};

export type GlVoucher = {
  id: number;
  voucher_word?: string;
  voucher_code: string;
  voucher_date: string;
  period_year: number;
  period_month: number;
  status: string;
  summary?: string;
  total_debit: number;
  total_credit: number;
  debit_accounts?: string;
  credit_accounts?: string;
  source_doc_type?: string | null;
  source_doc_id?: number | null;
  lines?: GlVoucherLine[];
};

export type GlVoucherLine = {
  id?: number;
  line_no?: number;
  account_id: number;
  account_code?: string;
  account_name?: string;
  summary?: string;
  debit_amount: number;
  credit_amount: number;
  customer_id?: number | null;
  customer_name?: string | null;
  supplier_id?: number | null;
  supplier_name?: string | null;
  department_id?: number | null;
  department_name?: string | null;
  employee_id?: number | null;
  employee_name?: string | null;
  project_id?: number | null;
  project_name?: string | null;
  cash_flow_item_id?: number | null;
};

export const glService = {
  getSettings: () => apiRequest<Record<string, unknown>>(`${BASE}/settings`, { method: 'GET' }),
  updateSettings: (data: Record<string, unknown>) =>
    apiRequest<Record<string, unknown>>(`${BASE}/settings`, { method: 'PUT', data }),
  finishInit: (year: number, month: number) =>
    apiRequest<Record<string, unknown>>(`${BASE}/settings/finish-init`, {
      method: 'POST',
      params: { year, month },
    }),

  listAccounts: (params?: { is_active?: boolean; account_type?: string }) =>
    apiRequest<GlAccount[]>(`${BASE}/accounts`, { method: 'GET', params }),
  createAccount: (data: Partial<GlAccount>) =>
    apiRequest<GlAccount>(`${BASE}/accounts`, { method: 'POST', data }),
  updateAccount: (id: number, data: Partial<GlAccount>) =>
    apiRequest<GlAccount>(`${BASE}/accounts/${id}`, { method: 'PUT', data }),
  deleteAccount: (id: number) =>
    apiRequest<{ success: boolean }>(`${BASE}/accounts/${id}`, { method: 'DELETE' }),
  seedAccounts: (templateKey = 'cas_manufacturing') =>
    apiRequest<{
      created: number;
      skipped: number;
      total_seed: number;
      template?: string;
      template_name?: string;
    }>(`${BASE}/accounts/seed`, {
      method: 'POST',
      params: { template_key: templateKey },
    }),
  listAccountSeedTemplates: () =>
    apiRequest<{ items: GlCoaSeedTemplate[] }>(`${BASE}/accounts/seed-templates`, {
      method: 'GET',
    }),

  getOpeningBalances: (year: number, month: number) =>
    apiRequest<Array<Record<string, unknown>>>(`${BASE}/opening-balances`, {
      method: 'GET',
      params: { year, month },
    }),
  setOpeningBalances: (data: {
    period_year: number;
    period_month: number;
    items: Array<Record<string, unknown>>;
  }) => apiRequest<Record<string, unknown>>(`${BASE}/opening-balances`, { method: 'POST', data }),

  listVouchers: (params?: Record<string, unknown>) =>
    apiRequest<GlVoucher[]>(`${BASE}/vouchers`, { method: 'GET', params }),
  getVoucher: (id: number) => apiRequest<GlVoucher>(`${BASE}/vouchers/${id}`, { method: 'GET' }),
  createVoucher: (data: Record<string, unknown>) =>
    apiRequest<GlVoucher>(`${BASE}/vouchers`, { method: 'POST', data }),
  updateVoucher: (id: number, data: Record<string, unknown>) =>
    apiRequest<GlVoucher>(`${BASE}/vouchers/${id}`, { method: 'PUT', data }),
  reviewVoucher: (id: number) =>
    apiRequest<GlVoucher>(`${BASE}/vouchers/${id}/review`, { method: 'POST' }),
  unreviewVoucher: (id: number) =>
    apiRequest<GlVoucher>(`${BASE}/vouchers/${id}/unreview`, { method: 'POST' }),
  postVoucher: (id: number) =>
    apiRequest<GlVoucher>(`${BASE}/vouchers/${id}/post`, { method: 'POST' }),
  unpostVoucher: (id: number) =>
    apiRequest<GlVoucher>(`${BASE}/vouchers/${id}/unpost`, { method: 'POST' }),
  obsoleteVoucher: (id: number) =>
    apiRequest<GlVoucher>(`${BASE}/vouchers/${id}/obsolete`, { method: 'POST' }),
  generateFromEvents: (limit = 50) =>
    apiRequest<Record<string, unknown>>(`${BASE}/vouchers/generate-from-events`, {
      method: 'POST',
      params: { limit },
    }),
  exportVouchersCsv: (status?: string) =>
    apiRequest<string>(`${BASE}/vouchers/export/csv`, {
      method: 'GET',
      params: status ? { status } : undefined,
      responseType: 'text',
    } as any),

  balanceSheet: (params: Record<string, unknown>) =>
    apiRequest<Array<Record<string, unknown>>>(`${BASE}/books/balance-sheet`, {
      method: 'GET',
      params,
    }),
  trialBalance: (params: Record<string, unknown>) =>
    apiRequest<Record<string, unknown>>(`${BASE}/books/trial-balance`, { method: 'GET', params }),
  detailLedger: (params: Record<string, unknown>) =>
    apiRequest<Record<string, unknown>>(`${BASE}/books/detail-ledger`, { method: 'GET', params }),
  generalLedger: (params: Record<string, unknown>) =>
    apiRequest<Array<Record<string, unknown>>>(`${BASE}/books/general-ledger`, {
      method: 'GET',
      params,
    }),
  voucherSummary: (params: Record<string, unknown>) =>
    apiRequest<Array<Record<string, unknown>>>(`${BASE}/books/voucher-summary`, {
      method: 'GET',
      params,
    }),
  cashFlowStatement: (params: { year: number; month: number }) =>
    apiRequest<Record<string, unknown>>(`${BASE}/statements/cash-flow`, { method: 'GET', params }),
  statutoryBalanceSheet: (params: { year: number; month: number; include_unposted?: boolean }) =>
    apiRequest<Record<string, unknown>>(`${BASE}/statements/balance-sheet`, { method: 'GET', params }),
  statutoryIncomeStatement: (params: { year: number; month: number; include_unposted?: boolean }) =>
    apiRequest<Record<string, unknown>>(`${BASE}/statements/income`, { method: 'GET', params }),

  periodStatus: () =>
    apiRequest<Record<string, unknown>>(`${BASE}/period-close/status`, { method: 'GET' }),
  preCloseChecks: (year: number, month: number) =>
    apiRequest<Record<string, unknown>>(`${BASE}/period-close/pre-checks`, {
      method: 'GET',
      params: { year, month },
    }),
  closePeriod: (year: number, month: number) =>
    apiRequest<Record<string, unknown>>(`${BASE}/period-close/${year}/${month}`, { method: 'POST' }),
  reopenPeriod: (year: number, month: number) =>
    apiRequest<Record<string, unknown>>(`${BASE}/period-close/${year}/${month}/reopen`, {
      method: 'POST',
    }),
  carryProfitLoss: (year: number, month: number) =>
    apiRequest<Record<string, unknown>>(`${BASE}/carry-profit-loss`, {
      method: 'POST',
      params: { year, month },
    }),

  cashierJournal: (params: Record<string, unknown>) =>
    apiRequest<Record<string, unknown>>(`${BASE}/cashier/journal`, { method: 'GET', params }),
  listReconcileItems: (params: Record<string, unknown>) =>
    apiRequest<Array<Record<string, unknown>>>(`${BASE}/cashier/reconcile-items`, {
      method: 'GET',
      params,
    }),
  addReconcileItem: (data: Record<string, unknown>) =>
    apiRequest<Record<string, unknown>>(`${BASE}/cashier/reconcile-items`, {
      method: 'POST',
      data,
    }),
  syncEnterprise: (gl_account_id: number, year: number, month: number) =>
    apiRequest<Record<string, unknown>>(`${BASE}/cashier/sync-enterprise`, {
      method: 'POST',
      params: { gl_account_id, year, month },
    }),
  matchReconcile: (item_ids: number[]) =>
    apiRequest<Record<string, unknown>>(`${BASE}/cashier/match`, {
      method: 'POST',
      data: { item_ids },
    }),
  balanceAdjustment: (params: Record<string, unknown>) =>
    apiRequest<Record<string, unknown>>(`${BASE}/cashier/balance-adjustment`, {
      method: 'GET',
      params,
    }),

  monthEndChecks: (year: number, month: number) =>
    apiRequest<Record<string, unknown>>(`${BASE}/integration/month-end-checks`, {
      method: 'GET',
      params: { year, month },
    }),

  listSummaries: () =>
    apiRequest<Array<{ id: number; content: string; sort_order: number }>>(`${BASE}/summaries`, {
      method: 'GET',
    }),
  createSummary: (content: string) =>
    apiRequest<{ id: number; content: string }>(`${BASE}/summaries`, {
      method: 'POST',
      data: { content },
    }),

  listTransferTemplates: () =>
    apiRequest<
      Array<{
        id: number;
        template_code: string;
        template_name: string;
        template_type: string;
        lines?: unknown[];
        is_active?: boolean;
      }>
    >(`${BASE}/transfer-templates`, { method: 'GET' }),
  upsertTransferTemplate: (data: Record<string, unknown>) =>
    apiRequest<Record<string, unknown>>(`${BASE}/transfer-templates`, { method: 'POST', data }),
  runTransferTemplate: (templateId: number, year: number, month: number) =>
    apiRequest<Record<string, unknown>>(`${BASE}/transfer-templates/${templateId}/run`, {
      method: 'POST',
      params: { year, month },
    }),

  listProjects: () => apiRequest<Array<Record<string, unknown>>>(`${BASE}/projects`, { method: 'GET' }),
  upsertProject: (data: Record<string, unknown>) =>
    apiRequest<Record<string, unknown>>(`${BASE}/projects`, { method: 'POST', data }),

  listCashFlowItems: () =>
    apiRequest<Array<Record<string, unknown>>>(`${BASE}/cash-flow-items`, { method: 'GET' }),
  upsertCashFlowItem: (data: Record<string, unknown>) =>
    apiRequest<Record<string, unknown>>(`${BASE}/cash-flow-items`, { method: 'POST', data }),
  seedCashFlowItems: () =>
    apiRequest<Record<string, unknown>>(`${BASE}/cash-flow-items/seed`, { method: 'POST' }),

  listAccruals: () => apiRequest<Array<Record<string, unknown>>>(`${BASE}/accruals`, { method: 'GET' }),
  upsertAccrual: (data: Record<string, unknown>) =>
    apiRequest<Record<string, unknown>>(`${BASE}/accruals`, { method: 'POST', data }),
  runAccrual: (id: number, year: number, month: number) =>
    apiRequest<Record<string, unknown>>(`${BASE}/accruals/${id}/run`, {
      method: 'POST',
      params: { year, month },
    }),

  listCheques: (gl_account_id?: number) =>
    apiRequest<Array<Record<string, unknown>>>(`${BASE}/cheques`, {
      method: 'GET',
      params: gl_account_id ? { gl_account_id } : undefined,
    }),
  createCheque: (data: Record<string, unknown>) =>
    apiRequest<Record<string, unknown>>(`${BASE}/cheques`, { method: 'POST', data }),
  clearCheque: (id: number) =>
    apiRequest<Record<string, unknown>>(`${BASE}/cheques/${id}/clear`, { method: 'POST' }),
  voidCheque: (id: number) =>
    apiRequest<Record<string, unknown>>(`${BASE}/cheques/${id}/void`, { method: 'POST' }),

  recordFaEvent: (data: Record<string, unknown>) =>
    apiRequest<Record<string, unknown>>(`${BASE}/fa/record-event`, { method: 'POST', data }),
};
