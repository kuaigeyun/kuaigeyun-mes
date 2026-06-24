import React, { useMemo } from 'react';
import { Checkbox, Tree, theme } from 'antd';
import { AppstoreOutlined } from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import type { FunctionGrantAction, FunctionGrantMenuNode } from '../../../../services/role';
import { resolvePermissionLabel } from '../../../../utils/permissionContract';
import { translateGrantMenuTitle } from './functionGrantTreeFilters';

function grantActionLabel(
  action: FunctionGrantAction,
  t: (key: string, opts?: { defaultValue?: string }) => string,
): string {
  return resolvePermissionLabel(action.code, action.action, action.label, t);
}

export function codesFromAction(action: FunctionGrantAction): string[] {
  if (action.merged_codes?.length) return action.merged_codes;
  return action.code ? [action.code] : [];
}

export function isActionGranted(action: FunctionGrantAction, granted: Set<string>): boolean {
  const codes = codesFromAction(action);
  return codes.length > 0 && codes.every((c) => granted.has(c));
}

export function collectCodesFromGrantTree(nodes: FunctionGrantMenuNode[]): string[] {
  const codes: string[] = [];
  const walk = (list: FunctionGrantMenuNode[]) => {
    for (const n of list) {
      n.actions.forEach((a) => codes.push(...codesFromAction(a)));
      if (n.children?.length) walk(n.children);
    }
  };
  walk(nodes);
  return [...new Set(codes)];
}

function actionMatchesSearch(
  action: FunctionGrantAction,
  kw: string,
  t: (key: string, opts?: { defaultValue?: string }) => string
): boolean {
  if ((action.code || '').toLowerCase().includes(kw)) return true;
  if ((action.label || '').toLowerCase().includes(kw)) return true;
  if ((action.action || '').toLowerCase().includes(kw)) return true;
  if (grantActionLabel(action, t).toLowerCase().includes(kw)) return true;
  return (action.merged_codes || []).some((c) => c.toLowerCase().includes(kw));
}

function filterGrantNode(
  node: FunctionGrantMenuNode,
  kw: string,
  t: (key: string, opts?: { defaultValue?: string }) => string
): FunctionGrantMenuNode | null {
  const titleText = translateGrantMenuTitle(node, t).toLowerCase();
  const titleMatch =
    titleText.includes(kw) ||
    (node.title || '').toLowerCase().includes(kw) ||
    (node.path || '').toLowerCase().includes(kw) ||
    (node.resource || '').toLowerCase().includes(kw);

  const matchingActions = node.actions.filter((a) => actionMatchesSearch(a, kw, t));
  const filteredChildren = (node.children || [])
    .map((child) => filterGrantNode(child, kw, t))
    .filter((child): child is FunctionGrantMenuNode => child !== null);

  if (titleMatch) {
    return { ...node, children: node.children || [], actions: node.actions };
  }
  if (matchingActions.length > 0) {
    return {
      ...node,
      actions: matchingActions,
      children: filteredChildren,
    };
  }
  if (filteredChildren.length > 0) {
    return { ...node, actions: node.actions, children: filteredChildren };
  }
  return null;
}

/** 按菜单标题、路径、权限码、操作名筛选功能权限树（保留匹配节点的祖先路径） */
export function filterFunctionGrantTree(
  nodes: FunctionGrantMenuNode[],
  keyword: string,
  t: (key: string, opts?: { defaultValue?: string }) => string
): FunctionGrantMenuNode[] {
  const kw = keyword.trim().toLowerCase();
  if (!kw) return nodes;
  return nodes
    .map((node) => filterGrantNode(node, kw, t))
    .filter((node): node is FunctionGrantMenuNode => node !== null);
}

export function collectMenuExpandKeysFromGrantTree(
  nodes: FunctionGrantMenuNode[],
  maxDepth = Number.POSITIVE_INFINITY,
): React.Key[] {
  const keys: React.Key[] = [];
  const walk = (list: FunctionGrantMenuNode[], depth: number) => {
    for (const n of list) {
      if (n.children?.length) {
        if (depth < maxDepth) {
          keys.push(`menu-${n.menu_uuid}`);
        }
        walk(n.children, depth + 1);
      }
    }
  };
  walk(nodes, 0);
  return keys;
}

type Props = {
  tree: FunctionGrantMenuNode[];
  grantedCodes: Set<string>;
  expandedKeys: React.Key[];
  onExpand: (keys: React.Key[]) => void;
  onToggle: (codes: string[], checked: boolean) => void;
  t: (key: string, opts?: { defaultValue?: string }) => string;
};

type GrantTreeNode = DataNode & {
  _grantNode?: FunctionGrantMenuNode;
  _titleText?: string;
};

export const FunctionGrantTree: React.FC<Props> = ({
  tree,
  grantedCodes,
  expandedKeys,
  onExpand,
  onToggle,
  t,
}) => {
  const { token } = theme.useToken();

  const antTreeData: DataNode[] = useMemo(() => {
    const mapNode = (node: FunctionGrantMenuNode): DataNode => {
      const title = translateGrantMenuTitle(node, t);
      const children = (node.children || []).map(mapNode);
      return {
        key: `menu-${node.menu_uuid}`,
        title,
        icon: <AppstoreOutlined />,
        disableCheckbox: true,
        children,
        _grantNode: node,
        _titleText: title,
      } as DataNode & { _grantNode: FunctionGrantMenuNode; _titleText: string };
    };
    return tree.map(mapNode);
  }, [tree, t]);

  return (
    <Tree
      className="permission-tree-horizontal"
      treeData={antTreeData}
      expandedKeys={expandedKeys}
      onExpand={(keys) => onExpand(keys as React.Key[])}
      showIcon
      titleRender={(node: GrantTreeNode) => {
        const grantNode = node._grantNode;
        if (!grantNode?.actions?.length) {
          return (
            <span style={{ fontWeight: node.children?.length ? 600 : undefined, color: token.colorPrimary }}>
              {node._titleText ?? String(node.title ?? '')}
            </span>
          );
        }
        return (
          <span className="permission-menu-title-wrap">
            <span style={{ fontWeight: node.children?.length ? 600 : undefined, color: token.colorPrimary }}>
              {node._titleText ?? String(node.title ?? '')}
            </span>
            <div className="permission-action-row">
              {grantNode.actions.map((item) => {
                const checked = isActionGranted(item, grantedCodes);
                return (
                  <label key={`${grantNode.menu_uuid}:${item.code}`} className="permission-action-chip">
                    <Checkbox
                      checked={checked}
                      onChange={(e) => onToggle(codesFromAction(item), e.target.checked)}
                    />
                    <span style={{ whiteSpace: 'nowrap' }}>{grantActionLabel(item, t)}</span>
                  </label>
                );
              })}
            </div>
          </span>
        );
      }}
    />
  );
};
