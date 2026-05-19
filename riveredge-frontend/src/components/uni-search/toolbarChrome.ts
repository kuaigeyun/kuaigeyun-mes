import type { GlobalToken } from 'antd/es/theme/interface';
import type { CSSProperties } from 'react';

/** 列表工具栏控件统一高度（与 UniSearch 模糊搜索框一致） */
export const UNI_TOOLBAR_CONTROL_HEIGHT = 32;

/**
 * 列表工具栏控件外框：圆角 / 描边 / 背景与 ant Input 默认一致，无额外阴影。
 * 用于分段选择器、模糊搜索等并排控件的设计对齐。
 */
export function getUniToolbarControlShellStyle(token: GlobalToken): CSSProperties {
  return {
    height: UNI_TOOLBAR_CONTROL_HEIGHT,
    boxSizing: 'border-box',
    borderRadius: token.borderRadius,
    border: `1px solid ${token.colorBorder}`,
    background: token.colorBgContainer,
    boxShadow: 'none',
  };
}

/** 工具栏并排控件在 flex 容器中的 class，配合 global.less 统一 Segmented 内层高度 */
export const UNI_TOOLBAR_SEGMENTED_CLASS = 'uni-toolbar-segmented';
