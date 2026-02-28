/**
 * 菜单业务蓝图过滤
 *
 * 按「蓝图设置 → 菜单管理 → 权限管理」层级中的「蓝图设置」过滤菜单。
 * 当模块或节点在业务配置中禁用时，隐藏对应菜单项。
 */

import type { MenuTree } from '../services/menu';
import type { BusinessConfig } from '../services/businessConfig';
import { getMenuBusinessMeta } from './menuBusinessMapping';

/**
 * 按业务配置递归过滤菜单树
 *
 * 层级：蓝图设置（本函数）→ 菜单管理（getMenuTree is_active）→ 权限管理（filterMenuByPermission）
 *
 * @param menus - 原始菜单树
 * @param config - 业务配置（modules、nodes）
 * @returns 过滤后的菜单树
 */
export function filterMenuByBusinessConfig(
  menus: MenuTree[],
  config: BusinessConfig | null | undefined
): MenuTree[] {
  if (!config) return menus;
  const modules = config.modules ?? {};
  const nodes = config.nodes ?? {};

  return menus
    .map((menu) => {
      const businessMeta = getMenuBusinessMeta(menu);
      if (businessMeta) {
        if (businessMeta.module !== undefined && modules[businessMeta.module] === false) return null;
        if (businessMeta.node !== undefined) {
          const nodeConfig = nodes[businessMeta.node];
          if (nodeConfig && nodeConfig.enabled === false) return null;
        }
      }
      if (menu.children && menu.children.length > 0) {
        const filteredChildren = filterMenuByBusinessConfig(menu.children, config);
        if (filteredChildren.length === 0 && !menu.path) return null;
        return { ...menu, children: filteredChildren };
      }
      return menu;
    })
    .filter((m): m is MenuTree => m !== null);
}
