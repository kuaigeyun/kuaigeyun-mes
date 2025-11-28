/**
 * 超级管理员组织列表页面
 * 
 * 用于超级管理员查看和管理所有组织。
 * 支持组织注册审核、启用/禁用等功能。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { message, Popconfirm, Button, Tag, Space } from 'antd';
import { CheckOutlined, CloseOutlined, PlayCircleOutlined, PauseCircleOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { UnifiedProTable } from '@/components/UnifiedProTable';
import {
  getTenantList,
  Tenant,
  TenantStatus,
  TenantPlan,
  activateTenant,
  deactivateTenant,
} from '@/services/tenant';
// 使用 apiRequest 统一处理 HTTP 请求

// @ts-ignore
import { apiRequest } from '@/services/api';

/**
 * 组织状态标签映射
 */
const statusTagMap: Record<TenantStatus, { color: string; text: string }> = {
  [TenantStatus.ACTIVE]: { color: 'success', text: '激活' },
  [TenantStatus.INACTIVE]: { color: 'default', text: '未激活' },
  [TenantStatus.EXPIRED]: { color: 'warning', text: '已过期' },
  [TenantStatus.SUSPENDED]: { color: 'error', text: '已暂停' },
};

/**
 * 组织套餐标签映射
 */
const planTagMap: Record<TenantPlan, { color: string; text: string }> = {
  [TenantPlan.TRIAL]: { color: 'default', text: '体验套餐' },
  [TenantPlan.BASIC]: { color: 'blue', text: '基础版' },
  [TenantPlan.PROFESSIONAL]: { color: 'purple', text: '专业版' },
  [TenantPlan.ENTERPRISE]: { color: 'gold', text: '企业版' },
};

/**
 * 审核通过组织注册
 * 
 * @param tenantId - 组织 ID
 */
const approveTenant = async (tenantId: number) => {
  try {
    await apiRequest(`/superadmin/tenants/${tenantId}/approve`, {
      method: 'POST',
    });
    message.success('审核通过成功');
    return true;
  } catch (error: any) {
    message.error(error.message || '审核通过失败');
    return false;
  }
};

/**
 * 审核拒绝组织注册
 * 
 * @param tenantId - 组织 ID
 * @param reason - 拒绝原因
 */
const rejectTenant = async (tenantId: number, reason?: string) => {
  try {
    await apiRequest(`/superadmin/tenants/${tenantId}/reject`, {
      method: 'POST',
      data: { reason },
    });
    message.success('审核拒绝成功');
    return true;
  } catch (error: any) {
    message.error(error.message || '审核拒绝失败');
    return false;
  }
};

/**
 * 超级管理员组织列表页面组件
 */
const SuperAdminTenantList: React.FC = () => {
  const navigate = useNavigate();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  /**
   * 处理导入数据
   */
  const handleImport = (data: any[][]) => {
    console.log('导入的数据:', data);
    message.info(`导入功能开发中，共 ${data.length} 行数据`);
    // TODO: 实现导入功能
    // 例如：调用后端 API 批量创建组织
    // await batchCreateTenants(data);
  };

  /**
   * 处理导出数据
   */
  const handleExport = (
    type: 'selected' | 'currentPage' | 'all',
    selectedRowKeys?: React.Key[],
    currentPageData?: Tenant[]
  ) => {
    let exportInfo = '';
    switch (type) {
      case 'selected':
        exportInfo = `选中的 ${selectedRowKeys?.length || 0} 条数据`;
        break;
      case 'currentPage':
        exportInfo = `当前页的 ${currentPageData?.length || 0} 条数据`;
        break;
      case 'all':
        exportInfo = '全部数据';
        break;
    }
    message.info(`导出功能开发中，将导出：${exportInfo}`);
    // TODO: 实现导出功能
    // 根据 type 调用不同的导出逻辑
    // - selected: 导出 selectedRowKeys 对应的数据
    // - currentPage: 导出 currentPageData
    // - all: 调用 API 获取全部数据并导出
  };

  /**
   * 处理新建
   */
  const handleCreate = () => {
    navigate('/superadmin/tenants/create');
  };

  /**
   * 处理修改
   */
  const handleEdit = (keys: React.Key[]) => {
    if (keys.length === 1) {
      navigate(`/superadmin/tenants/${keys[0]}`);
    }
  };

  /**
   * 处理删除
   */
  const handleDelete = async (keys: React.Key[]) => {
    if (keys.length === 0) {
      message.warning('请先选择要删除的组织');
      return;
    }
    message.info(`删除功能开发中，将删除 ${keys.length} 个组织`);
    // TODO: 实现删除功能
    // await batchDeleteTenants(keys);
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<Tenant>[] = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 80,
      hideInSearch: true,
    },
    {
      title: '组织名称',
      dataIndex: 'name',
      ellipsis: true,
      sorter: true,
      responsive: ['md'],
      fieldProps: {
        // 自动完成功能：从后端获取组织名称选项（暂时移除，先完成基础功能）
        // autoCompleteApi: async (keyword: string) => {
        //   if (!keyword || keyword.length < 1) {
        //     return [];
        //   }
        //   try {
        //     const result = await getTenantList(
        //       {
        //         page: 1,
        //         page_size: 20,
        //         name: keyword,
        //       },
        //       true // 超级管理员接口
        //     );
        //     return result.items.map((tenant) => ({
        //       label: `${tenant.name} (${tenant.domain})`,
        //       value: tenant.name,
        //     }));
        //   } catch (error) {
        //     console.error('获取组织名称选项失败:', error);
        //     return [];
        //   }
        // },
      },
    },
    {
      title: '域名',
      dataIndex: 'domain',
      ellipsis: true,
      sorter: true,
      responsive: ['md'],
      fieldProps: {
        // 自动完成功能：从后端获取域名选项（暂时移除，先完成基础功能）
        // autoCompleteApi: async (keyword: string) => {
        //   if (!keyword || keyword.length < 1) {
        //     return [];
        //   }
        //   try {
        //     const result = await getTenantList(
        //       {
        //         page: 1,
        //         page_size: 20,
        //         domain: keyword,
        //       },
        //       true // 超级管理员接口
        //     );
        //     return result.items.map((tenant) => ({
        //       label: `${tenant.domain} (${tenant.name})`,
        //       value: tenant.domain,
        //     }));
        //   } catch (error) {
        //     console.error('获取域名选项失败:', error);
        //     return [];
        //   }
        // },
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      valueType: 'select',
      sorter: true,
      valueEnum: {
        [TenantStatus.ACTIVE]: { text: '激活' },
        [TenantStatus.INACTIVE]: { text: '未激活' },
        [TenantStatus.EXPIRED]: { text: '已过期' },
        [TenantStatus.SUSPENDED]: { text: '已暂停' },
      },
      render: (_, record) => {
        const statusInfo = statusTagMap[record.status];
        return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
      },
    },
    {
      title: '套餐',
      dataIndex: 'plan',
      valueType: 'select',
      sorter: true,
      valueEnum: {
        [TenantPlan.TRIAL]: { text: '体验套餐' },
        [TenantPlan.BASIC]: { text: '基础版' },
        [TenantPlan.PROFESSIONAL]: { text: '专业版' },
        [TenantPlan.ENTERPRISE]: { text: '企业版' },
      },
      render: (_, record) => {
        const planInfo = planTagMap[record.plan];
        return <Tag color={planInfo.color}>{planInfo.text}</Tag>;
      },
    },
    {
      title: '最大用户数',
      dataIndex: 'max_users',
      width: 120,
      hideInSearch: true,
      sorter: true,
      responsive: ['lg'],
    },
    {
      title: '存储空间 (MB)',
      dataIndex: 'max_storage',
      width: 150,
      hideInSearch: true,
      sorter: true,
      responsive: ['lg'],
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      valueType: 'dateTime',
      hideInSearch: true,
      width: 180,
      sorter: true,
      responsive: ['xl'],
    },
    {
      title: '操作',
      valueType: 'option',
      width: 300,
      fixed: 'right',
      render: (_, record) => {
        const isInactive = record.status === TenantStatus.INACTIVE;
        const isActive = record.status === TenantStatus.ACTIVE;
        const isSuspended = record.status === TenantStatus.SUSPENDED;

        return (
          <Space>
            <Button
              type="link"
              size="small"
              onClick={() => {
                navigate(`/operations/tenants/detail?id=${record.id}`);
              }}
            >
              详情
            </Button>
            {isInactive && (
              <Popconfirm
                title="确定要审核通过此组织吗？"
                onConfirm={async () => {
                  const success = await approveTenant(record.id);
                  if (success) {
                    actionRef.current?.reload();
                  }
                }}
              >
                <Button type="link" size="small" icon={<CheckOutlined />}>
                  审核通过
                </Button>
              </Popconfirm>
            )}
            {isInactive && (
              <Popconfirm
                title="确定要拒绝此组织注册吗？"
                onConfirm={async () => {
                  const success = await rejectTenant(record.id);
                  if (success) {
                    actionRef.current?.reload();
                  }
                }}
              >
                <Button type="link" size="small" danger icon={<CloseOutlined />}>
                  审核拒绝
                </Button>
              </Popconfirm>
            )}
            {isSuspended && (
              <Popconfirm
                title="确定要激活此组织吗？"
                onConfirm={async () => {
                  const success = await activateTenant(record.id);
                  if (success) {
                    actionRef.current?.reload();
                  }
                }}
              >
                <Button type="link" size="small" icon={<PlayCircleOutlined />}>
                  激活
                </Button>
              </Popconfirm>
            )}
            {isActive && (
              <Popconfirm
                title="确定要停用此组织吗？"
                onConfirm={async () => {
                  const success = await deactivateTenant(record.id);
                  if (success) {
                    actionRef.current?.reload();
                  }
                }}
              >
                <Button type="link" size="small" danger icon={<PauseCircleOutlined />}>
                  停用
                </Button>
              </Popconfirm>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <UnifiedProTable<Tenant>
      actionRef={actionRef}
      columns={columns}
      rowKey="id"
      enableRowSelection={true}
      onRowSelectionChange={(keys) => {
        setSelectedRowKeys(keys);
      }}
      showCreateButton={true}
      onCreate={handleCreate}
      showEditButton={true}
      onEdit={handleEdit}
      showDeleteButton={true}
      onDelete={handleDelete}
      showImportButton={true}
      onImport={handleImport}
      showExportButton={true}
      onExport={handleExport}
      viewTypes={['table', 'card', 'kanban', 'stats']}
      defaultViewType="table"
      request={async (params, sort, _filter, searchFormValues) => {
        // 处理排序参数
        let sortField: string | undefined;
        let sortOrder: 'asc' | 'desc' | undefined;
        
        if (sort && Object.keys(sort).length > 0) {
          // 获取第一个排序字段
          const firstSortKey = Object.keys(sort)[0];
          const firstSortValue = sort[firstSortKey];
          sortField = firstSortKey;
          sortOrder = firstSortValue === 'ascend' ? 'asc' : 'desc';
        }

        // 处理搜索参数
        const apiParams: any = {
          page: params.current || 1,
          page_size: params.pageSize || 10,
          sort: sortField,
          order: sortOrder,
        };
        
        // 状态和套餐筛选
        // ⭐ 修复：确保只有明确选择的状态才会被传递，避免意外过滤
        if (searchFormValues?.status && searchFormValues.status !== '' && searchFormValues.status !== undefined && searchFormValues.status !== null) {
          apiParams.status = searchFormValues.status as TenantStatus;
        }
        if (searchFormValues?.plan && searchFormValues.plan !== '' && searchFormValues.plan !== undefined && searchFormValues.plan !== null) {
          apiParams.plan = searchFormValues.plan as TenantPlan;
        }
        
        // 搜索条件处理：name 和 domain 使用模糊搜索
        if (searchFormValues?.name) {
          apiParams.name = searchFormValues.name as string;
        }
        if (searchFormValues?.domain) {
          apiParams.domain = searchFormValues.domain as string;
        }

        const result = await getTenantList(
          apiParams,
          true  // 超级管理员接口
        );

        return {
          data: result.items,
          success: true,
          total: result.total,
        };
      }}
      scroll={{ x: 1200 }}
    />
  );
};

export default SuperAdminTenantList;

