import type { DepartmentTreeItem } from '../../../services/department';

export type DepartmentPickerOption = {
  label: string;
  value: number;
  uuid: string;
};

export function flattenDepartmentTreeOptions(items: DepartmentTreeItem[]): DepartmentPickerOption[] {
  const out: DepartmentPickerOption[] = [];
  const walk = (nodes: DepartmentTreeItem[], prefix: string) => {
    nodes.forEach((node) => {
      const name = String(node.name ?? '').trim();
      if (!name || node.id == null || !node.uuid) return;
      const label = prefix ? `${prefix} / ${name}` : name;
      out.push({ label, value: node.id, uuid: node.uuid });
      if (node.children?.length) walk(node.children, label);
    });
  };
  walk(items, '');
  return out;
}
