/**
 * 工位机触屏模式布局模板
 *
 * 提供统一的工位机触屏模式布局，大按钮、大字体、全屏模式
 * 遵循 Ant Design 设计规范，针对触屏操作优化
 *
 * Author: Luigi Lu
 * Date: 2025-12-26
 */

import React, { ReactNode, useEffect } from 'react';
import { Button, theme, Space } from 'antd';
import { TOUCH_SCREEN_CONFIG, ANT_DESIGN_TOKENS } from './constants';

const { useToken } = theme;

/**
 * 触屏按钮配置
 */
export interface TouchScreenButton {
  /** 标题 */
  title: string;
  /** 图标 */
  icon?: ReactNode;
  /** 点击事件 */
  onClick: () => void;
  /** 按钮类型 */
  type?: 'primary' | 'default' | 'dashed' | 'link' | 'text';
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否占据全宽 */
  block?: boolean;
}

/**
 * 工位机触屏模式模板属性
 */
export interface TouchScreenTemplateProps {
  /** 标题 */
  title?: string;
  /** 主要内容 */
  children: ReactNode;
  /** 底部操作按钮 */
  footerButtons?: TouchScreenButton[];
  /** 是否全屏模式 */
  fullscreen?: boolean;
  /** 自定义样式类名 */
  className?: string;
  /** 自定义样式 */
  style?: React.CSSProperties;
}

/**
 * 工位机触屏模式布局模板
 *
 * @example
 * ```tsx
 * <TouchScreenTemplate
 *   title="现场报工"
 *   footerButtons={[
 *     { title: '提交', type: 'primary', onClick: handleSubmit, block: true },
 *   ]}
 * >
 *   <TouchScreenForm ... />
 * </TouchScreenTemplate>
 * ```
 */
export const TouchScreenTemplate: React.FC<TouchScreenTemplateProps> = ({
  title,
  children,
  footerButtons = [],
  fullscreen = true,
  className,
  style,
}) => {
  const { token } = useToken();

  // 全屏模式处理
  useEffect(() => {
    if (fullscreen) {
      // 进入全屏模式
      const enterFullscreen = () => {
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {
            // 忽略全屏请求失败
          });
        }
      };

      // 尝试进入全屏（需要用户交互）
      // 这里不自动触发，由用户操作触发

      return () => {
        // 退出全屏模式
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {
            // 忽略退出全屏失败
          });
        }
      };
    }
  }, [fullscreen]);

  return (
    <div
      className={className}
      style={{
        width: '100%',
        height: fullscreen ? '100vh' : 'auto',
        padding: `${ANT_DESIGN_TOKENS.SPACING.LG}px`,
        backgroundColor: token.colorBgLayout,
        display: 'flex',
        flexDirection: 'column',
        fontSize: TOUCH_SCREEN_CONFIG.FONT_MIN_SIZE,
        ...style,
      }}
    >
      {/* 标题区域 */}
      {title && (
        <div
          style={{
            fontSize: TOUCH_SCREEN_CONFIG.TITLE_FONT_SIZE,
            fontWeight: 600,
            marginBottom: ANT_DESIGN_TOKENS.SPACING.LG,
            textAlign: 'center',
            color: token.colorTextHeading,
          }}
        >
          {title}
        </div>
      )}

      {/* 内容区域 */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          marginBottom: footerButtons.length > 0 ? ANT_DESIGN_TOKENS.SPACING.LG : 0,
        }}
      >
        {children}
      </div>

      {/* 底部操作按钮 */}
      {footerButtons.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: ANT_DESIGN_TOKENS.SPACING.MD,
            paddingTop: ANT_DESIGN_TOKENS.SPACING.MD,
            borderTop: `1px solid ${token.colorBorder}`,
          }}
        >
          {footerButtons.map((button, index) => (
            <Button
              key={index}
              type={button.type || 'primary'}
              icon={button.icon}
              onClick={button.onClick}
              disabled={button.disabled}
              block={button.block !== false}
              size="large"
              style={{
                height: `${TOUCH_SCREEN_CONFIG.BUTTON_MIN_HEIGHT}px`,
                fontSize: TOUCH_SCREEN_CONFIG.FONT_MIN_SIZE,
                fontWeight: 500,
              }}
            >
              {button.title}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
};

export default TouchScreenTemplate;

