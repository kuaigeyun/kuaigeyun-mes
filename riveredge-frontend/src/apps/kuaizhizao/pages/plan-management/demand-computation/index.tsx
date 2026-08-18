import { rowActionKind } from '../../../../../components/uni-action';
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
  type TableColumnsType,
  Switch,
  Input,
  Select,
  Tabs,
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
  Alert,
} from 'antd'
import {
  PlayCircleOutlined,
  ReloadOutlined,
  WarningOutlined,
  CopyOutlined,
  FundOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { UniTable } from '../../../../../components/uni-table'
import { MaterialStackedCell, UniTableStackedPrimaryCell, UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS } from '../../../../../components/uni-table/stackedPrimaryColumn'
import { UniLifecycle } from '../../../../../components/uni-lifecycle'
import {
  MultiTabListPageTemplate,
  MODAL_CONFIG,
  FormModalTemplate,
  type StatCard,
} from '../../../../../components/layout-templates'
import { UniPullCreateToolbar } from '../../../../../components/uni-pull'
import {
  UniPullQueryModal,
  UNI_PULL_QUERY_MAX_FETCH_LIMIT,
  isPullableScope,
  renderPullCapabilityTag,
  renderPullQueryDocStatus,
  renderPullQueryReviewStatus,
  useUniPullQuery,
} from '../../../../../components/uni-pull-query'
import { buildUniPushMenuItems, buildUniPushToolbarDisabledReason, UniPushToolbarButton } from '../../../../../components/uni-push'
import { WarehouseTraceBriefPrimaryActions } from '../../warehouse-management/WarehouseTraceBriefFooter'
import {
  listDemandComputations,
  getDemandComputation,
  createDemandComputation,
  previewExecuteDemandComputation,
  executeDemandComputation,
  recomputeDemandComputation,
  getDemandComputationReadiness,
  backfillDemandComputationMaterials,
  deleteDemandComputation,
  type DemandComputationReadinessGap,
  getPushOptions,
  getPushPreview,
  pushAll,
  getDemandComputationStatistics,
  getMonitorSummariesBatch,
  type PushOptions,
  type PushPreview,
  type ComputationPushPreviewItem,
  type ComputationMonitorSummary,
  DemandComputation,
  DemandComputationItem,
} from '../../../services/demand-computation'
import {
  getDemandComputationLifecycle,
  buildDemandComputationLifecycleValueEnum,
  resolveDemandComputationListLifecycleParams,
  LIST_LIFECYCLE_STAGE_FIELD,
} from '../../../utils/demandComputationLifecycle'
import { getDemandBusinessModeLabel, getDemandBusinessModeTagColor, buildDemandBusinessModeValueEnum, renderDemandBusinessModeMarkerTag } from '../../../utils/businessMode'
import { translateDemandType, renderDemandTypeMarkerTag } from '../../../utils/demandType'
import { DemandComputationSourceCode } from '../../../../../components/linked-document-code/DemandComputationSourceCode'
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
import { DemandComputationDetailDrawer } from './components/DemandComputationDetailDrawer'
import MrpExceptionInboxTab from './components/MrpExceptionInboxTab'
import { renderAvailableInventoryCell } from './components/availableInventoryCell'
import { MrpParametersCustomerGuideTrigger } from './MrpParametersCustomerGuide'
import { readinessFieldHelpI18nKey } from './readinessFieldHelp'
import { buildDemandPushPreviewSummary } from './pushPreviewSummary'
import { renderPushPreviewTargetBadge } from './pushPreviewTargetBadge'
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns'
import { DocumentPushProgressBar, DOCUMENT_PROGRESS_COLUMN_DEFAULTS } from '../../sales-management/shared/DocumentPushProgressBar'
import { resolveDownstreamPushPercent } from '../../sales-management/shared/pushProgress'
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment'
import {formatDateBySiteSetting, formatDateTime, formatDateTimeBySiteSetting, formatQuantity} from '../../../../../utils/format'
import { extractProTableSort } from '../../../../../utils/tableQueryKey'
import { formDateRangeFormItemProps } from '../../../../../utils/formDate'
import { MaterialUnitSelect, prefetchMaterialsForUnitSelect } from '../../../../../components/material-unit-select'
import {
  getMaterialSourceTypeLabel,
  getMaterialSourceTypeTagColor,
  buildMaterialSourceTypeOptions,
  MATERIAL_SOURCE_TYPE_VALUES,
  normalizeMaterialSourceType,
} from '../../../../master-data/utils/materialSourceType'
import { processRouteApi } from '../../../../master-data/services/process'
import type { ProcessRoute } from '../../../../master-data/types/process'
import { ThemedSegmented } from '../../../../../components/themed-segmented'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts'
import { buildKuaizhizaoPullCreateMenuItems, resolveKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry'
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions'
import { SupplierSelectDropdown } from '../../../../master-data/components/SupplierSelectDropdown'
import {
  demandComputationCapabilityReasonMessage,
  demandPushCapabilityReasonMessage,
  salesForecastCapabilityReasonMessage,
  salesOrderCapabilityReasonMessage,
} from '../../../../../hooks/useDocumentCapabilities'
import { useNewShortcut } from '../../../../../hooks/useNewShortcut'
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut'

const DEMAND_COMPUTATION_RESOURCE = 'plan-management-demand-computation'
const MATERIAL_RESOURCE = 'master-data:material'

function getMrpSuggestionSegmentedOptions(t: TFunction) {
  return [
    { label: t('app.kuaizhizao.demandComputation.suggestionNet'), value: 'net' as const },
    { label: t('app.kuaizhizao.demandComputation.suggestionGross'), value: 'gross' as const },
  ]
}

function getScheduleDirectionSegmentedOptions(t: TFunction) {
  return [
    {
      label: t('app.kuaizhizao.demandComputation.scheduleDirectionBackward'),
      value: 'backward' as const,
    },
    {
      label: t('app.kuaizhizao.demandComputation.scheduleDirectionForward'),
      value: 'forward' as const,
    },
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
  capabilities?: Demand['capabilities']
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

function normalizeComputationStatusValue(status?: string): string {
  return String(status ?? '').trim().toLowerCase()
}

const PREVIEW_SOURCE_TAB_ALL = 'all'

function buildPreviewSourceTabItems(
  items: Array<{ material_source_type?: string }>,
  t: TFunction,
): Array<{ key: string; label: string }> {
  const counts = new Map<string, number>()
  for (const item of items) {
    const type = normalizeMaterialSourceType(item.material_source_type) || 'Unknown'
    counts.set(type, (counts.get(type) || 0) + 1)
  }
  const tabs: Array<{ key: string; label: string }> = [
    {
      key: PREVIEW_SOURCE_TAB_ALL,
      label: t('app.kuaizhizao.demandComputation.previewTabAll', { count: items.length }),
    },
  ]
  for (const type of MATERIAL_SOURCE_TYPE_VALUES) {
    const count = counts.get(type)
    if (count) {
      tabs.push({
        key: type,
        label: t('app.kuaizhizao.demandComputation.previewTabSourceCount', {
          label: getMaterialSourceTypeLabel(type, t),
          count,
        }),
      })
    }
  }
  for (const [type, count] of counts) {
    if (type === 'Unknown' || (MATERIAL_SOURCE_TYPE_VALUES as readonly string[]).includes(type)) continue
    tabs.push({
      key: type,
      label: t('app.kuaizhizao.demandComputation.previewTabSourceCount', {
        label: getMaterialSourceTypeLabel(type, t),
        count,
      }),
    })
  }
  return tabs
}

const COMPUTATION_COMPLETED_STATUSES = new Set(['完成', '已完成', 'completed', 'success'])
const COMPUTATION_FAILED_STATUSES = new Set(['失败', 'failed', 'error'])
/** 行内「执行」仅对待执行开放；失败重试走「重新计算」，计算中正在运算不得重复触发 */
const COMPUTATION_EXECUTABLE_STATUSES = new Set(['待执行'])

function isComputationCompleted(status?: string): boolean {
  return COMPUTATION_COMPLETED_STATUSES.has(normalizeComputationStatusValue(status))
}

function isComputationFailed(status?: string): boolean {
  return COMPUTATION_FAILED_STATUSES.has(normalizeComputationStatusValue(status))
}

function canExecuteComputation(status?: string): boolean {
  return COMPUTATION_EXECUTABLE_STATUSES.has(normalizeComputationStatusValue(status))
}

const PARAM_DEFAULTS: Record<string, any> = {
  include_safety_stock: true,
  include_in_transit: true,
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
  /** 排程方向：backward=交期倒排 forward=尽早开工正排 */
  schedule_direction: 'backward' as 'backward' | 'forward',
  /** 计划时间栏（天）：栏内新计划自动确认；0=关闭 */
  planning_fence_days: 7,
}

/** 与后端 push_to_computation 默认参数一致，多需求合并创建时使用 */
const PUSH_DEMAND_COMPUTATION_PARAMS: Record<string, unknown> = {
  include_safety_stock: true,
  include_in_transit: true,
  include_reserved: true,
  include_reorder_point: false,
  mrp_suggestion_basis: 'net',
  bom_expand_level: 10,
  consider_capacity: true,
  consider_material_readiness: true,
  consider_equipment_availability: false,
  consider_mold_tool_availability: false,
}

/** 净需求模式下的供需净算默认（与 PARAM_DEFAULTS 一致） */
const NETTING_DEFAULTS_FOR_NET: Pick<
  Record<string, any>,
  'include_safety_stock' | 'include_in_transit' | 'include_reserved' | 'include_reorder_point'
> = {
  include_safety_stock: true,
  include_in_transit: true,
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
                <Col xs={24} sm={12}>
                  {fieldLabel(t('app.kuaizhizao.demandComputation.paramsPlanningFenceDays'))}
                  <InputNumber
                    min={0}
                    max={365}
                    style={{ width: '100%' }}
                    placeholder={t('app.kuaizhizao.demandComputation.placeholderPlanningFenceDays')}
                    value={params.planning_fence_days ?? 7}
                    onChange={v => handleChange('planning_fence_days', v === null ? 7 : v)}
                  />
                </Col>
                <Col xs={24}>
                  {fieldLabel(t('app.kuaizhizao.demandComputation.paramsScheduleDirection'))}
                  <ThemedSegmented
                    block
                    value={params.schedule_direction === 'forward' ? 'forward' : 'backward'}
                    options={getScheduleDirectionSegmentedOptions(t)}
                    onChange={v =>
                      handleChange('schedule_direction', v === 'forward' ? 'forward' : 'backward')
                    }
                  />
                  <Typography.Text
                    type="secondary"
                    style={{ display: 'block', marginTop: token.marginXXS, fontSize: token.fontSizeSM }}
                  >
                    {params.schedule_direction === 'forward'
                      ? t('app.kuaizhizao.demandComputation.scheduleDirectionForwardHint')
                      : t('app.kuaizhizao.demandComputation.scheduleDirectionBackwardHint')}
                  </Typography.Text>
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
  const pushToPurchaseRequisitionAction = resolveKuaizhizaoDocumentAction(t, 'purchase_requisition.pull_from_demand_computation')
  const pushToPurchaseOrderAction = resolveKuaizhizaoDocumentAction(t, 'purchase_order.pull_from_demand_computation')
  const queryClient = useQueryClient()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const actionRef = useRef<ActionType>(null)
  const formRef = useRef<any>(null)
  /** 列表当前页数据（唯一源：UniTable onTableDataChange，与表格展示一致） */
  const [tableComputations, setTableComputations] = useState<DemandComputation[]>([])
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [selectedComputationForToolbar, setSelectedComputationForToolbar] = useState<DemandComputation | null>(null)
  const computationPerms = useResourcePermissions(DEMAND_COMPUTATION_RESOURCE)
  const materialPerms = useResourcePermissions(MATERIAL_RESOURCE)

  const resolveSelectedComputation = useCallback(
    (keys: React.Key[], rows: DemandComputation[]) => {
      if (keys.length !== 1) return null
      return rows.find((row) => String(row.id) === String(keys[0])) ?? null
    },
    [],
  )

  const handleRowSelectionChange = useCallback(
    (keys: React.Key[]) => {
      setSelectedRowKeys(keys)
      setSelectedComputationForToolbar(resolveSelectedComputation(keys, tableComputations))
    },
    [resolveSelectedComputation, tableComputations],
  )

  useEffect(() => {
    if (selectedRowKeys.length !== 1) {
      setSelectedComputationForToolbar(null)
      return
    }
    const row = resolveSelectedComputation(selectedRowKeys, tableComputations)
    if (row) setSelectedComputationForToolbar(row)
  }, [resolveSelectedComputation, selectedRowKeys, tableComputations])

  const selectedComputationsForBatch = React.useMemo(
    () =>
      selectedRowKeys
        .map((key) => tableComputations.find((row) => String(row.id) === String(key)) ?? null)
        .filter((row): row is DemandComputation => row != null),
    [selectedRowKeys, tableComputations],
  )

  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts()

  const invalidateStatistics = () => {
    queryClient.invalidateQueries({ queryKey: ['demandComputationStatistics'] })
    invalidateMenuBadgeCounts()
  }

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
  const materialSourceTypeOptions = React.useMemo(() => buildMaterialSourceTypeOptions(t), [t])
  const manufacturingModeOptions = React.useMemo(
    () => [
      { value: 'assembly', label: t('app.kuaizhizao.workOrder.manufacturingModeAssembly') },
      { value: 'fabrication', label: t('app.kuaizhizao.workOrder.manufacturingModeFabrication') },
    ],
    [t],
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
  const [readinessModalVisible, setReadinessModalVisible] = useState(false)
  /** execute=执行前补齐；analysis=计算结果分析（结果+补齐+重算） */
  const [readinessContext, setReadinessContext] = useState<'execute' | 'analysis'>('execute')
  const [analysisRecord, setAnalysisRecord] = useState<DemandComputation | null>(null)
  const [analysisMainTab, setAnalysisMainTab] = useState<'results' | 'masterData'>('results')
  const [analysisSourceTab, setAnalysisSourceTab] = useState<string>(PREVIEW_SOURCE_TAB_ALL)
  const [analysisTablePage, setAnalysisTablePage] = useState(1)
  const [analysisTablePageSize, setAnalysisTablePageSize] = useState(10)
  const [readinessGaps, setReadinessGaps] = useState<DemandComputationReadinessGap[]>([])
  const [readinessValues, setReadinessValues] = useState<Record<string, unknown>>({})
  const [readinessActiveFieldTab, setReadinessActiveFieldTab] = useState('')
  const [readinessSubmitting, setReadinessSubmitting] = useState(false)
  const [readinessProcessRoutes, setReadinessProcessRoutes] = useState<ProcessRoute[]>([])
  const [readinessProcessRoutesLoading, setReadinessProcessRoutesLoading] = useState(false)

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
  const [previewSourceTab, setPreviewSourceTab] = useState<string>(PREVIEW_SOURCE_TAB_ALL)

  const previewSourceTabItems = useMemo(
    () => (previewData?.items?.length ? buildPreviewSourceTabItems(previewData.items, t) : []),
    [previewData, t],
  )

  const filteredPreviewItems = useMemo(() => {
    if (!previewData?.items?.length) return []
    if (previewSourceTab === PREVIEW_SOURCE_TAB_ALL) return previewData.items
    return previewData.items.filter(
      (item) => normalizeMaterialSourceType(item.material_source_type) === previewSourceTab,
    )
  }, [previewData, previewSourceTab])

  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [focusPlanItemId, setFocusPlanItemId] = useState<number | null>(null)
  const [monitorSummaries, setMonitorSummaries] = useState<Record<string, ComputationMonitorSummary>>({})
  const [monitorSummariesLoading, setMonitorSummariesLoading] = useState(false)
  const [currentComputation, setCurrentComputation] = useState<DemandComputation | null>(null)
  const [computationTrackingRefreshKey, setComputationTrackingRefreshKey] = useState(0)

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
  const [pushPreviewLoadError, setPushPreviewLoadError] = useState<string | null>(null)
  const [pushMode, setPushMode] = useState<'draft' | 'confirm'>('draft')
  const [pushSelectedItemIds, setPushSelectedItemIds] = useState<number[]>([])
  const pushPreviewMergedSummary = useMemo(
    () => (pushPreviewData ? buildDemandPushPreviewSummary(pushPreviewData, t) : null),
    [pushPreviewData, t],
  )

  type SourcePullPreviewKind = 'demand' | 'sales_order' | 'sales_forecast'
  /** 协调看板深链 / 工具栏：打开下推面板时的路径预设 */
  type PushPanelPreset = {
    production?: 'work_order'
    purchase?: 'requisition' | 'purchase_order'
  }
  const pushPanelPresetRef = useRef<PushPanelPreset | null>(null)
  const deepLinkHandledRef = useRef<string | null>(null)

  /** 下推面板：打开时加载 options，初始化 config */
  React.useEffect(() => {
    if (!pushPanelRecord) return
    const load = async () => {
      setPushPanelLoading(true)
      try {
        const opts = await getPushOptions(pushPanelRecord.id!)
        setPushOptions(opts)
        setPushMode(opts.push_mode_default === 'confirm' ? 'confirm' : 'draft')
        const preset = pushPanelPresetRef.current
        pushPanelPresetRef.current = null
        setPushConfig({
          production: preset?.production
            ?? (preset?.purchase ? undefined : opts.production_choices.length > 0 ? 'work_order' : undefined),
          purchase: preset?.purchase
            ?? (preset?.production ? undefined : opts.purchase_choices.length > 0 ? opts.default_purchase : undefined),
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
    const params: {
      production?: 'work_order'
      purchase?: 'requisition' | 'purchase_order'
      generate_mode?: 'work_order_only'
      push_mode?: 'draft' | 'confirm'
    } = {}
    if (pushConfig.production) {
      params.production = pushConfig.production
      params.generate_mode = 'work_order_only'
    }
    if (pushConfig.purchase) params.purchase = pushConfig.purchase
    if (pushConfig.purchase === 'purchase_order') params.push_mode = pushMode
    setPushPreviewLoadError(null)
    getPushPreview(pushPanelRecord.id!, Object.keys(params).length ? params : undefined)
      .then((data) => {
        setPushPreviewData(data)
        setPushPreviewLoadError(null)
        if (pushConfig.purchase === 'requisition' || pushConfig.production === 'work_order') {
          setPushSelectedItemIds(
            (data.items || [])
              .filter((row) => {
                if (Number(row.max_push_quantity ?? 0) <= 0) return false
                if (
                  pushConfig.purchase === 'requisition' &&
                  row.target_document === 'purchase_requisition'
                ) {
                  return true
                }
                if (
                  pushConfig.production === 'work_order' &&
                  (row.target_document === 'work_order' ||
                    row.target_document === 'outsource_work_order')
                ) {
                  return true
                }
                return false
              })
              .map((row) => Number(row.item_id)),
          )
        } else {
          setPushSelectedItemIds([])
        }
      })
      .catch((e: any) => {
        setPushPreviewData(null)
        setPushPreviewLoadError(e?.response?.data?.detail || e?.message || t('app.kuaizhizao.demandComputation.pushPreviewFailed'))
      })
  }, [pushPanelRecord?.id, pushPanelLoading, pushConfig.production, pushConfig.purchase, pushMode, t])

  const handleSourcePullPreviewSuccess = useCallback(
    (res: { computation_code?: string } | null | undefined, kind: SourcePullPreviewKind) => {
      const action =
        kind === 'demand'
          ? pullFromDemandAction
          : kind === 'sales_order'
            ? pullFromSalesOrderAction
            : pullFromSalesForecastAction
      messageApi.success(
        res?.computation_code
          ? t('app.kuaizhizao.demandComputation.createdTarget', { target: action.targetLabel, code: res.computation_code })
          : t('app.kuaizhizao.demandComputation.createdFromSource', { source: action.sourceLabel, target: action.targetLabel }),
      )
      invalidateStatistics()
      actionRef.current?.reload()
    },
    [
      invalidateStatistics,
      messageApi,
      pullFromDemandAction,
      pullFromSalesForecastAction,
      pullFromSalesOrderAction,
      t,
    ],
  )

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

  const pullDocumentScopeOptions = useMemo(
    () => [
      { label: t('components.uniPullQuery.scopePullable'), value: 'pullable' },
      { label: t('components.uniPullQuery.scopeAll'), value: 'all' },
    ],
    [t],
  )

  const isPullDemandSelectable = useCallback(
    (record: PullDemandCandidate) => record.capabilities?.merge_computation?.allowed === true,
    [],
  )

  const isPullDemandComputationSalesOrderSelectable = useCallback(
    (record: PullSalesOrderCandidate) => record.capabilities?.push_computation?.allowed === true,
    [],
  )

  const isPullDemandComputationSalesForecastSelectable = useCallback(
    (record: PullSalesForecastCandidate) => record.capabilities?.push_computation?.allowed === true,
    [],
  )

  const pullFromDemandQuery = useUniPullQuery<PullDemandCandidate>({
    rowKey: 'id',
    selectionType: 'checkbox',
    scopeOptions: pullDocumentScopeOptions,
    defaultScope: 'pullable',
    loadData: async ({ keyword, page, pageSize, scope }) => {
      try {
        const kw = keyword.trim()
        const demandsRes = await listDemands({
          skip: (page - 1) * pageSize,
          limit: pageSize,
          keyword: kw || undefined,
          include_items: false,
          ...(isPullableScope(scope)
            ? { review_status: ReviewStatus.APPROVED, pushed_to_computation: false }
            : {}),
        })
        const rows = (demandsRes.data || [])
          .filter((d) => d.id != null)
          .map((d) => ({
            id: d.id!,
            demand_code: d.demand_code,
            demand_name: d.demand_name,
            demand_type: d.demand_type,
            business_mode: d.business_mode,
            status: d.status,
            updated_at: d.updated_at,
            pushed_to_computation: d.pushed_to_computation,
            capabilities: d.capabilities,
          }))
        return { data: rows, total: demandsRes.total ?? 0 }
      } catch {
        messageApi.error(t('app.kuaizhizao.demandComputation.loadDemandListFailed'))
        return { data: [], total: 0 }
      }
    },
    isRowDisabled: (record) => !isPullDemandSelectable(record),
    onConfirm: async (keys, rows) => {
      const selectedIds = keys.map((key) => Number(key)).filter((id) => id > 0)
      if (!selectedIds.length) {
        messageApi.warning(t('app.kuaizhizao.demandComputation.selectSource', { source: pullFromDemandAction.sourceLabel }))
        return
      }
      const blocked = rows.find((row) => row.capabilities?.merge_computation?.allowed !== true)
      if (blocked) {
        messageApi.warning(
          demandPushCapabilityReasonMessage(blocked.capabilities?.merge_computation?.reason, t)
            || t('app.kuaizhizao.demandComputation.alreadyPushed', { source: pullFromDemandAction.sourceLabel, target: pullFromDemandAction.targetLabel }),
        )
        return
      }
      try {
        if (selectedIds.length > 1) {
          const created = await createDemandComputation({
            demand_ids: selectedIds,
            computation_type: 'MRP',
            computation_params: PUSH_DEMAND_COMPUTATION_PARAMS,
            notes: t('app.kuaizhizao.demandComputation.sourcePullMergeNote', { count: selectedIds.length }),
          })
          handleSourcePullPreviewSuccess(
            created.computation_code ? { computation_code: created.computation_code } : created,
            'demand',
          )
        } else {
          const res = await pushDemandToComputation(selectedIds[0])
          handleSourcePullPreviewSuccess(res, 'demand')
        }
        pullFromDemandQuery.closeModal()
      } catch (error: any) {
        messageApi.error(
          error?.response?.data?.detail
            || error?.message
            || t('app.kuaizhizao.demandComputation.createFromSourceFailed', {
              source: pullFromDemandAction.sourceLabel,
              target: pullFromDemandAction.targetLabel,
            }),
        )
      }
    },
  })

  const pullFromSalesOrderQuery = useUniPullQuery<PullSalesOrderCandidate>({
    rowKey: 'id',
    selectionType: 'checkbox',
    scopeOptions: pullDocumentScopeOptions,
    defaultScope: 'pullable',
    loadData: async ({ keyword, page, pageSize, scope }) => {
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
        const filtered = isPullableScope(scope)
          ? candidates.filter((row) => isPullDemandComputationSalesOrderSelectable(row))
          : candidates
        return { data: filtered, total: Number((result as { total?: number })?.total ?? filtered.length) }
      } catch {
        messageApi.error(t('app.kuaizhizao.salesOrder.listFailed'))
        return { data: [], total: 0 }
      }
    },
    isRowDisabled: (record) => !isPullDemandComputationSalesOrderSelectable(record),
    onConfirm: async (_keys, rows) => {
      const selectedIds = rows
        .filter((row) => isPullDemandComputationSalesOrderSelectable(row))
        .map((row) => Number(row.id))
        .filter((id) => id > 0)
      if (!selectedIds.length) {
        messageApi.warning(t('app.kuaizhizao.demandComputation.selectSource', { source: pullFromSalesOrderAction.sourceLabel }))
        return
      }
      try {
        let lastRes: { computation_code?: string } | null = null
        for (const salesOrderId of selectedIds) {
          lastRes = await pushSalesOrderToComputation(salesOrderId)
        }
        handleSourcePullPreviewSuccess(lastRes, 'sales_order')
        pullFromSalesOrderQuery.closeModal()
      } catch (error: any) {
        messageApi.error(
          error?.response?.data?.detail
            || error?.message
            || t('app.kuaizhizao.demandComputation.createFromSourceFailed', {
              source: pullFromSalesOrderAction.sourceLabel,
              target: pullFromSalesOrderAction.targetLabel,
            }),
        )
      }
    },
  })

  const pullFromSalesForecastQuery = useUniPullQuery<PullSalesForecastCandidate>({
    rowKey: 'id',
    selectionType: 'checkbox',
    scopeOptions: pullDocumentScopeOptions,
    defaultScope: 'pullable',
    loadData: async ({ keyword, page, pageSize, scope }) => {
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
        const filtered = isPullableScope(scope)
          ? candidates.filter((row) => isPullDemandComputationSalesForecastSelectable(row))
          : candidates
        return { data: filtered, total: Number(result?.total ?? filtered.length) }
      } catch {
        messageApi.error(t('app.kuaizhizao.salesForecast.listLoadFailed'))
        return { data: [], total: 0 }
      }
    },
    isRowDisabled: (record) => !isPullDemandComputationSalesForecastSelectable(record),
    onConfirm: async (_keys, rows) => {
      const selectedIds = rows
        .filter((row) => isPullDemandComputationSalesForecastSelectable(row))
        .map((row) => Number(row.id))
        .filter((id) => id > 0)
      if (!selectedIds.length) {
        messageApi.warning(
          t('app.kuaizhizao.demandComputation.selectSource', { source: pullFromSalesForecastAction.sourceLabel }),
        )
        return
      }
      try {
        let lastRes: { computation_code?: string } | null = null
        for (const forecastId of selectedIds) {
          const res = await pushSalesForecastToComputation(forecastId)
          const code = res?.computation_code || res?.demand_computation?.computation_code
          lastRes = code ? { computation_code: code } : res
        }
        handleSourcePullPreviewSuccess(lastRes, 'sales_forecast')
        pullFromSalesForecastQuery.closeModal()
      } catch (error: any) {
        messageApi.error(
          error?.response?.data?.detail
            || error?.message
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
        setFocusPlanItemId(null)
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

  const readinessRowKey = (gap: DemandComputationReadinessGap) =>
    `${gap.material_id}::${gap.field}`

  /** 安全库存 / 再订货点无建议值时默认 0，便于直接回写 */
  const readinessSuggestedValue = (gap: DemandComputationReadinessGap): unknown => {
    if (gap.suggested !== null && gap.suggested !== undefined) return gap.suggested
    if (gap.field === 'defaults.safetyStock' || gap.field === 'defaults.reorder_point') return 0
    return null
  }

  const readinessBackfillableGaps = useMemo(
    () => readinessGaps.filter((g) => g.value_type !== 'info'),
    [readinessGaps],
  )

  const readinessGapsByField = useMemo(() => {
    const groups: Array<{ field: string; label: string; gaps: DemandComputationReadinessGap[] }> = []
    const indexByField = new Map<string, number>()
    for (const gap of readinessGaps) {
      const idx = indexByField.get(gap.field)
      if (idx === undefined) {
        indexByField.set(gap.field, groups.length)
        groups.push({ field: gap.field, label: gap.label, gaps: [gap] })
      } else {
        groups[idx].gaps.push(gap)
      }
    }
    return groups
  }, [readinessGaps])

  const getReadinessFieldHelp = useCallback(
    (field: string) => {
      const key = readinessFieldHelpI18nKey(field)
      const text = t(key)
      return text === key
        ? t('app.kuaizhizao.demandComputation.readinessFieldHelpDefault')
        : text
    },
    [t],
  )

  const renderReadinessGapValue = useCallback(
    (gap: DemandComputationReadinessGap) => {
      const key = readinessRowKey(gap)
      const value = readinessValues[key]
      if (gap.value_type === 'info') {
        return (
          <Typography.Text type="secondary">
            {t('app.kuaizhizao.demandComputation.readinessInfoBom')}
          </Typography.Text>
        )
      }
      if (gap.value_type === 'supplier_id') {
        return (
          <SupplierSelectDropdown
            style={{ width: '100%' }}
            value={value != null && value !== '' ? Number(value) : undefined}
            disabled={!materialPerms.canUpdate}
            hostResource={DEMAND_COMPUTATION_RESOURCE}
            onChange={(v) => setReadinessValues((prev) => ({ ...prev, [key]: v ?? null }))}
          />
        )
      }
      if (gap.value_type === 'source_type') {
        return (
          <Select
            style={{ width: '100%' }}
            options={materialSourceTypeOptions}
            value={value != null && value !== '' ? String(value) : undefined}
            disabled={!materialPerms.canUpdate}
            placeholder={t('app.master-data.materials.batchSourceTypeSelect')}
            onChange={(v) => setReadinessValues((prev) => ({ ...prev, [key]: v ?? null }))}
          />
        )
      }
      if (gap.value_type === 'manufacturing_mode') {
        return (
          <Select
            style={{ width: '100%' }}
            options={manufacturingModeOptions}
            value={value != null && value !== '' ? String(value) : undefined}
            disabled={!materialPerms.canUpdate}
            onChange={(v) => setReadinessValues((prev) => ({ ...prev, [key]: v ?? null }))}
          />
        )
      }
      if (gap.value_type === 'process_route_id') {
        return (
          <Select
            style={{ width: '100%' }}
            showSearch
            optionFilterProp="label"
            loading={readinessProcessRoutesLoading}
            options={readinessProcessRoutes.map((r) => ({
              value: r.id,
              label: `${r.code || ''} ${r.name || ''}`.trim() || String(r.id),
            }))}
            value={value != null && value !== '' ? Number(value) : undefined}
            disabled={!materialPerms.canUpdate}
            placeholder={t('app.master-data.materials.batchProcessRouteSelect')}
            onChange={(v) => setReadinessValues((prev) => ({ ...prev, [key]: v ?? null }))}
          />
        )
      }
      if (gap.value_type === 'text') {
        return (
          <Input
            style={{ width: '100%' }}
            disabled={!materialPerms.canUpdate}
            value={value == null || value === '' ? '' : String(value)}
            onChange={(e) => setReadinessValues((prev) => ({ ...prev, [key]: e.target.value }))}
          />
        )
      }
      return (
        <InputNumber
          style={{ width: '100%' }}
          min={0}
          disabled={!materialPerms.canUpdate}
          value={value == null || value === '' ? null : Number(value)}
          onChange={(v) => setReadinessValues((prev) => ({ ...prev, [key]: v }))}
        />
      )
    },
    [
      readinessValues,
      materialPerms.canUpdate,
      materialSourceTypeOptions,
      manufacturingModeOptions,
      readinessProcessRoutes,
      readinessProcessRoutesLoading,
      t,
    ],
  )

  const readinessTableColumns = useMemo((): TableColumnsType<DemandComputationReadinessGap> => {
    const dash = '-'
    return [
      {
        title: t('app.kuaizhizao.demandComputation.colMaterialCode'),
        dataIndex: 'material_code',
        width: 108,
        fixed: 'left',
      },
      {
        title: t('app.kuaizhizao.demandComputation.colMaterialName'),
        dataIndex: 'material_name',
        width: 168,
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.demandComputation.colMaterialSpec'),
        dataIndex: 'material_spec',
        width: 128,
        ellipsis: true,
        render: (val: string | null | undefined) => (val?.trim() ? val : dash),
      },
      {
        title: t('app.kuaizhizao.demandComputation.colMaterialUnit'),
        dataIndex: 'material_unit',
        width: 64,
        render: (val: string | null | undefined) => (val?.trim() ? val : dash),
      },
      {
        title: t('app.kuaizhizao.demandComputation.colSourceType'),
        dataIndex: 'source_type',
        width: 92,
        render: (_: unknown, row) => {
          const label = getMaterialSourceTypeLabel(row.source_type, t)
          return label && label !== dash ? (
            <Tag color={getMaterialSourceTypeTagColor(row.source_type)}>{label}</Tag>
          ) : (
            dash
          )
        },
      },
      {
        title: t('app.kuaizhizao.workOrder.colManufacturingMode'),
        dataIndex: 'manufacturing_mode',
        width: 92,
        render: (_: unknown, row) => {
          if (!row.manufacturing_mode) return dash
          if (row.manufacturing_mode === 'assembly') {
            return t('app.kuaizhizao.workOrder.manufacturingModeAssembly')
          }
          if (row.manufacturing_mode === 'fabrication') {
            return t('app.kuaizhizao.workOrder.manufacturingModeFabrication')
          }
          return row.manufacturing_mode
        },
      },
      {
        title: t('app.kuaizhizao.demandComputation.readinessValue'),
        width: 200,
        fixed: 'right',
        render: (_: unknown, gap) => renderReadinessGapValue(gap),
      },
    ]
  }, [renderReadinessGapValue, t])

  useEffect(() => {
    if (!readinessModalVisible || readinessGapsByField.length === 0) return
    setReadinessActiveFieldTab((prev) =>
      readinessGapsByField.some((g) => g.field === prev) ? prev : readinessGapsByField[0].field,
    )
  }, [readinessModalVisible, readinessGapsByField])

  useEffect(() => {
    if (!readinessModalVisible) return
    const needsRoutes = readinessGaps.some((g) => g.value_type === 'process_route_id')
    if (!needsRoutes) return
    setReadinessProcessRoutesLoading(true)
    processRouteApi
      .list({ limit: 1000, isActive: true })
      .then((result) => {
        const list = Array.isArray(result) ? result : result?.data ?? []
        setReadinessProcessRoutes(list)
      })
      .catch(() => setReadinessProcessRoutes([]))
      .finally(() => setReadinessProcessRoutesLoading(false))
  }, [readinessModalVisible, readinessGaps])

  const openPreviewFromExecute = async () => {
    if (!executeRecord?.id) return
    const params = getFilteredExecuteParams()
    const preview = await previewExecuteDemandComputation(executeRecord.id, params)
    await prefetchMaterialsForUnitSelect(preview.items.map((i) => i.material_id))
    setPreviewTablePage(1)
    setPreviewTablePageSize(10)
    setPreviewSourceTab(PREVIEW_SOURCE_TAB_ALL)
    setPreviewData(preview)
    setExecuteModalVisible(false)
    setReadinessModalVisible(false)
    setPreviewModalVisible(true)
  }

  /**
   * 第一步：从参数 Modal 点击执行计算 -> 就绪检查 -> 预览
   */
  const handleExecuteSubmit = async () => {
    if (!executeRecord?.id) return
    setExecuteLoading(true)
    try {
      const params = getFilteredExecuteParams()
      const readiness = await getDemandComputationReadiness(executeRecord.id, params)
      if (readiness.gaps?.length) {
        const values: Record<string, unknown> = {}
        for (const gap of readiness.gaps) {
          values[readinessRowKey(gap)] = readinessSuggestedValue(gap)
        }
        setReadinessContext('execute')
        setReadinessGaps(readiness.gaps)
        setReadinessValues(values)
        setReadinessActiveFieldTab(readiness.gaps[0]?.field ?? '')
        setReadinessModalVisible(true)
        return
      }
      await openPreviewFromExecute()
    } catch (error: any) {
      messageApi.error(error?.response?.data?.detail || t('app.kuaizhizao.demandComputation.previewFailed'))
    } finally {
      setExecuteLoading(false)
    }
  }

  const handleReadinessSkip = async () => {
    setReadinessSubmitting(true)
    try {
      await openPreviewFromExecute()
    } catch (error: any) {
      messageApi.error(error?.response?.data?.detail || t('app.kuaizhizao.demandComputation.previewFailed'))
    } finally {
      setReadinessSubmitting(false)
    }
  }

  const applyReadinessGapsToState = useCallback(
    (gaps: DemandComputationReadinessGap[], keepExistingValues = false) => {
      const values: Record<string, unknown> = {}
      for (const gap of gaps) {
        const rk = readinessRowKey(gap)
        values[rk] = keepExistingValues
          ? (readinessValues[rk] ?? readinessSuggestedValue(gap))
          : readinessSuggestedValue(gap)
      }
      setReadinessGaps(gaps)
      setReadinessValues(values)
      setReadinessActiveFieldTab(gaps[0]?.field ?? '')
    },
    [readinessValues],
  )

  const collectReadinessBackfillItems = (): Array<{
    material_id: number
    field: string
    value: unknown
  }> | null => {
    const items: Array<{ material_id: number; field: string; value: unknown }> = []
    for (const gap of readinessBackfillableGaps) {
      const key = readinessRowKey(gap)
      const value = readinessValues[key]
      if (value === null || value === undefined || value === '') {
        messageApi.warning(
          t('app.kuaizhizao.demandComputation.readinessValueRequired', {
            code: gap.material_code,
            label: gap.label,
          }),
        )
        return null
      }
      items.push({ material_id: gap.material_id, field: gap.field, value })
    }
    return items
  }

  const handleReadinessBackfillAndContinue = async () => {
    if (!materialPerms.canUpdate) {
      messageApi.warning(t('app.kuaizhizao.demandComputation.readinessNoMaterialUpdatePerm'))
      return
    }
    const items = collectReadinessBackfillItems()
    if (!items) return
    setReadinessSubmitting(true)
    try {
      await backfillDemandComputationMaterials(items)
      messageApi.success(t('app.kuaizhizao.demandComputation.readinessBackfillSuccess'))
      if (!executeRecord?.id) return
      const params = getFilteredExecuteParams()
      const readiness = await getDemandComputationReadiness(executeRecord.id, params)
      if (readiness.gaps?.length) {
        applyReadinessGapsToState(readiness.gaps, true)
        messageApi.info(t('app.kuaizhizao.demandComputation.readinessStillGaps'))
        return
      }
      setReadinessModalVisible(false)
      await openPreviewFromExecute()
    } catch (error: any) {
      messageApi.error(
        error?.response?.data?.detail || t('app.kuaizhizao.demandComputation.readinessBackfillFailed'),
      )
    } finally {
      setReadinessSubmitting(false)
    }
  }

  /** 计算结果分析：仅回写基础资料，不进入执行预览 */
  const handleAnalysisBackfill = async () => {
    if (!materialPerms.canUpdate) {
      messageApi.warning(t('app.kuaizhizao.demandComputation.readinessNoMaterialUpdatePerm'))
      return
    }
    if (readinessBackfillableGaps.length === 0) {
      messageApi.info(t('app.kuaizhizao.demandComputation.analysisNoGaps'))
      return
    }
    const items = collectReadinessBackfillItems()
    if (!items) return
    if (!analysisRecord?.id) return
    setReadinessSubmitting(true)
    try {
      await backfillDemandComputationMaterials(items)
      messageApi.success(t('app.kuaizhizao.demandComputation.readinessBackfillSuccess'))
      const readiness = await getDemandComputationReadiness(
        analysisRecord.id,
        analysisRecord.computation_params || undefined,
      )
      if (readiness.gaps?.length) {
        applyReadinessGapsToState(readiness.gaps, true)
        setAnalysisMainTab('masterData')
        messageApi.info(t('app.kuaizhizao.demandComputation.analysisStillGaps'))
      } else {
        setReadinessGaps([])
        setReadinessValues({})
        messageApi.success(t('app.kuaizhizao.demandComputation.analysisReady'))
      }
    } catch (error: any) {
      messageApi.error(
        error?.response?.data?.detail || t('app.kuaizhizao.demandComputation.readinessBackfillFailed'),
      )
    } finally {
      setReadinessSubmitting(false)
    }
  }

  const handleAnalysisRecompute = async () => {
    if (!analysisRecord?.id) return
    const canRecomputeByCapability = analysisRecord.capabilities?.recompute?.allowed !== false
    if (!canRecomputeByCapability || !computationPerms.canUpdate) {
      messageApi.warning(
        demandComputationCapabilityReasonMessage(
          analysisRecord.capabilities?.recompute?.reason,
          t,
        ) || t('app.kuaizhizao.demandComputation.recomputeFailed'),
      )
      return
    }
    modalApi.confirm({
      title: t('app.kuaizhizao.demandComputation.recomputeTitle'),
      content: t('app.kuaizhizao.demandComputation.recomputeConfirm', {
        code: analysisRecord.computation_code,
      }),
      onOk: async () => {
        setReadinessSubmitting(true)
        try {
          await recomputeDemandComputation(analysisRecord.id!)
          messageApi.success(t('app.kuaizhizao.demandComputation.recomputeSubmitted'))
          setReadinessModalVisible(false)
          setAnalysisRecord(null)
          invalidateStatistics()
          actionRef.current?.reload()
          if (drawerVisible && currentComputation?.id === analysisRecord.id) {
            void getDemandComputation(analysisRecord.id!, true)
              .then(setCurrentComputation)
              .catch(() => {})
          }
        } catch (error: any) {
          messageApi.error(
            error?.response?.data?.detail || t('app.kuaizhizao.demandComputation.recomputeFailed'),
          )
        } finally {
          setReadinessSubmitting(false)
        }
      },
    })
  }

  const analysisItems = analysisRecord?.items || []
  const analysisSourceTabItems = useMemo(
    () => (analysisItems.length ? buildPreviewSourceTabItems(analysisItems, t) : []),
    [analysisItems, t],
  )
  const filteredAnalysisItems = useMemo(() => {
    if (!analysisItems.length) return []
    if (analysisSourceTab === PREVIEW_SOURCE_TAB_ALL) return analysisItems
    return analysisItems.filter(
      (item) => (normalizeMaterialSourceType(item.material_source_type) || 'Unknown') === analysisSourceTab,
    )
  }, [analysisItems, analysisSourceTab])

  const openResultAnalysis = async (record?: DemandComputation) => {
    const target =
      record ||
      (selectedRowKeys.length === 1
        ? selectedComputationsForBatch[0] || selectedComputationForToolbar
        : null)
    if (!target?.id) {
      messageApi.warning(t('app.kuaizhizao.demandComputation.analysisSelectOne'))
      return
    }
    const canAnalyze =
      isComputationCompleted(target.computation_status) ||
      isComputationFailed(target.computation_status)
    if (!canAnalyze) {
      messageApi.warning(t('app.kuaizhizao.demandComputation.analysisStatusRequired'))
      return
    }
    setReadinessSubmitting(true)
    try {
      const [detail, readiness] = await Promise.all([
        getDemandComputation(target.id, true),
        getDemandComputationReadiness(target.id, target.computation_params || undefined),
      ])
      await prefetchMaterialsForUnitSelect((detail.items || []).map((i) => i.material_id))
      setAnalysisRecord(detail)
      setAnalysisMainTab('results')
      setAnalysisSourceTab(PREVIEW_SOURCE_TAB_ALL)
      setAnalysisTablePage(1)
      setReadinessContext('analysis')
      applyReadinessGapsToState(readiness.gaps || [], false)
      setReadinessModalVisible(true)
    } catch (error: any) {
      messageApi.error(
        error?.response?.data?.detail || t('app.kuaizhizao.demandComputation.analysisLoadFailed'),
      )
    } finally {
      setReadinessSubmitting(false)
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
      setPreviewSourceTab(PREVIEW_SOURCE_TAB_ALL)
      setExecuteModalVisible(false)
      const executedId = executeRecord.id
      setExecuteRecord(null)
      invalidateStatistics(); actionRef.current?.reload()
      if (drawerVisible && currentComputation?.id === executedId) {
        void getDemandComputation(executedId, true)
          .then(setCurrentComputation)
          .catch(() => {})
        setComputationTrackingRefreshKey((k) => k + 1)
      }
    } catch (error: any) {
      messageApi.error(error?.response?.data?.detail || t('app.kuaizhizao.demandComputation.executeFailed'))
    } finally {
      setExecuteLoading(false)
    }
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

  /** 打开下推面板（可选预设生产/采购路径） */
  const handleOpenPushPanel = useCallback((record: DemandComputation, preset?: PushPanelPreset) => {
    pushPanelPresetRef.current = preset ?? null
    setPushPanelRecord(record)
    setPushPreviewData(null)
    setPushPreviewLoadError(null)
    setPushMode('draft')
  }, [])

  const handleOpenComputationFromInbox = useCallback(
    async (computationId: number, itemId: number) => {
      try {
        const data = await getDemandComputation(computationId, true)
        setCurrentComputation(data)
        setFocusPlanItemId(itemId)
        setDrawerVisible(true)
        setComputationTrackingRefreshKey((k) => k + 1)
      } catch {
        messageApi.error(t('app.kuaizhizao.demandComputation.fetchDetailFailed'))
      }
    },
    [messageApi, t],
  )

  const handleOpenPushFromInbox = useCallback(
    async (computationId: number) => {
      try {
        const data = await getDemandComputation(computationId, false)
        handleOpenPushPanel(data)
      } catch {
        messageApi.error(t('app.kuaizhizao.demandComputation.openFailed'))
      }
    },
    [handleOpenPushPanel, messageApi, t],
  )

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
          pushPanelPresetRef.current = { purchase: 'purchase_order' }
          setPushPanelRecord(data)
          setPushPreviewData(null)
          setPushPreviewLoadError(null)
          setPushMode('draft')
          return
        }

        setCurrentComputation(data)
        setDrawerVisible(true)
        setComputationTrackingRefreshKey((k) => k + 1)
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
        let purchaseRequisitionItemIds: number[] | undefined
        let productionItemIds: number[] | undefined
        if (pushConfig.purchase === 'requisition') {
          const prRows = (pushPreviewData?.items || []).filter(
            (row) =>
              row.target_document === 'purchase_requisition' &&
              Number(row.max_push_quantity ?? 0) > 0,
          )
          if (prRows.length > 0) {
            const selected = pushSelectedItemIds.filter((id) =>
              prRows.some((row) => Number(row.item_id) === id),
            )
            if (!selected.length) {
              messageApi.warning(t('app.kuaizhizao.purchaseRequisition.pull.selectLinesFirst'))
              return
            }
            purchaseRequisitionItemIds = selected
          }
        }
        if (pushConfig.production === 'work_order') {
          const prodRows = (pushPreviewData?.items || []).filter(
            (row) =>
              (row.target_document === 'work_order' ||
                row.target_document === 'outsource_work_order') &&
              Number(row.max_push_quantity ?? 0) > 0,
          )
          if (prodRows.length > 0) {
            const selected = pushSelectedItemIds.filter((id) =>
              prodRows.some((row) => Number(row.item_id) === id),
            )
            if (!selected.length) {
              messageApi.warning(t('app.kuaizhizao.workOrder.computationPull.selectLinesFirst'))
              return
            }
            productionItemIds = selected
          }
        }
        await pushAll(record.id!, {
          production: pushConfig.production,
          purchase: pushConfig.purchase,
          include_outsource: true,
          push_mode: pushMode,
          purchase_requisition_item_ids: purchaseRequisitionItemIds,
          production_item_ids: productionItemIds,
        })
        if (hasProduction && hasPurchase) {
          messageApi.success(t('app.kuaizhizao.demandComputation.pushSuccess'))
        } else if (hasProduction) {
          messageApi.success(t('app.kuaizhizao.demandComputation.workOrderPushSuccess'))
        } else if (pushConfig.purchase === 'purchase_order') {
          messageApi.success(t('app.kuaizhizao.demandComputation.purchaseOrderPushSuccess'))
        } else {
          messageApi.success(t('app.kuaizhizao.demandComputation.requisitionPushSuccess'))
        }
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
        setComputationTrackingRefreshKey((k) => k + 1)
      }
    } catch (e: any) {
      messageApi.error(e?.response?.data?.detail || t('app.kuaizhizao.demandComputation.pushFailed'))
    } finally {
      setPushPanelSubmitting(false)
    }
  }


  const demandComputationLifecycleValueEnum = useMemo(
    () => buildDemandComputationLifecycleValueEnum(t),
    [t],
  )

  /**
   * 表格列定义
   */
  const columns: ProColumns<DemandComputation>[] = useMemo(
    () => alignProColumns<DemandComputation>([
    {
      title: t('app.kuaizhizao.demandComputation.colStartTime'),
      dataIndex: 'computation_start_time_range',
      valueType: 'dateRange',
      hideInTable: true,
      hideInSearch: false,
      fieldProps: {
        placeholder: [t('app.kuaizhizao.quotation.dateRangeStart'), t('app.kuaizhizao.quotation.dateRangeEnd')],
      },
      formItemProps: formDateRangeFormItemProps,
    },
    {
      title: t('common.createdAt'),
      dataIndex: 'created_at_range',
      valueType: 'dateRange',
      hideInTable: true,
      hideInSearch: false,
      fieldProps: {
        placeholder: [t('app.kuaizhizao.quotation.dateRangeStart'), t('app.kuaizhizao.quotation.dateRangeEnd')],
      },
      formItemProps: formDateRangeFormItemProps,
    },
    {
      title: t('app.kuaizhizao.demandComputation.colComputationCode'),
      dataIndex: 'computation_code',
      width: 168,
      fixed: 'left',
      hideInSearch: false,
      sorter: true,
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
      ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
      hideInSearch: false,
      sorter: true,
      render: (_: unknown, record: DemandComputation) => (
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
      title: t('app.kuaizhizao.demandComputation.colSourceType'),
      dataIndex: 'demand_type',
      width: 110,
      valueType: 'select',
      sorter: true,
      valueEnum: {
        sales_forecast: { text: translateDemandType(t, 'sales_forecast'), status: 'Processing' },
        sales_order: { text: translateDemandType(t, 'sales_order'), status: 'Success' },
        demand_plan: { text: translateDemandType(t, 'demand_plan'), status: 'Warning' },
      },
      hideInSearch: false,
      render: (_, record) => renderDemandTypeMarkerTag(t, record.demand_type),
    },
    {
      title: t('app.kuaizhizao.demandComputation.colBusinessMode'),
      dataIndex: 'business_mode',
      width: 140,
      uniTableKeepWidth: true,
      valueType: 'select',
      sorter: true,
      valueEnum: buildDemandBusinessModeValueEnum((mode) => {
        if (mode === 'MTS') return t('app.kuaizhizao.demandManagement.businessModeMts');
        if (mode === 'MTO') return t('app.kuaizhizao.demandManagement.businessModeMto');
        return t('app.kuaizhizao.demandManagement.businessModeAto');
      }),
      hideInSearch: false,
    },
    {
      title: t('app.kuaizhizao.demandComputation.colStartTime'),
      key: 'computation_start_end_time_stacked',
      dataIndex: 'computation_start_time',
      width: 188,
      uniTableKeepWidth: true,
      sorter: true,
      hideInSearch: true,
      render: (_, record) => (
        <UniTableStackedPrimaryCell
          primary={formatDateTimeBySiteSetting(record.computation_start_time)}
          secondary={formatDateTimeBySiteSetting(record.computation_end_time)}
          secondaryCopyable={false}
          uniformText
          primaryBadge={t('common.start')}
          secondaryBadge={t('common.end')}
        />
      ),
    },
    {
      title: t('app.kuaizhizao.salesManagement.pushProgress.title'),
      dataIndex: 'downstream_push_progress',
      ...DOCUMENT_PROGRESS_COLUMN_DEFAULTS,
      render: (_, record) => {
        const percent = resolveDownstreamPushPercent(record.downstream_push_progress)
        return (
          <DocumentPushProgressBar
            percent={percent}
            tooltip={t('app.kuaizhizao.salesManagement.pushProgress.percentOnly', {
              percent: Math.round(percent),
            })}
          />
        )
      },
    },
    {
      title: t('app.kuaizhizao.demandComputation.colDynamicMonitor'),
      dataIndex: 'dynamic_monitor',
      width: 148,
      uniTableKeepWidth: true,
      hideInSearch: true,
      render: (_, record) => {
        if (record.computation_status !== '完成' || !record.id) return '-'
        const summary = monitorSummaries[String(record.id)]
        if (!summary) {
          return monitorSummariesLoading ? <Spin size="small" /> : '-'
        }
        if (!summary.has_upstream_change && !summary.has_downstream_risk) return '-'
        return (
          <Space size={4} wrap>
            {summary.has_upstream_change ? (
              <Tag color="warning">{t('app.kuaizhizao.demandComputation.monitorBadgeUpstream')}</Tag>
            ) : null}
            {summary.has_downstream_risk ? (
              <Tag color="error">{t('app.kuaizhizao.demandComputation.monitorBadgeDownstream')}</Tag>
            ) : null}
          </Space>
        )
      },
    },
    ...buildDocumentAuditColumns<DemandComputation>(t),
    {
      title: t('app.kuaizhizao.demandComputation.colLifecycle'),
      dataIndex: LIST_LIFECYCLE_STAGE_FIELD,
      fixed: 'right',
      hideInSearch: false,
      valueType: 'select',
      valueEnum: demandComputationLifecycleValueEnum,
      fieldProps: { allowClear: true },
      render: (_, record) => {
        const lifecycle = getDemandComputationLifecycle(record, t)
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
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => {
        const canExecute = canExecuteComputation(record.computation_status)
        const canExecuteByCapability = record.capabilities?.execute?.allowed !== false
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
        if (computationPerms.canDelete) {
          parts.push(
            <Button {...rowActionKind('delete')} key="del" onClick={() => handleDelete(record)}>
              {t('app.kuaizhizao.demandComputation.actionDelete')}
            </Button>
          )
        }
        return parts
      },
    },
    ], SALES_DOC_LIST_FIELD_RANK),
    [computationPerms.canAction, computationPerms.canDelete, computationPerms.canUpdate, handleDelete, handleDetail, handleExecute, messageApi, demandComputationLifecycleValueEnum, monitorSummaries, monitorSummariesLoading, t],
  )

  const canUseToolbarPush = selectedComputationForToolbar
    ? isComputationCompleted(selectedComputationForToolbar.computation_status)
    : false

  const [toolbarPushOptions, setToolbarPushOptions] = useState<PushOptions | null>(null)

  useEffect(() => {
    const recordId = selectedComputationForToolbar?.id
    if (!recordId || !canUseToolbarPush) {
      setToolbarPushOptions(null)
      return
    }
    let cancelled = false
    void getPushOptions(recordId)
      .then((opts) => {
        if (!cancelled) setToolbarPushOptions(opts)
      })
      .catch(() => {
        if (!cancelled) setToolbarPushOptions(null)
      })
    return () => {
      cancelled = true
    }
  }, [canUseToolbarPush, selectedComputationForToolbar?.id])

  const computationPushBlockedReason = useMemo(() => {
    if (!selectedComputationForToolbar || canUseToolbarPush) return undefined
    return t('app.kuaizhizao.demandComputation.pushOnlyCompleted', {
      status: selectedComputationForToolbar.computation_status || t('app.kuaizhizao.demandComputation.statusUnknown'),
    })
  }, [canUseToolbarPush, selectedComputationForToolbar, t])

  const toolbarPushDisabledReason = useMemo(
    () =>
      buildUniPushToolbarDisabledReason(t, {
        selectedCount: selectedRowKeys.length,
        hasSelectedRecord: !!selectedComputationForToolbar,
      }),
    [selectedComputationForToolbar, selectedRowKeys.length, t],
  )

  const toolbarPushMenuItems = useMemo(() => {
    const openPush = (preset?: PushPanelPreset) => {
      if (selectedComputationForToolbar && canUseToolbarPush) {
        handleOpenPushPanel(selectedComputationForToolbar, preset)
      }
    }
    const productionPathBlockedReason =
      computationPushBlockedReason
      ?? (toolbarPushOptions && !toolbarPushOptions.has_production_items && !toolbarPushOptions.has_outsource_items
        ? t('app.kuaizhizao.demandComputation.pushNoProductionItems', { defaultValue: '计算结果无生产/委外需求' })
        : undefined)
    const purchasePathBlockedReason =
      computationPushBlockedReason
      ?? (toolbarPushOptions && !toolbarPushOptions.has_purchase_items
        ? t('app.kuaizhizao.demandComputation.pushNoPurchaseItems', { defaultValue: '计算结果无采购需求' })
        : undefined)

    return buildUniPushMenuItems([
      {
        key: 'push-production-work-order',
        label: pushToWorkOrderAction.label,
        disabled: !!productionPathBlockedReason,
        title: productionPathBlockedReason,
        onClick: () => openPush({ production: 'work_order' }),
      },
      {
        key: 'push-purchase-requisition',
        label: pushToPurchaseRequisitionAction.label,
        disabled: !!purchasePathBlockedReason,
        title: purchasePathBlockedReason,
        onClick: () => openPush({ purchase: 'requisition' }),
      },
      {
        key: 'push-purchase-order',
        label: pushToPurchaseOrderAction.label,
        disabled: !!purchasePathBlockedReason,
        title: purchasePathBlockedReason,
        onClick: () => openPush({ purchase: 'purchase_order' }),
      },
      { type: 'divider' as const },
      {
        key: 'push-documents-panel',
        label: t('app.kuaizhizao.demandComputation.pushDocuments'),
        disabled: !!computationPushBlockedReason,
        title: computationPushBlockedReason,
        onClick: () => openPush(),
      },
    ])
  }, [
    canUseToolbarPush,
    computationPushBlockedReason,
    handleOpenPushPanel,
    pushToPurchaseOrderAction.label,
    pushToPurchaseRequisitionAction.label,
    pushToWorkOrderAction.label,
    selectedComputationForToolbar,
    t,
    toolbarPushOptions,
  ])

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

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'exceptions') {
      setActiveTabKey('exceptions')
    }
  }, [searchParams])

  useEffect(() => {
    const completedIds = tableComputations
      .filter((row) => row.computation_status === '完成' && row.id)
      .map((row) => row.id!)
    if (!completedIds.length) {
      setMonitorSummaries({})
      return
    }
    let cancelled = false
    setMonitorSummariesLoading(true)
    void getMonitorSummariesBatch(completedIds)
      .then((res) => {
        if (!cancelled) setMonitorSummaries(res.summaries || {})
      })
      .catch(() => {
        if (!cancelled) setMonitorSummaries({})
      })
      .finally(() => {
        if (!cancelled) setMonitorSummariesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [tableComputations])

  const listTabContent = (
      <>
      <UniTable<DemandComputation>
        columnPersistenceId="apps.kuaizhizao.pages.plan-management.demand-computation-source-label-v1"
        actionRef={actionRef}
        columns={columns}
        showAdvancedSearch={true}
        skipFuzzyPinyinClientFilter
        pinnedTabsField={LIST_LIFECYCLE_STAGE_FIELD}
        pinnedTabsValueEnum={demandComputationLifecycleValueEnum}
        request={async (params, sort, _filter, searchFormValues) => {
          const s = (searchFormValues ?? {}) as Record<string, unknown>
          const lifecycleParams = resolveDemandComputationListLifecycleParams(s, params as Record<string, unknown>)
          const { sortBy, sortOrder } = extractProTableSort(sort)
          const orderBy =
            sortBy && sortOrder ? (sortOrder === 'desc' ? `-${sortBy}` : sortBy) : undefined
          const fuzzyKeyword = typeof s.keyword === 'string' ? s.keyword.trim() : ''

          const apiParams: Parameters<typeof listDemandComputations>[0] = {
            skip: (params.current! - 1) * params.pageSize!,
            limit: params.pageSize!,
            ...lifecycleParams,
            order_by: orderBy,
            business_mode: s.business_mode as DemandComputation['business_mode'],
            demand_type: s.demand_type as DemandComputation['demand_type'],
          }

          if (fuzzyKeyword) {
            apiParams.keyword = fuzzyKeyword
          } else {
            if (s.computation_code != null && String(s.computation_code).trim()) {
              apiParams.computation_code = String(s.computation_code).trim()
            }
            if (s.demand_code != null && String(s.demand_code).trim()) {
              apiParams.demand_code = String(s.demand_code).trim()
            }
          }

          const startRange = s.computation_start_time_range as [unknown, unknown] | undefined
          if (startRange && Array.isArray(startRange) && startRange[0]) {
            apiParams.start_date = formatDateTime(startRange[0] as string | Date, 'YYYY-MM-DD')
            apiParams.end_date = startRange[1]
              ? formatDateTime(startRange[1] as string | Date, 'YYYY-MM-DD')
              : apiParams.start_date
          }

          const createdRange = s.created_at_range as [unknown, unknown] | undefined
          if (createdRange && Array.isArray(createdRange) && createdRange[0]) {
            apiParams.created_start_date = formatDateTime(createdRange[0] as string | Date, 'YYYY-MM-DD')
            apiParams.created_end_date = createdRange[1]
              ? formatDateTime(createdRange[1] as string | Date, 'YYYY-MM-DD')
              : apiParams.created_start_date
          }

          const result = await listDemandComputations(apiParams)
          return {
            data: result.data || [],
            success: result.success,
            total: result.total || 0,
          }
        }}
        onTableDataChange={setTableComputations}
        rowKey="id"
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={handleRowSelectionChange}
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
              disabled={selectedRowKeys.length !== 1 || !selectedComputationForToolbar}
              disabledReason={toolbarPushDisabledReason}
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
          <Tooltip
            key="result-analysis-tip"
            title={
              selectedRowKeys.length !== 1
                ? t('app.kuaizhizao.demandComputation.analysisSelectOne')
                : !(
                    isComputationCompleted(selectedComputationForToolbar?.computation_status) ||
                    isComputationFailed(selectedComputationForToolbar?.computation_status)
                  )
                  ? t('app.kuaizhizao.demandComputation.analysisStatusRequired')
                  : undefined
            }
          >
            <span style={{ display: 'inline-block' }}>
              <Button
                icon={<FundOutlined />}
                loading={readinessSubmitting && readinessContext === 'analysis'}
                disabled={
                  selectedRowKeys.length !== 1 ||
                  !(
                    isComputationCompleted(selectedComputationForToolbar?.computation_status) ||
                    isComputationFailed(selectedComputationForToolbar?.computation_status)
                  )
                }
                onClick={() => void openResultAnalysis()}
              >
                {t('app.kuaizhizao.demandComputation.actionResultAnalysis')}
              </Button>
            </span>
          </Tooltip>,
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
          {
            title: t('app.kuaizhizao.demandComputation.colDemandType'),
            dataIndex: 'demand_type',
            width: 130,
            align: 'center',
            render: (v) => renderDemandTypeMarkerTag(t, v),
          },
          {
            title: t('app.kuaizhizao.demandComputation.colBusinessMode'),
            dataIndex: 'business_mode',
            width: 110,
            align: 'center',
            render: (v) => renderDemandBusinessModeMarkerTag(t, v),
          },
          {
            title: t('app.kuaizhizao.demandComputation.colStatus'),
            dataIndex: 'status',
            width: 100,
            align: 'center' as const,
            render: (v) => renderPullQueryDocStatus(t, v),
          },
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
              renderPullCapabilityTag(
                !r.pushed_to_computation,
                t('app.kuaizhizao.demandComputation.convertCreatable'),
                t('app.kuaizhizao.demandComputation.convertPushed'),
              ),
          },
        ]}
        dataSource={pullFromDemandQuery.dataSource}
        loading={pullFromDemandQuery.loading}
        confirmLoading={pullFromDemandQuery.confirmLoading}
        selectionType={pullFromDemandQuery.selectionType}
        selectedRowKeys={pullFromDemandQuery.selectedRowKeys}
        selectedRows={pullFromDemandQuery.selectedRows}
        onSelectedRowKeysChange={pullFromDemandQuery.handleSelectedRowKeysChange}
        isRowDisabled={pullFromDemandQuery.isRowDisabled}
        searchDraft={pullFromDemandQuery.searchDraft}
        onSearchDraftChange={pullFromDemandQuery.setSearchDraft}
        onSearchApply={pullFromDemandQuery.handleSearchApply}
        onSearchClear={pullFromDemandQuery.handleSearchClear}
        appliedKeyword={pullFromDemandQuery.appliedKeyword}
        searchPlaceholder={t('app.kuaizhizao.demandComputation.searchDemandPlaceholder')}
        getRowLabel={(row) => [row.demand_code, row.demand_name].filter(Boolean).join(' ')}
        page={pullFromDemandQuery.page}
        pageSize={pullFromDemandQuery.pageSize}
        total={pullFromDemandQuery.total}
        onPageChange={pullFromDemandQuery.handlePageChange}
        scopeOptions={pullFromDemandQuery.scopeOptions}
        scope={pullFromDemandQuery.scope}
        onScopeChange={pullFromDemandQuery.handleScopeChange}
        okText={t('app.kuaizhizao.demandComputation.createComputation')}
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
          {
            title: t('app.kuaizhizao.salesOrder.status'),
            dataIndex: 'status',
            width: 100,
            align: 'center' as const,
            render: (v) => renderPullQueryDocStatus(t, v),
          },
          {
            title: t('app.kuaizhizao.salesOrder.reviewStatus'),
            dataIndex: 'review_status',
            width: 120,
            align: 'center' as const,
            render: (v) => renderPullQueryReviewStatus(t, v),
          },
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
              renderPullCapabilityTag(
                r.capabilities?.push_computation?.allowed === true,
                t('app.kuaizhizao.demandComputation.convertCreatable'),
                salesOrderCapabilityReasonMessage(r.capabilities?.push_computation?.reason, t) || t('app.kuaizhizao.demandComputation.convertPushed'),
              ),
          },
        ]}
        dataSource={pullFromSalesOrderQuery.dataSource}
        loading={pullFromSalesOrderQuery.loading}
        confirmLoading={pullFromSalesOrderQuery.confirmLoading}
        selectionType={pullFromSalesOrderQuery.selectionType}
        selectedRowKeys={pullFromSalesOrderQuery.selectedRowKeys}
        selectedRows={pullFromSalesOrderQuery.selectedRows}
        onSelectedRowKeysChange={pullFromSalesOrderQuery.handleSelectedRowKeysChange}
        isRowDisabled={pullFromSalesOrderQuery.isRowDisabled}
        searchDraft={pullFromSalesOrderQuery.searchDraft}
        onSearchDraftChange={pullFromSalesOrderQuery.setSearchDraft}
        onSearchApply={pullFromSalesOrderQuery.handleSearchApply}
        onSearchClear={pullFromSalesOrderQuery.handleSearchClear}
        appliedKeyword={pullFromSalesOrderQuery.appliedKeyword}
        searchPlaceholder={t('components.uniPullQuery.searchPlaceholder')}
        getRowLabel={(row) => [row.order_code, row.customer_name].filter(Boolean).join(' ')}
        page={pullFromSalesOrderQuery.page}
        pageSize={pullFromSalesOrderQuery.pageSize}
        total={pullFromSalesOrderQuery.total}
        onPageChange={pullFromSalesOrderQuery.handlePageChange}
        scopeOptions={pullFromSalesOrderQuery.scopeOptions}
        scope={pullFromSalesOrderQuery.scope}
        onScopeChange={pullFromSalesOrderQuery.handleScopeChange}
        okText={t('app.kuaizhizao.demandComputation.createComputation')}
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
          {
            title: t('app.kuaizhizao.salesForecast.status'),
            dataIndex: 'status',
            width: 100,
            align: 'center' as const,
            render: (v) => renderPullQueryDocStatus(t, v),
          },
          {
            title: t('app.kuaizhizao.salesForecast.reviewStatus'),
            dataIndex: 'review_status',
            width: 120,
            align: 'center' as const,
            render: (v) => renderPullQueryReviewStatus(t, v),
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
              renderPullCapabilityTag(
                r.capabilities?.push_computation?.allowed === true,
                t('app.kuaizhizao.demandComputation.convertCreatable'),
                salesForecastCapabilityReasonMessage(r.capabilities?.push_computation?.reason, t) || t('app.kuaizhizao.demandComputation.convertPushed'),
              ),
          },
        ]}
        dataSource={pullFromSalesForecastQuery.dataSource}
        loading={pullFromSalesForecastQuery.loading}
        confirmLoading={pullFromSalesForecastQuery.confirmLoading}
        selectionType={pullFromSalesForecastQuery.selectionType}
        selectedRowKeys={pullFromSalesForecastQuery.selectedRowKeys}
        selectedRows={pullFromSalesForecastQuery.selectedRows}
        onSelectedRowKeysChange={pullFromSalesForecastQuery.handleSelectedRowKeysChange}
        isRowDisabled={pullFromSalesForecastQuery.isRowDisabled}
        searchDraft={pullFromSalesForecastQuery.searchDraft}
        onSearchDraftChange={pullFromSalesForecastQuery.setSearchDraft}
        onSearchApply={pullFromSalesForecastQuery.handleSearchApply}
        onSearchClear={pullFromSalesForecastQuery.handleSearchClear}
        appliedKeyword={pullFromSalesForecastQuery.appliedKeyword}
        searchPlaceholder={t('components.uniPullQuery.searchPlaceholder')}
        getRowLabel={(row) => [row.forecast_code, row.forecast_name].filter(Boolean).join(' ')}
        page={pullFromSalesForecastQuery.page}
        pageSize={pullFromSalesForecastQuery.pageSize}
        total={pullFromSalesForecastQuery.total}
        onPageChange={pullFromSalesForecastQuery.handlePageChange}
        scopeOptions={pullFromSalesForecastQuery.scopeOptions}
        scope={pullFromSalesForecastQuery.scope}
        onScopeChange={pullFromSalesForecastQuery.handleScopeChange}
        okText={t('app.kuaizhizao.demandComputation.createComputation')}
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
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
        okText={t('app.kuaizhizao.demandComputation.confirmPush')}
        confirmLoading={pushPanelSubmitting}
        onOk={handlePushPanelConfirm}
        okButtonProps={{
          disabled:
            pushPanelLoading ||
            !!pushPreviewLoadError ||
            !!pushPreviewData?.has_blocking_issues ||
            !(pushPreviewData?.items || []).some(
              (row) => Number(row.max_push_quantity ?? 0) > 0,
            ) ||
            (pushMode === 'confirm' && (pushPreviewData?.validation_failures?.length ?? 0) > 0) ||
            (() => {
              const items = pushPreviewData?.items || []
              const prRows = items.filter(
                (row) =>
                  row.target_document === 'purchase_requisition' &&
                  Number(row.max_push_quantity ?? 0) > 0,
              )
              const prodRows = items.filter(
                (row) =>
                  (row.target_document === 'work_order' ||
                    row.target_document === 'outsource_work_order') &&
                  Number(row.max_push_quantity ?? 0) > 0,
              )
              const needPr =
                pushConfig.purchase === 'requisition' &&
                prRows.length > 0 &&
                !pushSelectedItemIds.some((id) => prRows.some((row) => Number(row.item_id) === id))
              const needProd =
                pushConfig.production === 'work_order' &&
                prodRows.length > 0 &&
                !pushSelectedItemIds.some((id) => prodRows.some((row) => Number(row.item_id) === id))
              return needPr || needProd
            })(),
        }}
        onCancel={() => {
          setPushPanelRecord(null)
          setPushOptions(null)
          setPushPreviewData(null)
          setPushPreviewLoadError(null)
          setPushMode('draft')
          setPushConfig({})
          setPushSelectedItemIds([])
        }}
      >
        {pushPanelLoading ? (
          <div style={{ padding: 24, textAlign: 'center' }}>{t('app.kuaizhizao.demandComputation.loading')}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {pushPreviewLoadError ? (
              <Alert type="error" showIcon title={pushPreviewLoadError} />
            ) : null}
            {pushOptions && (
              <>
                {pushOptions.production_choices.length > 0 && (
                  <div>
                    <div style={{ fontWeight: 'bold', marginBottom: 8 }}>{t('app.kuaizhizao.demandComputation.productionPath')}</div>
                    <div style={{ color: '#666' }}>{t('app.kuaizhizao.demandComputation.productionPathDesc')}</div>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 24 }}>
                  {pushOptions.purchase_choices.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                      <span style={{ fontWeight: 'bold' }}>{t('app.kuaizhizao.demandComputation.purchasePath')}</span>
                      <ThemedSegmented
                        size="small"
                        value={pushConfig.purchase ?? pushOptions.default_purchase ?? 'requisition'}
                        onChange={(val) =>
                          setPushConfig((c) => ({
                            ...c,
                            purchase: val as 'requisition' | 'purchase_order',
                          }))
                        }
                        options={[
                          { label: t('app.kuaizhizao.demandComputation.purchaseRequisition'), value: 'requisition' },
                          { label: t('app.kuaizhizao.demandComputation.purchaseOrderOnly'), value: 'purchase_order' },
                        ]}
                      />
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <span>{t('app.kuaizhizao.salesOrder.pushModeLabel')}</span>
                    <ThemedSegmented
                      size="small"
                      value={pushMode}
                      onChange={(val) => setPushMode(val as 'draft' | 'confirm')}
                      options={[
                        { label: t('app.kuaizhizao.salesOrder.pushModeDraft'), value: 'draft' },
                        { label: t('app.kuaizhizao.salesOrder.pushModeConfirm'), value: 'confirm' },
                      ]}
                    />
                  </div>
                </div>
                <p style={{ fontSize: 12, color: '#666' }}>
                  {t('app.kuaizhizao.demandComputation.pushOutsourceHint')}
                </p>
              </>
            )}
            {pushPreviewData && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {pushPreviewMergedSummary ? (
                  <Typography.Text strong style={{ display: 'block' }}>
                    {pushPreviewMergedSummary}
                  </Typography.Text>
                ) : null}
                {pushPreviewData.has_blocking_issues && pushPreviewData.blocking_reason ? (
                  <Alert
                    type="warning"
                    showIcon
                    message={
                      demandComputationCapabilityReasonMessage(
                        pushPreviewData.blocking_reason,
                        t,
                      ) || pushPreviewData.blocking_reason
                    }
                  />
                ) : null}
                {(pushPreviewData.items?.length ?? 0) > 0 ? (
                  <Table
                    size="small"
                    dataSource={pushPreviewData.items}
                    rowKey={(row) =>
                      `${row.item_id}-${row.target_document ?? 'line'}-${row.push_line_index ?? 0}-${row.planned_receipt_date ?? ''}`
                    }
                    pagination={false}
                    scroll={{ x: 1000 }}
                    rowSelection={
                      pushConfig.purchase === 'requisition' ||
                      pushConfig.production === 'work_order'
                        ? {
                            selectedRowKeys: pushSelectedItemIds.map(String),
                            onChange: (keys) => setPushSelectedItemIds(keys.map((k) => Number(k))),
                            getCheckboxProps: (row) => ({
                              disabled:
                                Number(row.max_push_quantity ?? 0) <= 0 ||
                                !(
                                  (pushConfig.purchase === 'requisition' &&
                                    row.target_document === 'purchase_requisition') ||
                                  (pushConfig.production === 'work_order' &&
                                    (row.target_document === 'work_order' ||
                                      row.target_document === 'outsource_work_order'))
                                ),
                            }),
                          }
                        : undefined
                    }
                    columns={[
                      {
                        title: t('app.kuaizhizao.salesOrder.materialCode'),
                        dataIndex: 'material_code',
                        width: 130,
                        ellipsis: true,
                      },
                      {
                        title: t('app.kuaizhizao.salesOrder.materialName'),
                        dataIndex: 'material_name',
                        width: 160,
                        ellipsis: true,
                      },
                      {
                        title: t('app.kuaizhizao.demandComputation.pushPreviewColTarget'),
                        dataIndex: 'target_document',
                        width: 120,
                        render: (v: ComputationPushPreviewItem['target_document']) =>
                          renderPushPreviewTargetBadge(v, t),
                      },
                      {
                        title: t('app.kuaizhizao.salesOrder.quantity'),
                        dataIndex: 'quantity',
                        width: 90,
                        align: 'right',
                      },
                      {
                        title: t('app.kuaizhizao.salesOrder.colPushedQty'),
                        dataIndex: 'pushed_quantity',
                        width: 90,
                        align: 'right',
                      },
                      {
                        title: t('app.kuaizhizao.demandComputation.pushPreviewColPlannedReceipt'),
                        dataIndex: 'planned_receipt_date',
                        width: 108,
                        render: (v: string | null | undefined) => v || '-',
                      },
                      {
                        title: t('app.kuaizhizao.salesOrder.colPushableQty'),
                        dataIndex: 'max_push_quantity',
                        width: 90,
                        align: 'right',
                      },
                    ]}
                  />
                ) : (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={t('app.kuaizhizao.demandComputation.pushPreviewNoLines')}
                  />
                )}
                {pushPreviewData.validation_failures && pushPreviewData.validation_failures.length > 0 && (
                  <Alert
                    type="warning"
                    showIcon
                    message={t('app.kuaizhizao.demandComputation.validationFailedMaterials')}
                    description={
                      <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
                        {pushPreviewData.validation_failures.map((v, i) => (
                          <li key={i}>
                            {v.material_code} ({v.material_name}): {v.errors.join(', ')}
                          </li>
                        ))}
                      </ul>
                    }
                  />
                )}
                {pushPreviewData.tip ? (
                  <p style={{ marginBottom: 0, fontSize: 12, color: '#666' }}>{pushPreviewData.tip}</p>
                ) : null}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* 执行前补齐 / 计算结果分析（补齐 + 重算） */}
      <Modal
        open={readinessModalVisible}
        destroyOnHidden
        onCancel={() => {
          setReadinessModalVisible(false)
          if (readinessContext === 'analysis') setAnalysisRecord(null)
        }}
        title={
          readinessContext === 'analysis'
            ? t('app.kuaizhizao.demandComputation.analysisTitle', {
                code: analysisRecord?.computation_code || '',
              })
            : t('app.kuaizhizao.demandComputation.readinessTitle')
        }
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
        styles={{
          body: {
            maxHeight: MODAL_CONFIG.BODY_MAX_HEIGHT,
            overflow: 'auto',
          },
        }}
        footer={
          readinessContext === 'analysis'
            ? [
                <Button
                  key="close"
                  onClick={() => {
                    setReadinessModalVisible(false)
                    setAnalysisRecord(null)
                  }}
                >
                  {t('common.close')}
                </Button>,
                <Button
                  key="backfill"
                  loading={readinessSubmitting}
                  disabled={!materialPerms.canUpdate || readinessBackfillableGaps.length === 0}
                  onClick={() => void handleAnalysisBackfill()}
                >
                  {t('app.kuaizhizao.demandComputation.analysisBackfill')}
                </Button>,
                <Button
                  key="recompute"
                  type="primary"
                  icon={<ReloadOutlined />}
                  loading={readinessSubmitting}
                  disabled={!computationPerms.canUpdate}
                  onClick={() => void handleAnalysisRecompute()}
                >
                  {t('app.kuaizhizao.demandComputation.actionRecompute')}
                </Button>,
              ]
            : [
                <Button key="cancel" onClick={() => setReadinessModalVisible(false)}>
                  {t('common.cancel')}
                </Button>,
                <Button key="skip" loading={readinessSubmitting} onClick={() => void handleReadinessSkip()}>
                  {t('app.kuaizhizao.demandComputation.readinessSkipContinue')}
                </Button>,
                <Button
                  key="backfill"
                  type="primary"
                  loading={readinessSubmitting}
                  disabled={!materialPerms.canUpdate || readinessBackfillableGaps.length === 0}
                  onClick={() => void handleReadinessBackfillAndContinue()}
                >
                  {t('app.kuaizhizao.demandComputation.readinessBackfillContinue')}
                </Button>,
              ]
        }
      >
        {readinessContext === 'analysis' ? (
          <Tabs
            activeKey={analysisMainTab}
            onChange={(key) => setAnalysisMainTab(key as 'results' | 'masterData')}
            items={[
              {
                key: 'results',
                label: t('app.kuaizhizao.demandComputation.analysisTabResults', {
                  count: analysisItems.length,
                }),
                children: analysisItems.length === 0 ? (
                  <Empty
                    description={t('app.kuaizhizao.demandComputation.analysisNoResults')}
                    style={{ margin: `${token.marginLG}px 0` }}
                  />
                ) : (
                  <>
                    <Alert
                      type="info"
                      showIcon
                      style={{ marginBottom: token.marginSM }}
                      message={t('app.kuaizhizao.demandComputation.analysisResultsHint', {
                        count: analysisItems.length,
                      })}
                    />
                    {analysisSourceTabItems.length > 1 ? (
                      <Tabs
                        activeKey={analysisSourceTab}
                        onChange={(key) => {
                          setAnalysisSourceTab(key)
                          setAnalysisTablePage(1)
                        }}
                        items={analysisSourceTabItems.map((tab) => ({
                          key: tab.key,
                          label: tab.label,
                        }))}
                        style={{ marginBottom: token.marginSM }}
                      />
                    ) : null}
                    <Table
                      size="small"
                      dataSource={filteredAnalysisItems}
                      rowKey={(r, i) => `${r.id ?? r.material_id}-${analysisSourceTab}-${i}`}
                      scroll={{ x: 1100 }}
                      pagination={{
                        current: analysisTablePage,
                        pageSize: analysisTablePageSize,
                        showSizeChanger: true,
                        pageSizeOptions: ['10', '20', '50', '100'],
                        showTotal: (total) =>
                          t('app.kuaizhizao.demandComputation.totalItems', { count: total }),
                        onChange: (page, size) => {
                          setAnalysisTablePage(page)
                          if (size != null) setAnalysisTablePageSize(size)
                        },
                        onShowSizeChange: (_page, size) => {
                          setAnalysisTablePage(1)
                          setAnalysisTablePageSize(size)
                        },
                      }}
                      columns={[
                        {
                          title: t('app.kuaizhizao.demandComputation.colMaterial'),
                          key: 'material',
                          width: 220,
                          render: (_: unknown, r: DemandComputationItem) => (
                            <MaterialStackedCell
                              material_name={r.material_name}
                              material_code={r.material_code}
                            />
                          ),
                        },
                        {
                          title: t('app.kuaizhizao.demandComputation.colUnit'),
                          dataIndex: 'material_unit',
                          width: 100,
                          render: (_: unknown, r: DemandComputationItem) => (
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
                          key: 'planned_date',
                          width: 110,
                          render: (_: unknown, r: DemandComputationItem) =>
                            formatDateBySiteSetting(
                              r.production_start_date || r.procurement_start_date || undefined,
                            ),
                        },
                        {
                          title: t('app.kuaizhizao.demandComputation.colRequiredQty'),
                          dataIndex: 'required_quantity',
                          width: 90,
                          align: 'right' as const,
                          render: formatQuantity,
                        },
                        {
                          title: t('app.kuaizhizao.demandComputation.colAvailableInventory'),
                          dataIndex: 'available_inventory',
                          width: 90,
                          align: 'right' as const,
                          render: (v: number, r: DemandComputationItem) =>
                            renderAvailableInventoryCell(
                              v,
                              r.detail_results as Record<string, unknown> | undefined,
                            ),
                        },
                        {
                          title: t('app.kuaizhizao.demandComputation.colNetRequirement'),
                          dataIndex: 'net_requirement',
                          width: 90,
                          align: 'right' as const,
                          render: formatQuantity,
                        },
                        {
                          title: t('app.kuaizhizao.demandComputation.colSuggestedWorkOrder'),
                          dataIndex: 'suggested_work_order_quantity',
                          width: 90,
                          align: 'right' as const,
                          render: (v: number, r: DemandComputationItem) =>
                            r.material_source_type === 'Outsource'
                              ? '-'
                              : formatQuantity(v),
                        },
                        {
                          title: t('app.kuaizhizao.demandComputation.colSuggestedOutsource'),
                          dataIndex: 'suggested_work_order_quantity',
                          width: 90,
                          align: 'right' as const,
                          render: (v: number, r: DemandComputationItem) =>
                            r.material_source_type === 'Outsource' ? formatQuantity(v) : '-',
                        },
                        {
                          title: t('app.kuaizhizao.demandComputation.colSuggestedPurchase'),
                          dataIndex: 'suggested_purchase_order_quantity',
                          width: 90,
                          align: 'right' as const,
                          render: formatQuantity,
                        },
                        {
                          title: t('app.kuaizhizao.demandComputation.colSource'),
                          dataIndex: 'material_source_type',
                          width: 80,
                          render: (sourceType: string) => getMaterialSourceTypeLabel(sourceType, t),
                        },
                      ]}
                    />
                  </>
                ),
              },
              {
                key: 'masterData',
                label: t('app.kuaizhizao.demandComputation.analysisTabMasterData', {
                  count: readinessGaps.length,
                }),
                children: (
                  <>
                    <Alert
                      type="info"
                      showIcon
                      style={{ marginBottom: token.marginMD }}
                      message={
                        readinessGaps.length > 0
                          ? t('app.kuaizhizao.demandComputation.analysisHint', {
                              count: readinessGaps.length,
                            })
                          : t('app.kuaizhizao.demandComputation.analysisReady')
                      }
                    />
                    {readinessGaps.some((g) => g.blocking || g.value_type === 'info') ? (
                      <Alert
                        type="warning"
                        showIcon
                        style={{ marginBottom: token.marginMD }}
                        message={t('app.kuaizhizao.demandComputation.analysisBlockingHint')}
                      />
                    ) : null}
                    {!materialPerms.canUpdate ? (
                      <Alert
                        type="warning"
                        showIcon
                        style={{ marginBottom: token.marginMD }}
                        message={t('app.kuaizhizao.demandComputation.readinessNoMaterialUpdatePerm')}
                      />
                    ) : null}
                    {readinessGaps.length === 0 ? (
                      <Empty
                        description={t('app.kuaizhizao.demandComputation.analysisReady')}
                        style={{ margin: `${token.marginLG}px 0` }}
                      />
                    ) : (
                      <Tabs
                        activeKey={readinessActiveFieldTab}
                        onChange={setReadinessActiveFieldTab}
                        items={readinessGapsByField.map((group) => ({
                          key: group.field,
                          label: `${group.label} (${group.gaps.length})`,
                          children: (
                            <>
                              <Alert
                                type="info"
                                showIcon
                                style={{ marginBottom: token.marginSM }}
                                message={getReadinessFieldHelp(group.field)}
                              />
                              <Table
                                size="small"
                                rowKey={(r) => readinessRowKey(r)}
                                scroll={{ x: 960 }}
                                pagination={{ pageSize: 20, hideOnSinglePage: true }}
                                dataSource={group.gaps}
                                columns={readinessTableColumns}
                              />
                            </>
                          ),
                        }))}
                      />
                    )}
                  </>
                ),
              },
            ]}
          />
        ) : (
          <>
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: token.marginMD }}
              message={t('app.kuaizhizao.demandComputation.readinessHint', {
                count: readinessGaps.length,
              })}
            />
            {readinessGaps.some((g) => g.blocking || g.value_type === 'info') ? (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: token.marginMD }}
                message={t('app.kuaizhizao.demandComputation.readinessBlockingHint')}
              />
            ) : null}
            {!materialPerms.canUpdate ? (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: token.marginMD }}
                message={t('app.kuaizhizao.demandComputation.readinessNoMaterialUpdatePerm')}
              />
            ) : null}
            <Tabs
              activeKey={readinessActiveFieldTab}
              onChange={setReadinessActiveFieldTab}
              items={readinessGapsByField.map((group) => ({
                key: group.field,
                label: `${group.label} (${group.gaps.length})`,
                children: (
                  <>
                    <Alert
                      type="info"
                      showIcon
                      style={{ marginBottom: token.marginSM }}
                      message={getReadinessFieldHelp(group.field)}
                    />
                    <Table
                      size="small"
                      rowKey={(r) => readinessRowKey(r)}
                      scroll={{ x: 960 }}
                      pagination={{ pageSize: 20, hideOnSinglePage: true }}
                      dataSource={group.gaps}
                      columns={readinessTableColumns}
                    />
                  </>
                ),
              }))}
            />
          </>
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
          setPreviewSourceTab(PREVIEW_SOURCE_TAB_ALL)
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
            {previewSourceTabItems.length > 1 ? (
              <Tabs
                activeKey={previewSourceTab}
                onChange={(key) => {
                  setPreviewSourceTab(key)
                  setPreviewTablePage(1)
                }}
                items={previewSourceTabItems.map((tab) => ({ key: tab.key, label: tab.label }))}
                style={{ marginBottom: token.marginSM }}
              />
            ) : null}
            <Table
              size="small"
              dataSource={filteredPreviewItems}
              rowKey={(r, i) => `${r.material_code}-${previewSourceTab}-${i}`}
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
                  render: (sourceType: string) => getMaterialSourceTypeLabel(sourceType, t),
                },
              ]}
            />
          </>
        )}
      </Modal>

      <DemandComputationDetailDrawer
        open={drawerVisible}
        zIndex={computationDetailDrawerZIndex}
        onClose={() => {
          setDrawerVisible(false)
          setFocusPlanItemId(null)
        }}
        computation={currentComputation}
        initialFocusItemId={focusPlanItemId}
        trackingRefreshKey={computationTrackingRefreshKey}
        onRefresh={() => {
          if (currentComputation?.id) {
            void getDemandComputation(currentComputation.id, true).then(setCurrentComputation)
          }
        }}
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

      </>
  )

  const tabs = [
    { key: 'list', label: t('app.kuaizhizao.demandComputation.tabList'), children: listTabContent },
    {
      key: 'exceptions',
      label: t('app.kuaizhizao.demandComputation.tabExceptions'),
      children: (
        <MrpExceptionInboxTab
          onOpenComputationDetail={handleOpenComputationFromInbox}
          onOpenPushPreview={handleOpenPushFromInbox}
        />
      ),
    },
    { key: 'history', label: t('app.kuaizhizao.demandComputation.tabHistory'), children: <ComputationHistoryTab /> },
  ]

  return (
    <MultiTabListPageTemplate
      statCards={statCards}
      activeTabKey={activeTabKey}
      onTabChange={setActiveTabKey}
      tabs={tabs}
      preserveMounted
    />
  )
}

export default DemandComputationPage
