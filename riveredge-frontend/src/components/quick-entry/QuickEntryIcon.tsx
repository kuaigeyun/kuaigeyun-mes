/**
 * 扁平化快捷入口图标组件
 *
 * 统一设计风格，无液态玻璃/毛玻璃效果
 */

import React from 'react';
import { theme } from 'antd';

const { useToken } = theme;

/** 图标容器边长 */
export const QUICK_ENTRY_ICON_BOX_SIZE = 52;
/** 图标容器圆角（固定 8px） */
export const QUICK_ENTRY_ICON_BORDER_RADIUS = 8;
/** 图标字号 */
export const QUICK_ENTRY_ICON_FONT_SIZE = 20;

export interface QuickEntryIconProps {
  /** 图标 */
  icon: React.ReactNode;
  /** 标题 */
  title: string;
  /** 点击事件 */
  onClick?: () => void;
  /** 背景渐变色（可选，用于不同功能的不同颜色） */
  gradient?: string;
  /** 简约主题：灰底 + 主色图标 */
  plain?: boolean;
  /** 是否可编辑模式 */
  editable?: boolean;
  /** 删除事件（编辑模式下） */
  onDelete?: () => void;
  /** 右键删除事件（非编辑态快捷删除） */
  onContextDelete?: () => void;
}

/**
 * 扁平化快捷入口图标组件
 */
export const QuickEntryIcon: React.FC<QuickEntryIconProps> = ({
  icon,
  title,
  onClick,
  gradient,
  plain = false,
  editable = false,
  onDelete,
  onContextDelete,
}) => {
  const { token } = useToken();

  const bgColor = gradient || token.colorPrimary;
  const glyphColor = plain ? token.colorPrimary : '#ffffff';

  return (
    <div
      className={['quick-entry-icon', plain ? 'quick-entry-icon--plain' : ''].filter(Boolean).join(' ')}
      style={{
        position: 'relative',
        width: '100%',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
      }}
      onClick={onClick}
      onContextMenu={(e) => {
        if (!onContextDelete) return;
        e.preventDefault();
        e.stopPropagation();
        onContextDelete();
      }}
    >
      <div
        className="quick-entry-icon__box"
        style={{
          width: QUICK_ENTRY_ICON_BOX_SIZE,
          height: QUICK_ENTRY_ICON_BOX_SIZE,
          flexShrink: 0,
          borderRadius: QUICK_ENTRY_ICON_BORDER_RADIUS,
          background: bgColor,
          boxShadow: token.boxShadowTertiary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease',
          position: 'relative',
          overflow: 'hidden',
          marginBottom: 4,
        }}
        onMouseEnter={(e) => {
          if (onClick) {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = token.boxShadowSecondary;
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = token.boxShadowTertiary;
        }}
      >
        <div
          className="quick-entry-icon__glyph"
          style={{
            fontSize: QUICK_ENTRY_ICON_FONT_SIZE,
            color: glyphColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            lineHeight: 1,
          }}
        >
          {icon}
        </div>

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
              width: '22px',
              height: '22px',
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
              boxShadow: token.boxShadowTertiary,
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

      <div
        className="quick-entry-icon__title"
        style={{
          color: token.colorText,
          fontWeight: 400,
          textAlign: 'center',
          lineHeight: 1.3,
          width: '100%',
          minWidth: 0,
          padding: '0 2px',
        }}
      >
        {title}
      </div>
    </div>
  );
};

export default QuickEntryIcon;
