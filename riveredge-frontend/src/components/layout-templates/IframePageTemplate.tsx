/**
 * Iframe 页面布局模板
 * 
 * 专门用于嵌入外部页面的布局模板
 * 自动处理 100% 高度和圆角样式，遵循 16px 全局内边距规范
 * 
 * @example
 * <IframePageTemplate src="https://example.com" title="Example" />
 */

import React from 'react';
import { theme } from 'antd';

export interface IframePageTemplateProps {
  /** Iframe 地址 */
  src: string;
  /** 标题 (用于 accessibility) */
  title?: string;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: React.CSSProperties;
}

export const IframePageTemplate: React.FC<IframePageTemplateProps> = ({
  src,
  title = 'Iframe Page',
  className,
  style,
}) => {
  const { token } = theme.useToken();

  return (
    <div
      className={className}
      style={{
        // 动态高度计算：100vh - 顶栏(var(--header-height)) - 标签栏(var(--tabs-height)) - 上下边距(32px)
        height: 'calc(100vh - var(--header-height, 56px) - var(--tabs-height, 56px) - 16px)',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      <iframe
        src={src}
        title={title}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          flex: 1,
          borderRadius: token.borderRadiusLG, // 统一使用系统圆角
          overflow: 'hidden',
          backgroundColor: token.colorBgContainer,
        }}
      />
    </div>
  );
};

export default IframePageTemplate;
