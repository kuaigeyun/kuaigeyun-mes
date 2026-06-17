/**
 * 画板页布局模板
 *
 * 用于带画板的页面统一布局：操作条 + 画板 + 右侧面板。
 * 适用场景：审批流设计、工程 BOM 设计、思维导图等以画布为核心的设计器页面。
 * 主内容区仅包含上述三块，边距遵循 PAGE_SPACING（16px）。
 *
 * Author: Luigi Lu
 * Date: 2026-01-27
 */

import React, { ReactNode, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Card } from 'antd';
import {
  PAGE_SPACING,
  CANVAS_PAGE_LAYOUT,
  CANVAS_VISUAL_BASE,
  SYSTEM_VIEWPORT_OFFSETS,
  getViewportHeightExpr,
} from './constants';

/** 侧边面板配置 */
export interface CanvasPageSidePanelConfig {
  /** 面板标题 */
  title?: ReactNode;
  /** 面板内容 */
  children: ReactNode;
}

/** @deprecated 使用 CanvasPageSidePanelConfig */
export type CanvasPageRightPanelConfig = CanvasPageSidePanelConfig;

export interface CanvasPageTemplateProps {
  /** 操作条内容（如保存、返回、添加、删除等按钮） */
  toolbar: ReactNode;
  /** 画板内容（流程图、MindMap、画布等） */
  canvas: ReactNode;
  /** 左侧面板（可选，如阶段/表单管理） */
  leftPanel?: CanvasPageSidePanelConfig;
  /** 左侧面板宽度，默认 280 */
  leftPanelWidth?: number;
  /** 右侧配置/属性面板（可选，不传则画板占满宽度） */
  rightPanel?: CanvasPageSidePanelConfig;
  /** 右侧面板宽度，默认 400 */
  rightPanelWidth?: number;
  /** 外层容器样式 */
  style?: React.CSSProperties;
  /** 外层容器类名 */
  className?: string;
  /** 固定功能标题（用于 Tabs 和面包屑） */
  functionalTitle?: string;
  /**
   * 画布区域包裹方式：
   * - framed（默认）：外层 Card + 内层描边容器，适合流程图等画布
   * - plain：仅占满 flex 区域，无额外 Card/边框，适合表单+表格类分栏设计器
   */
  canvasSurface?: 'framed' | 'plain';
}

/**
 * 画板页布局模板
 *
 * 主内容区仅包含：操作条、画板、右侧面板，边距 16px。
 */
export const CanvasPageTemplate: React.FC<CanvasPageTemplateProps> = ({
  toolbar,
  canvas,
  leftPanel,
  leftPanelWidth = CANVAS_PAGE_LAYOUT.LEFT_PANEL_WIDTH,
  rightPanel,
  rightPanelWidth = CANVAS_PAGE_LAYOUT.RIGHT_PANEL_WIDTH,
  style,
  className,
  functionalTitle = '设计器',
  canvasSurface = 'framed',
}) => {
  const location = useLocation();

  useEffect(() => {
    // 发送自定义事件更新 UniTabs 内部标签标题
    const tabKey = location.pathname + location.search;
    if (typeof window !== 'undefined' && (window as any).CustomEvent) {
      window.dispatchEvent(
        new (window as any).CustomEvent('riveredge:update-tab-title', {
          detail: { key: tabKey, title: functionalTitle },
        })
      );
    }
  }, [location.pathname, location.search, functionalTitle]);

  const padding = PAGE_SPACING.PADDING;

  return (
    <div
      className={className}
      style={{
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: getViewportHeightExpr(SYSTEM_VIEWPORT_OFFSETS.CANVAS_PAGE_MIN_HEIGHT_PX, {
          compensateHeaderInFullscreen: true,
        }),
        overflow: 'hidden',
        ...style,
      }}
    >
      {/* 操作条 */}
      <Card
        size="small"
        style={{ marginBottom: padding }}
        styles={{ body: { padding: '12px 16px' } }}
      >
        {toolbar}
      </Card>

      {/* 左侧面板（可选）+ 画板 + 右侧面板（可选） */}
      <div
        style={{
          display: 'flex',
          flex: 1,
          gap: padding,
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        {/* 左侧面板（可选） */}
        {leftPanel && (
          <Card
            title={leftPanel.title}
            style={{
              width: leftPanelWidth,
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
            }}
            styles={{
              body: {
                flex: 1,
                overflow: 'auto',
                padding,
              },
            }}
          >
            {leftPanel.children}
          </Card>
        )}
        {/* 画板 */}
        {canvasSurface === 'plain' ? (
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {canvas}
          </div>
        ) : (
          <Card
            style={{
              flex: 1,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
            styles={{
              body: {
                padding: 0,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              },
            }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                flex: 1,
                position: 'relative',
                border: `1px solid ${CANVAS_VISUAL_BASE.BORDER_COLOR}`,
                borderRadius: CANVAS_VISUAL_BASE.BORDER_RADIUS,
                overflow: 'hidden',
                boxSizing: 'border-box',
              }}
            >
              {canvas}
            </div>
          </Card>
        )}

        {/* 右侧面板（可选） */}
        {rightPanel && (
          <Card
            title={rightPanel.title}
            style={{
              width: rightPanelWidth,
              display: 'flex',
              flexDirection: 'column',
            }}
            styles={{
              body: {
                flex: 1,
                overflow: 'auto',
                padding,
              },
            }}
          >
            {rightPanel.children}
          </Card>
        )}
      </div>
    </div>
  );
};
