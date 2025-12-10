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
import { getTenantList } from '../../services/tenant';
import { getUserInfo, setTenantId, getTenantId } from '../../utils/auth';

const { Option } = Select;

/**
 * 组织选择器组件
 */
const TenantSelector: React.FC = () => {
  const { token } = theme.useToken();
  const userInfo = getUserInfo();
  const isPlatformSuperAdmin = userInfo?.user_type === 'platform_superadmin';
  const currentTenantId = getTenantId();

  // 获取组织列表（仅平台超级管理员需要）
  const { data: tenantData, isLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => getTenantList({ page: 1, page_size: 100, status: 'active' }, true), // 传递isSuperAdmin=true
    enabled: isPlatformSuperAdmin, // 只有平台超级管理员才获取组织列表
  });

  // 处理组织选择
  const handleTenantChange = (tenantId: string) => {
    setTenantId(tenantId);
    message.success('已切换组织上下文');
    // 刷新页面以应用新的组织上下文
    window.location.reload();
  };

  // 如果是平台超级管理员且没有选择组织，自动选择第一个可用的组织
  React.useEffect(() => {
    if (isPlatformSuperAdmin && !currentTenantId && tenantData?.items?.length > 0) {
      const firstTenant = tenantData.items[0];
      setTenantId(firstTenant.id);
      message.info(`已自动选择组织: ${firstTenant.name}`);
    }
  }, [isPlatformSuperAdmin, currentTenantId, tenantData]);

  // 如果是平台超级管理员，显示组织选择器
  if (isPlatformSuperAdmin) {
    return (
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {isLoading ? (
          <Spin size="small" />
        ) : (
          <Select
            value={currentTenantId || undefined}
            placeholder={tenantData?.items?.length ? "请选择组织" : "加载中..."}
            style={{
              minWidth: 200,
              height: 32,
            }}
            size="small"
            className="tenant-selector-select"
            suffixIcon={<SwapOutlined />}  // 使用切换图标替换默认的下拉箭头
            onChange={handleTenantChange}
            disabled={isLoading}
          >
            {tenantData?.items?.map((tenant: any) => (
              <Option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </Option>
            ))}
          </Select>
        )}
      </div>
    );
  }

  // 如果是系统级用户，显示当前组织名称（带胶囊型背景）
  const tenantName = userInfo?.tenant_name || '未知组织';
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '4px 12px',
        borderRadius: '16px',
        backgroundColor: token.colorFillTertiary,
        color: token.colorText,
        fontSize: 14,
        fontWeight: 500,
        height: 32,
        lineHeight: '24px',
      }}
    >
      {tenantName}
    </span>
  );
};

export default TenantSelector;


