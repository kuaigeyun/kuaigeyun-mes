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
 *    - **3.1 左侧功能按钮区** — `headerTitle` ← `buildLeftActions()`：**新建**、**uni-pull / uni-push（下推等单据能力请放此区，勿与右侧数据能力混排）**、**uni-batch**（`UniBatchButton` / 内置删除用 `UniBatchDeleteButton`）、编辑、工具栏「详情」入口等；实现上通过 `headerActions` 或 `toolBarActions` / `toolBarActionsAfterDelete`，以及 **ProTable `toolBarRender` 的返回值（见下）** 注入。
 *    - **3.2 右侧** — 组件内 `buildRightActions()` + `toolbar.actions`：**uni-import**（`UniImportToolbarButton` + `LazyUniImport` / `UniImport`）、**uni-export**（`UniExportMenuButton`）、**uni-sync**（`UniSyncButton`）；**表格设定**为 ProTable 原生 **`options`**（密度、列设置、reload 等，可含 `TableColumnResetButton`）。
 *
 * **重要**：传入的 **`toolBarRender` 会被剥离后只在左侧复用**：其返回值并入 `headerTitle`，**不会**出现在 ProTable 默认右侧工具栏；传给 `ProTable` 的 `toolBarRender` 由本组件重写，仅负责同步选中行并渲染 **3.2** 内建按钮。
 *
 * 4. **表格**：右侧固定列顺序由 `normalizeFixedRightColumnOrder` 规范 — **uni-lifecycle**（`lifecycle`）、**uni-action**（`uni-action` 模块约定，固定列垫后）。
 * 5. **详情 uni-detail**：列表侧由 `onDetail`、行内操作列等与页面级 **uni-detail**（如 `DetailDrawerTemplate`）配合；本文件不渲染详情壳。
 *
 * **组装清单（子模块）**：`UniSearch`、`UniView`、`UniBatchDeleteButton`（及通用 `UniBatchButton`）、`UniImportToolbarButton` + `UniImport`、`UniExportMenuButton`、`UniSyncButton`；列侧 `uni-action` / `uni-lifecycle` 在列定义中接入。
 */

import React, { useRef, ReactNode, useState, useEffect, useCallback, useMemo, Suspense, lazy } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  ProTable,
  ProCard,
  ActionType,
  ProColumns,
  ProFormInstance,
  ProTableProps,
} from '@ant-design/pro-components'
import type { ColumnsState } from '@ant-design/pro-table'
import { Button, Space, theme, Empty, ConfigProvider, Grid, Descriptions, Card, Tag } from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  EyeOutlined,
  AppstoreOutlined,
  BarsOutlined,
  BarChartOutlined,
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
import { useUserPreferenceStore } from '../../stores/userPreferenceStore'
import { useAntdResizableHeader } from 'use-antd-resizable-header'
import 'use-antd-resizable-header/dist/style.css'
import { TableContext } from '@ant-design/pro-table/es/Store/Provide'
import { formatDateBySiteSetting, formatDateTimeBySiteSetting } from '../../utils/format'
import { useNewShortcut } from '../../hooks/useNewShortcut'
import { NEW_SHORTCUT_HINT } from '../../utils/globalNewShortcut'
import { DictionaryLabel } from '../dictionary-label'
import { stableJsonForQueryKey } from '../../utils/tableQueryKey'
import { useAuditRequiredMap } from '../../hooks/useAuditRequired'
import { isUniTableOperationColumn, renderUniTableOperationCell } from '../uni-action'

/**
 * 右侧固定列必须连续排在列定义末尾；规范顺序：其它 right 固定列 → 生命周期（key/dataIndex=lifecycle）→ 操作列。
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

  const isLifecycle = (c: any) =>
    String(c.key ?? c.dataIndex ?? '') === 'lifecycle' || c.dataIndex === 'lifecycle'

  fixedRight.sort((a: any, b: any) => {
    const rank = (c: any) => (isUniTableOperationColumn(c) ? 2 : isLifecycle(c) ? 1 : 0)
    return rank(a) - rank(b)
  })
  return [...rest, ...fixedRight]
}

function isUniTableLifecycleColumn(col: any): boolean {
  const key = String(col?.key ?? col?.dataIndex ?? '')
  return key === 'lifecycle' || col?.dataIndex === 'lifecycle'
}

/** 规范：生命周期列表头与单元格左对齐（统一覆盖各页面残留的 align: center） */
function applyLifecycleColumnAlignLeft<T extends Record<string, any>>(columns: T[]): T[] {
  if (!columns?.length) return columns
  return columns.map((col: any) => {
    if (!isUniTableLifecycleColumn(col)) return col
    return { ...col, align: 'left' as const }
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
   * 是否显示高级搜索按钮（默认：true）
   */
  showAdvancedSearch?: boolean
  /**
   * 高级搜索按钮前的自定义按钮
   */
  beforeSearchButtons?: ReactNode
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
   * 选中的行键数组（用于受控模式，例如在外部清除选中状态）
   */
  selectedRowKeys?: React.Key[]
  /**
   * 行选择 checkbox 的 getCheckboxProps（用于树形表禁止勾选子行等）
   */
  rowSelectionGetCheckboxProps?: (record: T) => { disabled?: boolean }
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
   * **3.1 左侧**追加的功能节点（与新建、`toolBarRender` 注入、批量删除、编辑等同一 `Space`）。
   */
  toolBarActions?: ReactNode[]
  /**
   * **3.1 左侧**，紧接在批量删除（uni-batch 删除预设）之后的节点（如下推后的说明、与删除无关的按钮）。
   */
  toolBarActionsAfterDelete?: ReactNode[]
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
   * 导入字段映射配置（可选）
   * 用于将表头名称映射到字段名，如果不提供，将自动从 columns 中提取
   * 格式：{ '表头名称': '字段名' } 或 { '字段名': '表头名称' }
   */
  importFieldMap?: Record<string, string>
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
   * 工具栏按钮尺寸（新建、删除、导入、导出、同步等）
   * middle 为 Ant Design 默认尺寸
   */
  toolBarButtonSize?: 'large' | 'middle' | 'small'
  /**
   * 用 TanStack Query 缓存列表：相同分页+筛选在 staleTime 内即显缓存；工具栏刷新会先 invalidate 再拉数。
   * 不改变 ProTable 外观，仅替换底层请求去重/缓存（与 patch 后 debounceTime=0 配合）。
   */
  tanstackQuery?: {
    queryKeyPrefix: readonly unknown[]
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
   * **列表页应显式传入**：与源码路径一致的点分 id，如 `pages.system.users.list`、`apps.kuaizhizao.pages.sales-management.sales-orders`；
   * 同文件多表用后缀 `:2`。请使用相对路径导入至 `src/components/uni-table`（勿使用在生产构建中不可靠的 `@/components`  barrel）。
   */
  columnPersistenceId?: string
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
  showAdvancedSearch = true, // 默认显示高级搜索
  beforeSearchButtons,
  afterSearchButtons,
  enableRowSelection = false,
  onRowSelectionChange,
  selectedRowKeys: selectedRowKeysProp,
  rowSelectionGetCheckboxProps,
  enableRowEdit = false,
  onRowEditSave,
  onRowEditDelete,
  toolBarActions = [],
  toolBarActionsAfterDelete = [],
  showImportButton = true,
  onImport,
  importHeaders,
  importExampleRow,
  importFieldMap,
  importFieldRules,
  autoGenerateImportConfig = true,
  showExportButton = true,
  onExport,
  showSyncButton = false,
  onSync,
  syncButtonText,
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
  actionRef: externalActionRef,
  formRef: externalFormRef,
  tanstackQuery,
  columnPersistenceId,
  columnsState: userColumnsState,
  searchFormItems: _unusedSearchFormItems,
  ...restProps
}: UniTableProps<T>) {
  const { t } = useTranslation()
  const { token } = theme.useToken()
  const queryClient = useQueryClient()
  const getConfig = useConfigStore((s) => s.getConfig);
  const getPreference = useUserPreferenceStore((s) => s.getPreference);
  const updatePreferences = useUserPreferenceStore((s) => s.updatePreferences);
  const syncTablePreference = useUserPreferenceStore((s) => s.syncTablePreference);
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md && screens.xs // 手机端判定：小于 768px 且有 xs

  // 全局 Alt+N：当前页有新建按钮时，按 Alt+N 触发新建（与点击新建按钮一致）
  useNewShortcut(showCreateButton && onCreate ? onCreate : undefined);

  // 计算最终配置（优先使用 Props，其次使用用户偏好，最后使用全局配置）
  // 分页大小优先级：Props > User Preference > Config Store > Default(20)
  const defaultPageSize = defaultPageSizeProp ?? getPreference('ui.default_page_size', getConfig('ui.default_page_size', 20))
  
  // 表格密度优先级：User Preference > Default('large')
  const defaultSize = getPreference('ui.default_table_density', 'large') as 'large' | 'middle' | 'small'

  const loadingDelay = loadingDelayProp ?? getConfig('ui.table_loading_delay', 0)

  /** 已 patch @ant-design/pro-table：`debounceTime != null ? debounceTime : 30`，0 为同步触发 */
  const tableRequestDebounce = restProps.debounceTime ?? 0

  // 视图类型状态（支持内置类型及 customViews 的 key）
  const [currentViewType, setCurrentViewType] = useState<string>(defaultViewType)
  // 表格数据状态（用于其他视图）
  const [tableData, setTableData] = useState<T[]>([])
  // ⭐ 关键：使用 useProTableSearch Hook 管理搜索参数
  const { searchParamsRef, formRef: hookFormRef, actionRef: hookActionRef } = useProTableSearch()
  // 模糊搜索关键词状态
  const [fuzzySearchKeyword, setFuzzySearchKeyword] = useState<string>('')
  // 防抖定时器引用
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  const internalActionRef = useRef<ActionType>()
  const internalFormRef = useRef<ProFormInstance>()
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonContainerRef = useRef<HTMLDivElement>(null)

  // 使用外部传入的 ref 或内部创建的 ref（优先使用外部传入的）
  const actionRef = (externalActionRef ||
    hookActionRef ||
    internalActionRef) as React.MutableRefObject<ActionType | undefined>
  const formRef = (externalFormRef || hookFormRef || internalFormRef) as React.MutableRefObject<
    ProFormInstance | undefined
  >

  /** 父组件常写内联 request，避免其引用每帧变化触发 ProTable 重复拉数 */
  const requestRef = useRef(request)
  requestRef.current = request

  const tanstackQueryRef = useRef(tanstackQuery)
  tanstackQueryRef.current = tanstackQuery

  // 存储选中的行键（支持外部受控与内部自持两种模式）
  const [internalSelectedRowKeys, setInternalSelectedRowKeys] = useState<React.Key[]>([])
  const selectedRowKeys = selectedRowKeysProp !== undefined ? selectedRowKeysProp : internalSelectedRowKeys

  // 导入弹窗可见状态（用于 showImportButton 时）
  const [importModalVisible, setImportModalVisible] = useState(false)

  // 延迟 loading：仅在 loadingDelay 毫秒后才显示，避免快速请求时的闪烁
  const [showDelayedLoading, setShowDelayedLoading] = useState(false)
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

  // 预加载 UniImport（UniverSheet ~2MB）：直接在挂载时触发 import，让浏览器与页面其它资源并行下载。
  // 不再用 requestIdleCallback 做"空闲时"调度，那属于不确定时序的妥协。
  useEffect(() => {
    if (!showImportButton || !onImport) return
    import('../uni-import').catch(() => {})
  }, [showImportButton, onImport])

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
  const { data: auditRequiredMap } = useAuditRequiredMap()
  const hasAnyAuditEnabled = useMemo(
    () => Object.values(auditRequiredMap || {}).some((v) => v === true),
    [auditRequiredMap]
  )

  // 为 date/dateTime 列注入站点格式的展示，使站点设置中的日期格式在单据表格中生效
  // 操作列：自适应宽度、不换行（whiteSpace: nowrap，移除固定 width）
  const processedColumns = React.useMemo(() => {
    return effectiveColumns.map((col: any) => {
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
      /** 生命周期列：不参与拖拽改宽，宽度以页面列定义为准（避免持久化盖住代码里的 width） */
      if (isUniTableLifecycleColumn(col)) {
        const w = typeof col.width === 'number' ? col.width : 112
        return {
          ...col,
          width: w,
          resizable: false,
        }
      }
      if (isOperationColumn(col)) {
        const { width, uniActionRenderOptions, ...rest } = col
        const baseRender = col.render
        // 操作列统一规范：内容不换行、宽度自适应（width: auto + scroll.x: max-content 由浏览器根据内容计算）
        return {
          ...rest,
          width: 'auto',
          resizable: false,
          ellipsis: false,
          onCell: () => ({
            style: {
              whiteSpace: 'nowrap',
              overflow: 'visible',
            },
          }),
          render: baseRender
            ? (...args: any[]) => {
                const rendered = baseRender(...args)
                const record = args[1] as Record<string, any> | undefined
                const rowKey = String(record?.id ?? record?.uuid ?? args[2] ?? 'row')
                return renderUniTableOperationCell(rendered, `uni-op-${rowKey}`, {
                  suppressAuditSemanticActions: !hasAnyAuditEnabled,
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
  }, [effectiveColumns, dateFormatKey, hasAnyAuditEnabled])

  // 全项目统一策略：列宽只由页面 columns 定义控制，不启用拖拽改宽与本地列宽持久化。
  // 这样可避免「代码 width」与「localStorage columnsWidth」双控制源竞争。
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

  // 操作列：宽度自适应内容、不换行（不参与拖拽，不设固定 width）
  const effectiveTableColumns = React.useMemo(() => {
    const baseCols = resizableColumns.length > 0 ? resizableColumns : processedColumns.filter((c: any) => !isOperationColumn(c) && !c.hideInTable)
    const opCols = processedColumns.filter((c: any) => isOperationColumn(c))
    if (opCols.length === 0 && !processedColumns.some(c => c.hideInTable)) return baseCols
    
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
            ? (cellProps: any) => {
                const base = baseOnCell(cellProps)
                return {
                  ...base,
                  className: `uni-table-operation-cell ${base?.className || ''}`.trim(),
                  style: {
                    whiteSpace: 'nowrap',
                    overflow: 'visible',
                    ...(base?.style || {}),
                  },
                }
              }
            : () => ({
                className: 'uni-table-operation-cell',
                style: { whiteSpace: 'nowrap', overflow: 'visible' },
              })
        const { width: _w, ...opRest } = opCol
        result.push({
          ...opRest,
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
    return applyLifecycleColumnAlignLeft(normalizeFixedRightColumnOrder(result))
  }, [resizableColumns, processedColumns])

  // 导入配置：优先使用传入的 importHeaders/importExampleRow，否则从 columns 自动生成
  const effectiveImportConfig = React.useMemo(() => {
    if (importHeaders && importHeaders.length > 0) {
      return { headers: importHeaders, exampleRow: importExampleRow }
    }
    if (autoGenerateImportConfig && processedColumns) {
      const { headers, exampleRow } = generateImportConfigFromColumns(processedColumns, { t })
      return { headers, exampleRow }
    }
    return { headers: undefined, exampleRow: undefined }
  }, [importHeaders, importExampleRow, autoGenerateImportConfig, processedColumns, t])

  // 检测是否有操作列（用于决定scroll配置）
  // 没有操作列的表格，ProTable的scroll配置会导致不必要的滚动条
  const hasActionColumn = React.useMemo(() => {
    return effectiveColumns.some((col) => isUniTableOperationColumn(col))
  }, [effectiveColumns])

  // 有操作列时：scroll.x 用 max-content 让表格自适应内容宽度，操作列不换行
  const effectiveTableWidth =
    hasActionColumn ? 'max-content' : resizableColumns.length > 0 ? (tableWidth ?? 'max-content') : undefined

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
    if (currentViewType !== 'table' && currentViewType !== 'detailTable' && tableData.length === 0 && actionRef?.current) {
      // 延迟执行，确保组件完全初始化
      setTimeout(() => {
        actionRef.current?.reload()
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

      // 触发表格重新加载
      if (actionRef?.current) {
        actionRef.current.reload()
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
    if (searchParamsRef.current) {
      delete searchParamsRef.current.keyword
    }
    try {
      formRef.current?.resetFields?.()
    } catch {
      /* ignore */
    }
    actionRef.current?.reload?.()
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
   * 处理排序参数转换和搜索参数获取
   * useCallback 稳定引用，降低 ProTable 因父组件重渲染而重复触发请求的概率
   */
  const handleRequest = useCallback(async (
    params: any,
    sort: Record<string, 'ascend' | 'descend' | null>,
    filter: Record<string, React.ReactText[] | null>
  ) => {
    // ⭐ 延迟 loading：仅在 showLoading 且 loadingDelay 毫秒后才显示
    if (showLoading && loadingDelay > 0) {
      isLoadingRef.current = true
      if (loadingDelayTimerRef.current) {
        clearTimeout(loadingDelayTimerRef.current)
      }
      loadingDelayTimerRef.current = setTimeout(() => {
        loadingDelayTimerRef.current = null
        if (isLoadingRef.current) {
          setShowDelayedLoading(true)
        }
      }, loadingDelay)
    }

    // ⭐ 关键：获取搜索表单值（优先使用 searchParamsRef，避免表单值更新时机问题）
    const formValues = formRef.current?.getFieldsValue() || {}
    // ⚠️ 修复：优先使用 searchParamsRef.current，如果不存在则回退到 formValues
    // searchParamsRef.current 可能为空对象 {}（表示清空搜索条件），这是有效的
    // 只有当 searchParamsRef.current 是 undefined 时，才回退到 formValues
    const searchFormValues =
      searchParamsRef.current !== undefined ? searchParamsRef.current : formValues

    const keywordForPrefetch = searchFormValues?.keyword
    const skipPrefetchForPinyin = !!(keywordForPrefetch && isPinyinKeyword(keywordForPrefetch))

    try {
      const runRequest = () => requestRef.current(params, sort, filter, searchFormValues)
      const tq = tanstackQueryRef.current
      let result: Awaited<ReturnType<typeof runRequest>>
      if (tq?.queryKeyPrefix && tq.queryKeyPrefix.length > 0) {
        const pageSize = params.pageSize ?? defaultPageSize
        const current = params.current ?? 1
        const staleTimeMs = tq.staleTime ?? 60_000
        const fullQueryKey = [
          'uniTable',
          ...tq.queryKeyPrefix,
          stableJsonForQueryKey(params), // 包含 current, pageSize 以及通过 params 传递的自定义参数
          stableJsonForQueryKey(sort),
          stableJsonForQueryKey(filter),
          stableJsonForQueryKey(searchFormValues ?? {}),
        ] as const

        if (tq.staleWhileRevalidate) {
          const cached = queryClient.getQueryData(fullQueryKey) as
            | Awaited<ReturnType<typeof runRequest>>
            | undefined
          const state = queryClient.getQueryState(fullQueryKey)
          const updatedAt = state?.dataUpdatedAt ?? 0
          const cacheStale = !cached || Date.now() - updatedAt > staleTimeMs
          if (cached != null && cacheStale) {
            void queryClient
              .fetchQuery({
                queryKey: [...fullQueryKey],
                queryFn: runRequest,
                staleTime: staleTimeMs,
                gcTime: tq.gcTime,
              })
              .then(() => {
                actionRef.current?.reload?.()
              })
            result = cached
          } else {
            result = await queryClient.fetchQuery({
              queryKey: [...fullQueryKey],
              queryFn: runRequest,
              staleTime: staleTimeMs,
              gcTime: tq.gcTime,
            })
          }
        } else {
          result = await queryClient.fetchQuery({
            queryKey: [...fullQueryKey],
            queryFn: runRequest,
            staleTime: staleTimeMs,
            gcTime: tq.gcTime,
          })
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
            nextCurrent,
            pageSize,
            stableJsonForQueryKey(sort),
            stableJsonForQueryKey(filter),
            stableJsonForQueryKey(searchFormValues ?? {}),
          ] as const
          void queryClient.prefetchQuery({
            queryKey: [...nextKey],
            queryFn: () => requestRef.current(nextParams, sort, filter, searchFormValues),
            staleTime: staleTimeMs,
            gcTime: tq.gcTime,
          })
        }
      } else {
        result = await runRequest()
      }

    // 支持拼音搜索：如果关键词是拼音格式，在前端对返回的数据进行二次过滤
    const keyword = searchFormValues?.keyword
    if (keyword && isPinyinKeyword(keyword) && result.data && Array.isArray(result.data)) {
      // 避免改写 TanStack Query 缓存中的对象引用
      result = { ...result, data: [...result.data] }
      const keywordUpper = keyword.toUpperCase()

      // 使用 Promise.all 进行异步拼音匹配
      const filteredDataPromises = result.data.map(async (record: any) => {
        // 遍历所有列，检查是否有匹配的字段
        for (const column of columnsForPinyinSearch) {
          if (!column.dataIndex) continue

          // 获取字段值（支持嵌套字段，如 'user.name'）
          const getFieldValue = (obj: any, path: string | string[] | number): any => {
            if (Array.isArray(path)) {
              return path.reduce((acc, key) => acc?.[key], obj)
            }
            if (typeof path === 'number') {
              return obj?.[path]
            }
            const keys = String(path).split('.')
            return keys.reduce((acc, key) => acc?.[key], obj)
          }

          const fieldValue = getFieldValue(record, column.dataIndex as string | string[] | number)
          if (!fieldValue) continue

          // 将字段值转换为字符串进行匹配
          const valueStr = String(fieldValue)

          // 1. 文本匹配
          const textMatch = valueStr.toLowerCase().includes(keyword.toLowerCase())
          if (textMatch) return record

          // 2. 拼音首字母匹配（异步）
          const pinyinMatch = await matchPinyinInitialsAsync(valueStr, keywordUpper)
          if (pinyinMatch) return record
        }
        return null
      })

      // 等待所有匹配完成
      const filteredResults = await Promise.all(filteredDataPromises)
      const filteredData = filteredResults.filter(item => item !== null)

      // 更新结果数据
      result.data = filteredData
      // 更新总数（如果前端过滤，总数可能不准确，但至少显示过滤后的数量）
      if (result.total !== undefined) {
        result.total = filteredData.length
      }
    }

    // 保存数据到 state（用于其他视图）
    if (result.data) {
      setTableData(result.data)
    }

    return result
    } finally {
      if (showLoading && loadingDelay > 0) {
        isLoadingRef.current = false
        if (loadingDelayTimerRef.current) {
          clearTimeout(loadingDelayTimerRef.current)
          loadingDelayTimerRef.current = null
        }
        setShowDelayedLoading(false)
      }
    }
  }, [showLoading, loadingDelay, columnsForPinyinSearch, queryClient, defaultPageSize])

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

    // 新建按钮（第一位），带 Alt+N 快捷键提示
    if (showCreateButton && onCreate) {
      actions.push(
        <Button key="create" type="primary" icon={<PlusOutlined />} onClick={onCreate} size={toolBarButtonSize}>
          {(createButtonText ?? t('components.uniTable.create')) + NEW_SHORTCUT_HINT}
        </Button>
      )
    }

    // ProTable `toolBarRender`：在 UniTable 中仅用于向左侧注入节点（非右侧工具栏）
    if (restProps.toolBarRender) {
      const mockAction = { reload: actionRef.current?.reload } as any
      const mockSelectedRowKeys = selectedRowKeys as any
      const userResult = restProps.toolBarRender(mockAction, {
        selectedRowKeys: mockSelectedRowKeys,
      })

      if (Array.isArray(userResult)) {
        actions.push(...userResult)
      } else if (userResult) {
        actions.push(userResult)
      }
    }

    // 合并 toolBarActions（兼容历史用法，与 toolBarRender 等效）
    if (toolBarActions.length > 0) {
      actions.push(...toolBarActions)
    }

    // 批量删除（uni-batch 删除预设）
    if (showDeleteButton && onDelete) {
      actions.push(
        <UniBatchDeleteButton
          key="delete"
          selectedRowKeys={selectedRowKeys}
          onConfirm={onDelete}
          toolBarButtonSize={toolBarButtonSize}
          buttonText={deleteButtonText}
          confirmTitle={deleteConfirmTitle}
          confirmDescription={deleteConfirmDescription}
        />
      )
    }

    if (toolBarActionsAfterDelete.length > 0) {
      actions.push(...toolBarActionsAfterDelete)
    }

    // 修改按钮（需要选中一行）
    if (showEditButton && onEdit) {
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

    if (onDetail) {
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

  /** 3.2 右侧：uni-import / uni-export / uni-sync（表格设定见 `memoizedOptions`） */
  const buildRightActions = () => {
    const rightButtons: ReactNode[] = []

    if (showImportButton && onImport) {
      rightButtons.push(
        <UniImportToolbarButton
          key="import"
          size={toolBarButtonSize}
          onOpen={() => setImportModalVisible(true)}
        />
      )
    }

    if (showExportButton && onExport) {
      rightButtons.push(
        <UniExportMenuButton<T>
          key="export"
          size={toolBarButtonSize}
          onExport={onExport}
          selectedRowKeys={selectedRowKeys}
          tableData={tableData}
        />
      )
    }

    if (showSyncButton && onSync) {
      rightButtons.push(
        <UniSyncButton key="sync" size={toolBarButtonSize} onSync={onSync} buttonText={syncButtonText} />
      )
    }

    return rightButtons.length > 0 ? <Space size="small">{rightButtons}</Space> : undefined
  }

  const buildHeaderActions = () => {
    return buildLeftActions()
  }

  /**
   * 处理行选择变化
   */
  const handleRowSelectionChange = (keys: React.Key[]) => {
    setInternalSelectedRowKeys(keys)
    if (onRowSelectionChange) {
      onRowSelectionChange(keys)
    }
  }

  const memoizedOptions = React.useMemo(() => ({
    density: true,
    setting: {
      listsHeight: 360,
      checkedReset: false,
      extra: <TableColumnResetButton onResetResizable={handleColumnReset} />,
    },
    fullScreen: false,
    ...mergedToolbarOptions,
    reload: () => {
      const tq = tanstackQueryRef.current
      if (tq?.queryKeyPrefix && tq.queryKeyPrefix.length > 0) {
        void queryClient.invalidateQueries({
          queryKey: ['uniTable', ...tq.queryKeyPrefix],
          exact: false,
        })
      }
      mergedToolbarOptions.reload?.()
      actionRef.current?.reload()
    },
  }), [mergedToolbarOptions, queryClient, handleColumnReset])

  const memoizedRightActions = !isMobile ? buildRightActions() : undefined

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

  const memoizedRowSelection = React.useMemo(() => (
    enableRowSelection
      ? {
          type: 'checkbox' as const,
          onChange: handleRowSelectionChange,
          ...(rowSelectionGetCheckboxProps
            ? { getCheckboxProps: rowSelectionGetCheckboxProps }
            : {}),
        }
      : undefined
  ), [enableRowSelection, rowSelectionGetCheckboxProps])

  const memoizedEditable = React.useMemo(() => (
    enableRowEdit
      ? {
          type: 'multiple' as const,
          onSave: onRowEditSave as any,
          onDelete: onRowEditDelete as any,
        }
      : undefined
  ), [enableRowEdit, onRowEditSave, onRowEditDelete])

  const memoizedPagination = React.useMemo(() => ({
    defaultPageSize,
    showSizeChanger: true,
    showQuickJumper: true,
    pageSizeOptions: ['10', '20', '50', '100'],
    showTotal: (total: number, range: [number, number]) => t('components.uniTable.paginationTotal', { total, start: range[0], end: range[1] }),
  }), [defaultPageSize, t])

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
        /* ... 省略了其他样式（见下方替换内容） ... */
      `}</style>
      <div
        ref={containerRef}
        className="uni-table-container"
        style={{
          position: 'relative',
          padding: isMobile ? '0 8px' : 0,
          margin: 0,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
          <div
            ref={buttonContainerRef}
            className="pro-table-button-container"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: 8,
              rowGap: 8,
              width: '100%',
              marginTop: isMobile ? 8 : 0,
            }}
          >
            <UniSearch
              beforeSearch={beforeSearchButtons}
              betweenFuzzyAndAdvanced={
                isMobile && showCreateButton && onCreate ? (
                  <Button
                    key="mobile-create"
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={onCreate}
                    size={toolBarButtonSize}
                    style={{ flexShrink: 0 }}
                  >
                    {createButtonText ?? t('components.uniTable.create')}
                  </Button>
                ) : null
              }
              showFuzzySearch={showFuzzySearch}
              fuzzyValue={fuzzySearchKeyword}
              onFuzzyChange={handleFuzzySearch}
              onFuzzyPressEnter={(v) => handleFuzzySearch(v)}
              onFuzzyFocus={warmupPinyinIfNeeded}
              showAdvancedSearch={showAdvancedSearch}
              advancedSearchTableProps={{
                columns: processedColumns,
                formRef: formRef as React.MutableRefObject<ProFormInstance>,
                actionRef: actionRef as React.MutableRefObject<ActionType>,
                searchParamsRef,
              }}
              afterSearch={afterSearchButtons}
              showReset={!isMobile && (showFuzzySearch || showAdvancedSearch)}
              onReset={handleSearchReset}
              isMobile={isMobile}
              toolBarButtonSize={toolBarButtonSize}
            />
            {!isMobile && viewTypes && viewTypes.length > 1 ? (
              <UniView
                viewTypes={viewTypes}
                value={currentViewType}
                onChange={handleViewTypeChange}
                customViews={customViews}
              />
            ) : null}
          </div>

          <ConfigProvider getPopupContainer={() => document.body}>
            <div
              style={{
                display:
                  (currentViewType === 'table' ||
                  currentViewType === 'detailTable' ||
                  (tableViewTypes && tableViewTypes.includes(currentViewType))) && !isMobile
                    ? 'block'
                    : 'none',
                width: '100%',
              }}
            >
              <ProTable<T>
              key={`uni-pt-cols-${String(columnsPersistenceFullKey ?? 'np')}-${columnsStatePatchEpoch}`}
              headerTitle={buildHeaderActions() || headerTitle || undefined}
              actionRef={actionRef}
              formRef={formRef}
              columns={effectiveTableColumns}
              request={handleRequest}
              debounceTime={tableRequestDebounce}
              rowKey={rowKey}
              search={false}
              className="uni-table-pro-table"
              style={{ margin: 0, padding: 0 }}
              bordered={false}
              cardBordered={true}
              {...(!showLoading ? { loading: false } : loadingDelay > 0 ? { loading: showDelayedLoading } : {})}
              size={defaultSize}
              onSizeChange={(size) => {
                updatePreferences({ 'ui.default_table_density': size })
              }}
              columnsState={mergedColumnsStateProp}
              options={memoizedOptions}
              toolbar={memoizedToolbar}
              rowSelection={memoizedRowSelection}
              editable={memoizedEditable}
              pagination={memoizedPagination}
              toolBarRender={(_action, { selectedRowKeys: toolBarSelectedRowKeys }) => {
                // 同步工具栏的选中行键到 state
                if (toolBarSelectedRowKeys) {
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
                // 过滤 toolBarRender/search，合并 components/scroll 以遵守原生 ProTable 设定
                // （固定列、scroll.y 等由 rc-table 处理，仅注入列宽拖拽的 header.cell 与 scroll.x）
                const {
                  toolBarRender,
                  search,
                  scroll: userScroll,
                  components: userComponents,
                  virtual: userVirtual,
                  debounceTime: _omitDebounce,
                  ...otherProps
                } = restProps
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
                const ourScrollX = effectiveTableWidth
                let mergedScroll =
                  ourScrollX != null
                    ? { ...(userScroll || {}), x: ourScrollX }
                    : userScroll
                const useVirtual = virtualized || userVirtual === true
                if (useVirtual) {
                  mergedScroll = {
                    ...(mergedScroll || {}),
                    y: mergedScroll?.y ?? virtualTableBodyMaxHeight,
                  }
                }
                return {
                  ...otherProps,
                  ...(useVirtual ? { virtual: true } : userVirtual !== undefined ? { virtual: userVirtual } : {}),
                  components: mergedComponents,
                  ...(mergedScroll != null ? { scroll: mergedScroll } : {}),
                }
              })()}
              revalidateOnFocus={false}
              />
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
                        {tableData.map((item, index) => (
                          <div key={index} style={layout === 'waterfall' ? { breakInside: 'avoid' as const, marginBottom: 16 } : {}}>
                            {cardViewConfig!.renderCard!(item, index)}
                          </div>
                        ))}
                      </div>
                    )
                  })()
                ) : (
                  <Empty
                    description={t('components.uniTable.emptyCard')}
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
                    bodyStyle={{ paddingLeft: 16, paddingRight: 16, paddingBottom: 16 }}
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
      {showImportButton && onImport && importModalVisible && (
        <Suspense fallback={null}>
          <LazyUniImport
            visible={importModalVisible}
            onCancel={() => setImportModalVisible(false)}
            onConfirm={(data) => {
              onImport(data)
              setImportModalVisible(false)
              actionRef?.current?.reload?.()
            }}
            headers={effectiveImportConfig.headers}
            exampleRow={effectiveImportConfig.exampleRow}
          />
        </Suspense>
      )}
    </>
  )
}

export default UniTable

// 导出工具函数，供其他组件使用
export { generateImportConfigFromColumns }
