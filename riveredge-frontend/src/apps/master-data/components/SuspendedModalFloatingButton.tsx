/**
 * 暂存 Modal 悬浮按钮
 *
 * 当用户从物料表单点击链接跳转到其他页面后，在目标页面右下角显示悬浮按钮，
 * 点击可返回原页面并恢复表单数据。
 * 系统说明与反馈按钮开启时，本按钮会上移避免重叠。
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button, Tooltip } from 'antd';
import { FormOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { getSuspendedModal } from '../utils/suspendedModal';
import { getPlatformSettingsPublic } from '../../../services/platformSettings';
import styles from './SuspendedModalFloatingButton.module.css';

const SuspendedModalFloatingButton: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  const [returnPath, setReturnPath] = useState<string | null>(null);

  const { data: settings } = useQuery({
    queryKey: ['platformSettingsPublic'],
    queryFn: getPlatformSettingsPublic,
    staleTime: 0,
  });
  const iterationButtonEnabled = settings?.float_button_enabled !== false;

  useEffect(() => {
    const state = getSuspendedModal();
    if (state && state.returnPath !== location.pathname) {
      setVisible(true);
      setReturnPath(state.returnPath);
    } else {
      setVisible(false);
      setReturnPath(null);
    }
  }, [location.pathname]);

  const handleClick = () => {
    const state = getSuspendedModal();
    if (returnPath && state?.formData) {
      const separator = returnPath.includes('?') ? '&' : '?';
      navigate(`${returnPath}${separator}restore=1`, { replace: false });
      setVisible(false);
    }
  };

  if (!visible) return null;

  return (
    <Tooltip title={t('app.master-data.suspendedModal.returnToForm')}>
      <div
        className={styles.wrapper}
        style={{
          position: 'fixed',
          bottom: iterationButtonEnabled ? 72 : 24,
          right: 24,
          zIndex: 1050,
          width: 40,
          height: 40,
        }}
      >
        <Button
          type="primary"
          shape="circle"
          size="large"
          icon={<FormOutlined />}
          onClick={handleClick}
          style={{
            width: '100%',
            height: '100%',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        />
      </div>
    </Tooltip>
  );
};

export default SuspendedModalFloatingButton;
