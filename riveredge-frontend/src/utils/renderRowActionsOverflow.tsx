import React from 'react';
import { Button, Dropdown, Space } from 'antd';

/** 列表操作列：最多平铺个数，从第 (maxInline+1) 个起收入「更多」 */
export const ROW_ACTIONS_INLINE_MAX = 4;

/**
 * 列表操作列渲染：平铺前 maxInline 个按钮，其余收入「更多」下拉。
 */
export function renderRowActionsOverflow(
  nodes: React.ReactNode[],
  keyPrefix: string,
  maxInline: number = ROW_ACTIONS_INLINE_MAX,
): React.ReactNode {
  const flat = nodes.filter(Boolean) as React.ReactNode[];
  if (flat.length <= maxInline) {
    return (
      <Space size="small" wrap>
        {flat}
      </Space>
    );
  }
  const inline = flat.slice(0, maxInline);
  const overflow = flat.slice(maxInline);
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
