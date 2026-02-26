/**
 * 统一需求计算页面
 *
 * 提供统一的需求计算功能，支持MRP和LRP两种计算类型。
 *
 * 根据《☆ 用户使用全场景推演.md》的设计理念，将MRP和LRP合并为统一的需求计算。
 *
 * @author Luigi Lu
 * @date 2025-01-14
 */

import React, { useRef, useState } from 'react'
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
} from 'antd'
import {
  PlayCircleOutlined,
  EyeOutlined,
  ReloadOutlined,
  ArrowDownOutlined,
  DeleteOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { UniTable } from '../../../../../components/uni-table'
import { ListPageTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates'
import {
  listDemandComputations,
  getDemandComputation,
  createDemandComputation,
  previewExecuteDemandComputation,
  executeDemandComputation,
  recomputeDemandComputation,
  deleteDemandComputation,
  generateOrdersFromComputation,
  getPushOptions,
  getPushPreview,
  pushAll,
  validateMaterialSources,
  getMaterialSources,
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
import { listDemands, getDemand, Demand, DemandStatus, ReviewStatus } from '../../../services/demand'
import { getBusinessConfig } from '../../../../../services/businessConfig'
import { bomApi } from '../../../../master-data/services/material'

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
  const actionRef = useRef<ActionType>(null)
  const formRef = useRef<any>(null)

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
    production?: 'plan' | 'work_order'
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
          production: opts.production_choices.length > 0 ? opts.default_production : undefined,
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
              if (b.version) versionMap.set(b.version, b.isDefault || versionMap.get(b.version))
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
                if (b.version) versionMap.set(b.version, b.isDefault || versionMap.get(b.version))
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
      actionRef.current?.reload()
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
          actionRef.current?.reload()
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
          actionRef.current?.reload()
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
      actionRef.current?.reload()
    } catch (e: any) {
      messageApi.error(e?.response?.data?.detail || '下推失败')
    } finally {
      setPushPanelSubmitting(false)
    }
  }

  /**
   * 处理一键生成工单和采购单（物料来源控制增强）
   * @param generateMode 生成粒度：all=全部，work_order_only=仅工单，purchase_only=仅采购
   */
  const handleGenerateOrders = async (
    record: DemandComputation,
    generateMode: 'all' | 'work_order_only' | 'purchase_only' = 'all'
  ) => {
    // 先验证物料来源配置
    try {
      const validation = await validateMaterialSources(record.id!)

      if (!validation.all_passed) {
        // 有验证失败，允许用户选择继续生成草稿单（由下游补全）
        const errorMessages = validation.validation_results
          .filter((r: any) => !r.validation_passed)
          .map((r: any) => `物料 ${r.material_code} (${r.material_name}): ${r.errors.join(', ')}`)
          .join('\n')

        modalApi.confirm({
          title: '物料来源验证失败',
          width: 600,
          okText: '继续生成草稿单',
          cancelText: '取消',
          content: (
            <div>
              <p>以下物料的来源配置验证失败，将生成草稿单，请下游用户补全后提交。是否继续？</p>
              <pre
                style={{
                  background: '#f5f5f5',
                  padding: '12px',
                  borderRadius: '4px',
                  maxHeight: '300px',
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {errorMessages}
              </pre>
              <p style={{ marginTop: '12px', color: '#ff4d4f' }}>
                失败数量: {validation.failed_count} / {validation.total_count}
              </p>
            </div>
          ),
          onOk: async () => {
            try {
              const result = await generateOrdersFromComputation(record.id!, generateMode, {
                allowDraft: true,
              })
              const parts = []
              if (result.work_order_count > 0)
                parts.push(`生产工单 ${result.work_order_count} 个（工单管理）`)
              if ((result.outsource_work_order_count ?? 0) > 0)
                parts.push(`委外工单 ${result.outsource_work_order_count} 个（委外管理）`)
              if (result.purchase_order_count > 0)
                parts.push(`采购单 ${result.purchase_order_count} 个`)
              if (parts.length > 0) {
                messageApi.success(`草稿单生成成功！${parts.join('，')}，请下游用户补全后提交。`)
              } else {
                messageApi.warning(
                  '未生成任何工单或采购单。请检查计算结果中的建议数量是否大于0，以及物料来源类型是否正确配置。'
                )
              }
              actionRef.current?.reload()
            } catch (error: any) {
              messageApi.error(error?.response?.data?.detail || '生成草稿单失败')
            }
          },
        })
        return
      }

      // 获取物料来源统计信息
      const sources = await getMaterialSources(record.id!)
      const sourceTypeCounts: Record<string, number> = {}
      sources.material_sources.forEach((s: any) => {
        const type = s.source_type || '未设置'
        sourceTypeCounts[type] = (sourceTypeCounts[type] || 0) + 1
      })

      const sourceInfo = Object.entries(sourceTypeCounts)
        .map(([type, count]) => {
          const typeNames: Record<string, string> = {
            Make: '自制件',
            Buy: '采购件',
            Phantom: '虚拟件',
            Outsource: '委外件',
            Configure: '配置件',
            未设置: '未设置',
          }
          return `${typeNames[type] || type}: ${count}`
        })
        .join(', ')

      const modeLabel =
        generateMode === 'all'
          ? '工单和采购单'
          : generateMode === 'work_order_only'
            ? '工单'
            : '采购单'
      modalApi.confirm({
        title: `一键生成${modeLabel}`,
        width: 600,
        content: (
          <div>
            <p>
              确认要从计算结果 <strong>{record.computation_code}</strong> 生成{modeLabel}吗？
            </p>
            <div
              style={{
                marginTop: '12px',
                padding: '12px',
                background: '#f0f5ff',
                borderRadius: '4px',
              }}
            >
              <p style={{ margin: 0, fontWeight: 'bold' }}>物料来源统计：</p>
              <p style={{ margin: '8px 0 0 0' }}>{sourceInfo}</p>
            </div>
            <p style={{ marginTop: '12px', fontSize: '12px', color: '#666' }}>
              {generateMode === 'all'
                ? '系统将根据物料来源类型智能生成：自制件/委外件生成工单，采购件生成采购订单，虚拟件自动跳过'
                : generateMode === 'work_order_only'
                  ? '将仅生成自制件、委外件、配置件的工单，采购件跳过'
                  : '将仅生成采购件的采购订单，自制件/委外件跳过'}
            </p>
          </div>
        ),
        onOk: async () => {
          try {
            const result = await generateOrdersFromComputation(record.id!, generateMode)

            const parts = []
            if (result.work_order_count > 0)
              parts.push(`生产工单 ${result.work_order_count} 个（工单管理）`)
            if ((result.outsource_work_order_count ?? 0) > 0)
              parts.push(`委外工单 ${result.outsource_work_order_count} 个（委外管理）`)
            if (result.purchase_order_count > 0)
              parts.push(`采购单 ${result.purchase_order_count} 个`)
            if (parts.length > 0) {
              messageApi.success(`生成成功！${parts.join('，')}`)
            } else {
              messageApi.warning(
                '未生成任何工单或采购单。请检查计算结果中的建议数量是否大于0，以及物料来源类型是否正确配置。'
              )
            }
            actionRef.current?.reload()
          } catch (error: any) {

            messageApi.error(error?.response?.data?.detail || '生成工单和采购单失败')
          }
        },
      })
    } catch (error: any) {
      messageApi.error('验证物料来源配置失败')
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
      title: '计算模式',
      dataIndex: 'computation_type',
      width: 100,
      valueType: 'select',
      valueEnum: {
        MRP: { text: '按预测' },
        LRP: { text: '按订单' },
      },
      hideInSearch: true, // 隐藏 MRP/LRP 术语，按需求来源自动推断
      render: (_, record) => (
        <Tag color={record.computation_type === 'MRP' ? 'blue' : 'green'}>
          {record.computation_type === 'MRP' ? '按预测' : '按订单'}
        </Tag>
      ),
    },
    {
      title: '计算状态',
      dataIndex: 'computation_status',
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
        const status = record.computation_status || ''
        const colorMap: Record<string, string> = {
          进行中: 'processing',
          计算中: 'processing',
          完成: 'success',
          失败: 'error',
        }
        return <Tag color={colorMap[status] || 'default'}>{status}</Tag>
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
      width: 220,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleDetail([record.id!])}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
          >
            删除
          </Button>
          {record.computation_status === '进行中' && (
            <Button
              type="link"
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => handleExecute(record)}
            >
              执行计算
            </Button>
          )}
          {(record.computation_status === '完成' || record.computation_status === '失败') && (
            <Button
              type="link"
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => handleRecompute(record)}
            >
              重新计算
            </Button>
          )}
          {record.computation_status === '完成' && (
            <Button
              type="link"
              size="small"
              icon={<ArrowDownOutlined />}
              onClick={() => handleOpenPushPanel(record)}
            >
              下推
            </Button>
          )}
        </Space>
      ),
    },
  ]

  return (
    <ListPageTemplate>
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
          if (searchFormValues?.computation_status) {
            apiParams.computation_status = searchFormValues.computation_status
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
        search={{
          labelWidth: 'auto',
        }}
        toolBarRender={() => [
          <Button key="create" type="primary" onClick={handleCreate}>
            新建计算
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

            // 根据需求类型确定计算类型（多需求时：有订单则 LRP，全预测则 MRP）
            const selectedDemands = demandList.filter(d => selectedDemandIds.includes(d.id!))
            const hasMTO = selectedDemands.some(d => d.business_mode === 'MTO')
            const computationType = hasMTO ? 'LRP' : 'MRP'

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
              computation_type: computationType,
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
            actionRef.current?.reload()
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
            tooltip="多需求合并时，相同物料的需求数量会自动汇总；有订单需求时自动选择「按订单计算」模式"
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
                    <Radio.Group
                      value={pushConfig.production}
                      onChange={e => setPushConfig(c => ({ ...c, production: e.target.value }))}
                    >
                      <Radio value="plan">转生产计划</Radio>
                      <Radio value="work_order">仅工单</Radio>
                    </Radio.Group>
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
                  {pushPreviewData.production_plan_count > 0 && (
                    <li>生产计划 {pushPreviewData.production_plan_count} 个</li>
                  )}
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
                    title: '计算模式',
                    dataIndex: 'computation_type',
                    render: (t: string) => (t === 'MRP' ? '按预测' : '按订单'),
                  },
                  {
                    title: '业务模式',
                    dataIndex: 'business_mode',
                    render: (t: string) => (t === 'MTS' ? '按库存生产' : '按订单生产'),
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
                  render: (v: number, r: { material_source_type?: string }) =>
                    r.material_source_type === 'Outsource' ? '-' : (v ? Number(v).toLocaleString() : '-'),
                },
                {
                  title: '建议委外',
                  dataIndex: 'suggested_work_order_quantity',
                  width: 90,
                  render: (v: number, r: { material_source_type?: string }) =>
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
        styles={{ wrapper: { width: 1300 } }}
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
                          title: '计算模式',
                          dataIndex: 'computation_type',
                          render: (t: any) => (t === 'MRP' ? '按预测' : '按订单'),
                        },
                        { title: '计算状态', dataIndex: 'computation_status' },
                        { title: '开始时间', dataIndex: 'computation_start_time', valueType: 'dateTime' },
                        { title: '结束时间', dataIndex: 'computation_end_time', valueType: 'dateTime' },
                      ]}
                    />

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
                            { title: '物料编码', dataIndex: 'material_code', width: 120 },
                            { title: '物料名称', dataIndex: 'material_name', width: 150 },
                            {
                              title: '物料来源',
                              dataIndex: 'material_source_type',
                              width: 100,
                              render: (type: string) => {
                                const typeMap: Record<string, { label: string; color: string }> = {
                                  Make: { label: '自制件', color: 'blue' },
                                  Buy: { label: '采购件', color: 'green' },
                                  Phantom: { label: '虚拟件', color: 'orange' },
                                  Outsource: { label: '委外件', color: 'purple' },
                                  Configure: { label: '配置件', color: 'cyan' },
                                }
                                const info = typeMap[type] || { label: type || '未设置', color: 'default' }
                                return <Tag color={info.color}>{info.label}</Tag>
                              },
                            },
                            {
                              title: '验证状态',
                              dataIndex: 'source_validation_passed',
                              width: 100,
                              render: (passed: boolean, record: DemandComputationItem) => {
                                if (record.material_source_type) {
                                  // 优先使用实时验证结果（打开详情时调用 validateMaterialSources）
                                  const realTime = validationResults?.validation_results?.find(
                                    (r: any) => r.material_id === record.material_id
                                  )
                                  const isPassed = realTime != null ? realTime.validation_passed : passed
                                  return (
                                    <Tag color={isPassed ? 'success' : 'error'}>
                                      {isPassed ? '通过' : '失败'}
                                    </Tag>
                                  )
                                }
                                return <span>-</span>
                              },
                            },
                            { title: '需求数量', dataIndex: 'required_quantity', width: 100 },
                            { title: '可用库存', dataIndex: 'available_inventory', width: 100 },
                            { title: '净需求', dataIndex: 'net_requirement', width: 100 },
                            {
                              title: '建议工单数量',
                              dataIndex: 'suggested_work_order_quantity',
                              width: 120,
                              render: (v: number, r: DemandComputationItem) =>
                                r.material_source_type === 'Outsource' ? '-' : (v ?? '-'),
                            },
                            {
                              title: '建议委外数量',
                              dataIndex: 'suggested_work_order_quantity',
                              width: 120,
                              render: (v: number, r: DemandComputationItem) =>
                                r.material_source_type === 'Outsource' ? (v ?? '-') : '-',
                            },
                            {
                              title: '建议采购数量',
                              dataIndex: 'suggested_purchase_order_quantity',
                              width: 120,
                            },
                          ]}
                          pagination={false}
                          scroll={{ x: 1200 }}
                        />
                      </>
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
                            production_plan: '生产计划',
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
    </ListPageTemplate>
  )
}

export default DemandComputationPage
