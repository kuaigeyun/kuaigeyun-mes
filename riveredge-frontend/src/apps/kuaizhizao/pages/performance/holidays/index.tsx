/**
 * 假期管理页面
 *
 * 提供假期的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptionsItemType } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, DetailDrawerTemplate, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { holidayApi } from '../../../services/performance';
import { HolidayFormModal } from '../../../components/HolidayFormModal';
import type { Holiday } from '../../../types/performance';

const HolidaysPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentHolidayUuid, setCurrentHolidayUuid] = useState<string | null>(null);
  const [holidayDetail, setHolidayDetail] = useState<Holiday | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editUuid, setEditUuid] = useState<string | null>(null);

  const handleCreate = () => { setEditUuid(null); setModalVisible(true); };
  const handleEdit = (record: Holiday) => { setEditUuid(record.uuid); setModalVisible(true); };
  const handleDelete = async (record: Holiday) => {
    try {
      await holidayApi.delete(record.uuid);
      messageApi.success(t('common.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.deleteFailed'));
    }
  };

  const handleBatchDelete = (keys: React.Key[]) => {
    if (keys.length === 0) {
      messageApi.warning(t('common.selectToDelete'));
      return;
    }
    Modal.confirm({
      title: t('common.confirmBatchDelete'),
      content: t('common.confirmBatchDeleteContent', { count: keys.length }),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      okType: 'danger',
      onOk: async () => {
        try {
          let successCount = 0;
          let failCount = 0;
          const errors: string[] = [];
          for (const key of keys) {
            try {
              await holidayApi.delete(key.toString());
              successCount++;
            } catch (error: any) {
              failCount++;
              errors.push(error.message || t('common.deleteFailed'));
            }
          }
          if (successCount > 0) messageApi.success(t('common.batchDeleteSuccess', { count: successCount }));
          if (failCount > 0) messageApi.error(t('common.batchDeletePartial', { count: failCount, errors: errors.length > 0 ? '：' + errors.join('; ') : '' }));
          setSelectedRowKeys([]);
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('common.batchDeleteFailed'));
        }
      },
    });
  };

  const handleOpenDetail = async (record: Holiday) => {
    try {
      setCurrentHolidayUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      const detail = await holidayApi.get(record.uuid);
      setHolidayDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.holidays.getDetailFailed'));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleModalSuccess = () => { setModalVisible(false); setEditUuid(null); actionRef.current?.reload(); };
  const handleCloseDetail = () => { setDrawerVisible(false); setCurrentHolidayUuid(null); setHolidayDetail(null); };

  const columns: ProColumns<Holiday>[] = [
    { title: '假期名称', dataIndex: 'name', width: 200, fixed: 'left' },
    { title: '假期日期', dataIndex: 'holidayDate', width: 150, valueType: 'date', sorter: true },
    { title: '假期类型', dataIndex: 'holidayType', width: 150, hideInSearch: true },
    { title: '描述', dataIndex: 'description', ellipsis: true, hideInSearch: true },
    {
      title: '启用状态',
      dataIndex: 'isActive',
      width: 100,
      valueType: 'select',
      valueEnum: { true: { text: '启用', status: 'Success' }, false: { text: '禁用', status: 'Default' } },
      render: (_, record) => <Tag color={record?.isActive ? 'success' : 'default'}>{record?.isActive ? '启用' : '禁用'}</Tag>,
    },
    { title: '创建时间', dataIndex: 'createdAt', width: 180, valueType: 'dateTime', hideInSearch: true, sorter: true },
    {
      title: '操作',
      valueType: 'option',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" onClick={() => handleOpenDetail(record)}>详情</Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm title="确定要删除这个假期吗？" onConfirm={() => handleDelete(record)}>
            <Button type="link" danger size="small" icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const detailColumns: ProDescriptionsItemType<Holiday>[] = [
    { title: '假期名称', dataIndex: 'name' },
    { title: '假期日期', dataIndex: 'holidayDate', valueType: 'date' },
    { title: '假期类型', dataIndex: 'holidayType' },
    { title: '描述', dataIndex: 'description', span: 2 },
    { title: '启用状态', dataIndex: 'isActive', render: (_, record) => <Tag color={record?.isActive ? 'success' : 'default'}>{record?.isActive ? '启用' : '禁用'}</Tag> },
    { title: '创建时间', dataIndex: 'createdAt', valueType: 'dateTime' },
    { title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime' },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<Holiday>
          actionRef={actionRef}
          columns={columns}
          request={async (params, _sort, _filter, searchFormValues) => {
            const apiParams: any = { skip: ((params.current || 1) - 1) * (params.pageSize || 20), limit: params.pageSize || 20 };
            if (searchFormValues?.isActive !== undefined && searchFormValues.isActive !== '' && searchFormValues.isActive !== null) apiParams.isActive = searchFormValues.isActive;
            try {
              const result = await holidayApi.list(apiParams);
              return { data: result, success: true, total: result.length };
            } catch (error: any) {
              messageApi.error(error?.message || '获取假期列表失败');
              return { data: [], success: false, total: 0 };
            }
          }}
          rowKey="uuid"
          showAdvancedSearch={true}
          pagination={{ defaultPageSize: 20, showSizeChanger: true }}
          showCreateButton
          createButtonText="新建假期"
          onCreate={handleCreate}
          enableRowSelection
          onRowSelectionChange={setSelectedRowKeys}
          showDeleteButton
          onDelete={handleBatchDelete}
          deleteButtonText="批量删除"
        />
      </ListPageTemplate>
      <DetailDrawerTemplate<Holiday> title="假期详情" open={drawerVisible} onClose={handleCloseDetail} dataSource={holidayDetail || undefined} columns={detailColumns} loading={detailLoading} width={DRAWER_CONFIG.HALF_WIDTH} />
      <HolidayFormModal open={modalVisible} onClose={() => { setModalVisible(false); setEditUuid(null); }} editUuid={editUuid} onSuccess={handleModalSuccess} />
    </>
  );
};

export default HolidaysPage;
