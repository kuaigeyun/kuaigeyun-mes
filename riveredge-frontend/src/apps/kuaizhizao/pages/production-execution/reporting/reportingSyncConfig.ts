import type { SyncFromSourceConfig } from '../../../../../components/sync-from-source-modal/types';
import { loadSyncCustomTargetFields } from '../../../../../components/sync-from-source-modal/loadSyncCustomTargetFields';
import {
  getWorkOrderSyncBinding,
  syncWorkOrdersFromSource,
} from '../../../services/work-order';
import {
  getReportingSyncBinding,
  syncReportingFromSource,
} from '../../../services/reporting';
import {
  REPORTING_SYNC_CUSTOM_FIELD_TABLE,
  REPORTING_SYNC_REQUIRED_TARGETS,
  REPORTING_SYNC_TARGET_FIELDS,
} from './reportingSyncFields';

/**
 * 报工 SyncFromSource：仅拉取。
 * 外推走 SyncPushHub → DocumentPushBatchPanel → POST /document-push，
 * 不再通过 syncToTarget / bidirectional 夹带推送。
 */
export function createReportingSyncConfig(): SyncFromSourceConfig {
  return {
    titleKey: 'app.kuaizhizao.workReporting.syncFromSource',
    hintKey: 'app.kuaizhizao.workReporting.syncMasterDataFirstHint',
    apiRealtimeHintKey: 'app.kuaizhizao.workReporting.syncApiHint',
    datasetBatchHintKey: 'app.kuaizhizao.workReporting.syncDatasetHint',
    mainStepTitleKey: 'app.kuaizhizao.workReporting.syncStep.reporting',
    prerequisiteSteps: [
      {
        id: 'work_order',
        titleKey: 'app.kuaizhizao.workReporting.syncStep.workOrder',
        getBinding: getWorkOrderSyncBinding,
        syncFromSource: syncWorkOrdersFromSource,
      },
    ],
    skipBackendPrerequisites: true,
    targetFields: REPORTING_SYNC_TARGET_FIELDS,
    loadAvailableTargetFields: () => loadSyncCustomTargetFields(REPORTING_SYNC_CUSTOM_FIELD_TABLE),
    customFieldTableName: REPORTING_SYNC_CUSTOM_FIELD_TABLE,
    requiredTargets: REPORTING_SYNC_REQUIRED_TARGETS,
    getBinding: getReportingSyncBinding,
    syncFromSource: syncReportingFromSource,
    completeSuccessKey: 'app.kuaizhizao.workReporting.syncComplete',
    completePartialKey: 'app.kuaizhizao.workReporting.syncPartial',
    failedKey: 'app.kuaizhizao.workReporting.syncFailed',
  };
}
