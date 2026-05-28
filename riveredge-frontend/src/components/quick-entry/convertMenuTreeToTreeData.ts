import type { DataNode } from 'antd/es/tree';
import type { MenuTree } from '../../services/menu';
import { getTranslatedMenuTitle } from './quickEntryItems';
import { renderQuickEntryMenuIcon } from './renderQuickEntryMenuIcon';

export function convertMenuTreeToTreeData(
  menus: MenuTree[],
  t: (key: string, options?: Record<string, unknown>) => string,
): DataNode[] {
  const convertNode = (menu: MenuTree): DataNode | null => {
    if (menu.is_external) return null;

    const children = (menu.children || [])
      .map(convertNode)
      .filter((item): item is DataNode => item !== null);

    const hasValidPath = !!menu.path && menu.path !== '/system/dashboard/workplace';
    if (!hasValidPath && children.length === 0) return null;

    return {
      title: getTranslatedMenuTitle(menu, t),
      key: menu.uuid,
      icon: renderQuickEntryMenuIcon(menu),
      path: menu.path,
      children: children.length > 0 ? children : undefined,
      isLeaf: children.length === 0,
      disabled: !hasValidPath,
    } as DataNode;
  };

  return menus
    .map(convertNode)
    .filter((item): item is DataNode => item !== null);
}
