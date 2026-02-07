/**
 * iOS风格快捷入口图标组件
 * 
 * 实现iOS 26液态玻璃效果（glassmorphism）
 * 
 * Author: Luigi Lu
 * Date: 2026-01-21
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
 * iOS风格快捷入口图标组件
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

  // 液态玻璃背景：主题色原色（无透明）+ 毛玻璃高光
  const glassBackground = gradient || `linear-gradient(135deg, ${token.colorPrimary} 0%, ${token.colorPrimary} 100%)`;

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
      {/* 液态玻璃效果图标容器（frosted glass + 高光） */}
      <div
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '16px',
          background: glassBackground,
          backdropFilter: 'blur(16px) saturate(180%)',
          WebkitBackdropFilter: 'blur(16px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.5)',
          boxShadow: `
            0 8px 32px 0 rgba(0, 0, 0, 0.08),
            inset 0 1px 0 0 rgba(255, 255, 255, 0.6),
            inset 0 -1px 0 0 rgba(255, 255, 255, 0.1)
          `,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          position: 'relative',
          overflow: 'hidden',
          marginBottom: '6px',
        }}
        onMouseEnter={(e) => {
          if (onClick) {
            e.currentTarget.style.transform = 'scale(1.05) translateY(-2px)';
            e.currentTarget.style.boxShadow = `
              0 12px 40px 0 rgba(0, 0, 0, 0.12),
              inset 0 1px 0 0 rgba(255, 255, 255, 0.6),
              inset 0 -1px 0 0 rgba(255, 255, 255, 0.1)
            `;
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1) translateY(0)';
          e.currentTarget.style.boxShadow = `
            0 8px 32px 0 rgba(0, 0, 0, 0.08),
            inset 0 1px 0 0 rgba(255, 255, 255, 0.6),
            inset 0 -1px 0 0 rgba(255, 255, 255, 0.1)
          `;
        }}
      >
        {/* 液态玻璃高光效果 */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '50%',
            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.35) 0%, transparent 100%)',
            borderRadius: '16px 16px 0 0',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />

        {/* 图标 - 白色原色，无透明 */}
        <div
          style={{
            fontSize: '24px',
            color: '#ffffff',
            filter: 'none',
            zIndex: 2,
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
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
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

      {/* 标题文字（在图标外部下方） */}
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
