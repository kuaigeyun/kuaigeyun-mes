import React from 'react';
import { Empty, List, Tag, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { useThemeStore } from '../../../../stores/themeStore';
import type { ModuleTodoItem } from './types';
import { isModuleDashboardPlain } from './moduleDashboardTheme';

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
  const plain = isModuleDashboardPlain(useThemeStore((s) => s.resolved.themeStyle));

  if (!items.length) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />;
  }

  return (
    <List
      size="small"
      dataSource={items}
      renderItem={(item) => (
        <List.Item
          style={{ cursor: item.link ? 'pointer' : 'default', padding: '8px 4px' }}
          onClick={() => item.link && navigate(item.link)}
        >
          <List.Item.Meta
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Text strong style={{ fontSize: 13 }}>
                  {item.title}
                </Text>
                <Tag
                  color={plain ? 'default' : (PRIORITY_COLOR[item.priority?.toLowerCase()] ?? 'default')}
                  bordered={false}
                >
                  {item.priority === 'high' || item.priority === 'critical' ? '紧急' : '待办'}
                </Tag>
              </span>
            }
            description={
              <div>
                {item.description ? (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {item.description}
                  </Text>
                ) : null}
                {item.due_date ? (
                  <div>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      截止 {dayjs(item.due_date).format('MM-DD')}
                    </Text>
                  </div>
                ) : null}
              </div>
            }
          />
        </List.Item>
      )}
    />
  );
}

export default ModuleTodoList;
