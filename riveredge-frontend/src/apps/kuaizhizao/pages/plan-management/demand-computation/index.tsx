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

import React, { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ActionType,
  ProColumns,
  ProForm,
  ProFormSelect,
  ProFormTextArea,
  ProDescriptions,
} from '@ant-design/pro-components'
import {
  App,
  Button,
  Tag,
  Space,
  Modal,
  Drawer,
  Table,
  Collapse,
  Switch,
  Input,
  Select,
  Tabs,
  Radio,
  Alert,
  Timeline,
  Badge,
  Empty,
  Typography,
} from 'antd'
import {
  PlayCircleOutlined,
  EyeOutlined,
  ReloadOutlined,
  ArrowDownOutlined,
  DeleteOutlined,
  SettingOutlined,
  WarningOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { UniTable } from '../../../../../components/uni-table'
import { UniLifecycleStepper } from '../../../../../components/uni-lifecycle'
import { MultiTabListPageTemplate, DetailDrawerSection, MODAL_CONFIG, type StatCard } from '../../../../../components/layout-templates'
import DocumentTrackingPanel from '../../../../../components/document-tracking-panel'
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
  getComputationDynamicMonitor,
  type PushOptions,
  type PushPreview,
  listComputationRecalcHistory,
  listComputationSnapshots,
  getPushRecords,
  DemandComputation,
  DemandComputationItem,
  ComputationRecalcHistoryItem,
  ComputationSnapshotItem,
  type PushRecordItem,
} from '../../../services/demand-computation'
import { getDemandComputationLifecycle } from '../../../utils/demandComputationLifecycle'
import { listDemands, getDemand, Demand, DemandStatus, ReviewStatus } from '../../../services/demand'
import { getBusinessConfig } from '../../../../../services/businessConfig'
import { bomApi } from '../../../../master-data/services/material'
import { usePageMetrics } from '../../../../../hooks/usePageMetrics'
import ComputationHistoryTab from './ComputationHistoryTab'

const { Panel } = Collapse

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

/** 库存参数开关表单（新建计算/执行计算时使用） */
const InventoryParamsForm: React.FC<{
  value?: Record<string, any>
  onChange?: (v: Record<string, any>) => void
  bomMultiVersionAllowed?: boolean
  materials?: MaterialInfo[]
}> = ({ value, onChange, bomMultiVersionAllowed = false, materials = [] }) => {
  const params = value || {
    include_safety_stock: true,
    include_in_transit: false,
    include_reserved: false,
    include_reorder_point: false,
    bom_version: undefined,
    material_bom_versions: {} as Record<number, string>,
  }
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

  return (
    <Collapse ghost>
      <Panel header="库存计算选项" key="inventory">
        <dl
          style={{ margin: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}
        >
          <dt style={{ margin: 0 }}>是否考虑安全库存</dt>
          <dd style={{ margin: 0 }}>
            <Switch
              checked={params.include_safety_stock !== false}
              onChange={c => handleChange('include_safety_stock', c)}
            />
          </dd>
          <dt style={{ margin: 0 }}>是否考虑在途库存</dt>
          <dd style={{ margin: 0 }}>
            <Switch
              checked={params.include_in_transit === true}
              onChange={c => handleChange('include_in_transit', c)}
            />
          </dd>
          <dt style={{ margin: 0 }}>是否考虑预留量</dt>
          <dd style={{ margin: 0 }}>
            <Switch
              checked={params.include_reserved === true}
              onChange={c => handleChange('include_reserved', c)}
            />
          </dd>
          <dt style={{ margin: 0 }}>是否考虑再订货点</dt>
          <dd style={{ margin: 0 }}>
            <Switch
              checked={params.include_reorder_point === true}
              onChange={c => handleChange('include_reorder_point', c)}
            />
          </dd>
          {bomMultiVersionAllowed && materials.length === 0 && (
            <>
              <dt style={{ margin: 0 }}>BOM 版本</dt>
              <dd style={{ margin: 0 }}>
                <Input
                  placeholder="留空使用各物料默认版本，如 1.0、1.1"
                  value={params.bom_version ?? ''}
                  onChange={e => handleChange('bom_version', e.target.value || undefined)}
                  allowClear
                />
              </dd>
            </>
          )}
        </dl>
        {bomMultiVersionAllowed && materials.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Collapse ghost defaultActiveKey={['materialBom']}>
              <Panel header="按物料指定 BOM 版本（留空自动使用该物料 BOM 默认版本）" key="materialBom">
                <Table
                  size="small"
                  dataSource={materials}
                  rowKey="material_id"
                  pagination={false}
                  columns={[
                    { title: '物料编码', dataIndex: 'material_code', width: 120 },
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
              </Panel>
            </Collapse>
          </div>
        )}
      </Panel>
    </Collapse>
  )
}

const DemandComputationPage: React.FC = () => {
  const { message: messageApi, modal: modalApi } = App.useApp()
  const queryClient = useQueryClient()
  const location = useLocation()
  const navigate = useNavigate()
  const actionRef = useRef<ActionType>(null)
  const formRef = useRef<any>(null)

  const { statCards: pageMetricCards, hasConfig: hasPageMetricConfig } = usePageMetrics()
  const invalidateStatistics = () => {
    queryClient.invalidateQueries({ queryKey: ['demandComputationStatistics'] })
    queryClient.invalidateQueries({ queryKey: ['pageMetrics', location.pathname] })
  }
  const { data: statistics } = useQuery({
    queryKey: ['demandComputationStatistics'],
    queryFn: getDemandComputationStatistics,
    enabled: !hasPageMetricConfig,
  })

  // Modal 相关状态（新建计算）
  const [modalVisible, setModalVisible] = useState(false)
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
      material_code: string
      material_name: string
      material_unit: string
      required_quantity: number
      available_inventory: number
      net_requirement: number
      suggested_work_order_quantity: number
      suggested_purchase_order_quantity: number
      material_source_type?: string
    }>
  } | null>(null)

  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [currentComputation, setCurrentComputation] = useState<DemandComputation | null>(null)
  const [computationRecalcHistory, setComputationRecalcHistory] = useState<ComputationRecalcHistoryItem[]>([])
  const [computationSnapshots, setComputationSnapshots] = useState<ComputationSnapshotItem[]>([])
  const [pushRecords, setPushRecords] = useState<PushRecordItem[]>([])
  const [recalcHistoryLoading, setRecalcHistoryLoading] = useState(false)
  const [snapshotsLoading, setSnapshotsLoading] = useState(false)
  const [dynamicMonitorData, setDynamicMonitorData] = useState<any>(null)
  const [dynamicMonitorLoading, setDynamicMonitorLoading] = useState(false)
  const [pushRecordsLoading, setPushRecordsLoading] = useState(false)
  const [detailTabKey, setDetailTabKey] = useState<string>('detail')

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

  /**
   * 处理详情查看
   */
  const handleDetail = async (keys: React.Key[]) => {
    if (keys.length === 1) {
      const id = Number(keys[0])
      try {
        const data = await getDemandComputation(id, true)
        setCurrentComputation(data)

        // 获取物料来源信息
        try {
          await getMaterialSources(id)
        } catch (error) {
          console.error('获取物料来源信息失败:', error)
        }

        // 获取验证结果
        try {
          const validation = await validateMaterialSources(id)
          setValidationResults(validation)
        } catch (error) {
          console.error('获取验证结果失败:', error)
          setValidationResults(null)
        }

        setDrawerVisible(true)
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
      include_safety_stock: true,
      include_in_transit: false,
      include_reserved: false,
      include_reorder_point: false,
      bom_version: undefined,
      material_bom_versions: {} as Record<number, string>,
    }
    setExecuteParams({ ...defaults, ...(record.computation_params || {}) })
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
      setPreviewData(preview)
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
      setExecuteModalVisible(false)
      setExecuteRecord(null)
      invalidateStatistics(); actionRef.current?.reload()
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
      title: '计算编码',
      dataIndex: 'computation_code',
      width: 150,
      fixed: 'left',
      hideInSearch: false,
    },
    {
      title: '需求编码',
      dataIndex: 'demand_code',
      width: 150,
      hideInSearch: false,
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
      title: '需求类型',
      dataIndex: 'demand_type',
      width: 110,
      valueType: 'select',
      valueEnum: {
        sales_forecast: { text: '销售预测' },
        sales_order: { text: '销售订单' },
      },
      hideInSearch: true,
      render: (_, record) => {
        const t = record.demand_type
        const label = t === 'sales_order' ? '销售订单' : t === 'sales_forecast' ? '销售预测' : t || '-'
        return <Tag color={t === 'sales_order' ? 'green' : 'blue'}>{label}</Tag>
      },
    },
    {
      title: '生命周期',
      dataIndex: 'lifecycle',
      width: 100,
      valueType: 'select',
      valueEnum: {
        进行中: { text: '进行中' },
        计算中: { text: '计算中' },
        完成: { text: '完成' },
        失败: { text: '失败' },
      },
      hideInSearch: false,
      render: (_, record) => {
        const lifecycle = getDemandComputationLifecycle(record)
        const stageName = lifecycle.stageName ?? record.computation_status ?? '进行中'
        const colorMap: Record<string, string> = {
          进行中: 'processing',
          计算中: 'processing',
          完成: 'success',
          失败: 'error',
        }
        return <Tag color={colorMap[stageName] || 'default'}>{stageName}</Tag>
      },
    },
    {
      title: '业务模式',
      dataIndex: 'business_mode',
      width: 100,
      valueType: 'select',
      valueEnum: {
        MTS: { text: '按库存生产' },
        MTO: { text: '按订单生产' },
      },
      hideInSearch: false,
      render: (_, record) => (
        <Tag color={record.business_mode === 'MTS' ? 'cyan' : 'purple'}>
          {record.business_mode === 'MTS' ? '按库存生产' : '按订单生产'}
        </Tag>
      ),
    },
    {
      title: '开始时间',
      dataIndex: 'computation_start_time',
      width: 160,
      valueType: 'dateTime',
      hideInSearch: false,
      // search: false explicitly handled if needed, or remove search if no special config
      search: undefined,
    },
    {
      title: '结束时间',
      dataIndex: 'computation_end_time',
      width: 160,
      valueType: 'dateTime',
      hideInTable: false,
      hideInSearch: true,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 320,
      fixed: 'right',
      render: (_, record) => {
        const canExecute = record.computation_status === '进行中'
        const canRecompute =
          record.computation_status === '完成' || record.computation_status === '失败'
        return (
          <Space size={4} wrap>
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleDetail([record.id!])}>
              详情
            </Button>
            {canExecute && (
              <Button type="link" size="small" icon={<PlayCircleOutlined />} onClick={() => handleExecute(record)}>
                执行计算
              </Button>
            )}
            {canRecompute && (
              <Button type="link" size="small" icon={<ReloadOutlined />} onClick={() => handleRecompute(record)}>
                重新计算
              </Button>
            )}
            {record.computation_status === '完成' && (
              <Button type="link" size="small" icon={<ArrowDownOutlined />} onClick={() => handleOpenPushPanel(record)}>
                下推
              </Button>
            )}
            <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)}>
              删除
            </Button>
          </Space>
        )
      },
    },
  ]

  const statCards: StatCard[] = hasPageMetricConfig
    ? pageMetricCards
    : statistics
    ? [
        { title: '总计算数', value: statistics.total_count },
        { title: '按库存(MTS)', value: statistics.mts_count ?? statistics.mrp_count },
        { title: '按订单(MTO)', value: statistics.mto_count ?? statistics.lrp_count },
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
    : []

  const [activeTabKey, setActiveTabKey] = useState<string>('list')

  const listTabContent = (
      <>
      <UniTable<DemandComputation>
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
        showCreateButton={true}
        createButtonText="新建需求计算"
        onCreate={handleCreate}
        toolBarActions={[
          <Button
            key="computation-config"
            type="default"
            icon={<SettingOutlined />}
            onClick={() => navigate('/apps/kuaizhizao/plan-management/computation-config')}
          >
            计算配置
          </Button>,
        ]}
      />

      {/* 新建计算Modal */}
      <Modal
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        title="新建需求计算"
        width={MODAL_CONFIG.STANDARD_WIDTH}
        onOk={async () => {
          try {
            const values = await formRef.current?.validateFields()
            if (!selectedDemandIds || selectedDemandIds.length === 0) {
              messageApi.error('请至少选择一个需求')
              return
            }

            // 过滤 material_bom_versions 中的空值
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
            // 有按物料指定时，不传 bom_version，留空物料自动使用该物料 BOM 默认版本
            if (createModalMaterials.length > 0) {
              delete computationParams.bom_version
            }

            // 多需求时使用 demand_ids，单需求时使用 demand_id（向后兼容）
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
          }
        }}
      >
        <ProForm formRef={formRef} submitter={false} layout="vertical">
          <ProFormSelect
            name="demand_ids"
            label="选择需求（可多选）"
            mode="multiple"
            options={demandList.map(d => ({
              label: `${d.demand_code} - ${d.demand_name || ''} (${d.business_mode === 'MTS' ? '按库存' : '按订单'})`,
              value: d.id,
            }))}
            fieldProps={{
              onChange: (value: number[]) => setSelectedDemandIds(value),
              placeholder: '支持多选需求合并计算',
            }}
            rules={[{ required: true, message: '请至少选择一个需求' }]}
            tooltip="多需求合并时，相同物料的需求数量会自动汇总；任一为按订单(MTO)时，计算头业务模式为 MTO"
          />
          <ProForm.Item
            name="computation_params"
            label="计算参数"
            initialValue={{
              include_safety_stock: true,
              include_in_transit: false,
              include_reserved: false,
              include_reorder_point: false,
              material_bom_versions: {},
            }}
          >
            <InventoryParamsForm
              bomMultiVersionAllowed={bomMultiVersionAllowed}
              materials={createModalMaterials}
            />
          </ProForm.Item>
          <ProFormTextArea name="notes" label="备注" placeholder="请输入备注" />
        </ProForm>
      </Modal>

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
        onCancel={() => {
          setExecuteModalVisible(false)
          setExecuteRecord(null)
        }}
        title="计算参数 - 执行计算"
        width={MODAL_CONFIG.SMALL_WIDTH}
        okText="执行计算"
        confirmLoading={executeLoading}
        onOk={handleExecuteSubmit}
      >
        {executeRecord && (
          <>
            <div style={{ marginBottom: 16 }}>
              <h4 style={{ marginBottom: 8 }}>只读信息</h4>
              <ProDescriptions<DemandComputation>
                column={2}
                size="small"
                dataSource={executeRecord}
                columns={[
                  { title: '计算编码', dataIndex: 'computation_code' },
                  { title: '需求编码', dataIndex: 'demand_code' },
                  {
                    title: '计算类型',
                    dataIndex: 'computation_type',
                    render: () => '物料需求计划 (MRP)',
                  },
                  {
                    title: '业务模式',
                    dataIndex: 'business_mode',
                    render: (dom: any) => (dom === 'MTS' ? '按库存生产' : '按订单生产'),
                  },
                ]}
              />
            </div>
            <div>
              <h4 style={{ marginBottom: 8 }}>可临时修改的参数</h4>
              <InventoryParamsForm
                value={executeParams}
                onChange={setExecuteParams}
                bomMultiVersionAllowed={bomMultiVersionAllowed}
                materials={executeModalMaterials}
              />
            </div>
          </>
        )}
      </Modal>

      {/* 计算结果预览 Modal - 二次确认 */}
      <Modal
        open={previewModalVisible}
        onCancel={() => {
          setPreviewModalVisible(false)
          setPreviewData(null)
        }}
        title="计算结果预览 - 请确认"
        width={MODAL_CONFIG.LARGE_WIDTH}
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
              pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
              columns={[
                { title: '物料编码', dataIndex: 'material_code', width: 120 },
                { title: '物料名称', dataIndex: 'material_name', width: 150 },
                { title: '单位', dataIndex: 'material_unit', width: 60 },
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
                  render: (v: number) => (v ? Number(v).toLocaleString() : '-'),
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

      {/* 详情Drawer - 使用 styles.wrapper 设置宽度，因 antd 6 的 size 可能被全局样式覆盖 */}
      <Drawer
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        title="计算详情"
        rootClassName="demand-computation-drawer"
        width="50%"
        styles={{ wrapper: { width: '50%' } }}
      >
        {currentComputation && (
          <Tabs
            activeKey={detailTabKey}
            onChange={(key) => {
              setDetailTabKey(key)
              if (key === 'recalc' && currentComputation.id) {
                setRecalcHistoryLoading(true)
                listComputationRecalcHistory(currentComputation.id, { limit: 50 })
                  .then(setComputationRecalcHistory)
                  .catch(() => messageApi.error('获取重算历史失败'))
                  .finally(() => setRecalcHistoryLoading(false))
              }
              if (key === 'snapshots' && currentComputation.id) {
                setSnapshotsLoading(true)
                listComputationSnapshots(currentComputation.id, { limit: 20 })
                  .then(setComputationSnapshots)
                  .catch(() => messageApi.error('获取快照列表失败'))
                  .finally(() => setSnapshotsLoading(false))
              }
              if (key === 'push-records' && currentComputation.id) {
                setPushRecordsLoading(true)
                getPushRecords(currentComputation.id)
                  .then((res) => setPushRecords(res.records || []))
                  .catch(() => messageApi.error('获取下推记录失败'))
                  .finally(() => setPushRecordsLoading(false))
              }
              if (key === 'monitor' && currentComputation.id) {
                setDynamicMonitorLoading(true)
                getComputationDynamicMonitor(currentComputation.id)
                  .then(setDynamicMonitorData)
                  .catch(() => messageApi.error('获取同步监控失败'))
                  .finally(() => setDynamicMonitorLoading(false))
              }
            }}
            items={[
              {
                key: 'detail',
                label: '详情',
                children: (
                  <>
                    <ProDescriptions<DemandComputation>
                      dataSource={currentComputation}
                      columns={[
                        { title: '计算编码', dataIndex: 'computation_code' },
                        { title: '需求编码', dataIndex: 'demand_code' },
                        {
                          title: '计算类型',
                          dataIndex: 'computation_type',
                          render: () => '物料需求计划 (MRP)',
                        },
                        {
                          title: '业务模式',
                          dataIndex: 'business_mode',
                          render: (t: any) => (t === 'MTS' ? '按库存生产' : '按订单生产'),
                        },
                        { title: '计算状态', dataIndex: 'computation_status' },
                        { title: '开始时间', dataIndex: 'computation_start_time', valueType: 'dateTime' },
                        { title: '结束时间', dataIndex: 'computation_end_time', valueType: 'dateTime' },
                      ]}
                    />

                    {(() => {
                      const lifecycle = getDemandComputationLifecycle(currentComputation)
                      const mainStages = lifecycle.mainStages ?? []
                      if (mainStages.length === 0) return null
                      return (
                        <DetailDrawerSection title="生命周期">
                          <UniLifecycleStepper
                            steps={mainStages}
                            status={lifecycle.status}
                            showLabels
                            nextStepSuggestions={lifecycle.nextStepSuggestions}
                          />
                        </DetailDrawerSection>
                      )
                    })()}

                    {validationResults && (
                      <div style={{ marginTop: 24, marginBottom: 24 }}>
                        <ProDescriptions
                          title="物料来源验证结果"
                          size="small"
                          column={3}
                          dataSource={{
                            all_passed: validationResults.all_passed ? '全部通过' : '存在失败',
                            passed_count: validationResults.passed_count,
                            failed_count: validationResults.failed_count,
                            total_count: validationResults.total_count,
                          }}
                          columns={[
                            {
                              title: '验证状态',
                              dataIndex: 'all_passed',
                              render: (text: any) => (
                                <Tag color={text === '全部通过' ? 'success' : 'error'}>{text}</Tag>
                              ),
                            },
                            { title: '通过数量', dataIndex: 'passed_count' },
                            { title: '失败数量', dataIndex: 'failed_count' },
                            { title: '总数量', dataIndex: 'total_count' },
                          ]}
                        />

                        {validationResults.failed_count > 0 && (
                          <div style={{ marginTop: 12 }}>
                            <p style={{ fontWeight: 'bold', color: '#ff4d4f' }}>验证失败的物料：</p>
                            <ul style={{ marginTop: 8 }}>
                              {validationResults.validation_results
                                .filter((r: any) => !r.validation_passed)
                                .map((r: any, index: number) => (
                                  <li key={index} style={{ marginBottom: 4 }}>
                                    <strong>{r.material_code}</strong> ({r.material_name}):{' '}
                                    {r.errors.join(', ')}
                                  </li>
                                ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {currentComputation.items && currentComputation.items.length > 0 && (
                      <>
                        <h3 style={{ marginTop: 24, marginBottom: 16 }}>计算结果明细</h3>
                        <Table<DemandComputationItem>
                          dataSource={currentComputation.items}
                          rowKey="id"
                          columns={[
                            { title: '物料编码', dataIndex: 'material_code', width: 120, fixed: 'left' },
                            { title: '物料名称', dataIndex: 'material_name', width: 150, ellipsis: true },
                            {
                              title: '就绪状态',
                              dataIndex: 'readiness_status',
                              width: 100,
                              render: (status: string, record: DemandComputationItem) => {
                                const map: Record<string, { label: string; color: string }> = {
                                  Ready: { label: '就绪', color: 'success' },
                                  Partial: { label: '部分', color: 'warning' },
                                  Shortage: { label: '缺料', color: 'error' },
                                }
                                const info = map[status || 'Shortage'] || { label: '未知', color: 'default' }
                                return (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <Tag color={info.color} style={{ margin: 0, textAlign: 'center' }}>
                                      {info.label}
                                    </Tag>
                                    {record.readiness_rate != null && record.readiness_rate < 1 && (
                                      <div style={{ fontSize: 10, color: '#999', textAlign: 'center' }}>
                                        {Math.round(record.readiness_rate * 100)}%
                                      </div>
                                    )}
                                  </div>
                                )
                              },
                            },
                            {
                              title: '物料来源',
                              dataIndex: 'material_source_type',
                              width: 90,
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
                              width: 160,
                              render: (date: string, record: DemandComputationItem) => {
                                const startDate = record.production_start_date || record.procurement_start_date
                                const isRisk = record.is_overdue_risk
                                return (
                                  <div style={{ fontSize: 13 }}>
                                    <div style={{ color: isRisk ? '#ff4d4f' : 'inherit', fontWeight: isRisk ? 'bold' : 'normal' }}>
                                      {date || '-'}
                                      {isRisk && <Tag color="error" style={{ marginLeft: 8, fontSize: 10 }}>交期风险</Tag>}
                                    </div>
                                    {startDate && (
                                      <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                                        计划开始: {startDate}
                                      </div>
                                    )}
                                  </div>
                                )
                              },
                            },
                            { title: '需求数量', dataIndex: 'required_quantity', width: 90, align: 'right' },
                            { title: '可用库存', dataIndex: 'available_inventory', width: 90, align: 'right' },
                            { title: '净需求', dataIndex: 'net_requirement', width: 90, align: 'right', render: (v) => <span style={{ fontWeight: 'bold' }}>{v}</span> },
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
                              width: 60,
                              fixed: 'right',
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
                                            <p style={{ color: '#999', fontSize: 12 }}>提示：完整溯源功能开发中，将支持点击跳转至对应订单。</p>
                                          </div>
                                        )
                                      })
                                    }}
                                  >
                                    溯源
                                  </Button>
                                )
                              }
                            }
                          ]}
                          pagination={false}
                          scroll={{ x: 1200 }}
                        />
                      </>
                    )}

                    {currentComputation?.id && (
                      <DetailDrawerSection title="操作记录" style={{ marginTop: 24 }}>
                        <DocumentTrackingPanel
                          documentType="demand_computation"
                          documentId={currentComputation.id}
                        />
                      </DetailDrawerSection>
                    )}
                  </>
                ),
              },
              {
                key: 'push-records',
                label: '下推记录',
                children: (
                  <Table<PushRecordItem>
                    size="small"
                    loading={pushRecordsLoading}
                    dataSource={pushRecords}
                    rowKey={(r) => `${r.target_type}-${r.target_id}`}
                    columns={[
                      {
                        title: '单据类型',
                        dataIndex: 'target_type',
                        width: 120,
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
                      { title: '单据编码', dataIndex: 'target_code', width: 140 },
                      { title: '单据名称', dataIndex: 'target_name', ellipsis: true },
                      {
                        title: '下推时间',
                        dataIndex: 'created_at',
                        width: 180,
                        render: (t: string) => (t ? dayjs(t).format('YYYY-MM-DD HH:mm:ss') : '-'),
                      },
                      {
                        title: '状态',
                        dataIndex: 'target_exists',
                        width: 90,
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
                ),
              },
              {
                key: 'recalc',
                label: '重算历史',
                children: (
                  <Table<ComputationRecalcHistoryItem>
                    size="small"
                    loading={recalcHistoryLoading}
                    dataSource={computationRecalcHistory}
                    rowKey="id"
                    columns={[
                      { title: '重算时间', dataIndex: 'recalc_at', width: 180, render: (t) => t || '-' },
                      { title: '触发原因', dataIndex: 'trigger', width: 120 },
                      { title: '结果', dataIndex: 'result', width: 80 },
                      { title: '备注', dataIndex: 'message', ellipsis: true },
                    ]}
                    pagination={false}
                  />
                ),
              },
              {
                key: 'monitor',
                label: (
                  <Badge dot={dynamicMonitorData?.has_upstream_change || dynamicMonitorData?.has_downstream_risk}>
                    协同监控
                  </Badge>
                ),
                children: (
                  <div style={{ padding: '16px 0' }}>
                    {dynamicMonitorLoading ? (
                      <div style={{ textAlign: 'center', padding: 40 }}>
                        <SyncOutlined spin style={{ fontSize: 24, color: '#1890ff' }} />
                        <div style={{ marginTop: 12, color: '#666' }}>正在分析协同状态...</div>
                      </div>
                    ) : dynamicMonitorData ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        <DetailDrawerSection title="上游需求变动感应 (Upstream Change Detection)">
                          {dynamicMonitorData.upstream_alerts.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                              {dynamicMonitorData.upstream_alerts.map((alert: any, i: number) => (
                                <Alert
                                  key={i}
                                  message="原始需求已变更"
                                  description={alert.message}
                                  type="warning"
                                  showIcon
                                  action={
                                    <Button size="small" type="primary" ghost onClick={() => handleRecompute(currentComputation)}>
                                      重新计算
                                    </Button>
                                  }
                                />
                              ))}
                            </div>
                          ) : (
                            <Empty description="源需求数据稳定，暂无变动" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                          )}
                        </DetailDrawerSection>

                        <DetailDrawerSection title="下游执行进度追踪 (Downstream Execution Tracking)">
                          {dynamicMonitorData.downstream_alerts.length > 0 ? (
                            <Timeline
                              mode="left"
                              items={dynamicMonitorData.downstream_alerts.map((alert: any, i: number) => ({
                                key: i,
                                label: alert.planned_end_date || alert.delivery_date,
                                children: (
                                  <div>
                                    <div style={{ fontWeight: 'bold' }}>{alert.code} ({alert.name})</div>
                                    <div style={{ color: '#ff4d4f', fontSize: 13 }}>{alert.message}</div>
                                    <div style={{ fontSize: 12, color: '#999' }}>当前状态: {alert.status}</div>
                                  </div>
                                ),
                                color: 'red',
                                dot: <ClockCircleOutlined style={{ fontSize: '16px' }} />,
                              }))}
                            />
                          ) : (
                            <div style={{ textAlign: 'center', padding: '20px 0', color: '#52c41a' }}>
                              <CheckCircleOutlined style={{ fontSize: 24, marginBottom: 8 }} />
                              <div>所有下推单据均在计划时间内，执行正常</div>
                            </div>
                          )}
                        </DetailDrawerSection>
                        <div style={{ textAlign: 'right', color: '#ccc', fontSize: 12 }}>
                          最近监控时间: {dayjs(dynamicMonitorData.monitor_time).format('YYYY-MM-DD HH:mm:ss')}
                        </div>
                      </div>
                    ) : (
                      <Empty description="暂无监控数据" />
                    )}
                  </div>
                ),
              },
              {
                key: 'snapshots',
                label: '快照',
                children: (
                  <Table<ComputationSnapshotItem>
                    size="small"
                    loading={snapshotsLoading}
                    dataSource={computationSnapshots}
                    rowKey="id"
                    expandable={{
                      expandedRowRender: (record) => (
                        <div style={{ padding: 8 }}>
                          {record.computation_summary_snapshot && (
                            <div style={{ marginBottom: 12 }}>
                              <strong>计算汇总快照：</strong>
                              <pre style={{ margin: '4px 0 0', fontSize: 12, maxHeight: 200, overflow: 'auto' }}>
                                {JSON.stringify(record.computation_summary_snapshot, null, 2)}
                              </pre>
                            </div>
                          )}
                          {record.items_snapshot && record.items_snapshot.length > 0 && (
                            <>
                              <strong>明细快照：</strong>
                              <pre style={{ margin: '4px 0 0', fontSize: 12, maxHeight: 200, overflow: 'auto' }}>
                                {JSON.stringify(record.items_snapshot, null, 2)}
                              </pre>
                            </>
                          )}
                          {!record.computation_summary_snapshot && (!record.items_snapshot || record.items_snapshot.length === 0) && (
                            <span style={{ color: '#999' }}>无快照内容</span>
                          )}
                        </div>
                      ),
                    }}
                    columns={[
                      { title: '快照时间', dataIndex: 'snapshot_at', width: 180, render: (t) => t || '-' },
                      { title: '触发原因', dataIndex: 'trigger', ellipsis: true },
                    ]}
                    pagination={false}
                  />
                ),
              },
            ]}
          />
        )}
      </Drawer>
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
