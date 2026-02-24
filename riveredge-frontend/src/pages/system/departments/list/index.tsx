/**
 * 部门管理列表页面
 *
 * 用于系统管理员查看和管理组织内的部门。
 * 使用树形表格展示，支持统计、创建、编辑、删除等功能。
 * Schema 驱动 + 国际化
 */

import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ProColumns } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, List, Popconfirm, Tooltip } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined, ApartmentOutlined, TeamOutlined, CheckCircleOutlined, EyeOutlined } from '@ant-design/icons';
import { ListPageTemplate, DetailDrawerTemplate, DRAWER_CONFIG } from '../../../../components/layout-templates';
import { UniTable } from '../../../../components/uni-table';
import { DepartmentFormModal } from '../components/DepartmentFormModal';
import {
  getDepartmentTree,
  getDepartmentByUuid,
  deleteDepartment,
  importDepartments,
  Department,
  DepartmentTreeItem,
} from '../../../../services/department';

const DepartmentListPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi, modal } = App.useApp();
  const actionRef = useRef<any>();

  const [stats, setStats] = useState({ totalCount: 0, activeCount: 0, userCount: 0 });
  const [modalVisible, setModalVisible] = useState(false);
  const [currentDepartmentUuid, setCurrentDepartmentUuid] = useState<string | null>(null);
  const [initialParentUuid, setInitialParentUuid] = useState<string | null>(null);

  const [deptTreeData, setDeptTreeData] = useState<DepartmentTreeItem[]>([]);
  const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [allDepts, setAllDepts] = useState<Department[]>([]);

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<Department | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const getAllKeys = (data: DepartmentTreeItem[]): string[] => {
    let keys: string[] = [];
    data.forEach((item) => {
      keys.push(item.uuid);
      if (item.children && item.children.length > 0) {
        keys.push(...getAllKeys(item.children));
      }
    });
    return keys;
  };

  const loadData = async (params: any, _sort: any, _filter: any, searchFormValues?: any) => {
    try {
      const keyword = searchFormValues?.keyword || searchFormValues?.name || searchFormValues?.code;
      const is_active =
        searchFormValues?.is_active !== undefined && searchFormValues?.is_active !== ''
          ? searchFormValues.is_active === 'true' || searchFormValues.is_active === true
          : undefined;

      const response = await getDepartmentTree({ keyword, is_active });

      let active = 0;
      let users = 0;
      const allKeys: string[] = [];
      const traverse = (nodes: DepartmentTreeItem[]) => {
        nodes.forEach((node) => {
          allKeys.push(node.uuid);
          if (node.is_active) active++;
          users += node.user_count || 0;
          if (node.children) traverse(node.children);
        });
      };
      traverse(response.items);

      setStats({ totalCount: response.total, activeCount: active, userCount: users });

      const flatDepts: Department[] = [];
      const flatten = (nodes: DepartmentTreeItem[]) => {
        nodes.forEach((node) => {
          const { children, ...rest } = node;
          flatDepts.push(rest as Department);
          if (children) flatten(children);
        });
      };
      flatten(response.items);
      setAllDepts(flatDepts);
      setDeptTreeData(response.items);

      if (expandedRowKeys.length === 0) {
        setExpandedRowKeys(allKeys);
      }

      return { data: response.items, success: true, total: response.total };
    } catch (error: any) {
      messageApi.error(error.message || t('common.loadFailed'));
      return { data: [], success: false, total: 0 };
    }
  };

  const handleCreate = (parentUuid?: string) => {
    setCurrentDepartmentUuid(null);
    setInitialParentUuid(parentUuid ?? null);
    setModalVisible(true);
  };

  const handleEdit = async (record: Department) => {
    setCurrentDepartmentUuid(record.uuid);
    setInitialParentUuid(null);
    setModalVisible(true);
  };

  const handleView = async (record: Department) => {
    try {
      setDetailLoading(true);
      setDrawerVisible(true);
      const detail = await getDepartmentByUuid(record.uuid);
      setDetailData(detail);
    } catch (error: any) {
      messageApi.error(error.message || t('common.loadFailed'));
    } finally {
      setDetailLoading(false);
    }
  };

  const checkCanDelete = (record: Department): { can: boolean; reason?: string } => {
    if ((record.children_count || 0) > 0) {
      return { can: false, reason: t('field.department.checkHasChildren') };
    }
    if ((record.position_count || 0) > 0) {
      return { can: false, reason: t('field.department.checkHasPositions') };
    }
    if ((record.user_count || 0) > 0) {
      return { can: false, reason: t('field.department.checkHasUsers') };
    }
    return { can: true };
  };

  const handleDelete = async (record: Department) => {
    try {
      await deleteDepartment(record.uuid);
      messageApi.success(t('pages.system.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.deleteFailed'));
    }
  };

  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('pages.system.selectFirst'));
      return;
    }

    const cannotDeleteNames: string[] = [];
    const canDeleteKeys: string[] = [];

    selectedRowKeys.forEach((key) => {
      const dept = allDepts.find((d) => d.uuid === key);
      if (dept) {
        const check = checkCanDelete(dept);
        if (!check.can) {
          cannotDeleteNames.push(`${dept.name} (${check.reason})`);
        } else {
          canDeleteKeys.push(dept.uuid);
        }
      }
    });

    if (cannotDeleteNames.length > 0) {
      modal.error({
        title: t('field.department.batchDeleteBlocked'),
        content: (
          <div>
            {t('field.department.batchDeleteBlockedList')}
            <ul style={{ marginTop: 8 }}>
              {cannotDeleteNames.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
            {t('field.department.batchDeleteBlockedHint')}
          </div>
        ),
      });
      return;
    }

    modal.confirm({
      title: t('common.confirm'),
      content: t('field.department.batchDeleteConfirm', { count: selectedRowKeys.length }),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      okType: 'danger',
      onOk: async () => {
        try {
          await Promise.all(canDeleteKeys.map((key) => deleteDepartment(key)));
          messageApi.success(t('pages.system.deleteSuccess'));
          setSelectedRowKeys([]);
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('pages.system.deleteFailed'));
          actionRef.current?.reload();
        }
      },
    });
  };

  const handleImport = async (data: any[][]) => {
    try {
      const result = await importDepartments(data);
      if (result.success_count > 0) {
        messageApi.success(t('field.department.importSuccess', { count: result.success_count }));
        actionRef.current?.reload();
      }
      if (result.failure_count > 0) {
        modal.error({
          title: t('field.department.importPartialFail'),
          content: (
            <List
              size="small"
              dataSource={result.errors}
              renderItem={(item) => (
                <List.Item>
                  {t('common.row')} {item.row}: {item.error}
                </List.Item>
              )}
            />
          ),
        });
      }
    } catch (error: any) {
      messageApi.error(error?.message || t('field.department.importFail'));
    }
  };

  const columns: ProColumns<Department>[] = [
    {
      title: t('field.department.name'),
      dataIndex: 'name',
      width: 250,
      fixed: 'left',
      render: (_, record) => (
        <Space>
          <span style={{ fontWeight: 500 }}>{record.name}</span>
          {(record.children_count || 0) > 0 && (
            <Tag color="blue" style={{ marginLeft: 4 }}>
              {t('field.department.childrenCount', { count: record.children_count })}
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: t('field.department.code'),
      dataIndex: 'code',
      width: 150,
      copyable: true,
    },
    {
      title: t('field.department.description'),
      dataIndex: 'description',
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: t('field.department.userCount'),
      dataIndex: 'user_count',
      width: 100,
      align: 'center',
      hideInSearch: true,
      render: (_, record) =>
        record.user_count ? (
          <Tag color="blue">{t('field.department.userCountTag', { count: record.user_count })}</Tag>
        ) : (
          '-'
        ),
    },
    {
      title: t('field.department.sortOrder'),
      dataIndex: 'sort_order',
      width: 80,
      valueType: 'digit',
      hideInSearch: true,
      sorter: (a, b) => a.sort_order - b.sort_order,
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
      sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    },
    {
      title: t('common.updatedAt'),
      dataIndex: 'updated_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: (a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime(),
    },
    {
      title: t('common.actions'),
      valueType: 'option',
      width: 220,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleView(record)}>
            {t('field.department.view')}
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            {t('field.department.edit')}
          </Button>
          <Button
            type="link"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => handleCreate(record.uuid)}
          >
            {t('field.department.addChild')}
          </Button>
          <Popconfirm
            title={t('field.department.deleteConfirm', { name: record.name })}
            description={t('field.department.deleteConfirmDesc')}
            onConfirm={() => handleDelete(record)}
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
            disabled={!checkCanDelete(record).can}
          >
            <Tooltip title={checkCanDelete(record).reason}>
              <Button
                type="link"
                size="small"
                danger
                icon={<DeleteOutlined />}
                disabled={!checkCanDelete(record).can}
              >
                {t('field.department.delete')}
              </Button>
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <ListPageTemplate
      statCards={[
        {
          title: t('field.department.totalCount'),
          value: stats.totalCount,
          prefix: <ApartmentOutlined />,
          valueStyle: { color: '#1890ff' },
        },
        {
          title: t('field.department.activeCount'),
          value: stats.activeCount,
          prefix: <CheckCircleOutlined />,
          valueStyle: { color: '#52c41a' },
        },
        {
          title: t('field.department.totalUserCount'),
          value: stats.userCount,
          prefix: <TeamOutlined />,
          valueStyle: { color: '#722ed1' },
        },
      ]}
    >
      <UniTable<Department>
        viewTypes={['table', 'help']}
        actionRef={actionRef}
        headerTitle={t('field.department.listTitle')}
        rowKey="uuid"
        columns={columns}
        request={loadData}
        showCreateButton
        createButtonText={t('field.department.createTitle')}
        onCreate={() => handleCreate()}
        showDeleteButton
        onDelete={handleBatchDelete}
        deleteButtonText={t('pages.system.batchDelete')}
        toolBarRender={() => [
          <Button
            key="toggleExpand"
            onClick={() => {
              if (expandedRowKeys.length > 0) {
                setExpandedRowKeys([]);
              } else {
                setExpandedRowKeys(getAllKeys(deptTreeData));
              }
            }}
          >
            {expandedRowKeys.length > 0 ? t('field.department.collapseAll') : t('field.department.expandAll')}
          </Button>,
        ]}
        showImportButton={true}
        onImport={handleImport}
        pagination={{
          defaultPageSize: 20,
          showSizeChanger: true,
          showQuickJumper: true,
        }}
        showAdvancedSearch={true}
        expandable={{
          expandedRowKeys,
          onExpandedRowsChange: (keys) => setExpandedRowKeys(keys as React.Key[]),
        }}
        rowSelection={{ selectedRowKeys, onChange: (keys) => setSelectedRowKeys(keys) }}
        search={{ labelWidth: 'auto' }}
        showQuickJumper={false}
      />

      <DepartmentFormModal
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setCurrentDepartmentUuid(null);
          setInitialParentUuid(null);
        }}
        editUuid={currentDepartmentUuid}
        initialParentUuid={initialParentUuid}
        onSuccess={() => actionRef.current?.reload()}
        deptTreeItems={deptTreeData}
      />

      <DetailDrawerTemplate
        title={t('field.department.detailTitle')}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        dataSource={detailData as any}
        columns={[
          { title: t('field.department.name'), dataIndex: 'name' },
          { title: t('field.department.code'), dataIndex: 'code' },
          {
            title: t('field.department.parentName'),
            dataIndex: ['parent', 'name'],
            span: 2,
            render: (_: any, record: any) => record?.parent_name || '-',
          },
          {
            title: t('field.role.status'),
            dataIndex: 'is_active',
            render: (_: any, entity: any) =>
              entity?.is_active ? t('field.role.enabled') : t('field.role.disabled'),
          },
          { title: t('field.department.userCount'), dataIndex: 'user_count' },
          { title: t('field.department.sortOrder'), dataIndex: 'sort_order' },
          { title: t('field.department.queryCode'), dataIndex: 'query_code' },
          { title: t('common.createdAt'), dataIndex: 'created_at', valueType: 'dateTime' },
          { title: t('common.updatedAt'), dataIndex: 'updated_at', valueType: 'dateTime' },
          { title: t('field.department.description'), dataIndex: 'description', span: 2 },
        ]}
      />
    </ListPageTemplate>
  );
};

export default DepartmentListPage;
