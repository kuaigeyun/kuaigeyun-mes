/**
 * 向导布局模板
 *
 * 提供统一的步骤式向导布局，用于多步骤流程（如快速初始化向导）
 * 遵循 Ant Design 设计规范
 *
 * Author: Luigi Lu
 * Date: 2025-12-26
 */

import React, { ReactNode } from 'react';
import { Steps, Card, Button, Space, theme } from 'antd';
import { ANT_DESIGN_TOKENS, PAGE_SPACING } from './constants';

const { useToken } = theme;

/**
 * 向导步骤
 */
export interface WizardStep {
  /** 步骤标题 */
  title: string;
  /** 步骤描述（可选） */
  description?: string;
  /** 步骤内容 */
  content: ReactNode;
  /** 是否可选（跳过） */
  optional?: boolean;
}

/**
 * 向导模板属性
 */
export interface WizardTemplateProps {
  /** 步骤列表 */
  steps: WizardStep[];
  /** 当前步骤索引（从0开始） */
  current: number;
  /** 步骤变化回调 */
  onStepChange?: (step: number) => void;
  /** 上一步回调 */
  onPrev?: () => void;
  /** 下一步回调 */
  onNext?: () => void;
  /** 完成回调 */
  onFinish?: () => void;
  /** 是否显示上一步按钮 */
  showPrev?: boolean;
  /** 是否显示下一步按钮 */
  showNext?: boolean;
  /** 是否显示完成按钮 */
  showFinish?: boolean;
  /** 上一步按钮文本 */
  prevText?: string;
  /** 下一步按钮文本 */
  nextText?: string;
  /** 完成按钮文本 */
  finishText?: string;
  /** 是否禁用下一步 */
  nextDisabled?: boolean;
  /** 是否禁用完成 */
  finishDisabled?: boolean;
  /** 稍后完成回调（点击后不完成向导，仅跳转离开） */
  onSkip?: () => void;
  /** 稍后完成按钮文本 */
  skipText?: string;
  /** 自定义样式类名 */
  className?: string;
  /** 自定义样式 */
  style?: React.CSSProperties;
}

/**
 * 向导布局模板
 *
 * @example
 * ```tsx
 * <WizardTemplate
 *   steps={[
 *     { title: '选择模板', content: <TemplateSelection /> },
 *     { title: '基础信息', content: <BasicInfo /> },
 *     { title: '编码规则', content: <CodeRules /> },
 *     { title: '完成', content: <Completion /> },
 *   ]}
 *   current={currentStep}
 *   onStepChange={setCurrentStep}
 *   onFinish={handleFinish}
 * />
 * ```
 */
export const WizardTemplate: React.FC<WizardTemplateProps> = ({
  steps,
  current,
  onStepChange,
  onPrev,
  onNext,
  onFinish,
  showPrev = true,
  showNext = true,
  showFinish = true,
  prevText = '上一步',
  nextText = '下一步',
  finishText = '完成',
  nextDisabled = false,
  finishDisabled = false,
  onSkip,
  skipText = '稍后完成',
  className,
  style,
}) => {
  const { token } = useToken();

  const isFirstStep = current === 0;
  const isLastStep = current === steps.length - 1;

  const handlePrev = () => {
    if (current > 0) {
      const newStep = current - 1;
      onStepChange?.(newStep);
      onPrev?.();
    }
  };

  const handleNext = () => {
    if (current < steps.length - 1) {
      const newStep = current + 1;
      onStepChange?.(newStep);
      onNext?.();
    }
  };

  const handleFinish = () => {
    onFinish?.();
  };

  return (
    <div
      className={className}
      style={{
        padding: `0 ${PAGE_SPACING.PADDING}px ${PAGE_SPACING.PADDING}px ${PAGE_SPACING.PADDING}px`,
        ...style,
      }}
    >
      {/* 步骤指示器 */}
      <Card style={{ marginBottom: PAGE_SPACING.BLOCK_GAP }}>
        <Steps
          current={current}
          onChange={onStepChange}
          items={steps.map((step) => ({
            title: step.title,
            ...(step.description && { content: step.description }),
          }))}
        />
      </Card>

      {/* 步骤内容 */}
      <Card
        style={{
          minHeight: '400px',
          marginBottom: PAGE_SPACING.BLOCK_GAP,
        }}
      >
        {steps[current]?.content}
      </Card>

      {/* 操作按钮 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          paddingTop: ANT_DESIGN_TOKENS.SPACING.MD,
          borderTop: `1px solid ${token.colorBorder}`,
        }}
      >
        <Space>
          {showPrev && !isFirstStep && (
            <Button onClick={handlePrev}>
              {prevText}
            </Button>
          )}
          {onSkip && (
            <Button onClick={onSkip}>
              {skipText}
            </Button>
          )}
        </Space>
        <Space>
          {showNext && !isLastStep && (
            <Button
              type="primary"
              onClick={handleNext}
              disabled={nextDisabled}
            >
              {nextText}
            </Button>
          )}
          {showFinish && isLastStep && (
            <Button
              type="primary"
              onClick={handleFinish}
              disabled={finishDisabled}
            >
              {finishText}
            </Button>
          )}
        </Space>
      </div>
    </div>
  );
};

export default WizardTemplate;

