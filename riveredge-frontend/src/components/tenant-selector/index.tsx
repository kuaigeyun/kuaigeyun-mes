/**
 * 组织选择器组件
 *
 * 允许平台超级管理员选择要管理的组织
 * 系统级用户显示当前所属组织
 */

import React, { useState, useEffect } from 'react';
import { Select, Spin, message, theme } from 'antd';
import { SwapOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getTenantList, TenantStatus } from '../../services/tenant';
import { getUserInfo, setTenantId, getTenantId } from '../../utils/auth';

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
  const userInfo = getUserInfo();
  const isInfraSuperAdmin = userInfo?.user_type === 'infra_superadmin';
  const currentTenantId = getTenantId();

  // 获取组织列表（仅平台超级管理员需要）
  const { data: tenantData, isLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => getTenantList({ page: 1, page_size: 100, status: TenantStatus.ACTIVE }, true), // 传递isSuperAdmin=true
    enabled: isInfraSuperAdmin, // 只有平台超级管理员才获取组织列表
  });

  // 处理组织选择
  const handleTenantChange = (tenantId: string) => {
    setTenantId(tenantId);
    message.success(t('ui.message.switchedTenant'));
    // 刷新页面以应用新的组织上下文
    window.location.reload();
  };

  // 如果是平台超级管理员且没有选择组织，自动选择第一个可用的组织
  React.useEffect(() => {
    if (isInfraSuperAdmin && !currentTenantId && (tenantData?.items?.length ?? 0) > 0) {
      const firstTenant = tenantData!.items[0];
      setTenantId(firstTenant.id);
      message.info(t('ui.message.autoSelectedTenant', { name: firstTenant.name }));
    }
  }, [isInfraSuperAdmin, currentTenantId, tenantData]);

  // 如果是平台超级管理员，显示组织选择器
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
            suffixIcon={<SwapOutlined />}  // 使用切换图标替换默认的下拉箭头
            onChange={handleTenantChange}
            disabled={isLoading}
          >
            {tenantData?.items?.map((tenant: any) => (
              <Option key={tenant.id} value={String(tenant.id)}>
                {tenant.name}
              </Option>
            ))}
          </Select>
        )}
      </div>
    );
  }

  // 如果是系统级用户，显示当前组织名称（带胶囊型背景）
  const tenantName = userInfo?.tenant_name || t('ui.common.unknownTenant');
  const spanColor = headerLightText ? 'rgba(255, 255, 255, 0.85)' : token.colorText;
  return (
    <span
      style={{
        display: 'inline-block',
        maxWidth: 240, // ⚠️ 防止组织名过长挤压顶栏
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


