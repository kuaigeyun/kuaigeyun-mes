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
 * 权限模板：预设角色权限集，用于快速应用常见权限组合
 * 每个模板包含 permission codes（支持前缀匹配，如 user: 表示所有 user 开头的权限）
 */
export const PERMISSION_TEMPLATES: Array<{
  key: string;
  name: string;
  description?: string;
  codes: string[];
}> = [
  {
    key: 'viewer',
    name: '查看者',
    description: '仅有查看权限（read）',
    codes: [],
  },
  {
    key: 'editor',
    name: '编辑者',
    description: '查看 + 创建 + 更新',
    codes: [],
  },
  {
    key: 'admin',
    name: '管理员',
    description: '全部权限',
    codes: [],
  },
];

/**
 * 根据权限 code 匹配模板
 * 空 codes 的模板按 key 特殊处理
 */
export function getPermissionUuidsByTemplate(
  templateKey: string,
  allPermissions: Array<{ uuid: string; code: string }>
): string[] {
  const template = PERMISSION_TEMPLATES.find((t) => t.key === templateKey);
  if (!template) return [];

  if (templateKey === 'admin') {
    return allPermissions.map((p) => p.uuid);
  }
  if (templateKey === 'viewer') {
    return allPermissions
      .filter((p) => p.code.endsWith(':read') || p.code.endsWith(':view'))
      .map((p) => p.uuid);
  }
  if (templateKey === 'editor') {
    return allPermissions
      .filter(
        (p) =>
          p.code.endsWith(':read') ||
          p.code.endsWith(':view') ||
          p.code.endsWith(':create') ||
          p.code.endsWith(':update')
      )
      .map((p) => p.uuid);
  }

  return allPermissions
    .filter((p) => template.codes.some((c) => p.code === c || p.code.startsWith(c)))
    .map((p) => p.uuid);
}

/**
 * 根据资源名获取所属模块
 */
export function getModuleByResource(resource: string): string {
  for (const [module, resources] of Object.entries(PERMISSION_MODULE_MAP)) {
    if (resources.includes(resource)) {
      return module;
    }
  }
  return 'other';
}
