/**
 * 超级管理员组织列表页面
 * 
 * 用于超级管理员查看和管理所有组织。
 * 支持组织注册审核、启用/禁用等功能。
 */

import React, { useRef } from 'react';
import { ProTable, ActionType, ProColumns } from '@ant-design/pro-components';
import { message, Popconfirm, Button, Tag, Space } from 'antd';
import { CheckOutlined, CloseOutlined, PlayCircleOutlined, PauseCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
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
  const actionRef = useRef<ActionType>();

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
    },
    {
      title: '域名',
      dataIndex: 'domain',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      valueType: 'select',
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
    },
    {
      title: '最大存储空间 (MB)',
      dataIndex: 'max_storage',
      width: 150,
      hideInSearch: true,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      valueType: 'dateTime',
      hideInSearch: true,
      width: 180,
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
    <ProTable<Tenant>
      headerTitle="组织列表（超级管理员）"
      actionRef={actionRef}
      rowKey="id"
      search={{
        labelWidth: 'auto',
      }}
      request={async (params) => {
        const result = await getTenantList({
          page: params.current || 1,
          page_size: params.pageSize || 10,
          status: params.status as TenantStatus,
          plan: params.plan as TenantPlan,
          keyword: params.keyword,
        });
        return {
          data: result.items,
          success: true,
          total: result.total,
        };
      }}
      columns={columns}
      pagination={{
        defaultPageSize: 10,
        showSizeChanger: true,
      }}
      scroll={{ x: 1200 }}
    />
  );
};

export default SuperAdminTenantList;

