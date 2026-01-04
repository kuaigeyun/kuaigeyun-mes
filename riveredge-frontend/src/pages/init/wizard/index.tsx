/**
 * 初始化向导页面
 *
 * 新组织注册后的初始化向导页面
 *
 * Author: Luigi Lu
 * Date: 2025-01-15
 */

import React from 'react';
import InitWizard from '../../../components/init-wizard';
import { useNavigate } from 'react-router-dom';
import { getTenantId } from '../../../utils/auth';

/**
 * 初始化向导页面组件
 */
const InitWizardPage: React.FC = () => {
  const navigate = useNavigate();
  const tenantId = getTenantId();

  const handleComplete = () => {
    // 初始化完成后跳转到工作台
    navigate('/system/dashboard', { replace: true });
  };

  const handleCancel = () => {
    // 取消初始化，也跳转到工作台（用户可以稍后手动进行初始化）
    navigate('/system/dashboard', { replace: true });
  };

  if (!tenantId) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <p>无法获取组织ID，请先登录</p>
      </div>
    );
  }

  return (
    <InitWizard
      tenantId={tenantId}
      onComplete={handleComplete}
      onCancel={handleCancel}
    />
  );
};

export default InitWizardPage;

