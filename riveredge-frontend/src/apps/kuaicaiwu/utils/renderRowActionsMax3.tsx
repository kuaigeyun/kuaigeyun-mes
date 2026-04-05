import React from 'react';
import { Button, Dropdown, Space } from 'antd';

const MAX_INLINE = 3;

/**
 * 列表操作列：最多平铺 3 个，从第 4 个起收入「更多」（对齐 UI_Standard）
 */
export function renderRowActionsMax3(nodes: React.ReactNode[], keyPrefix: string): React.ReactNode {
  const flat = nodes.filter(Boolean) as React.ReactNode[];
  if (flat.length <= MAX_INLINE) {
    return <Space size="small" wrap>{flat}</Space>;
  }
  const inline = flat.slice(0, MAX_INLINE);
  const overflow = flat.slice(MAX_INLINE);
  return (
    <Space size="small" wrap>
      {inline}
      <Dropdown
        menu={{
          items: overflow.map((node, i) => ({
            key: `${keyPrefix}-more-${i}`,
            label: node,
          })),
        }}
        trigger={['click']}
      >
        <Button type="link" size="small">
          更多
        </Button>
      </Dropdown>
    </Space>
  );
}
