/**
 * 组织选择器组件
 *
 * 平台超级管理员可切换任意租户
 * 普通用户在账号属于多个租户时也可切换
 */

import React from 'react';
import { Select, Spin, message, theme } from 'antd';
import { SwapOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getTenantList, TenantStatus } from '../../services/tenant';
import { getMyTenants, switchTenant, tenantNameFromLoginResponse } from '../../services/auth';
import { setTenantId, getTenantId, isInfraSuperAdminUser, setToken, setUserInfo } from '../../utils/auth';
import { applyTenantSwitchSideEffects } from '../../utils/applyTenantSwitch';
import { isRequestCancellation } from '../../utils/requestCancellation';
import { useGlobalStore } from '../../stores';
import { useCurrentUser } from '../../hooks/useCurrentUser';

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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = useCurrentUser();
  const setCurrentUser = useGlobalStore((s) => s.setCurrentUser);
  const isInfraSuperAdmin = isInfraSuperAdminUser(currentUser);
  const currentTenantId = currentUser?.tenant_id ?? getTenantId();
  const [switching, setSwitching] = React.useState(false);
  const switchingRef = React.useRef(false);

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
    const nextId = Number(tenantId);
    if (!Number.isFinite(nextId) || nextId === currentTenantId || switchingRef.current) return;

    try {
      switchingRef.current = true;
      setSwitching(true);

      if (isInfraSuperAdmin) {
        const selected = tenantOptions.find((tenant) => Number(tenant.id) === nextId);
        setTenantId(nextId);
        const nextUser = {
          ...(currentUser || {}),
          tenant_id: nextId,
          tenant_name: selected?.name || currentUser?.tenant_name || '',
        };
        setCurrentUser(nextUser as any);
        setUserInfo(nextUser);
        message.success(t('ui.message.switchedTenant'));
        await applyTenantSwitchSideEffects(queryClient, navigate);
        return;
      }

      const response = await switchTenant(nextId);
      setToken(response.access_token);
      const selectedTenantId = response.user?.tenant_id || response.default_tenant_id || nextId;
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
      await applyTenantSwitchSideEffects(queryClient, navigate);
    } catch (error: any) {
      if (!isRequestCancellation(error)) {
        message.error(error?.message || t('pages.login.tenantSelectFailed'));
      }
    } finally {
      switchingRef.current = false;
      setSwitching(false);
    }
  };

  React.useEffect(() => {
    if (isInfraSuperAdmin && !currentTenantId && tenantOptions.length > 0) {
      const firstTenant = tenantOptions[0];
      const firstId = Number(firstTenant.id);
      setTenantId(firstId);
      const user = useGlobalStore.getState().currentUser;
      if (user) {
        const nextUser = {
          ...user,
          tenant_id: firstId,
          tenant_name: firstTenant.name,
        };
        setCurrentUser(nextUser as any);
        setUserInfo(nextUser);
      }
      message.info(t('ui.message.autoSelectedTenant', { name: firstTenant.name }));
    }
  }, [isInfraSuperAdmin, currentTenantId, tenantOptions, t, setCurrentUser]);

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
