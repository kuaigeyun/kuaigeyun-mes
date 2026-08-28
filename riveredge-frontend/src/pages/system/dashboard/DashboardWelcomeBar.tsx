/**
 * 工作台欢迎条 — 单行文案（问候图标 + 姓名）+ 右侧上线向导 / 便捷工具
 */

import React from 'react';
import { SystemEmoji, WAVING_HAND_EMOJI } from '../../../components/decorative/systemEmoji';
import { useConfigStore } from '../../../stores/configStore';
import { OnboardingWizardEntry } from '../../../components/onboarding-guide/OnboardingWizardEntry';
import WorkplaceToolkit from './WorkplaceToolkit';

/** 欢迎行占用高度（与右侧栏对齐计算共用） */
export const DASHBOARD_WELCOME_LINE_HEIGHT = 40;

export interface DashboardWelcomeBarProps {
  greeting: string;
  userName: string;
  isDark?: boolean;
  cardRadius?: string | number;
  backgroundTint?: string;
}

export function DashboardWelcomeBar({
  greeting,
  userName,
  isDark = false,
  cardRadius,
  backgroundTint,
}: DashboardWelcomeBarProps) {
  const launchWizardEnabled = useConfigStore((s) => s.configs.enable_launch_wizard !== false);

  return (
    <div className="dashboard-welcome-line">
      <div className="dashboard-welcome-line__main">
        <span className="dashboard-welcome-line__emoji" aria-hidden="true">
          <SystemEmoji emoji={WAVING_HAND_EMOJI} size={24} />
        </span>
        <p className="dashboard-welcome-line__text">
          {greeting}，<span className="dashboard-welcome-line__name">{userName}</span>
        </p>
      </div>
      <div className="dashboard-welcome-line__actions">
        {launchWizardEnabled ? <OnboardingWizardEntry /> : null}
        <WorkplaceToolkit
          isDark={isDark}
          cardRadius={cardRadius}
          backgroundTint={backgroundTint}
        />
      </div>
    </div>
  );
}
