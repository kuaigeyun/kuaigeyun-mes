/**
 * 扁平化快捷入口图标组件
 *
 * 统一设计风格，无液态玻璃/毛玻璃效果
 */

import React from 'react';
import { theme } from 'antd';

const { useToken } = theme;

export interface QuickEntryIconProps {
  /** 图标 */
  icon: React.ReactNode;
  /** 标题 */
  title: string;
  /** 点击事件 */
  onClick?: () => void;
  /** 背景渐变色（可选，用于不同功能的不同颜色） */
  gradient?: string;
  /** 是否可编辑模式 */
  editable?: boolean;
  /** 删除事件（编辑模式下） */
  onDelete?: () => void;
}

/**
 * 扁平化快捷入口图标组件
 */
export const QuickEntryIcon: React.FC<QuickEntryIconProps> = ({
  icon,
  title,
  onClick,
  gradient,
  editable = false,
  onDelete,
}) => {
  const { token } = useToken();

  const bgColor = gradient || token.colorPrimary;

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
      }}
      onClick={onClick}
    >
      {/* 扁平图标容器 */}
      <div
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '12px',
          background: bgColor,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease',
          position: 'relative',
          overflow: 'hidden',
          marginBottom: '6px',
        }}
        onMouseEnter={(e) => {
          if (onClick) {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.16)';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.12)';
        }}
      >
        {/* 图标 */}
        <div
          style={{
            fontSize: '24px',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {icon}
        </div>

        {/* 删除按钮（编辑模式下） */}
        {editable && onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            style={{
              position: 'absolute',
              top: '-8px',
              right: '-8px',
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: '#ff4d4f',
              border: '2px solid #ffffff',
              color: '#ffffff',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 10,
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.2)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.1)';
              e.currentTarget.style.background = '#ff7875';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.background = '#ff4d4f';
            }}
          >
            ×
          </button>
        )}
      </div>

      {/* 标题文字 */}
      <div
        style={{
          fontSize: '12px',
          color: token.colorText,
          fontWeight: 400,
          textAlign: 'center',
          lineHeight: 1.4,
          maxWidth: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          padding: '0 2px',
          marginTop: '4px',
        }}
      >
        {title}
      </div>
    </div>
  );
};

export default QuickEntryIcon;
