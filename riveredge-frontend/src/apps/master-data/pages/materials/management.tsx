/**
 * 物料管理合并页面
 *
 * 左侧物料分组树，右侧物料管理列表
 * 参考文件管理页面的左右两栏布局
 */

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams, useLocation } from 'react-router-dom'
import {
  App,
  Button,
  Space,
  Modal,
  Drawer,
  Popconfirm,
  Tag,
  theme,
  Menu,
  List,
  Typography,
  Checkbox,
  Select,
  Alert,
  Segmented,
  Card,
  Row,
  Col,
  Divider,
  Tooltip,
} from 'antd'
import {
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  FolderOutlined,
  QrcodeOutlined,
  ExpandOutlined,
  CompressOutlined,
  TagsOutlined,
  BarcodeOutlined,
  NumberOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons'
import {
  ActionType,
  ProColumns,
  ProFormText,
  ProFormTextArea,
  ProFormSwitch,
  ProFormInstance,
  ProDescriptions,
} from '@ant-design/pro-components'
import type { DataNode, TreeProps } from 'antd/es/tree'

// 导入现有组件
import SafeProFormSelect from '../../../../components/safe-pro-form-select'
import { UniTable } from '../../../../components/uni-table'
import { TwoColumnLayout, FormModalTemplate } from '../../../../components/layout-templates'
import { MODAL_CONFIG } from '../../../../components/layout-templates/constants'
import { MaterialForm } from '../../components/MaterialForm'
import { QRCodeGenerator } from '../../../../components/qrcode'
import { qrcodeApi } from '../../../../services/qrcode'

// 导入服务和类型
import { materialApi, materialGroupApi } from '../../services/material'
import type {
  Material,
  MaterialCreate,
  MaterialUpdate,
  MaterialGroup,
  MaterialGroupCreate,
  MaterialGroupUpdate,
  MaterialBulkTrackingPayload,
} from '../../types/material'
import { batchRuleApi, serialRuleApi } from '../../services/batchSerialRules'
import { getDataDictionaryByCode, getDictionaryItemList } from '../../../../services/dataDictionary'
import { SecureImage } from '../../../../components/secure-image'
import { batchImport } from '../../../../utils/batchOperations'
import { downloadFile } from '../../../../utils'
import { useNewShortcut } from '../../../../hooks/useNewShortcut'
import { NEW_SHORTCUT_HINT } from '../../../../utils/globalNewShortcut'
import { getSuspendedModal, clearSuspendedModal } from '../../utils/suspendedModal'

/** 与 MaterialForm 一致：表示使用系统默认批号/序列号规则 */
const SYSTEM_DEFAULT_BATCH_SERIAL_RULE = '__SYSTEM_DEFAULT__'

/**
 * 物料管理合并页面组件
 */
const MaterialsManagementPage: React.FC = () => {
  const { t } = useTranslation()
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
  const [groupFormLoading, setGroupFormLoading] = useState(false)

  const [materialModalVisible, setMaterialModalVisible] = useState(false)
  const [materialRestoreInitialValues, setMaterialRestoreInitialValues] = useState<Record<string, any> | null>(null)
  const [materialIsEdit, setMaterialIsEdit] = useState(false)
  const [materialFormLoading, setMaterialFormLoading] = useState(false)
  const [materialDrawerVisible, setMaterialDrawerVisible] = useState(false)
  const [currentMaterial, setCurrentMaterial] = useState<Material | null>(null)
  const [materialDetailLoading, setMaterialDetailLoading] = useState(false)

  // 数据状态
  const [materialGroups, setMaterialGroups] = useState<MaterialGroup[]>([])
  const [materialGroupsLoading, setMaterialGroupsLoading] = useState(false)
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false)
  const selectedGroupIdRef = useRef<number | null>(null)

  // 右键菜单状态
  const [contextMenuVisible, setContextMenuVisible] = useState(false)
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 })
  const [contextMenuGroup, setContextMenuGroup] = useState<MaterialGroup | null>(null)

  const [baseUnitOptions, setBaseUnitOptions] = useState<Array<{ label: string; value: string }>>(
    []
  )
  const [loadingBaseUnitOptions, setLoadingBaseUnitOptions] = useState(false)

  const emitAgentDebugLog = useCallback(
    (runId: string, hypothesisId: string, location: string, message: string, data: Record<string, any>) => {
      // #region agent log
      window.fetch('http://127.0.0.1:7242/ingest/b117966e-dad0-4d01-bd6a-e3ba9296abb4', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '8e3a76' },
        body: JSON.stringify({
          sessionId: '8e3a76',
          runId,
          hypothesisId,
          location,
          message,
          data,
          timestamp: Date.now(),
        }),
      }).catch(() => {})
      // #endregion
    },
    []
  )

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
        const matches =
          node.key !== 'all' && node.title?.toString().toLowerCase().includes(keywordLower)

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
      try {
        setMaterialDetailLoading(true)
        // 获取物料详情
        const detail = await materialApi.get(record.uuid)
        setCurrentMaterial(detail)
        setMaterialDrawerVisible(true)
      } catch (error: any) {
        messageApi.error(error.message || t('app.master-data.materials.getDetailFailed'))
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
    const convertNode = (node: any): DataNode => {
      return {
        title: `${node.code} - ${node.name}`,
        key: node.id.toString(),
        icon: <FolderOutlined />,
        isLeaf: !node.children || node.children.length === 0,
        children: node.children ? node.children.map(convertNode) : undefined,
      }
    }

    return [
      {
        title: t('app.master-data.materials.allMaterials'),
        key: 'all',
        icon: <FolderOutlined />,
        isLeaf: false,
        children: treeResponse.map(convertNode),
      },
    ]
  }, [t])

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
    setGroupIsEdit(false)
    setCurrentGroup(null)
    setGroupModalVisible(true)
  }, [])

  const handleEditGroup = useCallback((group: MaterialGroup) => {
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

      setGroupModalVisible(false)
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
      } else {
        const groupId = parseInt(key)
        selectedGroupIdRef.current = groupId
        setSelectedGroupId(groupId)
      }

      // 刷新物料列表
      actionRef.current?.reload()
    }
  }

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

  /**
   * 处理批量生成二维码
   */
  const handleBatchGenerateQRCode = useCallback(async () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('app.master-data.materials.selectForQRCode'))
      return
    }

    try {
      // 通过API获取选中的物料数据
      const materials = await Promise.all(
        selectedRowKeys.map(async key => {
          try {
            return await materialApi.get(key as string)
          } catch (error) {
            console.error(`Failed to get material: ${key}`, error)
            return null
          }
        })
      )

      const validMaterials = materials.filter(m => m !== null) as Material[]

      if (validMaterials.length === 0) {
        messageApi.error(t('app.master-data.materials.getSelectedFailed'))
        return
      }

      // 生成二维码
      const qrcodePromises = validMaterials.map(material =>
        qrcodeApi.generateMaterial({
          material_uuid: material.uuid,
          material_code: material.mainCode || material.code || '',
          material_name: material.name,
        })
      )

      const qrcodes = await Promise.all(qrcodePromises)
      messageApi.success(t('app.master-data.materials.qrCodeGenerated', { count: qrcodes.length }))

      // TODO: 可以打开一个Modal显示所有二维码，或者提供下载功能
    } catch (error: any) {
      messageApi.error(`${t('app.master-data.materials.batchQrCodeFailed')}: ${error.message || t('common.unknownError')}`)
    }
  }, [selectedRowKeys, messageApi])

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
   * 处理批量删除物料
   */
  const handleBatchDelete = useCallback(() => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('common.selectToDelete'))
      return
    }

    Modal.confirm({
      title: t('common.confirmBatchDelete'),
      content: t('common.confirmBatchDeleteContent', { count: selectedRowKeys.length }),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      okType: 'danger',
      onOk: async () => {
        try {
          let successCount = 0
          let failCount = 0
          const errors: string[] = []

          for (const key of selectedRowKeys) {
            try {
              await materialApi.delete(key.toString())
              successCount++
            } catch (error: any) {
              failCount++
              errors.push(error.message || t('common.deleteFailed'))
            }
          }

          if (successCount > 0) {
            messageApi.success(t('common.batchDeleteSuccess', { count: successCount }))
          }
          if (failCount > 0) {
            messageApi.error(t('common.batchDeletePartial', { count: failCount, errors: errors.length > 0 ? ': ' + errors.join('; ') : '' }))
          }

          setSelectedRowKeys([])
          actionRef.current?.reload()
        } catch (error: any) {
          messageApi.error(error.message || t('common.batchDeleteFailed'))
        }
      },
    })
  }, [selectedRowKeys, messageApi])

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
        toExport = await materialApi.list({ skip: 0, limit: 10000, groupId: selectedGroupId ?? undefined })
      } else if (type === 'selected' && selectedRowKeys?.length && currentPageData) {
        toExport = currentPageData.filter((r) => selectedRowKeys.includes(r.uuid))
      } else if (type === 'currentPage' && currentPageData) {
        toExport = currentPageData
      } else {
        toExport = await materialApi.list({ skip: 0, limit: 10000, groupId: selectedGroupId ?? undefined })
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

  const handleMaterialSubmit = async (values: any) => {
    try {
      setMaterialFormLoading(true)
      emitAgentDebugLog('run-1', 'H3', 'management.tsx:handleMaterialSubmit:start', 'received values from MaterialForm', {
        isEdit: materialIsEdit,
        hasDefaults: !!values?.defaults,
        defaultsKeys: Object.keys(values?.defaults || {}),
        defaultTaxRate: values?.defaults?.defaultTaxRate,
        defaultSalePrice: values?.defaults?.defaultSalePrice,
      })

      if (materialIsEdit && currentMaterial) {
        await materialApi.update(currentMaterial.uuid, values as MaterialUpdate)
        emitAgentDebugLog('run-1', 'H4', 'management.tsx:handleMaterialSubmit:update-ok', 'update api resolved', {
          materialUuid: currentMaterial.uuid,
        })
        const refreshed = await materialApi.get(currentMaterial.uuid)
        emitAgentDebugLog('run-1', 'H4', 'management.tsx:handleMaterialSubmit:readback', 'readback after update', {
          materialUuid: currentMaterial.uuid,
          hasDefaults: !!(refreshed as any)?.defaults,
          defaultsKeys: Object.keys(((refreshed as any)?.defaults || {})),
          defaultTaxRate: (refreshed as any)?.defaults?.defaultTaxRate,
          defaultSalePrice: (refreshed as any)?.defaults?.defaultSalePrice,
        })
        messageApi.success(t('app.master-data.materials.updateSuccessNotify'))
      } else {
        // 主编码只由 MaterialForm 决定：有 main_code 则按用户/预览保存，无则省略由后端规则生成。
        // 禁止在此处 delete main_code（曾导致预览/手填均被丢弃，只能累加序号）。
        await materialApi.create(values as MaterialCreate)
        messageApi.success(t('common.createSuccess'))
      }

      setMaterialModalVisible(false)
      actionRef.current?.reload()
    } catch (error: any) {
      messageApi.error(error.message || (materialIsEdit ? t('common.updateFailed') : t('common.createFailed')))
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
    return group ? `${group.code} - ${group.name}` : `${t('app.master-data.materials.materialGroup')} ID: ${groupId}`
  }, [materialGroups, t])

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
                <SecureImage
                  fileUuid={fileUuid}
                  alt={firstImage.name || t('app.master-data.materials.image')}
                  width={40}
                  height={40}
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
            onRightClick: info => {
              const key = info.node.key as string
              if (key !== 'all') {
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
            <UniTable<Material>
              size="small"
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
                  <Button
                    icon={<QrcodeOutlined />}
                    disabled={selectedRowKeys.length === 0}
                    onClick={handleBatchGenerateQRCode}
                  >
                    {t('app.master-data.materials.batchGenerateQRCode')}
                  </Button>
                  <Button
                    icon={<TagsOutlined />}
                    disabled={selectedRowKeys.length === 0}
                    onClick={handleOpenBatchSerialModal}
                  >
                    {t('app.master-data.materials.batchTrackingToolbar')}
                  </Button>
                  <Button
                    danger
                    disabled={selectedRowKeys.length === 0}
                    icon={<DeleteOutlined />}
                    onClick={handleBatchDelete}
                  >
                    {t('app.master-data.materials.batchDelete')}
                  </Button>
                </Space>
              }
              request={async (params, _sort, _filter, searchFormValues) => {
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

                try {
                  const result = await materialApi.list(apiParams)
                  return {
                    data: result,
                    success: true,
                    total: result.length,
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
              pagination={{
                defaultPageSize: 20,
                showSizeChanger: true,
              }}
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
          ),
        }}
      />

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

      {/* 分组创建/编辑 Modal - 使用 FormModalTemplate 与其它单列 modal 行为一致 */}
      <FormModalTemplate
        title={groupIsEdit ? t('app.master-data.materials.editGroup') : t('app.master-data.materials.createGroup')}
        open={groupModalVisible}
        onClose={() => setGroupModalVisible(false)}
        onFinish={handleGroupSubmit}
        isEdit={groupIsEdit}
        loading={groupFormLoading}
        formRef={groupFormRef as React.RefObject<ProFormInstance>}
        width={MODAL_CONFIG.SMALL_WIDTH}
        initialValues={
          groupIsEdit && currentGroup
            ? {
                code: currentGroup.code,
                name: currentGroup.name,
                parentId: currentGroup.parentId,
                description: currentGroup.description,
                isActive: currentGroup.isActive,
              }
            : { isActive: true }
        }
      >
        <SafeProFormSelect
          name="parentId"
          label={t('app.master-data.materials.parentGroup')}
          placeholder={t('app.master-data.materials.parentGroupPlaceholder')}
          options={materialGroups
            .filter(g => !groupIsEdit || g.id !== currentGroup?.id) // 编辑时排除自己
            .map(g => ({
              label: `${g.code} - ${g.name}`,
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

      {/* 物料详情 Drawer */}
      <Drawer
        title={t('app.master-data.materials.materialDetail')}
        size={720}
        open={materialDrawerVisible}
        onClose={() => setMaterialDrawerVisible(false)}
        loading={materialDetailLoading}
        styles={{ body: { position: 'relative' } }}
      >
        {currentMaterial && (
          <>
            <ProDescriptions<Material>
              dataSource={currentMaterial}
              column={1}
              columns={[
                {
                  title: t('app.master-data.materials.materialCode'),
                  dataIndex: 'code',
                copyable: true,},
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
                  dataIndex: ['processRouteName', 'process_route_name'],
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
                  span: 2,
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
              ]}
            />

            {/* 物料二维码 */}
            <div style={{ 
              position: 'absolute', 
              top: 24, 
              right: 24, 
              width: 152, 
              zIndex: 10,
              background: '#fff',
              padding: '12px',
              borderRadius: token.borderRadiusLG,
              border: '1px solid rgba(0, 0, 0, 0.06)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
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
          </>
        )}
      </Drawer>

      {/* 分组右键菜单 */}
      {contextMenuVisible && (
        <div
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
              }
              setContextMenuVisible(false)
            }}
          >
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

    </>
  )
}

export default MaterialsManagementPage
