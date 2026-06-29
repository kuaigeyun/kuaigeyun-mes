/**
 * UniTable：统一 ProTable 封装（列表页表格区）
 *
 * 分层约定（与 uni-* 抽象对齐，便于页面与文档一致描述）：
 *
 * 1. **uni-staticcard（若有）**：统计/指标卡片不在本组件内；由 `ListPageTemplate.statCards` 或页面放在表格上方。
 * 2. **第一行工具区**（搜索行，`ProCard` 内 flex）：
 *    - **2.1 左侧**：**uni-search** — `UniSearch`（模糊/高级搜索、重置等）。
 *    - **2.2 右侧**：**uni-view** — `UniView`（表格/明细/卡片/看板/… 及 `customViews`）。
 * 3. **第二行工具区**（`ProTable` 的标题行 + 工具栏）：
 *    - **3.1 左侧功能按钮区** — `headerTitle` ← `buildLeftActions()`：**可选 `toolBarActionsBeforeCreate`**、**新建**、**uni-pull / uni-push**（下推请用 `UniPushToolbarButton`，`type="primary"` + `ArrowDownOutlined`，放 `toolBarActionsAfterCreate`；勿与右侧数据能力混排）、**uni-batch**（删除用 `UniBatchDeleteButton`；其它批量操作用 `UniBatchMenuButton` 或 `toolBarActionsAfterDelete`）、编辑、工具栏「详情」入口等；实现上通过 `headerActions` 或 `toolBarActions` / `toolBarActionsAfterDelete`，以及 **ProTable `toolBarRender` 的返回值（见下）** 注入。
 *    - **3.2 右侧** — 组件内 `buildRightActions()` + `toolbar.actions`：**uni-import**、**uni-export**、**uni-sync**、**数据集**（可选，位于同步后）、**打印**；**表格设定**为 ProTable 原生 **`options`**。
 *
 * **重要**：传入的 **`toolBarRender` 会被剥离后只在左侧复用**：其返回值并入 `headerTitle`，**不会**出现在 ProTable 默认右侧工具栏；传给 `ProTable` 的 `toolBarRender` 由本组件重写，仅负责同步选中行并渲染 **3.2** 内建按钮。
 *
 * 4. **表格**：右侧固定列顺序由 `normalizeFixedRightColumnOrder` 规范 — **uni-lifecycle**（`lifecycle_stage` / `lifecycle`）、**uni-action**（`uni-action` 模块约定，固定列垫后）。
 *    **主从堆叠列**（减横滚）：见 `stackedPrimaryColumn.tsx` — `UniTableStackedPrimaryCell` + `uniTablePrimaryFlex` + `UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS`。
 *    **行点击选中**（唯一控制源）：只要启用行选择（`enableRowSelection` 或 `rowSelection`），默认点击表身切换勾选；用 `disableRowClickSelection` 关闭。
 * 5. **详情 uni-detail**：列表侧由 `onDetail`、行内操作列等与页面级 **uni-detail**（如 `DetailDrawerTemplate`）配合；本文件不渲染详情壳。
 *
 * **组装清单（子模块）**：`UniSearch`、`UniView`、`UniPushToolbarButton`、`UniBatchDeleteButton`（及通用 `UniBatchButton`）、`UniImportToolbarButton` + `UniImport`、`UniExportMenuButton`、`UniSyncButton`；列侧 `uni-action` / `uni-lifecycle` 在列定义中接入。
 */

import React, {
  useRef,
  ReactNode,
  useState,
  useEffect,
  useCallback,
  useMemo,
  Suspense,
  lazy,
} from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { translatePathTitle } from '../../utils/menuTranslation'
import {
  ProTable,
  ProCard,
  ActionType,
  ProColumns,
  ProFormInstance,
  ProTableProps,
} from '@ant-design/pro-components'
import type { ColumnsState } from '@ant-design/pro-table'
import { Button, Space, theme, Empty, ConfigProvider, Grid, Descriptions, Card, Tag, Tooltip } from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  EyeOutlined,
  PrinterOutlined,
  TableOutlined,
  AppstoreOutlined,
  BarsOutlined,
  BarChartOutlined,
  PieChartOutlined,
  TabletOutlined,
  QuestionCircleOutlined,
  ProjectOutlined,
} from '@ant-design/icons'
import { isPinyinKeyword, matchPinyinInitialsAsync } from '../../utils/pinyin'
import UniSearch from '../uni-search'
import UniView from '../uni-view'
import { UniBatchDeleteButton } from '../uni-batch'
import { UniSyncButton } from '../uni-sync'
import { UniImportToolbarButton } from '../uni-import'
import { UniExportMenuButton } from '../uni-export'

// 懒加载：UniImport 内含 UniverJS（约 2MB+），仅在用户点击导入时加载
const LazyUniImport = lazy(() => import('../uni-import'))

/** 容器宽度低于此值时，工具栏右侧导入/导出/同步仅显示图标 */
const DATA_ACTION_ICON_ONLY_MAX_WIDTH = 1280

/** 行点击切换勾选：命中可操作子元素时不切换，避免误选（成本仅一次 DOM closest） */
function shouldIgnoreRowClickForSelection(target: Element): boolean {
  return !!target.closest(
    [
      'a',
      'button',
      'input',
      'textarea',
      'select',
      'label',
      '[contenteditable="true"]',
      '[role="button"]',
      '[role="menuitemcheckbox"]',
      '[role="switch"]',
      '.ant-checkbox',
      '.ant-radio',
      '.ant-select',
      '.ant-picker',
      '.ant-btn',
      '.ant-switch',
      '.ant-table-selection-column',
      '.ant-table-row-expand-icon',
      '.ant-slider',
      '.ant-rate',
      '.ant-typography-copy',
    ].join(','),
  )
}
// 内联的 useProTableSearch hook（简化实现）
const useProTableSearch = () => {
  const searchParamsRef = useRef<Record<string, any> | undefined>(undefined)
  const formRef = useRef<ProFormInstance>()
  const actionRef = useRef<ActionType>()

  return {
    searchParamsRef,
    formRef,
    actionRef,
  }
}
import { useConfigStore } from '../../stores/configStore'
import { useListPageStatCardsContext } from '../layout-templates/listPageStatCardsContext'
import { useUserPreferenceStore } from '../../stores/userPreferenceStore'
import { useAntdResizableHeader } from 'use-antd-resizable-header'
import 'use-antd-resizable-header/dist/style.css'
import { TableContext } from '@ant-design/pro-table/es/Store/Provide'
import { formatDateBySiteSetting, formatDateTimeBySiteSetting } from '../../utils/format'
import { useNewShortcut } from '../../hooks/useNewShortcut'
import { usePagePermissionResource } from '../../hooks/usePagePermissionResource'
import { useResourcePermissions } from '../../hooks/useResourcePermissions'
import { withSingleNewShortcutHint } from '../../utils/globalNewShortcut'
import { DictionaryLabel } from '../dictionary-label'
import { stableJsonForQueryKey } from '../../utils/tableQueryKey'
import { isUniTableOperationColumn, renderUniTableOperationCell } from '../uni-action'
import { LIST_PAGE_TABLE_SCROLL, getViewportHeightExpr } from '../layout-templates/constants'
import {
  shouldEnableUniTableBodyScrollY,
  measureTableBodyOverflowsViewport,
} from './uniTableScrollPolicy'
import {
  getUniTableLifecycleCellClassName,
  isUniTableLifecycleColumn,
  resolveUniTableLifecycleColumnWidth,
  resolveUniTableOperationColumnWidth,
  UNI_TABLE_LIFECYCLE_MIN_WIDTH,
  UNI_TABLE_OPERATION_MIN_WIDTH,
  UNI_TABLE_SELECTION_COL_WIDTH,
  computeUniTableMinScrollX,
} from '../../utils/uniTableLayoutColumns'

/**
 * 右侧固定列必须连续排在列定义末尾；规范顺序：其它 right 固定列 → 生命周期（lifecycle_stage / lifecycle）→ 操作列。
 * 避免列设置持久化 order 与拖拽把生命周期挤到操作列右侧或中间。
 */
function normalizeFixedRightColumnOrder<T extends Record<string, any>>(columns: T[]): T[] {
  if (!columns?.length) return columns
  const rest: T[] = []
  const fixedRight: T[] = []
  for (const col of columns) {
    if ((col as any).fixed === 'right') fixedRight.push(col)
    else rest.push(col)
  }
  if (fixedRight.length <= 1) return columns

  const isLifecycle = (c: any) => isUniTableLifecycleColumn(c)

  fixedRight.sort((a: any, b: any) => {
    const rank = (c: any) => (isUniTableOperationColumn(c) ? 2 : isLifecycle(c) ? 1 : 0)
    return rank(a) - rank(b)
  })
  return [...rest, ...fixedRight]
}

function applyLifecycleColumnAlignLeft<T extends Record<string, any>>(columns: T[]): T[] {
  if (!columns?.length) return columns
  return columns.map((col: any) => {
    if (!isUniTableLifecycleColumn(col)) return col
    return { ...col, align: 'left' as const }
  })
}

/** 短人名类字段保留页面 width（如销售员/采购员），不做内容撑宽。 */
const UNI_TABLE_SHORT_NAME_FIELDS = new Set([
  'salesman_name',
  'buyer_name',
  'operator_name',
  'user_name',
  'creator_name',
  'updater_name',
  'auditor_name',
])

const UNI_TABLE_STRUCTURED_VALUE_TYPES = new Set([
  'date',
  'dateTime',
  'dateRange',
  'time',
  'money',
  'digit',
  'digitRange',
  'select',
  'progress',
  'index',
  'indexBorder',
])

function isUniTableLayoutColumn(col: any): boolean {
  return (
    col?.hideInTable === true ||
    isUniTableOperationColumn(col) ||
    isUniTableLifecycleColumn(col)
  )
}

/** 主文本列：去掉固定 width，配合 scroll.x=max-content 由内容决定列宽（销售订单已验证策略）。 */
function isUniTableFlexTextColumn(col: any): boolean {
  if (isUniTableLayoutColumn(col)) return false
  if (col?.fixed) return false
  if (col?.resizable === false || col?.uniTableKeepWidth === true) return false

  const dataIndex = typeof col?.dataIndex === 'string' ? col.dataIndex : ''
  if (!dataIndex) return false
  if (UNI_TABLE_SHORT_NAME_FIELDS.has(dataIndex)) return false
  if (col?.valueType && UNI_TABLE_STRUCTURED_VALUE_TYPES.has(String(col.valueType))) return false
  if (/(^code$|_code$)/.test(dataIndex)) return false

  if (
    /_(name|title|remark|description|desc|note|notes|comment|address|specification)$|^(name|title|remark|description|note|comment)$/.test(
      dataIndex,
    )
  ) {
    return true
  }

  return col?.ellipsis === true && !col?.valueType
}

/** 页面标记的主信息列：释放 width、保留 minWidth，用于吃掉表格剩余横向空间（如客户/名称） */
function isUniTablePrimaryFlexColumn(col: any): boolean {
  return col?.uniTablePrimaryFlex === true
}

/** 结构化/短名列不参与「兜底 strip」，避免更新时间/金额等被拉宽 */
function isUniTableProtectedWidthColumn(col: any): boolean {
  if (col?.uniTableKeepWidth === true || col?.resizable === false) return true
  const dataIndex = typeof col?.dataIndex === 'string' ? col.dataIndex : ''
  if (dataIndex && UNI_TABLE_SHORT_NAME_FIELDS.has(dataIndex)) return true
  if (col?.valueType && UNI_TABLE_STRUCTURED_VALUE_TYPES.has(String(col.valueType))) return true
  return false
}

function stripUniTableColumnWidth(col: any): any {
  if (col?.width == null) return col
  const { width: _width, ...rest } = col
  return rest
}

/**
 * 全项目列宽策略（与 scroll.x=max-content 配合）：
 * 1. 主文本列 / uniTablePrimaryFlex 列去掉 width，由内容或 minWidth 撑开；
 * 2. 若可见数据列仍全部带 width，仅从 flex 候选列释放一列（禁止误伤 dateTime/金额等定宽列）。
 */
function hasUniTableFixedColumns(columns: any[]): boolean {
  return columns.some(
    (c) => !c.hideInTable && (c.fixed === 'left' || c.fixed === 'right'),
  )
}

function applyUniTableColumnWidthPolicy(columns: any[], preserveWidths = false): any[] {
  if (!columns?.length || preserveWidths) return columns

  let result = columns.map((col) =>
    isUniTableFlexTextColumn(col) || isUniTablePrimaryFlexColumn(col)
      ? stripUniTableColumnWidth(col)
      : col,
  )

  const dataCols = result.filter((col) => !isUniTableLayoutColumn(col))
  const allHaveWidth = dataCols.length > 0 && dataCols.every((col) => col.width != null)
  if (!allHaveWidth) return result

  let stripIdx = -1
  for (let i = result.length - 1; i >= 0; i--) {
    const col = result[i]
    if (isUniTableLayoutColumn(col) || col?.fixed || isUniTableProtectedWidthColumn(col)) continue
    if (isUniTableFlexTextColumn(col) || isUniTablePrimaryFlexColumn(col)) {
      stripIdx = i
      break
    }
  }
  if (stripIdx < 0) return result

  return result.map((col, i) => (i === stripIdx ? stripUniTableColumnWidth(col) : col))
}

/** 表头单元格与表身对齐：nowrap + 可选语义 class（生命周期 / 操作列）。 */
function mergeUniTableHeaderCell(col: any, cellClassName?: string): any {
  const userOnHeaderCell = col.onHeaderCell
  return {
    ...col,
    onHeaderCell: (...args: any[]) => {
      const base =
        typeof userOnHeaderCell === 'function'
          ? userOnHeaderCell(...args) || {}
          : userOnHeaderCell || {}
      const mergedClass = [cellClassName, base.className].filter(Boolean).join(' ').trim()
      return {
        ...base,
        ...(mergedClass ? { className: mergedClass } : {}),
        style: {
          whiteSpace: 'nowrap',
          ...(base.style || {}),
        },
      }
    },
  }
}

/** 为所有可见表格列注入表头 onHeaderCell，与表身 nowrap / 生命周期 / 操作列 class 一致。 */
function applyUniTableHeaderCellPolicy(columns: any[]): any[] {
  return columns.map((col) => {
    if (col.hideInTable) return col
    if (isUniTableOperationColumn(col)) {
      return mergeUniTableHeaderCell(col, 'uni-table-operation-cell')
    }
    if (isUniTableLifecycleColumn(col)) {
      return mergeUniTableHeaderCell(col, getUniTableLifecycleCellClassName(col))
    }
    return mergeUniTableHeaderCell(col)
  })
}

function finalizeUniTableColumns(columns: any[]): any[] {
  return applyUniTableHeaderCellPolicy(
    applyLifecycleColumnAlignLeft(normalizeFixedRightColumnOrder(columns)),
  )
}

/** 工具栏节点并入 Space 前补 key（toolBarRender / toolBarActions* 常返回无 key 的组件） */
function withToolbarItemKeys(nodes: ReactNode[], keyPrefix: string): ReactNode[] {
  return React.Children.toArray(nodes).map((node, index) => {
    if (React.isValidElement(node) && node.key != null) {
      return node
    }
    const key = `${keyPrefix}-${index}`
    if (React.isValidElement(node)) {
      return React.cloneElement(node, { key })
    }
    return <React.Fragment key={key}>{node}</React.Fragment>
  })
}

/** 与 ProTable genColumnKey / 列设置持久化 key 一致（无 key 且无 dataIndex 时用列下标） */
function getProColumnStateKey(col: any, columnIndex: number): string {
  const key = col?.key ?? col?.dataIndex
  if (key != null && key !== '') {
    return Array.isArray(key) ? key.join('-') : String(key)
  }
  return String(columnIndex)
}

/**
 * 按当前列定义中「规范化后的右侧固定列」顺序写入 order，用于覆盖 localStorage 里错误的相对顺序。
 * ProTable 合并规则为 merge(defaultValue, storage)，storage 会盖住 default，故必须在持久化层纠偏。
 */
function buildFixedRightColumnOrderOverlay(columns: any[]): Record<string, { order: number }> {
  if (!columns?.length) return {}
  const normalized = normalizeFixedRightColumnOrder(columns)
  const out: Record<string, { order: number }> = {}
  let o = 1_000_000
  for (let i = 0; i < normalized.length; i++) {
    const col = normalized[i]
    if (col?.fixed !== 'right') continue
    const k = getProColumnStateKey(col, i)
    out[k] = { order: o++ }
  }
  return out
}

/**
 * ProTable：若存在 columnsState.defaultValue，会用它整段替代「从 columns 推导的 defaultColumnKeyMap」，
 * 故必须给出**完整**列 key 映射，再为右侧固定列写入递增 order（生命周期在操作列左侧）。
 */
function buildDefaultColumnsStateMap(columns: any[]): Record<string, any> {
  const map: Record<string, any> = {}
  columns.forEach((col: any, index: number) => {
    const columnKey = getProColumnStateKey(col, index)
    map[columnKey] = {
      show: true,
      fixed: col.fixed,
      disable: col.disable,
    }
  })
  let order = 900_000
  columns.forEach((col: any, index: number) => {
    if (col?.fixed !== 'right') return
    const columnKey = getProColumnStateKey(col, index)
    map[columnKey] = {
      ...map[columnKey],
      order: order++,
      fixed: 'right',
      show: true,
    }
  })
  return map
}

/** 列展示重置按钮：同时恢复列显示和列宽到系统默认（需在 ProTable 内部渲染以访问 TableContext） */
function TableColumnResetButton({
  onResetResizable,
}: {
  onResetResizable: () => void
}) {
  const { t } = useTranslation()
  const counter = React.useContext(TableContext)
  const { clearPersistenceStorage, setColumnsMap, defaultColumnKeyMap } = counter || {}
  const handleClick = () => {
    clearPersistenceStorage?.()
    setColumnsMap?.(defaultColumnKeyMap || {})
    onResetResizable()
  }
  return (
    <a onClick={handleClick} className="ant-pro-table-column-setting-action-rest-button" style={{ marginLeft: 8 }}>
      {t('components.uniTable.columnReset', '重置')}
    </a>
  )
}

/**
 * 从 columns 自动生成导入配置
 *
 * @param columns - 表格列定义
 * @param options - 配置选项
 * @returns 导入配置（表头、示例数据、字段映射、验证规则）
 */
function generateImportConfigFromColumns<T extends Record<string, any>>(
  columns: ProColumns<T>[],
  options?: {
    excludeFields?: string[]
    includeFields?: string[]
    fieldMap?: Record<string, string>
    fieldRules?: Record<
      string,
      { required?: boolean; validator?: (value: any) => boolean | string }
    >
    t?: (key: string, opts?: { [key: string]: any }) => string
  }
) {
  const {
    excludeFields = ['id', 'created_at', 'updated_at', 'deleted_at'],
    includeFields,
    fieldMap: customFieldMap = {},
    fieldRules: customFieldRules = {},
    t = (k: string, o?: any) => (typeof o?.defaultValue === 'string' ? o.defaultValue : k),
  } = options || {}

  const headers: string[] = []
  const exampleRow: string[] = []
  const fieldMap: Record<string, string> = { ...customFieldMap }
  const fieldRules: Record<
    string,
    { required?: boolean; validator?: (value: any) => boolean | string }
  > = { ...customFieldRules }

  // 过滤可导入的列
  const importableColumns = columns.filter(col => {
    const dataIndex = col.dataIndex
    if (!dataIndex) return false

    const fieldName = Array.isArray(dataIndex) ? dataIndex.join('.') : String(dataIndex)

    // 排除字段
    if (excludeFields.includes(fieldName)) return false

    // 如果指定了包含字段，只包含这些字段
    if (includeFields && !includeFields.includes(fieldName)) return false

    // 排除隐藏的列（hideInTable）
    if (col.hideInTable) return false

    // 排除操作列（通常没有 dataIndex 或 dataIndex 为 'option'）
    if (fieldName === 'option' || fieldName === 'action') return false

    return true
  })

  // 生成表头、示例数据和字段映射
  importableColumns.forEach(col => {
    const dataIndex = col.dataIndex
    const fieldName = Array.isArray(dataIndex) ? dataIndex.join('.') : String(dataIndex)
    const title = (col.title as string) || fieldName

    // 生成表头（支持必填标识）
    // 检查是否必填：通过 required 属性或 fieldProps.required
    const isRequired = (col as any).required === true || (col.fieldProps as any)?.required === true
    const headerTitle = isRequired ? `*${title}` : title
    headers.push(headerTitle)

    // 生成示例数据
    let exampleValue = ''
    if (col.valueType === 'select' || col.valueEnum) {
      // 枚举类型，使用第一个选项
      const valueEnum = col.valueEnum as any
      if (valueEnum && typeof valueEnum === 'object') {
        const firstOption = Object.keys(valueEnum)[0]
        exampleValue = valueEnum[firstOption]?.text || firstOption || ''
      } else {
        exampleValue = t('components.uniTable.exampleValue')
      }
    } else if (col.valueType === 'date' || col.valueType === 'dateTime') {
      exampleValue = '2024-01-01'
    } else if (col.valueType === 'digit') {
      exampleValue = '0'
    } else if (col.valueType === 'switch' || col.valueType === 'checkbox') {
      exampleValue = t('components.uniTable.exampleYes')
    } else {
      exampleValue = t('components.uniTable.exampleField', { title })
    }
    exampleRow.push(exampleValue)

    // 生成字段映射（支持多种表头名称映射到同一个字段）
    const normalizedTitle = title.trim()
    const normalizedHeaderTitle = headerTitle.trim()

    // 支持多种映射方式
    fieldMap[normalizedTitle] = fieldName
    fieldMap[normalizedHeaderTitle] = fieldName
    fieldMap[fieldName] = fieldName // 直接使用字段名也可以

    // 如果字段名和标题不同，也建立映射
    if (fieldName !== normalizedTitle) {
      fieldMap[fieldName] = fieldName
    }

    // 生成验证规则
    if (!fieldRules[fieldName]) {
      fieldRules[fieldName] = {}
    }

    // 检查是否必填
    if (isRequired || (col as any).required === true) {
      fieldRules[fieldName].required = true
    }

    // 添加类型验证
    if (col.valueType === 'digit') {
      fieldRules[fieldName].validator = (value: any) => {
        if (value && isNaN(Number(value))) {
          return t('components.uniTable.validatorNumber', { title })
        }
        return true
      }
    } else if (col.valueType === 'date' || col.valueType === 'dateTime') {
      fieldRules[fieldName].validator = (value: any) => {
        if (value && isNaN(new Date(value).getTime())) {
          return t('components.uniTable.validatorDate', { title })
        }
        return true
      }
    }
  })

  return {
    headers,
    exampleRow,
    fieldMap,
    fieldRules,
  }
}

/**
 * 统一 ProTable 组件属性
 */
/** 清除 UniTable 列表 TanStack 缓存（与工具栏 refresh 相同语义），便于跨页 mutation 后其它列表立即拉新数据。 */
export function invalidateUniTableListCache(
  queryClient: QueryClient,
  ...columnPersistenceIds: string[]
): void {
  for (const id of columnPersistenceIds) {
    const trimmed = id.trim()
    if (!trimmed) continue
    const queryKey = ['uniTable', trimmed] as const
    void queryClient.cancelQueries({ queryKey, exact: false })
    queryClient.removeQueries({ queryKey, exact: false })
  }
}

export interface UniTableProps<T extends Record<string, any> = Record<string, any>>
  extends Omit<ProTableProps<T, any>, 'request'> {
  /**
   * 数据请求函数
   * 已内置排序参数处理，直接使用即可
   *
   * @param params - 分页参数（current, pageSize）
   * @param sort - 排序参数
   * @param filter - 筛选参数
   * @param searchFormValues - 搜索表单值（从 searchParamsRef 或 formRef 获取）
   * @returns 数据响应
   */
  request: (
    params: any,
    sort: Record<string, 'ascend' | 'descend' | null>,
    filter: Record<string, React.ReactText[] | null>,
    searchFormValues?: Record<string, any>
  ) => Promise<{
    data: T[]
    success: boolean
    total: number
  }>
  /**
   * 表格列定义
   */
  columns: ProColumns<T>[]
  /**
   * 表格标题（已废弃，使用 headerActions 替代）
   * @deprecated 使用 headerActions 替代
   */
  headerTitle?: string
  /**
   * 完全自定义 **3.1 左侧功能按钮区**（若提供则不再走 `buildLeftActions` 默认拼装）。
   * uni-pull / uni-push / uni-batch 等请与此区或 `toolBarActions` / `toolBarRender` 保持一致。
   */
  headerActions?: ReactNode
  /**
   * 行主键字段名（默认：'id'）
   */
  rowKey?: string | ((record: T, index?: number) => string)
  /**
   * 是否显示基础模糊搜索框（默认：true）
   */
  showFuzzySearch?: boolean
  /**
   * 为 true 时不在前端对「全字母关键词」做拼音首字母二次过滤（适用于已在 request 内把 `keyword` 交给后端全表搜索的列表）。
   * 默认 false：保留拼音首字母与当前页数据组合的旧行为。
   */
  skipFuzzyPinyinClientFilter?: boolean
  /** 模糊搜索框占位文案（传给 UniSearch） */
  fuzzySearchPlaceholder?: string
  /**
   * 是否显示高级搜索按钮（默认：true）
   */
  showAdvancedSearch?: boolean
  /**
   * uni-search 位置：`searchRow` 为表格上方独立搜索行（默认）；`toolbarLeft` 为表格工具栏左侧（模糊/高级/重置不拆分）
   */
  searchPlacement?: 'searchRow' | 'toolbarLeft'
  /**
   * 高级搜索按钮前的自定义按钮
   */
  beforeSearchButtons?: ReactNode
  /**
   * 模糊搜索与高级搜索之间的自定义节点（典型：列表快速筛选 Segmented）
   */
  betweenFuzzyAndAdvancedButtons?: ReactNode
  /**
   * 高级搜索按钮后的自定义按钮
   */
  afterSearchButtons?: ReactNode
  /**
   * 是否启用行选择（默认：false）
   */
  enableRowSelection?: boolean
  /**
   * 行选择变化回调
   */
  onRowSelectionChange?: (selectedRowKeys: React.Key[]) => void
  /**
   * 表格当前页数据变更（含 TanStack 缓存命中路径；用于列表页同步选中行解析等副作用）
   */
  onTableDataChange?: (data: T[]) => void
  /**
   * 选中的行键数组（用于受控模式，例如在外部清除选中状态）
   */
  selectedRowKeys?: React.Key[]
  /**
   * 行选择 checkbox 的 getCheckboxProps（用于树形表禁止勾选子行等）
   */
  rowSelectionGetCheckboxProps?: (record: T) => { disabled?: boolean }
  /**
   * 关闭「点击表身切换勾选」（默认 false；仅特殊交互表需要显式关闭）
   */
  disableRowClickSelection?: boolean
  /**
   * 是否启用行编辑（默认：false）
   */
  enableRowEdit?: boolean
  /**
   * 行编辑保存回调
   */
  onRowEditSave?: (key: React.Key, row: T) => Promise<void>
  /**
   * 行编辑删除回调
   */
  onRowEditDelete?: (key: React.Key, row: T) => Promise<void>
  /**
   * **3.1 左侧**，在新建按钮之前的节点（典型：从外部单据创建入口）。
   */
  toolBarActionsBeforeCreate?: ReactNode[]
  /**
   * **3.1 左侧**，紧接在新建（含 uni-pull 入口）之后的节点（典型：`UniPushToolbarButton` / uni-push）。
   */
  toolBarActionsAfterCreate?: ReactNode[]
  /**
   * **3.1 左侧**追加的功能节点（与新建、`toolBarRender` 注入、批量删除、编辑等同一 `Space`）。
   */
  toolBarActions?: ReactNode[]
  /**
   * **3.1 左侧**，紧接在批量删除（uni-batch 删除预设）之后的节点（如下推后的说明、与删除无关的按钮）。
   */
  toolBarActionsAfterDelete?: ReactNode[]
  /**
   * **3.1 左侧**，批量功能区（uni-batch）后的通用业务动作。
   */
  toolBarActionsAfterBatch?: ReactNode[]
  /**
   * 是否显示导入按钮（默认：true）
   */
  showImportButton?: boolean
  /**
   * 导入按钮点击回调
   * @param data - 导入的数据（二维数组格式）
   */
  onImport?: (data: any[][]) => void
  /**
   * 导入入库前预检（UniImport 预览弹窗内调用；返回 errors 时禁止确认入库）
   */
  onImportPrecheck?: (data: any[][]) => Promise<{
    canImport?: boolean
    errors?: string[]
    warnings?: string[]
  } | void>
  /**
   * 导入表头（可选，如果提供则自动填充第一行）
   * 如果不提供，将自动从 columns 中提取可导入的字段生成表头
   */
  importHeaders?: string[]
  /**
   * 导入示例数据（可选，如果提供则自动填充第二行作为示例）
   * 如果不提供，将自动从 columns 中提取字段生成示例数据
   */
  importExampleRow?: string[]
  /**
   * 导入模板文件名中的单据/页面名称（默认：headerTitle 或当前路由菜单标题）
   */
  importTemplateName?: string
  /**
   * 导入字段映射配置（可选）
   * 用于将表头名称映射到字段名，如果不提供，将自动从 columns 中提取
   * 格式：{ '表头名称': '字段名' } 或 { '字段名': '表头名称' }
   */
  importFieldMap?: Record<string, string>
  /**
   * 是否启用自定义导入字段选择
   */
  enableCustomImport?: boolean
  /**
   * 是否启用高级关联导入
   */
  enableRelationImport?: boolean
  /**
   * 高级关联导入配置
   */
  relationImportConfig?: {
    entities?: Array<'material' | 'processRoute' | 'operation' | 'performance'>
    defaultWriteStrategy?: 'upsert' | 'create_only' | 'link_only' | 'strict_fail'
    supportedStrategies?: Array<'upsert' | 'create_only' | 'link_only' | 'strict_fail'>
  }
  /**
   * 高级关联导入预检
   */
  onRelationImportPrecheck?: (payload: {
    rawRows: string[][]
    entities: Array<'material' | 'processRoute' | 'operation' | 'performance'>
    writeStrategy: 'upsert' | 'create_only' | 'link_only' | 'strict_fail'
  }) => Promise<{
    success?: boolean
    message?: string
    summary?: { created?: number; updated?: number; linked?: number; failed?: number }
    errors?: string[]
    warnings?: string[]
  } | void>
  /**
   * 高级关联导入提交
   */
  onRelationImportSubmit?: (payload: {
    rawRows: string[][]
    entities: Array<'material' | 'processRoute' | 'operation' | 'performance'>
    writeStrategy: 'upsert' | 'create_only' | 'link_only' | 'strict_fail'
  }) => Promise<{
    success?: boolean
    message?: string
    summary?: { created?: number; updated?: number; linked?: number; failed?: number }
    errors?: string[]
    warnings?: string[]
  } | void>
  /**
   * 导入字段验证规则（可选）
   * 用于定义哪些字段是必填的，以及字段的验证规则
   * 格式：{ '字段名': { required: true, validator?: (value: any) => boolean } }
   */
  importFieldRules?: Record<
    string,
    { required?: boolean; validator?: (value: any) => boolean | string }
  >
  /**
   * 是否自动从 columns 生成导入配置（默认：true）
   * 如果为 true，将自动从 columns 中提取可导入的字段生成表头、示例数据和字段映射
   */
  autoGenerateImportConfig?: boolean
  /**
   * 是否显示导出按钮（默认：true）
   */
  showExportButton?: boolean
  /**
   * 导出按钮点击回调
   * @param type - 导出类型：'selected' 导出选中、'currentPage' 导出本页、'all' 导出全部
   * @param selectedRowKeys - 选中的行键数组（仅当 type 为 'selected' 时有效）
   * @param currentPageData - 当前页数据（仅当 type 为 'currentPage' 时有效）
   */
  onExport?: (
    type: 'selected' | 'currentPage' | 'all',
    selectedRowKeys?: React.Key[],
    currentPageData?: T[]
  ) => void
  /**
   * 导出按钮主文案（默认：i18n 的 components.uniTable.export）
   */
  exportButtonText?: string
  /**
   * 右侧工具栏：插入在导入/导出图标组之前的附加按钮（如自定义上传）
   */
  rightToolBarActionsBeforeExport?: ReactNode[]
  /**
   * 是否显示同步按钮（默认：false）
   * 用于从数据集同步数据，仅业务主数据/单据类页面使用
   */
  showSyncButton?: boolean
  /**
   * 同步按钮点击回调
   * 可选择数据集并从其他系统同步数据
   */
  onSync?: () => void
  /**
   * 同步按钮文案（默认：'同步'）
   */
  syncButtonText?: string
  /**
   * 是否显示「数据集」配置入口按钮（默认：false；位于同步按钮之后）
   * 右侧顺序：导入 → 导出 → **本按钮** → 同步 → 打印（与「同步」同一工具区，占同步前一位）。
   */
  showDatasetConfigButton?: boolean
  /** 「数据集」配置入口点击回调（如打开绑定数据集弹窗） */
  onDatasetConfig?: () => void
  /** 按钮文案（不传则用 i18n `components.uniTable.datasetConfig`） */
  datasetConfigButtonText?: string
  /**
   * 是否显示打印按钮（默认：false，位于右侧：导入/导出/同步/打印/表格设置）。
   */
  showPrintButton?: boolean
  /**
   * 打印按钮点击回调（默认按选中行触发；未选中或多选时按钮禁用）。
   */
  onPrint?: (selectedRowKeys: React.Key[], currentPageData?: T[]) => void
  /**
   * 打印按钮文案（不传则用 i18n `components.uniTable.print`）
   */
  printButtonText?: string
  /**
   * 功能资源前缀（app:module），用于按权限隐藏工具栏/行内按钮。
   * 不传时从当前路由在导航菜单上的 permission_code 自动解析。
   */
  permissionResource?: string
  /**
   * 与 permissionResource 配合：新建按钮接受「来源单据 :complete」或「本页 :create」。
   * 值为来源单据资源前缀（app:module）。
   */
  completeCreateSourceResource?: string
  /**
   * 是否显示新建按钮（默认：false）
   */
  showCreateButton?: boolean
  /**
   * 新建按钮点击回调
   */
  onCreate?: () => void
  /**
   * 新建按钮文案（默认：'新建'，可设为 '新建用户' 等）
   */
  createButtonText?: string
  /**
   * 是否显示修改按钮（默认：false）
   * 需要先选中一行才能点击
   */
  showEditButton?: boolean
  /**
   * 修改按钮点击回调
   * @param selectedRowKeys - 选中的行键数组
   */
  onEdit?: (selectedRowKeys: React.Key[]) => void
  /**
   * 查看详情（需选中一行，行为与「修改」一致）
   */
  onDetail?: (selectedRowKeys: React.Key[]) => void | Promise<void>
  /**
   * 详情按钮文案
   */
  detailButtonText?: string
  /**
   * 是否显示删除按钮（默认：false）
   * 需要先选中一行才能点击
   */
  showDeleteButton?: boolean
  /**
   * 删除按钮点击回调
   * @param selectedRowKeys - 选中的行键数组
   */
  onDelete?: (selectedRowKeys: React.Key[]) => void
  /**
   * 删除按钮文案（默认：'删除'，可设为 '批量删除' 等）
   */
  deleteButtonText?: string
  /**
   * 批量删除二次确认标题（与仓库管理页 Popconfirm 模式对齐，不传则用 common.confirmBatchDelete）
   */
  deleteConfirmTitle?: string | ((count: number) => string)
  /**
   * 批量删除二次确认描述（不传则用 common.confirmBatchDeleteContent）
   */
  deleteConfirmDescription?: string | ((count: number) => string)
  /**
   * 批量删除按钮禁用（如选中行均不可删）；无选中时仍由组件内部 disableWhenEmpty 处理
   */
  deleteButtonDisabled?: boolean
  /**
   * 默认分页大小（默认：20）
   */
  defaultPageSize?: number
  /**
   * 是否显示快速跳转（默认：true）
   */
  showQuickJumper?: boolean
  /**
   * 视图类型配置
   * 支持：'table' | 'detailTable' | 'help' | 'card' | 'kanban' | 'stats' | 'touch' | 'gantt'
   * 默认：['table', 'help'] - 表格视图 + 帮助视图
   */
  viewTypes?: Array<'table' | 'detailTable' | 'help' | 'card' | 'kanban' | 'stats' | 'touch' | 'gantt' | (string & {})>
  /**
   * 默认视图类型（默认：'table'）
   */
  defaultViewType?: 'table' | 'detailTable' | 'help' | 'card' | 'kanban' | 'stats' | 'touch' | 'gantt' | (string & {})
  /**
   * 视图切换回调
   */
  onViewTypeChange?: (viewType: string) => void
  /**
   * 使用表格展示的视图类型（除 table/detailTable 外，自定义视图也可复用 ProTable 展示）
   * 例如：['productBom', 'allBom'] 时，成品BOM/全部BOM 切换时仍显示同一表格，仅数据过滤不同
   */
  tableViewTypes?: string[]
  /**
   * 帮助视图配置（仅当 viewTypes 包含 'help' 时生效）
   */
  helpViewConfig?: {
    /** 自定义帮助内容 */
    content?: ReactNode
    /** 帮助标题（默认：使用帮助） */
    title?: string
  }
  /**
   * 明细表格视图列（仅当 viewTypes 包含 'detailTable' 时生效，用于明细平铺表格）
   */
  detailTableColumns?: ProColumns<T>[]
  /**
   * 甘特图视图配置（仅当 viewTypes 包含 'gantt' 时生效）
   */
  ganttViewConfig?: {
    /** 自定义甘特图渲染 */
    renderGantt?: (data: T[]) => ReactNode
  }
  /**
   * 卡片视图配置（仅当 viewTypes 包含 'card' 时生效）
   */
  cardViewConfig?: {
    /**
     * 卡片渲染函数
     * @param item - 数据项
     * @param index - 索引
     */
    renderCard?: (item: T, index: number) => ReactNode
    /**
     * 每行卡片数量（响应式，默认：[2, 3, 4]）
     */
    columns?:
      | number
      | { xs?: number; sm?: number; md?: number; lg?: number; xl?: number; xxl?: number }
    /**
     * 分组字段（如按生命周期分组），分组后每组内使用瀑布流布局
     */
    groupByField?: string
    /**
     * 布局：grid 网格 | waterfall 瀑布流
     */
    layout?: 'grid' | 'waterfall'
    /**
     * 卡片视图无数据时的占位（不传则使用全局默认空状态文案）
     */
    emptyCard?: ReactNode
    /**
     * 叠放组：同一组内应用合并为一个网格位（如快制造三卡叠加）
     * codes 顺序为从后到前，末项为前景
     */
    cardStackGroups?: Array<{
      codes: string[]
      renderStack: (
        items: T[],
        renderCard: (item: T, index: number) => ReactNode,
      ) => ReactNode
    }>
  }
  /**
   * 看板视图配置（仅当 viewTypes 包含 'kanban' 时生效）
   */
  kanbanViewConfig?: {
    /**
     * 状态字段名（用于分组，默认：'status'）
     */
    statusField?: string
    /**
     * 状态分组配置
     * @example { 'pending': '待处理', 'processing': '处理中', 'completed': '已完成' }
     */
    statusGroups?: Record<string, { title: string; color?: string }>
    /**
     * 卡片渲染函数
     * @param item - 数据项
     * @param status - 状态值
     */
    renderCard?: (item: T, status: string) => ReactNode
  }
  /**
   * 统计视图配置（仅当 viewTypes 包含 'stats' 时生效）
   */
  statsViewConfig?: {
    /**
     * 统计指标配置
     */
    metrics?: Array<{
      key: string
      label: string
      value: (data: T[]) => number | string
      formatter?: (value: number | string) => string
    }>
    /**
     * 图表配置
     */
    charts?: Array<{
      type: 'bar' | 'line' | 'pie' | 'area'
      title: string
      data: (data: T[]) => any[]
      config?: any
    }>
  }
  /**
   * 自定义视图配置（用于扩展视图类型，如树形表格等）
   * 每个视图需提供 key、label、icon、render 函数
   */
  customViews?: Array<{
    key: string
    label: string
    icon: React.ComponentType<any>
    render: (data: T[]) => React.ReactNode
  }>
  /**
   * 触屏视图配置（仅当 viewTypes 包含 'touch' 时生效）
   */
  touchViewConfig?: {
    /**
     * 卡片渲染函数
     * @param item - 数据项
     * @param index - 索引
     */
    renderCard?: (item: T, index: number) => ReactNode
    /**
     * 每行卡片数量（默认：1，触屏模式通常单列显示）
     */
    columns?: number
  }
  /**
   * 延迟显示 loading 的时间（毫秒）
   * 当请求在 delay 内完成时不显示 loading，避免快速请求时的闪烁
   * 设为 0 时不延迟。仅当 showLoading 为 true 时生效
   */
  loadingDelay?: number
  /**
   * 是否显示加载动画/骨架屏（默认：false，尽量不使用以提升感知性能）
   * 为 false 时表格直接展示数据，无 loading 遮罩
   */
  showLoading?: boolean
  /**
   * 是否启用 antd Table 虚拟滚动（适合单行高大致固定、单页行数较多的列表）
   * 为 true 时若未通过 scroll 传入 y，将使用 virtualTableBodyMaxHeight
   */
  virtualized?: boolean
  /**
   * 与 virtualized 配合：未传入 scroll.y 时的表体纵向滚动高度（px）
   */
  virtualTableBodyMaxHeight?: number
  /**
   * 是否允许页面层自定义 `scroll.y`（默认 false）。
   * 为 false 时，UniTable 会忽略调用方传入的 `scroll.y`，统一使用全局动态限高策略；
   * 仅在极少数白名单页面需要特例时设为 true。
   */
  allowCustomScrollY?: boolean
  /**
   * 表体始终占满视口剩余高度（忽略「当前页未装满」时的 natural-height）。
   * UniReport 等固定布局报表页使用；须配合 ListPageTemplate `tableScrollLayout="report"`。
   */
  fillViewportBody?: boolean
  /**
   * 是否允许页面层自定义 `scroll.x`（默认 false）。
   * 为 false 时，UniTable 会忽略调用方传入的 `scroll.x`，统一使用内容自适应横向策略。
   */
  allowCustomScrollX?: boolean
  /**
   * 可选：由页面持有，与钉住条件 / 指标卡筛选共用 searchParamsRef（唯一筛选数据源）
   */
  searchParamsRef?: React.MutableRefObject<Record<string, any> | undefined>
  /**
   * 工具栏按钮尺寸（新建、删除、导入、导出、同步等）
   * middle 为 Ant Design 默认尺寸
   */
  toolBarButtonSize?: 'large' | 'middle' | 'small'
  /**
   * 用 TanStack Query 管理列表请求：相同分页+筛选在并发去重；默认实时拉数（staleTime=0）。
   * 不改变 ProTable 外观，仅替换底层请求去重（与 patch 后 debounceTime=0 配合）。
   *
   * **默认启用**：当传入稳定的 `columnPersistenceId` 时，组件会自动启用：
   * - `queryKeyPrefix = [columnPersistenceId]`
   * - `staleTime = 0`，`gcTime = 300_000`，`staleWhileRevalidate = false`
   *
   * 若需关闭：传 `tanstackQuery={{ enabled: false }}`。如需自定义则传完整对象覆盖。
   */
  tanstackQuery?: {
    /** 显式 false 可关闭自动缓存（默认启用） */
    enabled?: boolean
    queryKeyPrefix?: readonly unknown[]
    staleTime?: number
    gcTime?: number
    /**
     * 当前页数据返回后，在后台预取「下一页」同一筛选/排序条件的数据；
     * 用户翻页时优先命中 TanStack 缓存。启用拼音首字母前端过滤时不预取（避免缓存与展示不一致）。
     */
    prefetchNextPage?: boolean
    /**
     * 缓存已存在但已过期时：先同步返回旧数据（即点即显），后台 fetch 完成后 reload 刷新为新数据。
     */
    staleWhileRevalidate?: boolean
  }
  /**
   * 列展示/列宽 localStorage 的稳定 key（默认用 headerTitle，易随文案变化而漂移）。
   *
   * **命名规范**（列表页必须显式传入）：
   * - 取 `src/` 下页面文件相对路径，目录用 `.` 连接；`index.tsx` 省略文件名。
   * - 例：`pages/system/users/list/index.tsx` → `pages.system.users.list`
   * - 例：`apps.kuaizhizao.pages.sales-management.sales-orders`
   * - 同文件多表 / 多 Tab 共用一表时：第二张表用 `:2`，第三张 `:3`（见 settlement、inventory-alert）。
   * - 非 index 页面文件：保留文件名，如 `...reports.BaseReport`、`...ComputationHistoryTab`。
   */
  columnPersistenceId?: string
  /**
   * 嵌入模式（Modal / Drawer / Tab 内）：去掉 ProTable 外层卡片边框，减少嵌套视觉层级。
   */
  embedded?: boolean
  /**
   * @deprecated 历史占位；组件内不使用，仅从 props 剥离以免传入 ProTable。
   */
  searchFormItems?: unknown
}

/** @see 文件顶部 JSDoc 分层（uni-search / uni-view / uni-batch / uni-import 等） */
export function UniTable<T extends Record<string, any> = Record<string, any>>({
  request,
  columns,
  headerTitle,
  headerActions,
  rowKey = 'id',
  showFuzzySearch = true, // 默认显示模糊搜索
  skipFuzzyPinyinClientFilter = false,
  fuzzySearchPlaceholder,
  showAdvancedSearch = true, // 默认显示高级搜索
  searchPlacement = 'searchRow',
  beforeSearchButtons,
  betweenFuzzyAndAdvancedButtons,
  afterSearchButtons,
  enableRowSelection = false,
  onRowSelectionChange,
  onTableDataChange,
  selectedRowKeys: selectedRowKeysProp,
  rowSelectionGetCheckboxProps,
  disableRowClickSelection = false,
  enableRowEdit = false,
  onRowEditSave,
  onRowEditDelete,
  toolBarActionsBeforeCreate = [],
  toolBarActionsAfterCreate = [],
  toolBarActions = [],
  toolBarActionsAfterDelete = [],
  toolBarActionsAfterBatch = [],
  showImportButton = true,
  onImport,
  onImportPrecheck,
  importHeaders,
  importExampleRow,
  importTemplateName,
  importFieldMap,
  enableCustomImport = false,
  enableRelationImport = false,
  relationImportConfig,
  onRelationImportPrecheck,
  onRelationImportSubmit,
  importFieldRules,
  autoGenerateImportConfig = true,
  showExportButton = true,
  onExport,
  exportButtonText,
  rightToolBarActionsBeforeExport = [],
  showSyncButton = false,
  onSync,
  syncButtonText,
  showDatasetConfigButton = false,
  onDatasetConfig,
  datasetConfigButtonText,
  showPrintButton = false,
  onPrint,
  printButtonText,
  permissionResource: permissionResourceProp,
  completeCreateSourceResource,
  showCreateButton = false,
  onCreate,
  createButtonText,
  showEditButton = false,
  onEdit,
  onDetail,
  detailButtonText,
  showDeleteButton = false,
  onDelete,
  deleteButtonText,
  deleteConfirmTitle,
  deleteConfirmDescription,
  deleteButtonDisabled = false,
  defaultPageSize: defaultPageSizeProp,
  showQuickJumper = true,
  viewTypes = ['table', 'help'],
  defaultViewType = 'table',
  onViewTypeChange,
  tableViewTypes,
  detailTableColumns,
  ganttViewConfig,
  helpViewConfig,
  cardViewConfig,
  kanbanViewConfig,
  statsViewConfig,
  customViews,
  touchViewConfig,
  toolBarButtonSize,
  loadingDelay: loadingDelayProp,
  showLoading = false,
  virtualized = false,
  virtualTableBodyMaxHeight = 520,
  allowCustomScrollY = false,
  fillViewportBody = false,
  allowCustomScrollX = false,
  actionRef: externalActionRef,
  formRef: externalFormRef,
  searchParamsRef: externalSearchParamsRef,
  tanstackQuery,
  columnPersistenceId,
  embedded = false,
  columnsState: userColumnsState,
  searchFormItems: _unusedSearchFormItems,
  ...restProps
}: UniTableProps<T>) {
  const { t } = useTranslation()
  const location = useLocation()
  const pagePermissionResource = usePagePermissionResource(location.pathname)
  const permissionGates = useResourcePermissions(
    permissionResourceProp ?? pagePermissionResource,
    completeCreateSourceResource
      ? { completeCreateSourceResource }
      : undefined,
  )
  const gatedShowCreateButton = showCreateButton && permissionGates.canCreate
  const gatedShowDeleteButton = showDeleteButton && permissionGates.canDelete
  const gatedShowEditButton = showEditButton && permissionGates.canUpdate
  const gatedShowImportButton = showImportButton && permissionGates.canImport
  const gatedShowExportButton = showExportButton && permissionGates.canExport
  const { token } = theme.useToken()
  const queryClient = useQueryClient()
  const getConfig = useConfigStore((s) => s.getConfig);
  const getPreference = useUserPreferenceStore((s) => s.getPreference);
  const syncTablePreference = useUserPreferenceStore((s) => s.syncTablePreference);
  const statCardsCtx = useListPageStatCardsContext();
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md && screens.xs // 手机端判定：小于 768px 且有 xs

  // 全局 Alt+N：当前页有新建按钮时，按 Alt+N 触发新建（与点击新建按钮一致）
  useNewShortcut(gatedShowCreateButton && onCreate ? onCreate : undefined);

  // 计算最终配置（优先使用 Props，其次使用用户偏好，最后使用全局配置）
  // 分页大小优先级：Props > User Preference > Config Store > Default(20)
  const defaultPageSize = defaultPageSizeProp ?? getPreference('ui.default_page_size', getConfig('ui.default_page_size', 20))
  
  const loadingDelay = loadingDelayProp ?? getConfig('ui.table_loading_delay', 0)

  /** 已 patch @ant-design/pro-table：`debounceTime != null ? debounceTime : 30`，0 为同步触发 */
  const tableRequestDebounce = restProps.debounceTime ?? 0

  // 视图类型状态（支持内置类型及 customViews 的 key）
  const [currentViewType, setCurrentViewType] = useState<string>(defaultViewType)
  // 表格数据状态（用于其他视图）
  const [tableData, setTableData] = useState<T[]>([])
  /** 当前分页大小：用于判断当前页是否未装满（未装满则不注入 scroll.y） */
  const [currentPageSize, setCurrentPageSize] = useState<number>(defaultPageSize)
  // ⭐ 关键：使用 useProTableSearch Hook 管理搜索参数
  const { searchParamsRef: hookSearchParamsRef, formRef: hookFormRef, actionRef: hookActionRef } =
    useProTableSearch()
  const searchParamsRef = (externalSearchParamsRef ||
    hookSearchParamsRef) as React.MutableRefObject<Record<string, any> | undefined>
  // 模糊搜索关键词状态
  const [fuzzySearchKeyword, setFuzzySearchKeyword] = useState<string>('')
  /** 递增以使 QuerySearchButton 重算钉住条件激活态（searchParamsRef 变更不触发渲染） */
  const [pinnedSearchUiEpoch, setPinnedSearchUiEpoch] = useState(0)
  // 防抖定时器引用
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  const internalActionRef = useRef<ActionType>()
  const internalFormRef = useRef<ProFormInstance>()
  const containerRef = useRef<HTMLDivElement>(null)
  const [dataActionIconOnly, setDataActionIconOnly] = useState(false)
  const buttonContainerRef = useRef<HTMLDivElement>(null)
  const tableBodyPaneRef = useRef<HTMLDivElement>(null)

  /**
   * ProTable 实际挂载的 action ref（始终独立持有，避免与页面 ref 互相覆盖）。
   * 页面 / hook / 内部 ref 通过 layout effect 同步「带 TanStack 强刷新的 reload」。
   */
  const nativeTableActionRef = useRef<ActionType>()
  const actionRefForProTable = nativeTableActionRef as React.MutableRefObject<ActionType | undefined>
  const outwardActionRef = (externalActionRef ||
    hookActionRef ||
    internalActionRef) as React.MutableRefObject<ActionType | undefined>
  const formRef = (externalFormRef || hookFormRef || internalFormRef) as React.MutableRefObject<
    ProFormInstance | undefined
  >

  /** 父组件常写内联 request，避免其引用每帧变化触发 ProTable 重复拉数 */
  const requestRef = useRef(request)
  requestRef.current = request
  const staticDataSourceRef = useRef<T[] | undefined>(Array.isArray(restProps.dataSource) ? (restProps.dataSource as T[]) : undefined)
  staticDataSourceRef.current = Array.isArray(restProps.dataSource) ? (restProps.dataSource as T[]) : undefined
  const onTableDataChangeRef = useRef(onTableDataChange)
  onTableDataChangeRef.current = onTableDataChange

  /**
   * 自动启用 TanStack Query（实时列表）：
   * - 全量列表页已带稳定 `columnPersistenceId`，可直接作为 query 命名空间。
   * - 默认 staleTime=0，禁止 staleWhileRevalidate 展示过期行。
   * - 显式传入 `tanstackQuery` 时与默认值合并（`queryKeyPrefix` 缺省时取 `columnPersistenceId`）。
   * - 显式传入 `tanstackQuery={{ enabled: false }}` 可彻底关闭。
   */
  const resolvedTanstackQuery = useMemo(() => {
    if (tanstackQuery && (tanstackQuery as any).enabled === false) return undefined
    const fallbackPrefix = columnPersistenceId
      ? ([columnPersistenceId] as readonly unknown[])
      : undefined
    const queryKeyPrefix = tanstackQuery?.queryKeyPrefix ?? fallbackPrefix
    if (!queryKeyPrefix || queryKeyPrefix.length === 0) return undefined
    return {
      queryKeyPrefix,
      staleTime: tanstackQuery?.staleTime ?? 0,
      gcTime: tanstackQuery?.gcTime ?? 300_000,
      prefetchNextPage: tanstackQuery?.prefetchNextPage ?? true,
      staleWhileRevalidate: tanstackQuery?.staleWhileRevalidate ?? false,
    }
  }, [tanstackQuery, columnPersistenceId])

  const tanstackQueryRef = useRef(resolvedTanstackQuery)
  tanstackQueryRef.current = resolvedTanstackQuery

  const dropUniTableTanstackCache = useCallback(() => {
    const liveTq = tanstackQueryRef.current
    if (liveTq?.queryKeyPrefix && liveTq.queryKeyPrefix.length > 0) {
      const queryKey = ['uniTable', ...liveTq.queryKeyPrefix] as const
      void queryClient.cancelQueries({ queryKey, exact: false })
      queryClient.removeQueries({ queryKey, exact: false })
    }
  }, [queryClient])

  /** mutation / 工具栏 refresh 后的下一次 request 必须绕过 TanStack fresh 短路 */
  const forceFreshNextRequestRef = useRef(false)
  /** 丢弃过期 in-flight 响应时，避免 ProTable 被旧 request 返回值覆盖 */
  const lastCommittedRequestResultRef = useRef<{
    data?: T[]
    success?: boolean
    total?: number
  } | null>(null)

  const reloadWithTanstackCacheBust = useCallback((...args: any[]) => {
    forceFreshNextRequestRef.current = true
    dropUniTableTanstackCache()
    return (nativeTableActionRef.current?.reload as any)?.(...args)
  }, [dropUniTableTanstackCache])

  const reloadAndRestWithTanstackCacheBust = useCallback((...args: any[]) => {
    forceFreshNextRequestRef.current = true
    dropUniTableTanstackCache()
    return (nativeTableActionRef.current?.reloadAndRest as any)?.(...args)
  }, [dropUniTableTanstackCache])

  /**
   * 请求序号：用户翻页/改筛选时，旧请求若仍在飞行（含 SWR 后台 revalidate），
   * 其结果不应再 setState 或触发 reload。仅最新一次请求允许写状态。
   */
  const requestSeqRef = useRef(0)

  // 存储选中的行键（支持外部受控与内部自持两种模式）
  const [internalSelectedRowKeys, setInternalSelectedRowKeys] = useState<React.Key[]>([])
  const selectedRowKeys = selectedRowKeysProp !== undefined ? selectedRowKeysProp : internalSelectedRowKeys

  /** 同步清空 ProTable 与受控/内部选中态（删除后避免「已选择 N 项」残留） */
  const clearAllRowSelection = useCallback(() => {
    nativeTableActionRef.current?.clearSelected?.()
    setInternalSelectedRowKeys([])
    onRowSelectionChange?.([])
  }, [onRowSelectionChange])

  const handleBatchDeleteConfirm = useCallback(
    async (keys: React.Key[]) => {
      if (!onDelete) return
      // 统一去重，避免上游选中态出现重复 key 时触发“前端一次、后端多次删同一记录”误报。
      const uniqueKeys = Array.from(new Set(keys))
      await Promise.resolve(onDelete(uniqueKeys))
      clearAllRowSelection()
    },
    [onDelete, clearAllRowSelection],
  )

  useEffect(() => {
    if (selectedRowKeysProp !== undefined) {
      setInternalSelectedRowKeys(selectedRowKeysProp)
      if (selectedRowKeysProp.length === 0) {
        nativeTableActionRef.current?.clearSelected?.()
      }
    }
  }, [selectedRowKeysProp])

  // 导入弹窗可见状态（用于 showImportButton 时）
  const [importModalVisible, setImportModalVisible] = useState(false)

  // 延迟 loading：仅在 loadingDelay 毫秒后才显示，避免快速请求时的闪烁
  const [showDelayedLoading, setShowDelayedLoading] = useState(false)
  const [selectionAlertLayout, setSelectionAlertLayout] = useState<{ top: number; height: number } | null>(null)
  const loadingDelayTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isLoadingRef = useRef(false)
  const columnsSyncDebounceRef = useRef<NodeJS.Timeout | null>(null)
  /** 避免每个列表页挂载都抢跑 pinyin-pro；聚焦模糊搜索框时再预加载 */
  const pinyinWarmupRef = useRef(false)

  const warmupPinyinIfNeeded = useCallback(() => {
    if (pinyinWarmupRef.current) return
    pinyinWarmupRef.current = true
    import('../../utils/pinyin').then(({ preloadPinyinLib }) => {
      preloadPinyinLib().catch((err: any) => {
        console.warn('预加载拼音库失败:', err)
      })
    })
  }, [])

  // 拼音首字母过滤时遍历的列：排除 hideInSearch，减少大表列定义下的 CPU 开销
  const columnsForPinyinSearch = useMemo(() => {
    return columns.filter((col: ProColumns<T>) => {
      if (!col.dataIndex) return false
      if (col.hideInSearch === true) return false
      return true
    })
  }, [columns])

  /**
   * 把所有「会变」的运行期值都收敛到一个 ref，让 `handleRequest` 的 useCallback
   * 依赖永远稳定（仅 [queryClient]），避免父级重渲染时回调身份抖动导致 ProTable
   * 内部失效检查、上层 actionRef 闭包错乱。
   */
  const requestRuntimeRef = useRef({
    showLoading,
    loadingDelay,
    defaultPageSize,
    columnsForPinyinSearch,
    resolvedTanstackQuery,
    skipFuzzyPinyinClientFilter,
  })
  requestRuntimeRef.current = {
    showLoading,
    loadingDelay,
    defaultPageSize,
    columnsForPinyinSearch,
    resolvedTanstackQuery,
    skipFuzzyPinyinClientFilter,
  }

  // 预加载 UniImport（UniverSheet ~2MB）：直接在挂载时触发 import，让浏览器与页面其它资源并行下载。
  // 不再用 requestIdleCallback 做"空闲时"调度，那属于不确定时序的妥协。
  useEffect(() => {
    if (!gatedShowImportButton || !onImport) return
    import('../uni-import').catch(() => {})
  }, [gatedShowImportButton, onImport])

  // 站点日期格式（用于表格日期列展示，变更时触发列重新计算）
  const dateFormatKey = getConfig('date_format', 'YYYY-MM-DD')

  // 明细表格视图使用 detailTableColumns，否则使用 columns
  const effectiveColumns = React.useMemo(() => {
    if (currentViewType === 'detailTable' && detailTableColumns && detailTableColumns.length > 0) {
      return detailTableColumns
    }
    return columns
  }, [currentViewType, columns, detailTableColumns])

  // 检测是否为操作列（用于操作列样式与宽度处理；与 normalizeFixedRightColumnOrder 共用判定）
  const isOperationColumn = (col: any) => isUniTableOperationColumn(col)
  // 为 date/dateTime 列注入站点格式的展示，使站点设置中的日期格式在单据表格中生效
  const processedColumns = React.useMemo(() => {
    const mapped = effectiveColumns.map((col: any) => {
      // 自动处理日期和时间列的展示
      if ((col.valueType === 'date' || col.valueType === 'dateTime') && !col.render && !col.valueFormatter) {
        const dataIndex = col.dataIndex
        return {
          ...col,
          render: (_: any, record: T) => {
            const val = dataIndex != null
              ? (Array.isArray(dataIndex)
                  ? dataIndex.reduce((acc: any, key: string) => acc?.[key], record)
                  : record[dataIndex])
              : null
            return col.valueType === 'dateTime'
              ? formatDateTimeBySiteSetting(val, '-')
              : formatDateBySiteSetting(val, '-')
          },
        }
      }
      
      // 自动处理“单位”列的展示（全局优化：始终显示数据字典标签值）
      const unitFields = ['material_unit', 'unit', 'baseUnit', 'base_unit'];
      if (typeof col.dataIndex === 'string' && unitFields.includes(col.dataIndex) && !col.render) {
        return {
          ...col,
          render: (val: any) => <DictionaryLabel dictionaryCode="unit" value={val} />,
        }
      }
      /** 生命周期列统一策略：固定收缩锚点 + 最小宽度，屏蔽历史固定宽度带来的留白。 */
      if (isUniTableLifecycleColumn(col)) {
        const { width: _w, minWidth: _mw, ...lifecycleRest } = col
        const userOnCell = lifecycleRest.onCell
        const lifecycleCellClass = getUniTableLifecycleCellClassName(lifecycleRest)
        return {
          ...lifecycleRest,
          width: resolveUniTableLifecycleColumnWidth(lifecycleRest),
          minWidth: UNI_TABLE_LIFECYCLE_MIN_WIDTH,
          resizable: false,
          onCell: (record: any, rowIndex?: number) => {
            const base =
              typeof userOnCell === 'function' ? userOnCell(record, rowIndex) || {} : {}
            return {
              ...base,
              className: `${lifecycleCellClass} ${base.className || ''}`.trim(),
            }
          },
        }
      }
      if (isOperationColumn(col)) {
        const {
          uniActionRenderOptions,
          render: baseRender,
          width: pageWidth,
          minWidth: _minWidth,
          ...rest
        } = col
        const resolvedWidth = resolveUniTableOperationColumnWidth({
          width: pageWidth,
          minWidth: UNI_TABLE_OPERATION_MIN_WIDTH,
          fixed: rest.fixed,
        })
        return {
          ...rest,
          width: resolvedWidth,
          minWidth: UNI_TABLE_OPERATION_MIN_WIDTH,
          resizable: false,
          render: baseRender
            ? (...args: any[]) => {
                const rendered = baseRender(...args)
                const record = args[1] as Record<string, any> | undefined
                const rowKey = String(record?.id ?? record?.uuid ?? args[2] ?? 'row')
                return renderUniTableOperationCell(rendered, `uni-op-${rowKey}`, {
                  permissionGates,
                  ...(uniActionRenderOptions && typeof uniActionRenderOptions === 'object'
                    ? uniActionRenderOptions
                    : {}),
                })
              }
            : undefined,
        }
      }
      return col
    })
    // 列宽策略保持稳定，不随空表/有数据态切换，避免固定列在首次加载与刷新时抖动
    return applyUniTableColumnWidthPolicy(mapped, false)
  }, [effectiveColumns, dateFormatKey, permissionGates])

  // 全项目统一策略：结构化列保留页面 width；主文本列由 applyUniTableColumnWidthPolicy 释放 width；
  // 不启用拖拽改宽与本地列宽持久化，避免「代码 width」与 localStorage 双控制源竞争。
  const columnsForResize = React.useMemo(() => [], [])

  // 列宽拖拽 hook（仅表格视图时生效，与 ProTable 列设置共存）
  const tableId = columnPersistenceId ?? headerTitle
  const { components: resizableComponents, resizableColumns, tableWidth, resetColumns, refresh } = useAntdResizableHeader({
    columns: columnsForResize,
    columnsState: undefined,
  })

  const handleColumnReset = React.useCallback(() => {
    if (tableId) {
      try {
        localStorage.removeItem(`ui.tables.${tableId}.columnsWidth`)
      } catch (_) {}
      resetColumns(true)
      refresh()
      syncTablePreference(tableId, { columns: {}, columnsWidth: {} }).catch(() => {})
    }
  }, [tableId, resetColumns, refresh, syncTablePreference])

  // 操作列：不换行；列宽与 scroll 交由 antd（见下方 mergedScroll）
  const effectiveTableColumns = React.useMemo(() => {
    const baseCols = resizableColumns.length > 0 ? resizableColumns : processedColumns.filter((c: any) => !isOperationColumn(c) && !c.hideInTable)
    const opCols = processedColumns.filter((c: any) => isOperationColumn(c))
    if (opCols.length === 0 && !processedColumns.some(c => c.hideInTable)) {
      return finalizeUniTableColumns(baseCols)
    }
    
    // 将操作列按原顺序插回（通常为最后一列）
    const opIndices = processedColumns
      .map((c: any, i: number) => (isOperationColumn(c) ? i : -1))
      .filter((i: number) => i >= 0)
    const result: any[] = []
    let baseIdx = 0
    let opIdx = 0
    for (let i = 0; i < processedColumns.length; i++) {
      const col = processedColumns[i];
      if (opIndices.includes(i)) {
        const opCol = opCols[opIdx++]
        const baseOnCell = opCol.onCell
        const mergedOnCell =
          baseOnCell && typeof baseOnCell === 'function'
            ? (record: any, rowIndex?: number) => {
                const base = baseOnCell(record, rowIndex) || {}
                return {
                  ...base,
                  className: `uni-table-operation-cell ${base?.className || ''}`.trim(),
                  style: {
                    whiteSpace: 'nowrap',
                    ...(base?.style || {}),
                  },
                }
              }
            : () => ({
                className: 'uni-table-operation-cell',
                style: { whiteSpace: 'nowrap' },
              })
        result.push({
          ...opCol,
          resizable: false,
          ellipsis: false,
          onCell: mergedOnCell,
        })
      } else if (col.hideInTable) {
        // 搜索专用列不参与 resize 也不参与 baseCols 映射，直接透传原定义以保持 ProTable 搜索表单功能
        result.push(col)
      } else {
        result.push(baseCols[baseIdx++] ?? col)
      }
    }
    return finalizeUniTableColumns(result)
  }, [resizableColumns, processedColumns])

  // 导入配置：优先使用传入的 importHeaders/importExampleRow，否则从 columns 自动生成
  const effectiveImportConfig = React.useMemo(() => {
    if (importHeaders && importHeaders.length > 0) {
      return {
        headers: importHeaders,
        exampleRow: importExampleRow,
        fieldMap: importFieldMap ?? {},
      }
    }
    if (autoGenerateImportConfig && processedColumns) {
      const generated = generateImportConfigFromColumns(processedColumns, { t })
      return {
        headers: generated.headers,
        exampleRow: generated.exampleRow,
        fieldMap: { ...generated.fieldMap, ...(importFieldMap ?? {}) },
      }
    }
    return { headers: undefined, exampleRow: undefined, fieldMap: importFieldMap }
  }, [importHeaders, importExampleRow, importFieldMap, autoGenerateImportConfig, processedColumns, t])

  const importTemplateDocumentName = useMemo(() => {
    if (importTemplateName?.trim()) return importTemplateName.trim()
    if (typeof headerTitle === 'string' && headerTitle.trim()) return headerTitle.trim()
    return translatePathTitle(location.pathname, t)?.trim() || undefined
  }, [importTemplateName, headerTitle, location.pathname, t])

  /** 仅列拖拽开启时使用 hook 算出的 tableWidth；否则不注入数值 scroll.x，交给 antd 默认策略 */
  const effectiveTableWidth: number | string | undefined =
    resizableColumns.length > 0 && tableWidth != null ? tableWidth : undefined

  /** 合并列状态：为右侧固定列写入默认 order，保证生命周期在操作列左侧（与 normalizeFixedRightColumnOrder 一致） */
  const mergedColumnsStateProp = React.useMemo(() => {
    const columnDefaults = buildDefaultColumnsStateMap(effectiveTableColumns)
    const user = userColumnsState || {}
    return {
      ...user,
      persistenceType: 'localStorage' as const,
      persistenceKey:
        user.persistenceKey ?? (tableId ? `ui.tables.${tableId}.columns` : undefined),
      defaultValue: {
        ...columnDefaults,
        ...(user.defaultValue || {}),
      },
      onChange: (map: Record<string, any> | undefined) => {
        if (map) user.onChange?.(map as Record<string, ColumnsState>)
        if (!tableId || !map) return
        const columnsSnapshot = map
        if (columnsSyncDebounceRef.current) clearTimeout(columnsSyncDebounceRef.current)
        columnsSyncDebounceRef.current = setTimeout(() => {
          columnsSyncDebounceRef.current = null
          syncTablePreference(tableId, { columns: columnsSnapshot }).catch(() => {})
        }, 800)
      },
    }
  }, [tableId, effectiveTableColumns, userColumnsState, syncTablePreference])

  /** 与 mergedColumnsStateProp.persistenceKey 一致，用于纠偏 localStorage 中的列 order */
  const columnsPersistenceFullKey =
    (userColumnsState as any)?.persistenceKey ??
    (tableId != null && tableId !== '' ? `ui.tables.${tableId}.columns` : undefined)

  /** 列结构签名：内容不变时避免因 columns 引用抖动重复打补丁 */
  const columnStructureSig = React.useMemo(
    () =>
      JSON.stringify(
        (effectiveTableColumns || []).map((c: any, i: number) => [
          i,
          c?.fixed ?? null,
          c?.dataIndex ?? null,
          c?.key ?? null,
          c?.valueType ?? null,
        ])
      ),
    [effectiveTableColumns],
  )

  /**
   * ProTable 对列设置的合并为 merge(defaultValue, localStorage)，用户历史持久化会盖住默认 order，
   * 仅靠 normalize 列顺序无法纠正展示。此处按规范重写右侧固定列的 order。
   *
   * 关键时序优化：
   * - 首次挂载时，在 render 阶段同步写入 localStorage，使 ProTable 首次渲染读到的就是
   *   已纠偏的值，无需再触发 epoch 重挂载（消除首屏白屏/回弹感）。
   * - 之后若 key/结构签名改变，再走 effect 路径 + epoch++，与原有行为一致。
   */
  const applyColumnsOrderOverlay = React.useCallback((): boolean => {
    if (typeof window === 'undefined' || !columnsPersistenceFullKey || !effectiveTableColumns?.length) return false
    try {
      const raw = window.localStorage.getItem(columnsPersistenceFullKey)
      if (!raw) return false
      const m = JSON.parse(raw) as Record<string, any>
      const overlay = buildFixedRightColumnOrderOverlay(effectiveTableColumns)
      const keys = Object.keys(overlay)
      if (keys.length === 0) return false
      const next = { ...m }
      let changed = false
      for (const k of keys) {
        const want = overlay[k]?.order
        if (want == null) continue
        const cur = next[k]?.order
        if (cur !== want) {
          next[k] = { ...(next[k] || {}), order: want }
          changed = true
        }
      }
      if (changed) {
        window.localStorage.setItem(columnsPersistenceFullKey, JSON.stringify(next))
      }
      return changed
    } catch {
      return false
    }
  }, [columnsPersistenceFullKey, effectiveTableColumns])

  const columnsStatePatchSigRef = React.useRef<string | null>(null)
  const [columnsStatePatchEpoch, setColumnsStatePatchEpoch] = React.useState(0)
  const currentPatchSig = `${columnsPersistenceFullKey ?? ''}::${columnStructureSig}`
  // 仅在首次挂载时同步纠偏（render 阶段）；后续 sig 变化由下方 effect 负责
  if (columnsStatePatchSigRef.current === null && columnsPersistenceFullKey && effectiveTableColumns?.length) {
    columnsStatePatchSigRef.current = currentPatchSig
    applyColumnsOrderOverlay()
  }

  React.useLayoutEffect(() => {
    // 首次挂载已在 render 阶段完成纠偏，跳过
    if (columnsStatePatchSigRef.current === currentPatchSig) return
    columnsStatePatchSigRef.current = currentPatchSig
    if (applyColumnsOrderOverlay()) {
      setColumnsStatePatchEpoch((e) => e + 1)
    }
  }, [currentPatchSig, applyColumnsOrderOverlay])

  /**
   * 将按钮容器移动到 ant-pro-table 内部
   */
  /**
   * 将按钮容器移动到 ant-pro-table 内部
   * 
   * fix: 不再移动按钮容器。
   * 原因：当切换到卡片/看板等视图时，ProTable 会被隐藏 (display: none)，導致内部的按钮容器也不可见。
   * 为了在所有视图模式下都能看到搜索和切换按钮，需要保持容器在 ProTable 外部。
   */
  /*
  useLayoutEffect(() => {
    // 移动搜索框到 ProTable 内部
    // ... logic removed ...
  }, [currentViewType])
  */

  /**
   * 当视图类型是卡片/看板/统计视图时，确保数据已加载
   * 如果 tableData 为空且 actionRef 可用，主动触发数据加载
   */
  useEffect(() => {
    if (currentViewType !== 'table' && currentViewType !== 'detailTable' && tableData.length === 0 && actionRefForProTable?.current) {
      // 延迟执行，确保组件完全初始化
      setTimeout(() => {
        actionRefForProTable.current?.reload()
      }, 100)
    }
  }, [currentViewType, tableData.length])

  /**
   * 处理模糊搜索（带防抖）
   *
   * 根据最佳实践：
   * 1. 使用防抖（300ms）来优化性能，避免频繁请求
   * 2. 搜索关键词存储到 searchParamsRef 中，作为 keyword 参数传递给后端
   * 3. 支持清除搜索，清除时重新加载数据
   */
  const handleFuzzySearch = (value: string) => {
    setFuzzySearchKeyword(value)

    // 清除之前的防抖定时器
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // 设置防抖定时器（300ms）
    debounceTimerRef.current = setTimeout(() => {
      // 更新搜索参数
      if (searchParamsRef.current) {
        searchParamsRef.current.keyword = value.trim() || undefined
      } else {
        searchParamsRef.current = {
          keyword: value.trim() || undefined,
        }
      }
      setPinnedSearchUiEpoch((e) => e + 1)

      // 触发表格重新加载
      if (actionRefForProTable?.current) {
        actionRefForProTable.current.reload()
      }
    }, 300)
  }

  /** 重置模糊关键词与表单筛选条件并刷新列表（与搜索条「重置」一致） */
  const handleSearchReset = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    setFuzzySearchKeyword('')
    // 清空高级搜索 / 钉住条件写入的 searchParamsRef，否则仅删 keyword 时阶段筛选仍会生效
    searchParamsRef.current = undefined
    setPinnedSearchUiEpoch((e) => e + 1)
    try {
      formRef.current?.resetFields?.()
    } catch {
      /* ignore */
    }
    actionRefForProTable.current?.reload?.()
  }, [])

  /**
   * 组件卸载时清除防抖定时器和 loading 延迟定时器
   */
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      if (loadingDelayTimerRef.current) {
        clearTimeout(loadingDelayTimerRef.current)
      }
      if (columnsSyncDebounceRef.current) {
        clearTimeout(columnsSyncDebounceRef.current)
      }
    }
  }, [])

  /**
   * 同步 ProTable 原生 action 到页面 ref，并对 reload / reloadAndRest 包一层 TanStack 强刷新。
   */
  React.useLayoutEffect(() => {
    const inner = nativeTableActionRef.current
    if (!inner) {
      outwardActionRef.current = undefined as any
      return
    }
    outwardActionRef.current = {
      ...inner,
      reload: (...args: any[]) => reloadWithTanstackCacheBust(...args),
      reloadAndRest: (...args: any[]) => reloadAndRestWithTanstackCacheBust(...args),
      clearSelected: () => clearAllRowSelection(),
    }
  }, [outwardActionRef, reloadWithTanstackCacheBust, reloadAndRestWithTanstackCacheBust, clearAllRowSelection])

  /**
   * 表格数据请求（核心性能路径）
   *
   * 设计原则（与 TanStack Query 原生模型对齐）：
   * 1. 缓存命中（fresh）→ 同步从 `queryClient.getQueryData` 取值；不发起网络请求。
   * 2. 缓存命中（stale）+ `staleWhileRevalidate` → 立刻返回旧数据；后台用 `fetchQuery`
   *    revalidate；TanStack 默认开启 `structuralSharing`，结果与旧数据「内容相同」时
   *    返回同一引用，因此用 `===` 判断是否需要 `reload`，避免无变更时多余渲染。
   * 3. 缓存未命中 / 已禁用 SWR → `fetchQuery` 发起请求；`fetchQuery` 内部按 queryKey
   *    去重并发，相同 key 的并发请求只会触发一次网络往返。
   * 4. `prefetchNextPage`：成功拿到当前页后，在后台用与「下一页正常请求一致」的 key
   *    预取下一页（拼音前端过滤场景跳过，避免缓存与展示不一致）。
   * 5. 竞态：`requestSeqRef` 单调自增，仅最新一次请求允许写状态 / 触发 reload。
   * 6. `useCallback` 依赖仅 `[queryClient]`，永远稳定 —— 所有「会变」的运行期值都从
   *    `requestRuntimeRef.current` 读取，避免父组件重渲染时回调身份抖动。
   */
  const handleRequest = useCallback(async (
    params: any,
    sort: Record<string, 'ascend' | 'descend' | null>,
    filter: Record<string, React.ReactText[] | null>
  ) => {
    const seq = ++requestSeqRef.current
    const {
      showLoading: liveShowLoading,
      loadingDelay: liveLoadingDelay,
      defaultPageSize: liveDefaultPageSize,
      columnsForPinyinSearch: livePinyinCols,
      resolvedTanstackQuery: tq,
      skipFuzzyPinyinClientFilter: liveSkipFuzzyPinyinClientFilter,
    } = requestRuntimeRef.current

    if (liveShowLoading && liveLoadingDelay > 0) {
      isLoadingRef.current = true
      if (loadingDelayTimerRef.current) {
        clearTimeout(loadingDelayTimerRef.current)
      }
      loadingDelayTimerRef.current = setTimeout(() => {
        loadingDelayTimerRef.current = null
        if (isLoadingRef.current) {
          setShowDelayedLoading(true)
        }
      }, liveLoadingDelay)
    }

    /**
     * 取搜索表单值：`searchParamsRef.current` 可能是空对象（表示主动清空筛选），
     * 仅在 `undefined` 时回退到 ProForm `getFieldsValue`，避免覆盖「清空」语义。
     */
    const formValues = formRef.current?.getFieldsValue() || {}
    const searchFormValues =
      searchParamsRef.current !== undefined ? searchParamsRef.current : formValues

    const keywordForPrefetch = searchFormValues?.keyword
    const skipPrefetchForPinyin = !!(
      keywordForPrefetch &&
      isPinyinKeyword(keywordForPrefetch) &&
      !liveSkipFuzzyPinyinClientFilter
    )

    try {
      const reqPageSize = params.pageSize ?? liveDefaultPageSize
      setCurrentPageSize((prev) => (prev === reqPageSize ? prev : reqPageSize))

      const runRequest = () => {
        if (typeof requestRef.current === 'function') {
          return requestRef.current(params, sort, filter, searchFormValues)
        }
        const rows = staticDataSourceRef.current ?? []
        const current = Number(params?.current ?? 1)
        const fallbackPageSize = rows.length > 0 ? rows.length : liveDefaultPageSize
        const pageSize = Number(params?.pageSize ?? fallbackPageSize)
        const start = Math.max(0, (current - 1) * pageSize)
        return Promise.resolve({
          data: rows.slice(start, start + pageSize),
          success: true,
          total: rows.length,
        })
      }
      let result: Awaited<ReturnType<typeof runRequest>>
      const forceFresh = forceFreshNextRequestRef.current
      if (forceFresh) {
        forceFreshNextRequestRef.current = false
      }

      if (tq?.queryKeyPrefix && tq.queryKeyPrefix.length > 0) {
        const pageSize = reqPageSize
        const current = params.current ?? 1
        const staleTimeMs = tq.staleTime ?? 0
        const gcTimeMs = tq.gcTime ?? 300_000
        const paramsKey = stableJsonForQueryKey(params)
        const sortKey = stableJsonForQueryKey(sort)
        const filterKey = stableJsonForQueryKey(filter)
        const searchKey = stableJsonForQueryKey(searchFormValues ?? {})
        const fullQueryKey = [
          'uniTable',
          ...tq.queryKeyPrefix,
          paramsKey,
          sortKey,
          filterKey,
          searchKey,
        ] as const

        const fetchOpts = {
          queryKey: [...fullQueryKey],
          queryFn: runRequest,
          staleTime: staleTimeMs,
          gcTime: gcTimeMs,
        } as const

        if (forceFresh) {
          result = await queryClient.fetchQuery({
            ...fetchOpts,
            staleTime: 0,
          })
        } else if (tq.staleWhileRevalidate) {
          const cached = queryClient.getQueryData(fullQueryKey) as
            | Awaited<ReturnType<typeof runRequest>>
            | undefined
          const state = queryClient.getQueryState(fullQueryKey)
          const updatedAt = state?.dataUpdatedAt ?? 0
          const cacheStale =
            !cached || state?.isInvalidated === true || Date.now() - updatedAt > staleTimeMs
          if (cached != null && cacheStale) {
            void queryClient
              .fetchQuery({ ...fetchOpts, staleTime: 0 })
              .then((fresh) => {
                if (requestSeqRef.current !== seq) return
                if (fresh === cached) return
                lastCommittedRequestResultRef.current = fresh
                if (fresh.data) {
                  setTableData(fresh.data)
                  onTableDataChangeRef.current?.(fresh.data as T[])
                }
                nativeTableActionRef.current?.reload?.()
              })
              .catch(() => {
                /* 失败由全局错误处理；旧数据继续展示 */
              })
            result = cached
          } else {
            result = await queryClient.fetchQuery(fetchOpts)
          }
        } else {
          result = await queryClient.fetchQuery(fetchOpts)
        }

        if (
          tq.prefetchNextPage &&
          !skipPrefetchForPinyin &&
          result &&
          typeof result.total === 'number' &&
          Number.isFinite(result.total) &&
          current * pageSize < result.total
        ) {
          const nextCurrent = current + 1
          const nextParams = { ...params, current: nextCurrent, pageSize }
          const nextKey = [
            'uniTable',
            ...tq.queryKeyPrefix,
            stableJsonForQueryKey(nextParams),
            sortKey,
            filterKey,
            searchKey,
          ] as const
          // prefetchQuery 会按 queryKey 去重；若已在飞行或缓存仍 fresh，则直接返回。
          void queryClient.prefetchQuery({
            queryKey: [...nextKey],
            queryFn: () => requestRef.current(nextParams, sort, filter, searchFormValues),
            staleTime: staleTimeMs,
            gcTime: gcTimeMs,
          })
        }
      } else {
        result = await runRequest()
      }

      // 拼音搜索：关键词为拼音首字母时在前端对返回数据二次过滤
      const keyword = searchFormValues?.keyword
      if (
        !liveSkipFuzzyPinyinClientFilter &&
        keyword &&
        isPinyinKeyword(keyword) &&
        result.data &&
        Array.isArray(result.data)
      ) {
        // 避免改写 TanStack 缓存中的对象引用
        const keywordLower = keyword.toLowerCase()
        const keywordUpper = keyword.toUpperCase()

        const filteredDataPromises = result.data.map(async (record: any) => {
          for (const column of livePinyinCols) {
            if (!column.dataIndex) continue
            const getFieldValue = (obj: any, path: string | string[] | number): any => {
              if (Array.isArray(path)) {
                return path.reduce((acc, key) => acc?.[key], obj)
              }
              if (typeof path === 'number') return obj?.[path]
              const keys = String(path).split('.')
              return keys.reduce((acc, key) => acc?.[key], obj)
            }
            const fieldValue = getFieldValue(record, column.dataIndex as string | string[] | number)
            if (!fieldValue) continue
            const valueStr = String(fieldValue)
            if (valueStr.toLowerCase().includes(keywordLower)) return record
            const pinyinMatch = await matchPinyinInitialsAsync(valueStr, keywordUpper)
            if (pinyinMatch) return record
          }
          return null
        })

        const filteredResults = await Promise.all(filteredDataPromises)
        const filteredData = filteredResults.filter((item) => item !== null)
        result = {
          ...result,
          data: filteredData,
          ...(result.total !== undefined ? { total: filteredData.length } : {}),
        }
      }

      // 竞态：旧请求结果到达时不写 state（仅最新 seq 落库），但仍把「本次实时算出的 result」返回给
      // ProTable —— result 始终基于最新 requestRef 计算，故即便 ProTable 末位应用的是过期请求的返回值，
      // 表格内容也仍是当前真值；切勿回退成空响应（会把已加载列表覆盖为「暂无数据」）。
      if (requestSeqRef.current !== seq) {
        return result
      }

      // 仅在数据引用变化时 setState（forceFresh 或 TanStack 结构共享豁免）
      if (result.data) {
        setTableData((prev) => {
          if (forceFresh) return result.data
          return prev === result.data ? prev : result.data
        })
        onTableDataChangeRef.current?.(result.data as T[])
      }

      lastCommittedRequestResultRef.current = result

      return result
    } finally {
      if (liveShowLoading && liveLoadingDelay > 0 && requestSeqRef.current === seq) {
        isLoadingRef.current = false
        if (loadingDelayTimerRef.current) {
          clearTimeout(loadingDelayTimerRef.current)
          loadingDelayTimerRef.current = null
        }
        setShowDelayedLoading(false)
      }
    }
  }, [queryClient])

  const mergedToolbarOptions = (restProps.options || (restProps.toolbar as any)?.options || {}) as any

  /**
   * 处理视图类型切换
   */
  const handleViewTypeChange = (viewType: string) => {
    setCurrentViewType(viewType)
    if (onViewTypeChange) {
      onViewTypeChange(viewType)
    }
  }

  /** 3.1 左侧功能按钮区：`headerTitle` 内容（含 uni-batch、下推类按钮约定落此区）。 */
  const buildLeftActions = () => {
    const actions: ReactNode[] = []

    // 如果提供了自定义 headerActions，直接使用
    if (headerActions) {
      return headerActions
    }

    if (toolBarActionsBeforeCreate.length > 0) {
      actions.push(...withToolbarItemKeys(toolBarActionsBeforeCreate, 'uni-tb-before'))
    }

    // 新建按钮，带 Alt+N 快捷键提示
    if (gatedShowCreateButton && onCreate) {
      actions.push(
        <Button key="create" type="primary" icon={<PlusOutlined />} onClick={onCreate} size={toolBarButtonSize}>
          {withSingleNewShortcutHint(createButtonText ?? t('components.uniTable.create'))}
        </Button>
      )
    }

    if (toolBarActionsAfterCreate.length > 0) {
      actions.push(...withToolbarItemKeys(toolBarActionsAfterCreate, 'uni-tb-after-create'))
    }

    // ProTable `toolBarRender`：在 UniTable 中仅用于向左侧注入节点（非右侧工具栏）
    if (restProps.toolBarRender) {
      const mockAction = {
        reload: reloadWithTanstackCacheBust,
        reloadAndRest: reloadAndRestWithTanstackCacheBust,
      } as any
      const mockSelectedRowKeys = selectedRowKeys as any
      const userResult = restProps.toolBarRender(mockAction, {
        selectedRowKeys: mockSelectedRowKeys,
      })

      if (Array.isArray(userResult)) {
        actions.push(...withToolbarItemKeys(userResult, 'uni-tb-render'))
      } else if (userResult) {
        actions.push(...withToolbarItemKeys([userResult], 'uni-tb-render'))
      }
    }

    // 合并 toolBarActions（兼容历史用法，与 toolBarRender 等效）
    if (toolBarActions.length > 0) {
      actions.push(...withToolbarItemKeys(toolBarActions, 'uni-tb-actions'))
    }

    // 批量删除（uni-batch 删除预设）
    if (gatedShowDeleteButton && onDelete) {
      actions.push(
        <UniBatchDeleteButton
          key="delete"
          selectedRowKeys={selectedRowKeys}
          onConfirm={handleBatchDeleteConfirm}
          toolBarButtonSize={toolBarButtonSize}
          buttonText={deleteButtonText}
          confirmTitle={deleteConfirmTitle}
          confirmDescription={deleteConfirmDescription}
          disabled={deleteButtonDisabled}
        />
      )
    }

    if (toolBarActionsAfterDelete.length > 0) {
      actions.push(...withToolbarItemKeys(toolBarActionsAfterDelete, 'uni-tb-after-delete'))
    }

    if (toolBarActionsAfterBatch.length > 0) {
      actions.push(...withToolbarItemKeys(toolBarActionsAfterBatch, 'uni-tb-after-batch'))
    }

    // 修改按钮（需要选中一行）
    if (gatedShowEditButton && onEdit) {
      actions.push(
        <Button
          key="edit"
          icon={<EditOutlined />}
          size={toolBarButtonSize}
          onClick={() => {
            if (selectedRowKeys.length === 1) {
              onEdit(selectedRowKeys)
            }
          }}
          disabled={selectedRowKeys.length !== 1}
        >
          {t('components.uniTable.edit')}
        </Button>
      )
    }

    if (onDetail && permissionGates.canRead) {
      actions.push(
        <Button
          key="detail"
          icon={<EyeOutlined />}
          size={toolBarButtonSize}
          onClick={() => {
            if (selectedRowKeys.length === 1) {
              void onDetail(selectedRowKeys)
            }
          }}
          disabled={selectedRowKeys.length !== 1}
        >
          {detailButtonText ?? t('components.uniTable.detail')}
        </Button>
      )
    }

    return actions.length > 0 ? <Space>{actions}</Space> : undefined
  }

  /** 3.2 右侧：uni-import / uni-export / uni-sync / 数据集（可选）/ 打印（表格设定见 `memoizedOptions`） */
  const buildRightActions = (iconOnly = false) => {
    const rightButtons: ReactNode[] = []

    const beforeExportActions = withToolbarItemKeys(
      rightToolBarActionsBeforeExport,
      'right-before-export',
    )
    if (beforeExportActions.length > 0) {
      rightButtons.push(...beforeExportActions)
    }

    if (gatedShowImportButton && onImport) {
      rightButtons.push(
        <UniImportToolbarButton
          key="import"
          size={toolBarButtonSize}
          iconOnly={iconOnly}
          onOpen={() => setImportModalVisible(true)}
        />
      )
    }

    if (gatedShowExportButton && onExport) {
      rightButtons.push(
        <UniExportMenuButton<T>
          key="export"
          size={toolBarButtonSize}
          iconOnly={iconOnly}
          buttonText={exportButtonText}
          onExport={onExport}
          selectedRowKeys={selectedRowKeys}
          tableData={tableData}
        />
      )
    }

    if (showSyncButton && onSync) {
      rightButtons.push(
        <UniSyncButton
          key="sync"
          size={toolBarButtonSize}
          iconOnly={iconOnly}
          onSync={onSync}
          buttonText={syncButtonText}
        />
      )
    }

    if (showDatasetConfigButton && onDatasetConfig) {
      rightButtons.push(
        <Button
          key="dataset-config"
          type="default"
          size={toolBarButtonSize}
          icon={<TableOutlined />}
          onClick={() => onDatasetConfig()}
        >
          {datasetConfigButtonText ?? t('components.uniTable.datasetConfig')}
        </Button>
      )
    }

    if (showPrintButton && onPrint) {
      rightButtons.push(
        <Button
          key="print"
          size={toolBarButtonSize}
          icon={<PrinterOutlined />}
          disabled={selectedRowKeys.length !== 1}
          onClick={() => onPrint(selectedRowKeys, tableData)}
        >
          {printButtonText ?? t('components.uniTable.print')}
        </Button>
      )
    }

    return rightButtons.length > 0 ? <Space size="small">{rightButtons}</Space> : undefined
  }

  const buildHeaderActions = () => {
    return buildLeftActions()
  }

  /** 选中行变化时需重算左侧工具栏（下推/编辑等依赖 selectedRowKeys） */
  const memoizedHeaderActions = React.useMemo(
    () => buildHeaderActions() || undefined,
    [
      selectedRowKeys,
      headerActions,
      toolBarActionsBeforeCreate,
      toolBarActionsAfterCreate,
      toolBarActions,
      toolBarActionsAfterDelete,
      toolBarActionsAfterBatch,
      gatedShowCreateButton,
      gatedShowDeleteButton,
      deleteButtonDisabled,
      gatedShowEditButton,
      permissionGates.canRead,
      restProps.toolBarRender,
    ],
  )

  /**
   * 处理行选择变化（与 ProTable `rowSelection.selectedRowKeys` 受控联动，保证点行勾选与勾选列一致）
   */
  const handleRowSelectionChange = useCallback(
    (keys: React.Key[]) => {
      setInternalSelectedRowKeys(keys)
      onRowSelectionChange?.(keys)
    },
    [onRowSelectionChange],
  )

  const memoizedOptions = React.useMemo(() => ({
    setting: {
      listsHeight: 360,
      checkedReset: false,
      extra: <TableColumnResetButton onResetResizable={handleColumnReset} />,
    },
    fullScreen: false,
    ...mergedToolbarOptions,
    /** 密度固定为紧凑（small），不展示工具栏密度切换；置后以免被传入 options 覆盖 */
    density: false,
    reload: () => {
      mergedToolbarOptions.reload?.()
      void reloadWithTanstackCacheBust()
    },
  }), [mergedToolbarOptions, handleColumnReset, reloadWithTanstackCacheBust])

  const statCardsOptionsRender = useCallback(
    (_props: unknown, defaultDom: React.ReactNode[]) => {
      if (!statCardsCtx?.enabled) return defaultDom
      const toggleNode = (
        <span key="uni-stat-cards-toggle" onClick={statCardsCtx.toggle}>
          <Tooltip
            title={t(
              statCardsCtx.visible
                ? 'components.uniTable.hideStatCards'
                : 'components.uniTable.showStatCards',
            )}
          >
            <PieChartOutlined
              style={
                statCardsCtx.visible
                  ? undefined
                  : { color: token.colorTextQuaternary }
              }
            />
          </Tooltip>
        </span>
      )
      const reloadIdx = defaultDom.findIndex(
        (node) => React.isValidElement(node) && node.key === 'reload',
      )
      if (reloadIdx >= 0) {
        return [...defaultDom.slice(0, reloadIdx), toggleNode, ...defaultDom.slice(reloadIdx)]
      }
      return [toggleNode, ...defaultDom]
    },
    [statCardsCtx, t, token.colorTextQuaternary],
  )

  const memoizedRightActions = !isMobile ? buildRightActions(dataActionIconOnly) : undefined

  const memoizedToolbar = React.useMemo(() => ({
    actions: [
      ...(memoizedRightActions ? [memoizedRightActions] : []),
      ...(restProps.toolbar?.actions
        ? Array.isArray(restProps.toolbar.actions)
          ? restProps.toolbar.actions
          : [restProps.toolbar.actions]
        : []),
    ],
  }), [memoizedRightActions, restProps.toolbar?.actions])

  const normalizedUserRowSelection = React.useMemo(() => {
    const userRowSelection = (restProps as { rowSelection?: unknown }).rowSelection
    if (!userRowSelection || typeof userRowSelection !== 'object') {
      return userRowSelection as
        | ({
            columnWidth?: number
          } & Record<string, unknown>)
        | undefined
    }
    const rowSelectionObj = userRowSelection as {
      columnWidth?: number
    } & Record<string, unknown>
    if (rowSelectionObj.columnWidth != null) return rowSelectionObj
    return {
      ...rowSelectionObj,
      columnWidth: UNI_TABLE_SELECTION_COL_WIDTH,
    }
  }, [restProps])

  const memoizedRowSelection = React.useMemo(
    () =>
      enableRowSelection
        ? {
            ...(normalizedUserRowSelection && typeof normalizedUserRowSelection === 'object'
              ? normalizedUserRowSelection
              : {}),
            type: 'checkbox' as const,
            columnWidth:
              normalizedUserRowSelection &&
              typeof normalizedUserRowSelection === 'object' &&
              normalizedUserRowSelection.columnWidth != null
                ? normalizedUserRowSelection.columnWidth
                : UNI_TABLE_SELECTION_COL_WIDTH,
            selectedRowKeys,
            onChange: handleRowSelectionChange,
            ...(rowSelectionGetCheckboxProps
              ? { getCheckboxProps: rowSelectionGetCheckboxProps }
              : {}),
          }
        : normalizedUserRowSelection,
    [
      enableRowSelection,
      normalizedUserRowSelection,
      selectedRowKeys,
      handleRowSelectionChange,
      rowSelectionGetCheckboxProps,
    ],
  )

  const memoizedEditable = React.useMemo(() => (
    enableRowEdit
      ? {
          type: 'multiple' as const,
          onSave: onRowEditSave as any,
          onDelete: onRowEditDelete as any,
        }
      : undefined
  ), [enableRowEdit, onRowEditSave, onRowEditDelete])

  const handleClearSelection = clearAllRowSelection

  const memoizedPagination = React.useMemo(() => ({
    defaultPageSize,
    showSizeChanger: true,
    showQuickJumper: true,
    pageSizeOptions: ['10', '20', '50', '100'],
    showTotal: (total: number, range: [number, number]) =>
      t('components.uniTable.paginationTotal', { total, start: range[0], end: range[1] }),
    ...(restProps.pagination as Record<string, unknown> | undefined),
  }), [defaultPageSize, t, restProps.pagination])
  const effectiveTableAlertRender = (restProps as any).tableAlertRender ?? false
  const restTableVirtual = (restProps as any).virtual === true
  const restTableScrollY = (restProps as any).scroll?.y

  const scrollPolicyInput = React.useMemo(
    () => ({
      allowCustomScrollY,
      restTableScrollY,
      fillViewportBody,
      virtualized,
      restTableVirtual,
      tableDataLength: tableData.length,
      currentPageSize,
    }),
    [
      allowCustomScrollY,
      restTableScrollY,
      fillViewportBody,
      virtualized,
      restTableVirtual,
      tableData.length,
      currentPageSize,
    ],
  )

  /** 策略层 scroll.y（按行数）；未装满页默认 natural-height */
  const policyScrollYEnabled = React.useMemo(
    () => shouldEnableUniTableBodyScrollY(scrollPolicyInput),
    [scrollPolicyInput],
  )
  /** 实测表体超出视口时补开 scroll.y（多行单元格、树表展开等） */
  const [viewportScrollForced, setViewportScrollForced] = useState(false)
  const proTableBodyScrollYEnabled = policyScrollYEnabled || viewportScrollForced

  const isEmptyTable = tableData.length === 0
  const emptyTableHasFixedColumns =
    isEmptyTable && hasUniTableFixedColumns(effectiveTableColumns)
  const tableHasRowSelection = enableRowSelection || !!normalizedUserRowSelection

  const rowClickSelectionEnabled =
    !disableRowClickSelection && tableHasRowSelection && !!memoizedRowSelection

  const userOnRowProp = (restProps as { onRow?: (record: T, index: number) => Record<string, unknown> }).onRow

  const getEffectiveSelectedRowKeys = useCallback((): React.Key[] => {
    const fromRowSelection = memoizedRowSelection?.selectedRowKeys
    if (Array.isArray(fromRowSelection)) return fromRowSelection as React.Key[]
    return selectedRowKeys
  }, [memoizedRowSelection, selectedRowKeys])

  const notifyRowSelectionChange = useCallback(
    (nextKeys: React.Key[]) => {
      const rsOnChange = memoizedRowSelection?.onChange as
        | ((keys: React.Key[], selectedRows: T[], info: { type: string }) => void)
        | undefined
      if (typeof rsOnChange === 'function') {
        rsOnChange(nextKeys, [], { type: 'multiple' })
        return
      }
      handleRowSelectionChange(nextKeys)
    },
    [memoizedRowSelection, handleRowSelectionChange],
  )

  const mergeOnRowWithRowClickSelection = useCallback(
    (record: T, index: number) => {
      const base =
        typeof userOnRowProp === 'function' ? userOnRowProp(record, index) ?? {} : {}
      if (!rowClickSelectionEnabled) return Object.keys(base).length > 0 ? base : undefined

      return {
        ...base,
        onClick: (e: React.MouseEvent<HTMLElement>) => {
          const el = e.target
          if (!(el instanceof Element)) return
          if (shouldIgnoreRowClickForSelection(el)) return

          ;(base as { onClick?: (ev: React.MouseEvent<HTMLElement>) => void }).onClick?.(e)
          if (e.defaultPrevented) return

          const recordKey =
            typeof rowKey === 'function'
              ? (rowKey as (r: T, i?: number) => React.Key)(record, index)
              : ((record as Record<string, unknown>)[rowKey as string] as React.Key)
          if (recordKey === undefined || recordKey === null) return

          if (rowSelectionGetCheckboxProps) {
            const p = rowSelectionGetCheckboxProps(record)
            if (p?.disabled) return
          }

          const key = recordKey as React.Key
          const currentKeys = getEffectiveSelectedRowKeys()
          const selectionType = memoizedRowSelection?.type === 'radio' ? 'radio' : 'checkbox'
          let next: React.Key[]
          if (selectionType === 'radio') {
            next = [key]
          } else {
            const has = currentKeys.includes(key)
            next = has ? currentKeys.filter((k) => k !== key) : [...currentKeys, key]
          }
          notifyRowSelectionChange(next)
        },
      }
    },
    [
      userOnRowProp,
      rowClickSelectionEnabled,
      rowKey,
      rowSelectionGetCheckboxProps,
      getEffectiveSelectedRowKeys,
      memoizedRowSelection?.type,
      notifyRowSelectionChange,
    ],
  )

  const listPageScrollY = React.useMemo(() => {
    if (!proTableBodyScrollYEnabled) return undefined
    const offsetPx = statCardsCtx?.tableScrollOffsetPx
    if (offsetPx != null) {
      return getViewportHeightExpr(offsetPx, { compensateHeaderInFullscreen: true })
    }
    return `calc(100vh - var(--uni-table-scroll-offset, ${LIST_PAGE_TABLE_SCROLL.DEFAULT_FALLBACK_OFFSET_PX}px) + (${LIST_PAGE_TABLE_SCROLL.HEADER_HEIGHT_PX}px - var(--header-height, ${LIST_PAGE_TABLE_SCROLL.HEADER_HEIGHT_PX}px)))`
  }, [proTableBodyScrollYEnabled, statCardsCtx?.tableScrollOffsetPx])

  React.useLayoutEffect(() => {
    if (statCardsCtx?.tableScrollOffsetPx == null) return
    window.dispatchEvent(new Event('resize'))
  }, [statCardsCtx?.tableScrollOffsetPx])

  React.useLayoutEffect(() => {
    if (policyScrollYEnabled) {
      setViewportScrollForced(false)
      return
    }
    if (tableData.length === 0) {
      setViewportScrollForced(false)
      return
    }
    if (currentViewType !== 'table' && currentViewType !== 'detailTable') {
      setViewportScrollForced(false)
      return
    }

    const root = containerRef.current
    if (!root) return

    const measure = () => {
      setViewportScrollForced(measureTableBodyOverflowsViewport(root))
    }

    measure()
    const raf = window.requestAnimationFrame(measure)
    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => measure())
        : null
    const tbody = root.querySelector('.ant-table-tbody')
    if (ro && tbody) ro.observe(tbody)
    const tableWrapper = root.querySelector('.ant-table-wrapper')
    if (ro && tableWrapper) ro.observe(tableWrapper)
    window.addEventListener('resize', measure)
    return () => {
      window.cancelAnimationFrame(raf)
      ro?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [
    policyScrollYEnabled,
    tableData,
    currentViewType,
    effectiveTableColumns,
    showDelayedLoading,
    currentPageSize,
  ])

  React.useLayoutEffect(() => {
    const root = containerRef.current
    if (!root) return
    const sync = () => {
      setDataActionIconOnly(root.clientWidth < DATA_ACTION_ICON_ONLY_MAX_WIDTH)
    }
    sync()
    const ro =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => sync()) : null
    ro?.observe(root)
    window.addEventListener('resize', sync)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', sync)
    }
  }, [])

  /** natural-height：antd 在 scroll.x 下可能重设 overflow，布局后强制关闭纵向滚动避免空纵条 */
  React.useLayoutEffect(() => {
    if (proTableBodyScrollYEnabled) return
    const root = containerRef.current
    if (!root) return

    const applyNaturalHeightScroll = () => {
      root
        .querySelectorAll<HTMLElement>(
          '.ant-table-header, .ant-table-content, .ant-table-body, .ant-table-body-inner, .ant-table-fixed-left .ant-table-body-inner, .ant-table-fixed-right .ant-table-body-inner',
        )
        .forEach((el) => {
          el.style.overflowY = 'hidden'
          el.style.maxHeight = 'none'
          el.style.scrollbarGutter = 'stable'
          if (isEmptyTable && !emptyTableHasFixedColumns) {
            el.style.setProperty('overflow-x', 'hidden', 'important')
          } else {
            el.style.removeProperty('overflow-x')
          }
        })
    }

    applyNaturalHeightScroll()
    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => applyNaturalHeightScroll())
        : null
    const tableHost = root.querySelector('.ant-table-wrapper')
    if (ro && tableHost) ro.observe(tableHost)
    return () => ro?.disconnect()
  }, [
    proTableBodyScrollYEnabled,
    isEmptyTable,
    emptyTableHasFixedColumns,
    tableData,
    currentViewType,
    showDelayedLoading,
  ])

  React.useLayoutEffect(() => {
    if (!enableRowSelection || selectedRowKeys.length === 0) return
    const host = tableBodyPaneRef.current
    if (!host) return

    const syncLayout = () => {
      const pager = host.querySelector('.ant-table-wrapper .ant-table-pagination') as HTMLElement | null
      if (!pager) return
      const hostRect = host.getBoundingClientRect()
      const pagerRect = pager.getBoundingClientRect()
      const next = {
        top: Math.max(0, pagerRect.top - hostRect.top),
        height: Math.max(1, pagerRect.height),
      }
      setSelectionAlertLayout((prev) => {
        if (!prev) return next
        if (Math.abs(prev.top - next.top) < 0.5 && Math.abs(prev.height - next.height) < 0.5) return prev
        return next
      })
    }

    syncLayout()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => syncLayout()) : null
    if (ro) {
      ro.observe(host)
      const pager = host.querySelector('.ant-table-wrapper .ant-table-pagination') as HTMLElement | null
      if (pager) ro.observe(pager)
    }
    window.addEventListener('resize', syncLayout)
    return () => {
      window.removeEventListener('resize', syncLayout)
      ro?.disconnect()
    }
  }, [enableRowSelection, selectedRowKeys.length, currentViewType, isMobile])

  const showSearchToolbarRow =
    searchPlacement === 'searchRow'
      ? showFuzzySearch ||
        showAdvancedSearch ||
        Boolean(beforeSearchButtons) ||
        Boolean(afterSearchButtons) ||
        Boolean(betweenFuzzyAndAdvancedButtons) ||
        (isMobile && gatedShowCreateButton && onCreate)
      : (!isMobile && viewTypes && viewTypes.length > 1) ||
        (isMobile && gatedShowCreateButton && onCreate)

  const effectiveToolbarButtonSize =
    toolBarButtonSize ?? (searchPlacement === 'toolbarLeft' ? 'small' : 'middle')

  const memoizedUniSearch = React.useMemo(
    () => (
      <UniSearch
        beforeSearch={beforeSearchButtons}
        betweenFuzzyAndAdvanced={
          betweenFuzzyAndAdvancedButtons || (isMobile && gatedShowCreateButton && onCreate) ? (
            <>
              {betweenFuzzyAndAdvancedButtons}
              {isMobile && gatedShowCreateButton && onCreate ? (
                <Button
                  key="mobile-create"
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={onCreate}
                  size={effectiveToolbarButtonSize}
                  style={{ flexShrink: 0 }}
                >
                  {createButtonText ?? t('components.uniTable.create')}
                </Button>
              ) : null}
            </>
          ) : null
        }
        showFuzzySearch={showFuzzySearch}
        fuzzyPlaceholder={fuzzySearchPlaceholder}
        fuzzyValue={fuzzySearchKeyword}
        onFuzzyChange={handleFuzzySearch}
        onFuzzyPressEnter={(v) => handleFuzzySearch(v)}
        onFuzzyFocus={warmupPinyinIfNeeded}
        showAdvancedSearch={showAdvancedSearch}
        advancedSearchTableProps={{
          columns: processedColumns,
          formRef: formRef as React.MutableRefObject<ProFormInstance>,
          actionRef: outwardActionRef as React.MutableRefObject<ActionType>,
          searchParamsRef,
          pinnedSearchUiEpoch,
          onSearchParamsApplied: () => setPinnedSearchUiEpoch((e) => e + 1),
        }}
        afterSearch={afterSearchButtons}
        showReset={!isMobile && (showFuzzySearch || showAdvancedSearch)}
        onReset={handleSearchReset}
        isMobile={isMobile}
        toolBarButtonSize={effectiveToolbarButtonSize}
      />
    ),
    [
      afterSearchButtons,
      beforeSearchButtons,
      betweenFuzzyAndAdvancedButtons,
      createButtonText,
      effectiveToolbarButtonSize,
      formRef,
      fuzzySearchKeyword,
      fuzzySearchPlaceholder,
      gatedShowCreateButton,
      handleFuzzySearch,
      handleSearchReset,
      isMobile,
      onCreate,
      pinnedSearchUiEpoch,
      processedColumns,
      searchParamsRef,
      outwardActionRef,
      showAdvancedSearch,
      showFuzzySearch,
      t,
      warmupPinyinIfNeeded,
    ],
  )

  const memoizedHeaderTitle = React.useMemo(() => {
    const leftActions = memoizedHeaderActions || headerTitle
    if (searchPlacement === 'toolbarLeft') {
      return (
        <div
          className="uni-table-toolbar-left"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'nowrap',
            minWidth: 0,
            width: '100%',
          }}
        >
          {memoizedUniSearch}
          {leftActions ? <div style={{ flexShrink: 0 }}>{leftActions}</div> : null}
        </div>
      )
    }
    return leftActions || undefined
  }, [headerTitle, memoizedHeaderActions, memoizedUniSearch, searchPlacement])

  const hasListToolbarActions = Boolean(memoizedHeaderActions || memoizedRightActions)

  return (
    <>
      <style>{`
        /* 统一 UniTable 容器样式，确保所有页面间距一致 */
        .uni-table-container {
          position: relative;
          padding: 0;
          margin: 0;
          width: 100%;
        }
        /* ProTable 外框：ProCard 默认用 colorSplit 过浅，统一为次级边框色 */
        .uni-table-container:not(.uni-table-embedded) .uni-table-pro-table.ant-pro-table > .ant-pro-card.ant-pro-card-border {
          border: 1px solid var(--ant-colorBorderSecondary, var(--ant-colorBorder)) !important;
          border-radius: var(--ant-borderRadiusLG, var(--ant-borderRadius, 6px)) !important;
          overflow: hidden;
        }
        /* 表头 + 表身外框（不含工具栏、分页） */
        .uni-table-container:not(.uni-table-embedded) .uni-table-pro-table .ant-table-container {
          border: 1px solid var(--ant-colorBorderSecondary, var(--ant-colorBorder));
          border-radius: var(--ant-borderRadius, 6px);
          overflow: hidden;
        }
        .uni-table-container.uni-table-embedded .ant-pro-card {
          border: none !important;
          box-shadow: none !important;
          background: transparent !important;
        }
        .uni-table-container.uni-table-embedded .ant-pro-card .ant-pro-card-body {
          padding: 0 !important;
        }
        .uni-table-container.uni-table-embedded .uni-table-pro-table {
          margin: 0 !important;
        }
        .uni-table-container.uni-table-embedded .ant-pro-table-list-toolbar-container {
          padding-block: 0 8px !important;
        }
        /* 表身行高/内边距由 ProTable size="small"（antd Table 密度）统一控制，勿在此覆盖 padding */
        .uni-table-container .ant-table-tbody > tr > td {
          border-bottom-color: rgba(0, 0, 0, 0.12) !important;
        }
        /* scroll.x / 固定列时 rc-table 注入的测量行：折叠占位，避免表头与首行数据之间出现白缝 */
        .uni-table-container .ant-table-tbody > tr.ant-table-measure-row {
          height: 0 !important;
          line-height: 0 !important;
          visibility: collapse;
        }
        .uni-table-container .ant-table-tbody > tr.ant-table-measure-row > .ant-table-measure-cell {
          height: 0 !important;
          padding: 0 !important;
          border: none !important;
          line-height: 0 !important;
          font-size: 0 !important;
          overflow: hidden !important;
        }
        .uni-table-container .ant-table-tbody > tr.ant-table-measure-row .ant-table-measure-cell-content {
          height: 0 !important;
          overflow: hidden !important;
        }
        /**
         * 表身单元格默认不换行（贴合原生 antd 单行表格风格）。
         * 表头同步相同 nowrap / 语义 class，避免表头与表身列宽计算不一致导致轻微错位。
         */
        .uni-table-container .ant-table-tbody > tr > td:not(.uni-table-operation-cell):not(.uni-table-lifecycle-cell),
        .uni-table-container .ant-table-thead > tr > th:not(.uni-table-operation-cell):not(.uni-table-lifecycle-cell) {
          white-space: nowrap;
        }
        .uni-table-container .ant-table-tbody > tr > td.uni-table-operation-cell,
        .uni-table-container .ant-table-thead > tr > th.uni-table-operation-cell {
          white-space: nowrap;
        }
        .uni-table-container .ant-table-tbody > tr > td.uni-table-lifecycle-cell,
        .uni-table-container .ant-table-thead > tr > th.uni-table-lifecycle-cell {
          white-space: nowrap;
        }
        /* 非 fixed：收缩锚点；fixed right 由列 width 控制，禁止 1px 以免与操作列重叠 */
        .uni-table-container .ant-table-tbody > tr > td.uni-table-lifecycle-cell:not(.uni-table-lifecycle-fixed-right),
        .uni-table-container .ant-table-thead > tr > th.uni-table-lifecycle-cell:not(.uni-table-lifecycle-fixed-right) {
          width: 1px;
          max-width: fit-content;
        }
        .uni-table-container .uni-table-pro-table .ant-table-thead .ant-table-column-sorters,
        .uni-table-container .uni-table-pro-table .ant-table-thead .ant-table-column-title {
          white-space: nowrap;
        }
        /* 工具栏置于表头 tooltip 之上，避免排序提示挡住批量操作等按钮 */
        .uni-table-container .ant-pro-table-list-toolbar {
          position: relative;
          z-index: 3;
        }
        /* 无 string headerTitle 时仍展示 3.1 功能按钮行（新建/批量等） */
        .uni-table-container.uni-table-has-list-toolbar .ant-pro-table-list-toolbar-container {
          display: flex !important;
          min-height: 32px;
        }
        /* 排序提示默认向下弹出（见 showSorterTooltip），避免遮挡上方工具栏 */
        .uni-table-container .ant-table-thead .ant-table-column-sorters-tooltip-target-sorter .ant-table-column-sorter {
          margin-inline-start: 4px;
        }
        /* 未限高（natural-height）：纵向滚动由 UniTable 统一关闭，覆盖 global.less 全局表格规则 */
        .uni-table-container.uni-table-natural-height .ant-pro-table,
        .uni-table-container.uni-table-natural-height .ant-pro-card,
        .uni-table-container.uni-table-natural-height .ant-pro-card-body,
        .uni-table-container.uni-table-natural-height .ant-pro-table-container,
        .uni-table-container.uni-table-natural-height .ant-table-wrapper,
        .uni-table-container.uni-table-natural-height .ant-spin-nested-loading,
        .uni-table-container.uni-table-natural-height .ant-spin-container,
        .uni-table-container.uni-table-natural-height .ant-table,
        .uni-table-container.uni-table-natural-height .ant-table-container {
          height: auto !important;
          max-height: none !important;
          flex: 0 1 auto !important;
        }
        /* 未限高时不拉伸 UniTable 填满列高（否则 flex+overflow-y:auto 产生空滚动条） */
        .uni-table-container.uni-table-natural-height .ant-table-content,
        .uni-table-container.uni-table-natural-height .ant-table-body,
        .uni-table-container.uni-table-natural-height .ant-table-body-inner,
        .uni-table-container.uni-table-natural-height .ant-table-fixed-left .ant-table-body-inner,
        .uni-table-container.uni-table-natural-height .ant-table-fixed-right .ant-table-body-inner,
        .uni-table-container.uni-table-natural-height .ant-table-header {
          overflow-y: hidden !important;
          max-height: none !important;
          scrollbar-gutter: stable !important;
          flex: none !important;
        }
        .uni-table-container.uni-table-natural-height .ant-table-wrapper .ant-table-content::-webkit-scrollbar,
        .uni-table-container.uni-table-natural-height .ant-table-wrapper .ant-table-body::-webkit-scrollbar {
          width: 0 !important;
          display: none !important;
        }
        .uni-table-container.uni-table-natural-height .ant-table-wrapper .ant-table-content::-webkit-scrollbar:horizontal,
        .uni-table-container.uni-table-natural-height .ant-table-wrapper .ant-table-body::-webkit-scrollbar:horizontal {
          height: 6px !important;
          display: block !important;
        }
        /* 空表且无固定列：关闭横向滚动，避免仅表头时出现空横条 */
        .uni-table-container.uni-table-natural-height.uni-table-empty:not(.uni-table-empty-has-fixed) .ant-table-content,
        .uni-table-container.uni-table-natural-height.uni-table-empty:not(.uni-table-empty-has-fixed) .ant-table-body,
        .uni-table-container.uni-table-natural-height.uni-table-empty:not(.uni-table-empty-has-fixed) .ant-table-body-inner,
        .uni-table-container.uni-table-natural-height.uni-table-empty:not(.uni-table-empty-has-fixed) .ant-table-fixed-left .ant-table-body-inner,
        .uni-table-container.uni-table-natural-height.uni-table-empty:not(.uni-table-empty-has-fixed) .ant-table-fixed-right .ant-table-body-inner {
          overflow-x: hidden !important;
        }
        /* 空表有固定列：保留 scroll 容器以维持表头对齐，仅隐藏横向滚动条外观 */
        .uni-table-container.uni-table-natural-height.uni-table-empty.uni-table-empty-has-fixed .ant-table-wrapper .ant-table-content::-webkit-scrollbar:horizontal,
        .uni-table-container.uni-table-natural-height.uni-table-empty.uni-table-empty-has-fixed .ant-table-wrapper .ant-table-body::-webkit-scrollbar:horizontal {
          height: 0 !important;
          display: none !important;
        }
        .uni-table-container.uni-table-natural-height.uni-table-empty:not(.uni-table-empty-has-fixed) .ant-table-wrapper .ant-table-content::-webkit-scrollbar:horizontal,
        .uni-table-container.uni-table-natural-height.uni-table-empty:not(.uni-table-empty-has-fixed) .ant-table-wrapper .ant-table-body::-webkit-scrollbar:horizontal {
          height: 0 !important;
          display: none !important;
        }
        /* 已限高（scroll.y）：表头/表体同步预留纵向滚动条占位，避免列宽抖动 */
        .uni-table-container.uni-table-scroll-y-mode .uni-table-pro-table.uni-table-scroll-y .ant-table-header,
        .uni-table-container.uni-table-scroll-y-mode .uni-table-pro-table.uni-table-scroll-y .ant-table-body,
        .uni-table-container.uni-table-scroll-y-mode .uni-table-pro-table.uni-table-scroll-y .ant-table-content {
          scrollbar-gutter: stable;
        }
      `}</style>
      <div
        ref={containerRef}
        className={`uni-table-container${embedded ? ' uni-table-embedded' : ''}${proTableBodyScrollYEnabled ? ' uni-table-scroll-y-mode' : ' uni-table-natural-height'}${isEmptyTable ? ' uni-table-empty' : ''}${emptyTableHasFixedColumns ? ' uni-table-empty-has-fixed' : ''}${hasListToolbarActions ? ' uni-table-has-list-toolbar' : ''}`}
        style={{
          position: 'relative',
          padding: isMobile ? '0 8px' : 0,
          margin: 0,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          ...(fillViewportBody ? { flex: 1, minHeight: 0 } : {}),
        }}
      >
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
          {showSearchToolbarRow ? (
          <div
            ref={buttonContainerRef}
            className="pro-table-button-container"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: isMobile ? 'wrap' : 'nowrap',
              gap: 8,
              rowGap: 8,
              width: '100%',
              marginTop: isMobile ? 8 : 0,
              minWidth: 0,
            }}
          >
            {searchPlacement === 'searchRow' ? memoizedUniSearch : null}
            {!isMobile && viewTypes && viewTypes.length > 1 ? (
              <div style={{ flexShrink: 0, marginLeft: 8 }}>
                <UniView
                  viewTypes={viewTypes}
                  value={currentViewType}
                  onChange={handleViewTypeChange}
                  customViews={customViews}
                  style={{ marginLeft: 0 }}
                />
              </div>
            ) : null}
          </div>
          ) : null}

          <ConfigProvider getPopupContainer={() => document.body}>
            <div
              ref={tableBodyPaneRef}
              style={{
                display:
                  (currentViewType === 'table' ||
                  currentViewType === 'detailTable' ||
                  (tableViewTypes && tableViewTypes.includes(currentViewType))) && !isMobile
                    ? 'block'
                    : 'none',
                width: '100%',
                position: 'relative',
              }}
            >
              <ProTable<T>
              key={`uni-pt-cols-${String(columnsPersistenceFullKey ?? 'np')}-${columnsStatePatchEpoch}`}
              headerTitle={memoizedHeaderTitle}
              actionRef={actionRefForProTable}
              formRef={formRef}
              columns={effectiveTableColumns}
              request={handleRequest}
              debounceTime={tableRequestDebounce}
              rowKey={rowKey}
              search={false}
              style={{ margin: 0, padding: 0 }}
              bordered={false}
              cardBordered={!embedded}
              {...(!showLoading ? { loading: false } : loadingDelay > 0 ? { loading: showDelayedLoading } : {})}
              columnsState={mergedColumnsStateProp}
              toolbar={memoizedToolbar}
              rowSelection={memoizedRowSelection}
              editable={memoizedEditable}
              pagination={memoizedPagination}
              tableAlertRender={effectiveTableAlertRender}
              toolBarRender={(_action, { selectedRowKeys: toolBarSelectedRowKeys }) => {
                // 非受控模式：同步 ProTable 工具栏选中到内部 state；受控模式以 props 为准，避免删除后残留 ghost keys
                if (selectedRowKeysProp === undefined && toolBarSelectedRowKeys) {
                  const currentKeys = selectedRowKeys
                  const newKeys = toolBarSelectedRowKeys
                  if (
                    currentKeys.length !== newKeys.length ||
                    currentKeys.some((key, index) => key !== newKeys[index])
                  ) {
                    requestAnimationFrame(() => {
                      setInternalSelectedRowKeys(newKeys)
                    })
                  }
                }
                return memoizedRightActions ? [memoizedRightActions] : []
              }}
              {...(() => {
                // 过滤 toolBarRender/search；scroll：调用方优先，否则默认 x 为 max-content（antd）；拖拽开启时注入数值 x
                const {
                  toolBarRender,
                  search,
                  toolbar: _omitToolbar,
                  pagination: _omitPagination,
                  scroll: userScroll,
                  rowSelection: _omitRowSelection,
                  components: userComponents,
                  virtual: userVirtual,
                  tableAlertRender: _omitTableAlertRender,
                  debounceTime: _omitDebounce,
                  onRow: userOnRow,
                  size: _omitTableSize,
                  options: _omitTableOptions,
                  onSizeChange: _omitOnSizeChange,
                  sticky: userSticky,
                  className: userTableClassName,
                  ...otherProps
                } = restProps
                const mergedProTableClassName = [
                  'uni-table-pro-table',
                  proTableBodyScrollYEnabled ? 'uni-table-scroll-y' : '',
                  userTableClassName,
                ]
                  .filter(Boolean)
                  .join(' ')
                const mergedComponents =
                  resizableColumns.length > 0
                    ? {
                        ...(userComponents || {}),
                        header: {
                          ...(userComponents?.header || {}),
                          cell: resizableComponents.header.cell,
                        },
                      }
                    : userComponents
                /** 统一滚动策略：默认忽略页面旧式 scroll.x/scroll.y，仅保留白名单开关。 */
                const ourScrollX = effectiveTableWidth
                const normalizedUserScroll =
                  (!allowCustomScrollY || !allowCustomScrollX) && userScroll
                    ? ({
                        ...userScroll,
                        ...(allowCustomScrollX ? {} : { x: undefined }),
                        ...(allowCustomScrollY ? {} : { y: undefined }),
                      } as typeof userScroll)
                    : userScroll
                let mergedScroll =
                  ourScrollX != null
                    ? { ...(normalizedUserScroll || {}), x: ourScrollX }
                    : allowCustomScrollX && normalizedUserScroll?.x !== undefined
                      ? normalizedUserScroll
                      : { ...(normalizedUserScroll || {}), x: 'max-content' as const }
                const useVirtual = virtualized || userVirtual === true
                if (!useVirtual && mergedScroll?.y === undefined && listPageScrollY) {
                  mergedScroll = {
                    ...(mergedScroll || {}),
                    y: listPageScrollY,
                  }
                }
                if (useVirtual) {
                  mergedScroll = {
                    ...(mergedScroll || {}),
                    y: mergedScroll?.y ?? virtualTableBodyMaxHeight,
                  }
                }
                if (!proTableBodyScrollYEnabled && mergedScroll?.y !== undefined) {
                  const { y: _omitScrollY, ...scrollWithoutY } = mergedScroll
                  mergedScroll = scrollWithoutY
                }
                /** 空表 + 固定列：必须注入数值 scroll.x（antd 固定列定位依赖列 width 与 scroll.x 一致） */
                if (isEmptyTable && emptyTableHasFixedColumns) {
                  const minScrollX = computeUniTableMinScrollX(effectiveTableColumns, {
                    includeSelection: tableHasRowSelection,
                  })
                  if (minScrollX > 0) {
                    const keepY = proTableBodyScrollYEnabled ? mergedScroll?.y : undefined
                    mergedScroll =
                      keepY != null
                        ? ({ x: minScrollX, y: keepY } as typeof mergedScroll)
                        : ({ x: minScrollX } as typeof mergedScroll)
                  }
                } else if (!proTableBodyScrollYEnabled && isEmptyTable) {
                  if (ourScrollX != null) {
                    mergedScroll = { x: ourScrollX } as typeof mergedScroll
                  } else {
                    mergedScroll = undefined
                  }
                }

                const mergedOnRow = rowClickSelectionEnabled
                  ? mergeOnRowWithRowClickSelection
                  : userOnRow

                return {
                  ...otherProps,
                  className: mergedProTableClassName,
                  showSorterTooltip:
                    (otherProps as { showSorterTooltip?: boolean | Record<string, unknown> }).showSorterTooltip ?? {
                      target: 'sorter-icon',
                      placement: 'bottom',
                    },
                  ...(proTableBodyScrollYEnabled && userSticky !== undefined ? { sticky: userSticky } : {}),
                  ...(mergedOnRow ? { onRow: mergedOnRow } : {}),
                  ...(useVirtual ? { virtual: true } : userVirtual !== undefined ? { virtual: userVirtual } : {}),
                  components: mergedComponents,
                  ...(mergedScroll != null ? { scroll: mergedScroll } : {}),
                }
              })()}
              size="small"
              options={memoizedOptions}
              optionsRender={statCardsCtx?.enabled ? statCardsOptionsRender : (restProps as any).optionsRender}
              revalidateOnFocus={false}
              />
              {enableRowSelection && selectedRowKeys.length > 0 ? (
                <div
                  style={{
                    position: 'absolute',
                    left: 16,
                    top: selectionAlertLayout?.top ?? 0,
                    zIndex: 2,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    height: selectionAlertLayout?.height ?? 32,
                    color: 'var(--ant-color-text-secondary)',
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      height: selectionAlertLayout?.height ?? 32,
                      lineHeight: `${selectionAlertLayout?.height ?? 32}px`,
                    }}
                  >
                    {t('components.uniTable.selectedCountFooter', { count: selectedRowKeys.length })}
                  </span>
                  <a
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      height: selectionAlertLayout?.height ?? 32,
                      lineHeight: `${selectionAlertLayout?.height ?? 32}px`,
                    }}
                    onClick={handleClearSelection}
                  >
                    {t('components.uniTable.clearSelectionFooter')}
                  </a>
                </div>
              ) : null}
            </div>
          </ConfigProvider>

          {/* 甘特图视图 */}
          {currentViewType === 'gantt' && viewTypes.includes('gantt') && (
            <div style={{ padding: 0, minHeight: '400px' }}>
              {ganttViewConfig?.renderGantt ? (
                ganttViewConfig.renderGantt(tableData)
              ) : (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '60px 20px',
                    color: '#999',
                    background: '#fafafa',
                    borderRadius: '4px',
                    border: '1px dashed var(--river-border-color)',
                  }}
                >
                  <ProjectOutlined style={{ fontSize: '48px', marginBottom: '16px', color: 'var(--river-border-color)' }} />
                  <div style={{ fontSize: '16px', marginBottom: '8px' }}>{t('components.uniTable.ganttViewHint')}</div>
                </div>
              )}
            </div>
          )}

          {/* 卡片视图 */}
          {currentViewType === 'card' && viewTypes.includes('card') && (
            <div style={{ padding: '0 0 16px 0', minHeight: '400px' }}>
              {cardViewConfig?.renderCard ? (
                tableData.length > 0 ? (
                  (() => {
                    const layout = cardViewConfig.layout ?? 'grid'
                    const groupByField = cardViewConfig.groupByField
                    if (groupByField) {
                      const groups = new Map<string, T[]>()
                      tableData.forEach(item => {
                        const key = String((item as any)[groupByField] ?? '-')
                        if (!groups.has(key)) groups.set(key, [])
                        groups.get(key)!.push(item)
                      })
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                          {Array.from(groups.entries()).map(([groupKey, items]) => (
                            <div key={groupKey}>
                              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#666' }}>{groupKey}</div>
                              <div
                                style={layout === 'waterfall' ? { columns: '300px auto', columnGap: 16 } : { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}
                              >
                                {items.map((item, index) => (
                                  <div key={index} style={layout === 'waterfall' ? { breakInside: 'avoid' as const, marginBottom: 16 } : {}}>
                                    {cardViewConfig!.renderCard!(item, index)}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    }
                    return (
                      <div
                        style={layout === 'waterfall' ? { columns: '300px auto', columnGap: 16 } : { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}
                      >
                        {(() => {
                          const stackGroups = cardViewConfig.cardStackGroups ?? []
                          const renderedStackKeys = new Set<string>()
                          type CardSlot =
                            | { kind: 'item'; item: T; index: number; key: string }
                            | { kind: 'stack'; items: T[]; key: string; groupIndex: number }
                          const cardSlots: CardSlot[] = []
                          tableData.forEach((item, index) => {
                            const code = String((item as Record<string, unknown>).code ?? '')
                            const groupIndex = stackGroups.findIndex((g) => g.codes.includes(code))
                            if (groupIndex >= 0) {
                              const group = stackGroups[groupIndex]
                              const stackKey = group.codes.join('|')
                              if (renderedStackKeys.has(stackKey)) return
                              renderedStackKeys.add(stackKey)
                              const items = group.codes
                                .map((c) =>
                                  tableData.find(
                                    (row) => String((row as Record<string, unknown>).code ?? '') === c,
                                  ),
                                )
                                .filter((row): row is T => Boolean(row))
                              if (items.length > 0) {
                                cardSlots.push({ kind: 'stack', items, key: stackKey, groupIndex })
                              }
                              return
                            }
                            cardSlots.push({
                              kind: 'item',
                              item,
                              index,
                              key: String((item as Record<string, unknown>).uuid ?? `row-${index}`),
                            })
                          })
                          return cardSlots.map((slot) => (
                            <div
                              key={slot.key}
                              style={
                                layout === 'waterfall'
                                  ? { breakInside: 'avoid' as const, marginBottom: 16 }
                                  : undefined
                              }
                            >
                              {slot.kind === 'stack'
                                ? stackGroups[slot.groupIndex].renderStack(
                                    slot.items,
                                    cardViewConfig!.renderCard!,
                                  )
                                : cardViewConfig!.renderCard!(slot.item, slot.index)}
                            </div>
                          ))
                        })()}
                      </div>
                    )
                  })()
                ) : (
                  cardViewConfig?.emptyCard ?? (
                    <Empty
                      description={t('components.uniTable.emptyCard')}
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      style={{ marginTop: '60px' }}
                    />
                  )
                )
              ) : (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '60px 20px',
                    color: '#999',
                    background: '#fafafa',
                    borderRadius: '4px',
                    border: '1px dashed var(--river-border-color)',
                  }}
                >
                  <AppstoreOutlined
                    style={{ fontSize: '48px', marginBottom: '16px', color: 'var(--river-border-color)' }}
                  />
                  <div style={{ fontSize: '16px', marginBottom: '8px' }}>{t('components.uniTable.cardViewTitle')}</div>
                  <div style={{ fontSize: '14px', color: '#999' }}>
                    {t('components.uniTable.cardViewHint')}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 看板视图 */}
          {currentViewType === 'kanban' && viewTypes.includes('kanban') && (
            <div style={{ minHeight: '400px' }}>
              {kanbanViewConfig?.renderCard && kanbanViewConfig.statusGroups ? (
                <div
                  style={{ display: 'flex', gap: '16px', overflowX: 'auto', minHeight: '400px' }}
                >
                  {Object.entries(kanbanViewConfig.statusGroups).map(([status, config]) => {
                    const statusData = tableData.filter(
                      item => (item as any)[kanbanViewConfig?.statusField || 'status'] === status
                    )
                    return (
                      <div
                        key={status}
                        style={{
                          flex: '0 0 300px',
                          border: '1px solid #d9d9d9',
                          borderRadius: '4px',
                          padding: '16px',
                          background: '#fafafa',
                          minHeight: '400px',
                        }}
                      >
                        <div
                          style={{
                            fontSize: '16px',
                            fontWeight: 'bold',
                            marginBottom: '16px',
                            paddingBottom: '12px',
                            borderBottom: '2px solid #d9d9d9',
                          }}
                        >
                          {config.title}
                          <span
                            style={{
                              marginLeft: '8px',
                              fontSize: '12px',
                              color: '#999',
                              fontWeight: 'normal',
                            }}
                          >
                            ({statusData.length})
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {statusData.map(item => kanbanViewConfig.renderCard!(item, status))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '60px 20px',
                    color: '#999',
                    background: '#fafafa',
                    borderRadius: '4px',
                    border: '1px dashed var(--river-border-color)',
                  }}
                >
                  <BarsOutlined
                    style={{ fontSize: '48px', marginBottom: '16px', color: 'var(--river-border-color)' }}
                  />
                  <div style={{ fontSize: '16px', marginBottom: '8px' }}>{t('components.uniTable.kanbanViewTitle')}</div>
                  <div style={{ fontSize: '14px', color: '#999' }}>
                    {t('components.uniTable.kanbanViewHint')}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 统计视图 */}
          {currentViewType === 'stats' && viewTypes.includes('stats') && (
            <div style={{ minHeight: '400px' }}>
              {statsViewConfig?.metrics ? (
                <div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '16px',
                      marginBottom: '24px',
                    }}
                  >
                    {statsViewConfig.metrics.map(metric => (
                      <div
                        key={metric.key}
                        style={{
                          padding: '20px',
                          border: '1px solid #d9d9d9',
                          borderRadius: '4px',
                          background: '#fff',
                          textAlign: 'center',
                        }}
                      >
                        <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
                          {metric.label}
                        </div>
                        <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#1890ff' }}>
                          {metric.formatter
                            ? metric.formatter(metric.value(tableData))
                            : metric.value(tableData)}
                        </div>
                      </div>
                    ))}
                  </div>
                  {statsViewConfig.charts && statsViewConfig.charts.length > 0 && (
                    <div style={{ marginTop: '24px' }}>
                      {/* TODO: 实现图表渲染 */}
                      <div
                        style={{
                          textAlign: 'center',
                          padding: '40px',
                          color: '#999',
                          border: '1px dashed #d9d9d9',
                          borderRadius: '4px',
                        }}
                      >
                        {t('components.uniTable.chartDeveloping')}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '60px 20px',
                    color: '#999',
                    background: '#fafafa',
                    borderRadius: '4px',
                    border: '1px dashed var(--river-border-color)',
                  }}
                >
                  <BarChartOutlined
                    style={{ fontSize: '48px', marginBottom: '16px', color: 'var(--river-border-color)' }}
                  />
                  <div style={{ fontSize: '16px', marginBottom: '8px' }}>{t('components.uniTable.statsViewTitle')}</div>
                  <div style={{ fontSize: '14px', color: '#999' }}>
                    {t('components.uniTable.statsViewHint')}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 帮助视图 */}
          {currentViewType === 'help' && viewTypes.includes('help') && (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
                overflow: 'hidden',
                background: token.colorBgContainer,
                borderRadius: token.borderRadius,
                border: `1px solid rgba(0, 0, 0, 0.12)`,
                boxShadow: 'none',
              }}
            >
              {helpViewConfig?.content ?? (
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <QuestionCircleOutlined
                    style={{ fontSize: '48px', marginBottom: '16px', color: '#1890ff' }}
                  />
                  <div style={{ fontSize: '18px', marginBottom: '8px', fontWeight: 500 }}>
                    {helpViewConfig?.title ?? t('components.uniTable.helpTitle')}
                  </div>
                  <div style={{ fontSize: '14px', color: '#666', maxWidth: 400, margin: '0 auto' }}>
                    {t('components.uniTable.helpHint')}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 自定义视图（customViews）- 与表格视图保持相同容器结构（操作按钮、导入导出等） */}
          {/* 若视图在 tableViewTypes 中，则已由 ProTable 展示，不重复渲染 */}
          {customViews?.map(
            cv =>
              currentViewType === cv.key &&
              viewTypes.includes(cv.key) &&
              !(tableViewTypes && tableViewTypes.includes(cv.key)) && (
                <div
                  key={cv.key}
                  className="uni-table-pro-table"
                  style={{
                    display: 'block',
                    width: '100%',
                    margin: 0,
                    padding: 0,
                  }}
                >
                  <ProCard
                    bordered
                    style={{
                      border: `1px solid ${token.colorBorderSecondary}`,
                      boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px 0 rgba(0, 0, 0, 0.02)',
                      borderRadius: token.borderRadius,
                      overflow: 'visible',
                    }}
                    styles={{ body: {paddingLeft: 16, paddingRight: 16, paddingBottom: 16 } }}
                  >
                    <div style={{ minHeight: '200px' }}>{cv.render(tableData)}</div>
                  </ProCard>
                </div>
              )
          )}

          {/* 触屏视图 (移动端/平板优化) */}
          {currentViewType === 'touch' && viewTypes.includes('touch') && (
            <div
              style={{
                padding: '16px',
                minHeight: '400px',
                fontSize: '16px',
              }}
            >
              {touchViewConfig?.renderCard ? (
                tableData.length > 0 ? (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}
                  >
                    {tableData.map((item, index) => (
                      <div key={index}>{touchViewConfig.renderCard!(item, index)}</div>
                    ))}
                  </div>
                ) : (
                  <Empty
                    description={t('components.uniTable.emptyData')}
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    style={{ marginTop: '60px' }}
                  />
                )
              ) : (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '60px 20px',
                    color: '#999',
                    background: '#fafafa',
                    borderRadius: '8px',
                    border: '1px dashed var(--river-border-color)',
                  }}
                >
                  <TabletOutlined
                    style={{ fontSize: '48px', marginBottom: '16px', color: 'var(--ant-colorTextQuaternary)' }}
                  />
                  <div style={{ fontSize: '18px', marginBottom: '8px', fontWeight: 500 }}>{t('components.uniTable.touchViewTitle')}</div>
                  <div style={{ fontSize: '14px', color: '#999' }}>
                    {t('components.uniTable.touchViewHint')}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 手机端专用卡片视图 - 自动触发 */}
          {isMobile && (currentViewType === 'table' || currentViewType === 'detailTable' || (tableViewTypes && tableViewTypes.includes(currentViewType))) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 0 16px 0' }}>
              {tableData.length > 0 ? (
                tableData.map((record, index) => {
                  // 找到主显示列（通常是第一列，排除索引、勾选等）
                  const mainCol = effectiveTableColumns.find(c => c.dataIndex && !c.hideInTable && !isUniTableOperationColumn(c))
                  const otherCols = effectiveTableColumns.filter(c => c.dataIndex && !c.hideInTable && !isUniTableOperationColumn(c) && c !== mainCol).slice(0, 5)
                  const opCol = effectiveTableColumns.find(c => isUniTableOperationColumn(c))
                  
                  const getVal = (col: any) => {
                    const di = col.dataIndex
                    if (!di) return null
                    const val = Array.isArray(di) ? di.reduce((acc, k) => acc?.[k], record) : record[di]
                    if (col.render) return col.render(val, record, index)
                    if (col.valueEnum) {
                      const enumItem = col.valueEnum[val]
                      return enumItem?.text || val
                    }
                    return val
                  }

                  return (
                    <Card 
                      key={record[rowKey as string] || index}
                      variant="borderless"
                      styles={{ body: { padding: '16px' } }}
                      style={{ 
                        borderRadius: 12, 
                        background: token.colorBgContainer,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                        border: `1px solid ${token.colorBorderSecondary}`
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                        <div style={{ fontSize: 16, fontWeight: 600, color: token.colorText }}>
                          {mainCol ? getVal(mainCol) : `#${index + 1}`}
                        </div>
                        {opCol && (
                          <div className="uni-table-mobile-op">
                            {getVal(opCol)}
                          </div>
                        )}
                      </div>
                      
                      <Descriptions 
                        column={1} 
                        size="small" 
                        colon={false}
                        labelStyle={{ color: token.colorTextSecondary, width: 80 }}
                        contentStyle={{ color: token.colorText }}
                      >
                        {otherCols.map((col, idx) => (
                          <Descriptions.Item key={idx} label={col.title as string}>
                            {getVal(col)}
                          </Descriptions.Item>
                        ))}
                      </Descriptions>
                    </Card>
                  )
                })
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
              {/* 手机端简单的分页提示 */}
              <div style={{ textAlign: 'center', padding: '16px 0', opacity: 0.5, fontSize: 12 }}>
                {t('components.uniTable.paginationTotal', { total: tableData.length, start: 1, end: tableData.length })}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* 导入弹窗：仅当用户点击导入时才加载 UniverJS 相关 chunk，显著减轻首屏体积 */}
      {gatedShowImportButton && onImport && importModalVisible && (
        <Suspense fallback={null}>
          <LazyUniImport
            visible={importModalVisible}
            onCancel={() => setImportModalVisible(false)}
            onConfirm={(data) => {
              onImport(data)
              setImportModalVisible(false)
              void reloadWithTanstackCacheBust()
            }}
            headers={effectiveImportConfig.headers}
            exampleRow={effectiveImportConfig.exampleRow}
            importFieldMap={effectiveImportConfig.fieldMap}
            enableCustomImport={enableCustomImport}
            enableRelationImport={enableRelationImport}
            relationImportConfig={relationImportConfig}
            onRelationImportPrecheck={onRelationImportPrecheck}
            onRelationImportSubmit={onRelationImportSubmit}
            templateDocumentName={importTemplateDocumentName}
            onImportPrecheck={onImportPrecheck}
          />
        </Suspense>
      )}
    </>
  )
}

export default UniTable

// 导出工具函数，供其他组件使用
export { generateImportConfigFromColumns }
