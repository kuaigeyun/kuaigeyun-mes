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

import React, { useRef, useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react'
import { DatePicker } from 'antd'
const { RangePicker } = DatePicker
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { buildKuaizhizaoPullCreateMenuItems, resolveKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry'
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
  ProFormDependency,
  ProFormItem,
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
  Input,
  Form,
  theme,
  Typography,
  Empty,
  Dropdown,
  List,
  Switch,
  Statistic,
  Alert,
  Tooltip,
} from 'antd'
import type { GlobalToken } from 'antd/es/theme/interface'
import {
  PlusOutlined,
  EditOutlined,
  EyeOutlined,
  RightOutlined,
  PlayCircleOutlined,
  QrcodeOutlined,
  DeleteOutlined,
  PrinterOutlined,
  StopOutlined,
  TeamOutlined,
  ShoppingOutlined,
  FileTextOutlined,
  CloseCircleOutlined,
  InboxOutlined,
  SendOutlined,
  RetweetOutlined,
  SplitCellsOutlined,
  DisconnectOutlined,
  GroupOutlined,
  FlagOutlined,
  LockOutlined,
  UnlockOutlined,
  DownOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons'
import { UniTable } from '../../../../../components/uni-table'
import { UniBatchButton, UniBatchMenuButton } from '../../../../../components/uni-batch'
import {
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn'
import { useUserPreferenceStore } from '../../../../../stores/userPreferenceStore'
import { useConfigStore } from '../../../../../stores/configStore'
import {
  fetchWorkOrderListForTable,
  prefetchDefaultWorkOrderList,
  resolveDissolvableWorkOrderGroupIdsFromRowKeys,
  resolveMergeableWorkOrderIdsFromRowKeys,
  resolveWorkOrderGroupIdFromListRow,
  resolveWorkOrderIdsFromListRowKeys,
  WORK_ORDER_LIST_STALE_MS,
} from './workOrderListTable'
import {
  collectDefaultExpandedWorkOrderTreeKeys,
  isBomTreeWorkOrderGroup,
  WORK_ORDER_GROUP_ROW_KIND,
} from './workOrderListGroupTree'
import { ThemedSegmented } from '../../../../../components/themed-segmented'
const SyncFromDatasetModal = lazy(() => import('../../../../../components/sync-from-dataset-modal'))
import {
  ListPageTemplate,
  FormModalTemplate,
  DetailDrawerTemplate,
  DetailDrawerSection,
  DetailDrawerInlineFullChain,
  MODAL_CONFIG,
  TOUCH_SCREEN_CONFIG,
  type StatCard,
} from '../../../../../components/layout-templates'
import { UniPullCreateToolbar } from '../../../../../components/uni-pull'
import { UniPullQueryModal, useUniPullQuery } from '../../../../../components/uni-pull-query'
import { buildUniPushMenuItems, UniPushToolbarButton } from '../../../../../components/uni-push'
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../components/document-tracking-panel'
import { WarehouseTraceBriefPrimaryActions } from '../../warehouse-management/WarehouseTraceBriefFooter'
import { useCustomFields } from '../../../../../hooks/useCustomFields'
import { useCustomFieldsForList } from '../../../../../hooks/useCustomFieldsForList'
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions'
import {
  workOrderBatchCancelAllowed,
  workOrderBatchFreezeAllowed,
  workOrderBatchPrintAllowed,
  workOrderBatchReleaseAllowed,
  workOrderBatchSetPriorityAllowed,
} from '../../../../../hooks/useDocumentCapabilities'

const WORK_ORDER_RESOURCE = 'kuaizhizao:work-order'
import {
  CustomFieldsFormSection,
  CustomFieldsDetailSection,
  hasCustomFieldsDetailContent,
} from '../../../../../components/custom-fields'

const WORK_ORDER_CUSTOM_FIELD_TABLE = 'apps_kuaizhizao_work_orders'
import { qrcodeApi } from '../../../../../services/qrcode'
import {
  workOrderApi,
  reworkOrderApi,
  outsourceOrderApi,
  getWorkOrderStatistics,
  productionControlApi,
  reportingApi,
  planningApi,
} from '../../../services/production'
import { UniDropdown } from '../../../../../components/uni-dropdown'
import { listSalesOrders } from '../../../services/sales'
import {
  getSalesOrder,
  listSalesOrders as listSalesOrdersForPull,
  pushSalesOrderToWorkOrder,
  type SalesOrder as PullSalesOrder,
} from '../../../services/sales-order'
import {
  listSalesForecasts,
  getSalesForecast,
  getSalesForecastItems,
} from '../../../services/sales-forecast'
import { listDemands, getDemand } from '../../../services/demand'
import { listDemandComputations, getPushOptions, generateOrdersFromComputation } from '../../../services/demand-computation'
import { operationApi, processRouteApi, unwrapProcessPagedList } from '../../../../master-data/services/process'
import { productProcessApi } from '../../../../master-data/services/productProcess'
import { supplierApi, unwrapSupplyPagedList } from '../../../../master-data/services/supply-chain'
import {
  workshopApi,
  workCenterApi,
  workGroupApi,
  workstationApi,
  factoryListItems,
} from '../../../../master-data/services/factory'
import type { Workshop } from '../../../../master-data/types/factory'
import { warehouseApi } from '../../../services/warehouse-execution'
import { materialApi } from '../../../../master-data/services/material'
import { OperationPickPanel } from '../../../../master-data/components/OperationSequenceEditor'
import { useNavigate, useLocation } from 'react-router-dom'
import { inboundProductionReturnEntryPath, inboundWorkOrderEntryPath } from '../../warehouse-management/inbound/inboundPaths'
import { outboundWorkOrderEntryPath } from '../../warehouse-management/outbound/outboundPaths'
import dayjs from 'dayjs'
import CodeField from '../../../../../components/code-field'
import { searchUserDisplay, type User } from '../../../../../services/user'
import { displayItemsToUsers } from '../../../../../utils/userDisplay'
import { getEquipmentList } from '../../../../../services/equipment'
import { getMoldList } from '../../../../../services/mold'
import { toolApi } from '../../../services/equipment'
import { useKuaizhizaoPrintModal } from '../../../hooks/useKuaizhizaoPrintModal'
/** 指标卡趋势图：首屏不拉 @ant-design/charts，减少工单页 JS 解析与主线程占用 */
const LazyStatTrendArea = lazy(() =>
  import('../../../../../components/common/StatCardTrendArea').then((m) => ({ default: m.StatCardTrendArea }))
)
const LazyCreateWorkOrderOperationsList = lazy(() => import('./components/WorkOrderCreateDndList'))
const LazyWorkOrderPeerGroupCreateDetail = lazy(
  () => import('./components/WorkOrderPeerGroupCreateDetail')
)
import { EMPTY_PEER_GROUP_ITEM } from './components/WorkOrderPeerGroupCreateDetail'
import { buildOperationsForCreatePayload } from './workOrderCreateOperations'
const LazyWorkOrderOperationsList = lazy(() => import('./components/WorkOrderDetailDndOperations'))
import { WorkOrderReadinessPopover } from './components/WorkOrderReadinessPopover'
import { WorkOrderOperationStepsStrip } from './components/WorkOrderOperationStepsStrip'
import WorkOrderTrackingFields from './components/WorkOrderTrackingFields'
import WorkOrderTrackingEditFields from './components/WorkOrderTrackingEditFields'
import WorkOrderCompleteTrackingModal, {
  type WorkOrderTrackingConfirmValues,
} from './components/WorkOrderCompleteTrackingModal'
import type { WorkOrderOperationStep } from './workOrderOperationSteps'
const LazyQRCodeGenerator = lazy(() =>
  import('../../../../../components/qrcode/QRCodeGenerator').then(m => ({ default: m.QRCodeGenerator }))
)
const LazyUniLifecycleStepper = lazy(() =>
  import('../../../../../components/uni-lifecycle').then(m => ({ default: m.UniLifecycleStepper }))
)
const LazyUniMaterialSelect = lazy(() => import('../../../../../components/uni-material-select'))
import { getWorkOrderLifecycle, buildWorkOrderLifecycleValueEnum, translateWorkOrderLifecycleStatus, LIST_LIFECYCLE_STAGE_FIELD, isWorkOrderPlannedEndOverdue } from '../../../utils/workOrderLifecycle'
import { commitListPageSearchParams } from '../../../../../utils/listLifecycleStage'
import { UniLifecycle } from '../../../../../components/uni-lifecycle'
import { getRemainingReportableQuantity } from '../../../utils/workOrderReporting'
import ReportableQuantityPanel from '../../../components/ReportableQuantityPanel'
import ReportingInboundWarehouseField from '../../../components/ReportingInboundWarehouseField'
import {
  isInboundWarehouseRequiredForLastOperation,
  resolveIsLastOperation,
  resolveLastInboundHint,
} from '../../../utils/reportingLastOperation'
import { coerceReportingCreateStrings } from '../../../utils/reportingPayload'
import { getUserInfo } from '../../../../../utils/auth'
import type { CurrentUser } from '../../../../../types/api'
import { hasModulePermission } from '../../../../../utils/permissionContract';
import { rowActionKind } from '../../../../../components/uni-action';
import { useGlobalStore } from '../../../../../stores'
import { UniUserSelect } from '../../../../../components/uni-user-select'

/** 列表行展开工序：TanStack 缓存键前缀（与派工/开工后 invalidate 一致） */
const WORK_ORDER_ROW_EXPAND_QK = 'workOrderRowExpand' as const
const WORK_ORDER_ROW_EXPAND_STALE_MS = 0
import { getFileDownloadUrl } from '../../../../../services/file'
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField'
import { batchImport } from '../../../../../utils/batchOperations'
import { buildFutureDateShortcutFieldProps } from '../../../../../utils/futureDatePickerShortcuts'
import {
  buildFactoryImportTemplate,
  resolveFactoryImportHeaderIndexMap,
} from '../../../../../utils/spreadsheetImportTemplate'
import { formatDateTime, formatDateTimeBySiteSetting } from '../../../../../utils/format'

const toApiDateTimeString = (value: any): string | undefined => {
  if (!value) return undefined
  if (typeof value?.format === 'function') {
    try {
      return value.format('YYYY-MM-DD HH:mm:ss')
    } catch {
      // fallback to dayjs parse below
    }
  }
  if (value instanceof Date) {
    const parsed = dayjs(value)
    return parsed.isValid() ? parsed.format('YYYY-MM-DD HH:mm:ss') : undefined
  }
  const parsed = dayjs(value)
  return parsed.isValid() ? parsed.format('YYYY-MM-DD HH:mm:ss') : undefined
}

const getFirstNonEmptyString = (...candidates: Array<unknown>): string | undefined => {
  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim()
      if (trimmed) return trimmed
    }
  }
  return undefined
}

const extractUploadedAttachmentMeta = (response: any): { uuid?: string; name?: string; url?: string } => {
  if (!response) return {}
  const payload = Array.isArray(response)
    ? response[0]
    : Array.isArray(response?.data)
      ? response.data[0]
      : response?.data || response
  const uuid = getFirstNonEmptyString(
    payload?.uuid,
    payload?.uid,
    payload?.file_uuid,
    payload?.fileUuid,
  )
  const name = getFirstNonEmptyString(
    payload?.original_name,
    payload?.originalName,
    payload?.name,
    payload?.file_name,
    payload?.filename,
  )
  const url = getFirstNonEmptyString(payload?.url, payload?.download_url, payload?.downloadUrl)
  return { uuid, name, url }
}

const mapWorkOrderAttachmentsToUploadList = (attachments: any[] | null | undefined) => {
  return (attachments || []).map((file: any, index: number) => {
    if (typeof file === 'string') {
      const uid = file
      return {
        uid,
        name: `附件${index + 1}`,
        status: 'done' as const,
        url: getFileDownloadUrl(uid),
      }
    }
    const uid = getFirstNonEmptyString(file?.uid, file?.uuid, file?.file_uuid, file?.fileUuid) || `attachment-${index}`
    const name =
      getFirstNonEmptyString(
        file?.name,
        file?.original_name,
        file?.originalName,
        file?.file_name,
        file?.filename,
      ) || `附件${index + 1}`
    const url =
      getFirstNonEmptyString(file?.url, file?.download_url, file?.downloadUrl) ||
      (getFirstNonEmptyString(file?.uid, file?.uuid, file?.file_uuid, file?.fileUuid)
        ? getFileDownloadUrl(getFirstNonEmptyString(file?.uid, file?.uuid, file?.file_uuid, file?.fileUuid)!)
        : undefined)
    return {
      uid,
      name,
      status: 'done' as const,
      url,
    }
  })
}

const normalizeWorkOrderAttachmentsForSave = (attachments: any[] | null | undefined) => {
  return (attachments || [])
    .map((file: any, index: number) => {
      const uploaded = extractUploadedAttachmentMeta(file?.response)
      const uid = uploaded.uuid || getFirstNonEmptyString(file?.uid, file?.uuid, file?.file_uuid, file?.fileUuid)
      const name =
        uploaded.name ||
        getFirstNonEmptyString(file?.name, file?.original_name, file?.originalName, file?.file_name, file?.filename)
      const url =
        uploaded.url ||
        getFirstNonEmptyString(file?.url, file?.download_url, file?.downloadUrl) ||
        (uid ? getFileDownloadUrl(uid) : undefined)
      if (!uid && !name && !url) return null
      return {
        uid: uid || `attachment-${index}`,
        name: name || `附件${index + 1}`,
        status: 'done',
        url,
      }
    })
    .filter(Boolean)
}

interface WorkOrder {
  id?: number
  tenant_id?: number
  code?: string
  name?: string
  product_id?: number
  product_code?: string
  product_name?: string
  quantity?: number
  split_remaining_quantity?: number
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
  attachments?: Array<{
    uid?: string
    name?: string
    url?: string
    original_name?: string
    originalName?: string
    file_uuid?: string
    fileUuid?: string
  }>
  created_at?: string
  updated_at?: string
  /** 制造模式定义在物料档案；工单以 product_id 关联「本单制造的产品物料」，接口从该物料 source_config 带出（fabrication / assembly） */
  manufacturing_mode?: 'fabrication' | 'assembly'
  /** 齐套率 (%) */
  readiness_rate?: number
  /** 工序步骤摘要（include_operation_steps=true） */
  operation_steps?: WorkOrderOperationStep[]
  /** 列表行类型 */
  row_kind?: 'work_order' | 'work_order_group' | 'split' | 'rework' | 'outsource'
  /** 主表树形缩进深度（组节点 / BOM / 拆分子行） */
  list_tree_depth?: number
  member_count?: number
  parent_work_order_id?: number
  work_order_group_id?: number
  group_code?: string
  group_name?: string
  group_role?: 'root' | 'component' | 'outsource_component' | string
  bom_parent_work_order_id?: number
  demand_item_id?: number
  supply_mode?: 'stocked' | 'direct' | string
  children?: WorkOrder[]
  rework_type?: string
  rework_operation_names?: string
  operation_name?: string
  supplier_name?: string
  scheduling_score?: number
  scheduling_rank_band?: string
  scheduling_score_breakdown?: Record<string, any>
  picking_score?: number
  picking_rank_band?: string
  picking_score_breakdown?: Record<string, any>
  tracking_mode?: string
  planned_batch_no?: string | null
  confirmed_batch_no?: string | null
  planned_serial_no?: string | null
  confirmed_serial_no?: string | null
  effective_batch_no?: string | null
  effective_serial_no?: string | null
  batch_rule_id?: number | null
  serial_rule_id?: number | null
  serial_split_child_count?: number | null
  capabilities?: {
    release?: { allowed: boolean; reason?: string | null }
    freeze?: { allowed: boolean; reason?: string | null }
    cancel?: { allowed: boolean; reason?: string | null }
    set_priority?: { allowed: boolean; reason?: string | null }
    print?: { allowed: boolean; reason?: string | null }
  }
}

type PullDemandComputationCandidate = {
  id: number
  computation_code?: string
  business_mode?: string
  computation_status?: string
  created_at?: string
  updated_at?: string
  can_push_work_order?: boolean
  disabled_reason?: string
}

type PullProductionPlanCandidate = {
  id: number
  plan_code?: string
  plan_name?: string
  status?: string
  execution_status?: string
  plan_start_date?: string
  plan_end_date?: string
  updated_at?: string
  can_push_work_order?: boolean
  disabled_reason?: string
}

type PullSalesOrderCandidate = {
  id: number
  order_code?: string
  customer_name?: string
  status?: string
  review_status?: string
  delivery_date?: string
  updated_at?: string
  remaining_push_quantity?: number
  capabilities?: PullSalesOrder['capabilities']
}

/** 报工数量框：失焦时若为空则视为未填写，需恢复打开弹窗时的默认值 */
function isBlankNumericInput(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return true
  if (typeof value === 'number' && Number.isNaN(value)) return true
  return false
}

/** 报工默认生产人员：优先工序派工，否则当前登录用户 */
function getWorkerInfoForReporting(operation?: any) {
  const user = getUserInfo() || {}
  if (operation?.assigned_worker_id) {
    return {
      worker_id: operation.assigned_worker_id,
      worker_name: String(
        operation.assigned_worker_name || user.full_name || user.username || '操作员'
      ),
    }
  }
  return {
    worker_id: user.id ?? 0,
    worker_name: String(user.full_name || user.username || '未知'),
  }
}

/** 与业务配置 parameters.reporting.default_production_worker_mode 对齐 */
function pickDefaultProductionWorker(
  mode: string | undefined,
  operation: any,
  currentUser: CurrentUser | null | undefined
): { id: number; full_name: string; username?: string; uuid?: string } {
  const gu = getUserInfo() || {}
  const curId = Number(currentUser?.id ?? gu.id ?? 0) || 0
  const curName = String(
    currentUser?.full_name || gu.full_name || currentUser?.username || gu.username || '当前用户'
  )
  const curUuid = currentUser?.uuid

  const m = mode || 'auto'
  if (m === 'current_user') {
    return {
      id: curId,
      full_name: curName,
      username: currentUser?.username || gu.username,
      uuid: curUuid,
    }
  }

  if (m === 'operation_assigned') {
    if (operation?.assigned_worker_id) {
      return {
        id: Number(operation.assigned_worker_id),
        full_name: String(operation.assigned_worker_name || curName),
      }
    }
    return {
      id: curId,
      full_name: curName,
      username: currentUser?.username || gu.username,
      uuid: curUuid,
    }
  }

  if (operation?.assigned_worker_id) {
    return {
      id: Number(operation.assigned_worker_id),
      full_name: String(operation.assigned_worker_name || curName),
    }
  }
  const defs = operation?.default_operators
  if (Array.isArray(defs) && defs.length > 0) {
    const d = defs[0]
    return {
      id: Number(d.id),
      full_name: String(d.name || curName),
      uuid: d.uuid,
    }
  }
  return {
    id: curId,
    full_name: curName,
    username: currentUser?.username || gu.username,
    uuid: curUuid,
  }
}

function getQuickReportWorkerPayload(
  operation: any,
  proxy: Pick<User, 'id' | 'full_name' | 'username'> | null,
  mode: string | undefined,
  currentUser: CurrentUser | null | undefined
): { worker_id: number; worker_name: string } {
  if (proxy?.id) {
    return {
      worker_id: proxy.id,
      worker_name: String(proxy.full_name || proxy.username || ''),
    }
  }
  const picked = pickDefaultProductionWorker(mode, operation, currentUser)
  return { worker_id: picked.id, worker_name: picked.full_name }
}

/** 列表展示：值由后端按工单 product_id → 产品物料上的制造模式定义解析 */
const MANUFACTURING_MODE_TAG_STYLE: React.CSSProperties = {
  margin: 0,
  width: 'fit-content',
  maxWidth: '100%',
}

function manufacturingModeTag(mode: string | undefined | null) {
  if (mode === 'assembly') {
    return (
      <Tag color="cyan" style={MANUFACTURING_MODE_TAG_STYLE}>
        装配型
      </Tag>
    )
  }
  if (mode === 'fabrication') {
    return (
      <Tag color="geekblue" style={MANUFACTURING_MODE_TAG_STYLE}>
        工艺型
      </Tag>
    )
  }
  return <span style={{ color: '#999' }}>—</span>
}

function getProductionModeLabel(mode?: string | null): string {
  return mode === 'MTO' ? '按订单生产' : '按库存生产'
}

function formLabelWithHint(title: string, hint: string): React.ReactNode {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {title}
      <Tooltip title={hint}>
        <Button
          type="text"
          size="small"
          icon={<QuestionCircleOutlined />}
          aria-label={title}
          style={{ padding: 0, width: 16, height: 16, color: 'var(--ant-color-text-quaternary)' }}
        />
      </Tooltip>
    </span>
  )
}

const MATERIAL_SOURCE_LABEL_KEYS: Record<string, string> = {
  Make: 'app.kuaizhizao.outsourceWorkOrder.sourceTypeMake',
  Buy: 'app.kuaizhizao.outsourceWorkOrder.sourceTypeBuy',
  Phantom: 'app.kuaizhizao.outsourceWorkOrder.sourceTypePhantom',
  Outsource: 'app.kuaizhizao.outsourceWorkOrder.sourceTypeOutsource',
  Configure: 'app.kuaizhizao.outsourceWorkOrder.sourceTypeConfigure',
}

function resolveMaterialSourceValidation(
  sourceType: string | undefined,
  t: (key: string) => string
): {
  sourceType?: string
  sourceTypeName?: string
  validationErrors?: string[]
  canCreateWorkOrder: boolean
} {
  const validationErrors: string[] = []
  let canCreateWorkOrder = true
  if (sourceType === 'Buy') {
    canCreateWorkOrder = false
    validationErrors.push(t('app.kuaizhizao.workOrder.validationMaterialBuy'))
  } else if (sourceType === 'Phantom') {
    canCreateWorkOrder = false
    validationErrors.push(t('app.kuaizhizao.workOrder.validationMaterialPhantom'))
  } else if (sourceType === 'Make') {
    validationErrors.push(t('app.kuaizhizao.workOrder.validationMaterialMake'))
  } else if (sourceType === 'Outsource') {
    validationErrors.push(t('app.kuaizhizao.workOrder.validationMaterialOutsource'))
  } else if (sourceType === 'Configure') {
    validationErrors.push(t('app.kuaizhizao.workOrder.validationMaterialConfigure'))
  }
  const labelKey = sourceType ? MATERIAL_SOURCE_LABEL_KEYS[sourceType] : undefined
  return {
    sourceType,
    sourceTypeName: labelKey ? t(labelKey) : sourceType,
    validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
    canCreateWorkOrder,
  }
}

function resolveWorkOrderManufacturingMode(record: {
  manufacturing_mode?: string | null
  manufacturingMode?: string | null
}): string {
  return record.manufacturing_mode ?? record.manufacturingMode ?? 'fabrication'
}

/** 列表：制造模式 / 生产模式堆叠（上行徽章、下行文案） */
function renderProductionManufacturingStacked(record: {
  production_mode?: string | null
  manufacturing_mode?: string | null
  manufacturingMode?: string | null
}): React.ReactNode {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        minWidth: 0,
        alignItems: 'flex-start',
      }}
    >
      {manufacturingModeTag(resolveWorkOrderManufacturingMode(record))}
      <Typography.Text type="secondary" style={{ fontSize: 12, lineHeight: 1.2 }}>
        {getProductionModeLabel(record.production_mode)}
      </Typography.Text>
    </div>
  )
}

function renderWorkOrderListLifecycle(record: WorkOrder): React.ReactNode {
  const lifecycle = getWorkOrderLifecycle(record)
  const activeStage = lifecycle.mainStages?.find((s) => s.status === 'active')
  const displayLabel = activeStage?.label ?? lifecycle.stageName
  return (
    <UniLifecycle
      percent={lifecycle.percent}
      stageName={displayLabel}
      status={lifecycle.status}
      showLabel
      showCircleTooltip
    />
  )
}

function getWorkOrderStackedSecondaryTextStyle(token: GlobalToken): React.CSSProperties {
  return {
    fontSize: token.fontSizeSM,
    fontWeight: 400,
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
  }
}

function getWorkOrderStackedSecondaryTagStyle(token: GlobalToken): React.CSSProperties {
  return {
    margin: 0,
    width: 'fit-content',
    fontSize: token.fontSizeSM,
    lineHeight: 1.2,
    padding: '2px 6px',
    display: 'inline-flex',
    alignItems: 'center',
    boxSizing: 'border-box',
  }
}

const WORK_ORDER_PRIORITY_MAP: Record<string, { text: string; color: string }> = {
  low: { text: '低', color: 'default' },
  normal: { text: '正常', color: 'blue' },
  high: { text: '高', color: 'orange' },
  urgent: { text: '紧急', color: 'red' },
}

function getWorkOrderReadinessStrokeColor(percent: number): string {
  if (percent === 100) return '#52c41a'
  if (percent >= 80) return '#faad14'
  return '#ff4d4f'
}

function renderWorkOrderReadinessRing(rate: number): React.ReactNode {
  const percent = Math.min(100, Math.max(0, Math.round(Number(rate))))
  return (
    <div style={{ display: 'inline-flex', justifyContent: 'center', lineHeight: 0 }}>
      <Progress
        type="circle"
        percent={percent}
        size={28}
        strokeWidth={7}
        strokeColor={getWorkOrderReadinessStrokeColor(percent)}
        status={percent === 100 ? 'success' : percent > 0 ? 'active' : 'normal'}
        format={(value) => `${value}%`}
      />
    </div>
  )
}

function renderWorkOrderPriorityTag(
  priority: string | undefined,
  tagStyle: React.CSSProperties,
): React.ReactNode {
  const key = (priority || 'normal').trim()
  if (!key || key === 'normal') return null
  const config = WORK_ORDER_PRIORITY_MAP[key] || { text: key, color: 'blue' }
  return (
    <Tag color={config.color} style={tagStyle}>
      {config.text}
    </Tag>
  )
}

function formatWorkOrderListQuantity(record: WorkOrder): string {
  const qty = Number(record.quantity)
  if (!Number.isFinite(qty)) return '-'
  const formatNum = (value: number) => (value % 1 === 0 ? String(value) : value.toFixed(2))
  const isSplitParent =
    (record.row_kind || 'work_order') === 'work_order' &&
    ['split', '已拆分'].includes(record.status || '')
  if (isSplitParent && record.split_remaining_quantity != null) {
    const remaining = Number(record.split_remaining_quantity)
    if (Number.isFinite(remaining)) {
      return `${formatNum(qty)}(${formatNum(remaining)})`
    }
  }
  return formatNum(qty)
}

function isSplitParentWorkOrder(record: WorkOrder): boolean {
  return (
    (record.row_kind || 'work_order') === 'work_order' &&
    ['split', '已拆分'].includes(record.status || '')
  )
}

/** 是否允许点击工序列展开工序卡（数量为 0 时不展开） */
function isWorkOrderGroupListRow(record: WorkOrder): boolean {
  return record.row_kind === 'work_order_group'
}

function canExpandWorkOrderOperationPanel(record: WorkOrder): boolean {
  const kind = record.row_kind || 'work_order'
  if (kind === 'work_order_group' || kind === 'rework' || kind === 'outsource') return false
  if (record.id == null) return false
  if (isSplitParentWorkOrder(record) && record.split_remaining_quantity != null) {
    const remaining = Number(record.split_remaining_quantity)
    return Number.isFinite(remaining) && remaining > 0
  }
  const qty = Number(record.quantity)
  return Number.isFinite(qty) && qty > 0
}

/** Ant Design 默认 token 无 colorPurple，委外工序卡使用 purple 色阶 + 固定 fallback */
function getOutsourceOperationCardTheme(token: GlobalToken) {
  const tk = token as GlobalToken & Record<string, string | undefined>
  return {
    accent: tk.purple6 ?? tk['purple-6'] ?? '#722ed1',
    bg: tk.purple1 ?? tk['purple-1'] ?? '#f9f0ff',
    bgHover: tk.purple2 ?? tk['purple-2'] ?? '#efdbff',
    border: tk.purple5 ?? tk['purple-5'] ?? '#9254de',
    footerText: tk.purple7 ?? tk['purple-7'] ?? '#531dab',
  }
}

/** 与主行品名字号行高一致，保证「品名 + 徽章」垂直中心对齐 */
function getWorkOrderStackedPrimaryTagStyle(token: GlobalToken): React.CSSProperties {
  const rowHeight = Math.round(token.fontSize * 1.25)
  return {
    margin: 0,
    fontSize: token.fontSizeSM,
    height: rowHeight,
    lineHeight: 1,
    padding: '0 6px',
    display: 'inline-flex',
    alignItems: 'center',
    boxSizing: 'border-box',
    flexShrink: 0,
  }
}

function renderWorkOrderSourceOrderLine(
  record: WorkOrder,
  secondaryTextStyle: React.CSSProperties,
): React.ReactNode {
  if (record.production_mode !== 'MTO') return null
  const code = record.sales_order_code?.trim()
  if (!code) return null
  const label = `来源订单 ${code}`
  return (
    <Typography.Text
      type="secondary"
      ellipsis={{ tooltip: label }}
      style={secondaryTextStyle}
    >
      {label}
    </Typography.Text>
  )
}

function summarizeWorkOrderTreeChildren(record: WorkOrder) {
  const children = record.children ?? []
  let split = 0
  let rework = 0
  let outsource = 0
  for (const child of children) {
    const kind = child.row_kind || 'work_order'
    if (kind === 'split') split += 1
    else if (kind === 'rework') rework += 1
    else if (kind === 'outsource') outsource += 1
  }
  return { split, rework, outsource, total: split + rework + outsource }
}

function renderWorkOrderTreeChildTags(record: WorkOrder, tagStyle: React.CSSProperties) {
  const { split, rework, outsource, total } = summarizeWorkOrderTreeChildren(record)
  if (total <= 0) return null
  return (
    <>
      {split > 0 ? (
        <Tag color="cyan" style={tagStyle}>
          拆{split}
        </Tag>
      ) : null}
      {rework > 0 ? (
        <Tag color="orange" style={tagStyle}>
          返{rework}
        </Tag>
      ) : null}
      {outsource > 0 ? (
        <Tag color="purple" style={tagStyle}>
          委{outsource}
        </Tag>
      ) : null}
    </>
  )
}

function WorkOrderProductCodeCell({
  record,
  primaryExtra,
}: {
  record: WorkOrder
  primaryExtra?: React.ReactNode
}) {
  const { token } = theme.useToken()
  const secondaryTextStyle = getWorkOrderStackedSecondaryTextStyle(token)
  const secondaryTagStyle = getWorkOrderStackedSecondaryTagStyle(token)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <UniTableStackedPrimaryCell
        primary={String(record.product_name ?? record.product_code ?? '').trim() || '-'}
        secondary={String(record.code ?? '')}
        primaryExtra={primaryExtra}
        secondaryExtra={
          <>
            {renderWorkOrderPriorityTag(record.priority, secondaryTagStyle)}
            {renderWorkOrderTreeChildTags(record, secondaryTagStyle)}
            {isWorkOrderPlannedEndOverdue(record) ? (
              <Tag color="error" style={secondaryTagStyle}>
                逾期
              </Tag>
            ) : null}
            {record.is_frozen ? (
              <Tag color="warning" style={secondaryTagStyle}>
                已冻结
              </Tag>
            ) : null}
          </>
        }
      />
      {renderWorkOrderSourceOrderLine(record, secondaryTextStyle)}
    </div>
  )
}

function getWorkOrderListRowKey(record: WorkOrder): string {
  const kind = record.row_kind || 'work_order'
  if (kind === 'work_order_group') {
    const gid =
      record.work_order_group_id ??
      (record.id != null && Number(record.id) < 0 ? -Number(record.id) : null)
    return `work_order_group-${gid ?? record.code ?? 'row'}`
  }
  return `${kind}-${record.id ?? record.code ?? 'row'}`
}

/** 与 Ant Design Table 勾选列 / 首列内边距 / 树形缩进一致，供工序卡行 left inset */
const WO_TABLE_SELECTION_COL_WIDTH = 48
const WO_TABLE_CELL_PADDING_INLINE = 16
const WO_TABLE_TREE_INDENT = 16
const WO_TABLE_TREE_EXPAND_ICON = 17
const WO_TABLE_TREE_EXPAND_GAP = 8
const WO_TABLE_OPERATION_PANEL_INSET_RIGHT = 16

function getWorkOrderTreeRowDepth(record: WorkOrder): number {
  if (record.list_tree_depth != null) {
    return record.list_tree_depth
  }
  if (record.parent_work_order_id != null) {
    return 1
  }
  const kind = record.row_kind || 'work_order'
  return kind === 'split' || kind === 'rework' || kind === 'outsource' ? 1 : 0
}

/** 工序卡容器左缘与上方「产品/工单编号」列正文起始对齐 */
function getWorkOrderOperationPanelInsetLeft(record: WorkOrder): number {
  const depth = getWorkOrderTreeRowDepth(record)
  const hasTreeChildren = Array.isArray(record.children) && record.children.length > 0
  const expandIcon = hasTreeChildren ? WO_TABLE_TREE_EXPAND_ICON + WO_TABLE_TREE_EXPAND_GAP : 0
  return (
    WO_TABLE_SELECTION_COL_WIDTH +
    WO_TABLE_CELL_PADDING_INLINE +
    depth * WO_TABLE_TREE_INDENT +
    expandIcon
  )
}

/** 工序/报工 API 使用的工单 ID（拆分工单用自身 ID，独立报工） */
function getWorkOrderOperationSourceId(record: WorkOrder): number | undefined {
  return record.id ?? undefined
}

function getWorkOrderOperationApiId(record: WorkOrder): string {
  return String(record.id ?? '')
}

function resolveWorkOrderOperationSteps(
  record: WorkOrder,
  rowByKey?: Map<string, WorkOrder>,
): WorkOrderOperationStep[] | undefined {
  if (record.operation_steps?.length) {
    return record.operation_steps
  }
  const kind = record.row_kind || 'work_order'
  if (kind === 'split' && record.parent_work_order_id != null) {
    const parentKey = getWorkOrderListRowKey({
      row_kind: 'work_order',
      id: record.parent_work_order_id,
    } as WorkOrder)
    return rowByKey?.get(parentKey)?.operation_steps ?? undefined
  }
  return undefined
}

function indexWorkOrderListRows(rows: WorkOrder[], map: Map<string, WorkOrder>) {
  for (const row of rows) {
    map.set(getWorkOrderListRowKey(row), row)
    if (row.children?.length) {
      indexWorkOrderListRows(row.children, map)
    }
  }
}

/** 工序卡插入位置：无子行或在子行之上时为自身；子树展开时落在最后一个可见子行之后 */
function getLastVisibleTreeDescendant(
  record: WorkOrder,
  treeExpandedKeys: ReadonlySet<React.Key>,
): WorkOrder {
  const rowKey = getWorkOrderListRowKey(record)
  if (!record.children?.length || !treeExpandedKeys.has(rowKey)) {
    return record
  }
  return getLastVisibleTreeDescendant(record.children[record.children.length - 1], treeExpandedKeys)
}

function buildWorkOrderOperationPanelAnchorToRoot(
  panelRootKeys: readonly React.Key[],
  rowByKey: Map<string, WorkOrder>,
  treeExpandedKeys: readonly React.Key[],
  panelRecordByKey?: Map<string, WorkOrder>,
): Map<string, string> {
  const treeSet = new Set(treeExpandedKeys)
  const anchorToRoot = new Map<string, string>()
  for (const rootKey of panelRootKeys) {
    const rootStr = String(rootKey)
    const record = rowByKey.get(rootStr) ?? panelRecordByKey?.get(rootStr)
    if (!record) {
      anchorToRoot.set(rootStr, rootStr)
      continue
    }
    const anchor = getWorkOrderListRowKey(getLastVisibleTreeDescendant(record, treeSet))
    anchorToRoot.set(anchor, rootStr)
  }
  return anchorToRoot
}

function isWorkOrderOperationExpandTriggerRow(record: WorkOrder): boolean {
  return canExpandWorkOrderOperationPanel(record)
}

function parseWorkOrderOperationsBundle(
  res: unknown,
  fallbackManufacturingMode = 'fabrication',
): { manufacturing_mode: string; operations: any[] } {
  if (
    res &&
    typeof res === 'object' &&
    !Array.isArray(res) &&
    Array.isArray((res as { operations?: unknown }).operations)
  ) {
    const r = res as { manufacturing_mode?: string; operations: any[] }
    return {
      manufacturing_mode: r.manufacturing_mode || fallbackManufacturingMode,
      operations: r.operations || [],
    }
  }
  return {
    manufacturing_mode: fallbackManufacturingMode,
    operations: Array.isArray(res) ? res : [],
  }
}

function isWorkOrderListSelectableRow(record: WorkOrder): boolean {
  const kind = record.row_kind || 'work_order'
  return kind === 'work_order' || kind === 'split' || kind === 'work_order_group'
}

function renderWorkOrderGroupMemberCountTag(
  record: WorkOrder,
  tagStyle: React.CSSProperties,
): React.ReactNode {
  const count = record.member_count
  if (count == null || count <= 0) return null
  return (
    <Tag color="geekblue" style={tagStyle}>
      {count} 张
    </Tag>
  )
}

function WorkOrderListPrimaryCell({ record }: { record: WorkOrder }) {
  const kind = record.row_kind || 'work_order'
  const { token } = theme.useToken()
  const splitTagStyle = getWorkOrderStackedPrimaryTagStyle(token)

  if (kind === 'work_order_group') {
    const groupCode = String(record.group_code ?? record.code ?? '').trim() || '-'
    const title = String(record.product_name ?? groupCode).trim() || '-'
    return (
      <UniTableStackedPrimaryCell
        primary={title}
        primaryExtra={
          <Tag color="geekblue" style={{ margin: 0, ...splitTagStyle }}>
            工单组
          </Tag>
        }
        secondary={groupCode}
        secondaryCopyable={groupCode !== '-'}
        secondaryExtra={renderWorkOrderGroupMemberCountTag(record, splitTagStyle)}
      />
    )
  }

  if (kind === 'rework') {
    const operationLabel =
      String(record.rework_operation_names ?? '').trim() || '起始工序'
    const reworkCode = String(record.code ?? '').trim() || '-'
    return (
      <UniTableStackedPrimaryCell
        primary={operationLabel}
        primaryExtra={
          <Tag color="orange" style={{ margin: 0, ...splitTagStyle }}>
            返工单
          </Tag>
        }
        secondary={reworkCode}
        secondaryCopyable={reworkCode !== '-'}
      />
    )
  }

  if (kind === 'outsource') {
    const operationName =
      String(record.operation_name ?? record.name ?? record.product_name ?? '').trim() || '-'
    const outsourceCode = String(record.code ?? '').trim() || '-'
    return (
      <UniTableStackedPrimaryCell
        primary={operationName}
        primaryExtra={
          <Tag color="purple" style={{ margin: 0, ...splitTagStyle }}>
            委外单
          </Tag>
        }
        secondary={outsourceCode}
        secondaryCopyable={outsourceCode !== '-'}
      />
    )
  }

  if (kind === 'split') {
    return (
      <WorkOrderProductCodeCell
        record={record}
        primaryExtra={
          <Tag color="cyan" style={{ margin: 0, ...splitTagStyle }}>
            拆分工单
          </Tag>
        }
      />
    )
  }

  return <WorkOrderProductCodeCell record={record} />
}

function WorkOrderTreeProductCodeCell({ record }: { record: WorkOrder }) {
  const { token } = theme.useToken()
  const secondaryTagStyle = getWorkOrderStackedSecondaryTagStyle(token)
  return (
    <UniTableStackedPrimaryCell
      primary={String(record.product_name ?? record.product_code ?? '').trim() || '-'}
      secondary={String(record.code ?? '')}
      secondaryExtra={renderWorkOrderPriorityTag(record.priority, secondaryTagStyle)}
    />
  )
}

function WorkOrderPlannedRangeCell({ record }: { record: WorkOrder }) {
  return (
    <UniTableStackedPrimaryCell
      primary={formatDateTimeBySiteSetting(record.planned_start_date)}
      secondary={formatDateTimeBySiteSetting(record.planned_end_date)}
      secondaryCopyable={false}
      uniformText
    />
  )
}

const WorkOrdersPage: React.FC = () => {
  const { t, i18n } = useTranslation()
  const { message: messageApi } = App.useApp()
  const workOrderPerms = useResourcePermissions(WORK_ORDER_RESOURCE)
  const { openPrint, PrintModal } = useKuaizhizaoPrintModal()

  const workOrderImportTemplate = useMemo(
    () =>
      buildFactoryImportTemplate(
        t,
        [
          { field: 'code', labelKey: 'app.kuaizhizao.workOrder.import.code', aliases: ['工单编号', '编号'] },
          {
            field: 'product',
            required: true,
            labelKey: 'app.kuaizhizao.workOrder.import.productCode',
            aliases: ['产品编号', '物料编号'],
          },
          {
            field: 'plannedQty',
            required: true,
            labelKey: 'app.kuaizhizao.workOrder.import.plannedQty',
            aliases: ['计划数量', '数量'],
          },
          {
            field: 'workshop',
            labelKey: 'app.kuaizhizao.workOrder.import.workshopCode',
            aliases: ['车间编号', '车间'],
          },
        ],
        [
          t('app.kuaizhizao.workOrder.importExample.code'),
          t('app.kuaizhizao.workOrder.importExample.productCode'),
          t('app.kuaizhizao.workOrder.importExample.plannedQty'),
          t('app.kuaizhizao.workOrder.importExample.workshopCode'),
        ],
      ),
    [t, i18n.language],
  )
  const pullFromDemandComputationAction = resolveKuaizhizaoDocumentAction(t, 'work_order.pull_from_demand_computation')
  const pullFromProductionPlanAction = resolveKuaizhizaoDocumentAction(t, 'work_order.pull_from_production_plan')
  const pullFromSalesOrderAction = resolveKuaizhizaoDocumentAction(t, 'work_order.pull_from_sales_order')
  const pushToOutboundAction = resolveKuaizhizaoDocumentAction(t, 'outbound.pull_from_work_order')
  const pushToInboundAction = resolveKuaizhizaoDocumentAction(t, 'inbound.pull_from_work_order')
  const pushToProductionReturnInboundAction = resolveKuaizhizaoDocumentAction(
    t,
    'inbound.pull_from_work_order_for_production_return',
  )
  const { token } = theme.useToken()
  const workOrderDetailDrawerZIndex = token.zIndexPopupBase
  const queryClient = useQueryClient()
  const getPreference = useUserPreferenceStore((s) => s.getPreference)
  const getConfig = useConfigStore((s) => s.getConfig)
  const workOrderListDefaultPageSize = getPreference(
    'ui.default_page_size',
    getConfig('ui.default_page_size', 20)
  )
  const location = useLocation()
  const navigate = useNavigate()
  const actionRef = useRef<ActionType>(null)
  const tableSearchFormRef = useRef<any>(null)
  const tableSearchParamsRef = useRef<Record<string, any> | undefined>(undefined)

  const workOrderLifecycleValueEnum = useMemo(
    () => buildWorkOrderLifecycleValueEnum(t),
    [t, i18n.language],
  )

  const applyWorkOrderListLifecycleFilter = useCallback((stage: string) => {
    const params = { [LIST_LIFECYCLE_STAGE_FIELD]: stage }
    commitListPageSearchParams(tableSearchParamsRef, params)
    tableSearchFormRef.current?.setFieldsValue?.(params)
    actionRef.current?.reload?.()
  }, [])
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [highlightPlannedEndOverdue, setHighlightPlannedEndOverdue] = useState(false)

  const invalidateStatistics = () => {
    queryClient.invalidateQueries({ queryKey: ['workOrderStatistics'] })
    queryClient.invalidateQueries({
      queryKey: ['uniTable', 'kuaizhizao', 'work-orders', 'list'],
      exact: false,
    })
  }
  const { data: statistics } = useQuery({
    queryKey: ['workOrderStatistics'],
    queryFn: getWorkOrderStatistics,
    staleTime: 0, // 统计与列表均实时拉取
  })
  const { data: executionConfig } = useQuery({
    queryKey: ['workOrderExecutionConfig'],
    queryFn: () => workOrderApi.getExecutionConfig(),
    staleTime: 0,
  })

  useEffect(() => {
    prefetchDefaultWorkOrderList(queryClient, workOrderListDefaultPageSize)
  }, [queryClient, workOrderListDefaultPageSize])

  const workOrderRowByKeyRef = useRef<Map<string, WorkOrder>>(new Map())
  const [workOrderListRowIndexVersion, setWorkOrderListRowIndexVersion] = useState(0)
  const operationPanelRecordByKeyRef = useRef<Map<string, WorkOrder>>(new Map())

  const syncWorkOrderListRowIndexFromTableData = useCallback((rows: WorkOrder[]) => {
    if (!Array.isArray(rows)) return rows
    const map = new Map<string, WorkOrder>()
    indexWorkOrderListRows(rows, map)
    workOrderRowByKeyRef.current = map
    setWorkOrderListRowIndexVersion((v) => v + 1)

    const defaults = collectDefaultExpandedWorkOrderTreeKeys(rows, getWorkOrderListRowKey)
    const defaultKeySet = new Set(defaults.map(String))
    setWorkOrderTreeExpandedRowKeys((prev) => {
      const next = new Set<string>([...defaultKeySet])
      for (const k of prev) {
        const sk = String(k)
        if (defaultKeySet.has(sk)) continue
        const row = map.get(sk)
        if (!row?.children?.length) continue
        const kind = row.row_kind || 'work_order'
        if (kind === WORK_ORDER_GROUP_ROW_KIND && !isBomTreeWorkOrderGroup(row)) continue
        if (kind === 'work_order') {
          const onlySplitReworkOutsource = row.children.every((c) => {
            const ck = c.row_kind || 'work_order'
            return ck === 'split' || ck === 'rework' || ck === 'outsource'
          })
          if (onlySplitReworkOutsource) continue
        }
        next.add(sk)
      }
      return [...next]
    })
    return rows
  }, [])

  const selectedWorkOrderIds = useMemo(
    () => resolveWorkOrderIdsFromListRowKeys(selectedRowKeys, workOrderRowByKeyRef.current),
    [selectedRowKeys, workOrderListRowIndexVersion]
  )

  const selectedWorkOrdersForBatch = useMemo(
    () =>
      selectedRowKeys
        .map((key) => workOrderRowByKeyRef.current.get(String(key)))
        .filter((row): row is WorkOrder => row != null && (row.row_kind ?? 'work_order') === 'work_order'),
    [selectedRowKeys, workOrderListRowIndexVersion],
  )

  const {
    customFields: workOrderListCustomFields,
    generateCustomFieldColumns: generateWorkOrderCustomFieldColumns,
    enrichRecordsWithCustomFields: enrichWorkOrderRecordsWithCustomFields,
    customFieldValues: workOrderDetailCustomFieldValues,
    loadFieldValuesForDetail: loadWorkOrderFieldValuesForDetail,
    resetDetailFieldValues: resetWorkOrderDetailFieldValues,
  } = useCustomFieldsForList<WorkOrder>({ tableName: WORK_ORDER_CUSTOM_FIELD_TABLE })

  useEffect(() => {
    if (workOrderListCustomFields.length > 0 && actionRef.current) {
      setTimeout(() => actionRef.current?.reload(), 200)
    }
  }, [workOrderListCustomFields.length])

  const handleWorkOrderTableRequest = useCallback(
    async (params: any, sort: any, _filter: any, searchFormValues: any) => {
      try {
        const result = await fetchWorkOrderListForTable(
          { current: params.current!, pageSize: params.pageSize! },
          sort,
          _filter,
          searchFormValues
        )
        if (result.success && Array.isArray(result.data)) {
          syncWorkOrderListRowIndexFromTableData(result.data)
          const enriched = await enrichWorkOrderRecordsWithCustomFields(result.data)
          return { ...result, data: enriched }
        }
        return result
      } catch (error) {
      window.console.error('获取工单列表失败:', error)
        messageApi.error('获取工单列表失败')
        return {
          data: [],
          success: false,
          total: 0,
        }
      }
    },
    [messageApi, syncWorkOrderListRowIndexFromTableData, enrichWorkOrderRecordsWithCustomFields]
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
  /** 工艺路线去重：保留首条，避免下拉出现重复项 */
  const uniqueProcessRouteList = useMemo(() => {
    const seen = new Set<string>()
    return processRouteList.filter((route: any) => {
      const key =
        route?.id != null
          ? `id:${route.id}`
          : route?.uuid
            ? `uuid:${route.uuid}`
            : `name:${String(route?.code ?? '')}|${String(route?.name ?? '')}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [processRouteList])
  
  const [workerList, setWorkerList] = useState<any[]>([])
  const [teamList, setTeamList] = useState<any[]>([])
  const [stationList, setStationList] = useState<any[]>([])
  const [equipmentList, setEquipmentList] = useState<any[]>([])
  const [moldList, setMoldList] = useState<any[]>([])
  const [toolList, setToolList] = useState<any[]>([])
  const [workshopList, setWorkshopList] = useState<any[]>([])
  const [workCenterList, setWorkCenterList] = useState<any[]>([])
  const [personnelOptions, setPersonnelOptions] = useState<any[]>([])
  const [resourceOptions, setResourceOptions] = useState<any[]>([])
  // 选中的工序列表（用于创建工单时）
  const [selectedOperations, setSelectedOperations] = useState<any[]>([])
  const [createProcessRouteId, setCreateProcessRouteId] = useState<number | undefined>()
  const [createAddOperationsModalVisible, setCreateAddOperationsModalVisible] = useState(false)
  const [createAddOperationUuids, setCreateAddOperationUuids] = useState<string[]>([])
  // 当前选中产品的物料来源信息
  const [selectedMaterialSourceInfo, setSelectedMaterialSourceInfo] = useState<{
    sourceType?: string
    sourceTypeName?: string
    validationErrors?: string[]
    canCreateWorkOrder?: boolean
  } | null>(null)
  const [completeTrackingModalOpen, setCompleteTrackingModalOpen] = useState(false)
  const [completeTrackingLoading, setCompleteTrackingLoading] = useState(false)
  const [completeTrackingWorkOrder, setCompleteTrackingWorkOrder] = useState<WorkOrder | null>(null)

  /** 按统一优先级加载生效工艺（产品工艺 API 已聚合路线与工序行） */
  const loadProcessRouteForMaterial = useCallback(async (materialUuid: string) => {
    try {
      const pp = await productProcessApi.get(materialUuid)
      const routeId = pp.processRouteId
      if (!routeId) {
        setCreateProcessRouteId(undefined)
        formRef.current?.setFieldsValue({
          process_route_id: undefined,
          allow_operation_jump: false,
          operations: undefined,
        })
        setSelectedOperations([])
        return
      }

      setCreateProcessRouteId(Number(routeId))
      formRef.current?.setFieldsValue({
        process_route_id: routeId,
        allow_operation_jump: pp.allowOperationJump ?? false,
      })

      const mapLinesToOperations = () =>
        (pp.lines ?? [])
          .map((ln, index) => {
            const op =
              operationList.find((o: any) => o.id === ln.operationId) ??
              operationList.find((o: any) => (o.uuid ?? '') === ln.operationUuid)
            if (!op) return null
            return {
              operation_id: op.id,
              operation_code: ln.code ?? op.code,
              operation_name: ln.name ?? op.name,
              sequence: index + 1,
              is_node_operation: Boolean(ln.isNodeOperation),
              reporting_type:
                ln.reportingType ?? op.reportingType ?? (op as any).reporting_type ?? 'quantity',
              over_report_mode: ln.overReportMode ?? 'none',
              over_report_value: ln.overReportValue ?? 0,
            }
          })
          .filter(Boolean) as ReturnType<typeof parseOperationSequence>

      const fromLines = mapLinesToOperations()
      if (fromLines.length > 0) {
        setSelectedOperations(fromLines)
        formRef.current?.setFieldsValue({
          operations: fromLines.map((o) => o.operation_id),
        })
        messageApi.success(`已加载产品工艺及 ${fromLines.length} 个工序`)
        return
      }

      setSelectedOperations([])
      formRef.current?.setFieldsValue({ operations: undefined })
      messageApi.info('已指派工艺路线，暂无工序行；请手工添加工序或到产品工艺页维护')
    } catch (e: any) {
      console.warn('加载产品工艺失败:', e)
      setCreateProcessRouteId(undefined)
      formRef.current?.setFieldsValue({ process_route_id: undefined, operations: undefined })
      setSelectedOperations([])
    }
  }, [operationList, messageApi])

  const availableCreateOperations = useMemo(() => {
    const existingIds = new Set(
      selectedOperations
        .map((o: any) => Number(o?.operation_id))
        .filter((id: number) => Number.isFinite(id) && id > 0),
    )
    return operationList.filter((op: any) => !existingIds.has(Number(op?.id)))
  }, [operationList, selectedOperations])

  const handleAppendCreateOperations = useCallback(() => {
    if (!createAddOperationUuids.length) {
      messageApi.warning('请先选择要添加的工序')
      return
    }

    const operationByUuid = new Map(
      operationList.map((op: any) => [String(op?.uuid), op]),
    )
    const appendRows = createAddOperationUuids
      .map((uuid) => operationByUuid.get(String(uuid)))
      .filter((op): op is any => !!op)
      .filter(
        (op: any) =>
          !selectedOperations.some((exist: any) => Number(exist?.operation_id) === Number(op?.id)),
      )
      .map((op: any, index: number) => ({
        operation_id: op.id,
        operation_code: op.code,
        operation_name: op.name,
        sequence: selectedOperations.length + index + 1,
        is_node_operation: false,
        reporting_type: op.reportingType ?? (op as any).reporting_type ?? 'quantity',
        over_report_mode: 'none',
        over_report_value: 0,
      }))

    if (!appendRows.length) {
      messageApi.warning('所选工序已在清单中')
      return
    }

    const newOps = [...selectedOperations, ...appendRows]
    setSelectedOperations(newOps)
    formRef.current?.setFieldsValue({
      operations: newOps.map((o: any) => o.operation_id),
    })
    setCreateAddOperationsModalVisible(false)
    setCreateAddOperationUuids([])
    messageApi.success(`已添加 ${appendRows.length} 个工序`)
  }, [createAddOperationUuids, messageApi, operationList, selectedOperations])
  // 只显示自制件
  const [onlyShowMake, setOnlyShowMake] = useState(true)
  // 从文档加载的产品列表（销售订单/销售预测/需求）
  const [productSourceData, setProductSourceData] = useState<{
    type: string
    materials: any[]
    items?: { productId: number; quantity: number; variant_attributes?: Record<string, unknown> }[]
    /** 从销售订单加载时写入，提交时带出 MTO 与销售订单快照 */
    salesOrderRef?: { id: number; code?: string; name?: string }
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
  const [productSourceKeyword, setProductSourceKeyword] = useState('')
  // 加载产品来源文档列表（销售订单/销售预测/需求）- 直接拉平为明细行
  useEffect(() => {
    if (!productSourceModalVisible || !productSourceModalType) {
      setProductSourceDocList([])
      return
    }
    const load = async () => {
      setProductSourceDocLoading(true)
      try {
        const keyword = productSourceKeyword.trim()
        if (productSourceModalType === 'sales_order') {
          const res: any = await listSalesOrders({ limit: 50, ...(keyword ? { keyword } : {}) })
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
          const res: any = await listSalesForecasts({ limit: 50, ...(keyword ? { keyword } : {}) })
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
          if (!keyword) {
            setProductSourceDocList(flat)
          } else {
            const lowered = keyword.toLowerCase()
            setProductSourceDocList(
              flat.filter((row: any) =>
                [
                  row?._demand_code,
                  row?._demand_name,
                  row?.material_code,
                  row?.material_name,
                  row?.material_spec,
                ]
                  .filter(Boolean)
                  .some((v) => String(v).toLowerCase().includes(lowered))
              )
            )
          }
        }
      } catch (e) {
        console.error('加载文档列表失败:', e)
        setProductSourceDocList([])
      } finally {
        setProductSourceDocLoading(false)
      }
    }
    load()
  }, [productSourceModalVisible, productSourceModalType, productSourceKeyword])

  // Modal 相关状态（创建/编辑工单）
  const [modalVisible, setModalVisible] = useState(false)
  const [createWorkOrderMode, setCreateWorkOrderMode] = useState<'normal' | 'peer_group'>('normal')
  const [isEdit, setIsEdit] = useState(false)
  const [currentWorkOrder, setCurrentWorkOrder] = useState<WorkOrder | null>(null)
  const formRef = useRef<any>(null)

  const {
    customFields: workOrderFormCustomFields,
    customFieldValues: workOrderFormCustomFieldValues,
    loadFieldValues: loadWorkOrderFormFieldValues,
    extractFormValues: extractWorkOrderFormValues,
    saveCustomFieldValues: saveWorkOrderCustomFieldValues,
    resetFieldValues: resetWorkOrderFormFieldValues,
  } = useCustomFields({ tableName: WORK_ORDER_CUSTOM_FIELD_TABLE, loadWhenOpen: true, open: modalVisible })

  // 从加载来源填充表单：当 productSourceData 有 items 且新建工单弹窗打开时，自动填充产品与数量
  useEffect(() => {
    if (!productSourceData?.items?.length || !modalVisible || isEdit || !formRef.current) return
    const first = productSourceData.items[0]
    const so = productSourceData.salesOrderRef
    formRef.current.setFieldsValue({
      product_id: first.productId,
      quantity: first.quantity,
      variant_attributes: first.variant_attributes != null
        ? (typeof first.variant_attributes === 'string'
            ? first.variant_attributes
            : JSON.stringify(first.variant_attributes, null, 2))
        : undefined,
      ...(so?.id
        ? {
            sales_order_id: so.id,
            sales_order_code: so.code,
            sales_order_name: so.name,
            production_mode: 'MTO',
          }
        : {}),
    })
    if (so?.id) {
      setProductionMode('MTO')
    }
    // 同步加载物料来源信息
    const selectedMaterial = productSourceData.materials.find((p: any) => p.id === first.productId)
    if (selectedMaterial) {
      materialApi
        .get(selectedMaterial.uuid)
        .then((materialDetail: any) => {
          const sourceType = materialDetail.sourceType || materialDetail.source_type
          setSelectedMaterialSourceInfo(resolveMaterialSourceValidation(sourceType, t))
        })
        .catch(() => setSelectedMaterialSourceInfo(null))
    } else {
      setSelectedMaterialSourceInfo(null)
    }
    // 自动加载物料绑定的工艺路线及工序
    if (selectedMaterial?.uuid) loadProcessRouteForMaterial(selectedMaterial.uuid)
  }, [productSourceData, modalVisible, isEdit, t])

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
            operationApi.list({ isActive: true, limit: 500 }).catch(() => ({ data: [], total: 0 })),
            processRouteApi.list({ isActive: true, limit: 500 }).catch(() => ({ data: [], total: 0 })),
            searchUserDisplay({ is_active: true, page_size: 100 }).catch(() => ({ items: [] })),
            getEquipmentList({ is_active: true, limit: 100 }).catch(() => ({ items: [] })),
            getMoldList({ is_active: true, limit: 100 }).catch(() => ({ items: [] })),
            toolApi.list({ limit: 100 }).catch(() => ({ items: [] })),
          ])
        if (cancelled) return
        setProductList(Array.isArray(products) ? products : (products as any)?.data ?? (products as any)?.items ?? [])
        setOperationList(unwrapProcessPagedList(operations))
        setProcessRouteList(unwrapProcessPagedList(routes))
        setWorkerList(displayItemsToUsers(usersRes?.items || []))
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
  /** 详情抽屉：单据跟踪 refresh（生命周期时间线共用） */
  const [woTrackingRefreshKey, setWoTrackingRefreshKey] = useState(0)
  const workOrderTracking = useDocumentTracking(
    drawerVisible && workOrderDetail ? 'work_order' : undefined,
    workOrderDetail?.id,
    woTrackingRefreshKey,
  )

  const [workOrderOperations, setWorkOrderOperations] = useState<any[]>([])
  const [operationsModalVisible, setOperationsModalVisible] = useState(false)
  const [currentOperation, setCurrentOperation] = useState<any>(null)
  const operationFormRef = useRef<any>()

  // 行展开相关状态
  const [operationExpandedRowKeys, setOperationExpandedRowKeys] = useState<React.Key[]>([])
  const [workOrderTreeExpandedRowKeys, setWorkOrderTreeExpandedRowKeys] = useState<React.Key[]>([])
  const [expandedOperationsMap, setExpandedOperationsMap] = useState<Record<number, any[]>>({})
  const [expandedWorkOrderDetailMap, setExpandedWorkOrderDetailMap] = useState<Record<number, WorkOrder>>({})
  const [loadingOperationsMap, setLoadingOperationsMap] = useState<Record<number, boolean>>({})

  // 创建返工单相关状态
  const [reworkModalVisible, setReworkModalVisible] = useState(false)
  const [currentWorkOrderForRework, setCurrentWorkOrderForRework] = useState<WorkOrder | null>(null)
  const [reworkModalOperations, setReworkModalOperations] = useState<any[]>([])
  const [reworkableQuantity, setReworkableQuantity] = useState<number>(0)
  const [reworkSubmitLoading, setReworkSubmitLoading] = useState(false)
  const reworkFormRef = useRef<any>(null)

  // 创建工序委外相关状态
  const [outsourceModalVisible, setOutsourceModalVisible] = useState(false)
  const [currentWorkOrderForOutsource, setCurrentWorkOrderForOutsource] =
    useState<WorkOrder | null>(null)
  const outsourceFormRef = useRef<any>(null)
  const [supplierList, setSupplierList] = useState<any[]>([])
  const [outsourceOptionsByOpId, setOutsourceOptionsByOpId] = useState<
    Record<number, { outsourceable_quantity: number }>
  >({})

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

  // 合并工单相关状态
  const [mergeModalVisible, setMergeModalVisible] = useState(false)
  const [mergeTargetWorkOrderIds, setMergeTargetWorkOrderIds] = useState<number[]>([])
  const mergeFormRef = useRef<any>(null)
  const [mergeLoading, setMergeLoading] = useState(false)
  const [dissolveGroupLoading, setDissolveGroupLoading] = useState(false)

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
  const [dispatchPickListsLoading, setDispatchPickListsLoading] = useState(false)
  const dispatchFormRef = useRef<any>(null)

  /** 工序卡点击环形进度：快速报工 */
  const [quickReportingModalVisible, setQuickReportingModalVisible] = useState(false)
  const [quickReportingWorkOrder, setQuickReportingWorkOrder] = useState<WorkOrder | null>(null)
  const [quickReportingOperation, setQuickReportingOperation] = useState<any>(null)
  const [quickReportingRouteOperations, setQuickReportingRouteOperations] = useState<any[]>([])
  const quickReportingFormRef = useRef<any>(null)
  const quickReportingProxyWorkerRef = useRef<Pick<User, 'id' | 'full_name' | 'username'> | null>(null)
  const currentUser = useGlobalStore((s) => s.currentUser)
  const canProxyReporting = useMemo(
    () => hasModulePermission(currentUser ?? undefined, 'kuaizhizao:reporting', 'proxy'),
    [currentUser]
  )

  /** 快速报工：通过 ProForm initialValues 在挂载时填入（避免 destroyOnHidden 下 setFieldsValue 早于表单挂载导致空白） */
  const quickReportingInitialValues = useMemo(() => {
    if (!quickReportingModalVisible || !quickReportingWorkOrder || !quickReportingOperation) {
      return undefined
    }
    const qty = Number(quickReportingWorkOrder.quantity) || 0
    const stdH =
      quickReportingOperation.standard_time != null
        ? parseFloat(String(quickReportingOperation.standard_time)) *
          parseFloat(String(quickReportingWorkOrder.quantity ?? 1))
        : undefined
    if (quickReportingOperation.reporting_type === 'status') {
      return {
        completed_status: 'completed',
        work_hours: stdH ?? 0,
        remarks: undefined,
      }
    }
    const rem = getRemainingReportableQuantity(quickReportingOperation, qty)
    return {
      qualified_quantity: rem,
      unqualified_quantity: 0,
      defect_type: undefined,
      defect_reason_text: undefined,
      work_hours: stdH,
      remarks: undefined,
    }
  }, [quickReportingModalVisible, quickReportingWorkOrder, quickReportingOperation])

  /** 创建返工单：通过 initialValues 在挂载时填入（避免 destroyOnHidden 下 setFieldsValue 时序问题） */
  const reworkFormInitialValues = useMemo(() => {
    if (!reworkModalVisible || !currentWorkOrderForRework) {
      return undefined
    }
    const defaultQty =
      reworkableQuantity > 0 ? Math.min(1, reworkableQuantity) : undefined
    return {
      quantity: defaultQty,
      rework_type: '返工',
    }
  }, [reworkModalVisible, currentWorkOrderForRework, reworkableQuantity])

  /** 快速报工：解析路线工序列表（用于判断是否末道） */
  useEffect(() => {
    if (!quickReportingModalVisible || !quickReportingWorkOrder?.id) {
      setQuickReportingRouteOperations([])
      return
    }
    const wid = quickReportingWorkOrder.id
    const cached = expandedOperationsMap[wid]
    if (cached?.length) {
      setQuickReportingRouteOperations(cached)
      return
    }
    let cancelled = false
    workOrderApi.getOperations(wid.toString()).then((ops) => {
      if (!cancelled) setQuickReportingRouteOperations(ops || [])
    })
    return () => {
      cancelled = true
    }
  }, [quickReportingModalVisible, quickReportingWorkOrder?.id, expandedOperationsMap])

  const quickReportingIsLastOperation = useMemo(
    () => resolveIsLastOperation(quickReportingOperation, quickReportingRouteOperations),
    [quickReportingOperation, quickReportingRouteOperations],
  )

  const quickReportingWarehouseRequired = useMemo(
    () =>
      isInboundWarehouseRequiredForLastOperation(
        quickReportingIsLastOperation,
        executionConfig?.last_operation_auto_inbound_mode,
      ),
    [quickReportingIsLastOperation, executionConfig?.last_operation_auto_inbound_mode],
  )

  const quickReportingLastInboundHint = useMemo(() => {
    if (!quickReportingIsLastOperation) return ''
    return resolveLastInboundHint(t, executionConfig?.last_operation_auto_inbound_mode)
  }, [quickReportingIsLastOperation, executionConfig?.last_operation_auto_inbound_mode, t])

  useEffect(() => {
    if (!quickReportingModalVisible || !quickReportingIsLastOperation || !quickReportingWorkOrder?.id) {
      return
    }
    let cancelled = false
    workOrderApi
      .getDefaultInboundWarehouse(String(quickReportingWorkOrder.id))
      .then((res) => {
        if (cancelled || !res?.warehouse_id) return
        quickReportingFormRef.current?.setFieldsValue({
          inbound_warehouse_id: res.warehouse_id,
          inbound_warehouse_name: res.warehouse_name ?? undefined,
        })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [quickReportingModalVisible, quickReportingIsLastOperation, quickReportingWorkOrder?.id])

  useEffect(() => {
    if (!quickReportingModalVisible || !canProxyReporting || !quickReportingOperation) {
      if (!quickReportingModalVisible) quickReportingProxyWorkerRef.current = null
      return
    }
    let cancelled = false
    const mode = executionConfig?.default_production_worker_mode
    ;(async () => {
      const picked = pickDefaultProductionWorker(mode, quickReportingOperation, currentUser)
      let uuid = picked.uuid
      if (!uuid && picked.id) {
        try {
          const res = await searchUserDisplay({ is_active: true, page_size: 200 })
          const u = res.items?.find((x) => x.id === picked.id)
          uuid = u?.uuid
        } catch {
          /* ignore */
        }
      }
      if (cancelled) return
      quickReportingProxyWorkerRef.current = {
        id: picked.id,
        full_name: picked.full_name,
        username: picked.username || '',
      }
      setTimeout(() => {
        quickReportingFormRef.current?.setFieldsValue({
          proxy_worker_uuid: uuid || undefined,
        })
      }, 0)
    })()
    return () => {
      cancelled = true
    }
  }, [
    quickReportingModalVisible,
    canProxyReporting,
    quickReportingOperation?.operation_id,
    quickReportingOperation?.assigned_worker_id,
    quickReportingOperation?.assigned_worker_name,
    // 工序档案默认人员变化时需重算默认选中
    JSON.stringify(quickReportingOperation?.default_operators || []),
    quickReportingWorkOrder?.id,
    executionConfig?.default_production_worker_mode,
    currentUser?.id,
    currentUser?.uuid,
    currentUser?.full_name,
    currentUser?.username,
  ])

  // 工序派工弹窗：打开时拉取派工下拉数据（含车间/工作中心），不依赖新建工单弹窗是否打开过
  useEffect(() => {
    if (!dispatchModalVisible) return
    let cancelled = false
    const load = async () => {
      setDispatchPickListsLoading(true)
      try {
        const [users, teams, stations, equipment, molds, tools, workshops, workCenters] = await Promise.all([
          searchUserDisplay({ is_active: true, page_size: 200 }).catch(() => ({ items: [] })),
          workGroupApi.list({ is_active: true, limit: 500 }).catch(() => ({ items: [], total: 0 })),
          workstationApi.list({ is_active: true, limit: 1000 }).catch(() => ({ items: [], total: 0 })),
          getEquipmentList({ is_active: true, limit: 300 }).catch(() => ({ items: [] })),
          getMoldList({ is_active: true, limit: 300 }).catch(() => ({ items: [] })),
          toolApi.list({ limit: 300 }).catch(() => ({ items: [] })),
          workshopApi.list({ is_active: true, limit: 500 }).catch(() => ({ items: [], total: 0 })),
          workCenterApi.list({ is_active: true, limit: 500 }).catch(() => ({ items: [], total: 0 })),
        ])
        if (cancelled) return
        setWorkerList(displayItemsToUsers(users?.items ?? []))
        setTeamList(factoryListItems(teams as any))
        setStationList(factoryListItems(stations as any))
        setEquipmentList(equipment?.items ?? [])
        setMoldList(molds?.items ?? [])
        setToolList(
          (tools as any)?.items ?? (Array.isArray(tools) ? tools : [])
        )
        setWorkshopList(factoryListItems(workshops as any))
        setWorkCenterList(factoryListItems(workCenters as any))

        const pOpts: any[] = [];
        ((users as any)?.items || []).forEach((u: any) => pOpts.push({ label: `[人员] ${u.full_name || u.username}`, value: `U_${u.id}` }));
        factoryListItems(teams as any).forEach((t: any) => pOpts.push({ label: `[小组] ${t.name}`, value: `T_${t.id}` }));
        setPersonnelOptions(pOpts);

        const rOpts: any[] = [];
        factoryListItems(workCenters as any).forEach((wc: any) => rOpts.push({ label: `[中心] ${wc.code || ''} ${wc.name || ''}`.trim(), value: `WC_${wc.id}` }));
        factoryListItems(stations as any).forEach((s: any) => rOpts.push({ label: `[工位] ${s.code || ''} ${s.name || ''}`.trim(), value: `S_${s.id}` }));
        setResourceOptions(rOpts);
      } finally {
        if (!cancelled) setDispatchPickListsLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [dispatchModalVisible])

  const [syncModalVisible, setSyncModalVisible] = useState(false)

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


  /** 参考销售订单：先打开弹窗，再让 CodeField 自动生成编号 */
  const handleCreate = () => {
    setIsEdit(false)
    setCurrentWorkOrder(null)
    setCreateWorkOrderMode('normal')
    setProductionMode('MTS') // 重置为MTS模式
    setSelectedOperations([]) // 清空选中的工序
    setSelectedMaterialSourceInfo(null) // 清空物料来源信息
    setModalVisible(true)
    // FormModalTemplate 设置了 destroyOnHidden，每次打开 ProForm 都会重新挂载为空，
    // 不需要用 setTimeout 等 ref 就绪再 resetFields
  }

  const pullFromComputationQuery = useUniPullQuery<PullDemandComputationCandidate>({
    rowKey: 'id',
    selectionType: 'radio',
    loadData: async ({ keyword, page, pageSize }) => {
      const kw = keyword.trim()
      const listRes = await listDemandComputations({
        skip: 0,
        limit: 50,
        computation_status: '完成',
        computation_code: kw || undefined,
      })
      const rows = listRes?.data || []
      const candidates = await Promise.all(
        rows
          .filter((row) => row.id != null)
          .map(async (row) => {
            let canPushWorkOrder = true
            let disabledReason: string | undefined
            try {
              const options = await getPushOptions(row.id!)
              canPushWorkOrder = !!options.has_production_items && (options.production_choices || []).includes('work_order')
              if (!options.has_production_items) {
                disabledReason = '无可转生产明细'
              } else if (!canPushWorkOrder) {
                disabledReason = '当前不可直接转工单'
              }
            } catch {
              // 能力探测失败时保持可选，由后端最终校验
            }
            return {
              id: row.id!,
              computation_code: row.computation_code,
              business_mode: row.business_mode,
              computation_status: row.computation_status,
              created_at: row.created_at,
              updated_at: row.updated_at,
              can_push_work_order: canPushWorkOrder,
              disabled_reason: disabledReason,
            } as PullDemandComputationCandidate
          }),
      )
      const start = (page - 1) * pageSize
      return { data: candidates.slice(start, start + pageSize), total: candidates.length }
    },
    isRowDisabled: (record) => record.can_push_work_order === false,
    onConfirm: async (keys, rows) => {
      const selectedId = Number(keys[0])
      if (!selectedId) {
        messageApi.warning(`请选择${pullFromDemandComputationAction.sourceLabel}`)
        return
      }
      const selected = rows[0]
      if (selected?.can_push_work_order === false) {
        messageApi.warning(selected.disabled_reason || '该需求运算单当前不可用于创建工单')
        return
      }
      try {
        const res = await generateOrdersFromComputation(selectedId, 'work_order_only')
        const count = Number(res?.work_order_count ?? res?.work_orders?.length ?? 0)
        messageApi.success(count > 0 ? `已从${pullFromDemandComputationAction.sourceLabel}创建 ${count} 张${pullFromDemandComputationAction.targetLabel}` : `已从${pullFromDemandComputationAction.sourceLabel}创建${pullFromDemandComputationAction.targetLabel}`)
        actionRef.current?.reload()
        invalidateStatistics()
        pullFromComputationQuery.closeModal()
      } catch (e: any) {
        messageApi.error(e?.response?.data?.detail || `从${pullFromDemandComputationAction.sourceLabel}创建${pullFromDemandComputationAction.targetLabel}失败`)
      }
    },
  })

  const pullFromProductionPlanQuery = useUniPullQuery<PullProductionPlanCandidate>({
    rowKey: 'id',
    selectionType: 'radio',
    loadData: async ({ keyword, page, pageSize }) => {
      const kw = keyword.trim().toLowerCase()
      const listRes: any = await planningApi.productionPlan.list({
        skip: 0,
        limit: 200,
      })
      const rows = Array.isArray(listRes) ? listRes : (listRes?.data ?? listRes?.items ?? [])
      const filtered = (rows || [])
        .filter((row: any) => row?.id != null)
        .filter((row: any) => {
          if (!kw) return true
          const text = `${row.plan_code || ''} ${row.plan_name || ''}`.toLowerCase()
          return text.includes(kw)
        })
        .map((row: any) => {
          const status = String(row.status || '')
          const executionStatus = String(row.execution_status || '')
          const canPush = executionStatus !== '已执行' && status === '已审核'
          const disabledReason =
            executionStatus === '已执行'
              ? '已执行'
              : status !== '已审核'
                ? '仅已审核计划可转工单'
                : undefined
          return {
            id: Number(row.id),
            plan_code: row.plan_code,
            plan_name: row.plan_name,
            status: row.status,
            execution_status: row.execution_status,
            plan_start_date: row.plan_start_date,
            plan_end_date: row.plan_end_date,
            updated_at: row.updated_at,
            can_push_work_order: canPush,
            disabled_reason: disabledReason,
          } as PullProductionPlanCandidate
        })
      const start = (page - 1) * pageSize
      return { data: filtered.slice(start, start + pageSize), total: filtered.length }
    },
    isRowDisabled: (record) => record.can_push_work_order === false,
    onConfirm: async (keys, rows) => {
      const selectedId = Number(keys[0])
      if (!selectedId) {
        messageApi.warning(`请选择${pullFromProductionPlanAction.sourceLabel}`)
        return
      }
      const selected = rows[0]
      if (selected?.can_push_work_order === false) {
        messageApi.warning(selected.disabled_reason || '该生产计划当前不可用于创建工单')
        return
      }
      try {
        const res: any = await planningApi.productionPlan.pushToWorkOrders(selectedId)
        const count = Number(
          res?.work_order_count ??
          res?.created_count ??
          res?.created_documents?.work_order?.length ??
          0,
        )
        messageApi.success(count > 0 ? `已从${pullFromProductionPlanAction.sourceLabel}创建 ${count} 张${pullFromProductionPlanAction.targetLabel}` : `已从${pullFromProductionPlanAction.sourceLabel}创建${pullFromProductionPlanAction.targetLabel}`)
        actionRef.current?.reload()
        invalidateStatistics()
        pullFromProductionPlanQuery.closeModal()
      } catch (e: any) {
        const detail = e?.response?.data?.detail
        const msg = typeof detail === 'string' ? detail : detail?.message
        messageApi.error(msg || `从${pullFromProductionPlanAction.sourceLabel}创建${pullFromProductionPlanAction.targetLabel}失败`)
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
          remaining_push_quantity: Number(row.remaining_push_quantity ?? 0),
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
    isRowDisabled: (record) =>
      record.remaining_push_quantity <= 0 || record.capabilities?.push_work_order?.allowed === false,
    onConfirm: async (keys, rows) => {
      const selectedId = Number(keys[0])
      if (!selectedId) {
        messageApi.warning(`请选择${pullFromSalesOrderAction.sourceLabel}`)
        return
      }
      const selected = rows[0]
      if (selected?.remaining_push_quantity <= 0 || selected?.capabilities?.push_work_order?.allowed === false) {
        messageApi.warning(selected?.capabilities?.push_work_order?.reason || '该销售订单当前不可用于创建工单')
        return
      }
      try {
        const res: any = await pushSalesOrderToWorkOrder(selectedId)
        const count = Number(res?.target_documents?.length ?? 0)
        messageApi.success(
          count > 0
            ? `已从${pullFromSalesOrderAction.sourceLabel}创建 ${count} 张${pullFromSalesOrderAction.targetLabel}`
            : `已从${pullFromSalesOrderAction.sourceLabel}创建${pullFromSalesOrderAction.targetLabel}`,
        )
        actionRef.current?.reload()
        invalidateStatistics()
        pullFromSalesOrderQuery.closeModal()
      } catch (e: any) {
        const detail = e?.response?.data?.detail
        const msg = typeof detail === 'string' ? detail : detail?.message
        messageApi.error(msg || `从${pullFromSalesOrderAction.sourceLabel}创建${pullFromSalesOrderAction.targetLabel}失败`)
      }
    },
  })

  /**
   * 处理编辑工单
   */
  const handleEdit = async (record: WorkOrder) => {
    try {
      // 加载完整详情
      const detail = await workOrderApi.get(record.id!.toString())
      setIsEdit(true)
      setCreateWorkOrderMode('normal')
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
          planned_batch_no: detail.planned_batch_no,
          confirmed_batch_no: detail.confirmed_batch_no,
          planned_serial_no: detail.planned_serial_no,
          confirmed_serial_no: detail.confirmed_serial_no,
          remarks: detail.remarks,
          attachments: mapWorkOrderAttachmentsToUploadList((detail as any).attachments),
        })
        if (detail.id != null) {
          loadWorkOrderFormFieldValues(detail.id).then((fieldFormValues) => {
            formRef.current?.setFieldsValue(fieldFormValues)
          })
        }
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
      const panelWorkOrderId = record.id
      const operationSourceId = getWorkOrderOperationSourceId(record) ?? panelWorkOrderId
      // 展开：优先单次 GET operations?include_meta（含 manufacturing_mode），后端并对不良类型批量查询；TanStack 去重
      if (!expandedOperationsMap[panelWorkOrderId]) {
        setLoadingOperationsMap(prev => ({ ...prev, [panelWorkOrderId]: true }))
        try {
          const bundle = await queryClient.fetchQuery({
            queryKey: [WORK_ORDER_ROW_EXPAND_QK, panelWorkOrderId, operationSourceId],
            staleTime: WORK_ORDER_ROW_EXPAND_STALE_MS,
            queryFn: async () => {
              const res = await workOrderApi.getOperations(String(operationSourceId), { includeMeta: true })
              const parsed = parseWorkOrderOperationsBundle(res)
              if (parsed.operations.length > 0 || (res && typeof res === 'object' && !Array.isArray(res))) {
                return parsed
              }
              const detail = await workOrderApi.get(String(operationSourceId))
              return {
                manufacturing_mode: (detail as WorkOrder)?.manufacturing_mode || 'fabrication',
                operations: parsed.operations,
              }
            },
          })
          setExpandedWorkOrderDetailMap(prev => ({
            ...prev,
            [panelWorkOrderId]: { manufacturing_mode: bundle.manufacturing_mode } as WorkOrder,
          }))
          setExpandedOperationsMap(prev => ({ ...prev, [panelWorkOrderId]: bundle.operations || [] }))
        } catch (error) {
          console.error('获取工单工序列表失败:', error)
          setExpandedOperationsMap(prev => ({ ...prev, [panelWorkOrderId]: [] }))
        } finally {
          setLoadingOperationsMap(prev => ({ ...prev, [panelWorkOrderId]: false }))
        }
      }
    }
  }

  /**
   * 工序列点击：在表格行下方展开原有人机料法工序卡（renderOperationCard）。
   */
  const WO_ROW_EXPAND_TRIGGER_CLASS = 'wo-row-expand-trigger'

  const toggleWorkOrderOperationPanel = (record: WorkOrder, e?: React.SyntheticEvent) => {
    e?.preventDefault()
    e?.stopPropagation()
    if (!canExpandWorkOrderOperationPanel(record)) return
    const rowKey = getWorkOrderListRowKey(record)
    setOperationExpandedRowKeys((prev) => {
      const isExpanded = prev.includes(rowKey)
      const nextExpanded = !isExpanded
      if (nextExpanded) {
        operationPanelRecordByKeyRef.current.set(rowKey, record)
      } else {
        operationPanelRecordByKeyRef.current.delete(rowKey)
      }
      void handleExpand(nextExpanded, record)
      return nextExpanded ? [...prev, rowKey] : prev.filter((k) => k !== rowKey)
    })
  }

  const handleWorkOrderTreeExpandChange = useCallback((keys: readonly React.Key[]) => {
    setWorkOrderTreeExpandedRowKeys([...keys])
  }, [])

  /**
   * 打开派工弹窗
   */
  const handleOpenDispatchModal = (operation: any, workOrder: WorkOrder) => {
    setCurrentOperationForDispatch(operation)
    setCurrentWorkOrderForDispatch(workOrder)
    setDispatchModalVisible(true)
    // 如果已有派工信息，设置初始值
    window.setTimeout(() => {
      if (dispatchFormRef.current) {
        const combinedPersonnelValues: string[] = [];
        if (operation.assigned_worker_id) combinedPersonnelValues.push(`U_${operation.assigned_worker_id}`);
        if (operation.assigned_team_id) combinedPersonnelValues.push(`T_${operation.assigned_team_id}`);

        const combinedResourceValues: string[] = [];
        if (operation.work_center_id) combinedResourceValues.push(`WC_${operation.work_center_id}`);
        if (operation.assigned_station_id) combinedResourceValues.push(`S_${operation.assigned_station_id}`);

        dispatchFormRef.current.setFieldsValue({
          workshop_id: operation.workshop_id ?? operation.workshopId,
          assigned_personnel: combinedPersonnelValues.length > 0 ? combinedPersonnelValues : undefined,
          assigned_resource: combinedResourceValues.length > 0 ? combinedResourceValues : undefined,
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

      const workshop = workshopList.find(
        (w: any) => w.id === values.workshop_id || w.id === values.workshopId
      )
      
      let assigned_worker_id: number | undefined;
      let assigned_team_id: number | undefined;
      const personnel = Array.isArray(values.assigned_personnel) ? values.assigned_personnel : [values.assigned_personnel].filter(Boolean);
      personnel.forEach((p: string) => {
        if (p.startsWith('U_')) assigned_worker_id = Number(p.substring(2));
        if (p.startsWith('T_')) assigned_team_id = Number(p.substring(2));
      });

      let work_center_id: number | undefined;
      let assigned_station_id: number | undefined;
      const resources = Array.isArray(values.assigned_resource) ? values.assigned_resource : [values.assigned_resource].filter(Boolean);
      resources.forEach((r: string) => {
        if (r.startsWith('WC_')) work_center_id = Number(r.substring(3));
        if (r.startsWith('S_')) assigned_station_id = Number(r.substring(2));
      });

      const worker = workerList.find(w => w.id === assigned_worker_id)
      const team = teamList.find(t => t.id === assigned_team_id)
      const equipment = equipmentList.find(e => e.id === values.assigned_equipment_id)
      const mold = moldList.find(m => m.id === values.assigned_mold_id)
      const tool = toolList.find(t => t.id === values.assigned_tool_id)
      const station = stationList.find(s => s.id === assigned_station_id)
      const workCenter = workCenterList.find(w => w.id === work_center_id)

      const dispatchData = {
        workshop_id: values.workshop_id ?? null,
        workshop_name: workshop?.name ?? null,
        work_center_id: values.work_center_id ?? null,
        work_center_name: workCenter?.name ?? null,
        assigned_station_id: values.assigned_station_id ?? null,
        assigned_station_name: station?.name ?? null,
        assigned_worker_id: values.assigned_worker_id ?? null,
        assigned_worker_name: worker?.full_name || worker?.username || null,
        assigned_team_id: values.assigned_team_id ?? null,
        assigned_team_name: team?.name ?? null,
        assigned_equipment_id: values.assigned_equipment_id ?? null,
        assigned_equipment_name: equipment?.name || null,
        assigned_mold_id: values.assigned_mold_id ?? null,
        assigned_mold_name: mold?.name || null,
        assigned_tool_id: values.assigned_tool_id ?? null,
        assigned_tool_name: tool?.name || null,
        remarks: values.remarks,
      }

      await workOrderApi.dispatchOperation(
        getWorkOrderOperationApiId(currentWorkOrderForDispatch),
        currentOperationForDispatch.id,
        dispatchData
      )

      messageApi.success('派工成功')
      setDispatchModalVisible(false)

      // 刷新工序列表
      const operations = await workOrderApi.getOperations(
        getWorkOrderOperationApiId(currentWorkOrderForDispatch)
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

  /** 与触屏终端一致：工序档案「简易质检」或已绑定不良品项时，不合格需说明原因 */
  const operationHasSimpleInspection = (operation: any) => {
    if (!operation) return false
    const mode = operation.inspection_mode ?? operation.inspectionMode
    if (mode === 'simple') return true
    const dt = operation.defect_types ?? operation.defectTypes
    return Array.isArray(dt) && dt.length > 0
  }

  const getOperationDefectTypeOptions = (operation: any) => {
    const raw = operation?.defect_types ?? operation?.defectTypes ?? []
    if (!Array.isArray(raw)) return [] as Array<{ label: string; value: string }>
    return raw.map((d: any) => ({
      label: `${d.name || d.code || ''}${d.code ? ` (${d.code})` : ''}`.trim(),
      value: d.code || d.uuid || String(d.id ?? ''),
    }))
  }

  /** 工序卡环形进度：打开快速报工（与报工管理页提交逻辑一致） */
  const openQuickReportingFromOperationCard = (operation: any, workOrder: WorkOrder) => {
    if (isSplitParentWorkOrder(workOrder)) {
      messageApi.warning('已拆分主工单不可报工，请将剩余数量拆分为子工单后执行')
      return
    }
    if (operation.status === 'completed') {
      messageApi.info('该工序已完成')
      return
    }
    if (operation.status === 'pending') {
      messageApi.warning('请先开工后再报工')
      return
    }
    if (operation.reporting_type === 'quantity') {
      const rem = getRemainingReportableQuantity(operation, Number(workOrder.quantity) || 0)
      if (rem <= 0) {
        messageApi.warning('该工序已无可报数量')
        return
      }
    }
    setQuickReportingWorkOrder(workOrder)
    setQuickReportingOperation(operation)
    setQuickReportingModalVisible(true)
  }

  const handleQuickReportQualifiedFocus = useCallback(() => {
    quickReportingFormRef.current?.setFieldValue('qualified_quantity', null)
  }, [])

  const handleQuickReportQualifiedBlur = useCallback(() => {
    const form = quickReportingFormRef.current
    if (!form || !quickReportingOperation || !quickReportingWorkOrder) return
    window.setTimeout(() => {
      const f = quickReportingFormRef.current
      if (!f || !quickReportingOperation || !quickReportingWorkOrder) return
      const v = f.getFieldValue('qualified_quantity')
      if (!isBlankNumericInput(v)) return
      const rem = getRemainingReportableQuantity(
        quickReportingOperation,
        Number(quickReportingWorkOrder.quantity) || 0
      )
      f.setFieldValue('qualified_quantity', rem)
    }, 0)
  }, [quickReportingOperation, quickReportingWorkOrder])

  const handleQuickReportUnqualifiedFocus = useCallback(() => {
    quickReportingFormRef.current?.setFieldValue('unqualified_quantity', null)
  }, [])

  const handleQuickReportUnqualifiedBlur = useCallback(() => {
    const form = quickReportingFormRef.current
    if (!form || !quickReportingOperation || !quickReportingWorkOrder) return
    window.setTimeout(() => {
      const f = quickReportingFormRef.current
      if (!f || !quickReportingOperation || !quickReportingWorkOrder) return
      const v = f.getFieldValue('unqualified_quantity')
      if (!isBlankNumericInput(v)) return
      f.setFieldValue('unqualified_quantity', 0)
    }, 0)
  }, [quickReportingOperation, quickReportingWorkOrder])

  const handleQuickReportingSubmit = async (values: any) => {
    if (!quickReportingWorkOrder?.id || !quickReportingOperation) return
    try {
      if (executionConfig?.require_confirmed_picking_before_reporting) {
        const status = await workOrderApi.getPickingConfirmationStatus(quickReportingWorkOrder.id.toString())
        if (!status?.has_confirmed_picking) {
          messageApi.warning('当前配置要求先确认领料，未确认时不可报工')
          return
        }
      }
      const { worker_id, worker_name } = canProxyReporting
        ? getQuickReportWorkerPayload(
            quickReportingOperation,
            quickReportingProxyWorkerRef.current,
            executionConfig?.default_production_worker_mode,
            currentUser
          )
        : getWorkerInfoForReporting(quickReportingOperation)
      const reportingData: any = {
        work_order_id: quickReportingWorkOrder.id,
        work_order_code: quickReportingWorkOrder.code,
        work_order_name: quickReportingWorkOrder.name,
        operation_id: quickReportingOperation.operation_id,
        operation_code: quickReportingOperation.operation_code,
        operation_name: quickReportingOperation.operation_name,
        worker_id,
        worker_name,
        status: 'pending',
        reported_at: new Date().toISOString(),
        remarks: values.remarks,
        work_hours: values.work_hours ?? 0,
      }
      if (quickReportingOperation.reporting_type === 'status') {
        reportingData.reported_quantity = values.completed_status === 'completed' ? 1 : 0
        reportingData.qualified_quantity = values.completed_status === 'completed' ? 1 : 0
        reportingData.unqualified_quantity = 0
      } else {
        const qq = Number(values.qualified_quantity) || 0
        const uq = Number(values.unqualified_quantity) || 0
        const rq = qq + uq
        if (rq <= 0) {
          messageApi.warning('合格数与不合格数之和须大于 0')
          return
        }
        const rem = getRemainingReportableQuantity(quickReportingOperation, Number(quickReportingWorkOrder.quantity) || 0)
        if (rq > rem + 1e-9) {
          messageApi.warning(
            t('apps.kuaizhizao.workOrder.quickReport.exceedEffectiveSubmit', { max: rem })
          )
          return
        }
        const defectOpts = getOperationDefectTypeOptions(quickReportingOperation)
        if (uq > 0 && operationHasSimpleInspection(quickReportingOperation)) {
          if (defectOpts.length > 0 && !values.defect_type) {
            messageApi.warning(t('app.kuaizhizao.workOrder.kioskSelectDefectType'))
            return
          }
          if (defectOpts.length === 0 && !(values.defect_reason_text || '').toString().trim()) {
            messageApi.warning('请输入不良品原因')
            return
          }
        }
        reportingData.reported_quantity = rq
        reportingData.qualified_quantity = qq
        reportingData.unqualified_quantity = uq
      }
      if (quickReportingIsLastOperation) {
        if (quickReportingWarehouseRequired && !values.inbound_warehouse_id) {
          messageApi.warning(t('app.kuaizhizao.warehouseInbound.entry.workOrder.selectWarehouse'))
          return
        }
        if (values.inbound_warehouse_id) {
          reportingData.inbound_warehouse_id = Number(values.inbound_warehouse_id)
          reportingData.inbound_warehouse_name = values.inbound_warehouse_name
            ? String(values.inbound_warehouse_name)
            : undefined
        }
      }
      const wid = quickReportingWorkOrder.id
      const created = await reportingApi.create(
        coerceReportingCreateStrings(reportingData, quickReportingWorkOrder)
      )
      const createdId = Number((created as any)?.id)
      if (!Number.isFinite(createdId) || createdId <= 0) {
        throw new Error('报工创建返回异常：未返回有效记录ID')
      }
      if (
        quickReportingOperation.reporting_type === 'quantity' &&
        Number(values.unqualified_quantity) > 0 &&
        operationHasSimpleInspection(quickReportingOperation) &&
        createdId
      ) {
        const uq = Number(values.unqualified_quantity) || 0
        const defectOpts = getOperationDefectTypeOptions(quickReportingOperation)
        try {
          if (defectOpts.length > 0 && values.defect_type) {
            await reportingApi.recordDefect(String(createdId), {
              defect_quantity: uq,
              defect_type: values.defect_type,
              defect_reason: '工单列表快速报工录入',
              disposition: 'quarantine',
            })
          } else if (defectOpts.length === 0 && (values.defect_reason_text || '').toString().trim()) {
            await reportingApi.recordDefect(String(createdId), {
              defect_quantity: uq,
              defect_type: 'other',
              defect_reason: String(values.defect_reason_text).trim(),
              disposition: 'quarantine',
            })
          }
        } catch (defectErr: any) {
          console.error(defectErr)
          messageApi.warning('报工成功，但不良品记录创建失败')
        }
      }
      messageApi.success('报工成功')
      setQuickReportingModalVisible(false)
      setQuickReportingWorkOrder(null)
      setQuickReportingOperation(null)
      quickReportingFormRef.current?.resetFields()
      const operations = await workOrderApi.getOperations(wid!.toString())
      setExpandedOperationsMap(prev => ({ ...prev, [wid!]: operations || [] }))
      queryClient.invalidateQueries({ queryKey: [WORK_ORDER_ROW_EXPAND_QK, wid] })
      invalidateStatistics()
      actionRef.current?.reload()
    } catch (error: any) {
      messageApi.error(error?.message || '报工失败')
      throw error
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
      return token.colorSuccess
    }
    if (progress >= 95) {
      return token.colorSuccess
    }
    if (progress >= 80) {
      return token.colorWarning
    }
    return token.colorError
  }

  /**
   * 处理打印
   */
  const handlePrint = (record: WorkOrder) => {
    if (!record.id) return
    openPrint({ documentType: 'work_order', documentId: record.id })
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
    const plannedQty = Number(workOrder.quantity || 0)
    const qualifiedQty = Number(operation.qualified_quantity || 0)
    const completedQty = Number(operation.completed_quantity || 0)
    const isEffectivelyCompleted =
      operation.status === 'completed' ||
      (plannedQty > 0 && (qualifiedQty >= plannedQty || completedQty >= plannedQty))
    const isCompleted = isEffectivelyCompleted
    const isInProgress = !isCompleted && operation.status === 'in_progress'
    const isOutsourced = Boolean(
      operation.is_outsourced ||
        operation.isOutsourced ||
        operation.outsource_supplier_name ||
        operation.outsource_order_code,
    )
    const outsourceTheme = getOutsourceOperationCardTheme(token)
    const progressColor =
      isOutsourced && !isCompleted
        ? outsourceTheme.accent
        : getProgressColor(
            isCompleted ? { ...operation, status: 'completed' } : operation,
            qualifiedRate,
          )
    const themeAccent = isCompleted
      ? token.colorSuccess
      : isOutsourced
        ? outsourceTheme.accent
        : token.colorPrimary
    const headerBg = themeAccent
    const footerBg = isCompleted
      ? token.colorSuccessBg
      : isOutsourced
        ? outsourceTheme.bg
        : token.colorPrimaryBg
    const footerAccent = isCompleted
      ? token.colorSuccess
      : isOutsourced
        ? outsourceTheme.footerText
        : themeAccent
    const footerHoverBg = isCompleted
      ? token.colorSuccessBgHover
      : isOutsourced
        ? outsourceTheme.bgHover
        : token.colorPrimaryBgHover

    return (
      <React.Fragment key={operation.id || index}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: 200,
            minHeight: 200,
            flexShrink: 0,
            borderRadius: token.borderRadiusLG,
            overflow: 'hidden',
            border: isCompleted
              ? `2px solid ${token.colorSuccess}`
              : isOutsourced || isInProgress
                ? `2px solid ${isOutsourced ? outsourceTheme.border : themeAccent}`
                : `1px solid ${token.colorBorder}`,
            backgroundColor: isOutsourced && !isCompleted ? outsourceTheme.bg : token.colorBgContainer,
          }}
        >
          {/* 顶部：工序名 + 委外/状态（主题色 header） */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 6,
              padding: '6px 10px',
              flexShrink: 0,
              backgroundColor: headerBg,
              color: token.colorTextLightSolid,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                minWidth: 0,
                flex: 1,
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: token.colorTextLightSolid,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {operation.operation_name}
              </div>
              {isOutsourced ? (
                <Tag
                  style={{
                    margin: 0,
                    flexShrink: 0,
                    background: 'rgba(255,255,255,0.18)',
                    border: '1px solid rgba(255,255,255,0.32)',
                    color: token.colorTextLightSolid,
                  }}
                >
                  委外
                </Tag>
              ) : null}
            </div>
            <Tag
              style={{
                margin: 0,
                flexShrink: 0,
                background: 'rgba(255,255,255,0.18)',
                border: '1px solid rgba(255,255,255,0.32)',
                color: token.colorTextLightSolid,
              }}
            >
              {isCompleted ? '已完成' : isInProgress ? '进行中' : '待开始'}
            </Tag>
          </div>

          {/* 中部：进度与信息（参考图：环形图左、文字右） */}
          <div style={{ flex: 1, padding: '8px 10px', overflow: 'hidden', minHeight: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              {/* 左侧：环形进度（点击打开快速报工） */}
              <div
                role="button"
                tabIndex={0}
                title="点击报工"
                onClick={e => {
                  e.stopPropagation()
                  openQuickReportingFromOperationCard(operation, workOrder)
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    e.stopPropagation()
                    openQuickReportingFromOperationCard(operation, workOrder)
                  }
                }}
                style={{
                  cursor: 'pointer',
                  flexShrink: 0,
                  lineHeight: 0,
                  borderRadius: '50%',
                }}
              >
                <Progress
                  type="circle"
                  percent={progress}
                  size={56}
                  strokeColor={progressColor}
                  format={percent => `${percent}%`}
                />
              </div>
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
                              ? token.colorSuccess
                              : qualifiedRate >= 80
                                ? token.colorWarning
                                : token.colorError
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
                {!isOutsourced ? (
                  <>
                    <div style={{ marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <strong>人员: </strong>
                      {operation.assigned_worker_name || operation.assigned_team_name || '-'}
                    </div>
                    <div style={{ marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <strong>车间: </strong>
                      {operation.workshop_name || '-'}
                    </div>
                    <div style={{ marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <strong>工位: </strong>
                      {operation.assigned_station_name || '-'}
                    </div>
                    <div style={{ marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <strong>设备: </strong>
                      {operation.assigned_equipment_name || '-'}
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <strong>委外供应商: </strong>
                      {operation.outsource_supplier_name || '-'}
                    </div>
                    <div style={{ marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <strong>委外单号: </strong>
                      {operation.outsource_order_code || '-'}
                    </div>
                  </>
                )}
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

          {/* 底部：派工 / 开始（淡色主题 footer） */}
          <div
            style={{
              display: 'flex',
              flexShrink: 0,
              backgroundColor: footerBg,
              borderTop: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            <div
              onClick={() => !isCompleted && handleOpenDispatchModal(operation, workOrder)}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px 4px',
                fontSize: 13,
                fontWeight: 500,
                color: isCompleted ? token.colorTextDisabled : footerAccent,
                backgroundColor: 'transparent',
                cursor: isCompleted ? 'default' : 'pointer',
                borderRight: `1px solid ${token.colorBorderSecondary}`,
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!isCompleted) {
                  e.currentTarget.style.backgroundColor = footerHoverBg
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              <TeamOutlined style={{ marginRight: 4, fontSize: 13 }} />
              派工
            </div>
            <div
              onClick={
                operation.status === 'pending' && !isSplitParentWorkOrder(workOrder)
                  ? async () => {
                      try {
                        await workOrderApi.startOperation(
                          getWorkOrderOperationApiId(workOrder),
                          operation.id,
                        )
                        messageApi.success(t('app.kuaizhizao.workOrder.kioskOpStarted'))
                        const res = await workOrderApi.getOperations(getWorkOrderOperationApiId(workOrder), {
                          includeMeta: true,
                        })
                        const bundle = parseWorkOrderOperationsBundle(
                          res,
                          expandedWorkOrderDetailMap[workOrder.id!]?.manufacturing_mode || 'fabrication',
                        )
                        setExpandedWorkOrderDetailMap(prev => ({
                          ...prev,
                          [workOrder.id!]: { manufacturing_mode: bundle.manufacturing_mode } as WorkOrder,
                        }))
                        setExpandedOperationsMap(prev => ({
                          ...prev,
                          [workOrder.id!]: bundle.operations,
                        }))
                        queryClient.invalidateQueries({
                          queryKey: [WORK_ORDER_ROW_EXPAND_QK, workOrder.id, getWorkOrderOperationSourceId(workOrder)],
                        })
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
                fontWeight: isInProgress || operation.status === 'pending' ? 600 : 500,
                color: isCompleted
                  ? token.colorSuccess
                  : isInProgress
                    ? footerAccent
                    : operation.status === 'pending'
                      ? footerAccent
                      : token.colorTextSecondary,
                backgroundColor: 'transparent',
                cursor: operation.status === 'pending' ? 'pointer' : 'default',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => {
                if (operation.status === 'pending') {
                  e.currentTarget.style.backgroundColor = footerHoverBg
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              {operation.status === 'pending' && <PlayCircleOutlined style={{ marginRight: 4, fontSize: 13 }} />}
              {operation.status === 'pending' ? '开始' : isInProgress ? '进行中' : '已完成'}
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
   * 展开行：原有人机料法工序卡（派工 / 开始 / 环形报工）
   */
  const renderWorkOrderOperationCardsPanel = useCallback(
    (record: WorkOrder) => {
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
        return (
          <div style={{ padding: '20px', textAlign: 'center', color: token.colorTextTertiary }}>
            暂无工序信息
          </div>
        )
      }

      const manufacturingMode = (expandedWorkOrderDetailMap[record.id!]?.manufacturing_mode ||
        'fabrication') as 'fabrication' | 'assembly'
      return (
        <div className="wo-operation-cards-panel">
          <div style={{ display: 'flex', alignItems: 'stretch', flexWrap: 'wrap', gap: 8 }}>
            {operations.map((operation: any, index: number) =>
              renderOperationCard(operation, record, index, operations.length, manufacturingMode),
            )}
          </div>
        </div>
      )
    },
    [expandedOperationsMap, loadingOperationsMap, expandedWorkOrderDetailMap, token.colorTextTertiary],
  )

  /**
   * 处理批量生成二维码
   */
  const handleBatchGenerateQRCode = async () => {
    if (selectedWorkOrderIds.length === 0) {
      messageApi.warning('请先选择要生成二维码的工单')
      return
    }

    try {
      const workOrders = await Promise.all(
        selectedWorkOrderIds.map(async (id) => {
          try {
            return await workOrderApi.get(String(id))
          } catch (error) {
            console.error(`获取工单失败: ${id}`, error)
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
      setDrawerVisible(true)
      setWoTrackingRefreshKey((k) => k + 1)
      if (detail.id != null) {
        await loadWorkOrderFieldValuesForDetail(detail.id)
      }

      // 加载工单工序列表
      try {
        const operations = await workOrderApi.getOperations(record.id!.toString())
        setWorkOrderOperations(operations)
      } catch (error) {
        console.error('获取工单工序列表失败:', error)
        setWorkOrderOperations([])
      }

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

    const headerIndexMap = resolveFactoryImportHeaderIndexMap(
      headers,
      workOrderImportTemplate.importHeaderMap,
    )
    const idx = {
      code: headerIndexMap.code,
      product: headerIndexMap.product,
      qty: headerIndexMap.plannedQty,
      workshop: headerIndexMap.workshop,
    }

    if (idx.product === undefined || idx.qty === undefined) {
      messageApi.error('缺少必需列：产品编号、计划数量')
      return
    }

    const [materials, workshopsRes] = await Promise.all([
      materialApi.list({ limit: 5000, isActive: true }),
      workshopApi.list({ limit: 1000 }),
    ])
    const workshops: Workshop[] = factoryListItems(workshopsRes as any)

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

      const woCode = idx.code !== undefined ? (row[idx.code] ?? '').toString().trim() : undefined
      const workshopCode = idx.workshop !== undefined ? (row[idx.workshop] ?? '').toString().trim() : undefined
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
        title: t('app.kuaizhizao.workOrder.modalImportValidating'),
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
        title: t('app.kuaizhizao.workOrder.modalImporting'),
        concurrency: 3,
      })

      if (result.failureCount > 0) {
        Modal.warning({
          title: t('app.kuaizhizao.workOrder.modalImportPartialFail'),
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
    const workOrderIds = resolveWorkOrderIdsFromListRowKeys(keys, workOrderRowByKeyRef.current)
    if (workOrderIds.length === 0) {
      messageApi.warning('未找到可删除的工单')
      return
    }
    try {
      await Promise.all(workOrderIds.map((id) => workOrderApi.delete(String(id))))
      messageApi.success('删除成功')
      setSelectedRowKeys([])
      invalidateStatistics()
      actionRef.current?.reload()
    } catch (error: any) {
      messageApi.error(error.message || '删除失败')
    }
  }

  /**
   * 处理提交表单（创建/更新）
   */
  const handleSubmit = async (values: any): Promise<void> => {
    try {
      const { customData, standardValues } = extractWorkOrderFormValues(values)
      Object.keys(values).forEach((key) => {
        if (key.startsWith('custom_')) delete values[key]
      })
      Object.assign(values, standardValues)

      if (!isEdit && createWorkOrderMode === 'peer_group') {
        const items = (values.group_items || []).filter(
          (row: { product_id?: number }) => row?.product_id != null
        )
        if (items.length < 2) {
          messageApi.error('平级组工单至少需要 2 条有效明细')
          throw new Error('平级组工单至少需要 2 条有效明细')
        }
        const result = await workOrderApi.createPeerGroup({
          group_name: values.group_name,
          production_mode: values.sales_order_id ? 'MTO' : values.production_mode || 'MTS',
          sales_order_id: values.sales_order_id,
          planned_start_date: values.planned_start_date,
          planned_end_date: values.planned_end_date,
          items: items.map(
            (row: {
              product_id: number
              quantity: number
              priority?: string
              process_route_id?: number
              allow_operation_jump?: boolean
              over_report_mode?: string
              over_report_value?: number
            }) => ({
              product_id: Number(row.product_id),
              quantity: Number(row.quantity),
              priority: row.priority || 'normal',
              process_route_id:
                row.process_route_id != null ? Number(row.process_route_id) : undefined,
              allow_operation_jump: row.allow_operation_jump,
              over_report_mode: row.over_report_mode || 'none',
              over_report_value: Number(row.over_report_value ?? 0) || 0,
            })
          ),
        })
        messageApi.success(`已创建平级组工单：${result.group_code}`)
        setModalVisible(false)
        setCreateWorkOrderMode('normal')
        invalidateStatistics()
        actionRef.current?.reload()
        return
      }

      // 处理附件
      values.attachments = normalizeWorkOrderAttachmentsForSave(values.attachments)

      // 物料来源验证（核心功能，新增）
      if (values.product_id && selectedMaterialSourceInfo) {
        if (selectedMaterialSourceInfo.canCreateWorkOrder === false) {
          messageApi.error(t('app.kuaizhizao.workOrder.validationMaterialSourceNotAllowed'))
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
        for (const key of [
          'planned_batch_no',
          'confirmed_batch_no',
          'planned_serial_no',
          'confirmed_serial_no',
        ] as const) {
          if (key in values) {
            const trimmed = String(values[key] ?? '').trim()
            if (trimmed) values[key] = trimmed
            else delete values[key]
          }
        }
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
        if (currentWorkOrder.id != null) {
          await saveWorkOrderCustomFieldValues(currentWorkOrder.id, customData)
        }
      } else {
        if (!values.enable_production_tracking) {
          delete values.enable_production_tracking
          delete values.tracking_assign_mode
          delete values.batch_rule_id
          delete values.serial_rule_id
          delete values.planned_batch_no
          delete values.planned_serial_nos
        } else {
          const assignMode = values.tracking_assign_mode as string | undefined
          if (assignMode === 'batch') {
            delete values.planned_serial_nos
            delete values.serial_rule_id
          } else if (assignMode === 'serial') {
            delete values.planned_batch_no
            delete values.batch_rule_id
          }
        }
        if (Array.isArray(values.planned_serial_nos)) {
          values.planned_serial_nos = values.planned_serial_nos
            .map((s: string) => String(s).trim())
            .filter(Boolean)
          if (!values.planned_serial_nos.length) {
            delete values.planned_serial_nos
          }
        }
        const created = await workOrderApi.create(values)
        const childHint =
          created?.serial_split_child_count && created.serial_split_child_count > 0
            ? `，已按序列号拆分为 ${created.serial_split_child_count} 张子工单`
            : ''
        messageApi.success(`工单创建成功！系统已自动匹配工艺路线并生成工序单${childHint}`)
        if (created?.id != null) {
          await saveWorkOrderCustomFieldValues(created.id, customData)
        }
      }
      setModalVisible(false)
      resetWorkOrderFormFieldValues()
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
      title: t('app.kuaizhizao.workOrder.colCode'),
      dataIndex: 'code',
    },
    {
      title: t('app.kuaizhizao.workOrder.colName'),
      dataIndex: 'name',
    },
    {
      title: t('app.kuaizhizao.workOrder.colProductCode'),
      dataIndex: 'product_code',
    },
    {
      title: '产品名称',
      dataIndex: 'product_name',
    },
    {
      title: t('app.kuaizhizao.workOrder.colPlannedQty'),
      dataIndex: 'quantity',
    },
    {
      title: t('app.kuaizhizao.workOrder.colBatchNo'),
      dataIndex: 'effective_batch_no',
      render: (_, record) => record.effective_batch_no || record.planned_batch_no || '-',
    },
    {
      title: t('app.kuaizhizao.workOrder.colSerialNo'),
      dataIndex: 'effective_serial_no',
      render: (_, record) => record.effective_serial_no || record.planned_serial_no || '-',
    },
    {
      title: t('app.kuaizhizao.workOrder.colProductionMode'),
      dataIndex: 'production_mode',
      render: (_, record) => (
        <Tag color={record.production_mode === 'MTO' ? 'blue' : 'green'}>
          {record.production_mode === 'MTO' ? '按订单生产' : '按库存生产'}
        </Tag>
      ),
    },
    {
      title: t('app.kuaizhizao.workOrder.colManufacturingMode'),
      dataIndex: 'manufacturing_mode',
      render: (_, record) => manufacturingModeTag(record.manufacturing_mode),
    },
    {
      title: t('app.kuaizhizao.workOrder.colSalesOrder'),
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
            {isOverdue && <Tag color="error">{t('app.kuaizhizao.workOrder.tagOverdue')}</Tag>}
          </Space>
        )
      },
    },
    {
      title: t('app.kuaizhizao.workOrder.colPriority'),
      dataIndex: 'priority',
      render: (_, record) => {
        const config = WORK_ORDER_PRIORITY_MAP[record.priority || 'normal'] || {
          text: record.priority || '正常',
          color: 'blue',
        }
        return <Tag color={config.color}>{config.text}</Tag>
      },
    },
    {
      title: t('app.kuaizhizao.workOrder.colPlannedStart'),
      dataIndex: 'planned_start_date',
      valueType: 'dateTime',
    },
    {
      title: t('app.kuaizhizao.workOrder.colPlannedEnd'),
      dataIndex: 'planned_end_date',
      valueType: 'dateTime',
    },
    {
      title: '实际开始时间',
      dataIndex: 'actual_start_date',
      render: (_, record) =>
        record.actual_start_date
          ? formatDateTime(record.actual_start_date, 'YYYY-MM-DD HH:mm:ss')
          : '-',
    },
    {
      title: '实际结束时间',
      dataIndex: 'actual_end_date',
      render: (_, record) =>
        record.actual_end_date ? formatDateTime(record.actual_end_date, 'YYYY-MM-DD HH:mm:ss') : '-',
    },
    {
      title: t('app.kuaizhizao.workOrder.colCompletedQty'),
      dataIndex: 'completed_quantity',
      render: text => text || 0,
    },
    {
      title: t('app.kuaizhizao.workOrder.colQualifiedQty'),
      dataIndex: 'qualified_quantity',
      render: text => text || 0,
    },
    {
      title: t('app.kuaizhizao.workOrder.colUnqualifiedQty'),
      dataIndex: 'unqualified_quantity',
      render: text => text || 0,
    },
    {
      title: t('app.kuaizhizao.workOrder.colRemarks'),
      dataIndex: 'remarks',
      span: 2,
      render: text => text || '-',
    },
    {
      title: t('app.kuaizhizao.workOrder.colAttachments'),
      dataIndex: 'attachments',
      span: 2,
      render: (_, record) => {
        const files = mapWorkOrderAttachmentsToUploadList(record.attachments)
        if (!files.length) return '-'
        return (
          <Space wrap size={[8, 4]}>
            {files.map((file, index) =>
              file.url ? (
                <Typography.Link key={`${file.uid || file.name || 'attachment'}-${index}`} href={file.url} target="_blank">
                  {file.name || `附件${index + 1}`}
                </Typography.Link>
              ) : (
                <span key={`${file.uid || file.name || 'attachment'}-${index}`}>{file.name || `附件${index + 1}`}</span>
              )
            )}
          </Space>
        )
      },
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
    if (selectedWorkOrderIds.length === 0) {
      messageApi.warning('请至少选择一个工单')
      return
    }

    setBatchReleaseLoading(true)
    setBatchReleaseModalVisible(true)

    try {
      const workOrders = await Promise.all(
        selectedWorkOrderIds.map((id) => workOrderApi.get(String(id)))
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
      const idsToRelease = ignoreErrors
        ? selectedWorkOrderIds
        : batchReleaseCheckResults
            .filter(result => result.passed)
            .map(result => result.workOrder.id)

      if (idsToRelease.length === 0) {
        messageApi.warning('没有可下达的工单')
        return
      }

      // 确认对话框（优化，新增）
      Modal.confirm({
        title: t('app.kuaizhizao.workOrder.modalConfirmBatchRelease'),
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
      title: t('app.kuaizhizao.workOrder.actionSmartRelease'),
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
      title: t('app.kuaizhizao.workOrder.modalConfirmRevoke'),
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
    const needsTracking =
      record.tracking_mode && record.tracking_mode !== 'none' && record.status !== 'split'
    if (needsTracking) {
      try {
        const detail = await workOrderApi.get(record.id!.toString())
        setCompleteTrackingWorkOrder(detail)
        setCompleteTrackingModalOpen(true)
      } catch (error: any) {
        messageApi.error(error.message || '获取工单详情失败')
      }
      return
    }
    Modal.confirm({
      title: t('app.kuaizhizao.workOrder.modalConfirmComplete'),
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

  const handleConfirmCompleteTracking = async (values: WorkOrderTrackingConfirmValues) => {
    if (!completeTrackingWorkOrder?.id) return
    setCompleteTrackingLoading(true)
    try {
      await workOrderApi.complete(completeTrackingWorkOrder.id.toString(), {
        confirmed_batch_no: values.confirmed_batch_no?.trim() || undefined,
        confirmed_serial_no: values.confirmed_serial_no?.trim() || undefined,
      })
      messageApi.success('工单已指定结束')
      setCompleteTrackingModalOpen(false)
      setCompleteTrackingWorkOrder(null)
      invalidateStatistics()
      actionRef.current?.reload()
    } catch (error: any) {
      messageApi.error(error.message || '指定结束失败')
    } finally {
      setCompleteTrackingLoading(false)
    }
  }

  /**
   * 处理创建返工单
   */
  const handleCreateRework = async (record: WorkOrder) => {
    try {
      const detail = await workOrderApi.get(record.id!.toString())
      const operations = await workOrderApi.getOperations(record.id!.toString())
      setReworkModalOperations(operations || [])

      const existingReworkQty = (record.children || [])
        .filter((child) => child.row_kind === 'rework' && child.status !== 'cancelled')
        .reduce((sum, child) => sum + Number(child.quantity || 0), 0)
      const woQty = Number(detail.quantity || 0)
      setReworkableQuantity(Math.max(0, woQty - existingReworkQty))

      setCurrentWorkOrderForRework(detail)
      setReworkModalVisible(true)
    } catch (error) {
      messageApi.error('获取工单详情失败')
    }
  }

  /**
   * 处理提交返工单表单
   */
  const handleSubmitRework = async (values: any): Promise<void> => {
    setReworkSubmitLoading(true)
    try {
      if (!currentWorkOrderForRework?.id) {
        throw new Error('原工单信息不存在')
      }

      const qty = Number(values.quantity)
      if (!Number.isFinite(qty) || qty <= 0) {
        throw new Error('返工数量必须大于 0')
      }
      if (qty > reworkableQuantity) {
        throw new Error(`返工数量不能超过可返工数量（${reworkableQuantity}）`)
      }

      const submitData = {
        rework_reason: values.rework_reason,
        rework_type: values.rework_type,
        quantity: qty,
        route_id: values.route_id || undefined,
        work_center_id:
          values.work_center_id || currentWorkOrderForRework.work_center_id || undefined,
        start_work_order_operation_id: values.start_work_order_operation_id || undefined,
        planned_start_date: toApiDateTimeString(values.planned_start_date),
        planned_end_date: toApiDateTimeString(values.planned_end_date),
        remarks: values.remarks || undefined,
      }
      await reworkOrderApi.createFromWorkOrder(currentWorkOrderForRework.id.toString(), submitData)
      messageApi.success('返工单创建成功')
      setReworkModalVisible(false)
      setCurrentWorkOrderForRework(null)
      setReworkModalOperations([])
      setReworkableQuantity(0)
      reworkFormRef.current?.resetFields()
      actionRef.current?.reload()
    } catch (error: any) {
      messageApi.error(error.message || '创建返工单失败')
      throw error
    } finally {
      setReworkSubmitLoading(false)
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
        const suppliers = unwrapSupplyPagedList(await supplierApi.list({ isActive: true }))
        setSupplierList(suppliers || [])
      } catch (error) {
        console.error('加载供应商列表失败:', error)
        setSupplierList([])
      }

      const [operations, outsourceOptions] = await Promise.all([
        workOrderApi.getOperations(record.id!.toString()),
        outsourceOrderApi.getOutsourceOptions(record.id!.toString()),
      ])
      setWorkOrderOperations(operations)
      const optionMap: Record<number, { outsourceable_quantity: number }> = {}
      for (const opt of Array.isArray(outsourceOptions) ? outsourceOptions : []) {
        if (opt?.work_order_operation_id != null) {
          optionMap[Number(opt.work_order_operation_id)] = {
            outsourceable_quantity: Number(opt.outsourceable_quantity ?? 0),
          }
        }
      }
      setOutsourceOptionsByOpId(optionMap)

      setOutsourceModalVisible(true)
      setTimeout(() => {
        outsourceFormRef.current?.resetFields()
      }, 100)
    } catch (error) {
      messageApi.error('获取工单详情失败')
    }
  }

  /**
   * 通知入库（从工单下推创建待入库单）
   */
  const handleNotifyInbound = async (record: WorkOrder) => {
    if (!record.id) return
    Modal.confirm({
      title: t('app.kuaizhizao.workOrder.actionNotifyInbound'),
      content: `确认通知工单「${record.code || record.id}」入库吗？`,
      onOk: async () => {
        try {
          await warehouseApi.finishedGoodsReceipt.batchReceipt({
            work_order_ids: [record.id],
          })
          messageApi.success('已通知入库')
          actionRef.current?.reload()
        } catch (error: any) {
          messageApi.error(error?.message || '通知入库失败')
        }
      },
    })
  }

  const handlePushToProductionReturnInbound = (record: WorkOrder) => {
    if (!record.id) return
    navigate(inboundProductionReturnEntryPath(record.id))
  }

  const handlePushToFinishedGoodsInbound = (record: WorkOrder) => {
    if (!record.id) return
    navigate(inboundWorkOrderEntryPath(record.id))
  }

  const handlePushToProductionPickingOutbound = (record: WorkOrder) => {
    if (!record.id) return
    navigate(outboundWorkOrderEntryPath(record.id))
  }

  const selectedWorkOrderForToolbarPush = useMemo(() => {
    if (selectedRowKeys.length !== 1) return null
    const row = workOrderRowByKeyRef.current.get(String(selectedRowKeys[0]))
    if (!row || (row.row_kind ?? 'work_order') !== 'work_order') return null
    return row
  }, [selectedRowKeys, workOrderListRowIndexVersion])

  const toolbarPushMenuItems = useMemo(() => {
    if (!selectedWorkOrderForToolbarPush?.id) return []
    const rawStatus = String(selectedWorkOrderForToolbarPush.status ?? '').trim()
    const canPushOutbound = ['released', '已下达', 'in_progress', '执行中'].includes(rawStatus)
    const canPushInbound = ['completed', '已完成'].includes(rawStatus)
    return buildUniPushMenuItems([
      {
        key: 'push-production-picking-outbound',
        label: pushToOutboundAction.label,
        disabled: !canPushOutbound,
        title: canPushOutbound ? undefined : '仅“已下达 / 执行中”工单可下推领料出库',
        onClick: () => handlePushToProductionPickingOutbound(selectedWorkOrderForToolbarPush),
      },
      {
        key: 'push-finished-goods-inbound',
        label: pushToInboundAction.label,
        disabled: !canPushInbound,
        title: canPushInbound ? undefined : '仅“已完成”工单可下推成品入库',
        onClick: () => handlePushToFinishedGoodsInbound(selectedWorkOrderForToolbarPush),
      },
      {
        key: 'push-production-return-inbound',
        label: pushToProductionReturnInboundAction.label,
        disabled: !canPushInbound,
        title: canPushInbound ? undefined : '仅“已完成”工单可下推生产退料',
        onClick: () => handlePushToProductionReturnInbound(selectedWorkOrderForToolbarPush),
      },
    ])
  }, [
    selectedWorkOrderForToolbarPush,
    pushToOutboundAction.label,
    pushToInboundAction.label,
    pushToProductionReturnInboundAction.label,
  ])

  const canUseToolbarPush = useMemo(
    () =>
      toolbarPushMenuItems.some(
        (item) =>
          !!item &&
          typeof item === 'object' &&
          (item as { type?: string }).type !== 'divider' &&
          (item as { disabled?: boolean }).disabled !== true,
      ),
    [toolbarPushMenuItems],
  )

  const toolbarPushDisabledReason = useMemo(() => {
    if (selectedRowKeys.length === 0) return '请先选择一条工单'
    if (selectedRowKeys.length !== 1) return '下推仅支持单条工单，请仅保留一条选中记录'
    if (!selectedWorkOrderForToolbarPush) return '当前选中行不是可下推的工单记录'
    if (!canUseToolbarPush) return '当前工单状态暂无可用下推操作'
    return undefined
  }, [canUseToolbarPush, selectedRowKeys.length, selectedWorkOrderForToolbarPush])

  /**
   * 处理提交工序委外表单
   */
  const handleSubmitOutsource = async (values: any): Promise<void> => {
    try {
      if (!currentWorkOrderForOutsource?.id) {
        throw new Error('工单信息不存在')
      }

      const selectedOpId = Number(values.work_order_operation_id)
      const maxOutsourceQty = outsourceOptionsByOpId[selectedOpId]?.outsourceable_quantity ?? 0
      const outsourceQty = Number(values.outsource_quantity)
      if (!Number.isFinite(outsourceQty) || outsourceQty <= 0) {
        throw new Error('委外数量必须大于 0')
      }
      if (outsourceQty > maxOutsourceQty) {
        throw new Error(`委外数量不能超过可委外数量（${maxOutsourceQty}）`)
      }

      const submitData = {
        work_order_operation_id: values.work_order_operation_id,
        supplier_id: values.supplier_id,
        outsource_quantity: values.outsource_quantity,
        unit_price: values.unit_price,
        planned_start_date: toApiDateTimeString(values.planned_start_date),
        planned_end_date: toApiDateTimeString(values.planned_end_date),
        remarks: values.remarks,
      }

      await outsourceOrderApi.createFromWorkOrder(
        currentWorkOrderForOutsource.id.toString(),
        submitData
      )
      messageApi.success('工序委外创建成功')
      setOutsourceModalVisible(false)
      setCurrentWorkOrderForOutsource(null)
      setOutsourceOptionsByOpId({})
      outsourceFormRef.current?.resetFields()
      actionRef.current?.reload()
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
      title: t('app.kuaizhizao.workOrder.modalConfirmUnfreeze'),
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
            setWoTrackingRefreshKey(k => k + 1)
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
    if (selectedWorkOrderIds.length === 0) {
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

    if (selectedWorkOrderIds.length === 0) {
      messageApi.warning('未找到可冻结的工单')
      return
    }

    try {
      await Promise.all(
        selectedWorkOrderIds.map((id) =>
          workOrderApi.freeze(String(id), { freeze_reason: batchFreezeReason })
        )
      )
      messageApi.success(`已批量冻结 ${selectedWorkOrderIds.length} 个工单`)
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
    if (selectedWorkOrderIds.length === 0) {
      messageApi.warning('请至少选择一个工单')
      return
    }

    Modal.confirm({
      title: t('app.kuaizhizao.workOrder.modalConfirmBatchCancel'),
      content: `确定要取消 ${selectedWorkOrderIds.length} 个工单吗？`,
      onOk: async () => {
        try {
          await Promise.all(
            selectedWorkOrderIds.map((id) =>
              workOrderApi.update(String(id), { status: 'cancelled' })
            )
          )
          messageApi.success(`已批量取消 ${selectedWorkOrderIds.length} 个工单`)
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
        setWoTrackingRefreshKey(k => k + 1)
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
        setWoTrackingRefreshKey(k => k + 1)
      }
    } catch (error: any) {
      messageApi.error(error.message || '优先级设置失败')
    }
  }

  /**
   * 处理批量设置优先级
   */
  const handleBatchSetPriority = () => {
    if (selectedWorkOrderIds.length === 0) {
      messageApi.warning('请至少选择一个工单')
      return
    }
    setBatchPriority('normal')
    setBatchPriorityModalVisible(true)
  }

  /**
   * 处理提交批量设置优先级
   */
  const handleSubmitBatchPriority = async () => {
    if (selectedWorkOrderIds.length === 0) {
      messageApi.warning('未找到可设置优先级的工单')
      return
    }

    try {
      await workOrderApi.batchSetPriority({
        work_order_ids: selectedWorkOrderIds,
        priority: batchPriority,
      })
      messageApi.success(`已批量设置 ${selectedWorkOrderIds.length} 个工单的优先级`)
      setBatchPriorityModalVisible(false)
      setSelectedRowKeys([])
      invalidateStatistics(); actionRef.current?.reload()
    } catch (error: any) {
      messageApi.error(error.message || '批量设置优先级失败')
    }
  }

  /**
   * 提交合并为组工单（默认虚拟组根，成员平级）
   */
  const handleSubmitMerge = async (values: any): Promise<void> => {
    setMergeLoading(true)
    try {
      const result = await workOrderApi.mergeIntoGroup({
        work_order_ids: mergeTargetWorkOrderIds,
        remarks: values.remarks,
      })
      messageApi.success(`已合并为组工单：${result.group_code}`)
      setMergeModalVisible(false)
      setMergeTargetWorkOrderIds([])
      mergeFormRef.current?.resetFields()
      setSelectedRowKeys([])
      invalidateStatistics()
      actionRef.current?.reload()
    } catch (error: any) {
      messageApi.error(error.message || '合并为组工单失败')
      throw error
    } finally {
      setMergeLoading(false)
    }
  }

  const formatDissolveGroupLabels = useCallback((groupIds: number[]) => {
    const map = workOrderRowByKeyRef.current
    return groupIds
      .map((gid) => {
        const row = map.get(`work_order_group-${gid}`)
        const code = row?.group_code ?? `ID ${gid}`
        const title = String(row?.product_name ?? row?.group_name ?? '').trim()
        return title ? `${title}（${code}）` : code
      })
      .join('、')
  }, [])

  /**
   * 解除编组：组内工单保留，仅取消组展示关系
   */
  const handleDissolveGroups = useCallback(
    (groupIds: number[]) => {
      const uniqueIds = [...new Set(groupIds.filter((id) => id > 0))]
      if (uniqueIds.length === 0) {
        messageApi.warning('请选择工单组行，或勾选组内主工单')
        return
      }
      const label = formatDissolveGroupLabels(uniqueIds)
      Modal.confirm({
        title: t('app.kuaizhizao.workOrder.actionDissolveGroup'),
        content: (
          <div>
            <p>
              将解除以下工单组的编组关系，组内各张工单恢复为独立工单单独展示；工单本身不会被删除或取消。
            </p>
            <p>
              <strong>{label}</strong>
            </p>
            <p>确定继续？</p>
          </div>
        ),
        okText: t('app.kuaizhizao.workOrder.actionDissolveGroup'),
        okType: 'danger',
        cancelText: '取消',
        onOk: async () => {
          setDissolveGroupLoading(true)
          try {
            const result = await workOrderApi.dissolveGroup({
              work_order_group_ids: uniqueIds,
            })
            const codes = result.groups.map((g) => g.group_code).join('、')
            messageApi.success(
              result.groups.length > 1
                ? `已解除编组 ${result.groups.length} 个工单组：${codes}`
                : `已解除编组：${codes}`
            )
            setWorkOrderTreeExpandedRowKeys((prev) =>
              prev.filter((k) => !uniqueIds.some((gid) => k === `work_order_group-${gid}`))
            )
            setSelectedRowKeys([])
            invalidateStatistics()
            actionRef.current?.reload()
          } catch (error: any) {
            messageApi.error(error.message || '解除编组失败')
            throw error
          } finally {
            setDissolveGroupLoading(false)
          }
        },
      })
    },
    [formatDissolveGroupLabels, messageApi]
  )

  const dissolvableWorkOrderGroupIds = useMemo(
    () =>
      resolveDissolvableWorkOrderGroupIdsFromRowKeys(
        selectedRowKeys,
        workOrderRowByKeyRef.current
      ),
    [selectedRowKeys, workOrderListRowIndexVersion]
  )

  const mergeableWorkOrderIds = useMemo(
    () =>
      resolveMergeableWorkOrderIdsFromRowKeys(
        selectedRowKeys,
        workOrderRowByKeyRef.current
      ),
    [selectedRowKeys, workOrderListRowIndexVersion]
  )

  const workOrderToolBarActionsAfterDelete = useMemo(
    () => [
      ...(selectedRowKeys.length > 0
        ? [
            <UniBatchButton
              key="merge-into-group"
              selectedRowKeys={selectedRowKeys}
              size="middle"
              icon={<GroupOutlined />}
              disabled={mergeableWorkOrderIds.length < 2}
              onAction={(keys) => {
                const ids = resolveMergeableWorkOrderIdsFromRowKeys(
                  keys,
                  workOrderRowByKeyRef.current
                )
                if (ids.length < 2) {
                  messageApi.warning('请至少选择 2 张主工单（不含拆分子行、工单组行）')
                  return
                }
                setMergeTargetWorkOrderIds(ids)
                setMergeModalVisible(true)
              }}
            >
              {t('app.kuaizhizao.workOrder.actionMergeIntoGroup')}
            </UniBatchButton>,
          ]
        : []),
      ...(dissolvableWorkOrderGroupIds.length > 0
        ? [
            <UniBatchButton
              key="dissolve-group"
              selectedRowKeys={selectedRowKeys}
              size="middle"
              icon={<DisconnectOutlined />}
              loading={dissolveGroupLoading}
              onAction={(keys) =>
                handleDissolveGroups(
                  resolveDissolvableWorkOrderGroupIdsFromRowKeys(
                    keys,
                    workOrderRowByKeyRef.current
                  )
                )
              }
            >
              {t('app.kuaizhizao.workOrder.actionDissolveGroup')}
            </UniBatchButton>,
          ]
        : []),
      <UniBatchMenuButton
        key="work-order-batch-more-actions"
        selectedRowKeys={selectedRowKeys}
        toolBarButtonSize="middle"
        menuItems={[
          {
            key: 'batch-qrcode',
            label: t('app.kuaizhizao.workOrder.batchGenerateQrcode'),
            icon: <QrcodeOutlined />,
            disabled:
              selectedWorkOrdersForBatch.length > 0 &&
              !workOrderBatchPrintAllowed(selectedWorkOrdersForBatch, workOrderPerms.canPrint),
            onClick: () => void handleBatchGenerateQRCode(),
          },
          {
            key: 'batch-set-priority',
            label: t('app.kuaizhizao.workOrder.batchSetPriority'),
            icon: <FlagOutlined />,
            disabled:
              selectedWorkOrdersForBatch.length > 0 &&
              !workOrderBatchSetPriorityAllowed(selectedWorkOrdersForBatch, workOrderPerms.canUpdate),
            onClick: () => handleBatchSetPriority(),
          },
          {
            key: 'batch-freeze',
            label: t('app.kuaizhizao.workOrder.batchFreeze'),
            icon: <LockOutlined />,
            disabled:
              selectedWorkOrdersForBatch.length > 0 &&
              !workOrderBatchFreezeAllowed(
                selectedWorkOrdersForBatch,
                workOrderPerms.canAction?.('revoke') ?? false,
              ),
            onClick: () => handleBatchFreeze(),
          },
          {
            key: 'batch-cancel',
            label: t('app.kuaizhizao.workOrder.batchCancel'),
            icon: <CloseCircleOutlined />,
            disabled:
              selectedWorkOrdersForBatch.length > 0 &&
              !workOrderBatchCancelAllowed(selectedWorkOrdersForBatch, workOrderPerms.canUpdate),
            onClick: () => void handleBatchCancel(),
          },
        ]}
      />,
      <UniBatchButton
        key="batch-release"
        selectedRowKeys={selectedRowKeys}
        type="primary"
        size="middle"
        icon={<SendOutlined />}
        disabled={
          selectedWorkOrdersForBatch.length > 0 &&
          !workOrderBatchReleaseAllowed(
            selectedWorkOrdersForBatch,
            workOrderPerms.canAction?.('submit') ?? false,
          )
        }
        onAction={() => void handleBatchRelease()}
      >
        {t('app.kuaizhizao.workOrder.actionBatchRelease')}
      </UniBatchButton>,
    ],
    [
      selectedRowKeys,
      selectedWorkOrdersForBatch,
      mergeableWorkOrderIds,
      dissolvableWorkOrderGroupIds,
      dissolveGroupLoading,
      workOrderPerms,
      handleDissolveGroups,
      handleBatchGenerateQRCode,
      handleBatchSetPriority,
      handleBatchFreeze,
      handleBatchCancel,
      handleBatchRelease,
      messageApi,
      t,
    ],
  )

  /**
   * 处理拆分工单
   */
  const handleSplit = async (record: WorkOrder) => {
    try {
      const detail = await workOrderApi.get(record.id!.toString())
      setCurrentWorkOrderForSplit(detail)
      const isFollowUpSplit = ['split', '已拆分'].includes(detail.status || '')
      if (isFollowUpSplit) {
        const remaining = Number(detail.split_remaining_quantity ?? 0)
        setSplitType('quantity')
        setSplitCount(1)
        setSplitQuantities(remaining > 0 ? [remaining] : [0])
      } else {
        setSplitType('count')
        setSplitCount(2)
        setSplitQuantities([])
      }
      setSplitModalVisible(true)
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
                  <Tag color="error">{t('app.kuaizhizao.workOrder.tagOverdue')}</Tag>
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
        title: t('app.kuaizhizao.workOrder.colProductWorkOrder'),
        dataIndex: 'title',
        key: 'title',
        width: 180,
        render: (_: any, record: any) =>
          record.isParent ? (
            <strong>{record.product_name}</strong>
          ) : (
            <WorkOrderTreeProductCodeCell record={record} />
          ),
      },
      {
        title: t('app.kuaizhizao.workOrder.colQuantity'),
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
        title: t('app.kuaizhizao.workOrder.colMode'),
        key: 'productionManufacturingMode',
        dataIndex: 'production_mode',
        width: 120,
        render: (_: any, r: any) => (r.isParent ? null : renderProductionManufacturingStacked(r)),
      },
      {
        title: t('app.kuaizhizao.workOrder.colSalesOrder'),
        dataIndex: 'sales_order_code',
        key: 'sales_order_code',
        width: 130,
        render: (_: any, record: any) =>
          record.isParent ? null : (
            record.production_mode === 'MTO' ? <Tag color="blue">{record.sales_order_code || '-'}</Tag> : <span style={{ color: '#999' }}>{t('app.kuaizhizao.workOrder.none')}</span>
          ),
      },
      {
        title: t('app.kuaizhizao.workOrder.colWorkshop'),
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
              {isOverdue && <Tag color="error">{t('app.kuaizhizao.workOrder.tagOverdue')}</Tag>}
              {record.is_frozen && <Tag color="warning">{t('app.kuaizhizao.workOrder.tagFrozen')}</Tag>}
            </Space>
          )
        },
      },
      {
        title: t('app.kuaizhizao.workOrder.colPlannedStartSearch'),
        dataIndex: 'planned_start_date',
        key: 'planned_start_date',
        width: 110,
        render: (_: any, record: any) => (record.isParent ? null : (record.planned_start_date ? formatDateTime(record.planned_start_date, 'YYYY-MM-DD') : '-')),
      },
      {
        title: t('app.kuaizhizao.workOrder.colPlannedEndSearch'),
        dataIndex: 'planned_end_date',
        key: 'planned_end_date',
        width: 110,
        render: (_: any, record: any) => (record.isParent ? null : (record.planned_end_date ? formatDateTime(record.planned_end_date, 'YYYY-MM-DD') : '-')),
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
        title: t('app.kuaizhizao.workOrder.colSalesOrderWorkOrder'),
        dataIndex: 'title',
        key: 'title',
        width: 180,
        render: (_: any, record: any) =>
          record.isParent ? (
            <strong>{record.title}</strong>
          ) : (
            <WorkOrderTreeProductCodeCell record={record} />
          ),
      },
      {
        title: t('app.kuaizhizao.workOrder.colQuantity'),
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
        title: t('app.kuaizhizao.workOrder.colMode'),
        key: 'productionManufacturingMode',
        dataIndex: 'production_mode',
        width: 120,
        render: (_: any, r: any) => (r.isParent ? null : renderProductionManufacturingStacked(r)),
      },
      {
        title: t('app.kuaizhizao.workOrder.colWorkshop'),
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
              {isOverdue && <Tag color="error">{t('app.kuaizhizao.workOrder.tagOverdue')}</Tag>}
              {record.is_frozen && <Tag color="warning">{t('app.kuaizhizao.workOrder.tagFrozen')}</Tag>}
            </Space>
          )
        },
      },
      {
        title: t('app.kuaizhizao.workOrder.colPlannedStartSearch'),
        dataIndex: 'planned_start_date',
        key: 'planned_start_date',
        width: 110,
        render: (_: any, record: any) => (record.isParent ? null : (record.planned_start_date ? formatDateTime(record.planned_start_date, 'YYYY-MM-DD') : '-')),
      },
      {
        title: t('app.kuaizhizao.workOrder.colPlannedEndSearch'),
        dataIndex: 'planned_end_date',
        key: 'planned_end_date',
        width: 110,
        render: (_: any, record: any) => (record.isParent ? null : (record.planned_end_date ? formatDateTime(record.planned_end_date, 'YYYY-MM-DD') : '-')),
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
  const workOrderCustomFieldColumns = generateWorkOrderCustomFieldColumns()
  const columns = useMemo<ProColumns<WorkOrder>[]>(() => [
    {
      title: t('app.kuaizhizao.workOrder.colProductWorkOrderCode'),
      key: 'code',
      dataIndex: 'code',
      ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
      minWidth: 168,
      uniTablePrimaryFlex: false,
      fixed: 'left',
      sorter: true,
      hideInSearch: false,
      render: (_, record) => <WorkOrderListPrimaryCell record={record} />,
    },
    {
      title: t('app.kuaizhizao.workOrder.colCode'),
      dataIndex: 'code',
      hideInTable: true,
      sorter: true,
      hideInSearch: false,
    },
    {
      title: t('app.kuaizhizao.workOrder.colName'),
      dataIndex: 'name',
      hideInTable: true,
      sorter: true,
      hideInSearch: false,
      ellipsis: true,
    },
    {
      title: t('app.kuaizhizao.workOrder.colProduct'),
      dataIndex: 'product_name',
      hideInTable: true,
      sorter: true,
      hideInSearch: false,
      ellipsis: true,
    },
    {
      title: t('app.kuaizhizao.workOrder.colProductCode'),
      dataIndex: 'product_code',
      hideInTable: true,
      hideInSearch: false,
    },
    {
      title: t('app.kuaizhizao.workOrder.colGroup'),
      dataIndex: 'group_code',
      width: 120,
      ellipsis: true,
      hideInTable: true,
      hideInSearch: false,
      render: (_, record) => record.group_code || <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: t('app.kuaizhizao.workOrder.colQuantity'),
      dataIndex: 'quantity',
      width: 88,
      align: 'right',
      uniTableKeepWidth: true,
      sorter: true,
      render: (_, record) =>
        isWorkOrderGroupListRow(record) ? (
          <Typography.Text type="secondary">—</Typography.Text>
        ) : (
          formatWorkOrderListQuantity(record)
        ),
    },
    {
      title: t('app.kuaizhizao.workOrder.colBatchSerial'),
      key: 'production_batch_serial',
      dataIndex: 'effective_batch_no',
      width: 168,
      uniTableKeepWidth: true,
      hideInSearch: true,
      render: (_, record) => {
        if (isWorkOrderGroupListRow(record)) {
          return <Typography.Text type="secondary">—</Typography.Text>
        }
        const rowKind = record.row_kind || 'work_order'
        if (rowKind === 'rework' || rowKind === 'outsource') {
          return <Typography.Text type="secondary">—</Typography.Text>
        }
        const batchNo = record.effective_batch_no || record.confirmed_batch_no || record.planned_batch_no || '-'
        const serialNo = record.effective_serial_no || record.confirmed_serial_no || record.planned_serial_no || '-'
        return (
          <UniTableStackedPrimaryCell
            primary={batchNo}
            secondary={serialNo}
            secondaryCopyable={serialNo !== '-'}
            primaryExtra={null}
          />
        )
      },
    },
      {
        title: t('app.kuaizhizao.workOrder.colMode'),
        key: 'productionManufacturingMode',
        dataIndex: 'production_mode',
        width: 96,
        uniTableKeepWidth: true,
        hideInSearch: true,
        render: (_, record) => {
        if (isWorkOrderGroupListRow(record)) {
          return <Typography.Text type="secondary">—</Typography.Text>
        }
        const kind = record.row_kind || 'work_order'
        if (kind === 'rework' || kind === 'outsource') {
          return <Typography.Text type="secondary">—</Typography.Text>
        }
        return renderProductionManufacturingStacked(record)
      },
      },
      {
        title: t('app.kuaizhizao.workOrder.colProductionMode'),
        dataIndex: 'production_mode',
        hideInTable: true,
        width: 132,
        valueEnum: {
          MTS: { text: t('app.kuaizhizao.workOrder.productionModeMTS'), status: 'processing' },
          MTO: { text: t('app.kuaizhizao.workOrder.productionModeMTO'), status: 'success' },
        },
        hideInSearch: false,
      },
      {
        title: t('app.kuaizhizao.workOrder.colManufacturingMode'),
        dataIndex: 'manufacturing_mode',
        hideInTable: true,
        width: 100,
        hideInSearch: false,
        valueEnum: {
          fabrication: { text: t('app.kuaizhizao.workOrder.manufacturingModeFabrication'), status: 'processing' },
          assembly: { text: t('app.kuaizhizao.workOrder.manufacturingModeAssembly'), status: 'success' },
        },
      },
    {
      title: t('app.kuaizhizao.workOrder.colReadiness'),
      dataIndex: 'readiness_rate',
      width: 64,
      align: 'center',
      uniTableKeepWidth: true,
      valueType: 'digit',
      render: (_text, record) => {
        if (isWorkOrderGroupListRow(record)) {
          return <Typography.Text type="secondary">—</Typography.Text>
        }
        const kind = record.row_kind || 'work_order'
        if (kind === 'rework' || kind === 'outsource') {
          return <Typography.Text type="secondary">—</Typography.Text>
        }
        const wid = record.id
        const rate =
          record.readiness_rate != null && !Number.isNaN(Number(record.readiness_rate))
            ? Number(record.readiness_rate)
            : null
        let inner: React.ReactNode
        if (rate == null) {
          inner = <Typography.Text type="secondary">—</Typography.Text>
        } else {
          inner = renderWorkOrderReadinessRing(rate)
        }
        if (wid == null) return inner
        return (
          <WorkOrderReadinessPopover workOrderId={wid} workOrderCode={record.code}>
            {inner}
          </WorkOrderReadinessPopover>
        )
      },
      fieldProps: {
        placeholder: t('app.kuaizhizao.workOrder.formReadinessPlaceholder'),
        min: 0,
        max: 100,
      },
      sorter: true,
      hideInSearch: false,
    },
    {
      title: t('app.kuaizhizao.workOrder.colOperations'),
      key: 'operation_steps',
      dataIndex: 'operation_steps',
      minWidth: 240,
      uniTablePrimaryFlex: true,
      hideInSearch: true,
      render: (_, record) => {
        if (isWorkOrderGroupListRow(record)) {
          return <Typography.Text type="secondary">—</Typography.Text>
        }
        const kind = record.row_kind || 'work_order'
        if (kind === 'rework' || kind === 'outsource' || record.id == null) {
          return <Typography.Text type="secondary">—</Typography.Text>
        }
        const steps = resolveWorkOrderOperationSteps(record, workOrderRowByKeyRef.current)
        const expandable = canExpandWorkOrderOperationPanel(record)
        const rowKey = getWorkOrderListRowKey(record)
        const expanded = operationExpandedRowKeys.includes(rowKey)
        const inner = steps?.length ? (
          <WorkOrderOperationStepsStrip steps={steps} />
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        )
        if (!expandable) {
          return (
            <div style={{ width: '100%', minWidth: 0, cursor: 'default' }}>{inner}</div>
          )
        }
        return (
          <div
            className={WO_ROW_EXPAND_TRIGGER_CLASS}
            role="button"
            tabIndex={0}
            aria-expanded={expanded}
            title={expanded ? t('app.kuaizhizao.workOrder.formCollapseOpCards') : t('app.kuaizhizao.workOrder.formExpandOpCards')}
            onClick={(e) => toggleWorkOrderOperationPanel(record, e)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                toggleWorkOrderOperationPanel(record, e)
              }
            }}
            style={{ width: '100%', minWidth: 0, cursor: 'pointer' }}
          >
            {inner}
          </div>
        )
      },
    },
    {
      title: t('app.kuaizhizao.workOrder.colSourceOrder'),
      dataIndex: 'sales_order_code',
      hideInTable: true,
      hideInSearch: false,
      fieldProps: { placeholder: t('app.kuaizhizao.workOrder.formSourceOrderPlaceholder') },
    },
    {
      title: t('app.kuaizhizao.workOrder.colPriority'),
      dataIndex: 'priority',
      width: 100,
      sorter: true,
      hideInTable: true,
      hideInSearch: false,
      valueType: 'select',
      valueEnum: {
        low: { text: t('app.kuaizhizao.workOrder.priorityLow') },
        normal: { text: t('app.kuaizhizao.workOrder.priorityNormal') },
        high: { text: t('app.kuaizhizao.workOrder.priorityHigh') },
        urgent: { text: t('app.kuaizhizao.workOrder.priorityUrgent') },
      },
    },
    {
      title: t('app.kuaizhizao.workOrder.colPlannedRange'),
      key: 'plannedRange',
      dataIndex: 'planned_start_date',
      width: 136,
      uniTableKeepWidth: true,
      sorter: true,
      hideInSearch: true,
      render: (_, record) =>
        isWorkOrderGroupListRow(record) ? (
          <Typography.Text type="secondary">—</Typography.Text>
        ) : (
          <WorkOrderPlannedRangeCell record={record} />
        ),
    },
    {
      title: t('app.kuaizhizao.workOrder.colPlannedStart'),
      dataIndex: 'planned_start_date',
      valueType: 'dateTime',
      hideInTable: true,
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('app.kuaizhizao.workOrder.colPlannedStartSearch'),
      dataIndex: 'planned_start_date',
      valueType: 'dateRange',
      width: 160,
      hideInTable: true,
      hideInSearch: false,
      fieldProps: { placeholder: [t('app.kuaizhizao.workOrder.formDateRangeStart'), t('app.kuaizhizao.workOrder.formDateRangeEnd')], style: { width: '100%' } },
    },
    {
      title: t('app.kuaizhizao.workOrder.colPlannedEnd'),
      dataIndex: 'planned_end_date',
      valueType: 'dateTime',
      hideInTable: true,
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('app.kuaizhizao.workOrder.colPlannedEndSearch'),
      dataIndex: 'planned_end_date',
      valueType: 'dateRange',
      width: 160,
      hideInTable: true,
      hideInSearch: false,
      fieldProps: { placeholder: [t('app.kuaizhizao.workOrder.formDateRangeStart'), t('app.kuaizhizao.workOrder.formDateRangeEnd')], style: { width: '100%' } },
    },
    {
      title: t('app.kuaizhizao.workOrder.colCreatedAt'),
      dataIndex: 'created_at',
      valueType: 'dateTime',
      width: 132,
      uniTableKeepWidth: true,
      hideInTable: true,
      sorter: true,
    },
    {
      title: t('app.kuaizhizao.workOrder.colLifecycle'),
      dataIndex: LIST_LIFECYCLE_STAGE_FIELD,
      align: 'left' as const,
      fixed: 'right' as const,
      hideInSearch: false,
      valueType: 'select',
      valueEnum: workOrderLifecycleValueEnum,
      render: (_, record) => {
        const kind = record.row_kind || 'work_order'
        if (kind === 'rework' || kind === 'outsource') {
          return <Tag>{translateWorkOrderLifecycleStatus(t, record.status)}</Tag>
        }
        return renderWorkOrderListLifecycle(record)
      },
    },
    ...workOrderCustomFieldColumns,
    {
      title: t('common.actions'),
      valueType: 'option',
      fixed: 'right' as const,
      hideInSearch: true,
      render: (_, record) => {
        const rowKind = record.row_kind || 'work_order'
        if (rowKind === 'rework' || rowKind === 'outsource') {
          return null
        }
        if (rowKind === 'work_order_group') {
          const groupId = resolveWorkOrderGroupIdFromListRow(record)
          if (groupId == null) return null
          return [
              <Button {...rowActionKind('update')}
                key="dissolve-group"
                type="link"
                size="small"
                danger
                icon={<DisconnectOutlined />}
                loading={dissolveGroupLoading}
                onClick={() => handleDissolveGroups([groupId])}
              >
                {t('app.kuaizhizao.workOrder.actionDissolveGroup')}
              </Button>,
            ];
        }

        const rawStatus = record.status || ''
        const isDraft = ['draft', '草稿'].includes(rawStatus)
        const isReleased = ['released', '已下达'].includes(rawStatus)
        const isInProgress = ['in_progress', '执行中'].includes(rawStatus)
        const isCompleted = ['completed', '已完成'].includes(rawStatus)
        const isCancelled = ['cancelled', '已取消'].includes(rawStatus)
        const isSplit = ['split', '已拆分'].includes(rawStatus)
        const splitRemaining = Number(record.split_remaining_quantity)
        const hasSplitRemaining = isSplit && Number.isFinite(splitRemaining) && splitRemaining > 0
        const isTerminal = isCancelled || isSplit

        const hasWork = Number(record.completed_quantity || 0) > 0

        // 撤回条件：已下达、执行中或手动结束，且无实际报工完成
        const canRevoke =
          (isReleased || isInProgress || (isCompleted && record.manually_completed)) && !hasWork

        // 删除条件：草稿；或者已下达且无开工无完工
        const canDelete = isDraft || (isReleased && !record.actual_start_date && !hasWork)

        // 指定结束条件：非已完成且非终态
        const canComplete = !isCompleted && !isTerminal

        const canSplit = isDraft || isReleased || hasSplitRemaining
        const canFreeze = !isTerminal && !isCompleted

        const handleDeleteClick = () => {
          if (!canDelete) return
          Modal.confirm({
            title: t('app.kuaizhizao.workOrder.modalConfirmDelete'),
            content: t('app.kuaizhizao.workOrder.modalDeleteContent'),
            onOk: async () => {
              try {
                await workOrderApi.delete(record.id!.toString())
                messageApi.success('删除成功')
                invalidateStatistics()
                actionRef.current?.reload()
              } catch (error: any) {
                messageApi.error(error.message || '删除失败')
              }
            },
          })
        }

        const makeItem = (
          key: string,
          label: React.ReactNode,
          onClick: () => void,
          options?: { icon?: React.ReactNode; danger?: boolean; disabled?: boolean },
        ) => ({
          key,
          icon: options?.icon,
          label,
          danger: options?.danger,
          disabled: options?.disabled,
          onClick: ({ domEvent }: { domEvent?: { stopPropagation?: () => void } }) => {
            domEvent?.stopPropagation?.()
            if (options?.disabled) return
            onClick()
          },
        })

        const viewEditItems = [
          makeItem('print', t('app.kuaizhizao.workOrder.actionPrint'), () => handlePrint(record), { icon: <PrinterOutlined /> }),
        ]

        const derivedItems: any[] = []
        if (!isTerminal) {
          derivedItems.push(
            makeItem('rework', t('app.kuaizhizao.workOrder.actionCreateRework'), () => handleCreateRework(record), { icon: <RetweetOutlined /> }),
          )
          if (isCompleted) {
            derivedItems.push(
              makeItem(
                'notifyInbound',
                t('app.kuaizhizao.workOrder.actionNotifyInbound'),
                () => {
                  void handleNotifyInbound(record)
                },
                { icon: <InboxOutlined /> },
              ),
            )
          } else {
            derivedItems.push(
              makeItem('outsource', t('app.kuaizhizao.workOrder.actionCreateOutsource'), () => handleCreateOutsource(record), {
                icon: <TeamOutlined />,
              }),
            )
          }
        }
        if (canSplit) {
          derivedItems.push(
            makeItem('split', hasSplitRemaining ? t('app.kuaizhizao.workOrder.actionSplitRemaining') : t('app.kuaizhizao.workOrder.actionSplit'), () => handleSplit(record), {
              icon: <SplitCellsOutlined />,
            }),
          )
        }

        const statusControlItems: any[] = []
        if (canComplete) {
          statusControlItems.push(
            makeItem('complete', t('app.kuaizhizao.workOrder.actionComplete'), () => handleComplete(record), { icon: <StopOutlined /> }),
          )
        }
        if (canRevoke) {
          statusControlItems.push(
            makeItem('revoke', t('app.kuaizhizao.workOrder.actionRevoke'), () => handleRevoke(record), {
              icon: <CloseCircleOutlined />,
              danger: true,
            }),
          )
        }
        if (record.is_frozen) {
          statusControlItems.push(
            makeItem('unfreeze', t('app.kuaizhizao.workOrder.actionUnfreeze'), () => handleUnfreeze(record), { icon: <UnlockOutlined /> }),
          )
        } else if (canFreeze) {
          statusControlItems.push(
            makeItem('freeze', t('app.kuaizhizao.workOrder.actionFreeze'), () => handleFreeze(record), {
              icon: <LockOutlined />,
              danger: true,
            }),
          )
        }

        const dangerItems = [
          makeItem('delete', t('app.kuaizhizao.workOrder.actionDelete'), handleDeleteClick, {
            icon: <DeleteOutlined />,
            danger: true,
            disabled: !canDelete,
          }),
        ]

        const moreItems: any[] = []
        if (viewEditItems.length) {
          moreItems.push({ type: 'group', label: t('app.kuaizhizao.workOrder.groupViewEdit'), children: viewEditItems })
        }
        if (derivedItems.length) {
          moreItems.push({ type: 'group', label: t('app.kuaizhizao.workOrder.groupDerived'), children: derivedItems })
        }
        if (statusControlItems.length) {
          moreItems.push({ type: 'group', label: t('app.kuaizhizao.workOrder.groupStatusControl'), children: statusControlItems })
        }
        if (dangerItems.length) {
          moreItems.push({ type: 'group', label: t('app.kuaizhizao.workOrder.groupDanger'), children: dangerItems })
        }

        return (
          <Space size={0} wrap>
            <Button
              {...rowActionKind('read')}
              key="detail"
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleDetail(record)}
            >
              {t('app.kuaizhizao.workOrder.actionDetail')}
            </Button>
            <Button
              {...rowActionKind('update')}
              key="edit"
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            >
              {t('app.kuaizhizao.workOrder.actionEdit')}
            </Button>
            {isDraft ? (
              <Button
                {...rowActionKind('release')}
                key="release"
                type="link"
                size="small"
                icon={<SendOutlined />}
                onClick={() => handleRelease(record)}
              >
                {t('app.kuaizhizao.workOrder.actionRelease')}
              </Button>
            ) : null}
            {moreItems.length > 0 ? (
              <Dropdown
                {...rowActionKind('skip')}
                key="more"
                trigger={['click']}
                menu={{ items: moreItems }}
              >
                <Button {...rowActionKind('skip')} type="link" size="small" icon={<DownOutlined />}>
                  {t('app.kuaizhizao.workOrder.actionMore')}
                </Button>
              </Dropdown>
            ) : null}
          </Space>
        )
      },
    },
  ], [t, dissolveGroupLoading, workOrderCustomFieldColumns, operationExpandedRowKeys, workOrderTreeExpandedRowKeys, workOrderLifecycleValueEnum])

  const workOrderTableBodyColSpan = useMemo(() => {
    const visibleDataCols = columns.filter((col) => !col.hideInTable).length
    return visibleDataCols + 2
  }, [columns])

  const workOrderTableComponents = useMemo(() => {
    const anchorToRoot = buildWorkOrderOperationPanelAnchorToRoot(
      operationExpandedRowKeys,
      workOrderRowByKeyRef.current,
      workOrderTreeExpandedRowKeys,
      operationPanelRecordByKeyRef.current,
    )
    const Wrapper = React.forwardRef<
      HTMLTableSectionElement,
      React.HTMLAttributes<HTMLTableSectionElement>
    >((props, ref) => {
      const { children, ...rest } = props
      const rows: React.ReactNode[] = []
      React.Children.forEach(children, (child) => {
        rows.push(child)
        if (!React.isValidElement(child)) return
        const bodyRowKey = (child.props as { rowKey?: React.Key })?.rowKey
        const rowKeyStr =
          bodyRowKey != null ? String(bodyRowKey) : child.key != null ? String(child.key) : ''
        if (!rowKeyStr) return
        const panelRootKey = anchorToRoot.get(rowKeyStr)
        if (!panelRootKey) return
        const panelRecord =
          workOrderRowByKeyRef.current.get(panelRootKey) ??
          operationPanelRecordByKeyRef.current.get(panelRootKey)
        if (!panelRecord) return
        const panelInsetLeft = getWorkOrderOperationPanelInsetLeft(panelRecord)
        rows.push(
          <tr
            key={`${panelRootKey}__operation-cards`}
            className="wo-operation-cards-expand-row"
            data-row-key={`${panelRootKey}__operation-cards`}
          >
            <td
              colSpan={workOrderTableBodyColSpan}
              className="wo-operation-cards-expand-cell"
              style={
                {
                  '--wo-op-panel-inset-left': `${panelInsetLeft}px`,
                  '--wo-op-panel-inset-right': `${WO_TABLE_OPERATION_PANEL_INSET_RIGHT}px`,
                } as React.CSSProperties
              }
              onClick={(e) => e.stopPropagation()}
            >
              {renderWorkOrderOperationCardsPanel(panelRecord)}
            </td>
          </tr>,
        )
      })
      return (
        <tbody ref={ref} {...rest}>
          {rows}
        </tbody>
      )
    })
    Wrapper.displayName = 'WorkOrderTableBodyWrapper'
    return { body: { wrapper: Wrapper } }
  }, [
    operationExpandedRowKeys,
    workOrderTreeExpandedRowKeys,
    workOrderTableBodyColSpan,
    renderWorkOrderOperationCardsPanel,
  ])

  const workOrderTableRowClassName = useCallback(
    (record: WorkOrder) => {
      const key = getWorkOrderListRowKey(record)
      const anchorToRoot = buildWorkOrderOperationPanelAnchorToRoot(
        operationExpandedRowKeys,
        workOrderRowByKeyRef.current,
        workOrderTreeExpandedRowKeys,
        operationPanelRecordByKeyRef.current,
      )
      if (anchorToRoot.has(key)) {
        return 'wo-operation-panel-anchor-row'
      }
      if (highlightPlannedEndOverdue && isWorkOrderPlannedEndOverdue(record)) {
        return 'work-order-row-overdue'
      }
      return ''
    },
    [operationExpandedRowKeys, workOrderTreeExpandedRowKeys, highlightPlannedEndOverdue],
  )

  const workOrderHighlightOverdueToolbar = useMemo(
    () => (
      <Space key="highlight-overdue-switch" align="center">
        <Switch checked={highlightPlannedEndOverdue} onChange={setHighlightPlannedEndOverdue} />
        <span style={{ fontSize: 13, color: 'var(--ant-color-text)' }}>
          {t('app.kuaizhizao.workOrder.highlightOverdue')}
        </span>
      </Space>
    ),
    [highlightPlannedEndOverdue, t],
  )

  const workOrderTableExpandable = useMemo(
    () => ({
      expandedRowKeys: workOrderTreeExpandedRowKeys,
      onExpandedRowsChange: handleWorkOrderTreeExpandChange,
      indentSize: 16,
      childrenColumnName: 'children',
      expandRowByClick: false,
    }),
    [workOrderTreeExpandedRowKeys, handleWorkOrderTreeExpandChange],
  )

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

  /** 折线图渲染（与 StatCardTrendArea / 销售订单指标卡一致） */
  const renderTrendChart = (data: { date: string; value: number }[] = [], color: string) => {
    if (!data || data.length === 0) return null
    return (
      <Suspense fallback={null}>
        <LazyStatTrendArea data={data} color={color} />
      </Suspense>
    )
  }

  const statCards: StatCard[] = statistics
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
                  applyWorkOrderListLifecycleFilter('in_progress')
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
                  applyWorkOrderListLifecycleFilter('completed')
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
                  applyWorkOrderListLifecycleFilter('in_progress')
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
                  applyWorkOrderListLifecycleFilter('draft')
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
      <style>{`
        .work-order-row-overdue td.ant-table-cell {
          background: var(--ant-color-warning-bg) !important;
        }
      `}</style>
      <ListPageTemplate statCards={statCards}>
        <UniTable<WorkOrder>
          className="kuaizhizao-work-orders-table"
          columnPersistenceId="apps.kuaizhizao.pages.production-execution.work-orders"
          headerTitle={t('app.kuaizhizao.workOrder.pageTitle')}
          formRef={tableSearchFormRef}
          searchParamsRef={tableSearchParamsRef}
          actionRef={actionRef}
          rowKey={getWorkOrderListRowKey}
          columns={columns}
          showAdvancedSearch={true}
          skipFuzzyPinyinClientFilter
          fuzzySearchPlaceholder={t('app.kuaizhizao.workOrder.fuzzySearchPlaceholder')}
          rowClassName={workOrderTableRowClassName}
          components={workOrderTableComponents}
          expandable={workOrderTableExpandable}
          tanstackQuery={{
            queryKeyPrefix: ['kuaizhizao', 'work-orders', 'list'],
            staleTime: WORK_ORDER_LIST_STALE_MS,
            gcTime: 15 * 60 * 1000,
            prefetchNextPage: true,
            staleWhileRevalidate: false,
          }}
          request={handleWorkOrderTableRequest}
          postData={syncWorkOrderListRowIndexFromTableData}
          showCreateButton={false}
          createButtonText={t('app.kuaizhizao.workOrder.actionCreateWorkOrder')}
          onCreate={handleCreate}
          toolBarButtonSize="middle"
          selectedRowKeys={selectedRowKeys}
          enableRowSelection
          rowSelectionGetCheckboxProps={(record) => ({
            disabled: !isWorkOrderListSelectableRow(record),
          })}
          onRowSelectionChange={setSelectedRowKeys}
          showDeleteButton
          showImportButton={true}
          onImport={handleListImport}
          importHeaders={workOrderImportTemplate.importHeaders}
          importExampleRow={workOrderImportTemplate.importExampleRow}
          importFieldMap={workOrderImportTemplate.importHeaderMap}
          importFieldRules={{
            product: { required: true },
            plannedQty: { required: true },
          }}
          showExportButton
          onExport={async (type, keys, pageData) => {
            try {
              const response = await workOrderApi.list({ skip: 0, limit: 10000, include_readiness: true })
              let items = Array.isArray(response) ? response : (response as any)?.data || (response as any)?.items || []
              if (type === 'currentPage' && pageData?.length) {
                items = pageData
              } else if (type === 'selected' && keys?.length) {
                const selectedIds = new Set(
                  resolveWorkOrderIdsFromListRowKeys(keys, workOrderRowByKeyRef.current)
                )
                items = items.filter(
                  (d: WorkOrder) => d.id != null && selectedIds.has(Number(d.id))
                )
              }
              if (items.length === 0) {
                messageApi.warning(t('app.kuaizhizao.workOrder.msgExportNoData'))
                return
              }
              const blob = new window.Blob([window.JSON.stringify(items, null, 2)], { type: 'application/json' })
              const url = window.URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `work-orders-${new Date().toISOString().slice(0, 10)}.json`
              a.click()
              window.URL.revokeObjectURL(url)
              messageApi.success(t('app.kuaizhizao.workOrder.msgExportSuccess', { count: items.length }))
            } catch (error: any) {
              messageApi.error(error?.message || t('app.kuaizhizao.workOrder.msgExportFailed'))
            }
          }}
          showSyncButton
          onSync={() => setSyncModalVisible(true)}
          toolbar={{ actions: [workOrderHighlightOverdueToolbar] }}
          toolBarRender={() => [
            <UniPullCreateToolbar
              key="create-work-order-with-pull"
              compactKey="create-work-order-with-pull"
              createIcon={<PlusOutlined />}
              createLabel={t('app.kuaizhizao.workOrder.actionCreateWorkOrder')}
              onCreate={handleCreate}
              menuItems={buildKuaizhizaoPullCreateMenuItems(t, [
                {
                  key: 'pull-from-demand-computation',
                  actionKey: 'work_order.pull_from_demand_computation',
                  onClick: pullFromComputationQuery.openModal,
                },
                {
                  key: 'pull-from-production-plan',
                  actionKey: 'work_order.pull_from_production_plan',
                  onClick: pullFromProductionPlanQuery.openModal,
                },
                {
                  key: 'pull-from-sales-order',
                  actionKey: 'work_order.pull_from_sales_order',
                  onClick: pullFromSalesOrderQuery.openModal,
                },
              ])}
            />,
            <UniPushToolbarButton
              key={`work-order-push-${selectedWorkOrderForToolbarPush?.id ?? 'none'}`}
              menuItems={toolbarPushMenuItems}
              disabled={!selectedWorkOrderForToolbarPush || !canUseToolbarPush}
              disabledReason={toolbarPushDisabledReason}
            />,
          ]}
          toolBarActionsAfterDelete={workOrderToolBarActionsAfterDelete}
          toolBarActionsAfterBatch={[
            <Button {...rowActionKind('release')}
              key="smartRelease"
              size="middle"
              style={{ backgroundColor: '#52c41a', color: '#fff', borderColor: '#52c41a' }}
              icon={<PlayCircleOutlined />}
              onClick={handleSmartReleaseKitted}
            >
              {t('app.kuaizhizao.workOrder.actionSmartRelease')}
            </Button>,
          ]}
          onDelete={handleDelete}
          deleteConfirmTitle={(count) => t('app.kuaizhizao.workOrder.msgConfirmDeleteCount', { count })}
          viewTypes={['table', 'productTree', 'orderTree', 'help']}
          customViews={[
            { key: 'productTree', label: t('app.kuaizhizao.workOrder.viewProductTree'), icon: ShoppingOutlined, render: renderProductTree },
            { key: 'orderTree', label: t('app.kuaizhizao.workOrder.viewOrderTree'), icon: FileTextOutlined, render: renderOrderTree },
          ]}
          touchViewConfig={{
            renderCard: renderTouchCard,
            columns: 1,
          }}
        />
      </ListPageTemplate>

      <UniPullQueryModal<PullDemandComputationCandidate>
        open={pullFromComputationQuery.open}
        title={pullFromDemandComputationAction.label}
        onCancel={pullFromComputationQuery.closeModal}
        onOk={pullFromComputationQuery.handleConfirm}
        rowKey="id"
        columns={[
              { title: t('app.kuaizhizao.workOrder.colComputationCode'), dataIndex: 'computation_code', width: 220, ellipsis: true },
              { title: t('app.kuaizhizao.workOrder.colBusinessMode'), dataIndex: 'business_mode', width: 110, align: 'center' },
              { title: t('app.kuaizhizao.workOrder.colComputationStatus'), dataIndex: 'computation_status', width: 110, align: 'center' },
              {
                title: t('app.kuaizhizao.workOrder.colCreatedAt'),
                dataIndex: 'created_at',
                width: 180,
                render: (v) => (v ? formatDateTime(v, 'YYYY-MM-DD HH:mm:ss') : '-'),
              },
              {
                title: '更新时间',
                dataIndex: 'updated_at',
                width: 180,
                render: (v) => (v ? formatDateTime(v, 'YYYY-MM-DD HH:mm:ss') : '-'),
              },
              {
                title: t('app.kuaizhizao.workOrder.colConvertStatus'),
                key: 'convert_status',
                width: 180,
                align: 'center',
                render: (_, record) =>
                  record.can_push_work_order === false ? (
                    <Tag color="gold">{record.disabled_reason || '不可创建'}</Tag>
                  ) : (
                    <Tag color="success">{t('app.kuaizhizao.workOrder.tagCanCreate')}</Tag>
                  ),
              },
            ]}
        dataSource={pullFromComputationQuery.dataSource}
        loading={pullFromComputationQuery.loading}
        confirmLoading={pullFromComputationQuery.confirmLoading}
        selectionType={pullFromComputationQuery.selectionType}
        selectedRowKeys={pullFromComputationQuery.selectedRowKeys}
        onSelectedRowKeysChange={pullFromComputationQuery.handleSelectedRowKeysChange}
        isRowDisabled={pullFromComputationQuery.isRowDisabled}
        searchDraft={pullFromComputationQuery.searchDraft}
        onSearchDraftChange={pullFromComputationQuery.setSearchDraft}
        onSearchApply={pullFromComputationQuery.handleSearchApply}
        onSearchClear={pullFromComputationQuery.handleSearchClear}
        appliedKeyword={pullFromComputationQuery.appliedKeyword}
        searchPlaceholder="按运算单号搜索"
        page={pullFromComputationQuery.page}
        pageSize={pullFromComputationQuery.pageSize}
        total={pullFromComputationQuery.total}
        onPageChange={pullFromComputationQuery.handlePageChange}
        okText="创建工单"
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
      />

      <UniPullQueryModal<PullProductionPlanCandidate>
        open={pullFromProductionPlanQuery.open}
        title={pullFromProductionPlanAction.label}
        onCancel={pullFromProductionPlanQuery.closeModal}
        onOk={pullFromProductionPlanQuery.handleConfirm}
        rowKey="id"
        columns={[
              { title: t('app.kuaizhizao.workOrder.colPlanCode'), dataIndex: 'plan_code', width: 180, ellipsis: true },
              { title: t('app.kuaizhizao.workOrder.colPlanName'), dataIndex: 'plan_name', width: 260, ellipsis: true },
              { title: t('app.kuaizhizao.workOrder.colPlanStatus'), dataIndex: 'status', width: 120, align: 'center' },
              { title: t('app.kuaizhizao.workOrder.colExecutionStatus'), dataIndex: 'execution_status', width: 120, align: 'center' },
              {
                title: t('app.kuaizhizao.workOrder.colPlanPeriod'),
                key: 'plan_range',
                width: 220,
                render: (_, r) =>
                  r.plan_start_date || r.plan_end_date
                    ? `${r.plan_start_date || '-'} ~ ${r.plan_end_date || '-'}`
                    : '-',
              },
              {
                title: '更新时间',
                dataIndex: 'updated_at',
                width: 180,
                render: (v) => (v ? formatDateTime(v, 'YYYY-MM-DD HH:mm:ss') : '-'),
              },
              {
                title: t('app.kuaizhizao.workOrder.colConvertStatus'),
                key: 'convert_status',
                width: 180,
                align: 'center',
                render: (_, record) =>
                  record.can_push_work_order === false ? (
                    <Tag color="gold">{record.disabled_reason || '不可创建'}</Tag>
                  ) : (
                    <Tag color="success">{t('app.kuaizhizao.workOrder.tagCanCreate')}</Tag>
                  ),
              },
            ]}
        dataSource={pullFromProductionPlanQuery.dataSource}
        loading={pullFromProductionPlanQuery.loading}
        confirmLoading={pullFromProductionPlanQuery.confirmLoading}
        selectionType={pullFromProductionPlanQuery.selectionType}
        selectedRowKeys={pullFromProductionPlanQuery.selectedRowKeys}
        onSelectedRowKeysChange={pullFromProductionPlanQuery.handleSelectedRowKeysChange}
        isRowDisabled={pullFromProductionPlanQuery.isRowDisabled}
        searchDraft={pullFromProductionPlanQuery.searchDraft}
        onSearchDraftChange={pullFromProductionPlanQuery.setSearchDraft}
        onSearchApply={pullFromProductionPlanQuery.handleSearchApply}
        onSearchClear={pullFromProductionPlanQuery.handleSearchClear}
        appliedKeyword={pullFromProductionPlanQuery.appliedKeyword}
        searchPlaceholder="按计划编号/计划名称搜索"
        page={pullFromProductionPlanQuery.page}
        pageSize={pullFromProductionPlanQuery.pageSize}
        total={pullFromProductionPlanQuery.total}
        onPageChange={pullFromProductionPlanQuery.handlePageChange}
        okText="创建工单"
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
          { title: t('app.kuaizhizao.quotation.form.customer'), dataIndex: 'customer_name', width: 220, ellipsis: true },
          { title: t('app.kuaizhizao.salesOrder.status'), dataIndex: 'status', width: 120, align: 'center' },
          { title: t('app.kuaizhizao.salesOrder.reviewStatus'), dataIndex: 'review_status', width: 120, align: 'center' },
          {
            title: t('app.kuaizhizao.salesOrder.deliveryDate'),
            dataIndex: 'delivery_date',
            width: 130,
            render: (v) => (v ? formatDateTime(v, 'YYYY-MM-DD') : '-'),
          },
          {
            title: t('app.kuaizhizao.reports.remainingQuantity'),
            dataIndex: 'remaining_push_quantity',
            width: 140,
            align: 'right',
            render: (v) => Number(v ?? 0),
          },
          {
            title: t('common.updatedAt'),
            dataIndex: 'updated_at',
            width: 180,
            render: (v) => (v ? formatDateTime(v, 'YYYY-MM-DD HH:mm:ss') : '-'),
          },
          {
            title: t('app.kuaizhizao.workOrder.colConvertStatus'),
            key: 'convert_status',
            width: 180,
            align: 'center',
            render: (_, record) =>
              record.remaining_push_quantity <= 0 || record.capabilities?.push_work_order?.allowed === false ? (
                <Tag color="gold">{record.capabilities?.push_work_order?.reason || '不可创建'}</Tag>
              ) : (
                <Tag color="success">{t('app.kuaizhizao.workOrder.tagCanCreate')}</Tag>
              ),
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
        okText="创建工单"
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
      />

      {PrintModal}

      {/* 工序卡环形进度：快速报工（与报工管理新建逻辑一致） */}
      <FormModalTemplate
        key={
          quickReportingModalVisible && quickReportingWorkOrder?.id != null
            ? `quick-report-${quickReportingWorkOrder.id}-${quickReportingOperation?.operation_id ?? 'op'}`
            : 'quick-report-closed'
        }
        title={
          quickReportingOperation
            ? `报工 — ${quickReportingOperation.operation_name || ''}`
            : '报工'
        }
        open={quickReportingModalVisible}
        onClose={() => {
          setQuickReportingModalVisible(false)
          setQuickReportingWorkOrder(null)
          setQuickReportingOperation(null)
          setQuickReportingRouteOperations([])
          quickReportingFormRef.current?.resetFields()
        }}
        onFinish={handleQuickReportingSubmit}
        isEdit={false}
        initialValues={quickReportingInitialValues}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={quickReportingFormRef}
        grid
      >
        <>
          {!!quickReportingLastInboundHint && (
            <Col span={24} style={{ marginBottom: 12 }}>
              <Alert type="info" showIcon title={quickReportingLastInboundHint} />
            </Col>
          )}
        {quickReportingOperation?.reporting_type === 'status' ? (
          <>
            <ProFormRadio.Group
              name="completed_status"
              label="完成状态"
              rules={[{ required: true, message: '请选择完成状态' }]}
              options={[
                { label: t('app.kuaizhizao.workOrder.formCompleted'), value: 'completed' },
                { label: t('app.kuaizhizao.workOrder.formIncomplete'), value: 'incomplete' },
              ]}
              colProps={{ span: 24 }}
            />
            {canProxyReporting && (
              <>
                <UniUserSelect
                  name="proxy_worker_uuid"
                  label="生产人员"
                  placeholder="选择实际完成报工的生产人员"
                  colProps={{ span: 12 }}
                  defaultBadgeUserIds={(quickReportingOperation?.default_operators || [])
                    .map((d: { id?: number }) => d.id)
                    .filter((n: number | undefined): n is number => typeof n === 'number')}
                  onChange={(_uuid, u) => {
                    quickReportingProxyWorkerRef.current =
                      u && !Array.isArray(u)
                        ? { id: u.id, full_name: u.full_name, username: u.username }
                        : null
                  }}
                />
                <ProFormDigit
                  name="work_hours"
                  label="工时(小时)"
                  placeholder="选填"
                  min={0}
                  fieldProps={{ step: 0.1 }}
                  colProps={{ span: 12 }}
                />
                <Col span={24}>
                  {currentUser ? (
                    <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                      记录人员（本次登录）：{currentUser.full_name || currentUser.username || '—'}
                    </Typography.Text>
                  ) : null}
                </Col>
              </>
            )}
            {!canProxyReporting && (
              <ProFormDigit
                name="work_hours"
                label="工时(小时)"
                placeholder="选填"
                min={0}
                fieldProps={{ step: 0.1 }}
                colProps={{ span: 24 }}
              />
            )}
            <ReportingInboundWarehouseField
              isLastOperation={quickReportingIsLastOperation}
              warehouseRequired={quickReportingWarehouseRequired}
            />
            <ProFormTextArea
              name="remarks"
              label="备注"
              placeholder="请输入备注信息"
              fieldProps={{ rows: 3 }}
              colProps={{ span: 24 }}
            />
          </>
        ) : (
          <>
            {quickReportingWorkOrder && quickReportingOperation && (
              <Col span={24} style={{ marginBottom: 16 }}>
                <ReportableQuantityPanel
                  operation={quickReportingOperation}
                  workOrderQuantity={Number(quickReportingWorkOrder.quantity) || 0}
                  operations={quickReportingRouteOperations}
                  workOrderId={quickReportingWorkOrder.id}
                />
              </Col>
            )}
            <ProFormDigit
              name="qualified_quantity"
              label="合格数量"
              placeholder="合格数量"
              rules={[{ required: true, message: '请输入合格数量' }]}
              min={0}
              fieldProps={{
                precision: 2,
                onFocus: handleQuickReportQualifiedFocus,
                onBlur: handleQuickReportQualifiedBlur,
              }}
              colProps={{ span: 12 }}
            />
            <ProFormDigit
              name="unqualified_quantity"
              label="不合格数量"
              placeholder="不合格数量"
              rules={[{ required: true, message: '请输入不合格数量' }]}
              min={0}
              fieldProps={{
                precision: 2,
                onFocus: handleQuickReportUnqualifiedFocus,
                onBlur: handleQuickReportUnqualifiedBlur,
              }}
              colProps={{ span: 12 }}
            />
            <ProFormDependency name={['qualified_quantity', 'unqualified_quantity']}>
              {({ qualified_quantity: qqIn, unqualified_quantity: uqIn }) => {
                const qq = Number(qqIn) || 0
                const uq = Number(uqIn) || 0
                const total = qq + uq
                const rem =
                  quickReportingWorkOrder && quickReportingOperation
                    ? getRemainingReportableQuantity(
                        quickReportingOperation,
                        Number(quickReportingWorkOrder.quantity) || 0
                      )
                    : 0
                const over = total > rem + 1e-9
                return (
                  <Col span={24} style={{ marginBottom: 16 }}>
                    <div>
                      <span style={{ color: token.colorTextSecondary }}>报工数量（自动合计）：</span>
                      <span style={{ fontWeight: 600 }}>{total}</span>
                    </div>
                    {over && (
                      <Typography.Text type="danger" style={{ display: 'block', marginTop: 8 }}>
                        {t('apps.kuaizhizao.workOrder.quickReport.exceedEffective', { max: rem })}
                      </Typography.Text>
                    )}
                  </Col>
                )
              }}
            </ProFormDependency>
            <ProFormDependency name={['qualified_quantity', 'unqualified_quantity']}>
              {({ qualified_quantity: qqIn, unqualified_quantity: uqIn }) => {
                const uq = Number(uqIn) || 0
                if (uq <= 0 || !quickReportingOperation || !operationHasSimpleInspection(quickReportingOperation)) {
                  return null
                }
                const defectOpts = getOperationDefectTypeOptions(quickReportingOperation)
                if (defectOpts.length > 0) {
                  return (
                    <ProFormSelect
                      name="defect_type"
                      label="不良品类型"
                      placeholder="请选择不良品类型"
                      rules={[{ required: true, message: '请选择不良品类型' }]}
                      options={defectOpts}
                      showSearch
                      fieldProps={{ optionFilterProp: 'label' }}
                      colProps={{ span: 24 }}
                    />
                  )
                }
                return (
                  <ProFormTextArea
                    name="defect_reason_text"
                    label="不良品原因"
                    placeholder="请输入不良品原因"
                    rules={[{ required: true, message: '请输入不良品原因' }]}
                    fieldProps={{ rows: 2 }}
                    colProps={{ span: 24 }}
                  />
                )
              }}
            </ProFormDependency>
            {canProxyReporting && (
              <>
                <UniUserSelect
                  name="proxy_worker_uuid"
                  label="生产人员"
                  placeholder="选择实际完成报工的生产人员"
                  colProps={{ span: 12 }}
                  defaultBadgeUserIds={(quickReportingOperation?.default_operators || [])
                    .map((d: { id?: number }) => d.id)
                    .filter((n: number | undefined): n is number => typeof n === 'number')}
                  onChange={(_uuid, u) => {
                    quickReportingProxyWorkerRef.current =
                      u && !Array.isArray(u)
                        ? { id: u.id, full_name: u.full_name, username: u.username }
                        : null
                  }}
                />
                <ProFormDigit
                  name="work_hours"
                  label="工时(小时)"
                  placeholder="选填"
                  min={0}
                  fieldProps={{ step: 0.1 }}
                  colProps={{ span: 12 }}
                />
                <Col span={24}>
                  {currentUser ? (
                    <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                      记录人员（本次登录）：{currentUser.full_name || currentUser.username || '—'}
                    </Typography.Text>
                  ) : null}
                </Col>
              </>
            )}
            {!canProxyReporting && (
              <ProFormDigit
                name="work_hours"
                label="工时(小时)"
                placeholder="选填"
                min={0}
                fieldProps={{ step: 0.1 }}
                colProps={{ span: 24 }}
              />
            )}
            <ReportingInboundWarehouseField
              isLastOperation={quickReportingIsLastOperation}
              warehouseRequired={quickReportingWarehouseRequired}
            />
            <ProFormTextArea
              name="remarks"
              label="备注"
              placeholder="请输入备注信息"
              fieldProps={{ rows: 3 }}
              colProps={{ span: 24 }}
            />
          </>
        )}
        </>
      </FormModalTemplate>

      <FormModalTemplate
        title={isEdit ? t('app.kuaizhizao.workOrder.modalEdit') : t('app.kuaizhizao.workOrder.modalCreate')}
        open={modalVisible}
        loading={modalDataLoading}
        onClose={() => {
          setModalVisible(false)
          setCurrentWorkOrder(null)
          setCreateWorkOrderMode('normal')
          setSelectedMaterialSourceInfo(null)
          setProductSourceData(null)
          setSelectedOperations([])
          setCreateProcessRouteId(undefined)
          setCreateAddOperationsModalVisible(false)
          setCreateAddOperationUuids([])
          resetWorkOrderFormFieldValues()
          formRef.current?.resetFields()
        }}
        onFinish={handleSubmit}
        isEdit={isEdit}
        width={MODAL_CONFIG.LARGE_WIDTH}
        formRef={formRef}
        grid
      >
        {!isEdit ? (
          <>
            <Col span={6}>
              <Form.Item label={t('app.kuaizhizao.workOrder.formCreateMode')} style={{ marginBottom: 24 }}>
                <ThemedSegmented
                  block
                  className="form-field-segmented"
                  value={createWorkOrderMode}
                  onChange={(v) => {
                    const mode = v as 'normal' | 'peer_group'
                    setCreateWorkOrderMode(mode)
                    if (mode === 'peer_group') {
                      setSelectedOperations([])
                      const items = formRef.current?.getFieldValue('group_items')
                      if (!items?.length) {
                        formRef.current?.setFieldsValue({
                          group_items: [
                            { ...EMPTY_PEER_GROUP_ITEM },
                            { ...EMPTY_PEER_GROUP_ITEM },
                          ],
                        })
                      }
                    } else {
                      setSelectedOperations([])
                      formRef.current?.setFieldsValue({
                        process_route_id: undefined,
                        operations: undefined,
                        allow_operation_jump: false,
                        over_report_mode: 'none',
                        over_report_value: 0,
                      })
                    }
                  }}
                  options={[
                    { label: t('app.kuaizhizao.workOrder.formCreateModeNormal'), value: 'normal' },
                    { label: t('app.kuaizhizao.workOrder.formCreateModePeerGroup'), value: 'peer_group' },
                  ]}
                />
              </Form.Item>
            </Col>
            {createWorkOrderMode === 'normal' ? (
              <CodeField
                pageCode="kuaizhizao-production-work-order"
                name="code"
                label={t('app.kuaizhizao.workOrder.colCode')}
                required={true}
                autoGenerateOnCreate={!isEdit}
                showGenerateButton={false}
                context={{}}
                colProps={{ span: 6 }}
              />
            ) : (
              <ProFormText
                name="group_name"
                label={t('app.kuaizhizao.workOrder.formGroupName')}
                placeholder={t('app.kuaizhizao.workOrder.formGroupNamePlaceholder')}
                colProps={{ span: 6 }}
              />
            )}
            {createWorkOrderMode === 'normal' && (
              <ProFormText
                name="name"
                label={t('app.kuaizhizao.workOrder.colName')}
                placeholder={t('app.kuaizhizao.workOrder.formOptionalPlaceholder')}
                colProps={{ span: 12 }}
              />
            )}
          </>
        ) : (
          <>
            <CodeField
              pageCode="kuaizhizao-production-work-order"
              name="code"
              label={t('app.kuaizhizao.workOrder.colCode')}
              required={true}
              autoGenerateOnCreate={false}
              showGenerateButton={false}
              context={{}}
              colProps={{ span: 6 }}
            />
            {createWorkOrderMode === 'normal' && (
              <ProFormText
                name="name"
                label={t('app.kuaizhizao.workOrder.colName')}
                placeholder={t('app.kuaizhizao.workOrder.formOptionalPlaceholder')}
                disabled
                colProps={{ span: 12 }}
              />
            )}
          </>
        )}
        <ProFormText name="production_mode" initialValue="MTS" hidden />

        {!isEdit && createWorkOrderMode === 'peer_group' && (
          <Col span={24}>
            <Suspense fallback={<Spin />}>
              <LazyWorkOrderPeerGroupCreateDetail processRouteList={uniqueProcessRouteList} />
            </Suspense>
          </Col>
        )}

        {createWorkOrderMode === 'normal' && (
          <>
        {/* 第二行：产品类型 6 | 产品 6 | 加载按钮 4+4+4 */}
        {!isEdit && (
          <Col span={6}>
            <Form.Item label={t('app.kuaizhizao.workOrder.formProductType')} style={{ marginBottom: 24 }}>
              <ThemedSegmented
                block
                className="form-field-segmented"
                value={onlyShowMake ? 'make' : 'all'}
                onChange={(v) => setOnlyShowMake(v === 'make')}
                options={[
                  { label: t('app.kuaizhizao.workOrder.formSegmentMake'), value: 'make' },
                  { label: t('app.kuaizhizao.workOrder.formSegmentAll'), value: 'all' },
                ]}
              />
            </Form.Item>
          </Col>
        )}
        <Col span={isEdit ? 24 : 6}>
          <Suspense fallback={<Spin style={{ margin: '12px 0' }} />}>
            <LazyUniMaterialSelect
              name="product_id"
              label={t('app.kuaizhizao.workOrder.colProduct')}
              placeholder={t('app.kuaizhizao.workOrder.formSelectProduct')}
              required
              disabled={isEdit}
              sourceType={onlyShowMake ? 'Make' : undefined}
              formItemProps={{ style: { marginBottom: 24 } }}
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
                      setSelectedMaterialSourceInfo(resolveMaterialSourceValidation(sourceType, t))
                      loadProcessRouteForMaterial(material.uuid)
                    } catch (error) {
                      console.error('获取物料详情失败:', error)
                      setSelectedMaterialSourceInfo(null)
                    }
                  } else setSelectedMaterialSourceInfo(null)
                } else {
                  setSelectedMaterialSourceInfo(null)
                }
              }}
            />
          </Suspense>
        </Col>
        {!isEdit && (
          <>
            <Col span={4}>
              <Form.Item label=" " colon={false} style={{ marginBottom: 24 }}>
                <Button
                  block
                  size="small"
                  type="dashed"
                  style={{
                    borderStyle: 'dashed',
                    borderColor: 'var(--ant-color-primary)',
                    color: 'var(--ant-color-primary)',
                    fontSize: 12,
                  }}
                  onClick={() => {
                    setProductSourceModalType('sales_order')
                    setProductSourceModalVisible(true)
                  }}
                >
                  {t('app.kuaizhizao.workOrder.formLoadFromSalesOrder')}
                </Button>
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item label=" " colon={false} style={{ marginBottom: 24 }}>
                <Button
                  block
                  size="small"
                  type="dashed"
                  style={{
                    borderStyle: 'dashed',
                    borderColor: 'var(--ant-color-primary)',
                    color: 'var(--ant-color-primary)',
                    fontSize: 12,
                  }}
                  onClick={() => {
                    setProductSourceModalType('sales_forecast')
                    setProductSourceModalVisible(true)
                  }}
                >
                  {t('app.kuaizhizao.workOrder.formLoadFromSalesForecast')}
                </Button>
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item label=" " colon={false} style={{ marginBottom: 24 }}>
                <Space.Compact block>
                  <Button
                    block
                    size="small"
                    type="dashed"
                    style={{
                      borderStyle: 'dashed',
                      borderColor: 'var(--ant-color-primary)',
                      color: 'var(--ant-color-primary)',
                      fontSize: 12,
                    }}
                    onClick={() => {
                      setProductSourceModalType('demand')
                      setProductSourceModalVisible(true)
                    }}
                  >
                    {t('app.kuaizhizao.workOrder.formLoadFromDemand')}
                  </Button>
                  {productSourceData && (
                    <Button
                      type="link"
                      onClick={() => {
                        if (productSourceData.type === 'sales_order') {
                          formRef.current?.setFieldsValue({
                            sales_order_id: undefined,
                            sales_order_code: undefined,
                            sales_order_name: undefined,
                            production_mode: 'MTS',
                          })
                          setProductionMode('MTS')
                        }
                        setProductSourceData(null)
                      }}
                      style={{ padding: '0 4px', minWidth: 'auto' }}
                    >
                      {t('common.clear')}
                    </Button>
                  )}
                </Space.Compact>
              </Form.Item>
            </Col>
          </>
        )}
        {selectedMaterialSourceInfo?.sourceType === 'Configure' && !isEdit && (
          <ProFormText
            name="variant_attributes"
            label={t('app.kuaizhizao.workOrder.formAttributes')}
            placeholder={t('app.kuaizhizao.workOrder.formAttributesPlaceholder')}
            rules={[
              { required: true, message: t('app.kuaizhizao.workOrder.formAttributesRequired') },
              {
                validator: (_, value) => {
                  if (!value) return Promise.resolve()
                  try {
                    const parsed = typeof value === 'string' ? JSON.parse(value) : value
                    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
                      return Promise.reject(
                        new Error(t('app.kuaizhizao.workOrder.formAttributesJsonInvalid'))
                      )
                    }
                    return Promise.resolve()
                  } catch {
                    return Promise.reject(
                      new Error(t('app.kuaizhizao.workOrder.formAttributesJsonFormatInvalid'))
                    )
                  }
                },
              },
            ]}
            colProps={{ span: 12 }}
          />
        )}

        <ProFormDigit
          name="quantity"
          label={t('app.kuaizhizao.workOrder.colPlannedQty')}
          placeholder={t('app.kuaizhizao.workOrder.formEnter')}
          min={0}
          precision={2}
          rules={[{ required: true, message: t('app.kuaizhizao.workOrder.formPlannedQtyRequired') }]}
          colProps={{ span: 6 }}
        />
        <ProFormSelect
          name="priority"
          label={t('app.kuaizhizao.workOrder.colPriority')}
          options={[
            { label: t('app.kuaizhizao.workOrder.priorityLow'), value: 'low' },
            { label: t('app.kuaizhizao.workOrder.priorityNormal'), value: 'normal' },
            { label: t('app.kuaizhizao.workOrder.priorityHigh'), value: 'high' },
            { label: t('app.kuaizhizao.workOrder.priorityUrgent'), value: 'urgent' },
          ]}
          initialValue="normal"
          colProps={{ span: 6 }}
        />
        <ProFormDatePicker
          name="planned_start_date"
          label={t('app.kuaizhizao.workOrder.colPlannedStart')}
          placeholder={t('app.kuaizhizao.workOrder.formSelect')}
          required
          rules={[{ required: true, message: t('app.kuaizhizao.workOrder.formPlannedStartRequired') }]}
          colProps={{ span: 6 }}
          fieldProps={{ style: { width: '100%' } }}
        />
        <ProFormDatePicker
          name="planned_end_date"
          label={t('app.kuaizhizao.workOrder.colPlannedEnd')}
          placeholder={t('app.kuaizhizao.workOrder.formSelect')}
          required
          rules={[{ required: true, message: t('app.kuaizhizao.workOrder.formPlannedEndRequired') }]}
          colProps={{ span: 6 }}
          fieldProps={buildFutureDateShortcutFieldProps({
            getForm: () => formRef.current,
            fieldName: 'planned_end_date',
            baseFieldName: 'planned_start_date',
            t,
            fieldProps: { style: { width: '100%' } },
          })}
        />

        <Col span={24}>
          <Form.Item name="process_route_id" label={t('app.kuaizhizao.workOrder.colProcessRoute')} style={{ marginBottom: 16 }}>
            <UniDropdown
              placeholder={t('app.kuaizhizao.workOrder.formProcessRoutePlaceholder')}
              options={uniqueProcessRouteList.map(route => ({
                label: `${route.code} - ${route.name}`,
                value: route.id,
              }))}
              disabled={isEdit && String(currentWorkOrder?.status || '') !== 'draft'}
              showSearch
              allowClear
              advancedSearch={{
                label: t('app.kuaizhizao.workOrder.formAdvancedSearch'),
                fields: [
                  { name: 'code', label: t('app.kuaizhizao.workOrder.formProcessRouteCode') },
                  { name: 'name', label: t('app.kuaizhizao.workOrder.formProcessRouteName') },
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
                    const route = uniqueProcessRouteList.find(r => r.id === value)
                    if (!route || !route.uuid) {
                      setCreateProcessRouteId(undefined)
                      messageApi.warning(t('app.kuaizhizao.workOrder.msgProcessRouteNotFound'))
                      return
                    }
                    setCreateProcessRouteId(Number(value))
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
                      messageApi.success(
                        t('app.kuaizhizao.workOrder.msgOperationsLoaded', { count: operations.length })
                      )
                    } else {
                      setSelectedOperations([])
                      formRef.current?.setFieldsValue({ operations: undefined })
                      if (routeDetail?.operation_sequence) {
                        messageApi.warning(t('app.kuaizhizao.workOrder.msgProcessRouteParseFailed'))
                      } else {
                        messageApi.warning(t('app.kuaizhizao.workOrder.msgProcessRouteNoSequence'))
                      }
                    }
                  } catch (error: any) {
                    console.error('获取工艺路线工序失败:', error)
                    messageApi.error(error.message || t('app.kuaizhizao.workOrder.msgLoadProcessRouteOpsFailed'))
                    setCreateProcessRouteId(undefined)
                    setSelectedOperations([])
                    formRef.current?.setFieldsValue({ operations: undefined })
                  }
                } else {
                  setCreateProcessRouteId(undefined)
                  formRef.current?.setFieldsValue({
                    allow_operation_jump: false,
                  })
                }
              }}
            />
          </Form.Item>
        </Col>
        <Form.Item name="operations" hidden />
        <Form.Item
          label={t('app.kuaizhizao.workOrder.colOperations')}
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
                  isEdit && ['completed', 'cancelled', 'split'].includes(String(currentWorkOrder?.status || ''))
                }
              />
            </Suspense>
          </div>
          {(!isEdit ||
            !['completed', 'cancelled', 'split'].includes(String(currentWorkOrder?.status || ''))) && (
            <Button
              type="dashed"
              block
              icon={<PlusOutlined />}
              onClick={() => {
                setCreateAddOperationUuids([])
                setCreateAddOperationsModalVisible(true)
              }}
              style={{
                marginTop: 12,
                borderStyle: 'dashed',
                borderColor: 'var(--ant-color-primary)',
                color: 'var(--ant-color-primary)',
              }}
            >
              {t('app.kuaizhizao.workOrder.modalAddOperation')}
            </Button>
          )}
        </Form.Item>

        <Col span={12}>
          <Form.Item
            name="over_report_mode"
            label={t('app.kuaizhizao.workOrder.formDefaultOverReport')}
            initialValue="none"
            style={{ marginBottom: 24 }}
          >
            <ThemedSegmented
              className="form-field-segmented"
              style={{ width: 'fit-content', maxWidth: '100%' }}
              options={[
                { label: t('field.operation.overReportModeNone'), value: 'none' },
                { label: t('field.operation.overReportModeFixed'), value: 'fixed' },
                { label: t('field.operation.overReportModePercent'), value: 'percent' },
              ]}
            />
          </Form.Item>
        </Col>
        <ProFormDigit
          name="over_report_value"
          label={formLabelWithHint(
            t('field.operation.overReportValue'),
            t('field.operation.overReportValueExtra')
          )}
          placeholder={t('app.kuaizhizao.workOrder.formEnter')}
          colProps={{ span: 12 }}
          min={0}
          fieldProps={{ precision: 4 }}
        />
        <ProFormSwitch
          name="allow_operation_jump"
          label={formLabelWithHint(
            t('app.kuaizhizao.workOrder.colAllowOpJump'),
            t('app.kuaizhizao.workOrder.formAllowOpJumpExtra')
          )}
          initialValue={false}
          colProps={{ span: 12 }}
        />
        {!isEdit && createWorkOrderMode === 'normal' && (
          <ProFormDependency name={['product_id']}>
            {({ product_id }) => (
              <WorkOrderTrackingFields
                formRef={formRef}
                productId={product_id}
                productList={productList}
                disabled={isEdit}
              />
            )}
          </ProFormDependency>
        )}
        {isEdit && createWorkOrderMode === 'normal' && (
          <ProFormDependency name={['product_id']}>
            {({ product_id }) => (
              <WorkOrderTrackingEditFields
                productId={product_id ?? currentWorkOrder?.product_id}
                productList={productList}
                workOrderStatus={currentWorkOrder?.status}
              />
            )}
          </ProFormDependency>
        )}
        <CustomFieldsFormSection
          customFields={workOrderFormCustomFields}
          customFieldValues={workOrderFormCustomFieldValues}
          gridColumns={4}
        />
        <DocumentAttachmentsField
          category="work_order_attachments"
          label={t('app.kuaizhizao.workOrder.colAttachments')}
        />
        <ProFormTextArea
          name="remarks"
          label={t('app.kuaizhizao.workOrder.colRemarks')}
          placeholder={t('app.kuaizhizao.workOrder.formOptionalPlaceholder')}
          fieldProps={{ rows: 3 }}
          colProps={{ span: 24 }}
        />
          </>
        )}

        {!isEdit && createWorkOrderMode === 'peer_group' && (
          <>
            <ProFormDatePicker
              name="planned_start_date"
              label={t('app.kuaizhizao.workOrder.colPlannedStart')}
              placeholder={t('app.kuaizhizao.workOrder.formSelect')}
              required
              rules={[{ required: true, message: t('app.kuaizhizao.workOrder.formPlannedStartRequired') }]}
              colProps={{ span: 12 }}
              fieldProps={{ style: { width: '100%' } }}
            />
            <ProFormDatePicker
              name="planned_end_date"
              label={t('app.kuaizhizao.workOrder.colPlannedEnd')}
              placeholder={t('app.kuaizhizao.workOrder.formSelect')}
              required
              rules={[{ required: true, message: t('app.kuaizhizao.workOrder.formPlannedEndRequired') }]}
              colProps={{ span: 12 }}
              fieldProps={buildFutureDateShortcutFieldProps({
                getForm: () => formRef.current,
                fieldName: 'planned_end_date',
                baseFieldName: 'planned_start_date',
                t,
                fieldProps: { style: { width: '100%' } },
              })}
            />
          </>
        )}
      </FormModalTemplate>

      <Modal
        title={t('app.kuaizhizao.workOrder.modalAddOperation')}
        open={createAddOperationsModalVisible}
        width={520}
        destroyOnHidden
        onOk={handleAppendCreateOperations}
        onCancel={() => {
          setCreateAddOperationsModalVisible(false)
          setCreateAddOperationUuids([])
        }}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        okButtonProps={{ disabled: !createAddOperationUuids.length }}
      >
        <OperationPickPanel
          key={createAddOperationsModalVisible ? 'work-order-op-picker-open' : 'work-order-op-picker-closed'}
          mode="multiple"
          operations={availableCreateOperations as any}
          loading={false}
          multipleValue={createAddOperationUuids}
          onMultipleChange={setCreateAddOperationUuids}
          searchPlaceholder={t('app.kuaizhizao.workOrder.searchOperationPlaceholder')}
        />
      </Modal>

      {/* 选择产品来源文档 Modal（销售订单/销售预测/需求）- 产品明细 */}
      <Modal
        title={
          productSourceModalType === 'sales_order'
            ? t('app.kuaizhizao.workOrder.modalSelectProductSourceSalesOrder')
            : productSourceModalType === 'sales_forecast'
              ? t('app.kuaizhizao.workOrder.modalSelectProductSourceSalesForecast')
              : productSourceModalType === 'demand'
                ? t('app.kuaizhizao.workOrder.modalSelectProductSourceDemand')
                : t('app.kuaizhizao.workOrder.modalSelectProductSourceGeneric')
        }
        open={productSourceModalVisible}
        onCancel={() => {
          setProductSourceModalVisible(false)
          setProductSourceModalType(null)
          setProductSourceKeyword('')
        }}
        footer={null}
        width={MODAL_CONFIG.LARGE_WIDTH}
      >
        <Input.Search
          allowClear
          enterButton={t('app.kuaizhizao.workOrder.actionSearch')}
          style={{ marginBottom: 12 }}
          value={productSourceKeyword}
          onChange={(e) => setProductSourceKeyword(e.target.value)}
          onSearch={(value) => setProductSourceKeyword(value)}
          placeholder={
            productSourceModalType === 'sales_order'
              ? t('app.kuaizhizao.workOrder.searchProductSourceSalesOrder')
              : productSourceModalType === 'sales_forecast'
                ? t('app.kuaizhizao.workOrder.searchProductSourceForecast')
                : productSourceModalType === 'demand'
                  ? t('app.kuaizhizao.workOrder.searchProductSourceDemand')
                  : t('app.kuaizhizao.workOrder.searchProductSourceGeneric')
          }
        />
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
                  ...(productSourceModalType === 'sales_order' && sourceItems[0]?._doc_id != null
                    ? {
                        salesOrderRef: {
                          id: Number(sourceItems[0]._doc_id),
                          code: sourceItems[0]._order_code,
                          name:
                            sourceItems[0]._order_code && sourceItems[0]._customer_name
                              ? `${sourceItems[0]._order_code} · ${sourceItems[0]._customer_name}`
                              : sourceItems[0]._order_code || sourceItems[0]._customer_name,
                        },
                      }
                    : {}),
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
                  { title: t('app.kuaizhizao.workOrder.colOrderCode'), dataIndex: '_order_code', key: '_order_code', width: 140 },
                  { title: t('app.kuaizhizao.workOrder.colCustomer'), dataIndex: '_customer_name', key: '_customer_name', width: 160 },
                  { title: '产品名称', dataIndex: 'material_name', key: 'material_name' },
                  { title: t('app.kuaizhizao.workOrder.colModel'), dataIndex: 'material_spec', key: 'material_spec', width: 140 },
                  {
                    title: t('app.kuaizhizao.workOrder.colQuantity'),
                    dataIndex: 'required_quantity',
                    key: 'required_quantity',
                    width: 80,
                  },
                ]
              : productSourceModalType === 'sales_forecast'
                ? [
                    {
                      title: t('app.kuaizhizao.workOrder.colForecastCode'),
                      dataIndex: '_forecast_code',
                      key: '_forecast_code',
                      width: 120,
                    },
                    {
                      title: t('app.kuaizhizao.workOrder.colForecastName'),
                      dataIndex: '_forecast_name',
                      key: '_forecast_name',
                      width: 120,
                    },
                    { title: '产品名称', dataIndex: 'material_name', key: 'material_name' },
                    { title: t('app.kuaizhizao.workOrder.colModel'), dataIndex: 'material_spec', key: 'material_spec', width: 140 },
                    {
                      title: t('app.kuaizhizao.workOrder.colQuantity'),
                      dataIndex: 'forecast_quantity',
                      key: 'forecast_quantity',
                      width: 80,
                    },
                  ]
                : productSourceModalType === 'demand'
                  ? [
                      {
                        title: t('app.kuaizhizao.workOrder.colDemandCode'),
                        dataIndex: '_demand_code',
                        key: '_demand_code',
                        width: 120,
                      },
                      {
                        title: t('app.kuaizhizao.workOrder.colDemandName'),
                        dataIndex: '_demand_name',
                        key: '_demand_name',
                        width: 120,
                      },
                      { title: '产品名称', dataIndex: 'material_name', key: 'material_name' },
                      {
                        title: t('app.kuaizhizao.workOrder.colModel'),
                        dataIndex: 'material_spec',
                        key: 'material_spec',
                        width: 140,
                      },
                      {
                        title: t('app.kuaizhizao.workOrder.colQuantity'),
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
      <DetailDrawerTemplate
        title={`工单详情 - ${workOrderDetail?.code || ''}`}
        open={drawerVisible}
        zIndex={workOrderDetailDrawerZIndex}
        onClose={() => {
          setDrawerVisible(false)
          setWorkOrderDetail(null)
          resetWorkOrderDetailFieldValues()
        }}
        dataSource={workOrderDetail || undefined}
        columns={detailColumns}
        width="50%"
        styles={{ wrapper: { width: '50%' } }}
        extra={
          workOrderDetail && (
            <Space wrap>
              {['draft', '草稿'].includes(workOrderDetail.status || '') && (
                <Button type="primary" onClick={() => handleRelease(workOrderDetail!)}>
                  下达工单
                </Button>
              )}
              {(['released', '已下达', 'in_progress', '执行中'].includes(workOrderDetail.status || '') ||
                (['completed', '已完成'].includes(workOrderDetail.status || '') &&
                  workOrderDetail.manually_completed)) &&
                !Number(workOrderDetail.completed_quantity || 0) && (
                  <Button type="default" danger onClick={() => handleRevoke(workOrderDetail!)}>
                    撤回
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
                  {t('app.kuaizhizao.workOrder.modalAddOperation')}
                </Button>
              )}
              <Select
                value={workOrderDetail?.priority || 'normal'}
                onChange={value => handleSetPriority(workOrderDetail!, value)}
                disabled={!workOrderDetail}
                style={{ width: 120 }}
              >
                <Select.Option value="low">{t('app.kuaizhizao.workOrder.priorityLow')}</Select.Option>
                <Select.Option value="normal">{t('app.kuaizhizao.workOrder.priorityNormal')}</Select.Option>
                <Select.Option value="high">{t('app.kuaizhizao.workOrder.priorityHigh')}</Select.Option>
                <Select.Option value="urgent">{t('app.kuaizhizao.workOrder.priorityUrgent')}</Select.Option>
              </Select>
            </Space>
          )
        }
        customContent={
          drawerVisible && workOrderDetail ? (
            <Suspense fallback={<Spin style={{ margin: 48 }} />}>
              <>
                {/* 1. 基本信息（含二维码） */}
                <DetailDrawerSection title="基本信息">
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
                        showCardTitle={false}
                      />
                    </Col>
                  </Row>
                </DetailDrawerSection>

                {hasCustomFieldsDetailContent(workOrderListCustomFields, workOrderDetailCustomFieldValues) ? (
                  <DetailDrawerSection title={t('app.master-data.customFields', { defaultValue: '自定义字段' })}>
                    <CustomFieldsDetailSection
                      customFields={workOrderListCustomFields}
                      customFieldValues={workOrderDetailCustomFieldValues}
                    />
                  </DetailDrawerSection>
                ) : null}

                {/* 2. 生命周期（上下游关联见左侧全链路浮层） */}
                {(() => {
                  const lifecycle = getWorkOrderLifecycle(workOrderDetail)
                  const mainStages = lifecycle.mainStages ?? []
                  if (mainStages.length === 0) return null
                  return (
                    <DetailDrawerSection title="生命周期">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <LazyUniLifecycleStepper
                          steps={mainStages}
                          status={lifecycle.status}
                          showLabels
                          nextStepSuggestions={lifecycle.nextStepSuggestions}
                          hideNextStepSuggestions
                        />
                        {workOrderDetail.id != null ? (
                          <DetailDrawerInlineFullChain
                            documentType="work_order"
                            documentId={workOrderDetail.id}
                            active={drawerVisible}
                            selfDocumentId={workOrderDetail.id}
                            renderBriefActions={(doc) => (
                              <WarehouseTraceBriefPrimaryActions
                                doc={doc}
                                t={t}
                                navigate={navigate}
                                closeDrawer={() => {
                                  setDrawerVisible(false);
                                  setWorkOrderDetail(null);
                                }}
                              />
                            )}
                          />
                        ) : null}
                      </div>
                    </DetailDrawerSection>
                  )
                })()}

                {/* 3. 明细信息（工单工序） */}
                <DetailDrawerSection title="工单工序">
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
                </DetailDrawerSection>

                {/* 4. 操作记录：时间线 */}
                {workOrderDetail?.id ? (
                  <DetailDrawerSection title="操作记录">
                    {workOrderTracking.loading && (
                      <div style={{ textAlign: 'center', padding: 24 }}>
                        <Spin />
                      </div>
                    )}
                    {workOrderTracking.error && !workOrderTracking.loading && (
                      <Typography.Text type="danger">{workOrderTracking.error}</Typography.Text>
                    )}
                    {workOrderTracking.data && !workOrderTracking.loading && (
                      <DocumentTrackingTimelineBody data={workOrderTracking.data} />
                    )}
                  </DetailDrawerSection>
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
        width={MODAL_CONFIG.STANDARD_WIDTH}
        loading={reworkSubmitLoading}
        initialValues={reworkFormInitialValues}
        onClose={() => {
          setReworkModalVisible(false)
          setCurrentWorkOrderForRework(null)
          setReworkModalOperations([])
          setReworkableQuantity(0)
          reworkFormRef.current?.resetFields()
        }}
        onFinish={handleSubmitRework}
        formRef={reworkFormRef}
      >
        {currentWorkOrderForRework ? (
          <>
            <Card size="small" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={12}>
                  <div>
                    <strong>工单编号：</strong>
                    {currentWorkOrderForRework.code}
                  </div>
                </Col>
                <Col span={12}>
                  <div>
                    <strong>产品名称：</strong>
                    {currentWorkOrderForRework.product_name}
                  </div>
                </Col>
                <Col span={12} style={{ marginTop: 8 }}>
                  <div>
                    <strong>可返工数量：</strong>
                    {reworkableQuantity}
                  </div>
                </Col>
              </Row>
            </Card>
            <ProFormDigit
              name="quantity"
              label="返工数量"
              placeholder="请输入返工数量"
              rules={[
                { required: true, message: '请输入返工数量' },
                {
                  validator: async (_, value) => {
                    const qty = Number(value)
                    if (!Number.isFinite(qty) || qty <= 0) {
                      throw new Error('返工数量必须大于 0')
                    }
                    if (qty > reworkableQuantity) {
                      throw new Error(`返工数量不能超过可返工数量（${reworkableQuantity}）`)
                    }
                  },
                },
              ]}
              min={0.01}
              max={reworkableQuantity > 0 ? reworkableQuantity : undefined}
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
            <ProFormSelect
              name="start_work_order_operation_id"
              label="返工起始工序"
              placeholder="不选则取原工单首道工序"
              allowClear
              options={reworkModalOperations.map((op: any) => ({
                label: `工序${op.sequence || ''} - ${op.operation_name || op.operation_code || op.id}`,
                value: op.id,
              }))}
              fieldProps={{
                showSearch: true,
                filterOption: (input: string, option: any) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase()),
              }}
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
              fieldProps={buildFutureDateShortcutFieldProps({
                getForm: () => reworkFormRef.current,
                fieldName: 'planned_end_date',
                baseFieldName: 'planned_start_date',
                t,
                fieldProps: { showTime: true },
              })}
            />
            <ProFormTextArea
              name="remarks"
              label="备注"
              placeholder="请输入备注"
              fieldProps={{ rows: 3 }}
            />
          </>
        ) : null}
      </FormModalTemplate>

      {/* 创建工序委外Modal */}
      <FormModalTemplate
        title="创建工序委外"
        open={outsourceModalVisible}
        onClose={() => {
          setOutsourceModalVisible(false)
          setCurrentWorkOrderForOutsource(null)
          setOutsourceOptionsByOpId({})
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
              options={workOrderOperations.map((op: any) => {
                const available = Number(
                  outsourceOptionsByOpId[op.id]?.outsourceable_quantity ?? 0
                )
                return {
                  label: `${op.operation_name || op.operation_code} (序号: ${op.sequence || op.id}，可委外: ${available})`,
                  value: op.id,
                  disabled: available <= 0,
                }
              })}
              fieldProps={{
                showSearch: true,
                filterOption: (input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase()),
                onChange: () => {
                  outsourceFormRef.current?.setFieldsValue({ outsource_quantity: undefined })
                },
              }}
            />
            <ProFormDependency name={['work_order_operation_id']}>
              {({ work_order_operation_id }) => {
                const maxOutsourceQty = Number(
                  outsourceOptionsByOpId[work_order_operation_id]?.outsourceable_quantity ?? 0
                )
                if (!work_order_operation_id) return null
                return (
                  <Alert
                    type={maxOutsourceQty > 0 ? 'info' : 'warning'}
                    showIcon
                    message={`可委外数量：${maxOutsourceQty}`}
                    style={{ marginBottom: 16 }}
                  />
                )
              }}
            </ProFormDependency>
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
            <ProFormDependency name={['work_order_operation_id']}>
              {({ work_order_operation_id }) => {
                const maxOutsourceQty = Number(
                  outsourceOptionsByOpId[work_order_operation_id]?.outsourceable_quantity ?? 0
                )
                return (
                  <ProFormDigit
                    name="outsource_quantity"
                    label="委外数量"
                    placeholder="请输入委外数量"
                    rules={[
                      { required: true, message: '请输入委外数量' },
                      {
                        validator: async (_, value) => {
                          if (value == null || value === '') return
                          const qty = Number(value)
                          if (!Number.isFinite(qty) || qty <= 0) {
                            throw new Error('委外数量必须大于 0')
                          }
                          if (work_order_operation_id && qty > maxOutsourceQty) {
                            throw new Error(`委外数量不能超过可委外数量（${maxOutsourceQty}）`)
                          }
                        },
                      },
                    ]}
                    min={0}
                    max={maxOutsourceQty > 0 ? maxOutsourceQty : undefined}
                    fieldProps={{ precision: 2 }}
                    extra={
                      work_order_operation_id
                        ? `最多可委外 ${maxOutsourceQty}`
                        : '请先选择工序'
                    }
                  />
                )
              }}
            </ProFormDependency>
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
              fieldProps={buildFutureDateShortcutFieldProps({
                getForm: () => outsourceFormRef.current,
                fieldName: 'planned_end_date',
                baseFieldName: 'planned_start_date',
                t,
                fieldProps: { showTime: true },
              })}
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
        className="form-modal-no-title-accent"
        open={dispatchModalVisible}
        onClose={() => {
          setDispatchModalVisible(false)
          setCurrentOperationForDispatch(null)
          setCurrentWorkOrderForDispatch(null)
        }}
        onFinish={handleDispatch}
        formRef={dispatchFormRef}
        loading={dispatchPickListsLoading}
        grid={false}
        width={MODAL_CONFIG.LARGE_WIDTH}
        {...MODAL_CONFIG}
      >
        {currentOperationForDispatch && currentWorkOrderForDispatch && (
          <>
            <Row gutter={[16, 16]} style={{ width: '100%' }}>
              <Col span={24}>
                <Card size="small" style={{ marginBottom: 0, backgroundColor: token.colorFillTertiary }}>
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
                        <span style={{ color: token.colorPrimary, fontWeight: 'bold' }}>
                          {currentWorkOrderForDispatch.quantity}
                        </span>
                      </div>
                    </Col>
                  </Row>
                </Card>
              </Col>

              <Col xs={24} sm={12}>
                <ProFormItem name="workshop_id" label="分配车间">
                  <UniDropdown
                    placeholder="请选择车间（可选）"
                    allowClear
                    showSearch
                    options={workshopList.map((w: any) => ({
                      label: `${w.code ?? ''} - ${w.name ?? ''}`.trim() || String(w.id),
                      value: w.id,
                    }))}
                    advancedSearch={{
                      label: '高级搜索车间',
                      fields: [
                        { name: 'code', label: '车间编号', type: 'text' },
                        { name: 'name', label: '车间名称', type: 'text' },
                      ],
                      onSearch: async (params: Record<string, string>) => {
                        const list = await workshopApi.list({ is_active: true, limit: 500 }).catch(() => ({
                          items: [],
                          total: 0,
                        }))
                        const arr = factoryListItems(list as any)
                        const codeQ = (params?.code || '').toString().trim().toLowerCase()
                        const nameQ = (params?.name || '').toString().trim().toLowerCase()
                        return arr
                          .filter((w: any) => {
                            const c = String(w.code ?? '').toLowerCase()
                            const n = String(w.name ?? '').toLowerCase()
                            if (codeQ && !c.includes(codeQ)) return false
                            if (nameQ && !n.includes(nameQ)) return false
                            return true
                          })
                          .map((w: any) => ({
                            value: w.id,
                            label: `${w.code ?? ''} - ${w.name ?? ''}`.trim() || String(w.id),
                          }))
                      },
                    }}
                  />
                </ProFormItem>
              </Col>

              <Col xs={24} sm={12}>
                <ProFormItem
                  name="assigned_personnel"
                  label="分配人员/小组"
                  tooltip="可同时选择具体的生产人员或整个工作小组"
                >
                  <UniDropdown
                    placeholder="请选择人员或小组"
                    allowClear
                    showSearch
                    mode="multiple"
                    options={personnelOptions}
                    advancedSearch={{
                      label: t('app.kuaizhizao.workOrder.formAdvancedSearch'),
                      fields: [
                        { name: 'name', label: '名称/用户名', type: 'text' },
                      ],
                      onSearch: async (params: Record<string, string>) => {
                        const nameQ = (params?.name || '').toString().trim().toLowerCase();
                        return personnelOptions.filter(opt => opt.label.toLowerCase().includes(nameQ));
                      },
                    }}
                  />
                </ProFormItem>
              </Col>

              <Col xs={24} sm={12}>
                <ProFormItem
                  name="assigned_resource"
                  label="分配工位/工作中心"
                  tooltip="可同时选择具体的工作中心或具体的工位"
                >
                  <UniDropdown
                    placeholder="请选择工位或工作中心"
                    allowClear
                    showSearch
                    mode="multiple"
                    options={resourceOptions}
                    advancedSearch={{
                      label: t('app.kuaizhizao.workOrder.formAdvancedSearch'),
                      fields: [
                        { name: 'name', label: '名称/编号', type: 'text' },
                      ],
                      onSearch: async (params: Record<string, string>) => {
                        const nameQ = (params?.name || '').toString().trim().toLowerCase();
                        return resourceOptions.filter(opt => opt.label.toLowerCase().includes(nameQ));
                      },
                    }}
                  />
                </ProFormItem>
              </Col>

              <Col xs={24} sm={12}>
            <ProFormItem
              name="assigned_equipment_id"
              label="分配设备"
            >
              <UniDropdown
                placeholder="请选择执行设备"
                allowClear
                showSearch
                options={equipmentList.map((item: any) => ({
                  label: `${item.code} - ${item.name}`,
                  value: item.id,
                }))}
                advancedSearch={{
                  label: '高级搜索设备',
                  fields: [
                    { name: 'code', label: '设备编号', type: 'text' },
                    { name: 'name', label: '设备名称', type: 'text' },
                  ],
                  onSearch: async (params: Record<string, string>) => {
                    const res = await getEquipmentList({
                      is_active: true,
                      limit: 300,
                      search: params?.code || params?.name || undefined,
                    }).catch(() => ({ items: [] }))
                    const items = res?.items ?? []
                    return items.map((e: any) => ({
                      value: e.id,
                      label: `${e.code} - ${e.name}`,
                    }))
                  },
                }}
              />
            </ProFormItem>
              </Col>

              <Col xs={24} sm={12}>
            <ProFormItem
              name="assigned_mold_id"
              label="分配模具"
            >
              <UniDropdown
                placeholder="请选择模具（可选）"
                allowClear
                showSearch
                options={moldList.map((item: any) => ({
                  label: `${item.code || ''} - ${item.name}`,
                  value: item.id,
                }))}
                advancedSearch={{
                  label: '高级搜索模具',
                  fields: [
                    { name: 'code', label: '模具编号', type: 'text' },
                    { name: 'name', label: '模具名称', type: 'text' },
                  ],
                  onSearch: async (params: Record<string, string>) => {
                    const res = await getMoldList({
                      is_active: true,
                      limit: 300,
                    }).catch(() => ({ items: [] }))
                    const items = res?.items ?? []
                    const codeQ = (params?.code || '').toString().trim().toLowerCase()
                    const nameQ = (params?.name || '').toString().trim().toLowerCase()
                    return items
                      .filter((m: any) => {
                        const c = String(m.code ?? '').toLowerCase()
                        const n = String(m.name ?? '').toLowerCase()
                        if (codeQ && !c.includes(codeQ)) return false
                        if (nameQ && !n.includes(nameQ)) return false
                        return true
                      })
                      .map((m: any) => ({
                        value: m.id,
                        label: `${m.code || ''} - ${m.name}`,
                      }))
                  },
                }}
              />
            </ProFormItem>
              </Col>

              <Col xs={24} sm={12}>
            <ProFormItem
              name="assigned_tool_id"
              label="分配工装"
            >
              <UniDropdown
                placeholder="请选择工装（可选）"
                allowClear
                showSearch
                options={toolList.map((item: any) => ({
                  label: `${item.code || ''} - ${item.name}`,
                  value: item.id,
                }))}
                advancedSearch={{
                  label: '高级搜索工装',
                  fields: [
                    { name: 'code', label: '工装编号', type: 'text' },
                    { name: 'name', label: '工装名称', type: 'text' },
                  ],
                  onSearch: async (params: Record<string, string>) => {
                    const res = await toolApi.list({ limit: 300 }).catch(() => ({ items: [] }))
                    const items = (res as any)?.items ?? (Array.isArray(res) ? res : [])
                    const codeQ = (params?.code || '').toString().trim().toLowerCase()
                    const nameQ = (params?.name || '').toString().trim().toLowerCase()
                    return (Array.isArray(items) ? items : [])
                      .filter((t: any) => {
                        const c = String(t.code ?? '').toLowerCase()
                        const n = String(t.name ?? '').toLowerCase()
                        if (codeQ && !c.includes(codeQ)) return false
                        if (nameQ && !n.includes(nameQ)) return false
                        return true
                      })
                      .map((t: any) => ({
                        value: t.id,
                        label: `${t.code || ''} - ${t.name}`,
                      }))
                  },
                }}
              />
            </ProFormItem>
              </Col>

              <Col span={24}>
                <ProFormTextArea
                  name="remarks"
                  label="派工备注"
                  placeholder="请输入派工说明（可选）"
                  fieldProps={{ rows: 3 }}
                />
              </Col>
            </Row>
          </>
        )}
      </FormModalTemplate>

      {/* 拆分工单Modal */}
      <Modal
        title={
          currentWorkOrderForSplit &&
          ['split', '已拆分'].includes(currentWorkOrderForSplit.status || '')
            ? '拆分剩余数量'
            : '拆分工单'
        }
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
        {currentWorkOrderForSplit && (() => {
          const isFollowUpSplit = ['split', '已拆分'].includes(currentWorkOrderForSplit.status || '')
          const splitBudget = isFollowUpSplit
            ? Number(currentWorkOrderForSplit.split_remaining_quantity ?? 0)
            : Number(currentWorkOrderForSplit.quantity ?? 0)
          const splitTotal = splitQuantities.reduce((sum, q) => sum + q, 0)
          return (
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
                <strong>{isFollowUpSplit ? '原数量（剩余数量）：' : '原工单数量：'}</strong>
                {isFollowUpSplit
                  ? formatWorkOrderListQuantity(currentWorkOrderForSplit)
                  : currentWorkOrderForSplit.quantity}
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
                  min={isFollowUpSplit ? 1 : 2}
                  max={100}
                  placeholder={isFollowUpSplit ? '请输入拆分数（1-100）' : '请输入拆分数（2-100）'}
                  fieldProps={{
                    onChange: value => setSplitCount(value || (isFollowUpSplit ? 1 : 2)),
                  }}
                  extra={
                    <div style={{ marginTop: 8, color: '#999', fontSize: 12 }}>
                      每个工单数量：
                      {splitBudget
                        ? (splitBudget / splitCount).toFixed(2)
                        : 0}
                      {splitBudget && splitBudget % splitCount !== 0 && (
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
                    总数量：{splitTotal.toFixed(2)} / {splitBudget}
                    {!isFollowUpSplit && splitTotal !== splitBudget && (
                      <span style={{ color: '#ff4d4f' }}>（数量总和必须等于原工单数量）</span>
                    )}
                    {isFollowUpSplit && splitTotal > splitBudget && (
                      <span style={{ color: '#ff4d4f' }}>（数量总和不能大于剩余数量）</span>
                    )}
                  </div>
                </div>
              )}
            </ProForm>
          </div>
          )
        })()}
      </Modal>

      {/* 工单工序编辑Modal */}
      <FormModalTemplate
        title={
          currentOperation
            ? t('app.kuaizhizao.workOrder.modalEditOperation')
            : t('app.kuaizhizao.workOrder.modalAddOperation')
        }
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
              const operations = unwrapProcessPagedList(await operationApi.list({ isActive: true, limit: 1000 }))
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
              const workshops = factoryListItems(await workshopApi.list({ limit: 1000 }))
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
          fieldProps={buildFutureDateShortcutFieldProps({
            getForm: () => operationFormRef.current,
            fieldName: 'planned_end_date',
            baseFieldName: 'planned_start_date',
            t,
            fieldProps: { showTime: true },
          })}
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
          <Button {...rowActionKind('revoke')}
            key="cancel"
            onClick={() => {
              setBatchReleaseModalVisible(false)
              setBatchReleaseCheckResults([])
            }}
          >
            取消
          </Button>,
          <Button {...rowActionKind('skip')}
            key="ignore"
            onClick={() => handleSubmitBatchRelease(true)}
            disabled={batchReleaseLoading}
          >
            忽略异常，强制下达所有
          </Button>,
          <Button {...rowActionKind('submit')}
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
              <Space orientation="vertical" style={{ width: '100%' }} size="middle">
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
                        {result.workOrder.is_frozen && <Tag color="error">{t('app.kuaizhizao.workOrder.tagFrozen')}</Tag>}
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
          已选择 <strong>{selectedWorkOrderIds.length}</strong> 个工单进行冻结
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

      {/* 合并为组工单 Modal */}
      <FormModalTemplate
        title="合并为组工单"
        open={mergeModalVisible}
        onClose={() => {
          setMergeModalVisible(false)
          setMergeTargetWorkOrderIds([])
          mergeFormRef.current?.resetFields()
        }}
        onFinish={handleSubmitMerge}
        formRef={mergeFormRef}
        loading={mergeLoading}
        width={MODAL_CONFIG.STANDARD_WIDTH}
      >
        <div style={{ marginBottom: 16 }}>
          已选择 <strong>{mergeTargetWorkOrderIds.length}</strong> 张主工单编入同一工单组。
          <br />
          原工单均保留；列表以虚拟工单组为父行，成员平级展示，无需指定组成品。
        </div>
        <ProFormTextArea
          name="remarks"
          label="工单组名称"
          placeholder="请输入工单组名称（可选；未填则显示默认名称）"
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
            已选择 <strong>{selectedWorkOrderIds.length}</strong> 个工单
          </div>
          <div>
            <div style={{ marginBottom: 8 }}>优先级：</div>
            <Select
              value={batchPriority}
              onChange={value => setBatchPriority(value)}
              style={{ width: '100%' }}
            >
              <Select.Option value="low">{t('app.kuaizhizao.workOrder.priorityLow')}</Select.Option>
              <Select.Option value="normal">{t('app.kuaizhizao.workOrder.priorityNormal')}</Select.Option>
              <Select.Option value="high">{t('app.kuaizhizao.workOrder.priorityHigh')}</Select.Option>
              <Select.Option value="urgent">{t('app.kuaizhizao.workOrder.priorityUrgent')}</Select.Option>
            </Select>
          </div>
        </div>
      </Modal>

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
        destroyOnHidden
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
                    { label: t('app.kuaizhizao.workOrder.priorityUrgent'), value: 'urgent' },
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
                <Space orientation="vertical" style={{ width: '100%' }}>
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
                          { title: t('app.kuaizhizao.workOrder.colMaterial'), dataIndex: 'material_name' },
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

      <WorkOrderCompleteTrackingModal
        open={completeTrackingModalOpen}
        loading={completeTrackingLoading}
        workOrderCode={completeTrackingWorkOrder?.code}
        trackingMode={completeTrackingWorkOrder?.tracking_mode}
        plannedBatchNo={
          completeTrackingWorkOrder?.planned_batch_no ??
          completeTrackingWorkOrder?.effective_batch_no
        }
        plannedSerialNo={
          completeTrackingWorkOrder?.planned_serial_no ??
          completeTrackingWorkOrder?.effective_serial_no
        }
        onCancel={() => {
          setCompleteTrackingModalOpen(false)
          setCompleteTrackingWorkOrder(null)
        }}
        onConfirm={handleConfirmCompleteTracking}
      />
    </>
  )
}


export default WorkOrdersPage
