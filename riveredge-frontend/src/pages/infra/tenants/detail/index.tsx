/**
 * 超级管理员组织详情页面
 * 
 * 用于超级管理员查看组织详细信息。
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
} from '../../../../services/tenant';
// 使用 apiRequest 统一处理 HTTP 请求

// @ts-ignore
import { apiRequest } from '../../../../services/api';
import { useTranslation } from 'react-i18next';

/**
 * 超级管理员组织详情页面组件
 */
const SuperAdminTenantDetail: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get('id');
  const [loading, setLoading] = useState(false);
  const [tenant, setTenant] = useState<Tenant | null>(null);

  const statusTagMap: Record<TenantStatus, { color: string; text: string }> = {
    [TenantStatus.ACTIVE]: { color: 'success', text: t('pages.infra.tenant.statusActive') },
    [TenantStatus.INACTIVE]: { color: 'default', text: t('pages.infra.tenant.statusInactive') },
    [TenantStatus.EXPIRED]: { color: 'warning', text: t('pages.infra.tenant.statusExpired') },
    [TenantStatus.SUSPENDED]: { color: 'error', text: t('pages.infra.tenant.statusSuspended') },
  };

  const planTagMap: Record<TenantPlan, { color: string; text: string }> = {
    [TenantPlan.TRIAL]: { color: 'default', text: t('pages.infra.tenant.planTrial') },
    [TenantPlan.BASIC]: { color: 'blue', text: t('pages.infra.tenant.planBasic') },
    [TenantPlan.PROFESSIONAL]: { color: 'purple', text: t('pages.infra.tenant.planProfessional') },
    [TenantPlan.ENTERPRISE]: { color: 'gold', text: t('pages.infra.tenant.planEnterprise') },
  };

  /**
   * 加载组织数据
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
      // 使用平台超级管理员接口获取组织详情
      const data = await getTenantById(Number(tenantId), true);
      setTenant(data);
    } catch (error: any) {
      message.error(error.message || t('pages.infra.tenant.loadDetailFailed'));
    } finally {
      setLoading(false);
    }
  };

  /**
   * 审核通过组织注册
   */
  const handleApprove = async () => {
    if (!tenantId) return;
    try {
      await apiRequest(`/infra/tenants/${tenantId}/approve`, {
        method: 'POST',
      });
      message.success(t('pages.infra.tenant.approveSuccess'));
      loadTenant();
    } catch (error: any) {
      message.error(error.message || t('pages.infra.tenant.approveFailed'));
    }
  };

  /**
   * 审核拒绝组织注册
   */
  const handleReject = async () => {
    if (!tenantId) return;
    try {
      await apiRequest(`/infra/tenants/${tenantId}/reject`, {
        method: 'POST',
      });
      message.success(t('pages.infra.tenant.rejectSuccess'));
      loadTenant();
    } catch (error: any) {
      message.error(error.message || t('pages.infra.tenant.rejectFailed'));
    }
  };

  /**
   * 激活组织
   */
  const handleActivate = async () => {
    if (!tenantId) return;
    try {
      await activateTenant(Number(tenantId));
      message.success(t('pages.infra.tenant.activateSuccess'));
      loadTenant();
    } catch (error: any) {
      message.error(error.message || t('pages.infra.tenant.activateFailed'));
    }
  };

  /**
   * 停用组织
   */
  const handleDeactivate = async () => {
    if (!tenantId) return;
    try {
      await deactivateTenant(Number(tenantId));
      message.success(t('pages.infra.tenant.deactivateSuccess'));
      loadTenant();
    } catch (error: any) {
      message.error(error.message || t('pages.infra.tenant.deactivateFailed'));
    }
  };

  if (!tenant) {
    return <PageContainer loading={loading} breadcrumb={false}>{t('pages.infra.tenant.notFound')}</PageContainer>;
  }

  const isInactive = tenant.status === TenantStatus.INACTIVE;
  const isActive = tenant.status === TenantStatus.ACTIVE;
  const isSuspended = tenant.status === TenantStatus.SUSPENDED;

  return (
    <PageContainer
      title={t('pages.infra.tenant.detailTitleSuperAdmin')}
      breadcrumb={false}
      extra={
        <Space>
          <Button onClick={() => navigate(-1)}>{t('pages.infra.tenant.back')}</Button>
          {isInactive && (
            <>
              <Button type="primary" onClick={handleApprove}>
                {t('pages.infra.tenant.approve')}
              </Button>
              <Button danger onClick={handleReject}>
                {t('pages.infra.tenant.reject')}
              </Button>
            </>
          )}
          {isSuspended && (
            <Button type="primary" onClick={handleActivate}>
              {t('pages.infra.tenant.activateButton')}
            </Button>
          )}
          {isActive && (
            <Button danger onClick={handleDeactivate}>
              {t('pages.infra.tenant.deactivate')}
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
            title: t('pages.infra.tenant.name'),
            dataIndex: 'name',
          },
          {
            title: t('pages.infra.tenant.domain'),
            dataIndex: 'domain',
          },
          {
            title: t('pages.infra.tenant.status'),
            dataIndex: 'status',
            render: (_, record) => {
              const statusInfo = statusTagMap[record.status] ?? { color: 'default', text: record.status ?? '-' };
              return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
            },
          },
          {
            title: t('pages.infra.tenant.plan'),
            dataIndex: 'plan',
            render: (_, record) => {
              const planInfo = planTagMap[record.plan] ?? { color: 'default', text: record.plan ?? '-' };
              return <Tag color={planInfo.color}>{planInfo.text}</Tag>;
            },
          },
          {
            title: t('pages.infra.tenant.maxUsers'),
            dataIndex: 'max_users',
          },
          {
            title: t('pages.infra.tenant.maxStorage'),
            dataIndex: 'max_storage',
          },
          {
            title: t('pages.infra.tenant.expiresAt'),
            dataIndex: 'expires_at',
            valueType: 'dateTime',
          },
          {
            title: t('pages.infra.tenant.createdAt'),
            dataIndex: 'created_at',
            valueType: 'dateTime',
          },
          {
            title: t('pages.infra.tenant.updatedAt'),
            dataIndex: 'updated_at',
            valueType: 'dateTime',
          },
          {
            title: t('pages.infra.tenant.settings'),
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

