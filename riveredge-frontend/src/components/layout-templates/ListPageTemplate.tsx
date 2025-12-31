/**
 * 列表页面布局模板
 *
 * 提供统一的列表页面布局，包括统计卡片（可选）和表格区域
 * 遵循 Ant Design 设计规范，减少硬编码
 *
 * Author: Luigi Lu
 * Date: 2025-12-26
 */

import React, { ReactNode } from 'react';
import { Row, Col, Card, Statistic, theme } from 'antd';
import { STAT_CARD_CONFIG, PAGE_SPACING } from './constants';

const { useToken } = theme;

/**
 * 统计卡片数据
 */
export interface StatCard {
  /** 标题 */
  title: string;
  /** 数值 */
  value: number | string;
  /** 前缀（如图标或符号） */
  prefix?: ReactNode;
  /** 后缀（如单位） */
  suffix?: string;
  /** 数值样式颜色 */
  valueStyle?: React.CSSProperties;
  /** 卡片点击事件 */
  onClick?: () => void;
}

/**
 * 列表页面模板属性
 */
export interface ListPageTemplateProps {
  /** 统计卡片数据（可选） */
  statCards?: StatCard[];
  /** 主要内容（通常是 UniTable） */
  children: ReactNode;
  /** 自定义样式类名 */
  className?: string;
  /** 自定义样式 */
  style?: React.CSSProperties;
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
  className,
  style,
}) => {
  const { token } = useToken();

  return (
    <div
      className={className}
      style={{
        padding: `${PAGE_SPACING.PADDING}px`,
        ...style,
      }}
    >
      {/* 统计卡片区域 */}
      {statCards && statCards.length > 0 && (
        <div style={{ marginBottom: PAGE_SPACING.BLOCK_GAP }}>
          <Row gutter={STAT_CARD_CONFIG.GUTTER}>
            {statCards.map((card, index) => (
              <Col
                key={index}
                xs={STAT_CARD_CONFIG.COLUMNS.xs * 24}
                sm={STAT_CARD_CONFIG.COLUMNS.sm * 12}
                md={STAT_CARD_CONFIG.COLUMNS.md * 12}
                lg={STAT_CARD_CONFIG.COLUMNS.lg * 6}
                xl={STAT_CARD_CONFIG.COLUMNS.xl * 6}
                xxl={STAT_CARD_CONFIG.COLUMNS.xxl * 6}
              >
                <Card
                  hoverable={!!card.onClick}
                  onClick={card.onClick}
                  style={{
                    cursor: card.onClick ? 'pointer' : 'default',
                  }}
                >
                  <Statistic
                    title={card.title}
                    value={card.value}
                    prefix={card.prefix}
                    suffix={card.suffix}
                    valueStyle={card.valueStyle}
                  />
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      )}

      {/* 主要内容区域 */}
      <div>{children}</div>
    </div>
  );
};

export default ListPageTemplate;

