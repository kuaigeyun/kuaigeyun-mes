import React from 'react';
import { Empty, Typography, theme } from 'antd';
import { MarkerTag } from '../../../../constants/statusBadges';

const { Text, Paragraph } = Typography;

export type ModuleFeedItem = {
  id: string | number;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  meta?: React.ReactNode;
  tag?: { label: React.ReactNode; color?: string };
  action?: React.ReactNode;
  onClick?: () => void;
};

export function ModuleFeedList({
  items,
  emptyText,
}: {
  items: ModuleFeedItem[];
  emptyText?: string;
}) {
  const { token } = theme.useToken();

  if (!items.length) {
    if (!emptyText) return null;
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />;
  }

  return (
    <div className="dashboard-feed-list">
      {items.map((item) => {
        const clickable = Boolean(item.onClick);
        return (
          <div
            key={item.id}
            role={clickable ? 'button' : undefined}
            tabIndex={clickable ? 0 : undefined}
            onClick={item.onClick}
            onKeyDown={
              clickable
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') item.onClick?.();
                  }
                : undefined
            }
            style={{
              padding: '8px 10px',
              borderRadius: 6,
              marginBottom: 6,
              border: `1px solid ${token.colorBorderSecondary}`,
              cursor: clickable ? 'pointer' : undefined,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
              <Text strong ellipsis style={{ fontSize: 12, flex: 1 }}>
                {item.title}
              </Text>
              {item.tag ? (
                <MarkerTag color={item.tag.color} style={{ margin: 0, fontSize: 10 }}>
                  {item.tag.label}
                </MarkerTag>
              ) : null}
              {item.meta}
            </div>
            {item.subtitle ? (
              <Paragraph type="secondary" ellipsis={{ rows: 1 }} style={{ fontSize: 11, margin: '4px 0' }}>
                {item.subtitle}
              </Paragraph>
            ) : null}
            {item.action ? (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>{item.action}</div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default ModuleFeedList;
