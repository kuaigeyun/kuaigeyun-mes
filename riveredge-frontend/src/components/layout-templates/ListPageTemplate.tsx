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
import { Row, Col, Card, Statistic } from 'antd';
import { STAT_CARD_CONFIG, PAGE_SPACING } from './constants';


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
  /** 精度 */
  precision?: number;
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

  return (
    <div
      className={className}
      style={{
        padding: 0,
        ...style,
      }}
    >
      {/* 统计卡片区域 - 只有在数量足够（>3）时才显示，且始终占满一行 */}
      {statCards && statCards.length > 3 && (
        <div style={{ marginBottom: 16 }}>
          <Row gutter={STAT_CARD_CONFIG.GUTTER} wrap={false}>
            {statCards.map((card, index) => (
              <Col
                key={index}
                flex={1}
                style={{ minWidth: 0 }} // 防止 flex 子项溢出
              >
                <Card
                  hoverable={!!card.onClick}
                  onClick={card.onClick}
                  style={{
                    cursor: card.onClick ? 'pointer' : 'default',
                    height: '100%',
                  }}
                  styles={{
                    body: {
                      padding: STAT_CARD_CONFIG.PADDING,
                    },
                  }}
                >
                  <Statistic
                    title={card.title}
                    value={card.value}
                    prefix={card.prefix}
                    suffix={card.suffix}
                    precision={card.precision}
                    valueStyle={{
                      fontSize: '24px',
                      fontWeight: 600,
                      ...card.valueStyle,
                    }}
                    style={{ marginBottom: 0 }} // 确保 Statistic 自身没有额外下边距
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

