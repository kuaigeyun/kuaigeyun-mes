/**
 * 租户列表页面
 * 
 * 用于展示租户列表，支持搜索、筛选、分页等功能。
 * 注意：此页面通常需要超级管理员权限。
 */

import React, { useRef } from 'react';
import { ProTable, ActionType, ProColumns } from '@ant-design/pro-components';
import { message, Popconfirm, Button, Tag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import {
  getTenantList,
  deleteTenant,
  activateTenant,
  deactivateTenant,
  Tenant,
  TenantStatus,
  TenantPlan,
} from '@/services/tenant';

/**
 * 租户状态标签映射
 */
const statusTagMap: Record<TenantStatus, { color: string; text: string }> = {
  [TenantStatus.ACTIVE]: { color: 'success', text: '激活' },
  [TenantStatus.INACTIVE]: { color: 'default', text: '未激活' },
  [TenantStatus.EXPIRED]: { color: 'warning', text: '已过期' },
  [TenantStatus.SUSPENDED]: { color: 'error', text: '已暂停' },
};

/**
 * 租户套餐标签映射
 */
const planTagMap: Record<TenantPlan, { color: string; text: string }> = {
  [TenantPlan.BASIC]: { color: 'default', text: '基础版' },
  [TenantPlan.PROFESSIONAL]: { color: 'processing', text: '专业版' },
  [TenantPlan.ENTERPRISE]: { color: 'success', text: '企业版' },
};

/**
 * 租户列表页面组件
 */
const TenantList: React.FC = () => {
  const navigate = useNavigate();
  const actionRef = useRef<ActionType>();

  /**
   * 处理删除租户
   */
  const handleDelete = async (tenantId: number) => {
    try {
      await deleteTenant(tenantId);
      message.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      message.error(error.message || '删除失败');
    }
  };

  /**
   * 处理激活租户
   */
  const handleActivate = async (tenantId: number) => {
    try {
      await activateTenant(tenantId);
      message.success('激活成功');
      actionRef.current?.reload();
    } catch (error: any) {
      message.error(error.message || '激活失败');
    }
  };

  /**
   * 处理停用租户
   */
  const handleDeactivate = async (tenantId: number) => {
    try {
      await deactivateTenant(tenantId);
      message.success('停用成功');
      actionRef.current?.reload();
    } catch (error: any) {
      message.error(error.message || '停用失败');
    }
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
      title: '租户名称',
      dataIndex: 'name',
      width: 200,
    },
    {
      title: '域名',
      dataIndex: 'domain',
      width: 150,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      valueType: 'select',
      valueEnum: {
        [TenantStatus.ACTIVE]: { text: '激活', status: 'Success' },
        [TenantStatus.INACTIVE]: { text: '未激活', status: 'Default' },
        [TenantStatus.EXPIRED]: { text: '已过期', status: 'Warning' },
        [TenantStatus.SUSPENDED]: { text: '已暂停', status: 'Error' },
      },
      render: (_, record) => {
        const statusInfo = statusTagMap[record.status];
        return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
      },
    },
    {
      title: '套餐',
      dataIndex: 'plan',
      width: 120,
      valueType: 'select',
      valueEnum: {
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
      title: '最大存储（MB）',
      dataIndex: 'max_storage',
      width: 150,
      hideInSearch: true,
    },
    {
      title: '过期时间',
      dataIndex: 'expires_at',
      width: 180,
      hideInSearch: true,
      valueType: 'dateTime',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 180,
      hideInSearch: true,
      valueType: 'dateTime',
    },
    {
      title: '操作',
      valueType: 'option',
      width: 200,
      fixed: 'right',
      render: (_, record) => [
        <Button
          key="edit"
          type="link"
          size="small"
          onClick={() => navigate(`/tenant/form?id=${record.id}`)}
        >
          编辑
        </Button>,
        <Button
          key="detail"
          type="link"
          size="small"
          onClick={() => navigate(`/tenant/detail?id=${record.id}`)}
        >
          详情
        </Button>,
        record.status === TenantStatus.ACTIVE ? (
          <Popconfirm
            key="deactivate"
            title="确定要停用此租户吗？"
            onConfirm={() => handleDeactivate(record.id)}
          >
            <Button type="link" size="small" danger>
              停用
            </Button>
          </Popconfirm>
        ) : (
          <Button
            key="activate"
            type="link"
            size="small"
            onClick={() => handleActivate(record.id)}
          >
            激活
          </Button>
        ),
        <Popconfirm
          key="delete"
          title="确定要删除此租户吗？删除后无法恢复。"
          onConfirm={() => handleDelete(record.id)}
        >
          <Button type="link" size="small" danger>
            删除
          </Button>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <ProTable<Tenant>
      headerTitle="租户列表"
      actionRef={actionRef}
      columns={columns}
      request={async (params) => {
        const result = await getTenantList({
          page: params.current || 1,
          page_size: params.pageSize || 10,
          status: params.status as TenantStatus,
          plan: params.plan as TenantPlan,
          keyword: params.keyword as string,
        });
        return {
          data: result.items,
          success: true,
          total: result.total,
        };
      }}
      rowKey="id"
      search={{
        labelWidth: 'auto',
      }}
      pagination={{
        defaultPageSize: 10,
        showSizeChanger: true,
        showQuickJumper: true,
      }}
      toolBarRender={() => [
        <Button
          key="add"
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/tenant/form')}
        >
          新建租户
        </Button>,
      ]}
    />
  );
};

export default TenantList;

