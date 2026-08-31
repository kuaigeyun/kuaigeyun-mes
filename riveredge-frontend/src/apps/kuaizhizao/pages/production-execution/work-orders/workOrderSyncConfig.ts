import type { SyncFromSourceConfig } from '../../../../../components/sync-from-source-modal/types';
import { loadSyncCustomTargetFields } from '../../../../../components/sync-from-source-modal/loadSyncCustomTargetFields';
import {
  getMaterialGroupSyncBinding,
  getMaterialSyncBinding,
  syncMaterialGroupsFromSource,
  syncMaterialsFromSource,
} from '../../../../master-data/services/material';
import {
  getMaterialUnitSyncBinding,
  syncMaterialUnitsFromSource,
} from '../../../../master-data/services/material-unit';
import {
  getSalesOrderSyncBinding,
  syncSalesOrdersFromSource,
} from '../../../services/sales-order';
import {
  getWorkOrderSyncBinding,
  syncWorkOrdersFromSource,
} from '../../../services/work-order';
import {
  WORK_ORDER_SYNC_CUSTOM_FIELD_TABLE,
  WORK_ORDER_SYNC_REQUIRED_TARGETS,
  WORK_ORDER_SYNC_TARGET_FIELDS,
} from './workOrderSyncFields';

export function createWorkOrderSyncConfig(): SyncFromSourceConfig {
  return {
    titleKey: 'app.kuaizhizao.workOrder.syncFromSource',
    hintKey: 'app.kuaizhizao.workOrder.syncMasterDataFirstHint',
    apiRealtimeHintKey: 'app.kuaizhizao.workOrder.syncApiHint',
    datasetBatchHintKey: 'app.kuaizhizao.workOrder.syncDatasetHint',
    mainStepTitleKey: 'app.kuaizhizao.workOrder.syncStep.workOrder',
    prerequisiteSteps: [
      {
        id: 'unit',
        titleKey: 'app.master-data.materials.syncStep.unit',
        getBinding: getMaterialUnitSyncBinding,
        syncFromSource: syncMaterialUnitsFromSource,
      },
      {
        id: 'group',
        titleKey: 'app.master-data.materials.syncStep.group',
        getBinding: getMaterialGroupSyncBinding,
        syncFromSource: syncMaterialGroupsFromSource,
      },
      {
        id: 'material',
        titleKey: 'app.kuaizhizao.workOrder.syncStep.material',
        getBinding: getMaterialSyncBinding,
        syncFromSource: (payload, onProgress) =>
          syncMaterialsFromSource({ ...payload, skip_prerequisite_syncs: true }, onProgress),
      },
      {
        id: 'sales_order',
        titleKey: 'app.kuaizhizao.workOrder.syncStep.salesOrder',
        getBinding: getSalesOrderSyncBinding,
        syncFromSource: (payload, onProgress) =>
          syncSalesOrdersFromSource({ ...payload, skip_prerequisite_syncs: true }, onProgress),
      },
    ],
    skipBackendPrerequisites: true,
    targetFields: WORK_ORDER_SYNC_TARGET_FIELDS,
    loadAvailableTargetFields: () => loadSyncCustomTargetFields(WORK_ORDER_SYNC_CUSTOM_FIELD_TABLE),
    customFieldTableName: WORK_ORDER_SYNC_CUSTOM_FIELD_TABLE,
    requiredTargets: WORK_ORDER_SYNC_REQUIRED_TARGETS,
    getBinding: getWorkOrderSyncBinding,
    syncFromSource: syncWorkOrdersFromSource,
    completeSuccessKey: 'app.kuaizhizao.workOrder.syncComplete',
    completePartialKey: 'app.kuaizhizao.workOrder.syncPartial',
    failedKey: 'app.kuaizhizao.workOrder.syncFailed',
  };
}
