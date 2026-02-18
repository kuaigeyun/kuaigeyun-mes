/**
 * 画板页布局模板
 *
 * 用于带画板的页面统一布局：操作条 + 画板 + 右侧面板。
 * 适用场景：审批流设计、工程 BOM 设计、思维导图等以画布为核心的设计器页面。
 * 主内容区仅包含上述三块，边距遵循 PAGE_SPACING（16px）。
 *
 * Author: Luigi Lu
 * Date: 2026-01-27
 *
 * @example
 * ```tsx
 * <CanvasPageTemplate
 *   toolbar={
 *     <Space>
 *       <Button type="primary" icon={<SaveOutlined />}>保存</Button>
 *       <Button icon={<CloseOutlined />}>返回</Button>
 *     </Space>
 *   }
 *   canvas={<MindMap {...config} />}
 *   rightPanel={{
 *     title: '节点配置',
 *     children: <Form>...</Form>,
 *   }}
 * />
 * ```
 */

import React, { ReactNode, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Card } from 'antd';
import { PAGE_SPACING, CANVAS_PAGE_LAYOUT } from './constants';

/** 右侧面板配置 */
export interface CanvasPageRightPanelConfig {
  /** 面板标题 */
  title?: ReactNode;
  /** 面板内容 */
  children: ReactNode;
}

export interface CanvasPageTemplateProps {
  /** 操作条内容（如保存、返回、添加、删除等按钮） */
  toolbar: ReactNode;
  /** 画板内容（流程图、MindMap、画布等） */
  canvas: ReactNode;
  /** 右侧配置/属性面板（可选，不传则画板占满宽度，如 pdfme 原生编辑器） */
  rightPanel?: CanvasPageRightPanelConfig;
  /** 右侧面板宽度，默认 400 */
  rightPanelWidth?: number;
  /** 画板最小高度，默认 600 */
  canvasMinHeight?: number;
  /** 外层容器样式 */
  style?: React.CSSProperties;
  /** 外层容器类名 */
  className?: string;
  /** 固定功能标题（用于 Tabs 和面包屑） */
  functionalTitle?: string;
}

/**
 * 画板页布局模板
 *
 * 主内容区仅包含：操作条、画板、右侧面板，边距 16px。
 */
export const CanvasPageTemplate: React.FC<CanvasPageTemplateProps> = ({
  toolbar,
  canvas,
  rightPanel,
  rightPanelWidth = CANVAS_PAGE_LAYOUT.RIGHT_PANEL_WIDTH,
  canvasMinHeight = CANVAS_PAGE_LAYOUT.CANVAS_MIN_HEIGHT,
  style,
  className,
  functionalTitle = '设计器',
}) => {
  const location = useLocation();

  useEffect(() => {
    // 发送自定义事件更新 UniTabs 内部标签标题
    // 浏览器标题 document.title 仍由 BasicLayout 统一标准化设置（包含组织名称）
    const tabKey = location.pathname + location.search;
    window.dispatchEvent(
      new CustomEvent('riveredge:update-tab-title', {
        detail: { key: tabKey, title: functionalTitle },
      })
    );
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

      {/* 画板 + 右侧面板 */}
      <div
        style={{
          display: 'flex',
          flex: 1,
          gap: padding,
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        {/* 画板 */}
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
              minHeight: canvasMinHeight,
              position: 'relative',
            }}
          >
            {canvas}
          </div>
        </Card>

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
