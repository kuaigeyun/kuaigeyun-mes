import React, { useMemo } from 'react';
import { Empty } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ModuleTodoItem } from './types';
import { localizeDashboardTodoItem } from '../../../../utils/dashboardTodoI18n';
import { DashboardTodoListItem } from '../../../../components/dashboard/DashboardTodoList';

export function ModuleTodoList({
  items,
  emptyText = '暂无待办',
}: {
  items: ModuleTodoItem[];
  emptyText?: string;
}) {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const localizedItems = useMemo(
    () => items.map((item) => localizeDashboardTodoItem(item, t)),
    [items, t, i18n.language],
  );

  if (!localizedItems.length) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />;
  }

  return (
    <div className="dashboard-feed-list">
      {localizedItems.map((item) => (
        <DashboardTodoListItem
          key={item.id}
          item={item}
          onNavigate={(link) => navigate(link)}
          showHandleButton={false}
        />
      ))}
    </div>
  );
}

export default ModuleTodoList;
