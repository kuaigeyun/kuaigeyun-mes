/**
 * 系统级/平台级/个人中心路由的 chunk 预取
 *
 * 与 SystemRoutes.tsx 中的 `React.lazy(() => import('...'))` 声明一一对应，
 * 目的：左侧菜单 hover 时提前下载目标页面 chunk，点击即渲染，无"点击后等白屏"。
 *
 * 维护约定：
 * - 新增/迁移系统级路由时，在 SystemRoutes 改 lazy 的同时，在本文件的
 *   ROUTE_MODULE_OVERRIDES（如适用）保持一致；默认规则能覆盖的不必登记。
 */

// 以 src/routes/ 为基准，枚举所有系统/平台/个人中心页面模块。
// 与 SystemRoutes.tsx 的 lazy() 路径（'../pages/...'）保持同一基准，保证命中率。
const pageModules = import.meta.glob([
  '../pages/system/**/*.tsx',
  '../pages/infra/**/*.tsx',
  '../pages/personal/**/*.tsx',
  // 系统级路由复用应用内页面（如 /system/initial-data）
  '../apps/kuaizhizao/pages/warehouse-management/initial-data/index.tsx',
]) as Record<string, () => Promise<unknown>>

/**
 * 与 SystemRoutes.tsx 中 lazy() 路径一致的显式映射：
 * - 路由 URL 路径（menu path，不含参数段） → 相对于本文件的模块路径
 * 仅在默认规则（index / list）无法命中时需要登记。
 */
const ROUTE_MODULE_OVERRIDES: Record<string, string> = {
  // dashboard：工作台/分析页入口分别在 dashboard 根与 dashboard/analysis
  '/system/dashboard/workplace': '../pages/system/dashboard/index.tsx',
  '/system/dashboard/analysis': '../pages/system/dashboard/analysis/index.tsx',

  // 命名别名：系统角色页对应 roles-permissions
  '/system/roles': '../pages/system/roles-permissions/index.tsx',

  // API 服务路由两种别名指向同一模块
  '/system/api-services': '../pages/system/apis/list/index.tsx',
  '/system/apis': '../pages/system/apis/list/index.tsx',

  // 期初数据导入：系统入口，组件仍在快智造包内
  '/system/initial-data': '../apps/kuaizhizao/pages/warehouse-management/initial-data/index.tsx',

  // 消息模板/配置两种 URL 别名
  '/system/message-templates': '../pages/system/messages/template/index.tsx',
  '/system/messages/template': '../pages/system/messages/template/index.tsx',
  '/system/message-configs': '../pages/system/messages/config/index.tsx',
  '/system/messages/config': '../pages/system/messages/config/index.tsx',

  // 用户个人档案的旧入口
  '/system/user-profile': '../pages/personal/profile/index.tsx',

  // 审批流程实例
  '/system/approval-instances': '../pages/system/approval-processes/instances/index.tsx',

  // platform 旧路径别名
  '/platform/operation': '../pages/infra/operation/index.tsx',
}

function runLoader(key: string | undefined): void {
  if (!key) return
  const load = pageModules[key]
  if (load) void load().catch(() => {})
}

/**
 * 解析（不触发加载）菜单 path 对应的模块 key。
 * 命中顺序：
 *   1. 显式覆盖表
 *   2. `<path>/index.tsx`（目录直接是页面）
 *   3. `<path>/list/index.tsx`（列表页惯用目录）
 */
function resolveModuleKey(fullPath: string): string | undefined {
  const clean = fullPath.split('?')[0].split('#')[0].replace(/\/$/, '')
  if (!clean) return undefined

  const override = ROUTE_MODULE_OVERRIDES[clean]
  if (override && pageModules[override]) return override

  // 将 /system/foo/bar 映射为 ../pages/system/foo/bar
  const rel = clean.replace(/^\//, '')
  const asIndex = `../pages/${rel}/index.tsx`
  if (pageModules[asIndex]) return asIndex

  const asList = `../pages/${rel}/list/index.tsx`
  if (pageModules[asList]) return asList

  return undefined
}

/**
 * 对单条菜单 path 触发 chunk 预取（hover 时调用）。
 * 仅处理系统级/平台级/个人中心路径；`/apps/*` 由 prefetchPlugin + prefetchKuaizhizaoRoute 负责。
 */
export function prefetchSystemRoute(fullPath: string | undefined): void {
  if (!fullPath) return
  if (!/^\/(system|infra|platform|personal)(\/|$)/.test(fullPath)) return
  runLoader(resolveModuleKey(fullPath))
}

/**
 * 批量预取一组子菜单的 chunk（用于父分组 hover 时，一次把下方叶子准备好）。
 */
export function prefetchSystemRoutes(paths: Array<string | undefined>): void {
  const visited = new Set<string>()
  for (const p of paths) {
    if (!p || visited.has(p)) continue
    visited.add(p)
    prefetchSystemRoute(p)
  }
}
