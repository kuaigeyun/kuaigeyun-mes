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
 * 插件 APP 静态导入映射（生产环境）
 *
 * 使用静态 import 确保 Vite 将插件打包为独立 chunk（app-xxx-[hash].js），
 * 生产环境通过此映射加载，无需额外构建步骤。
 */
const APP_LOADERS: Record<string, () => Promise<unknown>> = {
  kuaizhizao: () => import('../apps/kuaizhizao/index'),
  kuaicaiwu: () => import('../apps/kuaicaiwu/index'),
  kuaiplm: () => import('../apps/kuaiplm/index'),
  kuaireport: () => import('../apps/kuaireport/index'),
  'master-data': () => import('../apps/master-data/index'),
  kuaiai: () => import('../apps/kuaiai/index'),
  kuaiiot: () => import('../apps/kuaiiot/index'),
  haoligo: () => import('../apps/haoligo/index'),
  kuaierp: () => import('../apps/kuaizhizao/index'),
  kuaimes: () => import('../apps/kuaizhizao/index'),
};

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

/**
 * 开发环境加载插件
 * 
 * @param application - 应用信息
 * @returns 插件路由配置
 */
async function loadPluginInDevelopment(application: Application): Promise<PluginRoute[]> {
  const pluginCode = application.code;
  
  // 优先使用 entry_point，如果不存在则使用 code 生成路径
  let sourcePath: string;
  if (application.entry_point) {
    // 如果 entry_point 是相对路径，直接使用
    if (application.entry_point.startsWith('../') || application.entry_point.startsWith('./')) {
      sourcePath = application.entry_point;
    } else {
      // 如果是绝对路径或其他格式，使用 getPluginBuildPath 转换（开发环境）
      sourcePath = getPluginBuildPath(application.entry_point);
    }
  } else {
    // 如果没有 entry_point，使用 code 生成路径
    sourcePath = getPluginSourcePath(pluginCode);
  }
  
  // console.log(`🔍 [pluginLoader] 加载应用 ${pluginCode}，路径: ${sourcePath}`, {
  //   entry_point: application.entry_point,
  //   route_path: application.route_path,
  //   resolved_path: sourcePath,
  // });
  
  // 使用重试机制加载插件
  const pluginModule = await withRetry(
    async () => {
      // 使用动态导入加载插件模块
      // 注意：Vite 的动态导入需要使用相对路径或绝对路径
      // 使用 /* @vite-ignore */ 可以跳过 Vite 的静态分析
      // console.log(`📥 [pluginLoader] 尝试导入模块: ${sourcePath}`);
      const module = await import(
        /* @vite-ignore */
        sourcePath
      );
      // console.log(`✅ [pluginLoader] 模块导入成功:`, Object.keys(module));
      return module;
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

  // 获取插件路由组件
  let PluginRoutes = pluginModule.default || pluginModule[`${pluginCode.charAt(0).toUpperCase() + pluginCode.slice(1)}Routes`];
  // console.log(`🔍 [pluginLoader] 查找路由组件，default:`, !!pluginModule.default, 'PluginRoutes:', !!PluginRoutes);

  // 如果没有找到路由组件，检查是否是完整的应用组件（包含内部路由）
  if (!PluginRoutes) {
    // 尝试查找应用组件（App后缀）
    PluginRoutes = pluginModule[`${pluginCode.charAt(0).toUpperCase() + pluginCode.slice(1)}App`];
    // console.log(`🔍 [pluginLoader] 尝试查找 App 组件:`, !!PluginRoutes);

    if (!PluginRoutes && pluginModule.default) {
      // 如果default存在且是一个React组件，直接使用它
      const defaultExport = pluginModule.default;
      if (typeof defaultExport === 'function' || (defaultExport && typeof defaultExport === 'object' && '$$typeof' in defaultExport)) {
        PluginRoutes = defaultExport;
        // console.log(`✅ [pluginLoader] 使用 default 导出作为路由组件`);
      }
    }

    if (!PluginRoutes) {
      console.error(`❌ [pluginLoader] ${pluginCode} - 未找到路由组件或应用组件`, {
        default: pluginModule.default,
        defaultType: typeof pluginModule.default,
        routes: pluginModule[`${pluginCode.charAt(0).toUpperCase() + pluginCode.slice(1)}Routes`],
        app: pluginModule[`${pluginCode.charAt(0).toUpperCase() + pluginCode.slice(1)}App`],
        allExports: Object.keys(pluginModule),
      });
      throw new Error(`插件 ${application.code} 未导出路由组件或应用组件。请确保插件入口文件导出了 default、${pluginCode}Routes 或 ${pluginCode}App`);
    }
  }
  
  // console.log(`✅ [pluginLoader] 找到路由组件:`, PluginRoutes);

  // 返回路由配置
  const routePath = application.route_path || `/apps/${application.code}`;

  return [
    {
      path: routePath,
      component: PluginRoutes,
    },
  ];
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

  // 获取插件路由组件
  const PluginRoutes = pluginModule.default || pluginModule[`${pluginCode.charAt(0).toUpperCase() + pluginCode.slice(1)}Routes`];

  if (!PluginRoutes) {
    throw new Error(`插件 ${application.code} 加载成功但未找到组件。请确保插件入口文件导出了 default 或 ${pluginCode}Routes`);
  }

  // 返回路由配置
  return [
    {
      path: application.route_path || `/apps/${application.code}`,
      component: PluginRoutes as React.ComponentType<Record<string, unknown>>,
    },
  ];
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

  // 检查缓存
  if (!forceReload && pluginRegistry.has(pluginCode)) {
    const cached = pluginRegistry.get(pluginCode)!;
    if (cached.status === PluginLoadStatus.LOADED && cached.routes) {
      return cached.routes;
    }
    // 如果之前加载失败，且不是强制重载，则抛出错误
    if (cached.status === PluginLoadStatus.ERROR) {
      throw cached.error || new Error(`插件 ${pluginCode} 之前加载失败`);
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

    // 改进错误信息
    if (errorObj.message.includes('Failed to fetch') || errorObj.message.includes('404')) {
      throw new Error(
        `插件 ${pluginCode} 的前端文件不存在。` +
          `开发环境请确保插件源码在 src/apps/${pluginCode}/index.tsx，` +
          `生产环境请确保插件已加入 src/utils/pluginLoader.ts 的 APP_LOADERS 并重新构建`
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
