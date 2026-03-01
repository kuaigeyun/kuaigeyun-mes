/**
 * 供应商管理页面
 * 
 * 提供供应商的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptionsItemType } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, DetailDrawerTemplate, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { supplierApi } from '../../../services/supply-chain';
import { SupplierFormModal } from '../../../components/SupplierFormModal';
import type { Supplier } from '../../../types/supply-chain';

/**
 * 供应商管理列表页面组件
 */
const SuppliersPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentSupplierUuid, setCurrentSupplierUuid] = useState<string | null>(null);
  const [supplierDetail, setSupplierDetail] = useState<Supplier | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑供应商）
  const [modalVisible, setModalVisible] = useState(false);
  const [editUuid, setEditUuid] = useState<string | null>(null);

  /**
   * 处理新建供应商
   */
  const handleCreate = () => {
    setEditUuid(null);
    setModalVisible(true);
  };

  /**
   * 处理编辑供应商
   */
  const handleEdit = (record: Supplier) => {
    setEditUuid(record.uuid);
    setModalVisible(true);
  };

  /**
   * 处理删除供应商
   */
  const handleDelete = async (record: Supplier) => {
    try {
      await supplierApi.delete(record.uuid);
      messageApi.success(t('common.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.deleteFailed'));
    }
  };

  /**
   * 处理批量删除供应商
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
              await supplierApi.delete(key.toString());
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
  const handleOpenDetail = async (record: Supplier) => {
    try {
      setCurrentSupplierUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await supplierApi.get(record.uuid);
      setSupplierDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.suppliers.getDetailFailed'));
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理关闭详情
   */
  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setCurrentSupplierUuid(null);
    setSupplierDetail(null);
  };

  const handleModalSuccess = () => {
    setModalVisible(false);
    setEditUuid(null);
    actionRef.current?.reload();
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<Supplier>[] = [
    {
      title: t('field.supplier.code'),
      dataIndex: 'code',
      width: 150,
      fixed: 'left',
    },
    {
      title: t('field.supplier.name'),
      dataIndex: 'name',
      width: 200,
    },
    {
      title: t('field.supplier.shortName'),
      dataIndex: 'shortName',
      width: 150,
      hideInSearch: true,
    },
    {
      title: t('field.supplier.contactPerson'),
      dataIndex: 'contactPerson',
      width: 120,
      hideInSearch: true,
    },
    {
      title: t('field.supplier.phone'),
      dataIndex: 'phone',
      width: 150,
      hideInSearch: true,
    },
    {
      title: t('field.supplier.email'),
      dataIndex: 'email',
      width: 200,
      hideInSearch: true,
    },
    {
      title: t('field.supplier.category'),
      dataIndex: 'category',
      width: 120,
      hideInSearch: true,
    },
    {
      title: t('app.master-data.warehouses.status'),
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
      title: t('app.master-data.warehouses.createTime'),
      dataIndex: 'createdAt',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('app.master-data.warehouses.action'),
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
            title={t('app.master-data.suppliers.deleteConfirm')}
            onConfirm={() => handleDelete(record)}
          >
            <Button
              type="link"
              danger
              size="small"
              icon={<DeleteOutlined />}
            >
              {t('field.customField.delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 详情列定义
  const detailColumns: ProDescriptionsItemType<Supplier>[] = [
    {
      title: t('field.supplier.code'),
      dataIndex: 'code',
    },
    {
      title: t('field.supplier.name'),
      dataIndex: 'name',
    },
    {
      title: t('field.supplier.shortName'),
      dataIndex: 'shortName',
    },
    {
      title: t('field.supplier.contactPerson'),
      dataIndex: 'contactPerson',
    },
    {
      title: t('field.supplier.phone'),
      dataIndex: 'phone',
    },
    {
      title: t('field.supplier.email'),
      dataIndex: 'email',
    },
    {
      title: t('field.supplier.address'),
      dataIndex: 'address',
      span: 2,
    },
    {
      title: t('field.supplier.category'),
      dataIndex: 'category',
    },
    {
      title: t('app.master-data.warehouses.status'),
      dataIndex: 'isActive',
      render: (_, record) => (
        <Tag color={record?.isActive ? 'success' : 'default'}>
          {record?.isActive ? t('common.enabled') : t('common.disabled')}
        </Tag>
      ),
    },
    {
      title: t('app.master-data.warehouses.createTime'),
      dataIndex: 'createdAt',
      valueType: 'dateTime',
    },
    {
      title: t('app.master-data.warehouses.updateTime'),
      dataIndex: 'updatedAt',
      valueType: 'dateTime',
    },
  ];

  return (
    <>
      <ListPageTemplate>
      <UniTable<Supplier>
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

          // 搜索参数处理
          if (searchFormValues?.code && searchFormValues.code.trim()) {
            apiParams.code = searchFormValues.code.trim();
          }

          if (searchFormValues?.name && searchFormValues.name.trim()) {
            apiParams.name = searchFormValues.name.trim();
          }

          // 如果有关键词搜索，传递给后端
          if (searchFormValues?.keyword && searchFormValues.keyword.trim()) {
            apiParams.keyword = searchFormValues.keyword.trim();
          }
          
          try {
            const result = await supplierApi.list(apiParams);
            return {
              data: result,
              success: true,
              total: result.length,
            };
          } catch (error: any) {
            console.error('获取供应商列表失败:', error);
            messageApi.error(error?.message || t('app.master-data.suppliers.getListFailed'));
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
            {t('app.master-data.suppliers.create')}
          </Button>,
          <Button
            key="batch-delete"
            danger
            icon={<DeleteOutlined />}
            disabled={selectedRowKeys.length === 0}
            onClick={handleBatchDelete}
          >
            {t('common.batchDelete')}
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />
      </ListPageTemplate>

      {/* 详情 Drawer */}
      <DetailDrawerTemplate<Supplier>
        title={t('app.master-data.suppliers.detailTitle')}
        open={drawerVisible}
        onClose={handleCloseDetail}
        dataSource={supplierDetail || undefined}
        columns={detailColumns}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
      />

      {/* 创建/编辑供应商 Modal */}
      <SupplierFormModal
        open={modalVisible}
        onClose={() => { setModalVisible(false); setEditUuid(null); }}
        editUuid={editUuid}
        onSuccess={handleModalSuccess}
      />
    </>
  );
};

export default SuppliersPage;
