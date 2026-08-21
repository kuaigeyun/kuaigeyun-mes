/**
 * 生产工单原版详情抽屉（列表 / 关联嵌套共用）。
 * 单一 DetailDrawerTemplate：加载中遮罩，失败 Result+重试。
 */

import React, { lazy, Suspense, useMemo } from 'react';
import { Button, Descriptions, Result, Space, Spin, Typography } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { ProDescriptionsItemProps } from '@ant-design/pro-components';
import {
  DetailDrawerTemplate,
  DRAWER_CONFIG,
  detailDrawerBasicColumn,
  useDetailDrawerDescriptionItems,
} from '../../../../../../components/layout-templates';
import { UniLifecycleStepper } from '../../../../../../components/uni-lifecycle';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../../components/document-tracking-panel';
import { UniWorkflowActions } from '../../../../../../components/uni-workflow-actions';
import { rowActionKind } from '../../../../../../components/uni-action';
import { CustomFieldsDetailSection, hasCustomFieldsDetailContent } from '../../../../../../components/custom-fields';
import { MarkerTag } from '../../../../../../constants/statusBadges';
import { WarehouseTraceBriefPrimaryActions } from '../../../warehouse-management/WarehouseTraceBriefFooter';
import { getWorkOrderLifecycle, isWorkOrderPlannedEndOverdue } from '../../../../utils/workOrderLifecycle';
import { getWorkOrderHeaderQuantitiesFromOperations } from '../../../../utils/workOrderReporting';
import { alignDescriptionColumns } from '../../../sales-management/shared/documentFieldAlignment';
import { useAuditRequired } from '../../../../../../hooks/useAuditRequired';
import { useResourcePermissions } from '../../../../../../hooks/useResourcePermissions';
import { useKuaizhizaoPrintModal } from '../../../../hooks/useKuaizhizaoPrintModal';
import { isManualAuditEnabled, type AuditStateLike } from '../../../../../../utils/auditMode';
import { getFileDownloadUrl } from '../../../../../../services/file';
import type { CustomField } from '../../../../../../services/customField';
import type { AuditPhaseRecord } from '../../../../../../components/uni-audit/AuditPhaseBadge';
import { WorkOrderMaterialMovementsPanel } from './WorkOrderMaterialMovementsPanel';

const LazyQRCodeGenerator = lazy(() =>
  import('../../../../../../components/qrcode/QRCodeGenerator').then((m) => ({ default: m.QRCodeGenerator })),
);
const LazyWorkOrderOperationsList = lazy(() => import('./WorkOrderDetailDndOperations'));

export const WORK_ORDER_RESOURCE = 'kuaizhizao:work-order';

const PLACEHOLDER: WorkOrderDetailRecord = { id: 0 };

export const WORK_ORDER_WORKFLOW_PROPS = {
  entityType: 'work_order' as const,
  auditNodeKey: 'work_order' as const,
  unifiedAudit: true,
  resourcePrefix: WORK_ORDER_RESOURCE,
  statusField: 'status' as const,
  reviewStatusField: 'review_status' as const,
  draftStatuses: ['草稿', 'draft'],
  pendingStatuses: ['待审核', 'pending_review', 'pending_approval', 'PENDING'],
  approvedStatuses: ['已通过', '审核通过', 'approved', 'APPROVED'],
  rejectedStatuses: ['已驳回', '审核驳回', 'rejected', 'REJECTED'],
};

export type WorkOrderDetailRecord = {
  id?: number;
  code?: string;
  work_order_code?: string;
  name?: string;
  product_code?: string;
  product_name?: string;
  quantity?: number;
  production_mode?: string;
  manufacturing_mode?: string;
  sales_order_id?: number;
  sales_order_code?: string;
  status?: string;
  priority?: string;
  planned_start_date?: string;
  planned_end_date?: string;
  actual_start_date?: string;
  actual_end_date?: string;
  completed_quantity?: number;
  qualified_quantity?: number;
  unqualified_quantity?: number;
  effective_batch_no?: string;
  planned_batch_no?: string;
  effective_serial_no?: string;
  planned_serial_no?: string;
  remarks?: string;
  attachments?: unknown[];
  audit?: unknown;
  [key: string]: unknown;
};

function firstNonEmpty(...candidates: unknown[]): string | undefined {
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate;
  }
  return undefined;
}

function mapWorkOrderAttachmentsToUploadList(attachments: unknown[] | null | undefined) {
  return (attachments || []).map((file: unknown, index: number) => {
    if (typeof file === 'string') {
      return { uid: file, name: `附件${index + 1}`, url: getFileDownloadUrl(file) };
    }
    const row = (file ?? {}) as Record<string, unknown>;
    const uid =
      firstNonEmpty(row.uid, row.uuid, row.file_uuid, row.fileUuid) || `attachment-${index}`;
    const name =
      firstNonEmpty(row.name, row.original_name, row.originalName, row.file_name, row.filename) ||
      `附件${index + 1}`;
    const url =
      firstNonEmpty(row.url, row.download_url, row.downloadUrl) ||
      (firstNonEmpty(row.uid, row.uuid, row.file_uuid, row.fileUuid)
        ? getFileDownloadUrl(String(firstNonEmpty(row.uid, row.uuid, row.file_uuid, row.fileUuid)))
        : undefined);
    return { uid, name, url };
  });
}

export type WorkOrderDetailDrawerProps = {
  open: boolean;
  onClose: () => void;
  workOrder: WorkOrderDetailRecord | null;
  operations?: unknown[];
  operationsReadOnly?: boolean;
  onOperationsUpdate?: () => Promise<void>;
  onEditOperation?: (operation: unknown) => void;
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
};

export const WorkOrderDetailReadonlyExtra: React.FC<{
  workOrder: WorkOrderDetailRecord;
  onWorkflowSuccess?: () => void;
}> = ({ workOrder, onWorkflowSuccess }) => {
  const { t } = useTranslation();
  const auditEnabled = useAuditRequired('work_order', false);
  const perms = useResourcePermissions(WORK_ORDER_RESOURCE);
  const { openPrint, PrintModal } = useKuaizhizaoPrintModal();
  return (
    <>
      <Space size="small">
        {auditEnabled ? (
          <UniWorkflowActions
            {...rowActionKind('skip')}
            record={workOrder}
            entityName={t('app.kuaizhizao.workOrder.entityName')}
            {...WORK_ORDER_WORKFLOW_PROPS}
            theme="default"
            onSuccess={() => onWorkflowSuccess?.()}
            confirmMessages={{
              submit: isManualAuditEnabled(workOrder.audit as AuditStateLike | undefined)
                ? t('app.kuaizhizao.workOrder.submitConfirmAudit')
                : t('app.kuaizhizao.workOrder.submitConfirmAuto'),
            }}
          />
        ) : null}
        {workOrder.id != null && perms.canPrint ? (
          <Button
            icon={<PrinterOutlined />}
            onClick={() => openPrint({ documentType: 'work_order', documentId: workOrder.id! })}
          >
            {t('components.uniAction.print')}
          </Button>
        ) : null}
      </Space>
      {PrintModal}
    </>
  );
};

export const WorkOrderDetailDrawer: React.FC<WorkOrderDetailDrawerProps> = ({
  open,
  onClose,
  workOrder,
  operations = [],
  operationsReadOnly = false,
  onOperationsUpdate,
  onEditOperation,
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
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const contentReady = Boolean(workOrder);
  const showError = Boolean(error) && !contentReady && !loading;
  const showLoading = loading || (!contentReady && !showError);
  const effective = workOrder ?? PLACEHOLDER;
  const code = String(effective.work_order_code ?? effective.code ?? '').trim();

  const tracking = useDocumentTracking(
    open && contentReady ? 'work_order' : undefined,
    effective.id,
    trackingRefreshKey,
  );

  const lifecycle = useMemo(
    () => (contentReady ? getWorkOrderLifecycle(effective) : null),
    [contentReady, effective],
  );
  const nextSteps = lifecycle?.nextStepSuggestions;
  const showNextInTitle = Boolean(nextSteps?.length);
  const headerQuantities = useMemo(
    () => getWorkOrderHeaderQuantitiesFromOperations(operations),
    [operations],
  );

  const basicColumns = useMemo(
    () =>
      alignDescriptionColumns([
        {
          title: t('app.kuaizhizao.workOrder.colCode'),
          dataIndex: 'code',
          key: 'work_order_code',
          render: (_, record) => {
            const display = String(record.work_order_code ?? record.code ?? '').trim();
            const overdue = isWorkOrderPlannedEndOverdue(record);
            return (
              <Space size={4} wrap>
                <Typography.Text copyable={display ? { text: display } : undefined}>
                  {display || '-'}
                </Typography.Text>
                {overdue ? (
                  <MarkerTag color="error">{t('app.kuaizhizao.workOrder.tagOverdue')}</MarkerTag>
                ) : null}
              </Space>
            );
          },
        },
        { title: t('app.kuaizhizao.workOrder.colName'), dataIndex: 'name', key: 'work_order_name' },
        { title: t('app.kuaizhizao.workOrder.colProductCode'), dataIndex: 'product_code' },
        { title: t('app.kuaizhizao.workOrder.colProductName'), dataIndex: 'product_name' },
        { title: t('app.kuaizhizao.workOrder.colPlannedQty'), dataIndex: 'quantity', key: 'total_quantity' },
        {
          title: t('app.kuaizhizao.workOrder.colBatchNo'),
          dataIndex: 'effective_batch_no',
          render: (_, record) => record.effective_batch_no || record.planned_batch_no || '-',
        },
        {
          title: t('app.kuaizhizao.workOrder.colSerialNo'),
          dataIndex: 'effective_serial_no',
          render: (_, record) => record.effective_serial_no || record.planned_serial_no || '-',
        },
        {
          title: t('app.kuaizhizao.workOrder.colProductionMode'),
          dataIndex: 'production_mode',
          render: (_, record) => (
            <MarkerTag color={record.production_mode === 'MTO' ? 'blue' : 'green'}>
              {record.production_mode === 'MTO'
                ? t('app.kuaizhizao.workOrder.productionModeMTO')
                : t('app.kuaizhizao.workOrder.productionModeMTS')}
            </MarkerTag>
          ),
        },
        {
          title: t('app.kuaizhizao.workOrder.colManufacturingMode'),
          dataIndex: 'manufacturing_mode',
          render: (_, record) => {
            if (record.manufacturing_mode === 'assembly') {
              return (
                <MarkerTag color="cyan">{t('app.kuaizhizao.workOrder.manufacturingModeAssembly')}</MarkerTag>
              );
            }
            if (record.manufacturing_mode === 'fabrication') {
              return (
                <MarkerTag color="geekblue">
                  {t('app.kuaizhizao.workOrder.manufacturingModeFabrication')}
                </MarkerTag>
              );
            }
            return '—';
          },
        },
        {
          title: t('app.kuaizhizao.workOrder.colSalesOrder'),
          dataIndex: 'sales_order_code',
        },
        {
          title: t('app.kuaizhizao.workOrder.colPriority'),
          dataIndex: 'priority',
          render: (_, record) => {
            const key = String(record.priority || 'normal');
            const labelMap: Record<string, string> = {
              low: t('app.kuaizhizao.workOrder.priorityLow'),
              normal: t('app.kuaizhizao.workOrder.priorityNormal'),
              high: t('app.kuaizhizao.workOrder.priorityHigh'),
              urgent: t('app.kuaizhizao.workOrder.priorityUrgent'),
            };
            const colorMap: Record<string, string> = {
              low: 'default',
              normal: 'blue',
              high: 'orange',
              urgent: 'red',
            };
            return <MarkerTag color={colorMap[key] || 'blue'}>{labelMap[key] || key}</MarkerTag>;
          },
        },
        {
          title: t('app.kuaizhizao.workOrder.colPlannedStart'),
          dataIndex: 'planned_start_date',
          valueType: 'dateTime',
        },
        {
          title: t('app.kuaizhizao.workOrder.colPlannedEnd'),
          dataIndex: 'planned_end_date',
          valueType: 'dateTime',
        },
        {
          title: t('app.kuaizhizao.workOrder.colActualStart'),
          dataIndex: 'actual_start_date',
          valueType: 'dateTime',
        },
        {
          title: t('app.kuaizhizao.workOrder.colActualEnd'),
          dataIndex: 'actual_end_date',
          valueType: 'dateTime',
        },
        {
          title: t('app.kuaizhizao.workOrder.colCompletedQty'),
          dataIndex: 'completed_quantity',
          render: (_, record) => headerQuantities?.completed ?? record.completed_quantity ?? 0,
        },
        {
          title: t('app.kuaizhizao.workOrder.colQualifiedQty'),
          dataIndex: 'qualified_quantity',
          render: (_, record) => headerQuantities?.qualified ?? record.qualified_quantity ?? 0,
        },
        {
          title: t('app.kuaizhizao.workOrder.colUnqualifiedQty'),
          dataIndex: 'unqualified_quantity',
          render: (_, record) => headerQuantities?.unqualified ?? record.unqualified_quantity ?? 0,
        },
        {
          title: t('app.kuaizhizao.workOrder.colAttachments'),
          dataIndex: 'attachments',
          span: 2,
          render: (_, record) => {
            const files = mapWorkOrderAttachmentsToUploadList(record.attachments as unknown[]);
            if (!files.length) return '-';
            return (
              <Space wrap size={[8, 4]}>
                {files.map((file, index) =>
                  file.url ? (
                    <Typography.Link
                      key={`${file.uid || file.name}-${index}`}
                      href={file.url}
                      target="_blank"
                    >
                      {file.name}
                    </Typography.Link>
                  ) : (
                    <span key={`${file.uid || file.name}-${index}`}>{file.name}</span>
                  ),
                )}
              </Space>
            );
          },
        },
      ] as ProDescriptionsItemProps<WorkOrderDetailRecord>[]),
    [t, headerQuantities],
  );

  const notesColumn = useMemo(
    () =>
      alignDescriptionColumns([
        { title: t('common.remark'), dataIndex: 'remarks', span: 2 },
      ] as ProDescriptionsItemProps<WorkOrderDetailRecord>[]),
    [t],
  );
  const basicItems = useDetailDrawerDescriptionItems(basicColumns, effective, 'work_order');
  const notesItems = useDetailDrawerDescriptionItems(notesColumn, effective, 'work_order');

  const title = t('app.kuaizhizao.workOrder.detailTitle', { code });

  if (!open) return null;

  return (
    <DetailDrawerTemplate
      title={title}
      open={open}
      onClose={onClose}
      width={DRAWER_CONFIG.HALF_WIDTH}
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
              <WorkOrderDetailReadonlyExtra
                workOrder={effective}
                onWorkflowSuccess={onWorkflowSuccess}
              />
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
              column={detailDrawerBasicColumn(true)}
              size="small"
              items={basicItems}
            />
            {hasCustomFieldsDetailContent(customFields, customFieldValues) ? (
              <div style={{ marginTop: 16 }}>
                <CustomFieldsDetailSection
                  customFields={customFields}
                  customFieldValues={customFieldValues}
                />
              </div>
            ) : null}
            <Descriptions
              column={detailDrawerBasicColumn(true)}
              size="small"
              style={{ marginTop: 16 }}
              items={notesItems}
            />
          </>
        ) : showError ? null : (
          <div style={{ minHeight: 80 }} />
        )
      }
      basicExtra={
        contentReady && code ? (
          <>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {t('app.kuaizhizao.workOrder.qrTitle')}
            </Typography.Text>
            <Suspense fallback={<Spin />}>
              <LazyQRCodeGenerator
                qrcodeType="WO"
                data={{
                  work_order_uuid: effective.id?.toString() || '',
                  work_order_code: code,
                  work_order_name: String(effective.name ?? ''),
                }}
                autoGenerate
                size={6}
                showCardTitle={false}
                noCard
              />
            </Suspense>
          </>
        ) : undefined
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
      linesTitle={t('app.kuaizhizao.workOrder.colOperations')}
      lines={
        contentReady ? (
          <Suspense fallback={<Spin style={{ margin: 24 }} />}>
            <LazyWorkOrderOperationsList
              workOrderId={effective.id}
              operations={operations}
              workOrderStatus={effective.status}
              readOnly={operationsReadOnly}
              onUpdate={async () => {
                await onOperationsUpdate?.();
              }}
              onEdit={(operation) => onEditOperation?.(operation)}
            />
          </Suspense>
        ) : null
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
      historyTab={
        contentReady && effective.id != null
          ? {
              documentId: Number(effective.id),
              label: t('app.kuaizhizao.workOrder.materialMovementsTitle'),
              children: (
                <WorkOrderMaterialMovementsPanel
                  workOrderId={Number(effective.id)}
                  enabled={open}
                />
              ),
            }
          : undefined
      }
      traceDocument={
        contentReady && effective.id != null
          ? {
              documentType: 'work_order',
              documentId: Number(effective.id),
              selfDocumentId: Number(effective.id),
              renderBriefActions: (doc) => (
                <WarehouseTraceBriefPrimaryActions doc={doc} t={t} navigate={navigate} closeDrawer={onClose} />
              ),
            }
          : undefined
      }
    />
  );
};
