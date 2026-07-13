import React from 'react';
import { Button, Empty, Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import type { LocalizedTodoItem } from '../../utils/dashboardTodoI18n';
import { formatDateTime } from '../../utils/format';

const PRIORITY_TAG_COLOR: Record<string, string> = {
  high: 'red',
  critical: 'red',
  medium: 'orange',
  low: 'default',
};

export function DashboardTodoListItem({
  item,
  onNavigate,
  onHandle,
  showHandleButton = true,
}: {
  item: LocalizedTodoItem;
  onNavigate?: (link: string) => void;
  onHandle?: (todoId: string) => void;
  showHandleButton?: boolean;
}) {
  const { t } = useTranslation();
  const priority = (item.priority || 'medium').toLowerCase();
  const showPriorityTag = priority === 'high' || priority === 'critical';

  return (
    <div
      className="dashboard-todo-item"
      onClick={() => {
        if (item.link) {
          onNavigate?.(item.link);
        }
      }}
    >
      <div className="dashboard-todo-item__main">
        <div className="dashboard-todo-item__title-row">
          <p className="dashboard-todo-item__title">{item.title}</p>
          {showPriorityTag ? (
            <Tag color={PRIORITY_TAG_COLOR[priority] ?? 'red'} className="dashboard-todo-item__tag">
              {t('pages.dashboard.todo.priorityUrgent')}
            </Tag>
          ) : null}
        </div>
        {item.description ? (
          <span className="dashboard-todo-item__desc">{item.description}</span>
        ) : null}
        {item.detail ? (
          <span className="dashboard-todo-item__detail">{item.detail}</span>
        ) : null}
        <div className="dashboard-todo-item__meta-row">
          {item.due_date ? (
            <span className="dashboard-todo-item__meta">
              {t('pages.dashboard.todo.dueDateShort', {
                date: formatDateTime(item.due_date, 'YYYY-MM-DD'),
              })}
            </span>
          ) : null}
          {item.created_at ? (
            <span className="dashboard-todo-item__meta">
              {t('pages.dashboard.todo.createdAtShort', {
                date: formatDateTime(item.created_at, 'MM-DD HH:mm'),
              })}
            </span>
          ) : null}
        </div>
      </div>
      <div className="dashboard-todo-item__aside">
        {showHandleButton && onHandle ? (
          <Button
            size="small"
            type="primary"
            className="dashboard-todo-item__action"
            onClick={(e) => {
              e.stopPropagation();
              onHandle(item.id);
            }}
          >
            {t('pages.dashboard.handle')}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function DashboardTodoList({
  items,
  emptyDescription,
  onNavigate,
  onHandle,
  showHandleButton = true,
}: {
  items: LocalizedTodoItem[];
  emptyDescription: string;
  onNavigate?: (link: string) => void;
  onHandle?: (todoId: string) => void;
  showHandleButton?: boolean;
}) {
  if (items.length === 0) {
    return <Empty description={emptyDescription} image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  return (
    <div className="dashboard-feed-list">
      {items.map((item) => (
        <DashboardTodoListItem
          key={item.id}
          item={item}
          onNavigate={onNavigate}
          onHandle={onHandle}
          showHandleButton={showHandleButton}
        />
      ))}
    </div>
  );
}

export default DashboardTodoList;
