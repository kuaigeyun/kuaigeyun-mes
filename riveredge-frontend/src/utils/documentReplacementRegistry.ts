/**
 * 行业 document 替代注册表（宿主 path → 行业页组件）。
 * 真源：启用行业模块后后端写入的 document-replacements；本表只登记可解析组件。
 */

import type { ComponentType, LazyExoticComponent } from 'react';
import { lazy } from 'react';

export type DocumentReplacementDecl = {
  extension_id: string;
  module_app_code: string;
  host_app: string;
  menu_path: string;
  resource?: string;
  replacement_app: string;
  replacement_path: string;
};

const IND_ELECTRONICS_LABEL_OEM = import.meta.glob(
  '../apps/ind-electronics/pages/label-oem/index.tsx',
);
const KUAIPLM_PROJECT_PROPOSALS = import.meta.glob(
  '../apps/kuaiplm/pages/project-proposals/ProjectProposalsGenericPage.tsx',
);

async function loadComposedPage(
  globs: Record<string, () => Promise<unknown>>,
): Promise<{ default: ComponentType }> {
  const loader = Object.values(globs)[0];
  if (loader) {
    return (await loader()) as { default: ComponentType };
  }
  const mod = await import('../components/documentReplacementUnavailable');
  return { default: mod.default };
}

/** replacement_path → 懒加载组件（pro/行业/定制须 compose，避免 OSS 构建静态解析缺失目录） */
const REPLACEMENT_LOADERS: Record<string, () => Promise<{ default: ComponentType }>> = {
  '/apps/ind-electronics/label-oem': () => loadComposedPage(IND_ELECTRONICS_LABEL_OEM),
  '/apps/funide-oa/project-proposals': () => loadComposedPage(KUAIPLM_PROJECT_PROPOSALS),
  '/apps/funide-oa/production-execution/label-station': () =>
    loadComposedPage(IND_ELECTRONICS_LABEL_OEM),
};

const lazyCache = new Map<string, LazyExoticComponent<ComponentType>>();

export function getDocumentReplacementComponent(
  replacementPath: string,
): LazyExoticComponent<ComponentType> | null {
  const key = (replacementPath || '').replace(/\/$/, '') || replacementPath;
  const loader = REPLACEMENT_LOADERS[key];
  if (!loader) return null;
  let cached = lazyCache.get(key);
  if (!cached) {
    cached = lazy(loader);
    lazyCache.set(key, cached);
  }
  return cached;
}

export function matchDocumentReplacement(
  hostPathname: string,
  items: DocumentReplacementDecl[],
): DocumentReplacementDecl | null {
  const path = (hostPathname || '').split('?')[0].replace(/\/$/, '') || '/';
  for (const item of items) {
    const menuPath = (item.menu_path || '').replace(/\/$/, '');
    if (!menuPath) continue;
    if (path === menuPath || path.startsWith(`${menuPath}/`)) {
      return item;
    }
  }
  return null;
}
