import React from 'react'
import type { ResourcePermissionGates } from '../../hooks/useResourcePermissions'
import { readExplicitActionKind, type RowActionPermissionKind } from './actionText'

function passExplicitKind(kind: RowActionPermissionKind, gates: ResourcePermissionGates): boolean {
  if (kind === 'skip') return true
  return gates.canAction?.(kind) ?? false
}

/**
 * 按 manifest action（`data-action-kind`）隐藏行内操作（无权限不渲染，非禁用）。
 * 未显式标记的操作一律不展示（fail-closed）；禁止文案推断。
 */
export function filterActionsByResourcePermission(
  nodes: React.ReactNode[],
  gates: ResourcePermissionGates,
): React.ReactNode[] {
  if (!gates.enabled) return nodes

  return nodes.filter((node) => {
    if (node == null || node === false) return false
    const explicit = readExplicitActionKind(node)
    if (!explicit) return false
    return passExplicitKind(explicit, gates)
  })
}
