/**
 * 初始化向导页面 - Modal 形式
 *
 * 新组织注册后的初始化向导，以弹窗形式展示
 *
 * Author: Luigi Lu
 * Date: 2025-01-15
 */

import React from 'react';
import { Modal } from 'antd';
import InitWizard from '../../../components/init-wizard';
import { useNavigate } from 'react-router-dom';
import { getTenantId } from '../../../utils/auth';

/**
 * 初始化向导页面组件（Modal 形式）
 */
const InitWizardPage: React.FC = () => {
  const navigate = useNavigate();
  const tenantId = getTenantId();

  const handleComplete = () => {
    navigate('/system/dashboard/workplace', { replace: true });
  };

  const handleCancel = () => {
    navigate('/system/dashboard/workplace', { replace: true });
  };

  if (!tenantId) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <p>无法获取组织ID，请先登录</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'rgba(0,0,0,0.02)' }}>
      <Modal
        title="初始化向导"
        open
        width={720}
        closable
        maskClosable={false}
        footer={null}
        destroyOnHidden
        onCancel={handleCancel}
        styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
      >
        <InitWizard
          tenantId={tenantId}
          onComplete={handleComplete}
          onCancel={handleCancel}
        />
      </Modal>
    </div>
  );
};

export default InitWizardPage;

