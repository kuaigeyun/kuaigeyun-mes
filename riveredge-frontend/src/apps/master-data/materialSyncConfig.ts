import type { SyncFromSourceConfig } from '../../components/sync-from-source-modal/types';
import { loadSyncCustomTargetFields } from '../../components/sync-from-source-modal/loadSyncCustomTargetFields';
import {
  getMaterialGroupSyncBinding,
  getMaterialSyncBinding,
  syncMaterialGroupsFromSource,
  syncMaterialsFromSource,
} from './services/material';
import {
  getMaterialUnitSyncBinding,
  syncMaterialUnitsFromSource,
} from './services/material-unit';
import {
  MATERIAL_SYNC_AVAILABLE_TARGET_FIELDS,
  MATERIAL_SYNC_CUSTOM_FIELD_TABLE,
  MATERIAL_SYNC_REQUIRED_TARGETS,
  MATERIAL_SYNC_TARGET_FIELDS,
} from './pages/materials/materialSyncFields';

export function createMaterialSyncConfig(): SyncFromSourceConfig {
  return {
    titleKey: 'app.master-data.materials.syncFromSource',
    hintKey: 'app.master-data.materials.syncHint',
    apiRealtimeHintKey: 'app.master-data.materials.syncApiHint',
    datasetBatchHintKey: 'app.master-data.materials.syncDatasetHint',
    mainStepTitleKey: 'app.master-data.materials.syncStep.material',
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
    ],
    skipBackendPrerequisites: true,
    targetFields: MATERIAL_SYNC_TARGET_FIELDS,
    availableTargetFields: MATERIAL_SYNC_AVAILABLE_TARGET_FIELDS,
    loadAvailableTargetFields: () => loadSyncCustomTargetFields(MATERIAL_SYNC_CUSTOM_FIELD_TABLE),
    customFieldTableName: MATERIAL_SYNC_CUSTOM_FIELD_TABLE,
    requiredTargets: MATERIAL_SYNC_REQUIRED_TARGETS,
    getBinding: getMaterialSyncBinding,
    syncFromSource: syncMaterialsFromSource,
    completeSuccessKey: 'app.master-data.materials.syncComplete',
    completePartialKey: 'app.master-data.materials.syncPartial',
    failedKey: 'app.master-data.materials.syncFailed',
  };
}
