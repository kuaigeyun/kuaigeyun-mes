/**
 * 上线向导入口（顶栏 / 工作台欢迎条复用）
 */

import React, { useState } from 'react';
import { Space, Tooltip, theme } from 'antd';
import Lottie from 'lottie-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import compassAnimation from '../../../static/lottie/compass.json';

export type OnboardingWizardEntryVariant = 'header' | 'welcome';

export interface OnboardingWizardEntryProps {
  variant?: OnboardingWizardEntryVariant;
  /** 顶栏窄屏时仅图标 */
  compact?: boolean;
  /** header 变体：浅色顶栏背景 */
  isLightModeLightBg?: boolean;
}

export function OnboardingWizardEntry({
  variant = 'header',
  compact = false,
  isLightModeLightBg = true,
}: OnboardingWizardEntryProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const [hovered, setHovered] = useState(false);

  const isWelcome = variant === 'welcome';
  const showLabel = !compact;

  const headerBtnBg = isLightModeLightBg ? 'rgba(0, 0, 0, 0.10)' : 'rgba(255, 255, 255, 0.1)';
  const headerBtnBgHover = isLightModeLightBg ? 'rgba(0, 0, 0, 0.16)' : 'rgba(255, 255, 255, 0.15)';

  const handleClick = () => navigate('/system/onboarding-wizard');

  const content = (
    <Space
      className={isWelcome ? 'dashboard-welcome-onboarding' : 'riveredge-header-onboarding-space'}
      size={4}
      onClick={handleClick}
      style={
        isWelcome
          ? undefined
          : {
              cursor: 'pointer',
              padding: '0 12px 0 0',
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '16px',
              background: headerBtnBg,
              transition: 'all 0.2s ease',
            }
      }
      onMouseEnter={
        isWelcome
          ? () => setHovered(true)
          : (e) => {
              e.currentTarget.style.background = headerBtnBgHover;
              setHovered(true);
            }
      }
      onMouseLeave={
        isWelcome
          ? () => setHovered(false)
          : (e) => {
              e.currentTarget.style.background = headerBtnBg;
              setHovered(false);
            }
      }
    >
      <span
        style={{
          width: isWelcome ? 28 : 32,
          height: isWelcome ? 28 : 32,
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
          style={{
            width: isWelcome ? 28 : 32,
            height: isWelcome ? 28 : 32,
            display: 'block',
            ...(!isWelcome && !isLightModeLightBg
              ? { filter: 'brightness(1.2) contrast(1.08)' }
              : {}),
          }}
        />
      </span>
      {showLabel ? (
        <span
          className={isWelcome ? 'dashboard-welcome-onboarding__label' : undefined}
          style={
            isWelcome
              ? undefined
              : {
                  fontSize: token.fontSize,
                  fontWeight: 500,
                  color: isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)',
                  lineHeight: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  whiteSpace: 'nowrap',
                }
          }
        >
          {t('menu.system.onboarding-wizard')}
        </span>
      ) : null}
    </Space>
  );

  if (compact) {
    return <Tooltip title={t('menu.system.onboarding-wizard')}>{content}</Tooltip>;
  }

  return content;
}
