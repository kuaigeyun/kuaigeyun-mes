/**
 * 看板视图布局模板
 *
 * 提供统一的看板视图布局，用于工单看板、任务看板等场景
 * 遵循 Ant Design 设计规范
 *
 * Author: Luigi Lu
 * Date: 2025-12-26
 */

import React, { ReactNode } from 'react';
import { Card, theme, Empty } from 'antd';
import { useTranslation } from 'react-i18next';
import { PAGE_SPACING, ANT_DESIGN_TOKENS } from './constants';

const { useToken } = theme;

/**
 * 看板列
 */
export interface KanbanColumn {
  /** 列ID */
  id: string;
  /** 列标题 */
  title: string;
  /** 列中的卡片列表 */
  cards: ReactNode[];
  /** 列背景色（可选） */
  backgroundColor?: string;
  /** 是否允许拖拽 */
  droppable?: boolean;
}

/**
 * 看板视图模板属性
 */
export interface KanbanViewTemplateProps {
  /** 看板列列表 */
  columns: KanbanColumn[];
  /** 卡片拖拽回调 */
  onCardMove?: (cardId: string, fromColumnId: string, toColumnId: string) => void;
  /** 自定义样式类名 */
  className?: string;
  /** 自定义样式 */
  style?: React.CSSProperties;
}

/**
 * 看板视图布局模板
 *
 * @example
 * ```tsx
 * <KanbanViewTemplate
 *   columns={[
 *     {
 *       id: 'pending',
 *       title: '待下达',
 *       cards: [<WorkOrderCard key="1" />],
 *     },
 *     {
 *       id: 'in-progress',
 *       title: '生产中',
 *       cards: [<WorkOrderCard key="2" />],
 *     },
 *   ]}
 * />
 * ```
 */
export const KanbanViewTemplate: React.FC<KanbanViewTemplateProps> = ({
  columns,
  onCardMove,
  className,
  style,
}) => {
  const { t } = useTranslation();
  const { token } = useToken();

  return (
    <div
      className={className}
      style={{
        padding: `${PAGE_SPACING.PADDING}px`,
        display: 'flex',
        gap: ANT_DESIGN_TOKENS.SPACING.MD,
        overflowX: 'auto',
        ...style,
      }}
    >
      {columns.map((column) => (
        <div
          key={column.id}
          style={{
            minWidth: '300px',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Card
            title={column.title}
            style={{
              height: '100%',
              backgroundColor: column.backgroundColor || token.colorBgContainer,
            }}
            styles={{
              body: {
                padding: ANT_DESIGN_TOKENS.SPACING.MD,
                flex: 1,
                overflowY: 'auto',
                minHeight: '400px',
              },
            }}
          >
            {column.cards.length > 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: ANT_DESIGN_TOKENS.SPACING.MD,
                }}
              >
                {column.cards}
              </div>
            ) : (
              <Empty
                description={t('components.kanban.noData')}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            )}
          </Card>
        </div>
      ))}
    </div>
  );
};

export default KanbanViewTemplate;

