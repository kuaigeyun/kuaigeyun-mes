import type { SyncFromSourceConfig } from '../../../components/sync-from-source-modal/types';

import { getMaterialGroupSyncBinding, syncMaterialGroupsFromSource } from './services/material';

import {

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

    requiredTargets: MATERIAL_GROUP_SYNC_REQUIRED_TARGETS,

    getBinding: getMaterialGroupSyncBinding,

    syncFromSource: syncMaterialGroupsFromSource,

    completeSuccessKey: 'app.master-data.materials.groupSyncComplete',

    completePartialKey: 'app.master-data.materials.groupSyncPartial',

    failedKey: 'app.master-data.materials.groupSyncFailed',

  };

}

