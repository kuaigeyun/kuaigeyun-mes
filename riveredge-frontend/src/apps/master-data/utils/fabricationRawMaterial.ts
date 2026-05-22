import { bomApi } from '../services/material';
import type { Material } from '../types/material';

export interface FabricationMaterialRef {
  id: number;
  uuid?: string;
  code?: string;
  mainCode?: string;
  name: string;
  baseUnit?: string;
  groupId?: number;
}

export function getMaterialCode(material: Pick<Material, 'code'> & Record<string, unknown>): string {
  return (
    (material as any).mainCode ??
    (material as any).main_code ??
    material.code ??
    ''
  );
}

export function getMaterialBaseUnit(material: Record<string, unknown>): string {
  return String((material as any).baseUnit ?? (material as any).base_unit ?? '件');
}

/** 自制件 + 工艺型制造模式 */
export function isFabricationMaterial(material?: Material | null): boolean {
  if (!material) return false;
  const sourceType = material.sourceType ?? (material as any).source_type;
  if (sourceType !== 'Make') return false;
  const sourceConfig = material.sourceConfig ?? (material as any).source_config ?? {};
  return sourceConfig.manufacturing_mode === 'fabrication';
}

export function isFabricationFromValues(values: Record<string, unknown>): boolean {
  const sourceType = values.source_type ?? values.sourceType;
  if (sourceType !== 'Make') return false;
  const sourceConfig = (values.source_config ?? values.sourceConfig ?? {}) as Record<string, unknown>;
  return sourceConfig.manufacturing_mode === 'fabrication';
}

/** 工艺型物料是否尚无 BOM 行（任意版本） */
export async function fabricationMaterialNeedsRawMaterialSetup(materialId: number): Promise<boolean> {
  const boms = await bomApi.getByMaterial(materialId, undefined, false, true);
  return !boms?.length;
}

export function suggestRawMaterialName(fabricationName: string): string {
  const trimmed = fabricationName.trim();
  if (!trimmed) return '加工原料';
  if (trimmed.endsWith('原料') || trimmed.endsWith('毛坯')) return trimmed;
  return `${trimmed}原料`;
}

export function toFabricationMaterialRef(material: Material): FabricationMaterialRef {
  return {
    id: material.id!,
    uuid: material.uuid,
    code: getMaterialCode(material as any),
    mainCode: getMaterialCode(material as any),
    name: material.name,
    baseUnit: getMaterialBaseUnit(material as any),
    groupId: material.groupId ?? (material as any).group_id,
  };
}
