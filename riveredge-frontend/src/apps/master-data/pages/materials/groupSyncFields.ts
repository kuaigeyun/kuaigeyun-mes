import type { SyncTargetField } from '../../../../components/sync-from-source-modal/types';

export const MATERIAL_GROUP_SYNC_TARGET_FIELDS: SyncTargetField[] = [
  { value: 'code', labelKey: 'app.master-data.materials.groupSyncField.code', required: true },
  { value: 'name', labelKey: 'app.master-data.materials.groupSyncField.name', required: true },
  { value: 'parent_code', labelKey: 'app.master-data.materials.groupSyncField.parentCode' },
];

export const MATERIAL_GROUP_SYNC_AVAILABLE_TARGET_FIELDS: SyncTargetField[] = [
  { value: 'alias', labelKey: 'app.master-data.materials.groupSyncField.alias' },
  { value: 'description', labelKey: 'app.master-data.materials.groupSyncField.description' },
  { value: 'is_active', labelKey: 'app.master-data.materials.groupSyncField.isActive' },
];

export const MATERIAL_GROUP_SYNC_REQUIRED_TARGETS = ['code', 'name'];
export const MATERIAL_GROUP_SYNC_CUSTOM_FIELD_TABLE = 'master_data_material_groups';
