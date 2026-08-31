import type { SyncFromSourceConfig } from '../../components/sync-from-source-modal/types';
import { loadSyncCustomTargetFields } from '../../components/sync-from-source-modal/loadSyncCustomTargetFields';
import { getSupplierSyncBinding, syncSuppliersFromSource } from './services/supply-chain';
import {
  SUPPLIER_SYNC_AVAILABLE_TARGET_FIELDS,
  SUPPLIER_SYNC_CUSTOM_FIELD_TABLE,
  SUPPLIER_SYNC_REQUIRED_TARGETS,
  SUPPLIER_SYNC_TARGET_FIELDS,
} from './pages/supply-chain/suppliers/supplierSyncFields';

export function createSupplierSyncConfig(): SyncFromSourceConfig {
  return {
    titleKey: 'app.master-data.suppliers.syncFromSource',
    hintKey: 'app.master-data.suppliers.syncHint',
    apiRealtimeHintKey: 'app.master-data.suppliers.syncApiHint',
    datasetBatchHintKey: 'app.master-data.suppliers.syncDatasetHint',
    targetFields: SUPPLIER_SYNC_TARGET_FIELDS,
    availableTargetFields: SUPPLIER_SYNC_AVAILABLE_TARGET_FIELDS,
    loadAvailableTargetFields: () => loadSyncCustomTargetFields(SUPPLIER_SYNC_CUSTOM_FIELD_TABLE),
    customFieldTableName: SUPPLIER_SYNC_CUSTOM_FIELD_TABLE,
    requiredTargets: SUPPLIER_SYNC_REQUIRED_TARGETS,
    getBinding: getSupplierSyncBinding,
    syncFromSource: syncSuppliersFromSource,
    completeSuccessKey: 'app.master-data.suppliers.syncComplete',
    completePartialKey: 'app.master-data.suppliers.syncPartial',
    failedKey: 'app.master-data.suppliers.syncFailed',
  };
}
