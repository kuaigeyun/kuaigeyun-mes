import { renderRowActionsOverflow, rowActionKind } from '../../../../../components/uni-action';
/**
 * 统一需求计算页面
 *
 * 提供统一的需求计算功能（计算类型恒为 MRP；MTS/MTO 由业务模式区分）。
 *
 * 根据《☆ 用户使用全场景推演.md》的设计理念，将MRP和LRP合并为统一的需求计算。
 *
 * @author Luigi Lu
 * @date 2025-01-14
 */

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ActionType,
  ProColumns,
  ProForm,
  ProFormSelect,
  ProFormTextArea,
  ProDescriptions,
  ProFormDependency,
} from '@ant-design/pro-components'
import {
  App,
  Button,
  Tag,
  Space,
  Modal,
  Popover,
  Table,
  Switch,
  Input,
  Select,
  Tabs,
  Radio,
  Empty,
  Row,
  Col,
  InputNumber,
  Dropdown,
  Typography,
  Descriptions,
  Tooltip,
  Spin,
  Divider,
  theme,
} from 'antd'
import {
  PlayCircleOutlined,
  ReloadOutlined,
  WarningOutlined,
  CopyOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { UniTable } from '../../../../../components/uni-table'
import { UniCapabilityBatchButton } from '../../../../../components/uni-batch'
import { MaterialStackedCell } from '../../../../../components/uni-table/stackedPrimaryColumn'
import { UniLifecycle, UniLifecycleStepper } from '../../../../../components/uni-lifecycle'
import {
  MultiTabListPageTemplate,
  DetailDrawerSection,
  DetailDrawerInlineFullChain,
  DetailDrawerTemplate,
  DRAWER_CONFIG,
  MODAL_CONFIG,
  FormModalTemplate,
  type StatCard,
} from '../../../../../components/layout-templates'
import { UniPullCreateToolbar } from '../../../../../components/uni-pull'
import { UniPullQueryModal, useUniPullQuery } from '../../../../../components/uni-pull-query'
import { buildUniPushMenuItems, UniPushToolbarButton } from '../../../../../components/uni-push'
import {
  DocumentTrackingTimelineBody,
  useDocumentTracking,
} from '../../../../../components/document-tracking-panel'
import { WarehouseTraceBriefPrimaryActions } from '../../warehouse-management/WarehouseTraceBriefFooter'
import {
  listDemandComputations,
  getDemandComputation,
  createDemandComputation,
  previewExecuteDemandComputation,
  executeDemandComputation,
  recomputeDemandComputation,
  deleteDemandComputation,
  getPushOptions,
  getPushPreview,
  pushAll,
  validateMaterialSources,
  getMaterialSources,
  getDemandComputationStatistics,
  type PushOptions,
  type PushPreview,
  listComputationRecalcHistory,
  getComputationSnapshot,
  getPushRecords,
  DemandComputation,
  DemandComputationItem,
  ComputationRecalcHistoryItem,
  ComputationSnapshotItem,
  type PushRecordItem,
} from '../../../services/demand-computation'
import { getDemandComputationLifecycle } from '../../../utils/demandComputationLifecycle'
import { getDemandBusinessModeLabel, getDemandBusinessModeTagColor } from '../../../utils/businessMode'
import { getDemandTypeLabel, getDemandTypeTagProps } from '../../../utils/demandType'
import { getDocumentLifecycleStageTagProps } from '../../../../../utils/documentLifecycleStatusTag'
import { listDemands, getDemand, pushDemandToComputation, Demand, DemandStatus, ReviewStatus } from '../../../services/demand'
import {
  listSalesOrders as listSalesOrdersForPull,
  pushSalesOrderToComputation,
  type SalesOrder as PullSalesOrder,
} from '../../../services/sales-order'
import { listSalesForecasts, pushSalesForecastToComputation, type SalesForecast } from '../../../services/sales-forecast'
import { getBusinessConfig } from '../../../../../services/businessConfig'
import { bomApi } from '../../../../master-data/services/material'
import { warehouseApi } from '../../../../master-data/services/warehouse'
import ComputationHistoryTab from './ComputationHistoryTab'
import { MrpParametersCustomerGuideTrigger } from './MrpParametersCustomerGuide'
import { formatDateBySiteSetting, formatDateTime, formatDateTimeBySiteSetting } from '../../../../../utils/format'
import { MaterialUnitSelect, prefetchMaterialsForUnitSelect } from '../../../../../components/material-unit-select'
import { ThemedSegmented } from '../../../../../components/themed-segmented'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { buildKuaizhizaoPullCreateMenuItems, resolveKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry'
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions'
import {
  demandComputationBatchExecuteAllowed,
  demandComputationBatchRecomputeAllowed,
  salesForecastCapabilityReasonMessage,
  salesOrderCapabilityReasonMessage,
} from '../../../../../hooks/useDocumentCapabilities'
import { useNewShortcut } from '../../../../../hooks/useNewShortcut'
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut'

const DEMAND_COMPUTATION_RESOURCE = 'plan-management-demand-computation'

function getMrpSuggestionSegmentedOptions(t: TFunction) {
  return [
    { label: t('app.kuaizhizao.demandComputation.suggestionNet'), value: 'net' as const },
    { label: t('app.kuaizhizao.demandComputation.suggestionGross'), value: 'gross' as const },
  ]
}

/** 物料 BOM 版本选项 */
interface BomVersionOption {
  version: string
  isDefault: boolean
}

/** 物料信息（用于按物料指定 BOM 版本） */
interface MaterialInfo {
  material_id: number
  material_code: string
  material_name: string
  bomVersions?: BomVersionOption[]
}

type PullDemandCandidate = {
  id: number
  demand_code?: string
  demand_name?: string
  demand_type?: string
  business_mode?: string
  status?: string
  updated_at?: string
  pushed_to_computation?: boolean
}

type PullSalesOrderCandidate = {
  id: number
  order_code?: string
  customer_name?: string
  status?: string
  review_status?: string
  delivery_date?: string
  updated_at?: string
  pushed_to_computation?: boolean
  capabilities?: PullSalesOrder['capabilities']
}

type PullSalesForecastCandidate = {
  id: number
  forecast_code?: string
  forecast_name?: string
  forecast_period?: string
  status?: string
  review_status?: string
  updated_at?: string
  planning_pushed_to_computation?: boolean
  capabilities?: SalesForecast['capabilities']
}

/** 详情明细表最小宽度（外层横滚） */
/** 明细表列宽合计下限，保证横滚与「尽量不换行」 */
const DEMAND_COMPUTATION_DETAIL_ITEMS_MIN_WIDTH = 1920

function renderDemandComputationRowActions(nodes: React.ReactNode[], keyPrefix: string): React.ReactNode {
  return renderRowActionsOverflow(nodes, keyPrefix)
}

function normalizeComputationSourceNote(computation: DemandComputation | undefined, t: TFunction): string {
  const raw = String(computation?.notes || '').trim()
  if (!raw) return ''

  const demandNo = String(computation?.demand_code || '').trim()
  const sourceNoFromRaw = raw.match(/^从需求\s+(.+?)\s+下推创建$/)?.[1]?.trim()
  const sourceNo = demandNo || sourceNoFromRaw || ''

  if (/^从需求\s+.+\s+下推创建$/.test(raw) || /^从需求计划\s+.+\s+下推创建$/.test(raw)) {
    if (computation?.demand_type === 'sales_order') return t('app.kuaizhizao.demandComputation.sourceNoteFromSalesOrder', { code: sourceNo }).trim()
    if (computation?.demand_type === 'sales_forecast') return t('app.kuaizhizao.demandComputation.sourceNoteFromSalesForecast', { code: sourceNo }).trim()
    return t('app.kuaizhizao.demandComputation.sourceNoteFromDemandPlan', { code: sourceNo }).trim()
  }

  return raw
}

function normalizeComputationStatusValue(status?: string): string {
  return String(status ?? '').trim().toLowerCase()
}

function getMaterialSourceLabel(t: TFunction, type?: string): string {
  const map: Record<string, string> = {
    Make: t('app.kuaizhizao.demandComputation.materialSourceMake'),
    Buy: t('app.kuaizhizao.demandComputation.materialSourceBuy'),
    Phantom: t('app.kuaizhizao.demandComputation.materialSourcePhantom'),
    Outsource: t('app.kuaizhizao.demandComputation.materialSourceOutsource'),
    Configure: t('app.kuaizhizao.demandComputation.materialSourceConfigure'),
  }
  return map[type || ''] || type || '-'
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

const COMPUTATION_COMPLETED_STATUSES = new Set(['完成', '已完成', 'completed', 'success'])
const COMPUTATION_FAILED_STATUSES = new Set(['失败', 'failed', 'error'])
const COMPUTATION_EXECUTABLE_STATUSES = new Set(['进行中', 'pending', 'running'])

function isComputationCompleted(status?: string): boolean {
  return COMPUTATION_COMPLETED_STATUSES.has(normalizeComputationStatusValue(status))
}

function isComputationFailed(status?: string): boolean {
  return COMPUTATION_FAILED_STATUSES.has(normalizeComputationStatusValue(status))
}

function canExecuteComputation(status?: string): boolean {
  return COMPUTATION_EXECUTABLE_STATUSES.has(normalizeComputationStatusValue(status))
}

/** 可用库存列：hover 展示分仓库构成与净需求计算说明（依赖 detail_results.inventory_breakdown） */
function AvailableInventoryPopoverContent({ detail }: { detail?: Record<string, unknown> | null }) {
  const { t } = useTranslation()
  const bd = detail?.inventory_breakdown as Record<string, unknown> | undefined
  const supply = detail?.supply_calculation as { lines_zh?: string[] } | undefined
  const lines = supply?.lines_zh?.length ? supply.lines_zh : []

  if (!bd && lines.length === 0) {
    return (
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {t('app.kuaizhizao.demandComputation.inventoryNoDetail')}
      </Typography.Text>
    )
  }

  const mainBatch = bd?.main_batch as { label?: string; quantity?: number; note_zh?: string } | undefined
  const lineRows = (bd?.line_side_rows as Array<Record<string, unknown>>) || []
  const formulaZh = (bd?.formula_zh as string[]) || []
  const scopeZh = bd?.line_side_scope_zh as string | undefined

  return (
    <div style={{ maxWidth: 440, fontSize: 12 }}>
      {bd ? (
        <>
          <Typography.Text strong>{t('app.kuaizhizao.demandComputation.inventoryComposition')}</Typography.Text>
          <div style={{ marginTop: 8 }}>
            {mainBatch != null ? (
              <div style={{ marginBottom: 8 }}>
                <div>
                  {mainBatch.label ?? t('app.kuaizhizao.demandComputation.mainBatchDefault')}:
                  <strong>{Number(mainBatch.quantity ?? 0).toLocaleString()}</strong>
                </div>
                {mainBatch.note_zh ? (
                  <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                    {mainBatch.note_zh}
                  </Typography.Text>
                ) : null}
              </div>
            ) : null}
            {scopeZh ? (
              <Typography.Paragraph type="secondary" style={{ marginBottom: 8, fontSize: 11 }}>
                {t('app.kuaizhizao.demandComputation.lineSideScope', { scope: scopeZh })}
              </Typography.Paragraph>
            ) : null}
            {lineRows.length > 0 ? (
              <Table
                size="small"
                pagination={false}
                rowKey={(r) => String(r.warehouse_id)}
                columns={[
                  { title: t('app.kuaizhizao.demandComputation.colWarehouse'), dataIndex: 'warehouse_name', width: 120, ellipsis: true },
                  {
                    title: t('app.kuaizhizao.demandComputation.colOnHand'),
                    dataIndex: 'quantity',
                    width: 72,
                    align: 'right' as const,
                    render: (n: unknown) => Number(n ?? 0).toLocaleString(),
                  },
                  {
                    title: t('app.kuaizhizao.demandComputation.colReserved'),
                    dataIndex: 'reserved',
                    width: 60,
                    align: 'right' as const,
                    render: (n: unknown) => Number(n ?? 0).toLocaleString(),
                  },
                  {
                    title: t('app.kuaizhizao.demandComputation.colAvailable'),
                    dataIndex: 'available',
                    width: 72,
                    align: 'right' as const,
                    render: (n: unknown) => Number(n ?? 0).toLocaleString(),
                  },
                ]}
                dataSource={lineRows}
              />
            ) : (
              <Typography.Text type="secondary">{t('app.kuaizhizao.demandComputation.noLineSideRows')}</Typography.Text>
            )}
            {formulaZh.length > 0 ? (
              <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: 'rgba(0,0,0,0.55)' }}>
                {formulaZh.map((formulaLine, i) => (
                  <li key={i}>{formulaLine}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </>
      ) : null}

      {lines.length > 0 ? (
        <>
          <Divider style={{ margin: '12px 0 8px' }} />
          <Typography.Text strong>{t('app.kuaizhizao.demandComputation.netRequirementHow')}</Typography.Text>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: 'rgba(0,0,0,0.55)' }}>
            {lines.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  )
}

function renderAvailableInventoryCell(
  val: number | undefined,
  detail: Record<string, unknown> | undefined | null
) {
  const text = val != null && val !== 0 ? Number(val).toLocaleString() : val === 0 ? '0' : '-'
  const supply = detail?.supply_calculation as { lines_zh?: string[] } | undefined
  const hasTip = detail?.inventory_breakdown != null || (supply?.lines_zh?.length ?? 0) > 0
  if (!hasTip) {
    return <span>{text}</span>
  }
  return (
    <Popover
      content={<AvailableInventoryPopoverContent detail={detail} />}
      trigger="hover"
      mouseEnterDelay={0.2}
    >
      <span style={{ cursor: 'help', borderBottom: '1px dashed rgba(0,0,0,0.22)' }}>{text}</span>
    </Popover>
  )
}

const PARAM_DEFAULTS: Record<string, any> = {
  include_safety_stock: true,
  include_in_transit: false,
  include_reserved: false,
  include_reorder_point: false,
  /** 建议工单/采购/委外量：net=净需求 gross=毛需求 */
  mrp_suggestion_basis: 'net' as 'net' | 'gross',
  apply_lot_sizing: true,
  bom_version: undefined,
  material_bom_versions: {} as Record<number, string>,
  planning_horizon: undefined as number | undefined,
  /** BOM 展开最大层级（界面已隐藏，固定默认 10，与中小企业常见深度一致） */
  bom_expand_level: 10,
  /** 在物料来源提前期基础上，开工/请购日再整体前置的天数（中小企业排程缓冲） */
  schedule_buffer_days: 0,
}

/** 净需求模式下的供需净算默认（与 PARAM_DEFAULTS 一致） */
const NETTING_DEFAULTS_FOR_NET: Pick<
  Record<string, any>,
  'include_safety_stock' | 'include_in_transit' | 'include_reserved' | 'include_reorder_point'
> = {
  include_safety_stock: true,
  include_in_transit: false,
  include_reserved: false,
  include_reorder_point: false,
}

/** 毛需求模式：建议量不按净缺口，供需净算四项关闭（与隐藏 UI 一致） */
const NETTING_WHEN_GROSS: Pick<
  Record<string, any>,
  'include_safety_stock' | 'include_in_transit' | 'include_reserved' | 'include_reorder_point'
> = {
  include_safety_stock: false,
  include_in_transit: false,
  include_reserved: false,
  include_reorder_point: false,
}

function mergeComputationParamsForSuggestionBasis(
  prev: Record<string, any>,
  basis: 'net' | 'gross'
): Record<string, any> {
  if (basis === 'gross') {
    return { ...prev, mrp_suggestion_basis: 'gross', ...NETTING_WHEN_GROSS }
  }
  return { ...prev, mrp_suggestion_basis: 'net', ...NETTING_DEFAULTS_FOR_NET }
}

/** 库存参数表单（新建计算/执行计算；无 Collapse，双栏） */
const InventoryParamsForm: React.FC<{
  value?: Record<string, any>
  onChange?: (v: Record<string, any>) => void
  bomMultiVersionAllowed?: boolean
  materials?: MaterialInfo[]
  normalWarehouseIds?: number[]
  warehouseOptions?: { label: string; value: number }[]
}> = ({
  value,
  onChange,
  bomMultiVersionAllowed = false,
  materials = [],
  normalWarehouseIds = [],
  warehouseOptions = [],
}) => {
  const { t } = useTranslation()
  const { token } = theme.useToken()
  const params = { ...PARAM_DEFAULTS, ...value }
  const handleChange = (key: string, val: any) => {
    onChange?.({ ...params, [key]: val })
  }
  const handleMaterialVersionChange = (materialId: number, version: string) => {
    const next = { ...(params.material_bom_versions || {}) }
    if (version) {
      next[materialId] = version
    } else {
      delete next[materialId]
    }
    handleChange('material_bom_versions', next)
  }
  const materialBomVersions = params.material_bom_versions || {}

  React.useEffect(() => {
    if (!onChange || !normalWarehouseIds.length) return
    const v = value || {}
    if (v && Object.prototype.hasOwnProperty.call(v, 'warehouse_ids')) return
    onChange({ ...params, warehouse_ids: [...normalWarehouseIds] })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅在首次缺少 warehouse_ids 时补默认普通仓
  }, [normalWarehouseIds.join(',')])

  const whValue = Array.isArray(params.warehouse_ids) ? params.warehouse_ids : normalWarehouseIds
  const useGrossSuggestion = params.mrp_suggestion_basis === 'gross'

  const sectionBox: React.CSSProperties = {
    background: token.colorFillAlter,
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: token.borderRadiusLG,
    padding: token.paddingMD,
    height: '100%',
  }

  const fieldLabel = (text: string) => (
    <Typography.Text style={{ display: 'block', marginBottom: token.marginXXS }}>{text}</Typography.Text>
  )

  const switchRow = (label: string, key: string, checked: boolean) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: token.marginSM,
        minHeight: 32,
      }}
    >
      <Typography.Text style={{ flex: 1, minWidth: 0 }}>{label}</Typography.Text>
      <Switch checked={checked} onChange={c => handleChange(key, c)} />
    </div>
  )

  const bomByMaterialTable = bomMultiVersionAllowed && materials.length > 0 && (
    <>
      <Typography.Title level={5} style={{ marginTop: token.marginMD, marginBottom: token.marginSM }}>
        {t('app.kuaizhizao.demandComputation.paramsBomByMaterial')}
      </Typography.Title>
      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: token.marginSM, fontSize: token.fontSizeSM }}>
        {t('app.kuaizhizao.demandComputation.paramsBomByMaterialHint')}
      </Typography.Text>
      <div style={{ overflowX: 'auto' }}>
        <Table
          size="small"
          dataSource={materials}
          rowKey="material_id"
          pagination={false}
          scroll={{ x: 'max-content' }}
          columns={[
            {
              title: t('app.kuaizhizao.demandComputation.colMaterial'),
              key: 'material',
              width: 220,
              render: (_: unknown, record: MaterialInfo) => (
                <MaterialStackedCell
                  material_name={record.material_name}
                  material_code={record.material_code}
                />
              ),
            },
            {
              title: t('app.kuaizhizao.demandComputation.colBomVersion'),
              dataIndex: 'material_id',
              render: (materialId: number, record: MaterialInfo) => {
                const versions = record.bomVersions || []
                const currentVal = materialBomVersions[materialId] ?? ''
                if (versions.length > 1) {
                  return (
                    <Select
                      placeholder={t('app.kuaizhizao.demandComputation.placeholderSelectVersion')}
                      value={currentVal || undefined}
                      onChange={v => handleMaterialVersionChange(materialId, v || '')}
                      allowClear
                      style={{ width: 140 }}
                      options={versions.map(v => ({
                        value: v.version,
                        label: v.isDefault ? `${v.version}${t('app.kuaizhizao.demandComputation.bomVersionDefault')}` : v.version,
                      }))}
                    />
                  )
                }
                return (
                  <Input
                    placeholder={t('app.kuaizhizao.demandComputation.placeholderBomVersionExample')}
                    value={currentVal}
                    onChange={e =>
                      handleMaterialVersionChange(materialId, e.target.value?.trim() || '')
                    }
                    allowClear
                    style={{ width: 120 }}
                  />
                )
              },
            },
          ]}
        />
      </div>
    </>
  )

  return (
    <div>
      <Row gutter={[16, 16]} align="stretch">
        <Col xs={24} md={12}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: token.marginMD }}>
            <div style={sectionBox}>
              <Typography.Title level={5} style={{ marginTop: 0, marginBottom: token.marginSM }}>
                {useGrossSuggestion ? t('app.kuaizhizao.demandComputation.paramsSuggestionRules') : t('app.kuaizhizao.demandComputation.paramsSupplyNetting')}
              </Typography.Title>
              {!useGrossSuggestion ? (
                <div style={{ display: 'grid', gap: token.marginXS }}>
                  {switchRow(t('app.kuaizhizao.demandComputation.paramsIncludeSafetyStock'), 'include_safety_stock', params.include_safety_stock !== false)}
                  {switchRow(t('app.kuaizhizao.demandComputation.paramsIncludeInTransit'), 'include_in_transit', params.include_in_transit === true)}
                  {switchRow(t('app.kuaizhizao.demandComputation.paramsIncludeReserved'), 'include_reserved', params.include_reserved === true)}
                  {switchRow(t('app.kuaizhizao.demandComputation.paramsIncludeReorderPoint'), 'include_reorder_point', params.include_reorder_point === true)}
                </div>
              ) : (
                <Typography.Paragraph
                  type="secondary"
                  style={{ marginBottom: token.marginSM, marginTop: 0, fontSize: token.fontSizeSM }}
                >
                  {t('app.kuaizhizao.demandComputation.paramsGrossHint')}
                </Typography.Paragraph>
              )}
              <div style={{ display: 'grid', gap: token.marginXS }}>
                {switchRow(t('app.kuaizhizao.demandComputation.paramsApplyLotSizing'), 'apply_lot_sizing', params.apply_lot_sizing !== false)}
              </div>
            </div>
            <div style={sectionBox}>
              <Typography.Title level={5} style={{ marginTop: 0, marginBottom: token.marginSM }}>
                {t('app.kuaizhizao.demandComputation.paramsTimeWindow')}
              </Typography.Title>
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12}>
                  {fieldLabel(t('app.kuaizhizao.demandComputation.paramsPlanningHorizon'))}
                  <InputNumber
                    min={1}
                    max={3650}
                    style={{ width: '100%' }}
                    placeholder={t('app.kuaizhizao.demandComputation.placeholderPlanningHorizon')}
                    value={params.planning_horizon}
                    onChange={v => handleChange('planning_horizon', v === null ? undefined : v)}
                  />
                </Col>
                <Col xs={24} sm={12}>
                  {fieldLabel(t('app.kuaizhizao.demandComputation.paramsScheduleBufferDays'))}
                  <InputNumber
                    min={0}
                    max={365}
                    style={{ width: '100%' }}
                    placeholder={t('app.kuaizhizao.demandComputation.placeholderScheduleBuffer')}
                    value={params.schedule_buffer_days ?? 0}
                    onChange={v => handleChange('schedule_buffer_days', v === null ? 0 : v)}
                  />
                </Col>
              </Row>
            </div>
          </div>
        </Col>
        <Col xs={24} md={12}>
          <div style={sectionBox}>
            <Typography.Title level={5} style={{ marginTop: 0, marginBottom: token.marginSM }}>
              {t('app.kuaizhizao.demandComputation.paramsWarehouseBom')}
            </Typography.Title>
            <div style={{ display: 'flex', flexDirection: 'column', gap: token.marginSM }}>
              <div>
                {fieldLabel(t('app.kuaizhizao.demandComputation.paramsWarehouses'))}
                <Select
                  mode="multiple"
                  allowClear
                  placeholder={t('app.kuaizhizao.demandComputation.placeholderWarehouses')}
                  style={{ width: '100%' }}
                  options={warehouseOptions}
                  value={whValue}
                  onChange={ids => handleChange('warehouse_ids', ids)}
                />
              </div>
              {bomMultiVersionAllowed && materials.length === 0 && (
                <div>
                  {fieldLabel(t('app.kuaizhizao.demandComputation.paramsGlobalBomVersion'))}
                  <Input
                    placeholder={t('app.kuaizhizao.demandComputation.placeholderGlobalBomVersion')}
                    value={params.bom_version ?? ''}
                    onChange={e => handleChange('bom_version', e.target.value || undefined)}
                    allowClear
                  />
                </div>
              )}
            </div>
            {bomByMaterialTable}
          </div>
        </Col>
      </Row>
    </div>
  )
}

const DemandComputationPage: React.FC = () => {
  const { token } = theme.useToken()
  const computationDetailDrawerZIndex = token.zIndexPopupBase
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { message: messageApi, modal: modalApi } = App.useApp()
  const pullFromDemandAction = resolveKuaizhizaoDocumentAction(t, 'demand_computation.pull_from_demand')
  const pullFromSalesOrderAction = resolveKuaizhizaoDocumentAction(t, 'demand_computation.pull_from_sales_order')
  const pullFromSalesForecastAction = resolveKuaizhizaoDocumentAction(t, 'demand_computation.pull_from_sales_forecast')
  const pushToWorkOrderAction = resolveKuaizhizaoDocumentAction(t, 'work_order.pull_from_demand_computation')
  const queryClient = useQueryClient()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const actionRef = useRef<ActionType>(null)
  const formRef = useRef<any>(null)
  const lastComputationsCacheRef = useRef<DemandComputation[]>([])
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const computationPerms = useResourcePermissions(DEMAND_COMPUTATION_RESOURCE)

  const selectedComputationsForBatch = React.useMemo(
    () =>
      selectedRowKeys
        .map((key) => lastComputationsCacheRef.current.find((row) => String(row.id) === String(key)))
        .filter((row): row is DemandComputation => row != null),
    [selectedRowKeys],
  )

  const invalidateStatistics = () => {
    queryClient.invalidateQueries({ queryKey: ['demandComputationStatistics'] })
  }

  const handleComputationBatchSuccess = useCallback(() => {
    setSelectedRowKeys([])
    invalidateStatistics()
    actionRef.current?.reload()
  }, [queryClient])
  const { data: statistics } = useQuery({
    queryKey: ['demandComputationStatistics'],
    queryFn: getDemandComputationStatistics,
  })

  const { data: warehouseRows = [] } = useQuery({
    queryKey: ['warehouses', 'mrp-demand-computation'],
    queryFn: async () => {
      const r = await warehouseApi.list({ limit: 500, is_active: true })
      return r?.items ?? []
    },
  })
  const normalWarehouseIds = React.useMemo(
    () =>
      warehouseRows
        .filter((w: any) => (w.warehouseType || w.warehouse_type) === 'normal')
        .map((w: any) => Number(w.id))
        .filter((id: number) => !Number.isNaN(id)),
    [warehouseRows],
  )
  const warehouseSelectOptions = React.useMemo(
    () =>
      warehouseRows.map((w: any) => ({
        value: Number(w.id),
        label: `${w.code || ''} ${w.name || ''}`.trim() || String(w.id),
      })),
    [warehouseRows],
  )

  // Modal 相关状态（新建计算）
  const [modalVisible, setModalVisible] = useState(false)
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [selectedDemandIds, setSelectedDemandIds] = useState<number[]>([])

  // 执行计算 Modal 相关状态
  const [executeModalVisible, setExecuteModalVisible] = useState(false)
  const [executeRecord, setExecuteRecord] = useState<DemandComputation | null>(null)
  const [executeParams, setExecuteParams] = useState<Record<string, any>>({})
  const [executeLoading, setExecuteLoading] = useState(false)

  // 计算结果预览 Modal（二次确认）
  const [previewModalVisible, setPreviewModalVisible] = useState(false)
  const [previewData, setPreviewData] = useState<{
    computation_code: string
    computation_type: string
    item_count: number
    items: Array<{
      material_id?: number
      material_code: string
      material_name: string
      material_unit: string
      required_quantity: number
      available_inventory: number
      net_requirement: number
      suggested_work_order_quantity: number
      suggested_purchase_order_quantity: number
      material_source_type?: string
      detail_results?: Record<string, unknown>
    }>
  } | null>(null)
  /** 预览表格分页（受控，否则固定 pageSize 会导致切换每页条数无效） */
  const [previewTablePage, setPreviewTablePage] = useState(1)
  const [previewTablePageSize, setPreviewTablePageSize] = useState(10)

  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [currentComputation, setCurrentComputation] = useState<DemandComputation | null>(null)
  const [computationRecalcHistory, setComputationRecalcHistory] = useState<ComputationRecalcHistoryItem[]>([])
  const [pushRecords, setPushRecords] = useState<PushRecordItem[]>([])
  const [recalcHistoryLoading, setRecalcHistoryLoading] = useState(false)
  const [pushRecordsLoading, setPushRecordsLoading] = useState(false)
  const [recalcSnapshotModalOpen, setRecalcSnapshotModalOpen] = useState(false)
  const [recalcSnapshotModalLoading, setRecalcSnapshotModalLoading] = useState(false)
  const [recalcSnapshotModalData, setRecalcSnapshotModalData] = useState<ComputationSnapshotItem | null>(null)
  const [detailTabKey, setDetailTabKey] = useState<string>('detail')
  const [computationTrackingRefreshKey, setComputationTrackingRefreshKey] = useState(0)

  const computationTracking = useDocumentTracking(
    drawerVisible && detailTabKey === 'detail' && currentComputation?.id != null ? 'demand_computation' : undefined,
    drawerVisible && detailTabKey === 'detail' ? currentComputation?.id ?? undefined : undefined,
    computationTrackingRefreshKey,
  )

  /** 详情抽屉「下推与历史」：并行加载下推记录、重算历史（快照按需从「重算历史」打开） */
  const loadComputationRecordsTabData = useCallback(
    (computationId: number) => {
      setPushRecordsLoading(true)
      setRecalcHistoryLoading(true)
      void Promise.all([
        getPushRecords(computationId)
          .then((res) => setPushRecords(res.records || []))
          .catch(() => messageApi.error(t('app.kuaizhizao.demandComputation.fetchPushRecordsFailed')))
          .finally(() => setPushRecordsLoading(false)),
        listComputationRecalcHistory(computationId, { limit: 50 })
          .then(setComputationRecalcHistory)
          .catch(() => messageApi.error(t('app.kuaizhizao.demandComputation.fetchRecalcHistoryFailed')))
          .finally(() => setRecalcHistoryLoading(false)),
      ])
    },
    [messageApi, t],
  )

  const openRecalcSnapshotPreview = useCallback(
    async (snapshotId: number) => {
      const cid = currentComputation?.id
      if (!cid) return
      setRecalcSnapshotModalOpen(true)
      setRecalcSnapshotModalLoading(true)
      setRecalcSnapshotModalData(null)
      try {
        const data = await getComputationSnapshot(cid, snapshotId)
        setRecalcSnapshotModalData(data)
      } catch {
        messageApi.error(t('app.kuaizhizao.demandComputation.fetchSnapshotFailed'))
        setRecalcSnapshotModalOpen(false)
      } finally {
        setRecalcSnapshotModalLoading(false)
      }
    },
    [currentComputation?.id, messageApi],
  )

  // 物料来源信息状态
  const [validationResults, setValidationResults] = useState<any>(null)

  // 需求列表（用于选择需求）
  const [demandList, setDemandList] = useState<Demand[]>([])
  // BOM 允许多版本共存（用于决定是否显示版本选择）
  const [bomMultiVersionAllowed, setBomMultiVersionAllowed] = useState(true)
  // 新建计算：选中需求对应的物料列表（用于按物料指定 BOM 版本）
  const [createModalMaterials, setCreateModalMaterials] = useState<MaterialInfo[]>([])
  // 执行计算：当前计算对应的物料列表
  const [executeModalMaterials, setExecuteModalMaterials] = useState<MaterialInfo[]>([])

  // 下推面板（配置+预览+确认一体）
  const [pushPanelRecord, setPushPanelRecord] = useState<DemandComputation | null>(null)
  const [pushOptions, setPushOptions] = useState<PushOptions | null>(null)
  const [pushPreviewData, setPushPreviewData] = useState<PushPreview | null>(null)
  const [pushConfig, setPushConfig] = useState<{
    production?: 'work_order'
    purchase?: 'requisition' | 'purchase_order'
  }>({})
  const [pushPanelLoading, setPushPanelLoading] = useState(false)
  const [pushPanelSubmitting, setPushPanelSubmitting] = useState(false)
  /** 协调看板深链：打开下推面板时预设采购路径 */
  const pushPurchasePresetRef = useRef<'requisition' | 'purchase_order' | null>(null)
  const deepLinkHandledRef = useRef<string | null>(null)

  /** 下推面板：打开时加载 options，初始化 config */
  React.useEffect(() => {
    if (!pushPanelRecord) return
    const load = async () => {
      setPushPanelLoading(true)
      try {
        const opts = await getPushOptions(pushPanelRecord.id!)
        setPushOptions(opts)
        const presetPurchase = pushPurchasePresetRef.current
        pushPurchasePresetRef.current = null
        setPushConfig({
          production: presetPurchase
            ? undefined
            : opts.production_choices.length > 0
              ? 'work_order'
              : undefined,
          purchase:
            presetPurchase ??
            (opts.purchase_choices.length > 0 ? opts.default_purchase : undefined),
        })
      } catch (e) {
        messageApi.error(t('app.kuaizhizao.demandComputation.loadPushConfigFailed'))
      } finally {
        setPushPanelLoading(false)
      }
    }
    load()
  }, [pushPanelRecord?.id, messageApi])

  /** 下推面板：配置变化时刷新预览 */
  React.useEffect(() => {
    if (!pushPanelRecord || pushPanelLoading) return
    const params: any = {}
    if (pushConfig.production) params.production = pushConfig.production
    if (pushConfig.purchase) params.purchase = pushConfig.purchase
    getPushPreview(pushPanelRecord.id!, Object.keys(params).length ? params : undefined)
      .then(setPushPreviewData)
      .catch(() => {})
  }, [pushPanelRecord?.id, pushPanelLoading, pushConfig.production, pushConfig.purchase])

  /** 新建计算：选中需求变化时，获取需求明细并提取物料列表（去重），并获取各物料 BOM 版本 */
  React.useEffect(() => {
    if (!selectedDemandIds?.length) {
      setCreateModalMaterials([])
      return
    }
    const load = async () => {
      const demands = await Promise.all(selectedDemandIds.map(id => getDemand(id, true)))
      const seen = new Set<number>()
      const materials: MaterialInfo[] = []
      for (const d of demands) {
        for (const item of d.items || []) {
          if (item.material_id && !seen.has(item.material_id)) {
            seen.add(item.material_id)
            materials.push({
              material_id: item.material_id,
              material_code: item.material_code || '',
              material_name: item.material_name || '',
            })
          }
        }
      }
      // 获取各物料的 BOM 版本列表
      const withVersions = await Promise.all(
        materials.map(async m => {
          try {
            const boms = await bomApi.getByMaterial(m.material_id, undefined, true)
            const versionMap = new Map<string, boolean>()
            for (const b of boms) {
              if (b.version) versionMap.set(b.version, !!b.isDefault || !!versionMap.get(b.version))
            }
            const bomVersions: BomVersionOption[] = Array.from(versionMap.entries()).map(
              ([version, isDefault]) => ({ version, isDefault: !!isDefault })
            )
            return { ...m, bomVersions }
          } catch {
            return { ...m, bomVersions: [] }
          }
        })
      )
      setCreateModalMaterials(withVersions)
    }
    load().catch(() => setCreateModalMaterials([]))
  }, [selectedDemandIds])

  /** 新建计算：物料 BOM 版本加载完成后，预填各物料默认 BOM 版本 */
  React.useEffect(() => {
    if (!createModalMaterials.length || !modalVisible) return
    const defaults: Record<number, string> = {}
    for (const m of createModalMaterials) {
      const def = m.bomVersions?.find(v => v.isDefault)?.version ?? m.bomVersions?.[0]?.version
      if (def) defaults[m.material_id] = def
    }
    if (Object.keys(defaults).length === 0) return
    const current = formRef.current?.getFieldValue('computation_params') || {}
    formRef.current?.setFieldsValue({
      computation_params: { ...current, material_bom_versions: { ...defaults, ...(current.material_bom_versions || {}) } },
    })
  }, [createModalMaterials, modalVisible])

  /**
   * 处理新建计算
   */
  const handleCreate = async () => {
    try {
      // 加载已审核通过的需求列表与业务配置
      const [demandsRes, bizConfig] = await Promise.all([
        listDemands({
          status: DemandStatus.AUDITED,
          review_status: ReviewStatus.APPROVED,
          limit: 100,
        }),
        getBusinessConfig(),
      ])
      const list = demandsRes.data || []
      setDemandList(list)
      setSelectedDemandIds([])
      setBomMultiVersionAllowed(bizConfig?.parameters?.bom?.bom_multi_version_allowed !== false)
      setModalVisible(true)
      formRef.current?.resetFields()
      if (list.length === 0) {
        messageApi.info(t('app.kuaizhizao.demandComputation.noAuditedDemands'))
      }
    } catch (error: any) {
      messageApi.error(t('app.kuaizhizao.demandComputation.loadDemandListFailed'))
    }
  }
  const handleCreateByShortcut = useCallback(() => {
    void handleCreate()
  }, [handleCreate])
  useNewShortcut(handleCreateByShortcut)
  const createComputationButtonLabel = useMemo(
    () => withSingleNewShortcutHint(t('app.kuaizhizao.demandComputation.create')),
    [t],
  )

  const pullFromDemandQuery = useUniPullQuery<PullDemandCandidate>({
    rowKey: 'id',
    selectionType: 'radio',
    loadData: async ({ keyword, page, pageSize }) => {
      try {
        const kw = keyword.trim().toLowerCase()
        const demandsRes = await listDemands({
          status: DemandStatus.AUDITED,
          review_status: ReviewStatus.APPROVED,
          pushed_to_computation: false,
          limit: 100,
        })
        const rows = (demandsRes.data || [])
          .filter((d) => d.id != null)
          .filter((d) => {
            if (!kw) return true
            const text = `${d.demand_code || ''} ${d.demand_name || ''}`.toLowerCase()
            return text.includes(kw)
          })
          .map((d) => ({
            id: d.id!,
            demand_code: d.demand_code,
            demand_name: d.demand_name,
            demand_type: d.demand_type,
            business_mode: d.business_mode,
            status: d.status,
            updated_at: d.updated_at,
            pushed_to_computation: d.pushed_to_computation,
          }))
        const start = (page - 1) * pageSize
        return { data: rows.slice(start, start + pageSize), total: rows.length }
      } catch {
        messageApi.error(t('app.kuaizhizao.demandComputation.loadDemandListFailed'))
        return { data: [], total: 0 }
      }
    },
    isRowDisabled: (record) => !!record.pushed_to_computation,
    onConfirm: async (keys, rows) => {
      const selectedId = Number(keys[0])
      if (!selectedId) {
        messageApi.warning(t('app.kuaizhizao.demandComputation.selectSource', { source: pullFromDemandAction.sourceLabel }))
        return
      }
      const selected = rows[0]
      if (selected?.pushed_to_computation) {
        messageApi.warning(t('app.kuaizhizao.demandComputation.alreadyPushed', { source: pullFromDemandAction.sourceLabel, target: pullFromDemandAction.targetLabel }))
        return
      }
      try {
        const res = await pushDemandToComputation(selectedId)
        messageApi.success(res?.computation_code ? t('app.kuaizhizao.demandComputation.createdTarget', { target: pullFromDemandAction.targetLabel, code: res.computation_code }) : t('app.kuaizhizao.demandComputation.createdFromSource', { source: pullFromDemandAction.sourceLabel, target: pullFromDemandAction.targetLabel }))
        invalidateStatistics()
        actionRef.current?.reload()
        pullFromDemandQuery.closeModal()
      } catch (error: any) {
        messageApi.error(error?.response?.data?.detail || t('app.kuaizhizao.demandComputation.createFromSourceFailed', { source: pullFromDemandAction.sourceLabel, target: pullFromDemandAction.targetLabel }))
      }
    },
  })

  const pullFromSalesOrderQuery = useUniPullQuery<PullSalesOrderCandidate>({
    rowKey: 'id',
    selectionType: 'radio',
    loadData: async ({ keyword, page, pageSize }) => {
      try {
        const result = await listSalesOrdersForPull({
          skip: (page - 1) * pageSize,
          limit: pageSize,
          keyword: keyword.trim() || undefined,
        })
        const rows = Array.isArray(result) ? result : (result.data ?? [])
        const candidates = rows.map((row) => ({
          id: Number(row.id),
          order_code: row.order_code,
          customer_name: row.customer_name,
          status: row.status,
          review_status: row.review_status,
          delivery_date: row.delivery_date,
          updated_at: row.updated_at,
          pushed_to_computation: !!row.pushed_to_computation,
          capabilities: row.capabilities,
        }))
        return {
          data: candidates,
          total: Array.isArray(result) ? candidates.length : (result.total ?? candidates.length),
        }
      } catch {
        messageApi.error(t('app.kuaizhizao.salesOrder.listFailed'))
        return { data: [], total: 0 }
      }
    },
    isRowDisabled: (record) => {
      if (record.pushed_to_computation) return true
      return record.capabilities?.push_computation?.allowed === false
    },
    onConfirm: async (keys, rows) => {
      const selectedId = Number(keys[0])
      if (!selectedId) {
        messageApi.warning(t('app.kuaizhizao.demandComputation.selectSource', { source: pullFromSalesOrderAction.sourceLabel }))
        return
      }
      const selected = rows[0]
      if (selected?.pushed_to_computation || selected?.capabilities?.push_computation?.allowed === false) {
        messageApi.warning(
          salesOrderCapabilityReasonMessage(selected?.capabilities?.push_computation?.reason, t)
            || t('app.kuaizhizao.demandComputation.alreadyPushed', { source: pullFromSalesOrderAction.sourceLabel, target: pullFromSalesOrderAction.targetLabel }),
        )
        return
      }
      try {
        const res = await pushSalesOrderToComputation(selectedId)
        messageApi.success(
          res?.computation_code
            ? t('app.kuaizhizao.demandComputation.createdTarget', { target: pullFromSalesOrderAction.targetLabel, code: res.computation_code })
            : t('app.kuaizhizao.demandComputation.createdFromSource', { source: pullFromSalesOrderAction.sourceLabel, target: pullFromSalesOrderAction.targetLabel }),
        )
        invalidateStatistics()
        actionRef.current?.reload()
        pullFromSalesOrderQuery.closeModal()
      } catch (error: any) {
        messageApi.error(
          error?.response?.data?.detail
          || t('app.kuaizhizao.demandComputation.createFromSourceFailed', { source: pullFromSalesOrderAction.sourceLabel, target: pullFromSalesOrderAction.targetLabel }),
        )
      }
    },
  })

  const pullFromSalesForecastQuery = useUniPullQuery<PullSalesForecastCandidate>({
    rowKey: 'id',
    selectionType: 'radio',
    loadData: async ({ keyword, page, pageSize }) => {
      try {
        const result = await listSalesForecasts({
          skip: (page - 1) * pageSize,
          limit: pageSize,
          keyword: keyword.trim() || undefined,
        })
        const rows = result?.data ?? []
        const candidates = rows.map((row) => ({
          id: Number(row.id),
          forecast_code: row.forecast_code,
          forecast_name: row.forecast_name,
          forecast_period: row.forecast_period,
          status: row.status,
          review_status: row.review_status,
          updated_at: row.updated_at,
          planning_pushed_to_computation: !!row.planning_pushed_to_computation,
          capabilities: row.capabilities,
        }))
        return {
          data: candidates,
          total: Number(result?.total ?? candidates.length),
        }
      } catch {
        messageApi.error(t('app.kuaizhizao.salesForecast.listLoadFailed'))
        return { data: [], total: 0 }
      }
    },
    isRowDisabled: (record) => {
      if (record.planning_pushed_to_computation) return true
      return record.capabilities?.push_computation?.allowed === false
    },
    onConfirm: async (keys, rows) => {
      const selectedId = Number(keys[0])
      if (!selectedId) {
        messageApi.warning(
          t('app.kuaizhizao.demandComputation.selectSource', { source: pullFromSalesForecastAction.sourceLabel }),
        )
        return
      }
      const selected = rows[0]
      if (selected?.planning_pushed_to_computation || selected?.capabilities?.push_computation?.allowed === false) {
        messageApi.warning(
          salesForecastCapabilityReasonMessage(selected?.capabilities?.push_computation?.reason, t)
            || t('app.kuaizhizao.demandComputation.alreadyPushed', {
              source: pullFromSalesForecastAction.sourceLabel,
              target: pullFromSalesForecastAction.targetLabel,
            }),
        )
        return
      }
      try {
        const res = await pushSalesForecastToComputation(selectedId)
        messageApi.success(
          res?.computation_code
            ? t('app.kuaizhizao.demandComputation.createdTarget', { target: pullFromSalesForecastAction.targetLabel, code: res.computation_code })
            : t('app.kuaizhizao.demandComputation.createdFromSource', { source: pullFromSalesForecastAction.sourceLabel, target: pullFromSalesForecastAction.targetLabel }),
        )
        invalidateStatistics()
        actionRef.current?.reload()
        pullFromSalesForecastQuery.closeModal()
      } catch (error: any) {
        messageApi.error(
          error?.response?.data?.detail
          || t('app.kuaizhizao.demandComputation.createFromSourceFailed', {
            source: pullFromSalesForecastAction.sourceLabel,
            target: pullFromSalesForecastAction.targetLabel,
          }),
        )
      }
    },
  })

  /**
   * 处理详情查看
   */
  const handleDetail = async (keys: React.Key[]) => {
    if (keys.length === 1) {
      const id = Number(keys[0])
      try {
        const data = await getDemandComputation(id, true)
        setCurrentComputation(data)

        await Promise.all([
          prefetchMaterialsForUnitSelect((data.items || []).map((i) => i.material_id)),
          getMaterialSources(id).catch((error) => {
            console.error('获取物料来源信息失败:', error)
          }),
          validateMaterialSources(id)
            .then((validation) => {
              setValidationResults(validation)
            })
            .catch((error) => {
              console.error('获取验证结果失败:', error)
              setValidationResults(null)
            }),
        ])

        setDetailTabKey('detail')
        setDrawerVisible(true)
        setComputationTrackingRefreshKey((k) => k + 1)
      } catch (error: any) {
        messageApi.error(t('app.kuaizhizao.demandComputation.fetchDetailFailed'))
      }
    }
  }

  /**
   * 处理执行计算：打开计算参数 Modal
   */
  const handleExecute = async (record: DemandComputation) => {
    setExecuteRecord(record)
    const defaults = {
      ...PARAM_DEFAULTS,
      bom_version: undefined,
      material_bom_versions: {} as Record<number, string>,
    }
    const execMerged: Record<string, any> = { ...defaults, ...(record.computation_params || {}) }
    if (execMerged.mrp_suggestion_basis === 'gross') {
      Object.assign(execMerged, NETTING_WHEN_GROSS)
    }
    setExecuteParams(execMerged)
    setExecuteModalVisible(true)

    // 获取需求明细中的物料列表（用于按物料指定 BOM 版本）
    const demandIds = record.demand_ids?.length
      ? record.demand_ids
      : record.demand_id
        ? [record.demand_id]
        : []
    if (demandIds.length > 0) {
      try {
        const demands = await Promise.all(demandIds.map((id: number) => getDemand(id, true)))
        const seen = new Set<number>()
        const materials: MaterialInfo[] = []
        for (const d of demands) {
          for (const item of d.items || []) {
            if (item.material_id && !seen.has(item.material_id)) {
              seen.add(item.material_id)
              materials.push({
                material_id: item.material_id,
                material_code: item.material_code || '',
                material_name: item.material_name || '',
              })
            }
          }
        }
        // 获取各物料的 BOM 版本列表
        const withVersions = await Promise.all(
          materials.map(async m => {
            try {
              const boms = await bomApi.getByMaterial(m.material_id, undefined, true)
              const versionMap = new Map<string, boolean>()
              for (const b of boms) {
                if (b.version) versionMap.set(b.version, !!b.isDefault || !!versionMap.get(b.version))
              }
              const bomVersions: BomVersionOption[] = Array.from(versionMap.entries()).map(
                ([version, isDefault]) => ({ version, isDefault: !!isDefault })
              )
              return { ...m, bomVersions }
            } catch {
              return { ...m, bomVersions: [] }
            }
          })
        )
        setExecuteModalMaterials(withVersions)
        // 预填各物料默认 BOM 版本（已有值则保留）
        const existing = record.computation_params?.material_bom_versions || {}
        const defaults: Record<number, string> = {}
        for (const m of withVersions) {
          if (existing[m.material_id] != null && String(existing[m.material_id]).trim() !== '') continue
          const def = m.bomVersions?.find(v => v.isDefault)?.version ?? m.bomVersions?.[0]?.version
          if (def) defaults[m.material_id] = def
        }
        if (Object.keys(defaults).length > 0) {
          setExecuteParams(prev => ({
            ...prev,
            material_bom_versions: { ...prev.material_bom_versions, ...defaults },
          }))
        }
      } catch {
        setExecuteModalMaterials([])
      }
    } else {
      setExecuteModalMaterials([])
    }
  }

  /** 过滤并准备执行参数（过滤 material_bom_versions 空值） */
  const getFilteredExecuteParams = () => {
    const materialBomVersions = executeParams.material_bom_versions || {}
    const filtered = Object.fromEntries(
      Object.entries(materialBomVersions).filter(([, v]) => v != null && String(v).trim() !== '')
    )
    const params = { ...executeParams }
    if (Object.keys(filtered).length > 0) {
      params.material_bom_versions = filtered
    } else {
      delete params.material_bom_versions
    }
    // 有按物料指定时，不传 bom_version，留空物料自动使用该物料 BOM 默认版本
    if (executeModalMaterials.length > 0) {
      delete params.bom_version
    }
    return params
  }

  /**
   * 第一步：从参数 Modal 点击执行计算 -> 调用预览 API，展示预览 Modal
   */
  const handleExecuteSubmit = async () => {
    if (!executeRecord?.id) return
    setExecuteLoading(true)
    try {
      const params = getFilteredExecuteParams()
      const preview = await previewExecuteDemandComputation(executeRecord.id, params)
      await prefetchMaterialsForUnitSelect(preview.items.map((i) => i.material_id))
      setPreviewTablePage(1)
      setPreviewTablePageSize(10)
      setPreviewData(preview)
      // 先关参数弹窗再开预览，避免双 Modal 叠层时 z-index 竞态导致预览被挡在后面
      setExecuteModalVisible(false)
      setPreviewModalVisible(true)
    } catch (error: any) {
      messageApi.error(error?.response?.data?.detail || t('app.kuaizhizao.demandComputation.previewFailed'))
    } finally {
      setExecuteLoading(false)
    }
  }

  /**
   * 第二步：从预览 Modal 点击确认执行 -> 真正执行计算
   */
  const handleConfirmExecute = async () => {
    if (!executeRecord?.id) return
    setExecuteLoading(true)
    try {
      const params = getFilteredExecuteParams()
      await executeDemandComputation(executeRecord.id, params)
      messageApi.success(t('app.kuaizhizao.demandComputation.executeSuccess'))
      setPreviewModalVisible(false)
      setPreviewData(null)
      setPreviewTablePage(1)
      setPreviewTablePageSize(10)
      setExecuteModalVisible(false)
      const executedId = executeRecord.id
      setExecuteRecord(null)
      invalidateStatistics(); actionRef.current?.reload()
      if (drawerVisible && currentComputation?.id === executedId) {
        void getDemandComputation(executedId, true)
          .then(setCurrentComputation)
          .catch(() => {})
        if (detailTabKey === 'detail') {
          setComputationTrackingRefreshKey((k) => k + 1)
        } else if (detailTabKey === 'records') {
          loadComputationRecordsTabData(executedId)
        }
      }
    } catch (error: any) {
      messageApi.error(error?.response?.data?.detail || t('app.kuaizhizao.demandComputation.executeFailed'))
    } finally {
      setExecuteLoading(false)
    }
  }

  /**
   * 处理重新计算（仅对已完成或失败的计算）
   */
  const handleRecompute = async (record: DemandComputation) => {
    modalApi.confirm({
      title: t('app.kuaizhizao.demandComputation.recomputeTitle'),
      content: t('app.kuaizhizao.demandComputation.recomputeConfirm', { code: record.computation_code }),
      onOk: async () => {
        try {
          await recomputeDemandComputation(record.id!)
          messageApi.success(t('app.kuaizhizao.demandComputation.recomputeSubmitted'))
          invalidateStatistics(); actionRef.current?.reload()
          if (drawerVisible && currentComputation?.id === record.id) {
            void getDemandComputation(record.id!, true)
              .then(setCurrentComputation)
              .catch(() => {})
            if (detailTabKey === 'detail') {
              setComputationTrackingRefreshKey((k) => k + 1)
            } else if (detailTabKey === 'records') {
              loadComputationRecordsTabData(record.id!)
            }
          }
        } catch (error: any) {
          messageApi.error(error?.response?.data?.detail || t('app.kuaizhizao.demandComputation.recomputeFailed'))
        }
      },
    })
  }

  /**
   * 处理删除需求计算
   */
  const handleDelete = async (record: DemandComputation) => {
    modalApi.confirm({
      title: t('app.kuaizhizao.demandComputation.deleteTitle'),
      content: t('app.kuaizhizao.demandComputation.deleteConfirm', { code: record.computation_code }),
      okText: t('common.delete'),
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteDemandComputation(record.id!)
          messageApi.success(t('app.kuaizhizao.demandComputation.deleteSuccess'))
          invalidateStatistics(); actionRef.current?.reload()
        } catch (error: any) {
          messageApi.error(error?.response?.data?.detail || t('app.kuaizhizao.demandComputation.deleteFailed'))
        }
      },
    })
  }

  /** 打开下推面板 */
  const handleOpenPushPanel = useCallback((record: DemandComputation) => {
    setPushPanelRecord(record)
    setPushPreviewData(null)
  }, [])

  /** 协调看板 / 管控塔深链：computationId、action=pushPurchase、drawerTab */
  useEffect(() => {
    const computationIdRaw = searchParams.get('computationId')
    if (!computationIdRaw) return

    const linkKey = `${computationIdRaw}:${searchParams.get('action') ?? ''}:${searchParams.get('drawerTab') ?? ''}`
    if (deepLinkHandledRef.current === linkKey) return
    deepLinkHandledRef.current = linkKey

    const computationId = Number(computationIdRaw)
    if (Number.isNaN(computationId) || computationId <= 0) return

    const action = searchParams.get('action')
    const drawerTab = searchParams.get('drawerTab')

    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('computationId')
    nextParams.delete('action')
    nextParams.delete('drawerTab')
    const nextSearch = nextParams.toString()
    navigate({ pathname: location.pathname, search: nextSearch ? `?${nextSearch}` : '' }, { replace: true })

    void (async () => {
      try {
        const data = await getDemandComputation(computationId, true)
        if (action === 'pushPurchase') {
          pushPurchasePresetRef.current = 'purchase_order'
          setPushPanelRecord(data)
          setPushPreviewData(null)
          return
        }

        setCurrentComputation(data)
        setDetailTabKey(drawerTab === 'records' ? 'records' : 'detail')
        setDrawerVisible(true)
        setComputationTrackingRefreshKey((k) => k + 1)
        if (drawerTab === 'records') {
          loadComputationRecordsTabData(computationId)
        } else {
          void Promise.all([
            prefetchMaterialsForUnitSelect((data.items || []).map((i) => i.material_id)),
            getMaterialSources(computationId).catch(() => {}),
            validateMaterialSources(computationId)
              .then(setValidationResults)
              .catch(() => setValidationResults(null)),
          ])
        }
      } catch {
        messageApi.error(t('app.kuaizhizao.demandComputation.openFailed'))
        deepLinkHandledRef.current = null
      }
    })()
  }, [
    searchParams,
    location.pathname,
    navigate,
    messageApi,
    loadComputationRecordsTabData,
  ])

  /** 下推面板确认执行 */
  const handlePushPanelConfirm = async () => {
    if (!pushPanelRecord) return
    const record = pushPanelRecord
    setPushPanelSubmitting(true)
    try {
      const hasProduction = pushConfig.production
      const hasPurchase = pushConfig.purchase
      if (hasProduction || hasPurchase) {
        await pushAll(record.id!, {
          production: pushConfig.production,
          purchase: pushConfig.purchase,
          include_outsource: true,
        })
        messageApi.success(t('app.kuaizhizao.demandComputation.pushSuccess'))
      } else {
        messageApi.warning(t('app.kuaizhizao.demandComputation.pushSelectAtLeastOne'))
        return
      }
      setPushPanelRecord(null)
      invalidateStatistics(); actionRef.current?.reload()
      if (drawerVisible && currentComputation?.id === record.id) {
        void getDemandComputation(record.id!, true)
          .then(setCurrentComputation)
          .catch(() => {})
        if (detailTabKey === 'detail') {
          setComputationTrackingRefreshKey((k) => k + 1)
        } else if (detailTabKey === 'records') {
          loadComputationRecordsTabData(record.id!)
        }
      }
    } catch (e: any) {
      messageApi.error(e?.response?.data?.detail || t('app.kuaizhizao.demandComputation.pushFailed'))
    } finally {
      setPushPanelSubmitting(false)
    }
  }


  /**
   * 表格列定义
   */
  const columns: ProColumns<DemandComputation>[] = useMemo(
    () => [
    {
      title: t('app.kuaizhizao.demandComputation.colComputationCode'),
      dataIndex: 'computation_code',
      width: 168,
      fixed: 'left',
      hideInSearch: false,
      render: (_: unknown, record: DemandComputation) => (
        <Space size={4} wrap={false} style={{ whiteSpace: 'nowrap' }}>
          <span style={{ whiteSpace: 'nowrap' }}>{record.computation_code ?? '-'}</span>
          {record.computation_code ? (
            <Tooltip title={t('field.invitationCode.copy')}>
              <Button
                type="link"
                size="small"
                icon={<CopyOutlined style={{ fontSize: 12 }} />}
                onClick={e => {
                  e.stopPropagation()
                  void navigator.clipboard.writeText(record.computation_code!).then(
                    () => messageApi.success(t('app.kuaizhizao.demandComputation.copied')),
                    () => messageApi.error(t('app.kuaizhizao.demandComputation.copyFailed'))
                  )
                }}
              />
            </Tooltip>
          ) : null}
        </Space>
      ),
    },
    {
      title: t('app.kuaizhizao.demandComputation.colSourceNo'),
      dataIndex: 'demand_code',
      width: 168,
      hideInSearch: false,
      render: (_: unknown, record: DemandComputation) => (
        <Space size={4}>
          <span>{record.demand_code ?? '-'}</span>
          {record.demand_code ? (
            <Tooltip title={t('field.invitationCode.copy')}>
              <Button
                type="link"
                size="small"
                icon={<CopyOutlined style={{ fontSize: 12 }} />}
                onClick={e => {
                  e.stopPropagation()
                  void navigator.clipboard.writeText(record.demand_code!).then(
                    () => messageApi.success(t('app.kuaizhizao.demandComputation.copied')),
                    () => messageApi.error(t('app.kuaizhizao.demandComputation.copyFailed'))
                  )
                }}
              />
            </Tooltip>
          ) : null}
        </Space>
      ),
    },
    {
      title: t('app.kuaizhizao.demandComputation.colSourceType'),
      dataIndex: 'demand_type',
      width: 110,
      valueType: 'select',
      valueEnum: {
        sales_forecast: { text: getDemandTypeLabel('sales_forecast'), status: 'Processing' },
        sales_order: { text: getDemandTypeLabel('sales_order'), status: 'Success' },
        demand_plan: { text: getDemandTypeLabel('demand_plan'), status: 'Warning' },
      },
      hideInSearch: false,
      render: (_, record) => (
        <Tag {...getDemandTypeTagProps(record.demand_type)}>
          {getDemandTypeLabel(record.demand_type)}
        </Tag>
      ),
    },
    {
      title: t('app.kuaizhizao.demandComputation.colBusinessMode'),
      dataIndex: 'business_mode',
      width: 100,
      valueType: 'select',
      valueEnum: {
        MTS: { text: getDemandBusinessModeLabel('MTS'), status: 'Processing' },
        MTO: { text: getDemandBusinessModeLabel('MTO'), status: 'Success' },
        ATO: { text: getDemandBusinessModeLabel('ATO'), status: 'Warning' },
      },
      hideInSearch: false,
      render: (_, record) => (
        <Tag color={getDemandBusinessModeTagColor(record.business_mode)}>
          {getDemandBusinessModeLabel(record.business_mode)}
        </Tag>
      ),
    },
    {
      title: t('app.kuaizhizao.demandComputation.colStartTime'),
      dataIndex: 'computation_start_time',
      width: 160,
      hideInSearch: false,
      render: (_, record) => formatDateTimeBySiteSetting(record.computation_start_time),
    },
    {
      title: t('app.kuaizhizao.demandComputation.colEndTime'),
      dataIndex: 'computation_end_time',
      width: 160,
      hideInTable: false,
      hideInSearch: true,
      render: (_, record) => formatDateTimeBySiteSetting(record.computation_end_time),
    },
    {
      title: t('app.kuaizhizao.demandComputation.colLifecycle'),
      dataIndex: 'lifecycle_stage',
      fixed: 'right',
      align: 'center',
      hideInSearch: false,
      valueType: 'select',
      valueEnum: {
        进行中: { text: t('app.kuaizhizao.demandComputation.statusInProgress') },
        计算中: { text: t('app.kuaizhizao.demandComputation.statusComputing') },
        完成: { text: t('app.kuaizhizao.demandComputation.statusCompleted') },
        失败: { text: t('app.kuaizhizao.demandComputation.statusFailed') },
      },
      fieldProps: { allowClear: true },
      render: (_, record) => {
        const lifecycle = getDemandComputationLifecycle(record)
        return (
          <UniLifecycle
            percent={lifecycle.percent}
            stageName={lifecycle.stageName}
            status={lifecycle.status}
            subStages={lifecycle.subStages}
            showLabel
            size="small"
            showCircleTooltip={false}
          />
        )
      },
    },
    {
      title: t('app.kuaizhizao.demandComputation.colActions'),
      key: 'option',
      valueType: 'option',
      width: 200,
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => {
        const canExecute = canExecuteComputation(record.computation_status)
        const canRecompute = isComputationCompleted(record.computation_status) || isComputationFailed(record.computation_status)
        const canExecuteByCapability = record.capabilities?.execute?.allowed !== false
        const canRecomputeByCapability = record.capabilities?.recompute?.allowed !== false
        const parts: React.ReactNode[] = [
          <Button {...rowActionKind('read')} key="d" onClick={() => handleDetail([record.id!])}>
            {t('app.kuaizhizao.demandComputation.actionDetail')}
          </Button>,
        ]
        if (canExecute && canExecuteByCapability && (computationPerms.canAction?.('submit') ?? false)) {
          parts.push(
            <Button {...rowActionKind('execute')} key="ex" onClick={() => handleExecute(record)}>
              {t('app.kuaizhizao.demandComputation.actionExecute')}
            </Button>
          )
        }
        if (canRecompute && canRecomputeByCapability && computationPerms.canUpdate) {
          parts.push(
            <Button {...rowActionKind('recycle')} key="rc" onClick={() => handleRecompute(record)}>
              {t('app.kuaizhizao.demandComputation.actionRecompute')}
            </Button>
          )
        }
        if (computationPerms.canDelete) {
          parts.push(
            <Button {...rowActionKind('delete')} key="del" onClick={() => handleDelete(record)}>
              {t('app.kuaizhizao.demandComputation.actionDelete')}
            </Button>
          )
        }
        return renderDemandComputationRowActions(parts, `dc-${record.id ?? 'row'}`)
      },
    },
  ],
    [computationPerms.canAction, computationPerms.canDelete, computationPerms.canUpdate, handleDelete, handleDetail, handleExecute, handleRecompute, messageApi, t],
  )

  const selectedComputationForToolbar = useMemo(() => {
    if (selectedRowKeys.length !== 1) return null
    const id = Number(selectedRowKeys[0])
    if (!Number.isFinite(id) || id <= 0) return null
    return lastComputationsCacheRef.current.find((row) => row.id === id) ?? null
  }, [selectedRowKeys])

  const canUseToolbarPush = selectedComputationForToolbar ? isComputationCompleted(selectedComputationForToolbar.computation_status) : false

  const toolbarPushDisabledReason = useMemo(() => {
    if (selectedRowKeys.length === 0) return t('app.kuaizhizao.demandComputation.selectOneFirst')
    if (selectedRowKeys.length > 1) return t('app.kuaizhizao.demandComputation.pushSingleOnly')
    if (!selectedComputationForToolbar) return t('app.kuaizhizao.demandComputation.selectedNotInList')
    if (!canUseToolbarPush) {
      return t('app.kuaizhizao.demandComputation.pushOnlyCompleted', { status: selectedComputationForToolbar.computation_status || t('app.kuaizhizao.demandComputation.statusUnknown') })
    }
    return undefined
  }, [canUseToolbarPush, selectedComputationForToolbar, selectedRowKeys, t])

  const toolbarPushMenuItems = useMemo(
    () =>
      selectedComputationForToolbar && canUseToolbarPush
        ? buildUniPushMenuItems([
            {
              key: 'push-documents',
              label: pushToWorkOrderAction.label,
              onClick: () => handleOpenPushPanel(selectedComputationForToolbar),
            },
          ])
        : [],
    [selectedComputationForToolbar, canUseToolbarPush, handleOpenPushPanel, pushToWorkOrderAction.label],
  )

  const statCards: StatCard[] = useMemo(
    () =>
      statistics
        ? [
            { title: t('app.kuaizhizao.demandComputation.statTotal'), value: statistics.total_count },
            {
              title: t('app.kuaizhizao.demandComputation.statInProgress'),
              value: statistics.pending_count,
              valueStyle: statistics.pending_count > 0 ? { color: '#faad14' } : undefined,
            },
            { title: t('app.kuaizhizao.demandComputation.statCompleted'), value: statistics.completed_count },
            {
              title: t('app.kuaizhizao.demandComputation.statRisk'),
              value: statistics.risk_count || 0,
              valueStyle: (statistics.risk_count || 0) > 0 ? { color: '#ff4d4f' } : undefined,
              prefix: <WarningOutlined />,
            },
          ]
        : [
            { title: t('app.kuaizhizao.demandComputation.statTotal'), value: 0 },
            { title: t('app.kuaizhizao.demandComputation.statInProgress'), value: 0 },
            { title: t('app.kuaizhizao.demandComputation.statCompleted'), value: 0 },
            {
              title: t('app.kuaizhizao.demandComputation.statRisk'),
              value: 0,
              prefix: <WarningOutlined />,
            },
          ],
    [statistics, t],
  )

  const [activeTabKey, setActiveTabKey] = useState<string>('list')

  const listTabContent = (
      <>
      <UniTable<DemandComputation>
        columnPersistenceId="apps.kuaizhizao.pages.plan-management.demand-computation"
        actionRef={actionRef}
        columns={columns}
        showAdvancedSearch={true}
        request={async (params, _sort, _filter, searchFormValues) => {
          const apiParams: any = {
            skip: (params.current! - 1) * params.pageSize!,
            limit: params.pageSize!,
          }

          // 处理搜索参数
          if (searchFormValues?.computation_code) {
            apiParams.computation_code = searchFormValues.computation_code
          }
          if (searchFormValues?.demand_code) {
            apiParams.demand_code = searchFormValues.demand_code
          }
          if (searchFormValues?.computation_type) {
            apiParams.computation_type = searchFormValues.computation_type
          }
          if (searchFormValues?.lifecycle ?? searchFormValues?.computation_status) {
            apiParams.computation_status = searchFormValues?.lifecycle ?? searchFormValues?.computation_status
          }
          if (searchFormValues?.business_mode) {
            apiParams.business_mode = searchFormValues.business_mode
          }
          if (searchFormValues?.demand_id) {
            apiParams.demand_id = searchFormValues.demand_id
          }

          // 处理时间范围搜索
          if (searchFormValues?.computation_start_time) {
            if (Array.isArray(searchFormValues.computation_start_time)) {
              if (searchFormValues.computation_start_time[0]) {
                apiParams.start_date = formatDateTime(searchFormValues.computation_start_time[0], 'YYYY-MM-DD')
              }
              if (searchFormValues.computation_start_time[1]) {
                apiParams.end_date = formatDateTime(searchFormValues.computation_start_time[1], 'YYYY-MM-DD')
              }
            } else if (searchFormValues.computation_start_time) {
              // 单个日期值
              apiParams.start_date = formatDateTime(searchFormValues.computation_start_time, 'YYYY-MM-DD')
            }
          }

          const result = await listDemandComputations(apiParams)
          lastComputationsCacheRef.current = result.data || []
          return {
            data: result.data || [],
            success: result.success,
            total: result.total || 0,
          }
        }}
        rowKey="id"
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        enableRowSelection={true}
        showDeleteButton={computationPerms.canDelete}
        onDelete={async (keys) => {
          try {
            for (const id of keys) {
              await deleteDemandComputation(Number(id))
            }
            messageApi.success(t('app.kuaizhizao.demandComputation.batchDeleteSuccess', { count: keys.length }))
            invalidateStatistics()
            actionRef.current?.reload()
          } catch (error: any) {
            messageApi.error(error?.response?.data?.detail || t('app.kuaizhizao.demandComputation.deleteFailed'))
          }
        }}
        deleteConfirmTitle={(count) => t('app.kuaizhizao.demandComputation.batchDeleteConfirm', { count })}
        deleteConfirmDescription={t('app.kuaizhizao.demandComputation.batchDeleteDescription')}
        search={{
          labelWidth: 'auto',
        }}
        showCreateButton={false}
        createButtonText={t('app.kuaizhizao.demandComputation.create')}
        onCreate={handleCreate}
        toolBarRender={() => {
          const pushButton = (
            <UniPushToolbarButton
              key={`computation-push-${selectedComputationForToolbar?.id ?? 'none'}`}
              menuItems={toolbarPushMenuItems}
              disabled={!!toolbarPushDisabledReason}
            />
          )
          return [
            <UniPullCreateToolbar
              compactKey="create-demand-computation-with-pull"
              createIcon={<PlayCircleOutlined />}
              createLabel={createComputationButtonLabel}
              onCreate={() => {
                void handleCreate()
              }}
              menuItems={buildKuaizhizaoPullCreateMenuItems(t, [
                {
                  key: 'pull-from-demand',
                  actionKey: 'demand_computation.pull_from_demand',
                  onClick: () => {
                    pullFromDemandQuery.openModal()
                  },
                },
                {
                  key: 'pull-from-sales-order',
                  actionKey: 'demand_computation.pull_from_sales_order',
                  onClick: () => {
                    pullFromSalesOrderQuery.openModal()
                  },
                },
                {
                  key: 'pull-from-sales-forecast',
                  actionKey: 'demand_computation.pull_from_sales_forecast',
                  onClick: () => {
                    pullFromSalesForecastQuery.openModal()
                  },
                },
              ])}
            />,
            toolbarPushDisabledReason ? (
              <Tooltip key="computation-push-tooltip" title={toolbarPushDisabledReason}>
                <span style={{ display: 'inline-block' }}>{pushButton}</span>
              </Tooltip>
            ) : (
              pushButton
            ),
          ]
        }}
        toolBarActionsAfterDelete={[]}
        toolBarActionsAfterBatch={[
          <UniCapabilityBatchButton
            key="demand-computation-batch-execute"
            selectedRowKeys={selectedRowKeys}
            selectedRecords={selectedComputationsForBatch}
            capabilityKey="execute"
            permAllowed={computationPerms.canAction?.('submit') ?? false}
            batchAllowed={(recs, perm) => demandComputationBatchExecuteAllowed(recs, perm)}
            onRun={(id) => executeDemandComputation(id)}
            labels={{
              single: t('app.kuaizhizao.demandComputation.actionExecute'),
              batch: t('app.kuaizhizao.demandComputation.batchExecute'),
            }}
            icon={<PlayCircleOutlined />}
            size="middle"
            onSuccess={handleComputationBatchSuccess}
          />,
          <UniCapabilityBatchButton
            key="demand-computation-batch-recompute"
            selectedRowKeys={selectedRowKeys}
            selectedRecords={selectedComputationsForBatch}
            capabilityKey="recompute"
            permAllowed={computationPerms.canUpdate}
            batchAllowed={(recs, perm) => demandComputationBatchRecomputeAllowed(recs, perm)}
            onRun={(id) => recomputeDemandComputation(id)}
            labels={{
              single: t('app.kuaizhizao.demandComputation.actionRecompute'),
              batch: t('app.kuaizhizao.demandComputation.batchRecompute'),
            }}
            icon={<ReloadOutlined />}
            size="middle"
            onSuccess={handleComputationBatchSuccess}
          />,
          <Button
            key="open-replan-dashboard"
            color="orange"
            variant="solid"
            onClick={() => navigate('/apps/kuaizhizao/plan-management/demand-change')}
          >
            {t('app.kuaizhizao.menu.plan-management.demand-change')}
          </Button>,
          <MrpParametersCustomerGuideTrigger key="mrp-params-guide" size="small" />,
        ]}
      />

      <UniPullQueryModal<PullDemandCandidate>
        open={pullFromDemandQuery.open}
        title={pullFromDemandAction.label}
        onCancel={pullFromDemandQuery.closeModal}
        onOk={pullFromDemandQuery.handleConfirm}
        rowKey="id"
        columns={[
          { title: t('app.kuaizhizao.demandComputation.colDemandCode'), dataIndex: 'demand_code', width: 180, ellipsis: true },
          { title: t('app.kuaizhizao.demandComputation.colDemandName'), dataIndex: 'demand_name', width: 220, ellipsis: true },
          { title: t('app.kuaizhizao.demandComputation.colDemandType'), dataIndex: 'demand_type', width: 130, align: 'center' },
          { title: t('app.kuaizhizao.demandComputation.colBusinessMode'), dataIndex: 'business_mode', width: 110, align: 'center' },
          { title: t('app.kuaizhizao.demandComputation.colStatus'), dataIndex: 'status', width: 120, align: 'center' },
          {
            title: t('app.kuaizhizao.demandComputation.colUpdatedAt'),
            dataIndex: 'updated_at',
            width: 180,
            render: (v) => (v ? formatDateTime(v, 'YYYY-MM-DD HH:mm:ss') : '-'),
          },
          {
            title: t('app.kuaizhizao.demandComputation.colConvertStatus'),
            key: 'convert_status',
            width: 150,
            align: 'center',
            render: (_, r) =>
              r.pushed_to_computation ? <Tag color="gold">{t('app.kuaizhizao.demandComputation.convertPushed')}</Tag> : <Tag color="success">{t('app.kuaizhizao.demandComputation.convertCreatable')}</Tag>,
          },
        ]}
        dataSource={pullFromDemandQuery.dataSource}
        loading={pullFromDemandQuery.loading}
        confirmLoading={pullFromDemandQuery.confirmLoading}
        selectionType={pullFromDemandQuery.selectionType}
        selectedRowKeys={pullFromDemandQuery.selectedRowKeys}
        onSelectedRowKeysChange={pullFromDemandQuery.handleSelectedRowKeysChange}
        isRowDisabled={pullFromDemandQuery.isRowDisabled}
        searchDraft={pullFromDemandQuery.searchDraft}
        onSearchDraftChange={pullFromDemandQuery.setSearchDraft}
        onSearchApply={pullFromDemandQuery.handleSearchApply}
        onSearchClear={pullFromDemandQuery.handleSearchClear}
        appliedKeyword={pullFromDemandQuery.appliedKeyword}
        searchPlaceholder={t('app.kuaizhizao.demandComputation.searchDemandPlaceholder')}
        page={pullFromDemandQuery.page}
        pageSize={pullFromDemandQuery.pageSize}
        total={pullFromDemandQuery.total}
        onPageChange={pullFromDemandQuery.handlePageChange}
        okText={t('app.kuaizhizao.demandComputation.createComputation')}
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
      />

      <UniPullQueryModal<PullSalesOrderCandidate>
        open={pullFromSalesOrderQuery.open}
        title={pullFromSalesOrderAction.label}
        onCancel={pullFromSalesOrderQuery.closeModal}
        onOk={pullFromSalesOrderQuery.handleConfirm}
        rowKey="id"
        columns={[
          { title: t('app.kuaizhizao.salesOrder.orderCode'), dataIndex: 'order_code', width: 180, ellipsis: true },
          { title: t('app.kuaizhizao.quotation.form.customer'), dataIndex: 'customer_name', width: 200, ellipsis: true },
          { title: t('app.kuaizhizao.salesOrder.status'), dataIndex: 'status', width: 120, align: 'center' },
          { title: t('app.kuaizhizao.salesOrder.reviewStatus'), dataIndex: 'review_status', width: 120, align: 'center' },
          {
            title: t('app.kuaizhizao.salesOrder.deliveryDate'),
            dataIndex: 'delivery_date',
            width: 130,
            render: (v) => (v ? formatDateTime(v, 'YYYY-MM-DD') : '-'),
          },
          {
            title: t('common.updatedAt'),
            dataIndex: 'updated_at',
            width: 180,
            render: (v) => (v ? formatDateTime(v, 'YYYY-MM-DD HH:mm:ss') : '-'),
          },
          {
            title: t('app.kuaizhizao.demandComputation.colConvertStatus'),
            key: 'convert_status',
            width: 170,
            align: 'center',
            render: (_, r) =>
              r.pushed_to_computation || r.capabilities?.push_computation?.allowed === false
                ? <Tag color="gold">{salesOrderCapabilityReasonMessage(r.capabilities?.push_computation?.reason, t) || t('app.kuaizhizao.demandComputation.convertPushed')}</Tag>
                : <Tag color="success">{t('app.kuaizhizao.demandComputation.convertCreatable')}</Tag>,
          },
        ]}
        dataSource={pullFromSalesOrderQuery.dataSource}
        loading={pullFromSalesOrderQuery.loading}
        confirmLoading={pullFromSalesOrderQuery.confirmLoading}
        selectionType={pullFromSalesOrderQuery.selectionType}
        selectedRowKeys={pullFromSalesOrderQuery.selectedRowKeys}
        onSelectedRowKeysChange={pullFromSalesOrderQuery.handleSelectedRowKeysChange}
        isRowDisabled={pullFromSalesOrderQuery.isRowDisabled}
        searchDraft={pullFromSalesOrderQuery.searchDraft}
        onSearchDraftChange={pullFromSalesOrderQuery.setSearchDraft}
        onSearchApply={pullFromSalesOrderQuery.handleSearchApply}
        onSearchClear={pullFromSalesOrderQuery.handleSearchClear}
        appliedKeyword={pullFromSalesOrderQuery.appliedKeyword}
        searchPlaceholder={t('components.uniPullQuery.searchPlaceholder')}
        page={pullFromSalesOrderQuery.page}
        pageSize={pullFromSalesOrderQuery.pageSize}
        total={pullFromSalesOrderQuery.total}
        onPageChange={pullFromSalesOrderQuery.handlePageChange}
        okText={t('app.kuaizhizao.demandComputation.createComputation')}
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
      />

      <UniPullQueryModal<PullSalesForecastCandidate>
        open={pullFromSalesForecastQuery.open}
        title={pullFromSalesForecastAction.label}
        onCancel={pullFromSalesForecastQuery.closeModal}
        onOk={pullFromSalesForecastQuery.handleConfirm}
        rowKey="id"
        columns={[
          { title: t('app.kuaizhizao.salesForecast.forecastCode'), dataIndex: 'forecast_code', width: 180, ellipsis: true },
          { title: t('app.kuaizhizao.salesForecast.forecastName'), dataIndex: 'forecast_name', width: 220, ellipsis: true },
          { title: t('app.kuaizhizao.salesForecast.forecastPeriod'), dataIndex: 'forecast_period', width: 120, align: 'center' },
          { title: t('app.kuaizhizao.salesForecast.status'), dataIndex: 'status', width: 120, align: 'center' },
          { title: t('app.kuaizhizao.salesForecast.reviewStatus'), dataIndex: 'review_status', width: 120, align: 'center' },
          {
            title: t('common.updatedAt'),
            dataIndex: 'updated_at',
            width: 180,
            render: (v) => (v ? formatDateTime(v, 'YYYY-MM-DD HH:mm:ss') : '-'),
          },
          {
            title: t('app.kuaizhizao.demandComputation.colConvertStatus'),
            key: 'convert_status',
            width: 170,
            align: 'center',
            render: (_, r) =>
              r.planning_pushed_to_computation || r.capabilities?.push_computation?.allowed === false
                ? <Tag color="gold">{salesForecastCapabilityReasonMessage(r.capabilities?.push_computation?.reason, t) || t('app.kuaizhizao.demandComputation.convertPushed')}</Tag>
                : <Tag color="success">{t('app.kuaizhizao.demandComputation.convertCreatable')}</Tag>,
          },
        ]}
        dataSource={pullFromSalesForecastQuery.dataSource}
        loading={pullFromSalesForecastQuery.loading}
        confirmLoading={pullFromSalesForecastQuery.confirmLoading}
        selectionType={pullFromSalesForecastQuery.selectionType}
        selectedRowKeys={pullFromSalesForecastQuery.selectedRowKeys}
        onSelectedRowKeysChange={pullFromSalesForecastQuery.handleSelectedRowKeysChange}
        isRowDisabled={pullFromSalesForecastQuery.isRowDisabled}
        searchDraft={pullFromSalesForecastQuery.searchDraft}
        onSearchDraftChange={pullFromSalesForecastQuery.setSearchDraft}
        onSearchApply={pullFromSalesForecastQuery.handleSearchApply}
        onSearchClear={pullFromSalesForecastQuery.handleSearchClear}
        appliedKeyword={pullFromSalesForecastQuery.appliedKeyword}
        searchPlaceholder={t('components.uniPullQuery.searchPlaceholder')}
        page={pullFromSalesForecastQuery.page}
        pageSize={pullFromSalesForecastQuery.pageSize}
        total={pullFromSalesForecastQuery.total}
        onPageChange={pullFromSalesForecastQuery.handlePageChange}
        okText={t('app.kuaizhizao.demandComputation.createComputation')}
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
      />

      {/* 新建计算：FormModalTemplate（UI_Standard 新建/编辑 Modal） */}
      <FormModalTemplate
        title={t('app.kuaizhizao.demandComputation.createTitle')}
        open={modalVisible}
        onClose={() => setModalVisible(false)}
        width={MODAL_CONFIG.LARGE_WIDTH}
        loading={createSubmitting}
        formRef={formRef}
        initialValues={{
          demand_ids: [],
          computation_params: {
            ...PARAM_DEFAULTS,
            material_bom_versions: {},
          },
        }}
        onFinish={async (values: any) => {
          if (!selectedDemandIds || selectedDemandIds.length === 0) {
            messageApi.error(t('app.kuaizhizao.demandComputation.selectDemandsRequired'))
            return
          }
          setCreateSubmitting(true)
          try {
            const params = values.computation_params || {}
            const materialBomVersions = params.material_bom_versions || {}
            const filteredMaterialBomVersions = Object.fromEntries(
              Object.entries(materialBomVersions).filter(([, v]) => v != null && String(v).trim() !== '')
            )
            const computationParams = { ...params }
            if (Object.keys(filteredMaterialBomVersions).length > 0) {
              computationParams.material_bom_versions = filteredMaterialBomVersions
            } else {
              delete computationParams.material_bom_versions
            }
            if (createModalMaterials.length > 0) {
              delete computationParams.bom_version
            }
            const createData: any = {
              computation_type: 'MRP',
              computation_params: computationParams,
              notes: values.notes,
            }
            if (selectedDemandIds.length === 1) {
              createData.demand_id = selectedDemandIds[0]
            } else {
              createData.demand_ids = selectedDemandIds
            }
            await createDemandComputation(createData)
            messageApi.success(t('app.kuaizhizao.demandComputation.createSuccessMerged', { count: selectedDemandIds.length }))
            setModalVisible(false)
            invalidateStatistics(); actionRef.current?.reload()
          } catch (error: any) {
            messageApi.error(error?.response?.data?.detail || t('app.kuaizhizao.demandComputation.createFailed'))
          } finally {
            setCreateSubmitting(false)
          }
        }}
      >
        <ProFormSelect
          name="demand_ids"
          label={t('app.kuaizhizao.demandComputation.selectDemands')}
          mode="multiple"
          options={demandList.map(d => ({
            label: `${d.demand_code} - ${d.demand_name || ''} (${getDemandBusinessModeLabel(d.business_mode)})`,
            value: d.id,
          }))}
          fieldProps={{
            onChange: (value: number[]) => setSelectedDemandIds(value),
            placeholder: t('app.kuaizhizao.demandComputation.selectDemandsPlaceholder'),
          }}
          rules={[{ required: true, message: t('app.kuaizhizao.demandComputation.selectDemandsRequired') }]}
          tooltip={t('app.kuaizhizao.demandComputation.selectDemandsTooltip')}
        />
        <ProForm.Item
          name="computation_params"
          label={
            <Space align="center" wrap size={8}>
              <span>{t('app.kuaizhizao.demandComputation.paramsTitle')}</span>
              <ProFormDependency name={['computation_params']}>
                {({ computation_params: cp }) => {
                  const cur = cp || {}
                  const segVal = cur.mrp_suggestion_basis === 'gross' ? 'gross' : 'net'
                  return (
                    <ThemedSegmented
                      size="small"
                      options={getMrpSuggestionSegmentedOptions(t)}
                      value={segVal}
                      onChange={val =>
                        formRef.current?.setFieldsValue({
                          computation_params: mergeComputationParamsForSuggestionBasis(
                            cur,
                            val as 'net' | 'gross'
                          ),
                        })
                      }
                    />
                  )
                }}
              </ProFormDependency>
            </Space>
          }
        >
          <InventoryParamsForm
            bomMultiVersionAllowed={bomMultiVersionAllowed}
            materials={createModalMaterials}
            normalWarehouseIds={normalWarehouseIds}
            warehouseOptions={warehouseSelectOptions}
          />
        </ProForm.Item>
        <ProFormTextArea name="notes" label={t('app.kuaizhizao.demandComputation.colNotes')} placeholder={t('app.kuaizhizao.demandComputation.notesPlaceholder')} />
      </FormModalTemplate>

      {/* 单一下推面板 Modal */}
      <Modal
        open={!!pushPanelRecord}
        title={t('app.kuaizhizao.demandComputation.pushPanelTitle', { code: pushPanelRecord?.computation_code || '' })}
        width={MODAL_CONFIG.SMALL_WIDTH}
        okText={t('app.kuaizhizao.demandComputation.confirmPush')}
        confirmLoading={pushPanelSubmitting}
        onOk={handlePushPanelConfirm}
        onCancel={() => {
          setPushPanelRecord(null)
          setPushOptions(null)
          setPushPreviewData(null)
          setPushConfig({})
        }}
      >
        {pushPanelLoading ? (
          <div style={{ padding: 24, textAlign: 'center' }}>{t('app.kuaizhizao.demandComputation.loading')}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {pushOptions && (
              <>
                {pushOptions.production_choices.length > 0 && (
                  <div>
                    <div style={{ fontWeight: 'bold', marginBottom: 8 }}>{t('app.kuaizhizao.demandComputation.productionPath')}</div>
                    <div style={{ color: '#666' }}>{t('app.kuaizhizao.demandComputation.productionPathDesc')}</div>
                  </div>
                )}
                {pushOptions.purchase_choices.length > 0 && (
                  <div>
                    <div style={{ fontWeight: 'bold', marginBottom: 8 }}>{t('app.kuaizhizao.demandComputation.purchasePath')}</div>
                    <Radio.Group
                      value={pushConfig.purchase}
                      onChange={e => setPushConfig(c => ({ ...c, purchase: e.target.value }))}
                    >
                      <Radio value="requisition">{t('app.kuaizhizao.demandComputation.purchaseRequisition')}</Radio>
                      <Radio value="purchase_order">{t('app.kuaizhizao.demandComputation.purchaseOrderOnly')}</Radio>
                    </Radio.Group>
                  </div>
                )}
                <p style={{ fontSize: 12, color: '#666' }}>
                  {t('app.kuaizhizao.demandComputation.pushOutsourceHint')}
                </p>
              </>
            )}
            {pushPreviewData && (
              <div>
                <p style={{ marginBottom: 12 }}>{t('app.kuaizhizao.demandComputation.pushWillGenerate')}</p>
                <ul style={{ marginBottom: 12, paddingLeft: 20 }}>
                  {(pushPreviewData as any).work_order_group_count > 0 && (
                    <li>{t('app.kuaizhizao.demandComputation.pushWorkOrderGroups', { count: (pushPreviewData as any).work_order_group_count })}</li>
                  )}
                  {pushPreviewData.work_order_count > 0 && (
                    <li>{t('app.kuaizhizao.demandComputation.pushWorkOrders', { count: pushPreviewData.work_order_count })}</li>
                  )}
                  {pushPreviewData.outsource_work_order_count > 0 && (
                    <li>
                      {t('app.kuaizhizao.demandComputation.pushOutsourceWorkOrders', { count: pushPreviewData.outsource_work_order_count })}
                      {pushPreviewData.validation_failures?.length ? t('app.kuaizhizao.demandComputation.pushOutsourceDraftHint') : ''}
                    </li>
                  )}
                  {pushPreviewData.purchase_requisition_count > 0 && (
                    <li>{t('app.kuaizhizao.demandComputation.pushPurchaseRequisitions', { count: pushPreviewData.purchase_requisition_count })}</li>
                  )}
                  {pushPreviewData.purchase_order_count > 0 && (
                    <li>{t('app.kuaizhizao.demandComputation.pushPurchaseOrders', { count: pushPreviewData.purchase_order_count })}</li>
                  )}
                </ul>
                {pushPreviewData.validation_failures && pushPreviewData.validation_failures.length > 0 && (
                  <div style={{ marginTop: 12, padding: 12, background: '#fff7e6', borderRadius: 4 }}>
                    <div style={{ fontWeight: 'bold', marginBottom: 8 }}>{t('app.kuaizhizao.demandComputation.validationFailedMaterials')}</div>
                    <ul style={{ margin: 0, paddingLeft: 20 }}>
                      {pushPreviewData.validation_failures.map((v, i) => (
                        <li key={i}>
                          {v.material_code} ({v.material_name}): {v.errors.join(', ')}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* 执行计算 - 计算参数 Modal */}
      <Modal
        open={executeModalVisible}
        destroyOnHidden
        onCancel={() => {
          setExecuteModalVisible(false)
          setExecuteRecord(null)
        }}
        title={t('app.kuaizhizao.demandComputation.executeTitle')}
        width={MODAL_CONFIG.LARGE_WIDTH}
        okText={t('app.kuaizhizao.demandComputation.actionExecute')}
        confirmLoading={executeLoading}
        onOk={handleExecuteSubmit}
        styles={{
          body: {
            maxHeight: MODAL_CONFIG.BODY_MAX_HEIGHT,
            overflowY: 'auto',
            paddingTop: token.paddingMD,
            paddingBottom: token.paddingSM,
          },
        }}
      >
        {executeRecord && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: token.marginMD }}>
            <div>
              <Typography.Text type="secondary" style={{ display: 'block', marginBottom: token.marginSM, fontSize: token.fontSizeSM }}>
                {t('app.kuaizhizao.demandComputation.executeConfirmHint')}
              </Typography.Text>
              <ProDescriptions<DemandComputation>
                column={2}
                size="small"
                bordered
                dataSource={executeRecord}
                columns={[
                  { title: t('app.kuaizhizao.demandComputation.colComputationCode'), dataIndex: 'computation_code' },
                  { title: t('app.kuaizhizao.demandComputation.colSourceNo'), dataIndex: 'demand_code' },
                  {
                    title: t('app.kuaizhizao.demandComputation.colComputationType'),
                    dataIndex: 'computation_type',
                    render: () => t('app.kuaizhizao.demandComputation.computationTypeMrp'),
                  },
                  {
                    title: t('app.kuaizhizao.demandComputation.colBusinessMode'),
                    dataIndex: 'business_mode',
                    render: (dom: any) => getDemandBusinessModeLabel(dom),
                  },
                ]}
              />
            </div>

            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: token.marginSM,
                  marginBottom: token.marginXXS,
                }}
              >
                <Typography.Title level={5} style={{ margin: 0 }}>
                  {t('app.kuaizhizao.demandComputation.paramsTitle')}
                </Typography.Title>
                <ThemedSegmented
                  size="small"
                  options={getMrpSuggestionSegmentedOptions(t)}
                  value={executeParams.mrp_suggestion_basis === 'gross' ? 'gross' : 'net'}
                  onChange={val =>
                    setExecuteParams(p => mergeComputationParamsForSuggestionBasis(p, val as 'net' | 'gross'))
                  }
                />
              </div>
              <Typography.Paragraph type="secondary" style={{ marginBottom: token.marginMD, fontSize: token.fontSizeSM }}>
                {t('app.kuaizhizao.demandComputation.executeParamsHint')}
              </Typography.Paragraph>
              <InventoryParamsForm
                value={executeParams}
                onChange={setExecuteParams}
                bomMultiVersionAllowed={bomMultiVersionAllowed}
                materials={executeModalMaterials}
                normalWarehouseIds={normalWarehouseIds}
                warehouseOptions={warehouseSelectOptions}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* 计算结果预览 Modal - 二次确认 */}
      <Modal
        open={previewModalVisible}
        zIndex={token.zIndexPopupBase + 100}
        onCancel={() => {
          setPreviewModalVisible(false)
          setPreviewData(null)
          setPreviewTablePage(1)
          setPreviewTablePageSize(10)
          setExecuteModalVisible(true)
        }}
        title={t('app.kuaizhizao.demandComputation.previewTitle')}
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
        styles={{
          container: {
            width: MODAL_CONFIG.EXTRA_LARGE_WIDTH,
            maxWidth: 'calc(100vw - 32px)',
          },
        }}
        okText={t('app.kuaizhizao.demandComputation.confirmExecute')}
        cancelText={t('common.cancel')}
        confirmLoading={executeLoading}
        onOk={handleConfirmExecute}
      >
        {previewData && (
          <>
            <p style={{ marginBottom: 12 }}>
              {t('app.kuaizhizao.demandComputation.previewItemCount', { count: previewData.item_count })}
            </p>
            <Table
              size="small"
              dataSource={previewData.items}
              rowKey={(r, i) => `${r.material_code}-${i}`}
              pagination={{
                current: previewTablePage,
                pageSize: previewTablePageSize,
                showSizeChanger: true,
                pageSizeOptions: ['10', '20', '50', '100'],
                showTotal: (total) => t('app.kuaizhizao.demandComputation.totalItems', { count: total }),
                onChange: (page, size) => {
                  setPreviewTablePage(page)
                  if (size != null) setPreviewTablePageSize(size)
                },
                onShowSizeChange: (_page, size) => {
                  setPreviewTablePage(1)
                  setPreviewTablePageSize(size)
                },
              }}
              columns={[
                {
                  title: t('app.kuaizhizao.demandComputation.colMaterial'),
                  key: 'material',
                  width: 220,
                  render: (_: unknown, r: (typeof previewData.items)[number]) => (
                    <MaterialStackedCell material_name={r.material_name} material_code={r.material_code} />
                  ),
                },
                {
                  title: t('app.kuaizhizao.demandComputation.colUnit'),
                  dataIndex: 'material_unit',
                  width: 100,
                  render: (_: unknown, r) => (
                    <MaterialUnitSelect
                      materialId={r.material_id}
                      value={r.material_unit}
                      size="small"
                      disabled
                      noStyle
                    />
                  ),
                },
                {
                  title: t('app.kuaizhizao.demandComputation.colDemandTime'),
                  dataIndex: 'delivery_date',
                  width: 110,
                  render: (v: string | null | undefined) => formatDateBySiteSetting(v),
                },
                {
                  title: t('app.kuaizhizao.demandComputation.colPlannedTime'),
                  dataIndex: 'planned_date',
                  width: 110,
                  render: (v: string | null | undefined) => formatDateBySiteSetting(v),
                },
                {
                  title: t('app.kuaizhizao.demandComputation.colRequiredQty'),
                  dataIndex: 'required_quantity',
                  width: 90,
                  render: (v: number) => (v ? Number(v).toLocaleString() : '-'),
                },
                {
                  title: t('app.kuaizhizao.demandComputation.colAvailableInventory'),
                  dataIndex: 'available_inventory',
                  width: 90,
                  align: 'right' as const,
                  render: (v: number, r) =>
                    renderAvailableInventoryCell(v, r.detail_results as Record<string, unknown> | undefined),
                },
                {
                  title: t('app.kuaizhizao.demandComputation.colNetRequirement'),
                  dataIndex: 'net_requirement',
                  width: 90,
                  render: (v: number) => (v ? Number(v).toLocaleString() : '-'),
                },
                {
                  title: t('app.kuaizhizao.demandComputation.colSuggestedWorkOrder'),
                  dataIndex: 'suggested_work_order_quantity',
                  width: 90,
                  render: (v: number, r: any) =>
                    r.material_source_type === 'Outsource' ? '-' : (v ? Number(v).toLocaleString() : '-'),
                },
                {
                  title: t('app.kuaizhizao.demandComputation.colSuggestedOutsource'),
                  dataIndex: 'suggested_work_order_quantity',
                  width: 90,
                  render: (v: number, r: any) =>
                    r.material_source_type === 'Outsource' ? (v ? Number(v).toLocaleString() : '-') : '-',
                },
                {
                  title: t('app.kuaizhizao.demandComputation.colSuggestedPurchase'),
                  dataIndex: 'suggested_purchase_order_quantity',
                  width: 90,
                  render: (v: number) => (v ? Number(v).toLocaleString() : '-'),
                },
                {
                  title: t('app.kuaizhizao.demandComputation.colSource'),
                  dataIndex: 'material_source_type',
                  width: 80,
                  render: (sourceType: string) => getMaterialSourceLabel(t, sourceType),
                },
              ]}
            />
          </>
        )}
      </Modal>

      <Modal
        title={t('app.kuaizhizao.demandComputation.snapshotTitle')}
        open={recalcSnapshotModalOpen}
        zIndex={token.zIndexPopupBase + 80}
        onCancel={() => {
          setRecalcSnapshotModalOpen(false)
          setRecalcSnapshotModalData(null)
        }}
        footer={null}
        width={720}
        destroyOnHidden
      >
        {recalcSnapshotModalLoading ? (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <Spin />
          </div>
        ) : recalcSnapshotModalData ? (
          <div style={{ maxHeight: '70vh', overflow: 'auto' }}>
            {recalcSnapshotModalData.snapshot_at ? (
              <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
                {t('app.kuaizhizao.demandComputation.snapshotAt', { time: recalcSnapshotModalData.snapshot_at })}
                {recalcSnapshotModalData.trigger ? t('app.kuaizhizao.demandComputation.snapshotTrigger', { trigger: recalcSnapshotModalData.trigger }) : null}
              </Typography.Paragraph>
            ) : null}
            {recalcSnapshotModalData.computation_summary_snapshot ? (
              <div style={{ marginBottom: 16 }}>
                <Typography.Text strong>{t('app.kuaizhizao.demandComputation.snapshotSummary')}</Typography.Text>
                <pre
                  style={{
                    margin: '8px 0 0',
                    padding: 12,
                    fontSize: 12,
                    background: 'var(--ant-color-fill-quaternary)',
                    borderRadius: token.borderRadius,
                    overflow: 'auto',
                    maxHeight: 240,
                  }}
                >
                  {JSON.stringify(recalcSnapshotModalData.computation_summary_snapshot, null, 2)}
                </pre>
              </div>
            ) : null}
            {recalcSnapshotModalData.items_snapshot && recalcSnapshotModalData.items_snapshot.length > 0 ? (
              <div>
                <Typography.Text strong>{t('app.kuaizhizao.demandComputation.snapshotItems')}</Typography.Text>
                <pre
                  style={{
                    margin: '8px 0 0',
                    padding: 12,
                    fontSize: 12,
                    background: 'var(--ant-color-fill-quaternary)',
                    borderRadius: token.borderRadius,
                    overflow: 'auto',
                    maxHeight: 320,
                  }}
                >
                  {JSON.stringify(recalcSnapshotModalData.items_snapshot, null, 2)}
                </pre>
              </div>
            ) : null}
            {!recalcSnapshotModalData.computation_summary_snapshot &&
            (!recalcSnapshotModalData.items_snapshot ||
              recalcSnapshotModalData.items_snapshot.length === 0) ? (
              <Typography.Text type="secondary">{t('app.kuaizhizao.demandComputation.snapshotEmpty')}</Typography.Text>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <DetailDrawerTemplate
        title={
          currentComputation?.computation_code ? (
            <Space align="center" size={8}>
              <span>{t('app.kuaizhizao.demandComputation.detailTitleWithCode', { code: currentComputation.computation_code })}</span>
              <Tooltip title={t('field.invitationCode.copy')}>
                <Button
                  type="text"
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(currentComputation.computation_code!)
                      .then(() => messageApi.success(t('app.kuaizhizao.demandComputation.copied')), () => messageApi.error(t('app.kuaizhizao.demandComputation.copyFailed')))
                  }
                />
              </Tooltip>
            </Space>
          ) : (
            t('app.kuaizhizao.demandComputation.detailTitle')
          )
        }
        open={drawerVisible}
        zIndex={computationDetailDrawerZIndex}
        onClose={() => {
          setDrawerVisible(false)
          setRecalcSnapshotModalOpen(false)
          setRecalcSnapshotModalData(null)
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        className="demand-computation-drawer"
        styles={{
          body: { paddingTop: 8, paddingBottom: 8 },
        }}
        plainBody={
          currentComputation ? (
          <Tabs
            activeKey={detailTabKey}
            onChange={(key) => {
              setDetailTabKey(key)
              if (key === 'records' && currentComputation.id) {
                loadComputationRecordsTabData(currentComputation.id)
              }
            }}
            items={[
              {
                key: 'detail',
                label: t('app.kuaizhizao.demandComputation.drawerTabDetail'),
                children: (
                  <>
                    <DetailDrawerSection title={t('app.uniDetail.sectionBasic')}>
                      <Descriptions
                        column={3}
                        size="small"
                        items={[
                          {
                            key: 'code',
                            label: t('app.kuaizhizao.demandComputation.colComputationCode'),
                            children: (
                              <Space size={4}>
                                <span>{currentComputation.computation_code ?? '—'}</span>
                                {currentComputation.computation_code ? (
                                  <Tooltip title={t('field.invitationCode.copy')}>
                                    <Button
                                      type="link"
                                      size="small"
                                      icon={<CopyOutlined style={{ fontSize: 12 }} />}
                                      onClick={() =>
                                        void navigator.clipboard
                                          .writeText(currentComputation.computation_code!)
                                          .then(() => messageApi.success(t('app.kuaizhizao.demandComputation.copied')), () => messageApi.error(t('app.kuaizhizao.demandComputation.copyFailed')))
                                      }
                                    />
                                  </Tooltip>
                                ) : null}
                              </Space>
                            ),
                          },
                          {
                            key: 'demand',
                            label: t('app.kuaizhizao.demandComputation.colSourceNo'),
                            children: (
                              <Space size={4}>
                                <span>{currentComputation.demand_code ?? '—'}</span>
                                {currentComputation.demand_code ? (
                                  <Tooltip title={t('field.invitationCode.copy')}>
                                    <Button
                                      type="link"
                                      size="small"
                                      icon={<CopyOutlined style={{ fontSize: 12 }} />}
                                      onClick={() =>
                                        void navigator.clipboard
                                          .writeText(currentComputation.demand_code!)
                                          .then(() => messageApi.success(t('app.kuaizhizao.demandComputation.copied')), () => messageApi.error(t('app.kuaizhizao.demandComputation.copyFailed')))
                                      }
                                    />
                                  </Tooltip>
                                ) : null}
                              </Space>
                            ),
                          },
                          {
                            key: 'ctype',
                            label: t('app.kuaizhizao.demandComputation.colComputationType'),
                            children: t('app.kuaizhizao.demandComputation.computationTypeMrp'),
                          },
                          {
                            key: 'bm',
                            label: t('app.kuaizhizao.demandComputation.colBusinessMode'),
                            children: getDemandBusinessModeLabel(currentComputation.business_mode),
                          },
                          {
                            key: 'dtype',
                            label: t('app.kuaizhizao.demandComputation.colSourceType'),
                            children: (
                              <Tag {...getDemandTypeTagProps(currentComputation.demand_type)}>
                                {getDemandTypeLabel(currentComputation.demand_type)}
                              </Tag>
                            ),
                          },
                          {
                            key: 'st',
                            label: t('app.kuaizhizao.demandComputation.colComputationStatus'),
                            children: (
                              <Tag
                                {...getDocumentLifecycleStageTagProps(
                                  currentComputation.computation_status ?? '进行中'
                                )}
                              >
                                {currentComputation.computation_status ?? '—'}
                              </Tag>
                            ),
                          },
                          {
                            key: 't1',
                            label: t('app.kuaizhizao.demandComputation.colStartTime'),
                            children: formatDateTimeBySiteSetting(currentComputation.computation_start_time) || '—',
                          },
                          {
                            key: 't2',
                            label: t('app.kuaizhizao.demandComputation.colEndTime'),
                            span: validationResults ? 1 : 2,
                            children: formatDateTimeBySiteSetting(currentComputation.computation_end_time) || '—',
                          },
                          ...(validationResults
                            ? [
                                {
                                  key: 'v0',
                                  label: t('app.kuaizhizao.demandComputation.sourceValidation'),
                                  children: (
                                    <Tag color={validationResults.all_passed ? 'success' : 'error'}>
                                      {validationResults.all_passed ? t('app.kuaizhizao.demandComputation.validationAllPassed') : t('app.kuaizhizao.demandComputation.validationHasFailed')}
                                    </Tag>
                                  ),
                                },
                                {
                                  key: 'v1',
                                  label: t('app.kuaizhizao.demandComputation.validationCounts'),
                                  span: 3,
                                  children: `${validationResults.passed_count ?? 0} / ${validationResults.failed_count ?? 0} / ${validationResults.total_count ?? 0}`,
                                },
                              ]
                            : []),
                          {
                            key: 'notes',
                            label: t('app.kuaizhizao.demandComputation.colNotes'),
                            span: 3,
                            children: normalizeComputationSourceNote(currentComputation, t) || '—',
                          },
                        ]}
                      />
                      {validationResults && validationResults.failed_count > 0 && (
                        <div style={{ marginTop: 12 }}>
                          <Typography.Text strong type="danger">
                            {t('app.kuaizhizao.demandComputation.validationFailedMaterialsDetail')}
                          </Typography.Text>
                          <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20 }}>
                            {validationResults.validation_results
                              .filter((r: any) => !r.validation_passed)
                              .map((r: any, index: number) => (
                                <li key={index} style={{ marginBottom: 4 }}>
                                  <strong>{r.material_code}</strong> ({r.material_name}): {r.errors.join(', ')}
                                </li>
                              ))}
                          </ul>
                        </div>
                      )}
                    </DetailDrawerSection>

                    <DetailDrawerSection title={t('app.uniDetail.sectionCollaboration')}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {(() => {
                          const lifecycle = getDemandComputationLifecycle(currentComputation)
                          const mainStages = lifecycle.mainStages ?? []
                          return mainStages.length > 0 ? (
                            <UniLifecycleStepper
                              steps={mainStages}
                              status={lifecycle.status}
                              showLabels
                              nextStepSuggestions={lifecycle.nextStepSuggestions}
                              hideNextStepSuggestions
                            />
                          ) : (
                            <Typography.Text type="secondary">{t('app.kuaizhizao.demandComputation.noStageData')}</Typography.Text>
                          )
                        })()}
                        {currentComputation.id != null ? (
                          <DetailDrawerInlineFullChain
                            documentType="demand_computation"
                            documentId={currentComputation.id}
                            active={drawerVisible && detailTabKey === 'detail'}
                            selfDocumentId={currentComputation.id}
                            renderBriefActions={(doc) => (
                              <WarehouseTraceBriefPrimaryActions
                                doc={doc}
                                t={t}
                                navigate={navigate}
                                closeDrawer={() => {
                                  setDrawerVisible(false)
                                }}
                              />
                            )}
                          />
                        ) : null}
                      </div>
                    </DetailDrawerSection>

                    <DetailDrawerSection title={t('app.uniDetail.sectionLines')}>
                      {/*
                        横滚仅在外层；内层表体覆盖 global.less 的 overflow，避免只读明细双滚动（与 quotation-detail-drawer-items 同思路）。
                      */}
                      <style>{`
                        .demand-computation-detail-items .ant-table-wrapper .ant-table-body,
                        .demand-computation-detail-items .ant-table-wrapper .ant-table-content {
                          overflow: visible !important;
                        }
                        .demand-computation-detail-items .ant-table-cell {
                          white-space: nowrap;
                        }
                      `}</style>
                      {currentComputation.items && currentComputation.items.length > 0 ? (
                        <div
                          className="demand-computation-detail-items"
                          style={{ width: '100%', maxWidth: '100%', overflowX: 'auto', overflowY: 'hidden' }}
                        >
                          <Table<DemandComputationItem>
                            size="small"
                            dataSource={currentComputation.items}
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
                            { title: t('app.kuaizhizao.demandComputation.colRequiredQty'), dataIndex: 'required_quantity', width: 96, align: 'right' },
                            {
                              title: t('app.kuaizhizao.demandComputation.colAvailableInventory'),
                              dataIndex: 'available_inventory',
                              width: 96,
                              align: 'right' as const,
                              render: (v: number, record: DemandComputationItem) =>
                                renderAvailableInventoryCell(v, record.detail_results as Record<string, unknown> | undefined),
                            },
                            { title: t('app.kuaizhizao.demandComputation.colNetRequirement'), dataIndex: 'net_requirement', width: 90, align: 'right', render: (v) => <span style={{ fontWeight: 'bold' }}>{v}</span> },
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
                                const info = map[status || 'Shortage'] || { label: t('app.kuaizhizao.demandComputation.statusUnknown'), color: 'default' }
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
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 6,
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    <Tag color={info.color} style={{ margin: 0, flexShrink: 0 }}>
                                      {info.label}
                                    </Tag>
                                    {pctLabel ? (
                                      <span style={{ fontSize: 12, color: 'var(--ant-color-text-secondary)' }}>
                                        {pctLabel}
                                      </span>
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
                                const typeMap: Record<string, { label: string; color: string }> = {
                                  Make: { label: t('app.kuaizhizao.demandComputation.materialSourceMake'), color: 'blue' },
                                  Buy: { label: t('app.kuaizhizao.demandComputation.materialSourceBuy'), color: 'green' },
                                  Phantom: { label: t('app.kuaizhizao.demandComputation.materialSourcePhantom'), color: 'orange' },
                                  Outsource: { label: t('app.kuaizhizao.demandComputation.materialSourceOutsource'), color: 'purple' },
                                  Configure: { label: t('app.kuaizhizao.demandComputation.materialSourceConfigure'), color: 'cyan' },
                                }
                                const info = typeMap[type] || { label: type || t('app.kuaizhizao.demandComputation.materialSourceUnset'), color: 'default' }
                                return <Tag color={info.color}>{info.label}</Tag>
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
                                    <span
                                      style={{
                                        color: isRisk ? '#ff4d4f' : 'inherit',
                                        fontWeight: isRisk ? 'bold' : 'normal',
                                      }}
                                    >
                                      {date || '—'}
                                    </span>
                                    {isRisk ? (
                                      <Tag color="error" style={{ marginLeft: 6, fontSize: 10 }}>
                                        {t('app.kuaizhizao.demandComputation.deliveryRisk')}
                                      </Tag>
                                    ) : null}
                                    {startDate ? (
                                      <span
                                        style={{
                                          marginLeft: 8,
                                          fontSize: 12,
                                          color: 'var(--ant-color-text-secondary)',
                                        }}
                                      >
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
                              title: t('app.kuaizhizao.demandComputation.colTraceability'),
                              dataIndex: 'id',
                              width: 72,
                              render: (_, record) => {
                                const ids = record.detail_results?.demand_item_ids || []
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
                        </div>
                      ) : (
                        <Empty description={t('app.kuaizhizao.demandComputation.noComputationItems')} />
                      )}
                    </DetailDrawerSection>

                    <DetailDrawerSection title={t('app.uniDetail.sectionTimeline')}>
                      {computationTracking.loading ? (
                        <Spin />
                      ) : computationTracking.error ? (
                        <Typography.Text type="danger">{computationTracking.error}</Typography.Text>
                      ) : computationTracking.data ? (
                        <DocumentTrackingTimelineBody data={computationTracking.data} />
                      ) : (
                        <Typography.Text type="secondary">{t('app.kuaizhizao.demandComputation.noTimeline')}</Typography.Text>
                      )}
                    </DetailDrawerSection>
                  </>
                ),
              },
              {
                key: 'records',
                label: t('app.kuaizhizao.demandComputation.drawerTabRecords'),
                children: (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div>
                      <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
                        {t('app.kuaizhizao.demandComputation.pushRecords')}
                      </Typography.Text>
                      <Table<PushRecordItem>
                        size="small"
                        loading={pushRecordsLoading}
                        dataSource={pushRecords}
                        rowKey={(r) => `${r.target_type}-${r.target_id}`}
                        scroll={{ x: 'max-content' }}
                        tableLayout="fixed"
                        style={{ minWidth: '100%' }}
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
                            ellipsis: true,
                            render: (createdAt: string) => (createdAt ? formatDateTime(createdAt, 'YYYY-MM-DD HH:mm:ss') : '—'),
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
                        pagination={false}
                      />
                    </div>
                    <Divider style={{ margin: 0 }} />
                    <div>
                      <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
                        {t('app.kuaizhizao.demandComputation.recalcHistory')}
                      </Typography.Text>
                      <Typography.Paragraph type="secondary" style={{ marginBottom: 8, fontSize: 12 }}>
                        {t('app.kuaizhizao.demandComputation.recalcHistoryHint')}
                      </Typography.Paragraph>
                      <Table<ComputationRecalcHistoryItem>
                        size="small"
                        loading={recalcHistoryLoading}
                        dataSource={computationRecalcHistory}
                        rowKey="id"
                        scroll={{ x: 'max-content' }}
                        columns={[
                          { title: t('app.kuaizhizao.demandComputation.colRecalcTime'), dataIndex: 'recalc_at', width: 180, render: (recalcAt) => recalcAt || '-' },
                          { title: t('app.kuaizhizao.demandComputation.colTrigger'), dataIndex: 'trigger', width: 120 },
                          { title: t('app.kuaizhizao.demandComputation.colResult'), dataIndex: 'result', width: 80 },
                          {
                            title: t('app.kuaizhizao.demandComputation.colSnapshot'),
                            key: 'snapshot',
                            width: 108,
                            render: (_: unknown, r: ComputationRecalcHistoryItem) =>
                              r.snapshot_id != null ? (
                                <Button
                                  type="link"
                                  size="small"
                                  style={{ padding: 0 }}
                                  onClick={() => void openRecalcSnapshotPreview(r.snapshot_id!)}
                                >
                                  {t('app.kuaizhizao.demandComputation.actionView')}
                                </Button>
                              ) : (
                                <span style={{ color: 'var(--ant-color-text-secondary)' }}>—</span>
                              ),
                          },
                          { title: t('app.kuaizhizao.demandComputation.colNotes'), dataIndex: 'message', ellipsis: true },
                        ]}
                        pagination={false}
                      />
                    </div>
                  </div>
                ),
              },
            ]}
          />
          ) : null
        }
      />

      </>
  )

  const tabs = [
    { key: 'list', label: t('app.kuaizhizao.demandComputation.tabList'), children: listTabContent },
    { key: 'history', label: t('app.kuaizhizao.demandComputation.tabHistory'), children: <ComputationHistoryTab /> },
  ]

  return (
    <MultiTabListPageTemplate
      statCards={statCards}
      activeTabKey={activeTabKey}
      onTabChange={setActiveTabKey}
      tabs={tabs}
    />
  )
}

export default DemandComputationPage
