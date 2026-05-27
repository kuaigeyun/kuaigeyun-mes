import type { DepartmentTreeItem } from '../../../services/department';

export function collectLeafDepartmentOptions(items: DepartmentTreeItem[]): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  for (const n of items) {
    if (n.children?.length) {
      out.push(...collectLeafDepartmentOptions(n.children));
    } else {
      out.push({ label: n.name, value: n.uuid });
    }
  }
  return out;
}

function findDeptNodeByUuid(items: DepartmentTreeItem[], uuid: string): DepartmentTreeItem | null {
  for (const n of items) {
    if (n.uuid === uuid) return n;
    if (n.children?.length) {
      const f = findDeptNodeByUuid(n.children, uuid);
      if (f) return f;
    }
  }
  return null;
}

function firstLeafUuidUnder(node: DepartmentTreeItem): string {
  if (!node.children?.length) return node.uuid;
  for (const c of node.children) {
    return firstLeafUuidUnder(c);
  }
  return node.uuid;
}

export function resolveDefaultLeafDeptUuid(
  tree: DepartmentTreeItem[],
  userDeptUuid: string | undefined,
): string | undefined {
  const u = (userDeptUuid || '').trim();
  if (!u || !tree.length) return undefined;
  const node = findDeptNodeByUuid(tree, u);
  if (!node) return undefined;
  return firstLeafUuidUnder(node);
}
