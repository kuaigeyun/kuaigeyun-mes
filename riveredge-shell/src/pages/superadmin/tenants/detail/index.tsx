/**
 * 超级管理员租户详情页面
 * 
 * 用于超级管理员查看租户详细信息。
 */

import React, { useEffect, useState } from 'react';
import { ProDescriptions } from '@ant-design/pro-components';
import { PageContainer } from '@ant-design/pro-components';
import { Button, Tag, message, Space } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  getTenantById,
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
  [TenantPlan.BASIC]: { color: 'blue', text: '基础版' },
  [TenantPlan.PROFESSIONAL]: { color: 'purple', text: '专业版' },
  [TenantPlan.ENTERPRISE]: { color: 'gold', text: '企业版' },
};

/**
 * 超级管理员租户详情页面组件
 */
const SuperAdminTenantDetail: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get('id');
  const [loading, setLoading] = useState(false);
  const [tenant, setTenant] = useState<Tenant | null>(null);

  /**
   * 加载租户数据
   */
  useEffect(() => {
    if (tenantId) {
      loadTenant();
    }
  }, [tenantId]);

  const loadTenant = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const data = await getTenantById(Number(tenantId));
      setTenant(data);
    } catch (error: any) {
      message.error(error.message || '加载租户信息失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 审核通过租户注册
   */
  const handleApprove = async () => {
    if (!tenantId) return;
    try {
      await apiRequest(`/api/v1/superadmin/tenants/${tenantId}/approve`, {
        method: 'POST',
      });
      message.success('审核通过成功');
      loadTenant();
    } catch (error: any) {
      message.error(error.message || '审核通过失败');
    }
  };

  /**
   * 审核拒绝租户注册
   */
  const handleReject = async () => {
    if (!tenantId) return;
    try {
      await apiRequest(`/api/v1/superadmin/tenants/${tenantId}/reject`, {
        method: 'POST',
      });
      message.success('审核拒绝成功');
      loadTenant();
    } catch (error: any) {
      message.error(error.message || '审核拒绝失败');
    }
  };

  /**
   * 激活租户
   */
  const handleActivate = async () => {
    if (!tenantId) return;
    try {
      await activateTenant(Number(tenantId));
      message.success('激活成功');
      loadTenant();
    } catch (error: any) {
      message.error(error.message || '激活失败');
    }
  };

  /**
   * 停用租户
   */
  const handleDeactivate = async () => {
    if (!tenantId) return;
    try {
      await deactivateTenant(Number(tenantId));
      message.success('停用成功');
      loadTenant();
    } catch (error: any) {
      message.error(error.message || '停用失败');
    }
  };

  if (!tenant) {
    return <PageContainer loading={loading}>租户不存在</PageContainer>;
  }

  const isInactive = tenant.status === TenantStatus.INACTIVE;
  const isActive = tenant.status === TenantStatus.ACTIVE;
  const isSuspended = tenant.status === TenantStatus.SUSPENDED;

  return (
    <PageContainer
      title="租户详情（超级管理员）"
      extra={
        <Space>
          <Button onClick={() => navigate(-1)}>返回</Button>
          {isInactive && (
            <>
              <Button type="primary" onClick={handleApprove}>
                审核通过
              </Button>
              <Button danger onClick={handleReject}>
                审核拒绝
              </Button>
            </>
          )}
          {isSuspended && (
            <Button type="primary" onClick={handleActivate}>
              激活
            </Button>
          )}
          {isActive && (
            <Button danger onClick={handleDeactivate}>
              停用
            </Button>
          )}
        </Space>
      }
    >
      <ProDescriptions<Tenant>
        dataSource={tenant}
        loading={loading}
        column={2}
        columns={[
          {
            title: '租户 ID',
            dataIndex: 'id',
          },
          {
            title: '租户名称',
            dataIndex: 'name',
          },
          {
            title: '域名',
            dataIndex: 'domain',
          },
          {
            title: '状态',
            dataIndex: 'status',
            render: (_, record) => {
              const statusInfo = statusTagMap[record.status];
              return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
            },
          },
          {
            title: '套餐',
            dataIndex: 'plan',
            render: (_, record) => {
              const planInfo = planTagMap[record.plan];
              return <Tag color={planInfo.color}>{planInfo.text}</Tag>;
            },
          },
          {
            title: '最大用户数',
            dataIndex: 'max_users',
          },
          {
            title: '最大存储空间 (MB)',
            dataIndex: 'max_storage',
          },
          {
            title: '过期时间',
            dataIndex: 'expires_at',
            valueType: 'dateTime',
          },
          {
            title: '创建时间',
            dataIndex: 'created_at',
            valueType: 'dateTime',
          },
          {
            title: '更新时间',
            dataIndex: 'updated_at',
            valueType: 'dateTime',
          },
          {
            title: '配置',
            dataIndex: 'settings',
            valueType: 'jsonCode',
            span: 2,
          },
        ]}
      />
    </PageContainer>
  );
};

export default SuperAdminTenantDetail;

