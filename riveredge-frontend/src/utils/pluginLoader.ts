/**
 * 插件加载器工具
 * 
 * 提供插件动态加载和管理功能
 * 
 * 改进点：
 * 1. 统一使用 ES Modules，开发和生产环境都使用动态导入
 * 2. 改进路径解析，使用更可靠的方法
 * 3. 添加插件注册表和状态管理
 * 4. 添加错误处理和重试机制
 * 5. 支持插件生命周期管理
 */

import React from 'react';
import { Application } from '../services/application';
import { withRetry } from './errorRecovery';

/**
 * 插件元数据
 */
export interface PluginMetadata {
  name: string;
  code: string;
  version: string;
  routePath: string;
  entryPoint: string;
}

/**
 * 插件路由配置
 */
export interface PluginRoute {
  path: string;
  component: React.ComponentType;
}

/**
 * 插件加载状态
 */
export enum PluginLoadStatus {
  PENDING = 'pending',
  LOADING = 'loading',
  LOADED = 'loaded',
  ERROR = 'error',
}

/**
 * 插件注册表项
 */
export interface PluginRegistryItem {
  application: Application;
  status: PluginLoadStatus;
  routes?: PluginRoute[];
  error?: Error;
  loadTime?: number;
}

/**
 * 插件注册表（内存缓存）
 */
const pluginRegistry = new Map<string, PluginRegistryItem>();

/**
 * 获取插件源码路径
 * 
 * @param pluginCode - 插件代码
 * @returns 插件源码路径
 */
function getPluginSourcePath(pluginCode: string): string {
  // 插件前端代码现在放在 src/apps/插件名/ 目录下
  // 从 src/utils/pluginLoader.ts 到 src/apps/插件名/index.tsx
  // 路径：src/utils/ -> ../ -> src/ -> apps/插件名/index.tsx
  return `../apps/${pluginCode}/index.tsx`;
}

/**
 * 开源主仓应用：静态 import，保证 Vite 打出独立 chunk。
 * 专业/定制应用：由 import.meta.glob 在构建时发现（需先 compose 进 src/apps）。
 */
const OPEN_SOURCE_APP_LOADERS: Record<string, () => Promise<unknown>> = {
  kuaizhizao: () => import('../apps/kuaizhizao/index'),
  kuaicaiwu: () => import('../apps/kuaicaiwu/index'),
  kuaiplm: () => import('../apps/kuaiplm/index'),
  'master-data': () => import('../apps/master-data/index'),
};

const GLOB_APP_MODULES = import.meta.glob('../apps/*/index.{ts,tsx}');

function buildAppLoaders(): Record<string, () => Promise<unknown>> {
  const loaders: Record<string, () => Promise<unknown>> = { ...OPEN_SOURCE_APP_LOADERS };
  for (const [path, loader] of Object.entries(GLOB_APP_MODULES)) {
    const match = path.match(/\/apps\/([^/]+)\/index\.(tsx|ts)$/);
    if (!match) continue;
    const code = match[1];
    if (!loaders[code]) {
      loaders[code] = loader as () => Promise<unknown>;
    }
  }
  return loaders;
}

const APP_LOADERS = buildAppLoaders();

/**
 * 预取插件 chunk（菜单 hover 时调用，缩短首次进入应用页时间）
 */
export function prefetchPlugin(appCode: string): void {
  const loader = APP_LOADERS[appCode];
  if (loader) {
    loader().catch(() => {});
  }
}

/**
 * 获取插件构建路径（开发环境用）
 */
function getPluginBuildPath(entryPoint: string): string {
  if (entryPoint.startsWith('http://') || entryPoint.startsWith('https://')) {
    return entryPoint;
  }
  if (entryPoint.startsWith('../') || entryPoint.startsWith('./')) {
    return entryPoint;
  }
  if (entryPoint.startsWith('/apps/')) {
    const pluginCode = entryPoint.replace('/apps/', '').replace('/index.js', '').replace('/index.tsx', '');
    return `../apps/${pluginCode}/index.tsx`;
  }
  return entryPoint;
}

function resolvePluginRoutes(
  application: Application,
  pluginModule: Record<string, unknown>
): PluginRoute[] {
  const pluginCode = application.code;
  const capitalized = `${pluginCode.charAt(0).toUpperCase()}${pluginCode.slice(1)}`;
  let PluginRoutes =
    pluginModule.default ||
    pluginModule[`${capitalized}Routes`] ||
    pluginModule[`${capitalized}App`];

  if (
    !PluginRoutes &&
    pluginModule.default &&
    (typeof pluginModule.default === 'function' ||
      (typeof pluginModule.default === 'object' &&
        pluginModule.default !== null &&
        '$$typeof' in (pluginModule.default as object)))
  ) {
    PluginRoutes = pluginModule.default;
  }

  if (!PluginRoutes) {
    console.error(`❌ [pluginLoader] ${pluginCode} - 未找到路由组件或应用组件`, {
      default: pluginModule.default,
      defaultType: typeof pluginModule.default,
      allExports: Object.keys(pluginModule),
    });
    throw new Error(
      `插件 ${pluginCode} 未导出路由组件或应用组件。请确保插件入口文件导出了 default、${pluginCode}Routes 或 ${pluginCode}App`
    );
  }

  return [
    {
      path: application.route_path || `/apps/${pluginCode}`,
      component: PluginRoutes as React.ComponentType,
    },
  ];
}

/**
 * 开发环境加载插件
 * 
 * @param application - 应用信息
 * @returns 插件路由配置
 */
async function loadPluginInDevelopment(application: Application): Promise<PluginRoute[]> {
  const pluginCode = application.code;

  // 优先走 import.meta.glob 静态映射（含 symlink 的 pro/custom 应用），
  // 避免 /* @vite-ignore */ 相对路径在依赖预构建失败时被误报为「文件不存在」。
  const staticLoader = APP_LOADERS[pluginCode];
  if (staticLoader) {
    const pluginModule = await withRetry(
      async () => (await staticLoader()) as Record<string, unknown>,
      {
        maxRetries: 2,
        retryDelay: 500,
        shouldRetry: (error: any) =>
          error?.message?.includes('Failed to fetch') ||
          error?.message?.includes('504') ||
          error?.message?.includes('NetworkError'),
      }
    );
    return resolvePluginRoutes(application, pluginModule);
  }

  // 未 compose 进 src/apps 时再回落 entry_point 动态导入
  let sourcePath: string;
  if (application.entry_point) {
    if (application.entry_point.startsWith('../') || application.entry_point.startsWith('./')) {
      sourcePath = application.entry_point;
    } else {
      sourcePath = getPluginBuildPath(application.entry_point);
    }
  } else {
    sourcePath = getPluginSourcePath(pluginCode);
  }

  const pluginModule = await withRetry(
    async () => {
      const module = await import(
        /* @vite-ignore */
        sourcePath
      );
      return module as Record<string, unknown>;
    },
    {
      maxRetries: 2,
      retryDelay: 500,
      shouldRetry: (error: any) => {
        return (
          error?.message?.includes('Failed to fetch') ||
          error?.message?.includes('404') ||
          error?.message?.includes('NetworkError')
        );
      },
    }
  );

  return resolvePluginRoutes(application, pluginModule);
}

/**
 * 生产环境加载插件
 * 
 * @param application - 应用信息
 * @returns 插件路由配置
 */
async function loadPluginInProduction(application: Application): Promise<PluginRoute[]> {
  const pluginCode = application.code;

  if (!application.entry_point) {
    throw new Error(`插件 ${pluginCode} 的 entry_point 未配置`);
  }

  // 优先使用静态导入映射（Vite 会打包为 app-xxx chunk）
  const loader = APP_LOADERS[pluginCode];
  const pluginModule = await withRetry(
    async () => {
      if (loader) {
        return (await loader()) as Record<string, unknown>;
      }
      // 兼容外部 URL 或未来扩展
      const entryPath = application.entry_point!;
      if (entryPath.startsWith('http://') || entryPath.startsWith('https://')) {
        const mod = await import(/* @vite-ignore */ entryPath);
        return mod as Record<string, unknown>;
      }
      throw new Error(
        `插件 ${pluginCode} 未在 APP_LOADERS 中注册。生产环境请确保插件在 src/utils/pluginLoader.ts 的 APP_LOADERS 中配置`
      );
    },
    {
      maxRetries: 2,
      retryDelay: 500,
      shouldRetry: (error: any) => {
        // 网络错误或 404 错误可以重试
        return (
          error?.message?.includes('Failed to fetch') ||
          error?.message?.includes('404') ||
          error?.message?.includes('NetworkError')
        );
      },
    }
  );

  return resolvePluginRoutes(application, pluginModule);
}

/**
 * 加载插件
 * 
 * @param application - 应用信息
 * @param forceReload - 是否强制重新加载（忽略缓存）
 * @returns 插件路由配置
 */
export async function loadPlugin(
  application: Application,
  forceReload: boolean = false
): Promise<PluginRoute[]> {
  const pluginCode = application.code;
  const startTime = Date.now();

  // 检查缓存（ERROR 允许重试：依赖预构建恢复后不应永久卡死）
  if (!forceReload && pluginRegistry.has(pluginCode)) {
    const cached = pluginRegistry.get(pluginCode)!;
    if (cached.status === PluginLoadStatus.LOADED && cached.routes) {
      return cached.routes;
    }
  }

  // 更新注册表状态
  pluginRegistry.set(pluginCode, {
    application,
    status: PluginLoadStatus.LOADING,
  });

  try {
    // 检查是否为生产环境
    const isProduction = import.meta.env.PROD;

    let routes: PluginRoute[];
    if (isProduction) {
      // 生产环境：从构建产物加载
      routes = await loadPluginInProduction(application);
    } else {
      // 开发环境：从源码加载
      routes = await loadPluginInDevelopment(application);
    }

    const loadTime = Date.now() - startTime;

    // 更新注册表
    pluginRegistry.set(pluginCode, {
      application,
      status: PluginLoadStatus.LOADED,
      routes,
      loadTime,
    });

    return routes;
  } catch (error) {
    const loadTime = Date.now() - startTime;
    const errorObj = error instanceof Error ? error : new Error(String(error));

    // 更新注册表
    pluginRegistry.set(pluginCode, {
      application,
      status: PluginLoadStatus.ERROR,
      error: errorObj,
      loadTime,
    });

    // 保留原始原因，避免依赖预构建 504 等被误报为「文件不存在」
    if (
      errorObj.message.includes('Failed to fetch') ||
      errorObj.message.includes('404') ||
      errorObj.message.includes('504')
    ) {
      throw new Error(
        `插件 ${pluginCode} 加载失败（${errorObj.message}）。` +
          `请确认 src/apps/${pluginCode}/index.tsx 已 compose（专业包 symlink），` +
          `并在安装新依赖后重启 Vite（必要时删除 node_modules/.vite）。`
      );
    }

    throw errorObj;
  }
}

/**
 * 卸载插件
 * 
 * @param pluginCode - 插件代码
 */
export function unloadPlugin(pluginCode: string): void {
  pluginRegistry.delete(pluginCode);
}

/**
 * 获取插件加载状态
 * 
 * @param pluginCode - 插件代码
 * @returns 插件加载状态
 */
export function getPluginStatus(pluginCode: string): PluginLoadStatus | null {
  const item = pluginRegistry.get(pluginCode);
  return item?.status || null;
}

/**
 * 获取所有已加载的插件
 * 
 * @returns 已加载的插件列表
 */
export function getLoadedPlugins(): PluginRegistryItem[] {
  return Array.from(pluginRegistry.values()).filter(
    (item) => item.status === PluginLoadStatus.LOADED
  );
}

/**
 * 清除插件注册表
 */
export function clearPluginRegistry(): void {
  pluginRegistry.clear();
}

/**
 * 获取插件元数据
 * 
 * @param application - 应用信息
 * @returns 插件元数据
 */
export function getPluginMetadata(application: Application): PluginMetadata {
  return {
    name: application.name,
    code: application.code,
    version: application.version || '1.0.0',
    routePath: application.route_path || `/apps/${application.code}`,
    entryPoint: application.entry_point || '',
  };
}
