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
  getCustomerSyncBinding,
  syncCustomersFromSource,
} from '../../../../master-data/services/supply-chain';
import {
  getSalesOrderSyncBinding,
  syncSalesOrdersFromSource,
} from '../../../services/sales-order';
import {
  SALES_ORDER_SYNC_REQUIRED_TARGETS,
  SALES_ORDER_SYNC_TARGET_FIELDS,
} from './salesOrderSyncFields';

export function createSalesOrderSyncConfig(): SyncFromSourceConfig {
  return {
    titleKey: 'app.kuaizhizao.salesOrder.syncFromSource',
    hintKey: 'app.kuaizhizao.salesOrder.syncMasterDataFirstHint',
    apiRealtimeHintKey: 'app.kuaizhizao.salesOrder.syncApiHint',
    datasetBatchHintKey: 'app.kuaizhizao.salesOrder.syncDatasetHint',
    mainStepTitleKey: 'app.kuaizhizao.salesOrder.syncStep.salesOrder',
    prerequisiteSteps: [
      {
        id: 'customer',
        titleKey: 'app.kuaizhizao.salesOrder.syncStep.customer',
        getBinding: getCustomerSyncBinding,
        // 透传弹窗 incremental（默认 true）：有成功水位只拉变更，勿每次全量重写数千客户
        syncFromSource: syncCustomersFromSource,
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
        titleKey: 'app.kuaizhizao.salesOrder.syncStep.material',
        getBinding: getMaterialSyncBinding,
        // 透传增量；物料内置单位/分组前置由 skip_prerequisite_syncs 交给本弹窗步骤
        syncFromSource: (payload, onProgress) =>
          syncMaterialsFromSource({ ...payload, skip_prerequisite_syncs: true }, onProgress),
      },
    ],
    skipBackendPrerequisites: true,
    targetFields: SALES_ORDER_SYNC_TARGET_FIELDS,
    requiredTargets: SALES_ORDER_SYNC_REQUIRED_TARGETS,
    validateMapping: (targetToSource, t: TFunction) => {
      for (const required of SALES_ORDER_SYNC_REQUIRED_TARGETS) {
        if (!targetToSource[required]) {
          const label = SALES_ORDER_SYNC_TARGET_FIELDS.find((field) => field.value === required)?.labelKey;
          return t('components.syncFromSource.mappingRequired', {
            field: label ? t(label) : required,
          });
        }
      }
      const hasCustomer =
        targetToSource.customer_id || targetToSource.customer_code || targetToSource.customer_name;
      if (!hasCustomer) {
        return t('components.syncFromSource.customerMappingRequired');
      }
      if (!targetToSource['item.material_code'] || !targetToSource['item.required_quantity']) {
        return t('components.syncFromSource.itemMappingRequired');
      }
      return null;
    },
    getBinding: getSalesOrderSyncBinding,
    syncFromSource: syncSalesOrdersFromSource,
    completeSuccessKey: 'app.kuaizhizao.salesOrder.syncComplete',
    completePartialKey: 'app.kuaizhizao.salesOrder.syncPartial',
    failedKey: 'app.kuaizhizao.salesOrder.syncFailed',
  };
}
