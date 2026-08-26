import type { TFunction } from 'i18next';
import type { ExportXlsxColumn } from '../../../../../utils/exportRecordsXlsx';
import { formatDateTimeBySiteSetting, formatQuantity } from '../../../../../utils/format';
import {
  getQualityDocStatusText,
  getQualityQualityStatusText,
  getQualityReleaseDecisionText,
  getQualityResultText,
} from './qualityMeta';

function str(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

function qty(value: unknown): string {
  if (value == null || value === '') return '';
  return formatQuantity(value);
}

function dt(value: unknown): string {
  if (value == null || value === '') return '';
  return formatDateTimeBySiteSetting(String(value));
}

function boolZh(value: unknown): string {
  if (value === true) return '是';
  if (value === false) return '否';
  return '';
}

function baseInspectionExportRow(
  t: TFunction,
  row: Record<string, unknown>,
): Record<string, unknown> {
  return {
    inspection_code: str(row.inspection_code ?? row.inspectionCode),
    material_code: str(row.material_code ?? row.materialCode),
    material_name: str(row.material_name ?? row.materialName),
    material_spec: str(row.material_spec ?? row.materialSpec),
    batch_number: str(row.batch_number ?? row.batchNumber),
    inspection_quantity: qty(row.inspection_quantity ?? row.inspectionQuantity),
    qualified_quantity: qty(row.qualified_quantity ?? row.qualifiedQuantity),
    unqualified_quantity: qty(row.unqualified_quantity ?? row.unqualifiedQuantity),
    inspection_result: getQualityResultText(t, str(row.inspection_result ?? row.inspectionResult) || null),
    quality_status: getQualityQualityStatusText(t, str(row.quality_status ?? row.qualityStatus) || null),
    inspector_name: str(row.inspector_name ?? row.inspectorName),
    inspection_time: dt(row.inspection_time ?? row.inspectionTime),
    status: getQualityDocStatusText(t, str(row.status) || null),
    notes: str(row.notes),
  };
}

export function mapIncomingInspectionExportRows(
  t: TFunction,
  rows: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  return rows.map((row) => ({
    ...baseInspectionExportRow(t, row),
    purchase_receipt_code: str(row.purchase_receipt_code ?? row.purchaseReceiptCode),
    supplier_name: str(row.supplier_name ?? row.supplierName),
    reviewer_name: str(row.reviewer_name ?? row.reviewerName),
    review_time: dt(row.review_time ?? row.reviewTime),
  }));
}

export function buildIncomingInspectionExportColumns(t: TFunction): ExportXlsxColumn[] {
  return [
    { key: 'inspection_code', title: t('app.kuaizhizao.quality.common.columns.inspectionCode') },
    { key: 'purchase_receipt_code', title: t('app.kuaizhizao.quality.common.columns.purchaseReceiptCode') },
    { key: 'supplier_name', title: t('app.kuaizhizao.quality.common.columns.supplier') },
    { key: 'material_code', title: t('app.kuaizhizao.quality.common.columns.materialCode') },
    { key: 'material_name', title: t('app.kuaizhizao.quality.common.columns.materialName') },
    { key: 'inspection_quantity', title: t('app.kuaizhizao.quality.common.columns.inspectionQty') },
    { key: 'qualified_quantity', title: t('app.kuaizhizao.quality.common.columns.qualifiedQty') },
    { key: 'unqualified_quantity', title: t('app.kuaizhizao.quality.common.columns.unqualifiedQty') },
    { key: 'inspection_result', title: t('app.kuaizhizao.quality.common.columns.inspectionResult') },
    { key: 'quality_status', title: t('app.kuaizhizao.quality.common.columns.qualityStatus') },
    { key: 'inspector_name', title: t('app.kuaizhizao.quality.common.columns.inspector') },
    { key: 'inspection_time', title: t('app.kuaizhizao.quality.common.columns.inspectionTime') },
    { key: 'reviewer_name', title: t('app.kuaizhizao.quality.common.columns.reviewer') },
    { key: 'review_time', title: t('app.kuaizhizao.quality.common.columns.reviewTime') },
    { key: 'status', title: t('common.status') },
    { key: 'notes', title: t('common.remark') },
  ];
}

export function mapProcessInspectionExportRows(
  t: TFunction,
  rows: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  return rows.map((row) => ({
    ...baseInspectionExportRow(t, row),
    work_order_code: str(row.work_order_code ?? row.workOrderCode),
    operation_name: str(row.operation_name ?? row.operationName),
  }));
}

export function buildProcessInspectionExportColumns(t: TFunction): ExportXlsxColumn[] {
  return [
    { key: 'inspection_code', title: t('app.kuaizhizao.quality.common.columns.inspectionCode') },
    { key: 'work_order_code', title: t('app.kuaizhizao.quality.common.columns.workOrderCode') },
    { key: 'operation_name', title: t('app.kuaizhizao.quality.common.columns.operationName') },
    { key: 'material_code', title: t('app.kuaizhizao.quality.common.columns.materialCode') },
    { key: 'material_name', title: t('app.kuaizhizao.quality.common.columns.materialName') },
    { key: 'inspection_quantity', title: t('app.kuaizhizao.quality.common.columns.inspectionQty') },
    { key: 'qualified_quantity', title: t('app.kuaizhizao.quality.common.columns.qualifiedQty') },
    { key: 'unqualified_quantity', title: t('app.kuaizhizao.quality.common.columns.unqualifiedQty') },
    { key: 'inspection_result', title: t('app.kuaizhizao.quality.common.columns.inspectionResult') },
    { key: 'quality_status', title: t('app.kuaizhizao.quality.common.columns.qualityStatus') },
    { key: 'inspector_name', title: t('app.kuaizhizao.quality.common.columns.inspector') },
    { key: 'inspection_time', title: t('app.kuaizhizao.quality.common.columns.inspectionTime') },
    { key: 'status', title: t('common.status') },
    { key: 'notes', title: t('common.remark') },
  ];
}

export function mapFinishedGoodsInspectionExportRows(
  t: TFunction,
  rows: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  return rows.map((row) => ({
    ...baseInspectionExportRow(t, row),
    work_order_code: str(row.work_order_code ?? row.workOrderCode),
    sales_order_code: str(row.sales_order_code ?? row.salesOrderCode),
    customer_name: str(row.customer_name ?? row.customerName),
  }));
}

export function buildFinishedGoodsInspectionExportColumns(t: TFunction): ExportXlsxColumn[] {
  return [
    { key: 'inspection_code', title: t('app.kuaizhizao.quality.common.columns.inspectionCode') },
    { key: 'work_order_code', title: t('app.kuaizhizao.quality.common.columns.workOrderCode') },
    { key: 'material_code', title: t('app.kuaizhizao.quality.common.columns.materialCode') },
    { key: 'material_name', title: t('app.kuaizhizao.quality.common.columns.materialName') },
    { key: 'material_spec', title: t('app.kuaizhizao.quality.common.columns.materialSpec') },
    { key: 'batch_number', title: t('app.kuaizhizao.quality.common.columns.batchNo') },
    { key: 'sales_order_code', title: t('app.kuaizhizao.quality.common.columns.salesOrderCode') },
    { key: 'customer_name', title: t('app.kuaizhizao.quality.common.columns.customer') },
    { key: 'inspection_quantity', title: t('app.kuaizhizao.quality.common.columns.inspectionQty') },
    { key: 'qualified_quantity', title: t('app.kuaizhizao.quality.common.columns.qualifiedQty') },
    { key: 'unqualified_quantity', title: t('app.kuaizhizao.quality.common.columns.unqualifiedQty') },
    { key: 'inspection_result', title: t('app.kuaizhizao.quality.common.columns.inspectionResult') },
    { key: 'quality_status', title: t('app.kuaizhizao.quality.common.columns.qualityStatus') },
    { key: 'inspector_name', title: t('app.kuaizhizao.quality.common.columns.inspector') },
    { key: 'inspection_time', title: t('app.kuaizhizao.quality.common.columns.inspectionTime') },
    { key: 'status', title: t('common.status') },
    { key: 'notes', title: t('common.remark') },
  ];
}

export function mapOqcInspectionExportRows(
  t: TFunction,
  rows: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  return rows.map((row) => ({
    ...baseInspectionExportRow(t, row),
    customer_name: str(row.customer_name ?? row.customerName),
    shipment_notice_code: str(row.shipment_notice_code ?? row.shipmentNoticeCode),
    sales_delivery_code: str(row.sales_delivery_code ?? row.salesDeliveryCode),
    release_decision: getQualityReleaseDecisionText(
      t,
      str(row.release_decision ?? row.releaseDecision) || null,
    ),
    certificate: boolZh(row.certificate),
  }));
}

export function buildOqcInspectionExportColumns(t: TFunction): ExportXlsxColumn[] {
  return [
    { key: 'inspection_code', title: t('app.kuaizhizao.quality.common.columns.inspectionCode') },
    { key: 'customer_name', title: t('app.kuaizhizao.quality.common.columns.customer') },
    { key: 'shipment_notice_code', title: t('app.kuaizhizao.quality.pullQuery.shipmentNoticeCode') },
    { key: 'sales_delivery_code', title: t('app.kuaizhizao.quality.pullQuery.salesDeliveryCode') },
    { key: 'material_code', title: t('app.kuaizhizao.quality.common.columns.materialCode') },
    { key: 'material_name', title: t('app.kuaizhizao.quality.common.columns.materialName') },
    { key: 'inspection_quantity', title: t('app.kuaizhizao.quality.common.columns.inspectionQty') },
    { key: 'qualified_quantity', title: t('app.kuaizhizao.quality.common.columns.qualifiedQty') },
    { key: 'unqualified_quantity', title: t('app.kuaizhizao.quality.common.columns.unqualifiedQty') },
    { key: 'inspection_result', title: t('app.kuaizhizao.quality.common.columns.inspectionResult') },
    { key: 'quality_status', title: t('app.kuaizhizao.quality.common.columns.qualityStatus') },
    { key: 'release_decision', title: t('app.kuaizhizao.quality.oqc.columns.releaseDecision') },
    { key: 'certificate', title: t('app.kuaizhizao.quality.common.columns.hasCertificate') },
    { key: 'inspector_name', title: t('app.kuaizhizao.quality.common.columns.inspector') },
    { key: 'inspection_time', title: t('app.kuaizhizao.quality.common.columns.inspectionTime') },
    { key: 'status', title: t('common.status') },
    { key: 'notes', title: t('common.remark') },
  ];
}
