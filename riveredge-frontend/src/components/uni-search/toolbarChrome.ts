import type { GlobalToken } from 'antd/es/theme/interface';
import type { CSSProperties } from 'react';

/** 列表工具栏控件统一高度（与 UniSearch 模糊搜索框一致） */
export const UNI_TOOLBAR_CONTROL_HEIGHT = 32;

/** Segmented 轨道内边距（与 ThemedSegmented surfaceBackground / antd trackPadding 一致） */
export const UNI_TOOLBAR_SEGMENTED_TRACK_PADDING = 2;

/**
 * 分段选择器激活 thumb / 选项内圆角：外框圆角减去轨道 padding，与 Input 等控件跟随系统 borderRadius。
 * antd 默认 borderRadiusSM 在 borderRadius≥16 时封顶 8px，会与外框圆角脱节。
 */
export function computeSegmentedInsetBorderRadius(
  borderRadius: number,
  trackPadding = UNI_TOOLBAR_SEGMENTED_TRACK_PADDING,
): number {
  const pad = Number.isFinite(trackPadding) ? trackPadding : UNI_TOOLBAR_SEGMENTED_TRACK_PADDING;
  const outer = Number.isFinite(borderRadius) ? borderRadius : 0;
  return Math.max(0, outer - pad);
}

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

/** 页面头 / 表格外并排 Segmented + Select 等控件统一对齐 */
export const UNI_TOOLBAR_INLINE_CONTROLS_CLASS = 'uni-toolbar-inline-controls';
