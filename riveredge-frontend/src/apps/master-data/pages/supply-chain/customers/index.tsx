/**
 * 客户管理页面
 * 
 * 提供客户的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptionsItemType } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, DetailDrawerTemplate, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { customerApi } from '../../../services/supply-chain';
import { CustomerFormModal } from '../../../components/CustomerFormModal';
import type { Customer } from '../../../types/supply-chain';

/**
 * 客户管理列表页面组件
 */
const CustomersPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentCustomerUuid, setCurrentCustomerUuid] = useState<string | null>(null);
  const [customerDetail, setCustomerDetail] = useState<Customer | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑客户）
  const [modalVisible, setModalVisible] = useState(false);
  const [editUuid, setEditUuid] = useState<string | null>(null);

  /**
   * 处理新建客户
   */
  const handleCreate = () => {
    setEditUuid(null);
    setModalVisible(true);
  };

  /**
   * 处理编辑客户
   */
  const handleEdit = (record: Customer) => {
    setEditUuid(record.uuid);
    setModalVisible(true);
  };

  /**
   * 处理删除客户
   */
  const handleDelete = async (record: Customer) => {
    try {
      await customerApi.delete(record.uuid);
      messageApi.success(t('common.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.deleteFailed'));
    }
  };

  /**
   * 处理批量删除客户
   */
  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('common.selectToDelete'));
      return;
    }

    Modal.confirm({
      title: t('common.confirmBatchDelete'),
      content: t('common.confirmBatchDeleteContent', { count: selectedRowKeys.length }),
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
              await customerApi.delete(key.toString());
              successCount++;
            } catch (error: any) {
              failCount++;
              errors.push(error.message || t('common.deleteFailed'));
            }
          }

          if (successCount > 0) {
            messageApi.success(t('common.batchDeleteSuccess', { count: successCount }));
          }
          if (failCount > 0) {
            messageApi.error(t('common.batchDeletePartial', { count: failCount, errors: errors.length > 0 ? '：' + errors.join('; ') : '' }));
          }

          setSelectedRowKeys([]);
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('common.batchDeleteFailed'));
        }
      },
    });
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: Customer) => {
    try {
      setCurrentCustomerUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await customerApi.get(record.uuid);
      setCustomerDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.customers.getDetailFailed'));
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理关闭详情
   */
  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setCurrentCustomerUuid(null);
    setCustomerDetail(null);
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setEditUuid(null);
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<Customer>[] = [
    {
      title: '客户编码',
      dataIndex: 'code',
      width: 150,
      fixed: 'left',
    },
    {
      title: '客户名称',
      dataIndex: 'name',
      width: 200,
    },
    {
      title: '简称',
      dataIndex: 'shortName',
      width: 150,
      hideInSearch: true,
    },
    {
      title: '联系人',
      dataIndex: 'contactPerson',
      width: 120,
      hideInSearch: true,
    },
    {
      title: '电话',
      dataIndex: 'phone',
      width: 150,
      hideInSearch: true,
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      width: 200,
      hideInSearch: true,
    },
    {
      title: '分类',
      dataIndex: 'category',
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
        <Tag color={(record?.isActive ?? (record as any)?.is_active) ? 'success' : 'default'}>
          {(record?.isActive ?? (record as any)?.is_active) ? '启用' : '禁用'}
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
            onClick={() => handleOpenDetail(record)}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个客户吗？"
            onConfirm={() => handleDelete(record)}
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

  // 详情列定义
  const detailColumns: ProDescriptionsItemType<Customer>[] = [
    {
      title: '客户编码',
      dataIndex: 'code',
    },
    {
      title: '客户名称',
      dataIndex: 'name',
    },
    {
      title: '简称',
      dataIndex: 'shortName',
    },
    {
      title: '联系人',
      dataIndex: 'contactPerson',
    },
    {
      title: '电话',
      dataIndex: 'phone',
    },
    {
      title: '邮箱',
      dataIndex: 'email',
    },
    {
      title: '地址',
      dataIndex: 'address',
      span: 2,
    },
    {
      title: '分类',
      dataIndex: 'category',
    },
    {
      title: '启用状态',
      dataIndex: 'isActive',
      render: (_, record) => (
        <Tag color={(record?.isActive ?? (record as any)?.is_active) ? 'success' : 'default'}>
          {(record?.isActive ?? (record as any)?.is_active) ? '启用' : '禁用'}
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
  ];

  return (
    <>
      <ListPageTemplate>
      <UniTable<Customer>
        actionRef={actionRef}
        columns={columns}
        request={async (params, sort, _filter, searchFormValues) => {
          // 处理搜索参数
          const apiParams: any = {
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize || 20,
          };
          
          // 启用状态筛选
          if (searchFormValues?.isActive !== undefined && searchFormValues.isActive !== '' && searchFormValues.isActive !== null) {
            apiParams.isActive = searchFormValues.isActive;
          }
          
          // 分类筛选
          if (searchFormValues?.category !== undefined && searchFormValues.category !== '' && searchFormValues.category !== null) {
            apiParams.category = searchFormValues.category;
          }
          
          try {
            const result = await customerApi.list(apiParams);
            return {
              data: result,
              success: true,
              total: result.length,
            };
          } catch (error: any) {
            console.error('获取客户列表失败:', error);
            messageApi.error(error?.message || '获取客户列表失败');
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
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            新建客户
          </Button>,
          <Button
            key="batch-delete"
            danger
            icon={<DeleteOutlined />}
            disabled={selectedRowKeys.length === 0}
            onClick={handleBatchDelete}
          >
            批量删除
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />
      </ListPageTemplate>

      {/* 详情 Drawer */}
      <DetailDrawerTemplate<Customer>
        title="客户详情"
        open={drawerVisible}
        onClose={handleCloseDetail}
        dataSource={customerDetail || undefined}
        columns={detailColumns}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
      />

      {/* 创建/编辑客户 Modal */}
      <CustomerFormModal
        open={modalVisible}
        onClose={handleCloseModal}
        editUuid={editUuid}
        onSuccess={() => actionRef.current?.reload()}
      />
    </>
  );
};

export default CustomersPage;
