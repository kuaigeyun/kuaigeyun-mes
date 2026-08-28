/**
 * 上线向导入口（仅工作台欢迎条）
 */

import React, { useState } from 'react';
import { Space } from 'antd';
import Lottie from 'lottie-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import compassAnimation from '../../../static/lottie/compass.json';

export function OnboardingWizardEntry() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);

  return (
    <Space
      className="dashboard-welcome-onboarding"
      size={4}
      onClick={() => navigate('/system/onboarding-wizard')}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span
        style={{
          width: 28,
          height: 28,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 0,
        }}
      >
        <Lottie
          animationData={compassAnimation}
          loop={hovered}
          autoplay={hovered}
          style={{ width: 28, height: 28, display: 'block' }}
        />
      </span>
      <span className="dashboard-welcome-onboarding__label">
        {t('menu.system.onboarding-wizard')}
      </span>
    </Space>
  );
}
