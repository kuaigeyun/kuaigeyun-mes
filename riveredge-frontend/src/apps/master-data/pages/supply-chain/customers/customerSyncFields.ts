import type { SyncTargetField } from '../../../../../components/sync-from-source-modal/types';

export const CUSTOMER_SYNC_TARGET_FIELDS: SyncTargetField[] = [
  { value: 'code', labelKey: 'app.master-data.customers.syncField.code', required: true },
  { value: 'name', labelKey: 'app.master-data.customers.syncField.name', required: true },
  { value: 'short_name', labelKey: 'app.master-data.customers.syncField.shortName' },
  { value: 'contact_person', labelKey: 'app.master-data.customers.syncField.contactPerson' },
  { value: 'phone', labelKey: 'app.master-data.customers.syncField.phone' },
  { value: 'email', labelKey: 'app.master-data.customers.syncField.email' },
  { value: 'address', labelKey: 'app.master-data.customers.syncField.address' },
];

export const CUSTOMER_SYNC_REQUIRED_TARGETS = ['code', 'name'];
