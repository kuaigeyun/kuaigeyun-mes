import type { TFunction } from 'i18next';
import type { SyncFromSourceConfig } from '../../../../../components/sync-from-source-modal/types';
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
  getSupplierSyncBinding,
  syncSuppliersFromSource,
} from '../../../../master-data/services/supply-chain';
import {
  getPurchaseOrderSyncBinding,
  syncPurchaseOrdersFromSource,
} from '../../../services/purchase';
import {
  PURCHASE_ORDER_SYNC_REQUIRED_TARGETS,
  PURCHASE_ORDER_SYNC_TARGET_FIELDS,
} from './purchaseOrderSyncFields';

export function createPurchaseOrderSyncConfig(): SyncFromSourceConfig {
  return {
    titleKey: 'app.kuaizhizao.purchaseOrder.syncFromSource',
    hintKey: 'app.kuaizhizao.purchaseOrder.syncMasterDataFirstHint',
    apiRealtimeHintKey: 'app.kuaizhizao.purchaseOrder.syncApiHint',
    datasetBatchHintKey: 'app.kuaizhizao.purchaseOrder.syncDatasetHint',
    mainStepTitleKey: 'app.kuaizhizao.purchaseOrder.syncStep.purchaseOrder',
    prerequisiteSteps: [
      {
        id: 'supplier',
        titleKey: 'app.kuaizhizao.purchaseOrder.syncStep.supplier',
        getBinding: getSupplierSyncBinding,
        // 透传弹窗 incremental（默认 true）：有成功水位只拉变更，勿每次全量重写
        syncFromSource: syncSuppliersFromSource,
      },
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
        titleKey: 'app.kuaizhizao.purchaseOrder.syncStep.material',
        getBinding: getMaterialSyncBinding,
        syncFromSource: (payload, onProgress) =>
          syncMaterialsFromSource({ ...payload, skip_prerequisite_syncs: true }, onProgress),
      },
    ],
    skipBackendPrerequisites: true,
    targetFields: PURCHASE_ORDER_SYNC_TARGET_FIELDS,
    requiredTargets: PURCHASE_ORDER_SYNC_REQUIRED_TARGETS,
    validateMapping: (targetToSource, t: TFunction) => {
      for (const required of PURCHASE_ORDER_SYNC_REQUIRED_TARGETS) {
        if (!targetToSource[required]) {
          const label = PURCHASE_ORDER_SYNC_TARGET_FIELDS.find((field) => field.value === required)?.labelKey;
          return t('components.syncFromSource.mappingRequired', {
            field: label ? t(label) : required,
          });
        }
      }
      if (!targetToSource['item.material_code'] || !targetToSource['item.ordered_quantity']) {
        return t('components.syncFromSource.purchaseOrderItemMappingRequired');
      }
      return null;
    },
    getBinding: getPurchaseOrderSyncBinding,
    syncFromSource: syncPurchaseOrdersFromSource,
    completeSuccessKey: 'app.kuaizhizao.purchaseOrder.syncComplete',
    completePartialKey: 'app.kuaizhizao.purchaseOrder.syncPartial',
    failedKey: 'app.kuaizhizao.purchaseOrder.syncFailed',
  };
}
