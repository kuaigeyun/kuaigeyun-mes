import type { SyncTargetField } from '../../../../components/sync-from-source-modal/types';



export const MATERIAL_GROUP_SYNC_TARGET_FIELDS: SyncTargetField[] = [

  { value: 'code', labelKey: 'app.master-data.materials.groupSyncField.code', required: true },

  { value: 'name', labelKey: 'app.master-data.materials.groupSyncField.name', required: true },

  { value: 'parent_code', labelKey: 'app.master-data.materials.groupSyncField.parentCode' },

];



export const MATERIAL_GROUP_SYNC_REQUIRED_TARGETS = ['code', 'name'];

