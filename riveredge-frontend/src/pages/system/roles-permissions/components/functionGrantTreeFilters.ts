import type { FunctionGrantAction, FunctionGrantMenuNode } from '../../../../services/role';
import {
  extractAppCodeFromPath,
  translateAppMenuItemName,
  translateMenuName,
} from '../../../../utils/menuTranslation';

export type FunctionGrantFilterMode = 'all' | 'app' | 'module' | 'search';

export interface GrantTreePickOption {
  value: string;
  label: string;
}

export function translateGrantMenuTitle(
  node: FunctionGrantMenuNode,
  t: (key: string, opts?: { defaultValue?: string }) => string
): string {
  const path = node.path || '';
  if (path.startsWith('/apps/')) {
    const normalized = path.replace(/\/$/, '');
    const isAppRoot = /^\/apps\/[^/]+$/.test(normalized);
    if (isAppRoot) {
      const appCode = extractAppCodeFromPath(path);
      if (appCode) return node.title;
    }
    return translateAppMenuItemName(node.title, path, t, undefined);
  }
  return translateMenuName(node.title, t, path);
}

/** 菜单树深度：根为 0（APP 一级） */
export function collectGrantPickOptions(
  nodes: FunctionGrantMenuNode[],
  targetDepth: number,
  t: (key: string, opts?: { defaultValue?: string }) => string,
  currentDepth = 0,
  parentLabel = ''
): GrantTreePickOption[] {
  const out: GrantTreePickOption[] = [];
  for (const node of nodes) {
    const title = translateGrantMenuTitle(node, t);
    const label = parentLabel ? `${parentLabel} / ${title}` : title;
    if (currentDepth === targetDepth) {
      out.push({ value: node.menu_uuid, label });
    }
    if (node.children?.length) {
      const nextParent = currentDepth === 0 ? title : label;
      out.push(...collectGrantPickOptions(node.children, targetDepth, t, currentDepth + 1, nextParent));
    }
  }
  return out;
}

export function filterGrantTreeToSubtree(
  nodes: FunctionGrantMenuNode[],
  menuUuid: string
): FunctionGrantMenuNode[] {
  const find = (list: FunctionGrantMenuNode[]): FunctionGrantMenuNode | null => {
    for (const node of list) {
      if (node.menu_uuid === menuUuid) return node;
      const sub = find(node.children || []);
      if (sub) return sub;
    }
    return null;
  };
  const hit = find(nodes);
  return hit ? [hit] : [];
}

function actionMatchesSearch(
  action: FunctionGrantAction,
  kw: string,
  t: (key: string, opts?: { defaultValue?: string }) => string
): boolean {
  const raw = (action.action || '').toLowerCase().trim();
  const actionLabels: Record<string, string> = {
    create: t('permission.action.create', { defaultValue: '创建' }),
    read: t('permission.action.read', { defaultValue: '查看' }),
    view: t('permission.action.view', { defaultValue: '查看' }),
    update: t('permission.action.update', { defaultValue: '编辑' }),
    edit: t('permission.action.edit', { defaultValue: '编辑' }),
    delete: t('permission.action.delete', { defaultValue: '删除' }),
    import: t('permission.action.import', { defaultValue: '导入' }),
    export: t('permission.action.export', { defaultValue: '导出' }),
  };
  const label = actionLabels[raw] || action.label || '';
  if ((action.code || '').toLowerCase().includes(kw)) return true;
  if ((action.label || '').toLowerCase().includes(kw)) return true;
  if (label.toLowerCase().includes(kw)) return true;
  return (action.merged_codes || []).some((c) => c.toLowerCase().includes(kw));
}

function filterGrantNodeByKeyword(
  node: FunctionGrantMenuNode,
  kw: string,
  depth: number,
  t: (key: string, opts?: { defaultValue?: string }) => string
): FunctionGrantMenuNode | null {
  const titleText = translateGrantMenuTitle(node, t).toLowerCase();
  const titleMatch =
    depth >= 2 &&
    (titleText.includes(kw) ||
      (node.title || '').toLowerCase().includes(kw) ||
      (node.path || '').toLowerCase().includes(kw) ||
      (node.resource || '').toLowerCase().includes(kw));

  const matchingActions =
    depth >= 2 ? node.actions.filter((a) => actionMatchesSearch(a, kw, t)) : [];
  const filteredChildren = (node.children || [])
    .map((child) => filterGrantNodeByKeyword(child, kw, depth + 1, t))
    .filter((child): child is FunctionGrantMenuNode => child !== null);

  if (titleMatch) {
    return { ...node, children: node.children || [], actions: node.actions };
  }
  if (matchingActions.length > 0) {
    return { ...node, actions: matchingActions, children: filteredChildren };
  }
  if (filteredChildren.length > 0) {
    return { ...node, actions: node.actions, children: filteredChildren };
  }
  return null;
}

/** 按关键词筛选三级及以上菜单与操作（保留祖先路径） */
export function filterFunctionGrantTreeDeep(
  nodes: FunctionGrantMenuNode[],
  keyword: string,
  t: (key: string, opts?: { defaultValue?: string }) => string
): FunctionGrantMenuNode[] {
  const kw = keyword.trim().toLowerCase();
  if (!kw) return [];
  return nodes
    .map((node) => filterGrantNodeByKeyword(node, kw, 0, t))
    .filter((node): node is FunctionGrantMenuNode => node !== null);
}
