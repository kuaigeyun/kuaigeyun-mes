import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Descriptions, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { ProDescriptionsItemProps } from '@ant-design/pro-components';
import type { TFunction } from 'i18next';
import {
  DetailDrawerTemplate,
  DRAWER_CONFIG,
  useDetailDrawerDescriptionItems,
  WAREHOUSE_DETAIL_TABLE_STYLES,
} from '../../../../../components/layout-templates';
import { UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { batchingOrderApi } from '../../../services/batching-order';
import {
  outsourceMaterialIssueApi,
  outsourceMaterialReceiptApi,
  outsourceMaterialReturnApi,
  outsourceProductReturnApi,
} from '../../../services/production';
import { warehouseApi } from '../../../services/warehouse-execution';
import { formatDateTime, formatQuantity } from '../../../../../utils/format';
import { renderDocumentStatusTag } from '../../../../../utils/documentLifecycleStatusTag';
import { getBatchingOrderLifecycle, getBatchingOrderStageName } from '../../../utils/batchingOrderLifecycle';

export type MaterialCenterDetailKind =
  | 'batching_order'
  | 'material_call'
  | 'backflush_record'
  | 'outsource_issue'
  | 'outsource_receipt'
  | 'outsource_material_return'
  | 'outsource_product_return';

export type MaterialCenterDetailRequest = {
  kind: MaterialCenterDetailKind;
  id: number;
};

export async function loadMaterialCenterDetail(request: MaterialCenterDetailRequest): Promise<Record<string, unknown>> {
  const id = String(request.id);
  switch (request.kind) {
    case 'batching_order':
      return (await batchingOrderApi.get(id)) as Record<string, unknown>;
    case 'material_call':
      return (await warehouseApi.materialCall.get(request.id)) as Record<string, unknown>;
    case 'backflush_record':
      return (await warehouseApi.backflushRecords.get(id)) as Record<string, unknown>;
    case 'outsource_issue':
      return (await outsourceMaterialIssueApi.get(id)) as Record<string, unknown>;
    case 'outsource_receipt':
      return (await outsourceMaterialReceiptApi.get(id)) as Record<string, unknown>;
    case 'outsource_material_return':
      return (await outsourceMaterialReturnApi.get(id)) as Record<string, unknown>;
    case 'outsource_product_return':
      return (await outsourceProductReturnApi.get(id)) as Record<string, unknown>;
  }
}

function resolveOutsourceStatusLabel(t: TFunction, status?: string): string {
  if (status === 'draft') return t('app.kuaizhizao.warehouseCommon.statusDraft');
  if (status === 'completed') return t('app.kuaizhizao.warehouseCommon.statusCompleted');
  return status || '-';
}

function resolveMaterialCallStatusLabel(t: TFunction, status?: string): string {
  const st = String(status ?? '').trim();
  const map: Record<string, string> = {
    pending: t('app.kuaizhizao.warehouseCommon.statusPending'),
    processing: t('app.kuaizhizao.warehouseCommon.statusPicking'),
    partial: t('app.kuaizhizao.warehouseCommon.statusPartial'),
    completed: t('app.kuaizhizao.warehouseCommon.statusCompleted'),
    cancelled: t('app.kuaizhizao.warehouseCommon.statusCancelled'),
    picking: t('app.kuaizhizao.warehouseCommon.statusPicking'),
  };
  return map[st] ?? (st || '-');
}

function resolveBackflushStatusLabel(t: TFunction, status?: string): string {
  const st = String(status ?? '').trim();
  if (st === 'failed') return t('app.kuaizhizao.warehouseCommon.statusBackflushFailed');
  if (st === 'success') return t('app.kuaizhizao.warehouseCommon.statusBackflushSuccess');
  return st || '-';
}

function resolveDetailTitle(t: TFunction, kind: MaterialCenterDetailKind, detail: Record<string, unknown>): string {
  const code = String(detail.code ?? detail.doc_code ?? detail.return_code ?? '').trim();
  const suffix = code ? ` - ${code}` : '';
  switch (kind) {
    case 'batching_order':
      return `${t('app.kuaizhizao.batchingCenter.detailTitle')}${suffix}`;
    case 'material_call':
      return `${t('app.kuaizhizao.batchingCenter.detailTitleMaterialCall')}${suffix}`;
    case 'backflush_record':
      return `${t('app.kuaizhizao.batchingCenter.detailTitleBackflush')}${suffix}`;
    case 'outsource_issue':
      return `${t('app.kuaizhizao.batchingCenter.detailTitleOutsourceIssue')}${suffix}`;
    case 'outsource_receipt':
      return `${t('app.kuaizhizao.batchingCenter.detailTitleOutsourceReceipt')}${suffix}`;
    case 'outsource_material_return':
      return `${t('app.kuaizhizao.batchingCenter.detailTitleOutsourceMaterialReturn')}${suffix}`;
    case 'outsource_product_return':
      return `${t('app.kuaizhizao.batchingCenter.detailTitleOutsourceProductReturn')}${suffix}`;
  }
}

function buildBasicColumns(
  t: TFunction,
  kind: MaterialCenterDetailKind,
): ProDescriptionsItemProps<Record<string, unknown>>[] {
  switch (kind) {
    case 'batching_order':
      return [
        { title: t('app.kuaizhizao.batchingCenter.batchingCode'), dataIndex: 'code' },
        { title: t('app.kuaizhizao.warehouseCommon.colWarehouse'), dataIndex: 'warehouse_name' },
        { title: t('app.kuaizhizao.warehouseCommon.colWorkOrder'), dataIndex: 'work_order_code' },
        { title: t('app.kuaizhizao.batchingCenter.batchingDate'), dataIndex: 'batching_date', render: (_, r) => formatDateTime(r.batching_date) },
        {
          title: t('common.status'),
          dataIndex: 'status',
          render: (_, r) =>
            renderDocumentStatusTag(getBatchingOrderStageName(String(r.status ?? '')), String(r.status ?? '')),
        },
        { title: t('app.kuaizhizao.warehouseCommon.colMaterialKindCount'), dataIndex: 'total_items' },
        { title: t('app.kuaizhizao.warehouseCommon.colTargetLineSideWarehouse'), dataIndex: 'target_warehouse_name' },
        { title: t('common.remark'), dataIndex: 'remarks', span: 2 },
        { title: t('app.kuaizhizao.warehouseCommon.colExecutor'), dataIndex: 'executed_by_name' },
        { title: t('app.kuaizhizao.warehouseCommon.colExecutedAt'), dataIndex: 'executed_at', render: (_, r) => formatDateTime(r.executed_at) },
      ];
    case 'material_call':
      return [
        { title: t('app.kuaizhizao.warehouseCommon.colCode'), dataIndex: 'code' },
        { title: t('app.kuaizhizao.warehouseCommon.colWorkOrder'), dataIndex: 'work_order_code' },
        {
          title: t('common.status'),
          dataIndex: 'status',
          render: (_, r) =>
            renderDocumentStatusTag(resolveMaterialCallStatusLabel(t, String(r.status ?? '')), String(r.status ?? '')),
        },
        { title: t('app.kuaizhizao.batchingCenter.colCaller'), dataIndex: 'caller_name' },
        { title: t('app.kuaizhizao.batchingCenter.colHandler'), dataIndex: 'handler_name' },
        { title: t('app.kuaizhizao.warehouseCommon.colNeededAt'), dataIndex: 'needed_at', render: (_, r) => formatDateTime(r.needed_at) },
        { title: t('app.kuaizhizao.warehouseCommon.colPriority'), dataIndex: 'priority' },
        { title: t('common.remark'), dataIndex: 'remarks', span: 2 },
        { title: t('app.kuaizhizao.batchingCenter.colCompletedAt'), dataIndex: 'completed_at', render: (_, r) => formatDateTime(r.completed_at) },
      ];
    case 'backflush_record':
      return [
        { title: t('app.kuaizhizao.backflushRecords.colWorkOrderCode'), dataIndex: 'work_order_code' },
        { title: t('app.kuaizhizao.backflushRecords.colOperationCode'), dataIndex: 'operation_code' },
        {
          title: t('app.kuaizhizao.warehouseCommon.colMaterial'),
          key: 'material',
          render: (_, r) => `${String(r.material_code ?? '')} ${String(r.material_name ?? '')}`.trim() || '-',
        },
        {
          title: t('common.status'),
          dataIndex: 'status',
          render: (_, r) =>
            renderDocumentStatusTag(resolveBackflushStatusLabel(t, String(r.status ?? '')), String(r.status ?? '')),
        },
        { title: t('app.kuaizhizao.batchInventoryQuery.colBatchNo'), dataIndex: 'batch_no' },
        { title: t('app.kuaizhizao.backflushRecords.colReportQty'), dataIndex: 'report_quantity', render: formatQuantity },
        { title: t('app.kuaizhizao.backflushRecords.colBomQty'), dataIndex: 'bom_quantity', render: formatQuantity },
        {
          title: t('app.kuaizhizao.backflushRecords.colBackflushQty'),
          key: 'backflush_quantity',
          render: (_, r) => `${formatQuantity(r.backflush_quantity)} ${String(r.material_unit ?? '')}`.trim(),
        },
        { title: t('app.kuaizhizao.backflushRecords.colOutboundWarehouse'), dataIndex: 'warehouse_name' },
        { title: t('app.kuaizhizao.backflushRecords.colErrorMessage'), dataIndex: 'error_message', span: 2 },
        { title: t('app.kuaizhizao.warehouseCommon.colProcessedBy'), dataIndex: 'processed_by_name' },
        { title: t('common.createdAt'), dataIndex: 'created_at', render: (_, r) => formatDateTime(r.created_at) },
      ];
    case 'outsource_issue':
    case 'outsource_receipt':
    case 'outsource_material_return':
      return [
        { title: t('app.kuaizhizao.warehouseCommon.colCode'), dataIndex: 'code' },
        { title: t('app.kuaizhizao.warehouseCommon.colOutsourceWorkOrder'), dataIndex: 'outsource_work_order_code' },
        {
          title: t('app.kuaizhizao.warehouseCommon.colMaterial'),
          key: 'material',
          render: (_, r) => `${String(r.material_code ?? '')} ${String(r.material_name ?? '')}`.trim() || '-',
        },
        {
          title: t('common.quantity'),
          key: 'quantity',
          render: (_, r) => `${formatQuantity(r.quantity)} ${String(r.unit ?? '')}`.trim(),
        },
        { title: t('app.kuaizhizao.warehouseCommon.colWarehouse'), dataIndex: 'warehouse_name' },
        {
          title: t('common.status'),
          dataIndex: 'status',
          render: (_, r) =>
            renderDocumentStatusTag(resolveOutsourceStatusLabel(t, String(r.status ?? '')), String(r.status ?? '')),
        },
        { title: t('app.kuaizhizao.batchInventoryQuery.colBatchNo'), dataIndex: 'batch_number' },
        { title: t('common.remark'), dataIndex: 'remarks', span: 2 },
        {
          title: kind === 'outsource_issue' ? t('app.kuaizhizao.batchingCenter.colIssuedAt') : t('app.kuaizhizao.batchingCenter.colReceivedAt'),
          dataIndex: kind === 'outsource_issue' ? 'issued_at' : 'received_at',
          render: (_, r) => formatDateTime(kind === 'outsource_issue' ? r.issued_at : r.received_at),
        },
      ];
    case 'outsource_product_return':
      return [
        { title: t('app.kuaizhizao.warehouseCommon.colCode'), dataIndex: 'code' },
        { title: t('app.kuaizhizao.warehouseCommon.colOutsourceWorkOrder'), dataIndex: 'outsource_work_order_code' },
        {
          title: t('common.quantity'),
          key: 'quantity',
          render: (_, r) => `${formatQuantity(r.quantity)} ${String(r.unit ?? '')}`.trim(),
        },
        { title: t('app.kuaizhizao.warehouseCommon.colReturnReason'), dataIndex: 'return_reason', span: 2 },
        {
          title: t('common.status'),
          dataIndex: 'status',
          render: (_, r) =>
            renderDocumentStatusTag(resolveOutsourceStatusLabel(t, String(r.status ?? '')), String(r.status ?? '')),
        },
        { title: t('common.remark'), dataIndex: 'remarks', span: 2 },
        { title: t('app.kuaizhizao.batchingCenter.colReturnedAt'), dataIndex: 'returned_at', render: (_, r) => formatDateTime(r.returned_at) },
      ];
  }
}

function buildLineColumns(t: TFunction, kind: MaterialCenterDetailKind): ColumnsType<Record<string, unknown>> {
  if (kind === 'batching_order') {
    return [
      { title: t('app.kuaizhizao.warehouseCommon.colMaterialCode'), dataIndex: 'material_code', width: 120 },
      { title: t('app.kuaizhizao.warehouseCommon.colMaterialName'), dataIndex: 'material_name', width: 150 },
      { title: t('app.kuaizhizao.batchingCenter.requiredQty'), dataIndex: 'required_quantity', width: 100, align: 'right', render: formatQuantity },
      { title: t('app.kuaizhizao.warehouseCommon.colPickedQty'), dataIndex: 'picked_quantity', width: 100, align: 'right', render: formatQuantity },
      {
        title: t('common.status'),
        dataIndex: 'status',
        width: 100,
        render: (status: string) => {
          const map: Record<string, string> = {
            pending: t('app.kuaizhizao.warehouseCommon.statusPendingPick'),
            picked: t('app.kuaizhizao.warehouseCommon.statusPicked'),
          };
          const label = map[status] ?? status;
          return renderDocumentStatusTag(label, status);
        },
      },
    ];
  }
  if (kind === 'material_call') {
    return [
      { title: t('app.kuaizhizao.warehouseCommon.colMaterialCode'), dataIndex: 'material_code', width: 120 },
      { title: t('app.kuaizhizao.warehouseCommon.colMaterialName'), dataIndex: 'material_name', width: 150 },
      { title: t('app.kuaizhizao.batchingCenter.requiredQty'), dataIndex: 'requested_quantity', width: 100, align: 'right', render: formatQuantity },
      { title: t('app.kuaizhizao.warehouseCommon.colDeliveredQty'), dataIndex: 'delivered_quantity', width: 100, align: 'right', render: formatQuantity },
    ];
  }
  return [];
}

function resolveLinesTitle(t: TFunction, kind: MaterialCenterDetailKind): string | undefined {
  if (kind === 'batching_order') return t('app.kuaizhizao.batchingCenter.batchingItems');
  if (kind === 'material_call') return t('app.kuaizhizao.batchingCenter.materialCallItems');
  return undefined;
}

type MaterialCenterDetailDrawerProps = {
  kind: MaterialCenterDetailKind | null;
  open: boolean;
  loading?: boolean;
  detail: Record<string, unknown> | null;
  onClose: () => void;
};

export function MaterialCenterDetailDrawer({
  kind,
  open,
  loading,
  detail,
  onClose,
}: MaterialCenterDetailDrawerProps) {
  const { t } = useTranslation();

  const basicColumns = useMemo(
    () => (kind ? buildBasicColumns(t, kind) : []),
    [kind, t],
  );

  const lineColumns = useMemo(
    () => (kind ? buildLineColumns(t, kind) : []),
    [kind, t],
  );

  const linesRows = useMemo(() => {
    if (!detail || !kind) return [];
    if (kind === 'batching_order' || kind === 'material_call') {
      const items = detail.items;
      return Array.isArray(items) ? (items as Record<string, unknown>[]) : [];
    }
    return [];
  }, [detail, kind]);

  const collaboration = useMemo(() => {
    if (!detail || kind !== 'batching_order') return undefined;
    const lifecycle = getBatchingOrderLifecycle(detail, t);
    const mainStages = lifecycle.mainStages ?? [];
    if (mainStages.length === 0) return undefined;
    return (
      <UniLifecycleStepper
        steps={mainStages}
        status={lifecycle.status}
        showLabels
        nextStepSuggestions={lifecycle.nextStepSuggestions}
      />
    );
  }, [detail, kind, t]);

  const title = kind && detail ? resolveDetailTitle(t, kind, detail) : t('common.detail');

  const timeconfigBasicItems = useDetailDrawerDescriptionItems(
    basicColumns, detail
  );

  return (
    <DetailDrawerTemplate
      title={title}
      open={open}
      loading={loading}
      onClose={onClose}
      size={DRAWER_CONFIG.HALF_WIDTH}
      basic={
        detail ? (
          <Descriptions
            column={2}
            size="small"
            items={timeconfigBasicItems}
          />
        ) : undefined
      }
      collaboration={collaboration}
      lines={
        linesRows.length > 0 ? (
          <>
            <style>{WAREHOUSE_DETAIL_TABLE_STYLES}</style>
            <Table
              className="warehouse-detail-table"
              size="small"
              rowKey={(row, index) => String(row.id ?? index)}
              columns={lineColumns}
              dataSource={linesRows}
              pagination={false}
            />
          </>
        ) : undefined
      }
      linesTitle={kind ? resolveLinesTitle(t, kind) : undefined}
    />
  );
}
