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

import React, { useRef, useState, useEffect, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router-dom'
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
  EyeOutlined,
  ReloadOutlined,
  ArrowDownOutlined,
  DeleteOutlined,
  WarningOutlined,
  CopyOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { UniTable } from '../../../../../components/uni-table'
import { UniLifecycle, UniLifecycleStepper } from '../../../../../components/uni-lifecycle'
import {
  MultiTabListPageTemplate,
  DetailDrawerSection,
  DetailDrawerTemplate,
  DRAWER_CONFIG,
  MODAL_CONFIG,
  FormModalTemplate,
  type StatCard,
} from '../../../../../components/layout-templates'
import { UniPullCreateToolbar } from '../../../../../components/uni-pull'
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
import { renderRowActionsOverflow } from '../../../../../utils/renderRowActionsOverflow'
import { listDemands, getDemand, pushDemandToComputation, Demand, DemandStatus, ReviewStatus } from '../../../services/demand'
import { getBusinessConfig } from '../../../../../services/businessConfig'
import { bomApi } from '../../../../master-data/services/material'
import { warehouseApi } from '../../../../master-data/services/warehouse'
import ComputationHistoryTab from './ComputationHistoryTab'
import { MrpParametersCustomerGuideTrigger } from './MrpParametersCustomerGuide'
import { formatDateBySiteSetting, formatDateTimeBySiteSetting } from '../../../../../utils/format'
import { MaterialUnitSelect, prefetchMaterialsForUnitSelect } from '../../../../../components/material-unit-select'
import { ThemedSegmented } from '../../../../../components/themed-segmented'
import { useTranslation } from 'react-i18next'
import { buildKuaizhizaoPullCreateMenuItems, getKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry'

const MRP_SUGGESTION_SEGMENTED_OPTIONS = [
  { label: '净需求（推荐）', value: 'net' as const },
  { label: '毛需求', value: 'gross' as const },
]

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

/** 详情明细表最小宽度（外层横滚） */
/** 明细表列宽合计下限，保证横滚与「尽量不换行」 */
const DEMAND_COMPUTATION_DETAIL_ITEMS_MIN_WIDTH = 1920

function renderDemandComputationRowActions(nodes: React.ReactNode[], keyPrefix: string): React.ReactNode {
  return renderRowActionsOverflow(nodes, keyPrefix)
}

function normalizeComputationSourceNote(computation?: DemandComputation): string {
  const raw = String(computation?.notes || '').trim()
  if (!raw) return ''

  const demandNo = String(computation?.demand_code || '').trim()
  const sourceNoFromRaw = raw.match(/^从需求\s+(.+?)\s+下推创建$/)?.[1]?.trim()
  const sourceNo = demandNo || sourceNoFromRaw || ''

  if (/^从需求\s+.+\s+下推创建$/.test(raw) || /^从需求计划\s+.+\s+下推创建$/.test(raw)) {
    if (computation?.demand_type === 'sales_order') return `从销售订单 ${sourceNo} 下推创建`.trim()
    if (computation?.demand_type === 'sales_forecast') return `从销售预测 ${sourceNo} 下推创建`.trim()
    return `从需求计划 ${sourceNo} 下推创建`.trim()
  }

  return raw
}

/** 可用库存列：hover 展示分仓库构成与净需求计算说明（依赖 detail_results.inventory_breakdown） */
function AvailableInventoryPopoverContent({ detail }: { detail?: Record<string, unknown> | null }) {
  const bd = detail?.inventory_breakdown as Record<string, unknown> | undefined
  const supply = detail?.supply_calculation as { lines_zh?: string[] } | undefined
  const lines = supply?.lines_zh?.length ? supply.lines_zh : []

  if (!bd && lines.length === 0) {
    return (
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        暂无明细。请重新执行计算后查看；历史结果可能无仓库拆分数据。
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
          <Typography.Text strong>库存构成（与「可用库存」列一致）</Typography.Text>
          <div style={{ marginTop: 8 }}>
            {mainBatch != null ? (
              <div style={{ marginBottom: 8 }}>
                <div>
                  {mainBatch.label ?? '主仓批次'}：
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
                线边范围：{scopeZh}
              </Typography.Paragraph>
            ) : null}
            {lineRows.length > 0 ? (
              <Table
                size="small"
                pagination={false}
                rowKey={(r) => String(r.warehouse_id)}
                columns={[
                  { title: '仓库', dataIndex: 'warehouse_name', width: 120, ellipsis: true },
                  {
                    title: '现存量',
                    dataIndex: 'quantity',
                    width: 72,
                    align: 'right' as const,
                    render: (n: unknown) => Number(n ?? 0).toLocaleString(),
                  },
                  {
                    title: '预留',
                    dataIndex: 'reserved',
                    width: 60,
                    align: 'right' as const,
                    render: (n: unknown) => Number(n ?? 0).toLocaleString(),
                  },
                  {
                    title: '可用',
                    dataIndex: 'available',
                    width: 72,
                    align: 'right' as const,
                    render: (n: unknown) => Number(n ?? 0).toLocaleString(),
                  },
                ]}
                dataSource={lineRows}
              />
            ) : (
              <Typography.Text type="secondary">无线边仓明细行（未纳入线边或数量为 0）</Typography.Text>
            )}
            {formulaZh.length > 0 ? (
              <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: 'rgba(0,0,0,0.55)' }}>
                {formulaZh.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </>
      ) : null}

      {lines.length > 0 ? (
        <>
          <Divider style={{ margin: '12px 0 8px' }} />
          <Typography.Text strong>净需求如何算出</Typography.Text>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: 'rgba(0,0,0,0.55)' }}>
            {lines.map((t, i) => (
              <li key={i}>{t}</li>
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
        按物料指定 BOM 版本
      </Typography.Title>
      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: token.marginSM, fontSize: token.fontSizeSM }}>
        留空则使用该物料默认版本
      </Typography.Text>
      <div style={{ overflowX: 'auto' }}>
        <Table
          size="small"
          dataSource={materials}
          rowKey="material_id"
          pagination={false}
          scroll={{ x: 'max-content' }}
          columns={[
            { title: '物料编号', dataIndex: 'material_code', width: 120 },
            { title: '物料名称', dataIndex: 'material_name', width: 150 },
            {
              title: 'BOM 版本',
              dataIndex: 'material_id',
              render: (materialId: number, record: MaterialInfo) => {
                const versions = record.bomVersions || []
                const currentVal = materialBomVersions[materialId] ?? ''
                if (versions.length > 1) {
                  return (
                    <Select
                      placeholder="选择版本"
                      value={currentVal || undefined}
                      onChange={v => handleMaterialVersionChange(materialId, v || '')}
                      allowClear
                      style={{ width: 140 }}
                      options={versions.map(v => ({
                        value: v.version,
                        label: v.isDefault ? `${v.version}（默认）` : v.version,
                      }))}
                    />
                  )
                }
                return (
                  <Input
                    placeholder="如 1.0、1.1"
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
                {useGrossSuggestion ? '建议量规则' : '供需净算'}
              </Typography.Title>
              {!useGrossSuggestion ? (
                <div style={{ display: 'grid', gap: token.marginXS }}>
                  {switchRow('考虑安全库存', 'include_safety_stock', params.include_safety_stock !== false)}
                  {switchRow('考虑在途/在制', 'include_in_transit', params.include_in_transit === true)}
                  {switchRow('考虑预留量', 'include_reserved', params.include_reserved === true)}
                  {switchRow('考虑再订货点', 'include_reorder_point', params.include_reorder_point === true)}
                </div>
              ) : (
                <Typography.Paragraph
                  type="secondary"
                  style={{ marginBottom: token.marginSM, marginTop: 0, fontSize: token.fontSizeSM }}
                >
                  当前为「毛需求」：建议工单/采购/委外量按 BOM 汇总需求，不参与安全库存、在途、预留、再订货点等供需抵扣参数（本组开关已隐藏并关闭）。
                </Typography.Paragraph>
              )}
              <div style={{ display: 'grid', gap: token.marginXS }}>
                {switchRow('建议量按批量规则（最小/倍数/上限）', 'apply_lot_sizing', params.apply_lot_sizing !== false)}
              </div>
            </div>
            <div style={sectionBox}>
              <Typography.Title level={5} style={{ marginTop: 0, marginBottom: token.marginSM }}>
                时间窗
              </Typography.Title>
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12}>
                  {fieldLabel('计划展望期')}
                  <InputNumber
                    min={1}
                    max={3650}
                    style={{ width: '100%' }}
                    placeholder="不填表示纳入全部有交期的需求行"
                    value={params.planning_horizon}
                    onChange={v => handleChange('planning_horizon', v === null ? undefined : v)}
                  />
                </Col>
                <Col xs={24} sm={12}>
                  {fieldLabel('排程缓冲天数')}
                  <InputNumber
                    min={0}
                    max={365}
                    style={{ width: '100%' }}
                    placeholder="0 表示仅用物料来源提前期"
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
              仓库与 BOM
            </Typography.Title>
            <div style={{ display: 'flex', flexDirection: 'column', gap: token.marginSM }}>
              <div>
                {fieldLabel('参与计算的仓库')}
                <Select
                  mode="multiple"
                  allowClear
                  placeholder="默认已选全部普通仓，可增选其他仓"
                  style={{ width: '100%' }}
                  options={warehouseOptions}
                  value={whValue}
                  onChange={ids => handleChange('warehouse_ids', ids)}
                />
              </div>
              {bomMultiVersionAllowed && materials.length === 0 && (
                <div>
                  {fieldLabel('全局 BOM 版本')}
                  <Input
                    placeholder="留空使用各物料默认版本"
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
  const pullFromDemandAction = getKuaizhizaoDocumentAction('demand_computation.pull_from_demand')
  const queryClient = useQueryClient()
  const location = useLocation()
  const actionRef = useRef<ActionType>(null)
  const formRef = useRef<any>(null)

  const invalidateStatistics = () => {
    queryClient.invalidateQueries({ queryKey: ['demandComputationStatistics'] })
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

  // Modal 相关状态（新建计算）
  const [modalVisible, setModalVisible] = useState(false)
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [selectedDemandIds, setSelectedDemandIds] = useState<number[]>([])
  const [pullFromDemandVisible, setPullFromDemandVisible] = useState(false)
  const [pullDemandLoading, setPullDemandLoading] = useState(false)
  const [pullDemandSubmitting, setPullDemandSubmitting] = useState(false)
  const [pullDemandKeyword, setPullDemandKeyword] = useState('')
  const [pullDemandCandidates, setPullDemandCandidates] = useState<PullDemandCandidate[]>([])
  const [selectedPullDemandId, setSelectedPullDemandId] = useState<number | null>(null)

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
          .catch(() => messageApi.error('获取下推记录失败'))
          .finally(() => setPushRecordsLoading(false)),
        listComputationRecalcHistory(computationId, { limit: 50 })
          .then(setComputationRecalcHistory)
          .catch(() => messageApi.error('获取重算历史失败'))
          .finally(() => setRecalcHistoryLoading(false)),
      ])
    },
    [messageApi],
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
        messageApi.error('获取重算前快照失败')
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

  /** 下推面板：打开时加载 options，初始化 config */
  React.useEffect(() => {
    if (!pushPanelRecord) return
    const load = async () => {
      setPushPanelLoading(true)
      try {
        const opts = await getPushOptions(pushPanelRecord.id!)
        setPushOptions(opts)
        setPushConfig({
          production: opts.production_choices.length > 0 ? 'work_order' : undefined,
          purchase: opts.purchase_choices.length > 0 ? opts.default_purchase : undefined,
        })
      } catch (e) {
        messageApi.error('加载下推配置失败')
      } finally {
        setPushPanelLoading(false)
      }
    }
    load()
  }, [pushPanelRecord?.id])

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
        messageApi.info('暂无已审核通过的需求，请先在需求管理中提交并审核需求')
      }
    } catch (error: any) {
      messageApi.error('加载需求列表失败')
    }
  }

  const loadPullDemandCandidates = useCallback(async (keyword: string = '') => {
    setPullDemandLoading(true)
    try {
      const kw = keyword.trim().toLowerCase()
      const demandsRes = await listDemands({
        status: DemandStatus.AUDITED,
        review_status: ReviewStatus.APPROVED,
        pushed_to_computation: false,
        limit: 200,
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
      setPullDemandCandidates(rows)
    } finally {
      setPullDemandLoading(false)
    }
  }, [])

  const handlePullFromDemand = useCallback(async () => {
    setPullFromDemandVisible(true)
    setPullDemandKeyword('')
    setSelectedPullDemandId(null)
    await loadPullDemandCandidates('')
  }, [loadPullDemandCandidates])

  const handlePullFromDemandConfirm = useCallback(async () => {
    if (!selectedPullDemandId) {
      messageApi.warning(`请选择${pullFromDemandAction.sourceLabel}`)
      return
    }
    const selected = pullDemandCandidates.find((i) => i.id === selectedPullDemandId)
    if (selected?.pushed_to_computation) {
      messageApi.warning(`该${pullFromDemandAction.sourceLabel}已下推过${pullFromDemandAction.targetLabel}，请勿重复创建`)
      return
    }
    setPullDemandSubmitting(true)
    try {
      const res = await pushDemandToComputation(selectedPullDemandId)
      messageApi.success(res?.computation_code ? `已创建${pullFromDemandAction.targetLabel}：${res.computation_code}` : `已从${pullFromDemandAction.sourceLabel}创建${pullFromDemandAction.targetLabel}`)
      setPullFromDemandVisible(false)
      setSelectedPullDemandId(null)
      invalidateStatistics()
      actionRef.current?.reload()
    } catch (error: any) {
      messageApi.error(error?.response?.data?.detail || `从${pullFromDemandAction.sourceLabel}创建${pullFromDemandAction.targetLabel}失败`)
    } finally {
      setPullDemandSubmitting(false)
    }
  }, [actionRef, messageApi, pullDemandCandidates, selectedPullDemandId])

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
        messageApi.error('获取计算详情失败')
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
      messageApi.error(error?.response?.data?.detail || '计算预览失败')
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
      messageApi.success('计算执行成功')
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
      messageApi.error(error?.response?.data?.detail || '计算执行失败')
    } finally {
      setExecuteLoading(false)
    }
  }

  /**
   * 处理重新计算（仅对已完成或失败的计算）
   */
  const handleRecompute = async (record: DemandComputation) => {
    modalApi.confirm({
      title: '重新计算',
      content: `确认要对计算 ${record.computation_code} 重新执行吗？将清空当前结果并按原需求重新计算。`,
      onOk: async () => {
        try {
          await recomputeDemandComputation(record.id!)
          messageApi.success('重新计算已提交，请稍后刷新查看结果')
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
          messageApi.error(error?.response?.data?.detail || '重新计算失败')
        }
      },
    })
  }

  /**
   * 处理删除需求计算
   */
  const handleDelete = async (record: DemandComputation) => {
    modalApi.confirm({
      title: '删除需求计算',
      content: `确定要删除计算 ${record.computation_code} 吗？仅当尚未下推工单/采购单等下游单据时可删除，删除后关联需求可重新下推计算。`,
      okText: '删除',
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteDemandComputation(record.id!)
          messageApi.success('删除成功')
          invalidateStatistics(); actionRef.current?.reload()
        } catch (error: any) {
          messageApi.error(error?.response?.data?.detail || '删除失败')
        }
      },
    })
  }

  /** 打开下推面板 */
  const handleOpenPushPanel = (record: DemandComputation) => {
    setPushPanelRecord(record)
    setPushPreviewData(null)
  }

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
        messageApi.success('下推完成')
      } else {
        messageApi.warning('请至少选择一项下推内容')
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
      messageApi.error(e?.response?.data?.detail || '下推失败')
    } finally {
      setPushPanelSubmitting(false)
    }
  }


  /**
   * 表格列定义
   */
  const columns: ProColumns<DemandComputation>[] = [
    {
      title: '计算编号',
      dataIndex: 'computation_code',
      width: 168,
      fixed: 'left',
      hideInSearch: false,
      render: (_: unknown, record: DemandComputation) => (
        <Space size={4} wrap={false} style={{ whiteSpace: 'nowrap' }}>
          <span style={{ whiteSpace: 'nowrap' }}>{record.computation_code ?? '-'}</span>
          {record.computation_code ? (
            <Tooltip title="复制">
              <Button
                type="link"
                size="small"
                icon={<CopyOutlined style={{ fontSize: 12 }} />}
                onClick={e => {
                  e.stopPropagation()
                  void navigator.clipboard.writeText(record.computation_code!).then(
                    () => messageApi.success('已复制'),
                    () => messageApi.error('复制失败')
                  )
                }}
              />
            </Tooltip>
          ) : null}
        </Space>
      ),
    },
    {
      title: '来源单号',
      dataIndex: 'demand_code',
      width: 168,
      hideInSearch: false,
      render: (_: unknown, record: DemandComputation) => (
        <Space size={4}>
          <span>{record.demand_code ?? '-'}</span>
          {record.demand_code ? (
            <Tooltip title="复制">
              <Button
                type="link"
                size="small"
                icon={<CopyOutlined style={{ fontSize: 12 }} />}
                onClick={e => {
                  e.stopPropagation()
                  void navigator.clipboard.writeText(record.demand_code!).then(
                    () => messageApi.success('已复制'),
                    () => messageApi.error('复制失败')
                  )
                }}
              />
            </Tooltip>
          ) : null}
        </Space>
      ),
    },
    {
      title: '物料概看',
      dataIndex: 'computation_summary',
      width: 180,
      hideInSearch: true,
      render: (_, record) => {
        const summary = record.computation_summary || {}
        const shortage = summary.shortage_count || 0
        const risk = summary.risk_count || 0
        const total = summary.item_count || 0

        if (total === 0 && record.computation_status !== '完成') return '-'
        if (total === 0 && record.computation_status === '完成')
          return <span style={{ color: '#999' }}>无物料需求</span>

        return (
          <Space size={4}>
            {shortage > 0 ? (
              <Tag color="error">缺料 {shortage}</Tag>
            ) : (
              <Tag color="success">无缺料</Tag>
            )}
            {risk > 0 && <Tag color="warning">风险 {risk}</Tag>}
          </Space>
        )
      },
    },
    {
      title: '来源类型',
      dataIndex: 'demand_type',
      width: 110,
      valueType: 'select',
      valueEnum: {
        sales_forecast: { text: '销售预测', status: 'Processing' },
        sales_order: { text: '销售订单', status: 'Success' },
        demand_plan: { text: '需求计划', status: 'Warning' },
      },
      hideInSearch: false,
      render: (_, record) => (
        <Tag {...getDemandTypeTagProps(record.demand_type)}>
          {getDemandTypeLabel(record.demand_type)}
        </Tag>
      ),
    },
    {
      title: '业务模式',
      dataIndex: 'business_mode',
      width: 100,
      valueType: 'select',
      valueEnum: {
        MTS: { text: '按库存生产', status: 'Processing' },
        MTO: { text: '按订单生产', status: 'Success' },
        ATO: { text: '按订单组装 (ATO)', status: 'Warning' },
      },
      hideInSearch: false,
      render: (_, record) => (
        <Tag color={getDemandBusinessModeTagColor(record.business_mode)}>
          {getDemandBusinessModeLabel(record.business_mode)}
        </Tag>
      ),
    },
    {
      title: '开始时间',
      dataIndex: 'computation_start_time',
      width: 160,
      hideInSearch: false,
      render: (_, record) => formatDateTimeBySiteSetting(record.computation_start_time),
    },
    {
      title: '结束时间',
      dataIndex: 'computation_end_time',
      width: 160,
      hideInTable: false,
      hideInSearch: true,
      render: (_, record) => formatDateTimeBySiteSetting(record.computation_end_time),
    },
    {
      title: '生命周期',
      dataIndex: 'lifecycle',
      width: 132,
      fixed: 'right',
      align: 'center',
      hideInSearch: false,
      valueType: 'select',
      valueEnum: {
        进行中: { text: '进行中' },
        计算中: { text: '计算中' },
        完成: { text: '完成' },
        失败: { text: '失败' },
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
      title: '操作',
      key: 'option',
      valueType: 'option',
      width: 200,
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => {
        const canExecute = record.computation_status === '进行中'
        const canRecompute =
          record.computation_status === '完成' || record.computation_status === '失败'
        const parts: React.ReactNode[] = [
          <Button key="d" type="link" size="small" icon={<EyeOutlined />} onClick={() => handleDetail([record.id!])}>
            详情
          </Button>,
        ]
        if (canExecute) {
          parts.push(
            <Button key="ex" type="link" size="small" icon={<PlayCircleOutlined />} onClick={() => handleExecute(record)}>
              执行计算
            </Button>
          )
        }
        if (canRecompute) {
          parts.push(
            <Button key="rc" type="link" size="small" icon={<ReloadOutlined />} onClick={() => handleRecompute(record)}>
              重新计算
            </Button>
          )
        }
        if (record.computation_status === '完成') {
          parts.push(
            <Button key="pu" type="link" size="small" icon={<ArrowDownOutlined />} onClick={() => handleOpenPushPanel(record)}>
              下推
            </Button>
          )
        }
        parts.push(
          <Button key="del" type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)}>
            删除
          </Button>
        )
        return renderDemandComputationRowActions(parts, `dc-${record.id ?? 'row'}`)
      },
    },
  ]

  const statCards: StatCard[] = statistics
    ? [
        { title: '总计算数', value: statistics.total_count },
        { title: '进行中', value: statistics.pending_count, valueStyle: statistics.pending_count > 0 ? { color: '#faad14' } : undefined },
        { title: '已完成', value: statistics.completed_count },
        {
          title: '物料/交期风险',
          value: statistics.risk_count || 0,
          valueStyle:
            (statistics.risk_count || 0) > 0 ? { color: '#ff4d4f' } : undefined,
          prefix: <WarningOutlined />,
        },
      ]
    : [
        { title: '总计算数', value: 0 },
        { title: '进行中', value: 0 },
        { title: '已完成', value: 0 },
        {
          title: '物料/交期风险',
          value: 0,
          prefix: <WarningOutlined />,
        },
      ]

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
                apiParams.start_date = dayjs(searchFormValues.computation_start_time[0]).format(
                  'YYYY-MM-DD'
                )
              }
              if (searchFormValues.computation_start_time[1]) {
                apiParams.end_date = dayjs(searchFormValues.computation_start_time[1]).format(
                  'YYYY-MM-DD'
                )
              }
            } else if (searchFormValues.computation_start_time) {
              // 单个日期值
              apiParams.start_date = dayjs(searchFormValues.computation_start_time).format(
                'YYYY-MM-DD'
              )
            }
          }

          const result = await listDemandComputations(apiParams)
          return {
            data: result.data || [],
            success: result.success,
            total: result.total || 0,
          }
        }}
        rowKey="id"
        enableRowSelection={true}
        showDeleteButton={true}
        onDelete={async (keys) => {
          modalApi.confirm({
            title: '批量删除需求计算',
            content: `确定要删除选中的 ${keys.length} 条需求计算吗？仅当尚未下推工单/采购单等下游单据时可删除。`,
            okText: '删除',
            okType: 'danger',
            onOk: async () => {
              try {
                for (const id of keys) {
                  await deleteDemandComputation(Number(id))
                }
                messageApi.success(`成功删除 ${keys.length} 条记录`)
                invalidateStatistics()
                actionRef.current?.reload()
              } catch (error: any) {
                messageApi.error(error?.response?.data?.detail || '删除失败')
              }
            },
          })
        }}
        search={{
          labelWidth: 'auto',
        }}
        showCreateButton={false}
        createButtonText="新建需求计算"
        onCreate={handleCreate}
        toolBarRender={() => [
          <UniPullCreateToolbar
            compactKey="create-demand-computation-with-pull"
            createIcon={<PlayCircleOutlined />}
            createLabel="新建需求计算"
            onCreate={() => {
              void handleCreate()
            }}
            menuItems={buildKuaizhizaoPullCreateMenuItems([
              {
                key: 'pull-from-demand',
                actionKey: 'demand_computation.pull_from_demand',
                onClick: () => {
                  void handlePullFromDemand()
                },
              },
            ])}
          />,
        ]}
        toolBarActionsAfterDelete={[<MrpParametersCustomerGuideTrigger key="mrp-params-guide" size="small" />]}
      />

      <Modal
        title={pullFromDemandAction.label}
        open={pullFromDemandVisible}
        width={1200}
        onCancel={() => {
          if (pullDemandSubmitting) return
          setPullFromDemandVisible(false)
          setSelectedPullDemandId(null)
        }}
        onOk={() => {
          void handlePullFromDemandConfirm()
        }}
        okText="创建需求运算"
        confirmLoading={pullDemandSubmitting}
        destroyOnClose
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Input.Search
            allowClear
            placeholder="按需求单号/需求名称搜索"
            value={pullDemandKeyword}
            onChange={(e) => setPullDemandKeyword(e.target.value)}
            onSearch={(value) => {
              setPullDemandKeyword(value)
              void loadPullDemandCandidates(value)
            }}
            enterButton="搜索"
          />
          <Table<PullDemandCandidate>
            rowKey="id"
            loading={pullDemandLoading}
            dataSource={pullDemandCandidates}
            pagination={false}
            scroll={{ x: 1080, y: 360 }}
            rowSelection={{
              type: 'radio',
              selectedRowKeys: selectedPullDemandId ? [selectedPullDemandId] : [],
              onChange: (keys) => {
                const next = Number(keys?.[0])
                if (Number.isFinite(next)) setSelectedPullDemandId(next)
                else setSelectedPullDemandId(null)
              },
              getCheckboxProps: (record) => ({ disabled: !!record.pushed_to_computation }),
            }}
            onRow={(record) => ({
              onClick: () => {
                if (record.pushed_to_computation) return
                setSelectedPullDemandId(record.id)
              },
            })}
            columns={[
              { title: '需求单号', dataIndex: 'demand_code', width: 180, ellipsis: true },
              { title: '需求名称', dataIndex: 'demand_name', width: 220, ellipsis: true },
              { title: '需求类型', dataIndex: 'demand_type', width: 130, align: 'center' },
              { title: '业务模式', dataIndex: 'business_mode', width: 110, align: 'center' },
              { title: '状态', dataIndex: 'status', width: 120, align: 'center' },
              {
                title: '更新时间',
                dataIndex: 'updated_at',
                width: 180,
                render: (v) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-'),
              },
              {
                title: '转单状态',
                key: 'convert_status',
                width: 150,
                align: 'center',
                render: (_, r) =>
                  r.pushed_to_computation ? <Tag color="gold">已下推</Tag> : <Tag color="success">可创建</Tag>,
              },
            ]}
          />
        </Space>
      </Modal>

      {/* 新建计算：FormModalTemplate（UI_Standard 新建/编辑 Modal） */}
      <FormModalTemplate
        title="新建需求计算"
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
            messageApi.error('请至少选择一个需求')
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
            messageApi.success(`创建成功，已合并 ${selectedDemandIds.length} 个需求`)
            setModalVisible(false)
            invalidateStatistics(); actionRef.current?.reload()
          } catch (error: any) {
            messageApi.error(error?.response?.data?.detail || '创建失败')
          } finally {
            setCreateSubmitting(false)
          }
        }}
      >
        <ProFormSelect
          name="demand_ids"
          label="选择需求（可多选）"
          mode="multiple"
          options={demandList.map(d => ({
            label: `${d.demand_code} - ${d.demand_name || ''} (${getDemandBusinessModeLabel(d.business_mode)})`,
            value: d.id,
          }))}
          fieldProps={{
            onChange: (value: number[]) => setSelectedDemandIds(value),
            placeholder: '支持多选需求合并计算',
          }}
          rules={[{ required: true, message: '请至少选择一个需求' }]}
          tooltip="多需求合并时，相同物料的需求数量会自动汇总；含 MTO 时计算头为 MTO，否则含 ATO 时为 ATO，否则为 MTS"
        />
        <ProForm.Item
          name="computation_params"
          label={
            <Space align="center" wrap size={8}>
              <span>计算参数</span>
              <ProFormDependency name={['computation_params']}>
                {({ computation_params: cp }) => {
                  const cur = cp || {}
                  const segVal = cur.mrp_suggestion_basis === 'gross' ? 'gross' : 'net'
                  return (
                    <ThemedSegmented
                      size="small"
                      options={MRP_SUGGESTION_SEGMENTED_OPTIONS}
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
        <ProFormTextArea name="notes" label="备注" placeholder="请输入备注" />
      </FormModalTemplate>

      {/* 单一下推面板 Modal */}
      <Modal
        open={!!pushPanelRecord}
        title={`下推单据 - ${pushPanelRecord?.computation_code || ''}`}
        width={MODAL_CONFIG.SMALL_WIDTH}
        okText="确认下推"
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
          <div style={{ padding: 24, textAlign: 'center' }}>加载中...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {pushOptions && (
              <>
                {pushOptions.production_choices.length > 0 && (
                  <div>
                    <div style={{ fontWeight: 'bold', marginBottom: 8 }}>生产路径</div>
                    <div style={{ color: '#666' }}>直接生成工单（与委外工单）</div>
                  </div>
                )}
                {pushOptions.purchase_choices.length > 0 && (
                  <div>
                    <div style={{ fontWeight: 'bold', marginBottom: 8 }}>采购路径</div>
                    <Radio.Group
                      value={pushConfig.purchase}
                      onChange={e => setPushConfig(c => ({ ...c, purchase: e.target.value }))}
                    >
                      <Radio value="requisition">转采购申请</Radio>
                      <Radio value="purchase_order">仅采购单</Radio>
                    </Radio.Group>
                  </div>
                )}
                <p style={{ fontSize: 12, color: '#666' }}>
                  委外工单将一并下推，验证失败的将生成草稿单由下游补全。
                </p>
              </>
            )}
            {pushPreviewData && (
              <div>
                <p style={{ marginBottom: 12 }}>将生成以下单据：</p>
                <ul style={{ marginBottom: 12, paddingLeft: 20 }}>
                  {pushPreviewData.work_order_count > 0 && (
                    <li>生产工单 {pushPreviewData.work_order_count} 个</li>
                  )}
                  {pushPreviewData.outsource_work_order_count > 0 && (
                    <li>
                      委外工单 {pushPreviewData.outsource_work_order_count} 个
                      {pushPreviewData.validation_failures?.length ? '（含草稿，请下游补全）' : ''}
                    </li>
                  )}
                  {pushPreviewData.purchase_requisition_count > 0 && (
                    <li>采购申请 {pushPreviewData.purchase_requisition_count} 个</li>
                  )}
                  {pushPreviewData.purchase_order_count > 0 && (
                    <li>采购单 {pushPreviewData.purchase_order_count} 个</li>
                  )}
                </ul>
                {pushPreviewData.validation_failures && pushPreviewData.validation_failures.length > 0 && (
                  <div style={{ marginTop: 12, padding: 12, background: '#fff7e6', borderRadius: 4 }}>
                    <div style={{ fontWeight: 'bold', marginBottom: 8 }}>验证失败的物料（将生成草稿单）：</div>
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
        title="执行计算"
        width={MODAL_CONFIG.LARGE_WIDTH}
        okText="执行计算"
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
                确认执行前请核对关联需求与计算编号。
              </Typography.Text>
              <ProDescriptions<DemandComputation>
                column={2}
                size="small"
                bordered
                dataSource={executeRecord}
                columns={[
                  { title: '计算编号', dataIndex: 'computation_code' },
                  { title: '来源单号', dataIndex: 'demand_code' },
                  {
                    title: '计算类型',
                    dataIndex: 'computation_type',
                    render: () => '物料需求计划 (MRP)',
                  },
                  {
                    title: '业务模式',
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
                  计算参数
                </Typography.Title>
                <ThemedSegmented
                  size="small"
                  options={MRP_SUGGESTION_SEGMENTED_OPTIONS}
                  value={executeParams.mrp_suggestion_basis === 'gross' ? 'gross' : 'net'}
                  onChange={val =>
                    setExecuteParams(p => mergeComputationParamsForSuggestionBasis(p, val as 'net' | 'gross'))
                  }
                />
              </div>
              <Typography.Paragraph type="secondary" style={{ marginBottom: token.marginMD, fontSize: token.fontSizeSM }}>
                以下设置仅作用于本次执行，不会写回需求计算单据的已保存参数。
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
        title="计算结果预览 - 请确认"
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
        styles={{
          container: {
            width: MODAL_CONFIG.EXTRA_LARGE_WIDTH,
            maxWidth: 'calc(100vw - 32px)',
          },
        }}
        okText="确认执行"
        cancelText="取消"
        confirmLoading={executeLoading}
        onOk={handleConfirmExecute}
      >
        {previewData && (
          <>
            <p style={{ marginBottom: 12 }}>
              预计将生成 <strong>{previewData.item_count}</strong> 条计算结果，请确认后执行。
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
                showTotal: (t) => `共 ${t} 条`,
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
                { title: '物料编号', dataIndex: 'material_code', width: 120 },
                { title: '物料名称', dataIndex: 'material_name', width: 150 },
                {
                  title: '单位',
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
                  title: '需求时间',
                  dataIndex: 'delivery_date',
                  width: 110,
                  render: (v: string | null | undefined) => formatDateBySiteSetting(v),
                },
                {
                  title: '计划时间',
                  dataIndex: 'planned_date',
                  width: 110,
                  render: (v: string | null | undefined) => formatDateBySiteSetting(v),
                },
                {
                  title: '需求数量',
                  dataIndex: 'required_quantity',
                  width: 90,
                  render: (v: number) => (v ? Number(v).toLocaleString() : '-'),
                },
                {
                  title: '可用库存',
                  dataIndex: 'available_inventory',
                  width: 90,
                  align: 'right' as const,
                  render: (v: number, r) =>
                    renderAvailableInventoryCell(v, r.detail_results as Record<string, unknown> | undefined),
                },
                {
                  title: '净需求',
                  dataIndex: 'net_requirement',
                  width: 90,
                  render: (v: number) => (v ? Number(v).toLocaleString() : '-'),
                },
                {
                  title: '建议工单',
                  dataIndex: 'suggested_work_order_quantity',
                  width: 90,
                  render: (v: number, r: any) =>
                    r.material_source_type === 'Outsource' ? '-' : (v ? Number(v).toLocaleString() : '-'),
                },
                {
                  title: '建议委外',
                  dataIndex: 'suggested_work_order_quantity',
                  width: 90,
                  render: (v: number, r: any) =>
                    r.material_source_type === 'Outsource' ? (v ? Number(v).toLocaleString() : '-') : '-',
                },
                {
                  title: '建议采购',
                  dataIndex: 'suggested_purchase_order_quantity',
                  width: 90,
                  render: (v: number) => (v ? Number(v).toLocaleString() : '-'),
                },
                {
                  title: '来源',
                  dataIndex: 'material_source_type',
                  width: 80,
                  render: (t: string) => {
                    const map: Record<string, string> = {
                      Make: '自制',
                      Buy: '采购',
                      Phantom: '虚拟',
                      Outsource: '委外',
                      Configure: '配置',
                    }
                    return map[t] || t || '-'
                  },
                },
              ]}
            />
          </>
        )}
      </Modal>

      <Modal
        title="重算前快照"
        open={recalcSnapshotModalOpen}
        zIndex={token.zIndexPopupBase + 80}
        onCancel={() => {
          setRecalcSnapshotModalOpen(false)
          setRecalcSnapshotModalData(null)
        }}
        footer={null}
        width={720}
        destroyOnClose
      >
        {recalcSnapshotModalLoading ? (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <Spin />
          </div>
        ) : recalcSnapshotModalData ? (
          <div style={{ maxHeight: '70vh', overflow: 'auto' }}>
            {recalcSnapshotModalData.snapshot_at ? (
              <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
                快照时间：{recalcSnapshotModalData.snapshot_at}
                {recalcSnapshotModalData.trigger ? ` · 触发：${recalcSnapshotModalData.trigger}` : null}
              </Typography.Paragraph>
            ) : null}
            {recalcSnapshotModalData.computation_summary_snapshot ? (
              <div style={{ marginBottom: 16 }}>
                <Typography.Text strong>计算汇总</Typography.Text>
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
                <Typography.Text strong>明细（重算前节选）</Typography.Text>
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
              <Typography.Text type="secondary">无快照内容</Typography.Text>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <DetailDrawerTemplate
        title={
          currentComputation?.computation_code ? (
            <Space align="center" size={8}>
              <span>{`计算详情 - ${currentComputation.computation_code}`}</span>
              <Tooltip title={t('field.invitationCode.copy', { defaultValue: '复制' })}>
                <Button
                  type="text"
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(currentComputation.computation_code!)
                      .then(() => messageApi.success('已复制'), () => messageApi.error('复制失败'))
                  }
                />
              </Tooltip>
            </Space>
          ) : (
            '计算详情'
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
        traceDocument={
          drawerVisible && detailTabKey === 'detail' && currentComputation?.id != null
            ? {
                documentType: 'demand_computation',
                documentId: currentComputation.id,
                selfDocumentId: currentComputation.id,
                renderBriefActions: (doc) => (
                  <WarehouseTraceBriefPrimaryActions
                    doc={doc}
                    t={t}
                    navigate={navigate}
                    closeDrawer={() => {
                      setDrawerVisible(false)
                    }}
                  />
                ),
              }
            : null
        }
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
                label: '详情',
                children: (
                  <>
                    <DetailDrawerSection title={t('app.uniDetail.sectionBasic', { defaultValue: '基本信息' })}>
                      <Descriptions
                        column={3}
                        size="small"
                        items={[
                          {
                            key: 'code',
                            label: '计算编号',
                            children: (
                              <Space size={4}>
                                <span>{currentComputation.computation_code ?? '—'}</span>
                                {currentComputation.computation_code ? (
                                  <Tooltip title="复制">
                                    <Button
                                      type="link"
                                      size="small"
                                      icon={<CopyOutlined style={{ fontSize: 12 }} />}
                                      onClick={() =>
                                        void navigator.clipboard
                                          .writeText(currentComputation.computation_code!)
                                          .then(() => messageApi.success('已复制'), () => messageApi.error('复制失败'))
                                      }
                                    />
                                  </Tooltip>
                                ) : null}
                              </Space>
                            ),
                          },
                          {
                            key: 'demand',
                            label: '来源单号',
                            children: (
                              <Space size={4}>
                                <span>{currentComputation.demand_code ?? '—'}</span>
                                {currentComputation.demand_code ? (
                                  <Tooltip title="复制">
                                    <Button
                                      type="link"
                                      size="small"
                                      icon={<CopyOutlined style={{ fontSize: 12 }} />}
                                      onClick={() =>
                                        void navigator.clipboard
                                          .writeText(currentComputation.demand_code!)
                                          .then(() => messageApi.success('已复制'), () => messageApi.error('复制失败'))
                                      }
                                    />
                                  </Tooltip>
                                ) : null}
                              </Space>
                            ),
                          },
                          {
                            key: 'ctype',
                            label: '计算类型',
                            children: '物料需求计划 (MRP)',
                          },
                          {
                            key: 'bm',
                            label: '业务模式',
                            children: getDemandBusinessModeLabel(currentComputation.business_mode),
                          },
                          {
                            key: 'dtype',
                            label: '来源类型',
                            children: (
                              <Tag {...getDemandTypeTagProps(currentComputation.demand_type)}>
                                {getDemandTypeLabel(currentComputation.demand_type)}
                              </Tag>
                            ),
                          },
                          {
                            key: 'st',
                            label: '计算状态',
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
                            label: '开始时间',
                            children: formatDateTimeBySiteSetting(currentComputation.computation_start_time) || '—',
                          },
                          {
                            key: 't2',
                            label: '结束时间',
                            span: validationResults ? 1 : 2,
                            children: formatDateTimeBySiteSetting(currentComputation.computation_end_time) || '—',
                          },
                          ...(validationResults
                            ? [
                                {
                                  key: 'v0',
                                  label: '来源验证',
                                  children: (
                                    <Tag color={validationResults.all_passed ? 'success' : 'error'}>
                                      {validationResults.all_passed ? '全部通过' : '存在失败'}
                                    </Tag>
                                  ),
                                },
                                {
                                  key: 'v1',
                                  label: '验证通过/失败/总数',
                                  span: 3,
                                  children: `${validationResults.passed_count ?? 0} / ${validationResults.failed_count ?? 0} / ${validationResults.total_count ?? 0}`,
                                },
                              ]
                            : []),
                          {
                            key: 'notes',
                            label: '备注',
                            span: 3,
                            children: normalizeComputationSourceNote(currentComputation) || '—',
                          },
                        ]}
                      />
                      {validationResults && validationResults.failed_count > 0 && (
                        <div style={{ marginTop: 12 }}>
                          <Typography.Text strong type="danger">
                            验证失败的物料
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

                    <DetailDrawerSection title={t('app.uniDetail.sectionCollaboration', { defaultValue: '生命周期' })}>
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
                          <Typography.Text type="secondary">暂无阶段节点数据</Typography.Text>
                        )
                      })()}
                    </DetailDrawerSection>

                    <DetailDrawerSection title={t('app.uniDetail.sectionLines', { defaultValue: '明细信息' })}>
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
                              title: '物料编号',
                              dataIndex: 'material_code',
                              width: 140,
                              render: (code: string) => (
                                <Space size={4}>
                                  <span>{code ?? '—'}</span>
                                  {code ? (
                                    <Tooltip title="复制">
                                      <Button
                                        type="link"
                                        size="small"
                                        icon={<CopyOutlined style={{ fontSize: 12 }} />}
                                        onClick={() =>
                                          void navigator.clipboard
                                            .writeText(code)
                                            .then(() => messageApi.success('已复制'), () => messageApi.error('复制失败'))
                                        }
                                      />
                                    </Tooltip>
                                  ) : null}
                                </Space>
                              ),
                            },
                            { title: '物料名称', dataIndex: 'material_name', width: 200, ellipsis: true },
                            {
                              title: '单位',
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
                            { title: '需求数量', dataIndex: 'required_quantity', width: 96, align: 'right' },
                            {
                              title: '可用库存',
                              dataIndex: 'available_inventory',
                              width: 96,
                              align: 'right' as const,
                              render: (v: number, record: DemandComputationItem) =>
                                renderAvailableInventoryCell(v, record.detail_results as Record<string, unknown> | undefined),
                            },
                            { title: '净需求', dataIndex: 'net_requirement', width: 90, align: 'right', render: (v) => <span style={{ fontWeight: 'bold' }}>{v}</span> },
                            {
                              title: (
                                <Tooltip title="就绪率 = 可用库存 ÷ 毛需求；毛需求很大时，即使有库存也可能显示缺料或比例很小（非即时库存无数据）">
                                  <span>就绪状态</span>
                                </Tooltip>
                              ),
                              dataIndex: 'readiness_status',
                              width: 148,
                              render: (status: string, record: DemandComputationItem) => {
                                const map: Record<string, { label: string; color: string }> = {
                                  Ready: { label: '就绪', color: 'success' },
                                  Partial: { label: '部分', color: 'warning' },
                                  Shortage: { label: '缺料', color: 'error' },
                                }
                                const info = map[status || 'Shortage'] || { label: '未知', color: 'default' }
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
                              title: '物料来源',
                              dataIndex: 'material_source_type',
                              width: 96,
                              render: (type: string) => {
                                const typeMap: Record<string, { label: string; color: string }> = {
                                  Make: { label: '自制', color: 'blue' },
                                  Buy: { label: '采购', color: 'green' },
                                  Phantom: { label: '虚拟', color: 'orange' },
                                  Outsource: { label: '委外', color: 'purple' },
                                  Configure: { label: '配置', color: 'cyan' },
                                }
                                const info = typeMap[type] || { label: type || '未设置', color: 'default' }
                                return <Tag color={info.color}>{info.label}</Tag>
                              },
                            },
                            {
                              title: '交期要求',
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
                                        交期风险
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
                                        · 计划开始 {startDate}
                                      </span>
                                    ) : null}
                                  </div>
                                )
                              },
                            },
                            {
                              title: '建议工单',
                              dataIndex: 'suggested_work_order_quantity',
                              width: 100,
                              align: 'right',
                              render: (v: number, r: DemandComputationItem) =>
                                r.material_source_type === 'Outsource' ? '-' : (v ?? '-'),
                            },
                            {
                              title: '建议委外',
                              dataIndex: 'suggested_work_order_quantity',
                              width: 100,
                              align: 'right',
                              render: (v: number, r: DemandComputationItem) =>
                                r.material_source_type === 'Outsource' ? (v ?? '-') : '-',
                            },
                            {
                              title: '建议采购',
                              dataIndex: 'suggested_purchase_order_quantity',
                              width: 100,
                              align: 'right',
                            },
                            {
                              title: '溯源',
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
                                        title: '需求溯源',
                                        content: (
                                          <div>
                                            <p>此物料需求由以下原始单据触发汇总：</p>
                                            <ul style={{ maxHeight: 300, overflow: 'auto' }}>
                                              {ids.map((id: number, idx: number) => (
                                                <li key={idx}>原始需求明细 ID: {id}</li>
                                              ))}
                                            </ul>
                                            <p style={{ color: '#999', fontSize: 12 }}>
                                              提示：完整溯源功能开发中，将支持点击跳转至对应订单。
                                            </p>
                                          </div>
                                        ),
                                      })
                                    }}
                                  >
                                    溯源
                                  </Button>
                                )
                              },
                            },
                          ]}
                          />
                        </div>
                      ) : (
                        <Empty description="暂无计算明细" />
                      )}
                    </DetailDrawerSection>

                    <DetailDrawerSection title={t('app.uniDetail.sectionTimeline', { defaultValue: '操作记录' })}>
                      {computationTracking.loading ? (
                        <Spin />
                      ) : computationTracking.error ? (
                        <Typography.Text type="danger">{computationTracking.error}</Typography.Text>
                      ) : computationTracking.data ? (
                        <DocumentTrackingTimelineBody data={computationTracking.data} />
                      ) : (
                        <Typography.Text type="secondary">暂无操作记录</Typography.Text>
                      )}
                    </DetailDrawerSection>
                  </>
                ),
              },
              {
                key: 'records',
                label: '下推与历史',
                children: (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div>
                      <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
                        下推记录
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
                            title: '单据类型',
                            dataIndex: 'target_type',
                            width: 112,
                            ellipsis: true,
                            render: (t: string) => {
                              const map: Record<string, string> = {
                                work_order: '工单',
                                outsource_work_order: '委外工单',
                                purchase_order: '采购单',
                                purchase_requisition: '采购申请',
                              }
                              return map[t] || t || '-'
                            },
                          },
                          {
                            title: '单据编号',
                            dataIndex: 'target_code',
                            width: 220,
                            ellipsis: true,
                          },
                          {
                            title: '单据名称',
                            dataIndex: 'target_name',
                            width: 280,
                            ellipsis: true,
                          },
                          {
                            title: '下推时间',
                            dataIndex: 'created_at',
                            width: 176,
                            ellipsis: true,
                            render: (t: string) => (t ? dayjs(t).format('YYYY-MM-DD HH:mm:ss') : '—'),
                          },
                          {
                            title: '状态',
                            dataIndex: 'target_exists',
                            width: 88,
                            render: (exists: boolean) =>
                              exists ? (
                                <Tag color="success">正常</Tag>
                              ) : (
                                <Tag color="default">已删除</Tag>
                              ),
                          },
                        ]}
                        pagination={false}
                      />
                    </div>
                    <Divider style={{ margin: 0 }} />
                    <div>
                      <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
                        重算历史
                      </Typography.Text>
                      <Typography.Paragraph type="secondary" style={{ marginBottom: 8, fontSize: 12 }}>
                        每次重算前会保存计算结果节选；有「重算前快照」时可点击查看详情。
                      </Typography.Paragraph>
                      <Table<ComputationRecalcHistoryItem>
                        size="small"
                        loading={recalcHistoryLoading}
                        dataSource={computationRecalcHistory}
                        rowKey="id"
                        scroll={{ x: 'max-content' }}
                        columns={[
                          { title: '重算时间', dataIndex: 'recalc_at', width: 180, render: (t) => t || '-' },
                          { title: '触发原因', dataIndex: 'trigger', width: 120 },
                          { title: '结果', dataIndex: 'result', width: 80 },
                          {
                            title: '重算前快照',
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
                                  查看
                                </Button>
                              ) : (
                                <span style={{ color: 'var(--ant-color-text-secondary)' }}>—</span>
                              ),
                          },
                          { title: '备注', dataIndex: 'message', ellipsis: true },
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
    { key: 'list', label: '计算列表', children: listTabContent },
    { key: 'history', label: '历史与对比', children: <ComputationHistoryTab /> },
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
