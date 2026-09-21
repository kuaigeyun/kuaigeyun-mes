import type { SyncFromSourceConfig } from '../../components/sync-from-source-modal/types';
import { getInventorySyncBinding, syncInventoryFromSource } from './services/inventory';

export const INVENTORY_SYNC_TARGET_FIELDS: import('../../components/sync-from-source-modal/types').SyncTargetField[] = [
  { value: 'material_code', labelKey: 'app.kuaizhizao.warehouseInventory.syncField.materialCode', required: true },
  { value: 'material_name', labelKey: 'app.kuaizhizao.warehouseInventory.syncField.materialName' },
  { value: 'batch_no', labelKey: 'app.kuaizhizao.warehouseInventory.syncField.batchNo' },
  { value: 'warehouse_id', labelKey: 'app.kuaizhizao.warehouseInventory.syncField.warehouseId' },
  { value: 'warehouse_name', labelKey: 'app.kuaizhizao.warehouseInventory.syncField.warehouseName' },
  { value: 'quantity', labelKey: 'app.kuaizhizao.warehouseInventory.syncField.quantity', required: true },
];

export const INVENTORY_SYNC_REQUIRED_TARGETS = ['material_code', 'quantity'];

export function createInventorySyncConfig(): SyncFromSourceConfig {
  return {
    titleKey: 'app.kuaizhizao.warehouseInventory.syncFromSource',
    hintKey: 'app.kuaizhizao.warehouseInventory.syncHint',
    apiRealtimeHintKey: 'app.kuaizhizao.warehouseInventory.syncApiHint',
    datasetBatchHintKey: 'app.kuaizhizao.warehouseInventory.syncDatasetHint',
    mainStepTitleKey: 'app.kuaizhizao.warehouseInventory.syncStep.inventory',
    targetFields: INVENTORY_SYNC_TARGET_FIELDS,
    requiredTargets: INVENTORY_SYNC_REQUIRED_TARGETS,
    getBinding: getInventorySyncBinding,
    syncFromSource: syncInventoryFromSource,
    completeSuccessKey: 'app.kuaizhizao.warehouseInventory.syncComplete',
    completePartialKey: 'app.kuaizhizao.warehouseInventory.syncPartial',
    failedKey: 'app.kuaizhizao.warehouseInventory.syncFailed',
  };
}