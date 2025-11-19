/**
 * 租户详情页面
 * 
 * 用于展示租户详细信息。
 * 注意：此页面通常需要超级管理员权限。
 */

import React, { useEffect, useState } from 'react';
import { ProDescriptions } from '@ant-design/pro-components';
import { PageContainer } from '@ant-design/pro-components';
import { Button, Tag, message } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  getTenantById,
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
 * 租户详情页面组件
 */
const TenantDetail: React.FC = () => {
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
      setLoading(true);
      getTenantById(Number(tenantId))
        .then((data) => {
          setTenant(data);
        })
        .catch((error: any) => {
          message.error(error.message || '加载租户信息失败');
          navigate('/tenant/list');
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      message.error('缺少租户 ID');
      navigate('/tenant/list');
    }
  }, [tenantId]);

  /**
   * 处理激活租户
   */
  const handleActivate = async () => {
    if (!tenant) return;
    try {
      await activateTenant(tenant.id);
      message.success('激活成功');
      // 重新加载数据
      const updatedTenant = await getTenantById(tenant.id);
      setTenant(updatedTenant);
    } catch (error: any) {
      message.error(error.message || '激活失败');
    }
  };

  /**
   * 处理停用租户
   */
  const handleDeactivate = async () => {
    if (!tenant) return;
    try {
      await deactivateTenant(tenant.id);
      message.success('停用成功');
      // 重新加载数据
      const updatedTenant = await getTenantById(tenant.id);
      setTenant(updatedTenant);
    } catch (error: any) {
      message.error(error.message || '停用失败');
    }
  };

  if (!tenant) {
    return null;
  }

  const statusInfo = statusTagMap[tenant.status];
  const planInfo = planTagMap[tenant.plan];

  return (
    <PageContainer
      title="租户详情"
      loading={loading}
      extra={[
        <Button key="edit" onClick={() => navigate(`/tenant/form?id=${tenant.id}`)}>
          编辑
        </Button>,
        tenant.status === TenantStatus.ACTIVE ? (
          <Button key="deactivate" danger onClick={handleDeactivate}>
            停用
          </Button>
        ) : (
          <Button key="activate" type="primary" onClick={handleActivate}>
            激活
          </Button>
        ),
      ]}
    >
      <ProDescriptions<Tenant>
        column={2}
        title="基本信息"
        dataSource={tenant}
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
            render: () => <Tag color={statusInfo.color}>{statusInfo.text}</Tag>,
          },
          {
            title: '套餐',
            dataIndex: 'plan',
            render: () => <Tag color={planInfo.color}>{planInfo.text}</Tag>,
          },
          {
            title: '最大用户数',
            dataIndex: 'max_users',
          },
          {
            title: '最大存储空间（MB）',
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
        ]}
      />
      
      {tenant.settings && Object.keys(tenant.settings).length > 0 && (
        <ProDescriptions
          column={1}
          title="租户配置"
          style={{ marginTop: 24 }}
        >
          <ProDescriptions.Item label="配置信息">
            <pre>{JSON.stringify(tenant.settings, null, 2)}</pre>
          </ProDescriptions.Item>
        </ProDescriptions>
      )}
    </PageContainer>
  );
};

export default TenantDetail;

