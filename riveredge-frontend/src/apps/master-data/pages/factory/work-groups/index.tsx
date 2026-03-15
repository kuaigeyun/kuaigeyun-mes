/**
 * 工作小组页面
 *
 * 提供工作小组的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';
import { ListPageTemplate, DetailDrawerTemplate, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { workGroupApi } from '../../../services/factory';
import { WorkGroupFormModal } from '../../../components/WorkGroupFormModal';
import type { WorkGroup } from '../../../types/factory';

const WorkGroupsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();

  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const [modalVisible, setModalVisible] = useState(false);
  const [editUuid, setEditUuid] = useState<string | null>(null);

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [workGroupDetail, setWorkGroupDetail] = useState<WorkGroup | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const handleCreate = () => {
    setEditUuid(null);
    setModalVisible(true);
  };

  useNewShortcut(handleCreate);

  const handleEdit = (record: WorkGroup) => {
    setEditUuid(record.uuid);
    setModalVisible(true);
  };

  const handleOpenDetail = async (record: WorkGroup) => {
    try {
      setDrawerVisible(true);
      setDetailLoading(true);
      const detail = await workGroupApi.get(record.uuid);
      setWorkGroupDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.workGroups.getDetailFailed'));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setWorkGroupDetail(null);
  };

  const handleDelete = async (record: WorkGroup) => {
    try {
      await workGroupApi.delete(record.uuid);
      messageApi.success(t('common.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.deleteFailed'));
    }
  };

  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('common.selectAtLeastOne'));
      return;
    }

    try {
      const uuids = selectedRowKeys.map((key) => String(key));
      const result = await workGroupApi.batchDelete(uuids);

      if (result.success) {
        messageApi.success(result.message || t('app.master-data.batchDeleteSuccess'));
      } else {
        messageApi.warning(result.message || t('app.master-data.batchDeletePartial'));
      }

      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.batchDeleteFailed'));
    }
  };

  const handleModalSuccess = () => {
    setModalVisible(false);
    setEditUuid(null);
    actionRef.current?.reload();
  };

  const columns: ProColumns<WorkGroup>[] = [
    {
      title: t('field.workGroup.code'),
      dataIndex: 'code',
      width: 150,
      fixed: 'left',
      ellipsis: true,
      copyable: true,
    },
    {
      title: t('field.workGroup.name'),
      dataIndex: 'name',
      width: 200,
      ellipsis: true,
    },
    {
      title: t('field.workGroup.members'),
      dataIndex: 'members',
      width: 280,
      ellipsis: true,
      hideInSearch: true,
      render: (_: React.ReactNode, record: WorkGroup) => {
        const members = record?.members ?? [];
        if (members.length === 0) return '-';
        return members
          .map((m: any) => `${m.employeeName ?? m.employee_name ?? m.employeeId ?? m.employee_id} (${m.performanceWeight ?? m.performance_weight ?? 1})`)
          .join('；');
      },
    },
    {
      title: t('field.workGroup.description'),
      dataIndex: 'description',
      width: 200,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: t('field.workGroup.isActive'),
      dataIndex: 'isActive',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: t('common.enabled'), status: 'Success' },
        false: { text: t('common.disabled'), status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record?.isActive ? 'success' : 'default'}>
          {record?.isActive ? t('common.enabled') : t('common.disabled')}
        </Tag>
      ),
    },
    {
      title: t('common.createdAt'),
      dataIndex: 'createdAt',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('common.actions'),
      valueType: 'option',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" onClick={() => handleOpenDetail(record)}>
            {t('field.customField.view')}
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            {t('field.customField.edit')}
          </Button>
          <Popconfirm
            title={t('app.master-data.workGroups.deleteConfirm')}
            description={t('app.master-data.workGroups.deleteDescription')}
            onConfirm={() => handleDelete(record)}
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              {t('field.customField.delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const detailColumns: ProDescriptionsItemProps<WorkGroup>[] = [
    { title: t('field.workGroup.code'), dataIndex: 'code' },
    { title: t('field.workGroup.name'), dataIndex: 'name' },
    { title: t('field.workGroup.description'), dataIndex: 'description', span: 2 },
    {
      title: t('field.workGroup.members'),
      dataIndex: 'members',
      render: (_: React.ReactNode, record: WorkGroup) => {
        const members = record?.members ?? [];
        if (members.length === 0) return '-';
        return (
          <div>
            {members.map((m: any, i: number) => (
              <div key={i}>
                {m.employeeName ?? m.employee_name ?? m.employeeId ?? m.employee_id} -{' '}
                {t('field.workGroup.performanceWeight')}: {m.performanceWeight ?? m.performance_weight ?? 1}
              </div>
            ))}
          </div>
        );
      },
      span: 2,
    },
    {
      title: t('field.workGroup.isActive'),
      dataIndex: 'isActive',
      render: (_: React.ReactNode, record: WorkGroup) => (
        <Tag color={record?.isActive ? 'success' : 'default'}>
          {record?.isActive ? t('common.enabled') : t('common.disabled')}
        </Tag>
      ),
      span: 2,
    },
    { title: t('common.createdAt'), dataIndex: 'createdAt', valueType: 'dateTime' },
    { title: t('common.updatedAt'), dataIndex: 'updatedAt', valueType: 'dateTime' },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<WorkGroup>
          actionRef={actionRef}
          columns={columns}
          viewTypes={['table', 'help']}
          defaultViewType="table"
          loadingDelay={200}
          request={async (params, _sort, _filter, searchFormValues) => {
            const apiParams: any = {
              skip: ((params.current || 1) - 1) * (params.pageSize || 20),
              limit: params.pageSize || 20,
            };

            if (
              searchFormValues?.isActive !== undefined &&
              searchFormValues.isActive !== '' &&
              searchFormValues.isActive !== null
            ) {
              apiParams.isActive = searchFormValues.isActive;
            }
            if (searchFormValues?.keyword) {
              apiParams.keyword = searchFormValues.keyword;
            }

            try {
              const result = await workGroupApi.list(apiParams);

              return {
                data: result,
                success: true,
                total: result.length,
              };
            } catch (error: any) {
              console.error('获取工作小组列表失败:', error);
              messageApi.error(error?.message || t('app.master-data.workGroups.listFetchFailed'));
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
          toolBarRender={() => [
            <Button key="create" type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              {t('field.workGroup.createTitle') + NEW_SHORTCUT_HINT}
            </Button>,
            <Popconfirm
              key="batchDelete"
              title={t('app.master-data.workGroups.batchDeleteConfirm')}
              description={t('app.master-data.workGroups.batchDeleteDescription', {
                count: selectedRowKeys.length,
              })}
              onConfirm={handleBatchDelete}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
              disabled={selectedRowKeys.length === 0}
            >
              <Button
                type="default"
                danger
                icon={<DeleteOutlined />}
                disabled={selectedRowKeys.length === 0}
              >
                {t('common.batchDelete')}
              </Button>
            </Popconfirm>,
          ]}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
        />
      </ListPageTemplate>

      <DetailDrawerTemplate<WorkGroup>
        title={t('field.workGroup.detailTitle')}
        open={drawerVisible}
        onClose={handleCloseDetail}
        dataSource={workGroupDetail || undefined}
        columns={detailColumns}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
      />

      <WorkGroupFormModal
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setEditUuid(null);
        }}
        editUuid={editUuid}
        onSuccess={handleModalSuccess}
      />
    </>
  );
};

export default WorkGroupsPage;
