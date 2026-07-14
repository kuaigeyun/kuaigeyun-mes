import type { TFunction } from 'i18next';
import type { ProColumns } from '@ant-design/pro-components';
import React from 'react';
import { extractProTableSort } from '../../../utils/tableQueryKey';
import { parseSalesReportDateRange } from '../../kuaizhizao/services/reports';
import { formatDateTime } from '../../../utils/format';
import { formDateRangeFormItemProps } from '../../../utils/formDate';
import { UniTableStackedPrimaryCell } from '../../../components/uni-table/stackedPrimaryColumn';

export const FINANCE_DOC_PINNED_STATUS_FIELD = 'status';

export const FINANCE_CRUD_PINNED_ACTIVE_FIELD = 'isActive';

function pickString(search: Record<string, unknown> | null | undefined, key: string) {
  const v = search?.[key];
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function pickOptionalId(search: Record<string, unknown>, key: string): number | undefined {
  const v = search[key];
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function resolveFinanceSort(sort?: Record<string, unknown>) {
  const { sortBy, sortOrder } = extractProTableSort(sort ?? {});
  if (!sortBy || !sortOrder) {
    return { sort_field: undefined, sort_order: undefined };
  }
  return {
    sort_field: sortBy,
    sort_order: sortOrder === 'desc' ? 'desc' : 'asc',
  };
}

export function normalizeFinanceListResponse<T>(
  res: { items?: T[]; data?: T[]; total?: number } | T[] | null | undefined,
): { data: T[]; total: number } {
  if (Array.isArray(res)) {
    return { data: res, total: res.length };
  }
  if (res && typeof res === 'object') {
    const data = Array.isArray(res.items) ? res.items : Array.isArray(res.data) ? res.data : [];
    const total = typeof res.total === 'number' ? res.total : data.length;
    return { data, total };
  }
  return { data: [], total: 0 };
}

export function formatFinanceDateTimeCell(value: unknown): string {
  if (!value) return '-';
  return formatDateTime(value as string | Date, 'YYYY-MM-DD HH:mm');
}

function resolveFinanceOperatorName(record: Record<string, unknown>, key: 'created' | 'updated'): string {
  const candidates =
    key === 'created'
      ? ['created_by_name', 'creator_name', 'created_user_name', 'createdByName', 'creatorName']
      : ['updated_by_name', 'updater_name', 'updated_user_name', 'updatedByName', 'updaterName'];
  for (const candidate of candidates) {
    const value = String(record[candidate] ?? '').trim();
    if (value) return value;
  }
  return '-';
}

function resolveFinanceAuditTime(record: Record<string, unknown>, key: 'created' | 'updated'): string {
  const value =
    key === 'created'
      ? (record.created_at ?? record.createdAt)
      : (record.updated_at ?? record.updatedAt);
  return formatFinanceDateTimeCell(value);
}

function resolveFinancePreferredAudit(record: Record<string, unknown>): { operator: string; time: string } {
  const updatedOperator = resolveFinanceOperatorName(record, 'updated');
  const updatedTime = resolveFinanceAuditTime(record, 'updated');
  if (updatedOperator !== '-' && updatedTime !== '-') {
    return { operator: updatedOperator, time: updatedTime };
  }
  const createdOperator = resolveFinanceOperatorName(record, 'created');
  const createdTime = resolveFinanceAuditTime(record, 'created');
  if (createdOperator !== '-' && createdTime !== '-') {
    return { operator: createdOperator, time: createdTime };
  }
  if (updatedTime !== '-') {
    return { operator: updatedOperator, time: updatedTime };
  }
  return { operator: createdOperator, time: createdTime };
}

export function financeDocCodePartnerSearchColumns(options: {
  docCodeLabel: string;
  docCodeField: string;
  partnerLabel: string;
  partnerIdField: string;
  partnerNameField: string;
  partnerOptions: { label: string; value: number }[];
}): ProColumns[] {
  return [
    {
      title: options.docCodeLabel,
      dataIndex: options.docCodeField,
      hideInTable: true,
      order: 10,
      fieldProps: { allowClear: true },
    },
    {
      title: options.partnerLabel,
      dataIndex: options.partnerIdField,
      hideInTable: true,
      order: 11,
      valueType: 'select',
      fieldProps: {
        options: options.partnerOptions,
        showSearch: true,
        optionFilterProp: 'label',
        allowClear: true,
      },
    },
    {
      title: options.partnerLabel,
      dataIndex: options.partnerNameField,
      hideInTable: true,
      order: 12,
      fieldProps: { allowClear: true },
    },
  ];
}

/** 统一审计列：表内仅一列「更新时间」（操作人 + 时间堆叠）；搜索区保留创建/更新日期范围。 */
export function financeDocCreatedUpdatedColumns<T extends object>(t: TFunction): ProColumns<T>[] {
  return [
    {
      title: t('common.updatedAt'),
      dataIndex: 'updated_at',
      width: 148,
      uniTableKeepWidth: true,
      sorter: true,
      hideInSearch: true,
      render: (_, r) => {
        const preferred = resolveFinancePreferredAudit(r as Record<string, unknown>);
        return React.createElement(UniTableStackedPrimaryCell, {
          primary: preferred.operator,
          secondary: preferred.time,
          secondaryCopyable: false,
          primaryBold: false,
        });
      },
    } as ProColumns<T>,
    {
      title: t('common.createdAt'),
      dataIndex: 'created_at_range',
      valueType: 'dateRange',
      hideInTable: true,
      order: 30,
      formItemProps: formDateRangeFormItemProps,
    },
    {
      title: t('common.updatedAt'),
      dataIndex: 'updated_at_range',
      valueType: 'dateRange',
      hideInTable: true,
      order: 31,
      formItemProps: formDateRangeFormItemProps,
    },
  ];
}

function resolveFinanceArApListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
  options?: {
    docCodeField: string;
    partnerIdField: string;
    partnerNameField: string;
  },
): Record<string, string | number | boolean | undefined> {
  const s = searchFormValues ?? {};
  const fuzzyKeyword = pickString(s, 'keyword');
  const { sort_field, sort_order } = resolveFinanceSort(sort);
  const { date_start: created_start_date, date_end: created_end_date } = parseSalesReportDateRange(s, [
    'created_at_range',
    'createdAtRange',
  ]);
  const { date_start: updated_start_date, date_end: updated_end_date } = parseSalesReportDateRange(s, [
    'updated_at_range',
    'updatedAtRange',
  ]);
  const { date_start: business_date_start, date_end: business_date_end } = parseSalesReportDateRange(s, [
    'business_date_range',
    'businessDateRange',
  ]);
  const { date_start: due_date_start, date_end: due_date_end } = parseSalesReportDateRange(s, [
    'due_date_range',
    'dueDateRange',
  ]);

  const params: Record<string, string | number | boolean | undefined> = {
    status: pickString(s, 'status'),
    review_status: pickString(s, 'review_status'),
    sort_field,
    sort_order,
    created_start_date,
    created_end_date,
    updated_start_date,
    updated_end_date,
    business_date_start,
    business_date_end,
    due_date_start,
    due_date_end,
  };

  if (options) {
    const partnerId = pickOptionalId(s, options.partnerIdField);
    if (partnerId) params[options.partnerIdField] = partnerId;
  }

  if (fuzzyKeyword) {
    params.keyword = fuzzyKeyword;
  } else if (options) {
    const docCode = pickString(s, options.docCodeField);
    const partnerName = pickString(s, options.partnerNameField);
    if (docCode) params[options.docCodeField] = docCode;
    if (partnerName) params[options.partnerNameField] = partnerName;
  }

  return params;
}

export function resolveReceivableListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
) {
  return resolveFinanceArApListParams(searchFormValues, sort, {
    docCodeField: 'receivable_code',
    partnerIdField: 'customer_id',
    partnerNameField: 'customer_name',
  });
}

export function resolvePayableListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
) {
  return resolveFinanceArApListParams(searchFormValues, sort, {
    docCodeField: 'payable_code',
    partnerIdField: 'supplier_id',
    partnerNameField: 'supplier_name',
  });
}

function resolveFinanceVoucherListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
  options: {
    docCodeField: string;
    partnerIdField: string;
    partnerNameField: string;
    docDateRangeKeys: [string, string];
  },
): Record<string, string | number | boolean | undefined> {
  const s = searchFormValues ?? {};
  const fuzzyKeyword = pickString(s, 'keyword');
  const { sort_field, sort_order } = resolveFinanceSort(sort);
  const { date_start: created_start_date, date_end: created_end_date } = parseSalesReportDateRange(s, [
    'created_at_range',
    'createdAtRange',
  ]);
  const { date_start: updated_start_date, date_end: updated_end_date } = parseSalesReportDateRange(s, [
    'updated_at_range',
    'updatedAtRange',
  ]);
  const { date_start: start_date, date_end: end_date } = parseSalesReportDateRange(s, options.docDateRangeKeys);

  const params: Record<string, string | number | boolean | undefined> = {
    status: pickString(s, 'status'),
    settlement_type: pickString(s, 'settlement_type'),
    sort_field,
    sort_order,
    created_start_date,
    created_end_date,
    updated_start_date,
    updated_end_date,
    start_date,
    end_date,
  };

  const partnerId = pickOptionalId(s, options.partnerIdField);
  if (partnerId) params[options.partnerIdField] = partnerId;

  if (fuzzyKeyword) {
    params.keyword = fuzzyKeyword;
  } else {
    const docCode = pickString(s, options.docCodeField);
    const partnerName = pickString(s, options.partnerNameField);
    if (docCode) params[options.docCodeField] = docCode;
    if (partnerName) params[options.partnerNameField] = partnerName;
  }

  return params;
}

export function resolveReceiptListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
) {
  return resolveFinanceVoucherListParams(searchFormValues, sort, {
    docCodeField: 'receipt_code',
    partnerIdField: 'customer_id',
    partnerNameField: 'customer_name',
    docDateRangeKeys: ['receipt_date_range', 'receiptDateRange'],
  });
}

export const FINANCE_INVOICE_PINNED_REVIEW_FIELD = 'review_status';

export function financeInvoiceNumberSearchColumn(title: string, order = 13): ProColumns {
  return {
    title,
    dataIndex: 'invoice_number',
    hideInTable: true,
    order,
    fieldProps: { allowClear: true },
  };
}

function resolveFinanceInvoiceListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
  options: {
    docCodeField: string;
    partnerIdField: string;
    partnerNameField: string;
    docDateRangeKeys: [string, string];
  },
): Record<string, string | number | boolean | undefined> {
  const s = searchFormValues ?? {};
  const fuzzyKeyword = pickString(s, 'keyword');
  const { sort_field, sort_order } = resolveFinanceSort(sort);
  const { date_start: created_start_date, date_end: created_end_date } = parseSalesReportDateRange(s, [
    'created_at_range',
    'createdAtRange',
  ]);
  const { date_start: updated_start_date, date_end: updated_end_date } = parseSalesReportDateRange(s, [
    'updated_at_range',
    'updatedAtRange',
  ]);
  const { date_start: start_date, date_end: end_date } = parseSalesReportDateRange(s, options.docDateRangeKeys);

  const params: Record<string, string | number | boolean | undefined> = {
    status: pickString(s, 'status'),
    review_status: pickString(s, 'review_status'),
    sort_field,
    sort_order,
    created_start_date,
    created_end_date,
    updated_start_date,
    updated_end_date,
    start_date,
    end_date,
  };

  const partnerId = pickOptionalId(s, options.partnerIdField);
  if (partnerId) params[options.partnerIdField] = partnerId;

  if (fuzzyKeyword) {
    params.keyword = fuzzyKeyword;
  } else {
    const docCode = pickString(s, options.docCodeField);
    const partnerName = pickString(s, options.partnerNameField);
    const invoiceNumber = pickString(s, 'invoice_number');
    if (docCode) params[options.docCodeField] = docCode;
    if (partnerName) params[options.partnerNameField] = partnerName;
    if (invoiceNumber) params.invoice_number = invoiceNumber;
  }

  return params;
}

export function resolveSalesInvoiceListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
) {
  const params = resolveFinanceInvoiceListParams(searchFormValues, sort, {
    docCodeField: 'invoice_code',
    partnerIdField: 'customer_id',
    partnerNameField: 'customer_name',
    docDateRangeKeys: ['invoice_date_range', 'invoiceDateRange'],
  });
  return params;
}

export function resolvePurchaseInvoiceListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
) {
  return resolveFinanceInvoiceListParams(searchFormValues, sort, {
    docCodeField: 'invoice_code',
    partnerIdField: 'supplier_id',
    partnerNameField: 'supplier_name',
    docDateRangeKeys: ['invoice_date_range', 'invoiceDateRange'],
  });
}

export function resolvePaymentListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
) {
  return resolveFinanceVoucherListParams(searchFormValues, sort, {
    docCodeField: 'payment_code',
    partnerIdField: 'supplier_id',
    partnerNameField: 'supplier_name',
    docDateRangeKeys: ['payment_date_range', 'paymentDateRange'],
  });
}

export function partnerStatementSearchColumns(options: {
  statementCodeLabel: string;
  partnerLabel: string;
  partnerOptions: { label: string; value: number }[];
  periodLabel: string;
}): ProColumns[] {
  return [
    {
      title: options.statementCodeLabel,
      dataIndex: 'statement_code',
      hideInTable: true,
      order: 10,
      fieldProps: { allowClear: true },
    },
    {
      title: options.partnerLabel,
      dataIndex: 'partner_id',
      hideInTable: true,
      order: 11,
      valueType: 'select',
      fieldProps: {
        options: options.partnerOptions,
        showSearch: true,
        optionFilterProp: 'label',
        allowClear: true,
      },
    },
    {
      title: options.partnerLabel,
      dataIndex: 'partner_name',
      hideInTable: true,
      order: 12,
      fieldProps: { allowClear: true },
    },
    {
      title: options.periodLabel,
      dataIndex: 'statement_period',
      hideInTable: true,
      order: 13,
      fieldProps: { allowClear: true, placeholder: 'YYYY-MM' },
    },
  ];
}

export function resolvePartnerStatementListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
  partnerType?: 'Customer' | 'Supplier',
): Record<string, string | number | boolean | undefined> {
  const s = searchFormValues ?? {};
  const fuzzyKeyword = pickString(s, 'keyword');
  const { sort_field, sort_order } = resolveFinanceSort(sort);
  const { date_start: created_start_date, date_end: created_end_date } = parseSalesReportDateRange(s, [
    'created_at_range',
    'createdAtRange',
  ]);
  const { date_start: updated_start_date, date_end: updated_end_date } = parseSalesReportDateRange(s, [
    'updated_at_range',
    'updatedAtRange',
  ]);

  const params: Record<string, string | number | boolean | undefined> = {
    status: pickString(s, 'status'),
    statement_period: pickString(s, 'statement_period'),
    sort_field,
    sort_order,
    created_start_date,
    created_end_date,
    updated_start_date,
    updated_end_date,
  };

  if (partnerType) {
    params.partner_type = partnerType;
  }

  const partnerId = pickOptionalId(s, 'partner_id');
  if (partnerId) params.partner_id = partnerId;

  if (fuzzyKeyword) {
    params.keyword = fuzzyKeyword;
  } else {
    const statementCode = pickString(s, 'statement_code');
    const partnerName = pickString(s, 'partner_name');
    if (statementCode) params.statement_code = statementCode;
    if (partnerName) params.partner_name = partnerName;
  }

  return params;
}

export function prepaymentBalanceSearchColumns(partnerLabel: string): ProColumns[] {
  return [
    {
      title: partnerLabel,
      dataIndex: 'partner_name',
      hideInTable: true,
      order: 10,
      fieldProps: { allowClear: true },
    },
  ];
}

export function resolvePrepaymentBalanceListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
): Record<string, string | number | boolean | undefined> {
  const s = searchFormValues ?? {};
  const fuzzyKeyword = pickString(s, 'keyword');
  const { sort_field, sort_order } = resolveFinanceSort(sort);

  const params: Record<string, string | number | boolean | undefined> = {
    sort_field,
    sort_order,
  };

  if (fuzzyKeyword) {
    params.keyword = fuzzyKeyword;
  } else {
    const name = pickString(s, 'partner_name');
    if (name) params.partner_name = name;
  }

  return params;
}

export function bankAccountSearchColumns(labels: {
  accountCode: string;
  accountName: string;
  bankName: string;
  accountNumber: string;
}): ProColumns[] {
  return [
    {
      title: labels.accountCode,
      dataIndex: 'account_code',
      hideInTable: true,
      order: 10,
      fieldProps: { allowClear: true },
    },
    {
      title: labels.accountName,
      dataIndex: 'account_name',
      hideInTable: true,
      order: 11,
      fieldProps: { allowClear: true },
    },
    {
      title: labels.bankName,
      dataIndex: 'bank_name',
      hideInTable: true,
      order: 12,
      fieldProps: { allowClear: true },
    },
    {
      title: labels.accountNumber,
      dataIndex: 'account_number',
      hideInTable: true,
      order: 13,
      fieldProps: { allowClear: true },
    },
  ];
}

export function resolveBankAccountListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
): Record<string, string | number | boolean | undefined> {
  const s = searchFormValues ?? {};
  const fuzzyKeyword = pickString(s, 'keyword');
  const { sort_field, sort_order } = resolveFinanceSort(sort);
  const { date_start: created_start_date, date_end: created_end_date } = parseSalesReportDateRange(s, [
    'created_at_range',
    'createdAtRange',
  ]);
  const { date_start: updated_start_date, date_end: updated_end_date } = parseSalesReportDateRange(s, [
    'updated_at_range',
    'updatedAtRange',
  ]);

  const activeRaw = s[FINANCE_CRUD_PINNED_ACTIVE_FIELD];
  const is_active =
    activeRaw === true || activeRaw === 'true'
      ? true
      : activeRaw === false || activeRaw === 'false'
        ? false
        : undefined;

  const params: Record<string, string | number | boolean | undefined> = {
    sort_field,
    sort_order,
    is_active,
    created_start_date,
    created_end_date,
    updated_start_date,
    updated_end_date,
  };

  if (fuzzyKeyword) {
    params.keyword = fuzzyKeyword;
  } else {
    const accountCode = pickString(s, 'account_code');
    const accountName = pickString(s, 'account_name');
    const bankName = pickString(s, 'bank_name');
    const accountNumber = pickString(s, 'account_number');
    if (accountCode) params.account_code = accountCode;
    if (accountName) params.account_name = accountName;
    if (bankName) params.bank_name = bankName;
    if (accountNumber) params.account_number = accountNumber;
  }

  return params;
}

export function documentReconciliationGapSearchColumns(options: {
  docCodeLabel: string;
  docTypeLabel: string;
  docTypeEnum: Record<string, { text: string }>;
}): ProColumns[] {
  return [
    {
      title: options.docTypeLabel,
      dataIndex: 'doc_type',
      hideInTable: true,
      order: 10,
      valueType: 'select',
      valueEnum: options.docTypeEnum,
      fieldProps: { allowClear: true },
    },
    {
      title: options.docCodeLabel,
      dataIndex: 'doc_code',
      hideInTable: true,
      order: 11,
      fieldProps: { allowClear: true },
    },
  ];
}

export function resolveDocumentReconciliationGapListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
): Record<string, string | number | boolean | undefined> {
  const s = searchFormValues ?? {};
  const fuzzyKeyword = pickString(s, 'keyword');
  const { sort_field, sort_order } = resolveFinanceSort(sort);

  const params: Record<string, string | number | boolean | undefined> = {
    sort_field,
    sort_order,
  };

  if (fuzzyKeyword) {
    params.keyword = fuzzyKeyword;
  } else {
    const docType = pickString(s, 'doc_type');
    const docCode = pickString(s, 'doc_code');
    if (docType) params.doc_type = docType;
    if (docCode) params.doc_code = docCode;
  }

  return params;
}

export function resolveBankTransactionListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
): Record<string, string | number | boolean | undefined> {
  const s = searchFormValues ?? {};
  const fuzzyKeyword = pickString(s, 'keyword');
  const { sort_field, sort_order } = resolveFinanceSort(sort);
  const { date_start: transaction_date_start, date_end: transaction_date_end } = parseSalesReportDateRange(s, [
    'transaction_date_range',
    'transactionDateRange',
  ]);

  const params: Record<string, string | number | boolean | undefined> = {
    sort_field,
    sort_order,
    direction: pickString(s, 'direction'),
    transaction_date_start,
    transaction_date_end,
  };

  if (fuzzyKeyword) {
    params.keyword = fuzzyKeyword;
  } else {
    const sourceDocCode = pickString(s, 'source_doc_code');
    if (sourceDocCode) params.source_doc_code = sourceDocCode;
  }

  return params;
}
