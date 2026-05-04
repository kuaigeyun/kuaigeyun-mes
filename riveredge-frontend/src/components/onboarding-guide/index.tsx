import React from 'react';
import { Joyride, EVENTS, STATUS, type Step } from 'react-joyride';

/** 与历史代码中的 `GuideStep` 命名兼容 */
export type GuideStep = Step;
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
  const { isRunning, activeGuideId, completeGuide } = useGuideStore();

  // 获取当前引导配置
  const guideConfig = activeGuideId ? GUIDE_REGISTRY[activeGuideId] : null;
  const steps = guideConfig?.steps || [];

  const handleJoyrideEvent: React.ComponentProps<typeof Joyride>['onEvent'] = (data) => {
    const { status, type } = data;

    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      if (activeGuideId) {
        completeGuide(activeGuideId);
      }
    } else if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      // 可在此处处理步骤跳转逻辑
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
      scrollToFirstStep
      tooltipComponent={GuideTooltip}
      options={{
        scrollOffset: 100,
        showProgress: true,
        buttons: ['back', 'close', 'primary', 'skip'],
      }}
      onEvent={handleJoyrideEvent}
      styles={
        {
          overlay: { backgroundColor: 'rgba(0, 0, 0, 0.45)', zIndex: 10000 },
          spotlight: { borderRadius: token.borderRadius },
          floater: { zIndex: 10000 },
          tooltip: { backgroundColor: token.colorBgContainer },
          buttonPrimary: { backgroundColor: token.colorPrimary },
        } as any
      }
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
