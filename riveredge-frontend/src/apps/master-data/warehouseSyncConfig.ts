import type { SyncFromSourceConfig } from '../../../components/sync-from-source-modal/types';
import { getWarehouseSyncBinding, syncWarehousesFromSource } from './services/warehouse';
import {
  WAREHOUSE_SYNC_REQUIRED_TARGETS,
  WAREHOUSE_SYNC_TARGET_FIELDS,
} from './pages/warehouse/warehouses/warehouseSyncFields';

export function createWarehouseSyncConfig(): SyncFromSourceConfig {
  return {
    titleKey: 'app.master-data.warehouses.syncFromSource',
    hintKey: 'app.master-data.warehouses.syncHint',
    apiRealtimeHintKey: 'app.master-data.warehouses.syncApiHint',
    datasetBatchHintKey: 'app.master-data.warehouses.syncDatasetHint',
    targetFields: WAREHOUSE_SYNC_TARGET_FIELDS,
    requiredTargets: WAREHOUSE_SYNC_REQUIRED_TARGETS,
    getBinding: getWarehouseSyncBinding,
    syncFromSource: syncWarehousesFromSource,
    completeSuccessKey: 'app.master-data.warehouses.syncComplete',
    completePartialKey: 'app.master-data.warehouses.syncPartial',
    failedKey: 'app.master-data.warehouses.syncFailed',
  };
}
