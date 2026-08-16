import type { DepartmentTreeItem } from '../../../services/department';

export type OaLookupKind = 'user' | 'customer' | 'material' | 'department' | 'supplier' | 'operation';

type OaLookupFieldRef = {
  name: string;
  type?: string;
  hideInForm?: boolean;
};

const USER_NAME_FIELDS = new Set([
  'applicant_name',
  'custodian_name',
  'trainee_name',
  'trainer_name',
  'holder_name',
  'publisher_name',
]);

export function resolveOaLookupKind(field: Pick<OaLookupFieldRef, 'name' | 'type'>): OaLookupKind | null {
  const typed = field.type;
  if (
    typed === 'user' ||
    typed === 'customer' ||
    typed === 'material' ||
    typed === 'department' ||
    typed === 'supplier' ||
    typed === 'operation'
  ) {
    return typed;
  }
  const name = field.name;
  if (name === 'customer_name' || name === 'customer_id') return 'customer';
  if (name === 'supplier_name' || name === 'supplier_id') return 'supplier';
  if (name === 'material_code' || name === 'material_name' || name === 'material_id') return 'material';
  if (name === 'department_name' || name === 'scope_department') return 'department';
  if (name === 'operation_name') return 'operation';
  if (USER_NAME_FIELDS.has(name)) return 'user';
  return null;
}

/** 物料编码+名称同时存在时，表单只渲染一个物料下拉 */
export function shouldSkipOaFormField(field: OaLookupFieldRef, fields: OaLookupFieldRef[]): boolean {
  if (field.hideInForm || field.name === 'status') return true;
  if (field.name === 'material_name' && fields.some((item) => item.name === 'material_code')) {
    return true;
  }
  return false;
}

export function stripOaLookupPayload(values: Record<string, unknown>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    if (key.startsWith('_')) continue;
    payload[key] = value;
  }
  return payload;
}

export function flattenDepartmentOptions(
  items: DepartmentTreeItem[],
  prefix = '',
): Array<{ label: string; value: string }> {
  const options: Array<{ label: string; value: string }> = [];
  for (const item of items) {
    if (item.is_active === false) continue;
    const label = prefix ? `${prefix} / ${item.name}` : item.name;
    options.push({ label, value: item.name });
    if (item.children?.length) {
      options.push(...flattenDepartmentOptions(item.children, label));
    }
  }
  return options;
}

export function companionIdField(nameField: string): string {
  return nameField.endsWith('_name') ? `${nameField.slice(0, -5)}_id` : `${nameField}_id`;
}
