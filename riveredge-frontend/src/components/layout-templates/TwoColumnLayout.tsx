/**
 * 两栏布局组件
 *
 * 用于统一管理左右两栏布局的页面，左侧一般为搜索、新增等按钮和树形结构，
 * 右侧为标题栏、内容区和状态栏。
 * 遵循 Ant Design 设计规范，使用布局常量配置
 *
 * Author: Luigi Lu
 * Date: 2025-12-26
 *
 * @example
 * ```tsx
 * <TwoColumnLayout
 *   leftPanel={{
 *     search: {
 *       placeholder: "搜索分组",
 *       value: searchValue,
 *       onChange: setSearchValue,
 *     },
 *     actions: [
 *       <Button type="primary" icon={<PlusOutlined />} block onClick={handleCreate}>
 *         新建分组
 *       </Button>
 *     ],
 *     tree: {
 *       treeData: treeData,
 *       selectedKeys: selectedKeys,
 *       onSelect: handleSelect,
 *       // ... 其他 Tree 属性
 *     },
 *   }}
 *   rightPanel={{
 *     header: {
 *       left: <Space>刷新按钮等</Space>,
 *       center: <span>标题信息</span>,
 *       right: <Space>操作按钮</Space>,
 *     },
 *     content: <UniTable ... />,
 *     footer: <span>状态信息</span>,
 *   }}
 * />
 * ```
 */

import React, { ReactNode } from 'react';
import { Input, Space, Spin, Tree, theme } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import type { DataNode, TreeProps } from 'antd/es/tree';
import { TWO_COLUMN_LAYOUT, PAGE_SPACING } from './constants';

const { useToken } = theme;

/**
 * 左侧面板配置
 */
export interface LeftPanelConfig {
  /**
   * 搜索框配置（可选）
   */
  search?: {
    placeholder?: string;
    value?: string;
    onChange?: (value: string) => void;
    allowClear?: boolean;
  };
  /**
   * 操作按钮列表（可选）
   * 这些按钮会显示在搜索框下方
   */
  actions?: ReactNode[];
  /**
   * 树形结构配置（必需）
   */
  tree: {
    /**
     * 树数据
     */
    treeData: DataNode[];
    /**
     * 选中的节点
     */
    selectedKeys?: React.Key[];
    /**
     * 展开的节点
     */
    expandedKeys?: React.Key[];
    /**
     * 选择回调
     */
    onSelect?: TreeProps['onSelect'];
    /**
     * 展开回调
     */
    onExpand?: TreeProps['onExpand'];
    /**
     * 是否显示图标
     */
    showIcon?: boolean;
    /**
     * 是否块级节点
     */
    blockNode?: boolean;
    /**
     * 右键点击回调
     */
    onRightClick?: TreeProps['onRightClick'];
    /**
     * 树组件的 className
     */
    className?: string;
    /**
     * 加载状态
     */
    loading?: boolean;
    /**
     * 其他 Tree 属性
     */
    [key: string]: any;
  };
  /**
   * 左侧面板宽度（默认：300px）
   */
  width?: number | string;
  /**
   * 左侧面板最小宽度（默认：200px）
   */
  minWidth?: number | string;
}

/**
 * 右侧面板配置
 */
export interface RightPanelConfig {
  /**
   * 顶部工具栏配置（可选）
   */
  header?: {
    /**
     * 左侧内容（如刷新按钮等）
     */
    left?: ReactNode;
    /**
     * 中间内容（如标题、标签等）
     */
    center?: ReactNode;
    /**
     * 右侧内容（如操作按钮等）
     */
    right?: ReactNode;
  };
  /**
   * 内容区（必需）
   */
  content: ReactNode;
  /**
   * 底部状态栏（可选）
   */
  footer?: ReactNode;
  /**
   * 内容区背景色（默认：浅色填充）
   */
  contentBackgroundColor?: string;
}

/**
 * 两栏布局组件属性
 */
export interface TwoColumnLayoutProps {
  /**
   * 左侧面板配置
   */
  leftPanel: LeftPanelConfig;
  /**
   * 右侧面板配置
   */
  rightPanel: RightPanelConfig;
  /**
   * 自定义样式类名
   */
  className?: string;
  /**
   * 自定义样式
   */
  style?: React.CSSProperties;
}

/**
 * 两栏布局组件
 */
export const TwoColumnLayout: React.FC<TwoColumnLayoutProps> = ({
  leftPanel,
  rightPanel,
  className,
  style,
}) => {
  const { token } = useToken();

  const {
    search,
    actions = [],
    tree,
    width = TWO_COLUMN_LAYOUT.LEFT_PANEL_WIDTH,
    minWidth = TWO_COLUMN_LAYOUT.LEFT_PANEL_MIN_WIDTH,
  } = leftPanel;

  const {
    header,
    content,
    footer,
    contentBackgroundColor = token.colorFillAlter || '#fafafa',
  } = rightPanel;

  // 提取树组件的属性
  const {
    treeData,
    selectedKeys,
    expandedKeys,
    onSelect,
    onExpand,
    showIcon = false,
    blockNode = false,
    onRightClick,
    className: treeClassName,
    loading = false,
    ...treeRestProps
  } = tree;

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        height: 'calc(100vh - 96px)',
        padding: `${PAGE_SPACING.PADDING}px`,
        margin: 0,
        boxSizing: 'border-box',
        borderRadius: token.borderRadiusLG || token.borderRadius,
        overflow: 'hidden',
        ...style,
      }}
    >
      {/* 左侧面板 */}
      <div
        style={{
          width: typeof width === 'number' ? `${width}px` : width,
          minWidth: typeof minWidth === 'number' ? `${minWidth}px` : minWidth,
          flexShrink: 0,
          borderTop: `1px solid ${token.colorBorder}`,
          borderBottom: `1px solid ${token.colorBorder}`,
          borderLeft: `1px solid ${token.colorBorder}`,
          borderRight: 'none',
          backgroundColor: token.colorFillAlter || '#fafafa',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          borderTopLeftRadius: token.borderRadiusLG || token.borderRadius,
          borderBottomLeftRadius: token.borderRadiusLG || token.borderRadius,
        }}
      >
        {/* 搜索栏 */}
        {search && (
          <div
            style={{
              padding: '8px',
              borderBottom: `1px solid ${token.colorBorder}`,
              display: 'flex',
              alignItems: 'center',
              height: '48px',
              boxSizing: 'border-box',
              lineHeight: '32px',
            }}
          >
            <Input
              placeholder={search.placeholder || '搜索'}
              prefix={<SearchOutlined />}
              value={search.value}
              onChange={(e) => search.onChange?.(e.target.value)}
              allowClear={search.allowClear !== false}
              size="middle"
            />
          </div>
        )}

        {/* 操作按钮 */}
        {actions.length > 0 && (
          <div style={{ padding: '8px', borderBottom: `1px solid ${token.colorBorder}` }}>
            {actions.map((action, index) => (
              <div key={index} style={{ marginBottom: index < actions.length - 1 ? '8px' : 0 }}>
                {action}
              </div>
            ))}
          </div>
        )}

        {/* 树形结构 */}
        <div
          className="left-panel-scroll-container"
          style={{ flex: 1, overflow: 'auto', padding: '8px' }}
        >
          <Spin spinning={loading}>
            <Tree
              className={treeClassName}
              treeData={treeData}
              selectedKeys={selectedKeys}
              expandedKeys={expandedKeys}
              onSelect={onSelect}
              onExpand={onExpand}
              showIcon={showIcon}
              blockNode={blockNode}
              onRightClick={onRightClick}
              {...treeRestProps}
            />
          </Spin>
        </div>
      </div>

      {/* 右侧主内容区 */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: token.colorBgContainer,
          border: `1px solid ${token.colorBorder}`,
          borderLeft: 'none',
          borderTopRightRadius: token.borderRadiusLG || token.borderRadius,
          borderBottomRightRadius: token.borderRadiusLG || token.borderRadius,
        }}
      >
        {/* 顶部工具栏 */}
        {header && (
          <div
            style={{
              borderBottom: `1px solid ${token.colorBorder}`,
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              height: '48px',
              boxSizing: 'border-box',
              lineHeight: '32px',
            }}
          >
            {header.left && <Space>{header.left}</Space>}
            {header.center && <div style={{ flex: 1 }}>{header.center}</div>}
            {header.right && <Space>{header.right}</Space>}
          </div>
        )}

        {/* 内容区：overflow-y auto 以便 UniTable 不设 scroll.y 时（行少未溢出）无竖直滚动条，行多时由外层滚动 */}
        <div
          className="two-column-layout-content"
          style={{
            flex: 1,
            overflowX: 'hidden',
            overflowY: 'auto',
            padding: '16px',
            backgroundColor: contentBackgroundColor,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
          }}
        >
          {content}
        </div>

        {/* 底部状态栏 */}
        {footer && (
          <div
            style={{
              borderTop: `1px solid ${token.colorBorder}`,
              padding: '8px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '12px',
              color: token.colorTextSecondary,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default TwoColumnLayout;

