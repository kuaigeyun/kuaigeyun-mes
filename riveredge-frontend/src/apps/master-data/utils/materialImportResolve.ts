/**
 * 物料导入：按主编码解析主物料（列表级拆分导入共用）
 */

import type { Material } from '../types/material';
import { materialApi } from '../services/material';
import { isVariantSkuMaterial } from '../components/MaterialVariantCombinationsTable';

export function pickMaterialMainCode(material: Material): string {
  return String(
    material.mainCode ?? (material as { main_code?: string }).main_code ?? material.code ?? '',
  ).trim();
}

export async function resolveMasterByMainCode(
  mainCode: string,
  cache: Map<string, Material>,
): Promise<Material | null> {
  const key = mainCode.trim();
  if (!key) return null;

  const cacheKey = key.toUpperCase();
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const { items } = await materialApi.list({ code: key, mastersOnly: true, limit: 50 });
  const master = (items ?? []).find(
    (m) => !isVariantSkuMaterial(m) && pickMaterialMainCode(m).toUpperCase() === cacheKey,
  );
  if (master) {
    cache.set(cacheKey, master);
  }
  return master ?? null;
}
