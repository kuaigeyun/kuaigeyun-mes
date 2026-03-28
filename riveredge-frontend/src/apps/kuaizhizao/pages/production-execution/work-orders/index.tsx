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

import React, { useRef, useState, useEffect, useLayoutEffect, useMemo, useCallback, lazy, Suspense, type ComponentProps } from 'react'
import { DatePicker } from 'antd'
const { RangePicker } = DatePicker
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  ActionType,
  ProColumns,
  ProDescriptions,
  ProDescriptionsItemProps,
  ProFormText,
  ProFormSelect,
  ProFormDatePicker,
  ProFormDateRangePicker,
  ProFormDigit,
  ProFormTextArea,
  ProFormRadio,
  ProFormSwitch,
  ProForm,
  ProFormGroup,
  ProFormUploadButton,
} from '@ant-design/pro-components'
import {
  App,
  Button,
  ConfigProvider,
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
  Form,
  theme,
  Typography,
  Empty,
  Dropdown,
  List,
  Switch,
} from 'antd'
import type { MenuProps } from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  EyeOutlined,
  RightOutlined,
  PlayCircleOutlined,
  QrcodeOutlined,
  DeleteOutlined,
  PrinterOutlined,
  MoreOutlined,
  StopOutlined,
  TeamOutlined,
  ShoppingOutlined,
  FileTextOutlined,
  CloseCircleOutlined,
  InboxOutlined,
} from '@ant-design/icons'
import { UniTable } from '../../../../../components/uni-table'
import { useUserPreferenceStore } from '../../../../../stores/userPreferenceStore'
import { useConfigStore } from '../../../../../stores/configStore'
import {
  fetchWorkOrderListForTable,
  prefetchDefaultWorkOrderList,
  hydrateDefaultWorkOrderListPageFromSession,
  WORK_ORDER_LIST_STALE_MS,
} from './workOrderListTable'
import { ThemedSegmented } from '../../../../../components/themed-segmented'
const SyncFromDatasetModal = lazy(() => import('../../../../../components/sync-from-dataset-modal'))
import {
  ListPageTemplate,
  FormModalTemplate,
  DetailDrawerTemplate,
  MODAL_CONFIG,
  TOUCH_SCREEN_CONFIG,
  type StatCard,
} from '../../../../../components/layout-templates'
import { qrcodeApi } from '../../../../../services/qrcode'
import { workOrderApi, reworkOrderApi, outsourceOrderApi, getWorkOrderStatistics, productionControlApi } from '../../../services/production'
import { UniDropdown } from '../../../../../components/uni-dropdown'
import { stateTransitionApi, AvailableTransition } from '../../../services/state-transition'
import { listSalesOrders } from '../../../services/sales'
import { getSalesOrder } from '../../../services/sales-order'
import {
  listSalesForecasts,
  getSalesForecast,
  getSalesForecastItems,
} from '../../../services/sales-forecast'
import { listDemands, getDemand } from '../../../services/demand'
import { operationApi, processRouteApi } from '../../../../master-data/services/process'
import { workshopApi } from '../../../../master-data/services/factory'
import { supplierApi } from '../../../../master-data/services/supply-chain'
import { warehouseApi } from '../../../services/warehouse-execution'
import { materialApi } from '../../../../master-data/services/material'
import { useNavigate, useLocation } from 'react-router-dom'
import dayjs from 'dayjs'
import CodeField from '../../../../../components/code-field'
import { getUserList } from '../../../../../services/user'
import { getEquipmentList } from '../../../../../services/equipment'
import { getMoldList } from '../../../../../services/mold'
import { toolApi } from '../../../services/equipment'
const WorkOrderPrintModal = lazy(() => import('./components/WorkOrderPrintModal'))
/** 指标卡趋势图：首屏不拉 @ant-design/charts，减少工单页 JS 解析与主线程占用 */
const LazyStatTrendArea = lazy(() =>
  import('@ant-design/charts').then(m => ({ default: m.Area }))
)
const LazySmartSuggestionFloatPanel = lazy(() => import('../../../../../components/smart-suggestion-float-panel'))
const LazyCreateWorkOrderOperationsList = lazy(() => import('./components/WorkOrderCreateDndList'))
const LazyWorkOrderOperationsList = lazy(() => import('./components/WorkOrderDetailDndOperations'))
const LazyWorkOrderKittingPanel = lazy(() => import('./components/WorkOrderKittingPanel'))
const LazyQRCodeGenerator = lazy(() =>
  import('../../../../../components/qrcode/QRCodeGenerator').then(m => ({ default: m.QRCodeGenerator }))
)
const LazyDocumentTrackingPanel = lazy(() => import('../../../../../components/document-tracking-panel'))
const LazyUniLifecycleStepper = lazy(() =>
  import('../../../../../components/uni-lifecycle').then(m => ({ default: m.UniLifecycleStepper }))
)
const LazyUniMaterialSelect = lazy(() => import('../../../../../components/uni-material-select'))
import { getWorkOrderLifecycle } from '../../../utils/workOrderLifecycle'

/** 列表行展开工序：TanStack 缓存键前缀（与派工/开工后 invalidate 一致） */
const WORK_ORDER_ROW_EXPAND_QK = 'workOrderRowExpand' as const
const WORK_ORDER_ROW_EXPAND_STALE_MS = 60_000
import { getFileDownloadUrl, uploadMultipleFiles } from '../../../../../services/file'
import { batchImport } from '../../../../../utils/batchOperations'
import { usePageMetrics } from '../../../../../hooks/usePageMetrics'

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
  over_report_mode?: string
  over_report_value?: number
  manually_completed?: boolean
  remarks?: string
  created_at?: string
  updated_at?: string
  /** 制造模式（fabrication加工型/assembly装配型），来自产品物料 */
  manufacturing_mode?: 'fabrication' | 'assembly'
  /** 齐套率 (%) */
  readiness_rate?: number
}

const WorkOrdersPage: React.FC = () => {
  const { t } = useTranslation()
  const { message: messageApi } = App.useApp()
  const { token } = theme.useToken()
  const queryClient = useQueryClient()
  const getPreference = useUserPreferenceStore((s) => s.getPreference)
  const getConfig = useConfigStore((s) => s.getConfig)
  const workOrderListDefaultPageSize = getPreference(
    'ui.default_page_size',
    getConfig('ui.default_page_size', 20)
  )
  const location = useLocation()
  const actionRef = useRef<ActionType>(null)
  const tableSearchFormRef = useRef<any>(null)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])

  const { statCards: pageMetricCards, hasConfig: hasPageMetricConfig } = usePageMetrics()
  const invalidateStatistics = () => {
    queryClient.invalidateQueries({ queryKey: ['workOrderStatistics'] })
    queryClient.invalidateQueries({ queryKey: ['pageMetrics', location.pathname] })
    queryClient.invalidateQueries({
      queryKey: ['uniTable', 'kuaizhizao', 'work-orders', 'list'],
      exact: false,
    })
  }
  const { data: statistics } = useQuery({
    queryKey: ['workOrderStatistics'],
    queryFn: getWorkOrderStatistics,
    enabled: !hasPageMetricConfig,
    staleTime: 30_000, // 30 秒内不重复请求统计接口
  })
  const { data: executionConfig } = useQuery({
    queryKey: ['workOrderExecutionConfig'],
    queryFn: () => workOrderApi.getExecutionConfig(),
    staleTime: 60_000,
  })

  useEffect(() => {
    prefetchDefaultWorkOrderList(queryClient, workOrderListDefaultPageSize)
  }, [queryClient, workOrderListDefaultPageSize])

  useLayoutEffect(() => {
    hydrateDefaultWorkOrderListPageFromSession(
      queryClient,
      workOrderListDefaultPageSize,
      WORK_ORDER_LIST_STALE_MS
    )
  }, [queryClient, workOrderListDefaultPageSize])

  const handleWorkOrderTableRequest = useCallback(
    async (params: any, sort: any, _filter: any, searchFormValues: any) => {
      try {
        return await fetchWorkOrderListForTable(
          { current: params.current!, pageSize: params.pageSize! },
          sort,
          _filter,
          searchFormValues
        )
      } catch (error) {
        console.error('获取工单列表失败:', error)
        messageApi.error('获取工单列表失败')
        return {
          data: [],
          success: false,
          total: 0,
        }
      }
    },
    [messageApi]
  )

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
    items?: { productId: number; quantity: number; variant_attributes?: Record<string, unknown> }[]
  } | null>(null)
  // 选择文档弹窗
  const [productSourceModalVisible, setProductSourceModalVisible] = useState(false)
  const [productSourceModalType, setProductSourceModalType] = useState<
    'sales_order' | 'sales_forecast' | 'demand' | null
  >(null)
  
  // 紧急插单模拟状态
  const [urgentSimulationVisible, setUrgentSimulationVisible] = useState(false);
  const [simulationLoading, setSimulationLoading] = useState(false);
  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [simulationParams, setSimulationParams] = useState<any>(null);

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
          const res: any = await listSalesOrders({ limit: 50 })
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
          const res: any = await listSalesForecasts({ limit: 50 })
          const forecasts = res?.data ?? []
          const flat: any[] = []
          for (const f of forecasts) {
            const items = (await getSalesForecastItems(f.id as number)) ?? []
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
      variant_attributes: first.variant_attributes != null
        ? (typeof first.variant_attributes === 'string'
            ? first.variant_attributes
            : JSON.stringify(first.variant_attributes, null, 2))
        : undefined,
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
          else if (sourceType === 'Configure') validationErrors.push('配置件需填写属性')
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

  // 创建/编辑弹窗所需数据是否已加载
  const [modalDataLoaded, setModalDataLoaded] = useState(false)
  const [modalDataLoading, setModalDataLoading] = useState(false)

  // 延迟加载：仅当打开创建/编辑弹窗时加载产品、工序、工艺路线、人员、设备等（列表页无需这些数据）
  useEffect(() => {
    if (!modalVisible) return
    if (modalDataLoaded) return
    let cancelled = false
    const loadData = async () => {
      setModalDataLoading(true)
      try {
        const [products, operations, routes, usersRes, equipmentRes, moldsRes, toolsRes] =
          await Promise.all([
            materialApi.list({ isActive: true, limit: 1000 }),
            operationApi.list({ is_active: true, limit: 500 }).catch(() => []),
            processRouteApi.list({ is_active: true, limit: 500 }).catch(() => []),
            getUserList({ is_active: true, page_size: 100 }).catch(() => ({ items: [] })),
            getEquipmentList({ is_active: true, limit: 100 }).catch(() => ({ items: [] })),
            getMoldList({ is_active: true, limit: 100 }).catch(() => ({ items: [] })),
            toolApi.list({ limit: 100 }).catch(() => ({ items: [] })),
          ])
        if (cancelled) return
        setProductList(Array.isArray(products) ? products : (products as any)?.data ?? (products as any)?.items ?? [])
        setOperationList(Array.isArray(operations) ? operations : [])
        setProcessRouteList(Array.isArray(routes) ? routes : [])
        setWorkerList(usersRes?.items || [])
        setEquipmentList(equipmentRes?.items || [])
        setMoldList(moldsRes?.items || [])
        setToolList(toolsRes?.items || [])
        setModalDataLoaded(true)
      } catch (error) {
        if (!cancelled) {
          console.error('获取弹窗数据失败:', error)
          setProductList([])
        }
      } finally {
        if (!cancelled) setModalDataLoading(false)
      }
    }
    loadData()
    return () => { cancelled = true }
  }, [modalVisible, modalDataLoaded])

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
  const [workOrderOperations, setWorkOrderOperations] = useState<any[]>([])
  const [operationsModalVisible, setOperationsModalVisible] = useState(false)
  const [currentOperation, setCurrentOperation] = useState<any>(null)
  const operationFormRef = useRef<any>()

  // 行展开相关状态
  const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([])
  const [expandedOperationsMap, setExpandedOperationsMap] = useState<Record<number, any[]>>({})
  const [expandedWorkOrderDetailMap, setExpandedWorkOrderDetailMap] = useState<Record<number, WorkOrder>>({})
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
  const [transitionLoading, setTransitionLoading] = useState(false)
  const transitionFormRef = useRef<any>(null)

  // 合并工单相关状态
  const [mergeModalVisible, setMergeModalVisible] = useState(false)
  const mergeFormRef = useRef<any>(null)
  const [mergeLoading, setMergeLoading] = useState(false)

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
  const [moldList, setMoldList] = useState<any[]>([])
  const [toolList, setToolList] = useState<any[]>([])
  const dispatchFormRef = useRef<any>(null)

  // 打印相关状态
  const [printModalVisible, setPrintModalVisible] = useState(false)
  const [syncModalVisible, setSyncModalVisible] = useState(false)
  const [currentWorkOrderForPrint, setCurrentWorkOrderForPrint] = useState<any>(null)

  const selectedRows = useMemo(() => {
    return selectedRowKeys.map(key => {
      // Try to find in current list via actionRef or other state if possible, 
      // but for simple consistency we can just use the key-based approach in the components that need it
      // or define it here if we have a way to access the full data.
      // Since ProTable actionRef.current?.asRow?.(key) is ideal but might not be available yet:
      return (actionRef.current as any)?.asRow?.(key);
    }).filter(Boolean);
  }, [selectedRowKeys, actionRef.current]);

  /** 解析工艺路线的 operation_sequence，兼容多种格式（与工艺路线编辑页保存格式对接） */
  const parseOperationSequence = (
    seq: any,
    opList: any[]
  ): {
    operation_id: number
    operation_code: string
    operation_name: string
    sequence: number
    is_node_operation: boolean
    reporting_type: string
    over_report_mode: string
    over_report_value: number
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
      is_node_operation: boolean
      reporting_type: string
      over_report_mode: string
      over_report_value: number
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
        const isNode = item.isNodeOperation ?? item.is_node_operation ?? false
        const reportingType =
          item.reportingType ??
          item.reporting_type ??
          op.reportingType ??
          (op as any).reporting_type ??
          'quantity'
        const orm =
          item.overReportMode ??
          item.over_report_mode ??
          (op as any).overReportMode ??
          (op as any).over_report_mode ??
          'none'
        const orv = Number(
          item.overReportValue ?? item.over_report_value ?? (op as any).overReportValue ?? (op as any).over_report_value ?? 0
        ) || 0
        result.push({
          operation_id: op.id,
          operation_code: op.code ?? op.mainCode ?? '',
          operation_name: op.name ?? '',
          sequence: item.sequence ?? item._idx ?? index + 1,
          is_node_operation: Boolean(isNode),
          reporting_type: reportingType === 'status' ? 'status' : 'quantity',
          over_report_mode: String(orm || 'none'),
          over_report_value: orv,
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
      const routeDetail = await processRouteApi.get(route.uuid)
      const routeJump =
        (routeDetail as any)?.allow_operation_jump ?? (routeDetail as any)?.allowOperationJump ?? false
      formRef.current?.setFieldsValue({
        process_route_id: route.id,
        allow_operation_jump: routeJump,
      })
      const operations = parseOperationSequence(routeDetail?.operation_sequence, operationList)
      if (operations.length > 0) {
        setSelectedOperations(operations)
        formRef.current?.setFieldsValue({
          operations: operations.map((o: any) => o.operation_id),
        })
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

  /** 参考销售订单：先打开弹窗，再让 CodeField 自动生成编号 */
  const handleCreate = () => {
    setIsEdit(false)
    setCurrentWorkOrder(null)
    setProductionMode('MTS') // 重置为MTS模式
    setSelectedOperations([]) // 清空选中的工序
    setSelectedMaterialSourceInfo(null) // 清空物料来源信息
    setModalVisible(true)
    setTimeout(() => formRef.current?.resetFields(), 0)
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
      // 加载工单工序列表，用于编辑时展示
      try {
        const operations = await workOrderApi.getOperations(record.id!.toString())
        const ops = (operations || []).map((op: any) => ({
          operation_id: op.operation_id,
          operation_code: op.operation_code || op.operationCode,
          operation_name: op.operation_name || op.operationName,
          sequence: op.sequence ?? 0,
          is_node_operation: op.is_node_operation ?? op.isNodeOperation ?? false,
          reporting_type: op.reporting_type ?? op.reportingType ?? 'quantity',
          over_report_mode: op.over_report_mode ?? op.overReportMode ?? 'none',
          over_report_value: Number(op.over_report_value ?? op.overReportValue ?? 0) || 0,
          workshop_id: op.workshop_id,
          workshop_name: op.workshop_name,
          work_center_id: op.work_center_id,
          work_center_name: op.work_center_name,
          planned_start_date: op.planned_start_date,
          planned_end_date: op.planned_end_date,
          standard_time: op.standard_time,
          setup_time: op.setup_time,
          remarks: op.remarks,
        }))
        setSelectedOperations(ops)
      } catch (e) {
        console.error('加载工单工序失败', e)
        setSelectedOperations([])
      }
      // 编辑时 product_id 禁用，不加载物料来源（属性字段在编辑时也不展示）
      // 延迟设置表单值，确保表单已渲染
      setTimeout(() => {
        const mode = detail.production_mode || 'MTS'
        setProductionMode(mode)
        const variantAttrs = detail.variant_attributes
        formRef.current?.setFieldsValue({
          code: detail.code,
          name: detail.name,
          product_id: detail.product_id,
          product_code: detail.product_code,
          product_name: detail.product_name,
          quantity: detail.quantity,
          production_mode: mode,
          variant_attributes: variantAttrs != null
            ? (typeof variantAttrs === 'string' ? variantAttrs : JSON.stringify(variantAttrs, null, 2))
            : undefined,
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
          process_route_id: (detail as any).process_route_id ?? (detail as any).processRouteId,
          over_report_mode: (detail as any).over_report_mode ?? (detail as any).overReportMode ?? 'none',
          over_report_value: Number((detail as any).over_report_value ?? (detail as any).overReportValue ?? 0) || 0,
          remarks: detail.remarks,
          attachments: (detail as any).attachments || [],
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
      // 展开：优先单次 GET operations?include_meta（含 manufacturing_mode），后端并对不良类型批量查询；TanStack 去重
      if (!expandedOperationsMap[record.id]) {
        setLoadingOperationsMap(prev => ({ ...prev, [record.id!]: true }))
        try {
          const wid = record.id!.toString()
          const bundle = await queryClient.fetchQuery({
            queryKey: [WORK_ORDER_ROW_EXPAND_QK, record.id],
            staleTime: WORK_ORDER_ROW_EXPAND_STALE_MS,
            queryFn: async () => {
              const res = await workOrderApi.getOperations(wid, { includeMeta: true })
              if (
                res &&
                typeof res === 'object' &&
                !Array.isArray(res) &&
                Array.isArray((res as { operations?: unknown }).operations)
              ) {
                const r = res as { manufacturing_mode?: string; operations: any[] }
                return {
                  manufacturing_mode: r.manufacturing_mode || 'fabrication',
                  operations: r.operations || [],
                }
              }
              const ops = Array.isArray(res) ? res : []
              const detail = await workOrderApi.get(wid)
              return {
                manufacturing_mode: (detail as WorkOrder)?.manufacturing_mode || 'fabrication',
                operations: ops,
              }
            },
          })
          setExpandedWorkOrderDetailMap(prev => ({
            ...prev,
            [record.id!]: { manufacturing_mode: bundle.manufacturing_mode } as WorkOrder,
          }))
          setExpandedOperationsMap(prev => ({ ...prev, [record.id!]: bundle.operations || [] }))
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
          assigned_mold_id: operation.assigned_mold_id,
          assigned_tool_id: operation.assigned_tool_id,
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
      const mold = moldList.find(m => m.id === values.assigned_mold_id)
      const tool = toolList.find(t => t.id === values.assigned_tool_id)

      const dispatchData = {
        assigned_worker_id: values.assigned_worker_id,
        assigned_worker_name: worker?.full_name || worker?.username || '-',
        assigned_equipment_id: values.assigned_equipment_id,
        assigned_equipment_name: equipment?.name || '-',
        assigned_mold_id: values.assigned_mold_id,
        assigned_mold_name: mold?.name || '-',
        assigned_tool_id: values.assigned_tool_id,
        assigned_tool_name: tool?.name || '-',
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
      queryClient.invalidateQueries({
        queryKey: [WORK_ORDER_ROW_EXPAND_QK, currentWorkOrderForDispatch.id],
      })
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
      // 按数量报工：合格数量 / 计划数量
      const qualified = Number(operation.qualified_quantity || 0)
      const planned = Number(workOrder.quantity || 1)
      return Math.min(Math.round((qualified / planned) * 100), 100)
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
   * 渲染工序卡片（人机料法，按制造模式区分展示）
   */
  const renderOperationCard = (
    operation: any,
    workOrder: WorkOrder,
    index: number,
    total: number,
    manufacturingMode: 'fabrication' | 'assembly' = 'fabrication'
  ) => {
    const progress = calculateProgress(operation, workOrder)
    const qualifiedRate = calculateQualifiedRate(operation)
    const progressColor = getProgressColor(operation, qualifiedRate)

    return (
      <React.Fragment key={operation.id || index}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: 200,
            minHeight: 200,
            flexShrink: 0,
            borderRadius: 8,
            overflow: 'hidden',
            border:
              operation.status === 'completed'
                ? '2px solid #52c41a'
                : operation.status === 'in_progress'
                  ? '2px solid #ff4d4f'
                  : `1px solid ${token.colorBorder}`,
            backgroundColor: token.colorBgContainer,
          }}
        >
          {/* 顶部：工序名 + 状态 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 10px',
              borderBottom: `1px solid ${token.colorBorderSecondary}`,
              flexShrink: 0,
              backgroundColor: token.colorFillTertiary,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600 }}>{operation.operation_name}</div>
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
          </div>

          {/* 中部：进度与信息（参考图：环形图左、文字右） */}
          <div style={{ flex: 1, padding: '8px 10px', overflow: 'hidden', minHeight: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              {/* 左侧：环形进度 */}
              <Progress
                type="circle"
                percent={progress}
                size={56}
                strokeColor={progressColor}
                format={percent => `${percent}%`}
              />
              {/* 右侧：完成/合格/合格率文字 */}
              <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: token.colorTextSecondary, lineHeight: 1.5 }}>
                {operation.reporting_type === 'status' ? (
                  <div style={{ whiteSpace: 'nowrap' }}>状态：{operation.status === 'completed' ? '已完成' : '未完成'}</div>
                ) : (
                  <>
                    <div style={{ whiteSpace: 'nowrap' }}>完成: {Number(operation.completed_quantity || 0)} / {Number(workOrder.quantity || 0)}</div>
                    <div style={{ whiteSpace: 'nowrap' }}>合格: {Number(operation.qualified_quantity || 0)} / 不合格: {Number(operation.unqualified_quantity || 0)}</div>
                    <div
                      style={{
                        whiteSpace: 'nowrap',
                        color:
                          operation.completed_quantity > 0
                            ? qualifiedRate >= 95
                              ? '#52c41a'
                              : qualifiedRate >= 80
                                ? '#faad14'
                                : '#ff4d4f'
                            : token.colorTextTertiary,
                      }}
                    >
                      合格率: {operation.completed_quantity > 0 ? `${qualifiedRate}%` : '-'}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* 工序信息：人机料法 + 车间/时间 */}
            <div style={{ fontSize: 12, color: token.colorTextSecondary }}>
              <div style={{ marginTop: 4, paddingTop: 4, borderTop: `1px dashed ${token.colorBorderSecondary}` }}>
                {/* 料：合格/不合格/剩余物料（参考图：图标+文字，数字着色） */}
                {(manufacturingMode === 'fabrication' || manufacturingMode === 'assembly') && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: 8,
                      flexWrap: 'wrap',
                    }}
                  >
                    {manufacturingMode === 'assembly' && index === 0 ? (
                      operation.material_picked_count != null && operation.material_picked_count > 0 ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 12 }}>
                          <InboxOutlined style={{ marginRight: 4, color: token.colorTextSecondary }} />
                          已领 {operation.material_picked_count} 种物料
                          {operation.assembly_kit_sets != null && ` / 可装配 ${operation.assembly_kit_sets} 套`}
                        </span>
                      ) : null
                    ) : (
                      <>
                        {manufacturingMode === 'fabrication' && (operation.material_remaining != null || (index < total - 1 && operation.next_op_planned_qty != null)) && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12, fontSize: 12, flexWrap: 'wrap' }}>
                            <InboxOutlined style={{ marginRight: 4, color: token.colorText }} />
                            {operation.material_remaining != null && (
                              <span style={{ marginRight: 8 }}>剩余物料 {Number(operation.material_remaining)}</span>
                            )}
                            {index < total - 1 && operation.next_op_planned_qty != null && (
                              <>转下道: <span style={{ borderBottom: operation.next_op_has_reporting ? '1px solid' : '1px dashed', borderColor: token.colorTextTertiary }}>{Number(operation.next_op_planned_qty)}</span></>
                            )}
                          </span>
                        )}
                        {manufacturingMode === 'fabrication' && operation.material_scrap_qty != null && Number(operation.material_scrap_qty) > 0 && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 12 }}>
                            <CloseCircleOutlined style={{ marginRight: 4, color: token.colorError }} />
                            报废 <span style={{ color: token.colorError }}>{operation.material_scrap_qty}</span>
                          </span>
                        )}
                        {manufacturingMode === 'assembly' && index > 0 && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 12 }}>
                            计划 {workOrder.quantity} / 已产出 {operation.qualified_quantity ?? 0}
                            {operation.material_scrap_qty != null && Number(operation.material_scrap_qty) > 0 && (
                              <span style={{ marginLeft: 4, color: token.colorError }}>报废 {operation.material_scrap_qty}</span>
                            )}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                )}
                {manufacturingMode === 'fabrication' && index === 0 && operation.material_picked_count != null && operation.material_picked_count > 0 && (
                  <div style={{ marginBottom: 2, fontSize: 12 }}>
                    <InboxOutlined style={{ marginRight: 4, color: token.colorTextSecondary }} />
                    已领 {operation.material_picked_count} 种物料
                  </div>
                )}
                <div style={{ marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <strong>分配人员: </strong>
                  {operation.assigned_worker_name || '-'}
                </div>
                <div style={{ marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <strong>设备: </strong>
                  {operation.assigned_equipment_name || '-'}
                </div>
                <div style={{ marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <strong>车间: </strong>
                  {operation.workshop_name || '-'}
                </div>
                <div style={{ marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <strong>工作中心: </strong>
                  {operation.work_center_name || '-'}
                </div>
                <div style={{ marginBottom: 2, whiteSpace: 'nowrap' }}>
                  <strong>计划时间: </strong>
                  {operation.planned_start_date
                    ? (() => {
                        const d = new Date(operation.planned_start_date)
                        return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
                      })()
                    : '-'}
                </div>
                <div style={{ marginBottom: 2, whiteSpace: 'nowrap' }}>
                  <strong>实际开始: </strong>
                  {operation.actual_start_date
                    ? (() => {
                        const d = new Date(operation.actual_start_date)
                        return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
                      })()
                    : '-'}
                </div>
              </div>
            </div>
          </div>

          {/* 底部：派工红底、进行中浅红底红字（参考图） */}
          <div
            style={{
              display: 'flex',
              borderTop: `1px solid ${token.colorBorderSecondary}`,
              flexShrink: 0,
            }}
          >
            <div
              onClick={() => operation.status !== 'completed' && handleOpenDispatchModal(operation, workOrder)}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px 4px',
                fontSize: 13,
                fontWeight: 500,
                color: operation.status !== 'completed' ? '#fff' : token.colorTextDisabled,
                backgroundColor: operation.status !== 'completed' ? '#ff4d4f' : token.colorFillTertiary,
                cursor: operation.status !== 'completed' ? 'pointer' : 'default',
                borderRight: `1px solid ${token.colorBorderSecondary}`,
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={(e) => {
                if (operation.status !== 'completed') {
                  e.currentTarget.style.opacity = '0.9'
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1'
              }}
            >
              <TeamOutlined style={{ marginRight: 4, fontSize: 13 }} />
              派工
            </div>
            <div
              onClick={
                operation.status === 'pending'
                  ? async () => {
                      try {
                        if (executionConfig?.require_confirmed_picking_before_operation_start) {
                          const pickingStatus = await workOrderApi.getPickingConfirmationStatus(workOrder.id!.toString())
                          if (!pickingStatus?.has_confirmed_picking) {
                            messageApi.warning('当前配置要求先确认领料，未确认时不可开工')
                            return
                          }
                        }
                        await workOrderApi.startOperation(workOrder.id!.toString(), operation.id)
                        messageApi.success('工序已开始')
                        const operations = await workOrderApi.getOperations(workOrder.id!.toString())
                        setExpandedOperationsMap(prev => ({
                          ...prev,
                          [workOrder.id!]: operations || [],
                        }))
                        queryClient.invalidateQueries({ queryKey: [WORK_ORDER_ROW_EXPAND_QK, workOrder.id] })
                        invalidateStatistics(); actionRef.current?.reload()
                      } catch (error: any) {
                        messageApi.error(error.message || '开始工序失败')
                      }
                    }
                  : undefined
              }
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px 4px',
                fontSize: 13,
                fontWeight: 500,
                color:
                  operation.status === 'pending'
                    ? '#fff'
                    : operation.status === 'in_progress'
                      ? '#ff4d4f'
                      : operation.status === 'completed'
                        ? token.colorSuccess
                        : token.colorText,
                backgroundColor:
                  operation.status === 'pending'
                    ? '#ff4d4f'
                    : operation.status === 'in_progress'
                      ? '#fff1f0'
                      : operation.status === 'completed'
                        ? token.colorSuccessBg
                        : 'transparent',
                cursor: operation.status === 'pending' ? 'pointer' : 'default',
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={(e) => {
                if (operation.status === 'pending') {
                  e.currentTarget.style.opacity = '0.9'
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1'
              }}
            >
              {operation.status === 'pending' && <PlayCircleOutlined style={{ marginRight: 4, fontSize: 13 }} />}
              {operation.status === 'pending' ? '开始' : operation.status === 'in_progress' ? '进行中' : '已完成'}
            </div>
          </div>
        </div>
        {/* 箭头连接（不是最后一个） */}
        {index < total - 1 && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              marginLeft: 0,
              marginRight: 0,
              alignSelf: 'center',
            }}
          >
            <RightOutlined style={{ fontSize: 24, color: token.colorBorder }} />
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
      return <div style={{ padding: '20px', textAlign: 'center', color: token.colorTextTertiary }}>暂无工序信息</div>
    }

    const manufacturingMode = (expandedWorkOrderDetailMap[record.id!]?.manufacturing_mode || 'fabrication') as 'fabrication' | 'assembly'
    return (
      <div style={{ padding: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
          {operations.map((operation: any, index: number) =>
            renderOperationCard(operation, record, index, operations.length, manufacturingMode)
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

      // 加载工单工序列表
      try {
        const operations = await workOrderApi.getOperations(record.id!.toString())
        setWorkOrderOperations(operations)
      } catch (error) {
        console.error('获取工单工序列表失败:', error)
        setWorkOrderOperations([])
      }

      // 加载可用状态流转选项
      try {
        if (detail.status) {
          const transitions = await stateTransitionApi.getAvailableTransitions(
            'work_order',
            detail.status
          )
          setAvailableTransitions(transitions)
        }
      } catch (error) {
        console.error('获取状态流转信息失败:', error)
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
  const handleSyncConfirm = async (rows: Record<string, any>[]) => {
    try {
      let successCount = 0
      for (const row of rows) {
        const payload = {
          work_order_code: row.work_order_code || row.workOrderCode,
          plan_code: row.plan_code || row.planCode,
          material_code: row.material_code || row.materialCode,
          planned_quantity: row.planned_quantity ?? row.plannedQuantity,
          status: row.status || 'draft',
        }
        await workOrderApi.create(payload)
        successCount += 1
      }
      messageApi.success(`已同步 ${successCount} 条工单`)
      invalidateStatistics(); actionRef.current?.reload()
    } catch (error: any) {
      messageApi.error(error?.message || '同步失败')
    }
  }

  const handleListImport = async (data: any[][]) => {
    if (!data || data.length < 2) {
      messageApi.warning('导入数据为空或格式不正确')
      return
    }
    const headers = (data[0] || []).map((h: any) => String(h || '').trim())
    const rows = data.slice(2).filter((row: any[]) => row?.some((c: any) => c != null && String(c).trim() !== ''))

    if (rows.length === 0) {
      messageApi.warning('没有可导入的数据行（请从第3行开始填写）')
      return
    }

    const col = (name: string) => headers.findIndex((h: string) => (h || '').replace(/\*+/, '').trim() === name || (h || '').trim() === name)
    const idx = {
      code: col('工单编号') >= 0 ? col('工单编号') : col('编号'),
      product: col('产品编号') >= 0 ? col('产品编号') : col('物料编号'),
      qty: col('计划数量') >= 0 ? col('计划数量') : col('数量'),
      workshop: col('车间编号') >= 0 ? col('车间编号') : col('车间'),
    }

    if (idx.product < 0 || idx.qty < 0) {
      messageApi.error('缺少必需列：产品编号、计划数量')
      return
    }

    const [materials, workshops] = await Promise.all([
      materialApi.list({ limit: 5000, isActive: true }),
      workshopApi.list({ limit: 1000 }),
    ])

    const errors: Array<{ row: number; message: string }> = []
    const toImport: any[] = []

    rows.forEach((row: any[], i: number) => {
      const rowNum = i + 3
      const productCode = (row[idx.product] ?? '').toString().trim()
      const qtyVal = Number(row[idx.qty])
      if (!productCode) {
        errors.push({ row: rowNum, message: '产品编号不能为空' })
        return
      }
      if (isNaN(qtyVal) || qtyVal <= 0) {
        errors.push({ row: rowNum, message: '计划数量必须大于0' })
        return
      }

      const mat = materials.find((m: any) => (m.mainCode || m.code || '').toUpperCase() === productCode.toUpperCase())
      if (!mat) {
        errors.push({ row: rowNum, message: `未找到产品：${productCode}` })
        return
      }

      const woCode = idx.code >= 0 ? (row[idx.code] ?? '').toString().trim() : undefined
      const workshopCode = idx.workshop >= 0 ? (row[idx.workshop] ?? '').toString().trim() : undefined
      let workshopId: number | undefined
      if (workshopCode) {
        const ws = workshops.find((w: any) => (w.code || '').toUpperCase() === workshopCode.toUpperCase())
        workshopId = ws?.id
      }

      toImport.push({
        code: woCode || undefined,
        product_id: mat.id,
        product_code: mat.mainCode || mat.code,
        product_name: mat.name,
        quantity: qtyVal,
        production_mode: 'MTS',
        workshop_id: workshopId,
      })
    })

    if (errors.length > 0) {
      Modal.warning({
        title: '数据验证失败',
        width: 600,
        content: (
          <div>
            <p>以下行存在错误，请修正后重新导入：</p>
            <List size="small" dataSource={errors} renderItem={(item) => (
              <List.Item><Typography.Text type="danger">第 {item.row} 行：{item.message}</Typography.Text></List.Item>
            )} />
          </div>
        ),
      })
      return
    }

    if (toImport.length === 0) {
      messageApi.warning('没有可导入的数据')
      return
    }

    try {
      const result = await batchImport({
        items: toImport,
        importFn: async (item) => workOrderApi.create(item),
        title: '正在导入工单',
        concurrency: 3,
      })

      if (result.failureCount > 0) {
        Modal.warning({
          title: '导入完成（部分失败）',
          width: 600,
          content: (
            <div>
              <p><strong>导入结果：成功 {result.successCount} 条，失败 {result.failureCount} 条</strong></p>
              {result.errors.length > 0 && (
                <List size="small" dataSource={result.errors} renderItem={(e) => (
                  <List.Item><Typography.Text type="danger">第 {e.row} 行：{e.error}</Typography.Text></List.Item>
                )} />
              )}
            </div>
          ),
        })
      } else {
        messageApi.success(`成功导入 ${result.successCount} 条工单`)
      }
      if (result.successCount > 0) {
        invalidateStatistics()
        actionRef.current?.reload()
      }
    } catch (error: any) {
      messageApi.error(error?.message || '导入失败')
    }
  }

  const handleDelete = async (keys: React.Key[]) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除 ${keys.length} 个工单吗？`,
      onOk: async () => {
        try {
          // 批量删除
          await Promise.all(keys.map(key => workOrderApi.delete(key.toString())))
          messageApi.success('删除成功')
          invalidateStatistics(); actionRef.current?.reload()
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
      // 处理附件
      const formAttachments = values.attachments || [];
      values.attachments = formAttachments.map((f: any) => {
        if (f.response) {
          if (Array.isArray(f.response) && f.response.length > 0) {
            return { uid: f.response[0].uuid, name: f.response[0].original_name, status: 'done', url: getFileDownloadUrl(f.response[0].uuid) };
          }
          if (f.response.uuid) {
            return { uid: f.response.uuid, name: f.response.original_name, status: 'done', url: getFileDownloadUrl(f.response.uuid) };
          }
        }
        return { uid: f.uid, name: f.name, status: 'done', url: f.url };
      });

      // 物料来源验证（核心功能，新增）
      if (values.product_id && selectedMaterialSourceInfo) {
        if (selectedMaterialSourceInfo.canCreateWorkOrder === false) {
          messageApi.error('该物料来源类型不允许创建生产工单，请选择其他物料或使用相应的功能模块')
          throw new Error('物料来源类型不允许创建工单')
        }
      }

      // 工单编号由CodeField组件自动处理，无需额外逻辑

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
          const so = selectedOperations.find((o: any) => o.operation_id === opId)
          return {
            operation_id: opId,
            operation_code: operationDetail.code,
            operation_name: operationDetail.name,
            sequence: index + 1,
            reporting_type:
              so?.reporting_type ??
              operationDetail.reportingType ??
              (operationDetail as any).reporting_type ??
              'quantity',
            allow_jump: false,
            is_node_operation: so?.is_node_operation ?? false,
            over_report_mode:
              so?.over_report_mode ??
              (operationDetail as any).overReportMode ??
              (operationDetail as any).over_report_mode ??
              'none',
            over_report_value:
              Number(
                so?.over_report_value ??
                  (operationDetail as any).overReportValue ??
                  (operationDetail as any).over_report_value ??
                  0
              ) || 0,
          }
        })
      } else if (selectedOperations.length > 0) {
        // 使用从工艺路线加载或用户在工单上调整后的工序（含允许跳转、节点）
        values.operations = selectedOperations.map((op: any, i: number) => ({
          operation_id: op.operation_id,
          operation_code: op.operation_code,
          operation_name: op.operation_name,
          sequence: op.sequence ?? i + 1,
          reporting_type: op.reporting_type ?? 'quantity',
          allow_jump: false,
          is_node_operation: op.is_node_operation ?? false,
          over_report_mode: op.over_report_mode ?? 'none',
          over_report_value: Number(op.over_report_value ?? 0) || 0,
        }))
      } else {
        // 没有选择工序，删除该字段，让后端自动匹配
        delete values.operations
      }

      // 如果选择了产品，需要转换为产品编号和名称
      if (values.product_id && !isEdit) {
        const selectedProduct = productList.find(product => product.id === values.product_id)
        if (selectedProduct) {
          values.product_code = selectedProduct.mainCode || selectedProduct.code
          values.product_name = selectedProduct.name
        }
      }

      // 配置件：解析 variant_attributes（表单可能为 JSON 字符串）
      if (values.variant_attributes != null) {
        const va = values.variant_attributes
        if (typeof va === 'string') {
          try {
            values.variant_attributes = va.trim() ? JSON.parse(va) : undefined
          } catch {
            values.variant_attributes = undefined
          }
        }
        if (values.variant_attributes && Object.keys(values.variant_attributes).length === 0) {
          values.variant_attributes = undefined
        }
      }
      // 编辑时属性字段不展示，保留原有值
      if (isEdit && currentWorkOrder?.id && values.variant_attributes == null && (currentWorkOrder as any).variant_attributes != null) {
        values.variant_attributes = (currentWorkOrder as any).variant_attributes
      }

      if (isEdit && currentWorkOrder?.id) {
        await workOrderApi.update(currentWorkOrder.id.toString(), values)
        if (selectedOperations.length > 0) {
          const opsPayload = selectedOperations.map((op: any, i: number) => ({
            operation_id: op.operation_id,
            operation_code: op.operation_code,
            operation_name: op.operation_name,
            sequence: i + 1,
            workshop_id: op.workshop_id,
            workshop_name: op.workshop_name,
            work_center_id: op.work_center_id,
            work_center_name: op.work_center_name,
            planned_start_date: op.planned_start_date,
            planned_end_date: op.planned_end_date,
            standard_time: op.standard_time,
            setup_time: op.setup_time,
            remarks: op.remarks,
            reporting_type: op.reporting_type ?? 'quantity',
            allow_jump: false,
            is_node_operation: op.is_node_operation ?? false,
            over_report_mode: op.over_report_mode ?? 'none',
            over_report_value: Number(op.over_report_value ?? 0) || 0,
          }))
          try {
            await workOrderApi.updateOperations(currentWorkOrder.id.toString(), {
              operations: opsPayload,
            })
          } catch (e: any) {
            messageApi.warning(
              e?.message ||
                '工单主信息已保存，但工序清单同步失败（可能已有报工的工序不可改）'
            )
          }
        }
        messageApi.success('工单更新成功')
      } else {
        await workOrderApi.create(values)
        messageApi.success('工单创建成功！系统已自动匹配工艺路线并生成工序单')
      }
      setModalVisible(false)
      invalidateStatistics(); actionRef.current?.reload()
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
      title: '产品编号',
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
      render: (dom, record) => {
        const lifecycle = getWorkOrderLifecycle(record)
        const colorMap: Record<string, string> = {
          success: 'success',
          exception: 'error',
          active: 'processing',
          normal: 'default',
        }
        const color = colorMap[lifecycle.status || 'normal'] || 'default'
        const isOverdue =
          record.planned_end_date &&
          ['released', 'in_progress', '已下达', '执行中'].includes(record.status || '') &&
          dayjs(record.planned_end_date).isBefore(dayjs(), 'day')
        return (
          <Space>
            <Tag color={color}>{lifecycle.stageName || '-'}</Tag>
            {isOverdue && <Tag color="error">逾期</Tag>}
          </Space>
        )
      },
    },
    {
      title: '优先级',
      dataIndex: 'priority',
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

          // 检查3：齐套料检查（调用后端API）
          try {
            const materialCheck = await workOrderApi.checkShortage(String(wo.id));
            if (materialCheck && !materialCheck.available && materialCheck.missing_materials?.length) {
              const names = materialCheck.missing_materials.map((m: any) => `${m.material_code}(${m.material_name})`).join(', ');
              checks.warnings.push(`物料不齐套：${names}`);
            }
          } catch {
            // 忽略检查失败，不阻塞下达
          }

          // 检查4：交期风险评估（后端暂无独立API，由 detect-delay 在异常模块处理）
          if (wo.planned_end_date && wo.due_date) {
            const endDate = new Date(wo.planned_end_date);
            const dueDate = new Date(wo.due_date);
            if (endDate > dueDate) {
              const delayDays = Math.ceil((endDate.getTime() - dueDate.getTime()) / (24 * 3600 * 1000));
              checks.warnings.push(`交期风险：计划结束晚于交货期约${delayDays}天`);
            }
          }

          // 检查5：工作中心能力检查（后端待实现，暂跳过）

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
            invalidateStatistics(); actionRef.current?.reload()
          } catch (error: any) {
            messageApi.error(error.message || '批量下达失败')
          }
        },
      })
    } catch (error: any) {
      messageApi.error(error.message || '批量下达失败')
    }
  }

  /** 齐套自动下达 (Phase 2) */
  const handleSmartReleaseKitted = async () => {
    Modal.confirm({
      title: '齐套自动下达',
      content: '系统将自动扫描所有未下达的工单，并将其中 100% 齐套的工单批量下达。是否确认？',
      onOk: async () => {
        try {
          const res = await productionControlApi.releaseKitted([]);
          messageApi.success(`齐套下达成功：共下达 ${res.count} 个工单`);
          invalidateStatistics();
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '齐套下达失败');
        }
      },
    });
  };

  /** 紧急插单模拟 (Phase 4) */
  const handleUrgentOrderSimulation = async (values: any) => {
    setSimulationLoading(true);
    setSimulationParams(values);
    try {
      const res = await productionControlApi.simulateImpact({
        ...values,
        planned_start_date: values.planned_range[0].format('YYYY-MM-DD HH:mm:ss'),
        planned_end_date: values.planned_range[1].format('YYYY-MM-DD HH:mm:ss'),
      });
      setSimulationResult(res);
    } catch (error: any) {
      messageApi.error(error.message || '模拟分析失败');
    } finally {
      setSimulationLoading(false);
    }
  };

  /**
   * 处理下达工单
   */
  const handleRelease = async (record: WorkOrder) => {
    try {
      await workOrderApi.release(record.id!.toString())
      messageApi.success('工单下达成功')
      invalidateStatistics(); actionRef.current?.reload()
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
          invalidateStatistics(); actionRef.current?.reload()
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
          invalidateStatistics(); actionRef.current?.reload()
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
          invalidateStatistics(); actionRef.current?.reload()
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
      invalidateStatistics(); actionRef.current?.reload()
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
          invalidateStatistics(); actionRef.current?.reload()
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
      invalidateStatistics(); actionRef.current?.reload()
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
      invalidateStatistics(); actionRef.current?.reload()
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

      // 刷新工单详情
      const detail = await workOrderApi.get(workOrderDetail.id.toString())
      setWorkOrderDetail(detail)

      // 重新获取可用状态流转选项
      if (detail.status) {
        const transitions = await stateTransitionApi.getAvailableTransitions(
          'work_order',
          detail.status
        )
        setAvailableTransitions(transitions)
      }

      // 刷新列表
      invalidateStatistics(); actionRef.current?.reload()
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
      invalidateStatistics(); actionRef.current?.reload()
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
      messageApi.success(`工单合并成功，新工单编号：${result.merged_work_order.code}`)
      setMergeModalVisible(false)
      setSelectedRowKeys([])
      invalidateStatistics(); actionRef.current?.reload()
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
      invalidateStatistics(); actionRef.current?.reload()
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
    const lifecycle = getWorkOrderLifecycle(workOrder)
    const colorMap: Record<string, string> = {
      success: 'success',
      exception: 'error',
      active: 'processing',
      normal: 'default',
    }
    const statusColor = colorMap[lifecycle.status || 'normal'] || 'default'

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
            <Space>
              <Tag
                color={statusColor}
                style={{ fontSize: TOUCH_SCREEN_CONFIG.FONT_MIN_SIZE, padding: '8px 16px' }}
              >
                {lifecycle.stageName || '-'}
              </Tag>
              {workOrder.planned_end_date &&
                ['released', 'in_progress', '已下达', '执行中'].includes(workOrder.status || '') &&
                dayjs(workOrder.planned_end_date).isBefore(dayjs(), 'day') && (
                  <Tag color="error">逾期</Tag>
                )}
            </Space>
          </div>

          {/* 工单名称 */}
          {workOrder.name && (
            <div style={{ fontSize: TOUCH_SCREEN_CONFIG.FONT_MIN_SIZE, color: token.colorTextSecondary }}>
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

  /** 未完成工单状态集合（排除已完成、已取消） */
  const IN_PROGRESS_STATUSES = ['draft', 'released', 'in_progress', '草稿', '已下达', '执行中']

  /** 优先级映射（中文显示） */
  const PRIORITY_MAP: Record<string, { text: string; color: string }> = {
    low: { text: '低', color: 'default' },
    normal: { text: '正常', color: 'blue' },
    high: { text: '高', color: 'orange' },
    urgent: { text: '紧急', color: 'red' },
  }

  /**
   * 在制产品视图：以产品为维度树形展示未完成工单
   */
  const renderProductTree = (data: WorkOrder[]) => {
    const inProgress = data.filter((r) => r.status && IN_PROGRESS_STATUSES.includes(r.status))
    const byProduct = new Map<string, WorkOrder[]>()
    inProgress.forEach((wo) => {
      const key = String(wo.product_id ?? wo.product_code ?? wo.product_name ?? '未知')
      if (!byProduct.has(key)) byProduct.set(key, [])
      byProduct.get(key)!.push(wo)
    })
    const treeData = Array.from(byProduct.entries()).map(([key, orders]) => ({
      key: `product-${key}`,
      title: orders[0]?.product_name || orders[0]?.product_code || key,
      product_name: orders[0]?.product_name || orders[0]?.product_code || key,
      quantity: orders.reduce((s, o) => s + Number(o.quantity ?? 0), 0),
      orderCount: orders.length,
      isParent: true,
      children: orders.map((wo) => ({
        key: `wo-${wo.id}`,
        ...wo,
        title: wo.code,
        quantity: Number(wo.quantity ?? 0),
        isParent: false,
      })),
    }))
    const treeColumns = [
      {
        title: '产品/工单',
        dataIndex: 'title',
        key: 'title',
        width: 180,
        render: (_: any, record: any) =>
          record.isParent ? (
            <strong>{record.product_name}</strong>
          ) : (
            <a onClick={() => handleDetail(record)}>{record.code}</a>
          ),
      },
      {
        title: '工单名称',
        dataIndex: 'name',
        key: 'name',
        width: 160,
        ellipsis: true,
        render: (_: any, r: any) => (r.isParent ? `共 ${r.orderCount} 个工单` : (r.name || '-')),
      },
      {
        title: '数量',
        dataIndex: 'quantity',
        key: 'quantity',
        width: 100,
        align: 'right' as const,
        render: (_: any, record: any) => {
          const n = Number(record.quantity)
          return Number.isNaN(n) ? '-' : (n % 1 === 0 ? n : n.toFixed(2))
        },
      },
      {
        title: '生产模式',
        dataIndex: 'production_mode',
        key: 'production_mode',
        width: 100,
        render: (_: any, r: any) =>
          r.isParent ? null : (
            <Tag color={r.production_mode === 'MTO' ? 'blue' : 'default'}>
              {r.production_mode === 'MTO' ? '按订单生产' : '按库存生产'}
            </Tag>
          ),
      },
      {
        title: '销售订单',
        dataIndex: 'sales_order_code',
        key: 'sales_order_code',
        width: 130,
        render: (_: any, record: any) =>
          record.isParent ? null : (
            record.production_mode === 'MTO' ? <Tag color="blue">{record.sales_order_code || '-'}</Tag> : <span style={{ color: '#999' }}>无</span>
          ),
      },
      {
        title: '车间',
        dataIndex: 'workshop_name',
        key: 'workshop_name',
        width: 100,
        render: (_: any, r: any) => (r.isParent ? null : (r.workshop_name || '-')),
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: 140,
        render: (_: any, record: any) => {
          if (record.isParent) return null
          const lifecycle = getWorkOrderLifecycle(record)
          const colorMap: Record<string, string> = { success: 'success', exception: 'error', active: 'processing', normal: 'default' }
          const isOverdue =
            record.planned_end_date &&
            ['released', 'in_progress', '已下达', '执行中'].includes(record.status || '') &&
            dayjs(record.planned_end_date).isBefore(dayjs(), 'day')
          return (
            <Space size={4}>
              <Tag color={colorMap[lifecycle.status || 'normal'] || 'default'}>{lifecycle.stageName || '-'}</Tag>
              {isOverdue && <Tag color="error">逾期</Tag>}
              {record.is_frozen && <Tag color="warning">已冻结</Tag>}
            </Space>
          )
        },
      },
      {
        title: '优先级',
        dataIndex: 'priority',
        key: 'priority',
        width: 90,
        render: (_: any, record: any) => {
          if (record.isParent) return null
          const config = PRIORITY_MAP[record.priority || 'normal'] || { text: record.priority || '正常', color: 'blue' }
          return <Tag color={config.color}>{config.text}</Tag>
        },
      },
      {
        title: '计划开始',
        dataIndex: 'planned_start_date',
        key: 'planned_start_date',
        width: 110,
        render: (_: any, record: any) => (record.isParent ? null : (record.planned_start_date ? dayjs(record.planned_start_date).format('YYYY-MM-DD') : '-')),
      },
      {
        title: '计划结束',
        dataIndex: 'planned_end_date',
        key: 'planned_end_date',
        width: 110,
        render: (_: any, record: any) => (record.isParent ? null : (record.planned_end_date ? dayjs(record.planned_end_date).format('YYYY-MM-DD') : '-')),
      },
    ]
    if (treeData.length === 0) {
      return (
        <Empty
          description="暂无在制工单"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ marginTop: 60 }}
        />
      )
    }
    return (
      <Table
        columns={treeColumns}
        dataSource={treeData}
        pagination={false}
        size="small"
        defaultExpandAllRows
        rowKey="key"
        scroll={{ x: 'max-content' }}
      />
    )
  }

  /**
   * 在制订单视图：以销售订单为维度树形展示未完成工单
   */
  const renderOrderTree = (data: WorkOrder[]) => {
    const inProgress = data.filter((r) => r.status && IN_PROGRESS_STATUSES.includes(r.status))
    const byOrder = new Map<string, WorkOrder[]>()
    inProgress.forEach((wo) => {
      const key = wo.sales_order_code || (wo.sales_order_id != null ? String(wo.sales_order_id) : '_no_sales_')
      if (!byOrder.has(key)) byOrder.set(key, [])
      byOrder.get(key)!.push(wo)
    })
    const treeData = Array.from(byOrder.entries()).map(([key, orders]) => ({
      key: `order-${key}`,
      title: key === '_no_sales_' ? '无销售订单' : (orders[0]?.sales_order_name || orders[0]?.sales_order_code || key),
      sales_order_code: key === '_no_sales_' ? '' : (orders[0]?.sales_order_code ?? key),
      quantity: orders.reduce((s, o) => s + Number(o.quantity ?? 0), 0),
      orderCount: orders.length,
      isParent: true,
      children: orders.map((wo) => ({
        key: `wo-${wo.id}`,
        ...wo,
        title: wo.code,
        quantity: Number(wo.quantity ?? 0),
        isParent: false,
      })),
    }))
    const treeColumns = [
      {
        title: '销售订单/工单',
        dataIndex: 'title',
        key: 'title',
        width: 180,
        render: (_: any, record: any) =>
          record.isParent ? (
            <strong>{record.title}</strong>
          ) : (
            <a onClick={() => handleDetail(record)}>{record.code}</a>
          ),
      },
      {
        title: '工单名称',
        dataIndex: 'name',
        key: 'name',
        width: 160,
        ellipsis: true,
        render: (_: any, r: any) => (r.isParent ? `共 ${r.orderCount} 个工单` : (r.name || '-')),
      },
      {
        title: '产品',
        dataIndex: 'product_name',
        key: 'product_name',
        width: 150,
        render: (_: any, r: any) => (r.isParent ? null : (r.product_name || r.product_code || '-')),
      },
      {
        title: '数量',
        dataIndex: 'quantity',
        key: 'quantity',
        width: 100,
        align: 'right' as const,
        render: (_: any, record: any) => {
          const n = Number(record.quantity)
          return Number.isNaN(n) ? '-' : (n % 1 === 0 ? n : n.toFixed(2))
        },
      },
      {
        title: '生产模式',
        dataIndex: 'production_mode',
        key: 'production_mode',
        width: 100,
        render: (_: any, r: any) =>
          r.isParent ? null : (
            <Tag color={r.production_mode === 'MTO' ? 'blue' : 'default'}>
              {r.production_mode === 'MTO' ? '按订单生产' : '按库存生产'}
            </Tag>
          ),
      },
      {
        title: '车间',
        dataIndex: 'workshop_name',
        key: 'workshop_name',
        width: 100,
        render: (_: any, r: any) => (r.isParent ? null : (r.workshop_name || '-')),
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: 140,
        render: (_: any, record: any) => {
          if (record.isParent) return null
          const lifecycle = getWorkOrderLifecycle(record)
          const colorMap: Record<string, string> = { success: 'success', exception: 'error', active: 'processing', normal: 'default' }
          const isOverdue =
            record.planned_end_date &&
            ['released', 'in_progress', '已下达', '执行中'].includes(record.status || '') &&
            dayjs(record.planned_end_date).isBefore(dayjs(), 'day')
          return (
            <Space size={4}>
              <Tag color={colorMap[lifecycle.status || 'normal'] || 'default'}>{lifecycle.stageName || '-'}</Tag>
              {isOverdue && <Tag color="error">逾期</Tag>}
              {record.is_frozen && <Tag color="warning">已冻结</Tag>}
            </Space>
          )
        },
      },
      {
        title: '优先级',
        dataIndex: 'priority',
        key: 'priority',
        width: 90,
        render: (_: any, record: any) => {
          if (record.isParent) return null
          const config = PRIORITY_MAP[record.priority || 'normal'] || { text: record.priority || '正常', color: 'blue' }
          return <Tag color={config.color}>{config.text}</Tag>
        },
      },
      {
        title: '计划开始',
        dataIndex: 'planned_start_date',
        key: 'planned_start_date',
        width: 110,
        render: (_: any, record: any) => (record.isParent ? null : (record.planned_start_date ? dayjs(record.planned_start_date).format('YYYY-MM-DD') : '-')),
      },
      {
        title: '计划结束',
        dataIndex: 'planned_end_date',
        key: 'planned_end_date',
        width: 110,
        render: (_: any, record: any) => (record.isParent ? null : (record.planned_end_date ? dayjs(record.planned_end_date).format('YYYY-MM-DD') : '-')),
      },
    ]
    if (treeData.length === 0) {
      return (
        <Empty
          description="暂无在制工单"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ marginTop: 60 }}
        />
      )
    }
    return (
      <Table
        columns={treeColumns}
        dataSource={treeData}
        pagination={false}
        size="small"
        defaultExpandAllRows
        rowKey="key"
        scroll={{ x: 'max-content' }}
      />
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
      sorter: true,
      hideInSearch: false,
    },
    {
      title: '工单名称',
      dataIndex: 'name',
      width: 200,
      ellipsis: true,
      sorter: true,
      hideInSearch: false,
    },
    {
      title: '产品',
      dataIndex: 'product_name',
      width: 150,
      ellipsis: true,
      sorter: true,
      hideInSearch: false,
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      width: 100,
      align: 'right',
      sorter: true,
    },
    {
      title: '生产模式',
      dataIndex: 'production_mode',
      width: 100,
      valueEnum: {
        MTS: { text: '按库存生产', status: 'processing' },
        MTO: { text: '按订单生产', status: 'success' },
      },
      hideInSearch: false,
    },
    {
      title: '齐套率',
      dataIndex: 'readiness_rate',
      width: 120,
      valueType: 'digit',
      render: (_text, record) => {
        const rate = record.readiness_rate
        if (rate == null || Number.isNaN(Number(rate))) {
          return (
            <Typography.Text type="secondary" title="列表为加快加载未实时计算，可在工单详情或齐套分析中查看">
              —
            </Typography.Text>
          )
        }
        const p = Number(rate)
        return (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Progress
              percent={p}
              size="small"
              status={p === 100 ? 'success' : p > 0 ? 'active' : 'normal'}
              strokeColor={p === 100 ? '#52c41a' : p >= 80 ? '#faad14' : '#ff4d4f'}
            />
          </Space>
        );
      },
      fieldProps: {
        placeholder: '齐套率 (%)',
        min: 0,
        max: 100,
      },
      sorter: true,
      hideInSearch: false,
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
      width: 140,
      hideInSearch: false,
      valueType: 'select',
      valueEnum: {
        draft: { text: '草稿' },
        released: { text: '已下达' },
        in_progress: { text: '执行中' },
        completed: { text: '已完成' },
        cancelled: { text: '已取消' },
      },
      render: (_, record) => {
        const lifecycle = getWorkOrderLifecycle(record)
        const colorMap: Record<string, string> = {
          success: 'success',
          exception: 'error',
          active: 'processing',
          normal: 'default',
        }
        const color = colorMap[lifecycle.status || 'normal'] || 'default'
        const isOverdue =
          record.planned_end_date &&
          ['released', 'in_progress', '已下达', '执行中'].includes(record.status || '') &&
          dayjs(record.planned_end_date).isBefore(dayjs(), 'day')
        return (
          <Space>
            <Tag color={color}>{lifecycle.stageName || '-'}</Tag>
            {isOverdue && <Tag color="error">逾期</Tag>}
            {record.is_frozen && <Tag color="warning">已冻结</Tag>}
          </Space>
        )
      },
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 100,
      sorter: true,
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
      sorter: true,
      hideInSearch: true,
    },
    {
      title: '计划开始',
      dataIndex: 'planned_start_date',
      valueType: 'dateRange',
      width: 160,
      hideInTable: true,
      hideInSearch: false,
      fieldProps: { placeholder: ['开始日期', '结束日期'], style: { width: '100%' } },
    },
    {
      title: '计划结束时间',
      dataIndex: 'planned_end_date',
      valueType: 'dateTime',
      width: 160,
      sorter: true,
      hideInSearch: true,
    },
    {
      title: '计划结束',
      dataIndex: 'planned_end_date',
      valueType: 'dateRange',
      width: 160,
      hideInTable: true,
      hideInSearch: false,
      fieldProps: { placeholder: ['开始日期', '结束日期'], style: { width: '100%' } },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      valueType: 'dateTime',
      width: 160,
      sorter: true,
    },
    {
      title: '操作',
      width: 200,
      fixed: 'right',
      render: (_, record) => {
        const canDelete = ['draft', '草稿'].includes(record.status || '') ||
          (['released', '已下达'].includes(record.status || '') &&
            !record.actual_start_date &&
            !Number(record.completed_quantity))
        const canRevoke = (record.status === '已下达' || record.status === 'released') ||
          ((record.status === '已完成' || record.status === 'completed') && record.manually_completed)
        const canComplete = record.status !== '已完成' &&
          record.status !== 'completed' &&
          record.status !== '已取消' &&
          record.status !== 'cancelled'
        const moreItems = [
          { key: 'print', label: '打印', icon: <PrinterOutlined />, onClick: () => handlePrint(record) },
          ...(canComplete ? [{ key: 'complete', label: '指定结束', icon: <StopOutlined />, onClick: () => handleComplete(record) }] : []),
        ]
        return (
          <Space>
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleDetail(record)}>详情</Button>
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
            {canDelete && (
              <Popconfirm
                title="确定要删除吗？"
                description="删除后无法恢复"
                onConfirm={async () => {
                  try {
                    await workOrderApi.delete(record.id!.toString())
                    messageApi.success('删除成功')
                    invalidateStatistics(); actionRef.current?.reload()
                  } catch (error: any) {
                    messageApi.error(error.message || '删除失败')
                  }
                }}
              >
                <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
              </Popconfirm>
            )}
            {record.status === 'draft' && (
              <Button type="link" size="small" onClick={() => handleRelease(record)}>下达</Button>
            )}
            {canRevoke && (
              <Button type="link" size="small" danger onClick={() => handleRevoke(record)}>撤回</Button>
            )}
            {moreItems.length > 0 && (
              <Dropdown
                menu={{ items: moreItems }}
                trigger={['click']}
              >
                <Button type="link" size="small" icon={<MoreOutlined />}>更多</Button>
              </Dropdown>
            )}
          </Space>
        )
      },
    },
  ]

  /** 较昨日对比：显示 +x / -x 格式 */
  const renderDOD = (today?: number, yesterday?: number) => {
    if (today === undefined || yesterday === undefined) return null;
    const diff = today - yesterday;
    const color = diff > 0 ? '#cf1322' : diff < 0 ? '#3f8600' : 'rgba(0, 0, 0, 0.45)';
    const text = diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : '0';
    return (
      <span style={{ marginLeft: 8, fontSize: 13, color }}>
        <span style={{ color: 'rgba(0,0,0,0.45)' }}>{t('app.kuaizhizao.workOrder.statVsYesterday')}</span>{' '}
        {text}
      </span>
    );
  };

  /** 折线图渲染（参考操作日志样式：Area 面积图 + 渐变填充） */
  const renderTrendChart = (data: { date: string; value: number }[] = [], color: string) => {
    if (!data || data.length === 0) return null
    const areaProps = {
      data,
      xField: 'date' as const,
      yField: 'value' as const,
      padding: 0,
      axis: false,
      colorField: () => color,
      shapeField: 'smooth' as const,
      style: {
        fill: `linear-gradient(-90deg, transparent 0%, ${color} 100%)`,
        fillOpacity: 0.2,
        stroke: color,
        lineWidth: 2,
      },
      autoFit: true,
    } satisfies ComponentProps<typeof LazyStatTrendArea>
    return (
      <Suspense fallback={null}>
        <LazyStatTrendArea {...areaProps} />
      </Suspense>
    )
  }

  const statCards: StatCard[] = hasPageMetricConfig
    ? pageMetricCards
    : statistics
    ? [
        {
          title: t('app.kuaizhizao.workOrder.statOverdue'),
          value: statistics.overdue_count ?? 0,
          description:
            statistics.overdue_count !== undefined &&
            statistics.yesterday_overdue_count !== undefined ? (
              <div>
                {t('app.kuaizhizao.workOrder.statTodayPrefix')}: {statistics.overdue_count}{' '}
                {renderDOD(statistics.overdue_count, statistics.yesterday_overdue_count)}
              </div>
            ) : undefined,
          valueStyle: { color: '#ff4d4f' },
          backgroundChart: renderTrendChart(statistics.trend_overdue ?? [], '#ff4d4f'),
          onClick:
            (statistics.overdue_count ?? 0) > 0
              ? () => {
                  tableSearchFormRef.current?.setFieldsValue?.({ status: 'in_progress' });
                  actionRef.current?.reload?.();
                }
              : undefined,
        },
        {
          title: t('app.kuaizhizao.workOrder.statCompletedToday'),
          value: statistics.completed_today_count ?? 0,
          description:
            statistics.completed_today_count !== undefined &&
            statistics.yesterday_completed_count !== undefined ? (
              <div>
                {t('app.kuaizhizao.workOrder.statTodayPrefix')}: {statistics.completed_today_count}{' '}
                {renderDOD(statistics.completed_today_count, statistics.yesterday_completed_count)}
              </div>
            ) : undefined,
          valueStyle: { color: token.colorPrimary },
          backgroundChart: renderTrendChart(statistics.trend_completed ?? [], token.colorPrimary),
          onClick:
            (statistics.completed_today_count ?? 0) > 0
              ? () => {
                  tableSearchFormRef.current?.setFieldsValue?.({ status: 'completed' });
                  actionRef.current?.reload?.();
                }
              : undefined,
        },
        {
          title: t('app.kuaizhizao.workOrder.statTotalWip'),
          value: statistics.total_wip ?? 0,
          description:
            statistics.total_wip !== undefined && statistics.yesterday_wip !== undefined ? (
              <div>
                {t('app.kuaizhizao.workOrder.statTodayPrefix')}: {statistics.total_wip}{' '}
                {renderDOD(statistics.total_wip, statistics.yesterday_wip)}
              </div>
            ) : undefined,
          valueStyle: { color: '#2f54eb' },
          backgroundChart: renderTrendChart(statistics.trend_wip ?? [], '#2f54eb'),
          onClick:
            (statistics.total_wip ?? 0) > 0
              ? () => {
                  tableSearchFormRef.current?.setFieldsValue?.({ status: 'in_progress' });
                  actionRef.current?.reload?.();
                }
              : undefined,
        },
        {
          title: t('app.kuaizhizao.workOrder.statQualifiedOutputToday'),
          value: statistics.qualified_output_today ?? 0,
          description:
            statistics.qualified_output_today !== undefined &&
            statistics.yesterday_qualified_output !== undefined ? (
              <div>
                {t('app.kuaizhizao.workOrder.statTodayPrefix')}: {statistics.qualified_output_today}{' '}
                {renderDOD(statistics.qualified_output_today, statistics.yesterday_qualified_output)}
              </div>
            ) : undefined,
          valueStyle: { color: '#52c41a' },
          backgroundChart: renderTrendChart(statistics.trend_output ?? [], '#52c41a'),
        },
        {
          title: t('app.kuaizhizao.workOrder.statPendingRelease'),
          value: statistics.draft_count ?? 0,
          description:
            statistics.draft_count !== undefined &&
            statistics.yesterday_draft_count !== undefined ? (
              <div>
                {t('app.kuaizhizao.workOrder.statTodayPrefix')}: {statistics.draft_count}{' '}
                {renderDOD(statistics.draft_count, statistics.yesterday_draft_count)}
              </div>
            ) : undefined,
          valueStyle: { color: '#fa8c16' },
          backgroundChart: renderTrendChart(statistics.trend_draft ?? [], '#fa8c16'),
          onClick:
            (statistics.draft_count ?? 0) > 0
              ? () => {
                  tableSearchFormRef.current?.setFieldsValue?.({ status: 'draft' });
                  actionRef.current?.reload?.();
                }
              : undefined,
        },
      ]
    : [
        {
          title: t('app.kuaizhizao.workOrder.statOverdue'),
          value: 0,
          valueStyle: { color: '#ff4d4f' },
        },
        {
          title: t('app.kuaizhizao.workOrder.statCompletedToday'),
          value: 0,
          valueStyle: { color: token.colorPrimary },
        },
        {
          title: t('app.kuaizhizao.workOrder.statTotalWip'),
          value: 0,
          valueStyle: { color: '#2f54eb' },
        },
        {
          title: t('app.kuaizhizao.workOrder.statQualifiedOutputToday'),
          value: 0,
          valueStyle: { color: '#52c41a' },
        },
        {
          title: t('app.kuaizhizao.workOrder.statPendingRelease'),
          value: 0,
          valueStyle: { color: '#fa8c16' },
        },
      ]

  return (
    <>
      <ListPageTemplate statCards={statCards}>
        <UniTable<WorkOrder>
          headerTitle="工单管理"
          formRef={tableSearchFormRef}
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          tanstackQuery={{
            queryKeyPrefix: ['kuaizhizao', 'work-orders', 'list'],
            staleTime: WORK_ORDER_LIST_STALE_MS,
            gcTime: 15 * 60 * 1000,
            prefetchNextPage: true,
            staleWhileRevalidate: true,
          }}
          request={handleWorkOrderTableRequest}
          showCreateButton
          createButtonText="新建工单"
          onCreate={handleCreate}
          enableRowSelection
          onRowSelectionChange={setSelectedRowKeys}
          showDeleteButton
          showImportButton={true}
          onImport={handleListImport}
          importHeaders={['工单编号', '*产品编号', '*计划数量', '车间编号']}
          importExampleRow={['WO001', 'PROD-A001', '100', 'WS001']}
          importFieldMap={{
            '工单编号': 'code',
            '产品编号': 'product_code',
            '*产品编号': 'product_code',
            '计划数量': 'quantity',
            '*计划数量': 'quantity',
            '车间编号': 'workshop_code',
          }}
          importFieldRules={{
            product_code: { required: true },
            quantity: { required: true },
          }}
          showExportButton
          onExport={async (type, keys, pageData) => {
            try {
              const response = await workOrderApi.list({ skip: 0, limit: 10000, include_readiness: true })
              let items = Array.isArray(response) ? response : (response as any)?.data || (response as any)?.items || []
              if (type === 'currentPage' && pageData?.length) {
                items = pageData
              } else if (type === 'selected' && keys?.length) {
                items = items.filter((d: WorkOrder) => d.id != null && keys.includes(d.id))
              }
              if (items.length === 0) {
                messageApi.warning('暂无数据可导出')
                return
              }
              const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `work-orders-${new Date().toISOString().slice(0, 10)}.json`
              a.click()
              URL.revokeObjectURL(url)
              messageApi.success(`已导出 ${items.length} 条记录`)
            } catch (error: any) {
              messageApi.error(error?.message || '导出失败')
            }
          }}
          showSyncButton
          onSync={() => setSyncModalVisible(true)}
          expandable={{
            expandedRowKeys,
            onExpandedRowsChange: keys => setExpandedRowKeys([...keys]),
            onExpand: handleExpand,
            expandedRowRender: renderExpandedRow,
            expandRowByClick: true, // 支持双击行展开
          }}
          toolBarRender={() => {
            const hasSelected = selectedRowKeys.length > 0;
            const hasMultipleSelected = selectedRowKeys.length >= 2;

            const moreBatchMenuItems = useMemo<MenuProps['items']>(() => [
              {
                key: 'batch-qrcode',
                icon: <QrcodeOutlined />,
                label: '批量生成二维码',
                onClick: handleBatchGenerateQRCode,
              },
              {
                key: 'batchPriority',
                label: '批量设置优先级',
                onClick: handleBatchSetPriority,
              },
              {
                key: 'batchFreeze',
                label: '批量冻结',
                onClick: handleBatchFreeze,
              },
              {
                key: 'batchCancel',
                label: '批量取消',
                danger: true,
                onClick: handleBatchCancel,
              },
            ], [selectedRowKeys]);

            return [
              <Button
                key="urgent-simulate"
                icon={<PlusOutlined />}
                danger
                type="primary"
                onClick={() => setUrgentSimulationVisible(true)}
              >
                紧急插单模拟
              </Button>,
              <Button
                key="smartRelease"
                style={{ backgroundColor: '#52c41a', color: '#fff', borderColor: '#52c41a' }}
                icon={<PlayCircleOutlined />}
                onClick={handleSmartReleaseKitted}
              >
                齐套自动下达
              </Button>,
              // 批量操作区：仅在有选中时显示
              hasSelected && (
                <Button
                  key="batchRelease"
                  type="primary"
                  onClick={handleBatchRelease}
                >
                  批量下达
                </Button>
              ),
              hasMultipleSelected && (
                <Button key="merge" onClick={handleMerge}>
                  合并工单
                </Button>
              ),
              hasSelected && (
                <Dropdown 
                  key="more-batch" 
                  menu={{ items: moreBatchMenuItems }} 
                  trigger={['click']}
                  placement="bottomLeft"
                >
                  <Button icon={<MoreOutlined />}>
                    更多批量操作
                  </Button>
                </Dropdown>
              ),
            ].filter(Boolean) as React.ReactNode[];
          }}
          onDelete={handleDelete}
          viewTypes={['table', 'productTree', 'orderTree', 'help']}
          customViews={[
            { key: 'productTree', label: '在制产品', icon: ShoppingOutlined, render: renderProductTree },
            { key: 'orderTree', label: '在制订单', icon: FileTextOutlined, render: renderOrderTree },
          ]}
          touchViewConfig={{
            renderCard: renderTouchCard,
            columns: 1,
          }}
        />
      </ListPageTemplate>

      {/* 打印工单 Modal - 懒加载 */}
      {printModalVisible && (
        <Suspense fallback={<Spin spinning />}>
          <WorkOrderPrintModal
            visible={printModalVisible}
            onCancel={() => {
              setPrintModalVisible(false)
              setCurrentWorkOrderForPrint(null)
            }}
            workOrderData={currentWorkOrderForPrint}
            workOrderId={currentWorkOrderForPrint?.id}
          />
        </Suspense>
      )}

      {/* 创建/编辑工单 Modal — 智能建议面板懒加载，避免拖慢列表首屏 */}
      {modalVisible && !!selectedMaterialSourceInfo && (
        <Suspense fallback={null}>
          <LazySmartSuggestionFloatPanel
            visible
            suggestion={null}
            messages={(() => {
              const msgs: Array<{ text: string; title?: string }> = []
              msgs.push({
                title: '物料来源',
                text: selectedMaterialSourceInfo!.sourceTypeName || '未配置',
              })
              if (selectedMaterialSourceInfo!.validationErrors?.length) {
                msgs.push({
                  title: '配置建议',
                  text: selectedMaterialSourceInfo!.validationErrors
                    .map((e, i) => `${i + 1}. ${e}`)
                    .join('\n'),
                })
              }
              if (selectedMaterialSourceInfo!.canCreateWorkOrder === false) {
                msgs.push({
                  title: '提醒',
                  text: '该物料不允许创建生产工单，请选择其他物料',
                })
              }
              return msgs
            })()}
            anchorSelector="[data-smart-suggestion-anchor='work-order-form']"
          />
        </Suspense>
      )}
      <FormModalTemplate
        title={isEdit ? '编辑工单' : '新建工单'}
        open={modalVisible}
        loading={modalDataLoading}
        onClose={() => {
          setModalVisible(false)
          setCurrentWorkOrder(null)
          setSelectedMaterialSourceInfo(null)
          setProductSourceData(null)
          setSelectedOperations([])
          formRef.current?.resetFields()
        }}
        onFinish={handleSubmit}
        isEdit={isEdit}
        width={MODAL_CONFIG.LARGE_WIDTH}
        formRef={formRef}
        grid
        modalRender={modal => <div data-smart-suggestion-anchor="work-order-form" style={{ overflow: 'hidden' }}>{modal}</div>}
      >
        <CodeField
          pageCode="kuaizhizao-production-work-order"
          name="code"
          label="工单编号"
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
        <Col span={10}>
          <Suspense fallback={<Spin style={{ margin: '12px 0' }} />}>
            <LazyUniMaterialSelect
              name="product_id"
              label="产品"
              placeholder="请选择产品"
              required
              disabled={isEdit}
              fallbackOption={
                isEdit && currentWorkOrder?.product_id
                  ? {
                      value: currentWorkOrder.product_id,
                      label:
                        `${currentWorkOrder.product_code || ''} - ${currentWorkOrder.product_name || ''}`.trim() ||
                        String(currentWorkOrder.product_id),
                    }
                  : undefined
              }
              onChange={async (value, material) => {
                if (value) {
                  if (material) {
                    try {
                      const materialDetail = await materialApi.get(material.uuid)
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
                      else if (sourceType === 'Outsource')
                        validationErrors.push('委外件需配置委外供应商和工序')
                      else if (sourceType === 'Configure') validationErrors.push('配置件需填写属性')
                      setSelectedMaterialSourceInfo({
                        sourceType,
                        sourceTypeName: sourceType ? sourceTypeNames[sourceType] || sourceType : undefined,
                        validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
                        canCreateWorkOrder,
                      })
                      loadProcessRouteForMaterial(material.uuid)
                    } catch (error) {
                      console.error('获取物料详情失败:', error)
                      setSelectedMaterialSourceInfo(null)
                    }
                  } else setSelectedMaterialSourceInfo(null)
                } else setSelectedMaterialSourceInfo(null)
              }}
            />
          </Suspense>
        </Col>
        {selectedMaterialSourceInfo?.sourceType === 'Configure' && !isEdit && (
          <ProFormText
            name="variant_attributes"
            label="属性"
            placeholder='配置件必填，如 {"color":"red","size":"M"}'
            rules={[
              { required: true, message: '配置件必须填写属性' },
              {
                validator: (_, value) => {
                  if (!value) return Promise.resolve()
                  try {
                    const parsed = typeof value === 'string' ? JSON.parse(value) : value
                    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
                      return Promise.reject(new Error('请输入有效的 JSON 对象，如 {"color":"red","size":"M"}'))
                    }
                    return Promise.resolve()
                  } catch {
                    return Promise.reject(new Error('请输入有效的 JSON 格式'))
                  }
                },
              },
            ]}
            colProps={{ span: 12 }}
          />
        )}
        <ProFormGroup colProps={{ span: 14 }} style={{ marginBottom: 0 }}>
          <Form.Item label=" " colon={false} style={{ marginBottom: 0 }}>
            <Space size="middle" wrap={false} style={{ flexWrap: 'nowrap' }}>
              <ThemedSegmented
                value={onlyShowMake ? 'make' : 'all'}
                onChange={(v) => setOnlyShowMake(v === 'make')}
                options={[
                  { label: '全部', value: 'all' },
                  { label: '自制件', value: 'make' },
                ]}
              />
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

        <ProForm.Item name="process_route_id" label="工艺路线" colProps={{ span: 24 }}>
          <UniDropdown
            placeholder="选择后自动加载工序"
            options={processRouteList.map(route => ({
              label: `${route.code} - ${route.name}`,
              value: route.id,
            }))}
            disabled={isEdit && String(currentWorkOrder?.status || '') !== 'draft'}
            showSearch
            allowClear
            advancedSearch={{
              label: '高级搜索',
              fields: [
                { name: 'code', label: '工艺路线编号' },
                { name: 'name', label: '工艺路线名称' },
              ],
              onSearch: async (values) => {
                try {
                  const res = await processRouteApi.list({ ...values, limit: 100 });
                  const list = Array.isArray(res) ? res : (res as any)?.data || [];
                  return list.map((r: any) => ({
                    value: r.id,
                    label: `${r.code ?? ''} - ${r.name ?? ''}`.trim() || String(r.id),
                  }));
                } catch {
                  return [];
                }
              },
            }}
            onChange={async (value) => {
              if (value) {
                try {
                  const route = processRouteList.find(r => r.id === value)
                  if (!route || !route.uuid) {
                    messageApi.warning('未找到工艺路线信息')
                    return
                  }
                  const routeDetail = await processRouteApi.get(route.uuid)
                  const routeJump =
                    (routeDetail as any)?.allow_operation_jump ??
                    (routeDetail as any)?.allowOperationJump ??
                    false
                  formRef.current?.setFieldsValue({ allow_operation_jump: routeJump })
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
                  formRef.current?.setFieldsValue({ operations: undefined })
                }
              } else {
                setSelectedOperations([])
                formRef.current?.setFieldsValue({
                  operations: undefined,
                  allow_operation_jump: false,
                })
              }
            }}
          />
        </ProForm.Item>
        <Form.Item name="operations" hidden />
        <Form.Item
          label="工艺路线工序清单"
          colon
          style={{
            gridColumn: '1 / -1',
            marginBottom: 24,
            width: '100%',
            minWidth: 0,
            paddingLeft: 8,
            paddingRight: 8,
          }}
        >
          <div style={{ width: '100%', minWidth: 0, overflow: 'hidden', boxSizing: 'border-box' }}>
            <Suspense
              fallback={
                <div style={{ padding: 24, textAlign: 'center' }}>
                  <Spin />
                </div>
              }
            >
              <LazyCreateWorkOrderOperationsList
                selectedOperations={selectedOperations}
                setSelectedOperations={setSelectedOperations}
                operationList={operationList}
                formRef={formRef}
                disabled={
                  isEdit && ['completed', 'cancelled'].includes(String(currentWorkOrder?.status || ''))
                }
              />
            </Suspense>
          </div>
        </Form.Item>

        <ProFormSwitch
          name="allow_operation_jump"
          label="允许跳转工序"
          extra="默认随所选工艺路线；可再修改。关闭时须按序报工且下道数量不超过上道；开启时路线中的节点工序仍不可跳过。"
          initialValue={false}
          colProps={{ span: 24 }}
        />
        <ProFormSelect
          name="over_report_mode"
          label="工单默认超报"
          colProps={{ span: 12 }}
          options={[
            { label: t('field.operation.overReportModeNone'), value: 'none' },
            { label: t('field.operation.overReportModeFixed'), value: 'fixed' },
            { label: t('field.operation.overReportModePercent'), value: 'percent' },
          ]}
          initialValue="none"
        />
        <ProFormDigit
          name="over_report_value"
          label="超报数值"
          colProps={{ span: 12 }}
          min={0}
          fieldProps={{ precision: 4 }}
          extra="固定模式为额外件数；比例模式为百分数。工序行可单独覆盖。"
        />
        <ProFormUploadButton
          name="attachments"
          label="附件"
          max={10}
          colProps={{ span: 24 }}
          fieldProps={{
            multiple: true,
            customRequest: async (options) => {
              try {
                const res = await uploadMultipleFiles([options.file as File], { category: 'work_order_attachments' });
                if (options.onSuccess) {
                  options.onSuccess(res[0], options.file as any);
                }
              } catch (err) {
                if (options.onError) {
                  options.onError(err as any);
                }
              }
            }
          }}
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
        width={MODAL_CONFIG.LARGE_WIDTH}
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
                const itemsWithQty: { productId: number; quantity: number; variant_attributes?: Record<string, unknown> }[] = []
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
                  itemsWithQty.push({
                    productId: product.id,
                    quantity: Number(qty) || 0,
                    variant_attributes: it.variant_attributes ?? undefined,
                  })
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
                  { title: '订单编号', dataIndex: '_order_code', key: '_order_code', width: 140 },
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
                      title: '预测编号',
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
                        title: '需求编号',
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
        }}
        dataSource={workOrderDetail || undefined}
        columns={detailColumns}
        width="50%"
        styles={{ wrapper: { width: '50%' } }}
        extra={
          workOrderDetail && (
            <Space wrap>
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
              {['draft', 'released'].includes(workOrderDetail.status || '') && (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    setCurrentOperation(null)
                    setOperationsModalVisible(true)
                    operationFormRef.current?.resetFields()
                  }}
                >
                  添加工序
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
          )
        }
        customContent={
          drawerVisible && workOrderDetail ? (
            <Suspense fallback={<Spin style={{ margin: 48 }} />}>
              <>
                {/* 1. 单据详情（含二维码） */}
                <div
                  style={{
                    padding: '16px 0',
                    borderBottom: `1px solid ${token.colorBorder}`,
                    marginBottom: '16px',
                  }}
                >
                  <h4 style={{ marginBottom: 12 }}>单据详情</h4>
                  <Row gutter={16}>
                    <Col span={16}>
                      <ProDescriptions
                        dataSource={workOrderDetail}
                        column={2}
                        columns={detailColumns}
                      />
                    </Col>
                    <Col span={8}>
                      <LazyQRCodeGenerator
                        qrcodeType="WO"
                        data={{
                          work_order_uuid: workOrderDetail.id?.toString() || '',
                          work_order_code: workOrderDetail.code || '',
                          work_order_name: workOrderDetail.name || '',
                        }}
                        autoGenerate={true}
                        size={6}
                      />
                    </Col>
                  </Row>
                </div>

                {/* 2. 生命周期 */}
                {(() => {
                  const lifecycle = getWorkOrderLifecycle(workOrderDetail)
                  const mainStages = lifecycle.mainStages ?? []
                  if (mainStages.length === 0) return null
                  return (
                    <div
                      style={{
                        padding: '16px 0',
                        borderBottom: `1px solid ${token.colorBorder}`,
                        marginBottom: '16px',
                      }}
                    >
                      <h4 style={{ marginBottom: 12 }}>生命周期</h4>
                      <LazyUniLifecycleStepper
                        steps={mainStages}
                        status={lifecycle.status}
                        showLabels
                        nextStepSuggestions={lifecycle.nextStepSuggestions}
                      />
                    </div>
                  )
                })()}

                {/* 3. 单据明细（工单工序） */}
                <div
                  style={{
                    padding: '16px 0',
                    borderBottom: `1px solid ${token.colorBorder}`,
                    marginBottom: '16px',
                  }}
                >
                  <Card title="工单工序">
                    <LazyWorkOrderOperationsList
                      workOrderId={workOrderDetail?.id}
                      operations={workOrderOperations}
                      workOrderStatus={workOrderDetail?.status}
                      onUpdate={async () => {
                        if (workOrderDetail?.id) {
                          const ops = await workOrderApi.getOperations(workOrderDetail.id.toString())
                          setWorkOrderOperations(ops)
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

                {/* 4. 齐套性分析 */}
                <div
                  style={{
                    padding: '16px 0',
                    borderBottom: `1px solid ${token.colorBorder}`,
                    marginBottom: '16px',
                  }}
                >
                  <LazyWorkOrderKittingPanel workOrderId={workOrderDetail?.id} />
                </div>

                {/* 5. 操作记录 */}
                {workOrderDetail?.id ? (
                  <div
                    style={{
                      padding: '16px 0',
                      borderBottom: `1px solid ${token.colorBorder}`,
                      marginBottom: '16px',
                    }}
                  >
                    <h4 style={{ marginBottom: 12 }}>操作记录</h4>
                    <LazyDocumentTrackingPanel
                      documentType="work_order"
                      documentId={workOrderDetail.id}
                      onDocumentClick={(type, id) => messageApi.info(`跳转到${type}#${id}`)}
                    />
                  </div>
                ) : null}
              </>
            </Suspense>
          ) : null
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
        <ProFormText name="product_code" label="产品编号" disabled />
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
                    <strong>工单编号：</strong>
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
            <Card size="small" style={{ marginBottom: 16, backgroundColor: token.colorFillTertiary }}>
              <Row gutter={16}>
                <Col span={12}>
                  <div style={{ marginBottom: 4 }}>
                    <strong>工单编号：</strong>
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

            <ProFormSelect
              name="assigned_mold_id"
              label="分配模具"
              placeholder="请选择模具（可选）"
              options={moldList.map(item => ({
                label: `${item.code || ''} - ${item.name}`,
                value: item.id,
              }))}
              fieldProps={{
                showSearch: true,
                filterOption: (input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase()),
              }}
            />

            <ProFormSelect
              name="assigned_tool_id"
              label="分配工装"
              placeholder="请选择工装（可选）"
              options={toolList.map(item => ({
                label: `${item.code || ''} - ${item.name}`,
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
        width={MODAL_CONFIG.SMALL_WIDTH}
        okText="确认拆分"
        cancelText="取消"
      >
        {currentWorkOrderForSplit && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <div>
                <strong>原工单编号：</strong>
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
        <ProFormText name="operation_code" label="工序编号" disabled />
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
        width={MODAL_CONFIG.STANDARD_WIDTH}
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
                          <strong>工单编号：</strong>
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

      {/* 合并工单Modal */}
      <FormModalTemplate
        title="合并工单"
        open={mergeModalVisible}
        onClose={() => {
          setMergeModalVisible(false)
          mergeFormRef.current?.resetFields()
        }}
        onFinish={handleSubmitMerge}
        formRef={mergeFormRef}
        loading={mergeLoading}
        width={MODAL_CONFIG.STANDARD_WIDTH}
      >
        <div style={{ marginBottom: 16 }}>
          已选择 <strong>{selectedRowKeys.length}</strong> 个工单进行合并。
          <br />
          主工单将作为合并后的工单，其他工单将被取消。
        </div>
        <ProFormSelect
          name="main_work_order_id"
          label="选择主工单"
          placeholder="请选择一个工单作为主工单"
          rules={[{ required: true, message: '请选择主工单' }]}
          options={selectedRows.map((row: any) => ({
            label: `${row.code} - ${row.product_name}`,
            value: row.id,
          }))}
        />
        <ProFormTextArea
          name="remarks"
          label="合并备注"
          placeholder="请输入合并备注（可选）"
          fieldProps={{ rows: 3 }}
        />
      </FormModalTemplate>

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

      {/* 紧急插单模拟 Modal (Phase 4) */}
      <Modal
        title="紧急插单影响模拟"
        open={urgentSimulationVisible}
        onCancel={() => {
          setUrgentSimulationVisible(false);
          setSimulationResult(null);
        }}
        width={1000}
        footer={null}
        destroyOnClose
      >
        <Row gutter={24}>
          <Col span={10}>
            <Card title="插单基本信息" size="small">
              <ProForm
                onFinish={handleUrgentOrderSimulation}
                submitter={{
                  searchConfig: { submitText: '开始模拟分析' },
                  render: (_, dom) => <div style={{ marginTop: 16 }}>{dom}</div>,
                }}
              >
                <ProFormSelect
                  name="product_id"
                  label="选择产品"
                  required
                  request={async () => {
                    const res: any = await materialApi.list({ limit: 100 } as any);
                    const dataList = Array.isArray(res) ? res : res?.data || [];
                    return dataList.map((item: any) => ({
                      label: `[${item.code}] ${item.name}`,
                      value: item.id,
                    }));
                  }}
                />
                <ProFormDigit name="quantity" label="计划数量" initialValue={1} min={1} required />
                <ProFormDateRangePicker
                  name="planned_range"
                  label="计划起止日期"
                  required
                  fieldProps={{ showTime: true, style: { width: '100%' } }}
                />
                <ProFormSelect
                  name="priority"
                  label="优先级"
                  initialValue="urgent"
                  options={[
                    { label: '紧急', value: 'urgent' },
                    { label: '特急', value: 'critical' },
                  ]}
                />
              </ProForm>
            </Card>
          </Col>
          <Col span={14}>
            <Card title="模拟分析结果" size="small" loading={simulationLoading}>
              {!simulationResult ? (
                <Empty description="请在左侧填写信息并点击“开始模拟分析”" />
              ) : (
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div style={{ backgroundColor: '#f5f5f5', padding: 12, borderRadius: 4 }}>
                    <Typography.Title level={5}>建议：{simulationResult.recommendation}</Typography.Title>
                    <Space size="large">
                      <span>齐套率: <Typography.Text strong style={{ color: simulationResult.readiness_rate === 100 ? '#52c41a' : '#faad14' }}>{simulationResult.readiness_rate}%</Typography.Text></span>
                      <span>涉及产能: <Typography.Text strong>{simulationResult.resource_load_change?.length || 0} 个站点</Typography.Text></span>
                    </Space>
                  </div>

                  {simulationResult.shortage_items?.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <Typography.Text type="danger" strong>缺料明细：</Typography.Text>
                      <Table
                        size="small"
                        dataSource={simulationResult.shortage_items}
                        pagination={false}
                        columns={[
                          { title: '物料', dataIndex: 'material_name' },
                          { title: '短缺量', dataIndex: 'shortage_quantity' },
                        ]}
                      />
                    </div>
                  )}

                  {simulationResult.impacted_orders?.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <Typography.Text type="warning" strong>受影响的现有工单：</Typography.Text>
                      <Table
                        size="small"
                        dataSource={simulationResult.impacted_orders}
                        pagination={false}
                        columns={[
                          { title: '工单', dataIndex: 'work_order_code' },
                          { title: '冲突类型', dataIndex: 'impact_type', render: (t) => t === 'material_conflict' ? '物料抢占' : '资源排队' },
                          { title: '可能延期', dataIndex: 'delay_days', render: (d) => d > 0 ? `${d}天` : '未知' },
                        ]}
                      />
                    </div>
                  )}

                  <div style={{ marginTop: 24, textAlign: 'right' }}>
                    <Button onClick={() => setUrgentSimulationVisible(false)}>取消</Button>
                    <Button 
                      type="primary" 
                      danger 
                      style={{ marginLeft: 8 }}
                      onClick={() => {
                        setUrgentSimulationVisible(false);
                        // 预填逻辑：关闭模拟框，打开创建框
                        handleCreate();
                        
                        // 将模拟参数同步到创建工单表单中
                        setTimeout(() => {
                          if (formRef.current && simulationParams) {
                            formRef.current.setFieldsValue({
                              product_id: simulationParams.product_id,
                              quantity: simulationParams.quantity,
                              priority: simulationParams.priority,
                              planned_start_date: simulationParams.planned_range[0],
                              planned_end_date: simulationParams.planned_range[1],
                            });
                          }
                          messageApi.success('模拟数据已预填至创建表单');
                        }, 200);
                        messageApi.success('模拟结果与申请参数已载入工单表单，请进一步完善信息');
                      }}
                    >
                      确认并转正式工单
                    </Button>
                  </div>
                </Space>
              )}
            </Card>
          </Col>
        </Row>
      </Modal>
    </>
  )
}


export default WorkOrdersPage
