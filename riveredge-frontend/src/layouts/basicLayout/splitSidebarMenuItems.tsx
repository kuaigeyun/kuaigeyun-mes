import React from 'react';
import { Link } from 'react-router-dom';
import type { MenuDataItem } from '@ant-design/pro-components';
import type { MenuProps } from 'antd';
import { menuItemKey } from './sidebarMenuLayout';

type MenuItemRender = (item: MenuDataItem, dom: React.ReactNode) => React.ReactNode;

function defaultLeafLabel(item: MenuDataItem): React.ReactNode {
  return typeof item.name === 'string' ? item.name : '';
}

function renderLeafNode(item: MenuDataItem, menuItemRender?: MenuItemRender): React.ReactNode {
  const label = defaultLeafLabel(item);
  if (menuItemRender) {
    return menuItemRender(item, label);
  }
  if (item.path && !item.path.startsWith('http') && !item.path.startsWith('#')) {
    return (
      <Link to={item.path} onClick={(e) => e.stopPropagation()} style={{ display: 'block', width: '100%' }}>
        {label}
      </Link>
    );
  }
  return label;
}

export function buildSplitSecondaryMenuItems(
  nodes: MenuDataItem[] | undefined,
  menuItemRender?: MenuItemRender,
): MenuProps['items'] {
  if (!nodes?.length) return [];

  const walk = (items: MenuDataItem[]): MenuProps['items'] => {
    const result: NonNullable<MenuProps['items']> = [];
    for (const item of items) {
      if (item.hideInMenu) continue;
      if (item.isAppMenuSkeleton) continue;

      const key = menuItemKey(item);
      if (!key) continue;

      if (item.type === 'group') {
        const children = walk(item.children ?? []);
        if (!children?.length) continue;
        result.push({
          type: 'group',
          key,
          label: typeof item.name === 'string' ? item.name : '',
          children,
        });
        continue;
      }

      const visibleChildren = (item.children ?? []).filter((child) => child.hideInMenu !== true);
      if (visibleChildren.length > 0 && !item.path) {
        const children = walk(visibleChildren);
        if (!children?.length) continue;
        result.push({
          key,
          label: renderLeafNode(item, menuItemRender),
          children,
        });
        continue;
      }

      if (!item.path || item.path.startsWith('#')) continue;

      result.push({
        key,
        label: renderLeafNode(item, menuItemRender),
      });
    }
    return result;
  };

  return walk(nodes);
}
