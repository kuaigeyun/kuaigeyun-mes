/**
 * 菜单翻译工具函数
 *
 * 提供统一的菜单名称翻译逻辑，支持翻译 key 和路径映射
 *
 * Author: Luigi Lu
 * Date: 2025-12-26
 */

import { TFunction } from 'i18next';

/**
 * 统一处理菜单名称翻译
 *
 * 如果 name 是翻译 key（如 'menu.dashboard'），则使用 t 函数翻译
 * 如果是普通文本，直接返回
 *
 * @param name 菜单名称（可能是翻译 key 或普通文本）
 * @param t 翻译函数
 * @returns 翻译后的文本
 */
export function translateMenuName(name: string | undefined, t: TFunction): string {
  if (!name) {
    return '';
  }

  // 如果 name 看起来像翻译 key（包含点号），尝试翻译
  if (name.includes('.') && !name.startsWith('/')) {
    const translated = t(name, { defaultValue: name });
    // 如果翻译结果不等于原始 key，说明翻译成功
    if (translated !== name) {
      return translated;
    }
  }

  // 否则直接返回原始文本
  return name;
}

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
  if (!path) {
    return null;
  }

  // 匹配 /apps/{app-code}/... 格式
  const match = path.match(/^\/apps\/([^/]+)/);
  if (match && match[1]) {
    return match[1];
  }

  return null;
}

/**
 * 翻译应用菜单名称
 *
 * 根据应用的 code 或路径来查找翻译 key。
 * 优先使用路径推断应用 code。
 *
 * @param name 原始菜单名称（可能是硬编码的中文）
 * @param path 菜单路径（用于推断应用 code，通常是应用第一个子菜单的路径）
 * @param applicationUuid 应用 UUID（可选，暂时未使用，保留用于未来扩展）
 * @param t 翻译函数
 * @returns 翻译后的文本
 */
export function translateAppMenuName(
  name: string | undefined,
  path: string | undefined,
  applicationUuid: string | undefined,
  t: TFunction
): string {
  if (!name) {
    return '';
  }

  // 如果 name 已经是翻译 key（包含点号且不是路径），直接翻译
  if (name.includes('.') && !name.startsWith('/')) {
    const translated = t(name, { defaultValue: name });
    if (translated !== name) {
      return translated;
    }
  }

  // 优先从路径提取应用 code（最可靠的方法，不依赖数据库中的名称）
  // 应用分组标题的翻译需要从子菜单路径推断应用 code
  const appCode = extractAppCodeFromPath(path);

  if (appCode) {
    // 构建应用菜单的翻译 key：app.{app-code}.name
    // 注意：这里使用 defaultValue 为 name，但如果 name 是中文，翻译失败时会返回中文
    // 为了确保正确翻译，我们应该总是尝试翻译，即使 defaultValue 是中文
    const appNameKey = `app.${appCode}.name`;
    const translated = t(appNameKey, { defaultValue: '' });

    // 如果翻译成功（翻译结果不为空且不等于 key），返回翻译结果
    // 注意：如果翻译结果为空字符串，可能是翻译 key 不存在，应该继续使用其他方法
    if (translated && translated !== appNameKey && translated.trim() !== '') {
      return translated;
    }
  }

  // 如果无法从路径提取应用 code 或翻译失败，尝试使用路径翻译作为后备方案
  if (path) {
    const pathTranslated = translatePathTitle(path, t);
    if (pathTranslated && pathTranslated !== path) {
      // 从路径翻译中提取应用名称（通常是路径的第一段）
      const pathSegments = path.replace(/^\//, '').split('/');
      if (pathSegments.length > 1 && pathSegments[0] === 'apps') {
        // 对于 /apps/{app-code}/... 格式，提取应用名称
        const appPathKey = `path.${pathSegments[1]}`;
        const appPathTranslated = t(appPathKey, { defaultValue: '' });
        if (appPathTranslated && appPathTranslated !== appPathKey && appPathTranslated.trim() !== '') {
          return appPathTranslated;
        }
      }
    }
  }

  // 如果所有翻译方法都失败，返回原始名称
  // 注意：如果原始名称是硬编码的中文，仍然会显示中文
  // 但这种情况应该很少，因为大部分应用都应该有对应的翻译 key
  return name;
}

/**
 * 翻译应用菜单项名称
 *
 * 根据菜单路径来查找翻译 key。
 * 支持路径翻译 key 格式：path.{app-code}.{menu-path}
 *
 * @param name 原始菜单名称（可能是硬编码的中文）
 * @param path 菜单路径
 * @param t 翻译函数
 * @returns 翻译后的文本
 */
export function translateAppMenuItemName(
  name: string | undefined,
  path: string | undefined,
  t: TFunction,
  children?: Array<{ path?: string }> // 添加子菜单参数，用于分组菜单翻译
): string {
  if (!name) {
    return '';
  }

  // 如果 name 已经是翻译 key，直接翻译
  if (name.includes('.') && !name.startsWith('/')) {
    const translated = t(name, { defaultValue: name });
    if (translated !== name) {
      return translated;
    }
  }

  // 对于没有path的分组菜单，尝试从子菜单的path中提取应用code
  let appCode: string | null = null;
  let relativePath: string | null = null;
  
  if (path) {
    // 有path的情况：从路径提取应用 code 和菜单路径
    appCode = extractAppCodeFromPath(path);
    if (appCode) {
      relativePath = path.replace(`/apps/${appCode}/`, '');
    }
  } else if (children && children.length > 0) {
    // 没有path但有子菜单的情况（分组菜单）：从第一个子菜单的path提取应用code
    const firstChildPath = children[0]?.path;
    if (firstChildPath) {
      appCode = extractAppCodeFromPath(firstChildPath);
      if (appCode) {
        // 对于分组菜单，使用菜单名称来构建翻译key
        // 将中文名称转换为对应的key格式（例如："销售管理" -> "sales-management"）
        // 但更可靠的方法是直接从子菜单路径推断分组名称
        const childRelativePath = firstChildPath.replace(`/apps/${appCode}/`, '');
        const pathSegments = childRelativePath.split('/');
        if (pathSegments.length > 0) {
          // 使用子菜单路径的第一段作为分组名称（例如：sales-management/sales-orders -> sales-management）
          relativePath = pathSegments[0];
        }
      }
    }
  }
  
  if (!appCode) {
    // 如果无法提取应用code，返回原始名称
    return name;
  }

  if (relativePath) {
    // 构建菜单项翻译 key：app.{app-code}.menu.{menu-path}
    // 将路径中的 / 替换为 .，例如：plan-management/demand-management → plan-management.demand-management
    const menuPathKey = relativePath.replace(/\//g, '.');
    const menuItemKey = `app.${appCode}.menu.${menuPathKey}`;

    const translated = t(menuItemKey, { defaultValue: name });

    // 如果翻译成功，返回翻译结果
    if (translated !== menuItemKey) {
      return translated;
    }

    // 如果完整路径翻译失败，尝试只翻译路径的第一段（用于分组菜单）
    const pathSegments = relativePath.split('/');
    if (pathSegments.length > 1) {
      const firstSegment = pathSegments[0];
      const firstSegmentKey = `app.${appCode}.menu.${firstSegment}`;
      const firstSegmentTranslated = t(firstSegmentKey, { defaultValue: name });
      if (firstSegmentTranslated !== firstSegmentKey) {
        return firstSegmentTranslated;
      }
      
      // 尝试最后一段（用于子菜单）
      const lastSegment = pathSegments[pathSegments.length - 1];
      const lastSegmentKey = `app.${appCode}.menu.${lastSegment}`;
      const lastSegmentTranslated = t(lastSegmentKey, { defaultValue: name });
      if (lastSegmentTranslated !== lastSegmentKey) {
        return lastSegmentTranslated;
      }
    } else if (pathSegments.length === 1) {
      // 只有一段路径（可能是分组菜单）
      const segmentKey = `app.${appCode}.menu.${pathSegments[0]}`;
      const segmentTranslated = t(segmentKey, { defaultValue: name });
      if (segmentTranslated !== segmentKey) {
        return segmentTranslated;
      }
    }

    // 尝试使用通用路径翻译（已存在的 path.* 格式）
    const pathKey = `path.${relativePath.replace(/\//g, '-')}`;
    const pathTranslated = t(pathKey, { defaultValue: name });
    if (pathTranslated !== pathKey) {
      return pathTranslated;
    }
  }

  // 如果无法找到翻译，直接返回原始名称（不使用 translatePathTitle 的硬编码映射）
  // 这样可以确保数据库中的菜单名称（如"仓库管理"）不会被硬编码映射（如"仓库"）覆盖
  return name;
}

/**
 * 根据路径片段获取翻译后的标题
 *
 * 优先使用应用菜单翻译 key（app.{app-code}.menu.{menu-path}），
 * 如果不存在则尝试路径翻译 key（path.segment），
 * 最后尝试路径片段翻译。
 *
 * @param path 完整路径
 * @param t 翻译函数
 * @returns 翻译后的标题
 */
export function translatePathTitle(path: string, t: TFunction): string {
  if (!path) {
    return '';
  }

  // 优先尝试应用菜单翻译（针对 /apps/{app-code}/... 格式的路径）
  const appCode = extractAppCodeFromPath(path);
  if (appCode) {
    // 提取菜单相对路径（去掉 /apps/{app-code}/ 前缀）
    const relativePath = path.replace(`/apps/${appCode}/`, '');

    // 构建应用菜单项翻译 key：app.{app-code}.menu.{menu-path}
    const menuPathKey = relativePath.replace(/\//g, '.');
    const appMenuItemKey = `app.${appCode}.menu.${menuPathKey}`;
    const appMenuItemTranslated = t(appMenuItemKey, { defaultValue: '' });

    if (appMenuItemTranslated && appMenuItemTranslated !== appMenuItemKey) {
      return appMenuItemTranslated;
    }

    // 如果完整路径翻译失败，尝试只翻译路径的最后一段
    if (relativePath) {
      const pathSegments = relativePath.split('/');
      if (pathSegments.length > 1) {
        const lastSegment = pathSegments[pathSegments.length - 1];
        const lastSegmentKey = `app.${appCode}.menu.${lastSegment}`;
        const lastSegmentTranslated = t(lastSegmentKey, { defaultValue: '' });
        if (lastSegmentTranslated && lastSegmentTranslated !== lastSegmentKey) {
          return lastSegmentTranslated;
        }
      }
    }
  }

  // 尝试使用通用路径翻译 key（path.segment），用于系统菜单和后备方案
  const pathKey = `path.${path.replace(/^\//, '').replace(/\//g, '.')}`;
  const translated = t(pathKey, { defaultValue: '' });
  if (translated && translated !== pathKey) {
    return translated;
  }

  // 尝试使用路径的最后一段作为翻译 key
  const segment = path.split('/').filter(Boolean).pop() || '';
  if (segment) {
    const segmentKey = `path.${segment}`;
    const segmentTranslated = t(segmentKey, { defaultValue: '' });
    if (segmentTranslated && segmentTranslated !== segmentKey) {
      return segmentTranslated;
    }
  }

  // 如果都找不到，尝试使用中文映射（硬编码的后备方案）
  const chinesePathMap: Record<string, string> = {
    'plants': '厂区管理',
    'workshops': '车间管理',
    'production-lines': '产线管理',
    'workstations': '工位管理',
    'warehouses': '仓库管理',
    'storage-areas': '库区管理',
    'storage-locations': '库位管理',
    'materials': '物料管理',
    'code-mapping': '编码映射',
    'variant-attributes': '变体属性',
    'batches': '批号管理',
    'serials': '序列号管理',
    'defect-types': '不良品类型',
    'operations': '工序',
    'routes': '工艺路线',
    'engineering-bom': '工程BOM',
    'sop': '制造BOM',
    'customers': '客户',
    'suppliers': '供应商',
    'holidays': '假期设置',
    'skills': '技能管理',
  };

  if (segment && chinesePathMap[segment]) {
    return chinesePathMap[segment];
  }

  // 如果都找不到，返回路径的最后一段（首字母大写）
  return segment ? segment.charAt(0).toUpperCase() + segment.slice(1) : path;
}

/**
 * 从菜单配置中查找页面标题（带翻译）
 *
 * @param path 路径
 * @param menuConfig 菜单配置
 * @param t 翻译函数
 * @returns 翻译后的标题
 */
export function findMenuTitleWithTranslation(
  path: string,
  menuConfig: any[],
  t: TFunction
): string {
  const findInMenu = (items: any[] | undefined): string | null => {
    if (!items || !Array.isArray(items) || items.length === 0) {
      return null;
    }

    for (const item of items) {
      // 精确匹配路径
      // 兼容 name 和 title 字段（manifest.json 使用 title，数据库使用 name）
      const menuName = item.name || item.title;
      const itemPath = item.path;

      // 路径匹配：支持精确匹配和忽略尾部斜杠
      const pathMatch = itemPath === path ||
                       itemPath === `${path}/` ||
                       `${itemPath}/` === path ||
                       (itemPath && path && itemPath.replace(/\/$/, '') === path.replace(/\/$/, ''));

      if (pathMatch && menuName) {
        // 检查是否是应用菜单（通过路径判断）
        const isAppMenu = itemPath?.startsWith('/apps/');
        if (isAppMenu) {
          return translateAppMenuItemName(menuName, itemPath, t);
        } else {
          return translateMenuName(menuName, t);
        }
      }
      // 子菜单递归查找
      if (item.children) {
        const found = findInMenu(item.children);
        if (found) return found;
      }
    }
    return null;
  };

  // 防御性检查
  if (!menuConfig || !Array.isArray(menuConfig) || menuConfig.length === 0) {
    // 如果菜单配置为空，尝试使用路径翻译
    return translatePathTitle(path, t) || t('common.unnamedPage');
  }

  const menuTitle = findInMenu(menuConfig);
  if (menuTitle) {
    return menuTitle;
  }

  // 如果没有找到菜单项，尝试使用路径翻译
  return translatePathTitle(path, t) || t('common.unnamedPage');
}
