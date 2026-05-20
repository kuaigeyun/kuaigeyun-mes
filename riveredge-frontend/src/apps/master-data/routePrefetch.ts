/**
 * 主数据：按菜单路径预取页面 chunk（与 index.tsx 中 lazy 同源），hover 菜单时触发。
 */

const pageModules = import.meta.glob('./pages/**/*.tsx') as Record<string, () => Promise<unknown>>;

/** 与 Route path 不一致的页面模块（其余默认 ./pages/{route}/index.tsx） */
const ROUTE_MODULE_OVERRIDES: Record<string, string> = {
  materials: './pages/materials/management.tsx',
  'process/engineering-bom': './pages/materials/bom/index.tsx',
  'process/engineering-bom/designer': './pages/materials/bom/designer.tsx',
  'process/sop/designer': './pages/process/sop/designer.tsx',
  'process/sop/execution': './pages/process/sop/execution.tsx',
};

function runLoader(key: string | undefined): void {
  if (!key) return;
  const load = pageModules[key];
  if (load) void load().catch(() => {});
}

/**
 * @param fullPath 菜单 path，如 /apps/master-data/factory/workshops
 */
export function prefetchMasterDataRoute(fullPath: string | undefined): void {
  if (!fullPath?.startsWith('/apps/master-data')) return;

  const raw = fullPath.split('?')[0].replace(/\/$/, '');
  const base = '/apps/master-data';
  const rel = raw === base ? '' : raw.startsWith(`${base}/`) ? raw.slice(base.length + 1) : '';

  if (!rel) return;

  const override = ROUTE_MODULE_OVERRIDES[rel];
  if (override) {
    runLoader(override);
    return;
  }

  const asIndex = `./pages/${rel}/index.tsx`;
  if (pageModules[asIndex]) {
    runLoader(asIndex);
    return;
  }

  const asFile = `./pages/${rel}.tsx`;
  if (pageModules[asFile]) {
    runLoader(asFile);
    return;
  }
}
