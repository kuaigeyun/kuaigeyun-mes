/**
 * 角色管理列表页面
 * 
 * 用于系统管理员查看和管理组织内的角色。
 * 支持角色的 CRUD 操作和权限分配。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormText, ProFormTextArea, ProFormSwitch } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Tree, message } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined, SettingOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../components/layout-templates';
import {
  getRoleList,
  getRoleByUuid,
  createRole,
  updateRole,
  deleteRole,
  getRolePermissions,
  assignPermissions,
  getAllPermissions,
  Role,
  CreateRoleData,
  UpdateRoleData,
  Permission,
} from '../../../../services/role';

/**
 * 角色管理列表页面组件
 */
const RoleListPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Modal 相关状态（创建/编辑）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentRoleUuid, setCurrentRoleUuid] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, any> | undefined>(undefined);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<Role | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // 权限分配 Modal 状态
  const [permissionModalVisible, setPermissionModalVisible] = useState(false);
  const [permissionTreeData, setPermissionTreeData] = useState<any[]>([]);
  const [checkedKeys, setCheckedKeys] = useState<React.Key[]>([]);
  const [permissionLoading, setPermissionLoading] = useState(false);

  /**
   * 处理新建角色
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentRoleUuid(null);
    setFormInitialValues({
      is_active: true,
    });
    setModalVisible(true);
  };

  // 导入处理函数
  const handleImport = async (data: any[][]) => {
    message.info('导入功能开发中...');
    console.log('导入数据:', data);
  };

  // 导出处理函数
  const handleExport = (
    type: 'selected' | 'currentPage' | 'all',
    selectedRowKeys?: React.Key[],
    currentPageData?: Role[]
  ) => {
    message.info('导出功能开发中...');
    console.log('导出类型:', type, '选中行:', selectedRowKeys, '当前页数据:', currentPageData);
  };

  /**
   * 处理编辑角色
   */
  const handleEdit = async (record: Role) => {
    try {
      setIsEdit(true);
      setCurrentRoleUuid(record.uuid);
      
      // 获取角色详情
      const detail = await getRoleByUuid(record.uuid);
      setFormInitialValues({
        name: detail.name,
        code: detail.code,
        description: detail.description,
        is_system: detail.is_system,
        is_active: detail.is_active,
      });
      setModalVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || '获取角色详情失败');
    }
  };

  /**
   * 处理查看详情
   */
  const handleView = async (record: Role) => {
    try {
      setDetailLoading(true);
      setDrawerVisible(true);
      const detail = await getRoleByUuid(record.uuid);
      setDetailData(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取角色详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理删除角色
   */
  const handleDelete = async (record: Role) => {
    try {
      await deleteRole(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理批量删除角色
   */
  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning('请先选择要删除的记录');
      return;
    }

    Modal.confirm({
      title: '确认批量删除',
      content: `确定要删除选中的 ${selectedRowKeys.length} 条记录吗？系统角色无法删除。此操作不可恢复。`,
      okText: '确定',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          let successCount = 0;
          let failCount = 0;
          const errors: string[] = [];

          for (const key of selectedRowKeys) {
            try {
              await deleteRole(key.toString());
              successCount++;
            } catch (error: any) {
              failCount++;
              errors.push(error.message || '删除失败');
            }
          }

          if (successCount > 0) {
            messageApi.success(`成功删除 ${successCount} 条记录`);
          }
          if (failCount > 0) {
            messageApi.error(`删除失败 ${failCount} 条记录${errors.length > 0 ? '：' + errors.join('; ') : ''}`);
          }

          setSelectedRowKeys([]);
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '批量删除失败');
        }
      },
    });
  };

  /**
   * 处理提交表单（创建/更新）
   */
  const handleSubmit = async (values: any): Promise<void> => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentRoleUuid) {
        await updateRole(currentRoleUuid, values as UpdateRoleData);
        messageApi.success('更新成功');
      } else {
        await createRole(values as CreateRoleData);
        messageApi.success('创建成功');
      }
      
      setModalVisible(false);
      setFormInitialValues(undefined);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
      throw error;
    } finally {
      setFormLoading(false);
    }
  };

  /**
   * 处理权限分配
   */
  const handleAssignPermissions = async (record: Role) => {
    try {
      setPermissionLoading(true);
      setPermissionModalVisible(true);
      setCurrentRoleUuid(record.uuid);
      
      // 获取所有权限
      const allPermissions = await getAllPermissions({ page_size: 100 });
      
      // 获取角色已有权限
      const rolePermissions = await getRolePermissions(record.uuid);
      const rolePermissionUuids = rolePermissions.map(p => p.uuid);
      setCheckedKeys(rolePermissionUuids);
      
      // 构建树形数据（按资源分组）
      const resourceMap: Record<string, Permission[]> = {};
      allPermissions.items.forEach(permission => {
        if (!resourceMap[permission.resource]) {
          resourceMap[permission.resource] = [];
        }
        resourceMap[permission.resource].push(permission);
      });
      
      const treeData = Object.keys(resourceMap).map(resource => ({
        title: resource,
        key: `resource-${resource}`,
        children: resourceMap[resource].map(permission => ({
          title: `${permission.name} (${permission.code})`,
          key: permission.uuid,
        })),
      }));
      
      setPermissionTreeData(treeData);
    } catch (error: any) {
      messageApi.error(error.message || '获取权限列表失败');
    } finally {
      setPermissionLoading(false);
    }
  };

  /**
   * 提交权限分配
   */
  const handleSubmitPermissions = async () => {
    try {
      if (!currentRoleUuid) return;
      
      setPermissionLoading(true);
      const permissionUuids = checkedKeys.filter(key => typeof key === 'string' && !key.startsWith('resource-')) as string[];
      await assignPermissions(currentRoleUuid, permissionUuids);
      messageApi.success('权限分配成功');
      setPermissionModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '权限分配失败');
    } finally {
      setPermissionLoading(false);
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<Role>[] = [
    {
      title: '角色名称',
      dataIndex: 'name',
      width: 150,
      fixed: 'left',
      sorter: true,
    },
    {
      title: '角色代码',
      dataIndex: 'code',
      width: 150,
      copyable: true,
    },
    {
      title: '描述',
      dataIndex: 'description',
      width: 200,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: '系统角色',
      dataIndex: 'is_system',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: '是', status: 'Default' },
        false: { text: '否', status: 'Processing' },
      },
      render: (_, record) => (
        <Tag color={record.is_system ? 'default' : 'blue'}>
          {record.is_system ? '是' : '否'}
        </Tag>
      ),
    },
    {
      title: '权限数',
      dataIndex: 'permission_count',
      width: 100,
      hideInSearch: true,
      sorter: true,
    },
    {
      title: '用户数',
      dataIndex: 'user_count',
      width: 100,
      hideInSearch: true,
      sorter: true,
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: '启用', status: 'Success' },
        false: { text: '禁用', status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.is_active ? 'success' : 'default'}>
          {record.is_active ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 220,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleView(record)}
          >
            查看
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            disabled={record.is_system}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            icon={<SettingOutlined />}
            onClick={() => handleAssignPermissions(record)}
          >
            权限
          </Button>
          <Popconfirm
            title="确定要删除这个角色吗？"
            onConfirm={() => handleDelete(record)}
            disabled={record.is_system}
          >
            <Button
              type="link"
              danger
              size="small"
              icon={<DeleteOutlined />}
              disabled={record.is_system}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<Role>
          viewTypes={['table', 'help']}
          actionRef={actionRef}
          columns={columns}
          request={async (params, _, __, searchFormValues) => {
            // ⚠️ 修复：正确处理高级搜索参数
            // 1. name 字段转换为 keyword（后端使用 keyword 搜索名称）
            // 2. is_system 字段直接传递（后端支持 is_system 筛选）
            // 3. is_active 字段直接传递（后端支持 is_active 筛选）
            const apiParams: any = {
              page: params.current || 1,
              page_size: params.pageSize || 20,
            };
            
            // 处理 keyword（Fuzzy 搜索）
            if (searchFormValues?.keyword) {
              apiParams.keyword = searchFormValues.keyword;
            }
            
            // 处理各别字段（Advanced 搜索）
            if (searchFormValues?.name) {
              apiParams.name = searchFormValues.name;
            }
            if (searchFormValues?.code) {
              apiParams.code = searchFormValues.code;
            }
            
            // 处理 is_system（需要转换为 boolean）
            if (searchFormValues?.is_system !== undefined && searchFormValues.is_system !== '') {
              apiParams.is_system = searchFormValues.is_system === 'true' || searchFormValues.is_system === true;
            }
            
            // 处理 is_active（需要转换为 boolean）
            if (searchFormValues?.is_active !== undefined && searchFormValues.is_active !== '') {
              apiParams.is_active = searchFormValues.is_active === 'true' || searchFormValues.is_active === true;
            }
            
            const response = await getRoleList(apiParams);
            return {
              data: response.items,
              success: true,
              total: response.total,
            };
          }}
          rowKey="uuid"
          showAdvancedSearch={true}
          showCreateButton
          createButtonText="新建角色"
          onCreate={handleCreate}
          showDeleteButton
          onDelete={handleBatchDelete}
          deleteButtonText="批量删除"
          pagination={{
            defaultPageSize: 20,
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: ['10', '20', '50', '100'],
          }}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
          showImportButton={true}
          onImport={handleImport}
          showExportButton={true}
          onExport={handleExport}
        />
      </ListPageTemplate>

      {/* 创建/编辑 Modal */}
      <FormModalTemplate
        title={isEdit ? '编辑角色' : '新建角色'}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setFormInitialValues(undefined);
        }}
        onFinish={handleSubmit}
        isEdit={isEdit}
        initialValues={formInitialValues}
        loading={formLoading}
        width={MODAL_CONFIG.STANDARD_WIDTH}
      >
        <ProFormText
          name="name"
          label="角色名称"
          rules={[{ required: true, message: '请输入角色名称' }]}
          placeholder="请输入角色名称"
        />
        <ProFormText
          name="code"
          label="角色代码"
          rules={[
            { required: true, message: '请输入角色代码' },
            { pattern: /^[a-zA-Z0-9_]+$/, message: '角色代码只能包含字母、数字和下划线' },
          ]}
          placeholder="请输入角色代码（如：admin、user）"
        />
        <ProFormTextArea
          name="description"
          label="描述"
          placeholder="请输入角色描述"
        />
        <ProFormSwitch
          name="is_active"
          label="是否启用"
          initialValue={true}
        />
      </FormModalTemplate>

      {/* 详情 Drawer */}
      <DetailDrawerTemplate
        title="角色详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        dataSource={detailData || undefined}
        columns={[
          { title: '角色名称', dataIndex: 'name' },
          { title: '角色代码', dataIndex: 'code' },
          { title: '描述', dataIndex: 'description', span: 2 },
          {
            title: '系统角色',
            dataIndex: 'is_system',
            render: (value: boolean) => (value ? '是' : '否'),
          },
          {
            title: '状态',
            dataIndex: 'is_active',
            render: (value: boolean) => (value ? '启用' : '禁用'),
          },
          { title: '权限数', dataIndex: 'permission_count' },
          { title: '用户数', dataIndex: 'user_count' },
          { title: '创建时间', dataIndex: 'created_at', valueType: 'dateTime' },
          { title: '更新时间', dataIndex: 'updated_at', valueType: 'dateTime' },
        ]}
      />

      {/* 权限分配 Modal */}
      <Modal
        title="分配权限"
        open={permissionModalVisible}
        onCancel={() => setPermissionModalVisible(false)}
        onOk={handleSubmitPermissions}
        confirmLoading={permissionLoading}
        width={600}
      >
        <Tree
          checkable
          checkedKeys={checkedKeys}
          onCheck={(checked) => setCheckedKeys(checked as React.Key[])}
          treeData={permissionTreeData}
          defaultExpandAll
        />
      </Modal>
    </>
  );
};

export default RoleListPage;

