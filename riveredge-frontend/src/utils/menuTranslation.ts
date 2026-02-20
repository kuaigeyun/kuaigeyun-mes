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

  // 1. 如果 name 是翻译 key（包含点号且不是路径），直接翻译
  if (name.includes('.') && !name.startsWith('/')) {
    const translated = t(name, { defaultValue: name });
    if (translated !== name) return translated;
  }

  // 2. 优先从路径提取应用 code（最可靠的方法）
  const appCode = extractAppCodeFromPath(path);
  if (appCode) {
    const appNameKey = `app.${appCode}.name`;
    const translated = t(appNameKey, { defaultValue: '' });
    if (translated && translated !== appNameKey && translated.trim() !== '') {
      return translated;
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
    const directTranslated = t(name, { defaultValue: name });
    if (directTranslated !== name && directTranslated.trim() !== '') {
      return directTranslated;
    }
  }

  let appCode = extractAppCodeFromPath(path);
  let relativePath: string | null = null;

  if (path && appCode) {
    relativePath = path.replace(`/apps/${appCode}/`, '');
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
    const menuKey = `app.${appCode}.menu.${relativePath.replace(/\//g, '.')}`;
    const translated = t(menuKey, { defaultValue: '' });
    if (translated && translated !== menuKey && translated.trim() !== '') {
      return translated;
    }

    // 尝试第一段作为分组 fallback
    const firstSegment = relativePath.split('/')[0];
    const groupKey = `app.${appCode}.menu.${firstSegment}`;
    const groupTranslated = t(groupKey, { defaultValue: '' });
    if (groupTranslated && groupTranslated !== groupKey && groupTranslated.trim() !== '') {
      return groupTranslated;
    }
  }

  // 回退到通用翻译
  return translateMenuName(name, t, path);
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

  // 处理 UUID（不显示在面包屑中）
  const segment = path.split('/').filter(Boolean).pop() || '';
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(segment)) {
    return '';
  }

  // 1. 优先尝试应用菜单翻译（针对 /apps/{app-code}/... 格式的路径）
  const appCode = extractAppCodeFromPath(path);
  if (appCode) {
    const relativePath = path.replace(`/apps/${appCode}/`, '');
    const menuKey = `app.${appCode}.menu.${relativePath.replace(/\//g, '.')}`;
    const translated = t(menuKey, { defaultValue: '' });
    if (translated && translated !== menuKey) return translated;
  }

  // 2. 尝试多种前缀的翻译 (path.*, menu.*)
  const dotPath = path.replace(/^\//, '').replace(/\//g, '.');
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

  // 3. 尝试段翻译
  if (segment) {
    const segmentKey = `path.${segment}`;
    const segmentTranslated = t(segmentKey, { defaultValue: '' });
    if (segmentTranslated && segmentTranslated !== segmentKey) return segmentTranslated;
    
    // 默认大写
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
