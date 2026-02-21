/**
 * 物料管理合并页面
 *
 * 左侧物料分组树，右侧物料管理列表
 * 参考文件管理页面的左右两栏布局
 */

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
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
  Image,
} from 'antd'
import {
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  FolderOutlined,
  QrcodeOutlined,
  ExpandOutlined,
  CompressOutlined,
} from '@ant-design/icons'
import {
  ActionType,
  ProColumns,
  ProForm,
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
import { TwoColumnLayout } from '../../../../components/layout-templates'
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
} from '../../types/material'
import { isAutoGenerateEnabled } from '../../../../utils/codeRulePage'
import { getDataDictionaryByCode, getDictionaryItemList } from '../../../../services/dataDictionary'
import { getFileDownloadUrl } from '../../../../services/file'


/**
 * 物料管理合并页面组件
 */
const MaterialsManagementPage: React.FC = () => {
  const { message: messageApi } = App.useApp()
  const { token } = theme.useToken()
  const [searchParams, setSearchParams] = useSearchParams()

  // 左侧分组树状态
  const [groupTreeData, setGroupTreeData] = useState<DataNode[]>([])
  const [filteredGroupTreeData, setFilteredGroupTreeData] = useState<DataNode[]>([])
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([])
  const [selectedGroupKeys, setSelectedGroupKeys] = useState<React.Key[]>(['all'])
  const [groupSearchValue, setGroupSearchValue] = useState<string>('')

  // 右侧物料列表状态
  const actionRef = useRef<ActionType>(null)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])

  // 表单引用
  const groupFormRef = useRef<ProFormInstance>()

  // Modal 和 Drawer 状态
  const [groupModalVisible, setGroupModalVisible] = useState(false)
  const [groupIsEdit, setGroupIsEdit] = useState(false)
  const [currentGroup, setCurrentGroup] = useState<MaterialGroup | null>(null)
  const [groupFormLoading, setGroupFormLoading] = useState(false)

  const [materialModalVisible, setMaterialModalVisible] = useState(false)
  const [materialIsEdit, setMaterialIsEdit] = useState(false)
  const [materialFormLoading, setMaterialFormLoading] = useState(false)
  const [materialDrawerVisible, setMaterialDrawerVisible] = useState(false)
  const [currentMaterial, setCurrentMaterial] = useState<Material | null>(null)
  const [materialDetailLoading, setMaterialDetailLoading] = useState(false)

  // 数据状态
  const [materialGroups, setMaterialGroups] = useState<MaterialGroup[]>([])
  const [materialGroupsLoading, setMaterialGroupsLoading] = useState(false)
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)

  // 右键菜单状态
  const [contextMenuVisible, setContextMenuVisible] = useState(false)
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 })
  const [contextMenuGroup, setContextMenuGroup] = useState<MaterialGroup | null>(null)

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

  // 数据字典选项状态（用于搜索下拉框）
  const [materialTypeOptions, setMaterialTypeOptions] = useState<
    Array<{ label: string; value: string }>
  >([])
  const [baseUnitOptions, setBaseUnitOptions] = useState<Array<{ label: string; value: string }>>(
    []
  )
  const [loadingMaterialTypeOptions, setLoadingMaterialTypeOptions] = useState(false)
  const [loadingBaseUnitOptions, setLoadingBaseUnitOptions] = useState(false)

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
        title: '全部物料',
        key: 'all',
        icon: <FolderOutlined />,
        isLeaf: false,
        children: treeResponse.map(convertNode),
      },
    ]
  }, [])

  /**
   * 递归收集所有节点的key
   */
  const collectAllKeys = useCallback((nodes: DataNode[]): React.Key[] => {
    let keys: React.Key[] = []
    nodes.forEach(node => {
      keys.push(node.key)
      if (node.children && node.children.length > 0) {
        keys = keys.concat(collectAllKeys(node.children))
      }
    })
    return keys
  }, [])

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
      messageApi.error('加载物料分组失败')
    } finally {
      setMaterialGroupsLoading(false)
    }
  }, [messageApi, convertToTreeData])

  /**
   * 加载数据字典选项（物料类型和基础单位）
   */
  const loadDictionaryOptions = useCallback(async () => {
    // 加载物料类型选项
    try {
      setLoadingMaterialTypeOptions(true)
      const materialTypeDict = await getDataDictionaryByCode('MATERIAL_TYPE')
      const materialTypeItems = await getDictionaryItemList(materialTypeDict.uuid, true)
      setMaterialTypeOptions(
        materialTypeItems
          .sort((a, b) => a.sort_order - b.sort_order)
          .map(item => ({ label: item.label, value: item.value }))
      )
    } catch (error: any) {
      console.error('加载物料类型选项失败:', error)
    } finally {
      setLoadingMaterialTypeOptions(false)
    }

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

  /**
   * 处理分组树选择
   */
  const handleGroupSelect: TreeProps['onSelect'] = selectedKeys => {
    if (selectedKeys.length > 0) {
      const key = selectedKeys[0] as string
      setSelectedGroupKeys(selectedKeys)

      if (key === 'all') {
        setSelectedGroupId(null)
      } else {
        const groupId = parseInt(key)
        setSelectedGroupId(groupId)
      }

      // 刷新物料列表
      actionRef.current?.reload()
    }
  }

  /**
   * 处理分组树展开/收起
   */
  const handleGroupExpand: TreeProps['onExpand'] = expandedKeys => {
    setExpandedKeys(expandedKeys)
  }

  /**
   * 处理分组右键菜单
   */
  const handleGroupContextMenu = (e: React.MouseEvent, group: MaterialGroup | null) => {
    e.preventDefault()
    e.stopPropagation()

    setContextMenuGroup(group)
    setContextMenuPosition({ x: e.clientX, y: e.clientY })
    setContextMenuVisible(true)
  }

  /**
   * 递归过滤树数据（支持搜索子分组）
   * 如果父分组匹配，显示父分组及其所有子分组
   * 如果子分组匹配，显示父分组和匹配的子分组
   */
  const filterTreeData = useCallback((nodes: DataNode[], keyword: string): DataNode[] => {
    if (!keyword.trim()) {
      return nodes
    }

    const filtered: DataNode[] = []
    const keywordLower = keyword.toLowerCase()

    nodes.forEach(node => {
      // 检查当前节点是否匹配（排除"全部物料"节点）
      const matches =
        node.key !== 'all' && node.title?.toString().toLowerCase().includes(keywordLower)

      // 递归过滤子节点
      const filteredChildren = node.children ? filterTreeData(node.children, keyword) : []

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
  }, [])

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
  }, [searchParams, setSearchParams])

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
  }, [groupTreeData, groupSearchValue, filterTreeData])

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
        messageApi.success('删除成功')
        loadMaterialGroups()
      } catch (error: any) {
        messageApi.error(error.message || '删除失败')
      }
    },
    [messageApi, loadMaterialGroups]
  )

  const handleGroupSubmit = async (values: any) => {
    try {
      setGroupFormLoading(true)

      if (groupIsEdit && currentGroup) {
        await materialGroupApi.update(currentGroup.uuid, values as MaterialGroupUpdate)
        messageApi.success('更新成功')
      } else {
        await materialGroupApi.create(values as MaterialGroupCreate)
        messageApi.success('创建成功')
      }

      setGroupModalVisible(false)
      loadMaterialGroups()
    } catch (error: any) {
      messageApi.error(error.message || (groupIsEdit ? '更新失败' : '创建失败'))
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
    // 注意：编码生成逻辑已移至 MaterialForm 组件内部
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
        messageApi.error(error.message || '获取物料详情失败')
      }
    },
    [messageApi]
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
        messageApi.error(error.message || '获取物料详情失败')
      } finally {
        setMaterialDetailLoading(false)
      }
    },
    [messageApi]
  )

  /**
   * 处理批量生成二维码
   */
  const handleBatchGenerateQRCode = useCallback(async () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning('请先选择要生成二维码的物料')
      return
    }

    try {
      // 通过API获取选中的物料数据
      const materials = await Promise.all(
        selectedRowKeys.map(async key => {
          try {
            return await materialApi.get(key as string)
          } catch (error) {
            console.error(`获取物料失败: ${key}`, error)
            return null
          }
        })
      )

      const validMaterials = materials.filter(m => m !== null) as Material[]

      if (validMaterials.length === 0) {
        messageApi.error('无法获取选中的物料数据')
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
      messageApi.success(`成功生成 ${qrcodes.length} 个物料二维码`)

      // TODO: 可以打开一个Modal显示所有二维码，或者提供下载功能
    } catch (error: any) {
      messageApi.error(`批量生成二维码失败: ${error.message || '未知错误'}`)
    }
  }, [selectedRowKeys, messageApi])

  const handleDeleteMaterial = useCallback(
    async (record: Material) => {
      try {
        await materialApi.delete(record.uuid)
        messageApi.success('删除成功')
        actionRef.current?.reload()
      } catch (error: any) {
        messageApi.error(error.message || '删除失败')
      }
    },
    [messageApi]
  )

  /**
   * 处理批量删除物料
   */
  const handleBatchDelete = useCallback(() => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning('请先选择要删除的记录')
      return
    }

    Modal.confirm({
      title: '确认批量删除',
      content: `确定要删除选中的 ${selectedRowKeys.length} 条记录吗？此操作不可恢复。`,
      okText: '确定',
      cancelText: '取消',
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
              errors.push(error.message || '删除失败')
            }
          }

          if (successCount > 0) {
            messageApi.success(`成功删除 ${successCount} 条记录`)
          }
          if (failCount > 0) {
            messageApi.error(
              `删除失败 ${failCount} 条记录${errors.length > 0 ? '：' + errors.join('; ') : ''}`
            )
          }

          setSelectedRowKeys([])
          actionRef.current?.reload()
        } catch (error: any) {
          messageApi.error(error.message || '批量删除失败')
        }
      },
    })
  }, [selectedRowKeys, messageApi])

  const handleMaterialSubmit = async (values: any) => {
    try {
      setMaterialFormLoading(true)

      if (materialIsEdit && currentMaterial) {
        await materialApi.update(currentMaterial.uuid, values as MaterialUpdate)
        messageApi.success('更新成功，可在右上角「消息通知」或「个人中心-消息」中查看物料变更提示')
      } else {
        // 新建物料时，如果启用了自动编码，不传递编码，让后端自动生成
        // 这样序号只在真正创建成功时才更新（表单可能传 mainCode 或 main_code）
        const submitValues = { ...values }
        if (isAutoGenerateEnabled('master-data-material')) {
          delete submitValues.mainCode
          delete submitValues.main_code
        }
        await materialApi.create(submitValues as MaterialCreate)
        messageApi.success('创建成功')
      }

      setMaterialModalVisible(false)
      actionRef.current?.reload()
    } catch (error: any) {
      messageApi.error(error.message || (materialIsEdit ? '更新失败' : '创建失败'))
    } finally {
      setMaterialFormLoading(false)
    }
  }

  /**
   * 获取物料分组名称
   */
  const getMaterialGroupName = (groupId?: number): string => {
    if (!groupId) return '-'
    const group = materialGroups.find(g => g.id === groupId)
    return group ? `${group.code} - ${group.name}` : `分组ID: ${groupId}`
  }

  /**
   * 表格列定义
   */
  const columns = useMemo<ProColumns<Material>[]>(
    () => [
      {
        title: '物料编码',
        dataIndex: ['mainCode', 'code'],
        width: 150,
        fixed: 'left',
        render: (_, record) => (record as any).mainCode || (record as any).code || '-',
      },
      {
        title: '物料名称',
        dataIndex: 'name',
        width: 200,
      },
      {
        title: '产品图片',
        dataIndex: 'images',
        width: 100,
        hideInSearch: true,
        render: (_, record) => {
          const images = (record as any).images || [];
          if (images.length > 0) {
            const firstImage = images[0];
            const url = firstImage.url || getFileDownloadUrl(firstImage.uid || firstImage.uuid);
            return (
              <Image
                src={url}
                alt={firstImage.name || '图片'}
                width={40}
                height={40}
                style={{ objectFit: 'cover', borderRadius: 4 }}
                preview={{ src: url }}
              />
            );
          }
          return '-';
        },
      },
      {
        title: '物料分组',
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
        title: '工艺路线',
        dataIndex: ['processRouteName', 'process_route_name'],
        width: 140,
        hideInSearch: true,
        render: (_, record) =>
          (record as any).processRouteName ?? (record as any).process_route_name ?? '-',
      },
      {
        title: '物料类型',
        dataIndex: 'materialType',
        width: 120,
        valueType: 'select',
        valueEnum: materialTypeOptions.reduce(
          (acc, option) => {
            acc[option.value] = { text: option.label }
            return acc
          },
          {} as Record<string, { text: string }>
        ),
        fieldProps: {
          loading: loadingMaterialTypeOptions,
          showSearch: true,
          allowClear: true,
        },
        render: (_, record) => {
          const option = materialTypeOptions.find(opt => opt.value === record.materialType)
          return option ? option.label : record.materialType || '-'
        },
      },
      {
        title: '规格',
        dataIndex: 'specification',
        width: 150,
        ellipsis: true,
      },
      {
        title: '基础单位',
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
        title: '批号管理',
        dataIndex: 'batchManaged',
        width: 100,
        hideInSearch: true,
        render: (_, record) => (
          <Tag color={record.batchManaged ? 'blue' : 'default'}>
            {record.batchManaged ? '是' : '否'}
          </Tag>
        ),
      },
      {
        title: '变体管理',
        dataIndex: 'variantManaged',
        width: 100,
        hideInSearch: true,
        render: (_, record) => (
          <Tag color={record.variantManaged ? 'purple' : 'default'}>
            {record.variantManaged ? '是' : '否'}
          </Tag>
        ),
      },
      {
        title: '品牌',
        dataIndex: 'brand',
        width: 120,
      },
      {
        title: '型号',
        dataIndex: 'model',
        width: 120,
      },
      {
        title: '启用状态',
        dataIndex: 'isActive',
        width: 100,
        valueType: 'select',
        valueEnum: {
          true: { text: '启用', status: 'Success' },
          false: { text: '禁用', status: 'Default' },
        },
        render: (_, record) => (
          <Tag color={record.isActive ? 'success' : 'default'}>
            {record.isActive ? '启用' : '禁用'}
          </Tag>
        ),
      },
      {
        title: '创建时间',
        dataIndex: 'createdAt',
        width: 180,
        valueType: 'dateTime',
        hideInSearch: true,
        sorter: true,
      },
      {
        title: '操作',
        valueType: 'option',
        width: 150,
        fixed: 'right',
        render: (_, record) => (
          <Space>
            <Button type="link" size="small" onClick={() => handleViewMaterial(record)}>
              详情
            </Button>
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEditMaterial(record)}
            >
              编辑
            </Button>
            <Popconfirm
              title="确定要删除这个物料吗？"
              description="删除物料前需要检查是否有关联的BOM"
              onConfirm={() => handleDeleteMaterial(record)}
            >
              <Button type="link" danger size="small" icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [
      materialGroups,
      materialTypeOptions,
      baseUnitOptions,
      loadingMaterialTypeOptions,
      loadingBaseUnitOptions,
      handleViewMaterial,
      handleEditMaterial,
      handleDeleteMaterial,
    ]
  )

  return (
    <>
      <TwoColumnLayout
        leftPanel={{
          search: {
            placeholder: '搜索分组',
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
                新建分组
              </Button>
              <Button
                icon={expandedKeys.length > 1 ? <CompressOutlined /> : <ExpandOutlined />}
                onClick={handleToggleExpand}
                title={expandedKeys.length > 1 ? "折叠全部" : "展开全部"}
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
          width: 300,
          minWidth: 200,
        }}
        rightPanel={{
          // header removed as per request to only show material list
          content: (
            <UniTable<Material>
              size="small"
              actionRef={actionRef}
              columns={columns}
              headerActions={
                <Space>
                  <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateMaterial}>
                    新建物料
                  </Button>
                  <Button
                    icon={<QrcodeOutlined />}
                    disabled={selectedRowKeys.length === 0}
                    onClick={handleBatchGenerateQRCode}
                  >
                    批量生成二维码
                  </Button>
                  <Button
                    danger
                    disabled={selectedRowKeys.length === 0}
                    icon={<DeleteOutlined />}
                    onClick={handleBatchDelete}
                  >
                    批量删除
                  </Button>
                </Space>
              }
              request={async (params, sort, filter, searchFormValues) => {
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
                } else if (selectedGroupId) {
                  // 如果没有搜索表单值，使用左侧树选择
                  apiParams.groupId = selectedGroupId
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

                // 物料类型搜索
                if (
                  searchFormValues?.materialType !== undefined &&
                  searchFormValues.materialType !== null &&
                  searchFormValues.materialType !== ''
                ) {
                  apiParams.materialType = searchFormValues.materialType
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
                  console.error('获取物料列表失败:', error)
                  messageApi.error(error?.message || '获取物料列表失败')
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
            />
          ),
        }}
      />

      {/* 分组创建/编辑 Modal */}
      <Modal
        title={groupIsEdit ? '编辑物料分组' : '新建物料分组'}
        open={groupModalVisible}
        onCancel={() => setGroupModalVisible(false)}
        footer={null}
        width={600}
        destroyOnHidden
      >
        <ProForm
          formRef={groupFormRef}
          submitter={{
            searchConfig: {
              submitText: groupIsEdit ? '更新' : '创建',
            },
            resetButtonProps: {
              style: { display: 'none' },
            },
          }}
          onFinish={handleGroupSubmit}
          loading={groupFormLoading}
          initialValues={
            groupIsEdit && currentGroup
              ? {
                  code: currentGroup.code,
                  name: currentGroup.name,
                  parentId: currentGroup.parentId,
                  description: currentGroup.description,
                  isActive: currentGroup.isActive,
                }
              : {
                  isActive: true,
                }
          }
        >
          <SafeProFormSelect
            name="parentId"
            label="父分组"
            placeholder="请选择父分组（可选）"
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
              filterOption: (input, option) => {
                const label = (option?.label as string) || ''
                return label.toLowerCase().includes(input.toLowerCase())
              },
            }}
          />
          <ProFormText
            name="code"
            label="分组编码"
            placeholder="请输入分组编码"
            rules={[
              { required: true, message: '请输入分组编码' },
              { max: 50, message: '分组编码不能超过50个字符' },
            ]}
            fieldProps={{
              style: { textTransform: 'uppercase' },
            }}
          />
          <ProFormText
            name="name"
            label="分组名称"
            placeholder="请输入分组名称"
            rules={[
              { required: true, message: '请输入分组名称' },
              { max: 200, message: '分组名称不能超过200个字符' },
            ]}
          />
          <ProFormTextArea
            name="description"
            label="描述"
            placeholder="请输入分组描述"
            rows={3}
            fieldProps={{
              maxLength: 500,
            }}
          />
          <ProFormSwitch
            name="isActive"
            label="启用状态"
            checkedChildren="启用"
            unCheckedChildren="禁用"
          />
        </ProForm>
      </Modal>

      {/* 物料创建/编辑 Modal - 使用新的多标签页表单组件 */}
      <MaterialForm
        open={materialModalVisible}
        onClose={() => setMaterialModalVisible(false)}
        onFinish={handleMaterialSubmit}
        isEdit={materialIsEdit}
        material={currentMaterial || undefined}
        materialGroups={materialGroups}
        loading={materialFormLoading}
        initialValues={
          materialIsEdit && currentMaterial
            ? {
                // 兼容后端 snake_case：编辑时 API 返回 main_code 等，表单需要 mainCode
                mainCode: currentMaterial.mainCode ?? (currentMaterial as any).main_code,
                name: currentMaterial.name,
                groupId: currentMaterial.groupId ?? (currentMaterial as any).group_id,
                materialType:
                  ((currentMaterial as any).materialType ??
                    (currentMaterial as any).material_type) ||
                  'RAW',
                specification: currentMaterial.specification,
                baseUnit: currentMaterial.baseUnit ?? (currentMaterial as any).base_unit,
                batchManaged:
                  currentMaterial.batchManaged ?? (currentMaterial as any).batch_managed,
                variantManaged:
                  currentMaterial.variantManaged ?? (currentMaterial as any).variant_managed,
                variantAttributes:
                  currentMaterial.variantAttributes ?? (currentMaterial as any).variant_attributes,
                description: currentMaterial.description,
                brand: currentMaterial.brand,
                model: currentMaterial.model,
                isActive: currentMaterial.isActive ?? (currentMaterial as any).is_active,
              }
            : {
                groupId: selectedGroupId || undefined,
                isActive: true,
                batchManaged: false,
                variantManaged: false,
                materialType: undefined,
                baseUnit: 'PC', // 默认值：件
              }
        }
      />

      {/* 物料详情 Drawer */}
      <Drawer
        title="物料详情"
        size={720}
        open={materialDrawerVisible}
        onClose={() => setMaterialDrawerVisible(false)}
        loading={materialDetailLoading}
      >
        {currentMaterial && (
          <>
            <ProDescriptions<Material>
              dataSource={currentMaterial}
              column={2}
              columns={[
                {
                  title: '物料编码',
                  dataIndex: 'code',
                },
                {
                  title: '物料名称',
                  dataIndex: 'name',
                },
                {
                  title: '物料分组',
                  dataIndex: 'groupId',
                  render: (_, record) => getMaterialGroupName(record.groupId),
                },
                {
                  title: '工艺路线',
                  dataIndex: ['processRouteName', 'process_route_name'],
                  render: (_, record) =>
                    (record as any).processRouteName ?? (record as any).process_route_name ?? '-',
                },
                {
                  title: '规格',
                  dataIndex: 'specification',
                },
                {
                  title: '基础单位',
                  dataIndex: 'baseUnit',
                },
                {
                  title: '品牌',
                  dataIndex: 'brand',
                },
                {
                  title: '型号',
                  dataIndex: 'model',
                },
                {
                  title: '批号管理',
                  dataIndex: 'batchManaged',
                  render: (_, record) => (
                    <Tag color={record.batchManaged ? 'blue' : 'default'}>
                      {record.batchManaged ? '是' : '否'}
                    </Tag>
                  ),
                },
                {
                  title: '变体管理',
                  dataIndex: 'variantManaged',
                  render: (_, record) => (
                    <Tag color={record.variantManaged ? 'purple' : 'default'}>
                      {record.variantManaged ? '是' : '否'}
                    </Tag>
                  ),
                },
                {
                  title: '描述',
                  dataIndex: 'description',
                  span: 2,
                },
                {
                  title: '启用状态',
                  dataIndex: 'isActive',
                  render: (_, record) => (
                    <Tag color={record.isActive ? 'success' : 'default'}>
                      {record.isActive ? '启用' : '禁用'}
                    </Tag>
                  ),
                },
                {
                  title: '创建时间',
                  dataIndex: 'createdAt',
                  valueType: 'dateTime',
                },
                {
                  title: '更新时间',
                  dataIndex: 'updatedAt',
                  valueType: 'dateTime',
                },
              ]}
            />

            {/* 物料二维码 */}
            <div style={{ marginTop: 24 }}>
              <QRCodeGenerator
                qrcodeType="MAT"
                data={{
                  material_uuid: currentMaterial.uuid,
                  material_code: currentMaterial.mainCode || currentMaterial.code || '',
                  material_name: currentMaterial.name,
                }}
                autoGenerate={true}
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
              新建分组
            </Menu.Item>
            {contextMenuGroup && (
              <>
                <Menu.Item key="edit" icon={<EditOutlined />}>
                  编辑分组
                </Menu.Item>
                <Menu.Item key="delete" icon={<DeleteOutlined />} danger>
                  删除分组
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
