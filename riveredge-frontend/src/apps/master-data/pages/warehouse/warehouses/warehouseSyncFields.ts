import type { SyncTargetField } from '../../../../../components/sync-from-source-modal/types';

export const WAREHOUSE_SYNC_TARGET_FIELDS: SyncTargetField[] = [
  { value: 'code', labelKey: 'app.master-data.warehouses.syncField.code', required: true },
  { value: 'name', labelKey: 'app.master-data.warehouses.syncField.name', required: true },
  { value: 'forbid_status', labelKey: 'app.master-data.warehouses.syncField.forbidStatus' },
];

export const WAREHOUSE_SYNC_REQUIRED_TARGETS = ['code', 'name'];
