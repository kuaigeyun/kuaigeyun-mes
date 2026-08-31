import type { SyncTargetField } from '../../../../components/sync-from-source-modal/types';

/** 默认展示的常用映射行（必填 + 金蝶物料主档常见列） */
export const MATERIAL_SYNC_TARGET_FIELDS: SyncTargetField[] = [
  { value: 'main_code', labelKey: 'app.master-data.materials.syncField.mainCode', required: true },
  { value: 'name', labelKey: 'app.master-data.materials.syncField.name', required: true },
  { value: 'specification', labelKey: 'app.master-data.materials.syncField.specification' },
  { value: 'base_unit', labelKey: 'app.master-data.materials.syncField.baseUnit', required: true },
  { value: 'base_unit_name', labelKey: 'app.master-data.materials.syncField.baseUnitName' },
  { value: 'group_code', labelKey: 'app.master-data.materials.syncField.groupCode' },
  { value: 'group_name', labelKey: 'app.master-data.materials.syncField.groupName' },
];

/**
 * 可通过「添加更多字段」映射的系统字段（不含默认行已列出的）。
 * 与后端 MaterialSyncService 可写标量列对齐。
 */
export const MATERIAL_SYNC_AVAILABLE_TARGET_FIELDS: SyncTargetField[] = [
  { value: 'description', labelKey: 'app.master-data.materials.syncField.description' },
  { value: 'brand', labelKey: 'app.master-data.materials.syncField.brand' },
  { value: 'model', labelKey: 'app.master-data.materials.syncField.model' },
  { value: 'texture', labelKey: 'app.master-data.materials.syncField.texture' },
  { value: 'barcode', labelKey: 'app.master-data.materials.syncField.barcode' },
  { value: 'source_type', labelKey: 'app.master-data.materials.syncField.sourceType' },
  { value: 'is_active', labelKey: 'app.master-data.materials.syncField.isActive' },
  { value: 'batch_managed', labelKey: 'app.master-data.materials.syncField.batchManaged' },
  { value: 'serial_managed', labelKey: 'app.master-data.materials.syncField.serialManaged' },
  { value: 'variant_managed', labelKey: 'app.master-data.materials.syncField.variantManaged' },
  { value: 'weight', labelKey: 'app.master-data.materials.syncField.weight' },
  { value: 'volume', labelKey: 'app.master-data.materials.syncField.volume' },
  { value: 'shelf_life_managed', labelKey: 'app.master-data.materials.syncField.shelfLifeManaged' },
  { value: 'shelf_life_days', labelKey: 'app.master-data.materials.syncField.shelfLifeDays' },
  { value: 'is_giftable', labelKey: 'app.master-data.materials.syncField.isGiftable' },
  { value: 'reference_cost', labelKey: 'app.master-data.materials.syncField.referenceCost' },
  { value: 'country_of_origin', labelKey: 'app.master-data.materials.syncField.countryOfOrigin' },
  { value: 'customs_code', labelKey: 'app.master-data.materials.syncField.customsCode' },
  { value: 'over_report_mode', labelKey: 'app.master-data.materials.syncField.overReportMode' },
  { value: 'over_report_value', labelKey: 'app.master-data.materials.syncField.overReportValue' },
  { value: 'inspection_mode', labelKey: 'app.master-data.materials.syncField.inspectionMode' },
];

export const MATERIAL_SYNC_REQUIRED_TARGETS = ['main_code', 'name', 'base_unit'];

export const MATERIAL_SYNC_CUSTOM_FIELD_TABLE = 'master_data_materials';
