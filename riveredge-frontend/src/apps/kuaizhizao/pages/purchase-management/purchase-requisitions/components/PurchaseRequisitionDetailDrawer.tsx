/**
 * 采购申请原版详情抽屉（列表 / 关联嵌套共用）。
 * 单一 DetailDrawerTemplate：加载中遮罩，失败 Result+重试。
 */

import React, { useCallback, useMemo } from 'react';
import { App, Button, Descriptions, Empty, Result, Space, Table, Tag, Tooltip, Typography } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { ProDescriptionsItemProps } from '@ant-design/pro-components';
import {
  DetailDrawerTemplate,
  DRAWER_CONFIG,
  detailDrawerDescriptionItems,
} from '../../../../../../components/layout-templates';
import { UniLifecycleStepper } from '../../../../../../components/uni-lifecycle';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../../components/document-tracking-panel';
import { UniWorkflowActions } from '../../../../../../components/uni-workflow-actions';
import { rowActionKind } from '../../../../../../components/uni-action';
import { QuantityWithUnitDisplay } from '../../../../../../components/quantity-with-unit';
import { MaterialUnitSelect } from '../../../../../../components/material-unit-select';
import { SourceDocumentCode } from '../../../../../../components/linked-document-code/SourceDocumentCode';
import { WarehouseTraceBriefPrimaryActions } from '../../../warehouse-management/WarehouseTraceBriefFooter';
import { getPurchaseRequisitionLifecycle } from '../../../../utils/purchaseRequisitionLifecycle';
import { formatPurchaseRequisitionSourceType } from '../../../../utils/purchaseRequisitionSourceType';
import {
  type PurchaseRequisition,
  type PurchaseRequisitionItem,
} from '../../../../services/purchase-requisition';
import { alignDescriptionColumns } from '../../../sales-management/shared/documentFieldAlignment';
import { formatDateBySiteSetting } from '../../../../../../utils/format';
import { useAuditRequired } from '../../../../../../hooks/useAuditRequired';
import { useNumericPrecision } from '../../../../../../hooks/useNumericPrecision';
import type { AuditPhaseRecord } from '../../../../../../components/uni-audit/AuditPhaseBadge';

const PURCHASE_REQUISITION_RESOURCE = 'kuaizhizao:purchase-requisition';
const PLACEHOLDER: PurchaseRequisition = { id: 0 };
const DETAIL_ITEMS_MIN_WIDTH = 980;

export const PURCHASE_REQUISITION_WORKFLOW_PROPS = {
  resourcePrefix: PURCHASE_REQUISITION_RESOURCE,
  unifiedAudit: true,
  statusField: 'status' as const,
  reviewStatusField: 'review_status' as const,
  draftStatuses: ['草稿', 'draft'],
  pendingStatuses: ['待审核', 'pending_review'],
  approvedStatuses: ['已通过', '已审核', '部分转单', '全部转单', 'audited', 'approved'],
  rejectedStatuses: ['已驳回', 'rejected'],
};

export type PurchaseRequisitionDetailDrawerProps = {
  open: boolean;
  onClose: () => void;
  requisition: PurchaseRequisition | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  zIndex?: number;
  trackingRefreshKey?: number;
  extra?: React.ReactNode;
  showReadonlyActions?: boolean;
  onWorkflowSuccess?: () => void;
};

export const PurchaseRequisitionDetailReadonlyExtra: React.FC<{
  requisition: PurchaseRequisition;
  onWorkflowSuccess?: () => void;
}> = ({ requisition, onWorkflowSuccess }) => {
  const { t } = useTranslation();
  return (
    <Space size="small">
      <UniWorkflowActions
        {...rowActionKind('skip')}
        record={requisition}
        entityName={t('app.kuaizhizao.purchaseRequisition.entityName')}
        {...PURCHASE_REQUISITION_WORKFLOW_PROPS}
        theme="default"
        confirmMessages={{ revoke: t('app.kuaizhizao.purchaseRequisition.workflowRevokeConfirm') }}
        onSuccess={() => onWorkflowSuccess?.()}
      />
    </Space>
  );
};

export const PurchaseRequisitionDetailDrawer: React.FC<PurchaseRequisitionDetailDrawerProps> = ({
  open,
  onClose,
  requisition,
  loading = false,
  error = null,
  onRetry,
  zIndex,
  trackingRefreshKey = 0,
  extra,
  showReadonlyActions = true,
  onWorkflowSuccess,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const auditRequired = useAuditRequired('purchase_request', false);
  const { price: priceDecimals } = useNumericPrecision();

  const contentReady = Boolean(requisition);
  const showError = Boolean(error) && !contentReady && !loading;
  const showLoading = loading || (!contentReady && !showError);
  const effective = requisition ?? PLACEHOLDER;

  const tracking = useDocumentTracking(
    open && contentReady ? 'purchase_requisition' : undefined,
    effective.id,
    trackingRefreshKey,
  );

  const lifecycle = useMemo(
    () => (contentReady ? getPurchaseRequisitionLifecycle(effective, auditRequired) : null),
    [contentReady, effective, auditRequired],
  );
  const nextSteps = lifecycle?.nextStepSuggestions;
  const showNextInTitle = Boolean(nextSteps?.length);

  const handleCopy = useCallback(
    (text: string) => {
      if (!text?.trim()) return;
      void navigator.clipboard.writeText(text).then(
        () => messageApi.success(t('common.copySuccess')),
        () => messageApi.error(t('common.copyFailed')),
      );
    },
    [messageApi, t],
  );

  const basicColumns = useMemo(
    () =>
      alignDescriptionColumns([
        {
          title: t('app.kuaizhizao.purchaseRequisition.col.code'),
          dataIndex: 'requisition_code',
          render: (_, record) => (
            <Space size={4}>
              <span>{record.requisition_code ?? '-'}</span>
              {record.requisition_code ? (
                <Tooltip title={t('field.invitationCode.copy')}>
                  <Button
                    type="link"
                    size="small"
                    icon={<CopyOutlined style={{ fontSize: 12 }} />}
                    onClick={() => handleCopy(record.requisition_code!)}
                    aria-label={t('app.kuaizhizao.purchaseRequisition.form.copyCodeAria')}
                  />
                </Tooltip>
              ) : null}
            </Space>
          ),
        },
        { title: t('app.kuaizhizao.purchaseRequisition.col.name'), dataIndex: 'requisition_name' },
        {
          title: t('app.kuaizhizao.purchaseRequisition.col.sourceType'),
          dataIndex: 'source_type',
          render: (_, record) => formatPurchaseRequisitionSourceType(record.source_type, t),
        },
        {
          title: t('app.kuaizhizao.purchaseRequisition.col.sourceCode'),
          dataIndex: 'source_code',
          key: 'linked_source_code',
          render: (_, record) => (
            <SourceDocumentCode
              sourceType={record.source_type}
              sourceId={record.source_id}
              sourceCode={record.source_code}
            />
          ),
        },
        { title: t('app.kuaizhizao.purchaseRequisition.form.applicant'), dataIndex: 'applicant_name' },
        { title: t('app.kuaizhizao.purchaseRequisition.form.date'), dataIndex: 'requisition_date', valueType: 'date' },
        {
          title: t('app.kuaizhizao.purchaseRequisition.col.requiredDate'),
          dataIndex: 'required_date',
          valueType: 'date',
        },
        { title: t('app.kuaizhizao.common.fieldNotes'), dataIndex: 'notes', span: 3 },
        { title: t('common.createdAt'), dataIndex: 'created_at', valueType: 'dateTime' },
        { title: t('common.updatedAt'), dataIndex: 'updated_at', valueType: 'dateTime' },
      ] as ProDescriptionsItemProps<PurchaseRequisition>[]),
    [t, handleCopy],
  );

  const title = t('app.kuaizhizao.purchaseRequisition.detailTitle', {
    code: requisition?.requisition_code || '',
  });

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
              <PurchaseRequisitionDetailReadonlyExtra
                requisition={effective}
                onWorkflowSuccess={onWorkflowSuccess}
              />
            ) : null)
          : null
      }
      collaborationTitleSuffix={
        contentReady && showNextInTitle ? (
          <Typography.Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>
            {t('components.uniLifecycle.nextStep')}：
            {nextSteps!.join(t('components.uniLifecycle.nextStepSeparator'))}
          </Typography.Text>
        ) : undefined
      }
      collaborationAuditRecord={contentReady ? (effective as AuditPhaseRecord) : null}
      basic={
        contentReady ? (
          <Descriptions
            column={3}
            size="small"
            items={detailDrawerDescriptionItems(basicColumns, effective as Record<string, unknown>)}
          />
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
              rowKey="id"
              tableLayout="fixed"
              style={{ minWidth: DETAIL_ITEMS_MIN_WIDTH }}
              pagination={false}
              dataSource={effective.items}
              columns={[
                {
                  title: t('app.kuaizhizao.purchaseRequisition.col.materialCode'),
                  dataIndex: 'material_code',
                  width: 120,
                  ellipsis: true,
                },
                {
                  title: t('app.kuaizhizao.purchaseRequisition.col.materialName'),
                  dataIndex: 'material_name',
                  width: 160,
                  ellipsis: true,
                },
                {
                  title: t('app.kuaizhizao.purchaseRequisition.col.spec'),
                  dataIndex: 'material_spec',
                  width: 120,
                  ellipsis: true,
                },
                {
                  title: t('app.kuaizhizao.purchaseRequisition.col.quantity'),
                  dataIndex: 'quantity',
                  width: 120,
                  align: 'right',
                  render: (val: number, row: PurchaseRequisitionItem) => (
                    <QuantityWithUnitDisplay quantity={val} unit={row.unit} />
                  ),
                },
                {
                  title: t('app.kuaizhizao.purchaseRequisition.col.unit'),
                  dataIndex: 'unit',
                  width: 100,
                  ellipsis: true,
                  render: (_: unknown, record: PurchaseRequisitionItem) => (
                    <MaterialUnitSelect
                      materialId={record.material_id}
                      value={record.unit}
                      disabled
                      size="small"
                      noStyle
                    />
                  ),
                },
                {
                  title: t('app.kuaizhizao.purchaseRequisition.col.suggestedPrice'),
                  dataIndex: 'suggested_unit_price',
                  width: 140,
                  align: 'right',
                  render: (v: number) => `¥${Number(v || 0).toFixed(priceDecimals)}`,
                },
                {
                  title: t('app.kuaizhizao.purchaseRequisition.col.requiredDate'),
                  dataIndex: 'required_date',
                  width: 120,
                  ellipsis: true,
                  render: (v: string | undefined) => (v ? formatDateBySiteSetting(v) : '-'),
                },
                {
                  title: t('app.kuaizhizao.purchaseRequisition.col.converted'),
                  dataIndex: 'purchase_order_id',
                  width: 80,
                  render: (v: number | undefined) =>
                    v ? (
                      <Tag color="success">{t('app.kuaizhizao.purchaseRequisition.convertedYes')}</Tag>
                    ) : (
                      <Tag>{t('app.kuaizhizao.purchaseRequisition.convertedNo')}</Tag>
                    ),
                },
              ]}
            />
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.salesOrder.emptyItems')} />
          )
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
      traceDocument={
        contentReady && effective.id != null
          ? {
              documentType: 'purchase_requisition',
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
