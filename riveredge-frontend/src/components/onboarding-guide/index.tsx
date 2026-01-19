/**
 * 新手引导组件
 * 
 * 使用 Ant Design Tour 组件实现新手引导功能
 */

import React, { useState, useEffect } from 'react';
import { Tour, TourProps } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { Button } from 'antd';

/**
 * 引导步骤配置
 */
export interface GuideStep {
  /**
   * 目标元素选择器
   */
  target: string;
  /**
   * 引导标题
   */
  title: string;
  /**
   * 引导内容
   */
  description: string;
  /**
   * 引导位置
   */
  placement?: 'top' | 'right' | 'bottom' | 'left' | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | 'leftTop' | 'leftBottom' | 'rightTop' | 'rightBottom';
  /**
   * 是否覆盖遮罩
   */
  mask?: boolean;
}

/**
 * 新手引导组件属性
 */
export interface OnboardingGuideProps {
  /**
   * 引导步骤配置
   */
  steps: GuideStep[];
  /**
   * 引导标识（用于判断是否已显示过）
   */
  guideKey: string;
  /**
   * 是否自动开始（默认 false）
   */
  autoStart?: boolean;
  /**
   * 引导完成回调
   */
  onComplete?: () => void;
  /**
   * 引导关闭回调
   */
  onClose?: () => void;
  /**
   * 是否显示帮助按钮（默认 true）
   */
  showHelpButton?: boolean;
  /**
   * 帮助按钮位置
   */
  helpButtonPosition?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

/**
 * 新手引导组件
 */
const OnboardingGuide: React.FC<OnboardingGuideProps> = ({
  steps,
  guideKey,
  autoStart = false,
  onComplete,
  onClose,
  showHelpButton = true,
  helpButtonPosition = 'top-right',
}) => {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(0);

  // 检查是否已显示过引导
  useEffect(() => {
    const hasShown = localStorage.getItem(`guide_${guideKey}`);
    if (autoStart && !hasShown && steps.length > 0) {
      // 延迟显示，确保 DOM 已渲染
      setTimeout(() => {
        setOpen(true);
      }, 500);
    }
  }, [autoStart, guideKey, steps.length]);

  // 转换为 Tour 组件需要的格式
  const tourSteps: TourProps['steps'] = steps.map((step, index) => ({
    title: step.title,
    description: step.description,
    target: () => {
      const element = document.querySelector(step.target);
      return element as HTMLElement;
    },
    placement: step.placement || 'bottom',
    mask: step.mask !== false,
  }));

  const handleChange = (current: number) => {
    setCurrent(current);
  };

  const handleFinish = () => {
    setOpen(false);
    localStorage.setItem(`guide_${guideKey}`, 'true');
    if (onComplete) {
      onComplete();
    }
  };

  const handleClose = () => {
    setOpen(false);
    if (onClose) {
      onClose();
    }
  };

  const handleStartGuide = () => {
    setOpen(true);
    setCurrent(0);
  };

  // 帮助按钮样式
  const helpButtonStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 1000,
    ...(helpButtonPosition === 'top-right' && { top: 20, right: 20 }),
    ...(helpButtonPosition === 'top-left' && { top: 20, left: 20 }),
    ...(helpButtonPosition === 'bottom-right' && { bottom: 20, right: 20 }),
    ...(helpButtonPosition === 'bottom-left' && { bottom: 20, left: 20 }),
  };

  return (
    <>
      {showHelpButton && (
        <Button
          type="primary"
          shape="circle"
          icon={<QuestionCircleOutlined />}
          onClick={handleStartGuide}
          style={helpButtonStyle}
          title="开始新手引导"
        />
      )}
      <Tour
        open={open}
        onClose={handleClose}
        current={current}
        onChange={handleChange}
        onFinish={handleFinish}
        steps={tourSteps}
        type="primary"
      />
    </>
  );
};

// 同时提供命名导出和默认导出
export { OnboardingGuide };
export default OnboardingGuide;

