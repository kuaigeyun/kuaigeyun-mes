/**
 * 组织选择器组件
 *
 * 允许平台超级管理员选择要管理的组织
 * 系统级用户显示当前所属组织（名称来自认证 API 的 tenant_name）
 */

import React from 'react';
import { Select, Spin, message, theme } from 'antd';
import { SwapOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getTenantList, TenantStatus } from '../../services/tenant';
import { setTenantId, getTenantId, isInfraSuperAdminUser } from '../../utils/auth';
import { useGlobalStore } from '../../stores';

const { Option } = Select;

interface TenantSelectorProps {
  /** 顶栏为深色背景时传 true，用于强制浅色文字 */
  headerLightText?: boolean;
}

/**
 * 组织选择器组件
 */
const TenantSelector: React.FC<TenantSelectorProps> = ({ headerLightText }) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const currentUser = useGlobalStore((s) => s.currentUser);
  const isInfraSuperAdmin = isInfraSuperAdminUser(currentUser);
  const currentTenantId = getTenantId();

  const { data: tenantData, isLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => getTenantList({ page: 1, page_size: 100, status: TenantStatus.ACTIVE }, true),
    enabled: isInfraSuperAdmin,
  });

  const handleTenantChange = (tenantId: string) => {
    setTenantId(tenantId);
    message.success(t('ui.message.switchedTenant'));
    window.location.reload();
  };

  React.useEffect(() => {
    if (isInfraSuperAdmin && !currentTenantId && (tenantData?.items?.length ?? 0) > 0) {
      const firstTenant = tenantData!.items[0];
      setTenantId(firstTenant.id);
      message.info(t('ui.message.autoSelectedTenant', { name: firstTenant.name }));
    }
  }, [isInfraSuperAdmin, currentTenantId, tenantData, t]);

  if (isInfraSuperAdmin) {
    return (
      <div
        style={{ display: 'flex', alignItems: 'center' }}
        className={headerLightText ? 'tenant-selector-select-light-text' : undefined}
      >
        {isLoading ? (
          <Spin size="small" />
        ) : (
          <Select
            value={currentTenantId != null ? String(currentTenantId) : undefined}
            placeholder={tenantData?.items?.length ? t('ui.placeholder.selectTenant') : t('ui.placeholder.loading')}
            style={{
              minWidth: 120,
              maxWidth: 240,
              height: 32,
            }}
            size="small"
            className="tenant-selector-select"
            suffixIcon={<SwapOutlined />}
            onChange={handleTenantChange}
            disabled={isLoading}
          >
            {tenantData?.items?.map((tenant: { id: number; name: string }) => (
              <Option key={tenant.id} value={String(tenant.id)}>
                {tenant.name}
              </Option>
            ))}
          </Select>
        )}
      </div>
    );
  }

  const tenantName = currentUser?.tenant_name?.trim();
  if (!tenantName) {
    return null;
  }

  const spanColor = headerLightText ? 'rgba(255, 255, 255, 0.85)' : token.colorText;
  return (
    <span
      style={{
        display: 'inline-block',
        maxWidth: 240,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        padding: '4px 12px',
        borderRadius: '16px',
        backgroundColor: token.colorFillTertiary,
        color: spanColor,
        fontSize: token.fontSize,
        fontWeight: 500,
        height: 32,
        lineHeight: '24px',
        verticalAlign: 'middle',
      }}
    >
      {tenantName}
    </span>
  );
};

export default TenantSelector;
