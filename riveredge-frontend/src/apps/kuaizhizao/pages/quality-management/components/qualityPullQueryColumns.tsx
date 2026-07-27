import React from 'react';
import type { TableColumnsType } from 'antd';
import { Tag } from 'antd';
import type { TFunction } from 'i18next';
import { MaterialStackedCell } from '../../../../../components/uni-table/stackedPrimaryColumn';
import { formatDateTimeBySiteSetting, formatQuantity } from '../../../../../utils/format';
import { translateLifecycleStageByKey } from '../../../../../utils/globalLifecycleI18n';
import {
  oqcInspectionCapabilityReasonMessage,
  qualityInspectionCapabilityReasonMessage,
} from '../../../../../hooks/useDocumentCapabilities';

export type QualityPullCandidateBase = {
  id: number;
  code?: string;
  status?: string | null;
  line_count?: number;
  pushable_line_count?: number;
  material_summary?: string | null;
  updated_at?: string | null;
};

type PullCapability = { allowed?: boolean; reason?: string };

function renderDash(value: unknown): string {
  const text = String(value ?? '').trim();
  return text || '—';
}

function renderDocStatus(t: TFunction, value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '—';
  return translateLifecycleStageByKey(t, raw, raw) || '—';
}

function renderPushableLines(
  t: TFunction,
  pushable?: number,
  total?: number,
): string {
  const push = Number(pushable ?? 0);
  const all = Number(total ?? 0);
  if (!Number.isFinite(all) || all <= 0) return '—';
  return t('app.kuaizhizao.quality.pullQuery.pushableLinesFormat', {
    pushable: push,
    total: all,
  });
}

function buildPullStatusColumn<T extends { capabilities?: Record<string, PullCapability> }>(
  t: TFunction,
  capabilityKey: string,
  reasonMessage: (reason: string | undefined, t: TFunction) => string | undefined,
): TableColumnsType<T>[number] {
  return {
    title: t('app.kuaizhizao.quality.pullQuery.pullStatus'),
    key: 'pull_status',
    width: 160,
    align: 'center',
    render: (_: unknown, record: T) => {
      const cap = record.capabilities?.[capabilityKey];
      if (cap?.allowed === true) {
        return <Tag color="success">{t('app.kuaizhizao.quality.pullQuery.canPull')}</Tag>;
      }
      return (
        <Tag color="gold">
          {reasonMessage(cap?.reason, t) || t('app.kuaizhizao.workOrder.tagCannotCreate')}
        </Tag>
      );
    },
  };
}

export function buildIncomingPurchaseReceiptPullColumns(t: TFunction): TableColumnsType<QualityPullCandidateBase & {
  receipt_code?: string;
  purchase_order_code?: string;
  supplier_name?: string;
  capabilities?: { pull_incoming_inspection?: PullCapability };
}> {
  return [
    {
      title: t('app.kuaizhizao.quality.pullQuery.receiptCode'),
      dataIndex: 'receipt_code',
      width: 160,
      ellipsis: true,
      render: (v: unknown) => renderDash(v),
    },
    {
      title: t('app.kuaizhizao.quality.pullQuery.purchaseOrder'),
      dataIndex: 'purchase_order_code',
      width: 150,
      ellipsis: true,
      render: (v: unknown) => renderDash(v),
    },
    {
      title: t('app.kuaizhizao.quality.pullQuery.supplier'),
      dataIndex: 'supplier_name',
      width: 160,
      ellipsis: true,
      render: (v: unknown) => renderDash(v),
    },
    {
      title: t('app.kuaizhizao.quality.pullQuery.material'),
      key: 'material_summary',
      width: 220,
      ellipsis: true,
      render: (_: unknown, r) => renderDash(r.material_summary),
    },
    {
      title: t('app.kuaizhizao.quality.pullQuery.pushableLines'),
      key: 'pushable_lines',
      width: 110,
      align: 'center',
      render: (_: unknown, r) => renderPushableLines(t, r.pushable_line_count, r.line_count),
    },
    {
      title: t('app.kuaizhizao.quality.pullQuery.docStatus'),
      dataIndex: 'status',
      width: 100,
      align: 'center',
      render: (v: unknown) => renderDocStatus(t, v),
    },
    {
      title: t('common.updatedAt'),
      dataIndex: 'updated_at',
      width: 168,
      render: (v: unknown) => (v ? formatDateTimeBySiteSetting(String(v)) : '—'),
    },
    buildPullStatusColumn(t, 'pull_incoming_inspection', qualityInspectionCapabilityReasonMessage),
  ];
}

export function buildIncomingCustomerMaterialPullColumns(t: TFunction): TableColumnsType<QualityPullCandidateBase & {
  registration_code?: string;
  customer_name?: string;
  sales_order_code?: string;
  work_order_code?: string;
  registration_date?: string | null;
  total_quantity?: number | null;
  capabilities?: { pull_incoming_inspection?: PullCapability };
}> {
  return [
    {
      title: t('app.kuaizhizao.quality.pullQuery.registrationCode'),
      dataIndex: 'registration_code',
      width: 160,
      ellipsis: true,
      render: (v: unknown) => renderDash(v),
    },
    {
      title: t('app.kuaizhizao.quality.pullQuery.customer'),
      dataIndex: 'customer_name',
      width: 140,
      ellipsis: true,
      render: (v: unknown) => renderDash(v),
    },
    {
      title: t('app.kuaizhizao.quality.pullQuery.material'),
      key: 'material_summary',
      width: 220,
      ellipsis: true,
      render: (_: unknown, r) => renderDash(r.material_summary),
    },
    {
      title: t('app.kuaizhizao.quality.pullQuery.totalQty'),
      dataIndex: 'total_quantity',
      width: 100,
      align: 'right',
      render: (v: unknown) => formatQuantity(v),
    },
    {
      title: t('app.kuaizhizao.quality.pullQuery.pushableLines'),
      key: 'pushable_lines',
      width: 110,
      align: 'center',
      render: (_: unknown, r) => renderPushableLines(t, r.pushable_line_count, r.line_count),
    },
    {
      title: t('app.kuaizhizao.quality.pullQuery.salesOrder'),
      dataIndex: 'sales_order_code',
      width: 140,
      ellipsis: true,
      render: (v: unknown) => renderDash(v),
    },
    {
      title: t('app.kuaizhizao.quality.pullQuery.relatedWorkOrder'),
      dataIndex: 'work_order_code',
      width: 140,
      ellipsis: true,
      render: (v: unknown) => renderDash(v),
    },
    {
      title: t('app.kuaizhizao.quality.pullQuery.registrationDate'),
      dataIndex: 'registration_date',
      width: 168,
      render: (v: unknown) => (v ? formatDateTimeBySiteSetting(String(v)) : '—'),
    },
    buildPullStatusColumn(t, 'pull_incoming_inspection', qualityInspectionCapabilityReasonMessage),
  ];
}

export function buildProcessWorkOrderPullColumns(t: TFunction): TableColumnsType<QualityPullCandidateBase & {
  work_order_code?: string;
  product_name?: string;
  material_code?: string;
  sales_order_code?: string;
  planned_quantity?: number | null;
  completed_quantity?: number | null;
  capabilities?: { pull_process_inspection?: PullCapability };
}> {
  return [
    {
      title: t('app.kuaizhizao.quality.pullQuery.workOrderCode'),
      dataIndex: 'work_order_code',
      width: 140,
      ellipsis: true,
      render: (v: unknown) => renderDash(v),
    },
    {
      title: t('app.kuaizhizao.quality.pullQuery.product'),
      key: 'product',
      width: 220,
      render: (_: unknown, r) => (
        <MaterialStackedCell
          material_name={r.product_name}
          material_code={r.material_code}
        />
      ),
    },
    {
      title: t('app.kuaizhizao.quality.pullQuery.salesOrder'),
      dataIndex: 'sales_order_code',
      width: 140,
      ellipsis: true,
      render: (v: unknown) => renderDash(v),
    },
    {
      title: t('app.kuaizhizao.quality.pullQuery.pushableLines'),
      key: 'pushable_lines',
      width: 110,
      align: 'center',
      render: (_: unknown, r) => renderPushableLines(t, r.pushable_line_count, r.line_count),
    },
    {
      title: t('app.kuaizhizao.quality.pullQuery.plannedQty'),
      dataIndex: 'planned_quantity',
      width: 100,
      align: 'right',
      render: (v: unknown) => formatQuantity(v),
    },
    {
      title: t('app.kuaizhizao.quality.pullQuery.completedQty'),
      dataIndex: 'completed_quantity',
      width: 100,
      align: 'right',
      render: (v: unknown) => formatQuantity(v),
    },
    {
      title: t('app.kuaizhizao.quality.pullQuery.docStatus'),
      dataIndex: 'status',
      width: 100,
      align: 'center',
      render: (v: unknown) => renderDocStatus(t, v),
    },
    {
      title: t('common.updatedAt'),
      dataIndex: 'updated_at',
      width: 168,
      render: (v: unknown) => (v ? formatDateTimeBySiteSetting(String(v)) : '—'),
    },
    buildPullStatusColumn(t, 'pull_process_inspection', qualityInspectionCapabilityReasonMessage),
  ];
}

export function buildFinishedWorkOrderPullColumns(t: TFunction): TableColumnsType<QualityPullCandidateBase & {
  work_order_code?: string;
  product_name?: string;
  material_code?: string;
  sales_order_code?: string;
  planned_quantity?: number | null;
  completed_quantity?: number | null;
  capabilities?: { pull_finished_goods_inspection?: PullCapability };
}> {
  return [
    {
      title: t('app.kuaizhizao.quality.pullQuery.workOrderCode'),
      dataIndex: 'work_order_code',
      width: 140,
      ellipsis: true,
      render: (v: unknown) => renderDash(v),
    },
    {
      title: t('app.kuaizhizao.quality.pullQuery.product'),
      key: 'product',
      width: 220,
      render: (_: unknown, r) => (
        <MaterialStackedCell
          material_name={r.product_name}
          material_code={r.material_code}
        />
      ),
    },
    {
      title: t('app.kuaizhizao.quality.pullQuery.salesOrder'),
      dataIndex: 'sales_order_code',
      width: 140,
      ellipsis: true,
      render: (v: unknown) => renderDash(v),
    },
    {
      title: t('app.kuaizhizao.quality.pullQuery.pushableLines'),
      key: 'pushable_lines',
      width: 110,
      align: 'center',
      render: (_: unknown, r) => renderPushableLines(t, r.pushable_line_count, r.line_count),
    },
    {
      title: t('app.kuaizhizao.quality.pullQuery.plannedQty'),
      dataIndex: 'planned_quantity',
      width: 100,
      align: 'right',
      render: (v: unknown) => formatQuantity(v),
    },
    {
      title: t('app.kuaizhizao.quality.pullQuery.completedQty'),
      dataIndex: 'completed_quantity',
      width: 100,
      align: 'right',
      render: (v: unknown) => formatQuantity(v),
    },
    {
      title: t('app.kuaizhizao.quality.pullQuery.docStatus'),
      dataIndex: 'status',
      width: 100,
      align: 'center',
      render: (v: unknown) => renderDocStatus(t, v),
    },
    {
      title: t('common.updatedAt'),
      dataIndex: 'updated_at',
      width: 168,
      render: (v: unknown) => (v ? formatDateTimeBySiteSetting(String(v)) : '—'),
    },
    buildPullStatusColumn(t, 'pull_finished_goods_inspection', qualityInspectionCapabilityReasonMessage),
  ];
}

export function buildOqcShipmentNoticePullColumns(t: TFunction): TableColumnsType<QualityPullCandidateBase & {
  notice_code?: string;
  customer_name?: string;
  capabilities?: { pull_oqc_inspection?: PullCapability };
}> {
  return [
    {
      title: t('app.kuaizhizao.quality.pullQuery.shipmentNoticeCode'),
      dataIndex: 'notice_code',
      width: 160,
      ellipsis: true,
      render: (v: unknown) => renderDash(v),
    },
    {
      title: t('app.kuaizhizao.quality.pullQuery.customer'),
      dataIndex: 'customer_name',
      width: 160,
      ellipsis: true,
      render: (v: unknown) => renderDash(v),
    },
    {
      title: t('app.kuaizhizao.quality.pullQuery.material'),
      key: 'material_summary',
      width: 220,
      ellipsis: true,
      render: (_: unknown, r) => renderDash(r.material_summary),
    },
    {
      title: t('app.kuaizhizao.quality.pullQuery.pushableLines'),
      key: 'pushable_lines',
      width: 110,
      align: 'center',
      render: (_: unknown, r) => renderPushableLines(t, r.pushable_line_count, r.line_count),
    },
    {
      title: t('app.kuaizhizao.quality.pullQuery.docStatus'),
      dataIndex: 'status',
      width: 100,
      align: 'center',
      render: (v: unknown) => renderDocStatus(t, v),
    },
    {
      title: t('common.updatedAt'),
      dataIndex: 'updated_at',
      width: 168,
      render: (v: unknown) => (v ? formatDateTimeBySiteSetting(String(v)) : '—'),
    },
    buildPullStatusColumn(t, 'pull_oqc_inspection', oqcInspectionCapabilityReasonMessage),
  ];
}

export function buildOqcSalesDeliveryPullColumns(t: TFunction): TableColumnsType<QualityPullCandidateBase & {
  delivery_code?: string;
  customer_name?: string;
  capabilities?: { pull_oqc_inspection?: PullCapability };
}> {
  return [
    {
      title: t('app.kuaizhizao.quality.pullQuery.salesDeliveryCode'),
      dataIndex: 'delivery_code',
      width: 160,
      ellipsis: true,
      render: (v: unknown) => renderDash(v),
    },
    {
      title: t('app.kuaizhizao.quality.pullQuery.customer'),
      dataIndex: 'customer_name',
      width: 160,
      ellipsis: true,
      render: (v: unknown) => renderDash(v),
    },
    {
      title: t('app.kuaizhizao.quality.pullQuery.material'),
      key: 'material_summary',
      width: 220,
      ellipsis: true,
      render: (_: unknown, r) => renderDash(r.material_summary),
    },
    {
      title: t('app.kuaizhizao.quality.pullQuery.pushableLines'),
      key: 'pushable_lines',
      width: 110,
      align: 'center',
      render: (_: unknown, r) => renderPushableLines(t, r.pushable_line_count, r.line_count),
    },
    {
      title: t('app.kuaizhizao.quality.pullQuery.docStatus'),
      dataIndex: 'status',
      width: 100,
      align: 'center',
      render: (v: unknown) => renderDocStatus(t, v),
    },
    {
      title: t('common.updatedAt'),
      dataIndex: 'updated_at',
      width: 168,
      render: (v: unknown) => (v ? formatDateTimeBySiteSetting(String(v)) : '—'),
    },
    buildPullStatusColumn(t, 'pull_oqc_inspection', oqcInspectionCapabilityReasonMessage),
  ];
}
