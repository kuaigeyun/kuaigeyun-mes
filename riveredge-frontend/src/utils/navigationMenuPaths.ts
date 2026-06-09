import type { MenuTree } from '../services/menu';

/** 扁平化 navigation-tree 中所有菜单 path（is_active=true，与侧栏同源） */
export function collectNavigationMenuPaths(nodes: MenuTree[]): Set<string> {
  const paths = new Set<string>();
  const walk = (items: MenuTree[]) => {
    for (const node of items) {
      if (node.path) paths.add(node.path);
      if (node.children?.length) walk(node.children);
    }
  };
  walk(nodes);
  return paths;
}
