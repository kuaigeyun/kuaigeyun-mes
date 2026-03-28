/**
 * 列表页面布局模板
 *
 * 提供统一的列表页面布局，包括统计卡片（可选）和表格区域
 * 遵循 Ant Design 设计规范，减少硬编号
 *
 * Author: Luigi Lu
 * Date: 2025-12-26
 */

import React, { ReactNode } from 'react';
import { Row, Col, Card, Statistic, theme as AntdTheme } from 'antd';
import { STAT_CARD_CONFIG } from './constants';


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
  /** 工具栏扩展区（如导入、导出按钮，由 UniImport、UniExport 在页面层管理） */
  toolbarExtra?: ReactNode;
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
  toolbarExtra,
  className,
  style,
}) => {
  const { token } = AntdTheme.useToken();

  return (
    <div
      className={className}
      style={{
        padding: 0,
        ...style,
      }}
    >
      {/* 统计卡片区域 - 显示所有提供的指标卡并在一行均分 */}
      {statCards && statCards.length > 0 && (
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
                  {/* Top Right Extra Info - Standardized class for easier management */}
                  {card.description && (
                    <div 
                      className="stat-card-extra"
                      style={{ 
                        position: 'absolute', 
                        top: 16, // Aligned with card body padding
                        right: 16, 
                        fontSize: 12, 
                        lineHeight: '22px', // Align with ant-statistic-title line height approx
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
                        ...card.valueStyle,
                        position: 'relative',
                        zIndex: 2,
                      },
                      title: {
                        marginBottom: 4,
                        color: token.colorTextSecondary,
                        position: 'relative',
                        zIndex: 2,
                      }
                    }}
                    style={{ marginBottom: 0 }}
                  />

                  {card.footer && (
                    <div style={{ marginTop: 'auto', paddingTop: 8, zIndex: 2 }}>
                      {card.footer}
                    </div>
                  )}

                  {card.backgroundChart && (
                    <div style={{ 
                      position: 'absolute', 
                      bottom: -18, 
                      left: -18, 
                      right: -18, 
                      height: 76, 
                      zIndex: 0, 
                      pointerEvents: 'none',
                      opacity: 0.8,
                    }}>
                      {card.backgroundChart}
                    </div>
                  )}
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      )}

      {/* 工具栏扩展区（导入、导出等，由 UniImport、UniExport 在页面层管理） */}
      {toolbarExtra && (
        <div style={{ marginBottom: 16 }}>{toolbarExtra}</div>
      )}

      {/* 主要内容区域 */}
      <div>{children}</div>
    </div>
  );
};

export default ListPageTemplate;
