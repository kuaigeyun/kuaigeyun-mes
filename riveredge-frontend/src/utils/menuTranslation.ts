/**
 * 菜单翻译工具函数
 *
 * 提供统一的菜单名称翻译逻辑，支持翻译 key 和路径映射
 *
 * Author: Luigi Lu
 * Date: 2025-12-26
 */

/**
 * 从菜单路径提取应用 code
 *
 * 例如：
 * - /apps/kuaizhizao/... → kuaizhizao
 * - /apps/master-data/... → master-data
 *
 * @param path 菜单路径
 * @returns 应用 code，如果路径不匹配则返回 null
 */
export function extractAppCodeFromPath(path: string | undefined): string | null {
  if (!path) return null;
  const match = path.match(/^\/apps\/([^/]+)/);
  return match ? match[1] : null;
}

/** 虚拟拆分应用：菜单文案与快制造共用 locale（app.kuaizhizao.menu.*） */
const KUAIZHIZAO_VIRTUAL_APP_CODES = new Set(['kuaierp', 'kuaimes']);

function translateWithKuaizhizaoMenuFallback(
  appCode: string,
  menuSuffix: string,
  t: (key: string, options?: { defaultValue?: string }) => string
): string {
  const primaryKey = `app.${appCode}.menu.${menuSuffix}`;
  let translated = t(primaryKey, { defaultValue: '' });
  if (translated && translated !== primaryKey && translated.trim() !== '') return translated;
  if (!KUAIZHIZAO_VIRTUAL_APP_CODES.has(appCode)) return '';
  const fallbackKey = `app.kuaizhizao.menu.${menuSuffix}`;
  translated = t(fallbackKey, { defaultValue: '' });
  if (translated && translated !== fallbackKey && translated.trim() !== '') return translated;
  return '';
}

/** 从 /apps/{code}/... 路径解析菜单 i18n 后缀并翻译（虚拟应用回退快制造） */
function translateAppMenuByPath(
  path: string,
  t: (key: string, options?: { defaultValue?: string }) => string
): string {
  const appCode = extractAppCodeFromPath(path);
  if (!appCode) return '';
  const normalized = path.replace(/\/$/, '');
  if (normalized === `/apps/${appCode}`) {
    return getAppDisplayName(appCode, t, '');
  }
  const relativePath = normalized.replace(`/apps/${appCode}/`, '');
  if (!relativePath) return '';

  const patrolReportTitle = tryHaoligoPatrolReportGroupMenuTitle(appCode, relativePath, t);
  if (patrolReportTitle) return patrolReportTitle;

  const pathKey = relativePath.replace(/\//g, '.');
  let translated = translateWithKuaizhizaoMenuFallback(appCode, pathKey, t);
  if (translated) return translated;

  if (relativePath.includes('reports/')) {
    const reportSuffix = relativePath.split('reports/').pop()?.replace(/\//g, '.') || '';
    translated = translateWithKuaizhizaoMenuFallback(appCode, `reports.${reportSuffix}`, t);
    if (translated) return translated;
  }

  if (relativePath.startsWith('performance/')) {
    const perfSuffix = `performance-management.${relativePath.replace('performance/', '').replace(/\//g, '.')}`;
    translated = translateWithKuaizhizaoMenuFallback(appCode, perfSuffix, t);
    if (translated) return translated;
  }

  return '';
}

/**
 * 数据库或历史同步可能把根菜单的 title（形如 app.some-app.name）错误写到子菜单上。
 * 若仍按该 key 直译，侧边栏会出现多个应用名。此时应走 path / 子节点 path 推导业务标题。
 */
function findFirstMenuPathDeep(items?: { path?: string; children?: any[] }[]): string | null {
  if (!items?.length) return null;
  for (const item of items) {
    if (item?.path) return item.path;
    if (item?.children?.length) {
      const found = findFirstMenuPathDeep(item.children);
      if (found) return found;
    }
  }
  return null;
}

/**
 * 好力 GO：去掉历史「模块·」前缀，并把说明性/口号式旧菜单名规范为侧栏常用名词（与 locale 中 app.haoligo.menu.* 对齐）。
 */
function sanitizeHaoligoMenuDisplayTitle(
  name: string,
  path: string | undefined,
  children?: { path?: string; children?: any[] }[]
): string {
  if (!name || name.includes('.')) return name;
  const effectivePath = path || findFirstMenuPathDeep(children || []);
  if (!effectivePath?.includes('/apps/haoligo/')) return name;

  let out = name.trim();
  if (effectivePath.includes('/apps/haoligo/equipment')) {
    out = out.replace(/^设备\s*[·・]\s*/u, '').trim();
    const map: Record<string, string> = {
      主数据: '基础数据',
      记录与现场一致: '点检巡检',
      记录与现场: '点检巡检',
      点检与巡检: '点检巡检',
      报表与大屏: '看板统计',
      看板与统计: '看板统计',
      设置与集成: '集成设置',
    };
    return map[out] ?? out;
  }
  if (effectivePath.includes('/apps/haoligo/molds')) {
    out = out.replace(/^模具\s*[·・]\s*/u, '').trim();
    const map: Record<string, string> = {
      工作台与审批: '审批待办',
      报表: '统计报表',
    };
    return map[out] ?? out;
  }
  if (effectivePath.includes('/apps/haoligo/patrol')) {
    out = out.replace(/^巡查\s*[·・]\s*/u, '').trim();
    const map: Record<string, string> = {
      业务操作: '日常巡查',
      业务办理: '日常巡查',
      现场办理: '日常巡查',
      管理视图与图表: '分析看板',
      与设备对齐: '设备报表',
      '与设备 §6.3 对齐': '设备报表',
    };
    return map[out] ?? out;
  }
  return out;
}

/**
 * 好力 GO 现场巡查统计报表：path 为 `patrol/reports/group/{volume|completion|area|insights}`，
 * 与 manifest / zh-CN 的 key 为 `app.haoligo.menu.patrol.group.reports.*`（注意是 patrol.group.reports，不是 patrol.reports.group）。
 * 若不单独处理，会误推成 `app.haoligo.menu.patrol.reports.group.volume` 并不命中，侧栏与面包屑回退为英文末段「Volume」等。
 */
function tryHaoligoPatrolReportGroupMenuTitle(
  appCode: string,
  relativePath: string,
  t: (key: string, options?: { defaultValue?: string }) => string
): string | null {
  if (appCode !== 'haoligo' || !relativePath.startsWith('patrol/reports/group/')) return null;
  const groupKey = relativePath.slice('patrol/reports/group/'.length).split('/')[0];
  if (!groupKey) return null;
  const key = `app.${appCode}.menu.patrol.group.reports.${groupKey}`;
  const out = t(key, { defaultValue: '' });
  if (out && out !== key && out.trim() !== '') return out;
  return null;
}

function isAppNameKeyMisassignedToNonRootPath(
  name: string,
  path: string | undefined,
  children?: { path?: string; children?: any[] }[]
): boolean {
  const m = name.match(/^app\.([a-z0-9-]+)\.name$/i);
  if (!m) return false;
  const appCode = m[1];
  const effectivePath = path || findFirstMenuPathDeep(children) || undefined;
  if (!effectivePath) return false;
  if (extractAppCodeFromPath(effectivePath) !== appCode) return false;
  const normalized = effectivePath.replace(/\/$/, '');
  return normalized !== `/apps/${appCode}`;
}

/**
 * 应用显示名唯一来源：仅从 locale 的 app.${appCode}.name 取值，避免与 API 返回的 name 竞争
 *
 * @param appCode 应用 code（如 master-data）
 * @param t 翻译函数
 * @param fallback 当翻译不存在或等于 key 时的兜底
 * @returns 显示名
 */
export function getAppDisplayName(
  appCode: string,
  t: (key: string, options?: { defaultValue?: string }) => string,
  fallback?: string
): string {
  const key = `app.${appCode}.name`;
  const translated = t(key, { defaultValue: fallback ?? '' });
  if (translated && translated !== key && translated.trim() !== '') return translated;
  return fallback ?? '';
}

/**
 * 应用描述：优先 app.${code}.desc，其次 sys.app.${code}.desc，最后 fallback
 */
export function getAppDescription(
  appCode: string,
  t: (key: string, options?: { defaultValue?: string }) => string,
  fallback?: string
): string {
  const key = `app.${appCode}.desc`;
  let translated = t(key, { defaultValue: '' });
  if (translated && translated !== key && translated.trim() !== '') return translated;
  const legacyKey = `sys.app.${appCode}.desc`;
  translated = t(legacyKey, { defaultValue: fallback ?? '' });
  if (translated && translated !== legacyKey && translated.trim() !== '') return translated;
  return fallback ?? '';
}

/** 应用中心 / 详情：名称（与侧栏 getAppDisplayName 同源，不区分 is_system） */
export function resolveApplicationDisplayName(
  record: { code?: string; name?: string | null },
  t: (key: string, options?: { defaultValue?: string }) => string,
): string {
  const val = record.name ?? '';
  if (typeof val === 'string' && val.startsWith('sys.')) return t(val);
  if (record.code) return getAppDisplayName(record.code, t, val);
  return val;
}

/** 应用中心 / 详情：描述 */
export function resolveApplicationDescription(
  record: { code?: string; description?: string | null },
  t: (key: string, options?: { defaultValue?: string }) => string,
  emptyFallback = '',
): string {
  const val = record.description ?? '';
  if (typeof val === 'string' && val.startsWith('sys.')) return t(val);
  if (record.code) return getAppDescription(record.code, t, val || emptyFallback);
  return val || emptyFallback;
}

/** 系统菜单分组：库内英文 slug → 现行 menu.group.* key（与 system_menu_config 分组同义） */
const SYSTEM_MENU_GROUP_SLUG_TO_I18N: Record<string, string> = {
  settings: 'menu.group.core-config',
  organization: 'menu.group.user-management',
  integration: 'menu.group.data-center',
  'workflow-and-message': 'menu.group.process-management',
  'security-and-logs': 'menu.group.monitoring-ops',
};

function tryTranslateSystemMenuGroupSlug(
  name: string,
  t: (key: string, options?: { defaultValue?: string }) => string,
): string {
  const trimmed = name.trim();
  if (!trimmed || trimmed.includes('.') || trimmed.startsWith('/')) return '';

  const directKey = `menu.group.${trimmed}`;
  let translated = t(directKey, { defaultValue: '' });
  if (translated && translated !== directKey && translated.trim() !== '') return translated;

  const legacyKey = SYSTEM_MENU_GROUP_SLUG_TO_I18N[trimmed];
  if (!legacyKey) return '';
  translated = t(legacyKey, { defaultValue: '' });
  if (translated && translated !== legacyKey && translated.trim() !== '') return translated;
  return '';
}

/**
 * 统一处理菜单名称翻译
 *
 * @param name 菜单名称（可能是翻译 key 或普通文本）
 * @param t 翻译函数
 * @param path 菜单路径（用于后备方案）
 * @returns 翻译后的文本
 */
export function translateMenuName(
  name: string | undefined,
  t: any,
  path?: string
): string {
  if (!name) return '';

  const slugTranslated = tryTranslateSystemMenuGroupSlug(name, t);
  if (slugTranslated) return slugTranslated;

  // 1. 如果 name 是翻译 key（包含点号且不是路径），直接翻译
  if (name.includes('.') && !name.startsWith('/')) {
    if (!isAppNameKeyMisassignedToNonRootPath(name, path)) {
      const translated = t(name, { defaultValue: name });
      if (translated !== name) return translated;
    }
    // 翻译失败时，禁止回退到应用名，否则报表等子菜单会错误显示为「快格轻制造」
    // 直接尝试路径翻译或返回原 key
  }

  // 2. 仅当 name 非 i18n key 且内容为空时，才用应用名兜底（如根菜单、空名称等）
  // 注意：如果 name 已有内容（可能是已翻译后的文本），不应强行覆盖为应用名，否则会引发「二次翻译」Bug
  const isI18nKey = name.includes('.') && !name.startsWith('/');
  if (!isI18nKey && (!name || name.trim() === '')) {
    const appCode = extractAppCodeFromPath(path);
    if (appCode) {
      const appNameKey = `app.${appCode}.name`;
      const translated = t(appNameKey, { defaultValue: '' });
      if (translated && translated !== appNameKey && translated.trim() !== '') {
        return translated;
      }
    }
  }

  // 3. 后备方案：尝试路径翻译
  if (path) {
    const pathTitle = translatePathTitle(path, t);
    if (pathTitle && pathTitle !== path) {
      return pathTitle;
    }
  }

  return name;
}

/**
 * 翻译应用菜单项名称
 *
 * @param name 原始菜单名称
 * @param path 菜单路径
 * @param t 翻译函数
 * @param children 子菜单项（可选，用于分组菜单）
 * @returns 翻译后的名称
 */
export function translateAppMenuItemName(
  name: string | undefined,
  path: string | undefined,
  t: any,
  children?: any[]
): string {
  if (!name) return '';

  // 1. 若 name 本身是翻译 key（如 app.kuaizhizao.menu.warehouse-management.inbound-group），优先直接翻译
  // 修复：分组菜单的 title 为 i18n key 时，此前被路径推导逻辑覆盖，导致二级菜单均显示父级名称
  if (name.includes('.') && !name.startsWith('/')) {
    if (!isAppNameKeyMisassignedToNonRootPath(name, path, children)) {
      const directTranslated = t(name, { defaultValue: name });
      if (directTranslated !== name && directTranslated.trim() !== '') {
        return directTranslated;
      }
    }
  }

  let appCode = extractAppCodeFromPath(path);
  let relativePath: string | null = null;

  if (path) {
    const fromPath = translateAppMenuByPath(path, t);
    if (fromPath) return fromPath;
    appCode = extractAppCodeFromPath(path);
    if (appCode) {
      relativePath = path.replace(`/apps/${appCode}/`, '');
    }
  } else if (children && children.length > 0) {
    // 处理分组菜单：递归找到第一个有 path 的子孙节点
    const findFirstPath = (items: any[]): string | null => {
      for (const child of items) {
        if (child?.path) return child.path;
        if (child?.children?.length > 0) {
          const found = findFirstPath(child.children);
          if (found) return found;
        }
      }
      return null;
    };
    const firstChildPath = findFirstPath(children);
    if (firstChildPath) {
      appCode = extractAppCodeFromPath(firstChildPath);
      if (appCode) {
        const childRel = firstChildPath.replace(`/apps/${appCode}/`, '');
        const segments = childRel.split('/');
        // 取倒数第二段作为分组 key（如 warehouse-management/inbound → warehouse-management）
        relativePath = segments.length > 1 ? segments[segments.length - 2] : segments[0];
      }
    }
  }


  if (appCode && relativePath) {
    const translated = translateWithKuaizhizaoMenuFallback(appCode, relativePath.replace(/\//g, '.'), t);
    if (translated) return translated;

    if (relativePath.includes('reports/')) {
      const reportSuffix = relativePath.split('reports/').pop()?.replace(/\//g, '.') || '';
      const reportTranslated = translateWithKuaizhizaoMenuFallback(appCode, `reports.${reportSuffix}`, t);
      if (reportTranslated) return reportTranslated;
    }

    if (relativePath.startsWith('performance/')) {
      const perfSuffix = `performance-management.${relativePath.replace('performance/', '').replace(/\//g, '.')}`;
      const perfTranslated = translateWithKuaizhizaoMenuFallback(appCode, perfSuffix, t);
      if (perfTranslated) return perfTranslated;
    }

    const isSingleSegment = !relativePath.includes('/');
    const skipGlobalPathFallback =
      !!appCode &&
      isSingleSegment &&
      ['reports', 'charts', 'settings', 'dashboard', 'documents', 'management', 'daily'].includes(relativePath);
    if (!skipGlobalPathFallback) {
      const lastSegment = relativePath.split('/').pop() || '';
      if (lastSegment) {
        const segmentKey = `path.${lastSegment}`;
        const segmentTranslated = t(segmentKey, { defaultValue: '' });
        if (segmentTranslated && segmentTranslated !== segmentKey && segmentTranslated.trim() !== '') {
          return segmentTranslated;
        }
      }
    }
  }

  const displayName = sanitizeHaoligoMenuDisplayTitle(name, path, children);
  if (path) {
    const pathTitle = translatePathTitle(path, t);
    if (pathTitle && pathTitle !== path) return pathTitle;
  }
  return translateMenuName(displayName, t, path);
}

/**
 * 为 TreeSelect 等选择器生成展示用菜单树：保留 uuid/path 等字段，将 name 替换为译文。
 */
export function mapMenuTreeWithTranslatedLabels<
  T extends { name?: string; path?: string; children?: T[] },
>(nodes: T[] | undefined, t: (key: string, options?: { defaultValue?: string }) => string): T[] {
  if (!nodes?.length) return [];
  return nodes.map((node) => {
    const children = node.children?.length
      ? mapMenuTreeWithTranslatedLabels(node.children, t)
      : node.children;
    return {
      ...node,
      name: translateAppMenuItemName(node.name, node.path, t, children),
      children,
    };
  });
}

/**
 * 根据路径片段获取翻译后的标题
 *
 * @param path 完整路径
 * @param t 翻译函数
 * @returns 翻译后的标题
 */
export function translatePathTitle(path: string, t: any): string {
  if (!path || path === '/') return '';

  // 去除查询参数，避免 dashboard-designer?id=xxx 等无法匹配翻译 key
  const pathname = path.split('?')[0];

  // 处理 UUID（不显示在面包屑中）
  const segment = pathname.split('/').filter(Boolean).pop() || '';
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(segment)) {
    return '';
  }

  // 1. 优先尝试应用菜单翻译（针对 /apps/{app-code}/... 格式的路径）
  const fromAppPath = translateAppMenuByPath(pathname, t);
  if (fromAppPath) return fromAppPath;

  // 2. 尝试多种前缀的翻译 (path.*, menu.*)
  const dotPath = pathname.replace(/^\//, '').replace(/\//g, '.');
  const translationKeys = [
    `path.${dotPath}`,
    `menu.${dotPath}`, 
    `menu.${dotPath.replace('system.', '')}`, // 兼容 menu.dashboard.workplace
  ];

  for (const key of translationKeys) {
    const translated = t(key, { defaultValue: '' });
    if (translated && translated !== key && translated.trim() !== '') {
      return translated;
    }
  }

  // 3. 尝试段翻译（虚拟应用禁止回退为英文 path 片段）
  if (segment) {
    const segmentKey = `path.${segment}`;
    const segmentTranslated = t(segmentKey, { defaultValue: '' });
    if (segmentTranslated && segmentTranslated !== segmentKey) return segmentTranslated;

    const appCode = extractAppCodeFromPath(pathname);
    if (appCode && KUAIZHIZAO_VIRTUAL_APP_CODES.has(appCode)) {
      return segment;
    }

    return segment.charAt(0).toUpperCase() + segment.slice(1);
  }

  return path;
}

/**
 * 从菜单配置中查找页面标题（最后一道防线）
 *
 * @param path 路径
 * @param menuConfig 菜单配置
 * @param t 翻译函数
 * @returns 翻译后的标题
 */
export function findMenuTitleWithTranslation(
  path: string,
  menuConfig: any[],
  t: any
): string {
  const findInMenu = (items: any[] | undefined): string | null => {
    if (!items) return null;
    for (const item of items) {
      const menuName = item.name || item.title;
      const itemPath = item.path;
      
      if (itemPath && itemPath.replace(/\/$/, '') === path.replace(/\/$/, '')) {
        const isApp = itemPath.startsWith('/apps/');
        return isApp ? translateAppMenuItemName(menuName, itemPath, t) : translateMenuName(menuName, t, itemPath);
      }
      
      if (item.children) {
        const found = findInMenu(item.children);
        if (found) return found;
      }
    }
    return null;
  };

  const title = findInMenu(menuConfig);
  if (title) return title;

  // 尝试路径翻译（如 dashboard-designer → 大屏设计器，未在菜单中注册的页面）
  const pathTitle = translatePathTitle(path, t);
  if (pathTitle && pathTitle.trim() !== '') return pathTitle;

  // 如果没匹配到，向上溯源（解决从列表跳到未注册详情页的问题）
  const segments = path.split('/').filter(Boolean);
  if (segments.length > 1) {
    segments.pop();
    const parentPath = '/' + segments.join('/');
    if (parentPath !== '/' && parentPath !== '/apps' && parentPath !== '/system') {
      return findMenuTitleWithTranslation(parentPath, menuConfig, t);
    }
  }

  return translatePathTitle(path, t) || t('common.unnamedPage');
}
