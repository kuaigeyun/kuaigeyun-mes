/**
 * 列表页面布局模板
 *
 * 提供统一的列表页面布局，包括统计卡片（可选）和表格区域
 * 遵循 Ant Design 设计规范，减少硬编号
 *
 * 主内容推荐 `UniTable`：自页面文件相对路径 `import { UniTable } from '…/components/uni-table'`（`…` 随目录深度变化），并显式传入稳定 `columnPersistenceId`（与 `src/...` 路径对应的点分 id，见 `components/uni-table` 的 props 说明）。
 *
 * Author: Luigi Lu
 * Date: 2025-12-26
 */

import React, { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { Row, Col, Card, Statistic, theme as AntdTheme, Grid } from 'antd';
import { useLocation } from 'react-router-dom';
import { getListPageTableScrollOffsetPx, STAT_CARD_CONFIG, type ListPageTableScrollLayout } from './constants';
import {
  getListPageStatCardsVisible,
  ListPageStatCardsProvider,
  toListPageStatCardsPreferenceSegment,
} from './listPageStatCardsContext';
import { useUserPreferenceStore } from '../../stores/userPreferenceStore';
import { useThemeStore } from '../../stores/themeStore';


/**
 * 统计卡片数据
 */
export interface StatCard {
  /** 数据字段 key，用于页面合并原生统计的 trend/description */
  key?: string;
  /** 标题 */
  title: string;
  /** 数值 */
  value: number | string | ReactNode;
  /** 前缀（如图标或符号） */
  prefix?: ReactNode;
  /** 后缀（如单位） */
  suffix?: string;
  /** 数值样式颜色 */
  valueStyle?: React.CSSProperties;
  /** 精度 */
  precision?: number;
  /** 卡片点击事件 */
  onClick?: () => void;
  /** 数值下方的说明（如较昨日波动） */
  description?: ReactNode;
  /** 卡片底部的扩展区域（如图表） */
  footer?: ReactNode;
  /** 作为背景的微缩图表（如折线图、面积图） */
  backgroundChart?: ReactNode;
}

/**
 * 列表页面模板属性
 */
export interface ListPageTemplateProps {
  /** 统计卡片数据（可选） */
  statCards?: StatCard[];
  /** 主要内容（通常是 UniTable） */
  children: ReactNode;
  /**
   * @deprecated 列表页标题请放在路由 `name` / `PageContainer`；过渡期仍显示在表格上方。
   */
  title?: ReactNode;
  /**
   * @deprecated 请改用 `toolbarExtra` 放置操作按钮。
   */
  extra?: ReactNode;
  /** 工具栏扩展区（如导入、导出按钮，由 UniImport、UniExport 在页面层管理） */
  toolbarExtra?: ReactNode;
  /** 自定义样式类名 */
  className?: string;
  /** 自定义样式 */
  style?: React.CSSProperties;
  /**
   * 为 true（默认）时：在 DOM 中先挂载 children（表格），再挂载工具栏与指标卡，通过 flex `order` 保持「指标卡在上、表格在下」的视觉顺序。
   * 便于浏览器优先布局/绘制主内容；无表格的纯列表页可设 false。
   */
  prioritizeMainContentPaint?: boolean;
  /** 主内容区 flex 占满剩余高度（Outlook 分栏等非 UniTable 页面） */
  fillMain?: boolean;
  /** 指标卡显隐偏好键（默认当前路由 pathname；建议与 UniTable columnPersistenceId 对齐） */
  statCardsPreferenceKey?: string;
  /** 列表页表体 scroll.y 布局类型（MultiTab 模板传 multiTab） */
  tableScrollLayout?: ListPageTableScrollLayout;
  /**
   * 表格上方自定义区域（标题、指标卡等）额外占用的视口扣减（px）。
   * 与 `tableScrollLayout` / `statCards` 的自动扣减叠加，用于报表页自绘指标区等场景。
   */
  tableScrollOffsetExtraPx?: number;
}

/**
 * 列表页面布局模板
 *
 * @example
 * ```tsx
 * <ListPageTemplate
 *   statCards={[
 *     {
 *       title: '今日订单数',
 *       value: 12,
 *       prefix: <FileExcelOutlined />,
 *       valueStyle: { color: '#1890ff' },
 *     },
 *   ]}
 * >
 *   <UniTable ... />
 * </ListPageTemplate>
 * ```
 */
export const ListPageTemplate: React.FC<ListPageTemplateProps> = ({
  statCards,
  children,
  title,
  extra,
  toolbarExtra,
  className,
  style,
  prioritizeMainContentPaint = true,
  fillMain = false,
  statCardsPreferenceKey,
  tableScrollLayout = 'list',
  tableScrollOffsetExtraPx = 0,
}) => {
  const { token } = AntdTheme.useToken();
  const themeStyle = useThemeStore((s) => s.resolved.themeStyle);
  const isPlainTheme = themeStyle === 'plain';
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md && screens.xs;
  const location = useLocation();
  const preferences = useUserPreferenceStore((s) => s.preferences);
  const updatePreferences = useUserPreferenceStore((s) => s.updatePreferences);

  const statCardsPageKey = statCardsPreferenceKey ?? location.pathname;
  const statCardsPrefSegment = toListPageStatCardsPreferenceSegment(statCardsPageKey);

  const hasStatCardsRow = Boolean(statCards && statCards.length > 0 && !isMobile);

  const readStatCardsVisible = useCallback(
    () => getListPageStatCardsVisible(preferences, statCardsPageKey),
    [preferences, statCardsPageKey],
  );

  const [statCardsVisible, setStatCardsVisible] = useState(() => readStatCardsVisible());

  useEffect(() => {
    setStatCardsVisible(readStatCardsVisible());
  }, [readStatCardsVisible]);

  const toggleStatCardsVisible = useCallback(() => {
    setStatCardsVisible((prev) => {
      const next = !prev;
      const currentMap =
        (preferences?.ui as { list_page_stat_cards?: Record<string, boolean> } | undefined)
          ?.list_page_stat_cards ?? {};
      void updatePreferences({
        ui: {
          ...(typeof preferences?.ui === 'object' && preferences.ui !== null ? preferences.ui : {}),
          list_page_stat_cards: {
            ...currentMap,
            [statCardsPrefSegment]: next,
          },
        },
      });
      return next;
    });
  }, [preferences, statCardsPrefSegment, updatePreferences]);

  const showStatCardsRow = hasStatCardsRow && statCardsVisible;
  const tableScrollOffsetPx =
    getListPageTableScrollOffsetPx({
      layout: tableScrollLayout,
      hasStatCardsRow: showStatCardsRow,
    }) + tableScrollOffsetExtraPx;

  const statCardsContextValue = useMemo(
    () => ({
      enabled: hasStatCardsRow,
      visible: statCardsVisible,
      toggle: toggleStatCardsVisible,
      tableScrollOffsetPx,
    }),
    [hasStatCardsRow, statCardsVisible, toggleStatCardsVisible, tableScrollOffsetPx],
  );

  const statCardsRow =
    showStatCardsRow ? (
      <div style={{ marginBottom: 16 }}>
        <Row gutter={STAT_CARD_CONFIG.GUTTER} wrap={true}>
          {statCards.map((card, index) => (
            <Col
              key={index}
              style={{ flex: '1 1 240px', minWidth: 240 }} // flexible equal width, wraps if too narrow
            >
              <Card
                hoverable={!!card.onClick}
                onClick={card.onClick}
                style={{
                  cursor: card.onClick ? 'pointer' : 'default',
                  height: '100%',
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px 0 rgba(0, 0, 0, 0.02)',
                  border: `1px solid ${token.colorBorderSecondary}`,
                  transition: 'all 0.3s cubic-bezier(0.645, 0.045, 0.355, 1)',
                }}
                styles={{
                  body: {
                    padding: 16,
                    position: 'relative',
                    zIndex: 1,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                  },
                }}
              >
                {card.description && (
                  <div
                    className="stat-card-extra"
                    style={{
                      position: 'absolute',
                      top: 16,
                      right: 16,
                      fontSize: 12,
                      lineHeight: '22px',
                      zIndex: 10,
                      pointerEvents: 'none',
                    }}
                  >
                    {card.description}
                  </div>
                )}

                <Statistic
                  title={card.title}
                  value={typeof card.value === 'number' || typeof card.value === 'string' ? card.value : 0}
                  formatter={typeof card.value === 'number' || typeof card.value === 'string' ? undefined : () => card.value as ReactNode}
                  prefix={card.prefix}
                  suffix={card.suffix}
                  precision={card.precision}
                  styles={{
                    content: {
                      fontSize: '24px',
                      fontWeight: 600,
                      ...(isPlainTheme
                        ? { color: token.colorText }
                        : card.valueStyle),
                      position: 'relative',
                      zIndex: 2,
                    },
                    title: {
                      marginBottom: 4,
                      color: token.colorTextSecondary,
                      position: 'relative',
                      zIndex: 2,
                    },
                  }}
                  style={{ marginBottom: 0 }}
                />

                {card.footer && (
                  <div style={{ marginTop: 'auto', paddingTop: 8, zIndex: 2 }}>
                    {card.footer}
                  </div>
                )}

                {!isPlainTheme && card.backgroundChart && (
                  <div
                    className="list-page-stat-card__bg-chart"
                    style={{
                      position: 'absolute',
                      bottom: -18,
                      left: -18,
                      right: -18,
                      height: 76,
                      zIndex: 0,
                      pointerEvents: 'none',
                      opacity: 0.8,
                    }}
                  >
                    {card.backgroundChart}
                  </div>
                )}
              </Card>
            </Col>
          ))}
        </Row>
      </div>
    ) : null;

  const legacyHeader =
    title != null || extra != null ? (
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: toolbarExtra != null && toolbarExtra !== false ? 12 : 0,
        }}
      >
        {title != null ? <div style={{ flex: '1 1 auto', minWidth: 0 }}>{title}</div> : null}
        {extra != null ? <div style={{ flexShrink: 0 }}>{extra}</div> : null}
      </div>
    ) : null;

  const toolbarRow =
    legacyHeader != null || toolbarExtra != null ? (
      <div style={{ marginBottom: 16 }}>
        {legacyHeader}
        {toolbarExtra}
      </div>
    ) : null;

  const mainRowInnerStyle: React.CSSProperties | undefined = fillMain
    ? { flex: 1, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column' }
    : prioritizeMainContentPaint
      ? { minWidth: 0 }
      : undefined;
  const mainRow = <div style={mainRowInnerStyle}>{children}</div>;
  const mainRowWrapperStyle: React.CSSProperties = fillMain
    ? { order: 3, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }
    : { order: 3 };

  const fillMainShellStyle: React.CSSProperties = fillMain
    ? { flex: 1, minHeight: 0, height: '100%', overflow: 'hidden' }
    : {};

  const shell = !prioritizeMainContentPaint ? (
    <div
      className={className}
      style={{
        padding: 0,
        ['--uni-table-scroll-offset' as string]: `${tableScrollOffsetPx}px`,
        ...style,
      }}
    >
      {statCardsRow}
      {toolbarRow}
      {mainRow}
    </div>
  ) : (
    <div
      className={className}
      style={{
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        ['--uni-table-scroll-offset' as string]: `${tableScrollOffsetPx}px`,
        ...fillMainShellStyle,
        ...style,
      }}
    >
      {/* DOM 顺序：主内容 → 工具栏 → 指标卡；flex order 保持视觉仍为 指标卡 / 工具栏 / 表格 */}
      <div style={mainRowWrapperStyle}>{mainRow}</div>
      {toolbarRow ? <div style={{ order: 2, flexShrink: fillMain ? 0 : undefined }}>{toolbarRow}</div> : null}
      {statCardsRow ? <div style={{ order: 1, flexShrink: fillMain ? 0 : undefined }}>{statCardsRow}</div> : null}
    </div>
  );

  return (
    <ListPageStatCardsProvider value={statCardsContextValue}>{shell}</ListPageStatCardsProvider>
  );
};

export default ListPageTemplate;
