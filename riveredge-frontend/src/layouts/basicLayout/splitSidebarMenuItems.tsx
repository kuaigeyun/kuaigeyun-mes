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

      const visibleChildren = (item.children ?? []).filter((child) => child.hideInMenu !== true);
      // 快质量 / 快设备等 manifest 分组是 type=group（平铺侧栏用分组标题）。
      // 双列右栏与快制造一样用可折叠子菜单，避免分组标题与叶子摊成一列。
      if ((item.type === 'group' || !item.path) && visibleChildren.length > 0) {
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
