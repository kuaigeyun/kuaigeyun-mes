import React, { useMemo } from 'react';
import { Checkbox, Tree, theme } from 'antd';
import { AppstoreOutlined } from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import type { FunctionGrantAction, FunctionGrantMenuNode } from '../../../../services/role';
import {
  extractAppCodeFromPath,
  translateAppMenuItemName,
  translateMenuName,
} from '../../../../utils/menuTranslation';

function simpleActionLabel(
  action: FunctionGrantAction,
  t: (key: string, opts?: { defaultValue?: string }) => string
): string {
  const raw = (action.action || '').toLowerCase().trim();
  const map: Record<string, string> = {
    create: '创建',
    read: '查看',
    view: '查看',
    list: '查看',
    query: '查看',
    detail: '查看',
    update: '编辑',
    edit: '编辑',
    delete: '删除',
    import: '导入',
    export: '导出',
    submit: '提交',
    approve: '审核',
    audit: '审核',
    reject: '审核',
    revoke: '撤销',
    assign: '分配',
    execute: '执行',
    print: '打印',
  };
  if (map[raw]) return map[raw];

  const tr = t(`permission.action.${raw}`, { defaultValue: '' });
  if (tr && tr !== `permission.action.${raw}`) return tr;

  // 默认动作文案，避免直接展示后端原始 label
  return '权限';
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

function translateMenuTitle(node: FunctionGrantMenuNode, t: (k: string, o?: { defaultValue?: string }) => string): string {
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
      const title = translateMenuTitle(node, t);
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
                    <span style={{ whiteSpace: 'nowrap' }}>{simpleActionLabel(item, t)}</span>
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
