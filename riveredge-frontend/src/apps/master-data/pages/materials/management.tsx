/**
 * 物料管理合并页面
 *
 * 左侧物料分组树，右侧物料管理列表
 * 参考文件管理页面的左右两栏布局
 */

import React, { useRef, useState, useEffect, useLayoutEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams, useLocation } from 'react-router-dom'
import {
  App,
  Button,
  Space,
  Modal,
  Descriptions,
  Popconfirm,
  Tag,
  theme,
  Menu,
  List,
  Typography,
  Checkbox,
  Select,
  TreeSelect,
  Alert,
  Segmented,
  Card,
  Row,
  Col,
  Divider,
  Tooltip,
  Table,
  Skeleton,
} from 'antd'
import {
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  FolderFilled,
  FolderOpenFilled,
  ExpandOutlined,
  CompressOutlined,
  TagsOutlined,
  BarcodeOutlined,
  NumberOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  AppstoreOutlined,
  FileOutlined,
  FilePdfOutlined,
  SwapOutlined,
  RedoOutlined,
} from '@ant-design/icons'
import {
  ActionType,
  ProColumns,
  ProFormText,
  ProFormTextArea,
  ProFormSwitch,
  ProFormInstance,
} from '@ant-design/pro-components'
import type { ProDescriptionsItemProps } from '@ant-design/pro-components'
import type { DataNode, TreeProps } from 'antd/es/tree'

/** 经典 Windows 资源管理器式实心文件夹（黄褐色） */
const MATERIAL_GROUP_FOLDER_ICON_STYLE = { fontSize: 16, verticalAlign: 'middle' } as const
const MATERIAL_GROUP_FOLDER_COLOR_CLOSED = '#e8b347'
const MATERIAL_GROUP_FOLDER_COLOR_OPEN = '#d4a028'

function renderMaterialGroupFolderIcon(props: { expanded: boolean; isLeaf: boolean }) {
  if (!props.isLeaf && props.expanded) {
    return (
      <FolderOpenFilled
        style={{ ...MATERIAL_GROUP_FOLDER_ICON_STYLE, color: MATERIAL_GROUP_FOLDER_COLOR_OPEN }}
      />
    )
  }
  return (
    <FolderFilled
      style={{ ...MATERIAL_GROUP_FOLDER_ICON_STYLE, color: MATERIAL_GROUP_FOLDER_COLOR_CLOSED }}
    />
  )
}

// 导入现有组件
import SafeProFormSelect from '../../../../components/safe-pro-form-select'
import { UniTable } from '../../../../components/uni-table'
import { UniBatchSplitToolbar } from '../../../../components/uni-batch'
import { TwoColumnLayout, FormModalTemplate, flushDrawerOpen } from '../../../../components/layout-templates'
import {
  MODAL_CONFIG,
  DRAWER_CONFIG,
  LIST_PAGE_TABLE_SCROLL,
} from '../../../../components/layout-templates/constants'
import { UniDetail, detailDrawerDescriptionItems } from '../../../../components/uni-detail'
import { MaterialForm } from '../../components/MaterialForm'
import FabricationRawMaterialWizard from '../../components/FabricationRawMaterialWizard'
import {
  fabricationMaterialNeedsRawMaterialSetup,
  isFabricationFromValues,
  toFabricationMaterialRef,
} from '../../utils/fabricationRawMaterial'
import type { FabricationMaterialRef } from '../../utils/fabricationRawMaterial'
import { QRCodeGenerator } from '../../../../components/qrcode'

// 导入服务和类型
import { materialApi, materialGroupApi } from '../../services/material'
import {
  formatMaterialGroupLabel,
  formatMaterialGroupHoverTitle,
  type Material,
  type MaterialCreate,
  type MaterialUpdate,
  type MaterialGroup,
  type MaterialGroupCreate,
  type MaterialGroupUpdate,
  type MaterialBulkTrackingPayload,
  type StandardPartsPresetCatalog,
} from '../../types/material'
import { batchRuleApi, serialRuleApi } from '../../services/batchSerialRules'
import { getDataDictionaryByCode, getDictionaryItemList } from '../../../../services/dataDictionary'
import { SecureImage } from '../../../../components/secure-image'
import FilePreviewModal from '../../../../components/file-preview'
import { getFileByUuid, getFileDownloadUrlWithToken } from '../../../../services/file'
import { batchImport } from '../../../../utils/batchOperations'
import { downloadFile } from '../../../../utils'
import { useNewShortcut } from '../../../../hooks/useNewShortcut'
import { NEW_SHORTCUT_HINT } from '../../../../utils/globalNewShortcut'
import { extractProTableSort } from '../../../../utils/tableQueryKey'
import { getSuspendedModal, clearSuspendedModal } from '../../utils/suspendedModal'
import { useCustomFieldsForList } from '../../../../hooks/useCustomFieldsForList'
import { useTrialRunMode } from '../../../../hooks/useTrialRunMode'
import {
  CustomFieldsDetailSection,
  hasCustomFieldsDetailContent,
} from '../../../../components/custom-fields'

/** 与 MaterialForm 一致：表示使用系统默认批号/序列号规则 */
const SYSTEM_DEFAULT_BATCH_SERIAL_RULE = '__SYSTEM_DEFAULT__'

const CONTEXT_MENU_VIEWPORT_PADDING = 8

/** 右键菜单贴边时向上/向左偏移，避免底部或右侧被裁切 */
function clampContextMenuPosition(
  x: number,
  y: number,
  width: number,
  height: number,
): { x: number; y: number } {
  const pad = CONTEXT_MENU_VIEWPORT_PADDING
  const vw = window.innerWidth
  const vh = window.innerHeight
  let nextX = x
  let nextY = y
  if (x + width > vw - pad) {
    nextX = Math.max(pad, vw - width - pad)
  }
  if (y + height > vh - pad) {
    nextY = Math.max(pad, y - height)
  }
  if (nextY + height > vh - pad) {
    nextY = Math.max(pad, vh - height - pad)
  }
  return { x: nextX, y: nextY }
}

/** 列表首列附件：图片走缩略图，PDF/DWG 等显示图标并可新开下载页 */
const MaterialAttachmentThumb: React.FC<{ fileUuid: string; alt?: string }> = ({ fileUuid, alt }) => {
  const { t } = useTranslation()
  const [ext, setExt] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [fileName, setFileName] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    getFileByUuid(fileUuid)
      .then((f) => {
        if (cancelled) return
        const fromField = (f.file_extension && String(f.file_extension).toLowerCase()) || ''
        const name = f.original_name || ''
        const fromName =
          name.lastIndexOf('.') >= 0 ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : ''
        setExt(fromField || fromName || '')
        setFileName(name)
      })
      .catch(() => {
        if (!cancelled) setExt('')
      })
    return () => {
      cancelled = true
    }
  }, [fileUuid])

  const imageExt = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg']
  // 未知扩展名时先按图片展示，避免 getFileByUuid 阻塞整表缩略图
  if (ext === null || imageExt.includes(ext)) {
    return (
      <SecureImage
        fileUuid={fileUuid}
        alt={alt || ''}
        width={40}
        height={40}
        lazyLoad
        thumbSize={64}
      />
    )
  }

  const open = async () => {
    if (ext === 'pdf') {
      setPreviewOpen(true)
      return
    }
    try {
      const url = await getFileDownloadUrlWithToken(fileUuid)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      <Tooltip title={t('app.master-data.materials.openAttachment')}>
        <Button
          type="link"
          size="small"
          style={{ padding: 0, height: 40, width: 40, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          icon={
            ext === 'pdf' ? (
              <FilePdfOutlined style={{ fontSize: 22 }} />
            ) : (
              <FileOutlined style={{ fontSize: 22 }} />
            )
          }
          onClick={open}
        />
      </Tooltip>

      {ext === 'pdf' ? (
        <FilePreviewModal
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          fileUuid={fileUuid}
          fileName={fileName || alt || 'PDF'}
          fileType="application/pdf"
          fileExtension="pdf"
          title={t('app.master-data.materials.openAttachment')}
          width="calc(100vw - 32px)"
          height="calc(100vh - 32px)"
        />
      ) : null}
    </>
  )
}

type StandardPartFlatRow = {
  presetKey: string
  industryId: string
  industryName: string
  categoryId: string
  categoryName: string
  primaryCategory: string
  name: string
  specification: string
  gbStandard: string
  gbCode: string
  baseUnit: string
  texture?: string
}

/**
 * 物料管理合并页面组件
 */
const MaterialsManagementPage: React.FC = () => {
  const { t } = useTranslation()
  const trialRunMode = useTrialRunMode()
  const { message: messageApi } = App.useApp()
  const { token } = theme.useToken()
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()

  // 左侧分组树状态
  const [groupTreeData, setGroupTreeData] = useState<DataNode[]>([])
  const [filteredGroupTreeData, setFilteredGroupTreeData] = useState<DataNode[]>([])
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([])
  const [selectedGroupKeys, setSelectedGroupKeys] = useState<React.Key[]>(['all'])
  const [groupSearchValue, setGroupSearchValue] = useState<string>('')

  // 右侧物料列表状态
  const actionRef = useRef<ActionType>(null)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])

  /** 批量批号/序列号管理（后端 batch-tracking 单接口） */
  const [batchSerialModalOpen, setBatchSerialModalOpen] = useState(false)
  const [batchMoveGroupOpen, setBatchMoveGroupOpen] = useState(false)
  const [batchMoveGroupId, setBatchMoveGroupId] = useState<number | undefined>(undefined)
  const [batchMoveGroupSubmitting, setBatchMoveGroupSubmitting] = useState(false)
  const [rewriteMainCodesOpen, setRewriteMainCodesOpen] = useState(false)
  const [rewriteMainCodesSubmitting, setRewriteMainCodesSubmitting] = useState(false)
  const [rewriteMainCodesScope, setRewriteMainCodesScope] = useState<'selected' | 'group'>('selected')
  const [rewriteResetSequence, setRewriteResetSequence] = useState(false)
  const [bulkTrackingMode, setBulkTrackingMode] = useState<'enable' | 'disable'>('enable')
  const [bulkApplyBatch, setBulkApplyBatch] = useState(true)
  const [bulkApplySerial, setBulkApplySerial] = useState(true)
  const [bulkBatchRuleId, setBulkBatchRuleId] = useState<number | string>(SYSTEM_DEFAULT_BATCH_SERIAL_RULE)
  const [bulkSerialRuleId, setBulkSerialRuleId] = useState<number | string>(SYSTEM_DEFAULT_BATCH_SERIAL_RULE)
  const [batchRulesForBulk, setBatchRulesForBulk] = useState<{ id: number; name: string; code: string }[]>([])
  const [serialRulesForBulk, setSerialRulesForBulk] = useState<{ id: number; name: string; code: string }[]>([])
  const [bulkRuleOptionsLoading, setBulkRuleOptionsLoading] = useState(false)
  const [batchSerialSubmitting, setBatchSerialSubmitting] = useState(false)

  // 表单引用
  const groupFormRef = useRef<ProFormInstance>()

  // Modal 和 Drawer 状态
  const [groupModalVisible, setGroupModalVisible] = useState(false)
  const [groupIsEdit, setGroupIsEdit] = useState(false)
  const [currentGroup, setCurrentGroup] = useState<MaterialGroup | null>(null)
  /** 新建分组时预填的父分组 ID（右键「新建子分组」） */
  const [groupParentIdPreset, setGroupParentIdPreset] = useState<number | undefined>(undefined)
  const [groupFormLoading, setGroupFormLoading] = useState(false)

  const [materialModalVisible, setMaterialModalVisible] = useState(false)
  const [materialRestoreInitialValues, setMaterialRestoreInitialValues] = useState<Record<string, any> | null>(null)
  const [materialIsEdit, setMaterialIsEdit] = useState(false)
  const [materialFormLoading, setMaterialFormLoading] = useState(false)
  const [materialDrawerVisible, setMaterialDrawerVisible] = useState(false)
  const [currentMaterial, setCurrentMaterial] = useState<Material | null>(null)
  const [materialDetailLoading, setMaterialDetailLoading] = useState(false)
  const [fabricationWizardOpen, setFabricationWizardOpen] = useState(false)
  const [fabricationWizardMaterial, setFabricationWizardMaterial] = useState<FabricationMaterialRef | null>(null)

  // 数据状态
  const [materialGroups, setMaterialGroups] = useState<MaterialGroup[]>([])
  const [materialGroupsLoading, setMaterialGroupsLoading] = useState(false)
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false)
  const selectedGroupIdRef = useRef<number | null>(null)
  const hasGroupSelectionInitializedRef = useRef(false)

  // 右键菜单状态
  const [contextMenuVisible, setContextMenuVisible] = useState(false)
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 })
  const [contextMenuGroup, setContextMenuGroup] = useState<MaterialGroup | null>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)

  const [baseUnitOptions, setBaseUnitOptions] = useState<Array<{ label: string; value: string }>>(
    []
  )
  const [loadingBaseUnitOptions, setLoadingBaseUnitOptions] = useState(false)

  const [standardPresetOpen, setStandardPresetOpen] = useState(false)
  const [standardPresetLoading, setStandardPresetLoading] = useState(false)
  const [standardPresetSubmitting, setStandardPresetSubmitting] = useState(false)
  const [standardPresetCatalog, setStandardPresetCatalog] = useState<StandardPartsPresetCatalog | null>(null)
  const [standardPresetIndustryId, setStandardPresetIndustryId] = useState<string>('')
  const [standardPresetPrimaryId, setStandardPresetPrimaryId] = useState<string>('')
  const [standardPresetCategoryId, setStandardPresetCategoryId] = useState<string>('')
  const [standardPresetSelectedKeys, setStandardPresetSelectedKeys] = useState<string[]>([])
  const [standardPresetGroupMode, setStandardPresetGroupMode] = useState<'single' | 'preset_by_category'>('single')
  const [standardPresetGroupUuid, setStandardPresetGroupUuid] = useState<string>('')
  const [standardPresetParentGroupUuid, setStandardPresetParentGroupUuid] = useState<string>('')
  const [standardPresetCodeMode, setStandardPresetCodeMode] = useState<'auto' | 'gb'>('auto')

  const {
    customFields,
    customFieldValues,
    generateCustomFieldColumns,
    enrichRecordsWithCustomFields,
    loadFieldValuesForDetail,
    resetDetailFieldValues,
  } = useCustomFieldsForList<Material>({ tableName: 'master_data_materials' });

  /**
   * 当自定义字段加载完成后，刷新表格以显示自定义字段列
   */
  useEffect(() => {
    if (customFields.length > 0 && actionRef.current) {
      setTimeout(() => {
        actionRef.current?.reload();
      }, 200);
    }
  }, [customFields.length]);

  /**
   * 当详情抽屉打开时，加载自定义字段值
   */
  useEffect(() => {
    if (materialDrawerVisible && currentMaterial?.id) {
      loadFieldValuesForDetail(currentMaterial.id);
    } else if (!materialDrawerVisible) {
      resetDetailFieldValues();
    }
  }, [materialDrawerVisible, currentMaterial?.id, loadFieldValuesForDetail, resetDetailFieldValues]);

  const standardPresetIndustries = useMemo(
    () => standardPresetCatalog?.industries ?? [],
    [standardPresetCatalog]
  )

  const standardPresetFlatRows = useMemo((): StandardPartFlatRow[] => {
    const rows: StandardPartFlatRow[] = []
    for (const industry of standardPresetIndustries) {
      for (const primary of industry.primaryCategories ?? []) {
        for (const cat of primary.categories ?? []) {
          for (const it of cat.items ?? []) {
            rows.push({
              presetKey: it.presetKey,
              industryId: industry.id,
              industryName: industry.name,
              categoryId: cat.id,
              categoryName: cat.name,
              primaryCategory: primary.id || cat.primaryCategory || 'standard_parts',
              name: it.name,
              specification: it.specification ?? '',
              gbStandard: it.gbStandard ?? '',
              gbCode: it.gbCode ?? '',
              baseUnit: it.baseUnit ?? '件',
              texture: it.texture,
            })
          }
        }
      }
    }
    return rows
  }, [standardPresetIndustries])

  const standardPresetFilteredRows = useMemo(() => {
    if (standardPresetIndustryId) {
      return standardPresetFlatRows.filter((r) => r.industryId === standardPresetIndustryId).filter((r) => {
        if (standardPresetCategoryId) return r.categoryId === standardPresetCategoryId
        if (standardPresetPrimaryId) return r.primaryCategory === standardPresetPrimaryId
        return true
      })
    }
    if (standardPresetCategoryId) {
      return standardPresetFlatRows.filter((r) => r.categoryId === standardPresetCategoryId)
    }
    if (standardPresetPrimaryId) {
      return standardPresetFlatRows.filter((r) => r.primaryCategory === standardPresetPrimaryId)
    }
    return standardPresetFlatRows
  }, [standardPresetFlatRows, standardPresetIndustryId, standardPresetCategoryId, standardPresetPrimaryId])

  const standardPresetIndustryOptions = useMemo(
    () =>
      standardPresetIndustries.map((ind) => ({
        value: ind.id,
        label: ind.name,
      })),
    [standardPresetIndustries]
  )

  const standardPresetPrimaryOptions = useMemo(() => {
    const source = standardPresetCatalog?.taxonomy?.primaryCategories ?? []
    const allowedPrimary = new Set(
      standardPresetIndustryId
        ? standardPresetFlatRows
            .filter((r) => r.industryId === standardPresetIndustryId)
            .map((r) => r.primaryCategory)
        : source.map((pc) => pc.id)
    )
    return source
      .filter((pc) => allowedPrimary.has(pc.id))
      .map((pc) => ({
      value: pc.id,
      label: t(`app.master-data.materials.standardPresetPrimary.${pc.id}`, { defaultValue: pc.name || pc.id }),
    }))
  }, [standardPresetCatalog, standardPresetIndustryId, standardPresetFlatRows, t])

  const standardPresetSecondaryOptions = useMemo(() => {
    const source = standardPresetCatalog?.taxonomy?.secondaryCategories ?? []
    const allowedCategory = new Set(
      standardPresetFlatRows
        .filter((r) => (standardPresetIndustryId ? r.industryId === standardPresetIndustryId : true))
        .filter((r) => (standardPresetPrimaryId ? r.primaryCategory === standardPresetPrimaryId : true))
        .map((r) => r.categoryId)
    )
    const filtered = source.filter((c) => allowedCategory.has(c.id))
    return filtered.map((cat) => ({ value: cat.id, label: cat.name }))
  }, [standardPresetCatalog, standardPresetFlatRows, standardPresetIndustryId, standardPresetPrimaryId])

  const handleOpenStandardPreset = useCallback(async () => {
    setStandardPresetLoading(true)
    try {
      const cat = await materialApi.getStandardPartsPresetPreview()
      if (!Array.isArray(cat.industries) || cat.industries.length === 0) {
        throw new Error(t('app.master-data.materials.standardPresetIndustryEmpty'))
      }
      if (!cat.taxonomy?.primaryCategories?.length || !cat.taxonomy?.secondaryCategories?.length) {
        throw new Error(t('app.master-data.materials.standardPresetTaxonomyEmpty'))
      }
      setStandardPresetCatalog(cat)
      const industries = cat.industries
      setStandardPresetIndustryId('')
      setStandardPresetPrimaryId('')
      setStandardPresetCategoryId('')
      const allKeys = industries.flatMap((ind) =>
        (ind.primaryCategories ?? []).flatMap((pc) =>
          (pc.categories ?? []).flatMap((c) => (c.items ?? []).map((i) => i.presetKey))
        )
      )
      setStandardPresetSelectedKeys(allKeys)
      setStandardPresetGroupMode('single')
      setStandardPresetParentGroupUuid('')
      if (selectedGroupId != null) {
        const g = materialGroups.find((x) => x.id === selectedGroupId)
        setStandardPresetGroupUuid(g?.uuid ?? '')
      } else {
        setStandardPresetGroupUuid('')
      }
      setStandardPresetCodeMode('auto')
      setStandardPresetOpen(true)
    } catch (e: any) {
      messageApi.error(e?.message || t('common.operationFailed'))
    } finally {
      setStandardPresetLoading(false)
    }
  }, [materialGroups, messageApi, selectedGroupId, t])

  /**
   * 递归收集所有节点的key
   */
  const collectAllKeys = useCallback((nodes: DataNode[]): React.Key[] => {
    const getAll = (data: DataNode[]): React.Key[] => {
      let keys: React.Key[] = []
      data.forEach(node => {
        keys.push(node.key)
        if (node.children && node.children.length > 0) {
          keys = keys.concat(getAll(node.children))
        }
      })
      return keys
    }
    return getAll(nodes)
  }, [])

  /**
   * 递归过滤树数据（支持搜索子分组）
   * 如果父分组匹配，显示父分组及其所有子分组
   * 如果子分组匹配，显示父分组和匹配的子分组
   */
  const filterTreeData = useCallback((nodes: DataNode[], keyword: string): DataNode[] => {
    if (!keyword.trim()) {
      return nodes
    }

    const keywordLower = keyword.toLowerCase()
    const filter = (data: DataNode[]): DataNode[] => {
      const filtered: DataNode[] = []
      data.forEach(node => {
        // 检查当前节点是否匹配（排除"全部物料"节点）
        const searchLabel = (node as DataNode & { searchLabel?: string }).searchLabel
        const matches =
          node.key !== 'all' &&
          (String(searchLabel ?? node.title ?? '').toLowerCase().includes(keywordLower) ||
            String(node.title ?? '').toLowerCase().includes(keywordLower))

        // 递归过滤子节点
        const filteredChildren = node.children ? filter(node.children) : []

        // 如果当前节点匹配，或者有子节点匹配，则包含此节点
        if (matches || filteredChildren.length > 0) {
          filtered.push({
            ...node,
            children:
              filteredChildren.length > 0 ? filteredChildren : matches ? node.children : undefined,
          })
        }
      })
      return filtered
    }

    return filter(nodes)
  }, [])

  const handleEditMaterial = useCallback(
    async (record: Material) => {
      try {
        setMaterialIsEdit(true)
        // 获取物料详情
        const detail = await materialApi.get(record.uuid)
        setCurrentMaterial(detail)
        setMaterialModalVisible(true)
      } catch (error: any) {
        messageApi.error(error.message || t('app.master-data.materials.getDetailFailed'))
      }
    },
    [messageApi, t]
  )

  const handleViewMaterial = useCallback(
    async (record: Material) => {
      flushDrawerOpen(() => {
        setMaterialDrawerVisible(true)
        setMaterialDetailLoading(true)
        setCurrentMaterial(null)
        resetDetailFieldValues()
      })
      try {
        const detail = await materialApi.get(record.uuid)
        setCurrentMaterial(detail)
        await loadFieldValuesForDetail(record.uuid)
      } catch (error: any) {
        messageApi.error(error.message || t('app.master-data.materials.getDetailFailed'))
        setMaterialDrawerVisible(false)
        setCurrentMaterial(null)
      } finally {
        setMaterialDetailLoading(false)
      }
    },
    [messageApi, t]
  )

  /**
   * 将后端树形数据转换为Ant Design Tree组件格式
   */
  const convertToTreeData = useCallback((treeResponse: any[]): DataNode[] => {
    const convertNode = (node: any): DataNode & { searchLabel?: string } => {
      const label = formatMaterialGroupLabel(node)
      // rc-tree 将 data.title 写入 node-content-wrapper 的 HTML title（含右侧空白区），须用完整悬停文案
      return {
        title: formatMaterialGroupHoverTitle(node),
        searchLabel: label,
        key: node.id.toString(),
        isLeaf: !node.children || node.children.length === 0,
        children: node.children ? node.children.map(convertNode) : undefined,
      }
    }

    return [
      {
        title: t('app.master-data.materials.allMaterials'),
        key: 'all',
        isLeaf: false,
        children: [
          ...treeResponse.map(convertNode),
          {
            title: t('app.master-data.materials.noGroup'),
            key: 'no-group',
            isLeaf: true,
          },
        ],
      },
    ]
  }, [t])

  /** 批量移动分组：TreeSelect 用树形数据（不含「全部物料」根节点） */
  const batchMoveGroupTreeData = useMemo(() => {
    type TreeNode = { value: number; title: string; key: string; children?: TreeNode[] }
    const toTreeSelectNodes = (nodes: DataNode[] | undefined): TreeNode[] => {
      if (!nodes?.length) return []
      const out: TreeNode[] = []
      for (const node of nodes) {
        if (node.key === 'all') {
          out.push(...toTreeSelectNodes(node.children))
          continue
        }
        const id = Number(node.key)
        if (!Number.isFinite(id)) continue
        const searchLabel = (node as DataNode & { searchLabel?: string }).searchLabel
        const title =
          searchLabel ??
          (typeof node.title === 'string' ? node.title : String(node.title ?? ''))
        out.push({
          value: id,
          key: String(node.key),
          title,
          children: node.children?.length ? toTreeSelectNodes(node.children) : undefined,
        })
      }
      return out
    }
    return toTreeSelectNodes(groupTreeData)
  }, [groupTreeData])

  /**
   * 加载物料分组树形结构
   */
  const loadMaterialGroups = useCallback(async () => {
    try {
      setMaterialGroupsLoading(true)

      // 获取树形结构数据
      const treeResult = await materialGroupApi.tree()

      // 构建树形数据
      const treeData: DataNode[] = convertToTreeData(treeResult)

      setGroupTreeData(treeData)
      setFilteredGroupTreeData(treeData)

      // 同时获取平级列表用于其他操作（如果需要）
      const listResult = await materialGroupApi.list({ limit: 1000 })
      setMaterialGroups(listResult)

      const allKeys = collectAllKeys(treeData)
      setExpandedKeys(allKeys)
    } catch (error: any) {
      console.error('加载物料分组树形结构失败:', error)
      messageApi.error(t('app.master-data.materials.loadGroupFailed'))
    } finally {
      setMaterialGroupsLoading(false)
    }
  }, [messageApi, convertToTreeData, collectAllKeys, t])

  /**
   * 加载数据字典选项（基础单位）
   */
  const loadDictionaryOptions = useCallback(async () => {
    // 加载基础单位选项
    try {
      setLoadingBaseUnitOptions(true)
      const baseUnitDict = await getDataDictionaryByCode('MATERIAL_UNIT')
      const baseUnitItems = await getDictionaryItemList(baseUnitDict.uuid, true)
      setBaseUnitOptions(
        baseUnitItems
          .sort((a, b) => a.sort_order - b.sort_order)
          .map(item => ({ label: item.label, value: item.value }))
      )
    } catch (error: any) {
      console.error('加载基础单位选项失败:', error)
    } finally {
      setLoadingBaseUnitOptions(false)
    }
  }, [])

  // 恢复暂存的物料表单（从悬浮按钮返回时：URL 带 restore=1 + sessionStorage 有数据）
  useEffect(() => {
    const state = getSuspendedModal()
    const isRestoreUrl = searchParams.get('restore') === '1'
    const isMaterialsPath = location.pathname.endsWith('/materials') && !location.pathname.includes('/materials/')
    if (state?.formData && (isRestoreUrl || (isMaterialsPath && state.returnPath?.endsWith('/materials')))) {
      // 使用 setTimeout 避免在 Effect 中同步触发 setState 警告
      setTimeout(() => {
        setMaterialRestoreInitialValues(state.formData)
        setMaterialModalVisible(true)
        setMaterialIsEdit(false)
        setCurrentMaterial(null)
        clearSuspendedModal()
        if (isRestoreUrl) {
          const next = new window.URLSearchParams(searchParams)
          next.delete('restore')
          setSearchParams(next, { replace: true })
        }
      }, 0)
    }
  }, [location.pathname, searchParams, setSearchParams])

  // 点击外部关闭右键菜单
  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenuVisible) {
        setContextMenuVisible(false)
      }
    }

    document.addEventListener('click', handleClickOutside)
    return () => {
      document.removeEventListener('click', handleClickOutside)
    }
  }, [contextMenuVisible])

  // 根据菜单实际尺寸调整位置（底部空间不足时向上弹出）
  useLayoutEffect(() => {
    if (!contextMenuVisible) return
    const el = contextMenuRef.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    const adjusted = clampContextMenuPosition(
      contextMenuPosition.x,
      contextMenuPosition.y,
      width,
      height,
    )
    if (adjusted.x !== contextMenuPosition.x || adjusted.y !== contextMenuPosition.y) {
      setContextMenuPosition(adjusted)
    }
  }, [contextMenuVisible, contextMenuGroup, contextMenuPosition.x, contextMenuPosition.y])

  // 物料来源类型选项（用于搜索下拉框和列表展示，使用 i18n）
  const sourceTypeOptions = useMemo(() => [
    { label: t('app.master-data.materialForm.sourceMake'), value: 'Make' },
    { label: t('app.master-data.materialForm.sourceBuy'), value: 'Buy' },
    { label: t('app.master-data.materialForm.sourceOutsource'), value: 'Outsource' },
    { label: t('app.master-data.materialForm.sourcePhantom'), value: 'Phantom' },
    { label: t('app.master-data.materialForm.sourceService'), value: 'Service' },
  ], [t])




  /**
   * 处理URL参数（从二维码扫描跳转过来时自动打开详情）
   */
  useEffect(() => {
    const materialUuid = searchParams.get('materialUuid')
    const action = searchParams.get('action')

    if (materialUuid && action === 'detail') {
      // 自动打开物料详情
      handleViewMaterial({ uuid: materialUuid } as Material)
      // 清除URL参数
      setSearchParams({}, { replace: true })
    }
    if (materialUuid && action === 'edit') {
      // 自动打开物料编辑（从BOM设计器等页面快捷跳转）
      handleEditMaterial({ uuid: materialUuid } as Material)
      setSearchParams({}, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, setSearchParams, handleViewMaterial, handleEditMaterial])

  /**
   * 处理分组搜索
   */
  useEffect(() => {
    if (!groupSearchValue.trim()) {
      setFilteredGroupTreeData(groupTreeData)
    } else {
      const filtered = filterTreeData(groupTreeData, groupSearchValue)
      setFilteredGroupTreeData(filtered)

      // 自动展开所有匹配的节点
      const allKeys = collectAllKeys(filtered)
      setExpandedKeys(allKeys)
    }
  }, [groupTreeData, groupSearchValue, filterTreeData, collectAllKeys])

  /**
   * 初始化加载
   */
  useEffect(() => {
    loadMaterialGroups()
    loadDictionaryOptions()
  }, [loadMaterialGroups, loadDictionaryOptions])

  /**
   * 分组相关操作
   */
  /**
   * 切换展开/收起所有分组
   */
  const handleToggleExpand = useCallback(() => {
    // 如果当前展开的节点数量少于所有节点数量的一半，则视为折叠状态，进行展开
    // 否则视为展开状态，进行折叠
    // 注意：如果有搜索结果，仅针对搜索结果进行操作
    const targetData = filteredGroupTreeData.length > 0 ? filteredGroupTreeData : groupTreeData
    const allKeys = collectAllKeys(targetData)
    
    // 判断"全部展开"的标准：我们可以简单地检查 expandedKeys 的长度
    // 但为了更好的体验，如果 expandedKeys 包含了大部分 key，我们认为是展开的，点击则是收起
    // 这里的"大部分"我们定义为 > 1 (因为 'all' 总是存在的)
    // 更好的逻辑：
    // 如果 expandedKeys 只包含 'all' (或者为空)，则展开所有
    // 否则，收起所有（只保留 'all'）
    
    if (expandedKeys.length <= 1) {
       setExpandedKeys(allKeys)
    } else {
       setExpandedKeys(['all'])
    }
  }, [expandedKeys, filteredGroupTreeData, groupTreeData, collectAllKeys])

  const handleCreateGroup = useCallback(() => {
    setGroupParentIdPreset(undefined)
    setGroupIsEdit(false)
    setCurrentGroup(null)
    setGroupModalVisible(true)
  }, [])

  const handleCreateSubGroup = useCallback((parent: MaterialGroup) => {
    setGroupParentIdPreset(parent.id)
    setGroupIsEdit(false)
    setCurrentGroup(null)
    setGroupModalVisible(true)
  }, [])

  const handleCloseGroupModal = useCallback(() => {
    setGroupModalVisible(false)
    setGroupParentIdPreset(undefined)
  }, [])

  const handleEditGroup = useCallback((group: MaterialGroup) => {
    setGroupParentIdPreset(undefined)
    setGroupIsEdit(true)
    setCurrentGroup(group)
    setGroupModalVisible(true)
  }, [])

  const handleDeleteGroup = useCallback(
    async (group: MaterialGroup) => {
      try {
        await materialGroupApi.delete(group.uuid)
        messageApi.success(t('common.deleteSuccess'))
        loadMaterialGroups()
      } catch (error: any) {
        messageApi.error(error.message || t('common.deleteFailed'))
      }
    },
    [messageApi, loadMaterialGroups]
  )

  const handleGroupSubmit = async (values: any) => {
    try {
      setGroupFormLoading(true)

      if (groupIsEdit && currentGroup) {
        await materialGroupApi.update(currentGroup.uuid, values as MaterialGroupUpdate)
        messageApi.success(t('common.updateSuccess'))
      } else {
        await materialGroupApi.create(values as MaterialGroupCreate)
        messageApi.success(t('common.createSuccess'))
      }

      handleCloseGroupModal()
      loadMaterialGroups()
    } catch (error: any) {
      messageApi.error(error.message || (groupIsEdit ? t('common.updateFailed') : t('common.createFailed')))
    } finally {
      setGroupFormLoading(false)
    }
  }

  /**
   * 物料相关操作
   */
  const handleCreateMaterial = useCallback(async () => {
    setMaterialIsEdit(false)
    setCurrentMaterial(null)
    setMaterialModalVisible(true)
    // 注意：编号生成逻辑已移至 MaterialForm 组件内部
  }, [])

  // Alt+N 绑定到新建物料（与新建分组区分，仅新建物料响应快捷键）
  useNewShortcut(handleCreateMaterial)

  const handleGroupSelect: TreeProps['onSelect'] = selectedKeys => {
    if (selectedKeys.length > 0) {
      const key = selectedKeys[0] as string
      setSelectedGroupKeys(selectedKeys)

      if (key === 'all') {
        selectedGroupIdRef.current = null
        setSelectedGroupId(null)
      } else if (key === 'no-group') {
        selectedGroupIdRef.current = -1
        setSelectedGroupId(-1)
      } else {
        const groupId = parseInt(key)
        selectedGroupIdRef.current = groupId
        setSelectedGroupId(groupId)
      }
    }
  }

  useEffect(() => {
    // 首次渲染不触发，避免页面初始化时重复请求
    if (!hasGroupSelectionInitializedRef.current) {
      hasGroupSelectionInitializedRef.current = true
      return
    }
    actionRef.current?.reload()
  }, [selectedGroupKeys])

  const handleGroupExpand: TreeProps['onExpand'] = expandedKeys => {
    setExpandedKeys(expandedKeys)
  }

  const handleGroupContextMenu = (e: React.MouseEvent, group: MaterialGroup | null) => {
    e.preventDefault()
    e.stopPropagation()

    setContextMenuGroup(group)
    setContextMenuPosition({ x: e.clientX, y: e.clientY })
    setContextMenuVisible(true)
  }

  const handleOpenBatchSerialModal = useCallback(() => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('app.master-data.materials.selectForBatchSerial'))
      return
    }
    setBulkTrackingMode('enable')
    setBulkApplyBatch(true)
    setBulkApplySerial(true)
    setBulkBatchRuleId(SYSTEM_DEFAULT_BATCH_SERIAL_RULE)
    setBulkSerialRuleId(SYSTEM_DEFAULT_BATCH_SERIAL_RULE)
    setBatchSerialModalOpen(true)
    setBulkRuleOptionsLoading(true)
    Promise.all([
      batchRuleApi.list({ page: 1, pageSize: 500, isActive: true }),
      serialRuleApi.list({ page: 1, pageSize: 500, isActive: true }),
    ])
      .then(([br, sr]) => {
        setBatchRulesForBulk(br.items.map((r) => ({ id: r.id, name: r.name, code: r.code })))
        setSerialRulesForBulk(sr.items.map((r) => ({ id: r.id, name: r.name, code: r.code })))
      })
      .catch(() => {
        messageApi.error(t('app.master-data.materials.batchTrackingLoadRulesFailed'))
        setBatchRulesForBulk([])
        setSerialRulesForBulk([])
      })
      .finally(() => setBulkRuleOptionsLoading(false))
  }, [selectedRowKeys, messageApi, t])

  const handleConfirmBatchSerial = useCallback(async () => {
    if (!bulkApplyBatch && !bulkApplySerial) {
      messageApi.warning(t('app.master-data.materials.batchTrackingPickOneDimension'))
      return Promise.reject()
    }
    setBatchSerialSubmitting(true)
    try {
      const payload: MaterialBulkTrackingPayload = {
        material_uuids: selectedRowKeys.map((k) => String(k)),
      }
      if (bulkTrackingMode === 'enable') {
        if (bulkApplyBatch) {
          payload.batch_managed = true
          payload.default_batch_rule_id =
            bulkBatchRuleId === SYSTEM_DEFAULT_BATCH_SERIAL_RULE ? null : Number(bulkBatchRuleId)
        }
        if (bulkApplySerial) {
          payload.serial_managed = true
          payload.default_serial_rule_id =
            bulkSerialRuleId === SYSTEM_DEFAULT_BATCH_SERIAL_RULE ? null : Number(bulkSerialRuleId)
        }
      } else {
        if (bulkApplyBatch) payload.batch_managed = false
        if (bulkApplySerial) payload.serial_managed = false
      }

      const res = await materialApi.bulkUpdateTracking(payload)
      const notFound = res.not_found_uuids?.length ?? 0
      if (res.updated_count > 0) {
        messageApi.success(
          t('app.master-data.materials.batchTrackingSuccess', { count: res.updated_count })
        )
        if (notFound > 0) {
          messageApi.warning(
            t('app.master-data.materials.batchTrackingNotFound', { count: notFound })
          )
        }
      } else if (notFound > 0) {
        messageApi.error(t('app.master-data.materials.batchTrackingAllMissing'))
      } else {
        messageApi.warning(t('app.master-data.materials.batchTrackingNoop'))
      }
      setBatchSerialModalOpen(false)
      setSelectedRowKeys([])
      actionRef.current?.reload()
    } catch (e: any) {
      const detail = e?.response?.data?.detail
      const detailMsg =
        typeof detail === 'string' ? detail : detail?.message ?? (typeof detail === 'object' ? detail?.detail : undefined)
      messageApi.error(detailMsg || e?.message || t('common.updateFailed'))
      throw e
    } finally {
      setBatchSerialSubmitting(false)
    }
  }, [
    bulkApplyBatch,
    bulkApplySerial,
    bulkBatchRuleId,
    bulkSerialRuleId,
    bulkTrackingMode,
    selectedRowKeys,
    messageApi,
    t,
  ])

  const handleDeleteMaterial = useCallback(
    async (record: Material) => {
      try {
        await materialApi.delete(record.uuid)
        messageApi.success(t('common.deleteSuccess'))
        actionRef.current?.reload()
      } catch (error: any) {
        messageApi.error(error.message || t('common.deleteFailed'))
      }
    },
    [messageApi]
  )

  /**
   * 批量删除物料（Popconfirm 确认后执行；返回 Promise 时 Ant Design 会为「确定」显示 loading）
   */
  const executeBatchDelete = useCallback(async (keys?: React.Key[]) => {
    const targetKeys = keys ?? selectedRowKeys
    if (targetKeys.length === 0) {
      messageApi.warning(t('common.selectToDelete'))
      return
    }
    try {
      const uuids = targetKeys.map((k) => String(k))
      const res = await materialApi.batchDelete(uuids)
      const { deleted_count: deletedCount, failed_count: failCount, failed_items: failedItems } = res

      if (deletedCount > 0) {
        messageApi.success(t('common.batchDeleteSuccess', { count: deletedCount }))
      }
      if (failCount > 0) {
        const uniq = [...new Set((failedItems ?? []).map((f) => f.reason))]
        const hint = uniq.length <= 3 ? uniq.join('; ') : `${uniq.slice(0, 3).join('; ')}…`
        messageApi.error(
          t('common.batchDeletePartial', {
            count: failCount,
            errors: hint ? ': ' + hint : '',
          })
        )
      }

      setSelectedRowKeys([])
      actionRef.current?.reload()
    } catch (error: any) {
      messageApi.error(error.message || t('common.batchDeleteFailed'))
      throw error
    }
  }, [selectedRowKeys, messageApi, t])

  const handleOpenBatchMoveGroup = useCallback(() => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('common.selectAtLeastOne'))
      return
    }
    setBatchMoveGroupId(undefined)
    setBatchMoveGroupOpen(true)
  }, [selectedRowKeys, messageApi, t])

  const handleConfirmBatchMoveGroup = useCallback(async () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('common.selectAtLeastOne'))
      return
    }
    if (batchMoveGroupId == null) {
      messageApi.warning(t('app.master-data.materials.batchMoveGroupSelectRequired'))
      return
    }
    setBatchMoveGroupSubmitting(true)
    try {
      const uuids = selectedRowKeys.map((k) => String(k))
      const res = await materialApi.batchMoveGroup(uuids, batchMoveGroupId)
      if (res.updated_count > 0) {
        messageApi.success(t('app.master-data.materials.batchMoveGroupSuccess', { count: res.updated_count }))
      }
      const notFound = res.not_found_uuids?.length ?? 0
      if (notFound > 0) {
        messageApi.warning(t('app.master-data.materials.batchMoveGroupNotFound', { count: notFound }))
      }
      setBatchMoveGroupOpen(false)
      setSelectedRowKeys([])
      actionRef.current?.reload()
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.materials.batchMoveGroupFailed'))
    } finally {
      setBatchMoveGroupSubmitting(false)
    }
  }, [selectedRowKeys, batchMoveGroupId, messageApi, t])

  const handleOpenRewriteMainCodes = useCallback(() => {
    if (selectedRowKeys.length > 0) {
      setRewriteMainCodesScope('selected')
      setRewriteMainCodesOpen(true)
      return
    }
    if (selectedGroupIdRef.current != null && selectedGroupIdRef.current !== -1) {
      setRewriteMainCodesScope('group')
      setRewriteMainCodesOpen(true)
      return
    }
    messageApi.warning(t('app.master-data.materials.rewriteMainCodesSelectOrGroup'))
  }, [selectedRowKeys, messageApi, t])

  const handleConfirmRewriteMainCodes = useCallback(async () => {
    setRewriteMainCodesSubmitting(true)
    try {
      const payload =
        rewriteMainCodesScope === 'selected'
          ? { material_uuids: selectedRowKeys.map((k) => String(k)), reset_sequence: rewriteResetSequence }
          : { groupId: selectedGroupIdRef.current!, reset_sequence: rewriteResetSequence }
      const res = await materialApi.rewriteMainCodes(payload)
      if (res.updated_count > 0) {
        messageApi.success(
          t('app.master-data.materials.rewriteMainCodesSuccess', {
            families: res.updated_count,
            rows: res.updated_material_count,
          }),
        )
      }
      if (res.failed_count > 0) {
        messageApi.warning(
          t('app.master-data.materials.rewriteMainCodesPartialFail', { count: res.failed_count }),
        )
      }
      setRewriteMainCodesOpen(false)
      setRewriteResetSequence(false)
      setSelectedRowKeys([])
      actionRef.current?.reload()
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.materials.rewriteMainCodesFailed'))
    } finally {
      setRewriteMainCodesSubmitting(false)
    }
  }, [rewriteMainCodesScope, rewriteResetSequence, selectedRowKeys, messageApi, t])

  const handleMaterialImport = async (data: any[][]) => {
    if (!data || data.length < 2) {
      messageApi.warning(t('app.master-data.importEmpty'))
      return
    }
    const headers = (data[0] || []).map((h: any) => String(h || '').trim())
    const rows = data.slice(2).filter((row: any[]) => row?.some((c: any) => c != null && String(c).trim() !== ''))
    if (rows.length === 0) {
      messageApi.warning(t('app.master-data.importNoRows'))
      return
    }

    const col = (n: string) => headers.findIndex((h: string) => (h || '').replace(/\*+/, '').trim() === n || (h || '').trim() === n)
    const idx = {
      code: col('物料编号') >= 0 ? col('物料编号') : col('编号'),
      name: col('物料名称') >= 0 ? col('物料名称') : col('名称'),
      unit: col('基础单位') >= 0 ? col('基础单位') : col('单位'),
      spec: col('规格') >= 0 ? col('规格') : -1,
      type: col('物料类型') >= 0 ? col('物料类型') : -1,
      group: col('分组编号') >= 0 ? col('分组编号') : col('分组') >= 0 ? col('分组') : col(t('app.master-data.materials.materialGroup')) >= 0 ? col(t('app.master-data.materials.materialGroup')) : -1,
    }

    if (idx.name < 0 || idx.unit < 0) {
      messageApi.error(t('app.master-data.importMissingField', { field: '物料名称、基础单位', headers: headers.join(', ') }))
      return
    }

    const groups = await materialGroupApi.list({ limit: 1000 })
    const errors: Array<{ row: number; message: string }> = []
    const toImport: MaterialCreate[] = []

    rows.forEach((row: any[], i: number) => {
      const rowNum = i + 3
      const name = (row[idx.name] ?? '').toString().trim()
      const unit = (row[idx.unit] ?? '').toString().trim()
      if (!name) {
        errors.push({ row: rowNum, message: t('app.master-data.materials.nameRequired', { defaultValue: '物料名称不能为空' }) })
        return
      }
      if (!unit) {
        errors.push({ row: rowNum, message: '基础单位不能为空' })
        return
      }

      const code = idx.code >= 0 ? (row[idx.code] ?? '').toString().trim() : undefined
      const spec = idx.spec >= 0 ? (row[idx.spec] ?? '').toString().trim() : undefined
      const matType = idx.type >= 0 ? (row[idx.type] ?? '').toString().trim() : undefined
      const groupCode = idx.group >= 0 ? (row[idx.group] ?? '').toString().trim() : undefined
      let groupId: number | undefined
      if (groupCode) {
        const g = (Array.isArray(groups) ? groups : []).find((x: any) => (x.code || '').trim() === groupCode.trim())
        groupId = g?.id
      }

      toImport.push({
        mainCode: code || undefined,
        name,
        baseUnit: unit,
        specification: spec || undefined,
        sourceType: matType || undefined,
        groupId,
        isActive: true,
      })
    })

    if (errors.length > 0) {
      Modal.warning({
        title: t('app.master-data.dataValidationFailed'),
        width: 600,
        content: (
          <div>
            <p>{t('app.master-data.validationFailedIntro')}</p>
            <List size="small" dataSource={errors} renderItem={(e) => (
              <List.Item><Typography.Text type="danger">{t('app.master-data.rowError', { row: e.row, message: e.message })}</Typography.Text></List.Item>
            )} />
          </div>
        ),
      })
      return
    }

    if (toImport.length === 0) {
      messageApi.warning(t('app.master-data.importAllEmpty'))
      return
    }

    try {
      const result = await batchImport({
        items: toImport,
        importFn: async (item) => materialApi.create(item),
        title: t('app.master-data.materials.importTitle', { defaultValue: '正在导入物料' }),
        concurrency: 5,
      })
      if (result.failureCount > 0) {
        Modal.warning({
          title: t('app.master-data.importPartialResultTitle'),
          width: 600,
          content: (
            <div>
              <p><strong>{t('app.master-data.importPartialResultIntro', { success: result.successCount, failure: result.failureCount })}</strong></p>
              {result.errors.length > 0 && (
                <List size="small" dataSource={result.errors} renderItem={(e) => (
                  <List.Item><Typography.Text type="danger">{t('app.master-data.rowError', { row: e.row, message: e.error })}</Typography.Text></List.Item>
                )} />
              )}
            </div>
          ),
        })
      } else {
        messageApi.success(t('app.master-data.importSuccess', { count: result.successCount }))
      }
      if (result.successCount > 0) {
        actionRef.current?.reload()
        loadMaterialGroups()
      }
    } catch (error: any) {
      messageApi.error(error?.message || t('app.master-data.importFailed'))
    }
  }

  const handleMaterialExport = async (type: 'selected' | 'currentPage' | 'all', selectedRowKeys?: React.Key[], currentPageData?: Material[]) => {
    try {
      let toExport: Material[] = []
      if (type === 'all') {
        const res = await materialApi.list({ skip: 0, limit: 10000, groupId: selectedGroupId ?? undefined })
        toExport = res.items ?? []
      } else if (type === 'selected' && selectedRowKeys?.length && currentPageData) {
        toExport = currentPageData.filter((r) => selectedRowKeys.includes(r.uuid))
      } else if (type === 'currentPage' && currentPageData) {
        toExport = currentPageData
      } else {
        const res = await materialApi.list({ skip: 0, limit: 10000, groupId: selectedGroupId ?? undefined })
        toExport = res.items ?? []
      }
      if (toExport.length === 0) {
        messageApi.warning(t('app.master-data.noExportData'))
        return
      }
      const headers = [
        t('app.master-data.materials.materialCode'),
        t('app.master-data.materials.materialName'),
        t('app.master-data.materials.specification'),
        t('app.master-data.materials.baseUnit'),
        t('app.master-data.materials.sourceType'),
        t('app.master-data.warehouses.status'),
        t('common.createdAt'),
      ]
      const csvRows = [headers.join(',')]
      toExport.forEach((r) => {
        const code = (r as any).mainCode || (r as any).code || ''
        const name = r.name || ''
        const spec = (r as any).specification || ''
        const unit = (r as any).baseUnit || ''
        const matType = (r as any).sourceType ?? (r as any).source_type ?? ''
        const isActive = r?.isActive ?? (r as any)?.is_active
        const status = isActive ? t('common.enabled') : t('common.disabled')
        const createdAt = r.createdAt ? new Date(r.createdAt).toLocaleString() : (r as any).created_at ? new Date((r as any).created_at).toLocaleString() : ''
        csvRows.push(
          [code, name, spec, unit, matType, status, createdAt]
            .map((c) => {
              const s = String(c ?? '')
              return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
            })
            .join(',')
        )
      })
      const blob = new Blob(['\ufeff' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8' })
      downloadFile(blob, `materials_${new Date().toISOString().slice(0, 10)}.csv`)
      messageApi.success(t('common.exportSuccess', { count: toExport.length }))
    } catch (error: any) {
      messageApi.error(error?.message || t('common.exportFailed'))
    }
  }

  const maybeOpenFabricationWizard = async (saved: Material, formValues: Record<string, unknown>) => {
    if (!isFabricationFromValues(formValues) || !saved.id) return
    try {
      const needsSetup = await fabricationMaterialNeedsRawMaterialSetup(saved.id)
      if (needsSetup) {
        setFabricationWizardMaterial(toFabricationMaterialRef(saved))
        setFabricationWizardOpen(true)
      }
    } catch {
      // 检查失败时不阻断主流程
    }
  }

  const handleMaterialSubmit = async (values: any) => {
    try {
      setMaterialFormLoading(true)

      if (materialIsEdit && currentMaterial) {
        const result = await materialApi.update(currentMaterial.uuid, values as MaterialUpdate)
        const refreshed = await materialApi.get(currentMaterial.uuid)
        messageApi.success(t('common.updateSuccess'))
        
        setMaterialModalVisible(false)
        actionRef.current?.reload()
        await maybeOpenFabricationWizard(refreshed, values)
        return result
      } else {
        const result = await materialApi.create(values as MaterialCreate)
        messageApi.success(t('common.createSuccess'))
        
        setMaterialModalVisible(false)
        actionRef.current?.reload()
        await maybeOpenFabricationWizard(result, values)
        return result
      }
    } catch (error: any) {
      messageApi.error(error.message || (materialIsEdit ? t('common.updateFailed') : t('common.createFailed')))
      throw error
    } finally {
      setMaterialFormLoading(false)
    }
  }

  /**
   * 获取物料分组名称
   */
  const getMaterialGroupName = useCallback((groupId?: number): string => {
    if (!groupId) return '-'
    const group = materialGroups.find(g => g.id === groupId)
    return group ? formatMaterialGroupLabel(group) : `${t('app.master-data.materials.materialGroup')} ID: ${groupId}`
  }, [materialGroups, t])

  /** 详情抽屉「基本信息」字段顺序（uni-detail + detailDrawerDescriptionItems） */
  const materialDetailBasicColumns = useMemo<ProDescriptionsItemProps<Material>[]>(
    () => [
      {
        title: t('app.master-data.materials.materialCode'),
        dataIndex: 'mainCode',
        render: (_, record) => {
          const val =
            (record as any).mainCode ?? (record as any).main_code ?? (record as any).code ?? '-'
          if (val === '-') return '-'
          return (
            <Typography.Text copyable={{ text: String(val) }} style={{ marginRight: 0 }}>
              {val}
            </Typography.Text>
          )
        },
      },
      {
        title: t('app.master-data.materials.materialName'),
        dataIndex: 'name',
      },
      {
        title: t('app.master-data.materials.materialGroup'),
        dataIndex: 'groupId',
        render: (_, record) => getMaterialGroupName(record.groupId),
      },
      {
        title: t('app.master-data.materials.processRoute'),
        dataIndex: 'processRouteName',
        render: (_, record) =>
          (record as any).processRouteName ?? (record as any).process_route_name ?? '-',
      },
      {
        title: t('app.master-data.materials.specification'),
        dataIndex: 'specification',
      },
      {
        title: t('app.master-data.materials.baseUnit'),
        dataIndex: 'baseUnit',
      },
      {
        title: t('app.master-data.materials.brand'),
        dataIndex: 'brand',
      },
      {
        title: t('app.master-data.materials.model'),
        dataIndex: 'model',
      },
      {
        title: t('app.master-data.materials.texture'),
        dataIndex: 'texture',
      },
      {
        title: t('app.master-data.materials.batchManaged'),
        dataIndex: 'batchManaged',
        render: (_, record) => (
          <Tag color={record.batchManaged ? 'blue' : 'default'}>
            {record.batchManaged ? t('app.master-data.bom.yes') : t('app.master-data.bom.no')}
          </Tag>
        ),
      },
      {
        title: t('app.master-data.materials.variantManaged'),
        dataIndex: 'variantManaged',
        render: (_, record) => (
          <Tag color={record.variantManaged ? 'purple' : 'default'}>
            {record.variantManaged ? t('app.master-data.bom.yes') : t('app.master-data.bom.no')}
          </Tag>
        ),
      },
      {
        title: t('app.master-data.materials.description'),
        dataIndex: 'description',
      },
      {
        title: t('app.master-data.materials.enabledStatusLabel'),
        dataIndex: 'isActive',
        render: (_, record) => (
          <Tag color={record.isActive ? 'success' : 'default'}>
            {record.isActive ? t('app.master-data.materials.enabled') : t('app.master-data.materials.disabled')}
          </Tag>
        ),
      },
      {
        title: t('app.master-data.materials.createTime'),
        dataIndex: 'createdAt',
        valueType: 'dateTime',
      },
      {
        title: t('app.master-data.materials.updateTime'),
        dataIndex: 'updatedAt',
        valueType: 'dateTime',
      },
      ...generateCustomFieldColumns(),
    ],
    [t, getMaterialGroupName, generateCustomFieldColumns]
  )

  /**
   * 表格列定义
   */
  const columns = useMemo<ProColumns<Material>[]>(
    () => [
      {
        title: t('app.master-data.materials.materialCode'),
        dataIndex: ['mainCode', 'code'],
        width: 150,
        fixed: 'left',
        render: (_, record) => {
          const val = (record as any).mainCode || (record as any).code || '-'
          if (val === '-') return <Typography.Text>{val}</Typography.Text>
          return <Typography.Text copyable={{ text: String(val) }}>{val}</Typography.Text>
        },
      },
      {
        title: t('app.master-data.materials.materialName'),
        dataIndex: 'name',
        width: 200,
        sorter: true,
      },
      {
        title: t('app.master-data.materials.productImage'),
        dataIndex: 'images',
        width: 100,
        hideInSearch: true,
        render: (_, record) => {
          const images = (record as any).images || [];
          if (images.length > 0) {
            const firstImage = images[0];
            const fileUuid = firstImage.uid ?? firstImage.uuid ?? (typeof firstImage === 'string' ? firstImage : null);
            if (fileUuid) {
              return (
                <MaterialAttachmentThumb
                  fileUuid={fileUuid}
                  alt={firstImage.name || t('app.master-data.materials.image')}
                />
              );
            }
            if (firstImage.url) {
              return (
                <SecureImage
                  src={firstImage.url}
                  alt={firstImage.name || t('app.master-data.materials.image')}
                  width={40}
                  height={40}
                  preview={{ src: firstImage.url }}
                />
              );
            }
          }
          return '-';
        },
      },
      {
        title: t('app.master-data.materials.materialGroup'),
        dataIndex: 'groupId',
        width: 150,
        valueType: 'select',
        valueEnum: materialGroups.reduce(
          (acc, group) => {
            acc[group.id] = { text: group.name }
            return acc
          },
          {} as Record<number, { text: string }>
        ),
        render: (_, record) => getMaterialGroupName(record.groupId),
      },
      {
        title: t('app.master-data.materials.processRoute'),
        dataIndex: ['processRouteName', 'process_route_name'],
        width: 140,
        hideInSearch: true,
        render: (_, record) =>
          (record as any).processRouteName ?? (record as any).process_route_name ?? '-',
      },
      {
        title: t('app.master-data.materials.sourceType'),
        dataIndex: 'sourceType',
        width: 120,
        valueType: 'select',
        valueEnum: sourceTypeOptions.reduce(
          (acc, option) => {
            acc[option.value] = { text: option.label }
            return acc
          },
          {} as Record<string, { text: string }>
        ),
        fieldProps: {
          showSearch: true,
          allowClear: true,
        },
        render: (_, record) => {
          const st = (record as any).sourceType ?? (record as any).source_type
          const option = sourceTypeOptions.find(opt => opt.value === st)
          return option ? option.label : st || '-'
        },
      },
      {
        title: t('app.master-data.materials.specification'),
        dataIndex: 'specification',
        width: 150,
        ellipsis: true,
      },
      {
        title: t('app.master-data.materials.baseUnit'),
        dataIndex: 'baseUnit',
        width: 100,
        valueType: 'select',
        valueEnum: baseUnitOptions.reduce(
          (acc, option) => {
            acc[option.value] = { text: option.label }
            return acc
          },
          {} as Record<string, { text: string }>
        ),
        fieldProps: {
          loading: loadingBaseUnitOptions,
          showSearch: true,
          allowClear: true,
        },
        render: (_, record) => {
          const option = baseUnitOptions.find(opt => opt.value === record.baseUnit)
          return option ? option.label : record.baseUnit || '-'
        },
      },
      {
        title: t('app.master-data.materials.batchManaged'),
        dataIndex: 'batchManaged',
        width: 100,
        hideInSearch: true,
        render: (_, record) => (
          <Tag color={record.batchManaged ? 'blue' : 'default'}>
            {record.batchManaged ? t('app.master-data.bom.yes') : t('app.master-data.bom.no')}
          </Tag>
        ),
      },
      {
        title: t('app.master-data.materials.variantManaged'),
        dataIndex: 'variantManaged',
        width: 100,
        hideInSearch: true,
        render: (_, record) => (
          <Tag color={record.variantManaged ? 'purple' : 'default'}>
            {record.variantManaged ? t('app.master-data.bom.yes') : t('app.master-data.bom.no')}
          </Tag>
        ),
      },
      {
        title: t('app.master-data.materials.brand'),
        dataIndex: 'brand',
        width: 120,
      },
      {
        title: t('app.master-data.materials.model'),
        dataIndex: 'model',
        width: 120,
      },
      {
        title: t('app.master-data.materials.enabledStatus'),
        dataIndex: 'isActive',
        width: 100,
        valueType: 'select',
        valueEnum: {
          true: { text: t('app.master-data.materials.enabled'), status: 'Success' },
          false: { text: t('app.master-data.materials.disabled'), status: 'Default' },
        },
        render: (_, record) => (
          <Tag color={record.isActive ? 'success' : 'default'}>
            {record.isActive ? t('app.master-data.materials.enabled') : t('app.master-data.materials.disabled')}
          </Tag>
        ),
      },
      {
        title: t('app.master-data.materials.createTime'),
        dataIndex: 'createdAt',
        width: 180,
        valueType: 'dateTime',
        hideInSearch: true,
        sorter: true,
      },
      {
        title: t('app.master-data.materials.action'),
        valueType: 'option',
        width: 150,
        fixed: 'right',
        render: (_, record) => (
          <Space>
            <Button type="link" size="small" onClick={() => handleViewMaterial(record)}>
              {t('app.master-data.bom.detail')}
            </Button>
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEditMaterial(record)}
            >
              {t('app.master-data.bom.editTitle')}
            </Button>
            <Popconfirm
              title={t('app.master-data.materials.deleteMaterialConfirm')}
              description={t('app.master-data.materials.deleteMaterialDesc')}
              onConfirm={() => handleDeleteMaterial(record)}
            >
              <Button type="link" danger size="small" icon={<DeleteOutlined />}>
                {t('app.master-data.bom.delete')}
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [
      t,
      materialGroups,
      getMaterialGroupName,
      sourceTypeOptions,
      baseUnitOptions,
      loadingBaseUnitOptions,
      messageApi,
      token,
      handleViewMaterial,
      handleEditMaterial,
      handleDeleteMaterial,
      generateCustomFieldColumns,
    ]
  )

  return (
    <>
      <TwoColumnLayout
        leftPanel={{
          collapsed: leftPanelCollapsed,
          search: {
            placeholder: t('app.master-data.materials.searchGroup'),
            value: groupSearchValue,
            onChange: setGroupSearchValue,
            allowClear: true,
          },
          actions: [
            <div key="group-actions" style={{ display: 'flex', gap: 8 }}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                style={{ flex: 1 }}
                onClick={handleCreateGroup}
              >
                {t('app.master-data.materials.createGroup')}
              </Button>
              <Button
                icon={expandedKeys.length > 1 ? <CompressOutlined /> : <ExpandOutlined />}
                onClick={handleToggleExpand}
                title={expandedKeys.length > 1 ? t('app.master-data.materials.collapseAll') : t('app.master-data.materials.expandAll')}
              />
            </div>,
          ],
          tree: {
            className: 'material-group-tree',
            showLine: true,
            icon: renderMaterialGroupFolderIcon,
            treeData:
              filteredGroupTreeData.length > 0 || !groupSearchValue.trim()
                ? filteredGroupTreeData
                : groupTreeData,
            selectedKeys: selectedGroupKeys,
            expandedKeys: expandedKeys,
            onSelect: handleGroupSelect,
            onExpand: handleGroupExpand,
            showIcon: true,
            blockNode: true,
            loading: materialGroupsLoading,
            loadingTip: t('app.master-data.materials.loadingGroups'),
            titleRender: (node) => {
              const searchLabel = (node as DataNode & { searchLabel?: string }).searchLabel
              if (!searchLabel) return node.title
              return (
                <span className="material-group-tree-title-text">{searchLabel}</span>
              )
            },
            onRightClick: info => {
              const key = info.node.key as string
              if (key !== 'all' && key !== 'no-group') {
                const groupId = parseInt(key)
                const group = materialGroups.find(g => g.id === groupId)
                handleGroupContextMenu(info.event as any, group || null)
              }
            },
          },
          width: 320,
          minWidth: 200,
        }}
        rightPanel={{
          // header removed as per request to only show material list
          content: (
            <div
              style={{
                ['--uni-table-scroll-offset' as string]: `${LIST_PAGE_TABLE_SCROLL.BASE_OFFSET_PX + (2 * LIST_PAGE_TABLE_SCROLL.GAP_PX)}px`,
              }}
            >
              <UniTable<Material>
                columnPersistenceId="apps.master-data.pages.materials.management"
                tanstackQuery={{ queryKeyPrefix: ['apps.master-data.pages.materials.management', String(selectedGroupKeys[0] ?? 'all')] }}
                size="small"
                defaultPageSize={20}
                actionRef={actionRef}
                columns={columns}
                beforeSearchButtons={
                  <Tooltip title={leftPanelCollapsed ? t('app.master-data.materials.expandGroup') : t('app.master-data.materials.collapseGroup')}>
                    <Button
                      icon={leftPanelCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                      onClick={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
                      style={{ marginRight: 8 }}
                    />
                  </Tooltip>
                }
                headerActions={
                  <Space>
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateMaterial}>
                      {t('app.master-data.materials.createMaterial') + NEW_SHORTCUT_HINT}
                    </Button>
                    {trialRunMode && (
                    <Button
                      icon={<AppstoreOutlined />}
                      loading={standardPresetLoading}
                      onClick={handleOpenStandardPreset}
                    >
                      {t('app.master-data.materials.loadStandardPreset')}
                    </Button>
                    )}
                    {trialRunMode && (
                    <Button icon={<RedoOutlined />} onClick={handleOpenRewriteMainCodes}>
                      {t('app.master-data.materials.rewriteMainCodes')}
                    </Button>
                    )}
                    <UniBatchSplitToolbar
                      selectedRowKeys={selectedRowKeys}
                      onDelete={executeBatchDelete}
                      deleteButtonText={t('app.master-data.materials.batchDelete')}
                      confirmTitle={(count) =>
                        t('app.master-data.materials.batchDeleteConfirm', { count })
                      }
                      confirmDescription={t('app.master-data.materials.deleteMaterialDesc')}
                      menuItems={[
                        {
                          key: 'moveGroup',
                          label: t('app.master-data.materials.batchMoveGroup'),
                          icon: <SwapOutlined />,
                          onClick: () => handleOpenBatchMoveGroup(),
                        },
                        {
                          key: 'batchTracking',
                          label: t('app.master-data.materials.batchTrackingToolbar'),
                          icon: <TagsOutlined />,
                          onClick: () => handleOpenBatchSerialModal(),
                        },
                      ]}
                    />
                  </Space>
                }
                request={async (params, sort, _filter, searchFormValues) => {
                const apiParams: any = {
                  skip: ((params.current || 1) - 1) * (params.pageSize || 20),
                  limit: params.pageSize || 20,
                }

                // 物料分组筛选（如果搜索表单中有值，覆盖左侧树选择）
                if (
                  searchFormValues?.groupId !== undefined &&
                  searchFormValues.groupId !== null &&
                  searchFormValues.groupId !== ''
                ) {
                  apiParams.groupId = Number(searchFormValues.groupId)
                } else if (selectedGroupIdRef.current === -1) {
                  apiParams.noGroup = true
                } else if (selectedGroupIdRef.current !== null) {
                  // 如果没有搜索表单值，使用左侧树选择（使用 ref，避免 state 异步导致滞后一拍）
                  apiParams.groupId = selectedGroupIdRef.current
                }

                // 启用状态筛选
                if (
                  searchFormValues?.isActive !== undefined &&
                  searchFormValues.isActive !== '' &&
                  searchFormValues.isActive !== null
                ) {
                  apiParams.isActive = searchFormValues.isActive
                }

                // 搜索参数处理
                if (searchFormValues?.code && searchFormValues.code.trim()) {
                  apiParams.code = searchFormValues.code.trim()
                }

                if (searchFormValues?.name && searchFormValues.name.trim()) {
                  apiParams.name = searchFormValues.name.trim()
                }

                // 物料来源类型搜索
                if (
                  searchFormValues?.sourceType !== undefined &&
                  searchFormValues.sourceType !== null &&
                  searchFormValues.sourceType !== ''
                ) {
                  apiParams.sourceType = searchFormValues.sourceType
                }

                // 规格搜索
                if (searchFormValues?.specification && searchFormValues.specification.trim()) {
                  apiParams.specification = searchFormValues.specification.trim()
                }

                // 品牌搜索
                if (searchFormValues?.brand && searchFormValues.brand.trim()) {
                  apiParams.brand = searchFormValues.brand.trim()
                }

                // 型号搜索
                if (searchFormValues?.model && searchFormValues.model.trim()) {
                  apiParams.model = searchFormValues.model.trim()
                }

                // 基础单位搜索
                if (
                  searchFormValues?.baseUnit !== undefined &&
                  searchFormValues.baseUnit !== null &&
                  searchFormValues.baseUnit !== ''
                ) {
                  apiParams.baseUnit = searchFormValues.baseUnit
                }

                // 如果有关键词搜索，传递给后端
                if (searchFormValues?.keyword && searchFormValues.keyword.trim()) {
                  apiParams.keyword = searchFormValues.keyword.trim()
                }

                const { sortBy: rawSortField, sortOrder } = extractProTableSort(sort)
                const materialSortMap: Record<string, string> = {
                  createdAt: 'created_at',
                  name: 'name',
                  mainCode: 'main_code',
                }
                const sortKey = rawSortField ? materialSortMap[rawSortField] : undefined
                if (sortKey) {
                  apiParams.sortBy = sortKey
                  apiParams.sortOrder = sortOrder
                }

                try {
                  const { items, total } = await materialApi.list(apiParams)
                  const enriched = await enrichRecordsWithCustomFields(items || [])
                  return {
                    data: enriched,
                    success: true,
                    total: total,
                  }
                } catch (error: any) {
                  console.error(t('app.master-data.materials.getListFailed'), error)
                  messageApi.error(error?.message || t('app.master-data.materials.getListFailed'))
                  return {
                    data: [],
                    success: false,
                    total: 0,
                  }
                }
                }}
                rowKey="uuid"
                showAdvancedSearch={true}
                toolBarRender={() => []}
                rowSelection={{
                  selectedRowKeys,
                  onChange: setSelectedRowKeys,
                }}
                showImportButton={true}
                onImport={handleMaterialImport}
                importHeaders={[
                t('app.master-data.materials.materialCode'),
                `*${t('app.master-data.materials.materialName')}`,
                `*${t('app.master-data.materials.baseUnit')}`,
                t('app.master-data.materials.specification'),
                t('app.master-data.materials.sourceType'),
                t('app.master-data.materials.materialGroup'),
                ]}
                importExampleRow={['MAT-WX-E001', '无锡精工电控单元', '个', 'SK-WX-001', 'Buy', 'DEPT001']}
                importFieldMap={{
                [t('app.master-data.materials.materialCode')]: 'mainCode',
                [t('app.master-data.materials.materialName')]: 'name',
                [t('app.master-data.materials.baseUnit')]: 'baseUnit',
                [t('app.master-data.materials.specification')]: 'specification',
                [t('app.master-data.materials.sourceType')]: 'sourceType',
                [t('app.master-data.materials.materialGroup')]: 'groupCode',
                }}
                importFieldRules={{
                name: { required: true },
                baseUnit: { required: true },
                }}
                showExportButton={true}
                onExport={handleMaterialExport}
              />
            </div>
          ),
        }}
      />

      <Modal
        title={
          <Space>
            <RedoOutlined style={{ color: token.colorPrimary }} />
            <span>{t('app.master-data.materials.rewriteMainCodesTitle')}</span>
          </Space>
        }
        open={rewriteMainCodesOpen}
        onCancel={() => {
          if (!rewriteMainCodesSubmitting) {
            setRewriteMainCodesOpen(false)
            setRewriteResetSequence(false)
          }
        }}
        onOk={handleConfirmRewriteMainCodes}
        confirmLoading={rewriteMainCodesSubmitting}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        destroyOnHidden
        width={MODAL_CONFIG.SMALL_WIDTH}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Alert
            type="warning"
            showIcon
            message={
              rewriteMainCodesScope === 'selected'
                ? t('app.master-data.materials.rewriteMainCodesHintSelected', {
                    count: selectedRowKeys.length,
                  })
                : t('app.master-data.materials.rewriteMainCodesHintGroup')
            }
            description={t('app.master-data.materials.rewriteMainCodesDesc')}
          />
          <Checkbox
            checked={rewriteResetSequence}
            onChange={(e) => setRewriteResetSequence(e.target.checked)}
          >
            <Space direction="vertical" size={0}>
              <span>{t('app.master-data.materials.rewriteResetSequence')}</span>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {t('app.master-data.materials.rewriteResetSequenceDesc')}
              </Typography.Text>
            </Space>
          </Checkbox>
        </Space>
      </Modal>

      <Modal
        title={
          <Space>
            <SwapOutlined style={{ color: token.colorPrimary }} />
            <span>{t('app.master-data.materials.batchMoveGroupTitle')}</span>
          </Space>
        }
        open={batchMoveGroupOpen}
        onCancel={() => {
          if (!batchMoveGroupSubmitting) setBatchMoveGroupOpen(false)
        }}
        onOk={handleConfirmBatchMoveGroup}
        confirmLoading={batchMoveGroupSubmitting}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        destroyOnHidden
        width={MODAL_CONFIG.SMALL_WIDTH}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            message={t('app.master-data.materials.batchMoveGroupHint', {
              count: selectedRowKeys.length,
            })}
          />
          <div>
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
              {t('app.master-data.materials.batchMoveGroupSelect')}
            </Typography.Text>
            <TreeSelect
              showSearch
              allowClear
              treeLine
              treeDefaultExpandAll
              placeholder={t('app.master-data.materials.batchMoveGroupSelect')}
              style={{ width: '100%' }}
              value={batchMoveGroupId}
              onChange={(v) => setBatchMoveGroupId(v as number | undefined)}
              treeData={batchMoveGroupTreeData}
              loading={materialGroupsLoading}
              treeNodeFilterProp="title"
              popupMatchSelectWidth={false}
              styles={{ popup: { root: { maxHeight: 360, overflow: 'auto' } } }}
            />
          </div>
        </Space>
      </Modal>

      <Modal
        title={
          <Space>
            <TagsOutlined style={{ color: token.colorPrimary }} />
            <span>{t('app.master-data.materials.batchTrackingTitle')}</span>
          </Space>
        }
        open={batchSerialModalOpen}
        onCancel={() => {
          if (!batchSerialSubmitting) setBatchSerialModalOpen(false)
        }}
        onOk={handleConfirmBatchSerial}
        confirmLoading={batchSerialSubmitting}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        destroyOnHidden
        width={MODAL_CONFIG.LARGE_WIDTH}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            message={t('app.master-data.materials.batchTrackingAlertTitle', {
              count: selectedRowKeys.length,
            })}
            description={t('app.master-data.materials.batchTrackingHint')}
          />
          <div>
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
              {t('app.master-data.materials.batchTrackingMode')}
            </Typography.Text>
            <Segmented
              block
              size="large"
              value={bulkTrackingMode}
              onChange={(v) => setBulkTrackingMode(v as 'enable' | 'disable')}
              disabled={batchSerialSubmitting || bulkRuleOptionsLoading}
              options={[
                { label: t('app.master-data.materials.batchTrackingEnable'), value: 'enable' },
                { label: t('app.master-data.materials.batchTrackingDisable'), value: 'disable' },
              ]}
            />
          </div>
          <Divider style={{ margin: '8px 0' }} />
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Card
                size="small"
                variant="borderless"
                style={{
                  background: token.colorFillAlter,
                  border: `1px solid ${token.colorBorderSecondary}`,
                }}
                title={
                  <Space>
                    <BarcodeOutlined style={{ color: token.colorPrimary }} />
                    <span>{t('app.master-data.materials.batchTrackingCardBatch')}</span>
                  </Space>
                }
                extra={
                  <Checkbox
                    checked={bulkApplyBatch}
                    onChange={(e) => setBulkApplyBatch(e.target.checked)}
                    disabled={batchSerialSubmitting}
                  >
                    {t('app.master-data.materials.batchTrackingIncludeDimension')}
                  </Checkbox>
                }
              >
                {bulkTrackingMode === 'disable' && bulkApplyBatch && (
                  <Typography.Paragraph type="secondary" style={{ marginBottom: 12, marginTop: 0 }}>
                    {t('app.master-data.materials.batchTrackingDisableBatchHint')}
                  </Typography.Paragraph>
                )}
                {bulkTrackingMode === 'enable' && bulkApplyBatch && (
                  <>
                    <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 6 }}>
                      {t('app.master-data.materials.batchTrackingDefaultBatchRule')}
                    </Typography.Text>
                    <Select
                      style={{ width: '100%' }}
                      loading={bulkRuleOptionsLoading}
                      disabled={batchSerialSubmitting}
                      value={bulkBatchRuleId}
                      onChange={(v) => setBulkBatchRuleId(v)}
                      options={[
                        {
                          label: t('app.master-data.materialForm.systemDefaultRule'),
                          value: SYSTEM_DEFAULT_BATCH_SERIAL_RULE,
                        },
                        ...batchRulesForBulk.map((r) => ({
                          label: `${r.code} ${r.name}`.trim(),
                          value: r.id,
                        })),
                      ]}
                      showSearch
                      optionFilterProp="label"
                    />
                  </>
                )}
                {bulkApplyBatch && bulkTrackingMode === 'enable' && !bulkRuleOptionsLoading && batchRulesForBulk.length === 0 && (
                  <Typography.Text type="warning" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
                    {t('app.master-data.materials.batchTrackingNoCustomRulesBatch')}
                  </Typography.Text>
                )}
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card
                size="small"
                variant="borderless"
                style={{
                  background: token.colorFillAlter,
                  border: `1px solid ${token.colorBorderSecondary}`,
                }}
                title={
                  <Space>
                    <NumberOutlined style={{ color: token.colorPrimary }} />
                    <span>{t('app.master-data.materials.batchTrackingCardSerial')}</span>
                  </Space>
                }
                extra={
                  <Checkbox
                    checked={bulkApplySerial}
                    onChange={(e) => setBulkApplySerial(e.target.checked)}
                    disabled={batchSerialSubmitting}
                  >
                    {t('app.master-data.materials.batchTrackingIncludeDimension')}
                  </Checkbox>
                }
              >
                {bulkTrackingMode === 'disable' && bulkApplySerial && (
                  <Typography.Paragraph type="secondary" style={{ marginBottom: 12, marginTop: 0 }}>
                    {t('app.master-data.materials.batchTrackingDisableSerialHint')}
                  </Typography.Paragraph>
                )}
                {bulkTrackingMode === 'enable' && bulkApplySerial && (
                  <>
                    <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 6 }}>
                      {t('app.master-data.materials.batchTrackingDefaultSerialRule')}
                    </Typography.Text>
                    <Select
                      style={{ width: '100%' }}
                      loading={bulkRuleOptionsLoading}
                      disabled={batchSerialSubmitting}
                      value={bulkSerialRuleId}
                      onChange={(v) => setBulkSerialRuleId(v)}
                      options={[
                        {
                          label: t('app.master-data.materialForm.systemDefaultRule'),
                          value: SYSTEM_DEFAULT_BATCH_SERIAL_RULE,
                        },
                        ...serialRulesForBulk.map((r) => ({
                          label: `${r.code} ${r.name}`.trim(),
                          value: r.id,
                        })),
                      ]}
                      showSearch
                      optionFilterProp="label"
                    />
                  </>
                )}
                {bulkApplySerial && bulkTrackingMode === 'enable' && !bulkRuleOptionsLoading && serialRulesForBulk.length === 0 && (
                  <Typography.Text type="warning" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
                    {t('app.master-data.materials.batchTrackingNoCustomRulesSerial')}
                  </Typography.Text>
                )}
              </Card>
            </Col>
          </Row>
        </Space>
      </Modal>

      <Modal
        title={t('app.master-data.materials.standardPresetModalTitle')}
        open={standardPresetOpen}
        onCancel={() => !standardPresetSubmitting && setStandardPresetOpen(false)}
        width={960}
        destroyOnHidden
        footer={[
          <Button key="cancel" disabled={standardPresetSubmitting} onClick={() => setStandardPresetOpen(false)}>
            {t('common.cancel')}
          </Button>,
          <Button
            key="ok"
            type="primary"
            loading={standardPresetSubmitting}
            disabled={
              standardPresetSelectedKeys.length === 0 ||
              (standardPresetGroupMode === 'single' && !standardPresetGroupUuid)
            }
            onClick={async () => {
              try {
                setStandardPresetSubmitting(true)
                const res = await materialApi.loadStandardPartsPreset({
                  presetKeys: standardPresetSelectedKeys,
                  codeMode: standardPresetCodeMode,
                  groupMode: standardPresetGroupMode,
                  ...(standardPresetGroupMode === 'single'
                    ? { materialGroupUuid: standardPresetGroupUuid }
                    : standardPresetParentGroupUuid
                      ? { parentMaterialGroupUuid: standardPresetParentGroupUuid }
                      : {}),
                })
                messageApi.success(res.message)
                setStandardPresetOpen(false)
                actionRef.current?.reload()
              } catch (e: any) {
                messageApi.error(e?.message || t('common.operationFailed'))
              } finally {
                setStandardPresetSubmitting(false)
              }
            }}
          >
            {t('common.confirm')}
          </Button>,
        ]}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 12 }}>
              {t('app.master-data.materials.standardPresetSectionImportSettings')}
            </Typography.Title>
            <Card
              size="small"
              bordered={false}
              style={{ background: token.colorFillAlter }}
              styles={{ body: { padding: '12px 16px' } }}
            >
              <Space direction="vertical" size={10} style={{ width: '100%' }}>
                <div>
                  <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                    {t('app.master-data.materials.standardPresetMaterialAssignLabel')}
                  </Typography.Text>
                  <Row gutter={[12, 12]} align="middle" wrap>
                    <Col flex="none">
                      <Segmented<'single' | 'preset_by_category'>
                        size="middle"
                        value={standardPresetGroupMode}
                        onChange={(v) => {
                          setStandardPresetGroupMode(v)
                          if (v === 'single') {
                            if (selectedGroupId != null) {
                              const g = materialGroups.find((x) => x.id === selectedGroupId)
                              setStandardPresetGroupUuid(g?.uuid ?? '')
                            } else {
                              setStandardPresetGroupUuid('')
                            }
                          }
                          if (v === 'preset_by_category') {
                            setStandardPresetParentGroupUuid('')
                          }
                        }}
                        options={[
                          { label: t('app.master-data.materials.standardPresetGroupModeSingle'), value: 'single' },
                          {
                            label: t('app.master-data.materials.standardPresetGroupModePresetCategories'),
                            value: 'preset_by_category',
                          },
                        ]}
                      />
                    </Col>
                    <Col xs={24} sm={24} md={14} lg={15} flex="1 1 220px">
                      {standardPresetGroupMode === 'single' ? (
                        <Select
                          style={{ width: '100%' }}
                          placeholder={t('app.master-data.materials.standardPresetTargetGroupPlaceholder')}
                          value={standardPresetGroupUuid || undefined}
                          onChange={(v) => setStandardPresetGroupUuid(v)}
                          options={materialGroups.map((g) => ({
                            value: g.uuid,
                            label: formatMaterialGroupLabel(g),
                          }))}
                          showSearch
                          optionFilterProp="label"
                          loading={materialGroupsLoading}
                        />
                      ) : (
                        <Select
                          style={{ width: '100%' }}
                          allowClear
                          placeholder={t('app.master-data.materials.standardPresetParentGroupPlaceholder')}
                          value={standardPresetParentGroupUuid || undefined}
                          onChange={(v) => setStandardPresetParentGroupUuid((v ?? '') as string)}
                          options={materialGroups.map((g) => ({
                            value: g.uuid,
                            label: formatMaterialGroupLabel(g),
                          }))}
                          showSearch
                          optionFilterProp="label"
                          loading={materialGroupsLoading}
                        />
                      )}
                    </Col>
                  </Row>
                </div>

                <div>
                  <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                    {t('app.master-data.materials.standardPresetCodeMode')}
                  </Typography.Text>
                  <Segmented<'auto' | 'gb'>
                    size="middle"
                    value={standardPresetCodeMode}
                    onChange={(v) => setStandardPresetCodeMode(v)}
                    options={[
                      { label: t('app.master-data.materials.standardPresetCodeAuto'), value: 'auto' },
                      { label: t('app.master-data.materials.standardPresetCodeGb'), value: 'gb' },
                    ]}
                  />
                </div>
              </Space>
            </Card>
          </div>

          <div>
            <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 12 }}>
              {t('app.master-data.materials.standardPresetSectionPickItems')}
            </Typography.Title>
            <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
              <Col xs={24} sm={8}>
                <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 6 }}>
                  {t('app.master-data.materials.standardPresetIndustryFilter')}
                </Typography.Text>
                <Select
                  style={{ width: '100%' }}
                  allowClear
                  placeholder={t('app.master-data.materials.standardPresetIndustryAll')}
                  value={standardPresetIndustryId || undefined}
                  options={standardPresetIndustryOptions}
                  onChange={(v) => {
                    const nextIndustry = (v ?? '') as string
                    setStandardPresetIndustryId(nextIndustry)
                    setStandardPresetCategoryId('')
                    setStandardPresetPrimaryId('')
                    const rows = nextIndustry
                      ? standardPresetFlatRows.filter((r) => r.industryId === nextIndustry)
                      : standardPresetFlatRows
                    setStandardPresetSelectedKeys(rows.map((r) => r.presetKey))
                  }}
                  optionFilterProp="label"
                  showSearch
                />
              </Col>
              <Col xs={24} sm={8}>
                <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 6 }}>
                  {t('app.master-data.materials.standardPresetPrimaryFilter')}
                </Typography.Text>
                <Select
                  style={{ width: '100%' }}
                  allowClear
                  placeholder={t('app.master-data.materials.standardPresetPrimaryAll')}
                  value={standardPresetPrimaryId || undefined}
                  options={standardPresetPrimaryOptions}
                  onChange={(v) => {
                    const nextPrimary = (v ?? '') as string
                    setStandardPresetPrimaryId(nextPrimary)
                    setStandardPresetCategoryId('')
                    const rows = standardPresetFlatRows.filter((r) => {
                      if (standardPresetIndustryId && r.industryId !== standardPresetIndustryId) return false
                      if (nextPrimary) return r.primaryCategory === nextPrimary
                      return true
                    })
                    setStandardPresetSelectedKeys(rows.map((r) => r.presetKey))
                  }}
                  optionFilterProp="label"
                  showSearch
                />
              </Col>
              <Col xs={24} sm={8}>
                <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 6 }}>
                  {t('app.master-data.materials.standardPresetSecondaryFilter')}
                </Typography.Text>
                <Select
                  style={{ width: '100%' }}
                  allowClear
                  placeholder={t('app.master-data.materials.standardPresetSecondaryAll')}
                  value={standardPresetCategoryId || undefined}
                  options={standardPresetSecondaryOptions}
                  onChange={(v) => {
                    const nextId = (v ?? '') as string
                    setStandardPresetCategoryId(nextId)
                    let rows = standardPresetFlatRows.filter((r) =>
                      standardPresetIndustryId ? r.industryId === standardPresetIndustryId : true
                    )
                    if (nextId) rows = rows.filter((r) => r.categoryId === nextId)
                    else if (standardPresetPrimaryId) rows = rows.filter((r) => r.primaryCategory === standardPresetPrimaryId)
                    setStandardPresetSelectedKeys(rows.map((r) => r.presetKey))
                  }}
                  optionFilterProp="label"
                  showSearch
                />
              </Col>
            </Row>
          </div>
          <Table<StandardPartFlatRow>
            size="small"
            rowKey="presetKey"
            dataSource={standardPresetFilteredRows}
            pagination={false}
            scroll={{ y: 360 }}
            rowSelection={{
              selectedRowKeys: standardPresetSelectedKeys,
              onChange: (keys) => setStandardPresetSelectedKeys(keys as string[]),
            }}
            columns={[
              {
                title: t('app.master-data.materials.standardPresetColCategory'),
                key: 'presetType',
                width: 168,
                ellipsis: true,
                render: (_, r) => {
                  const pLabel = t(`app.master-data.materials.standardPresetPrimary.${r.primaryCategory}`, {
                    defaultValue: r.primaryCategory,
                  })
                  return `${r.industryName} / ${pLabel} / ${r.categoryName}`
                },
              },
              { title: t('app.master-data.materials.materialName'), dataIndex: 'name', width: 140, ellipsis: true },
              {
                title: t('app.master-data.materials.specification'),
                dataIndex: 'specification',
                width: 100,
                ellipsis: true,
              },
              {
                title: t('app.master-data.materials.standardPresetColGbStandard'),
                dataIndex: 'gbStandard',
                width: 100,
                ellipsis: true,
              },
              {
                title: t('app.master-data.materials.standardPresetColGbCode'),
                dataIndex: 'gbCode',
                width: 160,
                ellipsis: true,
              },
              { title: t('app.master-data.materials.baseUnit'), dataIndex: 'baseUnit', width: 72 },
            ]}
          />
        </Space>
      </Modal>

      {/* 分组创建/编辑 Modal - 使用 FormModalTemplate 与其它单列 modal 行为一致 */}
      <FormModalTemplate
        title={
          groupIsEdit
            ? t('app.master-data.materials.editGroup')
            : groupParentIdPreset != null
              ? t('app.master-data.materials.createSubGroup')
              : t('app.master-data.materials.createGroup')
        }
        open={groupModalVisible}
        onClose={handleCloseGroupModal}
        onFinish={handleGroupSubmit}
        isEdit={groupIsEdit}
        loading={groupFormLoading}
        formRef={groupFormRef as React.RefObject<ProFormInstance>}
        width={MODAL_CONFIG.SMALL_WIDTH}
        initialValues={
          groupIsEdit && currentGroup
            ? {
                code: currentGroup.code,
                alias: currentGroup.alias,
                name: currentGroup.name,
                parentId: currentGroup.parentId,
                description: currentGroup.description,
                isActive: currentGroup.isActive,
              }
            : {
                isActive: true,
                ...(groupParentIdPreset != null ? { parentId: groupParentIdPreset } : {}),
              }
        }
      >
        <SafeProFormSelect
          name="parentId"
          label={t('app.master-data.materials.parentGroup')}
          placeholder={t('app.master-data.materials.parentGroupPlaceholder')}
          options={materialGroups
            .filter(g => !groupIsEdit || g.id !== currentGroup?.id) // 编辑时排除自己
            .map(g => ({
              label: formatMaterialGroupLabel(g),
              value: g.id,
            }))}
          fieldProps={{
            loading: materialGroupsLoading,
            showSearch: true,
            allowClear: true,
            filterOption: (input: string, option: any) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase()),
          }}
        />
        <ProFormText
          name="code"
          label={t('app.master-data.materials.groupCode')}
          placeholder={t('app.master-data.materials.groupCodePlaceholder')}
          extra={t('app.master-data.materials.groupCodeExtra')}
          rules={[
            { required: true, message: t('app.master-data.materials.groupCodeRequired') },
            { max: 50, message: t('app.master-data.materials.groupCodeMax') },
          ]}
          fieldProps={{
            style: { textTransform: 'uppercase' },
          }}
        />
        <ProFormText
          name="name"
          label={t('app.master-data.materials.groupName')}
          placeholder={t('app.master-data.materials.groupNamePlaceholder')}
          rules={[
            { required: true, message: t('app.master-data.materials.groupNameRequired') },
            { max: 200, message: t('app.master-data.materials.groupNameMax') },
          ]}
        />
        <ProFormText
          name="alias"
          label={t('app.master-data.materials.groupAlias')}
          placeholder={t('app.master-data.materials.groupAliasPlaceholder')}
          rules={[
            { max: 100, message: t('app.master-data.materials.groupAliasMax') },
          ]}
        />
        <ProFormTextArea
          name="description"
          label={t('app.master-data.materials.description')}
          placeholder={t('app.master-data.materials.descriptionPlaceholder')}
          rows={3}
          fieldProps={{
            maxLength: 500,
          }}
        />
        <ProFormSwitch
          name="isActive"
          label={t('app.master-data.materials.enabledStatusLabel')}
          checkedChildren={t('app.master-data.materials.checkedChildren')}
          unCheckedChildren={t('app.master-data.materials.unCheckedChildren')}
        />
      </FormModalTemplate>

      {/* 物料创建/编辑 Modal - 使用新的多标签页表单组件 */}
      <MaterialForm
        key={materialRestoreInitialValues ? 'restore' : (materialIsEdit ? `edit-${currentMaterial?.id}` : 'create')}
        open={materialModalVisible}
        onClose={() => {
          setMaterialModalVisible(false)
          setMaterialRestoreInitialValues(null)
        }}
        onFinish={handleMaterialSubmit}
        isEdit={materialIsEdit}
        material={currentMaterial || undefined}
        materialGroups={materialGroups}
        loading={materialFormLoading}
        suspendedModalReturnPath="/apps/master-data/materials"
        initialValues={
          materialRestoreInitialValues
            ? materialRestoreInitialValues
            : materialIsEdit && currentMaterial
            ? {
                // 兼容后端 snake_case：编辑时 API 返回 main_code 等，表单需要 mainCode
                mainCode: currentMaterial.mainCode ?? (currentMaterial as any).main_code,
                name: currentMaterial.name,
                groupId: currentMaterial.groupId ?? (currentMaterial as any).group_id,
                sourceType:
                  (currentMaterial as any).sourceType ??
                  (currentMaterial as any).source_type ??
                  undefined,
                specification: currentMaterial.specification,
                baseUnit: currentMaterial.baseUnit ?? (currentMaterial as any).base_unit,
                batchManaged:
                  currentMaterial.batchManaged ?? (currentMaterial as any).batch_managed,
                defaultBatchRuleId:
                  (currentMaterial as any).defaultBatchRuleId ?? (currentMaterial as any).default_batch_rule_id,
                serialManaged:
                  (currentMaterial as any).serialManaged ?? (currentMaterial as any).serial_managed ?? false,
                defaultSerialRuleId:
                  (currentMaterial as any).defaultSerialRuleId ?? (currentMaterial as any).default_serial_rule_id,
                variantManaged:
                  currentMaterial.variantManaged ?? (currentMaterial as any).variant_managed,
                variantAttributes:
                  currentMaterial.variantAttributes ?? (currentMaterial as any).variant_attributes,
                description: currentMaterial.description,
                brand: currentMaterial.brand,
                model: currentMaterial.model,
                texture: currentMaterial.texture ?? (currentMaterial as any).texture,
                isActive: currentMaterial.isActive ?? (currentMaterial as any).is_active,
                inspectionMode:
                  (currentMaterial as any).inspectionMode ??
                  (currentMaterial as any).inspection_mode ??
                  'none',
                defaultInspectionPlanId:
                  (currentMaterial as any).defaultInspectionPlanId ??
                  (currentMaterial as any).default_inspection_plan_id ??
                  undefined,
                overReportMode:
                  (currentMaterial as any).overReportMode ??
                  (currentMaterial as any).over_report_mode ??
                  'none',
                overReportValue:
                  Number(
                    (currentMaterial as any).overReportValue ??
                      (currentMaterial as any).over_report_value ??
                      0
                  ) || 0,
              }
            : {
                groupId: selectedGroupId || undefined,
                isActive: true,
                batchManaged: false,
                serialManaged: false,
                variantManaged: false,
                sourceType: undefined,
                baseUnit: 'PC', // 默认值：件
                inspectionMode: 'none',
                overReportMode: 'none',
                overReportValue: 0,
              }
        }
      />

      <UniDetail
        title={t('app.master-data.materials.materialDetail')}
        open={materialDrawerVisible}
        onClose={() => {
          setMaterialDrawerVisible(false)
          setCurrentMaterial(null)
        }}
        loading={materialDetailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        styles={{ body: { position: 'relative' } }}
        basic={
          currentMaterial ? (
            <div style={{ position: 'relative', paddingRight: 168 }}>
              <Descriptions
                column={1}
                items={detailDrawerDescriptionItems(materialDetailBasicColumns as any, currentMaterial)}
              />
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  width: 152,
                  padding: 12,
                  background: '#fff',
                  borderRadius: token.borderRadiusLG,
                  border: '1px solid rgba(0, 0, 0, 0.06)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 10,
                }}
              >
                <QRCodeGenerator
                  qrcodeType="MAT"
                  data={{
                    material_uuid: currentMaterial.uuid,
                    material_code: currentMaterial.mainCode || currentMaterial.code || '',
                    material_name: currentMaterial.name,
                  }}
                  autoGenerate={true}
                  showCardTitle={false}
                  size={6}
                  noCard={true}
                />
              </div>
              
              <CustomFieldsDetailSection
                customFields={customFields}
                customFieldValues={customFieldValues}
              />
            </div>
          ) : null
        }
      />

      {/* 分组右键菜单 */}
      {contextMenuVisible && (
        <div
          ref={contextMenuRef}
          style={{
            position: 'fixed',
            left: contextMenuPosition.x,
            top: contextMenuPosition.y,
            zIndex: 1000,
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: token.borderRadiusLG,
            boxShadow: token.boxShadowSecondary,
            overflow: 'hidden',
          }}
          onClick={() => setContextMenuVisible(false)}
        >
          <Menu
            onClick={({ key }) => {
              switch (key) {
                case 'edit':
                  if (contextMenuGroup) {
                    handleEditGroup(contextMenuGroup)
                  }
                  break
                case 'delete':
                  if (contextMenuGroup) {
                    handleDeleteGroup(contextMenuGroup)
                  }
                  break
                case 'create':
                  handleCreateGroup()
                  break
                case 'createSub':
                  if (contextMenuGroup) {
                    handleCreateSubGroup(contextMenuGroup)
                  }
                  break
              }
              setContextMenuVisible(false)
            }}
          >
            {contextMenuGroup && (
              <Menu.Item key="createSub" icon={<PlusOutlined />}>
                {t('app.master-data.materials.createSubGroup')}
              </Menu.Item>
            )}
            <Menu.Item key="create" icon={<PlusOutlined />}>
              {t('app.master-data.materials.createGroup')}
            </Menu.Item>
            {contextMenuGroup && (
              <>
                <Menu.Item key="edit" icon={<EditOutlined />}>
                  {t('app.master-data.materials.editGroup')}
                </Menu.Item>
                <Menu.Item key="delete" icon={<DeleteOutlined />} danger>
                  {t('app.master-data.materials.deleteGroup')}
                </Menu.Item>
              </>
            )}
          </Menu>
        </div>
      )}

      <FabricationRawMaterialWizard
        open={fabricationWizardOpen}
        onClose={() => {
          setFabricationWizardOpen(false)
          setFabricationWizardMaterial(null)
        }}
        fabricationMaterial={fabricationWizardMaterial}
        onSuccess={() => {
          actionRef.current?.reload()
        }}
      />

    </>
  )
}

export default MaterialsManagementPage
