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
import { useTranslation } from 'react-i18next';
import type { DataNode, TreeProps } from 'antd/es/tree';
import { TWO_COLUMN_LAYOUT } from './constants';

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
    /** 回车或点击搜索图标时触发（提供后使用 Input.Search） */
    onSearch?: (value: string) => void;
    allowClear?: boolean;
  };
  /**
   * 操作按钮列表（可选）
   * 这些按钮会显示在搜索框下方
   */
  actions?: ReactNode[];
  /**
   * 自定义左侧内容（与 tree 二选一，用于扁平列表等非树场景）
   */
  leftContent?: ReactNode;
  /**
   * 树形结构配置（与 leftContent 二选一）
   */
  tree?: {
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
     * 加载提示文案（与编号规则左侧列表一致：居中 Spin + 文案）
     */
    loadingTip?: string;
    /**
     * 其他 Tree 属性
     */
    [key: string]: any;
  };
  /**
   * 左侧面板宽度（默认：320px）
   */
  width?: number | string;
  /**
   * 左侧面板最小宽度（默认：200px）
   */
  minWidth?: number | string;
  /**
   * 左侧面板是否已收起（可选）
   */
  collapsed?: boolean;
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
  /**
   * 内容区内边距（默认 16；复杂页可设为 0 由内部自行留白）
   */
  contentPadding?: number | string;
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
  const { t } = useTranslation();
  const { token } = useToken();

  const {
    search,
    actions = [],
    leftContent,
    tree,
    width = TWO_COLUMN_LAYOUT.LEFT_PANEL_WIDTH,
    minWidth = TWO_COLUMN_LAYOUT.LEFT_PANEL_MIN_WIDTH,
    collapsed = false,
  } = leftPanel;

  const {
    header,
    content,
    footer,
    contentBackgroundColor = token.colorFillAlter || '#fafafa',
    contentPadding = 16,
  } = rightPanel;

  const treeProps = tree
    ? (() => {
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
          loadingTip,
          height: _treeHeightIgnored,
          virtual: _treeVirtualIgnored,
          ...treeRestProps
        } = tree;
        return {
          treeData,
          selectedKeys,
          expandedKeys,
          onSelect,
          onExpand,
          showIcon,
          blockNode,
          onRightClick,
          treeClassName,
          loading,
          loadingTip,
          treeRestProps,
        };
      })()
    : null;

  return (
    <div
      className={`two-column-layout ${className || ''}`.trim()}
      style={{
        display: 'flex',
        flex: 1,
        width: '100%',
        minHeight: TWO_COLUMN_LAYOUT.MIN_HEIGHT,
        height: '100%',
        padding: 0,
        margin: 0,
        boxSizing: 'border-box',
        borderRadius: token.borderRadiusLG || token.borderRadius,
        overflow: 'hidden',
        alignSelf: 'stretch',
        ...style,
      }}
    >
      {/* 左侧面板 */}
      <div
        style={{
          width: collapsed ? 0 : (typeof width === 'number' ? `${width}px` : width),
          minWidth: collapsed ? 0 : (typeof minWidth === 'number' ? `${minWidth}px` : minWidth),
          flexShrink: 0,
          borderTop: `1px solid ${token.colorBorder}`,
          borderBottom: `1px solid ${token.colorBorder}`,
          borderLeft: `1px solid ${token.colorBorder}`,
          borderRight: collapsed ? 'none' : `1px solid ${token.colorBorder}`,
          backgroundColor: token.colorFillAlter || '#fafafa',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          borderTopLeftRadius: token.borderRadiusLG || token.borderRadius,
          borderBottomLeftRadius: token.borderRadiusLG || token.borderRadius,
          transition: 'all 0.3s ease',
          overflow: 'hidden',
          opacity: collapsed ? 0 : 1,
          visibility: collapsed ? 'hidden' : 'visible',
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
              height: TWO_COLUMN_LAYOUT.PANEL_HEADER_HEIGHT,
              boxSizing: 'border-box',
              lineHeight: '32px',
            }}
          >
            {search.onSearch ? (
              <Input.Search
                placeholder={search.placeholder || t('components.layoutTemplates.twoColumn.searchPlaceholder')}
                value={search.value}
                onChange={(e) => search.onChange?.(e.target.value)}
                onSearch={(v) => search.onSearch?.(v)}
                allowClear={search.allowClear !== false}
                size="middle"
              />
            ) : (
              <Input
                placeholder={search.placeholder || t('components.layoutTemplates.twoColumn.searchPlaceholder')}
                prefix={<SearchOutlined />}
                value={search.value}
                onChange={(e) => search.onChange?.(e.target.value)}
                allowClear={search.allowClear !== false}
                size="middle"
              />
            )}
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

        {leftContent ? (
          <div
            className="two-column-layout-left-custom scrollbar-like-modal"
            style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column' }}
          >
            {leftContent}
          </div>
        ) : treeProps ? (
          <div
            className="two-column-layout-left-tree scrollbar-like-modal"
            style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '8px' }}
          >
            {treeProps.loading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <Spin size="large" />
                {treeProps.loadingTip ? (
                  <div style={{ marginTop: '16px', color: token.colorTextSecondary }}>{treeProps.loadingTip}</div>
                ) : null}
              </div>
            ) : (
              <Tree
                motion={null}
                className={treeProps.treeClassName}
                treeData={treeProps.treeData}
                selectedKeys={treeProps.selectedKeys}
                expandedKeys={treeProps.expandedKeys}
                onSelect={treeProps.onSelect}
                onExpand={treeProps.onExpand}
                showIcon={treeProps.showIcon}
                blockNode={treeProps.blockNode}
                onRightClick={treeProps.onRightClick}
                {...treeProps.treeRestProps}
                virtual={false}
              />
            )}
          </div>
        ) : null}
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
          borderLeft: collapsed ? `1px solid ${token.colorBorder}` : 'none',
          borderTopRightRadius: token.borderRadiusLG || token.borderRadius,
          borderBottomRightRadius: token.borderRadiusLG || token.borderRadius,
          borderTopLeftRadius: collapsed ? token.borderRadiusLG || token.borderRadius : 0,
          borderBottomLeftRadius: collapsed ? token.borderRadiusLG || token.borderRadius : 0,
          transition: 'all 0.3s ease',
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
              height: TWO_COLUMN_LAYOUT.PANEL_HEADER_HEIGHT,
              boxSizing: 'border-box',
              lineHeight: '32px',
            }}
          >
            {header.left && <Space>{header.left}</Space>}
            {header.center && <div style={{ flex: 1 }}>{header.center}</div>}
            {header.right && <Space>{header.right}</Space>}
          </div>
        )}

        {/* 内容区：可滚动但不显示滚动条 */}
        <div
          className="two-column-layout-content two-column-layout-right-content-scroll"
          style={{
            flex: 1,
            minHeight: 0,
            overflowX: 'hidden',
            overflowY: 'auto',
            padding: contentPadding,
            backgroundColor: contentBackgroundColor,
            display: 'flex',
            flexDirection: 'column',
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

