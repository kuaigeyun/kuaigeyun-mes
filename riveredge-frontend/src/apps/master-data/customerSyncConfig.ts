import type { SyncFromSourceConfig } from '../../components/sync-from-source-modal/types';
import { loadSyncCustomTargetFields } from '../../components/sync-from-source-modal/loadSyncCustomTargetFields';
import { getCustomerSyncBinding, syncCustomersFromSource } from './services/supply-chain';
import {
  CUSTOMER_SYNC_AVAILABLE_TARGET_FIELDS,
  CUSTOMER_SYNC_CUSTOM_FIELD_TABLE,
  CUSTOMER_SYNC_REQUIRED_TARGETS,
  CUSTOMER_SYNC_TARGET_FIELDS,
} from './pages/supply-chain/customers/customerSyncFields';

export function createCustomerSyncConfig(): SyncFromSourceConfig {
  return {
    titleKey: 'app.master-data.customers.syncFromSource',
    hintKey: 'app.master-data.customers.syncHint',
    apiRealtimeHintKey: 'app.master-data.customers.syncApiHint',
    datasetBatchHintKey: 'app.master-data.customers.syncDatasetHint',
    targetFields: CUSTOMER_SYNC_TARGET_FIELDS,
    availableTargetFields: CUSTOMER_SYNC_AVAILABLE_TARGET_FIELDS,
    loadAvailableTargetFields: () => loadSyncCustomTargetFields(CUSTOMER_SYNC_CUSTOM_FIELD_TABLE),
    customFieldTableName: CUSTOMER_SYNC_CUSTOM_FIELD_TABLE,
    requiredTargets: CUSTOMER_SYNC_REQUIRED_TARGETS,
    getBinding: getCustomerSyncBinding,
    syncFromSource: syncCustomersFromSource,
    completeSuccessKey: 'app.master-data.customers.syncComplete',
    completePartialKey: 'app.master-data.customers.syncPartial',
    failedKey: 'app.master-data.customers.syncFailed',
  };
}
