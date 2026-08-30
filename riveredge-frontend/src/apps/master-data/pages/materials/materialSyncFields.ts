import type { SyncTargetField } from '../../../../components/sync-from-source-modal/types';

export const MATERIAL_SYNC_TARGET_FIELDS: SyncTargetField[] = [
  { value: 'main_code', labelKey: 'app.master-data.materials.syncField.mainCode', required: true },
  { value: 'name', labelKey: 'app.master-data.materials.syncField.name', required: true },
  { value: 'specification', labelKey: 'app.master-data.materials.syncField.specification' },
  { value: 'base_unit', labelKey: 'app.master-data.materials.syncField.baseUnit', required: true },
  { value: 'base_unit_name', labelKey: 'app.master-data.materials.syncField.baseUnitName' },
  { value: 'group_code', labelKey: 'app.master-data.materials.syncField.groupCode' },
  { value: 'group_name', labelKey: 'app.master-data.materials.syncField.groupName' },
];

export const MATERIAL_SYNC_REQUIRED_TARGETS = ['main_code', 'name', 'base_unit'];
