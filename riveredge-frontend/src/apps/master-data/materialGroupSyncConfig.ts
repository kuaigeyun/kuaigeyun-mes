import type { SyncFromSourceConfig } from '../../components/sync-from-source-modal/types';
import { loadSyncCustomTargetFields } from '../../components/sync-from-source-modal/loadSyncCustomTargetFields';
import { getMaterialGroupSyncBinding, syncMaterialGroupsFromSource } from './services/material';
import {
  MATERIAL_GROUP_SYNC_AVAILABLE_TARGET_FIELDS,
  MATERIAL_GROUP_SYNC_CUSTOM_FIELD_TABLE,
  MATERIAL_GROUP_SYNC_REQUIRED_TARGETS,
  MATERIAL_GROUP_SYNC_TARGET_FIELDS,
} from './pages/materials/groupSyncFields';

export function createMaterialGroupSyncConfig(): SyncFromSourceConfig {
  return {
    titleKey: 'app.master-data.materials.groupSyncFromSource',
    hintKey: 'app.master-data.materials.groupSyncHint',
    apiRealtimeHintKey: 'app.master-data.materials.groupSyncApiHint',
    datasetBatchHintKey: 'app.master-data.materials.groupSyncDatasetHint',
    targetFields: MATERIAL_GROUP_SYNC_TARGET_FIELDS,
    availableTargetFields: MATERIAL_GROUP_SYNC_AVAILABLE_TARGET_FIELDS,
    loadAvailableTargetFields: () => loadSyncCustomTargetFields(MATERIAL_GROUP_SYNC_CUSTOM_FIELD_TABLE),
    customFieldTableName: MATERIAL_GROUP_SYNC_CUSTOM_FIELD_TABLE,
    requiredTargets: MATERIAL_GROUP_SYNC_REQUIRED_TARGETS,
    getBinding: getMaterialGroupSyncBinding,
    syncFromSource: syncMaterialGroupsFromSource,
    completeSuccessKey: 'app.master-data.materials.groupSyncComplete',
    completePartialKey: 'app.master-data.materials.groupSyncPartial',
    failedKey: 'app.master-data.materials.groupSyncFailed',
  };
}
