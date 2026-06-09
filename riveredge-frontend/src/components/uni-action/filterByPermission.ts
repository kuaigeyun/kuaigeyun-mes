import React from 'react';
import type { ResourcePermissionGates } from '../../hooks/useResourcePermissions';
import { readNodeText, resolveActionKind } from './actionText';

function isCreateLikeAction(text: string): boolean {
  const normalized = text.replace(/\s+/g, '');
  return /新增|添加|创建|录入|登记/.test(normalized);
}

/**
 * 按标准 action 隐藏行内操作（无权限不渲染，非禁用）。
 */
export function filterActionsByResourcePermission(
  nodes: React.ReactNode[],
  gates: ResourcePermissionGates,
): React.ReactNode[] {
  if (!gates.enabled) return nodes;

  return nodes.filter((node) => {
    if (node == null || node === false) return false;
    const kind = resolveActionKind(node);
    const text = readNodeText(node);

    switch (kind) {
      case 'detail':
        return gates.canRead;
      case 'edit':
        return gates.canUpdate;
      case 'delete':
        return gates.canDelete;
      case 'print':
        return gates.canPrint;
      case 'common':
        if (isCreateLikeAction(text)) return gates.canCreate;
        return true;
      default:
        return false;
    }
  });
}
