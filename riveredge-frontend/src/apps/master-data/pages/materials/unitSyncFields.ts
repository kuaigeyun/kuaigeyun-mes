import type { SyncTargetField } from '../../../../components/sync-from-source-modal/types';

export const UNIT_SYNC_TARGET_FIELDS: SyncTargetField[] = [
  { value: 'code', labelKey: 'app.master-data.units.syncField.code', required: true },
  { value: 'name', labelKey: 'app.master-data.units.syncField.name', required: true },
];

export const UNIT_SYNC_AVAILABLE_TARGET_FIELDS: SyncTargetField[] = [
  { value: 'description', labelKey: 'app.master-data.units.syncField.description' },
  { value: 'is_active', labelKey: 'app.master-data.units.syncField.isActive' },
  { value: 'sort_order', labelKey: 'app.master-data.units.syncField.sortOrder' },
];

export const UNIT_SYNC_REQUIRED_TARGETS = ['code', 'name'];
