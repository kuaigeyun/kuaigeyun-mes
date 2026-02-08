/**
 * 看板组件
 * 
 * 提供拖拽式看板布局，支持任务卡片在不同状态列之间拖拽
 */

import React, { useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, Badge, Empty, Typography, Space } from 'antd';
import { HolderOutlined } from '@ant-design/icons';

const { Text } = Typography;

/**
 * 看板列配置
 */
export interface KanbanColumn {
  /**
   * 列ID（通常对应状态值）
   */
  id: string;
  /**
   * 列标题
   */
  title: string;
  /**
   * 列颜色
   */
  color?: string;
  /**
   * 列中的项目列表
   */
  items: any[];
}

/**
 * 看板卡片配置
 */
export interface KanbanCardProps {
  /**
   * 卡片数据
   */
  data: any;
  /**
   * 卡片ID字段名（默认为 'id'）
   */
  idField?: string;
  /**
   * 卡片标题字段名（默认为 'title'）
   */
  titleField?: string;
  /**
   * 自定义卡片渲染函数
   */
  renderCard?: (data: any) => React.ReactNode;
  /**
   * 卡片点击事件
   */
  onCardClick?: (data: any) => void;
}

/**
 * 看板组件属性
 */
export interface KanbanBoardProps {
  /**
   * 列配置列表
   */
  columns: KanbanColumn[];
  /**
   * 卡片配置
   */
  cardProps: KanbanCardProps;
  /**
   * 拖拽结束事件
   */
  onDragEnd: (event: DragEndEvent) => void;
  /**
   * 拖拽悬停事件（可选）
   */
  onDragOver?: (event: DragOverEvent) => void;
  /**
   * 是否显示列计数
   */
  showCount?: boolean;
  /**
   * 自定义列标题渲染
   */
  renderColumnHeader?: (column: KanbanColumn) => React.ReactNode;
}

/**
 * 可拖拽的卡片组件
 */
const DraggableCard: React.FC<{
  id: string;
  data: any;
  cardProps: KanbanCardProps;
}> = ({ id, data, cardProps }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const idField = cardProps.idField || 'id';
  const titleField = cardProps.titleField || 'title';

  return (
    <div ref={setNodeRef} style={style}>
      <Card
        size="small"
        hoverable
        style={{
          marginBottom: 8,
          cursor: 'grab',
          ...(isDragging ? { boxShadow: '0 4px 12px rgba(0,0,0,0.15)' } : {}),
        }}
        onClick={() => cardProps.onCardClick?.(data)}
        styles={{ body: { padding: '12px' } }}
      >
        <div
          {...attributes}
          {...listeners}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            cursor: 'grab',
          }}
        >
          <HolderOutlined style={{ color: '#999', fontSize: 14 }} />
          {cardProps.renderCard ? (
            cardProps.renderCard(data)
          ) : (
            <Text strong style={{ flex: 1 }}>
              {data[titleField] || data[idField]}
            </Text>
          )}
        </div>
      </Card>
    </div>
  );
};

/**
 * 看板列组件
 */
const KanbanColumn: React.FC<{
  column: KanbanColumn;
  cardProps: KanbanCardProps;
  showCount?: boolean;
  renderHeader?: (column: KanbanColumn) => React.ReactNode;
}> = ({ column, cardProps, showCount, renderHeader }) => {
  const idField = cardProps.idField || 'id';

  return (
    <div style={{ flex: 1, minWidth: 280, margin: '0 8px' }}>
      <Card
        size="small"
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
        styles={{
          body: {
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            padding: '12px',
          },
        }}
      >
        {/* 列标题 */}
        <div
          style={{
            marginBottom: 12,
            paddingBottom: 12,
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {renderHeader ? (
            renderHeader(column)
          ) : (
            <>
              <Space>
                {column.color && (
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: column.color,
                    }}
                  />
                )}
                <Text strong>{column.title}</Text>
              </Space>
              {showCount && (
                <Badge count={column.items.length} showZero />
              )}
            </>
          )}
        </div>

        {/* 列内容 */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            minHeight: 200,
          }}
        >
          <SortableContext
            items={column.items.map((item) => String(item[idField]))}
            strategy={verticalListSortingStrategy}
          >
            {column.items.length > 0 ? (
              column.items.map((item) => (
                <DraggableCard
                  key={String(item[idField])}
                  id={String(item[idField])}
                  data={item}
                  cardProps={cardProps}
                />
              ))
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="暂无任务"
                style={{ marginTop: 40 }}
              />
            )}
          </SortableContext>
        </div>
      </Card>
    </div>
  );
};

/**
 * 看板组件
 */
const KanbanBoard: React.FC<KanbanBoardProps> = ({
  columns,
  cardProps,
  onDragEnd,
  onDragOver,
  showCount = true,
  renderColumnHeader,
}) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeData, setActiveData] = useState<any | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    // 查找拖拽的数据
    const idField = cardProps.idField || 'id';
    for (const column of columns) {
      const item = column.items.find(
        (item) => String(item[idField]) === String(event.active.id)
      );
      if (item) {
        setActiveData(item);
        break;
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    setActiveData(null);
    onDragEnd(event);
  };

  const idField = cardProps.idField || 'id';
  const titleField = cardProps.titleField || 'title';

  // 获取所有可拖拽的ID
  const allItemIds = columns.flatMap((column) =>
    column.items.map((item) => String(item[idField]))
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={onDragOver}
      onDragEnd={handleDragEnd}
    >
      <div
        style={{
          display: 'flex',
          gap: 16,
          overflowX: 'auto',
          padding: '16px 0',
        }}
      >
        {columns.map((column) => (
          <KanbanColumn
            key={column.id}
            column={column}
            cardProps={cardProps}
            showCount={showCount}
            renderHeader={renderColumnHeader}
          />
        ))}
      </div>

      {/* 拖拽时的覆盖层 */}
      <DragOverlay>
        {activeId && activeData ? (
          <Card
            size="small"
            style={{
              width: 280,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}
            styles={{ body: { padding: '12px' } }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <HolderOutlined style={{ color: '#999', fontSize: 14 }} />
              {cardProps.renderCard ? (
                cardProps.renderCard(activeData)
              ) : (
                <Text strong>{activeData[titleField] || activeData[idField]}</Text>
              )}
            </div>
          </Card>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

export default KanbanBoard;
export type { KanbanBoardProps, KanbanColumn, KanbanCardProps };

