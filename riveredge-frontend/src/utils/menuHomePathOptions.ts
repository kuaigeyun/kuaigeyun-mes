import type { MenuTree } from '../services/menu';

export type MenuHomePathOption = { label: string; value: string };

/** 将导航菜单树展平为「设首页」可选 path（仅含已配置 path 的非外链菜单） */
export function flattenMenuHomePathOptions(
  items: MenuTree[],
  labelFn?: (name: string, path: string) => string,
): MenuHomePathOption[] {
  const out: MenuHomePathOption[] = [];
  const seen = new Set<string>();

  const walk = (nodes: MenuTree[], prefix: string) => {
    for (const n of nodes) {
      const path = (n.path || '').trim();
      if (path && !n.is_external && !seen.has(path)) {
        seen.add(path);
        const name = (n.name || '').trim() || path;
        out.push({
          label: labelFn ? labelFn(name, path) : `${prefix}${name} (${path})`,
          value: path,
        });
      }
      if (n.children?.length) {
        const nextPrefix = prefix ? `${prefix}  ` : '';
        walk(n.children, nextPrefix);
      }
    }
  };

  walk(items, '');
  return out.sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'));
}
