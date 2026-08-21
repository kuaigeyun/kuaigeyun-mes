/**
 * 需求计划原版详情抽屉（列表 / 关联嵌套共用）。
 * 单一 DetailDrawerTemplate：加载中遮罩，失败 Result+重试。
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, App, Button, Descriptions, Empty, Result, Space, Table, Tag, Tooltip, Typography } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { ProDescriptionsItemProps } from '@ant-design/pro-components';
import {
  DetailDrawerTemplate,
  DetailDrawerSection,
  DRAWER_CONFIG,
  useDetailDrawerDescriptionItems,
  type TraceBriefDocument,
} from '../../../../../../components/layout-templates';
import { UniLifecycleStepper } from '../../../../../../components/uni-lifecycle';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../../components/document-tracking-panel';
import { UniWorkflowActions } from '../../../../../../components/uni-workflow-actions';
import { rowActionKind } from '../../../../../../components/uni-action';
import { MaterialUnitLabel } from '../../../../../../components/material-unit-label';
import { useOptionalLinkedDocumentDetail } from '../../../../../../components/linked-document-detail';
import { getDemandLifecycle } from '../../../../utils/demandLifecycle';
import { getDemandTypeTagProps, normalizeDemandTypeKey } from '../../../../utils/demandType';
import { getDemandBusinessModeTagColor } from '../../../../utils/businessMode';
import {
  DemandStatus,
  ReviewStatus,
  listDemandRecalcHistory,
  listDemandSnapshots,
  type Demand,
  type DemandItem,
  type DemandRecalcHistoryItem,
  type DemandSnapshotItem,
} from '../../../../services/demand';
import { getDataDictionaryByCode, getDictionaryItemList } from '../../../../../../services/dataDictionary';
import { alignDescriptionColumns } from '../../../sales-management/shared/documentFieldAlignment';
import { formatDateBySiteSetting, formatDateTimeBySiteSetting, formatQuantity } from '../../../../../../utils/format';
import type { AuditPhaseRecord } from '../../../../../../components/uni-audit/AuditPhaseBadge';

const DEMAND_RESOURCE = 'kuaizhizao:demand';
const PLACEHOLDER: Demand = { id: 0 };

export const DEMAND_WORKFLOW_PROPS = {
  auditNodeKey: 'demand' as const,
  resourcePrefix: DEMAND_RESOURCE,
  unifiedAudit: true,
  statusField: 'status' as const,
  reviewStatusField: 'review_status' as const,
  draftStatuses: [DemandStatus.DRAFT, '草稿'],
  pendingStatuses: [DemandStatus.PENDING_REVIEW, '待审核', '已提交'],
  approvedStatuses: [DemandStatus.AUDITED, '已审核', ReviewStatus.APPROVED, '审核通过', '通过', '已通过'],
  rejectedStatuses: [DemandStatus.REJECTED, '已驳回', ReviewStatus.REJECTED, '审核驳回', '驳回'],
};

function dictLabel(
  map: Record<string, Record<string, string>>,
  code: string,
  value: string | undefined,
): string {
  if (!value) return '-';
  const dict = map[code];
  if (!dict) return value;
  return dict[value] ?? Object.entries(dict).find(([k]) => k.toUpperCase() === value.toUpperCase())?.[1] ?? value;
}

export type DemandDetailDrawerProps = {
  open: boolean;
  onClose: () => void;
  demand: Demand | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  zIndex?: number;
  trackingRefreshKey?: number;
  extra?: React.ReactNode;
  showReadonlyActions?: boolean;
  onWorkflowSuccess?: () => void;
  renderBriefActions?: (doc: TraceBriefDocument) => React.ReactNode;
};

export const DemandDetailReadonlyExtra: React.FC<{
  demand: Demand;
  onWorkflowSuccess?: () => void;
}> = ({ demand, onWorkflowSuccess }) => {
  const { t } = useTranslation();
  return (
    <Space size="small">
      <UniWorkflowActions
        {...rowActionKind('skip')}
        record={demand}
        entityName={t('app.kuaizhizao.demandManagement.entityName')}
        {...DEMAND_WORKFLOW_PROPS}
        theme="default"
        onSuccess={() => onWorkflowSuccess?.()}
      />
    </Space>
  );
};

const DemandHistoryPane: React.FC<{ demandId: number; refreshKey: number }> = ({ demandId, refreshKey }) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const [recalcHistory, setRecalcHistory] = useState<DemandRecalcHistoryItem[]>([]);
  const [recalcHistoryLoading, setRecalcHistoryLoading] = useState(false);
  const [snapshots, setSnapshots] = useState<DemandSnapshotItem[]>([]);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setRecalcHistoryLoading(true);
    setSnapshotsLoading(true);
    void listDemandRecalcHistory(demandId, { limit: 50 })
      .then((history) => {
        if (!cancelled) setRecalcHistory(history);
      })
      .catch(() => {
        if (!cancelled) messageApi.error(t('app.kuaizhizao.demandManagement.recalcHistoryFailed'));
      })
      .finally(() => {
        if (!cancelled) setRecalcHistoryLoading(false);
      });
    void listDemandSnapshots(demandId, { limit: 20 })
      .then((list) => {
        if (!cancelled) setSnapshots(list);
      })
      .catch(() => {
        if (!cancelled) {
          setSnapshots([]);
          messageApi.error(t('app.kuaizhizao.demandManagement.snapshotsFailed'));
        }
      })
      .finally(() => {
        if (!cancelled) setSnapshotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [demandId, refreshKey, messageApi, t]);

  return (
    <div>
      <DetailDrawerSection titleAccent title={t('app.kuaizhizao.demandManagement.recalcHistory')}>
        <Table<DemandRecalcHistoryItem>
          size="small"
          loading={recalcHistoryLoading}
          dataSource={recalcHistory}
          rowKey="id"
          pagination={false}
          columns={[
            {
              title: t('app.kuaizhizao.demandManagement.colRecalcAt'),
              dataIndex: 'recalc_at',
              width: 180,
              render: (val: string) => formatDateTimeBySiteSetting(val),
            },
            {
              title: t('app.kuaizhizao.demandManagement.colTriggerType'),
              dataIndex: 'trigger_type',
              width: 100,
              render: (v: string) =>
                v === 'upstream_change'
                  ? t('app.kuaizhizao.demandManagement.triggerUpstreamChange')
                  : v === 'manual'
                    ? t('app.kuaizhizao.demandManagement.triggerManual')
                    : v || '-',
            },
            {
              title: t('app.kuaizhizao.demandManagement.colSourceType'),
              dataIndex: 'source_type',
              width: 100,
              render: (v: string) =>
                v === 'sales_order'
                  ? t('app.kuaizhizao.salesOrder.entityName')
                  : v === 'sales_forecast'
                    ? t('app.kuaizhizao.salesForecast.title')
                    : v || '-',
            },
            {
              title: t('app.kuaizhizao.demandManagement.colChangeReason'),
              dataIndex: 'trigger_reason',
              ellipsis: true,
              render: (v: string) => v || '-',
            },
            {
              title: t('app.kuaizhizao.demandManagement.colResult'),
              dataIndex: 'result',
              width: 90,
              render: (v: string) =>
                v === 'success'
                  ? t('app.kuaizhizao.demandManagement.resultSuccess')
                  : v === 'failed'
                    ? t('app.kuaizhizao.demandManagement.resultFailed')
                    : v || '-',
            },
            {
              title: t('common.remark'),
              dataIndex: 'message',
              ellipsis: true,
              render: (v: string) => v || '-',
            },
          ]}
        />
      </DetailDrawerSection>
      <DetailDrawerSection titleAccent title={t('app.kuaizhizao.demandManagement.changeSnapshots')}>
        <Table<DemandSnapshotItem>
          size="small"
          loading={snapshotsLoading}
          dataSource={snapshots}
          rowKey="id"
          pagination={false}
          expandable={{
            expandedRowRender: (record) => (
              <div style={{ padding: 8 }}>
                {record.demand_snapshot && (
                  <div style={{ marginBottom: 12 }}>
                    <strong>{t('app.kuaizhizao.demandManagement.snapshotBeforeDemand')}</strong>
                    <pre style={{ margin: '4px 0 0', fontSize: 12, maxHeight: 200, overflow: 'auto' }}>
                      {JSON.stringify(record.demand_snapshot, null, 2)}
                    </pre>
                  </div>
                )}
                {record.demand_items_snapshot && record.demand_items_snapshot.length > 0 && (
                  <>
                    <strong>{t('app.kuaizhizao.demandManagement.snapshotBeforeItems')}</strong>
                    <pre style={{ margin: '4px 0 0', fontSize: 12, maxHeight: 200, overflow: 'auto' }}>
                      {JSON.stringify(record.demand_items_snapshot, null, 2)}
                    </pre>
                  </>
                )}
                {!record.demand_snapshot &&
                (!record.demand_items_snapshot || record.demand_items_snapshot.length === 0) ? (
                  <span style={{ color: '#999' }}>{t('app.kuaizhizao.demandManagement.noDetailData')}</span>
                ) : null}
              </div>
            ),
          }}
          columns={[
            {
              title: t('app.kuaizhizao.demandManagement.colSnapshotAt'),
              dataIndex: 'snapshot_at',
              width: 180,
              render: (val: string) => formatDateTimeBySiteSetting(val),
            },
            {
              title: t('app.kuaizhizao.demandManagement.colSnapshotType'),
              dataIndex: 'snapshot_type',
              width: 120,
              render: (v: string) =>
                v === 'before_recalc' ? t('app.kuaizhizao.demandManagement.snapshotBeforeRecalc') : v || '-',
            },
            {
              title: t('app.kuaizhizao.demandManagement.colChangeReason'),
              dataIndex: 'trigger_reason',
              ellipsis: true,
              render: (v: string) => {
                if (!v) return '-';
                if (v.includes('sales_order')) return t('app.kuaizhizao.demandManagement.changeSalesOrder');
                if (v.includes('sales_forecast')) return t('app.kuaizhizao.demandManagement.changeSalesForecast');
                return v;
              },
            },
          ]}
        />
      </DetailDrawerSection>
    </div>
  );
};

export const DemandDetailDrawer: React.FC<DemandDetailDrawerProps> = ({
  open,
  onClose,
  demand,
  loading = false,
  error = null,
  onRetry,
  zIndex,
  trackingRefreshKey = 0,
  extra,
  showReadonlyActions = true,
  onWorkflowSuccess,
  renderBriefActions,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const linked = useOptionalLinkedDocumentDetail();
  const contentReady = Boolean(demand);
  const showError = Boolean(error) && !contentReady && !loading;
  const showLoading = loading || (!contentReady && !showError);
  const effective = demand ?? PLACEHOLDER;

  const tracking = useDocumentTracking(
    open && contentReady ? 'demand' : undefined,
    effective.id,
    trackingRefreshKey,
  );

  const [dictLabelMap, setDictLabelMap] = useState<Record<string, Record<string, string>>>({});

  useEffect(() => {
    let cancelled = false;
    const loadDicts = async () => {
      const next: Record<string, Record<string, string>> = {};
      for (const code of ['SHIPPING_METHOD', 'PAYMENT_TERMS']) {
        try {
          const dict = await getDataDictionaryByCode(code);
          const items = await getDictionaryItemList(dict.uuid, true);
          next[code] = Object.fromEntries((items || []).map((it) => [it.value, it.label]));
        } catch {
          next[code] = {};
        }
      }
      if (!cancelled) setDictLabelMap(next);
    };
    void loadDicts();
    return () => {
      cancelled = true;
    };
  }, []);

  const formatDemandTypeLabel = useCallback(
    (v: string | undefined | null) => {
      const k = normalizeDemandTypeKey(v);
      if (k === 'sales_forecast') return t('app.kuaizhizao.salesForecast.title');
      if (k === 'sales_order') return t('app.kuaizhizao.salesOrder.entityName');
      if (k === 'demand_plan') return t('app.kuaizhizao.demandManagement.demandTypePlan');
      return v?.trim() || '-';
    },
    [t],
  );

  const formatBusinessModeLabel = useCallback(
    (mode: string | undefined | null) => {
      const m = (mode ?? '').trim();
      if (m === 'MTS') return t('app.kuaizhizao.demandManagement.businessModeMts');
      if (m === 'MTO') return t('app.kuaizhizao.demandManagement.businessModeMto');
      if (m === 'ATO') return t('app.kuaizhizao.demandManagement.businessModeAto');
      return m || '-';
    },
    [t],
  );

  const lifecycle = useMemo(
    () => (contentReady ? getDemandLifecycle(effective as Record<string, unknown>, t) : null),
    [contentReady, effective, t],
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

  const basicColumns = useMemo(() => {
    const cols: ProDescriptionsItemProps<Demand>[] = [
        {
          title: t('app.kuaizhizao.demandManagement.demandCode'),
          dataIndex: 'demand_code',
          render: (_, record) => (
          <Space size={4}>
            <span>{record.demand_code ?? '-'}</span>
            {record.demand_code ? (
              <Tooltip title={t('field.invitationCode.copy')}>
                <Button
                  type="link"
                  size="small"
                  icon={<CopyOutlined style={{ fontSize: 12 }} />}
                  onClick={() => handleCopy(record.demand_code!)}
                />
              </Tooltip>
            ) : null}
          </Space>
        ),
      },
      {
        title: t('app.kuaizhizao.demandManagement.demandType'),
        dataIndex: 'demand_type',
        render: (_, record) => (
          <Tag {...getDemandTypeTagProps(record.demand_type)}>{formatDemandTypeLabel(record.demand_type)}</Tag>
        ),
      },
      { title: t('app.kuaizhizao.demandManagement.demandName'), dataIndex: 'demand_name' },
      {
        title: t('app.kuaizhizao.demandManagement.businessMode'),
        dataIndex: 'business_mode',
        render: (_, record) => (
          <Tag color={getDemandBusinessModeTagColor(record.business_mode)}>
            {formatBusinessModeLabel(record.business_mode)}
          </Tag>
        ),
      },
      { title: t('app.kuaizhizao.salesForecast.startDate'), dataIndex: 'start_date', valueType: 'date' },
      { title: t('app.kuaizhizao.salesForecast.endDate'), dataIndex: 'end_date', valueType: 'date' },
    ];
    if (effective.demand_type === 'sales_forecast') {
      cols.push({
        title: t('app.kuaizhizao.salesForecast.forecastPeriod'),
        dataIndex: 'forecast_period',
      });
    }
    if (effective.demand_type === 'sales_order') {
      cols.push(
        { title: t('app.kuaizhizao.salesOrder.orderDate'), dataIndex: 'order_date', valueType: 'date' },
        { title: t('app.kuaizhizao.salesOrder.deliveryDate'), dataIndex: 'delivery_date', valueType: 'date' },
      );
    }
    cols.push({ title: t('app.kuaizhizao.salesOrder.customerName'), dataIndex: 'customer_name' });
    if (effective.demand_type === 'sales_order') {
      cols.push(
        { title: t('app.kuaizhizao.salesOrder.salesman'), dataIndex: 'salesman_name' },
        { title: t('app.kuaizhizao.salesOrder.shippingAddress'), dataIndex: 'shipping_address', span: 3 },
        {
          title: t('app.kuaizhizao.salesOrder.shippingMethod'),
          dataIndex: 'shipping_method',
          render: (_, record) => dictLabel(dictLabelMap, 'SHIPPING_METHOD', record.shipping_method),
        },
        {
          title: t('app.kuaizhizao.salesOrder.paymentTerms'),
          dataIndex: 'payment_terms',
          render: (_, record) => dictLabel(dictLabelMap, 'PAYMENT_TERMS', record.payment_terms),
        },
      );
    }
    cols.push(
      {
        title: t('app.kuaizhizao.salesOrder.totalQuantity'),
        dataIndex: 'total_quantity',
        render: (_, record) => formatQuantity(record.total_quantity),
      },
      {
        title: t('app.kuaizhizao.demandComputation.colComputationCode'),
        dataIndex: 'computation_code',
        key: 'linked_computation_code',
      },
      { title: t('common.remark'), dataIndex: 'notes', span: 3 },
    );
    return alignDescriptionColumns(cols as ProDescriptionsItemProps<Record<string, unknown>>[]);
  }, [t, effective.demand_type, dictLabelMap, formatDemandTypeLabel, formatBusinessModeLabel, handleCopy]);

  const lineColumns = useMemo(() => {
    const base = [
      { title: t('app.kuaizhizao.salesOrder.materialCode'), dataIndex: 'material_code', width: 120 },
      { title: t('app.kuaizhizao.salesOrder.materialName'), dataIndex: 'material_name', width: 150 },
      { title: t('app.kuaizhizao.salesOrder.materialSpec'), dataIndex: 'material_spec', width: 120 },
      {
        title: t('app.kuaizhizao.salesForecast.variantAttributes'),
        dataIndex: 'variant_attributes',
        width: 140,
        ellipsis: true,
        render: (v: Record<string, unknown> | string | undefined) => {
          if (v == null) return '-';
          if (typeof v === 'string') return v || '-';
          return Object.keys(v).length > 0 ? JSON.stringify(v) : '-';
        },
      },
      {
        title: t('common.unit'),
        dataIndex: 'material_unit',
        width: 80,
        render: (v: string) => <MaterialUnitLabel value={v} />,
      },
      {
        title: t('app.kuaizhizao.planReports.colRequirementQty'),
        dataIndex: 'required_quantity',
        width: 100,
        align: 'right' as const,
        render: (v: number) => formatQuantity(v),
      },
    ];
    if (effective.demand_type === 'sales_forecast') {
      return [
        ...base,
        { title: t('app.kuaizhizao.salesForecast.forecastDate'), dataIndex: 'forecast_date', width: 120 },
        { title: t('app.kuaizhizao.demandManagement.forecastMonth'), dataIndex: 'forecast_month', width: 100 },
      ];
    }
    return [
      ...base,
      {
        title: t('app.kuaizhizao.salesOrder.deliveryDate'),
        dataIndex: 'delivery_date',
        width: 120,
        render: (v: string) => (v ? formatDateBySiteSetting(v) : '-'),
      },
      {
        title: t('app.kuaizhizao.salesOrder.deliveredQty'),
        dataIndex: 'delivered_quantity',
        width: 100,
        align: 'right' as const,
      },
      {
        title: t('app.kuaizhizao.salesOrder.remainingQty'),
        dataIndex: 'remaining_quantity',
        width: 100,
        align: 'right' as const,
      },
    ];
  }, [t, effective.demand_type]);

  const title = demand?.demand_code ? (
    <Space align="center" size={8}>
      <span>{t('app.kuaizhizao.demandManagement.detailTitleWithCode', { code: demand.demand_code })}</span>
      <Tooltip title={t('field.invitationCode.copy')}>
        <Button type="text" size="small" icon={<CopyOutlined />} onClick={() => handleCopy(demand.demand_code!)} />
      </Tooltip>
    </Space>
  ) : (
    t('app.kuaizhizao.demandManagement.detailTitle')
  );

  const timeconfigBasicItems = useDetailDrawerDescriptionItems(
    basicColumns,
    effective as Record<string, unknown>,
    'demand',
  );

  if (!open) return null;

  return (
    <DetailDrawerTemplate
      title={title}
      open={open}
      onClose={onClose}
      width={DRAWER_CONFIG.HALF_WIDTH}
      zIndex={zIndex}
      loading={showLoading}
      banner={
        contentReady && effective.pushed_to_computation && effective.computation_id ? (
          <Alert
            type="info"
            showIcon
            title={t('app.kuaizhizao.demandManagement.alertChangedMessage')}
            description={
              <span>
                {t('app.kuaizhizao.demandManagement.alertPushedDescription')}
                {effective.computation_code && `（${effective.computation_code}）`}
                {t('app.kuaizhizao.demandManagement.alertPushedMiddle')}
                <Button
                  type="link"
                  size="small"
                  style={{ padding: 0 }}
                  onClick={() => {
                    if (effective.computation_id) {
                      linked?.openLinkedDocumentDetail('demand_computation', effective.computation_id);
                    }
                  }}
                >
                  {t('app.kuaizhizao.demandManagement.goToComputation')}
                </Button>
                {t('app.kuaizhizao.demandManagement.recomputeSuffix')}
              </span>
            }
          />
        ) : undefined
      }
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
              <DemandDetailReadonlyExtra demand={effective} onWorkflowSuccess={onWorkflowSuccess} />
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
          <Descriptions column={3} size="small" items={timeconfigBasicItems} />
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
        ) : contentReady ? (
          <Typography.Text type="secondary">{t('app.kuaizhizao.demandManagement.lifecycleEmpty')}</Typography.Text>
        ) : null
      }
      lines={
        contentReady ? (
          effective.items && effective.items.length > 0 ? (
            <Table<DemandItem>
              size="small"
              tableLayout="fixed"
              style={{ minWidth: 900 }}
              columns={lineColumns}
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
              children: <DemandHistoryPane demandId={effective.id} refreshKey={trackingRefreshKey} />,
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
              documentType: 'demand',
              documentId: effective.id,
              selfDocumentId: effective.id,
              renderBriefActions,
            }
          : undefined
      }
    />
  );
};
