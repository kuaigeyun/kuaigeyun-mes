import React, { useEffect } from 'react';
import { Joyride, ACTIONS, EVENTS, STATUS, type Step } from 'react-joyride';
import { useGuideStore } from './store';
import { GUIDE_REGISTRY } from './registry';
import GuideTooltip from './Tooltip';
import { theme } from 'antd';

const { useToken } = theme;

/**
 * 全局新手引导控制器
 * 使用 React Joyride 实现
 */
export const OnboardingGuide: React.FC = () => {
  const { token } = useToken();
  const { isRunning, activeGuideId, stopGuide, completeGuide } = useGuideStore();

  // 获取当前引导配置
  const guideConfig = activeGuideId ? GUIDE_REGISTRY[activeGuideId] : null;
  const steps = guideConfig?.steps || [];

  const handleJoyrideCallback = (data: any) => {
    const { status, type, action } = data;

    // 当引导完成或跳过时
    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
      if (activeGuideId) {
        completeGuide(activeGuideId);
      }
    } else if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      // 可以在这里处理步骤跳转逻辑
    }
  };

  if (!isRunning || !activeGuideId || steps.length === 0) {
    return null;
  }

  return (
    <Joyride
      steps={steps}
      run={isRunning}
      continuous
      showProgress
      showSkipButton
      scrollToFirstStep
      disableScrolling={false}
      scrollOffset={100}
      callback={handleJoyrideCallback}
      tooltipComponent={GuideTooltip}
      styles={{
        options: {
          zIndex: 10000,
          primaryColor: token.colorPrimary,
          overlayColor: 'rgba(0, 0, 0, 0.45)',
          backgroundColor: token.colorBgContainer,
        },
        overlay: {
          backgroundColor: 'rgba(0, 0, 0, 0.45)',
        },
        spotlight: {
          borderRadius: token.borderRadius,
        },
      }}
      locale={{
        back: '上一步',
        close: '关闭',
        last: '完成',
        next: '下一步',
        skip: '跳过',
      }}
    />
  );
};

export default OnboardingGuide;
