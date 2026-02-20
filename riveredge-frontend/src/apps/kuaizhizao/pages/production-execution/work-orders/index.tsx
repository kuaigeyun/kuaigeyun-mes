/**
 * 工单管理页面
 *
 * 提供工单的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 * 支持MTS/MTO模式工单管理。
 * 支持工单拆分、冻结、优先级管理、合并、工序修改等高级功能。
 *
 * Author: Luigi Lu
 * Date: 2026-01-05
 */

import React, { useRef, useState, useEffect, useMemo } from 'react'
import {
  ActionType,
  ProColumns,
  ProDescriptionsItemProps,
  ProFormText,
  ProFormSelect,
  ProFormDatePicker,
  ProFormDigit,
  ProFormTextArea,
  ProFormRadio,
  ProFormSwitch,
  ProForm,
  ProFormGroup,
} from '@ant-design/pro-components'
import {
  App,
  Button,
  Tag,
  Space,
  Modal,
  Card,
  Row,
  Col,
  Table,
  InputNumber,
  Popconfirm,
  Select,
  Progress,
  Spin,
  Divider,
  Input,
  Timeline,
  Form,
  Segmented,
  ConfigProvider,
  theme,
  Typography,
  Empty,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  EyeOutlined,
  HolderOutlined,
  RightOutlined,
  PlayCircleOutlined,
  QrcodeOutlined,
  DeleteOutlined,
  PrinterOutlined,
} from '@ant-design/icons'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { UniTable } from '../../../../../components/uni-table'
import {
  ListPageTemplate,
  FormModalTemplate,
  DetailDrawerTemplate,
  MODAL_CONFIG,
  DRAWER_CONFIG,
  TOUCH_SCREEN_CONFIG,
} from '../../../../../components/layout-templates'
import { QRCodeGenerator } from '../../../../../components/qrcode'
import { qrcodeApi } from '../../../../../services/qrcode'
import { workOrderApi, reworkOrderApi, outsourceOrderApi } from '../../../services/production'
import {
  stateTransitionApi,
  AvailableTransition,
  StateTransitionLog,
} from '../../../services/state-transition'
import { listSalesOrders } from '../../../services/sales'
import { getSalesOrder } from '../../../services/sales-order'
import {
  listSalesForecasts,
  getSalesForecast,
  getSalesForecastItems,
} from '../../../services/sales-forecast'
import { listDemands, getDemand } from '../../../services/demand'
import { getDocumentRelations } from '../../../services/document-relation'
import { operationApi, processRouteApi } from '../../../../master-data/services/process'
import { workshopApi } from '../../../../master-data/services/factory'
import { supplierApi } from '../../../../master-data/services/supply-chain'
import { materialApi } from '../../../../master-data/services/material'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import CodeField from '../../../../../components/code-field'
import SmartSuggestionFloatPanel from '../../../../../components/smart-suggestion-float-panel'
import { getUserList } from '../../../../../services/user'
import { getEquipmentList } from '../../../../../services/equipment'
import WorkOrderPrintModal from './components/WorkOrderPrintModal'

interface WorkOrder {
  id?: number
  tenant_id?: number
  code?: string
  name?: string
  product_id?: number
  product_code?: string
  product_name?: string
  quantity?: number
  production_mode?: 'MTS' | 'MTO'
  sales_order_id?: number
  sales_order_code?: string
  sales_order_name?: string
  workshop_id?: number
  workshop_name?: string
  work_center_id?: number
  work_center_name?: string
  status?: string
  priority?: string
  planned_start_date?: string
  planned_end_date?: string
  actual_start_date?: string
  actual_end_date?: string
  completed_quantity?: number
  qualified_quantity?: number
  unqualified_quantity?: number
  is_frozen?: boolean
  freeze_reason?: string
  frozen_at?: string
  frozen_by?: number
  frozen_by_name?: string
  allow_operation_jump?: boolean
  manually_completed?: boolean
  remarks?: string
  created_at?: string
  updated_at?: string
}

const WorkOrdersPage: React.FC = () => {
  const { message: messageApi } = App.useApp()
  const { token } = theme.useToken()
  const actionRef = useRef<ActionType>(null)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])

  // 产品列表状态
  const [productList, setProductList] = useState<any[]>([])
  // 销售订单列表状态（MTO模式）
  const [salesOrderList, setSalesOrderList] = useState<any[]>([])
  // 生产模式状态（用于控制MTO相关字段显示）
  const [productionMode, setProductionMode] = useState<'MTS' | 'MTO'>('MTS')
  // 工序列表状态
  const [operationList, setOperationList] = useState<any[]>([])
  // 工艺路线列表状态
  const [processRouteList, setProcessRouteList] = useState<any[]>([])
  // 选中的工序列表（用于创建工单时）
  const [selectedOperations, setSelectedOperations] = useState<any[]>([])
  // 当前选中产品的物料来源信息
  const [selectedMaterialSourceInfo, setSelectedMaterialSourceInfo] = useState<{
    sourceType?: string
    sourceTypeName?: string
    validationErrors?: string[]
    canCreateWorkOrder?: boolean
  } | null>(null)
  // 只显示自制件
  const [onlyShowMake, setOnlyShowMake] = useState(false)
  // 从文档加载的产品列表（销售订单/销售预测/需求）
  const [productSourceData, setProductSourceData] = useState<{
    type: string
    materials: any[]
    items?: { productId: number; quantity: number }[]
  } | null>(null)
  // 选择文档弹窗
  const [productSourceModalVisible, setProductSourceModalVisible] = useState(false)
  const [productSourceModalType, setProductSourceModalType] = useState<
    'sales_order' | 'sales_forecast' | 'demand' | null
  >(null)
  const [productSourceDocList, setProductSourceDocList] = useState<any[]>([])
  const [productSourceDocLoading, setProductSourceDocLoading] = useState(false)
  // 加载产品来源文档列表（销售订单/销售预测/需求）- 直接拉平为明细行
  useEffect(() => {
    if (!productSourceModalVisible || !productSourceModalType) {
      setProductSourceDocList([])
      return
    }
    const load = async () => {
      setProductSourceDocLoading(true)
      try {
        if (productSourceModalType === 'sales_order') {
          const res = await listSalesOrders({ limit: 50 })
          const orders = Array.isArray(res) ? res : (res?.data ?? [])
          const ordersWithItems = await Promise.all(
            orders.map((o: any) => getSalesOrder(o.id, true))
          )
          const flat: any[] = []
          ordersWithItems.forEach((ord: any) => {
            ;(ord?.items ?? []).forEach((it: any, idx: number) => {
              flat.push({
                ...it,
                _doc_id: ord.id,
                _order_code: ord.order_code,
                _customer_name: ord.customer_name,
                _row_key: `${ord.id}-${it.id ?? it.material_id ?? idx}`,
              })
            })
          })
          setProductSourceDocList(flat)
        } else if (productSourceModalType === 'sales_forecast') {
          const res = await listSalesForecasts({ limit: 50 })
          const forecasts = res?.data ?? []
          const flat: any[] = []
          for (const f of forecasts) {
            const items = (await getSalesForecastItems(f.id)) ?? []
            items.forEach((it: any, idx: number) => {
              flat.push({
                ...it,
                _doc_id: f.id,
                _forecast_code: f.forecast_code,
                _forecast_name: f.forecast_name,
                _row_key: `${f.id}-${it.id ?? it.material_id ?? idx}`,
              })
            })
          }
          setProductSourceDocList(flat)
        } else if (productSourceModalType === 'demand') {
          const res = await listDemands({ limit: 50 })
          const demands = res?.data ?? []
          const demandsWithItems = await Promise.all(demands.map((d: any) => getDemand(d.id, true)))
          const flat: any[] = []
          demandsWithItems.forEach((d: any) => {
            ;(d?.items ?? []).forEach((it: any, idx: number) => {
              flat.push({
                ...it,
                _doc_id: d.id,
                _demand_code: d.demand_code,
                _demand_name: d.demand_name,
                _row_key: `${d.id}-${it.id ?? it.material_id ?? idx}`,
              })
            })
          })
          setProductSourceDocList(flat)
        }
      } catch (e) {
        console.error('加载文档列表失败:', e)
        setProductSourceDocList([])
      } finally {
        setProductSourceDocLoading(false)
      }
    }
    load()
  }, [productSourceModalVisible, productSourceModalType])

  // 产品选项：根据只显示自制件、文档来源过滤
  const productOptionsList = useMemo(() => {
    let list = productSourceData ? productSourceData.materials : productList
    if (!productSourceData && onlyShowMake) {
      list = productList.filter((m: any) => (m.sourceType || m.source_type) === 'Make')
    }
    return list
  }, [productList, onlyShowMake, productSourceData])

  // Modal 相关状态（创建/编辑工单）
  const [modalVisible, setModalVisible] = useState(false)
  const [isEdit, setIsEdit] = useState(false)
  const [currentWorkOrder, setCurrentWorkOrder] = useState<WorkOrder | null>(null)
  const formRef = useRef<any>(null)

  // 从加载来源填充表单：当 productSourceData 有 items 且新建工单弹窗打开时，自动填充产品与数量
  useEffect(() => {
    if (!productSourceData?.items?.length || !modalVisible || isEdit || !formRef.current) return
    const first = productSourceData.items[0]
    formRef.current.setFieldsValue({
      product_id: first.productId,
      quantity: first.quantity,
    })
    // 同步加载物料来源信息
    const selectedMaterial = productSourceData.materials.find((p: any) => p.id === first.productId)
    if (selectedMaterial) {
      materialApi
        .get(selectedMaterial.uuid)
        .then((materialDetail: any) => {
          const sourceType = materialDetail.sourceType || materialDetail.source_type
          const sourceTypeNames: Record<string, string> = {
            Make: '自制件',
            Buy: '采购件',
            Phantom: '虚拟件',
            Outsource: '委外件',
            Configure: '配置件',
          }
          let canCreateWorkOrder = true
          const validationErrors: string[] = []
          if (sourceType === 'Buy') {
            canCreateWorkOrder = false
            validationErrors.push('采购件不应创建生产工单，请使用采购订单功能')
          } else if (sourceType === 'Phantom') {
            canCreateWorkOrder = false
            validationErrors.push('虚拟件不应创建工单')
          } else if (sourceType === 'Make') validationErrors.push('自制件需配置BOM和工艺路线')
          else if (sourceType === 'Outsource') validationErrors.push('委外件需配置委外供应商和工序')
          setSelectedMaterialSourceInfo({
            sourceType,
            sourceTypeName: sourceType ? sourceTypeNames[sourceType] || sourceType : undefined,
            validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
            canCreateWorkOrder,
          })
        })
        .catch(() => setSelectedMaterialSourceInfo(null))
    } else {
      setSelectedMaterialSourceInfo(null)
    }
    // 自动加载物料绑定的工艺路线及工序
    if (selectedMaterial?.uuid) loadProcessRouteForMaterial(selectedMaterial.uuid)
  }, [productSourceData, modalVisible, isEdit])

  // 初始化产品列表
  useEffect(() => {
    const loadData = async () => {
      try {
        // 加载产品列表
        const products = await materialApi.list({ isActive: true })
        setProductList(products)

        // 加载工序列表
        try {
          const operations = await operationApi.list({ is_active: true })
          setOperationList(operations)
        } catch (error) {
          console.error('获取工序列表失败:', error)
          setOperationList([])
        }

        // 加载工艺路线列表
        try {
          const routes = await processRouteApi.list({ is_active: true })
          setProcessRouteList(routes)
        } catch (error) {
          console.error('获取工艺路线列表失败:', error)
          setProcessRouteList([])
        }

        // 加载人员列表（后端 page_size 最大 100）
        try {
          const users = await getUserList({ is_active: true, page_size: 100 })
          setWorkerList(users.items || [])
        } catch (error) {
          console.error('获取人员列表失败:', error)
          setWorkerList([])
        }

        // 加载设备列表
        try {
          const equipment = await getEquipmentList({ is_active: true, limit: 100 })
          setEquipmentList(equipment.items || [])
        } catch (error) {
          console.error('获取设备列表失败:', error)
          setEquipmentList([])
        }
      } catch (error) {
        console.error('获取数据失败:', error)
        setProductList([])
      }
    }
    loadData()
  }, [])

  // 加载销售订单列表（MTO模式或编辑时）
  useEffect(() => {
    const loadSalesOrders = async () => {
      // 如果是MTO模式，或者正在编辑且工单是MTO模式，加载销售订单列表
      if (
        productionMode === 'MTO' ||
        (modalVisible && currentWorkOrder?.production_mode === 'MTO')
      ) {
        try {
          const orders = await listSalesOrders({ order_type: 'MTO', status: '已确认' })
          setSalesOrderList(orders)
        } catch (error) {
          console.error('获取销售订单列表失败:', error)
          setSalesOrderList([])
        }
      }
    }
    loadSalesOrders()
  }, [productionMode, modalVisible, currentWorkOrder])

  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [workOrderDetail, setWorkOrderDetail] = useState<WorkOrder | null>(null)
  const [documentRelations, setDocumentRelations] = useState<DocumentRelation | null>(null)
  const [workOrderOperations, setWorkOrderOperations] = useState<any[]>([])
  const [operationsModalVisible, setOperationsModalVisible] = useState(false)
  const [currentOperation, setCurrentOperation] = useState<any>(null)
  const operationFormRef = useRef<any>()

  // 行展开相关状态
  const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([])
  const [expandedOperationsMap, setExpandedOperationsMap] = useState<Record<number, any[]>>({})
  const [loadingOperationsMap, setLoadingOperationsMap] = useState<Record<number, boolean>>({})

  // 创建返工单相关状态
  const [reworkModalVisible, setReworkModalVisible] = useState(false)
  const [currentWorkOrderForRework, setCurrentWorkOrderForRework] = useState<WorkOrder | null>(null)
  const reworkFormRef = useRef<any>(null)

  // 创建工序委外相关状态
  const [outsourceModalVisible, setOutsourceModalVisible] = useState(false)
  const [currentWorkOrderForOutsource, setCurrentWorkOrderForOutsource] =
    useState<WorkOrder | null>(null)
  const outsourceFormRef = useRef<any>(null)
  const [supplierList, setSupplierList] = useState<any[]>([])

  // 冻结/解冻相关状态
  const [freezeModalVisible, setFreezeModalVisible] = useState(false)
  const [currentWorkOrderForFreeze, setCurrentWorkOrderForFreeze] = useState<WorkOrder | null>(null)
  const freezeFormRef = useRef<any>(null)

  // 批量冻结相关状态
  const [batchFreezeModalVisible, setBatchFreezeModalVisible] = useState(false)
  const [batchFreezeReason, setBatchFreezeReason] = useState<string>('')

  // 批量设置优先级相关状态
  const [batchPriorityModalVisible, setBatchPriorityModalVisible] = useState(false)
  const [batchPriority, setBatchPriority] = useState<string>('normal')

  // 状态流转相关状态
  const [stateTransitionModalVisible, setStateTransitionModalVisible] = useState(false)
  const [availableTransitions, setAvailableTransitions] = useState<AvailableTransition[]>([])
  const [transitionHistory, setTransitionHistory] = useState<StateTransitionLog[]>([])
  const [transitionLoading, setTransitionLoading] = useState(false)
  const transitionFormRef = useRef<any>(null)

  // 合并工单相关状态
  const [mergeModalVisible, setMergeModalVisible] = useState(false)
  const mergeFormRef = useRef<any>(null)

  // 拆分工单相关状态
  const [splitModalVisible, setSplitModalVisible] = useState(false)
  const [currentWorkOrderForSplit, setCurrentWorkOrderForSplit] = useState<WorkOrder | null>(null)
  const [splitCount, setSplitCount] = useState<number>(2)
  const [splitType, setSplitType] = useState<'count' | 'quantity'>('count')
  const [splitQuantities, setSplitQuantities] = useState<number[]>([])

  // 派工相关状态
  const [dispatchModalVisible, setDispatchModalVisible] = useState(false)
  const [currentOperationForDispatch, setCurrentOperationForDispatch] = useState<any>(null)
  const [currentWorkOrderForDispatch, setCurrentWorkOrderForDispatch] = useState<WorkOrder | null>(
    null
  )
  const [workerList, setWorkerList] = useState<any[]>([])
  const [equipmentList, setEquipmentList] = useState<any[]>([])
  const dispatchFormRef = useRef<any>(null)

  // 打印相关状态
  const [printModalVisible, setPrintModalVisible] = useState(false)
  const [currentWorkOrderForPrint, setCurrentWorkOrderForPrint] = useState<any>(null)

  /** 解析工艺路线的 operation_sequence，兼容多种格式（与工艺路线编辑页保存格式对接） */
  const parseOperationSequence = (
    seq: any,
    opList: any[]
  ): {
    operation_id: number
    operation_code: string
    operation_name: string
    sequence: number
  }[] => {
    if (!seq || opList.length === 0) return []
    let items: any[] = []
    if (Array.isArray(seq)) {
      items = seq
    } else if (typeof seq === 'object') {
      if (Array.isArray(seq.operations)) {
        items = seq.operations
      } else if (Array.isArray(seq.sequence)) {
        items = seq.sequence.map((uuid: string, i: number) => ({ uuid, _idx: i }))
      } else if (seq.operation_ids || seq.operationIds) {
        const ids = seq.operation_ids ?? seq.operationIds ?? []
        items = ids.map((id: number, i: number) => ({
          operation_id: id,
          operationId: id,
          sequence: i + 1,
        }))
      } else {
        const vals = Object.values(seq).filter(
          (v: any) => v && (typeof v === 'object' || typeof v === 'string')
        )
        const arr = vals.find((v: any) => Array.isArray(v)) as any[] | undefined
        items = arr ?? vals
      }
    }
    const result: {
      operation_id: number
      operation_code: string
      operation_name: string
      sequence: number
    }[] = []
    items.forEach((item: any, index: number) => {
      let op: any = null
      if (item?.operation_id != null || item?.operationId != null) {
        const id = item.operation_id ?? item.operationId
        op = opList.find((o: any) => o.id === id)
      } else if (typeof item === 'string' || item?.uuid) {
        const uuid = typeof item === 'string' ? item : item.uuid
        op = opList.find((o: any) => (o.uuid ?? '') === uuid)
      } else if (item?.code || item?.name) {
        op = opList.find(
          (o: any) => o.uuid === item.uuid || (o.code === item.code && o.name === item.name)
        )
      }
      if (op) {
        result.push({
          operation_id: op.id,
          operation_code: op.code ?? op.mainCode ?? '',
          operation_name: op.name ?? '',
          sequence: item.sequence ?? item._idx ?? index + 1,
        })
      }
    })
    result.sort((a, b) => a.sequence - b.sequence)
    return result.map((r, i) => ({ ...r, sequence: i + 1 }))
  }

  /** 根据物料加载其绑定的工艺路线并填充工序 */
  const loadProcessRouteForMaterial = async (materialUuid: string) => {
    try {
      const route = await processRouteApi.getProcessRouteForMaterial(materialUuid)
      if (!route) {
        formRef.current?.setFieldsValue({ process_route_id: undefined })
        setSelectedOperations([])
        formRef.current?.setFieldsValue({ operations: undefined })
        return
      }
      formRef.current?.setFieldsValue({ process_route_id: route.id })
      const routeDetail = await processRouteApi.get(route.uuid)
      const operations = parseOperationSequence(routeDetail?.operation_sequence, operationList)
      if (operations.length > 0) {
        setSelectedOperations(operations)
        formRef.current?.setFieldsValue({ operations: operations.map((o: any) => o.operation_id) })
        messageApi.success(`已加载工艺路线及 ${operations.length} 个工序`)
      } else {
        setSelectedOperations([])
        formRef.current?.setFieldsValue({ operations: undefined })
      }
    } catch (e: any) {
      console.warn('加载工艺路线失败:', e)
      formRef.current?.setFieldsValue({ process_route_id: undefined, operations: undefined })
      setSelectedOperations([])
    }
  }

  /**
   * 处理新建工单
   */
  const handleCreate = () => {
    setIsEdit(false)
    setCurrentWorkOrder(null)
    setProductionMode('MTS') // 重置为MTS模式
    setSelectedOperations([]) // 清空选中的工序
    setSelectedMaterialSourceInfo(null) // 清空物料来源信息
    setModalVisible(true)
    formRef.current?.resetFields()
  }

  /**
   * 处理编辑工单
   */
  const handleEdit = async (record: WorkOrder) => {
    try {
      // 加载完整详情
      const detail = await workOrderApi.get(record.id!.toString())
      setIsEdit(true)
      setCurrentWorkOrder(detail)
      setModalVisible(true)
      // 延迟设置表单值，确保表单已渲染
      setTimeout(() => {
        const mode = detail.production_mode || 'MTS'
        setProductionMode(mode)
        formRef.current?.setFieldsValue({
          name: detail.name,
          product_id: detail.product_id,
          product_code: detail.product_code,
          product_name: detail.product_name,
          quantity: detail.quantity,
          production_mode: mode,
          sales_order_id: detail.sales_order_id,
          sales_order_code: detail.sales_order_code,
          sales_order_name: detail.sales_order_name,
          workshop_id: detail.workshop_id,
          workshop_name: detail.workshop_name,
          work_center_id: detail.work_center_id,
          work_center_name: detail.work_center_name,
          status: detail.status,
          priority: detail.priority,
          planned_start_date: detail.planned_start_date,
          planned_end_date: detail.planned_end_date,
          allow_operation_jump: detail.allow_operation_jump ?? false,
          remarks: detail.remarks,
        })
      }, 100)
    } catch (error) {
      messageApi.error('获取工单详情失败')
    }
  }

  /**
   * 处理行展开
   */
  const handleExpand = async (expanded: boolean, record: WorkOrder) => {
    if (expanded && record.id) {
      // 展开时加载工序数据
      if (!expandedOperationsMap[record.id]) {
        setLoadingOperationsMap(prev => ({ ...prev, [record.id!]: true }))
        try {
          const operations = await workOrderApi.getOperations(record.id!.toString())
          setExpandedOperationsMap(prev => ({ ...prev, [record.id!]: operations || [] }))
        } catch (error) {
          console.error('获取工单工序列表失败:', error)
          setExpandedOperationsMap(prev => ({ ...prev, [record.id!]: [] }))
        } finally {
          setLoadingOperationsMap(prev => ({ ...prev, [record.id!]: false }))
        }
      }
    }
  }

  /**
   * 打开派工弹窗
   */
  const handleOpenDispatchModal = (operation: any, workOrder: WorkOrder) => {
    setCurrentOperationForDispatch(operation)
    setCurrentWorkOrderForDispatch(workOrder)
    setDispatchModalVisible(true)
    // 如果已有派工信息，设置初始值
    setTimeout(() => {
      if (dispatchFormRef.current) {
        dispatchFormRef.current.setFieldsValue({
          assigned_worker_id: operation.assigned_worker_id,
          assigned_equipment_id: operation.assigned_equipment_id,
          remarks: operation.remarks,
        })
      }
    }, 100)
  }

  /**
   * 处理派工
   */
  const handleDispatch = async (values: any) => {
    try {
      if (!currentOperationForDispatch || !currentWorkOrderForDispatch) return

      const worker = workerList.find(w => w.id === values.assigned_worker_id)
      const equipment = equipmentList.find(e => e.id === values.assigned_equipment_id)

      const dispatchData = {
        assigned_worker_id: values.assigned_worker_id,
        assigned_worker_name: worker?.full_name || worker?.username || '-',
        assigned_equipment_id: values.assigned_equipment_id,
        assigned_equipment_name: equipment?.name || '-',
        remarks: values.remarks,
      }

      await workOrderApi.dispatchOperation(
        currentWorkOrderForDispatch.id!.toString(),
        currentOperationForDispatch.id,
        dispatchData
      )

      messageApi.success('派工成功')
      setDispatchModalVisible(false)

      // 刷新工序列表
      const operations = await workOrderApi.getOperations(
        currentWorkOrderForDispatch.id!.toString()
      )
      setExpandedOperationsMap(prev => ({
        ...prev,
        [currentWorkOrderForDispatch.id!]: operations || [],
      }))
    } catch (error: any) {
      messageApi.error(error.message || '派工失败')
    }
  }

  /**
   * 计算工序进度百分比
   */
  const calculateProgress = (operation: any, workOrder: WorkOrder) => {
    if (operation.reporting_type === 'status') {
      // 按状态报工：已完成返回100%，未完成返回0%
      return operation.status === 'completed' ? 100 : 0
    } else {
      // 按数量报工：已完成数量 / 计划数量
      const completed = Number(operation.completed_quantity || 0)
      const planned = Number(workOrder.quantity || 1)
      return Math.min(Math.round((completed / planned) * 100), 100)
    }
  }

  /**
   * 获取工序进度颜色
   */
  const getProgressColor = (operation: any, progress: number) => {
    if (operation.status === 'completed') {
      return '#52c41a' // 绿色：已完成
    }
    if (progress >= 95) {
      return '#52c41a' // 绿色：合格率达标
    }
    if (progress >= 80) {
      return '#faad14' // 黄色：合格率偏低
    }
    return '#ff4d4f' // 红色：异常或合格率过低
  }

  /**
   * 处理打印
   */
  const handlePrint = (record: WorkOrder) => {
    setCurrentWorkOrderForPrint(record)
    setPrintModalVisible(true)
  }

  /**
   * 计算合格率
   */
  const calculateQualifiedRate = (operation: any) => {
    const qualified = Number(operation.qualified_quantity || 0)
    const completed = Number(operation.completed_quantity || 0)
    if (completed === 0) return 0
    return Math.round((qualified / completed) * 100)
  }

  /**
   * 渲染工序卡片
   */
  const renderOperationCard = (
    operation: any,
    workOrder: WorkOrder,
    index: number,
    total: number
  ) => {
    const progress = calculateProgress(operation, workOrder)
    const qualifiedRate = calculateQualifiedRate(operation)
    const progressColor = getProgressColor(operation, qualifiedRate)

    return (
      <React.Fragment key={operation.id || index}>
        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
          <Card
            size="small"
            style={{
              width: 200,
              border:
                operation.status === 'completed'
                  ? '2px solid #52c41a'
                  : operation.status === 'in_progress'
                    ? '2px solid #1890ff'
                    : '1px solid #d9d9d9',
            }}
            title={
              <div style={{ fontSize: 14, fontWeight: 'bold' }}>{operation.operation_name}</div>
            }
            extra={
              <Tag
                color={
                  operation.status === 'completed'
                    ? 'success'
                    : operation.status === 'in_progress'
                      ? 'processing'
                      : 'default'
                }
              >
                {operation.status === 'completed'
                  ? '已完成'
                  : operation.status === 'in_progress'
                    ? '进行中'
                    : '待开始'}
              </Tag>
            }
          >
            {/* 环状图进度显示 */}
            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              <Progress
                type="circle"
                percent={progress}
                size={80}
                strokeColor={progressColor}
                format={percent => `${percent}%`}
              />
              <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                {operation.reporting_type === 'status' ? (
                  <div>
                    <div>状态：{operation.status === 'completed' ? '已完成' : '未完成'}</div>
                  </div>
                ) : (
                  <div>
                    <div>
                      完成：{operation.completed_quantity || 0} / {workOrder.quantity}
                    </div>
                    <div>
                      合格：{operation.qualified_quantity || 0} / 不合格：
                      {operation.unqualified_quantity || 0}
                    </div>
                    {operation.completed_quantity > 0 && (
                      <div
                        style={{
                          color:
                            qualifiedRate >= 95
                              ? '#52c41a'
                              : qualifiedRate >= 80
                                ? '#faad14'
                                : '#ff4d4f',
                        }}
                      >
                        合格率：{qualifiedRate}%
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 工序信息 */}
            <div style={{ fontSize: 12, color: '#666' }}>
              <div style={{ marginBottom: 4 }}>
                <strong>车间：</strong>
                {operation.workshop_name || '-'}
              </div>
              <div style={{ marginBottom: 4 }}>
                <strong>工作中心：</strong>
                {operation.work_center_name || '-'}
              </div>
              {operation.planned_start_date && (
                <div style={{ marginBottom: 4 }}>
                  <strong>计划时间：</strong>
                  <div>
                    {new Date(operation.planned_start_date).toLocaleString('zh-CN', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              )}
              {operation.actual_start_date && (
                <div style={{ marginBottom: 4 }}>
                  <strong>实际开始：</strong>
                  <div>
                    {new Date(operation.actual_start_date).toLocaleString('zh-CN', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              )}
              {/* 派工信息 */}
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed #e8e8e8' }}>
                <div style={{ marginBottom: 4 }}>
                  <strong>负责人：</strong>
                  {operation.assigned_worker_name || <span style={{ color: '#ccc' }}>未分配</span>}
                </div>
                <div style={{ marginBottom: 4 }}>
                  <strong>设备：</strong>
                  {operation.assigned_equipment_name || (
                    <span style={{ color: '#ccc' }}>未分配</span>
                  )}
                </div>
              </div>
            </div>

            {/* 操作按钮 */}
            <div
              style={{
                marginTop: 12,
                textAlign: 'center',
                display: 'flex',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {operation.status !== 'completed' && (
                <Button
                  type="link"
                  size="small"
                  icon={<EditOutlined style={{ fontSize: 12 }} />}
                  onClick={() => handleOpenDispatchModal(operation, workOrder)}
                >
                  派工
                </Button>
              )}
              {operation.status === 'pending' && (
                <Button
                  type="primary"
                  size="small"
                  icon={<PlayCircleOutlined />}
                  onClick={async () => {
                    try {
                      // 开始工序
                      await workOrderApi.startOperation(workOrder.id!.toString(), operation.id)
                      messageApi.success('工序已开始')
                      // 刷新工序列表
                      const operations = await workOrderApi.getOperations(workOrder.id!.toString())
                      setExpandedOperationsMap(prev => ({
                        ...prev,
                        [workOrder.id!]: operations || [],
                      }))
                      // 刷新工单列表
                      actionRef.current?.reload()
                    } catch (error: any) {
                      messageApi.error(error.message || '开始工序失败')
                    }
                  }}
                >
                  开始
                </Button>
              )}
              {operation.status === 'in_progress' && (
                <Tag color="processing" style={{ margin: 0 }}>
                  进行中
                </Tag>
              )}
              {operation.status === 'completed' && (
                <Tag color="success" style={{ margin: 0 }}>
                  已完成
                </Tag>
              )}
            </div>
          </Card>
        </div>
        {/* 箭头连接（不是最后一个） */}
        {index < total - 1 && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              marginLeft: 8,
              marginRight: 8,
              alignSelf: 'center',
            }}
          >
            <RightOutlined style={{ fontSize: 24, color: '#d9d9d9' }} />
          </div>
        )}
      </React.Fragment>
    )
  }

  /**
   * 渲染展开行内容
   */
  const renderExpandedRow = (record: WorkOrder) => {
    const operations = expandedOperationsMap[record.id!] || []
    const loading = loadingOperationsMap[record.id!]

    if (loading) {
      return (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <Spin size="large" />
        </div>
      )
    }

    if (operations.length === 0) {
      return <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>暂无工序信息</div>
    }

    return (
      <div style={{ padding: '20px', backgroundColor: '#fafafa', overflowX: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'nowrap' }}>
          {operations.map((operation: any, index: number) =>
            renderOperationCard(operation, record, index, operations.length)
          )}
        </div>
      </div>
    )
  }

  /**
   * 处理批量生成二维码
   */
  const handleBatchGenerateQRCode = async () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning('请先选择要生成二维码的工单')
      return
    }

    try {
      // 通过API获取选中的工单数据
      const workOrders = await Promise.all(
        selectedRowKeys.map(async key => {
          try {
            return await workOrderApi.get(key.toString())
          } catch (error) {
            console.error(`获取工单失败: ${key}`, error)
            return null
          }
        })
      )

      const validWorkOrders = workOrders.filter(wo => wo !== null) as WorkOrder[]

      if (validWorkOrders.length === 0) {
        messageApi.error('无法获取选中的工单数据')
        return
      }

      // 生成二维码
      const qrcodePromises = validWorkOrders.map(workOrder =>
        qrcodeApi.generateWorkOrder({
          work_order_uuid: workOrder.id?.toString() || '',
          work_order_code: workOrder.code || '',
          material_code: workOrder.product_code || '',
        })
      )

      const qrcodes = await Promise.all(qrcodePromises)
      messageApi.success(`成功生成 ${qrcodes.length} 个工单二维码`)

      // TODO: 可以打开一个Modal显示所有二维码，或者提供下载功能
    } catch (error: any) {
      messageApi.error(`批量生成二维码失败: ${error.message || '未知错误'}`)
    }
  }

  /**
   * 处理查看详情
   */
  const handleDetail = async (record: WorkOrder) => {
    try {
      // 加载完整详情数据
      const detail = await workOrderApi.get(record.id!.toString())
      setWorkOrderDetail(detail)

      // 获取单据关联关系
      try {
        const relations = await getDocumentRelations('work_order', record.id!)
        setDocumentRelations(relations)
      } catch (error) {
        console.error('获取单据关联关系失败:', error)
        setDocumentRelations(null)
      }

      // 加载工单工序列表
      try {
        const operations = await workOrderApi.getOperations(record.id!.toString())
        setWorkOrderOperations(operations)
      } catch (error) {
        console.error('获取工单工序列表失败:', error)
        setWorkOrderOperations([])
      }

      // 加载状态流转历史和可用状态流转选项
      try {
        if (detail.status) {
          const [history, transitions] = await Promise.all([
            stateTransitionApi.getHistory('work_order', record.id!),
            stateTransitionApi.getAvailableTransitions('work_order', detail.status),
          ])
          setTransitionHistory(history)
          setAvailableTransitions(transitions)
        }
      } catch (error) {
        console.error('获取状态流转信息失败:', error)
        setTransitionHistory([])
        setAvailableTransitions([])
      }

      setDrawerVisible(true)
    } catch (error) {
      messageApi.error('获取工单详情失败')
    }
  }

  /**
   * 处理删除工单
   */
  const handleDelete = async (keys: React.Key[]) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除 ${keys.length} 个工单吗？`,
      onOk: async () => {
        try {
          // 批量删除
          await Promise.all(keys.map(key => workOrderApi.delete(key.toString())))
          messageApi.success('删除成功')
          actionRef.current?.reload()
        } catch (error: any) {
          messageApi.error(error.message || '删除失败')
        }
      },
    })
  }

  /**
   * 处理提交表单（创建/更新）
   */
  const handleSubmit = async (values: any): Promise<void> => {
    try {
      // 物料来源验证（核心功能，新增）
      if (values.product_id && selectedMaterialSourceInfo) {
        if (selectedMaterialSourceInfo.canCreateWorkOrder === false) {
          messageApi.error('该物料来源类型不允许创建生产工单，请选择其他物料或使用相应的功能模块')
          throw new Error('物料来源类型不允许创建工单')
        }
      }

      // 工单编码由CodeField组件自动处理，无需额外逻辑

      // 确保生产模式：如果选择了销售订单，自动设置为MTO，否则为MTS
      if (values.sales_order_id) {
        values.production_mode = 'MTO'
      } else {
        values.production_mode = values.production_mode || 'MTS'
      }

      // 处理工序设置
      // 如果选择了工序，需要转换为后端需要的格式
      if (values.operations && Array.isArray(values.operations) && values.operations.length > 0) {
        // 将工序ID数组转换为工序对象数组（包含 operation_code 和 operation_name）
        values.operations = values.operations.map((opId: number, index: number) => {
          const operationDetail = operationList.find(op => op.id === opId)
          if (!operationDetail) {
            throw new Error(`工序ID ${opId} 不存在`)
          }
          return {
            operation_id: opId,
            operation_code: operationDetail.code,
            operation_name: operationDetail.name,
            sequence: index + 1,
          }
        })
      } else if (selectedOperations.length > 0) {
        // 使用从工艺路线加载的工序
        values.operations = selectedOperations.map((op: any) => ({
          operation_id: op.operation_id,
          operation_code: op.operation_code,
          operation_name: op.operation_name,
          sequence: op.sequence,
        }))
      } else {
        // 没有选择工序，删除该字段，让后端自动匹配
        delete values.operations
      }

      // 如果选择了产品，需要转换为产品编码和名称
      if (values.product_id && !isEdit) {
        const selectedProduct = productList.find(product => product.id === values.product_id)
        if (selectedProduct) {
          values.product_code = selectedProduct.code
          values.product_name = selectedProduct.name
        }
      }

      if (isEdit && currentWorkOrder?.id) {
        await workOrderApi.update(currentWorkOrder.id.toString(), values)
        messageApi.success('工单更新成功')
      } else {
        await workOrderApi.create(values)
        messageApi.success('工单创建成功！系统已自动匹配工艺路线并生成工序单')
      }
      setModalVisible(false)
      actionRef.current?.reload()
    } catch (error: any) {
      messageApi.error(error.message || '操作失败')
      throw error
    }
  }

  /**
   * 详情列定义
   */
  const detailColumns: ProDescriptionsItemProps<WorkOrder>[] = [
    {
      title: '工单编号',
      dataIndex: 'code',
    },
    {
      title: '工单名称',
      dataIndex: 'name',
    },
    {
      title: '产品编码',
      dataIndex: 'product_code',
    },
    {
      title: '产品名称',
      dataIndex: 'product_name',
    },
    {
      title: '计划数量',
      dataIndex: 'quantity',
    },
    {
      title: '生产模式',
      dataIndex: 'production_mode',
      render: (_, record) => (
        <Tag color={record.production_mode === 'MTO' ? 'blue' : 'green'}>
          {record.production_mode === 'MTO' ? '按订单生产' : '按库存生产'}
        </Tag>
      ),
    },
    {
      title: '销售订单',
      dataIndex: 'sales_order_code',
      render: (_, record) =>
        record.production_mode === 'MTO' ? record.sales_order_code || '-' : '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (_, record) => {
        const statusMap: Record<string, { text: string; color: string }> = {
          草稿: { text: '草稿', color: 'default' },
          已下达: { text: '已下达', color: 'processing' },
          生产中: { text: '生产中', color: 'processing' },
          已完成: { text: '已完成', color: 'success' },
          已取消: { text: '已取消', color: 'error' },
        }
        const config = statusMap[record.status || ''] || {
          text: record.status || '-',
          color: 'default',
        }
        return <Tag color={config.color}>{config.text}</Tag>
      },
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 100,
      render: (_, record) => {
        const priorityMap: Record<string, { text: string; color: string }> = {
          low: { text: '低', color: 'default' },
          normal: { text: '正常', color: 'blue' },
          high: { text: '高', color: 'orange' },
          urgent: { text: '紧急', color: 'red' },
        }
        const config = priorityMap[record.priority || 'normal'] || {
          text: record.priority || '正常',
          color: 'blue',
        }
        return <Tag color={config.color}>{config.text}</Tag>
      },
    },
    {
      title: '计划开始时间',
      dataIndex: 'planned_start_date',
      valueType: 'dateTime',
    },
    {
      title: '计划结束时间',
      dataIndex: 'planned_end_date',
      valueType: 'dateTime',
    },
    {
      title: '实际开始时间',
      dataIndex: 'actual_start_date',
      valueType: 'dateTime',
      render: text => text || '-',
    },
    {
      title: '实际结束时间',
      dataIndex: 'actual_end_date',
      valueType: 'dateTime',
      render: text => text || '-',
    },
    {
      title: '已完成数量',
      dataIndex: 'completed_quantity',
      render: text => text || 0,
    },
    {
      title: '合格数量',
      dataIndex: 'qualified_quantity',
      render: text => text || 0,
    },
    {
      title: '不合格数量',
      dataIndex: 'unqualified_quantity',
      render: text => text || 0,
    },
    {
      title: '备注',
      dataIndex: 'remarks',
      span: 2,
      render: text => text || '-',
    },
  ]

  // 批量下达相关状态
  const [batchReleaseModalVisible, setBatchReleaseModalVisible] = useState(false)
  const [batchReleaseCheckResults, setBatchReleaseCheckResults] = useState<any[]>([])
  const [batchReleaseLoading, setBatchReleaseLoading] = useState(false)

  /**
   * 处理批量下达工单（核心功能，新增）
   */
  const handleBatchRelease = async () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning('请至少选择一个工单')
      return
    }

    setBatchReleaseLoading(true)
    setBatchReleaseModalVisible(true)

    try {
      // 获取选中的工单详情
      const workOrders = await Promise.all(
        selectedRowKeys.map(key => workOrderApi.get(key.toString()))
      )

      // 执行智能检查
      const checkResults = await Promise.all(
        workOrders.map(async wo => {
          const checks: any = {
            workOrder: wo,
            passed: true,
            errors: [],
            warnings: [],
          }

          // 检查1：冻结工单检查
          if (wo.is_frozen) {
            checks.passed = false
            checks.errors.push('工单已冻结，不能下达')
          }

          // 检查2：状态检查（只能下达草稿或已排产的工单）
          if (wo.status !== 'draft' && wo.status !== 'released') {
            checks.passed = false
            checks.errors.push(`工单状态为"${wo.status}"，不能下达`)
          }

          // 检查3：齐套料检查（TODO: 调用后端API检查物料齐套情况）
          // 这里先模拟，后续对接后端API
          // const materialCheck = await checkMaterialAvailability(wo);
          // if (!materialCheck.available) {
          //   checks.warnings.push(`物料不齐套：${materialCheck.missingMaterials.join(', ')}`);
          // }

          // 检查4：交期风险评估（TODO: 调用后端API评估交期风险）
          // 这里先模拟，后续对接后端API
          // const deadlineRisk = await assessDeadlineRisk(wo);
          // if (deadlineRisk.risk === 'high') {
          //   checks.warnings.push(`交期风险高：预计延期${deadlineRisk.delayDays}天`);
          // }

          // 检查5：工作中心能力检查（TODO: 调用后端API检查工作中心产能）
          // 这里先模拟，后续对接后端API
          // const capacityCheck = await checkWorkCenterCapacity(wo);
          // if (capacityCheck.conflict) {
          //   checks.warnings.push(`工作中心产能冲突：${capacityCheck.conflictWorkCenters.join(', ')}`);
          // }

          // 检查6：计划时间检查（优化，新增）
          if (wo.planned_start_date && wo.planned_end_date) {
            const startDate = new Date(wo.planned_start_date)
            const endDate = new Date(wo.planned_end_date)
            const now = new Date()

            if (startDate > now) {
              checks.warnings.push(`计划开始时间在未来：${wo.planned_start_date}`)
            }

            if (endDate < now) {
              checks.errors.push(`计划结束时间已过期：${wo.planned_end_date}`)
              checks.passed = false
            }

            if (startDate > endDate) {
              checks.errors.push('计划开始时间晚于结束时间')
              checks.passed = false
            }
          }

          // 检查7：数量检查（优化，新增）
          if (!wo.quantity || wo.quantity <= 0) {
            checks.errors.push('工单数量无效或为0')
            checks.passed = false
          }

          return checks
        })
      )

      setBatchReleaseCheckResults(checkResults)
    } catch (error: any) {
      messageApi.error(error.message || '批量检查失败')
    } finally {
      setBatchReleaseLoading(false)
    }
  }

  /**
   * 处理提交批量下达
   */
  const handleSubmitBatchRelease = async (ignoreErrors: boolean = false) => {
    try {
      const workOrderIds = selectedRowKeys.map(key => Number(key))

      // 如果忽略错误，下达所有工单；否则只下达通过检查的工单
      const idsToRelease = ignoreErrors
        ? workOrderIds
        : batchReleaseCheckResults
            .filter(result => result.passed)
            .map(result => result.workOrder.id)

      if (idsToRelease.length === 0) {
        messageApi.warning('没有可下达的工单')
        return
      }

      // 确认对话框（优化，新增）
      Modal.confirm({
        title: '确认批量下达',
        content: `确定要${ignoreErrors ? '强制' : ''}下达 ${idsToRelease.length} 个工单吗？${ignoreErrors ? '（将忽略所有错误和警告）' : ''}`,
        onOk: async () => {
          try {
            // 批量下达工单
            await Promise.all(idsToRelease.map(id => workOrderApi.release(id.toString())))

            messageApi.success(`已批量下达 ${idsToRelease.length} 个工单`)
            setBatchReleaseModalVisible(false)
            setSelectedRowKeys([])
            setBatchReleaseCheckResults([])
            actionRef.current?.reload()
          } catch (error: any) {
            messageApi.error(error.message || '批量下达失败')
          }
        },
      })
    } catch (error: any) {
      messageApi.error(error.message || '批量下达失败')
    }
  }

  /**
   * 处理下达工单
   */
  const handleRelease = async (record: WorkOrder) => {
    try {
      await workOrderApi.release(record.id!.toString())
      messageApi.success('工单下达成功')
      actionRef.current?.reload()
    } catch (error: any) {
      messageApi.error(error?.message || '工单下达失败')
    }
  }

  /**
   * 处理撤回工单
   */
  const handleRevoke = async (record: WorkOrder) => {
    Modal.confirm({
      title: '确认撤回',
      content: `确定要撤回工单"${record.code}"吗？撤回后工单将变为草稿状态。`,
      onOk: async () => {
        try {
          await workOrderApi.revoke(record.id!.toString())
          messageApi.success('工单撤回成功')
          actionRef.current?.reload()
        } catch (error: any) {
          messageApi.error(error.message || '工单撤回失败')
        }
      },
    })
  }

  /**
   * 处理指定结束工单
   */
  const handleComplete = async (record: WorkOrder) => {
    Modal.confirm({
      title: '确认指定结束',
      content: `确定要指定结束工单"${record.code}"吗？指定结束的工单如果没有报工记录，可以撤回。`,
      onOk: async () => {
        try {
          await workOrderApi.complete(record.id!.toString())
          messageApi.success('工单已指定结束')
          actionRef.current?.reload()
        } catch (error: any) {
          messageApi.error(error.message || '指定结束失败')
        }
      },
    })
  }

  /**
   * 处理创建返工单
   */
  const handleCreateRework = async (record: WorkOrder) => {
    try {
      const detail = await workOrderApi.get(record.id!.toString())
      setCurrentWorkOrderForRework(detail)
      setReworkModalVisible(true)
      setTimeout(() => {
        reworkFormRef.current?.setFieldsValue({
          original_work_order_id: detail.id,
          original_work_order_uuid: detail.uuid || detail.id?.toString(),
          product_id: detail.product_id,
          product_code: detail.product_code,
          product_name: detail.product_name,
          workshop_id: detail.workshop_id,
          workshop_name: detail.workshop_name,
          work_center_id: detail.work_center_id,
          work_center_name: detail.work_center_name,
          quantity: 1, // 默认返工数量为1
          rework_type: '返工',
          status: 'draft',
        })
      }, 100)
    } catch (error) {
      messageApi.error('获取工单详情失败')
    }
  }

  /**
   * 处理提交返工单表单
   */
  const handleSubmitRework = async (values: any): Promise<void> => {
    try {
      if (!currentWorkOrderForRework?.id) {
        throw new Error('原工单信息不存在')
      }
      // 使用ReworkOrderFromWorkOrderRequest格式
      const submitData = {
        rework_reason: values.rework_reason,
        rework_type: values.rework_type,
        quantity: values.quantity ? Number(values.quantity) : undefined,
        route_id: values.route_id || undefined,
        work_center_id:
          values.work_center_id || currentWorkOrderForRework.work_center_id || undefined,
        remarks: values.remarks || undefined,
      }
      await reworkOrderApi.createFromWorkOrder(currentWorkOrderForRework.id.toString(), submitData)
      messageApi.success('返工单创建成功')
      setReworkModalVisible(false)
      setCurrentWorkOrderForRework(null)
      reworkFormRef.current?.resetFields()
    } catch (error: any) {
      messageApi.error(error.message || '创建返工单失败')
      throw error
    }
  }

  /**
   * 处理创建工序委外
   */
  const handleCreateOutsource = async (record: WorkOrder) => {
    try {
      const detail = await workOrderApi.get(record.id!.toString())
      setCurrentWorkOrderForOutsource(detail)

      // 加载供应商列表
      try {
        const suppliers = await supplierApi.list({ isActive: true })
        setSupplierList(suppliers || [])
      } catch (error) {
        console.error('加载供应商列表失败:', error)
        setSupplierList([])
      }

      // 加载工单工序列表（如果还没有加载）
      if (!workOrderOperations || workOrderOperations.length === 0) {
        try {
          const operations = await workOrderApi.getOperations(record.id!.toString())
          setWorkOrderOperations(operations)
        } catch (error) {
          console.error('获取工单工序列表失败:', error)
        }
      }

      setOutsourceModalVisible(true)
      setTimeout(() => {
        outsourceFormRef.current?.resetFields()
      }, 100)
    } catch (error) {
      messageApi.error('获取工单详情失败')
    }
  }

  /**
   * 处理提交工序委外表单
   */
  const handleSubmitOutsource = async (values: any): Promise<void> => {
    try {
      if (!currentWorkOrderForOutsource?.id) {
        throw new Error('工单信息不存在')
      }

      const submitData = {
        work_order_operation_id: values.work_order_operation_id,
        supplier_id: values.supplier_id,
        outsource_quantity: values.outsource_quantity,
        unit_price: values.unit_price,
        planned_start_date: values.planned_start_date
          ? values.planned_start_date.format('YYYY-MM-DD HH:mm:ss')
          : undefined,
        planned_end_date: values.planned_end_date
          ? values.planned_end_date.format('YYYY-MM-DD HH:mm:ss')
          : undefined,
        remarks: values.remarks,
      }

      await outsourceOrderApi.createFromWorkOrder(
        currentWorkOrderForOutsource.id.toString(),
        submitData
      )
      messageApi.success('工序委外创建成功')
      setOutsourceModalVisible(false)
      setCurrentWorkOrderForOutsource(null)
      outsourceFormRef.current?.resetFields()
    } catch (error: any) {
      messageApi.error(error.message || '创建工序委外失败')
      throw error
    }
  }

  /**
   * 处理冻结工单
   */
  const handleFreeze = async (record: WorkOrder) => {
    try {
      const detail = await workOrderApi.get(record.id!.toString())
      setCurrentWorkOrderForFreeze(detail)
      setFreezeModalVisible(true)
      freezeFormRef.current?.resetFields()
    } catch (error) {
      messageApi.error('获取工单详情失败')
    }
  }

  /**
   * 处理解冻工单
   */
  const handleUnfreeze = async (record: WorkOrder) => {
    Modal.confirm({
      title: '确认解冻',
      content: `确定要解冻工单"${record.code}"吗？`,
      onOk: async () => {
        try {
          await workOrderApi.unfreeze(record.id!.toString())
          messageApi.success('工单解冻成功')
          actionRef.current?.reload()
          // 如果详情页打开，刷新详情
          if (workOrderDetail?.id === record.id) {
            const detail = await workOrderApi.get(record.id!.toString())
            setWorkOrderDetail(detail)
          }
        } catch (error: any) {
          messageApi.error(error.message || '工单解冻失败')
        }
      },
    })
  }

  /**
   * 处理批量冻结工单
   */
  const handleBatchFreeze = () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning('请至少选择一个工单')
      return
    }
    setBatchFreezeReason('')
    setBatchFreezeModalVisible(true)
  }

  /**
   * 处理提交批量冻结
   */
  const handleSubmitBatchFreeze = async (): Promise<void> => {
    if (!batchFreezeReason.trim()) {
      messageApi.error('请输入冻结原因')
      return
    }

    try {
      await Promise.all(
        selectedRowKeys.map(key =>
          workOrderApi.freeze(key.toString(), { freeze_reason: batchFreezeReason })
        )
      )
      messageApi.success(`已批量冻结 ${selectedRowKeys.length} 个工单`)
      setBatchFreezeModalVisible(false)
      setBatchFreezeReason('')
      setSelectedRowKeys([])
      actionRef.current?.reload()
    } catch (error: any) {
      messageApi.error(error.message || '批量冻结失败')
    }
  }

  /**
   * 处理批量取消工单
   */
  const handleBatchCancel = async () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning('请至少选择一个工单')
      return
    }

    Modal.confirm({
      title: '确认批量取消',
      content: `确定要取消 ${selectedRowKeys.length} 个工单吗？`,
      onOk: async () => {
        try {
          await Promise.all(
            selectedRowKeys.map(key => workOrderApi.update(key.toString(), { status: 'cancelled' }))
          )
          messageApi.success(`已批量取消 ${selectedRowKeys.length} 个工单`)
          setSelectedRowKeys([])
          actionRef.current?.reload()
        } catch (error: any) {
          messageApi.error(error.message || '批量取消失败')
        }
      },
    })
  }

  /**
   * 处理提交冻结表单
   */
  const handleSubmitFreeze = async (values: any): Promise<void> => {
    try {
      if (!currentWorkOrderForFreeze?.id) {
        throw new Error('工单信息不存在')
      }
      await workOrderApi.freeze(currentWorkOrderForFreeze.id.toString(), values)
      messageApi.success('工单冻结成功')
      setFreezeModalVisible(false)
      setCurrentWorkOrderForFreeze(null)
      freezeFormRef.current?.resetFields()
      actionRef.current?.reload()
      // 如果详情页打开，刷新详情
      if (workOrderDetail?.id === currentWorkOrderForFreeze.id) {
        const detail = await workOrderApi.get(currentWorkOrderForFreeze.id.toString())
        setWorkOrderDetail(detail)
      }
    } catch (error: any) {
      messageApi.error(error.message || '工单冻结失败')
      throw error
    }
  }

  /**
   * 处理设置工单优先级
   */
  const handleSetPriority = async (record: WorkOrder, newPriority: string) => {
    try {
      await workOrderApi.setPriority(record.id!.toString(), { priority: newPriority })
      messageApi.success('优先级设置成功')
      actionRef.current?.reload()
      // 如果详情页打开，刷新详情
      if (workOrderDetail?.id === record.id) {
        const detail = await workOrderApi.get(record.id!.toString())
        setWorkOrderDetail(detail)
      }
    } catch (error: any) {
      messageApi.error(error.message || '优先级设置失败')
    }
  }

  /**
   * 处理批量设置优先级
   */
  const handleBatchSetPriority = () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning('请至少选择一个工单')
      return
    }
    setBatchPriority('normal')
    setBatchPriorityModalVisible(true)
  }

  /**
   * 处理状态流转
   */
  const handleStateTransition = async () => {
    if (!workOrderDetail?.id) {
      messageApi.warning('工单信息不存在')
      return
    }

    try {
      // 重新获取可用状态流转选项
      const transitions = await stateTransitionApi.getAvailableTransitions(
        'work_order',
        workOrderDetail.status || 'draft'
      )
      setAvailableTransitions(transitions)
      setStateTransitionModalVisible(true)
      transitionFormRef.current?.resetFields()
    } catch (error: any) {
      messageApi.error(error.message || '获取状态流转选项失败')
    }
  }

  /**
   * 处理提交状态流转
   */
  const handleSubmitStateTransition = async (values: any): Promise<void> => {
    if (!workOrderDetail?.id) {
      throw new Error('工单信息不存在')
    }

    try {
      setTransitionLoading(true)
      await stateTransitionApi.transition('work_order', workOrderDetail.id, {
        to_state: values.to_state,
        transition_reason: values.transition_reason,
        transition_comment: values.transition_comment,
      })

      messageApi.success('状态流转成功')
      setStateTransitionModalVisible(false)

      // 刷新工单详情和状态流转历史
      const [detail, history] = await Promise.all([
        workOrderApi.get(workOrderDetail.id.toString()),
        stateTransitionApi.getHistory('work_order', workOrderDetail.id),
      ])
      setWorkOrderDetail(detail)
      setTransitionHistory(history)

      // 重新获取可用状态流转选项
      if (detail.status) {
        const transitions = await stateTransitionApi.getAvailableTransitions(
          'work_order',
          detail.status
        )
        setAvailableTransitions(transitions)
      }

      // 刷新列表
      actionRef.current?.reload()
    } catch (error: any) {
      messageApi.error(error.message || '状态流转失败')
      throw error
    } finally {
      setTransitionLoading(false)
    }
  }

  /**
   * 处理提交批量设置优先级
   */
  const handleSubmitBatchPriority = async () => {
    try {
      await workOrderApi.batchSetPriority({
        work_order_ids: selectedRowKeys.map(key => Number(key)),
        priority: batchPriority,
      })
      messageApi.success(`已批量设置 ${selectedRowKeys.length} 个工单的优先级`)
      setBatchPriorityModalVisible(false)
      setSelectedRowKeys([])
      actionRef.current?.reload()
    } catch (error: any) {
      messageApi.error(error.message || '批量设置优先级失败')
    }
  }

  /**
   * 处理合并工单
   */
  const handleMerge = () => {
    if (selectedRowKeys.length < 2) {
      messageApi.warning('请至少选择2个工单进行合并')
      return
    }
    // 合并功能将在Modal中实现
    setMergeModalVisible(true)
  }

  /**
   * 处理提交合并工单
   */
  const handleSubmitMerge = async (values: any): Promise<void> => {
    try {
      const result = await workOrderApi.merge({
        work_order_ids: selectedRowKeys.map(key => Number(key)),
        remarks: values.remarks,
      })
      messageApi.success(`工单合并成功，新工单编码：${result.merged_work_order.code}`)
      setMergeModalVisible(false)
      setSelectedRowKeys([])
      actionRef.current?.reload()
    } catch (error: any) {
      messageApi.error(error.message || '工单合并失败')
      throw error
    }
  }

  /**
   * 处理拆分工单
   */
  const handleSplit = async (record: WorkOrder) => {
    try {
      const detail = await workOrderApi.get(record.id!.toString())
      setCurrentWorkOrderForSplit(detail)
      setSplitModalVisible(true)
      setSplitType('count')
      setSplitCount(2)
      setSplitQuantities([])
    } catch (error) {
      messageApi.error('获取工单详情失败')
    }
  }

  /**
   * 处理提交拆分表单
   */
  const handleSubmitSplit = async (): Promise<void> => {
    try {
      if (!currentWorkOrderForSplit?.id) {
        throw new Error('原工单信息不存在')
      }

      let splitData: any = {
        split_type: 'quantity',
        remarks: '',
      }

      if (splitType === 'count') {
        // 等量拆分
        splitData.split_count = splitCount
      } else {
        // 指定数量拆分
        if (splitQuantities.length === 0 || splitQuantities.some(q => q <= 0)) {
          messageApi.error('请输入有效的拆分数量')
          return
        }
        splitData.split_quantities = splitQuantities
      }

      const result = await workOrderApi.split(currentWorkOrderForSplit.id.toString(), splitData)
      messageApi.success(`工单拆分成功，已拆分为 ${result.total_count} 个工单`)
      setSplitModalVisible(false)
      setCurrentWorkOrderForSplit(null)
      setSplitQuantities([])
      actionRef.current?.reload()
    } catch (error: any) {
      messageApi.error(error.message || '工单拆分失败')
    }
  }

  /**
   * 添加拆分数量输入框
   */
  const handleAddSplitQuantity = () => {
    setSplitQuantities([...splitQuantities, 0])
  }

  /**
   * 移除拆分数量输入框
   */
  const handleRemoveSplitQuantity = (index: number) => {
    const newQuantities = [...splitQuantities]
    newQuantities.splice(index, 1)
    setSplitQuantities(newQuantities)
  }

  /**
   * 更新拆分数量
   */
  const handleUpdateSplitQuantity = (index: number, value: number | null) => {
    const newQuantities = [...splitQuantities]
    newQuantities[index] = value || 0
    setSplitQuantities(newQuantities)
  }

  /**
   * 触屏视图卡片渲染函数
   */
  const renderTouchCard = (workOrder: WorkOrder, index: number) => {
    const statusColor =
      workOrder.status === '草稿'
        ? 'default'
        : workOrder.status === '已下达'
          ? 'processing'
          : workOrder.status === '生产中'
            ? 'processing'
            : workOrder.status === '已完成'
              ? 'success'
              : 'error'

    return (
      <Card
        key={workOrder.id}
        style={{
          marginBottom: TOUCH_SCREEN_CONFIG.ELEMENT_MIN_GAP,
          fontSize: TOUCH_SCREEN_CONFIG.FONT_MIN_SIZE,
        }}
        styles={{ body: { padding: `${TOUCH_SCREEN_CONFIG.ELEMENT_MIN_GAP}px` } }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: TOUCH_SCREEN_CONFIG.ELEMENT_MIN_GAP,
          }}
        >
          {/* 工单编号和状态 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: TOUCH_SCREEN_CONFIG.TITLE_FONT_SIZE, fontWeight: 600 }}>
              {workOrder.code}
            </div>
            <Tag
              color={statusColor}
              style={{ fontSize: TOUCH_SCREEN_CONFIG.FONT_MIN_SIZE, padding: '8px 16px' }}
            >
              {workOrder.status}
            </Tag>
          </div>

          {/* 工单名称 */}
          {workOrder.name && (
            <div style={{ fontSize: TOUCH_SCREEN_CONFIG.FONT_MIN_SIZE, color: '#666' }}>
              {workOrder.name}
            </div>
          )}

          {/* 产品信息 */}
          <div style={{ fontSize: TOUCH_SCREEN_CONFIG.FONT_MIN_SIZE }}>
            <strong>产品：</strong>
            {workOrder.product_name || workOrder.product_code}
          </div>

          {/* 数量信息 */}
          <div style={{ fontSize: TOUCH_SCREEN_CONFIG.FONT_MIN_SIZE }}>
            <strong>数量：</strong>
            {workOrder.quantity}
            {workOrder.completed_quantity !== undefined && workOrder.completed_quantity > 0 && (
              <span style={{ marginLeft: 16, color: '#52c41a' }}>
                已完成：{workOrder.completed_quantity}
              </span>
            )}
          </div>

          {/* 生产模式 */}
          <div style={{ fontSize: TOUCH_SCREEN_CONFIG.FONT_MIN_SIZE }}>
            <strong>生产模式：</strong>
            <Tag
              color={workOrder.production_mode === 'MTO' ? 'blue' : 'default'}
              style={{ marginLeft: 8 }}
            >
              {workOrder.production_mode === 'MTO' ? '按订单生产' : '按库存生产'}
            </Tag>
          </div>

          {/* 操作按钮 */}
          <div
            style={{
              display: 'flex',
              gap: TOUCH_SCREEN_CONFIG.ELEMENT_MIN_GAP,
              marginTop: TOUCH_SCREEN_CONFIG.ELEMENT_MIN_GAP,
            }}
          >
            <Button
              type="primary"
              size="large"
              icon={<EyeOutlined />}
              onClick={() => handleDetail(workOrder)}
              style={{
                height: TOUCH_SCREEN_CONFIG.BUTTON_MIN_HEIGHT,
                fontSize: TOUCH_SCREEN_CONFIG.FONT_MIN_SIZE,
                flex: 1,
              }}
            >
              查看详情
            </Button>
            {workOrder.status === '草稿' && (
              <Button
                type="default"
                size="large"
                icon={<EditOutlined />}
                onClick={() => handleEdit(workOrder)}
                style={{
                  height: TOUCH_SCREEN_CONFIG.BUTTON_MIN_HEIGHT,
                  fontSize: TOUCH_SCREEN_CONFIG.FONT_MIN_SIZE,
                  flex: 1,
                }}
              >
                编辑
              </Button>
            )}
            {workOrder.status === '草稿' && (
              <Button
                type="primary"
                size="large"
                onClick={() => handleRelease(workOrder)}
                style={{
                  height: TOUCH_SCREEN_CONFIG.BUTTON_MIN_HEIGHT,
                  fontSize: TOUCH_SCREEN_CONFIG.FONT_MIN_SIZE,
                  flex: 1,
                }}
              >
                下达
              </Button>
            )}
          </div>
        </div>
      </Card>
    )
  }

  /**
   * 表格列定义
   */
  const columns: ProColumns<WorkOrder>[] = [
    {
      title: '工单编号',
      dataIndex: 'code',
      width: 140,
      ellipsis: true,
      fixed: 'left',
    },
    {
      title: '工单名称',
      dataIndex: 'name',
      width: 200,
      ellipsis: true,
    },
    {
      title: '产品',
      dataIndex: 'product_name',
      width: 150,
      ellipsis: true,
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      width: 100,
      align: 'right',
    },
    {
      title: '生产模式',
      dataIndex: 'production_mode',
      width: 100,
      valueEnum: {
        MTS: { text: '按库存生产', status: 'processing' },
        MTO: { text: '按订单生产', status: 'success' },
      },
    },
    {
      title: '销售订单',
      dataIndex: 'sales_order_code',
      width: 120,
      render: (text, record) =>
        record.production_mode === 'MTO' ? (
          <Tag color="blue">{text}</Tag>
        ) : (
          <span style={{ color: '#999' }}>无</span>
        ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      render: (text, record) => (
        <Space>
          <Tag
            color={
              text === '草稿'
                ? 'default'
                : text === '已下达'
                  ? 'processing'
                  : text === '生产中'
                    ? 'processing'
                    : text === '已完成'
                      ? 'success'
                      : 'error'
            }
          >
            {text}
          </Tag>
          {record.is_frozen && <Tag color="warning">已冻结</Tag>}
        </Space>
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 100,
      render: (_, record) => {
        const priorityMap: Record<string, { text: string; color: string }> = {
          low: { text: '低', color: 'default' },
          normal: { text: '正常', color: 'blue' },
          high: { text: '高', color: 'orange' },
          urgent: { text: '紧急', color: 'red' },
        }
        const config = priorityMap[record.priority || 'normal'] || {
          text: record.priority || '正常',
          color: 'blue',
        }
        return <Tag color={config.color}>{config.text}</Tag>
      },
    },
    {
      title: '计划开始时间',
      dataIndex: 'planned_start_date',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: '计划结束时间',
      dataIndex: 'planned_end_date',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: '操作',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleDetail(record)}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<PrinterOutlined />}
            onClick={() => handlePrint(record)}
          >
            打印
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          {(['draft', '草稿'].includes(record.status || '') ||
            (['released', '已下达'].includes(record.status || '') &&
              !record.actual_start_date &&
              !Number(record.completed_quantity))) && (
            <Popconfirm
              title="确定要删除吗？"
              description="删除后无法恢复"
              onConfirm={async () => {
                try {
                  await workOrderApi.delete(record.id!.toString())
                  messageApi.success('删除成功')
                  actionRef.current?.reload()
                } catch (error: any) {
                  messageApi.error(error.message || '删除失败')
                }
              }}
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          )}
          {record.status === 'draft' && (
            <Button type="link" size="small" onClick={() => handleRelease(record)}>
              下达
            </Button>
          )}
          {(record.status === '已下达' || record.status === 'released') && (
            <Button type="link" size="small" danger onClick={() => handleRevoke(record)}>
              撤回
            </Button>
          )}
          {(record.status === '已完成' || record.status === 'completed') &&
            record.manually_completed && (
              <Button type="link" size="small" danger onClick={() => handleRevoke(record)}>
                撤回
              </Button>
            )}
          {record.status !== '已完成' &&
            record.status !== 'completed' &&
            record.status !== '已取消' &&
            record.status !== 'cancelled' && (
              <Button type="link" size="small" onClick={() => handleComplete(record)}>
                指定结束
              </Button>
            )}
        </Space>
      ),
    },
  ]

  return (
    <>
      <ListPageTemplate>
        <UniTable<WorkOrder>
          headerTitle="工单管理"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          request={async params => {
            try {
              const response = await workOrderApi.list({
                skip: (params.current! - 1) * params.pageSize!,
                limit: params.pageSize,
                ...params,
              })

              // 后端返回的是数组或分页格式，需要统一处理
              if (Array.isArray(response)) {
                // 后端直接返回数组
                return {
                  data: response,
                  success: true,
                  total: response.length,
                }
              } else if (response && typeof response === 'object') {
                // 后端返回分页格式 { data: [], success: true, total: 0 }
                return {
                  data: response.data || response.items || [],
                  success: response.success !== false,
                  total: response.total || (response.data || response.items || []).length,
                }
              }

              return {
                data: [],
                success: false,
                total: 0,
              }
            } catch (error) {
              console.error('获取工单列表失败:', error)
              messageApi.error('获取工单列表失败')
              return {
                data: [],
                success: false,
                total: 0,
              }
            }
          }}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
          expandable={{
            expandedRowKeys,
            onExpandedRowsChange: keys => setExpandedRowKeys([...keys]),
            onExpand: handleExpand,
            expandedRowRender: renderExpandedRow,
            expandRowByClick: true, // 支持双击行展开
          }}
          toolBarRender={() => [
            <Button
              key="batch-qrcode"
              icon={<QrcodeOutlined />}
              disabled={selectedRowKeys.length === 0}
              onClick={handleBatchGenerateQRCode}
            >
              批量生成二维码
            </Button>,
            <Button key="create" type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              新建工单
            </Button>,
            <Button
              key="batchPriority"
              onClick={handleBatchSetPriority}
              disabled={selectedRowKeys.length === 0}
            >
              批量设置优先级
            </Button>,
            <Button
              key="batchRelease"
              type="primary"
              onClick={handleBatchRelease}
              disabled={selectedRowKeys.length === 0}
            >
              批量下达
            </Button>,
            <Button
              key="batchFreeze"
              onClick={handleBatchFreeze}
              disabled={selectedRowKeys.length === 0}
            >
              批量冻结
            </Button>,
            <Button
              key="batchCancel"
              danger
              onClick={handleBatchCancel}
              disabled={selectedRowKeys.length === 0}
            >
              批量取消
            </Button>,
            <Button key="merge" onClick={handleMerge} disabled={selectedRowKeys.length < 2}>
              合并工单
            </Button>,
          ]}
          onDelete={handleDelete}
          viewTypes={['table', 'help']}
          touchViewConfig={{
            renderCard: renderTouchCard,
            columns: 1,
          }}
        />
      </ListPageTemplate>

      {/* 打印工单 Modal */}
      {printModalVisible && (
        <WorkOrderPrintModal
          visible={printModalVisible}
          onCancel={() => {
            setPrintModalVisible(false)
            setCurrentWorkOrderForPrint(null)
          }}
          workOrderData={currentWorkOrderForPrint}
          workOrderId={currentWorkOrderForPrint?.id}
        />
      )}

      {/* 创建/编辑工单 Modal */}
      <SmartSuggestionFloatPanel
        visible={modalVisible && !!selectedMaterialSourceInfo}
        messages={
          selectedMaterialSourceInfo
            ? (() => {
                const msgs: Array<{ text: string; title?: string }> = []
                msgs.push({
                  title: '物料来源',
                  text: selectedMaterialSourceInfo.sourceTypeName || '未配置',
                })
                if (selectedMaterialSourceInfo.validationErrors?.length) {
                  msgs.push({
                    title: '配置建议',
                    text: selectedMaterialSourceInfo.validationErrors
                      .map((e, i) => `${i + 1}. ${e}`)
                      .join('\n'),
                  })
                }
                if (selectedMaterialSourceInfo.canCreateWorkOrder === false) {
                  msgs.push({
                    title: '提醒',
                    text: '该物料不允许创建生产工单，请选择其他物料',
                  })
                }
                return msgs
              })()
            : []
        }
        anchorSelector="[data-smart-suggestion-anchor='work-order-form']"
      />
      <FormModalTemplate
        title={isEdit ? '编辑工单' : '新建工单'}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false)
          setCurrentWorkOrder(null)
          setSelectedMaterialSourceInfo(null)
          setProductSourceData(null)
          formRef.current?.resetFields()
        }}
        onFinish={handleSubmit}
        isEdit={isEdit}
        width={MODAL_CONFIG.LARGE_WIDTH}
        formRef={formRef}
        modalRender={modal => <div data-smart-suggestion-anchor="work-order-form">{modal}</div>}
      >
        <CodeField
          pageCode="kuaizhizao-production-work-order"
          name="code"
          label="工单编码"
          required={true}
          autoGenerateOnCreate={!isEdit}
          showGenerateButton={false}
          context={{}}
          colProps={{ span: 12 }}
        />
        <ProFormText
          name="name"
          label="工单名称"
          placeholder="可选"
          disabled={isEdit}
          colProps={{ span: 12 }}
        />
        <ProFormText name="production_mode" initialValue="MTS" hidden />

        {/* 产品与数量 */}
        <ProFormSelect
          name="product_id"
          label="产品"
          placeholder="请选择产品"
          options={productOptionsList.map((product: any) => ({
            label: `${product.code || product.mainCode} - ${product.name}`,
            value: product.id,
          }))}
          rules={[{ required: true, message: '请选择产品' }]}
          disabled={isEdit}
          fieldProps={{
            showSearch: true,
            filterOption: (input: string, option: any) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase()),
            onChange: async (value: number | undefined) => {
              if (value) {
                const selectedMaterial = productOptionsList.find((p: any) => p.id === value)
                if (selectedMaterial) {
                  try {
                    const materialDetail = await materialApi.get(selectedMaterial.uuid)
                    const sourceType = materialDetail.sourceType || materialDetail.source_type
                    const sourceTypeNames: Record<string, string> = {
                      Make: '自制件',
                      Buy: '采购件',
                      Phantom: '虚拟件',
                      Outsource: '委外件',
                      Configure: '配置件',
                    }
                    let canCreateWorkOrder = true
                    const validationErrors: string[] = []
                    if (sourceType === 'Buy') {
                      canCreateWorkOrder = false
                      validationErrors.push('采购件不应创建生产工单，请使用采购订单功能')
                    } else if (sourceType === 'Phantom') {
                      canCreateWorkOrder = false
                      validationErrors.push('虚拟件不应创建工单')
                    } else if (sourceType === 'Make')
                      validationErrors.push('自制件需配置BOM和工艺路线')
                    else if (sourceType === 'Outsource')
                      validationErrors.push('委外件需配置委外供应商和工序')
                    setSelectedMaterialSourceInfo({
                      sourceType,
                      sourceTypeName: sourceType
                        ? sourceTypeNames[sourceType] || sourceType
                        : undefined,
                      validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
                      canCreateWorkOrder,
                    })
                    // 自动加载物料绑定的工艺路线及工序
                    loadProcessRouteForMaterial(selectedMaterial.uuid)
                  } catch (error) {
                    console.error('获取物料详情失败:', error)
                    setSelectedMaterialSourceInfo(null)
                  }
                } else setSelectedMaterialSourceInfo(null)
              } else setSelectedMaterialSourceInfo(null)
            },
          }}
          colProps={{ span: 10 }}
        />
        <ProFormGroup colProps={{ span: 14 }} style={{ marginBottom: 0 }}>
          <Form.Item label=" " colon={false} style={{ marginBottom: 0 }}>
            <Space size="middle" wrap={false} style={{ flexWrap: 'nowrap' }}>
              <ConfigProvider
                theme={{
                  components: {
                    Segmented: {
                      trackBg: 'rgba(0, 0, 0, 0.06)',
                      itemSelectedBg: token.colorPrimary,
                      itemSelectedColor: '#fff',
                    },
                  },
                }}
              >
                <Segmented
                  size="small"
                  value={onlyShowMake ? 'make' : 'all'}
                  onChange={v => setOnlyShowMake(v === 'make')}
                  options={[
                    { label: '全部', value: 'all' },
                    { label: '自制件', value: 'make' },
                  ]}
                />
              </ConfigProvider>
              <Divider orientation="vertical" style={{ margin: 0, height: 20 }} />
              <Space size="small" wrap={false}>
                <Button
                  size="small"
                  onClick={() => {
                    setProductSourceModalType('sales_order')
                    setProductSourceModalVisible(true)
                  }}
                >
                  从销售订单加载
                </Button>
                <Button
                  size="small"
                  onClick={() => {
                    setProductSourceModalType('sales_forecast')
                    setProductSourceModalVisible(true)
                  }}
                >
                  从销售预测加载
                </Button>
                <Button
                  size="small"
                  onClick={() => {
                    setProductSourceModalType('demand')
                    setProductSourceModalVisible(true)
                  }}
                >
                  从需求管理加载
                </Button>
                {productSourceData && (
                  <Button
                    size="small"
                    type="link"
                    onClick={() => setProductSourceData(null)}
                    style={{ padding: '0 4px', minWidth: 'auto' }}
                  >
                    清除
                  </Button>
                )}
              </Space>
            </Space>
          </Form.Item>
        </ProFormGroup>
        <ProFormDigit
          name="quantity"
          label="计划数量"
          placeholder="请输入"
          min={0}
          precision={2}
          rules={[{ required: true, message: '请输入计划数量' }]}
          colProps={{ span: 6 }}
        />

        <ProFormSelect
          name="priority"
          label="优先级"
          options={[
            { label: '低', value: 'low' },
            { label: '正常', value: 'normal' },
            { label: '高', value: 'high' },
            { label: '紧急', value: 'urgent' },
          ]}
          initialValue="normal"
          colProps={{ span: 6 }}
        />
        <ProFormDatePicker
          name="planned_start_date"
          label="计划开始"
          placeholder="可选"
          colProps={{ span: 6 }}
          fieldProps={{ style: { width: '100%' } }}
        />
        <ProFormDatePicker
          name="planned_end_date"
          label="计划结束"
          placeholder="可选"
          colProps={{ span: 6 }}
          fieldProps={{ style: { width: '100%' } }}
        />

        <ProFormSelect
          name="process_route_id"
          label="工艺路线"
          placeholder="选择后自动加载工序"
          options={processRouteList.map(route => ({
            label: `${route.code} - ${route.name}`,
            value: route.id,
          }))}
          disabled={isEdit}
          fieldProps={{
            showSearch: true,
            filterOption: (input: string, option: any) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase()),
            onChange: async (value: number | undefined) => {
              if (value) {
                try {
                  // 从工艺路线列表中找到路线（获取 uuid）
                  const route = processRouteList.find(r => r.id === value)
                  if (!route || !route.uuid) {
                    messageApi.warning('未找到工艺路线信息')
                    return
                  }

                  // 调用详情 API 获取完整的工艺路线信息（包含工序序列）
                  const routeDetail = await processRouteApi.get(route.uuid)
                  const operations = parseOperationSequence(
                    routeDetail?.operation_sequence,
                    operationList
                  )
                  if (operations.length > 0) {
                    setSelectedOperations(operations)
                    formRef.current?.setFieldsValue({
                      operations: operations.map((op: any) => op.operation_id),
                    })
                    messageApi.success(`已加载 ${operations.length} 个工序`)
                  } else {
                    setSelectedOperations([])
                    formRef.current?.setFieldsValue({ operations: undefined })
                    if (routeDetail?.operation_sequence) {
                      messageApi.warning('该工艺路线工序数据无法解析，请检查工序主数据是否完整')
                    } else {
                      messageApi.warning('该工艺路线未配置工序序列')
                    }
                  }
                } catch (error: any) {
                  console.error('获取工艺路线工序失败:', error)
                  messageApi.error(error.message || '获取工艺路线工序失败')
                  setSelectedOperations([])
                  formRef.current?.setFieldsValue({
                    operations: undefined,
                  })
                }
              } else {
                setSelectedOperations([])
                formRef.current?.setFieldsValue({
                  operations: undefined,
                })
              }
            },
          }}
          colProps={{ span: 12 }}
        />
        <Form.Item name="operations" hidden />
        <Form.Item label="工艺路线工序清单" colon style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
          <CreateWorkOrderOperationsList
            selectedOperations={selectedOperations}
            setSelectedOperations={setSelectedOperations}
            operationList={operationList}
            formRef={formRef}
            disabled={isEdit}
          />
        </Form.Item>

        <ProFormSwitch
          name="allow_operation_jump"
          label="允许跳转工序"
          extra="开启后允许自由报工；关闭后下一道工序报工数量不可超过上一道"
          initialValue={false}
          colProps={{ span: 24 }}
        />
        <ProFormTextArea
          name="remarks"
          label="备注"
          placeholder="可选"
          fieldProps={{ rows: 3 }}
          colProps={{ span: 24 }}
        />
      </FormModalTemplate>

      {/* 选择产品来源文档 Modal（销售订单/销售预测/需求）- 产品明细 */}
      <Modal
        title={
          productSourceModalType === 'sales_order'
            ? '选择销售订单 - 产品明细'
            : productSourceModalType === 'sales_forecast'
              ? '选择销售预测 - 产品明细'
              : productSourceModalType === 'demand'
                ? '选择需求 - 产品明细'
                : '选择 - 产品明细'
        }
        open={productSourceModalVisible}
        onCancel={() => {
          setProductSourceModalVisible(false)
          setProductSourceModalType(null)
        }}
        footer={null}
        width={900}
      >
        <Table
          loading={productSourceDocLoading}
          dataSource={productSourceDocList}
          rowKey={(r: any) => r._row_key ?? `${r._doc_id}-${r.id ?? r.uuid}`}
          size="small"
          pagination={{ pageSize: 15 }}
          onRow={(record: any) => ({
            style: { cursor: 'pointer' },
            onClick: () => {
              const docId = record._doc_id
              if (!docId) return
              try {
                const sourceItems = productSourceDocList.filter((r: any) => r._doc_id === docId)
                const itemsWithQty: { productId: number; quantity: number }[] = []
                const materials: any[] = []
                for (const it of sourceItems) {
                  const product = productList.find(
                    (m: any) =>
                      m.id === it.material_id || (m.code || m.mainCode) === it.material_code
                  )
                  if (!product) continue
                  const qty =
                    productSourceModalType === 'sales_forecast'
                      ? (it.forecast_quantity ?? 0)
                      : (it.required_quantity ?? 0)
                  itemsWithQty.push({ productId: product.id, quantity: Number(qty) || 0 })
                  if (!materials.some((m: any) => m.id === product.id)) materials.push(product)
                }
                setProductSourceData({
                  type: productSourceModalType!,
                  materials,
                  items: itemsWithQty,
                })
                setProductSourceModalVisible(false)
                setProductSourceModalType(null)
                messageApi.success(`已加载 ${materials.length} 个产品`)
              } catch (e: any) {
                messageApi.error(e?.message || '加载失败')
              }
            },
          })}
          columns={[
            ...(productSourceModalType === 'sales_order'
              ? [
                  { title: '订单编码', dataIndex: '_order_code', key: '_order_code', width: 140 },
                  { title: '客户', dataIndex: '_customer_name', key: '_customer_name', width: 160 },
                  { title: '产品名称', dataIndex: 'material_name', key: 'material_name' },
                  { title: '型号', dataIndex: 'material_spec', key: 'material_spec', width: 140 },
                  {
                    title: '数量',
                    dataIndex: 'required_quantity',
                    key: 'required_quantity',
                    width: 80,
                  },
                ]
              : productSourceModalType === 'sales_forecast'
                ? [
                    {
                      title: '预测编码',
                      dataIndex: '_forecast_code',
                      key: '_forecast_code',
                      width: 120,
                    },
                    {
                      title: '预测名称',
                      dataIndex: '_forecast_name',
                      key: '_forecast_name',
                      width: 120,
                    },
                    { title: '产品名称', dataIndex: 'material_name', key: 'material_name' },
                    { title: '型号', dataIndex: 'material_spec', key: 'material_spec', width: 140 },
                    {
                      title: '数量',
                      dataIndex: 'forecast_quantity',
                      key: 'forecast_quantity',
                      width: 80,
                    },
                  ]
                : productSourceModalType === 'demand'
                  ? [
                      {
                        title: '需求编码',
                        dataIndex: '_demand_code',
                        key: '_demand_code',
                        width: 120,
                      },
                      {
                        title: '需求名称',
                        dataIndex: '_demand_name',
                        key: '_demand_name',
                        width: 120,
                      },
                      { title: '产品名称', dataIndex: 'material_name', key: 'material_name' },
                      {
                        title: '型号',
                        dataIndex: 'material_spec',
                        key: 'material_spec',
                        width: 140,
                      },
                      {
                        title: '数量',
                        dataIndex: 'required_quantity',
                        key: 'required_quantity',
                        width: 80,
                      },
                    ]
                  : []),
          ]}
        />
      </Modal>

      {/* 工单详情 Drawer */}
      <DetailDrawerTemplate<WorkOrder>
        title={`工单详情 - ${workOrderDetail?.code || ''}`}
        open={drawerVisible}
        onClose={() => {
          setDrawerVisible(false)
          setWorkOrderDetail(null)
          setDocumentRelations(null)
        }}
        dataSource={workOrderDetail || undefined}
        columns={detailColumns}
        width={DRAWER_CONFIG.LARGE_WIDTH}
        customContent={
          <>
            {/* 操作按钮区域 */}
            <div
              style={{ padding: '16px 0', borderBottom: '1px solid #f0f0f0', marginBottom: '16px' }}
            >
              <Space wrap>
                {/* 状态显示和流转 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 16 }}>
                  <span style={{ fontWeight: 500 }}>状态：</span>
                  <Tag
                    color={
                      workOrderDetail?.status === 'draft'
                        ? 'default'
                        : workOrderDetail?.status === 'released'
                          ? 'processing'
                          : workOrderDetail?.status === 'in_progress'
                            ? 'processing'
                            : workOrderDetail?.status === 'completed'
                              ? 'success'
                              : workOrderDetail?.status === 'cancelled'
                                ? 'error'
                                : 'default'
                    }
                  >
                    {workOrderDetail?.status === 'draft'
                      ? '草稿'
                      : workOrderDetail?.status === 'released'
                        ? '已下达'
                        : workOrderDetail?.status === 'in_progress'
                          ? '执行中'
                          : workOrderDetail?.status === 'completed'
                            ? '已完成'
                            : workOrderDetail?.status === 'cancelled'
                              ? '已取消'
                              : workOrderDetail?.status}
                  </Tag>
                  {availableTransitions.length > 0 && (
                    <Button
                      type="link"
                      size="small"
                      onClick={handleStateTransition}
                      disabled={!workOrderDetail}
                    >
                      状态流转
                    </Button>
                  )}
                </div>
                <Divider orientation="vertical" />
                <Button
                  type="primary"
                  onClick={() => handleCreateRework(workOrderDetail!)}
                  disabled={!workOrderDetail || workOrderDetail.status === 'cancelled'}
                >
                  创建返工单
                </Button>
                <Button
                  type="primary"
                  onClick={() => handleCreateOutsource(workOrderDetail!)}
                  disabled={
                    !workOrderDetail ||
                    workOrderDetail.status === 'cancelled' ||
                    !workOrderOperations ||
                    workOrderOperations.length === 0
                  }
                >
                  创建工序委外
                </Button>
                <Button
                  type="default"
                  onClick={() => handleSplit(workOrderDetail!)}
                  disabled={
                    !workOrderDetail ||
                    !['draft', 'released'].includes(workOrderDetail.status || '')
                  }
                >
                  拆分工单
                </Button>
                {workOrderDetail?.is_frozen ? (
                  <Button type="default" onClick={() => handleUnfreeze(workOrderDetail!)}>
                    解冻工单
                  </Button>
                ) : (
                  <Button
                    type="default"
                    danger
                    onClick={() => handleFreeze(workOrderDetail!)}
                    disabled={
                      !workOrderDetail ||
                      workOrderDetail.status === 'cancelled' ||
                      workOrderDetail.status === 'completed'
                    }
                  >
                    冻结工单
                  </Button>
                )}
                <Select
                  value={workOrderDetail?.priority || 'normal'}
                  onChange={value => handleSetPriority(workOrderDetail!, value)}
                  disabled={!workOrderDetail}
                  style={{ width: 120 }}
                >
                  <Select.Option value="low">低</Select.Option>
                  <Select.Option value="normal">正常</Select.Option>
                  <Select.Option value="high">高</Select.Option>
                  <Select.Option value="urgent">紧急</Select.Option>
                </Select>
              </Space>
            </div>
            {documentRelations ? (
              <div style={{ padding: '16px 0' }}>
                <Card title="单据关联">
                  {documentRelations.upstream_count > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ marginBottom: 8, fontWeight: 'bold' }}>
                        上游单据 ({documentRelations.upstream_count})
                      </div>
                      <Table
                        size="small"
                        columns={[
                          { title: '单据类型', dataIndex: 'document_type', width: 120 },
                          { title: '单据编号', dataIndex: 'document_code', width: 150 },
                          { title: '单据名称', dataIndex: 'document_name', width: 150 },
                          {
                            title: '状态',
                            dataIndex: 'status',
                            width: 100,
                            render: (status: string) => <Tag>{status}</Tag>,
                          },
                        ]}
                        dataSource={documentRelations.upstream_documents}
                        pagination={false}
                        rowKey={record => `${record.document_type}-${record.document_id}`}
                        bordered
                      />
                    </div>
                  )}
                  {documentRelations.downstream_count > 0 && (
                    <div>
                      <div style={{ marginBottom: 8, fontWeight: 'bold' }}>
                        下游单据 ({documentRelations.downstream_count})
                      </div>
                      <Table
                        size="small"
                        columns={[
                          { title: '单据类型', dataIndex: 'document_type', width: 120 },
                          { title: '单据编号', dataIndex: 'document_code', width: 150 },
                          { title: '单据名称', dataIndex: 'document_name', width: 150 },
                          {
                            title: '状态',
                            dataIndex: 'status',
                            width: 100,
                            render: (status: string) => <Tag>{status}</Tag>,
                          },
                        ]}
                        dataSource={documentRelations.downstream_documents}
                        pagination={false}
                        rowKey={record => `${record.document_type}-${record.document_id}`}
                        bordered
                      />
                    </div>
                  )}
                  {documentRelations.upstream_count === 0 &&
                    documentRelations.downstream_count === 0 && (
                      <div style={{ color: '#999', textAlign: 'center', padding: '20px' }}>
                        暂无关联单据
                      </div>
                    )}
                </Card>
              </div>
            ) : null}

            {/* 工单工序管理 */}
            <div style={{ padding: '16px 0' }}>
              <Card
                title="工单工序"
                extra={
                  workOrderDetail &&
                  ['draft', 'released'].includes(workOrderDetail.status || '') ? (
                    <Button
                      type="primary"
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={() => {
                        setCurrentOperation(null)
                        setOperationsModalVisible(true)
                        operationFormRef.current?.resetFields()
                      }}
                    >
                      添加工序
                    </Button>
                  ) : null
                }
              >
                <WorkOrderOperationsList
                  workOrderId={workOrderDetail?.id}
                  operations={workOrderOperations}
                  workOrderStatus={workOrderDetail?.status}
                  onUpdate={async () => {
                    if (workOrderDetail?.id) {
                      const operations = await workOrderApi.getOperations(
                        workOrderDetail.id.toString()
                      )
                      setWorkOrderOperations(operations)
                    }
                  }}
                  onEdit={operation => {
                    setCurrentOperation(operation)
                    setOperationsModalVisible(true)
                    operationFormRef.current?.setFieldsValue(operation)
                  }}
                />
              </Card>
            </div>

            {/* 工单二维码 */}
            {workOrderDetail && (
              <div style={{ padding: '16px 0' }}>
                <Card title="工单二维码">
                  <QRCodeGenerator
                    qrcodeType="WO"
                    data={{
                      work_order_uuid: workOrderDetail.id?.toString() || '',
                      work_order_code: workOrderDetail.code || '',
                      work_order_name: workOrderDetail.name || '',
                    }}
                    autoGenerate={true}
                  />
                </Card>
              </div>
            )}

            {/* 状态流转历史 */}
            <div style={{ padding: '16px 0' }}>
              <Card title="状态流转历史">
                {transitionHistory.length > 0 ? (
                  <Timeline>
                    {transitionHistory.map((log, index) => {
                      const statusColor =
                        log.to_state === 'draft'
                          ? 'default'
                          : log.to_state === 'released'
                            ? 'processing'
                            : log.to_state === 'in_progress'
                              ? 'processing'
                              : log.to_state === 'completed'
                                ? 'success'
                                : log.to_state === 'cancelled'
                                  ? 'error'
                                  : 'default'

                      const statusText =
                        log.to_state === 'draft'
                          ? '草稿'
                          : log.to_state === 'released'
                            ? '已下达'
                            : log.to_state === 'in_progress'
                              ? '执行中'
                              : log.to_state === 'completed'
                                ? '已完成'
                                : log.to_state === 'cancelled'
                                  ? '已取消'
                                  : log.to_state

                      const fromStatusText =
                        log.from_state === 'draft'
                          ? '草稿'
                          : log.from_state === 'released'
                            ? '已下达'
                            : log.from_state === 'in_progress'
                              ? '执行中'
                              : log.from_state === 'completed'
                                ? '已完成'
                                : log.from_state === 'cancelled'
                                  ? '已取消'
                                  : log.from_state

                      return (
                        <Timeline.Item key={log.id} color={statusColor}>
                          <div>
                            <div style={{ marginBottom: 4 }}>
                              <Tag color={statusColor}>{statusText}</Tag>
                              <span style={{ marginLeft: 8, color: '#666' }}>
                                {fromStatusText} → {statusText}
                              </span>
                            </div>
                            {log.transition_reason && (
                              <div style={{ marginBottom: 4, color: '#666', fontSize: 12 }}>
                                原因：{log.transition_reason}
                              </div>
                            )}
                            {log.transition_comment && (
                              <div style={{ marginBottom: 4, color: '#666', fontSize: 12 }}>
                                备注：{log.transition_comment}
                              </div>
                            )}
                            <div style={{ color: '#999', fontSize: 12 }}>
                              {log.operator_name} ·{' '}
                              {log.transition_time
                                ? dayjs(log.transition_time).format('YYYY-MM-DD HH:mm:ss')
                                : ''}
                            </div>
                          </div>
                        </Timeline.Item>
                      )
                    })}
                  </Timeline>
                ) : (
                  <div style={{ color: '#999', textAlign: 'center', padding: '20px' }}>
                    暂无状态流转记录
                  </div>
                )}
              </Card>
            </div>
          </>
        }
      />

      {/* 创建返工单Modal */}
      <FormModalTemplate
        title="创建返工单"
        open={reworkModalVisible}
        onClose={() => {
          setReworkModalVisible(false)
          setCurrentWorkOrderForRework(null)
          reworkFormRef.current?.resetFields()
        }}
        onFinish={handleSubmitRework}
        formRef={reworkFormRef}
        {...MODAL_CONFIG}
      >
        <ProFormText name="original_work_order_id" label="原工单ID" disabled />
        <ProFormText name="product_code" label="产品编码" disabled />
        <ProFormText name="product_name" label="产品名称" disabled />
        <ProFormDigit
          name="quantity"
          label="返工数量"
          placeholder="请输入返工数量"
          rules={[{ required: true, message: '请输入返工数量' }]}
          min={0}
          fieldProps={{ precision: 2 }}
        />
        <ProFormSelect
          name="rework_type"
          label="返工类型"
          placeholder="请选择返工类型"
          rules={[{ required: true, message: '请选择返工类型' }]}
          options={[
            { label: '返工', value: '返工' },
            { label: '返修', value: '返修' },
            { label: '报废', value: '报废' },
          ]}
        />
        <ProFormTextArea
          name="rework_reason"
          label="返工原因"
          placeholder="请输入返工原因"
          rules={[{ required: true, message: '请输入返工原因' }]}
          fieldProps={{ rows: 3 }}
        />
        <ProFormDatePicker
          name="planned_start_date"
          label="计划开始时间"
          placeholder="请选择计划开始时间"
          fieldProps={{ showTime: true }}
        />
        <ProFormDatePicker
          name="planned_end_date"
          label="计划结束时间"
          placeholder="请选择计划结束时间"
          fieldProps={{ showTime: true }}
        />
        <ProFormTextArea
          name="remarks"
          label="备注"
          placeholder="请输入备注"
          fieldProps={{ rows: 3 }}
        />
      </FormModalTemplate>

      {/* 创建工序委外Modal */}
      <FormModalTemplate
        title="创建工序委外"
        open={outsourceModalVisible}
        onClose={() => {
          setOutsourceModalVisible(false)
          setCurrentWorkOrderForOutsource(null)
          outsourceFormRef.current?.resetFields()
        }}
        onFinish={handleSubmitOutsource}
        formRef={outsourceFormRef}
        {...MODAL_CONFIG}
      >
        {currentWorkOrderForOutsource && (
          <>
            <Card size="small" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={12}>
                  <div>
                    <strong>工单编码：</strong>
                    {currentWorkOrderForOutsource.code}
                  </div>
                </Col>
                <Col span={12}>
                  <div>
                    <strong>产品名称：</strong>
                    {currentWorkOrderForOutsource.product_name}
                  </div>
                </Col>
              </Row>
            </Card>
            <ProFormSelect
              name="work_order_operation_id"
              label="选择工序"
              placeholder="请选择要委外的工序"
              rules={[{ required: true, message: '请选择要委外的工序' }]}
              options={workOrderOperations.map((op: any) => ({
                label: `${op.operation_name || op.operation_code} (序号: ${op.sequence || op.id})`,
                value: op.id,
              }))}
              fieldProps={{
                showSearch: true,
                filterOption: (input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase()),
              }}
            />
            <ProFormSelect
              name="supplier_id"
              label="供应商"
              placeholder="请选择供应商"
              rules={[{ required: true, message: '请选择供应商' }]}
              options={supplierList.map(s => ({
                label: `${s.code} - ${s.name}`,
                value: s.id,
              }))}
              fieldProps={{
                showSearch: true,
                filterOption: (input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase()),
              }}
            />
            <ProFormDigit
              name="outsource_quantity"
              label="委外数量"
              placeholder="请输入委外数量"
              rules={[{ required: true, message: '请输入委外数量' }]}
              min={0}
              fieldProps={{ precision: 2 }}
            />
            <ProFormDigit
              name="unit_price"
              label="单价"
              placeholder="请输入单价（可选）"
              min={0}
              fieldProps={{ precision: 2 }}
            />
            <ProFormDatePicker
              name="planned_start_date"
              label="计划开始时间"
              placeholder="请选择计划开始时间"
              fieldProps={{ showTime: true }}
            />
            <ProFormDatePicker
              name="planned_end_date"
              label="计划结束时间"
              placeholder="请选择计划结束时间"
              fieldProps={{ showTime: true }}
            />
            <ProFormTextArea
              name="remarks"
              label="备注"
              placeholder="请输入备注（可选）"
              fieldProps={{ rows: 3 }}
            />
          </>
        )}
      </FormModalTemplate>

      {/* 派工Modal */}
      <FormModalTemplate
        title="工序派工"
        open={dispatchModalVisible}
        onClose={() => {
          setDispatchModalVisible(false)
          setCurrentOperationForDispatch(null)
          setCurrentWorkOrderForDispatch(null)
        }}
        onFinish={handleDispatch}
        formRef={dispatchFormRef}
        {...MODAL_CONFIG}
      >
        {currentOperationForDispatch && currentWorkOrderForDispatch && (
          <>
            <Card size="small" style={{ marginBottom: 16, backgroundColor: '#f9f9f9' }}>
              <Row gutter={16}>
                <Col span={12}>
                  <div style={{ marginBottom: 4 }}>
                    <strong>工单编码：</strong>
                    {currentWorkOrderForDispatch.code}
                  </div>
                  <div>
                    <strong>产品名称：</strong>
                    {currentWorkOrderForDispatch.product_name}
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{ marginBottom: 4 }}>
                    <strong>当前工序：</strong>
                    {currentOperationForDispatch.operation_name}
                  </div>
                  <div>
                    <strong>计划数量：</strong>
                    <span style={{ color: '#1890ff', fontWeight: 'bold' }}>
                      {currentWorkOrderForDispatch.quantity}
                    </span>
                  </div>
                </Col>
              </Row>
            </Card>

            <ProFormSelect
              name="assigned_worker_id"
              label="分配人员"
              placeholder="请选择执行人员"
              options={workerList.map(item => ({
                label: `${item.full_name || item.username} (${item.username})`,
                value: item.id,
              }))}
              fieldProps={{
                showSearch: true,
                filterOption: (input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase()),
              }}
            />

            <ProFormSelect
              name="assigned_equipment_id"
              label="分配设备"
              placeholder="请选择执行设备"
              options={equipmentList.map(item => ({
                label: `${item.code} - ${item.name}`,
                value: item.id,
              }))}
              fieldProps={{
                showSearch: true,
                filterOption: (input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase()),
              }}
            />

            <ProFormTextArea
              name="remarks"
              label="派工备注"
              placeholder="请输入派工说明（可选）"
              fieldProps={{ rows: 3 }}
            />
          </>
        )}
      </FormModalTemplate>

      {/* 拆分工单Modal */}
      <Modal
        title="拆分工单"
        open={splitModalVisible}
        onCancel={() => {
          setSplitModalVisible(false)
          setCurrentWorkOrderForSplit(null)
          setSplitQuantities([])
          setSplitCount(2)
          setSplitType('count')
        }}
        onOk={handleSubmitSplit}
        width={600}
        okText="确认拆分"
        cancelText="取消"
      >
        {currentWorkOrderForSplit && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <div>
                <strong>原工单编码：</strong>
                {currentWorkOrderForSplit.code}
              </div>
              <div>
                <strong>原工单名称：</strong>
                {currentWorkOrderForSplit.name}
              </div>
              <div>
                <strong>原工单数量：</strong>
                {currentWorkOrderForSplit.quantity}
              </div>
            </div>

            <ProForm
              submitter={false}
              initialValues={{
                splitType: splitType,
                splitCount: splitCount,
              }}
              onValuesChange={changedValues => {
                if (changedValues.splitType !== undefined) {
                  setSplitType(changedValues.splitType)
                  if (changedValues.splitType === 'count') {
                    setSplitQuantities([])
                  } else {
                    setSplitCount(2)
                  }
                }
                if (changedValues.splitCount !== undefined) {
                  setSplitCount(changedValues.splitCount)
                }
              }}
            >
              <ProFormRadio.Group
                name="splitType"
                label="拆分方式"
                options={[
                  { label: '等量拆分', value: 'count' },
                  { label: '指定数量拆分', value: 'quantity' },
                ]}
              />

              {splitType === 'count' ? (
                <ProFormDigit
                  name="splitCount"
                  label="拆分成几个工单"
                  min={2}
                  max={100}
                  placeholder="请输入拆分数（2-100）"
                  fieldProps={{
                    onChange: value => setSplitCount(value || 2),
                  }}
                  extra={
                    <div style={{ marginTop: 8, color: '#999', fontSize: 12 }}>
                      每个工单数量：
                      {currentWorkOrderForSplit.quantity
                        ? (Number(currentWorkOrderForSplit.quantity) / splitCount).toFixed(2)
                        : 0}
                      {currentWorkOrderForSplit.quantity &&
                        Number(currentWorkOrderForSplit.quantity) % splitCount !== 0 && (
                          <span style={{ color: '#ff4d4f' }}>（不能整除，请使用指定数量拆分）</span>
                        )}
                    </div>
                  }
                />
              ) : (
                <div>
                  <div style={{ marginBottom: 8, fontWeight: 'bold' }}>每个拆分工单的数量</div>
                  {splitQuantities.map((quantity, index) => (
                    <div
                      key={index}
                      style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}
                    >
                      <InputNumber
                        min={0}
                        value={quantity}
                        onChange={value => handleUpdateSplitQuantity(index, value)}
                        style={{ flex: 1 }}
                        placeholder={`工单${index + 1}数量`}
                        precision={2}
                      />
                      <Button
                        type="link"
                        danger
                        onClick={() => handleRemoveSplitQuantity(index)}
                        disabled={splitQuantities.length <= 1}
                      >
                        删除
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="dashed"
                    onClick={handleAddSplitQuantity}
                    style={{ width: '100%', marginTop: 8 }}
                  >
                    + 添加工单
                  </Button>
                  <div style={{ marginTop: 8, color: '#999', fontSize: 12 }}>
                    总数量：{splitQuantities.reduce((sum, q) => sum + q, 0).toFixed(2)} /{' '}
                    {currentWorkOrderForSplit.quantity}
                    {splitQuantities.reduce((sum, q) => sum + q, 0) !==
                      Number(currentWorkOrderForSplit.quantity) && (
                      <span style={{ color: '#ff4d4f' }}>（数量总和必须等于原工单数量）</span>
                    )}
                  </div>
                </div>
              )}
            </ProForm>
          </div>
        )}
      </Modal>

      {/* 工单工序编辑Modal */}
      <FormModalTemplate
        title={currentOperation ? '编辑工序' : '添加工序'}
        open={operationsModalVisible}
        onClose={() => {
          setOperationsModalVisible(false)
          setCurrentOperation(null)
          operationFormRef.current?.resetFields()
        }}
        onFinish={async (values: any) => {
          try {
            if (!workOrderDetail?.id) {
              throw new Error('工单ID不存在')
            }

            // 获取当前工序列表
            const currentOperations = await workOrderApi.getOperations(
              workOrderDetail.id.toString()
            )

            // 如果是编辑，更新对应工序；如果是新增，添加到列表
            let updatedOperations: any[]
            if (currentOperation) {
              // 编辑：更新对应sequence的工序
              updatedOperations = currentOperations.map((op: any) => {
                if (op.id === currentOperation.id) {
                  return {
                    ...op,
                    ...values,
                    sequence: op.sequence, // 保持sequence不变
                  }
                }
                return op
              })
            } else {
              // 新增：计算新的sequence
              const maxSequence =
                currentOperations.length > 0
                  ? Math.max(...currentOperations.map((op: any) => op.sequence || 0))
                  : 0
              updatedOperations = [
                ...currentOperations,
                {
                  ...values,
                  sequence: maxSequence + 1,
                },
              ]
            }

            // 更新工序列表（重新排序sequence）
            const sortedOperations = updatedOperations.map((op, index) => ({
              ...op,
              sequence: index + 1,
            }))

            await workOrderApi.updateOperations(workOrderDetail.id.toString(), {
              operations: sortedOperations,
            })

            messageApi.success(currentOperation ? '工序更新成功' : '工序添加成功')
            setOperationsModalVisible(false)
            setCurrentOperation(null)
            operationFormRef.current?.resetFields()

            // 刷新工序列表
            const operations = await workOrderApi.getOperations(workOrderDetail.id.toString())
            setWorkOrderOperations(operations)
          } catch (error: any) {
            messageApi.error(error.message || '操作失败')
            throw error
          }
        }}
        formRef={operationFormRef}
        width={MODAL_CONFIG.LARGE_WIDTH}
      >
        <ProFormSelect
          name="operation_id"
          label="工序"
          placeholder="请选择工序"
          rules={[{ required: true, message: '请选择工序' }]}
          request={async () => {
            try {
              const operations = await operationApi.list({ is_active: true, limit: 1000 })
              return operations.map((op: any) => ({
                label: `${op.code} - ${op.name}`,
                value: op.id,
                operation: op,
              }))
            } catch (error) {
              return []
            }
          }}
          fieldProps={{
            onChange: async (value: number, option: any) => {
              if (option?.operation) {
                const op = option.operation
                operationFormRef.current?.setFieldsValue({
                  operation_code: op.code,
                  operation_name: op.name,
                })
              }
            },
          }}
        />
        <ProFormText name="operation_code" label="工序编码" disabled />
        <ProFormText name="operation_name" label="工序名称" disabled />
        <ProFormSelect
          name="workshop_id"
          label="车间"
          placeholder="请选择车间"
          request={async () => {
            try {
              const workshops = await workshopApi.list({ limit: 1000 })
              return workshops.map((ws: any) => ({
                label: ws.name,
                value: ws.id,
                workshop: ws,
              }))
            } catch (error) {
              return []
            }
          }}
          fieldProps={{
            onChange: async (value: number, option: any) => {
              if (option?.workshop) {
                const ws = option.workshop
                operationFormRef.current?.setFieldsValue({
                  workshop_name: ws.name,
                })
              }
            },
          }}
        />
        <ProFormText name="workshop_name" label="车间名称" disabled />
        <ProFormDigit
          name="standard_time"
          label="标准工时（小时）"
          placeholder="请输入标准工时"
          min={0}
          precision={2}
          initialValue={0}
        />
        <ProFormDigit
          name="setup_time"
          label="准备时间（小时）"
          placeholder="请输入准备时间"
          min={0}
          precision={2}
          initialValue={0}
        />
        <ProFormDatePicker
          name="planned_start_date"
          label="计划开始时间"
          placeholder="请选择计划开始时间"
          fieldProps={{ showTime: true }}
        />
        <ProFormDatePicker
          name="planned_end_date"
          label="计划结束时间"
          placeholder="请选择计划结束时间"
          fieldProps={{ showTime: true }}
        />
        <ProFormTextArea
          name="remarks"
          label="备注"
          placeholder="请输入备注"
          fieldProps={{ rows: 3 }}
        />
      </FormModalTemplate>

      {/* 冻结工单Modal */}
      <FormModalTemplate
        title="冻结工单"
        open={freezeModalVisible}
        onClose={() => {
          setFreezeModalVisible(false)
          setCurrentWorkOrderForFreeze(null)
          freezeFormRef.current?.resetFields()
        }}
        onFinish={handleSubmitFreeze}
        isEdit={false}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={freezeFormRef}
      >
        <ProFormTextArea
          name="freeze_reason"
          label="冻结原因"
          placeholder="请输入冻结原因（必填）"
          rules={[{ required: true, message: '请输入冻结原因' }]}
          fieldProps={{
            rows: 4,
          }}
        />
      </FormModalTemplate>

      {/* 批量下达+智能检查Modal */}
      <Modal
        title="批量下达工单 - 智能检查结果"
        open={batchReleaseModalVisible}
        onCancel={() => {
          setBatchReleaseModalVisible(false)
          setBatchReleaseCheckResults([])
        }}
        width={800}
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              setBatchReleaseModalVisible(false)
              setBatchReleaseCheckResults([])
            }}
          >
            取消
          </Button>,
          <Button
            key="ignore"
            onClick={() => handleSubmitBatchRelease(true)}
            disabled={batchReleaseLoading}
          >
            忽略异常，强制下达所有
          </Button>,
          <Button
            key="submit"
            type="primary"
            onClick={() => handleSubmitBatchRelease(false)}
            disabled={
              batchReleaseLoading || batchReleaseCheckResults.filter(r => r.passed).length === 0
            }
          >
            确认下达正常工单 ({batchReleaseCheckResults.filter(r => r.passed).length}个)
          </Button>,
        ]}
      >
        <Spin spinning={batchReleaseLoading}>
          <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            {batchReleaseCheckResults.length > 0 ? (
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                {batchReleaseCheckResults.map((result, index) => (
                  <Card
                    key={index}
                    size="small"
                    style={{
                      border: result.passed ? '1px solid #52c41a' : '1px solid #ff4d4f',
                      backgroundColor: result.passed ? '#f6ffed' : '#fff2f0',
                    }}
                  >
                    <Row gutter={16}>
                      <Col span={6}>
                        <div>
                          <strong>工单编码：</strong>
                          {result.workOrder.code}
                        </div>
                      </Col>
                      <Col span={6}>
                        <div>
                          <strong>产品：</strong>
                          {result.workOrder.product_name}
                        </div>
                      </Col>
                      <Col span={6}>
                        <div>
                          <strong>状态：</strong>
                          <Tag color={result.passed ? 'success' : 'error'}>
                            {result.passed ? '通过' : '异常'}
                          </Tag>
                        </div>
                      </Col>
                      <Col span={6}>
                        {result.workOrder.is_frozen && <Tag color="error">已冻结</Tag>}
                      </Col>
                    </Row>
                    {result.errors.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ color: '#ff4d4f', fontWeight: 'bold' }}>错误：</div>
                        <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
                          {result.errors.map((error: string, i: number) => (
                            <li key={i} style={{ color: '#ff4d4f' }}>
                              {error}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {result.warnings.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ color: '#faad14', fontWeight: 'bold' }}>警告：</div>
                        <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
                          {result.warnings.map((warning: string, i: number) => (
                            <li key={i} style={{ color: '#faad14' }}>
                              {warning}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </Card>
                ))}
              </Space>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                正在检查工单...
              </div>
            )}
          </div>
        </Spin>
      </Modal>

      {/* 批量冻结Modal */}
      <Modal
        title="批量冻结工单"
        open={batchFreezeModalVisible}
        onOk={handleSubmitBatchFreeze}
        onCancel={() => {
          setBatchFreezeModalVisible(false)
          setBatchFreezeReason('')
        }}
      >
        <div style={{ marginBottom: 16 }}>
          已选择 <strong>{selectedRowKeys.length}</strong> 个工单进行冻结
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>
            冻结原因 <span style={{ color: '#ff4d4f' }}>*</span>
          </div>
          <Input.TextArea
            rows={4}
            value={batchFreezeReason}
            onChange={e => setBatchFreezeReason(e.target.value)}
            placeholder="请输入冻结原因（必填）"
          />
        </div>
      </Modal>

      {/* 批量设置优先级Modal */}
      <Modal
        title="批量设置优先级"
        open={batchPriorityModalVisible}
        onOk={handleSubmitBatchPriority}
        onCancel={() => setBatchPriorityModalVisible(false)}
        okText="确定"
        cancelText="取消"
      >
        <div style={{ padding: '16px 0' }}>
          <div style={{ marginBottom: 16 }}>
            已选择 <strong>{selectedRowKeys.length}</strong> 个工单
          </div>
          <div>
            <div style={{ marginBottom: 8 }}>优先级：</div>
            <Select
              value={batchPriority}
              onChange={value => setBatchPriority(value)}
              style={{ width: '100%' }}
            >
              <Select.Option value="low">低</Select.Option>
              <Select.Option value="normal">正常</Select.Option>
              <Select.Option value="high">高</Select.Option>
              <Select.Option value="urgent">紧急</Select.Option>
            </Select>
          </div>
        </div>
      </Modal>

      {/* 状态流转Modal */}
      <FormModalTemplate
        title="状态流转"
        open={stateTransitionModalVisible}
        onClose={() => {
          setStateTransitionModalVisible(false)
          transitionFormRef.current?.resetFields()
        }}
        onFinish={handleSubmitStateTransition}
        formRef={transitionFormRef}
        loading={transitionLoading}
        {...MODAL_CONFIG}
      >
        <div
          style={{ marginBottom: 16, padding: '12px', background: '#f5f5f5', borderRadius: '4px' }}
        >
          <div style={{ marginBottom: 8 }}>
            <span style={{ color: '#666' }}>当前状态：</span>
            <Tag
              color={
                workOrderDetail?.status === 'draft'
                  ? 'default'
                  : workOrderDetail?.status === 'released'
                    ? 'processing'
                    : workOrderDetail?.status === 'in_progress'
                      ? 'processing'
                      : workOrderDetail?.status === 'completed'
                        ? 'success'
                        : workOrderDetail?.status === 'cancelled'
                          ? 'error'
                          : 'default'
              }
            >
              {workOrderDetail?.status === 'draft'
                ? '草稿'
                : workOrderDetail?.status === 'released'
                  ? '已下达'
                  : workOrderDetail?.status === 'in_progress'
                    ? '执行中'
                    : workOrderDetail?.status === 'completed'
                      ? '已完成'
                      : workOrderDetail?.status === 'cancelled'
                        ? '已取消'
                        : workOrderDetail?.status}
            </Tag>
          </div>
          <div style={{ color: '#666', fontSize: 12 }}>工单编号：{workOrderDetail?.code || ''}</div>
        </div>
        <ProFormSelect
          name="to_state"
          label="目标状态"
          placeholder="请选择目标状态"
          rules={[{ required: true, message: '请选择目标状态' }]}
          options={availableTransitions.map(transition => ({
            label: `${
              transition.to_state === 'draft'
                ? '草稿'
                : transition.to_state === 'released'
                  ? '已下达'
                  : transition.to_state === 'in_progress'
                    ? '执行中'
                    : transition.to_state === 'completed'
                      ? '已完成'
                      : transition.to_state === 'cancelled'
                        ? '已取消'
                        : transition.to_state
            } ${transition.description ? `(${transition.description})` : ''}`,
            value: transition.to_state,
          }))}
        />
        <ProFormTextArea
          name="transition_reason"
          label="流转原因"
          placeholder="请输入流转原因（可选）"
          fieldProps={{ rows: 3 }}
        />
        <ProFormTextArea
          name="transition_comment"
          label="流转备注"
          placeholder="请输入流转备注（可选）"
          fieldProps={{ rows: 3 }}
        />
      </FormModalTemplate>

      {/* 合并工单Modal */}
      <FormModalTemplate
        title="合并工单"
        open={mergeModalVisible}
        onClose={() => {
          setMergeModalVisible(false)
          mergeFormRef.current?.resetFields()
        }}
        onFinish={handleSubmitMerge}
        isEdit={false}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={mergeFormRef}
      >
        <div style={{ marginBottom: 16 }}>
          <div>
            已选择 <strong>{selectedRowKeys.length}</strong> 个工单进行合并
          </div>
          <div style={{ marginTop: 8, color: '#666', fontSize: '12px' }}>
            注意：只能合并相同产品、相同状态（草稿或已下达）且未报工的工单
          </div>
        </div>
        <ProFormTextArea
          name="remarks"
          label="合并备注"
          placeholder="请输入合并备注（可选）"
          fieldProps={{
            rows: 3,
          }}
        />
      </FormModalTemplate>
    </>
  )
}

/**
 * 新建工单时的工序清单（样式参考工艺路线编辑页面）
 */
interface CreateWorkOrderOperationsListProps {
  selectedOperations: any[]
  setSelectedOperations: (ops: any[]) => void
  operationList: any[]
  formRef: React.RefObject<any>
  disabled?: boolean
}

const CreateWorkOrderOperationsList: React.FC<CreateWorkOrderOperationsListProps> = ({
  selectedOperations,
  setSelectedOperations,
  operationList,
  formRef,
  disabled = false,
}) => {
  const [addOpModalVisible, setAddOpModalVisible] = useState(false)
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const syncToForm = (ops: any[]) => {
    formRef.current?.setFieldsValue({ operations: ops.map((o: any) => o.operation_id) })
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = selectedOperations.findIndex((_: any, i: number) => `op-${i}` === active.id)
    const newIdx = selectedOperations.findIndex((_: any, i: number) => `op-${i}` === over.id)
    if (oldIdx === -1 || newIdx === -1) return
    const next = arrayMove(selectedOperations, oldIdx, newIdx).map((o: any, i: number) => ({
      ...o,
      sequence: i + 1,
    }))
    setSelectedOperations(next)
    syncToForm(next)
  }

  const handleRemove = (index: number) => {
    const next = selectedOperations
      .filter((_: any, i: number) => i !== index)
      .map((o: any, i: number) => ({ ...o, sequence: i + 1 }))
    setSelectedOperations(next)
    syncToForm(next)
  }

  const handleReplace = (index: number, newOpId: number) => {
    const op = operationList.find((o: any) => o.id === newOpId)
    if (!op) return
    const next = [...selectedOperations]
    next[index] = {
      operation_id: op.id,
      operation_code: op.code,
      operation_name: op.name,
      sequence: index + 1,
    }
    setSelectedOperations(next)
    syncToForm(next)
  }

  const addableOptions = operationList
    .filter((o: any) => !selectedOperations.some((s: any) => s.operation_id === o.id))
    .map((op: any) => ({ label: `${op.code} - ${op.name}`, value: op.id }))
  const handleAddSelect = (id: number) => {
    const op = operationList.find((o: any) => o.id === id)
    if (!op) return
    const next = [
      ...selectedOperations,
      {
        operation_id: op.id,
        operation_code: op.code,
        operation_name: op.name,
        sequence: selectedOperations.length + 1,
      },
    ]
    setSelectedOperations(next)
    syncToForm(next)
  }

  const getOpDetail = (opId: number) => operationList.find((o: any) => o.id === opId)

  if (selectedOperations.length === 0) {
    return (
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <Space>
            <Tag color="default">已配置 0 个工序</Tag>
          </Space>
          <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
            支持拖拽排序，点击删除移除工序
          </Typography.Text>
        </div>
        <div
          style={{
            padding: 24,
            background: '#fafafa',
            borderRadius: 4,
            border: '1px dashed #d9d9d9',
            textAlign: 'center',
            color: '#999',
          }}
        >
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="请先选择工艺路线，将自动加载工序清单"
          />
        </div>
        {!disabled && addableOptions.length > 0 && (
          <>
            <div
              onClick={() => setAddOpModalVisible(true)}
              style={{
                marginTop: 16,
                padding: '12px',
                border: '1px dashed #1890ff',
                borderRadius: '4px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
                color: '#1890ff',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#40a9ff'
                e.currentTarget.style.backgroundColor = '#f0f9ff'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = '#1890ff'
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              <PlusOutlined style={{ marginRight: 8 }} />
              <span>新增工序</span>
            </div>
            <Modal
              title="选择工序"
              open={addOpModalVisible}
              onCancel={() => setAddOpModalVisible(false)}
              footer={null}
              destroyOnHidden
            >
              <Select
                style={{ width: '100%' }}
                placeholder="选择要添加的工序"
                showSearch
                filterOption={(i, o) => (o?.label ?? '').toLowerCase().includes(i.toLowerCase())}
                options={addableOptions}
                onSelect={(id: number) => {
                  handleAddSelect(id)
                  setAddOpModalVisible(false)
                }}
              />
            </Modal>
          </>
        )}
      </div>
    )
  }

  const columns = [
    { title: '序号', key: 'index', width: 100 },
    { title: '工序代码/名称', key: 'operation' },
    { title: '报工类型', key: 'reportingType', width: 120 },
    { title: '允许跳转', key: 'allowJump', width: 100 },
    { title: '操作', key: 'action', width: 150 },
  ]

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <Space>
          <Tag color={selectedOperations.length > 0 ? 'processing' : 'default'}>
            已配置 {selectedOperations.length} 个工序
          </Tag>
        </Space>
        <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
          支持拖拽排序，点击删除移除工序
        </Typography.Text>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={selectedOperations.map((_: any, i: number) => `op-${i}`)}
          strategy={verticalListSortingStrategy}
        >
          <Table
            columns={columns}
            dataSource={selectedOperations}
            rowKey={(_, i) => `op-${i}`}
            pagination={false}
            size="small"
            components={{
              body: {
                wrapper: (wrapperProps: any) => (
                  <tbody {...wrapperProps}>
                    {selectedOperations.map((op: any, idx: number) => (
                      <CreateWorkOrderTableRow
                        key={`op-${idx}`}
                        op={op}
                        index={idx}
                        disabled={disabled}
                        onRemove={() => handleRemove(idx)}
                        onReplace={id => handleReplace(idx, id)}
                        operationList={operationList}
                        getOpDetail={getOpDetail}
                      />
                    ))}
                  </tbody>
                ),
              },
            }}
          />
        </SortableContext>
      </DndContext>
      {!disabled && addableOptions.length > 0 && (
        <div
          onClick={() => setAddOpModalVisible(true)}
          style={{
            marginTop: 16,
            padding: '12px',
            border: '1px dashed #1890ff',
            borderRadius: '4px',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s',
            color: '#1890ff',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = '#40a9ff'
            e.currentTarget.style.backgroundColor = '#f0f9ff'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = '#1890ff'
            e.currentTarget.style.backgroundColor = 'transparent'
          }}
        >
          <PlusOutlined style={{ marginRight: 8 }} />
          <span>新增工序</span>
        </div>
      )}
      {!disabled && addableOptions.length > 0 && (
        <Modal
          title="选择工序"
          open={addOpModalVisible}
          onCancel={() => setAddOpModalVisible(false)}
          footer={null}
          destroyOnHidden
        >
          <Select
            style={{ width: '100%' }}
            placeholder="选择要添加的工序"
            showSearch
            filterOption={(i, o) => (o?.label ?? '').toLowerCase().includes(i.toLowerCase())}
            options={addableOptions}
            onSelect={(id: number) => {
              handleAddSelect(id)
              setAddOpModalVisible(false)
            }}
          />
        </Modal>
      )}
    </div>
  )
}

/** 可拖拽的表格行 */
const CreateWorkOrderTableRow: React.FC<{
  op: any
  index: number
  disabled?: boolean
  onRemove: () => void
  onReplace: (newOpId: number) => void
  operationList: any[]
  getOpDetail: (id: number) => any
}> = ({ op, index, disabled, onRemove, onReplace, operationList, getOpDetail }) => {
  const id = `op-${index}`
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    backgroundColor: isDragging ? '#f0f9ff' : 'transparent',
    boxShadow: isDragging ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
  }
  return (
    <tr ref={setNodeRef} style={style}>
      <td>
        <Space>
          {!disabled && (
            <span
              className="drag-handle"
              {...attributes}
              {...listeners}
              style={{
                color: '#1890ff',
                cursor: 'move',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                padding: '4px',
                minWidth: '24px',
                minHeight: '24px',
              }}
            >
              <HolderOutlined style={{ fontSize: '16px' }} />
            </span>
          )}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '28px',
              height: '28px',
              padding: '0 8px',
              backgroundColor: '#f0f9ff',
              border: '1px solid #91d5ff',
              borderRadius: '6px',
              color: '#1890ff',
              fontWeight: 600,
              fontSize: '13px',
            }}
          >
            {index + 1}
          </span>
        </Space>
      </td>
      <td>
        <div style={{ fontWeight: 500 }}>
          {op.operation_code} - {op.operation_name}
        </div>
      </td>
      <td>
        <Tag
          color={
            (getOpDetail(op.operation_id)?.reportingType ||
              getOpDetail(op.operation_id)?.reporting_type) === 'quantity'
              ? 'blue'
              : 'green'
          }
        >
          {(getOpDetail(op.operation_id)?.reportingType ||
            getOpDetail(op.operation_id)?.reporting_type) === 'quantity'
            ? '按数量报工'
            : (getOpDetail(op.operation_id)?.reportingType ||
                  getOpDetail(op.operation_id)?.reporting_type) === 'status'
              ? '按状态报工'
              : '-'}
        </Tag>
      </td>
      <td>
        <Tag
          color={
            (getOpDetail(op.operation_id)?.allowJump ?? getOpDetail(op.operation_id)?.allow_jump)
              ? 'success'
              : 'default'
          }
        >
          {(getOpDetail(op.operation_id)?.allowJump ?? getOpDetail(op.operation_id)?.allow_jump)
            ? '允许'
            : '不允许'}
        </Tag>
      </td>
      <td onClick={e => e.stopPropagation()}>
        <Space>
          <Button
            type="link"
            size="small"
            onClick={() => {
              const opts = operationList.filter((o: any) => o.id !== op.operation_id)
              if (opts.length === 0) return
              Modal.confirm({
                title: '替换工序',
                content: (
                  <Select
                    style={{ width: '100%', marginTop: 8 }}
                    placeholder="选择替换的工序"
                    showSearch
                    filterOption={(i, o) =>
                      (o?.label ?? '').toLowerCase().includes(i.toLowerCase())
                    }
                    options={opts.map((opp: any) => ({
                      label: `${opp.code} - ${opp.name}`,
                      value: opp.id,
                    }))}
                    onSelect={(v: number) => {
                      onReplace(v)
                      Modal.destroyAll()
                    }}
                  />
                ),
                okText: '取消',
                cancelButtonProps: { style: { display: 'none' } },
                onOk: () => Modal.destroyAll(),
              })
            }}
          >
            替换
          </Button>
          <Button type="link" size="small" danger onClick={onRemove}>
            删除
          </Button>
        </Space>
      </td>
    </tr>
  )
}

/**
 * 工单工序列表组件
 */
interface WorkOrderOperationsListProps {
  workOrderId?: number
  operations: any[]
  workOrderStatus?: string
  onUpdate: () => Promise<void>
  onEdit: (operation: any) => void
}

const WorkOrderOperationsList: React.FC<WorkOrderOperationsListProps> = ({
  workOrderId,
  operations,
  workOrderStatus,
  onUpdate,
  onEdit,
}) => {
  const { message: messageApi } = App.useApp()
  const [localOperations, setLocalOperations] = useState<any[]>(operations)
  const [saving, setSaving] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => {
    setLocalOperations(operations)
  }, [operations])

  /**
   * 处理拖拽结束
   */
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = localOperations.findIndex(op => op.id === active.id)
      const newIndex = localOperations.findIndex(op => op.id === over.id)

      if (oldIndex === -1 || newIndex === -1) return

      // 检查是否有已报工的工序
      const movedOperation = localOperations[oldIndex]
      if (movedOperation.status !== 'pending' && movedOperation.status !== 'in_progress') {
        messageApi.warning('已报工的工序不允许调整顺序')
        return
      }

      const newOperations = arrayMove(localOperations, oldIndex, newIndex)
      // 重新计算sequence
      const sortedOperations = newOperations.map((op, index) => ({
        ...op,
        sequence: index + 1,
      }))

      setLocalOperations(sortedOperations)

      // 保存到后端
      if (workOrderId) {
        try {
          setSaving(true)
          await workOrderApi.updateOperations(workOrderId.toString(), {
            operations: sortedOperations,
          })
          messageApi.success('工序顺序已更新')
          await onUpdate()
        } catch (error: any) {
          messageApi.error(error.message || '更新失败')
          // 恢复原顺序
          setLocalOperations(operations)
        } finally {
          setSaving(false)
        }
      }
    }
  }

  /**
   * 删除工序
   */
  const handleDelete = async (operation: any) => {
    if (operation.status !== 'pending' && operation.status !== 'in_progress') {
      messageApi.warning('已报工的工序不允许删除')
      return
    }

    Modal.confirm({
      title: '确认删除',
      content: `确定要删除工序"${operation.operation_name}"吗？`,
      onOk: async () => {
        try {
          if (!workOrderId) return

          const updatedOperations = localOperations
            .filter(op => op.id !== operation.id)
            .map((op, index) => ({
              ...op,
              sequence: index + 1,
            }))

          await workOrderApi.updateOperations(workOrderId.toString(), {
            operations: updatedOperations,
          })

          messageApi.success('工序删除成功')
          await onUpdate()
        } catch (error: any) {
          messageApi.error(error.message || '删除失败')
        }
      },
    })
  }

  const canEdit = workOrderStatus && ['draft', 'released'].includes(workOrderStatus)

  if (localOperations.length === 0) {
    return <div style={{ padding: '48px 24px', textAlign: 'center', color: '#999' }}>暂无工序</div>
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext
        items={localOperations.map(op => op.id)}
        strategy={verticalListSortingStrategy}
      >
        <div>
          {localOperations.map(operation => {
            const isReported = operation.status !== 'pending' && operation.status !== 'in_progress'
            return (
              <SortableOperationItem
                key={operation.id}
                operation={operation}
                canEdit={!!(canEdit && !isReported)}
                isReported={isReported}
                onEdit={() => onEdit(operation)}
                onDelete={() => handleDelete(operation)}
              />
            )
          })}
        </div>
      </SortableContext>
    </DndContext>
  )
}

/**
 * 可拖拽的工序项组件
 */
interface SortableOperationItemProps {
  operation: any
  canEdit: boolean
  isReported: boolean
  onEdit: () => void
  onDelete: () => void
}

const SortableOperationItem: React.FC<SortableOperationItemProps> = ({
  operation,
  canEdit,
  isReported,
  onEdit,
  onDelete,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: operation.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    backgroundColor: isReported ? '#f5f5f5' : '#fff',
    border: '1px solid #d9d9d9',
    borderRadius: '4px',
    padding: '12px',
    marginBottom: '8px',
    cursor: canEdit && !isReported ? 'grab' : 'not-allowed',
  }

  const statusMap: Record<string, { text: string; color: string }> = {
    pending: { text: '待开始', color: 'default' },
    in_progress: { text: '进行中', color: 'processing' },
    completed: { text: '已完成', color: 'success' },
    cancelled: { text: '已取消', color: 'error' },
  }

  const statusConfig = statusMap[operation.status] || { text: operation.status, color: 'default' }

  return (
    <div ref={setNodeRef} style={style}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {canEdit && (
          <div
            {...attributes}
            {...listeners}
            style={{
              cursor: 'grab',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <HolderOutlined style={{ color: '#999' }} />
          </div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontWeight: 'bold', color: isReported ? '#999' : '#000' }}>
              {operation.sequence}. {operation.operation_name || operation.name}
            </span>
            <Tag color={statusConfig.color}>{statusConfig.text}</Tag>
            {isReported && <Tag color="warning">已报工</Tag>}
          </div>
          <div style={{ fontSize: '12px', color: '#999' }}>
            <Space separator={<span>|</span>}>
              <span>编码: {operation.operation_code || operation.code}</span>
              {operation.workshop_name && <span>车间: {operation.workshop_name}</span>}
              {operation.standard_time > 0 && <span>标准工时: {operation.standard_time}h</span>}
              {operation.planned_start_date && (
                <span>计划: {dayjs(operation.planned_start_date).format('YYYY-MM-DD HH:mm')}</span>
              )}
            </Space>
          </div>
        </div>
        {canEdit && (
          <Space>
            <Button type="link" size="small" onClick={onEdit}>
              编辑
            </Button>
            <Popconfirm
              title="确认删除"
              description={`确定要删除工序"${operation.operation_name || operation.name}"吗？`}
              onConfirm={onDelete}
            >
              <Button type="link" size="small" danger>
                删除
              </Button>
            </Popconfirm>
          </Space>
        )}
      </div>

    </div>
  )
}

export default WorkOrdersPage
