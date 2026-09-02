/**
 * 采购订单原版详情抽屉（列表 / 关联嵌套共用）。
 * 单一 DetailDrawerTemplate：加载中遮罩，失败 Result+重试。
 * 变更历史走 historyTab，不塞进 timeline / 生命周期。
 */

import React, { useEffect, useMemo, useState } from 'react';
import { App, Button, Descriptions, Divider, Empty, Result, Space, Table, Typography } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { ProDescriptionsItemProps } from '@ant-design/pro-components';
import {
  DetailDrawerTemplate,
  DetailDrawerSection,
  DRAWER_CONFIG,
  useDetailDrawerDescriptionItems,
} from '../../../../../../components/layout-templates';
import { UniLifecycleStepper } from '../../../../../../components/uni-lifecycle';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../../components/document-tracking-panel';
import { UniWorkflowActions } from '../../../../../../components/uni-workflow-actions';
import { rowActionKind } from '../../../../../../components/uni-action';
import { QuantityWithUnitDisplay } from '../../../../../../components/quantity-with-unit';
import { CustomFieldsDetailSection, hasCustomFieldsDetailContent } from '../../../../../../components/custom-fields';
import { WarehouseTraceBriefPrimaryActions } from '../../../warehouse-management/WarehouseTraceBriefFooter';
import { getPurchaseOrderLifecycle } from '../../../../utils/purchaseOrderLifecycle';
import { formatOrderChangeStatusLabel } from '../../../../utils/orderChangeLifecycle';
import { type PurchaseOrder, type PurchaseOrderItem } from '../../../../services/purchase';
import { listPurchaseOrderChangesByOrder, type PurchaseOrderChange } from '../../../../services/purchase-order-change';
import { alignDescriptionColumns } from '../../../sales-management/shared/documentFieldAlignment';
import { MarkerTag } from '../../../../../../constants/statusBadges';
import { formatDateTimeBySiteSetting } from '../../../../../../utils/format';
import { resolveSystemDictionaryItemLabel } from '../../../../../../utils/systemDictionaryI18n';
import { useAuditRequired } from '../../../../../../hooks/useAuditRequired';
import { useResourcePermissions } from '../../../../../../hooks/useResourcePermissions';
import { useKuaizhizaoPrintModal } from '../../../../hooks/useKuaizhizaoPrintModal';
import { DocumentStatus, ReviewStatusEnum } from '../../../../constants/documentStatus';
import type { CustomField } from '../../../../../../services/customField';
import type { AuditPhaseRecord } from '../../../../../../components/uni-audit/AuditPhaseBadge';

const PURCHASE_ORDER_RESOURCE = 'kuaizhizao:purchase-order';
const PLACEHOLDER: PurchaseOrder = { id: 0 };
const DETAIL_ITEMS_MIN_WIDTH = 1200;

export const PURCHASE_ORDER_WORKFLOW_PROPS = {
  entityType: 'purchase_order' as const,
  unifiedAudit: true,
  resourcePrefix: PURCHASE_ORDER_RESOURCE,
  statusField: 'status' as const,
  reviewStatusField: 'review_status' as const,
  draftStatuses: ['草稿', 'draft', 'DRAFT', DocumentStatus.DRAFT],
  pendingStatuses: ['待审核', 'pending_review', 'PENDING_REVIEW', DocumentStatus.PENDING_REVIEW],
  approvedStatuses: [
    '已审核',
    'audited',
    '审核通过',
    '已确认',
    DocumentStatus.AUDITED,
    DocumentStatus.CONFIRMED,
    ReviewStatusEnum.APPROVED,
  ],
  rejectedStatuses: ['已驳回', 'rejected', 'REJECTED', DocumentStatus.REJECTED, ReviewStatusEnum.REJECTED],
};

function formatAmount(val: unknown): string {
  const num =
    typeof val === 'number' && !Number.isNaN(val)
      ? val
      : val && typeof val === 'object' && 'value' in val && typeof (val as { value?: unknown }).value === 'number'
        ? (val as { value: number }).value
        : parseFloat(String(val ?? 0));
  return (Number.isNaN(num) ? 0 : num).toLocaleString();
}

function purchaseOrderTaxRateToPercent(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n <= 1 ? n * 100 : n;
}

export type PurchaseOrderDetailDrawerProps = {
  open: boolean;
  onClose: () => void;
  order: PurchaseOrder | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  zIndex?: number;
  trackingRefreshKey?: number;
  extra?: React.ReactNode;
  showReadonlyActions?: boolean;
  onWorkflowSuccess?: () => void;
  customFields?: CustomField[];
  customFieldValues?: Record<string, unknown>;
  feeTypeOptions?: Array<{ value?: string; label?: string }>;
};

export const PurchaseOrderDetailReadonlyExtra: React.FC<{
  order: PurchaseOrder;
  onWorkflowSuccess?: () => void;
}> = ({ order, onWorkflowSuccess }) => {
  const { t } = useTranslation();
  const perms = useResourcePermissions(PURCHASE_ORDER_RESOURCE);
  const { openPrint, PrintModal } = useKuaizhizaoPrintModal();
  return (
    <>
      <Space size="small">
        <UniWorkflowActions
          {...rowActionKind('skip')}
          record={order}
          entityName={t('app.kuaizhizao.purchaseOrder.entityName')}
          {...PURCHASE_ORDER_WORKFLOW_PROPS}
          submitActionLabel={t('app.kuaizhizao.purchaseOrder.submitForReview')}
          theme="default"
          onSuccess={() => onWorkflowSuccess?.()}
        />
        {order.id != null && perms.canPrint ? (
          <Button
            icon={<PrinterOutlined />}
            onClick={() => openPrint({ documentType: 'purchase_order', documentId: order.id! })}
          >
            {t('components.uniAction.print')}
          </Button>
        ) : null}
      </Space>
      {PrintModal}
    </>
  );
};

const PurchaseOrderChangeHistoryPane: React.FC<{ orderId: number; refreshKey: number }> = ({
  orderId,
  refreshKey,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const [rows, setRows] = useState<PurchaseOrderChange[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void listPurchaseOrderChangesByOrder(orderId)
      .then((list) => {
        if (!cancelled) setRows(list);
      })
      .catch(() => {
        if (!cancelled) {
          setRows([]);
          messageApi.error(t('common.loadFailed'));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orderId, refreshKey, messageApi, t]);

  return (
    <DetailDrawerSection titleAccent title={t('app.kuaizhizao.purchaseOrder.changeHistoryTitle')}>
      <Table<PurchaseOrderChange>
        size="small"
        loading={loading}
        rowKey="id"
        pagination={false}
        dataSource={rows}
        locale={{ emptyText: t('app.kuaizhizao.purchaseOrder.emptyChanges') }}
        columns={[
          { title: t('app.kuaizhizao.purchaseOrder.col.changeCode'), dataIndex: 'change_code' },
          { title: t('app.kuaizhizao.purchaseOrder.col.changeVersion'), dataIndex: 'change_version', width: 70 },
          { title: t('app.kuaizhizao.purchaseOrder.col.deltaAmount'), dataIndex: 'delta_amount', width: 100 },
          {
            title: t('common.status'),
            dataIndex: 'status',
            width: 100,
            render: (status: string) => formatOrderChangeStatusLabel(status, t),
          },
          {
            title: t('app.kuaizhizao.purchaseOrder.col.appliedAt'),
            dataIndex: 'applied_at',
            width: 160,
            render: (v: string) => (v ? formatDateTimeBySiteSetting(v) : '-'),
          },
        ]}
      />
    </DetailDrawerSection>
  );
};

export const PurchaseOrderDetailDrawer: React.FC<PurchaseOrderDetailDrawerProps> = ({
  open,
  onClose,
  order,
  loading = false,
  error = null,
  onRetry,
  zIndex,
  trackingRefreshKey = 0,
  extra,
  showReadonlyActions = true,
  onWorkflowSuccess,
  customFields = [],
  customFieldValues = {},
  feeTypeOptions = [],
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const auditRequired = useAuditRequired('purchase_order', false);

  const contentReady = Boolean(order);
  const showError = Boolean(error) && !contentReady && !loading;
  const showLoading = loading || (!contentReady && !showError);
  const effective = order ?? PLACEHOLDER;

  const tracking = useDocumentTracking(
    open && contentReady ? 'purchase_order' : undefined,
    effective.id,
    trackingRefreshKey,
  );

  const lifecycle = useMemo(
    () => (contentReady ? getPurchaseOrderLifecycle(effective, auditRequired, t) : null),
    [contentReady, effective, auditRequired, t],
  );
  const nextSteps = lifecycle?.nextStepSuggestions;
  const showNextInTitle = Boolean(nextSteps?.length);

  const basicColumns = useMemo(
    () =>
      alignDescriptionColumns([
        {
          title: t('app.kuaizhizao.purchaseOrder.col.orderCode'),
          dataIndex: 'order_code',
          render: (_, entity) => (
            <Typography.Text copyable={{ text: String(entity.order_code ?? '') }}>
              {entity.order_code ?? '-'}
            </Typography.Text>
          ),
        },
        { title: t('app.kuaizhizao.purchaseOrder.col.supplier'), dataIndex: 'supplier_name' },
        {
          title: t('app.kuaizhizao.purchaseOrder.col.orderType'),
          dataIndex: 'order_type',
          render: (_, entity) =>
            resolveSystemDictionaryItemLabel(
              'ORDER_TYPE',
              { value: entity.order_type ?? '', label: entity.order_type ?? '', is_system_managed: true },
              t,
            ) || '—',
        },
        { title: t('app.kuaizhizao.purchaseOrder.col.orderDate'), dataIndex: 'order_date', valueType: 'date' },
        { title: t('app.kuaizhizao.purchaseOrder.col.deliveryDate'), dataIndex: 'delivery_date', valueType: 'date' },
        { title: t('app.kuaizhizao.purchaseOrder.col.buyer'), dataIndex: 'buyer_name' },
        { title: t('app.kuaizhizao.purchaseOrder.form.currency'), dataIndex: 'currency', key: 'currency_code' },
        {
          title: t('app.kuaizhizao.purchaseOrder.col.orderAmount'),
          dataIndex: 'total_amount',
          render: (text) => `¥${formatAmount(text)}`,
        },
        {
          title: t('app.kuaizhizao.purchaseOrder.col.taxRate'),
          dataIndex: 'tax_rate',
          render: (text) => {
            const pct = purchaseOrderTaxRateToPercent(text);
            return pct > 0 ? `${pct.toFixed(2)}%` : '-';
          },
        },
        {
          title: t('app.kuaizhizao.purchaseOrder.col.taxAmount'),
          dataIndex: 'tax_amount',
          render: (text) => (text != null && text !== '' ? `¥${formatAmount(text)}` : '-'),
        },
        {
          title: t('app.kuaizhizao.purchaseOrder.col.inclAmount'),
          dataIndex: 'net_amount',
          render: (text) => (text != null && text !== '' ? `¥${formatAmount(text)}` : '-'),
        },
      ] as ProDescriptionsItemProps<PurchaseOrder>[]),
    [t],
  );

  const notesColumn = useMemo(
    () =>
      alignDescriptionColumns([
        { title: t('common.remark'), dataIndex: 'notes', span: 3 },
      ] as ProDescriptionsItemProps<PurchaseOrder>[]),
    [t],
  );

  const title = t('app.kuaizhizao.purchaseOrder.detailTitle', { code: order?.order_code || '' });
  const basicItems = useDetailDrawerDescriptionItems(
    basicColumns,
    effective as Record<string, unknown>,
    'purchase_order',
  );
  const notesItems = useDetailDrawerDescriptionItems(
    notesColumn,
    effective as Record<string, unknown>,
    'purchase_order',
  );

  if (!open) return null;

  return (
    <DetailDrawerTemplate
      title={title}
      open={open}
      onClose={onClose}
      size={DRAWER_CONFIG.HALF_WIDTH}
      zIndex={zIndex}
      loading={showLoading}
      plainBody={
        showError ? (
          <Result
            status="error"
            title={error}
            extra={
              onRetry ? (
                <Button type="primary" onClick={onRetry}>
                  {t('common.retry', { defaultValue: '重试' })}
                </Button>
              ) : null
            }
          />
        ) : undefined
      }
      extra={
        contentReady
          ? extra ??
            (showReadonlyActions ? (
              <PurchaseOrderDetailReadonlyExtra order={effective} onWorkflowSuccess={onWorkflowSuccess} />
            ) : null)
          : null
      }
      collaborationTitleSuffix={
        contentReady && showNextInTitle ? (
          <Typography.Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>
            {t('common.next')}：
            {nextSteps!.join(t('components.uniLifecycle.nextStepSeparator'))}
          </Typography.Text>
        ) : undefined
      }
      collaborationAuditRecord={contentReady ? (effective as AuditPhaseRecord) : null}
      basic={
        contentReady ? (
          <>
            <Descriptions
              column={3}
              size="small"
              items={basicItems}
            />
            {effective.fee_details && effective.fee_details.length > 0 ? (
              <>
                <Divider style={{ margin: '16px 0' }} />
                <Typography.Title level={5} style={{ margin: '0 0 8px' }}>
                  {t('app.kuaizhizao.salesOrder.feeDetailsTitle')}
                </Typography.Title>
                <div style={{ marginBottom: 12 }}>
                  <Typography.Text type="secondary">
                    {t('app.kuaizhizao.purchaseOrder.totalFeeAmount')}：
                    <strong>¥{formatAmount(effective.total_fee_amount)}</strong>
                  </Typography.Text>
                </div>
                <Table
                  size="small"
                  columns={[
                    {
                      title: t('app.kuaizhizao.salesOrder.feeType'),
                      dataIndex: 'type',
                      width: 120,
                      render: (val: string) => {
                        const opt = feeTypeOptions.find((o) => o.value === val);
                        return opt?.label || val;
                      },
                    },
                    {
                      title: t('app.kuaizhizao.purchaseOrder.col.orderAmount'),
                      dataIndex: 'amount',
                      width: 120,
                      align: 'right',
                      render: (val: unknown) => `¥${formatAmount(val)}`,
                    },
                    {
                      title: t('app.kuaizhizao.salesOrder.feeBearer'),
                      dataIndex: 'bearer',
                      width: 100,
                      render: (val: string) =>
                        val === 'our_side'
                          ? t('app.kuaizhizao.salesOrder.feeBearerOurSide')
                          : t('app.kuaizhizao.salesOrder.feeBearerCounterparty'),
                    },
                    { title: t('common.remark'), dataIndex: 'notes' },
                  ]}
                  dataSource={effective.fee_details}
                  rowKey={(_: unknown, i?: number) => String(i ?? 0)}
                  pagination={false}
                />
              </>
            ) : null}
            {hasCustomFieldsDetailContent(customFields, customFieldValues) ? (
              <div style={{ marginTop: 16 }}>
                <CustomFieldsDetailSection customFields={customFields} customFieldValues={customFieldValues} />
              </div>
            ) : null}
            <Descriptions
              column={3}
              size="small"
              style={{ marginTop: 16 }}
              items={notesItems}
            />
          </>
        ) : showError ? null : (
          <div style={{ minHeight: 80 }} />
        )
      }
      collaboration={
        contentReady && lifecycle && (lifecycle.mainStages ?? []).length > 0 ? (
          <UniLifecycleStepper
            steps={lifecycle.mainStages ?? []}
            status={lifecycle.status}
            showLabels
            nextStepSuggestions={lifecycle.nextStepSuggestions}
            hideNextStepSuggestions={showNextInTitle}
          />
        ) : null
      }
      lines={
        contentReady ? (
          effective.items && effective.items.length > 0 ? (
            <Table
              size="small"
              tableLayout="fixed"
              style={{ minWidth: DETAIL_ITEMS_MIN_WIDTH }}
              columns={[
                {
                  title: t('app.kuaizhizao.purchaseOrder.col.materialCode'),
                  dataIndex: 'material_code',
                  width: 120,
                  ellipsis: true,
                },
                {
                  title: t('app.kuaizhizao.purchaseOrder.col.materialName'),
                  dataIndex: 'material_name',
                  width: 150,
                  ellipsis: true,
                  render: (_: unknown, record: PurchaseOrderItem) =>
                    record.material_name || (record as { materialName?: string }).materialName || '—',
                },
                {
                  title: t('app.kuaizhizao.purchaseOrder.col.orderedQty'),
                  dataIndex: 'ordered_quantity',
                  width: 120,
                  align: 'right',
                  render: (val: number, row: PurchaseOrderItem) => (
                    <QuantityWithUnitDisplay quantity={val} unit={row.unit} />
                  ),
                },
                {
                  title: t('app.kuaizhizao.purchaseOrder.col.unitPrice'),
                  dataIndex: 'unit_price',
                  width: 100,
                  align: 'right',
                  render: (text: number, row: PurchaseOrderItem) => (
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                      ¥{text}
                      {(row as PurchaseOrderItem & { price_settlement_status?: string }).price_settlement_status ===
                      'PROVISIONAL' ? (
                        <MarkerTag color="warning">{t('app.kuaizhizao.purchaseOrder.priceProvisional')}</MarkerTag>
                      ) : null}
                    </span>
                  ),
                },
                {
                  title: t('app.kuaizhizao.purchaseOrder.col.totalPrice'),
                  dataIndex: 'total_price',
                  width: 120,
                  align: 'right',
                  render: (text: number) => `¥${text?.toLocaleString()}`,
                },
                {
                  title: t('app.kuaizhizao.purchaseOrder.col.receivedQty'),
                  dataIndex: 'received_quantity',
                  width: 120,
                  align: 'right',
                  render: (val: number, row: PurchaseOrderItem) => (
                    <QuantityWithUnitDisplay quantity={val} unit={row.unit} />
                  ),
                },
                {
                  title: t('app.kuaizhizao.purchaseOrder.col.outstandingQty'),
                  dataIndex: 'outstanding_quantity',
                  width: 100,
                  align: 'right',
                },
                { title: t('app.kuaizhizao.purchaseOrder.form.requiredDate'), dataIndex: 'required_date', width: 120 },
                {
                  title: t('app.kuaizhizao.purchaseOrder.col.inspectionRequired'),
                  dataIndex: 'inspection_required',
                  width: 100,
                  render: (val: boolean) =>
                    val
                      ? t('common.yes')
                      : t('common.no'),
                },
              ]}
              dataSource={effective.items}
              pagination={false}
              rowKey="id"
            />
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.salesOrder.emptyItems')} />
          )
        ) : null
      }
      historyTab={
        contentReady && effective.id
          ? {
              documentId: effective.id,
              label: t('app.uniDetail.tabHistory'),
              children: <PurchaseOrderChangeHistoryPane orderId={effective.id} refreshKey={trackingRefreshKey} />,
            }
          : undefined
      }
      timeline={
        contentReady ? (
          tracking.data && !tracking.loading ? (
            <DocumentTrackingTimelineBody data={tracking.data} />
          ) : tracking.error ? (
            <Typography.Text type="danger">{tracking.error}</Typography.Text>
          ) : null
        ) : null
      }
      traceDocument={
        contentReady && effective.id != null
          ? {
              documentType: 'purchase_order',
              documentId: effective.id,
              selfDocumentId: effective.id,
              renderBriefActions: (doc) => (
                <WarehouseTraceBriefPrimaryActions doc={doc} t={t} navigate={navigate} closeDrawer={onClose} />
              ),
            }
          : undefined
      }
    />
  );
};
