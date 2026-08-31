import type { SyncTargetField } from '../../../../../components/sync-from-source-modal/types';

export const WAREHOUSE_SYNC_TARGET_FIELDS: SyncTargetField[] = [
  { value: 'code', labelKey: 'app.master-data.warehouses.syncField.code', required: true },
  { value: 'name', labelKey: 'app.master-data.warehouses.syncField.name', required: true },
  { value: 'forbid_status', labelKey: 'app.master-data.warehouses.syncField.forbidStatus' },
];

export const WAREHOUSE_SYNC_AVAILABLE_TARGET_FIELDS: SyncTargetField[] = [
  { value: 'description', labelKey: 'app.master-data.warehouses.syncField.description' },
  { value: 'warehouse_type', labelKey: 'app.master-data.warehouses.syncField.warehouseType' },
  { value: 'is_active', labelKey: 'app.master-data.warehouses.syncField.isActive' },
];

export const WAREHOUSE_SYNC_REQUIRED_TARGETS = ['code', 'name'];
export const WAREHOUSE_SYNC_CUSTOM_FIELD_TABLE = 'master_data_warehouse_warehouses';
