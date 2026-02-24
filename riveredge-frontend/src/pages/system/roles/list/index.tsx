/**
 * 角色管理列表页面
 *
 * 用于系统管理员查看和管理组织内的角色。
 * 支持角色的 CRUD 操作和权限分配。
 * Schema 驱动 + 国际化
 */

import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Tree, message } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined, SettingOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { ListPageTemplate, DetailDrawerTemplate, DRAWER_CONFIG } from '../../../../components/layout-templates';
import { RoleFormModal } from '../components/RoleFormModal';
import {
  getRoleList,
  getRoleByUuid,
  deleteRole,
  getRolePermissions,
  assignPermissions,
  getAllPermissions,
  Role,
  Permission,
} from '../../../../services/role';

const RoleListPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Modal 相关状态（创建/编辑）
  const [modalVisible, setModalVisible] = useState(false);
  const [currentRoleUuid, setCurrentRoleUuid] = useState<string | null>(null);

  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<Role | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // 权限分配 Modal 状态
  const [permissionModalVisible, setPermissionModalVisible] = useState(false);
  const [permissionTreeData, setPermissionTreeData] = useState<any[]>([]);
  const [checkedKeys, setCheckedKeys] = useState<React.Key[]>([]);
  const [permissionLoading, setPermissionLoading] = useState(false);

  const handleCreate = () => {
    setCurrentRoleUuid(null);
    setModalVisible(true);
  };

  const handleEdit = (record: Role) => {
    setCurrentRoleUuid(record.uuid);
    setModalVisible(true);
  };

  const handleImport = async (data: any[][]) => {
    message.info(t('pages.system.importDeveloping'));
    console.log('导入数据:', data);
  };

  const handleExport = (
    type: 'selected' | 'currentPage' | 'all',
    selectedRowKeys?: React.Key[],
    currentPageData?: Role[]
  ) => {
    message.info(t('pages.system.exportDeveloping'));
    console.log('导出类型:', type, '选中行:', selectedRowKeys, '当前页数据:', currentPageData);
  };

  const handleView = async (record: Role) => {
    try {
      setDetailLoading(true);
      setDrawerVisible(true);
      const detail = await getRoleByUuid(record.uuid);
      setDetailData(detail);
    } catch (error: any) {
      messageApi.error(error.message || t('common.loadFailed'));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDelete = async (record: Role) => {
    try {
      await deleteRole(record.uuid);
      messageApi.success(t('pages.system.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.deleteFailed'));
    }
  };

  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('pages.system.selectFirst'));
      return;
    }
    Modal.confirm({
      title: t('common.confirm'),
      content: t('field.role.batchDeleteConfirm', { count: selectedRowKeys.length }),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
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
              errors.push(error.message || t('pages.system.deleteFailed'));
            }
          }
          if (successCount > 0) {
            messageApi.success(t('pages.system.deleteSuccess'));
          }
          if (failCount > 0) {
            messageApi.error(
              `${t('pages.system.deleteFailed')} ${failCount} ${errors.length > 0 ? '：' + errors.join('; ') : ''}`
            );
          }
          setSelectedRowKeys([]);
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('pages.system.deleteFailed'));
        }
      },
    });
  };

  const handleAssignPermissions = async (record: Role) => {
    try {
      setPermissionLoading(true);
      setPermissionModalVisible(true);
      setCurrentRoleUuid(record.uuid);
      const allPermissions = await getAllPermissions({ page_size: 100 });
      const rolePermissions = await getRolePermissions(record.uuid);
      const rolePermissionUuids = rolePermissions.map((p) => p.uuid);
      setCheckedKeys(rolePermissionUuids);
      const resourceMap: Record<string, Permission[]> = {};
      allPermissions.items.forEach((permission) => {
        if (!resourceMap[permission.resource]) {
          resourceMap[permission.resource] = [];
        }
        resourceMap[permission.resource].push(permission);
      });
      const treeData = Object.keys(resourceMap).map((resource) => ({
        title: resource,
        key: `resource-${resource}`,
        children: resourceMap[resource].map((permission) => ({
          title: `${permission.name} (${permission.code})`,
          key: permission.uuid,
        })),
      }));
      setPermissionTreeData(treeData);
    } catch (error: any) {
      messageApi.error(error.message || t('common.loadFailed'));
    } finally {
      setPermissionLoading(false);
    }
  };

  const handleSubmitPermissions = async () => {
    try {
      if (!currentRoleUuid) return;
      setPermissionLoading(true);
      const permissionUuids = checkedKeys.filter(
        (key) => typeof key === 'string' && !key.startsWith('resource-')
      ) as string[];
      await assignPermissions(currentRoleUuid, permissionUuids);
      messageApi.success(t('common.assignSuccess'));
      setPermissionModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.operationFailed'));
    } finally {
      setPermissionLoading(false);
    }
  };

  const columns: ProColumns<Role>[] = [
    {
      title: t('field.role.name'),
      dataIndex: 'name',
      width: 150,
      fixed: 'left',
      sorter: true,
    },
    {
      title: t('field.role.code'),
      dataIndex: 'code',
      width: 150,
      copyable: true,
    },
    {
      title: t('field.role.description'),
      dataIndex: 'description',
      width: 200,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: t('field.role.systemRole'),
      dataIndex: 'is_system',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: t('field.role.yes'), status: 'Default' },
        false: { text: t('field.role.no'), status: 'Processing' },
      },
      render: (_, record) => (
        <Tag color={record.is_system ? 'default' : 'blue'}>
          {record.is_system ? t('field.role.yes') : t('field.role.no')}
        </Tag>
      ),
    },
    {
      title: t('field.role.permissionCount'),
      dataIndex: 'permission_count',
      width: 100,
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('field.role.userCount'),
      dataIndex: 'user_count',
      width: 100,
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('field.role.status'),
      dataIndex: 'is_active',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: t('field.role.enabled'), status: 'Success' },
        false: { text: t('field.role.disabled'), status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.is_active ? 'success' : 'default'}>
          {record.is_active ? t('field.role.enabled') : t('field.role.disabled')}
        </Tag>
      ),
    },
    {
      title: t('common.createdAt'),
      dataIndex: 'created_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('common.updatedAt'),
      dataIndex: 'updated_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('common.actions'),
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
            {t('field.role.view')}
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            disabled={record.is_system}
          >
            {t('field.role.edit')}
          </Button>
          <Button
            type="link"
            size="small"
            icon={<SettingOutlined />}
            onClick={() => handleAssignPermissions(record)}
          >
            {t('field.role.permissions')}
          </Button>
          <Popconfirm
            title={t('field.role.deleteConfirm')}
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
              {t('field.role.delete')}
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
            const apiParams: any = {
              page: params.current || 1,
              page_size: params.pageSize || 20,
            };
            if (searchFormValues?.keyword) apiParams.keyword = searchFormValues.keyword;
            if (searchFormValues?.name) apiParams.name = searchFormValues.name;
            if (searchFormValues?.code) apiParams.code = searchFormValues.code;
            if (searchFormValues?.is_system !== undefined && searchFormValues.is_system !== '') {
              apiParams.is_system = searchFormValues.is_system === 'true' || searchFormValues.is_system === true;
            }
            if (searchFormValues?.is_active !== undefined && searchFormValues.is_active !== '') {
              apiParams.is_active = searchFormValues.is_active === 'true' || searchFormValues.is_active === true;
            }
            const response = await getRoleList(apiParams);
            return { data: response.items, success: true, total: response.total };
          }}
          rowKey="uuid"
          showAdvancedSearch={true}
          showCreateButton
          createButtonText={t('field.role.createTitle')}
          onCreate={handleCreate}
          showDeleteButton
          onDelete={handleBatchDelete}
          deleteButtonText={t('pages.system.batchDelete')}
          pagination={{
            defaultPageSize: 20,
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: ['10', '20', '50', '100'],
          }}
          rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
          showImportButton={true}
          onImport={handleImport}
          showExportButton={true}
          onExport={handleExport}
        />
      </ListPageTemplate>

      <RoleFormModal
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setCurrentRoleUuid(null);
        }}
        editUuid={currentRoleUuid}
        onSuccess={() => actionRef.current?.reload()}
      />

      <DetailDrawerTemplate
        title={t('field.role.detailTitle')}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        dataSource={detailData || undefined}
        columns={[
          { title: t('field.role.name'), dataIndex: 'name' },
          { title: t('field.role.code'), dataIndex: 'code' },
          { title: t('field.role.description'), dataIndex: 'description', span: 2 },
          {
            title: t('field.role.systemRole'),
            dataIndex: 'is_system',
            render: (value: boolean) => (value ? t('field.role.yes') : t('field.role.no')),
          },
          {
            title: t('field.role.status'),
            dataIndex: 'is_active',
            render: (value: boolean) => (value ? t('field.role.enabled') : t('field.role.disabled')),
          },
          { title: t('field.role.permissionCount'), dataIndex: 'permission_count' },
          { title: t('field.role.userCount'), dataIndex: 'user_count' },
          { title: t('common.createdAt'), dataIndex: 'created_at', valueType: 'dateTime' },
          { title: t('common.updatedAt'), dataIndex: 'updated_at', valueType: 'dateTime' },
        ]}
      />

      <Modal
        title={t('field.role.assignPermissions')}
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
