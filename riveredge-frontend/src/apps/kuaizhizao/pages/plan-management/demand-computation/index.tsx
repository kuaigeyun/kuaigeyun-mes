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
  ProFormText,
  ProFormDigit,
  ProFormTextArea,
  ProDescriptions,
  ProFormSwitch,
} from '@ant-design/pro-components'
import {
  App,
  Alert,
  Button,
  Tag,
  Space,
  Modal,
  Drawer,
  Table,
  message,
  Dropdown,
  Collapse,
  Switch,
  Input,
} from 'antd'
import {
  PlayCircleOutlined,
  EyeOutlined,
  ReloadOutlined,
  FileAddOutlined,
  DownOutlined,
  ProjectOutlined,
  ShoppingCartOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { UniTable } from '../../../../../components/uni-table'
import { ListPageTemplate } from '../../../../../components/layout-templates'
import {
  listDemandComputations,
  getDemandComputation,
  createDemandComputation,
  executeDemandComputation,
  recomputeDemandComputation,
  generateOrdersFromComputation,
  pushToProductionPlan,
  pushToPurchaseRequisition,
  validateMaterialSources,
  getMaterialSources,
  DemandComputation,
  DemandComputationItem,
} from '../../../services/demand-computation'
import { listDemands, Demand, DemandStatus, ReviewStatus } from '../../../services/demand'
import { getBusinessConfig } from '../../../../../services/businessConfig'
import { planningApi } from '../../../services/production'

const { Panel } = Collapse

/** 库存参数开关表单（新建计算时使用） */
const InventoryParamsForm: React.FC<{
  value?: Record<string, any>
  onChange?: (v: Record<string, any>) => void
  bomMultiVersionAllowed?: boolean
}> = ({ value, onChange, bomMultiVersionAllowed = false }) => {
  const params = value || {
    include_safety_stock: true,
    include_in_transit: false,
    include_reserved: false,
    include_reorder_point: false,
    bom_version: undefined,
  }
  const handleChange = (key: string, val: any) => {
    onChange?.({ ...params, [key]: val })
  }
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
          {bomMultiVersionAllowed && (
            <>
              <dt style={{ margin: 0 }}>BOM 版本</dt>
              <dd style={{ margin: 0 }}>
                <Input
                  placeholder="留空使用默认版本，如 1.0、1.1"
                  value={params.bom_version ?? ''}
                  onChange={e => handleChange('bom_version', e.target.value || undefined)}
                  allowClear
                />
              </dd>
            </>
          )}
        </dl>
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

  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [currentComputation, setCurrentComputation] = useState<DemandComputation | null>(null)

  // 物料来源信息状态
  const [materialSources, setMaterialSources] = useState<any[]>([])
  const [validationResults, setValidationResults] = useState<any>(null)

  // 需求列表（用于选择需求）
  const [demandList, setDemandList] = useState<Demand[]>([])
  // BOM 允许多版本共存（用于决定是否显示版本选择）
  const [bomMultiVersionAllowed, setBomMultiVersionAllowed] = useState(true)

  // 计划管理配置（用于展示当前模式：直连工单 vs 经生产计划）
  const [planningConfig, setPlanningConfig] = useState<{
    can_direct_generate_work_order?: boolean
    planning_mode?: 'direct' | 'via_plan'
    production_plan_enabled?: boolean
  } | null>(null)
  React.useEffect(() => {
    planningApi.productionPlan.getPlanningConfig().then(setPlanningConfig).catch(() => setPlanningConfig(null))
  }, [])

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
          const sources = await getMaterialSources(id)
          setMaterialSources(sources.material_sources || [])
        } catch (error) {
          console.error('获取物料来源信息失败:', error)
          setMaterialSources([])
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
   * 处理执行计算
   */
  const handleExecute = async (record: DemandComputation) => {
    modalApi.confirm({
      title: '执行需求计算',
      content: `确认要执行计算 ${record.computation_code} 吗？`,
      onOk: async () => {
        try {
          await executeDemandComputation(record.id!)
          messageApi.success('计算执行成功')
          actionRef.current?.reload()
        } catch (error: any) {
          messageApi.error('计算执行失败')
        }
      },
    })
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

  const handlePushToPurchaseRequisition = async (record: DemandComputation) => {
    modalApi.confirm({
      title: '转采购申请',
      content: `确定要将计算 ${record.computation_code} 下推到采购申请吗？仅采购件会生成采购申请。`,
      onOk: async () => {
        try {
          const result = await pushToPurchaseRequisition(record.id!)
          messageApi.success(result.message || '下推成功')
          actionRef.current?.reload()
        } catch (error: any) {
          messageApi.error(error?.response?.data?.detail || '下推失败')
        }
      },
    })
  }

  /**
   * 处理转生产计划
   */
  const handlePushToProductionPlan = async (record: DemandComputation) => {
    modalApi.confirm({
      title: '转生产计划',
      content: `确定要将计算 ${record.computation_code} 下推到生产计划吗？`,
      onOk: async () => {
        try {
          const result = await pushToProductionPlan(record.id!)
          messageApi.success(result.message || '下推成功')
          actionRef.current?.reload()
        } catch (error: any) {
          messageApi.error(error?.response?.data?.detail || '下推失败')
        }
      },
    })
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
        // 有验证失败，显示详细错误信息
        const errorMessages = validation.validation_results
          .filter((r: any) => !r.validation_passed)
          .map((r: any) => `物料 ${r.material_code} (${r.material_name}): ${r.errors.join(', ')}`)
          .join('\n')

        modalApi.warning({
          title: '物料来源验证失败',
          width: 600,
          content: (
            <div>
              <p>以下物料的来源配置验证失败，无法生成工单和采购单：</p>
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
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/14723169-35ed-4ca8-9cad-d93c6c16c078',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'demand-computation/index.tsx:onOk',message:'api_response',data:{work_order_count:result?.work_order_count,outsource_work_order_count:result?.outsource_work_order_count,purchase_order_count:result?.purchase_order_count},timestamp:Date.now(),hypothesisId:'D'})}).catch(()=>{});
            // #endregion
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
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/14723169-35ed-4ca8-9cad-d93c6c16c078',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'demand-computation/index.tsx:onOk',message:'api_error',data:{error:String(error?.response?.data?.detail||error?.message||error)},timestamp:Date.now(),hypothesisId:'C,D'})}).catch(()=>{});
            // #endregion
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
      render: (text: string) => (
        <Tag color={text === 'MRP' ? 'blue' : 'green'}>{text === 'MRP' ? '按预测' : '按订单'}</Tag>
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
      render: (status: string) => {
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
      render: (text: string) => (
        <Tag color={text === 'MTS' ? 'cyan' : 'purple'}>
          {text === 'MTS' ? '按库存生产' : '按订单生产'}
        </Tag>
      ),
    },
    {
      title: '开始时间',
      dataIndex: 'computation_start_time',
      width: 160,
      valueType: 'dateTime',
      hideInSearch: false,
      search: {
        valueType: 'dateRange',
      },
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
      width: 200,
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
          {record.computation_status === '进行中' && (
            <Button
              type="link"
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => handleExecute(record)}
            >
              执行
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
            <>
              <Button
                type="link"
                size="small"
                icon={<ProjectOutlined />}
                onClick={() => handlePushToProductionPlan(record)}
              >
                转生产计划
              </Button>
              <Button
                type="link"
                size="small"
                icon={<ShoppingCartOutlined />}
                onClick={() => handlePushToPurchaseRequisition(record)}
              >
                转采购申请
              </Button>
              <Dropdown
                menu={{
                  items: [
                    ...(canDirectWO
                      ? [
                          { key: 'all', label: '全部（工单+采购单）', onClick: () => handleGenerateOrders(record, 'all') },
                          { key: 'work_order_only', label: '仅工单', onClick: () => handleGenerateOrders(record, 'work_order_only') },
                        ]
                      : []),
                    { key: 'purchase_only', label: '仅采购单', onClick: () => handleGenerateOrders(record, 'purchase_only') },
                  ],
                }}
              >
                <Button type="link" size="small" icon={<FileAddOutlined />}>
                  {canDirectWO ? '生成工单/采购单' : '生成采购单'} <DownOutlined />
                </Button>
              </Dropdown>
            </>
          )}
        </Space>
      ),
    },
  ]

  /**
   * 渲染页面
   */
  const canDirectWO = planningConfig?.can_direct_generate_work_order !== false

  return (
    <ListPageTemplate
      title="统一需求计算"
      description="按需求来源自动选择计算模式（按预测/按订单），统一管理需求计算结果"
    >
      {planningConfig && (
        <Alert
          type="info"
          showIcon
          message={
            canDirectWO
              ? '当前模式：可直连生成工单，也可经生产计划。适合小批量、急单快速响应。'
              : '当前模式：需经生产计划生成工单。请先「转生产计划」，再在生产计划中执行转工单。'
          }
          style={{ marginBottom: 16 }}
        />
      )}
      <UniTable<DemandComputation>
        actionRef={actionRef}
        columns={columns}
        showAdvancedSearch={true}
        request={async (params, sort, _filter, searchFormValues) => {
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
        width={800}
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

            // 多需求时使用 demand_ids，单需求时使用 demand_id（向后兼容）
            const createData: any = {
              computation_type: computationType,
              computation_params: values.computation_params || {},
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
              onChange: value => setSelectedDemandIds(value),
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
            }}
          >
            <InventoryParamsForm bomMultiVersionAllowed={bomMultiVersionAllowed} />
          </ProForm.Item>
          <ProFormTextArea name="notes" label="备注" placeholder="请输入备注" />
        </ProForm>
      </Modal>

      {/* 详情Drawer - 使用 styles.wrapper 设置宽度，因 antd 6 的 size 可能被全局样式覆盖 */}
      <Drawer
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        title="计算详情"
        size={1300}
        rootClassName="demand-computation-drawer"
        styles={{ wrapper: { width: 1300 } }}
      >
        {currentComputation && (
          <>
            <ProDescriptions<DemandComputation>
              dataSource={currentComputation}
              columns={[
                { title: '计算编码', dataIndex: 'computation_code' },
                { title: '需求编码', dataIndex: 'demand_code' },
                {
                  title: '计算模式',
                  dataIndex: 'computation_type',
                  render: (t: string) => (t === 'MRP' ? '按预测' : '按订单'),
                },
                { title: '计算状态', dataIndex: 'computation_status' },
                { title: '开始时间', dataIndex: 'computation_start_time', valueType: 'dateTime' },
                { title: '结束时间', dataIndex: 'computation_end_time', valueType: 'dateTime' },
              ]}
            />

            {/* 物料来源验证结果 */}
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
                      render: (text: string) => (
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
                          return (
                            <Tag color={passed ? 'success' : 'error'}>
                              {passed ? '通过' : '失败'}
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
        )}
      </Drawer>
    </ListPageTemplate>
  )
}

export default DemandComputationPage
