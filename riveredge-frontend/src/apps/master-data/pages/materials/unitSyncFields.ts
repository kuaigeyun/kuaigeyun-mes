import type { SyncTargetField } from '../../../../components/sync-from-source-modal/types';



export const UNIT_SYNC_TARGET_FIELDS: SyncTargetField[] = [

  { value: 'code', labelKey: 'app.master-data.units.syncField.code', required: true },

  { value: 'name', labelKey: 'app.master-data.units.syncField.name', required: true },

];



export const UNIT_SYNC_REQUIRED_TARGETS = ['code', 'name'];

