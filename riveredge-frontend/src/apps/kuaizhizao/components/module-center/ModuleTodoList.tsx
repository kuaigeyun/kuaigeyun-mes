import React, { useMemo } from 'react';
import { Empty, Tag, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../../../../stores/themeStore';
import type { ModuleTodoItem } from './types';
import { isModuleDashboardPlain } from './moduleDashboardTheme';
import { localizeDashboardTodoItem } from '../../../../utils/dashboardTodoI18n';
import { formatDateTime } from '../../../../utils/format';

const { Text } = Typography;

const PRIORITY_COLOR: Record<string, string> = {
  high: 'red',
  critical: 'red',
  medium: 'orange',
  low: 'default',
};

export function ModuleTodoList({
  items,
  emptyText = '暂无待办',
}: {
  items: ModuleTodoItem[];
  emptyText?: string;
}) {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const plain = isModuleDashboardPlain(useThemeStore((s) => s.resolved.themeStyle));

  const localizedItems = useMemo(
    () => items.map((item) => localizeDashboardTodoItem(item, t)),
    [items, t, i18n.language],
  );

  if (!localizedItems.length) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />;
  }

  return (
    <div>
      {localizedItems.map((item) => (
        <div
          key={item.id}
          style={{ cursor: item.link ? 'pointer' : 'default', padding: '8px 4px' }}
          onClick={() => item.link && navigate(item.link)}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text strong style={{ fontSize: 13 }}>
              {item.title}
            </Text>
            <Tag
              color={plain ? 'default' : (PRIORITY_COLOR[item.priority?.toLowerCase()] ?? 'default')}
              variant="filled"
            >
              {item.priority === 'high' || item.priority === 'critical'
                ? t('pages.dashboard.todo.priorityUrgent')
                : t('pages.dashboard.todo.priorityPending')}
            </Tag>
          </span>
          <div>
            {item.description ? (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {item.description}
              </Text>
            ) : null}
            {item.due_date ? (
              <div>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {t('pages.dashboard.todo.dueDateShort', {
                    date: formatDateTime(item.due_date, 'MM-DD'),
                  })}
                </Text>
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export default ModuleTodoList;
