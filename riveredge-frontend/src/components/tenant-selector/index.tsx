/**
 * 组织选择器组件
 *
 * 平台超级管理员可切换任意租户
 * 普通用户在账号属于多个租户时也可切换
 */

import React from 'react';
import { Select, Spin, message, theme } from 'antd';
import { SwapOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getTenantList, TenantStatus } from '../../services/tenant';
import { getMyTenants, switchTenant, tenantNameFromLoginResponse } from '../../services/auth';
import { setTenantId, getTenantId, isInfraSuperAdminUser, setToken, setUserInfo } from '../../utils/auth';
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
  const setCurrentUser = useGlobalStore((s) => s.setCurrentUser);
  const isInfraSuperAdmin = isInfraSuperAdminUser(currentUser);
  const currentTenantId = getTenantId();
  const [switching, setSwitching] = React.useState(false);

  const { data: tenantOptions = [], isLoading } = useQuery({
    queryKey: ['tenant-selector-options', isInfraSuperAdmin],
    queryFn: async () => {
      if (isInfraSuperAdmin) {
        const resp = await getTenantList({ page: 1, page_size: 100, status: TenantStatus.ACTIVE }, true);
        return resp.items.map((tenant) => ({ id: tenant.id, name: tenant.name }));
      }
      const tenants = await getMyTenants();
      return tenants.map((tenant) => ({ id: tenant.id, name: tenant.name }));
    },
    enabled: !!currentUser,
  });

  const handleTenantChange = async (tenantId: string) => {
    try {
      if (isInfraSuperAdmin) {
        setTenantId(tenantId);
        message.success(t('ui.message.switchedTenant'));
        window.location.reload();
        return;
      }
      const targetTenantId = Number(tenantId);
      setSwitching(true);
      const response = await switchTenant(targetTenantId);
      setToken(response.access_token);
      const selectedTenantId = response.user?.tenant_id || response.default_tenant_id || targetTenantId;
      setTenantId(selectedTenantId);
      const tenantName = tenantNameFromLoginResponse(response) || currentUser?.tenant_name || '';
      const nextUser = {
        ...(currentUser || {}),
        ...(response.user || {}),
        tenant_id: selectedTenantId,
        tenant_name: tenantName,
      };
      setCurrentUser(nextUser as any);
      setUserInfo(nextUser);
      message.success(t('ui.message.switchedTenant'));
      window.location.reload();
    } catch (error: any) {
      message.error(error?.message || t('pages.login.tenantSelectFailed'));
    } finally {
      setSwitching(false);
    }
  };

  React.useEffect(() => {
    if (isInfraSuperAdmin && !currentTenantId && tenantOptions.length > 0) {
      const firstTenant = tenantOptions[0];
      setTenantId(firstTenant.id);
      message.info(t('ui.message.autoSelectedTenant', { name: firstTenant.name }));
    }
  }, [isInfraSuperAdmin, currentTenantId, tenantOptions, t]);

  const canSwitch = isInfraSuperAdmin || tenantOptions.length > 1;
  const textFontSize = token.fontSize;
  const tenantTextStyle: React.CSSProperties = {
    fontSize: textFontSize,
    fontWeight: 500,
    lineHeight: `${Math.max(32, textFontSize + 8)}px`,
  };

  if (canSwitch) {
    return (
      <div
        style={{ display: 'flex', alignItems: 'center' }}
        className={headerLightText ? 'tenant-selector-select-light-text' : undefined}
      >
        {isLoading || switching ? (
          <Spin size="small" />
        ) : (
          <Select
            value={currentTenantId != null ? String(currentTenantId) : undefined}
            placeholder={tenantOptions.length ? t('ui.placeholder.selectTenant') : t('ui.placeholder.loading')}
            style={{
              minWidth: 120,
              maxWidth: 240,
              height: 32,
              padding: '0 12px',
              fontSize: textFontSize,
            }}
            size="small"
            className="tenant-selector-select"
            suffixIcon={<SwapOutlined />}
            onChange={handleTenantChange}
            disabled={isLoading || switching}
          >
            {tenantOptions.map((tenant) => (
              <Option key={tenant.id} value={String(tenant.id)}>
                <span style={tenantTextStyle}>{tenant.name}</span>
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
        padding: '4px 16px',
        borderRadius: '16px',
        backgroundColor: token.colorFillTertiary,
        color: spanColor,
        fontSize: textFontSize,
        fontWeight: 500,
        height: 32,
        lineHeight: '32px',
        verticalAlign: 'middle',
      }}
    >
      {tenantName}
    </span>
  );
};

export default TenantSelector;
