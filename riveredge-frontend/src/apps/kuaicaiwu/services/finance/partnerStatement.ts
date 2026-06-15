import { apiRequest } from '../../../../services/api';

export interface PartnerStatementLine {
  date: string;
  doc_type: string;
  doc_code: string;
  summary?: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface PartnerStatementSummary {
  opening_balance: number;
  debit_total: number;
  credit_total: number;
  closing_balance: number;
}

export interface PartnerStatementPreview {
  partner_id: number;
  partner_name: string;
  partner_type: string;
  start_date: string;
  end_date: string;
  company_name: string;
  balance_label: string;
  summary: PartnerStatementSummary;
  lines: PartnerStatementLine[];
  partner_snapshot?: Record<string, unknown>;
}

export interface PartnerStatement {
  id: number;
  statement_code: string;
  partner_id: number;
  partner_name: string;
  partner_type: string;
  statement_period: string;
  start_date: string;
  end_date: string;
  opening_balance: number;
  debit_total: number;
  credit_total: number;
  closing_balance: number;
  status: string;
  company_name?: string;
  transaction_details?: {
    summary?: PartnerStatementSummary;
    lines?: PartnerStatementLine[];
    balance_label?: string;
    partner_snapshot?: Record<string, unknown>;
  };
  confirmed_at?: string;
  sent_at?: string;
  sent_channel?: string;
  dispute_reason?: string;
  disputed_at?: string;
  notes?: string;
  created_at: string;
}

const API = '/apps/kuaicaiwu/partner-statements';

export const partnerStatementService = {
  preview: (params: {
    partner_id: number;
    partner_type: string;
    start_date: string;
    end_date: string;
  }) =>
    apiRequest<PartnerStatementPreview>(`${API}/preview`, { method: 'GET', params }),

  create: (data: {
    partner_id: number;
    partner_type: string;
    statement_period: string;
    start_date?: string;
    end_date?: string;
    notes?: string;
    attachments?: Array<{ uid?: string; name?: string; status?: string; url?: string }>;
  }) => apiRequest<PartnerStatement>(API, { method: 'POST', data }),

  list: (params?: Record<string, unknown>) =>
    apiRequest<{ items: PartnerStatement[]; total: number }>(API, { method: 'GET', params }),

  get: (id: number) => apiRequest<PartnerStatement>(`${API}/${id}`, { method: 'GET' }),

  confirm: (id: number) => apiRequest<PartnerStatement>(`${API}/${id}/confirm`, { method: 'POST' }),

  markSent: (id: number, data: { channel: string; notes?: string }) =>
    apiRequest<PartnerStatement>(`${API}/${id}/mark-sent`, { method: 'POST', data }),

  dispute: (id: number, reason: string) =>
    apiRequest<PartnerStatement>(`${API}/${id}/dispute`, { method: 'POST', data: { reason } }),

  delete: (id: number) => apiRequest<void>(`${API}/${id}`, { method: 'DELETE' }),

  exportFile: (id: number, format: 'xlsx' | 'pdf') =>
    apiRequest<Blob>(`${API}/${id}/export`, {
      method: 'GET',
      params: { format },
      responseType: 'blob',
    }),
};

export const PARTNER_STATEMENT_STATUS_MAP: Record<string, { text: string; color: string }> = {
  Draft: { text: '草稿', color: 'default' },
  Confirmed: { text: '已确认', color: 'processing' },
  Sent: { text: '已发送', color: 'success' },
  Disputed: { text: '有异议', color: 'warning' },
};

export const SENT_CHANNEL_OPTIONS = [
  { label: '导出后微信/邮件发送', value: 'wechat_manual' },
  { label: '打印邮寄', value: 'print' },
  { label: '导出文件发送', value: 'export' },
  { label: '邮件手动发送', value: 'email_manual' },
  { label: '其他', value: 'other' },
];

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
