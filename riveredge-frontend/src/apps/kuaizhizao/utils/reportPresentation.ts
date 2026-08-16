import type { TFunction } from 'i18next';

/** 报表 valueEnum：只有汉字，不要 status 彩点 */
export function reportTextEnum(entries: Record<string, string>): Record<string, { text: string }> {
  return Object.fromEntries(Object.entries(entries).map(([key, text]) => [key, { text }]));
}

export function reportPercent(value: unknown, digits = 1): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  const rounded = Number(n.toFixed(digits));
  return `${Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(digits)}%`;
}

export function reportOverdueText(
  t: TFunction,
  isOverdue: boolean,
  overdueDays?: number,
): string {
  if (!isOverdue) return t('app.kuaizhizao.reports.overdueNo');
  const days = Number(overdueDays);
  if (Number.isFinite(days) && days > 0) {
    return t('app.kuaizhizao.reports.overdueDays', { days });
  }
  return t('app.kuaizhizao.reports.overdueYes');
}

/** 后端单据状态码 / 中文别名 → documentStatus.*（唯一文案源，禁止再自建残缺 map） */
const DOCUMENT_STATUS_I18N_KEYS: Record<string, string> = {
  DRAFT: 'documentStatus.draft',
  PENDING_REVIEW: 'documentStatus.pending_review',
  PENDING: 'documentStatus.pending',
  SUBMITTED: 'documentStatus.submitted',
  AUDITED: 'documentStatus.audited',
  APPROVED: 'documentStatus.approved',
  REJECTED: 'documentStatus.rejected',
  CONFIRMED: 'documentStatus.confirmed',
  EFFECTIVE: 'documentStatus.effective',
  CANCELLED: 'documentStatus.cancelled',
  CANCELED: 'documentStatus.cancelled',
  CLOSED: 'documentStatus.closed',
  COMPLETED: 'documentStatus.completed',
  FINISHED: 'documentStatus.completed',
  RELEASED: 'documentStatus.released',
  IN_PROGRESS: 'documentStatus.in_progress',
  DELIVERED: 'documentStatus.delivered',
  SPLIT: 'documentStatus.split',
  PARTIAL_CONVERTED: 'documentStatus.partial_converted',
  FULL_CONVERTED: 'documentStatus.full_converted',
  EXPIRED: 'app.kuaizhizao.salesContract.statusExpired',
  草稿: 'documentStatus.draft',
  待审核: 'documentStatus.pending_review',
  已提交: 'documentStatus.submitted',
  已审核: 'documentStatus.audited',
  已通过: 'documentStatus.approved',
  审核通过: 'documentStatus.approved',
  已驳回: 'documentStatus.rejected',
  已确认: 'documentStatus.confirmed',
  已生效: 'documentStatus.effective',
  已取消: 'documentStatus.cancelled',
  已关闭: 'documentStatus.closed',
  已完成: 'documentStatus.completed',
  已下达: 'documentStatus.released',
  执行中: 'documentStatus.in_progress',
  进行中: 'documentStatus.in_progress',
  已交货: 'documentStatus.delivered',
  已拆分: 'documentStatus.split',
  部分转单: 'documentStatus.partial_converted',
  全部转单: 'documentStatus.full_converted',
  已到期: 'app.kuaizhizao.salesContract.statusExpired',
  待出库: 'app.kuaizhizao.reports.deliveryStatusPending',
  已出库: 'app.kuaizhizao.reports.deliveryStatusDone',
  待退货: 'app.kuaizhizao.reports.returnStatusPending',
  已退货: 'app.kuaizhizao.reports.returnStatusDone',
  待交货: 'app.kuaizhizao.reports.itemDeliveryPending',
  部分交货: 'app.kuaizhizao.reports.itemDeliveryPartial',
  已交货: 'app.kuaizhizao.reports.itemDeliveryDone',
};

const REVIEW_STATUS_I18N_KEYS: Record<string, string> = {
  PENDING: 'reviewStatus.pending',
  APPROVED: 'reviewStatus.approved',
  REJECTED: 'reviewStatus.rejected',
  待审核: 'reviewStatus.pending',
  审核通过: 'reviewStatus.approved',
  已通过: 'reviewStatus.approved',
  已审核: 'reviewStatus.approved',
  审核驳回: 'reviewStatus.rejected',
  驳回: 'reviewStatus.rejected',
  已驳回: 'reviewStatus.rejected',
};

function lookupStatusKey(
  raw: string,
  table: Record<string, string>,
): string | undefined {
  if (table[raw]) return table[raw];
  const upper = raw.toUpperCase().replace(/[\s-]+/g, '_');
  if (table[upper]) return table[upper];
  const lower = raw.toLowerCase();
  if (table[lower]) return table[lower];
  return undefined;
}

function reportI18nOrRaw(t: TFunction, key: string, raw: string): string {
  const text = t(key);
  return text === key ? raw : text;
}

export function reportDocumentStatusText(t: TFunction, value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '-';
  const mapped = lookupStatusKey(raw, DOCUMENT_STATUS_I18N_KEYS);
  if (mapped) return reportI18nOrRaw(t, mapped, raw);
  const snake = raw.toLowerCase().replace(/[\s-]+/g, '_');
  return reportI18nOrRaw(t, `documentStatus.${snake}`, raw);
}

export function reportReviewStatusText(t: TFunction, value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '-';
  const mapped = lookupStatusKey(raw, REVIEW_STATUS_I18N_KEYS);
  if (mapped) return reportI18nOrRaw(t, mapped, raw);
  return raw;
}

/** 筛选 valueEnum：每个状态只出一次，码与后端 DemandStatus / ReviewStatus 对齐 */
const SALES_ORDER_STATUS_FILTER_CODES = [
  'DRAFT',
  'PENDING_REVIEW',
  'AUDITED',
  'REJECTED',
  'CONFIRMED',
  'CLOSED',
  'CANCELLED',
  'COMPLETED',
] as const;

const REVIEW_STATUS_FILTER_CODES = ['PENDING', 'APPROVED', 'REJECTED'] as const;

function documentStatusLabel(t: TFunction, code: string): string {
  return t(`documentStatus.${code.toLowerCase()}`);
}

export function salesOrderStatusEnum(t: TFunction) {
  return reportTextEnum(
    Object.fromEntries(
      SALES_ORDER_STATUS_FILTER_CODES.map((code) => [code, documentStatusLabel(t, code)]),
    ),
  );
}

const PURCHASE_REQUISITION_STATUS_FILTER_CODES = [
  'DRAFT',
  'PENDING_REVIEW',
  'REJECTED',
  'APPROVED',
  'PARTIAL_CONVERTED',
  'FULL_CONVERTED',
] as const;

export function purchaseRequisitionStatusEnum(t: TFunction) {
  return reportTextEnum(
    Object.fromEntries(
      PURCHASE_REQUISITION_STATUS_FILTER_CODES.map((code) => [code, documentStatusLabel(t, code)]),
    ),
  );
}

export const purchaseOrderStatusEnum = salesOrderStatusEnum;

const WORK_ORDER_STATUS_FILTER_CODES = [
  'draft',
  'released',
  'in_progress',
  'completed',
  'cancelled',
  'split',
] as const;

export function workOrderStatusEnum(t: TFunction) {
  return reportTextEnum(
    Object.fromEntries(
      WORK_ORDER_STATUS_FILTER_CODES.map((code) => [code, documentStatusLabel(t, code)]),
    ),
  );
}

const OUTSOURCE_WORK_ORDER_STATUS_FILTER_CODES = [
  'draft',
  'released',
  'in_progress',
  'completed',
  'cancelled',
] as const;

export function outsourceWorkOrderStatusEnum(t: TFunction) {
  return reportTextEnum(
    Object.fromEntries(
      OUTSOURCE_WORK_ORDER_STATUS_FILTER_CODES.map((code) => [code, documentStatusLabel(t, code)]),
    ),
  );
}

const PRODUCTION_DELAY_STATUS_FILTER_CODES = ['released', 'in_progress'] as const;

export function productionDelayStatusEnum(t: TFunction) {
  return reportTextEnum(
    Object.fromEntries(
      PRODUCTION_DELAY_STATUS_FILTER_CODES.map((code) => [code, documentStatusLabel(t, code)]),
    ),
  );
}

const OUTSOURCE_MATERIAL_ISSUE_STATUS_FILTER_CODES = ['draft', 'completed', 'cancelled'] as const;

export function outsourceMaterialIssueStatusEnum(t: TFunction) {
  return reportTextEnum(
    Object.fromEntries(
      OUTSOURCE_MATERIAL_ISSUE_STATUS_FILTER_CODES.map((code) => [code, documentStatusLabel(t, code)]),
    ),
  );
}

export function salesReviewStatusEnum(t: TFunction) {
  return reportTextEnum(
    Object.fromEntries(
      REVIEW_STATUS_FILTER_CODES.map((code) => [code, t(`reviewStatus.${code.toLowerCase()}`)]),
    ),
  );
}

export function quotationStatusEnum(t: TFunction) {
  return reportTextEnum({
    DRAFT: t('app.kuaizhizao.quotation.statusFilter.draft'),
    SENT: t('app.kuaizhizao.quotation.statusFilter.sent'),
    ACCEPTED: t('app.kuaizhizao.quotation.statusFilter.accepted'),
    REJECTED: t('app.kuaizhizao.quotation.statusFilter.rejected'),
    EXPIRED: t('app.kuaizhizao.reports.quotationStatusExpired'),
    CONVERTED: t('app.kuaizhizao.quotation.statusFilter.converted'),
  });
}

export function reportQuotationStatusText(t: TFunction, value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '-';
  const enumMap = quotationStatusEnum(t);
  if (enumMap[raw]?.text) return enumMap[raw].text;
  const upper = raw.toUpperCase();
  if (enumMap[upper]?.text) return enumMap[upper].text;
  return reportDocumentStatusText(t, raw);
}

export function salesBillTypeEnum(t: TFunction) {
  return reportTextEnum({
    SALES_ORDER: t('app.kuaizhizao.reports.billTypeSalesOrder'),
    SALES_DELIVERY: t('app.kuaizhizao.reports.billTypeSalesDelivery'),
    SALES_RETURN: t('app.kuaizhizao.reports.billTypeSalesReturn'),
  });
}

export function demandTypeEnum(t: TFunction) {
  return reportTextEnum({
    sales_forecast: t('app.kuaizhizao.reports.demandType.sales_forecast'),
    sales_order: t('app.kuaizhizao.reports.demandType.sales_order'),
  });
}

export function reportDemandTypeText(t: TFunction, value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '-';
  const enumMap = demandTypeEnum(t);
  return enumMap[raw]?.text ?? raw;
}

export function inventoryAlertStatusEnum(t: TFunction) {
  return reportTextEnum({
    pending: t('app.kuaizhizao.reports.alertStatus.pending'),
    processing: t('app.kuaizhizao.reports.alertStatus.processing'),
    resolved: t('app.kuaizhizao.reports.alertStatus.resolved'),
    ignored: t('app.kuaizhizao.reports.alertStatus.ignored'),
  });
}

export function reportInventoryAlertStatusText(t: TFunction, value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '-';
  const enumMap = inventoryAlertStatusEnum(t);
  return enumMap[raw]?.text ?? raw;
}

export function inventoryAlertLevelEnum(t: TFunction) {
  return reportTextEnum({
    info: t('app.kuaizhizao.reports.alertLevel.info'),
    warning: t('app.kuaizhizao.reports.alertLevel.warning'),
    critical: t('app.kuaizhizao.reports.alertLevel.critical'),
  });
}

export function reportInventoryAlertLevelText(t: TFunction, value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '-';
  const enumMap = inventoryAlertLevelEnum(t);
  return enumMap[raw]?.text ?? raw;
}
