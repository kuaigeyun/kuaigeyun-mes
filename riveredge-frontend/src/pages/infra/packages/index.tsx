/**
 * 套餐管理页面
 *
 * 用于管理平台套餐信息（查看、编辑、创建、删除）
 */

import { App, Button, Space, Modal, Popconfirm, Tag } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import React, { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getPackageList, deletePackage, type Package, TenantPlan } from '../../../services/tenant';
import { UniTable } from '../../../components/uni-table';
import PackageForm from './form';
import type { ActionType } from '@ant-design/pro-components';

/**
 * 套餐管理页面组件
 */
export default function PackageManagementPage() {
  const { message: messageApi } = App.useApp();
  const queryClient = useQueryClient();
  const actionRef = useRef<ActionType>();
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editFormData, setEditFormData] = useState<Package | null>(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // UniTable的request函数
  const handleRequest = async (
    params: any,
    sort: Record<string, 'ascend' | 'descend' | null>,
    filter: Record<string, React.ReactText[] | null>
  ) => {
    try {
      // 获取搜索参数（从 searchParamsRef 或 formRef 获取）
      const searchParams = params.searchFormValues || {};
      
      // 处理排序参数
      let sortField: string | undefined;
      let sortOrder: string | undefined;
      if (sort && Object.keys(sort).length > 0) {
        const sortKey = Object.keys(sort)[0];
        const sortValue = sort[sortKey];
        if (sortValue) {
          sortField = sortKey;
          sortOrder = sortValue === 'ascend' ? 'asc' : 'desc';
        }
      }
      
      // 构建请求参数
      const requestParams: any = {
        page: params.current || 1,
        pageSize: params.pageSize || 10,
      };
      
      // 添加搜索参数
      if (searchParams.name) {
        requestParams.name = searchParams.name;
      }
      if (searchParams.plan) {
        requestParams.plan = searchParams.plan;
      }
      if (searchParams.is_active !== undefined && searchParams.is_active !== null) {
        requestParams.is_active = searchParams.is_active;
      }
      if (searchParams.allow_pro_apps !== undefined && searchParams.allow_pro_apps !== null) {
        requestParams.allow_pro_apps = searchParams.allow_pro_apps;
      }
      
      // 添加排序参数
      if (sortField) {
        requestParams.sort = sortField;
      }
      if (sortOrder) {
        requestParams.order = sortOrder;
      }

      const result = await getPackageList(requestParams);

      // 后端返回的是 items 字段，不是 data
      return {
        data: result.items || [],
        success: true,
        total: result.total || 0,
      };
    } catch (error: any) {
      console.error('❌ 套餐列表查询失败:', error);
      messageApi.error(error?.message || '获取数据失败');
      return {
        data: [],
        success: false,
        total: 0,
      };
    }
  };

  // 删除套餐（支持单个和批量删除）
  const deleteMutation = useMutation({
    mutationFn: (packageIds: number[]) => {
      // 如果是单个删除，packageIds只有一个元素
      return Promise.all(packageIds.map(id => deletePackage(id)));
    },
    onSuccess: (_, packageIds) => {
      messageApi.success(`删除成功，共删除 ${packageIds.length} 个套餐`);
      queryClient.invalidateQueries({ queryKey: ['packages'] });
      setSelectedRowKeys([]); // 清空选中状态
      // 手动刷新表格
      actionRef.current?.reload();
    },
    onError: (error: any) => {
      messageApi.error(error?.message || '删除失败');
    },
  });

  /**
   * 处理编辑
   */
  const handleEdit = (record: Package) => {
    setEditFormData(record);
    setEditModalVisible(true);
  };

  /**
   * 处理创建
   */
  const handleCreate = () => {
    setCreateModalVisible(true);
  };

  /**
   * 处理保存
   */
  const handleSave = async () => {
    setEditModalVisible(false);
    setEditFormData(null);
    setCreateModalVisible(false);
    queryClient.invalidateQueries({ queryKey: ['packages'] });
    // 手动刷新表格
    actionRef.current?.reload();
  };

  /**
   * 处理单个删除（保留原有逻辑，用于行内删除按钮）
   */
  const handleSingleDelete = async (packageId: number) => {
    await deleteMutation.mutateAsync([packageId]);
  };

  /**
   * 处理行选择变化
   */
  const handleRowSelectionChange = (keys: React.Key[]) => {
    setSelectedRowKeys(keys);
  };

  /**
   * 处理批量删除（用于UniTable的删除按钮）
   */
  const handleBatchDelete = async (selectedRowKeys: React.Key[]) => {
    const packageIds = selectedRowKeys.map(key => parseInt(key.toString()));
    await deleteMutation.mutateAsync(packageIds);
  };


  // 套餐类型映射
  const planMap: Record<string, { text: string; color: string }> = {
    [TenantPlan.TRIAL]: { text: '体验套餐', color: 'blue' },
    [TenantPlan.BASIC]: { text: '基础版', color: 'green' },
    [TenantPlan.PROFESSIONAL]: { text: '专业版', color: 'orange' },
    [TenantPlan.ENTERPRISE]: { text: '企业版', color: 'red' },
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      sorter: true,
    },
    {
      title: '套餐名称',
      dataIndex: 'name',
      key: 'name',
      sorter: true,
      filterable: true,
    },
    {
      title: '套餐类型',
      dataIndex: 'plan',
      key: 'plan',
      sorter: true,
      render: (_: any, record: Package) => {
        const planInfo = planMap[record.plan] || { text: record.plan, color: 'default' };
        return <Tag color={planInfo.color}>{planInfo.text}</Tag>;
      },
    },
    {
      title: '用户数限制',
      dataIndex: 'max_users',
      key: 'max_users',
      sorter: true,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '存储空间(MB)',
      dataIndex: 'max_storage_mb',
      key: 'max_storage_mb',
      sorter: true,
      render: (value: number) => value?.toLocaleString() || '-',
    },
    {
      title: '允许PRO应用',
      dataIndex: 'allow_pro_apps',
      key: 'allow_pro_apps',
      render: (value: boolean) => (
        <Tag color={value ? 'success' : 'default'}>
          {value ? '是' : '否'}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (value: boolean) => (
        <Tag color={value ? 'success' : 'default'}>
          {value ? '激活' : '未激活'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      valueType: 'dateTime',
      sorter: true,
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: Package) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            size="small"
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            description={`确定要删除套餐"${record.name}"吗？`}
            onConfirm={() => handleSingleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              size="small"
              loading={deleteMutation.isPending}
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
        <UniTable<Package>
          actionRef={actionRef}
          columns={columns}
          request={handleRequest}
          rowKey="id"
          showAdvancedSearch={true}
          enableRowSelection={true}
          onRowSelectionChange={handleRowSelectionChange}
          showCreateButton={true}
          onCreate={handleCreate}
          showDeleteButton={true}
          onDelete={handleBatchDelete}
          defaultPageSize={10}
          showQuickJumper={true}
        />

      {/* 编辑弹窗 */}
      <Modal
        title="编辑套餐"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          setEditFormData(null);
        }}
        footer={null}
        size={600}
      >
        {editFormData && (
          <PackageForm
            initialValues={editFormData}
            onSubmit={handleSave}
            onCancel={() => {
              setEditModalVisible(false);
              setEditFormData(null);
            }}
          />
        )}
      </Modal>

      {/* 创建弹窗 */}
      <Modal
        title="新建套餐"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        footer={null}
        size={600}
      >
        <PackageForm
          onSubmit={handleSave}
          onCancel={() => setCreateModalVisible(false)}
        />
      </Modal>
    </>
  );
}
