import type { SyncTargetField } from '../../../../../components/sync-from-source-modal/types';

export const SUPPLIER_SYNC_TARGET_FIELDS: SyncTargetField[] = [
  { value: 'code', labelKey: 'app.master-data.suppliers.syncField.code', required: true },
  { value: 'name', labelKey: 'app.master-data.suppliers.syncField.name', required: true },
  { value: 'short_name', labelKey: 'app.master-data.suppliers.syncField.shortName' },
];

export const SUPPLIER_SYNC_REQUIRED_TARGETS = ['code', 'name'];
