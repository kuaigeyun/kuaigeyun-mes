/**
 * 需求计算原版详情抽屉（列表 / 关联嵌套共用）。
 * 单一 DetailDrawerTemplate：加载中遮罩，失败 Result+重试。
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  App,
  Alert,
  Button,
  Descriptions,
  Empty,
  Modal,
  Result,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import { CopyOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import type { ProDescriptionsItemProps } from '@ant-design/pro-components'
import {
  DetailDrawerTemplate,
  DetailDrawerSection,
  DRAWER_CONFIG,
  useDetailDrawerDescriptionItems,
  type TraceBriefDocument,
} from '../../../../../../components/layout-templates'
import { UniLifecycleStepper } from '../../../../../../components/uni-lifecycle'
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../../components/document-tracking-panel'
import { DemandComputationSourceCode } from '../../../../../../components/linked-document-code/DemandComputationSourceCode'
import { MaterialStackedCell } from '../../../../../../components/uni-table/stackedPrimaryColumn'
import { MaterialUnitSelect, prefetchMaterialsForUnitSelect } from '../../../../../../components/material-unit-select'
import { getDemandComputationLifecycle } from '../../../../utils/demandComputationLifecycle'
import { getDemandBusinessModeLabel, getDemandBusinessModeTagColor } from '../../../../utils/businessMode'
import { renderDemandTypeMarkerTag } from '../../../../utils/demandType'
import {
  getComputationSnapshot,
  getPushRecords,
  getComputationDynamicMonitor,
  listComputationRecalcHistory,
  validateMaterialSources,
  type ComputationRecalcHistoryItem,
  type ComputationSnapshotItem,
  type DemandComputation,
  type DemandComputationItem,
  type MaterialSourceValidationResponse,
  type PushRecordItem,
} from '../../../../services/demand-computation'
import { alignDescriptionColumns } from '../../../sales-management/shared/documentFieldAlignment'
import { formatDateTimeBySiteSetting, formatQuantity } from '../../../../../../utils/format'
import {
  getMaterialSourceTypeLabel,
  getMaterialSourceTypeTagColor,
} from '../../../../../master-data/utils/materialSourceType'
import { renderAvailableInventoryCell } from './availableInventoryCell'
import { MrpMaterialPlanPanel } from './MrpMaterialPlanPanel'
import { mrpExceptionListHasError } from './mrpExceptionHelpers'
import { useResourcePermissions } from '../../../../../../hooks/useResourcePermissions'

const DEMAND_COMPUTATION_RESOURCE = 'plan-management-demand-computation'

const PLACEHOLDER: DemandComputation = { id: 0 }
const DEMAND_COMPUTATION_DETAIL_ITEMS_MIN_WIDTH = 1920

function normalizeComputationSourceNote(computation: DemandComputation | undefined, t: TFunction): string {
  const raw = String(computation?.notes || '').trim()
  if (!raw) return ''

  const demandNo = String(computation?.demand_code || '').trim()
  const sourceNoFromRaw =
    raw.match(/^从需求\s+(.+?)\s+(?:下推)?创建$/)?.[1]?.trim() ??
    raw.match(/^从需求计划\s+(.+?)\s+(?:下推)?创建$/)?.[1]?.trim() ??
    raw.match(/^从销售订单\s+(.+?)\s+(?:下推)?创建$/)?.[1]?.trim() ??
    raw.match(/^从销售预测\s+(.+?)\s+(?:下推)?创建$/)?.[1]?.trim()

  const sourceNo = demandNo || sourceNoFromRaw || ''

  if (
    /^从需求\s+.+\s+(?:下推)?创建$/.test(raw) ||
    /^从需求计划\s+.+\s+(?:下推)?创建$/.test(raw) ||
    /^从销售订单\s+.+\s+(?:下推)?创建$/.test(raw) ||
    /^从销售预测\s+.+\s+(?:下推)?创建$/.test(raw)
  ) {
    if (computation?.demand_type === 'sales_order') {
      return t('app.kuaizhizao.demandComputation.sourceNoteFromSalesOrder', { code: sourceNo }).trim()
    }
    if (computation?.demand_type === 'sales_forecast') {
      return t('app.kuaizhizao.demandComputation.sourceNoteFromSalesForecast', { code: sourceNo }).trim()
    }
    return t('app.kuaizhizao.demandComputation.sourceNoteFromDemandPlan', { code: sourceNo }).trim()
  }

  return raw
}

function getPushDocTypeLabel(t: TFunction, type?: string): string {
  const map: Record<string, string> = {
    work_order: t('app.kuaizhizao.demandComputation.pushDocWorkOrder'),
    outsource_work_order: t('app.kuaizhizao.demandComputation.pushDocOutsourceWorkOrder'),
    purchase_order: t('app.kuaizhizao.demandComputation.pushDocPurchaseOrder'),
    purchase_requisition: t('app.kuaizhizao.demandComputation.pushDocPurchaseRequisition'),
  }
  return map[type || ''] || type || '-'
}

const ComputationHistoryPane: React.FC<{
  computationId: number
  refreshKey: number
  zIndex?: number
}> = ({ computationId, refreshKey, zIndex }) => {
  const { t } = useTranslation()
  const { message: messageApi } = App.useApp()
  const [pushRecords, setPushRecords] = useState<PushRecordItem[]>([])
  const [pushRecordsLoading, setPushRecordsLoading] = useState(false)
  const [recalcHistory, setRecalcHistory] = useState<ComputationRecalcHistoryItem[]>([])
  const [recalcHistoryLoading, setRecalcHistoryLoading] = useState(false)
  const [snapshotOpen, setSnapshotOpen] = useState(false)
  const [snapshotLoading, setSnapshotLoading] = useState(false)
  const [snapshotData, setSnapshotData] = useState<ComputationSnapshotItem | null>(null)

  useEffect(() => {
    let cancelled = false
    setPushRecordsLoading(true)
    setRecalcHistoryLoading(true)
    void getPushRecords(computationId)
      .then((res) => {
        if (!cancelled) setPushRecords(res.records || [])
      })
      .catch(() => {
        if (!cancelled) messageApi.error(t('app.kuaizhizao.demandComputation.fetchPushRecordsFailed'))
      })
      .finally(() => {
        if (!cancelled) setPushRecordsLoading(false)
      })
    void listComputationRecalcHistory(computationId, { limit: 50 })
      .then((rows) => {
        if (!cancelled) setRecalcHistory(rows)
      })
      .catch(() => {
        if (!cancelled) messageApi.error(t('app.kuaizhizao.demandComputation.fetchRecalcHistoryFailed'))
      })
      .finally(() => {
        if (!cancelled) setRecalcHistoryLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [computationId, refreshKey, messageApi, t])

  const openSnapshot = async (snapshotId: number) => {
    setSnapshotOpen(true)
    setSnapshotLoading(true)
    setSnapshotData(null)
    try {
      setSnapshotData(await getComputationSnapshot(computationId, snapshotId))
    } catch {
      messageApi.error(t('app.kuaizhizao.demandComputation.fetchSnapshotFailed'))
      setSnapshotOpen(false)
    } finally {
      setSnapshotLoading(false)
    }
  }

  return (
    <>
      <DetailDrawerSection titleAccent title={t('app.kuaizhizao.demandComputation.pushRecords')}>
        <Table<PushRecordItem>
          size="small"
          loading={pushRecordsLoading}
          dataSource={pushRecords}
          rowKey={(r) => `${r.target_type}-${r.target_id}`}
          scroll={{ x: 'max-content' }}
          pagination={false}
          columns={[
            {
              title: t('app.kuaizhizao.demandComputation.colDocumentType'),
              dataIndex: 'target_type',
              width: 112,
              ellipsis: true,
              render: (targetType: string) => getPushDocTypeLabel(t, targetType),
            },
            {
              title: t('app.kuaizhizao.demandComputation.colDocumentCode'),
              dataIndex: 'target_code',
              width: 220,
              ellipsis: true,
            },
            {
              title: t('app.kuaizhizao.demandComputation.colDocumentName'),
              dataIndex: 'target_name',
              width: 280,
              ellipsis: true,
            },
            {
              title: t('app.kuaizhizao.demandComputation.colPushTime'),
              dataIndex: 'created_at',
              width: 176,
              render: (createdAt: string) => (createdAt ? formatDateTimeBySiteSetting(createdAt) : '—'),
            },
            {
              title: t('app.kuaizhizao.demandComputation.colStatus'),
              dataIndex: 'target_exists',
              width: 88,
              render: (exists: boolean) =>
                exists ? (
                  <Tag color="success">{t('app.kuaizhizao.demandComputation.statusNormal')}</Tag>
                ) : (
                  <Tag color="default">{t('app.kuaizhizao.demandComputation.statusDeleted')}</Tag>
                ),
            },
          ]}
        />
      </DetailDrawerSection>
      <DetailDrawerSection titleAccent title={t('app.kuaizhizao.demandComputation.recalcHistory')}>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 8, fontSize: 12 }}>
          {t('app.kuaizhizao.demandComputation.recalcHistoryHint')}
        </Typography.Paragraph>
        <Table<ComputationRecalcHistoryItem>
          size="small"
          loading={recalcHistoryLoading}
          dataSource={recalcHistory}
          rowKey="id"
          scroll={{ x: 'max-content' }}
          pagination={false}
          columns={[
            {
              title: t('app.kuaizhizao.demandComputation.colRecalcTime'),
              dataIndex: 'recalc_at',
              width: 180,
              render: (recalcAt: string) => (recalcAt ? formatDateTimeBySiteSetting(recalcAt) : '-'),
            },
            { title: t('app.kuaizhizao.demandComputation.colTrigger'), dataIndex: 'trigger', width: 120 },
            { title: t('app.kuaizhizao.demandComputation.colResult'), dataIndex: 'result', width: 80 },
            {
              title: t('app.kuaizhizao.demandComputation.colSnapshot'),
              key: 'snapshot',
              width: 108,
              render: (_: unknown, r: ComputationRecalcHistoryItem) =>
                r.snapshot_id != null ? (
                  <Button type="link" size="small" style={{ padding: 0 }} onClick={() => void openSnapshot(r.snapshot_id!)}>
                    {t('app.kuaizhizao.demandComputation.actionView')}
                  </Button>
                ) : (
                  <span style={{ color: 'var(--ant-color-text-secondary)' }}>—</span>
                ),
            },
            { title: t('app.kuaizhizao.demandComputation.colNotes'), dataIndex: 'message', ellipsis: true },
          ]}
        />
      </DetailDrawerSection>
      <Modal
        title={t('app.kuaizhizao.demandComputation.snapshotTitle')}
        open={snapshotOpen}
        zIndex={(zIndex ?? 1000) + 80}
        onCancel={() => {
          setSnapshotOpen(false)
          setSnapshotData(null)
        }}
        footer={null}
        width={720}
        destroyOnHidden
      >
        {snapshotLoading ? (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <Spin />
          </div>
        ) : snapshotData ? (
          <div style={{ maxHeight: '70vh', overflow: 'auto' }}>
            {snapshotData.snapshot_at ? (
              <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
                {t('app.kuaizhizao.demandComputation.snapshotAt', {
                  time: formatDateTimeBySiteSetting(snapshotData.snapshot_at),
                })}
                {snapshotData.trigger
                  ? t('app.kuaizhizao.demandComputation.snapshotTrigger', { trigger: snapshotData.trigger })
                  : null}
              </Typography.Paragraph>
            ) : null}
            {snapshotData.computation_summary_snapshot ? (
              <div style={{ marginBottom: 16 }}>
                <Typography.Text strong>{t('app.kuaizhizao.demandComputation.snapshotSummary')}</Typography.Text>
                <pre
                  style={{
                    margin: '8px 0 0',
                    padding: 12,
                    fontSize: 12,
                    background: 'var(--ant-color-fill-quaternary)',
                    borderRadius: 8,
                    overflow: 'auto',
                    maxHeight: 320,
                  }}
                >
                  {JSON.stringify(snapshotData.computation_summary_snapshot, null, 2)}
                </pre>
              </div>
            ) : null}
            {snapshotData.items_snapshot && snapshotData.items_snapshot.length > 0 ? (
              <div>
                <Typography.Text strong>{t('app.kuaizhizao.demandComputation.snapshotItems')}</Typography.Text>
                <pre
                  style={{
                    margin: '8px 0 0',
                    padding: 12,
                    fontSize: 12,
                    background: 'var(--ant-color-fill-quaternary)',
                    borderRadius: 8,
                    overflow: 'auto',
                    maxHeight: 320,
                  }}
                >
                  {JSON.stringify(snapshotData.items_snapshot, null, 2)}
                </pre>
              </div>
            ) : null}
            {!snapshotData.computation_summary_snapshot &&
            (!snapshotData.items_snapshot || snapshotData.items_snapshot.length === 0) ? (
              <Typography.Text type="secondary">{t('app.kuaizhizao.demandComputation.snapshotEmpty')}</Typography.Text>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </>
  )
}

export type DemandComputationDetailDrawerProps = {
  open: boolean
  onClose: () => void
  computation: DemandComputation | null
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  onRefresh?: () => void
  zIndex?: number
  trackingRefreshKey?: number
  /** 从例外收件箱打开时自动弹出对应物料 MRP 分日净算面板 */
  initialFocusItemId?: number | null
  extra?: React.ReactNode
  renderBriefActions?: (doc: TraceBriefDocument) => React.ReactNode
}

export const DemandComputationDetailDrawer: React.FC<DemandComputationDetailDrawerProps> = ({
  open,
  onClose,
  computation,
  loading = false,
  error = null,
  onRetry,
  onRefresh,
  zIndex,
  trackingRefreshKey = 0,
  initialFocusItemId = null,
  extra,
  renderBriefActions,
}) => {
  const { t } = useTranslation()
  const { message: messageApi, modal: modalApi } = App.useApp()
  const computationPerms = useResourcePermissions(DEMAND_COMPUTATION_RESOURCE)
  const contentReady = Boolean(computation)
  const showError = Boolean(error) && !contentReady && !loading
  const showLoading = loading || (!contentReady && !showError)
  const effective = computation ?? PLACEHOLDER
  const computationCompleted = effective.computation_status === '完成'

  const [planPanelItem, setPlanPanelItem] = useState<DemandComputationItem | null>(null)
  const [dynamicMonitor, setDynamicMonitor] = useState<Awaited<
    ReturnType<typeof getComputationDynamicMonitor>
  > | null>(null)
  const [monitorLoading, setMonitorLoading] = useState(false)

  const tracking = useDocumentTracking(
    open && contentReady ? 'demand_computation' : undefined,
    effective.id,
    trackingRefreshKey,
  )

  const [validationResults, setValidationResults] = useState<MaterialSourceValidationResponse | null>(null)

  const handleCopy = useCallback(
    (text: string) => {
      if (!text?.trim()) return
      void navigator.clipboard.writeText(text).then(
        () => messageApi.success(t('app.kuaizhizao.demandComputation.copied')),
        () => messageApi.error(t('app.kuaizhizao.demandComputation.copyFailed')),
      )
    },
    [messageApi, t],
  )

  useEffect(() => {
    if (!open || !effective.id) {
      setValidationResults(null)
      return
    }
    let cancelled = false
    void prefetchMaterialsForUnitSelect((effective.items || []).map((i) => i.material_id))
    void validateMaterialSources(effective.id)
      .then((validation) => {
        if (!cancelled) setValidationResults(validation)
      })
      .catch(() => {
        if (!cancelled) setValidationResults(null)
      })
    return () => {
      cancelled = true
    }
  }, [open, effective.id, trackingRefreshKey, effective.items])

  useEffect(() => {
    if (!open || !effective.id || !computationCompleted) {
      setDynamicMonitor(null)
      return
    }
    let cancelled = false
    setMonitorLoading(true)
    void getComputationDynamicMonitor(effective.id)
      .then((data) => {
        if (!cancelled) setDynamicMonitor(data)
      })
      .catch(() => {
        if (!cancelled) setDynamicMonitor(null)
      })
      .finally(() => {
        if (!cancelled) setMonitorLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, effective.id, computationCompleted, trackingRefreshKey])

  useEffect(() => {
    if (!planPanelItem?.id || !effective.items?.length) return
    const updated = effective.items.find((i) => i.id === planPanelItem.id)
    if (updated) setPlanPanelItem(updated)
  }, [effective.items, planPanelItem?.id])

  useEffect(() => {
    if (!open || !initialFocusItemId || !effective.items?.length) return
    const item = effective.items.find((i) => i.id === initialFocusItemId)
    if (item) setPlanPanelItem(item)
  }, [open, initialFocusItemId, effective.items])

  const lifecycle = useMemo(
    () => (contentReady ? getDemandComputationLifecycle(effective, t) : null),
    [contentReady, effective, t],
  )
  const nextSteps = lifecycle?.nextStepSuggestions
  const showNextInTitle = Boolean(nextSteps?.length)

  const basicColumns = useMemo(() => {
    const cols: ProDescriptionsItemProps<DemandComputation>[] = [
      {
        title: t('app.kuaizhizao.demandComputation.colComputationCode'),
        dataIndex: 'computation_code',
        render: (_, record) => (
          <Space size={4}>
            <span>{record.computation_code ?? '—'}</span>
            {record.computation_code ? (
              <Tooltip title={t('field.invitationCode.copy')}>
                <Button
                  type="link"
                  size="small"
                  icon={<CopyOutlined style={{ fontSize: 12 }} />}
                  onClick={() => handleCopy(record.computation_code!)}
                />
              </Tooltip>
            ) : null}
          </Space>
        ),
      },
        {
          title: t('app.kuaizhizao.demandComputation.colSourceNo'),
          dataIndex: 'demand_code',
          key: 'linked_demand_code',
          render: (_, record) => (
            <DemandComputationSourceCode
              demandCode={record.demand_code}
              demandType={record.demand_type}
              demandId={record.demand_id}
              demandIds={record.demand_ids}
              sourceId={record.source_id}
              sourceLabel={record.source_label}
            />
          ),
        },
        {
          title: t('app.kuaizhizao.demandComputation.colComputationType'),
          dataIndex: 'computation_type',
          render: () => t('app.kuaizhizao.demandComputation.computationTypeMrp'),
        },
        {
          title: t('app.kuaizhizao.demandComputation.colBusinessMode'),
          dataIndex: 'business_mode',
          render: (_, record) => (
            <Tag color={getDemandBusinessModeTagColor(record.business_mode)}>
              {getDemandBusinessModeLabel(record.business_mode)}
            </Tag>
          ),
        },
        {
          title: t('app.kuaizhizao.demandComputation.colSourceType'),
          dataIndex: 'demand_type',
          render: (_, record) => renderDemandTypeMarkerTag(t, record.demand_type),
        },
        {
          title: t('app.kuaizhizao.demandComputation.colStartTime'),
          dataIndex: 'computation_start_time',
          valueType: 'dateTime',
        },
        {
          title: t('app.kuaizhizao.demandComputation.colEndTime'),
          dataIndex: 'computation_end_time',
          valueType: 'dateTime',
        },
        {
          title: t('app.kuaizhizao.demandComputation.colNotes'),
          dataIndex: 'notes',
          span: 3,
          render: (_, record) => normalizeComputationSourceNote(record, t) || '—',
        },
    ]
    return alignDescriptionColumns(cols as unknown as ProDescriptionsItemProps<Record<string, unknown>>[])
  }, [t, handleCopy])

  const title = computation?.computation_code ? (
    <Space align="center" size={8}>
      <span>{t('app.kuaizhizao.demandComputation.detailTitleWithCode', { code: computation.computation_code })}</span>
      <Tooltip title={t('field.invitationCode.copy')}>
        <Button type="text" size="small" icon={<CopyOutlined />} onClick={() => handleCopy(computation.computation_code!)} />
      </Tooltip>
    </Space>
  ) : (
    t('app.kuaizhizao.demandComputation.detailTitle')
  )

  const timeconfigBasicItems = useDetailDrawerDescriptionItems(
    basicColumns, effective as Record<string, unknown>,
    'demand_computation',
  );

  if (!open) return null

  return (
    <>
      <DetailDrawerTemplate
        title={title}
        open={open}
        onClose={onClose}
        width={DRAWER_CONFIG.HALF_WIDTH}
        zIndex={zIndex}
        className="demand-computation-drawer"
        loading={showLoading}
        extra={contentReady ? extra ?? null : null}
        collaborationTitleSuffix={
          contentReady && showNextInTitle ? (
            <Typography.Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>
              {t('components.uniLifecycle.nextStep')}：
              {nextSteps!.join(t('components.uniLifecycle.nextStepSeparator'))}
            </Typography.Text>
          ) : undefined
        }
        collaborationAuditRecord={contentReady ? (effective as never) : null}
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
        basic={
          contentReady ? (
            <div>
              {dynamicMonitor &&
              (dynamicMonitor.has_upstream_change || dynamicMonitor.has_downstream_risk) ? (
                <Alert
                  type="warning"
                  showIcon
                  style={{ marginBottom: 12 }}
                  title={t('app.kuaizhizao.demandComputation.dynamicMonitorTitle')}
                  description={
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {[...(dynamicMonitor.upstream_alerts || []), ...(dynamicMonitor.downstream_alerts || [])].map(
                        (a, idx) => (
                          <li key={idx}>{a.message}</li>
                        ),
                      )}
                    </ul>
                  }
                />
              ) : monitorLoading ? (
                <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                  {t('app.kuaizhizao.demandComputation.dynamicMonitorLoading')}
                </Typography.Text>
              ) : null}
              <Descriptions column={3} size="small" items={timeconfigBasicItems} />
              {validationResults ? (
                <div style={{ marginTop: 12 }}>
                  <Space size={16} wrap>
                    <span>
                      {t('app.kuaizhizao.demandComputation.sourceValidation')}：
                      <Tag color={validationResults.all_passed ? 'success' : 'error'} style={{ marginInlineStart: 8 }}>
                        {validationResults.all_passed
                          ? t('app.kuaizhizao.demandComputation.validationAllPassed')
                          : t('app.kuaizhizao.demandComputation.validationHasFailed')}
                      </Tag>
                    </span>
                    <span>
                      {t('app.kuaizhizao.demandComputation.validationCounts')}：
                      {`${validationResults.passed_count ?? 0} / ${validationResults.failed_count ?? 0} / ${validationResults.total_count ?? 0}`}
                    </span>
                  </Space>
                  {validationResults.failed_count > 0 ? (
                    <div style={{ marginTop: 12 }}>
                      <Typography.Text strong type="danger">
                        {t('app.kuaizhizao.demandComputation.validationFailedMaterialsDetail')}
                      </Typography.Text>
                      <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20 }}>
                        {validationResults.validation_results
                          .filter((r) => !r.validation_passed)
                          .map((r, index) => (
                            <li key={index} style={{ marginBottom: 4 }}>
                              <strong>{r.material_code}</strong> ({r.material_name}): {r.errors.join(', ')}
                            </li>
                          ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
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
            <Typography.Text type="secondary">{t('app.kuaizhizao.demandComputation.noStageData')}</Typography.Text>
          ) : null
        }
        lines={
          contentReady ? (
            effective.items && effective.items.length > 0 ? (
              <Table<DemandComputationItem>
                size="small"
                dataSource={effective.items}
                rowKey="id"
                tableLayout="fixed"
                scroll={{ x: DEMAND_COMPUTATION_DETAIL_ITEMS_MIN_WIDTH }}
                style={{ minWidth: DEMAND_COMPUTATION_DETAIL_ITEMS_MIN_WIDTH }}
                pagination={false}
                columns={[
                  {
                    title: t('app.kuaizhizao.demandComputation.colMaterial'),
                    key: 'material',
                    width: 220,
                    render: (_: unknown, record: DemandComputationItem) => (
                      <MaterialStackedCell
                        material_name={record.material_name}
                        material_code={record.material_code}
                        material_spec={record.material_spec}
                      />
                    ),
                  },
                  {
                    title: t('app.kuaizhizao.demandComputation.colUnit'),
                    dataIndex: 'material_unit',
                    width: 88,
                    render: (_: unknown, record: DemandComputationItem) => (
                      <MaterialUnitSelect
                        materialId={record.material_id}
                        value={record.material_unit}
                        size="small"
                        disabled
                        noStyle
                      />
                    ),
                  },
                  {
                    title: t('app.kuaizhizao.demandComputation.colRequiredQty'),
                    dataIndex: 'required_quantity',
                    width: 96,
                    align: 'right',
                    render: formatQuantity,
                  },
                  {
                    title: t('app.kuaizhizao.demandComputation.colAvailableInventory'),
                    dataIndex: 'available_inventory',
                    width: 96,
                    align: 'right',
                    render: (v: number, record: DemandComputationItem) =>
                      renderAvailableInventoryCell(v, record.detail_results as Record<string, unknown> | undefined),
                  },
                  {
                    title: t('app.kuaizhizao.demandComputation.colNetRequirement'),
                    dataIndex: 'net_requirement',
                    width: 90,
                    align: 'right',
                    render: (v) => <span style={{ fontWeight: 'bold' }}>{v}</span>,
                  },
                  {
                    title: (
                      <Tooltip title={t('app.kuaizhizao.demandComputation.readinessTooltip')}>
                        <span>{t('app.kuaizhizao.demandComputation.colReadinessStatus')}</span>
                      </Tooltip>
                    ),
                    dataIndex: 'readiness_status',
                    width: 148,
                    render: (status: string, record: DemandComputationItem) => {
                      const map: Record<string, { label: string; color: string }> = {
                        Ready: { label: t('app.kuaizhizao.demandComputation.readinessReady'), color: 'success' },
                        Partial: { label: t('app.kuaizhizao.demandComputation.readinessPartial'), color: 'warning' },
                        Shortage: { label: t('app.kuaizhizao.demandComputation.readinessShortage'), color: 'error' },
                      }
                      const info = map[status || 'Shortage'] || {
                        label: t('app.kuaizhizao.demandComputation.statusUnknown'),
                        color: 'default',
                      }
                      const rate = record.readiness_rate
                      const pctLabel =
                        rate != null && rate < 1
                          ? (() => {
                              const p = Number(rate) * 100
                              if (p <= 0) return '0%'
                              if (p < 0.1) return '<0.1%'
                              if (p < 1) return `${p.toFixed(1)}%`
                              return `${Math.round(p)}%`
                            })()
                          : null
                      return (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                          <Tag color={info.color} style={{ margin: 0, flexShrink: 0 }}>
                            {info.label}
                          </Tag>
                          {pctLabel ? (
                            <span style={{ fontSize: 12, color: 'var(--ant-color-text-secondary)' }}>{pctLabel}</span>
                          ) : null}
                        </span>
                      )
                    },
                  },
                  {
                    title: t('app.kuaizhizao.demandComputation.colMaterialSource'),
                    dataIndex: 'material_source_type',
                    width: 96,
                    render: (type: string) => {
                      const label = getMaterialSourceTypeLabel(type, t)
                      return <Tag color={getMaterialSourceTypeTagColor(type)}>{label}</Tag>
                    },
                  },
                  {
                    title: t('app.kuaizhizao.demandComputation.colDeliveryRequirement'),
                    dataIndex: 'delivery_date',
                    width: 300,
                    render: (date: string, record: DemandComputationItem) => {
                      const startDate = record.production_start_date || record.procurement_start_date
                      const isRisk = record.is_overdue_risk
                      return (
                        <div style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
                          <span style={{ color: isRisk ? '#ff4d4f' : 'inherit', fontWeight: isRisk ? 'bold' : 'normal' }}>
                            {date || '—'}
                          </span>
                          {isRisk ? (
                            <Tag color="error" style={{ marginLeft: 6, fontSize: 10 }}>
                              {t('app.kuaizhizao.demandComputation.deliveryRisk')}
                            </Tag>
                          ) : null}
                          {startDate ? (
                            <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--ant-color-text-secondary)' }}>
                              {t('app.kuaizhizao.demandComputation.plannedStart', { date: startDate })}
                            </span>
                          ) : null}
                        </div>
                      )
                    },
                  },
                  {
                    title: t('app.kuaizhizao.demandComputation.colSuggestedWorkOrder'),
                    dataIndex: 'suggested_work_order_quantity',
                    width: 100,
                    align: 'right',
                    render: (v: number, r: DemandComputationItem) =>
                      r.material_source_type === 'Outsource' ? '-' : (v ?? '-'),
                  },
                  {
                    title: t('app.kuaizhizao.demandComputation.colSuggestedOutsource'),
                    dataIndex: 'suggested_work_order_quantity',
                    width: 100,
                    align: 'right',
                    render: (v: number, r: DemandComputationItem) =>
                      r.material_source_type === 'Outsource' ? (v ?? '-') : '-',
                  },
                  {
                    title: t('app.kuaizhizao.demandComputation.colSuggestedPurchase'),
                    dataIndex: 'suggested_purchase_order_quantity',
                    width: 100,
                    align: 'right',
                  },
                  {
                    title: t('app.kuaizhizao.demandComputation.colMrpExceptions'),
                    dataIndex: 'id',
                    width: 88,
                    render: (_: unknown, record: DemandComputationItem) => {
                      const exceptions = Array.isArray(record.detail_results?.exceptions)
                        ? record.detail_results.exceptions
                        : []
                      if (!exceptions.length) return '-'
                      const listColor = mrpExceptionListHasError(exceptions) ? 'error' : 'warning'
                      return (
                        <Button
                          type="link"
                          size="small"
                          danger={listColor === 'error'}
                          onClick={() => setPlanPanelItem(record)}
                        >
                          {t('app.kuaizhizao.demandComputation.mrpExceptionCount', { count: exceptions.length })}
                        </Button>
                      )
                    },
                  },
                  {
                    title: t('app.kuaizhizao.demandComputation.colMrpPlanDetail'),
                    dataIndex: 'id',
                    width: 88,
                    render: (_: unknown, record: DemandComputationItem) => {
                      const detail = record.detail_results as Record<string, unknown> | undefined
                      const buckets = Array.isArray(detail?.time_buckets) ? detail.time_buckets.length : 0
                      const supply = (detail?.supply_calculation || {}) as Record<string, unknown>
                      const planned = Array.isArray(supply.planned_orders) ? supply.planned_orders.length : 0
                      if (!buckets && !planned) return '-'
                      return (
                        <Button type="link" size="small" onClick={() => setPlanPanelItem(record)}>
                          {t('app.kuaizhizao.demandComputation.actionMrpPlanDetail')}
                        </Button>
                      )
                    },
                  },
                  {
                    title: t('app.kuaizhizao.demandComputation.colTraceability'),
                    dataIndex: 'id',
                    width: 72,
                    render: (_: unknown, record: DemandComputationItem) => {
                      const ids =
                        (Array.isArray(record.demand_item_ids) && record.demand_item_ids.length
                          ? record.demand_item_ids
                          : null) ||
                        (Array.isArray(record.detail_results?.demand_item_ids)
                          ? record.detail_results.demand_item_ids
                          : []) ||
                        []
                      return (
                        <Button
                          type="link"
                          size="small"
                          disabled={!ids.length}
                          onClick={() => {
                            modalApi.info({
                              title: t('app.kuaizhizao.demandComputation.traceTitle'),
                              content: (
                                <div>
                                  <p>{t('app.kuaizhizao.demandComputation.traceContent')}</p>
                                  <ul style={{ maxHeight: 300, overflow: 'auto' }}>
                                    {ids.map((id: number, idx: number) => (
                                      <li key={idx}>{t('app.kuaizhizao.demandComputation.traceItemId', { id })}</li>
                                    ))}
                                  </ul>
                                  <p style={{ color: '#999', fontSize: 12 }}>
                                    {t('app.kuaizhizao.demandComputation.traceHint')}
                                  </p>
                                </div>
                              ),
                            })
                          }}
                        >
                          {t('app.kuaizhizao.demandComputation.actionTrace')}
                        </Button>
                      )
                    },
                  },
                ]}
              />
            ) : (
              <Empty description={t('app.kuaizhizao.demandComputation.noComputationItems')} />
            )
          ) : null
        }
        historyTab={
          contentReady && effective.id
            ? {
                documentId: effective.id,
                label: t('app.kuaizhizao.demandComputation.drawerTabRecords'),
                children: (
                  <ComputationHistoryPane
                    computationId={effective.id}
                    refreshKey={trackingRefreshKey}
                    zIndex={zIndex}
                  />
                ),
              }
            : undefined
        }
        timeline={
          contentReady ? (
            tracking.data && !tracking.loading ? (
              <DocumentTrackingTimelineBody data={tracking.data} />
            ) : tracking.error ? (
              <Typography.Text type="danger">{tracking.error}</Typography.Text>
            ) : tracking.loading ? (
              <Spin />
            ) : (
              <Typography.Text type="secondary">{t('app.kuaizhizao.demandComputation.noTimeline')}</Typography.Text>
            )
          ) : null
        }
        traceDocument={
          contentReady && effective.id != null
            ? {
                documentType: 'demand_computation',
                documentId: effective.id,
                selfDocumentId: effective.id,
                renderBriefActions,
              }
            : undefined
        }
      />
      <MrpMaterialPlanPanel
        open={Boolean(planPanelItem)}
        onClose={() => setPlanPanelItem(null)}
        computationId={effective.id}
        item={planPanelItem}
        computationCompleted={computationCompleted}
        canFirm={computationPerms.canUpdate}
        onFirmChanged={() => {
          onRefresh?.()
        }}
      />
    </>
  )
}
