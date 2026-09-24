/**
 * 实验委托 extension_payload（R-02 模板对齐字段）。
 * 按 business_type 显隐由 labRequestFieldVisibility 判定。
 */

import type { LabRequest } from '../services/lab-request';

export const LAB_REQUEST_EXTENSION_KEYS = [
  'delegate_dept',
  'test_dept',
  'inspection_slip_no',
  'structure_special_test',
  'electronics_special_test',
  'structure_manager_approved',
  'electronics_manager_approved',
  'customer_name',
  'supplier_name',
  'need_report',
  'need_feedback',
  'provide_sample',
  'sample_qty',
  'charge_required',
  'charge_amount',
  'payer',
  'outsource_cert_lines',
] as const;

export type LabRequestExtensionKey = (typeof LAB_REQUEST_EXTENSION_KEYS)[number];

export type LabRequestOutsourceCertLine = {
  cert_name?: string;
  fee?: number | string | null;
};

/** 中性付款方（禁止写客户公司名） */
export const LAB_REQUEST_PAYER_VALUES = ['company', 'supplier', 'customer'] as const;
export type LabRequestPayer = (typeof LAB_REQUEST_PAYER_VALUES)[number];

export type LabRequestFieldVisibility = {
  project: boolean;
  customerSupplier: boolean;
  reportFeedback: boolean;
  sampleQty: boolean;
  provideSample: boolean;
  charge: boolean;
  iqcSlip: boolean;
  structureElectronics: boolean;
  outsourceCert: boolean;
  payer: boolean;
};

export function resolveLabRequestFieldVisibility(
  businessType: string | null | undefined,
): LabRequestFieldVisibility {
  const bt = String(businessType || '')
    .trim()
    .toLowerCase();
  const isRd = bt === 'rd';
  const isProject = bt === 'project_material' || bt === 'project_product';
  const isOutsource = bt === 'outsource';
  const isIqc = bt === 'iqc';
  const isGeneral = bt === 'general' || !bt;

  return {
    project: isRd || isProject,
    customerSupplier: isRd || isProject || isOutsource,
    reportFeedback: isRd || isProject || isGeneral,
    sampleQty: isRd || isProject || isGeneral,
    provideSample: isRd || isProject || isGeneral,
    charge: isRd || isProject || isGeneral,
    iqcSlip: isIqc,
    structureElectronics: bt === 'project_product',
    outsourceCert: isOutsource,
    payer: isOutsource,
  };
}

export function flattenLabRequestForForm(
  row: LabRequest | null | undefined,
): Record<string, unknown> {
  if (!row) return {};
  const base: Record<string, unknown> = { ...row };
  const payload = row.extension_payload || {};
  for (const key of LAB_REQUEST_EXTENSION_KEYS) {
    if (base[key] === undefined && payload[key] !== undefined) {
      base[key] = payload[key];
    }
  }
  return base;
}

function isEmptyExtensionValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (typeof value === 'number') return !Number.isFinite(value);
  if (typeof value === 'boolean') return false;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

export function buildLabRequestExtensionPayload(
  values: Record<string, unknown>,
): Record<string, unknown> | null {
  const payload: Record<string, unknown> = {};
  for (const key of LAB_REQUEST_EXTENSION_KEYS) {
    const value = values[key];
    if (isEmptyExtensionValue(value)) continue;
    if (key === 'outsource_cert_lines' && Array.isArray(value)) {
      const lines = value
        .map((row) => {
          const r = (row || {}) as LabRequestOutsourceCertLine;
          const cert_name = String(r.cert_name ?? '').trim();
          const feeRaw = r.fee;
          const fee =
            feeRaw === undefined || feeRaw === null || feeRaw === ''
              ? undefined
              : Number(feeRaw);
          if (!cert_name && (fee == null || !Number.isFinite(fee))) return null;
          return {
            cert_name: cert_name || undefined,
            fee: fee != null && Number.isFinite(fee) ? fee : undefined,
          };
        })
        .filter(Boolean);
      if (lines.length) payload[key] = lines;
      continue;
    }
    if (typeof value === 'string') {
      payload[key] = value.trim();
    } else if (typeof value === 'boolean' || typeof value === 'number') {
      payload[key] = value;
    } else {
      payload[key] = value;
    }
  }
  return Object.keys(payload).length ? payload : null;
}

export function getLabRequestExtensionValue(
  row: LabRequest | Record<string, unknown> | null | undefined,
  key: LabRequestExtensionKey,
): unknown {
  if (!row) return undefined;
  const record = row as Record<string, unknown>;
  if (record[key] !== undefined && record[key] !== null && record[key] !== '') {
    return record[key];
  }
  const payload = record.extension_payload as Record<string, unknown> | undefined;
  return payload?.[key];
}

/** 提交前从 values 剔除 extension 键，避免误入头表未知字段 */
export function stripLabRequestExtensionFormValues(
  values: Record<string, unknown>,
): Record<string, unknown> {
  const rest: Record<string, unknown> = { ...values };
  for (const key of LAB_REQUEST_EXTENSION_KEYS) {
    delete rest[key];
  }
  delete rest._customer_id;
  delete rest._supplier_id;
  return rest;
}

export function formatLabRequestYesNo(
  value: unknown,
  yesLabel: string,
  noLabel: string,
): string {
  if (value === true || value === 'true' || value === '1' || value === 'yes') return yesLabel;
  if (value === false || value === 'false' || value === '0' || value === 'no') return noLabel;
  return '-';
}
