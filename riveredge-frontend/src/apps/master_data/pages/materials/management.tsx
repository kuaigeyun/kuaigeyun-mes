/**
 * 物料管理合并页面
 *
 * 左侧物料分组树，右侧物料管理列表
 * 参考文件管理页面的左右两栏布局
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { App, Button, Space, Modal, Drawer, Popconfirm, Tag, Input, theme, Tree, Breadcrumb, Menu, message } from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  PlusOutlined,
  SearchOutlined,
  FolderOutlined,
  FolderOpenOutlined,
  ReloadOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  UpOutlined,
} from '@ant-design/icons';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormTextArea, ProFormSwitch, ProFormInstance, ProDescriptions } from '@ant-design/pro-components';
import type { DataNode, TreeProps } from 'antd/es/tree';
import type { MenuProps } from 'antd';

// 导入现有组件
import SafeProFormSelect from '@/components/SafeProFormSelect';
import { UniTable } from '@/components/uni_table';

// 导入服务和类型
import { materialApi, materialGroupApi } from '@/apps/master_data/services/material';
import type { Material, MaterialCreate, MaterialUpdate, MaterialGroup, MaterialGroupCreate, MaterialGroupUpdate } from '@/apps/master_data/types/material';

/**
 * 物料管理合并页面组件
 */
const MaterialsManagementPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const { token } = theme.useToken();

  // 左侧分组树状态
  const [groupTreeData, setGroupTreeData] = useState<DataNode[]>([]);
  const [filteredGroupTreeData, setFilteredGroupTreeData] = useState<DataNode[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [selectedGroupKeys, setSelectedGroupKeys] = useState<React.Key[]>(['all']);
  const [groupSearchValue, setGroupSearchValue] = useState<string>('');

  // 右侧物料列表状态
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // 表单引用
  const groupFormRef = useRef<ProFormInstance>();
  const materialFormRef = useRef<ProFormInstance>();

  // Modal 和 Drawer 状态
  const [groupModalVisible, setGroupModalVisible] = useState(false);
  const [groupIsEdit, setGroupIsEdit] = useState(false);
  const [currentGroup, setCurrentGroup] = useState<MaterialGroup | null>(null);
  const [groupFormLoading, setGroupFormLoading] = useState(false);

  const [materialModalVisible, setMaterialModalVisible] = useState(false);
  const [materialIsEdit, setMaterialIsEdit] = useState(false);
  const [materialFormLoading, setMaterialFormLoading] = useState(false);
  const [materialDrawerVisible, setMaterialDrawerVisible] = useState(false);
  const [currentMaterial, setCurrentMaterial] = useState<Material | null>(null);
  const [materialDetailLoading, setMaterialDetailLoading] = useState(false);

  // 数据状态
  const [materialGroups, setMaterialGroups] = useState<MaterialGroup[]>([]);
  const [materialGroupsLoading, setMaterialGroupsLoading] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [currentPath, setCurrentPath] = useState<string[]>(['全部物料']);

  // 右键菜单状态
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [contextMenuGroup, setContextMenuGroup] = useState<MaterialGroup | null>(null);

  /**
   * 加载物料分组列表
   */
  const loadMaterialGroups = useCallback(async () => {
    try {
      setMaterialGroupsLoading(true);
      const result = await materialGroupApi.list({ limit: 1000 });
      setMaterialGroups(result);

      // 构建树形数据
      const treeData: DataNode[] = [
        {
          title: '全部物料',
          key: 'all',
          icon: <FolderOutlined />,
          isLeaf: false,
        },
        ...result.map(group => ({
          title: `${group.code} - ${group.name}`,
          key: group.id.toString(),
          icon: <FolderOutlined />,
          isLeaf: false,
        }))
      ];

      setGroupTreeData(treeData);
      setFilteredGroupTreeData(treeData);
    } catch (error: any) {
      console.error('加载物料分组列表失败:', error);
      messageApi.error('加载物料分组失败');
    } finally {
      setMaterialGroupsLoading(false);
    }
  }, [messageApi]);

  /**
   * 处理分组树选择
   */
  const handleGroupSelect: TreeProps['onSelect'] = (selectedKeys) => {
    if (selectedKeys.length > 0) {
      const key = selectedKeys[0] as string;
      setSelectedGroupKeys(selectedKeys);

      if (key === 'all') {
        setSelectedGroupId(null);
        setCurrentPath(['全部物料']);
      } else {
        const groupId = parseInt(key);
        setSelectedGroupId(groupId);
        const group = materialGroups.find(g => g.id === groupId);
        setCurrentPath(['全部物料', group ? group.name : '分组']);
      }

      // 刷新物料列表
      actionRef.current?.reload();
    }
  };

  /**
   * 处理分组右键菜单
   */
  const handleGroupContextMenu = (e: React.MouseEvent, group: MaterialGroup | null) => {
    e.preventDefault();
    e.stopPropagation();

    setContextMenuGroup(group);
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setContextMenuVisible(true);
  };

  /**
   * 处理分组搜索
   */
  useEffect(() => {
    if (!groupSearchValue.trim()) {
      setFilteredGroupTreeData(groupTreeData);
    } else {
      const filtered = groupTreeData.filter(node =>
        node.title?.toString().toLowerCase().includes(groupSearchValue.toLowerCase())
      );
      setFilteredGroupTreeData(filtered);
    }
  }, [groupTreeData, groupSearchValue]);

  /**
   * 初始化加载
   */
  useEffect(() => {
    loadMaterialGroups();
  }, [loadMaterialGroups]);

  /**
   * 分组相关操作
   */
  const handleCreateGroup = () => {
    setGroupIsEdit(false);
    setCurrentGroup(null);
    setGroupModalVisible(true);
  };

  const handleEditGroup = (group: MaterialGroup) => {
    setGroupIsEdit(true);
    setCurrentGroup(group);
    setGroupModalVisible(true);
  };

  const handleDeleteGroup = async (group: MaterialGroup) => {
    try {
      await materialGroupApi.delete(group.uuid);
      messageApi.success('删除成功');
      loadMaterialGroups();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  const handleGroupSubmit = async (values: any) => {
    try {
      setGroupFormLoading(true);

      if (groupIsEdit && currentGroup) {
        await materialGroupApi.update(currentGroup.uuid, values as MaterialGroupUpdate);
        messageApi.success('更新成功');
      } else {
        await materialGroupApi.create(values as MaterialGroupCreate);
        messageApi.success('创建成功');
      }

      setGroupModalVisible(false);
      loadMaterialGroups();
    } catch (error: any) {
      messageApi.error(error.message || (groupIsEdit ? '更新失败' : '创建失败'));
    } finally {
      setGroupFormLoading(false);
    }
  };

  /**
   * 物料相关操作
   */
  const handleCreateMaterial = () => {
    setMaterialIsEdit(false);
    setMaterialModalVisible(true);
  };

  const handleEditMaterial = async (record: Material) => {
    try {
      setMaterialIsEdit(true);
      // 获取物料详情
      const detail = await materialApi.get(record.uuid);
      setCurrentMaterial(detail);
      setMaterialModalVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || '获取物料详情失败');
    }
  };

  const handleViewMaterial = async (record: Material) => {
    try {
      setMaterialDetailLoading(true);
      // 获取物料详情
      const detail = await materialApi.get(record.uuid);
      setCurrentMaterial(detail);
      setMaterialDrawerVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || '获取物料详情失败');
    } finally {
      setMaterialDetailLoading(false);
    }
  };

  const handleDeleteMaterial = async (record: Material) => {
    try {
      await materialApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  const handleMaterialSubmit = async (values: any) => {
    try {
      setMaterialFormLoading(true);

      if (materialIsEdit && currentMaterial) {
        await materialApi.update(currentMaterial.uuid, values as MaterialUpdate);
        messageApi.success('更新成功');
      } else {
        await materialApi.create(values as MaterialCreate);
        messageApi.success('创建成功');
      }

      setMaterialModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || (materialIsEdit ? '更新失败' : '创建失败'));
    } finally {
      setMaterialFormLoading(false);
    }
  };

  /**
   * 获取物料分组名称
   */
  const getMaterialGroupName = (groupId?: number): string => {
    if (!groupId) return '-';
    const group = materialGroups.find(g => g.id === groupId);
    return group ? `${group.code} - ${group.name}` : `分组ID: ${groupId}`;
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<Material>[] = [
    {
      title: '物料编码',
      dataIndex: 'code',
      width: 150,
      fixed: 'left',
    },
    {
      title: '物料名称',
      dataIndex: 'name',
      width: 200,
    },
    {
      title: '物料分组',
      dataIndex: 'groupId',
      width: 150,
      hideInSearch: true,
      render: (_, record) => getMaterialGroupName(record.groupId),
    },
    {
      title: '规格',
      dataIndex: 'specification',
      width: 150,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: '基础单位',
      dataIndex: 'baseUnit',
      width: 100,
      hideInSearch: true,
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
      hideInSearch: true,
    },
    {
      title: '型号',
      dataIndex: 'model',
      width: 120,
      hideInSearch: true,
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
          <Button
            type="link"
            size="small"
            onClick={() => handleViewMaterial(record)}
          >
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
            <Button
              type="link"
              danger
              size="small"
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div
      style={{
        display: 'flex',
        height: 'calc(100vh - 96px)',
        padding: '16px',
        margin: 0,
        boxSizing: 'border-box',
        borderRadius: token.borderRadiusLG || token.borderRadius,
        overflow: 'hidden',
      }}
    >
      {/* 左侧物料分组树 */}
      <div
        style={{
          width: '300px',
          flexShrink: 0,
          borderTop: `1px solid ${token.colorBorder}`,
          borderBottom: `1px solid ${token.colorBorder}`,
          borderLeft: `1px solid ${token.colorBorder}`,
          borderRight: 'none',
          backgroundColor: token.colorFillAlter || '#fafafa',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          borderTopLeftRadius: token.borderRadiusLG || token.borderRadius,
          borderBottomLeftRadius: token.borderRadiusLG || token.borderRadius,
          boxSizing: 'border-box',
        }}
      >
        {/* 搜索栏 */}
        <div style={{ padding: '8px', borderBottom: `1px solid ${token.colorBorder}` }}>
          <Input
            placeholder="搜索分组"
            prefix={<SearchOutlined />}
            value={groupSearchValue}
            onChange={(e) => setGroupSearchValue(e.target.value)}
            allowClear
            size="middle"
          />
        </div>

        {/* 分组树 */}
        <div className="left-panel-scroll-container" style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
          <Tree
            className="material-group-tree"
            treeData={filteredGroupTreeData.length > 0 || !groupSearchValue.trim() ? filteredGroupTreeData : groupTreeData}
            selectedKeys={selectedGroupKeys}
            expandedKeys={expandedKeys}
            onSelect={handleGroupSelect}
            onExpand={setExpandedKeys}
            showIcon
            blockNode
            onRightClick={(info) => {
              const key = info.node.key as string;
              if (key !== 'all') {
                const groupId = parseInt(key);
                const group = materialGroups.find(g => g.id === groupId);
                handleGroupContextMenu(info.event as any, group || null);
              }
            }}
          />
        </div>
      </div>

      {/* 右侧物料管理列表 */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: token.colorBgContainer,
          borderTop: `1px solid ${token.colorBorder}`,
          borderBottom: `1px solid ${token.colorBorder}`,
          borderRight: `1px solid ${token.colorBorder}`,
          borderLeft: 'none',
          borderTopRightRadius: token.borderRadiusLG || token.borderRadius,
          borderBottomRightRadius: token.borderRadiusLG || token.borderRadius,
          boxSizing: 'border-box',
          minWidth: 0,
        }}
      >
        {/* 顶部工具栏 */}
        <div
          style={{
            borderBottom: `1px solid ${token.colorBorder}`,
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Space>
            <Button icon={<ArrowLeftOutlined />} disabled />
            <Button icon={<ArrowRightOutlined />} disabled />
            <Button icon={<UpOutlined />} disabled />
            <Button icon={<ReloadOutlined />} onClick={() => actionRef.current?.reload()} />
          </Space>

          {/* 地址栏 */}
          <Breadcrumb
            style={{ flex: 1 }}
            items={currentPath.map((path, index) => ({
              title: index === currentPath.length - 1 ? (
                <span style={{ fontWeight: 500 }}>{path}</span>
              ) : (
                <a
                  onClick={() => {
                    if (index === 0) {
                      setSelectedGroupKeys(['all']);
                      setSelectedGroupId(null);
                      setCurrentPath(['全部物料']);
                      actionRef.current?.reload();
                    }
                  }}
                >
                  {path}
                </a>
              ),
            }))}
          />
        </div>

        {/* 操作工具栏 */}
        <div
          style={{
            borderBottom: `1px solid ${token.colorBorder}`,
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreateMaterial}
          >
            新建物料
          </Button>
          <Button
            icon={<PlusOutlined />}
            onClick={handleCreateGroup}
          >
            新建分组
          </Button>
          <Button
            danger
            disabled={selectedRowKeys.length === 0}
            icon={<DeleteOutlined />}
            onClick={() => {
              if (selectedRowKeys.length > 0) {
                // TODO: 实现批量删除
                messageApi.info('批量删除功能开发中');
              }
            }}
          >
            删除
          </Button>
        </div>

        {/* 物料列表 */}
        <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
          <UniTable<Material>
            actionRef={actionRef}
            columns={columns}
            request={async (params, sort, filter, searchFormValues) => {
              const apiParams: any = {
                skip: ((params.current || 1) - 1) * (params.pageSize || 20),
                limit: params.pageSize || 20,
              };

              // 按分组筛选
              if (selectedGroupId) {
                apiParams.groupId = selectedGroupId;
              }

              // 启用状态筛选
              if (searchFormValues?.isActive !== undefined && searchFormValues.isActive !== '' && searchFormValues.isActive !== null) {
                apiParams.isActive = searchFormValues.isActive;
              }

              try {
                const result = await materialApi.list(apiParams);
                return {
                  data: result,
                  success: true,
                  total: result.length,
                };
              } catch (error: any) {
                console.error('获取物料列表失败:', error);
                messageApi.error(error?.message || '获取物料列表失败');
                return {
                  data: [],
                  success: false,
                  total: 0,
                };
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
        </div>

        {/* 底部状态栏 */}
        <div
          style={{
            borderTop: `1px solid ${token.colorBorder}`,
            padding: '8px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '12px',
            color: token.colorTextSecondary,
          }}
        >
          <span>
            {selectedRowKeys.length > 0
              ? `已选择 ${selectedRowKeys.length} 项`
              : '物料列表'}
          </span>
        </div>
      </div>

      {/* 分组创建/编辑 Modal */}
      <Modal
        title={groupIsEdit ? '编辑物料分组' : '新建物料分组'}
        open={groupModalVisible}
        onCancel={() => setGroupModalVisible(false)}
        footer={null}
        width={600}
        destroyOnClose
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
                const label = option?.label as string || '';
                return label.toLowerCase().includes(input.toLowerCase());
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

      {/* 物料创建/编辑 Modal */}
      <Modal
        title={materialIsEdit ? '编辑物料' : '新建物料'}
        open={materialModalVisible}
        onCancel={() => setMaterialModalVisible(false)}
        footer={null}
        width={800}
        destroyOnClose
      >
        <ProForm
          formRef={materialFormRef}
          submitter={{
            searchConfig: {
              submitText: materialIsEdit ? '更新' : '创建',
            },
            resetButtonProps: {
              style: { display: 'none' },
            },
          }}
          onFinish={handleMaterialSubmit}
          loading={materialFormLoading}
          initialValues={
            materialIsEdit && currentMaterial
              ? {
                  code: currentMaterial.code,
                  name: currentMaterial.name,
                  groupId: currentMaterial.groupId,
                  specification: currentMaterial.specification,
                  baseUnit: currentMaterial.baseUnit,
                  batchManaged: currentMaterial.batchManaged,
                  variantManaged: currentMaterial.variantManaged,
                  description: currentMaterial.description,
                  brand: currentMaterial.brand,
                  model: currentMaterial.model,
                  isActive: currentMaterial.isActive,
                }
              : {
                  groupId: selectedGroupId || undefined,
                  isActive: true,
                  batchManaged: false,
                  variantManaged: false,
                }
          }
          layout="vertical"
          grid={true}
          rowProps={{ gutter: 16 }}
        >
          <SafeProFormSelect
            name="groupId"
            label="物料分组"
            placeholder="请选择物料分组（可选）"
            colProps={{ span: 12 }}
            options={materialGroups.map(g => ({
              label: `${g.code} - ${g.name}`,
              value: g.id,
            }))}
            fieldProps={{
              loading: materialGroupsLoading,
              showSearch: true,
              allowClear: true,
              filterOption: (input, option) => {
                const label = option?.label as string || '';
                return label.toLowerCase().includes(input.toLowerCase());
              },
            }}
          />
          <ProFormText
            name="code"
            label="物料编码"
            placeholder="请输入物料编码"
            colProps={{ span: 12 }}
            rules={[
              { required: true, message: '请输入物料编码' },
              { max: 50, message: '物料编码不能超过50个字符' },
            ]}
            fieldProps={{
              style: { textTransform: 'uppercase' },
            }}
          />
          <ProFormText
            name="name"
            label="物料名称"
            placeholder="请输入物料名称"
            colProps={{ span: 12 }}
            rules={[
              { required: true, message: '请输入物料名称' },
              { max: 200, message: '物料名称不能超过200个字符' },
            ]}
          />
          <ProFormText
            name="baseUnit"
            label="基础单位"
            placeholder="请输入基础单位（如：个、件、kg等）"
            colProps={{ span: 12 }}
            rules={[
              { required: true, message: '请输入基础单位' },
              { max: 20, message: '基础单位不能超过20个字符' },
            ]}
          />
          <ProFormText
            name="specification"
            label="规格"
            placeholder="请输入规格"
            colProps={{ span: 12 }}
            rules={[
              { max: 500, message: '规格不能超过500个字符' },
            ]}
          />
          <ProFormText
            name="brand"
            label="品牌"
            placeholder="请输入品牌"
            colProps={{ span: 12 }}
            rules={[
              { max: 100, message: '品牌不能超过100个字符' },
            ]}
          />
          <ProFormText
            name="model"
            label="型号"
            placeholder="请输入型号"
            colProps={{ span: 12 }}
            rules={[
              { max: 100, message: '型号不能超过100个字符' },
            ]}
          />
          <ProFormSwitch
            name="batchManaged"
            label="是否启用批号管理"
            colProps={{ span: 12 }}
          />
          <ProFormSwitch
            name="variantManaged"
            label="是否启用变体管理"
            colProps={{ span: 12 }}
          />
          <ProFormTextArea
            name="description"
            label="描述"
            placeholder="请输入描述"
            colProps={{ span: 24 }}
            fieldProps={{
              rows: 4,
              maxLength: 500,
            }}
          />
          <ProFormSwitch
            name="isActive"
            label="是否启用"
            colProps={{ span: 12 }}
          />
        </ProForm>
      </Modal>

      {/* 物料详情 Drawer */}
      <Drawer
        title="物料详情"
        size={720}
        open={materialDrawerVisible}
        onClose={() => setMaterialDrawerVisible(false)}
        loading={materialDetailLoading}
      >
        {currentMaterial && (
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
          }}
          onClick={() => setContextMenuVisible(false)}
        >
          <Menu
            onClick={({ key }) => {
              switch (key) {
                case 'edit':
                  if (contextMenuGroup) {
                    handleEditGroup(contextMenuGroup);
                  }
                  break;
                case 'delete':
                  if (contextMenuGroup) {
                    handleDeleteGroup(contextMenuGroup);
                  }
                  break;
                case 'create':
                  handleCreateGroup();
                  break;
              }
              setContextMenuVisible(false);
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
    </div>
  );
};

export default MaterialsManagementPage;
