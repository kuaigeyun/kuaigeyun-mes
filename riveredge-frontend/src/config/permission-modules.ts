/**
 * 权限模块配置
 *
 * 定义权限的模块分组及资源归属，用于角色权限页面的树形展示。
 * 支持按应用/租户扩展，新增资源时在此追加即可。
 */

/** 模块 Key 到资源列表的映射 */
export const PERMISSION_MODULE_MAP: Record<string, string[]> = {
  system: [
    'user',
    'role',
    'permission',
    'code_rule',
    'system_config',
    'dictionary',
    'operation_log',
    'tenant',
    'app_config',
    'menu',
  ],
  master_data: [
    'material',
    'warehouse',
    'location',
    'inventory',
    'supplier',
    'customer',
    'bom',
    'routing',
    'process',
  ],
  sales: ['sales_order', 'sales_return', 'sales_quotation'],
  purchase: ['purchase_order', 'purchase_return', 'purchase_requisition'],
  finance: ['payable', 'receivable', 'receipt', 'payment'],
  manufacturing: [
    'work_order',
    'production_plan',
    'process_inspection',
    'mrp',
    'lrp',
  ],
};

/** 模块 Key 到展示名称的映射（可用 i18n key 替换） */
export const PERMISSION_MODULE_NAMES: Record<string, string> = {
  system: '系统管理',
  master_data: '基础数据',
  sales: '销售管理',
  purchase: '采购管理',
  finance: '财务管理',
  manufacturing: '制造管理',
  other: '其他',
};

/**
 * 菜单未覆盖到任何权限码时的模块展示顺序（与业务流一致，作二级排序）
 */
export const PERMISSION_MODULE_ORDER: string[] = [
  'system',
  'master_data',
  'sales',
  'purchase',
  'finance',
  'manufacturing',
  'other',
];

export const PERMISSION_TEMPLATES: Array<{
  key: string;
  name: string;
  description?: string;
  codes: string[];
}> = [
  { key: 'viewer', name: '查看者', description: '仅有查看权限（read/view/list/query/detail）', codes: [] },
  { key: 'editor', name: '编辑者', description: '查看 + 创建 + 更新', codes: [] },
  { key: 'admin', name: '管理员', description: '全部权限', codes: [] },
];

function permissionMatchesTemplateKey(code: string, templateKey: string): boolean {
  if (templateKey === 'admin' || templateKey === 'manager') {
    return true;
  }
  if (templateKey === 'viewer') {
    return (
      code.endsWith(':read') ||
      code.endsWith(':view') ||
      code.endsWith(':list') ||
      code.endsWith(':query') ||
      code.endsWith(':detail')
    );
  }
  if (templateKey === 'editor') {
    return (
      code.endsWith(':read') ||
      code.endsWith(':view') ||
      code.endsWith(':list') ||
      code.endsWith(':query') ||
      code.endsWith(':detail') ||
      code.endsWith(':create') ||
      code.endsWith(':update')
    );
  }
  const template = PERMISSION_TEMPLATES.find((item) => item.key === templateKey);
  if (!template) return false;
  return template.codes.some((c) => code === c || code.startsWith(c));
}

/** 按模板从给定 code 列表筛选（无需拉全量 permissions API） */
export function filterPermissionCodesByTemplate(
  templateKey: string,
  codes: string[],
): string[] {
  const normalized = [...new Set(codes.map((c) => (c || '').trim().toLowerCase()).filter(Boolean))];
  if (templateKey === 'admin' || templateKey === 'manager') {
    return normalized;
  }
  return normalized.filter((code) => permissionMatchesTemplateKey(code, templateKey));
}

/** 按模板返回权限 code 列表（功能权限勾选使用 code 真源） */
export function getPermissionCodesByTemplate(
  templateKey: string,
  allPermissions: Array<{ code: string }>
): string[] {
  return filterPermissionCodesByTemplate(
    templateKey,
    allPermissions.map((p) => p.code),
  );
}

export function getPermissionUuidsByTemplate(
  templateKey: string,
  allPermissions: Array<{ uuid: string; code: string }>
): string[] {
  const template = PERMISSION_TEMPLATES.find((item) => item.key === templateKey);
  if (!template) return [];
  return allPermissions
    .filter((p) => permissionMatchesTemplateKey((p.code || '').trim().toLowerCase(), templateKey))
    .map((p) => p.uuid);
}

export function getModuleByResource(resource: string): string {
  for (const [module, resources] of Object.entries(PERMISSION_MODULE_MAP)) {
    if (resources.includes(resource)) {
      return module;
    }
  }
  return 'other';
}
