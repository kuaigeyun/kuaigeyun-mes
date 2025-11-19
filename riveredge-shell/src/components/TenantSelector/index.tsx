/**
 * 租户选择器组件
 * 
 * 用于显示当前租户信息，并支持租户切换（如果用户有多个租户权限）。
 * 集成到顶部导航栏。
 */

import React, { useState, useEffect } from 'react';
import { Select, Tag, message } from 'antd';
import { ApartmentOutlined } from '@ant-design/icons';
import { getTenantById, Tenant } from '@/services/tenant';
import { getTenantId, setTenantId, getToken } from '@/utils/auth';
import { getCurrentUser, CurrentUser } from '@/services/auth';

/**
 * 租户选择器组件
 */
const TenantSelector: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<CurrentUser | undefined>(undefined);
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(false);

  /**
   * 加载当前用户信息
   */
  useEffect(() => {
    const loadUserInfo = async () => {
      if (getToken()) {
        try {
          const user = await getCurrentUser();
          setCurrentUser(user);
        } catch (error) {
          console.error('加载用户信息失败:', error);
        }
      }
    };
    
    loadUserInfo();
  }, []);

  /**
   * 加载当前租户信息
   */
  useEffect(() => {
    const loadCurrentTenant = async () => {
      const tenantId = getTenantId() || currentUser?.tenant_id;
      if (tenantId) {
        setLoading(true);
        try {
          const tenant = await getTenantById(tenantId);
          setCurrentTenant(tenant);
        } catch (error: any) {
          console.error('加载租户信息失败:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    if (currentUser) {
      loadCurrentTenant();
    }
  }, [currentUser]);

  /**
   * 处理租户切换
   * 
   * @param tenantId - 租户 ID
   */
  const handleTenantChange = async (tenantId: number) => {
    try {
      // 更新本地存储的租户 ID
      setTenantId(tenantId);
      
      // 重新加载租户信息
      const tenant = await getTenantById(tenantId);
      setCurrentTenant(tenant);
      
      message.success(`已切换到租户: ${tenant.name}`);
      
      // 刷新页面以更新所有数据（因为租户切换会影响所有查询）
      window.location.reload();
    } catch (error: any) {
      message.error(error.message || '切换租户失败');
    }
  };

  if (!currentTenant) {
    return null;
  }

  // 目前只显示当前租户信息
  // 未来如果支持多租户权限，可以添加下拉选择
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <ApartmentOutlined />
      <Tag color="blue">{currentTenant.name}</Tag>
      <span style={{ color: '#666', fontSize: 12 }}>
        ({currentTenant.domain})
      </span>
    </div>
  );
};

export default TenantSelector;

